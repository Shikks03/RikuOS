/**
 * The morning route's only branching logic — what Riku is actually told.
 * Extracted from the route so it can be tested: inverting one condition here
 * would report every healthy site as down, and nothing else would notice.
 */

import { describe, it, expect } from "vitest";
import { buildProblems } from "@/lib/digest";
import type { MorningOutcomes } from "@/lib/digest";

const healthy: MorningOutcomes = {
  expiry: { ok: true, unstuck: 0 },
  watchdog: { ok: true, anomalies: [] },
  siteHealth: { ok: true, sites: [{ name: "Meowchi", up: true, detail: "Meowchi ok" }] },
  outreachHealth: { ok: true, findings: [] },
};

describe("buildProblems", () => {
  it("reports nothing when every job succeeded and every site is up", () => {
    expect(buildProblems(healthy)).toEqual([]);
  });

  it("names a down site and leaves the healthy ones out", () => {
    const problems = buildProblems({
      ...healthy,
      siteHealth: {
        ok: true,
        sites: [
          { name: "Meowchi", up: true, detail: "Meowchi ok" },
          { name: "AzeroTech", up: false, detail: "AzeroTech unreachable" },
        ],
      },
    });
    expect(problems).toEqual(["AzeroTech unreachable"]);
  });

  it("counts one failed expiry sweep once, not twice", () => {
    // The sweep runs before the watchdog AND writes its record first, so the
    // watchdog re-reads the row just written. Without the filter this reads as
    // two problems and the push title's count is wrong.
    const problems = buildProblems({
      ...healthy,
      expiry: { ok: false, error: "mongo down", unstuck: 0 },
      watchdog: {
        ok: true,
        anomalies: [
          { agent: "expiry-sweep", kind: "failed", detail: "expiry-sweep failed" },
        ],
      },
    });
    expect(problems).toEqual(["expiry sweep failed: mongo down"]);
  });

  it("keeps an expiry-sweep anomaly that is NOT the duplicate", () => {
    // Only a `failed` anomaly from a sweep that failed here is a duplicate.
    // A stale record, or a degraded one, is real news and must survive.
    const problems = buildProblems({
      ...healthy,
      expiry: { ok: true, unstuck: 0 },
      watchdog: {
        ok: true,
        anomalies: [
          { agent: "expiry-sweep", kind: "stale", detail: "expiry-sweep last ran 31h ago" },
        ],
      },
    });
    expect(problems).toEqual(["expiry-sweep last ran 31h ago"]);
  });

  it("still reports anomalies for agents other than the expiry sweep", () => {
    const problems = buildProblems({
      ...healthy,
      expiry: { ok: false, error: "mongo down", unstuck: 0 },
      watchdog: {
        ok: true,
        anomalies: [
          { agent: "chaser", kind: "never-ran", detail: "chaser has never run" },
          { agent: "expiry-sweep", kind: "failed", detail: "expiry-sweep failed" },
        ],
      },
    });
    expect(problems).toEqual(["expiry sweep failed: mongo down", "chaser has never run"]);
  });

  it("raises interrupted actions, pluralised", () => {
    expect(buildProblems({ ...healthy, expiry: { ok: true, unstuck: 1 } })).toEqual([
      "1 approved item could not confirm their result",
    ]);
    expect(buildProblems({ ...healthy, expiry: { ok: true, unstuck: 3 } })).toEqual([
      "3 approved items could not confirm their result",
    ]);
  });

  it("names a failed watchdog and a failed site check, falling back when there is no message", () => {
    const problems = buildProblems({
      ...healthy,
      watchdog: { ok: false, anomalies: [] },
      siteHealth: { ok: false, error: "boom", sites: [] },
    });
    expect(problems).toEqual(["watchdog failed: unknown", "site health failed: boom"]);
  });

  it("passes outreach findings straight through", () => {
    const problems = buildProblems({
      ...healthy,
      outreachHealth: {
        ok: true,
        findings: [
          { kind: "engine-stale", detail: "ShikksTracker send engine last ran 29d ago" },
          { kind: "stranded-approved", detail: "2 approved messages are stranded, unsent" },
        ],
      },
    });
    expect(problems).toEqual([
      "ShikksTracker send engine last ran 29d ago",
      "2 approved messages are stranded, unsent",
    ]);
  });

  it("names a failed outreach check distinctly from the attention failure", () => {
    // composeDigest adds "pipeline check unavailable" when /attention fails.
    // Both endpoints live behind one API and can fail together; if this line
    // read the same, one outage would look like the same bug reported twice.
    const problems = buildProblems({
      ...healthy,
      outreachHealth: { ok: false, error: "HTTP 503", findings: [] },
    });
    expect(problems).toEqual(["outreach check failed: HTTP 503"]);
    expect(problems[0]).not.toContain("pipeline check unavailable");
  });

  it("does not drop other problems when the outreach check also fails", () => {
    const problems = buildProblems({
      ...healthy,
      siteHealth: {
        ok: true,
        sites: [{ name: "AzeroTech", up: false, detail: "AzeroTech unreachable" }],
      },
      outreachHealth: { ok: false, findings: [] },
    });
    expect(problems).toEqual(["outreach check failed: unknown", "AzeroTech unreachable"]);
  });
});
