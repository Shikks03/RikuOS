/**
 * osSettings.ts — access layer for the singleton OsSettings doc (ported
 * pattern from ShikksTracker's settings accessor).
 *
 * Both getOsSettings() and updateOsSettings() go through the same atomic
 * findOneAndUpdate with upsert:true — getOsSettings() is just
 * updateOsSettings({}) (an empty $set changes nothing, and upsert still
 * creates the doc with schema defaults if none exists).
 *
 * Known, accepted limitation for a single-user tool: the `{}` filter has no
 * unique index behind it, so a two-caller race on the very first-ever call
 * could in theory produce two documents. Not worth a fixed-_id scheme here.
 *
 * Callers are responsible for calling connectDB() first — same convention as
 * the rest of the lib layer.
 */

import OsSettings from "@/models/OsSettings";
import type { IOsSettings } from "@/models/OsSettings";

export interface OsSettingsPatch {
  chaserEnabled?: boolean;
  chaserNDays?: number;
  monitoringEnabled?: boolean;
}

export async function updateOsSettings(patch: OsSettingsPatch): Promise<IOsSettings> {
  const updated = await OsSettings.findOneAndUpdate(
    {},
    { $set: patch },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return updated as IOsSettings;
}

export async function getOsSettings(): Promise<IOsSettings> {
  return updateOsSettings({});
}
