import { describe, it, expect } from "vitest";
import {
  ANY_DAY_OPENERS,
  b,
  capFirst,
  greeting,
  joinSaid,
  lowerLead,
  numberWord,
  opener,
  pickLine,
  readOnTheDay,
  say,
  toPage,
  weekday,
} from "@/lib/voice";
import { addDays } from "@/lib/days";
import { PUSH_TITLE_MAX } from "@/lib/constants";
import {
  DEBRIEF_AFTERNOON_OPENERS,
  DEBRIEF_EVENING_OPENERS,
  DEBRIEF_NIGHT_OPENERS,
  DEBRIEF_TAIL,
  debriefHeading,
  debriefOpener,
  debriefTimeBucket,
} from "@/lib/voice";

const START = "2026-01-05"; // a Monday

describe("say / bold ranges", () => {
  it("records each bold segment's range in the joined text", () => {
    const s = say(b("Meowchi's site"), " isn't answering (error 503).");
    expect(s.text).toBe("Meowchi's site isn't answering (error 503).");
    expect(s.bold).toEqual([{ start: 0, end: 14 }]);
    expect(s.text.slice(s.bold[0].start, s.bold[0].end)).toBe("Meowchi's site");
  });

  it("capFirst upper-cases the first letter and leaves ranges alone", () => {
    const s = capFirst(say(b("the chaser"), " failed."));
    expect(s.text).toBe("The chaser failed.");
    expect(s.bold).toEqual([{ start: 0, end: 10 }]);
  });

  it("joinSaid shifts the second sentence's ranges past the separator", () => {
    const j = joinSaid([say(b("A"), " x."), say("y ", b("B"), ".")], " ");
    expect(j.text).toBe("A x. y B.");
    expect(j.bold).toEqual([{ start: 0, end: 1 }, { start: 7, end: 8 }]);
  });

  it("lowerLead lowers only the voice's own lead words, never a name", () => {
    expect(lowerLead(say("The chaser failed.")).text).toBe("the chaser failed.");
    expect(lowerLead(say("Two approved items …")).text).toBe("two approved items …");
    expect(lowerLead(say("I couldn't read your to-dos.")).text).toBe("I couldn't read your to-dos.");
    expect(lowerLead(say("Meowchi's site isn't answering.")).text).toBe("Meowchi's site isn't answering.");
    expect(lowerLead(say("ShikksTracker's sender …")).text).toBe("ShikksTracker's sender …");
  });

  it("keeps bold ranges intact through toPage and lowerLead", () => {
    const original = say("The ", b("chaser's job"), " failed.");
    const range = original.bold[0];

    const paged = toPage(original.text);
    expect(paged.length).toBe(original.text.length);
    expect(paged.slice(range.start, range.end).replace(/’/g, "'")).toBe("chaser's job");

    const lowered = lowerLead(original);
    expect(lowered.text.length).toBe(original.text.length);
    expect(lowered.bold).toEqual(original.bold);
    expect(lowered.text.slice(range.start, range.end)).toBe("chaser's job");
  });
});

describe("numbers and apostrophes", () => {
  it("writes one to ten as words and larger numbers as digits", () => {
    expect(numberWord(1)).toBe("one");
    expect(numberWord(10)).toBe("ten");
    expect(numberWord(11)).toBe("11");
  });

  it("toPage curls straight apostrophes for page text", () => {
    expect(toPage("isn't, Riku's")).toBe("isn’t, Riku’s");
  });
});

describe("pickLine", () => {
  it("is deterministic for the same day and salt", () => {
    expect(pickLine(ANY_DAY_OPENERS, "2026-03-03", "opener")).toBe(
      pickLine(ANY_DAY_OPENERS, "2026-03-03", "opener"),
    );
  });

  it("never picks the same line on two consecutive days, for every pool size 2..6 across 366 days", () => {
    for (let n = 2; n <= 6; n++) {
      const pool = Array.from({ length: n }, (_, i) => `line ${i}`);
      for (const salt of ["opener", "busy", "quiet", "ordinary", "problems"]) {
        let prev = pickLine(pool, START, salt);
        for (let d = 1; d <= 366; d++) {
          const next = pickLine(pool, addDays(START, d), salt);
          expect(next).not.toBe(prev);
          prev = next;
        }
      }
    }
  });

  it("returns the only line of a one-line pool and throws on an empty one", () => {
    expect(pickLine(["only"], START, "x")).toBe("only");
    expect(() => pickLine([], START, "x")).toThrow();
  });

  it("throws on a malformed or empty day key rather than silently picking undefined", () => {
    const pool = ["a", "b"];
    expect(() => pickLine(pool, "2026-02-30", "x")).toThrow(RangeError);
    expect(() => pickLine(pool, "", "x")).toThrow();
  });

  it("visits every line of the pool within any run of n consecutive days, for pool sizes 2..6", () => {
    for (let n = 2; n <= 6; n++) {
      const pool = Array.from({ length: n }, (_, i) => `line ${i}`);
      for (const salt of ["opener", "busy", "quiet", "ordinary", "problems"]) {
        const picks = Array.from({ length: 400 }, (_, d) => pickLine(pool, addDays(START, d), salt));
        for (let start = 0; start + n <= picks.length; start++) {
          const window = new Set(picks.slice(start, start + n));
          expect(window.size).toBe(n);
        }
      }
    }
  });
});

