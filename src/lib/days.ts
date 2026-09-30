/**
 * days.ts — day keys, the only currency the Personal page and the morning push
 * compare dates in.
 *
 * A DayKey is "YYYY-MM-DD" naming a calendar day in some zone — APP_TZ unless a
 * caller says otherwise. Every "due today / overdue / within 3 days" question
 * is asked of two keys, never of raw Date arithmetic: Vercel runs in UTC and
 * the morning cron fires at 23:00 UTC, which is already tomorrow in Manila.
 *
 * `Todo.dueOn` is a DAY, not an instant. It is stored as that calendar day at
 * 00:00:00Z (dayStart), so daysBetween is exact integer arithmetic on two UTC
 * midnights and carries no DST term by construction.
 *
 * Pure: no model, no network, no framework, no environment. No date library —
 * Intl does the one zone conversion there is, and no offset is hard-coded,
 * because Manila being +08:00 today is a policy, not a law.
 */

import { APP_TZ } from "@/lib/constants";

export type DayKey = string; // "YYYY-MM-DD"

const MS_PER_DAY = 86_400_000;
const KEY_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The calendar day `date` falls on in `tz`, as a key. */
export function dayKey(date: Date, tz: string): DayKey {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * The Date stored in Todo.dueOn: that calendar day at 00:00:00Z.
 *
 * Throws a RangeError for anything that is not a real day. The shape check
 * alone is not enough: Date.UTC rolls "2026-02-31" silently to 3 March, so
 * the built date must read back as the same key or it was never a day.
 */
export function dayStart(key: DayKey): Date {
  const m = KEY_SHAPE.exec(key);
  if (!m) throw new RangeError(`Not a day key: ${JSON.stringify(key)}`);
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (dayKey(date, "UTC") !== key) throw new RangeError(`Not a real day: ${JSON.stringify(key)}`);
  return date;
}

/**
 * The non-throwing check a route validates a posted due date with: true only
 * for a well-formed "YYYY-MM-DD" that names a real calendar day.
 */
export function isDayKey(s: unknown): s is DayKey {
  if (typeof s !== "string" || !KEY_SHAPE.test(s)) return false;
  try {
    dayStart(s);
    return true;
  } catch {
    return false;
  }
}

export function addDays(key: DayKey, n: number): DayKey {
  return dayKey(new Date(dayStart(key).getTime() + n * MS_PER_DAY), "UTC");
}

/** b − a, in whole days. Negative when b is before a. */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((dayStart(b).getTime() - dayStart(a).getTime()) / MS_PER_DAY);
}

/**
 * "Thu 10 Sep" — the deck's spelling, exactly. Formatted in UTC because the
 * key already IS the day and dayStart is its UTC midnight; any other zone
 * would move the label. The parts are reassembled rather than trusting the
 * locale's own order and punctuation, which is how `Thu, Sep 10` ships.
 * en-US supplies the parts because en-GB's current ICU data abbreviates
 * September as `Sept` — measured, and the reason the test pins the string.
 */
export function formatDay(key: DayKey): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(dayStart(key));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")}`;
}

/**
 * "07:00" — `at`'s wall clock in `tz`, 24-hour, zero-padded. The one HH:MM in
 * the app: the page's event times and push stamps and the push's Today
 * sentence all read it. `at` is a parameter; nothing here reads the clock.
 */
export function clockHHMM(at: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("hour")}:${part("minute")}`;
}

export function todayKey(now: Date, tz: string = APP_TZ): DayKey {
  return dayKey(now, tz);
}

// --- The event form's time defaults (deck §7) ---------------------------------

const CLOCK_SHAPE = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** The last minute of a day: an End never crosses midnight (the event door compares HH:MM as strings). */
const DAY_LAST = "23:59";

/**
 * "HH:MM" one hour after `start`, CAPPED at 23:59 — deck §7's "End: one hour
 * after start", within the one day the form writes to. `23:30` → `23:59`,
 * never `00:30`: the door (personalWrites.parseEventInput) compares start and
 * end as strings on one dayKey, so a wrapped End would read as before Start.
 * At `23:59` the cap equals the start, and the door says `End must be after
 * start.` — the one input this cannot help. null for anything not "HH:MM".
 *
 * ONE rule for both callers (lead ruling S2): the page's server default and
 * EventForm's "End tracks Start + 1h until edited". Recorded deviation from
 * deck §7's plain "+1h", accepted by the lead.
 */
export function oneHourAfter(start: string): string | null {
  const m = CLOCK_SHAPE.exec(start);
  if (!m) return null;
  const h = Number(m[1]) + 1;
  return h >= 24 ? DAY_LAST : `${String(h).padStart(2, "0")}:${m[2]}`;
}

/**
 * The event form's defaults (deck §7), in `tz`: today, the next full hour,
 * and oneHourAfter it. From 23:00 the next full hour is tomorrow's 00:00, so
 * the default Date is tomorrow (00:00–01:00); at 22:xx it is 23:00–23:59.
 * `now` is a parameter; nothing here reads the clock.
 */
export function eventTimeDefaults(now: Date, tz: string = APP_TZ): { dayKey: DayKey; start: string; end: string } {
  const today = dayKey(now, tz);
  const next = Number(clockHHMM(now, tz).slice(0, 2)) + 1;
  if (next >= 24) return { dayKey: addDays(today, 1), start: "00:00", end: "01:00" };
  const start = `${String(next).padStart(2, "0")}:00`;
  return { dayKey: today, start, end: oneHourAfter(start) ?? DAY_LAST };
}
