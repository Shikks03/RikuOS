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

import type { DayKey } from "@/lib/days";

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

function dayNumber(key: DayKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday, for an APP_TZ day key. */
export function weekday(key: DayKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function saltHash(salt: string): number {
  let h = 0;
  for (const ch of salt) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * One line of `pool` for `day`. index(d) = (d × step + offset) mod n, with
 * step in 1..n−1: consecutive days differ by `step`, which is never 0 mod n,
 * so a line never repeats on consecutive days. The salt varies the step and
 * offset per pool, so two pools don't move in lockstep.
 */
export function pickLine<T>(pool: readonly T[], day: DayKey, salt: string): T {
  if (pool.length === 0) throw new Error("pickLine: empty pool");
  if (pool.length === 1) return pool[0];
  const n = pool.length;
  const h = saltHash(salt);
  const step = 1 + (h % (n - 1));
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

/** The read on the day. Problems always outrank the mood (R23). */
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
