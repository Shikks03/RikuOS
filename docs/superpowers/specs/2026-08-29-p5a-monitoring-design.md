# P5a — Watchdog, site health, morning digest (design)

**Date:** 2026-08-29 · **Status:** ratified design, awaiting implementation planning
**Scope:** `ROADMAP.md` P5 tasks 5.1, 5.2, 5.4 — repo: RikuOS (this one)
**Not in scope:** task 5.3 (lead sweep) = **P5b**, parked until a prospecting skill exists and one manual run has been measured.

**Goal in one line:** RikuOS currently has an unattended agent in production and nothing watching it. P5a makes the system notice its own failures and tell Riku once a morning.

---

## Why P5 is split

P5's cheap protective work should not sit behind its expensive undefined work. The watchdog, site health and dispatcher are near-zero token cost and can ship today. The lead sweep needs a skill that has not been written, runs on the subscription rather than the API, and its cost is unknown until measured. Splitting them lets the protective half land first.

---

## State that is not derivable from this repo

Established 2026-08-29. Do not re-derive; do not assume the opposite.

1. **P3 and P4 are DONE and live** at `https://riku-os.vercel.app`, region `sin1`. The chaser runs daily and is switched **on**.
2. **P2 (Messenger webhook, ShikksTracker) is NOT built.** Therefore the watchdog's webhook-freshness check and the Meta Graph API ping — both named in `ARCHITECTURE.md` §5 — are **out of scope for P5a**. `GET /api/os/summary` returns a `messenger` block hardcoded to zeros in P1; `docs/os-api.md` in that repo states that until P2 ships, `lastEventAt: null` means "no webhook yet", **not** "the webhook is dead". Reading it as an anomaly now would produce a permanent false alarm.
3. **Vercel Hobby allows 2 cron jobs per project, each at most once per day.** Both slots are already used (`expire`, `chaser`). P5a therefore cannot add a third cron; it must multiplex inside an existing slot. Upgrading to Pro was considered and declined.
4. **Hobby cron firing time may drift within its hour.** Nothing in this design may depend on one cron finishing before another starts.
5. **`AgentRun` already carries the enum slots** `watchdog`, `site-health`, `dispatcher`, and the index `{agent: 1, startedAt: -1}` for "latest run per agent". P3 built these for exactly this phase.
6. **The chaser writes an `AgentRun` even when switched off** (`src/app/api/cron/chaser/route.ts`), specifically so the watchdog can tell "disabled" apart from "cron never fired". That hook exists and is currently unused.

---

## Decisions settled in this session

Ratified with Riku 2026-08-29. These are closed; an executing session implements them rather than reopening them.

| # | Decision | Rationale |
|---|---|---|
| P5a-1 | Watchdog covers **agent-run freshness only**. No webhook check, no Graph ping. | P2 is not built (state §2). Both are added when P2 deploys. |
| P5a-2 | Expected schedules live in a **fixed table in code**, not in `OsSettings` and not learned from history. | It changes with a commit, next to the `vercel.json` it mirrors. Learned baselines need history before they work, and a broken agent teaches them the wrong normal. |
| P5a-3 | **One multiplexed daily route**, not an external pinger. | Staying inside Vercel avoids a second control plane and a deviation from the `CLAUDE.md` rule that cron agents are Vercel crons. cron-job.org was considered — Riku already runs it for ShikksTracker — and declined. |
| P5a-4 | The **digest fires every day**, including when nothing is wrong. | Riku chose "the missing push is enough" as the outer safety net. That only works if the push is unconditional; a digest that fires only on problems has an absence that means nothing. |
| P5a-5 | Site health **notifies only**. It does not draft client emails. | Roadmap 5.2 originally drafted a client email into the queue. A flaky check would then produce an embarrassing draft. Revisit once the false-alarm rate is known. |
| P5a-6 | Sites watched: `azerotech.vercel.app`, `meowchi.vercel.app`, `shikkstracker.vercel.app`. Check: **uptime only**. | ShikksTracker was added because the whole outreach pipeline depends on it and nothing currently watches it. Riku confirmed the three hostnames on 2026-08-30; all were reachable (HTTP 200) when checked. |
| P5a-7 | **No "Today" section in the digest.** | It needs a store of self-set deadlines, which does not exist. A sectioned to-do store is recorded in `ROADMAP.md` Deferred and is explicitly post-v0 work. |
| P5a-8 | **No per-site history** is stored. | Deliberate gap; P8's Freelance page needs a health view anyway and can add the model then. |
| P5a-9 | **Domain expiry is dropped**, not deferred. | All three sites are `*.vercel.app` subdomains. The registrable domain is `vercel.app`, which belongs to Vercel — its expiry is neither actionable nor Riku's to renew. (The first pass checked `azerotech.dev` and `meowchi.ph`, which turned out not to be the real hostnames; `.ph` serves no RDAP either way.) Revisit only if a domain Riku actually controls joins the list. |
| P5a-10 | **Certificate expiry is dropped** too. Site health is a single uptime check. | Same root cause: `*.vercel.app` hosts share one wildcard certificate that Vercel renews automatically — observed 2026-08-30, issued by Google Trust Services on a ~90-day rotation. Checking it would return an identical, unactionable date for all three sites, and a certificate that actually broke would already fail the reachability check. This restores the "uptime only" option Riku first declined; it is chosen now because the sites turned out not to be domains he controls. |

