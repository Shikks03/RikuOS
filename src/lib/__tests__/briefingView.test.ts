import { describe, it, expect } from "vitest";
import {
  buildBriefingView,
  buildGreetingLine,
  debriefIsToday,
  debriefOutstanding,
  parseSentAt,
  segments,
  shouldAutoOpen,
  symptomView,
  type GreetingInput,
} from "@/lib/briefingView";
import type { StoredDigest } from "@/lib/lastDigest";
import type { StoredBriefing, StoredDebrief } from "@/lib/briefingTypes";

const BRIEFING: StoredBriefing = {
  stories: [
    {
      sentence: "Meowchi's site isn't answering (error 503).",
      bold: [{ start: 0, end: 14 }],
      symptoms: [
        {
          key: "site-status",
          subject: "Meowchi",
          sentence: "Meowchi's site isn't answering (error 503).",
          bold: [{ start: 0, end: 14 }],
          nextStep: "Open the site, then check its latest deploy on Vercel.",
          causeKey: "fixed",
          cause: "Most likely the site's server is crashing or mid-deploy.",
          causeBold: [{ start: 12, end: 56 }],
          raw: null,
        },
      ],
    },
  ],
  today: "Today you've got Math Methods at 09:00.",
  freelance: "One lead is waiting on your reply.",
  off: null,
  unrecognised: 0,
  omitted: 0,
};

const TODAY_PUSH: StoredDigest = {
  sentAt: new Date("2026-09-09T23:00:12Z"), // 07:00 Manila, Thu 10 Sep
  title: "Good morning, Riku. One thing needs you.",
  body: "Meowchi's site isn't answering (error 503).",
  devices: 2,
  briefing: BRIEFING,
  seenAt: null,
};
const PLAIN_TODAY: StoredDigest = { ...TODAY_PUSH, briefing: null, title: "All clear · 0 to review", body: "All clear." };
const YESTERDAY: StoredDigest = { ...TODAY_PUSH, sentAt: new Date("2026-09-08T23:00:00Z") };
const OLD_PUSH: StoredDigest = { ...TODAY_PUSH, sentAt: new Date("2026-08-08T23:00:00Z"), title: "Old", body: "Old body", briefing: null };
/** A today's digest the morning route still saved, even though it reached nobody. */
const TODAY_UNDELIVERED: StoredDigest = { ...TODAY_PUSH, devices: 0 };
const AFTER_SEVEN = new Date("2026-09-10T02:00:00Z"); // 10:00 Manila
const BEFORE_SEVEN = new Date("2026-09-09T16:30:00Z"); // 00:30 Manila, Thu 10

function line(over: Partial<GreetingInput>) {
  return buildGreetingLine({ now: AFTER_SEVEN, digest: null, debrief: null, dispatcher: null, monitoringEnabled: true, ...over });
}

