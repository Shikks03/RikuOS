/**
 * sinceThen.ts — the Briefing's live "since then" (S21, spec §6). Pure.
 *
 * Built only from fast, cheap reads: to-dos, today's calendar, the queue.
 * Sites, agents and ShikksTracker are deliberately NOT re-checked, so the
 * Briefing never says a problem is fixed without checking it again.
 *
 * Each part fails on its own, with its own honest line; one failed read never
 * hides the others. Page text: curly apostrophes.
 */

import { APP_TZ } from "@/lib/constants";
import { clockHHMM } from "@/lib/days";
import { capWord, numberWord } from "@/lib/voice";

export interface SinceEvent {
  title: string;
  allDay: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

export interface SinceThenInput {
  /** Done since sentAt: the newest few titles and the store's count. */
  ticked: { titles: string[]; total: number } | "unavailable";
  /** Open, due today, created since sentAt. */
  newDue: { titles: string[]; total: number } | "unavailable";
  /** Today's events on the switched-on layers. */
  events: SinceEvent[] | "unavailable" | "none-enabled";
  /** Pending drafts created since sentAt. */
  newDrafts: number | "unavailable";
}

/** The most lines the section shows; the door bounds its response with it. */
export const SINCE_THEN_MAX_LINES = 6;

export function sinceThenLines(input: SinceThenInput, sentAt: Date, now: Date, tz: string = APP_TZ): string[] {
  const lines: string[] = [];

  if (input.ticked === "unavailable" || input.newDue === "unavailable") {
    lines.push("I couldn’t check your to-dos just now.");
  }
  if (input.ticked !== "unavailable" && input.ticked.total > 0) {
    lines.push(
      input.ticked.total === 1 && input.ticked.titles.length === 1
        ? `You’ve ticked off ${input.ticked.titles[0]}.`
        : `You’ve ticked off ${numberWord(input.ticked.total)} to-dos.`,
    );
  }
  if (input.newDue !== "unavailable" && input.newDue.total > 0) {
    lines.push(
      input.newDue.total === 1 && input.newDue.titles.length === 1
        ? `One new to-do is due today: ${input.newDue.titles[0]}.`
        : `${capWord(numberWord(input.newDue.total))} new to-dos are due today.`,
    );
  }

  if (input.events === "unavailable") {
    lines.push("I couldn’t check your calendar just now.");
  } else if (input.events !== "none-enabled") {
    const timed = input.events
      .filter((e) => !e.allDay && e.startsAt !== null && e.endsAt !== null)
      .sort((a, z) => a.startsAt!.getTime() - z.startsAt!.getTime());
    const done = timed.filter((e) => e.endsAt!.getTime() <= now.getTime() && e.endsAt!.getTime() > sentAt.getTime());
    const next = timed.find((e) => e.startsAt!.getTime() > now.getTime());
    if (done.length === 1) lines.push(`${done[0].title} is done.`);
    if (done.length > 1) lines.push(`${capWord(numberWord(done.length))} things on your calendar are done.`);
    if (next) lines.push(`Next up: ${next.title} at ${clockHHMM(next.startsAt!, tz)}.`);
    else if (done.length > 0) lines.push("Nothing else on today.");
  }

  if (input.newDrafts === "unavailable") {
    lines.push("I couldn’t check the queue just now.");
  } else if (input.newDrafts > 0) {
    lines.push(
      input.newDrafts === 1
        ? "One new draft is waiting for your review."
        : `${capWord(numberWord(input.newDrafts))} new drafts are waiting for your review.`,
    );
  }

  if (lines.length === 0) return [`Nothing new since ${clockHHMM(sentAt, tz)}.`];
  return lines.map((l) => l.replace(/'/g, "’")).slice(0, SINCE_THEN_MAX_LINES);
}
