/**
 * debrief.ts — the Debrief, composed (S22, spec §3.4, §4, §5). Pure: no
 * database, no network, no clock (`now` is a parameter). Imports are pure
 * modules or `import type` only.
 *
 * FRESH PROBLEMS come only from each source's own SUCCESSFUL outcome, through
 * problems.ts's per-source translators — never through buildProblems. A
 * source that fails wholesale (sites, the run history, ShikksTracker) produces
 * no Problem at all and sets its couldntCheck flag instead, so a Debrief can
 * never say "{Job} broke this morning." at 13:00, and one outage is never
 * reported twice (spec §3.4). Calendar and to-do failures are their own
 * findings and go in as the push takes them (digest.ts todayProblems).
 *
 * THE RECORD keeps exactly one side live (spec §5.1): with a baseline,
 * sorted/stillNeedsYou/new/since; without one, now. Standalone couldn't-check
 * lines are independent of that split.
 *
 * Strings stored are push-form, except `since` (sinceThenLines curls).
 */

import { APP_TZ } from "@/lib/constants";
import { clockHHMM, dayKey, todayKey } from "@/lib/days";
import { explain } from "@/lib/causes";
import { fromAnomaly, fromFinding, fromSite, type Problem } from "@/lib/problems";
import {
  boundText,
  composeTodayLine,
  freelanceLine,
  offLine,
  todayProblems,
  toStoredSymptom,
  type DigestTodayInput,
} from "@/lib/digest";
import { sinceThenLines, type SinceThenInput } from "@/lib/sinceThen";
import { numberWord } from "@/lib/voice";
import {
  BRIEFING_BOUNDS,
  DEBRIEF_BOUNDS,
  DEBRIEF_SOURCES,
  type DebriefRecord,
  type StoredDebrief,
  type StoredDebriefSymptom,
  type StoredSortedItem,
  type StoredSymptom,
} from "@/lib/briefingTypes";
import { CANT_SAY, STANDALONE, compareToBaseline, type Baseline, type SourceFlags, type StillRow } from "@/lib/debriefCompare";
import type { Anomaly, LatestRun } from "@/lib/watchdog";
import type { SiteResult } from "@/lib/siteHealth";
import type { OutreachFinding } from "@/lib/outreachHealth";

/** What one press read (debriefRead.ts). Each source is caught on its own. */
export interface DebriefOutcomes {
  /** The run history: the watchdog's verdicts, and the runs themselves (for New-row times). */
  watchdog: { ok: true; anomalies: Anomaly[]; runs: LatestRun[] } | { ok: false };
  /**
   * The three sites, fresh or reused inside the 60-second floor. `savedAt` is
   * when a HealthSnapshot last SAVED (this press's, or the reused one's, or
   * the last good one when this press's save failed); null = never.
   */
  sites:
    | { ok: true; results: SiteResult[]; savedAt: Date | null; ownSaveJustFailed: boolean }
    | { ok: false; savedAt: Date | null };
  /** ShikksTracker: summary AND attention — either one failing fails the source (spec §3.5). */
  shikkstracker:
    | { ok: true; findings: OutreachFinding[]; attention: { repliedUnanswered: number; overdue: number } }
    | { ok: false };
  today: DigestTodayInput;
  pending: number | "unavailable";
  chaserEnabled: boolean | "unavailable";
  /** Since-then reads against the baseline's sentAt; null with no baseline (or if they failed). */
  since: SinceThenInput | null;
}

/** The fresh problem list (spec §3.4). Never contains job-failed or pipeline-unavailable. */
export function freshProblems(o: DebriefOutcomes): Problem[] {
  const problems: Problem[] = [];
  if (o.watchdog.ok) for (const a of o.watchdog.anomalies) problems.push(fromAnomaly(a));
  if (o.sites.ok) for (const s of o.sites.results) if (!s.up) problems.push(fromSite(s));
  if (o.shikkstracker.ok) for (const f of o.shikkstracker.findings) problems.push(fromFinding(f));
  if (o.sites.ok && o.sites.ownSaveJustFailed) problems.push({ key: "snapshot-unsaved" });
  problems.push(...todayProblems(o.today));
  return problems;
}

/** The greeting-line text (spec §2.2, §10 item 1). Push-form. At most DEBRIEF_BOUNDS.title. */
export function debriefTitle(at: Date, outstanding: number): string {
  const stamp = clockHHMM(at, APP_TZ);
  if (outstanding === 0) return `Debrief at ${stamp}: all clear.`;
  if (outstanding === 1) return `Debrief at ${stamp}: one thing still needs you.`;
  return `Debrief at ${stamp}: ${numberWord(outstanding)} things still need you.`;
}

/**
 * A New row's sentence with the time its run happened (spec §4.2, plan
 * deviation 6): only agent-failed / agent-degraded, only for a run that
 * started today. Bold ranges are at the start of the sentence, so they stay
 * valid; a sentence that would overrun its bound is left as it was.
 */
