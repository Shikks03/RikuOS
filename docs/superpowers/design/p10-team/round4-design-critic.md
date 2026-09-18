# P10 round 4 — Design Critic

**Date:** 2026-09-18 · **Role:** review `docs/design/p10-mockup.html` (HEAD `ada7491`, 239,037 bytes, 3,000 lines) against the round-3 rulings R1–R37, the mockup brief, the content deck, `DESIGN-INSPO.md` §2–§3/§5, `components.html` and the four shipped stylesheets, before Riku sees it.
**Standing question:** what would a senior designer reject?
**Reviewed:** the file wrapped in a document skeleton and served from the scratchpad, opened in Chrome 152 (Windows, device-pixel ratio 1.25, standards mode, all three faces confirmed loaded via `document.fonts.check`). Every specimen screenshotted; every number below marked **rendered** was read back from `getBoundingClientRect()` / `getComputedStyle()` on that page. Where I widened a frame to see what it *would* render, I say so and the change was in the live DOM only. Nothing in `docs/` was edited. Numbers marked **computed** come from the CSS. The three verbatim CSS groups were diffed with `diff`, not read.

---

## 1. Verdict

The design is right and the CSS is honest production CSS — the row grammar, the hero's structural mark, the four hue placements, the push quotation, the switch rows and the forms all land, and on the page Riku will see first (deck §12) there is exactly zero hue in the content column. But the mockup is **not ready for Riku**, for one reason that dwarfs the rest: **the three specimens that exist to show the six-column grid never render six columns.** The `.frame` and `.pane` boxes carry a 1px border inside their stated width, so a "932px frame" gives the grid wrapper 704.4px — 1.6px under the 706px threshold — and specimens 04 (the narrowest cell) and 05 (both frames) render as one-column phone stacks under captions that say "six columns", "`2, 2, 1, 1`" and "wraps two by two". Nobody rendered them. Underneath that, the tile's container queries measure the tile's *content* box, so every threshold in the personal group fires 34px later than the ruled number and the 12px narrow-band padding never fires at all; the date field's true intrinsic width is 165px, not 146, which puts the form floor at ≈227px — one pixel above the default arrangement's To-do tile at six columns; the layer tags truncate Riku's own calendar names on the default page; and opening edit mode moves the grid 24px. Nine must-fixes, all mechanical, none of which changes a design decision — but until they land the mockup makes claims the pixels contradict, and he would find the first of them in under a minute.

---

## 2. Must fix before Riku sees it

### M1 — The six-column specimens render as one-column stacks

**What is wrong.** `.frame{border:1px solid var(--line)}` (`p10-mockup.html:1088–1091`) with `*{box-sizing:border-box}` means `.f932{width:932px}` (`:1093`) has 930px inside. Minus the 170px rail and 56px of `.app-content` padding, the `pgw` wrapper measures **704.4px rendered** (the 1px border paints at 0.8px at DPR 1.25; at DPR 1 it is 704.0). `@container pgw (min-width:706px)` (`:738`) does not fire. The same arithmetic hits `.pane.p706{width:746px}` (`:1103`): 746 − 2 − 40 = 704.4. So:

- specimen 04's "narrowest cell edit mode can produce" frame (`:2083`) — **1 column**, 1,538px tall, every tile 704px wide, the toolbar on one line;
- specimen 05's "Twelve columns to six" frame (`:2222`) — **1 column**, 1,824px tall, Today above To-do;
- specimen 05's `[3,3,3,3] → [2,2,1,1]` pane (`:2321`) — **1 column**, four full-width tiles.

The captions at `:2081`, `:2219` and `:2319` describe six columns, a 2×2 arrow wrap and the trim. None of it is on screen. The 390px frames lose the same 2px: the "164px" column renders **162.4** and the "334px" column **332.4** (`:2809` states 164 and 334).

**Fails.** R2 (the six-column step), R29 (the 2×2 wrap, "specimen 04 includes one tile at 1 of 6"), R1 (the trim "specimen 05 draws it"), §J items 4–5.

**Fix.** Make the frame's border sit outside the stated width: `.frame,.pane{box-sizing:content-box}` and restate the pane widths as content (`.p920{width:920px}` etc., padding stays 20px). Then assert in the caption the number the DOM gives: the wrapper must measure exactly 920 / 706 / 164 / 334.

