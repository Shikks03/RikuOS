import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireCronSecret } from "@/lib/auth";
import { getOsSettings } from "@/lib/osSettings";
import { fetchAttention } from "@/lib/stApi";
import { generateFollowupDraft } from "@/lib/draftFollowup";
import {
  buildApprovalInput,
  planChaserRun,
  CHASER_ATTENTION_LIMIT,
  CHASER_MAX_PER_RUN,
} from "@/lib/chaser";
import type { SkippedLead } from "@/lib/chaser";
import { buildPushPayload, sendPushToAll } from "@/lib/push";
import ApprovalItem from "@/models/ApprovalItem";
import AgentRun from "@/models/AgentRun";
import FollowupDraftApproval from "@/models/approvals/FollowupDraftApproval";

/**
 * Vercel's per-invocation ceiling for this route. The wall-clock budget below
 * is deliberately well under it so the function always reaches its AgentRun
 * write and its push, rather than being killed with nothing recorded.
 */
export const maxDuration = 60;

/** Stop STARTING new drafts past this point in the run (P4-i). */
const WALL_CLOCK_BUDGET_MS = 45_000;

/**
 * GET /api/cron/chaser
 *
 * Daily. Reads ShikksTracker's replied-but-unanswered feed, drafts a reply per
 * lead, and queues each one for approval. It never sends anything: the
 * Approval Queue is the authorization boundary for agent actions
 * (ARCHITECTURE.md §6), and the outward call happens only when Riku approves.
 *
 * Ordering rules this route obeys (CLAUDE.md):
 *  - every run writes an AgentRun record, success or failure;
 *  - alerts are queued and sent LAST, after all data state is settled, so a
 *    notification failure can never corrupt data;
 *  - one lead's failure never aborts the run — it is counted and the loop moves
 *    on. Nothing is retried in a loop; the human is the escalation path.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = requireCronSecret(request);
  if (guard) return guard;

  const startedAt = new Date();
  const deadline = startedAt.getTime() + WALL_CLOCK_BUDGET_MS;

  let ok = true;
  let error: string | undefined;
  let created = 0;
  let processed = 0;
  let failed = 0;
  const skipped: SkippedLead[] = [];

  try {
    await connectDB();
    const settings = await getOsSettings();

    if (!settings.chaserEnabled) {
      // A disabled agent still records a run, so the watchdog (P5) can tell
      // "switched off" apart from "cron never fired".
      await writeRun(startedAt, true, 0, 0, 0, 0, "chaser is disabled in OsSettings");
      return NextResponse.json({ ok: true, disabled: true });
    }

    const attention = await fetchAttention(settings.chaserNDays, CHASER_ATTENTION_LIMIT);
    processed = attention.repliedUnanswered.length;

    // Idempotency, query layer (P4-e). The unique partial index on
    // { payload.replyToLogId } where status is "pending" is the atomic backstop
    // under this; the E11000 catch below turns a lost race into a skip.
    const anchors = attention.repliedUnanswered.map((i) => i.replyToLogId).filter(Boolean);
    const liveAnchorIds = new Set<string>();
    if (anchors.length > 0) {
      const live = await ApprovalItem.find({
        type: "followup-draft",
        status: { $in: ["pending", "approved", "edited_approved"] },
        "payload.replyToLogId": { $in: anchors },
      })
        .select({ payload: 1 })
        .limit(CHASER_ATTENTION_LIMIT)
        .lean();
      for (const doc of live as unknown as { payload?: { replyToLogId?: string } }[]) {
        if (doc.payload?.replyToLogId) liveAnchorIds.add(doc.payload.replyToLogId);
      }
    }

    const plan = planChaserRun(
      attention.repliedUnanswered,
      liveAnchorIds,
      CHASER_MAX_PER_RUN
    );
    skipped.push(...plan.skipped);

    for (const lead of plan.toDraft) {
      if (Date.now() > deadline) {
        skipped.push({ contactId: lead.contactId, reason: "time-budget" });
        continue;
      }
      try {
        const body = await generateFollowupDraft(
          lead,
          lead.channel as "email" | "facebook",
          new Date()
        );
        await FollowupDraftApproval.create(buildApprovalInput(lead, body, new Date()));
        created++;
      } catch (leadErr) {
        // A duplicate key means the unique index caught a race — that is a
        // skip, not a failure: the item already exists.
        if ((leadErr as { code?: number }).code === 11000) {
          skipped.push({ contactId: lead.contactId, reason: "already-queued" });
        } else {
          failed++;
          console.error(
            `[cron/chaser] lead ${lead.contactId} failed:`,
            leadErr instanceof Error ? leadErr.message : leadErr
          );
        }
      }
    }
  } catch (err) {
    ok = false;
    error = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
  }

  await writeRun(startedAt, ok, created, processed, skipped.length, failed, error);

  // Alerts last (CLAUDE.md). Both branches are wrapped: a push failure must
  // never change the HTTP outcome or the data already written.
  if (!ok) {
    await notify("Chaser run failed", error ?? "Unknown error");
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
  if (created > 0) {
    await notify(
      `${created} follow-up${created === 1 ? "" : "s"} to review`,
      "The chaser drafted replies for leads who never got an answer."
    );
  }
  if (failed > 0) {
    await notify(
      "Chaser: some leads failed",
      `${failed} lead${failed === 1 ? "" : "s"} could not be drafted. Check the logs.`
    );
  }

  return NextResponse.json({
    ok: true,
    created,
    processed,
    failed,
    skipped: summariseSkips(skipped),
  });
}

function summariseSkips(skipped: SkippedLead[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of skipped) out[s.reason] = (out[s.reason] ?? 0) + 1;
  return out;
}

async function writeRun(
  startedAt: Date,
  ok: boolean,
  itemsCreated: number,
  itemsProcessed: number,
  itemsSkipped: number,
  itemsFailed: number,
  error?: string
): Promise<void> {
  try {
    await AgentRun.create({
      agent: "chaser",
      startedAt,
      durationMs: Date.now() - startedAt.getTime(),
      ok,
      counts: { itemsCreated, itemsProcessed, itemsSkipped, itemsFailed },
      ...(error !== undefined ? { error: error.slice(0, 2000) } : {}),
    });
  } catch (runErr) {
    console.error("[cron/chaser] failed to write AgentRun:", runErr);
  }
}

async function notify(title: string, body: string): Promise<void> {
  try {
    await sendPushToAll(buildPushPayload(title, body));
  } catch (pushErr) {
    console.error("[cron/chaser] push could not be sent:", pushErr);
  }
}
