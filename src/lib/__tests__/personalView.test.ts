/**
 * personalView.test.ts — the six view models, in every state (§8).
 *
 * Every string asserted here is the deck's (docs/superpowers/specs/
 * 2026-09-10-p10-personal-page-content.md §6 / §11 / §12 / §15). A failure
 * here that "fixes" a string is a deck change, not a test change.
 *
 * Fixture clock: 2026-09-10T02:00:00Z is Thu 10 Sep, 10:00 in Manila.
 */
import { describe, it, expect } from "vitest";
import {
  buildTodayView,
  buildWeekView,
  buildTodoTileView,
  buildDoneView,
  buildPushTileView,
  buildLayersView,
  dayShape,
  type CalendarFeed,
  type OpenTodoInput,
  type OpenTodosFeed,
  type DoneTodoInput,
  type TodoTileView,
  type PushInput,
} from "@/lib/personalView";
import type { CalendarEvent, CalendarListEntry } from "@/lib/google";
import type { Layer } from "@/lib/osSettings";
import { PERSONAL_LAYOUT_DEFAULT } from "@/lib/personalLayout";

const NOW = new Date("2026-09-10T02:00:00Z"); // Thu 10 Sep 10:00 Manila
const TODAY = "2026-09-10";
const LAYOUT = PERSONAL_LAYOUT_DEFAULT;

const LAYERS: Layer[] = [
  { calendarId: "primary", name: "Personal", enabled: true },
  { calendarId: "classes@g", name: "Classes", enabled: true },
  { calendarId: "events@g", name: "Events", enabled: false },
];

let seq = 0;
function ev(over: Partial<CalendarEvent> = {}): CalendarEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    title: `Event ${seq}`,
    layerName: "Personal",
    allDay: false,
    startsAt: new Date("2026-09-10T01:00:00Z"), // 09:00 Manila
    endsAt: new Date("2026-09-10T02:50:00Z"), // 10:50 Manila
    dayKey: TODAY,
    htmlLink: "https://calendar.google.com/e",
    ...over,
  };
}

function todo(over: Partial<OpenTodoInput> = {}): OpenTodoInput {
  seq += 1;
  return {
    id: `t${seq}`,
    title: `Todo ${seq}`,
    section: "personal",
    dueOn: null,
    createdAt: new Date(Date.UTC(2026, 8, 1, 0, seq)),
    calendarEventId: null,
    calendarBehind: false,
    ...over,
  };
}

/** A complete read: every count agrees with the rows. */
const open = (rows: OpenTodoInput[]): OpenTodosFeed => ({
  rows,
  total: rows.length,
  sectionTotals: {
    personal: rows.filter((r) => r.section === "personal").length,
    freelance: rows.filter((r) => r.section === "freelance").length,
    academics: rows.filter((r) => r.section === "academics").length,
  },
});
const okWindow = (events: CalendarEvent[], failed: string[] = []): CalendarFeed => ({
  layers: LAYERS,
  window: { ok: true, events, failed },
  calendars: null,
});

function today(calendar: CalendarFeed, todos: OpenTodosFeed = open([])) {
  return buildTodayView({ now: NOW, calendar, todos, layout: LAYOUT });
}
function week(calendar: CalendarFeed, todos: OpenTodosFeed = open([])) {
  return buildWeekView({ now: NOW, calendar, todos });
}

// ---------------------------------------------------------------- Today ----

