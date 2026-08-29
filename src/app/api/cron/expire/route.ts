import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireCronSecret } from "@/lib/auth";
import { buildActionSweep, buildExpirySweep } from "@/lib/queue";
import { buildPushPayload, sendPushToAll } from "@/lib/push";
import ApprovalItem from "@/models/ApprovalItem";
import AgentRun from "@/models/AgentRun";

/**
 * GET /api/cron/expire
 *
 * Flips pending ApprovalItems whose staleAt has passed to "expired" so stale
 * items never linger (ARCHITECTURE.md §2.2). Writes an AgentRun record every
 * run; on failure, a push alert is queued LAST — after all data state is
 * settled — so a notification failure can never corrupt data (CLAUDE.md).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = requireCronSecret(request);
  if (guard) return guard;

  const startedAt = new Date();
  let expired = 0;
  let unstuck = 0;
  let ok = true;
  let error: string | undefined;

  try {
    await connectDB();
    const now = new Date();

    const expiry = buildExpirySweep(now);
    expired = (await ApprovalItem.updateMany(expiry.filter, expiry.update)).modifiedCount;

    // P4: an action claimed but never resolved means the function died between
    // the outward call and recording its result — the side effect may or may
    // not have landed. Park it for a human rather than leaving an in-flight
    // state behind (CLAUDE.md).
    const stuck = buildActionSweep(now);
    unstuck = (await ApprovalItem.updateMany(stuck.filter, stuck.update)).modifiedCount;
  } catch (err) {
    ok = false;
    error = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
  }

  // Run record — wrapped so a logging failure can't mask the sweep outcome.
  try {
    await AgentRun.create({
      agent: "expiry-sweep",
      startedAt,
      durationMs: Date.now() - startedAt.getTime(),
      ok,
      counts: { itemsCreated: 0, itemsProcessed: expired + unstuck },
      ...(error !== undefined ? { error } : {}),
    });
  } catch (runErr) {
    console.error("[cron/expire] failed to write AgentRun:", runErr);
  }

  // Alert queued last (CLAUDE.md: alerts are sent last; failures notify the
  // human — no silent failure, no retry loop).
  if (!ok) {
    try {
      await sendPushToAll(buildPushPayload("Expiry sweep failed", error ?? "Unknown error"));
    } catch (pushErr) {
      console.error("[cron/expire] failure alert could not be sent:", pushErr);
    }
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  if (unstuck > 0) {
    try {
      await sendPushToAll(
        buildPushPayload(
          "Interrupted actions need checking",
          `${unstuck} approved item${unstuck === 1 ? "" : "s"} could not confirm their result.`
        )
      );
    } catch (pushErr) {
      console.error("[cron/expire] stale-action alert could not be sent:", pushErr);
    }
  }

  return NextResponse.json({ ok: true, expired, unstuck });
}
