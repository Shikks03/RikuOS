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
 * Three ShikksTracker behaviours this file's classifiers depend on. #1 and #2
 * were verified at plan time against ../ShikksTracker/src/lib/os/drafts.ts;
 * #3 is a REQUIREMENT this file is imposing on an endpoint that does not
 * exist yet (Task 10), not an observed fact, and is being carried into that
 * task's handoff so both repos agree on it before either side ships:
 *
 *  1. createOsDraft hard-codes `origin: "rikuos"` on every log, which is what
 *     permits delivery to a contact whose status is `replied`
 *     (src/lib/sendGuards.ts). replyToLogId is sent as well, for THREADING and
 *     for the 409 dedup key below — not for the permit.
 *  2. Every early return in createOsDraft happens BEFORE EmailLog.create. That
 *     is why 400/404/422 are provably side-effect-free, and it is the single
 *     assumption the `rejected` rows in the table rest on. If that file ever
 *     grows a failure path after the write, this classifier must change with it.
 *  3. POST /api/os/messenger-reply must emit every 4xx BEFORE calling the Meta
 *     Graph API — a validation failure, never a delivery failure — so a 4xx
 *     stays provably side-effect-free, the same way #2 does for drafts.
 *     Anything that fails AFTER the Graph call, including a Graph error
 *     relayed back to RikuOS, must be a 5xx. `failed` is the ONLY status the
 *     retry route accepts; it re-enters `pending` and calls
 *     sendMessengerReply again. If that ordering is ever violated, a
 *     4xx-after-send means Retry sends the prospect the same message twice —
 *     the exact failure this file exists to prevent.
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

/** A contact whose next-action date has passed. */
export interface OverdueActionItem {
  contactId: string;
  businessName: string;
  nextActionAt: string;
  nextActionNote: string | null;
}

export interface AttentionResponse {
  repliedUnanswered: AttentionItem[];
  /**
   * Also returned by the OS API (verified in ShikksTracker's
   * src/lib/os/attention.ts). Optional here because P4 shipped without it, so
   * nothing may assume its presence at runtime — read it defensively.
   */
  overdueActions?: OverdueActionItem[];
}

/**
 * GET /api/os/summary — only the fields RikuOS acts on.
 *
 * `contacts` and `campaigns` are returned too and are deliberately left
 * unmodelled: nothing reads them yet, and the Freelance page (roadmap 8.1) is
 * where they earn a type. Widening this interface is never sufficient on its
 * own — `fetchSummary` RECONSTRUCTS its return value, so a new field must be
 * carried through there in the same change or it silently arrives undefined.
 * That exact pair was missed once already, in P4's `overdueActions`.
 *
 * `number | null` throughout, and it matters: a field ShikksTracker did not
 * send must never read as a real zero. "The engine reported no errors" and
 * "the engine reported nothing" are different findings, and the second one is
 * the interesting one.
 */
export interface SummaryEngine {
  /** ISO date, or null when ShikksTracker has no run recorded at all. */
  lastRunAt: string | null;
  lastRunErrors: number | null;
}

export interface SummaryQueue {
  /** Drafts awaiting Riku's approval inside ShikksTracker. Not monitored. */
  drafts: number | null;
  /** Approved and waiting for the send engine to pick them up. */
  approved: number | null;
}

/**
 * `lastEventAt` is the webhook's liveness signal and IS judged, in
 * outreachHealth.ts. The two counts are carried but deliberately unjudged
 * there — they are Riku's backlog, not a fault. See that file's messenger note.
 */
export interface SummaryMessenger {
  lastEventAt: string | null;
  unlinkedCount: number | null;
  unansweredCount: number | null;
}

export interface SummaryResponse {
  queue: SummaryQueue;
  engine: SummaryEngine;
  messenger: SummaryMessenger;
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

/**
 * The status/note pair `sendMessengerReply` returns. Named, and exported,
 * so Task 6's executor can bind it to `ActionOutcome` (src/lib/queue.ts,
 * derived from `ACTION_STATUSES`) and let the compiler catch any future
 * divergence between the two unions instead of the copies silently drifting.
 */
export type MessengerSendOutcome = {
  status: "done" | "failed" | "needs_verification";
  note: string;
};

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
  return {
    repliedUnanswered: Array.isArray(parsed.repliedUnanswered) ? parsed.repliedUnanswered : [],
    ...(Array.isArray(parsed.overdueActions) ? { overdueActions: parsed.overdueActions } : {}),
  };
}