describe("buildTodayView", () => {
  it("dates the tile in the deck's spelling", () => {
    expect(today(okWindow([])).dateLabel).toBe("Thu 10 Sep");
  });

  it("empty day: both groups empty, spread, tint green", () => {
    const v = today(okWindow([]));
    expect(v.scheduled).toEqual({ kind: "empty" });
    expect(v.due).toEqual({ kind: "empty" });
    expect(v.spread).toBe(true);
    expect(v.heroTint).toBe(0);
  });

  it("renders today's events only, with time ranges, all-day first", () => {
    const v = today(
      okWindow([
        ev({ title: "Math Methods" }),
        ev({ title: "Baguio trip", allDay: true, startsAt: null, endsAt: null }),
        ev({ title: "Tomorrow", dayKey: "2026-09-11" }),
      ]),
    );
    expect(v.scheduled.kind).toBe("rows");
    if (v.scheduled.kind !== "rows") return;
    expect(v.scheduled.rows.map((r) => [r.time, r.title, r.layerName])).toEqual([
      ["all day", "Baguio trip", "Personal"],
      ["09:00–10:50", "Math Methods", "Personal"],
    ]);
    expect(v.scheduled.bound).toBeNull();
    expect(v.scheduled.fails).toEqual([]);
  });

  it("spread is false when SCHEDULED has rows and DUE is empty (R17)", () => {
    const v = today(okWindow([ev()]));
    expect(v.due.kind).toBe("empty");
    expect(v.spread).toBe(false);
  });

  it("one layer failed: rows that arrived, then the layer's own sentence; Nothing scheduled. suppressed", () => {
    const v = today(okWindow([ev()], ["Classes"]));
    expect(v.scheduled).toMatchObject({
      kind: "rows",
      fails: [{ text: "Couldn't read Classes.", dot: "stale" }],
    });
    const none = today(okWindow([], ["Classes"]));
    expect(none.scheduled).toEqual({ kind: "fail", lines: [{ text: "Couldn't read Classes.", dot: "stale" }] });
    expect(none.spread).toBe(false);
  });

  it("every layer failed: Couldn't read the calendar.", () => {
    const v = today(okWindow([], ["Personal", "Classes"]));
    expect(v.scheduled).toEqual({ kind: "fail", lines: [{ text: "Couldn't read the calendar.", dot: "stale" }] });
  });

  it("timeout: Couldn't read the calendar.", () => {
    const v = today({ layers: LAYERS, window: { ok: false, reason: "timeout" }, calendars: null });
    expect(v.scheduled).toEqual({ kind: "fail", lines: [{ text: "Couldn't read the calendar.", dot: "stale" }] });
  });

  it("not-configured: absence by configuration, no dot", () => {
    const v = today({ layers: LAYERS, window: { ok: false, reason: "not-configured" }, calendars: null });
    expect(v.scheduled).toEqual({
      kind: "fail",
      lines: [{ text: "Google isn't connected yet. Set it up in Settings.", dot: null }],
    });
  });

  it("expired: a couldn't-read, dotted", () => {
    const v = today({ layers: LAYERS, window: { ok: false, reason: "expired" }, calendars: null });
    expect(v.scheduled).toEqual({
      kind: "fail",
      lines: [{ text: "Google access has expired. Renew it from Settings.", dot: "stale" }],
    });
  });

  it("none-enabled with layers: All layers are switched off. (no dot)", () => {
    const off = LAYERS.map((l) => ({ ...l, enabled: false }));
    const v = today({ layers: off, window: { ok: false, reason: "none-enabled" }, calendars: null });
    expect(v.scheduled).toEqual({ kind: "fail", lines: [{ text: "All layers are switched off.", dot: null }] });
    expect(v.spread).toBe(false);
  });

  it("none-enabled with no layers: No calendars chosen. (no dot)", () => {
    const v = today({ layers: [], window: { ok: false, reason: "none-enabled" }, calendars: null });
    expect(v.scheduled).toEqual({
      kind: "fail",
      lines: [{ text: "No calendars chosen. Pick them in Settings.", dot: null }],
    });
  });

  it("layers unreadable: the calendar was never read", () => {
    const v = today("layers-unavailable");
    expect(v.scheduled).toEqual({
      kind: "fail",
      lines: [{ text: "Couldn't load layers, so the calendar wasn't read.", dot: "stale" }],
    });
  });

  it("a vanished layer says so where its couldn't-read would sit, without a dot (R42)", () => {
    const calendars: CalendarListEntry[] = [{ calendarId: "primary", name: "Personal", primary: true }];
    const v = today({ layers: LAYERS, window: { ok: true, events: [ev()], failed: ["Classes"] }, calendars });
    expect(v.scheduled).toMatchObject({
      kind: "rows",
      fails: [{ text: "Classes is no longer on your Google account. Untick it in Settings.", dot: null }],
    });
    expect(v.heroTint).toBe(0);
  });

  it("to-dos unavailable: dotted sentence in DUE's place, untinted hero, no spread", () => {
    const v = today(okWindow([]), "unavailable");
    expect(v.due).toEqual({ kind: "fail", line: { text: "Couldn't load to-dos.", dot: "stale" } });
    expect(v.heroTint).toBeNull();
    expect(v.spread).toBe(false);
  });

  it("both feeds down: two dotted sentences, untinted", () => {
    const v = today("layers-unavailable", "unavailable");
    expect(v.scheduled.kind).toBe("fail");
    expect(v.due.kind).toBe("fail");
    expect(v.heroTint).toBeNull();
  });

  it("DUE: due today first, then overdue most-overdue first; later days are not due (deck §6 Tile 1)", () => {
    const rows = [
      todo({ title: "Late 1", dueOn: "2026-09-09" }),
      todo({ title: "Pay tuition", dueOn: TODAY }),
      todo({ title: "Late 3", dueOn: "2026-09-07" }),
      todo({ title: "Tomorrow", dueOn: "2026-09-11" }),
      todo({ title: "Undated" }),
    ];
    const v = today(okWindow([]), open(rows));
    expect(v.due.kind).toBe("rows");
    if (v.due.kind !== "rows") return;
    expect(v.due.rows.map((r) => [r.title, r.due?.text, r.due?.late])).toEqual([
      ["Pay tuition", "today", false],
      ["Late 3", "3 days late", true],
      ["Late 1", "1 day late", true],
    ]);
    expect(v.heroTint).toBe(3);
  });

  it("the 20-row bound on SCHEDULED: Showing 20 of 26.", () => {
    const events = Array.from({ length: 26 }, () => ev());
    const v = today(okWindow(events));
    expect(v.scheduled.kind).toBe("rows");
    if (v.scheduled.kind !== "rows") return;
    expect(v.scheduled.rows).toHaveLength(20);
    expect(v.scheduled.bound).toBe("Showing 20 of 26.");
  });

  it("the open row's note: entry on the old day, only when pinned AND behind", () => {
    const v = today(
      okWindow([]),
      open([
        todo({ title: "Behind", dueOn: TODAY, calendarEventId: "g1", calendarBehind: true }),
        todo({ title: "Pinned", dueOn: TODAY, calendarEventId: "g2" }),
        todo({ title: "Stray flag", dueOn: TODAY, calendarBehind: true }),
      ]),
    );
    if (v.due.kind !== "rows") throw new Error("expected rows");
    expect(v.due.rows.map((r) => [r.title, r.onCalendar, r.note])).toEqual([
      ["Behind", true, "entry on the old day"],
      ["Pinned", true, null],
      ["Stray flag", false, null],
    ]);
  });

  describe("the tint answers to the to-do read alone (R74, R83, R85)", () => {
    it("events never count: a crowded calendar with nothing due is green", () => {
      const v = today(okWindow(Array.from({ length: 9 }, () => ev())));
      expect(v.heroTint).toBe(0);
    });
    it("one overdue counts as one, beside scheduled events", () => {
      const v = today(okWindow([ev(), ev(), ev()]), open([todo({ dueOn: "2026-09-01" })]));
      expect(v.heroTint).toBe(1);
    });
    it("is green on the expired-Google hero", () => {
      expect(today({ layers: LAYERS, window: { ok: false, reason: "expired" }, calendars: null }).heroTint).toBe(0);
    });
    it("is green on the all-layers-off hero", () => {
      const off = LAYERS.map((l) => ({ ...l, enabled: false }));
      expect(today({ layers: off, window: { ok: false, reason: "none-enabled" }, calendars: null }).heroTint).toBe(0);
    });
    it("is green on the one-layer-failed hero", () => {
      expect(today(okWindow([], ["Classes"])).heroTint).toBe(0);
    });
    it("clamps at 8", () => {
      const rows = Array.from({ length: 14 }, () => todo({ dueOn: TODAY }));
      expect(today(okWindow([]), open(rows)).heroTint).toBe(8);
    });
  });

  it("formCapable follows the stored span: the default hero (span 8) is capable", () => {
    expect(today(okWindow([])).formCapable).toBe(true);
    const narrow = [
      [
        { tile: "today" as const, span: 3 },
        { tile: "todos" as const, span: 9 },
      ],
      [{ tile: "layers" as const, span: 12 }],
      [{ tile: "push" as const, span: 12 }],
      [
        { tile: "week" as const, span: 6 },
        { tile: "done" as const, span: 6 },
      ],
    ];
    expect(buildTodayView({ now: NOW, calendar: okWindow([]), todos: open([]), layout: narrow }).formCapable).toBe(false);
  });
});