describe("buildGreetingLine — the push tile's states, moved and re-voiced", () => {
  it("today: the stored title, warning when the Briefing has problems", () => {
    expect(line({ digest: TODAY_PUSH })).toEqual({
      kind: "today",
      text: "Good morning, Riku. One thing needs you.",
      tone: "warning",
      opens: "digest",
    });
  });

  it("today with no problems, or an old-format record: normal tone", () => {
    expect(line({ digest: { ...TODAY_PUSH, briefing: { ...BRIEFING, stories: [] } } }).tone).toBe("normal");
    expect(line({ digest: PLAIN_TODAY })).toMatchObject({ kind: "today", text: "All clear · 0 to review", tone: "normal" });
  });

  it("today's digest, saved but reaching zero devices, is 'undelivered' rather than a plain greeting", () => {
    expect(line({ digest: TODAY_UNDELIVERED })).toEqual({
      kind: "undelivered",
      text: "This morning’s briefing reached none of your devices.",
      tone: "alarm",
      opens: "digest",
    });
  });

  it("curls the stored title's apostrophes for the page", () => {
    expect(line({ digest: { ...TODAY_PUSH, title: "Morning. Here's your day, Riku. All's well." } }).text).toBe(
      "Morning. Here’s your day, Riku. All’s well.",
    );
  });

  it("went out but not saved", () => {
    const v = line({
      digest: OLD_PUSH,
      dispatcher: { ok: true, startedAt: new Date("2026-09-09T23:00:00Z"), skipped: false, noDevice: false },
    });
    // S22 D4 (plan deviation 7): the last stored Briefing opens, so the
    // panel — and the Debrief button at its foot — stays reachable.
    expect(v).toEqual({ kind: "unsaved", text: "A briefing went out, but I couldn’t save it.", tone: "warning", opens: "digest" });
  });

  it("went out but not saved, with nothing ever stored: nothing to open", () => {
    const v = line({
      digest: null,
      dispatcher: { ok: true, startedAt: new Date("2026-09-09T23:00:00Z"), skipped: false, noDevice: false },
    });
    expect(v).toMatchObject({ kind: "unsaved", opens: null });
  });

  it("past 07:00, nothing today: the alarm, and the last one opens", () => {
    const v = line({
      digest: OLD_PUSH,
      dispatcher: { ok: true, startedAt: new Date("2026-08-08T23:00:00Z"), skipped: false, noDevice: false },
    });
    expect(v).toEqual({
      kind: "missing",
      text: "No briefing this morning. The 07:00 run didn’t happen.",
      tone: "alarm",
      opens: "digest",
    });
  });

  it("before 07:00: the muted promise, and the last one opens", () => {
    expect(line({ now: BEFORE_SEVEN, digest: YESTERDAY })).toEqual({
      kind: "before",
      text: "Your briefing comes at 07:00.",
      tone: "muted",
      opens: "digest",
    });
  });

  it("the cron's grace window: before 07:00, due 07:00–07:59, missing from 08:00 (Manila)", () => {
    expect(line({ now: new Date("2026-09-09T22:59:00Z"), digest: OLD_PUSH }).kind).toBe("before"); // 06:59
    expect(line({ now: new Date("2026-09-09T23:00:00Z"), digest: OLD_PUSH })).toEqual({
      kind: "due",
      text: "Your briefing is on its way.",
      tone: "muted",
      opens: "digest",
    }); // 07:00
    expect(line({ now: new Date("2026-09-09T23:59:00Z"), digest: OLD_PUSH }).kind).toBe("due"); // 07:59
    expect(line({ now: new Date("2026-09-10T00:00:00Z"), digest: OLD_PUSH }).kind).toBe("missing"); // 08:00
  });

  it("a failed dispatcher run today is not a briefing that went out", () => {
    const v = line({
      digest: OLD_PUSH,
      dispatcher: { ok: false, startedAt: new Date("2026-09-09T23:00:00Z"), skipped: false, noDevice: false },
    });
    expect(v).toEqual({
      kind: "failed",
      text: "This morning’s briefing run failed.",
      tone: "alarm",
      opens: "digest",
    });
  });

  it("a failed run that reached no device is named, not just 'failed'", () => {
    const v = line({
      digest: OLD_PUSH,
      dispatcher: { ok: false, startedAt: new Date("2026-09-09T23:00:00Z"), skipped: false, noDevice: true },
    });
    expect(v).toEqual({
      kind: "undelivered",
      text: "This morning’s briefing reached none of your devices.",
      tone: "alarm",
      opens: "digest",
    });
  });

  it("a failed run from an EARLIER day is not today's failure — it's just a missing/before morning", () => {
    const earlierFail = { ok: false, startedAt: new Date("2026-08-08T23:00:00Z"), skipped: false, noDevice: true };
    expect(line({ digest: OLD_PUSH, dispatcher: earlierFail, now: AFTER_SEVEN }).kind).toBe("missing");
    expect(line({ digest: OLD_PUSH, dispatcher: earlierFail, now: BEFORE_SEVEN }).kind).toBe("before");
  });

  it("failed or undelivered with no digest ever stored have nothing to open", () => {
    const failedToday = { ok: false, startedAt: new Date("2026-09-09T23:00:00Z"), skipped: false, noDevice: false };
    const undeliveredToday = { ...failedToday, noDevice: true };
    expect(line({ digest: null, dispatcher: failedToday }).opens).toBeNull();
    expect(line({ digest: null, dispatcher: undeliveredToday }).opens).toBeNull();
  });

  it("never sent", () => {
    expect(line({})).toEqual({ kind: "never", text: "No briefing yet.", tone: "muted", opens: null });
  });

  it("monitoring off: muted, and loses to a briefing stored today", () => {
    expect(line({ digest: OLD_PUSH, monitoringEnabled: false })).toEqual({
      kind: "monitoring-off",
      text: "Monitoring is off, so there’s no morning briefing.",
      tone: "muted",
      opens: "digest",
    });
    expect(line({ digest: TODAY_PUSH, monitoringEnabled: false }).kind).toBe("today");
  });

  it("an unreadable record, or an unreadable run that matters, fails rather than guesses", () => {
    expect(line({ digest: "unavailable" })).toEqual({ kind: "fail", text: "I couldn’t load the briefing.", tone: "warning", opens: null });
    expect(line({ digest: OLD_PUSH, dispatcher: "unavailable" }).kind).toBe("fail");
    expect(line({ digest: TODAY_PUSH, dispatcher: "unavailable" }).kind).toBe("today");
  });

  describe("a skipped run is a fact, not a briefing that didn't happen", () => {
    const skippedToday = { ok: true, startedAt: new Date("2026-09-09T23:00:00Z"), skipped: true, noDevice: false };
    it("monitoring off + skipped today → monitoring-off (still off wins)", () => {
      expect(line({ digest: OLD_PUSH, monitoringEnabled: false, dispatcher: skippedToday }).kind).toBe("monitoring-off");
    });
    it("monitoring back on, skipped today → skipped, not the missing alarm", () => {
      expect(line({ digest: OLD_PUSH, monitoringEnabled: true, dispatcher: skippedToday })).toEqual({
        kind: "skipped",
        text: "Monitoring was off at 07:00, so there’s no briefing today.",
        tone: "muted",
        opens: "digest",
      });
    });
    it("settings unreadable, skipped today → skipped (the row we DO have still tells the truth)", () => {
      expect(line({ digest: OLD_PUSH, monitoringEnabled: "unavailable", dispatcher: skippedToday }).kind).toBe("skipped");
    });
    it("skipped with nothing ever stored → skipped, with nothing to open", () => {
      expect(line({ digest: null, dispatcher: skippedToday })).toEqual({
        kind: "skipped",
        text: "Monitoring was off at 07:00, so there’s no briefing today.",
        tone: "muted",
        opens: null,
      });
    });
    it("a skipped run from an EARLIER day is still no run at all", () => {
      const earlierSkip = { ...skippedToday, startedAt: new Date("2026-08-08T23:00:00Z") };
      expect(line({ digest: OLD_PUSH, dispatcher: earlierSkip, now: AFTER_SEVEN }).kind).toBe("missing");
    });
  });
});

