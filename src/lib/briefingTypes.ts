/**
 * briefingTypes.ts — the Briefing's closed sets and stored shape (S21).
 * IMPORT-FREE on purpose: src/models/LastDigest.ts takes its enums from here,
 * and a model must not pull in the lib layer.
 */

export const PROBLEM_KEYS = [
  "site-status",
  "site-timeout",
  "site-unreachable",
  "agent-never-ran",
  "agent-stale",
  "agent-failed",
  "agent-degraded",
  "job-failed",
  "snapshot-unsaved",
  "unstuck-items",
  "engine-never-ran",
  "engine-unreadable",
  "engine-stale",
  "engine-errors",
  "stranded-approved",
  "pipeline-unavailable",
  "calendar-unavailable",
  "calendar-partial",
  "todos-unavailable",
] as const;
export type ProblemKey = (typeof PROBLEM_KEYS)[number];

/**
 * Where a cause came from. The first seven are raw-error rules (spec §4.3);
 * "known" is a fact the app holds (an expired Google token); "fixed" is the
 * catalogue's one likely cause for a key with no raw error; "none" is the
 * honest "I can see it failed, but not why"; "unrecognised" is a raw error no
 * rule matched — counted for the later ask-Claude fallback (spec §4.5).
 */
export const CAUSE_KEYS = [
  "timeout",
  "network",
  "database",
  "auth",
  "forbidden",
  "rate-limit",
  "upstream",
  "known",
  "fixed",
  "none",
  "unrecognised",
] as const;
export type CauseKey = (typeof CAUSE_KEYS)[number];

export const BRIEFING_BOUNDS = {
  stories: 12,
  symptoms: 8,
  bold: 4,
  storySentence: 240,
  symptomSentence: 200,
  nextStep: 160,
  cause: 240,
  raw: 300,
  today: 600,
  freelance: 240,
  off: 120,
} as const;

export interface StoredBold {
  start: number;
  end: number;
}

export interface StoredSymptom {
  key: ProblemKey;
  /**
   * S22: what the symptom is about — a site name, an agent or job id, the
   * failing calendars sorted and comma-joined — or null for a key that is a
   * single condition. A Debrief matches this morning's symptoms by it
   * (problems.ts subjectOf). Records saved before it existed read as null.
   */
  subject: string | null;
  sentence: string;
  bold: StoredBold[];
  nextStep: string;
  causeKey: CauseKey;
  cause: string;
  causeBold: StoredBold[];
  raw: string | null;
}

export interface StoredStory {
  sentence: string;
  bold: StoredBold[];
  symptoms: StoredSymptom[];
}

/** Every string is PUSH-FORM (straight apostrophes); the page curls it. */
export interface StoredBriefing {
  stories: StoredStory[];
  today: string;
  freelance: string | null;
  off: string | null;
  unrecognised: number;
  /** How many stories the slice to BRIEFING_BOUNDS.stories dropped. 0 normally; 0 also for a record saved before this field existed. */
  omitted: number;
}

// ---- The Debrief (S22) --------------------------------------------------------

export const DEBRIEF_BOUNDS = {
  /** A site/agent/job name, or several calendar names joined. */
  subject: 120,
  /** Matches PUSH_TITLE_MAX: "Debrief at HH:MM: …". */
  title: 80,
  sorted: 12,
  stillNeedsYou: 12,
  newProblems: 12,
  /** The no-baseline flat list. */
  now: 12,
  /** At most one line per source. */
  standalone: 3,
  today: 600,
  freelance: 240,
  off: 120,
  /** Matches SINCE_THEN_MAX_LINES. */
  since: 6,
  sinceLine: 300,
  sortedSentence: 200,
  standaloneSentence: 120,
  /** The can't-say line under a Still-needs-you row (plan deviation 4). */
  note: 120,
} as const;

/** The three sources that can fail wholesale on a press (spec §3.4). */
export const DEBRIEF_SOURCES = ["sites", "watchdog", "shikkstracker"] as const;
export type DebriefSource = (typeof DEBRIEF_SOURCES)[number];

export interface StoredSortedItem {
  key: ProblemKey;
  subject: string | null;
  sentence: string;
}

export interface StoredStandaloneLine {
  source: DebriefSource;
  sentence: string;
}

/** A Still-needs-you row: the symptom plus, when its source couldn't be checked, the can't-say note. */
export interface StoredDebriefSymptom extends StoredSymptom {
  note: string | null;
}

/** Every string is PUSH-FORM except `since` (sinceThenLines already curls); the page curls the rest. */
export interface StoredDebrief {
  /** When this Debrief was built (the press). */
  at: Date;
  /** The 07:00 Briefing compared against, or null (D5). */
  baselineSentAt: Date | null;
  /** The greeting-line text, "Debrief at HH:MM: …". */
  title: string;
  /** Populated only when baselineSentAt !== null. */
  sorted: StoredSortedItem[];
  stillNeedsYou: StoredDebriefSymptom[];
  new: StoredSymptom[];
  /** Populated only when baselineSentAt === null. */
  now: StoredSymptom[];
  /** One line per failed source with no can't-say row to attach to; shown after `new` or `now`. */
  standaloneCouldntCheck: StoredStandaloneLine[];
  /** "What you've done" lines; empty when baselineSentAt is null. */
  since: string[];
  today: string;
  freelance: string | null;
  off: string | null;
  unrecognised: number;
  couldntCheck: { sites: boolean; watchdog: boolean; shikkstracker: boolean };
  /** NOT persisted — the door sets it on the response only (spec §3.1). */
  saved: boolean;
}

/** What is stored: the Debrief without the response-only `saved`. */
export type DebriefRecord = Omit<StoredDebrief, "saved">;
