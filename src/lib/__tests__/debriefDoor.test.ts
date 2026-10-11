/**
 * The press (debriefDoor.ts), with its edges mocked: the database connection,
 * the singleton's accessors, the fresh reads, and AgentRun.create (so runJob
 * itself runs for real and every run row it writes is counted). The pure
 * middle — buildDebrief — runs for real too.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/lastDebrief", () => ({ getLastDebrief: vi.fn(), saveLastDebrief: vi.fn() }));
vi.mock("@/lib/debriefRead", () => ({ readDebriefChecks: vi.fn(), readTodaysBaseline: vi.fn() }));
vi.mock("@/models/AgentRun", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/models/AgentRun")>();
  return { ...actual, default: { create: vi.fn() } };
});

import { pressDebrief } from "@/lib/debriefDoor";
import { connectDB } from "@/lib/db";
import { getLastDebrief, saveLastDebrief } from "@/lib/lastDebrief";
import { readDebriefChecks, readTodaysBaseline } from "@/lib/debriefRead";
import AgentRun from "@/models/AgentRun";
import type { DebriefOutcomes } from "@/lib/debrief";
import type { DebriefRecord, StoredDebrief } from "@/lib/briefingTypes";

const create = AgentRun.create as unknown as ReturnType<typeof vi.fn>;
const SENT_AT = new Date("2026-10-12T23:00:04.000Z"); // 07:00 Manila
const NOW = new Date("2026-10-13T05:04:00.000Z"); // 13:04 Manila
const HEALTHY: DebriefOutcomes = {
  watchdog: { ok: true, anomalies: [], runs: [] },
  sites: { ok: true, results: [], savedAt: NOW, ownSaveJustFailed: false },
  shikkstracker: { ok: true, findings: [], attention: { repliedUnanswered: 0, overdue: 0 } },
  today: { events: [], missedLayers: [], due: [], overdue: [] },
  pending: 0,
  chaserEnabled: true,
  since: null,
};

/** What the mocked singleton holds — saveLastDebrief writes it, getLastDebrief reads it back. */
let stored: StoredDebrief | null = null;

beforeEach(() => {
  stored = null;
  vi.mocked(connectDB).mockReset().mockResolvedValue({} as Awaited<ReturnType<typeof connectDB>>);
  vi.mocked(getLastDebrief).mockReset().mockImplementation(async () => stored);
  vi.mocked(saveLastDebrief)
    .mockReset()
    .mockImplementation(async (d: DebriefRecord) => {
      stored = { ...d, saved: true };
    });
  vi.mocked(readTodaysBaseline).mockReset().mockResolvedValue(null);
  vi.mocked(readDebriefChecks).mockReset().mockResolvedValue(HEALTHY);
  create.mockReset().mockResolvedValue({});
});

