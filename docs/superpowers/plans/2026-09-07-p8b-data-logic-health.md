# P8b — Data, logic and the health reading: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every pure function, type and stored record the Freelance page needs, so that Plan C's page and blocks are a renderer with no decisions left in them.

**Architecture:** ShikksTracker's contract is widened in `src/lib/stApi.ts` — interface **and** `fetchSummary`'s reconstruction in the same change, because widening the type alone yields `undefined` at runtime with a green type-check. Every decision the page makes then lives in a pure module under `src/lib/`, tested without a database or a network: `freelanceView` (Blocks A, B, C), `freelanceVariants` (D), `freelanceGaps` (E), `freelanceHealth` (F), with shared string primitives in `format`. The site-health reading becomes a stored singleton (`HealthSnapshot`) written by the existing morning cron and re-readable through one thin `POST /api/health/sites` whose single decision — a 60-second floor — is itself a pure function.

**Tech Stack:** Next.js 16.2.10 (App Router) · TypeScript `strict` · Mongoose 9 · Vitest 4. **No new dependency.**

---

## The series, and where this plan sits

**Plan A** (`docs/superpowers/plans/2026-09-07-p8a-shell-and-skin.md`) shipped the shell and the four stylesheets. **Its "Series file map" section is the authority on every file all three plans touch** — read it before starting, and do not rename anything in it. This plan implements the rows that map lists under **Plan B**. Plan C then implements the rows listed under **Plan C**.

**Two things Plan A already exported that this plan consumes:**

- `AGENT_STALE_HOURS` (= 30) from `src/lib/watchdog.ts` — Block F's 30-hour stored-snapshot rule reads the same constant the rail's overdue rule does. Two hardcoded `30`s in two files is how they drift apart.
- Nothing else. Plan A's shell components are not imported here.

**Nothing from Plan C belongs in this plan.** No JSX, no `page.tsx`, no `_blocks/`, no `CheckNow` island. Every module here returns plain data — strings, numbers, nulls and small unions — and never a React node.

---

## Types Plan C will render

Plan C's JSX consumes these unchanged. They are settled here so Plan C never has to invent a shape or re-derive a string.

**Shared primitives — `src/lib/format.ts`**

```ts
export type CellTone = "value" | "zero" | "dash";
export interface Cell { text: string; tone: CellTone }

export function numberCell(value: number | null): Cell;   // null -> "—"/dash, 0 -> "0"/zero
export function pluralise(count: number, singular: string, plural?: string): string;
export function formatAge(ms: number): string;            // "6h" | "36h" | "3d" | "29d"
export function formatWaiting(ms: number): string;        // "just now" | "4 hours ago" | "2 days ago" | "3 weeks ago"
```

**Block A — `src/lib/freelanceView.ts`**

```ts
export type StatTone = "roi" | "stale" | "plain" | "drained" | "blank";

export interface StatCard {
  key: "drafts" | "contacts" | "needs-you";
  tone: StatTone;            // -> className `stat ${tone}`
  label: string;             // "Drafts" | "Contacts" | "Needs you"
  figure: string;            // "24" | "0" | "—"
  caption: string;
  href: string | null;       // only the drafts card; label is always `Open ↗`
  trackPercent: number | null; // 0-100, or null when no track is drawn
}

export interface SayLine {
  figure: string | null;     // rendered in <b>; null = a statement with no figure
  text: string;              // Plan C renders `{figure} {text}` with one space, or just {text}
}

export interface BlockA { cards: StatCard[]; lines: SayLine[] }   // cards is always length 3
```

**Block B — `src/lib/freelanceView.ts`**

```ts
export interface PipelineSummary {
  total: number;
  totalWord: string;         // "contacts" | "contact"
  hot: number | null;        // null = the `· N hot` clause is dropped
  hotWord: string;           // "hot"
}

export interface PipelineStageRow { key: PipelineStage; label: string; count: number }

export type BlockB =
  | { kind: "failed"; line: string }
  | { kind: "empty"; line: string }
  | {
      kind: "stages";
      summary: PipelineSummary;
      rows: PipelineStageRow[];
      emptyNote: string | null;     // .fl-note  "Nothing yet at won or lost"
      absentNote: string | null;    // .fl-absent "ShikksTracker didn't report every pipeline stage."
      hotAbsentNote: string | null; // .fl-absent "ShikksTracker didn't report how many are hot."
    };
```

**Block C — `src/lib/freelanceView.ts`**

```ts
export interface CampaignRow { id: string; name: string; cells: Cell[] }  // sent, opened, clicked, replied

export type BlockC =
  | { kind: "failed"; line: string }
  | { kind: "empty"; line: string }
  | {
      kind: "table";
      count: number;         // .fl-count — the TOTAL, before the display bound
      headers: string[];     // ["Campaign","Sent","Opened","Clicked","Replied"]
      rows: CampaignRow[];   // bounded to CAMPAIGN_DISPLAY_BOUND
      bound: string | null;  // "Showing 20 of 34 campaigns."
      honesty: string;       // the tracking-pixel footnote — always shown when open
    };
```

**Block D — `src/lib/freelanceVariants.ts`**

```ts
export interface ApproachRow { key: string; name: string; cells: Cell[] }  // rate, sends[, replies]

export interface ApproachGroup {
  eyebrow: string;          // "Measured — email" | "Not measurable"
  explain: string | null;   // group 2's line, ABOVE its rows
  headers: string[];
  rows: ApproachRow[];
}

export type CollapsedLine =
  | { kind: "statement"; text: string }            // "No sends yet — nothing to compare."
  | { kind: "best"; name: string; rate: string };  // name at --ink-2, rate at --ink 600

export type BlockD =
  | { kind: "failed"; line: string }
  | { kind: "empty"; line: string }
  | {
      kind: "groups";
      defaultOpen: boolean;        // R31
      collapsed: CollapsedLine;
      groups: ApproachGroup[];     // always exactly two, in order
      honesty: string | null;      // R27 — only when at least one rate is printed
    };
```

**Block E — `src/lib/freelanceGaps.ts`**

```ts
export type GapKind = "unsupported-channel" | "no-draft" | "overdue-followup";

export interface GapRow {
  id: string;                  // stable React key
  kind: GapKind;
  businessName: string;
  href: string;                // link out to the contact in ShikksTracker
  channel: string | null;      // "Email" | "Facebook" | "Instagram" | "Phone"; null on kind 3
  waiting: string;             // "replied 2 days ago" | "follow-up due 3 days ago"
  waitingIsStale: boolean;     // true only on kind 3 -> .pwhen.is-stale
  snippet: string | null;      // .fl-snip
  reason: string | null;       // .fl-why
}

export type BlockE =
  | { kind: "failed"; line: string }
  // The reply feed loaded, nothing survived suppression, and the overdue feed
  // was NOT reported. `line` is "ShikksTracker didn't report overdue
  // follow-ups." — never "Nothing waiting." (R51).
  | { kind: "absent"; line: string }
  | { kind: "empty"; line: string }
  // absentNote carries the same sentence under measured rows when only the
  // overdue feed is missing: the rows are real and the total may be higher.
  | { kind: "rows"; count: number; rows: GapRow[]; bound: string | null; absentNote: string | null };
```

`needsYouFigure(block: BlockE): NeedsYouFigure` is exported from `freelanceGaps.ts` as the one bridge to Block A's third card (R54) — `failed` → failed, `absent` → absent, `empty` → measured 0, `rows` → measured count. `NeedsYouFigure` itself is declared in `freelanceView.ts`, so the import direction stays `freelanceGaps → freelanceView`.

**Block F — `src/lib/freelanceHealth.ts`**

```ts
export interface HealthPart { text: string; aged: boolean }        // aged -> .aged (--stale)
export interface HealthWarning { tone: "stale" | "missing"; text: string }

export type BlockF =
  | { kind: "quiet"; parts: HealthPart[] }   // joined by <i>·</i>
  | { kind: "alarm"; warnings: HealthWarning[]; fine: string[]; stamp: HealthPart };
```

**Failure strings — `src/lib/freelanceView.ts`**

```ts
export const FAIL_LINES: {
  pipeline: string; campaigns: string; approaches: string; needsYou: string;
  page: { said: string; because: string };
};
```

**Two URLs Plan C builds server-side and passes in**, so no view model reads an environment variable and `ST_API_BASE_URL` never reaches the client:

- `draftsUrl` = `` `${readStConfig().baseUrl}/review` `` — ShikksTracker's draft-approval page.
- `contactsBaseUrl` = `` `${readStConfig().baseUrl}/contacts` `` — `freelanceGaps` appends `/{contactId}`.

---

## Ground rules for every task in this plan

- **Repo boundary.** `../ShikksTracker` is read-only from here and its database is never touched. Everything comes through `/api/os/*`.
- **No new dependency.** No CSP change. No new `NEXT_PUBLIC_*`.
- **Every string in a view model is verbatim** from `docs/superpowers/specs/2026-09-05-p8-freelance-page-content.md` (the deck — the authority) or the spec's §4, and every test pins it character for character.
- **Mongo rules (CLAUDE.md).** `maxlength` on every String, `enum` for every closed set, `Date` never a string, no `Schema.Types.Mixed`, bounded arrays, explicit `timestamps`, and **no upsert on read**.
- Commands are for **Git Bash on Windows** from the repo root. Single test files run with `npx vitest run <path>`; the whole suite with `npm test`.
- Commits are on `master`, never pushed, and every message ends with the trailer shown in the commit step.

---

## Task 1: `format.ts` — the shared string primitives

`formatAge` already exists inside `src/lib/outreachHealth.ts` and produces exactly Block F's grammar. It **moves** here and is re-imported there, rather than being copied — a second implementation would drift. Its existing `describe("formatAge")` block moves out of `outreachHealth.test.ts` into `format.test.ts` in the same change, so there is one implementation with one test home.

Unprefixed on purpose: Personal and Academics need the same two age grammars.

**Files:**
- Create: `src/lib/format.ts`
- Test: `src/lib/__tests__/format.test.ts` (create)
- Modify: `src/lib/outreachHealth.ts`
- Modify: `src/lib/__tests__/outreachHealth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/format.test.ts`:

```ts
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
import { formatAge, formatWaiting, pluralise, numberCell } from "@/lib/format";

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

describe("numberCell", () => {
  it("distinguishes a measured zero from an absence — the page's core rule", () => {
    expect(numberCell(0)).toEqual({ text: "0", tone: "zero" });
    expect(numberCell(null)).toEqual({ text: "—", tone: "dash" });
    expect(numberCell(5)).toEqual({ text: "5", tone: "value" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/format.test.ts`
Expected: FAIL — a module resolution error, `Failed to resolve import "@/lib/format"`.

- [ ] **Step 3: Create `src/lib/format.ts`**

```ts
/**
 * format.ts — shared presentation primitives.
 *
 * DELIBERATELY UNPREFIXED. Personal and Academics need the same two age
 * grammars and the same pluraliser; a `freelance`-prefixed copy would be
 * duplicated the day the second page is built.
 *
 * Two age grammars live here side by side because the app genuinely has two:
 * a machine stamp (`36h`, `3d`) for the health strip, and a human duration
 * (`4 hours ago`, `3 weeks ago`) for what is waiting on a person. Do not merge
 * them, and do not "fix" one to look like the other.
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * Block F's stamp. Hours read badly past a couple of days; the real fault this
 * grammar was written for was 696h old.
 *
 * MOVED here from outreachHealth.ts unchanged. That file now imports it, so
 * there is exactly one implementation of the digest's `last ran 3d ago` and
 * the page's `checked 6h ago`. They must never disagree.
 */
export function formatAge(ms: number): string {
  const hours = Math.floor(ms / HOUR_MS);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Singular at exactly one; everything else — zero included — takes the plural. */
export function pluralise(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/**
 * Block E's waiting line: `just now` under an hour, then hours, days, weeks.
 *
 * A negative age — a clock skew between ShikksTracker and Vercel — reads as
 * `just now` rather than a negative duration. It is the only honest answer:
 * as far as this machine can tell the event is not in the past yet.
 */
export function formatWaiting(ms: number): string {
  if (ms < HOUR_MS) return "just now";
  if (ms < DAY_MS) {
    const hours = Math.floor(ms / HOUR_MS);
    return `${hours} ${pluralise(hours, "hour")} ago`;
  }
  if (ms < WEEK_MS) {
    const days = Math.floor(ms / DAY_MS);
    return `${days} ${pluralise(days, "day")} ago`;
  }
  const weeks = Math.floor(ms / WEEK_MS);
  return `${weeks} ${pluralise(weeks, "week")} ago`;
}

export type CellTone = "value" | "zero" | "dash";

export interface Cell {
  text: string;
  /** -> the `.zero` / `.dash` class in components.css; "value" takes neither. */
  tone: CellTone;
}

/**
 * The page's central correctness rule in four lines: `0` is a measurement and
 * `—` is an absence, and rendering both the same way is a bug rather than a
 * style choice. `--ink-4` is reserved for the absences.
 */
export function numberCell(value: number | null): Cell {
  if (value === null) return { text: "—", tone: "dash" };
  if (value === 0) return { text: "0", tone: "zero" };
  return { text: String(value), tone: "value" };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/format.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  10 passed (10)`.

- [ ] **Step 5: Re-import `formatAge` in `src/lib/outreachHealth.ts`**

Add this import directly under the existing `import type { SummaryResponse } from "@/lib/stApi";` line:

```ts
import { formatAge } from "@/lib/format";
```

Then delete the local definition — the comment and the function, currently lines 86–91:

```ts
/** Hours read badly past a couple of days; the real fault was 696h old. */
export function formatAge(ms: number): string {
  const hours = Math.floor(ms / HOUR_MS);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
```

`HOUR_MS` stays — `evaluateOutreach` still uses it for the staleness comparison.

- [ ] **Step 6: Move the `formatAge` block out of `outreachHealth.test.ts`**

In `src/lib/__tests__/outreachHealth.test.ts`, change the import on line 19 from:

```ts
import { evaluateOutreach, formatAge, ENGINE_STALE_HOURS } from "@/lib/outreachHealth";
```

to:

```ts
import { evaluateOutreach, ENGINE_STALE_HOURS } from "@/lib/outreachHealth";
```

Then delete the whole `describe("formatAge", …)` block that begins at line 172. Its four assertions (`1h`, `47h`, `48h`, `696h`) are already covered character for character by `format.test.ts`'s first two blocks — nothing is lost.

- [ ] **Step 7: Run the affected suites and the type-check**

Run: `npx vitest run src/lib/__tests__/outreachHealth.test.ts src/lib/__tests__/format.test.ts`
Expected: `Test Files  2 passed (2)`, and no failure mentioning `formatAge`.

Run: `npm test`
Expected: every suite passes.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 8: Confirm there is exactly one implementation**

Run: `git grep -n --untracked "export function formatAge" src/`
Expected: one line, `src/lib/format.ts`. **`--untracked` is required** — `format.ts` is new and not yet committed at this step, and `git grep` without it searches only tracked files and would report the move as complete while the new implementation is invisible (Batch 1 review).

- [ ] **Step 9: Commit**

```bash
git add src/lib/format.ts src/lib/outreachHealth.ts src/lib/__tests__/format.test.ts src/lib/__tests__/outreachHealth.test.ts
git commit -F - << 'MSG'
feat(p8b): move formatAge into format.ts and add the page's other primitives

One implementation of the 3d / 36h grammar, shared by the digest and the
Freelance page's health strip, so the two can never disagree. Its tests move
with it rather than being duplicated.

Adds the Block E waiting grammar (just now / 4 hours ago / 3 weeks ago),
pluralise, and numberCell — which encodes the page's central rule that a
measured 0 and an unreported em-dash are different findings and must never
render the same way.

Unprefixed deliberately: Personal and Academics need the same two grammars.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 2: Widen `SummaryResponse`, and carry the new blocks through `fetchSummary`

**Widening the interface alone yields `undefined` at runtime with a green type-check.** `fetchSummary` reconstructs its return value field by field, and that exact pair was missed once already, in P4's `overdueActions`. The interface and the reconstruction change together, in this task, with a test that reads the reconstructed object.

Field names verified against `../ShikksTracker/docs/os-api.md` and `../ShikksTracker/src/lib/os/summary.ts` (read-only): `contacts.total`, `contacts.hot`, `contacts.byPipelineStage.<stage>`, and `campaigns[].{id,name,sent,opened,clicked,replied}`.

**Files:**
- Modify: `src/lib/stApi.ts`
- Test: `src/lib/__tests__/stApi.test.ts` (extend)
- Modify: `src/lib/__tests__/outreachHealth.test.ts` (its `SummaryResponse` fixture)

- [ ] **Step 1: Write the failing tests**

In `src/lib/__tests__/stApi.test.ts`, replace the existing test named `carries every consumed field through — widening the type alone is not enough` (it currently asserts `toEqual({ queue, engine })`, which two new required keys would break) with this block, and add the **six** tests after it, all inside the existing `describe("fetchSummary", …)` — the prose said four and the block holds six (Batch 1 review):

```ts
  it("carries every consumed field through — widening the type alone is not enough", async () => {
    // The trap this file has already sprung once: the return value is
    // RECONSTRUCTED, so a field added to the interface but not to the object
    // below arrives undefined at runtime and the check silently reads clean.
    respond({
      queue: { drafts: 24, approved: 2 },
      engine: { lastRunAt: "2026-08-01T07:06:27.319Z", lastRunErrors: 3 },
      contacts: {
        total: 30,
        hot: 2,
        byPipelineStage: {
          not_started: 25,
          contacted: 3,
          replied: 2,
          call_booked: 0,
          proposal_sent: 0,
          won: 0,
          lost: 0,
        },
      },
      campaigns: [{ id: "c1", name: "Test One", sent: 5, opened: 2, clicked: 0, replied: 2 }],
    });
    expect(await fetchSummary()).toEqual({
      queue: { drafts: 24, approved: 2 },
      engine: { lastRunAt: "2026-08-01T07:06:27.319Z", lastRunErrors: 3 },
      contacts: {
        total: 30,
        hot: 2,
        byPipelineStage: {
          not_started: 25,
          contacted: 3,
          replied: 2,
          call_booked: 0,
          proposal_sent: 0,
          won: 0,
          lost: 0,
        },
      },
      campaigns: [{ id: "c1", name: "Test One", sent: 5, opened: 2, clicked: 0, replied: 2 }],
    });
  });

  it("reads a missing contacts block as null, not as seven zeros", async () => {
    respond({ queue: {}, engine: {} });
    const out = await fetchSummary();
    expect(out.contacts).toBeNull();
    expect(out.campaigns).toBeNull();
  });

  it("keys byPipelineStage by exactly PIPELINE_STAGES, with absent stages null", async () => {
    respond({
      queue: {},
      engine: {},
      contacts: { total: 30, hot: 2, byPipelineStage: { not_started: 25, contacted: 3 } },
    });
    const out = await fetchSummary();
    expect(Object.keys(out.contacts!.byPipelineStage)).toEqual([...PIPELINE_STAGES]);
    expect(out.contacts!.byPipelineStage.not_started).toBe(25);
    // The stage the API omitted must never read as a measured zero.
    expect(out.contacts!.byPipelineStage.won).toBeNull();
  });

  it("reads a non-numeric contacts count as null", async () => {
    respond({
      queue: {},
      engine: {},
      contacts: { total: "30", hot: null, byPipelineStage: { not_started: Number.NaN } },
    });
    const out = await fetchSummary();
    expect(out.contacts!.total).toBeNull();
    expect(out.contacts!.hot).toBeNull();
    expect(out.contacts!.byPipelineStage.not_started).toBeNull();
  });

  it("keeps a campaigns array that is present but empty distinct from an absent one", async () => {
    respond({ queue: {}, engine: {}, campaigns: [] });
    expect((await fetchSummary()).campaigns).toEqual([]);

    respond({ queue: {}, engine: {} });
    expect((await fetchSummary()).campaigns).toBeNull();
  });

  it("carries every campaign column through, nulling the ones that did not arrive", async () => {
    respond({
      queue: {},
      engine: {},
      campaigns: [
        { id: "c1", name: "Test One", sent: 5, opened: 2, clicked: 0, replied: 2 },
        { id: "c2", name: "Test number 2" },
      ],
    });
    const rows = (await fetchSummary()).campaigns!;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      id: "c1",
      name: "Test One",
      sent: 5,
      opened: 2,
      clicked: 0,
      replied: 2,
    });
    expect(rows[1]).toEqual({
      id: "c2",
      name: "Test number 2",
      sent: null,
      opened: null,
      clicked: null,
      replied: null,
    });
  });

  it("drops a campaign row that is not an object rather than throwing", async () => {
    respond({ queue: {}, engine: {}, campaigns: [null, "nope", { id: "c1", name: "Real" }] });
    const rows = (await fetchSummary()).campaigns!;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("c1");
  });
