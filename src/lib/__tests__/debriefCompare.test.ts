import { describe, it, expect } from "vitest";
import {
  CANT_SAY,
  STANDALONE,
  baselineFromDigest,
  compareToBaseline,
  type Baseline,
  type SnapshotState,
  type SourceFlags,
} from "@/lib/debriefCompare";
import { toStoredSymptom } from "@/lib/digest";
import type { Problem } from "@/lib/problems";
import type { StoredDigest } from "@/lib/lastDigest";
import type { StoredSymptom } from "@/lib/briefingTypes";

const SENT_AT = new Date("2026-10-12T23:00:04.000Z"); // 07:00 Manila, Tue 13 Oct
const NOW = new Date("2026-10-13T05:04:00.000Z"); // 13:04 Manila
const OK: SourceFlags = { sites: false, watchdog: false, shikkstracker: false };
/** A snapshot saved half a minute before the press — after 07:00. */
const SAVED_SINCE: SnapshotState = { checkedAt: new Date("2026-10-13T05:03:30.000Z"), ownSaveJustFailed: false };

function base(...problems: Problem[]): Baseline {
  return { sentAt: SENT_AT, symptoms: problems.map((p) => toStoredSymptom(p)) };
}
/** A symptom as a 07:00 record saved before `subject` existed reads back. */
function subjectless(p: Problem): StoredSymptom {
  return { ...toStoredSymptom(p), subject: null };
}
function cmp(b: Baseline | null, fresh: Problem[], failed: SourceFlags = OK, snap: SnapshotState = SAVED_SINCE) {
  return compareToBaseline(b, fresh, snap, failed);
}

describe("baselineFromDigest (D5)", () => {
  const a = toStoredSymptom({ key: "site-timeout", site: "Meowchi" });
  const c = toStoredSymptom({ key: "todos-unavailable" });
  const digest: StoredDigest = {
    sentAt: SENT_AT,
    title: "T",
    body: "B",
    devices: 1,
    seenAt: null,
    briefing: {
      stories: [
        { sentence: "s1", bold: [], symptoms: [a] },
        { sentence: "s2", bold: [], symptoms: [c] },
      ],
      today: "",
      freelance: null,
      off: null,
      unrecognised: 0,
      omitted: 0,
    },
  };

  it("flattens today's stories into their symptoms, in report order", () => {
    expect(baselineFromDigest(digest, NOW)).toEqual({ sentAt: SENT_AT, symptoms: [a, c] });
  });

  it("is null with no digest, one with no structured Briefing, or one from another day", () => {
    expect(baselineFromDigest(null, NOW)).toBeNull();
    expect(baselineFromDigest({ ...digest, briefing: null }, NOW)).toBeNull();
    expect(baselineFromDigest({ ...digest, sentAt: new Date("2026-10-11T23:00:00.000Z") }, NOW)).toBeNull();
  });

  it("still takes a morning that reached no device — it was saved", () => {
    expect(baselineFromDigest({ ...digest, devices: 0 }, NOW)).not.toBeNull();
  });
});

describe("no baseline (D5)", () => {
  it("puts every fresh problem in `now`, every failed source standalone, and nothing else", () => {
    const fresh: Problem[] = [{ key: "site-timeout", site: "Meowchi" }, { key: "todos-unavailable" }];
    expect(cmp(null, fresh, { ...OK, shikkstracker: true })).toEqual({
      sorted: [],
      stillNeedsYou: [],
      new: [],
      now: fresh,
      standaloneCouldntCheck: ["shikkstracker"],
      couldntCheck: { sites: false, watchdog: false, shikkstracker: true },
    });
  });
});

/** Every key a Debrief re-checks by matching, with its approved Sorted sentence. */
const RECHECKED: Array<[string, Problem, string]> = [
  ["site-status", { key: "site-status", site: "Meowchi", status: 503 }, "Meowchi's site is back up."],
  ["site-timeout", { key: "site-timeout", site: "Meowchi" }, "Meowchi's site is back up."],
  ["site-unreachable", { key: "site-unreachable", site: "AzeroTech" }, "AzeroTech's site is back up."],
  ["agent-never-ran", { key: "agent-never-ran", agent: "chaser" }, "The chaser is running again."],
  ["agent-stale", { key: "agent-stale", agent: "chaser", ageHours: 31 }, "The chaser is running again."],
  ["agent-failed", { key: "agent-failed", agent: "dispatcher" }, "The morning run is running again."],
  ["agent-degraded", { key: "agent-degraded", agent: "chaser", itemsFailed: 2 }, "The chaser is running again."],
  ["engine-never-ran", { key: "engine-never-ran" }, "ShikksTracker's sender is moving again."],
  ["engine-unreadable", { key: "engine-unreadable" }, "ShikksTracker's sender is moving again."],
  ["engine-stale", { key: "engine-stale", ageMs: 40 * 3_600_000 }, "ShikksTracker's sender is moving again."],
  ["engine-errors", { key: "engine-errors", count: 3 }, "ShikksTracker's sender is moving again."],
  ["stranded-approved", { key: "stranded-approved", count: 2 }, "ShikksTracker's sender is moving again."],
  ["calendar-unavailable", { key: "calendar-unavailable", cause: "expired" }, "Your calendar's answering again."],
  ["calendar-partial", { key: "calendar-partial", calendars: ["Work"] }, "Your calendar's answering again."],
  ["todos-unavailable", { key: "todos-unavailable" }, "I can read your to-dos again."],
];

