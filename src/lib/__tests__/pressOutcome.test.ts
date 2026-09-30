/**
 * pressOutcome.test.ts — L7's one rule: only the door's own JSON is a definite
 * outcome; everything else is `Couldn’t tell if that saved.` and never a
 * claimed failure.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pressOutcome } from "@/lib/pressOutcome";
import { PRESS_TIMEOUT_MS } from "@/lib/constants";
import { GOOGLE_TIMEOUT_MS } from "@/lib/google";

const UNKNOWN = { kind: "unknown", sentence: "Couldn’t tell if that saved." };
const json = (body: unknown, status: number) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

describe("pressOutcome — the door answered", () => {
  it("a 2xx with JSON is ok and hands the body back", async () => {
    expect(await pressOutcome(json({ settings: { layers: [] } }, 200))).toEqual({
      kind: "ok",
      body: { settings: { layers: [] } },
    });
  });

  it("a door code maps through ERROR_SENTENCES", async () => {
    expect(await pressOutcome(json({ error: "save-failed" }, 500))).toEqual({
      kind: "failed",
      code: "save-failed",
      sentence: "Couldn’t save.",
      body: { error: "save-failed" },
    });
    expect(await pressOutcome(json({ error: "Could not save.", code: "save-failed" }, 500))).toEqual({
      kind: "failed",
      code: "save-failed",
      sentence: "Couldn’t save.",
      body: { error: "Could not save.", code: "save-failed" },
    });
    expect(await pressOutcome(json({ error: "no-title" }, 400))).toEqual({
      kind: "failed",
      code: "no-title",
      sentence: "Give it a title.",
      body: { error: "no-title" },
    });
  });

  it("the settings 400's sentence body and the proxy's 401 are definite failures, code null", async () => {
    expect(await pressOutcome(json({ error: "Unauthorized" }, 401))).toEqual({
      kind: "failed",
      code: null,
      sentence: "Couldn’t save.",
      body: { error: "Unauthorized" },
    });
    expect(await pressOutcome(json({ error: "At most 10 layers can be chosen." }, 400))).toEqual({
      kind: "failed",
      code: null,
      sentence: "Couldn’t save.",
      body: { error: "At most 10 layers can be chosen." },
    });
  });

  it("a code with no sentence reads as the caller's fallback", async () => {
    expect(await pressOutcome(json({ error: "bad-json" }, 400))).toEqual({
      kind: "failed",
      code: "bad-json",
      sentence: "Couldn’t save.",
      body: { error: "bad-json" },
    });
    expect(await pressOutcome(json({ error: "not-found" }, 404), "delete-failed")).toEqual({
      kind: "failed",
      code: "not-found",
      sentence: "Couldn’t delete.",
      body: { error: "not-found" },
    });
  });

  it("a refusal keeps the door's body, so the event door's reason survives", async () => {
    const refused = { error: "calendar-failed", calendar: { kind: "failed", cause: "refused", orphaned: false } };
    const out = await pressOutcome(json(refused, 502));
    expect(out).toEqual({ kind: "failed", code: "calendar-failed", sentence: "Couldn’t save.", body: refused });
    expect(out.kind === "failed" && (out.body as typeof refused).calendar.cause).toBe("refused");
  });

  it("the door's own calendar-unknown stays unknown", async () => {
    expect(await pressOutcome(json({ error: "calendar-unknown" }, 504))).toEqual(UNKNOWN);
    expect(await pressOutcome(json({ error: "x", code: "calendar-unknown" }, 504))).toEqual(UNKNOWN);
  });
});

describe("pressOutcome — no answer from the door is never a failure", () => {
  it("a timeout, an abort or a network rejection", async () => {
    expect(await pressOutcome(Promise.reject(new DOMException("t", "TimeoutError")))).toEqual(UNKNOWN);
    expect(await pressOutcome(Promise.reject(new DOMException("a", "AbortError")))).toEqual(UNKNOWN);
    expect(await pressOutcome(Promise.reject(new TypeError("Failed to fetch")))).toEqual(UNKNOWN);
  });

  it("a platform 502/504 HTML page", async () => {
    const html = Promise.resolve(new Response("<html>Gateway Timeout</html>", { status: 504 }));
    expect(await pressOutcome(html)).toEqual(UNKNOWN);
  });

  it("an unparseable, empty or foreign-shaped body", async () => {
    expect(await pressOutcome(Promise.resolve(new Response("{not json", { status: 500 })))).toEqual(UNKNOWN);
    expect(await pressOutcome(Promise.resolve(new Response("", { status: 500 })))).toEqual(UNKNOWN);
    expect(await pressOutcome(Promise.resolve(new Response(null, { status: 200 })))).toEqual(UNKNOWN);
    expect(await pressOutcome(json(["x"], 500))).toEqual(UNKNOWN);
    expect(await pressOutcome(json({ message: "x" }, 500))).toEqual(UNKNOWN);
  });

  it("a 2xx that is not JSON (not the door's answer)", async () => {
    expect(await pressOutcome(Promise.resolve(new Response("<html>login</html>", { status: 200 })))).toEqual(UNKNOWN);
  });

  it("a body that fails while streaming", async () => {
    const res = new Response("x", { status: 200 });
    Object.defineProperty(res, "text", { value: () => Promise.reject(new DOMException("t", "TimeoutError")) });
    expect(await pressOutcome(Promise.resolve(res))).toEqual(UNKNOWN);
  });
});

describe("pressOutcome — client-safe and bounded", () => {
  it("imports nothing at runtime but personalErrors", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/pressOutcome.ts"), "utf8");
    const froms = source.split(/\r?\n/).filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l));
    for (const line of froms) expect(line).toMatch(/from "@\/lib\/personalErrors";$/);
    expect(source).not.toMatch(/^\s*import\s+["']/m);
    expect(source).not.toMatch(/\brequire\(|\bimport\(/);
  });

  it("PRESS_TIMEOUT_MS clears the heaviest door's Google + connect budget (≈ 50 s)", () => {
    const connect = 10_000; // db.ts serverSelectionTimeoutMS
    const pinWithCompensation = 2 * 4 * GOOGLE_TIMEOUT_MS; // insert + delete, each token+call and one 401 retry
    expect(PRESS_TIMEOUT_MS).toBeGreaterThan(connect + pinWithCompensation);
  });
});