// ----------------------------------------------------------------- Week ----

describe("buildWeekView", () => {
  it("seven rows, tomorrow through the seventh day, labelled Fri 11 … Thu 17", () => {
    const v = week(okWindow([]));
    expect(v.days?.map((d) => d.label)).toEqual(["Fri 11", "Sat 12", "Sun 13", "Mon 14", "Tue 15", "Wed 16", "Thu 17"]);
    expect(v.fails).toEqual([]);
  });

  it("an empty answered day renders the dash shape", () => {
    const v = week(okWindow([]));
    expect(v.days && dayShape(v.days[0])).toEqual({ kind: "dash" });
  });

  it("orders all-day, timed by start, then to-dos; events carry their link", () => {
    const d = "2026-09-11";
    const v = week(
      okWindow([
        ev({ title: "Late class", dayKey: d, startsAt: new Date("2026-09-11T05:00:00Z") }),
        ev({ title: "Trip", dayKey: d, allDay: true, startsAt: null, endsAt: null }),
        ev({ title: "Math Methods", dayKey: d, startsAt: new Date("2026-09-11T01:00:00Z") }),
      ]),
      open([todo({ title: "Reviewer ch.3", section: "academics", dueOn: d })]),
    );
    const row = v.days![0];
    expect("items" in row).toBe(true);
    if (!("items" in row)) return;
    expect(row.items.map((i) => [i.kind, i.time, i.title, i.layerOrSection])).toEqual([
      ["event", "all day", "Trip", "Personal"],
      ["event", "09:00", "Math Methods", "Personal"],
      ["event", "13:00", "Late class", "Personal"],
      ["todo", null, "Reviewer ch.3", "Academics"],
    ]);
    expect(row.items[3].href).toBeNull();
    expect(row.items[0].href).toBe("https://calendar.google.com/e");
  });

  it("nothing is truncated inside a day, at eleven items (R51b)", () => {
    const d = "2026-09-12";
    const v = week(okWindow(Array.from({ length: 11 }, () => ev({ dayKey: d }))));
    const row = v.days![1];
    if (!("items" in row)) throw new Error("expected items");
    expect(row.items).toHaveLength(11);
    const shape = dayShape(row);
    expect(shape.kind).toBe("disclosure");
    if (shape.kind === "disclosure") {
      expect(shape.items).toHaveLength(11);
      expect(shape.count).toBe("11 items");
    }
  });

  it("0 → dash, 1 → plain, 2+ → disclosure with the leading item's bare title and `N items`", () => {
    const v = week(
      okWindow([
        ev({ title: "Solo", dayKey: "2026-09-11" }),
        ev({ title: "Math Methods", dayKey: "2026-09-12" }),
        ev({ title: "Second", dayKey: "2026-09-12", startsAt: new Date("2026-09-12T05:00:00Z") }),
      ]),
    );
    const [one, two, zero] = v.days!;
    expect(dayShape(one)).toMatchObject({ kind: "one", item: { title: "Solo" } });
    expect(dayShape(two)).toMatchObject({ kind: "disclosure", summary: "Math Methods", count: "2 items" });
    expect(dayShape(zero)).toEqual({ kind: "dash" });
  });

  it("`N items` never reads `1 items`", () => {
    const counts: string[] = [];
    for (let n = 0; n <= 12; n++) {
      const v = week(okWindow(Array.from({ length: n }, () => ev({ dayKey: "2026-09-11" }))));
      const s = dayShape(v.days![0]);
      if (s.kind === "disclosure") counts.push(s.count);
    }
    expect(counts).toHaveLength(11);
    expect(counts.some((c) => /^1 items?$/.test(c))).toBe(false);
  });

  it("calendar failed: its sentence at the top; empty days are unread, never `—` (R18)", () => {
    const v = week(
      { layers: LAYERS, window: { ok: false, reason: "expired" }, calendars: null },
      open([todo({ dueOn: "2026-09-11" })]),
    );
    expect(v.fails).toEqual([{ text: "Google access has expired. Renew it from Settings.", dot: "stale" }]);
    expect(dayShape(v.days![0]).kind).toBe("one");
    for (const d of v.days!.slice(1)) {
      expect(d).toMatchObject({ unread: true });
      expect(dayShape(d)).toEqual({ kind: "unread" });
    }
  });

  it("one layer failed: its sentence on top; days with nothing are unread", () => {
    const v = week(okWindow([ev({ dayKey: "2026-09-13" })], ["Classes"]));
    expect(v.fails).toEqual([{ text: "Couldn't read Classes.", dot: "stale" }]);
    expect(dayShape(v.days![2]).kind).toBe("one");
    expect(v.days![0]).toMatchObject({ unread: true });
  });

  it("to-dos unavailable: the sentence on top, days list events only, empty days unread", () => {
    const v = week(okWindow([ev({ dayKey: "2026-09-11" })]), "unavailable");
    expect(v.fails).toEqual([{ text: "Couldn't load to-dos.", dot: "stale" }]);
    expect(dayShape(v.days![0]).kind).toBe("one");
    expect(v.days![1]).toMatchObject({ unread: true });
  });

  it("both feeds down: days omitted entirely, two sentences (R18, deck §11)", () => {
    const v = week("layers-unavailable", "unavailable");
    expect(v.days).toBeNull();
    expect(v.fails).toEqual([
      { text: "Couldn't load layers, so the calendar wasn't read.", dot: "stale" },
      { text: "Couldn't load to-dos.", dot: "stale" },
    ]);
  });

  it("every layer off: days render and `—` is a measurement (R45)", () => {
    const off = LAYERS.map((l) => ({ ...l, enabled: false }));
    const v = week({ layers: off, window: { ok: false, reason: "none-enabled" }, calendars: null });
    expect(v.fails).toEqual([{ text: "All layers are switched off.", dot: null }]);
    expect(v.days!.every((d) => dayShape(d).kind === "dash")).toBe(true);
  });

  it("not-configured: the undotted sentence on top, days unread", () => {
    const v = week({ layers: LAYERS, window: { ok: false, reason: "not-configured" }, calendars: null });
    expect(v.fails).toEqual([{ text: "Google isn't connected yet. Set it up in Settings.", dot: null }]);
    expect(v.days!.every((d) => "unread" in d)).toBe(true);
  });

  it("a 3-day all-day event appears on three day rows under the same id (keys are dayKey:id)", () => {
    const trip = (d: string) => ev({ id: "trip", title: "Baguio trip", allDay: true, startsAt: null, endsAt: null, dayKey: d });
    const v = week(okWindow([trip("2026-09-12"), trip("2026-09-13"), trip("2026-09-14")]));
    const withTrip = v.days!.filter((d) => "items" in d && d.items.some((i) => i.id === "trip"));
    expect(withTrip.map((d) => d.key)).toEqual(["2026-09-12", "2026-09-13", "2026-09-14"]);
    const keys = withTrip.map((d) => ("items" in d ? `${d.key}:${d.items[0].id}` : ""));
    expect(new Set(keys).size).toBe(3);
    // And today's copy of a spanning event is Today's own row, not deduped away.
    const t = today(okWindow([trip(TODAY), trip("2026-09-11")]));
    expect(t.scheduled.kind === "rows" && t.scheduled.rows.map((r) => r.id)).toEqual(["trip"]);
  });

  it("an overdue or today to-do is not in the week", () => {
    const v = week(okWindow([]), open([todo({ dueOn: TODAY }), todo({ dueOn: "2026-09-01" }), todo({ dueOn: "2026-09-18" })]));
    expect(v.days!.every((d) => dayShape(d).kind === "dash")).toBe(true);
  });
});

