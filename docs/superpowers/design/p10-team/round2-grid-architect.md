# P10 round 2 — Grid Architect

**Date:** 2026-09-11 · **Role:** the grid — columns, row weights, spans, the empty cell, collapse, and the rule that any legal arrangement must look intentional.
**Read:** brief §6; my `round1-grid-architect.md`; the other four round-1 papers; `round2-questions.md`.
**Re-checked at HEAD `19fa4b1`.** `git diff --stat 3fa055e 19fa4b1 -- src/` is empty, so every round-1 code claim was checked against identical source. New this round: `components.css:42, 259–263, 332, 383, 407, 470`; `tokens.css:50, 57–70`; `components.html:490, 519`.

---

## Where I now agree

- **System Keeper §2 — the tile is the only card level.** I argued ground and radius; he argued the *depth limit*, which subsumes both and makes cards-in-cards impossible under any arrangement.
- **System Keeper §6.1 — the hero takes no hue.** `components.html:490` ships `.day.today{background:#171B21;box-shadow:inset 0 0 0 1px var(--line)}`: the reference's own "this is the current one", on a calendar. It marks the *tile*, which was my whole requirement in §7, with no new token and nothing lit on a page whose real data is `Nothing scheduled.`
- **System Keeper §5.4, §5.10, §4.5, §8, §7.** The toolbar in the tile's foot, grounded in a precedent I missed (`.course .foot`, `components.html:519`); due meta as a mono column, not a chip; the 56px day track; the CSS split; and rows 2 and 3 not binding as written — he measured 172 and 285 against my 164 and 234, independently.
- **Honesty Critic §9, §10.** "Achieve it with structure, not with content" is the right division and I take the structural half; his 106px floor and invariant 5px dot answer legibility at the narrowest cell more cheaply than anything I proposed.
- **Interaction Designer §2, §6.3, §10.** He reaches the container-query spine from one-handedness where I reached it from arrangement-independence — two premises, one primitive. `inert` tile bodies, tiles keyed by tile id so focus survives a move, and 44px targets via an absolute `::after` cost the grid nothing.
- **Frontend Architect §2, §3, §4, §10.** He derives the trailing hole from the auto-placement cursor — my §6's mechanism, better written. Container queries; the fifth stylesheet; and `resolvePersonalLayout` total on read, which keeps every legal arrangement renderable after P11 adds a seventh tile.

---

## Where I still disagree

### Frontend Architect

1. **`Math.max(2, ceil(span/2))` makes the collapse worse** (§3). Drawing D is legal — six span-2 tiles in one row. A floor of 2 puts twelve columns of demand into a six-column grid; a true `ceil` gives `[1×6] = 6` and fits exactly.
2. **A per-tile span→class map cannot be row-correct.** `[3,9] → 7`, `[3,3,3,3] → 8`, both accepted by `validateLayout` as specified. The six-column span is a function of the whole row: computed per render by `collapseRow`, then emitted as a class from a frozen lookup — his safety argument, which I take.
3. **`repeat(12,1fr)` should be `repeat(12,minmax(0,1fr))`.** `1fr` is `minmax(auto,1fr)`: one unbreakable calendar name in a span-2 tile widens its column and every other shrinks. Every grid in the shipped stylesheet already guards this (`components.css:42, 345, 365, 423, 447`).
4. **Fixed CSS row tracks cannot compact an empty row.** With `.pe-r1…r4` at literal `grid-row:N`, drawing D carries 180 + 240 + 120 + 42 = **582px of dead track** under a strip of six tiles, and an empty row is reachable — the Interaction Designer's §6.3 deliberately does not prevent one. Hence `--tracks`, inline on the grid, compacted and renumbered by the server.
5. **The breakpoints.** `max-width:640px` / `380px` run off a **12-column base**, so a browser without container-query support renders twelve columns at any width, and at a 380px grid his six columns are 51.7px each. `min-width` off a **1-column base** is the correct degradation and matches `CLAUDE.md`'s mobile-first.

### Interaction Designer

1. **A form must grow its row, not scroll inside a 42px body** (rule 5). His own carve-out defeats it: he licenses the All-day toggle to move the button row 102px because it is movement Riku caused in the direction he is looking, and a form opening is the same act. Row 4 decides it — a To-do tile there has ~42px of body at *every* span. Rows are minimums (deck §5); D7 fixes the weights, not maxima, and the System Keeper's §5.6 lands in the same place.
2. **The toolbar belongs in the foot.** A top toolbar plus `overflow:hidden` clips from the bottom, so at row 4 the tile shows a toolbar and loses its eyebrow — the only thing saying *which tile you are moving*. His reason for going full-bleed dissolves too: at the narrow band padding drops to 12px, giving 117.7px against the 108px arrow group.
3. **Q12, the span floor** — it guarantees nothing it claims to. See the table.

