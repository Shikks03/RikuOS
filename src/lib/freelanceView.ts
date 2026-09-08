/**
 * freelanceView.ts — Blocks A, B and C of the Freelance page as plain data.
 *
 * EVERY STRING IN THIS FILE IS QUOTED FROM THE CONTENT DECK
 * (docs/superpowers/specs/2026-09-05-p8-freelance-page-content.md), which is
 * the authority on wording. Where the P8 spec's §4 quotes the deck it quotes it
 * exactly; if the two ever differ, the deck wins. Do not reword anything here
 * without changing the deck first.
 *
 * The distinction the whole page rests on, and the reason these are three
 * treatments rather than two:
 *
 *   .stat.plain    hueless WITH data
 *   .stat.drained  a MEASURED zero — the figure drains, the caption still reports
 *   .stat.blank    NOTHING WAS MEASURED (—) — the caption drains too, because it
 *                  is a "ShikksTracker didn't report…" sentence
 *
 * `0` is a measurement. `—` is an absence. Rendering both the same way is a
 * correctness bug, not a style choice.
 *
 * Pure: no database, no network, no clock of its own, no environment. The two
 * ShikksTracker URLs are passed in, so ST_API_BASE_URL never reaches a client.
 */

import { pluralise } from "@/lib/format";
import { PIPELINE_STAGES } from "@/lib/stApi";
import type { PipelineStage, SummaryContacts, SummaryQueue } from "@/lib/stApi";

/** The em-dash used for every absence on the page. */
const DASH = "—";

/**
 * The per-block failure sentences, exported so Plan C's page renders them from
 * one place rather than retyping them into seven components.
 */
export const FAIL_LINES = {
  pipeline: "Couldn't load the pipeline.",
  campaigns: "Couldn't load campaigns.",
  approaches: "Couldn't load approach performance.",
  needsYou: "Couldn't load what's waiting.",
  page: {
    said: "Couldn't reach ShikksTracker.",
    because:
      "State of play, pipeline, campaigns, approaches and what's waiting all come from there.",
  },
} as const;

// --- Block A -----------------------------------------------------------------

export type StatTone = "roi" | "stale" | "plain" | "drained" | "blank";

export interface StatCard {
  key: "drafts" | "contacts" | "needs-you";
  /** -> className `stat ${tone}`. */
  tone: StatTone;
  label: string;
  figure: string;
  caption: string;
  /** Only the drafts card ever has one. Its label is always `Open ↗`. */
  href: string | null;
  /** 0-100, or null when no track is drawn at all. */
  trackPercent: number | null;
}

export interface SayLine {
  /** Rendered in <b>. null = a statement with no figure. */
  figure: string | null;
  /** Plan C renders `{figure} {text}` with one space, or just `{text}`. */
  text: string;
}

export interface BlockA {
  /** Always exactly three, in row order. Cards never disappear. */
  cards: StatCard[];
  lines: SayLine[];
}

export interface BlockAInput {
  queue: SummaryQueue;
  /** null = the whole contacts block was absent. */
  contacts: SummaryContacts | null;
  /** Block E's COMPUTED gap count. null = the database read failed. */
  needsYouCount: number | null;
  /** ShikksTracker's draft-review page, built server-side. */
  draftsUrl: string;
}

/** A field that is zero or was never reported. Both are "nothing to say". */
function zeroOrAbsent(value: number | null): boolean {
  return value === null || value === 0;
}

function draftsCard(drafts: number | null, draftsUrl: string): StatCard {
  // The link stays in every state and inherits --ink-4 on a drained card: it is
  // the page's one exit to ShikksTracker, not ornament.
  const base = { key: "drafts", label: "Drafts", href: draftsUrl, trackPercent: null } as const;
  if (drafts === null) {
    return {
      ...base,
      tone: "blank",
      figure: DASH,
      caption: "ShikksTracker didn't report how many drafts are waiting",
    };
  }
  return {
    ...base,
    tone: drafts === 0 ? "drained" : "roi",
    figure: String(drafts),
    caption: `${pluralise(drafts, "draft")} waiting on you in ShikksTracker`,
  };
}

function contactsCard(contacts: SummaryContacts | null): StatCard {
  const base = { key: "contacts", label: "Contacts", href: null } as const;
  const notStarted = contacts?.byPipelineStage.not_started ?? null;
  const total = contacts?.total ?? null;

  // Any of the three missing makes the card's sentence unconstructible, and the
  // deck supplies exactly one missing-data string for this card. It is not
  // reworded per cause: a card that says "didn't report" is already telling the
  // truth about why it has no figure.
  if (contacts === null || total === null || notStarted === null) {
    return {
      ...base,
      tone: "blank",
      figure: DASH,
      caption: "ShikksTracker didn't report how many contacts there are",
      trackPercent: null,
    };
  }

  return {
    ...base,
    tone: notStarted === 0 ? "drained" : "plain",
    figure: String(notStarted),
    caption: `of ${total} ${pluralise(total, "contact")} never contacted`,
    // A proportion of nothing is not a shape, so a total of 0 draws no track at
    // all. A not_started of 0 with contacts present keeps the ground at 0%,
    // which is what holds the row's baseline.
    trackPercent:
      total === 0 ? null : Math.max(0, Math.min(100, Math.round((notStarted / total) * 100))),
  };
}

