# P8 round 1 — Honesty Critic

**Role:** every empty, missing, unmeasurable, stale and error state on the page and in the shell.
**Standing question:** where does this design lie?
**Written independently.** I have not read the other three papers.

---

## 1. Position

Today the truthful answer to "how is the freelance pipeline?" is *"one thing is waiting on you, and
nothing else has happened, on purpose."* A page that renders that honestly will be almost entirely
grey, will have exactly one loud number on it, and must still look finished. The failure mode I am
here to prevent is not ugliness — it is a page that **fills itself in**: a zero drawn where nothing
was measured, a 0% drawn where nothing *can* be measured, a green badge on an agent that is switched
off, an "all sites ok" printed from a reading taken yesterday. Every one of those is cheap to build
and impossible to un-believe once Riku has read the page a few times. So my rule for this phase is
narrower than "hue drains when there is no signal": **a value is drawn at full strength only when
the system actually measured it, this reading, on a scale that exists.** Everything else drains to
`--ink-4` and says which kind of nothing it is. The page is allowed to be quiet. Quiet is the
correct report.

---

## 2. State matrix

### 2.0 The three kinds of nothing (used throughout)

| Kind | Means | Render | Token |
|---|---|---|---|
| **Measured zero** | The system asked, got an answer, the answer is none | `0` | figure weight, `--ink-4` (reference §5.5 — "at 0% the number goes grey") |
| **Not reported** | The field did not arrive (`readCount`/`readStamp` → `null`) | `—` + a caption naming ShikksTracker | `--ink-4` |
| **Not measurable** | No scale exists and never will (Block D group 2) | `—` + the group's standing explanation | `--ink-4` |
| **Couldn't load** | The call failed | `—` + `couldn't load…` | `--ink-4` value, `--alert` pill on the block heading |
| **Off** | Deliberately not running (S10, `chaserEnabled`, `monitoringEnabled`) | the lowercase word `off` | `--ink-3`, **never a hue** |

"Off" is a fifth kind and neither the deck nor the reference has it. It matters twice on this page
(the agents rail, and A4 later), and it is the state most likely to be drawn as green or as amber,
both of which are lies.

**Drain is per value, not per container.** A row can hold a live figure and a permanently
unmeasurable one side by side (Block D group 2: `— | 31`). Draining the whole row would lie about
the sends.

---

### 2.1 Shell — top nav

| State | Render |
|---|---|
| Normal | `Queue · Freelance · Settings`. Active item = raised fill `#171B21` + inset hairline (reference §4). Never a left accent bar. |
| **No connection pill** | The source shell has `● Local Claude Code daemon connected` (§5.9 grammar). **This page must not have one.** RikuOS holds no live connection to ShikksTracker — it makes request-time HTTP calls. A persistent green "connected" pill claims a liveness nothing measures. Connection truth lives in the blocks and the strip, at the moment of the request. |

---

### 2.2 Shell — agents rail (Riku's decision 3)

**Which agents.** The rail must iterate `EXPECTATIONS` in `watchdog.ts` — `chaser`, `expiry-sweep`,
`site-health`, `outreach-health`, `dispatcher`. **Five badges.** It must *not* iterate `AGENTS` in
`models/AgentRun.ts`, which holds nine, three of which do not exist: `lead-sweep` (dropped, S8),
`triage` (deleted, S15), `retro` (unbuilt, P7). Rendering those as grey "never run" invents three
workers and says two deleted ones are overdue.

