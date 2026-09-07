# P8 round 4 — Design Critic

**Date:** 2026-09-06 · **Role:** review `docs/design/p8-mockup.html` against the round-3 rulings, `DESIGN-INSPO.md` §6, the content deck §9, and `components.html`, before Riku sees it.
**Standing question:** what would a senior designer reject?
**Reviewed:** the published Artifact (loads, fonts resolve) and the same file served locally at 1560×1180 so the 1240px frames sit uncut. Every specimen screenshotted; both disclosures clicked open and closed.

---

## 1. Verdict

This is a good mockup — the shell, the row grammar, the health strip's two forms and the queue re-skin all land, and the CSS is honest production CSS rather than a drawing. But it is **not ready as-is**: one table is structurally broken in both specimens that show it, the page's three loudest figures do not share a baseline, and the mockup's own claim that "not reported is distinct from a measured zero" is false in the pixels — three defects that a competent owner will spot in the first thirty seconds and that will make him distrust the rest. Fix the five must-fixes below and it is ready; none of them requires a ruling to move.

---

## 2. Must fix before Riku sees it

### M1 — Block C's table drops its last column onto a second line

**What is wrong.** The campaigns table renders `REPLIED` as an orphan on a row of its own, and every campaign's reply count (`11`, `7`, `2`; `2`, `0` in specimen 01) sits alone under the campaign name. The row hairline is drawn under the orphan, so each row is double height. This is the most-broken thing on the page and it is the block Riku will open first.

**Where.** Specimen 02 (visible on load) and specimen 01 (visible the moment `Your campaigns` is clicked). CSS line 267; markup lines 610–612 and 786–789.

```css
.fl-thead,.fl-trow{ … grid-template-columns:minmax(0,1fr) 78px 66px 66px; … }
```

Block C's rows have **five** children (`Campaign · Sent · Opened · Clicked · Replied`) in a **four**-column grid, so the fifth lands in the implicit second row, right-aligned inside the 1fr column.

