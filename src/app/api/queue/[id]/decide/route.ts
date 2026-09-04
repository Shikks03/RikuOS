import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import {
  approvalModelForType,
  buildDecisionUpdate,
  parseDecision,
  runApprovalAction,
} from "@/lib/queue";
import ApprovalItem from "@/models/ApprovalItem";
import type { IFollowupDraftApproval } from "@/models/approvals/FollowupDraftApproval";
import "@/models/approvals/FollowupDraftApproval"; // register the discriminator
import "@/models/approvals/TriageResponseApproval"; // register the discriminator

/**
 * POST /api/queue/:id/decide
 *
 * Body: { decision: "approve" }
 *     | { decision: "reject", rejectNote?: string }
 *     | { decision: "edit", draftBody: string, draftSubject?: string }
 *
 * Applies the decision with a guarded atomic update (only a still-pending
 * item transitions; a lost race returns 409), then — for approvals — runs the
 * item's action executor and records actionStatus.
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  await connectDB();

  // The read is only for validation context (type + current payload); the
  // write below re-checks status atomically, so this is not read-modify-write.
  const item = await ApprovalItem.findById(id);
  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  const payload =
    item.type === "followup-draft" ? (item as unknown as IFollowupDraftApproval).payload : undefined;
  const parsed = parseDecision(body, item.type, payload);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { filter, update } = buildDecisionUpdate(parsed.value, new Date());
  const Model = approvalModelForType(item.type);
  const updated = await Model.findOneAndUpdate({ _id: item._id, ...filter }, update, {
    new: true,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "Item is no longer pending (already decided or expired)." },
      { status: 409 }
    );
  }

  if (updated.status === "approved" || updated.status === "edited_approved") {
    await runApprovalAction(updated);
  }

  const fresh = await ApprovalItem.findById(item._id).lean();
  return NextResponse.json({ item: fresh });
}
