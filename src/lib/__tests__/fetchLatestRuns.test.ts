/**
 * Covers watchdog.ts's one impure function. evaluateWatchdog is exhaustively
 * tested in watchdog.test.ts, but fetchLatestRuns — which builds a dot-notation
 * Mongo projection and then double-casts the result — had no coverage at all.
 *
 * That combination is exactly where a silent regression hides: the cast defeats
 * the type checker, so a typo in the "counts.itemsFailed" projection key still
 * compiles, and every run then reads `itemsFailed: undefined ?? 0` — permanently
 * masking every `degraded` anomaly the watchdog exists to raise.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchLatestRuns } from "@/lib/watchdog";
import AgentRun from "@/models/AgentRun";

vi.mock("@/models/AgentRun", () => ({
  default: { findOne: vi.fn() },
}));

const findOne = AgentRun.findOne as unknown as ReturnType<typeof vi.fn>;

/** Records the projection so the test can assert on it, then yields `doc`. */
function query(doc: unknown, projections: unknown[]) {
  return {
    sort: () => ({
      select: (projection: unknown) => {
        projections.push(projection);
        return { lean: async () => doc };
      },
    }),
  };
}

beforeEach(() => {
  findOne.mockReset();
});

describe("fetchLatestRuns", () => {
  it("projects counts.itemsFailed — the key every degraded anomaly depends on", async () => {
    const projections: unknown[] = [];
    findOne.mockImplementation(() => query(null, projections));

    await fetchLatestRuns(["chaser"]);

    expect(projections).toHaveLength(1);
    expect(projections[0]).toHaveProperty("counts.itemsFailed", 1);
  });

  it("maps a record onto LatestRun, carrying itemsFailed out of counts", async () => {
    const startedAt = new Date("2026-08-30T00:00:00.000Z");
    findOne.mockImplementation(() =>
      query({ agent: "chaser", startedAt, ok: true, counts: { itemsFailed: 2 } }, [])
    );

    expect(await fetchLatestRuns(["chaser"])).toEqual([
      { agent: "chaser", startedAt, ok: true, itemsFailed: 2 },
    ]);
  });

  it("defaults itemsFailed to 0 when the record carries no counts", async () => {
    const startedAt = new Date("2026-08-30T00:00:00.000Z");
    findOne.mockImplementation(() => query({ agent: "chaser", startedAt, ok: false }, []));

    const runs = await fetchLatestRuns(["chaser"]);
    expect(runs[0].itemsFailed).toBe(0);
    expect(runs[0].ok).toBe(false);
  });

  it("omits an agent that has no record, rather than inventing one", async () => {
    const startedAt = new Date("2026-08-30T00:00:00.000Z");
    findOne.mockImplementationOnce(() => query(null, []));
    findOne.mockImplementationOnce(() =>
      query({ agent: "dispatcher", startedAt, ok: true, counts: { itemsFailed: 0 } }, [])
    );

    const runs = await fetchLatestRuns(["chaser", "dispatcher"]);

    expect(runs.map((r) => r.agent)).toEqual(["dispatcher"]);
  });

  it("queries once per agent asked for", async () => {
    findOne.mockImplementation(() => query(null, []));

    await fetchLatestRuns(["chaser", "expiry-sweep", "site-health", "dispatcher"]);

    expect(findOne).toHaveBeenCalledTimes(4);
    expect(findOne.mock.calls.map((c) => c[0])).toEqual([
      { agent: "chaser" },
      { agent: "expiry-sweep" },
      { agent: "site-health" },
      { agent: "dispatcher" },
    ]);
  });
});