---

## Architecture

### Route layout

The chaser route is **not touched**. The `expire` cron slot becomes the multiplexer.

| Slot | Route | Schedule (UTC) | Manila | Jobs |
|---|---|---|---|---|
| 1 | `/api/cron/chaser` | `0 22 * * *` | 06:00 | chaser (unchanged) |
| 2 | `/api/cron/morning` | `0 23 * * *` | 07:00 | expiry sweep → watchdog → site health → dispatcher |

`/api/cron/expire`'s body moves to `src/lib/jobs/expirySweep.ts`. The old route stays as a thin manual-trigger entry point calling the same job; only its `vercel.json` entry is removed. Both entry points write the same `expiry-sweep` run record.

Nothing depends on the chaser finishing before the morning route starts (state §4). The digest reports queue state at the moment it runs, not what the chaser did.

### Job ordering and budget

`maxDuration = 60`, wall-clock budget 45s, mirroring the chaser. Order is cheapest-and-most-certain first so the expensive work can never starve the cheap work:

1. **expiry sweep** — two `updateMany` calls, always runs (see Toggles)
2. **watchdog** — a handful of indexed reads
3. **site health** — outbound network, all sites in parallel, hard-capped at ~10s
4. **dispatcher** — composes and sends the single push

Each job is wrapped independently. One throwing never stops the next. The push is sent **last**, after every run record is written (`CLAUDE.md`: alerts last, so a notification failure can never corrupt data state).

### How partial failure is reported

**Each job writes its own `AgentRun` row** — `expiry-sweep`, `watchdog`, `site-health`, `dispatcher`. Four rows from one invocation. No new "which part of the combined run failed?" concept is introduced: the existing per-agent records already answer it, and the watchdog's freshness table already reads latest-run-per-agent. A job that fails produces an `ok: false` row that the *next* morning's watchdog reports.

The route returns a per-job JSON summary. Only a failure of the route itself (not of a job inside it) returns 500.

**The dispatcher also reports failures from its own run.** The watchdog reads *yesterday's* records, so a job that dies this morning would otherwise go unmentioned until tomorrow. The route therefore hands the dispatcher the in-memory outcome of every job that already ran, and any that threw is named in the digest immediately. This is also what covers the watchdog itself, which is absent from its own expectations table.

### Run-record counts per job

| Job | `itemsProcessed` | `itemsFailed` | `itemsSkipped` |
|---|---|---|---|
| `expiry-sweep` | items expired + unstuck | — | — |
| `watchdog` | agents checked | anomalies found | — |
| `site-health` | sites checked | checks that errored | checks returning `unknown` |
| `dispatcher` | problems reported | — | — |

