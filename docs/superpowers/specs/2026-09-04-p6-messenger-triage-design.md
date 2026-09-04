# P6 — Inbound Messenger triage (design)

**Date:** 2026-09-04 · **Status:** ratified design, awaiting implementation planning
**Scope:** `ROADMAP.md` P6 tasks 6.1–6.3 — repo: RikuOS, plus one OS-API contract addition executed in ShikksTracker
**Not in scope:** call-time proposals (dropped from P6, see D3 below) · any auto-send · any change to how ShikksTracker stores conversations

**Goal in one line:** someone messages the RIKU page, and within a minute Riku's phone carries a drafted reply he can send with one tap — without opening Messenger, and without anything leaving the page that he has not read.

---

## Why this phase changed shape before it started

P6 was specced in August. Three of its assumptions did not survive contact with decisions taken since, and the phase is smaller and simpler as a result. Recording this so the executing session does not "restore" any of it from the older text.

1. **The auto-acknowledgment carve-out is gone (S14).** The concept ratified triage acknowledging inbound messages itself, and `CLAUDE.md` carried it as "the sole exception". Riku revoked it on 2026-09-04. Everything triage produces is drafted and queued.
2. **The send path moved repos (S9).** The old 6.3 had RikuOS sending via the Meta page token. It cannot hold one: regenerating that token in Meta's console invalidates the previous copy, so RikuOS's would fail *silently, mid-window*. ShikksTracker sends; RikuOS asks it to.
3. **Call-time proposals are dropped, not deferred within the phase.** They need to know when Riku is free, and RikuOS has no calendar until P10. Riku's call: ship acknowledgment and FAQ answers now, add call times once the calendar exists.

---

## State that is not derivable from this repo

Established 2026-09-04. Do not re-derive; do not assume the opposite.

1. **P2 is live in ShikksTracker** (`origin/main`, merge `cf87344`). Its webhook receives `messages` and `message_echoes`, stores each idempotently by `mid`, and exposes liveness through `summary.messenger.lastEventAt`. Verified against the live API: a real, same-day timestamp.
2. **ShikksTracker holds `META_PAGE_TOKEN` and RikuOS must never hold a copy** (S9). Its `docs/meta-setup.md` states that generating a token invalidates the previous one.
3. **`AgentRun` already carries a `triage` agent slot.** P3 built it ahead of this phase; it is currently unused. No enum change is needed for run records.
4. **`ApprovalItem` has exactly one registered discriminator** — `FollowupDraftApproval` (P4). P6 registers the second. The conventions are set and non-obvious: discriminator files live in `src/models/approvals/`, import the base with a **relative path and an explicit `.ts` extension** (the index-sync script runs under `node --experimental-strip-types`, which does not resolve the `@/` alias), use `import type` for interfaces, and **never declare an index on a discriminator schema** — Mongoose would create it and the next migration would drop it.
5. **Vercel Hobby allows two cron jobs.** Both are used (`chaser`, `morning`). P6 adds **no cron** — it is webhook-driven — so this is not a constraint here, but the stale-sweep it needs must ride inside the existing morning route.
6. **The 24-hour window is Meta's, not ours.** Outside it, the API refuses to send. This is a hard deadline, not a preference.
7. **Riku's services content lives in an Obsidian vault that nothing deployed can read** — local, not a git repo. It is a source to draft from, not a feed.

---

## Decisions settled in this session

| # | Decision | Why |
|---|----------|-----|
| D1 | **Nothing auto-sends. Every triage output is an `ApprovalItem`.** | S14. The approval queue becomes the single boundary with no special cases, checkable by reading for one pattern, and no future feature can cite an exception as precedent. |
| D2 | **One item per inbound conversation, carrying both a holding reply and a substantive answer.** | Two items per message would double the queue for one decision. Riku picks which text to send, or edits either. |
| D3 | **No call-time proposals.** | Needs calendar availability, which arrives in P10. Riku's call: ship the two-thirds that work now. |
| D4 | **Answers are drafted by the Anthropic API from a knowledge block, not matched from stored Q&A pairs.** | Same pattern the chaser already proves. Handles unanticipated questions. A stored-pairs approach buys safety that S14's human tap already provides, at the cost of a CRUD screen to maintain. |
| D5 | **The knowledge block lives in `OsSettings`, editable in-app, with a `reviewedAt` stamp.** | Its source is a local vault that cannot be synced. Drift is therefore certain; the stamp makes it *visible* rather than pretending it won't happen. |
| D6 | **The block carries an explicit "never claim / always defer" list.** | Riku had zero paid clients as of August 2026 and the vault records no portfolio URLs or contact details. An LLM given silence improvises, and a draft inventing client work is the worst realistic failure of this feature. Bounding it structurally beats hoping the model is careful. |
| D7 | **`staleAt` is the window's close, not an age.** | The deadline is external and absolute. An item expiring means the chance to reply is gone, which is a different fact from an item going stale. |
| D8 | **A new item pushes immediately; it does not wait for the morning digest.** | With no auto-send, the push is the only thing that can reach Riku inside a 24-hour window. This makes it load-bearing rather than a convenience. |
| D9 | **ShikksTracker executes the send; RikuOS asks.** | S9 — the token lives there. Also keeps the outbound message inside the system that already records echoes, so a sent reply logs itself. |
| D10 | **Forwarding is push, not polling.** | Triage is time-sensitive inside the window; a poll interval is latency added to a deadline for no benefit. |
| D11 | **Every setting Riku has not filled in yet has a defined safe degradation, and the feature ships without them.** | Riku's call, 2026-09-04: build now, fill the content in later. A placeholder that merely blanks a variable produces an LLM improvising into the hole, which is the exact failure D6 exists to prevent. Each one therefore has a *specified* behaviour, tested, not an empty string. |

