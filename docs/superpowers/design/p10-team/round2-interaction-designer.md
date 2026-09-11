# P10 round 2 — the Interaction Designer

**Date:** 2026-09-11 · **Role:** Interaction Designer · **Round:** 2, after reading the other four round-1 papers and the lead's thirteen questions.
**Standing question, unchanged:** can Riku do everything one-handed on the phone and by keyboard on the laptop?
**Re-checked at HEAD `19fa4b1`:** `components.css:41,216–253,447–453,488` · `components.html:469–478,483,492,519` · `tokens.css:41–44` · `layout.tsx:54` · one `@media` in `src/styles`.

---

## Where I now agree

**Frontend Architect §5 — the ROW is the island.** I cut islands by *what is pressed*; he cut them by *what owns state*, and he is right: only a client row can remove itself, one `TodoRow` serves four tiles, and props stay server-computed so no clock reaches the browser. **This replaces my page-level `Set` of hidden ids outright** (§3.1). That set existed for one case — an overdue to-do sits in Today's DUE group *and* the To-do tile, and a row-scoped island cannot see its twin. The answer is not shared client state but an idempotent write: `setDone(id, true)` guarded, `null` meaning *already done* rather than an error, so a press on the twin is harmless and his §7 refresh reconciles both. Named cost: **for one refresh the row is gone from one tile and still showing in the other.**

**Frontend Architect §6, §8 — the mechanisms my focus rules needed.** Cells keyed by tile id, the same wrapper element in both modes, the toolbar a conditional *child*: I asserted "press `→` twice must work", he supplied the way it fails. His edit-mode lockout is my mode-error rule from the other end; `inert` on the tile body is the cheaper mechanism — one attribute, out of the tab order *and* out of hit testing.

**Honesty Critic §4(a), §3.3(c) — the failed tick, against my optimistic tick.** I gave the tick a failure path — the row returns unticked with `Couldn't save.` — but wrote it as *one* bucket, and a POST that timed out is not a POST that 500s. Restoring the row on an unknown outcome asserts *it did not save* when it may have: the guess `CLAUDE.md` forbids. **New rule: a failed press restores nothing locally. It clears the local hide and calls `router.refresh()`; the server render decides whether the row comes back.** A definite failure reads `Couldn't save.`; a timeout needs a sentence the deck lacks (Q11). Same correction on the layer switch: my §4 said the knob returns on failure — on a timeout it must not.

**Honesty Critic §3.1(c) — `+ Event` where it cannot work.** Same place independently, and free: `disabled` plus `aria-describedby` at the sentence the tile already shows. Nothing new is written, and it answers Q10's lever too.

**Grid Architect §11 and System Keeper §5.6 — the form replaces the tile's body.** Mine appended below live content and scrolled. Theirs wins on a better premise: replaced, the event form is ~321px inside row 1's 340px floor, so **nothing scrolls and nothing moves at the arrangement Riku actually has**. Conceded with its consequence — below ~280px of tile width the form is one column and the row *grows*, which I had banned. A growing row is visible; a scrolling body is not.

**Grid Architect §5.4 and System Keeper §5.4 — the toolbar at the tile's foot.** My full-bleed strip had one argument: 108px of arrows against a 107.7px span-2 body. His narrow band gives 117.7px, the Keeper 109.7px. **The reason evaporates at both numbers**, and `.course .foot` is shipped where mine was an invention.

**System Keeper §5.2, §5.5, §5.6.** The 14px tick box at radius 3px (`.ev`), `--sunk`, an 8px check at 1.8 stroke and never a fill, beats my 15px box with its literal 5px radius. `Section` as `.segmented` is right for a schema-closed set, and `.btn.go` stays unspent on `Add`.

---

## Where I still disagree

