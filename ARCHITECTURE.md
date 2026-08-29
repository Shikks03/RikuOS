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
| 3 | Inbound Messenger triage | Page webhook event | Vercel function (RikuOS) | Inside the legal 24h window: acknowledge, answer FAQs, propose call times. Substantive replies go through the queue |
| 4 | Site health monitor | Cron threshold | Vercel cron (RikuOS) | Uptime/SSL/domain checks on client sites (AzeroTech, Meowchi) → drafts client email on issues |
| 5 | Morning dispatcher | Daily cron | Vercel cron (RikuOS) | Compiles "what needs you today" across all sources → one push notification |
| 6 | Retro agent | Weekly | Claude scheduled task | Reads per-variant reply rates + queue decisions → proposes message-variant edits (via queue) |
| 7 | Watchdog | Cron | Vercel cron (RikuOS) | Heartbeat checks on webhook freshness and agent runs → push alert on anomaly. Built early (risk mitigation), not last |
| 8 | Outreach pipeline monitor | Daily cron | Vercel cron (RikuOS) | Reads OS API `summary` → alarms on a stalled ShikksTracker send engine and on approved messages stranded by it. Added 2026-08-30 on evidence: the engine had been silently still for 29 days with two approved follow-ups undelivered, and nothing was watching. Deliberately a separate job from the watchdog, so a ShikksTracker outage fails this row rather than discrediting the watchdog's verdict on RikuOS's own agents |

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
| Meta Messenger Platform | ShikksTracker (webhook in), triage agent (send within 24h window) | Dev-mode app: verify token, app secret (signature), page token | Dev mode suffices — Riku admins the page. Cold sends stay manual forever (D2) |
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

**Watchdog:** cron → checks `AgentRun` freshness per agent schedule + OS-API-reported webhook `lastEventAt` + a Graph API ping → any anomaly → push alert with a one-line diagnosis. Alerts on failure; never retries forever.

---

## 6. Security model

- Single user. Every RikuOS page and API behind password session auth (ported pattern: `__Host-` HMAC cookie, timing-safe compares, Origin checks on mutations, fail-closed middleware with explicit public allowlist).
- Cron endpoints gated by `x-cron-secret`; OS API by `x-os-secret`; Meta webhook by signature verification. All compares timing-safe.
- Secrets live in environment variables only, never in the database (concept rule). `.env.example` documents names, never values.
- The Approval Queue is the authorization boundary for agent actions: agents draft; only a human tap executes (single exception: triage's bounded in-window auto-acknowledgments, ratified in the concept).

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
  - **Scope of the cut is narrow.** Only lead *acquisition* leaves. The rest of the freelance side is unchanged: the chaser (P4) still drafts follow-ups, site health still watches client sites, and the Freelance page (8.1) still ships. This is not a retreat from D11 or from freelance generally.
  - **Three facts found while scoping it, kept because they explain the cost of ever reversing this.** (a) No prospecting skill exists; the real prospecting tool is the Maps Lead Scraper Chrome extension, which by its own README is *"manual, human-in-the-loop — nothing runs on its own"* and works by scrolling Google Maps while Riku browses. A 4 a.m. cloud task has no browser and no session. (b) ShikksTracker's OS API exposes only `summary`, `attention`, `variant-stats` and `drafts`; `POST /api/contacts/import` is login-cookie authed, so no agent-callable import exists. Reviving the sweep would need a new OS-API endpoint — a ShikksTracker contract change (S4), never a change made from here. (c) The `AgentRun` → morning-digest reporting half was the only piece buildable in this repo today.
  - **What stays unsolved, on purpose.** Concept §1 named *"Lead sweeps run when Riku remembers"* among the problems the OS would fix. It is not fixed and will not be. Recorded so the concept is not read later as having quietly achieved it.

---

## 8. Risks (delta to concept §5)

Concept risks stand. Additions from the codebase audit:
- **PSID↔contact matching is fuzzy by nature.** Mitigation: human-confirmed linking with suggestions; unlinked conversations are still visible and usable.
- **`sendOneLog`'s contact-status guard may block sends to `replied` contacts** (the chaser's whole audience). The deep spec flags this for verification in the executing session before the chaser ships.
- **Meta dev-mode token expiry** is the watchdog's founding use case; webhook `lastEventAt` is exposed through the OS API specifically so RikuOS can monitor a system it can't inspect directly.
- **An approved RikuOS draft can be destroyed inside ShikksTracker with no record, and RikuOS will still report it as done.** Found 2026-08-30 while investigating the stalled engine (read-only, S4). `src/lib/replyEffects.ts` there deletes every `draft`/`approved` log for a contact when a reply is detected, and the delete is *not* channel-scoped — one inbound Messenger message removes that contact's pending email drafts too. `suppressContact` does the same, and is reachable from the **public, unauthenticated** unsubscribe link. The chaser's audience is by construction contacts who have just replied, so RikuOS's own drafts are exactly the population at risk. RikuOS marks `actionStatus: done` once `POST /api/os/drafts` returns 201 and never re-reads the log, so a draft deleted afterwards looks delivered from here.
  - **Mitigation is a ShikksTracker contract change, not a fix from this repo** (prime directive). Recorded as a proposed change in the P2 handoff: a terminal `cancelled` status, or a `cancelledReason` stamp, instead of a destroying `deleteMany`.
  - RikuOS cannot currently detect it: `GET /api/os/summary` reports counts, not per-origin log status. Closing the loop would need the OS API to expose the state of `origin: "rikuos"` logs — a contract addition to weigh when the outreach monitor next earns work, not something to tunnel around.