`watchdog` is deliberately absent from its own table (`watchdog.ts` comment: "it is running, which
is the proof") but *does* write an `AgentRun` row. My ruling: **leave it out of the rail.** Showing
it needs a staleness threshold, and the only honest place for that threshold is `EXPECTATIONS`. If
someone wants the sixth badge, they add the row to `EXPECTATIONS` in the same commit. The page must
not carry a rule the engine does not have.

| State | Exact rule | Badge render | Caption (mono 8.5px `--ink-4`) |
|---|---|---|---|
| **ok** | latest run exists, age ≤ `(everyHours + graceHours)`, `ok === true`, `counts.itemsFailed === 0`, **and its switch is on** | `.agent` tinted `--save` gradient, `--save` label, 22% border | `ran 6h ago` |
| **degraded** | as above but `counts.itemsFailed > 0` | `.agent` tinted `--amber` | `2 items failed` |
| **overdue** | age > `(everyHours + graceHours)` — 30h for all five today | `.agent` tinted `--amber` | `last ran 41h ago` |
| **failed** | latest run `ok === false` | `.agent` tinted `--alert` | `failed` |
| **never run** | no `AgentRun` row for that agent | `--raised` fill, `--line` border, `--ink-4` label — **hue fully drained** | `never run` |
| **off** | `chaserEnabled === false` (chaser) or `monitoringEnabled === false` (watchdog·site-health·outreach-health·dispatcher). `expiry-sweep` is never off — it runs whatever the toggle says | `--raised` fill, `--line` border, `--ink-4` label | lowercase `off` |
| **unknown** | the Mongo read for run records failed | `--raised`, `--ink-4` label | `—` |

Three things this table is doing that a naive build will not:

1. **A switched-off agent writes a run record with `ok: true` and zero counts** (`runJob.ts`: the
   note lands in `error` on an `ok:true` row; `morning/route.ts` writes exactly that for four agents
   when monitoring is off; the chaser route does the same). A badge coloured from `ok` alone paints
   a switched-off agent **green, "ran fine"**. It did not run. Read the switch from `OsSettings`,
   never sniff the note string — `runJob`'s own docstring says "nothing reads it back
   programmatically", and making the UI the first reader makes a debugging note load-bearing.
2. **`itemsFailed > 0` with `ok: true` is a real state** (`evaluateWatchdog`'s `degraded`). Riku's
   four colours have no slot for it; green would be a lie. Amber.
3. **`never run` and `off` are both grey and must be distinguishable.** Same drain, different
   caption. They are opposite meanings — one is "should have run and hasn't", one is "isn't
   supposed to". The colour cannot separate them, because in both cases there is no signal to
   colour. The word does.

**Why grey and not amber for `never run`:** amber means overdue, and overdue is measured against a
last-run time we do not have. Grey claims nothing, which is exactly right. The escalation for a
genuinely dead agent already exists and is louder than a rail badge — the watchdog's morning push.

**No click behaviour this phase** (decision 3) — so no hover lift, no cursor change, no
affordance that implies one.

---

### 2.3 Hero row (decision 2) — three cards

Decision 2 turns the deck's Block A into a fixed row of cards. That resolves the deck/reference
conflict but creates a consequence nobody has flagged: **A2 (`N approved, not yet sent`) has been
orphaned** — it is a conditional line, and the hero row is now fixed at three. See §2.4.

Row grid: `repeat(auto-fit, minmax(215px, 1fr))` so a money card joins later with no redesign
(decision 2). **No fourth placeholder now** — Riku already ruled that out, and a placeholder is the
one empty state that teaches nothing, because there is no data behind it to eventually arrive from.

**Cards never disappear.** Reference §5.14 rule 1 wins here over the deck's "line disappears at
zero", because a card that vanishes reflows the row and teaches the reader that absence is
invisible. The deck's rule survives intact for the *lines* it was written for (§2.4). The general
principle: **a slot holds a value and always renders; an annotation exists only when it has
something to say.** Cards and table cells are slots. Heading count-chips, summary clauses and
state-of-play lines are annotations.

Card read top-to-bottom reconstructs the deck's sentence verbatim: mono label → figure → caption.

#### H1 — Drafts waiting

| State | Figure | Caption | Card |
|---|---|---|---|
| Present (today: 24) | `24` in `--spend`, display 700 / 34px / tabular | `drafts waiting on you in ShikksTracker` | `.stat.spend` gradient, `OPEN ↗` in `.stat-top .more` |
| 1 | `1` | `draft waiting on you in ShikksTracker` | as above |
| Measured zero | `0` `--ink-4` | `drafts waiting on you in ShikksTracker` | `.stat.blank` — hue drained |
| **Not reported** (`queue.drafts === null`) | `—` `--ink-4` | `ShikksTracker didn't report how many drafts are waiting` | `.stat.blank` |
| Couldn't load | `—` `--ink-4` | `couldn't load` | `.stat.blank`, `--alert` pill on the section heading |

**Hue: `--spend` orange, and specifically not amber or red.** `docs/ROADMAP.md` P5 names "a draft
backlog is not a fault" as one of three deliberate silences, pinned by a test. 24 drafts is where
Riku's effort goes, not an alarm. Orange is the money-work hue (reference §5.11's layer rule) and
carries "this consumes you" without claiming fault.

Use `↗` not `→` for the link. The reference reserves `↗` for leaving the app, and this genuinely
leaves for another application — which is the honesty the deck's §1 is built on.

The "not reported" caption is long and will wrap. The row uses `min-height`, not a fixed height,
and grid stretch keeps all three cards level — so let it wrap rather than truncating the string.

#### H2 — Contacts never contacted

| State | Figure | Caption |
|---|---|---|
| Present (today: 25 of 30) | `25` in **`--ink` near-white**, no hue | `of 30 contacts never contacted` |
| Measured zero | `0` `--ink-4` | `of 30 contacts never contacted` |
| Not reported (total or not-started `null`) | `—` `--ink-4` | `ShikksTracker didn't report how many contacts there are` |
| Couldn't load | `—` `--ink-4` | `couldn't load` |

**This is the single most dangerous card on the page.** "25 of 30 never contacted" *reads* like a
failure metric, and under S10 it is the correct resting state — sending is off by Riku's standing
instruction. Any hue here (amber "you're behind", red "gap") turns a setting into a daily
accusation. Precedent for a hueless figure exists in the reference twice: the ROI hero puts its
figure near-white, and §5.8's stat strip says "only the *problem* counts take a hue; a healthy strip
is entirely white."

#### H3 — the third card: **Needs you**, not hot leads

I argue for **replies/actions waiting** over hot leads, with one hard condition.

- Today it is **0**, and a zero is not a weakness here — it is the answer to the page's actual
  question. The deck's §1 says the dominant journey is *phone buzzes → glance → is this fine, or
  does it need me?* This card is that question, answered in one figure.
- **Hot leads (2) is already on the page**, in Block B's summary line `30 contacts · 2 hot`. A hero
  card would repeat it and add no fact. Worse, "hot" is ShikksTracker's judgement, computed by logic
  RikuOS does not hold and cannot explain — a 34px figure is a strong claim to make about a number
  you cannot account for.
- **Hard condition:** the figure must be the **same computed gap count Block E renders**, not raw
  `attention.repliedUnanswered`. D3 deliberately narrows Block E to the gaps (unsupported channels,
  replies with no live `ApprovalItem`, `overdueActions`). If the hero shows the raw feed and Block E
  shows the gaps, the page contradicts itself in one screen — which is exactly the failure D3 exists
  to prevent, reproduced vertically instead of across pages.

| State | Figure | Caption | Hue |
|---|---|---|---|
| Present, > 0 | `3` | `waiting on you` | **`--alert`** — a gap nothing is handling is "missing or in conflict" (reference §1) |
| **Measured zero (today)** | `0` | `nothing waiting` | `--ink-4`, `.stat.blank` |
| Couldn't load (`/attention` failed) | `—` | `couldn't load` | `--ink-4` |

`nothing waiting` is lowercase, borrowing §5.9's rule that an ambient state is lowercase while a
label the system asserts is mono caps. It is close enough to the deck's `Nothing waiting.` that I do
not think it needs a new decision, but it is a new string — flag it.

**Today's row therefore reads: one orange card, one white card, one grey card.** That is one lit
thing. See §3 for why that is correct and not a shortfall.

---

### 2.4 State-of-play line (the orphaned A2, and the A4 slot)

A thin line directly under the hero row, growing from zero lines to two. Sentence case, `--ink-2`,
13px. **This is where the deck's "each line disappears when it has nothing to say" rule survives.**

| Line | Shown when | Text | Treatment |
|---|---|---|---|
| A2 | `queue.approved > 0` | `3 approved, not yet sent` / `1 approved, not yet sent` | `--ink-2`, **no hue** |
| A2 missing | `queue.approved === null` | `ShikksTracker didn't report how many are approved` | `--ink-4` |
| A4 | *never, today* | `Sending is off` | `--ink-2`, **no hue** |
| Both absent | today | the line does not render, and nothing takes its place | — |

**A2 must never take a warning hue while the engine is healthy.** `outreachHealth.ts` is explicit:
`stranded-approved` fires *only* alongside a stalled engine, and "approved messages waiting beside a
HEALTHY engine are correct… saying so every morning would train Riku to ignore the line that
matters." Same words, two meanings. Here it is a fact; in Block F, alongside a stall, it is a
warning. Only Block F gets the hue.

**When A4 lands it must be styled as a state, not a warning.** `Sending is off` is the correct
resting state under S10. Amber or red there starts a permanent daily alarm about a thing Riku set on
purpose.

---

### 2.5 Block B — Pipeline

| State | Render |
|---|---|
| Heading | mono eyebrow `PIPELINE` + display 600 heading. Reference §5.1 asks for possessive sentence case addressed to the operator — `Your pipeline` — but the deck fixes the heading as `Pipeline`. **Deck wins** (reference §7.3). |
| Summary, both present | `30 contacts · 2 hot` — `--ink-2`, `2` not hued |
| Singular | `1 contact · 1 hot` |
| `hot === 0` | `30 contacts` — **the hot clause is dropped.** It is an annotation, not a slot; "· 0 hot" is noise in a sentence |
| **`hot === null`** | `30 contacts` + a second `--ink-4` line. The deck has no string for this — see §5 Q2 |
| `total === null` | the summary line does not render; H2's not-reported caption already says it |
| Stage rows | Only stages holding ≥ 1 contact. Label left `--ink-2`, figure right, `tabular-nums`, hairline `--line-soft` between rows. **No bars, no funnel** — see §3.10 |
| Empty stages | one muted `--ink-4` line: `Nothing yet at call booked, proposal sent, won or lost` (two remaining: `won or lost`; one: `lost`; none: absent) |
| **A stage key missing from the payload** | it must **not** join the "Nothing yet at…" line — that line means measured zero. Add one `--ink-4` line: `ShikksTracker didn't report every pipeline stage.` One line however many are missing; enumerating them is detail Riku cannot act on |
| No contacts at all | `No contacts yet.` — plain `--ink-2` sentence in the content position. No dashed box, no pill |
| Failed to load | `Couldn't load the pipeline.` + `--alert` status pill on the heading |

---

### 2.6 Block C — Campaigns

| State | Render |
|---|---|
| Collapsed (default) | `Campaigns` · `2` · `›`. The count chip is an annotation: at 0 it is absent and the row reads the empty string below |
| Expanded, headers | `Sent · Opened · Clicked · Replied`, mono caps `--ink-4`, right-aligned, `tabular-nums` |
| A live figure | `--ink-2`, tabular |
| **A measured zero in a cell** (Test number 2: all zeros) | `0` in `--ink-4`. The campaign exists and sent nothing — that is a measurement |
| A missing cell | `—` in `--ink-4`. Distinct from the zeros in the row beside it, and this table is the clearest specimen of that distinction on the page |
| Footnote (expanded) | `Open counts come from tracking pixels and undercount anyone whose mail client blocks images.` — `--ink-4`, 11.5px, directly under the table. This is the reference's §5.6 honesty-note pattern used correctly |
| No campaigns | `No campaigns yet.` |
| Bounded | `Showing 20 of 34 campaigns.` `--ink-4` |
| Failed | `Couldn't load campaigns.` |

**No rate column, ever.** The deck gives raw counts only and it is right. "Test One" is 2 replies
from 5 sends; a helpful designer adding a reply-rate column renders `40%` — a number computed from
five events, presented at the same visual weight as everything else on the page. That is the exact
lie Block D exists to prevent, imported into Block C.

**Do not "fix" a row where Replied > Opened.** It looks like a data bug and it is the pixel
undercount the footnote already explains.

---

### 2.7 Block D — Approach performance

This block's whole point is that **half of it is permanently unmeasurable**, and the deck is right
that the group is not a footnote — it is half the table.

| State | Render |
|---|---|
| Collapsed, today (0 sends anywhere) | `Approach performance` · `›`, and below it `No sends yet — nothing to compare.` in `--ink-3`. The table does not render |
| Group 1 heading | mono caps eyebrow `MEASURED — EMAIL` |
| Group 1 row, with sends | `11%` `--ink-2` tabular · `72` · `8`. **No ring, no bar** — see below |
| **Group 1 row, a rate of 0 from real sends** | `0%` in `--ink-4` (reference §5.5: at 0% the number goes grey, "nothing is happening so nothing lights up"). This is a measurement and must not become `—` |
| **Group 1 row, 0 sends** | rate cell `—`, sends `0`. **A rate needs a denominator; 0/0 is not 0%.** Neither document covers this and it is the state the page will hit first when sending starts: one variant used, one not |
| Group 2 heading | mono caps eyebrow `NOT MEASURABLE` |
| Group 2 standing line | `Replies are only detected on email, so these can't be scored.` `--ink-3`, always shown with the group |
| **Group 2 rows** | rate cell `—` in `--ink-4`; **sends cell carries the real figure** in `--ink-2`. Drain the cell, not the row |
| No approaches | `No approaches set up.` |
| Failed | `Couldn't load approach performance.` |

**No track, no ring, no bar in either group.** In group 2 a track implies a scale that does not
exist. In group 1 a bar at 11% invites comparison against the drained group above it, which is the
comparison the block is built to forbid.

**This closes a live bug, not a hypothetical one.** The `p7-variant-stats-blind-spot` memory records
that reply rates are email-only after S15 and non-email variants currently read a **false 0%**. The
design doc says this blind spot is "closed here at the point of display." So Block D is the fix, and
a build that computes `replies / sends` uniformly across the four approaches reopens it.

---

### 2.8 Block E — Needs you

| State | Render |
|---|---|
| Heading | `Needs you` + count chip. Chip is an annotation: present at ≥ 1, **absent at 0** |
| Row kind 1 | business `--ink` 13/600 · channel tag right (`Instagram`) · `replied 2 days ago` `--ink-3` · snippet in quotes `--ink-2` · `Nothing drafts replies for Instagram.` `--ink-4` |
| Row kind 2 | as above, closing line `No draft in the queue.` |
| Row kind 3 | business · `follow-up due 3 days ago` · the note |
| Row separation | hairline `--line-soft`, **never boxed** (reference §4, §6 "avoid boxing every row") |
| Durations | `4 hours ago` · `2 days ago` · `3 weeks ago` · under an hour `just now` |
| **Empty (today)** | `Nothing waiting.` — `--ink-2` sentence, **left-aligned in the block's normal content position**, block heading and spacing unchanged |
| Bounded | `Showing 20 of 41.` |
| Failed | `Couldn't load what's waiting.` |

**The empty state must not use `.emptycard` from components.html.** That specimen has a dashed
border and an action pill, and both are wrong here:

- A **dashed border** means "to be filled in" — it reads as a hole. `Nothing waiting.` is a finding,
  not a hole.
- The **pill is an action**, and D6 forbids any action on a lead on this page. There is nothing to
  offer. Reference §5.14 rule 4 says "one action per empty component, maximum" — maximum, and here
  the right number is zero.

The tell that separates "intentional" from "broken" is **centring**. Centred text in a box is an
empty state. Left-aligned text where the content lives is a statement. Same words, opposite reading.

---

### 2.9 Block F — Health strip

Reads as a footer. Hairline `--line` above it, no card border, no panel fill. Reference §5.8's stat
strip grammar without the figures.

| State | Render |
|---|---|
| **All well (today)** | one line, `--ink-3`, 11px: `Engine ran 2h ago · all sites ok · checked 6h ago`. `Check now` as a `.btn` outline pill pushed right. **No hue anywhere** |
| Engine warnings | one line each, prefixed `⚠`, above the summary line. Exact strings from `outreachHealth.ts` — do not paraphrase |
| `engine-never-ran` | `ShikksTracker send engine has never reported a run` — `--alert` |
| `engine-unreadable` | `ShikksTracker send engine reported an unreadable run time` — `--alert` (a contract break) |
| `engine-stale` | `ShikksTracker send engine last ran 3d ago` — `--amber` (ageing, textbook) |
| `engine-errors` | `ShikksTracker send engine reported 2 errors` / `1 error` — `--alert` |
| `stranded-approved` | `3 approved messages are stranded, unsent` / `1 approved message is` — `--alert`. **The one line on the page with a real human waiting at the other end** |
| Site down | `Meowchi returned HTTP 503` / `timed out` / `unreachable` — `--alert` |
| Sites fine, alongside warnings | `AzeroTech ok · ShikksTracker ok` — `--ink-3`, indented under the warnings |
| Snapshot stamp | `checked 6h ago` — `--ink-4`. **Never hued**: it is meta about the reading, not a finding |
| **Stale snapshot (> 30h)** | **`all sites ok` is dropped entirely** and the stamp becomes a statement: `sites not checked since 2d ago` in `--amber` |
| `sites never checked`, monitoring **on** | `--amber` — a real gap |
| `sites never checked`, monitoring **off** | `--ink-4` grey — a setting, not a fault |
| Busy | `Check now` → `Checking…`, disabled, `--ink-4`. **The existing strip content does not blank, grey out, or optimistically re-stamp.** The old reading stays true until the new one lands |
| Engine unknown (summary call failed) | `Engine — unknown` in `--ink-4`. Not amber: we do not know, and "unknown" is not a fault claim |

Two of those rows are mine rather than the deck's, and both close real lies:

- **`all sites ok · checked 5d ago` is a lie in the present tense.** It asserts a current state from
  a stale reading. The threshold 30h is not invented — it is `site-health`'s own
  `everyHours + graceHours` from `EXPECTATIONS`, so the strip and the watchdog agree on what "fresh"
  means instead of each holding a private number.
- This also makes a **silent writer failure visible**. `HealthSnapshot` is written by the morning
  cron; if that write starts failing, the reader has no idea — the stamp just ages while the strip
  keeps saying everything is fine. The 30h rule converts an invisible write failure into a visible
  stale reading.

---

### 2.10 Whole-page states

| State | Render |
|---|---|
| Signed out | not reachable; redirect to sign in. Nothing to design |
| **One source down** | that block carries its own string (`Couldn't load the pipeline.` etc.) and an `--alert` status pill on its heading. Every other block renders normally. Cards fed by the failed call go `—` + `couldn't load` |
| **All external data down** | deck §6 verbatim, at the top: `Couldn't reach ShikksTracker.` (`--ink` 13/600) over `State of play, pipeline, campaigns, approaches and what's waiting all come from there.` (`--ink-3`), on a `--panel` well with a 20% `--alert` border. **The per-block failure strings are suppressed** — the reason is stated once. Hero cards stay, drained, `—`, **no caption** (the statement above is the caption). The strip still works: `Engine — unknown · Meowchi ok · checked 6h ago` |
| **Mongo unreachable** *(neither document covers this)* | the agents rail badges render `—` / `unknown`, **not** grey "never run" — with no run records we cannot claim an agent never ran. The site snapshot is also gone, so the strip reads `sites — not read`. If the session guard also needs the DB the page will not render at all, which is fine; the point is that a *partial* DB failure must not become a confident "never run" |
| Busy | only `Check now`. Everything else arrives with the page |
| **No first-run banner, in any state** | see §4.1 |

---

## 3. Where a naive build would lie

Each with the fix.

1. **`contacts.total ?? 0` (and every other `?? 0`).** `SummaryResponse` is `number | null`
   throughout, on purpose. P8 widens it with `contacts` and `campaigns`, and the first `?? 0` in a
   view turns "not reported" into a measured zero. **Fix:** every new field goes through
   `readCount`; the view uses one shared renderer that maps `null → —` and `number → figure`. `??`
   is banned in the view layer for any count.
2. **Widening the interface without carrying the field through `fetchSummary`.** That function
   *reconstructs* its return value; a new interface field silently arrives `undefined`. `stApi.ts`
   warns about this by name — "that exact pair was missed once already, in P4's `overdueActions`."
   **Fix:** interface + `fetchSummary` + a test, one commit. This is the most dangerous lie on the
   list because a page of undefineds looks identical to a page of honest zeros, and today's real
   data *is* mostly zeros — the truth camouflages the bug.
3. **Building the rail from `AGENTS` instead of `EXPECTATIONS`.** Three phantom badges, two for
   deleted agents. **Fix:** iterate `EXPECTATIONS`.
4. **Green on a switched-off agent.** `ok: true`, zero counts, note in `error`. **Fix:** read
   `chaserEnabled` / `monitoringEnabled`; render `off`.
5. **Green on a degraded run** (`ok: true`, `itemsFailed: 3`). **Fix:** amber + `3 items failed`.
6. **A `0%` on any Facebook / Instagram / phone approach.** Not a measurement — an absence of one
   (S15). **Fix:** Block D's two groups, em-dash, never a computed rate off email.
7. **`0 replies / 0 sends = 0%`.** A rate with no denominator. **Fix:** `—`.
8. **The reference's own §5.12 specimen — most of it has no data behind it.** This is the biggest
   trap in the phase, because the component is literally called "Outreach pipeline" and this is the
   outreach page. Audit:

   | Encoding in §5.12 | Does the data exist? |
   |---|---|
   | Cadence strip (three Mon/Wed/Fri bars, empty→sent→opened→replied) | **No.** RikuOS has no per-contact touch log; `/api/os/attention` gives `stage`, `repliedAt`, a snippet. A per-touch "opened" signal never reaches RikuOS at all — and opens undercount anyway (Block C's footnote) |
   | `3/3` mono fallback | **No.** Same reason |
   | `21% reply rate` in the summary strip | **No.** An all-channel reply rate is exactly what S15 made unmeasurable. This is Block D's lie sitting inside the design reference |
   | `6 gone cold` | **No.** There is no cold state; contacts have pipeline stages |
   | `Cold` and `No reply` state tags | **No.** Not modelled |
   | `Replied` / `Booked` state tags | **Yes** — `replied`, `call_booked` |
   | `42 sent` / `9 replied` | **Per campaign, yes** (Block C). Not per contact |
   | `3 booked` | **Yes** — `call_booked` count |

   Roughly half the component is mock. **Fix:** take §5.12's *row grammar* — hairlines not boxes,
   identity left, meta right, tabular figures, the state tag with only the terminal success filled
   — and take none of its encodings. Block E gets identity + channel tag + recency + a text line.
   Block B gets label + figure. No cadence strip, no summary-strip rate.
9. **A `● connected` pill for ShikksTracker in the top bar.** Claims a liveness never measured.
   **Fix:** no pill.
10. **A funnel bar or stacked bar for the pipeline stages.** `byPipelineStage` is a snapshot of
    current states, not a flow. A funnel asserts a conversion story: that 25 contacts *progressed
    to* not-started. **Fix:** plain right-aligned tabular figures, the deck's own render.
11. **A reply-rate or open-rate column in Block C.** 40% from five events. **Fix:** raw counts only.
12. **`all sites ok` printed from a stale snapshot.** Covered in §2.9.
13. **A draft backlog or approved-and-waiting in the health strip.** Both are named deliberate
    silences in `docs/ROADMAP.md` P5, pinned by tests. **Fix:** drafts live in H1, approved lives in
    the state-of-play line, and neither is ever hued.
14. **`Sending is off` in amber when the contract lands.** It is the resting state under S10.
    **Fix:** `--ink-2`, no hue, no `⚠`.
15. **Token-name mismatch between the two reference files — a warning that silently loses its
    colour.** `DESIGN-INSPO.md` §2 names `--stale` and `--missing`; `components.html`'s `:root`
    defines `--amber` and `--alert` and defines neither of the other two. `components.html` already
    papers over it once with `var(--stale,#FBBF24)`. A build that writes `color: var(--missing)`
    against those tokens gets **no colour at all** — the red warning line inherits `--ink-3` and
    reads as ordinary text. A warning that fails to look like a warning is a lie by omission, and it
    fails silently in exactly the place it matters most. **Fix:** pick one set of names in the P8
    stylesheet, define all four, and never rely on a `var()` fallback.
16. **A dashed box with a CTA for `Nothing waiting.`** Covered in §2.8.
17. **A hero card that disappears at zero.** Row reflows 3→2 and absence becomes invisible.

---

## 4. Where I disagree with the obvious answer

### 4.1 The first-run banner: no. Not now, not later, not on this page.

The obvious reading is reference §5.14 rule 5 — "before anything is connected every card would be
empty… one banner at the top of the page in the brand hue with a single action." The page is empty.
Therefore, banner.

**Rule 5's precondition is false here.** Everything *is* connected. ShikksTracker answered today.
The crons run. The send engine ran same-day with zero errors. The page is empty because **sending is
off by Riku's standing instruction** (S10) — a decision, not an unfinished setup. A banner would
have to say one of three things and all three are wrong:

- *"Nothing's connected yet"* — false.
- *"You haven't started sending"* — true, and a nudge. The `no-sends-without-say-so` memory says
  never nudge, and the banner's brand hue would make it the loudest object on the page: the system
  leaning on Riku about the one decision he reserved entirely to himself.
- Anything with **a single action** — D6 forbids any action on a lead here, and the deck's §1
  forbids onboarding outright ("no onboarding, no marketing, no help text, no first-run tour").

**What replaces it: nothing.** The absence of the banner *is* the design. The page reads as finished
because the containers are composed, the row has one lit card, and the strip is quiet — not because
something explains the emptiness. Explaining it would concede that it needs explaining.

The one banner this page ever gets is the opposite case: deck §6's `Couldn't reach ShikksTracker.`
statement. That is a page-level banner about a page-level fact, and it should look like one.

### 4.2 The "Sending is off" slot renders nothing today — not a drained slot

The obvious reading combines the deck's "design a slot for it" with §5.14 rule 1 "the container
never disappears" and produces a permanently drained row reading `sending — not reported`.

Three reasons that is wrong:

1. **Nothing was measured because nothing was asked.** `readCount` returning `null` means
   "ShikksTracker did not send a field we expect." There is no `sendingEnabled` field in the
   contract, no request for it, no expectation. Drawing an absence-of-measurement for a measurement
   never attempted misrepresents the app's own behaviour — it implies a failed lookup that never
   happened.
2. **It is a standing complaint about an unlanded contract.** D7 says nothing blocks and the line is
   simply absent. A drained slot makes the page say, every day, that a cross-repo change has not
   happened. Riku already knows; he made the call.
3. **Riku's own decision 2** rules out an empty placeholder card in the hero row. The same reasoning
   applies one line down.

**A slot is not reserved space — it is a position in something that grows.** The state-of-play line
(§2.4) is that slot: it renders zero, one or two lines, so A4 arriving costs nothing and reflows
nothing. That satisfies the deck's instruction without a placeholder.

### 4.3 The third hero card is "Needs you" at 0, not "hot leads" at 2

The obvious answer picks 2 over 0 because a hero card showing zero looks like a wasted card.
Covered in §2.3: the 0 is the answer to the page's own question, "hot" is already on the page and is
a judgement RikuOS cannot account for, and — the condition that actually matters — the hero figure
must be the same computed number Block E renders, or the page contradicts itself in one screen.

### 4.4 Riku's four badge colours are not enough — "off" is a fifth state

Not a disagreement with the decision; a disagreement with taking it literally. Decision 3's four
states (green ran fine / amber overdue / red failed / grey never run) map cleanly onto
`evaluateWatchdog`'s outputs, but the code produces two states outside them: **degraded**
(`ok: true`, `itemsFailed > 0`) and **switched off** (a real `ok: true` run record for an agent that
declined to work). Both land on green under the obvious mapping, and green means "ran fine."
Degraded takes amber; off takes the drained grey with a lowercase `off` caption. Six states, four
colours, distinguished by caption where the colour honestly cannot separate them.

### 4.5 Reject the reference's own outreach-pipeline component

§5.12 is the reference's flagship RikuOS-layer component and it is the natural thing to reach for on
the outreach page. Half its encodings have no data (§3.8). Take the grammar, leave the encodings. I
expect pushback on this one and I will hold it: a cadence strip and a `21% reply rate` on this page
would be the two most confident-looking objects on it and both would be invented.

### 4.6 The health strip must drop "all sites ok" when the snapshot is stale

The obvious answer keeps the phrase and lets `checked 2d ago` qualify it. A qualifier does not undo
an assertion — the eye reads "all sites ok" and moves on. Past 30h the phrase must not be printed at
all, because we do not know it. Covered in §2.9.

---

## 5. Open questions only Riku can answer

1. **Third hero card.** I recommend **Needs you** (0 today, and the same count Block E renders) over
   hot leads. Reasoning in §2.3 / §4.3.
2. **Wording when `contacts.hot` is missing.** The deck has `30 contacts · 2 hot` and a missing form
   for drafts and totals, but not for `hot`. I propose dropping the clause and adding one `--ink-4`
   line: `ShikksTracker didn't report how many are hot.` Riku's wording wins.
3. **Stale site snapshot.** Should `sites not checked since 2d ago` be amber (my recommendation), or
   stay grey on the grounds that the watchdog's push already covers it?

Everything else in this paper I have decided from the code and the two documents; the lead can
overrule but Riku does not need to be asked.

---

## 6. Risks — what could make this page confidently wrong

1. **A lying data layer under an honest view.** If the new summary fields skip `readCount`, or a
   field is added to the interface and not to `fetchSummary`'s reconstructed return, every rule in
   this paper is decoration. And the bug is camouflaged: today's honest render is mostly zeros, so a
   page of accidental zeros looks correct. **Mitigation:** unit tests that feed `fetchSummary` a
   payload with fields *omitted* and assert `null`, plus a render test asserting `—` — this is the
   deck's checklist item "'Not reported' is visually distinct from '0'" turned into a test.
2. **Hue inflation crowding out the one alarm.** The health strip is the page's only alarm surface
   and its value comes entirely from being silent. Every hue added elsewhere raises the floor. If
   the hero row ends up with three hued cards, the strip's one red line stops being the loudest
   thing on the page. The budget is one hue in the hero row today.
3. **A silent snapshot writer.** `HealthSnapshot` is written by the morning cron and read by the
   page. Nothing checks that the write happened. Without the 30h rule (§2.9) a broken writer looks
   exactly like a healthy system, forever.
4. **A future session reading "engine healthy, nothing sent" as a gap to close.** `ARCHITECTURE.md`
   §7 already records this trap in as many words. The design's protection is that nothing on this
   page frames an unsent pipeline as a fault: no hue on H2, no hue on A2, no strip line for drafts.
   If any of those acquires amber later, the page starts arguing with S10 daily.
5. **Test data rendered as business.** "Test One" and "Test number 2" will show as real campaigns
   until Riku deletes them. Not a design lie — it is what the system holds — but it is what a
   portfolio screenshot will contain. Worth knowing.
6. **Derived-number creep.** Today the only derived values on the page are age strings and Block D's
   email reply rate. The moment someone adds "83% never contacted" or a conversion rate, the page
   acquires claims whose denominators nobody has validated, on a dataset of 30 contacts and 5 sends.
7. **Token-name drift** (§3.15). A warning line that silently renders in body grey is the worst
   class of failure here, because it fails toward "everything is fine."

---

*Written from: the content deck (§1–§9), the design doc (D1–D8), `DESIGN-INSPO.md` §§1–7,
`components.html` in full, `CLAUDE.md`, `src/lib/stApi.ts`, `outreachHealth.ts`, `siteHealth.ts`,
`watchdog.ts`, `jobs/runJob.ts`, `app/api/cron/morning/route.ts`, `models/AgentRun.ts`,
`models/OsSettings.ts`, `ARCHITECTURE.md` §7 (S10, S15, S17 and the "running engine is not a sending
engine" note), and `docs/ROADMAP.md` P5's three deliberate silences.*