```

Then extend the import at the top of the file to bring in `PIPELINE_STAGES`:

```ts
import {
  readStConfig,
  classifyDraftStatus,
  classifyFetchError,
  createDraft,
  fetchAttention,
  fetchSummary,
  PIPELINE_STAGES,
  ST_TIMEOUT_MS,
} from "@/lib/stApi";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/stApi.test.ts`
Expected: FAIL — `PIPELINE_STAGES` is not exported, and the carry-through assertions report `contacts` / `campaigns` missing from the received object.

- [ ] **Step 3: Widen the contract shapes in `src/lib/stApi.ts`**

Replace the `SummaryResponse` interface (currently lines 99–102) with the block below, leaving `SummaryEngine` and `SummaryQueue` above it exactly as they are:

```ts
/**
 * The pipeline stages, in pipeline order. Exported because Block B renders in
 * this order and Block A reads `not_started` from it, and because the key set
 * is what makes "a stage the API omitted" detectable at all.
 * Source: ../ShikksTracker/docs/os-api.md and its src/lib/os/summary.ts.
 */
export const PIPELINE_STAGES = [
  "not_started",
  "contacted",
  "replied",
  "call_booked",
  "proposal_sent",
  "won",
  "lost",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export interface SummaryContacts {
  total: number | null;
  hot: number | null;
  /** Always all seven keys. A stage the API omitted is null, never 0. */
  byPipelineStage: Record<PipelineStage, number | null>;
}

export interface SummaryCampaign {
  id: string;
  name: string;
  sent: number | null;
  opened: number | null;
  clicked: number | null;
  replied: number | null;
}

export interface SummaryResponse {
  queue: SummaryQueue;
  engine: SummaryEngine;
  /** null = the whole block was absent. Distinct from a block of nulls. */
  contacts: SummaryContacts | null;
  /** null = the whole block was absent. `[]` = the API reported no campaigns. */
  campaigns: SummaryCampaign[] | null;
}
```

- [ ] **Step 4: Carry them through `fetchSummary`'s reconstruction**

Add these two helpers immediately after the existing `readStamp` function:

```ts
/** A campaign id or name that is not a string is a contract break, not a value. */
function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Always returns all seven keys, so `Object.keys` is a reliable statement about
 * the contract and a stage the API omitted reads as null rather than a zero.
 */
function readPipeline(value: unknown): Record<PipelineStage, number | null> {
  const raw = (value ?? {}) as Record<string, unknown>;
  const out = {} as Record<PipelineStage, number | null>;
  for (const stage of PIPELINE_STAGES) out[stage] = readCount(raw[stage]);
  return out;
}
```

Then replace `fetchSummary`'s parse-and-return (currently lines 336–350) with:

```ts
  const parsed = (await res.json()) as {
    queue?: Record<string, unknown>;
    engine?: Record<string, unknown>;
    contacts?: Record<string, unknown>;
    campaigns?: unknown;
  };

  // `limit` is not sent, so ShikksTracker applies its own default of 50 to the
  // campaigns array (docs/os-api.md). Past 50 campaigns the page's
  // "Showing 20 of N" would understate N; there are 2 today and the ceiling is
  // recorded rather than defended against.
  return {
    queue: {
      drafts: readCount(parsed.queue?.drafts),
      approved: readCount(parsed.queue?.approved),
    },
    engine: {
      lastRunAt: readStamp(parsed.engine?.lastRunAt),
      lastRunErrors: readCount(parsed.engine?.lastRunErrors),
    },
    contacts:
      parsed.contacts === null || parsed.contacts === undefined
        ? null
        : {
            total: readCount(parsed.contacts.total),
            hot: readCount(parsed.contacts.hot),
            byPipelineStage: readPipeline(parsed.contacts.byPipelineStage),
          },
    campaigns: Array.isArray(parsed.campaigns)
      ? parsed.campaigns
          .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
          .map((row) => ({
            id: readText(row.id),
            name: readText(row.name),
            sent: readCount(row.sent),
            opened: readCount(row.opened),
            clicked: readCount(row.clicked),
            replied: readCount(row.replied),
          }))
      : null,
  };
```

Finally, replace the stale paragraph in `SummaryEngine`'s doc comment — the sentence beginning "`contacts` and `campaigns` are returned too and are deliberately left unmodelled" — with:

```
 * `contacts` and `campaigns` earned their types in P8 (the Freelance page).
 * Widening this file's interfaces is never sufficient on its own — fetchSummary
 * RECONSTRUCTS its return value, so a new field must be carried through there in
 * the same change or it silently arrives undefined. That exact pair was missed
 * once already, in P4's `overdueActions`.
```

- [ ] **Step 5: Fix the one `SummaryResponse` fixture outside this file**

`src/lib/__tests__/outreachHealth.test.ts` builds a `SummaryResponse` literal, which two new required keys now reject. Change its `summary()` helper to:

```ts
// The baseline is a HEALTHY summary, so every test asserts against a quiet
// default rather than around an alarm it never meant to raise. `contacts` and
// `campaigns` are null because evaluateOutreach reads neither — it judges the
// engine and the queue only.
function summary(over: Partial<SummaryResponse> = {}): SummaryResponse {
  return {
    queue: { drafts: 24, approved: 0 },
    engine: { lastRunAt: hoursAgo(2), lastRunErrors: 0 },
    contacts: null,
    campaigns: null,
    ...over,
  };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/stApi.test.ts src/lib/__tests__/outreachHealth.test.ts`
Expected: `Test Files  2 passed (2)`, zero failures.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/stApi.ts src/lib/__tests__/stApi.test.ts src/lib/__tests__/outreachHealth.test.ts
git commit -F - << 'MSG'
feat(p8b): model contacts and campaigns, and carry them through fetchSummary

The interface and the reconstruction change together, because fetchSummary
rebuilds its return value field by field and widening the type alone yields
undefined at runtime with a green type-check — the exact pair missed once
before, in P4's overdueActions.

byPipelineStage always carries all seven keys, so a stage ShikksTracker
omitted arrives as null and never as a measured zero. An absent contacts or
campaigns block is null; an empty campaigns array stays [].

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 3: `fetchVariantStats`, the page timeout, and an optional timeout on all three GETs

`ST_TIMEOUT_MS` is 15 s, which is right for a cron and wrong for a human: three hung calls in parallel can outlive the function budget and hand Riku a Vercel error page instead of the deck's carefully written `Couldn't reach ShikksTracker.` The parameter is optional and defaults to the existing value, so every cron caller is unchanged.

`GET /api/os/variant-stats` returns a **bare JSON array**, not an envelope — verified in `../ShikksTracker/src/app/api/os/variant-stats/route.ts` (read-only).

**Files:**
- Modify: `src/lib/stApi.ts`
- Test: `src/lib/__tests__/stApi.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append these two `describe` blocks to `src/lib/__tests__/stApi.test.ts`, after the existing `describe("fetchSummary", …)`:

```ts
describe("fetchVariantStats", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
    vi.unstubAllEnvs();
  });

  function respond(body: unknown, status = 200) {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(body), { status })) as typeof fetch;
  }

  it("throws with a diagnosable message on a non-200", async () => {
    respond([], 503);
    await expect(fetchVariantStats()).rejects.toThrow(/503/);
  });

  it("parses the row shape from the bare array the endpoint returns", async () => {
    respond([
      {
        key: "email-s1-compliment",
        label: "Email S1 — specific compliment first",
        channel: "email",
        stage: 1,
        sends: 72,
        uniqueContacts: 70,
        replies: 8,
        replyRate: 0.1111,
        bySlice: { leadSource: {}, webPresenceTier: {} },
      },
    ]);
    const rows = await fetchVariantStats();
    expect(rows).toEqual([
      {
        key: "email-s1-compliment",
        label: "Email S1 — specific compliment first",
        channel: "email",
        stage: 1,
        sends: 72,
        uniqueContacts: 70,
        replies: 8,
        replyRate: 0.1111,
      },
    ]);
  });

  it("nulls the metadata a deleted Variant leaves behind rather than inventing it", async () => {
    respond([{ key: "orphan", label: null, channel: null, stage: null, sends: 4, replies: 0 }]);
    const rows = await fetchVariantStats();
    expect(rows[0].label).toBeNull();
    expect(rows[0].channel).toBeNull();
    expect(rows[0].sends).toBe(4);
    expect(rows[0].uniqueContacts).toBeNull();
  });

  it("survives a body that is not an array rather than throwing", async () => {
    respond({ variants: [] });
    expect(await fetchVariantStats()).toEqual([]);
  });

  it("drops a row with no string key — it can never be identified or keyed", async () => {
    respond([{ label: "nameless" }, { key: "good", label: "Good" }]);
    const rows = await fetchVariantStats();
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("good");
  });

  it("sends the secret in the header and never in the URL", async () => {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
    let seenUrl = "";
    let seenHeaders: Record<string, string> = {};
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seenUrl = String(url);
      seenHeaders = init.headers as Record<string, string>;
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;
    await fetchVariantStats();
    expect(seenUrl).toBe("https://st.example.com/api/os/variant-stats");
    expect(seenUrl).not.toContain(GOOD_SECRET);
    expect(seenHeaders["x-os-secret"]).toBe(GOOD_SECRET);
  });
});

describe("the page timeout", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
    vi.unstubAllEnvs();
  });

  it("is well under the cron timeout — a human must not wait a cron's patience", () => {
    expect(ST_PAGE_TIMEOUT_MS).toBeGreaterThan(0);
    expect(ST_PAGE_TIMEOUT_MS).toBeLessThan(ST_TIMEOUT_MS);
  });

  it("is optional on all three GETs, and defaults to the cron timeout", async () => {
    // AbortSignal.timeout is the only observable difference, so the assertion
    // is on the signal each call was handed rather than on wall-clock time.
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
    const seen: (AbortSignal | undefined)[] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      seen.push(init.signal ?? undefined);
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;

    await fetchSummary();
    await fetchSummary(ST_PAGE_TIMEOUT_MS);
    await fetchAttention(3, 50);
    await fetchAttention(3, 50, ST_PAGE_TIMEOUT_MS);
    await fetchVariantStats();
    await fetchVariantStats(ST_PAGE_TIMEOUT_MS);

    expect(seen).toHaveLength(6);
    for (const signal of seen) expect(signal).toBeInstanceOf(AbortSignal);
  });
});
```

Extend the import at the top of the file to add the three new names:

```ts
import {
  readStConfig,
  classifyDraftStatus,
  classifyFetchError,
  createDraft,
  fetchAttention,
  fetchSummary,
  fetchVariantStats,
  PIPELINE_STAGES,
  ST_PAGE_TIMEOUT_MS,
  ST_TIMEOUT_MS,
} from "@/lib/stApi";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/stApi.test.ts`
Expected: FAIL — `fetchVariantStats` and `ST_PAGE_TIMEOUT_MS` are not exported from `@/lib/stApi`.

- [ ] **Step 3: Add the page timeout beside the cron one in `src/lib/stApi.ts`**

Replace the existing `ST_TIMEOUT_MS` declaration (line 31) with:

```ts
/** Explicit timeout on every external call (CLAUDE.md). The cron's patience. */
export const ST_TIMEOUT_MS = 15_000;

/**
 * A PAGE's patience, which is a different thing. Three parallel calls at the
 * cron's 15 s can outlive the function budget and hand Riku a Vercel error page
 * instead of the deck's `Couldn't reach ShikksTracker.` — the single most likely
 * way the Freelance page fails badly in production. The page's own
 * `maxDuration` is a second belt.
 */
export const ST_PAGE_TIMEOUT_MS = 6_000;
```

- [ ] **Step 4: Add the variant-stats shape and call**

Add this after the `SummaryResponse` interface:

```ts
/**
 * One row of GET /api/os/variant-stats. The endpoint returns a BARE ARRAY, not
 * an envelope, and is documented as deliberately not truncated — so the display
 * bound is ours to enforce.
 *
 * `replyRate` is modelled so the shape is honest about what arrives, and it is
 * NEVER PRINTED. ShikksTracker computes it as a 4-dp fraction and returns 0 for
 * zero sends, which is precisely the lie Block D exists to refuse: since S15
 * replies are only ever detected on email, so a Facebook, Instagram or phone
 * variant's 0 is not a measurement, it is an absence of measurement. Block D
 * recomputes from `sends` and `replies`.
 *
 * `bySlice` (the lead-source and web-presence breakdowns) is returned by the
 * endpoint and deliberately left unmodelled: nothing consumes it, and a type
 * shipped without a consumer is an invitation.
 */
export interface VariantStatsItem {
  key: string;
  /** null when the Variant was deleted after its logs were stamped. */
  label: string | null;
  channel: string | null;
  stage: number | null;
  sends: number | null;
  uniqueContacts: number | null;
  replies: number | null;
  /** Never rendered. See above. */
  replyRate: number | null;
}
```

Then add this function after `fetchSummary`:

```ts
/**
 * GET /api/os/variant-stats. Throws on any failure, exactly as the other two
 * GETs do and for the same reason: a GET has no side effect to protect.
 */
