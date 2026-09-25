# P10 round 6 — the lead's rulings on the spec's open items

**Date:** 2026-09-25 · **Written by:** the design lead, after the Spec Editor's eight unresolved contradictions and its list of what a builder would still have to guess. **Status:** the last rulings before the build plans. R-numbers continue from R86. **HEAD:** `e2ae0cf`.

Writing the spec surfaced eight places where two rulings disagree and the newest one does not settle it, plus one string that never reached Riku. None of them is a design question reopened; every one is a gap the five rounds left. They are ruled here so the Build Planner works from a spec with no holes in it.

---

## R87. The phone threshold is 439px, and it is the app's one new `@media`

**Decision.** The rail becomes the 44px top strip **below 439px of viewport width**. At 439 and above the rail stays. The agents block is hidden inside that same query by `display:none` on its wrapper — not by a second mechanism, and not by removing it from the markup.

**Reason — the number is derived, not chosen.** R2's standing rule is that a threshold comes from a measured cell width, never a round number, and this one has a measurement waiting for it. R40 measured the form floor at **213px of tile**. With the rail at 170px and `.app-content`'s 28px of padding on each side, the content column is `viewport − 226`. So `viewport − 226 ≥ 213` gives **439px** as the last width at which the rail can still leave room for a form to open. Below it the rail makes the page's one journey impossible; at or above it, it does not. That is exactly the fact S20 was decided on, turned into a number.

A 390px phone therefore takes the strip and gets 334px — the figure the mockup already states. A 768px tablet keeps the rail, takes the one-column stack (its 542px grid is under the six-column threshold), and both forms open.

**Why `@media` and not a container query**, which every other threshold on this page uses: the shell is not inside a container, and the only element that could serve as one is `.app-body`. **R30 forbids exactly that** — no ancestor of the header may take `container-type`, because containment silently kills the sticky edit-mode pill row. So the rail's own threshold cannot be a container query without breaking edit mode, and `@media` is the correct instrument rather than a lapse. `base.css` already carries one (reduced motion); this is the second and last.

**Cost.** The mockup cannot draw this rule — its constraints forbid `@media` so that it stays one honest artifact — so specimen 08 shows the two shells side by side without the switch between them. The threshold is therefore the one number in this design that the mockup does not verify, and the build is where it is first seen working. Recorded rather than papered over.

---

## R88. `3 days late` stands everywhere. The mockup's `3d late` is a drafting slip

**Decision.** The deck's strings `3 days late` and `1 day late` are the only forms. The abbreviated `3d late` / `5d late` that three of specimen 01's 106px panes render is **not a ruled narrow variant** and is corrected in the mockup.

**Reason.** The deck is the authority on every string, and no ruling introduced an abbreviation. More to the point, an abbreviation is not needed: in the narrow band R38 already moves the due meta **to its own line**, where 80px of inner width comfortably holds eleven characters of 9.5px mono. The room exists; the mockup simply drew the short form by hand.

**The builder confirms it rather than taking my word**: render a to-do row with `3 days late` at 106px and report whether it fits on line two. **If it genuinely does not fit, that is a question for Riku** — an abbreviated string is his to approve, exactly as the eleven were — and not something the mockup or the spec may settle on its own.

---

## R89. `.pe-more` is deleted

**Decision.** The class goes out of `personal.css`. Nothing renders `+N more` on this page.

**Reason.** R51b removed its only consumer (the per-day bound) and R58 declined the `+1 more` summary shape, so it now has none. §5.8's rule — declared vocabulary with no consumer does not ship — exists for precisely this, and it outranks "the deck still names the string": the deck's `+3 more` was superseded, and a live CSS class for a superseded string is how the string comes back. The 20-row bound is unaffected; it renders `Showing 20 of 34.` through `.fl-bound`, which keeps its consumer.

---

## R90. `N items` is ratified — `2 items`, in Riku's words, 2026-09-25

**Decision.** The count format is `2 items` / `3 items`. It joins the deck's `§15`, dated 2026-09-25 and marked as ratified after the other eleven.

**Reason.** The Spec Editor was right that this was a real hole: R54 approved eleven strings on 2026-09-24, and R59's `N items` did not exist yet — R56–R69 were written the same day but after. A user-visible string with no ratification path is exactly what S11's content-first rule forbids, so it was put to him rather than assumed. He chose `2 items` over a bare number and over `+1 more`, with the reasoning for each in front of him. No singular form is needed: the disclosure exists only at two or more.

