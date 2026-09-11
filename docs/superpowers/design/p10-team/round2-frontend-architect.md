# P10 round 2 — Frontend Architect

**Date:** 2026-09-11 · **Role:** how the Personal page lands in this codebase · **Round:** 2, after the other four papers and the lead's thirteen questions.
**Re-checked at HEAD `19fa4b1`:** `proxy.ts`, `session.ts`, `auth.ts`, `api/auth/login/route.ts:126–136`, `api/cron/morning/route.ts:155–185`, `runJob.ts`, `AgentRun.ts`, `src/styles/*.css`, `eslint.config.mjs`. `npx eslint` still ends **`✖ 7 problems (4 errors, 3 warnings)`**. In `src/`: no `container`, `sticky` or `inert`; `@media` is one line (`base.css:35`). React is `19.2.4`.

---

## Where I now agree

**The Grid Architect is right about the collapse and I was wrong.** `Σ ceil(sᵢ/2) = (Σsᵢ + #odd)/2`, so any full row with an odd span lands on 7 or 8 columns at six — `3+9`, `5+7`, `3+3+3+3` all pass `validateLayout` as ratified. A per-tile function cannot see the row, so it cannot be correct at any rounding. `collapseRow(spans)` replaces `collapseSpan`, and my `Math.max(2, …)` floor goes with it: his greedy trim reaches 1 only for a span-2 tile, the case his narrow band exists for.

**Container queries cost nothing here.** ESLint has no CSS rules (`eslint.config.mjs` is just `next/core-web-vitals` + `next/typescript`), so no CSS moves the baseline, and a container query ships no JavaScript. His two-level shape — a *named* `pgw` container on the wrapper, a second on `.tile` — beats my single `.pe`: an element cannot query itself, and the name stops `@container tile (…)` resolving against the grid. I take his thresholds (grid ≥ 706 / ≥ 820) over my 640/380.

**The System Keeper's CSS placement is my §4 with a better reason:** the Settings layer picker ships **in this same phase** and needs `.fld` and the tick box off `/personal`.

**`inert` is right and cheap.** React 19.2.4 supports it as a real boolean DOM attribute. No effect, no island, no lint cost — and it dissolves my §6 hazard: with the tile inert, no tick or form can fire `router.refresh()` under an editor holding unsaved changes.

**The Honesty Critic and I found the same `LastDigest` hole from opposite ends,** and he is right that the write must sit after the `delivery.sent === 0` guard (`route.ts:178`). Revision 7 adds the half neither of us wrote.

---

## Where I still disagree

**Grid Architect — placement cannot live on the tile.** He writes `<section class="tile" style="--r:1;--c:1;--n:8;…">`. The tile is a **server component handed to `LayoutEditor` as an opaque `ReactNode`**: a client island cannot change an attribute on a node it does not own, and prop-drilling `editing` is not available either — the editor cannot re-render server children at all. Placement must sit on **a wrapper the editor owns**, one per cell, tile as its only child — the only shape compatible with "the editor never touches tile contents". The tile still declares `container-type` and resolves its own bands from the track width.

**Grid Architect — inline custom properties are an unguarded path from Mongo to CSS.** My frozen `SPAN_CLASS` made a stored `span:99` match no rule, and so be *visible*. `style={{"--n":99}}` renders `grid-column: 1 / span 99` — valid CSS, 99 implicit columns, a wrong grid rendered confidently. "Malformed values fall back to `auto`" holds for garbage, not for an out-of-range number. Condition: every emitted number passes through one clamping, unit-tested `buildCells`.

**Interaction Designer — drop rule 5 ("a form never grows its row").** That rule *creates* his §6.4 problem: a form in a 42px scroll window, and a per-tile stepper floor that takes two arrangements away from Riku. Deck §2.6 protects the *grid*, and the weights are minimums. **A form may grow its row; it may never change any tile's width.** The span floor is then unnecessary.

**Interaction Designer — `<Suspense>` is right but not a one-liner:** it must wrap the tile on the *server*, and its fallback is then a tile-shaped box on geometry the editor's wrapper owns.

