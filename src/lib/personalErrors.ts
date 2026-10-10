/**
 * personalErrors.ts — the Personal page's error sentences, where a client
 * component can import them.
 *
 * NO RUNTIME IMPORTS, and that is the file's whole reason to exist. The table
 * used to live in personalWrites.ts, which imports google.ts at runtime (for
 * classifyWrite) — and google.ts reads the environment and fetches. A client
 * component importing the table from there would drag that module into the
 * browser bundle. Everything below is a literal; the only imports are
 * `export type`, erased at build. viewModelPurity.test.ts loads this file and
 * checks its source for a runtime import.
 *
 * personalWrites.ts re-exports ERROR_SENTENCES, so the server side keeps one
 * name for it.
 */

import type { CalendarFailCause, CalendarOutcome } from "@/lib/todoStore";
import type { SayLine } from "@/lib/personalView";

export type { CalendarOutcome } from "@/lib/todoStore";

/**
 * The error codes the Personal page's three mutation doors answer that have a
 * sentence of their own, verbatim, so Plan C's client maps rather than
 * re-types them. Sources:
 *   save-failed, delete-failed, calendar-unknown — visual design §4.9 (R21's
 *     press outcomes; deck §15 for `Couldn't tell if that saved.`, a Google
 *     write that may have landed);
 *   no-title, end-before-start — content doc §7 (deck §7), both forms'
 *     validation lines;
 *   needs-due — content doc §7, the note under `Put on calendar`.
 * Every other code is one the forms cannot produce and reads as a plain
 * failure. Frozen: a shared table must not become one caller's scratch.
 */
export const ERROR_SENTENCES = Object.freeze({
  "save-failed": "Couldn’t save.",
  "delete-failed": "Couldn’t delete.",
  "calendar-unknown": "Couldn’t tell if that saved.",
  "no-title": "Give it a title.",
  "end-before-start": "End must be after start.",
  "needs-due": "Needs a due date.",
} as const);

/** Every cause the doors can answer — the client checks a cause against this before trusting it. */
export const CALENDAR_FAIL_CAUSES = ["not-configured", "expired", "refused", "gone", "changed", "store"] as const satisfies readonly CalendarFailCause[];

// S1 (2026-10-10 review): a compile-time proof that CALENDAR_FAIL_CAUSES
// lists every member of CalendarFailCause. If todoStore.ts ever adds a
// cause this list doesn't, the `extends never` check below turns false and
// `true` no longer type-checks against it — a build failure, not a silent gap.
type CalendarFailCausesComplete = Exclude<CalendarFailCause, (typeof CALENDAR_FAIL_CAUSES)[number]> extends never ? true : false;
export const CALENDAR_FAIL_CAUSES_COMPLETE: CalendarFailCausesComplete = true;

/**
 * Whether a string a door sent back is one of the causes above — checked
 * before it is trusted. Array membership, not a property lookup, so
 * `"__proto__"` and `"toString"` are ordinary (false) answers, never special
 * cases. Moved out of TodoForm.tsx (2026-10-10 review) so it is testable
 * beside the table it guards.
 */
export function isCalendarFailCause(cause: string): cause is CalendarFailCause {
  return (CALENDAR_FAIL_CAUSES as readonly string[]).includes(cause);
}

/**
 * S21 (spec §7.4): the calendar messages as whole sentences per action and
 * cause, approved by Riku 2026-10-09. Replaces deck §7's frame-plus-reason
 * shape and the nine reasons P10c had marked provisional. Every pair is
 * filled, the ones the server can't produce today with honest generic
 * sentences (plan B deviation 5), so the client never meets a gap.
 *
 * `update` added 2026-10-10 by Riku's ruling: todoStore.ts's `behind` check
 * (title OR due day changed) runs the same server-side leg for a rename as
 * for a date move, so an edit save that didn't touch the due day must not
 * claim "Saved the new date" when that leg fails. See spec §7.4's amendment.
 */
