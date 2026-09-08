/**
 * The floor is a PURE FUNCTION rather than a branch inside the route handler,
 * so it is testable without a route, a database or a network — the same rule
 * the rest of the logic layer follows.
 *
 * It exists so a stuck finger cannot fire nine requests at client sites, not to
 * defend against abuse: there is exactly one user behind a session cookie.
 *
 * The two accessors below it are the same shape of test osSettings.test.ts
 * already writes, for the same reasons: the read must not write, it must
 * answer with the settled shape for anything the document does not carry, and
 * it must return the reading alone. Only the model is mocked — the filter, the
 * projection and the retry are this file's subject, so nothing may stub them.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CHECK_FLOOR_MS,
  isWithinCheckFloor,
  getHealthSnapshot,
  saveHealthSnapshot,
} from "@/lib/healthSnapshot";
import HealthSnapshot from "@/models/HealthSnapshot";

vi.mock("@/models/HealthSnapshot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/models/HealthSnapshot")>();
  return { ...actual, default: { findOne: vi.fn(), findOneAndUpdate: vi.fn() } };
});

const findOne = HealthSnapshot.findOne as unknown as ReturnType<typeof vi.fn>;
const findOneAndUpdate = HealthSnapshot.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>;

/** findOne(filter, projection).lean() — the exact chain getHealthSnapshot calls. */
function query(doc: unknown) {
  return { lean: async () => doc };
}

beforeEach(() => {
  findOne.mockReset();
  findOneAndUpdate.mockReset();
});

const NOW = new Date("2026-09-05T12:00:00.000Z");

function secondsAgo(s: number): Date {
  return new Date(NOW.getTime() - s * 1000);
}

describe("isWithinCheckFloor", () => {
  it("is sixty seconds", () => {
    expect(CHECK_FLOOR_MS).toBe(60_000);
  });

  it("holds a check made 59 seconds ago inside the floor", () => {
    expect(isWithinCheckFloor(NOW, secondsAgo(59))).toBe(true);
    expect(isWithinCheckFloor(NOW, secondsAgo(0))).toBe(true);
  });

  it("lets a check made exactly 60 seconds ago through", () => {
    expect(isWithinCheckFloor(NOW, secondsAgo(60))).toBe(false);
    expect(isWithinCheckFloor(NOW, secondsAgo(61))).toBe(false);
  });

  it("never holds a null snapshot inside the floor — nothing has ever been read", () => {
    expect(isWithinCheckFloor(NOW, null)).toBe(false);
  });

  it("lets a future checkedAt through rather than locking the button out", () => {
    // A clock skew must never make Check now permanently unusable.
    expect(isWithinCheckFloor(NOW, new Date(NOW.getTime() + 10 * 60_000))).toBe(false);
  });

  it("takes the floor as an argument so it is testable at other widths", () => {
    expect(isWithinCheckFloor(NOW, secondsAgo(5), 10_000)).toBe(true);
    expect(isWithinCheckFloor(NOW, secondsAgo(15), 10_000)).toBe(false);
  });
});

describe("getHealthSnapshot", () => {
  it("returns null when no reading has ever been written", async () => {
    findOne.mockImplementation(() => query(null));

    expect(await getHealthSnapshot()).toBeNull();
  });

  it("returns the reading and nothing else the document carries", async () => {
    findOne.mockImplementation(() =>
      query({
        _id: "singleton",
        checkedAt: new Date("2026-09-05T06:00:00.000Z"),
        sites: [{ name: "Meowchi", up: true, detail: "Meowchi ok", _id: "sub" }],
        createdAt: new Date("2026-09-01T06:00:00.000Z"),
        updatedAt: new Date("2026-09-05T06:00:00.000Z"),
        __v: 0,
      })
    );

    expect(await getHealthSnapshot()).toStrictEqual({
      checkedAt: new Date("2026-09-05T06:00:00.000Z"),
      sites: [{ name: "Meowchi", up: true, detail: "Meowchi ok" }],
    });
  });

  it("reads a document with no sites key as a reading that watched nothing", async () => {
    // .lean() applies no schema defaults, so a document written before the
    // array existed simply has no such key (R41). That is an empty reading,
    // not a broken one.
    findOne.mockImplementation(() => query({ checkedAt: new Date("2026-09-05T06:00:00.000Z") }));

    expect(await getHealthSnapshot()).toStrictEqual({
      checkedAt: new Date("2026-09-05T06:00:00.000Z"),
      sites: [],
    });
  });

  it("returns null rather than a reading whose checkedAt is not a Date", async () => {
    // buildHealthStrip calls .getTime() on this field outside the page's try,
    // so an unusable stamp must become `sites never checked`, never a throw.
    findOne.mockImplementation(() => query({ sites: [] }));
    expect(await getHealthSnapshot()).toBeNull();

    findOne.mockImplementation(() => query({ checkedAt: "2026-09-05T06:00:00.000Z", sites: [] }));
    expect(await getHealthSnapshot()).toBeNull();
  });

  it("reads the one singleton by _id, through the typed projection", async () => {
    findOne.mockImplementation(() => query(null));

    await getHealthSnapshot();

    expect(findOne).toHaveBeenCalledWith({ _id: "singleton" }, { checkedAt: 1, sites: 1, _id: 0 });
  });

  it("never upserts — a page view must not be a write (R47)", async () => {
    findOne.mockImplementation(() => query(null));

    await getHealthSnapshot();

    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("saveHealthSnapshot", () => {
  const CHECKED_AT = new Date("2026-09-05T11:59:00.000Z");
  const SITES = [{ name: "Meowchi", up: true, detail: "Meowchi ok" }];

  it("upserts the one singleton with the schema's validators on", async () => {
    findOneAndUpdate.mockResolvedValue(null);

    await saveHealthSnapshot(CHECKED_AT, SITES);

    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update, options] = findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: "singleton" });
    expect(update).toEqual({ $set: { checkedAt: CHECKED_AT, sites: SITES } });
    expect(options).toMatchObject({
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    });
  });

  it("retries the identical write once when it loses the first-write race", async () => {
    // Two Check now presses can both find no document and both upsert; Mongo
    // answers the loser with a duplicate key on _id. By then the winner's
    // document exists, so the same call is a plain update (R55).
    findOneAndUpdate
      .mockRejectedValueOnce(Object.assign(new Error("E11000 duplicate key"), { code: 11000 }))
      .mockResolvedValueOnce(null);

    await expect(saveHealthSnapshot(CHECKED_AT, SITES)).resolves.toBeUndefined();

    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(findOneAndUpdate.mock.calls[1]).toEqual(findOneAndUpdate.mock.calls[0]);
  });

  it("gives up after one retry — no infinite retry, and the caller is told", async () => {
    findOneAndUpdate.mockRejectedValue(
      Object.assign(new Error("E11000 duplicate key"), { code: 11000 })
    );

    await expect(saveHealthSnapshot(CHECKED_AT, SITES)).rejects.toThrow(/E11000/);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it("propagates any other error without a retry", async () => {
    findOneAndUpdate.mockRejectedValue(new Error("boom"));

    await expect(saveHealthSnapshot(CHECKED_AT, SITES)).rejects.toThrow("boom");
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});