/**
 * A count ShikksTracker did not send, or sent as something other than a finite
 * number, becomes null rather than 0. Silently defaulting to zero is how a
 * monitor learns to report "all clear" about a field it never received.
 */
function readCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The same rule for dates, but null carries more weight here than it does for
 * a count, so the asymmetry is worth spelling out.
 *
 * A timestamp reaches `outreachHealth` as one of two findings: null is "the
 * reporter says this has never happened", anything unparseable is "the field
 * is broken". They send Riku to two different places — Meta's dashboard to
 * regenerate a page token, or ShikksTracker's API contract. So this collapses
 * to null ONLY for the states that genuinely mean "ShikksTracker reported
 * nothing": an explicit null, an absent field, an absent block. Anything else
 * present is a contract break and must surface as unreadable instead, by one
 * of two different routes — worth stating separately, because they are not the
 * same mechanism. A NON-STRING is replaced by a tag that cannot parse. A
 * string is passed through UNCHANGED and fails on its own merits downstream:
 * `""` and other junk are already `Invalid Date`, so no tag is needed or
 * applied. Returning null for either would have Riku regenerating a token that
 * was never broken while the real regression, a renamed or rolled-back field,
 * went unnamed.
 *
 * The tag is the `typeof`, deliberately, and NOT the value via `String`. That
 * was the first attempt and it left a hole: `String` makes a small number
 * parseable — `2026` reads as the year 2026, `0` as the year 2000 — so a
 * numeric field slipped past the unreadable branch and came out as "Messenger
 * webhook silent for 246d", a line pointing squarely at Meta for what is a
 * contract break. This is a DIAGNOSIS MARKER, not data: nothing downstream
 * reads its content, and its one job is to be impossible to parse as a date.
 * `"[number]"`, `"[object]"`, `"[boolean]"` all are. Do not "improve" it into
 * something that carries the value, which is how the hole reopens.
 *
 * Scope that claim honestly: the tag closes the hole for NON-STRING values
 * only. A *string* that parses to a nonsense date — a quoted `"2026"` — still
 * reads as a real timestamp and would surface as stale, pointing at Meta. That
 * residual is accepted rather than closed, on the same footing as the
 * future-dated stamp in outreachHealth.ts: ShikksTracker emits
 * `new Date(...).toISOString()`, so a quoted number is not a shape it can
 * produce, and an ISO-shape regex here would trade this unlikely miss for a
 * likelier one — a valid timestamp in an unanticipated format alarming as a
 * contract break.
 */
function readStamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : `[${typeof value}]`;
}

/**
 * GET /api/os/summary. Throws on any failure, exactly as fetchAttention does
 * and for the same reason: a GET has no side effect to protect, so the
 * caller's ordinary error path (AgentRun + digest line) is the right handling.
 */
