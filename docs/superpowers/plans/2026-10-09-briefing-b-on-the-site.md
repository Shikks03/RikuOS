# Briefing B — The Briefing on the site, the retired push tile, and the calendar messages: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riku meets the Briefing: a greeting line at the top of every page, a full-screen greeting on his first visit of the day across all devices (dismissed into the line with a shrink animation), a panel on demand, problem rows that open a cause card grown out of the row, and a live "since then" section. The Personal page's push tile is retired without losing his saved arrangement. The Personal page's calendar messages are rewritten as whole sentences in the voice.

**Architecture:** Every decision is in pure modules pinned by tests: `briefingView.ts` (greeting-line state, ported from `buildPushTileView`; the Briefing view model with curly apostrophes and bold segments; the auto-open rule; `parseSentAt`), `sinceThen.ts` (the live sentences), the `personalLayout.ts` retired-tile rule, and the calendar sentence table in `personalErrors.ts`. The impure edges are thin: `BriefingSlot.tsx` (three bounded read-only Mongo reads in the shell), `sinceThenRead.ts` + `GET /api/briefing/since`, and `POST /api/briefing/seen` (one guarded atomic update from Plan A). One client island, `Briefing.tsx`, owns the line, the two dialogs and the card, using native `<dialog>` for focus, Esc and inertness. `flip.ts` does the grow/shrink animation with the Web Animations API.

**Tech Stack:** Next.js 16 App Router (RSC + one client island) · React 19 · TypeScript `strict` · Vitest 4 · native `<dialog>` · Web Animations API. **No new dependency. No new `@media` rule** (components.css records the phone strip as the app's last one; reduced motion is honoured in JS through `matchMedia`, and base.css's existing rule already covers CSS animations).

**Spec:** `docs/superpowers/specs/2026-10-09-briefing-assistant-voice-design.md`. **Requires Plan A merged** (`briefingTypes.ts`, `voice.ts`'s `toPage`, `StoredDigest.briefing/seenAt`, `markBriefingSeen`).

---

## How this is built

The P10 method, as in Plan A: one named-role builder per task, a spec + quality reviewer per commit, fix rounds back to the same builder, a principal cross-module review, then the Verification Lead (headless Chromium, every mutation intercepted), then the post-build record. **No agent writes to Riku's database or calendar or sends a push.** Ports 3021–3023, one `next start` at a time, never worktrees with a `node_modules` junction.

| Task | Role | Files (exclusive while running) | Parallel with |
|---|---|---|---|
| B1 | View Modeller | `src/lib/briefingView.ts`, test; `src/lib/dispatcherRun.ts` | B2, B6 |
| B2 | Since-Then Writer | `src/lib/sinceThen.ts`, `src/lib/sinceThenRead.ts`, test | B1, B6 |
| B3 | Door Keeper | `src/app/api/briefing/seen/route.ts`, `src/app/api/briefing/since/route.ts` | — (after B1, B2) |
| B4 | Shell Builder | `src/app/(app)/_shell/{BriefingSlot,Briefing,flip}.tsx/.ts`, `TopBar.tsx`, `src/app/(app)/layout.tsx`, `src/styles/briefing.css`, `src/app/layout.tsx` | — (after B3) |
| B5 | Tile Retirer | `src/lib/personalLayout.ts`, `src/lib/personalView.ts`, `src/app/(app)/personal/page.tsx`, `_blocks/Push.tsx` (delete), `src/styles/personal.css`, layout/personalView/settings/osSettings/layoutEdit tests | — (after B4) |
| B6 | Copy Editor | `src/lib/personalErrors.ts`, `TodoForm.tsx`, `TodoRow.tsx`, `EventForm.tsx`, new `calendarMessages.test.ts` | B1, B2 |
| B7 | Verification Lead | none | — |

**L1e still applies:** legacy.css has a bare `button{text-transform:uppercase}`. Every button this plan adds sets `text-transform:none`.

---

## Deviations from the spec (binding)

1. **The panel is one shape at every width:** right-aligned, `width: min(480px, 100vw − 32px)`, full height inside 16px margins. On a phone that is the spec's "full width minus 16px gutters". The spec's bottom sheet would need a new `@media` rule, and S20/components.css record the phone strip as the app's last one.
2. **"Since then" appears only for today's Briefing.** When the line opens yesterday's or an older one (before 07:00, or a missed morning), the section is left out. "Since yesterday 07:00" would mix two days.
3. **The cause card's heading reads `Cause`** (not `Likely cause`) when the cause is unrecognised or "none", because there is no likely cause to name.
4. **`readDispatcher` moves from the Personal page to `src/lib/dispatcherRun.ts`** (`readLatestDispatcher`), because the shell now needs it and the page no longer does.
5. **The calendar sentence table covers every (action × cause) pair**, including pairs the server can't produce today (a new event with `changed`/`store`, a move with `changed`/`store`). Those get honest generic sentences instead of being left out of the type, so the client never meets a gap at runtime. The spec's "leave them out" aimed at the same safety; a total table gets there with fewer types.

---

### Task B1: `briefingView.ts` — the line, the view, the auto-open rule (View Modeller)

**Files:** Create `src/lib/briefingView.ts`, `src/lib/dispatcherRun.ts`, `src/lib/__tests__/briefingView.test.ts`. Modify `src/lib/__tests__/viewModelPurity.test.ts` (add `import "@/lib/briefingView";` beside the other pure-module imports).

- [ ] **Step 1: Write the failing test** `src/lib/__tests__/briefingView.test.ts`. It ports every `buildPushTileView` case to the line's new wording, then adds the view and auto-open cases:

```ts
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
    const v = line({ digest: OLD_PUSH, dispatcher: { ok: true, startedAt: new Date("2026-09-09T23:00:00Z"), skipped: false } });
    expect(v).toEqual({ kind: "unsaved", text: "A briefing went out, but I couldn’t save it.", tone: "warning", opens: null });
  });

  it("past 07:00, nothing today: the alarm, and the last one opens", () => {
    const v = line({ digest: OLD_PUSH, dispatcher: { ok: true, startedAt: new Date("2026-08-08T23:00:00Z"), skipped: false } });
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
    const v = line({ digest: OLD_PUSH, dispatcher: { ok: false, startedAt: new Date("2026-09-09T23:00:00Z"), skipped: false } });
    expect(v.kind).toBe("missing");
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
    const skippedToday = { ok: true, startedAt: new Date("2026-09-09T23:00:00Z"), skipped: true };
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
```

- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/briefingView.test.ts` → FAIL.

- [ ] **Step 3: Write `src/lib/briefingView.ts`**

```ts
/**
 * briefingView.ts — the Briefing's view models (S21). Pure: no database, no
 * network, no clock (`now` is a parameter). Imports are pure modules or
 * `import type` only (viewModelPurity.test.ts).
 *
 * THE GREETING LINE is the retired push tile's state machine (buildPushTileView,
 * P10b), moved here unchanged in its precedence and re-voiced (spec §5.1):
 *
 *   digest unreadable                 → fail
 *   a digest sent today (APP_TZ)      → today (its stored title)
 *   (a `skipped` dispatcher run counts as no run at all)
 *   dispatcher ok, started today      → unsaved
 *   monitoring off                    → monitoring-off
 *   dispatcher unreadable             → fail (can't tell "none" from "unsaved")
 *   no digest ever                    → never
 *   an older digest                   → missing from PUSH_EXPECTED_HOUR, else before
 *
 * Tone is colour AND a leading dot (spec §5.1), never colour alone.
 *
 * PAGE TEXT. Stored strings are push-form (straight apostrophes); everything
 * leaving this file for the page is curled by toPage, which never changes a
 * string's length, so stored bold ranges stay valid after curling. Raw
 * errors are NOT curled: they are quoted evidence.
 */

import { APP_TZ, PUSH_EXPECTED_HOUR } from "@/lib/constants";
import { addDays, clockHHMM, dayKey, formatDay, todayKey } from "@/lib/days";
import { toPage } from "@/lib/voice";
import type { StoredDigest } from "@/lib/lastDigest";
import type { StoredBold, StoredBriefing } from "@/lib/briefingTypes";

export interface GreetingInput {
  now: Date;
  /** getLastDigest(): null = never stored (R55); "unavailable" = the read threw. */
  digest: StoredDigest | null | "unavailable";
  /** The dispatcher's newest run; `skipped` = monitoring was off for it. */
  dispatcher: { ok: boolean; startedAt: Date; skipped: boolean } | null | "unavailable";
  monitoringEnabled: boolean | "unavailable";
}

export type GreetingTone = "normal" | "warning" | "alarm" | "muted";

export interface GreetingLine {
  kind: "today" | "unsaved" | "monitoring-off" | "fail" | "never" | "missing" | "before";
  text: string;
  tone: GreetingTone;
  /** "digest" = tapping opens the stored digest's Briefing; null = nothing to open. */
  opens: "digest" | null;
}

export function buildGreetingLine(input: GreetingInput): GreetingLine {
  const { digest, now } = input;
  const dispatcher =
    input.dispatcher !== "unavailable" && input.dispatcher !== null && input.dispatcher.skipped ? null : input.dispatcher;
  const today = todayKey(now);

  if (digest === "unavailable") return { kind: "fail", text: "I couldn’t load the briefing.", tone: "warning", opens: null };
  if (digest !== null && dayKey(digest.sentAt, APP_TZ) === today) {
    const problems = digest.briefing !== null && digest.briefing.stories.length > 0;
    return { kind: "today", text: toPage(digest.title), tone: problems ? "warning" : "normal", opens: "digest" };
  }
  if (dispatcher !== "unavailable" && dispatcher !== null && dispatcher.ok && dayKey(dispatcher.startedAt, APP_TZ) === today) {
    return { kind: "unsaved", text: "A briefing went out, but I couldn’t save it.", tone: "warning", opens: null };
  }
  if (input.monitoringEnabled === false) {
    return {
      kind: "monitoring-off",
      text: "Monitoring is off, so there’s no morning briefing.",
      tone: "muted",
      opens: digest === null ? null : "digest",
    };
  }
  if (dispatcher === "unavailable") return { kind: "fail", text: "I couldn’t load the briefing.", tone: "warning", opens: null };
  if (digest === null) return { kind: "never", text: "No briefing yet.", tone: "muted", opens: null };

  const pastExpected = Number(clockHHMM(now, APP_TZ).slice(0, 2)) >= PUSH_EXPECTED_HOUR;
  return pastExpected
    ? { kind: "missing", text: "No briefing this morning. The 07:00 run didn’t happen.", tone: "alarm", opens: "digest" }
    : { kind: "before", text: "Your briefing comes at 07:00.", tone: "muted", opens: "digest" };
}

// ---- The Briefing ------------------------------------------------------------

export interface Segment {
  text: string;
  bold: boolean;
}

/** Text split by bold ranges, curled for the page. Bad or overlapping ranges are skipped. */
export function segments(text: string, bold: readonly StoredBold[]): Segment[] {
  const page = toPage(text);
  const ranges = [...bold].sort((a, z) => a.start - z.start);
  const out: Segment[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start < at || r.end > page.length || r.start >= r.end) continue;
    if (r.start > at) out.push({ text: page.slice(at, r.start), bold: false });
    out.push({ text: page.slice(r.start, r.end), bold: true });
    at = r.end;
  }
  if (at < page.length) out.push({ text: page.slice(at), bold: false });
  return out;
}

