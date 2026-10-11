/**
 * instantSwitch.test.ts — a switch flips on press and flips back only on a
 * definite failure (smooth-feel spec §5); the server's render decides once
 * the press and its re-read are done.
 */
import { describe, it, expect } from "vitest";
import { movedAfter, shownOn } from "@/lib/instantSwitch";

describe("shownOn", () => {
  it("while busy, the pressed switch shows where it was moved", () => {
    expect(shownOn("a", false, { key: "a", on: true }, true)).toBe(true);
  });
  it("another switch shows the server's position", () => {
    expect(shownOn("b", false, { key: "a", on: true }, true)).toBe(false);
  });
  it("once not busy, every switch shows the server's position", () => {
    expect(shownOn("a", false, { key: "a", on: true }, false)).toBe(false);
  });
  it("nothing moved: the server's position", () => {
    expect(shownOn("a", true, null, true)).toBe(true);
  });
});

describe("movedAfter", () => {
  const moved = { key: "a", on: true };
  it("a definite failure returns the switch", () => {
    expect(movedAfter("failed", moved)).toBeNull();
  });
  it("ok keeps it until the re-read lands", () => {
    expect(movedAfter("ok", moved)).toBe(moved);
  });
  it("no answer keeps it: the press may have landed", () => {
    expect(movedAfter("unknown", moved)).toBe(moved);
  });
});
