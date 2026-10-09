# The Briefing — an assistant voice for the morning push

**Status:** design, awaiting Riku's review · **Date:** 2026-10-09 · **Proposed decision:** S21 (§9)
**Content discussed with Riku:** 2026-10-09, in one session (S11 satisfied for this feature).

---

## In plain words

The 07:00 push stops reading like a system notification and starts talking to you like a composed,
friendly assistant who calls you Riku. It greets you, tells you what kind of day it is, explains any
problems in plain words, and then runs through your day.

On the site, that message becomes **the Briefing**. The first time you open the app each day (on any
device), the Briefing fills the screen. Dismiss it and it shrinks into a one-line greeting at the top of
every page, and tapping that line brings it back as a panel. In the Briefing, every problem has a next
step, and tapping a problem opens a card, grown out of that line, with the likely cause. When the app
doesn't recognise an error, it says so honestly and shows you the raw error. A live "since then"
section keeps the Briefing useful after the morning.

The "This morning's push" tile on the Personal page is removed. The Briefing replaces it.

---

## 1. Decisions taken in the content discussion

| # | Decision | Riku's choice |
|---|---|---|
| V1 | Where the voice speaks | The morning push and the Briefing only. Short UI errors ("Couldn't save.") stay plain. |
| V2 | Character | Composed and human, like a good butler, not AI-sounding. Friendly. Calls him **Riku**, never "sir". |
| V3 | Problems | The push says them in plain words. The Briefing adds a next step for each. The likely cause appears **only on tap**, in a card that grows out of the tapped line. Key words are bold (Briefing only). |
| V4 | Where causes come from | A **fixed catalogue** matched against the real error. No AI. Unrecognised errors are reported honestly and **marked** so they can be counted. Asking Claude about unrecognised errors comes later (§10). |
| V5 | Greeting | An opener plus a read on the day. Both vary, chosen from the facts and the date. |
| V6 | Problems that happen together | Same kind → one sentence. Same cause → name the common thread. Known chains → one story. Unrelated → joined naturally. |
| V7 | Where the Briefing lives | Not a separate page. A **full-screen greeting on the first visit of the day**, which shrinks into a **greeting line on every page**. Tapping the line opens the Briefing as a panel. |
| V8 | Opened later in the day | The 07:00 Briefing as sent, **plus a live "since then"** section built only from reads that are fast and cheap. |
| V9 | Personal page push tile | **Removed.** Its warnings move to the greeting line. |
| V10 | "First visit" | Once a day **across all devices**, stored on the server. |

---

## 2. The voice

Rules every string in this feature follows:

- Speaks in the first person about what it checked ("I couldn't read your Classes calendar"), and in the
  second person to Riku. Never "the system", never "sir".
- Says the fact first and the feeling second. Never cheerful over a problem.
- **Never claims more than it knows.** Causes from pattern matching are worded as likely ("Most
  likely…", "looks like", "points to"). A cause the app knows for a fact (for example, Google's expired
  token) is stated plainly. Two problems are only linked when the catalogue says so (§4.4).
- Push text uses straight apostrophes (`isn't`). Page text uses curly ones (`isn’t`), per ruling L10.
  Each module that writes text knows which surface it's writing for.
- Every sentence is written in advance, in a catalogue. Nothing is generated at runtime, so every
  sentence can be tested.

---

## 3. The push

### 3.1 Title = opener + read on the day (≤ 80 characters, PUSH_TITLE_MAX)

**Openers** rotate, chosen by date (§3.3):

| Pool | Lines |
|---|---|
| Any day | Morning, Riku. · Good morning, Riku. · Riku, good morning. · Morning. Here's your day, Riku. · Up and at it, Riku. · Hey Riku, morning. |
| Monday | New week, Riku. |
| Friday | Last push of the week, Riku. |
| Saturday, Sunday | Easy morning, Riku. |

On Monday, Friday and weekends the day-specific opener is used. Every other day draws from the "any day"
pool.

**Read on the day.** The first rule that applies wins:

