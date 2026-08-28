import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireCronSecret } from "@/lib/auth";
import { buildExpirySweep } from "@/lib/queue";
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
  let ok = true;
  let error: string | undefined;

  try {
    await connectDB();
    const { filter, update } = buildExpirySweep(new Date());
    const result = await ApprovalItem.updateMany(filter, update);
    expired = result.modifiedCount;
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
      counts: { itemsCreated: 0, itemsProcessed: expired },
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

  return NextResponse.json({ ok: true, expired });
}