export async function fetchSummary(): Promise<SummaryResponse> {
  const { baseUrl, secret } = readStConfig();

  const res = await fetch(`${baseUrl}/api/os/summary`, {
    headers: { "x-os-secret": secret },
    signal: AbortSignal.timeout(ST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `GET /api/os/summary returned ${res.status}. ` +
        "503 = OS_API_SECRET unset or under 32 chars on ShikksTracker; " +
        "401 = secret mismatch; 404 = the deployment predates the P1 merge."
    );
  }

  const parsed = (await res.json()) as {
    queue?: Record<string, unknown>;
    engine?: Record<string, unknown>;
    messenger?: Record<string, unknown>;
  };

  return {
    queue: {
      drafts: readCount(parsed.queue?.drafts),
      approved: readCount(parsed.queue?.approved),
    },
    engine: {
      lastRunAt: readStamp(parsed.engine?.lastRunAt),
      lastRunErrors: readCount(parsed.engine?.lastRunErrors),
    },
    messenger: {
      lastEventAt: readStamp(parsed.messenger?.lastEventAt),
      unlinkedCount: readCount(parsed.messenger?.unlinkedCount),
      unansweredCount: readCount(parsed.messenger?.unansweredCount),
    },
  };
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

/**
 * POST /api/os/messenger-reply — the one outward action in P6.
 *
 * TOTAL BY CONTRACT, exactly as createDraft is: never throws, always returns a
 * classified outcome, because the caller must record a result it can act on
 * rather than catch an exception it cannot classify.
 *
 * The classification is the whole point and it is asymmetric on purpose:
 *   200 + { ok: true } -> done. This exact combination is the ONLY thing
 *                         read as confirmed — see "Accepted success shape".
 *   4xx                -> failed. The far side ANSWERED and refused, so
 *                         nothing was sent and a retry is safe. "Window
 *                         closed" lands here. This assumes every 4xx is
 *                         emitted BEFORE the Meta Graph call (file header,
 *                         point 3) — if that ordering ever breaks, this
 *                         classifier must change with it.
 *   anything else      -> needs_verification. Any other 2xx (a 202 for a
 *                         queued send, a bare 204, ...), a 200 whose body
 *                         will not parse or does not say `{ ok: true }`, a
 *                         5xx, or a network/timeout error: none of these is
 *                         positive proof either way, so none may be read as
 *                         `done` OR as `failed`. A retry could send a
 *                         prospect the same message twice, which is worse
 *                         than a late reply. A human checks the thread.
 *
 * Accepted success shape: exactly HTTP 200 with a JSON body `{ "ok": true }`.
 * Deliberately narrower than "any 2xx" — the P6 design only promises the
 * endpoint "returns a classified result", not a specific status code, so this
 * pins the contract rather than inheriting whatever Task 10 picks. A bare 202
 * for a queued send, or a 200 carrying `{ ok: false, reason: "window closed" }`,
 * are both spec-compatible readings that must NOT be read as `done`. The body
 * is parsed defensively: anything that fails to parse, or parses without
 * `ok === true`, falls through to `needs_verification` rather than throwing or
 * being treated as a refusal.
 *
 * Network/timeout errors deliberately do NOT use `classifyFetchError` (which
 * distinguishes ECONNREFUSED-style "never connected" from everything else).
 * That distinction is safe for createDraft, where getting it wrong wastes a
 * retry; here, getting it wrong sends a prospect the same message twice, so
 * every network failure parks as `needs_verification` regardless of cause —
 * the error's name/message/cause code are carried in the note for a human to
 * read, never used to decide the status.
 */
export async function sendMessengerReply(
  conversationId: string,
  text: string
): Promise<MessengerSendOutcome> {
  let baseUrl: string;
  let secret: string;
  try {
    ({ baseUrl, secret } = readStConfig());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "failed", note: `ShikksTracker is not configured: ${message}` };
  }

  try {
    const res = await fetch(`${baseUrl}/api/os/messenger-reply`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-os-secret": secret },
      body: JSON.stringify({ conversationId, text }),
      signal: AbortSignal.timeout(ST_TIMEOUT_MS),
      cache: "no-store",
    });

    if (res.status === 200) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = undefined; // unparseable body — not proof of anything
      }
      const confirmed =
        typeof body === "object" && body !== null && (body as { ok?: unknown }).ok === true;
      if (confirmed) {
        return { status: "done", note: "ShikksTracker confirmed the send." };
      }
      return {
        status: "needs_verification",
        note:
          "ShikksTracker returned 200 without a parseable { ok: true } body. " +
          "Check the Messenger thread before retrying.",
      };
    }

    if (res.status >= 400 && res.status < 500) {
      return {
        status: "failed",
        note: `ShikksTracker did not send the reply (${res.status}): ${await readErrorMessage(res)}`,
      };
    }

    return {
      status: "needs_verification",
      note: `ShikksTracker returned ${res.status}. Check the Messenger thread before retrying.`,
    };
  } catch (err) {
    const cause = (err as { cause?: { code?: unknown } } | null)?.cause;
    const code = typeof cause?.code === "string" ? ` (${cause.code})` : "";
    const message = `${describeError(err)}${code}`;
    return {
      status: "needs_verification",
      note: `The send call did not complete (${message}). Check the Messenger thread before retrying.`,
    };
  }
}