describe("buildGreetingLine — the Debrief's recency rule (S22, spec §3.6)", () => {
  /** 09:30 Manila, Thu 10 Sep — after TODAY_PUSH (07:00) and before AFTER_SEVEN's 10:00. */
  const DEBRIEF: StoredDebrief = {
    at: new Date("2026-09-10T01:30:00Z"),
    baselineSentAt: TODAY_PUSH.sentAt,
    title: "Debrief at 09:30: one thing still needs you.",
    sorted: [],
    stillNeedsYou: [{ ...BRIEFING.stories[0].symptoms[0], note: null }],
    new: [],
    now: [],
    standaloneCouldntCheck: [],
    since: ["You’ve ticked off Essay."],
    today: "",
    freelance: null,
    off: null,
    unrecognised: 0,
    couldntCheck: { sites: false, watchdog: false, shikkstracker: false },
    saved: true,
  };
  const CLEAR: StoredDebrief = { ...DEBRIEF, title: "Debrief at 09:30: all clear.", stillNeedsYou: [] };

  it("digest only: unchanged from S21", () => {
    expect(line({ digest: TODAY_PUSH, debrief: null })).toMatchObject({ kind: "today", opens: "digest" });
  });

  it("a Debrief newer than this morning's digest takes the line, in the warning tone while anything needs him", () => {
    expect(line({ digest: TODAY_PUSH, debrief: DEBRIEF })).toEqual({
      kind: "debrief",
      text: "Debrief at 09:30: one thing still needs you.",
      tone: "warning",
      opens: "debrief",
    });
  });

  it("an all-clear Debrief reads in the normal tone", () => {
    expect(line({ digest: TODAY_PUSH, debrief: CLEAR })).toMatchObject({ kind: "debrief", tone: "normal" });
  });

  it("a couldn't-check line keeps the warning tone (plan deviation 5)", () => {
    const blind: StoredDebrief = {
      ...CLEAR,
      title: "Debrief at 09:30: one thing still needs you.",
      standaloneCouldntCheck: [{ source: "shikkstracker", sentence: "I couldn't reach ShikksTracker just now." }],
    };
    expect(line({ digest: TODAY_PUSH, debrief: blind }).tone).toBe("warning");
  });

  it("works with monitoring off and no digest today: the Debrief still takes the line (D6)", () => {
    expect(line({ digest: OLD_PUSH, debrief: DEBRIEF, monitoringEnabled: false })).toMatchObject({ kind: "debrief", opens: "debrief" });
    expect(line({ digest: null, debrief: DEBRIEF })).toMatchObject({ kind: "debrief", opens: "debrief" });
  });

  it("a digest at or after the Debrief keeps the line — deterministic either way", () => {
    expect(line({ digest: { ...TODAY_PUSH, sentAt: new Date("2026-09-10T01:45:00Z") }, debrief: DEBRIEF }).kind).toBe("today");
    expect(line({ digest: { ...TODAY_PUSH, sentAt: DEBRIEF.at }, debrief: DEBRIEF }).kind).toBe("today");
  });

  it("yesterday's Debrief never wins today's line — 07:00 takes it back by recency", () => {
    expect(line({ digest: TODAY_PUSH, debrief: { ...DEBRIEF, at: new Date("2026-09-09T05:00:00Z") } }).kind).toBe("today");
  });

  it("a Debrief that couldn't be read falls through silently to the digest's own line", () => {
    expect(line({ digest: TODAY_PUSH, debrief: "unavailable" })).toEqual(line({ digest: TODAY_PUSH, debrief: null }));
  });

  it("a good Debrief outranks a digest that couldn't be read", () => {
    expect(line({ digest: "unavailable", debrief: DEBRIEF }).kind).toBe("debrief");
  });

  it("debriefIsToday and debriefOutstanding", () => {
    expect(debriefIsToday(DEBRIEF, AFTER_SEVEN)).toBe(true);
    expect(debriefIsToday({ ...DEBRIEF, at: new Date("2026-09-09T05:00:00Z") }, AFTER_SEVEN)).toBe(false);
    expect(debriefOutstanding(DEBRIEF)).toBe(1);
    expect(debriefOutstanding(CLEAR)).toBe(0);
  });

  describe("a Debrief taken before 07:00 gives way to the morning's own state (fix round)", () => {
    /** 02:00 Manila, Thu 10 Sep. */
    const BEFORE_MORNING: StoredDebrief = { ...DEBRIEF, at: new Date("2026-09-09T18:00:00Z") };
    const FAILED_TODAY = { ok: false, startedAt: new Date("2026-09-09T23:00:00Z"), skipped: false, noDevice: false };

    it("now past 07:00, nothing sent today: the morning's own alarm wins, not the stale Debrief", () => {
      expect(line({ now: AFTER_SEVEN, digest: OLD_PUSH, debrief: BEFORE_MORNING })).toMatchObject({ kind: "missing" });
    });

    it("same, with a failed dispatcher run today: the morning's own failure wins", () => {
      expect(line({ now: AFTER_SEVEN, digest: OLD_PUSH, debrief: BEFORE_MORNING, dispatcher: FAILED_TODAY })).toMatchObject({
        kind: "failed",
      });
    });

    it("now still before 07:00: the Debrief still takes the line", () => {
      expect(line({ now: new Date("2026-09-09T19:00:00Z"), digest: OLD_PUSH, debrief: BEFORE_MORNING })).toMatchObject({
        kind: "debrief",
      });
    });

    it("now in the 07–08 grace window: the morning's own 'on its way' state, not the Debrief", () => {
      expect(line({ now: new Date("2026-09-09T23:30:00Z"), digest: OLD_PUSH, debrief: BEFORE_MORNING })).toMatchObject({ kind: "due" });
    });

    it("a Debrief taken at or after 07:00 is unaffected, even against a 07:00 digest", () => {
      const at1300: StoredDebrief = { ...DEBRIEF, at: new Date("2026-09-10T05:00:00Z"), title: "Debrief at 13:00: all clear." };
      expect(line({ now: new Date("2026-09-10T05:30:00Z"), digest: TODAY_PUSH, debrief: at1300 })).toMatchObject({ kind: "debrief" });
    });
  });

  describe("a Debrief never hides a morning whose 07:00 run didn't happen (fix round, plan deviation 25)", () => {
    /** 09:00 Manila, Thu 10 Sep — past PUSH_LATE_HOUR, same as AFTER_SEVEN's 10:00. */
    const AT_0900: StoredDebrief = { ...DEBRIEF, at: new Date("2026-09-10T01:00:00Z"), title: "Debrief at 09:00: all clear." };
    const FAILED_TODAY = { ok: false, startedAt: new Date("2026-09-09T23:00:00Z"), skipped: false, noDevice: false };

    it("no digest sent today, no run today, monitoring on, past PUSH_LATE_HOUR: the morning's own missing alarm wins", () => {
      expect(line({ now: AFTER_SEVEN, digest: OLD_PUSH, debrief: AT_0900 })).toMatchObject({ kind: "missing" });
    });

    it("same, but monitoring off: the Debrief still takes the line", () => {
      expect(line({ now: AFTER_SEVEN, digest: OLD_PUSH, debrief: AT_0900, monitoringEnabled: false })).toMatchObject({
        kind: "debrief",
      });
    });

    it("same, but now is still inside the 07–08 grace window: the Debrief still takes the line", () => {
      expect(line({ now: new Date("2026-09-09T23:30:00Z"), digest: OLD_PUSH, debrief: AT_0900 })).toMatchObject({ kind: "debrief" });
    });

    it("same, but the digest read is unavailable (unknown, not 'none'): the Debrief still takes the line", () => {
      expect(line({ now: AFTER_SEVEN, digest: "unavailable", debrief: AT_0900 })).toMatchObject({ kind: "debrief" });
    });

    it("same, but there IS a dispatcher run today (it failed): the Debrief still takes the line", () => {
      expect(line({ now: AFTER_SEVEN, digest: OLD_PUSH, debrief: AT_0900, dispatcher: FAILED_TODAY })).toMatchObject({
        kind: "debrief",
      });
    });

    it("nothing EVER stored is the quiet 'never' state, not an alarm, so it stays behind the Debrief (D6, unaffected)", () => {
      expect(line({ now: AFTER_SEVEN, digest: null, debrief: AT_0900 })).toMatchObject({ kind: "debrief" });
    });
  });
});

