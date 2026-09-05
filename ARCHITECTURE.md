# RikuOS — System Architecture

**Ratified:** 2026-08-28 (spec session). Companion documents: `RIKUOS_CONCEPT.md` (ideation + decisions D1–D11), `CLAUDE.md` (working rules), `docs/ROADMAP.md` (phased tasks), and the ShikksTracker deep spec at `../ShikksTracker/docs/superpowers/specs/2026-08-28-rikuos-step1-messenger-api-variants-design.md`.

**One-liner:** A personal agentic OS for one user — scheduled and event-driven agents running the freelance outreach pipeline, academics, and personal admin, surfaced through a mobile-first PWA, with every agent action passing through a human Approval Queue.

---

## 1. Topology

Two applications, two repos, one MongoDB Atlas account with **two separate databases**. Hub-and-spoke: RikuOS is the hub; ShikksTracker is the first spoke.

```
┌────────────────────────────────┐          ┌─────────────────────────────────┐
│ ShikksTracker (existing repo)  │          │ RikuOS (this repo, new)         │
│ Next.js 16 · Mongoose · Vercel │          │ Next.js · Mongoose · Vercel     │
│                                │  HTTPS   │                                 │
│ Outreach engine & data owner:  │◄─────────│ Surface & brains:               │
│ · contacts/campaigns/logs      │  OS API  │ · Approval Queue (core UI)      │
│ · Gmail send + reply polling   │  (shared │ · Vercel cron agents            │
│ · NEW Messenger webhook        │  secret) │ · web push → iPhone             │
│ · NEW /api/os/* endpoints      │          │ · dashboard pages (built last)  │
│ · NEW variant tagging          │          │                                 │
└───────────────┬────────────────┘          └───────────────┬─────────────────┘
                │                                           │
        Atlas db: shikkstracker                     Atlas db: rikuos
                │                                           │
        Meta Page webhook ──► ShikksTracker         Claude scheduled tasks
        (RIKU Facebook page)                        (retro)
```

**Boundary rules (hard):**
- RikuOS never edits ShikksTracker code. ShikksTracker changes happen in its own repo, by sessions running there, guided by the deep spec document.
- RikuOS never connects to the `shikkstracker` database. All reads and actions go through ShikksTracker's `/api/os/*` endpoints, authenticated with a shared secret (`x-os-secret` header, timing-safe compare).
- Each app owns its database exclusively. No cross-database joins or shared collections.

---

## 2. Components

### 2.1 ShikksTracker (the outreach spoke)

Already a mature app: cold-email sequencing (stages 1–3, spacing `[0,5,9]` days), Gmail send with threading, reply polling with bounce/opt-out detection, suppression list, AI drafting (email + ≤60-word social DMs + phone scripts), manual outreach board for facebook/instagram/phone, hardened single-password auth. ~565 unit tests on the logic layer.

It gains four capabilities (specified in the deep spec; summarized here for the system view):

1. **Messenger reply logging.** A Meta dev-mode app subscribed to the RIKU page's webhooks delivers incoming messages to a new public endpoint. Senders arrive as anonymous PSIDs; conversations start "unlinked," get matched to contacts (name-similarity suggestions, one-tap human confirm), and thereafter auto-log: contact marked replied, sequence stopped, engagement bumped — same effects as an email reply. Echo events (messages Riku sends from the page) are recorded as outbound, so manual sends log themselves.
2. **Email / Messenger lane split.** `/review` stays the email lane. A new `/messenger` page combines the Facebook draft queue (copy → paste → mark sent) with the inbound conversation view. `/outreach` shrinks to instagram/phone. Density fix applied to redesigned screens.
3. **Variant tagging.** Every generated draft is tagged with a named message variant (prompt strategy). A stats endpoint aggregates reply rate per variant per niche. This is the retro agent's food.
4. **The OS API** (`/api/os/*`): summary, attention list, variant stats, and a draft-creation action endpoint. Detailed contract in §4.

### 2.2 RikuOS app (the hub — this repo)

