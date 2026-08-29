/**
 * stApi.ts — the ONLY door to ShikksTracker.
 *
 * RikuOS never connects to the `shikkstracker` database (CLAUDE.md prime
 * directive). Every read and every action goes through /api/os/* with the
 * shared secret, sent as the `x-os-secret` header. The contract lives in
 * ../ShikksTracker/docs/os-api.md; the shapes below are reproduced from it.
 *
 * THE SAFETY-CRITICAL PART OF THIS FILE IS THE CLASSIFIER.
 * createDraft performs an outward action with a real-world side effect: a
 * message to a lead. A failure that is mis-read as "safe to retry" produces a
 * duplicate message to a real client. So classification is exhaustive and
 * conservative: only POSITIVE PROOF that the request was never delivered
 * downgrades a failure to `rejected`; everything else is `unknown` and parks
 * for human verification (CLAUDE.md asymmetric-failure rule).
 *
 * Two ShikksTracker behaviours this file depends on, both verified at plan time
 * against ../ShikksTracker/src/lib/os/drafts.ts:
 *
 *  1. createOsDraft hard-codes `origin: "rikuos"` on every log, which is what
 *     permits delivery to a contact whose status is `replied`
 *     (src/lib/sendGuards.ts). replyToLogId is sent as well, for THREADING and
 *     for the 409 dedup key below — not for the permit.
 *  2. Every early return in createOsDraft happens BEFORE EmailLog.create. That
 *     is why 400/404/422 are provably side-effect-free, and it is the single
 *     assumption the `rejected` rows in the table rest on. If that file ever
 *     grows a failure path after the write, this classifier must change with it.
 */

/** Explicit timeout on every external call (CLAUDE.md). */
export const ST_TIMEOUT_MS = 15_000;

// --- Contract shapes (../ShikksTracker/docs/os-api.md) -----------------------

/** One entry of GET /api/os/attention -> repliedUnanswered. */
export interface AttentionItem {
  contactId: string;
  businessName: string;
  contactName: string | null;
  /** contact.outreachChannel: email | facebook | instagram | phone. */
  channel: string;
  repliedAt: string;
  replySnippet: string | null;
  lastOutboundBody: string | null;
  keyPoints: string;
  offerSummary: string | null;
  toneNotes: string | null;
  stage: number;
  /** The newest replied log — the threading anchor and the 409 dedup key. */
  replyToLogId: string;
}

export interface AttentionResponse {
  repliedUnanswered: AttentionItem[];
}

/** Request body for POST /api/os/drafts. */
export interface DraftRequest {
  contactId: string;
  channel: "email" | "facebook";
  body: string;
  /**
   * Deliberately absent for chaser drafts: the attention feed does not expose
   * the anchor's subject, so ShikksTracker derives "Re: <anchor subject>"
   * itself. See "Contract gaps" in the P4 plan.
   */
  subject?: string;
  replyToLogId?: string;
}

// --- Config ------------------------------------------------------------------

export interface StConfig {
  baseUrl: string;
  secret: string;
}

/**
 * Reads and validates the two env vars. Takes the environment as a parameter so
 * it is unit-testable. NEVER includes the secret in a thrown message.
 */
export function readStConfig(source: NodeJS.ProcessEnv = process.env): StConfig {
  const baseUrl = (source.ST_API_BASE_URL ?? "").replace(/\/+$/, "");
  const secret = source.ST_API_SECRET ?? "";

  if (!baseUrl) {
    throw new Error(
      "ST_API_BASE_URL is not set. It must be ShikksTracker's origin with no trailing " +
        "slash and no /api suffix (http://localhost:3000 locally, the production host on Vercel)."
    );
  }
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    throw new Error("ST_API_BASE_URL must start with http:// or https://.");
  }
  if (secret.length < 32) {
    throw new Error(
      "ST_API_SECRET must be at least 32 characters. ShikksTracker stores the same value " +
        "as OS_API_SECRET and fails closed with 503 — not 401 — below that length. " +
        "(Value omitted from this message.)"
    );
  }
  return { baseUrl, secret };
}

// --- The classifier ----------------------------------------------------------

export type DraftOutcomeKind = "created" | "duplicate" | "rejected" | "unknown";

/**
 * Maps an HTTP status from POST /api/os/drafts to an outcome kind.
 *
 *   201  created    — the log exists; the body carries its id.
 *   409  duplicate  — a pending reply to this anchor already exists. From
 *                     RikuOS's point of view the desired end state HOLDS.
 *                     This row is what makes a retry safe.
 *   4xx  rejected   — the server declined before EmailLog.create. No side
 *                     effect. Retry is safe (and becomes meaningful once the
 *                     cause is fixed in ShikksTracker).
 *   5xx  unknown    — the handler threw, or an edge proxy timed out after the
 *                     function completed. Indistinguishable. Park it.
 *   else unknown    — an unmodelled response is not evidence of anything.
 */
