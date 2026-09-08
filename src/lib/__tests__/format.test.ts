/**
 * Two age grammars live side by side and must not be confused.
 *
 *   formatAge      Block F's machine stamp: 6h / 36h / 3d / 29d
 *   formatWaiting  Block E's human duration: just now / 4 hours ago / 2 days ago
 *
 * The boundaries are the whole test: an off-by-one here reads as a wrong fact
 * on the page, not as a crash.
 */
import { describe, it, expect } from "vitest";
import {
  formatAge,
  formatWaiting,
  pluralise,
  numberCell,
  msSince,
  DASH,
  DASH_CELL,
} from "@/lib/format";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatAge", () => {
  it("reads in hours below two days", () => {
    expect(formatAge(0)).toBe("0h");
    expect(formatAge(1 * HOUR)).toBe("1h");
    expect(formatAge(36 * HOUR)).toBe("36h");
    expect(formatAge(47 * HOUR)).toBe("47h");
  });

  it("switches to days at exactly 48 hours", () => {
    expect(formatAge(48 * HOUR)).toBe("2d");
    expect(formatAge(72 * HOUR)).toBe("3d");
    expect(formatAge(696 * HOUR)).toBe("29d");
  });

  it("clamps a negative age to zero rather than printing a minus", () => {
    // Block F feeds this a stored checkedAt written by another Vercel instance,
    // so a small clock skew must read `0h`, never `-1h`. Matches formatWaiting.
    expect(formatAge(-5 * HOUR)).toBe("0h");
  });
});

describe("formatWaiting", () => {
  it("says just now below one hour", () => {
    expect(formatWaiting(0)).toBe("just now");
    expect(formatWaiting(59 * MINUTE)).toBe("just now");
  });

  it("switches to hours at exactly 60 minutes, singular at one", () => {
    expect(formatWaiting(60 * MINUTE)).toBe("1 hour ago");
    expect(formatWaiting(4 * HOUR)).toBe("4 hours ago");
    expect(formatWaiting(23 * HOUR)).toBe("23 hours ago");
  });

  it("switches to days at 24 hours and floors, so 47h is still one day", () => {
    expect(formatWaiting(24 * HOUR)).toBe("1 day ago");
    expect(formatWaiting(47 * HOUR)).toBe("1 day ago");
    expect(formatWaiting(48 * HOUR)).toBe("2 days ago");
    expect(formatWaiting(6 * DAY)).toBe("6 days ago");
  });

  it("switches to weeks at exactly seven days", () => {
    expect(formatWaiting(7 * DAY)).toBe("1 week ago");
    expect(formatWaiting(21 * DAY)).toBe("3 weeks ago");
  });

  it("never reads a future timestamp as a negative duration", () => {
    expect(formatWaiting(-5 * HOUR)).toBe("just now");
  });
});

describe("pluralise", () => {
  it("keeps the singular at exactly one and pluralises everywhere else", () => {
    expect(pluralise(1, "draft")).toBe("draft");
    expect(pluralise(0, "draft")).toBe("drafts");
    expect(pluralise(2, "draft")).toBe("drafts");
    expect(pluralise(1, "contact")).toBe("contact");
    expect(pluralise(30, "contact")).toBe("contacts");
  });

  it("takes an explicit plural for words that do not take an s", () => {
    expect(pluralise(1, "is", "are")).toBe("is");
    expect(pluralise(3, "is", "are")).toBe("are");
  });
});

describe("msSince", () => {
  const NOW = new Date("2026-09-05T12:00:00.000Z");

  it("returns the difference for a parseable timestamp", () => {
    expect(msSince(NOW, "2026-09-05T08:00:00.000Z")).toBe(4 * HOUR);
  });

  it("returns null for an unparseable timestamp rather than NaN", () => {
    expect(msSince(NOW, "not-a-date")).toBeNull();
    expect(msSince(NOW, "")).toBeNull();
  });

  it("does not clamp: a future timestamp reads negative, and the caller decides", () => {
    // The clamp belongs at each boundary — formatWaiting reads a negative as
    // `just now`, formatAge as `0h`. This function only parses and subtracts.
    expect(msSince(NOW, "2026-09-05T13:00:00.000Z")).toBe(-1 * HOUR);
  });
});

describe("numberCell", () => {
  it("uses the one exported em-dash, so the glyph is pinned in a single place", () => {
    expect(DASH).toBe("—");
  });

  it("shares ONE em-dash cell with every table on the page", () => {
    expect(DASH_CELL).toEqual({ text: "—", tone: "dash" });
    expect(numberCell(null)).toEqual(DASH_CELL);
    // Identity, not just shape: every absence in the app is this one object, so
    // a caller that mutated it would corrupt all of them at once — which is why
    // the object is frozen.
    expect(numberCell(null)).toBe(DASH_CELL);
    expect(Object.isFrozen(DASH_CELL)).toBe(true);
  });

  it("distinguishes a measured zero from an absence — the page's core rule", () => {
    expect(numberCell(0)).toEqual({ text: "0", tone: "zero" });
    expect(numberCell(null)).toEqual({ text: "—", tone: "dash" });
    expect(numberCell(5)).toEqual({ text: "5", tone: "value" });
  });

  it("reads a non-finite number as the dash, never as a printed NaN", () => {
    // The function whose one job is keeping a measurement apart from a
    // non-measurement must not print `NaN` or `Infinity` as a value.
    expect(numberCell(Number.NaN)).toEqual({ text: "—", tone: "dash" });
    expect(numberCell(Number.POSITIVE_INFINITY)).toEqual({ text: "—", tone: "dash" });
  });
});
