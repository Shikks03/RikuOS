import mongoose, { Document, Model, Schema } from "mongoose";

export interface IOsSettings extends Document {
  chaserEnabled: boolean;
  chaserNDays: number;
  monitoringEnabled: boolean;
  updatedAt: Date;
}

/**
 * The three defaults, in one place. The schema reads them below, and
 * readOsSettings() returns them when no document exists yet — so the value a
 * read reports before the first write is exactly the value the upsert would
 * have created. Two copies is how those two drift apart (R37).
 */
export const OS_SETTINGS_DEFAULTS: Readonly<{
  chaserEnabled: boolean;
  chaserNDays: number;
  monitoringEnabled: boolean;
}> = {
  chaserEnabled: false,
  chaserNDays: 4,
  monitoringEnabled: false,
};

/**
 * Singleton: exactly one document ever exists. It is created and written only
 * through the upsert accessor in src/lib/osSettings.ts (CLAUDE.md singleton
 * rule); hot read paths use readOsSettings(), which never upserts and falls
 * back to OS_SETTINGS_DEFAULTS.
 *
 * P3 carries only the chaser fields (ARCHITECTURE.md §3.1 names them
 * explicitly); each later agent adds its own toggle when it ships. Defaults
 * are off so deploying an agent never silently activates it.
 */
const OsSettingsSchema = new Schema<IOsSettings>(
  {
    chaserEnabled: { type: Boolean, required: true, default: OS_SETTINGS_DEFAULTS.chaserEnabled },
    chaserNDays: {
      type: Number,
      required: true,
      default: OS_SETTINGS_DEFAULTS.chaserNDays,
      min: 1,
      max: 30,
    },
    monitoringEnabled: {
      type: Boolean,
      required: true,
      default: OS_SETTINGS_DEFAULTS.monitoringEnabled,
    },
  },
  { timestamps: { createdAt: false, updatedAt: true }, strict: true }
);

const OsSettings =
  (mongoose.models.OsSettings as Model<IOsSettings>) ||
  mongoose.model<IOsSettings>("OsSettings", OsSettingsSchema);

export default OsSettings;
