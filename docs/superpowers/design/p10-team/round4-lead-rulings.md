# P10 round 4 — the lead's rulings on the Design Critic's review

**Date:** 2026-09-18 · **Written by:** the design lead, after reading `round4-design-critic.md` (9 M · 15 S · 8 N, every number rendered in Chrome 152 on Windows) in full against `round3-lead-rulings.md` (R1–R37). **Status:** the fix list for the Mockup Builder's single fix pass before Riku reviews the page, and the corrections the visual spec must carry. R-numbers continue from R37. **HEAD:** `ada7491`, `src/` unchanged since `3fa055e`.

**The verdict, accepted.** The design is right and the CSS is production CSS; the mockup is not ready because three of its specimens do not render what their captions say. Every must-fix is mechanical. Two of the critic's findings change rulings (R4's 180, R28's three numbers) and one changes a naming convention (R32's shared block); nothing here reopens a design decision Riku has not yet seen.

---

## Accepted as written — apply exactly as the critic specified

- **M1** `.frame,.pane{box-sizing:content-box}`, pane widths restated as content widths. Every caption that names a frame width states the number the DOM gives for the grid wrapper, and those numbers must be exactly **920 / 706 / 164 / 334**.
- **M2** `container: tile / inline-size` moves from `.pe-tile` to `.pe-cell` (and to the mockup's `.hold` holders); `.pe-tile` loses `container`. Every `@container tile` threshold then measures the tile's border-box width, which is what R2, R6, R11, R13, R15, R28 and R29 name. The `.pe-tile{padding:12px}` rule comes alive as a consequence.
- **M4** Specimen 04's 932px frame: `row full` on all four row-1 toolbars, `+` disabled ×4, `↓` disabled on row 1, `↑` disabled on row 2; Done this week added as a third row so the arrangement is legal.
- **M5** `.tag.is-layer{max-width:calc(11ch + 20px)}` — eleven characters of *name*.
- **M6** `.fl>.pe-edit{margin-top:calc(-1 * var(--sp-4))}` beside the well rule; the sticky wrapper's bottom padding no longer adds to the title→grid distance. **Measured: title→grid is the same number in specimen 01 and specimen 04.**
- **M7** Identical markup in both 390px frames; the caption states how many characters of a dated to-do title survive at 164px — the rendered count, not "about fifteen".
- **M8** The Settings picker's intro sentence is deleted. The card is `Calendar layers` and the list.
- **M9** The hero comparison becomes a 2×2 of the span-8 tiles above a 1×4 of the span-4 tiles, every tile at `min-height:340px` with `.is-pair`, labels in `.spec-cap`'s register; the push tile's five frames are laid out the same way. Nothing on the page needs a sideways drag to compare.
- **S2** `.pe-due{min-width:64px}` at ≥480px of tile width (`.fl-stage`'s 64px is the precedent), so the right-hand cells form a column.
- **S3** `.pe-head>.btn{justify-self:start;white-space:nowrap}`; in the narrow band the pill's padding is `8px 10px`.
- **S4** The confirmation's two pills sit in one group that wraps together, so `Keep` is never orphaned.
- **S5** Every sentence-length caption moves from `.tab` to `.spec-cap`. The closing section gains one `.spec-q` block listing all eleven proposed sentences in plain type, including the two the specimens do not draw (`Today: no layers switched on.`, `Saving…`).
- **S6** `Couldn't load your arrangement, so this is the default.` takes R10's shape with the `--stale` dot. The word `proposed` appears in captions only, never inside a pane.
- **S11** `.pe-sw .nm{flex:1 1 0;min-width:0}` with an ellipsis, so the switch stays inside the content box at 106px.
- **S12** The rail carries a string `watchdog.ts` can produce; the specimen-02 caption says "in the page".
- **S14** `Done, but the calendar entry couldn't be removed…` renders under the head with the `--stale` dot (R49 amends R9's wording).
- **N7** The caption at `:1191` states the ruled fact (R39) instead of proposing it. Captions lose class names, "container query", "content box" and "register"; pixel figures stay where they are the evidence.
- **N8** The stray middots go; picker rows take `min-height:40px` so tick hit boxes do not overlap; the 932px edit frame's hero gets `.is-pair`.

---

## Ruled here

**R38. The narrow band is tile width < 240px, and it is one band.** R6's 200 caught span 2 on twelve columns (141.67px) and 1 of 6 (106px) and missed the two cells the mockup shows need the room: span 3 on twelve (219.5px) and 2 of 6 (226px). The legal cell widths are 106 · 141.67 · 219.5 · 226 · 297.33 · 346 · …, so a boundary at 240 separates the two narrowest spans at each column count from the rest, which is a definition, not a round number. In the band: tile padding `12px`; the form well's padding `var(--sp-3)`; **every row kind with more than two cells takes the two-line form** — the leading cell (time or tick) and the title on line one, the rest (tag · `on calendar` · due meta · `Mon 8`) on line two — because at 226px a to-do title beside `on calendar` and `3 days late` is one letter (S1); the head's pill takes `8px 10px`. R11's 200px for head stacking and the 15px heading **stands** — at 226px the head fits unstacked and a stacked head would cost the tile a line for nothing. R13's 480px for the scheduled row's two-line form stands; the band adds the other rows. So a tile has three inner thresholds — 480 (scheduled row, switch rows, due column), 240 (padding, well, rows, pill), 200 (head) — and the spec lists them once, in one table, against the cells they catch.

**R39. Row 2's weight is 200.** The pixels say 197.85 with R15's 44px switch rows at span 3, and the builder's alternative — dropping the 44px floor to make 180 true — is exactly the cheat R4 forbids: a touch target shrunk to hit a number. 200 keeps "short" short (200 → 240 is a narrower step than 180 → 240 was) and costs one word in deck §5. Specimen 01's rows become **340 · 200 · 240 · 120**; the caption states them.

**R40. The form floor is measured, and it bites only the two narrowest cells.** `<input type="date">` at 16px in `.fld` is **165px** wide in Chrome 152 on Windows (the critic's round-2 96 and the builder's 146 were both computed, both wrong). With the band's padding the well's content box is the tile's width minus 48, so the floor is **≈213px of tile width**: span 3 on twelve (219.5) and 2 of 6 (226) fit; span 2 on twelve (141.67) and 1 of 6 (106) do not and get the disabled pill with `Too narrow for the form.` — the R28 mechanism, now with a true number. The default arrangement's To-do tile therefore keeps `+ To-do` at every window width (M3's 226-under-227 was an artefact of the old padding). **Pairs** need two date fields plus the pair gap, so `Calendar | Date` and `Start | End` pair at **span ≥ 6 on twelve columns and ≥ 4 on six** (≈404–408px, the builder measures and states the exact number; span 5 and 3 of 6 stay one column). One pair threshold for the whole form; the time fields do not get their own. **Three consequences recorded:** (1) the numbers are Chrome-on-Windows, and *What needs Riku's hands* gains one observation — open both forms on his phone at the shell width he chooses and confirm the date field fits — because a floor that is conservative disables a pill where the form would have fit, which is the safe failure, whereas a floor that is generous overflows a well, which is not; (2) `.pe-pair`'s columns are `minmax(min-content,1fr)`, the one recorded exception to R2's `minmax(0,1fr)`, because a native control squeezed under its minimum clips its own text silently and an overflow is at least visible (S13); `.pe-week`'s columns are `minmax(0,1fr)` as R2 says; (3) **on the phone with the rail beside a 164px stack, both pills are disabled — no form can open at all — and with the 44px top strip's 334px column both forms open, one column.** That fact goes into §K item 1's wording (below).

**R41. The tick's hit target is `inset:-13px` on all four sides → 40×40.** The row's `gap:var(--sp-4)` puts the edit button 14px away, so the target stops 1px clear of it. R25's `-6px` right inset gave 33×40 and is struck.

**R42. A vanished calendar is a configuration fact: no dot, and it stays in the picker.** `Classes is no longer on your Google account. Untick it in Settings.` takes `.fl-empty`'s register (13px `--ink-3`, no dot) where that layer's couldn't-read would have sat — the register of R20's `All layers are switched off.`, kind 2 in the Honesty Critic's table, because the state is permanent and the sentence hands over a lever. Not `--stale` (transient, "try again later" — R24 forbids it) and not `--missing` (R9's four places stay four). On the Settings card the vanished layer **remains in the list as a ticked, live row** with the sentence under it in `.fl-note`'s recipe (11px `--ink-3`), so there is something to untick; the build derives the row from the stored `layers` array, not from Google's list, for exactly this case.

**R43. `Up to 10 calendars.` is a press outcome, not a footnote.** It renders in `.pe-said`'s register under the row whose tick was refused, only then. Off the standing card. The mockup does not draw the refusal — the deck has six calendars and inventing five more breaks the no-sample-data rule — so the caption says when the sentence appears and the closing string block lists it.

**R44. Edit mode keeps every tile's contents, controls included.** The `+ Event` / `+ To-do` pills stay in their heads and the switches stay `<button>`s; `.pe-head` and `.pe-body` take `inert` (the foot keeps the live toolbar), and controls inside an inert region render at `.btn:disabled`'s `opacity:.45` — one recipe for "this does not respond right now". R30's four free signals stay four; the dimmed pill is the honest form of "the tiles keep rendering live data", not a fifth signal. Deck §8's "never touches tile contents" is now literally true of the DOM.

**R45. With every layer switched off, the day rows render and `—` is a measurement.** `none-enabled` is decided before any read (R20) and leaves no calendar source to answer, so every source that *could* fill a day — the to-do store — has answered, and R18's condition holds vacuously. `DayRowView`'s `unread` variant is reserved for an *enabled* source that failed. Specimen 03's all-layers-off pane stands as drawn.

**R46. The shared block in `components.css` takes reference-style names with no page prefix, and the picker row is its eighth item.** R25's `.pe-tick` and R27's `.fld` put two conventions in one block; the critic is right that the inconsistency was the rulings'. The block is: `.tick`, `.swx`, `.sq` (the 24px icon button), `.fld`, `.fld-l`, `.sel` (the select with `.sumrow::after`'s chevron), `.formwell` (R27's well), `.pickrow` (the Settings picker's row: tick, name, `min-height:40px`), `.tag.is-layer`, and **`.btn.hi`** — the high rung of P8 R18's ladder as a system class (`border-color:var(--ink-4);color:var(--ink)` at rest, `.btn:hover`'s two values; hover lifts the border to `--ink-3`), replacing the mockup's page-scoped `.pe-hi` because `Save` on the Settings page will want the same rung. None of these is element-shaped; `pe-` stays the Personal page's and nothing else's; there is no third namespace, so `components.css`'s "two namespaces" header line is amended to name the shared-control block rather than a prefix. `.pe-pills`, `.pe-sep`, `.pe-cell.is-gap` stay in `personal.css`, correctly.

**R47. A row never pays for a cell it does not have.** Undated rows and rows without a tag do not emit empty `<span>`s; the row's grid is the leading column plus `minmax(0,1fr)` with `grid-auto-flow:column; grid-auto-columns:auto` (or an equivalent the builder measures), so `Pay tuition`'s tag ends at the row's edge and an undated name at 164px does not lose 28px to nothing.

**R48. §K item 4 gets its picture.** One 1240px frame in specimen 04's section, normal view, two panes: an arrangement with the push tile (span 4) alone in row 1, drawn with R5 (row 1 shrinks to the push's own height) and without it (row 1 held at 340px with bare ground under the tile). Caption in Riku's words: *a row with only a small tile in it — shrink to fit, or keep its full height?*

