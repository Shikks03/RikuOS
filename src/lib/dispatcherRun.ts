/**
 * dispatcherRun.ts — the dispatcher's newest run, as the greeting line needs it.
 * Moved from the Personal page (P10c) when the push tile retired (S21).
 * Callers must have connectDB()'d already.
 *
 * `skipped` and `error` are projected, which watchdog's fetchLatestRuns does
 * not select. A row with a `skipped` key says so itself; only a row WITHOUT the
 * key (written before the field) falls back to `ok && error`.
 *
 * `noDevice` (Plan B lead addition, binding): a run the morning route marks
 * `ok: false` whose `error` starts with NO_DEVICE_ERROR reached zero devices —
 * it ran, so the greeting line must not say "didn't happen" (CLAUDE.md:
 * no silent failure). `dispatcherFromRow` is the pure half of this, exported
 * so the rule is tested without a database.
 */
import { NO_DEVICE_ERROR } from "@/lib/constants";
import AgentRun from "@/models/AgentRun";
import type { GreetingInput } from "@/lib/briefingView";

export type LatestDispatcher = Exclude<GreetingInput["dispatcher"], "unavailable">;

export interface DispatcherRow {
  ok: boolean;
  startedAt: Date;
  skipped?: boolean;
  error?: string;
}

/** Pure: a selected AgentRun row (or none) → the greeting line's shape. */
export function dispatcherFromRow(doc: DispatcherRow | null | undefined): LatestDispatcher {
  if (!doc) return null;
  const skipped = typeof doc.skipped === "boolean" ? doc.skipped : doc.ok === true && typeof doc.error === "string";
  const noDevice = doc.ok === false && typeof doc.error === "string" && doc.error.startsWith(NO_DEVICE_ERROR);
  return { ok: doc.ok, startedAt: doc.startedAt, skipped, noDevice };
}

export async function readLatestDispatcher(): Promise<LatestDispatcher> {
  const doc = await AgentRun.findOne({ agent: "dispatcher" })
    .sort({ startedAt: -1 })
    .select({ ok: 1, startedAt: 1, skipped: 1, error: 1 })
    .lean<DispatcherRow>();
  return dispatcherFromRow(doc);
}
