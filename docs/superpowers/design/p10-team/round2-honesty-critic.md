# P10 round 2 — Honesty Critic

**Date:** 2026-09-11 · **Role:** Honesty Critic · **Round:** 2, after the other four round-1 papers and the lead's thirteen questions.
**Re-checked at HEAD `19fa4b1`:** `components.css:356–360, 406, 413, 447–453, 477`; the `delivery.sent === 0` throw in the morning route sits **after** `sendPushToAll`; `digest.ts` joins **lowercase** problem fragments and `end()` adds the stop; `watchdog.ts:156` `fetchLatestRuns`. Deck §6, §7, §9–§13 re-read in full.

---

## Where I now agree

- **System Keeper, on the mark for a failed read** — better than my own: `.fl-fail`'s shape with the dot at `--stale`. **His class, my hue.** One shape for every couldn't-read state at every span (deck §14 item 4), visible at 106px where a coloured word is not. Also his: no hue on the push tile ever — it quotes, it does not evaluate; and due meta as ink, never a box.
- **Interaction Designer, three times.** The failed tick — my largest finding, which had no home for its sentence — is answered: **the row returns unticked with `Couldn't save.` under it**, a string the deck already uses twice. The timeout: `ADD` in place but *disabled*, `CANCEL` the only live control. The Suspense fallback: eyebrow, empty body, **no sentence**.
- **Frontend Architect, twice.** His §14 reaches from the route's side what I reached from the tile's: **a failed `LastDigest` write cannot be named in that morning's push, because the push has already gone** — the doc's R58 claim must be struck. And his §15 read ordering is the only thing keeping `Couldn't load layers, so the calendar wasn't read.` distinguishable from `Couldn't read the calendar.`
- **Grid Architect**, on the empty cell (nothing in normal view, dashed in edit mode only) and his list of dishonest ways to fill a blank tile.

---

## Where I still disagree

**System Keeper — the em-dash.** His defence is checkably false, which makes this the round's sharpest disagreement. He writes that *"a `—` never appears under a failed read"*; it appears twice in the deck itself. **§11's render**: `Couldn't load layers, so the calendar wasn't read.` / `Couldn't load to-dos.` / `Fri 11 — … Thu 17 —` — seven marks meaning *read and empty* under two sentences saying nothing was read. **§6 Tile 5** (*"the days list to-dos only"*): a day with no to-do prints `—` while its calendar was never opened — the likeliest failure here, seven false empty days under one true sentence. His own reference makes it worse: `DESIGN-INSPO §5.14` rule 3 says an em-dash means *nothing was measured*, the opposite of the deck's use. No second mark — **blank ground in the value column** under the reason sentence, and with both feeds down the day labels omitted (P8 §4.7). It costs nothing on day one: §12 has no failures, so all seven `—` stay, honest.

**System Keeper — two smaller.** `--ink-4` on an off layer's name takes the ink `components.css:357` reserves for *a field that never arrived*; keep it at `--ink-2`, and let the knob carry the state. And his verbatim `.layer` port leaves live switches over a calendar nothing can open — deck §9 gives the *Settings* card no list when Google is unset or expired, and the page tile must match.

**Grid Architect — two renders I read as lies.** (a) `.tile-foot{margin-top:auto}` holding `Couldn't read Classes.` beside `Showing 20 of 26.` pins a claim about the world to the bottom edge of a 340px hero, up to 130px from the rows it qualifies, in the slot used for display meta. The deck places these precisely — Tile 1 *after the rows that arrived*, Tile 5 *at the top*. **Only `.fl-bound` goes in the foot.** (b) `is-pair{justify-content:space-between}` is fine with both groups empty; with rows under `SCHEDULED` and nothing under `DUE` it drops `Nothing due.` to the bottom edge and opens ~100px that reads as content which failed to render — **restrict it to the all-empty state.**

