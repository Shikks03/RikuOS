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
