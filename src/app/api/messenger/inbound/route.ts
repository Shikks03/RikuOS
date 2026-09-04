import { NextRequest, NextResponse } from "next/server";
import { requireForwardSecret } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getOsSettings } from "@/lib/osSettings";
import { draftPolicy, parseInboundEvent } from "@/lib/triage";
import { decideIngest } from "@/lib/ingestTriage";
import { generateTriageDraft } from "@/lib/draftTriage";
import { buildPushPayload, sendPushToAll } from "@/lib/push";
import TriageResponseApproval from "@/models/approvals/TriageResponseApproval";
import AgentRun, { type IAgentRunCounts } from "@/models/AgentRun";

/**
 * draftTriage.ts's own timeout is 20s with maxRetries: 0 (TRIAGE_TIMEOUT_MS)
 * — pinned to zero specifically because this route has a hard wall and an
 * SDK retry would eat into it, so the worst case is ONE attempt, roughly 20s,
 * before decideIngest returns. That leaves roughly the remaining 40s of this
 * 60s budget for connectDB (which alone allows up to 10s of server
 * selection), the dedup lookup, the item write, the AgentRun write, and the
 * push loop (10s per subscription, sequential — a phone and a laptop alone is
 * 20s). Still not spacious headroom for a single-user app's handful of
 * subscribed devices, and not something to add more sequential I/O to
 * without re-checking this budget — but with maxRetries: 1 (the value this
 * comment used to document) the same arithmetic left NEGATIVE headroom: a
 * ~41s worst-case draft call plus ~20s of push alone already exceeded the 60s
 * ceiling, and Vercel kills the function mid-push when that happens —
 * uncatchable, unloggable, and silent because the ApprovalItem and AgentRun
 * are already durable by then.
 */
export const maxDuration = 60;