**Grid Architect — `+` must not be disabled by the six-column rule (§8.1).** He is right that `ceil(span/2)` overflows and that `collapseRow` fixes it; wrong to push the fix into the editor. Riku edits at twelve columns and reads `2 columns left` there. A `+` dark for an arithmetic fact about a width he cannot see declines the move its own caption promises; he presses twice and concludes the button is broken. **The server absorbs it; the editor stays true at twelve.**

**Grid Architect — the sparse-row `auto` weight is suspended while edit mode is open (§3).** No objection in normal view. In edit mode the arrangement changes under the finger, so a row shrink-wrapping the instant a tile leaves it resizes a row Riku is not touching and pushes every toolbar below it up the screen — the classic way a press lands on the wrong control.

**System Keeper — the off layer's name stays `--ink-3`, not `--ink-4` (§4.3).** He swaps the token for the reference's `opacity:.35` because they compute alike, and they do — that is the problem. `--ink-4` `#3A424C` on `--raised` `#14171C` is **1.80:1**; `--ink-3` `#5B6470` is **3.10:1**. That name is the visible label of a switch that must be identified before it is pressed, and at 1.8:1 it is not. Knob `--ink-4`, name `--ink-3`. This also resolves my round-1 Q7: I withdraw "full strength" and land one step above his.

**System Keeper — the tick's touch target is an `::after`, not `padding:8px;margin:-8px` (§5.2).** Negative margin changes the row's box and can pull the control off its neighbours' baseline. `::after{inset:-13px -6px -13px -13px}` is ~40×40 and affects no layout at any width.

**Honesty Critic — a press outcome still takes no dot and no hue, with one exception I grant him.** His width-invariant marker is right for claims about the world and wrong for facts about a press: a failed save is not a reading gone stale. **The exception is the tile-foot sentences.** `Done, but the calendar entry couldn't be removed…` names something wrong *in another system* and outlives its control — his §4(d) orphaned-`calendarEventId` finding. That takes the `--stale` dot; everything beside a live control stays unmarked.

**Frontend Architect — `<Suspense>` is downgraded, not dropped.** If the first live render does not paint inside about a second, the answer is the fallback tile — eyebrow, heading, empty body — never a spinner.

---

## What I concede

