# P10b — Data, logic and Google: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship everything the Personal page will read and write, and the morning push's Today sentence — the section P5a-7 dropped for want of a to-do store. Two new models, two widened sub-schemas, one new external integration with its own auth, three mutation routes, six pure modules and six test files. **No JSX. Nothing renders.**

**Architecture:** Every decision the page makes lives in a pure function under `src/lib/`, pinned by a test, so Plan C's JSX can be verified by looking at it rather than by reasoning about it. The one impure boundary is drawn deliberately at three places and nowhere else: `google.ts` (raw `fetch`, explicit timeouts, a cached token promise on `global`), the three route handlers (validate at the top, call one lib function, return a typed JSON error), and `todos.ts`'s write-through half (Google and Mongo in the order the asymmetric-failure rule demands). `personalLayout.ts` is the one module a client component imports and is therefore forbidden from touching a model, `server-only` or `next/headers` at all.

**Tech Stack:** Next.js 16.2.10 (App Router, route handlers) · TypeScript `strict` · Mongoose 9 · Vitest 4 · raw `fetch` against Google's REST API. **No new dependency — not `googleapis`, not a date library. No CSP change. No `NEXT_PUBLIC_*`.**

---

## Why the phase splits here, and what Plan A had to land first

**What Plan A landed that this plan needs:** `src/lib/personalView.ts` exists and exports `HeroTint`, `PERSONAL_HERO_ANCHORS` and `heroTint` — this plan **extends that file** and must not re-declare or move them. Nothing else: this plan touches no CSS, no component and no shell file.

**Why the boundary is *here*.** The line between this plan and Plan C is the line between *what can be pinned by a test* and *what can only be verified by looking at it*. Everything on this side of it is a pure function, a schema, or a handler thin enough that its behaviour lives in a pure function; everything on the far side is markup. P8 drew the same line for the same reason and wrote down why it worked: "every decision the page makes was pushed into Plan B's pure modules and is already pinned there", which is what let Plan C's verification be entirely by eye without that being an excuse.

Three specific things make the line fall exactly here rather than one task earlier or later:

- **The forms and the tiles cannot be written before the routes they post to exist**, and the routes cannot be validated before `validateLayout`, `sortTodos` and `readCalendarWindow` exist. So the whole logic layer plus its three doors is one plan, and the render is the next.
- **Google belongs on this side, not split across both.** `listCalendars()` is called by the Settings page (Plan C) and `readCalendarWindow()` by the Personal page (Plan C), but both are *reads of one client* whose error taxonomy, pagination ceiling, timeout and token cache are a single design (R24, R36, R37). Splitting the client from its consumers is fine; splitting the client is not.
- **The morning push belongs on this side, and this is the less obvious half.** The push's Today sentence is pure (`composeTodayLine`) and its two new reads are route-level. Nothing about it needs a rendered page. Putting it here also gives this plan a **real-data observation of its own** — see the verification block — so `CLAUDE.md`'s "actually done when it has been observed doing its job once against real data" is satisfied twice in the phase rather than deferred entirely to the last commit.

**What this plan deliberately leaves with no consumer.** Every export here is consumed by Plan C, by a test, or by the morning route. There is one exception and it is named: `patchEvent` and `deleteEvent` in `google.ts` are used only by `todos.ts`'s pin paths, which this plan does build — so there is no orphan. **If a Google endpoint ends up with no caller at all, delete it rather than ship it** (§5.11's rule, and R89's reasoning).

---

## Series file map

The authority on every file all three plans touch is **Plan A's "Series file map"** (`docs/superpowers/plans/2026-09-11-p10a-system-and-shell.md`). This plan implements the rows listed there under **Plan B** and renames nothing. The table below adds only what that map leaves open.

### Types Plan C will render

**This is the contract Plan C's JSX consumes.** Not one of these shapes may be changed in Plan C. If a tile seems to need a different shape, that is a change here and a conversation, not a local edit.

```ts
// ---- days.ts -----------------------------------------------------------
export type DayKey = string;                        // "YYYY-MM-DD", in APP_TZ

// ---- google.ts ---------------------------------------------------------
export interface CalendarEvent {
  id: string;
  title: string;            // bounded to 200 for display
  layerName: string;
  allDay: boolean;
  startsAt: Date | null;    // null for all-day
  endsAt: Date | null;
  dayKey: DayKey;
  htmlLink: string;
}
export type GoogleErrorKind = "not-configured" | "expired" | "timeout" | "gone" | "http";
export type CalendarWindow =
  | { ok: true; events: CalendarEvent[]; failed: string[] }   // failed = layer NAMES
  | { ok: false; reason: "none-enabled" | "not-configured" | "expired" | "timeout" };

// ---- personalView.ts ---------------------------------------------------
export type HeroTint = 0|1|2|3|4|5|6|7|8;                      // Plan A

/** A sentence with an optional 5px dot. `dot: null` renders bare (5.9). */
export interface SayLine { text: string; dot: "stale" | "missing" | null }

export interface TodoRowView {
  id: string;
  title: string;
  section: "personal" | "freelance" | "academics";
  sectionLabel: "Personal" | "Freelance" | "Academics";
  due: { text: string; late: boolean } | null;   // "today" | "Fri 12" | "3 days late"
  onCalendar: boolean;
  note: string | null;                            // "entry on the old day"
}

export interface EventRowView {
  id: string; title: string; layerName: string; time: string; href: string;
}

export interface TodayView {
  dateLabel: string;                 // "Thu 10 Sep"
  heroTint: HeroTint | null;         // ONE field. null = the to-do read failed (R83)
  scheduled:
    | { kind: "rows"; rows: EventRowView[]; bound: string | null; fails: SayLine[] }
    | { kind: "empty" }                          // "Nothing scheduled."
    | { kind: "fail"; lines: SayLine[] };
  due:
    | { kind: "rows"; rows: TodoRowView[] }
    | { kind: "empty" }                          // "Nothing due."
    | { kind: "fail"; line: SayLine };
  /** true only when BOTH groups are empty AND the to-do read answered (R17). */
  spread: boolean;
  /** R40's 213px form floor, decided from the STORED SPAN. See formCapable. */
  formCapable: boolean;
}

/** R18's guard, in the TYPE: `—` is unreachable for an unread day. */
export type DayRowView =
  | { key: DayKey; label: string; items: DayItemView[] }
  | { key: DayKey; label: string; unread: true };

export interface DayItemView {
  kind: "event" | "todo";
  id: string; title: string; time: string | null; layerOrSection: string;
  href: string | null;               // events only
}

export interface WeekView {
  /** null when the day rows are omitted entirely - both feeds down (R18). */
  days: DayRowView[] | null;
  fails: SayLine[];                  // rendered at the TOP of the tile (R16)
}

export interface TodoTileView {
  count: number | null;              // null under a failed read - never 0 (R21)
  sections: Array<{
    key: "personal" | "freelance" | "academics";
    label: "Personal" | "Freelance" | "Academics";
    rows: TodoRowView[];             // empty array renders `nothing open`
    bound: string | null;            // "Showing 20 of 34."
  }> | null;                         // null = `Couldn't load to-dos.`
  fail: SayLine | null;
}

export interface DoneTileView {
  count: number | null;              // absent at zero (deck 12) - the view says null
  rows: Array<{ id: string; title: string; sectionLabel: string; dayLabel: string; note: string | null }>;
  bound: string | null;
  fail: SayLine | null;
}

export interface PushTileView {
  kind: "quote" | "went-out-unstored" | "no-push-today" | "never" | "monitoring-off" | "fail";
  stamp: string | null;              // "sent 07:00", in APP_TZ - never the cron's hour
  title: string | null;
  body: string | null;
  last: { stamp: string; title: string; body: string } | null;
  line: SayLine | null;
}

export interface LayersTileView {
  kind: "switches" | "sentence" | "fail";
  rows: Array<{ calendarId: string; name: string; enabled: boolean; note: string | null }>;
  line: SayLine | null;
}

// ---- personalLayout.ts (client-importable, pure) -----------------------
export type PersonalTile = "today" | "todos" | "layers" | "push" | "week" | "done";
export interface LayoutEntry { tile: PersonalTile; span: number }
export type PersonalLayout = LayoutEntry[][];              // exactly 4 rows

