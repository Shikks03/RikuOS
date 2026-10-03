# P10c — The Personal page: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `/personal` — six tiles plus one empty cell on a four-row weighted bento, on live Google Calendar data and the app's own to-do store, in every state the deck specifies, correct for **any legal arrangement** and not only the default — plus the layout editor, the two Settings cards, and the phase's own acceptance bar: the page live on Riku's real calendars and his real to-dos, and one real 07:00 push that named what was actually due and scheduled that day.

**Architecture:** `page.tsx` is a renderer with no opinions in it. It reads Mongo in one deadline-bounded phase, creates **one** calendar promise without awaiting it, and hands each Plan B builder's plain-data result to a presentational server component whose markup and class names are the mockup's. Five client islands and no sixth: `LayoutEditor` (edit mode, the working arrangement, the header pills, the cell wrappers, and the one page-level context of hidden to-do ids), `TodoRow`, `TodoForm`, `EventForm`, `LayerSwitches`. **Zero `useEffect` in any of them.** The day-row disclosure is a native `<details>` — no script, no state, no effect, no island.

**Tech Stack:** Next.js 16.2.10 (App Router, server components, `<Suspense>` on the server) · React 19.2 · TypeScript `strict`. **No new dependency. No CSP change. No `NEXT_PUBLIC_*`. No `dangerouslySetInnerHTML`.**

---

## Why the phase splits here, and what Plans A and B had to land first

**What Plan A landed that this plan consumes unchanged:** all five stylesheets, imported in the fixed order — `personal.css` is the class vocabulary this page renders into and **this plan edits no stylesheet at all**; `components.css`'s ten shared controls; the nine `.pe-tN` ramp classes and `tokens.css`'s three tint anchors; `IconPersonal` and the rail's three nav items; S20's phone strip; and the placeholder `src/app/(app)/personal/page.tsx` that **Task 1 rewrites**.

**What Plan B landed that this plan consumes unchanged:** its **"Types Plan C will render"** section is the contract this plan's JSX consumes — `SayLine`, `TodayView`, `WeekView`, `DayRowView`, `TodoRowView`, `TodoTileView`, `DoneTileView`, `PushTileView`, `LayersTileView`, `CellView`, `CalendarWindow`, `CalendarEvent`. **Not one of those shapes is changed here.** If a tile seems to need a different shape, that is a Plan B change and a conversation, not a local edit. Also: `days.ts`, `todos.ts`, `personalLayout.ts` (including `formCapable`), `personalView.ts`'s six builders and `heroTint`, the `Todo` and `LastDigest` models, the widened `OsSettings`, `google.ts`, and the three mutation routes this page's islands post to.

**Why the boundary is *here*.** The line between Plan B and this plan is the line between *what a test can pin* and *what only a person looking at a screen can confirm*. Everything Plan B shipped is a pure function, a schema, or a handler thin enough that its behaviour lives in a pure function; everything here is markup, focus order, `inert`, and a native disclosure. **This plan therefore adds no test file, and that is deliberate** — §8's six test files are all Plan B's, the repo has no route- or component-level tests, and P10 adds none. P8c drew the identical line and recorded why it held: every decision the page makes was pushed into the pure modules and is already pinned there, which is what lets this plan's verification be entirely "by build and by looking" without that being an excuse. **The exceptions prove the rule:** the two places this plan *does* find a decision are both decisions that belong in a pure module, and both go there with a test — see Task 9's `pickerRows` and Task 1's `fellBack` sentence.

---

## What this plan ships, and what it deliberately does not

### Ships

1. **`/personal`** — the page root rewritten: `force-dynamic`, `maxDuration`, phase 1 / phase 2, **one** calendar promise and **two** server `<Suspense>` boundaries, the header band, and the `fellBack` sentence.
2. **Six server tiles** — Today, To-do, Layers, This morning's push, Next 7 days, Done this week — in every state deck §6, §11, §12 and §15 specify.
3. **Five client islands, and no sixth** — `LayoutEditor`, `TodoRow`, `TodoForm`, `EventForm`, `LayerSwitches`. Zero `useEffect` (R33). The day-row disclosure is native `<details>` and needs none (R68).
4. **The layout editor** — move, widen, narrow, reset; the arrangement saved on the server; four mode signals, none of them a colour; `inert` bodies; the full focus and disabling matrix.
5. **The two Settings cards** — `Google Calendar` and `Calendar layers` — on the existing Settings page, which becomes a server component so `listCalendars()` can be called once (R24).
6. **`ARCHITECTURE.md`'s §3.1, §4.2 and §5 updates.** §7's S19 and S20 are already recorded and are **not** rewritten.
7. **The phase's acceptance bar, observed.** The page live on real data, and one real automatic 07:00 push.

### Does not ship

- **Any new agent** (S13, `ARCHITECTURE.md` §7). The Personal side gets none.
- **Any stylesheet edit.** Plan A shipped the vocabulary this page renders into. If a rule seems to be missing, **stop and raise it** — a late CSS addition is how the cascade stops being readable in one file. There is **no named exception** in this plan, unlike P8c's one.
- **Any new test file**, any change to a Plan B type, any new API route.
- **Editing or deleting a calendar event from the app.** Event rows link out to Google (concept D5).
- **Drag-and-drop layout editing** (D7). Buttons.
- **`.pe-more` / `+N more` anywhere on this page** (R89, R51b, R58).
- **`3d late`** — `3 days late` and `1 day late` are the only forms (R88). Task 5 step 4 is where the fit is confirmed.
- **`align-items: start` on the week's paired cells** (R94). The cross-column slack **stays**; it is a true height difference between two unrelated days, not a layout defect.
- **`container-type` on any ancestor of the header** (R30, R87). Containment silently kills the sticky pill row **and** would break S20's threshold.
- **The Academics page, Canvas, the Classes layer being populated, the planner, the quest board** — P11 and P9b. **Nothing here assumes the Classes calendar is empty or full** (§10 item 13).
- **A real phone design.** S20's strip is a stopgap; the phone pass replaces it and owes it nothing.
- **Anything with no data behind it** — the Honesty Critic's nine prohibitions, adopted verbatim by R17: no placeholder content, no ghost rows, no skeleton, no spinner, no toast, no hover-only affordance, no drag, no retry control, no freshness stamp on the page, no streak, no rate, no derived number, no onboarding, no first-run banner, no dashed box or centred empty state, no interpretive copy, nothing filling the empty cell, and no tile that hides itself.

---

## What the mockup fixes, and the four places this plan deviates from it

`docs/design/p10-mockup.html` is the **markup truth**. Its eight specimens between them draw every element this page produces:

| Specimen | Lines | What it fixes |
|---|---|---|
| 01 · the blank week | 1476–1932 | today's real render, the four row weights, the three 1-of-6 panes |
| 02 · the full week | 1933–2203 | the disclosure open and closed, R64's cross-column slack, the busy week |
| 03 · failure states | 2204–2419 | every couldn't-read, `expired`, `none-enabled`, the vanished layer, the green tint under a Google failure |
| 04 · edit mode | 2420–2952 | the four signals, the sticky pills, the toolbar, the dashed leftover, the shrunk row |
| 05 · the six-column collapse | 2953–3172 | `collapseRow`'s trim, `[3,3,3,3] → [2,2,1,1]`, the closing empty cell |
| 06 · the forms | 3173–3492 | both forms, the pairs, the confirmation, the disabled pill and `Too narrow for the form.` |
| 07 · Settings | 3493–3600 | the two cards on the legacy page, the picker rows |
| 08 · the one-column stack | 3601–3767 | the ruled strip at 334px beside the 164px rail it replaces |

Reproduce the element structure and class names exactly. **Everything below the `mockup-only` banner (line 1273) ships nowhere** — `.doc*`, `.spec-*`, `.tab`, `.lbl`, `.scroll`, `.stack`, `.pair`, `.sheet`, `.frame`, `.f1240`/`.f932`/`.f390`, `.pane`, `.hold`, `.w*`, `.h*`, `.ramp`, `.phonebar`, and the `:where(.legacy-doc)` copy of `legacy.css`.

**Four deviations, each forced and each recorded here rather than discovered later:**

1. **`<h1 className="fl-title">Personal</h1>`, not the mockup's `<h3>`.** A specimen is nested inside a document about the page; the app's page title is the document's heading, and `/freelance` ships `<h1 className="fl-title">`. `.fl-title` carries `margin:0`, so a real heading renders identically. Plan A already fixed this in the placeholder; this plan keeps it.
2. **Every `<span className="fl-h">` that is a tile heading becomes `<h2 className="fl-h">`**, and wrappers that then contain a heading become `<div>` where the mockup used `<span>` — a `<span>` is phrasing content and cannot legally contain a heading. Both are grid items, so nothing moves. This is P8c's deviation 1 and 2 applied to the same vocabulary, for the same reason (P8 R42), and it reaches `.pe-head`'s first cell.
3. **Every anchor gains `href`, `target="_blank"` and `rel="noopener noreferrer"`.** The mockup writes `<a class="fl-biz" href="#">`. The `↗` stays a **literal character** inside `<span className="arr">↗</span>`, never an icon component. **The row is not the anchor** (P8 R36): the anchor wraps the title only, so the row's other cells are not inside a link.
4. **`.pe-said` never appears on the Settings page.** `pe-` is the Personal page's namespace and nothing else's (R46), so every press outcome on `/settings` — `Up to 10 calendars.`, `Couldn't save.`, the vanished-calendar sentence — renders as **`.fl-note`**, which is the same 11px `--ink-3` recipe and is already in `components.css` with a `.pickrow .fl-note` rule waiting for it. **A planning ruling**, stated because the spec says "in `.pe-said`'s register" and a register is not a class.

---

## Ground rules for every task in this plan

- **How to read the ruling IDs.** `R1`–`R95` are the design lead's rulings; `M1`–`M9` round 4's mockup fixes; `S1`–`S14` **in a ruling citation** are round 5's System Keeper / Interaction Designer rulings and are **not** `ARCHITECTURE.md`'s `S1`–`S20`; `D1`–`D14` are the P10 design doc's content decisions and are **not** the concept's `D1`–`D11`.
- **The deck wins on every string** (R86). `docs/superpowers/specs/2026-09-10-p10-personal-page-content.md`, including the eleven of `§15` and **R90's `2 items`**, ratified 2026-09-25. Put the deck's section number in a comment beside each literal. If this plan and the deck differ, the deck is right and this plan is wrong.
- **THE PRIME DIRECTIVE.** Nothing touches `../ShikksTracker` and nothing connects to its database. The To-do tile's `FREELANCE` section is **this app's own `Todo` records** with `section: "freelance"`, not a ShikksTracker read. This page makes no OS-API call at all.
- **`src/styles/*.css` is not edited. No exception.** See "Does not ship".
- **`src/proxy.ts`, `src/app/login/page.tsx`, `src/app/(app)/layout.tsx`, `_shell/*` and `src/app/(app)/freelance/**` are not edited.** The rail gained its item in Plan A; nothing else in the shell changes.
- **Zero `useEffect` in any island, and five islands, not six** (R33, R68). `git grep -n useEffect 'src/app/(app)/personal/'` must return **nothing**, and that grep — not care — is the mechanism that keeps the lint baseline at four errors.
- **No client-side fetching except an island's own single mutation `POST`/`PATCH`/`DELETE`.** The page never fetches its own API from the browser to *read*.
- **Every island's success path ends in `router.refresh()`**, and the server render decides what comes back. **A failed press restores nothing locally** (R21): it clears the local hide and refreshes.
- **No spinner, skeleton, toast, hover-only affordance, drag or retry control anywhere.** Busy states exist on the forms and the switches only; everything else arrives with the page (§5.8).
- **Every count is tabular. No count is hued. A header figure is omitted under a failed read, never zeroed** (R21) — and the types Plan B shipped make the last one unrepresentable, so the check is that no JSX writes `?? 0`.
- **Every tile renders its eyebrow in every state** (R10). A tile reduced to one sentence at 106px still says which tile it is.
- **Every task's check step runs `npm run lint`,** expecting **the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and nothing new.** Exit 1 is the pre-existing state; a fifth error or a fourth warning stops the task. **One of the four moves in Task 9** — read that task before running lint after it.
- **Port 3000 is Riku's dev server and is never bound, opened or stopped.** Every check runs `npm run build` then `npx next start -p 3001`, URLs at `http://localhost:3001/…`, and only the server this plan started is stopped, by its PID:

```bash
netstat -ano | grep ":3001" | grep LISTENING   # the PID is the last column
taskkill //PID <pid> //F
```

- **After every rebuild and restart, open the URL in a fresh tab or reload the document. Never judge a rebuild by an in-app link click** — the previous build's client bundle answers it, and a stale render then reads as a defect that is not there (P8c's Batch-3 lesson, and it will bite hardest here, where five islands are in play).
- Commands are for **Git Bash on Windows** from the repo root. Commits are on `master` and are **never pushed**.

---

## Task 1: `page.tsx` — the data layer, the two Suspense boundaries, and the grid

Built first because everything else is a child of it, and because its failure states are the page's hardest ones.

**Rulings implemented:** R2 · R3 · R17 · R21 · R33 · R34 · R35 · R53/R91 · §4 · §4.7 · §7.2 · §7.4 · §7.5 · deck §11 · deck §15 · D4 · D13.

**Files:**
- Rewrite: `src/app/(app)/personal/page.tsx`
- Create: `src/app/(app)/personal/LayoutEditor.tsx` (normal view only; edit mode is Task 8)
- Create: `src/app/(app)/personal/_blocks/{Today,Todos,Layers,Push,Week,Done}.tsx` (**heads only**; bodies arrive in Tasks 3–7)

- [ ] **Step 1: The page's contract**

```tsx
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata: Metadata = { title: "Personal" };
```

`force-dynamic` because every figure is "what is true right now" — there is nothing to cache and nothing to revalidate. `maxDuration` is a **containment** bound and nothing more: the reader's protection is the explicit timeouts under it (`MONGO_READ_TIMEOUT_MS` on phase 1, `GOOGLE_TIMEOUT_MS` per layer in phase 2), which land in catches that produce states this page already designed. The title is one word; the root layout carries the `%s · APP_NAME` template, so **no page file writes the product name** (P8 R64, and the deck's constraint 1).

- [ ] **Step 2: Phase 1 — one deadline-bounded Mongo read**

One `Promise.all` inside one `try/catch` under `withDeadline(…, MONGO_READ_TIMEOUT_MS, …)`: **settings** (`readOsSettings`, **never `getOsSettings`** — the latter is `updateOsSettings({})` and would make every page view a primary write, R37), **open to-dos**, **done to-dos** (last 7 days), ***LastDigest***, and **`fetchLatestRuns(["dispatcher"])`**.

That last one is R22's one extra read and it costs **no round trip of its own** — it rides in the same `Promise.all`. What it buys is not visibility (the rail already has that) but the push tile's own honesty on the one morning a push went out and its text was not stored.

**Phase 2 is skipped entirely when phase 1 failed** (§7.4). This is not an optimisation: it is what keeps `Couldn't load layers, so the calendar wasn't read.` distinct from `Couldn't read the calendar.` If the layers are unknown there is no calendar read to attempt, and attempting one would produce the wrong sentence.