describe("symptomView — one stored symptom as a row and its card (shared with the Debrief)", () => {
  it("curls the page text, keeps the raw error as quoted evidence, and names the cause heading", () => {
    const m = { ...BRIEFING.stories[0].symptoms[0], causeKey: "unrecognised" as const, raw: "it's broken" };
    expect(symptomView(m, "x.1")).toMatchObject({
      id: "x.1",
      nextStep: "Open the site, then check its latest deploy on Vercel.",
      causeHeading: "Cause",
      raw: "it's broken",
    });
    expect(symptomView(BRIEFING.stories[0].symptoms[0], "y").causeHeading).toBe("Likely cause");
  });
});

describe("segments", () => {
  it("splits text by bold ranges and curls apostrophes without moving them", () => {
    expect(segments("Meowchi's site isn't up.", [{ start: 0, end: 14 }])).toEqual([
      { text: "Meowchi’s site", bold: true },
      { text: " isn’t up.", bold: false },
    ]);
  });
  it("ignores ranges outside the text, empty ones, and ones overlapping a previous one", () => {
    expect(segments("abc", [{ start: 1, end: 9 }, { start: 2, end: 2 }])).toEqual([{ text: "abc", bold: false }]);
    expect(segments("abcdef", [{ start: 0, end: 3 }, { start: 2, end: 5 }])).toEqual([
      { text: "abc", bold: true },
      { text: "def", bold: false },
    ]);
  });
});

