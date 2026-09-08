/**
 * freelanceHealth.ts — Block F, the health strip.
 *
 * SILENT WHEN ALL IS WELL. It reads as a footer until something is wrong, and
 * then it becomes a bordered card: cards earn their borders, and a structural
 * alarm is quieter and stronger than more colour.
 *
 * Every warning string is passed through VERBATIM from evaluateOutreach
 * (outreachHealth.ts) and from the SiteResult details siteHealth.ts produces.
 * Nothing here rewrites one — those strings are already the deck's, character
 * for character.
 *
 * The marker is the system's own hued dot, never a warning triangle: U+26A0
 * renders in emoji presentation on several platforms, and a colour glyph has no
 * place in a monochrome instrument panel.
 *
 * The staleness threshold is an ARGUMENT rather than an import of EXPECTATIONS,
 * so the 30-hour rule stays pure and testable. Production passes
 * AGENT_STALE_HOURS from watchdog.ts, which is the same site-health
 * everyHours + graceHours the rail's overdue rule reads.
 */

import { formatAge, msSince } from "@/lib/format";
import type { OutreachFinding } from "@/lib/outreachHealth";
import type { StoredHealth } from "@/lib/healthSnapshot";

export interface HealthPart {
  text: string;
  /** -> `.aged` (--stale). Only the stamp ever sets it. */
  aged: boolean;
}

export interface HealthWarning {
  tone: "stale" | "missing";
  text: string;
}

export type BlockF =
  | { kind: "quiet"; parts: HealthPart[] }
  | { kind: "alarm"; warnings: HealthWarning[]; fine: string[]; stamp: HealthPart };

export interface HealthStripInput {
  now: Date;
  /** null = the summary call failed, so the engine is unknown. */
  findings: OutreachFinding[] | null;
  /** Only used for the healthy `Engine ran 2h ago` phrase. */
  engineLastRunAt: string | null;
  /** null = nothing has ever been checked. */
  snapshot: StoredHealth | null;
  monitoringEnabled: boolean;
  staleHours: number;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Only `engine-stale` is amber. The other three engine findings and the
 * stranded-approved one are red — the last of them because it only ever fires
 * beside a stalled engine, which means a human is waiting.
 */
function toneFor(finding: OutreachFinding): "stale" | "missing" {
  return finding.kind === "engine-stale" ? "stale" : "missing";
}

/**
 * The engine's phrase when it is NOT a warning: a healthy run, or the grey
 * `Engine — unknown` that a failed summary call produces. Never red.
 */
function enginePhrase(input: HealthStripInput): string | null {
  if (input.findings === null) return "Engine — unknown";
  if (input.findings.some((f) => f.kind.startsWith("engine-"))) return null;
  if (input.engineLastRunAt === null) return null;
  const ms = msSince(input.now, input.engineLastRunAt);
  if (ms === null) return null;
  return `Engine ran ${formatAge(ms)} ago`;
}

export function buildHealthStrip(input: HealthStripInput): BlockF {
  const { now, findings, snapshot, monitoringEnabled, staleHours } = input;

  const ageMs = snapshot === null ? null : now.getTime() - snapshot.checkedAt.getTime();
  const aged = ageMs !== null && ageMs > staleHours * HOUR_MS;

  // The stamp. Past the threshold a stored reading no longer supports a claim
  // about the present, so the stamp stops being a timestamp and becomes an
  // amber statement.
  let stamp: HealthPart;
  if (ageMs === null) {
    // With monitoring off the reading is EXPECTED to be absent, and an alarm
    // about an expected absence is a daily false alarm.
    stamp = { text: "sites never checked", aged: monitoringEnabled };
  } else if (aged) {
    stamp = { text: `sites not checked since ${formatAge(ageMs)} ago`, aged: true };
  } else {
    stamp = { text: `checked ${formatAge(ageMs)} ago`, aged: false };
  }

  const warnings: HealthWarning[] = [];
  for (const finding of findings ?? []) {
    warnings.push({ tone: toneFor(finding), text: finding.detail });
  }
  // A site that was down at the last reading still warns however old the
  // reading is: suppressing a red warning is the wrong direction to fail in,
  // and the stamp above already says how old the reading is.
  for (const site of snapshot?.sites ?? []) {
    if (!site.up) warnings.push({ tone: "missing", text: site.detail });
  }

  const engine = enginePhrase(input);

  if (warnings.length === 0) {
    const parts: HealthPart[] = [];
    if (engine !== null) parts.push({ text: engine, aged: false });
    // `all sites ok` is NOT printed once the reading is aged — that is the
    // whole 30-hour rule — nor when the reading watches no sites at all.
    if (!aged && snapshot !== null && snapshot.sites.length > 0) {
      parts.push({ text: "all sites ok", aged: false });
    }
    parts.push(stamp);
    return { kind: "quiet", parts };
  }

  // Healthy items follow the warnings on one indented line. The engine's own
  // healthy phrase belongs there too, so the strip carries the same information
  // in both forms.
  const fine: string[] = [];
  if (engine !== null) fine.push(engine);
  for (const site of snapshot?.sites ?? []) {
    if (site.up) fine.push(site.detail);
  }

  return { kind: "alarm", warnings, fine, stamp };
}
