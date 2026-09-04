import mongoose, { Document, Model, Schema } from "mongoose";

export interface IOsSettings extends Document {
  chaserEnabled: boolean;
  chaserNDays: number;
  monitoringEnabled: boolean;
  triageEnabled: boolean;
  knowledgeBlock: string;
  knowledgeReviewedAt: Date | null;
  nameableProjects: string[];
  holdingText: string;
  demoSiteUrls: { packageKey: string; url: string }[];
  updatedAt: Date;
}

// Above the OsSettings schema. A Map of String would be unbounded per entry;
// this keeps both halves capped and keeps CLAUDE.md's "no Mixed" rule.
const DemoSiteSchema = new Schema(
  {
    packageKey: { type: String, required: true, maxlength: 20 },
    url: { type: String, required: true, maxlength: 500 },
  },
  { _id: false, strict: true }
);

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
    monitoringEnabled: { type: Boolean, required: true, default: false },
    triageEnabled: { type: Boolean, required: true, default: false },
    knowledgeBlock: { type: String, maxlength: 4000, default: "" },
    // null means "Riku has not approved this yet" and is load-bearing:
    // draftPolicy withholds the substantive answer entirely until it is set
    // (design D11). Do NOT give this a default.
    knowledgeReviewedAt: { type: Date, default: null },
    nameableProjects: {
      type: [{ type: String, maxlength: 200 }],
      default: [],
    },
    holdingText: {
      type: String,
      maxlength: 500,
      default: "Hi! Thanks for messaging — I've seen this and I'll get back to you shortly.",
    },
    demoSiteUrls: { type: [DemoSiteSchema], default: [] },
  },
  { timestamps: { createdAt: false, updatedAt: true }, strict: true }
);

const OsSettings =
  (mongoose.models.OsSettings as Model<IOsSettings>) ||
  mongoose.model<IOsSettings>("OsSettings", OsSettingsSchema);

export default OsSettings;
