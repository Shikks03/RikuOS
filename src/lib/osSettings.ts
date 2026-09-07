/**
 * osSettings.ts — access layer for the singleton OsSettings doc (ported
 * pattern from ShikksTracker's settings accessor).
 *
 * getOsSettings() and updateOsSettings() go through the same atomic
 * findOneAndUpdate with upsert:true, and that upsert is the ONLY path that may
 * *create* the singleton — which is what CLAUDE.md's one-accessor rule
 * protects. getOsSettings() is updateOsSettings({}), so it is a write: an
 * empty $set does not change nothing, it stamps updatedAt with the call time,
 * because Mongoose injects that timestamp into the update. (Passing
 * `{timestamps:false}` would NOT turn it into a read — with an empty $set
 * Mongoose then deletes $set and sends `{}`, which Mongo treats as a
 * whole-document replacement.)
 *
 * readOsSettings() exists for hot read paths — the rail reads the two switches
 * on every page of the (app) group — and never writes: a findOne that falls
 * back to the schema defaults when the document does not exist yet (R37).
 *
 * Known, accepted limitation for a single-user tool: the `{}` filter has no
 * unique index behind it, so a two-caller race on the very first-ever call
 * could in theory produce two documents. Not worth a fixed-_id scheme here.
 *
 * Callers are responsible for calling connectDB() first — same convention as
 * the rest of the lib layer.
 */

import OsSettings, { OS_SETTINGS_DEFAULTS } from "@/models/OsSettings";
import type { IOsSettings } from "@/models/OsSettings";

export interface OsSettingsPatch {
  chaserEnabled?: boolean;
  chaserNDays?: number;
  monitoringEnabled?: boolean;
}

/** The settings themselves — no _id, no __v, no updatedAt. */
export interface OsSettingsValues {
  chaserEnabled: boolean;
  chaserNDays: number;
  monitoringEnabled: boolean;
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

/**
 * The read-only accessor. Never upserts, never saves — a page view must not
 * be a primary write.
 *
 * The three values are copied out by name rather than returned as the lean
 * document, so a projection change can never leak _id, __v or updatedAt to a
 * caller. No document yet means nobody has opened /settings: the schema
 * defaults are the honest answer, and they are the same values the upsert
 * would have written.
 */
export async function readOsSettings(): Promise<OsSettingsValues> {
  const doc = await OsSettings.findOne(
    {},
    { chaserEnabled: 1, chaserNDays: 1, monitoringEnabled: 1, _id: 0 }
  ).lean();

  if (!doc) return { ...OS_SETTINGS_DEFAULTS };

  const row = doc as unknown as OsSettingsValues;
  return {
    chaserEnabled: row.chaserEnabled,
    chaserNDays: row.chaserNDays,
    monitoringEnabled: row.monitoringEnabled,
  };
}