describe.each(RECHECKED)("%s, re-checked on a press", (_key, p, sortedSentence) => {
  it("still there → Still needs you, re-explained from the fresh problem", () => {
    const r = cmp(base(p), [p]);
    expect(r.stillNeedsYou).toEqual([{ kind: "fresh", problem: p }]);
    expect(r.sorted).toEqual([]);
    expect(r.new).toEqual([]);
  });

  it("gone → Sorted, with its own fixed sentence", () => {
    const r = cmp(base(p), []);
    expect(r.sorted).toEqual([{ key: p.key, subject: toStoredSymptom(p).subject, sentence: sortedSentence }]);
    expect(r.stillNeedsYou).toEqual([]);
    expect(r.new).toEqual([]);
  });

  it("not there at 07:00 → New", () => {
    const r = cmp(base(), [p]);
    expect(r.new).toEqual([p]);
    expect(r.sorted).toEqual([]);
    expect(r.stillNeedsYou).toEqual([]);
  });

  it("the same, for a 07:00 record saved before `subject` existed", () => {
    const old: Baseline = { sentAt: SENT_AT, symptoms: [subjectless(p)] };
    expect(cmp(old, [p]).stillNeedsYou).toEqual([{ kind: "fresh", problem: p }]);
    expect(cmp(old, []).sorted.map((s) => s.sentence)).toEqual([sortedSentence]);
  });
});

describe("a check that broke this morning (job-failed)", () => {
  it.each([
    ["watchdog", "The watchdog ran clean just now."],
    ["site-health", "The site check ran clean just now."],
    ["outreach-health", "The outreach check ran clean just now."],
  ] as const)("%s, with its source answering now → Sorted", (job, sentence) => {
    const r = cmp(base({ key: "job-failed", job, raw: null }), []);
    expect(r.sorted).toEqual([{ key: "job-failed", subject: job, sentence }]);
    expect(r.stillNeedsYou).toEqual([]);
  });

  it.each([
    ["watchdog", "watchdog"],
    ["site-health", "sites"],
    ["outreach-health", "shikkstracker"],
  ] as const)("%s, with its source failing now → can't say, never Sorted", (job, source) => {
    const p: Problem = { key: "job-failed", job, raw: null };
    const r = cmp(base(p), [], { ...OK, [source]: true });
    expect(r.sorted).toEqual([]);
    expect(r.stillNeedsYou).toEqual([{ kind: "couldnt-check", symptom: toStoredSymptom(p), source }]);
    expect(r.standaloneCouldntCheck).toEqual([]);
  });
});

