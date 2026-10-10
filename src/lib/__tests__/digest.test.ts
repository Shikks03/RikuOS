import { describe, it, expect } from "vitest";
import {
  buildBriefing,
  calendarForDigest,
  composeDigest,
  composeTodayLine,
  freelanceLine,
  offLine,
  todosForDigest,
  type DigestInput,
  type DigestTodayInput,
} from "@/lib/digest";
import { buildPushPayload } from "@/lib/push";
import type { CalendarEvent } from "@/lib/google";
import type { Layer } from "@/lib/osSettings";
import { opener } from "@/lib/voice";
import { BRIEFING_BOUNDS } from "@/lib/briefingTypes";
import type { Problem } from "@/lib/problems";
import { explain } from "@/lib/causes";

const DAY = "2026-10-13"; // a Tuesday
const QUIET: DigestTodayInput = { events: [], missedLayers: [], due: [], overdue: [] };
const base: DigestInput = {
  day: DAY,
  pending: 0,
  attention: { repliedUnanswered: 0, overdue: 0 },
  attentionError: null,
  problems: [],
  offAgents: [],
  today: QUIET,
};

describe("composeDigest — the title", () => {
  it("greets Riku and reads a quiet day as quiet", () => {
    const { title } = composeDigest(base);
    expect(title.startsWith(opener(DAY))).toBe(true);
    expect(title).toMatch(/(Quiet one today|Clear runway today)\.$/);
  });

  it("counts stories, not symptoms", () => {
    const { title } = composeDigest({
      ...base,
      problems: [{ key: "site-unreachable", site: "ShikksTracker" }],
      attention: null,
      attentionError: "fetch failed",
    });
    expect(title).toMatch(/One thing needs you\.$/);
  });

  it("never reads all-clear over a partial calendar (R23)", () => {
    const { title } = composeDigest({
      ...base,
      today: { ...QUIET, events: [{ title: "Math", time: "09:00" }], missedLayers: ["Classes"] },
    });
    expect(title).toMatch(/One thing needs you\.$/);
  });

  it("reads busy at four things today", () => {
    const { title } = composeDigest({
      ...base,
      today: {
        events: [
          { title: "A", time: "09:00" },
          { title: "B", time: "11:00" },
          { title: "C", time: "13:00" },
        ],
        missedLayers: [],
        due: [{ title: "Essay", dayLabel: "today" }],
        overdue: [],
      },
    });
    expect(title).toMatch(/(Full day ahead|Busy one today)\.$/);
  });

  it("does not count every layer off as a problem", () => {
    expect(composeDigest({ ...base, today: { ...QUIET, events: "none-enabled" } }).title).not.toMatch(/need/);
  });
});

