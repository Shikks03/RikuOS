# RikuOS Roadmap — phases, tasks, dependencies

Ratified 2026-08-28. Build order follows the concept (§4) with the watchdog pulled early per its own risk note. **Repo** says where the work happens; ShikksTracker phases are executed in that project by its own sessions, guided by the deep spec there.

Dependency graph:

```
P1 (ST: OS API + variants) ──────────┬──► P4 (chaser) ──► v0 🏁
P3 (RikuOS skeleton + queue + push) ─┘        │
P2 (ST: webhook + tabs) ──► P6 (triage)       │
        │                                     ▼
        └────────► P5 (watchdog + health + digest)
P1 + weeks of send data ──► P7 (retro)

The pages (P8 split 2026-09-04, decision S11):
P1, P5 ──► P8 (Freelance page) ──► P9 (design foundation)
                                     └──► P10 (Personal: calendar + to-dos + Today)
                                              └──► P11 (Academics) ──┐
                                                                     ▼
                                                    P12 (re-review, then polish)

P1, P2, P3 have no dependencies on each other.
```

**Status, 2026-09-05:** P1–P5 shipped. **P6 is DROPPED (S15) and its code is now DELETED** — it was
built and deployed, then cut because Meta will never deliver prospect DMs to an unpublished app.
The deletion landed the same day, in both repos. P7 waits on accumulated send data. P8–P12 are the
pages; their contents are discussed per phase (S11), not planned here.

---

## P1 — OS API + variant tagging — repo: ShikksTracker

*Deep spec: features C & D. Unblocks P4, P7, and the Freelance page (P8).*

| # | Task | Depends on |
|---|------|-----------|
| 1.1 | `Variant` model + seed variants (email stage-1 ×2, facebook DM ×2); `variantKey` + `origin` fields on `EmailLog` (index sync script updated) | — |
| 1.2 | Draft generation tags each draft with a variant (least-used-among-active selection) | 1.1 |
| 1.3 | `GET /api/os/summary`, `/attention`, `/variant-stats` + `x-os-secret` guard + proxy allowlist entry | — |
| 1.4 | `POST /api/os/drafts` (threading for email replies; Messenger lane for facebook) — includes verifying `sendOneLog`'s status guard permits `replied` contacts | 1.3 |
| 1.5 | Tests: guard, attention query, variant stats aggregation, draft creation | 1.1–1.4 |

**Done when:** RikuOS-side `curl` with the secret returns a real attention list, and a draft created via the API appears in the correct lane and (email) threads correctly on send.

## P2 — Messenger webhook + lane split — repo: ShikksTracker

*Deep spec: features A & B. Unblocks P6; feeds P5's webhook monitoring and enriches P4 with Messenger data. No dependency on P1.*

| # | Task | Depends on |
|---|------|-----------|
| 2.1 | Meta dev-mode app setup: page webhook subscription (`messages`, `message_echoes`), verify token, app secret, page token in env | — |
| 2.2 | Webhook endpoint: GET verification, POST signature check, fast-200, idempotent store by `mid`; `MessengerConversation` + `MessengerMessage` models | 2.1 |
| 2.3 | Linking: name-similarity suggestions, one-tap confirm, retroactive reply effects on link; shared reply-effects helper extracted (tidy-what-we-touch) | 2.2 |
| 2.4 | Echo handling: outbound messages recorded; pending approved draft auto-marked sent on close text match (stretch: keep manual "Mark sent" as fallback) | 2.2 |
| 2.5 | `/messenger` page: conversation list (linked + unlinked w/ suggestions), thread view, draft lane; `/outreach` reduced to instagram/phone; density pass on touched screens | 2.3 |
| 2.6 | Tests: signature verification, event parsing fixtures (real recorded payloads), linking suggestion scoring, reply effects | 2.2–2.4 |

**Done when:** a real reply to the RIKU page appears in `/messenger` within a minute, and confirming a suggested link marks the contact replied with score bumped.

**DONE 2026-09-04** (shipped in ShikksTracker; merged to `origin/main` as `cf87344`). Verified from
here read-only, on the live API rather than on the claim: `GET /api/os/summary` returns
`messenger.lastEventAt: "2026-09-04T07:56:56.282Z"` — real, same-day webhook traffic — with
`unlinkedCount: 1`. That repo's `docs/os-api.md` has been rewritten as the handoff required, so
`lastEventAt: null` now documents "no event has EVER been received" instead of "no webhook yet".