**R49. R9 item 4 is reworded: "the dot beside a sentence under a tile's head that names a wrong state in another system".** R16 governs place (press outcomes whose control is gone render under the head), R9 governs hue; the sentence's home is under the head and the foot holds meta and the toolbar only.

---

## Not changed

- **The stepper shows the twelve-column span** at six columns (N5) — R1/C10c, accepted with its cost visible.
- **Eight amber dots on the database-down render** (N3) — one per failure sentence, one per tile; R10 applied to deck §11 gives exactly that. One line to Riku.
- **Hero A** — the critic's pick and the ruling agree; the honest lever if Riku wants it louder is the border (`--ink-3`), never the tint. Recorded for §K item 3.
- **The two-column week** — N2's numbers (blank 235 vs 361; busy 328 vs 363) go to Riku with §K item 2; the ruling stands until he answers.
- **R11's 200px** for head stacking (see R38).
- **Native time fields render in the OS locale** (`02:00 pm` beside 24-hour rows) — a fact about native controls, recorded in the spec, not fought.

---

## Corrections to R1–R37 (the Spec Editor's list)

| Ruling | Was | Now |
|---|---|---|
| R4 | row 2 = 180 | **200** (R39); deck §5 "short" stays short |
| R6 | 12px padding below 200px of tile width | below **240px**; the well's padding drops with it (R38) |
| R9 item 4 | "a tile-foot sentence" | "a sentence under a tile's head" (R49) |
| R13 | `.tag.is-layer{max-width:11ch}` | `calc(11ch + 20px)` (M5); due/to-do/done rows two-line in the band (R38); `.pe-due{min-width:64px}` ≥480 (S2); no empty cells (R47) |
| R15 | — | the 44px floor is the reason row 2 is 200; unchanged |
| R2 / R6 / R11 / R13 / R15 / R28 / R29 | thresholds as tile widths, measured on the content box | the container is the cell; every number is the tile's border-box width (M2) |
| R24 | vanished calendar "must not share `try again later`'s register" | `.fl-empty`, no dot; row kept in the picker (R42) |
| R25 | `inset:-13px -6px -13px -13px` | `inset:-13px` (R41); `.pe-tick` → `.tick` (R46) |
| R27 | `.pe-form` | `.formwell`; `.pe-sel` → `.sel` (R46) |
| R28 | pairs ≥280; "nothing moves at the default"; floor ≈96 | pairs at span ≥6 / ≥4 of 6 (≈404–408, measured); the event form grows row 1 to ≈421 and that is the ruled "grows its row when it must"; floor ≈213, bites span 2 and 1 of 6 only (R40) |
| R30 | "nothing shifts" | true only with `.fl>.pe-edit`'s margin rule (M6); tile contents kept and dimmed (R44) |
| R32 | shared controls under `pe-` | reference-style names, eight items plus `.btn.hi` (R46) |
| R18 | — | `none-enabled` counts as answered (R45) |
| §I item 6 | deck §5 | add: row 2 short = 200 |
| §I new | — | *What needs Riku's hands* gains the phone form check (R40) |

