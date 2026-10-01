/**
 * todos.ts — the PURE half of the to-do store: ordering, due chips, lateness,
 * the morning digest's window, and the input parsers the routes and the
 * write-through half share.
 *
 * Pure: no model, no network, no environment, no clock — `today` is always a
 * parameter. That is not tidiness. personalView.ts (Task 9) imports this file, and a
 * view model that reaches a Mongoose model has stopped being testable without
 * a database (R52, viewModelPurity.test.ts, which now imports this file too).
 * The write-through half therefore lives in todoStore.ts, which imports this
 * one and never the other way round. The plan placed both halves in this one
 * file behind a banner; with personalView.ts as a consumer that would register
 * the Todo model on every view-model import, which is exactly R52's defect.
 *
 * Every date here is a DayKey. `Todo.dueOn` is a UTC-midnight day; read it
 * with todoDueKey (dayKey(dueOn, "UTC")), never in APP_TZ.
 */

// Type-only: erased at build, so no schema is registered by importing this file.
import type { TodoSection } from "@/models/Todo";
import { addDays, dayKey, daysBetween, formatDay, isDayKey, type DayKey } from "@/lib/days";
import { TODO_TITLE_MAX } from "@/lib/constants";

// --- Ordering ----------------------------------------------------------------

/** The least a row needs to be ordered. Anything wider passes through intact. */
export interface TodoLike {
  dueOn: DayKey | null;
  createdAt: Date;
}

/** A stored `dueOn` (UTC midnight) as the day it names. */
export function todoDueKey(dueOn: Date | null | undefined): DayKey | null {
  return dueOn instanceof Date && !Number.isNaN(dueOn.getTime()) ? dayKey(dueOn, "UTC") : null;
}

/**
 * Overdue first, most overdue first; then by due day; then undated rows by
 * createdAt, oldest first.
 *
 * The first two rules are ONE comparison: an overdue day is an earlier day, so
 * ascending `dueOn` puts the most overdue at the top and needs no `today`.
 * Equal days fall back to createdAt, oldest first. Returns a new array; the
 * input is not touched. Array.prototype.sort is stable, so full ties keep
 * their input order.
 */
export function sortTodos<T extends TodoLike>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.dueOn !== null && b.dueOn !== null && a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1;
    if (a.dueOn === null && b.dueOn !== null) return 1;
    if (a.dueOn !== null && b.dueOn === null) return -1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

// --- Due chips ---------------------------------------------------------------

/**
 * The last day, counted from today, that takes the weekday form. Day +7 is
 * `Thu 17` when today is Thu 10, not `17 Sep`: it is the seventh day of the
 * Next 7 days tile (tomorrow through the seventh day), and the day number
 * keeps it from reading as today's weekday. Day +8 is the first `24 Sep`.
 */
export const WEEKDAY_CHIP_DAYS = 7;

/**
 * The due chip, in deck §6's words and only those: `today` · `tomorrow` ·
 * `Fri 12` (days +2 … +7) · `24 Sep` (+8 and beyond) · `3 days late`, singular
 * `1 day late`. Null for an undated to-do, which has no chip.
 *
 * Only the long lateness form is returned. The narrow-band short rendering
 * ratified 2026-09-25 (deck §15, R96) is chosen by Plan C's component below
 * 240px of tile, from the same sentence; it is a rendering, so it belongs to
 * the component and not to this function.
 *
 * `late` is a boolean and never a colour (§5.9 item 1).
 */
export function dueChip(dueOn: DayKey | null, today: DayKey): { text: string; late: boolean } | null {
  if (dueOn === null) return null;
  const ahead = daysBetween(today, dueOn);
  if (ahead < 0) {
    const n = -ahead;
    return { text: `${n} ${n === 1 ? "day" : "days"} late`, late: true };
  }
  if (ahead === 0) return { text: "today", late: false };
  if (ahead === 1) return { text: "tomorrow", late: false };
  // formatDay is "Thu 10 Sep": weekday, day, month.
  const [weekday, day, month] = formatDay(dueOn).split(" ");
  return { text: ahead <= WEEKDAY_CHIP_DAYS ? `${weekday} ${day}` : `${day} ${month}`, late: false };
}

/**
 * R96's short lateness form, the one the page shows below 240px of tile
 * (L1): `3 days late` → `3d late`, `1 day late` → `1d late`. A rendering of
 * dueChip's own sentence, so the two can never disagree about the count.
 * Anything that is not a lateness sentence comes back unchanged — the narrow
 * band always renders something, never an empty meta.
 */
export function shortLateness(text: string): string {
  const m = /^(\d+) days? late$/.exec(text);
  return m ? `${m[1]}d late` : text;
}

/** Whole days past due; 0 for a to-do due today or later. */
export function daysLate(dueOn: DayKey, today: DayKey): number {
  return Math.max(0, daysBetween(dueOn, today));
}

/**
 * The number of days Done this week covers, today included. The content deck
 * defines the tile's job as "what was ticked off in the last seven days"
 * (§6 Tile 6): a rolling window, not a calendar week.
 */
export const DONE_WINDOW_DAYS = 7;

/**
 * The first day of Done this week: today and the six days before it, both
 * ends inclusive, as APP_TZ days. The loader turns it into an instant
 * with the APP_TZ midnight that begins it (see personalView.ts's DoneInput).
 */
export function doneWindowStart(today: DayKey): DayKey {
  return addDays(today, -(DONE_WINDOW_DAYS - 1));
}