New Next.js App Router app, TypeScript strict, Mongoose, deployed on Vercel. Mobile-first PWA installed to the iPhone home screen; web push to the lock screen (iOS ≥ 16.4). Single-user password auth using ShikksTracker's proven session pattern (HMAC-signed cookie, login rate limiting, fail-closed middleware); passkey/Face ID is a later upgrade.

**Approval Queue — the core surface, shipped first.** Every agent proposal lands here as an `ApprovalItem`. One-tap approve / edit / reject. Approving executes the item's action (e.g., create the draft in ShikksTracker). Every decision is retained — approvals, edits, and rejections are the retro agent's training signal. Stale items (e.g., a Messenger 24-hour window that closed) flip to `expired`, never linger.

**Dashboard pages — built last (D10), each gated on a live feed (D11):**
- *Freelance*: pipeline view over the OS API — queue, reply states, campaign stats, client-site health.
- *Personal*: current projects; unified calendar reading Google Calendar live with toggleable sub-calendar layers (Workouts, Plans, Classes); write-through event creation (D5 — GCal is the single source of truth, no local event storage); morning brief.
- *Academics*: Canvas API via personal access token (courses, assignments, due dates); manual modules/reviewers area with per-course counters; sentence-to-schedule planner.
- *Work*: parked until hired (D9).

### 2.3 Agent layer

| # | Agent | Trigger | Runtime | What it does |
|---|-------|---------|---------|--------------|
| 1 | Follow-up chaser | Daily cron | Vercel cron (RikuOS) | Finds leads who **replied but got no answer** in N days (via OS API attention list), drafts the response (Anthropic API), queues it for approval. *ShikksTracker's own engine already automates pre-reply cold-sequence follow-ups; the chaser owns the post-reply gap.* |
| 2 | ~~Lead sweep~~ | — | — | **Dropped 2026-08-30 — see S8.** Lead acquisition is not a RikuOS job. |
| 3 | Inbound Messenger triage | Page webhook event (forwarded) | Vercel function (RikuOS) | Inside the legal 24h window: **drafts** an acknowledgment, an FAQ answer or a call-time proposal. **Everything goes through the queue — nothing auto-sends (S14).** Sending is executed by ShikksTracker, which holds the page token (S9) |
| 4 | Site health monitor | Daily cron | Vercel cron (RikuOS) | **Uptime only** on AzeroTech, Meowchi and ShikksTracker → named in the morning digest. Scope cut on evidence during P5a: SSL and domain expiry dropped because all three hosts are `*.vercel.app` subdomains whose certificate and registration are Vercel's, not Riku's (P5a-9, P5a-10); drafting a client email dropped because a flaky check would produce an embarrassing draft (P5a-5). A down client site is a *finding*, not a failed run |
| 5 | Morning dispatcher | Daily cron | Vercel cron (RikuOS) | Compiles "what needs you today" → one push notification. **Currently freelance and system sources only** — the Today section was dropped for want of a to-do store (P5a-7) and returns in P10, which is how the Personal side reaches Riku at all (S13) |
| 6 | Retro agent | Weekly | Claude scheduled task | Reads per-variant reply rates + queue decisions → proposes message-variant edits (via queue) |
| 7 | Watchdog | Cron | Vercel cron (RikuOS) | Heartbeat checks on **RikuOS agent-run freshness only** → push alert on anomaly. Built early (risk mitigation), not last. Webhook freshness was originally scoped here and moved to agent 8 on 2026-09-04, because it needs an outbound call to ShikksTracker and the watchdog must stay independent of that repo's availability |
| 8 | Outreach pipeline monitor | Daily cron | Vercel cron (RikuOS) | Reads OS API `summary` → alarms on a stalled ShikksTracker send engine and on approved messages stranded by it. Added 2026-08-30 on evidence: the engine had been silently still for 29 days with two approved follow-ups undelivered, and nothing was watching. Deliberately a separate job from the watchdog, so a ShikksTracker outage fails this row rather than discrediting the watchdog's verdict on RikuOS's own agents. **Extended 2026-09-04** with Messenger webhook liveness once ShikksTracker's P2 shipped real `messenger` data (see S9) |