describe("buildBriefingView", () => {
  it("today's full Briefing, labelled and stamped in Manila", () => {
    const v = buildBriefingView(TODAY_PUSH, AFTER_SEVEN);
    expect(v.label).toBe("This morning");
    expect(v.stamp).toBe("07:00");
    expect(v.isToday).toBe(true);
    expect(v.sentAtIso).toBe("2026-09-09T23:00:12.000Z");
    expect(v.kind).toBe("full");
    if (v.kind !== "full") throw new Error("unreachable");
    expect(v.stories[0].symptoms[0]).toMatchObject({
      id: "0.0",
      nextStep: "Open the site, then check its latest deploy on Vercel.",
      causeHeading: "Likely cause",
      raw: null,
    });
    expect(v.stories[0].sentence[0]).toEqual({ text: "Meowchi’s site", bold: true });
    expect(v.today).toBe("Today you’ve got Math Methods at 09:00.");
    expect(v.omitted).toBe(0);
  });

  it("carries the stored omitted count through to the view", () => {
    const v = buildBriefingView({ ...TODAY_PUSH, briefing: { ...BRIEFING, omitted: 3 } }, AFTER_SEVEN);
    if (v.kind !== "full") throw new Error("unreachable");
    expect(v.omitted).toBe(3);
  });

  it("labels yesterday's and older ones", () => {
    expect(buildBriefingView(YESTERDAY, AFTER_SEVEN)).toMatchObject({ label: "Yesterday", isToday: false });
    expect(buildBriefingView(OLD_PUSH, AFTER_SEVEN)).toMatchObject({ label: "Last: Sun 9 Aug", isToday: false });
  });

  it("an old-format record is a plain quote", () => {
    expect(buildBriefingView(PLAIN_TODAY, AFTER_SEVEN)).toMatchObject({
      kind: "quote",
      title: "All clear · 0 to review",
      body: "All clear.",
    });
  });

  it("an unrecognised cause takes the plain heading and keeps its raw error uncurled", () => {
    const d: StoredDigest = {
      ...TODAY_PUSH,
      briefing: {
        ...BRIEFING,
        stories: [
          {
            ...BRIEFING.stories[0],
            symptoms: [
              {
                ...BRIEFING.stories[0].symptoms[0],
                causeKey: "unrecognised",
                cause: "I don't recognise this one. The raw error is below.",
                causeBold: [{ start: 0, end: 27 }],
                raw: "it's broken",
              },
            ],
          },
        ],
      },
    };
    const v = buildBriefingView(d, AFTER_SEVEN);
    if (v.kind !== "full") throw new Error("unreachable");
    expect(v.stories[0].symptoms[0]).toMatchObject({ causeHeading: "Cause", raw: "it's broken" });
  });
});

