/**
 * chaser.ts — the follow-up chaser's decisions, as pure functions.
 *
 * S6: ShikksTracker's own engine already automates PRE-reply sequence
 * follow-ups. The chaser owns the POST-reply gap — leads who answered and were
 * then left hanging, the hottest part of the funnel and the real memory hole.
 *
 * Everything that decides anything lives here so the cron route stays thin and
 * the behaviour is testable without a database or a network (CLAUDE.md).
 */

import type { AttentionItem } from "@/lib/stApi";
import { DRAFT_CHANNELS } from "@/models/approvals/FollowupDraftApproval";
import type { DraftChannel, IFollowupDraftPayload } from "@/models/approvals/FollowupDraftApproval";

/** Leads drafted per run. Bounds cost, tokens and the function's wall clock. */
export const CHASER_MAX_PER_RUN = 5;

/** How many attention items to ask ShikksTracker for (its max is 200). */
export const CHASER_ATTENTION_LIMIT = 50;

/**
 * A pending follow-up expires after this long. The draft answers a specific
 * message; a week later the context has moved on and a fresh draft is better
 * than a stale one. Expiring also releases the anchor, so the lead re-enters
 * the feed and gets re-proposed — the loop is self-healing.
 */
export const CHASER_STALE_DAYS = 7;

export type SkipReason =
  | "unsupported-channel"
  | "already-queued"
  | "missing-anchor"
  | "over-cap"
  | "time-budget";

export interface SkippedLead {
  contactId: string;
  reason: SkipReason;
}

export interface ChaserPlan {
  toDraft: AttentionItem[];
  skipped: SkippedLead[];
}

/**
 * P4-a: email and facebook only. Instagram and phone leads are skipped and
 * COUNTED — a silent skip would read as "there was nothing to do".
 */
export function isSupportedChannel(channel: string): channel is DraftChannel {
  return (DRAFT_CHANNELS as readonly string[]).includes(channel);
}

/**
 * Decides which attention items become drafts this run.
 *
 * `liveAnchorIds` holds the replyToLogIds that already have an ApprovalItem in
 * pending / approved / edited_approved. This is the idempotency the feed cannot
 * provide on its own: ShikksTracker only stops proposing a lead once a draft
 * exists THERE — i.e. after Riku approves — so between creation and approval
 * the same lead comes back every single day (P4-e).
 *
 * Order is preserved: the feed is already sorted by contact id, so the cap
 * takes a stable slice rather than a random one.
 */
export function planChaserRun(
  attention: AttentionItem[],
  liveAnchorIds: Set<string>,
  maxPerRun: number
): ChaserPlan {
  const toDraft: AttentionItem[] = [];
  const skipped: SkippedLead[] = [];
  // Anchors claimed earlier in THIS run, so two feed entries sharing an anchor
  // cannot both be drafted before either is written.
  const claimed = new Set(liveAnchorIds);

  for (const item of attention) {
    if (!isSupportedChannel(item.channel)) {
      skipped.push({ contactId: item.contactId, reason: "unsupported-channel" });
      continue;
    }
    if (!item.replyToLogId) {
      skipped.push({ contactId: item.contactId, reason: "missing-anchor" });
      continue;
    }
    if (claimed.has(item.replyToLogId)) {
      skipped.push({ contactId: item.contactId, reason: "already-queued" });
      continue;
    }
    if (toDraft.length >= maxPerRun) {
      skipped.push({ contactId: item.contactId, reason: "over-cap" });
      continue;
    }
    claimed.add(item.replyToLogId);
    toDraft.push(item);
  }

  return { toDraft, skipped };
}

export interface ApprovalInput {
  source: "chaser";
  title: string;
  summary: string;
  staleAt: Date;
  payload: IFollowupDraftPayload;
}

function daysSince(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / (24 * 60 * 60 * 1000)));
}

/**
 * Builds the ApprovalItem input. Every string is clipped to its schema
 * maxlength here rather than relying on Mongoose to reject the write — a
 * rejected write would lose the whole lead over a long business name.
 */
export function buildApprovalInput(
  item: AttentionItem,
  draftBody: string,
  now: Date
): ApprovalInput {
  const days = daysSince(item.repliedAt, now);
  const dayWord = days === 1 ? "day" : "days";
  const snippet = item.replySnippet?.trim();

  return {
    source: "chaser",
    title: `Follow up: ${item.businessName}`.slice(0, 200),
    summary: (
      `Replied ${days} ${dayWord} ago on ${item.channel} and has had no answer since.` +
      (snippet ? ` They said: "${snippet}"` : "")
    ).slice(0, 2000),
    staleAt: new Date(now.getTime() + CHASER_STALE_DAYS * 24 * 60 * 60 * 1000),
    payload: {
      contactId: item.contactId,
      // The payload's contactName is required; the feed's is nullable. The
      // business name is the better identifier anyway when there is no person.
      contactName: (item.contactName ?? item.businessName).slice(0, 200),
      channel: item.channel as DraftChannel,
      // draftSubject is deliberately left unset: the attention feed does not
      // expose the anchor's subject, so ShikksTracker derives "Re: …" itself.
      draftBody,
      ...(snippet ? { replySnippet: snippet.slice(0, 2000) } : {}),
      replyToLogId: item.replyToLogId,
    },
  };
}
