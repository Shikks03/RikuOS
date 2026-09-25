# P10 round 5 — the Interaction Designer's rulings on the day-row disclosure

**Date:** 2026-09-24 · **Written by:** the Interaction Designer, against `round5-riku-answers.md`'s TILE
section (his verbatim sentence, and the seven questions it leaves open), `round3-lead-rulings.md` R4/R12/
R13/R18/R19, `round4-lead-rulings.md` R38/R47 and the corrections table, `docs/design/p10-mockup.html`'s
shipped CSS (read in full for `.pe-week`, `.pe-row.is-day`, `.pe-items`, `.disclose`, `.sumrow`,
`.fl-count`, `.fl-collapsed`, `.fl-open`), and the two files that actually ship the disclosure today —
`src/app/(app)/freelance/_blocks/Campaigns.tsx` and `Approaches.tsx`. **Status:** rulings for the Mockup
Builder's next pass. **R-numbers continue from R55** (the last used in `round5-riku-answers.md`). No code,
CSS or HTML is written here; every ruling states the decision, the reason, and the cost.

**What his sentence already settles, restated so it is not reopened:** a day with one item renders exactly
as it does today — no disclosure, no click. A day with two or more shows a short title and opens on a
click to the full list. The open list is every item, never a truncated one — `+3 more` does not survive
into the open state. Those three facts are not rulings below; they are the constraint everything below is
built against.

---

## The vocabulary — it fits, almost without addition

**R56. The day row uses the shipped disclosure wholesale: `<details class="disclose">`, `<summary>`,
`.sumrow`'s three-column grid, `.fl-count`, and the chevron pseudo-element. It does not use
`.fl-collapsed`, and needs exactly one CSS addition beyond straight reuse.**

Reading `Campaigns.tsx` and `Approaches.tsx` (the only two places this grammar ships) makes the fit
concrete rather than assumed:

- **`Campaigns`** is the closer analogue. Its `<summary>` holds a `.sumrow` whose first column is a
  *persistent identity* (`Campaigns` / `Your campaigns`) and whose second column is a bare `.fl-count`
  number. There is no `.fl-collapsed` — the identity line is descriptive enough on its own, open or closed.
- **`Approaches`** adds `.fl-collapsed` because its `.sumrow` heading is *generic* (`Approach performance`
  / `Your approaches` — it never changes) and needs a second, data-driven line to say anything concrete
  before the reader opens it. `.fl-collapsed`'s whole job is to carry the content a generic heading can't.

A day row has no generic heading — the day label (`Tue 20`) already sits in its own fixed column, outside
`.sumrow` entirely (R57). So `.sumrow`'s first column is free to hold the short title directly, the same
way Campaigns' first column holds a concrete identity rather than a placeholder. That makes Campaigns',
not Approaches', the pattern to copy, and it means **no `.fl-collapsed` line is needed** — one fewer thing
to build, one fewer line of vertical height per collapsed day, which matters for R66.

**The one real addition:** `.fl-open{margin-top:var(--sp-6)}` (28px) is tuned for a page-level disclosure
block — a heading, then a table, then an honesty note. A day's open list is a dense row of chips sitting
directly under a one-line summary; 28px of air between them would read as a gap in the week, not a
reveal. This needs a smaller top margin — in the neighbourhood of `--sp-2`–`--sp-3` (6–10px), the range
`.pe-said` and the "sentence, then a list" rule (`--sp-4`, 14px) already use for tight in-row spacing — and
it can be scoped by an ancestor selector (`.pe-row.is-day .fl-open`) with no new class name. **The exact
value is the builder's to pick by eye against the row's own rhythm and report.**

