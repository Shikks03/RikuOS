/**
 * digest.ts — the one push Riku gets each morning, in the assistant's voice (S21).
 *
 * Pure, so the wording is testable without sending anything.
 *
 * It goes out EVERY day, including when nothing is wrong (P5a-4): an absence
 * only means something if the presence is unconditional.
 *
 * ORDER (D12, kept): problems, then the Today sentence, then freelance, then
 * what is switched off. Problems lead because buildPushPayload slices the body
 * at 320 and a lock screen shows less; the problems line is budgeted so that
 * slice never cuts the freelance line.
 *
 * TWO OUTPUTS. composeDigest is the push (title + body, budgeted). buildBriefing
 * is the full structured Briefing the site renders (never budgeted, only
 * bounded to the model's limits). They share their sentences, so the page can
 * never say something the push didn't. The route builds the briefing after the
 * send, inside a catch: a briefing bug never costs the push (spec §7.2).
 *
 * TITLE (S21): opener + read on the day, counting STORIES, not symptoms. A
 * problem morning never gets a cheerful read (R23).
 */

import { APP_TZ, PUSH_BODY_MAX } from "@/lib/constants";
import { addDays, clockHHMM, formatDay, type DayKey } from "@/lib/days";
import { daysLate, digestWindow, sortTodos, todoDueKey } from "@/lib/todos";
import type { CalendarWindow } from "@/lib/google";
import type { Layer } from "@/lib/osSettings";
import type { Agent } from "@/models/AgentRun";
import { AGENT_NAMES, boundRaw, type CalendarUnavailableCause, type Problem } from "@/lib/problems";
import { explain } from "@/lib/causes";
import { groupProblems, type Story } from "@/lib/stories";
import { capWord, greeting, joinSaid, lowerLead, numberWord, say, type Mood, type Said } from "@/lib/voice";
import { BRIEFING_BOUNDS, type StoredBold, type StoredBriefing } from "@/lib/briefingTypes";

export interface DigestInput {
  /** The APP_TZ day this push is for (todayKey(now)). Drives the greeting. */
  day: DayKey;
  pending: number;
  /** null = the OS API call failed: a problem, never zeros. */
  attention: { repliedUnanswered: number; overdue: number } | null;
  /** The failed attention call's message, bounded; null when it answered or said nothing. */
  attentionError: string | null;
  problems: Problem[];
  offAgents: Agent[];
  today: DigestTodayInput;
}

export interface Digest {
  title: string;
  body: string;
}

/** The input's problems plus the four the digest itself detects, in report order. */
function allProblems(input: DigestInput): Problem[] {
  const problems = [...input.problems];
  if (input.attention === null) problems.push({ key: "pipeline-unavailable", raw: boundRaw(input.attentionError) });
  const { today } = input;
  if (today.events === "unavailable") {
    problems.push({ key: "calendar-unavailable", cause: today.calendarCause ?? "read-failed" });
  } else if (today.events !== "none-enabled" && today.missedLayers.length > 0) {
    problems.push({ key: "calendar-partial", calendars: today.missedLayers });
  }
  if (today.due === "unavailable") problems.push({ key: "todos-unavailable" });
  return problems;
}

/** First story as is; then `Separately, …`; then `Also, …` (plan deviation 3). */
function storySentences(stories: Story[]): Said[] {
  return stories.map((s, i) => {
    if (i === 0) return s.sentence;
    const lead = i === 1 ? "Separately, " : "Also, ";
    const lowered = lowerLead(s.sentence);
    return joinSaid([say(lead), lowered], "");
  });
}

function moreSuffix(dropped: number): string {
  return `…and ${numberWord(dropped)} more, see the Briefing.`;
}

/** The problems line within `budget`: whole stories, the rest pointed at the Briefing. */
function problemsWithin(sentences: Said[], budget: number): string {
  const texts = sentences.map((s) => s.text);
  for (let keep = texts.length; keep >= 1; keep--) {
    const dropped = texts.length - keep;
    const line = [...texts.slice(0, keep), ...(dropped > 0 ? [moreSuffix(dropped)] : [])].join(" ");
    if (line.length <= budget) return line;
  }
  const dropped = texts.length - 1;
  const suffix = dropped > 0 ? ` ${moreSuffix(dropped)}` : "";
  const room = Math.max(2, budget - suffix.length);
  const first = texts[0].length > room ? `${texts[0].slice(0, room - 1).trimEnd()}…` : texts[0];
  return `${first}${suffix}`;
}