**Runtime split rule:** work that needs a *skill* (rubrics, Taglish drafting style, retro edits) runs as a Claude scheduled task on the subscription; work that needs only *prompt + data* runs as a Vercel cron calling the Anthropic API (~<$2/month at current volume).

---

## 3. Data

### 3.1 RikuOS database (`rikuos`)

v0 collections (all Mongoose, per the schema rules in `CLAUDE.md` — bounded strings, enums, no `Mixed`):

- **ApprovalItem** — `source` (agent enum), `type` (enum: `reply-draft` | `followup-draft` | `client-issue-email` | `triage-response` | `skill-edit`), `title`, `summary`, typed payload via Mongoose discriminators per type, `status` (`pending` | `approved` | `edited_approved` | `rejected` | `expired`), `staleAt`, decision metadata (`decidedAt`, `editedPayload`, `rejectNote`), action execution state (`actionStatus`: `pending` | `done` | `failed`, `actionError`, `actionAt`). Retained indefinitely (training data; rows are small).
- **AgentRun** — `agent`, `startedAt`, `durationMs`, `ok`, typed counts summary, `error`. TTL 90 days.
- **PushSubscription** — endpoint + keys for web push; multiple devices allowed.
- **OsSettings** — singleton (upsert pattern): per-agent enable toggles, chaser N-days threshold.
- **LoginAttempt** — ported rate-limit pattern, TTL 15 min.

Phase-8 collections (Academics manual area, Personal projects) are specified when those pages are built. Calendar events are **never** stored (D5).

### 3.2 ShikksTracker database (unchanged ownership)

Existing collections stay as they are. The deep spec adds: `MessengerConversation`, `MessengerMessage`, `Variant`, plus a `variantKey` field on `EmailLog` and an `origin` field for OS-created logs. Details live in the deep spec, not here — RikuOS must never depend on these shapes, only on the OS API contract below.

---

## 4. Integration contracts

### 4.1 ShikksTracker OS API (consumed by RikuOS)

All under `/api/os/*`, guarded by `x-os-secret` (env: `OS_API_SECRET` on ShikksTracker, `ST_API_SECRET` on RikuOS). Bypasses session auth via the same allowlist-plus-own-guard pattern as the cron routes. Bounded responses.

| Endpoint | Returns / does |
|---|---|
| `GET /api/os/summary` | Pipeline counts, per-campaign funnel, draft/approved counts, last engine-run health, Messenger webhook `lastEventAt` |
| `GET /api/os/attention` | The chaser's feed: replied-but-unanswered contacts (with reply snippet, last outbound body, keyPoints, campaign offer/tone — enough context to draft without a second call), hot leads, overdue next-actions |
| `GET /api/os/variant-stats` | Per-variant sent/replied counts and reply rate, sliceable by lead source / web-presence tier |
| `POST /api/os/drafts` | Creates a response draft in ShikksTracker for an approved queue item. Email drafts must thread into the existing Gmail conversation; facebook drafts land in the Messenger lane. Carries `origin: "rikuos"` provenance |

Contract stability rule: ShikksTracker may change its internals freely; these response shapes are the compatibility surface and change only deliberately, in both repos' docs.

### 4.2 External services

| Service | Used by | Auth | Notes |
|---|---|---|---|
| ~~Meta Messenger Platform~~ | **DROPPED (S15, 2026-09-05)** | — | Dev mode does NOT suffice: it delivers events only for role-holding accounts, so prospect DMs never arrive. The old line here read “Dev mode suffices — Riku admins the page”, which was true of the plumbing and misleading about the point. Publishing needs App Review, which needs business verification Riku will not do. Lane removed in both repos; D2 still binds |
| Anthropic API | Draft generation (both apps), cron agents | API key per app | Model pinned via env. **Must not be called from Vercel's `hkg1` region** — see below |
| Gmail API | ShikksTracker (existing send/poll) | OAuth refresh token | Unchanged |
| Google Calendar API | RikuOS phase 8 | OAuth (same Google Cloud project pattern) | Read live + write-through only (D5) |
| Canvas LMS API | RikuOS phase 8 | Personal access token | Read-only |
| Web Push (VAPID) | RikuOS notifications | VAPID keypair in env | iOS ≥ 16.4 PWA |

