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
 * EVERY BOUNDED FIELD IS BOUNDED HERE, NOT JUST TRUNCATED IN ONE PLACE.
 * `INBOUND_TEXT_MAX`, `CONVERSATION_ID_MAX`, `MESSAGE_ID_MAX` and
 * `SENDER_NAME_MAX` mirror the schema's `maxlength`s exactly, and
 * `TriageResponseApproval.ts` imports every one of them rather than
 * redeclaring its own copies — two copies that can drift is a live failure
 * path (raise the parser's limit without the schema's, or vice versa, and
 * `.create()` throws a ValidationError inside a webhook handler).
 *
 * ZERO IMPORTS, DELIBERATELY. `scripts/sync-indexes.mts` loads model files
 * under `node --experimental-strip-types`, which cannot resolve the "@/"
 * alias. `TriageResponseApproval.ts` imports these constants from this file
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

/** Mirrors the schema's `conversationId` maxlength. See MESSAGE_ID_MAX. */
export const CONVERSATION_ID_MAX = 64;

/** Mirrors the schema's `messageId` maxlength. See MESSAGE_ID_MAX. */
export const MESSAGE_ID_MAX = 128;

/**
 * Mirrors the schema's `senderName` maxlength. Unlike the two ids above,
 * `senderName` is cosmetic — display text, nothing keys off it — so it is
 * safe to clamp. `conversationId` and `mid` are the dedup key and the send
 * target: truncating either would silently corrupt it (dedup against the
 * wrong prior message, or send to the wrong conversation), so an over-long
 * one is REJECTED instead. Real Meta ids sit far below either cap; rejection
 * should never fire against a genuine event.
 */
export const SENDER_NAME_MAX = 200;

/**
 * Sanity bound on the parsed year, independent of the ISO regex below. The
 * regex already limits the year to 4 digits, which alone cannot overflow
 * `Date` math, but a 4-digit year like 9999 is still a nonsensical `sentAt`
 * that would otherwise flow straight through into `windowClosesAt` and a
 * persisted `staleAt`. Kept generous — this is a sanity check, not a business
 * rule — so it will not need touching for a very long time.
 */
const MIN_SANE_YEAR = 2000;
const MAX_SANE_YEAR = 2100;

/**
 * Strict ISO-8601: date, time, and an explicit `Z` or numeric offset.
 * Fractional seconds optional. Deliberately stricter than what `new Date()`
 * accepts — `new Date()` also parses non-ISO forms like `"2026"` or
 * `"Sep 4 2026"`, and for those, resolution is partly LOCAL-TIME: the same
 * string means a different instant on a laptop (UTC+8) than it does on
 * Vercel. That turns a malformed timestamp into a silently wrong 24-hour
 * deadline instead of a loud rejection, which is precisely the harm this
 * module exists to prevent.
 */
const STRICT_ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Rejects anything that is not unambiguous ISO-8601, then rejects anything
 * that fails to parse (should be unreachable given the regex, but kept as a
 * second gate rather than trusted away), then rejects a year outside the
 * sanity bound. Returns null rather than throwing for the same reason
 * `parseInboundEvent` does: a bad timestamp is a dropped event, never a
 * silently-extended window.
 */
function parseStrictTimestamp(raw: string): Date | null {
  if (!STRICT_ISO_8601.test(raw)) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  if (year < MIN_SANE_YEAR || year > MAX_SANE_YEAR) return null;
  return parsed;
}

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
  const rawText = str(b.text);
  const sentAtRaw = str(b.sentAt);
  if (!mid || !conversationId || !rawText || !sentAtRaw) return null;

  // conversationId/mid are the dedup key and the send target — clamping
  // either would silently corrupt it, so an over-long one is rejected rather
  // than truncated. See the comment on SENDER_NAME_MAX for the contrast.
  if (conversationId.length > CONVERSATION_ID_MAX || mid.length > MESSAGE_ID_MAX) return null;

  const sentAt = parseStrictTimestamp(sentAtRaw);
  // Never default a bad timestamp to now: that would silently extend a window
  // which may already have closed, and the card would promise time we do not
  // have.
  if (!sentAt) return null;

  // Judge presence on the trimmed text, the same way draftPolicy judges
  // knowledgeBlock emptiness (trim first, then check) — a whitespace-only
  // body is not really a message and should not become an empty queue card.
  const trimmedText = rawText.trim();
  if (trimmedText.length === 0) return null;

  return {
    mid,
    conversationId,
    // Cosmetic, so clamped rather than rejected — see SENDER_NAME_MAX.
    senderName: str(b.senderName)?.slice(0, SENDER_NAME_MAX),
    text: trimmedText.slice(0, INBOUND_TEXT_MAX),
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
    // Structural, not just documented: a consumer that reads this without
    // first checking mayAnswer must still be unable to put the unapproved
    // block into a model call. This is the one property this function exists
    // to guarantee.
    knowledgeBlock: blockReady ? s.knowledgeBlock : "",
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

/**
 * Collapses all whitespace (including newlines) to single spaces and clips to
 * 200 characters, for the queue card's one-line summary. NOT "the first
 * line" — a multi-line message reads as one line with its breaks joined.
 */
export function buildTriageSummary(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 200 ? `${oneLine.slice(0, 199)}…` : oneLine;
}
