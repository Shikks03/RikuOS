import { NextRequest, NextResponse } from "next/server";
import { requireForwardSecret } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getOsSettings } from "@/lib/osSettings";
import { draftPolicy, parseInboundEvent } from "@/lib/triage";
import { decideIngest } from "@/lib/ingestTriage";
import { generateTriageDraft } from "@/lib/draftTriage";
import { buildPushPayload, sendPushToAll } from "@/lib/push";
import TriageResponseApproval from "@/models/approvals/TriageResponseApproval";
import ApprovalItem from "@/models/ApprovalItem";
import AgentRun, { type IAgentRunCounts } from "@/models/AgentRun";

/**
 * The caller (ShikksTracker's webhook forward) waits on this response, and
 * draftTriage.ts's own timeout (20s, maxRetries: 1) is sized to leave
 * comfortable headroom under this ceiling for the DB writes and the push
 * that run after it returns.
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
 * guard), unparseable (400), or genuinely-failed (500 — DB down, etc.)
 * request is an error.
 *
 * Ordering rules this route obeys (CLAUDE.md):
 *  - the ApprovalItem is written before the AgentRun record, and the AgentRun
 *    write is wrapped so its failure can never turn an already-queued item
 *    into a misleading 500 (see writeRun);
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
    return NextResponse.json({ error: "Unrecognised event shape." }, { status: 400 });
  }

  const startedAt = new Date();

  try {
    await connectDB();

    // Dedup by Meta's message id — Meta redelivers, and so may a retrying
    // forward. Checked before any policy decision or AgentRun write: a
    // redelivery is the same event arriving twice, not a new candidate to
    // count.
    const existing = await ApprovalItem.findOne({
      type: "triage-response",
      "payload.messageId": event.mid,
    }).select({ _id: 1 });
    if (existing) {
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

    const item = await TriageResponseApproval.create({
      source: "triage",
      title: decision.title,
      summary: decision.summary,
      staleAt: decision.staleAt,
      payload: decision.payload,
    });

    // The item is durable before the run record is attempted, and writeRun
    // swallows its own failures — a run-record write failure must never turn
    // this already-queued item into a 500 that looks like the forward failed.
    await writeRun(startedAt, true, { itemsCreated: 1, itemsProcessed: 1 });

    // Alerts last (CLAUDE.md): the item and the run record are already
    // durable, so a push failure cannot leave a drafted reply unrecorded. And
    // the push is load-bearing here rather than a convenience — with nothing
    // auto-sending, it is the only thing that can reach Riku inside a
    // 24-hour window.
    const hoursLeft = Math.max(
      0,
      Math.floor((decision.staleAt.getTime() - Date.now()) / 3_600_000)
    );
    await sendPushToAll(
      buildPushPayload(decision.title, `${decision.summary} · ${hoursLeft}h to reply`, "/queue")
    ).catch((pushErr) => {
      console.error("[messenger/inbound] push could not be sent:", pushErr);
    });

    return NextResponse.json({ ok: true, action: "created", id: String(item._id) });
  } catch (err) {
    // A genuine infra failure (DB down, etc.) here is honest: nothing was
    // understood or queued, so a 500 does not misrepresent anything the way
    // it would if it happened after the item already existed (that path is
    // handled above, via writeRun's own try/catch).
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
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
