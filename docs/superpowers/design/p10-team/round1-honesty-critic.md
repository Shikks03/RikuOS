# P10 round 1 — Honesty Critic

**Date:** 2026-09-11 · **Role:** every empty, missing, unread, expired, not-set-up and failed state across six tiles, two forms, edit mode, the two Settings cards and the push sentence.
**Standing question:** where does this design lie?
**Written independently.** I have not read the other four round-1 papers.
**Sources:** the brief; the content deck `2026-09-10-p10-personal-page-content.md`; the design doc `2026-09-10-p10-personal-page-design.md`; the P8 visual spec §4.1, §4.5, §4.6, §4.7, §5.1–5.5; `p8-team/round1-honesty-critic.md`; `round3-lead-rulings.md` and `round4-lead-rulings.md` (R35, R50, R51, R54, R56, R57, R58, R72); `src/lib/freelanceView.ts`, `freelanceHealth.ts`, `digest.ts`, `push.ts`, `format.ts`, `osSettings.ts`, `src/app/api/cron/morning/route.ts`, `src/styles/components.css`; `CLAUDE.md`. Codebase claims checked at `3fa055e`.

---

## 1. Position

P8's page reported on a machine in another building. This page reports on Riku's own week, and it does two things P8 never did: it **acts** (a tick, an add, a switch, a write into Google) and it reads **three independent feeds** instead of one. Both multiply the ways it can lie. P8's honesty apparatus — R50, R51, R54, R56, R72 — was built to stop one page claiming *nothing is waiting* on the strength of a number that never arrived. Every one of those rulings has a counterpart here, and the deck has caught roughly half, well: `Couldn't read Classes.` naming the layer, `Couldn't load layers, so the calendar wasn't read.` naming the causal chain, `No push recorded yet.` against `No push this morning.`, Settings' four-way `Connected. / Not set up. / Access expired. / Couldn't check right now.` That is a better baseline than P8's deck had at this stage.

The half it has missed divides into three families. **First, measured emptiness and absence share a glyph.** Deck §11's own worked render prints seven `—` day rows under two sentences saying nothing was read — and `—` is the deck's string for *an empty day*. The page's central rule is broken in the deck's own example, and broken again, more quietly, in the likelier single-layer case. **Second, every tile header carries a count or a stamp and not one has a failed form** — `0 open` above `Couldn't load to-dos.` is R72 reproduced exactly, before the code exists. **Third, this page acts and no action has a failure state.** `Ticking removes the row at once` with no sentence for a tick that did not save is the most dangerous line in the deck, because the consequence surfaces tomorrow, in the push, as what will look like a bug in the push.

My rule, narrower than "missing is not zero": **nothing may be drawn as a fact about the world unless the feed that owns it answered on this render, and nothing may be drawn as done unless the store said so.** A day is empty only if every switched-on layer answered. `Nothing due.` is a finding only if the to-do store answered. `sent 07:00` is a claim only if something was delivered. Everywhere else the page says which kind of nothing it holds — and, because a rearranged tile shrinks to about 106px, it says it with something the eye catches at 106px, not only with a sentence that wraps to the same grey rectangle either way.

"Looks finished when blank" must never come to mean "looks populated when blank". The blank week is the true report. The job is to make a true report look composed, not to make an empty page look busy.

---

## 2. The kinds of nothing on this page

P8 shipped three treatments and the reasoning is in `components.css:355–360` verbatim: `.fl-note` = a measured emptiness (`--ink-3`), `.fl-absent` = a field that never arrived (`--ink-4`), and `--ink-4` is *reserved* for absences. P10 needs six, because it has a configuration layer P8 did not and an event that was supposed to happen and didn't.

| # | Kind | Examples here | Register |
|---|---|---|---|
| 1 | **Measured emptiness** — the feed answered, there is nothing | `Nothing scheduled.` · `Nothing due.` · `nothing open` · `0 open` · `—` · `Nothing ticked off yet this week.` | `--ink-3`. **No hue, no dot.** |
| 2 | **Absence by configuration** — nothing was read because a switch says so | `Google isn't connected yet…` · `No calendars chosen…` · `Monitoring is off, so no push goes out.` · *(missing: all layers off)* | `--ink-3`, **no hue**, and it names the lever. R57: an alarm about an absence Riku created is a daily false alarm. |
| 3 | **Absence of a record** — the store answered and never held this | `No push recorded yet.` | `.fl-absent`, `--ink-4`. |
| 4 | **Failure to read** — we asked, no usable answer | `Couldn't read the calendar.` · `Couldn't read Classes.` · `Couldn't load to-dos.` · `Couldn't load layers…` · `Google access has expired.` | `--stale` amber **+ the 5px dot**, per deck §5's own words (*"the same treatment the Freelance health strip gives an old reading"* — `.aged`, `--stale`). |
| 5 | **A fault with a human owner** | `3 days late`, overdue rows | `--missing` red (deck §5, §6). |
| 6 | **An expected event that did not happen** | `No push this morning.` | `--missing` red. See §3.4. |