**Once fixed (rendered with the frames widened 2px in the live DOM):** specimen 04's row 1 is 430.65px at six columns and the arrows wrap 2×2 (52×52) on both 106px tiles; specimen 05's default reads 506.65 · 197.85 · 361.15 · 209.55 with §13's data. Both are honest; caption them with those numbers.

---

### M2 — Every `@container tile` threshold fires 34px late, and the narrow-band padding never fires

**What is wrong.** `container:tile / inline-size` sits on `.pe-tile` (`:780`), which carries `padding:15px 16px` and a 1px border. Container size queries resolve against the container's **content box**, so `(max-width:199.98px)` (`:985`) means *tile border-box ≤ 233px*, `(max-width:479.98px)` (`:995`) means *≤ 513px*, `(max-width:145.98px)` (`:1007`) means *≤ 179px*, `(min-width:368px)` (`:1017`) means *≥ 402px*, and `(min-width:720px)` (`:1022`) means *≥ 754px*. **Rendered:** the head stacks at a 233px holder and not at 234; the form pairs appear at 402px and not at 400; the 368px specimen (`:2606`, captioned "two date fields fit side by side") renders **one column**.

Worse, inside the narrow band the rule `.pe-tile{padding:12px}` (`:986`) targets the container itself. A container query cannot match the element that is the container — the builder's own comment at `:715–716` says so for `pgw` — so the rule is dead. **Rendered:** every 106px tile has `padding:15px 16px`, so the "80px of inner width" the captions repeat (`:2081`, `:2351`) is **72.4px**, and R6's narrow band does not exist in the pixels.

**Fails.** R6 (12px below 200px of tile width), R2 ("every control is measured at 1 of 6 … 106px tile, 80px of inner width"), R11, R13, R15, R28, R29 as numbered.

