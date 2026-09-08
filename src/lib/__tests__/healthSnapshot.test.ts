/**
 * The floor is a PURE FUNCTION rather than a branch inside the route handler,
 * so it is testable without a route, a database or a network — the same rule
 * the rest of the logic layer follows.
 *
 * It exists so a stuck finger cannot fire nine requests at client sites, not to
 * defend against abuse: there is exactly one user behind a session cookie.
 */
import { describe, it, expect } from "vitest";
import { CHECK_FLOOR_MS, isWithinCheckFloor } from "@/lib/healthSnapshot";

const NOW = new Date("2026-09-05T12:00:00.000Z");

function secondsAgo(s: number): Date {
  return new Date(NOW.getTime() - s * 1000);
}

describe("isWithinCheckFloor", () => {
  it("is sixty seconds", () => {
    expect(CHECK_FLOOR_MS).toBe(60_000);
  });

  it("holds a check made 59 seconds ago inside the floor", () => {
    expect(isWithinCheckFloor(NOW, secondsAgo(59))).toBe(true);
    expect(isWithinCheckFloor(NOW, secondsAgo(0))).toBe(true);
  });

  it("lets a check made exactly 60 seconds ago through", () => {
    expect(isWithinCheckFloor(NOW, secondsAgo(60))).toBe(false);
    expect(isWithinCheckFloor(NOW, secondsAgo(61))).toBe(false);
  });

  it("never holds a null snapshot inside the floor — nothing has ever been read", () => {
    expect(isWithinCheckFloor(NOW, null)).toBe(false);
  });

  it("lets a future checkedAt through rather than locking the button out", () => {
    // A clock skew must never make Check now permanently unusable.
    expect(isWithinCheckFloor(NOW, new Date(NOW.getTime() + 10 * 60_000))).toBe(false);
  });

  it("takes the floor as an argument so it is testable at other widths", () => {
    expect(isWithinCheckFloor(NOW, secondsAgo(5), 10_000)).toBe(true);
    expect(isWithinCheckFloor(NOW, secondsAgo(15), 10_000)).toBe(false);
  });
});