// ---------------------------------------------------------------- To-do ----

describe("buildTodoTileView", () => {
  it("empty store: 0 open, three sections always present in order, each empty", () => {
    const v = buildTodoTileView({ now: NOW, todos: open([]) });
    expect(v.count).toBe(0);
    expect(v.sections?.map((s) => [s.key, s.label, s.rows.length, s.bound])).toEqual([
      ["personal", "Personal", 0, null],
      ["freelance", "Freelance", 0, null],
      ["academics", "Academics", 0, null],
    ]);
    expect(v.fail).toBeNull();
  });

  it("unreadable: no count, no sections, one dotted sentence", () => {
    const v = buildTodoTileView({ now: NOW, todos: "unavailable" });
    expect(v).toEqual({ count: null, sections: null, fail: { text: "Couldn't load to-dos.", dot: "stale" } });
  });

  it("`0 open` above a failed read is unrepresentable in the type (R21)", () => {
    // @ts-expect-error — a count beside a failed read does not type-check.
    const bad: TodoTileView = { count: 0, sections: null, fail: { text: "Couldn't load to-dos.", dot: "stale" } };
    expect(bad).toBeDefined();
  });

  it("orders overdue-first, then by date, then undated oldest-first; chips from the deck", () => {
    const rows = [
      todo({ title: "Undated old", createdAt: new Date("2026-08-01T00:00:00Z") }),
      todo({ title: "Fri", dueOn: "2026-09-11" }),
      todo({ title: "Late", dueOn: "2026-09-07", calendarEventId: "g" }),
      todo({ title: "Undated new", createdAt: new Date("2026-09-09T00:00:00Z") }),
      todo({ title: "Far", dueOn: "2026-09-24" }),
    ];
    const v = buildTodoTileView({ now: NOW, todos: open(rows) });
    expect(v.count).toBe(5);
    const personal = v.sections![0].rows;
    expect(personal.map((r) => [r.title, r.due?.text ?? null, r.onCalendar])).toEqual([
      ["Late", "3 days late", true],
      ["Fri", "tomorrow", false],
      ["Far", "24 Sep", false],
      ["Undated old", null, false],
      ["Undated new", null, false],
    ]);
  });

  it("20 per section, then Showing 20 of 34.", () => {
    const rows = [
      ...Array.from({ length: 34 }, () => todo({ section: "freelance" })),
      todo({ section: "academics" }),
    ];
    const v = buildTodoTileView({ now: NOW, todos: open(rows) });
    expect(v.count).toBe(35);
    expect(v.sections![1].rows).toHaveLength(20);
    expect(v.sections![1].bound).toBe("Showing 20 of 34.");
    expect(v.sections![2].bound).toBeNull();
  });

  it("the header count is the store's total", () => {
    const v = buildTodoTileView({
      now: NOW,
      todos: { rows: [todo()], total: 1, sectionTotals: { personal: 1, freelance: 0, academics: 0 } },
    });
    expect(v.count).toBe(1);
  });

  it("a capped read never undercounts: bounds and header come from the store's counts", () => {
    // The read stopped at 25 rows; the store holds 34 freelance and 12 personal.
    const rows = [
      ...Array.from({ length: 22 }, () => todo({ section: "freelance" })),
      ...Array.from({ length: 3 }, () => todo({ section: "personal" })),
    ];
    const v = buildTodoTileView({
      now: NOW,
      todos: { rows, total: 46, sectionTotals: { personal: 12, freelance: 34, academics: 0 } },
    });
    expect(v.count).toBe(46);
    expect(v.sections![0].rows).toHaveLength(3);
    expect(v.sections![0].bound).toBe("Showing 3 of 12.");
    expect(v.sections![1].rows).toHaveLength(20);
    expect(v.sections![1].bound).toBe("Showing 20 of 34.");
    expect(v.sections![2].bound).toBeNull();
  });
});

