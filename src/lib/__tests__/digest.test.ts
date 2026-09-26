import { describe, it, expect } from "vitest";
import {
  calendarForDigest,
  composeDigest,
  composeTodayLine,
  todosForDigest,
  type DigestTodayInput,
} from "@/lib/digest";
import { buildPushPayload } from "@/lib/push";
import type { CalendarEvent } from "@/lib/google";

const QUIET: DigestTodayInput = { events: [], missedLayers: [], due: [], overdue: [] };

const base = {
  pending: 0,
  attention: { repliedUnanswered: 0, overdue: 0 },
  problems: [] as string[],
  offAgents: [] as string[],
  today: QUIET,
};

describe("composeDigest", () => {
  it("says all clear when nothing is wrong", () => {
    const digest = composeDigest({ ...base, pending: 2 });
    expect(digest.title).toContain("All clear");
    expect(digest.title).toContain("2");
    expect(digest.body).toContain("All clear");
  });

  it("leads the title with the problem count", () => {
    const digest = composeDigest({ ...base, problems: ["chaser failed", "Meowchi unreachable"] });
    expect(digest.title).toContain("2 problems");
  });

  it("puts problems first in the body so truncation cannot eat them", () => {
    const digest = composeDigest({
      ...base,
      pending: 5,
      attention: { repliedUnanswered: 3, overdue: 1 },
      problems: ["Meowchi unreachable"],
    });
    expect(digest.body.indexOf("Meowchi unreachable")).toBe(0);
  });

  it("reports the pipeline as unavailable rather than as zero", () => {
    const digest = composeDigest({ ...base, attention: null });
    expect(digest.body).toContain("unavailable");
    expect(digest.body).not.toContain("0 waiting");
  });

  it("names agents that are switched off", () => {
    const digest = composeDigest({ ...base, offAgents: ["chaser"] });
    expect(digest.body).toContain("Off: chaser");
  });

  it("says nothing about off agents when none are off", () => {
    expect(composeDigest(base).body).not.toContain("Off:");
  });

  it("uses singular wording for one problem", () => {
    const digest = composeDigest({ ...base, problems: ["chaser failed"] });
    expect(digest.title).toContain("1 problem");
    expect(digest.title).not.toContain("problems");
  });

  it("counts an unreachable pipeline as a problem instead of saying all clear", () => {
    const digest = composeDigest({ ...base, pending: 5, attention: null });
    expect(digest.title).toContain("1 problem");
    expect(digest.title).not.toContain("All clear");
    expect(digest.body).not.toContain("All clear");
  });

  it("adds the pipeline failure to problems that already exist", () => {
    const digest = composeDigest({
      ...base,
      attention: null,
      problems: ["Meowchi unreachable"],
    });
    expect(digest.title).toContain("2 problems");
    expect(digest.body).toContain("Meowchi unreachable");
    expect(digest.body).toContain("unavailable");
  });

  it("states the attention line exactly, so the two counts cannot be swapped", () => {
    const digest = composeDigest({
      ...base,
      attention: { repliedUnanswered: 3, overdue: 1 },
    });
    expect(digest.body).toContain("3 waiting on you, 1 overdue.");
  });

  it("caps one long problem so it cannot evict the findings behind it", () => {
    const long = `expiry sweep failed: ${"x".repeat(300)}`;
    const digest = composeDigest({
      ...base,
      problems: [long, "Meowchi unreachable"],
    });
    expect(digest.body).toContain("Meowchi unreachable");
    expect(digest.body.length).toBeLessThanOrEqual(320);
  });

  it("ends the problems line once, without doubling a period or an ellipsis", () => {
    expect(composeDigest({ ...base, problems: ["Meowchi unreachable"] }).body).toContain(
      "Meowchi unreachable. "
    );
    expect(composeDigest({ ...base, problems: ["sweep failed."] }).body).not.toContain("..");
    const truncated = composeDigest({
      ...base,
      problems: [`expiry sweep failed: ${"x".repeat(300)}`],
    }).body;
    expect(truncated).toContain("…");
    expect(truncated).not.toContain("….");
  });
});

