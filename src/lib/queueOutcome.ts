/**
 * queueOutcome.ts — what one Approve / Approve edited / Reject press says
 * once the decide door answers (smooth-feel spec §6). Pure, client-safe; the
 * queue page imports it and never re-derives the rule. The card left on the
 * press; this decides whether it comes back and what the line at the top of
 * the queue says. pressOutcome (L7) has already classified the answer.
 *
 *   ok, action done, or a reject   nothing more
 *   ok, actionStatus "failed"      the line: didn't reach ShikksTracker, with a retry
 *   ok, "needs_verification"       the line: can't tell — check there first (no retry)
 *   failed (the door refused)      the card comes back with the door's words (deviation 8)
 *   unknown                        the line: couldn't tell; the quiet re-read decides
 */
import type { PressOutcome } from "@/lib/pressOutcome";
import { doorSentence } from "@/lib/doorSentence";

export type ApprovedFilter = "approved" | "edited_approved";

export type QueueTopLine =
  | { kind: "action-failed"; filter: ApprovedFilter }
  | { kind: "needs-verification"; filter: ApprovedFilter }
  | { kind: "unknown" };

export type DecideResult = { restore: false; top: QueueTopLine | null } | { restore: true; reason: string };

/** Riku's approved wording (2026-10-11). The filter's name sits between lead and tail, as a control. */
export const QUEUE_LINES = {
  actionFailed: {
    lead: "Approved, but the draft didn’t reach ShikksTracker. It’s under ",
    tail: ", with a retry.",
  },
  needsVerification: {
    lead: "Approved, but I can’t tell if the draft reached ShikksTracker. It’s under ",
    tail: ". Check there before doing anything else.",
  },
  unknown: "Couldn’t tell if that went through.",
} as const;

/** The control's text: the real filter (deviation 7). */
export const FILTER_LABEL: Readonly<Record<ApprovedFilter, string>> = {
  approved: "Approved",
  edited_approved: "Edited approved",
};

function itemOf(body: unknown): { status: unknown; actionStatus: unknown } | null {
  if (typeof body !== "object" || body === null) return null;
  const item = (body as { item?: unknown }).item;
  if (typeof item !== "object" || item === null) return null;
  const { status, actionStatus } = item as { status?: unknown; actionStatus?: unknown };
  return { status, actionStatus };
}

export function decideResult(out: PressOutcome): DecideResult {
  if (out.kind === "failed") return { restore: true, reason: doorSentence(out) };
  if (out.kind === "unknown") return { restore: false, top: { kind: "unknown" } };
  const item = itemOf(out.body);
  if (item === null) return { restore: false, top: null };
  const filter: ApprovedFilter | null =
    item.status === "approved" || item.status === "edited_approved" ? item.status : null;
  if (filter === null) return { restore: false, top: null };
  if (item.actionStatus === "failed") return { restore: false, top: { kind: "action-failed", filter } };
  if (item.actionStatus === "needs_verification") {
    return { restore: false, top: { kind: "needs-verification", filter } };
  }
  return { restore: false, top: null };
}