describe("a source that failed wholesale on this press (spec §3.4, §3.5)", () => {
  const siteP: Problem = { key: "site-status", site: "Meowchi", status: 503 };
  const agentP: Problem = { key: "agent-stale", agent: "chaser", ageHours: 31 };
  const engineP: Problem = { key: "engine-stale", ageMs: 40 * 3_600_000 };
  const pipeP: Problem = { key: "pipeline-unavailable", raw: null };
  const morning = base(siteP, agentP, engineP, pipeP);

  it.each([
    ["sites", [siteP]],
    ["watchdog", [agentP]],
    ["shikkstracker", [engineP, pipeP]],
  ] as const)("%s: every symptom from it is can't-say — never Sorted, never New, no standalone", (source, affected) => {
    const r = cmp(morning, [], { ...OK, [source]: true });
    expect(r.stillNeedsYou.filter((row) => row.kind === "couldnt-check")).toEqual(
      affected.map((p) => ({ kind: "couldnt-check", symptom: toStoredSymptom(p), source })),
    );
    for (const p of affected) expect(r.sorted.some((s) => s.key === p.key)).toBe(false);
    expect(r.new).toEqual([]);
    expect(r.standaloneCouldntCheck).toEqual([]);
  });

  it("more than one at once", () => {
    const r = cmp(morning, [], { sites: true, watchdog: true, shikkstracker: true });
    expect(r.stillNeedsYou.map((row) => row.kind)).toEqual(["couldnt-check", "couldnt-check", "couldnt-check", "couldnt-check"]);
    expect(r.sorted).toEqual([]);
    expect(r.new).toEqual([]);
    expect(r.standaloneCouldntCheck).toEqual([]);
  });

  it("a failed source with nothing from it this morning gets exactly one standalone line", () => {
    const r = cmp(base({ key: "todos-unavailable" }), [{ key: "todos-unavailable" }], { ...OK, shikkstracker: true });
    expect(r.standaloneCouldntCheck).toEqual(["shikkstracker"]);
    expect(r.stillNeedsYou).toEqual([{ kind: "fresh", problem: { key: "todos-unavailable" } }]);
  });

  it("one source failing never hides another source's real news", () => {
    const fresh: Problem[] = [{ key: "site-timeout", site: "AzeroTech" }];
    expect(cmp(base(agentP), fresh, { ...OK, watchdog: true }).new).toEqual(fresh);
  });
});

describe("the two things a Debrief can't re-check (spec §3.5)", () => {
  const unstuck: Problem = { key: "unstuck-items", count: 2 };
  const sweep: Problem = { key: "job-failed", job: "expiry-sweep", raw: "MongoNetworkError: closed" };

  it.each([
    ["nothing fresh", [] as Problem[], OK],
    ["a busy fresh list", [{ key: "agent-failed", agent: "expiry-sweep" }, { key: "site-timeout", site: "Meowchi" }] as Problem[], OK],
    ["every source failing", [] as Problem[], { sites: true, watchdog: true, shikkstracker: true }],
  ])("always Still needs you, verbatim, with %s", (_label, fresh, failed) => {
    const r = cmp(base(unstuck, sweep), fresh, failed);
    expect(r.stillNeedsYou).toEqual([
      { kind: "verbatim", symptom: toStoredSymptom(unstuck) },
      { kind: "verbatim", symptom: toStoredSymptom(sweep) },
    ]);
    expect(r.sorted).toEqual([]);
  });

  it("a job-failed saved before `subject` existed can't be placed, so it stays verbatim (plan deviation 2)", () => {
    const old = subjectless({ key: "job-failed", job: "watchdog", raw: null });
    expect(cmp({ sentAt: SENT_AT, symptoms: [old] }, []).stillNeedsYou).toEqual([{ kind: "verbatim", symptom: old }]);
  });
});

describe("snapshot-unsaved — re-checked by when a snapshot last saved (spec §3.5)", () => {
  const morning = base({ key: "snapshot-unsaved" });

  it("this press's own save just failed → Still needs you, and not New as well", () => {
    const r = cmp(morning, [{ key: "snapshot-unsaved" }], OK, { checkedAt: SENT_AT, ownSaveJustFailed: true });
    expect(r.stillNeedsYou).toEqual([{ kind: "fresh", problem: { key: "snapshot-unsaved" } }]);
    expect(r.new).toEqual([]);
    expect(r.sorted).toEqual([]);
  });

  it("saved since this morning → Sorted", () => {
    const r = cmp(morning, [], OK, { checkedAt: new Date(SENT_AT.getTime() + 1), ownSaveJustFailed: false });
    expect(r.sorted).toEqual([{ key: "snapshot-unsaved", subject: null, sentence: "Today's site check is saved now." }]);
  });

  it("not saved since this morning (or never) → Still needs you", () => {
    for (const checkedAt of [SENT_AT, new Date(SENT_AT.getTime() - 60_000), null]) {
      const r = cmp(morning, [], OK, { checkedAt, ownSaveJustFailed: false });
      expect(r.stillNeedsYou).toEqual([{ kind: "fresh", problem: { key: "snapshot-unsaved" } }]);
      expect(r.sorted).toEqual([]);
    }
  });

  it("a fresh save failure with nothing at 07:00 is New", () => {
    const r = cmp(base(), [{ key: "snapshot-unsaved" }], OK, { checkedAt: null, ownSaveJustFailed: true });
    expect(r.new).toEqual([{ key: "snapshot-unsaved" }]);
  });
});