export interface CellView {
  tile: PersonalTile | null;   // null = the row's leftover (the dashed cell)
  rowClass: string;            // "pe-r1".."pe-r4"
  spanClass: string;           // "pe-s2".."pe-s12", or "pe-s0" for no leftover
  collapsedClass: string;      // "pe-x1".."pe-x6", or "pe-x0"
}
```

### What this plan does NOT ship

- **No component, no JSX, no `"use client"`.** Plan C.
- **`GET /api/google/calendars` is cut.** See Task 6's ruling.
- **No `GET /api/google/status`** — already cut by R24; there is nothing to delete because it was never built.
- **No OAuth bootstrap route and no `ALLOW_OAUTH_BOOTSTRAP`** — cut by R36; `scripts/google-auth.mts` replaces both.
- **No third `Todo` index** — cut by R35 / R86 §I item 3.
- **No index creation.** `autoIndex` is off in production; `npm run migrate:indexes` then `:apply` is **Riku's hands**, surfaced by Task 2.
- **No agent.** The Personal side gets none (S13, `ARCHITECTURE.md` §7). The one automated thing that touches this page is the morning push, which already exists.
- **No local calendar-event storage, ever** (concept D5). A pinned to-do stores an entry **id** and nothing else (S19).

---

## Ground rules for every task in this plan

- **How to read the ruling IDs.** `R1`–`R95` are the design lead's rulings; `M1`–`M9` round 4's mockup fixes; `S1`–`S14` **in a ruling citation** are round 5's System Keeper / Interaction Designer rulings and are **not** `ARCHITECTURE.md`'s `S1`–`S20`; `D1`–`D14` are the P10 design doc's content-discussion decisions and are **not** the concept's `D1`–`D11`. Where this plan means the architecture decision it writes **S19 / S20 (`ARCHITECTURE.md` §7)**; where it means the concept it writes **concept D5**.
- **THE PRIME DIRECTIVE.** Nothing in this plan touches `../ShikksTracker` and nothing connects to its database. Freelance data reaches this repo only through its `/api/os/*` endpoints with `ST_API_SECRET`, and **this plan adds no such call**: the Personal page's `Freelance` to-do section is the app's **own** `Todo` records with `section: "freelance"`, not a ShikksTracker read. If a task seems to need a field ShikksTracker has, that is a contract change — document it and stop.
- **Mongo schema rules, every one of them, every time.** Every `String` gets a `maxlength`. Every closed set is an `enum`. Dates are `Date`, never strings. **No `Schema.Types.Mixed`.** `timestamps` declared explicitly per model. Unique indexes on nullable fields `partial` or `sparse`. Sub-schemas take `_id: false`. State transitions use guarded atomic `findOneAndUpdate`, never read-modify-write.
- **Mongoose only.** No native driver calls.
- **Error handling, quoted from `CLAUDE.md` because four tasks turn on it.** No silent failure, no infinite retry. Never leave an in-flight state behind. **Asymmetric failure semantics — classify before retrying: failed *before* the side effect → safe to retry automatically; failed *after* (or unknown) → park for human verification. Never guess.** Alerts are queued and sent last.
- **Secrets in env vars only.** Never in the database, never in code, never in a log line. `readGoogleConfig` names missing **variables**, never values. No Google response is logged whole.
- **Every route handler:** `requireSession` **first** (defence in depth, even behind the fail-closed proxy), the Origin check on every mutation, inputs validated at the top, typed JSON errors with correct status codes, a bounded limit on every list read.
- **`src/proxy.ts` is not edited.** It fails closed with an explicit public allowlist; three new authenticated routes need no entry. Confirm by test, not by reasoning — `proxy.test.ts` already exists.
- **`src/app/login/page.tsx`, every stylesheet, and every file under `src/app/(app)/` except `settings`'s eventual cards are not edited by this plan.** This plan touches no file Plan A touched except `src/lib/personalView.ts`, which it extends.
- **Every task's check step runs `npm run lint`,** expecting **the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and nothing new.** Exit 1 is the pre-existing state; a fifth error or a fourth warning stops the task. **This plan adds no client component, so it cannot legitimately move any of the four.**
- **The test baseline is Plan A's final count** (531 plus Plan A's ramp tests — read it out of Plan A's post-build record). Every task states how many it adds.
- Commands are for **Git Bash on Windows** from the repo root. Commits are on `master` and are **never pushed**.
- **Port 3000 is Riku's dev server and is never bound, opened or stopped.** Every server this plan starts is `npx next start -p 3001` and is stopped by its own PID.

---

## Task 1: `APP_TZ`, the expected push hour, and `days.ts`

Everything downstream asks its questions of **day keys in Manila**, never of raw `Date` arithmetic. Vercel runs in UTC and the cron fires at 23:00 UTC, which is 07:00 Manila — "today" must be Manila's today or the digest reports yesterday.

**Rulings implemented:** design doc *Days and the time zone* · R22 (the expected hour, exported once) · §4.4 · §8's `days.test.ts`.

**Files:**
- Modify: `src/lib/constants.ts`
- Create: `src/lib/days.ts`
- Create: `src/lib/__tests__/days.test.ts`

- [ ] **Step 1: Two constants**

`src/lib/constants.ts` gains, beside `APP_NAME`:

```ts
/**
 * Every "is this due today / overdue / within 3 days" question on the Personal
 * page and in the morning push is asked of a day key in THIS zone. Vercel runs
 * in UTC and the morning cron fires at 23:00 UTC, which is 07:00 here, so a
 * naive UTC "today" reports yesterday for seven hours of every day.
 */
export const APP_TZ = "Asia/Manila";

/**
 * The hour the morning push is expected, in APP_TZ. Exported once, beside the
 * cron's provenance, the way AGENT_STALE_HOURS is — because two copies of an
 * expectation drift and this one decides whether an alarm is a lie.
 *
 * `No push this morning.` takes its --missing dot ONLY once `now` in APP_TZ is
 * past this hour (R22, nodded by Riku in deck 15). Before 07:00 the sentence
 * stands undotted: it is simply true at 00:30, and only the alarm would lie.
 * The push tile's stamp renders `sentAt` in APP_TZ and NEVER this number — a
 * stamp that printed the cron's nominal hour would report a send that did not
 * happen at the time it says.
 */
export const PUSH_EXPECTED_HOUR = 7;
```

- [ ] **Step 2: `src/lib/days.ts` — pure, no library**

```ts
export type DayKey = string;                          // "YYYY-MM-DD"

