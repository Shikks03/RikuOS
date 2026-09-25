# P10 round 5 — the lead's rulings

**Date:** 2026-09-25 · **Written by:** the design lead, after `round5-riku-answers.md` (R50–R55), `round5-interaction-rulings.md` (R56–R69, R77), `round5-system-rulings.md` (R70–R76) and the redrawn mockup (`a17e96b`). **Status:** the last two rulings round 5 needs before the visual spec can be written. R-numbers continue from R77. **HEAD:** `a17e96b`, `src/` unchanged since `21e4564`.

Two things were left open when the mockup was redrawn. One was mine to rule and is ruled here (R78). The other was put to Riku as a one-line yes/no and came back as a new design — the hero's mark changes shape for the second time, and R79–R85 are the machinery that makes it true.

---

## R78. The hero's tint survives an open form, unchanged

**Decision.** When the add-event form replaces the hero's body, or the edit form replaces a row inside its `Due` group, the tile keeps its tint — background, border and radius all unchanged. There is no fourth "a form is open" appearance. Specimen 06's two untinted hero panes are redrawn tinted.

**Reason.** Three, and the third is decisive.

R75 already ruled the identical shape of question for edit mode and gave the reason: the tint is *a structural fact about the tile*, in the same category R8 put the ground, border and radius in, and "the day's pending count does not become less true because Riku opened the layout editor." Opening a form is the same event with a different name. Nothing distinguishes the two cases except which of the two mechanisms happens to be covering the group, which is not a difference the reader can see or should have to model.

The mockup's own flag argued the other way — *"the honest choice when the fact a tint would assert is not on screen."* That reads the honesty rules one notch wider than they go. R18, R21, R45 and R72 all forbid **claiming what was not read**. The pending count *was* read; the form covers the group that displays it, not the read that produced it. A fact does not stop being known because the pixels that spell it out are temporarily behind something else.

The third reason is the one that forecloses it. Under R83 below, the untinted hero means exactly one thing — the to-do store did not answer. Untinting for an open form would make the page say "I don't know what's pending" at the precise moment Riku is adding something to the day, which is not caution, it is a false statement. Before R79 this would merely have been ambiguous; after it, it is wrong.

**And the moment argues for it independently.** Adding an event to today is exactly when how full today already is, is the thing worth knowing. A hero that goes quiet about its own state the one moment Riku is about to add to it is a worse render — R75's own sentence, applied to the case it did not name.

**A consequence, by R67's existing rule and not a new decision.** The tint is decided at render and refresh time, never live mid-interaction. Adding a to-do due today that takes the count from 2 to 3 does not warm the hero as the form closes; the next server render does it. This is the same rule R67 already applies to the day row's disclosure shape, for the same reason, and it wants no second mechanism.

**Cost.** None. The busy tint is on screen while Riku adds a ninth thing to a day that already holds eight, which is the point rather than the price.

---

## R79. The hero's tint is a ramp, not two states — green at 0, orange at 3, red at 8

> "rather than pure orange color, make it so that its a gradient, starting from green it goes more red the more tasks there is."
>
> "3 is orange and then goes until the most busy at 8"

**Riku, 2026-09-25.** This is his ruling and the second time he has moved the hero's mark; R52's two tinted states and its four-or-more threshold are **superseded**, and R70's pair, R71's border rule and R72's shared render are amended below rather than kept. What is *not* superseded: R52's own settled half — the hero is tinted by the state of the day, R8's hueless mark is overruled, and the radius and the honest-render principle survive.

