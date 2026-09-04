import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { buildActionRetry, runApprovalAction } from "@/lib/queue";
import ApprovalItem from "@/models/ApprovalItem";
import "@/models/approvals/FollowupDraftApproval"; // register the discriminator
import "@/models/approvals/TriageResponseApproval"; // redundant with @/lib/queue's registration; kept so this route doesn't depend on that transitive import

/**
 * POST /api/queue/:id/retry
 *
 * Re-runs the action for an item whose previous attempt PROVABLY had no side
 * effect. The guarded update accepts `actionStatus: "failed"` and nothing else,
 * so an item parked as `needs_verification` can never be retried through this
 * route — a human checks ShikksTracker's lane first (CLAUDE.md: never guess).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
  }

  await connectDB();

  const { filter, update } = buildActionRetry();
  // Base-schema paths only, so the base model is safe here (see the note on
  // approvalModelForType in src/lib/queue.ts).
  const reset = await ApprovalItem.findOneAndUpdate({ _id: id, ...filter }, update, { new: true });

  if (!reset) {
    return NextResponse.json(
      {
        error:
          "Only an action that failed with no side effect can be retried. " +
          "An item awaiting verification must be checked in ShikksTracker first.",
      },
      { status: 409 }
    );
  }

  await runApprovalAction(reset);

  const fresh = await ApprovalItem.findById(id).lean();
  return NextResponse.json({ item: fresh });
}