export function dayKey(date: Date, tz: string): DayKey;
/** The Date stored in Todo.dueOn: that calendar day at 00:00:00Z. */
export function dayStart(key: DayKey): Date;
export function addDays(key: DayKey, n: number): DayKey;
/** b − a, in whole days. Negative when b is before a. */
export function daysBetween(a: DayKey, b: DayKey): number;
export function formatDay(key: DayKey): string;        // "Thu 10 Sep"
export function todayKey(now: Date, tz?: string): DayKey;
```

Three implementation facts the tests will hold you to:

- **`dayKey` goes through `Intl.DateTimeFormat(…, { timeZone: tz }).formatToParts`** and reassembles `year-month-day`. Never `toLocaleDateString` with a parsed string, and never an offset arithmetic shortcut — Manila is `+08:00` today and a hard-coded offset is a bug waiting for a policy change.
- **`dueOn` is a DAY, not an instant** (design doc, to-do store): stored as that calendar day at `00:00:00Z`, so `dayStart` builds it with `Date.UTC` and `daysBetween` is exact integer arithmetic on the two `dayStart` values divided by 86 400 000 — no DST term, because both operands are UTC midnights by construction.
- **`formatDay` is `Intl` with `{ weekday: "short", day: "numeric", month: "short" }`** and then normalised to the deck's `Thu 10 Sep` spelling (no comma, day before month). Pin the exact output in the test: a locale-dependent string in a spec-fixed label is how `Thu, Sep 10` ships.

- [ ] **Step 3: `days.test.ts`** — §8's list

Manila day keys **around midnight UTC** (the case the whole module exists for: `2026-09-10T16:00:00Z` is `2026-09-11` in Manila, `2026-09-10T15:59:59Z` is `2026-09-10`); `addDays` across a month end and a year end; `daysBetween` positive, negative and zero; `formatDay` exactly `Thu 10 Sep`; `todayKey` agreeing with `dayKey(now, APP_TZ)`; `dayStart` round-tripping through `dayKey(…, "UTC")`.

- [ ] **Step 4: Check and commit**

`npm test` (report the added count) · `npx tsc --noEmit` · `npm run lint` · `npm run build`.

```bash
# days.ts is pure: no model, no fetch, no next/*, no process.env
git grep -nE "from \"@/models|fetch\(|next/|process\.env" -- src/lib/days.ts
# no output, exit 1
```

```
feat(p10b): APP_TZ, the expected push hour, and days.ts
```

---

## Task 2: The `Todo` model, and the index step that is Riku's

**Rulings implemented:** D5 · D9 · S19 (`ARCHITECTURE.md` §7) · R35 / R86 §I item 3 (the third index cut) · design doc *The to-do store* · `CLAUDE.md`'s schema rules.

**Files:**
- Create: `src/models/Todo.ts`
- Modify: `scripts/sync-indexes.mts`

- [ ] **Step 1: `src/models/Todo.ts`**

| Field | Type | Rule |
|---|---|---|
| `title` | String | required, `maxlength: 140`, `trim: true` |
| `section` | String | required, `enum: ["personal","freelance","academics"]` — Work stays parked (D9) |
| `dueOn` | Date, optional | **a day, not an instant**: that calendar day at `00:00:00Z`. Every comparison goes through `dayKey`, never raw `Date` arithmetic |
| `done` | Boolean | required, `default: false` |
| `doneAt` | Date, optional | set when `done` flips true, cleared when it flips back |
| `calendarId` | String, optional | `maxlength: 256` — the calendar the pin was written to (always `primary` in this version, **stored anyway** so a later change cannot orphan an entry) |
| `calendarEventId` | String, optional | `maxlength: 1024` (Google's stated maximum) — **present exactly when the to-do is on the calendar** |
| `timestamps` | `{ createdAt: true, updatedAt: true }` | declared explicitly; updates are the point of this record |

**Two indexes, two queries, whole page** — and the docblock says which query each serves, because that is the sentence that stops a third being added:

```ts
TodoSchema.index({ done: 1, dueOn: 1 });   // find({done:false}).sort({dueOn:1})
TodoSchema.index({ done: 1, doneAt: -1 }); // Done this week
```

**The third index, `{section:1,done:1,dueOn:1}`, is CUT** (R35): it existed for a per-section query that does not exist, because the To-do tile shows all three sections together (deck §6 Tile 2) and grouping happens in the pure layer. **No TTL**: done items are kept (D9) — and note in the docblock that this is *not* an oversight, since `AgentRun` and `LoginAttempt` both have one.

**No `Mixed`. No unbounded string. `section` is an enum. Nothing here is nullable-unique**, so no partial index is needed — say so in the docblock, so the next person does not go looking for one.

- [ ] **Step 2: Add `Todo` to `scripts/sync-indexes.mts`**

One import and one array entry. **`LastDigest` joins in Task 3**, not here, so each commit's index diff is one model.

- [ ] **Step 3: Check, and surface the manual step**

```bash
npx tsc --noEmit
npm test           # models.test.ts should still pass; add nothing to it yet
npm run lint
npm run build
npm run migrate:indexes    # DRY RUN. Reports the two new indexes as to-be-created.
```

**`npm run migrate:indexes` is a dry run and changes nothing. `npm run migrate:indexes:apply` is Riku's**, and it goes into *What needs Riku's hands* — `autoIndex` is off in production, so **Mongoose will not create these**. Do not write a task that assumes it will. **Surface it now, in the plan's running Riku-list, not at the end**: the queries in Task 7 will work without the indexes on a collection of ten documents and will not tell you they are missing.

- [ ] **Step 4: Commit**

```
feat(p10b): the Todo model - two indexes, two queries, no TTL
```

---

## Task 3: `LastDigest` — the fixed-id singleton, and its read-only accessor

The push tile quotes what was sent. `AgentRun` records counts and an error, not the text (D14) — the "read it from the run record" first said to Riku was wrong, and this is the correction.

**Rulings implemented:** D14 · R22 · R55 (`HealthSnapshot`'s pattern, cited by name) · §7.8.

**Files:**
- Create: `src/models/LastDigest.ts`
- Create: `src/lib/lastDigest.ts`
- Modify: `scripts/sync-indexes.mts`

- [ ] **Step 1: The model**

Fixed `_id: "latest"` (String), `sentAt: Date` required, `title: String maxlength 80`, `body: String maxlength 320`, `devices: Number min 0`. `timestamps: { createdAt: false, updatedAt: false }` — `sentAt` **is** the timestamp and a second one would invite the question of which is true.

**This is R55's singleton, not `OsSettings`'s.** It is overwritten whole and never defaulted, so it takes a **fixed `_id`** rather than the `{}` filter, is written by `findOneAndUpdate` on that id with `upsert` **and one retry on the E11000 duplicate-key race**, and its **read-only accessor returns `null` when the document is absent** rather than the schema's defaults — *because a push that was never stored is a fact the page reports (`No push recorded yet.`), not a gap to paper over.*

`devices` **stays on the model and is not rendered** (§4.4). Say so in the docblock so it is not deleted as dead weight and not surfaced as a figure.

- [ ] **Step 2: `src/lib/lastDigest.ts`**

```ts
/** Overwritten whole. One retry on E11000, then it throws. */
export async function saveLastDigest(sentAt: Date, payload: PushPayload, devices: number): Promise<void>;
/** findOne on the fixed id. NEVER upserts. null when absent (R55). */
export async function getLastDigest(): Promise<StoredDigest | null>;
```

`saveLastDigest`'s caller wraps it (Task 11) — **it is not wrapped here**, because a helper that swallows its own failure cannot be tested for failing.

- [ ] **Step 3: Add `LastDigest` to `sync-indexes.mts`.** It declares no index of its own; it goes on the list so the script's model set stays the model set.

- [ ] **Step 4: Check and commit**

`npx tsc --noEmit` · `npm test` · `npm run lint` · `npm run build` · `npm run migrate:indexes` (dry run: no change for this model).

```
feat(p10b): LastDigest - the fixed-id singleton the push tile quotes
```

---

## Task 4: `personalLayout.ts` — the pure layout store

**The one module a client component imports.** It may never import a model, `server-only` or `next/headers`, and Task 4's grep is what keeps that true.

**Rulings implemented:** D4 · D7 · R1 · R3 · R5 → R53 → **R91** · R35 · R39 · R53 · R92 · §5.4 · §7.5 · §8's `layout.test.ts`.

**Files:**
- Create: `src/lib/personalLayout.ts`
- Create: `src/lib/__tests__/layout.test.ts`

- [ ] **Step 1: The constants**

```ts
export const PERSONAL_TILES = ["today","todos","layers","push","week","done"] as const;
/** Row weights as MINIMUMS, in px: tall · short · medium · short (R4, R39). */
export const PERSONAL_ROWS: readonly [340, 200, 240, 120] = [340, 200, 240, 120];
export const PERSONAL_LAYOUT_DEFAULT: PersonalLayout = [
  [{ tile: "today", span: 8 }, { tile: "todos", span: 4 }],
  [{ tile: "layers", span: 3 }, { tile: "push",  span: 8 }],
  [{ tile: "week",  span: 12 }],
  [{ tile: "done",  span: 12 }],
];
```

**`PERSONAL_ROWS` is exported once** (§7.5). Row 2 is **200**, not 180: ~~R4's 180~~ → **R39's 200**, because the pixels said 197.85 with R15's 44px switch rows at span 3, and dropping the 44px floor to make 180 true is exactly the cheat R4 forbids — a touch target shrunk to hit a number. **R92 then measured the blank Layers tile at 191.85px** (M2 brought `.pe-tile{padding:12px}` alive at span 3 and took 6px out of it) **and the weight still stands at 200**, because 200 was never the tile's height: it was the number chosen to keep "short" short while clearing the switch rows. Put both figures in the docblock — the design doc still carries 197.85 and the two documents disagree by 6px (§10 item 8, ruled by R92).

- [ ] **Step 2: The five pure helpers**

```ts
export function clampSpan(n: unknown): number;                     // integer 2..12, else 2
export function collapseRow(spans: readonly number[]): number[];   // the six-column rule
export function compactRows(layout: PersonalLayout): PersonalLayout;
export function buildCells(layout: PersonalLayout, editing: boolean): CellView[];
export function buildTracks(layout: PersonalLayout, editing: boolean): string;
/** R40's 213px form floor, as one pure predicate over the stored span. */
export function formCapable(span: number): boolean;   // span >= 3
```

**`formCapable` is the plan's answer to a question the spec leaves open, and it is stated here rather than buried.** §4.9 requires `+ Event` / `+ To-do` to be **`disabled`** below **213px of tile width**, with `Too narrow for the form.` under the head and `aria-describedby` pointing at it (R28, R40) — and the mockup draws exactly that at 106px and at 141.67px (lines 3343–3354). But **`disabled` is an attribute, not a style**: no container query can set it, and R33 forbids the client-side measurement that would be the only other way. **The decision therefore has to be made server-side, from the one width fact the server holds: the stored twelve-column span.**

`span >= 3` is the rule, and §5.4's own table is the derivation: span 3 is **219.5px** at twelve and collapses to `pe-x2` = **226px** at six, both over the floor; span 2 is **141.67px** at twelve and **106px** at six, both under it. So one boolean covers both live column counts with no case left ambiguous. **At one column a span-2 tile is the full 334px and a form would have fitted** — so the rule switches a pill off where the form would have worked, which is **the safe mistake the mockup's own caption blesses**: *"A floor set too high switches a pill off where the form would have fitted, which is the safe mistake; a floor set too low lets a field spill out of its well, which is not."* (mockup line 3404). **No arrangement is removed either way** — `−` still runs to span 2 on every tile (§4.9).

It lives in `personalLayout.ts` and not in `personalView.ts` because it is a fact about a span, and because **`LayoutEditor` needs it too**: R28's mechanism has to agree with itself in edit mode, where the working span is the client's.

**`collapseRow` is `ceil` *then a trim*, not `ceil` alone** (R1): round every span up, then **decrement the widest entry (ties at the last index) until the row sums to ≤ 6**. Pure, render-time, server-side, one caller. Round-*down* is rejected (it contradicts the deck's "rounded up" and makes span 3 identical to span 2); `Math.max(2, ceil)` is rejected (it overflows the legal six-span-2 row). The overflow condition is `Σsᵢ + #odd > 12`, which non-full rows also satisfy. **The editor does not import it** — `+` is disabled by the twelve-column sum alone, because a `+` dimmed for a width Riku cannot see declines the move its own caption promises.

**`buildCells` is where every number passes through one clamp** (§7.5), and it emits three frozen class lookups per cell from `Object.freeze`d tables, **so an out-of-range stored value matches no CSS rule and is visible** rather than silently coerced (R3). The leftover cell gets `tile: null` and its own `pe-s{n}` / `pe-x{n}`, with **`pe-s0` / `pe-x0` meaning "no leftover at this count"** — a row can have a leftover at twelve and none at six, and the default arrangement is exactly that case (row 2 is 3+8=11 at twelve, 2+4=6 at six). **In normal view the leftover cell is bare ground and renders nothing; the dashed rectangle exists in edit mode only** (§4.7) — which is why `buildCells` takes `editing`.

