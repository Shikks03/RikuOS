/**
 * Covers readOsSettings, the accessor the rail uses on every page of the (app)
 * group. Three things about it are load-bearing and none of them is visible
 * from a caller: it must not write (getOsSettings() next door does, on every
 * call), it must answer with the schema defaults for any value the document
 * does not carry — including when there is no document yet, and without
 * swallowing a stored falsy value — and it must return the settings alone, or
 * a projection widened by accident starts handing _id and updatedAt to render
 * code.
 *
 * Only the model is mocked; OS_SETTINGS_DEFAULTS is the real constant, so the
 * fallback is pinned to the same values the schema creates.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readOsSettings } from "@/lib/osSettings";
import OsSettings, { OS_SETTINGS_DEFAULTS } from "@/models/OsSettings";
import { PERSONAL_LAYOUT_DEFAULT } from "@/lib/personalLayout";

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
      layers: [],
      personalLayout: PERSONAL_LAYOUT_DEFAULT,
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
      layers: [],
      personalLayout: PERSONAL_LAYOUT_DEFAULT,
    });
  });

  it("keeps a stored value that is falsy rather than substituting the default", async () => {
    // `min: 1` means a 0 cannot be written through the schema today — which is
    // the point: a document written before that bound existed is exactly the
    // drift R41 guards against, and a stored 0 is the only value under today's
    // defaults that can tell `??` from `||`.
    findOne.mockImplementation(() =>
      query({ chaserEnabled: false, chaserNDays: 0, monitoringEnabled: false })
    );

    expect(await readOsSettings()).toStrictEqual({
      chaserEnabled: false,
      chaserNDays: 0,
      monitoringEnabled: false,
      layers: [],
      personalLayout: PERSONAL_LAYOUT_DEFAULT,
    });
  });

  it("never upserts — a page view must not stamp updatedAt with the view time", async () => {
    findOne.mockImplementation(() => query(null));

    await readOsSettings();

    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("readOsSettings — layers and personalLayout (P10b)", () => {
  const STORED_LAYOUT = [
    [{ tile: "week", span: 12 }],
    [{ tile: "today", span: 6 }, { tile: "todos", span: 6 }],
    [{ tile: "layers", span: 4 }, { tile: "push", span: 8 }],
    [{ tile: "done", span: 12 }],
  ];

  it("defaults both new fields when the document predates them", async () => {
    findOne.mockImplementation(() => query({ chaserEnabled: true }));

    const values = await readOsSettings();

    expect(values.layers).toEqual([]);
    expect(values.personalLayout).toEqual(PERSONAL_LAYOUT_DEFAULT);
  });

  it("returns stored layers and layout as stored, keeping an enabled: false", async () => {
    const layers = [
      { calendarId: "primary", name: "Me", enabled: true },
      { calendarId: "abc@group.calendar.google.com", name: "School", enabled: false },
    ];
    findOne.mockImplementation(() => query({ layers, personalLayout: STORED_LAYOUT }));

    const values = await readOsSettings();

    expect(values.layers).toStrictEqual(layers);
    expect(values.layers[1].enabled).toBe(false);
    expect(values.personalLayout).toStrictEqual(STORED_LAYOUT);
  });

  it("hands out copies of the defaults: mutating a result cannot rewrite the next read", async () => {
    findOne.mockImplementation(() => query(null));
    const pristine = structuredClone(PERSONAL_LAYOUT_DEFAULT);

    const first = await readOsSettings();
    expect(first.personalLayout).not.toBe(PERSONAL_LAYOUT_DEFAULT);
    expect(first.personalLayout[0]).not.toBe(PERSONAL_LAYOUT_DEFAULT[0]);
    expect(first.personalLayout[0][0]).not.toBe(PERSONAL_LAYOUT_DEFAULT[0][0]);
    expect(first.layers).not.toBe(OS_SETTINGS_DEFAULTS.layers);

    // Mutate at every depth: an entry, a row, the array itself.
    first.personalLayout[0][0].span = 2;
    first.personalLayout[1].push({ tile: "done", span: 2 });
    first.personalLayout.pop();
    first.layers.push({ calendarId: "x", name: "x", enabled: true });

    const second = await readOsSettings();
    expect(second.personalLayout).toStrictEqual(pristine);
    expect(second.layers).toEqual([]);
    expect(PERSONAL_LAYOUT_DEFAULT).toStrictEqual(pristine);
    expect(OS_SETTINGS_DEFAULTS.layers).toEqual([]);
  });

  it("projects both new fields and still never upserts", async () => {
    findOne.mockImplementation(() => query(null));

    await readOsSettings();

    expect(findOne.mock.calls[0][1]).toMatchObject({ layers: 1, personalLayout: 1, _id: 0 });
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
});
