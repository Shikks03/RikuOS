import { describe, it, expect } from "vitest";
import { ALL_CLEAR_SAME, NOTHING_NOW, RIGHT_NOW, buildDebriefView, parseDebriefResponse } from "@/lib/debriefView";
import { buildDebrief, toDebriefResponse, type DebriefOutcomes } from "@/lib/debrief";
import { toStoredSymptom } from "@/lib/digest";
import { DEBRIEF_AFTERNOON_OPENERS } from "@/lib/voice";
import type { StoredDebrief } from "@/lib/briefingTypes";

const SENT_AT = new Date("2026-10-12T23:00:04.000Z"); // 07:00 Manila, Tue 13 Oct
const NOW = new Date("2026-10-13T05:04:00.000Z"); // 13:04 Manila

const RECORD: StoredDebrief = {
  at: NOW,
  baselineSentAt: SENT_AT,
  title: "Debrief at 13:04: two things still need you.",
  sorted: [{ key: "site-timeout", subject: "Meowchi", sentence: "Meowchi's site is back up." }],
  stillNeedsYou: [
    {
      ...toStoredSymptom({ key: "engine-stale", ageMs: 40 * 3_600_000 }),
      note: "I couldn't reach ShikksTracker just now, so I can't say whether that's sorted.",
    },
  ],
  new: [toStoredSymptom({ key: "agent-failed", agent: "chaser" })],
  now: [],
  standaloneCouldntCheck: [],
  since: ["You’ve ticked off Essay."],
  today: "Today you've got Math Methods at 15:00.",
  freelance: "One draft is ready for your review.",
  off: "The chaser's still off, by the way.",
  unrecognised: 0,
  couldntCheck: { sites: false, watchdog: false, shikkstracker: true },
  saved: true,
};

const EMPTY: StoredDebrief = { ...RECORD, sorted: [], stillNeedsYou: [], new: [], since: [] };