**`buildTracks` emits the grid's `--tracks` inline** (§5.4): empty rows compacted out and the rest renumbered, **a shrinking row `auto`**, every other row `minmax(calc(${PERSONAL_ROWS[i]}px + var(--tb)), auto)`. `--tb` is the toolbar allowance and is folded in by **one class on the grid** (`.pe-grid.is-editing{--tb:42px}`), not by this function, so a short row never swallows its own heading.

**The shrink condition is R91's, as written, and is narrower than R5's.** A row takes `auto` **only when it holds exactly one tile and that tile is narrower than the row.** ~~R5's "tiles summing to fewer than 6 columns"~~ is **narrowed** to that: **a row holding two tiles that sum to 5 of 12 keeps its weight** and shows seven columns of bare ground at full row height. R5 was the lead's rule, written before Riku saw anything; R53 is Riku's answer to one drawn picture, and it reaches that case and no further (R91). **R5's edit-mode suspension survives** — `buildTracks(layout, true)` never returns `auto` for any row, so a move never resizes a row Riku is not touching.

- [ ] **Step 3: `validateLayout` (strict on write) and `resolvePersonalLayout` (total on read)**

```ts
export type LayoutValidation = { ok: true; value: PersonalLayout } | { ok: false; error: string };
export function validateLayout(input: unknown): LayoutValidation;

/** Total. `fellBack` drives deck 15's `Couldn't load your arrangement, so this is the default.` */
export function resolvePersonalLayout(stored: unknown): { layout: PersonalLayout; fellBack: boolean };
```

**`validateLayout` is strict**: four rows; every tile in `PERSONAL_TILES` **exactly once** across all rows; every span an integer 2–12; every row summing to ≤ 12. **Empty rows are legal** (§4.8). Anything else is a **400 with a typed message** — it runs inside `parseSettingsPatch` (Task 8).

**`resolvePersonalLayout` is total**, and carries **the P11 clause**: a six-tile stored layout resolved against a seven-tile default **keeps all six placements** and appends the newcomer. **Asserted in the test before P11 exists** (§7.5) — that is the whole point of writing the clause now. `fellBack` is `true` when the stored value was unreadable or invalid and the default was substituted, so Plan C can render the deck's sentence instead of silently lying about the arrangement. **The page never blanks for a settings problem.**

- [ ] **Step 4: `layout.test.ts`** — §8's list, exactly

`validateLayout` accepts the default and rejects **a missing tile · a duplicate · a span of 1 · a span of 13 · a row over 12 · three rows** (six rejection cases, each with its own typed message asserted). `collapseRow` against **`[3,9]`**, **`[5,7]`**, **`[3,3,5] → 7` (the case that proves the trim loop runs more than once)**, **`[3,3,3,3] → [2,2,1,1]`**, and **the six-span-2 row it must leave untouched**. `resolvePersonalLayout` total on read, **including the P11 clause** (six tiles against a seven-tile default keeps all six) and setting `fellBack` correctly in both directions. `buildTracks` compacts empty rows, renumbers, emits `auto` for a one-occupant shrinking row, emits `minmax(calc(Wpx + var(--tb)), auto)` otherwise, and **never emits `auto` when `editing` is true** (R5's surviving suspension). **`buildTracks` does not emit `auto` for a two-tile row summing to 5** — R91, pinned, because R5's broader wording is still sitting in its own file. `buildCells` clamps every number and emits `pe-s0` / `pe-x0` for a row with no leftover at that count. **`formCapable`** is `false` at span 2 and `true` at spans 3–12, with the two boundary cases named in the test titles so the 213px floor is traceable from the runner's output to R40.

- [ ] **Step 5: Check and commit**

```bash
# the client-import rule (7.5). This grep is the whole guarantee.
git grep -nE "from \"@/models|server-only|next/headers|next/cache|process\.env|fetch\(" -- src/lib/personalLayout.ts
# no output, exit 1
```

`npm test` (report the count) · `npx tsc --noEmit` · `npm run lint` · `npm run build`.

```
feat(p10b): personalLayout.ts - the pure layout store, client-importable
```

---

## Task 5: `OsSettings` widens — `layers` and `personalLayout`

**Rulings implemented:** D10 · R35 · R37 (the read-only accessor, unchanged in kind) · §7.5 · deck §9.

**Files:**
- Modify: `src/models/OsSettings.ts`
- Modify: `src/lib/osSettings.ts`
- Modify: `src/lib/settings.ts`
- Modify: `src/lib/__tests__/osSettings.test.ts` · `settings.test.ts` · `models.test.ts` (extend; do not rewrite)

- [ ] **Step 1: Two typed sub-schemas, `_id: false`**

```ts
// max 10 entries (deck 9's bound). Membership order IS display order.
const LayerSchema = new Schema<ILayer>({
  calendarId: { type: String, required: true, maxlength: 256 },
  name:       { type: String, required: true, maxlength: 120 },
  enabled:    { type: Boolean, required: true, default: true },   // deck: on when first chosen
}, { _id: false });

const LayoutEntrySchema = new Schema<ILayoutEntry>({
  tile: { type: String, required: true, enum: PERSONAL_TILES },
  span: { type: Number, required: true, min: 2, max: 12 },
}, { _id: false });
```

`personalLayout` is `[[LayoutEntrySchema]]` with a validator pinning **exactly four rows**; `layers` is `[LayerSchema]` with a `maxlength`-equivalent array validator at **10**. **No `Mixed` anywhere** — that is the rule this field would have broken if it had been typed loosely, and `CLAUDE.md` names ShikksTracker's shapeless `Mixed` run-summary as the reason the rule exists.

- [ ] **Step 2: `OS_SETTINGS_DEFAULTS` gains `readonly` arrays, and `readOsSettings` copies on read**

`layers: []` and `personalLayout: PERSONAL_LAYOUT_DEFAULT` go into `OS_SETTINGS_DEFAULTS` as **`readonly`** values, and `readOsSettings` **copies them on read** (R35) — returning the frozen default array itself would let one caller's mutation become every later caller's default, for the life of the lambda. The existing per-field `??` defaulting pattern and its docblock stay exactly as they are: **an absent value reads as its default, and `??` never `||` so a stored `false` survives.**

`SETTINGS_PROJECTION` is typed `Record<keyof OsSettingsValues, 1> & { _id: 0 }`, so **forgetting one of the two new fields is a compile error** — the existing comment already says that is the point, and this task is its first real test.

`readOsSettings` stays a `findOne` that **never upserts**: the rail reads it on every page of the `(app)` group, and an upsert-on-read is a write on every page view (R37).

- [ ] **Step 3: `settings.ts` — `ALLOWED_KEYS` derived, and `validateLayout` called here**

`ALLOWED_KEYS` becomes **derived from a typed record** rather than a hand-written `Set` (§7.5), so a fifth setting cannot be added to the patch type and forgotten here. `parseSettingsPatch` gains two branches:

- `personalLayout` → `validateLayout(input)`; on failure the typed message is returned verbatim as the 400's `error`.
- `layers` → an array of ≤ 10 objects, each `{ calendarId: string 1–256, name: string 1–120, enabled: boolean }`, **no unknown keys**, **no duplicate `calendarId`**.

**Last-write-wins on the `layers` array from two devices is accepted and recorded** (§7.5) in the docblock — the Layers tile and the Settings picker both PATCH the whole array, and a single-user tool does not need a version field for it.

- [ ] **Step 4: Extend the three existing test files**

`settings.test.ts`: the two new branches, accept and reject, including a 400 for an eleventh layer and for a duplicate `calendarId`. `osSettings.test.ts`: both new fields default when absent, a stored `enabled: false` survives, and **the returned arrays are copies** (mutate the result, read again, assert unchanged). `models.test.ts`: the two sub-schemas validate and reject — over-length `name`, span 13, three rows, an unknown `tile`.

- [ ] **Step 5: Check and commit**

`npm test` · `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npm run migrate:indexes` (dry run — **OsSettings gains no index**; if the script reports one, stop and find out why).

```
feat(p10b): OsSettings gains layers and personalLayout, typed and bounded
```

---

## Task 6: `google.ts` — the client

**Rulings implemented:** D11 · R24 · R36 · R37 · R42 · R45 · §7.6 · §8's `google.test.ts`.

**Files:**
- Create: `src/lib/google.ts`
- Create: `src/lib/__tests__/google.test.ts`
- Modify: `.env.example`

### The ruling this task makes, and why

**`GET /api/google/calendars` is cut**, and this plan builds no Google-facing API route at all. The design doc names that route for the Settings picker, but **R24 then cut `GET /api/google/status` and moved the whole answer server-side**: "the Settings page calls `listCalendars()` **once, server-side**, and derives **both** cards from that one answer." A client route fetching the same list would be a second read of the same thing, on a page that is already rendering the first, and it would put the picker's list one round trip behind the connection card that is derived from it. **R24's reasoning reaches this route, so it goes the same way as its sibling.** Plan C's Settings page calls `listCalendars()` in its own server render, and **the picker's rows are derived from the stored `layers` array joined against that list** (R42) — which is the *other* reason a client fetch is wrong: a vanished calendar must keep its row, and only the stored array knows it was ever chosen.

**Recorded as a planning decision, not a spec quote.** If the lead disagrees, it is one small route and Plan C's Settings task is where it would land.

- [ ] **Step 1: Config and the token cache**

```ts
export const GOOGLE_TIMEOUT_MS = 5000;
export class GoogleError extends Error { readonly kind: GoogleErrorKind; readonly status?: number }
export function readGoogleConfig(source?: NodeJS.ProcessEnv): GoogleConfig;
```

**`readGoogleConfig` names missing *variables*, never values** — the same shape as `readStConfig`, whose message deliberately ends "(Value omitted from this message.)". Three variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`. Missing any → `GoogleError("not-configured")` naming which.

