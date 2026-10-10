import mongoose, { Document, Model, Schema } from "mongoose";
// Relative, with the .ts extension, on purpose — the same reason as
// ApprovalItem.ts: scripts/sync-indexes.mts loads every model under
// `node --experimental-strip-types`, which resolves no "@/" alias, so the old
// "@/lib/briefingTypes" import broke `npm run migrate:indexes` (Debrief plan
// deviation 15). briefingTypes.ts is import-free, so plain Node can load it,
// and a model may take its enums and bounds from it without pulling in the
// lib layer.
import {
  BRIEFING_BOUNDS as B,
  CAUSE_KEYS,
  DEBRIEF_BOUNDS,
  PROBLEM_KEYS,
  type StoredBriefing,
} from "../lib/briefingTypes.ts";

export interface ILastDigest extends Document<string> {
  _id: string;
  sentAt: Date;
  title: string;
  body: string;
  devices: number;
  briefing?: StoredBriefing;
  seenAt?: Date | null;
}

/** An array of at most `n` entries. Exported: LastDebrief caps its arrays the same way. */
export const maxItems = (n: number) => ({
  validator: (v: unknown[]) => Array.isArray(v) && v.length <= n,
  message: `at most ${n} items`,
});

const wholeNumber = { validator: Number.isInteger, message: "must be a whole number" };

export const BoldSchema = new Schema(
  { start: { type: Number, required: true, min: 0 }, end: { type: Number, required: true, min: 0 } },
  { _id: false },
);

/**
 * One stored symptom's fields, as a fresh object on every call (a definition
 * object is never shared between two Schema instances). LastDebrief builds its
 * row schemas from these, so a symptom is bounded the same way in both
 * singletons. `subject` (S22) is what a Debrief matches on: optional with a
 * null default, so every record saved before it stays valid.
 */
export function symptomFields() {
  return {
    key: { type: String, required: true, enum: PROBLEM_KEYS },
    subject: { type: String, default: null, maxlength: DEBRIEF_BOUNDS.subject },
    sentence: { type: String, required: true, maxlength: B.symptomSentence },
    bold: { type: [BoldSchema], default: [], validate: maxItems(B.bold) },
    nextStep: { type: String, required: true, maxlength: B.nextStep },
    causeKey: { type: String, required: true, enum: CAUSE_KEYS },
    cause: { type: String, required: true, maxlength: B.cause },
    causeBold: { type: [BoldSchema], default: [], validate: maxItems(B.bold) },
    raw: { type: String, default: null, maxlength: B.raw },
  };
}

const SymptomSchema = new Schema(symptomFields(), { _id: false });

const StorySchema = new Schema(
  {
    sentence: { type: String, required: true, maxlength: B.storySentence },
    bold: { type: [BoldSchema], default: [], validate: maxItems(B.bold) },
    symptoms: { type: [SymptomSchema], default: [], validate: maxItems(B.symptoms) },
  },
  { _id: false },
);

const BriefingSchema = new Schema(
  {
    stories: { type: [StorySchema], default: [], validate: maxItems(B.stories) },
    // `today` may be "" (a read failed and its story says so) — not `required`,
    // which rejects the empty string; a default keeps it present.
    today: { type: String, default: "", maxlength: B.today },
    freelance: { type: String, default: null, maxlength: B.freelance },
    off: { type: String, default: null, maxlength: B.off },
    unrecognised: { type: Number, required: true, min: 0 },
    // How many stories the `stories` slice (above) dropped. Defaulted so a
    // write from before this field existed still validates (Plan B carried
    // item 2); the read side (lastDigest.ts) defaults an absent stored value
    // to 0 the same way, since .lean() does not apply schema defaults.
    omitted: { type: Number, required: true, default: 0, min: 0, max: 1000, validate: wholeNumber },
  },
  { _id: false },
);

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
 *
 * S21: `briefing` is the structured Briefing the site renders (typed
 * sub-schemas, every string bounded, every array capped — no Mixed); `seenAt`
 * is set once by markBriefingSeen and reset to null by each morning's save.
 * Both optional, so records saved before S21 stay valid. S22: each symptom
 * also carries its `subject`. No index change: _id is still the only index.
 */
const LastDigestSchema = new Schema<ILastDigest>(
  {
    _id: { type: String, default: LAST_DIGEST_ID, enum: [LAST_DIGEST_ID], maxlength: 16 },
    sentAt: { type: Date, required: true },
    title: { type: String, required: true, maxlength: 80 },
    body: { type: String, required: true, maxlength: 320 },
    devices: { type: Number, required: true, min: 0 },
    briefing: { type: BriefingSchema, required: false },
    seenAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: false, updatedAt: false }, strict: true }
);

const LastDigest =
  (mongoose.models.LastDigest as Model<ILastDigest>) ||
  mongoose.model<ILastDigest>("LastDigest", LastDigestSchema);

export default LastDigest;