/** The morning push's `Due:` window: today … today+3, both ends inclusive. */
export function digestWindow(today: DayKey): { fromKey: DayKey; toKey: DayKey } {
  return { fromKey: today, toKey: addDays(today, 3) };
}

// --- Input -------------------------------------------------------------------

/** constants.ts holds it (the Todo model imports it from there); re-exported for the lib and the routes. */
export { TODO_TITLE_MAX };

export interface CreateTodoInput {
  title: string;
  section: TodoSection;
  dueOn: DayKey | null;
  /** `Put on calendar`. Requires a due day. */
  onCalendar: boolean;
}

/** Every field optional: only what is present changes. */
export interface UpdateTodoInput {
  title?: string;
  section?: TodoSection;
  /** null clears the due day — and, on a pinned to-do, removes the entry. */
  dueOn?: DayKey | null;
  onCalendar?: boolean;
}

/**
 * Why an input was refused — a CODE, never a sentence. Every sentence Riku
 * reads comes verbatim from the deck and is chosen by the caller: `no-title`
 * is deck §7's `Give it a title.` and `needs-due` is the note deck §7 puts
 * under the switch, `Needs a due date.`. The others have no deck sentence
 * because the form cannot produce them (it bounds the title, offers only the
 * three sections, sends a real day and a boolean); they reach the route only
 * from a malformed request, and the route answers them as a plain 400.
 */
export type TodoInputError =
  | "not-object"
  | "no-title"
  | "title-too-long"
  | "bad-section"
  | "bad-due"
  | "bad-switch"
  | "needs-due"
  | "unknown-field"
  | "empty-patch";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: TodoInputError };

function parseTitle(v: unknown): Parsed<string> {
  if (typeof v !== "string") return { ok: false, error: "no-title" };
  const title = v.trim();
  if (title === "") return { ok: false, error: "no-title" };
  if (title.length > TODO_TITLE_MAX) return { ok: false, error: "title-too-long" };
  return { ok: true, value: title };
}

/**
 * The model's TODO_SECTIONS, restated without importing the model. Typed as a
 * Record over TodoSection, so a section added to or removed from the model
 * fails to compile here instead of drifting.
 */
const SECTION_KEYS: Record<TodoSection, true> = { personal: true, freelance: true, academics: true };

function parseSection(v: unknown): Parsed<TodoSection> {
  return typeof v === "string" && Object.hasOwn(SECTION_KEYS, v)
    ? { ok: true, value: v as TodoSection }
    : { ok: false, error: "bad-section" };
}

function parseDue(v: unknown): Parsed<DayKey | null> {
  if (v === null) return { ok: true, value: null };
  return isDayKey(v) ? { ok: true, value: v } : { ok: false, error: "bad-due" };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * A POST body → CreateTodoInput. The route validates with this at its top; the
 * write-through half runs it again and refuses what fails (defence in depth,
 * so garbage handed straight to the lib cannot reach the store). Absent
 * `section` is Personal and absent `dueOn`/`onCalendar` are none/off — the
 * form's own defaults (deck §7).
 */
export function parseCreateTodo(body: unknown): Parsed<CreateTodoInput> {
  if (!isRecord(body)) return { ok: false, error: "not-object" };
  const title = parseTitle(body.title);
  if (!title.ok) return title;
  const section = body.section === undefined ? ({ ok: true, value: "personal" } as const) : parseSection(body.section);
  if (!section.ok) return section;
  const dueOn = body.dueOn === undefined ? ({ ok: true, value: null } as const) : parseDue(body.dueOn);
  if (!dueOn.ok) return dueOn;
  if (body.onCalendar !== undefined && typeof body.onCalendar !== "boolean") {
    return { ok: false, error: "bad-switch" };
  }
  const onCalendar = body.onCalendar === true;
  if (onCalendar && dueOn.value === null) return { ok: false, error: "needs-due" };
  return { ok: true, value: { title: title.value, section: section.value, dueOn: dueOn.value, onCalendar } };
}

/**
 * A PATCH body → UpdateTodoInput. Unknown keys are refused rather than
 * ignored, so a typo cannot read as a save that changed nothing. An empty
 * patch is refused too. `onCalendar: true` with `dueOn: null` in the same
 * patch is refused; `onCalendar: true` alone is checked against the stored
 * due day by the write-through half.
 */
export function parseUpdateTodo(body: unknown): Parsed<UpdateTodoInput> {
  if (!isRecord(body)) return { ok: false, error: "not-object" };
  const known = ["title", "section", "dueOn", "onCalendar"];
  const unknown = Object.keys(body).filter((k) => !known.includes(k));
  if (unknown.length > 0) return { ok: false, error: "unknown-field" };
  const out: UpdateTodoInput = {};
  if (body.title !== undefined) {
    const t = parseTitle(body.title);
    if (!t.ok) return t;
    out.title = t.value;
  }
  if (body.section !== undefined) {
    const s = parseSection(body.section);
    if (!s.ok) return s;
    out.section = s.value;
  }
  if (body.dueOn !== undefined) {
    const d = parseDue(body.dueOn);
    if (!d.ok) return d;
    out.dueOn = d.value;
  }
  if (body.onCalendar !== undefined) {
    if (typeof body.onCalendar !== "boolean") return { ok: false, error: "bad-switch" };
    out.onCalendar = body.onCalendar;
  }
  if (Object.keys(out).length === 0) return { ok: false, error: "empty-patch" };
  if (out.onCalendar === true && out.dueOn === null) return { ok: false, error: "needs-due" };
  return { ok: true, value: out };
}
