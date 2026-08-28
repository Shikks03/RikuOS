import mongoose, { Document, Model, Schema } from "mongoose";

export interface IOsSettings extends Document {
  chaserEnabled: boolean;
  chaserNDays: number;
  updatedAt: Date;
}

/**
 * Singleton: exactly one document ever exists — access ONLY through
 * src/lib/osSettings.ts, which always queries with the empty filter `{}` and
 * upserts (CLAUDE.md singleton rule).
 *
 * P3 carries only the chaser fields (ARCHITECTURE.md §3.1 names them
 * explicitly); each later agent adds its own toggle when it ships. Defaults
 * are off so deploying an agent never silently activates it.
 */
const OsSettingsSchema = new Schema<IOsSettings>(
  {
    chaserEnabled: { type: Boolean, required: true, default: false },
    chaserNDays: { type: Number, required: true, default: 4, min: 1, max: 30 },
  },
  { timestamps: { createdAt: false, updatedAt: true }, strict: true }
);

const OsSettings =
  (mongoose.models.OsSettings as Model<IOsSettings>) ||
  mongoose.model<IOsSettings>("OsSettings", OsSettingsSchema);

export default OsSettings;
