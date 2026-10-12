# Smooth Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pages show their outline and a thin top bar the instant they're tapped. An add shows a faded stand-in at once. A switch flips at once. A decided queue card leaves at once. Every press still says only what it knows.

**Architecture:** Next's own `loading.tsx` boundaries draw each page's outline. A tiny external store (`navProgress.ts`) counts what is loading, and one fixed bar in the `(app)` layout reads it. Presses keep `pressOutcome` (L7) as the one rule for what an answer means, and three new pure modules carry the rest: `standIns.ts` for adds, `instantSwitch.ts` for switches and `queueOutcome.ts` for the queue. Each module is pinned by Vitest, and the islands render them.

**Tech Stack:** Next.js 16.2 App Router (`loading.tsx`, `useLinkStatus` from `next/link`), React 19.2 (`useSyncExternalStore`), TypeScript strict, Vitest (node environment, `src/lib/__tests__/` only). No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-11-smooth-feel-design.md`, approved by Riku 2026-10-11, including §6's queue wording. Where this plan refines the spec, the refinement is listed under "Deviations from the spec" below and is binding.

---

## How this is built

The Briefing/Debrief method: the lead session decides and orchestrates and does not write code. There is **one named-role builder per task (Sonnet)**, then **one Opus spec + quality review per feature** once the feature's last task lands (Riku, 2026-10-09). After that come the principal review, the **Verification Lead**, and the post-build record at the foot of this file. Builders commit per task and run their own tests and `npx tsc --noEmit` before committing. Fix rounds go back to the owning builder.

| Feature | Tasks | Reviewed after | Runs |
|---|---|---|---|
| **F1 · Outlines and the top bar** | T1–T5 | T5 | first, alone |
| **F2 · Instant adds** | T8–T12 | T12 | after F1, in parallel with F3 and F4 |
| **F3 · Instant switches** | T6–T7 | T7 | after F1, in parallel with F2 and F4 |
| **F4 · The queue** | T13–T14 | T14 | after F1, in parallel with F2 and F3 |

| Task | Role | Files (exclusive while running) |
|---|---|---|
| T1 | Store Keeper | `src/lib/navProgress.ts` (new), `src/lib/doorSentence.ts` (new); tests `navProgress.test.ts`, `doorSentence.test.ts` (new) |
| T2 | Shell Builder | `src/styles/feel.css` (new), `src/app/layout.tsx` (one import line), `src/app/(app)/_shell/NavProgress.tsx` (new), `src/app/(app)/_shell/Outline.tsx` (new), `src/app/(app)/layout.tsx`, `src/app/(app)/_shell/NavList.tsx`, `src/app/(app)/freelance/ViewSwitch.tsx`, `src/app/(app)/personal/_blocks/SettingsLine.tsx` |
| T3 | Layout Rememberer | `src/lib/personalLayoutMemory.ts` (new), test `personalLayoutMemory.test.ts` (new), `src/app/(app)/personal/RememberLayout.tsx` (new), `src/app/(app)/personal/PersonalOutline.tsx` (new), `src/app/(app)/personal/loading.tsx` (new), `src/app/(app)/personal/page.tsx`, `src/app/(app)/personal/_blocks/Today.tsx` (fallback only), `src/app/(app)/personal/_blocks/Week.tsx` (fallback only), `src/app/(app)/personal/_blocks/Layers.tsx` (fallback only) |
| T4 | Outline Builder | `src/app/(app)/freelance/loading.tsx` (new), `src/app/(app)/freelance/queue/loading.tsx` (new), `src/app/(app)/settings/loading.tsx` (new) |
| T5 | F1 reviewer (Opus) | none (reads, reports) |
| T6 | Switch Builder | `src/lib/instantSwitch.ts` (new), test `instantSwitch.test.ts` (new), `src/app/(app)/settings/_blocks/CalendarPicker.tsx`, `src/app/(app)/settings/_blocks/AgentSwitches.tsx`, `src/app/(app)/personal/LayerSwitches.tsx` |
| T7 | F3 reviewer (Opus) | none |
| T8 | Stand-in Clerk | `src/lib/standIns.ts` (new), test `standIns.test.ts` (new) |
| T9 | Page-State Builder | `src/app/(app)/personal/LayoutEditor.tsx` |
| T10 | Row Placer | `src/app/(app)/personal/StandInRows.tsx` (new), `src/styles/personal.css` (appended section), `src/app/(app)/personal/_blocks/Todos.tsx`, `src/app/(app)/personal/_blocks/Today.tsx`, `src/app/(app)/personal/_blocks/Week.tsx` |
| T11 | Form Builder | `src/app/(app)/personal/TodoForm.tsx`, `src/app/(app)/personal/EventForm.tsx` |
| T12 | F2 reviewer (Opus) | none |
| T13 | Queue Builder | `src/lib/queueOutcome.ts` (new), test `queueOutcome.test.ts` (new), `src/app/(app)/freelance/queue/page.tsx`, `src/styles/legacy.css` (appended section) |
| T14 | F4 reviewer (Opus) | none |
| T15 | Principal Reviewer, Verification Lead | none (reads, runs; the record is the only write) |

F2, F3 and F4 touch disjoint files, so they can run at once. **Inside F2 the order is T8 → T9 → T10 → T11.** Every path is relative to `C:\Users\Shikks\Projects\ClaudeProjects\RikuOS`, and test files live in `src/lib/__tests__/`.

**Parallel builders share one working tree, so every commit is a pathspec commit:** `git commit -m "…" -m "Claude-Session: https://claude.ai/code/session_01Mn421oryCACSpH3NzRgoxw" -- <paths>`. Name exactly that task's files, and never use `git add -A` or a bare `git commit`. Parallel builders never run `next build`; the build runs once, in T15.

**Agents must NOT write to Riku's database or calendar, and must NOT send a push.** Every check is by unit test, or by the Verification Lead against a throwaway database with the network intercepted. Never connect to ShikksTracker's database (the prime directive).

**Environment lessons (from Plans A, B and the Debrief, still true):**
- Subagents may hit the account usage limit. Resume with SendMessage and check `git status` first; uncommitted work belongs to that subagent.
- Never use git worktrees with a junction to `node_modules`.
- Ports 3000/3001/3011 belong to other servers. **Riku may have his own `next dev` running. Never touch, stop or reuse it.** Use ports 3021–3023, and run one Next server at a time.

**Lint baseline:** `npm run lint` exits 1 at its recorded baseline: exactly **four** `react-hooks/set-state-in-effect` errors and **three** warnings. A fifth error or a fourth warning fails the step. Every effect this plan adds touches only an external store or `localStorage` and never sets React state. The two existing effects this plan touches (AgentSwitches' load, the queue's load) keep their shape.

**Purity:** no component this plan writes calls `new Date()`, `Math.random()` or reads a ref during render. Times and keys are made in handlers. React 19's lint rules flag the rest.

**L1e still applies:** `legacy.css` has a bare `button{text-transform:uppercase}`, so **every button this plan adds sets `text-transform:none`**. That's only `.q-link`; every other new control is an existing class. **No new `@media` rule.** `base.css`'s global reduced-motion rule (`*{animation:none!important;transition:none!important}`) is the only motion switch, and every state below reads correctly with it on.

---

## Deviations from the spec (binding)

1. **The top bar spans the viewport, fixed at its top edge (spec §3.2 said "across the top of the content area").** On phone width the rail is already a 44px strip across the top (S20), so one full-width line reads the same at every width and needs no alignment to a column.
2. **The bar's signal is the loading boundaries themselves, with `useLinkStatus` as the early half (spec §3.2 named `useLinkStatus` alone).** Every route here is dynamic and gets a `loading.tsx`. A prefetched outline commits the navigation at once, and from then on `useLinkStatus` reports not-pending while the page is still coming. So every outline and every Suspense fallback mounts a `LoadingSignal`, which counts into `navProgress`. Each in-app link also carries a `LinkPending` for the moment before an outline exists. The bar shows while the count is above zero. It also runs on first open, because the first HTML streams the outline too.
3. **Stand-ins in a week day sit after the day's items.** The server's `—` (and `nothing open` / `Nothing scheduled.` / `Nothing due.` in a group) is hidden by CSS `:has(.pe-standins)` while a stand-in sits beside it. This keeps the server's markup untouched, and the server's next render owns the row again. **A stand-in renders no control at all:** no tick button and no link. It is the row's shape, faded, with its mark. The spec said its controls are "refused". Having none is the stricter form of that, and it can't be pressed by accident.
4. **An event add that got no answer says the event form's existing sentence under the head, `Couldn’t reach Google. Check the calendar before trying again.`, not `Couldn’t tell if that saved.`** Spec §7 keeps every existing string, and this one is more specific about Google. The stand-in's own mark is still `couldn’t tell if that saved`, and the to-do add's head note is `Couldn’t tell if that saved.` as the spec says.
5. **A settled stand-in leaves at the next server render whatever that render holds (spec §4 "unknown").** Nothing tries to match a stand-in to a server row by title, so there is no guessing. If the to-do landed, its real row is there. If it didn't, the head note already said the app couldn't tell. A **to-do** add's stand-in carries its due chip, worked out in the press handler with `todos.ts`'s `dueChip`, so render stays pure.
6. **An event added for a day outside today … today+7 draws no stand-in** (no tile shows that day). The existing `Added. It’s on Fri 24 Oct, outside this week.` note covers its ok.
7. **The queue's link names the real filter:** `Approved` for an approval and `Edited approved` for an edited one. The approved wording reads "It’s under Approved"; for an edited approval the control's text is `Edited approved`. The rest of the sentence is unchanged.
8. **A refused decision shows the door's own words** (e.g. `Item is no longer pending (already decided or expired).`), through `doorSentence`. pressOutcome deliberately turns a sentence-only body into the caller's fallback (`Couldn’t save.`), but the queue and Settings' agent cards have always shown the door's words, and keep doing so. A refused **edit** reopens its edit box with the edited text intact.
9. **`LayerSwitches` already flips at once** with exactly the spec's semantics (P10c). It changes only to share `instantSwitch.ts`, with no behaviour change. **Settings' agent cards' `Loading…` becomes their outline** (spec §3.1's rule, applied to the one client-fetched block left on the page).
10. **A re-read after a decision is quiet:** no outline over a list that is already on screen. Initial loads and filter changes show the outline. The queue's exit is slide-and-fade (200 ms), after which the list closes over the gap. That gap isn't animated, because a height animation needs a measured height (a ref read).
11. **The Freelance outline omits the health strip.** It is one short line at the foot of the page, so its arrival moves nothing above it. The Personal outline holds the `Edit layout` button's room with a hidden, non-interactive copy (`.ol-ghost`).
12. **Build amendments (lead rulings, 2026-10-11):**
    - **(a)** The Freelance dashboard moves into a route group, `src/app/(app)/freelance/(dashboard)/`, holding `page.tsx`, `loading.tsx` and `_blocks/`. Without PPR, Next stops prefetching at the first `loading.tsx` on a path, and a boundary on the `freelance` segment swallowed `/freelance/queue`: its outline never showed and the dashboard's flashed instead. The URL is unchanged. The queue outline gains the filter row as invisible placeholders, the state-of-play box draws one bar, and the Personal outline holds the Today date line's room (F1 review).
    - **(b)** `doorSentence` prefers the door's `error` whenever it's a non-empty, non-code-shaped string, **even beside a code**. Settings' 500 `{error: "Could not save.", code: "save-failed"}` keeps saying `Could not save.` (spec §7: every existing string unchanged). This supersedes deviation 8's last sentence.
    - **(c)** In Settings' agent cards, `load` is guarded (try/catch, timeout) and `patch` releases `busy` in a `finally`. An unknown press always ends showing `Couldn’t tell if that saved.`, followed by `Could not load settings.` when the re-read also failed (F3 review).
    - **(d)** The queue (F4 review):
      - A refused decision whose card the re-read no longer lists (a 409 for an expired item, or a 404) moves its reason to a top line, `{kind:"refused", reason}`, so a refusal can never look like a success.
      - The re-read reports whether it landed; a card is settled only by a re-read that landed.
      - Edit text is kept per card.
      - A top line is replaced only by a newer non-null line.
      - A load-sequence guard drops stale re-reads.
      - An unknown retry shows the `Couldn’t tell if that went through.` line.
      - The q-link hands focus to its filter button.
      - **Safety:** after a card leaves, focus goes to the next *card* (`tabIndex=-1`), not its Approve button, so a repeated Enter can never approve another draft. This refines spec §6's "the next card's first button".
      - A stale quiet re-read (one whose filter was left) is dropped before it claims a sequence number.
    - **(e)** Adds (F2 review):
      - **Focus:** `reopen` focuses Title whenever focus would otherwise fall to `<body>`.
      - **Never silent:** `reopen` reads LayoutEditor's live epoch and editing state (refs written in handlers). When the form can't open (edit mode, or too narrow), the failure sentence goes under the tile's head instead, and the draft keeps it.
      - **The mark** sits on its own line, in a `.pe-said` under the row, the way row sentences already sit; in a week item it wraps under the title.
      - **Hiding:** only the three true empty sentences (`nothing open`, `Nothing scheduled.`, `Nothing due.`, marked `.is-none`) are hidden beside a stand-in, never a real `.fl-empty` line.
      - **Unread day:** on an unread day the stand-in stays on the label's row.
    - **(f)** Principal review:
      - **First open:** the outline carries a static, CSS-only copy of the bar (`.ol-navbar`), hidden while the live bar is on. Dehydrated Suspense fallbacks never mount on the client, so `LoadingSignal`'s effect can't run on first open. This makes deviation 2's "also runs on first open" true, with one limit: inside the Personal grid, whose tiles are inline-size containers (pinning a fixed element to the tile), the static bar is hidden. So on a hard load's calendar wait, the tiles' own bars say "loading" and no top bar shows.
      - **Queue loads:** a loud load clears `loading` only if it's the latest loud load. The list GET has a timeout. A retry's failure sits on its card. Busy state is per card. Retry is refused through `aria-disabled`.
      - **Agent switches:** they go busy through `aria-disabled` (L9). `legacy.css`'s disabled dim also matches `[aria-disabled="true"]`.
      - **Personal outline:** it holds the head pills' room.

---

## File structure

**New**
- `src/lib/navProgress.ts`: the bar's count (external store). Pure, client-safe, no imports.
- `src/lib/doorSentence.ts`: the words for a definite failure: the door's sentence, else pressOutcome's.
- `src/lib/personalLayoutMemory.ts`: parses and serialises the remembered Personal arrangement.
- `src/lib/instantSwitch.ts`: what a switch shows while busy, and after an answer.
- `src/lib/standIns.ts`: the stand-in type, its lifecycle and where it shows.
- `src/lib/queueOutcome.ts`: what a decide answer means for the card and the top line.
- `src/styles/feel.css`: the bar and outline styles.
- `src/app/(app)/_shell/NavProgress.tsx`: `NavProgress` (the bar), `LoadingSignal`, `LinkPending`.
- `src/app/(app)/_shell/Outline.tsx`: `OutlineBars`, `CardsOutline`.
- `src/app/(app)/personal/RememberLayout.tsx`: writes the server's arrangement to `localStorage`.
- `src/app/(app)/personal/PersonalOutline.tsx`: the Personal outline, drawn from the remembered arrangement.
- `src/app/(app)/personal/StandInRows.tsx`: the faded rows.
- `src/app/(app)/personal/loading.tsx`, `src/app/(app)/freelance/loading.tsx`, `src/app/(app)/freelance/queue/loading.tsx`, `src/app/(app)/settings/loading.tsx`.

**Modified:** the root and `(app)` layouts; `NavList`, `ViewSwitch` and `SettingsLine` (link signal); `personal/page.tsx` (RememberLayout); the Today/Week/Layers fallbacks (bars); `LayoutEditor` (stand-in state); `Todos`/`Today`/`Week` (place stand-ins); `TodoForm`/`EventForm` (adds close on press); `CalendarPicker`/`AgentSwitches`/`LayerSwitches` (instant switches); the queue page; `personal.css` and `legacy.css` (one appended section each).

---

## F1 · Outlines and the top bar

### Task T1: The loading count and the door's words (Store Keeper)

**Files:**
- Create: `src/lib/navProgress.ts`, `src/lib/doorSentence.ts`
- Test: `src/lib/__tests__/navProgress.test.ts`, `src/lib/__tests__/doorSentence.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/navProgress.test.ts`:

```ts
/**
 * navProgress.test.ts — the top bar's count (smooth-feel spec §3.2,
 * deviation 2): loading while any load is open, ended once per end.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { beginLoading, isLoading, resetLoadingForTests, subscribeLoading } from "@/lib/navProgress";

beforeEach(() => resetLoadingForTests());

describe("navProgress", () => {
  it("starts idle", () => {
    expect(isLoading()).toBe(false);
  });

  it("one load is loading until it ends", () => {
    const end = beginLoading();
    expect(isLoading()).toBe(true);
    end();
    expect(isLoading()).toBe(false);
  });

  it("overlapping loads keep it loading until the last one ends", () => {
    const a = beginLoading();
    const b = beginLoading();
    a();
    expect(isLoading()).toBe(true);
    b();
    expect(isLoading()).toBe(false);
  });

  it("an end called twice ends its load once", () => {
    const a = beginLoading();
    const b = beginLoading();
    a();
    a();
    expect(isLoading()).toBe(true);
    b();
    expect(isLoading()).toBe(false);
  });

  it("tells subscribers on every change, and stops after unsubscribing", () => {
    const fn = vi.fn();
    const off = subscribeLoading(fn);
    const end = beginLoading();
    end();
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    beginLoading();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
```

`src/lib/__tests__/doorSentence.test.ts`:

```ts
/**
 * doorSentence.test.ts — a definite failure's words: the door's own
 * sentence when it wrote one, else pressOutcome's (plan deviation 8).
 */
