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

import { DASH_CELL, numberCell } from "@/lib/format";
import type { Cell } from "@/lib/format";
import { FAIL_LINES } from "@/lib/freelanceView";
import type { VariantStatsItem } from "@/lib/stApi";

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
      /** One or two, measured group first; a group with no rows is dropped (R66). */
      groups: ApproachGroup[];
      /** R27 — null unless at least one rate is printed. */
      honesty: string | null;
    };

/** With no label the key is the only name the row has. */
function nameOf(v: VariantStatsItem): string {
  return v.label !== null && v.label.length > 0 ? v.label : v.key;
}

/**
 * A rate is measurable only on email, only with a measured send count above
 * zero, and only with a measured reply count. A channel we cannot read is not
 * email: we can never claim a reply rate for a channel we do not know. `null`
 * is therefore "no rate to print", not "a rate of zero".
 *
 * It returns the send count the percent RESTS ON alongside it, so the tie-break
 * below compares a narrowed number rather than re-reading a nullable field
 * behind a `?? 0` that could silently mean "no sends" or "never reported".
 */
function measuredRate(v: VariantStatsItem): { percent: number; sends: number } | null {
  if (v.channel !== "email") return null;
  if (v.sends === null || v.sends <= 0) return null;
  if (v.replies === null) return null;
  return { percent: Math.round((v.replies / v.sends) * 100), sends: v.sends };
}

export function buildBlockD(variants: VariantStatsItem[] | null): BlockD {
  if (variants === null) return { kind: "failed", line: FAIL_LINES.approaches };
  if (variants.length === 0) return { kind: "empty", line: "No approaches set up." };

  const email = variants.filter((v) => v.channel === "email");
  const other = variants.filter((v) => v.channel !== "email");

  // Measured ONCE. The rows, the collapsed best line and the honesty note all
  // read the same computation rather than three copies of it that can drift.
  const measured = email.map((v) => ({ v, measure: measuredRate(v) }));

  const measuredRows: ApproachRow[] = measured.map(({ v, measure }) => {
    return {
      key: v.key,
      name: nameOf(v),
      cells: [
        measure === null ? DASH_CELL : { text: `${measure.percent}%`, tone: "value" },
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
  let best: { row: VariantStatsItem; percent: number; sends: number } | null = null;
  for (const { v, measure } of measured) {
    if (measure === null) continue;
    if (
      best === null ||
      measure.percent > best.percent ||
      (measure.percent === best.percent && measure.sends > best.sends)
    ) {
      best = { row: v, percent: measure.percent, sends: measure.sends };
    }
  }

  // R66: a group with no rows is not drawn — a ruled .fl-thead over nothing
  // reads as a failed table. Never both: `variants.length === 0` returns above.
  // The annotation is what keeps excess-property checking alive on both
  // literals; `.filter` applied straight to a bare array literal switches it
  // off, so a stray field on a group would have compiled clean.
  const allGroups: ApproachGroup[] = [
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
  ];

  return {
    kind: "groups",
    defaultOpen,
    collapsed:
      best === null
        ? { kind: "statement", text: "No sends yet — nothing to compare." }
        : { kind: "best", name: nameOf(best.row), rate: `${best.percent}%` },
    groups: allGroups.filter((g) => g.rows.length > 0),
    // R27, stated as an explicit condition so nobody "fixes" its absence later:
    // a table with no printable rate is not a table of small numbers, and
    // printing the note there would be the opposite of an honesty note.
    honesty: measured.some((m) => m.measure !== null)
      ? "Rates are computed over small numbers of sends."
      : null,
  };
}
