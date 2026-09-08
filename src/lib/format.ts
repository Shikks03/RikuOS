/**
 * format.ts — shared presentation primitives.
 *
 * DELIBERATELY UNPREFIXED. Personal and Academics need the same two age
 * grammars and the same pluraliser; a `freelance`-prefixed copy would be
 * duplicated the day the second page is built.
 *
 * Two age grammars live here side by side because the app genuinely has two:
 * a machine stamp (`36h`, `3d`) for the health strip, and a human duration
 * (`4 hours ago`, `3 weeks ago`) for what is waiting on a person. Do not merge
 * them, and do not "fix" one to look like the other.
 *
 * The two age grammars take a FINITE number. An unreadable timestamp is the
 * caller's finding, decided where the string arrives (as `evaluateOutreach`'s
 * `engine-unreadable` does), never a duration — there is no honest string for
 * one at this level.
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * Block F's stamp. Hours read badly past a couple of days; the real fault this
 * grammar was written for was 696h old.
 *
 * MOVED here from outreachHealth.ts unchanged. That file now imports it, so
 * there is exactly one implementation of the digest's `last ran 3d ago` and
 * the page's `checked 6h ago`. They must never disagree.
 */
export function formatAge(ms: number): string {
  // Block F feeds this a stored `checkedAt` written by another Vercel instance,
  // so a small clock skew must read `0h`, never `-1h` — formatWaiting's clamp.
  const hours = Math.floor(Math.max(0, ms) / HOUR_MS);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Singular at exactly one; everything else — zero included — takes the plural. */
export function pluralise(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/**
 * Block E's waiting line: `just now` under an hour, then hours, days, weeks.
 *
 * A negative age — a clock skew between ShikksTracker and Vercel — reads as
 * `just now` rather than a negative duration. It is the only honest answer:
 * as far as this machine can tell the event is not in the past yet.
 */
export function formatWaiting(ms: number): string {
  if (ms < HOUR_MS) return "just now";
  if (ms < DAY_MS) {
    const hours = Math.floor(ms / HOUR_MS);
    return `${hours} ${pluralise(hours, "hour")} ago`;
  }
  if (ms < WEEK_MS) {
    const days = Math.floor(ms / DAY_MS);
    return `${days} ${pluralise(days, "day")} ago`;
  }
  const weeks = Math.floor(ms / WEEK_MS);
  return `${weeks} ${pluralise(weeks, "week")} ago`;
}

export type CellTone = "value" | "zero" | "dash";

export interface Cell {
  text: string;
  /** -> the `.zero` / `.dash` class in components.css; "value" takes neither. */
  tone: CellTone;
}

/** The em-dash for every absence in the app, exported so there is exactly one. */
export const DASH = "—";

/**
 * The page's central correctness rule in four lines: `0` is a measurement and
 * `—` is an absence, and rendering both the same way is a bug rather than a
 * style choice. `--ink-4` is reserved for the absences.
 */
export function numberCell(value: number | null): Cell {
  // A non-finite number is an absence too: the function whose one job is
  // keeping a measurement apart from a non-measurement must not print `NaN`.
  if (value === null || !Number.isFinite(value)) return { text: DASH, tone: "dash" };
  if (value === 0) return { text: "0", tone: "zero" };
  return { text: String(value), tone: "value" };
}
