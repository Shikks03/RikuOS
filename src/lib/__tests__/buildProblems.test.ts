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
  siteHealth: { ok: true, sites: [{ up: true, detail: "Meowchi ok" }] },
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
          { up: true, detail: "Meowchi ok" },
          { up: false, detail: "AzeroTech unreachable" },
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
        anomalies: [{ agent: "expiry-sweep", detail: "expiry-sweep failed" }],
      },
    });
    expect(problems).toEqual(["expiry sweep failed: mongo down"]);
  });

  it("still reports anomalies for agents other than the expiry sweep", () => {
    const problems = buildProblems({
      ...healthy,
      watchdog: {
        ok: true,
        anomalies: [
          { agent: "chaser", detail: "chaser has never run" },
          { agent: "expiry-sweep", detail: "expiry-sweep failed" },
        ],
      },
    });
    expect(problems).toEqual(["chaser has never run"]);
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
});
