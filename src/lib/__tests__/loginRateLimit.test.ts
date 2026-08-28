import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { isLockedOut, getClientIp } from "@/lib/loginRateLimit";

describe("isLockedOut", () => {
  it("is not locked below both thresholds", () => {
    expect(isLockedOut(4, 10, 5, 20)).toBe(false);
  });

  it("locks at exactly the per-IP threshold (inclusive boundary)", () => {
    expect(isLockedOut(5, 5, 5, 20)).toBe(true);
  });

  it("locks at the global threshold even when the IP is clean", () => {
    expect(isLockedOut(0, 20, 5, 20)).toBe(true);
  });
});

describe("getClientIp", () => {
  function reqWithXff(value?: string): NextRequest {
    const headers = value === undefined ? undefined : { "x-forwarded-for": value };
    return new NextRequest("http://localhost/api/auth/login", { headers });
  }

  it("returns 'unknown' when the header is absent", () => {
    expect(getClientIp(reqWithXff())).toBe("unknown");
  });

  it("takes the first hop, trimmed", () => {
    expect(getClientIp(reqWithXff(" 203.0.113.7 , 10.0.0.1"))).toBe("203.0.113.7");
  });

  it("caps the value at 64 characters", () => {
    expect(getClientIp(reqWithXff("x".repeat(200)))).toHaveLength(64);
  });

  it("returns 'unknown' for an empty first hop", () => {
    expect(getClientIp(reqWithXff(" , 10.0.0.1"))).toBe("unknown");
  });
});