**The cost, stated plainly:** none beyond that one override. Everything else — the chevron's rotation, the
`[open]` state styling, the native keyboard and screen-reader behaviour (`<summary>` is focusable and
name-from-contents by default, exactly as `Campaigns.tsx`'s comment describes) — is inherited unchanged.
No new island, either (R68).

**R57. Structure: the day-label column is untouched; `<details>` lives only inside the second column; the
0-item and 1-item renders are byte-identical to today's markup.**

`.pe-row.is-day{grid-template-columns:56px minmax(0,1fr);align-items:baseline}` does not change. Its first
child stays `<span class="pe-daylbl">`. Its second child is one of three things, chosen purely by item
count, with nothing else about the row's own box (padding, border, baseline) touched:

- **0 items:** `<span class="pe-dash">—</span>` — unchanged (R69).
- **1 item:** `<span class="pe-items">…one `.pe-it`…</span>` — unchanged, and specifically **never**
  wrapped in `<details>` even though it structurally could be. Riku's sentence draws the line at "two or
  more"; wrapping a single item in a disclosure it can never meaningfully close would be a click that does
  nothing, and it would also make a 1-item day and a 2-item day harder to tell apart by silhouette alone
  (R58 leans on that silhouette).
- **2+ items:** `<details class="disclose">` — `<summary>` holding `.sumrow` (short title, `.fl-count`,
  chevron), then `.fl-open` holding a `.pe-items` list identical in markup to the 1-item case, just with
  every item in it.

Keeping the day-label column outside `.sumrow` entirely is what makes R56's grammar apply without a
column-count override, and it's what makes R66's narrow-width analysis tractable — the day label's own
56px never has to compete with the disclosure's three columns for room, because it isn't sharing a line
with them at the grid level (R57 vs. R66's own colum, below).

---

## The short title — question 1

**R58. The short title is the leading item's own title, bare — no count, no "+N more" suffix. Two other
shapes were considered and set aside.**

Three candidate shapes, worked against the Tue 20 example (`09:00 Math Methods · Classes` +
`Reviewer ch.3 · Academics`) and against Riku's own three-thing day (a class, a to-do, an all-day trip):

1. **Bare leading title** — `Math Methods`. **Picked.** The leading item is chosen by the sort order §7
   already defines for this same tile — all-day first, then timed by start, then to-dos — so no new
   ordering rule is needed. The count lives in `.fl-count`, right beside it on the same line (R59), so the
   row as a whole already says "one named thing, and a number bigger than one" without the string itself
   needing to say it twice.
2. **Leading title + more-count** — `Math Methods +1 more`, `Baguio trip +2 more`. Reuses `.pe-more`'s
   exact shipped register (11.5px, `--ink-4`) and existing singular rule, so it is genuinely free
   vocabulary. Set aside because it restates, in a second form, the same number `.fl-count` already prints
   a few pixels to its right — two numbers for one fact, in two registers, on one line. Elsewhere on this
   page that duplication is avoided on purpose (R21 keeps `0 open` and Done's tally deliberately distinct
   *in meaning*; this would be the same number twice with no difference in meaning).
3. **Generic summary** — `3 things today`, or naming kinds (`Class, to-do, trip`). Set aside on both
   grounds it could take: a bare count names nothing (fails "what needs to be done" on its own); naming
   kinds invents a new small vocabulary (`class`, `trip`) that doesn't exist anywhere else on the page —
   Personal/Freelance/Academics are section words, not event kinds — and the design system's standing rule
   is not to add words it doesn't need.

**Deliberately left out of the short title:** the time prefix and the layer/section tag that the full list
shows for every item. Including a time would make the string's shape depend on whether the leading item
happens to be timed, untimed (a to-do) or all-day (`all day`) — three different-looking short titles for
the same slot depending on what's in it, which works against "short" and against a predictable silhouette.
The tag is skipped for the same reason: it's available one click away, and "short" was the instruction.

**Marked, per the rule every proposed string carries:** `Math Methods` (and every leading-item title used
this way) is **proposed** only in the sense that it is Riku's own data rendered verbatim — there is no new
sentence here for him to approve, only a rule for *which* of his own words gets picked. The three-candidate
comparison above is what's proposed; the winner is a mechanical consequence of picking it.

---

## The count — question 2

**R59. The count lives in `.fl-count`, unchanged in every particular from how Campaigns uses it, formatted
as `N items`.**

`.fl-count`'s register (mono 10px, `--ink-3`, tabular) is already proven for exactly this job — "how many,
before you open it" — so this is closer to a placement confirmation than a new decision. **Format:**
`N items` rather than a bare number. Campaigns' bare `2` works because the tile's own eyebrow
(`CAMPAIGNS`) already tells the reader what's being counted; a day row's `.sumrow` has no such label
sitting above it, so a bare `3` floating next to a chevron risks reading as an unexplained figure. `items`
is the deliberately generic word — the list mixes events and to-dos, and "items" is what `.pe-it` already
calls them internally. **No singular form is needed**: the disclosure only exists at 2+, so the count is
never 1 in this context (unlike `.fl-count`'s other uses on this page, which do need `0 open` / `1 open`).
**Proposed**, as every string is.

---

## Default state, independence, and edit mode

**R60. Every day loads closed, regardless of what it holds — no day defaults open.**

`Approaches.tsx` has a precedent for a data-driven `defaultOpen` (open when every approach reads zero
sends — a specific, meaningful business state). Nothing analogous exists for a day row: "has 2+ items" is
not itself a state worth surfacing pre-opened, and applying `defaultOpen` here would make the busy week's
collapsed height unpredictable from one render to the next, working directly against R66. Riku's own
phrasing — "become a collapsible **and be clicked** to see" — reads as default-closed already; this just
makes it explicit so nobody reaches for `Approaches`' pattern by habit.

**R61. Each day's open/closed state is independent — no accordion, nothing closes another day when one
opens.** This is native `<details>` behaviour with zero script, and it's the only shape consistent with
"no useEffect in any island" (round 3's settled list) and with `.disclose` never having needed one on the
Freelance page either.

**R62. Entering edit mode closes every open day disclosure, the same way R30 closes an open form on
entry.** `.pe-head`/`.pe-body` going `inert` (R44) stops a day row from being *clicked* in edit mode, but
`inert` alone doesn't change what's already open — a day left open before Riku pressed `Edit layout` would
sit there, dimmed, still consuming its expanded height, while he's trying to judge and resize rows around
it. That's exactly the distortion R5 suspends the sparse-row shrink to avoid, in miniature. Closing every
disclosure on entry gives edit mode the same predictable, collapsed canvas every time, matching the form
that already closes for the identical reason. **Cost:** none stated by Riku that this contradicts — it's a
gap the seven questions didn't name, not a reopening of anything ruled.

---

## Push, not overlay — question 4

**R63. An open day pushes row 3's height. It never overlays.**

The content spec's own grid rule (§2 item 7, Riku's verbatim words) states it before any ruling needs to:
*"nothing overlaps, nothing is transformed."* An overlay is overlap by definition, so it's foreclosed by
the spec this whole page is built from, not by a new design preference. It also matches the one mechanism
already shipped for exactly this shape of problem: **R28's event and to-do forms already open in place,
never scroll, and grow their row when they must** — "visible and stated; a scrolling body is neither." A
day's open list is smaller than either form and gets the identical treatment for the identical reason.

**Cost, stated the way R28 states its own:** row 3's height changes under Riku while he's reading it if he
opens or closes a day. This is the same accepted cost R28 already carries for the forms, not a new one.
The stored arrangement's row weight is a *minimum*, never a fixed number (R3, R4), so this is legal by
construction; R51b already noted this and left the choice open, and this is that choice made: push.

**R64. A mechanical consequence to flag, not fix: the two-column split shares row-tracks across columns,
so a day that opens can stretch its cross-column row-partner's box even though that partner's own content
hasn't changed.** `.pe-week`'s explicit `grid-template-rows:repeat(4,auto)` with `grid-auto-flow:column`
pairs day 1 with day 5, day 2 with day 6, day 3 with day 7 into shared row-tracks (the seven-day week's
fourth row-track holds day 4 alone). Grid's default `align-items:stretch` — the same posture R6 already
uses at the page's outer grid level ("every tile fills its cell exactly") — means opening day 5 can leave
visible empty space under day 1's shorter content, inside day 1's own row box, if day 1 doesn't also open.
This is honest (it reflects a real height difference between two unrelated days, not a broken layout) and
it is **not** something to clip, collapse, or otherwise paper over — R17's honesty rulings and the settled
"no filling the empty cell" rule both point the same direction: real slack is shown, not hidden. **The
builder should render this specific case (one day open in column 2 beside its shorter, closed row-partner
in column 1) and report whether it reads as intentional or as a defect at the widths tested; if it reads
as a defect, the fix is `align-items:start` on the paired cells, not on a case-by-case basis.**

---

## The collapsed height and R51's 240px — question 3

**R65. R51's 240px is the blank week's number and is untouched by this ruling. The busy week's numbers are
now unknown in four distinct places, and none of them should be estimated — the builder measures all four
after the mockup fix pass.**

**Untouched:** a blank day never holds 2+ items (it holds zero, and prints `—`), so disclosure logic never
fires on the blank week. R51's 240px stands exactly as measured, with nothing in this ruling touching it.

**Now unknown, and why each one is a real question rather than a derivable one:**

1. **The busy week's collapsed row-3 height, one column.** Most of §13's seven days hold exactly 2 items
   (the threshold), so most of them now collapse to a single summary line instead of the wrapped
   `.pe-items` row they render today. This should be shorter than the pre-disclosure one-column number
   (363px), but by how much depends on the summary line's own height plus R56's chosen `.fl-open` margin
   times zero (nothing is open by default) — not something to guess at.
2. **The busy week's collapsed row-3 height, two columns.** Same shrink, plus whatever R64's row-track
   pairing does to it. It is plausible this now lands close to, or even at, the 240px floor the blank week
   already sits on — which would be a genuinely useful finding (the busy and blank weeks converging on the
   same height) but it is a finding, not an assumption to write down before it's rendered.
3. **The busy week's fully-open row-3 height, both column counts.** The worst case — every day expanded
   at once — is not simply a return to the old 328px/363px numbers. Each opened day now carries one extra
   line (the summary row) *above* its full item list that the pre-disclosure design never had, so the
   worst case should be measured as **taller** than the old busy-week numbers by roughly one summary line
   per opened day, not equal to them.
4. **Whether R64's cross-column stretch changes any of the above** when a mix of open and closed days
   share row-tracks — a partial-open week (some days open, most closed) is the state Riku will actually
   see most often, and its height sits somewhere between figures 2 and 3 above, not at either extreme.

None of these four numbers exists yet. **All four are to be measured by the builder**, rendered against
the fix-pass mockup, and reported the way R38's floor and R40's pair threshold were reported in round 4 —
numbers, not estimates.

---

## The narrow column — question 6

**R66. R38's two-line technique extends to `.sumrow` at the same 240px threshold: the short title alone on
line one, `.fl-count` and the chevron together on line two. The day-label column is unaffected throughout
— it never competes with `.sumrow`'s three columns for width, because R57 keeps it in its own fixed 56px
track. 226px (2 of 6) should clear on that basis; 106px (1 of 6) is flagged, not ruled, because the
day-label's own fixed width may leave too little room regardless of how `.sumrow` splits.**

Why this isn't a new threshold: R38 already establishes *why* 240px is the boundary (it's the widest tile
width at which the narrowest legal cells still need the accommodation) and already establishes the
technique (split a row with more than two cells across two lines rather than fight it onto one). A
collapsed day row's `.sumrow` is exactly that shape — three parts competing for one line under 240px — so
this is the same rule meeting a row kind R38's authors hadn't drawn yet, not a new number.

**Where this differs from R38's other rows, and why it's actually simpler:** R38's existing two-line rows
(`.pe-row.is-item`, `.pe-row.is-todo`) put their *leading* cell (tick or time) on line one with the title,
because that leading cell lives inside the same multi-column grid as everything else in the row. A day
row's leading cell — the day label — does **not** live inside `.sumrow`'s grid at all (R57); it's a
separate, already-narrow-safe column that today's flex-wrapping `.pe-items` never needed R38 for in the
first place. So the split here is self-contained: `.sumrow`'s own three parts break to two lines, full
stop, with the day label sitting untouched beside them exactly as it does at every other width.

**The flag, stated as precisely as the existing numbers allow:** at 106px of tile width, the narrow-band
content box (padding-adjusted, per R38's own arithmetic) is small enough that the day label's fixed 56px
plus the row's `--sp-4` gap (14px, per R41's citation) may consume most of the row before `.sumrow` gets
any room at all — independent of whether `.sumrow` is one line or two. This is very likely a **pre-existing
condition of `.pe-row.is-day` at 106px**, not something this ruling introduces: the current flex-wrapping
`.pe-items` would hit the identical squeeze today if the Next 7 days tile were ever shrunk to 1 of 6,
because nothing in R38's `@container tile (max-width:239.98px)` block currently touches `.pe-row.is-day` at
all. **This is not a figure to invent.** The builder renders a day row — both the disclosure state and a
plain 1-item state, for comparison — at 106px specifically and reports whether either is legible. If
neither is, the fallback direction (not a prescribed fix) is to stop pairing the day label with the row's
content on one line at the narrowest band and let the label sit above the content instead — the same
family of move R38 already made for the scheduled row at 480px (time above, title below) — rather than
inventing a new mechanism.

---

## A live tick inside an open day

**R67. Ticking an item inside an open day's list inherits R33's shared hidden-ids context automatically —
the item vanishes from every tile at once, as it already does everywhere else. The row's *shape*
(disclosure vs. plain) is decided only at render/refresh time, never rebuilt live mid-interaction.**

If ticking drops a day from 2 items to 1, the row does not collapse from `<details>` back to a plain span
in front of Riku — it stays exactly as rendered until the next `router.refresh()` re-evaluates it from
server truth. `Approaches.tsx`'s own documented behaviour is the precedent, almost word for word: *"a
router.refresh() closing a block the reader opened while the numbers are the same on both sides"* would be
a defect; *"a router.refresh() closing a block ... [because] any approach has a send"* — i.e., because the
underlying data genuinely changed — is correct and already shipped. A day row that opens on Monday with 2
items, gets ticked down to 1, and renders as a plain 1-item row after the next refresh is the same kind of
correct change, not a new case to design for.

**R68. No sixth island.** R33 names five: `LayoutEditor`, `TodoRow`, `TodoForm`, `EventForm`,
`LayerSwitches`. The day-row disclosure needs none of its own — `<details>` requires no script, no state,
no effect, the same way `.disclose` needed none on the Freelance page. Worth one line in the docs
corrections list (below) so nobody goes looking for a missing island when this ships.

---

## Restated, formally, because the brief asks for it in writing

**R69. An empty day keeps `—` and gets no disclosure.** R19 and R18 are untouched by everything above: a
day that was read and held nothing still prints `—` at `--ink-3`, guarded by R18's `unread` variant so it
can never render for a day whose sources didn't all answer. Nothing in this ruling changes when `—` can
appear or what it means.

**R77. A one-item day renders exactly as it does today — no disclosure, no click, no `.fl-count`, no
chevron.** Covered structurally in R57; restated here on its own because it's one of the two facts the
brief asks this document to rule explicitly rather than let fall out of a larger ruling.

---

## A conflict worth saying plainly, not quietly resolving

Round 3's settled-without-a-ruling list — the items the team agreed on unanimously and that round 3
declared not reopened — includes **"native `<details>` nowhere."** That was true when it was written: no
tile on this page disclosed anything. Riku's round-5 sentence asks for exactly the mechanism that line
ruled out. **This document amends it, narrowly:** `<details>` now appears in exactly one place on this
page — the day row, and only when it holds two or more items — because the owner asked for the mechanism
`<details>` already is, verbatim, elsewhere in the app. Nothing else on the page gets a disclosure by
extension of this ruling; the settled line still holds everywhere it originally meant to hold. This is
flagged rather than folded in quietly because it's a real amendment to a unanimous, not-reopened decision,
and the corrections list (§I in round 3's document) should carry it the same way it carries every other
correction to R1–R37.

**A second, smaller correction for the same list:** the content spec's Tile 5 rule — *"Bound per day: 8
items, then `+3 more`"* — is superseded for the open state. Riku's sentence requires the open list to be
every item, untruncated; the 8-item cap and its `+3 more` string no longer have anywhere to apply. A day
with, say, 11 items still collapses the same way a day with 2 does (bare leading title, `.fl-count` says
`11 items`), and opening it shows all 11.

---

## For the builder

**Draw, at minimum:**

1. A day row with exactly 2 items, collapsed — at the tile's full width, and again in the narrow band
   (226px and 106px of tile width). Report whether the 106px case is legible (R66) and what it looks like
   if not.
2. The same row, open — measure the gap between the summary line and the first opened item under a few
   candidate `.fl-open` overrides in the `--sp-2`–`--sp-3` range (R56) and report which reads best.
3. A day row with 3+ items (Riku's own example: a class, a to-do, an all-day trip), both states, to confirm
   the short-title and count read correctly when the leading item isn't the most "important" one by any
   measure other than the existing sort order (R58).
4. The full busy week (§13's data) at its default arrangement, **entirely collapsed** (the real default
   state per R60) — one column and two columns — and measure row 3's height both ways (R65, items 1–2).
5. The same week with **every day open** — one column and two columns — and measure row 3's height both
   ways (R65, item 3).
6. The same week with a **mixed** open/closed state, at least one case where an opened day in column 2
   shares a row-track with a shorter, closed day in column 1 (R64) — report whether the resulting slack
   under the closed day reads as intentional.
7. Edit mode entered with a day left open beforehand — confirm it closes (R62) and that the row's height
   reflects the closed state throughout edit mode.
8. A 1-item day beside a 2-item collapsed day, same width, to confirm the two are visually distinguishable
   at a glance (R58's silhouette argument) — report if they aren't.

**Report back, numbers not claims, matching round 4's format:** the four heights named in R65; whether
226px and 106px clear legibly (R66) and, if not, what was tried instead; the `.fl-open` margin value
chosen and why; and any ruling above that couldn't be followed as written, with what was done instead.
