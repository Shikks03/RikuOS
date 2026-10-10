/**
 * lastDebrief.ts — access layer for the latest Debrief (S22). Mirrors
 * lastDigest.ts exactly (R55): the read is a findOne on the fixed id and never
 * an upsert, so a page view is never a write (R37); a missing document reads
 * as null, not as schema defaults, because a Debrief never taken is a fact;
 * a stored document whose `at` is not a Date reads as null too (throwing is
 * worse than absence). The upsert belongs to the write path only.
 *
 * Callers must have connectDB()'d already — same convention as the rest of the
 * lib layer.
 */

import LastDebrief, { DEBRIEF_ID } from "@/models/LastDebrief";
import type {
  DebriefRecord,
  StoredDebrief,
  StoredDebriefSymptom,
  StoredSortedItem,
  StoredStandaloneLine,
  StoredSymptom,
} from "@/lib/briefingTypes";

// Typed against DebriefRecord so a new field on the interface must FAIL TO
// COMPILE here rather than stay out of the projection and read as absent
// forever — getHealthSnapshot()'s pattern.
const DEBRIEF_PROJECTION: Record<keyof DebriefRecord, 1> & { _id: 0 } = {
  at: 1,
  baselineSentAt: 1,
  title: 1,
  sorted: 1,
  stillNeedsYou: 1,
  new: 1,
  now: 1,
  standaloneCouldntCheck: 1,
  since: 1,
  today: 1,
  freelance: 1,
  off: 1,
  unrecognised: 1,
  couldntCheck: 1,
  _id: 0,
};

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** .lean() applies no defaults: an absent subject reads as null, never undefined. */
function withSubject<T extends { subject?: unknown }>(row: T): T & { subject: string | null } {
  return { ...row, subject: typeof row.subject === "string" ? row.subject : null };
}

/** findOne on the fixed id. NEVER upserts. null when absent (R55). `saved` is true: it was read back. */
export async function getLastDebrief(): Promise<StoredDebrief | null> {
  const doc = await LastDebrief.findOne({ _id: DEBRIEF_ID }, DEBRIEF_PROJECTION).lean();
  if (!doc) return null;

  const row = doc as unknown as Partial<Record<keyof DebriefRecord, unknown>>;
  if (!(row.at instanceof Date)) return null;
  const cc = (typeof row.couldntCheck === "object" && row.couldntCheck !== null ? row.couldntCheck : {}) as Partial<
    Record<"sites" | "watchdog" | "shikkstracker", unknown>
  >;

  return {
    at: row.at,
    baselineSentAt: row.baselineSentAt instanceof Date ? row.baselineSentAt : null,
    title: typeof row.title === "string" ? row.title : "",
    sorted: list<StoredSortedItem>(row.sorted).map(withSubject),
    stillNeedsYou: list<StoredDebriefSymptom>(row.stillNeedsYou).map((s) => ({
      ...withSubject(s),
      note: typeof s.note === "string" ? s.note : null,
    })),
    new: list<StoredSymptom>(row.new).map(withSubject),
    now: list<StoredSymptom>(row.now).map(withSubject),
    standaloneCouldntCheck: list<StoredStandaloneLine>(row.standaloneCouldntCheck),
    since: list<unknown>(row.since).filter((line): line is string => typeof line === "string"),
    today: typeof row.today === "string" ? row.today : "",
    freelance: typeof row.freelance === "string" ? row.freelance : null,
    off: typeof row.off === "string" ? row.off : null,
    unrecognised: typeof row.unrecognised === "number" ? row.unrecognised : 0,
    couldntCheck: { sites: cc.sites === true, watchdog: cc.watchdog === true, shikkstracker: cc.shikkstracker === true },
    saved: true,
  };
}

/**
 * Overwritten whole. One retry on E11000 (the losing side of the first-write
 * race, R55), then it throws. The fields are copied by name, so a caller that
 * hands in a StoredDebrief can never write the response-only `saved`.
 * runValidators makes the schema's bounds real on this path.
 *
 * NOT wrapped here: the door catches it, because a helper that swallows its
 * own failure cannot be tested for failing.
 */
export async function saveLastDebrief(d: DebriefRecord): Promise<void> {
  const record: DebriefRecord = {
    at: d.at,
    baselineSentAt: d.baselineSentAt,
    title: d.title,
    sorted: d.sorted,
    stillNeedsYou: d.stillNeedsYou,
    new: d.new,
    now: d.now,
    standaloneCouldntCheck: d.standaloneCouldntCheck,
    since: d.since,
    today: d.today,
    freelance: d.freelance,
    off: d.off,
    unrecognised: d.unrecognised,
    couldntCheck: d.couldntCheck,
  };
  const write = () =>
    LastDebrief.findOneAndUpdate(
      { _id: DEBRIEF_ID },
      { $set: record },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );

  try {
    await write();
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code !== 11000) throw err;
    await write();
  }
}