export async function fetchVariantStats(
  timeoutMs: number = ST_TIMEOUT_MS
): Promise<VariantStatsItem[]> {
  const { baseUrl, secret } = readStConfig();

  const res = await fetch(`${baseUrl}/api/os/variant-stats`, {
    headers: { "x-os-secret": secret },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `GET /api/os/variant-stats returned ${res.status}. ` +
        "503 = OS_API_SECRET unset or under 32 chars on ShikksTracker; " +
        "401 = secret mismatch; 404 = the deployment predates the P1 merge."
    );
  }

  const parsed: unknown = await res.json();
  if (!Array.isArray(parsed)) return [];

  const rows: VariantStatsItem[] = [];
  for (const raw of parsed) {
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw as Record<string, unknown>;
    // A row with no key cannot be identified, keyed or grouped. Dropping it is
    // the only honest handling; keeping it would put a nameless approach in a
    // table whose whole job is naming which approach earns replies.
    if (typeof row.key !== "string" || row.key.length === 0) continue;
    rows.push({
      key: row.key,
      label: typeof row.label === "string" ? row.label : null,
      channel: typeof row.channel === "string" ? row.channel : null,
      stage: readCount(row.stage),
      sends: readCount(row.sends),
      uniqueContacts: readCount(row.uniqueContacts),
      replies: readCount(row.replies),
      replyRate: readCount(row.replyRate),
    });
  }
  return rows;
}
```

- [ ] **Step 5: Make the timeout optional on the two existing GETs**

In `fetchAttention`, change the signature and the `signal`:

```ts
export async function fetchAttention(
  days: number,
  limit: number,
  timeoutMs: number = ST_TIMEOUT_MS
): Promise<AttentionResponse> {
```

and inside its `fetch` call, `signal: AbortSignal.timeout(ST_TIMEOUT_MS)` becomes `signal: AbortSignal.timeout(timeoutMs)`.

In `fetchSummary`, the same two edits:

```ts
export async function fetchSummary(timeoutMs: number = ST_TIMEOUT_MS): Promise<SummaryResponse> {
```

and `signal: AbortSignal.timeout(timeoutMs)`.

**`createDraft` is deliberately not given a timeout parameter.** It is the one call with a real-world side effect, its 15 s is part of the classifier's reasoning about what "our own timeout fired" means, and no page ever calls it.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/stApi.test.ts`
Expected: `Test Files  1 passed (1)`, zero failures.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 7: Confirm no cron caller had to change**

Run: `git diff --stat src/app/`
Expected: **no output.** The timeout parameter is optional, so `src/app/api/cron/chaser/route.ts` and `src/app/api/cron/morning/route.ts` are untouched by this task.

- [ ] **Step 8: Commit**

```bash
git add src/lib/stApi.ts src/lib/__tests__/stApi.test.ts
git commit -F - << 'MSG'
feat(p8b): fetchVariantStats, and a page timeout separate from the cron's

ST_TIMEOUT_MS is 15s, which is right for a cron and wrong for a human: three
parallel calls at that patience can outlive the function budget and hand Riku
a Vercel error page instead of the deck's "Couldn't reach ShikksTracker."
ST_PAGE_TIMEOUT_MS is 6s and the parameter is optional, so every cron caller
is unchanged.

fetchVariantStats parses the bare array the endpoint returns. replyRate is
modelled but never printed: ShikksTracker returns 0 for zero sends, which is
exactly the absence-of-measurement Block D exists to refuse.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 4: Move `ATTENTION_LIMIT` into `stApi.ts`

It is currently a module-private constant inside `src/app/api/cron/morning/route.ts`, so the page cannot import it — and a second copy would let the cron and the page bound the same feed differently.

**Files:**
- Modify: `src/lib/stApi.ts`
- Modify: `src/app/api/cron/morning/route.ts`
- Test: `src/lib/__tests__/stApi.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to the `describe("the page timeout", …)` block in `src/lib/__tests__/stApi.test.ts` — or as its own block at the end of the file:

```ts
describe("ATTENTION_LIMIT", () => {
  it("is one bounded value both the cron and the page read", () => {
    // CLAUDE.md: bounded query limits on every list endpoint. It lives here
    // rather than in a route so the two consumers cannot bound the same feed
    // differently and then disagree about what is waiting.
    expect(ATTENTION_LIMIT).toBe(50);
  });
});
```

and add `ATTENTION_LIMIT` to the file's `@/lib/stApi` import list.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/stApi.test.ts`
Expected: FAIL — `ATTENTION_LIMIT` is not exported from `@/lib/stApi`.

- [ ] **Step 3: Export it from `src/lib/stApi.ts`**

Add directly under the `ST_PAGE_TIMEOUT_MS` declaration:

```ts
/**
 * How many attention rows either consumer asks for. Bounded per CLAUDE.md's
 * rule on list endpoints, and exported rather than declared in a route because
 * the morning digest and the Freelance page must bound the same feed the same
 * way — two copies would let them disagree about what is waiting.
 * ShikksTracker's own maximum is 200.
 */
export const ATTENTION_LIMIT = 50;
```

- [ ] **Step 4: Import it in the morning cron route**

In `src/app/api/cron/morning/route.ts`, change the `stApi` import (line 11) from:

```ts
import { fetchAttention, fetchSummary } from "@/lib/stApi";
```

to:

```ts
import { ATTENTION_LIMIT, fetchAttention, fetchSummary } from "@/lib/stApi";
```

and delete the local constant and its comment (lines 32–33):

```ts
/** Bounded, per CLAUDE.md's rule on list endpoints. */
const ATTENTION_LIMIT = 50;
```

Nothing else in the file changes — the one use site on line 117 now resolves to the import.

- [ ] **Step 5: Run the tests and the type-check**

Run: `npx vitest run src/lib/__tests__/stApi.test.ts`
Expected: `Test Files  1 passed (1)`.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `git grep -nE "\bATTENTION_LIMIT = 50" src/`
Expected: one line, `src/lib/stApi.ts`. **The word boundary is required** — `CHASER_ATTENTION_LIMIT` in `src/lib/chaser.ts` is also `= 50`, so the unbounded pattern returns two lines and the step passes for the wrong reason (Batch 1 review). It is a different constant with a different job and is not touched.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stApi.ts src/app/api/cron/morning/route.ts src/lib/__tests__/stApi.test.ts
git commit -F - << 'MSG'
refactor(p8b): move ATTENTION_LIMIT into stApi.ts as an export

It was module-private inside the morning cron route, so the Freelance page
could not import it and a second copy would let the digest and the page bound
the same feed differently — and then disagree about what is waiting.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 5: Extract `fetchLiveAnchorIds` into `src/lib/queue.ts`

Writing a second copy of the live-anchor query on the page is the single most likely way this feature goes wrong: if the two status lists ever drift, the page and the chaser will disagree about the same lead and neither list will be trustworthy. One function, both callers.

**Files:**
- Modify: `src/lib/queue.ts`
- Modify: `src/app/api/cron/chaser/route.ts`
- Test: `src/lib/__tests__/queue.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/queue.test.ts`:

```ts
describe("fetchLiveAnchorIds", () => {
  it("returns an empty set without querying when there are no anchors", async () => {
    // The chaser's original guard, kept: an empty $in matches nothing, so the
    // round trip would be pure cost.
    let called = false;
    const find = () => {
      called = true;
      return { select: () => ({ limit: () => ({ lean: async () => [] }) }) };
    };
    const out = await fetchLiveAnchorIds([], find as never);
    expect(out.size).toBe(0);
    expect(called).toBe(false);
  });

  it("collects the replyToLogIds that already carry a live ApprovalItem", async () => {
    const find = () => ({
      select: () => ({
        limit: () => ({
          lean: async () => [
            { payload: { replyToLogId: "log-1" } },
            { payload: { replyToLogId: "log-2" } },
          ],
        }),
      }),
    });
    const out = await fetchLiveAnchorIds(["log-1", "log-2", "log-3"], find as never);
    expect([...out].sort()).toEqual(["log-1", "log-2"]);
  });

  it("skips a document whose payload lost its anchor rather than adding undefined", async () => {
    const find = () => ({
      select: () => ({
        limit: () => ({ lean: async () => [{ payload: {} }, {}, { payload: { replyToLogId: "log-9" } }] }),
      }),
    });
    const out = await fetchLiveAnchorIds(["log-9"], find as never);
    expect([...out]).toEqual(["log-9"]);
  });

  it("queries exactly the three live statuses — the page and the chaser must agree", async () => {
    let seenFilter: Record<string, unknown> = {};
    const find = (filter: Record<string, unknown>) => {
      seenFilter = filter;
      return { select: () => ({ limit: () => ({ lean: async () => [] }) }) };
    };
    await fetchLiveAnchorIds(["log-1"], find as never);
    expect(seenFilter.type).toBe("followup-draft");
    expect(seenFilter.status).toEqual({ $in: ["pending", "approved", "edited_approved"] });
    expect(seenFilter["payload.replyToLogId"]).toEqual({ $in: ["log-1"] });
  });
});
```

Add `fetchLiveAnchorIds` to the file's existing `@/lib/queue` import list.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/queue.test.ts`
Expected: FAIL — `fetchLiveAnchorIds` is not exported from `@/lib/queue`.

- [ ] **Step 3: Add it to `src/lib/queue.ts`**

No new import is needed: `ApprovalItem` is already imported at the top of this file as a default import (line 18, `import ApprovalItem, { ActionStatus, IApprovalItemBase } from "@/models/ApprovalItem";`), and the discriminator side-effect import beside it is already in place. Append to the end of the file:

```ts
/** The three statuses that mean "this reply is already being handled". */
export const LIVE_APPROVAL_STATUSES = ["pending", "approved", "edited_approved"] as const;

/** The shape of ApprovalItem.find this function needs; injected so it is testable. */
type AnchorFinder = (filter: Record<string, unknown>) => {
  select: (projection: Record<string, number>) => {
    limit: (n: number) => { lean: () => Promise<unknown[]> };
  };
};

/**
 * Which of these reply anchors already carry a live ApprovalItem.
 *
 * TWO CONSUMERS, ONE QUERY, DELIBERATELY. The chaser uses it as idempotency —
 * ShikksTracker keeps proposing a lead until a draft exists THERE, i.e. until
 * Riku approves, so between creation and approval the same lead returns every
 * day. The Freelance page uses it as suppression — a reply that already has a
 * drafted follow-up belongs to /queue, and repeating it in "Needs you" would
 * make both lists untrustworthy.
 *
 * If the two ever queried different status lists they would disagree about the
 * same lead. That is why this is one function and not two copies.
 *
 * Callers must have connectDB()'d already, matching the rest of the lib layer.
 */
export async function fetchLiveAnchorIds(
  anchors: string[],
  find: AnchorFinder = ((filter) =>
    ApprovalItem.find(filter)) as unknown as AnchorFinder
): Promise<Set<string>> {
  const live = new Set<string>();
  // An empty $in matches nothing, so the round trip would be pure cost.
  if (anchors.length === 0) return live;

  const docs = await find({
    type: "followup-draft",
    status: { $in: [...LIVE_APPROVAL_STATUSES] },
    "payload.replyToLogId": { $in: anchors },
  })
    .select({ payload: 1 })
    .limit(anchors.length)
    .lean();

  for (const doc of docs as { payload?: { replyToLogId?: string } }[]) {
    if (doc?.payload?.replyToLogId) live.add(doc.payload.replyToLogId);
  }
  return live;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/queue.test.ts`
Expected: `Test Files  1 passed (1)`, zero failures.

- [ ] **Step 5: Use it in the chaser route**

In `src/app/api/cron/chaser/route.ts`, replace **lines 73–89** with the block below. That region starts at the `// Idempotency, query layer (P4-e).` comment (line 73) and ends at the closing `}` of the `if (anchors.length > 0)` block (line 89). **It includes the existing `const anchors` declaration on line 75 and the `const liveAnchorIds` on line 76** — both are re-declared by the replacement, so there is no duplicate `const`. Verified against the file at HEAD: `anchors` is declared nowhere else in it.

```ts
    // Idempotency, query layer (P4-e). The unique partial index on
    // { payload.replyToLogId } where status is "pending" is the atomic backstop
    // under this; the E11000 catch below turns a lost race into a skip. The
    // query itself lives in queue.ts because the Freelance page asks the same
    // question, and the two must never disagree about the same lead.
    const anchors = attention.repliedUnanswered.map((i) => i.replyToLogId).filter(Boolean);
    const liveAnchorIds = await fetchLiveAnchorIds(anchors);
```

Add `fetchLiveAnchorIds` to the imports, as a new line after the `@/lib/chaser` import block:

```ts
import { fetchLiveAnchorIds } from "@/lib/queue";
```

Then **delete** the route's now-dead model import (line 15):

```ts
import ApprovalItem from "@/models/ApprovalItem";
```

Verified: the deleted query at line 78 was its only use in this file — `FollowupDraftApproval.create` is what writes, and it has its own import.

- [ ] **Step 6: Type-check, lint and run the full suite**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run lint`
Expected: **no *new* errors.** Lint exits 1 on the four pre-existing `react-hooks/set-state-in-effect` errors carried forward from Plan A (`queue/PushControls.tsx`, `queue/page.tsx`, `settings/page.tsx`, `login/page.tsx`) plus three warnings; the count must be exactly that and no higher (pre-build re-read, 2026-09-08).

Run: `npm test`
Expected: every suite passes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/queue.ts src/app/api/cron/chaser/route.ts src/lib/__tests__/queue.test.ts
git commit -F - << 'MSG'
refactor(p8b): extract fetchLiveAnchorIds so the chaser and the page agree

The chaser reads it as idempotency, Block E will read it as suppression — a
reply that already has a drafted follow-up lives in /queue and repeating it
under "Needs you" would make both lists untrustworthy. Two copies of the
status list would eventually drift, and then the page and the chaser would
disagree about the same lead.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 6: `freelanceView.ts` — Block A, the hero row and its lines

Three cards that never disappear: hue drains, structure stays. The distinction the whole page rests on is between `.stat.drained` (a **measured zero** — label and figure drain, the caption keeps `--ink-3`) and `.stat.blank` (**nothing was measured** — the whole card drains, caption included, because that caption is a "ShikksTracker didn't report…" sentence).

**Files:**
- Create: `src/lib/freelanceView.ts`
- Test: `src/lib/__tests__/freelanceView.test.ts` (create)

- [ ] **Step 1: Write the failing test**

*Superseded by R50 (`6fb16da`) and R54 (`6638101`) — the shipped shape is in the Post-build record and the code is the authority.*

Create `src/lib/__tests__/freelanceView.test.ts`:

```ts
/**
 * Blocks A, B and C. Every string here is quoted from the content deck
 * (docs/superpowers/specs/2026-09-05-p8-freelance-page-content.md) or the P8
 * spec's §4, and is asserted character for character on purpose: the deck is
 * the authority on every string, and a "tidied" word is a silent change to
 * what the page claims.
 *
 * The load-bearing assertion in this file is the one about
 * `Nothing waiting on you.` — it must fire only when drafts, approved,
 * never-contacted AND the needs-you count are ALL zero or absent (R35), never
 * under a lit card.
 */
import { describe, it, expect } from "vitest";
import { buildBlockA } from "@/lib/freelanceView";
import type { SummaryContacts, SummaryQueue } from "@/lib/stApi";

const DRAFTS_URL = "https://st.example.com/review";

function queue(over: Partial<SummaryQueue> = {}): SummaryQueue {
  return { drafts: 24, approved: 0, ...over };
}

function contacts(over: Partial<SummaryContacts> = {}): SummaryContacts {
  return {
    total: 30,
    hot: 2,
    byPipelineStage: {
      not_started: 25,
      contacted: 3,
      replied: 2,
      call_booked: 0,
      proposal_sent: 0,
      won: 0,
      lost: 0,
    },
    ...over,
  };
}

function blockA(over: Partial<Parameters<typeof buildBlockA>[0]> = {}) {
  return buildBlockA({
    queue: queue(),
    contacts: contacts(),
    needsYouCount: 0,
    draftsUrl: DRAFTS_URL,
    ...over,
  });
}

const card = (out: ReturnType<typeof buildBlockA>, key: string) => {
  const found = out.cards.find((c) => c.key === key);
  if (!found) throw new Error(`no card ${key}`);
  return found;
};

describe("Block A — the three cards always render", () => {
  it("renders exactly three cards, in row order, in every state", () => {
    expect(blockA().cards.map((c) => c.key)).toEqual(["drafts", "contacts", "needs-you"]);
    const dead = blockA({ queue: queue({ drafts: null }), contacts: null, needsYouCount: null });
    expect(dead.cards.map((c) => c.key)).toEqual(["drafts", "contacts", "needs-you"]);
  });
});

describe("Block A — the drafts card", () => {
  it("reads the deck's sentence with no word added or lost", () => {
    const c = card(blockA(), "drafts");
    expect(c.tone).toBe("roi");
    expect(c.label).toBe("Drafts");
    expect(c.figure).toBe("24");
    expect(c.caption).toBe("drafts waiting on you in ShikksTracker");
  });

  it("goes singular at one", () => {
    const c = card(blockA({ queue: queue({ drafts: 1 }) }), "drafts");
    expect(c.caption).toBe("draft waiting on you in ShikksTracker");
  });

  it("drains at a measured zero and keeps the plural", () => {
    const c = card(blockA({ queue: queue({ drafts: 0 }) }), "drafts");
    expect(c.tone).toBe("drained");
    expect(c.figure).toBe("0");
    expect(c.caption).toBe("drafts waiting on you in ShikksTracker");
  });

  it("blanks when the count never arrived, and says so — a zero would be a lie", () => {
    const c = card(blockA({ queue: queue({ drafts: null }) }), "drafts");
    expect(c.tone).toBe("blank");
    expect(c.figure).toBe("—");
    expect(c.caption).toBe("ShikksTracker didn't report how many drafts are waiting");
  });

  it("is the only card carrying a link, and keeps it in every state", () => {
    const live = blockA();
    expect(card(live, "drafts").href).toBe(DRAFTS_URL);
    expect(card(live, "contacts").href).toBeNull();
    expect(card(live, "needs-you").href).toBeNull();
    expect(card(blockA({ queue: queue({ drafts: null }) }), "drafts").href).toBe(DRAFTS_URL);
  });
});

describe("Block A — the contacts card", () => {
  it("is hueless with data, and reconstructs the deck's sentence", () => {
    const c = card(blockA(), "contacts");
    expect(c.tone).toBe("plain");
    expect(c.label).toBe("Contacts");
    expect(c.figure).toBe("25");
    expect(c.caption).toBe("of 30 contacts never contacted");
    expect(c.trackPercent).toBe(83);
  });

  it("goes singular at a total of one", () => {
    const c = card(
      blockA({
        contacts: contacts({
          total: 1,
          byPipelineStage: { ...contacts().byPipelineStage, not_started: 1 },
        }),
      }),
      "contacts"
    );
    expect(c.caption).toBe("of 1 contact never contacted");
  });

  it("keeps the track's ground at a measured zero, so the row's baseline holds", () => {
    const c = card(
      blockA({
        contacts: contacts({ byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 } }),
      }),
      "contacts"
    );
    expect(c.tone).toBe("drained");
    expect(c.figure).toBe("0");
    expect(c.trackPercent).toBe(0);
  });

  it("draws no track at a total of zero — a proportion of nothing is not a shape", () => {
    const c = card(
      blockA({
        contacts: contacts({
          total: 0,
          byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 },
        }),
      }),
      "contacts"
    );
    expect(c.tone).toBe("drained");
    expect(c.figure).toBe("0");
    expect(c.caption).toBe("of 0 contacts never contacted");
    expect(c.trackPercent).toBeNull();
  });

  it("blanks with no track when the block, the total or the stage did not arrive", () => {
    for (const over of [
      { contacts: null },
      { contacts: contacts({ total: null }) },
      {
        contacts: contacts({
          byPipelineStage: { ...contacts().byPipelineStage, not_started: null },
        }),
      },
    ]) {
      const c = card(blockA(over), "contacts");
      expect(c.tone).toBe("blank");
      expect(c.figure).toBe("—");
      expect(c.caption).toBe("ShikksTracker didn't report how many contacts there are");
      expect(c.trackPercent).toBeNull();
    }
  });
});

describe("Block A — the needs-you card", () => {
  it("goes amber above zero, because every row it counts is a duration", () => {
    const c = card(blockA({ needsYouCount: 3 }), "needs-you");
    expect(c.tone).toBe("stale");
    expect(c.label).toBe("Needs you");
    expect(c.figure).toBe("3");
    expect(c.caption).toBe("waiting on you");
  });

  it("drains at zero but keeps its caption legible — 0 is the answer the page exists to give", () => {
    const c = card(blockA({ needsYouCount: 0 }), "needs-you");
    expect(c.tone).toBe("drained");
    expect(c.figure).toBe("0");
    expect(c.caption).toBe("nothing waiting");
  });

  it("blanks when the database read failed, exactly like Block E beside it", () => {
    const c = card(blockA({ needsYouCount: null }), "needs-you");
    expect(c.tone).toBe("blank");
    expect(c.figure).toBe("—");
    expect(c.caption).toBe("couldn't load");
  });
});