1. **The span floor (§6.4, the lead's Q12) — withdrawn entirely.** The Grid Architect and the Frontend Architect both refuse to remove a legal arrangement for a reason Riku cannot see at his editing width, and with the form replacing the body a span-2 form is ugly, not broken. **No arrangement is taken away.**
2. **The full-bleed toolbar strip — withdrawn.** Its only argument was 108px, and 108px fits.
3. **The scrolling tile body — withdrawn.** The row grows instead, below ~280px of tile width only.
4. **Clipping tile content in edit mode (§6.2) — withdrawn.** `inert` gives the mode safety without taking the live data away.
5. **The page-level hidden set — withdrawn**, per the Frontend Architect's island cut.
6. **`ADDING…` in caps — my error.** `.btn` uppercases, so strings are written sentence case: `Adding…`, `Saving…`, `Deleting…`.

---

## Revisions to my round-1 paper

1. **§3:** 15×15, radius 5px, `#12151A` → **14px square, radius 3px (`.ev`), `--sunk`, an 8px `currentColor` check at 1.8 stroke, never a fill.**
2. **§3:** hit box `inset:-14px -6px -14px -14px` → **`inset:-13px -6px -13px -13px`, ~40×40, on an `::after` that changes no layout.**
3. **§3.1:** a page-level `Set` of hidden ids → **each `TodoRow` hides itself; the write is idempotent; the refresh reconciles both tiles.**
4. **§3.1:** "the row returns where it was, unticked" → **the local hide clears and the route re-reads; a timeout restores nothing.**
5. **§3.1:** the failure sentence "under it" → **at the foot of the tile the press happened in; there may be no row left to sit under.**
6. **§4:** "the knob returns" → **on a definite refusal only; on a timeout it stays and the refresh is the arbiter.**
7. **§5.1 rule 5:** "the tile's own body scrolls" → **the form replaces the body; below ~280px of tile width it is one column and the row grows.**
8. **§5.1 rule 6:** `Section` as a `<select>` → **`.segmented`'s box over three `<input type="radio">` — one tab stop, arrow keys move.**
9. **§5.2:** "372px against 262px; it scrolls by 110px" → **~321px inside row 1's 340px floor; nothing scrolls.**
10. **§5.2:** "`Date` defaults to today" → **today, the next full hour and one hour after are computed on the server in `APP_TZ`.**
11. **§6.2:** a full-bleed strip at the tile's top → **`.course .foot`'s shape at the foot, with `--tb` folded into every row minimum.**
12. **§6.3:** "`−` … and `span === 4` on Today and To-do" → **`−` is disabled at `span === 2` only.**
13. **§6.1:** the sticky header row is unchanged and now load-bearing — with the toolbar at the foot, `Save` is further from the last tile touched.
14. **§7:** `<Suspense>` as a proposal → **a fallback if the first live render does not paint inside about a second.**
15. **§8:** "no hue on any of them" → **none beside a live control; a tile-foot sentence naming a wrong state elsewhere takes the `--stale` dot.**
16. **§4:** "keep the text at full strength" → **`--ink-3` on the name (3.10:1), `--ink-4` on the knob.**

---

## Positions on the round-2 questions

| Q | My position, one line | Confidence |
|---|---|---|
| **Q1** | Ship the collapse — one query below 760px, `.app-body` to one column, the rail a 44px top strip; if the lead defers it, the spec must say every one-handed claim in my paper is void until the phone pass. | medium |
| **Q2** | `collapseRow` on the server; do **not** tighten `validateLayout`, and do **not** disable `+` for a six-column reason — the editor must stay true at the width Riku edits at. | high |
| **Q3** | Adopt at both levels: the grid's own width decides 12/6/1, each tile's own width decides form columns, toolbar wrapping and row stacking. It makes "any legal arrangement" true by construction. | high |
| **Q4** | Not mine. My stake is only that the hero stay identifiable after Riku moves it, which both satisfy; I back the Keeper's `#171B21` + inset hairline, with the `--session` tint beside it in specimen 01. | medium |
| **Q5** | Not mine on the numbers — take what the mockup measures — but one clause: **a sparse row's `auto` weight is suspended while edit mode is open**, so a move never resizes a row Riku is not touching. | medium |
| **Q6** | Fifth sheet: `personal.css` for the bento, the six shared controls (tick, switch, square button, field, label, form well) in `components.css` — Settings ships this phase and needs them off `/personal`. | high |
| **Q7** | Not mine. No user-facing surface either way; I note only that the script keeps `src/proxy.ts` out of a design phase's diff. | low |
| **Q8** | Not mine — the Critic's string, the Architect's placement. Nothing on the push tile is pressable, so neither answer has an interaction consequence; I back his (b) with (a) under it. | low |
| **Q9** | Not mine, and I back the Critic: no `—` under a day whose source was not read, and no day rows at all when both feeds are down. | medium |
| **Q10** | Not mine on the sentence; mine on the lever — with every layer off, `+ Event` is `disabled` with `aria-describedby` at the tile's own sentence, which names the Layers tile. | high |
| **Q11** | Mine. Reuse `Couldn't save.` for a failed tick, un-tick, edit `Save` and `Delete`; `Saving…` / `Deleting…` beside the deck's `Adding…`; a header count is **dropped**, never zeroed, when its read failed; and a **timed-out** write needs one new sentence, because "couldn't save" is a claim we cannot make. | high |
| **Q12** | **Withdrawn.** No span floor, no arrangement removed: the form is one column at span 2 and the row grows; the spec records span 2 as known-poor rather than refusing it. | high |
| **Q13** | With the System Keeper on both — a right-aligned mono meta column where only the ink changes, no box; and the empty cell bare in normal view, one dashed rectangle per under-filled row in edit mode, **not focusable and not a drop target**, since D7 chose buttons over drag. | high |
