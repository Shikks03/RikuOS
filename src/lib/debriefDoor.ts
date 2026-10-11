/**
 * debriefDoor.ts — one press of "Debrief now" (S22, spec §3.1). The route is
 * three lines around this, so the behaviour is here, where a test can reach
 * it (plan deviation 11).
 *
 *   connectDB fails          → typed 500, no AgentRun row (there is nowhere to
 *                              write one; the morning route behaves the same)
 *   a Debrief < 1 min old    → that same document, no re-check, no run row:
 *                              nothing happened, so nothing is recorded
 *   otherwise                → one runJob("debrief") row: baseline, checks,
 *                              build, and the save LAST; a failed save still
 *                              answers (saved: false) and is a failed item
 *   the job throws           → typed 500 (its run row says why); nothing saved
 *
 * A failed CACHE READ is not a failed Debrief: it means "nothing to reuse"
 * and falls through to a real build. Site only: this door sends nothing
 * outward, drafts nothing, approves nothing and never expires the queue — the
 * 07:00 sweep stays the only place stale items expire.
 *
 * Two devices pressing in the same second both build, and the last write
 * wins — this app's standing convention for an overwritten-whole singleton
 * (spec §3.1: accepted, no guard).
 */

import { connectDB } from "@/lib/db";
import { runJob } from "@/lib/jobs/runJob";
import { DEBRIEF_CACHE_MS } from "@/lib/constants";
import { MONGO_READ_TIMEOUT_MS, withDeadline } from "@/lib/deadline";
import { isWithinCheckFloor } from "@/lib/healthSnapshot";
import { getLastDebrief, saveLastDebrief } from "@/lib/lastDebrief";
import { readDebriefChecks, readTodaysBaseline } from "@/lib/debriefRead";
import { buildDebrief, countCouldntCheck, toDebriefResponse } from "@/lib/debrief";
import type { StoredDebrief } from "@/lib/briefingTypes";

export type DebriefPress =
  | { status: 200; body: StoredDebrief }
  | { status: 500; body: { error: "debrief-failed" } };

const FAILED: DebriefPress = { status: 500, body: { error: "debrief-failed" } };

export async function pressDebrief(now: Date): Promise<DebriefPress> {
  try {
    await connectDB();
  } catch (err) {
    console.error("[api/briefing/debrief] connectDB failed:", err);
    return FAILED;
  }

  let existing: StoredDebrief | null = null;
  try {
    existing = await withDeadline(getLastDebrief(), MONGO_READ_TIMEOUT_MS, "debrief cache read");
  } catch (err) {
    console.error("[api/briefing/debrief] cache read failed, building fresh:", err);
  }
  // The same 60-second rule as the site floor, but its own constant (spec
  // §3.2). A future `at` (clock skew) is never "inside" it.
  if (existing !== null && isWithinCheckFloor(now, existing.at, DEBRIEF_CACHE_MS)) {
    return { status: 200, body: existing };
  }

  const result = await runJob("debrief", async () => {
    const baseline = await readTodaysBaseline(now);
    const outcomes = await readDebriefChecks(now, baseline === null ? null : baseline.sentAt);
    const debrief = buildDebrief({ now, outcomes, baseline });
    // Last: every read and every pure step is done, so a failure above this
    // line leaves nothing half-saved (spec §6).
    let saved = true;
    try {
      await saveLastDebrief(debrief);
    } catch (err) {
      saved = false;
      console.error("[api/briefing/debrief] save failed:", err);
    }
    return {
      counts: { itemsProcessed: 1, itemsFailed: (saved ? 0 : 1) + countCouldntCheck(debrief) },
      data: { debrief, saved },
    };
  });

  if (!result.ok || result.data === null) return FAILED;
  return { status: 200, body: toDebriefResponse(result.data.debrief, result.data.saved) };
}
