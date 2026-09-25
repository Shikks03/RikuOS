# P10a — The system and the shell: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship everything `/personal` renders *into*, plus the two shell changes P10 owes the whole app — the fifth stylesheet, the ten shared controls, the three tint tokens and the nine-step ramp, the `Personal` nav item and its glyph, and S20's 44px phone strip at R87's 439px — so that Plans B and C build on a finished vocabulary and a finished chrome, and so that the one number in this design the mockup cannot verify is verified here, in a browser, by the plan that ships it.

**Architecture:** The visual system lands as CSS only, in three files and one import line, ported from `docs/design/p10-mockup.html`'s own `tokens` / `components — P10 additions` / `personal` groups. The shell change is a single `@media` block in `components.css` plus one class name added to `Rail.tsx` — the rail *becomes* the strip by re-laying-out the markup that is already there, so no page learns about phone width and `/freelance`, `/queue`, `/settings` and `/login` inherit it without being edited. The ramp ships whole: nine frozen classes, three anchor tokens, four amended comments and one pure clamping function, all in one commit, so the comment and the code are never out of step.

**Tech Stack:** Next.js 16.2.10 (App Router) · React 19.2 · TypeScript `strict` · Vitest 4 · plain CSS custom properties, CSS container queries, one `@media`. **No new dependency. No CSP change. No `NEXT_PUBLIC_*`.**

---

## Why the phase splits here, and what this plan had to land first

**Nothing.** This is the first plan of the series and it depends on no P10 work.

**Why the boundary is *here*, and not somewhere else.** The split follows what P10 actually is, which is four things with four different failure modes: a *vocabulary* (CSS, verifiable against the mockup and against nothing else), a *logic layer* (pure functions and their I/O, verifiable by tests and by one real Google read), a *render* (JSX, verifiable only by looking at it on real data), and one *app-wide shell change* that belongs to no page. Three boundaries follow from that:

- **The vocabulary and the shell go together and go first**, because they are the only two parts of P10 that are *not* about the Personal page. `components.css`'s ten shared controls ship on the Settings page this same phase (R46), the three tint tokens and the four comment edits land in files every page reads (§6.2), and S20's strip lands on `/freelance` and `/queue`. Shipping them last would mean the Freelance page changing shape in the final commit of a Personal-page plan. Shipping them first means every later commit is a Personal-page commit.
- **The ramp goes in this plan and not in Plan B**, even though `heroTint` is a pure function and every other pure function is Plan B's. R84 requires the `tokens.css` and `DESIGN-INSPO.md` edits to ship *in the same commit as the ramp*, and R80's whole argument is that the nine classes and the one lookup are a single frozen artifact — nine states, nine contrast measurements, one anchor table. Splitting the lookup from the classes it selects would put half of R79–R84 in each of two plans and make neither reviewable.
- **The logic layer and the render are two plans, not one**, because the render is the only part that cannot be verified by a test and the logic is the only part that can. P8 learned this the expensive way and wrote it down (P8c: "every decision the page makes was pushed into Plan B's pure modules and is already pinned there"). Keeping them apart is what lets Plan C's verification be entirely "by eye, on real data" without that being an excuse.

**One consequence, stated rather than discovered.** This plan ships ~540 lines of CSS with **no consumer**. That is the same trade P8a made — `components.css`'s whole `.fl-*` half shipped in Plan A and was first rendered in Plan C — and it is why Task 6's verification is against the mockup and the stylesheet rather than against the app. It is *not* a licence to relax R89 / §5.8's "declared vocabulary with no consumer does not ship": that rule is about vocabulary with no consumer **in the phase**, and every class this plan ships has a named consumer in Plan C. `.pe-more` is the one that does not, and it is deleted (R89).

---

## Series file map

P10 is three plans. **Plan A (this file)** ships the system and the shell. **Plan B** ships data, logic and Google. **Plan C** ships the Personal page and the two Settings cards. B and C cite this map; the names and paths below are fixed here and must not be renamed later.

### Plan A — the system and the shell (this plan)

| File | Plan | Responsibility |
|---|---|---|
| `src/styles/personal.css` | A creates | **NEW, the fifth stylesheet.** Namespace `pe-` and no other. The mockup's whole `personal` group (lines 735–1272), minus `.pe-more` (R89). |
| `src/app/layout.tsx` | A modifies | One import line: `personal.css` **fourth**, after `components.css` and before `legacy.css` (§7.1). Nothing else in the file moves. |
| `src/styles/components.css` | A modifies | (a) the shared-control block — ten entries, appended after the existing `.fl-*` half; (b) the header's "two namespaces, no third" line amended to name that block, **in the same commit**; (c) S20's `@media (max-width: 438.98px)` block. Nothing already in the file changes shape (R32). |
| `src/styles/tokens.css` | A modifies | Three tint tokens (`--tint-save`, `--tint-spend`, `--tint-missing`) and four amended comments, R84's text verbatim. **In the same commit as the ramp** (R76's reason, widened by R84). |
| `docs/design/DESIGN-INSPO.md` | A modifies | One footnote directly under the "Semantic hues — meaning is fixed" table, R84's text verbatim. Same commit. |
| `src/lib/personalView.ts` | A creates, **B extends** | Plan A ships `HeroTint`, `PERSONAL_HERO_ANCHORS` and `heroTint()` and nothing else. Plan B adds the Today, week, to-do, push and layers view models to the same file. |
| `src/lib/__tests__/heroTint.test.ts` | A creates | §8's ramp test, whole. |
| `src/components/icons.tsx` | A modifies | Gains `IconPersonal`, built to the file's existing contract. Glyph ported from the mockup (specimen 07's rail, first nav item). |
| `src/app/(app)/_shell/NavList.tsx` | A modifies | `{ href: "/personal", label: "Personal", Icon: IconPersonal }` **first** (D13, §3.1). The two matching rules (P8 R44) are untouched. |
| `src/app/(app)/_shell/Rail.tsx` | A modifies | **One attribute.** The agents wrapper `<div>` gains `className="rail-agents"`, so R87's query can hide it by class rather than by `:has()` on an unclassed element. Nothing else. |
| `src/app/(app)/personal/page.tsx` | A creates, **C rewrites** | A title and nothing else, so the rail's new first nav item is not a dead link. Same move P8a made for `/freelance`. |

### Plan B — data, logic and Google (not this plan)

| File | Responsibility |
|---|---|
| `src/lib/days.ts` | `dayKey`, `dayStart`, `addDays`, `daysBetween`, `formatDay`, `todayKey` — pure, `Intl.DateTimeFormat` parts, no library. |
| `src/lib/todos.ts` | `sortTodos`, the due-chip labels, the overdue arithmetic, the 3-day digest window. |
| `src/lib/personalLayout.ts` | `clampSpan`, `collapseRow`, `compactRows`, `buildCells`, `buildTracks`, `validateLayout`, `resolvePersonalLayout`, `PERSONAL_TILES`, `PERSONAL_ROWS`, `PERSONAL_LAYOUT_DEFAULT`. **Pure; imported by a client component; may never import a model, `server-only` or `next/headers`.** |
| `src/lib/personalView.ts` | A creates; B adds every view model but `heroTint`. |
| `src/lib/google.ts` | `readGoogleConfig`, `getAccessToken`, `listCalendars`, `listEvents`, `insertEvent`, `patchEvent`, `deleteEvent`, `readCalendarWindow`, `GoogleError`, `CalendarWindow`, `GOOGLE_TIMEOUT_MS`. |
| `src/models/Todo.ts` · `src/models/LastDigest.ts` | New. |
| `src/models/OsSettings.ts` · `src/lib/osSettings.ts` · `src/lib/settings.ts` | `layers` and `personalLayout` as typed sub-schemas; `OS_SETTINGS_DEFAULTS`, `SETTINGS_PROJECTION`, `readOsSettings`, `ALLOWED_KEYS` and `parseSettingsPatch` all widen. |
| `src/app/api/todos/route.ts` · `src/app/api/todos/[id]/route.ts` · `src/app/api/calendar/events/route.ts` | The three mutation doors. `PATCH /api/settings` widens in place. |
| `scripts/google-auth.mts` · `scripts/sync-indexes.mts` · `package.json` · `.env.example` | The loopback OAuth bootstrap; two models added to the sync list; `dev` becomes `next dev -p 3001`; the three `GOOGLE_*` names documented. |
| `src/lib/digest.ts` · `src/lib/push.ts` · `src/app/api/cron/morning/route.ts` · `src/lib/constants.ts` | `composeTodayLine`, the 320 bound, the two new morning reads, the *LastDigest* write, `APP_TZ` and `PUSH_EXPECTED_HOUR`. |
| `src/lib/__tests__/` | `days.test.ts`, `todos.test.ts`, `layout.test.ts`, `personalView.test.ts`, `google.test.ts`, and `digest.test.ts` / `push.test.ts` extended. |

### Plan C — the Personal page and the two Settings cards (not this plan)

| File | Responsibility |
|---|---|
| `src/app/(app)/personal/page.tsx` | A creates, **C rewrites.** `force-dynamic`, phase 1 / phase 2, the two Suspense boundaries, the header band. |
| `src/app/(app)/personal/_blocks/` | Six server tiles. |
| `src/app/(app)/personal/LayoutEditor.tsx` · `TodoRow.tsx` · `TodoForm.tsx` · `EventForm.tsx` · `LayerSwitches.tsx` | The five islands. **Zero `useEffect`** (R33). |
| `src/app/(app)/settings/page.tsx` · `settings/_blocks/AgentSwitches.tsx` · `settings/_blocks/CalendarPicker.tsx` | The page becomes a server component; its existing client body moves verbatim into `AgentSwitches`; two cards are added. |
| `ARCHITECTURE.md` | §3.1's three rows, §4.2's Google line, §5's morning flow. **S19 and S20 are already recorded and are not rewritten.** |

---

## Ground rules for every task in this plan