function needsYouCard(count: number | null): StatCard {
  const base = { key: "needs-you", label: "Needs you", href: null, trackPercent: null } as const;
  if (count === null) {
    // The gap count needs a database read, so a failed read reads exactly like
    // Block E beside it rather than pretending to a zero.
    return { ...base, tone: "blank", figure: DASH, caption: "couldn't load" };
  }
  if (count === 0) {
    // A card that reads 0 most days is not dead weight: 0 is the answer the page
    // exists to give, which is why this caption stays --ink-3 rather than
    // draining with the figure.
    return { ...base, tone: "drained", figure: "0", caption: "nothing waiting" };
  }
  // Amber because every row it counts is a duration, and red stays rationed to
  // the health strip so the strip can be unmissable.
  return { ...base, tone: "stale", figure: String(count), caption: "waiting on you" };
}

export function buildBlockA(input: BlockAInput): BlockA {
  const { queue, contacts, needsYouCount, draftsUrl } = input;
  const notStarted = contacts?.byPipelineStage.not_started ?? null;

  const cards: StatCard[] = [
    draftsCard(queue.drafts, draftsUrl),
    contactsCard(contacts),
    needsYouCard(needsYouCount),
  ];

  const lines: SayLine[] = [];

  // The whole-block fallback. It fires ONLY when drafts, approved,
  // never-contacted AND the needs-you count are all zero or absent (R35) —
  // never under a lit card. The needs-you count is in the condition because
  // without it the page could print `Nothing waiting on you.` directly beneath
  // an amber card reading `3 / waiting on you`, which is a contradiction on one
  // screen. A null count is an absence, and an absence is not something waiting.
  // The hero cards still render, drained.
  //
  // `Sending is off` (the deck's A4) is NOT here: GET /api/os/summary does not
  // return sendingEnabled, and the prime directive forbids fixing that from this
  // repo. It renders nothing today — no drained slot, no placeholder — and
  // nothing infers the switch state from behaviour.
  if (
    zeroOrAbsent(queue.drafts) &&
    zeroOrAbsent(queue.approved) &&
    zeroOrAbsent(notStarted) &&
    zeroOrAbsent(needsYouCount)
  ) {
    lines.push({ figure: null, text: "Nothing waiting on you." });
    return { cards, lines };
  }

  // These are sentences and they disappear entirely when they have nothing to
  // say. They never render as a zero.
  if (queue.approved !== null && queue.approved > 0) {
    lines.push({ figure: String(queue.approved), text: "approved, not yet sent" });
  }

  return { cards, lines };
}

// --- Block B -----------------------------------------------------------------

/** The deck's stage labels, in pipeline order. */
const STAGE_LABELS: Record<PipelineStage, string> = {
  not_started: "Not started",
  contacted: "Contacted",
  replied: "Replied",
  call_booked: "Call booked",
  proposal_sent: "Proposal sent",
  won: "Won",
  lost: "Lost",
};

export interface PipelineSummary {
  total: number;
  /** "contacts" | "contact" */
  totalWord: string;
  /** null = the `· N hot` clause is dropped entirely. */
  hot: number | null;
  hotWord: string;
}

export interface PipelineStageRow {
  key: PipelineStage;
  label: string;
  count: number;
}

export type BlockB =
  | { kind: "failed"; line: string }
  | { kind: "empty"; line: string }
  | {
      kind: "stages";
      summary: PipelineSummary;
      rows: PipelineStageRow[];
      /** .fl-note — a MEASURED emptiness. */
      emptyNote: string | null;
      /** .fl-absent — a field that NEVER ARRIVED. */
      absentNote: string | null;
      hotAbsentNote: string | null;
    };

/**
 * `a, b, c or d` — the deck's grammar, with `or` before the last and no Oxford
 * comma. One item is just the item; none produces no line at all.
 */
function joinWithOr(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} or ${parts[parts.length - 1]}`;
}

export function buildBlockB(contacts: SummaryContacts | null): BlockB {
  // A missing block, or a missing total, leaves nothing measured at all. That
  // is a failure to load the pipeline, not an emptiness — and `No contacts
  // yet.` would be a claim the data does not support.
  if (contacts === null || contacts.total === null) {
    return { kind: "failed", line: FAIL_LINES.pipeline };
  }
  if (contacts.total === 0) {
    return { kind: "empty", line: "No contacts yet." };
  }

  const rows: PipelineStageRow[] = [];
  const measuredEmpty: string[] = [];
  let anyAbsent = false;

  for (const stage of PIPELINE_STAGES) {
    const count = contacts.byPipelineStage[stage];
    if (count === null) {
      // An omitted stage must NOT fold into the `Nothing yet at …` line: that
      // line means the source answered and the count was zero.
      anyAbsent = true;
      continue;
    }
    if (count > 0) rows.push({ key: stage, label: STAGE_LABELS[stage], count });
    else measuredEmpty.push(STAGE_LABELS[stage].toLowerCase());
  }

  return {
    kind: "stages",
    summary: {
      total: contacts.total,
      totalWord: pluralise(contacts.total, "contact"),
      // Dropped at a measured zero and when it never arrived; only the second
      // case earns a line saying so.
      hot: contacts.hot !== null && contacts.hot > 0 ? contacts.hot : null,
      hotWord: "hot",
    },
    rows,
    emptyNote: measuredEmpty.length > 0 ? `Nothing yet at ${joinWithOr(measuredEmpty)}` : null,
    absentNote: anyAbsent ? "ShikksTracker didn't report every pipeline stage." : null,
    hotAbsentNote: contacts.hot === null ? "ShikksTracker didn't report how many are hot." : null,
  };
}
