import mongoose, { Document, Model, Schema } from "mongoose";

export interface ILastDigest extends Document<string> {
  _id: string;
  sentAt: Date;
  title: string;
  body: string;
  devices: number;
}

/** The singleton's one and only _id. See the schema docblock below. */
export const LAST_DIGEST_ID = "latest";

/**
 * Singleton: the text of the most recent morning push, overwritten whole on
 * every send. Access ONLY through src/lib/lastDigest.ts. The push tile quotes
 * it; AgentRun records counts and an error, never the text (D14).
 *
 * This is R55's singleton — HealthSnapshot's pattern, not OsSettings'. It is
 * overwritten whole and never defaulted, so it takes a FIXED `_id` rather
 * than the `{}` filter, is written by findOneAndUpdate on that id with upsert
 * and one retry on the E11000 duplicate-key race, and its read-only accessor
 * returns null when the document is absent rather than the schema's defaults
 * — because a push that was never stored is a fact the page reports (`No push
 * recorded yet.`), not a gap to paper over. The `_id` index is always unique
 * and always present, so it declares no index of its own.
 *
 * No timestamps: `sentAt` IS the timestamp, and a second one would invite the
 * question of which is true.
 *
 * `devices` — how many subscriptions the send reached — stays on the model
 * and is NOT rendered (§4.4). It is neither dead weight to delete nor a figure
 * to surface. The bounds match what is sent: 80 is buildPushPayload's title
 * slice; 320 is the body bound the Today sentence brings.
 *
 * NO TTL, like HealthSnapshot: the newest push has to be present whenever the
 * Personal page renders, and expiring it would manufacture `No push recorded
 * yet.` out of our own cleanup.
 */
const LastDigestSchema = new Schema<ILastDigest>(
  {
    _id: { type: String, default: LAST_DIGEST_ID, enum: [LAST_DIGEST_ID], maxlength: 16 },
    sentAt: { type: Date, required: true },
    title: { type: String, required: true, maxlength: 80 },
    body: { type: String, required: true, maxlength: 320 },
    devices: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: false }, strict: true }
);

const LastDigest =
  (mongoose.models.LastDigest as Model<ILastDigest>) ||
  mongoose.model<ILastDigest>("LastDigest", LastDigestSchema);

export default LastDigest;