export function classifyDraftStatus(status: number): DraftOutcomeKind {
  if (status === 201) return "created";
  if (status === 409) return "duplicate";
  if (status === 400 || status === 401 || status === 404 || status === 422 || status === 503) {
    return "rejected";
  }
  return "unknown";
}

/**
 * Error codes that PROVE the connection was never established, so the request
 * cannot have been delivered. Anything not on this list — including our own
 * timeout, which fires only after the request was sent — is `unknown`.
 *
 * Node's fetch (undici) puts the code on `err.cause.code`. Reading it is
 * deliberate: it is the only signal that distinguishes "never connected" from
 * "connected and the response was lost", and getting that wrong is a duplicate
 * message. If a Node upgrade changes the shape, the default is `unknown`, which
 * fails in the safe direction.
 */
const PROVABLY_UNDELIVERED = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ERR_INVALID_URL",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
]);

export function classifyFetchError(err: unknown): "rejected" | "unknown" {
  const cause = (err as { cause?: { code?: unknown } } | null)?.cause;
  const code = typeof cause?.code === "string" ? cause.code : null;
  if (code && PROVABLY_UNDELIVERED.has(code)) return "rejected";
  return "unknown";
}

export type DraftOutcome =
  | { kind: "created"; logId: string | null }
  | { kind: "duplicate"; message: string }
  | { kind: "rejected"; status: number; message: string }
  | { kind: "unknown"; message: string };

function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const parsed = (await res.json()) as { error?: unknown };
    if (typeof parsed.error === "string") return parsed.error.slice(0, 500);
  } catch {
    // fall through — a non-JSON error body is fine, the status carries the meaning
  }
  return `HTTP ${res.status}`;
}

// --- Calls -------------------------------------------------------------------

/**
 * GET /api/os/attention. Throws on any failure — a GET has no side effect to
 * protect, so the caller's ordinary error path (AgentRun + push alert) is the
 * right handling.
 */
export async function fetchAttention(days: number, limit: number): Promise<AttentionResponse> {
  const { baseUrl, secret } = readStConfig();
  const url = `${baseUrl}/api/os/attention?days=${encodeURIComponent(
    String(days)
  )}&limit=${encodeURIComponent(String(limit))}`;

  const res = await fetch(url, {
    headers: { "x-os-secret": secret },
    signal: AbortSignal.timeout(ST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `GET /api/os/attention returned ${res.status}. ` +
        "503 = OS_API_SECRET unset or under 32 chars on ShikksTracker; " +
        "401 = secret mismatch; 404 = the deployment predates the P1 merge."
    );
  }

  const parsed = (await res.json()) as Partial<AttentionResponse>;
  return { repliedUnanswered: Array.isArray(parsed.repliedUnanswered) ? parsed.repliedUnanswered : [] };
}

/**
 * POST /api/os/drafts — the one outward action in P4.
 *
 * TOTAL BY CONTRACT: this function never throws. Every path returns a
 * DraftOutcome, because the caller must record a classified result rather than
 * catch an exception it cannot classify.
 */
export async function createDraft(request: DraftRequest): Promise<DraftOutcome> {
  let config: StConfig;
  try {
    config = readStConfig();
  } catch (err) {
    // Config is validated before any network call, so nothing happened.
    return { kind: "rejected", status: 0, message: describeError(err) };
  }

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/api/os/drafts`, {
      method: "POST",
      headers: { "x-os-secret": config.secret, "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(ST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const kind = classifyFetchError(err);
    const message = describeError(err);
    return kind === "rejected"
      ? { kind: "rejected", status: 0, message }
      : {
          kind: "unknown",
          message:
            `${message} — the request may have reached ShikksTracker. ` +
            "Check the contact's lane there before re-sending.",
        };
  }

  switch (classifyDraftStatus(res.status)) {
    case "created": {
      let logId: string | null = null;
      try {
        const parsed = (await res.json()) as { _id?: unknown };
        if (typeof parsed._id === "string") logId = parsed._id;
      } catch {
        // 201 already proves creation; the body is only for the id.
      }
      return { kind: "created", logId };
    }
    case "duplicate":
      return { kind: "duplicate", message: await readErrorMessage(res) };
    case "rejected":
      return { kind: "rejected", status: res.status, message: await readErrorMessage(res) };
    default:
      return {
        kind: "unknown",
        message:
          `HTTP ${res.status} from POST /api/os/drafts — the draft may or may not have been ` +
          "created. Check the contact's lane in ShikksTracker before re-sending.",
      };
  }
}
