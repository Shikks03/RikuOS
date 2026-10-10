/**
 * briefingRefresh.test.ts — the Briefing island's "is this stale" rule
 * (S21 fix round): a resumed PWA asks the server again only after a long
 * enough gap since its last fresh props.
 */
import { describe, it, expect } from "vitest";
import { STALE_REFRESH_MS, shouldRefreshOnVisible } from "@/lib/briefingRefresh";

describe("shouldRefreshOnVisible", () => {
  it("does not refresh when no time has passed", () => {
    expect(shouldRefreshOnVisible(1_000, 1_000)).toBe(false);
  });

  it("does not refresh for a short gap (switching apps for a few seconds)", () => {
    expect(shouldRefreshOnVisible(0, 30_000)).toBe(false);
  });

  it("does not refresh one millisecond short of the threshold", () => {
    expect(shouldRefreshOnVisible(0, STALE_REFRESH_MS - 1)).toBe(false);
  });

  it("refreshes exactly at the threshold", () => {
    expect(shouldRefreshOnVisible(0, STALE_REFRESH_MS)).toBe(true);
  });

  it("refreshes well past the threshold (a PWA resumed hours later)", () => {
    expect(shouldRefreshOnVisible(0, STALE_REFRESH_MS * 20)).toBe(true);
  });

  it("never refreshes on clock skew (now before lastPropsAt)", () => {
    expect(shouldRefreshOnVisible(STALE_REFRESH_MS * 5, 0)).toBe(false);
  });
});