describe("composeDigest — the body", () => {
  it("puts problems first, then today, then freelance, then switched off", () => {
    const { body } = composeDigest({
      ...base,
      pending: 3,
      attention: { repliedUnanswered: 1, overdue: 0 },
      problems: [{ key: "site-status", site: "Meowchi", status: 503 }],
      offAgents: ["chaser"],
      today: { ...QUIET, events: [{ title: "Math Methods", time: "09:00" }], due: [{ title: "Essay draft", dayLabel: "today" }] },
    });
    expect(body).toBe(
      "Meowchi's site isn't answering (error 503). Today you've got Math Methods at 09:00. Coming up: Essay draft today. " +
        "One lead is waiting on your reply and three drafts are ready for your review. The chaser's still off, by the way.",
    );
  });

  it("joins unrelated stories as separate sentences", () => {
    const { body } = composeDigest({
      ...base,
      problems: [
        { key: "site-status", site: "Meowchi", status: 503 },
        { key: "agent-failed", agent: "chaser" },
        { key: "todos-unavailable" },
      ],
    });
    expect(body.startsWith(
      "Meowchi's site isn't answering (error 503). Separately, the chaser failed on its last run. Also, I couldn't read your to-dos.",
    )).toBe(true);
  });

  it("never writes freelance zeros when the pipeline failed", () => {
    const { body } = composeDigest({ ...base, attention: null, attentionError: null });
    expect(body).toMatch(/^I couldn't reach ShikksTracker/);
    expect(body).not.toMatch(/waiting on your reply|follow-up/);
  });

  it("says a quiet day only when the calendar and the to-dos both answered", () => {
    expect(composeDigest(base).body).toBe("Nothing on today, and nothing due.");
    expect(composeDigest({ ...base, today: { ...QUIET, events: "unavailable", calendarCause: "timeout" } }).body).toBe(
      "I couldn't read your calendar.",
    );
    expect(composeDigest({ ...base, today: { ...QUIET, due: "unavailable" } }).body).toBe(
      "I couldn't read your to-dos. Nothing on today.",
    );
  });

  it("says the calendar is clear even when the to-dos couldn't be read, and never claims 'nothing due' (R55-style honesty)", () => {
    const today: DigestTodayInput = { ...QUIET, due: "unavailable" };
    const { body } = composeDigest({ ...base, today });
    expect(body).toBe("I couldn't read your to-dos. Nothing on today.");
    expect(body).not.toMatch(/nothing due/i);
    const briefing = buildBriefing({ ...base, today });
    expect(briefing.today).toBe("Nothing on today.");
  });

  it("never claims 'nothing on' over a calendar it couldn't fully read (D6)", () => {
    const today: DigestTodayInput = { events: [], missedLayers: ["Classes"], due: [], overdue: [] };
    const { body } = composeDigest({ ...base, today });
    expect(body).not.toMatch(/Nothing on today/);
    expect(body).toBe("I couldn't read your Classes calendar, so today might be missing something. Nothing due.");
    expect(buildBriefing({ ...base, today }).today).toBe("Nothing due.");
  });

  it("stays within 320 characters and collapses extra stories into a pointer to the Briefing", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ key: "site-status" as const, site: `Site number ${i} with a long name`, status: 503 }));
    // 20 sites are ONE story (same kind); make them unrelated instead:
    const problems = [
      ...many.slice(0, 1),
      { key: "agent-failed" as const, agent: "chaser" as const },
      { key: "agent-never-ran" as const, agent: "site-health" as const },
      { key: "engine-errors" as const, count: 3 },
      { key: "unstuck-items" as const, count: 2 },
      { key: "snapshot-unsaved" as const },
      { key: "todos-unavailable" as const },
      { key: "calendar-unavailable" as const, cause: "expired" as const },
    ];
    const { body } = composeDigest({
      ...base,
      problems,
      pending: 4,
      attention: { repliedUnanswered: 2, overdue: 1 },
      today: { ...QUIET, events: [{ title: "Math Methods", time: "09:00" }] },
    });
    expect(body.length).toBeLessThanOrEqual(320);
    expect(body).toMatch(/…and (one|two|three|four|five|six|seven|\d+) more, see the Briefing\./);
    expect(buildPushPayload("t", body).body).toBe(body); // the payload never has to cut
    expect(body).toMatch(/drafts are ready for your review\.$/); // the freelance line survives
  });

  it("stays within 320 on a heavy problems morning with agents switched off too, keeping freelance and off whole", () => {
    const problems = [
      { key: "site-status" as const, site: "Site number 0 with a long name", status: 503 },
      { key: "agent-failed" as const, agent: "chaser" as const },
      { key: "agent-never-ran" as const, agent: "site-health" as const },
      { key: "engine-errors" as const, count: 3 },
      { key: "unstuck-items" as const, count: 2 },
      { key: "snapshot-unsaved" as const },
      { key: "todos-unavailable" as const },
      { key: "calendar-unavailable" as const, cause: "expired" as const },
    ];
    const input: DigestInput = {
      ...base,
      problems,
      pending: 4,
      attention: { repliedUnanswered: 2, overdue: 1 },
      offAgents: ["chaser", "lead-sweep"],
      today: { ...QUIET, events: [{ title: "Math Methods", time: "09:00" }] },
    };
    const { body } = composeDigest(input);
    expect(body.length).toBeLessThanOrEqual(320);
    const expectedFreelance = freelanceLine(input)!;
    const expectedOff = offLine(input.offAgents)!;
    expect(body.endsWith(`${expectedFreelance} ${expectedOff}`)).toBe(true);
    expect(body).toMatch(/…and (one|two|three|four|five|six|seven|\d+) more, see the Briefing\./);
  });

  it("gives the problems line the wider, Today-free budget rather than cutting mid-word, when the stories fit without Today but not with it", () => {
    const calendars = ["Semester 2 Classes - University of the Philippines Diliman", "Org meetings and things"];
    const input: DigestInput = {
      ...base,
      pending: 3,
      attention: { repliedUnanswered: 1, overdue: 1 },
      offAgents: ["chaser"],
      today: {
        events: [
          { title: "Morning class", time: "09:00" },
          { title: "Afternoon meeting", time: "13:00" },
        ],
        missedLayers: calendars,
        due: [{ title: "Essay draft", dayLabel: "today" }],
        overdue: [],
      },
    };
    const { body } = composeDigest(input);
    const expectedStory = explain({ key: "calendar-partial", calendars }).sentence.text;
    const expectedFreelance = freelanceLine(input)!;
    const expectedOff = offLine(input.offAgents)!;
    expect(body.length).toBeLessThanOrEqual(320);
    expect(body).not.toContain("…"); // the story is whole, not clipped
    expect(body).toBe(`${expectedStory} ${expectedFreelance} ${expectedOff}`);
    expect(body).not.toMatch(/Today you've got|Coming up:/); // the Today line was dropped, not the story
    // The stored Briefing keeps the full Today sentence regardless of the push's trade-off.
    expect(buildBriefing(input).today).toMatch(/Morning class at 09:00/);
  });

  it("cuts a single enormous story rather than exceed the budget, even the Today-free budget", () => {
    // Problem.site has no length bound at the type level (real SITES names are
    // short — AzeroTech, Meowchi, ShikksTracker — this is a defensive
    // worst-case against whatever a caller actually hands it, not a realistic
    // site name).
    const { body } = composeDigest({ ...base, problems: [{ key: "site-status", site: "X".repeat(400), status: 503 }] });
    expect(body.length).toBeLessThanOrEqual(320);
    expect(body).toContain("…");
  });

  it("on a heavy NO-problems morning, reserves room for freelance and off so they stay whole", () => {
    const events = Array.from({ length: 4 }, (_, i) => ({
      title: `A rather long class or meeting title number ${i}`,
      time: "09:00",
    }));
    const input: DigestInput = {
      ...base,
      pending: 3,
      attention: { repliedUnanswered: 2, overdue: 1 },
      offAgents: ["chaser", "lead-sweep"],
      today: { ...QUIET, events, due: [{ title: "Essay draft", dayLabel: "today" }] },
    };
    const { body } = composeDigest(input);
    const expectedFreelance = freelanceLine(input)!;
    const expectedOff = offLine(input.offAgents)!;
    expect(body.length).toBeLessThanOrEqual(320);
    // Would fail if the zero-stories branch's budget were replaced by
    // PUSH_BODY_MAX (i.e. stopped reserving room for `others`): the Today
    // line's full form is long enough that, left uncut, it would push the
    // freelance and off lines either off the end or over 320.
    expect(body.endsWith(`${expectedFreelance} ${expectedOff}`)).toBe(true);
  });

  it("uses straight apostrophes only", () => {
    const { title, body } = composeDigest({ ...base, problems: [{ key: "site-timeout", site: "Azero" }] });
    expect(title + body).not.toMatch(/’/);
  });
});