**The ramp, stated exactly.** `pending` (R73's count, unchanged) drives one position on a two-segment ramp:

| pending | 0 | 1 | 2 | **3** | 4 | 5 | 6 | 7 | **8+** |
|---|---|---|---|---|---|---|---|---|---|
| tint | **green** | | | **orange** | | | | | **red** |

Green at 0, orange at 3, red at 8, clamped at 8 — a day with fourteen things looks like a day with eight. 1 and 2 interpolate green→orange; 4 through 7 interpolate orange→red. Nine states, no tenth.

**The two segments are not the same length and that is deliberate on his part**, not an oversight to smooth out: the first three items move the colour as far as the next five do. A day going from nothing to three things has changed more, to him, than a day going from four to eight. The ramp is built to the anchors he gave, not to an even spacing between them.

**The cost, recorded here so nobody rediscovers it as a bug — and it is larger than R52's.** R52 already cost `--spend` a second, page-local meaning, and that was written down. This ruling spends three more:

- **`--missing` (red) acquires a page-local second meaning** — a very full day — on top of "overdue". The page can now show a red-tinted hero whose rows are all on time.
- **`--stale`'s hue is crossed by the ramp** somewhere between orange and red without meaning "a feed did not answer".
- **`--save` (green) becomes a claim about volume**, not only "healthy".

What keeps the system honest is **register, and it is the only thing that does: the ramp is a background wash and is never ink.** `--missing` as ink on a row still means exactly one thing — this is late. `--stale` on a 5px dot still means exactly one thing — this did not answer. A hue washed behind a whole tile and a hue printed in a word are not the same signal and are not confusable at a glance. That distinction is now load-bearing for the page's whole colour system, so it is written into the spec as a rule (R84), not left as an observation.

**Riku was shown the shape of this cost when he chose it** — the orange hero, amber dot and red row sitting on one page — and chose it anyway. It is his page. It is not relitigated. What follows is only how to build it.

---

## R80. Nine frozen classes, chosen by one pure function — no runtime colour maths

**Decision.** The ramp ships as nine CSS rules, `.pe-t0` through `.pe-t8`, each carrying a literal gradient pair and a literal border colour. One pure function `heroTint(pending: number | null): 0|1|2|3|4|5|6|7|8 | null` picks the class from a frozen table; it clamps above 8, and returns `null` when the to-do read did not answer (R83). No inline style, no custom property computed per render, no colour interpolation at runtime.

**Reason.** R3 already settled this exact question for placement, and its argument transfers without a word changed: three frozen class lookups, emitted from `Object.freeze`d tables, *so an out-of-range stored value matches no rule and is visible*. A count of `-1` or `NaN` matching `.pe-t-1` and therefore matching nothing renders an untinted hero, which is the safe render; the same value fed into an interpolation function renders an arbitrary colour, confidently. The page has one precedent for per-render colour data and it is this one.

It is also what makes the ruling verifiable. Nine states is nine contrast measurements — a finite list the builder can render and report, the way R70's table was reported. A continuous computation is an infinite one, and the spec would have to argue about the curve instead of stating the numbers.

**Where each lives.** The **three anchors** (0, 3, 8) go in `tokens.css` as `--tint-save`, `--tint-spend` and the new third (R81) — they are system values, two of them already exist in the reference, and the user's standing instruction to port the pair with the build is unchanged by this ruling, only widened by one. **The six interpolated steps** (1, 2, 4, 5, 6, 7) are page-local and live in `personal.css` with the nine rules; they have exactly one consumer and `tokens.css` does not carry values one page uses.

**Interpolated once, then frozen.** The six intermediate pairs are computed by the builder, checked by eye and by contrast, and then written into the stylesheet as literal hex. They are not recomputed at build time and not derived by a Sass-style function. A tuned value that got checked is worth more than a formula that did not, which is R70's own reasoning for porting rather than retuning.

**The view model.** R73's implementation note stands with its type widened: one field, not several booleans — `heroTint: 0|1|…|8 | null`, never a pair of flags that could disagree. `PERSONAL_HERO_BUSY_AT = 4` is deleted; the anchor table replaces it, and the anchors are the constants Riku can move.

---

## R81. The three anchor recipes — two ported, the third built to the same formula

**Decision.** Anchors 0 and 3 are the values R70 already ported, unchanged:

```css
--tint-save:  linear-gradient(155deg, #052620, #0F1417 62%);   /* anchor 0  · border rgba(53,211,153,.2)  */
--tint-spend: linear-gradient(155deg, #2A1408, #141013 62%);   /* anchor 3  · border rgba(255,138,61,.2)  */
```

Anchor 8 has no source to port from — `DESIGN-INSPO.md`'s card-tint block gives `spend`, `save` and `roi` only, and no `--tint-missing` exists anywhere in the system. **It is built, to the same formula the other four tints visibly obey**: `155deg`, a deep desaturated version of `--missing` `#F87171`, into a near-neutral at 62%, with the border at the hue's `.2` alpha — `rgba(248,113,113,.2)`. **The two stop values are the builder's to tune and report**, against the four existing tints as the calibration set, not invented by this document.

**Reason.** Every tint in the system was tuned by eye against its hue and then frozen; the four that exist agree with each other closely enough that a fifth has a clear target to hit. Writing a value into a ruling that nobody has looked at on a screen would be exactly the kind of computed-not-measured number round 4 struck three times (R38's 200, R40's 96 and 146). The formula is ruled; the pixels are measured.

**The one substantive constraint on the tuning.** The near-neutral stop must sit close to the other four (`#141013`, `#0F1417`, `#111117`, `#141209` — all within a hair of `--raised`'s luminance), because R70's whole contrast result rests on the 62%-and-beyond region of every tint being effectively `--raised`. A red tint that brightens that stop would move contrast for every ink on the tile at once.

---

## R82. The border moves with the ramp; the radius still never does

**Decision.** R71's rule is kept and extended: each of the nine classes carries its own border colour, interpolated on the same curve as its fill, from `rgba(53,211,153,.2)` at 0 through `rgba(255,138,61,.2)` at 3 to `rgba(248,113,113,.2)` at 8. `--r-feature` is invariant across all nine and across the untinted render. The untinted render keeps R8's `--ink-4` border.

**Reason.** R71's reasoning is unchanged by the ramp — there is no precedent in this system for a tinted fill under a hueless border, and a ramp of nine fills under one frozen border colour would be that mistake nine times. The border is part of the tint, so it interpolates with it.

**Cost.** The hero's border now has ten possible colours where every other tile has one. That was already R71's accepted cost at three; the ramp does not change its kind, only its count, and nine of the ten are a hair apart from their neighbours by construction.

---

## R83. The untinted hero now means exactly one thing: the to-do read did not answer

**Decision.** R72's shared render is **narrowed**. There is no longer a "1–3 pending" middle band — 1, 2 and 3 have tints of their own now — so `.pe-tile.is-hero` with no `.pe-tN` class has one occupant and one meaning: **the to-do store did not answer, so the page has no count and claims nothing.** R72's reason survives its rule: an untinted hero asserts nothing, and that is the honest render when the number is unknown.

**Reason.** This falls out of R79 rather than being chosen. It is recorded as its own ruling because it is a genuine improvement to the page's honesty that is easy to lose: under R72 the untinted hero was deliberately ambiguous between "a few" and "unknown", and R72 defended that ambiguity at some length. The ramp removes the ambiguity for free. The spec should state the new, sharper meaning rather than carry R72's defence of a collapse that no longer exists.

**R74 is unchanged and now matters more.** The tint still answers to the to-do read alone; a calendar failure never untints the hero, because events never counted. Under R72 getting that wrong cost a shade of ambiguity. Under R83 getting it wrong means the hero says "I don't know what's pending" because *Google* did not answer, which is a plain falsehood. R74's re-tinting instruction for specimens 03 and 05 is therefore binding, not housekeeping.

---

## R84. The hue budget: the exception is a ramp, and wash-versus-ink is the rule that contains it

**Decision.** R9's "hue appears in exactly four places" gains its fifth place — the hero's background — and that place is now a **ramp through four semantic hues rather than a fixed reading of one**. The containing rule, which the spec states as a rule and not as a note: **on the Personal page, hue in a background wash means volume; hue in ink, on a dot, or on a border of a row means what R9 says it means.** No surface may carry a semantic hue as a wash except the hero, and no wash hue is ever read as its ink meaning.

R9's four ink places stay exactly four. R10's dot keeps `--stale` alone. `--missing` as ink keeps lateness alone. Nothing else on the page gains a tint by extension of this ruling — R79 is a ruling about one tile.

**Reason.** R52 could be recorded as one token acquiring one page-local second meaning, and R76 wrote it as a comment on `--spend`. A ramp crossing four hues cannot be recorded that way without four comments that each tell a quarter of the truth. The honest form is one rule about register, stated once, with the tokens' comments pointing at it.

**R76's amendment is therefore widened**, and its exact wording is superseded by the following. `src/styles/tokens.css`, the semantic-hues group comment:

```css
  /* semantic hues — meaning is fixed in ink; one recorded exception
     for background washes on the Personal page's hero tile (P10 R79–R84) */
```

and the three tokens the ramp anchors on each gain a pointer rather than a restatement:

```css
  --spend:#FF8A3D;   /* money out, limits consumed, the brand mark — also P10 R84 */
  --save:#35D399;    /* value recovered, healthy, connected — also P10 R84 */
  --missing:#F87171; /* overdue, absent, late — also P10 R84 */
```

`docs/design/DESIGN-INSPO.md`'s footnote under the "Semantic hues" table, replacing R76's two-token version:

> *One recorded exception: the Personal page's hero tile carries a background tint that ramps from `--save` through `--spend` to `--missing` with the day's pending-task count. This is a page-local reading of those hues **as a wash**; their fixed meanings in ink, on dots and on row borders are untouched, and no other surface may take a semantic hue as a wash without its own ruling. See P10 round 5, R79–R84.*

`docs/design/components.html` is still not edited, for R76's reason — it is the frozen teardown reference, a source to translate from.

**Cost.** The page's colour system is now genuinely harder to explain than it was two rounds ago: it takes a sentence about register before the four ink places make sense. That sentence is the price of R79 and it is cheaper than four half-truths in four token comments.

---

## R85. Unchanged, and confirmed

- **R73 stands, and Riku confirmed it in the same answer** — `pending` = to-dos due today plus anything overdue; scheduled events never count; **an overdue to-do does not force the top of the ramp on its own.** It counts as one item like any other, and the row's own red ink is lateness's one escalation. His words: *"No — it just counts as one."* The one-line `OR` R73 flagged as the likely change is **declined by the owner** and the flag is closed.
- **R74** — the tint answers to the to-do read alone. Unchanged, and load-bearing (R83).
- **R75** — the tint survives edit mode, undimmed. Unchanged; R78 extends the same reasoning to an open form.
- **R77, R56–R69** — the day-row disclosure is untouched by any of this.
- **R70's contrast method** — hand-computed bounds at the two gradient stops, then measured in the render. The method stands; the table is re-run at nine states instead of two.

---

## R86. Five additions to round 3's §I list, and the strings question it never asked

The docs-corrections pass surfaced eight things the §I list does not reach. Five are ruled here. Four of those are not new decisions at all — they are rulings already made that §I simply failed to list, and a document still contradicting a ratified ruling is how the ruling gets un-built.

**Added to §I:**

1. **Design doc, *The tiles*: `.tile` → `.pe-tile`, `.fl-head` → `.fl-headrow`** (R32, R11). A design doc that still names the class R32 forbids is how the forbidden class ends up in the build.
2. **Design doc, *The client module*: R24 in full** — `nextPageToken` followed to a three-page ceiling per layer per window, a layer still truncated at the ceiling reported as *that layer's* failure, `listCalendars` paginated the same way, `404` → `GoogleError("gone")`. §I item 3 cited R24 only for the status-route cut and left the pagination rule stranded in the team papers. R42's render side (`.fl-empty`, no dot, the row kept in the picker) travels with it so the two cannot drift.
3. **Design doc, *The to-do store*: three `Todo` indexes → two** (round 3's settled list; R35's "two indexes, two queries").
4. **Design doc, testing: `personalView.test.ts`'s "20 / 8 bounds"** — the 20 bound stands; the 8 bound and `+N more` survive only where a bound still has a consumer, never inside an open day (R51b).

**And the one that is a real decision:**

5. **The eleven ratified strings go into the content deck**, as a new dated section, verbatim as R54 approved them, with the two nodded rules and a note that `Up to 10 calendars.` is Riku's own existing string kept as a press outcome (R43).

**Reason.** The deck is the authority on every string — P8's companions table states it outright and gives the deck the win on any conflict, and P10 inherits that. Eleven approved strings living only in the visual spec would split that authority in two, and the next person to change one would have no way to know which document governs. The strings are Riku's own ratified wording going into Riku's own strings document; that is bookkeeping, not authorship.

**Three things explicitly *not* corrected**, recorded because each looks like an oversight and is not:

- **Deck §13's day rows stay expanded.** §13 specifies what is *on* those days; the disclosure decides how it is *shown*. The deck is content and the mockup is render.
- **Deck §5's "The accent belongs to the hero (Today) and to real state" stays exactly as written.** That sentence was made false by R8, which took all hue off the hero. R79 makes it true again. The deck was right and the design caught up to it.
- **R50 stays out of the deck.** The shell is not page content. It belongs in the design doc, in `ARCHITECTURE.md` §7 as S20, and in the visual spec's shell section.

---

## What this costs the round, and the order that follows

The mark changed after the mockup was redrawn, so the mockup is one mechanism behind again. **The spec is not written against a design that is no longer the design.** The order is:

1. **The Mockup Builder** draws the ramp (below) and republishes to `b81d7e29-3126-4a20-882a-5bdb982debc3` — never a second artifact.
2. **Docs corrections** run in parallel; they touch the design doc, the content deck and `ARCHITECTURE.md`, none of which the ramp reaches.
3. **The Spec Editor** writes `docs/superpowers/specs/2026-09-11-p10-personal-page-visual-design.md` carrying R1–R85 and every corrections table, with the ramp's measured numbers in it.
4. **The Build Planner** writes Plans A/B/C last, against the finished spec.

---

## The fix pass — brief for the Mockup Builder

Edit `docs/design/p10-mockup.html` in place. Read this file, then `round5-system-rulings.md` (R70–R76, whose machinery this amends), then `round3-lead-rulings.md` R8/R9/R18 and `round4-lead-rulings.md` for anything either refers to. **Rulings here win over R70–R72 where they differ.**

**Do:**

1. **Build anchor 8** (R81) — tune the two stops against the four existing tints, report the values and why.
2. **Interpolate the six intermediate steps** (1, 2, 4, 5, 6, 7) on R79's two segments, check them by eye as a strip, and freeze them as literal hex. Report the nine pairs as a table.
3. **Replace `.is-clear` / `.is-busy`** with `.pe-t0`–`.pe-t8` (R80). Retire the two old classes and any markup still referencing them.
4. **Redraw specimen 01's tint section**: all nine states as one strip at span 8, so the ramp can be judged as a ramp and not as nine unrelated tiles; then the three anchors at span 4 and at 106px; then the untinted render, captioned with its one new meaning (R83). The busy end must carry a genuine overdue row so `--missing` ink sits on the red wash — that is now the worst case for legibility, not the orange one.
5. **Re-tint every hero on the page** to its true count under R79 — specimen 01's blank week is 0 (green), specimen 02's busy week is whatever its `Due` group actually holds, and specimen 05's calendar-failure pane is still driven by its to-do read alone (R74).
6. **Redraw specimen 06's two hero panes tinted** (R78) and replace the "not tinted, on purpose" caption with the ruling.
7. **Update the closing section**: both open items are now closed — R78, and R73's overdue flag declined by Riku. Say so.

**Report back, numbers not claims:** the nine gradient pairs and nine border colours; anchor 8's two stops and the calibration that produced them; rendered contrast for `.eyebrow`, `.fl-h`, `.pe-grp`, `.fl-empty`, `.pe-nm` and `.pe-due.is-late` against **all nine** states at 609px, and against the three anchors at 297px and 106px; whether the ramp reads as a ramp in the strip or as visible steps (and if it steps, where); whether the red end reads as a tint rather than an alarm at 609px; the `diff` for the three verbatim groups; file size; and any ruling you could not follow and what you did instead.

**Constraints unchanged:** no JavaScript; the three verbatim groups byte-identical; no bare `.tile`; `pe-` only in the personal group; **no new semantic hue token** (the ramp spends existing hues, it does not add one); no `--alert`/`--amber`; no `@media` beyond reduced-motion; the product name nowhere; deck strings verbatim; proposed strings marked in captions only; under 600 KB; Write/Edit for the file, not heredocs. **Render it before reporting** — serve a scratchpad copy, open it in Chrome, measure with `getBoundingClientRect()` and read computed colours from the DOM.