**Fix.** Move the container to the padding-less wrapper: `.pe-cell{container:tile / inline-size}` and drop `container` from `.pe-tile` (the mockup's lone `.hold` holders take the same declaration). Then the queries measure the width the rulings name **and** `.pe-tile{padding:12px}` fires, because `.pe-tile` is now a descendant. Re-measure every number in §5 of this file after that one change.

---

### M3 — The control floor is drawn at a width where the form does not fit, and the real floor bites the default arrangement

**What is wrong.** The caption at `:2560` derives the date field at "124px of content box, 146px once the field's own padding and border are added" and places the floor at 210px. **Rendered, `<input type="date" class="fld">` in this Chrome:** `width:auto` / `min-content` / `max-content` all give **164.8px** border-box (165.0 at DPR 1); `<input type="time">` 129.2px. In a `1fr 1fr` pair the date column will not go below 164.8.

So in the 210px frame (`:2592`) the well has 148px of content and the field is 164.8: **rendered, every field's right edge (750.4) is 3.2px outside the well's border (747.2)** — the well's border is drawn through Title, Section and Due (visible in the screenshot). The one-column floor is 165 + 28 (well) + 34 (tile) = **≈227px**, or **≈219px** once M2's 12px band fires. Two date fields need 2×165 + 12 = 342px of well content → **≈404px of tile width** (rendered: the pair query fires at 402 but the date column reaches 164.8 only at 404).

The consequence the lead must weigh: **at six columns the default arrangement's To-do tile is 2 of 6 = 226px, one pixel under the floor.** As drawn, `+ To-do` is disabled on the default page at every window between 932 and 1045px. With the 12px band at 226 it fits (226 − 26 − 28 = 172 ≥ 165); span 3 of 12 (219.5px) fits by 0.5px. Both need the band to start above 226, not below 200.

**Fails.** R28 (the floor "measured in the mockup against the native date field's intrinsic minimum" — it was computed, and computed wrong), the captions at `:2560`, `:2592`, `:2606`.

**Fix.** Redraw the floor row at 219 / 227 / 404 with the field measured in the caption, not derived; state that the number is Chrome-on-Windows and must be re-measured on Riku's phone; and put the 226px consequence to the lead as a ruling (see §5, R28).

---

### M4 — Specimen 04's six-column frame carries the wrong disabled states and captions

**What is wrong.** Row 1 of the 932px frame is four tiles at `pe-s3` (`:2111`, `:2129`, `:2148`, `:2167`) — 3+3+3+3 = 12, a full row — yet every toolbar reads **`3 columns left`** (`:2125`, `:2144`, `:2163`, `:2178`) and every `+` is enabled (`:2124`, `:2143`, `:2162`, `:2177`). Row 2 is Next 7 days at 12, also full, yet Layers' and the push's `↓` are enabled (`:2160`, `:2175`) and Next 7 days' `↑` is enabled (`:2197`). Under R31 all of those are disabled and the caption is `row full`. The frame also holds five tiles, not six — Done this week is absent — so it is not a legal arrangement. The 1240px edit frame (`:1827–1947`) gets every state right; this one contradicts it on the same page.

**Fails.** R31, deck §8 (`+` disabled when the row is full; `row full`).

**Fix.** `row full`, `+` disabled ×4, `↓` disabled on row 1, `↑` disabled on row 2; add Done this week as a third row (`--tracks` gains `minmax(calc(120px + var(--tb)),auto)`).

---

### M5 — Layer tags truncate Riku's own calendar names on the default page

**What is wrong.** `.tag.is-layer{max-width:11ch}` (`:703`) on a `.tag` that carries `padding:5px 10px` under `box-sizing:border-box`. **Rendered:** `1ch` at 10px JetBrains Mono is 6px, so the box is 66px and the content box is 44px — 7.3 characters. `Classes` needs 44.8px (7 × 6 + 7 × 0.4 tracking) and `Personal` 51.2px. Both truncate: specimen 02 shows **`Classe…`** and **`Person…`** on all three scheduled rows (`:1470–1472`), and the same at 4 of 6 in specimen 05. Two of Riku's three real layers are unreadable in the one place the deck says the layer's name is shown.

**Fails.** R13 (`max-width:11ch` was meant as eleven characters of name), deck §6 Tile 1 ("then the layer's name as a tag").

**Fix.** `max-width:calc(11ch + 20px)` (86px). `Holidays in Philippines` then truncates at ~10 characters, which is the intended behaviour.

---

### M6 — Opening edit mode moves the grid 24px

**What is wrong.** `.pe-edit{margin:calc(-1 * var(--sp-4))}` (`:772`) is meant to cancel its own 14px padding. But `.pe-edit` is the first child of `.fl`, and the shipped `.fl>:first-child{margin-top:0}` (`:234`, specificity 0,2,0) beats `.pe-edit` (0,1,0). **Rendered computed margin: `0px -14px -14px`.** Add `.pe-sticky{padding-bottom:var(--sp-3)}` (`:967`) and the title-to-grid distance is **28px in specimen 01 and 52px in specimen 04** — the grid drops 24px the moment the mode opens. The caption at `:1795` says "nothing on the page moves when the mode opens".

**Fails.** R30 ("compensating margin … so nothing shifts").

**Fix.** `.fl>.pe-edit{margin-top:calc(-1 * var(--sp-4))}` beside the well rule, and either drop the sticky wrapper's bottom padding or subtract it from `.app-content`'s top padding in edit mode. Re-measure: title→grid must be 28px in both frames.

---

### M7 — The 164px phone frame is thinned to fit

**What is wrong.** The two 390px frames claim to draw the same page two ways. They do not. The rail frame drops the section tags from Today's DUE rows (`:2839–2840` `<span></span>` vs `:2918–2919` `<span class="tag">`), drops `on calendar` from Send invoice (`:2852` vs `:2931`), drops Reviewer ch.3 from Tue 20 (`:2875` vs `:2954`), and drops the tags from both Done rows (`:2887–2888` vs `:2966–2967`). **Rendered: 0 tags / 0 `on calendar` in the rail frame's Today, To-do and Done tiles; 4 / 1 / 2 in the bar frame.** The frame whose whole job is to show Riku the cost honestly is the one that was tidied. Even thinned, **rendered:** `Send invoice` gets 10px of name (`3 days late` takes 63), `Renew ID` 39px, `Reviewer ch.3` 27px — the caption's "about fifteen characters" (`:2809`) is generous by a factor of ten on any dated row.

**Fails.** R7 ("draws that stack honestly"), §J item 8.

**Fix.** Same markup in both frames; caption the real number (a dated to-do row shows one to four characters of title at 162px).

---

### M8 — One invented sentence on the Settings page

**What is wrong.** `Every calendar on your Google account. Ticked calendars become layers on the Personal page.` (`:2759`) is not in deck §9 — the deck's line is the author's description of the card, not a string — and it is not one of the eleven proposed strings, and it is not marked proposed. It is the only visible string in any app frame that fails the rule (full audit in §9). It also names "the Personal page" from a page that is not it.

**Fix.** Delete it, or propose it and mark it. The card reads correctly without it: `Calendar layers`, the list, done.

---

### M9 — The hero comparison cannot be seen, and is drawn at the wrong height

**What is wrong.** The eight hero variants sit in one `.pair` at `width:max-content` (`:1304`): **rendered 3,820px wide in a 1,143px scroll box.** A and half of B are visible; C, D and all four span-4 tiles need a sideways drag, so Riku cannot put A beside D on the specimen that asks him §K item 3. The tiles are also lone `.hold`s without `.is-pair` at natural height — **rendered 213.4px** — while on the page the hero is 340px with `space-between`; he would judge a ground and a border at a density the page never has. And the labels (`A · AS RULED · SPAN 8`) are `.tab`: 8.5px uppercase mono at `--ink-4`.

**Fix.** A 2×2 of the span-8 tiles (2 × 609 + 28 = 1,246px fits the document column) above a 1×4 of the span-4 tiles (1,273px), all at `min-height:340px` with `.is-pair`, labels in `.spec-cap`'s register. Same for the push tile's five frames (`:1745`, rendered 3,155px).

---

## 3. Should fix

### S1 — The to-do row has no narrow form, so at 2 of 6 a title becomes one letter
**Rendered, specimen 05 default at six columns (frame widened):** To-do at 226px; `Send invoice` beside `on calendar` and `3 days late` gets **15.9px** — `S…`. R13 gives the *scheduled* row a two-line form below 480px and the to-do row none, so `.pe-edit-row{grid-template-columns:minmax(0,1fr) auto auto}` (`:873`) squeezes the name last. Recommend the same two-line form for `.is-todo`: name on line one, `on calendar` · due on line two. Separately, the empty `<span>`s in undated rows still cost two 14px gaps — **rendered at 920px** Pay tuition's tag ends 14px short of the row edge; at 162px an undated name loses 28px to nothing. Do not emit empty cells; `grid-template-columns:minmax(0,1fr); grid-auto-flow:column; grid-auto-columns:auto` stops paying for them.

### S2 — Right-hand cells do not form columns
**Rendered, specimen 02 hero DUE:** Pay tuition's tag starts at x=779, Send invoice's at 709; rows with a tag are 47.1px, rows without 41.5px. Each row is its own grid, so `auto auto` never aligns across rows. A `min-width` on `.pe-due` (the shipped `.fl-stage`'s 64px is the precedent) above 480px of tile width would align the tags in the hero and the To-do tile without touching narrow widths.

### S3 — In the narrow band the pill stretches to the tile's full width, and at 106px it wraps
`.pe-head{grid-template-columns:minmax(0,1fr)}` (`:987`) blockifies the `.btn` and `justify-items` stretches it: **rendered `+ To-do` is 176.4px wide at 210px and 108.4px at 142px** — a bar, not a pill. At 106px the label wraps to two lines (`+ TO-` / `DO`, rendered pill height 3.3 lines). Add `.pe-head>.btn{justify-self:start;white-space:nowrap}` and, in the narrow band, `padding:8px 10px` so `+ TO-DO` (≈70px) fits 72px.

### S4 — The delete confirmation splits its pair at span 4
**Rendered:** `Delete "Renew ID"?` + `Delete` on line one, `Keep` alone on line two (`:2519–2523`; the question is 145px, the two pills 150px, the well 263px). The destructive pill sits beside the question and the safe one is orphaned. Wrap the two pills in a group with `flex:none;margin-left:auto` so they wrap together, or give `.pe-q` `flex-basis:100%` below 480px.

### S5 — Sentences to Riku are set in the machine-label register
`.tab` (`:1104–1108`) is 8.5px uppercase mono at `--ink-4` — right for `A · SPAN 8`, wrong for the paragraphs it is used on at `:2449`, `:2556`, `:2634`, `:2665`, `:2683`, `:2695`, `:2706`, `:2798`. Those paragraphs are where **the proposed strings are marked**, so `Couldn't tell if that saved.` reaches him as `COULDN'T TELL IF THAT SAVED.` at 1.75:1. Move every sentence-length caption to `.spec-cap`, and add one `.spec-q` block in the closing section listing all eleven proposed sentences in plain type — there is no consolidated list now, and §K item 6 is a list.

### S6 — `Couldn't load your arrangement…` has no dot, and the word `proposed` sits inside the app pane
`:1657` renders the settings-read failure in `.pe-said` (11px `--ink-3`, no dot) at the top of a page whose other eight failed reads all carry the `--stale` dot — R10 says every couldn't-read takes the shape. And `<b class="prop">proposed</b>` is inside the `.pane`, so a word that will never be on the page is drawn on it. Dot it (`.pe-fail`), and move the marker to the caption.

### S7 — The vanished-calendar sentence takes the register R24 says it must not share
`Classes is no longer on your Google account. Untick it in Settings.` (`:2796`) is `.pe-fail` with the amber dot — the transient couldn't-read shape, on a state R24 defines as the one that "never clears on its own". Either no dot (a configuration fact with a lever, like R20's `All layers are switched off.`) or `--missing` (a conflict between a stored layer and Google — the hue's literal meaning) — the lead rules; amber is the one wrong answer. Also: drawn *on the Settings card*, "Untick it in Settings" points at a row that is not in the list — the vanished layer must remain in the picker as a ticked row with the sentence under it, or there is nothing to untick.

### S8 — `Up to 10 calendars.` is shown where it cannot be true
Deck §9: "an eleventh tick says `Up to 10 calendars.`" — a response to a refused tick. `:2768` prints it as a standing footnote under six calendars. The brief asked for the string; the deck's state cannot occur here. Show it as `.pe-said` under a refused row in a frame with eleven calendars, or leave the string in the audit table and off the card.

### S9 — Edit mode changes the tiles' contents
The `+ Event` / `+ To-do` pills are removed from the heads (`:1828`, `:1848`, `:1987`) and the switch `<button>`s become `<span>`s (`:1871–1873`, `:2007–2009`). R30 makes bodies `inert`; deck §8 says the editor "never touches tile contents". A dimmed, inert pill is honest; a vanished one changes the head's shape on entry. Keep the markup, extend `inert` to the head's control, and let the build keep buttons.

### S10 — Namespace: an unruled seventh item and two conventions in one block
`.pe-pick` / `.pe-pickrow` (`:692–697`) are not among R32's six controls plus `.tag.is-layer`; they are the Settings page's row grammar, in `components.css`, under the `pe-` prefix R32 reserves for the Personal page. The block also mixes prefixed (`.pe-tick`, `.pe-sq`, `.pe-form`, `.pe-sel`) and unprefixed (`.swx`, `.fld`, `.fld-l`) names — R25 wrote `.pe-tick` and R27 wrote `.fld`, so the inconsistency is the rulings'. Recommend one convention for the shared block — reference-style names with no page prefix and none element-shaped (`.tick`, `.sq`, `.fld`, `.fld-l`, `.swx`, `.formwell`, `.pickrow`) — and rule the picker row in as the eighth item. `.pe-hi` (`:977`) is correctly page-scoped and needed: `Save` cannot take `.btn.go` (unspent) or bare `button` (legacy.css expires). But the high step of P8 R18's ladder is a system rung; `.btn.hi` in `components.css` would serve Settings' own `Save` later.

### S11 — At 106px the switches sit in the padding
**Rendered:** `.swx` right edge at 666.8 against a content-box edge of 655.2 — the knob is 11.6px into the 16px padding, 5px from the border, while the name keeps its full 16px on the left. The `<button>` flex container is not shrinking `.nm` (rendered `Personal` at its full 49px, not truncated). Give `.pe-sw .nm{flex:1 1 0}` explicitly; then the name ellipsises and the switch stays inside the content box.

### S12 — Two false claims in the shell
`1 site failed` (`:1454`) is not a caption the rail can render — `watchdog.ts:290` builds `N item(s) failed`. And the caption at `:1440` says "Two things carry colour and nothing else does" of a frame whose rail shows a red `SITE-HEALTH`. Say "in the page".

### S13 — Bare `1fr` twice
`.pe-pair{grid-template-columns:1fr 1fr}` (`:1018`) and `.pe-week{grid-template-columns:1fr 1fr}` (`:1024`) — R2's rule is `minmax(0,1fr)` never bare. In `.pe-pair` the bare `1fr`'s `auto` minimum is exactly what lets the date column exceed half the well (M3); `minmax(0,1fr)` would instead clip the date field, which is worse — so this one is a ruling to record, not a tidy: the pair's columns are `minmax(min-content,1fr)` on purpose.

### S14 — The "Done, but…" sentence: R9 and R16 disagree and the mockup picked one
`:2675` puts `Done, but the calendar entry couldn't be removed…` in `.pe-foot` with the amber dot. R9 item 4 calls it "a tile-foot sentence"; R16 says the foot holds meta and the toolbar, "nothing else", and press outcomes whose control is gone "render in a `.pe-said` line directly under the head". Recommend under the head, with the dot — R9 governs hue, R16 governs place — and amend R9's wording.

### S15 — The all-layers-off week prints dashes under a reason sentence
`:1729–1737`: `All layers are switched off.` then seven `—`. R18: `—` only when every source answered, "otherwise the value column is blank ground under the tile's reason sentence". The caption argues the calendar was not asked so the to-do store's answer suffices. Defensible, but it is the builder ruling; the lead should say whether `none-enabled` counts as answered.

---

## 4. Notes

**N1 — The builder's heights hold.** Rendered here: specimen 01 rows **340 · 197.85 · 240 · 120** (grid 939.85); B-panel **340 · 197.85 · 365 · 120** (1064.85); tiles Today 213.35, To-do 270.85, Layers 197.85, push 112.35, week 234.25 (two columns) / 361.15 (one), Done 51.1. Every figure is 0.4px under the builder's — line-height rounding on a different machine, not a disagreement.

**N2 — The two-column week's advantage mostly evaporates when the week is busy.** Rendered, specimen 02: row 3 is **328.25px** because at a 436px column every populated day wraps to two lines (items 43px). One column with the same data would be ≈363 (computed: seven single-line rows). Blank, the gap is 235 vs 361; busy, 328 vs 363. Worth one sentence when §K item 2 is put to Riku: the cadence argument is strongest on the page he has today.

**N3 — Eight amber dots is what the deck produces.** Rendered on the database-down pane: 8 `--stale` dots, `Couldn't load to-dos.` four times for one cause. R10 applied to deck §11 gives exactly that; the brief's "four" was wrong. One line to Riku that a single outage is reported once per tile is worth it.

**N4 — Not drawn:** `Today: no layers switched on.` and `Saving…` (two of the eleven proposed strings), `+3 more` (`.pe-more` declared, unused), and the sparse-row `auto` (§K item 4 is asked with no picture). None was required by §J; the first two should be listed in S5's block.

**N5 — The stepper shows the twelve-column span** (`3` on a tile visibly 1 of 6). Accepted under R1/C10c; the mockup is where its cost first shows.

**N6 — Hue audit, mechanical.** Specimen 01 content column: **0** hued elements (the green badges and the brand tile are the rail's). Specimen 02: `3 days late` ×2 only. Specimen 03: 13 `--stale` dots (3 + 2 + 8), 1 `--missing`. Specimen 06: 1 `--stale` (S14). Specimen 07: two shipped `button.danger`, 1 `--stale` (S7). No `--alert`/`--amber`, no `::selection` hue. R9 held everywhere except S6 (a dot missing) and S7 (a dot wrong).

**N7 — Language.** The seven `.spec-q` blocks are clean — no class, token or R-number. The captions carry one class name (`.fld`, `:2560`), "container query", "content box", "register" and 22 pixel figures; and `:1191` tells Riku "the weight should become 200", the builder proposing a ruling before the lead has made it.

**N8 — Small things.** Native time fields render `02:00 pm` (locale) while rows use 24-hour; stray leading middots in two tab labels (`:1776`, `:2426`); the 40px tick hit box overlaps the 35px picker rows by 2.5px each side; the 932px edit frame's hero lacks `.is-pair` (`:2113`); `<h3 class="fl-title">` where the shell ships `<h1>` — build-time only; at 142px the arrows wrap although 108px fits 108px (the content-box quirk, M2).

---

## 5. Rulings the mockup proved wrong

**R4 — row 2 = 180.** Claimed: weights 340 / 180 / 240 / 120 as minimums, row 2 raised to 180 because the blank Layers tile "measures ≈172px". Pixels: **197.85**, because R15's 44px switch rows fire at span 3 (219.5px) and three of them are 132px, not 104. The builder's suggestion to drop the floor to <200px tile width would make 180 true by shrinking a touch target — R4's own words, "a build never … clips to hit a number", cover it, and an iPad in landscape puts Layers at 226px with a finger. **Rule: weight 200.** It costs one word in deck §5 (short stays short; 200 vs 240 is a narrower step than 180 vs 240).

**R15 — the 44px floor.** Not wrong, but it collides with R4 and the collision was not noticed. Also note the floor now fires on content width ≤ 480 (tile ≤ 514) until M2 lands.

**R25 — hit target ≥ 40×40 with `inset:-13px -6px -13px -13px`.** Pixels: **33×40**. The tick sits 14px from the edit button (`.pe-row{gap:var(--sp-4)}`), so `inset:-13px` on all four sides gives **40×40** and stops 1px short of the edit button. Rule that.

**R28 — pairs at ≥280, "nothing moves", the floor.** Three claims, three misses. *Pairs:* two native date fields need 2 × 165 + 12 = 342px of well content → **≈404px of tile width**; the to-do form at span 4 (297px) is one column, correctly. *Nothing moves:* the well is 322px, the hero **421.4px rendered** — row 1 grows 340 → 421; "≈321px inside 340" compared the well to the row. *The floor:* the critic's round-2 ≈96px and the builder's 146px are both wrong; the field is **165px**, the floor **≈227px** (≈219 with the band), **above the default's To-do tile at six columns (226px)**. Rule one of: the narrow band starts at 240px so 226 gets 12px padding and the form fits; the well's padding drops in narrow tiles; or the default loses `+ To-do` between 932 and 1045px and the spec says so. Record that the number is Chrome/Windows and is re-measured on the phone.

**R2 / R6 / R11 / R13 / R29 — every tile threshold.** As written they name border-box tile widths; as built they fire on the content box, 34px later (M2). Either the container moves to the cell (recommended — it also revives R6's padding rule) or every number in the rulings is restated as inner width. Not both.

**R9 item 4 vs R16** — the same sentence is placed in the foot by one and under the head by the other (S14).

**R24 vs R10** — a vanished calendar "must not share `try again later`'s register", and the only register the mockup has for a sentence with a dot is that one (S7).

**R32 / R25 / R27** — the shared block cannot be both `pe-` and not (S10).

**R31** is not wrong; specimen 04's six-column frame simply did not apply it (M4).

---

## 6. The builder's report, checked

| Claim | Verdict |
|---|---|
| Row 2 renders 198.25 not 180; R15's floor fires at span 3 | **True** (197.85 rendered) |
| Weight 200, or drop the floor below 200px | **200; dropping the floor is R4's "cheat"** (§5) |
| R28's 280 is wrong; date field ≈146px; pairs ≥368; floor ≈210 | **Half right.** 280 is wrong, but the field is **164.8px** rendered, pairs need **≈404**, the floor is **≈227**; the 210 frame overflows its well, the 368 frame is one column (M3) |
| Event form: hero ≈420, row 1 340→420 | **True** (421.4 rendered) |
| Deck §11 corrected: eight amber dots | **True**, and eight is what R10 + §11 produce (rendered 8) |
| Tick hit target 33×40 | **True**; `inset:-13px` gives 40×40 clear of the edit button |
| Rows 340·198.25·240·120 (940.25); B-panel 340·198.25·365·120 | **True to 0.4px** |
| Zero coloured things on specimen 01 | **True** (rendered audit: 0 in the content column) |
| Shipped CSS byte-identical in three groups | **True** — `diff` of `:18–58`/`tokens.css:31–71`, `:65–90`/`base.css:10–35`, `:100–580`/`components.css:33–513` |
| No bare `.tile`; 7 `@container` blocks | **True** (grep) |
| Frames exercise real container queries at 920 / 706 / 164 | **False for 706 and 164** — wrappers measure 704.4 and 162.4 (M1) |
| "80px of inner width" at 1 of 6; toolbar 2×2; `[2,2,1,1]` drawn | **False as shipped** — 72.4px, the band is dead (M2); the wrap and trim appear only with the frames widened 2px (M1) |
| `.pe-hi`, `.pe-pills`/`.pe-sep`, `.pe-cell.is-gap` in the personal group | **Correct** — page-only |
| `.pe-pick`/`.pe-pickrow` as a 7th components item | **Unruled; `pe-` on `/settings` is the wrong prefix** (S10) |
| `legacy.css` under `:where(.legacy-doc)` | **Correct** — zero specificity, verbatim, mockup-only (`:1138–1174`) |
| R2, R4–R6, R8–R17, R25–R30 honoured | In the CSS and the 1240px frames, except R6 (dead band), R13 (M5), R25, R28 (M3), R30 (M6), R31 in one frame (M4), R7 (M7), R10 (S6), R9/R16 (S14), R24 (S7), R18 (S15) |

---

## 7. The blank week, judged

**Rendered, specimen 01 at 1240px.** It looks finished — more so than the round-2 arithmetic predicted — for the reasons R17 named: the grid is airtight, every tile fills its cell, the one hole in row 2 is bare ground and reads as the bento's deliberate gap, seven day rows in two columns give row 3 real structure, three switches show real state, the push quotes a real message under a real stamp. The five group labels at `--ink-3` are the page's visible skeleton and read as structure, not as absent text; C4 was right and R12 delivered it.

**The hero.** A is the hero at a glance with zero hue, and the mark is carried almost entirely by the `--ink-4` border — the 1.06:1 ground lift and the 14px radius are there but you find them only when you look. `space-between` reads as deliberate: `SCHEDULED / Nothing scheduled.` at the top, `DUE / Nothing due.` on the bottom edge, 127px of enclosed air between two findings — a day with two things to say and nothing under either, not a tile that failed to fill. Two things to watch: at span 4 the same 127px in a 297px-wide tile is squarer and slightly less composed; and Done this week at 120px holding one 51px line is the tile that most looks like a page waiting for data — the deck's render, ruled in R11, and the tile Riku's eye lands on last.

**Four ways.** *B* (no mark) makes the To-do tile and the hero identical objects; the page has no focal point and the rail is its brightest thing — C1's warning, visible. *C* is, in the pixels, B with a 5.9% ground lift; the hairline vanishes against its own border, as C1 computed. *D* is the only variant that reads instantly, and it reads as "this tile has something", which on `Nothing scheduled.` is the lie §5.14 rule 2 forbids. **I would pick A**, and tell Riku its mark is quiet by design; if he wants it louder the honest lever is the border (`--ink-3` next), not the tint.

---

## 8. The narrowest cell — 106px, 72.4px inner (rendered; 80px once M2 lands)

Everything is legible; three things are wrong. **Eyebrow:** `TODAY`, `TO-DO`, `LAYERS` one line; `DONE THIS WEEK` two; `THIS MORNING'S PUSH` three. **Heading:** `Thu 10 Sep` at 15px, two lines. **Group labels:** one line. **State sentences:** `Nothing scheduled.` two lines, `Couldn't read the calendar.` three with the dot beside line one, `Nothing ticked off yet this week.` four. **Tick row:** 14 + 14 leaves 44px for a name before any meta — `collapseRow` can put a to-do tile here, and S1's two-line form is the answer. **Switch row:** 44px, the knob 11.6px into the padding (S11). **Square buttons:** 24×24, arrows 2×2 at 52px, the stepper on its own line, `3 columns left` wrapping to two (`row full` fits). **The pill:** stretched to 72px and wrapped (S3). Nothing is clipped; the tile grows, which is the ruled behaviour.

---

## 9. String audit

Every text node inside every `.frame`, `.pane` and `.hold` was extracted mechanically (172 distinct strings). **Deck strings: all present, none misquoted** — the curly quotes in `Delete "Renew ID"?`, the en-dashes in `07:00–08:50`, the full §13 push body, and every Settings string against `settings/page.tsx:73–131` are exact. **Proposed strings:** all eleven appear and are marked except `Today: no layers switched on.` and `Saving…`, which are not drawn. **Neither deck nor proposed:** the Settings picker's intro sentence (M8); `1 site failed` (S12); the word `proposed` inside a pane (S6). `read 07:04` / `07:12`, `Agents`, the six agent names and `Log out` are P8's shell. **The product name appears nowhere** (grep: 0).
