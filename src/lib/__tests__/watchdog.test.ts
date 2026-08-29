import { describe, it, expect } from "vitest";
import { evaluateWatchdog, EXPECTATIONS } from "@/lib/watchdog";
import type { LatestRun } from "@/lib/watchdog";

const NOW = new Date("2026-08-30T00:00:00.000Z");

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000);
}

/** A healthy run for every agent the table expects. */
function allHealthy(): LatestRun[] {
  return EXPECTATIONS.map((e) => ({
    agent: e.agent,
    startedAt: hoursAgo(1),
    ok: true,
    itemsFailed: 0,
  }));
}

describe("evaluateWatchdog", () => {
  it("reports nothing when every expected agent ran recently and succeeded", () => {
    expect(evaluateWatchdog(NOW, allHealthy())).toEqual([]);
  });

  it("flags an agent that has never run", () => {
    const runs = allHealthy().filter((r) => r.agent !== "chaser");
    const anomalies = evaluateWatchdog(NOW, runs);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].agent).toBe("chaser");
    expect(anomalies[0].kind).toBe("never-ran");
  });

  it("flags an agent whose newest run is past its grace period", () => {
    const runs = allHealthy();
    runs[0] = { ...runs[0], startedAt: hoursAgo(31) };
    const anomalies = evaluateWatchdog(NOW, runs);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].kind).toBe("stale");
  });

  it("does not flag a run inside the grace period", () => {
    const runs = allHealthy();
    runs[0] = { ...runs[0], startedAt: hoursAgo(29) };
    expect(evaluateWatchdog(NOW, runs)).toEqual([]);
  });

  it("flags a failed run", () => {
    const runs = allHealthy();
    runs[1] = { ...runs[1], ok: false };
    const anomalies = evaluateWatchdog(NOW, runs);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].kind).toBe("failed");
  });

  it("flags a run that succeeded but lost items", () => {
    const runs = allHealthy();
    runs[1] = { ...runs[1], itemsFailed: 2 };
    const anomalies = evaluateWatchdog(NOW, runs);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].kind).toBe("degraded");
    expect(anomalies[0].detail).toContain("2");
  });

  it("reports staleness rather than failure when a run is both", () => {
    const runs = allHealthy();
    runs[0] = { ...runs[0], startedAt: hoursAgo(40), ok: false };
    const anomalies = evaluateWatchdog(NOW, runs);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].kind).toBe("stale");
  });

  it("ignores agents that are not in the expectations table", () => {
    const runs = [
      ...allHealthy(),
      { agent: "retro" as const, startedAt: hoursAgo(500), ok: false, itemsFailed: 9 },
    ];
    expect(evaluateWatchdog(NOW, runs)).toEqual([]);
  });

  it("does not expect itself to have run", () => {
    expect(EXPECTATIONS.some((e) => e.agent === "watchdog")).toBe(false);
  });
});
