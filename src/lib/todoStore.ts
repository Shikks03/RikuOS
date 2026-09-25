/**
 * todoStore.ts — the WRITE-THROUGH half of the to-do store: the four writes
 * the routes call, each a Mongo write and, when the to-do is on the calendar,
 * one Google write, in the order CLAUDE.md's asymmetric-failure rule demands.
 * The pure half (ordering, chips, the parsers) is todos.ts; see its header for
 * why the two are separate files.
 *
 * ORDER.
 *   Pin (switch on, at create or edit): Google FIRST, then a guarded local
 *     write `calendarEventId: {$exists: false}`. If that write throws or
 *     matches nothing, the entry just made is deleted again (compensation).
 *     If THAT delete fails, the result says an entry may be left on the
 *     calendar (`orphaned: true`) — deck §15's case, handed to Riku.
 *   Done / unpin / move / delete: the to-do's own change is written FIRST and
 *     stands on its own; the Google call follows; a Google failure is reported
 *     and — except for delete, whose record is gone — `calendarEventId` is
 *     KEPT, so the next attempt retries the same entry instead of losing it.
 *
 * THE ONE IN-FLIGHT STATE, AND WHY THE ID IS NOT CLEARED ON FAILURE. A to-do
 * that is done but still holds `calendarEventId` is one whose entry Google
 * would not remove; its Done row says `entry left on Google` until a retry (a
 * second tick — setTodoDone is idempotent and retries the removal) clears it.
 * A pinned to-do with `calendarBehind` set is one whose move or retitle was
 * saved and not confirmed by Google; its open row says `entry on the old day`,
 * and the next save retries the patch to the CURRENT title and day.
 * `calendarBehind` is sync state about the to-do's own write, never event
 * data: S19 lets a to-do remember only its entry's id (see models/Todo.ts). Nothing is silently `pending` and no job sweeps
 * anything: the stale state is on the row it belongs to (R86 §I item 4).
 * Clearing the id on a failed removal would erase exactly that surface, and
 * with it the only handle a retry has.
 *
 * CLASSIFYING A GOOGLE WRITE (lead ruling, 2026-09-26) — by whether the side
 * effect could have happened, never by guessing:
 *
 *   GoogleError kind           result      why
 *   not-configured             failed      decided before any HTTP
 *   expired                    failed      refused at the token or with a 401
 *   http, status 4xx           failed      Google refused the request
 *   timeout                    unknown     may have landed (token and API
 *                                          timeouts share the kind, so all are
 *                                          treated as the API's)
 *   http, status 5xx           unknown     Google may have acted and then erred
 *   http, no status            unknown     transport failure after sending
 *   gone (404/410), on delete  success     already absent (lead ruling 2)
 *   gone, on move              failed      entry absent: id cleared, off calendar
 *   gone, on insert            failed      the calendar itself is absent
 *   anything not a GoogleError unknown     cannot be placed, so never asserted
 *
 * `unknown` is the caller's `Couldn't tell if that saved.` and is never
 * retried automatically. An `unknown` INSERT on the pin path is not
 * compensated (there is no id to delete) and writes no `calendarEventId`.
 *
 * WHAT THROWS AND WHAT RETURNS. Google outcomes are RETURNED as a
 * discriminated CalendarOutcome — a catch cannot tell `failed` from `unknown`.
 * A Mongo error on the to-do's OWN write throws: nothing was saved, and the
 * route answers `Couldn't save.` / `Couldn't delete.`. A Mongo error on the
 * pin's guarded write is not thrown but returned as `failed`/`store`, after
 * compensation, because by then the to-do itself is saved and a throw would
 * make the route claim otherwise. (The plan said "throw the original error";
 * that is right for pinTodo alone and wrong once the pin rides on a create.)
 *
 * VALIDATION. The routes validate at their top with todos.ts's parsers; these
 * functions run the same parsers again and answer `invalid` without touching
 * the store, and a malformed id reads as `not-found` rather than a CastError.
 *
 * No alert is sent from here: these are user-initiated writes with a sentence
 * on screen, and a push in this path could let a notification failure corrupt
 * a to-do's state. Callers must have connectDB()'d.
 *
 * TESTS. todoStore.test.ts drives every path above against a stubbed Todo
 * model and a stubbed google.ts (the real GoogleError). The live observation
 * against Google is Riku's, in the verification block.
 */

import mongoose from "mongoose";
import Todo, { type TodoSection } from "@/models/Todo";
import { dayStart, type DayKey } from "@/lib/days";
import { deleteEvent, GoogleError, insertEvent, patchEvent } from "@/lib/google";
import { parseCreateTodo, parseUpdateTodo, todoDueKey, type TodoInputError } from "@/lib/todos";