**Hue budget for the page, on P8 §4's model:** colour appears in three places — the hero's one permitted accent, red on lateness (kinds 5, 6), amber on *we don't know* (kind 4). Nothing else. No hue on `nothing open`, `0 open`, `No calendars chosen`, `Google isn't connected yet`, `Monitoring is off`, a `—` day, a tick box, or a switch that is on. And — the one I expect to defend — **no red on a couldn't-read sentence.** Red here means *late*. If a dead feed is also red, then on a Tuesday with two overdue to-dos and one timed-out calendar the page shows three red things meaning two facts, and Riku learns red means "something on this page has a problem" — the resolution at which colour stops being information.

**Do not port `.fl-fail` (`components.css:447`) into a tile body.** It is a `--missing` dot plus a two-line statement, sized for a page-level outage on a page with one source. Here failures are per tile, per layer, and up to four can be on screen at once (deck §11). Four red dots in a bento read as a broken page, not a reported outage.

One clarification the Spec Editor will otherwise "fix": `.fl-bound` is `--ink-4` (`components.css:413`) and stays so, even though `--ink-4` is reserved for absences. A bound is *meta about the display*, not a claim about the world; the quietest register is right for it. Same ink, different job — say so, or someone promotes it to `--ink-3` for consistency and it starts competing with the findings.

---

## 3. Tile by tile

### 3.1 Today — the hero

The deck's seven calendar states, each naming its cause and its lever, are the best-built thing in the document. Three gaps.

**(a) `Nothing scheduled.` must require every switched-on layer to have answered.** The deck lists *Empty: `Nothing scheduled.`* and, separately, *one layer failed, others answered: the rows that arrived, then `Couldn't read Classes.`* It does not say what happens when one layer fails **and nothing arrived from the others**. Read literally:

```
SCHEDULED
Nothing scheduled.
Couldn't read Classes.
```

Two claims on adjacent lines contradicting each other. This is R51 exactly — `empty` must mean "every feed reported and nothing survived" — with R50's corollary that a claim of *nothing* may not rest on an absence. **Wanted:** with any enabled layer unread, the failure line only, no `Nothing scheduled.`

**(b) Every layer switched off is a state nobody wrote.** The Layers tile lets Riku switch all three off, and the shipped default already has one off (`[ ] Events`). With none on, no calendar is read — and the deck has no sentence. All three candidates are false: `Nothing scheduled.` (nothing was read), `No calendars chosen.` (they *are* chosen, just off), `Couldn't read the calendar.` (nothing failed). Three taps from the default. It is **kind 2**, not kind 4 — his own doing, so grey, and it names the Layers tile, not Settings. It also reaches the push: §10's *"only switched-on layers count"* means the 07:00 message asserts `Today: nothing scheduled, nothing due.` about calendars it never opened, on the phase's own acceptance criterion.

**(c) `+ Event` is offered where it cannot work.** The control sits in the header in every state. Open it with Google not connected, or expired, or no layer on, and `Calendar` — *"one of the layers", default "the first switched-on layer"* — has nothing to offer. A form that cannot be submitted is a lie told by an affordance, and it is the class of lie a user blames himself for. The to-do form already models the honest handling: `Put on calendar` is *disabled until Due is set, with the note `Needs a due date.`* — a predictable failure prevented rather than reported after the fact.

Smaller: the heading is the date, minted at render, never refreshed (`force-dynamic`, no client clock). Left open on a phone overnight it says yesterday over yesterday's events — the one string that goes false with no data changing.

### 3.2 To-do — three headings and nothing under them

**Why `nothing open` under three labels reads deliberate rather than broken:**

1. **The labels are a frame, not content.** `PERSONAL` · `FREELANCE` · `ACADEMICS` are mono eyebrows (`.eyebrow`, `components.css:131`) and the deck says they are *always present*. A frame identical full and empty teaches itself once; a frame that appears only when populated teaches nothing.
2. **`nothing open` is lowercase and sits exactly where a row's title would sit** — same left edge, same baseline, same row height. The blank tile then has the same skeleton as the full one, and the eye reads *three sections, none with anything*, not *three labels floating in a box*. R28's pairing holds: `nothing open` is the section's value; `Nothing ticked off yet this week.` is a statement.
3. **`0 open` in the header is load-bearing.** It is the tile's declaration that the store answered. Three `nothing open`s with no count are ambiguous between empty and broken; the count resolves it. `pluralise` (`format.ts:42`) already gives zero the plural.
4. **`nothing open` is `--ink-3`, not `--ink-4`** — it is a measurement, and `--ink-4` is reserved (`components.css:357`). Drained, the empty tile reads as three failed lookups.
5. **`+ To-do` stays in the header in every state, unchanged** — no growth, no centring, no colour, no second call-to-action in the body. It is furniture. This is P8 §4.5's rule stated positively: the empty state gets no action pill *because the action already lives where it always lives*.

