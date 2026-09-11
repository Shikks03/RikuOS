# P10 round 2 — System Keeper

**Date:** 2026-09-11 · **Role:** System Keeper · **Round:** 2, after reading the other four round-1 papers and the lead's thirteen questions.
**Re-checked at HEAD `19fa4b1`:** `tokens.css` (no `--tint-session`; `--session` "defined and unused on purpose") · `components.css` `:72` `.navitem.is-active{background:#171B21;box-shadow:inset 0 0 0 1px var(--line)}`, `:216–253` `.segmented` (9px track literal), `:281` `.stat .fig{margin-top:auto}`, `:291` `.stat.roi`, `:366` `.sumrow::after`, `:447` `.fl-fail`, `:475–478` `.fl-warn` dots, `:496` `.btn:disabled` · `components.html` `:469–478` `.layer`/`.swx`, `:483` icon button, `:492` `.ev` 3px, `:498` `.day.today` · `legacy.css:70–88` · `DESIGN-INSPO` §2 ("`--raised` — Cards. One step up from panel, never two"), §3 Radii and the Never list · `layout.tsx:54` `maximumScale:1`.

---

## Where I now agree

**Grid Architect §4.3 / §8.3 — container queries.** I was wrong to cut "any third breakpoint" and to key row-stacking off the span class. A span class says how wide a tile was *asked* to be on a 920px grid; a container query says how wide it *is* — and the same tile is span 8 in row 1 and span 2 in row 4. Plumbing, not vocabulary: no token, size, hue or face.

**Grid Architect §4.2 — the radius split.** He reads `DESIGN-INSPO` §3's table more literally than I did: 10px "plain cards", 14px "feature cards". Six tiles at 14px means no tile is the feature. Five at `--r-card` and Today at `--r-feature` gives the hero a permanent hue-free mark that travels with the tile when Riku moves it — the job he wants the accent to do.

