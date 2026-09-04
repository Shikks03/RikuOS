# RikuOS — Concept & Rationale

**One-liner:** A personal agentic operating system for Riku — a small fleet of scheduled and event-driven Claude agents that run his freelance outreach pipeline, academics, and personal admin, surfaced through one mobile-first PWA dashboard, with every agent action passing through a human approval queue.

**Status:** Ideation complete (2026-08-28). This document is the foundation for implementation in Claude Code. It records every decision *with its reason*, so future sessions don't relitigate settled questions.

**Origin:** Inspired by Jack Roberts' "Claude Code Agentic OS… It self improves" (youtube.com/watch?v=MAuLQzcMrS0). What we kept from that pattern: skills as programs, subagents as processes, scheduled autonomy, and a self-improvement loop. What we rejected: the vagueness. RikuOS's self-improvement runs on measurable reply-rate data, not vibes.

---

## 1. The problem

- **The funnel has no memory.** Cold outreach goes out via the RIKU Facebook page Mon/Wed/Fri, but nothing records who replied. Follow-ups depend on manually scrolling the page inbox. ShikksTracker tracks email only — and most target clients (PH SMEs) live on Messenger, not email.
- **Follow-through is manual everywhere.** Lead sweeps run when Riku remembers. Client sites (AzeroTech, Meowchi) have no health monitoring. Outreach messages never improve because nothing measures which variants get replies.
- **Life admin is scattered.** Classes, modules/reviewers, projects, workouts, plans — no central surface.

RikuOS is **not a product**. It is personal infrastructure for one user, and secondarily a portfolio piece.

---

## 2. Architecture

Two applications plus an agent layer. Hub-and-spoke: RikuOS is the hub; ShikksTracker is the first spoke.

### 2.1 ShikksTracker (rebuilt) — the outreach engine & freelance data layer

Existing pipeline (kept): businesses list → campaigns (batched outreach) → blacklist → message generation → email send → status tracking.

Additions:

- **Messenger monitoring** of the RIKU Facebook page via a **dev-mode Meta app** subscribed to page webhooks. Incoming replies are logged automatically. Dev mode works because Riku is the page admin — no app review, no business verification.
- **Separate Email / Messenger tabs** — the two channels are never combined in one view.
- **Messenger draft-queue lane:** the system drafts the Taglish message; Riku copy-pastes and sends it from the page himself; one tap logs the send. (See Decision D2 for why this is permanent.)
- **API layer** exposing pipeline data to RikuOS (leads, campaigns, sends, replies, per-variant stats).
- **UI/UX restructure:** current tabs are cluttered, information is spread over large areas, too much scrolling. Fix density and information hierarchy. **Scope rule: restructure + new Messenger layer — not a from-scratch rewrite.** The working pipeline underneath is not touched unless a change requires it.

Database: **MongoDB** (already in place — see Decision D4).

### 2.2 RikuOS dashboard — the surface

New Next.js app. **Mobile-first PWA** (installed to iPhone home screen; iOS ≥16.4 supports web push). Single-user auth (one account, passkey or password). All tokens/secrets in environment variables, never in the DB. Not publicly usable.

Pages:

- **Personal** — projects currently being worked on; unified calendar with **toggleable layers** (Workouts, Plans, Classes, …); inbox triage summary; morning brief. Future: spending habits via GCash/Maya **statement import or receipt OCR** (Decision D7 — there is no consumer API).
- **Freelance** — the RIKU pipeline view, reading ShikksTracker's API. Queue of drafted messages, reply states, campaign stats, client-site health.
- **Academics** — courses/assignments/due dates pulled via **Canvas API with a personal access token** (confirmed available: Account → Settings → + New Access Token); manual area for modules/reviewers with per-course module counters; sentence-to-schedule AI planner.
- **Work** — future route only. Built when Riku is hired and the data source is known (Decision D9).
- **Approval Queue** — core UI, not a page afterthought. Every agent-proposed action lands here for one-tap approve / edit / reject. It is both the safety boundary (agents draft, Riku fires) and the training signal for the retro agent.

RikuOS's own data (academics entries, personal items, agent logs, approval queue): **MongoDB**, one Atlas account for everything.

### 2.3 The agent layer — what makes it an OS

