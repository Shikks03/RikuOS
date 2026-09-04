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
  triageEnabled?: boolean;
  knowledgeBlock?: string;
  knowledgeReviewedAt?: Date | null;
  nameableProjects?: string[];
  holdingText?: string;
  demoSiteUrls?: { packageKey: string; url: string }[];
}

export async function updateOsSettings(patch: OsSettingsPatch): Promise<IOsSettings> {
  const updated = await OsSettings.findOneAndUpdate(
    {},
    { $set: patch },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      // Mongoose update validators are off by default — without this, every
      // maxlength/required/min bound on OsSettingsSchema is decorative and
      // parseSettingsPatch is the ONLY thing enforcing them. runValidators
      // only checks the paths named in $set (it does not re-validate the
      // whole document), and setDefaultsOnInsert above ensures the
      // upsert-creates-a-new-doc path still has defaults for the required
      // booleans to validate against. Verified against a scratch collection
      // on the same cluster: a patch bypassing parseSettingsPatch with an
      // over-length field is silently stored without this flag and rejected
      // with it.
      runValidators: true,
    }
  );
  return updated as IOsSettings;
}

export async function getOsSettings(): Promise<IOsSettings> {
  return updateOsSettings({});
}