**Deployment region — do not "optimise" this back.** RikuOS deploys to **`sin1` (Singapore)**, not
`hkg1` (Hong Kong), even though `hkg1` is nearer Manila. The Anthropic API refuses requests
originating from Hong Kong with `403 forbidden — "Request not allowed"`. This is not an auth
failure; a bad key returns `401 authentication_error`. It cost P4 a failed first production run
(both leads, 2026-08-29) and is invisible locally, because a laptop in Manila reaches the API fine.
Any future latency tuning that moves a region must keep every function that calls Anthropic out of
`hkg1`. **ShikksTracker is still on `hkg1` and its `src/lib/draft.ts` also calls Anthropic — it will
hit this the first time cold-outreach drafting runs in production.** That fix belongs in its own
repo (S4).

---

## 5. Key flows

**Messenger reply → logged (ShikksTracker):** Meta POSTs event → signature verified → 200 returned immediately → message stored idempotently by `mid` → if conversation linked: reply effects applied (contact replied, sequence stopped, score +10) → appears in Messenger tab; if unlinked: appears with match suggestions awaiting one-tap confirm.

**Chaser → v0 finish line (RikuOS):** daily cron → `GET /api/os/attention` → for each replied-but-unanswered lead (capped per run): draft response via Anthropic API → `ApprovalItem` created → push notification → Riku taps approve (or edits) → `POST /api/os/drafts` → the draft is in ShikksTracker's lane → Riku sends (email batch-send or Messenger copy-paste). **v0 is done the first time this catches a real missed follow-up and the message goes out** (ratified 2026-08-28).

**Watchdog:** cron → checks `AgentRun` freshness per agent schedule → any anomaly → named in the morning digest. Alerts on failure; never retries forever. It makes **no network call to ShikksTracker**, deliberately: a ShikksTracker outage must not make the watchdog claim RikuOS's own agents are broken.

**Outreach pipeline monitor:** the same cron → one `GET /api/os/summary` → judges the send engine (`lastRunAt`, `lastRunErrors`, stranded approved messages) and the Messenger webhook's liveness (`messenger.lastEventAt`, silent 10+ days) → findings join the same digest. Webhook freshness lives here rather than in the watchdog because it depends on that outbound call. **The Meta Graph API token ping named in this document remains unbuilt — see S9.**

---

## 6. Security model

- Single user. Every RikuOS page and API behind password session auth (ported pattern: `__Host-` HMAC cookie, timing-safe compares, Origin checks on mutations, fail-closed middleware with explicit public allowlist).
- Cron endpoints gated by `x-cron-secret`; OS API by `x-os-secret`; Meta webhook by signature verification. All compares timing-safe.
- Secrets live in environment variables only, never in the database (concept rule). `.env.example` documents names, never values.
- The Approval Queue is the authorization boundary for agent actions: agents draft; only a human tap executes. **There is no exception.** Triage's in-window auto-acknowledgment was the one ratified carve-out and was revoked on 2026-09-04 (S14), making this boundary absolute.

---

## 7. Decisions

Concept decisions **D1–D11** (see `RIKUOS_CONCEPT.md` §3) remain binding and are not relitigated. Spec-session decisions added 2026-08-28:

- **S1 — v0 finish line ratified as proposed:** the chaser catches one real missed follow-up; the approved message goes out.
- **S2 — Two projects.** ShikksTracker stays its own repo; RikuOS (dashboard + cron agents) is this repo. Communication via OS API only.
- **S3 — Auth: password now, passkey later.** Port ShikksTracker's session implementation; WebAuthn is a post-v0 upgrade.
- **S4 — ShikksTracker work happens in its own repo/session.** This spec session produces documents only; the deep spec is handed to a session running there.
- **S5 — API endpoints over direct DB reads.** Rationale: schema freedom for ShikksTracker, one consistent door for reads and actions.
- **S6 — The chaser owns the post-reply gap.** ShikksTracker's engine already automates pre-reply sequence follow-ups; the chaser chases replied-but-unanswered leads — the hottest part of the funnel and today's real memory hole.
- **S7 — ShikksTracker cleanup rule: tidy what we touch.** Files edited for new features get split sanely; untouched working code stays untouched.

