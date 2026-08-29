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
P1 ──► P8 (dashboard pages)          P1, P2, P3 have no dependencies on each other
```

---

## P1 — OS API + variant tagging — repo: ShikksTracker

*Deep spec: features C & D. Unblocks P4, P7, P8.*

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

*Needs P3. Webhook freshness checks need P2. Built before P6–P8 on purpose.*

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

## P6 — Inbound Messenger triage — repo: RikuOS

*Needs P2 + P3.*

| # | Task | Depends on |
|---|------|-----------|
| 6.1 | ShikksTracker forwards inbound events to a secret-gated RikuOS endpoint (push, not polling — triage is time-sensitive inside the 24h window; requires a small forwarding hook added to ShikksTracker's webhook handler, spec'd as an addendum when P6 starts) | P2 |
| 6.2 | Triage logic inside the 24h window: FAQ answers + call-time proposals drafted; auto-acknowledgment allowed (the one ratified exception); substantive replies → queue with `staleAt` = window close | 6.1 |
| 6.3 | Send path: approved triage replies sent via page token within the window (this is *inbound response*, legal — not cold outreach) | 6.2 |

**Done when:** an inbound FAQ gets an acknowledged, approved answer inside the window without Riku opening Messenger.

## P7 — Retro agent — repo: skills + RikuOS

*Needs P1 + accumulated send data (weeks). Design its diff-approval flow at build time (concept §7).*

| # | Task | Depends on |
|---|------|-----------|
| 7.1 | Weekly Claude scheduled task: variant stats + queue decision history → scoreboard + proposed variant/prompt edits | P1, P4 running |
| 7.2 | `skill-edit` ApprovalItem type: proposed edit rendered as a readable diff; approve applies the variant change (via OS API) | 7.1 |

**Done when:** the first weekly retro produces a scoreboard and at least one accepted variant improvement.

## P8 — Dashboard pages + calendar + polish — repo: RikuOS

*Needs P1 (Freelance feed); Canvas token (Academics); Google OAuth (Personal). Last by design (D10). Visual design pass happens here (design-loop process per concept §7).*

| # | Task | Depends on |
|---|------|-----------|
| 8.1 | Freelance page: OS API summary/attention/variant-stats + site health view | P1, P5 |
| 8.2 | Personal page: GCal live read with sub-calendar layers, write-through event creation (D5); morning brief view | P3 |
| 8.3 | Academics page: Canvas courses/assignments/due dates; manual modules/reviewers with per-course counters; Classes sub-calendar auto-population; sentence-to-schedule planner | 8.2 |
| 8.4 | PWA polish + the proper visual design pass across all pages | 8.1–8.3 |
| 8.5 | **Feature re-review before the design pass:** walk every shipped feature (P3–P7) with Riku for improvements and quality-of-life fixes, and fold the accepted ones into 8.4 rather than shipping a coat of paint over v0 ergonomics | 8.1–8.3 |

**Done when:** all three pages live on real feeds (D11 satisfied), calendar layers toggle, and the app looks intentional.

---

## Deferred (v1+, unchanged from concept)

Voice commands (D8) · GCash/Maya statement import / receipt OCR (D7) · per-lead click links (D3) · Work page (D9) · passkey login (S3) · case-study/brand pipeline.

**Sectioned to-do store** (added 2026-08-29) — a to-do list per OS section (Personal, Freelance, Academics; Work stays parked per D9), consolidated into the morning digest: everything due within 3 days, plus anything overdue. Agreed shape: title, section, optional due date, done — undated items live on the page but never enter the digest. Deliberately deferred past v0 (Riku, 2026-08-29) so P5a stays cheap protective work. Likely the missing source of truth the quest tracker needs.

**Quest-style project tracker** (added 2026-08-29) — a page that renders currently-open projects as visible, persistent quests, because a project that stops being worked on currently stops being remembered. Needs a source of truth for "what projects exist and which are open" first; that source does not exist yet in either repo. Revisit alongside P8.
