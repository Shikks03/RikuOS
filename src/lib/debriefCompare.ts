/**
 * debriefCompare.ts — this morning's stored symptoms against a fresh re-check
 * (S22, spec §3.5). Pure: no database, no network, no clock (`now` is a
 * parameter). Imports are pure modules or `import type` only.
 *
 * Every stored symptom lands in exactly one place, decided in this order:
 *   1. snapshot-unsaved   → its own rule: did a snapshot save since 07:00?
 *   2. not re-checkable   → Still needs you, verbatim: unstuck-items, the
 *                           expiry sweep's job-failed, and a job-failed saved
 *                           before `subject` existed (plan deviation 2)
 *   3. its source failed  → Still needs you, with that source's can't-say note
 *   4. otherwise          → a fresh problem about the same thing? Still needs
 *                           you, re-explained from the FRESH problem : Sorted
 * Every fresh problem nothing claimed is New. A failed source with no
 * can't-say row of its own gets one standalone line instead (spec §3.4).
 *
 * "The same thing" (plan deviation 1): sites and agents match by FAMILY and
 * subject — one site yields at most one site-* problem and one agent at most
 * one agent-* anomaly, so a site that went from error 503 to timing out is
 * still down, never "back up". Every other key matches exactly.
 *
 * Step 3 runs before step 4, so a symptom reaching step 4 comes from a source
 * that answered on this press: "not found" there is a true success, never a
 * masked failure.
 *
 * Words here are push-form (straight apostrophes); the page curls them.
 */

import { APP_TZ } from "@/lib/constants";
import { dayKey, todayKey } from "@/lib/days";
import { explain } from "@/lib/causes";
import { AGENT_NAMES, subjectOf, type Problem } from "@/lib/problems";
import { capWord } from "@/lib/voice";
import {
  DEBRIEF_SOURCES,
  type DebriefSource,
  type ProblemKey,
  type StoredBold,
  type StoredSymptom,
} from "@/lib/briefingTypes";
import type { StoredDigest } from "@/lib/lastDigest";
import type { Agent } from "@/models/AgentRun";

export type SourceFlags = Record<DebriefSource, boolean>;

/** Today's 07:00 Briefing, flattened to its symptoms in report order. */
export interface Baseline {
  sentAt: Date;
  symptoms: StoredSymptom[];
}

/** When a HealthSnapshot last saved (null = never), and whether this press's own save just failed. */
export interface SnapshotState {
  checkedAt: Date | null;
  ownSaveJustFailed: boolean;
}

export interface SortedRow {
  key: ProblemKey;
  subject: string | null;
  sentence: string;
}

export type StillRow =
  /** Re-checked and still there: explained from the fresh problem. */
  | { kind: "fresh"; problem: Problem }
  /** Not re-checkable: exactly as stored at 07:00. */
  | { kind: "verbatim"; symptom: StoredSymptom }
  /** Its source couldn't be checked: as stored at 07:00, plus that source's note. */
  | { kind: "couldnt-check"; symptom: StoredSymptom; source: DebriefSource };

export interface DebriefComparison {
  sorted: SortedRow[];
  stillNeedsYou: StillRow[];
  new: Problem[];
  /** The no-baseline flat list (D5); empty whenever a baseline exists. */
  now: Problem[];
  /** One per failed source with no can't-say row to attach to, in DEBRIEF_SOURCES order. */
  standaloneCouldntCheck: DebriefSource[];
  couldntCheck: SourceFlags;
}

/** The can't-say note under a stored symptom whose source failed on this press (spec §10 item 4, approved). */
export const CANT_SAY: Readonly<Record<DebriefSource, string>> = Object.freeze({
  sites: "I couldn't check your sites just now, so I can't say whether that's sorted.",
  watchdog: "I couldn't check the run history just now, so I can't say whether that's sorted.",
  shikkstracker: "I couldn't reach ShikksTracker just now, so I can't say whether that's sorted.",
});

/** The standalone line for a failed source with nothing from it this morning (spec §10 item 4a, approved). */
export const STANDALONE: Readonly<Record<DebriefSource, string>> = Object.freeze({
  sites: "I couldn't check your sites just now.",
  watchdog: "I couldn't check the run history just now.",
  shikkstracker: "I couldn't reach ShikksTracker just now.",
});

/**
 * Today's 07:00 Briefing as the baseline, or null (D5): no digest, one from
 * another APP_TZ day, or one saved without a structured Briefing (plan
 * deviation 8). A morning that reached no device still counts — it was saved.
 */
export function baselineFromDigest(digest: StoredDigest | null, now: Date): Baseline | null {
  if (digest === null || digest.briefing === null) return null;
  if (dayKey(digest.sentAt, APP_TZ) !== todayKey(now)) return null;
  return { sentAt: digest.sentAt, symptoms: digest.briefing.stories.flatMap((story) => story.symptoms) };
}