**The gap: the header count has no failed form.** The unreadable state is `Couldn't load to-dos.` *once, in place of the sections*, and `0 open` is unmentioned. Built literally:

```
TO-DO                            + To-do
0 open

Couldn't load to-dos.
```

A measured zero drawn over a failed read, one line apart — R72 verbatim. **Every header count and stamp on this page needs a failed form:** `0 open` here, the count on Done this week, `sent 07:00` on the push tile. The bounded case has the same shape: `20 open` when 34 are open would lie. The count is always the total; the bound belongs in `Showing 20 of 34.`

### 3.3 Layers

The four states are right, and `No calendars chosen. Pick them in Settings.` (kind 2, grey, names the lever) is properly distinct from `Couldn't load layers.` (kind 4, amber). Three gaps.

**(a) At zero the sentence replaces the rows** — no list header, no hairlines, no ghost switch. The tile keeps its cell and its row weight (constraint 6): at span 3 that is 219.5px × ≥140px holding one 38-character sentence; at span 2, ~142px; at the six-column collapse a span-2 tile is about **106px**, the narrowest anything gets. The sentence must survive 106px or be specified to be replaced there. Nothing may ellipsise: a truncated failure sentence is a failure to report.

**(b) Switches are offered when Google cannot be read at all.** The list comes from Mongo, so during `Google isn't connected yet` or `Google access has expired` the tile renders live switches for calendars nothing can open; toggling saves and changes nothing. Deck §9 gets this right for the Settings card — *"Google not set up or expired: the card shows the same sentence as the connection card and no list"* — and the page tile does not. Two surfaces, one fact, opposite behaviour.

**(c) `Couldn't save.` claims more than it knows.** For a 400 or 500, reverting the switch is exactly right. For a **timeout** it is a guess, and `CLAUDE.md` is explicit: *failed after the side effect, or unknown → park for human verification; never guess*. Reverting on an unknown outcome shows the old state while the server may hold the new one, and the next page load silently disagrees with what the tile just said.

### 3.4 This morning's push — and why `No push this morning.` must be loud

**Why loud, as a mechanism rather than a preference.** Every agent reports through the 07:00 push: watchdog anomalies, expiry-sweep failures, the site check, the outreach check (`digest.ts:58–91` composes them; `route.ts:172` sends them last). The push is therefore the one component whose own failure cannot be reported through the push, and its absence is visible in exactly one place in daylight — this tile, as the deck says (*"the outer safety net of the whole monitoring design"*). Hence **red**, the only red that can appear on a completely blank week. It fires only when a real chain broke, which is the precondition for a loud thing staying credible. With monitoring off it must be silent — R57 — and the deck already has that state.

**The hole, and it is the largest finding in this paper: the tile reports the record, not the send.** `LastDigest` is written by the dispatcher *after* the send, and the tile's whole reading is `dayKey(sentAt) === todayKey(now)`. So its states are functions of a write **separate from the delivery it describes**, and it can be wrong both ways:

- **Sent, not recorded.** The push goes out; the upsert fails (a Mongo blip, or a body over the model's `maxlength: 320` throwing a validation error). The tile prints `No push this morning.` in red about a push that woke his phone at 07:00 — the loudest sentence on the page fired by a storage failure. That is how a monitor gets ignored: the mechanism `outreachHealth.ts`'s header names and R57 ruled on.
- **Recorded, not delivered.** `sendPushToAll` (`push.ts:69`) returns `{sent, failed, removed}` and the route throws when `delivery.sent === 0` (`route.ts:173–179`). If the `LastDigest` write is placed **before** that guard, a morning where every subscription was dead stores a record, and the tile prints the title, the body and `sent 07:00` about a notification nobody received. **The write must sit after the zero-device guard**, and the spec must say so, because "write it after the send" reads as satisfied either way.
- **Partly delivered.** `sent: 1, failed: 1`. `devices` records it; nothing renders it.

The design doc also claims the R58 pattern for this write — *"named in the problems on the morning it happens"*. **Not achievable as described.** R58 worked because the snapshot write happens in the site-health job, which runs *before* the dispatcher composes (`route.ts:90–112`). A write that happens after the body is composed and sent cannot appear in that body. The failure has two possible homes: tomorrow's watchdog (a day late, in the rail's generic "1 item failed" vocabulary — the failure R58 exists to prevent), or this tile, today. So this tile has to carry it, and it has no sentence for it.

The fact is already in the database. The dispatcher writes an `AgentRun` row every morning and `fetchLatestRuns` already reads exactly that:

| Dispatcher run today | `LastDigest` today | The truth |
|---|---|---|
| `ok: true` | present | it went out, and here it is |
| `ok: true` | absent | **it went out; its text was not recorded** — no sentence exists |
| `ok: false` | absent | it did not go out, and the run says why |
| no row | absent | the cron did not fire, or monitoring is off |

