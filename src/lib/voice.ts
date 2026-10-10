/**
 * voice.ts — how the assistant talks (S21). Pure: no clock, no I/O.
 *
 * The voice is composed and friendly, speaks to Riku by name and never says
 * "sir" (spec §2). Every line here is written in advance, so every one is
 * tested; nothing is generated at runtime.
 *
 * TEXT IS PUSH-FORM. Strings here use straight apostrophes, which is what the
 * push must carry. Page text curls them with toPage() at render time (L10).
 * Bold is carried as character ranges beside the text (`Said`), never as
 * markup, so the push gets the plain text and the page can bold it.
 *
 * LINE CHOICE IS DETERMINISTIC (spec §3.3). pickLine walks a pool by a step
 * that is never a multiple of the pool's size, so two consecutive days can
 * never land on the same line, and the same morning always yields the same
 * text, which is what lets the page show exactly what the phone got.
 */

import { dayStart, type DayKey } from "@/lib/days";

export interface BoldRange {
  start: number;
  end: number;
}

/** A sentence and the ranges of it the page shows in bold. */
export interface Said {
  text: string;
  bold: BoldRange[];
}

export type Seg = string | { b: string };

/** A bold segment, for say(). */
export function b(text: string): { b: string } {
  return { b: text };
}

/** Joins segments into one Said, recording each bold segment's range. */
export function say(...segs: Seg[]): Said {
  let text = "";
  const bold: BoldRange[] = [];
  for (const s of segs) {
    if (typeof s === "string") {
      text += s;
    } else {
      bold.push({ start: text.length, end: text.length + s.b.length });
      text += s.b;
    }
  }
  return { text, bold };
}

/** The first letter up. Ranges are unaffected: the length does not change. */
export function capFirst(s: Said): Said {
  return { text: s.text.charAt(0).toUpperCase() + s.text.slice(1), bold: s.bold };
}

/**
 * Lowers the first letter only when the sentence opens with a word the voice
 * itself wrote: `The …`, or a capitalised number word. `I` stays `I`, and a
 * name (`Meowchi's site`, `ShikksTracker's sender`) is never touched.
 */
const OWN_LEADS = /^(The|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten) /;
export function lowerLead(s: Said): Said {
  if (!OWN_LEADS.test(s.text)) return s;
  return { text: s.text.charAt(0).toLowerCase() + s.text.slice(1), bold: s.bold };
}