describe("shouldAutoOpen", () => {
  it("opens today's unseen Briefing only", () => {
    expect(shouldAutoOpen(TODAY_PUSH, AFTER_SEVEN)).toBe(true);
    expect(shouldAutoOpen({ ...TODAY_PUSH, seenAt: new Date() }, AFTER_SEVEN)).toBe(false);
    expect(shouldAutoOpen(YESTERDAY, AFTER_SEVEN)).toBe(false);
    expect(shouldAutoOpen(null, AFTER_SEVEN)).toBe(false);
    expect(shouldAutoOpen("unavailable", AFTER_SEVEN)).toBe(false);
  });

  it("still greets for today's Briefing even when it reached zero devices — the site is the only channel left", () => {
    expect(shouldAutoOpen(TODAY_UNDELIVERED, AFTER_SEVEN)).toBe(true);
  });
});

describe("parseSentAt", () => {
  const now = new Date("2026-09-10T02:00:00Z");
  it("accepts an ISO instant no later than a minute from now", () => {
    expect(parseSentAt("2026-09-09T23:00:12.000Z", now)?.toISOString()).toBe("2026-09-09T23:00:12.000Z");
  });
  it("rejects anything else", () => {
    for (const bad of [undefined, null, 5, "", "yesterday", "2026-13-01T00:00:00Z", "2026-09-10T03:00:00Z", "x".repeat(100)]) {
      expect(parseSentAt(bad, now)).toBeNull();
    }
  });
});
