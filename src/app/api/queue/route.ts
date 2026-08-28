import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseLimit } from "@/lib/env";
import { buildExpirySweep } from "@/lib/queue";
import ApprovalItem, { APPROVAL_STATUSES, ApprovalStatus } from "@/models/ApprovalItem";
import "@/models/approvals/FollowupDraftApproval"; // register the discriminator

/**
 * GET /api/queue?status=pending|approved|edited_approved|rejected|expired|all&limit=N
 *
 * Lists approval items, newest first, bounded (default 50, max 100).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? "pending";
  if (status !== "all" && !(APPROVAL_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { error: `status must be "all" or one of: ${APPROVAL_STATUSES.join(", ")}.` },
      { status: 400 }
    );
  }
  const limit = parseLimit(searchParams, 50, 100);

  await connectDB();

  // Lazy sweep before listing so a stale item can never render as pending
  // between cron runs; /api/cron/expire remains the scheduled guarantee.
  const sweep = buildExpirySweep(new Date());
  await ApprovalItem.updateMany(sweep.filter, sweep.update);

  const filter = status === "all" ? {} : { status: status as ApprovalStatus };
  const items = await ApprovalItem.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  return NextResponse.json({ items });
}