describe("matching by what a problem is about", () => {
  it("a site that went from an error to timing out still needs you — never 'back up' (plan deviation 1)", () => {
    const r = cmp(base({ key: "site-status", site: "Meowchi", status: 503 }), [{ key: "site-timeout", site: "Meowchi" }]);
    expect(r.stillNeedsYou).toEqual([{ kind: "fresh", problem: { key: "site-timeout", site: "Meowchi" } }]);
    expect(r.sorted).toEqual([]);
    expect(r.new).toEqual([]);
  });

  it("an agent that went from stale to failed still needs you", () => {
    const r = cmp(base({ key: "agent-stale", agent: "chaser", ageHours: 31 }), [{ key: "agent-failed", agent: "chaser" }]);
    expect(r.stillNeedsYou).toEqual([{ kind: "fresh", problem: { key: "agent-failed", agent: "chaser" } }]);
  });

  it("a different site is a different thing: one Sorted, one New", () => {
    const r = cmp(base({ key: "site-timeout", site: "Meowchi" }), [{ key: "site-timeout", site: "AzeroTech" }]);
    expect(r.sorted.map((s) => s.sentence)).toEqual(["Meowchi's site is back up."]);
    expect(r.new).toEqual([{ key: "site-timeout", site: "AzeroTech" }]);
  });

  it("a subject-less stale agent matches a fresh one whose hours have grown (plan deviation 2)", () => {
    const old: Baseline = { sentAt: SENT_AT, symptoms: [subjectless({ key: "agent-stale", agent: "chaser", ageHours: 31 })] };
    const later: Problem = { key: "agent-stale", agent: "chaser", ageHours: 37 };
    expect(cmp(old, [later]).stillNeedsYou).toEqual([{ kind: "fresh", problem: later }]);
  });

  it("a subject-less site never matches a different site", () => {
    const old: Baseline = { sentAt: SENT_AT, symptoms: [subjectless({ key: "site-timeout", site: "Meowchi" })] };
    const r = cmp(old, [{ key: "site-timeout", site: "AzeroTech" }]);
    expect(r.sorted.map((s) => s.sentence)).toEqual(["Meowchi's site is back up."]);
    expect(r.new).toEqual([{ key: "site-timeout", site: "AzeroTech" }]);
  });

  it("calendar-partial: a changed failing set reads as one Sorted and one New, never merged (spec §3.5)", () => {
    const r = cmp(base({ key: "calendar-partial", calendars: ["Work", "Classes"] }), [{ key: "calendar-partial", calendars: ["Work"] }]);
    expect(r.sorted).toEqual([{ key: "calendar-partial", subject: "Classes, Work", sentence: "Your calendar's answering again." }]);
    expect(r.new).toEqual([{ key: "calendar-partial", calendars: ["Work"] }]);
  });

  it("keeps report order within each group (spec §3.5)", () => {
    const agentP: Problem = { key: "agent-failed", agent: "chaser" };
    const siteP: Problem = { key: "site-timeout", site: "Meowchi" };
    const todos: Problem = { key: "todos-unavailable" };
    const newSite: Problem = { key: "site-unreachable", site: "AzeroTech" };
    const r = cmp(base(agentP, siteP, todos), [todos, newSite, agentP]);
    expect(r.stillNeedsYou).toEqual([
      { kind: "fresh", problem: agentP },
      { kind: "fresh", problem: todos },
    ]);
    expect(r.sorted.map((s) => s.sentence)).toEqual(["Meowchi's site is back up."]);
    expect(r.new).toEqual([newSite]);
  });

  it("still resolves sanely if a fresh job-failed or pipeline-unavailable ever slipped through", () => {
    const fresh: Problem[] = [{ key: "job-failed", job: "watchdog", raw: null }, { key: "pipeline-unavailable", raw: null }];
    expect(cmp(base(), fresh).new).toEqual(fresh);
    const pipe: Problem = { key: "pipeline-unavailable", raw: null };
    expect(cmp(base(pipe), [pipe]).stillNeedsYou).toEqual([{ kind: "fresh", problem: pipe }]);
  });
});

describe("the approved words (spec §10 items 4, 4a)", () => {
  it("the can't-say notes and the standalone lines, word for word", () => {
    expect(CANT_SAY).toEqual({
      sites: "I couldn't check your sites just now, so I can't say whether that's sorted.",
      watchdog: "I couldn't check the run history just now, so I can't say whether that's sorted.",
      shikkstracker: "I couldn't reach ShikksTracker just now, so I can't say whether that's sorted.",
    });
    expect(STANDALONE).toEqual({
      sites: "I couldn't check your sites just now.",
      watchdog: "I couldn't check the run history just now.",
      shikkstracker: "I couldn't reach ShikksTracker just now.",
    });
  });
});