**A cached token *promise* on `global`, cleared on rejection** — the same shape as `db.ts`'s connection cache, and the word *promise* is load-bearing: caching the resolved value lets two concurrent renders each make their own token request. Cached until **60 s before expiry**. An `invalid_grant` answer becomes `GoogleError("expired")`.

- [ ] **Step 2: The five calls, each with an explicit timeout**

`AbortSignal.timeout(GOOGLE_TIMEOUT_MS)` on **every** call. **`DOMException.name === "TimeoutError"` matched by name**, never by message and never by `instanceof` — the message is not stable and the class is not the same class across runtimes.

- `listCalendars()` — `GET /calendar/v3/users/me/calendarList`, paginated like `listEvents`.
- `listEvents(calendarId, fromKey, toKey)` — `GET /calendar/v3/calendars/{id}/events` with `singleEvents=true`, `orderBy=startTime`, `timeZone=Asia/Manila`, `timeMin`/`timeMax` from the day keys. Recurring class entries arrive already expanded.
- `insertEvent(calendarId, event)` · `patchEvent(calendarId, eventId, patch)` · `deleteEvent(calendarId, eventId)`.

**Reads are paginated to a stated ceiling of three pages per layer per window, and a layer still truncated at the ceiling is reported as *that layer's failure*** (`Couldn't read Classes.`), never as a quiet day (R24). **A `maxResults` cap with nothing said about what it cut is exactly the failure the deck's constraint 2 forbids:** the bound has to be one the page reports.

**Error kinds:** `invalid_grant` → `expired`; abort → `timeout`; **`404` on a stored layer → `gone`** (R42: permanent, hands over a lever, renders in `.fl-empty`'s register with **no dot**); other 4xx/5xx → `http` with the status and Google's own message, **bounded**. **A `401` clears the cached token and retries once; a second `401` is `expired`.** No other retry anywhere — `CLAUDE.md`: no infinite retry.

**Nothing logs a Google response whole**, and no token or secret reaches a log line.

- [ ] **Step 3: `readCalendarWindow` — the union that keeps two failures apart**

```ts
export async function readCalendarWindow(
  layers: readonly Layer[], fromKey: DayKey, toKey: DayKey,
): Promise<CalendarWindow>;
```

One `listEvents` per **enabled** layer, `Promise.allSettled`, each under the timeout; `failed` holds the **names** of the layers that did not answer. **`none-enabled` is decided before any token fetch** — **no HTTP at all** when every layer is off, because that is a configuration state and not a failed read (R20, R45). The union is what keeps `Couldn't load layers, so the calendar wasn't read.` from ever being confused with `Couldn't read the calendar.`

Events normalise to `CalendarEvent` with `title` bounded to 200 for display. **The page reads today and the 7-day window in ONE call (`today … today+7`)** and splits by `dayKey`, so a slow Google costs one round of calls, not two (§7.4).

- [ ] **Step 4: `.env.example`**

Three names and comments, **never values**, in the file's existing register: what each is, that `GOOGLE_REFRESH_TOKEN` comes from `scripts/google-auth.mts` and is printed once, that the two scopes are `calendar.events` and `calendar.readonly`, and that **Publishing status must be *In production*** because Testing kills the token every 7 days (D11, carrying ShikksTracker's G-22 lesson rather than re-learning it).

- [ ] **Step 5: `google.test.ts`** — §8's list

The Google module is **one import tests replace**; these tests stub `fetch` and touch no network. Pin: **error-kind mapping** (`invalid_grant` → `expired`, abort/`TimeoutError` → `timeout`, `404` → `gone`, 4xx → `http` with a **bounded** message), **the single `401` retry** (one retry, then `expired` — assert the fetch call count, which is what makes "no infinite retry" a test rather than a claim), **the three-page pagination ceiling reporting that layer's failure rather than a short list**, `readGoogleConfig` naming variables and **never echoing a value** (assert the message does not contain the fixture secret), **`none-enabled` making zero fetch calls**, and `readCalendarWindow` returning `failed: ["Classes"]` when one of three layers rejects.

- [ ] **Step 6: Check and commit**

```bash
git grep -nE "googleapis|google-auth-library" -- package.json
# no output: raw fetch, no SDK

git grep -n 'GOOGLE_CLIENT_SECRET\|GOOGLE_REFRESH_TOKEN' -- src/ | grep -v 'src/lib/google.ts'
# no output: the secrets are read in exactly one module
```

`npm test` · `npx tsc --noEmit` · `npm run lint` · `npm run build`.

```
feat(p10b): the Google Calendar client - raw fetch, five calls, one taxonomy
```

---

## Task 7: `scripts/google-auth.mts`, and the dev port

**Rulings implemented:** R36 · §7.6 · design doc *Sign-in, once* · *Security*.

**Files:**
- Create: `scripts/google-auth.mts`
- Modify: `package.json`

- [ ] **Step 1: The throwaway loopback script**

**The two bootstrap routes and `ALLOW_OAUTH_BOOTSTRAP` are dropped, and this replaces them** (R36). The reason is not tidiness: `__Host-session` is `sameSite:"strict"` and `src/proxy.ts` fails closed, so **Google's cross-site redirect back to an app route arrives cookieless and 401s before the handler ever runs** — the ported pair *could not have worked here*. What this buys, beyond correctness: **no allowlist entry, no flag, no production redirect URI, no route to protect, and two fewer manual steps for Riku.**

A `http.createServer` on **8787**: print the consent URL (both scopes, `access_type=offline`, `prompt=consent`), exchange the code Google returns for a refresh token, **print the refresh token once**, exit. **The one registered redirect URI is `http://localhost:8787/callback`.** The script is never deployed, needs no running app, and no page has to be opened.

- [ ] **Step 2: `package.json`**

- A `google:auth` script in the existing `node --env-file=.env.local --experimental-strip-types` style.
- **`dev` becomes `next dev -p 3001`** — regardless of any of this, because **ShikksTracker holds 3000** and the docs already say 3001 (§7.6).

- [ ] **Step 3: Check and commit**

`npx tsc --noEmit` · `npm run lint` · `npm run build`. **Do not run the script yet** — it needs Riku's Google Cloud work first, and that is step 1 of the Riku list. `npm run dev` now binds 3001; **confirm it does not touch 3000.**

```
feat(p10b): the loopback OAuth bootstrap, and dev moves to 3001
```

---

## Task 8: `todos.ts` — the pure half, then the write-through half

**One file, two halves, one banner between them.** The repo's own precedent is `healthSnapshot.ts`, which keeps a pure predicate (`isWithinCheckFloor`) above its impure accessors in one module with one test file; the spec's file list names `src/lib/todos.ts` and no second module, and the pin compensation is real behaviour that `CLAUDE.md` forbids leaving in a route handler. **Recorded as a planning decision**: if a reviewer wants the halves split, it is a file rename and two import lines.

**Rulings implemented:** D5 · D9 · S19 (`ARCHITECTURE.md` §7) · R88 (`3 days late`, never `3d late`) · deck §6 Tile 2 · deck §15 · design doc *The calendar switch* · *Failure handling* · `CLAUDE.md`'s asymmetric rule · §8's `todos.test.ts`.

**Files:**
- Create: `src/lib/todos.ts`
- Create: `src/lib/__tests__/todos.test.ts`

- [ ] **Step 1: The pure half**

```ts
export function sortTodos(rows: readonly TodoLike[]): TodoLike[];
export function dueChip(dueOn: DayKey | null, today: DayKey): { text: string; late: boolean } | null;
export function daysLate(dueOn: DayKey, today: DayKey): number;
export function digestWindow(today: DayKey): { fromKey: DayKey; toKey: DayKey };  // today .. today+3
```

**`sortTodos`:** overdue first, **most overdue first**; then by `dueOn`; then undated by `createdAt` **ascending** (oldest first).

**`dueChip` strings are the deck's and only the deck's:** `today` · `tomorrow` · `Fri 12` (weekday and day, within the next 7 days) · `24 Sep` (beyond) · **`3 days late`, singular `1 day late`**. **`3d late` is not a form** (R88): the mockup's three 106px panes draw it and that is a drafting slip, not a ruled narrow variant — **the deck is the authority on every string and no ruling introduced an abbreviation**. The room exists because R38 already moves the due meta to its own line in the narrow band. **If `3 days late` genuinely does not fit at 106px, that is a question for Riku** (an abbreviated string is his to approve, exactly as the eleven were) and not something this plan may settle; the confirmation itself is Plan C's, in the browser.

**Lateness is in the due-meta column and nowhere else** (§5.9 item 1). `dueChip` returns `late: boolean` and never a colour.

- [ ] **Step 2: The write-through half, and the asymmetry that is the whole design**

