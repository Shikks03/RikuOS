/**
 * personalWrites.ts — what the Personal page's three mutation doors answer.
 *
 * The routes (`/api/todos`, `/api/todos/[id]`, `/api/calendar/events`) stay
 * thin: session, parse, one call, and one of these functions turning the
 * result into a status and a JSON body. Everything that decides a status lives
 * here, where it is tested without a server (there are no route-handler tests
 * in this repo; the pure layer holds the behaviour — CLAUDE.md).
 *
 * THE CONTRACT PLAN C'S CLIENT READS.
 *   - A refused input is 400 `{ error: <code> }` — a CODE, never a sentence,
 *     the todos.ts convention: the client picks the deck's sentence (`Give it
 *     a title.`, `Needs a due date.`) and answers every other code as a plain
 *     failure, because the form cannot produce it.
 *   - No such to-do is 404 `{ error: "not-found" }`.
 *   - A to-do write that happened is 2xx EVEN WHEN ITS CALENDAR LEG DID NOT:
 *     the to-do saved, and a 5xx would tell the client the opposite. The body
 *     carries `calendar: CalendarOutcome`, from which the client picks
 *     `Saved, but the calendar entry failed…` / `Couldn't tell if that saved.`.
 *   - A to-do write that threw (Mongo, on the to-do's own write) is 500
 *     `save-failed` / `delete-failed` — nothing was written. Codes too (lead
 *     ruling, 2026-09-26): EVERY error body on these doors is a code, and the
 *     two that have a deck sentence map through ERROR_SENTENCES below.
 *   - The event door has no local write, so its Google failure IS the
 *     request's failure: 503 when Google is not connected or its access has
 *     expired (the app's own configuration), 502 when Google refused, and 504
 *     when it cannot be told whether the event was made — `unknown`, never
 *     `failed`: a timed-out insert may have landed (CLAUDE.md's asymmetric
 *     rule), and the client must say `Couldn't tell if that saved.`, not
 *     invite a second, duplicating, press.
 *
 * Imports from todoStore.ts are type-only, so this file registers no Mongoose
 * model and needs no database to test.
 */

import { isDayKey, type DayKey } from "@/lib/days";
import { classifyWrite, type EventInput } from "@/lib/google";
import type { Layer } from "@/lib/osSettings";
import { parseUpdateTodo, type TodoInputError, type UpdateTodoInput } from "@/lib/todos";
import type { CalendarOutcome, CreateResult, DeleteResult, DoneResult, UpdateResult } from "@/lib/todoStore";

/** A status and a JSON body; the route wraps it in NextResponse.json. */
export interface Reply {
  status: number;
  body: Record<string, unknown>;
}

const reply = (status: number, body: Record<string, unknown>): Reply => ({ status, body });

/** The request body was not JSON at all. */
export const BAD_JSON: Reply = reply(400, { error: "bad-json" });
/** The to-do's own write (or the layers read before an event) threw: nothing was saved. */
export const SAVE_FAILED: Reply = reply(500, { error: "save-failed" });
/** The to-do's own delete threw: nothing was deleted. */
export const DELETE_FAILED: Reply = reply(500, { error: "delete-failed" });

/**
 * The error codes these doors answer that have a sentence of their own,
 * verbatim, so Plan C's client maps rather than re-types them. Sources:
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
  "save-failed": "Couldn't save.",
  "delete-failed": "Couldn't delete.",
  "calendar-unknown": "Couldn't tell if that saved.",
  "no-title": "Give it a title.",
  "end-before-start": "End must be after start.",
  "needs-due": "Needs a due date.",
} as const);

const NOT_FOUND: Reply = reply(404, { error: "not-found" });

// --- To-dos --------------------------------------------------------------------

export function createReply(r: CreateResult): Reply {
  if (r.kind === "invalid") return reply(400, { error: r.error });
  return reply(201, { id: r.id, calendar: r.calendar });
}

export function updateReply(r: UpdateResult): Reply {
  if (r.kind === "invalid") return reply(400, { error: r.error });
  if (r.kind === "not-found") return NOT_FOUND;
  return reply(200, { calendar: r.calendar });
}

export function doneReply(r: DoneResult): Reply {
  if (r.kind === "invalid") return reply(400, { error: r.error });
  if (r.kind === "not-found") return NOT_FOUND;
  return reply(200, { done: r.done, calendar: r.calendar });
}

export function deleteReply(r: DeleteResult): Reply {
  if (r.kind === "not-found") return NOT_FOUND;
  return reply(200, { calendar: r.calendar });
}

/**
 * One PATCH door, two writes. A body that is exactly `{ done }` is the tick
 * (setTodoDone); any other body is an edit (updateTodo, validated here with
 * todos.ts's parser). `done` beside any other key is refused as `mixed-patch`
 * rather than applied in some order: the tick and the edit are separate atomic
 * writes with separate calendar legs, and one request must not half-apply.
 */
export type TodoPatch = { kind: "done"; done: boolean } | { kind: "edit"; input: UpdateTodoInput };

export type TodoPatchError = TodoInputError | "mixed-patch" | "bad-done";