type Route =
  | { kind: "source"; source: DebriefSource }
  | { kind: "plain" }
  | { kind: "not-re-checkable" }
  | { kind: "snapshot" };

function isAgent(subject: string | null): subject is Agent {
  return subject !== null && Object.prototype.hasOwnProperty.call(AGENT_NAMES, subject);
}

/** Which source re-checks a stored symptom (spec §3.5's table). */
function routeOf(s: StoredSymptom): Route {
  switch (s.key) {
    case "site-status":
    case "site-timeout":
    case "site-unreachable":
      return { kind: "source", source: "sites" };
    case "agent-never-ran":
    case "agent-stale":
    case "agent-failed":
    case "agent-degraded":
      return { kind: "source", source: "watchdog" };
    case "job-failed":
      if (s.subject === "watchdog") return { kind: "source", source: "watchdog" };
      if (s.subject === "site-health") return { kind: "source", source: "sites" };
      if (s.subject === "outreach-health") return { kind: "source", source: "shikkstracker" };
      // The expiry sweep never runs here; a subject-less job-failed can't be placed.
      return { kind: "not-re-checkable" };
    case "snapshot-unsaved":
      return { kind: "snapshot" };
    case "unstuck-items":
      return { kind: "not-re-checkable" };
    case "engine-never-ran":
    case "engine-unreadable":
    case "engine-stale":
    case "engine-errors":
    case "stranded-approved":
    case "pipeline-unavailable":
      return { kind: "source", source: "shikkstracker" };
    case "calendar-unavailable":
    case "calendar-partial":
    case "todos-unavailable":
      // No wholesale flag: a failed re-read is itself a fresh calendar/to-do problem.
      return { kind: "plain" };
  }
}

function family(key: ProblemKey): string {
  if (key.startsWith("site-")) return "site";
  if (key.startsWith("agent-")) return "agent";
  // evaluateOutreach returns at most one engine-* finding at a time, so
  // errors-turned-stale (etc.) is still the same unresolved condition, never
  // a fresh one (plan deviation 21). stranded-approved stays its own family.
  if (key.startsWith("engine-")) return "engine";
  // calendar-unavailable and calendar-partial are the same calendar read,
  // reported two ways (plan deviation 21).
  if (key === "calendar-unavailable" || key === "calendar-partial") return "calendar";
  return key;
}

/** The text of the first bold range — the catalogue always bolds the subject first ("Meowchi's site", "The chaser"). */
function leadText(text: string, bold: readonly StoredBold[]): string | null {
  const first = bold[0];
  if (first === undefined || first.start < 0 || first.end > text.length || first.start >= first.end) return null;
  return text.slice(first.start, first.end);
}

/** Is this fresh problem about the same thing as this stored symptom? */
function sameThing(stored: StoredSymptom, fresh: Problem): boolean {
  if (family(stored.key) !== family(fresh.key)) return false;
  // calendar-unavailable carries no subject at all; it matches any fresh
  // calendar outcome, and a fresh calendar-unavailable matches any stored
  // calendar symptom, regardless of subject — the same read, reported
  // differently (plan deviation 21). Partial-vs-partial still goes by subject.
  if (stored.key === "calendar-unavailable" || fresh.key === "calendar-unavailable") return true;
  const subject = subjectOf(fresh);
  if (stored.subject !== null) return stored.subject === subject;
  // A key with no subject is one condition: the family (= the key) is enough.
  if (subject === null) return true;
  // Saved before `subject` existed (plan deviation 2). A partial calendar
  // outage is one condition per morning, whatever names it lists.
  if (fresh.key === "calendar-partial") return true;
  const storedLead = leadText(stored.sentence, stored.bold);
  const explained = explain(fresh).sentence;
  const freshLead = leadText(explained.text, explained.bold);
  return storedLead !== null && freshLead !== null && storedLead.toLowerCase() === freshLead.toLowerCase();
}

/** The fixed Sorted sentence per key (spec §4.2, §10 item 3 — approved). */
function sortedSentence(s: StoredSymptom): string {
  switch (s.key) {
    case "site-status":
    case "site-timeout":
    case "site-unreachable": {
      const name = s.subject !== null ? `${s.subject}'s site` : (leadText(s.sentence, s.bold) ?? "That site");
      return `${name} is back up.`;
    }
    case "agent-never-ran":
    case "agent-stale":
    case "agent-failed":
    case "agent-degraded": {
      const name = isAgent(s.subject) ? capWord(AGENT_NAMES[s.subject]) : (leadText(s.sentence, s.bold) ?? "That job");
      return `${name} is running again.`;
    }
    case "job-failed": {
      const name = isAgent(s.subject) ? capWord(AGENT_NAMES[s.subject]) : "That check";
      return `${name} ran clean just now.`;
    }
    case "snapshot-unsaved":
      return "Today's site check is saved now.";
    case "engine-never-ran":
    case "engine-unreadable":
    case "engine-stale":
    case "engine-errors":
    case "stranded-approved":
      return "ShikksTracker's sender is moving again.";
    case "pipeline-unavailable":
      return "I can reach ShikksTracker again.";
    case "calendar-unavailable":
    case "calendar-partial":
      return "Your calendar's answering again.";
    case "todos-unavailable":
      return "I can read your to-dos again.";
    case "unstuck-items":
      // Never reached: routeOf sends unstuck-items to Still needs you,
      // verbatim, before a sorted sentence is ever asked for (pinned by test).
      throw new Error("unstuck-items is never re-checked, so it is never sorted");
  }
}