---

## Flow

```
Meta → ShikksTracker webhook (existing, P2)
         │  stores the message by mid, applies reply effects
         └─► NEW: forwards inbound event to RikuOS  ──┐
                                                       ▼
                          POST /api/messenger/inbound (RikuOS, secret-gated)
                                   │ validates, dedups by mid
                                   │ drafts via Anthropic + knowledge block
                                   │ writes ONE ApprovalItem (staleAt = window close)
                                   │ writes an AgentRun (agent: "triage")
                                   └─► web push to the iPhone
                                                       │
                                          Riku taps approve / edit / reject
                                                       ▼
                          POST /api/os/messenger-reply (ShikksTracker, NEW)
                                   sends within the window using the page token
```

**Fast 200 on the forward.** RikuOS acknowledges the forward before drafting. ShikksTracker's webhook must never block on RikuOS's Anthropic call — a slow draft cannot be allowed to make Meta retry a delivery that already succeeded.

**Dedup by `mid`.** Meta redelivers. The forward carries the message id and RikuOS treats it as the idempotency key, exactly as ShikksTracker does.

---

## The knowledge block

One bounded string in `OsSettings`. A first draft exists (3,798 characters), synthesised from `Services/`, `Operations/` and the contracts index in Riku's vault.

**Shape, in three parts:**

1. **Facts** — packages, price ranges, durations, revision rounds, maintenance tiers, payment terms, what the client provides, what he does not do.
2. **Rules for the draft** — prices are starting ranges, never a quote; never commit to a final price or a live date in a message; ask two or three questions and propose a next step.
3. **Never claim / always defer** (D6) — the list of things the block must explicitly refuse: any URL not given to it, any client name not on the approved list, availability or start dates, receipts and tax status, and anything about scope that the vault marks as needing a call first.

**Two settings ride alongside it**, so the block itself stays prose:

- `nameableProjects` — the projects a draft may mention, with a one-line description each. Riku's list, not inferred.
- `demoSiteUrls` — per-package example links. **Empty at time of writing.** A draft must never invent one; when the entry is absent it falls back to naming projects or offering examples in conversation.

**Length is a running cost.** The block enters every draft's prompt, so it is charged on every inbound message. 4,000 characters is the cap.

---

## Pending Riku's input — and what happens until it arrives

Three settings are empty at build time by decision (D11). None blocks the phase; each has a
specified degradation, and each is pinned by a test, because "safe when unconfigured" is a claim
that rots silently the moment someone refactors it.

| Setting | Empty state | Behaviour until filled |
|---|---|---|
| `knowledgeReviewedAt` | `null` — the block exists but Riku has not approved it | **`answerText` is not generated at all.** The item carries the holding reply only, and the queue card says why. This is the important one: the block states his real prices, and a draft quoting a number he has never read is worse than no draft. Triage still works, still pushes, still gives him a one-tap reply — it just does not speak about money yet. |
| `nameableProjects` | `[]` | The draft names no client or project. Asked for examples, it offers to walk through relevant work in conversation. It may never name a project that is not on this list, whatever the vault or the model happens to know. |
| `demoSiteUrls` | `{}` | No URL appears in the draft. **The draft may not emit a URL that was not supplied to it** — pinned by its own test, because an invented link is the most plausible way this feature embarrasses him in front of a prospect. |

The queue card shows which of these are unset, so the reason a draft is thin is visible where he is
already looking rather than buried in settings.

**A consequence worth stating:** with all three empty, P6 delivers "an inbound message reaches your
phone within a minute with a one-tap holding reply." That is already most of the value — it is the
part that beats opening Messenger — and it is honest about being the floor rather than the finished
feature.

---

## Data model

**New discriminator: `TriageResponseApproval`** (`type: "triage-response"`, which the roadmap and `ARCHITECTURE.md` §3.1 already name).

Payload, all bounded, no `Mixed`:

- `conversationId`, `messageId` — opaque ShikksTracker/Meta identifiers. RikuOS never touches that database.
- `senderName` — as ShikksTracker resolved it; may be a PSID placeholder for an unlinked conversation.
- `inboundText` — what they actually said, shown on the queue card.
- `holdingText` — the one-tap acknowledgment.
- `answerText` — the substantive draft.
- `chosenText` — which one was sent, stamped on approval. This is why one item can carry two options without a second status enum.
- No `windowClosesAt`. An earlier draft of this design mirrored it into the payload for the queue card; that is the same value as the base schema's `staleAt` (D7), and two copies of a deadline is exactly how they drift apart. The card reads `staleAt`.