describe("pressDebrief (S22, spec §3.1)", () => {
  it("builds, saves and records exactly one debrief run", async () => {
    const out = await pressDebrief(NOW);
    expect(out).toMatchObject({ status: 200, body: { title: "Debrief at 13:04: all clear.", saved: true } });
    expect(saveLastDebrief).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ agent: "debrief", ok: true, counts: { itemsProcessed: 1, itemsFailed: 0 } });
  });

  it("reads the baseline first and checks against its sentAt (plan deviation 9)", async () => {
    vi.mocked(readTodaysBaseline).mockResolvedValue({ sentAt: SENT_AT, symptoms: [] });
    const out = await pressDebrief(NOW);
    expect(readDebriefChecks).toHaveBeenCalledWith(NOW, SENT_AT);
    expect(out).toMatchObject({ status: 200, body: { baselineSentAt: SENT_AT } });
  });

  it("a second press inside a minute returns the same document and writes no second row (spec §3.2, §7.2 item 7)", async () => {
    const first = await pressDebrief(NOW);
    const second = await pressDebrief(new Date(NOW.getTime() + 30_000));
    expect(second).toEqual(first);
    expect(readDebriefChecks).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("a minute later it checks again", async () => {
    await pressDebrief(NOW);
    await pressDebrief(new Date(NOW.getTime() + 60_000));
    expect(readDebriefChecks).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("a stored Debrief stamped in the future (clock skew) is never served from the cache", async () => {
    const first = await pressDebrief(NOW);
    if (first.status !== 200) throw new Error("unreachable");
    stored = { ...first.body, at: new Date(NOW.getTime() + 5_000) };
    await pressDebrief(NOW);
    expect(readDebriefChecks).toHaveBeenCalledTimes(2);
  });

  // Fix round (principal review, item 1): the floor alone ignores the day
  // boundary. Without the dayKey guard, a press either side of midnight both
  // land inside the 60-second floor and the second hands back YESTERDAY's
  // Debrief — then the panel remounting under an already-on-screen document
  // is how that reads as "it closed".
  it("a press either side of APP_TZ midnight, inside the floor, never reuses yesterday's Debrief", async () => {
    const beforeMidnight = new Date("2026-10-12T15:59:30.000Z"); // 23:59:30 Manila, 12 Oct
    const afterMidnight = new Date("2026-10-12T16:00:10.000Z"); // 00:00:10 Manila, 13 Oct — 40s later
    await pressDebrief(beforeMidnight);
    await pressDebrief(afterMidnight);
    expect(readDebriefChecks).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(2);
  });

  // Fix round (principal review, item 1): a cached Debrief built before
  // today's 07:00 Briefing existed (baselineSentAt null) must not survive
  // past PUSH_EXPECTED_HOUR — the Briefing may have just landed, and the
  // cached "Right now" list would otherwise outlive the baseline it was
  // missing.
  it("a no-baseline Debrief built before 07:00 is never reused once the press crosses 07:00", async () => {
    const beforeSeven = new Date("2026-10-12T22:59:40.000Z"); // 06:59:40 Manila, 13 Oct
    const afterSeven = new Date("2026-10-12T23:00:20.000Z"); // 07:00:20 Manila, 13 Oct — 40s later

    vi.mocked(readTodaysBaseline).mockResolvedValue(null);
    const first = await pressDebrief(beforeSeven);
    expect(first).toMatchObject({ status: 200, body: { baselineSentAt: null } });

    // The digest lands in between — a baseline now exists.
    vi.mocked(readTodaysBaseline).mockResolvedValue({ sentAt: SENT_AT, symptoms: [] });
    const second = await pressDebrief(afterSeven);

    expect(readDebriefChecks).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(2);
    expect(second).toMatchObject({ status: 200, body: { baselineSentAt: SENT_AT } });
  });

  it("a failed cache read is not a failed Debrief: it builds fresh and records its run (§7.2 item 11)", async () => {
    vi.mocked(getLastDebrief).mockRejectedValue(new Error("MongoNetworkError: closed"));
    const out = await pressDebrief(NOW);
    expect(out.status).toBe(200);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("no database: a typed 500, no run row, no reads (§7.2 item 12)", async () => {
    vi.mocked(connectDB).mockRejectedValue(new Error("server selection timed out"));
    expect(await pressDebrief(NOW)).toEqual({ status: 500, body: { error: "debrief-failed" } });
    expect(create).not.toHaveBeenCalled();
    expect(readDebriefChecks).not.toHaveBeenCalled();
  });

  it("a failed save still answers with the Debrief, saved: false, and is a failed item (spec §6)", async () => {
    vi.mocked(saveLastDebrief).mockRejectedValue(new Error("write failed"));
    const out = await pressDebrief(NOW);
    expect(out).toMatchObject({ status: 200, body: { saved: false } });
    expect(create.mock.calls[0][0]).toMatchObject({ ok: true, counts: { itemsProcessed: 1, itemsFailed: 1 } });
  });

  // Fix round (feature review, item 1): the save had no deadline of its own —
  // a stuck write could wait out the socket timeout and run past this
  // route's maxDuration, with Vercel killing the function before the
  // AgentRun row lands. A timeout here must read exactly like a save that
  // threw: saved: false, the same failed-item count.
  it("a stuck save times out and is read as a failed save, same as a save that threw", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      vi.mocked(saveLastDebrief).mockImplementation(() => new Promise(() => {}));
      const pending = pressDebrief(NOW);
      await vi.advanceTimersByTimeAsync(5_000);
      const out = await pending;
      expect(out).toMatchObject({ status: 200, body: { saved: false } });
      expect(create.mock.calls[0][0]).toMatchObject({ ok: true, counts: { itemsProcessed: 1, itemsFailed: 1 } });
    } finally {
      vi.useRealTimers();
    }
  });

  it("each source it couldn't check is a failed item on the run", async () => {
    vi.mocked(readDebriefChecks).mockResolvedValue({ ...HEALTHY, watchdog: { ok: false }, shikkstracker: { ok: false } });
    await pressDebrief(NOW);
    expect(create.mock.calls[0][0]).toMatchObject({ ok: true, counts: { itemsFailed: 2 } });
  });

  it("a bug in the build is a typed 500 with a failed run row, and nothing is saved (§7.2 item 8)", async () => {
    vi.mocked(readDebriefChecks).mockRejectedValue(new Error("boom"));
    expect(await pressDebrief(NOW)).toEqual({ status: 500, body: { error: "debrief-failed" } });
    expect(saveLastDebrief).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0]).toMatchObject({ agent: "debrief", ok: false, error: "boom" });
  });

  it("never pushes and never runs the expiry sweep — neither is even imported (spec §3.1)", () => {
    for (const file of ["src/lib/debriefDoor.ts", "src/lib/debriefRead.ts", "src/app/api/briefing/debrief/route.ts"]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/sendPushToAll|@\/lib\/push["']|runExpirySweep|jobs\/expirySweep/);
    }
  });
});