Added 2026-08-30:

- **S8 — The lead sweep is dropped. RikuOS does not acquire leads.** Roadmap 5.3 (and concept agent #2) proposed an M/W/F pre-dawn Claude scheduled task that would run prospecting skills and import qualified leads into ShikksTracker. It is cancelled, not deferred. Riku's call, 2026-08-30: *"I don't want to add a feature here to get leads. This OS is supposed to be for my personal life / personal use."* Prospecting stays a manual thing he does himself.
  - **Scope of the cut is narrow.** Only lead *acquisition* leaves. The rest of the freelance side is unchanged: the chaser (P4) still drafts follow-ups, site health still watches client sites, and the Freelance page (now P8) still ships. This is not a retreat from D11 or from freelance generally.
  - **Three facts found while scoping it, kept because they explain the cost of ever reversing this.** (a) No prospecting skill exists; the real prospecting tool is the Maps Lead Scraper Chrome extension, which by its own README is *"manual, human-in-the-loop — nothing runs on its own"* and works by scrolling Google Maps while Riku browses. A 4 a.m. cloud task has no browser and no session. (b) ShikksTracker's OS API exposes only `summary`, `attention`, `variant-stats` and `drafts`; `POST /api/contacts/import` is login-cookie authed, so no agent-callable import exists. Reviving the sweep would need a new OS-API endpoint — a ShikksTracker contract change (S4), never a change made from here. (c) The `AgentRun` → morning-digest reporting half was the only piece buildable in this repo today.
  - **What stays unsolved, on purpose.** Concept §1 named *"Lead sweeps run when Riku remembers"* among the problems the OS would fix. It is not fixed and will not be. Recorded so the concept is not read later as having quietly achieved it.

Added 2026-09-04:

- **S9 — RikuOS will not hold a second copy of the Meta page token. The Graph API ping becomes a ShikksTracker contract change.** §5 and the roadmap's task 5.1 both specified a direct Graph API ping as one of the watchdog's checks, deferred while ShikksTracker's P2 was unbuilt (design P5a-1). P2 shipped and the deferred half was picked up on 2026-09-04; the ping did not survive contact with the facts.
  - **Why a local copy is unsound.** ShikksTracker's `docs/meta-setup.md` states that generating a page access token in Meta's console **invalidates the previous one**, and treats regeneration as routine — the token is browser-derived and expires in roughly 60 days. A duplicate `META_PAGE_TOKEN` in RikuOS's env would therefore go dead every time Riku rotates the real one, and RikuOS would report an expired token while the live system was healthy. The check would fail in precisely the direction it exists to prevent, and it would fail on a maintenance action rather than on a fault. Riku's call, 2026-09-04, choosing this over copying the token.
  - **Two repos were each relying on the other.** `ARCHITECTURE.md` §8 calls Meta token expiry "the watchdog's founding use case", while ShikksTracker's `meta-setup.md` declines the durable fix — exchanging a long-lived user token for a non-expiring page token — on the grounds that it "buys little here **given the watchdog exists**." Neither half was true: nothing was checking the token. Recorded because the assumption is easy to re-make.
  - **What ships instead, and what it does not cover.** Webhook liveness: `summary.messenger.lastEventAt` advances on any Meta delivery, inbound or echoed, so an expired token freezes it. RikuOS alarms after **10 days** of total silence — Riku's threshold, chosen over 7 and 14 on 2026-09-04, calibrated against volume rather than uptime per ShikksTracker's own contract note that the page sees "a handful of messages a week". **It gives no advance warning of expiry** — the alarm fires up to *eleven* days after Meta stops delivering (the comparison is strict and the digest runs once daily), so detection trails the failure rather than preceding it. What that buys is that the gap is under a fifth of the token's ~60-day life, so an expiry is caught and regenerated inside the same cycle instead of surfacing when a lead complains they were ignored. It also cannot distinguish "token expired" from "nobody messaged the page". A direct token check is still worth having; it belongs in the repo that holds the token. Proposed as a contract addition (`messenger.tokenOk`, `messenger.tokenCheckedAt`) in `docs/handoffs/2026-09-04-meta-token-health.md`.
  - **The check lives in `outreachHealth.ts`, not the watchdog** — see the §5 flows. Webhook freshness needs an outbound call to ShikksTracker, and the watchdog's whole value is that its verdict on RikuOS's agents survives a ShikksTracker outage.

- **S10 — Nothing sends to a business until Riku says so, each time. Off is the default and the resting state.** Riku's standing instruction, 2026-09-04: *"I will not send to any businesses until I say so."* This governs both repos' outward paths — ShikksTracker's send engine switches, the chaser's approved drafts, and any future triage reply.
  - **The consequence for monitoring, which is the part that gets forgotten:** an engine that runs and sends nothing is CORRECT. Approved messages waiting are CORRECT. Neither is a stall, a backlog, or a gap, and no agent, digest line or session may report them as one, propose enabling a switch, or treat "no outreach left the building" as a finding. The existing silences already encode this — `stranded-approved` fires only beside a *stalled* engine, and a draft backlog is explicitly Riku's own business — and those silences are load-bearing, not incidental. Do not "fix" them.
  - **Testing an outward path never uses a business.** Any end-to-end test that must actually send is addressed to Riku himself — his own email address or his own Facebook account — set up as a test contact, never a real lead. This extends the existing practice: P4's acceptance ran against test contacts, and D2 already forbids automated cold Messenger sends outright.


- **S11 — P8 is five phases, and each page specs its own content when it starts.** P8 as written was three phases wearing one number: three unrelated acceptance bars where every other phase has one, two new external integrations with separate auth (Google, Canvas) where P2 and P4 each got a whole phase for one, tasks stacking three-to-four distinct features where a task elsewhere is a day, and 8.3 depending on 8.2 from inside the same phase. Split on Riku's call, 2026-09-04.
  - **The deeper fault was the spec, not the size.** `RIKUOS_CONCEPT.md` §7 says that document specs "*content*, not visual design" — but Personal and Academics get one bullet each in §2.2, so their content was never specced either. ShikksTracker's work had a deep spec; P5 got a design doc that then cut three specced features on evidence. These pages never had that pass, which is the same imbalance as their having no agents, surfacing somewhere else.
  - **Therefore: content is discussed per page, at the start of that page's phase** — never once up front for all of them, and never inferred from another page's discussion. Binding, and written into `CLAUDE.md`. Phase boundaries below are settled; page *contents* are deliberately not, and drawing them ahead of the discussion defeats the rule.
  - **Order and reasoning:** Freelance page first because it is the only one needing no new sign-in and the densest and most table-heavy, which is the hardest test a design system can face (S12); Personal before Academics because Academics' Classes layer needs Personal's calendar to exist.

- **S12 — Visual design: foundation after the first real page, polish at the end. Refines D10, does not overturn it.** D10's reasoning stands — "a pretty shell with nothing real to display is how these projects stall" — but reading it as *all* visual work at the very end put the largest, riskiest phase in the project last, across four pages at once, with layout choices made along the way liable to wholesale reversal. Riku's call, 2026-09-04.
  - **"UI" is two jobs on different clocks.** *Page structure* — what is shown, what leads, what groups, what order it reads in — is inseparable from content and is settled inside each page's content discussion (S11). *Visual identity* — type, colour, spacing, component vocabulary, motion — is done once, because applied piecemeal it yields pages that do not look related.
  - **So:** one real page ships plain (P8), then a focused foundation pass settles the system and is proven by rebuilding that page to it (P9). Every later page is built to the system, and the final phase is polish plus the re-review fixes rather than a four-page redesign.
  - **The "design-loop process" was a dangling reference** — `ROADMAP.md` pointed at concept §7 for it, and §7 said only "use the design-loop process", pointing back. Nothing defined it. S12 replaces it; the roadmap reference is removed rather than left circular.

- **S13 — The Personal side gets no new agents. The morning digest gains the Today section instead.** Riku's call, 2026-09-04, asked as "does it come to you or do you go to it". Chosen over giving Personal its own agents, and over leaving it a place to look. The machinery already runs daily; what it lacked was anything to say.
  - **This reverses P5a-7.** The digest's Today section was dropped because it needed a store of self-set deadlines that did not exist. The sectioned to-do store is therefore unparked from Deferred and folded into the Personal phase — it is the missing input, and it is likely also the source of truth the quest tracker has been blocked on.
  - **It is a supplement under D11, not a violation.** D11 requires every page to be fed by data arriving without Riku typing it, allowing manual entry "only as a *supplement* with a specific job". The Personal page is fed by Google Calendar; to-dos ride alongside with a specific job, exactly as modules/reviewers do for Academics. Recorded so a later session does not read the unparking as breaking D11 and undo it.
  - **Today needs both to-dos and the calendar** to be worth reading (Riku, asked directly), so Google sign-in and the live calendar read are inside the Personal phase, not after it. Canvas due dates are not required for Today and stay in the Academics phase.
  - **The calendar reads and writes from the first version.** Riku creating an event from the UI is *Riku* acting, so the approval queue does not apply — that boundary governs agents acting on his behalf. The Academics sentence-to-schedule planner is the one calendar writer that does go through the queue.


- **S14 — The approval queue has no exceptions. Messenger triage's auto-acknowledgment is revoked.** Riku's call, 2026-09-04, opening P6. The concept ratified one carve-out — triage acknowledging an inbound message itself, inside the legal 24-hour window — and `CLAUDE.md` carried it as "the sole exception". It is withdrawn. Every outward action now requires an approved `ApprovalItem`, without qualification.
  - **Why it was reopened rather than inherited.** The carve-out was ratified in August, before S10. D2 does distinguish inbound replies from cold outreach, and legally the in-window reply is fine — but it is still a message leaving Riku's business page, to a business owner, in wording he has not seen. That is the thing S10 exists to prevent, so the old ratification was put back to him rather than assumed to carry.
  - **What it costs, stated plainly:** someone messaging the page overnight hears nothing until Riku taps. The 24-hour window is a hard deadline set by Meta, so an unactioned draft can expire unsent — `staleAt` is therefore the window's close, not an arbitrary age. This makes the new-item push notification load-bearing rather than a convenience: it is the only thing that can get Riku's attention inside the window.
  - **What it buys:** one boundary with no special cases. The rule "an agent never acts without a tap" is now checkable by reading the code for a single pattern, and no future feature can cite an existing exception as precedent.

Added 2026-09-05:

- **S15 — The Facebook Messenger lane is dropped entirely, in both repos. P6 triage is deleted, not parked.** Riku's call, 2026-09-05. Advanced Access for `pages_messaging` requires Meta's App Review, and App Review requires business verification. "Riku" is a deliberate side thing with **no registered legal entity and no plan to register with DTI or SEC**, so publishing the app is permanently blocked rather than pending. Registration as a workaround is explicitly ruled out and is a standing constraint — do not re-propose it.
  - **What that means mechanically.** The app stays in Development mode, where Meta delivers webhook events only for accounts holding a role on it. Verified directly by the ShikksTracker session on 2026-09-05: a message sent to the Page from a second, role-less account produced **no conversation and no webhook event at all**. Real prospect DMs are therefore handled in Facebook's own Page inbox, as before, and no amount of code on either side changes that.
  - **The cut is deliberate and total, not a pause.** P6 shipped complete on 2026-09-05 (457 tests, deployed, live-verified) and is being deleted anyway, because its only input is inbound prospect DMs. Keeping working code with no possible input is worse than removing it: it invites a future session to "finish" or revive it, and it leaves live monitoring wired to a signal that can never move. The handoff `docs/handoffs/2026-09-04-p6-messenger-forwarding.md` is withdrawn — the two ShikksTracker contracts it requested are not to be built.
  - **THE NON-OBVIOUS PART, and the one most likely to be missed.** Deleting the webhook does **not** make RikuOS's health check safe; it makes it worse. `evaluateOutreach` in `src/lib/outreachHealth.ts` reads `summary.messenger.lastEventAt` and alarms in the daily digest. `readStamp` in `src/lib/stApi.ts` maps a **missing** `messenger` block to `null`, and the `null` branch is `webhook-never-fired` — "ShikksTracker reports no Messenger event, ever". So removing the block on ShikksTracker's side flips a *staleness* false alarm into a *never-fired* false alarm, still fired every single morning. The messenger branch of `evaluateOutreach`, its `WEBHOOK_SILENT_DAYS` constant, and the `messenger` field of `SummaryMessenger` must be removed from RikuOS in the same pass as the triage deletion. A daily false alarm in the one push Riku is meant to trust is precisely how P5's design says a monitor gets ignored.
  - **What is explicitly NOT affected.** The email engine end to end (drafting, sending, threading, tracking, replies, scoring, pipeline) never touches Meta. The phone and Instagram lanes were always AI-drafted and sent by hand. The rest of the `/api/os/*` contract stands. D2's "cold Messenger sends stay manual, permanently" is untouched and remains binding — S15 removes the inbound lane, it does not license outbound automation.
  - **If Meta's terms ever change**, this returns as a new decision here, and the deleted code is recoverable from git history at `55eb401` — it is not to be resurrected from a stale branch or a handoff file.

---

## 8. Risks (delta to concept §5)

Concept risks stand. Additions from the codebase audit:
- **PSID↔contact matching is fuzzy by nature.** Mitigation: human-confirmed linking with suggestions; unlinked conversations are still visible and usable.
- **`sendOneLog`'s contact-status guard may block sends to `replied` contacts** (the chaser's whole audience). The deep spec flags this for verification in the executing session before the chaser ships.
- **Meta dev-mode token expiry** is the watchdog's founding use case; webhook `lastEventAt` is exposed through the OS API specifically so RikuOS can monitor a system it can't inspect directly. **Partially closed 2026-09-04:** the outreach monitor now alarms on 10 days of webhook silence, which an expired token produces. The token itself is still not checked directly, and cannot be from this repo — see S9.
- **An approved RikuOS draft can be destroyed inside ShikksTracker with no record, and RikuOS will still report it as done.** Found 2026-08-30 while investigating the stalled engine (read-only, S4). `src/lib/replyEffects.ts` there deletes every `draft`/`approved` log for a contact when a reply is detected, and the delete is *not* channel-scoped — one inbound Messenger message removes that contact's pending email drafts too. `suppressContact` does the same, and is reachable from the **public, unauthenticated** unsubscribe link. The chaser's audience is by construction contacts who have just replied, so RikuOS's own drafts are exactly the population at risk. RikuOS marks `actionStatus: done` once `POST /api/os/drafts` returns 201 and never re-reads the log, so a draft deleted afterwards looks delivered from here.
  - **Mitigation is a ShikksTracker contract change, not a fix from this repo** (prime directive). Recorded as a proposed change in the P2 handoff: a terminal `cancelled` status, or a `cancelledReason` stamp, instead of a destroying `deleteMany`.
  - RikuOS cannot currently detect it: `GET /api/os/summary` reports counts, not per-origin log status. Closing the loop would need the OS API to expose the state of `origin: "rikuos"` logs — a contract addition to weigh when the outreach monitor next earns work, not something to tunnel around.
- **A running send engine is not a sending send engine — and that is a setting, not a fault.** Found 2026-09-04 while confirming ShikksTracker's hourly pinger now exists (`.github/workflows/sequence-pinger.yml`, commit `61d36bb`; `engine.lastRunAt` reads same-day after 29 days frozen). Both engine switches — `draftGenerationEnabled` and `sendingEnabled` — are `false` in the live Settings document, so the engine runs and sends nothing. **This is the expected state under S10 and must never be reported as a problem.** The monitor already behaves correctly here by construction: `stranded-approved` fires only alongside a stalled engine, so approved messages waiting beside a healthy one stay silent. Recorded so that a future session reading "engine healthy, nothing sent" does not mistake it for a gap to close. `GET /api/os/summary` exposes no toggle state, and it does not need to.
