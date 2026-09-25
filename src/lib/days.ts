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

/** The Date stored in Todo.dueOn: that calendar day at 00:00:00Z. */
export function dayStart(key: DayKey): Date {
  const m = KEY_SHAPE.exec(key);
  if (!m) throw new RangeError(`Not a day key: ${JSON.stringify(key)}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
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

export function todayKey(now: Date, tz: string = APP_TZ): DayKey {
  return dayKey(now, tz);
}