### System Keeper

1. **"Key the row-stacking rule off the span classes the server already emits"** cannot work. One span class maps to **three widths**: span 4 is 297px at twelve columns, 141.7px at six, full-width at one. A span class cannot tell a tile how wide it is, which is why the tile must ask; a container query on the tile is not a third breakpoint, it is the absence of one.
2. **Row 3 at ≈285px.** Change the layout rather than accept the number. Seven day rows in one column measure 318px in a 240px row, and the blank page then reads 340 / 180 / **318** / 120 — "tall, short, medium, short" gone on day one. Two inner columns at ≥ 720px of tile width bring it to 234px, and Riku asked for *"multiple columns for the content"* before he specified the bento. If the lead rejects them, row 3's weight must be **raised to 300**: a weight below its own blank content is the defect we both just found in row 2.
3. **`--panel` "has no consumer today"** (§5.8) is wrong at HEAD — `.fl-health.alarm{background:var(--panel)…}` (`components.css:470`) renders on `/freelance`, and `.statstrip:332` declares it. His `--panel` editing well is still right; its argument becomes "the ground the system already uses for a structural, hueless statement", not "an unspent token".

### Honesty Critic

His 106px floor is right; his derivation is not. At a 760px *viewport* the grid is 760 − 170 − 56 = 534px, so 1 of 6 is **77.3px** — 45px of content after tile padding. 106px is 1 of 6 at a 706px **grid**, needing a 932px viewport. His invariant-dot rule is therefore true only under container-query thresholds — the best independent argument for Q3 in this round.

---

## What I concede

- **The hero's tint.** `--tint-session` withdrawn; no new token, no hue on the hero, my budget down from three places to two. His `§5.14` rule 2 citation — *colour means there is a signal here* — cuts against my proposal on the page's primary state and I had no answer.
- **`--panel` for the tile ground.** My argument was area; the reference has a counterexample I should have found — 28 `.day` cells at `--raised` covering a month grid. `--raised` also makes `#171B21` read as one step up rather than a jump.
- **`--r-feature` 14px for all six tiles**, no radius difference on the hero: with the ground carrying the mark, a second mark is a second spend.
- **`space-between` in the blank hero.** Withdrawn — two roles objected independently, and my own precedent does not hold: `.stat`'s figure sits at the card's foot in *every* state, whereas my slack would move the DUE group when a day fills up. Most of it was measurement error anyway; row 1's blank slack is ~65px, not 115px.
- **The namespace `pe-`**, and **frozen class lookups for the spans** rather than inline custom properties; only `--tracks` stays inline, because it is per-render data.

---

## Revisions to my round-1 paper

1. **§3, row weights.** `340 / 170 / 240 / 120` → **`340 / 180 / 240 / 120`**; 180 clears both blank measurements and keeps the doc's 20px cadence.
2. **§3, blank To-do tile.** `225px` → **`≈275px`**; I used a 14px inter-group gap where `.fl-group` is 28px (`components.css:407`, reasoned at `:383`).
3. **§3, blank Layers tile.** `164px` → **`≈172px`**; `.stat`'s `15px 16px` padding and a 20px head-to-body gap, not my 14px.
4. **§4.2, tile ground.** `--panel` → **`--raised`**.
5. **§4.2, tile radius.** `--r-card` for all plus `--r-feature` for the hero → **`--r-feature` 14px for all six**.
6. **§4.2, tile padding.** `16px` → **`15px 16px`**, keeping the drop to 12px below 200px of tile width.
7. **§6, dashed-cell radius.** `--r-card` → **`--r-feature`**, matching the tile it stands in for.
8. **§7, the hero accent.** `--tint-session` plus a hued border → **`background:#171B21; box-shadow:inset 0 0 0 1px var(--line)`, no hue, no new token**; `--session` on the `TODAY` eyebrow is the named fallback.
9. **§7, hue budget.** Three places → **two**: `--missing` on overdue text, `--stale` on the couldn't-read dot. The hero spends none.
10. **§9, namespace.** `.pg` / `.tile` / `.tl-` → **`.pe-`** throughout.
11. **§9, placement emission.** Five inline custom properties per tile → **frozen class lookups for the row, the 12-column span and the 6-column span**; `--tracks` alone stays inline on the grid.
12. **§10.** `.tile-body.is-pair{justify-content:space-between}` → **withdrawn**; content top-aligns in every tile and the slack falls below it.
13. **§10, the measured claim.** `340 / 170 / 240 / 120`, page 912px, fills 66 / 96 / 98 / 88% → **`340 / 180 / 240 / 120`, page 922px, fills ≈81 / 96 / 98 / 88%**.
14. **§11, forms.** "the row grows below 280px of tile width" → **"the row grows whenever the form does not fit, at any span and in any row; a form never scrolls inside its tile's body."**
15. **§12, test 1.** Expected rows and page height updated to revision 13's numbers.

