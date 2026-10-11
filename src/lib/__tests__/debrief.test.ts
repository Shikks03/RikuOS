import { describe, it, expect } from "vitest";
import {
  buildDebrief,
  countCouldntCheck,
  debriefTitle,
  freshProblems,
  toDebriefResponse,
  type DebriefOutcomes,
} from "@/lib/debrief";
import { toStoredSymptom, type DigestTodayInput } from "@/lib/digest";
import { DEBRIEF_BOUNDS } from "@/lib/briefingTypes";
import type { Baseline } from "@/lib/debriefCompare";
import type { Problem } from "@/lib/problems";
import type { SiteResult } from "@/lib/siteHealth";
import type { SinceThenInput } from "@/lib/sinceThen";
import LastDebrief from "@/models/LastDebrief";

const SENT_AT = new Date("2026-10-12T23:00:04.000Z"); // 07:00 Manila, Tue 13 Oct
const NOW = new Date("2026-10-13T05:04:00.000Z"); // 13:04 Manila
const QUIET: DigestTodayInput = { events: [], missedLayers: [], due: [], overdue: [] };
const MEOWCHI_DOWN: SiteResult = { name: "Meowchi", up: false, detail: "Meowchi timed out", failure: "timeout" };
const SINCE: SinceThenInput = {
  ticked: { titles: ["Essay"], total: 1 },
  newDue: { titles: [], total: 0 },
  events: "none-enabled",
  newDrafts: 0,
};

function healthy(): DebriefOutcomes {
  return {
    watchdog: { ok: true, anomalies: [], runs: [] },
    sites: {
      ok: true,
      results: [{ name: "Meowchi", up: true, detail: "Meowchi ok" }],
      savedAt: new Date("2026-10-13T05:03:50.000Z"),
      ownSaveJustFailed: false,
    },
    shikkstracker: { ok: true, findings: [], attention: { repliedUnanswered: 0, overdue: 0 } },
    today: QUIET,
    pending: 0,
    chaserEnabled: true,
    since: null,
  };
}

function baseline(...problems: Problem[]): Baseline {
  return { sentAt: SENT_AT, symptoms: problems.map((p) => toStoredSymptom(p)) };
}

describe("freshProblems — a failed source produces no problem at all (spec §3.4)", () => {
  it.each(["watchdog", "sites", "shikkstracker"] as const)("%s failing adds nothing — never job-failed or pipeline-unavailable", (source) => {
    const o = healthy();
    o.watchdog = { ok: true, anomalies: [{ agent: "chaser", kind: "failed", detail: "x" }], runs: [] };
    o.sites = { ok: true, results: [MEOWCHI_DOWN], savedAt: null, ownSaveJustFailed: false };
    o.shikkstracker = { ok: true, findings: [{ kind: "engine-errors", detail: "x", count: 2 }], attention: { repliedUnanswered: 0, overdue: 0 } };
    if (source === "watchdog") o.watchdog = { ok: false };
    if (source === "sites") o.sites = { ok: false, savedAt: null };
    if (source === "shikkstracker") o.shikkstracker = { ok: false };
    const keys = freshProblems(o).map((p) => p.key);
    expect(keys).not.toContain("job-failed");
    expect(keys).not.toContain("pipeline-unavailable");
    expect(keys).toHaveLength(2);
  });

  it("translates each source's own findings, in report order", () => {
    const o = healthy();
    o.watchdog = { ok: true, anomalies: [{ agent: "chaser", kind: "failed", detail: "x" }], runs: [] };
    o.sites = { ok: true, results: [MEOWCHI_DOWN], savedAt: null, ownSaveJustFailed: true };
    o.shikkstracker = { ok: true, findings: [{ kind: "engine-errors", detail: "x", count: 2 }], attention: { repliedUnanswered: 0, overdue: 0 } };
    o.today = { ...QUIET, due: "unavailable" };
    expect(freshProblems(o)).toEqual([
      { key: "agent-failed", agent: "chaser" },
      { key: "site-timeout", site: "Meowchi" },
      { key: "engine-errors", count: 2 },
      { key: "snapshot-unsaved" },
      { key: "todos-unavailable" },
    ]);
  });
});