The watchdog is deliberately not in its own expectations table, so recording anomalies in `itemsFailed` cannot make it flag itself as `degraded` in a loop.

A **failed push** is not counted; it makes the dispatcher's whole run `ok: false`, which the next day's watchdog reports as `failed` rather than the weaker `degraded`. That is the correct severity: a digest nobody received is a total failure of that run's purpose, not a partial one.

---

## Watchdog

`src/lib/watchdog.ts` — a pure function over run records plus a table.

```
EXPECTATIONS = [
  { agent: "chaser",       everyHours: 24, graceHours: 6 },
  { agent: "expiry-sweep", everyHours: 24, graceHours: 6 },
  { agent: "site-health",  everyHours: 24, graceHours: 6 },
  { agent: "dispatcher",   everyHours: 24, graceHours: 6 },
]
```

Only shipped agents are listed. `lead-sweep`, `triage` and `retro` join the table when they exist. The watchdog does **not** check itself — it is running, which is the proof.

Four anomaly conditions:

| Condition | Meaning |
|---|---|
| `never-ran` | no run record at all for an agent that should have one |
| `stale` | newest run started more than `everyHours + graceHours` ago |
| `failed` | newest run has `ok: false` |
| `degraded` | newest run has `ok: true` but `counts.itemsFailed > 0` |

**A switched-off agent is not an anomaly.** The digest reports it as a status line, read from `OsSettings` directly — never by string-matching the run record's `error` field. A deliberate pause must not nag, and must not be forgettable either.

---

## Site health

`src/lib/siteHealth.ts` — the site list sits beside the watchdog table, in code. All sites checked in parallel (`Promise.allSettled`), whole job capped ~10s.

| Check | Mechanism | Flags when |
|---|---|---|
| Reachable | `fetch` GET, 8s timeout, follows redirects | no response, or status ≥ 400 |

**One check, not three.** Certificate expiry and domain expiry were both specified, then both dropped on evidence — see P5a-9 and P5a-10. All three watched sites are `*.vercel.app` subdomains, which means neither a registration nor a certificate is Riku's to hold or renew.

Two properties this relies on:

- **A broken certificate already shows up as unreachable.** `fetch` rejects on a failed TLS handshake, so a certificate problem is reported by the one remaining check rather than needing its own. What is lost is only *advance* warning — and advance warning of an expiry nobody can act on is not worth a second network round trip per site.
- **A failed handshake is a finding, not a crash.** Whatever the cause — expired certificate, a server sending a TLS alert, DNS gone — the check reports that site as unreachable with a reason and carries on to the next one. It must never throw out of the job.

**`ok` means the check ran, not that the sites are healthy.** A client site being down is a *finding*, reported in the digest; it does not make the `site-health` run `ok: false`. Conflating them would make the watchdog report the monitoring as broken for as long as a client's site stayed down, and both signals would be learned-ignored. Only an error in the checking itself sets `ok: false`.

Counts: `itemsProcessed` = sites checked · `itemsFailed` = checks that errored · `itemsSkipped` = unused, now that there is no check that can return `unknown`.

**A limitation worth stating plainly:** every watched site, and RikuOS itself, is hosted on Vercel. A Vercel-wide outage takes down the sites *and* the cron that would report them, so the monitor shares a failure domain with everything it watches. Within P5a the only signal in that case is the absent morning push (P5a-4). Moving the schedule outside Vercel would fix it and was declined for good reasons (P5a-3); this is recorded so the trade-off stays visible rather than being rediscovered during an outage.

---

## Morning digest

One push, unconditionally, every day (P5a-4). Composed by a pure function so it is testable without sending anything, and kept terse enough to read on a lock screen:

- **To review** — pending `ApprovalItem` count
- **Waiting on you** — replied-but-unanswered leads and overdue next-actions, both from a single `GET /api/os/attention` call using the existing `chaserNDays` setting as its `days` argument, so the digest and the chaser can never disagree about what counts as unanswered
- **Problems** — every watchdog and site-health finding, named specifically ("Meowchi unreachable", "chaser failed"). Reads **"all clear"** when there are none, so a healthy run is distinguishable from a truncated one
- **Off** — agents currently switched off in `OsSettings`