```ts
export async function createTodo(input: CreateTodoInput): Promise<CreateResult>;
export async function updateTodo(id: string, input: UpdateTodoInput): Promise<UpdateResult>;
export async function setTodoDone(id: string, done: boolean): Promise<DoneResult>;
export async function deleteTodo(id: string): Promise<DeleteResult>;
```

**Four rules, and each one is a `CLAUDE.md` rule with a name:**

1. **`pinTodo` is Google FIRST, then a guarded local write, with a compensating delete.** Insert the all-day entry (`start.date = end.date = dueOn` in Google's date-only form, `summary = title`) into the calendar; then `findOneAndUpdate` the to-do with `calendarEventId` **guarded on `calendarEventId: {$exists: false}`**. If the guarded update fails or matches nothing, **delete the entry just created** and throw the original error. **If *that* delete fails, throw an error whose message says an entry may have been left on the calendar** — deck §15's sentence. This is a guarded atomic update, never read-modify-write.
2. **Done / unpin / delete / move are local FIRST, Google second.** The to-do's own change is written first and **always succeeds on its own**; the Google call follows; a Google failure is **reported** with deck §15's sentence and **leaves `calendarEventId` in place so the next attempt retries the same entry rather than losing it**.
3. **Classify before retrying, and never guess.** A **definite** failure returns `"failed"` and the caller says `Couldn't save.` / `Couldn't delete.`; a **timeout** returns `"unknown"` and the caller says **`Couldn't tell if that saved.`** and **never asserts the save failed** — a request that timed out may still have landed. Return a discriminated result, not a thrown error, for exactly this reason: a `catch` cannot tell the two apart.
4. **`setDone(id, true)` is idempotent and guarded** (§7.3). Already-done is **not** an error — the page's hidden-id set and `router.refresh()` reconcile, and a second tap during a slow round trip must not produce a failure sentence for a state that is already correct.

**There is one in-flight state and it has a surface.** A to-do marked `done` that still holds a `calendarEventId` is a record whose calendar entry Google refused to remove, and **its Done row says so — `entry left on Google` — until a retry clears it**; after a failed move, the open row carries `entry on the old day`. **Nothing is left silently `pending` and nothing is swept by a job**: the stale state is visible on the row it belongs to. The design doc's earlier *"there is no in-flight status to sweep"* was **wrong and is corrected** (R86 §I item 4) — and note in the docblock that this is the reason `calendarEventId` is deliberately *not* cleared on a failed removal.

**No alert is sent from any of these paths.** They are user-initiated writes with a sentence on screen; `CLAUDE.md`'s "alerts are queued and sent last" governs the multi-step morning job (Task 11), and adding a push here would mean a notification failure could corrupt a to-do's state.

- [ ] **Step 3: `todos.test.ts`** — §8's list, pure only

`sortTodos` order (overdue-first, most-overdue-first, then by date, then undated oldest-first, with a fixture that would sort wrongly under any two of the three rules). `dueChip` labels — all five forms, **`1 day late` singular**, and **an explicit test that no output ever contains `d late`** (R88). `daysLate`. **The 3-day digest window at day boundaries.** The write-through half is not unit-tested here: it is I/O, and its correctness is the route tests' and the live observation's — say so in the file's header rather than leaving a gap that reads as an oversight.

- [ ] **Step 4: Check and commit**

```bash
git grep -n "d late" -- src/lib/ src/app/
# no output, exit 1  (R88)
```

`npm test` · `npx tsc --noEmit` · `npm run lint` · `npm run build`.

```
feat(p10b): todos.ts - ordering and due chips, then the write-through
```

---

## Task 9: `personalView.ts` — every view model but the ramp

**Rulings implemented:** R10 · R14 · R16 · R17 · R18 · R19 · R20 · R21 · R22 · R23 · R42 · R45 · R49 · R51b · R55 · R57 · R58 · R59 · R69 · R73 · R83 · R85 · R90 · §4.1–§4.6 · §5.9 · §8's `personalView.test.ts`.

**Files:**
- Modify: `src/lib/personalView.ts` (Plan A created it with `heroTint`)
- Create: `src/lib/__tests__/personalView.test.ts`

- [ ] **Step 1: The six builders**

```ts
export function buildTodayView(input: TodayInput): TodayView;
export function buildWeekView(input: WeekInput): WeekView;
export function buildTodoTileView(input: TodoTileInput): TodoTileView;
export function buildDoneView(input: DoneInput): DoneTileView;
export function buildPushTileView(input: PushInput): PushTileView;
export function buildLayersView(input: LayersInput): LayersTileView;
```

**Twelve invariants these functions enforce in the TYPE rather than by care.** Each one is a sentence a builder can check against a ruling:

1. **A header figure is omitted under a failed read, never zeroed** (R21). `count` is `number | null` and `stamp` is `string | null`, so **`0 open` above `Couldn't load to-dos.` is unrepresentable.**
2. **`0 open` and Done's absent count differ on purpose.** To-do's reads `0 open` because the store answered; Done's is absent at zero (deck §12) because it is a tally. Two fields, two rules, one comment saying why they are not the same rule.
3. **`Nothing scheduled.` is suppressed whenever any enabled layer is unread** (P8 R51). The tile cannot claim the day is empty while one calendar did not answer, so `scheduled.kind` can only be `"empty"` when `failed` is empty **and** the window was `ok`.
4. **`—` is unreachable for an unread day** (R18). `DayRowView`'s two variants are the guard: `{items}` or `{unread:true}`, never both, and the `items` variant is the only one that can render a dash.
5. **With both feeds down the day rows are omitted entirely** (R18, deck §11): `days: null`. Seven dashes would be seven small lies.
6. **With every layer off, day rows render and `—` is a measurement** (R45). `none-enabled` is decided before any read, so there is no calendar source left to answer and the to-do store has answered. R18's condition holds vacuously.
7. **Nothing is truncated inside a day, however many items it holds** (R51b). ~~The per-day 8-item cap and its `+N more`~~ are **superseded**, so what the test pins there is **the opposite of what the old design doc said**.
8. **A day's shape comes from its item count** (R57): 0 → the dash; 1 → one plain item, **never** wrapped in a disclosure (R57, R77); 2+ → the disclosure, whose summary is **the leading item's own title, bare** (R58, no time prefix and no tag) and whose count is **`N items`** — ratified by Riku 2026-09-25 as **R90**, now deck §15. **`N items` never reads `1 items`**, because the disclosure exists only at 2+.
9. **The hero's tint answers to the to-do read alone** (R74, R83). `heroTint` is called with the `DUE` group's row count, or `null` when that read failed — **never** with anything derived from the calendar. A calendar failure, a `none-enabled`, a vanished layer and a half-read window all leave the tint alone, and three mockup panes are the proof: an expired-Google hero, an all-layers-off hero and a "Did not answer" hero all tint **green**, because their to-do read answered `Nothing due.`
10. **`spread` is true only when both groups are empty** (R17). With rows under `SCHEDULED` and nothing under `DUE` the tile **top-aligns** — dropping `Nothing due.` to the bottom edge would open exactly the air the rule exists to close. No other tile spreads.
11. **The push tile can tell "no push" from "no record"** (R22), from one extra `AgentRun` read: a record for today → quote it; else `run.ok && dayKey(run.startedAt, APP_TZ) === todayKey(now)` and no record → `A push went out this morning. Its text wasn't stored.` **with no dot**; else no record → `No push this morning.` with `Last: …` beneath; else never stored → `No push recorded yet.`; monitoring off → `Monitoring is off, so no push goes out.`, **outranked by a push stored for today**. **`No push this morning.` takes the `--missing` dot only once `now` in `APP_TZ` is past `PUSH_EXPECTED_HOUR`** — before 07:00 it stands undotted, because it is true at 00:30 and only the alarm would lie. **This is the one `--missing` dot on the page that is not lateness.**
12. **The push tile quotes and never evaluates** (R14). Nothing inside a quoted push is hued, clamped, re-counted or `+N more`'d, and `devices` is not rendered.

**Every failure sentence carries its dot and its register, from `SayLine` and nothing else** (R10, R55): `dot: "stale"` for every couldn't-read; `dot: "missing"` only for lateness and for the past-07:00 missing push; **`dot: null` for a measured emptiness, an absence by configuration, and an absence of a record** — and **that absence of a dot is itself the signal.** A vanished calendar's `Classes is no longer on your Google account. Untick it in Settings.` takes **no dot** (R42): permanent, and it hands over a lever. **Riku was offered one page-level sentence for a whole-database outage and declined it — every failure sentence keeps its 5px dot** (R55), so nine dots on one page is the accepted render and must not be collapsed.

**Every string comes from deck §6 / §11 / §12 / §15 verbatim.** Where this plan and the deck differ, **the deck wins** (R86). Put the deck's section number in a comment beside each literal.

- [ ] **Step 2: `personalView.test.ts`** — §8's list

Today and week view models in **every** state: empty · one layer failed · all failed · `not-configured` · `expired` · `none-enabled` · to-dos unavailable · both feeds down · and the **20-row bounds with their `Showing 20 of 34.` strings**. Plus, as named assertions: **`0 open` above a failed read is unrepresentable** (the type, not a behavioural claim — write it as a `// @ts-expect-error` case); **`—` is unreachable for an unread day**; **nothing truncated inside a day**, at eleven items; **a day with 2+ produces the disclosure shape, a day with 1 the plain shape, a day with 0 the dash**; **`N items` never reads `1 items`**; **the tint is green on the expired-Google, all-layers-off and one-layer-failed heroes**; **`spread` false when `SCHEDULED` has rows**; the push tile's six states including the **undotted** pre-07:00 sentence and the **monitoring-off state losing to a stored push**.

- [ ] **Step 3: Check and commit**

```bash
# purity: no model, no fetch, no env, no clock
git grep -nE "from \"@/models|fetch\(|process\.env|Date\.now\(" -- src/lib/personalView.ts
# no output, exit 1 - `now` is always a parameter
```

`npm test` (report the count) · `npx tsc --noEmit` · `npm run lint` · `npm run build`.

```
feat(p10b): personalView.ts - six view models, every state in the type
```

---

## Task 10: The three mutation doors

**Rulings implemented:** §7.6's validation list · deck §7 · design doc *Security* · `CLAUDE.md`'s route rules.

**Files:**
- Create: `src/app/api/todos/route.ts` (`POST`)
- Create: `src/app/api/todos/[id]/route.ts` (`PATCH`, `DELETE`)
- Create: `src/app/api/calendar/events/route.ts` (`POST`)
- Modify: `src/app/api/settings/route.ts` (**projection only** — `parseSettingsPatch` already widened in Task 5)

- [ ] **Step 1: The four handlers, all the same shape**

`requireSession` **first** · the **Origin check on every mutation** · `connectDB` · **inputs validated at the top** · one call into `todos.ts` or `google.ts` · a typed JSON error with the right status. **Handlers stay thin**: no branching that decides what Riku is told, because that lives in the pure layer and is tested there.

**`POST /api/calendar/events`** validates, in this order (§7.6): `title` 1–200 · **`calendarId` must be one of the stored layers** · `dayKey` well-formed · `allDay` boolean · else `start < end` as `HH:MM`. Builds the Google event with `Asia/Manila` and calls `insertEvent`. **No local write, so there is no half-state and nothing to sweep.** The response returns Google's `htmlLink`. **The `calendarId` check is the security boundary**, not a convenience: it is what makes the app unable to write to a calendar Riku did not choose.

**`PATCH /api/settings` is not re-validated here.** `parseSettingsPatch` already covers `layers` and `personalLayout`; this task's only edit to that file is **`projectSettings` gaining the two fields** so a PATCH reports back what it stored — a PATCH that reports nothing back looks identical to a save that changed nothing.

- [ ] **Step 2: Bounded reads, and the absence of GETs**

**These routes have no `GET`.** The page is server-rendered and reads its own data; a `GET /api/todos` would be a second door onto the same rows with its own bound to keep in step. **Every list read in this phase happens in a server component with a limit and a `total`** so the tile can say `Showing 20 of 34.` — the bound is stated where it is rendered.

- [ ] **Step 3: Check, and confirm the proxy needs nothing**

```bash
npm test        # proxy.test.ts must still pass unchanged
git diff --stat -- src/proxy.ts     # no output
```

Then `npm run build && npx next start -p 3001` and, **with the session cookie**, exercise each door: a valid `POST /api/todos` creating a row, a 400 for a 141-character title, a 400 for a `calendarId` not in `layers`, a 401 for the same call **without** the cookie, and a 403 for a mutation with a foreign `Origin`. **Report each status.** A route whose 401 was never observed is a route whose `requireSession` was never observed.

- [ ] **Step 4: Commit**

```
feat(p10b): three mutation doors - to-dos, one event, the settings patch
```

---

## Task 11: The push's Today sentence, and the *LastDigest* write

The section P5a-7 dropped for want of a to-do store. **This is the phase's acceptance bar, half of it.**

**Rulings implemented:** D6 · D12 · D14 · R22 · R23 · R37 · §7.8 · deck §10 · deck §15 · §8's `digest.test.ts`.

**Files:**
- Modify: `src/lib/digest.ts`
- Modify: `src/lib/push.ts`
- Modify: `src/app/api/cron/morning/route.ts`
- Modify: `src/lib/__tests__/digest.test.ts` · `push.test.ts`

- [ ] **Step 1: `composeTodayLine`, pure**

```ts
export interface TodayInput {
  events: Array<{ title: string; time: string | null }> | "unavailable";
  due: Array<{ title: string; dayLabel: string }> | "unavailable";
  overdue: Array<{ title: string; daysLate: number }>;
  /** Layer names that did not answer, when SOME did (R23's partial form). */
  missedLayers: string[];
}
export function composeTodayLine(today: TodayInput): string;
```

Produces the deck §10 forms: up to 3 names per part, `+2 more` / singular `+1 more`, `(today)` / `(tomorrow)` / `(Fri)`, `(3d)` / `(1d)`, and **`Today: nothing scheduled, nothing due.`** when every part is empty (D6 — silence and "couldn't read the calendar" must never look the same).

**Plus the partial form** (R23): *some layers answered, one did not* **names what arrived and then names the calendar that was not read** — `Today: Math Methods 09:00. Classes wasn't read.` — **and the miss is counted in the problems, so the title never says all clear over a blind spot.** This is the form the deck spells out and the one most likely to be dropped as an edge case.

**`Overdue:` is omitted under a failed to-do read**, and the omission is covered by `Due: to-dos unavailable.` — an omitted part must never be readable as "nothing overdue".

**Every layer switched off:** `Today: no layers switched on.` (deck §15) — **and it is not counted as a problem**, because it is a choice and not a fault.

- [ ] **Step 2: `composeDigest` places it second, and counts the misses**

Second in the body — **after the problems line, before the freelance line** (D12: problems stay first so a bad night is never cut off). When `events` or `due` is `"unavailable"`, add `calendar check unavailable` / `to-do check unavailable` to the problems, **exactly as the existing code already adds `pipeline check unavailable`** — so the title's count is honest.

**Problem fragments are lowercase with no terminal stop.** `digest.ts` joins fragments and `end()` adds the stop, so the deck's `Calendar check unavailable.` is the **rendered** form, not the fragment as written (R23). The file's existing `short()` / `end()` pair already does this; the new fragments must match its convention and not carry their own capital or period.

- [ ] **Step 3: `buildPushPayload`'s body bound rises to 320**

For **every** push, not only the digest (§7.8), **and its test moves with it.** 320 so Today cannot push the freelance line off the end (D12). The title stays at 80.

- [ ] **Step 4: The morning route — two reads, then the write, in that order**

Inside the `dispatcher` job, **before `composeDigest`**: read `layers` (from `readOsSettings`, **never `getOsSettings`**, which is `updateOsSettings({})` and a write); read **the Manila day's** events for enabled layers; read open to-dos due within 3 days and overdue. **Both new reads are caught into `"unavailable"` and logged, never thrown** — the digest never fails for Google.

**The *LastDigest* write, and three mechanisms that make the push tile honest** (R22):

- it sits **after** the `delivery.sent === 0` guard — **nothing is recorded as sent that was not**;
- it is **wrapped so it cannot throw** — a persistence step must not cost the push that already went out;
- it stores **`buildPushPayload`'s sliced output, not `composeDigest`'s**, so a 321-character body cannot manufacture the very state the tile reports.

**On failure the dispatcher's `AgentRun` carries `itemsFailed: 1`**, which the rail already renders as degraded that same morning and which **tomorrow's** watchdog names in the push. **The design doc's claim that the failure is named in *that* morning's problems line is struck by name** — the push has already been composed by then, and the R58 pattern does not reach past the send.

**Alerts stay last and stay unchanged.** The route's existing ordering rules — every job writes its own `AgentRun`, one job's failure never stops the next, the push is sent by the last job after every other job's data state is settled — are not touched. The two new reads go **inside** the dispatcher job, so a Google outage produces a `dispatcher` row and a named problem, not a route-level 500.

- [ ] **Step 5: Extend `digest.test.ts` and `push.test.ts`**

`composeTodayLine`'s forms · **the partial-calendar form** · placement **second in the body** · `"unavailable"` adding to the problems **and to the title's count** · **the lowercase fragment rule** · the **320** bound · the quiet-morning line · `Today: no layers switched on.` not counted as a problem · `Overdue:` omitted under a failed to-do read with `Due: to-dos unavailable.` present. `push.test.ts`'s existing 200-character assertions **move to 320**.

- [ ] **Step 6: Check and commit**

`npm test` · `npx tsc --noEmit` · `npm run lint` · `npm run build`.

```
feat(p10b): the push's Today sentence, and the LastDigest the tile quotes
```

---

## Task 12: Verification

Run every check in order. **Do not claim completion until each one has produced the expected output in front of you.** Steps 5 and 6 are the ones no test can meet.

**Files:** none modified.

- [ ] **Step 1: The standing trio and the lint baseline**

Run: `npm test` → every suite passes. **Report the count.** The baseline is Plan A's final number; this plan adds six files (`days`, `todos`, `layout`, `personalView`, `google`, and extensions to `digest` / `push` / `settings` / `osSettings` / `models`).
Run: `npx tsc --noEmit` → no output, exit 0.
Run: `npm run lint` → **the four pre-existing errors and three warnings, and nothing new.** **This plan adds no client component**, so any movement in those four is a signal that something was edited that should not have been.
Run: `npm run build` → `✓ Compiled successfully`, with `/api/todos`, `/api/todos/[id]` and `/api/calendar/events` in the route table.

- [ ] **Step 2: The rules this plan promised to keep**

```bash
# THE PRIME DIRECTIVE, both halves
git -C ../ShikksTracker status --porcelain            # no output
git grep -n 'ST_API' -- src/lib/todos.ts src/lib/google.ts src/lib/personalView.ts src/lib/days.ts src/lib/personalLayout.ts
# no output: no freelance data path was invented here

# no new dependency, no CSP change, no proxy edit
git diff --stat <plan-A-final-HEAD>..HEAD -- package-lock.json next.config.ts src/proxy.ts
# no output  (package.json DID change: the dev port and the google:auth script)

# no JSX, no client component, no stylesheet
git diff --name-only <plan-A-final-HEAD>..HEAD -- src/styles/ "src/app/(app)/"
# no output
git grep -rn '"use client"' -- src/lib/ src/app/api/       # no output, exit 1

# the client-import rule (7.5) and the purity rules
git grep -nE "from \"@/models|server-only|next/headers|process\.env|fetch\(" -- src/lib/personalLayout.ts
git grep -nE "from \"@/models|fetch\(|process\.env|Date\.now\(" -- src/lib/personalView.ts src/lib/days.ts
# both: no output, exit 1

# schema rules
git grep -n 'Schema.Types.Mixed' -- src/models/          # no output, exit 1
git grep -nE "type: String" -A 1 -- src/models/Todo.ts src/models/LastDigest.ts
# read every hit: each String has a maxlength or an enum

# secrets in exactly one module, and never echoed
git grep -n 'GOOGLE_CLIENT_SECRET\|GOOGLE_REFRESH_TOKEN' -- src/ | grep -v 'src/lib/google.ts'
# no output
git grep -n 'console\.\(log\|error\|warn\)' -- src/lib/google.ts
# read every hit: no token, no whole response, no secret

# the cut things stay cut
git grep -n 'ALLOW_OAUTH_BOOTSTRAP\|api/google/status\|api/google/calendars'
# no output, exit 1
git grep -n 'section: 1' -- src/models/Todo.ts           # no output: the third index is cut
git grep -n 'd late' -- src/lib/ src/app/                # no output: R88
```

- [ ] **Step 3: The three doors, live on 3001**

`npm run build && npx next start -p 3001`, then, **with the session cookie**, the list from Task 10 step 3 — each status observed and reported: `POST /api/todos` 200 · 141-char title 400 · a `calendarId` outside `layers` 400 · no cookie 401 · foreign `Origin` 403 · `PATCH /api/todos/[id]` toggling `done` twice (**the second is not an error** — idempotent, §7.3) · `DELETE` · `PATCH /api/settings` with a valid `personalLayout` 200 and with a span of 13 **400 carrying `validateLayout`'s own typed message**.

- [ ] **Step 4: Riku's hands, surfaced in order — this is where they block**

Each is surfaced at the moment it blocks, per his standing instruction. **Stop and hand over; do not work around any of them.**

1. **Google Cloud, ShikksTracker's project** (D11 — his choice over a new project, so Gmail's token is untouched): enable the **Google Calendar API**; create a **second OAuth client** (Web application) named for this app; add **one** redirect URI, **`http://localhost:8787/callback`**; add the two scopes (`calendar.events`, `calendar.readonly`) on the consent screen; confirm **Publishing status: In production** — **Testing kills the token every 7 days** (ShikksTracker's G-22, carried over rather than re-learned).
2. **Locally:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into `.env.local`, then `npm run google:auth`, open the URL it prints, consent, and copy **the refresh token it prints once**. The app does not need to be running and no page has to be opened.
3. **Vercel:** add the three `GOOGLE_*` variables to the project; **redeploy**.
4. **Indexes:** `npm run migrate:indexes` to read the plan, then **`npm run migrate:indexes:apply`**. The two new `Todo` indexes are created **by that script, not by Mongoose**, because `autoIndex` is off in production. **Look at the dry-run diff before applying** — `syncIndexes()` drops any index on a collection that the schema does not declare.

- [ ] **Step 5: One real Google read, observed — this plan's own real-data bar**

`CLAUDE.md`: *an agent feature is actually done when it has been observed doing its job once against real data.* This plan's Google client is the first new external integration with its own auth since the OS API, and it is observed here rather than at the end of Plan C:

With the three variables in `.env.local` and the bootstrap done, write a throwaway one-off check (a `node --experimental-strip-types` scratch file, **deleted before the commit, never added to `scripts/`**) that calls **`listCalendars()`** and **`readCalendarWindow(layers, todayKey, todayKey+7)`** against Riku's real account and prints the shapes. Confirm, and report:

1. **Six calendars come back** — Personal (main), Classes, Events, Org Stuff, and the two subscribed holiday feeds (deck §3's measured list). If the count differs, that is new information about Riku's account, not a bug; report it.
2. **`readCalendarWindow` with no enabled layers makes zero HTTP calls** and returns `{ok:false, reason:"none-enabled"}` (R45).
3. **`readCalendarWindow` with one bad `calendarId` returns `gone`**, not `http` (R42).
4. **The window over today…today+7 comes back `ok`** with whatever it holds — **and an empty week is the correct answer** (deck §3: *"It's accurate, nothing is scheduled."*). An empty result here is the primary state of this page, not a failure to investigate.
5. **No secret in any output.** Read the printed lines.

- [ ] **Step 6: One real push, composed against a real calendar read**

Trigger the morning route manually on the deployed app with the cron secret (`x-cron-secret`, timing-safe — the same way P5a's runs were checked) **with monitoring on**, and confirm:

1. **The push arrives** and its body carries the **Today sentence in second place**.
2. **The sentence matches the day** — what the calendar actually holds and what is actually due. With no to-dos yet it reads `Today: nothing scheduled, nothing due.` or names what the calendar held; **that is a pass**, and it is D6's whole point that silence says so out loud.
3. **The body is within 320 characters** and the freelance line is still on the end.
4. **A *LastDigest* record exists** with the **sliced** body, and its `sentAt` is the real send time.
5. **`AgentRun` for `dispatcher` is `ok`** with no `itemsFailed`.

**The phase's full bar — `/personal` live on Riku's real calendars and his real to-dos, and one *automatic* 07:00 push naming what was actually due and scheduled — is Plan C's**, because the to-dos have to be tickable from the page for that sentence to be worth reading. **This step is the half of it that does not need a rendered page**, and it is done here so a Google or digest fault is found now rather than behind six tiles.

- [ ] **Step 7: What this plan deliberately did NOT ship**

So a reviewer can tell a gap from a deferral. **Not in Plan B:** any component, any island, any tile, the edit mode, the forms, the two Settings cards, `ARCHITECTURE.md`'s §3.1 / §4.2 / §5 updates — **all Plan C**. `GET /api/google/calendars` — **cut** (Task 6's ruling). `GET /api/google/status`, the two OAuth routes, `ALLOW_OAUTH_BOOTSTRAP`, the third `Todo` index — **cut by R24, R36 and R35 before this plan existed.** Index *creation* — **Riku's**, step 4 item 4.

- [ ] **Step 8: The post-build record**

Append: the plan-start and plan-end HEADs, the test count, the observed statuses from step 3, the six calendar names from step 5, the push's exact body from step 6, and **anything in the spec or the deck that a builder had to guess.** One is already known and is this plan's ruling rather than a guess: **`GET /api/google/calendars` is cut** (Task 6). If any other guess was made, name it here rather than burying it in a commit message.

---

## Self-review

Before handing this plan to Plan C, confirm each of the following is true of the repo, not of the plan:

- [ ] `days.ts`, `todos.ts`'s pure half, `personalLayout.ts` and `personalView.ts` are pure: no model, no `fetch`, no `process.env`, no `Date.now()` — `now` is always a parameter.
- [ ] `personalLayout.ts` imports no model, no `server-only` and no `next/headers`, and is therefore safe for a client component to import.
- [ ] `Todo` has two indexes and no TTL; every `String` has a `maxlength`; `section` is an enum; no `Mixed` anywhere; both sub-schemas take `_id: false`.
- [ ] `LastDigest` has a fixed `_id`, is written by `findOneAndUpdate` with one E11000 retry, and its read accessor returns `null` when absent.
- [ ] `readOsSettings` still never upserts, and returns **copies** of the two new arrays.
- [ ] The three Google secrets are read in exactly one module and never appear in a log line or an error message.
- [ ] Every mutation route calls `requireSession` first and checks `Origin`; `calendarId` must be a stored layer.
- [ ] The pin path is Google-first with a guarded write and a compensating delete; every other Google path is local-first with the id kept for retry; a timeout says `Couldn't tell if that saved.` and never asserts failure.
- [ ] The *LastDigest* write is after the `sent === 0` guard, wrapped, and stores the **sliced** body.
- [ ] `PERSONAL_HERO_BUSY_AT` still does not exist; `heroTint` is still one field; Plan A's three exports in `personalView.ts` are unmoved.
- [ ] `npm test` · `npx tsc --noEmit` · `npm run build` green; `npm run lint` at four errors and three warnings.
- [ ] `git -C ../ShikksTracker status --porcelain` is empty.