**System Keeper — nothing structural; I concede the namespace.** His §8 finding goes into the spec verbatim: `legacy.css`'s bare `input` rule already styles every `<input>` P10 renders, while `<select>` is uncovered.

**Honesty Critic — one line.** "Spend one `AgentRun` read" is an indexed `findOne` through an exported function inside a `Promise.all` already running. No round trip of its own — spend it.

---

## What I concede

1. `collapseSpan` was wrong — withdrawn, with my span-2 floor.
2. Classes lose to inline custom properties; my objection survives as the clamping condition.
3. The namespace is the Keeper's — `pg-`, `tl-`, `.tile`; `pe-` dropped, and `components.css`'s "two namespaces and no third" is amended in the same commit.
4. **The callback route is not a fail-closed violation.** My §13 implied a boundary edit of the kind P8 forbade. `/api/cron/*` is already allowlisted-and-guarded-by-its-own-credential — the pattern `isPublicPath`'s docblock names — and CLAUDE.md's rule is *"fail-closed middleware with an explicit public allowlist"*. I prefer the script on cost, not principle.
5. My `.env.example` nit was already answered by its line 38.
6. `inert` beats "disable the controls".

---

## Revisions to my round-1 paper

1. **§3, §16** — `collapseSpan(span, cols)` → `collapseRow(spans: number[]): number[]`, pure, tested over every legal row.
2. **§2** — `ROW_CLASS` / `SPAN_CLASS` deleted; placement comes from one clamping `buildCells(layout)`, the track list from `buildTracks(layout, editing)`.
3. **§2, §5, §6** — the grid item is **`.pg-cell`, owned by the editor**: `key={tile}`, placement style, toolbar, `inert`; `.pg-cell > .tile{flex:1}` fills the weighted cell.
4. **§5, §6** — the inert wrapper `.pg-tilewrap` is **always rendered, never conditional**; only the attribute toggles, so no arrow press remounts anything.
5. **§3** — `.pe` and `max-width` queries → `container: pgw / inline-size` at `min-width: 706px` / `820px`, plus `container: tile / inline-size`.
6. **§4** — namespace `pe-` → `pg-` and `tl-`; the file is still `src/styles/personal.css`.
7. **§14 — this round's finding: the `LastDigest` write sits after the `delivery.sent === 0` guard *and* must not throw.** A throw files `ok:false` for a dispatcher that delivered, corrupting the signal the Honesty Critic's table depends on. Wrap it, `console.error`, return `counts:{…, itemsFailed: 1}` — the field already exists on `AgentRun.counts` — and the fourth case becomes decidable the same morning.
8. **§13** — the bootstrap routes are acceptable, not forbidden; conditions in Q7.
9. **§12** — `CalendarWindow` gains a non-error member `{ok:false, reason:"none-enabled"}` returned **before** any token fetch; the field is renamed `reason`.
10. **§16 Plan A** — `personalLayout.ts` gains `clampSpan`, `collapseRow`, `compactRows`, `buildCells`, `buildTracks`; drops `collapseSpan`, `ROW_CLASS`, `SPAN_CLASS`. **Its docblock says it is imported by a client component and may never import a model, `server-only` or `next/headers`.**
11. **§16 Plan A** — `scripts/google-auth.mts` is conditional on Q7; if the routes win, Plan A ships two route files, one line in `isPublicPath`, one `proxy.test.ts` case.
12. **§16 Plan B** — `personalView.ts` carries explicit kinds, not nullable data: `DayRowView = {key,label,items} | {key,label,unread:true}`, every header count `number | null`.
13. **§16 Plan C** — `personal.css` becomes `.pgw`, `.pg`, `.pg-cell`, `.pg-tilewrap`, `.pg-gap`, `.tile`, `.tl-*` plus five container queries; `components.css` takes the Keeper's six shared recipes.
14. **§16 Plan C** — the header row gains `position:sticky;top:0` **in edit mode only** (a `--void` ground, a z-index), plus a rule that **no ancestor of the header takes `container-type`**: nothing in the shell sets `overflow`, so sticky works today, but a later tidy moving containment onto `.app-content` would break the mode silently.
15. **§16 "files no plan touches"** — now four: `src/proxy.ts` (unless Q7 takes the routes), `login/page.tsx`, `next.config.ts`, **and `tokens.css`** (unless Q4 takes `--tint-session`).

