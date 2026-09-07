# P8 round 3 — the lead's rulings

**Date:** 2026-09-06 · **Written by:** the design lead, after reading all four Round 1 papers, all four Round 2 rebuttals, and the Design Critic's ranking. **Status:** rulings for the mockup and the spec. Riku has not yet seen the design; items marked **→ Riku** are put to him with the mockup.

**What was settled by the team without needing a ruling** (unanimous after Round 2, not reopened): one shell with a 170px rail and a 44px top bar; a single content column; no second sidebar; hairlines between rows and borders only on real objects; tabular numerals on every digit; no action on any lead anywhere on the page; no first-run banner, ever, because everything is connected and the page is empty on Riku's own instruction (S10); no `Refresh` control (the page loads fresh every time); no `0%` for any non-email approach and no `0%` for zero sends; no cadence strip, no state tags, no `21% reply rate` — nothing from the reference's outreach-pipeline specimen that has no data behind it; the six semantic hues ship under the written reference's names (`--stale`, `--missing`), never `--alert`/`--amber`, no aliases; `Nothing waiting.` is left-aligned where content lives, never centred in a dashed box, never with an action pill; native `<details>`/`<summary>` for the two collapsible blocks; every count goes through `readCount`, and any new summary field is carried through `fetchSummary`'s reconstruction in the same change as the interface, with a test.

---

## A. The hero row

**R1. The third card is "Needs you" — the same computed gap count Block E renders, never the raw attention feed.** Hot leads loses because `30 contacts · 2 hot` is a final deck string six lines below, so a hot-leads hero forces a duplicate that cannot be designed away, and because "hot" is ShikksTracker's scoring, the one hero number RikuOS could not account for. The row then reads as one idea in three parts: what waits on you in the other app, what nothing has touched, what nothing is handling. A card that reads 0 most days is not dead weight; 0 is the answer the page exists to give. The Frontend Architect's cost is accepted: this card needs a database read, so when that read fails the card says `—` / `couldn't load`, exactly like Block E beside it.