describe("opener", () => {
  it("uses the day-specific openers on Monday, Friday, Saturday and Sunday", () => {
    expect(weekday("2026-01-05")).toBe(1);
    expect(opener("2026-01-05")).toBe("New week, Riku.");
    expect(opener("2026-01-09")).toBe("Last push of the week, Riku.");
    expect(opener("2026-01-10")).toBe("Easy morning, Riku.");
    expect(opener("2026-01-11")).toBe("Easy Sunday, Riku.");
  });

  it("draws Tuesday to Thursday from the any-day pool", () => {
    for (const day of ["2026-01-06", "2026-01-07", "2026-01-08"]) {
      expect(ANY_DAY_OPENERS).toContain(opener(day));
    }
  });

  it("never repeats an opener on consecutive days across a year", () => {
    let prev = opener(START);
    for (let d = 1; d <= 366; d++) {
      const next = opener(addDays(START, d));
      expect(next).not.toBe(prev);
      prev = next;
    }
  });

  it("always names Riku and never says sir", () => {
    for (let d = 0; d < 14; d++) {
      const o = opener(addDays(START, d));
      expect(o).toContain("Riku");
      expect(o.toLowerCase()).not.toContain("sir");
    }
  });
});

describe("readOnTheDay / greeting", () => {
  it("counts problems in words and never sounds cheerful over one", () => {
    expect(readOnTheDay({ kind: "problems", stories: 1 }, START)).toBe("One thing needs you.");
    expect(readOnTheDay({ kind: "problems", stories: 2 }, START)).toBe("Two things need you.");
    const three = readOnTheDay({ kind: "problems", stories: 3 }, START);
    expect(["Three things need you.", "A rough night. Three things need you."]).toContain(three);
    expect(readOnTheDay({ kind: "problems", stories: 12 }, START)).toMatch(/12 things need you\.$/);
  });

  it("draws busy, quiet and ordinary from their own pools", () => {
    expect(["Full day ahead.", "Busy one today."]).toContain(readOnTheDay({ kind: "busy" }, START));
    expect(["Quiet one today.", "Clear runway today."]).toContain(readOnTheDay({ kind: "quiet" }, START));
    expect(["All's well.", "Nothing's on fire."]).toContain(readOnTheDay({ kind: "ordinary" }, START));
  });

  it("joins opener and read with one space and fits the 80-character title", () => {
    for (let d = 0; d < 400; d++) {
      const day = addDays(START, d);
      for (const stories of [1, 2, 3, 10, 99]) {
        const t = greeting(day, { kind: "problems", stories });
        expect(t.length).toBeLessThanOrEqual(PUSH_TITLE_MAX);
        expect(t).toMatch(/^\S.*\. \S.*\.$/);
      }
    }
  });
});

describe("the Debrief's heading (S22, spec §2.1)", () => {
  it.each([
    [0, "night"],
    [4, "night"],
    [5, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [16, "afternoon"],
    [17, "evening"],
    [20, "evening"],
    [21, "night"],
    [23, "night"],
  ] as const)("hour %i is %s", (hour, bucket) => {
    expect(debriefTimeBucket(hour)).toBe(bucket);
  });

  it("draws each bucket from its own pool", () => {
    expect(ANY_DAY_OPENERS).toContain(debriefOpener(START, 9));
    expect(DEBRIEF_AFTERNOON_OPENERS).toContain(debriefOpener(START, 13));
    expect(DEBRIEF_EVENING_OPENERS).toContain(debriefOpener(START, 18));
    expect(DEBRIEF_NIGHT_OPENERS).toContain(debriefOpener(START, 23));
    expect(DEBRIEF_NIGHT_OPENERS).toContain(debriefOpener(START, 2));
  });

  it("never repeats an opener on consecutive days within a bucket, across a year", () => {
    for (const hour of [9, 13, 18, 23]) {
      let prev = debriefOpener(START, hour);
      for (let d = 1; d <= 366; d++) {
        const next = debriefOpener(addDays(START, d), hour);
        expect(next).not.toBe(prev);
        prev = next;
      }
    }
  });

  it("keeps the tail fixed, always names Riku and never says sir", () => {
    expect(DEBRIEF_TAIL).toBe("Here's where things stand.");
    for (let d = 0; d < 14; d++) {
      for (const hour of [9, 13, 18, 23]) {
        const day = addDays(START, d);
        const h = debriefHeading(day, hour);
        expect(h).toBe(`${debriefOpener(day, hour)} Here's where things stand.`);
        expect(h).toContain("Riku");
        expect(h.toLowerCase()).not.toContain("sir");
      }
    }
  });

  it("uses the approved pools word for word (spec §2.1, §10 item 2)", () => {
    expect([...DEBRIEF_AFTERNOON_OPENERS]).toEqual(["Afternoon, Riku.", "Good afternoon, Riku.", "Riku, afternoon check-in."]);
    expect([...DEBRIEF_EVENING_OPENERS]).toEqual(["Evening, Riku.", "Good evening, Riku."]);
    expect([...DEBRIEF_NIGHT_OPENERS]).toEqual(["Still up, Riku?", "Late one, Riku."]);
  });
});