| Rule | When | Lines |
|---|---|---|
| Problems | stories ≥ 1 (§4.4) | One thing needs you. · Two things need you. · *N* things need you. (N ≥ 3 also allows: A rough night. *N* things need you.) |
| Busy | no problems; events today + due + overdue ≥ 4 | Full day ahead. · Busy one today. |
| Quiet | no problems; nothing scheduled, nothing due or overdue | Quiet one today. · Clear runway today. |
| Ordinary | otherwise | All's well. · Nothing's on fire. |

A problem morning never gets a busy, quiet or ordinary line. This keeps R23: the title never reads
all-clear over a blind spot. Numbers up to ten are written as words, and 11 or more as digits.

**Weekend opener and quiet day together:** "Easy morning, Riku. Quiet one today." reads fine and is
allowed.

### 3.2 Body (≤ 320 characters, PUSH_BODY_MAX), as ordinary sentences in this order

1. **Problems**, in plain words, as stories (§4.4). They come first, so truncation can never cut a
   problem. When the budget runs out, the rest collapse into `…and N more, see the Briefing.`
2. **Today**: events with times, then due and overdue to-dos. For example: `Today you've got Math
   Methods at 09:00 and the gym at 18:00. The essay draft is due.` A missed calendar is said
   honestly, never as "nothing scheduled": `I couldn't read your Classes calendar, so today might be
   missing something.` (This replaces R23's `Classes wasn't read.` with the same meaning.)
3. **Freelance**: `One lead is waiting on your reply.` / `2 leads are waiting on you, 1 follow-up is
   overdue.` / omitted when both are zero. When the pipeline check failed, that is a problem (§4) and
   this line is left out, never written as zeros.
4. **Switched off**: `The chaser's still off, by the way.`

The existing budgeting machinery (`problemsWithin`, `composeTodayLine` with its compact form,
`listPart`) is kept and re-worded rather than rewritten. Its guarantees (problems never cut, the
freelance line never sliced) carry over unchanged.

**The approvals count** (`N to review`) moves from the title into the freelance line: `3 drafts are
ready for your review.` (omitted at zero).

**Example: a bad morning**
> **Good morning, Riku. Two things need you.**
> Meowchi's site isn't answering (error 503), and separately, the chaser didn't run last night. Today you've got Math Methods at 09:00 and the gym at 18:00. The essay draft is due. One lead is waiting on your reply.

**Example: a clear Monday**
> **New week, Riku. Full day ahead.**
> Today you've got Math Methods at 09:00, a meeting at 13:00 and the gym at 18:00. The essay draft is due. 2 drafts are ready for your review.

### 3.3 Choosing lines deterministically

`pickLine(pool, dayKey, salt)` is a pure function. It hashes the APP_TZ day key (plus a per-pool salt)
into an index. It **must not** pick the same line as the previous day's key. When the hash lands on
yesterday's index, it steps to the next one. Tests cover 366 consecutive days for every pool with
two or more lines. No `Math.random`, so the same morning always produces the same text, and the
Briefing always matches the phone.

### 3.4 What does not change

- The push goes out every day while monitoring is on (P5a-4).
- Monitoring off still means no push.
- The route-failure alert (`Morning run failed`) and other alert pushes keep their current plain
  wording (V1).

---

## 4. The problem catalogue

### 4.1 Structured problems replace strings

`buildProblems` returns `Problem[]` instead of `string[]`:

```ts
type Problem = {
  key: ProblemKey;          // closed set, the table in §4.2
  subject: string | null;   // site name, agent id, calendar name, count: whatever the wording needs
  raw: string | null;       // the raw error, bounded to RAW_ERROR_MAX (300)
  facts: { status?: number; ageHours?: number; count?: number; calendarCause?: CalendarCause };
};
```

`composeDigest` adds its own problems the same way: `pipeline-unavailable`, `calendar-unavailable`
(now carrying **why**: not-configured / expired / timeout, which `calendarForDigest` currently
discards and must keep), `calendar-partial`, and `todos-unavailable`.

The watchdog's `Anomaly.kind`, `SiteResult` (status, or timed-out/unreachable) and `OutreachFinding.kind`
already carry everything needed. `SiteResult` gains an optional `status` and a `failure: "status" |
"timeout" | "unreachable"` field, so the catalogue doesn't have to parse its `detail` string.

### 4.2 The table

Push wording uses straight apostrophes. The Briefing renders the same sentence with curly ones and
**bold** on the key words (bold marked here).

| Key | Push / Briefing sentence | Next step (Briefing) | Cause card |
|---|---|---|---|
| `site-status` | **Meowchi's site** isn't answering (error 503). | Open the site, then check its latest deploy on Vercel. | 5xx: Most likely **the site's server is crashing or mid-deploy**. 404: **the page or deployment was removed**. 401/403: **the site is asking for a login**. Other 4xx: **the site refused the request**. |
| `site-timeout` | **AzeroTech's site** took too long to answer. | Open it and see if it loads. | Most likely **a slow or overloaded server**, or a cold start past 8 seconds. Often clears on its own. |
| `site-unreachable` | **ShikksTracker's site** can't be reached at all. | Check the domain and the Vercel project still exist. | Most likely **the address doesn't resolve or refused the connection**: a removed project or a network fault. |
| `agent-never-ran` | **The site check** has never run. | Check the cron is in vercel.json and deployed. | **It was never scheduled.** Usually a new job missing from the deployed cron list. |
| `agent-stale` | **The chaser** hasn't run since yesterday morning (31 hours). | Vercel → Crons: look for missed runs. | Most likely **Vercel didn't trigger it**: a paused project, a failed deploy, or a cron limit. |
| `agent-failed` | **The chaser** failed last night. | Look at its last run's error. | The watchdog sees only the run's ok flag, not its error, so this is the honest line: **I can see it failed, but not why.** Its run record holds the error. (`causeKey: "none"`) |
| `agent-degraded` | **The chaser** hit 2 snags: 2 items didn't go through. | Look at that run's failed items. | Most likely **some items were rejected** while the rest went through, usually bad data on those items. |
| `job-failed` (expiry sweep, watchdog, site check, outreach check, this run) | **The site check** broke this morning. | Same as `agent-failed`. | From the raw-error rules (§4.3). |
| `snapshot-unsaved` | I checked the sites but **couldn't save the result**. | Nothing needed if it's gone tomorrow. | **The database write failed** after the check succeeded. |
| `unstuck-items` | **2 approved items** couldn't confirm they went through. | Check those leads in ShikksTracker before resending. | **It's unknown whether they were sent**, so they're parked for you and never resent automatically. |
| `engine-never-ran` | **ShikksTracker's sender** has never reported a run. | Check its pinger and crons. | **It has never been triggered**, or it doesn't record its runs. |
| `engine-unreadable` | **ShikksTracker's sender** reported a time I can't read. | Check its last run record. | **Its run record is malformed.** That's a ShikksTracker bug to note there. |
| `engine-stale` | **ShikksTracker's sender** hasn't run in 2 days. | Check ShikksTracker's pinger and crons. | Most likely **its hourly trigger stopped.** It only runs when pinged. |
| `engine-errors` | **ShikksTracker's sender** hit 3 errors. | Check its last run in ShikksTracker. | Most likely **some sends were refused**: a bad address or a mail-provider limit. |
| `stranded-approved` | **4 approved messages** are stuck, unsent. | Fix the sender first. They go once it runs. | **The sender is down**, so nothing approved can leave. |
| `pipeline-unavailable` | **I couldn't reach ShikksTracker**, so I don't know how freelance is going. | Open ShikksTracker and check it's up. | From the raw-error rules (§4.3). The route must now keep the error it currently only logs. |
| `calendar-unavailable` | **I couldn't read your calendar.** | Settings → Google Calendar. | Known: not-configured → **Google isn't connected.** expired → **Google access has expired.** timeout → **Google didn't answer in time.** Other → raw-error rules. |
| `calendar-partial` | **I couldn't read your Classes calendar**, so today might be missing something. | Check that calendar still exists in Google. | Most likely **that one calendar refused or was removed**, while the others answered. |
| `todos-unavailable` | **I couldn't read your to-dos.** | Reload the Personal page. | Most likely **the database didn't answer.** |

Agent ids are spoken as names: `chaser` → "the chaser", `site-health` → "the site check",
`outreach-health` → "the outreach check", `expiry-sweep` → "the expiry sweep", `dispatcher` → "the
morning run". Each is a closed map keyed by the `Agent` enum. Adding a new agent without a name
fails to compile.

### 4.3 Raw-error rules (first match wins)

Applied to `raw` for `job-failed`, `pipeline-unavailable` and unknown calendar failures.

| Pattern (case-insensitive) | Cause (Briefing) | `causeKey` |
|---|---|---|
| `ETIMEDOUT`, `timed out`, `timeout`, `aborted` | Most likely **it took too long**: the service or network was slow. Usually clears by itself. | `timeout` |
| `ENOTFOUND`, `EAI_AGAIN`, `ECONNREFUSED`, `ECONNRESET` | Most likely **I couldn't find or connect to the server**: network or DNS trouble, or the service is down. | `network` |
| `MongoServerSelectionError`, `MongoNetworkError`, `MongooseServerSelectionError` | Most likely **the database didn't answer**: an Atlas blip or the connection limit. | `database` |
| `invalid_grant`, `401`, `expired` | Most likely **a key or token stopped working.** It needs renewing. | `auth` |
| `403` | Most likely **access was refused**: a permission changed. | `forbidden` |
| `429` | Most likely **too many requests.** A rate limit that waits itself out. | `rate-limit` |
| HTTP `5\d\d` | Most likely **the other service had an error on its end.** | `upstream` |
| *(none)* | **I don't recognise this one.** The raw error is below. | `unrecognised` |

Number patterns match only as whole tokens (`\b401\b`), so an id containing "401" doesn't match.
Order matters, and the tests pin it.

### 4.4 Problems that happen together: stories

`groupProblems(problems): Story[]` is pure. It runs these rules in order. Each problem joins at most
one story, and whatever is left becomes a one-problem story.

1. **Known chains** (fixed list):

   | Members | Told as (push) |
   |---|---|
   | `site-unreachable`/`site-timeout`/`site-status` for ShikksTracker + `pipeline-unavailable` (+ `engine-stale`) | ShikksTracker looks down, which is why I couldn't check freelance (and why its sender hasn't run). |
   | `engine-stale` or `engine-never-ran` + `stranded-approved` | ShikksTracker's sender hasn't run in 2 days, so 4 approved messages are stuck. |
   | `calendar-unavailable` (expired) + `calendar-partial` | Google access has expired, so I couldn't read your calendar. (Shown as one problem.) |
   | `job-failed` × N whose raw errors share `causeKey: database`, + `todos-unavailable`, + `snapshot-unsaved` | The database didn't answer this morning. That's behind the failed checks and why I couldn't read your to-dos. |

