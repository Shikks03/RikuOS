# P10 round 4 — the Design Critic's brief

**Date:** 2026-09-18 · **Given to:** an Opus "Design Critic" subagent, re-dispatched after the first run (2026-09-11) terminated on the weekly rate limit before writing anything. Saved here so the review can be re-dispatched from scratch if it dies again. The rulings in `round3-lead-rulings.md` (R1–R37) bind the mockup; the critic ranks and recommends, the lead rules.

## Deliverable

`docs/superpowers/design/p10-team/round4-design-critic.md`, in the shape of `p8-team/round4-design-critic.md`: header (date, role, standing question, what was reviewed and how), `## 1. Verdict`, `## 2. Must fix before Riku sees it` (M1…), `## 3. Should fix` (S1…), `## 4. Notes` (N1…), `## 5. Rulings the mockup proved wrong`, `## 6. The builder's report, checked`. Each item: what is wrong, the evidence (numbers, mockup line numbers, the ruling it violates), the recommended fix. 15–30 KB. **M** = Riku would spot it or it contradicts a ruling; **S** = a designer would; **N** = worth recording.

## Inputs, in order

1. `p8-team/round4-design-critic.md` — the format exemplar.
2. `round3-lead-rulings.md` — R1–R37 binding; §J the specimens, §K the questions to Riku.
3. `round3-mockup-brief.md` — what the builder was told; rulings win over the brief.
4. `brief.md` §2 and §5 — what is settled; rules for every role.
5. The content deck `docs/superpowers/specs/2026-09-10-p10-personal-page-content.md` — every string deck-verbatim or one of the eleven proposed strings in §K item 6, marked "proposed" in its frame's caption.
6. `DESIGN-INSPO.md` §2–§3, §5; `components.html`; `src/styles/tokens.css`, `base.css`, `components.css`, `legacy.css` — the mockup's three verbatim groups must be byte-identical (diff, not eyeball).
7. `round2-design-critic.md` §2 C1–C7 and §3.1 — the critic's own round-2 arithmetic; the mockup must not repeat those mistakes.
8. `docs/design/p10-mockup.html` in full.

## Method

Render it. Wrap a scratchpad copy in a doctype/html/head/body shell (the host wraps the real file; a raw load is quirks mode), serve it on a port that is not 3000/3001, open it in Chrome via the `claude-in-chrome` tools in a new tab, screenshot every specimen, and **measure** with `getBoundingClientRect()` / `getComputedStyle()`: row tracks, tile widths per frame, the date field's intrinsic minimum, the tick's hit target, the hero four ways, the 1-of-6 tile at 706px. Every asserted number is rendered (say at what frame width) or computed from the CSS (say so). If the browser tools fail after two or three attempts, say so in the header and compute.

## What to judge

1. **The builder's arithmetic**, each claim checked: row 2 renders 198.25 not 180 (R15's 44px floor at span 3); the native date field's real minimum and the pairs threshold (builder: 146px border box, pairs at ≥368px, control floor ≈210px; specimen 06 draws 106/142/192/210/368); the event form growing row 1 to ≈420; eight amber dots on deck §11 corrected (the brief said four); the tick hit target at 33×40 against R25's ≥40×40; specimen 01's rows 340·198.25·240·120 and the B-panel's 340·198.25·365·120; zero coloured things on specimen 01; the three verbatim CSS groups byte-identical, no bare `.tile`, 7 `@container` blocks; the placement of `.pe-hi`, `.pe-pills`/`.pe-sep`, `.pe-cell.is-gap` (personal group) and `.pe-pick`/`.pe-pickrow` (a 7th item in the components-additions block) against R32; `legacy.css` copied into a mockup-only `:where(.legacy-doc)`.
2. **Each specimen against R1–R37**, ruling by ruling where a ruling names something visible, with the line or pixel that proves it.
3. **The blank week** — finished or waiting? the hero at a glance with zero hue? the labels as structure at `--ink-3`? `space-between` deliberate or air? the empty cell bare ground? the critic's own pick among the four heroes, with reasons.
4. **The narrowest cell** — 1 of 6 on a 706px grid, 106px tile, 80px inner: every control, what clips, wraps, is illegible.
5. **Strings** — deck-verbatim, proposed-and-marked, or wrong; the product name never; the `.spec-q` blocks put §K 1–7 in plain language with no class, token or R-number.
6. **CSS hygiene** — no bare `.tile`; `pe-` only in the personal group; no new token; never `--alert`/`--amber`; no `@media` beyond reduced-motion; `repeat(N,minmax(0,1fr))`; `min-width:0; overflow:hidden` on tiles; no `container-type` on any ancestor of the sticky header (R30).
7. **The hosting contract** — starts with `<title>`; one Google Fonts `<link>`; one `<style>`; no other external resource; no `<img>`; no JavaScript; dark-only; frames in `overflow-x:auto`; under 600 KB; no placeholders.

## Rules

Write only the review file. No edits to the mockup, specs, stylesheets or other papers; no code in `src/`. Every repo claim checked at HEAD `ada7491`. Cite `p10-mockup.html:NNNN` so the fix pass goes straight to the spot. Riku's ports 3000/3001 are never touched. Use Write, not heredocs (backslashes). Report back under 400 words: M/S/N counts, the three most important findings, the rulings proved wrong, rendered or computed.
