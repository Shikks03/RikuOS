# P10 design team — Frontend Architect, round 1

**Date:** 2026-09-11 · **Role:** how the Personal page lands in this codebase
**Standing question:** what is the cleanest build that survives Academics (P11 — Canvas, and the Classes layer *populated*) without a rewrite?
**Sources:** the P10 brief, design doc and content deck (*deck §n*); `docs/superpowers/specs/2026-09-07-p8-freelance-page-visual-design.md` §5, §7 (*visual spec §n*); `docs/superpowers/design/p8-team/round1-frontend-architect.md` and `round3-lead-rulings.md` (R1–R24); the Plan A/B/C series file maps in `docs/superpowers/plans/2026-09-07-p8*.md`; `CLAUDE.md`; `ARCHITECTURE.md` §7. Every identifier and line number below was read at HEAD (`3fa055e`, under the brief's own `21f3c1a`; `src/` is identical between them), not remembered.

---

## 1. Position

**The grid is CSS, the arrangement is data, the tiles are server components, and the only client code is five small islands that each own an event handler and nothing else.** The server emits two classes per tile — one row, one span — from a frozen lookup; the stylesheet turns them into `grid-row` and `grid-column: span N` and does the collapse in two container queries. No inline style, no measurement, **no `useEffect` anywhere in the phase**, no new dependency. The layout store is **strict on write and total on read**: `validateLayout` rejects anything the editor could not have produced, and a separate `resolvePersonalLayout` repairs whatever is actually stored against the *current* tile list — the one thing that decides whether P11's seventh tile costs a constant or costs Riku his arrangement. Everything Academics also needs — day arithmetic, the to-do store, the tick, the switch, the in-place form, the Google client — is built unprefixed in `src/lib/` and `components.css` from day one; only the bento is page-scoped. Two parts of the ratified design doc do not survive contact with the shipped code, and I say so rather than build around them: **the OAuth callback cannot carry a `SameSite=Strict` session cookie**, so the two bootstrap routes return 401 before they run; and **a failed *LastDigest* write cannot be named in the same morning's push**, because the push has already gone.

---

## 2. The grid: what the server emits, what the stylesheet does

One element, all cells as direct children — CSS grid requires it, so the flat list is not a choice.

```tsx
// src/app/(app)/personal/_grid/TileGrid.tsx — rendered by LayoutEditor
<div className="pe-grid">
  {cells.map(({ tile, row, span }) => (
    <div key={tile} className={`pe-cell ${ROW_CLASS[row]} ${SPAN_CLASS[span]}`}>
      {toolbar}{tiles[tile]}
    </div>))}
</div>
```

```ts
// src/lib/personalLayout.ts — frozen lookups, never template literals
export const ROW_CLASS = Object.freeze(["pe-r1","pe-r2","pe-r3","pe-r4"] as const);
export const SPAN_CLASS: Readonly<Record<number,string>> = Object.freeze({
  2:"pe-s2",3:"pe-s3",4:"pe-s4",5:"pe-s5",6:"pe-s6",7:"pe-s7",
  8:"pe-s8",9:"pe-s9",10:"pe-s10",11:"pe-s11",12:"pe-s12" });
```

**A lookup, not `` `pe-s${span}` ``:** a template literal off stored data can emit `pe-s99`, which matches no rule, so the tile silently takes a default width — a wrong grid rendered confidently. A lookup makes an out-of-range span visible, and makes the pairing greppable.

```css
/* src/styles/personal.css */
.pe-grid{
  display:grid; grid-template-columns:repeat(12,1fr);
  grid-template-rows:minmax(340px,auto) minmax(140px,auto) minmax(240px,auto) minmax(120px,auto);
  gap:var(--sp-4);                       /* 14px — the Freelance hero row's gutter */
}
.pe-r1{grid-row:1} .pe-r2{grid-row:2} .pe-r3{grid-row:3} .pe-r4{grid-row:4}
.pe-s2{grid-column:span 2} /* … */ .pe-s12{grid-column:span 12}
.pe-cell{align-content:start}
```

**Source order must be row-major and must be the stored reading order** — load-bearing, and worth a comment because the reason is in the placement algorithm, not in our code. Each cell has a definite row and an indefinite column, so the auto-placement cursor packs it into the first free column of its row and resets when the row changes. Emitting row 1's cells then row 2's, in stored order, reproduces the arrangement exactly — and makes **the empty cell always trailing**, which is what the deck's default is (`Layers 3 · push 8 · one column empty`, deck §5) and all the editor's arrows can express. A hole mid-row is not representable, and that is a feature: every legal arrangement is a prefix-packed row, so "is it still a bento" never has to defend an arbitrary gap.

**`minmax(N,auto)`, not `N`** — the weights are minimums (deck §5). An overflowing tile grows its row and every tile in it, which is the right reading of *"content arriving must not move the grid"* (deck §2.6): the *columns* never move, a row can get taller.

**One cost of fixed weights.** Row 1 is 340px whatever sits in it, so *Done this week* moved there is one sentence in a 340px box. D7 settles the weights; the engineering consequence is that **tile content is top-aligned in a stretched cell, never vertically centred** — `.pe-cell{align-content:start}`, one declaration, and the difference between "deliberately airy" and "broken".

---

## 3. The two breakpoints — container queries, not media queries

**The shipped app has no media query.** `git grep "@media" src/styles/` returns one hit: `base.css:35`, reduced motion. `.app-body` is `grid-template-columns:var(--rail-w) minmax(0,1fr)` with `--rail-w:170px` and no responsive form — visual spec §1 (*"Desktop only… No media queries"*) and §10 carry-forward 4, which says the 170px rail **has no mobile form**. So the design doc's *"if the shell already collapses its rail… use that width"* resolves to: it does not, and P10 introduces the app's first breakpoints.

A viewport query measures the wrong thing:

| Viewport | − rail 170 | − `.app-content` padding 56 | per column at 6 |
|---|---|---|---|
| 760px (doc's 6-col step) | 590 | **534px** | 89px |
| 480px (doc's 1-col step) | 310 | **254px** | — |

And it changes: when the phone pass replaces the rail with bottom tabs, viewport 480 yields a **424px** column, and a query written today would still stack to one column where six would fit.

```css
.pe{container-type:inline-size}          /* the page's own wrapper — never .fl */

@container (max-width:640px){
  .pe-grid{grid-template-columns:repeat(6,1fr)}
  .pe-s2,.pe-s3,.pe-s4{grid-column:span 2}   .pe-s5,.pe-s6{grid-column:span 3}
  .pe-s7,.pe-s8{grid-column:span 4}          .pe-s9,.pe-s10{grid-column:span 5}
  .pe-s11,.pe-s12{grid-column:span 6}
}
@container (max-width:380px){
  .pe-grid{grid-template-columns:1fr;grid-template-rows:none}
  .pe-cell{grid-column:1 / -1 !important}
  .pe-r1,.pe-r2,.pe-r3,.pe-r4{grid-row:auto}
}
```

- **The container is `.pe`, not `.fl`** — `.fl` is Freelance's 920px column too (`components.css:154`), and containment on it would change a shipped page for an unrelated reason.
- **`ceil(N/2)` has one degenerate case:** `collapseSpan(2,6)=1` is an ~80px tile. The deck's list (*8→4, 4→2, 3→2, 12→6*) is silent on span 2 because span 2 is not in the default. I propose `Math.max(2, Math.ceil(span/2))` at 6 columns — hence `.pe-s2,.pe-s3` sharing a rule. The visual call is the Grid Architect's; the *function contract* is mine and Plan A ships it, so it must be settled first.
- **The one `!important`:** at one column the span classes must all lose and are the same specificity. `.pe-grid > .pe-cell` (0,2,0) beats `.pe-s8` (0,1,0) and costs nothing; either is fine.
- **Support:** `container-type` is Chrome 105+ / Safari 16+ / Firefox 110+, on a one-user PWA. The `@media (max-width:760px)` / `(max-width:480px)` fallback is a two-line diff — but then the phone pass must be told in writing that both numbers are revisited when the rail moves.

---

## 4. Where the CSS lives — a fifth stylesheet, and the rule that survives Academics

Visual spec §7.1: four files, imported side-effect style **from `src/app/layout.tsx` only**, in fixed order; `components.css` is *"the ported recipe book — the shared vocabulary"*. Plan C, which built the entire Freelance page, **edited `components.css` exactly once** — one selector (Plan A's series map: *"Plan C's only CSS edit"*). That discipline is why Plan C could run in reviewed batches: the page *consumed* a vocabulary it did not author. Putting P10's grid, tiles, toolbar and dashed cells there throws it away — Plan C would edit the shared file nearly every task, and two pages' page-specific rules would interleave in one ~800-line file.

```
tokens.css · base.css · components.css · personal.css (NEW) · legacy.css
```

**The split rule, and my standing question in one line:** *a control any second page would need goes in `components.css`; a layout only this page has goes in the page sheet.* Into `components.css`: tick box, switch, stepper, text/date/time field, select, in-place form frame — P11's Academics has assignments to tick, a Canvas connection to switch, a reviewer to add; P9b has checklists. Into `personal.css`: `.pe-grid`, `.pe-cell`, `.pe-r*`, `.pe-s*`, `.pe-tile`, `.pe-edit`, `.pe-bar`, `.pe-ghost`, the two container queries. P11 adds `academics.css` and moves anything shared *up* in the commit that makes it a second consumer — never speculatively, which is §5.8's declared-unused rule applied to placement.

Two honest costs: **all five files load on every page**, so "page-scoped" is an authorship boundary, not a loading one (the whole stylesheet is 707 lines; P10 adds ~260); and **it changes a settled decision**, which is the lead's call. The narrow alternative — `pe-*` inside `components.css`, exactly as `.fl-*` lives there — is defensible on precedent, and I would only note the precedent was set when there was one page. Namespace `pe-`, as the P8 architect reserved (*"later `.pe-`, `.ac-`"*). No third namespace.

---

## 5. The island map — five islands, and why the *row* is one

Cut by **what owns state**, not by what is clickable. All five use `useState` + `useTransition` + `useRouter`, and nothing else.

| Island | File | Owns |
|---|---|---|
| `LayoutEditor` | `_grid/LayoutEditor.tsx` | edit mode, the local arrangement, Save/Cancel/Reset, the toolbars, **and the header row's control** |
| `TodoRow` | `_blocks/TodoRow.tsx` | one row: the tick, its busy state, opening the edit form |
| `TodoForm` | `_blocks/TodoForm.tsx` | `+ To-do`, add / edit / delete-confirm |
| `EventForm` | `_blocks/EventForm.tsx` | `+ Event` and the event form |
| `LayerSwitches` | `_blocks/LayerSwitches.tsx` | the whole switch list, one PATCH |

**The row is the island, not the tick box** — the one non-obvious call, and it pays three times. (1) If only the box were client, a tick could not make its own row leave the screen, because the row is a server-rendered sibling — and the deck says *"Ticking removes the row at once"* (§6 Tile 2). (2) **One component serves four tiles** — Today's `DUE`, the To-do tile, the week's to-do rows, Done this week: same grammar, different chip. (3) Props stay plain and server-computed, so no formatting, no dates and no clock reach the client:

```ts
export interface TodoRowView {                       // src/lib/personalView.ts, pure
  id: string; title: string;
  chip: { label: string; tone: "plain" | "late" } | null;   // "Fri 12" | "3 days late"
  sectionTag: string | null; onCalendar: boolean; done: boolean;
}
```

Worst case ~30 instances of a ~40-line component — noise beside three webfonts.

**The tiles stay server components** — `TodayTile`, `TodoTile`, `LayersTile`, `PushTile`, `WeekTile`, `DoneTile` in `personal/_blocks/`, each taking a view model: Plan C's `_blocks/` shape, with the same rule that no view model is computed in a component that does not render it. **Forms render their own control**, so a tile's header slot is `<EventForm defaults={…} layers={…} />` — a button when closed, a form when open. "Opens in place, nothing moves" (deck §7) is then a DOM fact: the form appends inside the tile, the row weight absorbs it, and a row that runs out of `minmax` grows.

**Nesting is legal and looks wrong, so state it once:** `LayoutEditor` is client, the tiles it renders are server components handed to it as props, and those tiles render further islands. Fine in RSC — the tiles are already-rendered nodes by the time the editor sees them.

---

## 6. `LayoutEditor`: moving server children, and what Save costs

```tsx
// src/app/(app)/personal/page.tsx (server)
<main className="app-content"><div className="fl">
  <LayoutEditor layout={layout} tiles={{
    today:<TodayTile view={today}/>, todos:<TodoTile view={todos}/>, layers:<LayersTile view={layers}/>,
    push:<PushTile view={push}/>,   week:<WeekTile view={week}/>,   done:<DoneTile view={done}/> }}/>
</div></main>
```

**Feasible, with three constraints.**

1. **Serializable in the RSC sense.** A plain object whose values are ReactNodes is; a function or class instance is not. `Record<PersonalTile, ReactNode>` — a *map*, so the editor never looks a tile up by index.
2. **`key` is the whole game.** Each cell wrapper is keyed by the tile id, so a move re-orders the DOM and **moves the existing subtree** instead of remounting it. Get it wrong and every arrow press remounts the tiles — an open form loses what was typed, every `TodoRow` loses its busy state. The wrapper must be **the same element type in both modes** (`<div className="pe-cell …">` always) and the toolbar a *conditional child inside it*, never an extra wrapper around the tile: a new wrapping element changes the tree shape and remounts everything below it.
3. **The editor cannot re-fetch tile contents** — it holds opaque nodes. The design doc's requirement, satisfied by construction rather than by discipline.

**The header row lives inside the editor too**, because `Edit layout` / `Save` / `Cancel` / `Reset` share state with the grid and the alternatives are a store or the URL. **This costs nothing in alignment:** `.fl-head` is `padding:28px 28px 0` (`components.css:184`) and `.app-content` is `padding:28px 28px 72px` (`:128`), so a title inside `<main>` sits at the same *y* as Freelance's above it, and `.fl` gives both the same 920px column and left edge (`:154`). `.fl-headrow{grid-template-columns:minmax(0,1fr) auto;align-items:end}` already exists for exactly this — `components.css`'s own comment: *"When a title-level control eventually needs to sit RIGHT of the title, the pattern already exists… Do not invent a second one."* Consequence: **`/personal` needs no segment layout** — no view switch, no title shared across routes.

**What Save costs.** `PATCH /api/settings` with `{ personalLayout }`, then `startTransition(() => router.refresh())` — which re-runs the route's server render (the `(app)` layout's rail read plus the page's) and reconciles in place: one cached-token read, ≤3 parallel `listEvents` under a 5 s bound, two Mongo reads under `MONGO_READ_TIMEOUT_MS`. **The editor's `useState` survives**, because React reconciles it by position and only its props change; the tiles arrive as new nodes. So Save re-syncs nothing — the local copy already equals what was stored. `Cancel` is `setLocal(layout)` **in the click handler**, never in an effect.

**One invariant this rests on:** while edit mode is open, nothing else calls `router.refresh()`. Otherwise a tick pushes a new `layout` prop under an editor holding unsaved changes, and the only fixes are an effect (a fifth lint error) or a `key` remount (which discards the session). Cheapest guarantee: **ticks, forms and switches are disabled in edit mode.** Deck §8 says the tiles keep *rendering* live data — rendering, not accepting input — so I read this as consistent, but I want it ruled.

---

## 7. Open item 4, answered: a tick is `router.refresh()`

**It cannot re-read only the to-do tiles, and should not try.** The alternative — three tiles fetching a JSON endpoint from the browser — is client-side fetching where the server already has the data, forbidden by visual spec §7.8, and it creates a second source of truth for the one thing on this page Riku actually owns. The cost is bounded: because `readCalendarWindow` reads `today … today+7` in **one** window, a refresh is ≤3 parallel HTTP calls, not 24, each under `GOOGLE_TIMEOUT_MS`, with the existing screen up throughout (`useTransition`'s `isPending`, exactly as `CheckNow.tsx` documents). Local feedback comes from `TodoRow` marking itself, which is why the row is the island. **Open item 4 closes as: a full route refresh, with optimistic feedback inside the row.**

---

## 8. The lint baseline — the rule is simpler than the exception

`npx eslint` at HEAD: **4 errors, 3 warnings.** All four errors are `react-hooks/set-state-in-effect`, all the same shape (an effect calling a loader that calls `setState`): `freelance/queue/page.tsx:69`, `queue/PushControls.tsx:22`, `settings/page.tsx:35`, `login/page.tsx:23`. The warnings are two unused test bindings and a stale `eslint-disable` in `db.ts:20`.

**The rule for P10: no `useEffect` in any island** — not "avoid setState in effects", none at all. Every island here is event-driven, and the two shipped models prove it suffices: `CheckNow.tsx` is `useState` + `useTransition` + `useRouter` with no effect; `TopBar.tsx` needs a per-navigation value and gets it with a **`key` on a child**, with a docblock saying both halves are load-bearing. Three temptations:

- **The event form's defaults** — *"Date: today; Start: the next full hour; End: one hour after"* (deck §7). On the client that is a hydration mismatch; in an effect it is a fifth error. **Compute on the server, in Manila, pass as strings:** `defaults={{ dayKey:"2026-09-11", start:"15:00", end:"16:00" }}` — no client clock, and `nextFullHour` becomes testable in `days.test.ts`.
- **`LayoutEditor` re-syncing on a prop change** — not needed (§6).
- **`LayerSwitches` mirroring `layers` into state** — initialise from the prop once; after a successful PATCH the refresh brings a prop it ignores because its copy matches; on failure it reverts locally, which is deck §6 Tile 3.

**Verification in every plan:** `npm run lint` still ends `✖ 7 problems (4 errors, 3 warnings)`, and `git grep -n useEffect 'src/app/(app)/personal/'` returns nothing.

---

## 9. The settings widening — three compile-time traps, two of which already exist

**(1) `SETTINGS_PROJECTION` already forces the issue.** Typed `Record<keyof OsSettingsValues,1> & { _id:0 }` (`osSettings.ts:75`) precisely so an unprojected new setting fails to compile. Keep it as it is.

**(2) `readOsSettings` gains a shared-mutable-default hazard.** It returns `{ ...OS_SETTINGS_DEFAULTS }` when there is no document (`:103`) — safe for three primitives. With arrays in it, every caller receives *the same array object*, and one stray `.push` in a view model corrupts the defaults for the life of the lambda. So: type `OS_SETTINGS_DEFAULTS` with `readonly` arrays, and **copy on read** — `layers: cloneLayers(row.layers)` element-wise, `personalLayout: resolvePersonalLayout(row.personalLayout)`. The element-wise copy is not paranoia: the accessor's docblock says values are copied by name *"so a projection change can never leak `_id`, `__v` or `updatedAt`"*, and `.lean()` returns raw Mongo — a sub-document that lost `_id:false` would leak `ObjectId`s into a client component's props and fail serialization at render.

**(3) `ALLOWED_KEYS` is the one place with no compile-time guard, and should get one.** It is a hand-written `Set` (`settings.ts:23`). Adding a key to `OsSettingsPatch` and forgetting the Set 400s loudly — fine. Adding it to the Set and forgetting the parse branch **accepts and silently drops it**, the exact failure the file's docblock warns about. Derive it with the trick the projection already uses:

```ts
const ALLOWED: Record<keyof Required<OsSettingsPatch>, true> = {
  chaserEnabled:true, chaserNDays:true, monitoringEnabled:true, layers:true, personalLayout:true };
const ALLOWED_KEYS = new Set(Object.keys(ALLOWED));
```

`parseLayers` and `validateLayout` are exported pure functions called from the two new branches, with typed 400s and the deck's bounds (10 layers, `calendarId` ≤256, `name` ≤120).

**One accepted hazard, stated so it is a decision.** The Layers tile flips one `enabled` and PATCHes the whole array; so does the Settings picker. Two devices in the same minute means last-write-wins. CLAUDE.md's "guarded atomic updates, never read-modify-write" is about *state transitions* (`pending`→`sent`), not a settings array, and the alternative — a positional `arrayFilters` update — is a second write path into the singleton that the one-accessor rule discourages. One user, two devices, a tick box: accept and record. (Splitting `layers` from `layersEnabled: string[]` removes the clobber but creates two sources for "is this layer on", which is worse.)

---

## 10. The layout store: strict on write, total on read — the Academics clause

The doc's `validateLayout` (four rows, every tile once, spans 2–12, rows ≤12, else a 400) is right **for the PATCH** and wrong for the read. The moment P11 ships a seventh tile — or any phase renames one — every stored layout fails it, the page falls back to `PERSONAL_LAYOUT_DEFAULT`, and Riku silently loses the arrangement he spent an evening on. That is the rewrite my standing question exists to prevent, and one pure function avoids it:

```ts
// src/lib/personalLayout.ts — pure, imports no model, unit-tested
export const PERSONAL_ROWS = 4;
export const PERSONAL_TILES = ["today","todos","layers","push","week","done"] as const;
export type PersonalTile = (typeof PERSONAL_TILES)[number];
export interface LayoutCell { tile: PersonalTile; span: number }
export type PersonalLayout = LayoutCell[][];

export function validateLayout(i: unknown): {ok:true;value:PersonalLayout}|{ok:false;error:string};
export function resolvePersonalLayout(stored: unknown): PersonalLayout;   // TOTAL. Never throws.
export function collapseSpan(span: number, cols: 6 | 1): number;
```

`resolvePersonalLayout` is total in four steps: drop unknown tiles; drop duplicates after the first; clamp spans to 2–12 and trim any row back to a 12-column sum; then **place every still-missing tile where the *current* `PERSONAL_LAYOUT_DEFAULT` puts it** — same row, appended, shrinking that row's last cell but never below 2, falling through to the next row with space. Every input yields a valid arrangement; unreadable input yields the default. P11 then ships a new default with its Classes tile, and Riku's saved arrangement *gains* a tile in a sensible place instead of vanishing. Cheapest insurance in the phase: feed the test last version's layout and assert the new tile appears.

`PERSONAL_ROWS = 4` is exported and read by the schema's length validator, `validateLayout`, the CSS row-class table and the editor's `↑↓` bounds — so a fifth row is one constant plus one CSS rule, not four edits in four files. The row *weights* stay in CSS keyed by index: a visual fact, not data.

**`OsSettings.personalLayout`** is a typed sub-schema array, `_id:false`, `strict:true`, length validator at `PERSONAL_ROWS`, inner array bounded at 6, `tile` an `enum: PERSONAL_TILES`, `span` `Number min:2,max:12` — CLAUDE.md's rules apply to sub-schemas or they are decorative. `updateOsSettings` already passes `runValidators:true` (`osSettings.ts:62`), and `healthSnapshot.ts`'s docblock records that this was verified against Mongoose 9.9.4 to run the array validator *and* every subdocument's bounds on a whole-array `$set`, so the guarantee holds without re-verifying it.

---

## 11. The models, against CLAUDE.md

**`src/models/Todo.ts`.** The doc's field table already satisfies every rule: bounded strings, an enum section, `Date` for `dueOn`, no `Mixed`, explicit `timestamps:{createdAt:true,updatedAt:true}`, no TTL (D9). Three notes.

- **Every write path uses `findOneAndUpdate(..., { runValidators: true })`**, or the `maxlength` bounds are decorative on updates — recorded twice already (`osSettings.ts:53`, `healthSnapshot.ts`). `strict: true` on the schema.
- **Cut one index.** Of the doc's three, `{section:1,done:1,dueOn:1}` exists to serve the To-do tile per section — but the tile shows **all three sections at once** (deck §6 Tile 2), so there is no per-section query. **One read serves the page:** `Todo.find({done:false}).sort({dueOn:1}).limit(TODO_READ_LIMIT)` feeds Today's `DUE`, the To-do tile's three sections and the week's to-do rows; grouping and the 20-per-section bound happen in `sortTodos`/`personalView`, pure and tested. A second read (`{done:true, doneAt:{$gte:…}}`) feeds Done this week. **Two queries, two indexes.**
- **Index creation is an operator step.** `autoIndex` is off in production (`db.ts:68`), so a new collection needs `npm run migrate:indexes` then `:apply`. That belongs on *What needs Riku's hands*, which does not mention it.

**`src/models/LastDigest.ts`** is HealthSnapshot's pattern verbatim (R55): `LAST_DIGEST_ID = "latest"`, `_id:{type:String,default:LAST_DIGEST_ID,enum:[LAST_DIGEST_ID],maxlength:16}`, `sentAt` required `Date`, `title` ≤80, `body` ≤320, `devices` `Number min:0`, `timestamps` both, no TTL. `src/lib/lastDigest.ts` mirrors `healthSnapshot.ts` — `saveLastDigest` upserts with `runValidators:true` and **one** retry on `code === 11000`; `getLastDigest` is a `findOne` on the id with a `Record<keyof StoredDigest,1> & {_id:0}` projection, returning `null` when absent **and when `sentAt` is not a `Date`**, the same "a cast asserts a shape nobody validated" guard and for the same reason: `dayKey(sentAt)` would throw outside the page's `try`.

**The purity split nobody notices until a test fails.** `src/lib/__tests__/viewModelPurity.test.ts` asserts that importing the view models registers **no Mongoose model**, transitively. So `personalView.ts` must not reach `Todo`, which forces two files: **`src/lib/todos.ts` pure** (`sortTodos`, `dueChipLabel`, `daysLate`, `digestWindow`) and **`src/lib/todoStore.ts`** for the Mongoose access. The purity test gains `days`, `todos`, `personalLayout`, `personalView`, and fails loudly if anyone merges the two.

---

## 12. `src/lib/google.ts` — raw fetch, one cached token *promise*

**Config** mirrors `readStConfig` (`stApi.ts:212`): `readGoogleConfig(source: NodeJS.ProcessEnv = process.env)`, taking the environment as a parameter so it is unit-testable, throwing `GoogleError("not-configured")` naming which of the three variables is missing and **never a value**.

**Errors:** `class GoogleError extends Error { kind:"not-configured"|"expired"|"timeout"|"http"; status?:number }`. Two mechanics to pin. `tsconfig.json` targets **ES2017**, so subclassing `Error` is safe and needs no `Object.setPrototypeOf` — say so, because that workaround is exactly what gets pasted in. And `AbortSignal.timeout()` rejects with a `DOMException` whose **`name` is `"TimeoutError"`** — match on `err.name`, not a message regex the way `siteHealth.ts:53` must (it classifies arbitrary fetch failures; we classify our own signal).

**The token cache is a cached *promise* on `global`, cleared on failure — `db.ts`'s shape exactly:** `declare global { var _googleToken: Promise<{token:string; expiresAt:number}> | undefined }`. Caching the promise rather than the value is not a stylistic echo: a render fires up to three `listEvents` at once, and a cached *value* means three parallel refreshes on a cold lambda. Cleared on rejection; treated as absent when `Date.now() > expiresAt - 60_000`. `invalid_grant` → `GoogleError("expired")`. Never logged, never returned by a route, never near a `NEXT_PUBLIC_` name.

**`readCalendarWindow` needs a different return shape than the doc gives it.** The doc says `{ events, failed: string[] }`. But `not-configured`, `expired` and a token-endpoint `timeout` are **global** — they happen once, before any per-layer call — and rendering them as "couldn't read Personal, Classes and Events" gives the wrong sentence on all three counts (deck §6 Tile 1 has distinct strings for each). Take the token **once**, then fan out:

```ts
export type CalendarWindow =
  | { ok: true; events: CalEvent[]; failed: string[] }    // failed = LAYER NAMES that did not answer
  | { ok: false; kind: GoogleErrorKind };
```

One `listEvents` per **enabled** layer under `Promise.allSettled`, each under `GOOGLE_TIMEOUT_MS = 5000`, one call for `today … today+7` split by `dayKey` after. `title` bounded to 200. A `401` on a calendar call clears the cached promise and retries once; a second `401` is `expired`. **No CSP and no proxy change:** the calls are server-side, `connect-src 'self'` is untouched, no `NEXT_PUBLIC_*` is added.

---

## 13. The bootstrap: the design doc's two routes cannot work as written

**The finding.** The session cookie is `sameSite:"strict"` (`src/app/api/auth/login/route.ts:132` — `__Host-session`, `httpOnly`, `secure`). Google's consent screen redirects the browser to `${APP_BASE_URL}/api/auth/google/callback` — a **cross-site top-level navigation**, on which a `SameSite=Strict` cookie is deliberately withheld. `src/proxy.ts` runs, finds no token, sees `isApiPath` true (`proxy.ts:83`), and returns **`{"error":"Unauthorized"}` 401**. The handler never runs, the `code` is spent, and Riku never sees the refresh token. `isPublicPath` allowlists `/api/auth/login` by exact equality and nothing else under `/api/auth/` (`proxy.ts:36–41`), so this is not a near miss. The `state` cookie the doc specifies is fine — `sameSite=lax` **is** sent on a top-level GET — which is what makes the mismatch easy to miss: the new cookie was designed for this, the old one was not.

**Three ways out, in the order I prefer them.**

1. **Do the bootstrap in a script, not in the app.** `scripts/google-auth.mts`, run as `node --env-file=.env.local --experimental-strip-types scripts/google-auth.mts` like the three scripts already in `scripts/`: start a throwaway `http.createServer` on 8787, print the consent URL, catch the callback, exchange the code, print the refresh token, exit; Riku registers `http://localhost:8787/callback` once. **My recommendation** — no route, no proxy edit, no `ALLOW_OAUTH_BOOTSTRAP` that can be left on in production, no code whose whole job is to 404. It *removes* security surface instead of adding it, and matches a convention the repo has. The cost is that it is not the ShikksTracker port the doc describes; D11 is a decision about *which Google Cloud project*, not about how a token gets pasted.
2. **Allowlist `/api/auth/google/callback` in `src/proxy.ts`,** exactly, letting the `httpOnly` `sameSite=lax` `state` cookie be the credential on that one request — it already is: random, one-shot, ten minutes — with the 404 gate above it. Honest, but it edits the app's authorization boundary, which R20 kept untouched through all of P8, and it needs a `proxy.test.ts` case.
3. **Keep the routes and sign in first.** Does not work: `SameSite=Strict` withholds the cookie whether or not a session exists.

**If the routes stay,** three details the doc should carry: the gate is `NODE_ENV === "development" || process.env.ALLOW_OAUTH_BOOTSTRAP === "true"` — the exact string, because `"false"` is truthy; both export `dynamic = "force-dynamic"` so the gate is not folded at build time; the deny path returns a bare 404 body, not a JSON error confirming the route exists. The `state` cookie can take the `__Host-` prefix for free. One small thing: the doc and `.env.example` both say RikuOS runs locally on 3001, but `package.json`'s `dev` is bare `next dev` — `next dev -p 3001` makes the registered redirect URI true by construction.

---

## 14. The morning route, and a correction the design doc needs

**The Today reads go inside the dispatcher job, before `composeDigest`, both caught into `"unavailable"`.** The route's ordering rules survive unchanged (`route.ts:24–29`): dispatcher last, every job writes its own `AgentRun`, the push is still the final side effect. `settings` is already in hand from line 39, so `settings.layers` costs no read. Both new reads are bounded — Google by `GOOGLE_TIMEOUT_MS`, the to-dos by `withDeadline(..., MONGO_READ_TIMEOUT_MS, "morning to-do read")` — and both log before downgrading, as the `fetchAttention` catch at line 136 does. `maxDuration` is 60 and the worst case rises ~5 s: still inside, but now two belts of slack rather than three.

**`buildPushPayload`'s slice 200 → 320 is a default for *every* push** (`push.ts:21`) — the expiry alert, the failure alert and the test push all go through it. All short, so harmless; `push.test.ts`'s bound moves with it and `title.slice(0,80)` does not change.

**The correction.** The doc says *"A failed LastDigest write is named in the problems on the morning it happens (`push record could not be stored`), the R58 pattern."* **That is not reachable.** R58 works for the site snapshot because that write is inside the `site-health` job, which runs *before* the dispatcher composes the body, so `snapshotStored` is known when `buildProblems` runs. Here the write happens **after `sendPushToAll`** (it stores what was sent, and the dispatcher throws when `delivery.sent === 0`, `route.ts:179`). By the time this write can fail, the body has been composed, sliced and delivered. There is no sentence left to add it to. Three honest alternatives:

- **(a) The run record only** — `itemsFailed: 1` on the dispatcher plus `console.error`, so tomorrow's watchdog says `dispatcher: 1 item failed`. Simple, consistent, a day late — which is what R58 exists to dislike.
- **(b) Let the tile say it.** `/personal` reads `fetchLatestRuns(["dispatcher"])` — one indexed `findOne`, already exported (`watchdog.ts:156`) — and when today's dispatcher run succeeded but recorded a failed item while *LastDigest* has nothing for today, the push tile says so instead of `No push this morning.` The truest reading, visible the same morning, which is what the tile is *for* (deck §6 Tile 4). It needs a string the deck does not have.
- **(c) A second push** — correct and noisy; I would not.

I recommend **(b) with (a) underneath**: the run record is the durable report, the tile the same-day one.

---

## 15. Navigation and the rest of the plumbing

- **`NavList.tsx`** gains `{ href:"/personal", label:"Personal", Icon: IconPersonal }` **first** (D13); its docblock already anticipates it. R44's two-match rule needs no change — `/personal` has no sub-routes, so `startsWith` and equality agree — and stays as written because `/personal/x` is a plausible P11 shape. Every item carries a glyph, never a mix, so **`IconPersonal` is required**: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.8}`, round caps, `aria-hidden="true"`, no registry.
- **`src/app/page.tsx` and `manifest.ts` are not touched** (D13) — one line in the spec, so a later reader does not "fix" the gap between "Personal is first in the rail" and "sign-in lands on Freelance".
- **`metadata = { title: "Personal" }`** — one word, joined to `APP_NAME` by the root layout's template (R64). **`dynamic = "force-dynamic"`, `maxDuration = 30`**, matching `/freelance`.
- **Read phases**, copying `/freelance`'s shape — one `try` per failure domain. **(1)** `connectDB()` + `Promise.all([readOsSettings(), readOpenTodos(), readDoneTodos(), getLastDigest(), fetchLatestRuns(["dispatcher"])])` under **one** `withDeadline(MONGO_READ_TIMEOUT_MS)`, so a database outage degrades to-dos, layers and the push tile *together* — exactly the state deck §11 draws. **(2)** `readCalendarWindow(layers, todayKey, addDays(todayKey,7))` in its own `try`, **skipped entirely when phase 1 failed**, because `Couldn't load layers, so the calendar wasn't read.` is a distinct sentence from `Couldn't read the calendar.` and only this ordering can tell them apart. **(3)** The six view models, each built in the task that renders it.
- **New routes**, thin, `requireSession` first (also the Origin check for mutations, `auth.ts:105`): `POST /api/calendar/events`, `POST|PATCH|DELETE /api/todos[/[id]]`, `GET /api/google/calendars`, `GET /api/google/status`. `calendarId` must match a stored layer — a pure `assertLayerCalendar(layers, id)`, testable without a route. All are under `/api/` and absent from `isPublicPath`, so they are already fail-closed and **`src/proxy.ts` needs no edit** (unless the lead takes §13 option 2).

---

## 16. Tests, and the file map for three plans

The doc's six test files are right. Four additions: **`personalLayout.test.ts`** — the doc's `validateLayout` list *plus* `resolvePersonalLayout` (missing tile gains its default position; unknown dropped; duplicate dropped; over-12 row trimmed; garbage → default; **a six-tile layout resolved against a seven-tile default keeps all six placements** — the P11 clause, asserted before P11 exists). **`viewModelPurity.test.ts`** gains four imports, which forces the `todos`/`todoStore` split. **`settings.test.ts`** gains the two keys, the 10-layer bound, and spans of 1 and 13 rejected at the API boundary. **`push.test.ts`** moves the body bound to 320 and keeps the title at 80. `collapseSpan(2,6)` gets its own case either way.

**Plan A — foundations.** `src/lib/constants.ts` *(modifies: `APP_TZ`)* · `src/lib/days.ts` *(creates, pure: `dayKey`, `dayStart`, `addDays`, `daysBetween`, `formatDay`, `todayKey`, `nextFullHour`)* · `src/lib/personalLayout.ts` *(creates, pure: `PERSONAL_ROWS`, `PERSONAL_TILES`, `PersonalTile`, `LayoutCell`, `PersonalLayout`, `PERSONAL_LAYOUT_DEFAULT`, `validateLayout`, `resolvePersonalLayout`, `collapseSpan`, `ROW_CLASS`, `SPAN_CLASS`)* · `src/models/Todo.ts` *(creates: `Todo`, `ITodo`, `TODO_SECTIONS`)* · `src/models/LastDigest.ts` *(creates: `LastDigest`, `LAST_DIGEST_ID`, `ILastDigest`)* · `src/models/OsSettings.ts` *(modifies: two sub-schemas, `readonly` defaults)* · `src/lib/osSettings.ts` *(modifies: widened values/patch, array cloning, `LayerSetting`)* · `src/lib/settings.ts` *(modifies: derived `ALLOWED_KEYS`, `parseLayers`)* · `src/lib/google.ts` *(creates: `GoogleError`, `GoogleErrorKind`, `GOOGLE_TIMEOUT_MS`, `readGoogleConfig`, `getAccessToken`, `listCalendars`, `listEvents`, `insertEvent`, `patchEvent`, `deleteEvent`, `CalEvent`)* · `scripts/google-auth.mts` *(creates, §13 option 1)* · tests `days`, `personalLayout`, `google`, plus `settings` and `models` extended.

**Plan B — logic.** `src/lib/todos.ts` *(creates — **pure, imports no model**: `sortTodos`, `dueChipLabel`, `daysLate`, `digestWindow`, `TODO_SECTION_BOUND`)* · `src/lib/todoStore.ts` *(creates — Mongoose: `readOpenTodos`, `readDoneTodos`, `createTodo`, `updateTodo`, `setDone`, `deleteTodo`, `pinTodo`, `unpinTodo`, `moveTodoPin`)* · `src/lib/calendar.ts` *(creates: `readCalendarWindow`, `CalendarWindow`, `assertLayerCalendar`)* · `src/lib/personalView.ts` *(creates, pure: `buildToday`, `buildTodoTile`, `buildWeek`, `buildDone`, `buildPush`, `buildLayers`, `TodoRowView` and the tile view-model types)* · `src/lib/lastDigest.ts` *(creates: `saveLastDigest`, `getLastDigest`, `StoredDigest`)* · `src/lib/digest.ts` *(modifies: `TodayInput`, `composeTodayLine`, placement second, the two `unavailable` problems)* · `src/lib/push.ts` *(modifies: 200 → 320)* · the four new API routes · `src/app/api/cron/morning/route.ts` *(modifies: the two Today reads, the LastDigest write after the send)* · tests `todos`, `personalView`, plus `digest`, `viewModelPurity`, `push` extended.

**Plan C — the page.** `src/styles/personal.css` *(creates: `.pe`, `.pe-grid`, `.pe-cell`, `.pe-r*`, `.pe-s*`, `.pe-tile`, `.pe-edit`, `.pe-bar`, `.pe-ghost`, two container queries)* · `src/styles/components.css` *(modifies: the **shared controls only** — tick, switch, stepper, text/date/time field, select, form frame)* · `src/app/layout.tsx` *(modifies: one import line, in fixed order)* · `src/app/(app)/personal/page.tsx` *(creates: server, three read phases, renders `<LayoutEditor>`)* · `_grid/LayoutEditor.tsx` *(`"use client"`)* and `_grid/TileToolbar.tsx` *(presentational)* · `_blocks/TodayTile · TodoTile · LayersTile · PushTile · WeekTile · DoneTile` *(server)* · `_blocks/TodoRow · TodoForm · EventForm · LayerSwitches` *(`"use client"`)* · `_shell/NavList.tsx` and `src/components/icons.tsx` *(modifies: one entry first, `IconPersonal`)* · `src/app/(app)/settings/page.tsx` *(modifies: the two cards, deck §9)* · `ARCHITECTURE.md` *(modifies: §3.1, §4.2, §5, §7 S18)*.

**Three files no plan touches, written down so it stays true:** `src/proxy.ts`, `src/app/login/page.tsx`, `next.config.ts` (no CSP change, no redirect, no new header).

---

## Where I expect to disagree

**With the Grid Architect,** twice. On `collapseSpan(2,6)`: I want a floor of 2 in the pure function; if they want a true `ceil`, a span-2 tile needs a designed ~80px form, and either way the contract must be settled before Plan A because Plan C's CSS is generated from it. And on the *unit* of the breakpoints: they will reasonably think in viewport widths, because that is how *"12 → 6 → 1"* reads, and I want container widths — 226px narrower today, different again after the phone pass.

**With the System Keeper,** on where the new controls live. They will want the tick, switch, stepper and field to be *system* vocabulary in `components.css` — exactly what §4 proposes. Where we may part is the grid: if "one shared recipe book" extends to `.pe-*`, we get a 900-line `components.css` and a Plan C that edits it every task, which is the discipline Plan C proved was worth having. I am asking for a fifth *file*, not a third *namespace*.

**With the Interaction Designer,** on the cost of a tick. They will want it instant and local; the honest answer is a `router.refresh()` that re-runs the route including up to three Google calls. My resolution is optimistic feedback inside `TodoRow` over a real full-route refresh — not a client-side to-do cache, which would be a second source of truth for the one thing on this page Riku owns. I also expect to disagree about ticks in edit mode: they will want them live, and live ticks there need either an effect (a fifth lint error) or a remount (which discards an unsaved arrangement).

**With the Honesty Critic,** mostly on the same side: §14's *LastDigest* correction is their kind of finding and I would like them to hold it. We may part on the push tile's third state — they may argue "a push went out but its text wasn't stored" is a distinction Riku does not need. I think it is precisely the silence-versus-blindness distinction deck §2.2 is about, but it costs a new string, and strings are Riku's.

---

## Questions for the lead

1. **A fifth stylesheet, `src/styles/personal.css` — yes or no?** It changes visual spec §7.1's "four files ship". Case in §4; fallback is `pe-*` inside `components.css`, the shipped precedent for `fl-*`.
2. **The OAuth bootstrap: script or routes?** §13 shows the two specified routes return 401 before they run, because the session cookie is `SameSite=Strict`. I recommend `scripts/google-auth.mts`; the alternative is a narrow, documented edit to `src/proxy.ts`, which no P8 plan was allowed to make. **This blocks Plan A.**
3. **Are ticks, forms and switches live in edit mode?** I recommend disabled. Deck §8 says the tiles keep *rendering* live data; if it also means accepting input, the editor needs a reconciliation story costing either a lint error or a remount.
4. **`collapseSpan(2,6)`: 1 or 2?** A Plan A contract; the visual consequence is the Grid Architect's.
5. **The push tile's missing sentence.** If *LastDigest*'s write fails after a successful send, no honest string exists — `No push this morning.` is false, `No push recorded yet.` is misleading. Something like *"A push went out this morning, but its text wasn't stored."* — or rule that the run record alone is enough and the tile stays silent.
6. **Container queries — the app's first modern-CSS feature in a codebase with none.** I think the trade is clearly worth it (§3). If not, say so now: the `@media` form is a two-line diff, but the numbers differ and they bake into Plan C.

---

## What I would cut

- **The third `Todo` index.** `{section:1,done:1,dueOn:1}` has no reader once one `find({done:false})` feeds Today, the To-do tile and the week (§11). Two indexes, two queries, whole page.
- **`ALLOW_OAUTH_BOOTSTRAP` as an environment variable**, if the script wins — a flag whose safety depends on someone remembering to switch it off, for a feature used exactly once.
- **Any second default arrangement.** No presets, no "compact" mode. `PERSONAL_LAYOUT_DEFAULT` has one reader beyond the editor's `Reset`, and `resolvePersonalLayout` is the only other thing allowed to consult it.
- **Any client-side re-fetch of tile data.** Visual spec §7.8 forbids it and this page offers three excuses (the tick, the switch, the form). The answer to all three is `router.refresh()`. If that ever proves too slow, the fix is a narrower *server* boundary, not a browser cache.
- **`GET /api/google/status` as a route** — the one place I would take either answer. It backs one Settings card and is a token refresh with no arguments; the Settings page could read it server-side instead. Flagged rather than argued, because it is not worth a decision.
