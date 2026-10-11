/**
 * personalLayoutMemory.test.ts — the outline's arrangement (smooth-feel
 * spec §3.1): whatever this browser remembered, read total — anything
 * unreadable is the default, never a throw.
 */
import { describe, it, expect } from "vitest";
import { PERSONAL_LAYOUT_DEFAULT } from "@/lib/personalLayout";
import { layoutFromMemory, rememberedLayoutText } from "@/lib/personalLayoutMemory";

const CUSTOM = [
  [{ tile: "week", span: 12 }],
  [{ tile: "today", span: 6 }, { tile: "todos", span: 6 }],
  [{ tile: "layers", span: 12 }],
  [{ tile: "done", span: 12 }],
] as const;

describe("layoutFromMemory", () => {
  it("nothing remembered is the default", () => {
    expect(layoutFromMemory(null)).toBe(PERSONAL_LAYOUT_DEFAULT);
  });

  it("text that is not JSON is the default", () => {
    expect(layoutFromMemory("{")).toBe(PERSONAL_LAYOUT_DEFAULT);
  });

  it("a remembered arrangement round-trips", () => {
    expect(layoutFromMemory(rememberedLayoutText(CUSTOM))).toEqual(CUSTOM);
  });

  it("a retired tile is dropped and the rest kept", () => {
    const withPush = JSON.stringify([
      [{ tile: "week", span: 12 }],
      [{ tile: "today", span: 6 }, { tile: "todos", span: 6 }],
      [{ tile: "layers", span: 8 }, { tile: "push", span: 4 }],
      [{ tile: "done", span: 12 }],
    ]);
    expect(layoutFromMemory(withPush)).toEqual([
      [{ tile: "week", span: 12 }],
      [{ tile: "today", span: 6 }, { tile: "todos", span: 6 }],
      [{ tile: "layers", span: 8 }],
      [{ tile: "done", span: 12 }],
    ]);
  });
});

describe("rememberedLayoutText", () => {
  it("writes only tile and span", () => {
    const noisy = [[{ tile: "today", span: 12, extra: 1 }]] as unknown as Parameters<typeof rememberedLayoutText>[0];
    expect(rememberedLayoutText(noisy)).toBe('[[{"tile":"today","span":12}]]');
  });
});
