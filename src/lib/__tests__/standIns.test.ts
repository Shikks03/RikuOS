/**
 * standIns.test.ts — an add's faded stand-in (smooth-feel spec §4, plan
 * deviations 3, 5, 6): in flight until the door answers, then settled or
 * dropped; a server render removes only settled ones; each tile finds only
 * the stand-ins that belong in it.
 */
import { describe, it, expect } from "vitest";
import {
  afterServerRender,
  dropStandIn,
  nextStandInKey,
  putStandIn,
  settleStandIn,
  standInTime,
  standInsAt,
  type EventStandIn,
  type StandIn,
  type TodoStandIn,
} from "@/lib/standIns";

const todo = (over: Partial<TodoStandIn> = {}): TodoStandIn => ({
  kind: "todo",
  key: "standin:t",
  title: "Renew ID",
  section: "personal",
  dueOn: null,
  due: null,
  mark: "saving",
  inFlight: true,
  ...over,
});

const event = (over: Partial<EventStandIn> = {}): EventStandIn => ({
  kind: "event",
  key: "standin:e",
  title: "Dentist",
  calendarName: "Personal",
  dayKey: "2026-10-11",
  allDay: false,
  start: "09:00",
  end: "10:00",
  mark: "saving",
  inFlight: true,
  ...over,
});

describe("the lifecycle", () => {
  it("put adds, and a second put with the same key replaces", () => {
    const a = putStandIn([], todo());
    expect(a).toHaveLength(1);
    expect(putStandIn(a, todo({ title: "Other" }))).toEqual([todo({ title: "Other" })]);
  });

  it("settle marks it and takes it out of flight", () => {
    const [s] = settleStandIn([todo()], "standin:t", "unknown");
    expect(s).toMatchObject({ mark: "unknown", inFlight: false });
  });

  it("settle and drop of an unknown key return the same list", () => {
    const list: readonly StandIn[] = [todo()];
    expect(settleStandIn(list, "nope", "saving")).toBe(list);
    expect(dropStandIn(list, "nope")).toBe(list);
  });

  it("drop removes it", () => {
    expect(dropStandIn([todo(), event()], "standin:t")).toEqual([event()]);
  });

  it("a server render removes settled stand-ins and keeps in-flight ones", () => {
    const settled = todo({ inFlight: false });
    expect(afterServerRender([settled, event()])).toEqual([event()]);
  });

  it("a server render with nothing settled returns the same list", () => {
    const list: readonly StandIn[] = [todo(), event()];
    expect(afterServerRender(list)).toBe(list);
  });

  it("keys are unique", () => {
    expect(nextStandInKey()).not.toBe(nextStandInKey());
  });
});

describe("standInsAt", () => {
  const today = "2026-10-11";
  const list: StandIn[] = [
    todo({ key: "a", section: "academics", dueOn: "2026-10-11" }),
    todo({ key: "b", section: "personal", dueOn: "2026-10-09" }),
    todo({ key: "c", section: "personal", dueOn: "2026-10-14" }),
    todo({ key: "d", section: "freelance", dueOn: null }),
    event({ key: "e", dayKey: "2026-10-11" }),
    event({ key: "f", dayKey: "2026-10-14" }),
  ];
  const keys = (s: StandIn[]) => s.map((x) => x.key);

  it("the To-do tile: its section's to-dos, dated or not", () => {
    expect(keys(standInsAt(list, { tile: "todos", section: "personal" }))).toEqual(["b", "c"]);
    expect(keys(standInsAt(list, { tile: "todos", section: "freelance" }))).toEqual(["d"]);
  });

  it("Today's DUE group: to-dos due today or earlier", () => {
    expect(keys(standInsAt(list, { tile: "today", group: "due", today }))).toEqual(["a", "b"]);
  });

  it("Today's SCHEDULED group: events on today", () => {
    expect(keys(standInsAt(list, { tile: "today", group: "scheduled", today }))).toEqual(["e"]);
  });

  it("a week day: to-dos due and events on that day", () => {
    expect(keys(standInsAt(list, { tile: "week", day: "2026-10-14" }))).toEqual(["c", "f"]);
  });
});

describe("standInTime", () => {
  it("a Today row shows the range, a week item the start", () => {
    expect(standInTime(event(), "row")).toBe("09:00–10:00");
    expect(standInTime(event(), "item")).toBe("09:00");
  });
  it("all day either way", () => {
    expect(standInTime(event({ allDay: true }), "row")).toBe("all day");
    expect(standInTime(event({ allDay: true }), "item")).toBe("all day");
  });
});
