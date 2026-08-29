import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getOsSettings, updateOsSettings } from "@/lib/osSettings";
import { parseSettingsPatch } from "@/lib/settings";

/** GET /api/settings — the singleton's current values. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  await connectDB();
  const settings = await getOsSettings();
  return NextResponse.json({
    settings: { chaserEnabled: settings.chaserEnabled, chaserNDays: settings.chaserNDays },
  });
}

/** PATCH /api/settings — body: { chaserEnabled?: boolean, chaserNDays?: number } */
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
  return NextResponse.json({
    settings: { chaserEnabled: settings.chaserEnabled, chaserNDays: settings.chaserNDays },
  });
}