---

## For Riku — additions to §K

Plain language, to be folded into the `.spec-q` blocks by the fix pass and into the lead's message:

- **Item 1 (the phone)** gains: *with the menu strip beside the page, the page is too narrow to open the add-event or add-to-do form at all — both buttons are switched off there; with the thin top bar, both forms open.*
- **Item 2 (the week tile)** gains: *on a blank week, two columns keep the third row at 240 against 361 in one column; on a busy week the difference shrinks to 328 against 363, because every full day wraps to two lines in a narrower column. The cadence argument is strongest on the page you have today.*
- **Item 3 (the hero)** gains: *the critic and the lead both pick (a); its mark is quiet on purpose — a brighter border, a lighter ground, rounder corners; if you want it louder the honest step is a brighter border still, not colour.*
- **Item 4 (the small-tile row)** now has a picture (R48).
- **New line:** *when the database is down, each tile reports it separately — eight short amber-dotted sentences on one page for one outage. That is per-tile honesty; it can be reduced to one page-level sentence if you would rather.*
- **New line:** *the second row is 200 pixels tall, not 180 — the three layer switches need 44 pixels each to be tappable — so "short" is a little less short.*

---

## The fix pass — brief for the Mockup Builder (Opus, one pass)

Edit `docs/design/p10-mockup.html` in place. Read this file, then `round4-design-critic.md` in full (it cites line numbers), then `round3-lead-rulings.md` for anything either refers to. Rulings win over the critic's recommendations where they differ (R38 vs S1's 480; R42 vs S7's two options; R43 vs S8; R44 vs S9; R46's exact names).