**Every rejection is logged with the read named**, so a sentence on screen has a line in the log saying which failure it was.

- [ ] **Step 3: Phase 2 — one promise, two Suspense boundaries, on the server**

```tsx
// created, NOT awaited (R34)
const windowPromise = readCalendarWindow(layers, todayK, addDays(todayK, 7));
…
<Suspense fallback={<TodayFallback dateLabel={…} />}>
  <Today windowPromise={windowPromise} … />
</Suspense>
…
<Suspense fallback={<WeekFallback />}>
  <Week windowPromise={windowPromise} … />
</Suspense>
```

**One round of Google calls, two independently streaming tiles.** Both tiles `await` the same promise inside their own boundary; the window is read for `today … today+7` in **one** call set and split by `dayKey`, so a slow Google costs one round, not two.

**The fallback is the tile at full size with border, ground and eyebrow** — and Today's date, which needs no feed — **and no sentence, no count, no stamp, no control.** An unanswered read is **not** a measured emptiness, and a fallback that printed `Nothing scheduled.` would be a lie for as long as it was on screen. **No spinner and no skeleton** (§5.8).

- [ ] **Step 4: The layout, and the one sentence a failed arrangement gets**

`resolvePersonalLayout(settings.personalLayout)` → `{ layout, fellBack }`. **The grid always renders** (deck §11): there is no whole-page-down state, the arrangement falls back to the default when it cannot be read, and each tile carries its own sentence. When `fellBack` is true the page renders deck §15's **`Couldn't load your arrangement, so this is the default.`** — above the grid, with its 5px dot, and that is **the ninth dot** the whole-database-outage render carries. Riku was offered one page-level sentence instead of nine dots and **declined** (R55); do not collapse them.

`buildCells(layout, editing=false)` and `buildTracks(layout, false)` are called **in `LayoutEditor`**, not here, because the editor owns the working copy — the server passes the **resolved layout** and the **six rendered tiles keyed by tile id**, and the editor maps them onto cells.

- [ ] **Step 5: The header band and the markup skeleton**

```tsx
<LayoutEditor layout={layout} tiles={{ today: <Today …/>, todos: <Todos …/>, … }}>
```

`LayoutEditor` renders **both** the header band and the `<main>`, because the header carries the pills and the grid carries the toolbars and one client boundary must span both:

```
<div className="fl-head"><div className="fl">[<div className="pe-sticky">]<div className="fl-headrow">
    <h1 className="fl-title">Personal</h1>
    {editing ? <div className="pe-pills">…</div> : <button className="btn">Edit layout</button>}
</div>[</div>]</div></div>
<main className="app-content"><div className="fl">
    [<div className="pe-edit">]<div className="pe-wrap"><div className="pe-grid" style={{ "--tracks": tracks }}>
        …cells…
    </div></div>[</div>]