describe("composeTodayLine — the voice", () => {
  it("names events with their times, all-day ones marked", () => {
    expect(
      composeTodayLine({ ...QUIET, events: [{ title: "Math Methods", time: "09:00" }, { title: "Foundation Day", time: null }] }),
    ).toBe("Today you've got Math Methods at 09:00 and Foundation Day (all day).");
  });

  it("lists due and overdue to-dos in plain words", () => {
    expect(
      composeTodayLine({
        ...QUIET,
        due: [
          { title: "Essay", dayLabel: "today" },
          { title: "Tuition", dayLabel: "Fri" },
        ],
        overdue: [{ title: "Invoice", daysLate: 1 }],
      }),
    ).toBe("Coming up: Essay today and Tuition on Fri. Running late: Invoice (1 day).");
  });

  it("collapses past three names into 'and N more', counting the store's total", () => {
    expect(
      composeTodayLine({
        ...QUIET,
        due: ["A", "B", "C", "D"].map((t) => ({ title: t, dayLabel: "today" })),
        dueTotal: 9,
      }),
    ).toBe("Coming up: A today, B today, C today and 6 more.");
  });

  it("says when every layer is off", () => {
    expect(composeTodayLine({ ...QUIET, events: "none-enabled" })).toBe(
      "Your calendar layers are all switched off. Nothing due.",
    );
  });

  it("compacts under a budget without ever cutting a time", () => {
    const long = "A very long event title that goes on and on and on";
    const line = composeTodayLine(
      { ...QUIET, events: [1, 2, 3, 4].map((i) => ({ title: `${long} ${i}`, time: "09:00" })) },
      90,
    );
    expect(line.length).toBeLessThanOrEqual(90);
    expect(line).toContain("09:00");
  });

  it("collapses to plain English, with number words and nouns, when every name must be dropped", () => {
    expect(
      composeTodayLine(
        {
          events: [
            { title: "A", time: "09:00" },
            { title: "B", time: "09:00" },
            { title: "C", time: "09:00" },
          ],
          missedLayers: [],
          due: [
            { title: "D", dayLabel: "today" },
            { title: "E", dayLabel: "today" },
          ],
          overdue: [{ title: "F", daysLate: 1 }],
        },
        0,
      ),
    ).toBe("Today you've got three things on. Two to-dos coming up. One running late.");
  });

  it("gets the singular right too: 'one thing on', 'one to-do coming up'", () => {
    expect(
      composeTodayLine(
        {
          events: [{ title: "A", time: "09:00" }],
          missedLayers: [],
          due: [{ title: "B", dayLabel: "today" }],
          overdue: [{ title: "C", daysLate: 2 }],
        },
        0,
      ),
    ).toBe("Today you've got one thing on. One to-do coming up. One running late.");
  });

  it("never names an event, a to-do or a thing with a bare digit count on an ordinary problem morning", () => {
    // One short story, 3 events, 2 due, 1 overdue, full freelance, chaser off:
    // the Today line is squeezed small enough to need the limit-0 collapse.
    const input: DigestInput = {
      ...base,
      problems: [{ key: "agent-degraded", agent: "dispatcher", itemsFailed: 2 }],
      pending: 3,
      attention: { repliedUnanswered: 1, overdue: 1 },
      offAgents: ["chaser"],
      today: {
        events: [
          { title: "Math Methods", time: "09:00" },
          { title: "Study group", time: "11:00" },
          { title: "Gym", time: "18:00" },
        ],
        missedLayers: [],
        due: [
          { title: "Essay draft", dayLabel: "today" },
          { title: "Tuition", dayLabel: "tomorrow" },
        ],
        overdue: [{ title: "Invoice", daysLate: 1 }],
      },
    };
    const { body } = composeDigest(input);
    expect(body).not.toMatch(/got \d+ more\.|up: \d+ more\.|late: \d+ more\./);
    expect(body).not.toMatch(/\bthings? on\b.*\bthings? on\b/); // sanity: not duplicated
  });

  it("cuts titles through TITLE_CAPS before dropping names (the '…' lands inside a title, not in place of a name)", () => {
    const long = "A very long event title that goes on and on and on";
    const events = [1, 2, 3].map((i) => ({ title: `${long} ${i}`, time: "09:00" }));
    const line = composeTodayLine({ ...QUIET, events }, 120);
    // All three events are still named (not collapsed to "and N more") …
    expect(line).toMatch(/^Today you've got .+ at 09:00, .+ at 09:00 and .+ at 09:00\.$/);
    // … but their titles were shortened, each with its own ellipsis.
    expect(line).toContain("…");
    expect(line.length).toBeLessThanOrEqual(120);
  });

  it("honours overdueTotal directly, not just via todosForDigest's integration", () => {
    expect(
      composeTodayLine({
        ...QUIET,
        overdue: ["A", "B", "C"].map((t) => ({ title: t, daysLate: 1 })),
        overdueTotal: 9,
      }),
    ).toBe("Running late: A (1 day), B (1 day), C (1 day) and 6 more.");
  });
});

describe("buildBriefing", () => {
  it("stores every story with every symptom explained", () => {
    const briefing = buildBriefing({
      ...base,
      problems: [
        { key: "site-unreachable", site: "ShikksTracker" },
        { key: "job-failed", job: "watchdog", raw: "something odd" },
      ],
      attention: null,
      // A recognised error, so the only unrecognised one is the watchdog's.
      attentionError: "connect ECONNREFUSED 10.0.0.1:443",
    });
    expect(briefing.stories).toHaveLength(2);
    expect(briefing.stories[0].symptoms.map((s) => s.key)).toEqual(["site-unreachable", "pipeline-unavailable"]);
    expect(briefing.stories[1].symptoms[0]).toMatchObject({
      key: "job-failed",
      causeKey: "unrecognised",
      cause: "I don't recognise this one. The raw error is below.",
      raw: "something odd",
    });
    expect(briefing.unrecognised).toBe(1);
  });

  it("keeps the full Today sentence, never compacted", () => {
    const events = Array.from({ length: 8 }, (_, i) => ({ title: `Event ${i}`, time: "09:00" }));
    const briefing = buildBriefing({ ...base, today: { ...QUIET, events } });
    expect(briefing.today).toContain("Event 0");
    expect(briefing.today).toContain("and 5 more");
  });

  it("bounds every stored string and array", () => {
    const briefing = buildBriefing({
      ...base,
      problems: [{ key: "calendar-partial", calendars: Array.from({ length: 80 }, (_, i) => `Calendar ${i}`) }],
    });
    expect(briefing.stories[0].sentence.length).toBeLessThanOrEqual(240);
    expect(briefing.stories[0].symptoms[0].sentence.length).toBeLessThanOrEqual(200);
    for (const r of briefing.stories[0].bold) expect(r.end).toBeLessThanOrEqual(briefing.stories[0].sentence.length);
  });

  it("is null-free where the page needs text, and null where a line is absent", () => {
    const briefing = buildBriefing(base);
    expect(briefing.stories).toEqual([]);
    expect(briefing.freelance).toBeNull();
    expect(briefing.off).toBeNull();
    expect(briefing.today).toBe("Nothing on today, and nothing due.");
    expect(briefing.omitted).toBe(0);
  });

  it("counts unrecognised symptoms BEFORE slicing stories to 12 (feature review, A-II item 10)", () => {
    // 13 unrelated problems, none chaining or grouping (each a distinct key,
    // no two site-* or two of the same agent-* key, no engine+stranded pair,
    // no site+pipeline pair), so each becomes its own one-problem story: the
    // 13th (an unrecognised job-failed) is dropped from what's STORED
    // (BRIEFING_BOUNDS.stories = 12), but must still be counted — a count
    // taken after slicing would silently read 0.
    const problems: Problem[] = [
      { key: "site-status", site: "Meowchi", status: 503 },
      { key: "agent-never-ran", agent: "chaser" },
      { key: "agent-stale", agent: "watchdog", ageHours: 40 },
      { key: "agent-failed", agent: "triage" },
      { key: "agent-degraded", agent: "dispatcher", itemsFailed: 2 },
      { key: "snapshot-unsaved" },
      { key: "unstuck-items", count: 3 },
      { key: "engine-errors", count: 2 },
      { key: "calendar-unavailable", cause: "not-configured" },
      { key: "calendar-partial", calendars: ["Work"] },
      { key: "todos-unavailable" },
      { key: "stranded-approved", count: 1 },
      { key: "job-failed", job: "retro", raw: "a weird unrecognised error" },
    ];
    const briefing = buildBriefing({ ...base, problems });
    expect(briefing.stories).toHaveLength(BRIEFING_BOUNDS.stories);
    expect(briefing.unrecognised).toBe(1);
    // 13 one-problem stories, 12 stored — the 13th is omitted (carried item 2, Plan B).
    expect(briefing.omitted).toBe(1);
  });

  it("stores at most BRIEFING_BOUNDS.bold ranges per story and per symptom, even when five agents fail together", () => {
    // Moved from stories.test.ts (feature review, A-II item 8): groupProblems
    // itself does not cap bold ranges (that's buildBriefing's job), so this
    // belongs here, against the function that actually enforces the bound.
    const problems: Problem[] = (["chaser", "lead-sweep", "triage", "site-health", "outreach-health"] as const).map(
      (agent) => ({ key: "agent-failed" as const, agent }),
    );
    const briefing = buildBriefing({ ...base, problems });
    expect(briefing.stories).toHaveLength(1);
    expect(briefing.stories[0].bold.length).toBeLessThanOrEqual(BRIEFING_BOUNDS.bold);
    for (const symptom of briefing.stories[0].symptoms) {
      expect(symptom.bold.length).toBeLessThanOrEqual(BRIEFING_BOUNDS.bold);
    }
  });
});

// --- The adapters ------------------------------------------------------------

const TODAY = "2026-09-10"; // a Thursday

function event(over: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "e",
    title: "Event",
    calendarId: "primary",
    layerName: "Personal",
    allDay: false,
    startsAt: null,
    endsAt: null,
    dayKey: TODAY,
    htmlLink: "",
    ...over,
  };
}