2. **Same cause:** two or more `job-failed`/`pipeline-unavailable` problems whose `causeKey` is the same
   (and isn't `unrecognised`): `Three checks failed last night, and they all point to the database.`
3. **Same kind:** two or more problems with the same key: `Meowchi and AzeroTech are both down (error
   503 and timed out).` / `The chaser and the site check both failed last night.`
4. **Unrelated:** stories are joined with `, and separately, ` for the second and `; also, ` after that.

**Counting (Riku to confirm, §11 Q1):** the title counts **stories**. Each story keeps its symptoms,
and the Briefing lists every one of them. Links use "looks like", "points to" or "behind", never
"caused by".

### 4.5 Unrecognised errors

When the cause rules return `unrecognised`, the card leads with **I don't recognise this one.** and
shows the full raw error. The stored Briefing records `causeKey: "unrecognised"` and the raw text on
that problem, so a later query can count them. **Seam for later (§10):** `explainCause(problem)` is the
single function that turns a problem into a cause. A future fallback that asks Claude about unrecognised
errors slots in behind it and changes nothing else.

---

## 5. The Briefing on the site

### 5.1 The greeting line (every page, in TopBar)

TopBar currently holds only the "read HH:MM" stamp, and its docblock argues against extra elements.
The greeting line is the one deliberate addition. The stamp stays at the right. The line is a
button.

| State | Line | Tone |
|---|---|---|
| Today's Briefing, no problems | Good morning, Riku. All's well. *(the stored title)* | normal |
| Today's Briefing, problems | Good morning, Riku. Two things need you. | warning |
| Past PUSH_EXPECTED_HOUR, none today, monitoring on | No briefing this morning. The 07:00 run didn't happen. | alarm |
| Monitoring off | Monitoring is off, so there's no morning briefing. | muted |
| Before PUSH_EXPECTED_HOUR | Your briefing comes at 07:00. *(tap opens yesterday's, labelled "Yesterday")* | muted |
| A push went out, its record couldn't be saved | A briefing went out, but I couldn't save it. | warning |
| Never sent | No briefing yet. | muted |
| The record couldn't be read | I couldn't load the briefing. | warning |

These are the push tile's existing states (`buildPushTileView`), moved and re-voiced. The state logic
is reused, not rewritten. On a phone (S20's 44px top strip), the line truncates with an ellipsis and
stays one line. The tone is carried by colour **and** a leading dot, never by colour alone.

**Read path:** the state needs the same three inputs `buildPushTileView` takes today: `LastDigest`
(through the read-only `getLastDigest`, one `findOne` with no upsert, per R55), the latest dispatcher
`AgentRun` (to tell "went out, not stored" apart from "didn't run"), and the monitoring flag (through
the rail's read-only settings accessor, R37). All three are read-only and run in parallel. The rail
already reads settings and agent runs on every page, so the plan should reuse those reads rather
than repeat them. If any read fails, the line shows the "couldn't load" state (or the existing
precedence's answer) and the page still renders.

### 5.2 The full-screen greeting

- **Shown when** today's Briefing exists, `seenAt` is empty, and the current page has finished its
  first render. It's rendered as an overlay over whatever page was opened. The app still opens on
  /freelance (R42 unchanged).
- **Dismissed by** "Got it", a tap on the backdrop, or Esc. It then animates down into the greeting
  line: the same grow/shrink motion as the cause cards (§5.4), with the greeting line's box as the
  target.
- **On dismiss** it sends `POST /api/briefing/seen` with the Briefing's `sentAt`. The handler is a
  guarded atomic update: `findOneAndUpdate({_id: "latest", sentAt, seenAt: null}, {$set: {seenAt:
  now}})`. A stale `sentAt` matches nothing (it can't mark a newer morning as seen), and that is
  reported as `{ok: true, applied: false}`. A failed write only means it may greet once more. It never
  blocks and shows no error. The route is session-gated, Origin-checked, and validates its input
  first, like every mutation.
- **The morning push** carries `url: "/freelance?briefing=open"`. That opens the full-screen greeting
  regardless of `seenAt`, and the parameter is removed from the address bar after opening.
- Focus moves to the dialog on open and returns to the greeting line on close. It has `role="dialog"`,
  `aria-modal`, and a heading that labels it. Background scrolling is locked while it's open.

### 5.3 The panel

Tapping the greeting line opens the same Briefing content as a panel: from the right on desktop
(max 480px wide), and as a bottom sheet on a phone (full width minus the 16px gutters, up to 85% of
the viewport height, scrolling inside). It closes with ✕, the backdrop, or Esc, and focus returns to
the line.

### 5.4 Briefing content (same in the full-screen view and the panel)

1. **Greeting** (the stored title) with `07:00` (the time it was sent, in APP_TZ).
2. **Problems: "As of 07:00"**. One row per story. The sentence has its bold key words, and the next
   step sits beneath it in quieter text. Grouped symptoms are listed indented under their story, each
   one tappable. Every symptom row is a `<button>`.
3. **The day as of 07:00**: the stored Today, freelance and switched-off sentences, in full and never
   cut short.
4. **Since then** (§6), loaded live.

**The cause card.** Tapping a symptom grows a card from that row. It's a FLIP animation: the row's
rectangle is measured, and the card starts with a transform that matches the row, then animates to its
resting position in about 220ms with ease-out. Closing reverses it. The card holds **Likely cause**
(bold key words), **What to do**, and the **raw error** in monospace (bounded, wrapping, never
scrolling sideways). For `unrecognised`, it leads with the honest line. It's a dialog with focus
management like §5.2. Under `prefers-reduced-motion: reduce`, the card and the full-screen greeting
fade (opacity only, about 120ms) with no scaling. It fits a 320px-wide viewport with no sideways
scroll.

**Older records** (sent before this ships, so with no `briefing` field) render as a plain quote of
title and body under the greeting, with no problem rows or cards. Nothing breaks.

---

## 6. "Since then"

Built at render time from fast, cheap reads only, each with its own timeout and its own honest
failure line. One failing read never hides the others.

| Part | Source | Sentence examples | On failure |
|---|---|---|---|
| To-dos ticked since `sentAt` | Todo store (Mongo) | You've ticked off the essay draft. · You've ticked off 3 to-dos. | I couldn't check your to-dos just now. |
| New to-dos due today, added after `sentAt` | Todo store | One new to-do is due today: renew the domain. | (same line) |
| Today's events | Google, via the same read the Personal page uses, with the same timeout and layers | Math Methods is done. Next up: the gym at 18:00. · Nothing else on today. | I couldn't check your calendar just now. |
| New drafts in the queue since `sentAt` | ApprovalItem count (Mongo) | 2 new drafts are waiting for your review. | I couldn't check the queue just now. |

**Deliberately not re-checked:** sites, agents, ShikksTracker. Problems stay labelled "As of 07:00".
The Briefing never says a problem is fixed without re-checking it. When nothing has changed: `Nothing
new since 07:00.`

The stored part renders immediately. "Since then" streams in, with a fixed-height placeholder so the
layout doesn't jump. This is the first piece of the smooth-loading work (§10).

---

## 7. Data

### 7.1 LastDigest grows (still R55's fixed-`_id` singleton, still overwritten whole)

New fields, all optional so older records still read:

```
briefing?: {
  stories: [{                         // ≤ 12
    sentence: string(≤ 240)            // push form, straight apostrophes
    bold: [{ start: int, end: int }]   // ≤ 4 ranges into sentence, for the Briefing
    symptoms: [{                       // ≤ 8
      key: enum(ProblemKey)
      sentence: string(≤ 200)
      bold: [{ start, end }]           // ≤ 4
      nextStep: string(≤ 160)
      causeKey: enum(CauseKey)         // includes "unrecognised", "known", "none"
      cause: string(≤ 240)
      raw: string(≤ 300) | absent
    }]
  }]
  today: string(≤ 600)                 // full Today sentence, never compacted
  freelance: string(≤ 240) | absent
  off: string(≤ 120) | absent
  unrecognised: int ≥ 0                // count, for later querying
}
seenAt?: Date | null
```

- Typed sub-schemas only. **No `Schema.Types.Mixed`.** Every string has a `maxlength` and every closed
  set is an `enum`. Array bounds are enforced by validators.
- `body` keeps `maxlength: 320` and is still what the devices received. The Briefing reads its curly
  apostrophes and bold from the structured fields, never from `body`.
- `seenAt` is written `null` by the 07:00 save (the whole-document overwrite resets it) and set only by
  the guarded update in §5.2.
- **No index change:** `_id` is the only index. No migration script is needed. The schema change is
  additive.

### 7.2 Saving at 07:00

The route already saves the payload after the delivery guard, and treats a failed save as the run's
one failed item without failing the push. That stays exactly as it is. The save simply carries
`briefing` too. If the briefing can't be built (a bug), the push still goes out and the record is
saved without `briefing`, so the site shows the plain quote. That case is logged and counted as a
failed item.

### 7.3 The Personal page

- `PERSONAL_TILES` loses `"push"`. `Push.tsx` and `buildPushTileView`'s tile rendering are deleted, and
  its state logic moves to the greeting line (§5.1).
- **Trap:** `parseLayout` rejects unknown tiles, so a stored layout that still contains `push` would
  read as unreadable and **fall back to the default, losing Riku's arrangement.** Fix:
  `RETIRED_TILES = ["push"]`. On read, `resolveLayoutAgainst` drops retired entries before parsing and
  keeps everything else. On write, `validateLayout` stays strict and rejects `push`. There's a test
  with Riku's real stored shape that includes `push`.
- New default row 2: `[{ tile: "layers", span: 12 }]` **(Riku to confirm, §11 Q2)**.

---

## 8. Modules and tests

Each module is pure, sits in `src/lib/`, and is tested in `src/lib/__tests__/`:

| Module | Job |
|---|---|
| `voice.ts` | Opener and read-on-the-day pools, `pickLine`, number words, apostrophe form per surface |
| `problems.ts` | `Problem` type, `buildProblems` (moved from digest.ts), agent names |
| `causes.ts` | The §4.2 table, the §4.3 rules, `explainCause` (the seam for later) |
| `stories.ts` | `groupProblems`: chains, same cause, same kind, unrelated joining |
| `digest.ts` | `composeDigest` now returns `{ title, body, briefing }`. The budget machinery is kept and re-worded. |
| `briefingView.ts` | Greeting-line state (from `buildPushTileView`'s logic), and the Briefing view model, including the older-record fallback |
| `sinceThen.ts` | "Since then" sentences from read results, with a failure line per part |

**Tests to add:** every row in §4.2 (wording, next step, cause), every §4.3 rule including the order
and the whole-token number rule, every chain and every grouping rule in §4.4, the unrecognised path and
its count, the openers never repeating on consecutive days across 366 days, R23 (no all-clear wording
with any problem, including a partial calendar), the 320-character body budget with 1–20 problems and
long names, straight vs curly apostrophes per surface, an older record rendering, the retired-tile
layout resolve, the guarded `seenAt` update (a matching `sentAt` applies, a stale one doesn't), and
every "since then" part's failure line. `digest.test.ts` and `buildProblems.test.ts` are re-pinned
to the new wording.

**Done means:** `npm test`, `npx tsc --noEmit` and `npm run build` all green, and `npm run lint` at its
recorded baseline. Then one real morning observed: the push arrives in the new voice, the full-screen
greeting appears on first open, it shrinks into the line, a cause card opens, and a second device
doesn't greet again.

---

## 9. Proposed decision for ARCHITECTURE.md §7

> **S21 — The morning push speaks in an assistant's voice, and the Briefing replaces the push tile.**
> Riku's call, 2026-10-09, after P10's go-live checks. The push's title becomes a greeting plus a read
> on the day (problems always outrank the mood of the day, so R23 holds). Its body is plain sentences
> with problems first. Problems are structured, grouped into stories, and explained from a fixed cause
> catalogue. Unrecognised errors are reported as such and counted. No AI in the loop yet. On the site,
> the Briefing greets him full-screen once a day across devices, then lives in a greeting line at the
> top of every page. The Personal page's push tile is removed. **Supersedes:** the push title format
> `N problems · N to review` / `All clear · N to review` (P5a monitoring design, kept by P10's content
> spec §10); the raw problem-fragment wording in `digest.ts`, including the six P10b provisional
> strings; the Today sentence's `X wasn't read.` phrasing (R23's meaning is kept, its words replaced);
> the push tile, Tile 4 (P10 content spec §6, R14, R22); and TopBar's "exactly one element" rule (the
> greeting line is the second). **Unchanged:** P5a-4 (the push every day), D12's ordering (problems
> before Today, the freelance line never sliced), R42 (the app opens on /freelance), the approval rule
> for outward actions, and every non-push UI string.

---

## 10. Future work (not designed here)

- **Ask Claude about unrecognised errors.** Uses the `explainCause` seam once the stored
  `unrecognised` counts show it's worth it.
- **Smooth loading and instant-feeling saves**: the next spec. Pages show their structure at once, and
  writes look done immediately while the server works, while keeping L7's honesty (a definite failure
  rolls back and says so, an unknown result says so).
- **Voice commands and the Briefing read aloud**: after the Academic page.
- **Drag-and-drop tile arranging** on the Personal page: a later change to the layout editor.

---

## 11. Open questions for Riku

1. **Counting:** should the title count stories (one root cause = "One thing needs you") or every
   symptom? The spec uses stories.
2. **Personal default layout:** with the push tile gone, row 2 becomes Layers alone at full width. Fine,
   or do you want something else there?
3. **The greeting and reply lines:** the pools in §3.1 and every sentence in §4.2 are drafts. Reword
   any you like before building, or approve them as written.
4. **The P10 go-live checklist answers** you gave in the artifact (word choices, the four dates) aren't
   visible to Claude. Paste them so P10 can be closed. The six P10b push strings are superseded by
   this spec, but the nine P10c strings on the Personal page still need your call.