**R2. Hues: drafts violet, contacts no hue, needs-you amber when above zero.**
- Drafts = `--roi`. Violet means decisions; 24 drafts is 24 decisions not made. The figure takes the hue (the reference's near-white exception applies only when the hue is spent on a graphic, and this card has none).
- Contacts = no hue. Figure in `--ink` at full 34px on plain `--raised` with a `--line` border. Any hue here reports Riku's own standing instruction as a fault, every morning. This hueless-with-data card is a new named component, `.stat.plain`; it is not the reference's `.stat.blank`, which is hueless because it is empty.
- Needs-you = `--stale` amber when > 0; drained (`--ink-4`, plain card) at 0. Amber is right because every row it counts is a duration, and red stays rationed to the health strip so the strip can be unmissable.
- **Orange appears on P8 only on the logo tile.** It is reserved. The hue for the future money-in card is an open reference-level question, not this phase's: the reference maps freelance to orange "because it is money work" (§5.11), but defines orange as money *leaving* and green as value *recovered* (§2). Both have a claim. It is decided when the money-in phase is designed, and recorded as a reference decision then. Nothing on P8 needs to move either way.
- **At most three of the four future cards are ever hued.** Written down now while it is free.

Today's row therefore reads: one violet figure, one white figure, one grey figure. One lit thing, which is the correct report.

**R3. Graphics: none, except a 4px proportion track on the contacts card.** The reference's test is that decoration is a reading of the number, and the source's graphics each add a dimension the figure lacks (spend over 28 days, a savings curve). A field of 24 marks or 30 dots with 2 lit says what the 34px figure already said, louder. The System Keeper's own argument against bars in the pipeline block ("a second drawing of the same digits") applies to his own graphics. The proportion track is the exception because 25-of-30 as a shape is something the figure does not state. Track: `--ink-4` on `#1A1E25`, no hue, matching its card. **→ Riku, visual:** the mockup shows the ruled row beside a variant with a mark field on the drafts card, because this is the one ruling whose cost only shows in pixels — if the bare row reads as a template, the mark field is the fallback, not a curve.

**R4. Card anatomy and strings.** Mono label → figure → caption, reconstructing the deck's sentence with no word added or lost: `DRAFTS` / `24` / `drafts waiting on you in ShikksTracker`, with `OPEN ↗` on this card only (the link leaves the app, so `↗`, built server-side, base URL never public); `CONTACTS` / `25` / `of 30 contacts never contacted`; `NEEDS YOU` / `3` / `waiting on you`, and at zero `0` / `nothing waiting`. At not-reported: `—` and the deck's exact "ShikksTracker didn't report…" sentence in `--ink-4`. Cards never disappear; hue drains. `0` is a measurement; `—` is an absence. Grid `repeat(auto-fit, minmax(215px, 1fr))`, gap 14px, `min-height` 132px.

**R5. The lines under the row.** A2 (`3 approved, not yet sent`) and A4 (`Sending is off`, unshipped) are sentences and disappear when they have nothing to say. 13px `--ink-2`; a leading figure in body 600 tabular `--ink`. A4 renders nothing today — no drained slot, no placeholder — and when it lands it takes a 5px `--ink-3` dot and never a warning hue. `Nothing waiting on you.` fires only when drafts, approved and never-contacted are all zero or absent — never under a lit card. Pinned in a test.

---

## B. The page's rhythm and words

**R6. The page title is `Freelance`, display 600 / 24px, no eyebrow above it.** All four papers lost the deck's one fixed page-level string; it comes back.

**R7. Eyebrow = the deck's word, heading = a short phrase addressed to the operator.** The reference defines the eyebrow as the machine's name and the heading as the human one, and the deck's block names are machine names. So: `PIPELINE` / `Your pipeline` · `CAMPAIGNS` / `Your campaigns` · `APPROACH PERFORMANCE` / `Your approaches` · `NEEDS YOU` / `Waiting on you`. Not the Architect's sentence-length headings, and not a `SHIKKSTRACKER ·` prefix repeated down the page. Block A has no header; Block F has none.

**R8. Hue budget for the whole page, as a rule.** Colour appears in exactly four places: the hero figures (R2), the amber waiting line on an overdue follow-up in Block E, the health strip's warnings, and the agent badges. Everything else is neutral: no green on `Won`, no green on `Replied`, no green on the best reply rate, no hue on any Block E reason line, no hue on the needs-you count in the heading. Today's page has one lit figure and six quiet green words in the rail.

---

## C. Blocks B to F

**R9. Block B.** Rows, not a strip: label left, count right, display 600 15px tabular, hairlines, no boxes, no bars, no funnel. Summary line `30 contacts · 2 hot` neutral; the `· N hot` clause is dropped at zero, and when hot is not reported the clause is dropped and one `--ink-4` line says so **(→ Riku, wording:** `ShikksTracker didn't report how many are hot.`). A stage the API omitted must not fold into `Nothing yet at …` (that line means measured zero); one `--ink-4` line instead **(→ Riku, wording:** `ShikksTracker didn't report every pipeline stage.`).

**R10. Block C.** `<details>` whose `<summary>` is the eyebrow + heading line with the count and a chevron. Expanded: header row in mono caps, four right-aligned tabular columns, no hue anywhere, the pixel footnote in the honesty-note register directly under the table, `Showing 20 of 34 campaigns.` as a statement. A measured `0` cell is `0` in `--ink-4`; a missing cell is `—`. No rate column, ever.

**R11. Block D.** Same disclosure. It opens today, showing the four real approaches at `—` rate and `0` sends — the clearest single demonstration of "not measurable is not zero" on the page — with `No sends yet — nothing to compare.` as the collapsed line. Two groups at equal typographic weight under mono-caps eyebrows `MEASURED — EMAIL` and `NOT MEASURABLE`; the explanation line sits under the second group's heading, above its rows, never below as a footnote; the second group keeps the rate column full of em-dashes and drops the replies column; sends stay live at `--ink-2` while the rate drains. The rate is recomputed locally from sends and replies and the upstream `replyRate` field is never printed (it returns 0 for zero sends). No hue on any rate. **One honesty note under the measured group** (the reference's Hold item: estimated numbers say so right under them) **→ Riku, wording:** `Rates are computed over small numbers of sends.`

**R12. Block E.** Rows built only from fields that exist: business name (the link, with a persistent `↗`; the row is not itself an anchor), channel as a neutral tag right, the waiting line in mono 9.5px, the quoted snippet in body 12.5px `--ink-2`, the reason line in `--ink-4`. Kind 3 has an empty channel slot (inapplicable, not unmeasured) and its waiting line is `--stale` amber. Count in the heading is neutral and absent at zero. `Nothing waiting.` left-aligned, no box, no pill.

