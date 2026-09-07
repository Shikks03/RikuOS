# P8 round 4 — the lead's rulings on the Design Critic's review

**Date:** 2026-09-06 · **Written by:** the design lead, after reading `round4-design-critic.md` in full against `round3-lead-rulings.md`. **Status:** the fix list for the Mockup Builder's single fix pass before Riku reviews the page. Nothing here reopens a round-3 ruling; two items exercise a choice round 3 explicitly reserved to this review (R17's breadcrumb test, R3's mark-field variant).

## Accepted as written — apply exactly as the critic specified

- **M1** Block C's five-column table on a four-column grid → `--fl-cols` variable, `.fl-table.is-campaigns`.
- **M2** hero figures on one baseline → reserve the track's 13px slot on cards without a track (`:has()` is acceptable; the app targets current Chrome).
- **M3** measured emptiness vs. a field that never arrived → `.fl-note` (`--ink-3`, measured) and `.fl-absent` (`--ink-4`, not reported); specimen 04's second mini gains one measured line above the absent one so its caption is true.
- **M4** the mark field scaled to the reference's graphic zone (150×52, `right:-14px;bottom:-11px`), same SVG, same count, same hue.
- **M5** `.fl-bound` becomes a sentence: 11.5px `--ink-4`, body face, left-aligned; it also serves Block E's `Showing 20 of 41.`
- **S1** `.stat.drained` for a measured zero (label and figure drain, caption stays `--ink-3`); `.stat.blank` reserved for `—`. Needs-you at `0` becomes `stat drained` in specimens 01 and 03.
- **S2** a hero card at `—` is shown once: a third mini in specimen 04 with the drafts card at `—` / `ShikksTracker didn't report how many drafts are waiting` beside the needs-you card at `0`.
- **S3** specimen 02's Block D gets its §8 collapsed line, `Email S1 — specific compliment first  11%`, formatted like `.fl-sum`.
- **S4** `Log out` at `--ink-3`. **S5** `Open ↗` on the drafts card at `--ink-3`. **S6** failed badge fill `.14/.03` so red outranks amber. **S7** `--tint-stale` first stop `#241A03`. **S8** `.fl-rows>.fl-row:first-child{border-top:0}`. **S9** remove the literal spaces around the middot in `.fl-sum`. **S10** `::selection` becomes `rgba(233,236,240,.16)`. **S11** `.agent.is-grey` drops its `background` override.
- **N9** `.fl-open` margin-top → `--sp-6` (28px). **N10** specimen 03's two variants stack vertically at 920px, 28px apart, no sideways scroll. **N11** `.fl-thead` → 9px / weight 500 to match `components.html`; `--track` stays `#1A1E25` per the written reference and R3.

## Ruled here

- **R25 — the breadcrumb goes; the stamp stays; the shell renders the stamp on every page.** R17 reserved this call to the mockup review. The critic's finding stands: `Operator` is the top bar's brightest element and names nobody in a system with exactly one user, and the crumb's `Freelance` restates the title 70px below it. The top bar keeps its 44px and its one live element, `read 14:32` (Asia/Manila), rendered by the shell from the request time — which on a `force-dynamic` page is the moment the data was read. The queue and settings bars carry the same stamp; nothing else. Riku may overturn this cheaply; it is presented to him as a change made, not a question.
- **R26 — `Campaign` stays as Block C's first column header and becomes the fifth new string put to Riku.** The deck heads only the four numeric columns. A headerless name column beside four headed ones reads unfinished, and `Campaign` parallels Block D's deck-authorised `Approach`. Specimen 04's Question 4 call-out lists it.
- **R27 — the Block D honesty note renders only when at least one rate is printed.** The builder's deviation (a) is adopted as the rule. The spec states it in those words.
- **R28 — the register difference between the hero caption `nothing waiting` and Block E's `Nothing waiting.` is deliberate.** Hero captions are lowercase fragments completing a label→figure→caption sentence (`of 30 contacts never contacted`); block bodies are sentences. No change (critic's N3).
- **R29 — the rail's six green badges are the page's largest colour mass, and that is accepted.** R16 stands. It is named to Riku as deliberate; if it reads loud to him the amendment is to R16 (ok → grey label, green border only), never a mockup-only tweak (critic's N2).
- **Specimen 05's caption is re-pointed** at the duplicated `Settings` link and the `RikuOS — Queue` h1 (the app name and the page name at display weight under a rail that already says both); the two `Log out` buttons are mentioned last. Question 3's wording moves the same way. The status-filter row's loss of a solid active state is named to Riku as the price of one-treatment-per-selector, not a defect.

## Not changed

- The orange `:focus-visible` ring is `components.html` verbatim; the `caret-color` never renders on P8 (critic's N4).
- Declared-but-unused vocabulary (`.statstrip`, `.btn.go`, `.statuspill`, `--session`) ships as is; the build must not add more (N5).
- `Checking…` is not drawn; §H did not ask for it; the build must not forget it (N7).
- Rail sizes above the reference's, the violet figure on the drafts card, and the legend as its own specimen: all justified (deviations d–f).

## Carried to the spec

- The 920px column holds four hero cards at `minmax(215px,1fr)` with 18px to spare; the round-2 case for 980px was arithmetic error (N1). Personal and Academics inherit 920.
- R27's condition, in words. The `Nothing waiting on you.` whole-block fallback (R5) and the three `Couldn't load …` block sentences are not in the mockup and must not be lost.

## Riku's answers — 2026-09-07, after reviewing the republished page

- **Q1 hero graphics:** plain. R3 stands as ruled; the mark-field variant is dropped and `.stat .marks` ships nowhere.
- **Q2 health-strip marker:** the glowing dot. R13 stands; `⚠` appears nowhere in the app.
- **Q3 duplicated inline headers on `/queue` and `/settings`:** delete. R18's one TSX exception is confirmed: the ~10-line inline header on each page goes; nothing else in those files changes.
- **Q4 wording:** all five accepted as written — `ShikksTracker didn't report how many are hot.` · `ShikksTracker didn't report every pipeline stage.` · `sites not checked since 2d ago` · `Rates are computed over small numbers of sends.` · the column header `Campaign`.
- **R25 (breadcrumb deleted, stamp only) and R29 (green rail accepted)** were offered as overturnable; Riku did not overturn either. Both stand.

The design is closed. Next: the visual-design spec, drafted from rounds 3 and 4 plus these answers.

## Rulings made while the spec was drafted — 2026-09-07

- **R30 — badge precedence follows the watchdog's existing order: off → never run → overdue → failed → ok.** R16's table listed failed above overdue. `evaluateWatchdog` checks stale before failed because a stale run's `ok` flag describes a run from before the outage, `watchdog.test.ts` pins that, and R21 requires those tests to pass unchanged. The rail must never disagree with the digest about the same agent, so the rail adopts the same order. R16's table is read with this precedence.
- **R31 — Block D is open by default only while every approach has zero sends.** Once any approach has a send, it is closed by default like Block C, and its collapsed line carries the best measured row. R11's "it opens today" meant exactly the no-sends state.
- **R32 — the 60-second floor is a pure function in `src/lib/healthSnapshot.ts`, tested in `src/lib/__tests__/`.** The route stays thin and calls it. There are no route-level tests in this repo and P8 does not introduce them.
- **The `heroGraphics` module named in R22 does not exist.** Riku chose the plain row; the contacts track is one percentage computed in `freelanceView`. R22 is read without it.
- **R19's "five stylesheets" is four** — `globals.css` was the fifth and is deleted.
