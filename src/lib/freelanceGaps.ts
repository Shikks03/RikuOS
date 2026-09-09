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
 * Pure: no database, no network, and `now` is an argument. R52 made that true
 * at the module-graph level too: `isSupportedChannel`'s vocabulary now lives in
 * a leaf module, so importing this file no longer registers a Mongoose model.
 */

import { formatWaiting, msSince } from "@/lib/format";
import { FAIL_LINES } from "@/lib/freelanceView";
import type { NeedsYouFigure } from "@/lib/freelanceView";
import { isSupportedChannel } from "@/lib/chaser";
import type { AttentionItem, OverdueActionItem } from "@/lib/stApi";

/** The deck's `Showing 20 of 41.` */
export const GAP_DISPLAY_BOUND = 20;

/**
 * The deck's `.fl-absent` sentence for an overdue feed that never arrived. It
 * is deliberately NOT `Nothing waiting.` — an absence is not a measured
 * emptiness (R51).
 */
const OVERDUE_ABSENT_LINE = "ShikksTracker didn't report overdue follow-ups.";

/**
 * The deck's four channel labels.
 *
 * A Map, not an object literal: `channel` is an unvalidated string straight
 * from ShikksTracker, and an object literal reads the PROTOTYPE CHAIN —
 * `labelFor("toString")` returned the function itself and the reason line
 * printed its source.
 */
const CHANNEL_LABELS = new Map<string, string>([
  ["email", "Email"],
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["phone", "Phone"],
]);

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
  /** The attention call failed: nothing about what is waiting could be read. */
  | { kind: "failed"; line: string }
  /**
   * The reply feed loaded, no gap survived suppression, AND the overdue feed
   * was not reported. The page must not claim nothing is waiting on the
   * strength of a feed that never arrived (R51).
   */
  | { kind: "absent"; line: string }
  /**
   * Both feeds reported and nothing survived suppression — a measured zero,
   * and today's real state.
   */
  | { kind: "empty"; line: string }
  /**
   * Measured gaps. `absentNote` carries the same "didn't report" sentence when
   * the overdue feed was missing: these rows are real, and the true total may
   * be higher than the count beside them.
   */
  | {
      kind: "rows";
      count: number;
      rows: GapRow[];
      bound: string | null;
      /** .fl-absent — the overdue feed NEVER ARRIVED. */
      absentNote: string | null;
    };

export interface BlockEInput {
  now: Date;
  /** null = the attention call failed, or the suppression set could not be read. */
  repliedUnanswered: AttentionItem[] | null;
  /**
   * null = the API omitted the block. A failed call fails the whole read
   * through `repliedUnanswered`, so this null only ever means "not reported".
   */
  overdueActions: OverdueActionItem[] | null;
  liveAnchorIds: Set<string>;
  /** ShikksTracker's contacts route, built server-side; the id is appended. */
  contactsBaseUrl: string;
}

/** An unparseable timestamp reads as `just now` rather than as NaN on the page. */
function waitedMs(now: Date, iso: string): number {
  return msSince(now, iso) ?? 0;
}

function labelFor(channel: string): string {
  return CHANNEL_LABELS.get(channel) ?? channel;
}