- **How to read the ruling IDs.** `R1`–`R95` are the design lead's rulings (rounds 3–6); `M1`–`M9` are round 4's mockup fixes; `S1`–`S14` **in a ruling citation** are round 5's System Keeper / Interaction Designer rulings and are **not** `ARCHITECTURE.md`'s `S1`–`S20`; `C`/`N`/`Q` are round-2 critique items. Where this plan means the architecture decision it writes **S19 / S20 (`ARCHITECTURE.md` §7)**.
- **Repo boundary.** Nothing in this plan touches `../ShikksTracker` and nothing connects to its database.
- **No new dependency.** Not `clsx`, not a date library, not an icon package.
- **`src/proxy.ts` is not edited.** This plan adds one page inside the `(app)` group and no API route; the fail-closed allowlist already covers it.
- **`src/app/login/page.tsx` is not edited.** S20's query reaches `/login` through `components.css` only, and `/login` renders no rail — see Task 5.
- **`src/styles/base.css` is not edited.** Its reduced-motion rule is the personal layer's only `@media` dependency and it is already there (§5.8).
- **`docs/design/components.html` is not edited** — it is the frozen teardown reference, a source to translate *from* (§5.1).
- **`docs/design/p10-mockup.html` is not edited by this plan.** R95's four mockup fixes belong to the design team, not to the build; if a port reveals a further discrepancy, record it in the plan's post-build section and raise it, do not fix the mockup.
- **Every `String` gets a `maxlength`, every closed set an `enum`, no `Schema.Types.Mixed`** — this plan defines no schema, and that is the check: if a task seems to need one, it is Plan B's.
- **No `dangerouslySetInnerHTML`.** Every SVG is JSX.
- **Every task's check step runs `npm run lint`,** and its expectation everywhere in this plan is: **the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and nothing new.** `npm run lint` exits 1 on those four; that exit code is the pre-existing state. A **fifth** error or a **fourth** warning is a failure and stops the task.
- **The test count at the start of this plan is 531** (29 files). This plan adds one file and takes the suite to **531 + the ramp's tests**; Task 4 states the number.
- Commands are written for **Git Bash on Windows** from the repo root (`C:/Users/Shikks/Projects/ClaudeProjects/RikuOS`). Every commit runs on `master` and is **never pushed**.
- **Port 3000 is Riku's dev server and is never bound, opened or stopped by this plan.** Every browser check runs `npm run build` then `npx next start -p 3001`, and only the server this plan started is ever stopped, by its PID (P8c's rule, carried forward):

```bash
netstat -ano | grep ":3001" | grep LISTENING   # the PID is the last column
taskkill //PID <pid> //F
```

---

## Task 1: `personal.css`, and the fourth import

The mockup's `personal` group is the source and it is already production CSS. **Port it, do not rewrite it** — its comments carry the derivation of every threshold and are the audit trail the port leaves, exactly as `components.css`'s comments do.

**Rulings implemented:** R2 · R3 · R6 · **R7** (its surviving half: the stack is keyed to the **grid's** own width and never the viewport, so it is correct at either shell width — nothing else in P10 depends on the shell's answer) · R11 · **R12** (`.pe-grp` at `--ink-3`, not `--ink-4` — a group label is a label, not an absence) · R13 · R15 · R16 · R17 · R19 · **R25** · **R26** · R28 · R29 · R32 · R38 · R40 · R44 · R47 · R53 · R56 · R57 · R66 · R89 · R94 · M2 · M5 · M6 · S2 · S11 (round 5) · S13 (round 5) · §5.3 · §5.4 · §5.5 · §5.6 · §5.7 · §5.8 · §5.10 · §7.1.

**Files:**
- Create: `src/styles/personal.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/styles/personal.css` from the mockup's `personal` group**

Copy `docs/design/p10-mockup.html` **lines 735–1272** — from the `personal` banner down to the line immediately above the `mockup-only` banner — comments included, into `src/styles/personal.css`, with a file header in `components.css`'s own register naming the source, the namespace rule and the four deliberate differences below.

**Four deliberate differences from the mockup, each marked in a comment in the file itself:**

1. **`.pe-more` is not ported.** The mockup already carries R89's deletion as a comment block at lines 1024–1030 where the rule used to be; keep that comment, drop nothing else. Nothing on this page renders `+N more`.
2. **The page-local `:root` block at mockup lines 845–849 is not ported here.** Those three tint anchors go into `tokens.css` in Task 3 (R80, R84, §5.1). The mockup declares them page-locally only because its `tokens` block is a byte-verbatim copy of the shipped file. **The nine `.pe-tN` classes themselves DO come here** — three of them read `var(--tint-*)` from `tokens.css`, the six intermediates are page-local literals (§5.1).
3. **The `@media (prefers-reduced-motion: reduce)` rule is not ported.** `base.css` already carries it globally (§5.8), and the chevron's `.14s` transform is the only thing in this file it has to suppress. A second copy is a second place to keep in step.
4. **No `@media` and no `@supports` anywhere in this file.** Every threshold is a container query on `pgw` (the grid's own width) or `tile` (the cell's). A browser without container queries takes the one-column base, which is correct (R2). The **only** `@media` P10 adds anywhere is S20's, and it lives in `components.css` because it is a shell rule (Task 5).

**Eight things to check by eye after the paste, because each is a silent failure if it drifts:**

- `container:pgw / inline-size` is on **`.pe-wrap`** and `container:tile / inline-size` is on **`.pe-cell`** — never on `.pe-grid` and never on `.pe-tile` (M2). An element cannot query itself, and a container on the tile would fire 34px late and could never change the tile's own padding.
- The two `pgw` thresholds are **706px** and **820px**, and `--tracks` is read **only inside those two blocks**, so the one-column stack never sees it (§5.4).
- The four `tile` thresholds are **134 · 200 · 240 · 406 · 480 · 720** — six, not three. R38 names three; §5.4's second table names the other three, and the mockup has all of them. Nothing here is 480-for-span-7: **452.5px is span 6** (R93), and the threshold does not move.
- Every grid track list is `repeat(6, minmax(0,1fr))` / `repeat(12, minmax(0,1fr))`, never a bare `1fr` (R2).
- `.pe-pair`'s columns are `minmax(min-content,1fr)` — the **one** recorded exception to R2 (S13, round 5). `.pe-week` and `.pe-layers` stay `minmax(0,1fr)` (S11, round 5).
- `.pe-cell.is-gap{display:none}` is **the only rule in the file that hides a cell** (§4.7), and the two `:not(.pe-x0)` / `:not(.pe-s0)` re-shows are inside the two container blocks.
- `.fl>.pe-edit{margin-top:calc(-1 * var(--sp-4))}` is present and sits **after** `.pe-edit` (M6). Without it the shipped `.fl > :first-child{margin-top:0}` — which is (0,2,0) — zeroes the top half of the compensation and the grid drops 14px the moment edit mode opens.
- **No `container-type` on any ancestor of the header.** `.pe-sticky` dies silently under containment (R30, R87). The two containers this file declares are both *below* `<main>`; nothing in this file touches `.app`, `.app-body`, `.app-main`, `.fl-head` or `.fl`.

- [ ] **Step 2: Import it fourth in `src/app/layout.tsx`**

The order is fixed and is the whole reason the cascade is readable in one file:

```
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/components.css";
import "../styles/personal.css";   // NEW — fourth
import "../styles/legacy.css";
```

Match the existing import style in that file exactly (it may use `@/styles/…`; do not change the four that are there). **`personal.css` goes after `components.css` and before `legacy.css`.** Two reasons, both load-bearing: `.pe-*` rules that override a shared control (`.pe-row.is-day .sumrow`, `.pe-row.is-day .fl-open`) must come after it, and `legacy.css` must stay last so its scheduled deletion is still one line.

- [ ] **Step 3: Check**

```bash
# the namespace rule: every class selector in the file is pe-, or a shared
# class qualified BY a pe- ancestor. No bare element-shaped names (R32).
grep -nE '^\s*\.[a-z]' src/styles/personal.css | grep -v '\.pe-' | grep -v '\.fl' | grep -v '\.tick\|\.swx\|\.sq\|\.fld\|\.sel\|\.formwell\|\.btn\|\.tag\|\.eyebrow\|\.disclose\|\.sumrow'
# read every line this prints and confirm each is a pe- QUALIFIED rule, not a
# bare one. A bare `.tile` rule would border and pad .app-brand .tile, the
# 24px sunburst in the rail, on every page in the app (R32, C7).

grep -c '@media' src/styles/personal.css
# 0 — every threshold is a container query (R2)

grep -n 'pe-more' src/styles/personal.css
# only the R89 deletion COMMENT; no rule

grep -c 'container:' src/styles/personal.css
# 2 — .pe-wrap and .pe-cell, and nothing else (M2)

grep -n 'container-type' src/styles/personal.css
# no output, exit 1
```

Run: `npx tsc --noEmit` → no output, exit 0.
Run: `npm run build` → `✓ Compiled successfully`. The new sheet is in the bundle; nothing renders it yet.
Run: `npm run lint` → the four errors and three warnings, unchanged.

**Open `http://localhost:3001/freelance` and `/queue` after `npm run build && npx next start -p 3001`.** A new stylesheet with no consumer must change **nothing**: compare against the Freelance page as it looked before this task. If anything moved, a selector in `personal.css` is not `pe-`-qualified, which is exactly what step 3's first grep is for.

- [ ] **Step 4: Commit**

```bash
git add src/styles/personal.css src/app/layout.tsx
git commit -F - <<'EOF'
feat(p10a): the fifth stylesheet, namespace pe-, imported fourth

Ported from docs/design/p10-mockup.html's `personal` group (735-1272),
comments included: they carry the derivation of every threshold. Four
deliberate differences, each marked in the file:

  * .pe-more is not ported (R89) - R51b removed its only consumer and
    R58 declined the +1 more summary, so it has none left.
  * the page-local :root tint anchors stay out; they go to tokens.css
    with the ramp, in one commit (R84).
  * no second prefers-reduced-motion rule; base.css has it (5.8).
  * no @media and no @supports: every threshold is a container query on
    the grid's own width or the cell's (R2). pgw on .pe-wrap, tile on
    .pe-cell - never the grid, never the tile (M2).

Nothing renders this yet. A new sheet with no consumer must change no
existing page, which is what the pe- namespace rule buys (R32).

Claude-Session: <session-url>
EOF
```

---

## Task 2: The ten shared controls in `components.css`

They live here and not in `personal.css` because **the Settings layer picker ships this same phase on another page, and the Settings page has no stylesheet of its own** (R32, R46). Names are reference-style with no page prefix: `pe-` is the Personal page's and nothing else's, and there is no third namespace.

