import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { insertEvent } from "@/lib/google";
import { readOsSettings } from "@/lib/osSettings";
import {
  BAD_JSON,
  SAVE_FAILED,
  eventCreatedReply,
  eventFailedReply,
  parseEventInput,
  type Reply,
} from "@/lib/personalWrites";

const send = (r: Reply) => NextResponse.json(r.body, { status: r.status });

/**
 * POST /api/calendar/events — body: { title, calendarId, dayKey, allDay,
 * start?, end? } (HH:MM in Asia/Manila when not all-day).
 *
 * THE calendarId CHECK IS THE SECURITY BOUNDARY: it must name a stored,
 * switched-on layer (parseEventInput), so the app cannot write to a calendar
 * Riku did not choose. The layers are read before validation for that reason.
 *
 * Writes one event straight to Google and nothing locally (concept D5), so
 * there is no half-state and nothing to sweep. 201 `{ id, htmlLink, calendar }`;
 * 400 `{ error: <code> }`; 503 Google not connected / access expired; 502
 * Google refused; 504 `calendar-unknown` — it cannot be told whether the event
 * was made, and the client must not say it failed.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return send(BAD_JSON);
  }

  let layers;
  try {
    await connectDB();
    layers = (await readOsSettings()).layers;
  } catch (err) {
    console.error("[api/calendar/events] layers read failed:", err instanceof Error ? err.name : "unknown error");
    return send(SAVE_FAILED);
  }

  const parsed = parseEventInput(body, layers);
  if (!parsed.ok) return send({ status: 400, body: { error: parsed.error } });

  try {
    return send(eventCreatedReply(await insertEvent(parsed.value.calendarId, parsed.value.event)));
  } catch (err) {
    return send(eventFailedReply(err));
  }
}
