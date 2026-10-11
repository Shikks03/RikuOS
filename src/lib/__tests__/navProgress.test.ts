/**
 * navProgress.test.ts — the top bar's count (smooth-feel spec §3.2,
 * deviation 2): loading while any load is open, ended once per end.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { beginLoading, isLoading, resetLoadingForTests, subscribeLoading } from "@/lib/navProgress";

beforeEach(() => resetLoadingForTests());

describe("navProgress", () => {
  it("starts idle", () => {
    expect(isLoading()).toBe(false);
  });

  it("one load is loading until it ends", () => {
    const end = beginLoading();
    expect(isLoading()).toBe(true);
    end();
    expect(isLoading()).toBe(false);
  });

  it("overlapping loads keep it loading until the last one ends", () => {
    const a = beginLoading();
    const b = beginLoading();
    a();
    expect(isLoading()).toBe(true);
    b();
    expect(isLoading()).toBe(false);
  });

  it("an end called twice ends its load once", () => {
    const a = beginLoading();
    const b = beginLoading();
    a();
    a();
    expect(isLoading()).toBe(true);
    b();
    expect(isLoading()).toBe(false);
  });

  it("tells subscribers on every change, and stops after unsubscribing", () => {
    const fn = vi.fn();
    const off = subscribeLoading(fn);
    const end = beginLoading();
    end();
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    beginLoading();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
