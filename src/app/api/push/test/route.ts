import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";
import { buildPushPayload, sendPushToAll } from "@/lib/push";

/**
 * POST /api/push/test — sends a test notification to every subscribed
 * device. This is the P3 acceptance-test button (ROADMAP 3.5).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  try {
    const result = await sendPushToAll(
      buildPushPayload(APP_NAME, "Test notification — push is working.")
    );
    if (result.sent === 0) {
      return NextResponse.json(
        { error: "No push was delivered (no subscribed devices, or all sends failed).", ...result },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Push failed." },
      { status: 500 }
    );
  }
}
