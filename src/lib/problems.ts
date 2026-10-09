/**
 * problems.ts — what went wrong this morning, as typed facts (S21, spec §4.1).
 *
 * Moved here from digest.ts and re-typed: buildProblems used to return text
 * fragments, which is why the push could only ever repeat machine notes. A
 * Problem now carries exactly the facts its sentence, next step and cause
 * need, and the compiler forbids one without them (plan deviation 2).
 *
 * Pure. `import type` only, so this stays testable without a database.
 *
 * The de-duplication rule and the R58 reasoning are unchanged from digest.ts:
 * a job that failed THIS run is reported from its in-memory outcome, and only
 * a `failed` expiry-sweep anomaly is dropped when the sweep really failed
 * here (otherwise one failure counts twice).
 */

import type { Anomaly } from "@/lib/watchdog";
import type { SiteResult } from "@/lib/siteHealth";
import type { OutreachFinding } from "@/lib/outreachHealth";
import type { Agent } from "@/models/AgentRun";
import { BRIEFING_BOUNDS } from "@/lib/briefingTypes";

export type CalendarUnavailableCause = "not-configured" | "expired" | "timeout" | "read-failed";

export type Problem =
  | { key: "site-status"; site: string; status: number }
  | { key: "site-timeout"; site: string }
  | { key: "site-unreachable"; site: string }
  | { key: "agent-never-ran"; agent: Agent }
  | { key: "agent-stale"; agent: Agent; ageHours: number }
  | { key: "agent-failed"; agent: Agent }
  | { key: "agent-degraded"; agent: Agent; itemsFailed: number }
  | { key: "job-failed"; job: Agent; raw: string | null }
  | { key: "snapshot-unsaved" }
  | { key: "unstuck-items"; count: number }
  | { key: "engine-never-ran" }
  | { key: "engine-unreadable" }
  | { key: "engine-stale"; ageMs: number }
  | { key: "engine-errors"; count: number }
  | { key: "stranded-approved"; count: number }
  | { key: "pipeline-unavailable"; raw: string | null }
  | { key: "calendar-unavailable"; cause: CalendarUnavailableCause }
  | { key: "calendar-partial"; calendars: string[] }
  | { key: "todos-unavailable" };

/**
 * How each agent is spoken of. A closed map over the Agent enum: a new agent
 * with no name fails to compile here (spec §4.2).
 */
export const AGENT_NAMES: Readonly<Record<Agent, string>> = Object.freeze({
  chaser: "the chaser",
  "lead-sweep": "the lead sweep",
  triage: "triage",
  "site-health": "the site check",
  "outreach-health": "the outreach check",
  dispatcher: "the morning run",
  retro: "the retro",
  watchdog: "the watchdog",
  "expiry-sweep": "the expiry sweep",
});

/** A raw error bounded to what the Briefing stores; null stays null. */
export function boundRaw(raw: string | undefined | null): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  return raw.slice(0, BRIEFING_BOUNDS.raw);
}

/**
 * A rejected fetch's text for a problem card: the error's own message, plus a
 * system error code in parens when the cause carries one (Node's fetch
 * failures set `cause.code`, e.g. "ENOTFOUND"). Only `cause.code` is ever
 * read — never `cause.message`, which could repeat or contradict the outer
 * error's own text, or belong to a different failure entirely. A non-Error
 * value is stringified rather than dropped, so a rejection that never threw
 * an Error still gets a card. Bounded to BRIEFING_BOUNDS.raw (boundRaw), same
 * as every other raw error this app stores.
 */
export function describeFetchError(err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error ? err.cause : undefined;
  const code =
    cause !== null && typeof cause === "object" && typeof (cause as { code?: unknown }).code === "string"
      ? (cause as { code: string }).code
      : null;
  return boundRaw(code ? `${message} (${code})` : message);
}

export interface MorningOutcomes {
  expiry: { ok: boolean; error?: string; unstuck: number };
  watchdog: { ok: boolean; error?: string; anomalies: Anomaly[] };
  siteHealth: { ok: boolean; error?: string; sites: SiteResult[]; snapshotStored: boolean };
  outreachHealth: { ok: boolean; error?: string; findings: OutreachFinding[] };
}

function fromSite(site: SiteResult): Problem {
  if (site.failure === "status" && typeof site.status === "number") {
    return { key: "site-status", site: site.name, status: site.status };
  }
  if (site.failure === "timeout") return { key: "site-timeout", site: site.name };
  // A down site with no failure field reads as unreachable — never as up.
  return { key: "site-unreachable", site: site.name };
}

function fromAnomaly(a: Anomaly): Problem {
  switch (a.kind) {
    case "never-ran":
      return { key: "agent-never-ran", agent: a.agent };
    case "stale":
      return { key: "agent-stale", agent: a.agent, ageHours: a.ageHours ?? 0 };
    case "failed":
      return { key: "agent-failed", agent: a.agent };
    case "degraded":
      return { key: "agent-degraded", agent: a.agent, itemsFailed: a.itemsFailed ?? 1 };
  }
}

function fromFinding(f: OutreachFinding): Problem {
  switch (f.kind) {
    case "engine-never-ran":
      return { key: "engine-never-ran" };
    case "engine-unreadable":
      return { key: "engine-unreadable" };
    case "engine-stale":
      return { key: "engine-stale", ageMs: f.ageMs ?? 0 };
    case "engine-errors":
      return { key: "engine-errors", count: f.count ?? 1 };
    case "stranded-approved":
      return { key: "stranded-approved", count: f.count ?? 1 };
  }
}

/** Pure. One morning's job outcomes as typed problems, in report order. */
export function buildProblems(outcomes: MorningOutcomes): Problem[] {
  const { expiry, watchdog, siteHealth, outreachHealth } = outcomes;
  const problems: Problem[] = [];

  if (!expiry.ok) problems.push({ key: "job-failed", job: "expiry-sweep", raw: boundRaw(expiry.error) });
  if (!watchdog.ok) problems.push({ key: "job-failed", job: "watchdog", raw: boundRaw(watchdog.error) });
  if (!siteHealth.ok) problems.push({ key: "job-failed", job: "site-health", raw: boundRaw(siteHealth.error) });
  if (siteHealth.ok && !siteHealth.snapshotStored) problems.push({ key: "snapshot-unsaved" });
  if (!outreachHealth.ok) {
    problems.push({ key: "job-failed", job: "outreach-health", raw: boundRaw(outreachHealth.error) });
  }
  if (expiry.unstuck > 0) problems.push({ key: "unstuck-items", count: expiry.unstuck });

  for (const anomaly of watchdog.anomalies) {
    const alreadyReported = !expiry.ok && anomaly.agent === "expiry-sweep" && anomaly.kind === "failed";
    if (alreadyReported) continue;
    problems.push(fromAnomaly(anomaly));
  }
  for (const site of siteHealth.sites) {
    if (!site.up) problems.push(fromSite(site));
  }
  for (const finding of outreachHealth.findings) problems.push(fromFinding(finding));

  return problems;
}