export interface SymptomView {
  /** `${story}.${symptom}` — stable within one Briefing, for keys and the card. */
  id: string;
  sentence: Segment[];
  nextStep: string;
  causeHeading: "Likely cause" | "Cause";
  cause: Segment[];
  /** Quoted evidence, NOT curled. */
  raw: string | null;
}

export interface StoryView {
  id: string;
  sentence: Segment[];
  symptoms: SymptomView[];
}

interface ViewBase {
  /** "This morning" · "Yesterday" · "Last: Sun 9 Aug" */
  label: string;
  /** "07:00" — sentAt in APP_TZ, never the cron's hour. */
  stamp: string;
  title: string;
  isToday: boolean;
  /** Sent back by the client to the seen door and the since door. */
  sentAtIso: string;
  seen: boolean;
}

export type BriefingView =
  | (ViewBase & { kind: "full"; stories: StoryView[]; today: string; freelance: string | null; off: string | null })
  | (ViewBase & { kind: "quote"; body: string });

function storyViews(b: StoredBriefing): StoryView[] {
  return b.stories.map((s, i) => ({
    id: String(i),
    sentence: segments(s.sentence, s.bold),
    symptoms: s.symptoms.map((m, j) => ({
      id: `${i}.${j}`,
      sentence: segments(m.sentence, m.bold),
      nextStep: toPage(m.nextStep),
      causeHeading: m.causeKey === "unrecognised" || m.causeKey === "none" ? "Cause" : "Likely cause",
      cause: segments(m.cause, m.causeBold),
      raw: m.raw,
    })),
  }));
}

export function buildBriefingView(digest: StoredDigest, now: Date): BriefingView {
  const today = todayKey(now);
  const sent = dayKey(digest.sentAt, APP_TZ);
  const label = sent === today ? "This morning" : sent === addDays(today, -1) ? "Yesterday" : `Last: ${formatDay(sent)}`;
  const base: ViewBase = {
    label,
    stamp: clockHHMM(digest.sentAt, APP_TZ),
    title: toPage(digest.title),
    isToday: sent === today,
    sentAtIso: digest.sentAt.toISOString(),
    seen: digest.seenAt !== null,
  };
  if (digest.briefing === null) return { ...base, kind: "quote", body: toPage(digest.body) };
  const b = digest.briefing;
  return {
    ...base,
    kind: "full",
    stories: storyViews(b),
    today: toPage(b.today),
    freelance: b.freelance === null ? null : toPage(b.freelance),
    off: b.off === null ? null : toPage(b.off),
  };
}

/** The full-screen greeting: today's Briefing, not yet seen on any device (spec §5.2, V10). */
export function shouldAutoOpen(digest: StoredDigest | null | "unavailable", now: Date): boolean {
  if (digest === null || digest === "unavailable") return false;
  return dayKey(digest.sentAt, APP_TZ) === todayKey(now) && digest.seenAt === null;
}

/** The doors' one input: an ISO instant, not more than a minute in the future. */
export function parseSentAt(value: unknown, now: Date): Date | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 40) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value)) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() > now.getTime() + 60_000) return null;
  return d;
}
```

**Check the `formatDay` label against the test:** `formatDay("2026-08-09")` is `"Sun 9 Aug"` (the P10 tests pin that format), so `OLD_PUSH` (sent 2026-08-08T23:00Z = 07:00 on the 9th in Manila) labels `Last: Sun 9 Aug`. ✓

**Check the title test:** `"All clear · 0 to review"` contains a `·` (U+00B7), not an apostrophe. toPage leaves it alone, and the test writes it as `·`. ✓

- [ ] **Step 4: Write `src/lib/dispatcherRun.ts`** — `readDispatcher` moved verbatim from `src/app/(app)/personal/page.tsx` (lines 172–188 today, with its docblock), renamed `readLatestDispatcher`, returning `GreetingInput["dispatcher"]` minus `"unavailable"`:

```ts
/**
 * dispatcherRun.ts — the dispatcher's newest run, as the greeting line needs it.
 * Moved from the Personal page (P10c) when the push tile retired (S21).
 * Callers must have connectDB()'d already.
 *
 * `skipped` and `error` are projected, which watchdog's fetchLatestRuns does
 * not select. A row with a `skipped` key says so itself; only a row WITHOUT the
 * key (written before the field) falls back to `ok && error`.
 */
import AgentRun from "@/models/AgentRun";
import type { GreetingInput } from "@/lib/briefingView";

export type LatestDispatcher = Exclude<GreetingInput["dispatcher"], "unavailable">;

export async function readLatestDispatcher(): Promise<LatestDispatcher> {
  const doc = await AgentRun.findOne({ agent: "dispatcher" })
    .sort({ startedAt: -1 })
    .select({ ok: 1, startedAt: 1, skipped: 1, error: 1 })
    .lean<{ ok: boolean; startedAt: Date; skipped?: boolean; error?: string }>();
  if (!doc) return null;
  const skipped = typeof doc.skipped === "boolean" ? doc.skipped : doc.ok === true && typeof doc.error === "string";
  return { ok: doc.ok, startedAt: doc.startedAt, skipped };
}
```

(Leave the page's own copy in place until B5 deletes it, so this commit builds.)

- [ ] **Step 5: Add `import "@/lib/briefingView";`** to `viewModelPurity.test.ts` beside `import "@/lib/personalView";`.

- [ ] **Step 6: Run** `npx vitest run src/lib/__tests__/briefingView.test.ts src/lib/__tests__/viewModelPurity.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/briefingView.ts src/lib/dispatcherRun.ts src/lib/__tests__/briefingView.test.ts src/lib/__tests__/viewModelPurity.test.ts
git commit -m "feat(briefing): the greeting line's states, the Briefing view model and the once-a-day rule"
```

---

### Task B2: "Since then" (Since-Then Writer)

**Files:** Create `src/lib/sinceThen.ts` (pure), `src/lib/sinceThenRead.ts` (reads), `src/lib/__tests__/sinceThen.test.ts`. Add `import "@/lib/sinceThen";` to `viewModelPurity.test.ts`.

- [ ] **Step 1: Write the failing test** `src/lib/__tests__/sinceThen.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sinceThenLines, type SinceThenInput } from "@/lib/sinceThen";

const SENT = new Date("2026-09-09T23:00:00Z"); // 07:00 Manila
const NOW = new Date("2026-09-10T06:30:00Z"); // 14:30 Manila
const at = (hhmm: string) => new Date(`2026-09-10T${hhmm}:00+08:00`);

const NOTHING: SinceThenInput = {
  ticked: { titles: [], total: 0 },
  newDue: { titles: [], total: 0 },
  events: [],
  newDrafts: 0,
};