---

## Positions on the round-2 questions

| Q | Position | Confidence |
|---|---|---|
| **Q1** | Do **not** ship a rail collapse in P10; specify the 1-column stack fully and leave it unreachable — keyed to the grid's own container width it becomes reachable the day the shell gains a phone form with zero P10 edits, and a rail change re-renders `/freelance`. | medium |
| **Q2** | `collapseRow(spans)` on the server: `ceil` first, then decrement the widest entry (ties at the last index) until the row sums to ≤ 6. Not per-tile, not round-down, not a tighter `validateLayout`, and **not** `Math.max(2, ceil(span/2))`. | high |
| **Q3** | Adopt, with **two** containers: the grid's wrapper drives 12 → 6 → 1, each tile drives its own inner layout. `min-width` off a 1-column base, on the grid's width: **6 columns at ≥ 706px, 12 at ≥ 820px** — those over 640/380 because mine are derived from the narrowest legal cell (106px at six, 125px at twelve). | high |
| **Q4** | **Bank it.** `#171B21` + inset hairline, no hue, no new token — it marks the *tile*, so it survives every span and every row, which was my only requirement. `--session` on the `TODAY` eyebrow is the named fallback; specimen 01 shows the hero at span 8 beside itself at span 4. | high on no-tint; medium on whether it reads |
| **Q5** | **`340 / 180 / 240 / 120`** — 180 over my 170 and his 172 because it clears both measurements while keeping the doc's 20px cadence. Row 3's 240 is **conditional** on two inner columns in Next 7 days at ≥ 720px of tile width; without them the blank tile is 318px and the weight must be **300**. And **yes, a sparse row drops to `auto`** — under 6 of 12 filled it shrink-wraps, which can never make a row taller than its weight. A deck deviation, so the lead's to take. | medium |
| **Q6** | Fifth stylesheet `src/styles/personal.css`, namespace **`pe-`**, shared controls promoted into `components.css` because Settings ships this same phase and needs them. My one addition: **nothing in `components.css` may change shape for this page**, because `/freelance` renders from it. | high |
| **Q7** | **Not mine** — no grid consequence either way. For the record I would take the script: it removes surface instead of adding it. | high (that it is not mine) |
| **Q8** | **Not mine.** One geometric constraint on whichever sentence wins: it must render in the push tile at **1 of 6 (106px)** without truncation, because a tile that can be moved anywhere must say its worst news at its narrowest legal width. | high (that it is not mine) |
| **Q9** | **Not mine** on the strings; on the geometry I back the Critic. Omitting the seven day rows leaves a span-12 tile holding two sentences in a 240px row, and **the weight must hold** — an outage must not shrink the page, or the grid reports the failure a second time by changing shape. | medium |
| **Q10** | **Not mine.** A configuration state, not a layout one. | high |
| **Q11** | **Not mine.** One note: every one of those sentences needs a home that exists at span 2 — the tile foot, which `.pe-foot` already reserves with `margin-top:auto`. | high |
| **Q12** | **No span floor.** `−` stays live to 2 on all six tiles and the layout stays fully Riku's. The floor guarantees nothing it claims to: a To-do tile at span 4 in **row 4** has ~42px of body regardless of width, so the binding constraint is the 120px weight, which D7 fixes and no stepper rule can reach. The honest answer is revision 14 — the form grows its row. | medium-high |
| **Q13** | With the System Keeper on both halves. Due meta is a right-aligned mono 9.5px tabular column where the only difference between `Fri 12` (`--ink-3`) and `3 days late` (`--missing`) is the ink, no box. The empty cell is **bare ground in normal view**, and in edit mode **one** dashed rectangle spanning the row's whole leftover at `--r-feature`, never one per column — two boxes read as two slots to fill rather than as the room the row has. | high |

---

*One line if only one survives:* the arrangement controls exactly one number per tile — its span — and every other decision is a function of a width something can measure at render, which is what makes "any legal arrangement looks intentional" a property rather than a hope.
