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
  lines.push(problemCount > 0 ? problems.map(short).join("; ") : "All clear.");

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