/**
 * POST /api/messenger/inbound — ShikksTracker forwards an inbound Messenger
 * message here.
 *
 * Always answers 200 for anything it understood, including skips. The caller
 * is a webhook handler in another repo: a non-2xx would make it look as
 * though message ingestion had failed, when in fact RikuOS simply decided
 * there was nothing to queue. Only an unauthenticated (401/500 from the
 * guard), unparseable (400), or genuinely-failed (500 — DB down, etc.,
 * before anything was queued) request is an error.
 *
 * Ordering rules this route obeys (CLAUDE.md):
 *  - the ApprovalItem is written before the AgentRun record. A run-record
 *    write failure is swallowed inside writeRun, and any OTHER failure after
 *    the item exists is caught by the outer try/catch's queued-item branch —
 *    either way it can never turn an already-queued item into a misleading
 *    500 (see writeRun and the outer catch below);
 *  - alerts are queued and sent LAST, after all data state is settled, so a
 *    push failure can never leave a drafted reply unrecorded;
 *  - a drafting failure never costs the window — decideIngest owns that
 *    guarantee, this route just doesn't defeat it.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireForwardSecret(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  const event = parseInboundEvent(body);
  if (!event) {
    // parseInboundEvent's contract is "logged and dropped" — this is the log.
    // ShikksTracker forwarding a shape RikuOS doesn't recognise (a renamed
    // field, say) would otherwise 400 silently forever, with nothing in
    // RikuOS's own logs to say why. Top-level KEYS ONLY, never the body: it
    // carries a stranger's message text.
    console.warn(
      "[messenger/inbound] rejected an unparseable forward; top-level keys:",
      Object.keys(body ?? {})
    );
    return NextResponse.json({ error: "Unrecognised event shape." }, { status: 400 });
  }

  const startedAt = new Date();
  // Set the instant the item is durable. Lets the outer catch tell "nothing
  // was queued" (a genuine failure, an honest 500) apart from "the item
  // exists but a later step blew up" (not a failure the caller should be
  // told about as one — see the catch block).
  let queuedItemId: string | undefined;

  try {
    await connectDB();

    // Dedup by Meta's message id — Meta redelivers, and so may a retrying
    // forward. Queried through the discriminator model, not the base
    // ApprovalItem: payload.messageId lives on TriageResponseApproval's
    // schema, not the base one, and with strictQuery: true (src/lib/db.ts) a
    // filter path only reliably casts when queried through a model whose own
    // schema declares it. Querying the base model can still happen to work,
    // but only because it depends on the discriminator having been
    // registered by some OTHER import elsewhere in the module graph first —
    // brittle, import-order-dependent behaviour this route must not lean on
    // (see models.test.ts's "casts through the discriminator" test for the
    // pinned shape). This is the cheap fast path, not the guarantee — the
    // unique partial index on payload.messageId (ApprovalItem.ts) is the
    // atomic backstop under it, and it has to be: decideIngest's drafter is a
    // ~20s Anthropic call, so a slow draft leaves tens of seconds for a
    // redelivery to race straight past this check into a second create.
    const existing = await TriageResponseApproval.findOne({
      "payload.messageId": event.mid,
    }).select({ _id: 1 });
    if (existing) {
      // Same outcome as the E11000 branch below (a redelivery of a message
      // already queued), so it gets the same AgentRun record — CLAUDE.md:
      // every agent run writes one. Before this fix only the slower, rarer
      // E11000 path did; this fast path (the common case, since it wins the
      // findOne race almost every time) recorded nothing at all.
      await writeRun(startedAt, true, { itemsProcessed: 1, itemsSkipped: 1 });
      return NextResponse.json({ ok: true, action: "duplicate" });
    }

    const settings = await getOsSettings();
    const policy = draftPolicy(settings);
    const decision = await decideIngest(startedAt, event, policy, generateTriageDraft);

    if (decision.action === "skip") {
      // The event WAS considered, it just wasn't queued.
      await writeRun(startedAt, true, { itemsProcessed: 1, itemsSkipped: 1 });
      return NextResponse.json({ ok: true, action: "skip", reason: decision.reason });
    }

    try {
      const item = await TriageResponseApproval.create({
        source: "triage",
        title: decision.title,
        summary: decision.summary,
        staleAt: decision.staleAt,
        payload: decision.payload,
      });
      queuedItemId = String(item._id);
    } catch (createErr) {
      // The findOne above is a fast path with a real gap behind it (see its
      // comment) — the unique partial index is what actually enforces this.
      // A duplicate key means a concurrent request (most likely
      // ShikksTracker's own retry, racing a slow draft) won that race first;
      // the item demonstrably already exists, so this is the duplicate
      // outcome, not a failure. Mirrors cron/chaser treating E11000 as
      // "already-queued".
      if ((createErr as { code?: number }).code === 11000) {
        await writeRun(startedAt, true, { itemsProcessed: 1, itemsSkipped: 1 });
        return NextResponse.json({ ok: true, action: "duplicate" });
      }
      throw createErr;
    }

    // The item is durable before the run record is attempted, and writeRun
    // swallows its own failures — a run-record write failure must never turn
    // this already-queued item into a 500 that looks like the forward failed.
    await writeRun(startedAt, true, { itemsCreated: 1, itemsProcessed: 1 });

    // Alerts last (CLAUDE.md): the item and the run record are already
    // durable, so a push failure cannot leave a drafted reply unrecorded. And
    // the push is load-bearing here rather than a convenience — with nothing
    // auto-sending, it is the only thing that can reach Riku inside a
    // 24-hour window. The deadline leads the body, not the summary: both
    // buildTriageSummary and buildPushPayload can run up to 200 characters,
    // so summary-first would let a long inbound message silently truncate
    // the "Nh to reply" tail off exactly the notifications that most need it
    // said plainly.
    const hoursLeft = Math.max(
      0,
      Math.floor((decision.staleAt.getTime() - Date.now()) / 3_600_000)
    );
    const pushResult = await sendPushToAll(
      buildPushPayload(decision.title, `${hoursLeft}h to reply · ${decision.summary}`, "/queue")
    ).catch((pushErr) => {
      console.error("[messenger/inbound] push could not be sent:", pushErr);
      return null;
    });
    // sendPushToAll does not throw when it reaches nobody — no subscriptions,
    // or every send failing, both just resolve with sent: 0. Left unchecked
    // that is indistinguishable from success, for the one channel this
    // feature has to reach Riku inside the window.
    if (pushResult && pushResult.sent === 0) {
      console.error(
        `[messenger/inbound] push reached zero devices for item ${queuedItemId}:`,
        pushResult
      );
    }

    return NextResponse.json({ ok: true, action: "created", id: queuedItemId });
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
    if (queuedItemId) {
      // The item already exists — whatever failed happened AFTER the side
      // effect that matters, so a 500 here would misrepresent what actually
      // happened: the caller would read it as "the forward failed" when the
      // item is sitting in the queue. Note it and move on; a human can read
      // the server log.
      console.error(
        `[messenger/inbound] a step after item ${queuedItemId} was queued failed:`,
        message
      );
      return NextResponse.json({
        ok: true,
        action: "created",
        id: queuedItemId,
        note: "queued, but a follow-up step failed — see server logs",
      });
    }
    // A genuine infra failure here (DB down, etc.) is honest: nothing was
    // understood or queued, so a 500 does not misrepresent anything.
    await writeRun(startedAt, false, {}, message);
    await notifyFailure(message);
    return NextResponse.json({ error: "Triage ingest failed." }, { status: 500 });
  }
}

async function writeRun(
  startedAt: Date,
  ok: boolean,
  counts: Partial<IAgentRunCounts>,
  error?: string
): Promise<void> {
  try {
    await AgentRun.create({
      agent: "triage",
      startedAt,
      durationMs: Date.now() - startedAt.getTime(),
      ok,
      counts,
      ...(error !== undefined ? { error: error.slice(0, 2000) } : {}),
    });
  } catch (runErr) {
    console.error("[messenger/inbound] failed to write AgentRun:", runErr);
  }
}

async function notifyFailure(error: string): Promise<void> {
  try {
    await sendPushToAll(buildPushPayload("Messenger triage failed", error));
  } catch (pushErr) {
    console.error("[messenger/inbound] failure push could not be sent:", pushErr);
  }
}
