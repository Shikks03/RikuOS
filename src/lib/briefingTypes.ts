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
