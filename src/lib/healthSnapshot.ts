/**
 * healthSnapshot.ts — access layer for the stored site-health reading.
 *
 * The read path follows readOsSettings() (R37): findOne, never an upsert, so a
 * page view is never a write. What differs is what a missing document means.
 * Settings have honest schema defaults — the values the upsert would have
 * written — so readOsSettings() falls back to them. A reading that never
 * happened has none: an upsert or a default here would manufacture a document
 * with a made-up checkedAt and an empty sites array, and the health strip
 * would confidently report "checked just now, no sites watched" when in truth
 * nothing has ever run. So getHealthSnapshot() returns null, and Block F says
 * `sites never checked`. The upsert belongs to the write path only (R47).
 *
 * Callers must have connectDB()'d already — same convention as the rest of the
 * lib layer.
 */

import HealthSnapshot from "@/models/HealthSnapshot";
import type { SiteResult } from "@/lib/siteHealth";

/**
 * The server-side floor on `Check now`, read from the snapshot's own checkedAt.
 * It exists so a stuck finger cannot fire nine requests at client sites, not to
 * defend against abuse — there is exactly one user behind a session cookie.
 */
export const CHECK_FLOOR_MS = 60_000;

export interface StoredHealth {
  checkedAt: Date;
  sites: SiteResult[];
}

/**
 * Pure, so the route's one decision is unit-testable without a route, a
 * database or a network.
 *
 * A null snapshot is NEVER within the floor: nothing has been read, so there is
 * nothing to return instead. A checkedAt in the future is not within it either
 * — a clock skew must not make Check now permanently unusable.
 */
export function isWithinCheckFloor(
  now: Date,
  checkedAt: Date | null,
  floorMs: number = CHECK_FLOOR_MS
): boolean {
  if (checkedAt === null) return false;
  const age = now.getTime() - checkedAt.getTime();
  return age >= 0 && age < floorMs;
}

/**
 * The newest reading, or null when none has ever been written.
 * findOne — never an upsert. See the file header.
 */
export async function getHealthSnapshot(): Promise<StoredHealth | null> {
  const doc = await HealthSnapshot.findOne({})
    .select({ checkedAt: 1, sites: 1 })
    .lean();
  if (!doc) return null;

  const row = doc as unknown as { checkedAt: Date; sites?: SiteResult[] };
  return {
    checkedAt: row.checkedAt,
    sites: (row.sites ?? []).map((s) => ({ name: s.name, up: s.up, detail: s.detail })),
  };
}

/**
 * Overwrites the singleton. The upsert lives here, on the write path, where a
 * created document is a real reading rather than a manufactured one.
 */
export async function saveHealthSnapshot(
  checkedAt: Date,
  sites: SiteResult[]
): Promise<void> {
  await HealthSnapshot.findOneAndUpdate(
    {},
    { $set: { checkedAt, sites } },
    {
      upsert: true,
      setDefaultsOnInsert: true,
      // Mongoose update validators are off by default — without this the
      // maxlength and array bounds on the schema are decorative on this path.
      runValidators: true,
    }
  );
}
