# P10 round 1 — Grid Architect

**Date:** 2026-09-11 · **Role:** the grid — 12 columns, four weighted rows, spans, the empty cell, collapse, and the rule that any legal arrangement must look intentional.
**Standing question:** *does it stay a bento when Riku rearranges it?*
**Sources:** content deck `2026-09-10-p10-personal-page-content.md` (§2.7 Riku's verbatim spec; §5 default; §12 blank; §13 full), design doc `2026-09-10-p10-personal-page-design.md` (*The grid*, *The layout store*), P8 visual spec `2026-09-07-p8-freelance-page-visual-design.md` §4–§5, `docs/design/DESIGN-INSPO.md` §1–§3 / §5.14 / §7.1, `docs/design/components.html`, `src/styles/tokens.css` / `base.css` / `components.css`, P8 `round3-lead-rulings.md` R1–R24, `ARCHITECTURE.md` §7, `CLAUDE.md`.
**Checked at:** `21f3c1a` — the brief's own commit and current HEAD (`3fa055e` is not an ancestor of this tip). Every code claim below was read there.

---

## 1. Position

Riku asked for a bento and, in the same breath, asked to be able to take it apart. Those fight, and my paper is one answer to the fight: **the arrangement controls exactly one number per tile — its span — and nothing else on the page may depend on the arrangement.** Not a tile's internal column count, not its padding, not its type sizes, not its collapse width. Each is a function of the tile's *own rendered width*, resolved by a container query on the tile itself, so a tile does the right thing at span 12 in row 1 and at span 2 in row 4 without any code knowing which happened. That is the only mechanism I can find that makes "any legal arrangement" a provable property rather than a hope, and it costs one CSS feature the app already spends (`container-type`, the same currency as the `:has()` at `components.css:321`). Second: **the four row weights are a floor and never a ceiling, and that is exactly what makes them survive rearrangement.** No row is ever shorter than its weight, so the blank page — the primary state, per the design doc's reading of the measured data — is *precisely* 340 / 170 / 240 / 120 and reads tall/short/medium/short by construction; data only ever adds unevenness on top. The weights cannot stop a loud row from growing and should not try. Third, before the detail: **the design doc's row-2 weight of 140px is wrong by measurement** — the blank Layers tile is 164px — and **the 12→6 collapse rule as written overflows for most full rows containing an odd span**, which `validateLayout` as specified will happily accept. Both are arithmetic; both are cheap to fix.

---

## 2. The arithmetic, verified

920px column, `repeat(12, …)`, `gap: var(--sp-4)` = 14px. Gutters 11 × 14 = **154**. Tracks 920 − 154 = **766**. Per column **63.8333px**. Span *N* = *N* × 63.8333 + (*N*−1) × 14:

| 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|
| 141.67 | 219.50 | 297.33 | 375.17 | 453.00 | 530.83 | **608.67** | 686.50 | 764.33 | 842.17 | 920.00 |

Deck §2.9 is right on every value it quotes. The 920 column carries **no padding of its own** — the 28px lives on `.app-content` (`components.css:126`; P8 spec §5.4 has the `box-sizing` trap that yields 864 instead). `.pg` takes `.fl`'s job: `max-width: var(--content-max); margin: 0 auto`.

**One correction to the design doc's `repeat(12, 1fr)`.** `1fr` is `minmax(auto, 1fr)`, and that *auto* minimum is content-derived: one unbreakable string — an event title, a calendar name — inside a span-2 tile widens its column and every other column shrinks to compensate. The twelve columns stop being equal and the bento stops being a grid. Every grid in the shipped stylesheet already guards this (`components.css:346, 388, 424, 434`, all `minmax(0,1fr)`). **`repeat(12, minmax(0,1fr))`**, plus `min-width:0; overflow:hidden` on `.tile`.

**The six-column grid is the twelve-column grid with every other line removed.** At 920, six columns give (920 − 5×14)/6 = **141.667px** — precisely a 12-column span of 2. So *k* columns at 6 is exactly *2k* columns at 12, for every *k*. That is why "halve the span" is right, and why an even-span tile does not move a pixel across the breakpoint. Odd spans grow by exactly one column plus a gutter (3: 219.50 → 297.33). The collapse is an identity, not an approximation.

---

## 3. The four rows — one weight is wrong

The design doc gives 340 / 140 / 240 / 120, written before anything was measured. Measuring deck §12's blank render against §4's anatomy (tile padding 16px, head 47.75px, `--sp-5` head→body gap, P8's shipped line-heights):

| Tile | Span | Composition | px |
|---|---|---|---|
| Today | 8 | 32 pad + 47.75 head + 20 + (14.25+10+19.5) + 20 + (14.25+10+19.5) | **207** |
| To-do | 4 | 32 + 34.25 head + 20 + 3 × 36.75 sections + 2 × 14 | **225** |
| Layers | 3 | 32 + 14.25 eyebrow + 14 + 3 × 34.75 switch rows (`components.html:469`) | **164** |
| Push | 8 | 32 + 14.25 + 20 + 19.5 title + 6 + 19.4 body | **111** |
| Next 7 days | 12 | 32 + 47.75 + 20 + 4 × 33.5 (two inner columns, §4.4) | **234** |
| Done this week | 12 | 32 + 34.25 + 20 + 19.5 | **106** |

Row maxima **225 / 164 / 234 / 106**. **Row 2's 140px floor sits 24px below its own blank content.** A minimum that content already exceeds is not a weight; it is a number that never fires. On the page Riku actually sees, the doc's rows measure 340 / **164** / 240 / 120, and the "short second row" is an accident of the Layers tile rather than a decision.

**Proposed: `340 / 170 / 240 / 120`.** One change. Ratios 2.83 : 1.42 : 2.00 : 1.00 — tall, short, medium, short, the two shorts deliberately unequal because Riku asked for uneven, not for two matched shorts. Total 340+170+240+120+3×14 = **912px** against a 920px width: the default bento is a near-square. Row 3's 6px of headroom is tight and depends entirely on §4.4 — the one load-bearing dependency in this paper.

**The weights are minimums and nothing else,** and the consequence deserves to be a rule, because it answers my standing question:

> **The weights guarantee the page is uneven at zero data. Data only ever adds unevenness. There is no state in which the page flattens into a machine-generated card grid, because the only force that could flatten it — every row taking the same height — is what the weights make impossible.**

That survives every rearrangement: weights attach to row *positions*, and D7 forbids Riku editing row heights at all.

**One deck deviation I am asking for.** Deck §5: *"Row weights are fixed … whatever tiles sit in them."* That is written for the default and for full rows. A 340px row holding one 297px tile and 609px of nothing is not a hole, it is an empty room (drawing **C**). Propose: **a row whose tiles sum to fewer than 6 columns drops its weight and takes `auto`.** It shrink-wraps and the void shrinks with it. This can never make a row *taller* than the weight would have, so it costs nothing elsewhere. One line in the server's track builder. **Lead's call — it is a deck deviation.**

---

## 4. The tile on its cell

### 4.1 Anatomy — what carries over unchanged

```html
<section class="tile" style="--r:1;--c:1;--n:8;--c6:1;--n6:4">
  <div class="tile-head">
    <span><span class="eyebrow">TODAY</span><span class="tile-h">Thu 10 Sep</span></span>
    <button class="btn">+ Event</button>
  </div>
  <div class="tile-body"> … </div>
  <div class="tile-foot"> … </div>
</section>
```

`.tile-head` is `.fl-headrow`'s grammar, reused rather than reinvented — P8's spec is explicit (`components.css:427`): *"When a title-level control eventually needs to sit RIGHT of the title, the pattern already exists — `.fl-headrow`'s `grid-template-columns:minmax(0,1fr) auto; align-items:end`. Do not invent a second one."* This is that moment. `.tile-h` is `.fl-h` at a smaller size — 19px inside a 141px cell is absurd (§4.3).

`.tile-foot` takes `margin-top:auto` and holds the tile's *extent* statements: `Showing 20 of 26.` (`.fl-bound`), `Couldn't read Classes.`, the `.fl-absent` notes. Those belong at a container's bottom edge, and putting them there gives every tile an occupied bottom edge whenever it has anything to say.

### 4.2 Ground, border, radius

**`--panel` (#0E1013), not `--raised` (#14171C).** DESIGN-INSPO §2 assigns cards to `--raised` and `.stat` uses it — but `.stat` is three 219px cards on an otherwise dark page. Here six tiles cover ~90% of the content column; at `--raised` the *ground* becomes the minority and the page reads as a field of lit boxes, which is the "machine-generated card grid" Riku's spec says the weights exist to prevent. P8 has the precedent for choosing quiet on a large object: the health alarm card is `--panel`, *"cards earn their borders, and a structural alarm is quieter and stronger than more colour"* (§4.6). `--raised` stays available for anything nested inside a tile. The argument is area, not token.

**`--r-card` 10px for every tile; `--r-feature` 14px for the hero only.** DESIGN-INSPO §3 reserves 14px for feature cards; Today is the only feature here. A larger radius on a larger box is proportional, not a badge, so it spends no accent budget — and it stays with Today when Riku shrinks it.

**Padding 16px, dropping to 12px below 200px of tile width.** At span 2 (141.67px), 16px each side leaves 109.67; 12px leaves 117.67 — the difference between the `+ Event` pill fitting on its own line and not. A container query on the tile, so it fires identically at span 2 of 12 and at 1 of 6.

### 4.3 The tile's four width bands — the mechanism the paper rests on

Every tile declares itself a container; every internal decision keys off its own width. Nothing internal knows about spans, rows, breakpoints or arrangements.

| Band | Width | Spans at 920 | What changes |
|---|---|---|---|
| **narrow** | < 200px | 2 | padding 12px; head stacks (control drops below eyebrow); heading 15px; all labels ellipsis, never wrap |
| **mid** | 200–479 | 3–6 | padding 16px; head one line; heading 17px; one inner column |
| **wide** | 480–719 | 7–9 | heading 19px; rows may use a fixed left track (the time column) |
| **broad** | ≥ 720 | 10–12 | two inner columns where the tile supports it |

At six columns on a 920 grid the six cells land on 141.67 / 297.33 / 453 / 608.67 / 764.33 / 920 → narrow / mid / mid / wide / broad / broad. At the bottom of the six-column band (grid 706) they land on 106 / 226 / 346 / 466 / 586 / 706 → narrow / mid / mid / mid / wide / wide. Both sensible, and nobody wrote a rule for either. That is the point.

**Without container-query support every tile takes the narrow base and all band rules are skipped** — one column, ellipsised labels, small heading. Correct, legible, ugly. The right degradation, free.

### 4.4 The one internal-layout call I am making, and why it is mine

**Next 7 days takes two inner columns at ≥ 720px of tile width** — days 1–4 left, 5–7 right, a 14px inner gutter so the gutter really is the same everywhere as Riku's spec requires.

In one column the blank week tile is 7 rows × 33.5 + 47.75 head + 20 + 32 padding = **318px**, inside a 240px row. It would grow row 3 to 318 — 94% of the tall row — and the blank page would read 340 / 170 / **318** / 120, at which point "tall, short, medium, short" is gone in the state the page is guaranteed to be in on day one. Two columns: 4 × 33.5 + 47.75 + 20 + 32 = **234px**, under the weight. At span 12 the inner columns are (920 − 32 − 14)/2 = **437px**; deck §13's longest day line (~68 characters at 13px ≈ 428px) fits on one line. It also honours what Riku said before he specified the bento at all: *"multiple columns for the content"*.

I claim this as a grid call rather than a content one because it is the only thing between the default's blank state and a dead weight; hand it elsewhere and row 3's weight must rise to ~330, taking the tall/medium distinction with it. `Done this week` gets the same rule at the same threshold, where it matters more: at its 20-row bound in one column it is 32 + 34.25 + 20 + 670 = **756px** in a 120px row.

---

## 5. Four arrangements, drawn

Ruler 1–12. Heights are *rendered* row heights with deck §12's blank data.

### A. The default (deck §5)

```
     1    2    3    4    5    6    7    8    9   10   11   12
r1 |<------------ Today  span 8 ------------>|<-- To-do  4 -->|   340
r2 |<-- Layers 3 -->|<--------- Push  span 8 --------->|[hole]|   170
r3 |<-------------------- Next 7 days  span 12 -------------->|   240
r4 |<------------------ Done this week  span 12 ------------->|   120
```

Holds: every tile on whole cells, one gutter everywhere, one hole. Boundaries at 8/9 and 3/4 align with nothing — the *loose* in loose bento. Blank page is exactly the four weights (§12 test 1).

### B. Riku's likely first edit — the to-do list goes full width

```
     1    2    3    4    5    6    7    8    9   10   11   12
r1 |<------------ Today  span 8 ------------>|<- Layers 3 ->|[·]  340
r2 |<---------------------- To-do  span 12 ----------------->|  170 -> 424
r3 |<---------- Next 7 days  span 8 -------->|<-- Push  4 -->|   240
r4 |<------------------ Done this week  span 12 ------------->|  120
```

**Holds:** placement, gutters, hole (it migrates to row 1, still one trailing column).
**Breaks:** the weights, under load. With deck §13's six open to-dos the span-12 To-do tile is 32 + 34.25 + 20 + 3 headings + 6 rows ≈ **424px**, and row 2 — the *short* row — becomes the tallest thing on the page. Nothing can prevent this: content height is a property of a tile, not of a row, and the weights are minimums by the deck's own definition.

This is the honest answer to my standing question. **It stays a bento in the sense that matters — cells, gutters, no overlap, uneven rows — and it stops matching its own labels.** I do not think that is a defect to engineer away; Riku moved the tile, the row grew, the page is telling the truth about what is in it. But the lead should decide whether the mockup shows it: it is the most likely non-default state and the one that most tests whether "loose weighted bento" means the weights or the looseness.

### C. Hero to row 3, shrunk to span 4 (the brief's case)

The editor cannot reach this directly: `↓` is disabled while the target row is full, so Riku must shrink Next 7 days from 12 to 8 first.

```
     1    2    3    4    5    6    7    8    9   10   11   12
r1 |<-- To-do  4 -->|[············· 8 columns of hole ·············]  340
r2 |<-- Layers 3 -->|<--------- Push  span 8 --------->|[hole]|      170
r3 |<---------- Next 7 days  span 8 -------->|<- Today 4 ->|         240
r4 |<------------------ Done this week  span 12 ------------->|      120
```

**Holds:** placement, gutters, collapse ([4]→[2]; [3,8]→[2,4]=6; [8,4]→[4,2]=6; [12]→[6]). Today at span 4 in the medium row wraps more, measures ~250px, and grows row 3 to 250. Fine.
**Breaks:** row 1. 608.67 × 340 = **207,000 px² of void**, against the default hole's 63.83 × 170 = 10,851. Nineteen times the area. That is the empty room.

Three defences, and I want all three: (1) §3's sparse-row rule — row 1 sums to 4, drops its weight, shrink-wraps to 225px, and the void falls to 137,000 px²; (2) the editor narrates it — the caption reads `8 columns left` on every toolbar in that row, in the mode where he made the change, so it is never a surprise; (3) `Reset to default` sits in the header the whole time.

What I will not do: cap the hole in `validateLayout`. Refusing a legal move for an aesthetic reason turns D7's gift into a nag, and the failure it prevents is one Riku authored, saw narrated, and can undo.

### D. Every tile in one row — the legal extreme

Six tiles, spans ≥ 2, sum ≤ 12: exactly one arrangement fits.

```
     1    2    3    4    5    6    7    8    9   10   11   12
r1 |Today|To-do|Layrs|Push |Week |Done |                          340 -> 385
r2 (empty)   r3 (empty)   r4 (empty)
```

**Holds:** legal, places, collapses ([2×6] → [1×6] = 6), and every tile at 141.67px is in the narrow band so heads stack and nothing overflows. Empty rows contribute **zero** height because the server compacts them out of the track list (§9) — without that, the page carries 170+240+120+42 = 572px of dead space under a strip of tiles.
**Breaks:** it is not a bento, it is a strip of six equal cards — the shape Riku's uneven rows exist to prevent, six times over. I will not defend it as beautiful. **The guarantee is legality and legibility for every arrangement, not beauty.** A design that could make this look composed would be doing something the arrangement did not ask for, which is the worse failure.

---

## 6. The empty cell

**In normal view it is nothing.** `--void` shows through. No border, no dashes, no tint, no wash. DESIGN-INSPO §1.4 — cards earn their borders — is dispositive: a hole that draws something is a card that earned nothing. And P8 settled the register in the neighbouring case (R12: `Nothing waiting.` is *"left-aligned where content lives, never centred, never in a dashed box, never with an action pill"*). A dashed rectangle in normal view is that box, with nothing even claiming to be in it.

**In edit mode it is one dashed rectangle spanning all the row's leftover columns** — `1px dashed var(--line)`, `border-radius: var(--r-card)`, no fill. One rectangle, not one per column: the caption says `2 columns left`, and two dashed boxes would read as two slots to fill rather than as the room the row has. These are the editor island's own DOM, computed from the arrangement it already holds; the server never renders them.

**Leftover always trails.** With `grid-row` fixed and `grid-column: span N` unpinned, auto-placement packs left to right in DOM order and the remainder falls at the right edge — free, and the hole moves with the arrangement without anything computing it. The rule that makes it read as intentional rather than as a tile that failed to fill: **a hole is a whole number of columns, separated from its neighbours by exactly one 14px gutter, and no tile ever stretches to absorb it.** `justify-*` stays at its initial value everywhere.

**The default's hole stays at the right edge of row 2, per deck §5's drawing.** The alternative, recorded because the lead may want it after seeing pixels: putting it *between* Layers and Push (3 · hole 1 · 8) makes row 2 flush at both edges, so the hole is unmistakably interior and cannot read as "the push tile is one column short". Its cost is real — the layout store is `[{tile, span}, …]` per row and cannot express an interior gap, so it needs a `{gap: n}` entry, a `validateLayout` clause and an editor that can move a tile *past* a hole. **I would cut that feature.**

---

## 7. Hierarchy by size alone, and the hero's one accent

**Riku's rule and the default arrangement do not quite agree, and it decides where the accent goes.** His spec says *"the biggest block is the most important"*. By area the biggest block on the default page is **Next 7 days** (920 × 240 = 220,800 px²), not Today (608.67 × 340 = 206,948). By width, also the week tile. Today wins on exactly two counts: it is **first**, and it is in the **tall** row.

So the operative rule is **first-and-tallest, not biggest**, with one structural consequence worth pinning: **the tall weight must stay at row position 1.** It does — D7 fixes the heights — so the hero position always exists even when Riku empties it. But it means that the moment Riku moves Today out of row 1 (drawing **C**), *nothing on the page is the hero*, and the only thing still saying which tile Today is, is the accent. **That is the argument for the accent existing at all.**

It must therefore be a property of the *tile*, permanent, surviving every span and every row. Textual hue does not qualify: hueing the `TODAY` eyebrow breaks eyebrow grammar on one tile of six; hueing the date breaks the rule that no heading in the shipped system is hued; a dot before the eyebrow collides with the system's dot, which means *warning* in all three shipped uses (`.fl-warn i`, `.fl-fail i`, `.statuspill i`).

**The accent is the tile's ground: a 155deg tint plus a 20%-alpha hued border, and nothing else on the tile is hued.** That is `.stat.roi`'s recipe (`components.css:294`) minus the hued figure — the figure's hue is licensed by "one loud figure per card" (DESIGN-INSPO §1.3) and this tile has no figure. Being structural, it cannot be confused with state hue, which on this page lands only on *words in rows* (`3 days late` in `--missing`; an unreadable calendar in `--stale`, following `.pwhen.is-stale`'s precedent of hueing text and never a fill).

**The hue is `--session`.** (1) DESIGN-INSPO §5.11 already maps **Classes → `--session` blue, "they're sessions"**, and the Today tile is the day's sessions — no new meaning invented. (2) `--session` is the one token in the closed set with **no shipped consumer** (`tokens.css:50`; P8 spec §5.1 records it *"defined and unused, and that is settled"* — which settles that it is defined, not that it must stay unused; using it for its documented meaning is neither an alias nor a new hue). (3) Every other candidate is taken on this page: `--stale` is the unreadable calendar, `--missing` is overdue, `--spend` is the brand tile and the focus ring, `--roi` is the queue's decisions, `--save` means healthy and nothing here is.

**How much — and this only shows in pixels, exactly like R3.** `.stat.roi`'s tint covers 219 × 132 = 28,908 px². The hero at span 8 × 340 is **208,000 px², seven times the largest tinted object that ships today.** A gradient tuned for a 219px card will read as a blue panel at 609px. So keep the geometry and move the neutral stop earlier: `--tint-session: linear-gradient(155deg, #0A1A2E, #0F1318 45%)` against the shipped pattern's 62%, so the hue survives only in the top-left corner. Border `rgba(95,165,250,.2)`, matching the .2 alpha of the other two tints. **The mockup must show this at span 8 beside the same tile at span 4** — 45% is my estimate and only the render settles it. `--tint-session` is a new token and therefore the System Keeper's ruling; I specify the recipe and the reason, not the addition.

**Budget, as a rule so it cannot creep:** this page spends hue in exactly three places — the hero tile's ground and border; `--missing` on overdue text; `--stale` on an unreadable-calendar sentence. Nothing else. No hued counts, no hued tags, no hued switches, no green on a ticked box, no hue on the `on calendar` tag.

---

## 8. Collapse — and the bug in the rule as written

### 8.1 The rounding rule overflows, and `validateLayout` will not catch it

For a row of spans *s₁…s_k* with Σ*sᵢ* ≤ 12, Σ ceil(*sᵢ*/2) = (Σ*sᵢ* + #odd) / 2, which exceeds 6 whenever the row is full **and contains an odd span**. All of these are legal under `validateLayout` as specified — four rows, each tile once, spans 2–12, row sums ≤ 12 — and all overflow a 6-column grid:

| Row at 12 | 3+9 | 5+7 | 3+4+5 | 2+3+7 | 3+3+6 | 3+3+3+3 |
|---|---|---|---|---|---|---|
| ceil-halved | 2+5 | 3+4 | 2+2+3 | 1+2+4 | 2+2+3 | 2+2+2+2 |
| **sum** | **7** | **7** | **7** | **7** | **7** | **8** |

The default survives only because row 2 is not full (3+8 = 11 → 2+4 = 6). An overflowing row spills into implicit column tracks and every tile below it inherits a wider column basis: the page does not degrade, it breaks.

**Fix: `collapseSpan(span, cols)` becomes `collapseRow(spans)`.** The per-tile function in the design doc cannot see the row and therefore cannot be correct; the server already holds the whole arrangement.

```
collapseRow(spans: number[]): number[]
  out = spans.map(s => ceil(s / 2))       // the deck's rule, applied first
  while (sum(out) > 6)
    i = index of the widest entry > 1, ties taken at the LAST such index
    out[i] -= 1                            // leading tiles keep their width
  return out
```

Termination is provable: spans ≥ 2 with Σ ≤ 12 bound *k* at 6 tiles, and every entry floors at 1, so the minimum reachable sum is *k* ≤ 6. It preserves the deck's ceil rule wherever ceil fits. Worked: `[3,9]→[2,5]→[2,4]`; `[3,3,3,3]→[2,2,2,2]→[2,2,2,1]→[2,2,1,1]`; `[2,2,2,2,2,2]→[1×6]` untouched.

Two consequences for other roles: **the editor's `+` must be disabled by the six-column rule as well as the twelve** (or `2 columns left` promises room that costs another tile a column at 6), and `layout.test.ts` gains `collapseRow` cases in place of `collapseSpan`'s. Alternatives rejected: *round down* (always fits, contradicts the deck's explicit "rounded up", makes span 3 identical to span 2 at six); *let the row wrap* (a spilled tile lands in the next weighted row and the weights are gone); *reject Σceil > 6 in `validateLayout`* (honest, but it refuses 3+9 for a reason Riku cannot see at the width he is editing at).

### 8.2 What a span-2 tile becomes at six columns

`ceil(2/2) = 1`, and `collapseRow` never takes it below 1. **A span-2 tile is the only tile that can be 1 of 6, and 1 of 6 is the narrowest cell in the system: 141.67px on a 920 grid, 106px at the bottom of the six-column band.** Everything must be legible there — that width is what decides §4.3's narrow band.

Layers at 1 of 6, worst case: a 26 × 15px switch (`components.html:475`, `.swx`) + 9px gap + a calendar name bounded to 120 characters in the model. `Personal` fits at 106px; `Holidays in Philippines` does not, at any width on this page. **Layer labels ellipsis and never wrap**, matching the deck's own rule for event titles in Tile 1 (*"cut with an ellipsis, never wrapped"*). Same rule for every name-bearing row on the page.

### 8.3 Where the breakpoints go — and the shell problem behind them

**The design doc's 760px and 480px viewport breakpoints are both wrong, and the reason is the shell.** I checked: **there is no `@media` rule in `src/styles/` outside `prefers-reduced-motion` (`base.css:35`).** `.app-body` is `grid-template-columns: var(--rail-w) minmax(0,1fr)` (`components.css:39`) at every width; the rail is 170px forever. So

> grid width = viewport − 170 (rail) − 56 (`.app-content`'s 28px each side), capped at 920.

The 920 column therefore holds only at **viewport ≥ 1146px**. Below that everything narrows proportionally:

| Viewport | 1146 | 1024 | 900 | **761** |
|---|---|---|---|---|
| Grid | 920 | 798 | 674 | **535** |
| Column | 63.83 | 53.67 | 43.33 | **31.75** |
| Span 2 | 141.7 | 121.3 | 100.7 | **77.5** |
| Span 8 | 608.7 | 526.7 | 444.7 | 352 |

At 761px — one pixel above the design doc's 12-column floor — a span-2 tile is **77.5px**, which does not hold the word `LAYERS` at mono 9.5px / 0.18em (≈ 46px) plus 24px of padding. **The 12-column grid fails before its own breakpoint fires.**

And at 480px, the doc's 1-column step: the content column is 480 − 226 = **254px**; at a real phone width of 390px it is **164px**. The deck's primary journey is *"Phone buzzes at 07:00 … The page is where Riku goes after that"* (§1). **That journey does not exist while the rail is 170px wide, and no CSS in this page can create it.** DESIGN-INSPO §7.1 records the debt — *"170px fixed rail has no mobile form — bottom tabs or a sheet, decided later"* — and S18-1 put the phone pass in a later phase. This is the collision, and it is Riku's question, not ours.

**Proposal: key the collapse to the grid's own width with a container query, not to the viewport.** The breakpoints are then correct today, correct the day the shell gains a phone form, and correct if `--content-max` is ever raised (design doc open item 1). It also deletes the doc's coupling clause — *"if the shell already collapses its rail at a different width, use that width"* — a rule that can rot silently.

Thresholds, derived from the narrowest legal cell rather than from round numbers:

- **12 columns at grid ≥ 820px.** A column is 55.5px there and span 2 is 125px — the floor for a tile holding a `+ Event` pill (≈ 78px) plus 24px of padding. Viewport ≥ 1046px.
- **6 columns at grid ≥ 706px.** 1 of 6 is 106px — the same floor relaxed by the narrow band's tighter padding. Viewport ≥ 932px.
- **1 column below.** Viewport < 932px.

The six-column band is a 114px window (grid 706–820) — narrow but real; it is where an iPad in landscape lands. A default arrangement would survive to grid 542px because its narrowest tile collapses to 2 of 6, not 1; I deliberately do not exploit that, because the threshold would then depend on the arrangement and have to be emitted per render. Predictability beats 160px. **No `@supports` fallback:** a browser without container queries takes the 1-column base, and the app targets current Chrome on the grounds the shipped `:has()` rule already states (`components.css:319`).

---

## 9. The CSS, in full

```css
/* src/styles/personal.css — page-scoped. See §11 on placement. */

.pgw{ container: pgw / inline-size; }   /* an element cannot query itself */

.pg{
  display:grid;
  gap:var(--sp-4);                      /* 14px, everywhere, always */
  grid-template-columns:minmax(0,1fr);  /* base = the 1-column stack */
  max-width:var(--content-max); margin:0 auto;
  --tb:0px;                             /* edit-mode toolbar allowance */
}
.pg > .tile{ grid-column:1 / -1; }      /* stacked, DOM order = reading order */

@container pgw (min-width:706px){
  .pg{ grid-template-columns:repeat(6,minmax(0,1fr)); grid-template-rows:var(--tracks); }
  .pg > .tile{ grid-row:var(--r); grid-column:var(--c6) / span var(--n6); }
}
@container pgw (min-width:820px){
  .pg{ grid-template-columns:repeat(12,minmax(0,1fr)); }
  .pg > .tile{ grid-column:var(--c) / span var(--n); }
}

.pg.is-editing{ --tb:42px; }
.pg-gap{ border:1px dashed var(--line); border-radius:var(--r-card); }

.tile{
  display:flex; flex-direction:column;
  background:var(--panel); border:1px solid var(--line); border-radius:var(--r-card);
  padding:16px; min-width:0; overflow:hidden;
  container: tile / inline-size;
}
.tile-head{ display:grid; grid-template-columns:minmax(0,1fr) auto; gap:12px; align-items:end; }
.tile-h{ display:block; font-family:var(--display); font-weight:600; font-size:17px;
         letter-spacing:-.015em; color:var(--ink); margin:5px 0 0; }
.tile-body{ margin-top:var(--sp-5); display:flex; flex-direction:column; min-width:0; }
.tile-foot{ margin-top:auto; padding-top:var(--sp-3); }

/* the page's one accent, §7 */
.tile.is-hero{ background:var(--tint-session);        /* NEW TOKEN — Keeper's call */
               border-color:rgba(95,165,250,.2); border-radius:var(--r-feature); }

/* the tile's own width bands, §4.3 */
@container tile (max-width:200px){
  .tile{ padding:12px; }
  .tile-head{ grid-template-columns:minmax(0,1fr); }
  .tile-h{ font-size:15px; }
}
@container tile (min-width:480px){ .tile-h{ font-size:19px; } }
@container tile (min-width:720px){
  .tl-days,.tl-done{ display:grid; grid-template-columns:1fr 1fr; gap:0 var(--sp-4); }
}

.tile-body.is-pair{ justify-content:space-between; gap:var(--sp-5); }   /* §10 */
```

**Placement is data, so it is inline custom properties, not classes.** The design doc's plan — *"the server emits one class per tile carrying its 12-column span, and the stylesheet maps each class to its 6-column value"* — cannot survive §8.1, because the six-column span is a function of the whole row and no per-tile class can carry it. The server emits five numbers per tile and the track list once on the grid:

```html
<section class="tile is-hero" style="--r:1;--c:1;--n:8;--c6:1;--n6:4">

<div class="pgw"><div class="pg"
  style="--tracks:minmax(calc(340px + var(--tb)),auto) minmax(calc(170px + var(--tb)),auto)
                  minmax(calc(240px + var(--tb)),auto) minmax(calc(120px + var(--tb)),auto)">
```

Four properties of this shape, each load-bearing:

1. **`--tracks` is only read inside the `min-width:706px` block**, so the 1-column stack needs no override and no `!important` — it simply never sees it.
2. **Empty rows are compacted out of `--tracks` and `--r` is renumbered.** Without it, drawing **D** carries 572px of dead track. A zero-height interior track would still cost a double gutter, so dropping the track entirely is the only clean answer.
3. **A sparse row's track is emitted as `auto`** rather than `minmax(…)` (§3's deviation, if the lead takes it).
4. **`--tb` folds the edit-mode toolbar into every row minimum with one class.** Row 4 at 120px minus 32px padding minus a 42px toolbar leaves 46px — less than the 47.75px head. Without the allowance, edit mode pushes a short row's own heading out of its tile.

`grid-column: var(--c) / span var(--n)` substitutes at computed-value time, so an unset or malformed value makes the declaration invalid-at-computed-value-time and the property falls back to `auto` — the tile auto-places rather than disappearing. That is the right failure and deserves a comment in the file. `container-type: inline-size` applies `contain: layout style inline-size`; neither is a hazard here (no counters, no absolutely-positioned descendants), and inline-size containment is exactly what we want — the grid's width comes from its column, never from its contents.

---

## 10. "Looks finished when blank"

**The dishonest answers, named so nobody proposes them in round 2:** reserving three rows of height under `Nothing scheduled.` so the blank tile is the size the full tile will be (a loading skeleton, giving the emptiest tile the most reserved space); hairlines for rows that do not exist; a dashed placeholder in any tile; an illustration; a "Get started" pill (DESIGN-INSPO §5.14 rule 4 allows one action per empty component, but P8's R12 already ruled the pill out for `Nothing waiting.`, and this is the same case).

**The honest one: put the air between the two groups, not below them.**

```
TODAY                                    + Event
Thu 10 Sep

SCHEDULED
Nothing scheduled.

              <- the row's slack lives here

DUE
Nothing due.
```

`.tile-body.is-pair { justify-content: space-between }`. This is `.stat`'s move exactly — `margin-top:auto` on the figure (`components.css:301`), which is how a 132px card holding `0` and a ten-word caption reads as composed rather than as a card that failed to fill. The tile's bottom edge carries content, the air is enclosed on both sides, and when data arrives the groups meet in the middle. **The tile is the same size before and after** — deck §2 constraint 6 in its strongest form.

**Two groups spread; three do not.** Today has two named groups. To-do has three sections and stays top-aligned: three peers spread across 116px of slack reads as a list that has come apart, not a composition. A single list (Next 7 days, Done this week) is top-aligned with the slack below, and the last hairline is the composition's bottom edge.

**The structural half does most of the work.** The reference's answer to a quiet card is not inside the card; it is that the *grid* is airtight. Air inside a container reads as composure; air between containers reads as rubble. So the blank page's job is that every tile fills its cell exactly (`align-items` stays at its initial `stretch` — a tile sitting at its content height is not "sitting exactly on its cells" and is the fastest way to make a bento look broken), the gutter is 14px everywhere without exception, and there is exactly one hole. All three are guaranteed by §2, §6 and §9 rather than by judgement — which is why I would rather solve this with the grid than with the tiles.

**The measured claim, which is the checkable version of "looks finished":**

> With deck §12's real blank data and the default arrangement, the four rows measure **exactly 340 / 170 / 240 / 120** — every row at its weight, none overflowing, none collapsing — and the page is 920 × 912px. The tallest blank tile in each row fills **66% / 96% / 98% / 88%** of it.

Only row 1 is loose, by 115px, and only because it is the tall row waiting for a day that has something in it. One loose row of four, with the slack placed between two groups rather than dumped at the bottom, is a page that looks deliberate. Row 3's 98% depends entirely on §4.4.

---

## 11. Forms and edit mode, as grid problems

**"Forms open in place without moving the grid" is arithmetic, not a wish.** The event form is six fields; one column at 55px each is 330px plus 40px of buttons. Opened inside a 207px blank hero, row 1 grows 340 → ~525 and everything below drops 185px. Two rules make the default case exact:

1. **The form replaces the tile's body**, it does not append to it; `Cancel` restores it. (The Interaction Designer will want the live data kept visible while the form is open; at 141px of tile width there is nowhere to keep it, and a rule that holds only at some spans is not a rule.)
2. **The form is two-column at ≥ 280px of tile width**, in three rows: `Title | Calendar`, `Date | All day`, `Start | End`. 3 × 55 + 2 × 10 + 40 buttons + 14 = 239px, plus 47.75 head plus 32 padding = **319px < 340**. The to-do form is two rows: 2 × 55 + 10 + 54 + 47.75 + 32 = **199px**, comfortably inside the tall row at span 4.

280px rather than the 480 band boundary, because the To-do tile sits at span 4 (297px) in the default and its form has to fit there. Below 280px — spans 2 and 3 — the form is one column and the row grows; unavoidable at 141px, and better stated in the spec than discovered.

**Edit mode: the toolbar goes at the bottom of each tile,** in `.tile-foot` with `margin-top:auto`. Top would push every head down and make the mode's tiles disagree with the same tiles a second earlier. Bottom displaces nothing, sits inside the tile's own border so ownership is unambiguous, and lands on the bottom edge §10 already wants occupied. Its 42px is handled by `--tb` so no row's minimum swallows its own heading. The dashed gap rectangles are the editor's DOM, one per under-filled row, spanning the leftover (§6).

**Where the CSS lives:** a page-scoped `src/styles/personal.css`, imported after `components.css`. That file's header declares two namespaces and no third, with page-specific names carrying the `fl-` prefix; `pg-` / `tile-` / `tl-` is this page's and does not belong in the shared file. What *is* shared — `.eyebrow`, `.btn`, `.tag`, `.fl-headrow`, `.fl-empty`, `.fl-note`, `.fl-absent`, `.fl-bound`, `.fl-fail` — is used unchanged, never copied. The Frontend Architect owns the call; my only requirement is that nothing in `components.css` changes shape for this page, because the Freelance page renders from it.

---

## 12. Acceptance tests

1. **Blank default measures the weights.** Deck §12 data, default arrangement, grid at 920: rows are 340 / 170 / 240 / 120; page 912px tall.
2. **Full default does not invert.** Deck §13 data: rows ≈ 390 / 170 / 260 / 187; row 1 still tallest, row 2 still shortest.
3. **Placement is exact for every legal arrangement.** Tiles on whole columns, no overlap, exactly one 14px gutter between adjacent tiles, leftover trailing. Pin with a unit test over a generated set of legal arrangements, not by eye.
4. **Every row fits at six columns.** `collapseRow` sums to ≤ 6 for every legal row, including `[3,9]`, `[5,7]`, `[3,3,3,3]`, `[2,3,7]`. Unit test.
5. **The narrowest cell is legible.** Each of the six tiles at 1 of 6 on a 706px grid (106px) shows its eyebrow, its state sentence and no horizontal overflow. Mockup specimen.
6. **Forms do not move the grid at the default.** Opening `+ Event` and `+ To-do` leaves every row height unchanged.

---

## Where I expect to disagree

**With the System Keeper.** (a) `--panel` rather than `--raised` for the tile ground — DESIGN-INSPO §2 says cards are `--raised` and he will cite it; my argument is area, and P8's own `--panel` alarm card is the precedent for choosing quiet on a large object. (b) `--tint-session` as a new token — his ruling, but the alternative is a hero with no accent, and §7 argues the accent is what identifies Today once Riku moves it out of row 1. (c) Container queries and the width bands as "new vocabulary the reference does not have" — the reference has no responsive vocabulary at all (§7.1 defers it wholesale), so this fills a gap the reference names rather than deviating from a rule.

**With the Interaction Designer.** On the toolbar at the bottom rather than the top (he will want it beside the header controls); on the form replacing the tile's body rather than opening beneath live data; and most sharply on **`+` being disabled by the six-column rule as well as the twelve** (§8.1) — that makes `2 columns left` occasionally decline the move it promises, and he will rightly call it a lie. I would rather he win that one with a better caption than lose it with a broken grid at six columns.

**With the Honesty Critic.** On the air. He will call the 115px of slack in the blank hero either a reserved space implying content is coming, or — if `space-between` is doing its job — a composition that makes an empty tile look full. The second charge is the serious one and I have no complete answer, only that the same charge lands on `.stat.drained` and P8 accepted it (R2: *"a card that reads 0 most days is not dead weight; 0 is the answer the page exists to give"*). He may also argue that weights holding when blank and failing under load (drawing **B**) is a page that tells the truth only when it is empty.

**With the Frontend Architect.** On inline custom properties for placement rather than the doc's classes (§9); on container queries rather than the doc's viewport breakpoints (§8.3); on `collapseRow` replacing `collapseSpan`; and on server-side row compaction, which puts one more pure function between `readOsSettings` and the render. All four change a ratified design doc and all four are his lane as much as mine.

---

## Questions for the lead

1. **The collapse rule is broken as written.** Any full row with an odd span overflows to 7 or 8 columns at six (`3+9`, `5+7`, `3+3+3+3`), and `validateLayout` accepts all of them. Adopt `collapseRow` on the server (recommended), tighten `validateLayout`, or round down? This changes the design doc and `layout.test.ts`.
2. **The shell has no phone form.** At a 390px viewport the content column is 164px, and there is no `@media` rule in `src/styles/` outside `prefers-reduced-motion`. The deck's primary journey is on the phone. Does P10 ship the rail's collapse — real scope, and Riku's call under S18-1 — or is the 1-column step fully specified and left unreachable until the phone phase? I can design either; I cannot decide it.
3. **Does a sparse row keep its weight?** Deck §5 says the weights are fixed whatever sits in them. A row filled to 4 of 12 at 340px is an empty room (drawing **C**). I propose `auto` below a 6-column fill. Deck deviation, so it is yours.
4. **Row 2's weight is 140px in the design doc; the blank Layers tile is 164px.** Approve 170? And should the other three be re-measured against the mockup before the spec fixes them?
5. **Two inner columns for Next 7 days at ≥ 720px of tile width.** Without it the blank week tile is 318px in a 240px row and the weights are gone on day one. Arguably a content-layout call; I claim it as a grid call because the row weight depends on it.
6. **The hero's accent: the tile's ground tint in `--session` at a 45% stop rather than the shipped 62%, and nothing else on the tile hued.** Approve placement, hue and budget? `--tint-session` is a new token either way.
7. **The empty cell stays at the right edge of row 2, per deck §5's drawing** — or moves interior, at the cost of a `{gap: n}` layout entry, a `validateLayout` clause and an editor that can move a tile past a hole. I recommend keeping the deck's.
8. **Minor, but it will bite someone:** the P10 design doc says the calendar-pin decision *"is recorded as S18 in `ARCHITECTURE.md` §7"*. **S18 is already taken** — it is P8's five calls, at `ARCHITECTURE.md:243`. The next free number is S19.

---

## What I would cut

- **The interior empty cell** and the `{gap: n}` layout entry it needs. A trailing hole reads fine and the model stays two fields wide.
- **`collapseSpan(span, cols)`** as a per-tile function. It cannot be correct; `collapseRow(spans)` replaces it.
- **The 760px and 480px viewport breakpoints.** Replaced by container queries on the grid's own width — right today, right when the shell changes.
- **Any `@supports` duplication of those breakpoints.** Browsers without container queries get the 1-column stack, which is correct.
- **A dashed empty cell in normal view.** Edit mode only, ever.
- **Reserved height inside blank tiles** — no skeleton rows, no phantom hairlines, no minimum row counts. The air goes between the groups (§10) or nowhere.
- **A third and fourth inner-column band.** Two, at one threshold. Three needs a rule nobody can hold in their head while rearranging tiles.
- **Any hue beyond §7's three.** No hued counts, no green on a ticked box, no hue on the `on calendar` tag, no hue on the empty cell, and no accent bar or badge on the hero — Riku's spec rules those out by name.
- **Row weights as literally fixed for under-filled rows** (§3), pending the lead's ruling on the deviation.
- **The claim that P10 ships a working phone layout**, unless question 2 is answered by building the shell's phone form. Specify the stack; do not claim it renders.
