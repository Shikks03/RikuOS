/**
 * heroTint is the Personal hero's whole colour decision: nine states, no
 * tenth, and null when the to-do read did not answer (R79-R85). The page
 * renders `.pe-t${n}`; a value outside 0..8 matches no rule and falls back to
 * the untinted hero, so the lookup's job is to never hand one out.
 *
 * PERSONAL_HERO_BUSY_AT is deleted (R80): R73's single-threshold constant is
 * superseded by the anchor table. One field, never two booleans.
 */

import { describe, it, expect } from "vitest";
import { heroTint, PERSONAL_HERO_ANCHORS } from "@/lib/personalView";

describe("heroTint", () => {
  it("maps each of the nine states to itself", () => {
    expect(heroTint(0)).toBe(0);
    expect(heroTint(1)).toBe(1);
    expect(heroTint(2)).toBe(2);
    expect(heroTint(3)).toBe(3);
    expect(heroTint(4)).toBe(4);
    expect(heroTint(5)).toBe(5);
    expect(heroTint(6)).toBe(6);
    expect(heroTint(7)).toBe(7);
    expect(heroTint(8)).toBe(8);
  });

  it("clamps anything above eight to eight", () => {
    expect(heroTint(9)).toBe(8);
    expect(heroTint(40)).toBe(8);
    expect(heroTint(1e9)).toBe(8);
  });

  it("returns null for null: no count, the hero claims nothing (R83)", () => {
    expect(heroTint(null)).toBeNull();
  });

  it("returns null for a value that is not a non-negative integer", () => {
    expect(heroTint(-1)).toBeNull();
    expect(heroTint(1.5)).toBeNull();
    expect(heroTint(Number.NaN)).toBeNull();
    expect(heroTint(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("returns one field - null or a number in 0..8 - never a string or boolean", () => {
    const inputs = [null, -1, 0, 1, 3, 7, 8, 9, 1.5, Number.NaN, Number.POSITIVE_INFINITY];
    for (const input of inputs) {
      const out = heroTint(input);
      if (out === null) continue;
      expect(typeof out).toBe("number");
      expect(Number.isInteger(out)).toBe(true);
      expect(out).toBeGreaterThanOrEqual(0);
      expect(out).toBeLessThanOrEqual(8);
    }
  });

  it("a day with ten scheduled events and nothing due is heroTint(0) === 0 - events never count", () => {
    // The function never sees events; the caller passes the DUE group's row count.
    expect(heroTint(0)).toBe(0);
  });

  it("one overdue to-do and nothing else due is heroTint(1) === 1, not 8 (R85)", () => {
    expect(heroTint(1)).toBe(1);
    expect(heroTint(1)).not.toBe(8);
  });
});

describe("PERSONAL_HERO_ANCHORS", () => {
  it("is the frozen table green 0, orange 3, red 8", () => {
    expect(PERSONAL_HERO_ANCHORS).toEqual({ save: 0, spend: 3, missing: 8 });
    expect(Object.isFrozen(PERSONAL_HERO_ANCHORS)).toBe(true);
  });
});
