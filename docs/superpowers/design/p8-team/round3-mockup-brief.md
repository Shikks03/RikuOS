# P8 round 3 — the mockup brief

**Date:** 2026-09-06 · **Given to:** an Opus "Mockup Builder" subagent. Saved here so the mockup can be rebuilt from scratch if `docs/design/p8-mockup.html` did not land before the session ended. The rulings in `round3-lead-rulings.md` bind every line of this.

## Deliverable

ONE self-contained HTML file at `docs/design/p8-mockup.html`, published as an Artifact (hosted page) for Riku to review in a browser. The CSS is production CSS the Next.js build will port, written in four commented groups — `/* tokens */`, `/* base */`, `/* components */`, `/* legacy (queue re-skin) */` — plus a fifth `/* mockup-only */` group for document chrome, frames and captions.

## Inputs to read, in order

1. `docs/superpowers/design/p8-team/round3-lead-rulings.md` — binding; §H lists the states, §I the questions to make visible.
2. `docs/design/DESIGN-INSPO.md` and `docs/design/components.html` in full — port the app recipes (`.app-side`, `.navitem`, `.grouplabel`, `.agent`, `.topbar`, `.crumb`, `.stat`/`.stat.blank`, `.track`, `.btn`/`.btn.go`, `.tag`, `.statuspill`, `.statstrip`, the eyebrow/title pair, the `.debt` table grammar, the `.urow`/`.prow` row grammar, the honesty note). Do not port the teardown article's furniture or its `<script>`.
3. `docs/superpowers/specs/2026-09-05-p8-freelance-page-content.md` — every string verbatim; §3 today's data, §7 today's render, §8 the full render, §6 whole-page states.
4. The four Round 1 papers for recipes where the rulings are silent (System Keeper's tokens and recipes; Information Architect's wireframes; Frontend Architect §2.1 and §2.4; Honesty Critic §2 state matrix). Rulings win over papers.
5. `src/app/queue/page.tsx`, `src/app/queue/PushControls.tsx`, `src/app/globals.css` — reproduce the queue page with its existing class names only.

## Hosting constraints

No `<!DOCTYPE>`, `<html>`, `<head>`, `<body>` (the host wraps the file). Start with `<title>Freelance page mockup</title>`, then one `<link>` to Google Fonts for Archivo 600/700, IBM Plex Sans 400/500/600, JetBrains Mono 400/500/700, then one `<style>`, then content. No other external resource; every icon inline SVG; no `<img>`; no JavaScript beyond native `<details>`. Dark-only: `html, body { color-scheme: dark }`, `body { background: #08090B; color: #E9ECF0; margin: 0 }`, faces set explicitly. Every app frame at a fixed 1240px (170px rail + column with 28px side padding and 920px inner width), each inside an `overflow-x: auto` container. No media queries. Under 400 KB. No placeholders.

## The five sections (each: mono eyebrow, one-sentence caption, the question for Riku where §I names one)

1. **Today** — shell + page with deck §7 data as ruled: violet `24` / plain `25` with the 4px track / drained `0 nothing waiting`; no lines under the row; Block B three stages + the `Nothing yet at …` line; Block C collapsed `2`; Block D **open**, the four real approaches at `—` and `0` under `MEASURED — EMAIL` / `NOT MEASURABLE`, `No sends yet — nothing to compare.` as the collapsed line; Block E `Nothing waiting.`; quiet footer `Engine ran 2h ago · all sites ok · checked 6h ago` + `Check now`; six green badges (no tinted fill); top bar `Operator / Freelance · read 14:32`. End with a **badge legend**: off · never run · unknown · failed · overdue · ok per R16.
2. **Full** — deck §8 data, C and D open (11% / 6% email rows, `—` Facebook rows, explanation under the second group's heading, honesty note `Rates are computed over small numbers of sends.` under the measured group), Block E's three rows (name as link with `↗`, channel tag, waiting line, snippet, reason; overdue waiting line amber), `2 approved, not yet sent` under the row, health strip worst case as a bordered card with dot markers (engine 3d ago amber; 2 stranded red; Meowchi unreachable red; `AzeroTech ok · ShikksTracker ok`; `checked 6h ago`; `Check now`); in the rail one amber badge `last ran 41h ago` and one red `failed`.
3. **Hero row, two variants side by side** — ruled row (no graphics but the track) vs the same row with a field of 24 marks on the drafts card (5×5px, 3px gaps, `rgba(167,139,250,.22)`, rows of 8 from bottom-right, bleeding off). Caption: "Question 1 for Riku: bare, or the mark field?"
4. **Whole page down** — deck §6 verbatim (title, the two sentences, the strip `Engine — unknown · Meowchi ok · checked 6h ago`), blocks A–E absent; beside it a specimen of **one source down** (Block B with the 5px red dot + `Couldn't load the pipeline.`).
5. **Queue page inside the shell**, twice — as it exists today re-skinned with zero markup change (header, six filters with `pending` active, two approval cards, the Notifications card), and the same with the ~10-line inline header removed. Caption: "Question 3 for Riku: keep or delete the duplicated header?"

## Rules restated

Tokens verbatim (`--void --panel --raised --sunk --line --line-soft`, ink ×4, `--spend --save --roi --session --stale --missing --track`); never `--alert`/`--amber`. Tints by the 155° recipe (`--tint-roi`; amber tint `linear-gradient(155deg,#2A1E04,#141209 62%)`, border `rgba(251,191,36,.2)`). Type scale and spacing/radii verbatim from the reference. Rail per R15/R16 with 13px hand-drawn stroke glyphs (all or none). Top bar per R17. Hero per R2–R4; `OPEN ↗` only on drafts. Blocks per R9–R13; `<details>` with `list-style:none`, the `::-webkit-details-marker` rule and a rotating CSS chevron. Only outline pills; on the queue preview bare `button` = high-emphasis outline, `.secondary` = resting, `.danger` = red outline at 40%. Hue budget per R8 — section 1 must show exactly one lit figure and six quiet green words.

## Report back

File path, size, the count of lit things in section 1, and any ruling that could not be followed and what was done instead.
