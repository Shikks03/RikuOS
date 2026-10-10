# The Debrief — a briefing on demand, compared against 07:00

**Status:** design, awaiting Riku's review · **Date:** 2026-10-10 · **Proposed decision:** S22 (§9)
**Content discussed with Riku:** 2026-10-10, in the Plan B post-build review (ruling e). This spec's sibling is `docs/superpowers/specs/2026-10-09-briefing-assistant-voice-design.md` (S21) — same structure, same voice, same level of detail. Read that spec first; this one assumes it.

---

## In plain words

Sometimes 07:00 was hours ago and Riku wants to know what's changed. He presses **"Debrief now"**
at the foot of the Briefing panel. The app re-checks everything the morning push checks — the
sites, ShikksTracker's sender and attention feed, the watchdog's run history, today's calendar and
to-dos, the queue — and compares the result against this morning's Briefing: what's **sorted**, what
**still needs him**, and what's **new** since 07:00. It also freshly composes what he's done since
then and what's left of today. The result replaces the one saved Debrief, reachable from any device,
with this morning's own Briefing always one tap away inside it.

It is a second opinion, not a second push. **Site only, no push, ever.** It never auto-opens
full-screen — that greeting stays the 07:00 Briefing's alone. It never sends anything outward and
never touches the expiry sweep. Pressing it twice inside a minute returns the same answer rather than
re-checking.

---

## 1. Decisions taken (2026-10-10, brainstorm — settled, not relitigated here)

| # | Decision | Riku's choice |
|---|---|---|
| D1 | What it does | Re-check now (run history, site pings, ShikksTracker's outreach health, fresh to-dos/calendar/queue/attention), then compare against this morning's 07:00 Briefing. |
| D2 | Channel | Site only. No push, ever. |
| D3 | Storage | Keep the latest. One record, replaced by each new Debrief. The greeting line reflects it; any device can reopen it; this morning's briefing is one tap away inside it. |
| D4 | Where it lives | A "Debrief now" button at the foot of the Briefing panel. The panel opens whenever any briefing is stored, even an older one — only `never`/`fail` states can't reach it. The once-a-day full-screen greeting stays the 07:00 Briefing's alone; a Debrief never auto-opens full-screen. |
| D5 | Baseline | Always compares against today's 07:00 Briefing. No morning Briefing today → no comparison, a plain "what needs you now" list. |
| D6 | Monitoring switch | Works with monitoring off. The switch stops the automatic briefing; a press is a direct ask. |
| D7 | Shape of the request | Approach A: one request does everything, in parallel. The panel shows a wait message; closing the panel doesn't stop the server finishing and saving. |

---

## 2. The voice

Follows S21 §2 exactly — first person about what it checked, second person to Riku, fact before
feeling, never claims more than it knows, push-form apostrophes vs page-form curled, every sentence
written in advance so every one is tested.

### 2.1 The panel heading

Like the morning's opener + read-on-the-day, but keyed to the **time of day** as well as the day,
since a Debrief can land at any hour. Built from `voice.ts`'s existing deterministic `pickLine`
machinery — no new infrastructure, two new pools and a bucket function:

```ts
export const DEBRIEF_AFTERNOON_OPENERS = [
  "Afternoon, Riku.",
  "Good afternoon, Riku.",
  "Riku, afternoon check-in.",
] as const;

export const DEBRIEF_EVENING_OPENERS = [
  "Evening, Riku.",
  "Good evening, Riku.",
] as const;

/** 05:00–11:59 morning · 12:00–16:59 afternoon · 17:00–20:59 evening · 21:00–04:59 night. */
export function debriefTimeBucket(hour: number): "morning" | "afternoon" | "evening" | "night";

export function debriefOpener(day: DayKey, hour: number): string {
  switch (debriefTimeBucket(hour)) {
    case "morning": return pickLine(ANY_DAY_OPENERS, day, "debrief-morning"); // reuses the existing pool
    case "afternoon": return pickLine(DEBRIEF_AFTERNOON_OPENERS, day, "debrief-afternoon");
    case "evening": return pickLine(DEBRIEF_EVENING_OPENERS, day, "debrief-evening");
    case "night": return pickLine(DEBRIEF_NIGHT_OPENERS, day, "debrief-night"); // PROVISIONAL, see §10
  }
}
```

**Heading = `debriefOpener(day, hour) + " Here's where things stand."`** — the tail is the one phrase
Riku gave in the brainstorm and stays fixed; only the opener varies, by day (via `pickLine`'s existing
coprime-step rule — see S21 §3.3) and by which pool the hour selects. The heading does not itself
restate the problem count — the greeting line (§4.3) already does that, and the groups below it make
the count visible immediately underneath.

### 2.2 The greeting line's own text (topbar)

Given literally in the brainstorm and used verbatim as the title template:

- `Debrief at 13:04: one thing still needs you.`
- `Debrief at 13:04: all clear.`
- Two or more, by extension of the morning title's own counting pattern (§4.2's `readOnTheDay`):
  `Debrief at 13:04: two things still need you.` / `Debrief at 13:04: five things still need you.`
  (**PROVISIONAL** beyond the two literal examples — see §10.)

The count is `stillNeedsYou.length + new.length` — everything currently outstanding, carried-over or
fresh, by the same logic the morning title counts stories (problems always outrank "all clear").

---

## 3. Architecture

### 3.1 The door — `POST /api/briefing/debrief`

```ts
export const maxDuration = 60; // matches the morning route; see reasoning below
```

