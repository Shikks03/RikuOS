/**
 * todoStore.ts — the write-through half, driven against a stubbed Todo model
 * and a stubbed google.ts that keeps the REAL GoogleError, so classification
 * runs on the class google.ts actually throws.
 *
 * What this pins is ORDER and CLASSIFICATION — the asymmetric paths, which are
 * the riskiest code in the phase: Google first on a pin with a compensating
 * delete; local first everywhere else with the id kept on failure; `unknown`
 * for anything that may have landed; `gone` as success on a removal. What it
 * cannot pin is Mongo's own semantics for the filters written here — that is
 * the live observation's.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/models/Todo", () => ({
  default: {
    create: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock("@/lib/google", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/google")>();
  return { ...actual, insertEvent: vi.fn(), patchEvent: vi.fn(), deleteEvent: vi.fn() };
});

import Todo from "@/models/Todo";
import { deleteEvent, GoogleError, insertEvent, patchEvent } from "@/lib/google";
import { createTodo, deleteTodo, PIN_CALENDAR_ID, setTodoDone, updateTodo } from "@/lib/todoStore";
import { dayStart } from "@/lib/days";

type Fn = ReturnType<typeof vi.fn>;
const m = Todo as unknown as Record<"create" | "findOne" | "findOneAndUpdate" | "findOneAndDelete" | "updateOne", Fn>;
const insert = insertEvent as unknown as Fn;
const patch = patchEvent as unknown as Fn;
const del = deleteEvent as unknown as Fn;

/** A Mongoose query stub: `.lean()` resolves (or rejects) with `value`. */
const q = (value: unknown) => ({
  lean: () => (value instanceof Error ? Promise.reject(value) : Promise.resolve(value)),
});

const ID = "64b7f0c2a1b2c3d4e5f60718";
const DUE = "2026-09-10";
const EVT = "evt123";

const timeout = () => new GoogleError("timeout", "no answer");
const refused = () => new GoogleError("http", "bad request", 400);
const serverErr = () => new GoogleError("http", "backend", 503);
const noStatus = () => new GoogleError("http", "socket hang up");
const gone = () => new GoogleError("gone", "gone", 404);
const expired = () => new GoogleError("expired", "401 twice", 401);
const notConfigured = () => new GoogleError("not-configured", "unset");

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  insert.mockReset();
  patch.mockReset();
  del.mockReset();
  m.create.mockResolvedValue({ _id: ID });
  m.updateOne.mockResolvedValue({ acknowledged: true });
});

// --- The pin: Google first, guarded claim, compensating delete ----------------

