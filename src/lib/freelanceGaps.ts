/**
 * freelanceGaps.ts — Block E, "Needs you".
 *
 * THE GAPS ONLY — the things nothing else is handling. A reply that already has
 * a drafted follow-up lives in /queue, and repeating it here would make both
 * lists untrustworthy. The suppression set comes from queue.ts's
 * fetchLiveAnchorIds, the same query the chaser uses for idempotency, so the
 * page and the chaser can never disagree about the same lead.
 *
 * Over-cap leads are left in deliberately: a reply the chaser skipped only
 * because it hit CHASER_MAX_PER_RUN will be drafted on the next run, so it is
 * arguably not a gap — but it has no ApprovalItem yet, and a backlog that never
 * clears is worth seeing.
 *
 * Every string is quoted from the content deck. The snippet's quotation marks
 * are STRAIGHT, exactly as the deck writes them; do not change them to curly.
 *
 * Pure: no database, no network, and `now` is an argument.
 */

import { formatWaiting } from "@/lib/format";
import { FAIL_LINES } from "@/lib/freelanceView";
import { isSupportedChannel } from "@/lib/chaser";
import type { AttentionItem, OverdueActionItem } from "@/lib/stApi";

/** The deck's `Showing 20 of 41.` */
export const GAP_DISPLAY_BOUND = 20;

/** The deck's four channel labels. */
const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  facebook: "Facebook",
  instagram: "Instagram",
  phone: "Phone",
};

export type GapKind = "unsupported-channel" | "no-draft" | "overdue-followup";

export interface GapRow {
  id: string;
  kind: GapKind;
  businessName: string;
  href: string;
  /** null on an overdue follow-up: inapplicable, not unmeasured. */
  channel: string | null;
  waiting: string;
  /** true only on an overdue follow-up -> .pwhen.is-stale. */
  waitingIsStale: boolean;
  snippet: string | null;
  reason: string | null;
}

export type BlockE =
  | { kind: "failed"; line: string }
  | { kind: "empty"; line: string }
  | { kind: "rows"; count: number; rows: GapRow[]; bound: string | null };

export interface BlockEInput {
  now: Date;
  /** null = the attention call failed. */
  repliedUnanswered: AttentionItem[] | null;
  /** null = the call failed, or the API omitted the block. */
  overdueActions: OverdueActionItem[] | null;
  liveAnchorIds: Set<string>;
  /** ShikksTracker's contacts route, built server-side; the id is appended. */
  contactsBaseUrl: string;
}

/** An unparseable timestamp reads as `just now` rather than as NaN on the page. */
function waitedMs(now: Date, iso: string): number {
  const then = new Date(iso).getTime();
  return Number.isNaN(then) ? 0 : now.getTime() - then;
}

function labelFor(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

export function buildBlockE(input: BlockEInput): BlockE {
  const { now, repliedUnanswered, overdueActions, liveAnchorIds, contactsBaseUrl } = input;

  if (repliedUnanswered === null) {
    return { kind: "failed", line: FAIL_LINES.needsYou };
  }

  const rows: GapRow[] = [];

  for (const item of repliedUnanswered) {
    // Suppress FIRST. A reply already carrying a live ApprovalItem belongs to
    // /queue whatever its channel is.
    if (item.replyToLogId && liveAnchorIds.has(item.replyToLogId)) continue;

    const supported = isSupportedChannel(item.channel);
    const label = labelFor(item.channel);
    rows.push({
      // The anchor is the stable identity where there is one; a reply with no
      // anchor can never be drafted, so its contact id is the next best key.
      id: `reply:${item.replyToLogId || item.contactId}`,
      kind: supported ? "no-draft" : "unsupported-channel",
      businessName: item.businessName,
      href: `${contactsBaseUrl}/${encodeURIComponent(item.contactId)}`,
      channel: label,
      waiting: `replied ${formatWaiting(waitedMs(now, item.repliedAt))}`,
      waitingIsStale: false,
      snippet: item.replySnippet ? `"${item.replySnippet}"` : null,
      reason: supported ? "No draft in the queue." : `Nothing drafts replies for ${label}.`,
    });
  }

  for (const item of overdueActions ?? []) {
    rows.push({
      id: `overdue:${item.contactId}`,
      kind: "overdue-followup",
      businessName: item.businessName,
      href: `${contactsBaseUrl}/${encodeURIComponent(item.contactId)}`,
      // Inapplicable rather than unmeasured, so no tag and no em-dash.
      channel: null,
      waiting: `follow-up due ${formatWaiting(waitedMs(now, item.nextActionAt))}`,
      waitingIsStale: true,
      // The note sits in the snippet register, unquoted — it is Riku's own note
      // to himself, not somebody's words.
      snippet: item.nextActionNote,
      reason: null,
    });
  }

  if (rows.length === 0) {
    // Today's state. It must look intentional rather than like a failure, which
    // is why it is a sentence and not a 0.
    return { kind: "empty", line: "Nothing waiting." };
  }

  return {
    kind: "rows",
    count: rows.length,
    rows: rows.slice(0, GAP_DISPLAY_BOUND),
    bound:
      rows.length > GAP_DISPLAY_BOUND
        ? `Showing ${GAP_DISPLAY_BOUND} of ${rows.length}.`
        : null,
  };
}