**One half of the acceptance bar is not yet witnessed.** "A real reply appears in `/messenger`
within a minute" is satisfied. "Confirming a suggested link marks the contact replied with the
score bumped" is not — the standing `unlinkedCount: 1` is a conversation still awaiting that
one-tap confirm, and only Riku can perform it. Left open rather than marked done by inference.

Two side effects worth recording, both verified on `origin/main`: the hourly sequence-engine pinger
that had never existed was added (`61d36bb`), which is why `engine.lastRunAt` now reads same-day
after 29 days frozen; and the region is now `sin1`, closing the `hkg1` → Anthropic 403 trap the
2026-08-30 handoff flagged as still-live.

## P3 — RikuOS skeleton: auth, queue, push — repo: RikuOS (here)

*No dependencies. Can start immediately, in parallel with P1/P2.*

| # | Task | Depends on |
|---|------|-----------|
| 3.1 | Scaffold: Next.js + TS strict + Mongoose + Vitest + the connection/session/rate-limit patterns ported from ShikksTracker; `.env.example`; PWA manifest | — |
| 3.2 | Models: `ApprovalItem` (discriminators), `AgentRun`, `PushSubscription`, `OsSettings`, `LoginAttempt`; index sync script | 3.1 |
| 3.3 | Login page + session middleware (password now; passkey later per S3) | 3.1 |
| 3.4 | Approval Queue page (simple list, mobile-first): approve / edit / reject; action execution on approve with `actionStatus` tracking; stale-item expiry sweep | 3.2 |
| 3.5 | Web push: VAPID keys, subscribe flow in the PWA, send helper, test notification button | 3.2 |
| 3.6 | Tests: session, queue state transitions, expiry sweep, push payload building | 3.2–3.5 |

**Done when:** installed on the iPhone, logged in, a manually seeded ApprovalItem shows up, approving it flips states correctly, and a push lands on the lock screen.

**DONE 2026-08-29** — live at https://riku-os.vercel.app. All six tasks shipped and every acceptance criterion above observed against real data. Evidence: Task 14 in the P3 plan.

## P4 — Follow-up chaser → **v0 finish line** — repo: RikuOS

*Needs P1 (attention API) + P3 (queue + push).*

| # | Task | Depends on |
|---|------|-----------|
| 4.1 | ShikksTracker API client (`ST_API_BASE_URL` + `ST_API_SECRET`, typed responses, timeouts) | P1, 3.1 |
| 4.2 | Chaser cron route: attention list → per-lead response draft via Anthropic API (Taglish-aware prompt reusing the contact/campaign context in the payload) → `ApprovalItem` per lead (capped per run, idempotent per lead+reply) | 4.1, 3.4 |
| 4.3 | Approve action → `POST /api/os/drafts`; push notification on new items; `AgentRun` record per run | 4.2, 3.5 |
| 4.4 | Vercel cron schedule (daily, morning Manila); `OsSettings` toggle + N-days threshold | 4.2 |
| 4.5 | Tests: attention→item mapping, idempotency, action call | 4.2–4.3 |

**Done when (v0 🏁, ratified S1):** the chaser catches one *real* missed follow-up, Riku approves it on the phone, and the message goes out to the lead.

**DONE 2026-08-29** — v0 🏁. All five tasks shipped; 218 tests, `tsc` and `build` green. Observed
against real production data: the chaser found two replied-but-unanswered leads that had been
waiting 53 days, drafted a Taglish reply for each via the Anthropic API, queued both, and pushed to
the phone. Riku approved on the phone; the action reported `approved · action done` and the draft
appeared in ShikksTracker correctly threaded with `origin: "rikuos"`. Re-running the chaser
proposed nothing new (`processed: 0`, attention feed empty), proving both idempotency guards — the
feed's own dedup and RikuOS's reply-anchor check — independently. Evidence: Task 17 in the P4 plan.

Two honest qualifications on the acceptance bar:

1. **The two subjects were test contacts, not paying clients.** Nothing was fabricated to pass the
   test — both replies had sat unanswered in the production database since early July, and the
   chaser found them unaided — but the "real lead" half of S1 is satisfied in machinery, not in
   business value. The first genuine client chase will happen on its own the next time one replies.
2. **The messages had not left ShikksTracker at time of writing.** Both sat in its send queue as
   `approved`. Its `engine.lastRunAt` reads 2026-08-01, 28 days stale, so its send cron appears not
   to be firing. That is a ShikksTracker fault in ShikksTracker's repo (S4), not a P4 defect:
   RikuOS's responsibility ends at creating the approved draft, which it did.

Deviation from the plan text: the deployment region moved from `hkg1` to `sin1` (commit `3e1554d`).
The Anthropic API refuses requests originating from Hong Kong with
`403 forbidden — "Request not allowed"`, which failed the chaser's first production run on both
leads. P4 is the first thing in either repo to call an external AI API from a deployed function, so
this had never surfaced. **ShikksTracker is still pinned to `hkg1` and its `src/lib/draft.ts` also
calls Anthropic — it will hit the same wall the first time cold-outreach drafting runs in
production.** Fix belongs in that repo.

Also handed to a ShikksTracker session (S4): `GET /api/os/attention` does not expose the anchor
log's `subject`, so the queue card cannot show the subject line an email reply will use. P4 works
around this correctly by omitting `subject` entirely so ShikksTracker derives `Re: <anchor
subject>` itself; the proposed fix is one field in one `.select()`.

## P5 — Watchdog + site health + morning digest — repo: RikuOS

*Needs P3. Webhook freshness checks need P2. Built before P6–P12 on purpose.*