describe("createTodo with the calendar switch on (the pin path)", () => {
  const body = { title: "Renew ID", section: "personal", dueOn: DUE, onCalendar: true };

  it("writes the to-do, then the entry, then claims the id guarded on no id yet", async () => {
    insert.mockResolvedValue({ id: EVT, htmlLink: "" });
    m.findOneAndUpdate.mockReturnValue(q({ _id: ID }));

    const r = await createTodo(body);

    expect(r).toEqual({ kind: "created", id: ID, calendar: { kind: "ok" } });
    expect(m.create).toHaveBeenCalledWith({ title: "Renew ID", section: "personal", dueOn: dayStart(DUE) });
    // All-day, day key only: google.ts sets Google's exclusive end itself.
    expect(insert).toHaveBeenCalledWith(PIN_CALENDAR_ID, { title: "Renew ID", allDay: true, dayKey: DUE });
    const [filter, update] = m.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: ID, done: false, dueOn: dayStart(DUE), calendarEventId: { $exists: false } });
    expect(update).toEqual({
      $set: { calendarEventId: EVT, calendarId: PIN_CALENDAR_ID, calendarDayOn: dayStart(DUE) },
    });
    expect(del).not.toHaveBeenCalled();
  });

  it("compensates when the guarded claim matches nothing, and says the entry is gone again", async () => {
    insert.mockResolvedValue({ id: EVT, htmlLink: "" });
    m.findOneAndUpdate.mockReturnValue(q(null));
    del.mockResolvedValue(undefined);

    const r = await createTodo(body);

    expect(del).toHaveBeenCalledWith(PIN_CALENDAR_ID, EVT);
    expect(r).toEqual({ kind: "created", id: ID, calendar: { kind: "failed", cause: "changed", orphaned: false } });
  });

  it("compensates when the claim throws, and reports it rather than throwing - the to-do IS saved", async () => {
    insert.mockResolvedValue({ id: EVT, htmlLink: "" });
    m.findOneAndUpdate.mockReturnValue(q(new Error("mongo down")));
    del.mockResolvedValue(undefined);

    const r = await createTodo(body);

    expect(del).toHaveBeenCalledWith(PIN_CALENDAR_ID, EVT);
    expect(r).toEqual({ kind: "created", id: ID, calendar: { kind: "failed", cause: "store", orphaned: false } });
  });

  it("says an entry may be left on the calendar when the compensating delete fails", async () => {
    insert.mockResolvedValue({ id: EVT, htmlLink: "" });
    m.findOneAndUpdate.mockReturnValue(q(null));
    del.mockRejectedValue(serverErr());

    const r = await createTodo(body);
    expect(r).toMatchObject({ calendar: { kind: "failed", cause: "changed", orphaned: true } });
  });

  it("says the same when the compensating delete times out - its outcome is unknown", async () => {
    insert.mockResolvedValue({ id: EVT, htmlLink: "" });
    m.findOneAndUpdate.mockReturnValue(q(null));
    del.mockRejectedValue(timeout());

    const r = await createTodo(body);
    expect(r).toMatchObject({ calendar: { kind: "failed", orphaned: true } });
  });

  it("counts a compensating delete that finds the entry already gone as clean", async () => {
    insert.mockResolvedValue({ id: EVT, htmlLink: "" });
    m.findOneAndUpdate.mockReturnValue(q(null));
    del.mockRejectedValue(gone());

    const r = await createTodo(body);
    expect(r).toMatchObject({ calendar: { kind: "failed", orphaned: false } });
  });

  it("an unanswered insert is unknown: no compensation, no id written, possibly orphaned", async () => {
    insert.mockRejectedValue(timeout());

    const r = await createTodo(body);

    expect(r).toEqual({ kind: "created", id: ID, calendar: { kind: "unknown", orphaned: true } });
    expect(m.findOneAndUpdate).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it.each([
    ["a 5xx", serverErr],
    ["a transport failure with no status", noStatus],
    ["a non-Google error", () => new Error("?")],
  ])("treats %s on the insert as unknown too", async (_label, make) => {
    insert.mockRejectedValue(make());
    const r = await createTodo(body);
    expect(r).toMatchObject({ calendar: { kind: "unknown", orphaned: true } });
    expect(m.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["not-configured", notConfigured, "not-configured"],
    ["expired", expired, "expired"],
    ["a 4xx", refused, "refused"],
    ["gone (the calendar)", gone, "gone"],
  ])("treats %s on the insert as a definite failure, nothing left behind", async (_label, make, cause) => {
    insert.mockRejectedValue(make());
    const r = await createTodo(body);
    expect(r).toMatchObject({ calendar: { kind: "failed", cause, orphaned: false } });
    expect(m.findOneAndUpdate).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("does not touch Google with the switch off", async () => {
    const r = await createTodo({ title: "Renew ID", dueOn: DUE });
    expect(r).toEqual({ kind: "created", id: ID, calendar: { kind: "none" } });
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses garbage without touching the store", async () => {
    expect(await createTodo({ title: "", onCalendar: true })).toEqual({ kind: "invalid", error: "Give it a title." });
    expect(await createTodo({ title: "a", onCalendar: true })).toEqual({ kind: "invalid", error: "Needs a due date." });
    expect(m.create).not.toHaveBeenCalled();
  });
});

// --- Done: local first, idempotent, the tick retries a failed removal ----------

describe("setTodoDone", () => {
  const pinned = { _id: ID, title: "t", done: true, calendarId: "primary", calendarEventId: EVT };

  it("flips done guarded on the opposite state, then removes the entry and forgets it", async () => {
    m.findOneAndUpdate.mockReturnValue(q(pinned));
    del.mockResolvedValue(undefined);

    const r = await setTodoDone(ID, true);

    expect(m.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: ID, done: false });
    expect(del).toHaveBeenCalledWith("primary", EVT);
    expect(m.updateOne).toHaveBeenCalledWith(
      { _id: ID, calendarEventId: EVT },
      { $unset: { calendarEventId: 1, calendarId: 1, calendarDayOn: 1 } },
    );
    expect(r).toEqual({ kind: "saved", done: true, calendar: { kind: "ok" } });
  });

  it("keeps the id when Google refuses - the Done row reads `entry left on Google`", async () => {
    m.findOneAndUpdate.mockReturnValue(q(pinned));
    del.mockRejectedValue(refused());

    const r = await setTodoDone(ID, true);

    expect(m.updateOne).not.toHaveBeenCalled();
    expect(r).toEqual({ kind: "saved", done: true, calendar: { kind: "failed", cause: "refused", orphaned: false } });
  });

  it("keeps the id and says unknown when Google does not answer", async () => {
    m.findOneAndUpdate.mockReturnValue(q(pinned));
    del.mockRejectedValue(timeout());

    const r = await setTodoDone(ID, true);

    expect(m.updateOne).not.toHaveBeenCalled();
    expect(r).toEqual({ kind: "saved", done: true, calendar: { kind: "unknown", orphaned: false } });
  });

  it("treats an entry already gone from Google as removed, and clears the id", async () => {
    m.findOneAndUpdate.mockReturnValue(q(pinned));
    del.mockRejectedValue(gone());

    const r = await setTodoDone(ID, true);

    expect(m.updateOne).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ calendar: { kind: "ok" } });
  });

  it("is idempotent: an already-done tick is saved, not an error - and retries the removal", async () => {
    m.findOneAndUpdate.mockReturnValue(q(null));
    m.findOne.mockReturnValue(q(pinned));
    del.mockResolvedValue(undefined);

    const r = await setTodoDone(ID, true);

    expect(r).toEqual({ kind: "saved", done: true, calendar: { kind: "ok" } });
    expect(del).toHaveBeenCalledWith("primary", EVT);
  });

  it("an already-done tick with no entry makes no Google call", async () => {
    m.findOneAndUpdate.mockReturnValue(q(null));
    m.findOne.mockReturnValue(q({ _id: ID, title: "t", done: true }));

    expect(await setTodoDone(ID, true)).toEqual({ kind: "saved", done: true, calendar: { kind: "none" } });
    expect(del).not.toHaveBeenCalled();
  });

  it("unticking clears doneAt and never touches the calendar", async () => {
    m.findOneAndUpdate.mockReturnValue(q({ ...pinned, done: false }));

    const r = await setTodoDone(ID, false);

    const [filter, update] = m.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: ID, done: true });
    expect(update).toEqual({ $set: { done: false }, $unset: { doneAt: 1 } });
    expect(r).toEqual({ kind: "saved", done: false, calendar: { kind: "none" } });
    expect(del).not.toHaveBeenCalled();
  });

  it("is not-found for a missing record and for a malformed id", async () => {
    m.findOneAndUpdate.mockReturnValue(q(null));
    m.findOne.mockReturnValue(q(null));
    expect(await setTodoDone(ID, true)).toEqual({ kind: "not-found" });
    expect(await setTodoDone("not-an-id", true)).toEqual({ kind: "not-found" });
  });

  it("refuses a non-boolean", async () => {
    expect(await setTodoDone(ID, "yes")).toMatchObject({ kind: "invalid" });
    expect(m.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("throws when the to-do's own write throws - nothing was saved", async () => {
    m.findOneAndUpdate.mockReturnValue(q(new Error("mongo down")));
    await expect(setTodoDone(ID, true)).rejects.toThrow("mongo down");
    expect(del).not.toHaveBeenCalled();
  });
});

// --- Edit: local first, then pin / unpin / move --------------------------------

describe("updateTodo", () => {
  const base = { _id: ID, title: "Renew ID", section: "personal", done: false, dueOn: dayStart(DUE) };
  const pinnedBefore = { ...base, calendarId: "primary", calendarEventId: EVT, calendarDayOn: dayStart(DUE) };

  it("writes the fields first, returning the record as it was", async () => {
    m.findOneAndUpdate.mockReturnValue(q(base));

    const r = await updateTodo(ID, { title: "Renew passport", section: "academics" });

    const [filter, update, options] = m.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: ID });
    expect(update).toEqual({ $set: { title: "Renew passport", section: "academics" } });
    expect(options).toMatchObject({ new: false, runValidators: true });
    expect(r).toEqual({ kind: "saved", calendar: { kind: "none" } });
  });

  it("moves a pinned entry after a date change, then records the confirmed day", async () => {
    m.findOneAndUpdate.mockReturnValue(q(pinnedBefore));
    patch.mockResolvedValue(undefined);

    const r = await updateTodo(ID, { dueOn: "2026-09-12" });

    expect(patch).toHaveBeenCalledWith("primary", EVT, { title: "Renew ID", dayKey: "2026-09-12" });
    expect(m.updateOne).toHaveBeenCalledWith(
      { _id: ID, calendarEventId: EVT },
      { $set: { calendarDayOn: dayStart("2026-09-12") } },
    );
    expect(r).toEqual({ kind: "saved", calendar: { kind: "ok" } });
  });

  it("a failed move keeps the old calendarDayOn - the row reads `entry on the old day`", async () => {
    m.findOneAndUpdate.mockReturnValue(q(pinnedBefore));
    patch.mockRejectedValue(refused());

    const r = await updateTodo(ID, { dueOn: "2026-09-12" });

    expect(m.updateOne).not.toHaveBeenCalled();
    expect(r).toEqual({ kind: "saved", calendar: { kind: "failed", cause: "refused", orphaned: false } });
  });

  it("an unanswered move is unknown and keeps the old day too", async () => {
    m.findOneAndUpdate.mockReturnValue(q(pinnedBefore));
    patch.mockRejectedValue(timeout());

    const r = await updateTodo(ID, { dueOn: "2026-09-12" });

    expect(m.updateOne).not.toHaveBeenCalled();
    expect(r).toEqual({ kind: "saved", calendar: { kind: "unknown", orphaned: false } });
  });

  it("the next save retries a failed move even when the date is not changed again", async () => {
    // Saved on the 12th earlier; the entry is still confirmed on the 10th.
    m.findOneAndUpdate.mockReturnValue(q({ ...pinnedBefore, dueOn: dayStart("2026-09-12") }));
    patch.mockResolvedValue(undefined);

    await updateTodo(ID, { section: "freelance" });

    expect(patch).toHaveBeenCalledWith("primary", EVT, { title: "Renew ID", dayKey: "2026-09-12" });
  });

  it("a move whose entry is gone clears the id: the to-do is off the calendar", async () => {
    m.findOneAndUpdate.mockReturnValue(q(pinnedBefore));
    patch.mockRejectedValue(gone());

    const r = await updateTodo(ID, { dueOn: "2026-09-12" });

    expect(m.updateOne).toHaveBeenCalledWith(
      { _id: ID, calendarEventId: EVT },
      { $unset: { calendarEventId: 1, calendarId: 1, calendarDayOn: 1 } },
    );
    expect(r).toEqual({ kind: "saved", calendar: { kind: "failed", cause: "gone", orphaned: false } });
  });

  it("makes no Google call when nothing the entry shows has changed", async () => {
    m.findOneAndUpdate.mockReturnValue(q(pinnedBefore));
    await updateTodo(ID, { section: "freelance" });
    expect(patch).not.toHaveBeenCalled();
  });

  it("retitles a pinned entry", async () => {
    m.findOneAndUpdate.mockReturnValue(q(pinnedBefore));
    patch.mockResolvedValue(undefined);
    await updateTodo(ID, { title: "Renew passport" });
    expect(patch).toHaveBeenCalledWith("primary", EVT, { title: "Renew passport", dayKey: DUE });
  });

  it("switching off removes the entry; a failure keeps the id for the retry", async () => {
    m.findOneAndUpdate.mockReturnValue(q(pinnedBefore));
    m.findOne.mockReturnValue(q(pinnedBefore));
    del.mockRejectedValue(expired());

    const r = await updateTodo(ID, { onCalendar: false });

    expect(del).toHaveBeenCalledWith("primary", EVT);
    expect(m.updateOne).not.toHaveBeenCalled();
    expect(r).toEqual({ kind: "saved", calendar: { kind: "failed", cause: "expired", orphaned: false } });
  });

  it("clearing the due day of a pinned to-do removes the entry", async () => {
    m.findOneAndUpdate.mockReturnValue(q(pinnedBefore));
    del.mockResolvedValue(undefined);

    const r = await updateTodo(ID, { dueOn: null });

    expect(m.findOneAndUpdate.mock.calls[0][1]).toEqual({ $unset: { dueOn: 1 } });
    expect(del).toHaveBeenCalledWith("primary", EVT);
    expect(r).toEqual({ kind: "saved", calendar: { kind: "ok" } });
  });

  it("switching on pins, with the stored due day required by the same atomic read", async () => {
    m.findOne.mockReturnValue(q(base));
    insert.mockResolvedValue({ id: EVT, htmlLink: "" });
    m.findOneAndUpdate.mockReturnValue(q({ _id: ID }));

    const r = await updateTodo(ID, { onCalendar: true });

    expect(m.findOne.mock.calls[0][0]).toEqual({ _id: ID, dueOn: { $exists: true } });
    expect(insert).toHaveBeenCalledWith(PIN_CALENDAR_ID, { title: "Renew ID", allDay: true, dayKey: DUE });
    expect(r).toEqual({ kind: "saved", calendar: { kind: "ok" } });
  });

  it("switching on an undated to-do is `Needs a due date.`, nothing written", async () => {
    m.findOne.mockReturnValueOnce(q(null)).mockReturnValueOnce(q({ ...base, dueOn: undefined }));

    expect(await updateTodo(ID, { onCalendar: true })).toEqual({ kind: "invalid", error: "Needs a due date." });
    expect(insert).not.toHaveBeenCalled();
  });

  it("is not-found for a missing record and a malformed id; invalid for garbage", async () => {
    m.findOneAndUpdate.mockReturnValue(q(null));
    expect(await updateTodo(ID, { title: "x" })).toEqual({ kind: "not-found" });
    expect(await updateTodo("nope", { title: "x" })).toEqual({ kind: "not-found" });
    expect(await updateTodo(ID, { calendarEventId: "x" })).toMatchObject({ kind: "invalid" });
  });
});

