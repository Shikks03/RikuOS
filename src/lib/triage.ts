/**
 * triage.ts — "someone messaged the page; what may we say back?"
 *
 * Pure. No database, no network, no clock of its own — `now` is always passed
 * in, exactly as watchdog.ts and outreachHealth.ts do, so every rule here is
 * testable without mocking anything.
 *
 * THE WINDOW IS META'S, NOT OURS. The Messenger Platform refuses to send
 * outside 24 hours of the user's last message. That makes `staleAt` a real
 * deadline rather than a housekeeping age: an expired item is not untidy, it
 * is a conversation that can no longer be answered at all.
 *
 * NOTHING AUTO-SENDS (S14). Everything here produces text for a queue card;
 * the send happens only after Riku taps, and it happens in ShikksTracker,
 * which holds the Meta page token (S9).
 *
 * SAFE WHEN UNDER-CONFIGURED. Riku is shipping this before writing his
 * knowledge block, project list and demo URLs, so an unfilled setting is the
 * normal state for a while (design D11). Each has a defined degradation rather
 * than an empty variable, because a model given a hole improvises into it —
 * and the worst realistic failure of this feature is a draft inventing client
 * work or a portfolio link that does not exist.
 *
 * ZERO IMPORTS, DELIBERATELY. `scripts/sync-indexes.mts` loads model files
 * under `node --experimental-strip-types`, which cannot resolve the "@/"
 * alias. `TriageResponseApproval.ts` imports INBOUND_TEXT_MAX from this file
 * with a relative, extensioned path — safe only because this file imports
 * nothing itself and so pulls in no unresolvable specifier. Keeping this
 * module import-free also keeps it a pure logic layer: every consumer and
 * every unit test can use it without dragging in Mongoose or registering a
 * discriminator as a side effect.
 */

const HOUR_MS = 60 * 60 * 1000;

/** Meta's rule, not a preference. Do not make this configurable. */
export const WINDOW_HOURS = 24;

/**
 * Inbound text longer than this is truncated for the card and the prompt.
 * This is also the schema's `maxlength` for `inboundText`
 * (TriageResponseApproval.ts imports this constant rather than redeclaring
 * it) — raising one without the other would let a truncated-here-but-too-long
 * payload reach `.create()` and throw a ValidationError inside a webhook
 * handler.
 */
export const INBOUND_TEXT_MAX = 4000;

export interface InboundEvent {
  /** Meta's message id. The dedup key — Meta redelivers. */
  mid: string;
  conversationId: string;
  senderName?: string;
  text: string;
  sentAt: Date;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Total: returns null rather than throwing, because the caller answers a
 * webhook forward and must return a fast 2xx either way — a rejected event is
 * logged and dropped, never retried into a loop.
 */
export function parseInboundEvent(body: unknown): InboundEvent | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;

  const mid = str(b.mid);
  const conversationId = str(b.conversationId);
  const text = str(b.text);
  const sentAtRaw = str(b.sentAt);
  if (!mid || !conversationId || !text || !sentAtRaw) return null;

  const sentAt = new Date(sentAtRaw);
  // Never default a bad timestamp to now: that would silently extend a window
  // which may already have closed, and the card would promise time we do not
  // have.
  if (Number.isNaN(sentAt.getTime())) return null;

  return {
    mid,
    conversationId,
    senderName: str(b.senderName),
    text: text.slice(0, INBOUND_TEXT_MAX),
    sentAt,
  };
}

export function windowClosesAt(sentAt: Date): Date {
  return new Date(sentAt.getTime() + WINDOW_HOURS * HOUR_MS);
}

/** Strictly inside. At the exact boundary the window is closed. */
export function isWithinWindow(now: Date, sentAt: Date): boolean {
  return now.getTime() < windowClosesAt(sentAt).getTime();
}

export interface TriageSettingsView {
  triageEnabled: boolean;
  knowledgeBlock: string;
  knowledgeReviewedAt: Date | null;
  nameableProjects: string[];
  holdingText: string;
  demoSiteUrls: { packageKey: string; url: string }[];
}

export interface DraftPolicy {
  enabled: boolean;
  /** False means: produce the holding reply only, and say why on the card. */
  mayAnswer: boolean;
  withheldReason?: string;
  knowledgeBlock: string;
  nameableProjects: string[];
  demoSiteUrls: { packageKey: string; url: string }[];
  holdingText: string;
}

/**
 * The single place that decides how much a draft is allowed to say.
 *
 * Keeping this pure and separate from the prompt builder is deliberate: the
 * rule "no approved block means no substantive answer" is a safety property,
 * and safety properties belong somewhere a test can state them in one line.
 */
export function draftPolicy(s: TriageSettingsView): DraftPolicy {
  const blockReady = s.knowledgeReviewedAt !== null && s.knowledgeBlock.trim().length > 0;

  return {
    enabled: s.triageEnabled,
    mayAnswer: blockReady,
    withheldReason: blockReady
      ? undefined
      : "Services info not approved yet — holding reply only.",
    knowledgeBlock: s.knowledgeBlock,
    nameableProjects: s.nameableProjects,
    demoSiteUrls: s.demoSiteUrls,
    holdingText: s.holdingText,
  };
}

export function buildTriageTitle(senderName: string | undefined): string {
  return senderName
    ? `New message from ${senderName}`
    : "New message from an unlinked conversation";
}

/** First line of the inbound message, for the queue card's summary. */
export function buildTriageSummary(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 200 ? `${oneLine.slice(0, 199)}…` : oneLine;
}