// --- The Today sentence (deck §10, §15) -------------------------------------

const FULL: DigestTodayInput = {
  events: [
    { title: "Math Methods", time: "09:00" },
    { title: "Meeting", time: "13:00" },
  ],
  missedLayers: [],
  due: [
    { title: "Pay tuition", dayLabel: "today" },
    { title: "Reviewer ch.3", dayLabel: "Fri" },
  ],
  overdue: [{ title: "Send invoice", daysLate: 3 }],
};

describe("composeTodayLine", () => {
  it("writes deck §10's full form exactly", () => {
    expect(composeTodayLine(FULL)).toBe(
      "Today: Math Methods 09:00, Meeting 13:00. Due: Pay tuition (today), Reviewer ch.3 (Fri). Overdue: Send invoice (3d)."
    );
  });

  it("says the quiet morning out loud (D6)", () => {
    expect(composeTodayLine(QUIET)).toBe("Today: nothing scheduled, nothing due.");
  });

  it("names an unreadable calendar and keeps the parts that did arrive", () => {
    expect(
      composeTodayLine({ ...QUIET, events: "unavailable", due: [{ title: "Pay tuition", dayLabel: "today" }] })
    ).toBe("Today: calendar unavailable. Due: Pay tuition (today).");
    expect(composeTodayLine({ ...QUIET, events: "unavailable" })).toBe("Today: calendar unavailable.");
  });

  it("names what arrived, then the calendar that was not read (R23)", () => {
    expect(
      composeTodayLine({ ...QUIET, events: [{ title: "Math Methods", time: "09:00" }], missedLayers: ["Classes"] })
    ).toBe("Today: Math Methods 09:00. Classes wasn't read.");
  });

  it("names two or more missed layers in the plural", () => {
    expect(
      composeTodayLine({
        ...QUIET,
        events: [{ title: "Math Methods", time: "09:00" }],
        missedLayers: ["Classes", "Events"],
      })
    ).toBe("Today: Math Methods 09:00. Classes and Events weren't read.");
    expect(
      composeTodayLine({
        ...QUIET,
        events: [{ title: "Gym", time: "06:00" }],
        missedLayers: ["A", "B", "C", "D"],
      })
    ).toBe("Today: Gym 06:00. A, B, C and 1 more weren't read.");
  });

  it("never says nothing scheduled over a layer that was not read", () => {
    const line = composeTodayLine({ ...QUIET, missedLayers: ["Classes"] });
    expect(line).toBe("Today: Classes wasn't read.");
    expect(line).not.toContain("nothing");
  });

  it("says every layer is off, and still names what is due", () => {
    expect(composeTodayLine({ ...QUIET, events: "none-enabled" })).toBe("Today: no layers switched on.");
    expect(
      composeTodayLine({ ...QUIET, events: "none-enabled", overdue: [{ title: "Send invoice", daysLate: 1 }] })
    ).toBe("Today: no layers switched on. Overdue: Send invoice (1d).");
  });

  it("omits Overdue under a failed to-do read, covered by Due: to-dos unavailable.", () => {
    const line = composeTodayLine({
      ...QUIET,
      events: [{ title: "Meeting", time: "13:00" }],
      due: "unavailable",
      overdue: [{ title: "Send invoice", daysLate: 3 }],
    });
    expect(line).toBe("Today: Meeting 13:00. Due: to-dos unavailable.");
    expect(line).not.toContain("Overdue");
  });

  it("omits absent parts rather than saying none", () => {
    expect(composeTodayLine({ ...QUIET, due: [{ title: "Renew ID", dayLabel: "tomorrow" }] })).toBe(
      "Due: Renew ID (tomorrow)."
    );
  });

  it("writes an all-day event as (all day)", () => {
    expect(composeTodayLine({ ...QUIET, events: [{ title: "Baguio trip", time: null }] })).toBe(
      "Today: Baguio trip (all day)."
    );
  });

  it("names up to 3 per part, then +N more, singular +1 more", () => {
    const ev = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `E${i + 1}`, time: "10:00" }));
    expect(composeTodayLine({ ...QUIET, events: ev(3) })).toBe("Today: E1 10:00, E2 10:00, E3 10:00.");
    expect(composeTodayLine({ ...QUIET, events: ev(4) })).toBe("Today: E1 10:00, E2 10:00, E3 10:00, +1 more.");
    expect(composeTodayLine({ ...QUIET, events: ev(5) })).toBe("Today: E1 10:00, E2 10:00, E3 10:00, +2 more.");
    const late = Array.from({ length: 5 }, (_, i) => ({ title: `T${i + 1}`, daysLate: 5 - i }));
    expect(composeTodayLine({ ...QUIET, overdue: late })).toBe("Overdue: T1 (5d), T2 (4d), T3 (3d), +2 more.");
  });
});

