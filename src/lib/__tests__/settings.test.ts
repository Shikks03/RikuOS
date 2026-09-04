import { describe, it, expect } from "vitest";
import {
  parseSettingsPatch,
  DEMO_URL_PACKAGE_KEY_MAX_LENGTH,
  DEMO_URL_MAX_LENGTH,
} from "@/lib/settings";

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

describe("parseSettingsPatch — editing the knowledge block and the approval stamp", () => {
  it("clears the approval stamp when the block is edited without an explicit stamp", () => {
    // The stamp means "Riku has read THIS text", not "Riku has read
    // something once". An ordinary block edit must not leave a stale
    // approval standing over text he has never seen.
    const result = parseSettingsPatch({ knowledgeBlock: "revised prices" });
    expect(result).toEqual({
      ok: true,
      value: { knowledgeBlock: "revised prices", knowledgeReviewedAt: null },
    });
  });

  it("keeps an explicit stamp supplied alongside the same edit", () => {
    const stamp = "2026-09-04T00:00:00.000Z";
    const result = parseSettingsPatch({
      knowledgeBlock: "revised prices",
      knowledgeReviewedAt: stamp,
    });
    expect(result).toEqual({
      ok: true,
      value: { knowledgeBlock: "revised prices", knowledgeReviewedAt: new Date(stamp) },
    });
  });
});

describe("parseSettingsPatch — knowledgeReviewedAt", () => {
  it("accepts explicit null (un-approve)", () => {
    expect(parseSettingsPatch({ knowledgeReviewedAt: null })).toEqual({
      ok: true,
      value: { knowledgeReviewedAt: null },
    });
  });

  it("accepts a valid date string", () => {
    const stamp = "2026-09-04T00:00:00.000Z";
    expect(parseSettingsPatch({ knowledgeReviewedAt: stamp })).toEqual({
      ok: true,
      value: { knowledgeReviewedAt: new Date(stamp) },
    });
  });

  it("rejects a garbage string", () => {
    expect(parseSettingsPatch({ knowledgeReviewedAt: "not a date" }).ok).toBe(false);
  });

  it("rejects a non-string, non-null value", () => {
    expect(parseSettingsPatch({ knowledgeReviewedAt: 12345 }).ok).toBe(false);
  });
});

describe("parseSettingsPatch — holdingText", () => {
  it("accepts a holding message and stores it trimmed", () => {
    expect(parseSettingsPatch({ holdingText: "  Hi there!  " })).toEqual({
      ok: true,
      value: { holdingText: "Hi there!" },
    });
  });

  it("rejects an empty string", () => {
    expect(parseSettingsPatch({ holdingText: "" }).ok).toBe(false);
  });

  it("rejects a whitespace-only string", () => {
    expect(parseSettingsPatch({ holdingText: "   " }).ok).toBe(false);
  });

  it("rejects text over the cap", () => {
    const result = parseSettingsPatch({ holdingText: "x".repeat(501) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/500/);
  });
});

describe("parseSettingsPatch — triageEnabled", () => {
  it("accepts true and false", () => {
    expect(parseSettingsPatch({ triageEnabled: true })).toEqual({
      ok: true,
      value: { triageEnabled: true },
    });
    expect(parseSettingsPatch({ triageEnabled: false })).toEqual({
      ok: true,
      value: { triageEnabled: false },
    });
  });

  it("rejects a non-boolean", () => {
    expect(parseSettingsPatch({ triageEnabled: "yes" }).ok).toBe(false);
  });
});

describe("parseSettingsPatch — demoSiteUrls bounds and transform", () => {
  it("transforms the object map into a packageKey/url array", () => {
    // The single most non-obvious behaviour in this file: accepted over the
    // wire as a map, stored as an array.
    expect(parseSettingsPatch({ demoSiteUrls: { A1: "https://a1.example" } })).toEqual({
      ok: true,
      value: { demoSiteUrls: [{ packageKey: "A1", url: "https://a1.example" }] },
    });
  });

  it("accepts exactly 20 entries and rejects 21", () => {
    const at20 = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`P${i}`, `https://example.com/${i}`])
    );
    expect(parseSettingsPatch({ demoSiteUrls: at20 }).ok).toBe(true);

    const at21 = Object.fromEntries(
      Array.from({ length: 21 }, (_, i) => [`P${i}`, `https://example.com/${i}`])
    );
    expect(parseSettingsPatch({ demoSiteUrls: at21 }).ok).toBe(false);
  });

  it("rejects a package key over the cap with a message naming the key's own limit", () => {
    const key = "x".repeat(DEMO_URL_PACKAGE_KEY_MAX_LENGTH + 1);
    const result = parseSettingsPatch({ demoSiteUrls: { [key]: "https://example.com" } });
    expect(result).toEqual({
      ok: false,
      error: `demoSiteUrls key "${key}" must be at most ${DEMO_URL_PACKAGE_KEY_MAX_LENGTH} characters.`,
    });
  });

  it("rejects a URL over the cap with a distinct message naming the url's own limit", () => {
    const longUrl = "https://example.com/" + "x".repeat(DEMO_URL_MAX_LENGTH);
    const result = parseSettingsPatch({ demoSiteUrls: { A1: longUrl } });
    expect(result).toEqual({
      ok: false,
      error: `demoSiteUrls.A1 must be at most ${DEMO_URL_MAX_LENGTH} characters.`,
    });
  });

  it("when a url is both over-length and non-http, the length error wins", () => {
    // Pins the check order in the source: length is checked before the
    // http(s) regex, so a value failing both never surfaces the scheme error.
    const longBadUrl = "javascript:" + "x".repeat(DEMO_URL_MAX_LENGTH);
    const result = parseSettingsPatch({ demoSiteUrls: { A1: longBadUrl } });
    expect(result).toEqual({
      ok: false,
      error: `demoSiteUrls.A1 must be at most ${DEMO_URL_MAX_LENGTH} characters.`,
    });
  });
});

describe("parseSettingsPatch — nameableProjects at the cap", () => {
  it("accepts exactly 20 entries", () => {
    const at20 = Array.from({ length: 20 }, (_, i) => `P${i}`);
    expect(parseSettingsPatch({ nameableProjects: at20 }).ok).toBe(true);
  });
});
