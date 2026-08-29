/**
 * runJob.ts — the contract every scheduled job in this app obeys.
 *
 * One call = one AgentRun row, written whether the work succeeded or threw,
 * because CLAUDE.md forbids silent failure. The helper NEVER throws: a
 * multiplexed route runs several jobs in sequence, and one job's failure must
 * leave a record and let the next job run rather than aborting the request.
 *
 * A failure to write the record itself is logged and swallowed — losing the
 * bookkeeping must not lose the work's result too.
 */

import AgentRun from "@/models/AgentRun";
import type { Agent, IAgentRunCounts } from "@/models/AgentRun";

const ZERO_COUNTS: IAgentRunCounts = {
  itemsCreated: 0,
  itemsProcessed: 0,
  itemsSkipped: 0,
  itemsFailed: 0,
};

export interface JobWork<T> {
  counts?: Partial<IAgentRunCounts>;
  data: T;
}

export interface JobResult<T> {
  agent: Agent;
  ok: boolean;
  error?: string;
  data: T | null;
}

/**
 * @param note recorded on the run when the job did no work for a legitimate
 *   reason (e.g. switched off). It lands in `error` on an `ok: true` row, the
 *   same shape the chaser uses — deliberately, so "disabled" and "never fired"
 *   stay distinguishable. Nothing reads it back programmatically.
 */
export async function runJob<T>(
  agent: Agent,
  work: () => Promise<JobWork<T>>,
  note?: string
): Promise<JobResult<T>> {
  const startedAt = new Date();
  let ok = true;
  let error: string | undefined = note;
  let counts: IAgentRunCounts = { ...ZERO_COUNTS };
  let data: T | null = null;

  try {
    const outcome = await work();
    counts = { ...ZERO_COUNTS, ...outcome.counts };
    data = outcome.data;
  } catch (err) {
    ok = false;
    error = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
  }

  try {
    await AgentRun.create({
      agent,
      startedAt,
      durationMs: Date.now() - startedAt.getTime(),
      ok,
      counts,
      ...(error !== undefined ? { error: error.slice(0, 2000) } : {}),
    });
  } catch (runErr) {
    console.error(`[jobs/${agent}] failed to write AgentRun:`, runErr);
  }

  return { agent, ok, data, ...(error !== undefined ? { error } : {}) };
}
