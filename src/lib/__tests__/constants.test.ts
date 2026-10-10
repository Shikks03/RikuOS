import { describe, it, expect } from "vitest";
import { NO_DEVICE_ERROR } from "@/lib/constants";

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

  it("reproduces route.ts's message byte-for-byte when built from the constant", () => {
    const message = `${NO_DEVICE_ERROR} (failed ${2}, removed ${1}). Re-subscribe from /freelance/queue.`;
    expect(message).toBe("the digest reached no device (failed 2, removed 1). Re-subscribe from /freelance/queue.");
  });
});
