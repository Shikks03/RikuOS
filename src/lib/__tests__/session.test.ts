/**
 * Unit tests for src/lib/session.ts (ported from ShikksTracker).
 *
 * Covers: v2 token round-trip, rejection of the old 2-part format (the
 * regression guard for the "HMAC keyed by the raw password" vulnerability),
 * tamper detection (MAC + expiry), expiry, cross-secret rejection,
 * malformed-input shapes, and assertSessionSecret's fail-closed behavior.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createSessionToken,
  verifySessionToken,
  assertSessionSecret,
} from "@/lib/session";
import { requireForwardSecret } from "@/lib/auth";

const SECRET_A = "a".repeat(32);
const SECRET_B = "b".repeat(32);

describe("createSessionToken / verifySessionToken", () => {
  it("round-trips: a token created with secret S verifies true with S", async () => {
    const token = await createSessionToken(SECRET_A);
    expect(await verifySessionToken(token, SECRET_A)).toBe(true);
  });

  it("produces the v2.<jti>.<issuedAt>.<expiresAt>.<hmac> shape", async () => {
    const token = await createSessionToken(SECRET_A);
    const parts = token.split(".");
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe("v2");
    expect(parts[1].length).toBeGreaterThan(0); // jti (uuid)
    expect(Number.isFinite(parseInt(parts[2], 10))).toBe(true); // issuedAt
    expect(Number.isFinite(parseInt(parts[3], 10))).toBe(true); // expiresAt
    expect(parts[4]).toMatch(/^[0-9a-f]{64}$/); // hex-encoded SHA-256 HMAC
  });

  it("rejects the old 2-part format '<expiresAtMs>.<hex-hmac>' outright", async () => {
    const farFuture = Date.now() + 1000 * 60 * 60 * 24 * 30;
    const oldStyleToken = `${farFuture}.${"a".repeat(64)}`;
    expect(await verifySessionToken(oldStyleToken, SECRET_A)).toBe(false);
  });

  it("rejects a token with a tampered HMAC", async () => {
    const token = await createSessionToken(SECRET_A);
    const parts = token.split(".");
    const tamperedHex =
      parts[4].slice(0, -1) + (parts[4].slice(-1) === "0" ? "1" : "0");
    const tampered = [...parts.slice(0, 4), tamperedHex].join(".");
    expect(await verifySessionToken(tampered, SECRET_A)).toBe(false);
  });

  it("rejects a token with a tampered expiry (prefix changed, MAC stale)", async () => {
    const token = await createSessionToken(SECRET_A);
    const parts = token.split(".");
    const bumpedExpiry = String(parseInt(parts[3], 10) + 1000 * 60 * 60 * 24 * 365);
    const tampered = [parts[0], parts[1], parts[2], bumpedExpiry, parts[4]].join(".");
    expect(await verifySessionToken(tampered, SECRET_A)).toBe(false);
  });

  it("rejects an expired token", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2020-01-01T00:00:00Z"));
      const token = await createSessionToken(SECRET_A);

      vi.setSystemTime(new Date("2020-01-15T00:00:00Z")); // 14 days later, past the 7-day max age
      expect(await verifySessionToken(token, SECRET_A)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(SECRET_A);
    expect(await verifySessionToken(token, SECRET_B)).toBe(false);
  });

  describe("malformed inputs", () => {
    it.each([
      ["empty string", ""],
      ["one part", "v2"],
      ["four parts", "v2.jti.123.456"],
      ["six parts", "v2.jti.123.456.abc.def"],
      ["wrong version", "v1.jti.123.456." + "a".repeat(64)],
      ["empty jti", "v2..123.456." + "a".repeat(64)],
      ["non-numeric issuedAt", "v2.jti.abc.456." + "a".repeat(64)],
      ["non-numeric expiresAt", "v2.jti.123.xyz." + "a".repeat(64)],
    ])("rejects %s", async (_label, token) => {
      expect(await verifySessionToken(token, SECRET_A)).toBe(false);
    });
  });
});

describe("assertSessionSecret", () => {
  const ORIGINAL = process.env.SESSION_SECRET;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = ORIGINAL;
  });

  it("throws when SESSION_SECRET is unset", () => {
    delete process.env.SESSION_SECRET;
    expect(() => assertSessionSecret()).toThrow(/not set/);
  });

  it("throws when SESSION_SECRET is shorter than 32 chars", () => {
    process.env.SESSION_SECRET = "short";
    expect(() => assertSessionSecret()).toThrow(/too short/);
  });

  it("returns the secret when valid", () => {
    process.env.SESSION_SECRET = "s".repeat(32);
    expect(assertSessionSecret()).toBe("s".repeat(32));
  });
});

describe("requireForwardSecret", () => {
  const ORIGINAL = process.env.MESSENGER_FORWARD_SECRET;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.MESSENGER_FORWARD_SECRET;
    else process.env.MESSENGER_FORWARD_SECRET = ORIGINAL;
  });

  const req = (headers: Record<string, string>) =>
    new NextRequest("https://x.test/api/messenger/inbound", { method: "POST", headers });

  it("fails closed with 500 when the secret is not configured", () => {
    delete process.env.MESSENGER_FORWARD_SECRET;
    const res = requireForwardSecret(req({ "x-forward-secret": "anything" }));
    expect(res?.status).toBe(500);
  });

  it("rejects a wrong secret with 401", () => {
    process.env.MESSENGER_FORWARD_SECRET = "a".repeat(32);
    expect(requireForwardSecret(req({ "x-forward-secret": "b".repeat(32) }))?.status).toBe(401);
  });

  it("accepts the right secret", () => {
    process.env.MESSENGER_FORWARD_SECRET = "a".repeat(32);
    expect(requireForwardSecret(req({ "x-forward-secret": "a".repeat(32) }))).toBeNull();
  });

  it("rejects a missing header without throwing", () => {
    process.env.MESSENGER_FORWARD_SECRET = "a".repeat(32);
    expect(requireForwardSecret(req({}))?.status).toBe(401);
  });
});
