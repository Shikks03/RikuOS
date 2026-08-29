import { describe, it, expect, vi, afterEach } from "vitest";
import { checkSite, checkSites, classifyError, classifyStatus, SITES } from "@/lib/siteHealth";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("classifyStatus", () => {
  it("treats 2xx as up", () => {
    expect(classifyStatus("Meowchi", 200)).toEqual({
      name: "Meowchi",
      up: true,
      detail: "Meowchi ok",
    });
  });

  it("treats 4xx and 5xx as down, naming the status", () => {
    expect(classifyStatus("Meowchi", 404).up).toBe(false);
    expect(classifyStatus("Meowchi", 503).detail).toContain("503");
  });
});

describe("classifyError", () => {
  it("names a timeout as such", () => {
    const result = classifyError("AzeroTech", new Error("The operation was aborted due to timeout"));
    expect(result.up).toBe(false);
    expect(result.detail).toContain("timed out");
  });

  it("reports anything else as unreachable", () => {
    const result = classifyError("AzeroTech", new Error("getaddrinfo ENOTFOUND"));
    expect(result.up).toBe(false);
    expect(result.detail).toContain("unreachable");
  });
});

describe("checkSite", () => {
  it("reports a reachable site as up", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200 }));
    const result = await checkSite({ name: "Meowchi", url: "https://example.test" });
    expect(result.up).toBe(true);
  });

  it("turns a rejected fetch into a finding rather than throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("socket hang up")));
    const result = await checkSite({ name: "Meowchi", url: "https://example.test" });
    expect(result.up).toBe(false);
    expect(result.detail).toContain("unreachable");
  });
});

describe("checkSites", () => {
  it("checks every site and keeps going when one is down", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 200 })
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce({ status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const results = await checkSites();

    expect(results).toHaveLength(SITES.length);
    expect(results.filter((r) => !r.up)).toHaveLength(1);
  });
});

describe("SITES", () => {
  it("watches the three agreed hosts over https", () => {
    expect(SITES).toHaveLength(3);
    for (const site of SITES) {
      expect(site.url.startsWith("https://")).toBe(true);
    }
  });
});
