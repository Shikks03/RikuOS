# P4 — Follow-up Chaser Implementation Plan (v0 finish line)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the follow-up chaser (ROADMAP.md P4, tasks 4.1–4.5): a daily Vercel cron that reads ShikksTracker's replied-but-unanswered feed, drafts a reply per lead with the Anthropic API, queues each as an `ApprovalItem`, and — on approval — creates the real draft in ShikksTracker through `POST /api/os/drafts`.

**Architecture:** RikuOS talks to ShikksTracker only through `/api/os/*` with `ST_API_SECRET` (never its database). The cron is a thin route over three pure logic modules: `stApi.ts` (the typed client and, critically, the failure classifier), `chaser.ts` (attention → queue-item planning), `draftFollowup.ts` (the Anthropic call). Approving an item runs a per-type action executor that performs exactly one outward side effect; the executor's job is to return a *classified* outcome, never to guess. P3's guarded-atomic-update discipline extends from the decision state machine to the action state machine: an action is **claimed** before it runs, so it can never run twice, and a claim that never completes is swept back to a human-visible parked state.

**Tech Stack:** Next.js 16.2.10 · React 19.2.4 · TypeScript strict · Mongoose ^9.7.3 · Vitest ^4.1.10 · `@anthropic-ai/sdk` ^0.110.0 · Vercel crons (region hkg1).

---

## Boundaries (hard rules from CLAUDE.md)

- **Never edit anything in `../ShikksTracker`, and never connect to its database.** Reading its code for reference is fine and this plan does so. Every field this plan needs already exists in the `/api/os/*` contract; the one gap found is recorded in "Contract gaps" below as a *proposed* spec addition, not worked around.
- No `Schema.Types.Mixed`; every `String` bounded; every closed set an `enum`.
- UI stays plain and dense — the visual pass is P8 (D10). The settings page this plan adds is a control surface, not a dashboard page; D11's live-feed rule is untouched.
- Never hardcode the product name — use `APP_NAME` from `src/lib/constants.ts`.
- Alerts are queued and sent **last** in every multi-step job.
- Done requires `npm test` + `npx tsc --noEmit` + `npm run build` all green (Task 15), **plus** the on-device acceptance test against real data (Task 17).
- D1–D11 and S1–S7 are settled. This plan does not reopen them.

---

## State that is not derivable from this repo

Established at plan time (2026-08-29); do not re-derive, and do not assume the opposite:

1. **P3 is COMPLETE and live** at `https://riku-os.vercel.app` (Vercel project `riku-os`, production branch `master`, region `hkg1`). Auth, the Approval Queue, web push and the expiry cron are all verified against real data. The Atlas database is `rikuos`; Network Access allows `0.0.0.0/0`.
2. **ShikksTracker's P1 is merged and pushed.** `feature/rikuos-step1-p1` was fast-forward merged into `main` (7 commits, tip `58c51cb`) and `origin/main` points at the same commit, so Vercel has built `/api/os/*`. **`OS_API_SECRET` is not yet set on ShikksTracker's Vercel Production**, so all four routes currently fail closed with **503**. Setting it is Task 1 and it is Riku's hands only.
3. **ShikksTracker's OS API contract lives at `../ShikksTracker/docs/os-api.md`** — on disk only (that repo gitignores `docs/`). It is the authority for the four endpoints. This plan reproduces every shape it needs, so no task requires reading it again.
4. **Env var names differ across the boundary.** The same secret value is `OS_API_SECRET` on ShikksTracker and `ST_API_SECRET` on RikuOS. ShikksTracker rejects a secret shorter than 32 characters with a 503, not a 401.

### The `ST_API_BASE_URL` trap

Crossing these two values fails as a **network error or a 404 HTML page**, not as an obvious config mistake — which is why they are written down here rather than left to inference.

| Where | Value | Why |
|---|---|---|
| RikuOS `.env.local` | `http://localhost:3000` | Local ShikksTracker. Both apps are Next.js and both default to port 3000, so **run ShikksTracker on 3000 and RikuOS on 3001** (`npm run dev -- -p 3001`). |
| RikuOS Vercel **Production** | ShikksTracker's production origin, e.g. `https://shikkstracker.vercel.app` | The deployed chaser must reach the deployed ShikksTracker. |

Two matching traps that come with it:

- `APP_BASE_URL` in RikuOS `.env.local` must be `http://localhost:3001` (the port RikuOS actually serves on), or `requireSession`'s Origin check rejects every mutation from the browser with a 403.
- If `ST_API_BASE_URL` in `.env.local` points at production while `ST_API_SECRET` holds a stale value, every call returns **401** — that is the *secret* being wrong, not the URL. A **503** means the secret is unset or under 32 chars on ShikksTracker's side. A connection refused means the URL/port is wrong. Read the three apart before changing anything.

### Two P1 findings that constrain this design

**Finding 1 — the narrow send permit for `replied` contacts.**
`../ShikksTracker/src/lib/sendGuards.ts::isSendableContactStatus` blocks sends to any contact whose status is not `active`, with one narrow exception: `replied` is sendable only when the log carries `origin: "rikuos"` **or** a `replyToLogId`. `paused` / `bounced` / `unsubscribed` are never sendable and there is no override.

The chaser's entire audience is `replied` contacts, so this matters absolutely. **It is satisfied by construction**: `createOsDraft` hard-codes `origin: "rikuos"` on every log it creates, so anything created through `POST /api/os/drafts` carries the marker whether or not we send an anchor. This plan sends `replyToLogId` anyway, for two independent reasons that are *not* the permit:

1. it is the Gmail threading anchor (`In-Reply-To`, `References`, `threadId`);
2. it is the dedup key behind ShikksTracker's **409** response, which is what makes a retry safe (see the failure contract below).

A draft with neither marker is silently reverted to `draft` status and never sent. That failure is invisible from RikuOS — hence the belt-and-braces.

**Finding 2 — a LOAD-BEARING ACCIDENT. Do not "fix" it.**

> `../ShikksTracker/src/lib/os/drafts.ts::resolveOsDraftStage` stamps the new log with the stage **inherited from the anchor**, which is always at or below `contact.currentStage`. `advanceContactAfterSend` only writes when `currentStage < log.stage`. The inherited stage therefore makes the post-send advance a guaranteed no-op, and **that no-op is the only thing preventing a replied contact from being re-entered into the cold outreach sequence.**
>
> Read on its own, `advanceContactAfterSend`'s monotonic guard looks like dead code — a condition that is never true. It is not dead. Removing it, or "simplifying" `resolveOsDraftStage` to use the contact's current stage, would cause an answered lead to start receiving scheduled cold touches again.
>
> Both files are in ShikksTracker and this repo must never edit them. The note exists so that a future session working *there* has this written down somewhere, and so nobody in *this* repo tries to compensate for it.

### Contract gaps found (proposed additions to ShikksTracker's spec — do not tunnel around them)

`GET /api/os/attention`'s `repliedUnanswered` items do **not** carry the anchor log's `subject`. RikuOS therefore cannot show Riku the subject line an email follow-up will actually use, and cannot generate a matching one.

This plan does not work around it. It omits `subject` from the `POST /api/os/drafts` body entirely, which makes `deriveOsDraftSubject` produce `Re: <anchor subject>` server-side — correct threading, at the cost of the queue card not displaying the subject for email items.

**Proposed addition to ShikksTracker's spec** (to be handed to a session running in that repo, per S4): add `anchorSubject: string | null` to each `repliedUnanswered` item, alongside the existing `stage` and `replyToLogId`. It is already loaded — `buildOsAttention` selects logs without `subject`, so this is one field in one `.select()` plus one line in `selectRepliedUnanswered`. Until then the omission above is the correct behaviour, not a bug.

---

## What P3 already built — use it, do not rebuild it