describe("Block A — the statement lines", () => {
  it("says the approved line only when there is something to say", () => {
    expect(blockA({ queue: queue({ approved: 3 }) }).lines).toEqual([
      { figure: "3", text: "approved, not yet sent" },
    ]);
    expect(blockA({ queue: queue({ approved: 1 }) }).lines).toEqual([
      { figure: "1", text: "approved, not yet sent" },
    ]);
  });

  it("hides the approved line at zero and when the field never arrived", () => {
    expect(blockA({ queue: queue({ approved: 0 }) }).lines).toEqual([]);
    expect(blockA({ queue: queue({ approved: null }) }).lines).toEqual([]);
  });

  it("never renders `Sending is off` — the contract gap is unshipped, not stubbed", () => {
    const texts = blockA({ queue: queue({ approved: 2 }) }).lines.map((l) => l.text);
    expect(texts.join(" ")).not.toContain("Sending");
  });

  it("says `Nothing waiting on you.` only when all four are zero or absent", () => {
    const all = blockA({
      queue: queue({ drafts: 0, approved: 0 }),
      contacts: contacts({ byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 } }),
      needsYouCount: 0,
    });
    expect(all.lines).toEqual([{ figure: null, text: "Nothing waiting on you." }]);

    const absent = blockA({
      queue: queue({ drafts: null, approved: null }),
      contacts: null,
      needsYouCount: null,
    });
    expect(absent.lines).toEqual([{ figure: null, text: "Nothing waiting on you." }]);
  });

  it("never says it beside a lit needs-you card (R35)", () => {
    // The contradiction this rule exists to stop: `Nothing waiting on you.`
    // printed under an amber card reading `3 / waiting on you`, on one screen.
    const out = blockA({
      queue: queue({ drafts: 0, approved: 0 }),
      contacts: contacts({ byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 } }),
      needsYouCount: 3,
    });
    expect(out.lines).toEqual([]);
  });

  it("never says it under a lit card", () => {
    // Drafts lit.
    expect(
      blockA({
        queue: queue({ drafts: 24, approved: 0 }),
        contacts: contacts({ byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 } }),
      }).lines
    ).toEqual([]);

    // Never-contacted lit.
    expect(blockA({ queue: queue({ drafts: 0, approved: 0 }) }).lines).toEqual([]);

    // Approved lit — the fallback and the approved line are mutually exclusive.
    expect(
      blockA({
        queue: queue({ drafts: 0, approved: 2 }),
        contacts: contacts({ byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 } }),
      }).lines
    ).toEqual([{ figure: "2", text: "approved, not yet sent" }]);
  });

  it("still renders all three cards under the whole-block fallback, drained", () => {
    const out = blockA({ queue: queue({ drafts: 0, approved: 0 }), contacts: null });
    expect(out.cards).toHaveLength(3);
    expect(card(out, "drafts").tone).toBe("drained");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/freelanceView.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/freelanceView"`.

- [ ] **Step 3: Create `src/lib/freelanceView.ts` with Block A**

*Superseded by R50 (`6fb16da`) and R54 (`6638101`) — the shipped shape is in the Post-build record and the code is the authority.* In short: `zeroOrAbsent` became a measured-zero test, so an absence suppresses `Nothing waiting on you.` instead of satisfying it; and `BlockAInput.needsYouCount: number | null` became `needsYou: NeedsYouFigure`, with `needsYouCard` gaining an `absent` branch.

```ts
/**
 * freelanceView.ts — Blocks A, B and C of the Freelance page as plain data.
 *
 * EVERY STRING IN THIS FILE IS QUOTED FROM THE CONTENT DECK
 * (docs/superpowers/specs/2026-09-05-p8-freelance-page-content.md), which is
 * the authority on wording. Where the P8 spec's §4 quotes the deck it quotes it
 * exactly; if the two ever differ, the deck wins. Do not reword anything here
 * without changing the deck first.
 *
 * The distinction the whole page rests on, and the reason these are three
 * treatments rather than two:
 *
 *   .stat.plain    hueless WITH data
 *   .stat.drained  a MEASURED zero — the figure drains, the caption still reports
 *   .stat.blank    NOTHING WAS MEASURED (—) — the caption drains too, because it
 *                  is a "ShikksTracker didn't report…" sentence
 *
 * `0` is a measurement. `—` is an absence. Rendering both the same way is a
 * correctness bug, not a style choice.
 *
 * Pure: no database, no network, no clock of its own, no environment. The two
 * ShikksTracker URLs are passed in, so ST_API_BASE_URL never reaches a client.
 */

import { numberCell, pluralise } from "@/lib/format";
import type { Cell } from "@/lib/format";
import { PIPELINE_STAGES } from "@/lib/stApi";
import type { PipelineStage, SummaryCampaign, SummaryContacts, SummaryQueue } from "@/lib/stApi";

/** The em-dash used for every absence on the page. */
const DASH = "—";

/**
 * The per-block failure sentences, exported so Plan C's page renders them from
 * one place rather than retyping them into seven components.
 */
export const FAIL_LINES = {
  pipeline: "Couldn't load the pipeline.",
  campaigns: "Couldn't load campaigns.",
  approaches: "Couldn't load approach performance.",
  needsYou: "Couldn't load what's waiting.",
  page: {
    said: "Couldn't reach ShikksTracker.",
    because:
      "State of play, pipeline, campaigns, approaches and what's waiting all come from there.",
  },
} as const;

// --- Block A -----------------------------------------------------------------

export type StatTone = "roi" | "stale" | "plain" | "drained" | "blank";

export interface StatCard {
  key: "drafts" | "contacts" | "needs-you";
  /** -> className `stat ${tone}`. */
  tone: StatTone;
  label: string;
  figure: string;
  caption: string;
  /** Only the drafts card ever has one. Its label is always `Open ↗`. */
  href: string | null;
  /** 0-100, or null when no track is drawn at all. */
  trackPercent: number | null;
}

export interface SayLine {
  /** Rendered in <b>. null = a statement with no figure. */
  figure: string | null;
  /** Plan C renders `{figure} {text}` with one space, or just `{text}`. */
  text: string;
}

export interface BlockA {
  /** Always exactly three, in row order. Cards never disappear. */
  cards: StatCard[];
  lines: SayLine[];
}

export interface BlockAInput {
  queue: SummaryQueue;
  /** null = the whole contacts block was absent. */
  contacts: SummaryContacts | null;
  /** Block E's COMPUTED gap count. null = the database read failed. */
  needsYouCount: number | null;
  /** ShikksTracker's draft-review page, built server-side. */
  draftsUrl: string;
}

/** A field that is zero or was never reported. Both are "nothing to say". */
function zeroOrAbsent(value: number | null): boolean {
  return value === null || value === 0;
}

function draftsCard(drafts: number | null, draftsUrl: string): StatCard {
  // The link stays in every state and inherits --ink-4 on a drained card: it is
  // the page's one exit to ShikksTracker, not ornament.
  const base = { key: "drafts", label: "Drafts", href: draftsUrl, trackPercent: null } as const;
  if (drafts === null) {
    return {
      ...base,
      tone: "blank",
      figure: DASH,
      caption: "ShikksTracker didn't report how many drafts are waiting",
    };
  }
  return {
    ...base,
    tone: drafts === 0 ? "drained" : "roi",
    figure: String(drafts),
    caption: `${pluralise(drafts, "draft")} waiting on you in ShikksTracker`,
  };
}

function contactsCard(contacts: SummaryContacts | null): StatCard {
  const base = { key: "contacts", label: "Contacts", href: null } as const;
  const notStarted = contacts?.byPipelineStage.not_started ?? null;
  const total = contacts?.total ?? null;

  // Any of the three missing makes the card's sentence unconstructible, and the
  // deck supplies exactly one missing-data string for this card. It is not
  // reworded per cause: a card that says "didn't report" is already telling the
  // truth about why it has no figure.
  if (contacts === null || total === null || notStarted === null) {
    return {
      ...base,
      tone: "blank",
      figure: DASH,
      caption: "ShikksTracker didn't report how many contacts there are",
      trackPercent: null,
    };
  }

  return {
    ...base,
    tone: notStarted === 0 ? "drained" : "plain",
    figure: String(notStarted),
    caption: `of ${total} ${pluralise(total, "contact")} never contacted`,
    // A proportion of nothing is not a shape, so a total of 0 draws no track at
    // all. A not_started of 0 with contacts present keeps the ground at 0%,
    // which is what holds the row's baseline.
    trackPercent:
      total === 0 ? null : Math.max(0, Math.min(100, Math.round((notStarted / total) * 100))),
  };
}

function needsYouCard(count: number | null): StatCard {
  const base = { key: "needs-you", label: "Needs you", href: null, trackPercent: null } as const;
  if (count === null) {
    // The gap count needs a database read, so a failed read reads exactly like
    // Block E beside it rather than pretending to a zero.
    return { ...base, tone: "blank", figure: DASH, caption: "couldn't load" };
  }
  if (count === 0) {
    // A card that reads 0 most days is not dead weight: 0 is the answer the page
    // exists to give, which is why this caption stays --ink-3 rather than
    // draining with the figure.
    return { ...base, tone: "drained", figure: "0", caption: "nothing waiting" };
  }
  // Amber because every row it counts is a duration, and red stays rationed to
  // the health strip so the strip can be unmissable.
  return { ...base, tone: "stale", figure: String(count), caption: "waiting on you" };
}

export function buildBlockA(input: BlockAInput): BlockA {
  const { queue, contacts, needsYouCount, draftsUrl } = input;
  const notStarted = contacts?.byPipelineStage.not_started ?? null;

  const cards: StatCard[] = [
    draftsCard(queue.drafts, draftsUrl),
    contactsCard(contacts),
    needsYouCard(needsYouCount),
  ];

  const lines: SayLine[] = [];

  // The whole-block fallback. It fires ONLY when drafts, approved,
  // never-contacted AND the needs-you count are all zero or absent (R35) —
  // never under a lit card. The needs-you count is in the condition because
  // without it the page could print `Nothing waiting on you.` directly beneath
  // an amber card reading `3 / waiting on you`, which is a contradiction on one
  // screen. A null count is an absence, and an absence is not something waiting.
  // The hero cards still render, drained.
  //
  // `Sending is off` (the deck's A4) is NOT here: GET /api/os/summary does not
  // return sendingEnabled, and the prime directive forbids fixing that from this
  // repo. It renders nothing today — no drained slot, no placeholder — and
  // nothing infers the switch state from behaviour.
  if (
    zeroOrAbsent(queue.drafts) &&
    zeroOrAbsent(queue.approved) &&
    zeroOrAbsent(notStarted) &&
    zeroOrAbsent(needsYouCount)
  ) {
    lines.push({ figure: null, text: "Nothing waiting on you." });
    return { cards, lines };
  }

  // These are sentences and they disappear entirely when they have nothing to
  // say. They never render as a zero.
  if (queue.approved !== null && queue.approved > 0) {
    lines.push({ figure: String(queue.approved), text: "approved, not yet sent" });
  }

  return { cards, lines };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/freelanceView.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  21 passed (21)`.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. **Amended before the build (2026-09-08): imports land in the task that consumes them.** Task 6 imports only `pluralise` and the two types Block A reads; Task 7 adds `PIPELINE_STAGES` and `PipelineStage`; Task 8 adds `numberCell`, `Cell` and `SummaryCampaign`. So no commit carries an unused import, and every commit leaves lint's warning count where it found it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/freelanceView.ts src/lib/__tests__/freelanceView.test.ts
git commit -F - << 'MSG'
feat(p8b): Block A — the hero row and its statement lines

Three cards that never disappear: hue drains, structure stays. The card
treatments encode the page's central rule — .drained is a measured zero whose
caption still reports, .blank is an absence whose caption drains with it,
because that caption is a "ShikksTracker didn't report..." sentence.

"Nothing waiting on you." fires only when drafts, approved, never-contacted
AND the needs-you count are all zero or absent (R35) — never under a lit
card. Without the fourth term the page could print it directly beneath an
amber card reading "3 / waiting on you". Pinned.

"Sending is off" renders nothing: the summary endpoint does not report the
switch, and the prime directive forbids fixing that from this repo.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 7: `freelanceView.ts` — Block B, the pipeline

Only stages holding at least one contact are listed, in pipeline order. Empty stages collapse into one `.fl-note` line. **A stage the API omitted must not fold into that line** — that line means measured zero — so it gets its own `.fl-absent` line instead.

**Files:**
- Modify: `src/lib/freelanceView.ts`
- Test: `src/lib/__tests__/freelanceView.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/freelanceView.test.ts`:

```ts
describe("Block B — the pipeline", () => {
  const b = (over: Partial<SummaryContacts> | null = {}) =>
    buildBlockB(over === null ? null : contacts(over));

  it("renders today's real reading exactly as the deck writes it", () => {
    const out = b();
    if (out.kind !== "stages") throw new Error("expected stages");
    expect(out.summary).toEqual({ total: 30, totalWord: "contacts", hot: 2, hotWord: "hot" });
    expect(out.rows).toEqual([
      { key: "not_started", label: "Not started", count: 25 },
      { key: "contacted", label: "Contacted", count: 3 },
      { key: "replied", label: "Replied", count: 2 },
    ]);
    expect(out.emptyNote).toBe("Nothing yet at call booked, proposal sent, won or lost");
    expect(out.absentNote).toBeNull();
    expect(out.hotAbsentNote).toBeNull();
  });

  it("goes singular on both halves of the summary line", () => {
    const out = b({
      total: 1,
      hot: 1,
      byPipelineStage: { ...contacts().byPipelineStage, not_started: 1, contacted: 0, replied: 0 },
    });
    if (out.kind !== "stages") throw new Error("expected stages");
    expect(out.summary.totalWord).toBe("contact");
    expect(out.summary.hot).toBe(1);
  });

  it("drops the hot clause at a measured zero, silently", () => {
    const out = b({ hot: 0 });
    if (out.kind !== "stages") throw new Error("expected stages");
    expect(out.summary.hot).toBeNull();
    expect(out.hotAbsentNote).toBeNull();
  });

  it("drops the hot clause when it never arrived, and says so", () => {
    const out = b({ hot: null });
    if (out.kind !== "stages") throw new Error("expected stages");
    expect(out.summary.hot).toBeNull();
    expect(out.hotAbsentNote).toBe("ShikksTracker didn't report how many are hot.");
  });

  it("writes the Nothing-yet grammar at four, two, one and none", () => {
    const stages = contacts().byPipelineStage;

    /** Narrows to the stages case so the assertions read as one line each. */
    const note = (over: Partial<SummaryContacts>) => {
      const out = b(over);
      if (out.kind !== "stages") throw new Error("expected stages");
      return out.emptyNote;
    };

    expect(note({ byPipelineStage: { ...stages, call_booked: 1, proposal_sent: 1 } })).toBe(
      "Nothing yet at won or lost"
    );

    expect(
      note({ byPipelineStage: { ...stages, call_booked: 1, proposal_sent: 1, won: 1 } })
    ).toBe("Nothing yet at lost");

    expect(
      note({ byPipelineStage: { ...stages, call_booked: 1, proposal_sent: 1, won: 1, lost: 1 } })
    ).toBeNull();

    expect(note({ byPipelineStage: { ...stages, proposal_sent: 1 } })).toBe(
      "Nothing yet at call booked, won or lost"
    );
  });

  it("keeps an omitted stage out of the Nothing-yet line — that line means measured zero", () => {
    const out = b({ byPipelineStage: { ...contacts().byPipelineStage, won: null, lost: null } });
    if (out.kind !== "stages") throw new Error("expected stages");
    // Two measured-empty stages are left, so the grammar is `a or b` — the
    // omitted pair is not silently appended with a comma.
    expect(out.emptyNote).toBe("Nothing yet at call booked or proposal sent");
    expect(out.absentNote).toBe("ShikksTracker didn't report every pipeline stage.");
    expect(out.rows.some((r) => r.key === "won")).toBe(false);
  });

  it("says `No contacts yet.` at a measured total of zero", () => {
    const zeroed = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, 0]));
    const out = b({ total: 0, hot: 0, byPipelineStage: zeroed as never });
    expect(out).toEqual({ kind: "empty", line: "No contacts yet." });
  });

  it("reports a failure to load rather than inventing an emptiness", () => {
    expect(buildBlockB(null)).toEqual({ kind: "failed", line: "Couldn't load the pipeline." });
    expect(b({ total: null })).toEqual({ kind: "failed", line: "Couldn't load the pipeline." });
  });
});
```

Extend the file's imports:

```ts
import { buildBlockA, buildBlockB } from "@/lib/freelanceView";
import { PIPELINE_STAGES } from "@/lib/stApi";
import type { SummaryContacts, SummaryQueue } from "@/lib/stApi";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/freelanceView.test.ts`
Expected: FAIL — `buildBlockB` is not exported from `@/lib/freelanceView`.

- [ ] **Step 3: Add Block B to `src/lib/freelanceView.ts`**

Append:

```ts
// --- Block B -----------------------------------------------------------------

/** The deck's stage labels, in pipeline order. */
const STAGE_LABELS: Record<PipelineStage, string> = {
  not_started: "Not started",
  contacted: "Contacted",
  replied: "Replied",
  call_booked: "Call booked",
  proposal_sent: "Proposal sent",
  won: "Won",
  lost: "Lost",
};

export interface PipelineSummary {
  total: number;
  /** "contacts" | "contact" */
  totalWord: string;
  /** null = the `· N hot` clause is dropped entirely. */
  hot: number | null;
  hotWord: string;
}

export interface PipelineStageRow {
  key: PipelineStage;
  label: string;
  count: number;
}

export type BlockB =
  | { kind: "failed"; line: string }
  | { kind: "empty"; line: string }
  | {
      kind: "stages";
      summary: PipelineSummary;
      rows: PipelineStageRow[];
      /** .fl-note — a MEASURED emptiness. */
      emptyNote: string | null;
      /** .fl-absent — a field that NEVER ARRIVED. */
      absentNote: string | null;
      hotAbsentNote: string | null;
    };

/**
 * `a, b, c or d` — the deck's grammar, with `or` before the last and no Oxford
 * comma. One item is just the item; none produces no line at all.
 */
function joinWithOr(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} or ${parts[parts.length - 1]}`;
}

export function buildBlockB(contacts: SummaryContacts | null): BlockB {
  // A missing block, or a missing total, leaves nothing measured at all. That
  // is a failure to load the pipeline, not an emptiness — and `No contacts
  // yet.` would be a claim the data does not support.
  if (contacts === null || contacts.total === null) {
    return { kind: "failed", line: FAIL_LINES.pipeline };
  }
  if (contacts.total === 0) {
    return { kind: "empty", line: "No contacts yet." };
  }

  const rows: PipelineStageRow[] = [];
  const measuredEmpty: string[] = [];
  let anyAbsent = false;

  for (const stage of PIPELINE_STAGES) {
    const count = contacts.byPipelineStage[stage];
    if (count === null) {
      // An omitted stage must NOT fold into the `Nothing yet at …` line: that
      // line means the source answered and the count was zero.
      anyAbsent = true;
      continue;
    }
    if (count > 0) rows.push({ key: stage, label: STAGE_LABELS[stage], count });
    else measuredEmpty.push(STAGE_LABELS[stage].toLowerCase());
  }

  return {
    kind: "stages",
    summary: {
      total: contacts.total,
      totalWord: pluralise(contacts.total, "contact"),
      // Dropped at a measured zero and when it never arrived; only the second
      // case earns a line saying so.
      hot: contacts.hot !== null && contacts.hot > 0 ? contacts.hot : null,
      hotWord: "hot",
    },
    rows,
    emptyNote: measuredEmpty.length > 0 ? `Nothing yet at ${joinWithOr(measuredEmpty)}` : null,
    absentNote: anyAbsent ? "ShikksTracker didn't report every pipeline stage." : null,
    hotAbsentNote: contacts.hot === null ? "ShikksTracker didn't report how many are hot." : null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/freelanceView.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  29 passed (29)`.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/freelanceView.ts src/lib/__tests__/freelanceView.test.ts
git commit -F - << 'MSG'
feat(p8b): Block B — the pipeline rows, and the two kinds of emptiness

Only stages holding a contact are listed, in pipeline order. Measured-empty
stages collapse into one "Nothing yet at ... or ..." note; a stage the API
omitted is kept OUT of that line and gets its own "didn't report every
pipeline stage." line, because the first line means measured zero.

The hot clause drops at a measured zero silently and at an absent value with
a line saying so. A missing contacts block reports a failure to load rather
than claiming "No contacts yet."

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 8: `freelanceView.ts` — Block C, the campaigns table

Sorted by Sent, highest first. **No rate column, ever. No hue anywhere.** A measured `0` cell is `0` in `--ink-4`; a missing cell is `—`.

**Files:**
- Modify: `src/lib/freelanceView.ts`
- Test: `src/lib/__tests__/freelanceView.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/freelanceView.test.ts`:

```ts
describe("Block C — campaigns", () => {
  const row = (over: Partial<SummaryCampaign>): SummaryCampaign => ({
    id: "c1",
    name: "Test One",
    sent: 5,
    opened: 2,
    clicked: 0,
    replied: 2,
    ...over,
  });

  it("renders today's two real rows with the deck's headers", () => {
    const out = buildBlockC([
      row({}),
      row({ id: "c2", name: "Test number 2", sent: 0, opened: 0, clicked: 0, replied: 0 }),
    ]);
    if (out.kind !== "table") throw new Error("expected table");
    expect(out.headers).toEqual(["Campaign", "Sent", "Opened", "Clicked", "Replied"]);
    expect(out.count).toBe(2);
    expect(out.rows[0].name).toBe("Test One");
    expect(out.rows[0].cells.map((c) => c.text)).toEqual(["5", "2", "0", "2"]);
    expect(out.bound).toBeNull();
    expect(out.honesty).toBe(
      "Open counts come from tracking pixels and undercount anyone whose mail client blocks images."
    );
  });

  it("marks a measured zero and an absent cell differently — never the same ink", () => {
    const out = buildBlockC([row({ clicked: 0, replied: null })]);
    if (out.kind !== "table") throw new Error("expected table");
    const cells = out.rows[0].cells;
    expect(cells[2]).toEqual({ text: "0", tone: "zero" });
    expect(cells[3]).toEqual({ text: "—", tone: "dash" });
  });

  it("sorts by Sent, highest first, with unmeasured rows last and ties left in feed order", () => {
    const out = buildBlockC([
      row({ id: "a", name: "A", sent: 5 }),
      row({ id: "b", name: "B", sent: null }),
      row({ id: "c", name: "C", sent: 142 }),
      row({ id: "d", name: "D", sent: 5 }),
    ]);
    if (out.kind !== "table") throw new Error("expected table");
    expect(out.rows.map((r) => r.id)).toEqual(["c", "a", "d", "b"]);
  });

  it("bounds the display at 20 and states what it did, in sentence case", () => {
    const many = Array.from({ length: 34 }, (_, i) =>
      row({ id: `c${i}`, name: `Campaign ${i}`, sent: 100 - i })
    );
    const out = buildBlockC(many);
    if (out.kind !== "table") throw new Error("expected table");
    expect(out.rows).toHaveLength(20);
    expect(out.count).toBe(34);
    expect(out.bound).toBe("Showing 20 of 34 campaigns.");
  });

  it("goes singular in the bound statement when exactly 21 exist", () => {
    const many = Array.from({ length: 21 }, (_, i) => row({ id: `c${i}`, sent: 100 - i }));
    const out = buildBlockC(many);
    if (out.kind !== "table") throw new Error("expected table");
    expect(out.bound).toBe("Showing 20 of 21 campaigns.");
  });

  it("says `No campaigns yet.` for a measured emptiness and reports a failure for an absence", () => {
    expect(buildBlockC([])).toEqual({ kind: "empty", line: "No campaigns yet." });
    expect(buildBlockC(null)).toEqual({ kind: "failed", line: "Couldn't load campaigns." });
  });

  it("never produces a rate column", () => {
    const out = buildBlockC([row({})]);
    if (out.kind !== "table") throw new Error("expected table");
    expect(out.headers.join(" ")).not.toMatch(/rate/i);
    expect(out.rows[0].cells).toHaveLength(4);
  });
});
```

Extend the file's type import to add `SummaryCampaign`, and the value import to add `buildBlockC`:

```ts
import { buildBlockA, buildBlockB, buildBlockC } from "@/lib/freelanceView";
import type { SummaryCampaign, SummaryContacts, SummaryQueue } from "@/lib/stApi";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/freelanceView.test.ts`
Expected: FAIL — `buildBlockC` is not exported from `@/lib/freelanceView`.

- [ ] **Step 3: Add Block C to `src/lib/freelanceView.ts`**

Append:

```ts
// --- Block C -----------------------------------------------------------------

/**
 * Settled by the deck's own `Showing 20 of 34 campaigns.` The endpoint's own
 * ceiling is 50 (fetchSummary sends no `limit`), so `count` understates past
 * that — recorded in stApi.ts rather than defended against.
 */
export const CAMPAIGN_DISPLAY_BOUND = 20;

export interface CampaignRow {
  id: string;
  name: string;
  /** sent, opened, clicked, replied — in header order. */
  cells: Cell[];
}

export type BlockC =
  | { kind: "failed"; line: string }
  | { kind: "empty"; line: string }
  | {
      kind: "table";
      /** The TOTAL, before the display bound — this is what `.fl-count` shows. */
      count: number;
      headers: string[];
      rows: CampaignRow[];
      bound: string | null;
      honesty: string;
    };

export function buildBlockC(campaigns: SummaryCampaign[] | null): BlockC {
  if (campaigns === null) return { kind: "failed", line: FAIL_LINES.campaigns };
  if (campaigns.length === 0) return { kind: "empty", line: "No campaigns yet." };

  // Highest Sent first. An unmeasured `sent` sorts below every measured value
  // rather than above zero — it is not a bigger number, it is no number. Ties
  // keep the order the API returned: Array.prototype.sort is stable, so the
  // result is deterministic without inventing a secondary key.
  const sorted = [...campaigns].sort((a, b) => (b.sent ?? -1) - (a.sent ?? -1));
  const shown = sorted.slice(0, CAMPAIGN_DISPLAY_BOUND);

  return {
    kind: "table",
    count: campaigns.length,
    // `Campaign` is the fifth new string, approved 2026-09-07: a headerless name
    // column beside four headed ones reads unfinished, and it parallels Block
    // D's deck-authorised `Approach`. No rate column, ever.
    headers: ["Campaign", "Sent", "Opened", "Clicked", "Replied"],
    rows: shown.map((c) => ({
      id: c.id,
      name: c.name,
      cells: [numberCell(c.sent), numberCell(c.opened), numberCell(c.clicked), numberCell(c.replied)],
    })),
    // A statement to the reader, not a machine label, so it is sentence case in
    // the body face and never mono caps.
    bound:
      campaigns.length > CAMPAIGN_DISPLAY_BOUND
        ? `Showing ${CAMPAIGN_DISPLAY_BOUND} of ${campaigns.length} ${pluralise(
            campaigns.length,
            "campaign"
          )}.`
        : null,
    // Unconditional, unlike Block D's note: these counts always come from
    // tracking pixels, whatever the numbers are.
    honesty:
      "Open counts come from tracking pixels and undercount anyone whose mail client blocks images.",
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/freelanceView.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  36 passed (36)`.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run lint`
Expected: **no *new* errors** — lint exits 1 on the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and this task must not add to them (pre-build re-read, 2026-09-08). Every import this task adds has a consumer in the same commit.

- [ ] **Step 5: Commit**

```bash
git add src/lib/freelanceView.ts src/lib/__tests__/freelanceView.test.ts
git commit -F - << 'MSG'
feat(p8b): Block C — the campaigns table, bounded at 20

Sorted by Sent, highest first, with an unmeasured sent below every measured
value rather than above zero. Ties keep the API's order, which stable sort
already guarantees, so no secondary key is invented.

A measured 0 and a missing cell take different ink. No rate column, ever.
The tracking-pixel note is unconditional here — unlike Block D's, which R27
gates on at least one rate being printed.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 9: `freelanceVariants.ts` — Block D, approach performance

**The rate is recomputed locally and the upstream `replyRate` is never printed.** ShikksTracker's own `rate()` returns 0 for zero sends, which is precisely the lie this block exists to refuse: since S15 replies are only ever detected on email, so a Facebook, Instagram or phone variant's 0% is not a measurement, it is an absence of measurement.

**Files:**
- Create: `src/lib/freelanceVariants.ts`
- Test: `src/lib/__tests__/freelanceVariants.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/freelanceVariants.test.ts`:

```ts
/**
 * The one block whose whole reason for existing is a refusal: half of it can
 * never have a number, and showing those rows as 0% would be a lie.
 *
 * The two assertions that must never be relaxed are that the upstream
 * replyRate is never printed, and that no rate is printed for a non-email
 * channel however many sends it has.
 */
import { describe, it, expect } from "vitest";
import { buildBlockD } from "@/lib/freelanceVariants";
import type { VariantStatsItem } from "@/lib/stApi";

function variant(over: Partial<VariantStatsItem>): VariantStatsItem {
  return {
    key: "k",
    label: "L",
    channel: "email",
    stage: 1,
    sends: 0,
    uniqueContacts: 0,
    replies: 0,
    replyRate: 0,
    ...over,
  };
}

/** The four real approaches that exist today, all at zero sends. */
function today(): VariantStatsItem[] {
  return [
    variant({ key: "e1", label: "Email S1 — specific compliment first", channel: "email" }),
    variant({ key: "e2", label: "Email S1 — pain point first", channel: "email" }),
    variant({ key: "f1", label: "Facebook DM S1 — specific compliment first", channel: "facebook" }),
    variant({ key: "f2", label: "Facebook DM S1 — pain point first", channel: "facebook" }),
  ];
}

describe("Block D — the two groups, always", () => {
  it("splits email from everything else, at equal typographic weight", () => {
    const out = buildBlockD(today());
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups).toHaveLength(2);
    expect(out.groups[0].eyebrow).toBe("Measured — email");
    expect(out.groups[1].eyebrow).toBe("Not measurable");
    expect(out.groups[0].rows.map((r) => r.key)).toEqual(["e1", "e2"]);
    expect(out.groups[1].rows.map((r) => r.key)).toEqual(["f1", "f2"]);
  });

  it("drops the replies column from group 2 and keeps sends live", () => {
    const out = buildBlockD([
      variant({ key: "f1", channel: "facebook", sends: 31, replies: 4 }),
    ]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[0].headers).toEqual(["Approach", "Reply rate", "Sends", "Replies"]);
    expect(out.groups[1].headers).toEqual(["Approach", "Reply rate", "Sends"]);
    const row = out.groups[1].rows[0];
    expect(row.cells).toHaveLength(2);
    expect(row.cells[0]).toEqual({ text: "—", tone: "dash" });
    expect(row.cells[1]).toEqual({ text: "31", tone: "value" });
  });

  it("puts the explanation under the group heading, above its rows", () => {
    const out = buildBlockD(today());
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[0].explain).toBeNull();
    expect(out.groups[1].explain).toBe(
      "Replies are only detected on email, so these can't be scored."
    );
  });

  it("treats a channel it cannot read as not measurable — never as email", () => {
    const out = buildBlockD([variant({ key: "orphan", label: null, channel: null, sends: 9 })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[0].rows).toHaveLength(0);
    expect(out.groups[1].rows).toHaveLength(1);
    // With no label the key is the only name there is.
    expect(out.groups[1].rows[0].name).toBe("orphan");
  });
});

describe("Block D — the rate, recomputed and rationed", () => {
  it("recomputes from sends and replies and never prints the upstream replyRate", () => {
    const out = buildBlockD([
      // Upstream says 99%. The truth is 8/72 = 11%.
      variant({ key: "e1", channel: "email", sends: 72, replies: 8, replyRate: 0.99 }),
    ]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[0].rows[0].cells[0]).toEqual({ text: "11%", tone: "value" });
  });

  it("prints no rate for zero sends — 0/0 is not 0%", () => {
    const out = buildBlockD([variant({ key: "e1", channel: "email", sends: 0, replies: 0 })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[0].rows[0].cells[0]).toEqual({ text: "—", tone: "dash" });
    expect(out.groups[0].rows[0].cells[1]).toEqual({ text: "0", tone: "zero" });
  });

  it("prints no rate for a non-email channel, ever, however many sends it has", () => {
    const out = buildBlockD([
      variant({ key: "f1", channel: "facebook", sends: 500, replies: 250, replyRate: 0.5 }),
    ]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[1].rows[0].cells[0]).toEqual({ text: "—", tone: "dash" });
  });

  it("prints no rate when sends never arrived", () => {
    const out = buildBlockD([variant({ key: "e1", channel: "email", sends: null, replies: 3 })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[0].rows[0].cells[0]).toEqual({ text: "—", tone: "dash" });
    expect(out.groups[0].rows[0].cells[1]).toEqual({ text: "—", tone: "dash" });
  });
});

describe("Block D — the honesty note (R27)", () => {
  it("renders only when at least one rate is printed", () => {
    const none = buildBlockD(today());
    if (none.kind !== "groups") throw new Error("expected groups");
    // A table with no rates and no sends is not a table of small numbers, and
    // printing the note there would be the opposite of an honesty note.
    expect(none.honesty).toBeNull();

    const some = buildBlockD([variant({ key: "e1", channel: "email", sends: 72, replies: 8 })]);
    if (some.kind !== "groups") throw new Error("expected groups");
    expect(some.honesty).toBe("Rates are computed over small numbers of sends.");
  });

  it("does not render it for sends on a non-email channel alone", () => {
    const out = buildBlockD([variant({ key: "f1", channel: "facebook", sends: 500, replies: 9 })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.honesty).toBeNull();
  });
});

describe("Block D — the default-open rule (R31) and the collapsed line", () => {
  it("is open by default only while every approach has zero sends", () => {
    const zero = buildBlockD(today());
    if (zero.kind !== "groups") throw new Error("expected groups");
    expect(zero.defaultOpen).toBe(true);

    const sent = today();
    sent[0] = { ...sent[0], sends: 1 };
    const out = buildBlockD(sent);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.defaultOpen).toBe(false);
  });

  it("is closed by default when a send count never arrived — that is not zero sends", () => {
    const out = buildBlockD([variant({ key: "e1", sends: null })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.defaultOpen).toBe(false);
  });

  it("says `No sends yet — nothing to compare.` when nothing is measurable", () => {
    const out = buildBlockD(today());
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.collapsed).toEqual({
      kind: "statement",
      text: "No sends yet — nothing to compare.",
    });
  });

  it("carries the best measured row once there is one", () => {
    const out = buildBlockD([
      variant({ key: "e1", label: "Email S1 — specific compliment first", sends: 72, replies: 8 }),
      variant({ key: "e2", label: "Email S1 — pain point first", sends: 54, replies: 3 }),
    ]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.collapsed).toEqual({
      kind: "best",
      name: "Email S1 — specific compliment first",
      rate: "11%",
    });
  });

  it("breaks a tie on sends, so the better-evidenced row wins", () => {
    const out = buildBlockD([
      variant({ key: "small", label: "Small", sends: 10, replies: 1 }),
      variant({ key: "big", label: "Big", sends: 100, replies: 10 }),
    ]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.collapsed).toEqual({ kind: "best", name: "Big", rate: "10%" });
  });

  it("falls back to the statement when only non-email approaches have sends", () => {
    const out = buildBlockD([variant({ key: "f1", channel: "facebook", sends: 31, replies: 2 })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.collapsed).toEqual({
      kind: "statement",
      text: "No sends yet — nothing to compare.",
    });
    expect(out.defaultOpen).toBe(false);
  });
});

describe("Block D — the empty and failed states", () => {
  it("says `No approaches set up.` for a measured emptiness", () => {
    expect(buildBlockD([])).toEqual({ kind: "empty", line: "No approaches set up." });
  });

  it("reports a failure to load for an absence", () => {
    expect(buildBlockD(null)).toEqual({
      kind: "failed",
      line: "Couldn't load approach performance.",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/freelanceVariants.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/freelanceVariants"`.

- [ ] **Step 3: Create `src/lib/freelanceVariants.ts`**

```ts
/**
 * freelanceVariants.ts — Block D, approach performance.
 *
 * THE BLOCK EXISTS TO REFUSE A NUMBER. Replies are only ever detected on email
 * (S15 deleted the inbound Messenger lane, so a reply to a Facebook, Instagram
 * or phone approach is invisible to the system). Rendering those rows as `0%`
 * would not be a measurement of zero, it would be an absence of measurement
 * printed as one.
 *
 * So: the rate is RECOMPUTED here from `sends` and `replies`, and the upstream
 * `replyRate` is never printed. ShikksTracker's own rate() returns 0 for zero
 * sends, which is exactly the lie above. No rate for zero sends. No rate for a
 * non-email channel, ever. No hue on any rate.
 *
 * Every string is quoted from the content deck.
 * Pure: no database, no network, no clock.
 */

import { DASH_CELL, numberCell } from "@/lib/format";
import type { Cell } from "@/lib/format";
import { FAIL_LINES } from "@/lib/freelanceView";
import type { VariantStatsItem } from "@/lib/stApi";

// DASH_CELL is NOT declared here. The Batch 2 review made `DASH` the one
// em-dash in format.ts; R53 moved the ruling one level up, so format.ts owns
// the frozen DASH_CELL and numberCell(null) returns it. One dash cell, one
// identity, no second copy to drift.

export interface ApproachRow {
  key: string;
  name: string;
  /** Group 1: rate, sends, replies. Group 2: rate, sends. */
  cells: Cell[];
}

export interface ApproachGroup {
  eyebrow: string;
  /** Rendered UNDER the group heading and ABOVE its rows, never as a footnote. */
  explain: string | null;
  headers: string[];
  rows: ApproachRow[];
}

export type CollapsedLine =
  | { kind: "statement"; text: string }
  | { kind: "best"; name: string; rate: string };

export type BlockD =
  | { kind: "failed"; line: string }
  | { kind: "empty"; line: string }
  | {
      kind: "groups";
      /** R31. */
      defaultOpen: boolean;
      collapsed: CollapsedLine;
      /** Always exactly two, in order. */
      groups: ApproachGroup[];
      /** R27 — null unless at least one rate is printed. */
      honesty: string | null;
    };

/** With no label the key is the only name the row has. */
function nameOf(v: VariantStatsItem): string {
  return v.label !== null && v.label.length > 0 ? v.label : v.key;
}

/**
 * A rate is printable only on email, only with a measured send count above
 * zero, and only with a measured reply count. A channel we cannot read is not
 * email: we can never claim a reply rate for a channel we do not know.
 */
function printableRate(v: VariantStatsItem): number | null {
  if (v.channel !== "email") return null;
  if (v.sends === null || v.sends <= 0) return null;
  if (v.replies === null) return null;
  return Math.round((v.replies / v.sends) * 100);
}

export function buildBlockD(variants: VariantStatsItem[] | null): BlockD {
  if (variants === null) return { kind: "failed", line: FAIL_LINES.approaches };
  if (variants.length === 0) return { kind: "empty", line: "No approaches set up." };

  const email = variants.filter((v) => v.channel === "email");
  const other = variants.filter((v) => v.channel !== "email");

  const measuredRows: ApproachRow[] = email.map((v) => {
    const rate = printableRate(v);
    return {
      key: v.key,
      name: nameOf(v),
      cells: [
        rate === null ? DASH_CELL : { text: `${rate}%`, tone: "value" },
        numberCell(v.sends),
        numberCell(v.replies),
      ],
    };
  });

  // The rate column stays full of em-dashes and the replies column is dropped
  // entirely; sends stay live.
  const otherRows: ApproachRow[] = other.map((v) => ({
    key: v.key,
    name: nameOf(v),
    cells: [DASH_CELL, numberCell(v.sends)],
  }));

  // R31: open by default ONLY while every approach has zero sends — today's
  // state, where four approaches at `—` rate and `0` sends are the clearest
  // single demonstration on the page of "not measurable is not zero". A send
  // count that never arrived is not zero sends, so it closes the block.
  const defaultOpen = variants.every((v) => v.sends === 0);

  // The best MEASURED row: highest rate, ties broken by the better-evidenced
  // row (more sends), then by the order the API returned.
  let best: { row: VariantStatsItem; rate: number } | null = null;
  for (const v of email) {
    const rate = printableRate(v);
    if (rate === null) continue;
    if (
      best === null ||
      rate > best.rate ||
      (rate === best.rate && (v.sends ?? 0) > (best.row.sends ?? 0))
    ) {
      best = { row: v, rate };
    }
  }

  return {
    kind: "groups",
    defaultOpen,
    collapsed:
      best === null
        ? { kind: "statement", text: "No sends yet — nothing to compare." }
        : { kind: "best", name: nameOf(best.row), rate: `${best.rate}%` },
    groups: [
      {
        eyebrow: "Measured — email",
        explain: null,
        headers: ["Approach", "Reply rate", "Sends", "Replies"],
        rows: measuredRows,
      },
      {
        eyebrow: "Not measurable",
        explain: "Replies are only detected on email, so these can't be scored.",
        headers: ["Approach", "Reply rate", "Sends"],
        rows: otherRows,
      },
    ],
    // R27, stated as an explicit condition so nobody "fixes" its absence later:
    // a table with no rates and no sends is not a table of small numbers, and
    // printing the note there would be the opposite of an honesty note.
    honesty:
      measuredRows.some((r) => r.cells[0].tone !== "dash")
        ? "Rates are computed over small numbers of sends."
        : null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/freelanceVariants.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  18 passed (18)`.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/freelanceVariants.ts src/lib/__tests__/freelanceVariants.test.ts
git commit -F - << 'MSG'
feat(p8b): Block D — two groups, and a rate this app refuses to fake

The reply rate is recomputed from sends and replies; the upstream replyRate
is never printed, because ShikksTracker returns 0 for zero sends and since
S15 replies are only ever detected on email — so a Facebook variant's 0% is
not a measurement, it is an absence of one. No rate for zero sends, no rate
for a non-email channel ever, no hue on any rate.

R31: open by default only while every approach has zero sends. R27: the
honesty note renders only when at least one rate is actually printed, stated
as an explicit condition so its absence is not later "fixed".

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 10: `freelanceGaps.ts` — Block E, what nothing else is handling

**The gaps only.** Replies that already have a drafted follow-up live in `/queue`, and repeating them here would make both lists untrustworthy — which is why this module and the chaser share `fetchLiveAnchorIds` from Task 5.

**Two facts about the contract types, verified in `src/lib/stApi.ts` before the fixtures below were written**, because the test files live under `src/` and `npx tsc --noEmit` checks them:

- `AttentionItem.channel` is declared **`string`**, not a closed union, so the `carrier-pigeon` test compiles as written. (Its doc comment names the four values; the type does not constrain them, which is also why `labelFor` falls back to the raw string rather than throwing.)
- The `reply()` fixture sets exactly `AttentionItem`'s twelve fields — `contactId`, `businessName`, `contactName`, `channel`, `repliedAt`, `replySnippet`, `lastOutboundBody`, `keyPoints`, `offerSummary`, `toneNotes`, `stage`, `replyToLogId` — and `overdue()` sets exactly `OverdueActionItem`'s four: `contactId`, `businessName`, `nextActionAt`, `nextActionNote`. No field is invented and none is missing.

**Files:**
- Create: `src/lib/freelanceGaps.ts`
- Test: `src/lib/__tests__/freelanceGaps.test.ts` (create)

- [ ] **Step 1: Write the failing test**

*Superseded by R51–R54 (`bab6533`, `d5433f2`, `6638101`) — the shipped shape is in the Post-build record and the code is the authority.*

Create `src/lib/__tests__/freelanceGaps.test.ts`:

```ts
/**
 * Block E is "the things nothing else is handling", so the suppression rule is
 * the test that matters: a reply that already carries a live ApprovalItem lives
 * in /queue, and surfacing it here too would make both lists untrustworthy.
 *
 * The snippet's quotation marks are STRAIGHT, exactly as the deck writes them
 * in its Block E rows. Do not "improve" them into curly quotes.
 */
import { describe, it, expect } from "vitest";
import { buildBlockE, GAP_DISPLAY_BOUND } from "@/lib/freelanceGaps";
import type { AttentionItem, OverdueActionItem } from "@/lib/stApi";

const NOW = new Date("2026-09-05T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const CONTACTS_URL = "https://st.example.com/contacts";

function agoIso(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

function reply(over: Partial<AttentionItem> = {}): AttentionItem {
  return {
    contactId: "c1",
    businessName: "Nova Dental",
    contactName: null,
    channel: "email",
    repliedAt: agoIso(4 * HOUR),
    replySnippet: "Do you do logos as well, or just the site?",
    lastOutboundBody: null,
    keyPoints: "",
    offerSummary: null,
    toneNotes: null,
    stage: 1,
    replyToLogId: "log-1",
    ...over,
  };
}

function overdue(over: Partial<OverdueActionItem> = {}): OverdueActionItem {
  return {
    contactId: "c9",
    businessName: "Kiddo Co",
    nextActionAt: agoIso(3 * DAY),
    nextActionNote: "Send the revised proposal",
    ...over,
  };
}

function build(
  replies: AttentionItem[],
  overdues: OverdueActionItem[],
  live: string[] = []
) {
  return buildBlockE({
    now: NOW,
    repliedUnanswered: replies,
    overdueActions: overdues,
    liveAnchorIds: new Set(live),
    contactsBaseUrl: CONTACTS_URL,
  });
}

describe("Block E — the three kinds of row", () => {
  it("kind 1: a reply on a channel nothing drafts for", () => {
    const out = build(
      [
        reply({
          contactId: "c5",
          businessName: "Bella's Cafe",
          channel: "instagram",
          repliedAt: agoIso(2 * DAY),
          replySnippet: "Sounds good, what would the timeline look like?",
          replyToLogId: "log-5",
        }),
      ],
      []
    );
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0]).toEqual({
      id: "reply:log-5",
      kind: "unsupported-channel",
      businessName: "Bella's Cafe",
      href: "https://st.example.com/contacts/c5",
      channel: "Instagram",
      waiting: "replied 2 days ago",
      waitingIsStale: false,
      snippet: '"Sounds good, what would the timeline look like?"',
      reason: "Nothing drafts replies for Instagram.",
    });
  });

  it("kind 2: a reply with no draft in the queue", () => {
    const out = build([reply()], []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0]).toEqual({
      id: "reply:log-1",
      kind: "no-draft",
      businessName: "Nova Dental",
      href: "https://st.example.com/contacts/c1",
      channel: "Email",
      waiting: "replied 4 hours ago",
      waitingIsStale: false,
      snippet: '"Do you do logos as well, or just the site?"',
      reason: "No draft in the queue.",
    });
  });

  it("kind 3: an overdue follow-up, amber, with an EMPTY channel slot", () => {
    const out = build([], [overdue()]);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0]).toEqual({
      id: "overdue:c9",
      kind: "overdue-followup",
      businessName: "Kiddo Co",
      href: "https://st.example.com/contacts/c9",
      // Inapplicable, not unmeasured — so no tag and no em-dash.
      channel: null,
      waiting: "follow-up due 3 days ago",
      waitingIsStale: true,
      // The note sits in the snippet register, unquoted.
      snippet: "Send the revised proposal",
      reason: null,
    });
  });

  it("renders an overdue row with no note rather than dropping it", () => {
    const out = build([], [overdue({ nextActionNote: null })]);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0].snippet).toBeNull();
    expect(out.rows[0].waiting).toBe("follow-up due 3 days ago");
  });

  it("renders a reply with no snippet rather than quoting an empty string", () => {
    const out = build([reply({ replySnippet: null })], []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0].snippet).toBeNull();
  });
});

describe("Block E — suppression, which is the whole point", () => {
  it("drops a reply that already carries a live ApprovalItem", () => {
    const out = build([reply({ replyToLogId: "log-1" })], [], ["log-1"]);
    expect(out).toEqual({ kind: "empty", line: "Nothing waiting." });
  });

  it("suppresses before it classifies, so a drafted email never reappears here", () => {
    const out = build([reply({ replyToLogId: "log-1" }), reply({ contactId: "c2", replyToLogId: "log-2" })], [], ["log-1"]);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows.map((r) => r.id)).toEqual(["reply:log-2"]);
  });

  it("never suppresses an overdue follow-up — it has no anchor to match", () => {
    const out = build([], [overdue()], ["log-1", "c9"]);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows).toHaveLength(1);
  });

  it("keeps a reply with no anchor: nothing can ever draft it", () => {
    const out = build([reply({ replyToLogId: "" })], []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0].kind).toBe("no-draft");
    expect(out.rows[0].id).toBe("reply:c1");
  });
});

describe("Block E — channel labels", () => {
  it("uses the deck's four labels, and names the channel in the reason", () => {
    for (const [channel, label] of [
      ["email", "Email"],
      ["facebook", "Facebook"],
      ["instagram", "Instagram"],
      ["phone", "Phone"],
    ] as const) {
      const out = build([reply({ channel, replyToLogId: `log-${channel}` })], []);
      if (out.kind !== "rows") throw new Error("expected rows");
      expect(out.rows[0].channel).toBe(label);
    }
    const phone = build([reply({ channel: "phone" })], []);
    if (phone.kind !== "rows") throw new Error("expected rows");
    expect(phone.rows[0].reason).toBe("Nothing drafts replies for Phone.");
  });

  it("passes an unrecognised channel through rather than inventing a label", () => {
    const out = build([reply({ channel: "carrier-pigeon" })], []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0].channel).toBe("carrier-pigeon");
    expect(out.rows[0].kind).toBe("unsupported-channel");
  });
});

describe("Block E — ordering, counting and the bound", () => {
  it("puts replies before overdue follow-ups and keeps each feed's order", () => {
    const out = build(
      [reply({ contactId: "a", replyToLogId: "la" }), reply({ contactId: "b", replyToLogId: "lb" })],
      [overdue({ contactId: "x" }), overdue({ contactId: "y" })]
    );
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows.map((r) => r.id)).toEqual([
      "reply:la",
      "reply:lb",
      "overdue:x",
      "overdue:y",
    ]);
  });

  it("counts every gap, bounds the display at 20, and states what it did", () => {
    const many = Array.from({ length: 41 }, (_, i) =>
      reply({ contactId: `c${i}`, replyToLogId: `log-${i}` })
    );
    const out = build(many, []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(GAP_DISPLAY_BOUND).toBe(20);
    expect(out.count).toBe(41);
    expect(out.rows).toHaveLength(20);
    expect(out.bound).toBe("Showing 20 of 41.");
  });

  it("states no bound at exactly the bound", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      reply({ contactId: `c${i}`, replyToLogId: `log-${i}` })
    );
    const out = build(many, []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.bound).toBeNull();
  });

  it("says `Nothing waiting.` — today's state, and it must look intentional", () => {
    expect(build([], [])).toEqual({ kind: "empty", line: "Nothing waiting." });
  });

  it("reports a failure to load rather than an emptiness", () => {
    const out = buildBlockE({
      now: NOW,
      repliedUnanswered: null,
      overdueActions: null,
      liveAnchorIds: new Set(),
      contactsBaseUrl: CONTACTS_URL,
    });
    expect(out).toEqual({ kind: "failed", line: "Couldn't load what's waiting." });
  });
});

describe("countGaps — the figure Block A's third card shares", () => {
  it("is the computed gap count, never the raw feed length", () => {
    const out = build([reply({ replyToLogId: "log-1" }), reply({ contactId: "c2", replyToLogId: "log-2" })], [overdue()], ["log-1"]);
    if (out.kind !== "rows") throw new Error("expected rows");
    // Two replies in, one suppressed, one overdue: the feed had three rows and
    // the answer is two.
    expect(out.count).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/freelanceGaps.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/freelanceGaps"`.

- [ ] **Step 3: Create `src/lib/freelanceGaps.ts`**

*Superseded by R51–R54 (`bab6533`, `d5433f2`, `6638101`) — the shipped shape is in the Post-build record and the code is the authority.* In short: `overdueActions ?? []` no longer discards the absence, so `BlockE` gains an `absent` kind and `rows` gains `absentNote` (R51); `DRAFT_CHANNELS` / `DraftChannel` moved to the import-free leaf `src/lib/draftChannels.ts`, which is what keeps this file's "Pure: no database" true at the module-graph level (R52); rows are ordered longest-wait-first with a stable tie (R53); `CHANNEL_LABELS` is a `Map`, not an object literal; and `needsYouFigure(block: BlockE): NeedsYouFigure` is exported from here as the one bridge to Block A's third card (R54).

```ts
/**
 * freelanceGaps.ts — Block E, "Needs you".
 *
 * THE GAPS ONLY — the things nothing else is handling. A reply that already has
 * a drafted follow-up lives in /queue, and repeating it here would make both
 * lists untrustworthy. The suppression set comes from queue.ts's
 * fetchLiveAnchorIds, the same query the chaser uses for idempotency, so the
 * page and the chaser can never disagree about the same lead.
 *
 * Over-cap leads are left in deliberately: a reply the chaser skipped only
 * because it hit CHASER_MAX_PER_RUN will be drafted on the next run, so it is
 * arguably not a gap — but it has no ApprovalItem yet, and a backlog that never
 * clears is worth seeing.
 *
 * Every string is quoted from the content deck. The snippet's quotation marks
 * are STRAIGHT, exactly as the deck writes them; do not change them to curly.
 *
 * Pure: no database, no network, and `now` is an argument.
 */

import { formatWaiting } from "@/lib/format";
import { FAIL_LINES } from "@/lib/freelanceView";
import { isSupportedChannel } from "@/lib/chaser";
import type { AttentionItem, OverdueActionItem } from "@/lib/stApi";

/** The deck's `Showing 20 of 41.` */
export const GAP_DISPLAY_BOUND = 20;

/** The deck's four channel labels. */
const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  facebook: "Facebook",
  instagram: "Instagram",
  phone: "Phone",
};

export type GapKind = "unsupported-channel" | "no-draft" | "overdue-followup";

export interface GapRow {
  id: string;
  kind: GapKind;
  businessName: string;
  href: string;
  /** null on an overdue follow-up: inapplicable, not unmeasured. */
  channel: string | null;
  waiting: string;
  /** true only on an overdue follow-up -> .pwhen.is-stale. */
  waitingIsStale: boolean;
  snippet: string | null;
  reason: string | null;
}

export type BlockE =
  | { kind: "failed"; line: string }
  | { kind: "empty"; line: string }
  | { kind: "rows"; count: number; rows: GapRow[]; bound: string | null };

export interface BlockEInput {
  now: Date;
  /** null = the attention call failed. */
  repliedUnanswered: AttentionItem[] | null;
  /** null = the call failed, or the API omitted the block. */
  overdueActions: OverdueActionItem[] | null;
  liveAnchorIds: Set<string>;
  /** ShikksTracker's contacts route, built server-side; the id is appended. */
  contactsBaseUrl: string;
}

/** An unparseable timestamp reads as `just now` rather than as NaN on the page. */
function waitedMs(now: Date, iso: string): number {
  const then = new Date(iso).getTime();
  return Number.isNaN(then) ? 0 : now.getTime() - then;
}

function labelFor(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

export function buildBlockE(input: BlockEInput): BlockE {
  const { now, repliedUnanswered, overdueActions, liveAnchorIds, contactsBaseUrl } = input;

  if (repliedUnanswered === null) {
    return { kind: "failed", line: FAIL_LINES.needsYou };
  }

  const rows: GapRow[] = [];

  for (const item of repliedUnanswered) {
    // Suppress FIRST. A reply already carrying a live ApprovalItem belongs to
    // /queue whatever its channel is.
    if (item.replyToLogId && liveAnchorIds.has(item.replyToLogId)) continue;

    const supported = isSupportedChannel(item.channel);
    const label = labelFor(item.channel);
    rows.push({
      // The anchor is the stable identity where there is one; a reply with no
      // anchor can never be drafted, so its contact id is the next best key.
      id: `reply:${item.replyToLogId || item.contactId}`,
      kind: supported ? "no-draft" : "unsupported-channel",
      businessName: item.businessName,
      href: `${contactsBaseUrl}/${encodeURIComponent(item.contactId)}`,
      channel: label,
      waiting: `replied ${formatWaiting(waitedMs(now, item.repliedAt))}`,
      waitingIsStale: false,
      snippet: item.replySnippet ? `"${item.replySnippet}"` : null,
      reason: supported ? "No draft in the queue." : `Nothing drafts replies for ${label}.`,
    });
  }

  for (const item of overdueActions ?? []) {
    rows.push({
      id: `overdue:${item.contactId}`,
      kind: "overdue-followup",
      businessName: item.businessName,
      href: `${contactsBaseUrl}/${encodeURIComponent(item.contactId)}`,
      // Inapplicable rather than unmeasured, so no tag and no em-dash.
      channel: null,
      waiting: `follow-up due ${formatWaiting(waitedMs(now, item.nextActionAt))}`,
      waitingIsStale: true,
      // The note sits in the snippet register, unquoted — it is Riku's own note
      // to himself, not somebody's words.
      snippet: item.nextActionNote,
      reason: null,
    });
  }

  if (rows.length === 0) {
    // Today's state. It must look intentional rather than like a failure, which
    // is why it is a sentence and not a 0.
    return { kind: "empty", line: "Nothing waiting." };
  }

  return {
    kind: "rows",
    count: rows.length,
    rows: rows.slice(0, GAP_DISPLAY_BOUND),
    bound:
      rows.length > GAP_DISPLAY_BOUND
        ? `Showing ${GAP_DISPLAY_BOUND} of ${rows.length}.`
        : null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/freelanceGaps.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  17 passed (17)`.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/freelanceGaps.ts src/lib/__tests__/freelanceGaps.test.ts
git commit -F - << 'MSG'
feat(p8b): Block E — the gaps, and only the gaps

Three row kinds: a reply on a channel nothing drafts for, a reply with no
draft in the queue, and an overdue follow-up. Suppression runs first and
reads the same liveAnchorIds set the chaser uses, so the page and the chaser
can never disagree about the same lead.

The overdue row's channel slot is empty rather than an em-dash — inapplicable
is not unmeasured — and its note sits in the snippet register unquoted,
because it is Riku's note to himself and not somebody's words.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 11: The `HealthSnapshot` model

A singleton, overwritten rather than accumulated. **No TTL** — the newest reading must always be present. `SiteResult` from `siteHealth.ts` is already `{ name, up, detail }`, so the stored shape is the produced shape and there is no mapping layer to drift.

**Files:**
- Create: `src/models/HealthSnapshot.ts`
- Test: `src/lib/__tests__/models.test.ts` (extend)
- Modify: `scripts/sync-indexes.mts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/models.test.ts`:

```ts
describe("HealthSnapshot", () => {
  it("accepts a valid reading", async () => {
    const doc = new HealthSnapshot({
      checkedAt: new Date("2026-09-05T04:00:00.000Z"),
      sites: [{ name: "Meowchi", up: true, detail: "Meowchi ok" }],
    });
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it("requires checkedAt — a reading with no time is not a reading", async () => {
    const doc = new HealthSnapshot({ sites: [] });
    await expect(doc.validate()).rejects.toThrow(/checkedAt/);
  });

  it("accepts an empty sites array, which is different from no document", async () => {
    const doc = new HealthSnapshot({ checkedAt: new Date(), sites: [] });
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it("bounds the array, per CLAUDE.md", async () => {
    const doc = new HealthSnapshot({
      checkedAt: new Date(),
      sites: Array.from({ length: 21 }, (_, i) => ({
        name: `s${i}`,
        up: true,
        detail: "ok",
      })),
    });
    await expect(doc.validate()).rejects.toThrow(/sites/);
  });

  it("bounds every string", async () => {
    const long = new HealthSnapshot({
      checkedAt: new Date(),
      sites: [{ name: "x".repeat(61), up: true, detail: "ok" }],
    });
    await expect(long.validate()).rejects.toThrow(/name/);

    const longDetail = new HealthSnapshot({
      checkedAt: new Date(),
      sites: [{ name: "ok", up: true, detail: "x".repeat(201) }],
    });
    await expect(longDetail.validate()).rejects.toThrow(/detail/);
  });

  it("carries no TTL — the newest reading must always be present", () => {
    const ttl = HealthSnapshot.schema
      .indexes()
      .filter(([, options]) => (options as { expireAfterSeconds?: number }).expireAfterSeconds !== undefined);
    expect(ttl).toEqual([]);
  });
});
```

Add the import at the top of the file, beside the other models:

```ts
import HealthSnapshot from "@/models/HealthSnapshot";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/models.test.ts`
Expected: FAIL — `Failed to resolve import "@/models/HealthSnapshot"`.

- [ ] **Step 3: Create `src/models/HealthSnapshot.ts`**

*Superseded by R55 (`fe512b1`) — the shipped shape is in the Post-build record and the code is the authority.* In short: the model exports `HEALTH_SNAPSHOT_ID = "singleton"` and declares `_id: { type: String, default: HEALTH_SNAPSHOT_ID, enum: [HEALTH_SNAPSHOT_ID], maxlength: 16 }` (`IHealthSnapshot extends Document<string>`), because `OsSettings`' `{}` filter would let two first writes leave two documents and a read that settles on the orphan makes the strip permanently amber. The `required`-on-an-array paragraph is also rewritten: in Mongoose 9.9.4 `required: true` on an array does **not** reject `[]`, so the option would add nothing — it is omitted on purpose all the same, and the bound validator stays.

```ts
import mongoose, { Document, Model, Schema } from "mongoose";

export interface IHealthSite {
  name: string;
  up: boolean;
  detail: string;
}

/**
 * Mirrors SiteResult in src/lib/siteHealth.ts exactly, so the stored shape IS
 * the produced shape and there is no mapping layer to drift. `detail` holds the
 * strings classifyStatus/classifyError produce ("Meowchi ok",
 * "Meowchi returned HTTP 503"), which the health strip renders verbatim.
 */
const HealthSiteSchema = new Schema<IHealthSite>(
  {
    name: { type: String, required: true, maxlength: 60 },
    up: { type: Boolean, required: true },
    detail: { type: String, required: true, maxlength: 200 },
  },
  { _id: false, strict: true }
);

export interface IHealthSnapshot extends Document {
  checkedAt: Date;
  sites: IHealthSite[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Singleton: the most recent site-health reading, overwritten rather than
 * accumulated. Access ONLY through src/lib/healthSnapshot.ts.
 *
 * NO TTL, deliberately. Every other ephemeral record in this app expires
 * (AgentRun 90d, LoginAttempt 15min); this one must not, because the newest
 * reading has to be present whenever the Freelance page renders. Expiring it
 * would make the strip say "sites never checked" every time the document aged
 * out — an alarm produced by our own cleanup.
 *
 * updatedAt is on because updates are the entire point of this record.
 * No Schema.Types.Mixed, no unbounded string, and the array is bounded — three
 * sites are watched today and 20 is a ceiling, not a target.
 *
 * `sites` carries NO `required: true`. A Mongoose array already defaults to []
 * and `required` on an array is a known trap — its semantics on an empty array
 * are not "the field is present", so a legitimately empty reading would fail
 * validation. An empty reading is valid and means something real: the check ran
 * and watched nothing. The bound validator stays.
 */
const HealthSnapshotSchema = new Schema<IHealthSnapshot>(
  {
    checkedAt: { type: Date, required: true },
    sites: {
      type: [HealthSiteSchema],
      validate: {
        validator: (value: IHealthSite[]) => value.length <= 20,
        message: "sites holds at most 20 entries.",
      },
    },
  },
  { timestamps: { createdAt: true, updatedAt: true }, strict: true }
);

const HealthSnapshot =
  (mongoose.models.HealthSnapshot as Model<IHealthSnapshot>) ||
  mongoose.model<IHealthSnapshot>("HealthSnapshot", HealthSnapshotSchema);

export default HealthSnapshot;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/models.test.ts`
Expected: `Test Files  1 passed (1)`, zero failures.

- [ ] **Step 5: Register it with the index sync script**

The model declares no index of its own, so this changes nothing today — but the script's `MODELS` array is the app's inventory of models, and a model missing from it is a model whose future index change ships unnoticed.

In `scripts/sync-indexes.mts`, add the import beside the others:

```ts
import HealthSnapshot from "../src/models/HealthSnapshot.ts";
```

and add it to the array on line 31:

```ts
const MODELS = [ApprovalItem, AgentRun, PushSubscription, OsSettings, LoginAttempt, HealthSnapshot];
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add src/models/HealthSnapshot.ts src/lib/__tests__/models.test.ts scripts/sync-indexes.mts
git commit -F - << 'MSG'
feat(p8b): the HealthSnapshot singleton

The stored site-health reading, so Block F survives a ShikksTracker outage —
site results are local. The stored shape is siteHealth's SiteResult exactly,
so there is no mapping layer to drift.

No TTL, deliberately: the newest reading must always be present, and
expiring it would make the strip report "sites never checked" as a result of
our own cleanup. Bounded array, bounded strings, explicit timestamps.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 12: `healthSnapshot.ts` — the accessor and the 60-second floor

**This accessor is not a departure from the house pattern; it is the same rule applied a second time (R47).** When this plan was written, the only settings accessor was `getOsSettings()`, which reaches its singleton with `findOneAndUpdate({}, …, { upsert: true })` on *read* — so a read-only health accessor looked like an exception. R37 has since given settings their own `readOsSettings()`, which already reads with `findOne` and never upserts. **What differs here is what a missing document means.** Settings have honest schema defaults — the values the upsert would have written — so `readOsSettings()` falls back to them. A reading that never happened has none: an upsert or a default here would manufacture a document with a made-up `checkedAt` and an empty `sites` array, and the strip would confidently report "checked just now, no sites watched" when in truth it has never run. `null` is the only honest answer, and Block F says `sites never checked`.

**Files:**
- Create: `src/lib/healthSnapshot.ts`
- Test: `src/lib/__tests__/healthSnapshot.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/healthSnapshot.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/healthSnapshot.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/healthSnapshot"`.

- [ ] **Step 3: Create `src/lib/healthSnapshot.ts`**

*Superseded by R55 and R56 (`fe512b1`) — the shipped shape is in the Post-build record and the code is the authority.* In short: both reads and writes address `{ _id: HEALTH_SNAPSHOT_ID }` rather than `{}`, `getHealthSnapshot` takes a typed projection and returns `null` for a document whose `checkedAt` is not a `Date`, and `saveHealthSnapshot` retries exactly once on an `11000` duplicate key — the losing side of the first-write race. The file header is R47's, not the "one trap" wording above.

```ts
/**
 * healthSnapshot.ts — access layer for the stored site-health reading.
 *
 * THE ONE PLACE THIS DELIBERATELY DEPARTS FROM THE HOUSE SINGLETON PATTERN.
 * getOsSettings() reaches its singleton with findOneAndUpdate({}, …, {upsert:
 * true}) on READ, because a settings document with schema defaults is a correct
 * answer. This one must not: an upsert on read would manufacture a document
 * with a defaulted checkedAt and an empty sites array, and the health strip
 * would confidently report "checked just now, no sites watched" when in truth
 * nothing has ever run. Read with findOne, return null, and let Block F say
 * `sites never checked`. The upsert belongs to the write path only.
 *
 * Callers must have connectDB()'d already — same convention as the rest of the
 * lib layer.
 */

import HealthSnapshot from "@/models/HealthSnapshot";
import type { SiteResult } from "@/lib/siteHealth";

/**
 * The server-side floor on `Check now`, read from the snapshot's own checkedAt.
 * It exists so a stuck finger cannot fire nine requests at client sites, not to
 * defend against abuse — there is exactly one user behind a session cookie.
 */
export const CHECK_FLOOR_MS = 60_000;

export interface StoredHealth {
  checkedAt: Date;
  sites: SiteResult[];
}

/**
 * Pure, so the route's one decision is unit-testable without a route, a
 * database or a network.
 *
 * A null snapshot is NEVER within the floor: nothing has been read, so there is
 * nothing to return instead. A checkedAt in the future is not within it either
 * — a clock skew must not make Check now permanently unusable.
 */
export function isWithinCheckFloor(
  now: Date,
  checkedAt: Date | null,
  floorMs: number = CHECK_FLOOR_MS
): boolean {
  if (checkedAt === null) return false;
  const age = now.getTime() - checkedAt.getTime();
  return age >= 0 && age < floorMs;
}

/**
 * The newest reading, or null when none has ever been written.
 * findOne — never an upsert. See the file header.
 */
export async function getHealthSnapshot(): Promise<StoredHealth | null> {
  const doc = await HealthSnapshot.findOne({})
    .select({ checkedAt: 1, sites: 1 })
    .lean();
  if (!doc) return null;

  const row = doc as unknown as { checkedAt: Date; sites?: SiteResult[] };
  return {
    checkedAt: row.checkedAt,
    sites: (row.sites ?? []).map((s) => ({ name: s.name, up: s.up, detail: s.detail })),
  };
}

/**
 * Overwrites the singleton. The upsert lives here, on the write path, where a
 * created document is a real reading rather than a manufactured one.
 */
export async function saveHealthSnapshot(
  checkedAt: Date,
  sites: SiteResult[]
): Promise<void> {
  await HealthSnapshot.findOneAndUpdate(
    {},
    { $set: { checkedAt, sites } },
    {
      upsert: true,
      setDefaultsOnInsert: true,
      // Mongoose update validators are off by default — without this the
      // maxlength and array bounds on the schema are decorative on this path.
      runValidators: true,
    }
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/healthSnapshot.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  6 passed (6)`.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Confirm the read path never upserts**

Run: `git grep -n --untracked "upsert" src/lib/healthSnapshot.ts`
Expected: **exactly one *code* occurrence** — `upsert: true`, inside `saveHealthSnapshot`. The file's docblocks say "upsert" in prose seven more times, explaining why the read path does not; read the hits rather than counting them. **`--untracked` is required** — the file is new and not yet committed at this step (Batch 4 review, the same correction Task 1 step 8 took).

- [ ] **Step 6: Commit**

```bash
git add src/lib/healthSnapshot.ts src/lib/__tests__/healthSnapshot.test.ts
git commit -F - << 'MSG'
feat(p8b): the health-snapshot accessor and the 60-second floor

getHealthSnapshot uses findOne and NEVER upserts, unlike the OsSettings
accessor: an upsert on read would manufacture a document with a defaulted
checkedAt and an empty sites array, and the strip would report "checked just
now, no sites watched" when nothing had ever run. Null is the honest answer,
and Block F says "sites never checked".

The floor is a pure function rather than a branch in the handler, so the
route's one decision is testable without a route or a database. A null
snapshot and a future timestamp are both outside it.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 13: `freelanceHealth.ts` — Block F, the health strip

**Silent when all is well.** It reads as a footer until something is wrong, and then it becomes a bordered card. The staleness threshold is an **argument**, not an import of `EXPECTATIONS`, so the 30-hour rule stays pure and testable.

**Files:**
- Create: `src/lib/freelanceHealth.ts`
- Test: `src/lib/__tests__/freelanceHealth.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/freelanceHealth.test.ts`:

```ts
/**
 * Block F is the one place on the page where red is spent, so the switch
 * between the quiet footer and the bordered alarm card is the test that
 * matters most — followed by the 30-hour rule, which stops a stored reading
 * from asserting a present state it can no longer support.
 *
 * Every warning string is passed through from evaluateOutreach and siteHealth
 * VERBATIM. Nothing here rewrites one.
 */
import { describe, it, expect } from "vitest";
import { buildHealthStrip } from "@/lib/freelanceHealth";
import { evaluateOutreach } from "@/lib/outreachHealth";
import { AGENT_STALE_HOURS } from "@/lib/watchdog";
import type { SummaryResponse } from "@/lib/stApi";

const NOW = new Date("2026-09-05T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * HOUR);
}

function summary(over: Partial<SummaryResponse> = {}): SummaryResponse {
  return {
    queue: { drafts: 24, approved: 0 },
    engine: { lastRunAt: hoursAgo(2).toISOString(), lastRunErrors: 0 },
    contacts: null,
    campaigns: null,
    ...over,
  };
}

const OK_SITES = [
  { name: "AzeroTech", up: true, detail: "AzeroTech ok" },
  { name: "Meowchi", up: true, detail: "Meowchi ok" },
  { name: "ShikksTracker", up: true, detail: "ShikksTracker ok" },
];

function strip(over: Partial<Parameters<typeof buildHealthStrip>[0]> = {}) {
  const s = summary();
  return buildHealthStrip({
    now: NOW,
    findings: evaluateOutreach(NOW, s),
    engineLastRunAt: s.engine.lastRunAt,
    snapshot: { checkedAt: hoursAgo(6), sites: OK_SITES },
    monitoringEnabled: true,
    staleHours: AGENT_STALE_HOURS,
    ...over,
  });
}

describe("Block F — the quiet form", () => {
  it("renders the deck's single line when all is well", () => {
    const out = strip();
    if (out.kind !== "quiet") throw new Error("expected quiet");
    expect(out.parts).toEqual([
      { text: "Engine ran 2h ago", aged: false },
      { text: "all sites ok", aged: false },
      { text: "checked 6h ago", aged: false },
    ]);
  });

  it("says `Engine — unknown` in grey when the summary call failed", () => {
    const out = strip({ findings: null, engineLastRunAt: null });
    if (out.kind !== "quiet") throw new Error("expected quiet");
    expect(out.parts[0]).toEqual({ text: "Engine — unknown", aged: false });
  });

  it("makes no claim about sites it has never checked", () => {
    const out = strip({ snapshot: null });
    if (out.kind !== "quiet") throw new Error("expected quiet");
    expect(out.parts.map((p) => p.text)).toEqual(["Engine ran 2h ago", "sites never checked"]);
  });

  it("makes `sites never checked` amber with monitoring on and grey with it off", () => {
    const on = strip({ snapshot: null, monitoringEnabled: true });
    if (on.kind !== "quiet") throw new Error("expected quiet");
    expect(on.parts[1].aged).toBe(true);

    // With monitoring off the reading is EXPECTED to be absent, and an alarm
    // about an expected absence is a daily false alarm.
    const off = strip({ snapshot: null, monitoringEnabled: false });
    if (off.kind !== "quiet") throw new Error("expected quiet");
    expect(off.parts[1].aged).toBe(false);
  });

  it("claims nothing about sites when the reading holds none", () => {
    const out = strip({ snapshot: { checkedAt: hoursAgo(6), sites: [] } });
    if (out.kind !== "quiet") throw new Error("expected quiet");
    expect(out.parts.map((p) => p.text)).toEqual(["Engine ran 2h ago", "checked 6h ago"]);
  });
});

describe("Block F — the 30-hour rule", () => {
  it("keeps the claim inside the threshold", () => {
    const out = strip({ snapshot: { checkedAt: hoursAgo(AGENT_STALE_HOURS), sites: OK_SITES } });
    if (out.kind !== "quiet") throw new Error("expected quiet");
    expect(out.parts.map((p) => p.text)).toContain("all sites ok");
  });

  it("stops printing `all sites ok` past it, and ages the stamp", () => {
    const out = strip({
      snapshot: { checkedAt: hoursAgo(AGENT_STALE_HOURS + 18), sites: OK_SITES },
    });
    if (out.kind !== "quiet") throw new Error("expected quiet");
    expect(out.parts.map((p) => p.text)).not.toContain("all sites ok");
    expect(out.parts[1]).toEqual({ text: "sites not checked since 2d ago", aged: true });
  });

  it("takes the threshold as an argument rather than importing EXPECTATIONS", () => {
    const out = strip({
      snapshot: { checkedAt: hoursAgo(5), sites: OK_SITES },
      staleHours: 4,
    });
    if (out.kind !== "quiet") throw new Error("expected quiet");
    expect(out.parts[1].aged).toBe(true);
  });
});

describe("Block F — the alarm form", () => {
  it("becomes a card the moment there is one warning", () => {
    const stalled = summary({ engine: { lastRunAt: hoursAgo(72).toISOString(), lastRunErrors: 0 } });
    const out = buildHealthStrip({
      now: NOW,
      findings: evaluateOutreach(NOW, stalled),
      engineLastRunAt: stalled.engine.lastRunAt,
      snapshot: { checkedAt: hoursAgo(6), sites: OK_SITES },
      monitoringEnabled: true,
      staleHours: AGENT_STALE_HOURS,
    });
    if (out.kind !== "alarm") throw new Error("expected alarm");
    expect(out.warnings).toEqual([
      { tone: "stale", text: "ShikksTracker send engine last ran 3d ago" },
    ]);
    expect(out.stamp).toEqual({ text: "checked 6h ago", aged: false });
  });

  it("passes every evaluateOutreach string through verbatim, with the right hue", () => {
    const stalled = summary({
      queue: { drafts: 0, approved: 2 },
      engine: { lastRunAt: null, lastRunErrors: null },
    });
    const out = buildHealthStrip({
      now: NOW,
      findings: evaluateOutreach(NOW, stalled),
      engineLastRunAt: null,
      snapshot: { checkedAt: hoursAgo(6), sites: OK_SITES },
      monitoringEnabled: true,
      staleHours: AGENT_STALE_HOURS,
    });
    if (out.kind !== "alarm") throw new Error("expected alarm");
    expect(out.warnings).toEqual([
      { tone: "missing", text: "ShikksTracker send engine has never reported a run" },
      // Red, because it only ever fires beside a stalled engine — a human is
      // waiting.
      { tone: "missing", text: "2 approved messages are stranded, unsent" },
    ]);
  });

  it("passes a site's own detail string through, in red", () => {
    const out = strip({
      snapshot: {
        checkedAt: hoursAgo(6),
        sites: [
          { name: "AzeroTech", up: true, detail: "AzeroTech ok" },
          { name: "Meowchi", up: false, detail: "Meowchi returned HTTP 503" },
          { name: "ShikksTracker", up: true, detail: "ShikksTracker ok" },
        ],
      },
    });
    if (out.kind !== "alarm") throw new Error("expected alarm");
    expect(out.warnings).toEqual([
      { tone: "missing", text: "Meowchi returned HTTP 503" },
    ]);
    // Healthy items follow on one indented line — including the engine, which
    // is healthy here.
    expect(out.fine).toEqual(["Engine ran 2h ago", "AzeroTech ok", "ShikksTracker ok"]);
  });

  it("puts `Engine — unknown` among the healthy items, never among the warnings", () => {
    const out = strip({
      findings: null,
      engineLastRunAt: null,
      snapshot: {
        checkedAt: hoursAgo(6),
        sites: [{ name: "Meowchi", up: false, detail: "Meowchi unreachable" }],
      },
    });
    if (out.kind !== "alarm") throw new Error("expected alarm");
    expect(out.warnings.map((w) => w.text)).toEqual(["Meowchi unreachable"]);
    expect(out.fine).toEqual(["Engine — unknown"]);
  });

  it("still warns about a site that was down at the last reading, however old it is", () => {
    // Over-report: suppressing a red warning because the reading aged would be
    // the wrong direction to fail in. The stamp already says how old it is.
    const out = strip({
      snapshot: {
        checkedAt: hoursAgo(AGENT_STALE_HOURS + 18),
        sites: [{ name: "Meowchi", up: false, detail: "Meowchi timed out" }],
      },
    });
    if (out.kind !== "alarm") throw new Error("expected alarm");
    expect(out.warnings.map((w) => w.text)).toEqual(["Meowchi timed out"]);
    expect(out.stamp).toEqual({ text: "sites not checked since 2d ago", aged: true });
  });

  it("reports an engine error count with the singular the deck writes", () => {
    const one = summary({ engine: { lastRunAt: hoursAgo(2).toISOString(), lastRunErrors: 1 } });
    const out = buildHealthStrip({
      now: NOW,
      findings: evaluateOutreach(NOW, one),
      engineLastRunAt: one.engine.lastRunAt,
      snapshot: { checkedAt: hoursAgo(6), sites: OK_SITES },
      monitoringEnabled: true,
      staleHours: AGENT_STALE_HOURS,
    });
    if (out.kind !== "alarm") throw new Error("expected alarm");
    expect(out.warnings).toEqual([
      { tone: "missing", text: "ShikksTracker send engine reported 1 error" },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/freelanceHealth.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/freelanceHealth"`.

- [ ] **Step 3: Create `src/lib/freelanceHealth.ts`**

*Superseded by R56 and R57 (`fe512b1`) — the shipped shape is in the Post-build record and the code is the authority.* In short: `enginePhrase` reads `msSince` from `format.ts` instead of building its own `new Date(...).getTime()` / `Number.isNaN` pair (Batch 4 amendment); `HealthStripInput.snapshot` widens to `StoredHealth | null | "unread"`, and `"unread"` prints the stamp `sites — unknown` with no `all sites ok`, no site warnings and no healthy site lines (R56); and the aged stamp reads `aged: monitoringEnabled`, keeping its words and losing its hue while monitoring is off (R57). `HOUR_MS` is imported from `format.ts` rather than declared here.

```ts
/**
 * freelanceHealth.ts — Block F, the health strip.
 *
 * SILENT WHEN ALL IS WELL. It reads as a footer until something is wrong, and
 * then it becomes a bordered card: cards earn their borders, and a structural
 * alarm is quieter and stronger than more colour.
 *
 * Every warning string is passed through VERBATIM from evaluateOutreach
 * (outreachHealth.ts) and from the SiteResult details siteHealth.ts produces.
 * Nothing here rewrites one — those strings are already the deck's, character
 * for character.
 *
 * The marker is the system's own hued dot, never a warning triangle: U+26A0
 * renders in emoji presentation on several platforms, and a colour glyph has no
 * place in a monochrome instrument panel.
 *
 * The staleness threshold is an ARGUMENT rather than an import of EXPECTATIONS,
 * so the 30-hour rule stays pure and testable. Production passes
 * AGENT_STALE_HOURS from watchdog.ts, which is the same site-health
 * everyHours + graceHours the rail's overdue rule reads.
 */

import { formatAge } from "@/lib/format";
import type { OutreachFinding } from "@/lib/outreachHealth";
import type { StoredHealth } from "@/lib/healthSnapshot";

export interface HealthPart {
  text: string;
  /** -> `.aged` (--stale). Only the stamp ever sets it. */
  aged: boolean;
}

export interface HealthWarning {
  tone: "stale" | "missing";
  text: string;
}

export type BlockF =
  | { kind: "quiet"; parts: HealthPart[] }
  | { kind: "alarm"; warnings: HealthWarning[]; fine: string[]; stamp: HealthPart };

export interface HealthStripInput {
  now: Date;
  /** null = the summary call failed, so the engine is unknown. */
  findings: OutreachFinding[] | null;
  /** Only used for the healthy `Engine ran 2h ago` phrase. */
  engineLastRunAt: string | null;
  /** null = nothing has ever been checked. */
  snapshot: StoredHealth | null;
  monitoringEnabled: boolean;
  staleHours: number;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Only `engine-stale` is amber. The other three engine findings and the
 * stranded-approved one are red — the last of them because it only ever fires
 * beside a stalled engine, which means a human is waiting.
 */
function toneFor(finding: OutreachFinding): "stale" | "missing" {
  return finding.kind === "engine-stale" ? "stale" : "missing";
}

/**
 * The engine's phrase when it is NOT a warning: a healthy run, or the grey
 * `Engine — unknown` that a failed summary call produces. Never red.
 */
function enginePhrase(input: HealthStripInput): string | null {
  if (input.findings === null) return "Engine — unknown";
  if (input.findings.some((f) => f.kind.startsWith("engine-"))) return null;
  if (input.engineLastRunAt === null) return null;
  const ranAt = new Date(input.engineLastRunAt).getTime();
  if (Number.isNaN(ranAt)) return null;
  return `Engine ran ${formatAge(input.now.getTime() - ranAt)} ago`;
}

export function buildHealthStrip(input: HealthStripInput): BlockF {
  const { now, findings, snapshot, monitoringEnabled, staleHours } = input;

  const ageMs = snapshot === null ? null : now.getTime() - snapshot.checkedAt.getTime();
  const aged = ageMs !== null && ageMs > staleHours * HOUR_MS;

  // The stamp. Past the threshold a stored reading no longer supports a claim
  // about the present, so the stamp stops being a timestamp and becomes an
  // amber statement.
  let stamp: HealthPart;
  if (ageMs === null) {
    // With monitoring off the reading is EXPECTED to be absent, and an alarm
    // about an expected absence is a daily false alarm.
    stamp = { text: "sites never checked", aged: monitoringEnabled };
  } else if (aged) {
    stamp = { text: `sites not checked since ${formatAge(ageMs)} ago`, aged: true };
  } else {
    stamp = { text: `checked ${formatAge(ageMs)} ago`, aged: false };
  }

  const warnings: HealthWarning[] = [];
  for (const finding of findings ?? []) {
    warnings.push({ tone: toneFor(finding), text: finding.detail });
  }
  // A site that was down at the last reading still warns however old the
  // reading is: suppressing a red warning is the wrong direction to fail in,
  // and the stamp above already says how old the reading is.
  for (const site of snapshot?.sites ?? []) {
    if (!site.up) warnings.push({ tone: "missing", text: site.detail });
  }

  const engine = enginePhrase(input);

  if (warnings.length === 0) {
    const parts: HealthPart[] = [];
    if (engine !== null) parts.push({ text: engine, aged: false });
    // `all sites ok` is NOT printed once the reading is aged — that is the
    // whole 30-hour rule — nor when the reading watches no sites at all.
    if (!aged && snapshot !== null && snapshot.sites.length > 0) {
      parts.push({ text: "all sites ok", aged: false });
    }
    parts.push(stamp);
    return { kind: "quiet", parts };
  }

  // Healthy items follow the warnings on one indented line. The engine's own
  // healthy phrase belongs there too, so the strip carries the same information
  // in both forms.
  const fine: string[] = [];
  if (engine !== null) fine.push(engine);
  for (const site of snapshot?.sites ?? []) {
    if (site.up) fine.push(site.detail);
  }

  return { kind: "alarm", warnings, fine, stamp };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/freelanceHealth.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  14 passed (14)`.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/freelanceHealth.ts src/lib/__tests__/freelanceHealth.test.ts
git commit -F - << 'MSG'
feat(p8b): Block F — a footer until something is wrong, then a card

Quiet with no warnings, alarm with one or more. Every warning string is
passed through verbatim from evaluateOutreach and from siteHealth's own
detail strings; nothing here rewrites one.

The 30-hour rule: past the threshold a stored reading no longer supports a
claim about the present, so "all sites ok" is not printed and the stamp
becomes an amber "sites not checked since 2d ago". A site that was DOWN at
that reading still warns — over-report is the right direction to fail in,
and the stamp says how old the reading is.

"sites never checked" is amber with monitoring on and grey with it off: an
alarm about an expected absence is a daily false alarm. The threshold is an
argument, so the rule is testable without importing EXPECTATIONS.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 14: The cron writes the snapshot

Inside the existing `site-health` job, after `checkSites()` resolves, **in its own `try/catch`**, counted as `itemsFailed: 1` on failure.

**Why that ordering.** The dispatcher composes the digest from `health.data` later in the same invocation. If the snapshot write were allowed to throw, the job would be `ok: false` and today's digest would lose its site lines — trading the outer safety net for a cosmetic persistence step. Catching it and counting it means tomorrow's watchdog names it as `site-health: 1 item failed`, which is the right report: a failure of our own machinery is a real failed item, unlike `outreach-health`'s *findings* about another system.

**Files:**
- Modify: `src/app/api/cron/morning/route.ts`

- [ ] **Step 1: Add the import**

In `src/app/api/cron/morning/route.ts`, add after the `siteHealth` import (line 8):

```ts
import { saveHealthSnapshot } from "@/lib/healthSnapshot";
```

- [ ] **Step 2: Replace the `site-health` job**

Replace the whole `const health = await runJob("site-health", …)` block — **lines 88–91, not 91–94** (the job moved up three lines before this batch ran; anchor by content, never by line number alone) — with:

*The block below was later superseded by R58 (`2e35bca`), which lifts `let snapshotStored = true` above the `runJob` call and sets it `false` beside `saveFailed` in the catch, so the same morning's digest can name the failure. The shipped shape is in the Post-build record and the code is the authority.*

```ts
    const health = await runJob("site-health", async () => {
      const results = await checkSites();
      // The snapshot is what lets the Freelance page's health strip survive a
      // ShikksTracker outage — site results are local. Its write is caught
      // rather than allowed to fail the job: the dispatcher composes today's
      // digest from health.data later in this same invocation, and a throw here
      // would cost the digest its site lines to protect a persistence step.
      // Counting it as a failed item is the honest report — a failure of our
      // OWN machinery is a real failed item, which is why this differs from
      // outreach-health, whose findings are about another system.
      let saveFailed = false;
      try {
        await saveHealthSnapshot(new Date(), results);
      } catch (err) {
        saveFailed = true;
        console.error("[cron/morning] snapshot write failed:", err);
      }
      return {
        counts: { itemsProcessed: results.length, itemsFailed: saveFailed ? 1 : 0 },
        data: results,
      };
    });
```

**Nothing else in the file changes.** In particular the monitoring-disabled branch above is untouched: it correctly files a note-run for `site-health` and writes no snapshot, so the stored reading ages and Block F says so — which is the truth.

- [ ] **Step 3: Type-check, lint and build**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run lint`
Expected: **no *new* errors** — the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and nothing beyond them (pre-build re-read, 2026-09-08).

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Confirm the edit is bounded**

Run: `git diff --stat src/app/api/cron/morning/route.ts`
Expected: one file changed, **`20 insertions(+)`, `1 deletion(-)`** (measured at `e6cdf8e`). **The monitoring-disabled branch must not appear in the diff.**

Run: `git diff src/app/api/cron/morning/route.ts | grep -c "monitoringEnabled"`
Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/morning/route.ts
git commit -F - << 'MSG'
feat(p8b): the morning site-health job stores its reading

Inside the existing job, after checkSites resolves, in its own try/catch and
counted as itemsFailed on failure. The dispatcher composes today's digest
from this job's data later in the same invocation, so letting the write
throw would cost the digest its site lines to protect a persistence step.

It correctly does not run in the monitoring-disabled branch, where
site-health only files a note-run. The snapshot then ages and Block F says
so, which is the truth.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 15: `POST /api/health/sites`

Thin. POST means "take a new reading"; the noun is what is being read, which leaves `GET` free if a JSON view is ever wanted.

**No proxy change:** the path is under `/api/` and is not in `isPublicPath`, so it is already fail-closed. `requireSession` is called anyway, as the first line, which is also the Origin check for a mutating method.

**Files:**
- Create: `src/app/api/health/sites/route.ts`

- [ ] **Step 1: Create `src/app/api/health/sites/route.ts`**

*Superseded by the Batch 5 spec review (`9f42f8e`) and R58's fix pass (`2e35bca`) — the shipped shape is in the Post-build record and the code is the authority.* The one ruled change at build time: **`const checkedAt = new Date()` moves BELOW `await checkSites()`**, because `checkedAt` means the moment the reading was taken and the results describe the sites as of then, not as of the eight seconds earlier when the route started — the contract `saveHealthSnapshot`'s docblock states. The fix pass then made the floor branch read `if (existing !== null && isWithinCheckFloor(new Date(), existing.checkedAt))` (behaviour-identical, no `!`), counted R55's retry as a third Atlas round trip in the `maxDuration` docblock, and recorded that the response body is a debugging affordance rather than a contract.

```ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { checkSites } from "@/lib/siteHealth";
import {
  getHealthSnapshot,
  isWithinCheckFloor,
  saveHealthSnapshot,
} from "@/lib/healthSnapshot";

/** Three sites at an 8s timeout each, in parallel, plus two round trips to Atlas. */
export const maxDuration = 30;

/**
 * POST /api/health/sites — take a new site-health reading.
 *
 * POST because it performs the checks; the noun is what is being read, which
 * leaves GET free if a JSON view is ever wanted.
 *
 * The route is deliberately thin. Its one decision — the 60-second floor —
 * lives in isWithinCheckFloor, which is a pure function a test can reach; the
 * repo has no route-level tests and this phase adds none.
 *
 * NO PROXY CHANGE. This path is under /api/ and is not in isPublicPath, so
 * src/proxy.ts already fails closed in front of it. requireSession runs anyway,
 * as the first statement, per CLAUDE.md's defence-in-depth rule — and for a
 * mutating method it is also the Origin check.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  // The floor reads the stored snapshot, so it needs the database and cannot
  // sit above this line.
  await connectDB();

  const existing = await getHealthSnapshot();
  if (isWithinCheckFloor(new Date(), existing?.checkedAt ?? null)) {
    // Inside the floor, return the EXISTING reading rather than an error: a
    // reading twenty seconds old IS current, and Riku pressing twice is not a
    // mistake that deserves an error state. The floor exists so a stuck finger
    // cannot fire nine requests at client sites, not to defend against abuse —
    // there is exactly one user behind a session cookie.
    //
    // No new collection, no counter, and specifically not an in-memory map: on
    // Vercel that is per-instance and therefore not a limit at all.
    return NextResponse.json({
      checkedAt: existing!.checkedAt.toISOString(),
      sites: existing!.sites,
      fresh: false,
    });
  }

  const checkedAt = new Date();
  const sites = await checkSites();
  await saveHealthSnapshot(checkedAt, sites);

  return NextResponse.json({
    checkedAt: checkedAt.toISOString(),
    sites,
    fresh: true,
  });
}
```

- [ ] **Step 2: Confirm the proxy already covers it**

Run: `git grep -n "health" src/proxy.ts`
Expected: **no output** — `/api/health/sites` is not in the public allowlist, so the fail-closed default applies. `src/proxy.ts` is not edited.

- [ ] **Step 3: Type-check, lint and build**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run lint`
Expected: **no *new* errors** — the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and nothing beyond them (pre-build re-read, 2026-09-08).

Run: `npm run build`
Expected: `✓ Compiled successfully`, and the route table lists `/api/health/sites`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/health/sites/route.ts
git commit -F - << 'MSG'
feat(p8b): POST /api/health/sites — take a new reading

requireSession first (which is also the Origin check on a mutating method),
then connectDB, then the floor, then the checks, then the save. No proxy
change: the path is under /api/ and not in isPublicPath, so it is already
fail-closed.

Inside the 60-second floor it returns the EXISTING reading with 200 rather
than a 429 — a reading twenty seconds old is current, and pressing twice is
not a mistake that deserves an error state. The floor is enforced from the
stored checkedAt, not an in-memory map, which on Vercel is per-instance and
therefore not a limit at all.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 16: Verification

Run every check in order. **Do not claim completion until each one has produced the expected output in front of you.**

**Files:** none modified.

- [ ] **Step 1: The standing trio**

Run: `npm test`
Expected: all suites pass. The ten files this plan touched or added — `format`, `stApi`, `queue`, `freelanceView`, `freelanceVariants`, `freelanceGaps`, `freelanceHealth`, `healthSnapshot`, `models`, `outreachHealth` — are all green, and `watchdog.test.ts` and `agentStatus.test.ts` from Plan A are still green and still untouched.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run build`
Expected: `✓ Compiled successfully`, with `/api/health/sites` in the route table.

- [ ] **Step 2: The two greps from spec §9**

Run: `git grep "var(--alert)\|var(--amber)" -- src/ ':!src/styles/tokens.css'`
Expected: **no output**, exit code 1.

**Two corrections to this grep, both measured.** `src/styles/tokens.css:17` is a legitimate hit — the sentence inside the file's opening block comment explaining why those two aliases must not exist — so it is excluded, and the excluded hit is confirmed to be inside a comment. And the pathspecs go **after** `--`: written as `… src/ -- ':!src/styles/tokens.css'` the command exits 128 with `fatal: unable to resolve revision: src/`, because once `--` is present the leading `src/` is parsed as a revision (Task 16 re-run, 2026-09-09).

The four stylesheets name `components.html` in their comments on purpose — that is the audit trail the port was designed to leave — so the grep looks for a real reference (an import, a link, a URL) rather than the bare name. This is the same pattern Plan A's Task 13 step 3 carries at HEAD.

Run: `git grep -n -E "(from|import|href|src|url)[[:space:]]*[:=(]?[[:space:]]*[\"'][^\"']*components\.html" src/ public/`
Expected: **no output**, exit code 1.

- [ ] **Step 3: The repo boundary held**

Run: `git -C ../ShikksTracker status --porcelain`
Expected: **no output** — nothing in the other repo was modified.

Run: `git grep -n "mongodb" src/lib/stApi.ts src/lib/freelance*.ts`
Expected: **no output** — no view model reaches for a database, and nothing tunnels around the API.

- [ ] **Step 4: No new dependency, no CSP change, no secret in a client path**

Run: `git diff --stat 7cbe5d9..HEAD -- package.json package-lock.json next.config.ts`
Expected: **no output.** **The base is `7cbe5d9`, this plan's own starting commit, not `169c21e`** — A-2's Task 2 edited `next.config.ts` (the `/queue` redirect) after `169c21e`, so the older base reports a change that is not Plan B's (pre-build re-read, 2026-09-08).

Run: `git grep -n "NEXT_PUBLIC" src/lib/ src/models/ src/app/api/health/`
Expected: **no output** — `ST_API_SECRET` never leaves the server, and the two ShikksTracker URLs are built server-side and passed into the view models as arguments.

- [ ] **Step 5: The view models are pure**

Run: `git grep -ln "import" src/lib/freelanceView.ts src/lib/freelanceVariants.ts src/lib/freelanceGaps.ts src/lib/freelanceHealth.ts src/lib/format.ts | xargs git grep -n "^import"`
Expected: every import is from `@/lib/…` or `@/models/…` type-only. **No `next/…`, no `react`, no `mongoose`, no `@/models/` value import.** A view model that reaches a database or a React import has stopped being testable without one.

Run: `git grep -c "process.env" src/lib/freelanceView.ts src/lib/freelanceVariants.ts src/lib/freelanceGaps.ts src/lib/freelanceHealth.ts src/lib/format.ts`
Expected: **no output** — no view model reads an environment variable.

Run: `npx vitest run src/lib/__tests__/viewModelPurity.test.ts`
Expected: `Test Files  1 passed (1)`. **This is the check the greps above cannot make.** They read one line of one file; the purity test imports `mongoose` and all five view models and asserts `mongoose.modelNames()` is `[]`, which is the *transitive* claim — a value import two modules deep registering a discriminator would pass every grep here and fail this (R52).

- [ ] **Step 6: Deck strings survived the round trip**

Spot-check three of the strings the deck is the authority on, straight out of the source:

```bash
git grep -c "Nothing waiting on you." src/lib/freelanceView.ts
git grep -c "Replies are only detected on email, so these can't be scored." src/lib/freelanceVariants.ts
git grep -c "Nothing drafts replies for" src/lib/freelanceGaps.ts
```

Expected: `1`, `1`, `1`. (Every string is additionally pinned character for character by the test suites, which Step 1 already ran.)

- [ ] **Step 7: Nothing from Plan C leaked in**

Run: `git status --porcelain`
Expected: **no output** — everything is committed.

Run: `ls "src/app/(app)/freelance/"`
Expected: **`ViewSwitch.tsx`, `layout.tsx`, `page.tsx` and `queue/`** — A-2's files, not `page.tsx` alone (pre-build re-read, 2026-09-08). The assertion is unchanged: **no `_blocks/` directory**, which is Plan C's and this plan must not have created it.

- [ ] **Step 7b: The lead's extra checks**

Run: `npm run lint`
Expected: exit 1 with **exactly** the four pre-existing `react-hooks/set-state-in-effect` errors (`queue/PushControls.tsx`, `queue/page.tsx`, `settings/page.tsx`, `login/page.tsx`) and three warnings — the same listing this plan started from, item for item.

Run: `git log --oneline 7cbe5d9..HEAD | wc -l`
Expected: the number of commits this plan added, reported rather than asserted.

Run: `git status --short`
Expected: **no output** — the tree is clean at hand-back.

- [ ] **Step 8: Hand back to the design lead**

Report: the trio green, both §9 greps empty, `../ShikksTracker` untouched, and the test totals per file. Spec §9's fourth item — `/freelance` observed on Vercel against real data — belongs to **Plan C** and is not claimed here.

---

## Post-build record

What actually landed, in order, so a later reader is not left inferring it from `git log`. Base `7cbe5d9`; every commit on `master`, unpushed. Six batches, each spec-reviewed and quality-reviewed, each closing with one fix commit before the next began.

- **Before the build** — `feaca0a`. The lead re-read the whole plan against HEAD `7cbe5d9` and rulings R33–R46. **R47:** Task 12's "one trap that contradicts the house pattern" header is false since R37 — `readOsSettings()` already reads with `findOne` and never upserts, so the health accessor is the same rule applied a second time, and what differs is only what a missing document means. Four amendments carried into the build: imports land in the task that consumes them (Task 6 no longer imports five names two commits early); lint expectations read "no new errors"; Task 16's step 4 base is `7cbe5d9` and its step 7 listing is A-2's four entries; the chaser route's idempotency comment starts at line 72, not 73.

- **Batch 1, Tasks 1–5** — `c947047` `edb52c0` `2a8429f` `9ec72b5` `bfd707a`, then `4463bfa` (fixes) and `a8be064` (two comments). All five commits were byte-identical to the plan apart from one accepted type annotation. **R48:** `fetchVariantStats` throws on a 200 whose body is not an array instead of returning `[]`, which would have made a changed ShikksTracker contract read as `No approaches set up.` forever — the 29-day silent failure this repo exists to remember. **R49:** `fetchLiveAnchorIds` queries through the discriminator model (hoisted into one named constant carrying the file's single explained cast) and drops its `.limit`, because under `strictQuery: true` the base model silently strips `payload.replyToLogId` if the `type` key ever goes, and a limit equal to the expected row count turns a violated invariant into a silent wrong answer. Also accepted: the page-timeout test asserts the real argument sequence, `fetchSummary` drops a campaign row with no id, a non-object `contacts` reads as `null`, `numberCell` dashes a non-finite number, `formatAge` clamps a negative age, and `outreachHealth.ts` pluralises through `pluralise`.

- **Batch 2, Tasks 6–8** — `e0802a9` `05d582a` `9c034d7`, then `6fb16da` (fixes) and `ad3b1a9` (three follow-ups). Byte-exact under the import amendment. **R50 — the ruling that changed the most:** `Nothing waiting on you.` requires four **measured** zeros; an absence suppresses it. This amends R35's "a failed gap read counts as absent" clause, which would have printed the page's central summary line directly under a card reading `— / ShikksTracker didn't report how many contacts there are`. `zeroOrAbsent` became a measured-zero test. Also: `DASH` exported from `format.ts` as the one em-dash; Block C's bound sentence uses the literal `campaigns`; six mutation probes added, then two more pinning the `drafts` and `approved` terms on their own.

- **Batch 3, Tasks 9–10** — `563f28a` `001a6af`, then `bab6533` (R52) and `d5433f2` (R51, R53 and the accepted list), then `6638101` (R54). Twenty-four mutation probes; sixteen caught. **R51:** an unreported overdue feed is not a measured emptiness — `BlockE` gains an `absent` kind and `rows` gains `absentNote`, and the hero figure follows, because `overdueActions ?? []` was discarding the distinction in the last line that could use it. **R52:** `DRAFT_CHANNELS` / `DraftChannel` move to `src/lib/draftChannels.ts`, an import-free leaf, because importing `freelanceGaps` was registering three Mongoose models and a discriminator through `chaser.ts`; `src/lib/__tests__/viewModelPurity.test.ts` pins `mongoose.modelNames() === []`, the transitive check Task 16's grep cannot make. **R53:** Block E orders every row longest-wait-first with a stable tie, because replies-then-overdues let 25 reply gaps hide every overdue follow-up under the 20-row bound. **R54:** the `Needs you` card distinguishes an absence from a failure — `BlockAInput.needsYouCount: number | null` became `needsYou: NeedsYouFigure`, and `gapCount` became `needsYouFigure`, so the hero and the block beneath it can never disagree about the register.

- **Batch 4, Tasks 11–13** — `8794284` `a336744` `b5efd55`, then `fe512b1` (fixes). Twenty-seven mutants, twenty-two caught; the pure logic was right and pinned at the exact 30-hour millisecond, and the database half had no tests at all. **R55:** the health snapshot is a fixed-`_id` singleton (`HEALTH_SNAPSHOT_ID = "singleton"`) whose write survives the first-write race with exactly one retry on `11000` — `OsSettings`' `{}` filter would leave two documents on two racing `Check now` presses and make the strip *permanently* amber, a wrong strip rather than a stale one. **R56:** `HealthStripInput.snapshot` widens to `StoredHealth | null | "unread"`, so a *failed* local read prints `sites — unknown` rather than claiming `sites never checked` about a reading it never saw. **R57:** with monitoring off the aged stamp keeps its words and loses its hue, because the disabled cron writes no snapshot by design and ageing amber forever is an alarm about an absence Riku created. The accessor gained its first real test block, and `checkedAt` was fixed as "the moment the reading was taken".

- **Batch 5, Tasks 14–15** — `e6cdf8e` `9f42f8e`, then `2e35bca` (fixes). Byte-exact apart from the ruled `checkedAt` move (captured after `checkSites()` resolves, not before). **R58:** a failed snapshot write is named on its own morning, in its own words. The catch counts `itemsFailed: 1`, but the watchdog runs *before* site-health and reads yesterday's record, so the digest would have said `All clear` beside the heaviest red badge in the rail. `MorningOutcomes.siteHealth` gained `snapshotStored: boolean` and `buildProblems` pushes **`site reading could not be stored`** — pinned in `src/lib/__tests__/buildProblems.test.ts`, which is `buildProblems`' own sibling test file (R58's text first said `digest.test.ts`; corrected at the Batch 5 session close).

- **Batch 6, Task 16** — `c857354`. Run twice: the first attempt reached step 7 and was cut off by the session's rate limit before the lead's extra checks, so it was **re-run in full** at `747958c`. **Verified, every expected value met:** **517 tests across 29 files**; `npx tsc --noEmit` clean; `npm run lint` at the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings; `npm run build` clean with `/api/health/sites`, `/freelance` and `/freelance/queue` in the route table, run beside Riku's dev server with `.next` untouched. Both §9 greps empty; `../ShikksTracker` untouched; no diff to `package.json`, the lockfile or `next.config.ts` since `7cbe5d9`; no `NEXT_PUBLIC` under `src/lib/`, `src/models/` or the health route; every import in the four view models a `@/lib/…` value or `import type`, `format.ts` a true leaf with no imports at all, `viewModelPurity.test.ts` green, no `process.env`; the three deck strings at one each; `freelance/` listing `ViewSwitch.tsx layout.tsx page.tsx queue` and no `_blocks/`; tree clean; **35 commits since `7cbe5d9`.** One correction came out of the re-run: step 2's exclusion grep must be written `git grep "var(--alert)\|var(--amber)" -- src/ ':!src/styles/tokens.css'`, pathspecs after the `--`, or git parses the leading `src/` as a revision and exits 128. Spec §9's fourth item — observed on Vercel against real data — is Plan C's and is not claimed.

**Three strings await Riku's confirmation**, presented as one checklist and marked provisional in the content deck until he answers: `ShikksTracker didn't report overdue follow-ups.` (Block E) and its hero-caption form `ShikksTracker didn't report overdue follow-ups` without the full stop (Block A's third card) — one pair, R51 and R54 — and `sites — unknown` (Block F, R56). Should he reject the pair, the fallback is the block-level `Couldn't load what's waiting.`, the Block B/C precedent for a missing block — never `Nothing waiting.`

**Carried forward, none of it Plan B's to fix:**

- `src/app/(app)/_shell/AgentsBlock.tsx` captions its unknown state with a literal em-dash and should import `DASH` when that Plan A file is next opened.
- `outreachHealth.ts` and `watchdog.ts` keep their own `HOUR_MS` copies; `format.ts` now exports the one this plan's files read.
- `chaser.ts`'s `daysSince` could read `msSince`.
- `fetchAttention` validates no field of `AttentionItem`, so an unreadable `nextActionAt` renders an amber `follow-up due just now` and a missing `contactId` yields `/contacts/undefined`. A boundary read belongs in `stApi.ts` whenever that file is next opened.
- `stApi.ts` is at ~600 lines and is still one door to ShikksTracker. If a fifth call joins it, split into contract / reads / the draft POST and keep the classifier's docblock with the POST.
- Two older manual items stay open at Riku's choice: the optional `Send test` push, and whether the switch's `#101318` track reads right on specimen 07.

---

## Self-review

**1. Spec coverage.** Every section in Plan B's scope maps to a task:

| Spec | Task |
|---|---|
| §7.5.1 widen `SummaryResponse` (`PIPELINE_STAGES`, `SummaryContacts`, `SummaryCampaign`) | 2 |
| §7.5.2 carry-through in `fetchSummary`, with a test | 2 |
| §7.5.3 `fetchVariantStats`, `replyRate` read but never printed | 3, 9 |
| §7.5.4 optional `timeoutMs` on all three GETs, `ST_PAGE_TIMEOUT_MS` | 3 |
| §7.5 `ATTENTION_LIMIT` moved, cron imports it | 4 |
| §7.5 `fetchLiveAnchorIds` extracted, chaser uses it | 5 |
| §7.4 `format.ts`, `formatAge` moved and re-imported | 1 |
| §7.4 / §4.1 `freelanceView` Block A, incl. the contacts track percentage | 6 |
| §7.4 / §4.2 Block B | 7 |
| §7.4 / §4.3 Block C | 8 |
| §7.4 / §4.4 `freelanceVariants`, R27, R31 | 9 |
| §7.4 / §4.5 `freelanceGaps`, the three kinds, suppression | 10 |
| §7.6 `HealthSnapshot` model | 11 |
| §7.6 accessor, `getHealthSnapshot` never upserts, R32 floor | 12 |
| §7.4 / §4.6 `freelanceHealth`, threshold as an argument | 13 |
| §7.6 the cron's snapshot write | 14 |
| §7.6 `POST /api/health/sites`, five-step order | 15 |
| §8 all seven test rows in this plan's scope | 1, 2, 3, 6–13 |
| §9 items 1–3 | 16 |

**Two interpretations, both flagged rather than smuggled in:**

- **Block A's contacts card blanks when `contacts` is null, `total` is null, or `not_started` is null** — one caption for all three. §4.1 gives exactly one missing-data string for that card, and the deck supplies no second one; inventing a fourth string would break the rule that every string comes from the deck.
- **A missing `contacts` or `campaigns` block makes Blocks B and C report `Couldn't load …`** rather than `No contacts yet.` / `No campaigns yet.` An absence is not a measured emptiness, and that failure string is already specified for those blocks.

**One place the spec and the API contract disagree, resolved in the API's favour and recorded:** §7.5 lists `bySlice` among `fetchVariantStats`'s fields. It is returned by the endpoint and is **not modelled** here — no consumer, and §5.8's rule against shipping declared-unused vocabulary applies to types too. §4.4 already says "Available but not required … Do not design around it."

**2. Placeholder scan.** No `TBD`, no `TODO`, no "implement later", no "similar to Task N", no "add appropriate error handling". Every code step carries a complete file or the exact lines to change. Every command carries its expected output.

**3. Type consistency.** Checked across tasks:

- `Cell` / `CellTone` / `numberCell` are defined once in Task 1 (`format.ts`) and consumed by `freelanceView` (Task 8) and `freelanceVariants` (Task 9) — no view-model-to-view-model type dependency except `FAIL_LINES`, which Tasks 9 and 10 import from `freelanceView` by design.
- `FAIL_LINES` keys (`pipeline`, `campaigns`, `approaches`, `needsYou`, `page`) are defined in Task 6 and used in Tasks 7, 8, 9 and 10 under exactly those names.
- `PipelineStage` and `PIPELINE_STAGES` are defined in Task 2 and consumed in Tasks 6 and 7; `STAGE_LABELS` is keyed by `PipelineStage`, so a stage added upstream is a compile error rather than a missing label.
- `SummaryContacts.byPipelineStage` is `Record<PipelineStage, number | null>` in Task 2, and Task 6's `contacts?.byPipelineStage.not_started ?? null` and Task 7's loop both read it as nullable.
- `VariantStatsItem` is defined in Task 3 with `sends`/`replies` as `number | null`, and Task 9's `printableRate` guards both.
- `StoredHealth` is defined in Task 12 and is the type of `HealthStripInput.snapshot` in Task 13.
- `SiteResult` (`{ name, up, detail }`) is `siteHealth.ts`'s existing type, is `IHealthSite`'s exact shape in Task 11, and is what Task 12 stores and returns and Task 13 reads.
- `isSupportedChannel` is imported in Task 10 from `@/lib/chaser`, where it already exists and is already exported.
- `AGENT_STALE_HOURS` is Plan A's export and is passed as `staleHours` in Task 13's tests; Plan C passes it in production.