describe("buildDebriefView (S22, spec §4)", () => {
  it("heads with the time-of-day opener and the fixed tail, curled for the page", () => {
    const v = buildDebriefView(RECORD);
    expect(v.stamp).toBe("13:04");
    expect(v.atIso).toBe(NOW.toISOString());
    expect(v.heading.endsWith(" Here’s where things stand.")).toBe(true);
    expect(DEBRIEF_AFTERNOON_OPENERS.some((o) => v.heading.startsWith(o))).toBe(true);
  });

  it("with a baseline: 'Since' its own stamp, then Sorted, Still needs you and New", () => {
    const v = buildDebriefView(RECORD);
    if (v.comparison.kind !== "since") throw new Error("unreachable");
    expect(v.comparison.heading).toBe("Since 07:00");
    expect(v.comparison.sorted).toEqual(["Meowchi’s site is back up."]);
    expect(v.comparison.still[0].note).toBe("I couldn’t reach ShikksTracker just now, so I can’t say whether that’s sorted.");
    expect(v.comparison.still[0].symptom.sentence[0]).toEqual({ text: "ShikksTracker’s sender", bold: true });
    expect(v.comparison.fresh[0]).toMatchObject({ note: null, symptom: { nextStep: "Look at its last run’s error." } });
    expect(v.comparison.allClear).toBeNull();
  });

  it("the Since heading follows the real send time, never a literal 07:00 (spec §4.2)", () => {
    const v = buildDebriefView({ ...RECORD, baselineSentAt: new Date("2026-10-12T23:04:30.000Z") });
    expect(v.comparison.kind === "since" && v.comparison.heading).toBe("Since 07:04");
  });

  it("gives every row a distinct id, so each opens its own card", () => {
    const v = buildDebriefView(RECORD);
    if (v.comparison.kind !== "since") throw new Error("unreachable");
    const ids = [...v.comparison.still, ...v.comparison.fresh].map((r) => r.symptom.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("nothing then and nothing now: the literal all-clear line (spec §4.2)", () => {
    const v = buildDebriefView(EMPTY);
    expect(v.comparison).toMatchObject({ kind: "since", allClear: ALL_CLEAR_SAME });
    expect(ALL_CLEAR_SAME).toBe("All clear, same as this morning.");
  });

  it("a standalone couldn't-check line is not all clear", () => {
    const v = buildDebriefView({
      ...EMPTY,
      standaloneCouldntCheck: [{ source: "shikkstracker", sentence: "I couldn't reach ShikksTracker just now." }],
    });
    expect(v.comparison).toMatchObject({ kind: "since", allClear: null, standalone: ["I couldn’t reach ShikksTracker just now."] });
  });

  it("with no baseline: a flat 'Right now' list, no groups (spec §4.3)", () => {
    const v = buildDebriefView({
      ...EMPTY,
      baselineSentAt: null,
      now: [toStoredSymptom({ key: "site-timeout", site: "Meowchi" })],
    });
    expect(v.comparison).toMatchObject({ kind: "now", heading: RIGHT_NOW, empty: null });
    if (v.comparison.kind !== "now") throw new Error("unreachable");
    expect(v.comparison.rows).toHaveLength(1);
    expect(RIGHT_NOW).toBe("Right now");
  });

  it("an empty 'Right now' says so", () => {
    const v = buildDebriefView({ ...EMPTY, baselineSentAt: null });
    expect(v.comparison).toMatchObject({ kind: "now", rows: [], empty: NOTHING_NOW });
  });

  it("What you've done and Rest of today, curled", () => {
    const v = buildDebriefView(RECORD);
    expect(v.done).toEqual(["You’ve ticked off Essay."]);
    expect(v.today).toBe("Today you’ve got Math Methods at 15:00.");
    expect(v.freelance).toBe("One draft is ready for your review.");
    expect(v.off).toBe("The chaser’s still off, by the way.");
  });
});

describe("parseDebriefResponse — the door's JSON, back into a Debrief", () => {
  const outcomes: DebriefOutcomes = {
    watchdog: { ok: true, anomalies: [{ agent: "chaser", kind: "failed", detail: "x" }], runs: [] },
    sites: { ok: true, results: [], savedAt: null, ownSaveJustFailed: false },
    shikkstracker: { ok: false },
    today: { events: [], missedLayers: [], due: [], overdue: [] },
    pending: 2,
    chaserEnabled: true,
    since: null,
  };

  it("round-trips a real Debrief through JSON, dates revived", () => {
    const record = buildDebrief({ now: NOW, outcomes, baseline: { sentAt: SENT_AT, symptoms: [] } });
    const parsed = parseDebriefResponse(JSON.parse(JSON.stringify(toDebriefResponse(record, false))));
    expect(parsed).toEqual({ saved: false, debrief: { ...record, saved: false } });
  });

  it("keeps a null baseline null", () => {
    const record = buildDebrief({ now: NOW, outcomes, baseline: null });
    expect(parseDebriefResponse(JSON.parse(JSON.stringify(toDebriefResponse(record))))?.debrief.baselineSentAt).toBeNull();
  });

  it("refuses anything that isn't one", () => {
    const good = JSON.parse(JSON.stringify(RECORD)) as Record<string, unknown>;
    expect(parseDebriefResponse(null)).toBeNull();
    expect(parseDebriefResponse([])).toBeNull();
    expect(parseDebriefResponse({ error: "debrief-failed" })).toBeNull();
    expect(parseDebriefResponse({ ...good, at: "not a date" })).toBeNull();
    expect(parseDebriefResponse({ ...good, baselineSentAt: 42 })).toBeNull();
    expect(parseDebriefResponse({ ...good, new: "x" })).toBeNull();
    expect(parseDebriefResponse({ ...good, saved: "yes" })).toBeNull();
    expect(parseDebriefResponse(good)).not.toBeNull();
  });
});
