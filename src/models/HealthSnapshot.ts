import mongoose, { Document, Model, Schema } from "mongoose";

export interface IHealthSite {
  name: string;
  up: boolean;
  detail: string;
}

/**
 * Mirrors SiteResult in src/lib/siteHealth.ts exactly, so the stored shape IS
 * the produced shape and there is no mapping layer to drift. `detail` holds the
 * strings classifyStatus/classifyError produce ("Meowchi ok",
 * "Meowchi returned HTTP 503"), which the health strip renders verbatim.
 */
const HealthSiteSchema = new Schema<IHealthSite>(
  {
    name: { type: String, required: true, maxlength: 60 },
    up: { type: Boolean, required: true },
    detail: { type: String, required: true, maxlength: 200 },
  },
  { _id: false, strict: true }
);

export interface IHealthSnapshot extends Document {
  checkedAt: Date;
  sites: IHealthSite[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Singleton: the most recent site-health reading, overwritten rather than
 * accumulated. Access ONLY through src/lib/healthSnapshot.ts.
 *
 * NO TTL, deliberately. Every other ephemeral record in this app expires
 * (AgentRun 90d, LoginAttempt 15min); this one must not, because the newest
 * reading has to be present whenever the Freelance page renders. Expiring it
 * would make the strip say "sites never checked" every time the document aged
 * out — an alarm produced by our own cleanup.
 *
 * updatedAt is on because updates are the entire point of this record.
 * No Schema.Types.Mixed, no unbounded string, and the array is bounded — three
 * sites are watched today and 20 is a ceiling, not a target.
 *
 * `sites` carries NO `required: true`. A Mongoose array already defaults to []
 * and `required` on an array is a known trap — its semantics on an empty array
 * are not "the field is present", so a legitimately empty reading would fail
 * validation. An empty reading is valid and means something real: the check ran
 * and watched nothing. The bound validator stays.
 */
const HealthSnapshotSchema = new Schema<IHealthSnapshot>(
  {
    checkedAt: { type: Date, required: true },
    sites: {
      type: [HealthSiteSchema],
      validate: {
        validator: (value: IHealthSite[]) => value.length <= 20,
        message: "sites holds at most 20 entries.",
      },
    },
  },
  { timestamps: { createdAt: true, updatedAt: true }, strict: true }
);

const HealthSnapshot =
  (mongoose.models.HealthSnapshot as Model<IHealthSnapshot>) ||
  mongoose.model<IHealthSnapshot>("HealthSnapshot", HealthSnapshotSchema);

export default HealthSnapshot;