| Thing | Where | P4's use |
|---|---|---|
| `ApprovalItem` base + `followup-draft` discriminator | `src/models/ApprovalItem.ts`, `src/models/approvals/FollowupDraftApproval.ts` | Task 4 adds `replyToLogId` to the payload and widens the action-status enum. Nothing is replaced. |
| `parseDecision` / `buildDecisionUpdate` / `buildExpirySweep` / `approvalModelForType` | `src/lib/queue.ts` | Reused as-is except `parseDecision`'s explicit field copy (Task 5) and `runApprovalAction` (Task 6). |
| **`approvalModelForType` is mandatory for per-type writes** | `src/lib/queue.ts:185` | A per-type field written through the base model is silently stripped by Mongoose update casting. Every write touching `payload`/`editedPayload` goes through the resolved model. |
| `AgentRun` (TTL 90 d) | `src/models/AgentRun.ts` | Task 4 widens `counts`; the chaser writes one record per run. |
| `sendPushToAll` / `buildPushPayload` | `src/lib/push.ts` | Task 10 sends the new-items push **last**. |
| `OsSettings.chaserEnabled` (default `false`), `chaserNDays` (default 4, 1–30) | `src/models/OsSettings.ts`, `src/lib/osSettings.ts` | Already exist. Task 11 wires a UI to them; Task 10 gates on them. |
| `requireCronSecret` (accepts `x-cron-secret` **or** Vercel's `Authorization: Bearer`) | `src/lib/auth.ts` | Guards `/api/cron/chaser`. `/api/cron/*` is already in `src/proxy.ts`'s public allowlist — **no proxy change is needed in P4.** |
| `sync-indexes.mts` (dry-run by default) | `scripts/sync-indexes.mts` | Task 4 adds two indexes; Task 14 runs the migration. |
| DB-less test convention | `src/lib/__tests__/` | Every test in this plan is DB-less: pure functions, `validateSync()`, update-shape builders, and a stubbed `globalThis.fetch`. **Do not introduce a test that needs a live MongoDB.** |

---

## THE DESIGN DECISION — the action-execution failure contract

`runApprovalAction` (`src/lib/queue.ts:216`) currently registers `followup-draft` as a deliberate no-op. Task 7 replaces that body with a real `POST /api/os/drafts`. From that moment a mis-classified failure is **a duplicate message to a real client**, so the contract is settled here rather than discovered live.

### The defect being fixed

Today `runApprovalAction` runs the executor **unconditionally** and guards only the *recording* of the outcome (`{_id, actionStatus: "pending"}`). Two consequences:

1. Any second invocation performs the side effect again, then silently fails to record it — the guard no longer matches.
2. If the lambda dies between a successful `fetch` and the `updateOne`, the item stays `actionStatus: "pending"` forever with a real draft already created in ShikksTracker. Anything that later re-runs "pending" actions creates a second message to the lead.

While the executor was a no-op this was harmless. It is not harmless from Task 7 onward.

### The fix, in two parts

**Part 1 — claim before executing.** The action state machine gains two states and a claim timestamp:

```
pending ──claim (guarded)──► running ──┬──► done                (side effect confirmed, or already existed)
                                       ├──► failed              (server refused; PROVABLY no side effect)
                                       └──► needs_verification  (side effect may or may not have happened)

running ──stale >10 min, sweep──► needs_verification   (the lambda died mid-flight)
failed  ──retry (guarded)──────► pending               (only from `failed`, never from needs_verification)
```

The claim is `findOneAndUpdate({_id, actionStatus: "pending"}, {$set: {actionStatus: "running", actionStartedAt: now}})`. A lost claim returns without running the executor. **The executor now runs at most once per claim, which is the property the old code lacked.** A `running` row that never resolves is swept to `needs_verification` with a note (CLAUDE.md: never leave an in-flight state behind).

**Part 2 — classify, never guess.** `stApi.createDraft` is **total**: it never throws, and every path returns one of four kinds. The mapping is exhaustive and each row states *why* the side effect is known or unknown.

| What came back | Kind | `actionStatus` | Why |
|---|---|---|---|
| HTTP **201** | `created` | `done` | ShikksTracker returns the created log. Unambiguous. |
| HTTP **409** | `duplicate` | `done` | "A pending reply to that message already exists." The desired end state already holds — a second draft would be the duplicate. **This row is what makes retry safe.** |
| HTTP **400 / 404 / 422** | `rejected` | `failed` | Every early return in `createOsDraft` happens *before* `EmailLog.create`. The server decided not to act; nothing was written. Retry-safe (and retry becomes meaningful once Riku fixes the cause). |
| HTTP **401 / 503** | `rejected` | `failed` | `requireOsSecret` returns before the handler body. Config problem, no side effect. |
| Any **5xx** | `unknown` | `needs_verification` | The handler threw, or Vercel's edge timed out *after* the function completed. Cannot distinguish. |
| Any other status | `unknown` | `needs_verification` | An unmodelled response is not evidence of anything. |
| **201 with unparseable body** | `created` (`logId: null`) | `done` | The status code already proves creation; the body is only for the log id. |
| `fetch` threw, `cause.code` ∈ `ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`, `ERR_INVALID_URL`, `CERT_HAS_EXPIRED`, `DEPTH_ZERO_SELF_SIGNED_CERT` | `rejected` | `failed` | Positive proof the connection was never established, so the request was never delivered. |
| `fetch` threw anything else — `AbortError` (our timeout), `ECONNRESET`, socket hang-up, unrecognised cause | `unknown` | `needs_verification` | The request may have been delivered and processed with the response lost. **Default to unknown**: only *positive proof of safety* downgrades to `failed`. |
| Missing/short `ST_API_BASE_URL` / `ST_API_SECRET` | `rejected` | `failed` | Config is validated before any network call. |
| Executor threw (a bug) | — | `needs_verification` | Defensive. `createDraft` is total, so this should be unreachable; if it is reached, we know nothing. |

**The invariant:** `failed` means *proven no side effect* and is the only state the Retry affordance accepts. `needs_verification` means *we do not know* and is never retried automatically or by a button — Riku checks ShikksTracker's lane first. Nothing in this system ever guesses which one happened.

---

## Decisions taken at plan time

| # | Decision | Rationale |
|---|---|---|
| P4-a | **Channels: `email` and `facebook` only.** `DRAFT_CHANNELS` is unchanged. Attention items on `instagram`/`phone` are skipped and **counted** in the `AgentRun` record. | Chosen by Riku. Skips are counted, never silent (CLAUDE.md: no silent failure). |
| P4-b | **A separate `/settings` page**, plus `GET`/`PATCH /api/settings`. | Chosen by Riku. It is a control surface (the agent's kill switch), reachable from the phone; not a dashboard page, so D10/D11 are untouched. |
| P4-c | **Retry button on `failed` items only.** `needs_verification` items get the error text and an explicit instruction, plus a documented CLI escape hatch (`npm run action:resolve`) so the state is never a dead end. | Chosen by Riku. Follows the failure contract exactly. |
| P4-d | **`replyToLogId` is required** on every chaser-created payload; an attention item without one is skipped. | It is the threading anchor and the 409 dedup key. Without it, retry safety and Gmail threading both disappear. The API always supplies it. |
| P4-e | **Idempotency is enforced twice**: a query-layer skip (an anchor with a live item in `pending`/`approved`/`edited_approved`) *and* a unique partial index on `{payload.replyToLogId}` where `status: "pending"`. | ShikksTracker's attention feed only self-dedups *after* a draft exists there — i.e. after Riku approves. Between creation and approval the lead still appears in the feed every day. Rejected and expired items deliberately do **not** block a fresh proposal: Riku rejected the wording, not the lead. |
| P4-f | **The unique index is declared on the BASE schema** (`ApprovalItem.ts`) even though `payload.replyToLogId` lives on the discriminator. | `sync-indexes.mts` iterates base models, and `syncIndexes()` **drops any index it does not see declared**. An index declared on a discriminator schema would be created and then dropped on the next migration. Never declare an index on a discriminator schema in this repo. |
| P4-g | **Model: `ANTHROPIC_MODEL ?? "claude-opus-5"`**, `output_config: {effort: "low"}`, thinking left **on**. | Pinned via env per ARCHITECTURE.md §4.2. Effort `low` keeps cost near the concept's "<$2/month" while avoiding the documented failure mode where a thinking-disabled model writes a tool call into visible text instead of emitting a `tool_use` block — exactly the shape this code depends on. Switch the env var to a cheaper model if the bill says so; that is a config change, not a code change. |
| P4-h | **Forced tool use, no `strict: true`**, with explicit runtime validation of the returned input. | Mirrors `../ShikksTracker/src/lib/draft.ts`, which is proven against this account and these prompts. Zero new API surface to get wrong. |
| P4-i | **Wall-clock budget inside the cron**, not just a lead cap. | Up to 5 sequential Anthropic calls can exceed a 60 s function. The loop stops *starting* new drafts past 45 s and counts the remainder as skipped, so a slow run degrades to "fewer items" rather than a truncated function with no `AgentRun` record. |

---

## File structure

```
RikuOS/
├── package.json                       # MODIFY: + @anthropic-ai/sdk, + action:resolve script
├── vercel.json                        # MODIFY: + the chaser cron (2 crons total — the Hobby ceiling)
├── .env.example                       # MODIFY: uncomment the three P4 vars, + ANTHROPIC_MODEL, + the base-URL trap
├── scripts/
│   ├── sync-indexes.mts               # unchanged (already iterates every model)
│   └── resolve-action.mts             # NEW: escape hatch out of needs_verification
└── src/
    ├── lib/
    │   ├── stApi.ts                   # NEW: the ONLY door to ShikksTracker + the failure classifier
    │   ├── draftFollowup.ts           # NEW: prompts + the Anthropic call
    │   ├── chaser.ts                  # NEW: attention → queue-item planning (pure)
    │   ├── settings.ts                # NEW: PATCH body validation (pure)
    │   ├── queue.ts                   # MODIFY: claim/outcome/sweep builders, real executor, replyToLogId in edits
    │   └── __tests__/
    │       ├── stApi.test.ts          # NEW
    │       ├── chaser.test.ts         # NEW
    │       ├── draftFollowup.test.ts  # NEW
    │       ├── settings.test.ts       # NEW
    │       ├── queue.test.ts          # MODIFY: + claim/outcome/sweep + anchor-survives-edit
    │       └── models.test.ts         # MODIFY: + replyToLogId, action statuses, run counts
    ├── models/
    │   ├── ApprovalItem.ts            # MODIFY: action statuses, actionStartedAt, 2 indexes
    │   ├── AgentRun.ts                # MODIFY: counts gains itemsSkipped / itemsFailed
    │   └── approvals/
    │       └── FollowupDraftApproval.ts   # MODIFY: payload.replyToLogId
    └── app/
        ├── settings/page.tsx          # NEW
        ├── queue/page.tsx             # MODIFY: retry button, new statuses, link to /settings
        └── api/
            ├── settings/route.ts      # NEW: GET + PATCH
            ├── cron/chaser/route.ts   # NEW
            ├── cron/expire/route.ts   # MODIFY: + the stale-action sweep
            └── queue/[id]/retry/route.ts   # NEW
```

**Environment variables added in P4** (all three required in **both** `.env.local` and Vercel Production): `ST_API_BASE_URL`, `ST_API_SECRET`, `ANTHROPIC_API_KEY`. Optional: `ANTHROPIC_MODEL`.

---

### Task 1: 🙋 RIKU — bring ShikksTracker's OS API online

**This task is Riku's hands only. No code in this repo changes.** Tasks 2–15 can be written and tested without it; Task 17 (acceptance) cannot start until this is green.

- [ ] **Step 1: Generate the shared secret** (once — the same value goes on both sides)

PowerShell:

```powershell
-join ((1..32) | % { '{0:x2}' -f (Get-Random -Max 256) })
```

That produces 64 hex characters. Keep it in the password manager; it is never committed anywhere.

- [ ] **Step 2: Set it on ShikksTracker's Vercel project**

Vercel dashboard → the **ShikksTracker** project → Settings → Environment Variables → add `OS_API_SECRET` = the value from Step 1, scope **Production**. Then Deployments → the latest production deployment → **Redeploy** (env vars are baked at build time; without a redeploy the routes keep returning 503).

- [ ] **Step 3: Verify production serves the API**

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "x-os-secret: <the secret>" \
  "https://<shikkstracker-prod-host>/api/os/summary"
```

Expected: `200`.
If `503` → the env var is unset, under 32 chars, or the redeploy has not finished.
If `401` → the header value does not match what Vercel holds.
If `404` → the deployment predates the P1 merge; check that Vercel's production branch is `main` and that `58c51cb` is deployed.

Then confirm the chaser's actual feed returns something:

```bash
curl -s -H "x-os-secret: <the secret>" \
  "https://<shikkstracker-prod-host>/api/os/attention?days=3&limit=20"
```

Expected: JSON with a `repliedUnanswered` array. **Write down whether it is empty** — Task 17 needs at least one real entry, and an empty array there means the acceptance test has no subject yet.

- [ ] **Step 4: Set up the local ShikksTracker for development**

In `../ShikksTracker/.env.local`, add `OS_API_SECRET=` with the same value. Then run it on port 3000:

```bash
cd ../ShikksTracker && npm run dev
```

RikuOS will run on 3001 (Task 2). Verify the local instance:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "x-os-secret: <the secret>" http://localhost:3000/api/os/summary
```

Expected: `200`.

> ⚠️ **Safety note that applies from here to the end of the plan.** A successful `POST /api/os/drafts` creates an `EmailLog` with `status: "approved"` — the send cron will deliver it to a real person. There is no dry-run mode. If your local ShikksTracker points at the **production** `shikkstracker` database, then a local approve during development sends a real email. Use a contact you control (your own address as a test contact) for every non-acceptance test.

- [ ] **Step 5: Record the two base URLs**

Write down, for Task 2 and Task 16:

- Local: `ST_API_BASE_URL=http://localhost:3000`
- Production: `ST_API_BASE_URL=https://<shikkstracker-prod-host>` (no trailing slash, no `/api`)

---

### Task 2: Dependencies and environment

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Add the Anthropic SDK and the resolve script to `package.json`**

Add `"@anthropic-ai/sdk": "^0.110.0"` to `dependencies` (same major as ShikksTracker uses, so behaviour is already proven on this account), and one script. The resulting `dependencies` and `scripts` blocks:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "migrate:indexes": "node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/sync-indexes.mts",
    "migrate:indexes:apply": "node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/sync-indexes.mts --apply",
    "seed:approval": "node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/seed-approval.mts",
    "action:resolve": "node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/resolve-action.mts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.110.0",
    "mongoose": "^9.7.3",
    "next": "16.2.10",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "web-push": "^3.6.7"
  },
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: completes; `package-lock.json` updated with `@anthropic-ai/sdk`.

- [ ] **Step 3: Replace the P4 block at the bottom of `.env.example`**

Delete the four commented `# --- Reserved for P4 ...` lines and append this in their place (names and comments only — never values, CLAUDE.md):

```
# --- ShikksTracker OS API (P4 follow-up chaser) ---
ST_API_BASE_URL=         # ShikksTracker's ORIGIN, no trailing slash and no /api suffix.
                         #   .env.local          -> http://localhost:3000   (local ShikksTracker;
                         #                          run RikuOS on 3001: npm run dev -- -p 3001)
                         #   Vercel Production   -> https://<shikkstracker-prod-host>
                         # Crossing these two fails as a connection error or a 404 HTML page,
                         # never as an obvious config mistake. Read the failure apart before
                         # changing anything: 503 = secret unset/short on ShikksTracker,
                         # 401 = secret mismatch, ECONNREFUSED = wrong host or port.
ST_API_SECRET=           # the SAME value ShikksTracker stores as OS_API_SECRET.
                         # MINIMUM 32 CHARS — ShikksTracker fails closed with 503 below that,
                         # not 401. Sent as the x-os-secret header. Never logged.

# --- Anthropic (draft generation) ---
ANTHROPIC_API_KEY=       # required by the chaser cron; a separate key from ShikksTracker's is fine
# ANTHROPIC_MODEL=       # optional override; defaults to claude-opus-5 in src/lib/draftFollowup.ts
```

- [ ] **Step 4: Fill in `.env.local`** (not committed — `.env.*` is gitignored except `.env.example`)

Add `ST_API_BASE_URL=http://localhost:3000`, `ST_API_SECRET=<Task 1 Step 1 value>`, `ANTHROPIC_API_KEY=<key>`, and **change `APP_BASE_URL` to `http://localhost:3001`** so the Origin check on mutations passes when RikuOS serves on 3001.

- [ ] **Step 5: Verify nothing broke and commit**

Run: `npm test`
Expected: the existing suite passes unchanged.

Run: `npx tsc --noEmit`
Expected: no output.

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add the Anthropic SDK and document the P4 environment"
```

---

### Task 3: The ShikksTracker API client and the failure classifier

The single door to ShikksTracker. Everything about the failure contract lives here as pure, testable functions; `createDraft` merely composes them and is **total** — it never throws.

**Files:**
- Create: `src/lib/stApi.ts`
- Test: `src/lib/__tests__/stApi.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/stApi.test.ts`

```ts
/**
 * The failure classifier is the safety-critical part of P4: a mis-classified
 * failure is a duplicate message to a real client. These tests pin the table in
 * the plan's "action-execution failure contract" section. Do not relax one
 * without changing that table first.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  readStConfig,
  classifyDraftStatus,
  classifyFetchError,
  createDraft,
  fetchAttention,
  ST_TIMEOUT_MS,
} from "@/lib/stApi";

const GOOD_SECRET = "s".repeat(32);

function env(over: Record<string, string | undefined> = {}) {
  return {
    ST_API_BASE_URL: "https://st.example.com",
    ST_API_SECRET: GOOD_SECRET,
    ...over,
  } as NodeJS.ProcessEnv;
}

describe("readStConfig", () => {
  it("returns a trimmed base url and the secret", () => {
    expect(readStConfig(env({ ST_API_BASE_URL: "https://st.example.com///" }))).toEqual({
      baseUrl: "https://st.example.com",
      secret: GOOD_SECRET,
    });
  });

  it("throws when the base url is missing", () => {
    expect(() => readStConfig(env({ ST_API_BASE_URL: undefined }))).toThrow(/ST_API_BASE_URL/);
  });

  it("throws when the base url has no http scheme", () => {
    expect(() => readStConfig(env({ ST_API_BASE_URL: "st.example.com" }))).toThrow(/http/);
  });

  it("throws when the secret is shorter than 32 characters", () => {
    expect(() => readStConfig(env({ ST_API_SECRET: "short" }))).toThrow(/32/);
  });

  it("never puts the secret in the error message", () => {
    try {
      readStConfig(env({ ST_API_BASE_URL: undefined }));
    } catch (err) {
      expect((err as Error).message).not.toContain(GOOD_SECRET);
    }
  });
});

describe("classifyDraftStatus", () => {
  it.each([201])("treats %i as created", (s) => {
    expect(classifyDraftStatus(s)).toBe("created");
  });

  it("treats 409 as duplicate — the desired end state already holds", () => {
    expect(classifyDraftStatus(409)).toBe("duplicate");
  });

  it.each([400, 401, 404, 422, 503])(
    "treats %i as rejected — every early return precedes EmailLog.create",
    (s) => {
      expect(classifyDraftStatus(s)).toBe("rejected");
    }
  );

  it.each([500, 502, 504])("treats %i as unknown — may have happened after the write", (s) => {
    expect(classifyDraftStatus(s)).toBe("unknown");
  });

  it.each([200, 204, 301, 418])("treats unmodelled status %i as unknown", (s) => {
    expect(classifyDraftStatus(s)).toBe("unknown");
  });
});

describe("classifyFetchError", () => {
  function withCause(code: string): Error {
    const err = new Error("fetch failed");
    (err as Error & { cause?: { code: string } }).cause = { code };
    return err;
  }

  it.each([
    "ECONNREFUSED",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ERR_INVALID_URL",
    "CERT_HAS_EXPIRED",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
  ])("treats %s as rejected — the connection was never established", (code) => {
    expect(classifyFetchError(withCause(code))).toBe("rejected");
  });

  it("treats our own timeout as unknown — the request WAS sent", () => {
    const abort = new Error("The operation was aborted due to timeout");
    abort.name = "TimeoutError";
    expect(classifyFetchError(abort)).toBe("unknown");
  });

  it("treats a reset connection as unknown — the request may have been delivered", () => {
    expect(classifyFetchError(withCause("ECONNRESET"))).toBe("unknown");
  });

  it("defaults an unrecognised error to unknown, never to rejected", () => {
    expect(classifyFetchError(new Error("something else entirely"))).toBe("unknown");
    expect(classifyFetchError(withCause("SOME_NEW_CODE"))).toBe("unknown");
  });
});

describe("createDraft", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
    vi.unstubAllEnvs();
  });

  function stubEnv() {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
  }

  function stubFetch(impl: () => Promise<Response> | never) {
    globalThis.fetch = (async () => impl()) as typeof fetch;
  }

  const body = { contactId: "c1", channel: "email" as const, body: "hi", replyToLogId: "l1" };

  it("returns created with the log id on 201", async () => {
    stubEnv();
    stubFetch(async () => new Response(JSON.stringify({ _id: "log-9" }), { status: 201 }));
    expect(await createDraft(body)).toEqual({ kind: "created", logId: "log-9" });
  });

  it("returns created with a null id when a 201 body will not parse", async () => {
    stubEnv();
    stubFetch(async () => new Response("not json", { status: 201 }));
    expect(await createDraft(body)).toEqual({ kind: "created", logId: null });
  });

  it("returns duplicate on 409", async () => {
    stubEnv();
    stubFetch(async () => new Response(JSON.stringify({ error: "exists" }), { status: 409 }));
    expect((await createDraft(body)).kind).toBe("duplicate");
  });

  it("returns rejected on 422 and carries the server's message", async () => {
    stubEnv();
    stubFetch(
      async () =>
        new Response(JSON.stringify({ error: "Contact has no email address." }), { status: 422 })
    );
    const out = await createDraft(body);
    expect(out.kind).toBe("rejected");
    if (out.kind === "rejected") {
      expect(out.status).toBe(422);
      expect(out.message).toContain("no email address");
    }
  });

  it("returns unknown on 500", async () => {
    stubEnv();
    stubFetch(async () => new Response("boom", { status: 500 }));
    expect((await createDraft(body)).kind).toBe("unknown");
  });

  it("returns unknown when the request times out", async () => {
    stubEnv();
    stubFetch(() => {
      const err = new Error("aborted");
      err.name = "TimeoutError";
      throw err;
    });
    expect((await createDraft(body)).kind).toBe("unknown");
  });

  it("returns rejected — not unknown — when the connection is refused", async () => {
    stubEnv();
    stubFetch(() => {
      const err = new Error("fetch failed");
      (err as Error & { cause?: { code: string } }).cause = { code: "ECONNREFUSED" };
      throw err;
    });
    expect((await createDraft(body)).kind).toBe("rejected");
  });

  it("returns rejected without touching the network when config is missing", async () => {
    vi.stubEnv("ST_API_BASE_URL", "");
    vi.stubEnv("ST_API_SECRET", "");
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("", { status: 201 });
    }) as typeof fetch;
    expect((await createDraft(body)).kind).toBe("rejected");
    expect(called).toBe(false);
  });

  it("never throws, whatever fetch does", async () => {
    stubEnv();
    stubFetch(() => {
      throw "a string, not an Error";
    });
    await expect(createDraft(body)).resolves.toBeDefined();
  });

  it("sends the secret as x-os-secret and omits an absent subject", async () => {
    stubEnv();
    let seen: { url: string; init: RequestInit } | null = null;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ _id: "l" }), { status: 201 });
    }) as unknown as typeof fetch;
    await createDraft(body);
    expect(seen!.url).toBe("https://st.example.com/api/os/drafts");
    expect((seen!.init.headers as Record<string, string>)["x-os-secret"]).toBe(GOOD_SECRET);
    expect(JSON.parse(seen!.init.body as string)).toEqual({
      contactId: "c1",
      channel: "email",
      body: "hi",
      replyToLogId: "l1",
    });
  });
});

describe("fetchAttention", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
    vi.unstubAllEnvs();
  });

  it("throws with a diagnosable message on a non-200 — a GET has no side effect to protect", async () => {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
    globalThis.fetch = (async () => new Response("", { status: 503 })) as typeof fetch;
    await expect(fetchAttention(3, 50)).rejects.toThrow(/503/);
  });

  it("returns the repliedUnanswered array on 200", async () => {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ repliedUnanswered: [{ contactId: "c1" }] }), {
        status: 200,
      })) as typeof fetch;
    const out = await fetchAttention(3, 50);
    expect(out.repliedUnanswered).toHaveLength(1);
  });
});

describe("timeouts", () => {
  it("bounds every external call (CLAUDE.md)", () => {
    expect(ST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(ST_TIMEOUT_MS).toBeLessThanOrEqual(20_000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/stApi.test.ts`
Expected: FAIL — cannot resolve `@/lib/stApi`.

- [ ] **Step 3: Write `src/lib/stApi.ts`**

```ts
/**
 * stApi.ts — the ONLY door to ShikksTracker.
 *
 * RikuOS never connects to the `shikkstracker` database (CLAUDE.md prime
 * directive). Every read and every action goes through /api/os/* with the
 * shared secret, sent as the `x-os-secret` header. The contract lives in
 * ../ShikksTracker/docs/os-api.md; the shapes below are reproduced from it.
 *
 * THE SAFETY-CRITICAL PART OF THIS FILE IS THE CLASSIFIER.
 * createDraft performs an outward action with a real-world side effect: a
 * message to a lead. A failure that is mis-read as "safe to retry" produces a
 * duplicate message to a real client. So classification is exhaustive and
 * conservative: only POSITIVE PROOF that the request was never delivered
 * downgrades a failure to `rejected`; everything else is `unknown` and parks
 * for human verification (CLAUDE.md asymmetric-failure rule).
 *
 * Two ShikksTracker behaviours this file depends on, both verified at plan time
 * against ../ShikksTracker/src/lib/os/drafts.ts:
 *
 *  1. createOsDraft hard-codes `origin: "rikuos"` on every log, which is what
 *     permits delivery to a contact whose status is `replied`
 *     (src/lib/sendGuards.ts). replyToLogId is sent as well, for THREADING and
 *     for the 409 dedup key below — not for the permit.
 *  2. Every early return in createOsDraft happens BEFORE EmailLog.create. That
 *     is why 400/404/422 are provably side-effect-free, and it is the single
 *     assumption the `rejected` rows in the table rest on. If that file ever
 *     grows a failure path after the write, this classifier must change with it.
 */

/** Explicit timeout on every external call (CLAUDE.md). */
export const ST_TIMEOUT_MS = 15_000;

// --- Contract shapes (../ShikksTracker/docs/os-api.md) -----------------------

/** One entry of GET /api/os/attention -> repliedUnanswered. */
export interface AttentionItem {
  contactId: string;
  businessName: string;
  contactName: string | null;
  /** contact.outreachChannel: email | facebook | instagram | phone. */
  channel: string;
  repliedAt: string;
  replySnippet: string | null;
  lastOutboundBody: string | null;
  keyPoints: string;
  offerSummary: string | null;
  toneNotes: string | null;
  stage: number;
  /** The newest replied log — the threading anchor and the 409 dedup key. */
  replyToLogId: string;
}

export interface AttentionResponse {
  repliedUnanswered: AttentionItem[];
}

/** Request body for POST /api/os/drafts. */
export interface DraftRequest {
  contactId: string;
  channel: "email" | "facebook";
  body: string;
  /**
   * Deliberately absent for chaser drafts: the attention feed does not expose
   * the anchor's subject, so ShikksTracker derives "Re: <anchor subject>"
   * itself. See "Contract gaps" in the P4 plan.
   */
  subject?: string;
  replyToLogId?: string;
}

// --- Config ------------------------------------------------------------------

export interface StConfig {
  baseUrl: string;
  secret: string;
}

/**
 * Reads and validates the two env vars. Takes the environment as a parameter so
 * it is unit-testable. NEVER includes the secret in a thrown message.
 */
export function readStConfig(source: NodeJS.ProcessEnv = process.env): StConfig {
  const baseUrl = (source.ST_API_BASE_URL ?? "").replace(/\/+$/, "");
  const secret = source.ST_API_SECRET ?? "";

  if (!baseUrl) {
    throw new Error(
      "ST_API_BASE_URL is not set. It must be ShikksTracker's origin with no trailing " +
        "slash and no /api suffix (http://localhost:3000 locally, the production host on Vercel)."
    );
  }
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    throw new Error("ST_API_BASE_URL must start with http:// or https://.");
  }
  if (secret.length < 32) {
    throw new Error(
      "ST_API_SECRET must be at least 32 characters. ShikksTracker stores the same value " +
        "as OS_API_SECRET and fails closed with 503 — not 401 — below that length. " +
        "(Value omitted from this message.)"
    );
  }
  return { baseUrl, secret };
}

