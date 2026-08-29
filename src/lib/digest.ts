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

export function composeDigest(input: DigestInput): Digest {
  const problemCount = input.problems.length;
  const reviewPart = `${input.pending} to review`;

  const title =
    problemCount > 0
      ? `${problemCount} problem${problemCount === 1 ? "" : "s"} · ${reviewPart}`
      : `All clear · ${reviewPart}`;

  const lines: string[] = [];
  lines.push(problemCount > 0 ? input.problems.join("; ") : "All clear.");

  if (input.attention === null) {
    lines.push("Pipeline check unavailable.");
  } else {
    lines.push(
      `${input.attention.repliedUnanswered} waiting on you, ${input.attention.overdue} overdue.`
    );
  }

  if (input.offAgents.length > 0) {
    lines.push(`Off: ${input.offAgents.join(", ")}.`);
  }

  return { title, body: lines.join(" ") };
}