**Interaction Designer — one lifetime, one affordance, one omission.** `Done, but the calendar entry couldn't be removed.` is cleared by the next press and gone on reload. The register is right — a press outcome is not a claim about the world — but this sentence is *both*: the design keeps `calendarEventId`, nothing says so again, and S13 means no agent will. The doc's *"there is no in-flight status to sweep"* is wrong; **the durable surface is the Done row.** `+ Event` is left live where it cannot work — no switched-on layer, Google unconnected or expired — so refuse it before the fact. And the Suspense fallback needs one clause: **no count and no stamp either.**

**Frontend Architect — the LastDigest hole is two bugs, not one.** I disagree only that his option (b) is optional, or that the halves are alternatives. *Recorded, not delivered* is fixed only by **ordering** — the write sits after the `delivery.sent === 0` guard; no read recovers it, because the record would be true-looking and wrong. *Sent, not recorded* is fixed only by the **`AgentRun` read** — dispatcher `ok: true` with no record for today, needing sentence #4. Take neither and **`No push this morning.` cannot stay the page's one red sentence**: one firing on a storage failure is a false alarm with a schedule, the mechanism R57 ruled on. Separately, `resolvePersonalLayout` may repair silently when it *adds* a tile; when the layout could not be read at all, the page says so once.

---

## What I concede

1. **The header-figure gap is smaller than I claimed** — §11's render already omits `0 open`, `sent 07:00` and Done's count under a failed read. Ratify that; do not write four strings.
2. **Done this week's count at zero is specified** by the renders (§12: no count; §13: `3`). The counts differ on purpose — `0 open` declares the store answered, Done's is a tally. Question 15 withdrawn.
3. **The failed tick needs no new string.**
4. **My expected disagreement with the Frontend Architect over view models is withdrawn** — his `CalendarWindow` union is R54's explicit-kind discipline.
5. **Control outcomes stay quiet** — 11.5px, `--ink-3`, no dot, no hue, not surviving a reload. One carve-out only, above.
6. **`.fl-fail`'s shape is fine in a tile body** — my cut-list item 3 was about its *red dot*; at `--stale` the objection dissolves.

---

## Revisions to my round-1 paper

1. **§3.2, final finding** → *§11's render already omits the count under a failed read; ratify that for all three header figures.*
2. **§3.6, first note** → *the zero form is specified by §12's render; the two counts differ on purpose.*
3. **§4(a)** → *the row returns unticked with `Couldn't save.` under it; no new string, and the row must come back.*
4. **§10, the dot rule** → *kinds 4 and 6 take `.fl-fail`'s shape, the dot at `--stale` and `--missing`; kinds 1–3 take no marker.*
5. **§2, kind 4 row** → *add `Couldn't load this morning's push.` (Tile 4), missing from my table.*
6. **§5.4** → *`maxResults=100` is per calendar per window; follow `nextPageToken` or treat a returned token as that layer's failure.*
7. **§8, unsaved state** → *`Save` disabled until something changes is the representation; only navigating away mid-edit is unhandled.*
8. **"Where I expect to disagree — Frontend Architect"** → *no disagreement; a day's value is `items | empty | unread`, never `[]`.*
9. **Cut-list item 3** → *`.fl-fail`'s shape is adopted; only its `--missing` dot is refused for a couldn't-read state.*
10. **Question 15** → withdrawn.

---

## Sentences the lead must rule on

Every state I found with no deck sentence, once each. **The lead rules; I do not invent.**