/** Every pin goes to the main calendar in this version (deck §7). Stored anyway. */
export const PIN_CALENDAR_ID = "primary";

// --- Result types (Task 10 maps these to HTTP statuses) -----------------------

/** Why a calendar write definitely did not take. */
export type CalendarFailCause =
  | "not-configured" // GOOGLE_* unset
  | "expired" //        the Google sign-in no longer works
  | "refused" //        Google answered 4xx
  | "gone" //           the entry (move) or the calendar (pin) no longer exists
  | "changed" //        pin: the to-do changed or vanished while the entry was written
  | "store"; //         pin: the entry was written but the to-do could not record it

/**
 * The calendar leg of a write, beside the to-do's own (which succeeded if a
 * result is returned at all).
 *
 * `orphaned` — an entry may now be on Google that no record points at, so no
 * retry can reach it and Riku must remove it by hand: a pin whose compensation
 * failed or could not be confirmed, an unanswered pin insert, or a delete
 * whose entry removal did not take.
 */
export type CalendarOutcome =
  | { kind: "none" } //    no calendar work was asked for or needed
  | { kind: "ok" }
  | { kind: "failed"; cause: CalendarFailCause; orphaned: boolean }
  | { kind: "unknown"; orphaned: boolean };

export type CreateResult =
  | { kind: "invalid"; error: TodoInputError }
  | { kind: "created"; id: string; calendar: CalendarOutcome };

export type UpdateResult =
  | { kind: "invalid"; error: TodoInputError }
  | { kind: "not-found" }
  | { kind: "saved"; calendar: CalendarOutcome };

export type DoneResult =
  | { kind: "invalid"; error: "bad-done" }
  | { kind: "not-found" }
  /** `done` is the state now stored. An already-done tick is `saved`, not an error (§7.3). */
  | { kind: "saved"; done: boolean; calendar: CalendarOutcome };

export type DeleteResult =
  | { kind: "not-found" }
  | { kind: "deleted"; calendar: CalendarOutcome };

// --- Classification ----------------------------------------------------------

type Classified =
  | { kind: "failed"; cause: Exclude<CalendarFailCause, "changed" | "store"> }
  | { kind: "unknown" }
  | { kind: "gone" };

/** The docblock's table, in code. */
function classifyWrite(err: unknown): Classified {
  if (!(err instanceof GoogleError)) return { kind: "unknown" };
  switch (err.kind) {
    case "not-configured":
      return { kind: "failed", cause: "not-configured" };
    case "expired":
      return { kind: "failed", cause: "expired" };
    case "gone":
      return { kind: "gone" };
    case "timeout":
      return { kind: "unknown" };
    case "http":
      return err.status !== undefined && err.status >= 400 && err.status < 500
        ? { kind: "failed", cause: "refused" }
        : { kind: "unknown" };
  }
}

/** A non-gone classification as an outcome. */
function outcomeOf(c: Exclude<Classified, { kind: "gone" }>, orphaned: boolean): CalendarOutcome {
  return c.kind === "failed" ? { kind: "failed", cause: c.cause, orphaned } : { kind: "unknown", orphaned };
}

// --- The stored record, as these functions read it ---------------------------

interface TodoRecord {
  _id: unknown;
  title: string;
  section: TodoSection;
  dueOn?: Date;
  done: boolean;
  calendarId?: string;
  calendarEventId?: string;
  calendarBehind?: boolean; // absent reads as false
}

/** Forgets the entry; the sync flag goes with it. */
const UNPIN = { $unset: { calendarEventId: 1, calendarId: 1 }, $set: { calendarBehind: false } } as const;

// --- The three calendar legs -------------------------------------------------

/**
 * Google first, then the guarded claim, with a compensating delete. Only an
 * open to-do still due on `due` and not already pinned can take the id — a
 * double tap's second insert is compensated, not recorded twice.
 */