export function buildBlockE(input: BlockEInput): BlockE {
  const { now, repliedUnanswered, overdueActions, liveAnchorIds, contactsBaseUrl } = input;

  if (repliedUnanswered === null) {
    return { kind: "failed", line: FAIL_LINES.needsYou };
  }

  // The waited milliseconds ride ALONGSIDE each row rather than inside it:
  // GapRow is what Plan C renders, and `waiting` is already the rendered form.
  const measured: { row: GapRow; waited: number }[] = [];

  for (const item of repliedUnanswered) {
    // Suppress FIRST. A reply already carrying a live ApprovalItem belongs to
    // /queue whatever its channel is.
    if (item.replyToLogId && liveAnchorIds.has(item.replyToLogId)) continue;

    const supported = isSupportedChannel(item.channel);
    const label = labelFor(item.channel);
    const waited = waitedMs(now, item.repliedAt);
    measured.push({
      waited,
      row: {
        // The anchor is the stable identity where there is one; a reply with no
        // anchor can never be drafted, so its contact id is the next best key.
        id: `reply:${item.replyToLogId || item.contactId}`,
        kind: supported ? "no-draft" : "unsupported-channel",
        businessName: item.businessName,
        href: `${contactsBaseUrl}/${encodeURIComponent(item.contactId)}`,
        channel: label,
        waiting: `replied ${formatWaiting(waited)}`,
        waitingIsStale: false,
        // A non-string is not a snippet. The contract typed it and R74's guard
        // deliberately did not check it, because the row is the fact and the
        // snippet is decoration — so the row survives and the snippet does not
        // (R75). Unguarded, the template literal would print `"[object
        // Object]"` inside quotation marks, as if it were the customer's words.
        snippet:
          typeof item.replySnippet === "string" && item.replySnippet
            ? `"${item.replySnippet}"`
            : null,
        reason: supported ? "No draft in the queue." : `Nothing drafts replies for ${label}.`,
      },
    });
  }

  // An absence, never an emptiness: the feed was not reported, so there is no
  // count of overdue follow-ups to add and none to claim is zero (R51).
  const overdueAbsent = overdueActions === null;

  if (overdueActions !== null) {
    for (const item of overdueActions) {
      const waited = waitedMs(now, item.nextActionAt);
      measured.push({
        waited,
        row: {
          id: `overdue:${item.contactId}`,
          kind: "overdue-followup",
          businessName: item.businessName,
          href: `${contactsBaseUrl}/${encodeURIComponent(item.contactId)}`,
          // Inapplicable rather than unmeasured, so no tag and no em-dash.
          channel: null,
          waiting: `follow-up due ${formatWaiting(waited)}`,
          // ShikksTracker's classification, not ours — the feed it came from is
          // named "overdue". A nextActionAt still in the future (a clock skew,
          // or a note rescheduled after the feed was built) therefore still
          // reads amber; we do not second-guess the sender's own label.
          waitingIsStale: true,
          // The note sits in the snippet register, unquoted — it is Riku's own
          // note to himself, not somebody's words. An empty note is no note,
          // and a non-string is not a note either: the contract typed it and
          // R74's guard deliberately did not check it, because the row is the
          // fact and the note is decoration. So the row survives and the note
          // does not (R75) — dropping a real overdue follow-up to protect an
          // ornament would lose the wrong thing.
          snippet:
            typeof item.nextActionNote === "string" && item.nextActionNote
              ? item.nextActionNote
              : null,
          reason: null,
        },
      });
    }
  }

  // R53: longest wait first, across both feeds. Array.prototype.sort is stable,
  // so equal waits keep feed order (replies before overdue follow-ups). The
  // bound below then truncates the YOUNGEST rows — without this, 25 fresh reply
  // gaps would hide the whole amber class behind `Showing 20 of 28.`, which
  // reads as if the 20 were representative.
  measured.sort((a, b) => b.waited - a.waited);
  const rows = measured.map((m) => m.row);

  if (rows.length === 0) {
    if (overdueAbsent) {
      // The reply feed reported nothing; the overdue feed reported nothing at
      // all. That is an absence, not today's state (R51).
      return { kind: "absent", line: OVERDUE_ABSENT_LINE };
    }
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
    absentNote: overdueAbsent ? OVERDUE_ABSENT_LINE : null,
  };
}

/**
 * The ONE bridge to Block A's third card. §4.1's "the same computed count Block
 * E renders, never a raw feed length" holds by construction: the figure is read
 * off the block itself, so the card and the block cannot disagree.
 *
 * A MEASURED count is a real number of things waiting on Riku even when the
 * overdue feed was missing — the note under the rows says the total may be
 * higher, and the card is not lying about the rows that exist. It is a claim of
 * NOTHING that may not rest on an absence, so an `absent` block reaches the card
 * as an absence too: the hero says "didn't report", the block says "didn't
 * report", and the two speak in one register (R54).
 *
 * No `default` on purpose: exhaustiveness rests on the return annotation under
 * `strict`, so TypeScript rejects this function the day a fifth kind arrives
 * without a decision about what the hero says.
 */
export function needsYouFigure(block: BlockE): NeedsYouFigure {
  switch (block.kind) {
    case "failed":
      return { kind: "failed" };
    case "absent":
      return { kind: "absent" };
    case "empty":
      return { kind: "measured", count: 0 };
    case "rows":
      return { kind: "measured", count: block.count };
  }
}
