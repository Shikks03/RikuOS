/**
 * expirySweep.ts — the P3 expiry sweep plus P4's interrupted-action sweep,
 * extracted from /api/cron/expire so the morning multiplexer can run the same
 * code. The route keeps its own alerting policy; this module only does the work
 * and reports what it changed.
 */

import { buildActionSweep, buildExpirySweep } from "@/lib/queue";
import ApprovalItem from "@/models/ApprovalItem";

export interface ExpirySweepResult {
  /** Pending items whose staleAt passed. */
  expired: number;
  /** Claimed actions that never recorded a result, parked for a human. */
  unstuck: number;
}

export async function runExpirySweep(now: Date): Promise<ExpirySweepResult> {
  const expiry = buildExpirySweep(now);
  const expired = (await ApprovalItem.updateMany(expiry.filter, expiry.update)).modifiedCount;

  // P4: an action claimed but never resolved means the function died between
  // the outward call and recording its result. Park it rather than leaving an
  // in-flight state behind (CLAUDE.md).
  const stuck = buildActionSweep(now);
  const unstuck = (await ApprovalItem.updateMany(stuck.filter, stuck.update)).modifiedCount;

  return { expired, unstuck };
}