/** `One lead is waiting on your reply, one follow-up is overdue and three drafts are ready for your review.` */
export function freelanceLine(input: Pick<DigestInput, "attention" | "pending">): string | null {
  const parts: string[] = [];
  const count = (n: number, one: string, many: string) => (n === 1 ? `one ${one}` : `${numberWord(n)} ${many}`);
  if (input.attention !== null) {
    const { repliedUnanswered: r, overdue: o } = input.attention;
    if (r > 0) parts.push(`${count(r, "lead is", "leads are")} waiting on your reply`);
    if (o > 0) parts.push(`${count(o, "follow-up is", "follow-ups are")} overdue`);
  }
  if (input.pending > 0) parts.push(`${count(input.pending, "draft is", "drafts are")} ready for your review`);
  if (parts.length === 0) return null;
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${capWord(joined)}.`;
}

/** `The chaser's still off, by the way.` / `The chaser and the lead sweep are still off, by the way.` */
export function offLine(offAgents: Agent[]): string | null {
  if (offAgents.length === 0) return null;
  const names = offAgents.map((a) => AGENT_NAMES[a]);
  if (names.length === 1) return `${capWord(names[0])}'s still off, by the way.`;
  const joined = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${capWord(joined)} are still off, by the way.`;
}

function moodOf(stories: Story[], today: DigestTodayInput): Mood {
  if (stories.length > 0) return { kind: "problems", stories: stories.length };
  const events = Array.isArray(today.events) ? today.events.length : 0;
  const due = today.due === "unavailable" ? [] : today.due;
  const busy = events + due.filter((d) => d.dayLabel === "today").length + today.overdue.length;
  if (busy >= 4) return { kind: "busy" };
  const calendarQuiet = Array.isArray(today.events) ? today.events.length === 0 : today.events === "none-enabled";
  if (calendarQuiet && due.length === 0 && today.overdue.length === 0) return { kind: "quiet" };
  return { kind: "ordinary" };
}

export function composeDigest(input: DigestInput): Digest {
  const stories = groupProblems(allProblems(input));
  const title = greeting(input.day, moodOf(stories, input.today));

  const after = [freelanceLine(input), offLine(input.offAgents)].filter((s): s is string => s !== null);
  const sep = (parts: string[]) => parts.filter((p) => p.length > 0).join(" ");

  if (stories.length === 0) {
    const others = after;
    const budget = PUSH_BODY_MAX - (others.length > 0 ? others.join(" ").length + 1 : 0);
    return { title, body: sep([composeTodayLine(input.today, budget), ...after]) };
  }

  // Reserve the parts after the problems line and the Today line's most compact
  // form, then give the Today line whatever the problems line actually left.
  const afterLength = after.reduce((n, part) => n + 1 + part.length, 0);
  const compact = composeTodayLine(input.today, 0);
  const problemsBudget = PUSH_BODY_MAX - afterLength - (compact.length > 0 ? compact.length + 1 : 0);
  const problemsLine = problemsWithin(storySentences(stories), problemsBudget);
  const used = problemsLine.length + afterLength;
  const todayLine = composeTodayLine(input.today, Math.max(0, PUSH_BODY_MAX - used - 1));
  return { title, body: sep([problemsLine, todayLine, ...after]) };
}

// --- The stored Briefing (S21, spec §7.1) ------------------------------------

function boundText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function boundBold(bold: StoredBold[], text: string): StoredBold[] {
  return bold.filter((r) => r.start >= 0 && r.end <= text.length && r.start < r.end).slice(0, BRIEFING_BOUNDS.bold);
}

export function buildBriefing(input: DigestInput): StoredBriefing {
  const stories = groupProblems(allProblems(input)).slice(0, BRIEFING_BOUNDS.stories);
  let unrecognised = 0;
  const stored = stories.map((story) => {
    const sentence = boundText(story.sentence.text, BRIEFING_BOUNDS.storySentence);
    return {
      sentence,
      bold: boundBold(story.sentence.bold, sentence),
      symptoms: story.symptoms.slice(0, BRIEFING_BOUNDS.symptoms).map((p) => {
        const e = explain(p);
        if (e.causeKey === "unrecognised") unrecognised++;
        const s = boundText(e.sentence.text, BRIEFING_BOUNDS.symptomSentence);
        const cause = boundText(e.cause.text, BRIEFING_BOUNDS.cause);
        return {
          key: p.key,
          sentence: s,
          bold: boundBold(e.sentence.bold, s),
          nextStep: boundText(e.nextStep, BRIEFING_BOUNDS.nextStep),
          causeKey: e.causeKey,
          cause,
          causeBold: boundBold(e.cause.bold, cause),
          raw: e.raw === null ? null : e.raw.slice(0, BRIEFING_BOUNDS.raw),
        };
      }),
    };
  });
  const freelance = freelanceLine(input);
  const off = offLine(input.offAgents);
  return {
    stories: stored,
    today: boundText(composeTodayLine(input.today), BRIEFING_BOUNDS.today),
    freelance: freelance === null ? null : boundText(freelance, BRIEFING_BOUNDS.freelance),
    off: off === null ? null : boundText(off, BRIEFING_BOUNDS.off),
    unrecognised,
  };
}

// --- The Today sentence (deck §10, re-voiced by S21) --------------------------

/**
 * What the Today sentence is built from. `calendarCause` says why `events` is
 * "unavailable" (S21: the cause card states it as a fact).
 */
export interface DigestTodayInput {
  events: Array<{ title: string; time: string | null }> | "unavailable" | "none-enabled";
  missedLayers: string[];
  calendarCause?: CalendarUnavailableCause;
  due: Array<{ title: string; dayLabel: string }> | "unavailable";
  overdue: Array<{ title: string; daysLate: number }>;
  dueTotal?: number;
  overdueTotal?: number;
}

/** Up to 3 names per part (deck §10). */
const TODAY_NAMES = 3;

/** Title caps tried, longest first, when over budget. A suffix is never cut. */
const TITLE_CAPS = [60, 40, 24, 12] as const;

function capTitle(title: string, cap: number): string {
  return title.length > cap ? `${title.slice(0, cap - 1).trimEnd()}…` : title;
}

/** `A, B and C` · `A, B, C and 2 more`. `total` is the store's count, never below names.length. */
function listPart(names: string[], total: number = names.length, limit: number = TODAY_NAMES): string {
  const shown = names.slice(0, limit);
  const rest = Math.max(total, names.length) - shown.length;
  if (rest > 0) return shown.length > 0 ? `${shown.join(", ")} and ${rest} more` : `${rest} more`;
  if (shown.length <= 1) return shown.join("");
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

function dueWhen(label: string): string {
  return label === "today" || label === "tomorrow" ? label : `on ${label}`;
}

/**
 * Pure. The Today sentence:
 *   Today you've got Math Methods at 09:00 and Meeting at 13:00. Coming up: Essay today. Running late: Invoice (3 days).
 *   Your calendar layers are all switched off. Nothing due.
 *   Nothing on today, and nothing due.        (both reads answered, both empty)
 *   ""                                         (a read failed and nothing else to say — its story says it)
 * Budget behaviour is unchanged from P10b: titles cut through TITLE_CAPS, then
 * names move into `and N more`; times, days and lateness are never cut.
 */
export function composeTodayLine(today: DigestTodayInput, budget: number = Infinity): string {
  const full = renderToday(today, Infinity, TODAY_NAMES);
  if (full.length <= budget) return full;
  let line = full;
  for (const cap of TITLE_CAPS) {
    line = renderToday(today, cap, TODAY_NAMES);
    if (line.length <= budget) return line;
  }
  const smallest = TITLE_CAPS[TITLE_CAPS.length - 1];
  for (let limit = TODAY_NAMES - 1; limit >= 0; limit--) {
    line = renderToday(today, smallest, limit);
    if (line.length <= budget) return line;
  }
  return line;
}

function renderToday(today: DigestTodayInput, cap: number, limit: number): string {
  const t = (title: string) => capTitle(title, cap);
  const parts: string[] = [];
  const calendarAnswered = today.events !== "unavailable";
  const todosAnswered = today.due !== "unavailable";

  if (today.events === "none-enabled") {
    parts.push("Your calendar layers are all switched off.");
  } else if (Array.isArray(today.events) && today.events.length > 0) {
    const names = today.events.map((e) => (e.time === null ? `${t(e.title)} (all day)` : `${t(e.title)} at ${e.time}`));
    parts.push(`Today you've got ${listPart(names, names.length, limit)}.`);
  }

  if (today.due !== "unavailable") {
    if (today.due.length > 0) {
      parts.push(`Coming up: ${listPart(today.due.map((d) => `${t(d.title)} ${dueWhen(d.dayLabel)}`), today.dueTotal, limit)}.`);
    }
    if (today.overdue.length > 0) {
      parts.push(
        `Running late: ${listPart(
          today.overdue.map((o) => `${t(o.title)} (${o.daysLate} ${o.daysLate === 1 ? "day" : "days"})`),
          today.overdueTotal,
          limit,
        )}.`,
      );
    }
  }

  const calendarEmpty = Array.isArray(today.events) && today.events.length === 0;
  const todosEmpty = todosAnswered && (today.due as unknown[]).length === 0 && today.overdue.length === 0;
  if (calendarAnswered && todosAnswered && todosEmpty) {
    if (calendarEmpty) return "Nothing on today, and nothing due.";
    if (today.events === "none-enabled") parts.push("Nothing due.");
  }
  return parts.join(" ");
}

