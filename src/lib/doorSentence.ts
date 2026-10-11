/**
 * doorSentence.ts — the words for a definite failure (plan deviation 8).
 *
 * pressOutcome (L7) answers a sentence-only body (`{error: "…"}`, no code)
 * with the caller's fallback, `Couldn’t save.` — right for the Personal
 * islands, whose doors speak in codes. Settings' agent cards and the queue
 * have always shown the door's own sentence (`Item is no longer pending
 * (already decided or expired).`, the /api/settings 400s); this keeps them
 * doing so. A body with a code still says pressOutcome's sentence for it.
 * Client-safe: a type-only import.
 */
import type { PressOutcome } from "@/lib/pressOutcome";

type Failed = Extract<PressOutcome, { kind: "failed" }>;

export function doorSentence(out: Failed): string {
  if (out.code === null && typeof out.body === "object" && out.body !== null) {
    const { error } = out.body as { error?: unknown };
    if (typeof error === "string" && error.trim() !== "") return error;
  }
  return out.sentence;
}