Agency = the system acts first, on triggers, within delegated authority, then reports. Voice and dashboards are input/output; these are the OS:

| # | Agent | Trigger | What it does | Runtime |
|---|-------|---------|--------------|---------|
| 1 | Follow-up chaser | Time + data state | "Replied to nobody in 4 days" → drafts follow-up → queue | Vercel cron + API |
| 2 | ~~Lead sweep~~ | — | **Dropped 2026-08-30 — see `ARCHITECTURE.md` S8.** Lead acquisition is not a RikuOS job; prospecting stays manual. | — |
| 3 | Inbound Messenger triage | Page webhook event | Inside legal 24h window: ~~acknowledge~~, answer FAQs, propose call times — **all drafted, none auto-sent.** The acknowledgment carve-out was revoked 2026-09-04, see S14 | Vercel function + API |
| 4 | Site health monitor | Threshold | ~~Uptime/SSL/domain checks → drafts client email~~ **Narrowed 2026-08-30 to uptime only, notify only** — SSL and domain expiry are Vercel's to renew, not Riku's, and a flaky check would draft an embarrassing client email. See `ARCHITECTURE.md` §2.3 and P5a-5/9/10 | Vercel cron + API |
| 5 | Morning dispatcher | Schedule | Compiles "what needs you today" across all pages → push notification | Vercel cron + API |
| 6 | Retro agent | Weekly schedule | Reads reply rates per message variant/niche → proposes edits to outreach skills | Claude scheduled task |
| 7 | Watchdog | Anomaly | Detects dead webhooks / failed tasks → retries → alerts | Vercel cron |

**Runtime split rule:** if the work needs a *skill* (rubrics, Taglish drafting style, retro edits to skills), it runs as a Claude scheduled task on the subscription. If it needs only a *prompt plus data*, it runs as a Vercel cron job calling the Anthropic API directly (estimated under $2/month at current volume).

**Notifications:** Web push from the PWA to the iPhone lock screen.

---

## 3. Decisions log — settled, with reasons. Do not relitigate.

- **D1 — No n8n.** For a single user who codes, n8n's value (visual editing, prebuilt integrations, credential UI) solves problems Riku doesn't have; cron + serverless + scheduled tasks cover the need with less infrastructure. Its learning value is already covered by his StellarPH interview prep. Cost of a wrong keep: a plumbing project instead of an OS.
- **D2 — Cold Messenger sends stay manual, permanently.** Meta policy: the API only allows messaging users who message the business first, within a 24-hour window. No compliant cold-send automation exists; browser-automation workarounds risk banning the RIKU page and personal account — business assets. Inbound automation *within* the 24h window is legal and is agent #3.
- **D3 — Click/view tracking deprioritized.** With the reply webhook in place, replies are the true signal; clicks were a proxy for opens. Messages are generated in-system, so per-lead links can be added later cheaply. Nice-to-have, not v0.
- **D4 — MongoDB everywhere; no Postgres.** ShikksTracker already runs Mongo, and the retro loop's data lives there regardless of what the OS uses — a Postgres OS DB wouldn't help analyze Mongo data. At this scale (hundreds of rows), aggregation pipelines or in-memory computation suffice. Never migrate a database during a rebuild. *Revisit only if analytics outgrows aggregation pipelines.*
- **D5 — Calendar: two-way behavior via write-through; Google Calendar is the single source of truth.** The OS stores no events: it reads GCal live and writes new events into GCal. Behaviorally identical to two-way sync with zero conflict resolution. Each toggle layer = a real Google sub-calendar (Workouts, Plans, Classes — the Classes calendar auto-populated from Canvas). Bonus: layers also work in the native GCal app. A true two-copy sync engine was rejected as the single hardest, least valuable item on the board.
- **D6 — PWA + iOS web push.** Supported since iOS 16.4; works on the iPhone 13 Pro Max. No native app needed.
- **D7 — GCash/Maya spending: statement import / receipt OCR, never "API".** Their APIs are merchant payment-acceptance products; no consumer transaction API exists and PH open banking isn't there yet. Future feature parses exported transaction-history statements or OCRs receipts (Riku has prior OCR experience).
- **D8 — Voice is a v2 input layer, not the agentic part.** Push-to-talk commands via the Web Speech API are cheap QoL. Always-listening wake-word assistant: rejected as a project-eating rabbit hole. Voice ultimately becomes another way to say "approve."
- **D9 — Work page parked until hired.** Data source depends entirely on the future employer's tools. A page ships only when a real feed exists — empty tabs are how dashboards die.
- **D10 — Dashboard is built last.** Data layer → brains → UI. A pretty shell with nothing real to display is how these projects stall.
- **D11 — Page gating rule (general form of D9):** every page must be fed by data that arrives without Riku typing it in — Personal (Gmail/GCal), Freelance (ShikksTracker API), Academics (Canvas token). Manual entry is allowed only as a *supplement* with a specific job (modules/reviewers), never as a page's sole content.