// --- The classifier ----------------------------------------------------------

export type DraftOutcomeKind = "created" | "duplicate" | "rejected" | "unknown";

/**
 * Maps an HTTP status from POST /api/os/drafts to an outcome kind.
 *
 *   201  created    — the log exists; the body carries its id.
 *   409  duplicate  — a pending reply to this anchor already exists. From
 *                     RikuOS's point of view the desired end state HOLDS.
 *                     This row is what makes a retry safe.
 *   4xx  rejected   — the server declined before EmailLog.create. No side
 *                     effect. Retry is safe (and becomes meaningful once the
 *                     cause is fixed in ShikksTracker).
 *   5xx  unknown    — the handler threw, or an edge proxy timed out after the
 *                     function completed. Indistinguishable. Park it.
 *   else unknown    — an unmodelled response is not evidence of anything.
 */
export function classifyDraftStatus(status: number): DraftOutcomeKind {
  if (status === 201) return "created";
  if (status === 409) return "duplicate";
  if (status === 400 || status === 401 || status === 404 || status === 422 || status === 503) {
    return "rejected";
  }
  return "unknown";
}

/**
 * Error codes that PROVE the connection was never established, so the request
 * cannot have been delivered. Anything not on this list — including our own
 * timeout, which fires only after the request was sent — is `unknown`.
 *
 * Node's fetch (undici) puts the code on `err.cause.code`. Reading it is
 * deliberate: it is the only signal that distinguishes "never connected" from
 * "connected and the response was lost", and getting that wrong is a duplicate
 * message. If a Node upgrade changes the shape, the default is `unknown`, which
 * fails in the safe direction.
 */
const PROVABLY_UNDELIVERED = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ERR_INVALID_URL",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
]);

export function classifyFetchError(err: unknown): "rejected" | "unknown" {
  const cause = (err as { cause?: { code?: unknown } } | null)?.cause;
  const code = typeof cause?.code === "string" ? cause.code : null;
  if (code && PROVABLY_UNDELIVERED.has(code)) return "rejected";
  return "unknown";
}

export type DraftOutcome =
  | { kind: "created"; logId: string | null }
  | { kind: "duplicate"; message: string }
  | { kind: "rejected"; status: number; message: string }
  | { kind: "unknown"; message: string };

function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const parsed = (await res.json()) as { error?: unknown };
    if (typeof parsed.error === "string") return parsed.error.slice(0, 500);
  } catch {
    // fall through — a non-JSON error body is fine, the status carries the meaning
  }
  return `HTTP ${res.status}`;
}

// --- Calls -------------------------------------------------------------------

/**
 * GET /api/os/attention. Throws on any failure — a GET has no side effect to
 * protect, so the caller's ordinary error path (AgentRun + push alert) is the
 * right handling.
 */