describe("composeDigest's Today sentence", () => {
  it("places it second: after the problems, before the freelance line (D12)", () => {
    const body = composeDigest({
      ...base,
      problems: ["Meowchi unreachable"],
      offAgents: ["chaser"],
      today: FULL,
    }).body;
    const problemsAt = body.indexOf("Meowchi unreachable.");
    const todayAt = body.indexOf("Today: Math Methods");
    const freelanceAt = body.indexOf("0 waiting on you");
    expect(problemsAt).toBe(0);
    expect(todayAt).toBeGreaterThan(problemsAt);
    expect(freelanceAt).toBeGreaterThan(todayAt);
    expect(body.indexOf("Off: chaser")).toBeGreaterThan(freelanceAt);
  });

  it("renders deck §10's all-clear forms exactly", () => {
    expect(composeDigest({ ...base, today: FULL }).body).toBe(
      "All clear. Today: Math Methods 09:00, Meeting 13:00. Due: Pay tuition (today), Reviewer ch.3 (Fri). Overdue: Send invoice (3d). 0 waiting on you, 0 overdue."
    );
    expect(composeDigest(base).body).toBe(
      "All clear. Today: nothing scheduled, nothing due. 0 waiting on you, 0 overdue."
    );
  });

  it("renders deck §10's unavailable-calendar example exactly, counted in the title", () => {
    const digest = composeDigest({
      ...base,
      today: { ...QUIET, events: "unavailable", due: [{ title: "Pay tuition", dayLabel: "today" }] },
    });
    expect(digest.title).toBe("1 problem · 0 to review");
    expect(digest.body).toBe(
      "Calendar check unavailable. Today: calendar unavailable. Due: Pay tuition (today). 0 waiting on you, 0 overdue."
    );
  });

  it("counts a failed to-do read as a problem", () => {
    const digest = composeDigest({ ...base, today: { ...QUIET, due: "unavailable" } });
    expect(digest.title).toBe("1 problem · 0 to review");
    expect(digest.body).toBe("To-do check unavailable. Due: to-dos unavailable. 0 waiting on you, 0 overdue.");
  });

  it("counts a partial calendar read, so the title never says all clear over a blind spot (R23)", () => {
    const digest = composeDigest({
      ...base,
      today: { ...QUIET, events: [{ title: "Math Methods", time: "09:00" }], missedLayers: ["Classes"] },
    });
    expect(digest.title).toBe("1 problem · 0 to review");
    expect(digest.body).toBe(
      "Calendar check incomplete. Today: Math Methods 09:00. Classes wasn't read. 0 waiting on you, 0 overdue."
    );
  });

  it("does not count every layer switched off as a problem (deck §15)", () => {
    const digest = composeDigest({ ...base, today: { ...QUIET, events: "none-enabled" } });
    expect(digest.title).toBe("All clear · 0 to review");
    expect(digest.body).toBe("All clear. Today: no layers switched on. 0 waiting on you, 0 overdue.");
  });

  it("adds every unavailable check to the title's count", () => {
    const digest = composeDigest({
      ...base,
      attention: null,
      problems: ["Meowchi unreachable"],
      today: { ...QUIET, events: "unavailable", due: "unavailable" },
    });
    expect(digest.title).toBe("4 problems · 0 to review");
    expect(digest.body).toBe(
      "Meowchi unreachable; pipeline check unavailable; calendar check unavailable; to-do check unavailable. " +
        "Today: calendar unavailable. Due: to-dos unavailable."
    );
  });

  it("keeps fragments lowercase with no stop, and capitalises only the rendered line (R23)", () => {
    const digest = composeDigest({ ...base, attention: null, today: { ...QUIET, events: "unavailable" } });
    expect(digest.body.startsWith("Pipeline check unavailable; calendar check unavailable. ")).toBe(true);
    expect(digest.body).not.toContain("..");
  });

  it("keeps the freelance line on a heavy morning inside the 320 bound", () => {
    const long = (n: number) => Array.from({ length: n }, (_, i) => `A fairly long to-do title ${i + 1}`);
    const digest = composeDigest({
      ...base,
      attention: { repliedUnanswered: 2, overdue: 1 },
      problems: ["Meowchi unreachable"],
      today: {
        events: long(5).map((title) => ({ title, time: "09:00" })),
        missedLayers: [],
        due: long(5).map((title) => ({ title, dayLabel: "tomorrow" })),
        overdue: [],
      },
    });
    expect(digest.body.length).toBeGreaterThan(200);
    expect(buildPushPayload(digest.title, digest.body).body).toContain("2 waiting on you, 1 overdue.");
  });

  it("never produces an empty title or body - LastDigest requires both", () => {
    const forms: DigestTodayInput[] = [
      QUIET,
      FULL,
      { ...QUIET, events: "unavailable", due: "unavailable" },
      { ...QUIET, events: "none-enabled" },
    ];
    for (const today of forms) {
      for (const attention of [null, { repliedUnanswered: 0, overdue: 0 }]) {
        const digest = composeDigest({ ...base, attention, today });
        const payload = buildPushPayload(digest.title, digest.body);
        expect(payload.body.length).toBeGreaterThan(0);
        expect(payload.title.length).toBeGreaterThan(0);
      }
    }
  });
});