describe("the baseline / now split (spec §5.1)", () => {
  it("with no baseline, only `now` (and standalone lines) can be populated", () => {
    const o = healthy();
    o.sites = { ok: true, results: [MEOWCHI_DOWN], savedAt: null, ownSaveJustFailed: false };
    o.shikkstracker = { ok: false };
    o.since = SINCE;
    const d = buildDebrief({ now: NOW, outcomes: o, baseline: null });
    expect(d.baselineSentAt).toBeNull();
    expect(d.sorted).toEqual([]);
    expect(d.stillNeedsYou).toEqual([]);
    expect(d.new).toEqual([]);
    expect(d.since).toEqual([]);
    expect(d.now).toEqual([toStoredSymptom({ key: "site-timeout", site: "Meowchi" })]);
    expect(d.standaloneCouldntCheck).toEqual([{ source: "shikkstracker", sentence: "I couldn't reach ShikksTracker just now." }]);
  });

  it("with a baseline, `now` is always empty", () => {
    const o = healthy();
    o.sites = { ok: true, results: [MEOWCHI_DOWN], savedAt: null, ownSaveJustFailed: false };
    const d = buildDebrief({ now: NOW, outcomes: o, baseline: baseline() });
    expect(d.baselineSentAt).toEqual(SENT_AT);
    expect(d.now).toEqual([]);
    expect(d.new.map((s) => s.key)).toEqual(["site-timeout"]);
  });
});

describe("Sorted, Still needs you and New, as stored", () => {
  it("stores each Sorted sentence once — two ShikksTracker symptoms clearing read as one line (plan deviation 12)", () => {
    const d = buildDebrief({
      now: NOW,
      outcomes: healthy(),
      baseline: baseline({ key: "engine-stale", ageMs: 40 * 3_600_000 }, { key: "stranded-approved", count: 2 }),
    });
    expect(d.sorted).toEqual([{ key: "engine-stale", subject: null, sentence: "ShikksTracker's sender is moving again." }]);
  });

  it("a site back up is stored with the approved literal (spec §4.2)", () => {
    const d = buildDebrief({ now: NOW, outcomes: healthy(), baseline: baseline({ key: "site-status", site: "Meowchi", status: 503 }) });
    expect(d.sorted).toEqual([{ key: "site-status", subject: "Meowchi", sentence: "Meowchi's site is back up." }]);
    expect(d.title).toBe("Debrief at 13:04: all clear.");
  });

  it("still there: re-explained from the fresh problem, so its numbers are fresh", () => {
    const o = healthy();
    o.watchdog = { ok: true, anomalies: [{ agent: "chaser", kind: "stale", detail: "x", ageHours: 37 }], runs: [] };
    const d = buildDebrief({ now: NOW, outcomes: o, baseline: baseline({ key: "agent-stale", agent: "chaser", ageHours: 31 }) });
    expect(d.stillNeedsYou).toEqual([{ ...toStoredSymptom({ key: "agent-stale", agent: "chaser", ageHours: 37 }), note: null }]);
    expect(d.stillNeedsYou[0].sentence).toBe("The chaser hasn't run in 37 hours.");
  });

  it("a can't-say row keeps the 07:00 symptom and adds its source's note", () => {
    const p: Problem = { key: "engine-stale", ageMs: 40 * 3_600_000 };
    const o = healthy();
    o.shikkstracker = { ok: false };
    const d = buildDebrief({ now: NOW, outcomes: o, baseline: baseline(p) });
    expect(d.stillNeedsYou).toEqual([
      { ...toStoredSymptom(p), note: "I couldn't reach ShikksTracker just now, so I can't say whether that's sorted." },
    ]);
    expect(d.standaloneCouldntCheck).toEqual([]);
    expect(d.couldntCheck).toEqual({ sites: false, watchdog: false, shikkstracker: true });
  });

  it("a not-re-checkable row is the 07:00 symptom, verbatim", () => {
    const p: Problem = { key: "unstuck-items", count: 2 };
    const d = buildDebrief({ now: NOW, outcomes: healthy(), baseline: baseline(p) });
    expect(d.stillNeedsYou).toEqual([{ ...toStoredSymptom(p), note: null }]);
  });

  it("snapshot-unsaved's three-way rule reaches the stored record (spec §3.5)", () => {
    const morning = baseline({ key: "snapshot-unsaved" });
    // healthy(): saved at 13:03:50, after 07:00.
    expect(buildDebrief({ now: NOW, outcomes: healthy(), baseline: morning }).sorted.map((s) => s.sentence)).toEqual([
      "Today's site check is saved now.",
    ]);
    const failed = healthy();
    failed.sites = { ok: true, results: [], savedAt: null, ownSaveJustFailed: true };
    const f = buildDebrief({ now: NOW, outcomes: failed, baseline: morning });
    expect(f.stillNeedsYou.map((s) => s.sentence)).toEqual(["I checked the sites but couldn't save the result."]);
    expect(f.new).toEqual([]);
    const stale = healthy();
    stale.sites = { ok: true, results: [], savedAt: new Date(SENT_AT.getTime() - 1000), ownSaveJustFailed: false };
    expect(buildDebrief({ now: NOW, outcomes: stale, baseline: morning }).stillNeedsYou.map((s) => s.key)).toEqual([
      "snapshot-unsaved",
    ]);
  });
});