/** Joins sentences with `sep`, shifting every later sentence's ranges. */
export function joinSaid(parts: Said[], sep: string): Said {
  let text = "";
  const bold: BoldRange[] = [];
  parts.forEach((p, i) => {
    if (i > 0) text += sep;
    const at = text.length;
    for (const r of p.bold) bold.push({ start: r.start + at, end: r.end + at });
    text += p.text;
  });
  return { text, bold };
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"] as const;

/** 0–10 as words, anything else as digits. */
export function numberWord(n: number): string {
  return Number.isInteger(n) && n >= 0 && n <= 10 ? WORDS[n] : String(n);
}

export function capWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Page text: straight apostrophes curled (L10). Never applied to a raw error. */
export function toPage(text: string): string {
  return text.replace(/'/g, "’");
}

/**
 * The day key as an integer day count. Delegates its parsing entirely to
 * days.ts's validated `dayStart`, which throws a RangeError on a malformed
 * or non-existent key (e.g. "2026-02-30") rather than letting Date.UTC roll
 * it silently into some other day.
 */
function dayNumber(key: DayKey): number {
  return Math.round(dayStart(key).getTime() / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday, for an APP_TZ day key. Throws on a bad key (see dayNumber). */
export function weekday(key: DayKey): number {
  return dayStart(key).getUTCDay();
}

function saltHash(salt: string): number {
  let h = 0;
  for (const ch of salt) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function gcd(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * One line of `pool` for `day`. index(d) = (d × step + offset) mod n, with
 * step chosen — by the salt's hash — from the steps in 1..n−1 that share no
 * factor with n (gcd(step, n) === 1), not just any step in that range. A
 * step coprime with n makes d ↦ d × step mod n a bijection on Z/n, so this
 * is coprime by construction, not by luck of the salt: consecutive days
 * never repeat a line, AND any run of n consecutive days visits every line
 * of the pool exactly once. The salt varies both the step and the offset
 * per pool, so two pools don't move in lockstep.
 */
export function pickLine<T>(pool: readonly T[], day: DayKey, salt: string): T {
  if (pool.length === 0) throw new Error("pickLine: empty pool");
  if (pool.length === 1) return pool[0];
  const n = pool.length;
  const h = saltHash(salt);
  const steps: number[] = [];
  for (let s = 1; s < n; s++) {
    if (gcd(s, n) === 1) steps.push(s);
  }
  const step = steps[h % steps.length];
  const idx = (((dayNumber(day) * step + h) % n) + n) % n;
  return pool[idx];
}

export const ANY_DAY_OPENERS = [
  "Morning, Riku.",
  "Good morning, Riku.",
  "Riku, good morning.",
  "Morning. Here's your day, Riku.",
  "Up and at it, Riku.",
  "Hey Riku, morning.",
] as const;

/**
 * Monday, Friday, Saturday and Sunday have their own opener. Sunday's is not
 * Saturday's, so the weekend doesn't repeat itself (plan deviation 1).
 */
export function opener(day: DayKey): string {
  switch (weekday(day)) {
    case 1:
      return "New week, Riku.";
    case 5:
      return "Last push of the week, Riku.";
    case 6:
      return "Easy morning, Riku.";
    case 0:
      return "Easy Sunday, Riku.";
    default:
      return pickLine(ANY_DAY_OPENERS, day, "opener");
  }
}

export type Mood =
  | { kind: "problems"; stories: number }
  | { kind: "busy" }
  | { kind: "quiet" }
  | { kind: "ordinary" };

/**
 * The read on the day. Problems always outrank the mood (R23).
 *
 * Precondition: the `problems` mood requires `stories >= 1` — callers map
 * zero stories to busy/quiet/ordinary before this is ever reached. Not
 * enforced here with a throw: a throw in the morning push's read-on-the-day
 * step would cost the whole push.
 */
export function readOnTheDay(mood: Mood, day: DayKey): string {
  switch (mood.kind) {
    case "problems": {
      const n = mood.stories;
      if (n === 1) return "One thing needs you.";
      if (n === 2) return "Two things need you.";
      const count = capWord(numberWord(n));
      return pickLine([`${count} things need you.`, `A rough night. ${count} things need you.`], day, "problems");
    }
    case "busy":
      return pickLine(["Full day ahead.", "Busy one today."], day, "busy");
    case "quiet":
      return pickLine(["Quiet one today.", "Clear runway today."], day, "quiet");
    case "ordinary":
      return pickLine(["All's well.", "Nothing's on fire."], day, "ordinary");
  }
}

/** The push title: opener + read on the day. At most 80 characters (tested). */
export function greeting(day: DayKey, mood: Mood): string {
  return `${opener(day)} ${readOnTheDay(mood, day)}`;
}

// ---- The Debrief's heading (S22, spec §2.1) ------------------------------------

export const DEBRIEF_AFTERNOON_OPENERS = ["Afternoon, Riku.", "Good afternoon, Riku.", "Riku, afternoon check-in."] as const;

export const DEBRIEF_EVENING_OPENERS = ["Evening, Riku.", "Good evening, Riku."] as const;

/** Approved by Riku 2026-10-11 (spec §10 item 2). */
export const DEBRIEF_NIGHT_OPENERS = ["Still up, Riku?", "Late one, Riku."] as const;

export type DebriefTimeBucket = "morning" | "afternoon" | "evening" | "night";

/** 05:00–11:59 morning · 12:00–16:59 afternoon · 17:00–20:59 evening · 21:00–04:59 night. `hour` is APP_TZ's. */
export function debriefTimeBucket(hour: number): DebriefTimeBucket {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/**
 * The Debrief's opener: by day (pickLine's coprime step, so never the same
 * line two days running within a bucket) and by which pool the hour selects.
 * The morning bucket reuses the 07:00 any-day pool under its own salt.
 */
export function debriefOpener(day: DayKey, hour: number): string {
  switch (debriefTimeBucket(hour)) {
    case "morning":
      return pickLine(ANY_DAY_OPENERS, day, "debrief-morning");
    case "afternoon":
      return pickLine(DEBRIEF_AFTERNOON_OPENERS, day, "debrief-afternoon");
    case "evening":
      return pickLine(DEBRIEF_EVENING_OPENERS, day, "debrief-evening");
    case "night":
      return pickLine(DEBRIEF_NIGHT_OPENERS, day, "debrief-night");
  }
}

/** Riku's own phrase from the brainstorm; it never varies. */
export const DEBRIEF_TAIL = "Here's where things stand.";

/** The panel's heading over a Debrief: opener + the fixed tail. Push-form; the page curls it. */
export function debriefHeading(day: DayKey, hour: number): string {
  return `${debriefOpener(day, hour)} ${DEBRIEF_TAIL}`;
}