// --- The adapters ------------------------------------------------------------

const TODAY = "2026-09-10"; // a Thursday

function event(over: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "e",
    title: "Event",
    layerName: "Personal",
    allDay: false,
    startsAt: null,
    endsAt: null,
    dayKey: TODAY,
    htmlLink: "",
    ...over,
  };
}

describe("calendarForDigest", () => {
  it("maps none-enabled to the no-layers form, not to unavailable", () => {
    expect(calendarForDigest({ ok: false, reason: "none-enabled" }, 0, TODAY)).toEqual({
      events: "none-enabled",
      missedLayers: [],
    });
  });

  it("maps every other failed window to unavailable", () => {
    for (const reason of ["not-configured", "expired", "timeout"] as const) {
      expect(calendarForDigest({ ok: false, reason }, 2, TODAY).events).toBe("unavailable");
    }
  });

  it("treats a window where every enabled layer failed as unavailable, not partial", () => {
    expect(calendarForDigest({ ok: true, events: [], failed: ["Personal", "Classes"] }, 2, TODAY)).toEqual({
      events: "unavailable",
      missedLayers: [],
    });
  });

  it("carries the missed layer names when some answered", () => {
    expect(calendarForDigest({ ok: true, events: [], failed: ["Classes"] }, 2, TODAY)).toEqual({
      events: [],
      missedLayers: ["Classes"],
    });
  });

  it("writes times in APP_TZ as HH:MM, all-day as null, and keeps only today's events", () => {
    const window = {
      ok: true as const,
      failed: [],
      events: [
        event({ title: "Baguio trip", allDay: true }),
        // 01:00Z is 09:00 in Manila; 05:30Z is 13:30.
        event({ title: "Math Methods", startsAt: new Date("2026-09-10T01:00:00Z") }),
        event({ title: "Meeting", startsAt: new Date("2026-09-10T05:30:00Z") }),
        // 15:00Z on the 9th is 23:00 on the 9th in Manila: its own day.
        event({ title: "Yesterday", startsAt: new Date("2026-09-09T15:00:00Z"), dayKey: "2026-09-09" }),
        // 16:05Z on the 9th is 00:05 on the 10th in Manila.
        event({ title: "Midnight", startsAt: new Date("2026-09-09T16:05:00Z") }),
      ],
    };
    expect(calendarForDigest(window, 1, TODAY).events).toEqual([
      { title: "Baguio trip", time: null },
      { title: "Math Methods", time: "09:00" },
      { title: "Meeting", time: "13:30" },
      { title: "Midnight", time: "00:05" },
    ]);
  });
});

