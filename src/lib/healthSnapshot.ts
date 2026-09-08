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
 * `sites never checked`. A stored document with no `Date` checkedAt also reads
 * as null — the absence register — because throwing is worse and R56's failure
 * register belongs to a read that threw. The upsert belongs to the write path
 * only (R47).
 *
 * Callers must have connectDB()'d already — same convention as the rest of the
 * lib layer.
 */

import HealthSnapshot, { HEALTH_SNAPSHOT_ID } from "@/models/HealthSnapshot";
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

// Typed against StoredHealth so a third field on the interface must FAIL TO
// COMPILE here rather than compile into the return object, stay out of the
// projection and read as absent forever — readOsSettings()'s pattern.
const SNAPSHOT_PROJECTION: Record<keyof StoredHealth, 1> & { _id: 0 } = {
  checkedAt: 1,
  sites: 1,
  _id: 0,
};

/**
 * The newest reading, or null when none has ever been written.
 * findOne — never an upsert. See the file header.
 */
export async function getHealthSnapshot(): Promise<StoredHealth | null> {
  const doc = await HealthSnapshot.findOne({ _id: HEALTH_SNAPSHOT_ID }, SNAPSHOT_PROJECTION).lean();
  if (!doc) return null;

  const row = doc as unknown as { checkedAt?: unknown; sites?: SiteResult[] };
  // R41's rule at a harder edge: .lean() applies no schema defaults and the
  // cast below asserts the shape of a document nobody validated on the way
  // out. buildHealthStrip calls .getTime() on this field outside the page's
  // try, so a document whose checkedAt is missing or is a string would throw
  // the whole page rather than render `sites never checked`.
  if (!(row.checkedAt instanceof Date)) return null;

  return {
    checkedAt: row.checkedAt,
    sites: (row.sites ?? []).map((s) => ({ name: s.name, up: s.up, detail: s.detail })),
  };
}

/**
 * Overwrites the singleton. The upsert lives here, on the write path, where a
 * created document is a real reading rather than a manufactured one.
 *
 * `checkedAt` is the moment the reading was TAKEN — captured after
 * checkSites() resolves, because the results describe the sites as of then and
 * not as of the eight seconds earlier when the job started.
 *
 * The retry is the losing side of the first-write race (R55): two callers can
 * both find no document and both upsert, and Mongo answers the second with a
 * duplicate key on `_id`. By then the winner's document exists, so the
 * identical call is a plain update and succeeds. Exactly one retry — any other
 * error, and a second 11000, propagate to the caller, which writes the failed
 * AgentRun. No infinite retry, no silent failure.
 */
export async function saveHealthSnapshot(
  checkedAt: Date,
  sites: SiteResult[]
): Promise<void> {
  const write = () =>
    HealthSnapshot.findOneAndUpdate(
      { _id: HEALTH_SNAPSHOT_ID },
      { $set: { checkedAt, sites } },
      {
        upsert: true,
        setDefaultsOnInsert: true,
        // Mongoose update validators are off by default — without this the
        // maxlength and array bounds on the schema are decorative on this
        // path. Verified against Mongoose 9.9.4's source at both levels: on a
        // whole-array $set, `sites`' own length validator runs AND every
        // subdocument's maxlength runs with it.
        runValidators: true,
      }
    );

  try {
    await write();
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code !== 11000) throw err;
    await write();
  }
}
