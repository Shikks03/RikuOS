/**
 * Covers readOsSettings, the accessor the rail uses on every page of the (app)
 * group. Three things about it are load-bearing and none of them is visible
 * from a caller: it must not write (getOsSettings() next door does, on every
 * call), it must answer with the schema defaults before the singleton exists,
 * and it must return the settings alone — a projection widened by accident
 * would otherwise start handing _id and updatedAt to render code.
 *
 * Only the model is mocked; OS_SETTINGS_DEFAULTS is the real constant, so the
 * fallback is pinned to the same values the schema creates.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readOsSettings } from "@/lib/osSettings";
import OsSettings, { OS_SETTINGS_DEFAULTS } from "@/models/OsSettings";

vi.mock("@/models/OsSettings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/models/OsSettings")>();
  return { ...actual, default: { findOne: vi.fn(), findOneAndUpdate: vi.fn() } };
});

const findOne = OsSettings.findOne as unknown as ReturnType<typeof vi.fn>;
const findOneAndUpdate = OsSettings.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>;

/** findOne(filter, projection).lean() — the exact chain readOsSettings calls. */
function query(doc: unknown) {
  return { lean: async () => doc };
}

beforeEach(() => {
  findOne.mockReset();
  findOneAndUpdate.mockReset();
});

describe("readOsSettings", () => {
  it("falls back to the schema defaults when the singleton does not exist yet", async () => {
    findOne.mockImplementation(() => query(null));

    const values = await readOsSettings();

    expect(values).toEqual(OS_SETTINGS_DEFAULTS);
    // A copy, not the constant: a caller mutating its result must not rewrite
    // the defaults for the rest of the process.
    expect(values).not.toBe(OS_SETTINGS_DEFAULTS);
  });

  it("returns the three settings and nothing else the document carries", async () => {
    findOne.mockImplementation(() =>
      query({
        _id: "68bd0f0e0f0e0f0e0f0e0f0e",
        chaserEnabled: true,
        chaserNDays: 7,
        monitoringEnabled: true,
        updatedAt: new Date("2026-09-07T06:00:00.000Z"),
        __v: 0,
      })
    );

    expect(await readOsSettings()).toStrictEqual({
      chaserEnabled: true,
      chaserNDays: 7,
      monitoringEnabled: true,
    });
  });

  it("reads a field the document does not carry as its default, never as undefined", async () => {
    // .lean() applies no schema defaults, so a singleton written before a
    // toggle existed simply has no such key. Reading that as `off` would be
    // the inference from absence the rail exists to refuse.
    findOne.mockImplementation(() => query({ chaserEnabled: true }));

    expect(await readOsSettings()).toStrictEqual({
      chaserEnabled: true,
      chaserNDays: OS_SETTINGS_DEFAULTS.chaserNDays,
      monitoringEnabled: OS_SETTINGS_DEFAULTS.monitoringEnabled,
    });
  });

  it("never upserts — a page view must not stamp updatedAt with the view time", async () => {
    findOne.mockImplementation(() => query(null));

    await readOsSettings();

    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
});