function stamped(stored: StoredSymptom, p: Problem, runs: readonly LatestRun[], now: Date): StoredSymptom {
  if (p.key !== "agent-failed" && p.key !== "agent-degraded") return stored;
  const run = runs.find((r) => r.agent === p.agent);
  if (run === undefined || dayKey(run.startedAt, APP_TZ) !== todayKey(now)) return stored;
  if (!stored.sentence.endsWith(".")) return stored;
  const sentence = `${stored.sentence.slice(0, -1)} at ${clockHHMM(run.startedAt, APP_TZ)}.`;
  return sentence.length > BRIEFING_BOUNDS.symptomSentence ? stored : { ...stored, sentence };
}

function storeStill(row: StillRow): StoredDebriefSymptom {
  switch (row.kind) {
    case "fresh":
      return { ...toStoredSymptom(row.problem), note: null };
    case "verbatim":
      return { ...row.symptom, note: null };
    case "couldnt-check":
      return { ...row.symptom, note: CANT_SAY[row.source] };
  }
}

/** Sorted lines, each sentence once (plan deviation 12), bounded. */
function storeSorted(rows: ReadonlyArray<{ key: StoredSortedItem["key"]; subject: string | null; sentence: string }>): StoredSortedItem[] {
  const seen = new Set<string>();
  const out: StoredSortedItem[] = [];
  for (const r of rows) {
    if (seen.has(r.sentence)) continue;
    seen.add(r.sentence);
    out.push({ key: r.key, subject: r.subject, sentence: boundText(r.sentence, DEBRIEF_BOUNDS.sortedSentence) });
  }
  return out;
}

export interface DebriefBuildInput {
  now: Date;
  outcomes: DebriefOutcomes;
  baseline: Baseline | null;
}

/** The Debrief, ready to store (spec §5.1). Pure; the door saves it last. */
export function buildDebrief({ now, outcomes: o, baseline }: DebriefBuildInput): DebriefRecord {
  const fresh = freshProblems(o);
  const checkFailed: SourceFlags = { sites: !o.sites.ok, watchdog: !o.watchdog.ok, shikkstracker: !o.shikkstracker.ok };
  const snapshot = { checkedAt: o.sites.savedAt, ownSaveJustFailed: o.sites.ok && o.sites.ownSaveJustFailed };
  const cmp = compareToBaseline(baseline, fresh, snapshot, checkFailed);
  const runs = o.watchdog.ok ? o.watchdog.runs : [];

  // Counted before any bound slices a list (A-II's rule), and including the
  // standalone lines and the no-baseline list: "all clear" is never said over
  // a source that couldn't be checked (plan deviation 5).
  const outstanding = cmp.stillNeedsYou.length + cmp.new.length + cmp.now.length + cmp.standaloneCouldntCheck.length;

  const freelance = freelanceLine({
    attention: o.shikkstracker.ok ? o.shikkstracker.attention : null,
    pending: o.pending === "unavailable" ? 0 : o.pending,
  });
  const off = o.chaserEnabled === "unavailable" ? null : offLine(o.chaserEnabled ? [] : ["chaser"]);

  return {
    at: now,
    baselineSentAt: baseline === null ? null : baseline.sentAt,
    title: debriefTitle(now, outstanding),
    sorted: storeSorted(cmp.sorted).slice(0, DEBRIEF_BOUNDS.sorted),
    stillNeedsYou: cmp.stillNeedsYou.slice(0, DEBRIEF_BOUNDS.stillNeedsYou).map(storeStill),
    new: cmp.new.slice(0, DEBRIEF_BOUNDS.newProblems).map((p) => stamped(toStoredSymptom(p), p, runs, now)),
    now: cmp.now.slice(0, DEBRIEF_BOUNDS.now).map((p) => toStoredSymptom(p)),
    standaloneCouldntCheck: cmp.standaloneCouldntCheck
      .slice(0, DEBRIEF_BOUNDS.standalone)
      .map((source) => ({ source, sentence: STANDALONE[source] })),
    since:
      baseline !== null && o.since !== null
        ? sinceThenLines(o.since, baseline.sentAt, now)
            .slice(0, DEBRIEF_BOUNDS.since)
            .map((line) => boundText(line, DEBRIEF_BOUNDS.sinceLine))
        : [],
    today: boundText(composeTodayLine(o.today), DEBRIEF_BOUNDS.today),
    freelance: freelance === null ? null : boundText(freelance, DEBRIEF_BOUNDS.freelance),
    off: off === null ? null : boundText(off, DEBRIEF_BOUNDS.off),
    // Over every fresh problem (A-II's rule). None carries a raw error today,
    // so this is 0 in practice; it is counted so a future source with one is.
    unrecognised: fresh.filter((p) => explain(p).causeKey === "unrecognised").length,
    couldntCheck: checkFailed,
  };
}

/** How many sources couldn't be checked: each is a failed item on the run row (spec §3.4). */
export function countCouldntCheck(d: Pick<DebriefRecord, "couldntCheck">): number {
  return DEBRIEF_SOURCES.filter((s) => d.couldntCheck[s]).length;
}

/** The door's response: the stored Debrief plus the response-only `saved` (spec §3.1). */
export function toDebriefResponse(d: DebriefRecord, saved: boolean = true): StoredDebrief {
  return { ...d, saved };
}