---

## R91. R53's condition wins as written — one occupant, not a sparse sum

**Decision.** A row takes `auto` instead of its weight **only when it holds exactly one tile and that tile is narrower than the row.** R5's broader condition — "tiles summing to fewer than 6 columns" — is **narrowed to this.** A row holding two tiles that sum to 5 of 12 keeps its weight and shows bare ground in the leftover.

**Reason.** R5 was the lead's rule, written before Riku saw anything; R53 is Riku's answer, and what he was shown and approved was one picture: a single small tile alone in a row, drawn both ways (R48). His answer reaches that case and no further. R53's phrase "a general rule for every arrangement" means *not a rule about the push tile specifically* — it is not a licence to widen the condition past what was drawn.

Widening it later is additive and costs nothing to un-build; shipping the broader rule now would change row heights in arrangements he has never seen, on the strength of a sentence he never read.

**Cost, stated because it is a real render nobody has looked at.** A row with two tiles summing to 5 of 12 holds seven columns of bare ground at full row height. That is more dead air than the case R53 shrinks. It is consistent with the settled rule that the leftover is bare ground in normal view, and it is the conservative half of a question that can be reopened with one measurement whenever Riku produces such an arrangement.

---

## R92. The mockup is the measuring instrument: row 2's blank render is 191.85px

**Decision.** Row 2's weight stays **200**. Its measured blank render is **191.85px**, not the 197.85 the design doc carries; the doc is stale and is corrected.

**Reason.** M2 moved the `tile` container from the tile to the cell, which brought `.pe-tile{padding:12px}` alive at span 3 and took 6px out of the Layers tile. The figure moved; the weight did not, because 200 was never the tile's height — it was the number chosen to keep "short" short while clearing the 44px switch rows. The standing rule that where prose and the mockup differ the mockup is the truth decides which number is real.

---

## R93. R38's span label is corrected: 452.5px is span 6, not span 7

A factual slip in R38's own prose ("480 catches everything up to span 7 at twelve (452.5)"). The width is span 6's; the mockup's pair-threshold comment has it right. **The threshold itself — 480px — does not move**; only the sentence naming which cells it catches. Corrected in the spec rather than silently re-derived, so nobody later "fixes" 480 to match the wrong span.

---

## R94. R64's verdict: the cross-column slack reads as intentional. `stretch` stays

**Decision.** When an opened day stretches its shorter, closed row-partner's box in the other column, that slack **stays**. `align-items:start` is not applied to the paired cells. R64 asked for a render and a verdict; this is the verdict.

**Reason.** Three rules already point the same way and none points the other. R6 makes every tile fill its cell exactly and keeps `align-items:stretch` at the page's outer grid; R17's honesty rulings and the settled "no filling the empty cell" line both say real slack is shown rather than hidden. The slack here reflects a true height difference between two unrelated days — it is a fact about the week, not a layout defect. Applying `start` would make one row kind stop filling its cell, which is a new exception to R6 bought for a cosmetic gain.

**Cost.** A day with two lines can sit above visible empty room when its partner four days later is open. Accepted, and it is the same class of accepted cost as R63's pushing.

---

## R95. The mockup's last four fixes

Small, and none of them a design change.

1. **The stale claim.** The `personal` group's hero-tint comment and specimen 01's tint caption still carry R79's uncorrected "the first three items move the colour as far as the next five do". The measured figure is **1.8×**. Correct both; the spec already carries the corrected form.
2. **`3d late` → `3 days late`** in the three 106px panes (R88), having first confirmed it fits.
3. **The two uncaptioned heights.** R65 asked for four busy-week figures. The collapsed pair is captioned (240px at two columns, 362.75 at one). The **fully open** pair and the **mixed open/closed** case are drawn but carry no number — measure and caption them.
4. **The two legal cells the mockup never draws** — span 7 of twelve and 3 of 6 at the widths the spec marks unmeasured. Render each once, measure, and either caption the figure or say in the report why the cell cannot be drawn.

---

## What is now closed

Every item the Spec Editor could not resolve is ruled above, and the one string that needed Riku has it. **Nothing in the spec's §10 is a blocker for the build plans.** What remains genuinely open, and is recorded as open rather than guessed, is the phone threshold's *verification* (R87 cannot be drawn, only built) and the two questions that belong to Riku's own hands: the form's fit on his phone (R40) and one observed 07:00 push.
