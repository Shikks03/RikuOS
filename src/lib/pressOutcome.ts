/**
 * pressOutcome.ts — ONE rule for what an island's press says after it asked
 * one of its own doors to write (L7). Client-safe: the only runtime import is
 * personalErrors.ts, which has none of its own; pressOutcome.test.ts checks
 * the source for any other.
 *
 * THE RULE. Only an answer the DOOR ITSELF gave is a definite outcome:
 *   - a 2xx with a JSON body                 -> ok, carrying the parsed body (every
 *                                               door answers success in JSON)
 *   - a non-2xx JSON body the door wrote. Its code is `code` when present
 *     (the settings 500: `{error: "Could not save.", code: "save-failed"}`),
 *     else `error` (the Personal doors: `{error: "no-title"}`, personalWrites.ts):
 *       "calendar-unknown"                   -> unknown (the door says it cannot tell)
 *       a code with a sentence               -> failed, through ERROR_SENTENCES
 *       any other code                       -> failed, the caller's plain failure
 *       a sentence in `error`, no `code`     -> failed, `code: null` (the
 *                                               /api/settings 400s; the proxy's
 *                                               401, which wrote nothing)
 * EVERYTHING ELSE is unknown and never asserts failure: an abort or
 * TimeoutError (PRESS_TIMEOUT_MS), a network rejection, a non-JSON body (a
 * platform 502/504 HTML page sent after a write that may have landed), an
 * unparseable or empty body, JSON that is not the door's shape, or a 2xx that
 * arrived by redirect (the login page, not the door). CLAUDE.md's
 * asymmetric rule: a failure is only claimed when it is known.
 *
 * Every island imports this and never re-derives the rule.
 */

import { ERROR_SENTENCES, type ErrorSentenceCode } from "@/lib/personalErrors";

export type PressOutcome =
  /** `body` is the door's parsed JSON — the caller validates it before trusting it. */
  | { kind: "ok"; body: unknown }
  /**
   * `code` is the door's, or null for a sentence-only body (the settings 400s,
   * the 401). `body` is the door's parsed JSON object, kept because some
   * refusals carry more than a code — the event door's 502/503
   * `{ error: "calendar-failed", calendar: { kind: "failed", cause } }` is the
   * only place `Google didn’t accept it: <its reason>.` can read its reason.
   * The caller validates it before trusting it.
   */
  | { kind: "failed"; code: string | null; sentence: string; body: unknown }
  | { kind: "unknown"; sentence: string };

const UNKNOWN: PressOutcome = { kind: "unknown", sentence: ERROR_SENTENCES["calendar-unknown"] }; // deck §15

/** The doors' codes are kebab-case words; a sentence is not. */
const CODE_SHAPE = /^[a-z]+(-[a-z]+)*$/;

function isErrorCode(code: string): code is ErrorSentenceCode {
  return Object.prototype.hasOwnProperty.call(ERROR_SENTENCES, code);
}

/**
 * Awaits the fetch and classifies its answer. Pass the fetch PROMISE, so a
 * rejection (abort, timeout, network) is classified here too:
 *
 *   const out = await pressOutcome(
 *     fetch("/api/settings", { method: "PATCH", ..., signal: AbortSignal.timeout(PRESS_TIMEOUT_MS) }),
 *   );
 *   if (out.kind !== "ok") setSaid(out.sentence);
 *
 * `fallback` is the sentence for a definite failure whose code has no
 * sentence of its own — `save-failed` unless the press was a delete.
 */
export async function pressOutcome(
  answer: Promise<Response>,
  fallback: ErrorSentenceCode = "save-failed",
): Promise<PressOutcome> {
  let res: Response;
  let text: string;
  try {
    res = await answer;
    text = await res.text();
  } catch {
    return UNKNOWN;
  }

  let body: unknown = null;
  let parsed = true;
  try {
    body = JSON.parse(text);
  } catch {
    parsed = false;
  }

  if (res.ok) return parsed && !res.redirected ? { kind: "ok", body } : UNKNOWN;
  if (!parsed || typeof body !== "object" || body === null || Array.isArray(body)) return UNKNOWN;

  const { code, error } = body as { code?: unknown; error?: unknown };
  const said = typeof code === "string" ? code : typeof error === "string" ? error : null;
  if (said === null || said === "calendar-unknown") return UNKNOWN;
  if (isErrorCode(said)) return { kind: "failed", code: said, sentence: ERROR_SENTENCES[said], body };
  // A code the island cannot produce, or a sentence (which is not a code).
  return { kind: "failed", code: CODE_SHAPE.test(said) ? said : null, sentence: ERROR_SENTENCES[fallback], body };
}