`OsSettings` gains: `triageEnabled`, `knowledgeBlock`, `knowledgeReviewedAt`, `nameableProjects`, `demoSiteUrls`.

**No new indexes on the discriminator** (see State §4). The base schema's existing `{status, staleAt}` index serves the sweep.

---

## Failure handling

Follows `CLAUDE.md`'s asymmetric rule, and the classification matters more here than usual because the window closes.

| Failure | Class | Handling |
|---|---|---|
| Forward never arrives | Before side effect | Nothing to retry from RikuOS's side. Detectable: `messenger.lastEventAt` advances in the summary while no `triage` run exists — the data already flows. Whether closing it belongs in this phase is Open item 2, not settled here. |
| Anthropic call fails | Before side effect | Item is still created, with `answerText` empty and the holding reply intact, so Riku can still respond in one tap. A draft failure must not cost him the window. |
| Send call fails, response received | Before side effect | Safe to retry — `actionStatus: failed`, retryable from the queue. |
| Send call times out, outcome unknown | **After or unknown** | Park. `actionStatus: failed` with an explicit note to check the Messenger thread. Never auto-retry: a duplicate reply to a prospect is worse than a late one. |
| Window closes before Riku taps | Not a failure | Swept to `expired` with a note. Recorded, not alarmed — an expiry is information, and alarming on it daily would train him to ignore the queue. |

**Alerts last, always.** The push is sent after the item and the run record are written, so a push failure can never leave a drafted reply unrecorded.

---

## Cross-repo contract — one handoff, not two

Both changes are OS-API surface and travel together. They can ride with the token-health ask already written up in `docs/handoffs/2026-09-04-meta-token-health.md`.

1. **Forwarding hook** — ShikksTracker's webhook handler, after storing an inbound message, POSTs a small event to a RikuOS endpoint with a shared secret. Fire-and-forget with a timeout: RikuOS being down must never break message ingestion or make Meta retry.
2. **`POST /api/os/messenger-reply`** — accepts a conversation id and text, sends via the page token inside the window, records the outbound message. Returns a classified result, so RikuOS can tell "refused, window closed" apart from "failed, retry safe."

Neither is written from this repo (prime directive). Both are proposed, and ShikksTracker's session decides their shape.

---

## Testing and acceptance

Tests live beside the logic in `src/lib/__tests__/`. Route handlers stay thin.

- Inbound event parsing, against a **recorded real forward**, not a hand-written fixture.
- Dedup by `mid` — a redelivered event produces no second item.
- Window arithmetic: `staleAt` is the inbound message's timestamp plus 24 hours, and an item created 23 hours in is still actionable while one at 25 is expired.
- Draft composition: the knowledge block reaches the prompt; an absent `demoSiteUrls` entry produces no URL in the output.
- The three failure classifications above, each pinned.
- **A silence test, in the spirit of the ones that guard the monitor:** a draft must never contain a URL that was not supplied to it. This is the assertion that catches an invented portfolio link.

**Done when:** a real message to the RIKU page reaches Riku's phone within a minute, and one tap sends a reply that appears in the Messenger thread — without him opening Messenger. Verified against a real conversation, per the repo's standard that a feature is done when it has been observed doing its job once against real data.

---

## Manual steps — Riku's hands only

- [ ] Confirm the nameable-projects list, in particular the three that belong to real businesses or organisations (Azerotech, Meowchi, Empathora). Nothing in the vault records permission.
- [ ] Supply demo-site URLs when they exist, or leave the setting empty — the draft degrades safely.
- [ ] Review the knowledge block before triage is switched on. It states his prices; he is the only person who can approve that.
- [ ] Run the ShikksTracker session for the two contract additions.
- [ ] Fix three vault inconsistencies found while drafting the block, which mislead him as well as the model: A4 retired in `Services Overview` but still routed in `03` and `04`; A3-Lite's care tier (₱750 vs ₱2,500); A1's standalone value (₱7,900 vs ₱8,600).

---

## Non-goals

Call-time proposals (P10+) · any auto-send, ever, without a new decision in `ARCHITECTURE.md` §7 · a Q&A-pair editor · reading the Obsidian vault at runtime · changing ShikksTracker's conversation storage · a cron (this phase is webhook-driven) · handling messages older than the window.

---

## Open items for the executing session

1. **Unlinked conversations.** A message from a PSID with no linked contact still deserves a reply. Confirm the card reads sensibly without a contact name, and that drafting does not depend on contact context the way the chaser's does.
2. **Whether the watchdog should notice a missing forward** (see Failure handling row 1). It is a real gap and the data to detect it already flows. Decide during planning whether it belongs in this phase or is written up as a follow-up.
3. **Prompt shape** — the chaser's Taglish handling in `src/lib/draftFollowup.ts` is proven and should be read before writing a second drafting prompt, not reinvented.