import { describe, it, expect } from "vitest";
import { doorSentence } from "@/lib/doorSentence";

describe("doorSentence", () => {
  it("a sentence-only body says the door's sentence", () => {
    const body = { error: "Item is no longer pending (already decided or expired)." };
    expect(doorSentence({ kind: "failed", code: null, sentence: "Couldn’t save.", body })).toBe(
      "Item is no longer pending (already decided or expired).",
    );
  });

  it("a body with a code says pressOutcome's sentence for it", () => {
    const body = { error: "Could not save.", code: "save-failed" };
    expect(doorSentence({ kind: "failed", code: "save-failed", sentence: "Couldn’t save.", body })).toBe(
      "Couldn’t save.",
    );
  });

  it("an unknown code says pressOutcome's fallback", () => {
    expect(
      doorSentence({ kind: "failed", code: "weird-code", sentence: "Couldn’t save.", body: { error: "weird-code" } }),
    ).toBe("Couldn’t save.");
  });

  it("an empty or missing error says pressOutcome's sentence", () => {
    expect(doorSentence({ kind: "failed", code: null, sentence: "Couldn’t save.", body: { error: "  " } })).toBe(
      "Couldn’t save.",
    );
    expect(doorSentence({ kind: "failed", code: null, sentence: "Couldn’t save.", body: null })).toBe(
      "Couldn’t save.",
    );
  });
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run src/lib/__tests__/navProgress.test.ts src/lib/__tests__/doorSentence.test.ts`
Expected: FAIL. Both modules can't be resolved (`Failed to resolve import "@/lib/navProgress"`).

- [ ] **Step 3: Write the modules**

`src/lib/navProgress.ts`:

```ts
/**
 * navProgress.ts — the top bar's one source of truth (smooth-feel spec §3.2,
 * plan deviation 2). Client-safe, no imports.
 *
 * A COUNT, not a flag: every loading outline, every Suspense fallback and
 * every pending in-app link calls beginLoading() and later the end function
 * it returns, so overlapping loads (the Personal page's outline, then its
 * three calendar fallbacks) keep the bar up until the last one ends.
 *
 * Module state is per browser tab. Nothing here runs on the server: callers
 * use it from effects only, and NavProgress reads it through
 * useSyncExternalStore with a server snapshot of `false`.
 */

let active = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

/** One load began. Returns its end; calling the end twice ends it once. */
export function beginLoading(): () => void {
  active += 1;
  emit();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    active -= 1;
    emit();
  };
}

export function isLoading(): boolean {
  return active > 0;
}

export function subscribeLoading(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Tests only: no loads and no listeners. */
export function resetLoadingForTests(): void {
  active = 0;
  listeners.clear();
}
```

`src/lib/doorSentence.ts`:

```ts
/**
 * doorSentence.ts — the words for a definite failure (plan deviation 8).
 *
 * pressOutcome (L7) answers a sentence-only body (`{error: "…"}`, no code)
 * with the caller's fallback, `Couldn’t save.` — right for the Personal
 * islands, whose doors speak in codes. Settings' agent cards and the queue
 * have always shown the door's own sentence (`Item is no longer pending
 * (already decided or expired).`, the /api/settings 400s); this keeps them
 * doing so. A body with a code still says pressOutcome's sentence for it.
 * Client-safe: a type-only import.
 */
import type { PressOutcome } from "@/lib/pressOutcome";

type Failed = Extract<PressOutcome, { kind: "failed" }>;

export function doorSentence(out: Failed): string {
  if (out.code === null && typeof out.body === "object" && out.body !== null) {
    const { error } = out.body as { error?: unknown };
    if (typeof error === "string" && error.trim() !== "") return error;
  }
  return out.sentence;
}
```

- [ ] **Step 4: Run them to confirm they pass**

Run: `npx vitest run src/lib/__tests__/navProgress.test.ts src/lib/__tests__/doorSentence.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git commit -m "feat(feel): navProgress count and doorSentence" -m "Claude-Session: https://claude.ai/code/session_01Mn421oryCACSpH3NzRgoxw" -- src/lib/navProgress.ts src/lib/doorSentence.ts src/lib/__tests__/navProgress.test.ts src/lib/__tests__/doorSentence.test.ts
```

(New files: `git add` them first, then the pathspec commit. A pathspec commit only takes tracked paths.)

---

### Task T2: The bar, its signals and the outline pieces (Shell Builder)

Requires T1. JSX only, with no unit test (the repo has no component tests). The Verification Lead measures it in T15.

**Files:**
- Create: `src/styles/feel.css`, `src/app/(app)/_shell/NavProgress.tsx`, `src/app/(app)/_shell/Outline.tsx`
- Modify: `src/app/layout.tsx` (one import), `src/app/(app)/layout.tsx`, `src/app/(app)/_shell/NavList.tsx`, `src/app/(app)/freelance/ViewSwitch.tsx`, `src/app/(app)/personal/_blocks/SettingsLine.tsx`

- [ ] **Step 1: Confirm the hook exists in this Next**

Run: `grep -n "useLinkStatus" node_modules/next/dist/client/app-dir/link.d.ts`
Expected: `export declare const useLinkStatus: () => {` (line ~200). If it's missing, stop and report to the lead. The fallback in spec §3.2 then applies.

- [ ] **Step 2: Write `src/styles/feel.css`**

```css
/* ============================================================
   feel.css — the smooth-feel layer (docs/superpowers/specs/
   2026-10-11-smooth-feel-design.md §3): the top bar and the loading
   outlines. No new colour — the outline bars are --track, the system's
   one non-hue graphic token, and the bar is --ink-2 — and no @media
   rule: base.css's global prefers-reduced-motion rule stills the pulse
   and the bar's growth, and every state below still reads with
   animation and transition both off (the bar then shows at once at
   80% while loading and vanishes when done).
   ============================================================ */

/* ---- the top bar (spec §3.2; plan deviations 1, 2) ------------- */
.navbar{
  position:fixed;top:0;left:0;z-index:100;height:2px;width:100%;
  background:var(--ink-2);opacity:0;pointer-events:none;
  transition:opacity .2s ease;
}
.navbar[data-on="true"]{
  opacity:1;width:80%;transition:none;
  animation:navbar-grow 2.4s cubic-bezier(.1,.7,.3,1) both,navbar-in 0s linear .15s both;
}
/* not a progress measure: it eases towards 80% and holds there */
@keyframes navbar-grow{from{width:0}to{width:80%}}
/* invisible for the first 150ms, so a fast navigation never flashes it */
@keyframes navbar-in{from{opacity:0}to{opacity:1}}

/* ---- outlines (spec §3.1) -------------------------------------- */
/* grey bars where text will go — never a number, a word of content or
   a fake row */
.ol-bars{display:grid;gap:8px;margin-top:var(--sp-3)}
.ol-bar{
  display:block;height:9px;border-radius:var(--r-tag);background:var(--track);
  animation:ol-pulse 1.8s ease-in-out infinite;
}
.ol-bar.w90{width:90%}
.ol-bar.w70{width:70%}
.ol-bar.w50{width:50%}
@keyframes ol-pulse{0%,100%{opacity:.6}50%{opacity:1}}
/* holds a control's room without being one (plan deviation 11) */
.ol-ghost{visibility:hidden}
/* screen-reader only: the outline's one `Loading…` status */
.ol-sr{
  position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;
  overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;
}
```

- [ ] **Step 3: Import it in the root layout**

In `src/app/layout.tsx`, add the line after `import "../styles/briefing.css";`, so the imports read:

```ts
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/components.css";
import "../styles/personal.css";
import "../styles/briefing.css";
import "../styles/feel.css";
import "../styles/legacy.css";
```

- [ ] **Step 4: Write `src/app/(app)/_shell/NavProgress.tsx`**

```tsx
"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLinkStatus } from "next/link";
import { beginLoading, isLoading, subscribeLoading } from "@/lib/navProgress";

/**
 * The top bar and its two signals (smooth-feel spec §3.2, plan deviation 2).
 *
 *   NavProgress   the 2px bar, mounted once in the (app) layout. It reads
 *                 navProgress's count; it never measures progress.
 *   LoadingSignal rendered inside every loading outline and Suspense
 *                 fallback: while it is mounted, something is loading.
 *                 That is the signal that matters on a dynamic route — a
 *                 prefetched loading.tsx commits the navigation at once,
 *                 and from then on only the outline knows the page is
 *                 still coming. `announce` adds the outline's one
 *                 screen-reader `Loading…`; fallbacks stay silent.
 *   LinkPending   a child of an in-app <Link>: covers the moment before an
 *                 outline exists (a route not yet prefetched).
 *
 * The effects touch only navProgress — an external store — and never set
 * React state, so the lint baseline is unchanged.
 */
export default function NavProgress() {
  const on = useSyncExternalStore(subscribeLoading, isLoading, () => false);
  return <div className="navbar" data-on={on ? "true" : "false"} aria-hidden="true" />;
}

export function LoadingSignal({ announce = false }: { announce?: boolean }) {
  useEffect(() => beginLoading(), []);
  return announce ? (
    <span className="ol-sr" role="status">
      Loading…
    </span>
  ) : null;
}

export function LinkPending() {
  const { pending } = useLinkStatus();
  useEffect(() => (pending ? beginLoading() : undefined), [pending]);
  return null;
}
```

- [ ] **Step 5: Write `src/app/(app)/_shell/Outline.tsx`**

```tsx
import { LoadingSignal } from "./NavProgress";

/**
 * The outline pieces every page's loading state shares (smooth-feel spec
 * §3.1). No "use client": a server component where a loading.tsx renders it,
 * and part of the client bundle where a client island (the queue, Settings'
 * agent cards) imports it — it holds no state and no server import.
 *
 * AN OUTLINE NEVER HOLDS CONTENT. Fixed labels and headings may show (they
 * are the page's frame); figures, names, counts and rows never do, so a
 * loading box can never be mistaken for `nothing there`.
 */

const WIDTHS = ["w90", "w70", "w50"] as const;

/** Grey bars where text will go. aria-hidden: the outline's one status says `Loading…`. */
export function OutlineBars({ lines = 3 }: { lines?: number }) {
  return (
    <span className="ol-bars" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={`ol-bar ${WIDTHS[i % WIDTHS.length]}`} />
      ))}
    </span>
  );
}

/**
 * The legacy pages' cards in outline (Settings, the queue): each card's fixed
 * label when it has one, then bars. `null` is a card with no label.
 */
