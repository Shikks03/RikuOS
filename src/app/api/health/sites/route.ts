import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { checkSites } from "@/lib/siteHealth";
import {
  getHealthSnapshot,
  isWithinCheckFloor,
  saveHealthSnapshot,
} from "@/lib/healthSnapshot";

/** Three sites at an 8s timeout each, in parallel, plus two round trips to Atlas. */
export const maxDuration = 30;

/**
 * POST /api/health/sites — take a new site-health reading.
 *
 * POST because it performs the checks; the noun is what is being read, which
 * leaves GET free if a JSON view is ever wanted.
 *
 * The route is deliberately thin. Its one decision — the 60-second floor —
 * lives in isWithinCheckFloor, which is a pure function a test can reach; the
 * repo has no route-level tests and this phase adds none.
 *
 * NO PROXY CHANGE. This path is under /api/ and is not in isPublicPath, so
 * src/proxy.ts already fails closed in front of it. requireSession runs anyway,
 * as the first statement, per CLAUDE.md's defence-in-depth rule — and for a
 * mutating method it is also the Origin check.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  // The floor reads the stored snapshot, so it needs the database and cannot
  // sit above this line.
  await connectDB();

  const existing = await getHealthSnapshot();
  if (isWithinCheckFloor(new Date(), existing?.checkedAt ?? null)) {
    // Inside the floor, return the EXISTING reading rather than an error: a
    // reading twenty seconds old IS current, and Riku pressing twice is not a
    // mistake that deserves an error state. The floor exists so a stuck finger
    // cannot fire nine requests at client sites, not to defend against abuse —
    // there is exactly one user behind a session cookie.
    //
    // No new collection, no counter, and specifically not an in-memory map: on
    // Vercel that is per-instance and therefore not a limit at all.
    return NextResponse.json({
      checkedAt: existing!.checkedAt.toISOString(),
      sites: existing!.sites,
      fresh: false,
    });
  }

  const sites = await checkSites();
  // The moment the reading was taken — after the checks resolve, which is
  // the contract saveHealthSnapshot's docblock states (the results describe
  // the sites as of then).
  const checkedAt = new Date();
  await saveHealthSnapshot(checkedAt, sites);

  return NextResponse.json({
    checkedAt: checkedAt.toISOString(),
    sites,
    fresh: true,
  });
}
