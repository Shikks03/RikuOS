import { describe, it, expect } from "vitest";
import { AGENT_NAMES, buildProblems, type MorningOutcomes } from "@/lib/problems";
import { AGENTS } from "@/models/AgentRun";

const healthy: MorningOutcomes = {
  expiry: { ok: true, unstuck: 0 },
  watchdog: { ok: true, anomalies: [] },
  siteHealth: { ok: true, sites: [{ name: "Meowchi", up: true, detail: "Meowchi ok" }], snapshotStored: true },
  outreachHealth: { ok: true, findings: [] },
};

describe("buildProblems", () => {
  it("reports nothing when every job succeeded and every site is up", () => {
    expect(buildProblems(healthy)).toEqual([]);
  });

  it("types a down site by how it failed, and leaves the healthy ones out", () => {
    const problems = buildProblems({
      ...healthy,
      siteHealth: {
        ok: true,
        snapshotStored: true,
        sites: [
          { name: "Meowchi", up: true, detail: "Meowchi ok" },
          { name: "AzeroTech", up: false, detail: "AzeroTech unreachable", failure: "unreachable" },
          { name: "Meowchi2", up: false, detail: "Meowchi2 returned HTTP 503", failure: "status", status: 503 },
          { name: "Slow", up: false, detail: "Slow timed out", failure: "timeout" },
        ],
      },
    });
    expect(problems).toEqual([
      { key: "site-unreachable", site: "AzeroTech" },
      { key: "site-status", site: "Meowchi2", status: 503 },
      { key: "site-timeout", site: "Slow" },
    ]);
  });

  it("reads a down site with no failure field (an old shape) as unreachable, never as up", () => {
    const problems = buildProblems({
      ...healthy,
      siteHealth: { ok: true, snapshotStored: true, sites: [{ name: "X", up: false, detail: "X unreachable" }] },
    });
    expect(problems).toEqual([{ key: "site-unreachable", site: "X" }]);
  });

  it("counts one failed expiry sweep once, not twice", () => {
    const problems = buildProblems({
      ...healthy,
      expiry: { ok: false, error: "mongo down", unstuck: 0 },
      watchdog: { ok: true, anomalies: [{ agent: "expiry-sweep", kind: "failed", detail: "expiry-sweep failed" }] },
    });
    expect(problems).toEqual([{ key: "job-failed", job: "expiry-sweep", raw: "mongo down" }]);
  });

  it("keeps an expiry-sweep anomaly that is NOT the duplicate", () => {
    const problems = buildProblems({
      ...healthy,
      expiry: { ok: false, error: "mongo down", unstuck: 0 },
      watchdog: {
        ok: true,
        anomalies: [{ agent: "expiry-sweep", kind: "stale", detail: "expiry-sweep last ran 31h ago", ageHours: 31 }],
      },
    });
    expect(problems).toContainEqual({ key: "agent-stale", agent: "expiry-sweep", ageHours: 31 });
  });

  it("names each failed morning job with its raw error, bounded", () => {
    const long = "x".repeat(2000);
    const problems = buildProblems({
      ...healthy,
      watchdog: { ok: false, error: long, anomalies: [] },
      siteHealth: { ok: false, error: "fetch failed", sites: [], snapshotStored: true },
      outreachHealth: { ok: false, error: "ST 503", findings: [] },
    });
    expect(problems).toEqual([
      { key: "job-failed", job: "watchdog", raw: "x".repeat(300) },
      { key: "job-failed", job: "site-health", raw: "fetch failed" },
      { key: "job-failed", job: "outreach-health", raw: "ST 503" },
    ]);
  });

  it("reports a job failure with no error as raw null, never the word unknown", () => {
    expect(buildProblems({ ...healthy, expiry: { ok: false, unstuck: 0 } })).toEqual([
      { key: "job-failed", job: "expiry-sweep", raw: null },
    ]);
  });

  it("names an unsaved site reading only when the job itself succeeded", () => {
    expect(buildProblems({ ...healthy, siteHealth: { ...healthy.siteHealth, snapshotStored: false } })).toEqual([
      { key: "snapshot-unsaved" },
    ]);
  });

  it("counts interrupted approved items", () => {
    expect(buildProblems({ ...healthy, expiry: { ok: true, unstuck: 2 } })).toEqual([{ key: "unstuck-items", count: 2 }]);
  });

  it("types every watchdog anomaly kind", () => {
    const problems = buildProblems({
      ...healthy,
      watchdog: {
        ok: true,
        anomalies: [
          { agent: "chaser", kind: "never-ran", detail: "chaser has never run" },
          { agent: "site-health", kind: "failed", detail: "site-health failed" },
          { agent: "dispatcher", kind: "degraded", detail: "dispatcher: 1 item failed", itemsFailed: 1 },
        ],
      },
    });
    expect(problems).toEqual([
      { key: "agent-never-ran", agent: "chaser" },
      { key: "agent-failed", agent: "site-health" },
      { key: "agent-degraded", agent: "dispatcher", itemsFailed: 1 },
    ]);
  });

  it("types every outreach finding kind", () => {
    const problems = buildProblems({
      ...healthy,
      outreachHealth: {
        ok: true,
        findings: [
          { kind: "engine-stale", detail: "…", ageMs: 50 * 3600_000 },
          { kind: "stranded-approved", detail: "…", count: 4 },
          { kind: "engine-errors", detail: "…", count: 3 },
          { kind: "engine-never-ran", detail: "…" },
          { kind: "engine-unreadable", detail: "…" },
        ],
      },
    });
    expect(problems).toEqual([
      { key: "engine-stale", ageMs: 50 * 3600_000 },
      { key: "stranded-approved", count: 4 },
      { key: "engine-errors", count: 3 },
      { key: "engine-never-ran" },
      { key: "engine-unreadable" },
    ]);
  });
});

describe("AGENT_NAMES", () => {
  it("names every agent in lower case, ready to start a sentence after capFirst", () => {
    for (const agent of AGENTS) {
      expect(AGENT_NAMES[agent]).toMatch(/^[a-z]/);
    }
    expect(AGENT_NAMES["site-health"]).toBe("the site check");
    expect(AGENT_NAMES.dispatcher).toBe("the morning run");
  });
});
