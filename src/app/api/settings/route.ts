import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getOsSettings, updateOsSettings } from "@/lib/osSettings";
import { parseSettingsPatch } from "@/lib/settings";
import type { IOsSettings } from "@/models/OsSettings";

/**
 * Shared response projection for both GET and PATCH.
 *
 * All nine settings are included, not just the original three — the settings
 * PAGE is deliberately deferred (S11: page phases are content-first and
 * discussed with Riku before they are built), but that is a decision about
 * building a page, not about what an API response reports. Omitting the five
 * P6 fields here made the PATCH response go quiet in exactly the direction
 * that fails unsafely: PATCHing `knowledgeBlock` correctly clears
 * `knowledgeReviewedAt` (parseSettingsPatch) — revoking Riku's approval — and
 * a 200 with no trace of either field looks identical to a settings save that
 * changed nothing.
 *
 * `knowledgeBlock` itself is reported as a length + short preview, not the
 * full text: it can be up to 4KB (KNOWLEDGE_BLOCK_MAX) and every GET would
 * otherwise ship the whole block on every queue-page load's settings check,
 * for a value nothing on the client currently renders in full.
 */
const KNOWLEDGE_BLOCK_PREVIEW_LENGTH = 200;

function projectSettings(settings: IOsSettings) {
  const knowledgeBlock = settings.knowledgeBlock ?? "";
  return {
    chaserEnabled: settings.chaserEnabled,
    chaserNDays: settings.chaserNDays,
    monitoringEnabled: settings.monitoringEnabled,
    triageEnabled: settings.triageEnabled,
    knowledgeBlockLength: knowledgeBlock.length,
    knowledgeBlockPreview: knowledgeBlock.slice(0, KNOWLEDGE_BLOCK_PREVIEW_LENGTH),
    knowledgeReviewedAt: settings.knowledgeReviewedAt,
    nameableProjects: settings.nameableProjects,
    holdingText: settings.holdingText,
    demoSiteUrls: settings.demoSiteUrls,
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