**Rulings implemented:** R25→R46 · **R27** (and R27→R46 for its two renames): `.fld`'s **16px is a control dimension** recorded as one — `layout.tsx` sets `maximumScale:1`, which iOS Safari has ignored since iOS 10, so a focused input under 16px auto-zooms and never zooms back, **and it is never licence for 16px prose**; `line-height:1.4` is declared because a UA gives form controls `line-height:normal`; `caret-color:--spend` stays, a reference-level convention and not a hue spend; and **`.sel::after` reuses `.sumrow::after`'s geometry so the page has ONE chevron shape**. · R32 · R41 · R42 · R46 · M5 · N8 · §6.1.

**Files:**
- Modify: `src/styles/components.css`

- [ ] **Step 1: Append the shared-control block**

Copy `docs/design/p10-mockup.html` **lines 582–734** — the `components — P10 additions` banner and everything under it down to the line above the `personal` banner — to the **end** of `src/styles/components.css`, comments included. Ten entries: `.tick` · `.swx` · `.sq` · `.fld` · `.fld-l` · `.sel` (with `select.fld`) · `.formwell` · `.pickrow` · `.tag.is-layer` · `.btn.hi`.

**Nothing already in `components.css` changes shape** (R32). The block is additive, appended, and the two modifiers (`.tag.is-layer`, `.btn.hi`) are used *with* their base class.

**Five things the port must get exactly right:**

- **`.tick`'s hit target is `::after{inset:-13px}` on all four sides → 40×40** (R41). ~~R25's `inset:-13px -6px -13px -13px`~~ gave 33×40 and is struck. Drawn with `position:relative` and an absolutely positioned `::after`, **never negative margins**, which would move the drawn box too. The row's `gap: var(--sp-4)` puts the edit button 14px away, so the target stops **1px clear** of it.
- **`.tick` must be later in the sheet than `base.css`'s `:focus-visible`.** Both are (0,1,0); `components.css` loads after `base.css`, so `.tick`'s 3px radius survives a focus ring (R25). This is a consequence of the import order Task 1 step 2 fixed — do not "fix" it with `!important`.
- **`.btn.hi` restates `.btn:disabled`'s ink and border** (`.btn.hi:disabled{border-color:var(--line);color:var(--ink-4)}`). At equal specificity the later rule wins, and a disabled `Save` must still read as disabled. `.btn.go` **stays unspent** on this page (§5.11).
- **`.tag.is-layer{max-width:calc(11ch + 20px)}`** — eleven characters *of name*, because `.tag`'s 10px side padding is inside the border box and would otherwise cut `Classes` to `Classe…` (M5).
- **`.pickrow{min-height:40px}`** so two 40px tick hit boxes never overlap (N8), and `.pickrow:has(.fl-note)` aligns the tick with the name's line (`margin-top:2.4px`) rather than the middle of two lines (R42).

- [ ] **Step 2: Amend the header's namespace line, in the same commit**

`components.css`'s opening comment currently says "Two namespaces and no third." Amend it to name this block rather than to admit a third prefix — R32's own wording. Replace the sentence with a form of:

> Two namespaces and no third. Reference names are kept verbatim (`.stat`, `.btn`, `.tag`, `.eyebrow`, `.navitem`, `.agent`, `.track`, `.statuspill`, and P10's `.tick`, `.swx`, `.sq`, `.fld`, `.fld-l`, `.sel`, `.formwell`, `.pickrow`) so a recipe can be diffed against `components.html` by eye; anything only the Freelance page has carries the page prefix `fl-`, and anything only the Personal page has carries `pe-` and lives in `personal.css`. The shared-control block at the foot of this file is the ten entries P10 ships here **because the Settings layer picker uses them on a page with no stylesheet of its own** (R46) — it is not a third namespace.

**This edit ships in the same commit as the block** (§6.1): a file whose header denies the block it contains is a file nobody trusts.

- [ ] **Step 3: Check**

```bash
# the ten entries are present, once each
for c in '\.tick{' '\.swx{' '\.sq{' '\.fld{' '\.fld-l{' '\.sel{' '\.formwell{' '\.pickrow{' '\.tag\.is-layer{' '\.btn\.hi{'; do
  printf '%s -> ' "$c"; grep -c "$c" src/styles/components.css
done
# every line prints 1

# no pe- prefix leaked into the shared block (R46)
grep -n 'pe-' src/styles/components.css
# no output, exit 1

# the hit target is the ruled one (R41)
grep -n 'inset:-13px' src/styles/components.css
# exactly one line, and it is `inset:-13px` with no per-side values
```

Run: `npx tsc --noEmit` · `npm run build` · `npm run lint` — as the ground rules state.

**Then look at `/freelance`, `/queue` and `/settings` on 3001 and confirm nothing moved.** `.tag.is-layer` and `.btn.hi` are the two entries that could reach existing markup, and neither class is used anywhere yet — so if a tag or a pill changed, the port added a bare `.tag` or `.btn` rule instead of a modifier.

- [ ] **Step 4: Commit**

```bash
git add src/styles/components.css
git commit -F - <<'EOF'
feat(p10a): ten shared controls in components.css, and the header amended

.tick .swx .sq .fld .fld-l .sel .formwell .pickrow, plus the modifiers
.tag.is-layer and .btn.hi. They are HERE and not in personal.css because
the Settings layer picker ships this same phase on a page with no
stylesheet of its own (R32, R46). Reference-style names, no page prefix:
pe- belongs to the Personal page and nothing else.

Nothing already in this file changes shape. The header's "two
namespaces" line is amended in this same commit to name the block, so
the file never denies what it contains.

.tick's hit box is inset:-13px on all four sides -> 40x40 (R41;
R25's 33x40 is struck), drawn with an absolute ::after and never with
negative margins, which would move the drawn box too.

Claude-Session: <session-url>
EOF
```

---

## Task 3: The ramp — nine frozen classes, three tokens, four comments, one pure function

**One commit.** R84 requires the `tokens.css` and `DESIGN-INSPO.md` edits to ship with the ramp so the comment and the code are never out of step, and R80's argument is that the nine classes and the one lookup are a single frozen artifact.

**Rulings implemented:** R79 · R80 · R81 · R82 · R83 · R84 · R85 · R95.1 (the corrected 1.8×) · and the three supersessions R8→R52→R79, R70–R72→R79–R83, R73→R80.

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `docs/design/DESIGN-INSPO.md`
- Create: `src/lib/personalView.ts`
- (the nine classes are already in `personal.css` from Task 1)

- [ ] **Step 1: Three tint tokens in `tokens.css`**

Into the existing `card tints` group, **after** `--tint-stale`, exactly these three lines and their anchor comments:

```css
  --tint-save:   linear-gradient(155deg,#052620,#0F1417 62%);  /* anchor 0 */
  --tint-spend:  linear-gradient(155deg,#2A1408,#141013 62%);  /* anchor 3 */
  --tint-missing:linear-gradient(155deg,#3A0B0B,#191016 62%);  /* anchor 8 */
```

`--tint-save` and `--tint-spend` are **ported verbatim** from `DESIGN-INSPO.md`'s Card tint recipe (lines 83–91, mirrored in `components.html:253–256`); they were never in `tokens.css` because P8 shipped no spend or save stat card. **`--tint-missing` had no source to port from and is built** to the same formula. Carry the calibration into a comment above the three, in `tokens.css`'s own register — the nine values are frozen and someone will eventually ask how they were derived:

- deep `#3A0B0B` — WCAG relative luminance **.01163**, between `--tint-stale`'s deep stop (`#241A03`, .01121) and `--tint-save`'s (`#052620`, .01523). **Mid-band, so the red end is no more present than the green end**, which is what keeps it a tint and not an alarm. `#440D0D` matched the green anchor's presence exactly and was rejected: brightest deep stop in the system, and it began to read as an alarm.
- 62% `#191016` — luminance **.00635**, inside the band the other four near-neutral stops sit in (`#141013` .00566, `#111117` .00582, `#141209` .00601, `#0F1417` .00664). **R81's one hard constraint:** R70's whole contrast result rests on the 62%-and-beyond region of every tint being effectively `--raised`, so a red tint that brightened that stop would move contrast for every ink on the tile at once.
- The calibration used **WCAG relative luminance, not HSL lightness**, which disagrees wildly across the four existing tints and is not a usable family test.

**`--alert` and `--amber` never appear.** A stray `var(--alert)` resolves to nothing, is invalid at computed-value time, and would make a red warning silently inherit body grey — the NAME MAP comment at the head of the file already says so and is not edited.

- [ ] **Step 2: R84's four comment amendments, verbatim**

The semantic-hues group comment becomes **exactly**:

```css
  /* semantic hues — meaning is fixed in ink; one recorded exception
     for background washes on the Personal page's hero tile (P10 R79–R84) */
```

and the three anchored tokens each gain a **pointer, not a restatement** — exactly these three lines, replacing the three bare declarations:

```css
  --spend:#FF8A3D;   /* money out, limits consumed, the brand mark — also P10 R84 */
  --save:#35D399;    /* value recovered, healthy, connected — also P10 R84 */
  --missing:#F87171; /* overdue, absent, late — also P10 R84 */
```

`--roi`, `--session` and `--stale` are **not** commented and **not** reordered; `--stale`'s hue is crossed by the ramp at step 2 without taking the ramp's meaning, and R84's rule is what contains that, not a fourth comment. ~~R76's two-token wording~~ → **R84's**: a ramp crossing four hues cannot be recorded as one token's second meaning without four comments that each tell a quarter of the truth.

- [ ] **Step 3: The `DESIGN-INSPO.md` footnote, verbatim**

Directly under the **"Semantic hues — meaning is fixed"** table (`docs/design/DESIGN-INSPO.md` line 64's table, which itself is **not rewritten**), in the register R9's layer-hue decline and R42's note already use:

> *One recorded exception: the Personal page's hero tile carries a background tint that ramps from `--save` through `--spend` to `--missing` with the day's pending-task count. This is a page-local reading of those hues **as a wash**; their fixed meanings in ink, on dots and on row borders are untouched, and no other surface may take a semantic hue as a wash without its own ruling. See P10 round 5, R79–R84.*

**`docs/design/components.html` is not edited** (§5.1). It is the frozen teardown reference and a source to translate *from*; its `.stat.spend` / `.stat.save` entries are the citation this port comes from, not a claim to correct.

- [ ] **Step 4: Confirm the nine classes against the frozen table**

`personal.css` already carries them from Task 1. Diff them **by eye** against §5.1's table, all four columns, all nine rows — the selector shape is `.pe-tile.is-hero.pe-t{n}{background:…;border-color:…}`, `.pe-t0` / `.pe-t3` / `.pe-t8` read `var(--tint-save)` / `var(--tint-spend)` / `var(--tint-missing)` and the six intermediates are page-local literals:

| Class | `pending` | deep stop | 62% stop | border |
|---|---|---|---|---|
| `.pe-t0` | 0 | `#052620` | `#0F1417` | `rgba(53,211,153,.2)` |
| `.pe-t1` | 1 | `#16220E` | `#111316` | `rgba(155,196,72,.2)` |
| `.pe-t2` | 2 | `#231B03` | `#131114` | `rgba(217,169,0,.2)` |
| `.pe-t3` | 3 | `#2A1408` | `#141013` | `rgba(255,138,61,.2)` |
| `.pe-t4` | 4 | `#2D1307` | `#151014` | `rgba(255,132,72,.2)` |
| `.pe-t5` | 5 | `#311107` | `#161014` | `rgba(254,127,83,.2)` |
| `.pe-t6` | 6 | `#341007` | `#171015` | `rgba(253,122,93,.2)` |
| `.pe-t7` | 7 | `#370D09` | `#181015` | `rgba(251,117,103,.2)` |
| `.pe-t8` | 8 or more | `#3A0B0B` | `#191016` | `rgba(248,113,113,.2)` |

All gradients are `155deg`; all borders are the hue at `.2` alpha; **`--r-feature` is invariant across all nine and across the untinted render** (R82). The untinted render is `.pe-tile.is-hero{background:#171B21;border-color:var(--ink-4);border-radius:var(--r-feature)}` and nothing else — and it now means **exactly one thing: the to-do store did not answer** (R83).

**Do not regenerate the six intermediates.** They were interpolated once (OkLCh on the short hue arc for the deep stop and the border; straight OKLab for the near-neutral), gamut-mapped by reducing chroma rather than clipping a channel, checked as a strip, measured, and frozen as hex. **That is a build-time method only; the shipped CSS is frozen hex.** A tuned value that got checked is worth more than a formula that did not.

- [ ] **Step 5: Create `src/lib/personalView.ts` with `heroTint` and nothing else**

```ts
/**
 * personalView.ts — the Personal page's view models. Pure: no database, no
 * network, no environment, no Date.now(). Plan B adds the Today, week, to-do,
 * push and layers models; Plan A ships the ramp, because R84 requires the
 * ramp's CSS, the tokens and the design-system footnote to land in one commit
 * and R80 makes the nine classes and this one lookup a single frozen artifact.
 *
 * THE RAMP (R79-R85). `pending` = to-dos due today + to-dos overdue. NOTHING
 * ELSE. Scheduled calendar events never count, however many there are: Riku's
 * word was "task", the page's word for a task is a to-do, and an event is never
 * tickable. An overdue to-do does NOT force the top of the ramp - it is inside
 * the count like any other item (R85, Riku: "No - it just counts as one.").
 *
 * `pending` is a FREE READ, not a new query (R70): it is the row count of the
 * DUE group the hero already renders. `Nothing due.` renders iff pending = 0
 * iff .pe-t0. A failed read renders .pe-fail in the group's place, and then
 * there is no .pe-tN at all.
 *
 * ONE FIELD, never two booleans (R80). PERSONAL_HERO_BUSY_AT is deleted:
 * R73's single-threshold constant is superseded by the anchor table below.
 */

/** Nine states, no tenth. The class is `.pe-t${n}`. */
export type HeroTint = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * The frozen anchor table - green at 0, orange at 3, red at 8 - and the three
 * numbers Riku can change. Changing one is a table edit plus nine regenerated
 * literals in personal.css, not a code change (R80). The two segments are
 * deliberately unequal: the first three items move the colour 1.8x as far as
 * the next five do, measured as an end-to-end OKLab dE of .1110 split .0774 /
 * .0422 (R79, corrected by R95.1). A day going from nothing to three things
 * has changed more, to Riku, than a day going from four to eight.
 */
export const PERSONAL_HERO_ANCHORS: Readonly<{ save: 0; spend: 3; missing: 8 }> = Object.freeze({
  save: 0,
  spend: 3,
  missing: 8,
});

/**
 * One position on the ramp, or null.
 *
 *   null in  -> null out. The to-do read did not answer, so the page has no
 *              count and the hero claims nothing (R83). This is the ONLY
 *              meaning of the untinted hero.
 *   clamped  -> 9, 40, Infinity all return 8. A day with fourteen things looks
 *              like a day with eight.
 *   not an integer >= 0 -> null. And even if a bad value escaped, `.pe-t{bad}`
 *              matches no rule and renders the untinted hero, which is the safe
 *              render (R80, on R3's reasoning).
 */
export function heroTint(pending: number | null): HeroTint | null {
  if (pending === null) return null;
  if (!Number.isInteger(pending) || pending < 0) return null;
  return Math.min(pending, PERSONAL_HERO_ANCHORS.missing) as HeroTint;
}
```

**`heroTint` is decided at render and refresh time, never live mid-interaction** (R67). Adding a to-do that takes the count from 2 to 3 does not warm the hero as the form closes; the next server render does it. **And the tint survives edit mode (R75) and an open form (R78), undimmed and unswapped** — a tint is not a control, and the form covers the group that displays the count, not the read that produced it. Both facts are Plan C's to honour; they are recorded here because this is the function they constrain.

- [ ] **Step 6: Create `src/lib/__tests__/heroTint.test.ts`**

§8's list, whole — nine frozen states are exactly the kind of thing a refactor silently re-derives:

- `0 → 0`, `3 → 3`, `8 → 8`; `1,2 → 1,2`; `4..7 → 4..7` (nine assertions, one per state).
- **`9, 40, 1e9 → 8`** (clamped).
- **`null → null`**, and that is the only way to get `null` from a successful read.
- `-1`, `1.5`, `NaN` → `null`.
- The returned value is **one field**: assert the module exports no `"clear" | "busy"` union and no boolean pair — `expect(Object.keys(require-shape))`-style structural assertions are brittle, so pin it the way §8 means it: a test asserting `heroTint` returns `number | null` and a comment naming `PERSONAL_HERO_BUSY_AT` as deleted, plus the grep in Task 6.
- **`pending` excludes events**: a day with ten scheduled events and nothing due is `heroTint(0) === 0`. Write it as a named test with that sentence in the title, so the claim is visible in the runner's output even though the function cannot see an event.
- **An overdue to-do counts as one** (R85): one overdue item, nothing else due → `heroTint(1) === 1`, not `8`.
- `PERSONAL_HERO_ANCHORS` is `{save:0,spend:3,missing:8}` and is frozen (`Object.isFrozen`).

- [ ] **Step 7: Check**

Run: `npm test` → all suites pass, **531 + 15 = 546 tests** if the list above is written as fifteen `it()` blocks. If your grouping differs, **state the number you got** and carry it forward to Task 6; the number is a fact to report, not a target to hit.

```bash
# the deleted constant must not exist anywhere (R80)
git grep -n 'PERSONAL_HERO_BUSY_AT'
# no output, exit 1

# the ramp's three tokens are in tokens.css, and --alert/--amber are not (5.1)
grep -n 'tint-save\|tint-spend\|tint-missing' src/styles/tokens.css   # three lines
git grep -n 'var(--alert)\|var(--amber)' -- src/ ':!src/styles/tokens.css'
# no output, exit 1  (tokens.css is excluded because its own NAME MAP comment
# is the sentence explaining why those two aliases must not exist)

# R84's exact comment text landed
grep -n 'meaning is fixed in ink' src/styles/tokens.css        # one line
grep -c 'also P10 R84' src/styles/tokens.css                   # 3
grep -n 'R79–R84' docs/design/DESIGN-INSPO.md                  # one line
```

Run: `npx tsc --noEmit` · `npm run build` · `npm run lint`.

**And measure the nine, because R80 says nine states is nine measurements a builder can report.** Open the mockup's `.ramp` chip strip (it draws all nine side by side) in Chrome on 3001-independent local file and, with DevTools' contrast readout, confirm §5.1's measured band holds: `--ink` **13.58–15.92** against a `--raised` baseline of 15.1 · `--ink-3` **2.68–3.15** against 2.99 · `--missing` **5.82–6.82** against 6.49. **Report the nine readings; do not re-tune a value to hit one.** The two stops bound the whole surface because the gradient holds flat from 62% to 100%, and every ink lands before the 62% stop at every width — so the deep-stop column is a conservative floor.

- [ ] **Step 8: Commit — one commit, all five files**

```bash
git add src/styles/tokens.css docs/design/DESIGN-INSPO.md src/lib/personalView.ts src/lib/__tests__/heroTint.test.ts
git commit -F - <<'EOF'
feat(p10a): the hero's nine-step ramp - tokens, comments and the lookup

R79-R85. The hero is tinted by the day's pending-task count on a
two-segment ramp: green at 0, orange at 3, red at 8, clamped at 8. Nine
states, no tenth. Three supersessions land with it: R8's hueless mark is
dead, R52's two states and four-or-more threshold are dead, and R70-R72's
two-recipe machinery is dead. What survives from R8 is the feature radius
and the untinted render, which now means exactly ONE thing - the to-do
store did not answer (R83).

Five files, ONE commit, because R84 requires the tokens and the design-
system footnote to ship with the ramp: a file whose comment and code
disagree about what a hue means is the failure this rule exists to stop.

  tokens.css     three tint anchors. --tint-save / --tint-spend are
                 ported verbatim from DESIGN-INSPO's card-tint recipe;
                 --tint-missing had no source and is BUILT to the same
                 formula, its two stops tuned against the four existing
                 tints by WCAG relative luminance (not HSL lightness,
                 which disagrees wildly across the family). Plus R84's
                 four comment amendments, verbatim.
  DESIGN-INSPO   one footnote under the semantic-hues table; the table
                 itself is not rewritten. components.html is untouched -
                 it is the frozen reference this port translates FROM.
  personalView   heroTint(pending) -> 0..8 | null, one pure clamping
                 lookup and a frozen anchor table. ONE view-model field,
                 never two booleans. PERSONAL_HERO_BUSY_AT is deleted.
  the test       nine states, the clamp, null in / null out, -1 / 1.5 /
                 NaN -> null, events never counted, one overdue = 1.

The nine classes themselves shipped in personal.css and are frozen hex:
interpolated once in OkLCh (deep stop and border) and OKLab (the
near-neutral), gamut-mapped by reducing chroma, measured, then written
out. No runtime colour maths - an out-of-range value matches no rule and
is VISIBLE as the untinted hero, where an interpolation would hand back
an arbitrary colour confidently (R80).

Claude-Session: <session-url>
EOF
```

---

## Task 4: `IconPersonal`, and the nav item first

**Rulings implemented:** D13 · §3.1 · P8 R44 (unchanged).

**Files:**
- Modify: `src/components/icons.tsx`
- Modify: `src/app/(app)/_shell/NavList.tsx`
- Create: `src/app/(app)/personal/page.tsx`

- [ ] **Step 1: `IconPersonal` in `src/components/icons.tsx`**

Built to the file's existing contract, which §3.1 restates: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.8}`, round caps and joins, `aria-hidden="true"`, **no intrinsic size** (every consumer sizes it through an existing CSS rule — here `.navitem svg{width:13px;height:13px}`).

The glyph is already drawn: `docs/design/p10-mockup.html` **line 3512**, specimen 07's rail, the first nav item — a calendar frame with two hangers and a header rule:

```
<path d="M4 6.5h16v12.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/>
<path d="M8 3.5v4M16 3.5v4M4 11h16"/>
```

Port those two paths as JSX. Match the surrounding components' exact prop spelling in `icons.tsx` (`strokeLinecap`, `strokeLinejoin`) — the mockup writes HTML attribute names.

- [ ] **Step 2: `NavList.tsx` — one entry, first**

```ts
const NAV = [
  { href: "/personal", label: "Personal", Icon: IconPersonal },
  { href: "/freelance", label: "Freelance", Icon: IconFreelance },
  { href: "/settings", label: "Settings", Icon: IconSettings },
] as const;
```

**Three things this task does not do**, each named because the file's own docblock invites the mistake:

- **The two matching rules are untouched.** `.is-active` by `startsWith`, `aria-current="page"` by equality (P8 R44). `/personal` has no sub-route, so both match identically there — which is exactly why nothing needs changing.
- **The post-login redirect and the `/` route are not touched** (§3.1). `/login` still defaults to `/freelance`.
- **The docblock's "Two items since R42" and "Adding /personal later is one entry in this array" sentences are updated to say three, and to say that it was.** A comment that predicts the change and then does not record it having happened is worse than no comment.

**Both nav items carry a glyph or neither does** — P8's rule, and P10 must not be the page that breaks it. Three items, three glyphs.

- [ ] **Step 3: A minimal `/personal` root, so the first nav item is not a dead link**

`src/app/(app)/personal/page.tsx` — the same move P8a made for `/freelance`, and **Plan C rewrites this file entirely**:

```tsx
import type { Metadata } from "next";

/**
 * PLACEHOLDER. Plan A ships the rail's new first nav item, so this route must
 * resolve; Plan C rewrites this file as the real page (force-dynamic, phase 1 /
 * phase 2, six tiles, five islands). Nothing here is load-bearing except the
 * header's shape, which Plan C keeps: the title band sits ABOVE <main>, in
 * .fl-head > .fl, exactly as the Freelance segment's header does, so the band,
 * the top bar and the content share one left edge by construction (P8 R34).
 *
 * The tab title is one word: the root layout carries the `%s · APP_NAME`
 * template, so no page file ever writes the product name (P8 R64).
 */
export const metadata: Metadata = { title: "Personal" };

export default function PersonalPage() {
  return (
    <>
      <div className="fl-head">
        <div className="fl">
          <div className="fl-headrow">
            <h1 className="fl-title">Personal</h1>
          </div>
        </div>
      </div>
      <main className="app-content">
        <div className="fl" />
      </main>
    </>
  );
}
```

**One deviation from the mockup, recorded here so Plan C inherits it rather than rediscovering it.** The mockup writes `<h3 class="fl-title">Personal</h3>` (e.g. line 2447) because a specimen is nested inside a document about the page. **The app ships `<h1>`**, matching `/freelance`'s own `<h1 className="fl-title">`: `.fl-title` carries `margin:0` so a real heading renders identically, and P8 R42 already ruled that block headings are real headings. `/settings` having no heading of any level stays P8's open carry-forward (§10 item 10) and is not fixed here.

- [ ] **Step 4: Check**

Run: `npx tsc --noEmit` → no output.
Run: `npm run build` → `/personal` appears in the route table.
Run: `npm run lint` → four errors, three warnings.

On 3001: the rail shows **Personal · Freelance · Settings**, in that order, each with a glyph. Click `Personal`: the route resolves, the title renders, `Personal` takes `.is-active`'s raised fill and inset hairline, and `aria-current="page"` is on it (check in DevTools). Click `Freelance`, then `Queue`: `Freelance` stays lit and `aria-current` is **not** on it — P8 R44 still holds.

- [ ] **Step 5: Commit**

```bash
git add src/components/icons.tsx "src/app/(app)/_shell/NavList.tsx" "src/app/(app)/personal/page.tsx"
git commit -F - <<'EOF'
feat(p10a): Personal first in the rail, with its glyph

D13: the daily page reads first. IconPersonal is ported from the
mockup's own rail (specimen 07) and built to icons.tsx's contract -
24-unit viewBox, 1.8 stroke, round caps, no intrinsic size.

The two matching rules are untouched (P8 R44): .is-active by startsWith,
aria-current by equality. /personal has no sub-route, so both match
identically there, which is why nothing needed changing. The post-login
redirect and / are not touched.

The route root is a placeholder title so the new nav item is not a dead
link - the same move P8a made for /freelance, and Plan C rewrites it. It
does fix one thing for good: the title band sits above <main> in
.fl-head > .fl, and the heading is an <h1>, not the mockup's document-
nested <h3>.

Claude-Session: <session-url>
EOF
```

---

## Task 5: S20's phone strip, at R87's 439px — the app's one new `@media`

**This is the only task in P10 that changes how an existing page renders**, and it changes four of them. Read the whole task before starting.

**Rulings implemented:** R50 · R87 · S20 (`ARCHITECTURE.md` §7) · R30 (the containment prohibition this obeys) · §3.2 · §6.2.

**Files:**
- Modify: `src/styles/components.css`
- Modify: `src/app/(app)/_shell/Rail.tsx`

### Why 439, why `@media`, and what it must not break

**The number is derived, not chosen** (R87). R40 measured the form floor at **213px of tile**. With the rail at 170px and `.app-content`'s 28px of padding on each side, the content column is `viewport − 226`. `viewport − 226 ≥ 213` gives **439px** as the last width at which the rail can still leave room for a form to open. Below it the rail makes the page's one journey — the push buzzes, open the page, read the day, tick with one thumb, add what came up — impossible; at or above it, it does not. **A 390px phone therefore takes the strip and gets 334px** (the figure the mockup states). **A 768px tablet keeps the rail**, takes the one-column stack because its 542px grid is under the 706px threshold, and both forms open.

**Why `@media` and not a container query**, when every other threshold on this page is a container query: the shell is not inside a container, and the only element that could serve as one is `.app-body`. **R30 forbids exactly that** — no ancestor of the header may take `container-type`, because containment silently kills the sticky edit-mode pill row. So the rail's threshold cannot be a container query without breaking edit mode. `base.css` already carries one `@media` (reduced motion); **this is the second and last.**

**What it must not break, page by page.** The shell is app-wide, so this query lands on every route in the `(app)` group:

| Route | What must still be true below 439px |
|---|---|
| `/freelance` | The hero row, both disclosures, Block E and the health strip all render; `.app-content`'s 28px padding still applies; the 920px `.fl` column is width-constrained by `max-width`, so it simply takes the 334px available. The page is **not** phone-designed and is not expected to look good — P8's §10 phone debt is only **partly** paid (§6.2). Nothing may be clipped or unreachable. |
| `/freelance/queue` | Same, plus: the view switch (`.segmented`) still renders and both tabs are tappable. It brings `legacy.css`'s own `<main>`, not `.app-content` — so confirm the strip sits above it correctly. |
| `/settings` | `legacy.css`'s `.card` grammar still renders, and the number input and buttons are still reachable. Plan C adds two cards here; they must land into a shell that already works at phone width. |
| `/login` | **Unaffected and must stay unaffected.** `/login` sits outside the `(app)` group and renders no rail, so no selector in this query can match it. Confirm by looking, not by reasoning. |

**And the cost, stated in the question and accepted:** **the coloured agent badges are hidden at phone width** (R50, S20). There is nowhere for six badges to sit in a 44px strip. They come back at the phone design round, which replaces this strip entirely and owes it nothing.

- [ ] **Step 1: One class name in `Rail.tsx`**

The agents group is currently an unclassed `<div>` wrapping `.grouplabel` and the `<Suspense>`. Give it a class:

```tsx
      <div className="rail-agents">
        <span className="grouplabel">Agents</span>
        <Suspense fallback={<AgentsSkeleton />}>
          <AgentsBlock />
        </Suspense>
      </div>
```

**Why a class and not `:has()`.** R87 requires the block to be hidden "by `display:none` on its wrapper — not by a second mechanism, and not by removing it from the markup". Hiding an unclassed `<div>` means a structural selector (`.app-side > div:has(.grouplabel)`) that breaks the first time anyone adds a second group to the rail. One class name is the smallest honest way to name the thing being hidden. `AgentsBlock` and `AgentsSkeleton` are **not** touched: the read still happens, the Suspense boundary still exists, and a database failure below 439px still renders six grey badges — into a hidden box. That is deliberate. Removing the read would make the strip a different component with a different failure mode, and this shell is provisional.

- [ ] **Step 2: The query, at the foot of `components.css`'s shell group**

Place it **immediately after the shell group** (after `.app-content`), not at the end of the file: it is a shell rule and it belongs where the rules it overrides are. Comment it with the derivation, in the file's register.

```css
/* ---- the phone strip (S20, R87) — THE APP'S ONE NEW @media ------
   Below 439px of viewport the 170px rail becomes a 44px bar across the
   top and the page takes the full width. App-wide by construction: the
   rail's own markup is re-laid-out, so no page learns about phone
   width and /freelance, /freelance/queue and /settings inherit it
   without being edited. /login renders no rail and cannot match.

   THE NUMBER IS DERIVED. R40 measured the form floor at 213px of tile.
   With the rail at 170 and .app-content's 28px each side the content
   column is `viewport - 226`, so `viewport - 226 >= 213` gives 439 as
   the last width at which the rail can still leave room for a form to
   open. Below it the page's one journey is impossible; at or above it
   it is not. A 390px phone takes the strip and gets 334px; a 768px
   tablet keeps the rail, takes the one-column stack (its 542px grid is
   under the 706px threshold) and both forms open.

   WHY @media AND NOT A CONTAINER QUERY, when every threshold on the
   Personal page is one: the shell is not inside a container and the
   only element that could serve as one is .app-body — which R30
   forbids, because containment silently kills .pe-sticky, the sticky
   edit-mode pill row. base.css carries the only other @media in the
   app (reduced motion). This is the second and last.

   PROVISIONAL (S20). The phone design round replaces this and owes it
   nothing. Two costs were stated in the question and accepted: the
   coloured agent badges are hidden here, because six badges have
   nowhere to sit in 44px; and the wordmark goes with them, as the
   mockup's own strip draws it (specimen 08) — at 390px the brand tile,
   three nav items and Log out already fill the bar.

   THE MOCKUP CANNOT VERIFY THIS RULE. Its constraints forbid @media so
   that it stays one honest artifact, so specimen 08 draws the two
   shells side by side with no switch between them. This query is the
   one number in the design that is first seen working in the browser
   (R87's own cost) — Task 6 step 3 is where that happens. */
@media (max-width: 438.98px) {
  /* one column, two rows: the strip, then everything else */
  .app-body { grid-template-columns: minmax(0, 1fr) }

  .app-side {
    flex-direction: row; align-items: center; gap: 10px;
    height: 44px; padding: 0 12px;
    border-right: 0; border-bottom: 1px solid var(--line-soft);
  }
  .app-side .app-brand { padding: 0 }
  /* the wordmark goes with the badges — the mockup's strip draws the
     brand tile alone (specimen 08) */
  .app-side .app-brand .wm { display: none }
  .app-side .app-nav { flex-direction: row; gap: 2px }
  .app-side .navitem { padding: 4px 7px; font-size: 11.5px }
  /* nowhere for six badges in 44px (R50, S20) */
  .app-side .rail-agents { display: none }
  /* margin-top:auto is a column trick; in a row it does nothing and
     margin-left:auto is what pushes Log out to the end */
  .app-side .rail-foot { margin-top: 0; margin-left: auto }
}
```

**`438.98px`, not `439px` or `438px`.** `max-width: 439px` would put 439 itself in the strip, which contradicts R87's "at 439 and above the rail stays"; `438px` would leave 438.5 in neither branch on a fractional-DPR display. `438.98px` is the standard exclusive upper bound and is the shape every such query in this codebase should take from here on.

- [ ] **Step 3: Check — by build, then by browser, because the mockup cannot help**

Run: `npx tsc --noEmit` · `npm run lint` · `npm run build`.

```bash
# exactly one @media in components.css, and one in base.css, and none anywhere else
grep -c '@media' src/styles/components.css   # 1
grep -c '@media' src/styles/base.css         # 1
grep -c '@media' src/styles/personal.css     # 0
grep -c '@media' src/styles/tokens.css       # 0
grep -c '@media' src/styles/legacy.css       # 0 (if not 0, report it; do not edit legacy.css)
```

Then `npx next start -p 3001` and, in Chrome DevTools' device toolbar — **responsive mode with an explicitly typed width, not a device preset**, because a preset's DPR can make the CSS pixel count something other than what you typed:

1. **440 → the rail.** At 440px the 170px rail is beside the page. Note the content column's width in DevTools (should be ~214px) and confirm `/personal`'s placeholder header renders.
2. **439 → the rail.** R87's boundary is inclusive at the top. The rail is still there. **This is the assertion the number exists for; if 439 shows the strip, the query is `max-width:439px` and is wrong.**
3. **438 → the strip.** 44px bar, brand tile, three nav items, `Log out` at the right end, no badges, no wordmark, and the page taking the full width. Nothing clipped, nothing overlapping, nothing horizontally scrolling.
4. **390 → the strip, and the content column is 334px.** Measure it: select `.fl` in the Elements panel and read the computed width. **334 is the number the whole ruling rests on** — it is what makes 213px of form floor reachable, which is what makes R87's arithmetic true.
5. **All four `(app)` routes at 390 and at 440.** `/personal`, `/freelance`, `/freelance/queue`, `/settings`. Report anything clipped or unreachable. The Freelance page is **not** phone-designed and is not expected to look good; it is expected to be **usable and uncut**.
6. **`/login` at 390.** Unchanged from before this task. No strip, no rail, no shift.
7. **The console, on every page at both widths.** Clean: no CSP violation, no hydration warning, no layout-shift error.
8. **Scroll `/freelance` at 390 to the bottom.** `.app-body`'s `min-height:100dvh` now applies to a one-column grid; confirm the strip does not sticky, float or reappear, and the page's ground reaches the bottom.

- [ ] **Step 4: Commit**

```bash
git add src/styles/components.css "src/app/(app)/_shell/Rail.tsx"
git commit -F - <<'EOF'
feat(p10a): the phone strip, app-wide, below 439px (S20, R87)

Below 439px of viewport the 170px rail becomes a 44px top bar and the
page takes the full width. The rail's own markup is re-laid-out, so no
page learns about phone width: /freelance, /freelance/queue and
/settings inherit this, and /login renders no rail and cannot match.

THE NUMBER IS DERIVED, not chosen. R40's form floor is 213px of tile;
with the rail at 170 and .app-content's 28px each side the column is
`viewport - 226`, so 439 is the last width at which the rail can still
leave room for a form to open. 390 -> 334px, both forms open; 768 keeps
the rail and takes the one-column stack. Written 438.98px: `439px`
would put 439 in the strip, which contradicts the ruling.

@media and not a container query on purpose. The only ancestor that
could be the container is .app-body, and R30 forbids container-type on
any ancestor of the header because containment silently kills the sticky
edit-mode pill row. base.css has the app's other @media (reduced
motion); this is the second and last.

Two accepted costs, both stated in the question Riku answered: the
coloured agent badges are hidden (nowhere for six in 44px) and the
wordmark goes with them, as the mockup's own strip draws it. AgentsBlock
still reads and still renders - into a hidden box - so its failure mode
does not change in a shell that is explicitly provisional.

Rail.tsx gains one attribute: className="rail-agents" on the wrapper,
so the query hides a named thing rather than `div:has(.grouplabel)`.

THE MOCKUP CANNOT DRAW THIS RULE - its constraints forbid @media - so
it is the one number in this design first seen working in a browser.
Checked at 440 / 439 / 438 / 390 on all four (app) routes and /login.

Claude-Session: <session-url>
EOF
```

---

## Task 6: Verification

Run every check in order. **Do not claim completion until each one has produced the expected output in front of you.** Step 4 is a list to report, not a check to pass.

**Files:** none modified.

- [ ] **Step 1: The standing trio and the lint baseline**

Run: `npm test` → every suite passes. **The count is 531 plus this plan's ramp tests** — report the exact number; Plan B's verification quotes it as its own baseline.
Run: `npx tsc --noEmit` → no output, exit 0.
Run: `npm run lint` → **the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and nothing new.** Exit 1 is the pre-existing state. The four live in `login/page.tsx:23`, `settings/page.tsx:35`, `freelance/queue/page.tsx:69` and `freelance/queue/PushControls.tsx:24`; this plan adds no client component and must not have moved any of them.
Run: `npm run build` → `✓ Compiled successfully`, with `/personal` in the route table.

- [ ] **Step 2: The rules this plan promised to keep**

```bash
# no dependency, no CSP change, no proxy edit, no login edit
git diff --stat <HEAD-at-plan-start>..HEAD -- package.json package-lock.json next.config.ts src/proxy.ts src/app/login/page.tsx
# no output

# base.css and legacy.css are untouched
git diff --stat <HEAD-at-plan-start>..HEAD -- src/styles/base.css src/styles/legacy.css
# no output

# the mockup and components.html are untouched
git diff --stat <HEAD-at-plan-start>..HEAD -- docs/design/p10-mockup.html docs/design/components.html
# no output

# this plan adds no client component and no API route
git diff --name-only <HEAD-at-plan-start>..HEAD -- src/app/api/
# no output
git grep -n '"use client"' -- "src/app/(app)/personal"
# no output, exit 1

# no stray token aliases (5.1) and no deleted constant (R80)
git grep -n 'var(--alert)\|var(--amber)' -- src/ ':!src/styles/tokens.css'
git grep -n 'PERSONAL_HERO_BUSY_AT'
# both: no output, exit 1

# the repo boundary
git -C ../ShikksTracker status --porcelain
# no output
```

Record the plan-start HEAD in the post-build section so Plans B and C can diff against it.

- [ ] **Step 3: R87's threshold, in the browser — the one number the mockup cannot verify**

Re-run Task 5 step 3's eight browser checks **as the plan's verification**, not as the task's, and write the findings down. This is the plan's own bar: the four `(app)` routes plus `/login`, at **440 / 439 / 438 / 390**, with the 334px column measured in DevTools and the console clean at every stop. The mockup's constraints forbid `@media` so it stays one honest artifact (R87's stated cost), which means **the build is where this rule is first seen working**, and a plan that shipped it without looking would be shipping an unverified number.

- [ ] **Step 4: The vocabulary, against the mockup and the stylesheet — since no page renders it yet**

Open `docs/design/p10-mockup.html` in one Chrome tab and `src/styles/personal.css` / `components.css` beside it. **This is not "by eye against the app": there is no app render to compare.** It is the same method P8c used for the one block it could not produce locally — read the shipped rules against the specimen that draws them, and report.

1. **The nine tints** — `.ramp` chip strip, all nine in order, green→amber→orange→red, and the contrast readings from Task 3 step 7. Confirm the strip reads as a ramp: segment A's three steps visible and uniform at ≈.031 OKLab ΔE each, segment B's five at or below the just-noticeable threshold, so 3→8 reads continuous. **Steppiness, where any is seen, is in segment A and is there by construction** — it is the 1.8× asymmetry Riku asked for.
2. **The composition that had to be drawn rather than described** — red `--missing` ink on the red wash, at `.pe-t8`, span 8, with a genuine overdue row (specimen 01). R84's register rule is the only thing containing this: **hue in a background wash means volume; hue in ink, on a dot, or on a row means what R9 says.**
3. **The shared controls** — `.tick` at 14px with a 40×40 hit box, `.swx` at 26×15, `.sq` at 24×24, `.fld` at 16px with `line-height:1.4`, `.sel`'s chevron identical in geometry to `.sumrow::after`'s (the page has **one** chevron shape), `.formwell`, `.pickrow` at `min-height:40px`.
4. **The six `@container tile` bands** — 134 · 200 · 240 · 406 · 480 · 720 — each against the cells §5.4's tables say it catches. **452.5 is span 6, not span 7** (R93).
5. **The two `@container pgw` thresholds** — 706 and 820 — and that `--tracks` is read only inside them.
6. **`.pe-cell.is-gap`** — the only rule in `personal.css` that hides a cell, and the two `:not(.pe-x0)` / `:not(.pe-s0)` re-shows.
7. **M6's margin rule** present and after `.pe-edit`.
8. **`.pe-more` absent as a rule and present as R89's comment.**

- [ ] **Step 5: What this plan deliberately did NOT ship**

So a reviewer can tell a gap from a deferral. **Not in Plan A:**

- Any model, any schema field, any index — Plan B.
- Any API route, any `fetch`, any Google call, any OAuth script — Plan B.
- `days.ts`, `todos.ts`, `personalLayout.ts`, and every view model in `personalView.ts` but `heroTint` — Plan B.
- The push's Today sentence, *LastDigest*, the 320 bound, `APP_TZ` — Plan B.
- Every tile, every island, the edit mode, the forms, the two Settings cards — Plan C.
- `ARCHITECTURE.md`'s §3.1 / §4.2 / §5 updates — Plan C's documentation task. **S19 and S20 are already recorded in §7 and are not rewritten by any plan.**
- **R95's four mockup fixes.** They belong to the design team. If this plan's port found a discrepancy, it is in step 6's report, not in the mockup.

- [ ] **Step 6: The post-build record**

Append to this file: the plan-start HEAD, the test count, the nine contrast readings, the eight R87 browser findings including the measured 334px, and **anything the port found that the mockup and the spec disagree about.** One is already known and is **not** this plan's to fix: R88 rules `3 days late` everywhere and R95.2 asks the mockup's three `3d late` panes to be corrected *after confirming the string fits at 106px*. `personal.css` carries no string, so nothing in this plan renders either form — **Plan C owns that confirmation**, and this plan's record simply notes that the CSS puts the due meta on its own line in the narrow band, where 80px of inner width has room for eleven characters of 9.5px mono.

---

## Self-review

Before handing this plan to Plan B, confirm each of the following is true of the repo, not of the plan:

- [x] Five stylesheets, imported in the fixed order, `personal.css` fourth.
- [x] `personal.css` contains no `@media`, no `@supports`, no `container-type`, exactly two `container:` declarations, and no bare element-shaped selector. *(True of the rules with comments stripped; a raw grep hits ported comments.)*
- [x] `components.css` contains exactly one `@media`, and its header names the shared-control block. *(One `@media` rule, at line 179; four more mentions are in its comments.)*
- [x] `tokens.css` carries three tint tokens, R84's exact semantic-hues comment, and three `also P10 R84` pointers — and no `--alert`, no `--amber`, no fourth new token.
- [x] `DESIGN-INSPO.md` carries R84's footnote under an unrewritten table. `components.html` is byte-unchanged.
- [ ] `heroTint` is one function returning `0..8 | null`, `PERSONAL_HERO_ANCHORS` is frozen, `PERSONAL_HERO_BUSY_AT` does not exist anywhere in the repo. **Left unticked (verification 2026-09-26):** the first two clauses are true and no code identifier exists, but the name survives in two "is deleted" comments in `src/` (`personalView.ts:19`, `heroTint.test.ts:7`) and in docs, so the clause as written is not literally true — see the post-build record.
- [x] Three nav items, three glyphs, both matching rules unchanged, `/personal` resolving.
- [x] The strip switches at 439/438 and gives 334px at 390, on all four `(app)` routes, with `/login` untouched.
- [x] `npm test` · `npx tsc --noEmit` · `npm run build` green; `npm run lint` at four errors and three warnings.
- [x] `git -C ../ShikksTracker status --porcelain` is empty.

---

## Post-build record (executed 2026-09-26)

The verification lead ran these checks against the repo, not against earlier reports. Every figure below was produced in this session.

**HEADs.** Plan start `8fd11d5` (`8fd11d544de95e2f0155d523e52e5f011831dc14`). Build end `11f0c1e` (`11f0c1ee30b6287232d3ca51f30cd6d7268fa508`). This record is the one commit after it. Plans B and C diff against `8fd11d5`.

**Commits.**

- `6c3e74b` Task 1: the fifth stylesheet, namespace `pe-`, imported fourth.
- `5c803ef` Task 1: narrow-band `.formwell` qualified by `.pe-cell`; five stylesheets.
- `10d2ac1` Task 2: ten shared controls in components.css, header amended.
- `1b80429` Task 2: header names only real reference names; three legacy.css leaks pinned.
- `31165c8` Task 3: the nine-step ramp (tokens, comments, the `heroTint` lookup).
- `dee91de` Task 3: the ramp's OKLab figures stated as measured.
- `e1c1752` Task 3: personal.css comments made true after the ramp landed.
- `f22b02e` Task 4: Personal first in the rail, with its glyph.
- `98287b5` Task 5: the phone strip, app-wide, below 439px (S20, R87).
- `11f0c1e` Task 5: the strip's 320px floor stated.

**Files changed** `8fd11d5..11f0c1e`: DESIGN-INSPO.md, NavList.tsx, Rail.tsx, `(app)/personal/page.tsx`, `app/layout.tsx`, `components/icons.tsx`, `heroTint.test.ts`, `personalView.ts`, components.css, personal.css, tokens.css. Step 5 is confirmed. There is no model, API route, Google code, `days.ts` / `todos.ts` / `personalLayout.ts`, or ARCHITECTURE.md edit.

**Tests.** `npm test` passes 30 files, **539 tests**. This is Plan B's baseline.

**Types and build.** `npx tsc --noEmit` exits 0 with no output. `npm run build` prints `✓ Compiled successfully`, with `ƒ /personal` in the route table.

**Lint.** `npm run lint` exits 1 at the baseline: 4 errors and 3 warnings. The four errors are `react-hooks/set-state-in-effect` at `login/page.tsx:23:9`, `settings/page.tsx:35:10`, `freelance/queue/page.tsx:69:10` and `freelance/queue/PushControls.tsx:24:7`. None moved. The three warnings are at `models.test.ts:42`, `queue.test.ts:258` and `db.ts:20`.

**Invariant greps (step 2).**

- No output from the deps/CSP/proxy/login diff, the base.css/legacy.css diff, the mockup/components.html diff, or the `src/app/api/` name list.
- `"use client"` under `personal/` exits 1, and so does `var(--alert)|var(--amber)`.
- `PERSONAL_HERO_BUSY_AT` exits 0. Its hits are two `src/` comments that say it is deleted (`personalView.ts:19`, `heroTint.test.ts:7`), plus design docs and plans. There is **no code identifier**.
- `git -C ../ShikksTracker status --porcelain` printed nothing.

**The nine contrast bands.** These are WCAG 2.x ratios, recomputed from `tokens.css` and the `.pe-tN` stops by an independent script. All 30 readings were computed (three inks against `--raised` and against the nine deep stops), plus the readings on the 62% stops. They agree with the builder's table.

| ink | on `--raised` | on the deep stops (t0 low, t3 high) | on the 62% stops |
|---|---|---|---|
| `--ink` `#E9ECF0` | 15.158 | 13.58 – 14.74 | 15.64 – 15.92 |
| `--ink-3` `#5B6470` | 2.995 | 2.68 – 2.91 | 3.09 – 3.15 |
| `--missing` `#F87171` | 6.494 | 5.82 – 6.32 | 6.70 – 6.82 |

- **Per stop.** `--ink` on the deep stops, t0 to t8: 13.58 13.96 14.41 14.74 14.67 14.60 14.49 14.48 14.38.
- **Band ends.** Lower ends are the t0 deep stop; upper ends come from the 62% stops.
- **Baselines.** The figures 15.1 and 2.99 are truncations of 15.158 and 2.995.
- **`--ink-3` below 3:1.** It is under 3:1 on every deep stop and on `--raised` itself. That is the tertiary ink's existing level, not something the ramp made worse.

**OKLab distances between the deep stops.**

- Segment A steps are .0312, .0307 and .0310, so they are even at about .031 each.
- Segment B steps are .0071, .0103, .0072, .0105 and .0086.
- 0→3 is .0774 and 3→8 is .0422, a ratio of 1.83. The straight line from 0 to 8 is .1110.

**Luminance.** `#241A03` .01120, `#3A0B0B` .01163, `#052620` .01523, `#440D0D` .01546, `#191016` .00635.

**R87 in the browser (step 3).** Setup: a production build served by `next start -p 3001`, headless Chrome at a viewport height of 800, and a session cookie minted in-process. The server was stopped by its PID afterwards.

- **Rail or strip.** Every one of the four `(app)` routes gave the same result at every width.
  - At 440 and 439 the rail shows. `.app-side` is 170px and laid out as a column, with the agents block and the wordmark visible.
  - At 438, 390 and 360 the strip shows. `.app-side` is full width by 44px, laid out as a row. `.rail-agents` and the wordmark are `display:none`.
  - At 768 the rail shows.
- **Content column** (the inner width of `main`), identical on `/personal`, `/freelance`, `/freelance/queue` and `/settings`:

  | width | 440 | 439 | 438 | 390 | 360 | 768 |
  |---|---|---|---|---|---|---|
  | column | 214 | **213** | 382 | **334** | 304 | 542 |

- **No horizontal scroll** at any width on any route (`scrollWidth == clientWidth`). That includes `/login` at 390 and 440.
- **Active nav item** is correct at every stop: Personal on `/personal`, Freelance on both Freelance views, Settings on `/settings`.
- **Nav item height.** 30.75px in the rail, 25.25px in the strip.
- **`/login`.**
  - It has no shell at 390 or at 440.
  - Its column is 334 at 390.
  - Its file has not changed since `8fd11d5`.
- **Console.** There are no exceptions and no app console errors. The only entries are network 500s from Mongo-backed endpoints, at every width: `/api/queue?status=pending` on `/freelance/queue`, and `/api/settings` on `/settings`.
- **Mongo is still unreachable from this machine.**
  - The server log has 43 `querySrv EREFUSED` lines.
  - The Mongo-backed blocks drew their failure states: `Couldn't load what's waiting.`, `Could not load the queue.` and `Could not load settings.`
  - The Freelance tiles and pipeline, which come from the ShikksTracker API, loaded real data.
  - **Clipping and overflow were checked against that content**, not against fully populated Mongo blocks.
- **Pre-existing, not P10a.** Three spans on `/freelance` reach `right=502` at 440 and 439. They are clipped and the page does not scroll. They do not appear at 438 or below.

**The vocabulary against the mockup (step 4).** Headless Chrome opened `file:///…/docs/design/p10-mockup.html` and read the computed styles. The shipped sheets were then read against it.

- **`.ramp` chips, t0 to t8.** Each computed `background-image` is `linear-gradient(155deg, <deep>, <near> 62%)`.
  - Deep stops: #052620 #16220E #231B03 #2A1408 #2D1307 #311107 #341007 #370D09 #3A0B0B.
  - Near stops: #0F1417 #111316 #131114 #141013 #151014 #161014 #171015 #181015 #191016.
  - All eighteen equal the shipped `.pe-tile.is-hero.pe-tN` rules.
- **`.tick`.** The drawn box is 14×14. **The `::after` hit area measures 38×38, not 40×40.** See "Found by this verification" below.
- **`.swx`** is 26×15.
- **`.sq`** is 24×24, with `letter-spacing:normal`.
- **`.fld`** is an INPUT, 16px font size, 22.4px line height (1.4).
- **`.pickrow`** has `min-height:40px`, and its box is 40px tall.
- **The two chevrons.** `.sel::after` and `.sumrow::after` have the same shape: 6×6, 1px borders on the right and bottom, and the same `rotate(-45deg)` matrix. Only their placement differs, by design. `.sel`'s is absolutely positioned 12px from the right, and `.sumrow`'s sits in the flow.
- **Container queries.** The shipped `personal.css` has the same nine queries as the mockup:
  - `@container tile` at 133.98, 199.98, 239.98 and 479.98 (max) and at 406, 480 and 720 (min). These are the six bands 134, 200, 240, 406, 480 and 720.
  - `@container pgw` at 706 and at 820.
  - `--tracks` is read only inside the 706 block. Its only other mention is a comment.
- **`.pe-cell.is-gap{display:none}`** (line 69) is the only rule that hides a cell. The `:not(.pe-x0)` and `:not(.pe-s0)` re-shows sit inside the pgw blocks.
- **M6.** `.fl>.pe-edit` (line 111) comes after `.pe-edit` (line 103).
- **`.pe-more`** appears only in comments (lines 16 and 310).
- **Rules with comments stripped.**
  - personal.css has no `@media`, no `@supports` and no `container-type`.
  - It has exactly two `container:` declarations.
  - None of its 152 rules has a selector that starts with an element.
  - components.css has exactly one `@media` rule.

**Deviations and carry-forwards (lead rulings during execution).**

- **Mockup line numbers moved after the plan.** The `personal` group ends at 1277, its banner is at 1278, and the `:root` tint block is at 842–846. The port went by banner.
- **Plan difference 3 (reduced motion) had nothing to remove.** The mockup's personal group never held that rule. The chevron transition lives in components.css.
- **Two of Task 1's greps hit comments.** `@media` and `container-type` match ported comments, not rules. tokens.css also has one `@media` in a comment. Future checks should strip comments first.
- **Lead ruling: `.formwell` namespaced.** The mockup's bare `.formwell{padding:var(--sp-3)}` inside `@container tile` shipped as `.pe-cell .formwell`, for R32's namespace rule.
- **Lead ruling: the components.css header.** It calls only the names that exist in components.html "verbatim reference names": `.stat` through `.statuspill`, and `.swx`. The other P10 controls are "reference-style".
- **legacy.css leaks.** legacy.css loads across the whole app, but in the mockup it applies only inside `:where(.legacy-doc)`. Three leaks are pinned in components.css:
  - `.tick:hover` border set to `--line`
  - `.swx:not(.on):hover` border set to `--line`
  - `.sq{letter-spacing:normal}`
- **Not pinned (lead ruling): autofill.**
  - legacy.css's `input:-webkit-autofill` reaches `input.fld`, and the mockup draws no autofill state.
  - This carries forward to legacy.css's deletion. After that, autofilled `.fld` inputs will get Chrome's autofill background unless the rule is ported deliberately.
- **Test count is 539, not the plan's projected 546.** The ramp adds 8 `it()` blocks, and all eight listed cases are covered by grouping.
- **Lead ruling: `heroTint`'s docblock.** It said `Infinity` returns 8, but the code returns null. The comment was corrected to match the code (`1e9 → 8`, `Infinity → null`).
- **The OKLab figures.**
  - .0774 (0→3) and .0422 (3→8) are per-leg distances between deep stops, and they sum to .1196. The straight line from 0 to 8 is .1110.
  - So the plan's, spec's and mockup's wording ".1110 split .0774/.0422" is arithmetically wrong. It was corrected in personalView.ts and personal.css.
  - **For the design team, not the build:** the mockup still carries the old wording in its personal-group comments, and its R81 comment still says tokens.css lacks the anchors.
- **Luminance wording.** `#241A03` is .01120 (the spec said .01121). `#440D0D` is .01546 against green's .01523, which is close but not "exactly".
- **`PERSONAL_HERO_BUSY_AT` in comments.** It survives only in "is deleted" comments. The plan's "exists nowhere" claim hits those comments, and so will two checks in Plan C: its grep at about line 743, and its self-review line at about 839 ("do not exist anywhere in `src/`"). Plan C's check should look for code identifiers only.
- **Plan B carry-forward.**
  - heroTint's "events never counted" and "one overdue counts as one" tests cannot test those claims, because heroTint never sees events or overdue flags.
  - Plan B must pin them in a view-model test. It should build `pending` from a fixture that has scheduled events and an overdue to-do, and assert the resulting tint.
- **Plan C carry-forward.** R96's narrow-band `3d late` form has no CSS, so the component must pick the string when the tile is below 240px. Plan C also owns step 6's R88 / R95.2 check that the string fits, since personal.css carries no string.
- **Task 4: the `/personal` placeholder header.**
  - It keeps `.fl-headrow` (Plan C's shape), though Freelance's header has none.
  - It renders the same. The h1 is 12px narrower because of the empty column gap, which only shows if the title wraps.
- **Task 5: additions beyond the plan, accepted by the lead.**
  - `.app-body{grid-template-rows:auto 1fr}` in the strip. It fixed a gap under the strip on short pages.
  - `.app-side .navitem svg{display:none}`. The mockup's strip is text-only, and the glyphs made Log out wrap at 390.
- **Task 5: the strip's lower limit.**
  - The strip is verified from 360 up.
  - At 320, Log out wraps out of the bar, and strip nav items are about 25px tall (measured at 25.25).
  - The lead ruled both out of scope. They are owed to the phone design round (S20) and noted in the CSS comment.
- **Pre-existing, not P10a.** Three spans on `/freelance` overflow to right=502 at 440 and 439. They are clipped and the page does not scroll. Worth a later look.
- **Slips in the plan text.** "The four `tile` thresholds are … six" gives the wrong count, and there is a slip in the `.fl-headrow` snippet.
- **Lead ruling after this record: `.tick::after` shipped at `inset:-14px`, which realises R41 rather than changing it.**
  - The insets are measured from `.tick`'s 12px padding box, inside its 1px border, so the shipped box is 12 + 2×14 = 40, reaching 13px past the 14px border box. The components.css comment now gives that arithmetic.
  - Measured in headless Chrome, in a file:// harness linking tokens.css, base.css and components.css, and again with personal.css and legacy.css added. Both gave the same result.
    - The computed `::after` is 40px × 40px.
    - The tick's border box is at x 100–114, and the hit box spans 87–127 by 92–132. The sibling button at the row's 14px gap starts at 128, which leaves **1px clear**. Hit-tests agree.
  - **N8 holds.** Two stacked `.pickrow`s each measure 40px tall (`min-height:40px`). Their tick hit boxes span 184–224 and 224.5–264.5, so they are 0.5px apart and do not overlap. The 0.5px comes from the second row's 1px `border-top`. Hit-testing switches from the first tick to the second between y 223.5 and 224.5.
  - **For the design team:** the mockup still says `inset:-13px`, which measures 38×38, and so does R41's own arithmetic line.

**Found by this verification.**

- **The tick's hit area is 38×38, not 40×40.**
  - `.tick::after{position:absolute;inset:-13px}` computes to 38×38 in the mockup, and the shipped rule is byte-identical.
  - An absolutely positioned box's insets are measured from its containing block's *padding* box. `.tick`'s 1px border leaves 12px, and 12 + 2×13 = 38.
  - Two statements are off by the border: the spec's R41 line ("`inset:-13px` on all four sides → 40×40") and the components.css comment. The target also stops **2px** short of the edit button, not 1px.
  - `inset:-14px` would give 40×40 and stop 1px short.
  - This is a spec and mockup arithmetic slip for the design team and Plan C. The port is faithful, and nothing was changed here.
- **Self-review.**
  - The `PERSONAL_HERO_BUSY_AT` line is left unticked, because its last clause is not literally true (see above).
  - The other lines were verified and ticked.
  - The personal.css and components.css lines are true of the rules, not of the raw text.