// ----------------------------------------------------------------- Done ----

function done(over: Partial<DoneTodoInput> = {}): DoneTodoInput {
  seq += 1;
  return {
    id: `d${seq}`,
    title: `Done ${seq}`,
    section: "personal",
    doneAt: new Date("2026-09-08T03:00:00Z"),
    calendarEventId: null,
    ...over,
  };
}

describe("buildDoneView", () => {
  it("absent count at zero, no rows, no fail", () => {
    expect(buildDoneView({ done: { rows: [], total: 0 } })).toEqual({ count: null, rows: [], bound: null, fail: null });
  });

  it("rows most recent first, with section label and Mon 8 in Manila", () => {
    const v = buildDoneView({
      done: {
        rows: [
          done({ title: "Renew ID", doneAt: new Date("2026-09-07T17:00:00Z") }), // Tue 8 Sep 01:00 Manila
          done({ title: "Send invoice", section: "freelance", doneAt: new Date("2026-09-09T02:00:00Z") }),
        ],
        total: 2,
      },
    });
    expect(v.count).toBe(2);
    expect(v.rows.map((r) => [r.title, r.sectionLabel, r.dayLabel, r.note])).toEqual([
      ["Send invoice", "Freelance", "Wed 9", null],
      ["Renew ID", "Personal", "Tue 8", null],
    ]);
  });

  it("the in-flight state has a surface: entry left on Google", () => {
    const v = buildDoneView({ done: { rows: [done({ calendarEventId: "g" })], total: 1 } });
    expect(v.rows[0].note).toBe("entry left on Google");
  });

  it("20, then Showing 20 of 31.", () => {
    const v = buildDoneView({ done: { rows: Array.from({ length: 20 }, () => done()), total: 31 } });
    expect(v.rows).toHaveLength(20);
    expect(v.bound).toBe("Showing 20 of 31.");
    expect(v.count).toBe(31);
  });

  it("unreadable: no count, dotted sentence", () => {
    expect(buildDoneView({ done: "unavailable" })).toEqual({
      count: null,
      rows: [],
      bound: null,
      fail: { text: "Couldn't load to-dos.", dot: "stale" },
    });
  });
});

