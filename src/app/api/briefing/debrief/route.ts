import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { pressDebrief } from "@/lib/debriefDoor";

/**
 * POST /api/briefing/debrief — "Debrief now" (S22, spec §3.1). A bare press:
 * no body to validate. requireSession first (for a POST it is also the Origin
 * check); everything else is pressDebrief's (debriefDoor.ts). The response is
 * the StoredDebrief, bounded field by field, or a typed 500 — the panel says
 * "The Debrief didn't finish. Try again."
 *
 * maxDuration matches the morning route: the reads run in parallel, so the
 * press costs its slowest leg (ShikksTracker's 15 s), well inside 60.
 *
 * NO PROXY CHANGE: under /api/ and not in isPublicPath, so src/proxy.ts
 * already fails closed in front of it (proxy.test.ts pins it).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  const out = await pressDebrief(new Date());
  return NextResponse.json(out.body, { status: out.status, headers: { "Cache-Control": "no-store" } });
}
