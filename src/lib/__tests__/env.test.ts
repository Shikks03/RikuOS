import { describe, it, expect, afterEach } from "vitest";
import { envInt, parseLimit } from "@/lib/env";

describe("envInt", () => {
  afterEach(() => {
    delete process.env.TEST_ENV_INT;
  });

  it("falls back when unset", () => {
    expect(envInt("TEST_ENV_INT", 7)).toBe(7);
  });

  it("parses a valid integer", () => {
    process.env.TEST_ENV_INT = "42";
    expect(envInt("TEST_ENV_INT", 7)).toBe(42);
  });

  it("falls back on a non-numeric value", () => {
    process.env.TEST_ENV_INT = "abc";
    expect(envInt("TEST_ENV_INT", 7)).toBe(7);
  });
});

describe("parseLimit", () => {
  const sp = (v?: string) => new URLSearchParams(v === undefined ? "" : `limit=${v}`);

  it("defaults when absent", () => {
    expect(parseLimit(sp(), 50, 100)).toBe(50);
  });

  it("parses a value within range", () => {
    expect(parseLimit(sp("10"), 50, 100)).toBe(10);
  });

  it("clamps to max", () => {
    expect(parseLimit(sp("999"), 50, 100)).toBe(100);
  });

  it("clamps to at least 1", () => {
    expect(parseLimit(sp("0"), 50, 100)).toBe(1);
  });

  it("defaults on garbage", () => {
    expect(parseLimit(sp("abc"), 50, 100)).toBe(50);
  });
});
