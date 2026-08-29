/**
 * digest.ts — the one push Riku gets each morning.
 *
 * Pure, so the wording is testable without sending anything.
 *
 * It goes out EVERY day, including when nothing is wrong (design P5a-4). That
 * is deliberate: Riku chose "the missing push is enough" as the outer safety
 * net, and an absence only means something if the presence is unconditional.
 * Hence "All clear" rather than a silent morning.
 *
 * Problems come first in the body because buildPushPayload truncates it at 200
 * characters and a lock-screen preview is shorter still.
 */

export interface DigestInput {
  /** ApprovalItems waiting on a decision. */
  pending: number;
  /** null means the OS API call failed — reported as unavailable, never as zero. */
  attention: { repliedUnanswered: number; overdue: number } | null;
  /** Watchdog anomalies, down sites, and any job that failed in this same run. */
  problems: string[];
  /** Agents switched off in OsSettings, so a pause cannot be forgotten. */
  offAgents: string[];
}

export interface Digest {
  title: string;
  body: string;
}

/**
 * One problem's worth of body text. A job failure carries a raw exception
 * message bounded only by runJob's 2000-character cap, and the body is sliced
 * at 200 — so without this, one long Mongo error silently evicts every finding
 * behind it. Every real finding ("expiry-sweep last ran 31h ago", "Meowchi
 * unreachable") is far shorter, so only the pathological case is touched.
 */
const MAX_PROBLEM_CHARS = 80;

function short(problem: string): string {
  return problem.length > MAX_PROBLEM_CHARS
    ? `${problem.slice(0, MAX_PROBLEM_CHARS - 1)}…`
    : problem;
}

export function composeDigest(input: DigestInput): Digest {
  // A pipeline check that could not run is itself a problem. Reporting it as
  // "All clear" would make a total ShikksTracker outage — the one dependency
  // every outreach feature rests on — read as reassurance, every morning, for
  // as long as it lasted. The route cannot count it either: it downgrades the
  // failed call to null rather than letting it fail the run, so this is the
  // only place the outage can still be named.
  const problems =
    input.attention === null
      ? [...input.problems, "pipeline check unavailable"]
      : input.problems;

  const problemCount = problems.length;
  const reviewPart = `${input.pending} to review`;

  const title =
    problemCount > 0
      ? `${problemCount} problem${problemCount === 1 ? "" : "s"} · ${reviewPart}`
      : `All clear · ${reviewPart}`;

  const lines: string[] = [];
  lines.push(problemCount > 0 ? `${problems.map(short).join("; ")}.` : "All clear.");

  if (input.attention !== null) {
    lines.push(
      `${input.attention.repliedUnanswered} waiting on you, ${input.attention.overdue} overdue.`
    );
  }

  if (input.offAgents.length > 0) {
    lines.push(`Off: ${input.offAgents.join(", ")}.`);
  }

  return { title, body: lines.join(" ") };
}

/** The four job outcomes a morning run produces, as `runJob` reports them. */
export interface MorningOutcomes {
  expiry: { ok: boolean; error?: string; unstuck: number };
  watchdog: { ok: boolean; error?: string; anomalies: { agent: string; detail: string }[] };
  siteHealth: { ok: boolean; error?: string; sites: { up: boolean; detail: string }[] };
}

/**
 * Pure. Turns one morning's job outcomes into the lines the digest reports.
 *
 * This lives here rather than in the route because it is the only branching
 * logic in the phase that decides what Riku is actually TOLD — inverting one
 * condition would report every healthy site as down, and a route is not
 * testable (CLAUDE.md: handlers stay thin, the logic layer holds behaviour).
 *
 * A job that failed in THIS run is reported from its in-memory outcome, not
 * from the watchdog: the watchdog reads run records, so it would otherwise
 * only notice tomorrow. The expiry sweep is the one job that both runs before
 * the watchdog and writes its record first, so the watchdog re-reads the row
 * that was just written — hence the filter, without which a single failed
 * sweep is counted as two problems and the title's count is wrong.
 */
export function buildProblems(outcomes: MorningOutcomes): string[] {
  const { expiry, watchdog, siteHealth } = outcomes;
  const problems: string[] = [];

  if (!expiry.ok) problems.push(`expiry sweep failed: ${expiry.error ?? "unknown"}`);
  if (!watchdog.ok) problems.push(`watchdog failed: ${watchdog.error ?? "unknown"}`);
  if (!siteHealth.ok) problems.push(`site health failed: ${siteHealth.error ?? "unknown"}`);

  if (expiry.unstuck > 0) {
    problems.push(
      `${expiry.unstuck} approved item${expiry.unstuck === 1 ? "" : "s"} could not confirm their result`
    );
  }

  for (const anomaly of watchdog.anomalies) {
    if (anomaly.agent === "expiry-sweep") continue;
    problems.push(anomaly.detail);
  }
  for (const site of siteHealth.sites) {
    if (!site.up) problems.push(site.detail);
  }

  return problems;
}
