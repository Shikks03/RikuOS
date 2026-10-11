/**
 * debriefRead.ts — the Debrief's fresh checks (S22, spec §3.3). Impure.
 *
 * Shaped like sinceThenRead.ts and digestToday.ts: every read is independent,
 * bounded (MONGO_READ_TIMEOUT_MS for Mongo; ST_TIMEOUT_MS / SITE_TIMEOUT_MS /
 * Google's per-layer timeout inside the reused readers) and caught into its
 * own outcome, so one slow or failed read never costs the others.
 * readDebriefChecks never throws, and its legs run in parallel: the press
 * costs the slowest leg, not the sum.
 *
 * WRITES: exactly one, deliberately — saveHealthSnapshot, when "Check now"'s
 * 60-second floor doesn't apply, so the Freelance page's health strip picks
 * up the Debrief's own reading (spec §3.3). Inside the floor the stored
 * reading is reused and no client site is pinged twice. Nothing else is
 * written here: no queue change, no expiry, no notification, nothing sent.
 * Settings come through readOsSettings (R37), never the upserting accessor.
 *
 * Callers must have connectDB()'d already — the same convention as the rest
 * of the lib layer (readSinceThen connects for itself).
 */

import { MONGO_READ_TIMEOUT_MS, withDeadline } from "@/lib/deadline";
import { todayKey, type DayKey } from "@/lib/days";
import { readOsSettings, type OsSettingsValues } from "@/lib/osSettings";
import { EXPECTATIONS, evaluateWatchdog, fetchLatestRuns } from "@/lib/watchdog";
import { checkSites, type SiteResult } from "@/lib/siteHealth";
import { getHealthSnapshot, isWithinCheckFloor, saveHealthSnapshot, type StoredHealth } from "@/lib/healthSnapshot";
import { evaluateOutreach } from "@/lib/outreachHealth";
import { ATTENTION_LIMIT, fetchAttention, fetchSummary } from "@/lib/stApi";
import { readDigestToday } from "@/lib/digestToday";
import { readSinceThen } from "@/lib/sinceThenRead";
import { getLastDigest } from "@/lib/lastDigest";
import { baselineFromDigest, type Baseline } from "@/lib/debriefCompare";
import { OS_SETTINGS_DEFAULTS } from "@/models/OsSettings";
import ApprovalItem from "@/models/ApprovalItem";
import type { DebriefOutcomes } from "@/lib/debrief";
import type { DigestTodayInput } from "@/lib/digest";
import type { SinceThenInput } from "@/lib/sinceThen";

function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  return withDeadline(promise, MONGO_READ_TIMEOUT_MS, `debrief ${label}`);
}

/**
 * Today's 07:00 Briefing, or null (D5, plan deviation 8). A read that fails
 * is logged and compared against nothing — the Debrief still completes, as
 * the flat "Right now" list.
 */
export async function readTodaysBaseline(now: Date): Promise<Baseline | null> {
  try {
    return baselineFromDigest(await bounded(getLastDigest(), "baseline read"), now);
  } catch (err) {
    console.error("[debrief] baseline read failed, comparing against nothing:", err);
    return null;
  }
}

/** The run history, judged exactly as the morning's watchdog judges it. A failure is the source failing, never a problem. */
export async function readWatchdogForDebrief(now: Date): Promise<DebriefOutcomes["watchdog"]> {
  try {
    const runs = await bounded(fetchLatestRuns(EXPECTATIONS.map((e) => e.agent)), "run history");
    return { ok: true, anomalies: evaluateWatchdog(now, runs), runs };
  } catch (err) {
    console.error("[debrief] run history read failed:", err);
    return { ok: false };
  }
}

/**
 * The three sites. Inside CHECK_FLOOR_MS the stored reading is reused, exactly
 * as POST /api/health/sites does, so a Debrief pressed right after "Check
 * now" (or the reverse) never pings a client's site twice. Otherwise a fresh
 * check, saved to HealthSnapshot. `savedAt` is when a snapshot last SAVED —
 * the reused one's, this press's, or (when this press's save failed) the last
 * good one — which snapshot-unsaved's recheck reads (spec §3.5).
 */