**R13. Block F.** A hairline footer when all is well — one 11px `--ink-3` line, `Check now` as an outline pill at the right — that **becomes a bordered card** (`--panel`, `--line`, 10px radius) when anything is wrong, with a 5px hued, glowing dot per warning line, warning text at `--ink` 12.5px, healthy items on an indented `--ink-3` line beneath. Hues: engine stale amber; engine never-ran / unreadable / errors red; stranded-approved **red** (it only ever fires beside a stalled engine, so a human is waiting); a site down red; the stamp never hued. **The 30-hour rule:** past `site-health`'s own `everyHours + graceHours`, `all sites ok` is not printed at all and the stamp becomes an amber statement **(→ Riku, wording:** `sites not checked since 2d ago`). `sites never checked` is amber with monitoring on and grey with it off. `Engine — unknown` in grey when the summary call failed. **The marker is the system's dot, not `⚠`** — the triangle is only in the deck's layout sketch, not its string list, and it renders as a colour emoji on some platforms **(→ Riku: overturn if you want the triangle).** `Check now`: `Checking…` while busy, disabled; the existing reading stays on screen until the new one lands; a server-side 60-second floor read from the snapshot's own `checkedAt`, returning the existing reading rather than an error.

**R14. Whole page down.** Per the deck's §6 render: title, the two-sentence statement, the strip, and nothing else — blocks A to E are omitted, not drawn drained. Distinct from one source down, where only that block carries its own sentence with the failed-block treatment: a 5px `--missing` dot and the deck's sentence in `--ink-2`, no retry.

---

## D. The shell

**R15. Rail.** Logo tile (orange gradient, sunburst glyph, never a letterform), wordmark from `APP_NAME` with no assumed length, three nav items with 13px hand-drawn stroke glyphs (all three or none, never a mix), active = raised fill plus inset hairline. `AGENTS` group label. `Log out` in the rail foot. `/login` gets no rail.

**R16. Agents block: six badges, fixed execution order, kebab names uppercased.** `CHASER · EXPIRY-SWEEP · WATCHDOG · SITE-HEALTH · OUTREACH-HEALTH · DISPATCHER`, from a hand-written `RAIL_AGENTS` constant — never the `AGENTS` enum (three ghosts) and never by adding `watchdog` to `EXPECTATIONS` (its absence there is deliberate and pinned by a test). The `24 + 6` hour threshold is exported once from `watchdog.ts` and used by both. States, checked most-fundamental first, from the last run record **and** the switches in `OsSettings`:

| State | Rule | Badge | Caption (mono 8.5px `--ink-4`) |
|---|---|---|---|
| off | `chaserEnabled` false (chaser) / `monitoringEnabled` false (watchdog, site-health, outreach-health, dispatcher); expiry-sweep is never off | grey, plain | `off` |
| never run | no run record | grey, plain | `never run` |
| unknown | the database read failed (from the layout's catch block, not the pure function) | grey, plain | `—` |
| failed | last run `ok: false`, or `itemsFailed > 0` | red, tinted gradient | `failed` / `2 items failed` |
| overdue | age > 30h | amber, tinted gradient | `last ran 41h ago` |
| ok | otherwise | green label, thin green border, **no tinted fill** | none |

Captions on grey, amber and red; none on green, where the hue is the whole message. A switched-off agent writes an `ok: true` placeholder run, so reading only run records paints it green — the switches are passed into the pure derivation as an argument, never sniffed from the run's note string. No click, no hover.

**R17. Top bar.** One line: breadcrumb `Operator / Freelance` with a freshness stamp appended as meta, `· read 14:32`, formatted in Asia/Manila (a server render on Vercel is UTC). No pills of any kind: not ShikksTracker reachability (it claims a liveness that is only true at the instant of render), not push registration (client-only, and it duplicates the control on the queue page), not a pending-approvals count (two "waiting on you" numbers from two systems on one screen). No search, no bell, no theme toggle. If the mockup shows `Freelance` said three times (rail, breadcrumb, title) as noise, the breadcrumb goes and the stamp stays.

---

## E. The old pages

**R18. Re-skin through the global stylesheet, zero TSX edits, one treatment per selector.** Bare `button` = the neutral outline pill at high emphasis; `.secondary` = the same pill at resting emphasis; `.danger` = red outline at 40%, pale red label, never solid; `.card` = `--raised` + `--line` + 10px; `.badge` = the 6px tag; `.meta`, `.error`, `label`, `input`, `textarea`, `h1`, `main` per the Frontend Architect's table. `pre.body` keeps the **body** face — it holds a message to a person. The queue's status filters lose their solid active state (bright outline vs dim outline) rather than spending a decision-4 exception. `main` widens to the app's content column — a visible change to `/queue` that the shell forces; recorded, not hidden. **→ Riku:** the queue and settings pages each carry a ~10-line inline header (cross-link, and on queue a `Log out`) that the rail now duplicates, so `/queue` would show two `Log out` buttons. Deleting those headers is the one place "no TSX change" and "the shell works" genuinely conflict; the recommendation is delete.

---

## F. Engineering rulings (the Frontend Architect's paper, adopted as written unless noted)

**R19.** Five stylesheets — `tokens`, `base`, `components`, `legacy`, imported in fixed order from the root layout only; `globals.css` redistributed. Tokens: the six semantic hues as one closed set plus `--track`; no `--skill`, no `-dim` tokens (inline the gradient stops); `html { color-scheme: dark }`; the autofill override for the login field. Verification line: `git grep "var(--alert)\|var(--amber)" src/` returns nothing. **R20.** Route group `(app)` for queue, settings, freelance; `/login` outside; the shell renders no `<main>`; one client island for active nav; a session check in the layout as defence in depth; the proxy untouched. **R21.** Agents block: `classifyAgentRun` extracted from `evaluateWatchdog` (the existing watchdog tests must pass unchanged), `deriveAgentStatuses(now, latest, switches, RAIL_AGENTS)` total and pure, `fetchLatestRuns` reused, settings read in the same `try/catch`, Suspense plus catch so a database failure never blanks a page. **R22.** The page: server component, `force-dynamic`, three calls under `Promise.allSettled` with a 6-second page-level timeout (the 15-second cron timeout can outlive the function budget), view models in `src/lib/` (`freelanceView`, `freelanceVariants`, `freelanceGaps`, `freelanceHealth`, `heroGraphics` reduced to the one track, `format` with both age grammars and `formatAge` moved out of `outreachHealth`), `stApi.ts` widened with `contacts` and `campaigns` and carried through `fetchSummary`, `fetchVariantStats` added, `fetchLiveAnchorIds` extracted from the chaser route and shared. **R23.** `HealthSnapshot` singleton, bounded, `timestamps` both, no TTL, **no upsert on read**; `POST /api/health/sites` with `requireSession` first, the 60s floor, `router.refresh()` after; the cron's snapshot write inside the `site-health` job, caught and counted so it never costs the digest. **R24.** Fonts via `next/font/google` with variables named exactly `--display`, `--body`, `--mono`; no CSP change; `next/font/local` as the recorded escape hatch. Manifest `background_color` and `theme_color` = `--void`; viewport `themeColor` and `colorScheme`; `statusBarStyle: "black"`; the app icon is the brand tile, full-bleed. Icons hand-written in one file; no registry. Nothing from `components.html` is served, and its `<script>` ships nowhere. No new dependency.

---

## G. Corrections the docs must carry

- The content deck's "Mobile-first" paragraph and its checklist item "Reads well on a phone first" are superseded by decision 1 for this phase; mark them, or the next reader will think the page failed its own checklist.
- The design doc's non-goal "No change to `/queue`" becomes "no behaviour or layout change to `/queue` beyond the shell and the re-skin".
- `ARCHITECTURE.md` §7 gains one decision recording Riku's five calls of 2026-09-06 (desktop first, the three hero numbers, the agents block, the re-skin, dark only) and the money-in log as the future feed for money stats.

## H. What the mockup must show

Desktop width, the real tokens and faces, both states: (1) today's render per deck §7; (2) the full render per deck §8 with C and D open and the strip in its worst case; (3) the hero row ruled (R3) beside the mark-field variant; (4) the whole-page-down state; (5) the queue page inside the shell, with and without its duplicated header. Every string from the deck, verbatim. The CSS written as the build will port it.

## I. Put to Riku with the mockup

1. Hero graphics: bare row, or the mark field on the drafts card (visual).
2. The health strip's marker: dot (ruled) or `⚠`.
3. Delete the duplicated inline headers on queue and settings (recommended) or keep them.
4. Four new strings, wording: `ShikksTracker didn't report how many are hot.` · `ShikksTracker didn't report every pipeline stage.` · `sites not checked since 2d ago` · `Rates are computed over small numbers of sends.`