describe("sinceThenLines", () => {
  it("says so plainly when nothing has changed", () => {
    expect(sinceThenLines(NOTHING, SENT, NOW)).toEqual(["Nothing new since 07:00."]);
  });

  it("names one ticked to-do, counts several", () => {
    expect(sinceThenLines({ ...NOTHING, ticked: { titles: ["Essay draft"], total: 1 } }, SENT, NOW)).toEqual([
      "You’ve ticked off Essay draft.",
    ]);
    expect(sinceThenLines({ ...NOTHING, ticked: { titles: ["a", "b", "c"], total: 3 } }, SENT, NOW)).toEqual([
      "You’ve ticked off three to-dos.",
    ]);
  });

  it("names a new to-do due today, counts several", () => {
    expect(sinceThenLines({ ...NOTHING, newDue: { titles: ["Renew the domain"], total: 1 } }, SENT, NOW)).toEqual([
      "One new to-do is due today: Renew the domain.",
    ]);
    expect(sinceThenLines({ ...NOTHING, newDue: { titles: ["a", "b"], total: 2 } }, SENT, NOW)).toEqual([
      "Two new to-dos are due today.",
    ]);
  });

  it("tells the day so far: what's done and what's next", () => {
    const events = [
      { title: "Math Methods", allDay: false, startsAt: at("09:00"), endsAt: at("10:30") },
      { title: "Gym", allDay: false, startsAt: at("18:00"), endsAt: at("19:00") },
      { title: "Foundation Day", allDay: true, startsAt: null, endsAt: null },
    ];
    expect(sinceThenLines({ ...NOTHING, events }, SENT, NOW)).toEqual(["Math Methods is done.", "Next up: Gym at 18:00."]);
  });

  it("says nothing else is on once the last timed event is past", () => {
    const events = [
      { title: "A", allDay: false, startsAt: at("09:00"), endsAt: at("10:00") },
      { title: "B", allDay: false, startsAt: at("11:00"), endsAt: at("12:00") },
    ];
    expect(sinceThenLines({ ...NOTHING, events }, SENT, NOW)).toEqual([
      "Two things on your calendar are done.",
      "Nothing else on today.",
    ]);
  });

  it("does not call an event in progress done", () => {
    const events = [{ title: "Long one", allDay: false, startsAt: at("14:00"), endsAt: at("16:00") }];
    expect(sinceThenLines({ ...NOTHING, events }, SENT, NOW)).toEqual(["Nothing new since 07:00."]);
  });

  it("counts new drafts in the queue", () => {
    expect(sinceThenLines({ ...NOTHING, newDrafts: 1 }, SENT, NOW)).toEqual(["One new draft is waiting for your review."]);
    expect(sinceThenLines({ ...NOTHING, newDrafts: 2 }, SENT, NOW)).toEqual(["Two new drafts are waiting for your review."]);
  });

  it("says each failed read on its own and still shows the rest", () => {
    expect(
      sinceThenLines(
        { ticked: "unavailable", newDue: "unavailable", events: "unavailable", newDrafts: 2 },
        SENT,
        NOW,
      ),
    ).toEqual([
      "I couldn’t check your to-dos just now.",
      "I couldn’t check your calendar just now.",
      "Two new drafts are waiting for your review.",
    ]);
    expect(sinceThenLines({ ...NOTHING, newDrafts: "unavailable" }, SENT, NOW)).toEqual([
      "I couldn’t check the queue just now.",
    ]);
  });

  it("says nothing about the calendar when every layer is off", () => {
    expect(sinceThenLines({ ...NOTHING, events: "none-enabled" }, SENT, NOW)).toEqual(["Nothing new since 07:00."]);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Write `src/lib/sinceThen.ts`**

```ts
/**
 * sinceThen.ts — the Briefing's live "since then" (S21, spec §6). Pure.
 *
 * Built only from fast, cheap reads: to-dos, today's calendar, the queue.
 * Sites, agents and ShikksTracker are deliberately NOT re-checked, so the
 * Briefing never says a problem is fixed without checking it again.
 *
 * Each part fails on its own, with its own honest line; one failed read never
 * hides the others. Page text: curly apostrophes.
 */

import { APP_TZ } from "@/lib/constants";
import { clockHHMM } from "@/lib/days";
import { capWord, numberWord } from "@/lib/voice";

export interface SinceEvent {
  title: string;
  allDay: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

export interface SinceThenInput {
  /** Done since sentAt: the newest few titles and the store's count. */
  ticked: { titles: string[]; total: number } | "unavailable";
  /** Open, due today, created since sentAt. */
  newDue: { titles: string[]; total: number } | "unavailable";
  /** Today's events on the switched-on layers. */
  events: SinceEvent[] | "unavailable" | "none-enabled";
  /** Pending drafts created since sentAt. */
  newDrafts: number | "unavailable";
}

/** The most lines the section shows; the door bounds its response with it. */
export const SINCE_THEN_MAX_LINES = 6;

export function sinceThenLines(input: SinceThenInput, sentAt: Date, now: Date, tz: string = APP_TZ): string[] {
  const lines: string[] = [];

  if (input.ticked === "unavailable" || input.newDue === "unavailable") {
    lines.push("I couldn’t check your to-dos just now.");
  }
  if (input.ticked !== "unavailable" && input.ticked.total > 0) {
    lines.push(
      input.ticked.total === 1 && input.ticked.titles.length === 1
        ? `You’ve ticked off ${input.ticked.titles[0]}.`
        : `You’ve ticked off ${numberWord(input.ticked.total)} to-dos.`,
    );
  }
  if (input.newDue !== "unavailable" && input.newDue.total > 0) {
    lines.push(
      input.newDue.total === 1 && input.newDue.titles.length === 1
        ? `One new to-do is due today: ${input.newDue.titles[0]}.`
        : `${capWord(numberWord(input.newDue.total))} new to-dos are due today.`,
    );
  }

  if (input.events === "unavailable") {
    lines.push("I couldn’t check your calendar just now.");
  } else if (input.events !== "none-enabled") {
    const timed = input.events
      .filter((e) => !e.allDay && e.startsAt !== null && e.endsAt !== null)
      .sort((a, z) => a.startsAt!.getTime() - z.startsAt!.getTime());
    const done = timed.filter((e) => e.endsAt!.getTime() <= now.getTime() && e.endsAt!.getTime() > sentAt.getTime());
    const next = timed.find((e) => e.startsAt!.getTime() > now.getTime());
    if (done.length === 1) lines.push(`${done[0].title} is done.`);
    if (done.length > 1) lines.push(`${capWord(numberWord(done.length))} things on your calendar are done.`);
    if (next) lines.push(`Next up: ${next.title} at ${clockHHMM(next.startsAt!, tz)}.`);
    else if (done.length > 0) lines.push("Nothing else on today.");
  }

  if (input.newDrafts === "unavailable") {
    lines.push("I couldn’t check the queue just now.");
  } else if (input.newDrafts > 0) {
    lines.push(
      input.newDrafts === 1
        ? "One new draft is waiting for your review."
        : `${capWord(numberWord(input.newDrafts))} new drafts are waiting for your review.`,
    );
  }

  if (lines.length === 0) return [`Nothing new since ${clockHHMM(sentAt, tz)}.`];
  return lines.map((l) => l.replace(/'/g, "’")).slice(0, SINCE_THEN_MAX_LINES);
}
```

**Check the "event in progress" test:** "Long one" runs 14:00–16:00 and now is 14:30, so it isn't done and has no future start. The next line is skipped and, with no done events, so is "Nothing else on today". The result is `["Nothing new since 07:00."]`. ✓ An event that ended before 07:00 isn't "since then", hence the `> sentAt` guard.

- [ ] **Step 4: Write `src/lib/sinceThenRead.ts`**

```ts
/**
 * sinceThenRead.ts — the reads behind "since then" (S21, spec §6). Impure.
 * Every read is bounded (MONGO_READ_TIMEOUT_MS; Google's own per-layer
 * timeout inside readCalendarWindow) and settled on its own, so one slow or
 * failed read never costs the others. Read-only: settings through
 * readOsSettings, never the upserting accessor (R37).
 *
 * Index use (no index change, spec §7.1):
 *   ticked   { done: 1, doneAt: -1 }
 *   newDue   { done: 1, dueOn: 1 }
 *   drafts   ApprovalItem { status: 1, createdAt: -1 }
 */

import { connectDB } from "@/lib/db";
import { MONGO_READ_TIMEOUT_MS, withDeadline } from "@/lib/deadline";
import { dayStart, todayKey } from "@/lib/days";
import { readCalendarWindow } from "@/lib/google";
import { readOsSettings } from "@/lib/osSettings";
import Todo from "@/models/Todo";
import ApprovalItem from "@/models/ApprovalItem";
import type { SinceThenInput } from "@/lib/sinceThen";

const TITLES = 3;

export async function readSinceThen(sentAt: Date, now: Date): Promise<SinceThenInput> {
  const today = todayKey(now);
  const connected = connectDB();
  const bounded = <T,>(read: () => Promise<T>, label: string) =>
    withDeadline(connected.then(read), MONGO_READ_TIMEOUT_MS, `since-then ${label}`);

  const [ticked, newDue, drafts, settings] = await Promise.allSettled([
    bounded(async () => {
      const filter = { done: true, doneAt: { $gte: sentAt } };
      const [rows, total] = await Promise.all([
        Todo.find(filter, { title: 1 }).sort({ doneAt: -1 }).limit(TITLES).lean<Array<{ title: string }>>(),
        Todo.countDocuments(filter),
      ]);
      return { titles: rows.map((r) => r.title), total };
    }, "ticked"),
    bounded(async () => {
      const filter = { done: false, dueOn: dayStart(today), createdAt: { $gt: sentAt } };
      const [rows, total] = await Promise.all([
        Todo.find(filter, { title: 1 }).sort({ createdAt: 1 }).limit(TITLES).lean<Array<{ title: string }>>(),
        Todo.countDocuments(filter),
      ]);
      return { titles: rows.map((r) => r.title), total };
    }, "new due"),
    bounded(() => ApprovalItem.countDocuments({ status: "pending", createdAt: { $gt: sentAt } }), "drafts"),
    bounded(readOsSettings, "settings"),
  ]);

  const log = (label: string, r: PromiseSettledResult<unknown>) => {
    if (r.status === "rejected") console.error(`[since-then] ${label} failed:`, r.reason);
  };
  log("ticked", ticked);
  log("new due", newDue);
  log("drafts", drafts);
  log("settings", settings);

  let events: SinceThenInput["events"] = "unavailable";
  if (settings.status === "fulfilled") {
    try {
      const window = await readCalendarWindow(settings.value.layers, today, today);
      if (!window.ok) events = window.reason === "none-enabled" ? "none-enabled" : "unavailable";
      else if (window.failed.length > 0 && window.events.length === 0) events = "unavailable";
      else
        events = window.events
          .filter((e) => e.dayKey === today)
          .map((e) => ({ title: e.title, allDay: e.allDay, startsAt: e.startsAt, endsAt: e.endsAt }));
    } catch (err) {
      console.error("[since-then] calendar failed:", err);
    }
  }

  return {
    ticked: ticked.status === "fulfilled" ? ticked.value : "unavailable",
    newDue: newDue.status === "fulfilled" ? newDue.value : "unavailable",
    newDrafts: drafts.status === "fulfilled" ? drafts.value : "unavailable",
    events,
  };
}
```

- [ ] **Step 5: Run** `npx vitest run src/lib/__tests__/sinceThen.test.ts src/lib/__tests__/viewModelPurity.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sinceThen.ts src/lib/sinceThenRead.ts src/lib/__tests__/sinceThen.test.ts src/lib/__tests__/viewModelPurity.test.ts
git commit -m "feat(briefing): since then - to-dos, today's calendar and the queue, each failing on its own"
```

---

### Task B3: The two doors (Door Keeper)

**Files:** Create `src/app/api/briefing/seen/route.ts`, `src/app/api/briefing/since/route.ts`. Both are session-gated by `src/proxy.ts`'s fail-closed default and by `requireSession` as their first line. **No public-allowlist change.**

- [ ] **Step 1: Write `src/app/api/briefing/seen/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { parseSentAt } from "@/lib/briefingView";
import { markBriefingSeen } from "@/lib/lastDigest";

/**
 * POST /api/briefing/seen — { sentAt } of the Briefing whose full-screen
 * greeting was dismissed (S21, spec §5.2). One guarded atomic update: only
 * that morning's record, only while unseen. A stale sentAt applies nothing and
 * is still `ok` — the client has nothing to do about it. A failure only means
 * the greeting may show once more; the client never blocks on this door.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-sent-at" }, { status: 400 });
  }
  const now = new Date();
  const sentAt = parseSentAt((body as { sentAt?: unknown } | null)?.sentAt, now);
  if (sentAt === null) return NextResponse.json({ error: "bad-sent-at" }, { status: 400 });

  try {
    await connectDB();
    const applied = await markBriefingSeen(sentAt, now);
    return NextResponse.json({ ok: true, applied });
  } catch (err) {
    console.error("[briefing/seen] write failed:", err);
    return NextResponse.json({ error: "save-failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write `src/app/api/briefing/since/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { parseSentAt } from "@/lib/briefingView";
import { sinceThenLines } from "@/lib/sinceThen";
import { readSinceThen } from "@/lib/sinceThenRead";

/**
 * GET /api/briefing/since?sentAt=… — the Briefing's live "since then" lines
 * (S21, spec §6), fetched when the Briefing opens so they are fresh on every
 * open (the shell layout is not re-rendered on soft navigation). Bounded:
 * at most SINCE_THEN_MAX_LINES lines. Every read inside fails on its own into
 * an honest line, so this door answers 200 unless its input is bad.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  const now = new Date();
  const sentAt = parseSentAt(request.nextUrl.searchParams.get("sentAt"), now);
  if (sentAt === null) return NextResponse.json({ error: "bad-sent-at" }, { status: 400 });

  const input = await readSinceThen(sentAt, now);
  return NextResponse.json(
    { lines: sinceThenLines(input, sentAt, now) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
```

- [ ] **Step 3: Verify the proxy covers both.** Read `src/proxy.ts`'s matcher and allowlist, and confirm `/api/briefing/*` is NOT in the public allowlist (it must be session-gated). Add a case to `src/lib/__tests__/proxy.test.ts` asserting an unauthenticated request to `/api/briefing/seen` is rejected, mirroring the file's existing pattern for `/api/todos`.

- [ ] **Step 4: Run** `npx vitest run src/lib/__tests__/proxy.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/briefing src/lib/__tests__/proxy.test.ts
git commit -m "feat(briefing): the seen door (one guarded update) and the since-then door"
```

---

### Task B4: The shell — greeting line, full-screen greeting, panel, cause card (Shell Builder)

**Files:** Create `src/app/(app)/_shell/BriefingSlot.tsx` (server), `src/app/(app)/_shell/Briefing.tsx` (client), `src/app/(app)/_shell/flip.ts` (client util), `src/styles/briefing.css`. Modify `src/app/(app)/_shell/TopBar.tsx`, `src/app/(app)/layout.tsx`, `src/app/layout.tsx` (one CSS import), `src/styles/components.css` (TopBar comment + `.crumb` push-right).

**Lint baseline:** the four existing `react-hooks/set-state-in-effect` errors must stay four. This island never calls a state setter synchronously in an effect body: open/close state changes in event handlers, the initial open comes from `useState`'s initialiser, effects only call DOM methods (`showModal`, `animate`, `history.replaceState`), and the since-then fetch sets state only in its async `.then`.

- [ ] **Step 1: Write `src/app/(app)/_shell/flip.ts`**

```ts
/**
 * flip.ts — the Briefing's grow/shrink (S21, spec §5.4): an element grows out
 * of the rectangle it came from and shrinks back into it. First-Last-Invert-
 * Play with the Web Animations API, which base.css's reduced-motion rule does
 * not reach, so reduced motion is honoured here: a plain fade, no scaling.
 */

const GROW_MS = 220;
const FADE_MS = 120;
const EASE = "cubic-bezier(.2,.8,.2,1)";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function invert(el: HTMLElement, from: DOMRect): string {
  const to = el.getBoundingClientRect();
  if (to.width === 0 || to.height === 0) return "none";
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const sx = Math.max(from.width / to.width, 0.05);
  const sy = Math.max(from.height / to.height, 0.05);
  return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
}

/** Grows `el` out of `from` (or fades it in when there is no origin). */
export function growFrom(el: HTMLElement, from: DOMRect | null): void {
  if (typeof el.animate !== "function") return;
  if (from === null || prefersReducedMotion()) {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "ease-out" });
    return;
  }
  el.animate([{ transform: invert(el, from), opacity: 0.4 }, { transform: "none", opacity: 1 }], {
    duration: GROW_MS,
    easing: EASE,
  });
}

/** Shrinks `el` into `to` (or fades it out). Resolves when done; never rejects. */
export async function shrinkTo(el: HTMLElement, to: DOMRect | null): Promise<void> {
  if (typeof el.animate !== "function") return;
  const anim =
    to === null || prefersReducedMotion()
      ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: "ease-in", fill: "forwards" })
      : el.animate([{ transform: "none", opacity: 1 }, { transform: invert(el, to), opacity: 0.2 }], {
          duration: GROW_MS,
          easing: EASE,
          fill: "forwards",
        });
  try {
    await anim.finished;
  } catch {
    // cancelled — closing anyway
  }
  anim.cancel();
}
```

- [ ] **Step 2: Write `src/app/(app)/_shell/Briefing.tsx`** — the one client island:

```tsx
"use client";

