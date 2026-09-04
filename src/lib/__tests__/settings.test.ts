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

describe("parseSettingsPatch — triage settings", () => {
  it("accepts a knowledge block at the cap", () => {
    const result = parseSettingsPatch({ knowledgeBlock: "x".repeat(4000) });
    expect(result.ok).toBe(true);
  });

  it("rejects a knowledge block over the cap", () => {
    // The block enters EVERY draft's prompt, so length is a per-message cost,
    // not a storage concern. The cap is a budget, not a formality.
    const result = parseSettingsPatch({ knowledgeBlock: "x".repeat(4001) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/4000/);
  });

  it("accepts a nameable project list and rejects a non-array", () => {
    expect(parseSettingsPatch({ nameableProjects: ["Azerotech"] }).ok).toBe(true);
    expect(parseSettingsPatch({ nameableProjects: "Azerotech" }).ok).toBe(false);
  });

  it("rejects more nameable projects than the cap allows", () => {
    const many = Array.from({ length: 21 }, (_, i) => `P${i}`);
    expect(parseSettingsPatch({ nameableProjects: many }).ok).toBe(false);
  });

  it("accepts demo site urls as a flat string map and rejects nesting", () => {
    expect(parseSettingsPatch({ demoSiteUrls: { A1: "https://a1.example" } }).ok).toBe(true);
    expect(parseSettingsPatch({ demoSiteUrls: { A1: { url: "x" } } }).ok).toBe(false);
  });

  it("rejects a demo url that is not http(s)", () => {
    // A javascript: or data: URL pasted into a client-facing message is the
    // kind of thing that only gets noticed after it is sent.
    expect(parseSettingsPatch({ demoSiteUrls: { A1: "javascript:alert(1)" } }).ok).toBe(false);
  });

  it("still rejects unknown keys", () => {
    expect(parseSettingsPatch({ triageEnable: true }).ok).toBe(false);
  });
});
