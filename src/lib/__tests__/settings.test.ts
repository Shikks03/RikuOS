import { describe, it, expect } from "vitest";
import { parseSettingsPatch } from "@/lib/settings";

describe("parseSettingsPatch", () => {
  it("accepts a boolean toggle", () => {
    expect(parseSettingsPatch({ chaserEnabled: true })).toEqual({
      ok: true,
      value: { chaserEnabled: true },
    });
  });

  it("accepts a threshold inside the schema range", () => {
    expect(parseSettingsPatch({ chaserNDays: 4 })).toEqual({
      ok: true,
      value: { chaserNDays: 4 },
    });
  });

  it("accepts both together", () => {
    const out = parseSettingsPatch({ chaserEnabled: false, chaserNDays: 30 });
    expect(out).toEqual({ ok: true, value: { chaserEnabled: false, chaserNDays: 30 } });
  });

  it.each([0, 31, -1, 2.5, Number.NaN])("rejects chaserNDays %s", (n) => {
    expect(parseSettingsPatch({ chaserNDays: n }).ok).toBe(false);
  });

  it("rejects a non-boolean toggle", () => {
    expect(parseSettingsPatch({ chaserEnabled: "yes" }).ok).toBe(false);
  });

  it("rejects an empty patch — a no-op PATCH is a typo, not an intention", () => {
    expect(parseSettingsPatch({}).ok).toBe(false);
  });

  it("rejects unknown keys so a typo cannot silently do nothing", () => {
    expect(parseSettingsPatch({ chaserEnable: true }).ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseSettingsPatch(null).ok).toBe(false);
    expect(parseSettingsPatch("chaserEnabled=true").ok).toBe(false);
  });
});

describe("parseSettingsPatch — monitoringEnabled", () => {
  it("accepts a boolean", () => {
    const result = parseSettingsPatch({ monitoringEnabled: true });
    expect(result).toEqual({ ok: true, value: { monitoringEnabled: true } });
  });

  it("rejects a non-boolean", () => {
    const result = parseSettingsPatch({ monitoringEnabled: "yes" });
    expect(result.ok).toBe(false);
  });

  it("still rejects unknown keys", () => {
    const result = parseSettingsPatch({ monitoringEnable: true });
    expect(result.ok).toBe(false);
  });
});

describe("parseSettingsPatch — personalLayout (P10b)", () => {
  const good = () => [
    [{ tile: "today", span: 8 }, { tile: "todos", span: 4 }],
    [{ tile: "layers", span: 3 }, { tile: "push", span: 8 }],
    [{ tile: "week", span: 12 }],
    [{ tile: "done", span: 12 }],
  ];

  it("accepts a valid layout", () => {
    expect(parseSettingsPatch({ personalLayout: good() })).toEqual({
      ok: true,
      value: { personalLayout: good() },
    });
  });

  it("returns validateLayout's message verbatim for three rows", () => {
    expect(parseSettingsPatch({ personalLayout: good().slice(0, 3) })).toEqual({
      ok: false,
      error: "A layout has exactly 4 rows.",
    });
  });

  it("rejects a missing tile, a span of 13 and an unknown tile", () => {
    const missing = good();
    missing[3] = [];
    expect(parseSettingsPatch({ personalLayout: missing }).ok).toBe(false);
    const wide = good();
    wide[2][0].span = 13;
    expect(parseSettingsPatch({ personalLayout: wide }).ok).toBe(false);
    const alien = good();
    alien[3][0].tile = "weather";
    expect(parseSettingsPatch({ personalLayout: alien }).ok).toBe(false);
  });
});

describe("parseSettingsPatch — layers (P10b)", () => {
  const layer = (i: number, over: Record<string, unknown> = {}) => ({
    calendarId: `cal-${i}`,
    name: `Layer ${i}`,
    enabled: true,
    ...over,
  });

  it("accepts ten layers in order, and an empty list", () => {
    const ten = Array.from({ length: 10 }, (_, i) => layer(i));
    expect(parseSettingsPatch({ layers: ten })).toEqual({ ok: true, value: { layers: ten } });
    expect(parseSettingsPatch({ layers: [] })).toEqual({ ok: true, value: { layers: [] } });
  });

  it("keeps enabled: false", () => {
    const out = parseSettingsPatch({ layers: [layer(1, { enabled: false })] });
    expect(out).toEqual({ ok: true, value: { layers: [layer(1, { enabled: false })] } });
  });

  it("rejects an eleventh layer", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => layer(i));
    expect(parseSettingsPatch({ layers: eleven }).ok).toBe(false);
  });

  it("rejects a duplicate calendarId", () => {
    expect(parseSettingsPatch({ layers: [layer(1), layer(2, { calendarId: "cal-1" })] }).ok).toBe(false);
  });

  it("rejects an unknown field on a layer", () => {
    expect(parseSettingsPatch({ layers: [layer(1, { color: "red" })] }).ok).toBe(false);
  });

  it.each([
    ["an empty calendarId", { calendarId: "" }],
    ["a 257-char calendarId", { calendarId: "c".repeat(257) }],
    ["an empty name", { name: "" }],
    ["a 121-char name", { name: "n".repeat(121) }],
    ["a non-boolean enabled", { enabled: "yes" }],
  ])("rejects a layer with %s", (_label, over) => {
    expect(parseSettingsPatch({ layers: [layer(1, over)] }).ok).toBe(false);
  });

  it("rejects a layer missing enabled", () => {
    expect(parseSettingsPatch({ layers: [{ calendarId: "primary", name: "Me" }] }).ok).toBe(false);
  });

  it("rejects a non-list and a non-object entry", () => {
    expect(parseSettingsPatch({ layers: { calendarId: "x" } }).ok).toBe(false);
    expect(parseSettingsPatch({ layers: ["primary"] }).ok).toBe(false);
  });

  it("accepts a layer at exactly the bounds", () => {
    const edge = layer(1, { calendarId: "c".repeat(256), name: "n".repeat(120) });
    expect(parseSettingsPatch({ layers: [edge] }).ok).toBe(true);
  });
});