Whether to spend that read is the lead's call. What is not optional: **either the tile can tell "no push" from "no record", or the deck says plainly that it cannot** — and then `No push this morning.` cannot be the red sentence, because a red sentence that fires on a storage failure is a false alarm with a schedule.

Four smaller findings on the same tile:

- **`sent 07:00` is `sentAt` in Manila, not the cron's nominal hour.** Vercel crons drift; a push sent at 07:14 says 07:14. Rendered from a constant it is decoration shaped like evidence.
- **Nothing here may be recomputed.** The title carries `1 problem · 2 to review`, frozen at 07:00. A later build that "helpfully" re-derives `pending` turns a quotation into a live figure that disagrees with the queue, with nothing on screen saying which it is. Specify the tile as a quotation.
- **The eyebrow contradicts the body in state 2.** `THIS MORNING'S PUSH` sits above `No push this morning.` and then yesterday's text. At span 2 the eyebrow is the most legible thing in the tile; the old text must be visually subordinate to its own `Last: Tue 9 Sep 07:00` stamp rather than reading as content under the eyebrow.
- **Precedence is unspecified.** Monitoring switched off at noon, after this morning's push went out: today's push, or `Monitoring is off, so no push goes out.`? Both true, opposite readings. My position: a stored push for today wins — it happened; the toggle is a statement about tomorrow and belongs beneath.

### 3.5 Next 7 days — where the deck prints the lie itself

Deck §11, verbatim, as the render for two feeds down:

```
NEXT 7 DAYS
Couldn't load layers, so the calendar wasn't read.
Couldn't load to-dos.
Fri 11 — … Thu 17 —
```

`—` is the deck's own string for **an empty day** (§6, Tile 5). So the tile states that nothing was read, then draws seven days of *read-and-empty*. Two facts, one glyph, in the deck's own example — R50's class of error, with the sting that the claim is repeated seven times and looks like data.

**The single-source case is worse because it is likely.** Deck §6, Tile 5: *"Calendar unreadable … one line at the top of the tile … and the days list to-dos only."* A day with no to-do then renders `—` while its calendar was never opened. One layer timing out is this page's most probable failure, and it yields up to seven false empty days under one true sentence.

**The rule I want:** `—` means *every source that fills this day answered and there was nothing*. When any source for the window is unread, no day prints `—`; the value column is blank ground and the sentence above is the reason. Days that do have something still show it — partial truth is fine when the shortfall is stated. With both feeds down there is nothing to list, and P8 §4.7's precedent applies (*"Blocks A to E are omitted, not drawn drained"*): the tile is its two sentences, the seven day labels omitted rather than drawn empty. **This costs nothing on day one** — §12's blank week has no failures, so all seven `—` remain, honest.

Also: `+3 more` is the count dropped from that day's merged list after the 8-item bound. With that day's calendar unread there is no total to subtract from, so it cannot render — another reason those rows should not render at all in that state. And on repetition: `Couldn't load to-dos.` appears four times in §11. Each is true, and I am not asking for a page-level banner — the deck is right that a tile which can be moved anywhere must stand alone. But at four repetitions the **treatment** carries the reading: four amber dots are a reported outage; four red statements with borders are wreckage.

### 3.6 Done this week

`Nothing ticked off yet this week.` is well made — *yet* names the window without claiming a streak. Three notes.

- **The count at zero is unspecified.** The deck gives *`3` · singular `1`* and no zero form. P8's precedent is that a count is *neutral and absent at zero* (§4.5), but this page's other count renders `0 open` explicitly. Two counts, two behaviours — fine if ruled, ugly if accidental.
- **The failed form is missing**, as in §3.2: `3` must not stand above `Couldn't load to-dos.`
- **Resist filling it.** Span 12 on the short row holding one sentence invites a seven-day dot strip, a streak, a "0 this week" figure, a sparkline. All invent a scale from a store that is zero days old. **No derived numbers anywhere on this page** — there is nothing to divide by, which is this page's mercy compared with P8's Block D.

---

## 4. Actions that can fail silently — the family the deck has not opened

Every state list in the deck is about *reading*. This page also writes, and four of the writes have no failure sentence at all.

**(a) The tick.** *"Ticking removes the row at once; it reappears in Done this week."* There is no state for a tick that did not save. The failure is silent by construction — the row is already gone — and the consequence arrives next morning in the push, naming a to-do Riku believes he finished, where it reads as a bug in the push. Tick boxes appear in three tiles, and the un-tick in Done this week is the same write reversed. This is the one finding I would call a correctness bug rather than a design gap: `CLAUDE.md` — *no silent failure*, *never leave an in-flight state behind*. The deck needs a sentence, and the design needs a rule for where it renders after the row has left.