async function pinLeg(id: string, title: string, due: DayKey): Promise<CalendarOutcome> {
  let entryId: string;
  try {
    entryId = (await insertEvent(PIN_CALENDAR_ID, { title, allDay: true, dayKey: due })).id;
  } catch (err) {
    const c = classifyWrite(err);
    if (c.kind === "gone") return { kind: "failed", cause: "gone", orphaned: false };
    // An unanswered insert may have landed with an id nobody holds: orphaned,
    // not compensated, no calendarEventId written.
    return outcomeOf(c, c.kind === "unknown");
  }

  const dueDate = dayStart(due);
  let cause: "changed" | "store" = "changed";
  try {
    const claimed = await Todo.findOneAndUpdate(
      { _id: id, done: false, dueOn: dueDate, calendarEventId: { $exists: false } },
      { $set: { calendarEventId: entryId, calendarId: PIN_CALENDAR_ID, calendarBehind: false } },
      { new: true, runValidators: true },
    ).lean<TodoRecord>();
    if (claimed) return { kind: "ok" };
  } catch {
    cause = "store";
  }

  // Compensation: the entry exists and nothing records it.
  try {
    await deleteEvent(PIN_CALENDAR_ID, entryId);
    return { kind: "failed", cause, orphaned: false };
  } catch (err) {
    return { kind: "failed", cause, orphaned: classifyWrite(err).kind !== "gone" };
  }
}

/**
 * Removes a pinned entry, then forgets it — guarded on the SAME id, so a pin
 * made meanwhile is never unset. On failure the id stays for the retry.
 * `gone` is success: the entry is already absent (lead ruling 2).
 */
async function unpinLeg(id: string, calendarId: string, eventId: string): Promise<CalendarOutcome> {
  try {
    await deleteEvent(calendarId, eventId);
  } catch (err) {
    const c = classifyWrite(err);
    if (c.kind !== "gone") return outcomeOf(c, false);
  }
  await Todo.updateOne({ _id: id, calendarEventId: eventId }, UNPIN);
  return { kind: "ok" };
}

/**
 * Moves (and retitles) a pinned entry to the to-do's current day and title.
 * The patch is whole, so a retry after any earlier failure converges.
 * `calendarBehind` was set true by the local write (or an earlier one) and is
 * cleared only here, only on a confirmed patch, and only while the record
 * still holds the title and day that were patched — a save that landed in
 * between keeps its own `true`. Until then the row reads `entry on the old day`.
 */
async function moveLeg(
  id: string,
  calendarId: string,
  eventId: string,
  title: string,
  due: DayKey,
): Promise<CalendarOutcome> {
  try {
    await patchEvent(calendarId, eventId, { title, dayKey: due });
  } catch (err) {
    const c = classifyWrite(err);
    if (c.kind === "gone") {
      // Removed on Google's side. Keeping the id would make every retry fail
      // forever; the to-do is simply no longer on the calendar.
      await Todo.updateOne({ _id: id, calendarEventId: eventId }, UNPIN);
      return { kind: "failed", cause: "gone", orphaned: false };
    }
    return outcomeOf(c, false);
  }
  await Todo.updateOne(
    { _id: id, calendarEventId: eventId, title, dueOn: dayStart(due) },
    { $set: { calendarBehind: false } },
  );
  return { kind: "ok" };
}

// --- The four writes ---------------------------------------------------------

const NONE: CalendarOutcome = { kind: "none" };

export async function createTodo(input: unknown): Promise<CreateResult> {
  const parsed = parseCreateTodo(input);
  if (!parsed.ok) return { kind: "invalid", error: parsed.error };
  const { title, section, dueOn, onCalendar } = parsed.value;

  const doc = await Todo.create({ title, section, ...(dueOn !== null ? { dueOn: dayStart(dueOn) } : {}) });
  const id = String(doc._id);
  const calendar = onCalendar && dueOn !== null ? await pinLeg(id, title, dueOn) : NONE;
  return { kind: "created", id, calendar };
}

/**
 * Title, section, due day and the calendar switch, in one PATCH. The to-do's
 * own fields are written first, atomically, returning the record as it WAS;
 * the calendar leg is then decided from before and after:
 *
 *   pinned, switch off or due day cleared   unpin
 *   not pinned, switch on (and dated)       pin
 *   pinned, staying pinned, and behind      move (also the retry of a failed one);
 *   (this save sent a title or day, or an   "behind" is calendarBehind, never a
 *   earlier move is unconfirmed)            stored copy of the entry (S19)
 */
