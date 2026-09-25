/**
 * Every "due today / overdue / within 3 days" question on the Personal page and
 * in the morning push is asked of a day key in APP_TZ. Vercel runs in UTC and
 * the morning cron fires at 23:00 UTC — 07:00 in Manila — so the case this
 * module exists for is the one around midnight UTC. The label format is pinned
 * to the exact string because a locale-dependent label is how `Thu, Sep 10`
 * ships.
 */
import { describe, it, expect } from "vitest";
import { dayKey, dayStart, addDays, daysBetween, formatDay, todayKey } from "@/lib/days";
import { APP_TZ, PUSH_EXPECTED_HOUR } from "@/lib/constants";

describe("the constants", () => {
  it("asks every day question in Manila, and expects the push at 07:00 there", () => {
    expect(APP_TZ).toBe("Asia/Manila");
    expect(PUSH_EXPECTED_HOUR).toBe(7);
  });
});

describe("dayKey", () => {
  it("rolls over to the next Manila day at 16:00 UTC", () => {
    expect(dayKey(new Date("2026-09-10T16:00:00Z"), APP_TZ)).toBe("2026-09-11");
  });

  it("is still the same Manila day one second before 16:00 UTC", () => {
    expect(dayKey(new Date("2026-09-10T15:59:59Z"), APP_TZ)).toBe("2026-09-10");
  });

  it("reports Manila's today at the morning cron's 23:00 UTC, not UTC's yesterday", () => {
    expect(dayKey(new Date("2026-09-10T23:00:00Z"), APP_TZ)).toBe("2026-09-11");
  });

  it("answers in the zone it is given", () => {
    expect(dayKey(new Date("2026-09-10T16:00:00Z"), "UTC")).toBe("2026-09-10");
  });

  it("zero-pads the month and the day", () => {
    expect(dayKey(new Date("2026-01-05T00:00:00Z"), "UTC")).toBe("2026-01-05");
  });
});

describe("dayStart", () => {
  it("is that calendar day at 00:00:00Z", () => {
    expect(dayStart("2026-09-10").toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  it("round-trips through dayKey in UTC", () => {
    for (const key of ["2026-09-10", "2026-12-31", "2027-01-01", "2028-02-29"]) {
      expect(dayKey(dayStart(key), "UTC")).toBe(key);
    }
  });
});

describe("addDays", () => {
  it("crosses a month end", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });

  it("crosses a year end", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("knows a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("is the identity at zero", () => {
    expect(addDays("2026-09-10", 0)).toBe("2026-09-10");
  });
});

describe("daysBetween", () => {
  it("is positive when b is after a", () => {
    expect(daysBetween("2026-09-10", "2026-09-13")).toBe(3);
  });

  it("is negative when b is before a", () => {
    expect(daysBetween("2026-09-13", "2026-09-10")).toBe(-3);
  });

  it("is zero on the same day", () => {
    expect(daysBetween("2026-09-10", "2026-09-10")).toBe(0);
  });

  it("is exact across a year end", () => {
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
  });
});

describe("formatDay", () => {
  it("spells the deck's label exactly", () => {
    expect(formatDay("2026-09-10")).toBe("Thu 10 Sep");
  });

  it("does not zero-pad the day", () => {
    expect(formatDay("2026-10-02")).toBe("Fri 2 Oct");
  });

  it("names the calendar day, whatever zone the process runs in", () => {
    // dayStart is 00:00Z; a label formatted in a zone west of UTC would read
    // the day before. The key IS the day, so the label must not move.
    expect(formatDay("2027-01-01")).toBe("Fri 1 Jan");
  });
});

describe("todayKey", () => {
  it("agrees with dayKey(now, APP_TZ) by default", () => {
    const now = new Date("2026-09-10T23:00:00Z");
    expect(todayKey(now)).toBe(dayKey(now, APP_TZ));
    expect(todayKey(now)).toBe("2026-09-11");
  });

  it("takes a zone when given one", () => {
    expect(todayKey(new Date("2026-09-10T23:00:00Z"), "UTC")).toBe("2026-09-10");
  });
});