export function CardsOutline({ labels }: { labels: readonly (string | null)[] }) {
  return (
    <div aria-busy="true">
      <LoadingSignal announce />
      {labels.map((label, i) => (
        <div className="card" key={i}>
          {label !== null && <p className="meta">{label}</p>}
          <OutlineBars />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Mount the bar in the `(app)` layout**

In `src/app/(app)/layout.tsx`, add the import after `import BriefingSlot from "./_shell/BriefingSlot";`:

```ts
import NavProgress from "./_shell/NavProgress";
```

and make the return:

```tsx
  return (
    <div className="app">
      <NavProgress />
      <div className="app-body">
        <Rail />
        <div className="app-main">
          <TopBar greeting={<BriefingSlot />} />
          {children}
        </div>
      </div>
    </div>
  );
```

Append to the docblock above `AppLayout` (before its closing `*/`):

```
 *
 * NavProgress is the top bar (smooth-feel spec §3.2): fixed, outside the
 * flow, so it adds no box to the shell's layout.
```

- [ ] **Step 7: Put `LinkPending` in every in-app link**

`src/app/(app)/_shell/NavList.tsx`: change the import to `import Link from "next/link";` plus a new line `import { LinkPending } from "./NavProgress";`, and the link's children to:

```tsx
            <Icon />
            {label}
            <LinkPending />
```

`src/app/(app)/freelance/ViewSwitch.tsx`: add `import { LinkPending } from "../_shell/NavProgress";`, and make the link's children:

```tsx
            {label}
            <LinkPending />
```

`src/app/(app)/personal/_blocks/SettingsLine.tsx`: add `import { LinkPending } from "../../_shell/NavProgress";` and change the link to:

```tsx
      {text.slice(0, -tail.length)}{" "}
      <Link href="/settings">
        Settings
        <LinkPending />
      </Link>
      .
```

(The visible text is unchanged: `… Settings.`, with the same single space before the link. `LinkPending` renders nothing.)

- [ ] **Step 8: Type-check, test and commit**

```bash
npx tsc --noEmit
npm test
git add src/styles/feel.css "src/app/(app)/_shell/NavProgress.tsx" "src/app/(app)/_shell/Outline.tsx"
git commit -m "feat(feel): top bar, loading signals and outline pieces" -m "Claude-Session: https://claude.ai/code/session_01Mn421oryCACSpH3NzRgoxw" -- src/styles/feel.css src/app/layout.tsx "src/app/(app)/layout.tsx" "src/app/(app)/_shell/NavProgress.tsx" "src/app/(app)/_shell/Outline.tsx" "src/app/(app)/_shell/NavList.tsx" "src/app/(app)/freelance/ViewSwitch.tsx" "src/app/(app)/personal/_blocks/SettingsLine.tsx"
```

---

### Task T3: The Personal outline and its remembered arrangement (Layout Rememberer)

Requires T2.

**Files:**
- Create: `src/lib/personalLayoutMemory.ts`, `src/lib/__tests__/personalLayoutMemory.test.ts`, `src/app/(app)/personal/RememberLayout.tsx`, `src/app/(app)/personal/PersonalOutline.tsx`, `src/app/(app)/personal/loading.tsx`
- Modify: `src/app/(app)/personal/page.tsx`, `src/app/(app)/personal/_blocks/Today.tsx`, `src/app/(app)/personal/_blocks/Week.tsx`, `src/app/(app)/personal/_blocks/Layers.tsx`

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/personalLayoutMemory.test.ts`:

```ts
/**
 * personalLayoutMemory.test.ts — the outline's arrangement (smooth-feel
 * spec §3.1): whatever this browser remembered, read total — anything
 * unreadable is the default, never a throw.
 */
import { describe, it, expect } from "vitest";
import { PERSONAL_LAYOUT_DEFAULT } from "@/lib/personalLayout";
import { layoutFromMemory, rememberedLayoutText } from "@/lib/personalLayoutMemory";

const CUSTOM = [
  [{ tile: "week", span: 12 }],
  [{ tile: "today", span: 6 }, { tile: "todos", span: 6 }],
  [{ tile: "layers", span: 12 }],
  [{ tile: "done", span: 12 }],
] as const;

describe("layoutFromMemory", () => {
  it("nothing remembered is the default", () => {
    expect(layoutFromMemory(null)).toBe(PERSONAL_LAYOUT_DEFAULT);
  });

  it("text that is not JSON is the default", () => {
    expect(layoutFromMemory("{")).toBe(PERSONAL_LAYOUT_DEFAULT);
  });

  it("a remembered arrangement round-trips", () => {
    expect(layoutFromMemory(rememberedLayoutText(CUSTOM))).toEqual(CUSTOM);
  });

  it("a retired tile is dropped and the rest kept", () => {
    const withPush = JSON.stringify([
      [{ tile: "week", span: 12 }],
      [{ tile: "today", span: 6 }, { tile: "todos", span: 6 }],
      [{ tile: "layers", span: 8 }, { tile: "push", span: 4 }],
      [{ tile: "done", span: 12 }],
    ]);
    expect(layoutFromMemory(withPush)).toEqual([
      [{ tile: "week", span: 12 }],
      [{ tile: "today", span: 6 }, { tile: "todos", span: 6 }],
      [{ tile: "layers", span: 8 }],
      [{ tile: "done", span: 12 }],
    ]);
  });
});

describe("rememberedLayoutText", () => {
  it("writes only tile and span", () => {
    const noisy = [[{ tile: "today", span: 12, extra: 1 }]] as unknown as Parameters<typeof rememberedLayoutText>[0];
    expect(rememberedLayoutText(noisy)).toBe('[[{"tile":"today","span":12}]]');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/__tests__/personalLayoutMemory.test.ts`
Expected: FAIL. `@/lib/personalLayoutMemory` doesn't resolve.

- [ ] **Step 3: Write `src/lib/personalLayoutMemory.ts`**

```ts
/**
 * personalLayoutMemory.ts — the Personal page's last arrangement as this
 * browser remembers it, so the page's loading outline can draw the right
 * grid before the server has answered (smooth-feel spec §3.1). A per-device
 * convenience, never the record: the server's arrangement wins the moment
 * the page lands, so a stale or missing copy costs one layout shift.
 *
 * Pure; the localStorage calls live in RememberLayout and PersonalOutline,
 * wrapped in try/catch there (storage can throw in private mode or with
 * blocked site data). Read TOTAL through resolvePersonalLayout — the same
 * rule as the stored layout's read path — so anything unreadable is the
 * default and a retired tile is dropped, never a throw.
 */
import {
  PERSONAL_LAYOUT_DEFAULT,
  resolvePersonalLayout,
  type ReadonlyPersonalLayout,
} from "@/lib/personalLayout";

export const LAYOUT_MEMORY_KEY = "personal-layout:v1";

/** Only tile and span, so nothing else a layout object carries is ever written. */
export function rememberedLayoutText(layout: ReadonlyPersonalLayout): string {
  return JSON.stringify(layout.map((row) => row.map((e) => ({ tile: e.tile, span: e.span }))));
}

export function layoutFromMemory(raw: string | null): ReadonlyPersonalLayout {
  if (raw === null) return PERSONAL_LAYOUT_DEFAULT;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return PERSONAL_LAYOUT_DEFAULT;
  }
  return resolvePersonalLayout(parsed).layout;
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run src/lib/__tests__/personalLayoutMemory.test.ts`
Expected: PASS, 5 tests. If "a retired tile…" fails because `resolvePersonalLayout` reshapes the row differently, **don't change the expectation to match**. Read `resolveLayoutAgainst` in `personalLayout.ts`, report what it does to the lead, and stop.

- [ ] **Step 5: Write `src/app/(app)/personal/RememberLayout.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import type { ReadonlyPersonalLayout } from "@/lib/personalLayout";
import { LAYOUT_MEMORY_KEY, rememberedLayoutText } from "@/lib/personalLayoutMemory";

/**
 * Writes the server's arrangement to this browser whenever a render changes
 * it, for the loading outline (smooth-feel spec §3.1). The page renders this
 * only when the arrangement was READ (never its fallen-back default), so a
 * settings outage never overwrites a good memory. The effect writes storage
 * and never sets state. Storage that throws leaves nothing remembered, and
 * the outline draws the default.
 */
export default function RememberLayout({ layout }: { layout: ReadonlyPersonalLayout }) {
  const text = rememberedLayoutText(layout);
  useEffect(() => {
    try {
      window.localStorage.setItem(LAYOUT_MEMORY_KEY, text);
    } catch {
      // Nothing remembered: the outline falls back to the default.
    }
  }, [text]);
  return null;
}
```

- [ ] **Step 6: Write `src/app/(app)/personal/PersonalOutline.tsx`**

```tsx
"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import { buildCells, buildTracks, type PersonalTile } from "@/lib/personalLayout";
import { LAYOUT_MEMORY_KEY, layoutFromMemory } from "@/lib/personalLayoutMemory";
import { LoadingSignal } from "../_shell/NavProgress";
import { OutlineBars } from "../_shell/Outline";

/**
 * The Personal page's outline (smooth-feel spec §3.1): LayoutEditor's normal
 * view with every tile reduced to its border, ground, eyebrow and bars —
 * the same .fl-head band, the same .pe-grid tracks and cells, so nothing
 * jumps when the real tiles arrive. The arrangement is the one this browser
 * remembered (RememberLayout), else the default.
 *
 * useSyncExternalStore with a server snapshot of null: the first-open HTML
 * draws the default, hydration then swaps in the remembered grid; a soft
 * navigation draws the remembered grid at once. The hero is untinted on
 * purpose — the to-do read has not answered (R83).
 */

const LABELS: Readonly<Record<PersonalTile, string>> = {
  today: "Today",
  todos: "To-do",
  layers: "Layers",
  week: "Next 7 days",
  done: "Done this week",
};

function readMemory(): string | null {
  try {
    return window.localStorage.getItem(LAYOUT_MEMORY_KEY);
  } catch {
    return null;
  }
}

function subscribeStorage(fn: () => void): () => void {
  window.addEventListener("storage", fn);
  return () => window.removeEventListener("storage", fn);
}

export default function PersonalOutline() {
  const raw = useSyncExternalStore(subscribeStorage, readMemory, () => null);
  const layout = layoutFromMemory(raw);
  const cells = buildCells(layout, false);
  const gridStyle = { "--tracks": buildTracks(layout, false) } as CSSProperties;

  return (
    <>
      <div className="fl-head">
        <div className="fl">
          <div className="fl-headrow">
            <h1 className="fl-title">Personal</h1>
            <span className="btn ol-ghost" aria-hidden="true">
              Edit layout
            </span>
          </div>
        </div>
      </div>
      <main className="app-content" aria-busy="true">
        <LoadingSignal announce />
        <div className="fl">
          <div>
            <div className="pe-wrap">
              <div className="pe-grid" style={gridStyle}>
                {cells.map((cell) =>
                  cell.tile === null ? null : (
                    <div key={cell.tile} className={`pe-cell ${cell.rowClass} ${cell.spanClass} ${cell.collapsedClass}`}>
                      <section className={cell.tile === "today" ? "pe-tile is-hero" : "pe-tile"}>
                        <div className="pe-head">
                          <div>
                            <span className="eyebrow">{LABELS[cell.tile]}</span>
                          </div>
                        </div>
                        <div className="pe-body">
                          <OutlineBars lines={cell.tile === "today" || cell.tile === "week" ? 3 : 2} />
                        </div>
                      </section>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 7: Write `src/app/(app)/personal/loading.tsx`**

```tsx
import PersonalOutline from "./PersonalOutline";

/** The Personal page's outline while its server render runs (smooth-feel spec §3.1). */
export default function Loading() {
  return <PersonalOutline />;
}
```

- [ ] **Step 8: Remember the arrangement from the page**

In `src/app/(app)/personal/page.tsx`, add `import RememberLayout from "./RememberLayout";` after `import LayoutEditor from "./LayoutEditor";`, and wrap the returned `<LayoutEditor … />` in a fragment:

```tsx
  return (
    <>
      {/* smooth-feel §3.1: only an arrangement that was READ is remembered. */}
      {!fellBack && <RememberLayout layout={layout} />}
      <LayoutEditor
        …every existing prop, unchanged…
      />
    </>
  );
```

(Keep every existing `LayoutEditor` prop and comment exactly as it is. Only the fragment and the one line are new.)

- [ ] **Step 9: Bars and the loading signal in the three calendar fallbacks**

In each fallback the existing head stays. Add a body with bars and a silent `LoadingSignal` after the head, so the bar keeps running while the calendar streams.

`src/app/(app)/personal/_blocks/Today.tsx`: add imports `import { LoadingSignal } from "../../_shell/NavProgress";` and `import { OutlineBars } from "../../_shell/Outline";`. `TodayFallback` becomes:

```tsx
export function TodayFallback({ dateLabel, heroTint }: { dateLabel: string; heroTint: TodayView["heroTint"] }) {
  return (
    <section className={heroClass(heroTint)}>
      <TileHead tile="today">
        <div>
          <span className="eyebrow">Today</span>
          <h2 className="fl-h">{dateLabel}</h2>
        </div>
      </TileHead>
      <div className="pe-body">
        <OutlineBars />
      </div>
      <LoadingSignal />
    </section>
  );
}
```

Append to its docblock: ` * Bars where the groups will be, and a silent LoadingSignal so the top bar runs until the calendar lands (smooth-feel §3.1) — still no sentence, count or control.`

`src/app/(app)/personal/_blocks/Week.tsx`: same two imports; `WeekFallback` becomes:

```tsx
export function WeekFallback() {
  return (
    <section className="pe-tile">
      <TileHead>
        <div>
          <span className="eyebrow">Next 7 days</span>
        </div>
      </TileHead>
      <div className="pe-body">
        <OutlineBars />
      </div>
      <LoadingSignal />
    </section>
  );
}
```

`src/app/(app)/personal/_blocks/Layers.tsx`: same two imports; `LayersFallback` becomes:

```tsx
export function LayersFallback() {
  return (
    <section className="pe-tile">
      <TileHead>
        <div>
          <span className="eyebrow">Layers</span>
        </div>
      </TileHead>
      <div className="pe-body">
        <OutlineBars lines={2} />
      </div>
      <LoadingSignal />
    </section>
  );
}
```

Update each of the two fallback docblocks that say "border, ground and eyebrow, nothing else" or "border, ground and eyebrow — no day rows": they now end `…, and bars (smooth-feel §3.1) — no rows, no `—`, nothing a measurement could say.`

- [ ] **Step 10: Type-check, test and commit**

```bash
npx tsc --noEmit
npm test
git add src/lib/personalLayoutMemory.ts src/lib/__tests__/personalLayoutMemory.test.ts "src/app/(app)/personal/RememberLayout.tsx" "src/app/(app)/personal/PersonalOutline.tsx" "src/app/(app)/personal/loading.tsx"
git commit -m "feat(feel): Personal outline from the remembered arrangement" -m "Claude-Session: https://claude.ai/code/session_01Mn421oryCACSpH3NzRgoxw" -- src/lib/personalLayoutMemory.ts src/lib/__tests__/personalLayoutMemory.test.ts "src/app/(app)/personal/RememberLayout.tsx" "src/app/(app)/personal/PersonalOutline.tsx" "src/app/(app)/personal/loading.tsx" "src/app/(app)/personal/page.tsx" "src/app/(app)/personal/_blocks/Today.tsx" "src/app/(app)/personal/_blocks/Week.tsx" "src/app/(app)/personal/_blocks/Layers.tsx"
```

---

### Task T4: Freelance, queue and Settings outlines (Outline Builder)

Requires T2. Parallel with T3 (disjoint files).

**Files:**
- Create: `src/app/(app)/freelance/loading.tsx`, `src/app/(app)/freelance/queue/loading.tsx`, `src/app/(app)/settings/loading.tsx`

- [ ] **Step 1: `src/app/(app)/freelance/loading.tsx`**

The segment layout (`<h1>Freelance</h1>` and the view switch) stays on screen; this replaces only the page under it.

```tsx
import { LoadingSignal } from "../_shell/NavProgress";
import { OutlineBars } from "../_shell/Outline";

/**
 * /freelance's outline (smooth-feel spec §3.1): the hero row's three cards
 * with their fixed labels, the state-of-play box, and the four sections'
 * eyebrows and headings — the page's frame, with bars where every figure,
 * name and row will be. The health strip is left out (plan deviation 11).
 * The labels are the view model's fixed ones (freelanceView.ts).
 */

const CARDS = ["Drafts", "Contacts", "Needs you"] as const;

const SECTIONS = [
  ["Pipeline", "Your pipeline"],
  ["Campaigns", "Your campaigns"],
  ["Approach performance", "Your approaches"],
  ["Needs you", "Waiting on you"],
] as const;

export default function Loading() {
  return (
    <main className="app-content" aria-busy="true">
      <LoadingSignal announce />
      <div className="fl">
        <div className="fl-body">
          <div className="stats">
            {CARDS.map((label) => (
              <div className="stat" key={label}>
                <div className="stat-top">
                  <span className="lbl">{label}</span>
                </div>
                <OutlineBars lines={2} />
              </div>
            ))}
          </div>
          <div className="fl-say">
            <OutlineBars />
          </div>
        </div>
        {SECTIONS.map(([eyebrow, heading]) => (
          <section className="fl-sect" key={heading}>
            <span className="eyebrow">{eyebrow}</span>
            <h2 className="fl-h">{heading}</h2>
            <OutlineBars />
          </section>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: `src/app/(app)/freelance/queue/loading.tsx`**

Without this, the segment's `freelance/loading.tsx` would draw the dashboard's outline over a queue navigation.

```tsx
import { CardsOutline } from "../../_shell/Outline";

/** The queue's outline (smooth-feel spec §3.1, §6): two unlabelled cards. Overrides the dashboard's outline above it. */
export default function Loading() {
  return (
    <main>
      <CardsOutline labels={[null, null]} />
    </main>
  );
}
```

- [ ] **Step 3: `src/app/(app)/settings/loading.tsx`**

```tsx
import { CardsOutline } from "../_shell/Outline";

/** /settings' outline (smooth-feel spec §3.1): its four cards' fixed labels, in page order. */
export default function Loading() {
  return (
    <main>
      <CardsOutline labels={["Follow-up chaser", "Monitoring", "Google Calendar", "Calendar layers"]} />
    </main>
  );
}
```

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit
git add "src/app/(app)/freelance/loading.tsx" "src/app/(app)/freelance/queue/loading.tsx" "src/app/(app)/settings/loading.tsx"
git commit -m "feat(feel): Freelance, queue and Settings outlines" -m "Claude-Session: https://claude.ai/code/session_01Mn421oryCACSpH3NzRgoxw" -- "src/app/(app)/freelance/loading.tsx" "src/app/(app)/freelance/queue/loading.tsx" "src/app/(app)/settings/loading.tsx"
```

---

### Task T5: F1 review (Opus)

- [ ] **Step 1:** Spec + quality review of T1–T4 together. Brief: "Read spec §3 and plan deviations 1, 2 and 11. Then read the files T1–T4 created or changed. Look for:
  - an outline holding a digit, a name or a row (anything that isn't a fixed label);
  - an outline whose boxes don't match the real page's (`pe-cell`/`pe-grid` classes, `.stats`, `.fl-sect`);
  - a `LoadingSignal` that can outlive its outline;
  - more than one `announce` status per outline;
  - `beginLoading` called anywhere but an effect;
  - any setState in an effect;
  - `new Date()` or a ref read during render;
  - `localStorage` touched outside try/catch;
  - `RememberLayout` writing a fallen-back default;
  - `SettingsLine`'s visible text changed;
  - any new `@media` rule or colour.

  Report; don't edit." Fix rounds go to T2/T3/T4's builder.

---

## F3 · Instant switches

### Task T6: Switches flip on press (Switch Builder)

Requires T1 and T2.

**Files:**
- Create: `src/lib/instantSwitch.ts`, `src/lib/__tests__/instantSwitch.test.ts`
- Modify: `src/app/(app)/settings/_blocks/CalendarPicker.tsx`, `src/app/(app)/settings/_blocks/AgentSwitches.tsx`, `src/app/(app)/personal/LayerSwitches.tsx`

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/instantSwitch.test.ts`:

```ts
/**
 * instantSwitch.test.ts — a switch flips on press and flips back only on a
 * definite failure (smooth-feel spec §5); the server's render decides once
 * the press and its re-read are done.
 */
import { describe, it, expect } from "vitest";
import { movedAfter, shownOn } from "@/lib/instantSwitch";

describe("shownOn", () => {
  it("while busy, the pressed switch shows where it was moved", () => {
    expect(shownOn("a", false, { key: "a", on: true }, true)).toBe(true);
  });
  it("another switch shows the server's position", () => {
    expect(shownOn("b", false, { key: "a", on: true }, true)).toBe(false);
  });
  it("once not busy, every switch shows the server's position", () => {
    expect(shownOn("a", false, { key: "a", on: true }, false)).toBe(false);
  });
  it("nothing moved: the server's position", () => {
    expect(shownOn("a", true, null, true)).toBe(true);
  });
});

describe("movedAfter", () => {
  const moved = { key: "a", on: true };
  it("a definite failure returns the switch", () => {
    expect(movedAfter("failed", moved)).toBeNull();
  });
  it("ok keeps it until the re-read lands", () => {
    expect(movedAfter("ok", moved)).toBe(moved);
  });
  it("no answer keeps it: the press may have landed", () => {
    expect(movedAfter("unknown", moved)).toBe(moved);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/__tests__/instantSwitch.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/lib/instantSwitch.ts`**

```ts
/**
 * instantSwitch.ts — the one rule for a switch that saves on press
 * (smooth-feel spec §5): it flips at once; a DEFINITE failure (pressOutcome's
 * `failed`, L7) flips it back; ok and no-answer keep it where Riku put it
 * until the press's re-read lands, and from then on the server's position is
 * shown. LayerSwitches has behaved this way since P10c; CalendarPicker and
 * Settings' agent cards now share it. Client-safe: a type-only import.
 */
import type { PressOutcome } from "@/lib/pressOutcome";

/** The pressed switch and where the press moved it. */
export interface Moved<K extends string = string> {
  key: K;
  on: boolean;
}

/** What a switch shows: the moved position while its press and re-read are in flight, else the server's. */
export function shownOn<K extends string>(key: K, serverOn: boolean, moved: Moved<K> | null, busy: boolean): boolean {
  return busy && moved !== null && moved.key === key ? moved.on : serverOn;
}

/** After the door answers: a definite failure returns the switch; ok and unknown keep it. */
export function movedAfter<K extends string>(kind: PressOutcome["kind"], moved: Moved<K> | null): Moved<K> | null {
  return kind === "failed" ? null : moved;
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run src/lib/__tests__/instantSwitch.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: `LayerSwitches` takes the shared rule (no behaviour change)**

In `src/app/(app)/personal/LayerSwitches.tsx`:
- add `import { movedAfter, shownOn, type Moved } from "@/lib/instantSwitch";`;
- change the state to `const [moved, setMoved] = useState<Moved | null>(null);`;
- in `press`, `setMoved({ calendarId: row.calendarId, enabled });` becomes `setMoved({ key: row.calendarId, on: enabled });`;
- `if (out.kind === "failed") setMoved(null); // the knob returns (deck §6 Tile 3)` becomes `setMoved((m) => movedAfter(out.kind, m)); // a definite failure returns the knob (deck §6 Tile 3)`;
- in the render, `const on = busy && moved?.calendarId === row.calendarId ? moved.enabled : row.enabled;` becomes `const on = shownOn(row.calendarId, row.enabled, moved, busy);`.

Append to the docblock: ` * The knob's rule is instantSwitch.ts's, shared with Settings (smooth-feel §5).`

- [ ] **Step 6: `CalendarPicker` flips on press**

In `src/app/(app)/settings/_blocks/CalendarPicker.tsx`:

Add `import { movedAfter, shownOn, type Moved } from "@/lib/instantSwitch";` and, after the `said` state, `const [moved, setMoved] = useState<Moved | null>(null);`.

In `press`, after the `pickerToggle` refusal branch and `setSaving(true); setSaid(null);`, add `setMoved({ key: row.calendarId, on: !row.ticked });`. After the `pressOutcome` call, replace the `if (out.kind !== "ok") …` line with:

```ts
    setMoved((m) => movedAfter(out.kind, m)); // a definite failure returns the tick (smooth-feel §5)
    if (out.kind !== "ok") setSaid({ calendarId: row.calendarId, text: out.sentence }); // deck §9, §15
```

In the render, inside `rows.map`, compute `const ticked = shownOn(row.calendarId, row.ticked, moved, busy);`. Use `ticked` for `aria-checked={ticked}` and `{ticked && (<svg…/>)}`. (The map callback becomes a block with `return`.)

Replace the docblock paragraph that begins `Nothing flips locally (R21)` with:

```
 * The tick flips on the tap (smooth-feel spec §5, instantSwitch.ts — this
 * supersedes R21's "nothing flips locally" for switches): a definite failure
 * flips it back with `Couldn't save.`; no answer leaves it where it was put
 * with `Couldn't tell if that saved.`; once the refresh lands the tick shows
 * what the server read. The next tap builds from `stored`, so if a refresh
 * fails to land, that tap is last-write-wins over stale data (accepted,
 * §7.5). A refusal made before any request (`Up to 10 calendars.`) never
 * flips.
```

- [ ] **Step 7: Settings' agent cards flip on press**

Replace `src/app/(app)/settings/_blocks/AgentSwitches.tsx` with:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { PRESS_TIMEOUT_MS } from "@/lib/constants";
import { doorSentence } from "@/lib/doorSentence";
import { movedAfter, shownOn, type Moved } from "@/lib/instantSwitch";
import { pressOutcome } from "@/lib/pressOutcome";
import { CardsOutline } from "../../_shell/Outline";

interface Settings {
  chaserEnabled: boolean;
  chaserNDays: number;
  monitoringEnabled: boolean;
}

type SwitchKey = "chaserEnabled" | "monitoringEnabled";

/** The door's success body, checked before it is trusted (pressOutcome hands it back unvalidated). */
function settingsOf(body: unknown): Settings | null {
  if (typeof body !== "object" || body === null) return null;
  const s = (body as { settings?: unknown }).settings;
  if (typeof s !== "object" || s === null) return null;
  const { chaserEnabled, chaserNDays, monitoringEnabled } = s as Record<string, unknown>;
  if (typeof chaserEnabled !== "boolean" || typeof chaserNDays !== "number" || typeof monitoringEnabled !== "boolean") {
    return null;
  }
  return { chaserEnabled, chaserNDays, monitoringEnabled };
}

/**
 * P3's two agent cards. Smooth feel (spec §5, instantSwitch.ts): the chaser
 * and monitoring buttons flip on press — the button's word and `Currently
 * on/off` follow at once — and pressOutcome (L7) decides what the answer
 * means: ok shows the door's settings; a definite failure flips back with the
 * door's sentence (doorSentence); no answer keeps the flip, says `Couldn't
 * tell if that saved.`, and re-reads, so the server decides where it sits.
 * The threshold's Save is not a switch and does not flip. While loading, the
 * two cards draw as their outline (spec §3.1).
 *
 * The mount-time load in an effect is one of the four baseline lint errors
 * and keeps its shape on purpose.
 */
export default function AgentSwitches() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [days, setDays] = useState("4");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [moved, setMoved] = useState<Moved<SwitchKey> | null>(null);

  /** true when the read landed. */
  const load = useCallback(async (): Promise<boolean> => {
    setError(null);
    const res = await fetch("/api/settings");
    if (res.status === 401) {
      window.location.href = "/login?from=/settings";
      return false;
    }
    if (!res.ok) {
      setError("Could not load settings.");
      return false;
    }
    const body = (await res.json()) as { settings: Settings };
    setSettings(body.settings);
    setDays(String(body.settings.chaserNDays));
    return true;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(payload: Record<string, unknown>, flip: Moved<SwitchKey> | null = null) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    setMoved(flip);
    const out = await pressOutcome(
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }),
    );
    setMoved((m) => movedAfter(out.kind, m));
    if (out.kind === "ok") {
      const next = settingsOf(out.body);
      if (next !== null) {
        setSettings(next);
        setDays(String(next.chaserNDays));
        setSaved("Saved.");
      } else {
        await load(); // a success body this card can't read: re-read rather than guess
      }
    } else if (out.kind === "failed") {
      setError(doorSentence(out));
    } else {
      // No answer: the press may have landed. The re-read decides the switch.
      const read = await load();
      if (read) setError(out.sentence);
    }
    setMoved(null);
    setBusy(false);
  }

  if (!settings) {
    return (
      <>
        {error && <p className="error">{error}</p>}
        {!error && <CardsOutline labels={["Follow-up chaser", "Monitoring"]} />}
      </>
    );
  }

  const chaserOn = shownOn("chaserEnabled", settings.chaserEnabled, moved, busy);
  const monitoringOn = shownOn("monitoringEnabled", settings.monitoringEnabled, moved, busy);

  return (
    <>
      {error && <p className="error">{error}</p>}
      {saved && <p className="meta">{saved}</p>}

      <div className="card">
        <p className="meta">Follow-up chaser</p>
        <p>
          Currently <strong>{chaserOn ? "on" : "off"}</strong>. When on, it runs
          once each morning, drafts a reply for every lead who answered and got no response,
          and queues each one here for approval. It never sends anything by itself.
        </p>
        <div className="row">
          <button
            disabled={busy}
            className={chaserOn ? "danger" : ""}
            onClick={() => void patch({ chaserEnabled: !chaserOn }, { key: "chaserEnabled", on: !chaserOn })}
          >
            {chaserOn ? "Turn the chaser off" : "Turn the chaser on"}
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <label htmlFor="days">
            Chase a lead once they have waited this many days (1–30)
          </label>
          <input
            id="days"
            type="number"
            min={1}
            max={30}
            step={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
          <div className="row">
            <button
              disabled={busy || days === String(settings.chaserNDays)}
              onClick={() => void patch({ chaserNDays: Number(days) })}
            >
              Save threshold
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="meta">Monitoring</p>
        <p>
          Currently <strong>{monitoringOn ? "on" : "off"}</strong>. When on, each
          morning it checks that every agent actually ran, that the client sites are up, and
          sends you one summary — even when nothing is wrong, so a missing notification is
          itself a warning. Turning it off silences that summary. Stale queue items are still
          cleared either way, and you are still told if that clean-up fails or leaves an
          approved action it could not confirm.
        </p>
        <div className="row">
          <button
            disabled={busy}
            className={monitoringOn ? "danger" : ""}
            onClick={() =>
              void patch({ monitoringEnabled: !monitoringOn }, { key: "monitoringEnabled", on: !monitoringOn })
            }
          >
            {monitoringOn ? "Turn monitoring off" : "Turn monitoring on"}
          </button>
        </div>
      </div>
    </>
  );
}
```

(Every visible string is the P3 card's own: the paragraphs, the labels, `Saved.`, `Could not load settings.`. The only new words are pressOutcome's `Couldn’t tell if that saved.`.)

- [ ] **Step 8: Type-check, test, lint and commit**

```bash
npx tsc --noEmit
npm test
npm run lint
```
Expected for lint: exit 1 with exactly 4 `react-hooks/set-state-in-effect` errors and 3 warnings, the same as the baseline.

```bash
git add src/lib/instantSwitch.ts src/lib/__tests__/instantSwitch.test.ts
git commit -m "feat(feel): switches flip on press (calendar picker, agent cards)" -m "Claude-Session: https://claude.ai/code/session_01Mn421oryCACSpH3NzRgoxw" -- src/lib/instantSwitch.ts src/lib/__tests__/instantSwitch.test.ts "src/app/(app)/settings/_blocks/CalendarPicker.tsx" "src/app/(app)/settings/_blocks/AgentSwitches.tsx" "src/app/(app)/personal/LayerSwitches.tsx"
```

### Task T7: F3 review (Opus)

- [ ] **Step 1:** Brief: "Read spec §5, §7 and plan deviations 8–9, then T6's diff. Look for:
  - a switch that flips back on `unknown`;
  - a switch that stays flipped after its re-read lands;
  - `busy` dropping before the re-read (CalendarPicker's useTransition, AgentSwitches' awaited load);
  - a refusal made before the request that flips;
  - a changed P3 string;
  - the lint count moving;
  - LayerSwitches' behaviour changing.

  Report; don't edit."

---

## F2 · Instant adds

### Task T8: The stand-in rules (Stand-in Clerk)

Requires nothing from F1 (a pure module), but runs after F1 by the feature order.

**Files:**
- Create: `src/lib/standIns.ts`, `src/lib/__tests__/standIns.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/standIns.test.ts`:

```ts
/**
 * standIns.test.ts — an add's faded stand-in (smooth-feel spec §4, plan
 * deviations 3, 5, 6): in flight until the door answers, then settled or
 * dropped; a server render removes only settled ones; each tile finds only
 * the stand-ins that belong in it.
 */
import { describe, it, expect } from "vitest";
import {
  afterServerRender,
  dropStandIn,
  nextStandInKey,
  putStandIn,
  settleStandIn,
  standInTime,
  standInsAt,
  type EventStandIn,
  type StandIn,
  type TodoStandIn,
} from "@/lib/standIns";

const todo = (over: Partial<TodoStandIn> = {}): TodoStandIn => ({
  kind: "todo",
  key: "standin:t",
  title: "Renew ID",
  section: "personal",
  dueOn: null,
  due: null,
  mark: "saving",
  inFlight: true,
  ...over,
});

const event = (over: Partial<EventStandIn> = {}): EventStandIn => ({
  kind: "event",
  key: "standin:e",
  title: "Dentist",
  calendarName: "Personal",
  dayKey: "2026-10-11",
  allDay: false,
  start: "09:00",
  end: "10:00",
  mark: "saving",
  inFlight: true,
  ...over,
});

describe("the lifecycle", () => {
  it("put adds, and a second put with the same key replaces", () => {
    const a = putStandIn([], todo());
    expect(a).toHaveLength(1);
    expect(putStandIn(a, todo({ title: "Other" }))).toEqual([todo({ title: "Other" })]);
  });

  it("settle marks it and takes it out of flight", () => {
    const [s] = settleStandIn([todo()], "standin:t", "unknown");
    expect(s).toMatchObject({ mark: "unknown", inFlight: false });
  });

  it("settle and drop of an unknown key return the same list", () => {
    const list: readonly StandIn[] = [todo()];
    expect(settleStandIn(list, "nope", "saving")).toBe(list);
    expect(dropStandIn(list, "nope")).toBe(list);
  });

  it("drop removes it", () => {
    expect(dropStandIn([todo(), event()], "standin:t")).toEqual([event()]);
  });

  it("a server render removes settled stand-ins and keeps in-flight ones", () => {
    const settled = todo({ inFlight: false });
    expect(afterServerRender([settled, event()])).toEqual([event()]);
  });

  it("a server render with nothing settled returns the same list", () => {
    const list: readonly StandIn[] = [todo(), event()];
    expect(afterServerRender(list)).toBe(list);
  });

  it("keys are unique", () => {
    expect(nextStandInKey()).not.toBe(nextStandInKey());
  });
});

describe("standInsAt", () => {
  const today = "2026-10-11";
  const list: StandIn[] = [
    todo({ key: "a", section: "academics", dueOn: "2026-10-11" }),
    todo({ key: "b", section: "personal", dueOn: "2026-10-09" }),
    todo({ key: "c", section: "personal", dueOn: "2026-10-14" }),
    todo({ key: "d", section: "freelance", dueOn: null }),
    event({ key: "e", dayKey: "2026-10-11" }),
    event({ key: "f", dayKey: "2026-10-14" }),
  ];
  const keys = (s: StandIn[]) => s.map((x) => x.key);

  it("the To-do tile: its section's to-dos, dated or not", () => {
    expect(keys(standInsAt(list, { tile: "todos", section: "personal" }))).toEqual(["b", "c"]);
    expect(keys(standInsAt(list, { tile: "todos", section: "freelance" }))).toEqual(["d"]);
  });

  it("Today's DUE group: to-dos due today or earlier", () => {
    expect(keys(standInsAt(list, { tile: "today", group: "due", today }))).toEqual(["a", "b"]);
  });

  it("Today's SCHEDULED group: events on today", () => {
    expect(keys(standInsAt(list, { tile: "today", group: "scheduled", today }))).toEqual(["e"]);
  });

  it("a week day: to-dos due and events on that day", () => {
    expect(keys(standInsAt(list, { tile: "week", day: "2026-10-14" }))).toEqual(["c", "f"]);
  });
});

describe("standInTime", () => {
  it("a Today row shows the range, a week item the start", () => {
    expect(standInTime(event(), "row")).toBe("09:00–10:00");
    expect(standInTime(event(), "item")).toBe("09:00");
  });
  it("all day either way", () => {
    expect(standInTime(event({ allDay: true }), "row")).toBe("all day");
    expect(standInTime(event({ allDay: true }), "item")).toBe("all day");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/__tests__/standIns.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/lib/standIns.ts`**

```ts
/**
 * standIns.ts — the faded rows an add shows before the server confirms it
 * (smooth-feel spec §4; plan deviations 3, 5, 6). Pure and client-safe.
 *
 * A stand-in is CLIENT STATE ONLY: never sent anywhere, never stored, gone on
 * reload, and always replaced by the server's render. It carries what its row
 * needs to draw and nothing that could be mistaken for a record.
 *
 * LIFECYCLE — the hidden set's rule (LayoutEditor): put IN FLIGHT on the
 * press; the door's answer either DROPS it at once (a definite failure — the
 * form reopens with what was typed) or SETTLES it (ok, or no answer, with its
 * mark); the first server render after it settled removes it, whatever that
 * render holds (deviation 5). A render that lands while it is still in flight
 * (another island's refresh) cannot remove it.
 */
import type { DayKey } from "@/lib/days";

export type StandInSection = "personal" | "freelance" | "academics";
export type StandInMark = "saving" | "unknown";

interface Common {
  key: string;
  title: string;
  mark: StandInMark;
  inFlight: boolean;
}

export interface TodoStandIn extends Common {
  kind: "todo";
  section: StandInSection;
  dueOn: DayKey | null;
  /** The due chip, worked out in the press handler (todos.ts's dueChip), so render stays pure. */
  due: { text: string; late: boolean } | null;
}

export interface EventStandIn extends Common {
  kind: "event";
  calendarName: string;
  dayKey: DayKey;
  allDay: boolean;
  /** "HH:MM", as the event form holds them. */
  start: string;
  end: string;
}

export type StandIn = TodoStandIn | EventStandIn;

/** Where a tile draws stand-ins: each group or day that can hold one. */
export type StandInPlace =
  | { tile: "todos"; section: StandInSection }
  | { tile: "today"; group: "scheduled" | "due"; today: DayKey }
  | { tile: "week"; day: DayKey };

/** The words beside a stand-in's title (spec §4). */
export const STAND_IN_MARK: Readonly<Record<StandInMark, string>> = {
  saving: "saving",
  unknown: "couldn’t tell if that saved",
};

export const SECTION_LABEL: Readonly<Record<StandInSection, string>> = {
  personal: "Personal",
  freelance: "Freelance",
  academics: "Academics",
};

let seq = 0;

/** A key no other stand-in in this tab has. Called in handlers only. */
export function nextStandInKey(): string {
  seq += 1;
  return `standin:${seq}`;
}

export function putStandIn(list: readonly StandIn[], s: StandIn): StandIn[] {
  return [...list.filter((x) => x.key !== s.key), s];
}

export function settleStandIn(list: readonly StandIn[], key: string, mark: StandInMark): readonly StandIn[] {
  if (!list.some((x) => x.key === key)) return list;
  return list.map((x) => (x.key === key ? { ...x, mark, inFlight: false } : x));
}

export function dropStandIn(list: readonly StandIn[], key: string): readonly StandIn[] {
  return list.some((x) => x.key === key) ? list.filter((x) => x.key !== key) : list;
}

/** A new server render: settled stand-ins leave, in-flight ones stay. The same list when nothing leaves. */
export function afterServerRender(list: readonly StandIn[]): readonly StandIn[] {
  return list.some((x) => !x.inFlight) ? list.filter((x) => x.inFlight) : list;
}

function belongs(s: StandIn, place: StandInPlace): boolean {
  if (place.tile === "todos") return s.kind === "todo" && s.section === place.section;
  if (place.tile === "today") {
    if (place.group === "due") return s.kind === "todo" && s.dueOn !== null && s.dueOn <= place.today;
    return s.kind === "event" && s.dayKey === place.today;
  }
  return s.kind === "todo" ? s.dueOn === place.day : s.dayKey === place.day;
}

/** The stand-ins that belong in one group or day, in the order they were added. */
export function standInsAt(list: readonly StandIn[], place: StandInPlace): StandIn[] {
  return list.filter((s) => belongs(s, place));
}

/** An event stand-in's time: the range in a Today row, the start in a week item; `all day` either way. */
export function standInTime(s: EventStandIn, where: "row" | "item"): string {
  if (s.allDay) return "all day";
  return where === "row" ? `${s.start}–${s.end}` : s.start;
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run src/lib/__tests__/standIns.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/lib/standIns.ts src/lib/__tests__/standIns.test.ts
git commit -m "feat(feel): stand-in rules for instant adds" -m "Claude-Session: https://claude.ai/code/session_01Mn421oryCACSpH3NzRgoxw" -- src/lib/standIns.ts src/lib/__tests__/standIns.test.ts
```

---

### Task T9: The page holds the stand-ins (Page-State Builder)

Requires T8.

**Files:**
- Modify: `src/app/(app)/personal/LayoutEditor.tsx`

- [ ] **Step 1: Import the rules**

After `import { pressOutcome } from "@/lib/pressOutcome";` add:

```ts
import {
  afterServerRender,
  dropStandIn as dropFrom,
  putStandIn as putInto,
  settleStandIn as settleIn,
  type StandIn,
  type StandInMark,
} from "@/lib/standIns";
```

- [ ] **Step 2: Extend `PageState`**

Add to the `PageState` interface, after `forgetTodoDraft`:

```ts
  /**
   * The adds still showing as faded stand-ins (smooth-feel spec §4,
   * standIns.ts). The hidden set's rule: put in flight on the press,
   * settled or dropped when the door answers, removed by the first server
   * render after settling.
   */
  standIns: readonly StandIn[];
  putStandIn: (s: StandIn) => void;
  settleStandIn: (key: string, mark: StandInMark) => void;
  dropStandIn: (key: string) => void;
```

Extend the `PageContext` default value with:

```ts
  standIns: [],
  putStandIn: noop,
  settleStandIn: noop,
  dropStandIn: noop,
```

- [ ] **Step 3: The state, and the server render ending settled stand-ins**

Directly after `const [entries, setEntries] = useState<ReadonlyMap<HiddenKey, boolean>>(() => new Map());` — **above** the `seenStamp` block, which calls its setter during render (declaring it below that block is a temporal-dead-zone ReferenceError on the first render with a new stamp) — add:

```ts
  const [standIns, setStandIns] = useState<readonly StandIn[]>([]);
```

Inside the existing `if (seenStamp !== stamp) { … }` block, after the `setEntries(…)` call, add:

```ts
    setStandIns((l) => afterServerRender(l)); // the same list when nothing settled, so no extra render
```

Append to the comment above that block: ` It also retires every settled stand-in (smooth-feel §4).`

- [ ] **Step 4: Expose them on the state object**

In `const state: PageState = { … }`, after `forgetTodoDraft: …`, add:

```ts
    standIns,
    putStandIn: (s) => setStandIns((l) => putInto(l, s)),
    settleStandIn: (key, mark) => setStandIns((l) => settleIn(l, key, mark)),
    dropStandIn: (key) => setStandIns((l) => dropFrom(l, key)),
```

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
npm test
git commit -m "feat(feel): LayoutEditor holds the page's stand-ins" -m "Claude-Session: https://claude.ai/code/session_01Mn421oryCACSpH3NzRgoxw" -- "src/app/(app)/personal/LayoutEditor.tsx"
```

---

### Task T10: Draw the stand-ins where they belong (Row Placer)

Requires T9.

**Files:**
- Create: `src/app/(app)/personal/StandInRows.tsx`
- Modify: `src/styles/personal.css` (append), `src/app/(app)/personal/_blocks/Todos.tsx`, `src/app/(app)/personal/_blocks/Today.tsx`, `src/app/(app)/personal/_blocks/Week.tsx`

- [ ] **Step 1: Write `src/app/(app)/personal/StandInRows.tsx`**

```tsx
"use client";

import {
  SECTION_LABEL,
  STAND_IN_MARK,
  standInTime,
  standInsAt,
  type EventStandIn,
  type StandIn,
  type StandInPlace,
  type TodoStandIn,
} from "@/lib/standIns";
import { usePersonalPage } from "./LayoutEditor";

/**
 * The faded rows of adds still saving (smooth-feel spec §4), placed by each
 * tile beside its own server-rendered rows, in the shapes those rows use:
 * `.pe-row.is-item` for a to-do, `.pe-row.is-sched` for a Today event,
 * `.pe-it` inside a week day.
 *
 * A STAND-IN HAS NO CONTROL (plan deviation 3): no tick button, no link —
 * it cannot be ticked, edited or followed while it saves. The tick's box is
 * a plain span, aria-hidden. Each row says its mark in words (`saving` /
 * `couldn’t tell if that saved`), so the fade never carries meaning alone.
 *
 * The server's own empty sentence in the same group (`nothing open`,
 * `Nothing scheduled.`, `Nothing due.`, a day's `—`) is hidden by CSS while a
 * stand-in sits beside it (personal.css, `:has(.pe-standins)`).
 */
export default function StandInRows({ place }: { place: StandInPlace }) {
  const { standIns } = usePersonalPage();
  const shown = standInsAt(standIns, place);
  if (shown.length === 0) return null;
  if (place.tile === "week") {
    return (
      <span className="pe-items pe-standins">
        {shown.map((s) => (
          <WeekItem key={s.key} s={s} />
        ))}
      </span>
    );
  }
  return (
    <div className="pe-rows pe-standins">
      {shown.map((s) =>
        s.kind === "todo" ? (
          <TodoRowStandIn key={s.key} s={s} tag={place.tile === "today"} />
        ) : (
          <EventRowStandIn key={s.key} s={s} />
        ),
      )}
    </div>
  );
}

function Mark({ s }: { s: StandIn }) {
  return <span className="pe-on">{STAND_IN_MARK[s.mark]}</span>;
}

function TodoRowStandIn({ s, tag }: { s: TodoStandIn; tag: boolean }) {
  return (
    <div className="pe-row is-item is-standin">
      <span className="tick" aria-hidden="true" />
      <span className="pe-nm">{s.title}</span>
      {tag && <span className="tag">{SECTION_LABEL[s.section]}</span>}
      <Mark s={s} />
      {s.due !== null && <span className={s.due.late ? "pe-due is-late" : "pe-due"}>{s.due.text}</span>}
    </div>
  );
}

function EventRowStandIn({ s }: { s: EventStandIn }) {
  return (
    <div className="pe-row is-sched is-standin">
      <span className="pe-time">{standInTime(s, "row")}</span>
      <span className="pe-nm">
        {s.title} <Mark s={s} />
      </span>
      <span className="tag is-layer">{s.calendarName}</span>
    </div>
  );
}

function WeekItem({ s }: { s: StandIn }) {
  return (
    <span className="pe-it is-standin">
      {s.kind === "event" && <span className="pe-t">{standInTime(s, "item")}</span>}
      <span>{s.title}</span>
      <span className="pe-l">· {s.kind === "event" ? s.calendarName : SECTION_LABEL[s.section]}</span>
      <Mark s={s} />
    </span>
  );
}
```

- [ ] **Step 2: Append the stand-in rules to `src/styles/personal.css`**

At the very end of the file:

```css

/* ---- stand-ins (smooth-feel spec §4; plan deviation 3) ----------- */
/* An add still saving: its row's own shape, faded, with its mark in
   words. Client state only — the next server render replaces it. */
.is-standin{opacity:.55}
/* after the group's real rows, the first stand-in keeps the hairline */
.pe-rows + .pe-standins>.pe-row:first-child{border-top:1px solid var(--line-soft)}
/* the group's empty sentence would contradict the row beside it */
.fl-group:has(.pe-standins)>.fl-empty{display:none}
.fl-empty + .pe-standins{margin-top:var(--sp-3)}
/* a week day: the stand-ins sit in the items' column, under the items,
   or in the dash's place on a day that read as empty */
.pe-row.is-day>.pe-standins{grid-column:2}
.pe-row.is-day:has(>.pe-standins)>.pe-dash{display:none}
.pe-row.is-day:has(>.pe-dash)>.pe-standins{grid-row:1}
```

- [ ] **Step 3: Place them in the To-do tile**

In `src/app/(app)/personal/_blocks/Todos.tsx`, add `import StandInRows from "../StandInRows";`. Inside each section's `.fl-group`, after the rows/empty conditional and before the `section.bound` line:

```tsx
          {/* smooth-feel §4: an add still saving, in its section */}
          <StandInRows place={{ tile: "todos", section: section.key }} />
```

- [ ] **Step 4: Place them in Today**

In `src/app/(app)/personal/_blocks/Today.tsx`, add `import StandInRows from "../StandInRows";`. In `scheduled`, as the last child of its `.fl-group` (after the `s.kind === "rows"` block):

```tsx
      <StandInRows place={{ tile: "today", group: "scheduled", today: eventForm.today }} />
```

In `due`, as the last child of its `.fl-group`:

```tsx
      <StandInRows place={{ tile: "today", group: "due", today: eventForm.today }} />
```

- [ ] **Step 5: Place them in a week day**

In `src/app/(app)/personal/_blocks/Week.tsx`, add `import StandInRows from "../StandInRows";`. In `Day`, after `{cellFor(dayShape(row), row, labelId)}`:

```tsx
      <StandInRows place={{ tile: "week", day: row.key }} />
```

Append to `Day`'s docblock: ` * An add still saving (smooth-feel §4) sits after the cell, in its column (personal.css).`

- [ ] **Step 6: Type-check and commit**

```bash
npx tsc --noEmit
npm test
git add "src/app/(app)/personal/StandInRows.tsx"
git commit -m "feat(feel): stand-in rows in To-do, Today and Next 7 days" -m "Claude-Session: https://claude.ai/code/session_01Mn421oryCACSpH3NzRgoxw" -- "src/app/(app)/personal/StandInRows.tsx" src/styles/personal.css "src/app/(app)/personal/_blocks/Todos.tsx" "src/app/(app)/personal/_blocks/Today.tsx" "src/app/(app)/personal/_blocks/Week.tsx"
```

---

### Task T11: Adds close on press (Form Builder)

Requires T10.

**Files:**
- Modify: `src/app/(app)/personal/TodoForm.tsx`, `src/app/(app)/personal/EventForm.tsx`

- [ ] **Step 1: TodoForm imports**

Change `import type { DayKey } from "@/lib/days";` to `import { todayKey, type DayKey } from "@/lib/days";`. Add:

```ts
import { nextStandInKey } from "@/lib/standIns";
import { dueChip } from "@/lib/todos";
```

- [ ] **Step 2: The add form can be reopened by an answer**

In `ViewProps`, the add branch becomes:

```ts
  | {
      mode: "add";
      formId: string;
      titleRef: RefObject<HTMLInputElement | null>;
      /** A definite failure after the form closed on press: open it again (smooth-feel §4). */
      reopen: () => void;
    }
```

In `TodoTile`, after `toggle`, add:

```ts
  /**
   * smooth-feel §4: an add closes on press; a DEFINITE failure opens the form
   * again with the draft and its sentence. Focus moves into Title only from
   * the pill or from nowhere — never from wherever Riku has gone since (S2).
   */
  function reopen() {
    if (!formCapable) return;
    const at = document.activeElement;
    const take = at === null || at === document.body || at === pill.current;
    flushSync(() => setOpenAt(page.editEpoch));
    if (take) title.current?.focus();
  }
```

and pass it on: `<TodoFormView mode="add" … close={close} reopen={reopen} />`.

- [ ] **Step 3: The add press in `submit`**

Replace everything in `submit` from `page.press(tile);` to the end of the function with:

```ts
    page.press(tile);
    const kind: Sending = props.mode === "add" ? "add" : "save";
    update((d) => ({ ...d, sending: kind, said: null }));
    // smooth-feel §4: an ADD closes at once and shows a faded stand-in
    // wherever the to-do belongs. The draft keeps `sending`, so the pill
    // refuses to reopen the form, and no second send can start, until the
    // door answers.
    let standIn: string | null = null;
    if (props.mode === "add") {
      standIn = nextStandInKey();
      const dueOn = hasDue ? values.due : null;
      page.putStandIn({
        kind: "todo",
        key: standIn,
        title,
        section: values.section,
        dueOn,
        due: dueChip(dueOn, todayKey(new Date())),
        mark: "saving",
        inFlight: true,
      });
      close(true);
    }
    const out = await pressOutcome(
      fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }),
    );

    if (out.kind === "ok") {
      const line = leg === null ? null : calendarLine(leg, calendarOf(out.body));
      if (props.mode === "add") {
        if (standIn !== null) page.settleStandIn(standIn, "saving");
        close(false, false); // forgets the draft; the form closed on press
      } else {
        const focus = focusStillIn(formRef.current);
        close(false, focus && !leaves);
        if (focus && leaves) props.focusPill();
      }
      if (line !== null) page.note(tile, line);
    } else if (out.kind === "failed") {
      update((d) => ({ ...d, sending: false, said: out.sentence }));
      if (props.mode === "add") {
        if (standIn !== null) page.dropStandIn(standIn);
        props.reopen(); // what was typed, with the door's sentence
      }
    } else if (props.mode === "add" || leg === "pin") {
      update((d) => ({ ...d, sending: false, parked: true, said: null }));
      if (standIn !== null) {
        page.settleStandIn(standIn, "unknown");
        page.note(tile, { text: ERROR_SENTENCES["calendar-unknown"], dot: null }); // the form is closed: say it under the head
      }
    } else {
      update((d) => ({ ...d, sending: false, said: out.sentence }));
    }
    router.refresh();
  }
```

Update the docblock's OUTCOMES block. Its `ok` line becomes:

```
 *   ok       the form closes, the draft is forgotten, the page re-reads. An
 *            ADD closed already, on the press (smooth-feel §4): its faded
 *            stand-in shows wherever the to-do belongs until the re-read
 *            replaces it. A calendar leg that did not finish says so under
 *            the tile's head with the `--stale` dot (R49: a claim about Google).
 *   failed   the sentence sits above the buttons; the form keeps everything.
 *            An add's stand-in leaves and its form opens again.
```

Add to the `unknown` line: ` An add's stand-in says it couldn’t tell, and so does the tile's head.`

- [ ] **Step 4: EventForm, in the same way**

Add `import { nextStandInKey } from "@/lib/standIns";`.

In `EventTile`, after `toggle`, add:

```ts
  /** smooth-feel §4: a definite failure after the form closed on press opens it again (S2 for focus, as TodoTile). */
  function reopen() {
    if (!canOpen) return;
    const at = document.activeElement;
    const take = at === null || at === document.body || at === pill.current;
    flushSync(() => setOpenAt(page.editEpoch));
    if (take) title.current?.focus();
  }
```

and pass `reopen={reopen}` to `<EventFormView … />`. In `EventFormView`, add the prop `reopen: () => void;` to its props type (with the doc comment `/** A definite failure after the form closed on press: open it again (smooth-feel §4). */`) and to the destructuring.

In `submit`, replace from `const dayKey = draft.dayKey;` to the end of the function with:

```ts
    const dayKey = draft.dayKey;
    page.press("today");
    update((d) => ({ ...d, sending: true, said: null }));
    // smooth-feel §4: the form closes at once and the event shows faded
    // where the page shows that day (Today, or its row in Next 7 days; a day
    // outside the week has no place, plan deviation 6). The draft keeps
    // `sending`, so the pill refuses a second send until the door answers.
    const standIn = nextStandInKey();
    page.putStandIn({
      kind: "event",
      key: standIn,
      title,
      calendarName: form.calendars.find((c) => c.calendarId === calendarId)?.name ?? "",
      dayKey,
      allDay: draft.allDay,
      start: draft.start,
      end: draft.end,
      mark: "saving",
      inFlight: true,
    });
    close(true);
    const out = await pressOutcome(
      fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          draft.allDay
            ? { title, calendarId, dayKey, allDay: true }
            : { title, calendarId, dayKey, allDay: false, start: draft.start, end: draft.end },
        ),
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }),
    );

    if (out.kind === "ok") {
      page.settleStandIn(standIn, "saving");
      close(false, false); // forgets the draft; the form closed on press
      // The page shows today (Tile 1) and today+1 … today+7 (Tile 5); anything else would vanish silently.
      if (dayKey < form.today || dayKey > addDays(form.today, 7)) {
        page.note("today", { text: `Added. It’s on ${formatDay(dayKey)}, outside this week.`, dot: null }); // deck §15
      }
    } else if (out.kind === "failed") {
      page.dropStandIn(standIn);
      const cal = out.code === "calendar-failed" ? calendarOf(out.body) : null;
      const said =
        cal !== null && cal.kind === "failed"
          ? eventFailSentence(cal.cause) // S21, spec §7.4
          : out.sentence;
      update((d) => ({ ...d, sending: false, said }));
      reopen(); // what was typed, with Google's reason
    } else {
      update((d) => ({ ...d, sending: false, parked: true, said: null }));
      page.settleStandIn(standIn, "unknown");
      page.note("today", { text: NO_ANSWER, dot: null }); // plan deviation 4: the form's own words, under the head
    }
    router.refresh();
  }
```

Update the docblock's THE OUTCOMES block:
- `ok`: "the form closed on the press (smooth-feel §4), the faded stand-in shows in Today or the day's row until the re-read replaces it; …"
- `refused`: append "The stand-in leaves and the form opens again."
- `no answer`: append "The form is closed by then, so the sentence also sits under the tile's head; the stand-in says it couldn’t tell."

- [ ] **Step 5: Type-check, test, lint and commit**

```bash
npx tsc --noEmit
npm test
npm run lint
```
Expected for lint: the baseline exactly (4 errors, 3 warnings).

```bash
git commit -m "feat(feel): to-do and event adds close on press with a stand-in" -m "Claude-Session: https://claude.ai/code/session_01Mn421oryCACSpH3NzRgoxw" -- "src/app/(app)/personal/TodoForm.tsx" "src/app/(app)/personal/EventForm.tsx"
```

### Task T12: F2 review (Opus)

- [ ] **Step 1:** Brief: "Read spec §4, §7 and plan deviations 3–6, then T8–T11 together. Look for:
  - a stand-in that survives the render after it settled, or vanishes while in flight;
  - a failure that leaves a stand-in;
  - an unknown add that can be sent twice: the draft must park, and the pill must refuse while `sending`;
  - `reopen` stealing focus from somewhere Riku moved to;
  - the form closing for an EDIT (it must not);
  - a stand-in with a button or a link;
  - a group's empty sentence showing beside a stand-in;
  - a stand-in in the wrong tile, section or day;
  - `new Date()` outside a handler;
  - the calendar-pin note lost on an add's ok;
  - any changed string other than deviation 4's placement;
  - the lint count moving.

  Report; don't edit."

---

## F4 · The queue

### Task T13: The card leaves at once (Queue Builder)

Requires T1 and T2.

**Files:**
- Create: `src/lib/queueOutcome.ts`, `src/lib/__tests__/queueOutcome.test.ts`
- Modify: `src/app/(app)/freelance/queue/page.tsx`, `src/styles/legacy.css` (append)

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/queueOutcome.test.ts`:

```ts
/**
 * queueOutcome.test.ts — what a decide answer means once the card has left
 * (smooth-feel spec §6; plan deviations 7, 8).
 */
import { describe, it, expect } from "vitest";
import { FILTER_LABEL, QUEUE_LINES, decideResult } from "@/lib/queueOutcome";

const ok = (item: unknown) => ({ kind: "ok", body: { item } }) as const;

describe("decideResult", () => {
  it("an approval whose action finished: nothing more", () => {
    expect(decideResult(ok({ status: "approved", actionStatus: "done" }))).toEqual({ restore: false, top: null });
  });

  it("a reject: nothing more", () => {
    expect(decideResult(ok({ status: "rejected", actionStatus: "pending" }))).toEqual({ restore: false, top: null });
  });

  it("an approval whose draft didn't reach ShikksTracker: the action-failed line, under its filter", () => {
    expect(decideResult(ok({ status: "approved", actionStatus: "failed" }))).toEqual({
      restore: false,
      top: { kind: "action-failed", filter: "approved" },
    });
    expect(decideResult(ok({ status: "edited_approved", actionStatus: "failed" }))).toEqual({
      restore: false,
      top: { kind: "action-failed", filter: "edited_approved" },
    });
  });

  it("an approval that can't be told: the needs-verification line", () => {
    expect(decideResult(ok({ status: "approved", actionStatus: "needs_verification" }))).toEqual({
      restore: false,
      top: { kind: "needs-verification", filter: "approved" },
    });
  });

  it("a 2xx without an item: nothing more (the decision saved)", () => {
    expect(decideResult({ kind: "ok", body: {} })).toEqual({ restore: false, top: null });
  });

  it("a refused decision brings the card back with the door's words", () => {
    const body = { error: "Item is no longer pending (already decided or expired)." };
    expect(decideResult({ kind: "failed", code: null, sentence: "Couldn’t save.", body })).toEqual({
      restore: true,
      reason: "Item is no longer pending (already decided or expired).",
    });
  });

  it("no answer: the couldn't-tell line, and the card stays gone", () => {
    expect(decideResult({ kind: "unknown", sentence: "Couldn’t tell if that saved." })).toEqual({
      restore: false,
      top: { kind: "unknown" },
    });
  });
});

describe("the words (Riku, 2026-10-11)", () => {
  it("read as approved, with the filter's name between lead and tail", () => {
    expect(`${QUEUE_LINES.actionFailed.lead}${FILTER_LABEL.approved}${QUEUE_LINES.actionFailed.tail}`).toBe(
      "Approved, but the draft didn’t reach ShikksTracker. It’s under Approved, with a retry.",
    );
    expect(
      `${QUEUE_LINES.needsVerification.lead}${FILTER_LABEL.approved}${QUEUE_LINES.needsVerification.tail}`,
    ).toBe(
      "Approved, but I can’t tell if the draft reached ShikksTracker. It’s under Approved. Check there before doing anything else.",
    );
    expect(QUEUE_LINES.unknown).toBe("Couldn’t tell if that went through.");
    expect(FILTER_LABEL.edited_approved).toBe("Edited approved");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/__tests__/queueOutcome.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/lib/queueOutcome.ts`**

```ts
/**
 * queueOutcome.ts — what one Approve / Approve edited / Reject press says
 * once the decide door answers (smooth-feel spec §6). Pure, client-safe; the
 * queue page imports it and never re-derives the rule. The card left on the
 * press; this decides whether it comes back and what the line at the top of
 * the queue says. pressOutcome (L7) has already classified the answer.
 *
 *   ok, action done, or a reject   nothing more
 *   ok, actionStatus "failed"      the line: didn't reach ShikksTracker, with a retry
 *   ok, "needs_verification"       the line: can't tell — check there first (no retry)
 *   failed (the door refused)      the card comes back with the door's words (deviation 8)
 *   unknown                        the line: couldn't tell; the quiet re-read decides
 */
import type { PressOutcome } from "@/lib/pressOutcome";
import { doorSentence } from "@/lib/doorSentence";

export type ApprovedFilter = "approved" | "edited_approved";

export type QueueTopLine =
  | { kind: "action-failed"; filter: ApprovedFilter }
  | { kind: "needs-verification"; filter: ApprovedFilter }
  | { kind: "unknown" };

export type DecideResult = { restore: false; top: QueueTopLine | null } | { restore: true; reason: string };

/** Riku's approved wording (2026-10-11). The filter's name sits between lead and tail, as a control. */
export const QUEUE_LINES = {
  actionFailed: {
    lead: "Approved, but the draft didn’t reach ShikksTracker. It’s under ",
    tail: ", with a retry.",
  },
  needsVerification: {
    lead: "Approved, but I can’t tell if the draft reached ShikksTracker. It’s under ",
    tail: ". Check there before doing anything else.",
  },
  unknown: "Couldn’t tell if that went through.",
} as const;

/** The control's text: the real filter (deviation 7). */
export const FILTER_LABEL: Readonly<Record<ApprovedFilter, string>> = {
  approved: "Approved",
  edited_approved: "Edited approved",
};

function itemOf(body: unknown): { status: unknown; actionStatus: unknown } | null {
  if (typeof body !== "object" || body === null) return null;
  const item = (body as { item?: unknown }).item;
  if (typeof item !== "object" || item === null) return null;
  const { status, actionStatus } = item as { status?: unknown; actionStatus?: unknown };
  return { status, actionStatus };
}

export function decideResult(out: PressOutcome): DecideResult {
  if (out.kind === "failed") return { restore: true, reason: doorSentence(out) };
  if (out.kind === "unknown") return { restore: false, top: { kind: "unknown" } };
  const item = itemOf(out.body);
  if (item === null) return { restore: false, top: null };
  const filter: ApprovedFilter | null =
    item.status === "approved" || item.status === "edited_approved" ? item.status : null;
  if (filter === null) return { restore: false, top: null };
  if (item.actionStatus === "failed") return { restore: false, top: { kind: "action-failed", filter } };
  if (item.actionStatus === "needs_verification") {
    return { restore: false, top: { kind: "needs-verification", filter } };
  }
  return { restore: false, top: null };
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run src/lib/__tests__/queueOutcome.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Append the queue's styles to `src/styles/legacy.css`**

At the very end of the file:

```css

/* ---- smooth feel (docs/superpowers/specs/2026-10-11-smooth-feel-design.md §6) ---- */
/* A decided card leaves at once: slides and fades out over 200ms, then the
   page removes it and the list closes over the gap (plan deviation 10).
   base.css's reduced-motion rule stills it; the page then removes the card
   without waiting. */
.card.is-leaving{animation:q-leave .2s ease-in forwards;pointer-events:none}
@keyframes q-leave{to{opacity:0;transform:translateX(24px)}}
/* The filter's name inside the top line: a control that reads as a link.
   It overrides the bare button pill above (L1e: text-transform none), and
   the padding/margin pair gives it a 44px touch height without moving the
   sentence's line. */
.q-link{
  font:inherit;letter-spacing:normal;text-transform:none;color:inherit;line-height:16px;
  background:none;border:0;border-radius:0;padding:14px 0;margin:-14px 0;
  text-decoration:underline;text-underline-offset:2px;cursor:pointer;
}
.q-link:hover{border:0}
```

- [ ] **Step 6: Rewrite the queue page's press handling**

Replace `src/app/(app)/freelance/queue/page.tsx` with the following. Types, filters, the card body and every existing string are unchanged; the press path, the loading state and the top line are new.

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PRESS_TIMEOUT_MS } from "@/lib/constants";
import { doorSentence } from "@/lib/doorSentence";
import { pressOutcome } from "@/lib/pressOutcome";
import { FILTER_LABEL, QUEUE_LINES, decideResult, type ApprovedFilter, type QueueTopLine } from "@/lib/queueOutcome";
import { CardsOutline } from "../../_shell/Outline";
import PushControls from "./PushControls";

const STATUS_FILTERS = [
  "pending",
  "approved",
  "edited_approved",
  "rejected",
  "expired",
  "all",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

interface QueuePayload {
  contactName?: string;
  channel?: string;
  draftSubject?: string;
  draftBody?: string;
  replySnippet?: string;
  replyToLogId?: string;
}

interface QueueItem {
  _id: string;
  type: string;
  source: string;
  title: string;
  summary: string;
  status: string;
  actionStatus: string;
  actionError?: string;
  createdAt: string;
  staleAt?: string;
  payload?: QueuePayload;
  editedPayload?: QueuePayload;
}

/** The card's exit (smooth-feel spec §6): legacy.css's `.card.is-leaving` runs this long. */
const EXIT_MS = 200;

function reducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function withId(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  return set.has(id) ? set : new Set(set).add(id);
}

function withoutId(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

/** The line at the top of the queue after a press (spec §6). */
function TopLine({ line, onFilter }: { line: QueueTopLine; onFilter: (f: ApprovedFilter) => void }) {
  if (line.kind === "unknown") {
    return (
      <p className="meta" role="status">
        {QUEUE_LINES.unknown}
      </p>
    );
  }
  const words = line.kind === "action-failed" ? QUEUE_LINES.actionFailed : QUEUE_LINES.needsVerification;
  return (
    <p className="error" role="status">
      {words.lead}
      <button type="button" className="q-link" onClick={() => onFilter(line.filter)}>
        {FILTER_LABEL[line.filter]}
      </button>
      {words.tail}
    </p>
  );
}

/**
 * The approval queue (still P3's plain view; its redesign is P12's).
 *
 * SMOOTH FEEL (spec §6). Approve, Approve edited and Reject take the card
 * off at once: it slides out (EXIT_MS, or at once under reduced motion) and
 * focus moves to the next card's first button, else the previous card's,
 * else the active filter (S1). pressOutcome (L7) classifies the answer and
 * queueOutcome.ts decides: a refused decision brings the card back with the
 * door's words (an edit reopens with its text); a saved approval whose draft
 * didn't reach ShikksTracker, or can't be told, says so at the top with the
 * filter it sits under; no answer says it couldn't tell. Then the list
 * re-reads QUIETLY (no outline over a list already on screen, deviation 10)
 * and the server decides: a card no longer pending is not in the list; one
 * that still is (a press that never landed) comes back. Initial loads and
 * filter changes draw the outline (spec §3.1).
 *
 * The mount-time load in an effect is one of the four baseline lint errors
 * and keeps its shape on purpose.
 */
export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const [top, setTop] = useState<QueueTopLine | null>(null);
  const [cardSaid, setCardSaid] = useState<ReadonlyMap<string, string>>(() => new Map());
  const exits = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const refresh = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/queue?status=${statusFilter}`);
        if (res.status === 401) {
          window.location.href = "/login?from=/freelance/queue";
          return;
        }
        if (!res.ok) throw new Error();
        const body = (await res.json()) as { items: QueueItem[] };
        setItems(body.items);
      } catch {
        setError("Could not load the queue.");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** S1: only when focus was in the leaving card, or nowhere. */
  function focusAway(id: string) {
    const card = document.querySelector<HTMLElement>(`[data-card="${CSS.escape(id)}"]`);
    const at = document.activeElement;
    if (card !== null && at !== null && at !== document.body && !card.contains(at)) return;
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-card]")).filter(
      (c) => c === card || !c.classList.contains("is-leaving"),
    );
    const i = cards.findIndex((c) => c.dataset.card === id);
    for (const c of [cards[i + 1], cards[i - 1]]) {
      const b = c?.querySelector<HTMLButtonElement>("button:not(:disabled)");
      if (b) {
        b.focus();
        return;
      }
    }
    document.querySelector<HTMLButtonElement>(".q-filters button[aria-pressed='true']")?.focus();
  }

  function stopExit(id: string) {
    const t = exits.current.get(id);
    if (t !== undefined) {
      clearTimeout(t);
      exits.current.delete(id);
    }
  }

  function leave(id: string) {
    focusAway(id);
    setLeaving((s) => withId(s, id));
    const t = setTimeout(
      () => {
        exits.current.delete(id);
        setGone((s) => withId(s, id));
        setLeaving((s) => withoutId(s, id));
      },
      reducedMotion() ? 0 : EXIT_MS,
    );
    exits.current.set(id, t);
  }

  function settleCard(id: string) {
    stopExit(id);
    setLeaving((s) => withoutId(s, id));
    setGone((s) => withoutId(s, id));
  }

  async function decide(id: string, payload: Record<string, unknown>) {
    if (busyId === id) return;
    const wasEditing = editingId === id;
    setBusyId(id);
    setTop(null);
    setCardSaid((m) => {
      if (!m.has(id)) return m;
      const next = new Map(m);
      next.delete(id);
      return next;
    });
    leave(id);
    if (wasEditing) setEditingId(null);
    const out = await pressOutcome(
      fetch(`/api/queue/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }),
    );
    const result = decideResult(out);
    if (result.restore) {
      settleCard(id); // the card comes back, in its place
      setCardSaid((m) => new Map(m).set(id, result.reason));
      if (wasEditing) setEditingId(id); // the edited text is still in editBody
    } else {
      setTop(result.top);
    }
    await refresh(true);
    if (!result.restore) settleCard(id); // the re-read decides from here
    setBusyId(null);
  }

  async function retry(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const out = await pressOutcome(
        fetch(`/api/queue/${id}/retry`, { method: "POST", signal: AbortSignal.timeout(PRESS_TIMEOUT_MS) }),
      );
      if (out.kind === "failed") {
        setError(doorSentence(out));
        return;
      }
      if (out.kind === "unknown") setError(out.sentence);
      await refresh(true);
    } finally {
      setBusyId(null);
    }
  }

  const shown = items.filter((item) => !gone.has(item._id));

  return (
    <main>
      <div className="row q-filters">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={s === statusFilter ? "" : "secondary"}
            aria-pressed={s === statusFilter}
            onClick={() => setStatusFilter(s)}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {top !== null && (
        <TopLine
          line={top}
          onFilter={(f) => {
            setTop(null);
            setStatusFilter(f);
          }}
        />
      )}
      {loading && <CardsOutline labels={[null, null]} />}
      {error && <p className="error">{error}</p>}
      {!loading && !error && shown.length === 0 && (
        <p className="meta">No {statusFilter === "all" ? "" : `${statusFilter.replace("_", " ")} `}items.</p>
      )}

      {!loading &&
        shown.map((item) => {
          const effective = item.editedPayload ?? item.payload;
          const said = cardSaid.get(item._id);
          return (
            <div key={item._id} data-card={item._id} className={leaving.has(item._id) ? "card is-leaving" : "card"}>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
                <strong>{item.title}</strong>
                <span className="badge">
                  {item.status.replace("_", " ")}
                  {item.status !== "pending" && item.status !== "rejected" && item.status !== "expired"
                    ? ` · action ${item.actionStatus}`
                    : ""}
                </span>
              </div>
              <p className="meta">
                {item.source} · {item.type} · {new Date(item.createdAt).toLocaleString()}
              </p>
              <p>{item.summary}</p>
              {effective?.replySnippet && <p className="meta">Their reply: “{effective.replySnippet}”</p>}
              {effective?.draftSubject && <p className="meta">Subject: {effective.draftSubject}</p>}
              {effective?.draftBody && <pre className="body">{effective.draftBody}</pre>}
              {item.actionError && (
                <p className={item.actionStatus === "done" ? "meta" : "error"}>
                  {item.actionStatus === "done" ? "Note: " : "Action error: "}
                  {item.actionError}
                </p>
              )}

              {item.actionStatus === "failed" && (
                <div className="row">
                  <button className="secondary" disabled={busyId === item._id} onClick={() => void retry(item._id)}>
                    Retry action
                  </button>
                </div>
              )}

              {item.actionStatus === "needs_verification" && (
                <p className="error">
                  This may or may not have reached ShikksTracker. Open the contact there and check
                  whether the draft exists before doing anything else. There is no retry button on
                  purpose.
                </p>
              )}

              {item.status === "pending" && editingId !== item._id && (
                <div className="row">
                  <button
                    disabled={busyId === item._id}
                    onClick={() => void decide(item._id, { decision: "approve" })}
                  >
                    Approve
                  </button>
                  <button
                    className="secondary"
                    disabled={busyId === item._id}
                    onClick={() => {
                      setEditingId(item._id);
                      setEditBody(effective?.draftBody ?? "");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="danger"
                    disabled={busyId === item._id}
                    onClick={() => void decide(item._id, { decision: "reject" })}
                  >
                    Reject
                  </button>
                </div>
              )}

              {item.status === "pending" && editingId === item._id && (
                <div>
                  <div className="row">
                    <textarea rows={6} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                  </div>
                  <div className="row">
                    <button
                      disabled={busyId === item._id || editBody.trim().length === 0}
                      onClick={() => void decide(item._id, { decision: "edit", draftBody: editBody })}
                    >
                      Approve edited
                    </button>
                    <button className="secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {said !== undefined && <p className="error">{said}</p>}
            </div>
          );
        })}

      <PushControls />
    </main>
  );
}
```

(`new Date(item.createdAt).toLocaleString()` was already in the render and is a pure function of the item, so it isn't the purity rule's `new Date()`. The card body is otherwise unchanged.)

- [ ] **Step 7: Type-check, test, lint and commit**

```bash
npx tsc --noEmit
npm test
npm run lint
```
Expected for lint: the baseline exactly (4 errors, 3 warnings). If the queue's effect now counts as a second error, restore `refresh`'s first statement to an unconditional call with the same shape as before. Report to the lead before committing.

```bash
git add src/lib/queueOutcome.ts src/lib/__tests__/queueOutcome.test.ts
git commit -m "feat(feel): queue card leaves at once; answers through pressOutcome" -m "Claude-Session: https://claude.ai/code/session_01Mn421oryCACSpH3NzRgoxw" -- src/lib/queueOutcome.ts src/lib/__tests__/queueOutcome.test.ts "src/app/(app)/freelance/queue/page.tsx" src/styles/legacy.css
```

### Task T14: F4 review (Opus)

- [ ] **Step 1:** Brief: "Read spec §6, §7 and plan deviations 7, 8 and 10, then T13's diff. Look for:
  - a card that doesn't come back on a refused decision;
  - a card that comes back while the server says it's decided;
  - the exit timer re-hiding a restored card (stopExit);
  - focus falling to `<body>`;
  - a quiet re-read that flashes the outline;
  - an unknown answer claimed as failure;
  - a changed existing string;
  - `.q-link` without `text-transform:none` or under 44px tall;
  - the edited text lost on a refused edit;
  - the lint count moving.

  Report; don't edit."

---

## T15: Principal review, the trio, verification, record

- [ ] **Step 1: Principal cross-module review (Opus)** across F1–F4. Brief: "Read the spec and this plan's deviations. Then read `navProgress.ts`, `NavProgress.tsx`, `Outline.tsx`, the four `loading.tsx` files, `PersonalOutline.tsx`, `RememberLayout.tsx`, `personalLayoutMemory.ts`, `standIns.ts`, `LayoutEditor.tsx`, `StandInRows.tsx`, `TodoForm.tsx`, `EventForm.tsx`, `instantSwitch.ts`, the three switch islands, `queueOutcome.ts`, `doorSentence.ts`, the queue page, `feel.css` and the appended sections of `personal.css` and `legacy.css`. Look for seams:
  - a load whose signal never ends (the bar stuck on);
  - the bar never showing on first open;
  - an optimistic state that outlives the server's render;
  - a failure claimed without the door saying so;
  - a second send possible after an unknown add;
  - focus to `<body>` anywhere;
  - storage outside try/catch;
  - a new `@media` rule;
  - a new button without `text-transform:none`;
  - a setState in an effect body;
  - impure render.

  Report; don't edit." Fix rounds go back to the owning builder.

- [ ] **Step 2: The trio + lint baseline:** `npm test`, `npx tsc --noEmit`, `npm run build`, and `npm run lint` (exactly 4 `react-hooks/set-state-in-effect` errors and 3 warnings, exit 1). All four must be green before anything is called done.

- [ ] **Step 3: Verification Lead: in a browser, every outward write intercepted, never Riku's Atlas.** Use the Debrief build's proven method, unchanged:
  - **An isolated copy of the repo, WITHOUT `.env.local`**, made with `git archive HEAD` into a scratch directory. Never a git worktree. Install `mongodb-memory-server` and Playwright (Chromium) **outside the repo**, in the scratch directory's own `package.json`.
  - **Blank every real secret.** `MONGODB_URI` points at the throwaway `mongod`. `SESSION_SECRET` is a throwaway 32+ character value used only to mint the test cookie. ShikksTracker, Google, VAPID/push and cron secrets are all empty.
  - **`next dev --webpack -p 3021`** in the copy. Use 3022/3023 if needed, and run one server at a time. **Never touch Riku's own dev server.**
  - **The to-do door and the queue's decide door run for real against the throwaway Mongo**, which is safe and lets the real re-read replace a stand-in. Delay them with a Playwright route that `continue`s after a pause. Intercept with a route `fulfill` or `abort` only where an item says so. `/api/calendar/*` and every push route are intercepted throughout.
  - **Seed fixtures:** `OsSettings` with a custom `personalLayout` (Next 7 days in row 1) and monitoring on; two `Todo` rows; three pending `followup-draft` `ApprovalItem`s.
  - **Slow a page render:** route the RSC request (`?_rsc=` / `RSC: 1` header) for the target page and `continue` it after 1.5 s.

  Measure and record, item by item:

  **F1**
  1. Rail tap `/freelance` → `/personal` with the RSC request slowed: the outline (`.pe-grid` with five eyebrows and `.ol-bar`s) is visible before the content. `.navbar[data-on="true"]` holds between ~150 ms and the content's arrival, then returns to `false`.
  2. The outline's `main` text holds no digit (`/\d/` on `innerText`) and no `button`, `a` or `.tick`.
  3. With `localStorage["personal-layout:v1"]` seeded to the custom layout, the outline's first cell is Next 7 days. With it set to `"{"`, the outline is the default grid. With storage blocked (a context whose `localStorage` getter throws, via an init script), the outline is the default grid and nothing throws.
  4. `/freelance` (three labelled cards, four section headings), `/freelance/queue` (two cards; **not** the dashboard outline) and `/settings` (four labelled cards) each show their outline on a soft navigation.
  5. First open: a hard navigation to `/personal` streams HTML containing `ol-sr` before the page content.
  6. Reduced motion (`emulateMedia({ reducedMotion: "reduce" })`): computed `animation-name` on `.navbar[data-on="true"]` and `.ol-bar` is `none`, the bar still shows while loading, and `opacity` is `1`.

  **F3**
  7. Settings, calendar picker: with `PATCH /api/settings` delayed 1 s, `aria-checked` flips before the response. With a `fulfill` 400 `{"error":"Up to 10 calendars."}` it flips back and the row says `Couldn’t save.` (pressOutcome's fallback for a sentence body, unchanged here). With an `abort` it stays and says `Couldn’t tell if that saved.`.
  8. Settings, agent cards: the chaser button's label and `Currently on/off` flip before the delayed response. A `fulfill` 400 `{"error":"chaserNDays must be an integer from 1 to 30."}` flips back and shows that sentence. An `abort` keeps the flip, says `Couldn’t tell if that saved.` and re-reads (count the GETs).
  9. Personal, layer switches: unchanged behaviour (flip, failure returns, unknown stays).

  **F2**
  10. Add a to-do in Academics, due today, with the door delayed 1.5 s. The form closes at once and focus is on `+ To-do`. A faded row with `saving` shows in the To-do tile's Academics section **and** Today's DUE group. After the response and refresh, the real row replaces it and no `.is-standin` remains.
  11. The same, due in four days: the stand-in shows in that day's row of Next 7 days. On a day that read `—`, the dash is hidden while the stand-in shows.
  12. `fulfill` 400 `{"error":"no-title"}`: the stand-in leaves and the form reopens with the typed title and section. The sentence shows above the buttons, and focus is in Title.
  13. `abort`: the stand-in says `couldn’t tell if that saved`, the To-do head says `Couldn’t tell if that saved.`, and the pill is `aria-disabled` while sending. After the answer, reopening shows `Add` refused (parked). After the refresh, the stand-in is gone.
  14. `.is-standin` contains no `button` and no `a`. At 390px and 320px wide, the page has no horizontal scroll with a stand-in showing.
  15. Event add: with Google blank, `+ Event` is blocked by design, so the event path can't be driven. Record it as covered by `standIns.test.ts` and the F2 review, and as one of **Riku's hands**.

  **F4**
  16. Approve with the decide door delayed 1.5 s (real): the card gets `is-leaving` at once and is gone within 300 ms. Focus moves to the next card's Approve. After the response, `No pending items.` shows only once all three are decided.
  17. `fulfill` 200 `{"item":{"status":"approved","actionStatus":"failed"}}`: the top line reads exactly the approved sentence, and its `Approved` control switches the filter.
  18. `fulfill` 200 with `"actionStatus":"needs_verification"`: the second approved sentence, exactly.
  19. `fulfill` 409 `{"error":"Item is no longer pending (already decided or expired)."}`: the card comes back with that sentence. For an edit, the edit box reopens with the edited text.
  20. `abort`: `Couldn’t tell if that went through.` shows, and the re-read is quiet (no `.ol-bar` appears in `main`).
  21. Reduced motion: the card is removed with no 200 ms wait.
  22. `.q-link`: computed `text-transform: none`, and its box is ≥ 44px tall.

- [ ] **Step 4: Post-build record** at the foot of this file. Include:
  - the commits (`git log --oneline 33b7217..HEAD`);
  - the final test count;
  - the trio and lint results;
  - the deviations taken (this plan's 1–11 plus any the build adds);
  - the findings and fixes from each review;
  - the Verification Lead's measurements;
  - **Riku's hands** (below), left unticked.

---

## Riku's hands (at the end)

- [ ] Say "push" (master is ahead of origin; pushing needs his say-so).
- [ ] On his phone, after the deploy:
  - [ ] a menu tap shows the outline and the bar at once;
  - [ ] adding a to-do shows it faded, then normal;
  - [ ] **adding an event (real Google) shows it faded in Today or the day's row, then normal** (item 15 couldn't be measured);
  - [ ] a layer switch and a Settings calendar tick flip at once;
  - [ ] when a real draft is waiting, Approve slides the card away.
- [ ] **The cold-open measurement (spec §3.3):** open the app after it has sat unused for 30+ minutes, and say roughly how long the screen was blank before the outline appeared. Then do it again straight away (warm). The lead also records `curl -s -o /dev/null -w "%{time_starttransfer}\n" https://riku-os.vercel.app/login`, cold and warm, three times each. Whether it earns more work is decided from these numbers.

---

## Interim build record (2026-10-12): code complete, browser verification pending

**Where it stopped.** Every task through T15 Step 2 is done. The T15 Step 3 Verification Lead was cut off by the account usage limit while writing its seed/server script, before measuring anything. It left no server running and no repo change; its scratch files were in the old session's scratchpad and are gone with that session. **The next session starts at T15 Step 3**: run the Verification Lead exactly as Step 3 says, with the adjustments listed in its brief below. Then write the final post-build record (Step 4) here.

**Commits:** `git log --oneline 33b7217..HEAD` gives 28 commits, the last being `2601cdc`. Nothing is pushed: master is ahead of origin, and pushing needs Riku's say-so.

**Trio at `2601cdc`:**
- `npm test`: 63 files, 1588 tests, all pass.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `/freelance` and `/freelance/queue` are each one route.
- `npm run lint`: 4 errors and 3 warnings, which is the baseline exactly.

**Reviews** (all Opus, one per feature plus the principal review). Every finding was ruled on and recorded as amendment 12(a)–(f).
- **F1, outlines and bar.** CHANGES, then APPROVED.
  - Next stops prefetching at the first `loading.tsx` on a path, so `freelance/loading.tsx` swallowed `/freelance/queue`. The dashboard moved into a `(dashboard)` route group.
  - Also fixed: the queue outline's filter row, the state-of-play height, and the Today date room.
- **F3, switches.** CHANGES, then APPROVED.
  - AgentSwitches could freeze (an unguarded re-read with no `finally`). Now fixed.
  - An unknown press always says `Couldn’t tell if that saved.`.
  - `doorSentence` prefers the door's own words, so `Could not save.` is unchanged.
- **F4, queue.** Three CHANGES rounds, then APPROVED.
  - A refused approve (409/404) used to vanish after the re-read and look like a success. It now moves to a `refused` top line.
  - The re-read reports whether it landed. Edit text is kept per card. The top line is replaced only by non-null lines.
  - A sequence guard and a filter guard drop stale re-reads; a stale quiet re-read never claims a sequence number.
  - **Safety:** focus after a card leaves goes to the next card, not its Approve button.
- **F2, adds.** CHANGES, then APPROVED.
  - `reopen` can't drop focus to `<body>`, and it reads LayoutEditor's live epoch and editing state, so a failure is never silent.
  - The stand-in's mark sits on its own `.pe-said` line.
  - Only the `.is-none` empty sentences are hidden beside a stand-in.
  - An unread day's empty cell is hidden beside a stand-in.
- **Principal (cross-module).** CHANGES, then APPROVED.
  - The queue's overlapping loud loads are fixed (`loudRef`), the list GET has a timeout, a retry's failure sits on its card, and busy state is per card.
  - The agent switches use L9 (`aria-disabled`), and `legacy.css` dims `[aria-disabled="true"]`.
  - First open: the outline carries a static `.ol-navbar`, because dehydrated Suspense fallbacks never mount on the client. It is hidden inside `.pe-wrap`, because container queries pin fixed elements to the tile.

**Recorded edge cases, accepted, not fixed:**
- A settled-ok stand-in reads `saving` until the next render lands.
- `reopen`'s note can repeat the sentence once if the form couldn't open and the pill is pressed before another press.
- Stale `formCapable` during an edit-mode save within one add's flight.
- An A→B→A filter round-trip during a decide can briefly show the decided card (a press gets the server's 409).
- AgentSwitches' Save threshold becomes `disabled` after a successful save, so focus drops (this predates the build).
- `decide` has no `try/finally` around its busy set (nothing in it can throw today).

**Verification Lead brief adjustments** (on top of Step 3's 22 items):
- On a hard load, a static `.ol-navbar` shows at the top of the viewport, and none shows inside `.pe-wrap`.
- `/freelance/queue` shows the queue outline, never the dashboard's, when reached from `/personal` and from `/freelance`.
- A settings 500 `{error:"Could not save.",code:"save-failed"}` shows `Could not save.`.
- Agent switches keep focus with `aria-disabled` while saving.
- After an approve, focus is on the next `[data-card]` (`role="group"`).
- The stand-in's mark is a separate `.pe-said.is-standin` line; there is no horizontal scroll at 390px or 320px.
- If Edit layout was entered during an add's flight, a failure goes under the tile's head.
- An R42 `.fl-empty` line stays visible beside a stand-in.

**Riku's hands:** the list above ("Riku's hands (at the end)"), unchanged, all unticked.

---

## Post-build record (2026-10-12): T15 complete

**Status.** T1–T15 are done. The code is unchanged since `2601cdc`; this record is the only change after it. Nothing is pushed: master is ahead of origin, and pushing needs Riku's say-so.

**Commits:** `git log --oneline 33b7217..HEAD` gives 29 commits, from `b45e5ae` (the plan) to `a67f1cb` (the interim record), plus this record's commit. In order:
- `a9453bf`, `c06fe6d`, `54984ea`, `5d9a371`: F1 (navProgress and doorSentence; bar, signals and outline pieces; the Freelance, queue and Settings outlines; the Personal outline).
- `4910bba`: F3, the switches.
- `4802439`, `2186048`, `3b27105`, `2efee14`: F2, the stand-ins.
- `df48029`: F4, the queue.
- Then the review fix rounds and plan amendments: `72907e7` to `2601cdc`.

**Trio, re-run 2026-10-12 on `a67f1cb`:**
- **`npm test`:** 63 files, 1588 tests. All pass on an idle machine.
  - One pre-existing test is flaky under CPU load. `voice.test.ts › pickLine › never picks the same line on two consecutive days…` takes 1.7 s alone, but timed out at Vitest's 5 s default in 2 of 5 full runs. Both runs overlapped other heavy work: Riku's dev server, tsc, and an `npm ci`.
  - It came in with the Debrief build (`224f09e`), not this one, and the logic itself is not in doubt.
  - Suggested follow-up, not done here: give that test (and its 2.1 s sibling) an explicit timeout.
- **`npx tsc --noEmit`:** clean.
- **`npm run build`:** clean. `/freelance` and `/freelance/queue` are each one route.
  - It was run in the isolated `git archive` copy, with the repo's own `node_modules` copied in, because Riku's `next dev -p 3001` was running from the repo, and a build there would rewrite the `.next` directory under it.
  - Turbopack refuses a junctioned `node_modules` ("points out of the filesystem root"), so the build needs a real copy. The junction is only fine for `next dev --webpack`.
- **`npm run lint`:** 4 errors and 3 warnings, exit 1. That is the baseline exactly.
- **Found on the way:** `npm ci` refuses the repo's lock file as out of sync with `package.json`. It is missing `@emnapi/runtime@1.11.3` and `@emnapi/core@1.11.3`/`1.10.0`, and `@emnapi/wasi-threads` doesn't match. `npm install` tolerates this. It is unrelated to this build; it's worth an `npm install` and a lock-file commit some time.

**Deviations taken:** the plan's 1–11, plus amendments 12(a)–(f) from the reviews (above, and in the interim record). Nothing new was added in T15.

**Review findings and fixes:** as listed in the interim record (F1, F3, F4, F2, principal), all APPROVED. Its six recorded edge cases are accepted, not fixed.

### The Verification Lead's measurements

**Method.** As Step 3 says, unchanged, with these additions:
- **An isolated copy,** made with `git archive HEAD`. It had no `.env.local` of Riku's, only a throwaway one: `MONGODB_URI` pointed at a `mongodb-memory-server` mongod on 27117, `SESSION_SECRET` and `DASHBOARD_PASSWORD` were throwaway, and the ShikksTracker, Google, VAPID and cron values were all blank.
- **Tooling:** Playwright 1.64 and mongodb-memory-server 10.4 were installed in the scratch directory's own `package.json`.
- **Server:** `next dev --webpack -p 3021`. Riku's port 3001 was never touched.
- **Login** went through the real `POST /api/auth/login` via `context.request`.
- **Seeding** used the app's own models.

**Round 1** was run by a Sonnet Verification Lead.

**Round 2** was run by the lead after the Sonnet agent hit the weekly usage limit. It re-measured items 1, 4 and 5, adj1 and adj2, and ran the three adjustments round 1 hadn't reported (adj3, adj4, adj6).

**Three method findings, worth keeping for the next browser pass:**
1. **Use `http://localhost:3021`, never `127.0.0.1`.** Next 16's dev server rejects the HMR websocket for a non-allowed `Origin`. With that socket stuck, nothing hydrates: no `onClick` fires and no effect runs.
2. **Don't measure a loading outline in dev by delaying the RSC request.**
   - Dev mode never prefetches: every run counted 0 requests with `next-router-prefetch`. So the `loading.tsx` outline reaches the browser only in the server's first streamed chunk.
   - A route that holds the whole RSC response therefore holds the outline too. In round 2's "mode A" (navigation RSC held 1.5 s), the outline appeared at ~1.7 s, together with the content.
   - That artifact is why round 1 recorded item 1 and item 4 as FAIL in its final run.
   - The faithful way is to **slow the data, not the delivery.** Round 2 used a small TCP proxy between `next dev` and mongod that holds each client→server chunk 300 ms, standing in for Atlas latency.
   - In production the outline comes from the prefetch cache instead, so it is no slower than this.
3. **Item 5 (first open) needs the same latency.** Against a bare local mongod, with every outside call failing synchronously because the secrets are blank, the page resolves before React flushes the Suspense fallback. Round 1 caught it once in five tries; under the latency proxy it showed every time.

**F1**
1. **PASS** (round 2, latency proxy at 300 ms, 3 runs per target).
   - On a rail tap `/freelance` → `/personal`, the outline was up at 119, 124 and 127 ms after the click, and the content arrived at 489, 507 and 495 ms.
   - Every animation frame between those two showed the outline.
   - `.navbar` went `data-on="true"` at 6–15 ms and back to `false` on the content frame.
2. **PASS.** In the outline's `main`:
   - The text is `Loading… / TODAY / TO-DO / LAYERS / NEXT 7 DAYS / DONE THIS WEEK`, with 12 `.ol-bar`s and 0 `button`, `a` or `.tick`.
   - The one digit is the fixed `Next 7 days` label, not data.
3. **PASS** (round 1).
   - Remembered custom layout: the first cell is `Next 7 days`.
   - `"{"` in storage: the default grid.
   - Storage getter throwing: the default grid, and no page error.
4. **PASS** (round 2, 3 runs each; outline up within 96–132 ms on every run, continuous until content):
   - **`/freelance`:** three `.stat` cards labelled Drafts, Contacts and Needs you, and four `.fl-sect` with the headings Your pipeline, Your campaigns, Your approaches and Waiting on you. No digits, no controls. Content at ~440 ms.
   - **`/settings`:** four cards labelled Follow-up chaser, Monitoring, Google Calendar and Calendar layers. Content at ~775 ms.
   - **`/freelance/queue`:** never the dashboard's outline (0 `.stats .stat` on every frame).
     - Its server render is quick (no Mongo read), so what holds the screen is the page's own loud load: the real filter row, then two bar cards and its `Loading…`. Content arrived at ~1,080 ms.
     - `loading.tsx`'s ghost-button version shows only while the server render itself is slow. Round 1 saw it then: 6 `aria-hidden` ghost buttons and 2 unlabelled cards.
5. **PASS, 3 of 3** (round 2, latency proxy). On a hard load of `/personal`:
   - The raw HTML (49 KB) has `ol-navbar` at byte 4,221 and `ol-sr` at 4,286. The first Suspense swap script `$RC` comes at ~45,000.
   - In the browser, 20 consecutive frames showed the outline before the content.
6. **PASS.** Under reduced motion, the live `.navbar[data-on="true"]` and `.ol-bar` have computed `animation-name: none` and `opacity: 1`. The bar still shows while loading.

**F3**
7. **NOT RUN:** the calendar picker doesn't mount without Google. The press mechanism is shared with item 8 and pinned by `instantSwitch.test.ts`. It is on Riku's phone list.
8. **PASS**, all three parts, on the agent cards:
   - (a) The label and the `Currently on/off` sentence flipped while the PATCH was held.
   - (b) A 400 with the chaserNDays sentence flipped back and showed that sentence verbatim.
   - (c) An abort kept the flip while busy, then said `Couldn’t tell if that saved.`, and the GET count went up by exactly 1.
9. **NOT RUN:** the layer switches don't render without Google (the `buildLayersView` sentence branch). The mechanism is shared and pinned by tests. **Added to Riku's phone list.**

**F2**
10. **PASS.** The door was held 1.5 s:
    - The form closed at once, and focus was on `+ To-do`.
    - The stand-in showed in both the Academics section and Today's Due group.
    - After the refresh, 0 `.is-standin` remained, and the real `.pe-row.is-todo` was there.
11. **PASS.** For a day that read `—`:
    - The stand-in showed in that day's row.
    - The `.pe-dash` stayed in the DOM but was not visible (`personal.css`, the `:has(>.pe-standins)` rule).
    - After the refresh, the stand-in was gone and the real item was there.
12. **PASS.** On a 400 `no-title`:
    - The stand-in left, and the form reopened with the typed title.
    - `Give it a title.` showed, and focus was in Title.
13. **PASS.** On an abort:
    - The pill was `aria-disabled="true"` in flight.
    - The mark read `couldn’t tell if that saved`, and the head read `Couldn’t tell if that saved.`.
    - Reopening showed `Add` as `aria-disabled` (parked), with Cancel live.
    - After the refresh, the stand-in was gone.
14. **PASS.** No `button` or `a` inside `.is-standin`. At 390 px and 320 px, `scrollWidth` equals the viewport.
15. **NOT RUN by design:** `+ Event` is blocked with Google blank. It is covered by `standIns.test.ts` and the F2 review, and it is on Riku's phone list.

**F4** (the decide door ran for real; with `ST_API_SECRET` blank, `readStConfig()` throws before any `fetch`, so no outward call could leave)
16. **PASS.** The door was held 1.5 s:
    - The card had `is-leaving` at once and was detached at ~220–280 ms.
    - With items still pending, `No pending items.` did not show. Once all three were decided, it did.
17. **PASS.** The top line read exactly `Approved, but the draft didn’t reach ShikksTracker. It’s under Approved, with a retry.`. Its `Approved` control switched the filter.
18. **PASS.** The top line read exactly `Approved, but I can’t tell if the draft reached ShikksTracker. It’s under Approved. Check there before doing anything else.`.
19. **PASS.** On a 409, the card came back with `Item is no longer pending (already decided or expired).`, and the edit box reopened with the edited text unchanged.
20. **PASS.** On an abort, the top line read `Couldn’t tell if that went through.`, and no `.ol-bar` appeared during the quiet re-read.
21. **PASS.** Under reduced motion, the card was detached at ~70–90 ms, with no 200 ms wait.
22. **PASS.** `.q-link` has `text-transform: none` and a 44 px box.

**Brief adjustments**
- **adj1 PASS, 3 of 3** (round 2). On a hard load, a static `.ol-navbar` sat at the viewport top on every outline frame, none was ever visible inside `.pe-wrap`, and none remained once the content arrived.
- **adj2 PASS** (round 2). The queue was reached from `/freelance` and, via `/freelance`, from `/personal` (there is no direct rail link). It showed 0 dashboard `.stat`s on every frame.
- **adj3 PASS** (round 2). A settings 500 `{"error":"Could not save.","code":"save-failed"}` showed `Could not save.`, and the label flipped back.
- **adj4 PASS** (round 2). While the PATCH was held 1 s, `document.activeElement` was still the chaser button, with `aria-disabled="true"` and not `disabled`. Focus was still on it after the save.
- **adj5 PASS** (round 1). After an approve, focus was on the next `[data-card]` (`role="group"`), not its Approve button.
- **adj6 PASS** at 390 px and 320 px (round 2).
  - The stand-in renders as `<div class="pe-rows pe-standins"><div class="pe-row is-item is-standin">…<span class="pe-nm">…</span></div><p class="pe-said is-standin">saving</p></div>`.
  - So the mark is its own line, below the title and outside `.pe-nm`.
  - There is no horizontal scroll. Screenshots: `adj6-390.png`, `adj6-320.png`.
- **adj7 PASS** (round 1). With Edit layout entered mid-flight, the failure sentence `Give it a title.` went under the To-do tile's head.
- **adj8 NOT RUN:** the R42 `.fl-empty` line needs Google. By the CSS, `personal.css`'s hiding rule targets only `.fl-empty.is-none`, and R42's line has no `.is-none`.

**Clean-up:** the dev server, the proxy and mongod were stopped, the ports are free, and the junction was removed with `rmdir` only. The repo was untouched by the pass: `git status --short` was empty before this record.

### Riku's hands

The list above ("Riku's hands (at the end)") stands unchanged, all unticked. Its line "a layer switch and a Settings calendar tick flip at once" is now the only real-browser evidence for items 7 and 9. Its event line is the only evidence for item 15.