export async function updateTodo(id: string, input: unknown): Promise<UpdateResult> {
  const parsed = parseUpdateTodo(input);
  if (!parsed.ok) return { kind: "invalid", error: parsed.error };
  if (!mongoose.isValidObjectId(id)) return { kind: "not-found" };
  const v = parsed.value;

  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};
  if (v.title !== undefined) $set.title = v.title;
  // Sync state, set in the SAME atomic write as the change it describes, so no
  // crash or failure between here and Google can leave a move unrecorded.
  // Harmless on an unpinned to-do (read only beside calendarEventId; a pin
  // resets it).
  if (v.title !== undefined || v.dueOn !== undefined) $set.calendarBehind = true;
  if (v.section !== undefined) $set.section = v.section;
  if (v.dueOn !== undefined) {
    if (v.dueOn === null) $unset.dueOn = 1;
    else $set.dueOn = dayStart(v.dueOn);
  }

  // Switching on with no due day in this patch needs one already stored; the
  // filter makes that part of the same atomic write.
  const filter: Record<string, unknown> = { _id: id };
  if (v.onCalendar === true && v.dueOn === undefined) filter.dueOn = { $exists: true };

  const update: Record<string, unknown> = {};
  if (Object.keys($set).length > 0) update.$set = $set;
  if (Object.keys($unset).length > 0) update.$unset = $unset;

  const before =
    Object.keys(update).length > 0
      ? await Todo.findOneAndUpdate(filter, update, { new: false, runValidators: true }).lean<TodoRecord>()
      : await Todo.findOne(filter).lean<TodoRecord>();
  if (!before) {
    if (filter.dueOn === undefined) return { kind: "not-found" };
    const exists = await Todo.findOne({ _id: id }).lean<TodoRecord>();
    return exists ? { kind: "invalid", error: "needs-due" } : { kind: "not-found" };
  }

  const title = v.title ?? before.title;
  const due = v.dueOn !== undefined ? v.dueOn : todoDueKey(before.dueOn);
  const eventId = before.calendarEventId;
  const calendarId = before.calendarId ?? PIN_CALENDAR_ID;
  const wantPinned = due !== null && (v.onCalendar ?? eventId !== undefined);

  let calendar: CalendarOutcome = NONE;
  if (eventId !== undefined && !wantPinned) {
    calendar = await unpinLeg(id, calendarId, eventId);
  } else if (eventId === undefined && wantPinned && due !== null) {
    calendar = await pinLeg(id, title, due);
  } else if (eventId !== undefined && due !== null) {
    // Behind if an earlier move is unconfirmed, or this write touched the title
    // or day. A re-save that sends the same title and day still patches once:
    // the flag was set blind in the atomic write, and a confirmed patch is the
    // only thing that may clear it.
    const behind = before.calendarBehind === true || v.title !== undefined || v.dueOn !== undefined;
    if (behind) calendar = await moveLeg(id, calendarId, eventId, title, due);
  }
  return { kind: "saved", calendar };
}

/**
 * The tick. Guarded on the opposite state, so it is atomic, and idempotent:
 * a second tap finds nothing to flip, reads the record, and answers `saved`
 * for the state that is already correct (§7.3). Ticking done removes a pinned
 * entry — and re-ticking a done to-do whose removal failed is the retry.
 * Unticking never re-pins.
 */
export async function setTodoDone(id: string, done: unknown): Promise<DoneResult> {
  if (typeof done !== "boolean") return { kind: "invalid", error: "bad-done" };
  if (!mongoose.isValidObjectId(id)) return { kind: "not-found" };

  const update = done ? { $set: { done: true, doneAt: new Date() } } : { $set: { done: false }, $unset: { doneAt: 1 } };
  const doc =
    (await Todo.findOneAndUpdate({ _id: id, done: !done }, update, { new: true, runValidators: true }).lean<TodoRecord>()) ??
    (await Todo.findOne({ _id: id }).lean<TodoRecord>());
  if (!doc) return { kind: "not-found" };

  const calendar =
    doc.done && doc.calendarEventId !== undefined
      ? await unpinLeg(id, doc.calendarId ?? PIN_CALENDAR_ID, doc.calendarEventId)
      : NONE;
  return { kind: "saved", done: doc.done, calendar };
}

/**
 * Local first: the record is deleted, then its entry. The one path where a
 * failed removal cannot keep the id — the record holding it is gone — so any
 * outcome short of removal is `orphaned` and the caller hands it to Riku:
 * `Remove it in Google Calendar.`
 */
export async function deleteTodo(id: string): Promise<DeleteResult> {
  if (!mongoose.isValidObjectId(id)) return { kind: "not-found" };
  const doc = await Todo.findOneAndDelete({ _id: id }).lean<TodoRecord>();
  if (!doc) return { kind: "not-found" };
  if (doc.calendarEventId === undefined) return { kind: "deleted", calendar: NONE };

  try {
    await deleteEvent(doc.calendarId ?? PIN_CALENDAR_ID, doc.calendarEventId);
  } catch (err) {
    const c = classifyWrite(err);
    if (c.kind !== "gone") return { kind: "deleted", calendar: outcomeOf(c, true) };
  }
  return { kind: "deleted", calendar: { kind: "ok" } };
}