const PERSONAL_L: Layer = { calendarId: "primary", name: "Personal", enabled: true };
const CLASSES_L: Layer = { calendarId: "classes@g", name: "Classes", enabled: true };
const TWO = [PERSONAL_L, CLASSES_L];

describe("calendarForDigest", () => {
  it("maps none-enabled to the no-layers form, not to unavailable", () => {
    expect(calendarForDigest({ ok: false, reason: "none-enabled" }, [], TODAY)).toEqual({
      events: "none-enabled",
      missedLayers: [],
    });
  });

  it("maps every other failed window to unavailable, with the reason as calendarCause", () => {
    for (const reason of ["not-configured", "expired", "timeout"] as const) {
      expect(calendarForDigest({ ok: false, reason }, TWO, TODAY)).toEqual({
        events: "unavailable",
        missedLayers: [],
        calendarCause: reason,
      });
    }
  });

  it("treats a window where every enabled layer failed as unavailable, not partial", () => {
    expect(calendarForDigest({ ok: true, events: [], failed: ["primary", "classes@g"] }, TWO, TODAY)).toEqual({
      events: "unavailable",
      missedLayers: [],
      calendarCause: "read-failed",
    });
  });

  it("carries the missed layer names when some answered", () => {
    expect(calendarForDigest({ ok: true, events: [], failed: ["classes@g"] }, TWO, TODAY)).toEqual({
      events: [],
      missedLayers: ["Classes"],
    });
  });

  it("decides by id: two enabled layers named alike, one answered, is partial with the name once", () => {
    const layers: Layer[] = [
      { calendarId: "a@g", name: "Calendar", enabled: true },
      { calendarId: "b@g", name: "Calendar", enabled: true },
    ];
    const window = {
      ok: true as const,
      events: [event({ calendarId: "a@g", layerName: "Calendar", title: "Gym", allDay: true })],
      failed: ["b@g"],
    };
    const part = calendarForDigest(window, layers, TODAY);
    expect(part).toEqual({ events: [{ title: "Gym", time: null }], missedLayers: ["Calendar"] });
    const digest = composeDigest({ ...base, today: { ...QUIET, ...part } });
    expect(digest.body).toBe(
      "I couldn't read your Calendar calendar, so today might be missing something. Today you've got Gym (all day).",
    );
  });

  it("a disabled layer does not stand between a failure and `unavailable`", () => {
    const layers = [PERSONAL_L, { ...CLASSES_L, enabled: false }];
    expect(calendarForDigest({ ok: true, events: [], failed: ["primary"] }, layers, TODAY).events).toBe("unavailable");
  });

  it("a failed id that joins to no enabled layer is unavailable, never all clear", () => {
    expect(calendarForDigest({ ok: true, events: [], failed: ["stranger@g"] }, TWO, TODAY)).toEqual({
      events: "unavailable",
      missedLayers: [],
      calendarCause: "read-failed",
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
    expect(calendarForDigest(window, [PERSONAL_L], TODAY).events).toEqual([
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
    expect(line).toMatch(/^Running late: Late 1 \(\d+ days?\), Late 2 \(\d+ days?\), Late 3 \(\d+ days?\) and 57 more\.$/);
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
      "Coming up: A today, B today, C today and 1 more."
    );
  });
});

import { todayProblems, toStoredSymptom } from "@/lib/digest";

describe("toStoredSymptom / todayProblems (S22)", () => {
  it("stores a problem's subject beside its explained sentence", () => {
    expect(toStoredSymptom({ key: "site-status", site: "Meowchi", status: 503 })).toMatchObject({
      key: "site-status",
      subject: "Meowchi",
      sentence: "Meowchi's site isn't answering (error 503).",
      bold: [{ start: 0, end: 14 }],
    });
    expect(toStoredSymptom({ key: "todos-unavailable" }).subject).toBeNull();
  });

  it("gives every symptom buildBriefing stores its subject", () => {
    const briefing = buildBriefing({ ...base, problems: [{ key: "agent-failed", agent: "chaser" }] });
    expect(briefing.stories[0].symptoms[0].subject).toBe("chaser");
  });

  it("reads calendar and to-do failures exactly as the push does", () => {
    expect(todayProblems({ ...QUIET, events: "unavailable", calendarCause: "expired", due: "unavailable" })).toEqual([
      { key: "calendar-unavailable", cause: "expired" },
      { key: "todos-unavailable" },
    ]);
    expect(todayProblems({ ...QUIET, events: "unavailable" })).toEqual([{ key: "calendar-unavailable", cause: "read-failed" }]);
    expect(todayProblems({ ...QUIET, missedLayers: ["Work"] })).toEqual([{ key: "calendar-partial", calendars: ["Work"] }]);
    expect(todayProblems({ ...QUIET, events: "none-enabled" })).toEqual([]);
    expect(todayProblems(QUIET)).toEqual([]);
  });
});
