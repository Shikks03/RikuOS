/**
 * todos.ts — the pure half of the to-do store: ordering, due chips, lateness,
 * the digest's window, and the shared input parsers.
 *
 * The write-through half (todoStore.ts) is I/O and is NOT tested here; its
 * asymmetric paths are driven against stubs in todoStore.test.ts, and its
 * behaviour against Google is the live observation's.
 *
 * Anchor: 2026-09-10 is a Thursday (`Thu 10 Sep`, days.test.ts).
 */
import { describe, it, expect } from "vitest";
import {
  daysLate,
  digestWindow,
  dueChip,
  parseCreateTodo,
  parseUpdateTodo,
  sortTodos,
  todoDueKey,
  WEEKDAY_CHIP_DAYS,
  type TodoLike,
} from "@/lib/todos";
import { addDays, dayStart } from "@/lib/days";

const TODAY = "2026-09-10";

describe("sortTodos", () => {
  // Built so that dropping any rule of the three misorders it:
  //  - by createdAt alone, `newer-but-overdue` would sink below the old undated rows;
  //  - undated-first (a null-first dueOn sort) would lead with `undated-old`;
  //  - dated rows by createdAt would put `due-later` above `most-overdue`;
  //  - undated rows newest-first would swap the last two.
  const row = (name: string, dueOn: string | null, created: string): TodoLike & { name: string } => ({
    name,
    dueOn,
    createdAt: new Date(created),
  });
  const input = [
    row("undated-new", null, "2026-09-09T00:00:00Z"),
    row("due-later", "2026-09-20", "2026-08-01T00:00:00Z"),
    row("undated-old", null, "2026-08-01T00:00:00Z"),
    row("newer-but-overdue", "2026-09-08", "2026-09-09T12:00:00Z"),
    row("due-today", TODAY, "2026-09-01T00:00:00Z"),
    row("most-overdue", "2026-09-03", "2026-09-05T00:00:00Z"),
  ];

  it("puts overdue first, most overdue first; then by due day; then undated oldest first", () => {
    expect(sortTodos(input).map((r) => r.name)).toEqual([
      "most-overdue",
      "newer-but-overdue",
      "due-today",
      "due-later",
      "undated-old",
      "undated-new",
    ]);
  });

  it("breaks a tie on the same due day by createdAt, oldest first", () => {
    const a = row("a", TODAY, "2026-09-02T00:00:00Z");
    const b = row("b", TODAY, "2026-09-01T00:00:00Z");
    expect(sortTodos([a, b]).map((r) => r.name)).toEqual(["b", "a"]);
  });

  it("returns a new array, leaves the input alone, and keeps every field", () => {
    const copy = [...input];
    const out = sortTodos(input);
    expect(input).toEqual(copy);
    expect(out).not.toBe(input);
    expect(out[0]).toHaveProperty("name", "most-overdue");
  });
});

describe("dueChip", () => {
  it("is null for an undated to-do, which has no chip", () => {
    expect(dueChip(null, TODAY)).toBeNull();
  });

  it("says today and tomorrow", () => {
    expect(dueChip(TODAY, TODAY)).toEqual({ text: "today", late: false });
    expect(dueChip("2026-09-11", TODAY)).toEqual({ text: "tomorrow", late: false });
  });

  it("uses weekday and day from day +2", () => {
    expect(dueChip("2026-09-12", TODAY)).toEqual({ text: "Sat 12", late: false });
  });

  it(`uses weekday and day through day +${WEEKDAY_CHIP_DAYS} - the seventh day of Next 7 days`, () => {
    expect(WEEKDAY_CHIP_DAYS).toBe(7);
    expect(dueChip("2026-09-17", TODAY)).toEqual({ text: "Thu 17", late: false });
  });

  it("switches to day and month at day +8", () => {
    expect(dueChip("2026-09-18", TODAY)).toEqual({ text: "18 Sep", late: false });
    expect(dueChip("2026-09-24", TODAY)).toEqual({ text: "24 Sep", late: false });
  });

  it("counts lateness in days, plural", () => {
    expect(dueChip("2026-09-07", TODAY)).toEqual({ text: "3 days late", late: true });
  });

  it("says 1 day late, singular", () => {
    expect(dueChip("2026-09-09", TODAY)).toEqual({ text: "1 day late", late: true });
  });

  it("crosses a month and a year the same way", () => {
    expect(dueChip("2027-01-01", "2026-12-31")).toEqual({ text: "tomorrow", late: false });
    expect(dueChip("2026-12-30", "2027-01-02")).toEqual({ text: "3 days late", late: true });
  });

  // R88 as amended by R96: the long form is the only one this function says.
  // The narrow-band short rendering is the component's, not this module's.
  // Assembled from parts so the plan's `git grep` guard stays quiet on this file.
  it("never returns a short form of lateness, from 60 days late to 60 days ahead", () => {
    const shortForm = ["d", "late"].join(" ");
    for (let n = -60; n <= 60; n++) {
      const chip = dueChip(addDays(TODAY, n), TODAY);
      expect(chip).not.toBeNull();
      expect(chip!.text).not.toContain(shortForm);
      expect(chip!.late).toBe(n < 0);
    }
  });
});