If the attention call fails, the digest still sends with that line marked unavailable. A dependency being down must not cost Riku the whole digest.

---

## Data model changes

- **`OsSettings` gains `monitoringEnabled`** (Boolean, required, default `false`). No other new fields; thresholds and tables live in code.
- **No new models.** `AgentRun`'s enum already covers all three agents.
- No index changes, so no `migrate:indexes` run is required by this phase.
- `/settings` gains the monitoring toggle beside the existing chaser controls.

### Toggle semantics

Default off, so deploying never silently activates an agent — the same rule the chaser follows. Riku flips it on after the first manual run looks right. Two deliberate exceptions:

1. **The expiry sweep always runs**, regardless of the toggle. It is data hygiene, it predates P5a, and switching monitoring off must not quietly stop stale items from expiring.
2. **When monitoring is off, the jobs still write run records** carrying that fact, exactly as the chaser does — otherwise the watchdog could never distinguish "off" from "dead". They do no work and the dispatcher sends nothing, so the every-day push guarantee of P5a-4 holds **only while monitoring is on**. Switching it off deliberately silences the digest; that is the point of the switch, and the run records remain the evidence that the route is alive.

---

## Testing and acceptance

Tests live on the logic layer (`src/lib/__tests__/`); routes stay thin.

- **watchdog** — each anomaly condition, a healthy agent, a switched-off agent producing no anomaly, an agent absent from the table being ignored
- **siteHealth** — status classification, a failed TLS handshake and a DNS failure both reported as unreachable-with-a-reason, timeout handling, and that a down site does not set `ok: false`
- **digest** — composition from each combination of inputs, the "all clear" branch, and the attention-unavailable branch
- **expirySweep** — existing P3/P4 coverage moves with the extracted module, unchanged

Verification trio before "done": `npm test` + `npx tsc --noEmit` + `npm run build`, all green.

**An agent feature is only actually done when observed doing its job once against real data.** For P5a:

1. Trigger `/api/cron/morning` by hand with the cron secret → four run records appear → one push lands on the iPhone.
2. Prove absence is detected: temporarily add an agent to the expectations table that has never run → trigger → the digest names it as `never-ran` → remove it.
3. Point one site entry at a hostname known not to resolve → trigger → the digest names that site as unreachable.

---

## Manual steps — Riku's hands only

1. ~~Supply the site hostnames.~~ **Done 2026-08-30** — `azerotech.vercel.app`, `meowchi.vercel.app`, `shikkstracker.vercel.app`, all verified reachable (HTTP 200). The first pass used `azerotech.dev` and `meowchi.ph`; neither is Riku's, so the findings recorded against them are withdrawn.
2. ~~Confirm the domains answer RDAP.~~ **Done** — not applicable, the sites are Vercel subdomains. Resolved as P5a-9 and P5a-10.
3. **Deploy the `vercel.json` schedule change** — removing the `expire` entry, adding `morning`, moving the chaser to 22:00 UTC — then verify both crons appear in the Vercel dashboard afterwards.
4. **Flip `monitoringEnabled` on in `/settings`** once acceptance step 1 passes.

Nothing in this list blocks writing the implementation plan.

---

## Non-goals

Messenger webhook freshness and the Meta Graph ping (added when P2 deploys) · the lead sweep (P5b) · certificate and domain expiry checks (P5a-9, P5a-10) · per-site history or uptime records (P8) · drafted client emails on health issues (P5a-5) · a to-do store or a "Today" digest section (post-v0) · any change to the chaser route's logic · upgrading to Vercel Pro.

## Open items for the executing session

1. The exact wording and length limit of the push body — iOS truncates aggressively; the composer should be written against a measured limit rather than a guess.
2. Whether the reachability check should treat a 3xx that lands on an error page as healthy. Following redirects and judging the final status is the assumption; revisit only if it produces a false reading against the real sites.