// --- Delete: local first; the one path that cannot keep the id ------------------

describe("deleteTodo", () => {
  const pinned = { _id: ID, title: "t", done: false, calendarId: "primary", calendarEventId: EVT };

  it("deletes the record, then its entry", async () => {
    m.findOneAndDelete.mockReturnValue(q(pinned));
    del.mockResolvedValue(undefined);

    expect(await deleteTodo(ID)).toEqual({ kind: "deleted", calendar: { kind: "ok" } });
    expect(del).toHaveBeenCalledWith("primary", EVT);
  });

  it("treats an entry already gone as removed", async () => {
    m.findOneAndDelete.mockReturnValue(q(pinned));
    del.mockRejectedValue(gone());
    expect(await deleteTodo(ID)).toEqual({ kind: "deleted", calendar: { kind: "ok" } });
  });

  it("a failed removal is orphaned - the record that held the id is gone", async () => {
    m.findOneAndDelete.mockReturnValue(q(pinned));
    del.mockRejectedValue(refused());
    expect(await deleteTodo(ID)).toEqual({
      kind: "deleted",
      calendar: { kind: "failed", cause: "refused", orphaned: true },
    });
  });

  it("an unanswered removal is unknown and orphaned", async () => {
    m.findOneAndDelete.mockReturnValue(q(pinned));
    del.mockRejectedValue(timeout());
    expect(await deleteTodo(ID)).toEqual({ kind: "deleted", calendar: { kind: "unknown", orphaned: true } });
  });

  it("makes no Google call for an unpinned to-do, and is not-found for a missing one", async () => {
    m.findOneAndDelete.mockReturnValueOnce(q({ _id: ID, title: "t", done: false })).mockReturnValueOnce(q(null));
    expect(await deleteTodo(ID)).toEqual({ kind: "deleted", calendar: { kind: "none" } });
    expect(await deleteTodo(ID)).toEqual({ kind: "not-found" });
    expect(await deleteTodo("nope")).toEqual({ kind: "not-found" });
    expect(del).not.toHaveBeenCalled();
  });
});