// ----------------------------------------------------------------- Push ----

const TODAY_PUSH = { sentAt: new Date("2026-09-09T23:00:12Z"), title: "All clear · 0 to review", body: "All clear.", devices: 2 };
const OLD_PUSH = { sentAt: new Date("2026-08-08T23:00:00Z"), title: "Old", body: "Old body", devices: 1 };
const AFTER_SEVEN = new Date("2026-09-10T02:00:00Z"); // 10:00 Manila
const BEFORE_SEVEN = new Date("2026-09-09T16:30:00Z"); // 00:30 Manila, Thu 10

function push(over: Partial<PushInput>) {
  return buildPushTileView({ now: AFTER_SEVEN, digest: null, dispatcher: null, monitoringEnabled: true, ...over });
}

describe("buildPushTileView", () => {
  it("quote: today's stored push, stamped with sentAt in Manila", () => {
    expect(push({ digest: TODAY_PUSH })).toEqual({
      kind: "quote",
      stamp: "sent 07:00",
      title: "All clear · 0 to review",
      body: "All clear.",
      last: null,
      line: null,
    });
  });

  it("went out, text not stored: no dot", () => {
    const v = push({ digest: OLD_PUSH, dispatcher: { ok: true, startedAt: new Date("2026-09-09T23:00:00Z"), skipped: false } });
    expect(v.kind).toBe("went-out-unstored");
    expect(v.line).toEqual({ text: "A push went out this morning. Its text wasn't stored.", dot: null });
    expect(v.stamp).toBeNull();
  });

  it("no push this morning, past 07:00: the missing dot, and Last: beneath", () => {
    const v = push({ digest: OLD_PUSH, dispatcher: { ok: true, startedAt: new Date("2026-08-08T23:00:00Z"), skipped: false } });
    expect(v.kind).toBe("no-push-today");
    expect(v.line).toEqual({ text: "No push this morning.", dot: "missing" });
    expect(v.last).toEqual({ stamp: "Last: Sun 9 Aug 07:00", title: "Old", body: "Old body" });
    expect(v.stamp).toBeNull();
  });

  it("no push this morning, before 07:00: undotted", () => {
    const v = push({ now: BEFORE_SEVEN, digest: OLD_PUSH });
    expect(v.kind).toBe("no-push-today");
    expect(v.line).toEqual({ text: "No push this morning.", dot: null });
  });

  it("a failed dispatcher run today is not a push that went out", () => {
    const v = push({ digest: OLD_PUSH, dispatcher: { ok: false, startedAt: new Date("2026-09-09T23:00:00Z"), skipped: false } });
    expect(v.kind).toBe("no-push-today");
  });

  it("never stored: No push recorded yet.", () => {
    const v = push({});
    expect(v.kind).toBe("never");
    expect(v.line).toEqual({ text: "No push recorded yet.", dot: null });
  });

  it("monitoring off: its sentence, undotted", () => {
    const v = push({ digest: OLD_PUSH, monitoringEnabled: false });
    expect(v.kind).toBe("monitoring-off");
    expect(v.line).toEqual({ text: "Monitoring is off, so no push goes out.", dot: null });
  });

  it("monitoring off loses to a push stored for today", () => {
    expect(push({ digest: TODAY_PUSH, monitoringEnabled: false }).kind).toBe("quote");
  });

  it("unreadable digest: Couldn't load this morning's push.", () => {
    const v = push({ digest: "unavailable" });
    expect(v).toMatchObject({ kind: "fail", line: { text: "Couldn't load this morning's push.", dot: "stale" }, stamp: null });
  });

  it("an unreadable run cannot tell no-push from unstored, so it fails rather than guess", () => {
    expect(push({ digest: OLD_PUSH, dispatcher: "unavailable" }).kind).toBe("fail");
    expect(push({ digest: TODAY_PUSH, dispatcher: "unavailable" }).kind).toBe("quote");
  });

  describe("a skipped run is not a push (monitoring off still writes an ok dispatcher row)", () => {
    const skippedToday = { ok: true, startedAt: new Date("2026-09-09T23:00:00Z"), skipped: true };

    it("old digest + monitoring off + a skipped run today → monitoring-off, not went-out", () => {
      const v = push({ digest: OLD_PUSH, monitoringEnabled: false, dispatcher: skippedToday });
      expect(v.kind).toBe("monitoring-off");
      expect(v.line).toEqual({ text: "Monitoring is off, so no push goes out.", dot: null });
    });

    it("monitoring back on, today's run was skipped, no digest today → no-push-today, not went-out", () => {
      const v = push({ digest: OLD_PUSH, monitoringEnabled: true, dispatcher: skippedToday });
      expect(v.kind).toBe("no-push-today");
      expect(v.line).toEqual({ text: "No push this morning.", dot: "missing" });
    });

    it("a skipped run with no digest ever reads as never, not as a failure", () => {
      expect(push({ digest: null, monitoringEnabled: true, dispatcher: skippedToday }).kind).toBe("never");
    });
  });

  describe("the 07:00 boundary in Manila (deck §15)", () => {
    it("06:59 stands undotted", () => {
      const v = push({ now: new Date("2026-09-09T22:59:00Z"), digest: OLD_PUSH });
      expect(v.line).toEqual({ text: "No push this morning.", dot: null });
    });
    it("07:00 takes the missing dot", () => {
      const v = push({ now: new Date("2026-09-09T23:00:00Z"), digest: OLD_PUSH });
      expect(v.line).toEqual({ text: "No push this morning.", dot: "missing" });
    });
  });
});

