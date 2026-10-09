# Briefing A — The voice, the problem catalogue and the saved briefing: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 07:00 push speaks in the assistant voice (greeting + read on the day, problems as plain-word stories, a human Today/freelance/off line), and every morning also saves the full structured Briefing (stories, symptoms, next steps, causes, raw errors, unrecognised count, `seenAt`) that Plan B renders. **No JSX. Nothing renders that didn't before** — the Personal page's push tile keeps quoting `title`/`body` until Plan B removes it.

**Architecture:** Five pure modules carry every word: `voice.ts` (greeting pools, deterministic line choice, bold ranges, apostrophes), `problems.ts` (structured `Problem` union + `buildProblems`, moved out of `digest.ts`), `causes.ts` (the catalogue: sentence, next step, cause, raw-error rules, the `explainCause` seam), `stories.ts` (grouping co-occurring problems), and `digest.ts` (budgeted push text + `buildBriefing`). The impure boundary is unchanged in shape: `digestToday.ts` (reads), `lastDigest.ts` (the singleton's read/write/mark-seen), and the morning route (wires, sends, saves). The briefing is built **after** the push is sent and inside a catch, so a briefing bug can never cost the push.

**Tech Stack:** Next.js 16 App Router · TypeScript `strict` · Mongoose 9 · Vitest 4. **No new dependency. No index change. No migration script.**

**Spec:** `docs/superpowers/specs/2026-10-09-briefing-assistant-voice-design.md` (ratified by Riku 2026-10-09). Where this plan refines the spec, the refinement is listed in "Deviations from the spec" and is binding.

---

## How this is built (the P10 method — Riku's call, 2026-10-09)

The lead session decides and orchestrates; it does not write code. One **builder subagent per task** with the named role below, then a **spec + quality reviewer per commit**, fix rounds back to the same builder. Disjoint-file tasks may run in parallel **only** where the table says so, and parallel builders never run `next build` (one owner of `.next` at a time). After the last task: a **principal cross-module review** (it caught real seam bugs in P10b and P10c — budget for it), then the **Verification Lead**, then the post-build record at the foot of this file.

| Task | Role | Files (exclusive while running) | Parallel with |
|---|---|---|---|
| A0 | Decision Clerk | `ARCHITECTURE.md` | A1 |
| A1 | Voice Writer | `src/lib/voice.ts`, its test | A0, A2 |
| A2 | Signal Plumber | `src/lib/siteHealth.ts`, `src/lib/watchdog.ts`, `src/lib/outreachHealth.ts`, their tests | A1 |
| A3 | Problem Clerk | `src/lib/briefingTypes.ts`, `src/lib/problems.ts`, test; `src/lib/digest.ts` (removal only) | — (after A2) |
| A4 | Catalogue Writer | `src/lib/causes.ts`, test | A5 cannot start |
| A5 | Story Teller | `src/lib/stories.ts`, test | — (after A4) |
| A6 | Push Composer | `src/lib/digest.ts`, `src/lib/digestToday.ts`, `digest.test.ts` | — (after A5) |
| A7 | Data Steward | `src/models/LastDigest.ts`, `src/lib/lastDigest.ts`, `lastDigest.test.ts`, `models.test.ts` | A6 |
| A8 | Route Wirer | `src/app/api/cron/morning/route.ts` | — (after A6, A7) |
| A9 | Verification Lead | none (reads, runs) | — |

**Environment lessons (from P10c, still true):** subagents may hit the account usage limit — resume with SendMessage and check `git status` first (uncommitted work is theirs). Never use git worktrees with a junction to `node_modules`. Ports 3000/3001/3011 are other servers; use 3021–3023. One `next start` at a time (~2 GB free). On a phone hotspot DNS, Atlas SRV fails — DNS must be 8.8.8.8/1.1.1.1.

**Agents must NOT write to Riku's database or calendar, and must NOT send a push.** Every route check is by unit test or with the network intercepted. The real-data observation is Riku's, at 07:00.

---

## Deviations from the spec (binding)

1. **Sunday's opener is `Easy Sunday, Riku.`**, not `Easy morning, Riku.` Saturday and Sunday are consecutive days, and two identical openers in a row would break the spec's own "never the same opener two days running" rule (§3.1, §3.3).
2. **`Problem` is a discriminated union**, not `{key, subject, raw, facts}`. Same information, but the compiler forbids a `site-status` without a status. §4.1's intent, stricter shape.
3. **Joining unrelated stories uses sentences**: `Meowchi's site isn't answering (error 503). Separately, the chaser failed on its last run.` The third and later stories start with `Also, `. The spec's `, and separately, ` form needs every story to be one clause, but catalogue sentences are full sentences with their own periods. Lower-casing a story's first word is done only for words the voice itself wrote (`The `, `I `-stays, number words) and never for a name.
4. **The `calendar expired + partial` chain is dropped.** `composeDigest` makes `calendar-unavailable` and `calendar-partial` mutually exclusive (a window either answered for some layers or for none), so the chain is unreachable. A test pins the exclusivity instead.
5. **Wording refinements that keep meaning but avoid claims the data can't back:** `agent-stale` says `hasn't run in 31 hours` (not "since yesterday morning", which needs the clock); `agent-failed` says `failed on its last run` (not "last night": the chaser's run isn't at night); the Today line reads `Coming up: …` / `Running late: …` instead of `Due:` / `Overdue:`.
6. **The stored symptom also carries `causeBold`** (bold ranges inside the cause sentence), so the cause card can bold its key words (spec §5.4 asks for it; §7.1 left the field out).
7. **`composeDigest` and `buildBriefing` are two functions** sharing private helpers, so the route can build the briefing after the send inside its own catch (spec §7.2's "the push still goes out").

---

## File map

| File | Change |
|---|---|
| `ARCHITECTURE.md` | §7 gains S21 (spec §9 text). §3.1's data list gains LastDigest's new fields. |
| `src/lib/voice.ts` | **New.** `Said`, `say`, `b`, `capFirst`, `lowerLead`, `joinSaid`, `numberWord`, `capWord`, `toPage`, `weekday`, `pickLine`, `opener`, `readOnTheDay`, `greeting`. |
| `src/lib/briefingTypes.ts` | **New, import-free.** `PROBLEM_KEYS`, `CAUSE_KEYS`, bounds, `StoredBriefing` and friends. The model imports its enums from here. |
| `src/lib/problems.ts` | **New.** `Problem` union, `AGENT_NAMES`, `MorningOutcomes`, `buildProblems` (moved from digest.ts and re-typed). |
| `src/lib/causes.ts` | **New.** `matchRaw`, `explainCause`, `explain` (the §4.2 table). |
| `src/lib/stories.ts` | **New.** `Story`, `groupProblems`. |
| `src/lib/digest.ts` | **Rewritten top half.** `composeDigest` → `{title, body}`, new `buildBriefing`. Today sentence re-voiced, its budget machinery kept. `calendarForDigest` also returns `calendarCause`. `buildProblems`/`MorningOutcomes` removed (now in problems.ts). |
| `src/lib/digestToday.ts` | Passes `calendarCause` through, including from its own catch. |
| `src/lib/siteHealth.ts` | `SiteResult` gains `failure` and `status`. |
| `src/lib/watchdog.ts` | `Anomaly` gains `ageHours` / `itemsFailed`. |
| `src/lib/outreachHealth.ts` | `OutreachFinding` gains `ageMs` / `count`. |
| `src/models/LastDigest.ts` | Optional `briefing` (typed sub-schemas) and `seenAt`. |
| `src/lib/lastDigest.ts` | `StoredDigest` gains `briefing` and `seenAt`. `saveLastDigest` takes the briefing and resets `seenAt`. New `markBriefingSeen`. |
| `src/app/api/cron/morning/route.ts` | Keeps the attention error, builds the briefing after the send, push `url` → `/freelance?briefing=open`. |
| tests | New: `voice`, `problems`, `causes`, `stories`. Rewritten: `digest`, `buildProblems` → folded into `problems`. Extended: `lastDigest`, `models`, `siteHealth`, `watchdog`, `outreachHealth`. |

---

### Task A0: Record S21 (Decision Clerk)

**Files:** Modify `ARCHITECTURE.md` (§3.1 data list; §7 after S20).

- [ ] **Step 1: Append S21 to §7**, directly after the S20 entry, verbatim from spec §9 (the blockquote, without the `>` markers), starting `- **S21 — The morning push speaks in an assistant's voice, and the Briefing replaces the push tile.**`, and then one more sentence: `Design: docs/superpowers/specs/2026-10-09-briefing-assistant-voice-design.md. Plans: docs/superpowers/plans/2026-10-09-briefing-a-voice-and-data.md, …-briefing-b-on-the-site.md.`

- [ ] **Step 2: In §3.1**, find the `LastDigest` line (if §3.1 lacks one — the P10c record notes it may — add it after HealthSnapshot's line) and make it read: `LastDigest — singleton (fixed _id "latest"), the last morning push: sentAt, title, body, devices, and since S21 the structured briefing (stories → symptoms with next step, cause, raw error) and seenAt (once-a-day full-screen greeting, reset by each morning's write). No TTL.`

- [ ] **Step 3: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs(arch): S21 - the morning push speaks in an assistant's voice; the Briefing replaces the push tile"
```

---

### Task A1: `voice.ts` — the greeting, line choice and bold text (Voice Writer)

**Files:** Create `src/lib/voice.ts`, `src/lib/__tests__/voice.test.ts`.

- [ ] **Step 1: Write the failing test** `src/lib/__tests__/voice.test.ts`:

```ts
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
        expect(t.length).toBeLessThanOrEqual(80);
        expect(t).toMatch(/^\S.*\. \S.*\.$/);
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/__tests__/voice.test.ts`
Expected: FAIL — `Cannot find module '@/lib/voice'`.

- [ ] **Step 3: Write `src/lib/voice.ts`**

```ts
/**
 * voice.ts — how the assistant talks (S21). Pure: no clock, no I/O.
 *
 * The voice is composed and friendly, speaks to Riku by name and never says
 * "sir" (spec §2). Every line here is written in advance, so every one is
 * tested; nothing is generated at runtime.
 *
 * TEXT IS PUSH-FORM. Strings here use straight apostrophes, which is what the
 * push must carry. Page text curls them with toPage() at render time (L10).
 * Bold is carried as character ranges beside the text (`Said`), never as
 * markup, so the push gets the plain text and the page can bold it.
 *
 * LINE CHOICE IS DETERMINISTIC (spec §3.3). pickLine walks a pool by a step
 * that is never a multiple of the pool's size, so two consecutive days can
 * never land on the same line, and the same morning always yields the same
 * text, which is what lets the page show exactly what the phone got.
 */

import type { DayKey } from "@/lib/days";

export interface BoldRange {
  start: number;
  end: number;
}

/** A sentence and the ranges of it the page shows in bold. */
export interface Said {
  text: string;
  bold: BoldRange[];
}

export type Seg = string | { b: string };

/** A bold segment, for say(). */
export function b(text: string): { b: string } {
  return { b: text };
}

/** Joins segments into one Said, recording each bold segment's range. */
export function say(...segs: Seg[]): Said {
  let text = "";
  const bold: BoldRange[] = [];
  for (const s of segs) {
    if (typeof s === "string") {
      text += s;
    } else {
      bold.push({ start: text.length, end: text.length + s.b.length });
      text += s.b;
    }
  }
  return { text, bold };
}

/** The first letter up. Ranges are unaffected: the length does not change. */
export function capFirst(s: Said): Said {
  return { text: s.text.charAt(0).toUpperCase() + s.text.slice(1), bold: s.bold };
}

/**
 * Lowers the first letter only when the sentence opens with a word the voice
 * itself wrote: `The …`, or a capitalised number word. `I` stays `I`, and a
 * name (`Meowchi's site`, `ShikksTracker's sender`) is never touched.
 */
const OWN_LEADS = /^(The|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten) /;
export function lowerLead(s: Said): Said {
  if (!OWN_LEADS.test(s.text)) return s;
  return { text: s.text.charAt(0).toLowerCase() + s.text.slice(1), bold: s.bold };
}

/** Joins sentences with `sep`, shifting every later sentence's ranges. */
export function joinSaid(parts: Said[], sep: string): Said {
  let text = "";
  const bold: BoldRange[] = [];
  parts.forEach((p, i) => {
    if (i > 0) text += sep;
    const at = text.length;
    for (const r of p.bold) bold.push({ start: r.start + at, end: r.end + at });
    text += p.text;
  });
  return { text, bold };
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"] as const;

/** 0–10 as words, anything else as digits. */
export function numberWord(n: number): string {
  return Number.isInteger(n) && n >= 0 && n <= 10 ? WORDS[n] : String(n);
}

export function capWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Page text: straight apostrophes curled (L10). Never applied to a raw error. */
export function toPage(text: string): string {
  return text.replace(/'/g, "’");
}

function dayNumber(key: DayKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday, for an APP_TZ day key. */
export function weekday(key: DayKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function saltHash(salt: string): number {
  let h = 0;
  for (const ch of salt) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * One line of `pool` for `day`. index(d) = (d × step + offset) mod n, with
 * step in 1..n−1: consecutive days differ by `step`, which is never 0 mod n,
 * so a line never repeats on consecutive days. The salt varies the step and
 * offset per pool, so two pools don't move in lockstep.
 */
export function pickLine<T>(pool: readonly T[], day: DayKey, salt: string): T {
  if (pool.length === 0) throw new Error("pickLine: empty pool");
  if (pool.length === 1) return pool[0];
  const n = pool.length;
  const h = saltHash(salt);
  const step = 1 + (h % (n - 1));
  const idx = (((dayNumber(day) * step + h) % n) + n) % n;
  return pool[idx];
}

export const ANY_DAY_OPENERS = [
  "Morning, Riku.",
  "Good morning, Riku.",
  "Riku, good morning.",
  "Morning. Here's your day, Riku.",
  "Up and at it, Riku.",
  "Hey Riku, morning.",
] as const;

/**
 * Monday, Friday, Saturday and Sunday have their own opener. Sunday's is not
 * Saturday's, so the weekend doesn't repeat itself (plan deviation 1).
 */
export function opener(day: DayKey): string {
  switch (weekday(day)) {
    case 1:
      return "New week, Riku.";
    case 5:
      return "Last push of the week, Riku.";
    case 6:
      return "Easy morning, Riku.";
    case 0:
      return "Easy Sunday, Riku.";
    default:
      return pickLine(ANY_DAY_OPENERS, day, "opener");
  }
}

export type Mood =
  | { kind: "problems"; stories: number }
  | { kind: "busy" }
  | { kind: "quiet" }
  | { kind: "ordinary" };

/** The read on the day. Problems always outrank the mood (R23). */
export function readOnTheDay(mood: Mood, day: DayKey): string {
  switch (mood.kind) {
    case "problems": {
      const n = mood.stories;
      if (n === 1) return "One thing needs you.";
      if (n === 2) return "Two things need you.";
      const count = capWord(numberWord(n));
      return pickLine([`${count} things need you.`, `A rough night. ${count} things need you.`], day, "problems");
    }
    case "busy":
      return pickLine(["Full day ahead.", "Busy one today."], day, "busy");
    case "quiet":
      return pickLine(["Quiet one today.", "Clear runway today."], day, "quiet");
    case "ordinary":
      return pickLine(["All's well.", "Nothing's on fire."], day, "ordinary");
  }
}

/** The push title: opener + read on the day. At most 80 characters (tested). */
export function greeting(day: DayKey, mood: Mood): string {
  return `${opener(day)} ${readOnTheDay(mood, day)}`;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/__tests__/voice.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/voice.ts src/lib/__tests__/voice.test.ts
git commit -m "feat(voice): the assistant's greeting, deterministic line choice and bold ranges"
```

---

### Task A2: The checks keep their numbers (Signal Plumber)

The catalogue needs facts that today exist only inside `detail` strings. Add them as typed fields; **keep every `detail` exactly as it is** (the Freelance page and its tests read them).

**Files:** Modify `src/lib/siteHealth.ts`, `src/lib/watchdog.ts`, `src/lib/outreachHealth.ts`, and their tests in `src/lib/__tests__/` (`siteHealth.test.ts`, `watchdog.test.ts`, `outreachHealth.test.ts` — grep for the exact names with `ls src/lib/__tests__ | grep -i -E "site|watchdog|outreach"`).

- [ ] **Step 1: Write the failing tests** (append to each file):

```ts
// siteHealth.test.ts
import { classifyError, classifyStatus } from "@/lib/siteHealth";
it("carries the status and the failure kind beside the detail", () => {
  expect(classifyStatus("Meowchi", 503)).toMatchObject({ up: false, failure: "status", status: 503, detail: "Meowchi returned HTTP 503" });
  expect(classifyStatus("Meowchi", 200)).toMatchObject({ up: true, detail: "Meowchi ok" });
  expect(classifyStatus("Meowchi", 200)).not.toHaveProperty("failure");
  expect(classifyError("Azero", new Error("The operation was aborted due to timeout"))).toMatchObject({ failure: "timeout" });
  expect(classifyError("Azero", new Error("getaddrinfo ENOTFOUND x"))).toMatchObject({ failure: "unreachable" });
});

// watchdog.test.ts
import { evaluateWatchdog, EXPECTATIONS } from "@/lib/watchdog";
it("carries ageHours on stale and itemsFailed on degraded", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  const exp = [{ agent: "chaser" as const, everyHours: 24, graceHours: 6 }];
  const stale = evaluateWatchdog(now, [{ agent: "chaser", startedAt: new Date(now.getTime() - 31 * 3600_000), ok: true, itemsFailed: 0 }], exp);
  expect(stale[0]).toMatchObject({ kind: "stale", ageHours: 31 });
  const degraded = evaluateWatchdog(now, [{ agent: "chaser", startedAt: now, ok: true, itemsFailed: 2 }], exp);
  expect(degraded[0]).toMatchObject({ kind: "degraded", itemsFailed: 2, detail: "chaser: 2 items failed" });
  expect(EXPECTATIONS.length).toBeGreaterThan(0);
});

// outreachHealth.test.ts — uses the file's own NOW, HOUR, hoursAgo() and summary() helpers.
it("carries the age, the error count and the stranded count beside the detail", () => {
  const stalled = evaluateOutreach(
    NOW,
    summary({ engine: { lastRunAt: hoursAgo(50), lastRunErrors: 0 }, queue: { drafts: 24, approved: 4 } }),
  );
  expect(stalled).toContainEqual(expect.objectContaining({ kind: "engine-stale", ageMs: 50 * HOUR }));
  expect(stalled).toContainEqual(expect.objectContaining({ kind: "stranded-approved", count: 4 }));
  const erring = evaluateOutreach(NOW, summary({ engine: { lastRunAt: hoursAgo(2), lastRunErrors: 3 } }));
  expect(erring).toEqual([expect.objectContaining({ kind: "engine-errors", count: 3 })]);
});
```

- [ ] **Step 2: Run them** — `npx vitest run src/lib/__tests__/siteHealth.test.ts src/lib/__tests__/watchdog.test.ts src/lib/__tests__/outreachHealth.test.ts` → FAIL on the new fields.

- [ ] **Step 3: Implement.** In `siteHealth.ts`:

```ts
export interface SiteResult {
  name: string;
  up: boolean;
  /** One short human-readable line; goes straight into the digest. */
  detail: string;
  /** Why it is down; absent when up. The Briefing's catalogue reads this, never `detail`. */
  failure?: "status" | "timeout" | "unreachable";
  /** The final HTTP status, when `failure` is "status". */
  status?: number;
}

export function classifyStatus(name: string, status: number): SiteResult {
  if (status >= 400) {
    return { name, up: false, detail: `${name} returned HTTP ${status}`, failure: "status", status };
  }
  return { name, up: true, detail: `${name} ok` };
}

export function classifyError(name: string, err: unknown): SiteResult {
  const message = err instanceof Error ? err.message : String(err);
  const timedOut = /abort|timeout|timed out/i.test(message);
  return {
    name,
    up: false,
    detail: `${name} ${timedOut ? "timed out" : "unreachable"}`,
    failure: timedOut ? "timeout" : "unreachable",
  };
}
```

In `watchdog.ts`, extend `Anomaly` with `ageHours?: number; itemsFailed?: number;` and set them in `evaluateWatchdog`: the `stale` push gains `ageHours: verdict.ageHours`, the `degraded` push gains `itemsFailed: verdict.itemsFailed`.

In `outreachHealth.ts`, extend `OutreachFinding` with `/** engine-stale: how long ago it last ran. */ ageMs?: number; /** engine-errors / stranded-approved: the count. */ count?: number;` and set `ageMs` on `engine-stale`, `count: engine.lastRunErrors` on `engine-errors`, `count: queue.approved` on `stranded-approved`.

**Check `healthSnapshot.ts`:** if it persists `SiteResult` through a schema, confirm `strict` drops the two new fields (or that its write maps only `name/up/detail`). Do not change its schema in this plan. A `siteHealth` result written with extra keys under `strict: true` is silently stripped, which is fine.

- [ ] **Step 4: Run all three test files + `npx tsc --noEmit`** → PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/siteHealth.ts src/lib/watchdog.ts src/lib/outreachHealth.ts src/lib/__tests__/
git commit -m "feat(checks): sites, agents and the sender keep their numbers beside the detail line"
```

---

### Task A3: `briefingTypes.ts` and `problems.ts` (Problem Clerk)

**Files:** Create `src/lib/briefingTypes.ts`, `src/lib/problems.ts`, `src/lib/__tests__/problems.test.ts`. Delete `src/lib/__tests__/buildProblems.test.ts` (its cases move into `problems.test.ts`, re-asserted on the typed shape). Modify `src/lib/digest.ts`: remove `MorningOutcomes`, `buildProblems`, `OWN_FRAGMENTS`, `capitalise` and the `Anomaly`/`SiteResult`/`OutreachFinding` type imports **only** (the rest of digest.ts is A6's).

- [ ] **Step 1: Write `src/lib/briefingTypes.ts`** (import-free, so the model can import it):

```ts
/**
 * briefingTypes.ts — the Briefing's closed sets and stored shape (S21).
 * IMPORT-FREE on purpose: src/models/LastDigest.ts takes its enums from here,
 * and a model must not pull in the lib layer.
 */

export const PROBLEM_KEYS = [
  "site-status",
  "site-timeout",
  "site-unreachable",
  "agent-never-ran",
  "agent-stale",
  "agent-failed",
  "agent-degraded",
  "job-failed",
  "snapshot-unsaved",
  "unstuck-items",
  "engine-never-ran",
  "engine-unreadable",
  "engine-stale",
  "engine-errors",
  "stranded-approved",
  "pipeline-unavailable",
  "calendar-unavailable",
  "calendar-partial",
  "todos-unavailable",
] as const;
export type ProblemKey = (typeof PROBLEM_KEYS)[number];

/**
 * Where a cause came from. The first seven are raw-error rules (spec §4.3);
 * "known" is a fact the app holds (an expired Google token); "fixed" is the
 * catalogue's one likely cause for a key with no raw error; "none" is the
 * honest "I can see it failed, but not why"; "unrecognised" is a raw error no
 * rule matched — counted for the later ask-Claude fallback (spec §4.5).
 */
export const CAUSE_KEYS = [
  "timeout",
  "network",
  "database",
  "auth",
  "forbidden",
  "rate-limit",
  "upstream",
  "known",
  "fixed",
  "none",
  "unrecognised",
] as const;
export type CauseKey = (typeof CAUSE_KEYS)[number];

export const BRIEFING_BOUNDS = {
  stories: 12,
  symptoms: 8,
  bold: 4,
  storySentence: 240,
  symptomSentence: 200,
  nextStep: 160,
  cause: 240,
  raw: 300,
  today: 600,
  freelance: 240,
  off: 120,
} as const;

export interface StoredBold {
  start: number;
  end: number;
}

export interface StoredSymptom {
  key: ProblemKey;
  sentence: string;
  bold: StoredBold[];
  nextStep: string;
  causeKey: CauseKey;
  cause: string;
  causeBold: StoredBold[];
  raw: string | null;
}

export interface StoredStory {
  sentence: string;
  bold: StoredBold[];
  symptoms: StoredSymptom[];
}

/** Every string is PUSH-FORM (straight apostrophes); the page curls it. */
export interface StoredBriefing {
  stories: StoredStory[];
  today: string;
  freelance: string | null;
  off: string | null;
  unrecognised: number;
}
```

- [ ] **Step 2: Write the failing test** `src/lib/__tests__/problems.test.ts` — port every case from `buildProblems.test.ts` onto the typed shape, plus the new keys. Complete file:

```ts
import { describe, it, expect } from "vitest";
import { AGENT_NAMES, buildProblems, type MorningOutcomes } from "@/lib/problems";
import { AGENTS } from "@/models/AgentRun";

const healthy: MorningOutcomes = {
  expiry: { ok: true, unstuck: 0 },
  watchdog: { ok: true, anomalies: [] },
  siteHealth: { ok: true, sites: [{ name: "Meowchi", up: true, detail: "Meowchi ok" }], snapshotStored: true },
  outreachHealth: { ok: true, findings: [] },
};

describe("buildProblems", () => {
  it("reports nothing when every job succeeded and every site is up", () => {
    expect(buildProblems(healthy)).toEqual([]);
  });

  it("types a down site by how it failed, and leaves the healthy ones out", () => {
    const problems = buildProblems({
      ...healthy,
      siteHealth: {
        ok: true,
        snapshotStored: true,
        sites: [
          { name: "Meowchi", up: true, detail: "Meowchi ok" },
          { name: "AzeroTech", up: false, detail: "AzeroTech unreachable", failure: "unreachable" },
          { name: "Meowchi2", up: false, detail: "Meowchi2 returned HTTP 503", failure: "status", status: 503 },
          { name: "Slow", up: false, detail: "Slow timed out", failure: "timeout" },
        ],
      },
    });
    expect(problems).toEqual([
      { key: "site-unreachable", site: "AzeroTech" },
      { key: "site-status", site: "Meowchi2", status: 503 },
      { key: "site-timeout", site: "Slow" },
    ]);
  });

  it("reads a down site with no failure field (an old shape) as unreachable, never as up", () => {
    const problems = buildProblems({
      ...healthy,
      siteHealth: { ok: true, snapshotStored: true, sites: [{ name: "X", up: false, detail: "X unreachable" }] },
    });
    expect(problems).toEqual([{ key: "site-unreachable", site: "X" }]);
  });

  it("counts one failed expiry sweep once, not twice", () => {
    const problems = buildProblems({
      ...healthy,
      expiry: { ok: false, error: "mongo down", unstuck: 0 },
      watchdog: { ok: true, anomalies: [{ agent: "expiry-sweep", kind: "failed", detail: "expiry-sweep failed" }] },
    });
    expect(problems).toEqual([{ key: "job-failed", job: "expiry-sweep", raw: "mongo down" }]);
  });

  it("keeps an expiry-sweep anomaly that is NOT the duplicate", () => {
    const problems = buildProblems({
      ...healthy,
      expiry: { ok: false, error: "mongo down", unstuck: 0 },
      watchdog: {
        ok: true,
        anomalies: [{ agent: "expiry-sweep", kind: "stale", detail: "expiry-sweep last ran 31h ago", ageHours: 31 }],
      },
    });
    expect(problems).toContainEqual({ key: "agent-stale", agent: "expiry-sweep", ageHours: 31 });
  });

  it("names each failed morning job with its raw error, bounded", () => {
    const long = "x".repeat(2000);
    const problems = buildProblems({
      ...healthy,
      watchdog: { ok: false, error: long, anomalies: [] },
      siteHealth: { ok: false, error: "fetch failed", sites: [], snapshotStored: true },
      outreachHealth: { ok: false, error: "ST 503", findings: [] },
    });
    expect(problems).toEqual([
      { key: "job-failed", job: "watchdog", raw: "x".repeat(300) },
      { key: "job-failed", job: "site-health", raw: "fetch failed" },
      { key: "job-failed", job: "outreach-health", raw: "ST 503" },
    ]);
  });

  it("reports a job failure with no error as raw null, never the word unknown", () => {
    expect(buildProblems({ ...healthy, expiry: { ok: false, unstuck: 0 } })).toEqual([
      { key: "job-failed", job: "expiry-sweep", raw: null },
    ]);
  });

  it("names an unsaved site reading only when the job itself succeeded", () => {
    expect(buildProblems({ ...healthy, siteHealth: { ...healthy.siteHealth, snapshotStored: false } })).toEqual([
      { key: "snapshot-unsaved" },
    ]);
  });

  it("counts interrupted approved items", () => {
    expect(buildProblems({ ...healthy, expiry: { ok: true, unstuck: 2 } })).toEqual([{ key: "unstuck-items", count: 2 }]);
  });

  it("types every watchdog anomaly kind", () => {
    const problems = buildProblems({
      ...healthy,
      watchdog: {
        ok: true,
        anomalies: [
          { agent: "chaser", kind: "never-ran", detail: "chaser has never run" },
          { agent: "site-health", kind: "failed", detail: "site-health failed" },
          { agent: "dispatcher", kind: "degraded", detail: "dispatcher: 1 item failed", itemsFailed: 1 },
        ],
      },
    });
    expect(problems).toEqual([
      { key: "agent-never-ran", agent: "chaser" },
      { key: "agent-failed", agent: "site-health" },
      { key: "agent-degraded", agent: "dispatcher", itemsFailed: 1 },
    ]);
  });

  it("types every outreach finding kind", () => {
    const problems = buildProblems({
      ...healthy,
      outreachHealth: {
        ok: true,
        findings: [
          { kind: "engine-stale", detail: "…", ageMs: 50 * 3600_000 },
          { kind: "stranded-approved", detail: "…", count: 4 },
          { kind: "engine-errors", detail: "…", count: 3 },
          { kind: "engine-never-ran", detail: "…" },
          { kind: "engine-unreadable", detail: "…" },
        ],
      },
    });
    expect(problems).toEqual([
      { key: "engine-stale", ageMs: 50 * 3600_000 },
      { key: "stranded-approved", count: 4 },
      { key: "engine-errors", count: 3 },
      { key: "engine-never-ran" },
      { key: "engine-unreadable" },
    ]);
  });
});

describe("AGENT_NAMES", () => {
  it("names every agent in lower case, ready to start a sentence after capFirst", () => {
    for (const agent of AGENTS) {
      expect(AGENT_NAMES[agent]).toMatch(/^[a-z]/);
    }
    expect(AGENT_NAMES["site-health"]).toBe("the site check");
    expect(AGENT_NAMES.dispatcher).toBe("the morning run");
  });
});
```

- [ ] **Step 3: Run it** — `npx vitest run src/lib/__tests__/problems.test.ts` → FAIL (module missing).

- [ ] **Step 4: Write `src/lib/problems.ts`**

```ts
/**
 * problems.ts — what went wrong this morning, as typed facts (S21, spec §4.1).
 *
 * Moved here from digest.ts and re-typed: buildProblems used to return text
 * fragments, which is why the push could only ever repeat machine notes. A
 * Problem now carries exactly the facts its sentence, next step and cause
 * need, and the compiler forbids one without them (plan deviation 2).
 *
 * Pure. `import type` only, so this stays testable without a database.
 *
 * The de-duplication rule and the R58 reasoning are unchanged from digest.ts:
 * a job that failed THIS run is reported from its in-memory outcome, and only
 * a `failed` expiry-sweep anomaly is dropped when the sweep really failed
 * here (otherwise one failure counts twice).
 */

import type { Anomaly } from "@/lib/watchdog";
import type { SiteResult } from "@/lib/siteHealth";
import type { OutreachFinding } from "@/lib/outreachHealth";
import type { Agent } from "@/models/AgentRun";
import { BRIEFING_BOUNDS } from "@/lib/briefingTypes";

export type CalendarUnavailableCause = "not-configured" | "expired" | "timeout" | "read-failed";

export type Problem =
  | { key: "site-status"; site: string; status: number }
  | { key: "site-timeout"; site: string }
  | { key: "site-unreachable"; site: string }
  | { key: "agent-never-ran"; agent: Agent }
  | { key: "agent-stale"; agent: Agent; ageHours: number }
  | { key: "agent-failed"; agent: Agent }
  | { key: "agent-degraded"; agent: Agent; itemsFailed: number }
  | { key: "job-failed"; job: Agent; raw: string | null }
  | { key: "snapshot-unsaved" }
  | { key: "unstuck-items"; count: number }
  | { key: "engine-never-ran" }
  | { key: "engine-unreadable" }
  | { key: "engine-stale"; ageMs: number }
  | { key: "engine-errors"; count: number }
  | { key: "stranded-approved"; count: number }
  | { key: "pipeline-unavailable"; raw: string | null }
  | { key: "calendar-unavailable"; cause: CalendarUnavailableCause }
  | { key: "calendar-partial"; calendars: string[] }
  | { key: "todos-unavailable" };

/**
 * How each agent is spoken of. A closed map over the Agent enum: a new agent
 * with no name fails to compile here (spec §4.2).
 */
export const AGENT_NAMES: Readonly<Record<Agent, string>> = Object.freeze({
  chaser: "the chaser",
  "lead-sweep": "the lead sweep",
  triage: "triage",
  "site-health": "the site check",
  "outreach-health": "the outreach check",
  dispatcher: "the morning run",
  retro: "the retro",
  watchdog: "the watchdog",
  "expiry-sweep": "the expiry sweep",
});

/** A raw error bounded to what the Briefing stores; null stays null. */
export function boundRaw(raw: string | undefined | null): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  return raw.slice(0, BRIEFING_BOUNDS.raw);
}

