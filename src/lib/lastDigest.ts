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

export interface StoredDigest {
  /** The real send time — rendered in APP_TZ, never the cron's nominal hour. */
  sentAt: Date;
  title: string;
  body: string;
  /** Subscriptions the send reached. Stored, never rendered (§4.4). */
  devices: number;
}

// Typed against StoredDigest so a fifth field on the interface must FAIL TO
// COMPILE here rather than stay out of the projection and read as absent
// forever — getHealthSnapshot()'s pattern.
const DIGEST_PROJECTION: Record<keyof StoredDigest, 1> & { _id: 0 } = {
  sentAt: 1,
  title: 1,
  body: 1,
  devices: 1,
  _id: 0,
};

/** findOne on the fixed id. NEVER upserts. null when absent (R55). */
export async function getLastDigest(): Promise<StoredDigest | null> {
  const doc = await LastDigest.findOne({ _id: LAST_DIGEST_ID }, DIGEST_PROJECTION).lean();
  if (!doc) return null;

  const row = doc as unknown as {
    sentAt?: unknown;
    title?: string;
    body?: string;
    devices?: number;
  };
  // .lean() validates nothing on the way out; see the file header.
  if (!(row.sentAt instanceof Date)) return null;

  return {
    sentAt: row.sentAt,
    title: row.title ?? "",
    body: row.body ?? "",
    devices: row.devices ?? 0,
  };
}

/**
 * Overwritten whole. One retry on E11000, then it throws.
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
 */
export async function saveLastDigest(
  sentAt: Date,
  payload: PushPayload,
  devices: number
): Promise<void> {
  const write = () =>
    LastDigest.findOneAndUpdate(
      { _id: LAST_DIGEST_ID },
      { $set: { sentAt, title: payload.title, body: payload.body, devices } },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

  try {
    await write();
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code !== 11000) throw err;
    await write();
  }
}