---

## 4. Build order

1. **ShikksTracker restructure** — UI/UX density fix, Messenger webhook + Email/Messenger tabs, send-log lane, API layer. *Everything downstream eats this data.*
2. **Follow-up chaser** — first Vercel cron + Approval Queue (minimal version can be a simple list view before the full dashboard exists). *First moment the OS works while Riku sleeps.*
3. **Site health monitor + watchdog + morning digest** — health checks and heartbeat alerts. (The lead sweep that shared this step was dropped 2026-08-30 — see `ARCHITECTURE.md` S8.)
4. **Retro agent** — weekly reply-rate scoreboard → proposed skill edits (always via approval).
5. **RikuOS dashboard** — PWA with Personal + Freelance + Academics pages, Approval Queue as first-class UI, web push, calendar write-through.
6. **v1+ (deferred):** voice commands, spending import, case-study/brand pipeline, per-lead click links, Work page.

**Proposed v0 finish line** (not yet ratified by Riku): the chaser catches one *real* missed follow-up and the drafted message goes out — the first concrete proof the OS pays rent.

---

## 5. Risks

- **"Rebuild" becomes rewrite.** Highest-probability failure. Mitigation: D4's no-migration rule, restructure-only scope, pipeline untouched.
- **Webhook fragility.** Dev-mode Meta apps have quirks (token expiry, page-role dependency). Mitigation: agent #7 (watchdog) exists precisely for this; build it early, not last.
- **Agent sprawl / silent cost creep.** Mitigation: every agent passes through the Approval Queue; the runtime split rule caps API spend; watchdog reports failures instead of silent retries forever.
- **Dashboard-first temptation.** Mitigation: D10 is a hard ordering rule.
- **Motivation cliff after step 1.** The tracker rebuild is the least novel step. Mitigation: step 2 immediately follows and is the first "it worked while I slept" dopamine hit.

---

## 6. Killed — with cause of death

- **n8n** — inefficient for one coder; learning covered elsewhere (D1)
- **Application-monitoring career agent** — empties the moment one offer lands
- **Generic to-do manager** — rebuilding Todoist badly
- **Always-listening voice assistant** — rabbit hole (D8)
- **Postgres** — see D4
- **True two-way sync engine** — see D5
- **"GCash/Maya API"** — doesn't exist for consumers (D7)
- **Automated cold Messenger sends** — Meta policy; account risk (D2)

## 7. Open items

- ~~v0 finish line needs Riku's explicit ratification (§4).~~ **Resolved** — ratified as S1 on 2026-08-28 and reached on 2026-08-29 (`ROADMAP.md`, P4).
- ~~Personal/Freelance page layouts to be designed properly (use the design-loop process)~~ — **Resolved 2026-09-04.** "The design-loop process" was never defined anywhere: `ROADMAP.md` pointed here for it and this line pointed back. **S11 and S12** in `ARCHITECTURE.md` §7 replace it. In short: each page's *content and structure* is discussed with Riku at the start of its own phase, and *visual identity* is settled once, after the first real page ships, rather than in one pass at the very end. This document still specs content, not visual design — that part stands.
- Name "RikuOS" may change; keep it out of hardcoded strings. **Still open.**
- Retro agent's edit-approval flow details (how a proposed skill edit is diffed and accepted) — design during step 4. **Still open**, now P7.

---

*Prepared with Claude (Cowork), 2026-08-28. Sources for policy claims: Meta Messenger Platform policy (developers.facebook.com), Canvas LMS REST API docs, iOS 16.4 web push release notes.*
