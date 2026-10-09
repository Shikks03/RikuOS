import { describe, it, expect } from "vitest";
import { explain, matchRaw } from "@/lib/causes";
import type { Problem } from "@/lib/problems";
import { BRIEFING_BOUNDS } from "@/lib/briefingTypes";

const boldText = (s: { text: string; bold: { start: number; end: number }[] }) =>
  s.bold.map((r) => s.text.slice(r.start, r.end));

describe("matchRaw — first match wins, in the spec's order", () => {
  const cases: Array<[string, string]> = [
    ["connect ETIMEDOUT 1.2.3.4:443", "timeout"],
    ["The operation was aborted due to timeout", "timeout"],
    ["getaddrinfo ENOTFOUND api.x", "network"],
    ["connect ECONNREFUSED 127.0.0.1", "network"],
    ["read ECONNRESET", "network"],
    ["MongoServerSelectionError: Server selection timed out after 10000 ms", "timeout"],
    ["MongoNetworkError: connection closed", "database"],
    ["MongooseServerSelectionError: could not connect", "database"],
    ["invalid_grant: Token has been expired or revoked", "auth"],
    ["ShikksTracker answered 401", "auth"],
    ["answered 403 Forbidden", "forbidden"],
    ["answered 429", "rate-limit"],
    ["ShikksTracker answered HTTP 503", "upstream"],
    ["something nobody planned for", "unrecognised"],
  ];
  it.each(cases)("%s → %s", (raw, key) => {
    expect(matchRaw(raw).causeKey).toBe(key);
  });

  it("matches numbers only as whole tokens", () => {
    expect(matchRaw("item 24019 failed").causeKey).toBe("unrecognised");
    expect(matchRaw("id 5031 rejected").causeKey).toBe("unrecognised");
  });

  it("words every pattern-matched cause as likely, and the unrecognised one honestly", () => {
    for (const [raw] of cases.slice(0, -1)) expect(matchRaw(raw).cause.text).toMatch(/^Most likely /);
    expect(matchRaw("something nobody planned for").cause.text).toBe("I don't recognise this one. The raw error is below.");
  });
});