| # | Task | Depends on |
|---|------|-----------|
| 5.1 | Watchdog cron: `AgentRun` freshness per expected schedule, OS-API webhook `lastEventAt`, Graph API ping → push alert with one-line diagnosis | P3 (P2 for webhook checks) |
| 5.2 | Site health cron: uptime for AzeroTech, Meowchi, ShikksTracker → findings named in the morning digest | P3 |
| 5.4 | Morning dispatcher cron: one daily digest push (queue count, attention count, health, today's failures) | P3, 5.1 |

**Done when:** killing the webhook (or a cron) produces a push alert within one watchdog cycle.

**P5 DONE 2026-08-30** (shipped as P5a) — tasks 5.1, 5.2 and 5.4 shipped as `/api/cron/morning`, live at
https://riku-os.vercel.app. 272 tests, `tsc` and `build` green. All three acceptance criteria
observed against real data: a real run delivered a push to the iPhone; adding a never-run agent to
the expectations table produced `triage has never run`; pointing a watched site at an
unresolvable host produced `AzeroTech unreachable` — both in one `2 problems · 0 to review` push,
with `site-health` still reporting `ok: true`, confirming a down client site is a finding rather
than a broken monitor. Probes reverted (`8188f91`) and production confirmed back to `All clear`.

Scope trimmed on evidence during design — see `docs/superpowers/specs/2026-08-29-p5a-monitoring-design.md`:
webhook freshness and the Graph ping wait for ShikksTracker's P2 (P5a-1); SSL and domain expiry were
dropped because all three hosts are `*.vercel.app` subdomains whose certificate and registration are
Vercel's, not Riku's (P5a-9, P5a-10); site health notifies only and does not draft client emails
(P5a-5). Vercel Hobby's two-cron limit is why one route multiplexes four jobs (P5a-3).

**5.3 (lead sweep) is DROPPED, not deferred** (2026-08-30, Riku's call) — lead acquisition is not a
RikuOS job; prospecting stays something he does by hand. Only acquisition leaves: the chaser, site
health and the Freelance page are untouched. Reasoning and the three blocking facts are recorded as
decision **S8** in `ARCHITECTURE.md` §7. Do not re-propose it without a new decision there.

With 5.3 gone, **P5 is complete.**

**5.5 — outreach pipeline monitor, added 2026-08-30 after P5 closed.** Not scope creep and not a
re-opening: a read of `GET /api/os/summary` that day found ShikksTracker's send engine had not run
since 2026-08-01 — 29 days — while `queue.approved` showed messages waiting on it, and *nothing in
either repo was watching*. RikuOS consumed only `/attention` and `/drafts`, so the one system the
whole outreach side depends on was the one system the monitor could not see. Shipped as a fourth
job in `/api/cron/morning` (`outreach-health`, `src/lib/outreachHealth.ts`), alarming on a stalled
or never-reporting engine, on engine errors, and on approved messages stranded by a stall.

**Root cause, found the same day by reading ShikksTracker's source (read-only, S4).** Its engine is
driven by an **external hourly pinger that was never set up** — `vercel.json` there has no `crons`
key by design, and `docs/cron-setup.md` describes a third-party pinger as a manual step. Nothing has
ever called `/api/cron/sequence` on a schedule. The staleness reading is sound because
`CronRun.create` is unconditional at the end of `runSequenceEngine`: a run that fires with sending
disabled, outside the send window, or at its daily cap still stamps `lastRunAt`, so a frozen
timestamp always means "did not run", never "ran with nothing to do". **If that write ever moves
behind a condition, this check silently becomes a lie.** The threshold is 36 h: the pinger is
scheduled only for UTC hours 0–9 (Manila's send window), so the longest legitimate gap is the ~14 h
overnight one. **Resolved 2026-09-04:** the pinger now exists (ShikksTracker `61d36bb`, a GitHub Actions
workflow) and the engine reports same-day again. Its two send switches remain off, which is the
resting state under decision **S10** — a healthy engine that sends nothing is correct and is never
reported as a fault.

Three deliberate silences, each pinned by a test: a **draft backlog is not a fault** (that queue is
Riku's own to work); **approved messages beside a healthy engine are not stranded**, they are about
to be sent; and **no `summary.messenger` field is judged at all** until ShikksTracker's P2 ships —
`lastEventAt: null` still means "no webhook yet", not "the webhook is dead" (P5a-1). The fields are
carried through `fetchSummary` so that check becomes a pure addition later. On the first morning
after deploy the watchdog reports `outreach-health has never run` once, because it runs before the
new job writes its first record — the same one-off `site-health` had.

**5.1's deferred half — CLOSED 2026-09-04, partially.** P5a-1 parked two checks until ShikksTracker's
P2 shipped: Messenger webhook freshness and the Meta Graph API token ping. P2 is now live, so:

- **Webhook freshness ships.** It lives in `outreachHealth.ts`, **not** the watchdog — reading it
  costs an outbound call to ShikksTracker, and the watchdog's whole value is that its verdict on
  RikuOS's own agents survives a ShikksTracker outage. The threshold is 10 days of total silence
  (Riku's call, chosen over 7 and 14): `messenger.lastEventAt` advances on outbound echoes as well
  as inbound messages, so ten days is silence in both directions. Findings reach the morning push
  through the existing `buildProblems` path with no route change.
- **The Graph ping does not ship, and is not merely deferred — it moved repos.** RikuOS cannot hold
  a second copy of the Meta page token: regenerating it in Meta's console invalidates the previous
  one, so a duplicate here would die on every routine rotation and alarm on a healthy system.
  Recorded as decision **S9** in `ARCHITECTURE.md` §7.

**Both halves of S9 are now moot (S15, 2026-09-05)** and this is kept only so the reasoning is not
re-derived. The webhook-silence check that shipped instead has been deleted, and the direct token
check that was written up for ShikksTracker is **withdrawn, not pending** — there is no longer a
Meta subscription whose token expiry could matter. The handoff carrying that ask was deleted with
it.

## P6 — Inbound Messenger triage — repo: RikuOS

> **P6 IS DROPPED AND DELETED — decision S15, 2026-09-05.** Everything below this line is kept as
> the record of what was built and why it went. **Do not build from it, and do not revive it.**
>
> Meta's App Review requires business verification, "Riku" has no registered legal entity and will
> not register, so the app stays in Development mode permanently and prospect DMs never reach the
> webhook at all — verified directly, not assumed. Triage's only input therefore does not exist.
> The code shipped complete and green on 2026-09-05 and was **deleted the same day** rather than
> parked, because working code with no possible input invites a future session to "finish" it. The
> handoff `docs/handoffs/2026-09-04-p6-messenger-forwarding.md` is **withdrawn and deleted**; the
> two ShikksTracker contracts it asked for are not to be built.
>
> **DELETION DONE, 2026-09-05.** Removed from this repo: `lib/triage.ts`, `lib/draftTriage.ts`,
> `lib/ingestTriage.ts`, `app/api/messenger/`, the `TriageResponseApproval` discriminator and its
> `payload.messageId` index, `requireForwardSecret` and `MESSENGER_FORWARD_SECRET`, the six triage
> settings, the triage parts of `queue.ts` / `stApi.ts` / `proxy.ts` / the queue page, and the three
> triage test files. **457 tests → 300**, `tsc` and `build` green, no `/api/messenger/inbound` in
> the build output.
>
> **The trap was real and was closed in the same pass.** Deleting ShikksTracker's webhook does NOT
> make RikuOS's health check safe: a missing `messenger` block in `/api/os/summary` reads as `null`,
> which was the `webhook-never-fired` branch — so the daily digest would have swapped a staleness
> false alarm for a never-fired one, fired every morning. The messenger branch of
> `evaluateOutreach`, `WEBHOOK_SILENT_DAYS` and `SummaryMessenger` are gone. See S15 in
> `ARCHITECTURE.md` §7 for the full reasoning.
>
> **Two things deliberately kept.** `"triage"` stays in `AgentRun`'s `AGENTS` enum — old smoke-test
> rows still carry it and TTL out on their own in 90 days. And `payload.messageId_1` still exists in
> Atlas: `npm run migrate:indexes` reports it as the single pending DROP, and applying it is Riku's
> call, not an agent's.


*Needs P2 + P3.*

| # | Task | Depends on |
|---|------|-----------|
| 6.1 | ShikksTracker forwards inbound events to a secret-gated RikuOS endpoint (push, not polling — triage is time-sensitive inside the 24h window; requires a small forwarding hook added to ShikksTracker's webhook handler, spec'd as an addendum when P6 starts) | P2 |
| 6.2 | Triage logic inside the 24h window: acknowledgment, FAQ answer and call-time proposal all **drafted**; every one queued with `staleAt` = window close. **Nothing auto-sends (S14).** Immediate push on a new item — inside a 24h deadline the morning digest is too slow | 6.1 |
| 6.3 | Send path: on approval, **ShikksTracker sends** — it holds the page token, and RikuOS may not keep a second copy (S9). This is a contract addition to the OS API, folded into the same handoff as 6.1's forwarding hook. Legal as *inbound response* within the window (D2), not cold outreach | 6.2 |

**Done when:** an inbound FAQ gets an approved answer inside the window without Riku opening Messenger.

**Two things settled on 2026-09-04, before any design work:**

- **S14 — nothing auto-sends.** The concept's one ratified exception (triage acknowledging inbound
  messages itself) is revoked. Every triage output is drafted and queued. The cost is accepted
  deliberately: someone messaging overnight hears nothing until Riku taps, and the 24-hour window is
  Meta's hard deadline, so an unactioned draft can expire unsent. That makes the **immediate push**
  load-bearing, not a nicety — it is the only thing that can reach Riku inside the window.
- **The send path moved repos.** 6.3 originally had RikuOS sending via the page token. It cannot:
  regenerating that token invalidates the old one, so a copy here would fail silently mid-window
  (S9). ShikksTracker sends; RikuOS asks it to. Both that and 6.1's forwarding hook are OS-API
  contract changes, so they travel in **one handoff**, not two.

**P6 BUILT 2026-09-05, never accepted, deleted the same day** — all ten planned tasks shipped on
`master` at 457 tests (from 313), then came back out. What follows is the record of what was built.
It never received anything, and never could have: both halves of the contract lived in
ShikksTracker and neither was ever built, because S15 withdrew the ask before that session ran.
Acceptance — a real message reaching the phone within a minute and one tap sending the reply — was
never observed. Nothing here was ever seen doing its job against real data.

**It ships deliberately under-configured (design D11), and that is the design, not unfinished work.**
The knowledge block is unapproved, `nameableProjects` is empty and `demoSiteUrls` is empty. Each has
a specified degradation with its own test, and with all three empty the feature still delivers a
push within a minute and a one-tap holding reply — the part that beats opening Messenger. The
holding reply is a **template, never model-generated**, which is what makes it survive both an
unapproved block and an Anthropic outage.

**What the reviews changed, and why they were worth the passes.** Twelve defects in the plan's own
text were found and fixed during execution. The ones that mattered:

- `new Date("Sep 4 2026")` parses in the **server's** local timezone, so a loosely-formatted forward
  would have meant different instants on a laptop and on Vercel — against a hard 24-hour deadline.
  `sentAt` is now strict ISO-8601 with an explicit offset.
- The Anthropic SDK defaults to `maxRetries: 2`. With a 45s timeout inside a 60s route that is three
  attempts, so Vercel would kill the function and write **no item, no run, no push** — losing the
  window the drafting call exists to serve. Retries are now off and the budget is stated truthfully.
- The dedup was a bare `findOne` spanning a ~40s model call, and the plan justified skipping an index
  by saying this repo disallows one on a payload field. **It does not** — `payload.replyToLogId` has
  carried a partial unique index on the base schema since P4. A redelivery during a slow draft was
  therefore the *expected* path to two cards, two pushes, and two replies to one prospect. Now
  indexed, with the E11000 race caught as a duplicate. **Needs `npm run migrate:indexes:apply`
  before the protection is live** — `autoIndex` is off in production.
- Editing the knowledge block left `knowledgeReviewedAt` set, silently re-opening the approval gate
  over prices Riku had never read. Editing now clears the stamp.
- The inbound message was appended to the prompt undelimited, so a stranger could forge the builder's
  own section headers and hand the model a link. It is fenced now, with the rules restated after it.
- **Found only by the end-to-end pass, and the most important:** approving a triage card sent text
  Riku had never seen. The queue page rendered `payload.draftBody` — a followup-draft field,
  undefined for triage — so the card showed the *inbound* message and nothing of the reply, while
  Approve worked and sent. An uninformed approval is an auto-send by another name. The card now
  shows the drafted answer, the holding reply, the withheld reason and the window deadline, and says
  which text Approve will send. That was minimal plain rendering to make an existing live control
  safe, and it is what this phase's own acceptance criteria already assumed. **No chooser was
  built** — picking between the two texts is queue-page design and waits on S11.

**Meta app review is still pending (2026-09-05), and that gates acceptance.** The Facebook app is
not yet approved, so the Messenger webhook only receives events from accounts holding a
**tester role**. Messages from the public do not arrive at all. Two consequences worth stating so
nobody misreads them later:

- **Triage receiving nothing is the expected state, not a fault.** A quiet `messenger.lastEventAt`
  and an empty triage history mean "not approved yet", not "the webhook broke". This is the same
  reason the watchdog check for *a forward that never arrived* was deliberately left unbuilt — it
  would alarm every morning and train Riku to ignore the watchdog.
- **Acceptance is scoped to a tester, by Riku's call (2026-09-05).** Messenger-side testing is on
  hold while blocked. A tester has already messaged the page; P6 counts as done when that message
  appears properly as a queue item and a reply can be sent back to it. Note the 24-hour window is
  Meta's and absolute: if that message is already older than 24 hours it cannot be answered at all,
  and the tester must message again once ShikksTracker's forwarding hook exists.

**Two things to settle before the app goes live**, since approval day is when a trickle of testers
becomes whatever the public sends: the knowledge block should be approved first (otherwise the
first real prospects get holding replies only — safe, but thin), and there is still **no volume
cap** — 40 messages currently means 40 Anthropic calls and 40 pushes.

**Open, deliberately.** The watchdog does not yet notice a forward that never arrived (design open
item 2): until ShikksTracker forwards anything, "messenger events exist but no triage run" is the
normal state, so the check would alarm every morning and train Riku to ignore the watchdog. Revisit
once one real forward is observed. Flood control is also unbuilt — 40 messages currently means 40
model calls and 40 pushes — because the limit, and what the card says when it trips, are Riku's call.

## P7 — Retro agent — repo: skills + RikuOS

*Needs P1 + accumulated send data (weeks). Design its diff-approval flow at build time (concept §7).*

| # | Task | Depends on |
|---|------|-----------|
| 7.1 | Weekly Claude scheduled task: variant stats + queue decision history → scoreboard + proposed variant/prompt edits | P1, P4 running |
| 7.2 | `skill-edit` ApprovalItem type: proposed edit rendered as a readable diff; approve applies the variant change (via OS API) | 7.1 |

**Done when:** the first weekly retro produces a scoreboard and at least one accepted variant improvement.

## P8–P12 — the pages (was P8) — repo: RikuOS

**P8 was split on 2026-09-04 (decision S11).** It carried three unrelated acceptance bars, two new
external integrations with separate auth, and an internal dependency between its own tasks. The old
tasks 8.1–8.5 remain below as *raw material*; they are not the plan.

**Contents are deliberately not written here.** Under S11 each page's content is discussed with Riku
at the start of its own phase and followed up before anything is finalised — never once up front,
never inferred from another page's discussion. Drawing the task lists now would defeat that rule.
What is settled is the boundaries, the order, and why.

**Ordering rationale.** Freelance goes first because it is the only page needing no new sign-in — all
its feeds already exist — and because it is the densest and most table-heavy, which is the hardest
test a design system can face (S12). Personal precedes Academics because Academics' Classes layer
needs Personal's calendar to exist.

| # | Phase | Depends on | Done when |
|---|-------|-----------|-----------|
| P8 | **Freelance page.** The pipeline view on real feeds, built plain. | P1, P5 | The page is live on real OS-API data with no manual entry — D11 satisfied for one page. |
| P9 | **Design foundation.** One focused pass settling type, colour, spacing and a small component vocabulary, proven by rebuilding P8's page to it. | P8 | The system exists as tokens and components, and the Freelance page is built from them rather than from ad-hoc styles. |
| P10 | **Personal: calendar, to-dos, Today.** Google sign-in, live calendar read with toggleable layers, create-through-to-Google, the sectioned to-do store, and the Today section added to the morning digest (S13). | P3, P9 | One morning push names what is actually due and scheduled that day — the section P5a-7 dropped for want of a to-do store. |
| P11 | **Academics.** Canvas courses and due dates, the manual modules/reviewers supplement, Classes layer population, and the sentence-to-schedule planner. | P10, Canvas token | Decided at its own content discussion (S11). |
| P12 | **Feature re-review, then final polish.** Walk P3–P11 with Riku for fixes first, then the polish pass. | P8–P11 | The accepted fixes are shipped and the app looks intentional. Re-review precedes polish — Riku's call, 2026-08-29: not a coat of paint over v0 ergonomics. |

**Two constraints carried into these phases, both already ratified:**

- **The planner is the one calendar writer that needs approval** (S13). Riku creating an event from
  the UI is Riku acting, and the approval queue governs *agents* acting on his behalf, not him.
- **The to-do store is a supplement under D11, not a violation** (S13). The Personal page is fed by
  Google Calendar; to-dos ride alongside with a specific job, exactly as modules/reviewers do for
  Academics. Recorded so the unparking is not later mistaken for breaking D11.

**Raw material from the old P8, retained for the content discussions to draw on — not a task list:**
Freelance page reading OS-API summary/attention/variant-stats plus the site-health view · Personal
page with GCal sub-calendar layers, write-through creation (D5) and a morning brief view · Academics
page with Canvas courses/assignments/due dates, manual modules/reviewers with per-course counters,
Classes sub-calendar auto-population and a sentence-to-schedule planner · PWA polish · the P3–P11
feature re-review.

---

## Deferred (v1+, unchanged from concept)

Voice commands (D8) · GCash/Maya statement import / receipt OCR (D7) · per-lead click links (D3) · Work page (D9) · passkey login (S3) · case-study/brand pipeline.

~~**Sectioned to-do store**~~ — **UNPARKED 2026-09-04 into P10** (decision S13). It is the input the morning digest's Today section was missing, which is why P5a-7 dropped that section. Agreed shape stands: title, section (Personal, Freelance, Academics; Work parked per D9), optional due date, done — undated items live on the page but never enter the digest, which reports everything due within 3 days plus anything overdue.

**Quest-style project tracker** (added 2026-08-29) — a page that renders currently-open projects as visible, persistent quests, because a project that stops being worked on currently stops being remembered. Needs a source of truth for "what projects exist and which are open" first; that source does not exist yet in either repo. The unparked to-do store (P10) is the likeliest candidate — raise it in P10's content discussion, and again in P12's re-review.