| # | State with no sentence | Where | PROPOSED |
|---|---|---|---|
| 1 | Every layer switched off — three taps from the default | Today's `SCHEDULED`, and atop Next 7 days | `All layers are switched off.` — grey, no dot |
| 2 | The same state in the 07:00 push | push body, for `Today: …` | `Today: no layers switched on.` — **not** a counted problem (R57) |
| 3 | A partial calendar failure in the push | push body | `Today: <events>. One calendar wasn't read.` |
| 4 | The push went out; its text was not stored | push tile, for `No push this morning.` | `A push went out this morning. Its text wasn't stored.` |
| 5 | The push reached only some devices | push tile | `Sent to 1 of 2 devices.` — or cut `devices`, cheaper |
| 6 | The edit form's `Delete` failed | in the form | `Couldn't delete.` |
| 7 | Busy labels beside `Adding…` | both forms, layout save | `Saving…` · `Deleting…` |
| 8 | A done to-do still holding a calendar entry | the Done this week row | `entry left on Google` — lowercase, the `on calendar` register |
| 9 | Deleting a to-do that is pinned | the delete confirmation | `Delete "Renew ID" and its calendar entry?` |
| 10 | A created event landing outside this week, or on a layer now off | the tile that opened it | `Added. It's on Fri 24 Oct, outside this week.` — or restrict `Calendar` to on-layers |
| 11 | A stored layer whose calendar no longer exists — a 404 never clears | calendar tiles / Settings | `Classes is no longer on your Google account. Untick it in Settings.` |
| 12 | The arrangement could not be read, so the default is shown | page header row | `Couldn't load your arrangement, so this is the default.` |
| 13 | A Google read truncated at the fetch bound | the affected day | none — follow `nextPageToken`; else `Some entries couldn't be listed.` |

**Rules, not strings** — same pass, none needs Riku: `Nothing scheduled.` is suppressed whenever any enabled layer is unread (R51); header figures are omitted under a failed read; `Overdue:` is omitted under a failed to-do read *and that omission is stated*; the two new problem strings are **lowercase, no full stop**; a push stored for today outranks `Monitoring is off…`; `Connected.` means *a calendar list came back*.

---

## Positions on the round-2 questions

| Q | Position | Confidence |
|---|---|---|
| **Q1** | Not mine to scope — but the spec must say plainly the phone journey is **not reachable** in P10, and never call the page mobile-first while the rail is 170px wide. | medium |
| **Q2** | Adopt row-level `collapseRow`; **reject** `Math.max(2, ceil(span/2))` — it turns the legal six-span-2 row into 12 columns in a 6-column grid. | high |
| **Q3** | Adopt container queries, grid **and** tiles: a failure sentence's legibility floor is the tile's own 106px, and only the tile knows it. | high |
| **Q4** | **Bank it** — `#171B21` + inset hairline. On §12's data a blue hero is the only coloured thing on a page with no signal, competing with the amber dot. | high |
| **Q5** | Not mine on the numbers; one condition — a weight is never met by clipping or hiding a state sentence. A sparse row taking `auto` is honest: a void makes no claim. | medium |
| **Q6** | Not mine. Weak preference for the fifth stylesheet, on Plan C's reviewability grounds. | low |
| **Q7** | Not mine. One note: what proves the connection at bootstrap must not become the definition of `Connected.` | low |
| **Q8** | **Both halves — different bugs:** the write moves after the `delivery.sent === 0` guard *and* an `AgentRun` read plus sentence #4. Take neither and `No push this morning.` loses its red. | high |
| **Q9** | No day prints `—` when a source that fills it was not read — blank ground under the reason sentence; both feeds down, the day labels are omitted. | high |
| **Q10** | Kind 2 — grey, no dot, no alarm: sentence #1 on the calendar tiles, #2 in the push, **not** a counted problem (R57). It is Riku's own switch. | high |
| **Q11** | Reuse `Couldn't save.` for the tick, un-tick and a failed form Save; add only `Couldn't delete.`, `Saving…`, `Deleting…`. Header figures need **no new strings**. | high |
| **Q12** | Support disabling `−` at span 4 on the two form-bearing tiles: refusing before the fact is the deck's own rule, and a form opening into 42px is an affordance lying. | medium |
| **Q13** | Ink, not boxes — six red *words* on a bad week, never six red boxes. Empty cell: bare ground normally, one dashed rectangle in edit mode only. | high |

---

*If only one thing survives this round:* the deck prints the lie itself in §11, seven times, and every round-1 paper walked past it.
