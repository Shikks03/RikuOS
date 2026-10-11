/**
 * doorSentence.ts — the words for a definite failure (plan deviation 8, F3
 * review).
 *
 * pressOutcome (L7) answers a sentence-only body (`{error: "…"}`, no code)
 * with the caller's fallback, `Couldn’t save.` — right for the Personal
 * islands, whose doors speak in codes. Settings' agent cards and the queue
 * have always shown the door's own sentence (`Item is no longer pending
 * (already decided or expired).`, the /api/settings 400s, and its own 500
 * `Could not save.`); this keeps them doing so. The door's `error` wins
 * whenever it reads as a SENTENCE rather than a code — not code-shaped
 * (`/^[a-z]+(-[a-z]+)*$/`, the same shape pressOutcome uses to tell a code
 * from a sentence) — whether or not the body also carries a `code`
 * (`{error: "Could not save.", code: "save-failed"}` says the sentence). A
 * code-shaped `error`, with or without a `code` alongside it, says
 * pressOutcome's sentence instead. Client-safe: a type-only import.
 */
import type { PressOutcome } from "@/lib/pressOutcome";

type Failed = Extract<PressOutcome, { kind: "failed" }>;

/** The doors' codes are kebab-case words; a sentence is not (pressOutcome's CODE_SHAPE). */
const CODE_SHAPE = /^[a-z]+(-[a-z]+)*$/;

export function doorSentence(out: Failed): string {
  if (typeof out.body === "object" && out.body !== null) {
    const { error } = out.body as { error?: unknown };
    if (typeof error === "string" && error.trim() !== "" && !CODE_SHAPE.test(error)) return error;
  }
  return out.sentence;
}