```ts
export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request); // Origin check included (POST is mutating)
  if (denied) return denied;
  await connectDB();

  const now = new Date();
  const existing = await getLastDebrief();
  if (existing !== null && now.getTime() - existing.at.getTime() < DEBRIEF_CACHE_MS) {
    // Double press inside a minute: the same answer, no re-check, no new AgentRun row —
    // nothing happened this time, so nothing is recorded as having happened.
    return NextResponse.json(toDebriefResponse(existing));
  }

  const result = await runJob("debrief", async () => {
    const outcomes = await readDebriefChecks(now);           // §3.3, all parallel, all self-caught
    const baseline = await readTodaysBaseline(now);           // today's StoredBriefing, or null (D5)
    const debrief = buildDebrief({ now, outcomes, baseline }); // pure, §3.4/§3.5
    let saved = true;
    try {
      await saveLastDebrief(debrief);
    } catch (err) {
      saved = false;
      console.error("[api/briefing/debrief] save failed:", err);
    }
    const failedSources = countCouldntCheck(debrief); // §3.4
    return {
      counts: { itemsProcessed: 1, itemsFailed: (saved ? 0 : 1) + failedSources },
      data: { debrief, saved },
    };
  });

  if (!result.ok || result.data === null) {
    return NextResponse.json({ error: "debrief-failed" }, { status: 500 }); // "The Debrief didn't finish. Try again."
  }
  return NextResponse.json(toDebriefResponse(result.data.debrief, result.data.saved));
}
```

- **requireSession first**, no body input beyond the press (a bare `POST`, no payload to validate).
- **Bounded response**: the returned shape is exactly `StoredDebrief` (§5), itself bounded field by
  field — no unbounded echo of any upstream error text beyond `BRIEFING_BOUNDS.raw` (already enforced
  by reusing `causes.ts`/`boundRaw`).
- **Never runs the expiry sweep.** It changes queue state (expires stale `ApprovalItem`s), and a
  press of a read-oriented button must not have that side effect. The 07:00 sweep remains the only
  place stale items expire.
- **Never sends a push.** `sendPushToAll` is not imported into this file. A failure here is visible
  immediately in the panel that is open in front of Riku; there is no device-reachability problem to
  alert about the way there is for an unattended cron.
- **Outward actions: none.** The door writes two singletons (`HealthSnapshot`, `LastDebrief`) and
  appends one `AgentRun` row. It calls no `POST /api/os/drafts`, approves nothing, sends nothing to a
  business. This is the only sense in which it is "a second write path" — a second place (besides the
  morning route) that writes `HealthSnapshot` and a briefing-shaped singleton, not a second place that
  acts on Riku's behalf.