describe("todosForDigest", () => {
  const at = (key: string) => new Date(`${key}T00:00:00Z`);
  const created = new Date("2026-09-01T00:00:00Z");

  it("splits overdue from due, labels the days, and drops what is out of the window", () => {
    const result = todosForDigest(
      [
        { title: "Undated", dueOn: null, createdAt: created },
        { title: "Next week", dueOn: at("2026-09-14"), createdAt: created },
        { title: "Sunday", dueOn: at("2026-09-13"), createdAt: created },
        { title: "Friday", dueOn: at("2026-09-11"), createdAt: created },
        { title: "Pay tuition", dueOn: at("2026-09-10"), createdAt: created },
        { title: "Yesterday", dueOn: at("2026-09-09"), createdAt: created },
        { title: "Send invoice", dueOn: at("2026-09-07"), createdAt: created },
      ],
      TODAY,
      { due: 3, overdue: 2 }
    );
    expect(result.overdue).toEqual([
      { title: "Send invoice", daysLate: 3 },
      { title: "Yesterday", daysLate: 1 },
    ]);
    expect(result.due).toEqual([
      { title: "Pay tuition", dayLabel: "today" },
      { title: "Friday", dayLabel: "tomorrow" },
      { title: "Sunday", dayLabel: "Sun" },
    ]);
  });

  it("orders same-day to-dos oldest first", () => {
    const result = todosForDigest(
      [
        { title: "Newer", dueOn: at(TODAY), createdAt: new Date("2026-09-05T00:00:00Z") },
        { title: "Older", dueOn: at(TODAY), createdAt: new Date("2026-09-02T00:00:00Z") },
      ],
      TODAY,
      { due: 2, overdue: 0 }
    );
    expect(result.due.map((d) => d.title)).toEqual(["Older", "Newer"]);
  });

  it("counts +N more from the store, not the bounded read: 60 overdue, 50 read, +57 more", () => {
    // The read stops at 50 (DIGEST_TODO_LIMIT); the store holds 60.
    const rows = Array.from({ length: 50 }, (_, i) => ({
      title: `Late ${i + 1}`,
      dueOn: new Date(Date.UTC(2026, 6, 1 + i)), // Jul 1 onwards, all before TODAY
      createdAt: created,
    }));
    const todos = todosForDigest(rows, TODAY, { due: 0, overdue: 60 });
    expect(todos.overdue).toHaveLength(50);
    expect(todos.overdueTotal).toBe(60);
    const line = composeTodayLine({ ...QUIET, ...todos });
    expect(line).toMatch(/^Overdue: Late 1 \(\d+d\), Late 2 \(\d+d\), Late 3 \(\d+d\), \+57 more\.$/);
  });

  it("never lets a stale count fall below what was actually read", () => {
    const todos = todosForDigest(
      [
        { title: "A", dueOn: at(TODAY), createdAt: created },
        { title: "B", dueOn: at(TODAY), createdAt: created },
        { title: "C", dueOn: at(TODAY), createdAt: created },
        { title: "D", dueOn: at(TODAY), createdAt: created },
      ],
      TODAY,
      { due: 1, overdue: 0 }
    );
    expect(todos.dueTotal).toBe(4);
    expect(composeTodayLine({ ...QUIET, ...todos })).toBe(
      "Due: A (today), B (today), C (today), +1 more."
    );
  });
});

describe("composeTodayLine's totals", () => {
  it("counts +N more from dueTotal when the store holds more than the array", () => {
    expect(
      composeTodayLine({
        ...QUIET,
        due: [
          { title: "A", dayLabel: "today" },
          { title: "B", dayLabel: "today" },
          { title: "C", dayLabel: "today" },
        ],
        dueTotal: 12,
      })
    ).toBe("Due: A (today), B (today), C (today), +9 more.");
  });
});
