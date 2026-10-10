import mongoose, { Document, Model, Schema } from "mongoose";
// Relative with .ts extensions — scripts/sync-indexes.mts loads models under
// `node --experimental-strip-types`, which resolves no "@/" alias (see
// ApprovalItem.ts and LastDigest.ts).
import {
  DEBRIEF_BOUNDS as D,
  DEBRIEF_SOURCES,
  PROBLEM_KEYS,
  type StoredDebriefSymptom,
  type StoredSortedItem,
  type StoredStandaloneLine,
  type StoredSymptom,
} from "../lib/briefingTypes.ts";
import { maxItems, symptomFields } from "./LastDigest.ts";

export interface ILastDebrief extends Document<string> {
  _id: string;
  at: Date;
  baselineSentAt: Date | null;
  title: string;
  sorted: StoredSortedItem[];
  stillNeedsYou: StoredDebriefSymptom[];
  new: StoredSymptom[];
  now: StoredSymptom[];
  standaloneCouldntCheck: StoredStandaloneLine[];
  since: string[];
  today: string;
  freelance: string | null;
  off: string | null;
  unrecognised: number;
  couldntCheck: { sites: boolean; watchdog: boolean; shikkstracker: boolean };
}

const wholeNumber = { validator: Number.isInteger, message: "must be a whole number" };

const SortedSchema = new Schema(
  {
    key: { type: String, required: true, enum: PROBLEM_KEYS },
    subject: { type: String, default: null, maxlength: D.subject },
    sentence: { type: String, required: true, maxlength: D.sortedSentence },
  },
  { _id: false },
);

/** A Still-needs-you row: a symptom plus the can't-say note (plan deviation 4). */
const StillSchema = new Schema(
  { ...symptomFields(), note: { type: String, default: null, maxlength: D.note } },
  { _id: false },
);

const RowSchema = new Schema(symptomFields(), { _id: false });

const StandaloneSchema = new Schema(
  {
    source: { type: String, required: true, enum: DEBRIEF_SOURCES },
    sentence: { type: String, required: true, maxlength: D.standaloneSentence },
  },
  { _id: false },
);

const CouldntCheckSchema = new Schema(
  {
    sites: { type: Boolean, required: true },
    watchdog: { type: Boolean, required: true },
    shikkstracker: { type: Boolean, required: true },
  },
  { _id: false },
);

/** The singleton's one and only _id. */
export const DEBRIEF_ID = "latest";

/**
 * Singleton (S22): the latest "Debrief now" result, overwritten whole by every
 * real press. Access ONLY through src/lib/lastDebrief.ts.
 *
 * R55's pattern, exactly as LastDigest and HealthSnapshot: a FIXED `_id`,
 * findOneAndUpdate with upsert and one retry on E11000, and a read-only
 * accessor that returns null when the document is absent — a Debrief never
 * taken is a fact ("no Debrief yet"), not a gap to fill with defaults.
 *
 * Its own collection, not a field on LastDigest (spec §5.3): the 07:00 save
 * overwrites LastDigest whole and would silently clobber a Debrief.
 *
 * NO TTL (spec §5.2): the newest Debrief must be there whenever any device
 * reopens the panel; expiring it would manufacture "no Debrief yet" out of our
 * own cleanup. Run history expires in AgentRun (90 d); this is what the run
 * produced, not the run.
 *
 * Typed sub-schemas, every string bounded, every array capped — no Mixed.
 * `saved` is NOT a field: the door sets it on the response only. No index
 * beyond `_id`.
 *
 * No timestamps: `at` IS the timestamp.
 */
const LastDebriefSchema = new Schema<ILastDebrief>(
  {
    _id: { type: String, default: DEBRIEF_ID, enum: [DEBRIEF_ID], maxlength: 16 },
    at: { type: Date, required: true },
    baselineSentAt: { type: Date, default: null },
    title: { type: String, required: true, maxlength: D.title },
    sorted: { type: [SortedSchema], default: [], validate: maxItems(D.sorted) },
    stillNeedsYou: { type: [StillSchema], default: [], validate: maxItems(D.stillNeedsYou) },
    new: { type: [RowSchema], default: [], validate: maxItems(D.newProblems) },
    now: { type: [RowSchema], default: [], validate: maxItems(D.now) },
    standaloneCouldntCheck: { type: [StandaloneSchema], default: [], validate: maxItems(D.standalone) },
    since: { type: [{ type: String, maxlength: D.sinceLine }], default: [], validate: maxItems(D.since) },
    // `today` may be "" (both reads failed and their rows say so) — a default,
    // not `required`, which rejects the empty string.
    today: { type: String, default: "", maxlength: D.today },
    freelance: { type: String, default: null, maxlength: D.freelance },
    off: { type: String, default: null, maxlength: D.off },
    unrecognised: { type: Number, required: true, min: 0, validate: wholeNumber },
    couldntCheck: { type: CouldntCheckSchema, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: false }, strict: true },
);

const LastDebrief =
  (mongoose.models.LastDebrief as Model<ILastDebrief>) ||
  mongoose.model<ILastDebrief>("LastDebrief", LastDebriefSchema);

export default LastDebrief;
