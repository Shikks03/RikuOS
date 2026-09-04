# CLAUDE.md — RikuOS working rules

Personal agentic OS for one user (Riku). Not a product; no multi-tenancy, no public signup, ever. Secondarily a portfolio piece — code quality matters, feature breadth does not.

Read `ARCHITECTURE.md` before structural work and `RIKUOS_CONCEPT.md` §3 before questioning any design decision — D1–D11 and S1–S7 are settled. Do not relitigate them.

## Stack & layout

- Next.js (App Router) + TypeScript `strict`. Path alias `@/*` → `src/*`.
- MongoDB Atlas via **Mongoose only** — no native driver calls.
- Deployed on Vercel. Cron agents are Vercel crons hitting secret-gated API routes.
- Mobile-first PWA. Keep UI plain and dense until its page's design work is due — no decorative work in logic phases (D10).
- **Page phases are content-first.** No page is planned or built until its contents have been discussed with Riku and followed up on — per page, at the start of that phase, never once up front for all of them (S11). Page *structure* (what is shown, what leads, what groups) is settled in that discussion; *visual* design follows S12's timing, not the old "all of it at the end" reading of D10.
- The product name may change: never hardcode "RikuOS" in user-visible strings; use the `APP_NAME` constant.

## Repo boundary — the prime directive

- **Never edit ShikksTracker's code from this repo.** Its changes happen in its own project (`../ShikksTracker`), in sessions running there. If work here seems to require a ShikksTracker change, stop and record the needed change as a proposed addition to its spec instead.
- **Never connect to ShikksTracker's database.** All freelance data comes through its `/api/os/*` endpoints with the `ST_API_SECRET`. If the API lacks a field you need, that's a contract change — document it, don't tunnel around it.

## Mongo schema patterns

Proven in ShikksTracker; follow them here.

- Every `String` field gets a `maxlength`. Every closed set is an `enum`. Dates are `Date`, never strings.
- **No `Schema.Types.Mixed`.** For per-type payloads (e.g. `ApprovalItem`), use Mongoose discriminators with typed, bounded fields. (ShikksTracker's `Mixed` run-summary drifted shapelessly across versions — that mistake is why this rule exists.)
- Declare `timestamps` explicitly per model (usually `{createdAt: true, updatedAt: false}`); add `updatedAt` only where updates are meaningful.
- Ephemeral records get TTL indexes (`AgentRun` 90 d, `LoginAttempt` 15 min). Approval decisions are **never** TTL'd — they are the retro agent's training data.
- Unique indexes on nullable fields must be `partial` (or `sparse`); a plain unique index on a nullable field breaks at the second null.
- Mongoose never *alters* an existing index. Any index change ships with a dry-run-by-default sync script (`npm run migrate:indexes` / `:apply` — port ShikksTracker's `sync-indexes.mts`).
- Connection: single cached promise on `global`, cleared on failure; `bufferCommands: false`; explicit timeouts; `strictQuery: true`; `autoIndex` off in production; require `mongodb+srv://` in production; never echo the URI in errors.
- Singletons (`OsSettings`) are accessed only through one accessor using `findOneAndUpdate({}, …, {upsert: true})`.
- State transitions use guarded atomic updates (`findOneAndUpdate` with the expected current state in the filter), never read-modify-write.

## Error handling rules

- **No silent failure, no infinite retry.** Every agent run writes an `AgentRun` record; failures produce a push notification. The human is the escalation path.
- **Never leave an in-flight state behind.** Any `pending`/`sending`-style status needs a sweep that returns stale rows to a safe state with a note.
- **Asymmetric failure semantics** — classify before retrying: failed *before* the side effect → safe to retry automatically; failed *after* (or unknown) → park for human verification. Never guess.
- **Alerts are queued and sent last** in any multi-step job, so a notification failure can never corrupt data state.
- API routes validate inputs at the top and return typed JSON errors with correct status codes; bounded query limits on every list endpoint.
- External calls (Meta, Anthropic, OS API, Canvas, GCal) get explicit timeouts and are wrapped so one provider's outage degrades one feature, not the app.

## Auth & secrets

- Port ShikksTracker's session pattern verbatim: `__Host-` HMAC-SHA256 cookie (Web Crypto, Edge-safe), constant-time compares with no short-circuit, login rate limiting (per-IP + global, Mongo-backed), fail-closed middleware with an explicit public allowlist, `requireSession` as the first line of every handler anyway (defense in depth), Origin check on mutations.
- `SESSION_SECRET` must never be derived from the password. Rotating it is the session-revocation lever.
- Cron routes: `x-cron-secret`, timing-safe. Push/webhook/OS-API secrets likewise.
- Secrets in env vars only — never in the database, never in code, never in logs. `.env.example` lists names and comments, never values.

## Verification before "done"

`npm test` (Vitest, logic layer) + `npx tsc --noEmit` + `npm run build` — all green before claiming completion. Tests live beside the logic (`src/lib/__tests__/`); route handlers stay thin so the logic layer holds the behavior. An agent feature is *actually* done when it has been observed doing its job once against real data.

## Never do

1. Never edit ShikksTracker code or connect to its DB from here (see prime directive).
2. Never automate cold Messenger sends, by API or browser automation — Meta policy; risks banning business assets (D2). Drafts only; the human sends.
3. Never let an agent execute an outward action without an approved `ApprovalItem` — the sole exception is Messenger triage's bounded auto-acknowledgment inside the 24-hour window.
4. Never store calendar events locally — Google Calendar is the single source of truth; read live, write through (D5).
5. Never build a dashboard page without a live data feed (D11); the Work page stays parked until hired (D9); UI comes after data + agents (D10).
6. Never introduce n8n or another workflow platform (D1), Postgres or a second database technology (D4), or a two-copy calendar sync engine (D5).
7. Never put a secret in the DB, in client-visible code, or in a log line.
8. Never use `Schema.Types.Mixed` or unbounded strings.
9. Never mark work complete without the verification trio passing.
10. Never relitigate D1–D11 or any ratified S-decision without an explicit new decision recorded in `ARCHITECTURE.md` §7.
11. Never plan or build a page phase before discussing its contents with Riku (S11), and never treat one page's discussion as covering the others.