export async function fetchAttention(days: number, limit: number): Promise<AttentionResponse> {
  const { baseUrl, secret } = readStConfig();
  const url = `${baseUrl}/api/os/attention?days=${encodeURIComponent(
    String(days)
  )}&limit=${encodeURIComponent(String(limit))}`;

  const res = await fetch(url, {
    headers: { "x-os-secret": secret },
    signal: AbortSignal.timeout(ST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `GET /api/os/attention returned ${res.status}. ` +
        "503 = OS_API_SECRET unset or under 32 chars on ShikksTracker; " +
        "401 = secret mismatch; 404 = the deployment predates the P1 merge."
    );
  }

  const parsed = (await res.json()) as Partial<AttentionResponse>;
  return { repliedUnanswered: Array.isArray(parsed.repliedUnanswered) ? parsed.repliedUnanswered : [] };
}

/**
 * POST /api/os/drafts — the one outward action in P4.
 *
 * TOTAL BY CONTRACT: this function never throws. Every path returns a
 * DraftOutcome, because the caller must record a classified result rather than
 * catch an exception it cannot classify.
 */
export async function createDraft(request: DraftRequest): Promise<DraftOutcome> {
  let config: StConfig;
  try {
    config = readStConfig();
  } catch (err) {
    // Config is validated before any network call, so nothing happened.
    return { kind: "rejected", status: 0, message: describeError(err) };
  }

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/api/os/drafts`, {
      method: "POST",
      headers: { "x-os-secret": config.secret, "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(ST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const kind = classifyFetchError(err);
    const message = describeError(err);
    return kind === "rejected"
      ? { kind: "rejected", status: 0, message }
      : {
          kind: "unknown",
          message:
            `${message} — the request may have reached ShikksTracker. ` +
            "Check the contact's lane there before re-sending.",
        };
  }

  switch (classifyDraftStatus(res.status)) {
    case "created": {
      let logId: string | null = null;
      try {
        const parsed = (await res.json()) as { _id?: unknown };
        if (typeof parsed._id === "string") logId = parsed._id;
      } catch {
        // 201 already proves creation; the body is only for the id.
      }
      return { kind: "created", logId };
    }
    case "duplicate":
      return { kind: "duplicate", message: await readErrorMessage(res) };
    case "rejected":
      return { kind: "rejected", status: res.status, message: await readErrorMessage(res) };
    default:
      return {
        kind: "unknown",
        message:
          `HTTP ${res.status} from POST /api/os/drafts — the draft may or may not have been ` +
          "created. Check the contact's lane in ShikksTracker before re-sending.",
      };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/stApi.test.ts`
Expected: PASS — every describe block green, no skipped tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stApi.ts src/lib/__tests__/stApi.test.ts
git commit -m "feat: ShikksTracker API client with an exhaustive failure classifier"
```

---

### Task 4: Models — the reply anchor, the action state machine, the run counts

Three schema changes and two indexes. No data migration: every added field is optional or defaulted, and the enum widenings are backward compatible with rows already in Atlas.

**Files:**
- Modify: `src/models/approvals/FollowupDraftApproval.ts`
- Modify: `src/models/ApprovalItem.ts`
- Modify: `src/models/AgentRun.ts`
- Test: `src/lib/__tests__/models.test.ts`

- [ ] **Step 1: Write the failing tests** — append to `src/lib/__tests__/models.test.ts`

```ts
describe("P4 — followup-draft payload carries the reply anchor", () => {
  it("accepts a payload with replyToLogId", () => {
    const doc = new FollowupDraftApproval({
      ...validItem(),
      payload: { ...validPayload, replyToLogId: "64b7f0c2e1a2b3c4d5e6f700" },
    });
    expect(doc.validateSync()).toBeUndefined();
  });

  it("rejects an over-length replyToLogId", () => {
    const doc = new FollowupDraftApproval({
      ...validItem(),
      payload: { ...validPayload, replyToLogId: "x".repeat(65) },
    });
    expect(doc.validateSync()?.errors["payload.replyToLogId"]).toBeDefined();
  });

  it("keeps replyToLogId optional — P3 seeds have none", () => {
    const doc = new FollowupDraftApproval(validItem());
    expect(doc.validateSync()).toBeUndefined();
  });

  it("carries replyToLogId on editedPayload too, so an edit cannot lose the anchor", () => {
    const doc = new FollowupDraftApproval({
      ...validItem(),
      editedPayload: { ...validPayload, replyToLogId: "64b7f0c2e1a2b3c4d5e6f700" },
    });
    expect(doc.validateSync()).toBeUndefined();
  });
});

describe("P4 — the action state machine", () => {
  it.each(["pending", "running", "done", "failed", "needs_verification"])(
    "accepts actionStatus %s",
    (s) => {
      const doc = new FollowupDraftApproval({ ...validItem(), actionStatus: s });
      expect(doc.validateSync()?.errors["actionStatus"]).toBeUndefined();
    }
  );

  it("rejects an unknown actionStatus", () => {
    const doc = new FollowupDraftApproval({ ...validItem(), actionStatus: "maybe" });
    expect(doc.validateSync()?.errors["actionStatus"]).toBeDefined();
  });

  it("accepts actionStartedAt — the claim timestamp the stale sweep reads", () => {
    const doc = new FollowupDraftApproval({ ...validItem(), actionStartedAt: new Date() });
    expect(doc.validateSync()).toBeUndefined();
  });
});

describe("P4 — the idempotency index", () => {
  // P4-e/P4-f: declared on the BASE schema even though the path lives on the
  // discriminator, because sync-indexes.mts iterates base models and
  // syncIndexes() drops any index it does not see declared there.
  function indexOn(path: string) {
    return ApprovalItem.schema
      .indexes()
      .find(([keys]) => Object.prototype.hasOwnProperty.call(keys, path));
  }

  it("declares a unique partial index on payload.replyToLogId scoped to pending", () => {
    const found = indexOn("payload.replyToLogId");
    expect(found).toBeDefined();
    const [, options] = found!;
    expect(options.unique).toBe(true);
    expect(options.partialFilterExpression).toEqual({
      status: "pending",
      "payload.replyToLogId": { $exists: true },
    });
  });

  it("is NOT declared on the discriminator schema", () => {
    const onDiscriminator = FollowupDraftApproval.schema
      .indexes()
      .find(([keys]) => Object.prototype.hasOwnProperty.call(keys, "payload.replyToLogId"));
    expect(onDiscriminator).toBeUndefined();
  });

  it("declares the stale-action sweep index", () => {
    expect(indexOn("actionStatus")).toBeDefined();
  });
});

describe("P4 — AgentRun counts", () => {
  it("defaults every count to zero", () => {
    const run = new AgentRun({ agent: "chaser", startedAt: new Date(), durationMs: 1, ok: true });
    expect(run.validateSync()).toBeUndefined();
    expect(run.counts.itemsCreated).toBe(0);
    expect(run.counts.itemsSkipped).toBe(0);
    expect(run.counts.itemsFailed).toBe(0);
  });

  it("rejects a negative skip count", () => {
    const run = new AgentRun({
      agent: "chaser",
      startedAt: new Date(),
      durationMs: 1,
      ok: true,
      counts: { itemsCreated: 0, itemsProcessed: 0, itemsSkipped: -1, itemsFailed: 0 },
    });
    expect(run.validateSync()?.errors["counts.itemsSkipped"]).toBeDefined();
  });
});
```

Add `import ApprovalItem from "@/models/ApprovalItem";` to the file's imports.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/models.test.ts`
Expected: FAIL — `payload.replyToLogId` is not a schema path, `actionStatus: "running"` is rejected by the enum, the index lookups return `undefined`.

- [ ] **Step 3: Add `replyToLogId` to the payload** — `src/models/approvals/FollowupDraftApproval.ts`

Change the interface:

```ts
export interface IFollowupDraftPayload {
  contactId: string;
  contactName: string;
  channel: DraftChannel;
  draftSubject?: string; // email only
  draftBody: string;
  replySnippet?: string; // what the lead said — shown in the queue card
  /**
   * The ShikksTracker EmailLog id of the message being answered. Optional
   * because P3-seeded items have none, but the chaser ALWAYS sets it (P4-d):
   * it is the Gmail threading anchor and the dedup key behind ShikksTracker's
   * 409, which is what makes a retried approve action safe.
   */
  replyToLogId?: string;
}
```

and the sub-schema (24 hex chars for an ObjectId; 64 is a generous bound):

```ts
const FollowupDraftPayloadSchema = new Schema<IFollowupDraftPayload>(
  {
    contactId: { type: String, required: true, maxlength: 64 },
    contactName: { type: String, required: true, maxlength: 200 },
    channel: { type: String, required: true, enum: DRAFT_CHANNELS },
    draftSubject: { type: String, maxlength: 300 },
    draftBody: { type: String, required: true, maxlength: 8000 },
    replySnippet: { type: String, maxlength: 2000 },
    replyToLogId: { type: String, maxlength: 64 },
  },
  { _id: false, strict: true }
);
```

`editedPayload` reuses the same sub-schema, so it inherits the field automatically.

- [ ] **Step 4: Widen the action state machine** — `src/models/ApprovalItem.ts`

Replace the `ACTION_STATUSES` block:

```ts
/**
 * The action state machine (P4). See the P4 plan's "action-execution failure
 * contract" for the full table — the short version:
 *
 *   pending            nothing has run yet
 *   running            CLAIMED by runApprovalAction; the executor is in flight.
 *                      The claim is what stops an executor running twice.
 *   done               the side effect is confirmed (or already existed: a 409
 *                      from ShikksTracker means the draft is there already)
 *   failed             the server refused; PROVABLY no side effect. The only
 *                      state the Retry affordance accepts.
 *   needs_verification we do NOT know whether the side effect happened. Never
 *                      retried automatically or by a button — a human checks
 *                      ShikksTracker's lane first (CLAUDE.md: never guess).
 */
export const ACTION_STATUSES = [
  "pending",
  "running",
  "done",
  "failed",
  "needs_verification",
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
```

Add `actionStartedAt` to the interface, after `actionStatus`:

```ts
  actionStatus: ActionStatus;
  /** Set when the action is claimed; the stale-`running` sweep reads it. */
  actionStartedAt?: Date;
  actionError?: string;
  actionAt?: Date;
```

and to the schema, after the `actionStatus` line:

```ts
    actionStatus: { type: String, required: true, enum: ACTION_STATUSES, default: "pending" },
    actionStartedAt: { type: Date },
    actionError: { type: String, maxlength: 2000 },
    actionAt: { type: Date },
```

- [ ] **Step 5: Add the two indexes** — `src/models/ApprovalItem.ts`, after the existing two

```ts
/**
 * Chaser idempotency (P4-e). At most ONE pending item may exist per reply
 * anchor. ShikksTracker's attention feed only stops proposing a lead once a
 * draft exists THERE — i.e. after Riku approves — so between creation and
 * approval the same lead returns in the feed every single day. The chaser also
 * filters in the query layer; this index is the atomic backstop under it.
 *
 * Scoped to `status: "pending"` on purpose: a rejected or expired item must NOT
 * block a fresh proposal, because Riku rejected the wording, not the lead.
 *
 * DECLARED ON THE BASE SCHEMA even though `payload` lives on the discriminator
 * (P4-f). scripts/sync-indexes.mts iterates base models, and syncIndexes()
 * DROPS any index it does not see declared there — an index declared on a
 * discriminator schema would be created and then dropped on the next migration.
 * Never declare an index on a discriminator schema in this repo.
 */
ApprovalItemSchema.index(
  { "payload.replyToLogId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "pending",
      "payload.replyToLogId": { $exists: true },
    },
  }
);

// Stale-action sweep: claimed actions that never resolved (see buildActionSweep).
ApprovalItemSchema.index({ actionStatus: 1, actionStartedAt: 1 });
```

- [ ] **Step 6: Widen the AgentRun counts** — `src/models/AgentRun.ts`

```ts
export interface IAgentRunCounts {
  itemsCreated: number;
  itemsProcessed: number;
  /** Candidates deliberately not acted on (P4: wrong channel, already queued, out of time). */
  itemsSkipped: number;
  /** Candidates that were attempted and failed. Never silent (CLAUDE.md). */
  itemsFailed: number;
}

const AgentRunCountsSchema = new Schema<IAgentRunCounts>(
  {
    itemsCreated: { type: Number, required: true, default: 0, min: 0 },
    itemsProcessed: { type: Number, required: true, default: 0, min: 0 },
    itemsSkipped: { type: Number, required: true, default: 0, min: 0 },
    itemsFailed: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false, strict: true }
);
```

and update the model's default factory:

```ts
    counts: {
      type: AgentRunCountsSchema,
      required: true,
      default: () => ({ itemsCreated: 0, itemsProcessed: 0, itemsSkipped: 0, itemsFailed: 0 }),
    },
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/models.test.ts`
Expected: PASS.

Run: `npx vitest run`
Expected: the whole suite still passes — the existing `/api/cron/expire` writes `counts: { itemsCreated: 0, itemsProcessed: expired }` and the two new fields default to 0.

- [ ] **Step 8: Commit**

```bash
git add src/models src/lib/__tests__/models.test.ts
git commit -m "feat: reply anchor on the payload, claimable action states, skip/fail counts"
```

---

### Task 5: The anchor survives an edit

`parseDecision` builds `editedPayload` with an **explicit field copy**, not a spread (deliberately — the payload may be a Mongoose subdocument). A new payload field that is not added to that copy is silently dropped the moment Riku edits a draft, producing an unthreaded reply. This task closes that hole and pins it with a test.

**Files:**
- Modify: `src/lib/queue.ts`
- Modify: `src/app/queue/page.tsx`
- Test: `src/lib/__tests__/queue.test.ts`

- [ ] **Step 1: Write the failing test** — append to `src/lib/__tests__/queue.test.ts`

```ts
describe("P4 — an edit must not drop the reply anchor", () => {
  // If replyToLogId is lost, the resulting ShikksTracker draft is unthreaded
  // (no In-Reply-To / threadId) and loses the 409 dedup key that makes a retry
  // safe. The field copy in parseDecision is explicit, so every new payload
  // field has to be added there by hand — this test is the reminder.
  const withAnchor: IFollowupDraftPayload = {
    contactId: "c1",
    contactName: "Sample Bakery",
    channel: "facebook",
    draftBody: "original",
    replySnippet: "Magkano po?",
    replyToLogId: "64b7f0c2e1a2b3c4d5e6f700",
  };

  it("copies replyToLogId from the original payload into editedPayload", () => {
    const parsed = parseDecision(
      { decision: "edit", draftBody: "rewritten by hand" },
      "followup-draft",
      withAnchor
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok && parsed.value.kind === "edit") {
      expect(parsed.value.editedPayload.replyToLogId).toBe("64b7f0c2e1a2b3c4d5e6f700");
      expect(parsed.value.editedPayload.draftBody).toBe("rewritten by hand");
      // identity fields still come from the original — Riku edits the message,
      // not the lead
      expect(parsed.value.editedPayload.contactId).toBe("c1");
      expect(parsed.value.editedPayload.replySnippet).toBe("Magkano po?");
    }
  });

  it("leaves replyToLogId undefined when the original had none (P3 seeds)", () => {
    const { replyToLogId: _drop, ...noAnchor } = withAnchor;
    const parsed = parseDecision({ decision: "edit", draftBody: "x" }, "followup-draft", noAnchor);
    if (parsed.ok && parsed.value.kind === "edit") {
      expect(parsed.value.editedPayload.replyToLogId).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/queue.test.ts -t "reply anchor"`
Expected: FAIL — `editedPayload.replyToLogId` is `undefined`.

- [ ] **Step 3: Add the field to the copy** — `src/lib/queue.ts`, inside `parseDecision`'s `"edit"` case

```ts
      // Explicit field copy, not a spread — the payload may be a Mongoose
      // subdocument, and spreading one drags internal state along.
      //
      // EVERY new IFollowupDraftPayload field must be added here by hand.
      // A field missing from this list is silently dropped the moment Riku
      // edits a draft. replyToLogId in particular is the threading anchor and
      // the 409 dedup key — losing it produces an unthreaded reply that can
      // also be duplicated by a retry.
      const editedPayload: IFollowupDraftPayload = {
        contactId: payload.contactId,
        contactName: payload.contactName,
        channel: payload.channel,
        draftSubject: (b.draftSubject as string | undefined) ?? payload.draftSubject,
        draftBody: b.draftBody,
        replySnippet: payload.replySnippet,
        replyToLogId: payload.replyToLogId,
      };
```

- [ ] **Step 4: Add the field to the page's payload type** — `src/app/queue/page.tsx`

```tsx
interface QueuePayload {
  contactName?: string;
  channel?: string;
  draftSubject?: string;
  draftBody?: string;
  replySnippet?: string;
  replyToLogId?: string;
}
```

(The page does not render it; the field is here so a future change that echoes the payload back cannot drop it silently.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/queue.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/queue.ts src/app/queue/page.tsx src/lib/__tests__/queue.test.ts
git commit -m "fix: carry the reply anchor through an edited approval"
```

---

### Task 6: `runApprovalAction` — claim, execute, classify, sweep

The core of the design decision. The update *shapes* are pure builders so they are testable without a DB; `runApprovalAction` composes them with I/O.

**Files:**
- Modify: `src/lib/queue.ts`
- Test: `src/lib/__tests__/queue.test.ts`

- [ ] **Step 1: Write the failing tests** — append to `src/lib/__tests__/queue.test.ts`

```ts
describe("P4 — the action state machine builders", () => {
  const now = new Date("2026-08-29T00:00:00.000Z");

  it("the claim guards on actionStatus pending — an executor can never run twice", () => {
    const { filter, update } = buildActionClaim(now);
    expect(filter).toEqual({ actionStatus: "pending" });
    expect(update.$set).toMatchObject({ actionStatus: "running", actionStartedAt: now });
  });

  it("the claim clears any stale actionError from a previous attempt", () => {
    expect(buildActionClaim(now).update.$unset).toEqual({ actionError: "" });
  });

  it("every outcome write guards on actionStatus running", () => {
    for (const status of ["done", "failed", "needs_verification"] as const) {
      const { filter } = buildActionOutcomeUpdate({ status }, now);
      expect(filter).toEqual({ actionStatus: "running" });
    }
  });

  it("a done outcome records the time and no error", () => {
    const { update } = buildActionOutcomeUpdate({ status: "done" }, now);
    expect(update.$set).toEqual({ actionStatus: "done", actionAt: now });
  });

  it("a done outcome with a note keeps the note (the 409 duplicate case)", () => {
    const { update } = buildActionOutcomeUpdate(
      { status: "done", note: "A pending reply already exists." },
      now
    );
    expect(update.$set).toMatchObject({
      actionStatus: "done",
      actionError: "A pending reply already exists.",
    });
  });

  it("truncates a runaway note to the schema bound", () => {
    const { update } = buildActionOutcomeUpdate(
      { status: "failed", note: "x".repeat(5000) },
      now
    );
    expect(((update.$set as Record<string, string>).actionError).length).toBe(2000);
  });

  it("the stale sweep only touches running actions older than the threshold", () => {
    const { filter, update } = buildActionSweep(now, 10 * 60 * 1000);
    expect(filter).toEqual({
      actionStatus: "running",
      actionStartedAt: { $lte: new Date(now.getTime() - 10 * 60 * 1000) },
    });
    expect((update.$set as Record<string, unknown>).actionStatus).toBe("needs_verification");
    // Never `failed`: a claim that vanished mid-flight is the definition of
    // "we do not know whether the side effect happened".
    expect((update.$set as Record<string, unknown>).actionStatus).not.toBe("failed");
    expect((update.$set as Record<string, string>).actionError).toMatch(/interrupted/i);
  });

  it("a retry only leaves the `failed` state, never needs_verification", () => {
    const { filter, update } = buildActionRetry();
    expect(filter).toEqual({ actionStatus: "failed" });
    expect(update.$set).toEqual({ actionStatus: "pending" });
    expect(update.$unset).toEqual({ actionError: "", actionAt: "", actionStartedAt: "" });
  });

  it("STALE_ACTION_MS is comfortably above the route's maxDuration", () => {
    expect(STALE_ACTION_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });
});
```

Extend the file's `@/lib/queue` import with `buildActionClaim`, `buildActionOutcomeUpdate`, `buildActionSweep`, `buildActionRetry`, `STALE_ACTION_MS`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/queue.test.ts -t "action state machine"`
Expected: FAIL — none of the builders are exported.

- [ ] **Step 3: Replace the executor plumbing in `src/lib/queue.ts`**

Replace everything from `type ActionExecutor = ...` to the end of the file with:

```ts
/**
 * The result an executor reports. An executor CLASSIFIES; it never guesses and
 * it never decides on its own to retry.
 *
 *   done               the side effect is confirmed, or already existed
 *   failed             the target refused; PROVABLY no side effect. Retryable.
 *   needs_verification unknown. A human checks the far side before anything else
 *                      happens (CLAUDE.md asymmetric-failure rule).
 */
export type ActionResultStatus = "done" | "failed" | "needs_verification";

export interface ActionOutcome {
  status: ActionResultStatus;
  note?: string;
}

type ActionExecutor = (item: IApprovalItemBase) => Promise<ActionOutcome>;

/** A claimed action older than this is presumed interrupted and is swept. */
export const STALE_ACTION_MS = 10 * 60 * 1000;

const ACTION_ERROR_MAX = 2000; // matches ApprovalItem.actionError's maxlength

/**
 * Pure: claims an action for execution.
 *
 * WHY A CLAIM EXISTS. Before P4 the executor ran unconditionally and only the
 * RECORDING of its outcome was guarded, so a second invocation performed the
 * side effect again and then silently failed to record it. That was harmless
 * while the executor was a no-op. From P4 it would be a duplicate message to a
 * real client. The claim is the guard that makes at-most-once real.
 */
export function buildActionClaim(now: Date): {
  filter: { actionStatus: "pending" };
  update: Record<string, unknown>;
} {
  return {
    filter: { actionStatus: "pending" as const },
    update: {
      $set: { actionStatus: "running", actionStartedAt: now },
      // A retry re-enters through `pending`; clear the previous attempt's error
      // so the card never shows a stale reason next to a fresh result.
      $unset: { actionError: "" },
    },
  };
}

/** Pure: records an executor's classified outcome. Guarded on the claim. */
export function buildActionOutcomeUpdate(
  outcome: ActionOutcome,
  now: Date
): { filter: { actionStatus: "running" }; update: Record<string, unknown> } {
  return {
    filter: { actionStatus: "running" as const },
    update: {
      $set: {
        actionStatus: outcome.status,
        actionAt: now,
        ...(outcome.note !== undefined
          ? { actionError: outcome.note.slice(0, ACTION_ERROR_MAX) }
          : {}),
      },
    },
  };
}

/**
 * Pure: the stale-claim sweep. A `running` row means the function died between
 * claiming and recording — the side effect may or may not have landed, which is
 * exactly `needs_verification`. Never `failed`: that state asserts no side
 * effect, and here we have no such proof.
 *
 * CLAUDE.md: never leave an in-flight state behind — a pending/sending-style
 * status needs a sweep that returns stale rows to a safe state with a note.
 */
export function buildActionSweep(
  now: Date,
  staleMs: number = STALE_ACTION_MS
): { filter: Record<string, unknown>; update: Record<string, unknown> } {
  return {
    filter: {
      actionStatus: "running",
      actionStartedAt: { $lte: new Date(now.getTime() - staleMs) },
    },
    update: {
      $set: {
        actionStatus: "needs_verification",
        actionAt: now,
        actionError:
          "The action was interrupted before its result was recorded. It may or may not " +
          "have taken effect — check the contact's lane in ShikksTracker before re-sending.",
      },
    },
  };
}

/**
 * Pure: returns a failed action to `pending` so it can be claimed again.
 * Guarded on `failed` — the ONLY state with proof that no side effect occurred.
 * A needs_verification row can never enter here.
 */
export function buildActionRetry(): {
  filter: { actionStatus: "failed" };
  update: Record<string, unknown>;
} {
  return {
    filter: { actionStatus: "failed" as const },
    update: {
      $set: { actionStatus: "pending" },
      $unset: { actionError: "", actionAt: "", actionStartedAt: "" },
    },
  };
}

/**
 * One executor per discriminator type. Task 7 fills in followup-draft.
 */
const executors: Record<string, ActionExecutor> = {};

/**
 * Claims, runs, and records the action for a just-approved item.
 *
 * Callers must have connectDB()'d already. This never throws — an action
 * failure lands in actionStatus/actionError, not in the HTTP response path.
 *
 * Note the order: CLAIM FIRST. If the claim is lost, another invocation owns
 * the action and this one returns without running the executor.
 */
export async function runApprovalAction(item: IApprovalItemBase): Promise<void> {
  const claimedAt = new Date();
  const claim = buildActionClaim(claimedAt);
  const claimed = await ApprovalItem.findOneAndUpdate(
    { _id: item._id, ...claim.filter },
    claim.update,
    { new: true }
  );
  if (!claimed) {
    // Already running, already resolved, or parked. Not ours to run.
    return;
  }

  let outcome: ActionOutcome;
  const executor = executors[claimed.type];
  if (!executor) {
    outcome = {
      status: "failed",
      note: `No action executor registered for type "${claimed.type}".`,
    };
  } else {
    try {
      outcome = await executor(claimed);
    } catch (err) {
      // Executors are written to be total, so this is defensive. A throw means
      // we learned nothing about whether the side effect happened.
      const message = err instanceof Error ? err.message : String(err);
      outcome = {
        status: "needs_verification",
        note: `The action threw before reporting a result: ${message}`,
      };
    }
  }

  const record = buildActionOutcomeUpdate(outcome, new Date());
  await ApprovalItem.updateOne({ _id: claimed._id, ...record.filter }, record.update);
}
```

> Base-schema paths only (`actionStatus`, `actionStartedAt`, `actionError`, `actionAt`) are written here, so staying on the base model is safe and deliberate — see the note on `approvalModelForType`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/queue.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: clean. (`/api/queue/[id]/decide/route.ts` calls `runApprovalAction` with the same signature, so it is unaffected.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/queue.ts src/lib/__tests__/queue.test.ts
git commit -m "feat: claim actions before executing them and classify every outcome"
```

---

### Task 7: The real `followup-draft` executor

**Files:**
- Modify: `src/lib/queue.ts`
- Test: `src/lib/__tests__/queue.test.ts`

- [ ] **Step 1: Write the failing test** — append to `src/lib/__tests__/queue.test.ts`

```ts
describe("P4 — the followup-draft executor maps outcomes to action states", () => {
  const base = {
    contactId: "64b7f0c2e1a2b3c4d5e6f6ff",
    contactName: "Sample Bakery",
    channel: "email" as const,
    draftBody: "Thanks for getting back to me.",
    replyToLogId: "64b7f0c2e1a2b3c4d5e6f700",
  };

  function item(payload = base, editedPayload?: typeof base) {
    return {
      type: "followup-draft",
      payload,
      ...(editedPayload ? { editedPayload } : {}),
    } as unknown as IApprovalItemBase;
  }

  it("created -> done", async () => {
    const out = await executeFollowupDraft(item(), async () => ({
      kind: "created",
      logId: "l1",
    }));
    expect(out).toEqual({ status: "done", note: undefined });
  });

  it("duplicate -> done, with the reason kept as a note", async () => {
    const out = await executeFollowupDraft(item(), async () => ({
      kind: "duplicate",
      message: "A pending reply to that message already exists (log l1).",
    }));
    expect(out.status).toBe("done");
    expect(out.note).toMatch(/already exists/);
  });

  it("rejected -> failed (retryable: proven no side effect)", async () => {
    const out = await executeFollowupDraft(item(), async () => ({
      kind: "rejected",
      status: 422,
      message: "Contact has no email address.",
    }));
    expect(out.status).toBe("failed");
    expect(out.note).toMatch(/422/);
  });

  it("unknown -> needs_verification (never failed, never done)", async () => {
    const out = await executeFollowupDraft(item(), async () => ({
      kind: "unknown",
      message: "TimeoutError",
    }));
    expect(out.status).toBe("needs_verification");
  });

  it("sends the EDITED payload when Riku edited the draft", async () => {
    let sent: unknown = null;
    await executeFollowupDraft(
      item(base, { ...base, draftBody: "Riku's own words" }),
      async (req) => {
        sent = req;
        return { kind: "created", logId: "l1" };
      }
    );
    expect((sent as { body: string }).body).toBe("Riku's own words");
  });

  it("omits subject entirely so ShikksTracker derives Re: from the anchor", async () => {
    let sent: Record<string, unknown> = {};
    await executeFollowupDraft(item(), async (req) => {
      sent = req as unknown as Record<string, unknown>;
      return { kind: "created", logId: "l1" };
    });
    expect("subject" in sent).toBe(false);
    expect(sent.replyToLogId).toBe("64b7f0c2e1a2b3c4d5e6f700");
  });

  it("fails closed with no network call when the payload is missing", async () => {
    let called = false;
    const out = await executeFollowupDraft({ type: "followup-draft" } as IApprovalItemBase, async () => {
      called = true;
      return { kind: "created", logId: null };
    });
    expect(out.status).toBe("failed");
    expect(called).toBe(false);
  });
});
```

Extend the `@/lib/queue` import with `executeFollowupDraft`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/queue.test.ts -t "followup-draft executor"`
Expected: FAIL — `executeFollowupDraft` is not exported.

- [ ] **Step 3: Write the executor** — `src/lib/queue.ts`

Add to the imports at the top of the file:

```ts
import { createDraft } from "@/lib/stApi";
import type { DraftOutcome, DraftRequest } from "@/lib/stApi";
import type { IFollowupDraftApproval } from "@/models/approvals/FollowupDraftApproval";
```

Then replace `const executors: Record<string, ActionExecutor> = {};` with:

```ts
/**
 * The one outward action in P4: create the response draft in ShikksTracker.
 *
 * `send` is injected so the mapping is unit-testable without a network call;
 * production passes stApi.createDraft, which is TOTAL (never throws) and
 * returns a classified DraftOutcome.
 *
 * The edited payload wins when Riku edited the draft — that is the version he
 * approved, and it is what must reach the lead.
 */
export async function executeFollowupDraft(
  item: IApprovalItemBase,
  send: (request: DraftRequest) => Promise<DraftOutcome> = createDraft
): Promise<ActionOutcome> {
  const typed = item as unknown as IFollowupDraftApproval;
  const payload = typed.editedPayload ?? typed.payload;

  if (!payload || !payload.contactId || !payload.draftBody) {
    return {
      status: "failed",
      note: "The item has no usable payload; nothing was sent.",
    };
  }

  const request: DraftRequest = {
    contactId: payload.contactId,
    channel: payload.channel,
    body: payload.draftBody,
    // `subject` is deliberately omitted: the attention feed does not expose the
    // anchor's subject, so ShikksTracker derives "Re: <anchor subject>" itself
    // and the email threads correctly. See "Contract gaps" in the P4 plan.
    ...(payload.replyToLogId ? { replyToLogId: payload.replyToLogId } : {}),
  };

  const outcome = await send(request);

  switch (outcome.kind) {
    case "created":
      return { status: "done", note: undefined };
    case "duplicate":
      // The draft is already in ShikksTracker's lane; the desired end state
      // holds. Recording the reason keeps the retry path honest.
      return { status: "done", note: `Already present in ShikksTracker: ${outcome.message}` };
    case "rejected":
      return {
        status: "failed",
        note: `ShikksTracker refused the draft (HTTP ${outcome.status}): ${outcome.message}`,
      };
    case "unknown":
      return { status: "needs_verification", note: outcome.message };
  }
}

const executors: Record<string, ActionExecutor> = {
  "followup-draft": (item) => executeFollowupDraft(item),
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/queue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queue.ts src/lib/__tests__/queue.test.ts
git commit -m "feat: approving a follow-up creates the real draft in ShikksTracker"
```

---

### Task 8: Draft generation via the Anthropic API

**Files:**
- Create: `src/lib/draftFollowup.ts`
- Test: `src/lib/__tests__/draftFollowup.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/draftFollowup.test.ts`

```ts
/**
 * The Anthropic call itself is not unit-tested (it is a network call to a
 * non-deterministic service). What IS tested is everything around it: the
 * prompt the model receives, and the validation of what comes back — the two
 * places a silent regression would produce a bad message to a real lead.
 */
import { describe, it, expect } from "vitest";
import {
  buildFollowupUserMessage,
  systemPromptFor,
  parseDraftToolInput,
  FOLLOWUP_MAX_BODY,
} from "@/lib/draftFollowup";
import type { AttentionItem } from "@/lib/stApi";

const item: AttentionItem = {
  contactId: "c1",
  businessName: "Sample Bakery",
  contactName: "Ana",
  channel: "email",
  repliedAt: "2026-08-25T02:00:00.000Z",
  replySnippet: "Magkano po ang website?",
  lastOutboundBody: "Hi po, saw your bakery page and had an idea for the menu.",
  keyPoints: "Runs a small bakery in Cavite; posts daily on Facebook.",
  offerSummary: "One-page site with menu and contact form, PHP 8k-12k.",
  toneNotes: "Casual, warm, Taglish welcome.",
  stage: 1,
  replyToLogId: "l1",
};

const now = new Date("2026-08-29T02:00:00.000Z");

describe("buildFollowupUserMessage", () => {
  const msg = buildFollowupUserMessage(item, now);

  it("includes everything needed to draft without a second API call", () => {
    expect(msg).toContain("Sample Bakery");
    expect(msg).toContain("Ana");
    expect(msg).toContain("Magkano po ang website?");
    expect(msg).toContain("saw your bakery page");
    expect(msg).toContain("small bakery in Cavite");
    expect(msg).toContain("PHP 8k-12k");
    expect(msg).toContain("Casual, warm, Taglish welcome.");
  });

  it("states how long the lead has been waiting", () => {
    expect(msg).toContain("4 days ago");
  });

  it("handles every nullable field without printing 'null'", () => {
    const bare = buildFollowupUserMessage(
      {
        ...item,
        contactName: null,
        replySnippet: null,
        lastOutboundBody: null,
        offerSummary: null,
        toneNotes: null,
      },
      now
    );
    expect(bare).not.toContain("null");
    expect(bare).toContain("Sample Bakery");
  });

  it("bounds the prompt so a long inbound body cannot blow up the request", () => {
    const huge = buildFollowupUserMessage({ ...item, lastOutboundBody: "x".repeat(50_000) }, now);
    expect(huge.length).toBeLessThan(12_000);
  });
});

describe("systemPromptFor", () => {
  it("uses the DM prompt for facebook — no subject, no sign-off", () => {
    const p = systemPromptFor("facebook");
    expect(p).toMatch(/direct message/i);
    expect(p).toMatch(/60 words/);
  });

  it("uses the email prompt for email", () => {
    expect(systemPromptFor("email")).toMatch(/120 words/);
  });

  it("both prompts carry the anti-AI-tell guardrails", () => {
    for (const channel of ["email", "facebook"] as const) {
      expect(systemPromptFor(channel)).toMatch(/em dashes/);
      expect(systemPromptFor(channel)).toMatch(/assistant-speak/);
    }
  });

  it("both prompts frame this as a REPLY, never as cold outreach", () => {
    for (const channel of ["email", "facebook"] as const) {
      expect(systemPromptFor(channel)).toMatch(/they wrote first|already answered|reply/i);
    }
  });
});

describe("parseDraftToolInput", () => {
  it("accepts a well-formed body", () => {
    expect(parseDraftToolInput({ body: "Hi Ana, salamat sa reply." })).toBe(
      "Hi Ana, salamat sa reply."
    );
  });

  it("trims surrounding whitespace", () => {
    expect(parseDraftToolInput({ body: "  hello  " })).toBe("hello");
  });

  it("rejects a missing body", () => {
    expect(() => parseDraftToolInput({})).toThrow(/body/);
  });

  it("rejects an empty body", () => {
    expect(() => parseDraftToolInput({ body: "   " })).toThrow(/body/);
  });

  it("rejects a non-string body", () => {
    expect(() => parseDraftToolInput({ body: 42 })).toThrow(/body/);
  });

  it("rejects a body over the payload's schema bound", () => {
    expect(() => parseDraftToolInput({ body: "x".repeat(FOLLOWUP_MAX_BODY + 1) })).toThrow(
      /too long/
    );
  });

  it("rejects a null input", () => {
    expect(() => parseDraftToolInput(null)).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/draftFollowup.test.ts`
Expected: FAIL — cannot resolve `@/lib/draftFollowup`.

- [ ] **Step 3: Write `src/lib/draftFollowup.ts`**

```ts
/**
 * draftFollowup.ts — generates the reply the chaser proposes.
 *
 * This is the "prompt plus data" half of the runtime split rule
 * (ARCHITECTURE.md §2.3): no skill is needed, so it runs as a Vercel cron
 * calling the Anthropic API rather than as a Claude scheduled task.
 *
 * The forced-tool-use shape mirrors ../ShikksTracker/src/lib/draft.ts, which is
 * already proven on this account and with these guardrails. Deliberately no
 * `strict: true` and no assistant prefill: the returned input is validated at
 * runtime by parseDraftToolInput instead.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AttentionItem } from "@/lib/stApi";
import type { DraftChannel } from "@/models/approvals/FollowupDraftApproval";

/** Matches IFollowupDraftPayload.draftBody's maxlength. */
export const FOLLOWUP_MAX_BODY = 8000;

/** Bound on each block of context pasted into the prompt. */
const CONTEXT_MAX = 1500;

export const ANTHROPIC_TIMEOUT_MS = 45_000;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set; the chaser cannot generate drafts.");
  }
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: ANTHROPIC_TIMEOUT_MS, // milliseconds in the TS SDK
      maxRetries: 1, // one retry keeps the run inside the cron's wall-clock budget
    });
  }
  return client;
}

/**
 * Pinned via env (ARCHITECTURE.md §4.2). Effort stays low and thinking stays
 * ON: with thinking disabled the model can write a tool call into visible text
 * instead of emitting a tool_use block, which is exactly the shape this file
 * depends on. Low effort is the cheap, safe combination.
 */
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

/**
 * Ported verbatim from ../ShikksTracker/src/lib/draft.ts so both apps' copy
 * reads the same. Distilled from the layered-humanizer skill's lexical-patterns
 * catalog down to what actually shows up in short outreach copy.
 */
const AI_TELL_GUARDRAILS = `Avoid these AI-writing tells:
- No em dashes or en dashes (— or –) anywhere. Use a period, comma, or colon instead.
- No AI-vocabulary words: delve, crucial, enhance, foster/fostering, tapestry, testament, underscore (verb), showcase, vibrant, boasts, nestled, "in the heart of", stunning, breathtaking, seamless, robust, leverage, elevate, unlock, game-changer, unparalleled.
- Don't dodge "is/has" with "serves as", "stands as", or "boasts a".
- No rule-of-three filler lists (three abstract nouns strung together just to sound thorough).
- No filler phrases ("in order to", "due to the fact that", "at this point in time") — say it plainly.
- No hedging stacks ("could potentially possibly").
- No assistant-speak: "I hope this helps", "let me know if", "Would you like me to", "Of course!", "Great question!".
- No generic uplifting closers ("exciting times ahead", "here's to a bright future").
- Vary sentence length instead of giving every sentence the same clipped, mid-length cadence.`;

const REPLY_FRAME = `You are writing a REPLY to a lead who already answered an outreach message and has been left waiting. This is NOT cold outreach: they wrote first, and this message answers them.`;

export const FOLLOWUP_EMAIL_SYSTEM_PROMPT = `${REPLY_FRAME}

RULES — follow every one, no exceptions:
1. Under ~120 words. Plain text only. Paragraphs separated by a blank line. No HTML, no markdown, no bullet lists.
2. Write the BODY ONLY. No subject line — the message threads onto the existing conversation.
3. Answer what they actually said. Their message is quoted in the input; respond to it directly in the first sentence.
4. No placeholders such as [Name] or [Company]. Use the names you are given or omit them gracefully.
5. Do not dwell on the delay. One short acknowledgement at most, or none at all. Never apologise twice.
6. End with ONE clear next step: a question they can answer in a sentence, or two concrete times for a call.
7. Match the language they wrote in. If their message is Taglish, reply in Taglish; if English, reply in English. Respect the tone notes.
8. No spammy phrasing, no ALL CAPS words, at most one "!" in the whole message.

${AI_TELL_GUARDRAILS}

Use the followup_draft tool to return your result.`;

export const FOLLOWUP_DM_SYSTEM_PROMPT = `${REPLY_FRAME} It will be pasted straight into a Facebook direct message box, so it is NOT an email.

RULES — follow every one, no exceptions:
1. Under ~60 words. One or two short paragraphs. Plain text only — no HTML, no markdown, no bullet lists.
2. NO subject line. NO salutation block on its own line. NO email sign-off ("Best regards", "Sincerely"). Write it the way a real person types a direct message.
3. Answer what they actually said. Their message is quoted in the input; respond to it directly in the first sentence.
4. No placeholders such as [Name] or [Company]. Use the names you are given or omit them gracefully.
5. Do not dwell on the delay. One short acknowledgement at most, or none at all.
6. End with ONE clear next step: a question they can answer in a sentence, or two concrete times for a call.
7. Match the language they wrote in. If their message is Taglish, reply in Taglish; if English, reply in English. Respect the tone notes.
8. No spammy phrasing, no ALL CAPS words, at most one "!" in the whole message.

${AI_TELL_GUARDRAILS}

Use the followup_draft tool to return your result.`;

export function systemPromptFor(channel: DraftChannel): string {
  return channel === "email" ? FOLLOWUP_EMAIL_SYSTEM_PROMPT : FOLLOWUP_DM_SYSTEM_PROMPT;
}

function clip(value: string | null | undefined, max = CONTEXT_MAX): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function daysSince(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / (24 * 60 * 60 * 1000)));
}

/**
 * Builds the user message. Every nullable field is skipped rather than printed
 * as "null" — a prompt containing the literal word teaches the model that empty
 * context is a value worth mentioning.
 */
export function buildFollowupUserMessage(item: AttentionItem, now: Date): string {
  const days = daysSince(item.repliedAt, now);
  const lines: string[] = [
    `Business: ${item.businessName}`,
    ...(item.contactName ? [`Person: ${item.contactName}`] : []),
    `Channel: ${item.channel}`,
    `They replied ${days} ${days === 1 ? "day" : "days"} ago and have had no answer since.`,
  ];

  const reply = clip(item.replySnippet);
  lines.push("", "What they said:", reply ? `"""${reply}"""` : "(not captured)");

  const outbound = clip(item.lastOutboundBody);
  if (outbound) lines.push("", "The last thing we sent them:", `"""${outbound}"""`);

  const keyPoints = clip(item.keyPoints);
  if (keyPoints) lines.push("", `What we know about this business: ${keyPoints}`);

  const offer = clip(item.offerSummary);
  if (offer) lines.push("", `Our offer: ${offer}`);

  const tone = clip(item.toneNotes, 500);
  if (tone) lines.push("", `Tone notes: ${tone}`);

  lines.push("", "Write the reply.");
  return lines.join("\n");
}

/** Validates the tool input at runtime; throws with a diagnosable message. */
export function parseDraftToolInput(input: unknown): string {
  if (input === null || typeof input !== "object") {
    throw new Error("The model returned a non-object tool input.");
  }
  const raw = (input as Record<string, unknown>).body;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error("The model's tool input has no usable `body` string.");
  }
  const body = raw.trim();
  if (body.length > FOLLOWUP_MAX_BODY) {
    throw new Error(
      `The generated body is too long (${body.length} > ${FOLLOWUP_MAX_BODY} characters).`
    );
  }
  return body;
}

/**
 * Generates one follow-up body. Throws on any failure — the caller counts it as
 * a failed lead and moves on to the next one, so one bad draft never takes down
 * the whole run.
 */
export async function generateFollowupDraft(
  item: AttentionItem,
  channel: DraftChannel,
  now: Date = new Date()
): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: "low" },
    system: systemPromptFor(channel),
    tools: [
      {
        name: "followup_draft",
        description:
          "Return the generated follow-up reply as structured JSON with a single body field.",
        input_schema: {
          type: "object" as const,
          properties: {
            body: {
              type: "string",
              description:
                "The plain-text message body. No subject line. Paragraphs separated by blank lines.",
            },
          },
          required: ["body"],
          additionalProperties: false,
        },
      },
    ],
    tool_choice: { type: "tool", name: "followup_draft" },
    messages: [{ role: "user", content: buildFollowupUserMessage(item, now) }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error(
      `Expected a tool_use block from Claude but got stop_reason "${response.stop_reason}".`
    );
  }
  return parseDraftToolInput(toolBlock.input);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/draftFollowup.test.ts`
Expected: PASS — every describe block green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/draftFollowup.ts src/lib/__tests__/draftFollowup.test.ts
git commit -m "feat: Taglish-aware follow-up drafting via the Anthropic API"
```

---

### Task 9: Chaser planning logic

Pure functions: which leads get drafted, which are skipped and why, and what the resulting queue item looks like. All decisions live here so the route stays thin.

**Files:**
- Create: `src/lib/chaser.ts`
- Test: `src/lib/__tests__/chaser.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/chaser.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  planChaserRun,
  buildApprovalInput,
  isSupportedChannel,
  CHASER_MAX_PER_RUN,
  CHASER_STALE_DAYS,
} from "@/lib/chaser";
import type { AttentionItem } from "@/lib/stApi";

function lead(over: Partial<AttentionItem> = {}): AttentionItem {
  return {
    contactId: "c1",
    businessName: "Sample Bakery",
    contactName: "Ana",
    channel: "email",
    repliedAt: "2026-08-25T02:00:00.000Z",
    replySnippet: "Magkano po ang website?",
    lastOutboundBody: "Hi po!",
    keyPoints: "Small bakery in Cavite.",
    offerSummary: "One-page site.",
    toneNotes: "Casual.",
    stage: 1,
    replyToLogId: "l1",
    ...over,
  };
}

describe("isSupportedChannel", () => {
  it.each(["email", "facebook"])("accepts %s", (c) => {
    expect(isSupportedChannel(c)).toBe(true);
  });

  it.each(["instagram", "phone", "", "EMAIL", "telegram"])("rejects %s", (c) => {
    expect(isSupportedChannel(c)).toBe(false);
  });
});

describe("planChaserRun", () => {
  it("drafts a clean lead", () => {
    const plan = planChaserRun([lead()], new Set(), CHASER_MAX_PER_RUN);
    expect(plan.toDraft).toHaveLength(1);
    expect(plan.skipped).toHaveLength(0);
  });

  it("skips unsupported channels and says why (P4-a: counted, never silent)", () => {
    const plan = planChaserRun(
      [lead({ contactId: "c2", channel: "instagram" }), lead({ contactId: "c3", channel: "phone" })],
      new Set(),
      CHASER_MAX_PER_RUN
    );
    expect(plan.toDraft).toHaveLength(0);
    expect(plan.skipped).toEqual([
      { contactId: "c2", reason: "unsupported-channel" },
      { contactId: "c3", reason: "unsupported-channel" },
    ]);
  });

  it("skips a lead whose anchor already has a live queue item", () => {
    const plan = planChaserRun([lead()], new Set(["l1"]), CHASER_MAX_PER_RUN);
    expect(plan.toDraft).toHaveLength(0);
    expect(plan.skipped).toEqual([{ contactId: "c1", reason: "already-queued" }]);
  });

  it("skips a lead with no reply anchor (P4-d: it is required)", () => {
    const plan = planChaserRun([lead({ replyToLogId: "" })], new Set(), CHASER_MAX_PER_RUN);
    expect(plan.skipped).toEqual([{ contactId: "c1", reason: "missing-anchor" }]);
  });

  it("caps the run and counts the overflow as skipped", () => {
    const leads = Array.from({ length: 8 }, (_, i) =>
      lead({ contactId: `c${i}`, replyToLogId: `l${i}` })
    );
    const plan = planChaserRun(leads, new Set(), 3);
    expect(plan.toDraft).toHaveLength(3);
    expect(plan.skipped).toHaveLength(5);
    expect(plan.skipped.every((s) => s.reason === "over-cap")).toBe(true);
  });

  it("deduplicates two items sharing one anchor within a single run", () => {
    const plan = planChaserRun(
      [lead(), lead({ contactId: "c9" })],
      new Set(),
      CHASER_MAX_PER_RUN
    );
    expect(plan.toDraft).toHaveLength(1);
    expect(plan.skipped).toEqual([{ contactId: "c9", reason: "already-queued" }]);
  });

  it("returns an empty plan for an empty feed", () => {
    expect(planChaserRun([], new Set(), CHASER_MAX_PER_RUN)).toEqual({ toDraft: [], skipped: [] });
  });
});

describe("buildApprovalInput", () => {
  const now = new Date("2026-08-29T02:00:00.000Z");
  const built = buildApprovalInput(lead(), "Salamat sa reply po!", now);

  it("attributes the item to the chaser", () => {
    expect(built.source).toBe("chaser");
  });

  it("titles the card with the business name", () => {
    expect(built.title).toContain("Sample Bakery");
    expect(built.title.length).toBeLessThanOrEqual(200);
  });

  it("summarises how long they have waited", () => {
    expect(built.summary).toContain("4 days");
    expect(built.summary.length).toBeLessThanOrEqual(2000);
  });

  it("carries the anchor, the channel and the generated body", () => {
    expect(built.payload.replyToLogId).toBe("l1");
    expect(built.payload.channel).toBe("email");
    expect(built.payload.draftBody).toBe("Salamat sa reply po!");
    expect(built.payload.contactId).toBe("c1");
  });

  it("never sets draftSubject — ShikksTracker derives Re: from the anchor", () => {
    expect(built.payload.draftSubject).toBeUndefined();
  });

  it("falls back to the business name when the contact has no personal name", () => {
    const b = buildApprovalInput(lead({ contactName: null }), "x", now);
    expect(b.payload.contactName).toBe("Sample Bakery");
  });

  it("sets staleAt so a forgotten draft expires instead of lingering", () => {
    const expected = now.getTime() + CHASER_STALE_DAYS * 24 * 60 * 60 * 1000;
    expect(built.staleAt.getTime()).toBe(expected);
  });

  it("bounds every string against its schema maxlength", () => {
    const b = buildApprovalInput(
      lead({ businessName: "B".repeat(400), replySnippet: "r".repeat(4000) }),
      "x",
      now
    );
    expect(b.title.length).toBeLessThanOrEqual(200);
    expect(b.summary.length).toBeLessThanOrEqual(2000);
    expect(b.payload.contactName.length).toBeLessThanOrEqual(200);
    expect((b.payload.replySnippet ?? "").length).toBeLessThanOrEqual(2000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/chaser.test.ts`
Expected: FAIL — cannot resolve `@/lib/chaser`.

- [ ] **Step 3: Write `src/lib/chaser.ts`**

```ts
/**
 * chaser.ts — the follow-up chaser's decisions, as pure functions.
 *
 * S6: ShikksTracker's own engine already automates PRE-reply sequence
 * follow-ups. The chaser owns the POST-reply gap — leads who answered and were
 * then left hanging, the hottest part of the funnel and the real memory hole.
 *
 * Everything that decides anything lives here so the cron route stays thin and
 * the behaviour is testable without a database or a network (CLAUDE.md).
 */

import type { AttentionItem } from "@/lib/stApi";
import { DRAFT_CHANNELS } from "@/models/approvals/FollowupDraftApproval";
import type { DraftChannel, IFollowupDraftPayload } from "@/models/approvals/FollowupDraftApproval";

/** Leads drafted per run. Bounds cost, tokens and the function's wall clock. */
export const CHASER_MAX_PER_RUN = 5;

/** How many attention items to ask ShikksTracker for (its max is 200). */
export const CHASER_ATTENTION_LIMIT = 50;

/**
 * A pending follow-up expires after this long. The draft answers a specific
 * message; a week later the context has moved on and a fresh draft is better
 * than a stale one. Expiring also releases the anchor, so the lead re-enters
 * the feed and gets re-proposed — the loop is self-healing.
 */
export const CHASER_STALE_DAYS = 7;

export type SkipReason =
  | "unsupported-channel"
  | "already-queued"
  | "missing-anchor"
  | "over-cap"
  | "time-budget";

export interface SkippedLead {
  contactId: string;
  reason: SkipReason;
}

export interface ChaserPlan {
  toDraft: AttentionItem[];
  skipped: SkippedLead[];
}

/**
 * P4-a: email and facebook only. Instagram and phone leads are skipped and
 * COUNTED — a silent skip would read as "there was nothing to do".
 */
export function isSupportedChannel(channel: string): channel is DraftChannel {
  return (DRAFT_CHANNELS as readonly string[]).includes(channel);
}

/**
 * Decides which attention items become drafts this run.
 *
 * `liveAnchorIds` holds the replyToLogIds that already have an ApprovalItem in
 * pending / approved / edited_approved. This is the idempotency the feed cannot
 * provide on its own: ShikksTracker only stops proposing a lead once a draft
 * exists THERE — i.e. after Riku approves — so between creation and approval
 * the same lead comes back every single day (P4-e).
 *
 * Order is preserved: the feed is already sorted by contact id, so the cap
 * takes a stable slice rather than a random one.
 */
export function planChaserRun(
  attention: AttentionItem[],
  liveAnchorIds: Set<string>,
  maxPerRun: number
): ChaserPlan {
  const toDraft: AttentionItem[] = [];
  const skipped: SkippedLead[] = [];
  // Anchors claimed earlier in THIS run, so two feed entries sharing an anchor
  // cannot both be drafted before either is written.
  const claimed = new Set(liveAnchorIds);

  for (const item of attention) {
    if (!isSupportedChannel(item.channel)) {
      skipped.push({ contactId: item.contactId, reason: "unsupported-channel" });
      continue;
    }
    if (!item.replyToLogId) {
      skipped.push({ contactId: item.contactId, reason: "missing-anchor" });
      continue;
    }
    if (claimed.has(item.replyToLogId)) {
      skipped.push({ contactId: item.contactId, reason: "already-queued" });
      continue;
    }
    if (toDraft.length >= maxPerRun) {
      skipped.push({ contactId: item.contactId, reason: "over-cap" });
      continue;
    }
    claimed.add(item.replyToLogId);
    toDraft.push(item);
  }

  return { toDraft, skipped };
}

export interface ApprovalInput {
  source: "chaser";
  title: string;
  summary: string;
  staleAt: Date;
  payload: IFollowupDraftPayload;
}

function daysSince(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / (24 * 60 * 60 * 1000)));
}

/**
 * Builds the ApprovalItem input. Every string is clipped to its schema
 * maxlength here rather than relying on Mongoose to reject the write — a
 * rejected write would lose the whole lead over a long business name.
 */
export function buildApprovalInput(
  item: AttentionItem,
  draftBody: string,
  now: Date
): ApprovalInput {
  const days = daysSince(item.repliedAt, now);
  const dayWord = days === 1 ? "day" : "days";
  const snippet = item.replySnippet?.trim();

  return {
    source: "chaser",
    title: `Follow up: ${item.businessName}`.slice(0, 200),
    summary: (
      `Replied ${days} ${dayWord} ago on ${item.channel} and has had no answer since.` +
      (snippet ? ` They said: "${snippet}"` : "")
    ).slice(0, 2000),
    staleAt: new Date(now.getTime() + CHASER_STALE_DAYS * 24 * 60 * 60 * 1000),
    payload: {
      contactId: item.contactId,
      // The payload's contactName is required; the feed's is nullable. The
      // business name is the better identifier anyway when there is no person.
      contactName: (item.contactName ?? item.businessName).slice(0, 200),
      channel: item.channel as DraftChannel,
      // draftSubject is deliberately left unset: the attention feed does not
      // expose the anchor's subject, so ShikksTracker derives "Re: …" itself.
      draftBody,
      ...(snippet ? { replySnippet: snippet.slice(0, 2000) } : {}),
      replyToLogId: item.replyToLogId,
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/chaser.test.ts`
Expected: PASS — every describe block green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chaser.ts src/lib/__tests__/chaser.test.ts
git commit -m "feat: chaser planning — channel filter, idempotency and queue-item mapping"
```

---

### Task 10: The chaser cron route

**Files:**
- Create: `src/app/api/cron/chaser/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireCronSecret } from "@/lib/auth";
import { getOsSettings } from "@/lib/osSettings";
import { fetchAttention } from "@/lib/stApi";
import { generateFollowupDraft } from "@/lib/draftFollowup";
import {
  buildApprovalInput,
  planChaserRun,
  CHASER_ATTENTION_LIMIT,
  CHASER_MAX_PER_RUN,
} from "@/lib/chaser";
import type { SkippedLead } from "@/lib/chaser";
import { buildPushPayload, sendPushToAll } from "@/lib/push";
import ApprovalItem from "@/models/ApprovalItem";
import AgentRun from "@/models/AgentRun";
import FollowupDraftApproval from "@/models/approvals/FollowupDraftApproval";

/**
 * Vercel's per-invocation ceiling for this route. The wall-clock budget below
 * is deliberately well under it so the function always reaches its AgentRun
 * write and its push, rather than being killed with nothing recorded.
 */
export const maxDuration = 60;

/** Stop STARTING new drafts past this point in the run (P4-i). */
const WALL_CLOCK_BUDGET_MS = 45_000;

/**
 * GET /api/cron/chaser
 *
 * Daily. Reads ShikksTracker's replied-but-unanswered feed, drafts a reply per
 * lead, and queues each one for approval. It never sends anything: the
 * Approval Queue is the authorization boundary for agent actions
 * (ARCHITECTURE.md §6), and the outward call happens only when Riku approves.
 *
 * Ordering rules this route obeys (CLAUDE.md):
 *  - every run writes an AgentRun record, success or failure;
 *  - alerts are queued and sent LAST, after all data state is settled, so a
 *    notification failure can never corrupt data;
 *  - one lead's failure never aborts the run — it is counted and the loop moves
 *    on. Nothing is retried in a loop; the human is the escalation path.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = requireCronSecret(request);
  if (guard) return guard;

  const startedAt = new Date();
  const deadline = startedAt.getTime() + WALL_CLOCK_BUDGET_MS;

  let ok = true;
  let error: string | undefined;
  let created = 0;
  let processed = 0;
  let failed = 0;
  const skipped: SkippedLead[] = [];

  try {
    await connectDB();
    const settings = await getOsSettings();

    if (!settings.chaserEnabled) {
      // A disabled agent still records a run, so the watchdog (P5) can tell
      // "switched off" apart from "cron never fired".
      await writeRun(startedAt, true, 0, 0, 0, 0, "chaser is disabled in OsSettings");
      return NextResponse.json({ ok: true, disabled: true });
    }

    const attention = await fetchAttention(settings.chaserNDays, CHASER_ATTENTION_LIMIT);
    processed = attention.repliedUnanswered.length;

    // Idempotency, query layer (P4-e). The unique partial index on
    // { payload.replyToLogId } where status is "pending" is the atomic backstop
    // under this; the E11000 catch below turns a lost race into a skip.
    const anchors = attention.repliedUnanswered.map((i) => i.replyToLogId).filter(Boolean);
    const liveAnchorIds = new Set<string>();
    if (anchors.length > 0) {
      const live = await ApprovalItem.find({
        type: "followup-draft",
        status: { $in: ["pending", "approved", "edited_approved"] },
        "payload.replyToLogId": { $in: anchors },
      })
        .select({ payload: 1 })
        .limit(CHASER_ATTENTION_LIMIT)
        .lean();
      for (const doc of live as unknown as { payload?: { replyToLogId?: string } }[]) {
        if (doc.payload?.replyToLogId) liveAnchorIds.add(doc.payload.replyToLogId);
      }
    }

    const plan = planChaserRun(
      attention.repliedUnanswered,
      liveAnchorIds,
      CHASER_MAX_PER_RUN
    );
    skipped.push(...plan.skipped);

    for (const lead of plan.toDraft) {
      if (Date.now() > deadline) {
        skipped.push({ contactId: lead.contactId, reason: "time-budget" });
        continue;
      }
      try {
        const body = await generateFollowupDraft(
          lead,
          lead.channel as "email" | "facebook",
          new Date()
        );
        await FollowupDraftApproval.create(buildApprovalInput(lead, body, new Date()));
        created++;
      } catch (leadErr) {
        // A duplicate key means the unique index caught a race — that is a
        // skip, not a failure: the item already exists.
        if ((leadErr as { code?: number }).code === 11000) {
          skipped.push({ contactId: lead.contactId, reason: "already-queued" });
        } else {
          failed++;
          console.error(
            `[cron/chaser] lead ${lead.contactId} failed:`,
            leadErr instanceof Error ? leadErr.message : leadErr
          );
        }
      }
    }
  } catch (err) {
    ok = false;
    error = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
  }

  await writeRun(startedAt, ok, created, processed, skipped.length, failed, error);

  // Alerts last (CLAUDE.md). Both branches are wrapped: a push failure must
  // never change the HTTP outcome or the data already written.
  if (!ok) {
    await notify("Chaser run failed", error ?? "Unknown error");
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
  if (created > 0) {
    await notify(
      `${created} follow-up${created === 1 ? "" : "s"} to review`,
      "The chaser drafted replies for leads who never got an answer."
    );
  }
  if (failed > 0) {
    await notify(
      "Chaser: some leads failed",
      `${failed} lead${failed === 1 ? "" : "s"} could not be drafted. Check the logs.`
    );
  }

  return NextResponse.json({
    ok: true,
    created,
    processed,
    failed,
    skipped: summariseSkips(skipped),
  });
}

function summariseSkips(skipped: SkippedLead[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of skipped) out[s.reason] = (out[s.reason] ?? 0) + 1;
  return out;
}

async function writeRun(
  startedAt: Date,
  ok: boolean,
  itemsCreated: number,
  itemsProcessed: number,
  itemsSkipped: number,
  itemsFailed: number,
  error?: string
): Promise<void> {
  try {
    await AgentRun.create({
      agent: "chaser",
      startedAt,
      durationMs: Date.now() - startedAt.getTime(),
      ok,
      counts: { itemsCreated, itemsProcessed, itemsSkipped, itemsFailed },
      ...(error !== undefined ? { error: error.slice(0, 2000) } : {}),
    });
  } catch (runErr) {
    console.error("[cron/chaser] failed to write AgentRun:", runErr);
  }
}

async function notify(title: string, body: string): Promise<void> {
  try {
    await sendPushToAll(buildPushPayload(title, body));
  } catch (pushErr) {
    console.error("[cron/chaser] push could not be sent:", pushErr);
  }
}
```

- [ ] **Step 2: Verify types and the build**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run build`
Expected: `✓ Compiled successfully`, with `/api/cron/chaser` listed in the route table.

- [ ] **Step 3: Smoke-test it locally against the local ShikksTracker**

With ShikksTracker running on 3000 and RikuOS on 3001 (`npm run dev -- -p 3001`):

```bash
curl -s -H "x-cron-secret: <CRON_SECRET from .env.local>" \
  http://localhost:3001/api/cron/chaser
```

Expected on the first run: `{"ok":true,"disabled":true}` — `chaserEnabled` still defaults to `false`. That is the correct behaviour and proves the gate works. Task 11 provides the switch.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/chaser/route.ts
git commit -m "feat: the chaser cron route"
```

---

### Task 11: Settings page and API

**Files:**
- Create: `src/lib/settings.ts`, `src/app/api/settings/route.ts`, `src/app/settings/page.tsx`
- Modify: `src/app/queue/page.tsx` (a link to it)
- Test: `src/lib/__tests__/settings.test.ts`

`/settings` and `/api/settings` are **not** in `src/proxy.ts`'s public allowlist, so both are session-protected with no proxy change. `requireSession` still guards the handler directly (defence in depth).

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/settings.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseSettingsPatch } from "@/lib/settings";

describe("parseSettingsPatch", () => {
  it("accepts a boolean toggle", () => {
    expect(parseSettingsPatch({ chaserEnabled: true })).toEqual({
      ok: true,
      value: { chaserEnabled: true },
    });
  });

  it("accepts a threshold inside the schema range", () => {
    expect(parseSettingsPatch({ chaserNDays: 4 })).toEqual({
      ok: true,
      value: { chaserNDays: 4 },
    });
  });

  it("accepts both together", () => {
    const out = parseSettingsPatch({ chaserEnabled: false, chaserNDays: 30 });
    expect(out).toEqual({ ok: true, value: { chaserEnabled: false, chaserNDays: 30 } });
  });

  it.each([0, 31, -1, 2.5, Number.NaN])("rejects chaserNDays %s", (n) => {
    expect(parseSettingsPatch({ chaserNDays: n }).ok).toBe(false);
  });

  it("rejects a non-boolean toggle", () => {
    expect(parseSettingsPatch({ chaserEnabled: "yes" }).ok).toBe(false);
  });

  it("rejects an empty patch — a no-op PATCH is a typo, not an intention", () => {
    expect(parseSettingsPatch({}).ok).toBe(false);
  });

  it("rejects unknown keys so a typo cannot silently do nothing", () => {
    expect(parseSettingsPatch({ chaserEnable: true }).ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseSettingsPatch(null).ok).toBe(false);
    expect(parseSettingsPatch("chaserEnabled=true").ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/settings.test.ts`
Expected: FAIL — cannot resolve `@/lib/settings`.

- [ ] **Step 3: Write `src/lib/settings.ts`**

```ts
/**
 * settings.ts — validation for PATCH /api/settings. Pure, so the rules are
 * testable without a request or a database.
 *
 * Bounds mirror OsSettings' schema exactly (chaserNDays: integer 1–30). Unknown
 * keys are REJECTED rather than ignored: a silently-dropped "chaserEnable" typo
 * looks identical to a successful save, and this toggle is an agent's kill
 * switch.
 */

import type { OsSettingsPatch } from "@/lib/osSettings";

export type SettingsPatchResult =
  | { ok: true; value: OsSettingsPatch }
  | { ok: false; error: string };

const ALLOWED_KEYS = new Set(["chaserEnabled", "chaserNDays"]);

export const CHASER_N_DAYS_MIN = 1;
export const CHASER_N_DAYS_MAX = 30;

export function parseSettingsPatch(body: unknown): SettingsPatchResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;

  for (const key of Object.keys(b)) {
    if (!ALLOWED_KEYS.has(key)) {
      return { ok: false, error: `Unknown setting "${key}".` };
    }
  }

  const value: OsSettingsPatch = {};

  if ("chaserEnabled" in b) {
    if (typeof b.chaserEnabled !== "boolean") {
      return { ok: false, error: "chaserEnabled must be a boolean." };
    }
    value.chaserEnabled = b.chaserEnabled;
  }

  if ("chaserNDays" in b) {
    const n = b.chaserNDays;
    if (
      typeof n !== "number" ||
      !Number.isInteger(n) ||
      n < CHASER_N_DAYS_MIN ||
      n > CHASER_N_DAYS_MAX
    ) {
      return {
        ok: false,
        error: `chaserNDays must be a whole number between ${CHASER_N_DAYS_MIN} and ${CHASER_N_DAYS_MAX}.`,
      };
    }
    value.chaserNDays = n;
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, error: "No settings were supplied." };
  }
  return { ok: true, value };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/settings.test.ts`
Expected: PASS — every describe block green.

- [ ] **Step 5: Write `src/app/api/settings/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getOsSettings, updateOsSettings } from "@/lib/osSettings";
import { parseSettingsPatch } from "@/lib/settings";

/** GET /api/settings — the singleton's current values. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  await connectDB();
  const settings = await getOsSettings();
  return NextResponse.json({
    settings: { chaserEnabled: settings.chaserEnabled, chaserNDays: settings.chaserNDays },
  });
}

/** PATCH /api/settings — body: { chaserEnabled?: boolean, chaserNDays?: number } */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseSettingsPatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await connectDB();
  const settings = await updateOsSettings(parsed.value);
  return NextResponse.json({
    settings: { chaserEnabled: settings.chaserEnabled, chaserNDays: settings.chaserNDays },
  });
}
```

> `requireSession` treats `PATCH` as a mutating method, so the Origin check applies — which is why `APP_BASE_URL` must match the port RikuOS actually serves on (Task 2 Step 4).

- [ ] **Step 6: Write `src/app/settings/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

interface Settings {
  chaserEnabled: boolean;
  chaserNDays: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [days, setDays] = useState("4");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/settings");
    if (res.status === 401) {
      window.location.href = "/login?from=/settings";
      return;
    }
    if (!res.ok) {
      setError("Could not load settings.");
      return;
    }
    const body = (await res.json()) as { settings: Settings };
    setSettings(body.settings);
    setDays(String(body.settings.chaserNDays));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        settings?: Settings;
        error?: string;
      };
      if (!res.ok || !body.settings) {
        setError(body.error ?? "Could not save.");
        return;
      }
      setSettings(body.settings);
      setDays(String(body.settings.chaserNDays));
      setSaved("Saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1>{APP_NAME} — Settings</h1>
        <Link href="/queue">Queue</Link>
      </header>

      {error && <p className="error">{error}</p>}
      {saved && <p className="meta">{saved}</p>}
      {!settings && !error && <p className="meta">Loading…</p>}

      {settings && (
        <div className="card">
          <p className="meta">Follow-up chaser</p>
          <p>
            Currently <strong>{settings.chaserEnabled ? "on" : "off"}</strong>. When on, it runs
            once each morning, drafts a reply for every lead who answered and got no response,
            and queues each one here for approval. It never sends anything by itself.
          </p>
          <div className="row">
            <button
              disabled={busy}
              className={settings.chaserEnabled ? "danger" : ""}
              onClick={() => void patch({ chaserEnabled: !settings.chaserEnabled })}
            >
              {settings.chaserEnabled ? "Turn the chaser off" : "Turn the chaser on"}
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <label htmlFor="days">
              Chase a lead once they have waited this many days (1–30)
            </label>
            <input
              id="days"
              type="number"
              min={1}
              max={30}
              step={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
            <div className="row">
              <button
                disabled={busy || days === String(settings.chaserNDays)}
                onClick={() => void patch({ chaserNDays: Number(days) })}
              >
                Save threshold
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 7: Link to it from the queue** — `src/app/queue/page.tsx`

Add `import Link from "next/link";` to the imports, and replace the header block:

```tsx
      <header className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1>{APP_NAME} — Queue</h1>
        <span className="row">
          <Link href="/settings">Settings</Link>
          <button className="secondary" onClick={() => void logout()}>
            Log out
          </button>
        </span>
      </header>
```

- [ ] **Step 8: Verify and commit**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run build`
Expected: `✓ Compiled successfully`, with `/settings` and `/api/settings` in the route table.

```bash
git add src/lib/settings.ts src/lib/__tests__/settings.test.ts src/app/api/settings src/app/settings src/app/queue/page.tsx
git commit -m "feat: settings page for the chaser toggle and threshold"
```

---

### Task 12: The retry affordance and the verification escape hatch

**Files:**
- Create: `src/app/api/queue/[id]/retry/route.ts`, `scripts/resolve-action.mts`
- Modify: `src/app/queue/page.tsx`

- [ ] **Step 1: Write `src/app/api/queue/[id]/retry/route.ts`**

```ts
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { buildActionRetry, runApprovalAction } from "@/lib/queue";
import ApprovalItem from "@/models/ApprovalItem";
import "@/models/approvals/FollowupDraftApproval"; // register the discriminator

/**
 * POST /api/queue/:id/retry
 *
 * Re-runs the action for an item whose previous attempt PROVABLY had no side
 * effect. The guarded update accepts `actionStatus: "failed"` and nothing else,
 * so an item parked as `needs_verification` can never be retried through this
 * route — a human checks ShikksTracker's lane first (CLAUDE.md: never guess).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
  }

  await connectDB();

  const { filter, update } = buildActionRetry();
  // Base-schema paths only, so the base model is safe here (see the note on
  // approvalModelForType in src/lib/queue.ts).
  const reset = await ApprovalItem.findOneAndUpdate({ _id: id, ...filter }, update, { new: true });

  if (!reset) {
    return NextResponse.json(
      {
        error:
          "Only an action that failed with no side effect can be retried. " +
          "An item awaiting verification must be checked in ShikksTracker first.",
      },
      { status: 409 }
    );
  }

  await runApprovalAction(reset);

  const fresh = await ApprovalItem.findById(id).lean();
  return NextResponse.json({ item: fresh });
}
```

- [ ] **Step 2: Write `scripts/resolve-action.mts`** — the way out of `needs_verification`

```ts
/**
 * resolve-action.mts — resolve an ApprovalItem parked as `needs_verification`.
 *
 * `needs_verification` means the outward action MAY have taken effect. There is
 * deliberately no button for it: the only safe resolution starts with a human
 * looking at the contact's lane in ShikksTracker.
 *
 *   Draft is THERE      -> the action worked -> resolve as done
 *   Draft is NOT there  -> nothing happened  -> resolve as failed, then use the
 *                          Retry button in the queue
 *
 * USAGE
 *   npm run action:resolve -- --id <ApprovalItem _id> --as done
 *   npm run action:resolve -- --id <ApprovalItem _id> --as failed
 */

import mongoose from "mongoose";
import ApprovalItem from "../src/models/ApprovalItem.ts";
import "../src/models/approvals/FollowupDraftApproval.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main(): Promise<number> {
  const uri = process.env.MONGODB_URI;
  const id = arg("id");
  const as = arg("as");

  if (!uri) {
    console.error("MONGODB_URI is not set (read from .env.local via node --env-file).");
    return 1;
  }
  if (!id || (as !== "done" && as !== "failed")) {
    console.error(
      "Usage: npm run action:resolve -- --id <ApprovalItem _id> --as done|failed\n" +
        "  done   the draft IS in ShikksTracker's lane (the action worked)\n" +
        "  failed the draft is NOT there (nothing happened; Retry is then safe)"
    );
    return 1;
  }

  await mongoose.connect(uri, { bufferCommands: false, serverSelectionTimeoutMS: 10_000 });
  console.log(`Database: ${mongoose.connection.db?.databaseName ?? "(unknown)"}`);

  // Guarded: only a parked item moves, so this can never overwrite a live result.
  const updated = await ApprovalItem.findOneAndUpdate(
    { _id: id, actionStatus: "needs_verification" },
    {
      $set: {
        actionStatus: as,
        actionAt: new Date(),
        actionError: `Resolved by hand as "${as}" after checking ShikksTracker.`,
      },
    },
    { new: true }
  );

  if (!updated) {
    console.error(`No item ${id} with actionStatus "needs_verification". Nothing changed.`);
    await mongoose.disconnect();
    return 1;
  }

  console.log(`Item ${id} is now actionStatus "${as}".`);
  if (as === "failed") console.log("Use the Retry button in the queue to run the action again.");
  await mongoose.disconnect();
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch(async (err) => {
    console.error("Resolve failed:", err instanceof Error ? err.message : err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
```

- [ ] **Step 3: Surface the new states in the queue** — `src/app/queue/page.tsx`

Add a `retry` helper next to `decide`:

```tsx
  async function retry(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/queue/${id}/retry`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Retry failed.");
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }
```

Replace the `item.actionError` line with a version that renders a `done` note in grey (the 409-duplicate case is information, not an error) and everything else in red, and add the retry button plus the verification instruction:

```tsx
            {item.actionError && (
              <p className={item.actionStatus === "done" ? "meta" : "error"}>
                {item.actionStatus === "done" ? "Note: " : "Action error: "}
                {item.actionError}
              </p>
            )}

            {item.actionStatus === "failed" && (
              <div className="row">
                <button className="secondary" disabled={busyId === item._id} onClick={() => void retry(item._id)}>
                  Retry action
                </button>
              </div>
            )}

            {item.actionStatus === "needs_verification" && (
              <p className="error">
                This may or may not have reached ShikksTracker. Open the contact there and check
                whether the draft exists before doing anything else. There is no retry button on
                purpose.
              </p>
            )}
```

- [ ] **Step 4: Register the script** — already added to `package.json` in Task 2 Step 1. Confirm the `action:resolve` entry is present.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

```bash
git add src/app/api/queue/[id]/retry scripts/resolve-action.mts src/app/queue/page.tsx
git commit -m "feat: retry a provably-safe failed action; escape hatch for parked ones"
```

---

### Task 13: Cron schedule and the stale-action sweep

**Files:**
- Modify: `vercel.json`
- Modify: `src/app/api/cron/expire/route.ts`

- [ ] **Step 1: Add the chaser cron** — `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "regions": ["hkg1"],
  "crons": [
    { "path": "/api/cron/expire", "schedule": "0 21 * * *" },
    { "path": "/api/cron/chaser", "schedule": "0 23 * * *" }
  ]
}
```

Schedules are UTC and Manila is UTC+8, so `0 21` is 05:00 Manila (expiry first) and `0 23` is 07:00 Manila (the chaser, matching ROADMAP 4.4's "daily, morning Manila"). Riku wakes to a queue that has already been swept.

> **Two crons is the Vercel Hobby ceiling.** P5's watchdog, site-health and dispatcher crons will not fit alongside these. That is a P5 problem — the likely resolutions are one multiplexing cron route or a plan upgrade — but note it here so it is not discovered as a deploy failure.

- [ ] **Step 2: Add the stale-action sweep to the expiry cron** — `src/app/api/cron/expire/route.ts`

Change the import line:

```ts
import { buildActionSweep, buildExpirySweep } from "@/lib/queue";
```

Replace the sweep block inside the `try`:

```ts
  const startedAt = new Date();
  let expired = 0;
  let unstuck = 0;
  let ok = true;
  let error: string | undefined;

  try {
    await connectDB();
    const now = new Date();

    const expiry = buildExpirySweep(now);
    expired = (await ApprovalItem.updateMany(expiry.filter, expiry.update)).modifiedCount;

    // P4: an action claimed but never resolved means the function died between
    // the outward call and recording its result — the side effect may or may
    // not have landed. Park it for a human rather than leaving an in-flight
    // state behind (CLAUDE.md).
    const stuck = buildActionSweep(now);
    unstuck = (await ApprovalItem.updateMany(stuck.filter, stuck.update)).modifiedCount;
  } catch (err) {
    ok = false;
    error = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
  }
```

Update the `AgentRun` write and the success response:

```ts
      counts: { itemsCreated: 0, itemsProcessed: expired + unstuck },
```

```ts
  if (unstuck > 0) {
    try {
      await sendPushToAll(
        buildPushPayload(
          "Interrupted actions need checking",
          `${unstuck} approved item${unstuck === 1 ? "" : "s"} could not confirm their result.`
        )
      );
    } catch (pushErr) {
      console.error("[cron/expire] stale-action alert could not be sent:", pushErr);
    }
  }

  return NextResponse.json({ ok: true, expired, unstuck });
```

(The alert stays below the `AgentRun` write and above the return, keeping alerts last.)

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit && npm run build`
Expected: both clean; the route table shows two crons.

```bash
git add vercel.json src/app/api/cron/expire/route.ts
git commit -m "feat: daily chaser cron and a sweep for interrupted actions"
```

---

### Task 14: 🙋 RIKU — index migration

**This task is Riku's hands only.** Mongoose never *alters* an existing index, so Task 4's two new indexes ship with a run of the dry-run-by-default sync script (CLAUDE.md).

- [ ] **Step 1: Dry run first — it changes nothing**

```bash
npm run migrate:indexes
```

Expected under `── ApprovalItem`: two `CREATE` lines — one for `{"payload.replyToLogId":1}` with `unique` and the partial filter, one for `{"actionStatus":1,"actionStartedAt":1}`.

**Read every `DROP` line before continuing.** `syncIndexes()` drops any index on the collection that the schema does not declare. There should be none; if one appears and it was added by hand in Atlas, stop and decide deliberately.

- [ ] **Step 2: Apply**

```bash
npm run migrate:indexes:apply
```

Expected: `applied (syncIndexes dropped: [])`.

- [ ] **Step 3: If the unique index fails with E11000**

The `rikuos` database already holds P3-seeded items. A duplicate-key error here means two or more **pending** items share one `payload.replyToLogId`. P3 seeds have no `replyToLogId` at all and are excluded by the partial filter, so this should not happen — but if it does, reject or expire the extra items in the queue UI (which moves them out of `pending`) and re-run Step 2. Never drop the index to make the error go away: it is the backstop against a duplicate message.

- [ ] **Step 4: Confirm**

```bash
npm run migrate:indexes
```

Expected: `All collections already match their schemas.`

---

### Task 15: The verification trio

**Nothing is complete until all three are green** (CLAUDE.md).

- [ ] **Step 1: Tests**

Run: `npm test`
Expected: PASS — the P3 suite plus the new `stApi`, `chaser`, `draftFollowup` and `settings` files, and the additions to `queue` and `models`. Zero failures, zero skipped.

- [ ] **Step 2: Types**

Run: `npx tsc --noEmit`
Expected: no output (exit 0).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`. Confirm the route table lists `/api/cron/chaser`, `/api/settings`, `/api/queue/[id]/retry` and `/settings`.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: green verification trio for P4"
```

---

### Task 16: 🙋 RIKU — deploy and set the production environment

**This task is Riku's hands only.**

- [ ] **Step 1: Set the three new env vars on RikuOS's Vercel project**

Vercel dashboard → the **riku-os** project → Settings → Environment Variables → scope **Production**:

| Name | Value |
|---|---|
| `ST_API_BASE_URL` | `https://<shikkstracker-prod-host>` — **the production host, not `localhost`.** No trailing slash, no `/api`. |
| `ST_API_SECRET` | the exact value set as `OS_API_SECRET` on ShikksTracker in Task 1 |
| `ANTHROPIC_API_KEY` | the Anthropic key |

Optionally `ANTHROPIC_MODEL` if you want to pin something other than `claude-opus-5`.

> Getting `ST_API_BASE_URL` wrong here is the single most likely deployment mistake in P4, and it does not announce itself: `localhost` on Vercel fails as a connection error inside the cron, visible only as a failed `AgentRun` and a push alert.

- [ ] **Step 2: Push and deploy**

```bash
git push
```

Vercel builds `master`. Wait for the deployment to finish — env vars are read at runtime for these routes, but a fresh deployment is the clean way to be sure both are in place.

- [ ] **Step 3: Verify the cron endpoint is reachable and correctly gated**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://riku-os.vercel.app/api/cron/chaser
```

Expected: `401` — no secret, correctly refused.

```bash
curl -s -H "x-cron-secret: <CRON_SECRET>" https://riku-os.vercel.app/api/cron/chaser
```

Expected: `{"ok":true,"disabled":true}` — the route works and the toggle is still off.

- [ ] **Step 4: Confirm both crons are registered**

Vercel dashboard → riku-os → Settings → Cron Jobs. Expected: two entries, `/api/cron/expire` at `0 21 * * *` and `/api/cron/chaser` at `0 23 * * *`.

- [ ] **Step 5: Check `/settings` on the phone**

Open the installed PWA from the home screen, tap **Settings**. Expected: the page loads and shows the chaser as **off**. Leave it off for now — Task 17 turns it on deliberately.

---

### Task 17: 🙋 RIKU — the v0 acceptance test

**This task is Riku's hands only, and it is the definition of done.**

> **Done when (v0 🏁, ratified S1):** the chaser catches one *real* missed follow-up, Riku approves it on the phone, and the message goes out to the lead.

An agent feature is only actually done when it has been observed doing its job once against real data (CLAUDE.md). The verification trio in Task 15 is necessary and not sufficient.

- [ ] **Step 1: Confirm there is a real subject to catch**

```bash
curl -s -H "x-os-secret: <the secret>" \
  "https://<shikkstracker-prod-host>/api/os/attention?days=4&limit=20"
```

Expected: `repliedUnanswered` contains at least one entry whose `channel` is `email` or `facebook` and whose `replyToLogId` is non-empty.

If the array is empty: lower the threshold on `/settings` (e.g. to 1 day) so a more recent reply qualifies, or wait until a real lead replies. **Do not fabricate a contact to pass this test** — the acceptance bar is a real missed follow-up.

- [ ] **Step 2: Turn the chaser on, from the phone**

Open the PWA → **Settings** → set the threshold → **Turn the chaser on**. Expected: the card reads "Currently **on**".

- [ ] **Step 3: Trigger a run manually rather than waiting for 07:00**

```bash
curl -s -H "x-cron-secret: <CRON_SECRET>" https://riku-os.vercel.app/api/cron/chaser
```

Expected: `{"ok":true,"created":N,...}` with `N ≥ 1`, plus a `skipped` breakdown you can read (`unsupported-channel`, `already-queued`, and so on — nothing is silent).

- [ ] **Step 4: The push lands on the lock screen**

Expected: a notification titled "N follow-ups to review". Tapping it opens `/queue`.

- [ ] **Step 5: Read the draft on the phone and judge it**

Expected on the card: the business name in the title, how long they have waited, the lead's own words under "Their reply", and a draft that actually answers what they said — in the language they wrote in.

If the wording is wrong, **use Edit**. That path is part of the acceptance test: an edited approval must carry the reply anchor through (Task 5), and this is the real-data proof of it.

- [ ] **Step 6: Approve**

Tap **Approve** (or **Approve edited**). Expected: the card flips to `approved · action done` within a second or two.

- `action failed` → read the error. `HTTP 422` usually means the contact became uncontactable; `HTTP 401/503` means the secret is wrong or unset on ShikksTracker. Fix the cause, then **Retry action**.
- `needs_verification` → do **not** retry. Open the contact in ShikksTracker and check whether the draft exists, then resolve it with `npm run action:resolve` as documented in that script.

- [ ] **Step 7: The draft is really in ShikksTracker**

Open ShikksTracker and find the contact.

- **email** → the log is in the approved queue with `origin: "rikuos"`, threaded onto the original conversation. It sends on the next hourly cron inside the 08:00–18:00 Asia/Manila window, subject to `SENDS_PER_RUN`. It will not send at 07:00; that is correct behaviour, not a failure.
- **facebook** → the draft is in the Messenger lane for copy-paste. Send it yourself. Cold Messenger sends stay manual forever (D2); this is you sending, which is the design.

- [ ] **Step 8: The message reaches the lead**

Expected: for email, the log flips to `sent` after the send cron runs, and the message appears in the Gmail thread. For facebook, you have pasted and sent it.

**This step is the v0 finish line.** When it is true, P4 is done and RikuOS has paid rent for the first time.

- [ ] **Step 9: Confirm the loop closes**

Trigger the chaser once more:

```bash
curl -s -H "x-cron-secret: <CRON_SECRET>" https://riku-os.vercel.app/api/cron/chaser
```

Expected: that contact is **not** proposed again — ShikksTracker's attention feed excludes contacts with a pending draft, and RikuOS's own anchor check excludes anchors with a live queue item. Two independent guards, both proven in one call.

- [ ] **Step 10: Record it**

Update `docs/ROADMAP.md`'s P4 section the way P3's was recorded, with the date and the evidence:

```markdown
**DONE 2026-__-__** — v0 🏁. The chaser caught a real missed follow-up for <business>,
approved on the phone, and the message went out. Evidence: Task 17 in the P4 plan.
```

Then commit:

```bash
git add docs/ROADMAP.md
git commit -m "docs: close P4 and mark the v0 finish line reached"
```

---

## Self-review against the spec

**ROADMAP P4 coverage**

| Task | Covered by |
|---|---|
| 4.1 ShikksTracker API client (`ST_API_BASE_URL` + `ST_API_SECRET`, typed responses, timeouts) | Task 3 |
| 4.2 Chaser cron: attention → per-lead draft via Anthropic → `ApprovalItem` (capped, idempotent per lead+reply) | Tasks 8, 9, 10 (cap: `CHASER_MAX_PER_RUN` + wall clock; idempotency: query filter + unique partial index) |
| 4.3 Approve action → `POST /api/os/drafts`; push on new items; `AgentRun` per run | Tasks 6, 7 (action), 10 (push + run record) |
| 4.4 Vercel cron schedule (daily, morning Manila); `OsSettings` toggle + N-days threshold | Tasks 11, 13 |
| 4.5 Tests: attention→item mapping, idempotency, action call | Tasks 3, 5, 6, 7, 8, 9, 11 — all DB-less |
| Done when (S1) | Task 17 |

**Cross-cutting requirements**

- Prime directive: nothing in `../ShikksTracker` is edited; the one missing field is recorded as a proposed spec addition rather than worked around.
- Asymmetric failure semantics: the failure contract table, `classifyDraftStatus`, `classifyFetchError`, and the `failed` / `needs_verification` split.
- No in-flight state left behind: `buildActionSweep` runs in the daily expiry cron.
- Alerts last: both cron routes queue every push after the `AgentRun` write.
- Bounded strings and enums: every new schema field has a `maxlength` or an `enum`; every list query has a limit.
- No secret in logs: `readStConfig` omits the value from its errors, and `describeError` never reads the config.
- Manual steps: Tasks 1, 14, 16 and 17 are Riku's hands only and are labelled as whole tasks, not buried in prose.

**Type consistency**

`AttentionItem`, `DraftRequest`, `DraftOutcome` (Task 3) are the same shapes used in Tasks 7, 8 and 9. `ActionOutcome` / `ActionResultStatus` (Task 6) are what `executeFollowupDraft` returns (Task 7). `IFollowupDraftPayload.replyToLogId` (Task 4) is the field read in Tasks 5, 7 and 9 and indexed in Task 4. `OsSettingsPatch` (existing) is what `parseSettingsPatch` returns (Task 11).
