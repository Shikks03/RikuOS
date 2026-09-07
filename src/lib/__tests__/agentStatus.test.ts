/**
 * Pins the rail's six badges. Pure — no database, no clock of its own.
 *
 * The two things most likely to be broken by a later "tidy-up" are pinned
 * hardest: that `off` comes from the OsSettings switches and NEVER from a run
 * record (runJob writes an ok:true placeholder for a switched-off agent, with
 * the reason in a prose note string that must never be parsed), and that the
 * result is total — one row per expectation, in order, never more, never fewer.
 */

import { describe, it, expect } from "vitest";
import {
  AGENT_STALE_HOURS,
  EXPECTATIONS,
  RAIL_AGENTS,
  deriveAgentStatuses,
} from "@/lib/watchdog";
import type { AgentStatus, AgentSwitches, LatestRun } from "@/lib/watchdog";

const NOW = new Date("2026-08-30T00:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * HOUR_MS);
}

const ALL_ON: AgentSwitches = { chaserEnabled: true, monitoringEnabled: true };

/** A healthy, recent run for every agent the rail shows. */
function healthyRuns(): LatestRun[] {
  return RAIL_AGENTS.map((e) => ({
    agent: e.agent,
    startedAt: hoursAgo(1),
    ok: true,
    itemsFailed: 0,
  }));
}

function rowFor(rows: AgentStatus[], agent: string): AgentStatus {
  const row = rows.find((r) => r.agent === agent);
  if (!row) throw new Error(`no row for ${agent}`);
  return row;
}

describe("RAIL_AGENTS", () => {
  it("lists six agents in execution order", () => {
    expect(RAIL_AGENTS.map((e) => e.agent)).toEqual([
      "chaser",
      "expiry-sweep",
      "watchdog",
      "site-health",
      "outreach-health",
      "dispatcher",
    ]);
  });

  it("includes watchdog, which EXPECTATIONS deliberately omits", () => {
    expect(RAIL_AGENTS.some((e) => e.agent === "watchdog")).toBe(true);
    expect(EXPECTATIONS.some((e) => e.agent === "watchdog")).toBe(false);
  });

  it("carries no agent that does not exist", () => {
    const names = RAIL_AGENTS.map((e) => e.agent);
    expect(names).not.toContain("lead-sweep");
    expect(names).not.toContain("triage");
    expect(names).not.toContain("retro");
  });

  it("agrees with the exported staleness threshold", () => {
    for (const e of RAIL_AGENTS) {
      expect(e.everyHours + e.graceHours).toBe(AGENT_STALE_HOURS);
    }
  });
});