**(b) A successful create with no visible result.** `+ Event`'s success path is *"the form closes; Today and Next 7 days re-read."* Two ways that leaves silence where a fact belongs: the event's date is beyond +7 (the Date field takes any day), or it was created on a layer currently switched **off** (the `Calendar` field is *"one of the layers"* — if switched-off layers are listed, the re-read will not show it). In both, the form closes and the page looks exactly as before. A successful action with no visible result reads as a failed one, and Riku's correct response — do it again — creates a duplicate. The design already returns Google's `htmlLink` *"so the form can offer it"*, and the deck never mentions it.

**(c) The event-creation timeout — the best-written sentence in the deck, one clause short.** `Couldn't reach Google. Check the calendar before trying again.` — *"because a request that timed out may still have landed"* — is exactly the asymmetric classification `CLAUDE.md` demands, naming the human as the escalation path. Two things unsettled. **What the buttons do:** if `Add` returns to normal above that sentence, the affordance contradicts the warning — the page says *don't try again yet* and offers the button that tries again. The typed values must be kept (as in the Google-refused case) and re-submission must visibly not be the next step. **And the page can answer its own question:** Today and Next 7 days can re-read after a timeout as they do after a success. If it landed, it appears, and the ambiguity resolves without opening Google — a lie removed rather than a string added.

**(d) The pin's compensations — where the app knows something it never says again.**

- `Saved, but the calendar entry failed: <reason>. The to-do is not on the calendar.` — correct, and the switch showing off matches reality. Model behaviour.
- `Saved, but the calendar entry couldn't be moved: <reason>.` does not say **where the entry is**. It is on the old day, and the row still carries `on calendar` — a tag now meaning *on the calendar, on the wrong day*, indistinguishable from a correctly pinned row. Two facts, one tag.
- `Done, but the calendar entry couldn't be removed. Remove it in Google Calendar.` is honest when said and then evaporates: the row leaves for Done this week, the sentence has no home, and the design deliberately **keeps `calendarEventId`** so the next attempt retries the same entry — except nothing retries it, because there is no agent on this page (S13). The app holds a record saying *there is an entry on Google for this* and never mentions it again. The design doc's *"nothing is left `pending`; there is no in-flight status to sweep"* is not right: a done to-do with a live `calendarEventId` **is** that state, and `CLAUDE.md` requires it have a sweep or a surface. The field now means two things — *pinned on purpose* and *left behind by accident* — the shape of bug the `Mixed` rule exists to prevent, in a `String`. The cheapest honest surface: a done row that still holds a `calendarEventId` says so.

**(e) The delete confirmation understates its consequence.** `Delete "Renew ID"?` · `Delete` · `Keep`. When that to-do is pinned, confirming also deletes an entry from Google — a change in another system, for which the deck already has a failure sentence, while the confirmation never mentions it. A confirmation that hides half of what it does is not a confirmation.

---

## 5. Bounds — and the bound nobody wrote

The display bounds are honest by construction and I would keep every one. Four conditions.

1. **The number after "of" comes from a count, not the length of a capped read.** The design doc has this right (*"every list read takes a limit and reports `total`"*). Pin it: a read that takes 20 and reports 20 renders `Showing 20 of 20.`, nonsense that looks like data.
2. **The header count is the total, never the shown count.**
3. **A bound is meta, not a finding** — `.fl-bound`, `--ink-4`, no hue, never mistaken for an absence.
4. **The fetch bound is a different bound and nobody wrote it down.** The design doc reads Google with `maxResults=100` per calendar for the whole eight-day window and never mentions `nextPageToken`. A calendar with more than 100 expanded entries in that window silently loses the overflow, and the page then draws a day as free that is not — the worst thing this page can do, done silently, with no sentence available because the app does not know it happened. A recurring timetable expanded over eight days makes 100 a real ceiling, and P11 will *populate* the Classes calendar from Canvas. Either follow `nextPageToken` to a stated ceiling, or detect truncation and let the affected days say so. `Showing 20 of 26.` bounds the display; nothing bounds the read.

Same shape, smaller: `listCalendars()` is also paginated, and a picker that silently omits a calendar makes it un-tickable with no explanation.

---

## 6. The push sentence — what the page can say and the push cannot

Deck §10 is strong on the two failures it covers. `Today: calendar unavailable.` **plus** `Calendar check unavailable.` counted in the problems *"so the title's count never says all clear over a blind spot"* mirrors `composeDigest`'s existing treatment of a failed attention call (`digest.ts:65–68`) and is the right instinct: a claim made over an unread feed is the thing to prevent. Four gaps.

**(a) There is no partial form, and partial is the likely case.** `readCalendarWindow` reads each layer under `Promise.allSettled` and returns `failed: string[]`, which the page uses for `Couldn't read Classes.` The push has two states only: everything, or `Today: calendar unavailable.` With Personal answering and Classes timing out, the push either names what arrived as though the list were complete (and Classes is where the 09:00 class lives) or declares the whole calendar unavailable — false, and it discards what it knows. **The page can say "these, and one layer is unread"; the push cannot.** This is the phase's acceptance test.