export interface MorningOutcomes {
  expiry: { ok: boolean; error?: string; unstuck: number };
  watchdog: { ok: boolean; error?: string; anomalies: Anomaly[] };
  siteHealth: { ok: boolean; error?: string; sites: SiteResult[]; snapshotStored: boolean };
  outreachHealth: { ok: boolean; error?: string; findings: OutreachFinding[] };
}

function fromSite(site: SiteResult): Problem {
  if (site.failure === "status" && typeof site.status === "number") {
    return { key: "site-status", site: site.name, status: site.status };
  }
  if (site.failure === "timeout") return { key: "site-timeout", site: site.name };
  // A down site with no failure field reads as unreachable — never as up.
  return { key: "site-unreachable", site: site.name };
}

function fromAnomaly(a: Anomaly): Problem {
  switch (a.kind) {
    case "never-ran":
      return { key: "agent-never-ran", agent: a.agent };
    case "stale":
      return { key: "agent-stale", agent: a.agent, ageHours: a.ageHours ?? 0 };
    case "failed":
      return { key: "agent-failed", agent: a.agent };
    case "degraded":
      return { key: "agent-degraded", agent: a.agent, itemsFailed: a.itemsFailed ?? 1 };
  }
}

function fromFinding(f: OutreachFinding): Problem {
  switch (f.kind) {
    case "engine-never-ran":
      return { key: "engine-never-ran" };
    case "engine-unreadable":
      return { key: "engine-unreadable" };
    case "engine-stale":
      return { key: "engine-stale", ageMs: f.ageMs ?? 0 };
    case "engine-errors":
      return { key: "engine-errors", count: f.count ?? 1 };
    case "stranded-approved":
      return { key: "stranded-approved", count: f.count ?? 1 };
  }
}

