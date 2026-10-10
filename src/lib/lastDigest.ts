/**
 * lastDigest.ts — access layer for the stored text of the last morning push.
 *
 * getHealthSnapshot()'s shape exactly (R55): the read is a findOne on the
 * fixed id and never an upsert, so a page view is never a write (R37); and a
 * missing document reads as null, not as schema defaults, because a push that
 * was never stored has no honest defaults — the tile says `No push recorded
 * yet.` A stored document whose sentAt is not a Date also reads as null: the
 * tile renders sentAt as its stamp, and throwing is worse than absence. The
 * upsert belongs to the write path only.
 *
 * Callers must have connectDB()'d already — same convention as the rest of the
 * lib layer.
 */

import LastDigest, { LAST_DIGEST_ID } from "@/models/LastDigest";
import type { PushPayload } from "@/lib/push";
import type { StoredBriefing } from "@/lib/briefingTypes";

export interface StoredDigest {
  /** The real send time — rendered in APP_TZ, never the cron's nominal hour. */
  sentAt: Date;
  title: string;
  body: string;
  /** Subscriptions the send reached. Stored, never rendered (§4.4). */
  devices: number;
  /** S21. null = saved before S21, or the briefing couldn't be built that morning. */
  briefing: StoredBriefing | null;
  /** S21. When the full-screen greeting was dismissed; null = not yet today. */
  seenAt: Date | null;
}

// Typed against StoredDigest so a fifth field on the interface must FAIL TO
// COMPILE here rather than stay out of the projection and read as absent
// forever — getHealthSnapshot()'s pattern.
const DIGEST_PROJECTION: Record<keyof StoredDigest, 1> & { _id: 0 } = {
  sentAt: 1,
  title: 1,
  body: 1,
  devices: 1,
  briefing: 1,
  seenAt: 1,
  _id: 0,
};

/**
 * `row.briefing` as a `StoredBriefing`, or null when it isn't one. `.lean()`
 * validates nothing on the way out and applies no schema defaults, so a
 * record saved before `omitted` existed (Plan B) carries no such key; it
 * reads as 0 here, the same value the schema's own default would give a
 * fresh write, rather than undefined.
 */
function toBriefing(raw: unknown): StoredBriefing | null {
  if (typeof raw !== "object" || raw === null || !Array.isArray((raw as { stories?: unknown }).stories)) return null;
  const row = raw as StoredBriefing & { omitted?: unknown };
  return { ...row, omitted: typeof row.omitted === "number" ? row.omitted : 0 };
}

/** findOne on the fixed id. NEVER upserts. null when absent (R55). */
export async function getLastDigest(): Promise<StoredDigest | null> {
  const doc = await LastDigest.findOne({ _id: LAST_DIGEST_ID }, DIGEST_PROJECTION).lean();
  if (!doc) return null;

  const row = doc as unknown as {
    sentAt?: unknown;
    title?: string;
    body?: string;
    devices?: number;
    briefing?: unknown;
    seenAt?: unknown;
  };
  // .lean() validates nothing on the way out; see the file header.
  if (!(row.sentAt instanceof Date)) return null;

  return {
    sentAt: row.sentAt,
    title: row.title ?? "",
    body: row.body ?? "",
    devices: row.devices ?? 0,
    briefing: toBriefing(row.briefing),
    seenAt: row.seenAt instanceof Date ? row.seenAt : null,
  };
}

/**
 * Overwritten whole. One retry on E11000, then it throws. S21: the briefing
 * rides along (or an old one is unset), and seenAt is reset — a new morning
 * has not been seen.
 *
 * `sentAt` is the moment the push actually went out. The payload's url is
 * where a tap goes, not what was said, and is not stored. The body is stored
 * as sent — already sliced by the payload builder — and runValidators makes
 * the schema's bounds real on this path rather than decorative.
 *
 * The retry is the losing side of the first-write race (R55): by the time
 * Mongo answers the second upsert with a duplicate key on `_id`, the winner's
 * document exists and the identical call is a plain update. Exactly one retry;
 * any other error, and a second 11000, propagate.
 *
 * NOT wrapped here. The caller (the morning route) wraps it, because a helper
 * that swallows its own failure cannot be tested for failing.
 *
 * `briefing` defaults to `null` (unset) so a caller not yet updated for S21
 * still compiles and still writes a valid document — A8 is the one that
 * wires the morning route's real briefing through.
 */
export async function saveLastDigest(
  sentAt: Date,
  payload: PushPayload,
  devices: number,
  briefing: StoredBriefing | null = null,
): Promise<void> {
  const base = { sentAt, title: payload.title, body: payload.body, devices, seenAt: null };
  const update =
    briefing === null ? { $set: base, $unset: { briefing: 1 } } : { $set: { ...base, briefing } };
  const write = () =>
    LastDigest.findOneAndUpdate({ _id: LAST_DIGEST_ID }, update, {
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    });

  try {
    await write();
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code !== 11000) throw err;
    await write();
  }
}

/**
 * S21 — the once-a-day full-screen greeting was dismissed. A guarded atomic
 * update (CLAUDE.md): only THIS morning's briefing (`sentAt`), and only while
 * unseen. A stale sentAt matches nothing, so it can never mark a newer
 * morning as seen. `{seenAt: null}` also matches a record saved before S21
 * (the field absent). Returns whether it applied. Throws only on a database
 * error; the caller reports that without blocking the page.
 */
export async function markBriefingSeen(sentAt: Date, at: Date): Promise<boolean> {
  const doc = await LastDigest.findOneAndUpdate(
    { _id: LAST_DIGEST_ID, sentAt, seenAt: null },
    { $set: { seenAt: at } },
    { new: true, runValidators: true },
  );
  return doc !== null;
}