**(b) Every layer switched off reaches the push as a false negative** (§3.1b). And per R57 it must **not** be counted as a problem — it is his own switch — so the honest handling is a different sentence, not a problem count.

**(c) Casing: the two documents disagree.** Deck §10 writes `Calendar check unavailable.` (capital, full stop); the design doc writes *"adds `calendar check unavailable` / `to-do check unavailable` to the problems, exactly as it already adds `pipeline check unavailable`"* (lowercase, no stop). The shipped convention is the second: `digest.ts` pushes lowercase fragments and `end()` (`digest.ts:48`) adds the terminal stop to the joined line. Capitalised, the string reads correctly first in the list and wrongly anywhere else.

**(d) `Overdue:` under a failed to-do read.** `Due: to-dos unavailable.` is specified; `Overdue:` comes from the same read and its omission is unstated. Omitting it is right — *"absent parts are omitted"* — but say so, because a silently absent `Overdue:` looks identical to no overdue to-dos existing.

---

## 7. Settings — the two cards

The `Google Calendar` card is the deck's cleanest four-way split and maps to my kinds exactly: `Connected.` (measured), `Not set up.` (kind 2, naming the exact manual step), `Access expired.` (kind 4 with a lever), `Couldn't check right now.` (kind 4, our own read). Three findings.

**(a) `Connected.` proves less than it claims, and the gap is the first thing Riku will hit.** The status route *"attempts a token refresh and reports connected · not-configured · expired · unreachable"*. A refresh proves the client id, secret and refresh token work. It does **not** prove the Calendar API is enabled on the project — and enabling it is item 1 of *What needs Riku's hands*. Between pasting the token and enabling the API, Settings says `Connected.` while every calendar spot on `/personal` says `Couldn't read the calendar.`: two surfaces, one cause, opposite registers — the R54/R72 contradiction with a whole page between the halves. The fix is nearly free: the Settings page already calls `listCalendars()` for the picker beside it. Let `Connected.` mean *a calendar list came back*.

**(b) `Up to 10 calendars.` is an honest bound; the list behind it may not be** (§5).

**(c) A stored layer can outlive its calendar.** Delete a calendar in Google and `listEvents` 404s for a `calendarId` still in `layers`. The page then says `Couldn't read Classes.` every day, forever, in the register that means *try again later* — and the picker, which lists what Google returns, will not show it to untick. A 404 and a 5-second timeout are different facts sharing one sentence, and only one of them ever clears on its own.

---

## 8. Edit mode, the empty cell, the layout store

**Edit mode's one great decision is already made and must be defended:** *"The editor never touches tile contents; the tiles keep rendering their live data while being moved."* The alternative — grey labelled boxes reading TODAY, TO-DO — is placeholder content in the one mode where it would feel justified. It is also the mode Riku will screenshot. Hold the line.

**Dashed outlines exist only inside edit mode.** A dashed border in normal view reads as *this failed to load* or *this is to be filled in* — P8 §4.5's exact objection to `.emptycard`. The empty cell in normal view gets nothing: no outline, no hint, no `+`. It is *"one empty cell, left blank on purpose"*, and any treatment argues with the word *purpose*.

**Unsaved state has no representation.** `Reset to default` *"restores §5's arrangement in the editor; it still needs `Save`"*, `Cancel` discards, and navigating away mid-edit is unspecified. Press Reset, see the default, leave — every reason to think it took.

**A silent fallback changes the page without saying so.** *"An unreadable or invalid stored layout falls back to the default"* is the right call, but with Mongo down a Riku who has rearranged sees the **default** arrangement with no sentence connecting that to the `Couldn't load…` lines in the tiles. His arrangement appearing lost is a fact about his data, not about a tile.

**`Couldn't save the layout.` with edit mode staying open and the changes intact** is exactly right — no lost work, no false success.

---

## 9. "Looks finished when blank" — what it must not mean

The blank week (deck §12) is the **primary** state and the true report of Riku's calendar, confirmed by him: *"It's accurate, nothing is scheduled."* Each of these must be named in the spec so a later session cannot rediscover it as a good idea:

