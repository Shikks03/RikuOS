import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { parseSentAt } from "@/lib/briefingView";
import { sinceThenLines } from "@/lib/sinceThen";
import { readSinceThen } from "@/lib/sinceThenRead";

/**
 * GET /api/briefing/since?sentAt=… — the Briefing's live "since then" lines
 * (S21, spec §6), fetched when the Briefing opens so they are fresh on every
 * open (the shell layout is not re-rendered on soft navigation). Bounded:
 * at most SINCE_THEN_MAX_LINES lines. Every read inside fails on its own into
 * an honest line, so this door answers 200 unless its input is bad.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  const now = new Date();
  const sentAt = parseSentAt(request.nextUrl.searchParams.get("sentAt"), now);
  if (sentAt === null) return NextResponse.json({ error: "bad-sent-at" }, { status: 400 });

  const input = await readSinceThen(sentAt, now);
  return NextResponse.json(
    { lines: sinceThenLines(input, sentAt, now) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
