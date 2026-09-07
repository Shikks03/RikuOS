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

/**
 * The staleness threshold, exported ONCE and read by both consumers: the
 * rail's overdue rule and the Freelance page's 30-hour site-snapshot rule.
 * It is `everyHours + graceHours`, the same 24 + 6 every expectation row
 * already carries. Two hardcoded 30s in two files is how they drift apart.
 */
export const AGENT_STALE_HOURS = 30;

/**
 * The six agents the rail shows, in execution order.
 *
 * A hand-written superset of EXPECTATIONS, and it must stay hand-written for
 * two separate reasons. The AGENTS enum in models/AgentRun.ts contains
 * lead-sweep, triage and retro — three agents that do not exist, so a rail
 * built from it would show three permanent ghosts. And EXPECTATIONS
 * deliberately omits `watchdog`: it is running, which is the proof — an
 * absence this file's header documents and watchdog.test.ts pins. So the rail
 * gets its own list and EXPECTATIONS is not touched.
 */
export const RAIL_AGENTS: Expectation[] = [
  { agent: "chaser", everyHours: 24, graceHours: 6 },
  { agent: "expiry-sweep", everyHours: 24, graceHours: 6 },
  { agent: "watchdog", everyHours: 24, graceHours: 6 },
  { agent: "site-health", everyHours: 24, graceHours: 6 },
  { agent: "outreach-health", everyHours: 24, graceHours: 6 },
  { agent: "dispatcher", everyHours: 24, graceHours: 6 },
];

export type AgentBadgeState = "off" | "never" | "failed" | "overdue" | "ok";

export interface AgentSwitches {
  chaserEnabled: boolean;
  monitoringEnabled: boolean;
}

export interface AgentStatus {
  agent: Agent;
  state: AgentBadgeState;
  /** Mono micro-caption under the badge. null on `ok` — the hue is the message. */
  caption: string | null;
}

/** The four agents the monitoring switch governs. expiry-sweep is not one of them. */
const MONITORING_AGENTS = new Set<Agent>([
  "watchdog",
  "site-health",
  "outreach-health",
  "dispatcher",
]);

function isSwitchedOff(agent: Agent, switches: AgentSwitches): boolean {
  // expiry-sweep is never off: it is the safety net that expires stale
  // ApprovalItems, and it has no switch.
  if (agent === "expiry-sweep") return false;
  if (agent === "chaser") return !switches.chaserEnabled;
  if (MONITORING_AGENTS.has(agent)) return !switches.monitoringEnabled;
  return false;
}

/**
 * Total by construction: one row per expectation, in the given order, never
 * more, never fewer. Pure — no database, no clock of its own.
 *
 * The switches are an ARGUMENT and are never sniffed from a run record.
 * runJob writes an ok:true placeholder run for a switched-off agent with the
 * reason in the run's note string, so a derivation reading only run records
 * would paint a switched-off chaser green. The note string is prose and must
 * never be parsed.
 *
 * Precedence: off -> never run -> overdue -> failed -> ok. `off` is checked
 * ahead of everything; the rest is classifyAgentRun's own order, which the
 * digest already uses, so the rail can never disagree with the digest about
 * the same agent.
 *
 * It never returns "unknown". That state is what the component's catch block
 * renders when the database read throws — the derivation never sees a
 * failure, so it can never report one.
 */
export function deriveAgentStatuses(
  now: Date,
  latest: LatestRun[],
  switches: AgentSwitches,
  expectations: Expectation[]
): AgentStatus[] {
  const byAgent = new Map(latest.map((run) => [run.agent, run]));

  return expectations.map((expectation) => {
    const agent = expectation.agent;

    if (isSwitchedOff(agent, switches)) {
      return { agent, state: "off", caption: "off" };
    }

    const verdict = classifyAgentRun(now, byAgent.get(agent), expectation);
    switch (verdict.kind) {
      case "never":
        return { agent, state: "never", caption: "never run" };
      case "stale":
        return { agent, state: "overdue", caption: `last ran ${verdict.ageHours}h ago` };
      case "failed":
        return { agent, state: "failed", caption: "failed" };
      case "degraded":
        return {
          agent,
          state: "failed",
          caption: `${verdict.itemsFailed} item${verdict.itemsFailed === 1 ? "" : "s"} failed`,
        };
      case "ok":
        return { agent, state: "ok", caption: null };
    }
  });
}
