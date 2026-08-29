import { describe, it, expect, vi, beforeEach } from "vitest";
import { runJob } from "@/lib/jobs/runJob";
import AgentRun from "@/models/AgentRun";

vi.mock("@/models/AgentRun", () => ({
  default: { create: vi.fn().mockResolvedValue({}) },
}));

const create = AgentRun.create as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue({});
});

describe("runJob", () => {
  it("returns the work's data and records a successful run", async () => {
    const result = await runJob("watchdog", async () => ({
      counts: { itemsProcessed: 4 },
      data: ["anomaly"],
    }));

    expect(result.ok).toBe(true);
    expect(result.data).toEqual(["anomaly"]);
    expect(create).toHaveBeenCalledTimes(1);

    const record = create.mock.calls[0][0];
    expect(record.agent).toBe("watchdog");
    expect(record.ok).toBe(true);
    expect(record.counts).toEqual({
      itemsCreated: 0,
      itemsProcessed: 4,
      itemsSkipped: 0,
      itemsFailed: 0,
    });
  });

  it("converts a throw into a failed run instead of propagating it", async () => {
    const result = await runJob("site-health", async () => {
      throw new Error("network exploded");
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("network exploded");
    expect(result.data).toBeNull();
    expect(create.mock.calls[0][0].ok).toBe(false);
  });

  it("records the supplied note on an otherwise successful run", async () => {
    const result = await runJob("dispatcher", async () => ({ data: null }), "monitoring is disabled");

    expect(result.ok).toBe(true);
    expect(create.mock.calls[0][0].error).toBe("monitoring is disabled");
  });

  it("survives the AgentRun write itself failing", async () => {
    create.mockRejectedValue(new Error("mongo down"));

    const result = await runJob("watchdog", async () => ({ data: 1 }));

    expect(result.ok).toBe(true);
    expect(result.data).toBe(1);
  });
});
