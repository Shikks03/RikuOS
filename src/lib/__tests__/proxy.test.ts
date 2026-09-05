import { describe, it, expect } from "vitest";
import { isPublicPath } from "@/proxy";

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/api/auth/login",
    "/api/cron/expire",
    "/manifest.webmanifest",
    "/sw.js",
    "/favicon.ico",
    "/_next/static/chunk.js",
    "/icon",
    "/apple-icon",
  ])("allows %s", (p) => {
    expect(isPublicPath(p)).toBe(true);
  });

  it.each(["/", "/queue", "/api/queue", "/api/push/test", "/api/auth/logout"])(
    "protects %s",
    (p) => {
      expect(isPublicPath(p)).toBe(false);
    }
  );

  it.each([
    "/api/cron/%2e%2e/queue",
    "/api/cron/../queue",
    "//evil.example",
    "/login/../api/queue",
  ])("fails closed on bypass-prone pathname %s", (p) => {
    expect(isPublicPath(p)).toBe(false);
  });
});
