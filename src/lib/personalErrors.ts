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

/**
 * deck §15 (R49): a to-do saved done, deleted or unpinned whose calendar
 * entry could not be removed. A claim about Google's state, not about the
 * press, so it takes the `--stale` dot under the head where it is said.
 * One spelling for every island that can say it (TodoRow, TodoForm).
 */
export const ENTRY_LEFT_SENTENCE = "Done, but the calendar entry couldn’t be removed. Remove it in Google Calendar.";

/**
 * deck §15: under the head of a tile too narrow for its form, where the
 * switched-off `+ Event` or `+ To-do` sits (R40). One spelling for both pills.
 */
export const TOO_NARROW_SENTENCE = "Too narrow for the form.";

/** A code that has a sentence in ERROR_SENTENCES. */
export type ErrorSentenceCode = keyof typeof ERROR_SENTENCES;