describe("fix round (feature review D-II, plan deviation 21)", () => {
  describe("a morning job failure's watchdog twin must never also surface", () => {
    it("ShikksTracker back up: the job's Sorted row covers its own watchdog twin too", () => {
      const r = cmp(base({ key: "job-failed", job: "outreach-health", raw: "boom" }), [
        { key: "agent-failed", agent: "outreach-health" },
      ]);
      expect(r.sorted).toEqual([
        { key: "job-failed", subject: "outreach-health", sentence: "The outreach check ran clean just now." },
      ]);
      expect(r.stillNeedsYou).toEqual([]);
      expect(r.new).toEqual([]);
    });

    it("ShikksTracker still down: the can't-say row covers its own watchdog twin too", () => {
      const p: Problem = { key: "job-failed", job: "outreach-health", raw: "boom" };
      const r = cmp(base(p), [{ key: "agent-failed", agent: "outreach-health" }], { ...OK, shikkstracker: true });
      expect(r.stillNeedsYou).toEqual([{ kind: "couldnt-check", symptom: toStoredSymptom(p), source: "shikkstracker" }]);
      expect(r.sorted).toEqual([]);
      expect(r.new).toEqual([]);
    });

    it("snapshot saved now: the Sorted row covers a fresh agent-degraded{site-health} twin too", () => {
      const r = cmp(
        base({ key: "snapshot-unsaved" }),
        [{ key: "agent-degraded", agent: "site-health", itemsFailed: 1 }],
        OK,
        { checkedAt: new Date(SENT_AT.getTime() + 1), ownSaveJustFailed: false },
      );
      expect(r.sorted).toEqual([{ key: "snapshot-unsaved", subject: null, sentence: "Today's site check is saved now." }]);
      expect(r.stillNeedsYou).toEqual([]);
      expect(r.new).toEqual([]);
    });
  });

  describe("engine-* keys are one family: a changed engine finding is never Sorted + New", () => {
    it("errors → stale stays Still needs you", () => {
      const fresh: Problem = { key: "engine-stale", ageMs: 40 * 3_600_000 };
      const r = cmp(base({ key: "engine-errors", count: 3 }), [fresh]);
      expect(r.stillNeedsYou).toEqual([{ kind: "fresh", problem: fresh }]);
      expect(r.sorted).toEqual([]);
      expect(r.new).toEqual([]);
    });

    it("unreadable → stale stays Still needs you", () => {
      const fresh: Problem = { key: "engine-stale", ageMs: 10 * 3_600_000 };
      const r = cmp(base({ key: "engine-unreadable" }), [fresh]);
      expect(r.stillNeedsYou).toEqual([{ kind: "fresh", problem: fresh }]);
      expect(r.sorted).toEqual([]);
      expect(r.new).toEqual([]);
    });
  });

  describe("calendar-unavailable and calendar-partial are the same read, two shapes", () => {
    it("unavailable → partial stays Still needs you", () => {
      const fresh: Problem = { key: "calendar-partial", calendars: ["Work"] };
      const r = cmp(base({ key: "calendar-unavailable", cause: "expired" }), [fresh]);
      expect(r.stillNeedsYou).toEqual([{ kind: "fresh", problem: fresh }]);
      expect(r.sorted).toEqual([]);
      expect(r.new).toEqual([]);
    });

    it("partial → unavailable stays Still needs you", () => {
      const fresh: Problem = { key: "calendar-unavailable", cause: "timeout" };
      const r = cmp(base({ key: "calendar-partial", calendars: ["Work"] }), [fresh]);
      expect(r.stillNeedsYou).toEqual([{ kind: "fresh", problem: fresh }]);
      expect(r.sorted).toEqual([]);
      expect(r.new).toEqual([]);
    });
  });

  describe("the sites check itself failing on this press is 'couldn't check', never a fresh 'couldn't save'", () => {
    it("snapshot-unsaved at 07:00, sites check throws now, nothing saved since → couldn't-check, and covers the standalone sites line", () => {
      const r = cmp(base({ key: "snapshot-unsaved" }), [], { ...OK, sites: true }, { checkedAt: null, ownSaveJustFailed: false });
      expect(r.stillNeedsYou).toEqual([
        { kind: "couldnt-check", symptom: toStoredSymptom({ key: "snapshot-unsaved" }), source: "sites" },
      ]);
      expect(r.sorted).toEqual([]);
      expect(r.new).toEqual([]);
      expect(r.standaloneCouldntCheck).toEqual([]);
    });
  });
});