1. **No placeholder content** — no greyed sample events, no `09:00 Example class`, no faded "your to-dos will appear here". The page's whole promise is that what is on it is real.
2. **No sample or ghost rows**, including a dimmed row at the height a real row would occupy "so the tile isn't empty". Reserved height is fine; reserved height with a fake row in it is not.
3. **No skeletons.** The page is server-rendered fresh and the deck already says *"Busy: only the forms and the switches have busy states."* A skeleton is an invented state, and skeletons are shaped like data — the worst thing to draw on a page whose primary state is empty.
4. **No dashed boxes, no centred empty states, no action pills in empty space.** P8 §4.5 verbatim: *"Left-aligned where content lives — never centred, never in a dashed box, never with an action pill."* Centring is the tell that converts a finding into a hole; the legitimate actions live in tile headers in every state.
5. **No onboarding, first-run banner, help text or tour.** P8 §4.1's reasoning transfers with one change of subject: nothing here is unconfigured *by accident*. On day one Google genuinely is not connected, and the deck has a sentence for that, in the right place, pointing at the right lever. That sentence is the onboarding.
6. **No derived numbers, rates, percentages, streaks, progress rings at zero or seven-day dot strips.** Nothing here has a denominator worth trusting and the store is zero days old.
7. **No motivational or interpretive copy.** `Nothing scheduled.` is the report; `Enjoy your free day!` is an opinion, and it will be wrong on the morning three things failed to load.
8. **No filling the empty cell** — not a clock, a quote, a logo, or a next-holiday tile (declined, D8).
9. **No tile hiding itself when empty** (constraint 6; a container that vanishes teaches that absence is invisible).

What *does* make it look finished is the Grid Architect's problem — composition, weight, rhythm. My constraint: **achieve it with structure, not with content.**

---

## 10. The distinction has to survive 106px

From deck §2 item 9, the column pitch at 920px is 63.83px and a tile of span N is `N × 63.83 + (N − 1) × 14`: span 8 = 609px, span 4 = 297px, span 3 = 219.5px, **span 2 = 142px**. At the six-column collapse (below 760px) spans halve rounded up, so a span-2 tile becomes 1 of 6 — about **106px** of content at a 760px viewport. That is the floor.

At 106px and 12px type a line holds roughly fifteen characters. `Nothing scheduled.` wraps to two lines; `Couldn't read the calendar.` to two or three. **Both render as a small grey paragraph, and the distinction the whole page rests on becomes a reading exercise.** A reader scanning a phone at 07:05 does not read a wrapped grey paragraph; he sees *this tile has some words in it* and moves on. So the distinction cannot be carried by the sentence alone. It needs a marker invariant to width:

- **Kinds 4 and 6 take the 5px dot** — amber and red respectively, `.fl-warn i` (`components.css:475–478`), a disc with a 6px glow. Same size at 609px and at 106px, survives wrapping, and P8 already ruled it in over `⚠` (a colour emoji has no place in a monochrome panel).
- **Kinds 1, 2 and 3 take no marker.** The absence of the dot is the signal, legible at any width.

That one rule answers the brief's question at every span, and it is what makes four simultaneous failure sentences (§11) read as an outage being reported rather than a page falling apart.

Two supports: **every tile renders its eyebrow in every state**, so a tile reduced to one sentence still says which tile it is — necessary because tiles move, and `Couldn't load to-dos.` in an unlabelled box at span 2 in row 4 is unattributable. And **nothing truncates**: titles ellipsise by the deck's own rule, which is right for a title, but a failure sentence that truncates is a failure to report. At 106px it wraps and the tile grows (row weights are minimums, deck §5).

---

## Where I expect to disagree

**With the Grid Architect.** Over what a tile does with its weighted height when its body is one sentence. I hold constraint 6 — the tile keeps its cell and its minimum height — and I object to the obvious remedy, vertically centring the sentence in a 340px hero. Centring is the difference between a statement and an "empty state", and the primary render is nine sentences in six boxes. Content sits top-left, at the baseline it would occupy if rows followed. I also expect to disagree if a minimum height gets justified by adding anything to fill it.

**With the System Keeper.** Two things. The dot: `--stale` amber on couldn't-read and `--missing` red reserved for lateness and the missing push, which means **not** porting `.fl-fail`'s red dot into tile bodies — even though it is the shipped vocabulary for a failure and P8's precedent is on the other side. Deck §5 is with me. And ink: `nothing open` and `—` are `--ink-3` measurements, not `--ink-4` absences (`components.css:357`). I expect a pull toward draining everything on a blank page for calm; draining a measurement is the exact bug P8 wrote three classes to prevent.

**With the Interaction Designer.** Over optimistic ticking: removing the row at once is the right feel, and it needs its failure path specified *before* the animation. And over `+ Event` — I want it inert or absent when Google is not connected, expired, or no layer is on. I expect the argument that a disappearing control is worse than a failing one, and I will take a visibly disabled control with a reason over a form that cannot be submitted.

**With the Frontend Architect.** Over where the distinction lives. Every tile's view model must carry an explicit kind — `measured` / `absent` / `failed` — the way R54 forced `NeedsYouFigure` into `freelanceView.ts` after `number | null` proved unable to hold the difference. A `null` meaning both *empty* and *failed*, or a `?? []` anywhere between the reader and Google, makes every rule in this paper decoration; `freelanceView.ts`'s header says it plainly: *"`0` is a measurement. `—` is an absence. Rendering both the same way is a correctness bug, not a style choice."* Also over the Google fetch bound (§5.4): `maxResults=100` with no `nextPageToken` is silent data loss, and silent data loss here draws a busy day as free.

