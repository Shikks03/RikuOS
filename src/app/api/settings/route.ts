import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getOsSettings, updateOsSettings } from "@/lib/osSettings";
import { parseSettingsPatch } from "@/lib/settings";
import type { IOsSettings } from "@/models/OsSettings";

/**
 * Shared response projection for both GET and PATCH.
 *
 * Every setting is included. The settings PAGE is deliberately deferred
 * (S11: page phases are content-first and discussed with Riku before they are
 * built), but that is a decision about building a page, not about what an API
 * response reports — a PATCH that reports nothing back looks identical to a
 * save that changed nothing.
 *
 * This projected six more fields until S15 (2026-09-05) deleted the Messenger
 * triage lane that owned them. P10b adds the Personal page's two stores,
 * copied out by field so no subdocument internals reach the response.
 * `personalLayout` is reported AS STORED; render code resolves it.
 */
function projectSettings(settings: IOsSettings) {
  return {
    chaserEnabled: settings.chaserEnabled,
    chaserNDays: settings.chaserNDays,
    monitoringEnabled: settings.monitoringEnabled,
    layers: settings.layers.map((l) => ({ calendarId: l.calendarId, name: l.name, enabled: l.enabled })),
    personalLayout: settings.personalLayout.map((row) => row.map((e) => ({ tile: e.tile, span: e.span }))),
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

  try {
    await connectDB();
    const settings = await updateOsSettings(parsed.value);
    return NextResponse.json({ settings: projectSettings(settings) });
  } catch (err) {
    console.error("[api/settings] save failed:", err instanceof Error ? err.name : "unknown error");
    // The shipped Settings page shows `error` verbatim, so it stays a sentence
    // (its own fallback, `Could not save.`); `code` matches the new doors.
    return NextResponse.json({ error: "Could not save.", code: "save-failed" }, { status: 500 });
  }
}