export const CALENDAR_FAIL: Readonly<Record<"event" | "pin" | "move" | "update", Readonly<Record<CalendarFailCause, string>>>> = Object.freeze({
  event: Object.freeze({
    "not-configured": "I couldn’t add that. Google isn’t connected yet. You can set it up in Settings.",
    expired: "I couldn’t add that. My access to Google has expired. You can renew it in Settings.",
    refused: "Google turned that one down, so it’s not on your calendar.",
    gone: "I couldn’t add that. That calendar isn’t on your Google account anymore.",
    changed: "I couldn’t add that, and I’m not sure why. Have a look in Google Calendar.",
    store: "I couldn’t add that, and I’m not sure why. Have a look in Google Calendar.",
  }),
  pin: Object.freeze({
    "not-configured": "Saved, but I couldn’t put it on your calendar. Google isn’t connected yet.",
    expired: "Saved, but I couldn’t put it on your calendar. My Google access has expired.",
    refused: "Saved, but Google wouldn’t take the calendar entry.",
    gone: "Saved, but I couldn’t find your main calendar on Google, so it’s not on there.",
    changed: "Saved, but the to-do changed somewhere else while I was adding it, so I left it off the calendar.",
    store: "Saved, but I couldn’t keep track of the calendar entry, so I took it back off.",
  }),
  move: Object.freeze({
    "not-configured": "Saved the new date, but I couldn’t move the calendar entry. Google isn’t connected yet.",
    expired: "Saved the new date, but I couldn’t move the calendar entry. My Google access has expired.",
    refused: "Saved the new date, but Google wouldn’t move the calendar entry.",
    gone: "Saved the new date. Its calendar entry had already been deleted in Google, so I’ve unlinked it.",
    changed: "Saved the new date, but I couldn’t move the calendar entry.",
    store: "Saved the new date, but I couldn’t move the calendar entry.",
  }),
  update: Object.freeze({
    "not-configured": "Saved, but I couldn’t update the calendar entry. Google isn’t connected yet.",
    expired: "Saved, but I couldn’t update the calendar entry. My Google access has expired.",
    refused: "Saved, but Google wouldn’t update the calendar entry.",
    gone: "Saved. Its calendar entry had already been deleted in Google, so I’ve unlinked it.",
    changed: "Saved, but I couldn’t update the calendar entry.",
    store: "Saved, but I couldn’t update the calendar entry.",
  }),
});

/** A pin that may have left an entry on Google that nothing points at. */
export const PIN_UNSURE =
  "Saved. I’m not sure whether the calendar entry went through, so have a look in Google Calendar before switching it on again.";

/**
 * An entry that couldn't be removed after the to-do's OWN state already
 * moved on (ticked done, or deleted outright) — worded for what Riku did
 * (R49's dot: --stale).
 */
export const ENTRY_LEFT = Object.freeze({
  done: "Done. I couldn’t remove its calendar entry, though, so you’ll want to delete it in Google Calendar.",
  delete: "Deleted. I couldn’t remove its calendar entry, though, so you’ll want to delete it in Google Calendar.",
} as const);

/**
 * A switch-off whose Google removal definitely failed: unlike ENTRY_LEFT's
 * cases, the to-do's own state did NOT move on — todoStore.ts's unpinLeg
 * keeps calendarEventId for the retry on failure, so the to-do stays pinned
 * (2026-10-10 review, W2). An unknown outcome on this leg is not this
 * sentence: see calendarLine.
 */
export const UNPIN_FAILED = "I couldn’t take it off your Google calendar, so it’s still pinned. Switch it off again to retry.";

export type CalendarLeg = "pin" | "move" | "unpin" | "delete" | "update";

/**
 * What a calendar leg that didn't finish says under the tile's head (moved
 * here from TodoForm so it is testable; same rules as before). The to-do's own
 * write landed, so nothing here says the save failed. An outcome the door
 * didn't spell out (null) is treated as unknown.
 */
export function calendarLine(leg: CalendarLeg, outcome: CalendarOutcome | null): SayLine | null {
  if (outcome !== null && (outcome.kind === "none" || outcome.kind === "ok")) return null;
  const c: CalendarOutcome = outcome ?? { kind: "unknown", orphaned: false };
  switch (leg) {
    case "delete":
      return { text: ENTRY_LEFT.delete, dot: "stale" };
    case "unpin":
      // A definite failure leaves the to-do pinned (W2); an unknown result
      // might have landed either way, so it may NOT claim "still pinned".
      return c.kind === "failed"
        ? { text: UNPIN_FAILED, dot: "stale" }
        : { text: ERROR_SENTENCES["calendar-unknown"], dot: null };
    case "pin":
      return c.kind === "failed" && !c.orphaned ? { text: CALENDAR_FAIL.pin[c.cause], dot: "stale" } : { text: PIN_UNSURE, dot: "stale" };
    case "move":
    case "update":
      return c.kind === "failed"
        ? { text: CALENDAR_FAIL[leg][c.cause], dot: "stale" }
        : { text: ERROR_SENTENCES["calendar-unknown"], dot: null };
  }
}

export function eventFailSentence(cause: CalendarFailCause): string {
  return CALENDAR_FAIL.event[cause];
}

/**
 * deck §15: under the head of a tile too narrow for its form, where the
 * switched-off `+ Event` or `+ To-do` sits (R40). One spelling for both pills.
 */
export const TOO_NARROW_SENTENCE = "Too narrow for the form.";

/** A code that has a sentence in ERROR_SENTENCES. */
export type ErrorSentenceCode = keyof typeof ERROR_SENTENCES;
