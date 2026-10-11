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
import { APP_TZ, DEBRIEF_CACHE_MS, PUSH_EXPECTED_HOUR } from "@/lib/constants";
import { MONGO_READ_TIMEOUT_MS, withDeadline } from "@/lib/deadline";
import { clockHHMM, dayKey, todayKey } from "@/lib/days";
import { isWithinCheckFloor } from "@/lib/healthSnapshot";
import { getLastDebrief, saveLastDebrief } from "@/lib/lastDebrief";
import { readDebriefChecks, readTodaysBaseline } from "@/lib/debriefRead";
import { buildDebrief, countCouldntCheck, toDebriefResponse } from "@/lib/debrief";
import type { StoredDebrief } from "@/lib/briefingTypes";

export type DebriefPress =
  | { status: 200; body: StoredDebrief }
  | { status: 500; body: { error: "debrief-failed" } };

const FAILED: DebriefPress = { status: 500, body: { error: "debrief-failed" } };

/** Which side of PUSH_EXPECTED_HOUR (APP_TZ) a moment falls on. */
function pushHourSide(at: Date): "before" | "after" {
  return Number(clockHHMM(at, APP_TZ).slice(0, 2)) >= PUSH_EXPECTED_HOUR ? "after" : "before";
}

/**
 * Whether a cached Debrief still answers for `now` (fix round, principal
 * review item 1) — the double-press floor plus two more conditions:
 *
 *   - a different APP_TZ calendar day: without this, a press at 23:59:30 and
 *     another at 00:00:10 both land inside the 60-second floor and the
 *     second would hand back YESTERDAY's Debrief — and the panel remounting
 *     under a document already on screen is how that reads as "it closed".
 *   - the cached Debrief had no baseline (built before today's 07:00
 *     Briefing existed) and `now` has crossed PUSH_EXPECTED_HOUR since: the
 *     Briefing may have just been saved, so a comparison may now be possible
 *     where the cached "Right now" list said there was none. Simplified to
 *     "different sides of PUSH_EXPECTED_HOUR", which is what actually
 *     matters within a one-minute cache window.
 */
function cacheStillAnswers(now: Date, existing: StoredDebrief): boolean {
  if (!isWithinCheckFloor(now, existing.at, DEBRIEF_CACHE_MS)) return false;
  if (dayKey(existing.at, APP_TZ) !== todayKey(now)) return false;
  if (existing.baselineSentAt === null && pushHourSide(existing.at) !== pushHourSide(now)) return false;
  return true;
}

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
  // §3.2) — plus the day and 07:00 guards above. A future `at` (clock skew)
  // is never "inside" the floor to begin with.
  if (existing !== null && cacheStillAnswers(now, existing)) {
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
      // Bounded (fix round, feature review): an unbounded write could wait
      // out the socket timeout and run past this route's maxDuration, with
      // Vercel killing the function before the AgentRun row is written — a
      // silent failure. A timeout here is read exactly like a save that
      // threw: saved: false, counted as a failed item below.
      await withDeadline(saveLastDebrief(debrief), MONGO_READ_TIMEOUT_MS, "debrief save");
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