**Do, in this order:**
1. M1 and M2 first — they change every measurement that follows. Then re-render and re-measure everything before touching a caption.
2. R38 (band at 240: padding, well padding, two-line rows, compact pill), R39, R40 (redraw specimen 06's floor row at the measured numbers — the floor, one width above it, the pair threshold — no derived numbers in captions), R41, R47.
3. M4, M6, M7, M9, S2, S3, S4, S11, N8.
4. R42, R43, R44, R45 (no change), R49/S14, S6, M8, S12.
5. R46 — the renames in CSS and markup; the components-additions block's comment lists the eight items plus `.btn.hi`.
6. R48 — the new frame.
7. Captions last: S5, N7, the `.spec-q` additions above, the closing eleven-string block, every measured number restated from the fixed render.

**Constraints unchanged from round 3:** no JavaScript; the three verbatim groups stay byte-identical to the shipped files (only the marked additions block and the personal group change); no bare `.tile`; `pe-` only in the personal group; no new token; no `--alert`/`--amber`; no `@media` beyond reduced-motion; the product name nowhere; deck strings verbatim; proposed strings marked in captions only; under 600 KB; Riku's ports 3000/3001 never touched; Write/Edit for the file, not heredocs.

**Render it before reporting.** Wrap a scratchpad copy in a document skeleton, serve it on a free port, open it in Chrome, and measure with `getBoundingClientRect()`. **Report back, numbers not claims:** the grid wrapper's width in every frame (must be exactly 920 / 706 / 164 / 334); the tile width at which each of the three inner thresholds first fires; the date field's rendered width, the floor, and the pair threshold; the tick's hit box (must be 40×40); title→grid in specimens 01 and 04 (must be equal); specimen 01's row heights (must be 340 · 200 · 240 · 120) and the B-panel's; specimen 04's 932px frame showing the 2×2 wrap and specimen 05's showing `[2,2,1,1]` with their row heights; the hue count on specimen 01's content column (must be 0); the `diff` result for the three verbatim groups; file size; and any ruling you could not follow and what you did instead.
