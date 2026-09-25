# P10 round 5 — the System Keeper's rulings on the state-driven hero

**Date:** 2026-09-24 · **Written by:** the System Keeper, after reading `round5-riku-answers.md` (R50–R55, the MARK section's R52 and its five open questions), `docs/design/p10-mockup.html` (tokens block, `.pe-tile`, `.pe-tile.is-hero`, `.stat.roi`/`.stat.stale`, the four closed hero variants), `round3-lead-rulings.md` (R8, R9, R10, R18) and `round4-lead-rulings.md` (R44, R45). **Status:** rulings for the mockup fix pass; the Interaction Designer is using R56–R69 in parallel for the day-row disclosure (R51b) — this file does not touch that mechanism. R-numbers continue at R70. **HEAD:** `3aa9e3e`, `src/` unchanged since `21e4564`.

**What is not reopened.** Green when clear, orange when busy, threshold at four or more, is Riku's ruling (R52) and stands. Nothing below argues the hue, the direction, or the number. What follows is the machinery that makes R52 true everywhere it touches — the two recipes, the states in between, what "pending" counts, which read gates it, what edit mode does to it, and the one comment in the codebase that this ruling makes false if nobody amends it.

**The load-bearing finding, first.** The Today tile already renders the exact signal this ruling needs, for free. The `Due` group under the hero's `Scheduled` group is one merged list of due-today-and-overdue to-dos (`docs/design/p10-mockup.html:1620–1631`, `:2620` area); when it is empty it prints `Nothing due.` (`.fl-empty`); when the to-do read failed it prints `Couldn't load to-dos.` (`.pe-fail`, line 1809) in place of the group entirely. **The hero's tint state is a direct read of that group's already-computed row count — no new query, no new field.** `Nothing due.` renders ⟺ pending = 0 ⟺ green. The group holds 1–3 rows ⟺ the untinted middle. The group holds ≥4 rows ⟺ orange. `.pe-fail` renders in its place ⟺ the read failed ⟺ untinted, same render as the middle band. Everything below is this mapping made precise.

---

## R70. The two tint recipes — ported, not invented, from the system's own reference

```css
--tint-spend: linear-gradient(155deg, #2A1408, #141013 62%);
--tint-save:  linear-gradient(155deg, #052620, #0F1417 62%);
```
Border, same shape as the shipped pair: `.pe-tile.is-hero.is-busy{border-color:rgba(255,138,61,.2)}` · `.pe-tile.is-hero.is-clear{border-color:rgba(53,211,153,.2)}`.

**Decision.** `--tint-spend` (busy, orange) and `--tint-save` (clear, green) join `--tint-roi` / `--tint-stale` in `tokens.css`, in the same `155deg` / deep-stop / near-neutral-at-62% shape the comment above them already names.

**Reason.** These are not new values. `docs/design/DESIGN-INSPO.md`'s own "Card tint recipe" section (lines 83–91) already specifies `.stat.spend{background:linear-gradient(155deg,#2A1408,#141013 62%);border-color:rgba(255,138,61,.2)}` and `.stat.save{background:linear-gradient(155deg,#052620,#0F1417 62%);border-color:rgba(53,211,153,.2)}`, mirrored verbatim in `docs/design/components.html:253–256`. They were never ported into `tokens.css`/`components.css` because P8 never shipped a spend or save stat card — only `--tint-roi` and `--tint-stale` had a consumer. P10 is that consumer for the other two. Porting them is the same move R8's team made for roi/stale: take the reference's already-tuned near-black stop for that hue, don't retune.

**Checked against.** WCAG relative-luminance contrast, computed by hand at both named gradient stops (the 0% deep stop and the 62% near-neutral stop — the gradient holds flat from 62% to 100%, so these two stops bound the whole surface a browser will paint):

| Foreground | On `--raised` (baseline) | On tint-spend, deep stop `#2A1408` | On tint-spend, 62%+ `#141013` | On tint-save, deep stop `#052620` | On tint-save, 62%+ `#0F1417` |
|---|---|---|---|---|---|
| `--ink` (titles, `.fl-h`, `.pe-nm`) | 15.1:1 | ~14.5:1 | ~15.9:1 | ~13.0:1 | ~15.6:1 |
| `--ink-2` (`.fl-snip`, `.pe-sw .nm`) | 6.87:1 | 6.69:1 | 7.22:1 | 6.16:1 | 7.10:1 |
| `--ink-3` (`.eyebrow`, `.pe-grp`, `.fl-empty`) | 2.99:1 | 2.91:1 | 3.15:1 | 2.68:1 | 3.09:1 |
| `--missing` (`.pe-due.is-late`, overdue rows) | 6.49:1 | 6.32:1 | 6.82:1 | 5.82:1 | 6.70:1 |

Every ratio sits within a few hundredths of the existing `--raised` baseline in both directions — the two new near-neutral stops (`#141013`, `#0F1417`) are, if anything, very slightly *darker* than `--raised` by the WCAG luminance formula despite reading as warmer/cooler, so light text gets marginally more room, not less. `--ink-3` was already sub-4.5:1 on plain `--raised` (it is meta ink by design, the same register R12 accepts at 1.75:1 for `--ink-4`'s absences) — the tint does not make that worse. `--missing` (overdue red, the case that matters most: red ink sitting on the orange tint) stays comfortably above 4.5:1 at both stops. Nothing here needs a different ink token.

**To be measured by the builder.** The two bounding stops, not the continuous gradient in between — render both `.is-busy` and `.is-clear` at span 8 (609px), span 4 (297px), and the 1-of-6 width the hero already appears at today (106px, `docs/design/p10-mockup.html:2608–2617` — a narrower case than either width this brief named, and the hero is legitimately reachable there through the editor). Confirm the eyebrow and the `Due`-group row nearest the tile's top-left corner (closest to the deep stop at 155°) still read, and that at 297px — closer to square than the 609px hero — the gradient still visibly reads as a *tint* and not a flat wash (a 155° diagonal covers proportionally more of a near-square box's short axis than a wide one; this is a look-at-it check, not a contrast one). Report the actual rendered minimum, not the two hand-computed bounds above.

---

## R71. The border moves with the tint; the radius never does

**Decision.** `--r-feature` is invariant — every hero render, tinted or not, keeps R8's radius. The border is **not** invariant: `.pe-tile.is-hero` (untinted — the third state and the no-data state, R72) keeps R8's `--ink-4`; `.is-clear` and `.is-busy` lift the border to their hue at `.2` alpha, exactly as `.stat.roi`/`.stat.stale` already do.

**Reason.** The question named its own answer: "a tinted hero with a neutral border may read as unfinished." The shipped tint pattern agrees with itself here — every tinted card in the system (`.stat.roi{border-color:rgba(167,139,250,.2)}`, `.stat.stale{border-color:rgba(251,191,36,.2)}`) lifts its border to its hue; none of them keeps a hueless border under a hued fill. There is no precedent in the codebase for a tinted-fill, neutral-border card, so inventing one here would be the actual new pattern, not the safe default. R8's `--ink-4` border was chosen *because* the hero carried no hue; once it carries one, R8's own reasoning argues for the hue border, not against it.

**Cost.** None structurally — this is restating the existing pattern's own rule onto a new pair of hues. The only thing that changes is that the hero's border now has three possible colours instead of one (`--ink-4`, `rgba(255,138,61,.2)`, `rgba(53,211,153,.2)`) where every other tile on the page has exactly one (`--line`). That is the accepted cost of R52 itself, not a new one.

---

## R72. The third state, and the no-data state, share one render: R8's untinted ground

**Decision.** A day with one, two or three pending items renders the hero exactly as R8 ruled it — `#171B21`, `--ink-4` border, `--r-feature` radius, no hue. A day whose to-do read failed renders the same way. These are the same CSS class (`.pe-tile.is-hero` with neither `.is-clear` nor `.is-busy`), not two neutral-looking states that happen to coincide.

**Reason.** The cheaper answer named in the brief is the right one, and it is cheaper for a reason beyond "one fewer state": an untinted hero doesn't assert *anything* about the count, and that is true whether the honest count is "a few" or "unknown." Giving the middle band its own visual (a fourth colour, or a half-step between green and orange) would imply a claim — "some, but not many" — that costs a second hue-adjacent surface for a case Riku never asked to see distinguished; he asked for two states with a line between them, not a gradient of concern. Collapsing "1–3" and "don't know" onto the same render also means the honest-render rule (R18/R45's family) needs no hero-specific carve-out: the untinted hero was already the page's "I am not claiming a state" render before this ruling, and it stays that after.

**Cost.** Riku cannot tell "a couple of things today" from "the to-do store didn't answer" by looking at the hero's colour alone — he has to read the `Due` group's content (a short list of rows, versus the amber-dotted `Couldn't load to-dos.` sentence) to tell them apart. That is by design: the dot and the sentence are R9/R10's existing mechanism for "a feed did not answer," and duplicating that distinction onto a second surface (the tint) is exactly the kind of redundant hue-spend R9 closes the door on ("hue appears in exactly four places" — this ruling adds a fifth *place*, the hero background, but does not ask that place to also carry the read-failure distinction; R10's dot keeps that job alone).

---

## R73. What "pending" counts

**Decision.** `pending = to-dos due today + to-dos overdue`. Nothing else. Scheduled calendar events never count, regardless of how many. This is the same count for both thresholds — zero for green, ≥4 for orange — not two separately-computed numbers. **An overdue to-do does not, by itself, force the busy tint.** It is already inside the count like any other pending item; one overdue item with nothing else due today yields `pending = 1`, which is the untinted middle band (R72), not orange.

**Reason.** Riku's word was *task*; the page's word for a task is a to-do; a scheduled event is never tickable and R51's/the content deck's own vocabulary already treats "task" and "to-do" as the same noun. That settles events out.

The overdue question needed a judgment call, and the call is: don't give lateness a second escalation channel. R9 already spends `--missing` on overdue rows (`.pe-due.is-late`, item 1 of R9's four places) — that is the system's one fixed answer to "this is late," and it fires per-row, at full saturation, regardless of the hero's state. Layering a second, coarser escalation (the whole tile turns orange the instant *any* item is late, even one, even with nothing else due) would mean the hero's colour no longer tracks the number Riku actually named — "a lot of tasks" — it would track a boolean that has nothing to do with volume. It would also make the count-based rule harder to reason about: a day with exactly one late invoice and nothing else pending would look identical, hue-wise, to a day with four fresh due-todays, even though Riku was shown and approved a *volume* signal, not a *lateness* signal. The volume signal already includes lateness in its count; that is enough.

**Cost, stated plainly, because this is the one sub-ruling most likely to get a different answer from Riku.** If he wants any overdue item to force orange outright, the fix is a single independent `OR` condition added to the same computed value — it does not restructure anything this document rules, and nothing else in R70–R77 depends on this specific call resolving one way. Flag it to him as a one-line yes/no, not a redesign.

**Implementation note, not a visual ruling:** the threshold is one named constant (Riku may change the number; R52 already says so), read once, not re-typed at each call site — e.g. `PERSONAL_HERO_BUSY_AT = 4`. The three states are one value, not two independent booleans: a view model field like `heroTint: "clear" | "busy" | null`, never two flags that could both be true at once. This is a build-phase note, carried forward so the Spec Editor doesn't have to re-derive it.

---

## R74. The tint answers to one read only — the to-do store's — and a calendar failure never touches it

**Decision.** The hero's tint is decided exclusively by whether the to-do store's phase-1 read (R34's one-deadline Mongo `Promise.all` — settings, open to-dos, done to-dos, *LastDigest*, the dispatcher run) succeeded, and if it did, by the `pending` count it returned. Whether `readCalendarWindow` (phase 2, R34/R37) succeeded, failed, or reports `none-enabled` has **no bearing on the tint at all** — events never counted toward `pending` (R73), so their read's outcome is irrelevant to a question that was never about them.

**Reason.** This is what R18/R45's honesty pattern already says, made specific to this surface: a render may only claim what it read. The to-do read is the only read `pending` depends on, so it is the only read the tint depends on. Making the tint *also* wait on the calendar (e.g. "don't tint until both feeds answer") would be over-caution that contradicts R73 — it would withhold a true, known fact (today's to-do count) because of an unrelated read's outcome.

**This has a concrete, checkable consequence in the mockup already drawn.** Specimen 05's 1-of-6 comparison (`docs/design/p10-mockup.html:2613–2617`, labelled "Did not answer") currently shows the hero with `Couldn't read the calendar.` under `Scheduled` and `Nothing due.` under `Due` — a calendar failure sitting beside a successful, empty to-do read, in the mockup as it stands today. Under this ruling that pane's hero is `.is-clear` (green), not neutral, exactly like its neighbour ("Read, empty") which has no failure at all. **The fix pass must re-tint every specimen-03 and specimen-05 pane where `Due` renders a real value (a count, an empty sentence, or fewer than four rows resolving to the untinted band) rather than `Couldn't load to-dos.`**, even where `Scheduled` shows a Google failure. Before this ruling every hero in the mockup used the one neutral render regardless of state; this is the one place the fix pass touches renders outside the specimen-01 hero comparison, and it is easy to miss because it looks like "no change needed" at a glance.

The database-down render (deck §11, specimen 03) is unaffected: both feeds fail there, so `Couldn't load to-dos.` renders and the hero stays untinted (R72) — the render the round-4 rulings already fixed (eight amber dots, one per tile) needs no further change.

---

## R75. The tint survives edit mode unchanged

**Decision.** Entering edit mode does not touch `.is-clear` / `.is-busy` / the untinted default. The tint (background and border) is not dimmed, not suspended, not swapped for a fourth "editing" treatment.

**Reason.** R44 dims *controls* — the pills and switches inside an `inert` region take `.btn:disabled`'s `opacity:.45` because they genuinely stop responding. The hero's tint is not a control and it does not stop responding to anything; it is a structural fact about the tile, the same category R8 already put the ground, border and radius in ("all three travel with the tile when Riku moves or shrinks it"). The tint joins that set as a fourth structural fact, for the same reason the other three survive a move: the day's pending count does not become less true because Riku opened the layout editor, and a tile that goes quiet about its own state the one moment he is looking at several tiles side by side (deciding what to rearrange) is a worse render, not a more consistent one. R44's own framing — "the tiles keep rendering live data" — is the argument for keeping the tint, not against it.

**Cost.** None. The `--panel` well (R30) that the grid sits inside during editing is a neutral dark ground behind every tile equally; a tinted hero inside it reads no differently than the current `#171B21` hero already does inside that well in every drawn edit-mode specimen.

---

## R76. The token comment — exact amended wording

**Decision.** Two files change, one line each, in the same commit as this ruling's build.

**`src/styles/tokens.css`** — the block comment at the top of the semantic-hues group (line 46) changes from:
```css
  /* semantic hues — meaning is fixed */
```
to:
```css
  /* semantic hues — meaning is fixed, with one recorded page-local
     exception noted at --spend below (P10 R70–R74) */
```
and the `--spend` declaration itself (line 47) gains a trailing comment:
```css
  --spend:#FF8A3D; /* money out, limits consumed, the brand mark — and,
                       on the Personal page's hero tile only, a busy day */
```

**`docs/design/DESIGN-INSPO.md`** — the "Semantic hues — meaning is fixed" table (line 68) is not rewritten; a footnote is added directly under the table, in the same register R9's layer-hue decline and R42's vanished-calendar note already use for a page-local deviation from a system-wide rule:

> *One recorded exception: the Personal page's hero tile reuses `--spend` (busy) and `--save` (clear) as a background tint keyed to the day's pending-task count. This is a page-local reading, not a second global meaning — no other surface may follow it without its own ruling. See P10 round 5, R70–R74.*

**`docs/design/components.html` is not edited.** It is the frozen teardown reference — `tokens.css`'s own NAME MAP comment already treats it as a source to translate *from*, not a document that tracks the shipped system, and R32/R46's precedent never edits it either. Its `.stat.spend`/`.stat.save` swatch entries stay exactly as written; they are the citation this ruling ports *from*, not a claim this ruling needs to correct.

**Reason.** `--save`'s row ("Value recovered, healthy, connected.") is not amended: "clear, nothing pending" reads as a specific case of "healthy," not a new meaning the way "busy" is a genuinely new fact for `--spend` (which otherwise means money, never workload). Only one row needed a comment, and only one file needed a rewrite; the other file needed a footnote because a page-local exception is not the same thing as a changed system rule, and DESIGN-INSPO.md's own convention (R9, R42) is to record exceptions beside the rule, not inside it.

**Cost.** None beyond the two edits. This is documentation, not code; it ships with the same commit that adds `--tint-spend`/`--tint-save` so the file is never in a state where the comment and the code disagree.

---

## For the builder

**States to draw**, each as its own labelled specimen (the existing hero-B/C/D variants at `docs/design/p10-mockup.html:1264–1266` and their eight frames at `:1450–1487` are dead — R52 already closed them; retire the CSS and the markup, don't leave them unreferenced):

1. `.pe-tile.is-hero` — untinted, R8's original render. Serves both "1–3 pending" and "to-do read failed." Draw one of each so the caption can say they look the same on purpose.
2. `.pe-tile.is-hero.is-clear` — `Due` group empty (`Nothing due.`).
3. `.pe-tile.is-hero.is-busy` — `Due` group holding ≥4 rows (mix of due-today and at least one overdue, so the red `.pe-due.is-late` ink is visible sitting on the orange tint at the same time — this is the one composition that must be drawn, not just described, because it is the actual worst case for the contrast table above).

**At each of:** span 8 (609px), span 4 (297px), and 1-of-6 (106px, since specimen 05 already shows the hero there — see R74).

**Also draw:** the layout-editor well with a tinted hero inside it (one frame is enough — confirms R75 by inspection), and re-tint the specimen-03 and specimen-05 panes named in R74 wherever `Due` renders a real value rather than `Couldn't load to-dos.`

**Numbers to measure and report, not estimate:**
- Rendered contrast of `.eyebrow`, `.fl-h`, `.pe-grp`, `.fl-empty`, `.pe-nm` and `.pe-due.is-late` against both `.is-clear` and `.is-busy`, at all three widths — compare against the bounds in R70's table.
- Whether the gradient still reads as a *tint* (not a flat wash, not a visible hard edge at the 62% stop) at 297px and at 106px.
- Border colour distinguishability: `.is-hero`'s `--ink-4` border versus `.is-clear`'s and `.is-busy`'s hued borders, side by side, at 297px and 609px.
- File size and the three-verbatim-groups `diff`, per round 4's unchanged constraints (still binding: no JavaScript, `pe-` only in the personal group, no new *semantic* hue, no `@media` beyond reduced-motion, product name nowhere, under 600 KB).
- Any specimen-03/05 pane whose hero tint this ruling changes that the fix pass could not re-tint cleanly, and why.