// ------------------------------------------------ A capped open read ----

describe("a capped open read never says nothing due", () => {
  // Rows ordered by dueOn ascending, undated last (the OpenTodosFeed contract).
  const capped = (rows: OpenTodoInput[], total: number): OpenTodosFeed => ({
    rows,
    total,
    sectionTotals: { personal: total, freelance: 0, academics: 0 },
  });

  it("the cap fell inside the window (last row due by today+7): DUE, the tint and the week read as unreadable", () => {
    const feed = capped([todo({ dueOn: "2026-09-12" }), todo({ dueOn: "2026-09-15" })], 9);
    const t = today(okWindow([]), feed);
    expect(t.due).toEqual({ kind: "fail", line: { text: "Couldn't load to-dos.", dot: "stale" } });
    expect(t.heroTint).toBeNull();
    expect(t.spread).toBe(false);
    const w = week(okWindow([]), feed);
    expect(w.fails).toEqual([{ text: "Couldn't load to-dos.", dot: "stale" }]);
    expect(w.days!.some((d) => dayShape(d).kind === "dash")).toBe(false);
  });

  it("the cap fell at exactly today+7: still unreadable", () => {
    const feed = capped([todo({ dueOn: "2026-09-17" })], 3);
    expect(today(okWindow([]), feed).heroTint).toBeNull();
  });

  it("the cap fell beyond today+7: nothing in the window was dropped, render normally", () => {
    const feed = capped([todo({ dueOn: TODAY }), todo({ dueOn: "2026-09-18" })], 9);
    const t = today(okWindow([]), feed);
    expect(t.heroTint).toBe(1);
    expect(t.due.kind).toBe("rows");
    const w = week(okWindow([]), feed);
    expect(w.fails).toEqual([]);
    expect(w.days!.every((d) => dayShape(d).kind === "dash")).toBe(true);
  });

  it("the cap fell among undated rows: every dated row is in hand, render normally", () => {
    const feed = capped([todo({ dueOn: "2026-09-11" }), todo({ dueOn: null })], 9);
    expect(today(okWindow([]), feed)).toMatchObject({ due: { kind: "empty" }, heroTint: 0, spread: true });
  });

  it("the To-do tile is not affected: its bounds count from the store", () => {
    const feed = capped([todo({ dueOn: "2026-09-12" })], 9);
    const v = buildTodoTileView({ now: NOW, todos: feed });
    expect(v.count).toBe(9);
    expect(v.sections![0].bound).toBe("Showing 1 of 9.");
  });
});