describe("New rows: a time only where a run really happened (spec §4.2, plan deviation 6)", () => {
  const at11 = new Date("2026-10-13T03:00:00.000Z"); // 11:00 Manila, today

  it("stamps agent-failed with its run's time today, keeping its bold", () => {
    const o = healthy();
    o.watchdog = {
      ok: true,
      anomalies: [{ agent: "chaser", kind: "failed", detail: "x" }],
      runs: [{ agent: "chaser", startedAt: at11, ok: false, itemsFailed: 0 }],
    };
    const d = buildDebrief({ now: NOW, outcomes: o, baseline: baseline() });
    expect(d.new[0].sentence).toBe("The chaser failed on its last run at 11:00.");
    expect(d.new[0].bold).toEqual([{ start: 0, end: 10 }]);
  });

  it("stamps agent-degraded too", () => {
    const o = healthy();
    o.watchdog = {
      ok: true,
      anomalies: [{ agent: "chaser", kind: "degraded", detail: "x", itemsFailed: 2 }],
      runs: [{ agent: "chaser", startedAt: at11, ok: true, itemsFailed: 2 }],
    };
    const d = buildDebrief({ now: NOW, outcomes: o, baseline: baseline() });
    expect(d.new[0].sentence).toBe("The chaser had two items that didn't go through on its last run at 11:00.");
  });

  it("never stamps a stale agent, a run from another day, or a site", () => {
    const o = healthy();
    o.watchdog = {
      ok: true,
      anomalies: [
        { agent: "chaser", kind: "stale", detail: "x", ageHours: 40 },
        { agent: "dispatcher", kind: "failed", detail: "x" },
      ],
      runs: [
        { agent: "chaser", startedAt: new Date("2026-10-11T13:00:00.000Z"), ok: true, itemsFailed: 0 },
        { agent: "dispatcher", startedAt: new Date("2026-10-11T23:00:00.000Z"), ok: false, itemsFailed: 0 },
      ],
    };
    o.sites = { ok: true, results: [MEOWCHI_DOWN], savedAt: null, ownSaveJustFailed: false };
    const d = buildDebrief({ now: NOW, outcomes: o, baseline: baseline() });
    expect(d.new.map((s) => s.sentence)).toEqual([
      "The chaser hasn't run in 40 hours.",
      "The morning run failed on its last run.",
      "Meowchi's site took too long to answer.",
    ]);
  });

  it("only New rows are stamped — Still needs you keeps the plain fresh sentence", () => {
    const o = healthy();
    o.watchdog = {
      ok: true,
      anomalies: [{ agent: "chaser", kind: "failed", detail: "x" }],
      runs: [{ agent: "chaser", startedAt: at11, ok: false, itemsFailed: 0 }],
    };
    const d = buildDebrief({ now: NOW, outcomes: o, baseline: baseline({ key: "agent-failed", agent: "chaser" }) });
    expect(d.stillNeedsYou[0].sentence).toBe("The chaser failed on its last run.");
  });
});

describe("the title (spec §2.2, plan deviation 5)", () => {
  it.each([
    [0, "Debrief at 13:04: all clear."],
    [1, "Debrief at 13:04: one thing still needs you."],
    [2, "Debrief at 13:04: two things still need you."],
    [5, "Debrief at 13:04: five things still need you."],
    [12, "Debrief at 13:04: 12 things still need you."],
  ])("%i outstanding → %s", (n, title) => {
    expect(debriefTitle(NOW, n)).toBe(title);
  });

  it("stays inside the push title bound", () => {
    expect(debriefTitle(NOW, 99_999).length).toBeLessThanOrEqual(DEBRIEF_BOUNDS.title);
  });

  it("is all clear when nothing then and nothing now", () => {
    const d = buildDebrief({ now: NOW, outcomes: healthy(), baseline: baseline() });
    expect(d.title).toBe("Debrief at 13:04: all clear.");
    expect([d.sorted, d.stillNeedsYou, d.new, d.standaloneCouldntCheck]).toEqual([[], [], [], []]);
  });

  it("counts a source it couldn't check — never 'all clear' over a blind spot", () => {
    const o = healthy();
    o.shikkstracker = { ok: false };
    expect(buildDebrief({ now: NOW, outcomes: o, baseline: baseline() }).title).toBe("Debrief at 13:04: one thing still needs you.");
  });

  it("counts every row before a bound slices the list", () => {
    const o = healthy();
    o.sites = {
      ok: true,
      results: Array.from({ length: 14 }, (_, i): SiteResult => ({ name: `Site${i}`, up: false, detail: "d", failure: "timeout" })),
      savedAt: null,
      ownSaveJustFailed: false,
    };
    const d = buildDebrief({ now: NOW, outcomes: o, baseline: baseline() });
    expect(d.title).toBe("Debrief at 13:04: 14 things still need you.");
    expect(d.new).toHaveLength(DEBRIEF_BOUNDS.newProblems);
  });
});