/**
 * Pure. readCalendarWindow's answer for `today … today` as the sentence's
 * calendar half. Only events keyed to `today` count. A multi-day all-day
 * event is expanded by google.ts into one entry per day it covers (bd9459a),
 * so one that began earlier still has a `today` entry and is named; only a
 * TIMED event stays keyed to its start day, so a timed event that began
 * yesterday and runs into today is dropped — as the page drops it.
 *
 * A window that is `ok` but in which EVERY enabled layer failed (a token
 * failure of kind `http` is reported that way) is `"unavailable"`, not a
 * partial read: nothing arrived to be named.
 *
 * `window.failed` is calendarIds (google.ts). "Every enabled layer failed" is
 * decided by id against `layers`' enabled ids — never by name, since two
 * layers may share one — and the ids are joined to names only to fill
 * `missedLayers`, one name once. A failed id that joins to no enabled layer is
 * outside the window's contract and reads as `"unavailable"`: the push must
 * not call a morning clear over a read it cannot name.
 */
export function calendarForDigest(
  window: CalendarWindow,
  layers: readonly Layer[],
  today: DayKey,
  tz: string = APP_TZ
): Pick<DigestTodayInput, "events" | "missedLayers" | "calendarCause"> {
  if (!window.ok) {
    return window.reason === "none-enabled"
      ? { events: "none-enabled", missedLayers: [] }
      : { events: "unavailable", missedLayers: [], calendarCause: window.reason };
  }
  const failedIds = new Set(window.failed);
  const enabled = layers.filter((l) => l.enabled);
  const failedLayers = enabled.filter((l) => failedIds.has(l.calendarId));
  if (
    failedIds.size > 0 &&
    (failedLayers.length < failedIds.size || enabled.every((l) => failedIds.has(l.calendarId)))
  ) {
    return { events: "unavailable", missedLayers: [], calendarCause: "read-failed" };
  }
  const events = window.events
    .filter((e) => e.dayKey === today)
    .map((e) => ({
      title: e.title,
      time: e.allDay || e.startsAt === null ? null : clockHHMM(e.startsAt, tz),
    }));
  return { events, missedLayers: [...new Set(failedLayers.map((l) => l.name))] };
}

