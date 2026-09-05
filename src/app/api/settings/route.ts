import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getOsSettings, updateOsSettings } from "@/lib/osSettings";
import { parseSettingsPatch } from "@/lib/settings";
import type { IOsSettings } from "@/models/OsSettings";

/**
 * Shared response projection for both GET and PATCH.
 *
 * All three settings are included. The settings PAGE is deliberately deferred
 * (S11: page phases are content-first and discussed with Riku before they are
 * built), but that is a decision about building a page, not about what an API
 * response reports — a PATCH that reports nothing back looks identical to a
 * save that changed nothing.
 *
 * This projected six more fields until S15 (2026-09-05) deleted the Messenger
 * triage lane that owned them.
 */
function projectSettings(settings: IOsSettings) {
  return {
    chaserEnabled: settings.chaserEnabled,
    chaserNDays: settings.chaserNDays,
    monitoringEnabled: settings.monitoringEnabled,
  };
}

/** GET /api/settings — the singleton's current values. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  await connectDB();
  const settings = await getOsSettings();
  return NextResponse.json({ settings: projectSettings(settings) });
}

/** PATCH /api/settings — body: any subset of the settings in settings.ts's ALLOWED_KEYS. */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseSettingsPatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await connectDB();
  const settings = await updateOsSettings(parsed.value);
  return NextResponse.json({ settings: projectSettings(settings) });
}