---

## Positions on the round-2 questions

| Q | Position | Confidence |
|---|---|---|
| **Q1** | **Not mine to scope.** Defer: ship the 1-column step as CSS, do not claim it renders. Keyed to the *grid's* width it becomes correct the day the rail collapses, at no P10 rework. | medium |
| **Q2** | **`collapseRow(spans)` on the server, pure** — my per-tile version was arithmetically wrong. Do **not** tighten `validateLayout`: refusing `3+9` for a six-column reason is invisible at the width Riku edits at. The editor imports it too, to disable `+`. | high |
| **Q3** | **Adopt at both levels** — a named container on the wrapper, a second on each tile, in-tile layouts keying off the tile's own width. No lint cost, no RSC cost, and the only unit that survives the phone pass. | high |
| **Q4** | **Not mine aesthetically; the costs differ.** `#171B21` + inset hairline is one rule and no new token; `--tint-session` is the only proposal that edits `tokens.css`. Prefer the Keeper's, tint as the B-panel. | low |
| **Q5** | **Not mine to measure.** The weights are four numbers inside `buildTracks`, so re-measuring after specimen 01 costs one line; do not fix them before the mockup. The sparse-row `auto` rule is one branch there, recomputed by the editor too. | medium |
| **Q6** | **A fifth stylesheet `src/styles/personal.css`,** with the six shared controls promoted into `components.css` — settled by the Keeper's point that they have a second consumer *in this phase*. Namespace his. | high |
| **Q7** | **Either works; `scripts/google-auth.mts` by a nose.** `__Host-session` is `sameSite:"strict"` (`login/route.ts:132`), so Google's cross-site redirect arrives cookieless and `proxy.ts:96` 401s before the handler runs. An allowlisted callback is **acceptable** — `/api/cron/*` is the shipped precedent — given five things: an exact-equality allowlist entry, never a prefix; no `requireSession`, the one-shot ten-minute `__Host-` `sameSite=lax` `state` cookie compared constant-time instead; the gate `NODE_ENV === "development" \|\| ALLOW_OAUTH_BOOTSTRAP === "true"` (that string exactly — `"false"` is truthy) with `force-dynamic`; a bare-404 deny; a `proxy.test.ts` case. The script wins only in needing none of the five. | high |
| **Q8** | **Spend the `AgentRun` read; the tile reports the record and names the gap.** The write sits after `route.ts:178`'s zero-device guard and **must not throw** — a throw files `ok:false` for a delivered push and destroys the signal separating the cases. Wrapped, it returns `itemsFailed:1`, the fourth state. Needs one sentence Riku has not written. | high |
| **Q9** | **Agreed with the Honesty Critic, enforced in types not discipline.** A day row is a union — `{items}` or `{unread:true}` — so `—` is unreachable for an unread day, and with both feeds down the rows are omitted. | high |
| **Q10** | **A distinct state decided before any network call:** `readCalendarWindow` returns `{ok:false, reason:"none-enabled"}` when no layer is on — no token fetch, no HTTP, no timeout. Grey, naming the Layers tile; in the push its own sentence, **not** a problem (R57). | high |
| **Q11** | **Reuse `Couldn't save.`** — Riku owns it already for a failed layer switch and to-do save, so a failed tick or Save/Delete needs no new string. The headers are a *type* fix: each count is `number \| null`, so `0 open` above `Couldn't load to-dos.` is unrepresentable. | high |
| **Q12** | **Disagree with the Interaction Designer — the floor stays 2 on every tile.** His floor exists only because of his own rule that a form may never grow its row. Let it grow the row and never change a width: no arrangement is lost, and one rule is left — one column below 280px of tile width. | medium |
| **Q13** | **Not mine; agree with the System Keeper on both.** A mono meta column differing only in ink is one rule fewer than a pill and reuses `.pwhen.is-stale`; a bare cell in normal view with one dashed rectangle in edit mode is what the editor already holds the state to draw. | low |