/** A to-do as the digest's read returns it; `dueOn` is the stored UTC-midnight day. */
export interface DigestTodoRow {
  title: string;
  dueOn: Date | null | undefined;
  createdAt: Date;
}

/**
 * Pure. Open to-dos as the sentence's `Due:` and `Overdue:` halves. Due is
 * today … today+3 inclusive (digestWindow's span), labelled `today` ·
 * `tomorrow` · `Fri`; overdue is anything before today, most overdue first,
 * labelled with whole days late. Undated rows and rows past the window are not
 * the digest's business and are dropped.
 *
 * `totals` is required: the rows are a bounded read, and only the store's own
 * counts (same filters) let `+N more` stay exact past the bound.
 */
export function todosForDigest(
  rows: readonly DigestTodoRow[],
  today: DayKey,
  totals: { due: number; overdue: number }
): {
  due: Array<{ title: string; dayLabel: string }>;
  overdue: Array<{ title: string; daysLate: number }>;
  dueTotal: number;
  overdueTotal: number;
} {
  const tomorrow = addDays(today, 1);
  const { toKey: lastDay } = digestWindow(today);
  const keyed = sortTodos(
    rows.flatMap((r) => {
      const dueOn = todoDueKey(r.dueOn);
      return dueOn === null ? [] : [{ title: r.title, dueOn, createdAt: r.createdAt }];
    })
  );

  const due: Array<{ title: string; dayLabel: string }> = [];
  const overdue: Array<{ title: string; daysLate: number }> = [];
  for (const row of keyed) {
    if (row.dueOn < today) {
      overdue.push({ title: row.title, daysLate: daysLate(row.dueOn, today) });
    } else if (row.dueOn <= lastDay) {
      const dayLabel =
        row.dueOn === today
          ? "today"
          : row.dueOn === tomorrow
            ? "tomorrow"
            : formatDay(row.dueOn).split(" ")[0];
      due.push({ title: row.title, dayLabel });
    }
  }
  return {
    due,
    overdue,
    dueTotal: Math.max(totals.due, due.length),
    overdueTotal: Math.max(totals.overdue, overdue.length),
  };
}
