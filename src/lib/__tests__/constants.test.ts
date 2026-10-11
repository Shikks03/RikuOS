import { describe, it, expect } from "vitest";
import { DEBRIEF_CACHE_MS, NO_DEVICE_ERROR } from "@/lib/constants";
import { dispatcherFromRow } from "@/lib/dispatcherRun";

/**
 * NO_DEVICE_ERROR is the dispatcher AgentRun's named marker for "the digest
 * reached no device" (route.ts, carried item 1 — Briefing Plan A post-build
 * record). The greeting line reads the dispatcher's stored `error` to tell a
 * zero-device run apart from a run that never happened at all, so the
 * constant's exact text is load-bearing, not cosmetic.
 */
describe("NO_DEVICE_ERROR", () => {
  it("is the exact prefix route.ts builds the zero-device error from", () => {
    expect(NO_DEVICE_ERROR).toBe("the digest reached no device");
  });

  // B0 fix round: the old second test rebuilt route.ts's template FROM
  // NO_DEVICE_ERROR and compared the result with itself — if the constant's
  // text ever drifted from what route.ts actually throws, both sides of that
  // comparison would drift together and the test would keep passing. This
  // one instead feeds dispatcherFromRow (dispatcherRun.ts) the exact literal
  // string route.ts produces today, written out by hand, and checks the
  // reader still recognises it — the real regression this constant guards
  // against.
  it("is recognised by dispatcherFromRow from route.ts's actual literal message, not a copy rebuilt from itself", () => {
    const row = dispatcherFromRow({
      ok: false,
      startedAt: new Date("2026-10-10T23:00:00Z"),
      error: "the digest reached no device (failed 1, removed 0). Re-subscribe from /freelance/queue.",
    });
    expect(row?.noDevice).toBe(true);
  });
});

describe("DEBRIEF_CACHE_MS (S22, spec §3.2)", () => {
  it("is one minute — its own constant, not the site floor's", () => {
    expect(DEBRIEF_CACHE_MS).toBe(60_000);
  });
});
