/**
 * LastDebrief is R55's singleton — LastDigest's pattern exactly: the read
 * never writes, an absent document reads as null (a Debrief never taken is a
 * fact, not a gap), and the write retries the first-write race exactly once.
 * Only the model is mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLastDebrief, saveLastDebrief } from "@/lib/lastDebrief";
import LastDebrief from "@/models/LastDebrief";
import type { DebriefRecord } from "@/lib/briefingTypes";

vi.mock("@/models/LastDebrief", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/models/LastDebrief")>();
  return { ...actual, default: { findOne: vi.fn(), findOneAndUpdate: vi.fn() } };
});

const findOne = LastDebrief.findOne as unknown as ReturnType<typeof vi.fn>;
const findOneAndUpdate = LastDebrief.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>;

/** findOne(filter, projection).lean() — the exact chain getLastDebrief calls. */
function query(doc: unknown) {
  return { lean: async () => doc };
}

beforeEach(() => {
  findOne.mockReset();
  findOneAndUpdate.mockReset();
});

const AT = new Date("2026-10-13T05:04:00.000Z");
const RECORD: DebriefRecord = {
  at: AT,
  baselineSentAt: new Date("2026-10-12T23:00:04.000Z"),
  title: "Debrief at 13:04: all clear.",
  sorted: [{ key: "site-timeout", subject: "Meowchi", sentence: "Meowchi's site is back up." }],
  stillNeedsYou: [],
  new: [],
  now: [],
  standaloneCouldntCheck: [],
  since: ["You’ve ticked off Essay."],
  today: "Nothing on today, and nothing due.",
  freelance: null,
  off: null,
  unrecognised: 0,
  couldntCheck: { sites: false, watchdog: false, shikkstracker: false },
};

describe("getLastDebrief", () => {
  it("returns null when no Debrief was ever taken — never the schema's defaults", async () => {
    findOne.mockImplementation(() => query(null));
    expect(await getLastDebrief()).toBeNull();
  });

  it("returns the stored Debrief, nothing else the document carries, marked saved", async () => {
    findOne.mockImplementation(() => query({ _id: "latest", ...RECORD, __v: 0 }));
    expect(await getLastDebrief()).toStrictEqual({ ...RECORD, saved: true });
  });

  it("returns null when `at` is not a Date — throwing is worse than absence", async () => {
    findOne.mockImplementation(() => query({ ...RECORD, at: "2026-10-13" }));
    expect(await getLastDebrief()).toBeNull();
  });

  it("fills what .lean() leaves absent instead of handing back undefined", async () => {
    const symptom = { key: "site-status", sentence: "s", bold: [], nextStep: "n", causeKey: "fixed", cause: "c", causeBold: [], raw: null };
    findOne.mockImplementation(() => query({ at: AT, title: "T", stillNeedsYou: [symptom], new: [symptom] }));
    const d = await getLastDebrief();
    expect(d?.sorted).toEqual([]);
    expect(d?.stillNeedsYou[0]).toMatchObject({ subject: null, note: null });
    expect(d?.new[0].subject).toBeNull();
    expect(d?.baselineSentAt).toBeNull();
    expect(d?.couldntCheck).toEqual({ sites: false, watchdog: false, shikkstracker: false });
    expect(d?.unrecognised).toBe(0);
    expect(d?.freelance).toBeNull();
    expect(d?.since).toEqual([]);
  });

  it("reads the one singleton by _id and never upserts — a page view must not be a write (R37)", async () => {
    findOne.mockImplementation(() => query(null));
    await getLastDebrief();
    expect(findOne).toHaveBeenCalledWith({ _id: "latest" }, expect.any(Object));
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("saveLastDebrief", () => {
  it("overwrites the one singleton whole, with the schema's validators on", async () => {
    findOneAndUpdate.mockResolvedValue({});
    await saveLastDebrief(RECORD);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "latest" },
      { $set: RECORD },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
  });

  it("never writes the response-only `saved`, even when handed a StoredDebrief", async () => {
    findOneAndUpdate.mockResolvedValue({});
    await saveLastDebrief({ ...RECORD, saved: false } as DebriefRecord);
    expect(findOneAndUpdate.mock.calls[0][1]).toEqual({ $set: RECORD });
  });

  it("retries the identical write once when it loses the first-write race", async () => {
    findOneAndUpdate.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: 11000 })).mockResolvedValueOnce({});
    await saveLastDebrief(RECORD);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry — no infinite retry, and the caller is told", async () => {
    const dup = Object.assign(new Error("dup"), { code: 11000 });
    findOneAndUpdate.mockRejectedValue(dup);
    await expect(saveLastDebrief(RECORD)).rejects.toBe(dup);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it("propagates any other error without a retry", async () => {
    findOneAndUpdate.mockRejectedValue(new Error("validation failed"));
    await expect(saveLastDebrief(RECORD)).rejects.toThrow("validation failed");
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});