/**
 * The comparison (spec §3.5). `fresh` never contains job-failed or
 * pipeline-unavailable (debrief.ts's freshProblems can't produce them); if one
 * ever slipped through it would still resolve — matched like any other key,
 * or New — rather than crash.
 */
export function compareToBaseline(
  baseline: Baseline | null,
  fresh: Problem[],
  snapshot: SnapshotState,
  checkFailed: SourceFlags,
): DebriefComparison {
  const couldntCheck: SourceFlags = { ...checkFailed };
  const failedSources = DEBRIEF_SOURCES.filter((s) => checkFailed[s]);

  if (baseline === null) {
    return { sorted: [], stillNeedsYou: [], new: [], now: [...fresh], standaloneCouldntCheck: failedSources, couldntCheck };
  }

  const used = new Set<number>();
  const take = (matches: (p: Problem) => boolean): Problem | null => {
    const i = fresh.findIndex((p, j) => !used.has(j) && matches(p));
    if (i === -1) return null;
    used.add(i);
    return fresh[i];
  };

  const sorted: SortedRow[] = [];
  const stillNeedsYou: StillRow[] = [];

  for (const s of baseline.symptoms) {
    const route = routeOf(s);

    if (route.kind === "snapshot") {
      const savedSince = snapshot.checkedAt !== null && snapshot.checkedAt.getTime() > baseline.sentAt.getTime();
      // The sites check itself failed wholesale this press (it never ran),
      // so nothing was actually re-checked — that's "couldn't check", never
      // a fresh "couldn't save the result" (plan deviation 21).
      if (checkFailed.sites && !savedSince) {
        stillNeedsYou.push({ kind: "couldnt-check", symptom: s, source: "sites" });
        continue;
      }
      // This press's own save failure (if any) is consumed here, so it is never New as well.
      const own = take((p) => p.key === "snapshot-unsaved");
      if (!snapshot.ownSaveJustFailed && savedSince) {
        sorted.push({ key: s.key, subject: s.subject, sentence: sortedSentence(s) });
      } else {
        stillNeedsYou.push({ kind: "fresh", problem: own ?? { key: "snapshot-unsaved" } });
      }
      continue;
    }

    if (route.kind === "not-re-checkable") {
      stillNeedsYou.push({ kind: "verbatim", symptom: s });
      continue;
    }

    if (route.kind === "source" && checkFailed[route.source]) {
      stillNeedsYou.push({ kind: "couldnt-check", symptom: s, source: route.source });
      continue;
    }

    const match = take((p) => sameThing(s, p));
    if (match !== null) stillNeedsYou.push({ kind: "fresh", problem: match });
    else sorted.push({ key: s.key, subject: s.subject, sentence: sortedSentence(s) });
  }

  // A morning job failure's watchdog twin must never also surface (plan
  // deviation 21): the watchdog monitors site-health and outreach-health as
  // agents too, so its fresh scan can re-find the SAME still-failed run that
  // job-failed already reported and is being spoken for above (Sorted or
  // can't-say) — never a separate New row for it. A stored snapshot-unsaved
  // is the same job's degraded outcome, so it covers a fresh
  // agent-degraded{site-health} the same way.
  const coveredJobAgents = new Set(
    baseline.symptoms
      .filter((sym) => sym.key === "job-failed" && (sym.subject === "site-health" || sym.subject === "outreach-health"))
      .map((sym) => sym.subject as string),
  );
  const snapshotStoredThisMorning = baseline.symptoms.some((sym) => sym.key === "snapshot-unsaved");
  const isJobsWatchdogTwin = (p: Problem): boolean => {
    if ((p.key === "agent-failed" || p.key === "agent-degraded") && coveredJobAgents.has(p.agent)) return true;
    return snapshotStoredThisMorning && p.key === "agent-degraded" && p.agent === "site-health";
  };

  const covered = new Set(stillNeedsYou.flatMap((row) => (row.kind === "couldnt-check" ? [row.source] : [])));
  return {
    sorted,
    stillNeedsYou,
    new: fresh.filter((p, j) => !used.has(j) && !isJobsWatchdogTwin(p)),
    now: [],
    standaloneCouldntCheck: failedSources.filter((s) => !covered.has(s)),
    couldntCheck,
  };
}