// --------------------------------------------------------------- Layers ----

describe("buildLayersView", () => {
  it("switches in stored order", () => {
    const v = buildLayersView({ calendar: okWindow([]) });
    expect(v).toEqual({
      kind: "switches",
      rows: [
        { calendarId: "primary", name: "Personal", enabled: true, note: null },
        { calendarId: "classes@g", name: "Classes", enabled: true, note: null },
        { calendarId: "events@g", name: "Events", enabled: false, note: null },
      ],
      line: null,
    });
  });

  it("switches stay live on a read failure", () => {
    expect(buildLayersView({ calendar: okWindow([], ["Classes"]) }).kind).toBe("switches");
    expect(
      buildLayersView({ calendar: { layers: LAYERS, window: { ok: false, reason: "timeout" }, calendars: null } }).kind,
    ).toBe("switches");
  });

  it("a vanished layer keeps its row and carries the sentence (R42)", () => {
    const calendars: CalendarListEntry[] = [
      { calendarId: "primary", name: "Personal", primary: true },
      { calendarId: "events@g", name: "Events", primary: false },
    ];
    const v = buildLayersView({ calendar: { layers: LAYERS, window: { ok: true, events: [], failed: ["Classes"] }, calendars } });
    expect(v.rows[1].note).toBe("Classes is no longer on your Google account. Untick it in Settings.");
    expect(v.rows[0].note).toBeNull();
  });

  it("not-configured / expired: Tile 1's sentence and no switches", () => {
    const nc = buildLayersView({ calendar: { layers: LAYERS, window: { ok: false, reason: "not-configured" }, calendars: null } });
    expect(nc).toEqual({
      kind: "sentence",
      rows: [],
      line: { text: "Google isn't connected yet. Set it up in Settings.", dot: null },
    });
    const ex = buildLayersView({ calendar: { layers: LAYERS, window: { ok: false, reason: "expired" }, calendars: null } });
    expect(ex.line).toEqual({ text: "Google access has expired. Renew it from Settings.", dot: "stale" });
    expect(ex.rows).toEqual([]);
  });

  it("no calendars chosen", () => {
    const v = buildLayersView({ calendar: { layers: [], window: { ok: false, reason: "none-enabled" }, calendars: null } });
    expect(v).toEqual({ kind: "sentence", rows: [], line: { text: "No calendars chosen. Pick them in Settings.", dot: null } });
  });

  it("all switched off still shows the switches", () => {
    const off = LAYERS.map((l) => ({ ...l, enabled: false }));
    const v = buildLayersView({ calendar: { layers: off, window: { ok: false, reason: "none-enabled" }, calendars: null } });
    expect(v.kind).toBe("switches");
    expect(v.rows.every((r) => !r.enabled)).toBe(true);
  });

  it("layers unreadable", () => {
    expect(buildLayersView({ calendar: "layers-unavailable" })).toEqual({
      kind: "fail",
      rows: [],
      line: { text: "Couldn't load layers.", dot: "stale" },
    });
  });
});

describe("lateness leaves the view model in its long form only", () => {
  it("only the long form", () => {
    const v = buildTodoTileView({ now: NOW, todos: open([todo({ dueOn: "2026-09-09" }), todo({ dueOn: "2026-09-01" })]) });
    const texts = v.sections![0].rows.map((r) => r.due?.text);
    expect(texts).toEqual(["9 days late", "1 day late"]);
  });
});