/**
 * Briefing — the assistant's greeting line, the full-screen greeting, the
 * panel and the cause card (S21, spec §5). One island in the shell.
 *
 * Native <dialog> + showModal() gives the focus trap, Esc, and an inert page
 * behind it for free; Esc (`cancel`) and a backdrop click are routed through
 * close() so the shrink animation always runs. Focus returns to the line.
 *
 * STATE: `open` changes only in handlers; the first value comes from the
 * initialiser (today's unseen Briefing, or ?briefing=open from the push).
 * Effects only touch the DOM. "Since then" is fetched on every open and set
 * only in the fetch's async callback (the lint baseline holds).
 */

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PRESS_TIMEOUT_MS } from "@/lib/constants";
import type { BriefingView, GreetingLine, Segment, SymptomView } from "@/lib/briefingView";
import { growFrom, shrinkTo } from "./flip";

type Open = null | "full" | "panel";
type Since = { kind: "loading" } | { kind: "lines"; lines: string[] } | { kind: "failed" };

function Said({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))}
    </>
  );
}

export default function Briefing({
  line,
  view,
  autoOpen,
}: {
  line: GreetingLine;
  view: BriefingView | null;
  autoOpen: boolean;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const forced = params.get("briefing") === "open";
  const canOpen = line.opens === "digest" && view !== null;
  const [open, setOpen] = useState<Open>(() => (canOpen && (forced || autoOpen) ? "full" : null));
  const [since, setSince] = useState<Since>({ kind: "loading" });
  const [card, setCard] = useState<SymptomView | null>(null);
  const lineRef = useRef<HTMLButtonElement>(null);
  const dlgRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDialogElement>(null);
  const cardFrom = useRef<HTMLButtonElement | null>(null);
  const seenSent = useRef(false);
  const titleId = useId();
  const cardTitleId = useId();

  // DOM only: show the dialog when state says so, grown from the line.
  useEffect(() => {
    const dlg = dlgRef.current;
    if (!dlg || open === null || dlg.open) return;
    dlg.showModal();
    growFrom(dlg, open === "panel" ? (lineRef.current?.getBoundingClientRect() ?? null) : null);
  }, [open]);

  useEffect(() => {
    const c = cardRef.current;
    if (!c || card === null || c.open) return;
    c.showModal();
    growFrom(c, cardFrom.current?.getBoundingClientRect() ?? null);
  }, [card]);

  // The push's ?briefing=open has done its job once the state is initialised.
  useEffect(() => {
    if (!forced) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("briefing");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [forced, pathname]);

  // Since then: fetched on every open of today's Briefing; state set only async.
  useEffect(() => {
    if (open === null || view === null || !view.isToday) return;
    let live = true;
    fetch(`/api/briefing/since?sentAt=${encodeURIComponent(view.sentAtIso)}`, {
      signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { lines?: unknown }) => {
        if (!live) return;
        const lines = Array.isArray(body.lines) ? body.lines.filter((l): l is string => typeof l === "string") : null;
        setSince(lines === null ? { kind: "failed" } : { kind: "lines", lines });
      })
      .catch(() => {
        if (live) setSince({ kind: "failed" });
      });
    return () => {
      live = false;
    };
  }, [open, view]);

  function openPanel() {
    if (!canOpen) return;
    setSince({ kind: "loading" });
    setOpen("panel");
  }

  async function close() {
    const dlg = dlgRef.current;
    if (!dlg || !dlg.open) return;
    const wasFull = open === "full";
    await shrinkTo(dlg, lineRef.current?.getBoundingClientRect() ?? null);
    dlg.close();
    setOpen(null);
    lineRef.current?.focus();
    if (wasFull && view !== null && view.isToday && !view.seen && !seenSent.current) {
      seenSent.current = true;
      // Fire and forget: a failure only means it may greet once more (spec §5.2).
      void fetch("/api/briefing/seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentAt: view.sentAtIso }),
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }).catch(() => {});
    }
  }

  function openCard(e: MouseEvent<HTMLButtonElement>, symptom: SymptomView) {
    cardFrom.current = e.currentTarget;
    setCard(symptom);
  }

  async function closeCard() {
    const c = cardRef.current;
    if (!c || !c.open) return;
    await shrinkTo(c, cardFrom.current?.getBoundingClientRect() ?? null);
    c.close();
    setCard(null);
    cardFrom.current?.focus();
  }

  const onBackdrop = (handler: () => void) => (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) handler();
  };

  return (
    <>
      <button
        ref={lineRef}
        type="button"
        className={`bf-line is-${line.tone}`}
        onClick={openPanel}
        disabled={!canOpen}
        aria-haspopup={canOpen ? "dialog" : undefined}
      >
        <i aria-hidden="true" />
        <span>{line.text}</span>
      </button>

      {view !== null && (
        <dialog
          ref={dlgRef}
          className={`bf-dialog ${open === "full" ? "is-full" : "is-panel"}`}
          aria-labelledby={titleId}
          onCancel={(e) => {
            e.preventDefault();
            void close();
          }}
          onClick={onBackdrop(() => void close())}
        >
          <div className="bf-in">
            <header className="bf-head">
              <p className="bf-when">
                {view.label} · {view.stamp}
              </p>
              <h2 id={titleId} className="bf-title">
                {view.title}
              </h2>
              <button type="button" className="bf-x" aria-label="Close" onClick={() => void close()}>
                ✕
              </button>
            </header>

            {view.kind === "full" ? (
              <>
                {view.stories.length > 0 && (
                  <section className="bf-sec">
                    <h3 className="bf-h">As of {view.stamp}</h3>
                    <ul className="bf-stories">
                      {view.stories.map((story) =>
                        story.symptoms.length === 1 ? (
                          <li key={story.id}>
                            <button type="button" className="bf-row" onClick={(e) => openCard(e, story.symptoms[0])}>
                              <span className="bf-said">
                                <Said segments={story.sentence} />
                              </span>
                              <span className="bf-next">{story.symptoms[0].nextStep}</span>
                            </button>
                          </li>
                        ) : (
                          <li key={story.id}>
                            <p className="bf-story">
                              <Said segments={story.sentence} />
                            </p>
                            <ul className="bf-symptoms">
                              {story.symptoms.map((s) => (
                                <li key={s.id}>
                                  <button type="button" className="bf-row" onClick={(e) => openCard(e, s)}>
                                    <span className="bf-said">
                                      <Said segments={s.sentence} />
                                    </span>
                                    <span className="bf-next">{s.nextStep}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ),
                      )}
                    </ul>
                  </section>
                )}
                <section className="bf-sec">
                  <h3 className="bf-h">The day, as of {view.stamp}</h3>
                  {view.today !== "" && <p className="bf-p">{view.today}</p>}
                  {view.freelance !== null && <p className="bf-p">{view.freelance}</p>}
                  {view.off !== null && <p className="bf-p">{view.off}</p>}
                </section>
              </>
            ) : (
              <section className="bf-sec">
                <p className="bf-p bf-quote">{view.body}</p>
              </section>
            )}

            {view.isToday && (
              <section className="bf-sec" aria-live="polite">
                <h3 className="bf-h">Since {view.stamp}</h3>
                {since.kind === "loading" && <p className="bf-p bf-wait">Checking…</p>}
                {since.kind === "failed" && <p className="bf-p">I couldn’t check what’s changed just now.</p>}
                {since.kind === "lines" && since.lines.map((l, i) => <p key={i} className="bf-p">{l}</p>)}
              </section>
            )}

            {open === "full" && (
              <div className="bf-foot">
                <button type="button" className="bf-got" onClick={() => void close()}>
                  Got it
                </button>
              </div>
            )}
          </div>
        </dialog>
      )}

      <dialog
        ref={cardRef}
        className="bf-card"
        aria-labelledby={cardTitleId}
        onCancel={(e) => {
          e.preventDefault();
          void closeCard();
        }}
        onClick={onBackdrop(() => void closeCard())}
      >
        {card !== null && (
          <div className="bf-in">
            <h3 id={cardTitleId} className="bf-h">
              {card.causeHeading}
            </h3>
            <p className="bf-p">
              <Said segments={card.cause} />
            </p>
            <h3 className="bf-h">What to do</h3>
            <p className="bf-p">{card.nextStep}</p>
            {card.raw !== null && (
              <>
                <h3 className="bf-h">Raw error</h3>
                <pre className="bf-raw">{card.raw}</pre>
              </>
            )}
            <div className="bf-foot">
              <button type="button" className="bf-got" onClick={() => void closeCard()}>
                Close
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
```

**The `since` "Checking…" placeholder must hold its height.** `.bf-wait` reserves a two-line minimum height (CSS below), so the section doesn't jump when the lines arrive (spec §6).

- [ ] **Step 3: Write `src/app/(app)/_shell/BriefingSlot.tsx`** (server):

```tsx
import { Suspense } from "react";
import { connectDB } from "@/lib/db";
import { MONGO_READ_TIMEOUT_MS, withDeadline } from "@/lib/deadline";
import { getLastDigest, type StoredDigest } from "@/lib/lastDigest";
import { readOsSettings } from "@/lib/osSettings";
import { readLatestDispatcher } from "@/lib/dispatcherRun";
import {
  buildBriefingView,
  buildGreetingLine,
  shouldAutoOpen,
  type GreetingInput,
} from "@/lib/briefingView";
import Briefing from "./Briefing";

/**
 * The greeting line's server half (S21, spec §5.1). Three read-only reads,
 * each bounded and settled on its own — the rail's discipline (R37: settings
 * through readOsSettings, never the upsert; R55: getLastDigest never writes).
 * A failure becomes the line's honest "couldn't load" state; the page always
 * renders. Suspense keeps the reads off the shell's critical path.
 */
export default function BriefingSlot() {
  return (
    <Suspense fallback={<span className="bf-line is-loading" aria-hidden="true" />}>
      <BriefingRead />
    </Suspense>
  );
}

function settled<T>(r: PromiseSettledResult<T>, label: string): T | "unavailable" {
  if (r.status === "fulfilled") return r.value;
  console.error(`[briefing] ${label} failed:`, r.reason);
  return "unavailable";
}

async function BriefingRead() {
  const now = new Date();
  const connected = connectDB();
  const bounded = <T,>(read: () => Promise<T>, label: string) =>
    withDeadline(connected.then(read), MONGO_READ_TIMEOUT_MS, `briefing ${label}`);
  const [digestR, dispatcherR, settingsR] = await Promise.allSettled([
    bounded(getLastDigest, "last-digest read"),
    bounded(readLatestDispatcher, "dispatcher read"),
    bounded(readOsSettings, "settings read"),
  ]);
  const digest: StoredDigest | null | "unavailable" = settled(digestR, "last-digest read");
  const settings = settled(settingsR, "settings read");
  const input: GreetingInput = {
    now,
    digest,
    dispatcher: settled(dispatcherR, "dispatcher read"),
    monitoringEnabled: settings === "unavailable" ? "unavailable" : settings.monitoringEnabled,
  };
  const line = buildGreetingLine(input);
  const view = digest === null || digest === "unavailable" ? null : buildBriefingView(digest, now);

  // useSearchParams (inside Briefing) needs its own boundary.
  return (
    <Suspense
      fallback={
        <span className={`bf-line is-${line.tone}`}>
          <i aria-hidden="true" />
          <span>{line.text}</span>
        </span>
      }
    >
      <Briefing line={line} view={view} autoOpen={shouldAutoOpen(digest, now)} />
    </Suspense>
  );
}
```

- [ ] **Step 4: TopBar takes the line.** In `TopBar.tsx`, change the signature to `export default function TopBar({ greeting }: { greeting?: ReactNode })` (import `type ReactNode` from "react") and render `<div className="topbar-in">{greeting}<span className="crumb">…</span></div>`. Replace the docblock's first paragraph with: `44px, one hairline bottom, and two elements: the assistant's greeting line (S21 — the one deliberate addition, which supersedes "exactly one element") and the freshness stamp.` Keep the rest of the docblock (the reasons there's no breadcrumb, pill, bell or search all still hold).

In `src/app/(app)/layout.tsx`: `import BriefingSlot from "./_shell/BriefingSlot";` and render `<TopBar greeting={<BriefingSlot />} />`.

In `components.css`, change `.crumb` to add `margin-left:auto;white-space:nowrap` and update the `.topbar` comment's first sentence to `the top bar carries the greeting line (S21) and the freshness stamp, and nothing else.`

- [ ] **Step 5: Write `src/styles/briefing.css`** and import it in `src/app/layout.tsx` directly after `personal.css` (before `legacy.css`, which loads last as before).

```css
/* ============================================================
   briefing.css — the assistant's Briefing (S21, spec §5).
   Tokens only; no new hue, no new @media (components.css records the
   phone strip as the app's last one — the panel is one shape at every
   width, plan B deviation 1). Every button sets text-transform:none
   against legacy.css's bare `button{uppercase}` (L1e).
   ============================================================ */

/* ---- the greeting line, in the 44px top bar ---------------------------- */
.bf-line{
  display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto;
  background:none;border:0;padding:0;margin:0;font:inherit;text-transform:none;letter-spacing:normal;
  font-size:12.5px;color:var(--ink-2);text-align:left;cursor:pointer;
}
.bf-line:disabled{cursor:default}
.bf-line span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bf-line i{flex:0 0 5px;width:5px;height:5px;border-radius:50%;background:var(--ink-4)}
.bf-line.is-normal i{background:var(--save)}
.bf-line.is-warning{color:var(--stale)} .bf-line.is-warning i{background:var(--stale)}
.bf-line.is-alarm{color:var(--missing)} .bf-line.is-alarm i{background:var(--missing)}
.bf-line.is-muted{color:var(--ink-3)}
.bf-line.is-loading{min-height:1em}
.bf-line:not(:disabled):hover span{color:var(--ink)}
.bf-line:focus-visible{outline:2px solid var(--session);outline-offset:4px;border-radius:var(--r-tag)}

/* ---- the two dialogs ----------------------------------------------------- */
.bf-dialog,.bf-card{
  padding:0;border:1px solid var(--line);background:var(--raised);color:var(--ink);
  border-radius:var(--r-feature);max-height:calc(100dvh - 32px);overflow:auto;
}
.bf-dialog::backdrop,.bf-card::backdrop{background:rgba(5,6,8,.72)}
.bf-dialog.is-full{width:min(640px, 100vw - 32px);margin:auto}
.bf-dialog.is-panel{
  width:min(480px, 100vw - 32px);height:calc(100dvh - 32px);
  margin:16px 16px 16px auto;
}
.bf-card{width:min(420px, 100vw - 32px);margin:auto}
.bf-in{padding:var(--sp-5);display:grid;gap:var(--sp-4)}
.bf-head{display:grid;grid-template-columns:1fr auto;gap:4px var(--sp-3);align-items:start}
.bf-when{grid-column:1;font-size:11px;color:var(--ink-3);font-variant-numeric:tabular-nums;margin:0}
.bf-title{grid-column:1;font-family:var(--display);font-size:20px;line-height:1.25;margin:0;overflow-wrap:anywhere}
.bf-x{
  grid-column:2;grid-row:1 / span 2;background:none;border:1px solid var(--line);border-radius:var(--r-chip);
  color:var(--ink-2);font:inherit;text-transform:none;width:44px;height:44px;cursor:pointer;
}
.bf-x:hover{color:var(--ink)}
.bf-sec{display:grid;gap:var(--sp-2)}
.bf-h{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);margin:0;font-weight:500}
.bf-p{margin:0;font-size:14px;line-height:1.5;color:var(--ink-2);overflow-wrap:anywhere}
.bf-p strong,.bf-said strong,.bf-story strong{color:var(--ink);font-weight:650}
.bf-wait{min-height:3em;color:var(--ink-3)}
.bf-quote{white-space:pre-wrap}
.bf-stories,.bf-symptoms{list-style:none;margin:0;padding:0;display:grid;gap:var(--sp-2)}
.bf-symptoms{padding-left:var(--sp-4);border-left:1px solid var(--line);margin-top:var(--sp-2)}
.bf-story{margin:0;font-size:14px;line-height:1.5;color:var(--ink-2)}
.bf-row{
  display:grid;gap:2px;width:100%;text-align:left;cursor:pointer;
  background:var(--panel);border:1px solid var(--line-soft);border-radius:var(--r-card);
  padding:var(--sp-3) var(--sp-4);font:inherit;text-transform:none;letter-spacing:normal;color:var(--ink-2);
  min-height:44px;
}
.bf-row:hover{border-color:var(--line)}
.bf-row:focus-visible,.bf-got:focus-visible,.bf-x:focus-visible{outline:2px solid var(--session);outline-offset:2px}
.bf-said{font-size:14px;line-height:1.45}
.bf-next{font-size:12.5px;color:var(--ink-3)}
.bf-raw{
  margin:0;font-family:var(--mono);font-size:11.5px;line-height:1.5;color:var(--ink-2);
  background:var(--sunk);border:1px solid var(--line-soft);border-radius:var(--r-chip);
  padding:var(--sp-3);white-space:pre-wrap;overflow-wrap:anywhere;max-height:40vh;overflow:auto;
}
.bf-foot{display:flex;justify-content:flex-end}
.bf-got{
  font:inherit;text-transform:none;letter-spacing:normal;font-weight:600;font-size:13px;
  background:var(--ink);color:var(--void);border:0;border-radius:var(--r-pill);
  padding:0 var(--sp-5);min-height:44px;cursor:pointer;
}
```

**Phone strip check (S20):** below 439px the rail becomes a 44px top strip, and `.topbar` still renders under it, so the greeting line sits in its own 44px bar and truncates with an ellipsis. The Verification Lead measures this at 390px (B7).

- [ ] **Step 6: Verify.** `npx tsc --noEmit` → clean. `npm run lint` → still exactly 4 errors / 3 warnings. `npm run build` → green.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/_shell" "src/app/(app)/layout.tsx" src/app/layout.tsx src/styles/briefing.css src/styles/components.css
git commit -m "feat(briefing): the greeting line, the once-a-day full-screen greeting, the panel and the cause card"
```

---

### Task B5: Retire the push tile without losing Riku's arrangement (Tile Retirer)

**Files:** Modify `src/lib/personalLayout.ts`, `src/lib/personalView.ts`, `src/app/(app)/personal/page.tsx`, `src/styles/personal.css`; delete `src/app/(app)/personal/_blocks/Push.tsx`; update `src/lib/__tests__/{layout,layoutEdit,settings,osSettings,personalView}.test.ts`.

- [ ] **Step 1: Write the failing tests** in `layout.test.ts`:

```ts
import { PERSONAL_LAYOUT_DEFAULT, PERSONAL_TILES, resolvePersonalLayout, validateLayout } from "@/lib/personalLayout";

describe("the retired push tile (S21)", () => {
  // Riku's real stored shape before S21: the default with push in row 2.
  const BEFORE_S21 = [
    [{ tile: "today", span: 8 }, { tile: "todos", span: 4 }],
    [{ tile: "layers", span: 3 }, { tile: "push", span: 8 }],
    [{ tile: "week", span: 12 }],
    [{ tile: "done", span: 12 }],
  ];

  it("drops push on read and keeps every other placement, without falling back", () => {
    const { layout, fellBack } = resolvePersonalLayout(BEFORE_S21);
    expect(fellBack).toBe(false);
    expect(layout).toEqual([
      [{ tile: "today", span: 8 }, { tile: "todos", span: 4 }],
      [{ tile: "layers", span: 3 }],
      [{ tile: "week", span: 12 }],
      [{ tile: "done", span: 12 }],
    ]);
  });

  it("still rejects push on write", () => {
    expect(validateLayout(BEFORE_S21)).toMatchObject({ ok: false });
  });

  it("has five tiles and Layers alone on row 2 by default", () => {
    expect([...PERSONAL_TILES]).toEqual(["today", "todos", "layers", "week", "done"]);
    expect(PERSONAL_LAYOUT_DEFAULT[1]).toEqual([{ tile: "layers", span: 12 }]);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement in `personalLayout.ts`:**

```ts
export const PERSONAL_TILES = ["today", "todos", "layers", "week", "done"] as const;

/**
 * Tiles that existed and were retired. A stored layout may still name one, so
 * the READ path drops it before parsing and keeps every other placement;
 * without this, parseLayout's "unknown tile" would discard Riku's whole
 * arrangement for the default (S21 retired "push"). The WRITE path stays
 * strict and rejects it.
 */
export const RETIRED_TILES: readonly string[] = ["push"];

function dropRetired(stored: unknown): unknown {
  if (!Array.isArray(stored)) return stored;
  return stored.map((row) =>
    Array.isArray(row)
      ? row.filter((e) => !(typeof e === "object" && e !== null && RETIRED_TILES.includes((e as { tile?: unknown }).tile as string)))
      : row,
  );
}
```

with `PERSONAL_LAYOUT_DEFAULT` row 2 becoming `[{ tile: "layers", span: 12 }]`, and `resolvePersonalLayout` becoming `return resolveLayoutAgainst(dropRetired(stored), PERSONAL_TILES, PERSONAL_LAYOUT_DEFAULT);`. Keep `resolveLayoutAgainst` generic and unchanged.

- [ ] **Step 4: Update the other tests.** Rules for the builder:
  - Tests of `resolveLayoutAgainst` that pass their **own** tile list (`TILES7` etc.) may keep `"push"` as an arbitrary tile name. Leave them.
  - Every test that goes through `PERSONAL_TILES`, `validateLayout`, `resolvePersonalLayout`, `PERSONAL_LAYOUT_DEFAULT`, `buildCells` on the default, or `layoutEdit`'s helpers on the default must be rewritten for five tiles. Replace a `push` entry by giving its span to its row neighbour, or by deleting the entry where the test is about a count. Re-derive every expected class and caption from the code, not by editing numbers until green, and say in the commit body which assertions changed meaning.
  - `layoutEdit.test.ts`'s `can("push")` case is deleted. The `isDefaultLayout(applyEdit(D, "push", "narrow"))` case becomes `"layers", "narrow"`.
  - `settings.test.ts:66` and `osSettings.test.ts:118` fixtures drop the `push` entry (give `layers` the row: `span: 12`).

- [ ] **Step 5: Remove the tile from the page.** In `src/app/(app)/personal/page.tsx`: delete the `Push` import, `buildPushTileView`/`PushInput` imports, `getLastDigest`/`StoredDigest` imports, `AgentRun` import, the `Dispatcher` type and `readDispatcher`, the `digestR`/`dispatcherR` reads (phase 1 becomes three reads: settings, open, done), `pushTile`, and `push: <Push … />` from `tiles`. Update the phase-1 comment ("All five reads" → "All three reads"; drop the LastDigest sentence). Delete `src/app/(app)/personal/_blocks/Push.tsx`.

  In `src/lib/personalView.ts`: delete section 5 (`buildPushTileView` and its docblock), `PushTileView`, `PushInput`, and the now-unused imports (`StoredDigest`, and `PUSH_EXPECTED_HOUR` if nothing else uses it — check with grep). In `personalView.test.ts`, delete the `// --- Push ---` block (lines ~729–834 today) and its `buildPushTileView`/`PushInput` imports. Its cases now live in `briefingView.test.ts`.

  In `src/styles/personal.css`: delete `.pe-ptitle`, the `.pe-ptitle + .fl-snip` rule and its comment, `.pe-last`, and `.pe-quote` (around lines 391–410 today; read the block and delete exactly the push tile's rules, nothing shared).

- [ ] **Step 6: Run** `grep -rn "push" src/app/\(app\)/personal src/lib/personalLayout.ts src/lib/personalView.ts` → only unrelated hits (e.g. `.push(` array calls). Then `npm test && npx tsc --noEmit` → PASS.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/personalLayout.ts src/lib/personalView.ts "src/app/(app)/personal" src/styles/personal.css src/lib/__tests__
git commit -m "feat(personal): retire the push tile; a saved layout that names it keeps everything else"
```

---

### Task B6: The Personal page's calendar messages, in the voice (Copy Editor)

**Files:** Modify `src/lib/personalErrors.ts`, `src/app/(app)/personal/TodoForm.tsx`, `src/app/(app)/personal/TodoRow.tsx`, `src/app/(app)/personal/EventForm.tsx`. Create `src/lib/__tests__/calendarMessages.test.ts`.

- [ ] **Step 1: Write the failing test** `src/lib/__tests__/calendarMessages.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CALENDAR_FAIL, CALENDAR_FAIL_CAUSES, ENTRY_LEFT, PIN_UNSURE, calendarLine, eventFailSentence } from "@/lib/personalErrors";

const ALL = [...Object.values(CALENDAR_FAIL).flatMap((t) => Object.values(t)), ...Object.values(ENTRY_LEFT), PIN_UNSURE];

describe("the calendar messages (S21, spec §7.4)", () => {
  it("has a sentence for every action and every cause", () => {
    for (const action of ["event", "pin", "move"] as const) {
      for (const cause of CALENDAR_FAIL_CAUSES) expect(CALENDAR_FAIL[action][cause].length).toBeGreaterThan(0);
    }
  });

  it("speaks in whole sentences: no old frames, curly apostrophes only, never 'Done' after a delete", () => {
    for (const s of ALL) {
      expect(s).not.toMatch(/Google didn’t accept it:|calendar entry failed:|couldn’t be moved:/);
      expect(s).not.toMatch(/'/);
      expect(s).toMatch(/[.]$/);
    }
    expect(ENTRY_LEFT.delete.startsWith("Deleted.")).toBe(true);
    expect(ENTRY_LEFT.done.startsWith("Done.")).toBe(true);
    expect(ENTRY_LEFT.unpin).not.toMatch(/^Done/);
  });

  it("uses the approved wording", () => {
    expect(CALENDAR_FAIL.event.expired).toBe("I couldn’t add that. My access to Google has expired. You can renew it in Settings.");
    expect(CALENDAR_FAIL.pin.changed).toBe(
      "Saved, but the to-do changed somewhere else while I was adding it, so I left it off the calendar.",
    );
    expect(CALENDAR_FAIL.move.gone).toBe("Saved the new date. Its calendar entry had already been deleted in Google, so I’ve unlinked it.");
  });

  it("calendarLine picks the sentence for each leg", () => {
    expect(calendarLine("pin", { kind: "failed", cause: "refused", orphaned: false })).toEqual({
      text: "Saved, but Google wouldn’t take the calendar entry.",
      dot: "stale",
    });
    expect(calendarLine("pin", { kind: "failed", cause: "refused", orphaned: true })).toEqual({ text: PIN_UNSURE, dot: "stale" });
    expect(calendarLine("pin", { kind: "unknown", orphaned: true })).toEqual({ text: PIN_UNSURE, dot: "stale" });
    expect(calendarLine("move", { kind: "failed", cause: "expired", orphaned: false })?.text).toBe(
      "Saved the new date, but I couldn’t move the calendar entry. My Google access has expired.",
    );
    expect(calendarLine("move", { kind: "unknown", orphaned: false })).toEqual({ text: "Couldn’t tell if that saved.", dot: null });
    expect(calendarLine("unpin", { kind: "failed", cause: "refused", orphaned: false })).toEqual({ text: ENTRY_LEFT.unpin, dot: "stale" });
    expect(calendarLine("delete", { kind: "unknown", orphaned: true })).toEqual({ text: ENTRY_LEFT.delete, dot: "stale" });
    expect(calendarLine("pin", { kind: "ok" })).toBeNull();
    expect(calendarLine("move", { kind: "none" })).toBeNull();
    expect(calendarLine("unpin", null)).toEqual({ text: ENTRY_LEFT.unpin, dot: "stale" });
  });

  it("eventFailSentence reads the event table", () => {
    expect(eventFailSentence("gone")).toBe("I couldn’t add that. That calendar isn’t on your Google account anymore.");
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement in `personalErrors.ts`** (still **no runtime import**: only `export type`/`import type`). Replace `ENTRY_LEFT_SENTENCE` and add:

```ts
import type { CalendarFailCause, CalendarOutcome } from "@/lib/todoStore";
import type { SayLine } from "@/lib/personalView";

/** Every cause the doors can answer — the client checks a cause against this before trusting it. */
export const CALENDAR_FAIL_CAUSES = ["not-configured", "expired", "refused", "gone", "changed", "store"] as const satisfies readonly CalendarFailCause[];

/**
 * S21 (spec §7.4): the calendar messages as whole sentences per action and
 * cause, approved by Riku 2026-10-09. Replaces deck §7's frame-plus-reason
 * shape and the nine PROVISIONAL (P10c) reasons. Every pair is filled, the
 * ones the server can't produce today with honest generic sentences (plan B
 * deviation 5), so the client never meets a gap.
 */
export const CALENDAR_FAIL: Readonly<Record<"event" | "pin" | "move", Readonly<Record<CalendarFailCause, string>>>> = Object.freeze({
  event: Object.freeze({
    "not-configured": "I couldn’t add that. Google isn’t connected yet. You can set it up in Settings.",
    expired: "I couldn’t add that. My access to Google has expired. You can renew it in Settings.",
    refused: "Google turned that one down, so it’s not on your calendar.",
    gone: "I couldn’t add that. That calendar isn’t on your Google account anymore.",
    changed: "I couldn’t add that, and I’m not sure why. Have a look in Google Calendar.",
    store: "I couldn’t add that, and I’m not sure why. Have a look in Google Calendar.",
  }),
  pin: Object.freeze({
    "not-configured": "Saved, but I couldn’t put it on your calendar. Google isn’t connected yet.",
    expired: "Saved, but I couldn’t put it on your calendar. My Google access has expired.",
    refused: "Saved, but Google wouldn’t take the calendar entry.",
    gone: "Saved, but I couldn’t find your main calendar on Google, so it’s not on there.",
    changed: "Saved, but the to-do changed somewhere else while I was adding it, so I left it off the calendar.",
    store: "Saved, but I couldn’t keep track of the calendar entry, so I took it back off.",
  }),
  move: Object.freeze({
    "not-configured": "Saved the new date, but I couldn’t move the calendar entry. Google isn’t connected yet.",
    expired: "Saved the new date, but I couldn’t move the calendar entry. My Google access has expired.",
    refused: "Saved the new date, but Google wouldn’t move the calendar entry.",
    gone: "Saved the new date. Its calendar entry had already been deleted in Google, so I’ve unlinked it.",
    changed: "Saved the new date, but I couldn’t move the calendar entry.",
    store: "Saved the new date, but I couldn’t move the calendar entry.",
  }),
});

/** A pin that may have left an entry on Google that nothing points at. */
export const PIN_UNSURE =
  "Saved. I’m not sure whether the calendar entry went through, so have a look in Google Calendar before switching it on again.";

/** An entry that couldn't be removed, worded for what Riku actually did (R49's dot: --stale). */
export const ENTRY_LEFT = Object.freeze({
  done: "Done. I couldn’t remove its calendar entry, though, so you’ll want to delete it in Google Calendar.",
  delete: "Deleted. I couldn’t remove its calendar entry, though, so you’ll want to delete it in Google Calendar.",
  unpin: "Taken off the calendar here, but I couldn’t remove the entry in Google. You’ll want to delete it there.",
} as const);

export type CalendarLeg = "pin" | "move" | "unpin" | "delete";

/**
 * What a calendar leg that didn't finish says under the tile's head (moved
 * here from TodoForm so it is testable; same rules as before). The to-do's own
 * write landed, so nothing here says the save failed. An outcome the door
 * didn't spell out (null) is treated as unknown.
 */
export function calendarLine(leg: CalendarLeg, outcome: CalendarOutcome | null): SayLine | null {
  if (outcome !== null && (outcome.kind === "none" || outcome.kind === "ok")) return null;
  const c: CalendarOutcome = outcome ?? { kind: "unknown", orphaned: false };
  switch (leg) {
    case "unpin":
    case "delete":
      return { text: ENTRY_LEFT[leg], dot: "stale" };
    case "pin":
      return c.kind === "failed" && !c.orphaned ? { text: CALENDAR_FAIL.pin[c.cause], dot: "stale" } : { text: PIN_UNSURE, dot: "stale" };
    case "move":
      return c.kind === "failed"
        ? { text: CALENDAR_FAIL.move[c.cause], dot: "stale" }
        : { text: ERROR_SENTENCES["calendar-unknown"], dot: null };
  }
}

export function eventFailSentence(cause: CalendarFailCause): string {
  return CALENDAR_FAIL.event[cause];
}
```

**Purity check:** `SayLine` is imported with `import type` from personalView.ts (erased), and `CalendarOutcome`/`CalendarFailCause` likewise from todoStore.ts. The existing `export type { CalendarOutcome } from "@/lib/todoStore";` line stays. `viewModelPurity.test.ts` must still pass: it greps for runtime imports.

- [ ] **Step 4: Rewire the three islands.**
  - **TodoForm.tsx:** delete `CalendarFailCause` type alias, `ReasonFor`, `CALENDAR_REASONS`, `calendarReason`, `PIN_MAYBE_MADE`, the local `Leg` type and the local `calendarLine`. Import `CALENDAR_FAIL_CAUSES, calendarLine, type CalendarLeg` from `@/lib/personalErrors`. In `calendarOf`, replace `Object.hasOwn(CALENDAR_REASONS, cause)` with `(CALENDAR_FAIL_CAUSES as readonly string[]).includes(cause)` and keep the cast to the cause type (import `type CalendarFailCause` from `@/lib/todoStore` via `import type`). The save path's `leg` variable becomes `CalendarLeg | null` (values unchanged: "pin" | "move" | "unpin"). In `remove()`, `calendarLine("unpin", …)` becomes `calendarLine("delete", …)`. Remove `ENTRY_LEFT_SENTENCE` from its imports.
  - **TodoRow.tsx:** `import { ENTRY_LEFT } from "@/lib/personalErrors";` and `page.note("done", { text: ENTRY_LEFT.done, dot: "stale" })`.
  - **EventForm.tsx:** replace `` `Google didn’t accept it: ${calendarReason(cal.cause, "event")}.` `` with `eventFailSentence(cal.cause)` (imported from `@/lib/personalErrors`) and drop the `calendarReason` import. Keep the `// deck §7` comment, amended to `// S21, spec §7.4`.
  - `grep -rn "PROVISIONAL (P10c)" src` → no output.

- [ ] **Step 5: Run** `npm test && npx tsc --noEmit && npm run lint` → PASS, lint at baseline.

- [ ] **Step 6: Commit**

```bash
git add src/lib/personalErrors.ts "src/app/(app)/personal/TodoForm.tsx" "src/app/(app)/personal/TodoRow.tsx" "src/app/(app)/personal/EventForm.tsx" src/lib/__tests__/calendarMessages.test.ts
git commit -m "feat(personal): calendar messages as whole sentences in the assistant's voice"
```

---

### Task B7: Principal review, verification, record (Principal Reviewer, Verification Lead)

- [ ] **Step 1: Principal cross-module review** across Plan A and Plan B together. Brief: "Read spec §5–§7, then `briefingView.ts`, `sinceThen*.ts`, both doors, `BriefingSlot.tsx`, `Briefing.tsx`, `flip.ts`, `briefing.css`, `personalLayout.ts`, `personalErrors.ts` and Plan A's `lastDigest.ts`. Look for seams: the seen door marking the wrong morning; auto-open firing on a non-today record; `?briefing=open` opening when there is nothing to open; a Said range broken by curling; a dialog that can't be closed by keyboard; focus not returning; a setState in an effect body (lint baseline); a page where the line pushes the stamp out of a 390px bar; the since door leaking an error message; the layout read falling back for a stored `push`. Report; don't edit."

- [ ] **Step 2: The trio + lint baseline** — `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run lint` (4 errors / 3 warnings, exit 1; anything more fails).

- [ ] **Step 3: Verification Lead — headless Chromium against `next start -p 3021`, with every write intercepted.** Route-intercept `POST /api/briefing/seen` (record the body, answer `{ok:true, applied:true}`), `GET /api/briefing/since` (answer fixtures, including a 500 and a hang past the timeout), and every `/api/todos*`, `/api/calendar/*` and `/api/settings` mutation (abort them). Serve the shell's reads from a **seeded local MongoDB or an in-memory fixture, never Riku's Atlas.** If neither is available, verify with the Briefing component rendered in a test harness page under `/__verify` that is deleted before the commit, and say so in the record. Measure and record:
  1. Every greeting-line state renders its text, tone colour and dot (8 states).
  2. First visit with an unseen today's Briefing: the full-screen greeting opens. "Got it", Esc and a backdrop click each close it with the shrink animation (assert `Element.animate` was called with a transform keyframe), focus lands on the line, and exactly one seen POST was sent with the right `sentAt`. A reload with `seenAt` set does not open it.
  3. `/freelance?briefing=open` opens it even when seen, and the address bar loses the parameter.
  4. Tapping the line opens the panel. Tapping a problem row grows the card from that row. Esc closes the card first, then the panel. An unrecognised cause shows `Cause` and the raw error in monospace, uncurled.
  5. `prefers-reduced-motion: reduce` (emulated): only opacity keyframes are used.
  6. At 390px and 320px wide: no horizontal page scroll, the line truncates in one line, the panel fits with 16px margins, and every button's computed `text-transform` is `none`.
  7. "Since then": loading placeholder height is unchanged when lines arrive (layout shift 0 for the section); a 500 shows `I couldn’t check what’s changed just now.`
  8. `/personal` renders five tiles. A settings fixture whose `personalLayout` contains `push` renders without the "Couldn’t load your arrangement" notice and with Layers where it was.
  9. Calendar messages: drive the to-do and event forms against intercepted doors returning each `calendar` outcome, and assert the sentence under the tile head matches §7.4.

- [ ] **Step 4: Post-build record** at the foot of this file: commits, test count, deviations taken, findings and fixes, measurements, and **Riku's hands:**
  - [ ] Push master (two plans' commits).
  - [ ] The first 07:00 push after deploy arrives in the new voice. Tap it, and the Briefing opens full-screen.
  - [ ] On a second device the same day, it does **not** greet full-screen again. The line is there.
  - [ ] Tap a problem (if the morning has one) and the cause card grows out of it.
  - [ ] The Personal page shows five tiles with your arrangement intact.
  - [ ] P10's four dated observations, still owed from the go-live checklist (the push-tile one is now "the Briefing quoting the push").
