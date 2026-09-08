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

export interface IHealthSnapshot extends Document<string> {
  _id: string;
  checkedAt: Date;
  sites: IHealthSite[];
  createdAt: Date;
  updatedAt: Date;
}

/** The singleton's one and only _id. See the schema docblock below. */
export const HEALTH_SNAPSHOT_ID = "singleton";

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
 * FIXED `_id`, unlike OsSettings' `{}` filter, because the failure modes are
 * not comparable (R55). Two first writes racing — the likelier pair is two
 * `Check now` presses, both reading null, both spending 8 s inside
 * checkSites(), both upserting — would leave two documents; `findOne({})` then
 * returns them in natural order, which Mongo does not specify; and a read that
 * settles on the orphan while the cron writes the other one makes the strip
 * PERMANENTLY amber, with `Check now` appearing not to fix it. That is a wrong
 * strip rather than a stale one. A settings document written twice is right
 * either way, which is why osSettings.ts can accept the hole with a sentence.
 * The `_id` index is always unique and always present, so this costs no new
 * index, no sync-indexes change and no migration.
 *
 * updatedAt is on because updates are the entire point of this record.
 * createdAt is on because CLAUDE.md asks for the pair to be declared
 * explicitly; it records when the row first appeared and nothing reads it.
 * No Schema.Types.Mixed, no unbounded string, and the array is bounded — three
 * sites are watched today and 20 is a ceiling, not a target.
 *
 * `sites` carries NO `required: true`, and the option would add nothing if it
 * did: in Mongoose 9.9.4 `required: true` on an array does NOT reject `[]`
 * (SchemaArray.checkRequired accepts an empty array unless a caller overrides
 * it), so the guard people reach for here does not exist. It is omitted on
 * purpose all the same — an empty reading is valid and means something real:
 * the check ran and watched nothing. The bound validator stays.
 */
const HealthSnapshotSchema = new Schema<IHealthSnapshot>(
  {
    _id: { type: String, default: HEALTH_SNAPSHOT_ID, enum: [HEALTH_SNAPSHOT_ID], maxlength: 16 },
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
