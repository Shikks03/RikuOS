# RikuOS Roadmap — phases, tasks, dependencies

Ratified 2026-08-28. Build order follows the concept (§4) with the watchdog pulled early per its own risk note. **Repo** says where the work happens; ShikksTracker phases are executed in that project by its own sessions, guided by the deep spec there.

Dependency graph:

```
P1 (ST: OS API + variants) ──────────┬──► P4 (chaser) ──► v0 🏁
P3 (RikuOS skeleton + queue + push) ─┘        │
P2 (ST: webhook + tabs) ──► P6 (triage)       │
        │                                     ▼
        └────────► P5 (watchdog + health + sweep schedule)
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

## P5 — Watchdog + site health + lead-sweep schedule — repos: RikuOS + skills

*Needs P3. Webhook freshness checks need P2. Built before P6–P8 on purpose.*

| # | Task | Depends on |
|---|------|-----------|
| 5.1 | Watchdog cron: `AgentRun` freshness per expected schedule, OS-API webhook `lastEventAt`, Graph API ping → push alert with one-line diagnosis | P3 (P2 for webhook checks) |
| 5.2 | Site health cron: uptime + SSL expiry + domain expiry for AzeroTech, Meowchi → on issue, drafts client email → queue | P3 |
| 5.3 | Lead sweep as Claude scheduled task (M/W/F pre-dawn): run existing prospecting skills → import qualified leads via ShikksTracker's import; results summarized in morning push | P1 |
| 5.4 | Morning dispatcher cron: one daily digest push (queue count, attention count, health, today's failures) | P3, 5.1 |

**Done when:** killing the webhook (or a cron) produces a push alert within one watchdog cycle, and a Monday sweep lands qualified leads before breakfast.

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

**Done when:** all three pages live on real feeds (D11 satisfied), calendar layers toggle, and the app looks intentional.

---

## Deferred (v1+, unchanged from concept)

Voice commands (D8) · GCash/Maya statement import / receipt OCR (D7) · per-lead click links (D3) · Work page (D9) · passkey login (S3) · case-study/brand pipeline.
