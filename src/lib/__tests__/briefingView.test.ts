import { describe, it, expect } from "vitest";
import {
  buildBriefingView,
  buildGreetingLine,
  parseSentAt,
  segments,
  shouldAutoOpen,
  type GreetingInput,
} from "@/lib/briefingView";
import type { StoredDigest } from "@/lib/lastDigest";
import type { StoredBriefing } from "@/lib/briefingTypes";

const BRIEFING: StoredBriefing = {
  stories: [
    {
      sentence: "Meowchi's site isn't answering (error 503).",
      bold: [{ start: 0, end: 14 }],
      symptoms: [
        {
          key: "site-status",
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
const AFTER_SEVEN = new Date("2026-09-10T02:00:00Z"); // 10:00 Manila
const BEFORE_SEVEN = new Date("2026-09-09T16:30:00Z"); // 00:30 Manila, Thu 10

function line(over: Partial<GreetingInput>) {
  return buildGreetingLine({ now: AFTER_SEVEN, digest: null, dispatcher: null, monitoringEnabled: true, ...over });
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
    expect(v).toEqual({ kind: "unsaved", text: "A briefing went out, but I couldn’t save it.", tone: "warning", opens: null });
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

  it("the 07:00 boundary in Manila", () => {
    expect(line({ now: new Date("2026-09-09T22:59:00Z"), digest: OLD_PUSH }).kind).toBe("before");
    expect(line({ now: new Date("2026-09-09T23:00:00Z"), digest: OLD_PUSH }).kind).toBe("missing");
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

  describe("a skipped run is not a briefing", () => {
    const skippedToday = { ok: true, startedAt: new Date("2026-09-09T23:00:00Z"), skipped: true, noDevice: false };
    it("monitoring off + skipped today → monitoring-off", () => {
      expect(line({ digest: OLD_PUSH, monitoringEnabled: false, dispatcher: skippedToday }).kind).toBe("monitoring-off");
    });
    it("monitoring back on, skipped today → missing", () => {
      expect(line({ digest: OLD_PUSH, monitoringEnabled: true, dispatcher: skippedToday }).kind).toBe("missing");
    });
    it("skipped with nothing ever stored → never", () => {
      expect(line({ digest: null, dispatcher: skippedToday }).kind).toBe("never");
    });
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