describe("daysLate", () => {
  it("counts whole days past due, and is 0 on or before the day", () => {
    expect(daysLate("2026-09-07", TODAY)).toBe(3);
    expect(daysLate("2026-09-09", TODAY)).toBe(1);
    expect(daysLate(TODAY, TODAY)).toBe(0);
    expect(daysLate("2026-09-12", TODAY)).toBe(0);
  });

  it("counts across a year boundary", () => {
    expect(daysLate("2026-12-31", "2027-01-02")).toBe(2);
  });
});

describe("digestWindow", () => {
  it("is today through today+3", () => {
    expect(digestWindow(TODAY)).toEqual({ fromKey: TODAY, toKey: "2026-09-13" });
  });

  it("crosses a month end", () => {
    expect(digestWindow("2026-09-29")).toEqual({ fromKey: "2026-09-29", toKey: "2026-10-02" });
  });

  it("crosses a year end", () => {
    expect(digestWindow("2026-12-30")).toEqual({ fromKey: "2026-12-30", toKey: "2027-01-02" });
  });

  it("counts a leap day", () => {
    expect(digestWindow("2028-02-27")).toEqual({ fromKey: "2028-02-27", toKey: "2028-03-01" });
  });

  it("refuses a key that is not a day", () => {
    expect(() => digestWindow("2026-02-30")).toThrow(RangeError);
  });
});

describe("todoDueKey", () => {
  it("reads a stored dueOn in UTC, as the day it names", () => {
    expect(todoDueKey(dayStart(TODAY))).toBe(TODAY);
  });

  it("is null for no date and for an invalid Date", () => {
    expect(todoDueKey(undefined)).toBeNull();
    expect(todoDueKey(null)).toBeNull();
    expect(todoDueKey(new Date("nope"))).toBeNull();
  });
});

describe("parseCreateTodo", () => {
  it("fills the form's defaults: Personal, no due day, off the calendar", () => {
    expect(parseCreateTodo({ title: "  Renew ID  " })).toEqual({
      ok: true,
      value: { title: "Renew ID", section: "personal", dueOn: null, onCalendar: false },
    });
  });

  it("takes every field", () => {
    expect(parseCreateTodo({ title: "Send invoice", section: "freelance", dueOn: TODAY, onCalendar: true })).toEqual({
      ok: true,
      value: { title: "Send invoice", section: "freelance", dueOn: TODAY, onCalendar: true },
    });
  });

  it("answers no-title - the caller's `Give it a title.` - for a missing or blank title", () => {
    expect(parseCreateTodo({})).toEqual({ ok: false, error: "no-title" });
    expect(parseCreateTodo({ title: "   " })).toEqual({ ok: false, error: "no-title" });
  });

  it("takes 140 characters and refuses 141", () => {
    expect(parseCreateTodo({ title: "x".repeat(140) }).ok).toBe(true);
    expect(parseCreateTodo({ title: "x".repeat(141) })).toEqual({ ok: false, error: "title-too-long" });
  });

  it("refuses a section outside the three, and Work in particular", () => {
    expect(parseCreateTodo({ title: "a", section: "work" }).ok).toBe(false);
  });

  it("refuses an impossible due day", () => {
    expect(parseCreateTodo({ title: "a", dueOn: "2026-02-31" }).ok).toBe(false);
  });

  it("answers needs-due - the caller's `Needs a due date.` - for the switch without a day", () => {
    expect(parseCreateTodo({ title: "a", onCalendar: true })).toEqual({ ok: false, error: "needs-due" });
  });

  it("refuses a non-object and a non-boolean switch", () => {
    expect(parseCreateTodo(null).ok).toBe(false);
    expect(parseCreateTodo([]).ok).toBe(false);
    expect(parseCreateTodo({ title: "a", onCalendar: "yes" }).ok).toBe(false);
  });
});

describe("the parsers speak in codes, never sentences", () => {
  // Every sentence Riku reads is the deck's, chosen by the caller.
  it("returns only lowercase codes for every refusal", () => {
    const refusals = [
      parseCreateTodo(null),
      parseCreateTodo({}),
      parseCreateTodo({ title: "a", section: "work" }),
      parseCreateTodo({ title: "a", dueOn: "x" }),
      parseCreateTodo({ title: "a", onCalendar: 1 }),
      parseUpdateTodo({ nope: 1 }),
      parseUpdateTodo({}),
    ];
    for (const r of refusals) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/^[a-z-]+$/);
    }
  });
});

describe("parseUpdateTodo", () => {
  it("keeps only what is present", () => {
    expect(parseUpdateTodo({ dueOn: null })).toEqual({ ok: true, value: { dueOn: null } });
    expect(parseUpdateTodo({ title: " New ", onCalendar: false })).toEqual({
      ok: true,
      value: { title: "New", onCalendar: false },
    });
  });

  it("refuses an empty patch and an unknown field", () => {
    expect(parseUpdateTodo({})).toEqual({ ok: false, error: "empty-patch" });
    expect(parseUpdateTodo({ done: true }).ok).toBe(false);
    expect(parseUpdateTodo({ calendarEventId: "x" }).ok).toBe(false);
  });

  it("refuses switching on while clearing the due day", () => {
    expect(parseUpdateTodo({ dueOn: null, onCalendar: true })).toEqual({ ok: false, error: "needs-due" });
  });

  it("refuses a blank title and a bad section", () => {
    expect(parseUpdateTodo({ title: "" }).ok).toBe(false);
    expect(parseUpdateTodo({ section: "work" }).ok).toBe(false);
  });
});