/** Pure. One morning's job outcomes as typed problems, in report order. */
export function buildProblems(outcomes: MorningOutcomes): Problem[] {
  const { expiry, watchdog, siteHealth, outreachHealth } = outcomes;
  const problems: Problem[] = [];

  if (!expiry.ok) problems.push({ key: "job-failed", job: "expiry-sweep", raw: boundRaw(expiry.error) });
  if (!watchdog.ok) problems.push({ key: "job-failed", job: "watchdog", raw: boundRaw(watchdog.error) });
  if (!siteHealth.ok) problems.push({ key: "job-failed", job: "site-health", raw: boundRaw(siteHealth.error) });
  if (siteHealth.ok && !siteHealth.snapshotStored) problems.push({ key: "snapshot-unsaved" });
  if (!outreachHealth.ok) {
    problems.push({ key: "job-failed", job: "outreach-health", raw: boundRaw(outreachHealth.error) });
  }
  if (expiry.unstuck > 0) problems.push({ key: "unstuck-items", count: expiry.unstuck });

  for (const anomaly of watchdog.anomalies) {
    const alreadyReported = !expiry.ok && anomaly.agent === "expiry-sweep" && anomaly.kind === "failed";
    if (alreadyReported) continue;
    problems.push(fromAnomaly(anomaly));
  }
  for (const site of siteHealth.sites) {
    if (!site.up) problems.push(fromSite(site));
  }
  for (const finding of outreachHealth.findings) problems.push(fromFinding(finding));

  return problems;
}
```

**Note on test order:** the "names each failed morning job" test expects watchdog, site-health, outreach-health in that order; the implementation pushes expiry first, then watchdog, site-health, snapshot, outreach — matching.

- [ ] **Step 5: Remove the moved code from `digest.ts`** (`MorningOutcomes`, `buildProblems`, `OWN_FRAGMENTS`, `capitalise`, and the three type imports for Anomaly/SiteResult/OutreachFinding). `composeDigest` still references `capitalise` and `problems: string[]` — **leave composeDigest compiling** by keeping a local copy of `capitalise` and `OWN_FRAGMENTS` until A6 rewrites it, OR (preferred) stop after deleting `buildProblems`/`MorningOutcomes` only and leave `capitalise`/`OWN_FRAGMENTS` for A6 to delete. Do the preferred one. Then update `src/app/api/cron/morning/route.ts`'s import line to `import { composeDigest } from "@/lib/digest"; import { buildProblems } from "@/lib/problems";` and, so the route type-checks until A8, map the typed problems back to strings at the call site:

```ts
problems: problems.map((p) => p.key), // TEMPORARY until A8 — A6 changes composeDigest's input
```

This temporary line is deleted in A8; it exists only so every commit builds.

- [ ] **Step 6: Delete `src/lib/__tests__/buildProblems.test.ts`**, then run `npx vitest run src/lib/__tests__/problems.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/briefingTypes.ts src/lib/problems.ts src/lib/__tests__/problems.test.ts src/lib/digest.ts src/app/api/cron/morning/route.ts
git rm src/lib/__tests__/buildProblems.test.ts
git commit -m "feat(problems): this morning's problems as typed facts, moved out of the digest"
```

---

### Task A4: `causes.ts` — the catalogue (Catalogue Writer)

**Files:** Create `src/lib/causes.ts`, `src/lib/__tests__/causes.test.ts`.

- [ ] **Step 1: Write the failing test** `src/lib/__tests__/causes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { explain, matchRaw } from "@/lib/causes";
import type { Problem } from "@/lib/problems";

const boldText = (s: { text: string; bold: { start: number; end: number }[] }) =>
  s.bold.map((r) => s.text.slice(r.start, r.end));

describe("matchRaw — first match wins, in the spec's order", () => {
  const cases: Array<[string, string]> = [
    ["connect ETIMEDOUT 1.2.3.4:443", "timeout"],
    ["The operation was aborted due to timeout", "timeout"],
    ["getaddrinfo ENOTFOUND api.x", "network"],
    ["connect ECONNREFUSED 127.0.0.1", "network"],
    ["read ECONNRESET", "network"],
    ["MongoServerSelectionError: Server selection timed out after 10000 ms", "timeout"],
    ["MongoNetworkError: connection closed", "database"],
    ["MongooseServerSelectionError: could not connect", "database"],
    ["invalid_grant: Token has been expired or revoked", "auth"],
    ["ShikksTracker answered 401", "auth"],
    ["answered 403 Forbidden", "forbidden"],
    ["answered 429", "rate-limit"],
    ["ShikksTracker answered HTTP 503", "upstream"],
    ["something nobody planned for", "unrecognised"],
  ];
  it.each(cases)("%s → %s", (raw, key) => {
    expect(matchRaw(raw).causeKey).toBe(key);
  });

  it("matches numbers only as whole tokens", () => {
    expect(matchRaw("item 24019 failed").causeKey).toBe("unrecognised");
    expect(matchRaw("id 5031 rejected").causeKey).toBe("unrecognised");
  });

  it("words every pattern-matched cause as likely, and the unrecognised one honestly", () => {
    for (const [raw] of cases.slice(0, -1)) expect(matchRaw(raw).cause.text).toMatch(/^Most likely /);
    expect(matchRaw("something nobody planned for").cause.text).toBe("I don't recognise this one. The raw error is below.");
  });
});