</div></main>
```

**The six tiles are server components passed through a client boundary as `ReactNode`.** They render on the server, their `<Suspense>` boundaries are server boundaries, and the editor **moves them without re-fetching them** — "the editor never touches tile contents; the tiles keep rendering their live data while being moved" (deck §8). This is the whole reason the editor is a wrapper and not a page mode.

**`.fl-head` carries the padding and `.fl` the 920px column — the same `.fl` the content uses**, so the band, the top bar and the grid share one left edge by construction rather than by two rules kept in step (P8 R34).

- [ ] **Step 6: The cells, and the empty one**

Each `CellView` becomes `<div className={"pe-cell " + rowClass + " " + spanClass + " " + collapsedClass}>` wrapping the tile. **Cells are keyed by tile id** (R31), so a moved tile keeps its DOM node and its focus.

**The leftover cell is not a tile** (§4.7). In normal view it is **bare ground — no fill, no caption, no dashed outline, nothing in it, ever**. It still needs its element, because it carries `pe-s{n}` / `pe-x{n}` and `is-gap`, and `pe-s0` / `pe-x0` mean "no leftover at this count". **`.pe-cell.is-gap{display:none}` is the only rule in the stylesheet that hides a cell**, and it hides it at one column, where a stack has no leftover. **Never focusable, never a drop target.** The default's leftover is 1 column at twelve and **nothing at six** — the one cell that makes this a bento closes when the page narrows and comes back when it widens.

- [ ] **Step 7: Six tile files, heads only**

Each `_blocks/*.tsx` is a server component rendering `.pe-tile` (the hero also `.is-hero` and its `.pe-t{n}`) → `.pe-head` → the eyebrow, the heading or count, and the control. **Done this week is the one tile whose second head slot is *adjacent* to the eyebrow rather than flush right** (R11, C18): `.pe-head.is-inline`, `auto | minmax(0,1fr)`, `--sp-5` gap, baseline-aligned, the second cell holding the count when populated and the sentence when empty — **one grammar producing both of the deck's renders.**

**Eyebrows and group labels are stored sentence case and uppercased by CSS** (§4): the DOM reads `Today`, `To-do`, `Layers`, `This morning's push` (**curly apostrophe**), `Next 7 days`, `Done this week`, `Scheduled`, `Due`, `Personal`, `Freelance`, `Academics`; `.eyebrow` and `.pe-grp` render them as caps. Same for `.btn` labels — `+ Event`, `+ To-do`, `Edit layout`, `Save`, `Cancel`, `Reset to default`, `Add`, `Delete`, `Keep`, and the busy labels `Adding…` / `Saving…` / `Deleting…`. **The deck's uppercase spellings are the *rendered* form** (P8 R42). Busy labels are sentence case in the source and uppercased as presentation.

**`.fl-h` drops to 15px below 200px of tile width — two sizes, never three** (R11), and that is CSS's job, already shipped.

- [ ] **Step 8: Check and commit**

`npx tsc --noEmit` · `npm run lint` · `npm run build` (`/personal` marked dynamic `ƒ`). On 3001: the page renders six bordered tiles on four weighted rows with one bare leftover; **the blank page's rows measure 340 · 200 · 240 · 120** and the grid **942px** tall (§5.4's measured figures — check them in DevTools and report); nothing scrolls horizontally; the console is clean.

```
feat(p10c): /personal - the data layer, one calendar promise, two boundaries
```

---

## Task 2: `TodoRow` — one island, four tiles, and the page's one shared client state

**Rulings implemented:** R13 · R21 · R33 · R41 · R67 · C11 · §7.3 · deck §6 · deck §15.

**Files:**
- Create: `src/app/(app)/personal/TodoRow.tsx`
- Modify: `src/app/(app)/personal/LayoutEditor.tsx` (the context provider)

- [ ] **Step 1: The hidden-ids context, on `LayoutEditor`**

`LayoutEditor` provides **one page-level context holding the `Set` of hidden to-do ids**, which every `TodoRow` reads and filters itself by — so **the twin of a ticked overdue to-do leaves Today and the To-do tile at the same instant** (C11). Four rules:

- **The set only grows during the page's life, and shrinks by one on a *definite* failure.** A timeout does **not** shrink it: `Couldn't tell if that saved.` never asserts the save failed.
- **The write is idempotent** — `setDone(id, true)` is guarded server-side and already-done is not an error (§7.3) — so a second tap during a slow round trip cannot produce a failure sentence for a state that is already correct.
- **`router.refresh()` reconciles.** The set is a local hide, never a source of truth.
- **While edit mode is open nothing else calls `router.refresh()`** — the `inert` bodies guarantee it, because nothing inside them can be tapped.

- [ ] **Step 2: A to-do row is two controls** (R13)

The tick — `<button className="tick" role="checkbox" aria-checked>` with the 8px check SVG in a **10-unit viewBox** (so `strokeWidth={1.8}`, the glyph set's weight, renders at 1.44px rather than 0.6px) — and a second `<button className="pe-edit-row">` wrapping title, meta and tag, named `Edit "…"`, which opens the edit form in place.

**No chevron, no hover lift. Never `display:contents` on that button** — several browsers drop a `display:contents` button out of the accessibility tree.

**Accessible names, approved as proposed and never visible text:** `Done "Send invoice"`, `Undo "Renew ID"`, `Edit "Renew ID"`.

**No busy state on a tick: the row leaves.** The 40×40 hit box is `.tick::after`'s and is already shipped (R41).

- [ ] **Step 3: Row grammar — and a row never pays for a cell it does not have** (R47)

Undated rows and rows without a tag emit **no empty `<span>`s**. The explicit tracks are the leading cell and the title; everything else flows into **implicit** auto columns (`grid-auto-flow:column`). So `Pay tuition`'s tag ends at the row's edge, and an undated name at 164px does not lose 28px to nothing.

**Lateness is `3 days late` / `1 day late` in `--missing`, in the due-meta column, and nowhere else** (§5.9 item 1). `.pe-due.is-late` carries the ink; the JSX carries no colour. **Ink is the only difference between a due date and an overdue one — no box either way** (Q13, unanimous). `on calendar` is `.pe-on`: a lowercase word, body face, **no box** — an ambient state of the row, not a category. The section tag on a to-do row stays a plain `.tag` (those are the system's names, not Riku's data).

**Every name-bearing row ellipsises and never wraps.** A failure sentence is the opposite: **it never truncates — it wraps and the tile grows** (R10), because a failure sentence that truncates is a failure to report.

- [ ] **Step 4: Press outcomes, and the asymmetry**

A definite failure says `Couldn't save.` / `Couldn't delete.` **under the row**; a timeout says **`Couldn't tell if that saved.`** and **never asserts the save failed** — `CLAUDE.md`'s asymmetric rule, and deck §15's own words: *"a request that timed out may still have landed, and the page must not claim an outcome nobody knows."*

**The one exception to "no hue on a press outcome" is R9 item 4, reworded by R49:** *a sentence under a tile's head that names a wrong state in another system* — `Done, but the calendar entry couldn't be removed. Remove it in Google Calendar.` — takes the **`--stale` dot**, because that is a claim about the world and not about a press. **R16 governs place** (under the head, never the foot), **R9 governs hue.** Everything else in `.pe-said` has **no dot and no hue**, does not survive a reload, and is cleared by the next press in that tile.

- [ ] **Step 5: Check and commit**

```bash
git grep -n 'useEffect' -- "src/app/(app)/personal"     # no output, exit 1
git grep -n 'display:contents\|display: contents' -- "src/app/(app)/personal"   # no output
```

`npx tsc --noEmit` · `npm run lint` · `npm run build`.

```
feat(p10c): TodoRow - two controls, and the one page-level hidden-id set
```

---

## Task 3: Tile 2 — To-do, and `TodoForm`

**Rulings implemented:** R21 · R28 · R40 · R46 · S4 (round 5) · §4.2 · §4.9 · deck §6 Tile 2 · deck §7 · deck §12 · deck §15.

**Files:**
- Modify: `src/app/(app)/personal/_blocks/Todos.tsx`
- Create: `src/app/(app)/personal/TodoForm.tsx`

- [ ] **Step 1: The tile body**

Count `0 open` / `1 open` (`.fl-count`, mono 10px `--ink-3`, tabular). **Three section labels always present, in this order: `PERSONAL` · `FREELANCE` · `ACADEMICS`.** An empty section reads **`nothing open`** at `.fl-empty`, left-aligned where the first row would sit, **and the label stays**.

**`0 open` and Done's absent count differ on purpose** (§4): `0 open` declares the store answered; Done's is a tally and is **absent at zero**. Neither is ever a zeroed stand-in for a failed read — `count` is `number | null` and the JSX must not write `?? 0`.

Bound **20 per section**, then `Showing 20 of 34.` in `.fl-bound`, **in the foot** (R16 — the foot holds display meta and the edit toolbar, nothing else). Unreadable → **`Couldn't load to-dos.` once, in place of the sections**, with its `--stale` dot.

**Ticking removes the row at once and it reappears in Done this week**, through Task 2's context.

- [ ] **Step 2: `TodoForm` — one island serving add and edit**

**A form replaces the tile's body, never scrolls, and grows its row when it must** (R28). A real `<form>`; **Enter submits.** The opening pill is a **disclosure** (`aria-expanded`, `aria-controls`) and pressing it again closes. **Focus into the first field on open, back to the pill on close. `Escape` closes keeping what was typed.**

Fields (deck §7): `Title` required ≤ 140 · `Section` (Personal · Freelance · Academics, default Personal) · `Due` optional day · `Put on calendar`, a switch **disabled until `Due` is set, with the note `Needs a due date.`** — and **clearing `Due` while it is on turns it off and restores that note.**

**Validation on submit only**, `aria-invalid` + `aria-describedby`, the message under the field in `.pe-said`'s register, **no hue**. `Give it a title.` **Fields go `readonly` while busy.**

Field order: title full width, then pairs — `Section | Due`, `Put on calendar` — **pairing at ≥406px of tile width and one column below**, which is CSS's (`@container tile (min-width:406px)`), already shipped.

Buttons are `.btn`; **`Add`, `Save` and `Keep` take `.btn.hi`; neither is `.btn.go`**, which stays unspent (§5.11). Busy `Adding…` / `Saving…` / `Deleting…`.

- [ ] **Step 3: Edit, delete, and the confirmation**

Tapping `.pe-edit-row` opens the same form in place with `Delete` added. **`Delete` sits apart at the left (`.pe-left{margin-right:auto}`) at resting emphasis with no red** — the confirmation is the safety, and the page's red is spent on lateness.

The confirmation **replaces the button row in place**: `Delete "Renew ID"?` · `Delete` · `Keep`, **focus on `Keep`**, `Escape` = `Keep`. For a pinned to-do it names the entry: **`Delete "Renew ID" and its calendar entry?`** (deck §15). **The two pills are one group that wraps together** (S4, round 5), so `Keep` is never orphaned on a line of its own under `Delete`.

- [ ] **Step 4: The pill is disabled where a form cannot exist**

`formCapable(span) === false` → `+ To-do` is **`disabled`** with **`Too narrow for the form.`** (deck §15) in `.pe-said`'s register **under the head**, and `aria-describedby` pointing at it (R28, R40; mockup 3343–3354). **Refused before the fact; no arrangement is removed** — `−` still runs to span 2 on every tile. The same mechanism serves R20 (every layer off) and R42 (Google not connected or expired) on the Today tile.

- [ ] **Step 5: Check and commit**

On 3001, at a span-4 tile: open `+ To-do`, add one, confirm the row appears and the count moves; tick it and confirm it leaves **both** this tile and Today at the same instant; edit it; delete it through the confirmation. **Measured to report:** the to-do form at span 4 is one column top to bottom, its well **340.5px** and its tile **426.35px** (§4.9).

```
feat(p10c): Tile 2 - the to-do list, and the form that adds and edits
```

---

## Task 4: Tile 1 — Today, the hero, and `EventForm`

**Rulings implemented:** R8→R52→**R79–R85** · R10 · R16 · R17 · R21 · R28 · R40 · R42 · R67 · R74 · R75 · R78 · R83 · P8 R36 · P8 R51 · §4.1 · §4.9 · deck §6 Tile 1 · deck §15.

**Files:**
- Modify: `src/app/(app)/personal/_blocks/Today.tsx`
- Create: `src/app/(app)/personal/EventForm.tsx`

- [ ] **Step 1: Two groups, in order**

Eyebrow `Today`, heading the date (`Thu 10 Sep`, `.fl-h`), control `+ Event`. **`SCHEDULED`**, then **`DUE`**.

`SCHEDULED` — today's events from every switched-on layer, **all-day first then by start time**. Row grammar: `72px | minmax(0,1fr) | auto` — time (`all day` in the same slot), title on one line with an ellipsis, layer tag. Two-line below 480px of tile width, **with the anchor placed as the grid item** (placing the span inside it would leave the anchor auto-placed in the time column, which then grows to the title's width).

**Every event row links out to Google, and the row is not the anchor** (P8 R36): `.fl-biz`'s anchor with the persistent `↗`, `target="_blank" rel="noopener noreferrer"`.

**`Nothing scheduled.` is suppressed whenever any enabled layer is unread** (P8 R51) — Plan B's type already enforces it, and the JSX must not reintroduce it with a `rows.length === 0` test of its own.

Failure sentences, all from deck §6 / §15, each with its dot: `Couldn't read Classes.` · `Couldn't read the calendar.` · `Google isn't connected yet. Set it up in Settings.` · `Google access has expired. Renew it from Settings.` · `No calendars chosen. Pick them in Settings.` · `Couldn't load layers, so the calendar wasn't read.` · `All layers are switched off.` · and **`Classes is no longer on your Google account. Untick it in Settings.`** in `.fl-empty`'s 13px `--ink-3` **with no dot** (R42 — permanent, and it hands over a lever). Bound 20, then `Showing 20 of 26.` **Today's calendar sentence goes after the rows that arrived** (deck), never pinned to a foot.

`DUE` — to-dos due today, then overdue, **merged into one list**; ticks behave exactly as in the To-do tile. Empty: `Nothing due.` Unreadable: `Couldn't load to-dos.`

- [ ] **Step 2: `space-between`, here and nowhere else**

`.pe-body.is-pair` fires **only when both groups are empty** (R17). With both empty, the blank hero measures **213.35px** in a 340px row and 123px of dead air under `Nothing due.` reads as failed content; spread, the air is enclosed by two real findings and the bottom edge carries content.

**With rows under `SCHEDULED` and nothing under `DUE` the tile top-aligns** — dropping `Nothing due.` to the bottom edge would open exactly the air the rule exists to close. Plan B's `spread` boolean decides it; **no other tile spreads.**

- [ ] **Step 3: The ramp — `heroTint`, one class, nine states**

`className={"pe-tile is-hero" + (tint === null ? "" : " pe-t" + tint)}`. **That is the whole mechanism.** No inline style, no per-render custom property, no runtime colour maths (R80).

**Seven facts this task must not get wrong**, because three earlier rulings say otherwise and their text is still in the old round papers:

1. **The ramp is R79–R84.** ~~R8's hueless mark~~ → overruled by **R52** → ~~R52's two states and its four-or-more threshold~~ and ~~R70–R72's two-recipe machinery~~ → superseded by **R79–R84**. `.is-clear` and `.is-busy` do not exist. **`PERSONAL_HERO_BUSY_AT` does not exist.** What survives from R8 is the feature radius, the untinted render's ground and border, and the honest-render principle.
2. **`pending` is to-dos due today + to-dos overdue. Nothing else.** Scheduled events never count, however many there are. **An overdue to-do counts as one** (R85, Riku: *"No — it just counts as one."*).
3. **`pending` is a free read** (R70): it is the row count of the `DUE` group this tile already renders. `Nothing due.` renders ⟺ `pending = 0` ⟺ `.pe-t0`.
4. **The untinted hero means exactly one thing: the to-do store did not answer** (R83). Not "a few", not "unknown for some other reason".
5. **The tint answers to the to-do read alone** (R74). A calendar failure, a `none-enabled`, a vanished layer, a half-read window — **none of them touches the tint.** Getting this wrong would make the hero say *"I don't know what's pending"* because **Google** did not answer, which is a plain falsehood. Three specimen panes are the proof: the expired-Google hero, the all-layers-off hero and the "Did not answer" hero **all tint green**, because their to-do read answered `Nothing due.` **The amber dot is what tells them apart.**
6. **The tint survives edit mode (R75) and an open form (R78), undimmed and unswapped.** R44 dims *controls*, because controls genuinely stop responding; a tint is not a control. Opening a form is the same event as opening the editor under a different name: **the count was read; the form covers the group that displays it, not the read that produced it.** Under R83, untinting for a form would be a false statement at the exact moment Riku is adding to the day.
7. **The tint is decided at render and refresh time, never live mid-interaction** (R67). Adding a to-do that takes the count from 2 to 3 does not warm the hero as the form closes; the next server render does it.

**And the register rule that contains the whole exception** (R84): **hue in a background wash means volume; hue in ink, on a dot, or on a row means what R9 says.** R9's four **ink** places stay exactly four. Nothing else on the page gains a tint by extension.

- [ ] **Step 4: `EventForm`**

Fields (deck §7): `Title` required ≤ 200 · `Calendar` · `Date` · `All day` · `Start` · `End`. **`Calendar` lists switched-on layers only**, so a created event lands on a visible layer; the default is the **first enabled layer** — **and if Riku wants a fixed default it is one more settings field; do not add it speculatively** (§10 item 11).

**`End` tracks `Start + 1h` until edited.** **Defaults (today, the next full hour, +1h) are computed on the server in `APP_TZ`** — a client-computed default would be the browser's zone, and would be wrong for exactly the user this app has. **`All day` hides `Start`/`End` with `hidden`** (the attribute; `[hidden]{display:none!important}` is in the reset), never by unmounting, so what was typed survives the toggle.

Validation: `Give it a title.` · `End must be after start.` — **on submit only**.

**The outcomes, and the asymmetry is the point:**

| Outcome | Render |
|---|---|
| Google **refused** | `Google didn't accept it: <its reason>.` above the buttons, the form stays open, **`Add` re-enables** |
| **Timed out** | **`Couldn't reach Google. Check the calendar before trying again.`** · `Add` **stays disabled** · `Cancel` is the only live control · **and Today and Next 7 days re-read** so a landed request shows itself |
| Partial success | the form closes and says its sentence under the head |
| Outside the week | **`Added. It's on Fri 24 Oct, outside this week.`** (deck §15) — so a successful add that lands where the page cannot show it does not read as nothing having happened |
| Success | the form closes; Today and Next 7 days re-read |

That timeout row is `CLAUDE.md`'s rule in one control: **failed *after* the side effect, or unknown → park for human verification. Never guess.** Re-enabling `Add` there would invite a duplicate event.

- [ ] **Step 5: Check and commit**

On 3001: the blank hero spreads and tints **green**; add an event and confirm the hero **top-aligns** and the row appears; add three to-dos due today and confirm the hero reads **`.pe-t3`** after the refresh and **not before the form closes**; **measured to report:** the event form's well is **322px** and its tile **421.35px**, so it grows row 1 from 340 to 421 — **visible and stated, which is the point** (§4.9).

```
feat(p10c): Tile 1 - the hero, the nine-step ramp, and the event form
```

---

## Task 5: Tile 5 — Next 7 days, and the one disclosure

**Rulings implemented:** R4 · R16 · R18 · R19 · R45 · R51/R51b · R56–R69 · R77 · R88 · R90 · R94 · §4.5 · §5.6 · deck §6 Tile 5 · deck §11.

**Files:**
- Modify: `src/app/(app)/personal/_blocks/Week.tsx`

- [ ] **Step 1: The day rows**

Tomorrow through the seventh day, **one row each, events and dated to-dos together**. Day row grammar: `56px | minmax(0,1fr)`, baseline-aligned; the day label in its own fixed track, **outside `.sumrow` entirely** (R57). Items are a wrapping flex row of `time · title · layer` groups at 13px `--ink-2`, to-dos with a tick.

**Two inner columns — days 1–4 left, 5–7 right — at ≥720px of tile width** (R4, R51): **one chronological list in the markup at every width**, split by CSS's `grid-auto-flow: column`. The JSX emits seven rows in order and nothing else; **the only thing that moves is which row gets its hairline suppressed**, and that is `.pe-week > .pe-row:nth-child(5){border-top:0}`, already shipped.

- [ ] **Step 2: The disclosure — native `<details>`, in exactly one place**

**Structure by item count** (R57), and the 0- and 1-item renders are **byte-identical to a page with no disclosure at all**:

| Items | Second cell |
|---|---|
| 0 | `<span className="pe-dash">—</span>` (R69) |
| 1 | `<span className="pe-items">` with one `.pe-it` — **never** wrapped in `<details>` (R57, R77) |
| 2+ | `<details className="disclose">` → `<summary>`/`.sumrow` → `.fl-open` → the same `.pe-items` markup with **every** item in it |

Wrapping a single item would be a click that does nothing, and would make a 1-item and a 2-item day harder to tell apart by silhouette — which R58 leans on.

**The vocabulary is the shipped one, wholesale** (R56): `.disclose` → `<summary>` → `.sumrow`'s grid → the short title, `.fl-count`, the chevron pseudo-element. **No `.fl-collapsed`** — `Campaigns.tsx`, not `Approaches.tsx`, is the analogue: a day row has no generic heading needing a second data-driven line, because the day label sits outside `.sumrow`.

**The short title is the leading item's own title, bare** (R58) — `Math Methods`, `Baguio trip`. The leading item comes from the sort order the tile already defines (all-day first, then timed by start, then to-dos), **so no new ordering rule exists. No time prefix and no tag**: a time would make the string's shape depend on whether the leading item happens to be timed, untimed or all-day — three silhouettes for one slot.

**The count is `.fl-count`, formatted `2 items`** — **R90, ratified by Riku 2026-09-25 and now in deck §15.** Not a bare number: Campaigns' bare `2` works because its eyebrow says what is counted, and a day row's `.sumrow` has no label above it. `items` is deliberately generic — the list mixes events and to-dos. **No singular form is needed**, because the disclosure exists only at 2+, and `1 items` must therefore be unreachable.

**Behaviour, and every bit of it is native** (R60–R63, R68): every day loads **closed**, whatever it holds — **no data-driven `defaultOpen`**, because "has 2+ items" is not a state worth pre-surfacing and it would make the week's collapsed height unpredictable from render to render. **Each day's state is independent**; opening one never closes another. **An open day pushes the row's height; it never overlays** — the deck's grid rule forecloses an overlay (*"nothing overlaps, nothing is transformed"*), and this is the identical treatment R28 gives the forms, for the identical reason: visible and stated. The row weight is a **minimum**, so this is legal by construction.

**No sixth island** (R68). `<details>` needs no script, no state and no effect; *"is this day open"* has no consumers, no persistence and no sharing — **it is not application state.** Written down so nobody goes looking for a missing island when the disclosure ships.

**Ticking inside an open day** (R67): the item vanishes from every tile at once through Task 2's context, but **the row's *shape* is decided only at render and refresh time** — a day ticked from 2 items down to 1 does **not** collapse from `<details>` to a plain span in front of Riku; it stays as rendered until the next `router.refresh()` re-evaluates it from server truth. `Approaches.tsx`'s documented behaviour is the precedent almost word for word.

- [ ] **Step 3: Failure, and the two kinds of dash**

**The calendar's sentence goes at the *top* of the tile** (R16) — never pinned to a bottom edge 130px from the rows it qualifies — and the days list to-dos only; `Couldn't load to-dos.` likewise, and the days list events only.

**With both feeds down the day rows are omitted entirely and the row keeps its weight** (R18, Riku's nod, deck §11): **seven dashes would be seven small lies.** Plan B's `days: null` is the mechanism; the JSX must not synthesise a fallback list.

**With every layer switched off the day rows render and `—` is a measurement** (R45): `none-enabled` is decided before any read, so there is no calendar source left to answer and the to-do store has answered. R18's condition holds vacuously.

**`—` means a day that was read and held nothing, and it takes `--ink-3`, not `.fl-trow .dash`'s absence ink** (R19) — a deliberate, recorded deviation from `DESIGN-INSPO.md` §5.14 rule 3 ("em-dash, never zero"). Written down so nobody "fixes" the seven dashes into blanks, and so nobody reads rule 3 as no longer binding for the Academics page.

- [ ] **Step 4: R88's confirmation, which this plan owns**

**Render a to-do row with `3 days late` at 106px (1 of 6) and report whether it fits on line two.** R38 already moves the due meta to its own line in the narrow band, where 80px of inner width should hold eleven characters of 9.5px mono. **The deck wins and `3 days late` ships** (R88); the mockup's three `3d late` panes are a drafting slip and are the design team's to correct (R95.2). **If it genuinely does not fit, that is a question for Riku** — an abbreviated string is his to approve, exactly as the eleven were — and **neither this plan nor the mockup may settle it.** Record the finding either way.

- [ ] **Step 5: R94's slack, which this plan must leave alone**

The two-column split shares row tracks across columns — day 1 pairs with day 5, day 2 with day 6, day 3 with day 7, day 4 alone — and grid's default `stretch` means **opening day 7 can leave visible slack under day 3's shorter, closed content, inside day 3's own row box.** **R94 is the verdict: the slack stays.** `align-items: start` is **not** applied. Three rules point the same way: R6 makes every tile fill its cell exactly, R17's honesty rulings and the settled "no filling the empty cell" both say real slack is shown rather than hidden. The slack reflects a **true height difference between two unrelated days** — a fact about the week, not a layout defect. **Look at it, confirm it reads as intentional, and do not tidy it.**

- [ ] **Step 6: Check and commit**

On 3001 at span 12: seven day rows, two inner columns, the fifth row's hairline suppressed. Open a 2-item day and a 3-item day; confirm **`2 items` / `3 items`**, that a **1-item day has no disclosure**, that an **open day pushes and never overlays**, that opening one does not close another, and that **keyboard `Enter`/`Space` on the summary works with no script**. Open only `Mon 26` beside a closed `Thu 22` and look at R94's slack. **Measure and report the two heights R65 left uncaptioned** (§10 item 6): **the fully-open busy week** and **the mixed open/closed week** — which is the state Riku will actually see most often. The collapsed pair is already known: **240px** at two columns and **362.75px** at one. **Do not derive them; measure them.**

```
feat(p10c): Tile 5 - the week, and the one native disclosure
```

---

## Task 6: Tiles 4 and 6 — the push quotation, and Done this week

Together because neither has an island and both are short.

**Rulings implemented:** R11 · R14 · R21 · R22 · R86 §I item 4 · C18 · §4.4 · §4.6 · deck §6 Tiles 4 and 6 · deck §12 · deck §15.

**Files:**
- Modify: `src/app/(app)/personal/_blocks/Push.tsx` · `Done.tsx`

- [ ] **Step 1: The push tile is a quotation** (R14)

Eyebrow `This morning's push` (**curly apostrophe**), stamp `sent 07:00` (`.pe-stamp`, 11px `--ink-3`, tabular, **`sentAt` rendered in `APP_TZ` — never the cron's nominal hour**). Title in `.pe-ptitle`; body in the `.pe-quote` well, **exactly as sent**.

**Never clamped, never `+N more`, nothing recomputed, and nothing inside a quoted push is ever hued** — **this tile quotes, it never evaluates.** `devices` stays on the model and **is not rendered**.

Six states, from Plan B's `PushTileView`, and **it can tell "no push" from "no record"** (R22): a record for today → quote it · a successful dispatcher run today with no record → **`A push went out this morning. Its text wasn't stored.`** in `.fl-absent`'s register **with no dot** · no record → **`No push this morning.`** and beneath it `Last: Tue 9 Sep 07:00` with that push's text in the well · never stored → `No push recorded yet.` · monitoring off → `Monitoring is off, so no push goes out.`, **outranked by a push stored for today** · unreadable → `Couldn't load this morning's push.`

**`No push this morning.` takes the `--missing` dot only once `now` in `APP_TZ` is past `PUSH_EXPECTED_HOUR`** (R22, nodded by Riku in deck §15). **Before 07:00 the sentence stands undotted** — it is true at 00:30, and only the alarm would lie. **This is the one `--missing` dot on the page that is not lateness**: an expected event that did not happen.

- [ ] **Step 2: Done this week, and the page's one in-flight surface**

Eyebrow `Done this week`, count `3` / `1`, **absent at zero**. **`.pe-head.is-inline`** (R11, C18): the second cell holds the count when populated and **`Nothing ticked off yet this week.`** when empty — one grammar, both of the deck's renders.

Rows: a **quiet** ticked box (`--line` border, `--ink-3` check), title, section tag, `Mon 8` in mono `--ink-3`. Most recent first. Tapping the box un-ticks; **the row leaves and the to-do returns to its section**; the accessible name is `Undo "Renew ID"`. Bound 20, then `Showing 20 of 31.` Unreadable: `Couldn't load to-dos.`

**Why the tick is a check and not a fill:** solid fills are rationed to one per screen, and Done this week alone would put twenty on the page.

**This row is the surface of the page's one in-flight state.** A to-do marked done that still holds a `calendarEventId` is an entry Google refused to remove; its Done row carries **`entry left on Google`** (deck §15) until a retry clears it. **Nothing is left silently `pending` and nothing is swept by a job** — the design doc's earlier *"there is no in-flight status to sweep"* was wrong and is corrected (R86 §I item 4). The open row of a to-do whose entry could not be moved after a date change carries **`entry on the old day`** the same way.

- [ ] **Step 3: Check and commit**

On 3001: with no push stored, the tile reads `No push recorded yet.`; **change the system clock or the fixture to before and after 07:00 Manila and confirm the dot appears only after** — that boundary is the one thing in this tile that can lie. Tick a to-do, see it in Done, un-tick it, see it return. **Done's count must be absent at zero and `0` must never render.**

```
feat(p10c): Tiles 4 and 6 - the push quoted verbatim, and Done this week
```

---

## Task 7: Tile 3 — Layers, and `LayerSwitches`

**Rulings implemented:** R15 · R20 · R42 · S11 (round 5) · §4.3 · deck §6 Tile 3 · deck §9 · deck §15.

**Files:**
- Modify: `src/app/(app)/personal/_blocks/Layers.tsx`
- Create: `src/app/(app)/personal/LayerSwitches.tsx`

- [ ] **Step 1: The whole row is the switch** (R15)

`DESIGN-INSPO.md` §5.11's `.layer` row ported **minus the colour dot and minus `.ct`**: `<button role="switch" aria-checked>` containing the name and the `.swx` pill, `padding: 8px 0`, `--line-soft` separators, `min-height:44px` below 480px of tile width (already in CSS).

**The name is `--ink-2` in both states; the knob carries the state.** On: `--ink` border and knob. Off: `--line` border, `--ink-4` knob. **The reference's 35%-opacity off row is declined** — it would drop the label of a control to 1.8:1. **Busy: `:disabled` at `.45` on that row only.**

**Layer hues are declined for this page** (R9): `DESIGN-INSPO.md` §5.11's layer-colour map does not apply, and it is recorded there as a reference-level note so the Academics phase does not read it as binding. **No hue on a layer name, ever.**

- [ ] **Step 2: The states, and the one that must match Settings**

**When the calendar window reports `not-configured` or `expired`, the tile shows Tile 1's matching sentence and no switches** — the page tile must match the Settings card (deck §9). **On a per-layer or whole-calendar read failure the switches stay live**, because switching is still meaningful.

Strings: **`Couldn't save.`** under the row on a failed write **with the knob returned** · **`Couldn't tell if that saved.`** (deck §15) when the write timed out, **with the knob *not* returned** — because a request that timed out may have landed, and returning the knob would assert an outcome nobody knows · `No calendars chosen. Pick them in Settings.` · `Couldn't load layers.`

**A vanished calendar keeps its row** (R42) and carries `Classes is no longer on your Google account. Untick it in Settings.` where that layer's couldn't-read would have sat — `.fl-empty`'s 13px `--ink-3`, **no dot**.

- [ ] **Step 3: The write**

Saved on tap, through `PATCH /api/settings` with the whole `layers` array. **The box is disabled while saving; the tile is otherwise never busy.** **Last-write-wins from two devices is accepted and recorded** (§7.5) — the Layers tile and the Settings picker both PATCH the whole array, and a single-user tool does not need a version field for it.

**The push respects these switches too**: a calendar switched off here does not appear in the morning push (deck §6 Tile 3) — which is already true, because Plan B's morning route reads `layers` and `readCalendarWindow` filters on `enabled`.

- [ ] **Step 4: Check and commit**

On 3001 at span 3: three switch rows, each ≥44px tall at that width; toggle one and confirm it persists across a reload; **confirm `.pe-layers` does not overflow at 106px** — its columns are `minmax(0,1fr)` precisely so an auto track cannot take the switch row's min-content and push the knob into the padding (S11, round 5).

```
feat(p10c): Tile 3 - the layers, with the whole row as the switch
```

---

## Task 8: Edit mode — four signals, none of them a colour

The largest task, and the one with the most ways to be subtly wrong.

**Rulings implemented:** R1 · R3 · R5→R53→**R91** · R29 · R30 · R31 · R44 · R62 · R75 · M6 · §4.7 · §4.8 · §5.7 · deck §8 · deck §15 · D7.

**Files:**
- Modify: `src/app/(app)/personal/LayoutEditor.tsx`

- [ ] **Step 1: The four signals** (R30)

1. **Three pills where there was one** — `Reset to default` · gap (`.pe-sep`, `--sp-4`) · `Cancel` · `Save`. **`Save` is `.btn.hi`**, the system's high rung; the other two rest (P8 R18's ladder).
2. **The grid sunk into a `--panel` well** — `.pe-edit`, the negative margin exactly the padding **so nothing shifts**. The well **wraps** `.pe-wrap` rather than being applied to it, so the container's inline size is unchanged. **M6's `.fl > .pe-edit` margin rule is what makes "nothing shifts" true**, and it is already in the stylesheet — **measured: title→grid is 28px in specimen 01 and 28px in specimen 04.**
3. **A toolbar in the foot of every tile.**
4. **The row's leftover drawn dashed** — `1px dashed var(--line)`, no fill, no caption, `--r-card`, **never focusable, never a drop target**.

**None of the four is a colour.** No hue appears on any edit-mode surface (§5.9).

**The header's control row is `position: sticky; top: 0` on a `--void` ground, in edit mode only**, with 10px bottom padding as clearance for the stuck state and a −10px margin giving it back. **No ancestor of the header may take `container-type`** — containment silently kills sticky, and it would also break S20's `@media` threshold (R30, R87). This is a rule about what this task must **not** add.

- [ ] **Step 2: Contents stay, and controls dim** (R44)

**Edit mode keeps every tile's contents, controls included.** `.pe-head` and `.pe-body` take **`inert`** — out of the tab order **and** out of hit testing — **so a tap is a layout gesture and never a tick**; the foot keeps the live toolbar. Controls inside an inert region render at `.btn:disabled`'s `opacity:.45`.

**A to-do row's *title* does not dim** — it is the tile's content, not a signal. **The dimmed pill is the honest form of "the tiles keep rendering live data", not a fifth signal.** Deck §8's *"never touches tile contents"* is now **literally true of the DOM**.

**`inert` is also what guarantees the refresh rule:** while edit mode is open nothing else can call `router.refresh()`, because nothing inside the bodies can be tapped (§7.3).

- [ ] **Step 3: Three things close on entry**

**An open form closes, keeping what was typed. Every open day closes** (R62) — the same way R30 closes an open form, and for the same reason: a day left open would sit there dimmed, consuming its expanded height, while Riku is trying to judge and resize the rows around it. **Sparse-row `auto` is suspended** (R5's surviving half), so a move never resizes a row Riku is not touching — `buildTracks(working, true)` returns no `auto`.

Closing every open day means the `<details>` elements must be re-rendered closed. **Do not reach into the DOM**: re-key the tile subtree or render the day rows with `open={false}` — a native `<details>` with no `open` attribute is closed, and React re-rendering it is enough. **No effect, no ref, no `querySelectorAll`.**

- [ ] **Step 4: The toolbar** (R29, §5.7)

`.pe-bar` is `.course .foot`'s shipped shape. Four arrows in a 108px group, then the stepper (`.pe-step`), then the caption on its own line (`flex-basis:100%`).

**Arrow glyphs are literal characters in the mono face** — U+2190–2193 have no emoji presentation (R26). **Check on a phone** — that is a real step, not a note.

**It wraps before it clips.** 108px of arrows need 134px of tile, so at 1 of 6 (106px) the group wraps **2×2** into a 52×52 block and the stepper drops to the next line — **the tile carries `overflow:hidden`, so the fourth arrow would otherwise be invisible *and* unreachable by pointer.** All of that is CSS and is already shipped; this task's job is to emit the markup in the order the CSS expects.

The caption is sentence case as the deck writes it: **`2 columns left` · `1 column left` · `row full`**, with `aria-live="polite"`.

**The stepper shows the twelve-column span even at six columns**, and that cost is accepted with the cost visible (R1): a tile that is visibly 1 of 6 reads `3` on its stepper, because twelve-column spans are the only number the editor can change.

- [ ] **Step 5: Focus and disabling** (R31)

- **Entering moves focus to the first tile's `←`.** `Escape` anywhere is `Cancel`. **Leaving returns focus to `Edit layout`.**
- **Cells are keyed by tile id** so a moved tile keeps its DOM node and its focus.
- **A button that disables itself hands focus to its sibling** — `+`→`−`, `→`→`←`, `↓`→`↑`.
- Disabled: `←`/`→` at a row's ends · `↑`/`↓` in row 1 / row 4 **or when the neighbouring row has fewer than `span` columns free** · `−` at span 2 · `+` when the row sums to 12 · **`Save` until something changed** · **`Reset to default` when the working copy already equals the default**.
- **Empty rows are legal** and `↑`/`↓` do not prevent them.
- **`+` is disabled by the twelve-column sum alone; the editor does not import `collapseRow`** (R1) — a `+` dimmed for a width Riku cannot see declines the move its own caption promises.

**Focus moving without an effect.** Every focus move here is inside an event handler — a click, a keydown, a submit — never a render. That is what keeps R33 true: an island that moves focus in an effect is an island with a `useEffect`, and the fifth lint error.

- [ ] **Step 6: Save, Cancel, Reset**

**`Save`:** `Saving…`, everything disabled, `PATCH /api/settings`, then `router.refresh()`. **Failure: `Couldn't save the layout.` beside the pills, with the mode open and the changes intact** (deck §8, §15) — **never leave an in-flight state behind**, and the changes are the state. **`Cancel`: no confirmation** (the deck gives none; Riku ratified it). **`Reset to default`: loads the default into the working copy, no confirmation — it still needs `Save`.**

**A row would exceed 12 columns: the move or `+` is disabled rather than refused after the fact** (deck §8). The server still validates (`validateLayout`, strict) — **both**, because a disabled button is a courtesy and the 400 is the guarantee.

Accessible names, approved as proposed and never visible text: `Move Today left`, `Widen Today`.

- [ ] **Step 7: `formCapable` in the editor**

The pill's disabled state must agree with itself in edit mode, where the span is the **working copy's**. `formCapable(workingSpan)` — so narrowing a tile to span 2 in the editor and saving produces a page whose pill is off, and the caption already said so.

- [ ] **Step 8: Check and commit**

On 3001, at a viewport wide enough for the 170 + 920 column: enter edit mode and confirm **title→grid does not move** (measure it — M6 is the rule that makes this true and its failure is a 14px jump); the well, the three pills, six toolbars and **one dashed leftover**; the pill row **sticks** when you scroll; every body is `inert` (tap a tick — **nothing happens**); the hero **stays tinted** (R75); every open day closed on entry (R62). Then: `←`/`→`/`↑`/`↓`/`−`/`+` through the full disabling matrix, `Escape` = `Cancel`, focus landing on `Edit layout` on exit, focus surviving a move. **Measured to report:** specimen 04's four rows render **382 · 263 · 305 · 162**; the shrink case drops row 1 from **340 to 131** when the push tile is its only occupant (R53/R91); **a row holding two tiles summing to 5 of 12 keeps its weight** and shows seven columns of bare ground (R91 — look at it; nobody has).

```
feat(p10c): edit mode - four signals, inert bodies, the full focus matrix
```

---

## Task 9: The two Settings cards

**Rulings implemented:** R24 · R42 · R43 · R46 · M8 · §4.10 · §6.1 · deck §9 · deck §15 · D10.

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`
- Create: `src/app/(app)/settings/_blocks/AgentSwitches.tsx`
- Create: `src/app/(app)/settings/_blocks/CalendarPicker.tsx`
- Modify: `src/lib/personalView.ts` and `src/lib/__tests__/personalView.test.ts` (one builder and its tests — see step 3)

### Read this before running lint after this task

**`/settings/page.tsx` is currently `"use client"` and holds one of the four baseline lint errors** (`settings/page.tsx:35`, a `setState` in an effect). This task converts the page to a **server component** and moves its existing client body **verbatim** into `_blocks/AgentSwitches.tsx`. **The `useEffect` travels with it, so the error travels with it: the count stays four, at a new path.** That is the expected outcome. **Do not "fix" it** — rewriting that effect is a change to a working P3 feature inside a P10 page task, and the baseline is four errors, not three.

- [ ] **Step 1: The page becomes a server component**

It must, because **`Connected.` means one thing precisely: a calendar list came back** (R24, nodded by Riku, deck §15) — not that a token exists, not that the sign-in worked. **The Settings page calls `listCalendars()` once, server-side, and derives *both* cards from that one answer.** `GET /api/google/status` is cut and `GET /api/google/calendars` was cut in Plan B, so there is no client route to call. The state between pasting the token and enabling the Calendar API is **the first one Riku will hit, and only the list proves it.**

The page reads `readOsSettings()` and `listCalendars()`, passes the agent settings into `<AgentSwitches initial={…} />` and the two derived cards' data into the card JSX and `<CalendarPicker …/>`. **The existing agent-switch markup, strings and behaviour are moved and not edited** — `legacy.css`'s `.card` / `.meta` / `.row` grammar stays, and **`/settings` having no heading of any level stays P8's open carry-forward** (§10 item 10): a page that now gains **two** cards under no title is recorded, not fixed here.

- [ ] **Step 2: `Google Calendar` — the connection card**

Four sentences, from deck §9, derived from the one `listCalendars()` answer: **`Connected.`** · **`Not set up. Add the three Google values to the environment and redeploy.`** · **`Access expired. Run the sign-in again and replace the token.`** · **`Couldn't check right now.`** No dot, no hue — `legacy.css`'s `<p>` register.

- [ ] **Step 3: `Calendar layers` — the picker, and the one decision that goes in a pure module**

**The card is the heading and the list, nothing else: the intro sentence is deleted** (M8).

Rows are `.pickrow` (R46's eighth shared item): tick, name, `padding:8px 0`, `min-height:40px`, `--line-soft` separators. **Saved on tap; the box is disabled while saving; failure `Couldn't save.`** Google not set up or expired → **the card shows the connection card's own sentence and no list**, because a picker with nothing in it reads as a page that failed rather than a connection that was never made. Couldn't list → **`Couldn't list your calendars.`**

**`Up to 10 calendars.` is a press outcome, not a footnote** (R43). It renders **under the row whose tick was refused, at the moment it is refused, and never as a standing note on the card.** The mockup does not draw it — Riku has six calendars and inventing five more would break the no-sample-data rule.

**The build derives the picker's rows from the stored `layers` array joined against Google's list, not from Google's list alone** (R42), **and that join is the one decision in this task that belongs in a pure module.** So it goes into `personalView.ts` with a test, exactly as P8c put R66's filter into `freelanceVariants.ts`:

```ts
export function pickerRows(
  stored: readonly Layer[], fromGoogle: readonly { id: string; summary: string }[],
): Array<{ calendarId: string; name: string; ticked: boolean; note: string | null }>;
```

**A vanished calendar keeps its row** — stored, ticked, **live**, so there is something to untick — and carries **`Classes is no longer on your Google account. Untick it in Settings.`** under the name in **`.fl-note`**'s recipe, with **no dot**: kind 2 in the Honesty Critic's table, because the state is permanent and the sentence hands over a lever. **Not `--stale`** (transient) and **not `--missing`** (R9's four places stay four). `.pickrow:has(.fl-note)` aligns the tick with the name's line, already shipped.

**Tests** (in `personalView.test.ts`, beside the rest): a stored layer absent from Google's list keeps its row, stays ticked, and gets the note; a Google calendar not in `layers` appears unticked with no note; **stored order is preserved** (membership order is display order, D10); an eleventh tick is refused with `Up to 10 calendars.`

- [ ] **Step 4: `.pe-said` does not appear on this page**

Every press outcome here — `Up to 10 calendars.`, `Couldn't save.`, `Couldn't list your calendars.`, the vanished-calendar note — renders as **`.fl-note`** (11px `--ink-3`, `components.css`), because **`pe-` is the Personal page's namespace and nothing else's** (R46) and the spec's phrase *"in `.pe-said`'s register"* names a register, not a class. `components.css` already carries `.pickrow .fl-note{display:block;margin-top:2px}` for exactly this.

- [ ] **Step 5: Check and commit**

`npm test` (the new `pickerRows` tests pass; **report the count**) · `npx tsc --noEmit` · **`npm run lint` → four errors and three warnings, with one error now at `settings/_blocks/AgentSwitches.tsx` instead of `settings/page.tsx`** · `npm run build`.

```bash
git grep -n 'pe-' -- "src/app/(app)/settings"        # no output, exit 1 (R46)
git grep -n 'api/google' -- src/app/api/             # no output: both routes stay cut
```

On 3001, `/settings`: the two existing cards work exactly as before (toggle the chaser, save the threshold); the two new cards render; tick and untick a calendar and confirm it appears and disappears from the Personal page's Layers tile. **Then break it on purpose:** unset `GOOGLE_REFRESH_TOKEN` in the environment for one `next start` and confirm **both** cards read `Not set up. …` and **the picker shows no list**.

```
feat(p10c): two Settings cards, and the page becomes a server component
```

---

## Task 10: `ARCHITECTURE.md`

**Rulings implemented:** design doc *Data model — the additions* · §2.

**Files:**
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Three sections, and one that is deliberately untouched**

- **§3.1** gains three rows: **`Todo`** (new — the fields, the two indexes, **no TTL, because done items are kept**), **`LastDigest`** (new singleton, fixed id), and **`OsSettings`** widened with `layers` and `personalLayout` (bounded typed arrays). The section's closing line — *"Calendar events are **never** stored (D5)"* — **stays exactly as it is, and is now load-bearing**: a `calendarEventId` is an id, not an event.
- **§4.2's Google Calendar line** becomes *RikuOS P10, OAuth refresh token in env, two scopes, read live + write-through + to-do pins.*
- **§5** gains the Today read in the morning flow, placed before `composeDigest`, with both new reads noted as caught into `"unavailable"`.
- **§7 is NOT edited.** **S19 and S20 are already recorded** and are not rewritten by any plan in this series. The only reason to touch §7 would be a *new* decision, and this phase ratified none — R87's 439px is a number derived from an existing decision, not a new one.

- [ ] **Step 2: Check and commit**

```bash
git diff -- ARCHITECTURE.md | grep -c '^+.*S19\|^+.*S20'    # 0
```

```
docs(p10c): ARCHITECTURE - the three collections, Google, the morning read
```

---

## Task 11: Verification

Run every check in order. **Do not claim completion until each one has produced the expected output in front of you.** Steps 6 and 7 are the phase's bar and are **not** claimable from a terminal.

**Files:** none modified.

- [ ] **Step 1: The standing trio and the lint baseline**

Run: `npm test` → every suite passes. **Report the count.** This plan adds **no test file**; it adds `pickerRows`'s tests to Plan B's `personalView.test.ts` (Task 9) and nothing else.
Run: `npx tsc --noEmit` → no output, exit 0.
Run: `npm run lint` → **four errors, three warnings** — with one error at `settings/_blocks/AgentSwitches.tsx` where it used to be at `settings/page.tsx`. **A fifth error means an island grew a `useEffect`.**
Run: `npm run build` → `✓ Compiled successfully`, `/personal` and `/settings` in the route table, `/personal` marked dynamic (`ƒ`).

- [ ] **Step 2: The rules this plan promised to keep**

```bash
# ZERO useEffect in any P10 island (R33) - the mechanism, not care
git grep -n 'useEffect' -- "src/app/(app)/personal"
# no output, exit 1

# FIVE islands, not six (R33, R68)
git grep -ln '"use client"' -- "src/app/(app)/personal"
# exactly five: LayoutEditor.tsx TodoRow.tsx TodoForm.tsx EventForm.tsx LayerSwitches.tsx
# Week.tsx must NOT appear - the day-row disclosure is native <details>

# no client READ, only mutations
git grep -n 'fetch(' -- "src/app/(app)/personal"
# only POST / PATCH / DELETE calls in the four mutating islands

git grep -n 'dangerouslySetInnerHTML\|NEXT_PUBLIC' -- "src/app/(app)/personal" "src/app/(app)/settings"
# no output, exit 1

# no stylesheet edit, no shell edit, no proxy edit, no new dependency
git diff --stat <plan-B-final-HEAD>..HEAD -- src/styles/ "src/app/(app)/_shell/" "src/app/(app)/layout.tsx" src/proxy.ts src/app/login/page.tsx package.json package-lock.json next.config.ts
# no output

# no Freelance page edit
git diff --stat <plan-B-final-HEAD>..HEAD -- "src/app/(app)/freelance/"
# no output

# the deleted / cut things stay gone
git grep -n 'pe-more\|+N more\|PERSONAL_HERO_BUSY_AT\|is-clear\|is-busy'
# no output, exit 1  (R89, R51b, R80, R79)
git grep -n 'd late' -- src/                       # no output, exit 1  (R88)
git grep -n 'align-items: *start' -- src/styles/personal.css
# no output, exit 1  (R94: stretch stays)
git grep -n 'container-type' -- src/styles/
# only .pe-wrap and .pe-cell's `container:` shorthand; NOTHING on an ancestor of
# the header (R30, R87)

# no hue token leaked into JSX
git grep -n 'var(--missing)\|var(--stale)\|var(--spend)' -- "src/app/(app)/personal"
# no output: every hue is a class, never an inline style

# the repo boundary
git -C ../ShikksTracker status --porcelain          # no output
git grep -n 'ST_API\|/api/os/' -- "src/app/(app)/personal"   # no output, exit 1
```

- [ ] **Step 3: By eye against the mockup, on real data, at a viewport wide enough for the column**

`npm run build`, then `npx next start -p 3001` — **`next start` reads `.env.local` exactly as `next dev` does, so the server calls the real Google account, and it cannot hot-reload, so what you are looking at is the committed code.** Open `docs/design/p10-mockup.html` in one tab and `http://localhost:3001/personal` in another, at a viewport wide enough for the 170 + 920 column (nominally 1240px; the number is not the test — the specimen fixes the column).

Against **specimen 01**, on Riku's real, quiet data — **the page's primary state, not an edge case** (deck constraint 3: it must look **deliberate and finished** when the week is blank and the to-do list has three headings and nothing under them):

1. **The four rows: 340 · 200 · 240 · 120, the grid 942px.** And the tiles' own heights under them — Today 213.35 · To-do 270.85 · Layers 191.85 · push 112.35 · Next 7 days 234.25 · Done this week 51.1. **No row on the blank page is being held open by its contents**, which is what makes the weights real. **A build never tightens row padding below 11px, shrinks type, or clips to hit a weight** — if a render reaches 240 with one column, it cheated.
2. **The hero spread and green.** `.is-pair`, `Nothing scheduled.` + `Nothing due.`, `.pe-t0`.
3. **One hue on the whole page** — the hero's green wash, and nothing else (§5.9, deck §12).
4. **One bare leftover** in row 2, at twelve columns: **no fill, no caption, no dashed outline.**
5. **Seven `—` day rows** in `--ink-3`, and the tile still 240px.
6. **`nothing open` under all three section labels, labels present.**
7. **Every tile's eyebrow present**, in every tile.
8. **The console.** Clean: no CSP violation, no hydration warning, no request to `fonts.googleapis.com` or `fonts.gstatic.com`.

Then **specimen 05's collapse**: narrow the window to a **932px** window → a **706px** grid → six columns. The default's spans halve rounded up and the tiles render **466 · 226 · 226 · 466 · 706 · 706**, the rows **551 · 200 · 362.75 · 210**. **The empty cell closes** (2+4=6, full) — and comes back when it widens. Report the figures.

Then **specimen 08's stack**: **390px**, the strip, **334px** of column, one column, both add pills **live** (they are, because span 8 and span 4 are both ≥ 3), every tile keeping its eyebrow, the switches 44px tall, **no dashed leftover** (a stack has no leftover).

- [ ] **Step 4: The failure states, the only way they can be checked**

Most of these cannot be produced from Riku's healthy account, so produce each the only way it can be produced and **report each one**:

| State | How |
|---|---|
| `Couldn't load layers, so the calendar wasn't read.` + every other Mongo sentence | one `next start` with a bad `MONGODB_URI` — **the deck §11 whole-page render, nine dots, and the week showing no day rows** |
| `Google isn't connected yet. …` | one `next start` with `GOOGLE_REFRESH_TOKEN` unset |
| `Google access has expired. …` | one `next start` with a deliberately invalid refresh token |
| `All layers are switched off.` + `—` days that are measurements | untick all three layers in Settings — **and the hero must still tint green** (R74/R45) |
| `Classes is no longer on your Google account. …` | PATCH a `layers` array containing a bogus `calendarId` |
| `Couldn't read Classes.` (one layer, others fine) | cannot be produced locally — **read specimen 03 beside the shipped JSX and confirm the rows that arrived render above the sentence** |
| `No calendars chosen. Pick them in Settings.` | PATCH `layers: []` |
| `Couldn't load your arrangement, so this is the default.` | PATCH a deliberately malformed `personalLayout` past the API by writing it directly, or stub `resolvePersonalLayout`'s input — the sentence and **the ninth dot** |

**In every one of these, confirm the grid still renders** (deck §11: there is no whole-page-down state) and that **no failure is ever rendered as data** (constraint 2).

- [ ] **Step 5: `npx next start -p 3001` on a phone-width window, and on a phone**

`/personal` at 390px: both forms **open** and the **date field sits inside its well**. **The arrow glyphs U+2190–2193 render as arrows and not as emoji** (R26 — this is the check that ruling asked for, and a phone is where it fails).

- [ ] **Step 6: Riku's hands — the consolidated list, in order, each surfaced when it blocks**

Items 1–4 were surfaced by Plan B and may already be done; 5–7 are this plan's.

1. **Google Cloud, ShikksTracker's project:** enable the **Google Calendar API**; create a **second OAuth client** (Web application) named for this app; add **one** redirect URI, **`http://localhost:8787/callback`**; add the two scopes on the consent screen; confirm **Publishing status: In production** — Testing kills the token every 7 days.
2. **Locally:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into `.env.local`, run `npm run google:auth`, consent, copy **the refresh token it prints once**.
3. **Vercel:** add the three `GOOGLE_*` variables; **redeploy.**
4. **Indexes:** `npm run migrate:indexes` to read the plan, then **`npm run migrate:indexes:apply`** — the two `Todo` indexes are created by that script, **not by Mongoose**, because `autoIndex` is off in production.
5. **Settings:** tick **Personal, Classes and Events** under *Calendar layers*.
6. **The two forms, on his phone:** open `+ Event` and `+ To-do` at the shell width he chose and **confirm the date field fits.** The form floor was measured in Chrome on Windows; **a floor that turns out to be too generous overflows the well on his device, and that is the failure that does not announce itself.**
7. **Wait for one 07:00 push** and confirm its Today sentence matches the day.

- [ ] **Step 7: The phase's bar, which no test can meet**

From the design doc and the roadmap, and **this is the only step that closes P10**:

> `/personal` live on Vercel reading Riku's real calendars and his real to-dos, **and one real morning push that has named what was actually due and scheduled that day.**

`CLAUDE.md`: *an agent feature is actually done when it has been observed doing its job once against real data.* **Plan B observed the push composed against a real calendar read, by triggering the cron manually. This step is the rest of it:**

1. **`/personal` on Vercel**, on Riku's real six calendars with the three chosen layers, rendering.
2. **Real to-dos**, added from the page, one with `Put on calendar` on — **and the entry appearing in Google Calendar on the due day.** Tick it and **confirm the entry is removed.** That is S19's projection working end to end, and it is the one write-through path in the phase.
3. **One *automatic* 07:00 push**, not a manual trigger, whose Today sentence names what was actually due and scheduled — **with at least one to-do in it**, because a `nothing due` sentence does not exercise the read the phase exists for.
4. **The push tile quoting that push** the same morning, with `sent 07:00` in `APP_TZ`.

- [ ] **Step 8: The post-build record**

Append: the plan-start and plan-end HEADs, the test count, every measured figure from step 3, every state observed in step 4, R88's `3 days late` finding at 106px (Task 5 step 4), R65's two measured week heights (Task 5 step 6), R94's slack judged by eye (Task 5 step 5), R91's two-tile sparse row looked at (Task 8 step 8), and **every planning assumption a builder had to make.** Three are already known and are recorded as rulings in the plans rather than guesses: **`GET /api/google/calendars` is cut** (Plan B, Task 6), **`formCapable(span) = span >= 3`** (Plan B, Task 4), and **`.fl-note` replaces `.pe-said` on the Settings page** (this plan's deviation 4). If any other guess was made, name it here.

---

## Self-review

Before declaring P10 done, confirm each of the following is true of the repo, not of the plan:

- [ ] `git grep -n useEffect 'src/app/(app)/personal/'` is empty, and exactly **five** files there carry `"use client"`.
- [ ] `Week.tsx` is a server component and the day-row disclosure is a native `<details>` with no script.
- [ ] The hero's class is `is-hero` plus at most one `pe-t{0..8}`; `heroTint` is called with the `DUE` count or `null` and **never** with anything derived from the calendar; the tint is unchanged in edit mode and behind an open form.
- [ ] `.pe-more`, `+N more`, `PERSONAL_HERO_BUSY_AT`, `.is-clear`, `.is-busy` and `3d late` do not exist anywhere in `src/`.
- [ ] `2 items` / `3 items` render on a 2+ day; a 1-item day has no `<details>`; `1 items` is unreachable.
- [ ] No stylesheet, no shell file, no `_shell/` component, no Freelance file, no proxy file and no `package.json` changed in this plan.
- [ ] Every mutating island ends its success path in `router.refresh()`; every timeout says `Couldn't tell if that saved.` and none asserts a failure it cannot know; a failed press restores nothing locally.
- [ ] Edit mode: four signals and no colour; title→grid measured identical in and out; every body `inert`; every open day closed on entry; `Save` failure keeps the mode open with the changes intact.
- [ ] `/settings` carries no `pe-` class, calls `listCalendars()` once server-side, and derives both cards from that one answer.
- [ ] `ARCHITECTURE.md` §3.1, §4.2 and §5 updated; **§7 untouched.**
- [ ] `npm test` · `npx tsc --noEmit` · `npm run build` green; `npm run lint` at **four errors and three warnings**.
- [ ] `git -C ../ShikksTracker status --porcelain` is empty.
- [ ] Step 7's four observations are recorded, with dates.


---

## Post-build record (executed 2026-10-03)

The verification lead ran these checks against the repo, not against earlier reports. Every figure below was produced on 2026-10-03 with headless Chromium (Playwright, from the npx cache) against `next start -p 3021`, on Windows. Mutations were intercepted in the browser: every `/api/**` POST, PATCH and DELETE was aborted or answered with a canned reply, and the request log shows only intercepted PATCHes and GET reads. **Nothing was written to Riku's database or Google account (L2).**

Some states cannot be produced from Riku's account without a write. They were produced with a temporary local stub in `page.tsx` that overrides the settings, to-dos, digest or `now` after the real reads; one other used `week-busy-stub.patch`. Neither was committed. The tree was restored and `.next` rebuilt from clean HEAD after the run. Every stubbed figure says so.

### HEADs

- **Plan start:** `bb103cf` (`bb103cf610aa456933342931687624c47c4fc9d3`).
- **Build end:** `1b5af42` (`1b5af42208130844ca7c29d51ec23a4792a1be9e`).
  - The browser run was made at `d4c5ea7`.
  - `1b5af42` (L1e) followed it. The trio, lint and greps were re-run at `1b5af42`, and L1e's two effects were re-measured in the browser there.
- This record is the one commit after the build end.

### Commits

`git log --oneline bb103cf..1b5af42`, oldest first, 29 commits:

- `ec0a2bc` feat(p10c): two Settings cards, and the page becomes a server component
- `81b659a` feat(p10c): /personal - the data layer, one calendar promise, two boundaries
- `6c103ba` fix(p10c): a press that got no answer from the door never says it failed
- `b4916b7` fix(p10c): the Today fallback carries the tint, and the fallen-back sentence its 14px
- `cf08df4` feat(p10c): Tile 3 - the layers, with the whole row as the switch
- `e63e0b0` feat(p10c): TodoRow - two controls, and the one page-level hidden-id set
- `6db51fb` fix(p10c): one event-time rule, one formCapableFor, and the calendar log says what failed
- `b4b54f2` feat(p10c): Tiles 4 and 6 - the push quoted verbatim, and Done this week
- `7865819` fix(p10c): the page's apostrophes are typographic
- `9e77a51` fix(p10c): a busy switch keeps its focus
- `6d16a46` fix(p10c): a refused press keeps the door's answer
- `741c642` docs(p10c): ARCHITECTURE - the three collections, Google, the morning read
- `6467227` feat(p10c): Tile 5 - the week, and the one native disclosure
- `cda776c` fix(p10c): a quoted push wraps, never clips
- `d050670` feat(p10c): the view says when the event form can't run
- `b19021b` fix(p10c): the server's re-read ends a hide, and a tick keeps focus
- `160dfa8` feat(p10c): Tile 2 - the to-do list, and the form that adds and edits
- `a2b425a` fix(p10c): the week names its days, and a row's failure survives a remount
- `6880acc` feat(p10c): Tile 1 - the hero, the nine-step ramp, and the event form
- `3c8ff5d` refactor(p10c): one entry-left sentence, one event title bound
- `f947263` fix(p10c): a row's failure is said under the pressed row, after its own press
- `1d22e3b` fix(p10c): an entry that may be on Google is said so, and a form never sends twice
- `187e723` feat(p10c): edit mode - four signals, inert bodies, the full focus matrix
- `7113a3d` fix(p10c): the add pills follow the working layout
- `b391fde` fix(p10c): an unanswered delete is settled by the re-read, an unanswered pin parks
- `cc5ae8d` fix(p10c): one draft per to-do, rebased on the server's, and a late answer never steals focus
- `768e3ad` fix(p10c): one form-floor rule for the server and the editor
- `d4c5ea7` fix(p10c): the event form never offers a calendar Google no longer has
- `1b5af42` fix(p10c): legacy button casing stops at the page, and the layout sentence sits level

### Files changed

`bb103cf..1b5af42`: 33 files, +4784 / −231.

- **Personal page:**
  - `page.tsx` rewritten as the data layer.
  - Five islands: `EventForm`, `LayerSwitches`, `LayoutEditor`, `TodoForm`, `TodoRow`.
  - Seven server blocks in `_blocks/`: `Done`, `Layers`, `Push`, `SettingsLine`, `Today`, `Todos`, `Week`.
- **Settings:**
  - `page.tsx` is now a server component.
  - `_blocks/AgentSwitches.tsx` holds the P3 client code, moved.
  - `_blocks/CalendarPicker.tsx` is new.
- **Library:**
  - New: `layoutEdit.ts`, `pressOutcome.ts`.
  - Changed: `constants`, `days`, `personalErrors`, `personalView`, `personalWrites`, `todos`.
- **Tests:**
  - New: `layoutEdit.test.ts` (16 tests), `pressOutcome.test.ts`.
  - Extended: `days`, `personalView`, `personalWrites`, `todos`.
- **Styles:** `components.css` (L1c) and `personal.css` (L1, L1b, L1c, L1d, L1e). See the stylesheet section.
- **`ARCHITECTURE.md`:** §3.1, §4.2 and §5 changed.
- **Untouched:** the shell, `(app)/layout.tsx`, the proxy, login, `package.json`, `package-lock.json`, `next.config.ts`, and every Freelance file.

### Tests, types, build, lint (at `1b5af42`)

- **Tests.** `npm test` passes **42 files, 1040 tests**. P10b ended at 40 files and 977 tests.
- **Types.** `npx tsc --noEmit` exits 0.
- **Build.** `npm run build` prints `✓ Compiled successfully`. The route table has `ƒ /personal` and `ƒ /settings`.
- **Lint.** `npm run lint` exits 1 at the baseline, **4 errors and 3 warnings**.
  - The four errors are `react-hooks/set-state-in-effect` at `freelance/queue/PushControls.tsx:24:7`, `freelance/queue/page.tsx:69:10`, **`settings/_blocks/AgentSwitches.tsx:35:10`** (moved there from `settings/page.tsx`, as the plan predicted) and `login/page.tsx:23:9`.
  - The warnings are at `models.test.ts:43:22`, `queue.test.ts:258:27` and `db.ts:20:3`.

### Invariant greps (step 2)

Each is listed with its result. Corrected forms are used where the plan's form is wrong.

- **`useEffect`.** `git grep -n useEffect -- "src/app/(app)/personal"` exits 1.
- **Client files.** `"use client"` appears in exactly five files: `EventForm.tsx`, `LayerSwitches.tsx`, `LayoutEditor.tsx`, `TodoForm.tsx`, `TodoRow.tsx`. `Week.tsx` is not among them.
- **`fetch(`.** Six calls, all mutations, none a read:
  - `EventForm` POST `/api/calendar/events`;
  - `LayerSwitches` PATCH `/api/settings`;
  - `LayoutEditor` PATCH `/api/settings`;
  - `TodoForm` ×2 (POST or PATCH, and DELETE);
  - `TodoRow` PATCH `/api/todos/[id]`.
- **`dangerouslySetInnerHTML|NEXT_PUBLIC`** over personal and settings exits 1.
- **Shell, proxy, login, package, `next.config.ts`:** no diff. **Freelance:** no diff.
- **Stylesheets:** two files changed. Classified in the stylesheet section.
- **`pe-more|+N more|PERSONAL_HERO_BUSY_AT|is-clear|is-busy`** under `src/` has no code hit.
  - Comments: `Push.tsx:22`, `personalView.ts:19`, `heroTint.test.ts:7`, `personal.css:16` and `:328`.
  - Push-text code: `digest.ts`, `digestToday.ts`, `digest.test.ts`. They compose the morning push, not the page.
- **`[0-9]d late`** (the corrected form of `d late`) hits only:
  - comments at `TodoRow.tsx:59`, `todos.ts:94` and `personal.css:311`;
  - the `shortLateness` tests at `todos.test.ts:129–136`.
  - The short form exists in `src/` by L1's design. See the self-review.
- **`align-items: *start`** in `personal.css` has one hit, `:199`, on `.pe-head`.
  - It is pre-existing: `bb103cf:personal.css:188` carries it.
  - It is not the grid. R94's stretch on `.pe-grid` stands.
- **`container`** appears only on `.pe-wrap` (`pgw`) and `.pe-cell` (`tile`), plus the comment at `:445`. Nothing is on an ancestor of the header.
- **`var(--missing)|var(--stale)|var(--spend)`** under personal exits 1.
- **Repo boundary.**
  - `git -C ../ShikksTracker status --porcelain` printed nothing.
  - `ST_API|/api/os/` under personal exits 1.

### The stylesheet diff: every hunk is a named exception

`git diff bb103cf..1b5af42 -- src/styles/` has 8 hunks at default context (10 at `-U0`).

- **`components.css`, 3 hunks, all L1c.** Each existing dim rule gains `[aria-disabled="true"]`:
  - `.btn:disabled` and `.btn:disabled:hover`;
  - `.tick:disabled`;
  - `.btn.hi:disabled`.
- **`personal.css`, 5 hunks:**
  1. **L1b:** `.pe-fail + :not(.pe-edit) > .pe-wrap{margin-top:var(--sp-4)}` and `.pe-fail + .pe-edit{margin-top:0}`.
  2. **L1:** `.pe-ls{display:none}`.
  3. One hunk carrying three exceptions:
     - **L1c:** `.pe-sw:disabled, .pe-sw[aria-disabled="true"]`;
     - **L1e:** `.pe-sw, .pe-edit-row{text-transform:none; letter-spacing:normal}`;
     - **L1d:** `overflow-wrap:anywhere` on `.pe-ptitle`, `.pe-ptitle + .fl-snip{overflow-wrap:anywhere; white-space:pre-wrap}`, and `overflow-wrap:anywhere` on `.pe-quote`.
  4. **L1e:** `.pe-pills .pe-said{margin-top:0}`.
  5. **L1:** inside `@container tile (max-width:239.98px)`, `.pe-lf{display:none}` and `.pe-ls{display:inline}`.
- Nothing else.

### Measured figures

#### Real data, 1240px viewport, against specimen 01

Riku's account on 2026-10-03:

- **No calendar layers chosen.** Settings lists six real calendars, all unticked: Events, Personal, Classes, Holidays in United States, Holidays in Philippines, Org Stuff.
- **No push stored** (`No push recorded yet.`).
- **Zero to-dos, nothing done.**

So Today, Layers and Next 7 days read `No calendars chosen. Pick them in Settings.` That is honest, and it is not specimen 01's state.

- **Rows:** 340 · 200 · **268.75** · 120, grid 970.75. Row 3 is held open by its contents: the week tile is 268.75 natural, with the sentence at the top and seven `—` rows.
- **Natural tile heights:**

| Tile | Measured | Specimen 01 |
|---|---|---|
| Today | 213.75 | 213.35 |
| To-do | 271.25 | 270.85 |
| Layers (sentence only) | 99.25 | 191.85 |
| Push | 82.75 | 112.35 (it quotes a push) |
| Next 7 days | 268.75 | 234.25 |
| Done this week | 51.5 | 51.1 |

  Every like-for-like tile is +0.40px against the specimen.
- **The hero** is `pe-tile is-hero pe-t0`: a green 155° wash, border `rgba(53,211,153,.2)`.
  - It is **not** `.is-pair`, because SCHEDULED holds the layers sentence rather than `Nothing scheduled.` (R17 is exact).
  - `+ Event` is `disabled` with `aria-describedby="pe-today-reason"`. `+ To-do` is live.
- **One hue.** A sweep of every computed colour, background and border under `.fl` found two hued values: the hero's gradient and its border.
- **Leftover.** Row 2 at twelve columns has about 78px of bare ground. No cell is rendered for it in normal view (T1's accepted deviation), so there is no fill, no caption and no dash.
- **Week.** Seven `—` rows in `rgb(91,100,112)` (`--ink-3`).
  - Two inner columns of 436px.
  - Rows 1 and 5 have no top hairline.
- **Labels.**
  - `SCHEDULED` and `DUE`.
  - `PERSONAL`, `FREELANCE`, `ACADEMICS`, each with `nothing open`, and `0 open`.
- **Eyebrows.** Every tile's eyebrow is present at 1240, 932 and 390.
- **Console.**
  - The console is empty: no CSP violation and no hydration warning.
  - No request goes to `fonts.googleapis.com` or `fonts.gstatic.com`.
- **The blank page with three layers on.**
  - Setup: layers stubbed to Personal, Classes and Events, all enabled, with real calendar ids from `listCalendars()`. Real Google reads and real Mongo reads.
  - This is specimen 01's state, except that real classes fill the week.
  - Rows **340 · 200 · 240 · 120, grid 942**, exactly as specimen 01 states. `.pe-body.is-pair` and `pe-t0` are present.
  - Natural heights: Today 213.75, To-do 271.25, Layers 192.25, push 82.75, Next 7 days 235.25, Done 51.5. The week shows Mon, Tue, Thu and Fri classes as `2 items`, `3 items` and `4 items`.
  - No row is held open.

#### Collapse: 932px window, specimen 05

- 706px grid, six columns of 106px.
- Tiles **466 · 226 · 226 · 466 · 706 · 706**, as the plan states.
- **Rows:**
  - Real data: 340 · 200 · 396.25 · 120.
  - Three-layer blank: 340 · 200 · **362.75** · 120.
  - Specimen 05's 551 (row 1) and 210 (row 4) belong to its filled data and do not arise from this data.
- **The empty cell closes and comes back.** In edit mode a live resize 1240 → 932 → 1240 gave a gap in row 2 at 63.83px, then no gap (2+4=6), then the 63.83px gap again.

#### Stack: 390px, specimen 08

- The strip is `.app-side` as a 390×44 flex bar at the top.
- 334px of column, one column.
- **Pills:**
  - Real data: `+ Event` disabled (no layers), `+ To-do` live.
  - Layers stubbed: both live.
- Switches are 44 · 44 · 44px tall (layers stubbed).
- No dashed element, no gap cell, no horizontal scroll.
- Every tile keeps its eyebrow.

#### Edit mode, Task 8 (all PATCHes intercepted)

- **Title→grid** is **28 in normal view and 28 in edit mode**, with grid top 136 in both. M6 holds.
- **The four signals:**
  - **The well:** `.pe-edit`, background `rgb(14,16,19)`, padding 14, margin −14.
  - **One dashed leftover:** row 2, span 1, 63.83px wide, no tabindex.
  - **Six toolbars** (`.pe-bar`).
  - **The pills:** `Reset to default[disabled] · Cancel · Save[disabled]`.
- **Inert.**
  - Six heads and five bodies are `inert`.
  - A force-clicked `+ To-do` in an inert head opened nothing.
  - A force-clicked tick in an inert body left `aria-checked="false"` and sent no request.
  - A force-clicked `<summary>` in an inert body stayed closed.
- **The hero** keeps its tint in edit mode: `pe-t0`, and with three to-dos due it keeps `pe-t3`, gradient `rgb(42,20,8)` and border `rgba(255,138,61,.2)`.
  - Not measured: the tint behind an open form.
- **An open day closes on entry:** one `details[open]` before, zero after.
- **Focus.**
  - On entry focus goes to `Move Today right`, the first live toolbar button (T8's accepted deviation).
  - Tab walks only the live buttons.
  - `Escape` after a move restores the arrangement, closes the mode and puts **focus on `Edit layout`**. `Cancel` does the same.
  - `Reset to default` disables itself and hands focus to `Cancel`.
- **The disabling matrix, default arrangement:** 24 buttons are disabled.
  - Every up and down move is disabled (the target row lacks room, and there are four rows).
  - Every widen in a full row is disabled, as are the edge arrows.
  - **After `Narrow Next 7 days` ×10 the week stops at span 2:**
    - `Narrow` is disabled (`SPAN_MIN`).
    - The caption reads `10 columns left`.
    - `Move Layers down` and `Move This morning’s push down` turn live.
    - Focus survives each move.
- **Sticky pills.** Previously unmeasured. The `.pe-sticky` deviation (wrapping the whole header band) **sticks**. In a 1240×700 window:

| Scroll position | `.pe-sticky` top |
|---|---|
| Before scrolling | 44 |
| scrollY 500 | 0 (bottom 74, pills' top 32.7) |
| Maximum scroll (676) | 0 |

  At scrollY 500, `elementFromPoint` at the pills returns `Reset to default`, on `--void` ground (`rgb(8,9,11)`).
- **Save failure** (500 `{"error":"save-failed"}`): `Couldn’t save the layout.` appears beside the pills. The mode stays open with the change intact, and focus stays on `Save`.
  - **Offset.** At `d4c5ea7` the sentence's centre sat 5.0px below the pills' (53.34 against 48.35), from `.pe-said`'s `margin-top:10px` under `align-items:center`. The lead had estimated ~10px.
  - **After L1e** (`1b5af42`): 48.34 against 48.35, level.
- **Unknown outcome** (504 HTML): `Couldn’t tell if that saved.` in the same place; the mode stays open.
- **Specimen 04's rows** (382 · 263 · 305 · 162):
  - Three-layer blank: **382 · 263.5 · 306.5 · 162**. Row 3 is +1.5 from real week events.
  - Real data: 382 · 242 · 340 · 162.
  - Three to-dos due: 451 · 263.5 · 306.5 · 162.
  - 932, real data: 382 · 242 · 467.5 · 162, no gap.
- **R53/R91, the shrink case.** Moves cannot reach it from the default: `Move This morning’s push up` stays disabled with row 1 full and four rows. So the stored arrangement `[[push 4]], [[today 8], [todos 4]], [[layers 3], [week 9]], [[done 12]]` was rendered through the stub.
  - **Normal view, row 1:** **82.75** with `No push recorded yet.`, and **150.25** with a stubbed quoted push (title plus two body lines).
  - The plan's 131 assumes specimen 01's quote; not reproduced on this data.
  - In edit mode row 1 goes back to 382, with an 8-span dashed leftover.
- **R91, two tiles summing to 5** (layers 2 + push 3, stub):
  - Normal view: rows 379.75 · **200** · 240 · 120.
  - The row **keeps its weight** with seven columns of bare ground. Looked at: it reads as a deliberate short row, not a failure.
- **A Save that lands.** PATCH answered 200 `{settings}`, with the refresh stubbed to the same arrangement (layers 2, push 5).
  - Normal view shows that arrangement with row 2 at 200.
  - Focus is on `Edit layout`.

#### Next 7 days, Task 5 (`week-busy-stub.patch`, applied then reverted)

- **Closed:** 240 at two columns; **364.25** at one column (932), against the stated 362.75. The +1.5 is the one-item day's 44px row with a tick.
- **R65, fully open busy week: 393.75** at two columns, **510.75** at one column.
- **R65, mixed** (only Mon 5 open beside a closed Thu 1): **339.75**.
- **R94's slack, judged by eye.** The closed Thu 1 row stretches to 144.5 to match the open Mon 5, leaving about 100px of blank ground under a one-line summary. Thu 1's chevron sits about 17px from Mon 5's label.
  - Judged noticeable but acceptable: it is the grid's row height, not a clipped or floating element.
- **Counts.** `2 items`, `3 items` and `4 items` render. The one-item day (`Renew ID · Personal`) has no `<details>`.
- **Layout.** Opening a day pushes content down (week bottom 747.75, Done top 761.75); nothing overlays. Opening one day closes no other: all four were open at once.
- **Keyboard.** `Enter` on a focused summary opened it and `Space` closed it, with no script.
- **The summary's accessible name** includes the day (`aria-labelledby="pe-day-… pe-sum-…"`). Chrome's accessibility tree reads `DisclosureTriangle "Thu 1 Math Methods 3 items"`.

#### R88/R96 lateness at 106px, and the forms (Tasks 3, 4)

Setup: stubbed to-dos due 2026-09-30, 2026-10-02 and 2026-10-03, plus one undated; `today` is 2026-10-03.

- **At ≥240px of tile** (To-do 297.33, Today 608.66 and 466, 334 at 390): `3 days late` / `1 day late` render (`.pe-lf` inline, `.pe-ls` none), each on one line.
- **At 226px** (To-do at six columns) the short form shows, which is correct: it is below 240.
- **At 106px (1 of 6)**, both To-do and Today: **`3d late` and `1d late` fit on their own line.**
  - Height 14.25, `white-space:nowrap`, no wrap.
  - The chip's right edge is 292.91, against the row's 291 and the tile's inner edge 292. It overhangs the row's box by 1.91px, 0.91px into the tile's 12px padding.
  - It is not clipped. R96 settled the short form, and this is its record.
- **Accessibility.** The DOM `textContent` holds both forms. The hidden one is `display:none`, so it is out of the accessibility tree.
- **Hero tint.** With three due, the hero is `pe-t3`.
- **The to-do form at span 4** (1240): well **342.47**, tile **428.72**. The plan says 340.5 / 426.35, so +1.97 / +2.37.
  - One column.
  - Focus goes to the title field. `Escape` closes the form and returns focus to `+ To-do`.
- **The event form at span 8:** well **323.97**, tile **423.72**. The plan says 322 / 421.35, so the same +1.97 / +2.37.
  - Row 1 grows from 340 to 423.72.
- **At 932:**
  - To-do form well 334.47 / tile 414.72 (a 226px tile, one column).
  - Event form well 323.97 / tile 428.5.
- **At 390:**
  - To-do form well 342.47 / tile 428.72.
  - Event form one column, well 474.75 / tile 574.5.
  - **The date field sits inside its well in both:** 60–330 inside 45–345.
- **Too narrow.** At To-do 1 of 6 (106px) and at span 2 of 12 (141.66px): `+ To-do` is disabled, with `Too narrow for the form.` Today at 106px likewise disables `+ Event`.

#### L1d and the 07:00 dot (Task 6, stub)

- **L1d.** An 80-character alphanumeric token with no break opportunity, in both the push title and the body.
  - At 106px, `.pe-ptitle` and `.fl-snip` wrap: `scrollWidth` = `clientWidth` = 80, tile 543.25.
  - At 141.66px, tile 394.75.
  - Nothing is clipped. `.fl-snip` computes `pre-wrap` / `anywhere`.
- **The 07:00 dot.** Setup: yesterday's push stored, `now` stubbed.
  - At 06:30, `No push this morning.` is `.fl-empty` with no dot.
  - At 07:30 it is `pe-fail is-missing` with a red dot (`rgb(248,113,113)`).
  - Both under `Last: Fri 2 Oct 07:00` and the `.pe-quote` well.

#### /settings (Task 9)

- **Four cards:**
  - Follow-up chaser.
  - Monitoring.
  - `Google Calendar — Connected.` (the real `listCalendars()`).
  - Calendar layers, with six real 40px `.pickrow`s.
- **L9, picker.** I pressed `Space` on the focused Events tick with a delayed 500 answer.
  - While busy, all six ticks were `aria-disabled="true"` at opacity .45, never `disabled`, and **focus stayed on Events**.
  - Then `Couldn’t save.` appeared in `.fl-note` under the row (row 40 → 53.25), with focus still on Events.
  - Exactly one PATCH was sent.
- **L9, the page's switches** (layers stubbed, same test):
  - All three went `aria-disabled` at .45.
  - The pressed knob showed its target state while busy, then returned.
  - Focus stayed on the switch.
  - A second `Space` while busy was ignored (one PATCH).
  - `Couldn’t save.` appeared under the row.

#### L1e (`1b5af42`), re-measured

- **Casing.** Before L1e, `legacy.css`'s bare `button{text-transform:uppercase; letter-spacing:.14em}` set every to-do row title, tag and due chip, and every layer switch name, in capitals with 1.82px tracking. That covered every row with an edit button, i.e. every row in a form-capable tile.
  - After L1e, `.pe-sw`, `.pe-sw .nm`, `.pe-edit-row` and `.pe-edit-row .pe-nm` compute `text-transform:none; letter-spacing:normal`.
  - This was measured on elements injected into a live tile, since Riku's data has no rows.
- **The Save sentence** sits level, as given in the edit-mode section.

#### Arrow glyphs (R26)

At 390px in edit mode, Chrome's platform-font report gives:

- **←, →: Arial** (13.45px wide);
- **↑, ↓, −, +: JetBrains Mono (web)** (6px).

All six render as monochrome text in `--ink-3`, not emoji, so R26 holds. The shipped JetBrains Mono subset lacks U+2190 and U+2192 (carry-forward).

### Failure states observed (step 4)

The grid rendered in every one, and no failure was rendered as data.

- **Bad `MONGODB_URI`** (`mongodb+srv://nohost.invalid/x`):
  - **Nine dots:**
    1. The page notice `Couldn’t load your arrangement, so this is the default.`, 14px above the grid.
    2. Today: `Couldn’t load layers, so the calendar wasn’t read.`
    3. Today: `Couldn’t load to-dos.`
    4. To-do: `Couldn’t load to-dos.`
    5. Layers: `Couldn’t load layers.`
    6. Push: `Couldn’t load this morning’s push.`
    7. Next 7 days: `Couldn’t load layers, so the calendar wasn’t read.`
    8. Next 7 days: `Couldn’t load to-dos.`
    9. Done: `Couldn’t load to-dos.`
  - **The week shows no day rows.** Rows 340 · 200 · 240 · 120. The hero is untinted (`pe-tile is-hero`).
  - The server log has five `[personal] … read failed: querySrv ENOTFOUND` lines, one per read.
  - **`/settings`** shows `Google Calendar — Connected.` and `Calendar layers — Couldn’t load layers.` The chaser and monitoring cards give way to AgentSwitches' P3 `Could not load settings.` (P3 behaviour, moved verbatim).
- **`GOOGLE_REFRESH_TOKEN` unset** (set to whitespace, which `readGoogleConfig` reads as missing; layers stubbed):
  - Today, Layers and Next 7 days read `Google isn’t connected yet. Set it up in Settings.` as `.fl-empty`, with **no dot**. That follows `personalView.ts`'s DOTS table (an absence by configuration); the plan's Task 4 text "each with its dot" is superseded by Plan B.
  - The week's day rows are blank, with no `—` (R18).
  - **The hero stays `pe-t0`.**
  - `/settings`: both cards read `Not set up. Add the three Google values to the environment and redeploy.`, with no list.
- **Invalid refresh token** (`1//0verifier-invalid-token`):
  - `Google access has expired. Renew it from Settings.` with an amber dot on Today, Layers and Next 7 days (three dots).
  - `/settings`: both cards read `Access expired. Run the sign-in again and replace the token.`
  - The server log has `[personal] calendar window: expired` and `[settings] calendar list failed (expired) … invalid_grant`.
- **`layers: []`** is Riku's real state: `No calendars chosen. Pick them in Settings.` on Today, Layers and Next 7 days, and seven `—` rows.
- **Bogus calendarId** (stub: layer `Gone Cal` with an id the account lacks, beside real Personal and Classes):
  - `Gone Cal is no longer on your Google account. Untick it in Settings.` as `.fl-empty`, with no dot.
  - In Today it replaces `Nothing scheduled.`
  - In Layers the row is kept and the sentence comes after the list.
  - At the top of Next 7 days, where days with no items go blank rather than `—` (conservative, per the contract).
  - Real Personal and Classes events still render.
  - The server log has `couldn't read Gone Cal`.
- **All layers off** (stub):
  - `All layers are switched off.` on Today and Next 7 days, with seven `—` rows as measurements.
  - Three switches, unchecked and live.
  - **The hero is still `pe-t0` green** (R74/R45).
  - `+ Event` is disabled.
- **Malformed layout** (stub `[[{today, span:99}]]`): the default arrangement, the page notice with its dot (one dot), 14px to the grid (L1b).

### Not measured, and why

- **`Couldn’t read Classes.`** (one layer failing, the others fine) cannot be produced against a healthy account without a fault. The JSX-against-specimen-03 read was not done in this run.
- **A real phone.** Headless Chromium on Windows only. Step 6 item 6 (date-field fit on Riku's phone) and R26 on a phone stay with Riku.
- **R53's 340 → 131.** Riku has no stored push; 82.75 (none) and 150.25 (a stubbed quote) were measured instead.
- **The hero's tint behind an open form.**
- **Every write**, under L2. They are listed under "What remains".

### Deviations and lead rulings

Checked against the code at `1b5af42`. "(log)" marks a claim taken from the lead log and not re-derived in this run.

**Lead rulings L1–L10, plus L1e:**

- **L1, R96.** The lateness meta renders both forms, `.pe-lf` and `.pe-ls`. `.pe-ls{display:none}` at base, and the 240px container band swaps them.
  - Verified in the CSS and in the browser: `3 days late` at ≥240px, `3d late` below.
  - This supersedes the plan's "no stylesheet edit" and its "`3d late` does not exist in `src/`".
- **L1b.** The `fellBack` sentence's 14px. The selector was adjusted to `.pe-fail + :not(.pe-edit) > .pe-wrap`, because the well's element is always present. Measured 14.
- **L1c.** `[aria-disabled="true"]` was appended to the existing dim rules for `.btn`, `.btn.hi`, `.tick` and `.pe-sw`.
- **L1d.** A quoted push never clips. Measured at 106px.
- **L1e** (added after verification, `1b5af42`):
  - `.pe-sw, .pe-edit-row{text-transform:none; letter-spacing:normal}` against `legacy.css`'s bare `button` rule.
  - `.pe-pills .pe-said{margin-top:0}`.
  - Measured above.
- **L2.** No writes to real data. Every write is owed to Riku.
- **L3.** Ports 3021 to 3023 only.
- **L4.** The page wiring is Task 1's.
- **L5.** Parallel builders do not build.
- **L6.** Browser checks.
- **L7.** `pressOutcome` (`6c103ba`, `PRESS_TIMEOUT_MS = 60_000`). Every island's `fetch` goes through it. The five page islands and `CalendarPicker.tsx` import it.
- **L8.** No worktrees, junctions or `npm install`.
- **L9.** A busy control that is focused uses `aria-disabled` and a guard, not `disabled`. Verified on `LayerSwitches`, `CalendarPicker` and the layout `Save`.
- **L10.** Typographic apostrophes on the page and on Settings. Every sentence observed in this run uses U+2019. The push text in `digest.ts` keeps ASCII (`wasn't read`), as ruled.

**Accepted deviations (verified unless marked log):**

- **T1:**
  - Three Suspense boundaries, not two (Today, Layers, Week), in `page.tsx`.
  - `listCalendars()` sits inside the one calendar promise.
  - Phase 1 is settled read by read.
  - No leftover cell in normal view (`buildCells`).
  - **Event defaults** (`days.ts` `eventTimeDefaults`): from 23:00 the default is tomorrow 00:00–01:00, and at 22:xx it is 23:00–23:59 (`oneHourAfter` caps at `DAY_LAST`). This deviates from deck §7.
  - **The Today fallback carries the tint** (`buildTodayDue`, `page.tsx:334`).
- **T2:**
  - Hidden keys are `open:` and `done:` (`HiddenKey`, `LayoutEditor.tsx:72`; `TodoRow.tsx:112`).
  - The unknown-outcome sentence sits under the tile head; specimen 06 draws it after the rows. (log)
  - The unknown calendar leg gets R49's sentence. (log)
  - B1: the press's own re-read ends a hide, through a per-render `stamp={crypto.randomUUID()}`.
  - **Residual race** (log): another island's refresh, requested before this press's answer but landing after it, can briefly unhide a settled row. Accepted.
- **T5:**
  - Week event items link out through a plain `<a target="_blank" rel="noopener noreferrer">` with no ↗ (`Week.tsx:32`).
  - N3: none-enabled with to-dos down gives `days: null` (`personalView.ts:698`).
  - Row failure sentences moved to context (`rowNotes`). (log)
- **T6.** Today's push is `.pe-ptitle` plus `.fl-snip` (the mockup's form), not the spec's `.pe-quote` well. The older push uses `.pe-quote`. Observed.
- **T7:**
  - All switches are disabled while one saves (spec §4.3 says that row only; amend the spec).
  - The outcome sits under the row.
  - Vanished-calendar sentences come after the list.
  - `SettingsLine.tsx` is the shared Settings link.
  - All observed.
- **T8 (`187e723`):**
  - `layoutEdit.ts` is pure, with 16 tests.
  - Entry focus goes to the first live button.
  - A Save with an unknown outcome keeps the mode open with the changes intact.
  - The `.pe-edit` well's element is always rendered (classless in normal view).
  - `.pe-sticky` wraps the whole header band.
  - All observed.
  - The log's two Mongo-down figures (title→grid 61.5 in both modes; edit rows 382·242·282·162) were not reproduced in this run. With the database down this run measured normal rows 340 · 200 · 240 · 120 and a 14px notice gap.
- **T9:**
  - AgentSwitches keeps its own client GET.
  - Every picker box is busy while saving (observed: all six `aria-disabled`).
  - `Couldn’t load layers.` when Google answers but the layers read fails (observed with Mongo down).
  - `pickerRows`, `pickerToggle` and `buildSettingsCards` exist in `personalView.ts`.
  - Names over 120 characters are shortened on tick. (log)
- **T10.** `ARCHITECTURE.md` §3.1, §4.2 and §5 are updated, with `Todo`, `LastDigest`, `AgentRun.skipped`, `OsSettings.layers`/`personalLayout`, the Google row and the morning read. §7 is untouched (no hunk reaches line 164). The diff has no "S19" citation.
- **Forms:**
  - Drafts live in the tiles; the forms are views.
  - A no-answer add or event parks (only `Cancel` clears it); a no-answer edit keeps `Save` live; an edit sends only the changed fields.
  - Clearing Date or Start gives the door's 400, read as `Couldn’t save.`
  - The per-section `Showing 20 of N.` sits directly under its section (deviation from R16).
  - The orphaned or unknown pin sentence is provisional (`PIN_MAYBE_MADE`).
  - Not exercised (writes); from the log and the code.
- **`personalView` additions:**
  - Exported: `buildTodayDue`, `formCapableFor`, `pickerRows`, `pickerToggle`, `buildSettingsCards`.
  - `eventFormBlocked` is a module-private function feeding the field `TodayView.eventFormBlocked`, not an export.
- **S1 focus.** When the last tick leaves a tile, focus goes to the tile itself, through `setAttribute("tabindex","-1")` (`TodoRow.tsx` `keepFocus`). A keyboard tick then draws `base.css`'s `:focus-visible` ring on the tile (squared corners). (log; not looked at in this run)

**Where the lead log is wrong or imprecise:**

1. **"stylesheet = L1/L1b/L1c/L1d only, 10 hunks"** (principal review at `b391fde`). At `b391fde` the diff from `bb103cf` has **7 hunks at default context and 9 at `-U0`**, not 10. The classification (L1–L1d only) is right. At `1b5af42` it is 8 and 10.
   - The verification report sent to the lead also said 8 at `d4c5ea7`; that was a miscount, and the true figure is 7.
2. **"PROVISIONAL (P10c) CALENDAR_REASONS in TodoForm.tsx — six phrases."** `CALENDAR_REASONS` has **six causes and eight strings**, because `gone` carries three: `event`, `pin` and `move`. With `PIN_MAYBE_MADE` there are **nine** `PROVISIONAL (P10c)` markers.
3. **"`Couldn’t save the layout.` may sit ~10px low."** Measured **5.0px** low, now fixed by L1e.
4. **"No live regions (role=status) for press outcomes anywhere in the app."** True of press outcomes. But the editor's row caption `.pe-cap` is `aria-live="polite"` (`LayoutEditor.tsx:323`), the one live region on the page.
5. **"`.pe-sticky` … UNMEASURED."** Now measured: it sticks.

### Carry-forwards (not fixed in P10c)

- **The arrow font.** ← and → fall back to Arial: the JetBrains Mono web subset lacks U+2190 and U+2192. They are still text, so R26 holds. Glyph widths are uneven, 13.45px against 6px. Decide in a font or subset pass.
- **The settings route's 500.** `PATCH /api/settings` answers 500 `{code:"save-failed"}` (`route.ts:67`), which is ambiguous after a sent write (T9 review S2).
- **Live regions.** No live region announces a press outcome anywhere in the app. This is an app-wide decision.
- **AgentSwitches** (P3, moved verbatim) still sets `disabled={busy}` on its focused buttons (`:81`, `:104`, `:125`), so focus drops to `<body>`. It is also the lint error.
- **AgentSwitches with Mongo down** renders `Could not load settings.` in place of the chaser and monitoring cards (P3 behaviour).
- **ARCHITECTURE §3.1** has no `HealthSnapshot` row (pre-existing).
- **A stale success.** A success whose `router.refresh()` never lands shows the old knob state (T7 N1).
- **Duplications left** (log, confirmed present):
  - `focusPillOrTile` (`TodoForm.tsx:297`) against `keepFocus`'s tile fallback (`TodoRow.tsx:81`);
  - `TILE_NAME` repeats the eyebrows;
  - the `SayLine` renderer exists three times;
  - the outside-week and due-group windows are re-derived in the islands.
- **R94's slack.** The open-day stretch leaves about 100px under a closed neighbour at two columns. Accepted by eye; revisit only if Riku dislikes it.
- **The RikuOS dev server on 3011** crashed during the `node_modules` incident and was left for Riku. (log)

### Provisional strings awaiting Riku

- **P10c**, `git grep -n "PROVISIONAL (P10c)"`, nine markers, all in `TodoForm.tsx`.
  - The `<reason>` words for deck §7's three reason sentences (`:105–114`):

| Cause | Phrase |
|---|---|
| not-configured | `Google isn’t connected yet` |
| expired | `Google access has expired` |
| refused | `Google refused the request` |
| gone (event / pin) | `the calendar is no longer on your Google account` |
| gone (move) | `the entry is no longer on Google` |
| changed | `the to-do changed at the same moment` |
| store | `the app couldn’t record it` |

  - `PIN_MAYBE_MADE` (`:128`): `Saved. A calendar entry may have been made anyway. Check Google Calendar before switching it on again.`
  - Related: on the event form, `Google didn’t accept it: Google isn’t connected yet.` The host clause is inaccurate for not-configured, which is decided before any call.
- **P10b**, still open, six markers in `digest.ts`:
  - `:76`, the problems line's `+N more`;
  - `:140`, `calendar check incomplete`;
  - `:226`, the comma before `+N more`;
  - `:235`, the plural `X, Y and N more`;
  - `:240`, `… weren't read.`;
  - `:301`, `Today: <miss>` alone.
- **A wording question.** `ENTRY_LEFT_SENTENCE` (`personalErrors.ts:47`), `Done, but the calendar entry couldn’t be removed. Remove it in Google Calendar.`, is deck §7 line 402's sentence as written. It is used for done, switch-off **and delete**. "Done" after a delete reads oddly: Riku's call.

### What remains: Riku's hands, in order

1. **Push `master`.** At `1b5af42`, `master` is 29 commits ahead of `origin/master`: exactly this plan's commits. This record makes 30.
2. **Vercel:** add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REFRESH_TOKEN`, then **redeploy**. Confirm `npm run migrate:indexes` / `:apply` for the two `Todo` indexes if not already done (plan step 6 item 4).
3. **Settings → Calendar layers: tick Personal, Classes and Events.** None is chosen today, so the page reads `No calendars chosen…` everywhere.
4. **The live write checks owed under L2,** on `/personal` and `/settings`:
   - **To-dos:** add a to-do; tick and untick; edit; delete through the confirmation.
   - **Twin rows:** confirm the twins (Today's DUE and the To-do tile) leave together.
   - **The R49 case.**
   - **Calendar pins:** a to-do with `Put on calendar` appears in Google Calendar on its day, and is removed on tick.
   - **Events:** create an event, including the timeout path.
   - **Layers:** a layer toggle persists across a reload and drops out of the push.
   - **Settings:** the picker tick and untick.
   - **Agents:** the chaser toggle and threshold still work.
   - **Edit mode:** Save a real arrangement, then Reset to default.
   - **Phone fit:** open `+ Event` and `+ To-do` on his phone and confirm the date field fits.
5. **Approve or reword** the provisional strings above: nine P10c, six P10b, and the "Done, but…" question.
6. **One automatic 07:00 push.** Not a manual trigger, and with at least one to-do in it. The push tile quotes it the same morning with `sent 07:00` in `APP_TZ`.
7. **Plan step 7's four observations, dated:**
   1. `/personal` on Vercel, reading the real calendars and the three chosen layers.
   2. A real to-do pinned to Google Calendar and removed on tick.
   3. One automatic 07:00 push naming what was due and scheduled.
   4. The push tile quoting that push the same morning.

### Self-review, checked against the repo at `1b5af42`

- [x] `useEffect` under `src/app/(app)/personal/` is empty; exactly five files carry `"use client"`.
- [x] `Week.tsx` is a server component, and the day-row disclosure is a native `<details>`. `Enter` and `Space` work with no script (measured).
- [x] The hero's class is `pe-tile is-hero` plus at most one `pe-t{0..8}` (`Today.tsx:33`).
  - `heroTint` is called with the DUE row count or `null` (`personalView.ts:604`, `:611`), never with anything from the calendar.
  - The tint is unchanged in edit mode (measured).
  - **Behind an open form: not measured.**
- [ ] `.pe-more`, `+N more`, `PERSONAL_HERO_BUSY_AT`, `.is-clear`, `.is-busy` and `3d late` do not exist anywhere in `src/`. **Not literally true, by ruling.**
  - The names survive only in comments and in the push composer.
  - `3d late` exists by L1/R96, as `.pe-ls` through `shortLateness`.
  - There is no code identifier for the cut items.
- [x] `2 items` and `3 items` render on a day with two or more items; a one-item day has no `<details>`; `1 items` is unreachable (pinned in `personalView.test.ts`).
- [ ] No stylesheet, shell, `_shell/`, Freelance, proxy or `package.json` file changed. **Superseded for stylesheets** by L1, L1b, L1c, L1d and L1e, with every hunk classified above. Shell, `_shell/`, Freelance, proxy and `package.json` are unchanged.
- [x] **Mutating islands.**
  - Every mutating island ends its success path in `router.refresh()`.
  - Every no-answer outcome says `Couldn’t tell if that saved.` through `pressOutcome` (measured on the layout Save).
  - A switch shows its target position only while busy (deck §6 Tile 3) and returns on a definite failure (measured).
- [x] **Edit mode:**
  - four signals and no colour;
  - title→grid 28 in and out;
  - every body `inert`;
  - every open day closed on entry;
  - a failed Save keeps the mode open with the changes intact.
- [x] `/settings` has no `pe-` class, calls `listCalendars()` once server-side (`settings/page.tsx:55`), and derives both cards from that one answer.
- [x] `ARCHITECTURE.md` §3.1, §4.2 and §5 are updated; §7 is untouched.
- [x] `npm test`, `npx tsc --noEmit` and `npm run build` are green; `npm run lint` is at four errors and three warnings.
- [x] `git -C ../ShikksTracker status --porcelain` is empty.
- [ ] Step 7's four observations are recorded with dates. **Riku's:** see "What remains", item 7.

**Also against the plan's text:**

- "This plan adds no test file" is **not true**. `pressOutcome.test.ts` (L7) and `layoutEdit.test.ts` (T8) are new. Both are additions the lead's rulings asked for.
- The test-file count went from 40 to 42.