---

## Questions for the lead

Ranked. Each is a state where two facts share a sentence, or where no sentence exists. I have written no replacement strings: the deck's strings are Riku's.

1. **Every layer switched off.** What do Today, Next 7 days and the 07:00 push say? Three taps from the shipped default. My reading: kind 2, grey, naming the Layers tile — and in the push **not** counted as a problem (R57), but not `Today: nothing scheduled` either.
2. **`—` under an unread calendar.** Does a day print `—` when the source that fills it was not read? I say no, and in the both-feeds-down case the day rows do not render at all (P8 §4.7). This covers deck §11's example and Tile 5's single-source rule.
3. **`Nothing scheduled.` beside `Couldn't read Classes.`** With one layer unread and nothing from the others, does the tile print both? I say the failure line only (R51).
4. **Failed forms for tile headers.** `0 open`, Done this week's count and `sent 07:00` all render above a body saying the read failed. R72 forbids the two registers. What do the headers say?
5. **The tick that did not save.** Three tiles have tick boxes, the row is removed at once, and there is no failure state. Where does that sentence render after the row has gone, and does the row come back?
6. **`No push this morning.` versus "the push went out, its record didn't."** Do we spend one `AgentRun` read to tell the cases apart, or does the deck state plainly that the tile reports the record — in which case the red sentence needs re-examining. Non-optional either way: **the `LastDigest` write must sit after the `delivery.sent === 0` guard** (`route.ts:173`), or the tile stamps `sent 07:00` on a push nobody received.
7. **A partial calendar failure in the push.** §10 has *everything* and *calendar unavailable* and nothing between. Personal answers, Classes times out — what does the 07:00 sentence say? This is the phase's acceptance criterion.
8. **A done to-do that still holds a `calendarEventId`.** The app knows an entry was left on Google and says so once, attached to a row that immediately leaves. Does Done this week mark it? If not, the design doc's *"there is no in-flight status to sweep"* needs correcting.
9. **`Connected.` on the Settings card** — *the token refreshed*, or *a calendar list came back*? Only the second survives the state Riku will be in between pasting the token and enabling the Calendar API.
10. **`+ Event` when it cannot work** — absent, or visibly disabled with the reason? And is the `Calendar` picker restricted to switched-on layers, so a created event is guaranteed visible on the page that created it?
11. **After the event-creation timeout:** do Today and Next 7 days re-read, and what do the buttons do?
12. **`Couldn't save.` on a layer switch that timed out.** Reverting is a guess about an unknown outcome, which `CLAUDE.md` forbids. Re-read instead of revert?
13. **The Google fetch bound.** `maxResults=100` per calendar, no `nextPageToken`. Follow pagination, or detect truncation and say so?
14. **Casing of the new problem strings.** Deck §10 has `Calendar check unavailable.`; the design doc has `calendar check unavailable`; `digest.ts` joins lowercase fragments.
15. **Done this week's count at zero** — `0`, or absent as P8's `.fl-count` is? Two counts on one page currently behave differently.
16. **Precedence in the push tile** between `Monitoring is off…` and a push actually sent this morning before the toggle moved.
17. **Low priority, real:** the date heading is minted at render and goes false at midnight on a page left open; the stored layout falls back to the default without saying so when Mongo is down; the delete confirmation does not mention that a calendar entry goes with it.

---

## What I would cut

1. **`devices` on `LastDigest`**, unless the tile renders it. A stored number nothing displays invites a later session to display it in a form nobody specified. Give it a sentence or do not store it.
2. **The seven day rows in the both-feeds-down render** (deck §11). Cutting them *is* the fix in §3.5.
3. **`.fl-fail`'s red dot and two-line statement form** as a tile-body treatment. It is sized and coloured for a page-level outage on a one-source page; here failures are per tile and up to four at once.
4. **Any freshness stamp on a tile.** Freelance's `checked 6h ago` exists because that reading is *stored*; every read here is live at render, so a stamp would imply a cache that does not exist. (`sent 07:00` is not a freshness stamp — it is part of the quotation.)
5. **Any retry control.** The page loads fresh every time, so a retry is a second way to reload, and it implies the failure is ours to clear.
6. **Any treatment on the empty cell in normal view** — outline, hint, `+`, ground tint.
7. **Any page-level "everything is down" banner.** The deck's *"the grid always renders… each tile carries its own sentence"* is right for a bento whose tiles can be moved anywhere.
8. **Any progress, streak, rate or seven-day strip on Done this week**, now or later.
9. **Any confirmation on `Reset to default`.** It is already reversible by `Cancel` and needs `Save` to take effect; a confirmation implies otherwise.

---

*If only one thing survives this round:* `—` and a blank are not the same mark, `0` and a missing count are not the same figure, and a row that vanished is not a row that saved. Everything else here is an application of those three.