describe("explain — every catalogue row", () => {
  const rows: Array<[Problem, string, RegExp, string]> = [
    [{ key: "site-status", site: "Meowchi", status: 503 }, "Meowchi's site isn't answering (error 503).", /latest deploy on Vercel/, "fixed"],
    [{ key: "site-timeout", site: "AzeroTech" }, "AzeroTech's site took too long to answer.", /see if it loads/, "fixed"],
    [{ key: "site-unreachable", site: "ShikksTracker" }, "ShikksTracker's site can't be reached at all.", /still exist/, "fixed"],
    [{ key: "agent-never-ran", agent: "site-health" }, "The site check has never run.", /vercel\.json/, "fixed"],
    [{ key: "agent-stale", agent: "chaser", ageHours: 31 }, "The chaser hasn't run in 31 hours.", /Crons/, "fixed"],
    [{ key: "agent-stale", agent: "chaser", ageHours: 72 }, "The chaser hasn't run in 3 days.", /Crons/, "fixed"],
    [{ key: "agent-failed", agent: "chaser" }, "The chaser failed on its last run.", /last run's error/, "none"],
    [{ key: "agent-degraded", agent: "chaser", itemsFailed: 2 }, "The chaser's last run had two items that didn't go through.", /failed items/, "fixed"],
    [{ key: "job-failed", job: "site-health", raw: "connect ETIMEDOUT" }, "The site check broke this morning.", /last run's error/, "timeout"],
    [{ key: "job-failed", job: "site-health", raw: null }, "The site check broke this morning.", /last run's error/, "none"],
    [{ key: "snapshot-unsaved" }, "I checked the sites but couldn't save the result.", /gone tomorrow/, "fixed"],
    [{ key: "unstuck-items", count: 2 }, "Two approved items couldn't confirm they went through.", /before resending/, "fixed"],
    [{ key: "unstuck-items", count: 1 }, "One approved item couldn't confirm it went through.", /before resending/, "fixed"],
    [{ key: "engine-never-ran" }, "ShikksTracker's sender has never reported a run.", /pinger/, "fixed"],
    [{ key: "engine-unreadable" }, "ShikksTracker's sender reported a run time I can't read.", /run record/, "fixed"],
    [{ key: "engine-stale", ageMs: 50 * 3600_000 }, "ShikksTracker's sender hasn't run in 2 days.", /pinger/, "fixed"],
    [{ key: "engine-errors", count: 3 }, "ShikksTracker's sender hit three errors on its last run.", /last run in ShikksTracker/, "fixed"],
    [{ key: "stranded-approved", count: 4 }, "Four approved messages are stuck, unsent.", /Fix the sender first/, "fixed"],
    [{ key: "pipeline-unavailable", raw: "ShikksTracker answered HTTP 502" }, "I couldn't reach ShikksTracker, so I don't know how freelance is going.", /check it's up/, "upstream"],
    [{ key: "calendar-unavailable", cause: "expired" }, "I couldn't read your calendar.", /Settings/, "known"],
    [{ key: "calendar-unavailable", cause: "read-failed" }, "I couldn't read your calendar.", /Settings/, "none"],
    [{ key: "calendar-partial", calendars: ["Classes"] }, "I couldn't read your Classes calendar, so today might be missing something.", /still exists/, "fixed"],
    [{ key: "calendar-partial", calendars: ["Classes", "Events"] }, "I couldn't read your Classes and Events calendars, so today might be missing something.", /still exist/, "fixed"],
    [{ key: "todos-unavailable" }, "I couldn't read your to-dos.", /Reload/, "fixed"],
  ];

  it.each(rows)("%o", (problem, sentence, nextStep, causeKey) => {
    const e = explain(problem);
    expect(e.sentence.text).toBe(sentence);
    expect(e.nextStep).toMatch(nextStep);
    expect(e.causeKey).toBe(causeKey);
    expect(e.sentence.bold.length).toBeGreaterThan(0);
    expect(e.cause.bold.length).toBeGreaterThan(0);
    expect(e.sentence.text).not.toMatch(/’/); // push-form: straight apostrophes only
  });

  it("bolds the subject of the sentence", () => {
    expect(boldText(explain({ key: "site-status", site: "Meowchi", status: 503 }).sentence)).toEqual(["Meowchi's site"]);
    expect(boldText(explain({ key: "agent-failed", agent: "chaser" }).sentence)).toEqual(["The chaser"]);
  });

  it("picks the site-status cause by status class", () => {
    expect(explain({ key: "site-status", site: "M", status: 502 }).cause.text).toMatch(/crashing or mid-deploy/);
    expect(explain({ key: "site-status", site: "M", status: 404 }).cause.text).toMatch(/removed/);
    expect(explain({ key: "site-status", site: "M", status: 401 }).cause.text).toMatch(/login/);
    expect(explain({ key: "site-status", site: "M", status: 418 }).cause.text).toMatch(/refused the request/);
  });

  it("states a known calendar cause plainly, without 'Most likely'", () => {
    expect(explain({ key: "calendar-unavailable", cause: "not-configured" }).cause.text).toBe("Google isn't connected.");
    expect(explain({ key: "calendar-unavailable", cause: "expired" }).cause.text).toBe("Google access has expired.");
    expect(explain({ key: "calendar-unavailable", cause: "timeout" }).cause.text).toBe("Google didn't answer in time.");
  });

  it("carries the raw error only where there is one", () => {
    expect(explain({ key: "job-failed", job: "watchdog", raw: "boom" }).raw).toBe("boom");
    expect(explain({ key: "snapshot-unsaved" }).raw).toBeNull();
  });
});
```

- [ ] **Step 2: Run it** — `npx vitest run src/lib/__tests__/causes.test.ts` → FAIL.

- [ ] **Step 3: Write `src/lib/causes.ts`**

```ts
/**
 * causes.ts — the fixed catalogue (S21, spec §4.2–§4.5): for every problem,
 * its plain sentence (push-form), the next step, and the likely cause.
 *
 * No AI. Causes from pattern-matching a raw error are worded "Most likely …";
 * a cause the app KNOWS (an expired Google token) is stated plainly; a raw
 * error no rule matches says so honestly and is counted (`unrecognised`).
 *
 * THE SEAM (spec §4.5): explainCause() is the one function that turns a raw
 * error into a cause. A later ask-Claude fallback for unrecognised errors
 * goes behind it and nothing else changes.
 */

import type { CauseKey } from "@/lib/briefingTypes";
import { AGENT_NAMES, type Problem } from "@/lib/problems";
import { b, capFirst, capWord, numberWord, say, type Said } from "@/lib/voice";

export interface Explained {
  sentence: Said;
  nextStep: string;
  causeKey: CauseKey;
  cause: Said;
  raw: string | null;
}

interface RawRule {
  test: RegExp;
  causeKey: Exclude<CauseKey, "known" | "fixed" | "none" | "unrecognised">;
  cause: Said;
}

/** Spec §4.3, in order. First match wins; numbers match as whole tokens only. */
const RAW_RULES: readonly RawRule[] = [
  {
    test: /ETIMEDOUT|timed out|timeout|aborted/i,
    causeKey: "timeout",
    cause: say("Most likely ", b("it took too long"), ": the service or network was slow. Usually clears by itself."),
  },
  {
    test: /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET/,
    causeKey: "network",
    cause: say("Most likely ", b("I couldn't find or connect to the server"), ": network or DNS trouble, or the service is down."),
  },
  {
    test: /MongoServerSelectionError|MongoNetworkError|MongooseServerSelectionError/,
    causeKey: "database",
    cause: say("Most likely ", b("the database didn't answer"), ": an Atlas blip or the connection limit."),
  },
  {
    test: /invalid_grant|\b401\b|expired/i,
    causeKey: "auth",
    cause: say("Most likely ", b("a key or token stopped working"), ". It needs renewing."),
  },
  {
    test: /\b403\b/,
    causeKey: "forbidden",
    cause: say("Most likely ", b("access was refused"), ": a permission changed."),
  },
  {
    test: /\b429\b/,
    causeKey: "rate-limit",
    cause: say("Most likely ", b("too many requests"), ". A rate limit that waits itself out."),
  },
  {
    test: /\b5\d\d\b/,
    causeKey: "upstream",
    cause: say("Most likely ", b("the other service had an error on its end"), "."),
  },
];

const UNRECOGNISED: Said = say(b("I don't recognise this one."), " The raw error is below.");
const NO_RAW: Said = say(b("I can see it failed, but not why."), " Its run record holds the error.");

/** A raw error's cause, by the rules above. */
export function matchRaw(raw: string): { causeKey: CauseKey; cause: Said } {
  for (const rule of RAW_RULES) {
    if (rule.test.test(raw)) return { causeKey: rule.causeKey, cause: rule.cause };
  }
  return { causeKey: "unrecognised", cause: UNRECOGNISED };
}

/** THE SEAM. Today: the rules, or the honest no-raw line. */
export function explainCause(raw: string | null): { causeKey: CauseKey; cause: Said } {
  if (raw === null) return { causeKey: "none", cause: NO_RAW };
  return matchRaw(raw);
}

function hoursOrDays(hours: number): string {
  return hours < 48 ? `${hours} hours` : `${Math.floor(hours / 24)} days`;
}

function fixed(cause: Said): { causeKey: CauseKey; cause: Said } {
  return { causeKey: "fixed", cause };
}

function calendarList(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** One problem, fully explained. Every string is push-form. */
export function explain(p: Problem): Explained {
  const row = (sentence: Said, nextStep: string, c: { causeKey: CauseKey; cause: Said }, raw: string | null = null): Explained => ({
    sentence,
    nextStep,
    causeKey: c.causeKey,
    cause: c.cause,
    raw,
  });

  switch (p.key) {
    case "site-status": {
      const s = p.status;
      const cause =
        s >= 500
          ? say("Most likely ", b("the site's server is crashing or mid-deploy"), ".")
          : s === 404
            ? say("Most likely ", b("the page or deployment was removed"), ".")
            : s === 401 || s === 403
              ? say("Most likely ", b("the site is asking for a login"), ".")
              : say("Most likely ", b("the site refused the request"), ".");
      return row(
        say(b(`${p.site}'s site`), ` isn't answering (error ${s}).`),
        "Open the site, then check its latest deploy on Vercel.",
        fixed(cause),
      );
    }
    case "site-timeout":
      return row(
        say(b(`${p.site}'s site`), " took too long to answer."),
        "Open it and see if it loads.",
        fixed(say("Most likely ", b("a slow or overloaded server"), ", or a cold start past 8 seconds. Often clears on its own.")),
      );
    case "site-unreachable":
      return row(
        say(b(`${p.site}'s site`), " can't be reached at all."),
        "Check the domain and the Vercel project still exist.",
        fixed(say("Most likely ", b("the address doesn't resolve or refused the connection"), ": a removed project or a network fault.")),
      );
    case "agent-never-ran":
      return row(
        capFirst(say(b(AGENT_NAMES[p.agent]), " has never run.")),
        "Check the cron is in vercel.json and deployed.",
        fixed(say(b("It was never scheduled."), " Usually a new job missing from the deployed cron list.")),
      );
    case "agent-stale":
      return row(
        capFirst(say(b(AGENT_NAMES[p.agent]), ` hasn't run in ${hoursOrDays(p.ageHours)}.`)),
        "Vercel → Crons: look for missed runs.",
        fixed(say("Most likely ", b("Vercel didn't trigger it"), ": a paused project, a failed deploy, or a cron limit.")),
      );
    case "agent-failed":
      return row(
        capFirst(say(b(AGENT_NAMES[p.agent]), " failed on its last run.")),
        "Look at its last run's error.",
        explainCause(null),
      );
    case "agent-degraded": {
      const n = p.itemsFailed;
      return row(
        capFirst(say(b(`${AGENT_NAMES[p.agent]}'s last run`), ` had ${numberWord(n)} ${n === 1 ? "item" : "items"} that didn't go through.`)),
        "Look at that run's failed items.",
        fixed(say("Most likely ", b("some items were rejected"), " while the rest went through, usually bad data on those items.")),
      );
    }
    case "job-failed":
      return row(
        capFirst(say(b(AGENT_NAMES[p.job]), " broke this morning.")),
        "Look at its last run's error.",
        explainCause(p.raw),
        p.raw,
      );
    case "snapshot-unsaved":
      return row(
        say("I checked the sites but ", b("couldn't save the result"), "."),
        "Nothing needed if it's gone tomorrow.",
        fixed(say(b("The database write failed"), " after the check succeeded.")),
      );
    case "unstuck-items": {
      const one = p.count === 1;
      return row(
        say(b(`${capWord(numberWord(p.count))} approved ${one ? "item" : "items"}`), ` couldn't confirm ${one ? "it" : "they"} went through.`),
        "Check those leads in ShikksTracker before resending.",
        fixed(say(b("It's unknown whether they were sent"), ", so they're parked for you and never resent automatically.")),
      );
    }
    case "engine-never-ran":
      return row(
        say(b("ShikksTracker's sender"), " has never reported a run."),
        "Check its pinger and crons.",
        fixed(say(b("It has never been triggered"), ", or it doesn't record its runs.")),
      );
    case "engine-unreadable":
      return row(
        say(b("ShikksTracker's sender"), " reported a run time I can't read."),
        "Check its last run record.",
        fixed(say(b("Its run record is malformed."), " That's a ShikksTracker bug to note there.")),
      );
    case "engine-stale":
      return row(
        say(b("ShikksTracker's sender"), ` hasn't run in ${hoursOrDays(Math.floor(p.ageMs / 3_600_000))}.`),
        "Check ShikksTracker's pinger and crons.",
        fixed(say("Most likely ", b("its hourly trigger stopped"), ". It only runs when pinged.")),
      );
    case "engine-errors":
      return row(
        say(b("ShikksTracker's sender"), ` hit ${numberWord(p.count)} ${p.count === 1 ? "error" : "errors"} on its last run.`),
        "Check its last run in ShikksTracker.",
        fixed(say("Most likely ", b("some sends were refused"), ": a bad address or a mail-provider limit.")),
      );
    case "stranded-approved": {
      const one = p.count === 1;
      return row(
        say(b(`${capWord(numberWord(p.count))} approved ${one ? "message" : "messages"}`), ` ${one ? "is" : "are"} stuck, unsent.`),
        "Fix the sender first. They go once it runs.",
        fixed(say(b("The sender is down"), ", so nothing approved can leave.")),
      );
    }
    case "pipeline-unavailable":
      return row(
        say(b("I couldn't reach ShikksTracker"), ", so I don't know how freelance is going."),
        "Open ShikksTracker and check it's up.",
        explainCause(p.raw),
        p.raw,
      );
    case "calendar-unavailable": {
      const known: Record<Exclude<typeof p.cause, "read-failed">, Said> = {
        "not-configured": say(b("Google isn't connected.")),
        expired: say(b("Google access has expired.")),
        timeout: say(b("Google didn't answer in time.")),
      };
      return row(
        say(b("I couldn't read your calendar"), "."),
        "Settings → Google Calendar.",
        p.cause === "read-failed" ? explainCause(null) : { causeKey: "known", cause: known[p.cause] },
      );
    }
    case "calendar-partial": {
      const many = p.calendars.length > 1;
      return row(
        say(b(`I couldn't read your ${calendarList(p.calendars)} ${many ? "calendars" : "calendar"}`), ", so today might be missing something."),
        many ? "Check those calendars still exist in Google." : "Check that calendar still exists in Google.",
        fixed(say("Most likely ", b(many ? "those calendars refused or were removed" : "that one calendar refused or was removed"), ", while the others answered.")),
      );
    }
    case "todos-unavailable":
      return row(
        say(b("I couldn't read your to-dos"), "."),
        "Reload the Personal page.",
        fixed(say("Most likely ", b("the database didn't answer"), ".")),
      );
  }
}
```

**Note for the builder:** the test row `"MongoServerSelectionError: Server selection timed out …" → "timeout"` is deliberate: the timeout rule is first in the spec's order, and the message says "timed out". Do not reorder the rules to make it read "database". The ordering is the spec's and the test pins it.

- [ ] **Step 4: Run** `npx vitest run src/lib/__tests__/causes.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/causes.ts src/lib/__tests__/causes.test.ts
git commit -m "feat(causes): the problem catalogue - plain sentence, next step, likely cause, honest unknowns"
```

---

### Task A5: `stories.ts` — problems that happen together (Story Teller)

**Files:** Create `src/lib/stories.ts`, `src/lib/__tests__/stories.test.ts`.

- [ ] **Step 1: Write the failing test** `src/lib/__tests__/stories.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupProblems } from "@/lib/stories";
import type { Problem } from "@/lib/problems";

const texts = (problems: Problem[]) => groupProblems(problems).map((s) => s.sentence.text);

describe("groupProblems", () => {
  it("makes one story per unrelated problem, in order", () => {
    expect(
      texts([
        { key: "site-status", site: "Meowchi", status: 503 },
        { key: "agent-failed", agent: "chaser" },
      ]),
    ).toEqual(["Meowchi's site isn't answering (error 503).", "The chaser failed on its last run."]);
  });

  it("tells ShikksTracker being down as one story", () => {
    const stories = groupProblems([
      { key: "site-unreachable", site: "ShikksTracker" },
      { key: "pipeline-unavailable", raw: "fetch failed" },
      { key: "engine-stale", ageMs: 50 * 3600_000 },
      { key: "stranded-approved", count: 4 },
    ]);
    expect(stories).toHaveLength(1);
    expect(stories[0].sentence.text).toBe(
      "ShikksTracker looks down, which is why I couldn't check freelance and why its sender hasn't run. Four approved messages are stuck.",
    );
    expect(stories[0].symptoms.map((p) => p.key)).toEqual([
      "site-unreachable",
      "pipeline-unavailable",
      "engine-stale",
      "stranded-approved",
    ]);
  });

  it("does not claim ShikksTracker is down from the pipeline alone", () => {
    expect(groupProblems([{ key: "pipeline-unavailable", raw: null }])).toHaveLength(1);
    expect(texts([{ key: "pipeline-unavailable", raw: null }])[0]).toMatch(/^I couldn't reach ShikksTracker/);
  });

  it("ties a stalled sender to its stuck messages", () => {
    expect(
      texts([
        { key: "engine-stale", ageMs: 50 * 3600_000 },
        { key: "stranded-approved", count: 4 },
      ]),
    ).toEqual(["ShikksTracker's sender hasn't run in 2 days, so four approved messages are stuck."]);
  });

  it("names the database as the thread behind failed checks and unread to-dos", () => {
    const stories = groupProblems([
      { key: "job-failed", job: "watchdog", raw: "MongoNetworkError: closed" },
      { key: "job-failed", job: "site-health", raw: "MongoNetworkError: closed" },
      { key: "todos-unavailable" },
    ]);
    expect(stories).toHaveLength(1);
    expect(stories[0].sentence.text).toBe(
      "The database didn't answer this morning. That looks like what's behind the failed checks and why I couldn't read your to-dos.",
    );
  });

  it("groups failures that share a recognised cause", () => {
    expect(
      texts([
        { key: "job-failed", job: "watchdog", raw: "connect ETIMEDOUT" },
        { key: "job-failed", job: "site-health", raw: "aborted" },
        { key: "pipeline-unavailable", raw: "timed out" },
      ]),
    ).toEqual(["Three checks failed, and they all point to something being too slow to answer."]);
  });

  it("never groups unrecognised errors by cause", () => {
    expect(
      groupProblems([
        { key: "job-failed", job: "watchdog", raw: "weird one" },
        { key: "pipeline-unavailable", raw: "weird two" },
      ]),
    ).toHaveLength(2);
  });

  it("says several down sites once", () => {
    expect(
      texts([
        { key: "site-status", site: "Meowchi", status: 503 },
        { key: "site-timeout", site: "AzeroTech" },
      ]),
    ).toEqual(["Meowchi and AzeroTech are both down (error 503, timed out)."]);
    expect(
      texts([
        { key: "site-status", site: "A", status: 503 },
        { key: "site-unreachable", site: "B" },
        { key: "site-timeout", site: "C" },
      ]),
    ).toEqual(["A, B and C are all down (error 503, unreachable, timed out)."]);
  });

  it("says several failed agents once", () => {
    expect(
      texts([
        { key: "agent-failed", agent: "chaser" },
        { key: "agent-failed", agent: "site-health" },
      ]),
    ).toEqual(["The chaser and the site check both failed on their last run."]);
  });

  it("bolds the subjects of a grouped story", () => {
    const [story] = groupProblems([
      { key: "site-status", site: "Meowchi", status: 503 },
      { key: "site-timeout", site: "AzeroTech" },
    ]);
    expect(story.sentence.bold.map((r) => story.sentence.text.slice(r.start, r.end))).toEqual(["Meowchi", "AzeroTech"]);
  });

  it("keeps every symptom exactly once across all stories", () => {
    const input: Problem[] = [
      { key: "site-unreachable", site: "ShikksTracker" },
      { key: "pipeline-unavailable", raw: null },
      { key: "site-status", site: "Meowchi", status: 503 },
      { key: "agent-failed", agent: "chaser" },
      { key: "todos-unavailable" },
    ];
    const out = groupProblems(input).flatMap((s) => s.symptoms);
    expect(out).toHaveLength(input.length);
    for (const p of input) expect(out).toContain(p);
  });
});
```

- [ ] **Step 2: Run it** → FAIL.

- [ ] **Step 3: Write `src/lib/stories.ts`**

```ts
/**
 * stories.ts — problems that happen together, told as one story (S21, spec §4.4).
 *
 * A story is one thing that went wrong, however many places it shows up. The
 * push's title counts stories (Riku confirmed 2026-10-09); the Briefing lists
 * every symptom under its story.
 *
 * Links are drawn ONLY from the fixed chains below or from matching causes.
 * Two problems that merely happen on the same morning are never claimed as
 * connected, and links say "looks like" / "point to", never "caused by".
 *
 * Order of rules: known chains, then same cause, then same kind; whatever is
 * left is a one-problem story. Each problem joins at most one story.
 */

import { explain, explainCause } from "@/lib/causes";
import { AGENT_NAMES, type Problem } from "@/lib/problems";
import type { CauseKey } from "@/lib/briefingTypes";
import { b, capFirst, capWord, numberWord, say, type Said, type Seg } from "@/lib/voice";

export interface Story {
  sentence: Said;
  symptoms: Problem[];
}

const SITE_KEYS = new Set<Problem["key"]>(["site-status", "site-timeout", "site-unreachable"]);

function siteNote(p: Problem): string {
  if (p.key === "site-status") return `error ${p.status}`;
  if (p.key === "site-timeout") return "timed out";
  return "unreachable";
}

function siteName(p: Problem): string {
  return "site" in p ? p.site : "";
}

/** "A", "A and B", "A, B and C" as bold segments. */
function boldList(names: string[]): Seg[] {
  const segs: Seg[] = [];
  names.forEach((n, i) => {
    if (i > 0) segs.push(i === names.length - 1 ? " and " : ", ");
    segs.push(b(n));
  });
  return segs;
}

const CAUSE_THREAD: Partial<Record<CauseKey, string>> = {
  timeout: "something being too slow to answer",
  network: "the network",
  database: "the database",
  auth: "an expired key",
  forbidden: "a permission change",
  "rate-limit": "a rate limit",
  upstream: "the other service",
};

function causeOf(p: Problem): CauseKey | null {
  if (p.key === "job-failed" || p.key === "pipeline-unavailable") return explainCause(p.raw).causeKey;
  return null;
}

export function groupProblems(problems: Problem[]): Story[] {
  const left = [...problems];
  const stories: Story[] = [];
  const take = (pred: (p: Problem) => boolean): Problem[] => {
    const hit = left.filter(pred);
    for (const p of hit) left.splice(left.indexOf(p), 1);
    return hit;
  };

  // --- Chain 1: ShikksTracker looks down (needs BOTH its site and the pipeline).
  const stSite = left.find((p) => SITE_KEYS.has(p.key) && siteName(p) === "ShikksTracker");
  const pipeline = left.find((p) => p.key === "pipeline-unavailable");
  if (stSite && pipeline) {
    const symptoms = take(
      (p) =>
        p === stSite ||
        p === pipeline ||
        p.key === "engine-stale" ||
        p.key === "engine-never-ran" ||
        p.key === "stranded-approved",
    );
    const sender = symptoms.some((p) => p.key === "engine-stale" || p.key === "engine-never-ran");
    const stranded = symptoms.find((p) => p.key === "stranded-approved");
    const segs: Seg[] = [b("ShikksTracker looks down"), ", which is why I couldn't check freelance"];
    if (sender) segs.push(" and why its sender hasn't run");
    segs.push(".");
    if (stranded && stranded.key === "stranded-approved") {
      const one = stranded.count === 1;
      segs.push(" ", b(`${capWord(numberWord(stranded.count))} approved ${one ? "message" : "messages"}`), ` ${one ? "is" : "are"} stuck.`);
    }
    stories.push({ sentence: say(...segs), symptoms });
  }

  // --- Chain 2: a stalled sender and the messages it stranded.
  const engine = left.find((p) => p.key === "engine-stale" || p.key === "engine-never-ran");
  const stranded = left.find((p) => p.key === "stranded-approved");
  if (engine && stranded && stranded.key === "stranded-approved") {
    take((p) => p === engine || p === stranded);
    const head = explain(engine).sentence.text.replace(/\.$/, "");
    const one = stranded.count === 1;
    stories.push({
      sentence: say(b("ShikksTracker's sender"), head.slice("ShikksTracker's sender".length), `, so ${numberWord(stranded.count)} approved ${one ? "message is" : "messages are"} stuck.`),
      symptoms: [engine, stranded],
    });
  }

  // --- Chain 3: the database behind failed checks / unread to-dos / unsaved reading.
  const dbFails = left.filter((p) => causeOf(p) === "database");
  const dbSide = left.filter((p) => p.key === "todos-unavailable" || p.key === "snapshot-unsaved");
  if (dbFails.length >= 1 && dbFails.length + dbSide.length >= 2) {
    const symptoms = take((p) => dbFails.includes(p) || dbSide.includes(p));
    const behind: string[] = [];
    if (dbFails.length > 0) behind.push(dbFails.length === 1 ? "the failed check" : "the failed checks");
    if (dbSide.some((p) => p.key === "snapshot-unsaved")) behind.push("why the site reading wasn't saved");
    if (dbSide.some((p) => p.key === "todos-unavailable")) behind.push("why I couldn't read your to-dos");
    const tail = behind.length === 1 ? behind[0] : `${behind.slice(0, -1).join(", ")} and ${behind[behind.length - 1]}`;
    stories.push({
      sentence: say(b("The database didn't answer"), ` this morning. That looks like what's behind ${tail}.`),
      symptoms,
    });
  }

  // --- Rule 2: same recognised cause across two or more failures.
  const byCause = new Map<CauseKey, Problem[]>();
  for (const p of left) {
    const c = causeOf(p);
    if (c === null || c === "unrecognised" || c === "none" || !(c in CAUSE_THREAD)) continue;
    byCause.set(c, [...(byCause.get(c) ?? []), p]);
  }
  for (const [cause, group] of byCause) {
    if (group.length < 2) continue;
    take((p) => group.includes(p));
    stories.push({
      sentence: say(`${capWord(numberWord(group.length))} checks failed, and they all point to `, b(CAUSE_THREAD[cause]!), "."),
      symptoms: group,
    });
  }

  // --- Rule 3: same kind.
  const sites = left.filter((p) => SITE_KEYS.has(p.key));
  if (sites.length >= 2) {
    take((p) => sites.includes(p));
    const both = sites.length === 2 ? "both" : "all";
    stories.push({
      sentence: say(...boldList(sites.map(siteName)), ` are ${both} down (${sites.map(siteNote).join(", ")}).`),
      symptoms: sites,
    });
  }
  for (const key of ["agent-failed", "agent-never-ran", "agent-stale"] as const) {
    const group = left.filter((p) => p.key === key);
    if (group.length < 2) continue;
    take((p) => group.includes(p));
    const names = group.map((p) => ("agent" in p ? AGENT_NAMES[p.agent] : ""));
    const both = group.length === 2 ? "both" : "all";
    const tail =
      key === "agent-failed" ? ` ${both} failed on their last run.` : key === "agent-never-ran" ? ` have ${both} never run.` : ` are ${both} overdue.`;
    stories.push({ sentence: capFirst(say(...boldList(names), tail)), symptoms: group });
  }

  // --- Whatever is left: one story each, in the order they came.
  for (const p of [...left]) stories.push({ sentence: explain(p).sentence, symptoms: [p] });

  // Keep the report order: a story sits where its first symptom was.
  const firstIndex = (s: Story) => Math.min(...s.symptoms.map((p) => problems.indexOf(p)));
  return stories.sort((a, z) => firstIndex(a) - firstIndex(z));
}
```

**Check the expected strings against this code before running.** The chain-2 test expects `"ShikksTracker's sender hasn't run in 2 days, so four approved messages are stuck."` — `explain(engine-stale).sentence.text` is `"ShikksTracker's sender hasn't run in 2 days."`, its period is removed and the tail appended. For `engine-never-ran` the head reads `"ShikksTracker's sender has never reported a run, so …"`, which is fine.

- [ ] **Step 4: Run** `npx vitest run src/lib/__tests__/stories.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stories.ts src/lib/__tests__/stories.test.ts
git commit -m "feat(stories): problems that happen together are told as one story"
```

---

### Task A6: `digest.ts` — the push in the voice, and `buildBriefing` (Push Composer)

**Files:** Modify `src/lib/digest.ts` (top half: everything above `calendarForDigest`; plus `calendarForDigest`'s return), `src/lib/digestToday.ts`, and rewrite `src/lib/__tests__/digest.test.ts`'s `composeDigest` and Today-sentence blocks. Keep `todosForDigest` and its tests untouched.

**What changes, exactly:**

1. `DigestTodayInput` gains `calendarCause?: CalendarUnavailableCause` (set whenever `events === "unavailable"`).
2. `calendarForDigest` returns `calendarCause: window.reason` when `!window.ok && window.reason !== "none-enabled"`, and `"read-failed"` for its "every enabled layer failed / unjoinable id" branch. `digestToday.ts`'s catch returns `{ events: "unavailable", missedLayers: [], calendarCause: "read-failed" }`.
3. `DigestInput` becomes:

```ts
export interface DigestInput {
  /** The APP_TZ day this push is for (todayKey(now)). Drives the greeting. */
  day: DayKey;
  pending: number;
  /** null = the OS API call failed: a problem, never zeros. */
  attention: { repliedUnanswered: number; overdue: number } | null;
  /** The failed attention call's message, bounded; null when it answered or said nothing. */
  attentionError: string | null;
  problems: Problem[];
  offAgents: Agent[];
  today: DigestTodayInput;
}
```

4. `composeDigest(input): { title: string; body: string }` and `buildBriefing(input): StoredBriefing`, sharing `allProblems(input)` (adds `pipeline-unavailable`, `calendar-unavailable`, `calendar-partial`, `todos-unavailable` exactly where the old code added its fragments) and `groupProblems`.

5. **Today sentence, re-voiced** (`composeTodayLine` keeps its signature, its TITLE_CAPS/limit budget loop and its "never cut the suffix" rule):

| Part | Old | New |
|---|---|---|
| events | `Today: Math Methods 09:00, Meeting 13:00.` | `Today you've got Math Methods at 09:00 and Meeting at 13:00.` · all-day: `Foundation Day (all day)` |
| due | `Due: Essay (today), Tuition (Fri).` | `Coming up: Essay today and Tuition on Fri.` (`today` / `tomorrow` / `on Fri`) |
| overdue | `Overdue: Invoice (3d).` | `Running late: Invoice (3 days).` (`1 day`) |
| list overflow | `A, B, C, +2 more` | `A, B, C and 2 more` |
| every layer off | `Today: no layers switched on.` | `Your calendar layers are all switched off.` |
| calendar unavailable | `Today: calendar unavailable.` | *(omitted: the `calendar-unavailable` story already says it)* |
| partial read | `… Classes wasn't read.` | *(omitted: the `calendar-partial` story says it)* |
| to-dos unavailable | `Due: to-dos unavailable.` | *(omitted: the `todos-unavailable` story says it)* |
| everything quiet | `Today: nothing scheduled, nothing due.` | `Nothing on today, and nothing due.` — **only** when the calendar answered (`events` is an array or `none-enabled`) AND the to-dos answered. Otherwise the line is empty, and the problem story is what the push says (D6 holds: silence never looks like an unread calendar, because an unread calendar is always a story). |

`missedSentence` is deleted. The partial-read names now live in the `calendar-partial` problem.

6. **Freelance line:** parts in this order, each omitted at zero: `{One lead is|N leads are} waiting on your reply` (repliedUnanswered), `{one follow-up is|N follow-ups are} overdue` (overdue), `{one draft is|N drafts are} ready for your review` (pending). Joined `A, B and C.`, first letter up, numbers via `numberWord`. When `attention === null`, only the drafts part can appear. When all are zero: no line.

7. **Off line:** `offAgents.length === 1` → `${capFirst(AGENT_NAMES[a])}'s still off, by the way.` (`The chaser's still off, by the way.`). Two or more → `The chaser and the lead sweep are still off, by the way.`

8. **Problems line:** stories' sentences joined: the first as is; the second as `Separately, ` + `lowerLead(s)`; the third and later as `Also, ` + `lowerLead(s)`. Budget: keep whole stories in order; when one doesn't fit, end with `…and N more, see the Briefing.` (N = stories dropped; `…and one more, see the Briefing.` for 1). If even the first story plus that suffix doesn't fit, cut the first story's text with `…` and append the suffix. Same reservation arithmetic as today: the problems line may use `PUSH_BODY_MAX − after − 1 − compactToday.length`.

9. **Mood:** stories > 0 → problems. Else `busyCount = events (array length, 0 if not an array) + due items with dayLabel === "today" + overdue.length`; ≥ 4 → busy. Else, if events is `[]` or `"none-enabled"`, `due.length === 0`, and `overdue.length === 0` → quiet. Else → ordinary. Title = `greeting(day, mood)`.

10. **`buildBriefing`**: for each story `{ sentence, bold, symptoms: symptoms.map(explain → {key, sentence, bold, nextStep, causeKey, cause, causeBold, raw}) }`, `today: composeTodayLine(today)` (unbudgeted, never compacted), `freelance`, `off`, `unrecognised = count of symptoms with causeKey "unrecognised"`. Then **bound everything** with `boundBriefing` (strings sliced to `BRIEFING_BOUNDS`, arrays sliced, bold ranges dropped if `end > text.length`), so the model's validators can never reject a save.

- [ ] **Step 1: Rewrite the composeDigest + Today blocks of `src/lib/__tests__/digest.test.ts`.** Replace everything from the top of the file through the end of the `describe("composeDigest's Today sentence"` block, and every later block that calls `composeDigest` with string problems (lines ~550–680 today: the "problems line" and "capitalised" describes), with the file below. Keep the `calendarForDigest` and `todosForDigest` describes, but update the `calendarForDigest` expectations to include `calendarCause` where events is `"unavailable"`.

```ts
import { describe, it, expect } from "vitest";
import {
  buildBriefing,
  calendarForDigest,
  composeDigest,
  composeTodayLine,
  todosForDigest,
  type DigestInput,
  type DigestTodayInput,
} from "@/lib/digest";
import { buildPushPayload } from "@/lib/push";
import type { CalendarEvent } from "@/lib/google";
import type { Layer } from "@/lib/osSettings";
import { opener } from "@/lib/voice";

const DAY = "2026-10-13"; // a Tuesday
const QUIET: DigestTodayInput = { events: [], missedLayers: [], due: [], overdue: [] };
const base: DigestInput = {
  day: DAY,
  pending: 0,
  attention: { repliedUnanswered: 0, overdue: 0 },
  attentionError: null,
  problems: [],
  offAgents: [],
  today: QUIET,
};

describe("composeDigest — the title", () => {
  it("greets Riku and reads a quiet day as quiet", () => {
    const { title } = composeDigest(base);
    expect(title.startsWith(opener(DAY))).toBe(true);
    expect(title).toMatch(/(Quiet one today|Clear runway today)\.$/);
  });

  it("counts stories, not symptoms", () => {
    const { title } = composeDigest({
      ...base,
      problems: [{ key: "site-unreachable", site: "ShikksTracker" }],
      attention: null,
      attentionError: "fetch failed",
    });
    expect(title).toMatch(/One thing needs you\.$/);
  });

  it("never reads all-clear over a partial calendar (R23)", () => {
    const { title } = composeDigest({
      ...base,
      today: { ...QUIET, events: [{ title: "Math", time: "09:00" }], missedLayers: ["Classes"] },
    });
    expect(title).toMatch(/One thing needs you\.$/);
  });

  it("reads busy at four things today", () => {
    const { title } = composeDigest({
      ...base,
      today: {
        events: [
          { title: "A", time: "09:00" },
          { title: "B", time: "11:00" },
          { title: "C", time: "13:00" },
        ],
        missedLayers: [],
        due: [{ title: "Essay", dayLabel: "today" }],
        overdue: [],
      },
    });
    expect(title).toMatch(/(Full day ahead|Busy one today)\.$/);
  });

  it("does not count every layer off as a problem", () => {
    expect(composeDigest({ ...base, today: { ...QUIET, events: "none-enabled" } }).title).not.toMatch(/need/);
  });
});

describe("composeDigest — the body", () => {
  it("puts problems first, then today, then freelance, then switched off", () => {
    const { body } = composeDigest({
      ...base,
      pending: 3,
      attention: { repliedUnanswered: 1, overdue: 0 },
      problems: [{ key: "site-status", site: "Meowchi", status: 503 }],
      offAgents: ["chaser"],
      today: { ...QUIET, events: [{ title: "Math Methods", time: "09:00" }], due: [{ title: "Essay draft", dayLabel: "today" }] },
    });
    expect(body).toBe(
      "Meowchi's site isn't answering (error 503). Today you've got Math Methods at 09:00. Coming up: Essay draft today. " +
        "One lead is waiting on your reply and three drafts are ready for your review. The chaser's still off, by the way.",
    );
  });

  it("joins unrelated stories as separate sentences", () => {
    const { body } = composeDigest({
      ...base,
      problems: [
        { key: "site-status", site: "Meowchi", status: 503 },
        { key: "agent-failed", agent: "chaser" },
        { key: "todos-unavailable" },
      ],
    });
    expect(body.startsWith(
      "Meowchi's site isn't answering (error 503). Separately, the chaser failed on its last run. Also, I couldn't read your to-dos.",
    )).toBe(true);
  });

  it("never writes freelance zeros when the pipeline failed", () => {
    const { body } = composeDigest({ ...base, attention: null, attentionError: null });
    expect(body).toMatch(/^I couldn't reach ShikksTracker/);
    expect(body).not.toMatch(/waiting on your reply|follow-up/);
  });

  it("says a quiet day only when the calendar and the to-dos both answered", () => {
    expect(composeDigest(base).body).toBe("Nothing on today, and nothing due.");
    expect(composeDigest({ ...base, today: { ...QUIET, events: "unavailable", calendarCause: "timeout" } }).body).toBe(
      "I couldn't read your calendar.",
    );
    expect(composeDigest({ ...base, today: { ...QUIET, due: "unavailable" } }).body).toBe("I couldn't read your to-dos.");
  });

  it("stays within 320 characters and collapses extra stories into a pointer to the Briefing", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ key: "site-status" as const, site: `Site number ${i} with a long name`, status: 503 }));
    // 20 sites are ONE story (same kind); make them unrelated instead:
    const problems = [
      ...many.slice(0, 1),
      { key: "agent-failed" as const, agent: "chaser" as const },
      { key: "agent-never-ran" as const, agent: "site-health" as const },
      { key: "engine-errors" as const, count: 3 },
      { key: "unstuck-items" as const, count: 2 },
      { key: "snapshot-unsaved" as const },
      { key: "todos-unavailable" as const },
      { key: "calendar-unavailable" as const, cause: "expired" as const },
    ];
    const { body } = composeDigest({
      ...base,
      problems,
      pending: 4,
      attention: { repliedUnanswered: 2, overdue: 1 },
      today: { ...QUIET, events: [{ title: "Math Methods", time: "09:00" }] },
    });
    expect(body.length).toBeLessThanOrEqual(320);
    expect(body).toMatch(/…and (one|two|three|four|five|six|seven|\d+) more, see the Briefing\./);
    expect(buildPushPayload("t", body).body).toBe(body); // the payload never has to cut
    expect(body).toMatch(/drafts are ready for your review\.$/); // the freelance line survives
  });

  it("cuts a single enormous story rather than exceed the budget", () => {
    const { body } = composeDigest({
      ...base,
      problems: [{ key: "calendar-partial", calendars: Array.from({ length: 40 }, (_, i) => `Calendar ${i}`) }],
    });
    expect(body.length).toBeLessThanOrEqual(320);
    expect(body).toContain("…");
  });

  it("uses straight apostrophes only", () => {
    const { title, body } = composeDigest({ ...base, problems: [{ key: "site-timeout", site: "Azero" }] });
    expect(title + body).not.toMatch(/’/);
  });
});

describe("composeTodayLine — the voice", () => {
  it("names events with their times, all-day ones marked", () => {
    expect(
      composeTodayLine({ ...QUIET, events: [{ title: "Math Methods", time: "09:00" }, { title: "Foundation Day", time: null }] }),
    ).toBe("Today you've got Math Methods at 09:00 and Foundation Day (all day).");
  });

  it("lists due and overdue to-dos in plain words", () => {
    expect(
      composeTodayLine({
        ...QUIET,
        due: [
          { title: "Essay", dayLabel: "today" },
          { title: "Tuition", dayLabel: "Fri" },
        ],
        overdue: [{ title: "Invoice", daysLate: 1 }],
      }),
    ).toBe("Coming up: Essay today and Tuition on Fri. Running late: Invoice (1 day).");
  });

  it("collapses past three names into 'and N more', counting the store's total", () => {
    expect(
      composeTodayLine({
        ...QUIET,
        due: ["A", "B", "C", "D"].map((t) => ({ title: t, dayLabel: "today" })),
        dueTotal: 9,
      }),
    ).toBe("Coming up: A today, B today, C today and 6 more.");
  });

  it("says when every layer is off", () => {
    expect(composeTodayLine({ ...QUIET, events: "none-enabled" })).toBe(
      "Your calendar layers are all switched off. Nothing due.",
    );
  });

  it("compacts under a budget without ever cutting a time", () => {
    const long = "A very long event title that goes on and on and on";
    const line = composeTodayLine(
      { ...QUIET, events: [1, 2, 3, 4].map((i) => ({ title: `${long} ${i}`, time: "09:00" })) },
      90,
    );
    expect(line.length).toBeLessThanOrEqual(90);
    expect(line).toContain("09:00");
  });
});

describe("buildBriefing", () => {
  it("stores every story with every symptom explained", () => {
    const briefing = buildBriefing({
      ...base,
      problems: [
        { key: "site-unreachable", site: "ShikksTracker" },
        { key: "job-failed", job: "watchdog", raw: "something odd" },
      ],
      attention: null,
      // A recognised error, so the only unrecognised one is the watchdog's.
      attentionError: "connect ECONNREFUSED 10.0.0.1:443",
    });
    expect(briefing.stories).toHaveLength(2);
    expect(briefing.stories[0].symptoms.map((s) => s.key)).toEqual(["site-unreachable", "pipeline-unavailable"]);
    expect(briefing.stories[1].symptoms[0]).toMatchObject({
      key: "job-failed",
      causeKey: "unrecognised",
      cause: "I don't recognise this one. The raw error is below.",
      raw: "something odd",
    });
    expect(briefing.unrecognised).toBe(1);
  });

  it("keeps the full Today sentence, never compacted", () => {
    const events = Array.from({ length: 8 }, (_, i) => ({ title: `Event ${i}`, time: "09:00" }));
    const briefing = buildBriefing({ ...base, today: { ...QUIET, events } });
    expect(briefing.today).toContain("Event 0");
    expect(briefing.today).toContain("and 5 more");
  });

  it("bounds every stored string and array", () => {
    const briefing = buildBriefing({
      ...base,
      problems: [{ key: "calendar-partial", calendars: Array.from({ length: 80 }, (_, i) => `Calendar ${i}`) }],
    });
    expect(briefing.stories[0].sentence.length).toBeLessThanOrEqual(240);
    expect(briefing.stories[0].symptoms[0].sentence.length).toBeLessThanOrEqual(200);
    for (const r of briefing.stories[0].bold) expect(r.end).toBeLessThanOrEqual(briefing.stories[0].sentence.length);
  });

  it("is null-free where the page needs text, and null where a line is absent", () => {
    const briefing = buildBriefing(base);
    expect(briefing.stories).toEqual([]);
    expect(briefing.freelance).toBeNull();
    expect(briefing.off).toBeNull();
    expect(briefing.today).toBe("Nothing on today, and nothing due.");
  });
});
```

Also update the existing `calendarForDigest` describe: wherever it expects `{ events: "unavailable", missedLayers: [] }`, it now expects `{ events: "unavailable", missedLayers: [], calendarCause: <reason> }` (`"not-configured"`, `"expired"`, `"timeout"`, or `"read-failed"` for the every-layer-failed / unjoinable branch). Wherever it expects a non-unavailable result, add no field (`calendarCause` absent; use `toStrictEqual` only where the file already does).

- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/digest.test.ts` → FAIL.

- [ ] **Step 3: Rewrite the top half of `src/lib/digest.ts`.** Replace the file header through the end of `renderToday`/`missedSentence` with the code below, keep `calendarForDigest` (with the `calendarCause` additions), `DigestTodoRow` and `todosForDigest` unchanged, and delete the leftover `OWN_FRAGMENTS`/`capitalise`/`MAX_PROBLEM_CHARS`/`short`/`end`/`problemsWithin` from A3.

```ts
/**
 * digest.ts — the one push Riku gets each morning, in the assistant's voice (S21).
 *
 * Pure, so the wording is testable without sending anything.
 *
 * It goes out EVERY day, including when nothing is wrong (P5a-4): an absence
 * only means something if the presence is unconditional.
 *
 * ORDER (D12, kept): problems, then the Today sentence, then freelance, then
 * what is switched off. Problems lead because buildPushPayload slices the body
 * at 320 and a lock screen shows less; the problems line is budgeted so that
 * slice never cuts the freelance line.
 *
 * TWO OUTPUTS. composeDigest is the push (title + body, budgeted). buildBriefing
 * is the full structured Briefing the site renders (never budgeted, only
 * bounded to the model's limits). They share their sentences, so the page can
 * never say something the push didn't. The route builds the briefing after the
 * send, inside a catch: a briefing bug never costs the push (spec §7.2).
 *
 * TITLE (S21): opener + read on the day, counting STORIES, not symptoms. A
 * problem morning never gets a cheerful read (R23).
 */

import { APP_TZ, PUSH_BODY_MAX } from "@/lib/constants";
import { addDays, clockHHMM, formatDay, type DayKey } from "@/lib/days";
import { daysLate, digestWindow, sortTodos, todoDueKey } from "@/lib/todos";
import type { CalendarWindow } from "@/lib/google";
import type { Layer } from "@/lib/osSettings";
import type { Agent } from "@/models/AgentRun";
import { AGENT_NAMES, boundRaw, type CalendarUnavailableCause, type Problem } from "@/lib/problems";
import { explain } from "@/lib/causes";
import { groupProblems, type Story } from "@/lib/stories";
import { capWord, greeting, joinSaid, lowerLead, numberWord, say, type Mood, type Said } from "@/lib/voice";
import { BRIEFING_BOUNDS, type StoredBold, type StoredBriefing } from "@/lib/briefingTypes";

export interface DigestInput {
  /** The APP_TZ day this push is for (todayKey(now)). Drives the greeting. */
  day: DayKey;
  pending: number;
  /** null = the OS API call failed: a problem, never zeros. */
  attention: { repliedUnanswered: number; overdue: number } | null;
  /** The failed attention call's message, bounded; null when it answered or said nothing. */
  attentionError: string | null;
  problems: Problem[];
  offAgents: Agent[];
  today: DigestTodayInput;
}

export interface Digest {
  title: string;
  body: string;
}

/** The input's problems plus the four the digest itself detects, in report order. */
function allProblems(input: DigestInput): Problem[] {
  const problems = [...input.problems];
  if (input.attention === null) problems.push({ key: "pipeline-unavailable", raw: boundRaw(input.attentionError) });
  const { today } = input;
  if (today.events === "unavailable") {
    problems.push({ key: "calendar-unavailable", cause: today.calendarCause ?? "read-failed" });
  } else if (today.events !== "none-enabled" && today.missedLayers.length > 0) {
    problems.push({ key: "calendar-partial", calendars: today.missedLayers });
  }
  if (today.due === "unavailable") problems.push({ key: "todos-unavailable" });
  return problems;
}

/** First story as is; then `Separately, …`; then `Also, …` (plan deviation 3). */
function storySentences(stories: Story[]): Said[] {
  return stories.map((s, i) => {
    if (i === 0) return s.sentence;
    const lead = i === 1 ? "Separately, " : "Also, ";
    const lowered = lowerLead(s.sentence);
    return joinSaid([say(lead), lowered], "");
  });
}

function moreSuffix(dropped: number): string {
  return `…and ${numberWord(dropped)} more, see the Briefing.`;
}

/** The problems line within `budget`: whole stories, the rest pointed at the Briefing. */
function problemsWithin(sentences: Said[], budget: number): string {
  const texts = sentences.map((s) => s.text);
  for (let keep = texts.length; keep >= 1; keep--) {
    const dropped = texts.length - keep;
    const line = [...texts.slice(0, keep), ...(dropped > 0 ? [moreSuffix(dropped)] : [])].join(" ");
    if (line.length <= budget) return line;
  }
  const dropped = texts.length - 1;
  const suffix = dropped > 0 ? ` ${moreSuffix(dropped)}` : "";
  const room = Math.max(2, budget - suffix.length);
  const first = texts[0].length > room ? `${texts[0].slice(0, room - 1).trimEnd()}…` : texts[0];
  return `${first}${suffix}`;
}

/** `One lead is waiting on your reply, one follow-up is overdue and three drafts are ready for your review.` */
export function freelanceLine(input: Pick<DigestInput, "attention" | "pending">): string | null {
  const parts: string[] = [];
  const count = (n: number, one: string, many: string) => (n === 1 ? `one ${one}` : `${numberWord(n)} ${many}`);
  if (input.attention !== null) {
    const { repliedUnanswered: r, overdue: o } = input.attention;
    if (r > 0) parts.push(`${count(r, "lead is", "leads are")} waiting on your reply`);
    if (o > 0) parts.push(`${count(o, "follow-up is", "follow-ups are")} overdue`);
  }
  if (input.pending > 0) parts.push(`${count(input.pending, "draft is", "drafts are")} ready for your review`);
  if (parts.length === 0) return null;
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${capWord(joined)}.`;
}

/** `The chaser's still off, by the way.` / `The chaser and the lead sweep are still off, by the way.` */
export function offLine(offAgents: Agent[]): string | null {
  if (offAgents.length === 0) return null;
  const names = offAgents.map((a) => AGENT_NAMES[a]);
  if (names.length === 1) return `${capWord(names[0])}'s still off, by the way.`;
  const joined = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${capWord(joined)} are still off, by the way.`;
}

function moodOf(stories: Story[], today: DigestTodayInput): Mood {
  if (stories.length > 0) return { kind: "problems", stories: stories.length };
  const events = Array.isArray(today.events) ? today.events.length : 0;
  const due = today.due === "unavailable" ? [] : today.due;
  const busy = events + due.filter((d) => d.dayLabel === "today").length + today.overdue.length;
  if (busy >= 4) return { kind: "busy" };
  const calendarQuiet = Array.isArray(today.events) ? today.events.length === 0 : today.events === "none-enabled";
  if (calendarQuiet && due.length === 0 && today.overdue.length === 0) return { kind: "quiet" };
  return { kind: "ordinary" };
}

export function composeDigest(input: DigestInput): Digest {
  const stories = groupProblems(allProblems(input));
  const title = greeting(input.day, moodOf(stories, input.today));

  const after = [freelanceLine(input), offLine(input.offAgents)].filter((s): s is string => s !== null);
  const sep = (parts: string[]) => parts.filter((p) => p.length > 0).join(" ");

  if (stories.length === 0) {
    const others = after;
    const budget = PUSH_BODY_MAX - (others.length > 0 ? others.join(" ").length + 1 : 0);
    return { title, body: sep([composeTodayLine(input.today, budget), ...after]) };
  }

  // Reserve the parts after the problems line and the Today line's most compact
  // form, then give the Today line whatever the problems line actually left.
  const afterLength = after.reduce((n, part) => n + 1 + part.length, 0);
  const compact = composeTodayLine(input.today, 0);
  const problemsBudget = PUSH_BODY_MAX - afterLength - (compact.length > 0 ? compact.length + 1 : 0);
  const problemsLine = problemsWithin(storySentences(stories), problemsBudget);
  const used = problemsLine.length + afterLength;
  const todayLine = composeTodayLine(input.today, Math.max(0, PUSH_BODY_MAX - used - 1));
  return { title, body: sep([problemsLine, todayLine, ...after]) };
}

// --- The stored Briefing (S21, spec §7.1) ------------------------------------

function boundText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function boundBold(bold: StoredBold[], text: string): StoredBold[] {
  return bold.filter((r) => r.start >= 0 && r.end <= text.length && r.start < r.end).slice(0, BRIEFING_BOUNDS.bold);
}

export function buildBriefing(input: DigestInput): StoredBriefing {
  const stories = groupProblems(allProblems(input)).slice(0, BRIEFING_BOUNDS.stories);
  let unrecognised = 0;
  const stored = stories.map((story) => {
    const sentence = boundText(story.sentence.text, BRIEFING_BOUNDS.storySentence);
    return {
      sentence,
      bold: boundBold(story.sentence.bold, sentence),
      symptoms: story.symptoms.slice(0, BRIEFING_BOUNDS.symptoms).map((p) => {
        const e = explain(p);
        if (e.causeKey === "unrecognised") unrecognised++;
        const s = boundText(e.sentence.text, BRIEFING_BOUNDS.symptomSentence);
        const cause = boundText(e.cause.text, BRIEFING_BOUNDS.cause);
        return {
          key: p.key,
          sentence: s,
          bold: boundBold(e.sentence.bold, s),
          nextStep: boundText(e.nextStep, BRIEFING_BOUNDS.nextStep),
          causeKey: e.causeKey,
          cause,
          causeBold: boundBold(e.cause.bold, cause),
          raw: e.raw === null ? null : e.raw.slice(0, BRIEFING_BOUNDS.raw),
        };
      }),
    };
  });
  const freelance = freelanceLine(input);
  const off = offLine(input.offAgents);
  return {
    stories: stored,
    today: boundText(composeTodayLine(input.today), BRIEFING_BOUNDS.today),
    freelance: freelance === null ? null : boundText(freelance, BRIEFING_BOUNDS.freelance),
    off: off === null ? null : boundText(off, BRIEFING_BOUNDS.off),
    unrecognised,
  };
}

// --- The Today sentence (deck §10, re-voiced by S21) --------------------------

/**
 * What the Today sentence is built from. `calendarCause` says why `events` is
 * "unavailable" (S21: the cause card states it as a fact).
 */
export interface DigestTodayInput {
  events: Array<{ title: string; time: string | null }> | "unavailable" | "none-enabled";
  missedLayers: string[];
  calendarCause?: CalendarUnavailableCause;
  due: Array<{ title: string; dayLabel: string }> | "unavailable";
  overdue: Array<{ title: string; daysLate: number }>;
  dueTotal?: number;
  overdueTotal?: number;
}

/** Up to 3 names per part (deck §10). */
const TODAY_NAMES = 3;

/** Title caps tried, longest first, when over budget. A suffix is never cut. */
const TITLE_CAPS = [60, 40, 24, 12] as const;

function capTitle(title: string, cap: number): string {
  return title.length > cap ? `${title.slice(0, cap - 1).trimEnd()}…` : title;
}

/** `A, B and C` · `A, B, C and 2 more`. `total` is the store's count, never below names.length. */
function listPart(names: string[], total: number = names.length, limit: number = TODAY_NAMES): string {
  const shown = names.slice(0, limit);
  const rest = Math.max(total, names.length) - shown.length;
  if (rest > 0) return shown.length > 0 ? `${shown.join(", ")} and ${rest} more` : `${rest} more`;
  if (shown.length <= 1) return shown.join("");
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

function dueWhen(label: string): string {
  return label === "today" || label === "tomorrow" ? label : `on ${label}`;
}

/**
 * Pure. The Today sentence:
 *   Today you've got Math Methods at 09:00 and Meeting at 13:00. Coming up: Essay today. Running late: Invoice (3 days).
 *   Your calendar layers are all switched off. Nothing due.
 *   Nothing on today, and nothing due.        (both reads answered, both empty)
 *   ""                                         (a read failed and nothing else to say — its story says it)
 * Budget behaviour is unchanged from P10b: titles cut through TITLE_CAPS, then
 * names move into `and N more`; times, days and lateness are never cut.
 */
export function composeTodayLine(today: DigestTodayInput, budget: number = Infinity): string {
  const full = renderToday(today, Infinity, TODAY_NAMES);
  if (full.length <= budget) return full;
  let line = full;
  for (const cap of TITLE_CAPS) {
    line = renderToday(today, cap, TODAY_NAMES);
    if (line.length <= budget) return line;
  }
  const smallest = TITLE_CAPS[TITLE_CAPS.length - 1];
  for (let limit = TODAY_NAMES - 1; limit >= 0; limit--) {
    line = renderToday(today, smallest, limit);
    if (line.length <= budget) return line;
  }
  return line;
}

function renderToday(today: DigestTodayInput, cap: number, limit: number): string {
  const t = (title: string) => capTitle(title, cap);
  const parts: string[] = [];
  const calendarAnswered = today.events !== "unavailable";
  const todosAnswered = today.due !== "unavailable";

  if (today.events === "none-enabled") {
    parts.push("Your calendar layers are all switched off.");
  } else if (Array.isArray(today.events) && today.events.length > 0) {
    const names = today.events.map((e) => (e.time === null ? `${t(e.title)} (all day)` : `${t(e.title)} at ${e.time}`));
    parts.push(`Today you've got ${listPart(names, names.length, limit)}.`);
  }

  if (today.due !== "unavailable") {
    if (today.due.length > 0) {
      parts.push(`Coming up: ${listPart(today.due.map((d) => `${t(d.title)} ${dueWhen(d.dayLabel)}`), today.dueTotal, limit)}.`);
    }
    if (today.overdue.length > 0) {
      parts.push(
        `Running late: ${listPart(
          today.overdue.map((o) => `${t(o.title)} (${o.daysLate} ${o.daysLate === 1 ? "day" : "days"})`),
          today.overdueTotal,
          limit,
        )}.`,
      );
    }
  }

  const calendarEmpty = Array.isArray(today.events) && today.events.length === 0;
  const todosEmpty = todosAnswered && (today.due as unknown[]).length === 0 && today.overdue.length === 0;
  if (calendarAnswered && todosAnswered && todosEmpty) {
    if (calendarEmpty) return "Nothing on today, and nothing due.";
    if (today.events === "none-enabled") parts.push("Nothing due.");
  }
  return parts.join(" ");
}
```

Then in `calendarForDigest` (kept below), change the two `"unavailable"` returns:

```ts
  if (!window.ok) {
    return window.reason === "none-enabled"
      ? { events: "none-enabled", missedLayers: [] }
      : { events: "unavailable", missedLayers: [], calendarCause: window.reason };
  }
  // …
    return { events: "unavailable", missedLayers: [], calendarCause: "read-failed" };
```

and its return type to `Pick<DigestTodayInput, "events" | "missedLayers" | "calendarCause">`. In `digestToday.ts`, widen `readCalendarPart`'s return type the same way and make its catch return `{ events: "unavailable", missedLayers: [], calendarCause: "read-failed" }`.

**Check the "every layer off" test:** `composeTodayLine({ ...QUIET, events: "none-enabled" })` → parts = `["Your calendar layers are all switched off."]`, then todos answered and empty, calendar not an empty array, events is none-enabled → push `"Nothing due."` → `"Your calendar layers are all switched off. Nothing due."` ✓. `buildBriefing(base).today` → events `[]`, todos empty → `"Nothing on today, and nothing due."` ✓.

**Check the freelance test string:** pending 3, attention `{1, 0}` → parts `["one lead is waiting on your reply", "three drafts are ready for your review"]` → `"One lead is waiting on your reply and three drafts are ready for your review."` ✓ (the test above expects exactly that).

- [ ] **Step 4: Run** `npx vitest run src/lib/__tests__/digest.test.ts src/lib/__tests__/stories.test.ts src/lib/__tests__/causes.test.ts` → PASS. Then `npx tsc --noEmit` → the morning route **fails to compile** (its `composeDigest` call is the old shape). That is A8's. To keep this commit building, apply the minimum route edit now: pass `day: todayKey(new Date())`, `attentionError: null`, `problems` (the typed array, deleting A3's temporary `.map`), and `offAgents: settings.chaserEnabled ? [] : ["chaser"] as Agent[]`. A8 finishes the wiring.

- [ ] **Step 5: Commit**

```bash
git add src/lib/digest.ts src/lib/digestToday.ts src/lib/__tests__/digest.test.ts src/app/api/cron/morning/route.ts
git commit -m "feat(digest): the morning push in the assistant's voice, and the structured Briefing"
```

---

### Task A7: LastDigest stores the Briefing and when it was seen (Data Steward)

**Files:** Modify `src/models/LastDigest.ts`, `src/lib/lastDigest.ts`, `src/lib/__tests__/lastDigest.test.ts`, and `src/lib/__tests__/models.test.ts` (it has LastDigest assertions — grep `LastDigest` in it).

- [ ] **Step 1: Write the failing tests.** In `lastDigest.test.ts`:
  - Change the projection expectation to `{ sentAt: 1, title: 1, body: 1, devices: 1, briefing: 1, seenAt: 1, _id: 0 }`.
  - Change "returns the stored push" to expect `briefing: null, seenAt: null` when the doc has neither, and add a case returning a stored briefing object and a `seenAt` Date unchanged.
  - Add: `it("reads a briefing that is not an object as null, never a throw")` with `briefing: "junk"` → `briefing: null`.
  - Change the save expectation to:

```ts
await saveLastDigest(SENT_AT, PAYLOAD, 2, BRIEFING);
expect(update).toEqual({
  $set: { sentAt: SENT_AT, title: PAYLOAD.title, body: PAYLOAD.body, devices: 2, seenAt: null, briefing: BRIEFING },
});
```

  and add `it("unsets an old briefing when this morning has none")`: `saveLastDigest(SENT_AT, PAYLOAD, 2, null)` → `update` equals `{ $set: { sentAt, title, body, devices: 2, seenAt: null }, $unset: { briefing: 1 } }`.
  - Add a `describe("markBriefingSeen")`:

```ts
it("marks only the briefing it was shown, and only once", async () => {
  findOneAndUpdate.mockResolvedValueOnce({ _id: "latest" });
  const at = new Date("2026-10-13T00:30:00Z");
  expect(await markBriefingSeen(SENT_AT, at)).toBe(true);
  expect(findOneAndUpdate).toHaveBeenCalledWith(
    { _id: "latest", sentAt: SENT_AT, seenAt: null },
    { $set: { seenAt: at } },
    { new: true, runValidators: true },
  );
});
it("reports a stale or already-seen briefing as not applied", async () => {
  findOneAndUpdate.mockResolvedValueOnce(null);
  expect(await markBriefingSeen(SENT_AT, new Date())).toBe(false);
});
```

  with `BRIEFING` defined at the top as a minimal valid `StoredBriefing`: `{ stories: [], today: "Nothing on today, and nothing due.", freelance: null, off: null, unrecognised: 0 }`.

  In `models.test.ts`, add a validation test: a `new LastDigest({...valid, briefing: { stories: [ { sentence: "x".repeat(241), bold: [], symptoms: [] } ], today: "", freelance: null, off: null, unrecognised: 0 } })` fails `validateSync()` on `briefing.stories.0.sentence`; one with 13 stories fails on `briefing.stories`; one with `causeKey: "nope"` fails on the enum; and a document with no `briefing` and no `seenAt` passes (old records stay valid).

- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/lastDigest.test.ts src/lib/__tests__/models.test.ts` → FAIL.

- [ ] **Step 3: Implement the model.** In `src/models/LastDigest.ts`, add (above `LastDigestSchema`):

```ts
import { BRIEFING_BOUNDS as B, CAUSE_KEYS, PROBLEM_KEYS, type StoredBriefing } from "@/lib/briefingTypes";

const maxItems = (n: number) => ({
  validator: (v: unknown[]) => Array.isArray(v) && v.length <= n,
  message: `at most ${n} items`,
});

const BoldSchema = new Schema(
  { start: { type: Number, required: true, min: 0 }, end: { type: Number, required: true, min: 0 } },
  { _id: false },
);

const SymptomSchema = new Schema(
  {
    key: { type: String, required: true, enum: PROBLEM_KEYS },
    sentence: { type: String, required: true, maxlength: B.symptomSentence },
    bold: { type: [BoldSchema], default: [], validate: maxItems(B.bold) },
    nextStep: { type: String, required: true, maxlength: B.nextStep },
    causeKey: { type: String, required: true, enum: CAUSE_KEYS },
    cause: { type: String, required: true, maxlength: B.cause },
    causeBold: { type: [BoldSchema], default: [], validate: maxItems(B.bold) },
    raw: { type: String, default: null, maxlength: B.raw },
  },
  { _id: false },
);

const StorySchema = new Schema(
  {
    sentence: { type: String, required: true, maxlength: B.storySentence },
    bold: { type: [BoldSchema], default: [], validate: maxItems(B.bold) },
    symptoms: { type: [SymptomSchema], default: [], validate: maxItems(B.symptoms) },
  },
  { _id: false },
);

const BriefingSchema = new Schema(
  {
    stories: { type: [StorySchema], default: [], validate: maxItems(B.stories) },
    // `today` may be "" (a read failed and its story says so) — not `required`,
    // which rejects the empty string; a default keeps it present.
    today: { type: String, default: "", maxlength: B.today },
    freelance: { type: String, default: null, maxlength: B.freelance },
    off: { type: String, default: null, maxlength: B.off },
    unrecognised: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);
```

extend `ILastDigest` with `briefing?: StoredBriefing; seenAt?: Date | null;`, and add to `LastDigestSchema`'s fields:

```ts
    briefing: { type: BriefingSchema, required: false },
    seenAt: { type: Date, default: null },
```

and append to the model docblock: `S21: \`briefing\` is the structured Briefing the site renders (typed sub-schemas, every string bounded, every array capped — no Mixed); \`seenAt\` is set once by markBriefingSeen and reset to null by each morning's save. Both optional, so records saved before S21 stay valid. No index change: _id is still the only index.`

**Model-import rule check:** `src/models/LastDigest.ts` importing `@/lib/briefingTypes` is allowed because that file is import-free. Add a one-line comment at the import saying so.

- [ ] **Step 4: Implement `src/lib/lastDigest.ts`:**

```ts
import type { StoredBriefing } from "@/lib/briefingTypes";

export interface StoredDigest {
  sentAt: Date;
  title: string;
  body: string;
  devices: number;
  /** S21. null = saved before S21, or the briefing couldn't be built that morning. */
  briefing: StoredBriefing | null;
  /** S21. When the full-screen greeting was dismissed; null = not yet today. */
  seenAt: Date | null;
}

const DIGEST_PROJECTION: Record<keyof StoredDigest, 1> & { _id: 0 } = {
  sentAt: 1,
  title: 1,
  body: 1,
  devices: 1,
  briefing: 1,
  seenAt: 1,
  _id: 0,
};
```

In `getLastDigest`, extend the `row` type with `briefing?: unknown; seenAt?: unknown` and return:

```ts
    briefing:
      typeof row.briefing === "object" && row.briefing !== null && Array.isArray((row.briefing as { stories?: unknown }).stories)
        ? (row.briefing as StoredBriefing)
        : null,
    seenAt: row.seenAt instanceof Date ? row.seenAt : null,
```

Replace `saveLastDigest`:

```ts
/**
 * Overwritten whole. One retry on E11000, then it throws. S21: the briefing
 * rides along (or an old one is unset), and seenAt is reset — a new morning
 * has not been seen.
 */
export async function saveLastDigest(
  sentAt: Date,
  payload: PushPayload,
  devices: number,
  briefing: StoredBriefing | null,
): Promise<void> {
  const base = { sentAt, title: payload.title, body: payload.body, devices, seenAt: null };
  const update =
    briefing === null ? { $set: base, $unset: { briefing: 1 } } : { $set: { ...base, briefing } };
  const write = () =>
    LastDigest.findOneAndUpdate({ _id: LAST_DIGEST_ID }, update, {
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    });

  try {
    await write();
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code !== 11000) throw err;
    await write();
  }
}

/**
 * S21 — the once-a-day full-screen greeting was dismissed. A guarded atomic
 * update (CLAUDE.md): only THIS morning's briefing (`sentAt`), and only while
 * unseen. A stale sentAt matches nothing, so it can never mark a newer
 * morning as seen. `{seenAt: null}` also matches a record saved before S21
 * (the field absent). Returns whether it applied. Throws only on a database
 * error; the caller reports that without blocking the page.
 */
export async function markBriefingSeen(sentAt: Date, at: Date): Promise<boolean> {
  const doc = await LastDigest.findOneAndUpdate(
    { _id: LAST_DIGEST_ID, sentAt, seenAt: null },
    { $set: { seenAt: at } },
    { new: true, runValidators: true },
  );
  return doc !== null;
}
```

- [ ] **Step 5: Fix the two other callers.** `src/app/(app)/personal/page.tsx` reads `StoredDigest` and passes it to `buildPushTileView` — still compiles (extra fields). `personalView.test.ts` builds `StoredDigest` literals — add `briefing: null, seenAt: null` to each (grep `devices:` in that file). Run `npx tsc --noEmit` and fix every literal it names, adding only those two fields.

- [ ] **Step 6: Run** `npx vitest run src/lib/__tests__/lastDigest.test.ts src/lib/__tests__/models.test.ts src/lib/__tests__/personalView.test.ts && npx tsc --noEmit` → PASS. (The route's `saveLastDigest` call now lacks the 4th argument — pass `null` there in this commit; A8 passes the real briefing.)

- [ ] **Step 7: Commit**

```bash
git add src/models/LastDigest.ts src/lib/lastDigest.ts src/lib/__tests__/lastDigest.test.ts src/lib/__tests__/models.test.ts src/lib/__tests__/personalView.test.ts src/app/api/cron/morning/route.ts
git commit -m "feat(last-digest): the saved push carries its Briefing and when it was seen"
```

---

### Task A8: Wire the morning route (Route Wirer)

**Files:** Modify `src/app/api/cron/morning/route.ts` only.

- [ ] **Step 1: Keep the attention error.** Replace the `fetchAttention(...).catch(...)` element with:

```ts
        fetchAttention(settings.chaserNDays, ATTENTION_LIMIT).then(
          (value) => ({ value, error: null as string | null }),
          (attentionErr: unknown) => {
            console.error("[cron/morning] attention check failed:", attentionErr);
            return { value: null, error: attentionErr instanceof Error ? attentionErr.message : String(attentionErr) };
          },
        ),
```

and destructure as `const [attentionRead, today] = …; const attention = attentionRead.value;`.

- [ ] **Step 2: Compose, send, then build the briefing.** Replace the composeDigest call through the `saveLastDigest` try/catch with:

```ts
      const digestInput: DigestInput = {
        day: todayKey(new Date()),
        pending,
        attention: attention
          ? { repliedUnanswered: attention.repliedUnanswered.length, overdue: attention.overdueActions?.length ?? 0 }
          : null,
        attentionError: attention ? null : attentionRead.error,
        problems,
        offAgents: settings.chaserEnabled ? [] : ["chaser"],
        today,
      };
      const digest = composeDigest(digestInput);

      // A tap opens the Briefing full-screen over the landing page (S21).
      const payload = buildPushPayload(digest.title, digest.body, "/freelance?briefing=open");
      const delivery = await sendPushToAll(payload);
      const sentAt = new Date();
      if (delivery.sent === 0) {
        throw new Error(
          `the digest reached no device (failed ${delivery.failed}, removed ${delivery.removed}). ` +
            "Re-subscribe from /freelance/queue."
        );
      }

      // The Briefing is built AFTER the send and inside its own catch: it is
      // derived from the same sentences, but a bug in it must never cost the
      // push that already went out (spec §7.2). Without it the record is saved
      // plain and the site shows the quoted text.
      let briefing: StoredBriefing | null = null;
      try {
        briefing = buildBriefing(digestInput);
      } catch (err) {
        console.error("[cron/morning] briefing could not be built:", err);
      }

      let digestStored = true;
      try {
        await saveLastDigest(sentAt, payload, delivery.sent, briefing);
      } catch (err) {
        digestStored = false;
        console.error("[cron/morning] last digest write failed:", err);
      }
      const failedItems = (digestStored ? 0 : 1) + (briefing === null ? 1 : 0);
      return {
        counts: { itemsProcessed: problems.length, itemsFailed: failedItems },
        data: digest,
      };
```

Imports: `import { buildBriefing, composeDigest, type DigestInput } from "@/lib/digest"; import { buildProblems } from "@/lib/problems"; import type { StoredBriefing } from "@/lib/briefingTypes";`. Keep the existing comments about the delivery guard and R22 (move them above the new code unchanged).

- [ ] **Step 3: Keep the route failure alert and the monitoring-off alerts as they are** (spec §3.4 — plain wording stays for alerts).

- [ ] **Step 4: Verify.** `npx tsc --noEmit` → clean. `npm test` → all green. `grep -n "TEMPORARY" src/app/api/cron/morning/route.ts` → no output.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/morning/route.ts
git commit -m "feat(cron/morning): send the voiced push, then save its Briefing; a tap opens the Briefing"
```

---

### Task A9: Principal review, then verification (Principal Reviewer, Verification Lead)

- [ ] **Step 1: Principal cross-module review** (one reviewer, all of A1–A8 at once). Brief: "Read the spec §2–§4 and §7, then `voice.ts`, `problems.ts`, `causes.ts`, `stories.ts`, `digest.ts`, `lastDigest.ts`, the model and the route as one system. Look for seams: a problem key with no catalogue row; a chain that can drop or duplicate a symptom; a page/push apostrophe mix; a stored string that can exceed its bound; R23 broken by any mood path; the freelance line sliced by the payload; a briefing failure that can cost the push; `seenAt` not reset by a save. Report findings; don't edit." Fix rounds go back to the owning builder.

- [ ] **Step 2: The trio + lint baseline.**

```bash
npm test
npx tsc --noEmit
npm run build
npm run lint
```

Expected: tests all green (count recorded in the post-build record), tsc clean, build green, lint at its baseline: four `react-hooks/set-state-in-effect` errors and three warnings, exit 1. A fifth error or a fourth warning fails the step.

- [ ] **Step 3: A rendered sample, no network.** Write a throwaway script in the scratchpad (not the repo) that imports `composeDigest`/`buildBriefing` through `npx tsx` and prints the push for five fixtures: clear Monday, busy Wednesday, one-problem Thursday, the ShikksTracker-down chain, and a twelve-problem night. Paste the five outputs into the post-build record so Riku can read the voice before 07:00.

- [ ] **Step 4: Riku's observation (his hands, next morning).** The 07:00 push arrives in the new voice. The Personal page tile still quotes it (Plan B removes the tile). Tapping the push opens `/freelance` (the `?briefing=open` parameter does nothing until Plan B).

---

## Post-build record

*(Filled in by the lead after A9: commits, test count, deviations taken, the five sample pushes, findings and their fixes, and what remains for Riku.)*