describe("What you've done and Rest of today (spec §4.4, §4.5)", () => {
  it("What you've done: since-then lines from 07:00 to the press, only with a baseline", () => {
    const o = healthy();
    o.since = SINCE;
    expect(buildDebrief({ now: NOW, outcomes: o, baseline: baseline() }).since).toEqual(["You’ve ticked off Essay."]);
  });

  it.each([
    ["with a baseline", true],
    ["with no baseline", false],
  ])("Rest of today is freshly composed %s", (_label, has) => {
    const o = healthy();
    o.today = { ...QUIET, events: [{ title: "Math Methods", time: "15:00" }] };
    o.pending = 3;
    o.shikkstracker = { ok: true, findings: [], attention: { repliedUnanswered: 1, overdue: 0 } };
    o.chaserEnabled = false;
    const d = buildDebrief({ now: NOW, outcomes: o, baseline: has ? baseline() : null });
    expect(d.today).toBe("Today you've got Math Methods at 15:00.");
    expect(d.freelance).toBe("One lead is waiting on your reply and three drafts are ready for your review.");
    expect(d.off).toBe("The chaser's still off, by the way.");
  });

  it("leaves out what it couldn't read rather than guessing (plan deviation 17)", () => {
    const o = healthy();
    o.shikkstracker = { ok: false };
    o.pending = 1;
    o.chaserEnabled = "unavailable";
    const d = buildDebrief({ now: NOW, outcomes: o, baseline: baseline() });
    expect(d.freelance).toBe("One draft is ready for your review.");
    expect(d.off).toBeNull();
    const p = healthy();
    p.pending = "unavailable";
    expect(buildDebrief({ now: NOW, outcomes: p, baseline: baseline() }).freelance).toBeNull();
  });
});

describe("the run's bookkeeping", () => {
  it("counts unrecognised errors over every fresh problem — none carries a raw error, so 0", () => {
    const o = healthy();
    o.watchdog = { ok: true, anomalies: [{ agent: "chaser", kind: "failed", detail: "x" }], runs: [] };
    o.today = { ...QUIET, events: "unavailable", due: "unavailable" };
    expect(buildDebrief({ now: NOW, outcomes: o, baseline: null }).unrecognised).toBe(0);
  });

  it("countCouldntCheck counts the sources that failed", () => {
    expect(countCouldntCheck({ couldntCheck: { sites: false, watchdog: false, shikkstracker: false } })).toBe(0);
    expect(countCouldntCheck({ couldntCheck: { sites: true, watchdog: false, shikkstracker: true } })).toBe(2);
  });

  it("toDebriefResponse adds the response-only `saved`", () => {
    const d = buildDebrief({ now: NOW, outcomes: healthy(), baseline: null });
    expect(toDebriefResponse(d)).toEqual({ ...d, saved: true });
    expect(toDebriefResponse(d, false).saved).toBe(false);
  });
});

describe("a worst case always fits LastDebrief's schema", () => {
  it("validates with every list over its bound, long names and every source failing but one", async () => {
    const longName = (prefix: string) => `${prefix}-${"x".repeat(110)}`.slice(0, 120);
    const morning = baseline(
      ...Array.from({ length: 14 }, (_, i): Problem => ({ key: "site-timeout", site: `Old${i}` })),
      { key: "calendar-partial", calendars: [longName("Work"), longName("Classes"), longName("Personal")] },
      { key: "unstuck-items", count: 6 },
      { key: "job-failed", job: "expiry-sweep", raw: `zzqq ${"z".repeat(290)}` },
      { key: "engine-stale", ageMs: 50 * 3_600_000 },
    );
    const o = healthy();
    o.watchdog = {
      ok: true,
      anomalies: Array.from({ length: 5 }, (_, i) => ({ agent: (["chaser", "dispatcher", "site-health", "outreach-health", "expiry-sweep"] as const)[i], kind: "failed" as const, detail: "x" })),
      runs: [],
    };
    o.sites = {
      ok: true,
      results: Array.from({ length: 14 }, (_, i): SiteResult => ({ name: `New${i}`, up: false, detail: "d", failure: "status", status: 503 })),
      savedAt: null,
      ownSaveJustFailed: true,
    };
    o.shikkstracker = { ok: false };
    o.today = { ...QUIET, events: [], missedLayers: [longName("A"), longName("B")], due: "unavailable" };
    o.since = { ticked: { titles: ["x".repeat(140)], total: 9 }, newDue: { titles: ["y".repeat(140)], total: 1 }, events: "unavailable", newDrafts: 12 };
    const d = buildDebrief({ now: NOW, outcomes: o, baseline: morning });
    expect(d.new).toHaveLength(DEBRIEF_BOUNDS.newProblems);
    await expect(new LastDebrief(d).validate()).resolves.toBeUndefined();
  });
});
