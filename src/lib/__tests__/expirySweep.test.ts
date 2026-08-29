/**
 * Covers the seam the P3→P5a extraction created: expirySweep composes two
 * sweeps whose builders are already tested in queue.test.ts, but nothing tested
 * that it runs them in the right order and maps each result to the right field.
 *
 * That gap matters because the two counts are reported differently to a human:
 * `unstuck` raises "approved items could not confirm their result", a real
 * alarm about a possible message to a real client. Transposing it with
 * `expired` would push a false alarm and pass every other test in the suite.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runExpirySweep } from "@/lib/jobs/expirySweep";
import { buildActionSweep, buildExpirySweep } from "@/lib/queue";
import ApprovalItem from "@/models/ApprovalItem";

// `discriminator`/`discriminators` are here because queue.ts pulls in
// FollowupDraftApproval, which registers itself against this model at import
// time — without them the module graph fails to load before any test runs.
vi.mock("@/models/ApprovalItem", () => ({
  default: {
    updateMany: vi.fn(),
    discriminators: {},
    discriminator: vi.fn(() => ({})),
  },
}));

const updateMany = ApprovalItem.updateMany as unknown as ReturnType<typeof vi.fn>;

const NOW = new Date("2026-08-30T00:00:00.000Z");

beforeEach(() => {
  updateMany.mockReset();
});

describe("runExpirySweep", () => {
  it("maps the expiry count to `expired` and the action count to `unstuck`", async () => {
    updateMany
      .mockResolvedValueOnce({ modifiedCount: 3 })
      .mockResolvedValueOnce({ modifiedCount: 1 });

    expect(await runExpirySweep(NOW)).toEqual({ expired: 3, unstuck: 1 });
  });

  it("sweeps expiry first and interrupted actions second", async () => {
    updateMany.mockResolvedValue({ modifiedCount: 0 });

    await runExpirySweep(NOW);

    expect(updateMany).toHaveBeenCalledTimes(2);
    const [first, second] = updateMany.mock.calls;
    expect(first[0]).toEqual(buildExpirySweep(NOW).filter);
    expect(first[1]).toEqual(buildExpirySweep(NOW).update);
    expect(second[0]).toEqual(buildActionSweep(NOW).filter);
    expect(second[1]).toEqual(buildActionSweep(NOW).update);
  });

  it("reports zero rather than undefined when nothing matched", async () => {
    updateMany.mockResolvedValue({ modifiedCount: 0 });

    expect(await runExpirySweep(NOW)).toEqual({ expired: 0, unstuck: 0 });
  });

  it("propagates a failure so runJob can record the run as failed", async () => {
    updateMany.mockRejectedValue(new Error("mongo down"));

    await expect(runExpirySweep(NOW)).rejects.toThrow("mongo down");
  });
});