export async function readSitesForDebrief(): Promise<DebriefOutcomes["sites"]> {
  let existing: StoredHealth | null = null;
  try {
    existing = await bounded(getHealthSnapshot(), "snapshot read");
  } catch (err) {
    console.error("[debrief] snapshot read failed, checking the sites fresh:", err);
  }
  if (existing !== null && isWithinCheckFloor(new Date(), existing.checkedAt)) {
    return { ok: true, results: existing.sites, savedAt: existing.checkedAt, ownSaveJustFailed: false };
  }

  const lastSavedAt = existing === null ? null : existing.checkedAt;
  let results: SiteResult[];
  try {
    results = await checkSites();
  } catch (err) {
    console.error("[debrief] site check failed:", err);
    return { ok: false, savedAt: lastSavedAt };
  }

  // The moment the reading was taken — after the checks resolve (saveHealthSnapshot's contract).
  const checkedAt = new Date();
  try {
    // Bounded (fix round, feature review): an unbounded write could wait out
    // the socket timeout and run past the route's maxDuration, losing the
    // AgentRun row along with it. A timeout here is read exactly like any
    // other failed save — ownSaveJustFailed, the last good savedAt kept.
    await bounded(saveHealthSnapshot(checkedAt, results), "snapshot write");
    return { ok: true, results, savedAt: checkedAt, ownSaveJustFailed: false };
  } catch (err) {
    console.error("[debrief] snapshot write failed:", err);
    return { ok: true, results, savedAt: lastSavedAt, ownSaveJustFailed: true };
  }
}

/**
 * ShikksTracker's sender (summary) and attention feed — one source behind one
 * secret: either call failing fails the whole source (spec §3.5), and it
 * produces no problem, only the couldn't-check flag.
 */
export async function readShikksTrackerForDebrief(now: Date, chaserNDays: number): Promise<DebriefOutcomes["shikkstracker"]> {
  try {
    const [summary, attention] = await Promise.all([fetchSummary(), fetchAttention(chaserNDays, ATTENTION_LIMIT)]);
    return {
      ok: true,
      findings: evaluateOutreach(now, summary),
      attention: { repliedUnanswered: attention.repliedUnanswered.length, overdue: attention.overdueActions?.length ?? 0 },
    };
  } catch (err) {
    console.error("[debrief] ShikksTracker read failed:", err);
    return { ok: false };
  }
}

/** Today's calendar and to-dos. Without settings the calendar can't be read: it says so (plan deviation 17). */
async function readTodayForDebrief(settings: OsSettingsValues | null, day: DayKey): Promise<DigestTodayInput> {
  if (settings !== null) return readDigestToday(settings.layers, day);
  // No layers → no Google call; only the to-do half is read.
  const todos = await readDigestToday([], day);
  return { ...todos, events: "unavailable", missedLayers: [], calendarCause: "read-failed" };
}

/** Every fresh check a press makes (spec §3.3), in parallel. Never throws. */
export async function readDebriefChecks(now: Date, baselineSentAt: Date | null): Promise<DebriefOutcomes> {
  const day = todayKey(now);
  const settings: Promise<OsSettingsValues | null> = bounded(readOsSettings(), "settings").catch((err: unknown) => {
    console.error("[debrief] settings read failed:", err);
    return null;
  });

  const [watchdog, sites, shikkstracker, today, pending, since, settingsValue] = await Promise.all([
    readWatchdogForDebrief(now),
    readSitesForDebrief(),
    settings.then((s) => readShikksTrackerForDebrief(now, s === null ? OS_SETTINGS_DEFAULTS.chaserNDays : s.chaserNDays)),
    settings.then((s) => readTodayForDebrief(s, day)),
    bounded(ApprovalItem.countDocuments({ status: "pending" }), "pending count").catch((err: unknown): "unavailable" => {
      console.error("[debrief] pending count failed:", err);
      return "unavailable";
    }),
    baselineSentAt === null
      ? Promise.resolve<SinceThenInput | null>(null)
      : readSinceThen(baselineSentAt, now).catch((err: unknown): null => {
          console.error("[debrief] since-then read failed:", err);
          return null;
        }),
    settings,
  ]);

  return {
    watchdog,
    sites,
    shikkstracker,
    today,
    pending,
    chaserEnabled: settingsValue === null ? "unavailable" : settingsValue.chaserEnabled,
    since,
  };
}