- **`maxDuration: 60`, matching the morning route.** The slowest single read is `fetchSummary`/
  `fetchAttention` at `ST_TIMEOUT_MS` (15 s) each; `checkSites` is capped at `SITE_TIMEOUT_MS` (8 s)
  across all three sites (run in parallel, per `checkSites`'s own `Promise.all`); the watchdog's run-
  history read and the calendar/to-do/queue reads are Mongo/Google calls already bounded by
  `MONGO_READ_TIMEOUT_MS` (5 s) and the calendar layer's own per-layer timeout. `readDebriefChecks`
  runs all of these as one `Promise.allSettled`, so the wall-clock cost is the **slowest single leg**,
  not their sum — realistically ≤ 15–20 s. 60 s is the same ceiling the morning route already proves
  safe on Vercel Hobby, with generous headroom; there is no reason to invent a second number.

### 3.2 Double-press protection

`DEBRIEF_CACHE_MS = 60_000` — a new constant in `constants.ts`, the same value as
`healthSnapshot.ts`'s `CHECK_FLOOR_MS` but a **separate** floor serving a separate purpose: this one
gates the *whole Debrief document* (don't rebuild and re-save within a minute of the last one);
`CHECK_FLOOR_MS` gates *site pings specifically* (§3.3). They happen to share a value because both
answer "how fast could a human plausibly want this again"; they are not the same constant and must
not be unified into one, because a future change to one must not silently change the other's meaning.

### 3.3 The fresh checks — `src/lib/debriefRead.ts`

One function, `readDebriefChecks(now: Date): Promise<DebriefOutcomes>`, structured exactly like
`sinceThenRead.ts` and `digestToday.ts`: every read is independent, bounded, and caught into its own
outcome so one slow or failed read never costs the others.

| Read | Reused from | Judgment call |
|---|---|---|
| Watchdog's run history | `fetchLatestRuns` + `evaluateWatchdog` (`watchdog.ts`), unchanged | Pure Mongo read; no new bound needed |
| Site pings | `getHealthSnapshot` / `isWithinCheckFloor` / `checkSites` / `saveHealthSnapshot` (`healthSnapshot.ts`, `siteHealth.ts`) | **Reuses the existing 60-second floor**, exactly as `POST /api/health/sites` does: if the stored `HealthSnapshot` is inside `CHECK_FLOOR_MS`, the Debrief reuses that reading rather than hitting the three sites again. This means a Debrief pressed moments after "Check now" (or vice versa) never double-hits a client's site, and the two features share one floor instead of inventing a second. **Fresh results ARE saved to `HealthSnapshot`** when the floor doesn't apply — deliberate, so the Freelance page's health strip picks up the Debrief's own reading. |
| ShikksTracker outreach health | `fetchSummary` + `evaluateOutreach` (`outreachHealth.ts`), unchanged | A throw here becomes `job-failed{job:"outreach-health"}` in the fresh problem set, exactly as the morning route's own catch does — no new wording |
| ShikksTracker attention | `fetchAttention` (`stApi.ts`), unchanged | A throw becomes `pipeline-unavailable`, exactly as `digest.ts`'s `allProblems` already does |
| Today's calendar + to-dos | `readDigestToday` (`digestToday.ts`), unchanged | A failure is already self-describing (`calendar-unavailable` / `calendar-partial` / `todos-unavailable`) — see §3.5, no separate "couldn't check" flag needed for these two |
| Queue (pending `ApprovalItem` count) | `ApprovalItem.countDocuments({status:"pending"})`, same filter `digest.ts`'s `pending` uses | Feeds the Rest-of-today freelance line; also the "new drafts since 07:00" figure, by comparing against the baseline's own stored pending count carried forward — **judgment call:** rather than add a second query, the "new drafts" figure reuses the same mechanism `sinceThenRead.ts` already has (`ApprovalItem.countDocuments({status:"pending", createdAt:{$gt: baseline.sentAt}})`), run only when a baseline exists |

### 3.4 Building the fresh problem list — reuse, not a new catalogue

`buildProblems` (`problems.ts`) already turns a set of outcomes into `Problem[]`. The Debrief reuses
it unchanged, fed from `readDebriefChecks`'s outcomes, **except** `buildProblems`'s input type
`MorningOutcomes` requires an `expiry` outcome, which a Debrief never has (it never runs the sweep).
**Implementation note for the plan (not resolved by this spec, since it touches code):** either widen
`MorningOutcomes.expiry` to optional (treated as "no problem" when absent — preferred, one function,
no drift risk) or add a sibling `DebriefOutcomes` type and a thin wrapper. Either way, `causes.ts`'s
`explain()` and `stories.ts`'s `groupProblems()` are reused completely unchanged for the fresh side —
**no new sentence catalogue for "what needs you now."** The catalogue that exists is the catalogue.

`countCouldntCheck(debrief)` (§5) sums the `couldntCheck` flags into the run's `itemsFailed`, so a
morning where ShikksTracker couldn't be reached shows up in `AgentRun` the same honest way a cron
job's partial failure does.

### 3.5 The comparison — `src/lib/debriefCompare.ts` (pure, no DB, no network)

Matches this morning's stored symptoms against the fresh `Problem[]` **by what each is about**, using
a new bounded `subject: string | null` field added to `StoredSymptom` (`briefingTypes.ts`) and
produced by a new `subjectOf(problem): string | null` function beside `AGENT_NAMES` in `problems.ts`.

**Not every `ProblemKey` can be re-checked by a Debrief.** Two keys describe a one-off fact about
*this morning's own run* that the Debrief has no way to re-verify, because it never re-runs the
expiry sweep or the dispatcher's own save step:

| ProblemKey | Re-checkable? | Source | Subject |
|---|---|---|---|
| `site-status` / `site-timeout` / `site-unreachable` | yes | sites | the site name (`p.site`) |
| `agent-never-ran` / `agent-stale` / `agent-failed` / `agent-degraded` | yes | watchdog | the agent id (`p.agent`) |
| `job-failed` where `job` ∈ {`watchdog`, `site-health`, `outreach-health`} | yes | that job's own source | the job id (`p.job`) |
| `job-failed` where `job` = `expiry-sweep` | **no** — the sweep never runs here | — | `p.job` (`"expiry-sweep"`) — kept for display, never compared against a fresh value |
| `snapshot-unsaved` | **no** — a fact about this morning's own save attempt | — | `null` |
| `unstuck-items` | **no** — a fact about this morning's own sweep | — | `null` |
| `engine-never-ran` / `engine-unreadable` / `engine-stale` / `engine-errors` / `stranded-approved` | yes | ShikksTracker (outreach) | `null` (each is a singleton condition — at most one of each per morning) |
| `pipeline-unavailable` | yes | ShikksTracker (attention) | `null` |
| `calendar-unavailable` | yes | calendar | `null` |
| `calendar-partial` | yes | calendar | the failing calendar names, sorted and comma-joined (deterministic; a different failing *set* next time reads as a different subject — see the judgment call below) |
| `todos-unavailable` | yes | to-dos | `null` |

**A not-re-checkable symptom is never claimed sorted and never re-explained with fresh facts.** It is
carried into **Still needs you**, verbatim, tappable to its original 07:00 cause card, exactly as
stored this morning. This is the honest reading of "never claim sorted for anything not re-checked":
there is no live source to re-check in the first place for these two keys.

**Three sources can fail wholesale on this press** — `sites` (only if `checkSites` itself throws,
which `siteHealth.ts`'s own per-site catch makes rare), `watchdog` (if `fetchLatestRuns` throws), and
`shikkstracker` (if **either** `fetchSummary` or `fetchAttention` throws — treated as one source for
this purpose, since both live behind the same `ST_API_SECRET` and a ShikksTracker outage takes both
down together in practice). When a source fails wholesale, **every stored symptom whose source is that
one** moves to Still needs you unchanged, with a fixed per-source sentence instead of a fresh
re-explanation (one row per original symptom — see §10 for the exact wording, which is PROVISIONAL
beyond the one ShikksTracker example Riku gave). `calendar` and `todos` need no such flag: a failed
re-check of either is already self-describing as a fresh `calendar-unavailable` / `todos-unavailable`
problem (§3.4), which matches the stored symptom of the same key the ordinary way.

```ts
export interface DebriefComparison {
  sorted: Array<{ key: ProblemKey; subject: string | null; sentence: string }>; // §4.2's SORTED_SENTENCES
  stillNeedsYou: Array<{
    key: ProblemKey;
    subject: string | null;
    explained: Explained;           // causes.ts's explain(freshProblem) when re-checked and still present
    couldntCheck: boolean;          // true when this row is the honest "can't say" substitute
  }>;
  new: Array<{ key: ProblemKey; subject: string | null; explained: Explained; firstSeenAt: Date | null }>;
  couldntCheck: { sites: boolean; watchdog: boolean; shikkstracker: boolean };
}

export function compareToBaseline(
  baseline: StoredBriefing | null,
  fresh: Problem[],
  checkFailed: { sites: boolean; watchdog: boolean; shikkstracker: boolean }
): DebriefComparison;
```

**Matching rule, per stored symptom:** if its key is not-re-checkable → Still needs you, unchanged.
Else if its source failed wholesale this press → Still needs you, the per-source "can't say" line. Else
look for a fresh problem with the same `(key, subject)`: found → Still needs you, re-explained from the
fresh problem (new facts — `ageHours`, counts — flow through naturally because `explain()` is being
called on the *fresh* `Problem`, not the stored one); not found → **Sorted**, using a new fixed
sentence per key (§4.2), never the "still needs you" sentence with "fixed" silently swapped in for
"broken". **Every fresh problem with no matching stored symptom** → **New**.

**Judgment call — `calendar-partial`'s subject.** Because its subject is the *exact* sorted set of
failing calendar names, a partial outage that drops from two calendars to one between 07:00 and now
produces one Sorted line (the two-name subject is gone) and one New line (the one-name subject never
existed this morning) rather than a single "partially sorted" line. This is more literal than
graceful, but it is honest under the "match by what it's about" rule as given, and inventing a
finer-grained per-calendar match would be a second comparison dimension this spec was not asked to
design. Flagged for Riku; not blocking.

**Judgment call — ordering.** Within each group, rows keep the order their underlying `Problem`/
`StoredSymptom` already had (report order), matching the convention `buildProblems` and `groupProblems`
already use elsewhere in this codebase.

### 3.6 The greeting line — recency rule

`buildGreetingLine` (`briefingView.ts`) gains one new branch, checked **before** every existing branch
(including the `digest === "unavailable"` fail case — a broken morning-digest read must not hide a
good, newer Debrief):

```
debriefToday = debrief exists, read succeeded, and dayKey(debrief.at, APP_TZ) === today
digestToday  = digest exists, read succeeded, and dayKey(digest.sentAt, APP_TZ) === today

if debriefToday AND (!digestToday OR debrief.at > digest.sentAt):
  → kind "debrief", text = debrief.title (the stored "Debrief at HH:MM: …" line),
    tone = (stillNeedsYou.length + new.length > 0) ? "warning" : "normal",
    opens = "debrief"
```

Everything below this is **unchanged from S21** — the existing eight branches run exactly as they do
today when this new condition is false (no Debrief today, or an older digest-day Debrief, or a failed
Debrief *read* — a failed read of the Debrief singleton is treated as "no Debrief", falling through to
the ordinary digest-only precedence, never surfacing its own "couldn't load" state, since the morning
digest's own line is still a true and useful answer).

**`GreetingLine.opens` gains a third value: `"debrief"`** (alongside the existing `"digest" | null`).
Tapping the line when `opens === "debrief"` opens the **same panel component**, showing the Debrief's
content (§4) as the panel's primary view, with a row inside it — literally labelled **"This morning's
briefing →"** (D3, Riku's exact words) — that swaps the panel's content to the ordinary morning
`BriefingView` (reusing `buildBriefingView` unchanged) without closing and reopening the dialog. A
small "← Debrief" affordance returns to the Debrief view (**PROVISIONAL** exact label — see §10; the
forward label is settled, the way back is not).

**Next day's 07:00 takes over again by recency**, with no special-casing needed: a Debrief from
yesterday has `dayKey(debrief.at) !== today`, so `debriefToday` is false and the branch above never
fires — the new morning's digest (or its own absence) drives the line exactly as S21 already specifies.

### 3.7 Run history — the `debrief` agent

`AGENTS` (`src/models/AgentRun.ts`) gains `"debrief"`. Consequences, all to be carried out in the same
commit as the enum change:

- **`AGENT_NAMES`** (`problems.ts`) is a `Record<Agent, string>` — exhaustive by construction (the
  file's whole point, per its own docblock: "a new agent with no name fails to compile"). Adding
  `"debrief"` to `Agent` therefore **forces** an entry here, e.g. `debrief: "the debrief"`, even though
  no `Problem` ever names `agent: "debrief"` today. This is a real, non-obvious compile-time
  consequence of the enum change and the plan must not be surprised by it.
- **`watchdog.ts`'s `EXPECTATIONS`** does **not** gain a `debrief` row. The watchdog must never expect
  a Debrief — it is user-triggered, with no schedule, so "never ran since yesterday" would be a
  permanent, meaningless alarm. (Mirrors the existing rule that `EXPECTATIONS` omits `watchdog` itself
  and `RAIL_AGENTS` omits the three never-shipped enum members.)
- **`watchdog.ts`'s `RAIL_AGENTS`** does **not** gain a `debrief` row — it is a hand-written list for
  the rail's badge strip, and a Debrief has no "last ran Nh ago" story worth a permanent badge.
- **The morning route's monitoring-off skip loop** (`for (const agent of ["watchdog", "site-health",
  "outreach-health", "dispatcher"] as const)`) is **unaffected** — it is not touched, and must not be,
  since a Debrief is orthogonal to the monitoring switch (D6: it works with monitoring off) and is
  never written by the morning route at all.
- **No index change.** `AgentRunSchema`'s `enum: AGENTS` validator picks up the new value automatically;
  the TTL index and the `{agent, startedAt}` index are structurally unchanged — only the enum's *value
  list* grows, which Mongoose does not treat as an index alteration. No `migrate:indexes` run is needed.
- **The 07:00 agents' rows are never written by a Debrief** (the door calls `runJob("debrief", …)`
  exactly once, nothing else) — so the watchdog still catches a genuinely dead cron; a flurry of manual
  Debriefs on a day the cron died does not mask that.
- **The cached double-press response (§3.2) writes no `AgentRun` row at all** — a judgment call: no
  work happened, so nothing is recorded as having run. The row's `counts.itemsProcessed` is always `1`
  for a real press (one Debrief built), never a count of sub-checks, consistent with how `dispatcher`'s
  own row counts "1 push", not "4 jobs".

---

## 4. Content, in order

### 4.1 Heading
`debriefOpener(day, hour) + " Here's where things stand."` (§2.1).

### 4.2 Since 07:00 (only when a baseline exists — D5)

Three groups, in this order, each only rendered if non-empty:

- **Sorted.** One line per sorted entry, using a **new fixed sentence per `ProblemKey`**, mirroring
  `causes.ts`'s table but written for the past tense of relief rather than the present tense of a
  problem. Given literally: `site-status`/`site-timeout`/`site-unreachable` → `"${subject}'s site is
  back up."` The remaining keys' sorted sentences are this spec's own extrapolation and are
  **PROVISIONAL** (§10) — e.g. `agent-stale`/`agent-failed`/`agent-degraded`/`agent-never-ran` →
  `"${AGENT_NAMES[subject]} is running again."`; `engine-*`/`stranded-approved` →
  `"ShikksTracker's sender is moving again."`; `pipeline-unavailable` → `"I can reach ShikksTracker
  again."`; `calendar-unavailable`/`calendar-partial` → `"Your calendar's answering again."`;
  `todos-unavailable` → `"I can read your to-dos again."`; `job-failed` (watchdog/site-health/
  outreach-health) → `"${AGENT_NAMES[job]} ran clean just now."`
- **Still needs you.** One row per still-outstanding or not-re-checkable symptom. **Judgment call:**
  the fresh detail reuses `causes.ts`'s existing `explain(freshProblem).sentence` verbatim (it is
  already fresh — built from the *new* `Problem`'s own facts, e.g. a recomputed `ageHours`) rather than
  inventing a second, parallel "still hasn't run (now 9 hours)" phrasing. The brainstorm's literal
  example (`"ShikksTracker's sender still hasn't run (now 9 hours)."`) adds a continuity frame
  ("still…now…") that the existing catalogue sentence (`"ShikksTracker's sender hasn't run in 9
  hours."`) does not carry. Reproducing that frame for every key would mean a second sentence
  catalogue the size of `causes.ts` itself — out of this one plan's scope. **Flagged PROVISIONAL**;
  Riku can ask for the "still/now" framing as a small follow-up to `causes.ts` later. Each row is
  tappable → the same cause card `Briefing.tsx` already renders for a symptom (`SymptomView`), built
  from `explain()`'s `nextStep`/`cause`/`raw` exactly as today. A not-re-checkable or couldn't-check row
  opens the **original 07:00** cause card (there is no fresh one to show).
- **New.** One row per new problem, using `explain(freshProblem)`'s ordinary sentence. **Judgment
  call:** only `agent-*`/`job-failed` rows (which have a real `AgentRun.startedAt` behind them) get a
  time stamp appended, matching the brainstorm's one example (`"The chaser failed at 11:00."`) — site
  and ShikksTracker-sourced rows have no comparably meaningful "when" (a site ping only knows "down
  right now", not when it went down) and render with the plain `explain()` sentence, no time. The exact
  mechanism and phrasing (`"${sentence.slice(0,-1)} at ${HH:MM}."`) is **PROVISIONAL** (§10).
- **Nothing then and nothing now:** `"All clear, same as this morning."` (D's literal wording).

### 4.3 Right now (only when there is no baseline — D5)

A flat list, each row `explain(freshProblem)`'s ordinary sentence + next step + tappable cause card —
no sorted/still/new split, because there is nothing to compare against. Section heading
**PROVISIONAL**: `"Right now"` (§10).

### 4.4 What you've done (only when a baseline exists)

The existing `sinceThenLines` (`sinceThen.ts`), unchanged, computed **once at press time** against
`(baseline.sentAt, pressTime)` and stored as plain strings — not recomputed on a later reopen, because
the Debrief is a snapshot (D3: "keep the latest", not "keep it live"). When there is no baseline, this
section is omitted entirely: there is no 07:00 instant to measure "since" from.

### 4.5 Rest of today (always)

`composeTodayLine` (fresh calendar/to-do read) + `freelanceLine` (fresh attention/queue read) +
`offLine` (current `chaserEnabled`) — freshly composed from this press's own reads, never from the
baseline. Always present regardless of whether a baseline exists.

---

## 5. Data

### 5.1 `briefingTypes.ts` grows

```ts
export interface StoredSymptom {
  key: ProblemKey;
  subject: string | null;        // NEW — site name / agent id / job id / sorted calendar-name list / null
  sentence: string;
  bold: StoredBold[];
  nextStep: string;
  causeKey: CauseKey;
  cause: string;
  causeBold: StoredBold[];
  raw: string | null;
}
```

`subject` is optional on read (older records, including every 07:00 Briefing saved before this ships,
have none and default to `null` — the same `.lean()`-doesn't-apply-defaults pattern `lastDigest.ts`
already handles for `omitted`). **Fallback matching for a baseline with no `subject` field at all:**
`compareToBaseline` falls back to `(key, sentence)` equality for any stored symptom whose `subject` is
`null` on a key that is normally subject-bearing (`site-*`, `agent-*`, `job-failed`,
`calendar-partial`) — distinguishing e.g. two different stale sites by their sentence text, which
already names the site. For the genuinely-singleton keys, `subject` was always going to be `null`
anyway, so there is nothing to fall back from.

New bounds, added beside `BRIEFING_BOUNDS`:

```ts
export const DEBRIEF_BOUNDS = {
  subject: 120,       // a site/agent/job name, or several calendar names joined — generous, bounded
  title: 80,           // matches PUSH_TITLE_MAX; "Debrief at HH:MM: …"
  sorted: 12,
  stillNeedsYou: 12,
  newProblems: 12,
  now: 12,             // the no-baseline flat list
  today: 600,
  freelance: 240,
  off: 120,
  since: 6,            // matches SINCE_THEN_MAX_LINES
} as const;
```

New stored shapes (`briefingTypes.ts`), reusing `StoredSymptom`'s bounded sub-fields:

```ts
export interface StoredSortedItem {
  key: ProblemKey;
  subject: string | null;
  sentence: string; // ≤ DEBRIEF_BOUNDS.subject + a fixed template; bounded same as a symptom sentence
}

export interface StoredDebrief {
  at: Date;                                  // when this Debrief was built
  baselineSentAt: Date | null;               // the 07:00 Briefing compared against, or null (D5)
  title: string;                             // the greeting-line text, "Debrief at HH:MM: …"
  sorted: StoredSortedItem[];                // populated only when baselineSentAt !== null
  stillNeedsYou: StoredSymptom[];            // "
  new: StoredSymptom[];                      // "
  now: StoredSymptom[];                      // populated only when baselineSentAt === null
  since: string[];                           // "What you've done" lines; empty when baselineSentAt is null
  today: string;
  freelance: string | null;
  off: string | null;
  unrecognised: number;
  couldntCheck: { sites: boolean; watchdog: boolean; shikkstracker: boolean };
  saved: boolean;                            // NOT persisted — set by the door on the response only (§3.1)
}
```

**Invariant, enforced by `buildDebrief` and pinned by a test:** exactly one of `{sorted ∪
stillNeedsYou ∪ new}` or `{now}` is non-empty-capable at a time — `baselineSentAt === null` implies
`sorted`, `stillNeedsYou`, `new` and `since` are all `[]`, and vice versa for `now`.

### 5.2 `LastDebrief` — the singleton

Follows CLAUDE.md's `HealthSnapshot` rule (R55), the same pattern `LastDigest` already uses: fixed
`_id`, overwritten whole, `findOneAndUpdate` upsert with one retry on E11000, a read-only accessor that
returns `null` when the document is absent (a Debrief never taken is a fact — "no Debrief yet" — not a
gap to paper over), no index beyond `_id`.

```ts
// src/models/LastDebrief.ts
export const DEBRIEF_ID = "latest";
// Schema mirrors LastDigestSchema's shape for StoredDebrief, with the same
// typed sub-schemas (SortedItemSchema, SymptomSchema reused from LastDigest's
// own, since StoredSymptom is unchanged in shape — just carries `subject`
// now), every string bounded by DEBRIEF_BOUNDS, every array capped with the
// same maxItems validator helper LastDigest.ts already defines. `saved` is
// NOT a schema field — it is a response-only flag the door attaches (§3.1),
// since the document obviously exists if you can read it back.
```

```ts
// src/lib/lastDebrief.ts — mirrors lastDigest.ts exactly
export async function getLastDebrief(): Promise<StoredDebrief | null>; // findOne, never upsert
export async function saveLastDebrief(debrief: Omit<StoredDebrief, "saved">): Promise<void>; // upsert + 1 retry
```

**TTL: none — decided and justified.** The decision brief already guesses this ("it's overwritten, so
probably not") and the reasoning matches `LastDigest`'s and `HealthSnapshot`'s own, word for word:
the newest Debrief has to be present whenever **any device** reopens the panel (D3), and expiring it
would manufacture a false "no Debrief yet" out of the app's own cleanup rather than a fact about
whether Riku has ever pressed the button. `AgentRun`'s 90-day TTL is the right place for *run history*
to expire; the Debrief's own content is not run history, it is the thing the run produced, exactly the
distinction `LastDigest` already draws against its own `AgentRun` rows.

### 5.3 Model file, not collection, note

`LastDebrief` is its own Mongo collection (`lastdebriefs`), not a field bolted onto `LastDigest` — a
Debrief and a 07:00 Briefing have different lifecycles (one per press vs. one per day) and different
shapes (`now` vs. the three-group split), and bolting one onto the other would mean the 07:00 write
(`saveLastDigest`, unconditional whole-document overwrite) silently clobbers an unrelated Debrief, or
vice versa. Two singletons, two collections, no shared `_id` string collision risk since they are
different collections entirely.

---

## 6. Failure behaviour

- **One source fails → the Debrief still completes.** `readDebriefChecks` never throws; every read is
  individually caught (`Promise.allSettled`, same discipline as `sinceThenRead.ts`). That source's
  stored symptoms land in Still needs you with the honest "can't say" line (§3.5); no false "sorted".
- **Save fails → he still sees the Debrief, plus "I couldn't save this one, so other devices won't see
  it."; the run row records the failure.** The door's `runJob` body catches the `saveLastDebrief` throw
  itself (§3.1), sets `saved: false` on the **response only** (never persisted — there is nothing to
  persist, the save is what failed), and folds it into `counts.itemsFailed`. `result.ok` stays `true`
  — the Debrief was successfully *built*, only its *save* failed, the same ok/itemsFailed distinction
  the morning route already draws between a sent push and a failed `saveLastDigest`.
- **Whole request fails / times out → panel: "The Debrief didn't finish. Try again." Nothing
  half-saved (save happens last); no in-flight state left behind.** `runJob` never throws, so a true
  bug inside `buildDebrief` or the reads becomes `result.ok === false`, and the door returns a plain
  500 before any write happens — `saveLastDebrief` is the literal last line inside the job body, after
  every read and every pure composition step. A client-side timeout (the fetch aborts) leaves the
  server-side job running to completion regardless (D7: closing the panel doesn't stop it) — the next
  open of the panel, or the next press, picks up whatever got saved, or the double-press cache if it
  finished inside the minute.

---

## 7. Testing

### 7.1 Pure modules

- **`debriefCompare.ts`**: the full matching table (§3.5) — one case per `ProblemKey` showing sorted /
  still-needs-you / new correctly, for both a `subject`-bearing baseline and a `subject`-less
  (fallback) baseline. Every "source failed wholesale" combination (`sites`, `watchdog`,
  `shikkstracker`, and more than one at once) proves every affected stored symptom lands in Still
  needs you with `couldntCheck: true` and **never** in Sorted. The two not-re-checkable keys
  (`snapshot-unsaved`, `unstuck-items`, and `job-failed{job:"expiry-sweep"}`) proven to **always** land
  in Still needs you, unchanged, regardless of what the fresh problem list contains. The no-baseline
  case (`baseline === null`) proven to populate only `now`, nothing else. `calendar-partial`'s
  subject-set-changed case (§3.5's judgment call) proven to produce exactly one Sorted and one New row,
  not a merged "partially sorted" row.
- **`debrief.ts`** (`buildDebrief`): the invariant from §5.1 (exactly one of the comparison groups or
  `now` is ever populated); the Sorted-sentence table, one case per re-checkable key; the New-row time
  stamp appearing only for `agent-*`/`job-failed` rows; "Nothing then and nothing now" producing the
  literal `"All clear, same as this morning."`; the Rest-of-today section present in both the baseline
  and no-baseline cases; `unrecognised` counted the same way `buildBriefing`'s does (A-II's rule:
  counted over every row before any bound slices it).
- **`voice.ts`**: `debriefTimeBucket`'s four boundaries; `debriefOpener` never repeating on consecutive
  days within a bucket, mirroring S21's existing 366-day opener test; the fixed tail never varying.
- **`briefingView.ts`**: the recency rule — digest-only (unchanged from S21), Debrief-only (monitoring
  off, no digest today), both with the Debrief newer, both with the digest newer (should not happen in
  practice within one day, but the rule must still resolve it deterministically), a Debrief from
  yesterday (must **not** win today's line), a Debrief whose *read* fails (must fall through silently
  to the ordinary digest precedence, never its own "couldn't load" state).
- **`problems.ts`**: `subjectOf` — one case per `ProblemKey`, including the two keys that always
  return `null` and `calendar-partial`'s sorted-join.

### 7.2 The Verification Lead, in a browser, every write intercepted, never Riku's Atlas

Following the same discipline Plan B's post-build record used (seeded/mock Mongo, every mutating door
intercepted, `next dev`/`next start` substitution as needed, documented if substituted):

1. The button disables on press and re-enables once the response lands (success or the failure
   sentence); a second click while disabled sends no second request.
2. The panel shows the wait text during the request; closing the panel and reopening it later (route-
   intercepted `GET` for the digest/debrief reads returning the now-saved record) shows the completed
   Debrief without the request having been re-sent.
3. A press with a baseline present renders all three groups in order, each tappable row opening the
   right cause card (fresh for Still-needs-you/New, the original 07:00 card for a not-re-checkable or
   couldn't-check row).
4. A press with no baseline (fixture: no digest stored today) renders the flat "Right now" list, no
   groups.
5. The greeting line updates to the `"Debrief at HH:MM: …"` text immediately after a successful press,
   without a full page reload (a client-side refresh of the shell's greeting-line data, same mechanism
   `router.refresh()` already uses elsewhere in this shell).
6. Tapping "This morning's briefing →" inside the Debrief panel swaps to the ordinary morning view
   without closing the dialog; the way back reaches the Debrief view again.
7. A double press inside a minute (two clicks separated by a fast `setTimeout`, or the button's own
   disabled-state defeated via the test harness) returns the identical document both times and writes
   exactly one `AgentRun` row for the test's duration.
8. A route-intercepted 500 (simulating `result.ok === false`) shows "The Debrief didn't finish. Try
   again." and leaves the previously-saved Debrief, if any, untouched.
9. A route-intercepted save failure (200 with `saved: false`) shows the Debrief content **plus** "I
   couldn't save this one, so other devices won't see it."
10. At 390px and 320px wide: the panel's new button and the nested "this morning" toggle both meet the
    44px tap-target minimum and introduce no horizontal scroll.

---

## 8. Out of scope

- A push notification for the Debrief, ever (D2).
- Progress polling while the Debrief builds (D7 — one request, no streaming, no partial results).
- Comparing against the previous Debrief. Always and only against today's 07:00 Briefing (D5); a
  second Debrief pressed the same afternoon compares against the same 07:00 baseline again, not
  against the first Debrief.
- A "Debrief now" button anywhere outside the Briefing panel (D4) — not the rail, not a page header,
  not the full-screen greeting.
- The "still/now" continuity phrasing for Still-needs-you rows beyond the one given ShikksTracker
  example (§4.2's judgment call) — a follow-up to `causes.ts`, not this plan.
- Per-calendar (rather than per-set) matching for `calendar-partial` (§3.5's judgment call).

---

## 9. Proposed decision for ARCHITECTURE.md §7

> **S22 — A manual "Debrief now" button re-checks and compares against 07:00, shown only in the
> Briefing panel, saved as the latest and never pushed.** Riku's call, 2026-10-10, during Plan B's
> post-build review (ruling e). `POST /api/briefing/debrief` re-runs the watchdog's read of run
> history, the site pings, ShikksTracker's outreach-health and attention reads, and today's
> calendar/to-do/queue reads — never the expiry sweep, never a push — and compares the result against
> today's 07:00 Briefing by what each problem is about (a new bounded `subject` field on the stored
> symptom). The result overwrites a new singleton, `LastDebrief` (R55's pattern: fixed `_id`,
> upsert-with-retry, read-only accessor returns null when absent, no TTL because it is always
> overwritten whole, same reasoning as `LastDigest` and `HealthSnapshot`). The greeting line shows
> whichever of the two records — the morning digest or the latest Debrief — is newer today; next
> day's 07:00 takes over again by recency with no special case. A new `AgentRun` agent, `debrief`, is
> appended per real press (never for a cached double-press response); the watchdog does not expect it
> and it does not join `RAIL_AGENTS`. **Supersedes:** nothing — purely additive to S21. **Unchanged:**
> S21's once-a-day full-screen greeting (a Debrief never auto-opens full-screen — that stays the 07:00
> Briefing's alone); S10 (no outward action — a Debrief performs none, drafts nothing, sends nothing);
> D11 (the Debrief reads the same live feeds the morning push already reads, nothing new is stored as
> a manual supplement); CLAUDE.md's approval-queue rule (unaffected — there is no action here for an
> `ApprovalItem` to gate).

---

## 10. Open wording points for Riku — PROVISIONAL

Everything below is this spec's own extrapolation from the literal examples Riku gave in the
brainstorm, not something he has approved word for word. All follow the voice rules in §2 and S21 §2;
none hardcode "RikuOS" (`APP_NAME` is not implicated — "Debrief" and "ShikksTracker" are feature/
product labels, not this app's own name).

1. **The plural greeting-line template** beyond the two literal examples — `"Debrief at HH:MM: ${n}
   things still need you."` for n ≥ 2 (§2.2).
2. **Night-bucket openers** (§2.1) — `"Still up, Riku?"` / `"Late one, Riku."` or similar; no example
   was given for this bucket at all.
3. **The Sorted-sentence table** beyond the one literal example (`"${subject}'s site is back up."`) —
   every other key's sorted wording (§4.2).
4. **The per-source "can't say" sentences for `sites` and `watchdog`**, beyond the one literal
   ShikksTracker example — proposed: `"I couldn't check your sites just now, so I can't say whether
   that's sorted."` and `"I couldn't check the run history just now, so I can't say whether that's
   sorted."` (§3.5).
5. **The New-row time-stamp mechanism and phrasing** (`"${sentence without its final stop} at
   HH:MM."`) and which keys get it (§4.2).
6. **The no-baseline section heading**, `"Right now"` (§4.3).
7. **The "way back" label** from the nested morning-briefing view to the Debrief view inside the panel
   (§3.6) — the forward label, "This morning's briefing →", is Riku's own words and is settled.
8. **Whether the Still-needs-you continuity framing ("still… now…")** should be built after all, as a
   follow-up to `causes.ts` (§4.2, §8) — this spec recommends not, for scope, but the call is Riku's.

---

## 11. Self-review

- No TBDs: every section above resolves to a concrete design, with any genuinely open string marked
  PROVISIONAL in §10 rather than left blank.
- No contradictions: the baseline/no-baseline split (§5.1's invariant) is stated once and referenced
  consistently in §4.2–§4.4 and §7.1; the greeting-line recency rule (§3.6) is stated once and is the
  only place `opens: "debrief"` is introduced; the two "60 seconds" floors (§3.2, §3.3) are named
  separately and neither is reused for the other's purpose.
- Every brainstorm decision (D1–D7) and every content/architecture/failure bullet in the brief is
  reflected: re-check-then-compare (§3.3–§3.5), site-only/no push (§3.1), keep-the-latest/greeting
  line/any-device (§3.6, §5.2), panel-only button reachable on skipped/failed mornings (§3.6, §4),
  always-compare-against-07:00/no-comparison-without-one (§4.2–§4.3), works-with-monitoring-off
  (§3.1's door takes no dependency on the switch), one-request/parallel/wait-text/survives-a-close
  (§3.1, §7.2), the three Since-07:00 groups and the never-claim-sorted rule (§3.5, §4.2), What-you've-
  done reuse (§4.4), Rest-of-today freshness (§4.5), the new door's shape and bounds (§3.1, §5.1–§5.2),
  the pure comparison module and the subject field (§3.5, §5.1), the storage singleton and its TTL
  justification (§5.2), the greeting-line recency rule (§3.6), run history and its enum/rail/watchdog
  consequences (§3.7), fresh site results saved to `HealthSnapshot` (§3.3), double-press behaviour
  (§3.1–§3.2), S22's text (§9), all three failure-behaviour bullets (§6), the testing asks (§7), out of
  scope (§8), and PROVISIONAL markers for every string not literally given (§10).
- One plan's worth of scope: this spec deliberately defers the "still/now" continuity phrasing and
  per-calendar matching refinement (§8) rather than folding them in, and does not touch
  `causes.ts`/`stories.ts`'s existing wording for the morning push at all.
