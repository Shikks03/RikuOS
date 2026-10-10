import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { parseSentAt } from "@/lib/briefingView";
import { markBriefingSeen } from "@/lib/lastDigest";

/**
 * POST /api/briefing/seen — body: { sentAt } of the Briefing whose full-screen
 * greeting was dismissed (S21, spec §5.2). One guarded atomic update: only
 * that morning's record, only while unseen. A stale sentAt applies nothing and
 * is still `ok` — the client has nothing to do about it. A failure only means
 * the greeting may show once more; the client never blocks on this door.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-sent-at" }, { status: 400 });
  }
  const now = new Date();
  const sentAt = parseSentAt((body as { sentAt?: unknown } | null)?.sentAt, now);
  if (sentAt === null) return NextResponse.json({ error: "bad-sent-at" }, { status: 400 });

  try {
    await connectDB();
    const applied = await markBriefingSeen(sentAt, now);
    return NextResponse.json({ ok: true, applied });
  } catch (err) {
    console.error("[api/briefing/seen] write failed:", err instanceof Error ? err.name : "unknown error");
    return NextResponse.json({ error: "save-failed" }, { status: 500 });
  }
}