export function parseTodoPatch(body: unknown): { ok: true; value: TodoPatch } | { ok: false; error: TodoPatchError } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "not-object" };
  if (Object.hasOwn(body, "done")) {
    if (Object.keys(body).length !== 1) return { ok: false, error: "mixed-patch" };
    const done = (body as { done: unknown }).done;
    return typeof done === "boolean" ? { ok: true, value: { kind: "done", done } } : { ok: false, error: "bad-done" };
  }
  const parsed = parseUpdateTodo(body);
  return parsed.ok ? { ok: true, value: { kind: "edit", input: parsed.value } } : parsed;
}

// --- One event -------------------------------------------------------------------

export const EVENT_TITLE_MAX = 200;

export type EventInputError =
  | "not-object"
  | "no-title"
  | "title-too-long"
  | "bad-calendar" //   not one of the stored layers — THE security boundary
  | "layer-off" //      a stored layer, switched off
  | "bad-day"
  | "bad-all-day"
  | "bad-time"
  | "end-before-start";

/**
 * The cheap check the event route runs BEFORE reading the layers, so a
 * garbage body is a 400 without a Mongo read. It answers ONLY what
 * parseEventInput would answer before its layer lookup — `not-object`, the
 * title's two codes, and `bad-calendar` for a calendarId that is not even a
 * string — and otherwise returns null and lets the full parse (after the
 * layers read) decide the day, allDay and the times. Answering anything that
 * comes later in §7.6's order could pre-empt an earlier code for a body with
 * several faults; the sweep test in personalWrites.test.ts pins that it never
 * does.
 */
export function eventShapeError(body: unknown): EventInputError | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return "not-object";
  const b = body as Record<string, unknown>;
  if (typeof b.title !== "string" || b.title.trim() === "") return "no-title";
  if (b.title.trim().length > EVENT_TITLE_MAX) return "title-too-long";
  if (typeof b.calendarId !== "string") return "bad-calendar";
  return null;
}

export interface ParsedEvent {
  calendarId: string;
  event: EventInput;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * `POST /api/calendar/events`'s body, validated in §7.6's order: title 1–200 ·
 * calendarId one of the stored layers · dayKey well-formed · allDay boolean ·
 * else start < end as HH:MM.
 *
 * The layers are passed in (the route reads them with readOsSettings) because
 * the calendarId check is the security boundary, not a convenience: it is what
 * makes the app unable to write to a calendar Riku did not choose. A layer
 * that is stored but switched OFF is refused too (`layer-off`): the form lists
 * switched-on layers only, "so a created event lands on a visible layer", and
 * the server holds the same line rather than trusting the form's list.
 * Unknown keys are ignored — the calendarId is the only field that could steer
 * a write, and it is checked exactly.
 */
export function parseEventInput(
  body: unknown,
  layers: readonly Layer[],
): { ok: true; value: ParsedEvent } | { ok: false; error: EventInputError } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "not-object" };
  const b = body as Record<string, unknown>;

  if (typeof b.title !== "string" || b.title.trim() === "") return { ok: false, error: "no-title" };
  const title = b.title.trim();
  if (title.length > EVENT_TITLE_MAX) return { ok: false, error: "title-too-long" };

  const layer = typeof b.calendarId === "string" ? layers.find((l) => l.calendarId === b.calendarId) : undefined;
  if (!layer) return { ok: false, error: "bad-calendar" };
  if (!layer.enabled) return { ok: false, error: "layer-off" };

  if (!isDayKey(b.dayKey)) return { ok: false, error: "bad-day" };
  const dayKey: DayKey = b.dayKey;

  if (typeof b.allDay !== "boolean") return { ok: false, error: "bad-all-day" };
  if (b.allDay) return { ok: true, value: { calendarId: layer.calendarId, event: { title, allDay: true, dayKey } } };

  if (typeof b.start !== "string" || typeof b.end !== "string" || !HHMM.test(b.start) || !HHMM.test(b.end)) {
    return { ok: false, error: "bad-time" };
  }
  // Zero-padded HH:MM compares correctly as a string.
  if (b.start >= b.end) return { ok: false, error: "end-before-start" };
  return {
    ok: true,
    value: { calendarId: layer.calendarId, event: { title, allDay: false, dayKey, start: b.start, end: b.end } },
  };
}

export function eventCreatedReply(created: { id: string; htmlLink: string }): Reply {
  const calendar: CalendarOutcome = { kind: "ok" };
  return reply(201, { id: created.id, htmlLink: created.htmlLink, calendar });
}

/**
 * insertEvent threw. Classified by todoStore's table (google.ts classifyWrite);
 * `gone` on an insert means the calendar itself is absent — a failure. Nothing
 * here is `orphaned`: an event from this form is wanted, not a pin with no
 * record, and no record is ever meant to point at it (concept D5).
 */
export function eventFailedReply(err: unknown): Reply {
  const c = classifyWrite(err);
  if (c.kind === "unknown") {
    const calendar: CalendarOutcome = { kind: "unknown", orphaned: false };
    return reply(504, { error: "calendar-unknown", calendar });
  }
  const cause = c.kind === "gone" ? "gone" : c.cause;
  const calendar: CalendarOutcome = { kind: "failed", cause, orphaned: false };
  const status = cause === "not-configured" || cause === "expired" ? 503 : 502;
  return reply(status, { error: "calendar-failed", calendar });
}
