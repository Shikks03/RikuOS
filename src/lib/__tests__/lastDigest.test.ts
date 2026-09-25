/**
 * LastDigest is R55's singleton — HealthSnapshot's pattern, not OsSettings' —
 * so this file holds the same three properties healthSnapshot.test.ts holds:
 * the read never writes, an absent document reads as null rather than as
 * defaults (a push that was never stored is a fact the tile reports), and the
 * write retries the first-write race exactly once. Only the model is mocked;
 * the filter, the projection and the retry are this file's subject.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLastDigest, saveLastDigest } from "@/lib/lastDigest";
import LastDigest from "@/models/LastDigest";

vi.mock("@/models/LastDigest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/models/LastDigest")>();
  return { ...actual, default: { findOne: vi.fn(), findOneAndUpdate: vi.fn() } };
});

const findOne = LastDigest.findOne as unknown as ReturnType<typeof vi.fn>;
const findOneAndUpdate = LastDigest.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>;

/** findOne(filter, projection).lean() — the exact chain getLastDigest calls. */
function query(doc: unknown) {
  return { lean: async () => doc };
}

beforeEach(() => {
  findOne.mockReset();
  findOneAndUpdate.mockReset();
});

const SENT_AT = new Date("2026-09-10T23:00:04.000Z");
const PAYLOAD = { title: "Morning: 2 to look at", body: "Today: dentist 10:00.", url: "/" };

describe("getLastDigest", () => {
  it("returns null when no push has ever been stored — never the schema's defaults", async () => {
    findOne.mockImplementation(() => query(null));
    expect(await getLastDigest()).toBeNull();
  });

  it("returns the stored push and nothing else the document carries", async () => {
    findOne.mockImplementation(() =>
      query({ _id: "latest", sentAt: SENT_AT, title: "T", body: "B", devices: 2, __v: 0 })
    );

    expect(await getLastDigest()).toStrictEqual({
      sentAt: SENT_AT,
      title: "T",
      body: "B",
      devices: 2,
    });
  });

  it("returns null rather than a push whose sentAt is not a Date", async () => {
    // The tile renders sentAt as its stamp; an unusable one must become
    // `No push recorded yet.`, never a throw.
    findOne.mockImplementation(() => query({ title: "T", body: "B", devices: 1 }));
    expect(await getLastDigest()).toBeNull();

    findOne.mockImplementation(() =>
      query({ sentAt: "2026-09-10T23:00:04.000Z", title: "T", body: "B", devices: 1 })
    );
    expect(await getLastDigest()).toBeNull();
  });

  it("reads the one singleton by its fixed _id, through the typed projection", async () => {
    findOne.mockImplementation(() => query(null));

    await getLastDigest();

    expect(findOne).toHaveBeenCalledWith(
      { _id: "latest" },
      { sentAt: 1, title: 1, body: 1, devices: 1, _id: 0 }
    );
  });

  it("never upserts — a page view must not be a write (R37)", async () => {
    findOne.mockImplementation(() => query(null));

    await getLastDigest();

    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("saveLastDigest", () => {
  it("overwrites the one singleton whole, with the schema's validators on", async () => {
    findOneAndUpdate.mockResolvedValue(null);

    await saveLastDigest(SENT_AT, PAYLOAD, 2);

    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update, options] = findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: "latest" });
    // The url is where a tap goes, not what was said — it is not stored.
    expect(update).toEqual({
      $set: { sentAt: SENT_AT, title: PAYLOAD.title, body: PAYLOAD.body, devices: 2 },
    });
    expect(options).toMatchObject({ upsert: true, runValidators: true });
  });

  it("retries the identical write once when it loses the first-write race", async () => {
    findOneAndUpdate
      .mockRejectedValueOnce(Object.assign(new Error("E11000 duplicate key"), { code: 11000 }))
      .mockResolvedValueOnce(null);

    await expect(saveLastDigest(SENT_AT, PAYLOAD, 2)).resolves.toBeUndefined();

    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(findOneAndUpdate.mock.calls[1]).toEqual(findOneAndUpdate.mock.calls[0]);
  });

  it("gives up after one retry and throws — the caller is the one that wraps it", async () => {
    findOneAndUpdate.mockRejectedValue(
      Object.assign(new Error("E11000 duplicate key"), { code: 11000 })
    );

    await expect(saveLastDigest(SENT_AT, PAYLOAD, 2)).rejects.toThrow(/E11000/);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it("propagates any other error without a retry", async () => {
    findOneAndUpdate.mockRejectedValue(new Error("boom"));

    await expect(saveLastDigest(SENT_AT, PAYLOAD, 2)).rejects.toThrow("boom");
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});
