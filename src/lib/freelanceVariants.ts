/**
 * freelanceVariants.ts — Block D, approach performance.
 *
 * THE BLOCK EXISTS TO REFUSE A NUMBER. Replies are only ever detected on email
 * (S15 deleted the inbound Messenger lane, so a reply to a Facebook, Instagram
 * or phone approach is invisible to the system). Rendering those rows as `0%`
 * would not be a measurement of zero, it would be an absence of measurement
 * printed as one.
 *
 * So: the rate is RECOMPUTED here from `sends` and `replies`, and the upstream
 * `replyRate` is never printed. ShikksTracker's own rate() returns 0 for zero
 * sends, which is exactly the lie above. No rate for zero sends. No rate for a
 * non-email channel, ever. No hue on any rate.
 *
 * Every string is quoted from the content deck.
 * Pure: no database, no network, no clock.
 */

import { DASH, numberCell } from "@/lib/format";
import type { Cell } from "@/lib/format";
import { FAIL_LINES } from "@/lib/freelanceView";
import type { VariantStatsItem } from "@/lib/stApi";

const DASH_CELL: Cell = { text: DASH, tone: "dash" };

export interface ApproachRow {
  key: string;
  name: string;
  /** Group 1: rate, sends, replies. Group 2: rate, sends. */
  cells: Cell[];
}

export interface ApproachGroup {
  eyebrow: string;
  /** Rendered UNDER the group heading and ABOVE its rows, never as a footnote. */
  explain: string | null;
  headers: string[];
  rows: ApproachRow[];
}

export type CollapsedLine =
  | { kind: "statement"; text: string }
  | { kind: "best"; name: string; rate: string };

export type BlockD =
  | { kind: "failed"; line: string }
  | { kind: "empty"; line: string }
  | {
      kind: "groups";
      /** R31. */
      defaultOpen: boolean;
      collapsed: CollapsedLine;
      /** Always exactly two, in order. */
      groups: ApproachGroup[];
      /** R27 — null unless at least one rate is printed. */
      honesty: string | null;
    };

/** With no label the key is the only name the row has. */
function nameOf(v: VariantStatsItem): string {
  return v.label !== null && v.label.length > 0 ? v.label : v.key;
}

/**
 * A rate is printable only on email, only with a measured send count above
 * zero, and only with a measured reply count. A channel we cannot read is not
 * email: we can never claim a reply rate for a channel we do not know.
 */
function printableRate(v: VariantStatsItem): number | null {
  if (v.channel !== "email") return null;
  if (v.sends === null || v.sends <= 0) return null;
  if (v.replies === null) return null;
  return Math.round((v.replies / v.sends) * 100);
}

export function buildBlockD(variants: VariantStatsItem[] | null): BlockD {
  if (variants === null) return { kind: "failed", line: FAIL_LINES.approaches };
  if (variants.length === 0) return { kind: "empty", line: "No approaches set up." };

  const email = variants.filter((v) => v.channel === "email");
  const other = variants.filter((v) => v.channel !== "email");

  const measuredRows: ApproachRow[] = email.map((v) => {
    const rate = printableRate(v);
    return {
      key: v.key,
      name: nameOf(v),
      cells: [
        rate === null ? DASH_CELL : { text: `${rate}%`, tone: "value" },
        numberCell(v.sends),
        numberCell(v.replies),
      ],
    };
  });

  // The rate column stays full of em-dashes and the replies column is dropped
  // entirely; sends stay live.
  const otherRows: ApproachRow[] = other.map((v) => ({
    key: v.key,
    name: nameOf(v),
    cells: [DASH_CELL, numberCell(v.sends)],
  }));

  // R31: open by default ONLY while every approach has zero sends — today's
  // state, where four approaches at `—` rate and `0` sends are the clearest
  // single demonstration on the page of "not measurable is not zero". A send
  // count that never arrived is not zero sends, so it closes the block.
  const defaultOpen = variants.every((v) => v.sends === 0);

  // The best MEASURED row: highest rate, ties broken by the better-evidenced
  // row (more sends), then by the order the API returned.
  let best: { row: VariantStatsItem; rate: number } | null = null;
  for (const v of email) {
    const rate = printableRate(v);
    if (rate === null) continue;
    if (
      best === null ||
      rate > best.rate ||
      (rate === best.rate && (v.sends ?? 0) > (best.row.sends ?? 0))
    ) {
      best = { row: v, rate };
    }
  }

  return {
    kind: "groups",
    defaultOpen,
    collapsed:
      best === null
        ? { kind: "statement", text: "No sends yet — nothing to compare." }
        : { kind: "best", name: nameOf(best.row), rate: `${best.rate}%` },
    groups: [
      {
        eyebrow: "Measured — email",
        explain: null,
        headers: ["Approach", "Reply rate", "Sends", "Replies"],
        rows: measuredRows,
      },
      {
        eyebrow: "Not measurable",
        explain: "Replies are only detected on email, so these can't be scored.",
        headers: ["Approach", "Reply rate", "Sends"],
        rows: otherRows,
      },
    ],
    // R27, stated as an explicit condition so nobody "fixes" its absence later:
    // a table with no rates and no sends is not a table of small numbers, and
    // printing the note there would be the opposite of an honesty note.
    honesty:
      measuredRows.some((r) => r.cells[0].tone !== "dash")
        ? "Rates are computed over small numbers of sends."
        : null,
  };
}