**Grid Architect §8.1 — `collapseRow`.** Σceil(sᵢ/2) = 6 + (#odd)/2 for a full row, and a full row's odd spans always come in pairs, so any full row with an odd span overflows. One rider he did not draw: it can push *any* tile to 1 of 6, so the legibility specimen must be built at the bottom of the six-column band (~106px), not at 141.67px.

**Grid Architect §10 — `space-between` in the blank hero.** `.stat`'s bottom-anchored figure (`components.css:281`) is the reference doing exactly this on the card that reads `0` most days. I withdraw my objection under a bound: two always-present named groups only (Today alone), internals unchanged.

**Honesty Critic §3.5 / §10 — the em-dash and the 106px marker.** My §4.5 was wrong: `—` is a *per-day* claim and a tile-level sentence cannot carry it; §5.14 rule 3 cuts his way. His width argument then closes the case I opened myself — at 106px both sentences are the same small grey paragraph, so the distinction rides on a mark. On *which* mark we converge: he refuses `.fl-fail` and lands on `.fl-warn.is-stale i`, I proposed `.fl-fail`'s shape with an amber dot, and it is the same 5px disc and glow. Only the sentence's register stays open, and I keep `.fl-fail .said`'s 13px `--ink-2`, one ink step above `.fl-empty`'s `--ink-3` on the same baseline.

**Interaction Designer §4 — the whole row is the switch.** 26×15 is 390px² and not a thumb target: a deviation from `components.html:475`, and the right one.

**Frontend Architect §4 / §5.** His split rule is my §8 stated better, with Plan C's one-CSS-edit discipline as the evidence I lacked; and one `TodoRow` serving four tiles is the row grammar I specified four times without noticing it was one component.

---

## Where I still disagree

### Grid Architect §7 — the `--session` tint versus the no-hue ground

I hold: **Today takes `#171B21` plus an inset hairline and no hue at all.**

1. **`DESIGN-INSPO` §3's Never list, verbatim: "A hue used decoratively where it does not carry its assigned meaning."** `--session` means *activity, runs, workflow chains*. On deck §12 — the measured, primary render — the hero says `Nothing scheduled.` and `Nothing due.` A 208,000px² blue panel over those two sentences asserts activity the tile's own body denies; §5.14 rule 2 and `.stat`'s 0% rule say it twice more.
2. **The tint cannot drain, and draining it is worse.** `.stat.roi` is licensed by a hued *meaning* plus a hued figure; strip the figure and the tint carries a meaning the tile lacks. Staying honest would need the ground reverting to `--raised` on an empty day — a bigger visual event than the accent it is trying to be.
3. **His premise is false, and that is load-bearing.** He argues the accent is the only thing identifying Today once it leaves row 1, having ruled out *textual* hue. But the reference's idiom for "this is the current one" is neither textual nor hued: `.navitem.is-active` and `.day.today` are both `#171B21` + inset hairline, and §5.11 says of the today cell, "Not a coloured ring, not a filled circle." It is a property of the tile, permanent, surviving every span and row exactly as his tint would — and with the radius split, Today carries two hue-free marks.
4. **Blue is already spoken for here.** §5.11 maps Classes → `--session` and P11 populates that layer, so a blue hero on a page listing Classes events teaches two meanings for one hue on one screen — and `--tint-session` spends the one deliberately unspent hue on the app's largest object, permanently.

**Settle it on specimen 01:** the blank hero three ways at span 8 and again at span 4 — `--raised`, `#171B21`+inset, his tint at a 45% stop — judged against `Nothing scheduled.`, not a full day. If pixels overrule me the fallback is more contrast, not hue: he is right that hueing one eyebrow of six breaks eyebrow grammar, which kills my own round-1 fallback.

### Grid Architect §4.2 — `--panel` as the tile ground

`DESIGN-INSPO` §2 is one sentence against it, and his area argument carries two unpriced costs. **His own empty cell depends on the contrast:** the cell is `--void` `#08090B`, a `--panel` tile differs from it by (6,7,8) in RGB and a `--raised` tile by (12,14,17) — at `--panel` the hole and the tiles nearly share a ground and "one empty cell, left blank on purpose" reads as a rendering gap. And my §5.8 puts the grid in a `--panel` well in edit mode, the one ground §2 assigns to section wells and the only unspent one left; tiles at `--panel` delete that move. His P8 precedent is one alarm card choosing to recede, not a page-wide swap.

### Interaction Designer §3 / §5.1 — control sizes against the scale

Two of three I take (below); I hold the **radius**. `border-radius:5px` on the tick is a literal with no source, and `.ev` ships 3px for exactly this object — a small square that is not a tag. `.segmented`'s 9px is precedent for having *a* literal, not a licence for a second at a different value. **15px box, 3px radius.** And one consequence of his 16px fields he did not price: 16px in the body face is above every body size on the page (13px rows, 12.5px snippets). It goes into §5.3 as a **control** dimension, not a text step — it never competes with content because the form replaces the tile's body — or a later reader reads it as licence for 16px prose.

### Honesty Critic §3.4 — red on `No push this morning.`

He wants `--missing`; my §4.4 said no hue on this tile ever. I move halfway, on his own finding: the tile reports the *record*, not the send, so red can fire on a Mongo write failure — "a false alarm with a schedule", his words. **The dot is permitted only if the tile can tell a missing send from a missing record** (Q8's `AgentRun` read); without it, hueless. Either way the hue lands on `.fl-warn.is-missing i`'s dot, never on the sentence and never on the quoted push, which stays `--ink` whatever it reports.

### My own §5.5 — `Section` as `.segmented`

I withdraw it rather than defend it. `.segmented` is ~240px for three tabs; the To-do body is 263px at span 4 and 107px at span 2, and a control that fits at exactly one span is not a control on a page whose premise is any legal arrangement. `Section` becomes a `<select>` styled as `.fld`, with the Interaction Designer's `appearance:none` plus `.sumrow::after`'s geometry so the page has one chevron shape — a variant removed, not added.

---

## What I concede

- Radius `--r-card` on five tiles and `--r-feature` on Today; container queries, and the span-class row-stacking rule that went with them.
- Tick box **15px** (an optical line with `.swx`), radius 3px; fields at **16px** as a control dimension, labels 12px `--ink-3`; namespace **`pe-`**, one prefix, as the P8 architect reserved.
- The off layer's name at full `--ink-2`: the reference's 35% exists because its rows carry colour dots, ours do not, and the name is what Riku reads to switch it back on. The knob keeps my contrast ladder.
- `Section` as a select, the shared chevron, and the `—` rule in full.
- Suspense on the two calendar tiles, with a rider: the fallback renders border, ground and eyebrow and **no sentence, no skeleton** — an unanswered read is not a measured emptiness.

---

## Revisions to my round-1 paper

1. **§2** — "`--r-feature` 14px, not `--r-card` 10px" becomes: `--r-card` on all six, `--r-feature` on Today alone.
2. **§3** — `.tl-*` becomes `.pe-*` throughout (`.pe-head`, `.pe-grp`, `.pe-form`).
3. **§4.1** — "key it off the span class the server already emits" becomes: key it off a container query on the tile's own inline size, at a threshold the mockup measures.
4. **§4.5** — "the tile-level sentence is load-bearing for the em-dash's honesty" becomes: a day prints `—` only when every source that fills it answered; otherwise blank ground, and with both feeds down the day rows do not render.
5. **§4.4** — "No hue on this tile, ever" becomes: no hue on the quotation ever, and the `--missing` dot on `No push this morning.` only if the tile can tell a missing send from a missing record.
6. **§5.2** — "14px square (`--sp-4`)" becomes 15px square; radius 3px unchanged.
7. **§5.5** — "`.fld` … `font-size:13px`" becomes 16px, a control dimension; "**`Section` is `.segmented`, not a select**" becomes a `<select>` styled as `.fld` with `.sumrow::after`'s chevron.
8. **§5.7** — the dashed cell becomes **one** rectangle spanning the row's whole leftover, not one per column.
9. **§7** — the row-minimum arithmetic (`340 / 172 / 285 / 120`) is superseded by whatever the mockup measures; the two rulings under it stand.
10. **§7 ruling 2** — "do not centre content in it" is narrowed to: `space-between` for Today's two always-present groups only.
11. **§8** — substance unchanged; the file is `src/styles/personal.css`, fifth in the import order, and `components.css`'s "two namespaces and no third" header line is amended in the same change.
12. **Questions for the lead, item 3** — unchanged and now uncontested; `chip:{label,tone:"plain"|"late"}` is the same two-ink model in a view type.

---

## Positions on the round-2 questions

| Q | My position | Confidence |
|---|---|---|
| Q1 | **Not mine** (shell scope) — but the reference defers the rail's phone form wholesale (§7.1) and a page phase must not invent shell vocabulary: specify the 1-column step, ship it unreachable, name the phone pass. | medium |
| Q2 | Adopt `collapseRow` on the server; rider — it can drive any tile to 1 of 6, so the legibility specimen is built at ~106px, not 141.67px. | high |
| Q3 | Adopt, grid and in-tile; it adds no token, size, hue or face. One cap: the width bands may not multiply type — one heading, two sizes (19px / 15px), never three. | high |
| Q4 | **Bank it** — `#171B21` + inset hairline (`.navitem.is-active` / `.day.today`) plus `--r-feature`, no hue and no `--tint-session`; a blue panel over `Nothing scheduled.` is §3's Never list. Show all three grounds on specimen 01. | high |
| Q5 | Weights are minimums and the spec records the **measured** blank render beside them, never a number a build must tighten rows to hit; a sparse row dropping to `auto` is safe, and the default (12/11/12/12) never triggers it. | medium-high |
| Q6 | Fifth stylesheet `src/styles/personal.css`, namespace `pe-`, with the six shared controls in `components.css` because Settings' layer picker ships this same phase on another page; amend the "two namespaces" header line in that commit. | high |
| Q7 | **Not mine** — no visual consequence either way; weak lean to the script, which removes surface instead of adding a flag someone has to remember to switch off. | low |
| Q8 | **Not mine on the sentence** (strings are Riku's), mine on the register: "went out, wasn't recorded" is a missing *record*, so `.fl-absent`'s 11px `--ink-4`, no dot — and without the `AgentRun` read, `No push this morning.` cannot be red. | medium |
| Q9 | A day prints `—` only when every source that fills it answered; otherwise blank ground under the tile's reason, and with both feeds down the day rows do not render — blank ground is the absence of a mark, so it costs no vocabulary. | high |
| Q10 | Absence by configuration: `.fl-empty`'s register, `--ink-3`, no dot, no hue, naming the Layers tile as the lever; not a problem count in the push (R57). The sentence is Riku's. | high |
| Q11 | Mostly no new strings: a header count over a failed body is **absent**, not zeroed (R72); busy labels are `.btn`'s mono caps plus `.btn:disabled`'s `opacity:.45` (R67); press outcomes take `.fl-note`'s recipe under a distinct `pe-` class — not a new 11.5px/`--ink-3` pair no shipped rule uses. | medium-high |
| Q12 | Leave the arrangement whole and put the floor on the **control**: below ~180px of tile width the `+ Event` / `+ To-do` pill is disabled with its reason, the same shape the Honesty Critic wants when Google is not connected. | medium |
| Q13 | Both unchanged and now unanimous: due meta is a right-aligned mono 9.5px tabular column, `--ink-3` versus `--missing`, no box either way; the empty cell is bare ground in normal view and one dashed rectangle spanning the whole leftover in edit mode. | high |
