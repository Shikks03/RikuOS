/**
 * watchdog.ts — "did every agent actually run, and did it succeed?"
 *
 * The expectations table lives here rather than in OsSettings on purpose
 * (design P5a-2): it mirrors vercel.json, so it should change in the same
 * commit vercel.json does. Only agents that have actually shipped are listed;
 * lead-sweep and retro join the table when they exist.
 *
 * The watchdog is deliberately absent from its own table. It is running, which
 * is the proof. A watchdog that dies mid-run is instead reported by the
 * dispatcher, which sees the outcome of every job in the same invocation.
 *
 * Scope: RikuOS agent freshness only. ShikksTracker's own health — a stalled
 * send engine, stranded approved messages — is NOT judged here; it lives in
 * outreachHealth.ts and runs as its own job, so that a ShikksTracker outage
 * fails that job rather than making the watchdog claim RikuOS's agents are
 * broken.
 *
 * Nothing Meta-related is watched from here any more. Messenger webhook
 * freshness briefly lived in outreachHealth.ts; the whole Messenger lane was
 * deleted in S15 (2026-09-05), which also retires the Graph API token ping
 * that S9 had left open — there is no longer a subscription whose token
 * expiry would matter.
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
 * The per-agent judgement, pure and shared by two consumers with different
 * needs: the watchdog digest (which wants only the anomalies) and the rail's
 * agents block (which wants a row for every agent, healthy ones included).
 *
 * Order is most-fundamental first and must not be rearranged: an agent that
 * never ran cannot also be stale, and a stale run's `ok` flag describes a run
 * from BEFORE the outage, so reporting `failed` would point at the wrong
 * problem. The rail must not disagree with the digest about the same agent,
 * which is why there is one function rather than two.
 */
export type AgentVerdict =
  | { kind: "never" }
  | { kind: "stale"; ageHours: number }
  | { kind: "failed" }
  | { kind: "degraded"; itemsFailed: number }
  | { kind: "ok"; ageHours: number };

export function classifyAgentRun(
  now: Date,
  run: LatestRun | undefined,
  exp: Expectation
): AgentVerdict {
  if (!run) return { kind: "never" };

  const ageMs = now.getTime() - run.startedAt.getTime();
  const ageHours = Math.floor(ageMs / HOUR_MS);
  const limitMs = (exp.everyHours + exp.graceHours) * HOUR_MS;

  if (ageMs > limitMs) return { kind: "stale", ageHours };
  if (!run.ok) return { kind: "failed" };
  if (run.itemsFailed > 0) return { kind: "degraded", itemsFailed: run.itemsFailed };
  return { kind: "ok", ageHours };
}

/**
 * Pure. At most one anomaly per agent, in classifyAgentRun's order.
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
    const agent = expectation.agent;
    const verdict = classifyAgentRun(now, byAgent.get(agent), expectation);

    switch (verdict.kind) {
      case "never":
        anomalies.push({ agent, kind: "never-ran", detail: `${agent} has never run` });
        break;
      case "stale":
        anomalies.push({
          agent,
          kind: "stale",
          detail: `${agent} last ran ${verdict.ageHours}h ago`,
        });
        break;
      case "failed":
        anomalies.push({ agent, kind: "failed", detail: `${agent} failed` });
        break;
      case "degraded":
        anomalies.push({
          agent,
          kind: "degraded",
          detail: `${agent}: ${verdict.itemsFailed} item${verdict.itemsFailed === 1 ? "" : "s"} failed`,
        });
        break;
      case "ok":
        break;
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