describe("explain — every catalogue row", () => {
  const rows: Array<[Problem, string, RegExp, string]> = [
    [{ key: "site-status", site: "Meowchi", status: 503 }, "Meowchi's site isn't answering (error 503).", /latest deploy on Vercel/, "fixed"],
    [{ key: "site-timeout", site: "AzeroTech" }, "AzeroTech's site took too long to answer.", /see if it loads/, "fixed"],
    [{ key: "site-unreachable", site: "ShikksTracker" }, "ShikksTracker's site can't be reached at all.", /still exist/, "fixed"],
    [{ key: "agent-never-ran", agent: "site-health" }, "The site check has never run.", /vercel\.json/, "fixed"],
    [{ key: "agent-stale", agent: "chaser", ageHours: 31 }, "The chaser hasn't run in 31 hours.", /Crons/, "fixed"],
    [{ key: "agent-stale", agent: "chaser", ageHours: 72 }, "The chaser hasn't run in 3 days.", /Crons/, "fixed"],
    [{ key: "agent-failed", agent: "chaser" }, "The chaser failed on its last run.", /last run's error/, "none"],
    [{ key: "agent-degraded", agent: "chaser", itemsFailed: 2 }, "The chaser's last run had two items that didn't go through.", /failed items/, "fixed"],
    [{ key: "job-failed", job: "site-health", raw: "connect ETIMEDOUT" }, "The site check broke this morning.", /last run's error/, "timeout"],
    [{ key: "job-failed", job: "site-health", raw: null }, "The site check broke this morning.", /last run's error/, "none"],
    [{ key: "snapshot-unsaved" }, "I checked the sites but couldn't save the result.", /gone tomorrow/, "fixed"],
    [{ key: "unstuck-items", count: 2 }, "Two approved items couldn't confirm they went through.", /before resending/, "fixed"],
    [{ key: "unstuck-items", count: 1 }, "One approved item couldn't confirm it went through.", /before resending/, "fixed"],
    [{ key: "engine-never-ran" }, "ShikksTracker's sender has never reported a run.", /pinger/, "fixed"],
    [{ key: "engine-unreadable" }, "ShikksTracker's sender reported a run time I can't read.", /run record/, "fixed"],
    [{ key: "engine-stale", ageMs: 50 * 3600_000 }, "ShikksTracker's sender hasn't run in 2 days.", /pinger/, "fixed"],
    [{ key: "engine-errors", count: 3 }, "ShikksTracker's sender hit three errors on its last run.", /last run in ShikksTracker/, "fixed"],
    [{ key: "stranded-approved", count: 4 }, "Four approved messages are stuck, unsent.", /Fix the sender first/, "fixed"],
    [{ key: "pipeline-unavailable", raw: "ShikksTracker answered HTTP 502" }, "I couldn't reach ShikksTracker, so I don't know how freelance is going.", /check it's up/, "upstream"],
    [{ key: "calendar-unavailable", cause: "expired" }, "I couldn't read your calendar.", /Settings/, "known"],
    [{ key: "calendar-unavailable", cause: "read-failed" }, "I couldn't read your calendar.", /Settings/, "none"],
    [{ key: "calendar-partial", calendars: ["Classes"] }, "I couldn't read your Classes calendar, so today might be missing something.", /still exists/, "fixed"],
    [{ key: "calendar-partial", calendars: ["Classes", "Events"] }, "I couldn't read your Classes and Events calendars, so today might be missing something.", /still exist/, "fixed"],
    [{ key: "todos-unavailable" }, "I couldn't read your to-dos.", /Reload/, "fixed"],
  ];

  it.each(rows)("%o", (problem, sentence, nextStep, causeKey) => {
    const e = explain(problem);
    expect(e.sentence.text).toBe(sentence);
    expect(e.nextStep).toMatch(nextStep);
    expect(e.causeKey).toBe(causeKey);
    expect(e.sentence.bold.length).toBeGreaterThan(0);
    expect(e.cause.bold.length).toBeGreaterThan(0);
    expect(e.sentence.text).not.toMatch(/’/); // push-form: straight apostrophes only
  });

  it("bolds the subject of the sentence", () => {
    expect(boldText(explain({ key: "site-status", site: "Meowchi", status: 503 }).sentence)).toEqual(["Meowchi's site"]);
    expect(boldText(explain({ key: "agent-failed", agent: "chaser" }).sentence)).toEqual(["The chaser"]);
  });

  it("picks the site-status cause by status class", () => {
    expect(explain({ key: "site-status", site: "M", status: 502 }).cause.text).toMatch(/crashing or mid-deploy/);
    expect(explain({ key: "site-status", site: "M", status: 404 }).cause.text).toMatch(/removed/);
    expect(explain({ key: "site-status", site: "M", status: 401 }).cause.text).toMatch(/login/);
    expect(explain({ key: "site-status", site: "M", status: 418 }).cause.text).toMatch(/refused the request/);
  });

  it("states a known calendar cause plainly, without 'Most likely'", () => {
    expect(explain({ key: "calendar-unavailable", cause: "not-configured" }).cause.text).toBe("Google isn't connected.");
    expect(explain({ key: "calendar-unavailable", cause: "expired" }).cause.text).toBe("Google access has expired.");
    expect(explain({ key: "calendar-unavailable", cause: "timeout" }).cause.text).toBe("Google didn't answer in time.");
  });

  it("carries the raw error only where there is one", () => {
    expect(explain({ key: "job-failed", job: "watchdog", raw: "boom" }).raw).toBe("boom");
    expect(explain({ key: "snapshot-unsaved" }).raw).toBeNull();
  });
});

describe("a raw error never leaks into sentence, next step or cause text", () => {
  // A marker distinctive enough that it could never appear in hand-written
  // catalogue prose. If it shows up in sentence/nextStep/cause, raw has
  // leaked out of its own field (the rule the feature review called out).
  const MARKER = "RAW_MARKER_9f3e1c_should_never_appear_in_prose";

  it("job-failed: raw travels only in e.raw", () => {
    const e = explain({ key: "job-failed", job: "watchdog", raw: MARKER });
    expect(e.sentence.text).not.toContain(MARKER);
    expect(e.nextStep).not.toContain(MARKER);
    expect(e.cause.text).not.toContain(MARKER);
    expect(e.raw).toBe(MARKER);
  });

  it("pipeline-unavailable: raw travels only in e.raw", () => {
    const e = explain({ key: "pipeline-unavailable", raw: MARKER });
    expect(e.sentence.text).not.toContain(MARKER);
    expect(e.nextStep).not.toContain(MARKER);
    expect(e.cause.text).not.toContain(MARKER);
    expect(e.raw).toBe(MARKER);
  });

  it("an unrecognised raw error still keeps the raw out of the cause sentence", () => {
    const e = explain({ key: "job-failed", job: "watchdog", raw: "something nobody planned for" });
    expect(e.causeKey).toBe("unrecognised");
    expect(e.cause.text).toBe("I don't recognise this one. The raw error is below.");
    expect(e.cause.text).not.toContain("something nobody planned for");
  });
});

describe("every catalogue row stays within BRIEFING_BOUNDS, for worst-case realistic input", () => {
  // Real-world worst cases this app actually allows: a site name as long as
  // HealthSnapshot's schema permits (60, src/models/HealthSnapshot.ts), a
  // calendar name as long as OsSettings' layer name permits (120,
  // LAYER_NAME_MAX in src/models/OsSettings.ts), and counts that read as
  // plain digits once past voice.ts's numberWord() word-list (>10).
  const LONG_SITE = "A".repeat(60);
  const LONG_AGENT = "outreach-health" as const; // longest AGENT_NAMES value
  const LONG_CAL_1 = "C".repeat(120);
  const LONG_CAL_2 = "D".repeat(120);
  const BIG = 999_999;

  const worstCase: Problem[] = [
    { key: "site-status", site: LONG_SITE, status: 503 },
    { key: "site-timeout", site: LONG_SITE },
    { key: "site-unreachable", site: LONG_SITE },
    { key: "agent-never-ran", agent: LONG_AGENT },
    { key: "agent-stale", agent: LONG_AGENT, ageHours: 100_000 },
    { key: "agent-failed", agent: LONG_AGENT },
    { key: "agent-degraded", agent: LONG_AGENT, itemsFailed: BIG },
    { key: "job-failed", job: LONG_AGENT, raw: "x".repeat(BRIEFING_BOUNDS.raw) },
    { key: "job-failed", job: LONG_AGENT, raw: null },
    { key: "snapshot-unsaved" },
    { key: "unstuck-items", count: BIG },
    { key: "unstuck-items", count: 1 },
    { key: "engine-never-ran" },
    { key: "engine-unreadable" },
    { key: "engine-stale", ageMs: BIG * 3_600_000 },
    { key: "engine-errors", count: BIG },
    { key: "stranded-approved", count: BIG },
    { key: "pipeline-unavailable", raw: "x".repeat(BRIEFING_BOUNDS.raw) },
    { key: "pipeline-unavailable", raw: null },
    { key: "calendar-unavailable", cause: "not-configured" },
    { key: "calendar-unavailable", cause: "expired" },
    { key: "calendar-unavailable", cause: "timeout" },
    { key: "calendar-unavailable", cause: "read-failed" },
    { key: "calendar-partial", calendars: [LONG_CAL_1] },
    { key: "calendar-partial", calendars: [LONG_CAL_1, LONG_CAL_2] },
    { key: "todos-unavailable" },
  ];

  it.each(worstCase.map((p) => [p] as const))("%o", (p) => {
    const e = explain(p);
    expect(e.sentence.text.length).toBeLessThanOrEqual(BRIEFING_BOUNDS.symptomSentence);
    expect(e.nextStep.length).toBeLessThanOrEqual(BRIEFING_BOUNDS.nextStep);
    expect(e.cause.text.length).toBeLessThanOrEqual(BRIEFING_BOUNDS.cause);
    for (const r of e.sentence.bold) {
      expect(r.start).toBeGreaterThanOrEqual(0);
      expect(r.end).toBeLessThanOrEqual(e.sentence.text.length);
      expect(r.start).toBeLessThanOrEqual(r.end);
    }
    for (const r of e.cause.bold) {
      expect(r.start).toBeGreaterThanOrEqual(0);
      expect(r.end).toBeLessThanOrEqual(e.cause.text.length);
      expect(r.start).toBeLessThanOrEqual(r.end);
    }
  });
});