**Fails.** R10 (Block C's expanded table); deck §5 Block C's four column headers; reference §1.4 (a hairline separates rows — here it separates half a row).

**Fix.** Make the template a per-table variable and give the five-column table its own:

```css
.fl-table{--fl-cols:minmax(0,1fr) 78px 66px 66px}
.fl-thead,.fl-trow{
  display:grid;grid-template-columns:var(--fl-cols);gap:var(--sp-3);align-items:baseline;
}
.fl-table.is-campaigns{--fl-cols:minmax(0,1fr) 66px 66px 66px 66px}
```

and add `is-campaigns` to `<div class="fl-table">` at lines 609 and 785. At 920px the name column is then 616px — ample.

---

### M2 — the three hero figures do not sit on one baseline

**What is wrong.** `25` (and `201`) float 13px above `24` and `0` (`6` and `3`). On the page's single loudest line, one of three figures is misregistered. It is visible without measuring.

**Where.** Specimens 01, 02 and 03. CSS lines 187–191 and 206–209.

`.stat .fig` is bottom-anchored with `margin-top:auto`, so the bottom stack is `fig → [track] → sub`. Only the contacts card has a `.track` (`4px` + `margin-top:9px` = 13px), so only that card's figure is pushed 13px higher.

**Fails.** Reference §5.2 — *"fixed `min-height` so the row stays even. These read as a set."* And §1.3, since this is the row the whole page is built around.

**Fix.** Reserve the track's slot on the cards that have none, so figures *and* captions both align:

```css
/* the proportion track's 13px slot is reserved on every card, so all three
   figures and all three captions share a baseline; only contacts fills it */
.stat:not(:has(.track)) .sub{margin-top:15px}
```

No-`:has()` fallback if the build targets older Safari: `.stat.roi .sub,.stat.stale .sub,.stat.blank .sub{margin-top:15px}`.

---

### M3 — a measured emptiness and a field that never arrived render identically

**What is wrong.** `.fl-note` (11px `--ink-4`) carries **both** `Nothing yet at call booked, proposal sent, won or lost` — a measurement — and `ShikksTracker didn't report every pipeline stage.` / `ShikksTracker didn't report how many are hot.` — an absence. Same size, same ink, same position. Worse, specimen 04's second mini is *captioned* **"Not reported — distinct from a measured zero"** and contains no measured zero to be distinct from; as built, the mockup makes a claim it does not keep. The mockup is also inconsistent with itself: `Nothing waiting.` is another measured zero and it renders at `--ink-3` via `.fl-empty`.

**Where.** CSS line 242; markup lines 594 (measured), 1053 and 1059 (absent).

**Fails.** Deck §9 checklist item 4, deck §2 constraint 2, reference §5.14 rule 3, R9 (which reserves `--ink-4` for the *didn't-report* lines specifically).

**Fix.** Split the class by meaning:

```css
.fl-note{font-size:11px;color:var(--ink-3);margin-top:var(--sp-3)}    /* measured emptiness */
.fl-absent{font-size:11px;color:var(--ink-4);margin-top:var(--sp-3)}  /* the field never arrived */
```

Change lines 1053 and 1059 to `class="fl-absent"`. Then add one measured line to specimen 04's second mini — `<p class="fl-note">Nothing yet at won or lost</p>` above the absent line — so the two treatments sit together and the caption becomes true.

---

### M4 — specimen 03's mark field is too small to judge, so Question 1 cannot be answered

**What is wrong.** The mark field renders as a 52×15px speckle tucked into the card's bottom-right corner. It does not read as twenty-four of anything; it reads as a rendering artifact. Riku is being asked to choose between "bare" and "the mark field" and variant B does not present the mark field's case — whichever way he answers, he will not have answered the question R3 asked.

**Where.** Specimen 03, markup line 937 (`viewBox="0 0 61 21" width="61" height="21"`) with `.stat .marks{right:-9px;bottom:-7px}` at line 212, inside a 297×132px card with `overflow:hidden` clipping ~9px and ~7px off it.

**Fails.** Reference §5.2 — the card graphic occupies the lower band of the card (`.stat svg.viz` in `components.html` is `width:100%;height:74px`), not a corner. And R3's explicit purpose: *"this is the one ruling whose cost only shows in pixels."* At this size there is no cost to see.

**Fix.** Scale the same SVG into the reference's graphic zone — the geometry, count and colour are unchanged:

```html
<svg class="marks" viewBox="0 0 61 21" width="150" height="52" aria-hidden="true">
```
```css
.stat .marks{position:absolute;right:-14px;bottom:-11px;z-index:1;display:block}
```

---

### M5 — `.fl-bound` renders a sentence in uppercase mono

**What is wrong.** `Showing 20 of 34 campaigns.` would render as `SHOWING 20 OF 34 CAMPAIGNS.` at 0.12em tracking, right-aligned, with a trailing full stop inside the caps — which looks like a bug. The class is unexercised in the specimens, but it is production CSS the build will port verbatim, and the same class has to serve Block E's `Showing 20 of 41.`, which currently has no treatment at all.

**Where.** CSS lines 285–288.

**Fails.** Reference §6 Hold — *"Mono caps for anything the system names; sentence case for anything addressed to the person."* R10 calls it **"a statement."** It is a sentence to the reader, not a machine label.

**Fix.**

```css
.fl-bound{font-size:11.5px;color:var(--ink-4);margin-top:var(--sp-3)}
```

(Drop `font-family`, `letter-spacing`, `text-transform`, `text-align:right`.)

---

## 3. Should fix

### S1 — the hero row has one drained treatment for two opposite states

`.stat.blank` (lines 203–204) is used for the needs-you card at `0`, and it drains `.lbl`, `.fig` **and** `.sub`. Two problems compound. First, the reference's own recipe drains only `.lbl` and `.fig` — adding `.sub` makes `nothing waiting`, which is the answer to the question the page exists to ask, the dimmest text on today's screen. Second, R2 created `.stat.plain` precisely so "hueless with data" and "hueless because empty" would not share a class; reusing `.stat.blank` for a *measured* `0` means that when the build renders R4's `—` state it will reach for the same class, and a measurement and an absence will be pixel-identical on the row where the deck's headline checklist item matters most.

**Fix.** Add a third state and reserve `.stat.blank` for `—`:

```css
/* measured zero: hue drains, the caption still reports */
.stat.drained{background:var(--raised);border-color:var(--line)}
.stat.drained .lbl,.stat.drained .fig{color:var(--ink-4)}
/* nothing was measured: everything drains (reference recipe, verbatim) */
.stat.blank{background:var(--raised);border-color:var(--line)}
.stat.blank .lbl,.stat.blank .fig{color:var(--ink-4)}
```

Change the needs-you card at `0` to `class="stat drained"` in specimens 01 and 03.

### S2 — no hero card is ever shown at `—`

R4 specifies the not-reported card (`—` plus the deck's `ShikksTracker didn't report…` sentence in `--ink-4`), the deck's first checklist item is about exactly that distinction, and it appears nowhere. Add a third mini to specimen 04: the drafts card at `—` with `ShikksTracker didn't report how many drafts are waiting`, beside the needs-you card at `0`. With S1 applied, the two are then visibly different objects and Riku can rule on it.

### S3 — specimen 02's Block D collapses to nothing

The full-render Block D (line 799) has no `.fl-collapsed`, so closing it leaves an eyebrow, a heading and a chevron with nothing behind them — a fake affordance by the team's own standard. Deck §8 supplies the line: `Email S1 — specific compliment first     11%`. Add it inside the `<summary>`, formatted like the `.fl-sum` line (name in `--ink-2`, rate in `--ink` tabular). It is also the only §8 string the mockup does not carry.

### S4 — `Log out` is at `--ink-4`

`.app-side .btn.ghost{color:var(--ink-4)}` (line 143) puts `#3A424C` on `#0B0D11` — roughly 2:1 — on the only sign-out control in the app. The reference's `.btn.ghost` is `--ink-3`. Change to `var(--ink-3)`.

### S5 — `OPEN ↗` is nearly invisible

`.stat-top .more` at `--ink-4` is verbatim reference, but in the reference `DETAILS ↗` is ornamental and here it is R4's single exit to ShikksTracker on the page's first card. Add `.stat.roi .more{color:var(--ink-3)}`.

### S6 — overdue outranks failed in the rail

`.agent.is-overdue` and `.agent.is-failed` (lines 127–135) use identical `.09 / .02` gradient alphas; amber is intrinsically brighter than red, so in specimen 02's rail the merely-late agent is louder than the broken one. Inverted hierarchy in the one component whose job is to show you which worker died.

```css
.agent.is-failed{background:linear-gradient(180deg,rgba(248,113,113,.14),rgba(248,113,113,.03))}
```

### S7 — the amber card tint sits outside the reference's band

`--tint-stale`'s first stop `#2A1E04` (line 44) has ~1.7× the relative luminance of `--tint-roi`'s `#171233`, and is brighter than all three reference tints (`#2A1408` spend, `#052620` save, `#171233` roi — a 1.4× spread among themselves). The visible result in specimen 02: the amber card dominates a row whose design premise is that exactly one thing is lit, and `3 things need you` reads like an emergency rather than a Tuesday. The `#FBBF24` figure already carries the alarm; the tint does not need to. Suggest `--tint-stale:linear-gradient(155deg,#241A03,#141209 62%)`.

### S8 — Block E's first row carries a hairline, Block B's does not

`.fl-stages>.fl-stage:first-child{border-top:0}` exists (line 235); there is no equivalent for `.fl-row`, so the two row lists on one page open differently. The reference resets both (`.urow:first-child`, `.prow:nth-of-type(1)`). Add `.fl-rows>.fl-row:first-child{border-top:0}`.

### S9 — one middot on the page is spaced differently from all the others

`.fl-sum` markup (lines 588, 761, 1052) has literal spaces around `<i>·</i>` *on top of* the `<i>`'s `margin:0 5px`, so the pipeline summary's separator has ~8.5px of air each side while the crumb, the health line and `.fl-fine` all have 5px. Remove the literal spaces.

### S10 — `::selection` is violet

`rgba(167,139,250,.28)` (line 78) is not in `components.html` and is not ruled. Violet means "decisions" everywhere else on this page; a selection band is not a decision. Reference §2 **Never**: *"a hue used decoratively where it does not carry its assigned meaning."* Use `rgba(233,236,240,.16)`.

### S11 — `.agent.is-grey` makes a dead agent lighter than a live one

Line 137 overrides `.agent`'s `#12151A` ground with `var(--raised)` (`#14171C`) for no stated reason, so the off / never-run / unknown badge sits a step brighter than the healthy ones. Drop the `background` declaration and let it inherit.

### S12 — the breadcrumb

See the R17 verdict in §6. Concretely: replace `<b>Operator</b><i>/</i>Freelance <em>· read 14:32</em>` with `<em>read 14:32</em>` in `.crumb` (lines 552, 724, 1013; `Operator / Queue` at 1118 and 1227 becomes the queue's own stamp or nothing).

---

## 4. Notes, not fixes

**N1 — the 920px column survives the money card, and my round-2 arithmetic was wrong.** `.fl` is 920px wide with no padding of its own (the 28px lives on `.app-content`), so the stats grid's inner width is the full 920. `4 × 215 + 3 × 14 = 902 ≤ 920` — four cards land at 219.5px each. R4's `minmax(215px,1fr)` needs no deviation and the 980px column I argued for in round 2 is unnecessary. **Worth writing into the spec**, because Personal and Academics inherit it and someone will re-derive it wrongly.

**N2 — six green badges are now the page's largest colour mass.** R8's count is exactly met (one lit figure, six quiet green words), but in pixels the rail's green column reads as the second loudest thing on today's screen, and on specimen 04 it is the *loudest* thing on a page that says "Couldn't reach ShikksTracker." The latter is honest — the agents are RikuOS's own workers reading RikuOS's own Mongo — but it is worth Riku knowing it is deliberate. If the rail reads loud to him, the amendment is to R16 (ok goes grey with a green border only, per reference §5.8's *"a healthy strip is entirely white on black"*), not to the mockup. I am not asking for that change; I am flagging that the mockup is where its cost first becomes visible.

**N3 — the hero card and Block E say the same nothing twice, in two registers.** Today's page reads `0 / nothing waiting` at the top and `Nothing waiting.` at the bottom. R1 knowingly accepted that the needs-you card duplicates Block E's count — that is settled. The *register* mismatch (lowercase no-stop vs sentence-with-stop, for the same fact, on one screen) is separable from the ruling, and if the lead wants it harmonised it costs one word.

**N4 — the orange focus ring is reference-level, not a hue-budget violation.** `:focus-visible{outline:2px solid var(--spend)}` is `components.html` line 69 verbatim. `caret-color:var(--spend)` is an invention with no precedent in the reference, but it renders only in a text field and P8 has none, so R2 ("orange appears on P8 only on the logo tile") holds in the pixels either way. Neither needs to move.

**N5 — dead vocabulary is shipping.** `.statstrip`, `.btn.go`, `.statuspill` and `--session` are all declared and unused. The first three are commented as deliberate vocabulary; `--session`'s presence is settled (a fixed set stays complete). Fine as-is, but the build should not accrete more, and `.fl-bound` will stop being dead once S3/M5 land.

**N6 — `Campaign` is a new string.** Deck §5's Block C names its columns `Sent · Opened · Clicked · Replied` and calls the first column `Name`; the mockup's header is `CAMPAIGN`. Block D's `Approach` *is* a deck header, so only this one word is new. Not worth a fix; worth one line to Riku so no string on the page is unaccounted for.

**N7 — `Checking…` is never shown.** R13 specifies it and §H does not require it, so this is not a miss — but it is the only interactive state in the whole design and the build must not forget it.

**N8 — `⚠` in the Question 2 call-out renders as a colour emoji in Chrome.** The argument makes itself in front of Riku, which is the best possible way to put that question.

**N9 — `.fl-open{margin-top:20px}`** puts `MEASURED — EMAIL` only 20px under `Your approaches`, so at first glance it reads as a second eyebrow waiting for its own heading. 28px (`--sp-6`) would separate the group from the block without touching R11's equal-weight requirement.

**N10 — specimen 03 needs horizontal scrolling to compare the two variants.** Two 920px panes in a 1240px container means you never see both drafts cards at once — on the specimen whose entire job is an A/B. Stacking them vertically (both at 920px, 28px apart) removes the scroll and keeps the true content width. Specimen 05's scroll is fine; there the difference is a ten-line block at the top and you can hold it in your head.

**N11 — small fidelity drift the CSS claims not to have.** `.fl-thead` is 8.5px / weight 400; `components.html`'s `.debt th` is 9px / weight 500. And `--track:#1A1E25` follows `DESIGN-INSPO` §5.5 while `components.html`'s `.track` uses `#161A20` — the reference disagrees with itself and should be reconciled at its own level, not here. The mockup followed the written reference and R3, which is right.

---

## 5. Deviations adjudicated

**(a) The Block D honesty note renders only when a rate exists, so it is absent from specimen 01. — Justified.** `Rates are computed over small numbers of sends.` is not true of a table with no rates and no sends; printing it there would be the opposite of an honesty note. The condition should be written into the spec explicitly — *render when at least one rate is printed* — or someone will "fix" its absence later. The mockup handles the consequence correctly: specimen 04's question call-out tells Riku the fourth string lives in specimen 02.

**(b) `Showing 20 of 34 campaigns.` is designed but not exercised. — The omission is justified; the design is not.** No specimen has enough campaigns to bound honestly, and inventing one would be a worse sin. But the class as written renders a sentence in uppercase mono — see **M5**. Block E's `Showing 20 of 41.` has no treatment at all and should share the corrected class.

**(c) The needs-you card at `0` uses `.stat.blank`. — The visual is nearly right; the class is wrong, and the difference will cost something later.** R2's "drained (`--ink-4`, plain card) at 0" is what `.stat.blank` does to `.lbl` and `.fig`, so the render is defensible. Two things are not. The mockup adds `.sub` to the drain, which the reference does not, dimming the caption that carries the finding. And R2 went out of its way to separate "hueless with data" (`.stat.plain`) from "hueless because empty" (`.stat.blank`); folding a *measured zero* back into `.stat.blank` means the build has no class left for `—`, and the deck's first checklist item loses its distinction on the hero row. **See S1.**

**(d) Rail sizes above the reference's — justified.** Tile 24px/7px radius (reference 20px/6px), wordmark 13px (11.5px), `.navitem` 12.5px (11.5px), `.app-side` padding 16/12 (14/10). All sit inside `DESIGN-INSPO` §4's stated ranges ("logo tile 20–30px at 6–9px radius", "11.5–13px text"), and the rail has to hold `OUTREACH-HEALTH` at 10px mono inside 170px, which it does. Take these as the RikuOS values.

**(e) `.stat.roi .fig` takes the hue instead of the reference's `#EDE9FE` — justified and correctly commented.** R2 ruled it; the near-white exception exists only when the hue is spent on a graphic, and this card has none.

**(f) The badge legend moved from the end of specimen 01 to its own specimen 06 — justified.** It reads better as a reference plate than as an appendix to a page render, and nothing is lost.

---

## 6. The R17 verdict, and the specimen 05 verdict

### R17 — does `Freelance` said three times read as noise?

No, not as *noise* — but the breadcrumb does not earn its place, and I would delete it. The three sayings are at genuinely different scales and jobs: the rail item is a highlighted location marker with an icon, the 24px title is the content's name, and the crumb is 11.5px meta. Nothing shouts. What the pixels show instead is subtler and worse. The crumb's `Freelance` sits 70px directly above the title's `Freelance`, offset a few dozen pixels left — the eye reads the same word twice in one downward sweep, which is a stutter rather than a signal. And `Operator`, at `--ink` weight 500, is the brightest element in the entire top bar: a word that names nobody in a system whose founding fact is that there is exactly one user, forever, and that can never change on any page. So the bar's loudest element is a permanent constant, and its second element restates the heading below it. Strip both and what remains — `read 14:32` — is the only thing in the bar that ever changes, which is precisely what R17 wanted the stamp to be. The queue frame makes the same case harder: there `Queue` is said three times too, and one of those is `RikuOS — Queue` at 24px display weight directly under a rail already saying `RikuOS`. R17 pre-authorised this outcome, so I am recording it as a should-fix (S12) rather than a new argument: **the breadcrumb goes, the stamp stays.**

### Specimen 05 — does the re-skinned queue look like the same system?

Yes, convincingly. The hairline-and-mono grammar, the outline-pill vocabulary, the `--raised` + `--line` + 10px card, the `--sunk` well under `pre.body`, and the shared 920px column all carry across; the topbar's inner column, `main`, and `/freelance`'s content column align to the same 75px left edge inside the frame, which is what makes the two pages feel like one app rather than two skins. `Approve` / `Edit` / `Reject` read correctly as primary / resting / destructive with no solid fill anywhere, and `pre.body` in the body face genuinely reads as a message to a person rather than machine output — R18's judgement was right and it shows. Two costs are visible and should be named rather than discovered later. First, the six status filters now differ only by border and label brightness; at a glance the row reads as one undifferentiated strip and you have to *look* to find `pending`. That is the honest price of one-treatment-per-selector and Riku should be told it is the price, not a bug. Second, the case for deleting the inline header is made by the wrong element. The two `Log out` buttons are ~300px apart vertically and never appear in one eyeful at frame height, whereas the inline `Settings` link and the rail's `Settings` nav item *do* sit in the same view. And the fattest duplication of all is `RikuOS — Queue` — the app name and the page name, at display weight, under a rail that already carries both. **Re-point the caption at Settings and the h1**; the `Log out` argument is the weakest of the three and it is currently leading.

---

## 7. Hue inventory (R8 audit)

Every colour reference in the file, mechanically extracted from the CSS and the markup.

| Where | Declaration | Renders on P8? | Verdict |
|---|---|---|---|
| `.app-brand .tile` | `linear-gradient(150deg,#FF9E5C,#F2622B)` + glyph `#2A1002` | yes, every frame | The one permitted orange (R2). Held. |
| `:focus-visible` | `outline:2px solid var(--spend)` | only on keyboard focus | `components.html` line 69 **verbatim** — reference-level convention, not a violation. |
| `input,textarea` | `caret-color:var(--spend)` | never (P8 has no input) | An invention with no reference precedent, but out of P8's scope. Leave. |
| `::selection` | `rgba(167,139,250,.28)` | on text selection | **Not ruled, not in the reference.** Violet carries "decisions" here. → S10. |
| `.stat.roi` | `--tint-roi` + `rgba(167,139,250,.2)` border; `.lbl`/`.fig` = `--roi` | yes | R2. Held. Figure takes the hue per R2's override of §5.2. |
| `.stat.stale` | `--tint-stale` + `rgba(251,191,36,.2)`; `.lbl`/`.fig` = `--stale` | specimen 02 only | R2. Held, but the tint is outside the reference's luminance band → S7. |
| `.stat .marks` | `rgba(167,139,250,.22)` | specimen 03 variant B only | Matches its own card's hue — one hue per card held. |
| `.pwhen.is-stale` | `--stale` | specimen 02, Kiddo Co only | R12. Held. |
| `.fl-health.quiet .aged` | `--stale` | specimen 04 mini 3 | R13's 30-hour rule. Held. |
| `.fl-warn.is-stale i` | `--stale` + 6px glow | specimen 02 alarm | R13. Held. Glow on a dot, not on text. |
| `.fl-warn.is-missing i` | `--missing` + 6px glow | specimen 02 alarm ×2 | R13. Held. |
| `.fl-fail i` | `--missing` + 6px glow | specimen 04 ×2 | R14. Held. |
| `.agent.is-ok` | `--save` label + `rgba(53,211,153,.18)` border, **no fill** | ×6 on every frame | R16. Held. See N2 for the aggregate. |
| `.agent.is-overdue` | `--stale` label, `.22` border, `.09/.02` fill | specimen 02, 06 | R16. Held, but louder than `is-failed` → S6. |
| `.agent.is-failed` | `--missing` label, `.22` border, `.09/.02` fill | specimen 02, 06 | R16. Held. Under-weighted → S6. |
| `button.danger` | `rgba(248,113,113,.4)` border, `#F5A5A5` label | specimen 05 ×2 | R18. Held; pale-red literal matches reference practice (`#8AE9C6`, `#7FE3BE`). |
| `.error` | `--missing` | never (no error state drawn) | Legacy vocabulary. Fine. |
| `.btn.go` | `rgba(53,211,153,.4)` / `#8AE9C6` | never | Declared vocabulary, unused (commented). → N5. |
| `.statuspill` | green at `.08` / `.2` / `#7FE3BE` | never | Declared vocabulary, unused (commented). → N5. |
| `--session` `#5FA5FA` | declared | never | Settled: an unused member of a closed set is not an orphan. |
| `--skill` `#F472B6` | **not ported** | — | Correct (R19: graph-only, and there is no graph). |
| `--alert` / `--amber` | **absent** | — | Correct. `git grep "var(--alert)\|var(--amber)"` returns nothing. |

**Result.** Today's rendered page carries exactly one lit figure (violet `24`) and six quiet green words in the rail — R8's budget met to the letter. Orange appears only on the logo tile. No hue is used decoratively except `::selection`, which is the one line to change.

---

## 8. String audit

Every visible string in the app frames was extracted mechanically and checked against the deck. **No deck string is misquoted anywhere** — not by a character, a dash, a quote mark or a full stop. `Open counts come from tracking pixels…`, `Replies are only detected on email, so these can't be scored.`, `Nothing yet at call booked, proposal sent, won or lost`, `State of play, pipeline, campaigns, approaches and what's waiting all come from there.`, all three Block E rows, and every health-strip line are exact.

**Deck strings §7 / §8 / §6 not rendered anywhere:**

| String | Source | Assessment |
|---|---|---|
| `Email S1 — specific compliment first  11%` (Block D collapsed) | §8 | **The only §8 string missing**, and specimen 02's Block D collapses to nothing without it. → S3 |
| `ShikksTracker didn't report how many drafts are waiting` | §5 A-block | The hero card's `—` state is undrawn entirely. → S2 |
| `ShikksTracker didn't report how many contacts there are` | §5 A-block | Same. |
| `Nothing waiting on you.` | §5 A-block | R5's whole-block fallback. §H does not require it; the build must not lose it. |
| `Showing 20 of 34 campaigns.` / `Showing 20 of 41.` | §5 C, E | Styled wrongly / unstyled. → M5 |
| `No contacts yet.` · `No campaigns yet.` · `No approaches set up.` | §5 B, C, D | Out of §H's five states. Fine. |
| `Couldn't load campaigns.` · `Couldn't load approach performance.` · `Couldn't load what's waiting.` | §5 C, D, E | The treatment is shown once (`.fl-fail`, mini 1) and generalises. Fine. |
| `has never reported a run` · `an unreadable run time` · `reported 2 errors` | §5 F | Out of scope; the worst case shows three of five warning shapes. Fine. |
| `Meowchi returned HTTP 503` · `Meowchi timed out` · `sites never checked` | §5 F | Same. Fine. |
| `Checking…` | §5 F | R13's only busy state. → N7 |
| `Phone`, `Facebook` (channel labels) | §5 E | Two of four shown. Fine. |

**Strings on the page that are neither deck strings nor §I.4's four:**

| String | Authority |
|---|---|
| `Your pipeline` · `Your campaigns` · `Your approaches` · `Waiting on you` | R7 |
| `Open ↗` | R4 |
| `nothing waiting` · `waiting on you` (hero captions) | R4 |
| `Operator` · `read 14:32` | R17 (and → S12) |
| `Agents` · `off` · `never run` · `—` · `failed` · `2 items failed` · `last ran 41h ago` | R15, R16 |
| `Log out` | R15 |
| `Reply rate` · `Sends` · `Replies` · `Approach` | deck §5 Block D table header |
| **`Campaign`** | **none** — deck §5 calls Block C's first column `Name` and its header list omits it. → N6 |

Everything on the queue frames was checked against `src/app/queue/page.tsx` and `PushControls.tsx` and is faithful, including `edited approved` (from `s.replace("_", " ")`), the curly quotes in `Their reply: “…”`, and the fact that bare `<button>` really is both `Approve` and the active filter — which confirms R18's one-treatment-per-selector rule is implementable exactly as drawn.