describe("deriveAgentStatuses", () => {
  it("returns one row per expectation, in order, and nothing else", () => {
    const rows = deriveAgentStatuses(NOW, healthyRuns(), ALL_ON, RAIL_AGENTS);
    expect(rows).toHaveLength(RAIL_AGENTS.length);
    expect(rows.map((r) => r.agent)).toEqual(RAIL_AGENTS.map((e) => e.agent));
  });

  it("ignores a run for an agent outside the expectations it was given", () => {
    const runs: LatestRun[] = [
      ...healthyRuns(),
      { agent: "retro", startedAt: hoursAgo(500), ok: false, itemsFailed: 9 },
    ];
    const rows = deriveAgentStatuses(NOW, runs, ALL_ON, RAIL_AGENTS);
    expect(rows).toHaveLength(RAIL_AGENTS.length);
    expect(rows.some((r) => r.agent === "retro")).toBe(false);
  });

  it("gives a healthy agent the ok state and NO caption — the hue is the whole message", () => {
    const rows = deriveAgentStatuses(NOW, healthyRuns(), ALL_ON, RAIL_AGENTS);
    for (const row of rows) {
      expect(row.state).toBe("ok");
      expect(row.caption).toBeNull();
    }
  });

  it("reports an agent with no run record as never run", () => {
    const runs = healthyRuns().filter((r) => r.agent !== "dispatcher");
    const row = rowFor(deriveAgentStatuses(NOW, runs, ALL_ON, RAIL_AGENTS), "dispatcher");
    expect(row.state).toBe("never");
    expect(row.caption).toBe("never run");
  });

  it("reports a failed run as failed", () => {
    const runs = healthyRuns().map((r) =>
      r.agent === "dispatcher" ? { ...r, ok: false } : r
    );
    const row = rowFor(deriveAgentStatuses(NOW, runs, ALL_ON, RAIL_AGENTS), "dispatcher");
    expect(row.state).toBe("failed");
    expect(row.caption).toBe("failed");
  });

  it("reports itemsFailed > 0 as failed, and counts the items in the caption", () => {
    const runs = healthyRuns().map((r) =>
      r.agent === "chaser" ? { ...r, itemsFailed: 2 } : r
    );
    const row = rowFor(deriveAgentStatuses(NOW, runs, ALL_ON, RAIL_AGENTS), "chaser");
    expect(row.state).toBe("failed");
    expect(row.caption).toBe("2 items failed");
  });

  it("makes the items-failed caption singular at one", () => {
    const runs = healthyRuns().map((r) =>
      r.agent === "chaser" ? { ...r, itemsFailed: 1 } : r
    );
    expect(rowFor(deriveAgentStatuses(NOW, runs, ALL_ON, RAIL_AGENTS), "chaser").caption).toBe(
      "1 item failed"
    );
  });

  it("is not overdue exactly at AGENT_STALE_HOURS, and is one millisecond later", () => {
    const atLimit = healthyRuns().map((r) =>
      r.agent === "chaser"
        ? { ...r, startedAt: new Date(NOW.getTime() - AGENT_STALE_HOURS * HOUR_MS) }
        : r
    );
    expect(rowFor(deriveAgentStatuses(NOW, atLimit, ALL_ON, RAIL_AGENTS), "chaser").state).toBe(
      "ok"
    );

    const pastLimit = healthyRuns().map((r) =>
      r.agent === "chaser"
        ? { ...r, startedAt: new Date(NOW.getTime() - AGENT_STALE_HOURS * HOUR_MS - 1) }
        : r
    );
    expect(rowFor(deriveAgentStatuses(NOW, pastLimit, ALL_ON, RAIL_AGENTS), "chaser").state).toBe(
      "overdue"
    );
  });

  it("captions an overdue agent with its age in whole hours", () => {
    const runs = healthyRuns().map((r) =>
      r.agent === "outreach-health" ? { ...r, startedAt: hoursAgo(41) } : r
    );
    const row = rowFor(deriveAgentStatuses(NOW, runs, ALL_ON, RAIL_AGENTS), "outreach-health");
    expect(row.state).toBe("overdue");
    expect(row.caption).toBe("last ran 41h ago");
  });

  it("reports overdue rather than failed when a run is both", () => {
    const runs = healthyRuns().map((r) =>
      r.agent === "chaser" ? { ...r, startedAt: hoursAgo(40), ok: false } : r
    );
    expect(rowFor(deriveAgentStatuses(NOW, runs, ALL_ON, RAIL_AGENTS), "chaser").state).toBe(
      "overdue"
    );
  });

  it("takes off from the chaser switch, never from a healthy-looking run record", () => {
    // runJob writes an ok:true placeholder run for a switched-off agent. A
    // derivation reading only run records would paint this chaser green.
    const rows = deriveAgentStatuses(
      NOW,
      healthyRuns(),
      { chaserEnabled: false, monitoringEnabled: true },
      RAIL_AGENTS
    );
    const chaser = rowFor(rows, "chaser");
    expect(chaser.state).toBe("off");
    expect(chaser.caption).toBe("off");
    expect(rowFor(rows, "dispatcher").state).toBe("ok");
  });

  it("switches the four monitoring agents off together, and leaves the chaser alone", () => {
    const rows = deriveAgentStatuses(
      NOW,
      healthyRuns(),
      { chaserEnabled: true, monitoringEnabled: false },
      RAIL_AGENTS
    );
    for (const agent of ["watchdog", "site-health", "outreach-health", "dispatcher"]) {
      expect(rowFor(rows, agent).state).toBe("off");
    }
    expect(rowFor(rows, "chaser").state).toBe("ok");
  });

  it("never switches expiry-sweep off, whatever the switches say", () => {
    const rows = deriveAgentStatuses(
      NOW,
      healthyRuns(),
      { chaserEnabled: false, monitoringEnabled: false },
      RAIL_AGENTS
    );
    expect(rowFor(rows, "expiry-sweep").state).toBe("ok");
  });

  it("puts off ahead of never run, overdue and failed", () => {
    const runs = healthyRuns()
      .filter((r) => r.agent !== "dispatcher")
      .map((r) => (r.agent === "site-health" ? { ...r, startedAt: hoursAgo(99), ok: false } : r));
    const rows = deriveAgentStatuses(
      NOW,
      runs,
      { chaserEnabled: true, monitoringEnabled: false },
      RAIL_AGENTS
    );
    expect(rowFor(rows, "dispatcher").state).toBe("off"); // no run record at all
    expect(rowFor(rows, "site-health").state).toBe("off"); // stale AND failed
  });

  it("never reports unknown — that state belongs to the component's catch block", () => {
    const rows = deriveAgentStatuses(NOW, [], { chaserEnabled: false, monitoringEnabled: false }, RAIL_AGENTS);
    for (const row of rows) {
      expect(["off", "never", "failed", "overdue", "ok"]).toContain(row.state);
    }
  });
});
