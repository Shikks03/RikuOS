/**
 * watchdog.ts — "did every agent actually run, and did it succeed?"
 *
 * The expectations table lives here rather than in OsSettings on purpose
 * (design P5a-2): it mirrors vercel.json, so it should change in the same
 * commit vercel.json does. Only agents that have actually shipped are listed;
 * lead-sweep, triage and retro join the table when they exist.
 *
 * The watchdog is deliberately absent from its own table. It is running, which
 * is the proof. A watchdog that dies mid-run is instead reported by the
 * dispatcher, which sees the outcome of every job in the same invocation.
 *
 * Scope: RikuOS agent freshness only. ShikksTracker's own health — a stalled
 * send engine, stranded approved messages — is NOT judged here; it lives in
 * outreachHealth.ts and runs as its own job, so that a ShikksTracker outage
 * fails that job rather than making the watchdog claim RikuOS's agents are
 * broken. Messenger webhook freshness and the Meta token ping still wait for
 * ShikksTracker's P2 (design P5a-1) — until that ships,
 * `messenger.lastEventAt` means "no webhook yet", not "the webhook is dead".
 */

import AgentRun from "@/models/AgentRun";
import type { Agent } from "@/models/AgentRun";

export interface Expectation {
  agent: Agent;
  everyHours: number;
  graceHours: number;
}

export const EXPECTATIONS: Expectation[] = [
  { agent: "chaser", everyHours: 24, graceHours: 6 },
  { agent: "expiry-sweep", everyHours: 24, graceHours: 6 },
  { agent: "site-health", everyHours: 24, graceHours: 6 },
  { agent: "outreach-health", everyHours: 24, graceHours: 6 },
  { agent: "dispatcher", everyHours: 24, graceHours: 6 },
];

export interface LatestRun {
  agent: Agent;
  startedAt: Date;
  ok: boolean;
  itemsFailed: number;
}

export type AnomalyKind = "never-ran" | "stale" | "failed" | "degraded";

export interface Anomaly {
  agent: Agent;
  kind: AnomalyKind;
  /** One short human-readable line; goes straight into the digest. */
  detail: string;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Pure. At most one anomaly per agent, most-fundamental first: an agent that
 * never ran cannot also be stale, and a stale run's `ok` flag describes a run
 * from before the outage, so reporting it would point at the wrong problem.
 *
 * A switched-off agent is NOT an anomaly and needs no special case here: a
 * disabled agent still writes a run record every day, so it is never stale.
 * The digest reports the "off" status separately, read from OsSettings.
 */
export function evaluateWatchdog(
  now: Date,
  latest: LatestRun[],
  expectations: Expectation[] = EXPECTATIONS
): Anomaly[] {
  const byAgent = new Map(latest.map((run) => [run.agent, run]));
  const anomalies: Anomaly[] = [];

  for (const expectation of expectations) {
    const run = byAgent.get(expectation.agent);

    if (!run) {
      anomalies.push({
        agent: expectation.agent,
        kind: "never-ran",
        detail: `${expectation.agent} has never run`,
      });
      continue;
    }

    const ageMs = now.getTime() - run.startedAt.getTime();
    const limitMs = (expectation.everyHours + expectation.graceHours) * HOUR_MS;
    if (ageMs > limitMs) {
      anomalies.push({
        agent: expectation.agent,
        kind: "stale",
        detail: `${expectation.agent} last ran ${Math.floor(ageMs / HOUR_MS)}h ago`,
      });
      continue;
    }

    if (!run.ok) {
      anomalies.push({
        agent: expectation.agent,
        kind: "failed",
        detail: `${expectation.agent} failed`,
      });
      continue;
    }

    if (run.itemsFailed > 0) {
      anomalies.push({
        agent: expectation.agent,
        kind: "degraded",
        detail: `${expectation.agent}: ${run.itemsFailed} item${run.itemsFailed === 1 ? "" : "s"} failed`,
      });
    }
  }

  return anomalies;
}

/**
 * Loads the newest run per agent. One indexed findOne each rather than an
 * aggregation: the table has a handful of rows and {agent, startedAt} is
 * already indexed for exactly this query.
 */
export async function fetchLatestRuns(agents: Agent[]): Promise<LatestRun[]> {
  const docs = await Promise.all(
    agents.map((agent) =>
      AgentRun.findOne({ agent })
        .sort({ startedAt: -1 })
        .select({ agent: 1, startedAt: 1, ok: 1, "counts.itemsFailed": 1 })
        .lean()
    )
  );

  const runs: LatestRun[] = [];
  for (const doc of docs) {
    if (!doc) continue;
    const row = doc as unknown as {
      agent: Agent;
      startedAt: Date;
      ok: boolean;
      counts?: { itemsFailed?: number };
    };
    runs.push({
      agent: row.agent,
      startedAt: row.startedAt,
      ok: row.ok,
      itemsFailed: row.counts?.itemsFailed ?? 0,
    });
  }
  return runs;
}
