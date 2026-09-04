# Handoff — the two P6 contracts ShikksTracker must build → ShikksTracker

**Written 2026-09-04 from the RikuOS repo. Disposable.**

> **Delete this file in the post-v0 cleanup**, along with any pointer line to it in
> `docs/ROADMAP.md` or `ARCHITECTURE.md` §7. No such pointer exists as of writing — this is a new
> proposal, not a ratified decision. It exists only to carry two contract requests across the repo
> boundary (S4). Once ShikksTracker builds against them, the durable record is its own
> `docs/os-api.md` (which already documents every other `/api/os/*` endpoint) plus whatever RikuOS
> decision this becomes in `ARCHITECTURE.md` §7 — not this file.

## Why this exists

RikuOS's P6 (inbound Messenger triage) is built, merged to `master`, and green. It cannot do
anything yet, because the two things it depends on both live on the other side of the repo
boundary and neither exists:

1. **A hook that tells RikuOS a message arrived.** ShikksTracker's Messenger webhook (P2) already
   receives and stores inbound events. Nothing forwards them to RikuOS.
2. **An endpoint that actually sends a reply.** RikuOS drafts; it never sends (S14, no exceptions).
   The send has to happen in ShikksTracker, because ShikksTracker holds `META_PAGE_TOKEN` and
   RikuOS may not hold a copy — regenerating a page token in Meta's console invalidates the
   previous one, so a copy sitting in RikuOS's env would go dead the moment Riku rotates the real
   one, and fail **silently, mid-window**, exactly the failure mode S9 already rejected once for
   the token-health check. Same reasoning, same conclusion, second endpoint.

RikuOS cannot build either side of this itself (prime directive: never edit ShikksTracker's code
from here, never touch its database). This file carries the request across, the same way the
2026-08-30 and 2026-09-04 handoffs before it did.

**This is not a loose sketch.** RikuOS's code already enforces specific behaviour against these two
endpoints — a validation module that rejects malformed timestamps and over-long ids, and a response
classifier in `src/lib/stApi.ts` that reads an HTTP status and a JSON body and decides whether a
message might get sent twice. That classifier's own header comment (lines 17–39) already states the
messenger-reply contract as a **requirement being imposed on an endpoint that does not exist yet**,
not an observed fact — this document is that requirement, written out in full for the other side.

## The two contracts, pinned

### 1. The forwarding hook: ShikksTracker → RikuOS

After ShikksTracker's webhook handler stores an inbound message, it should also fire:

```
POST <RikuOS base origin>/api/messenger/inbound
Header: x-forward-secret: <MESSENGER_FORWARD_SECRET>
Content-Type: application/json

{
  "mid": "...",
  "conversationId": "...",
  "senderName": "Ana",
  "text": "...",
  "sentAt": "2026-09-04T14:32:07Z"
}
```

**Only inbound messages.** Meta's `message_echoes` are Riku's own sends (through ShikksTracker or
by hand in Meta's own UI). Forwarding one would make RikuOS draft a reply to Riku's own message.

**Fire-and-forget, with a short timeout, and do not await it in the webhook's response path.**
RikuOS being slow or down must never delay ShikksTracker's 200 back to Meta — a webhook that
doesn't return fast makes Meta retry a delivery that already succeeded, which is its own class of
duplicate-handling bug. One wrinkle worth building around: a RikuOS draft can legitimately take up
to ~40 seconds when the model is slow (RikuOS's own route budgets `maxDuration = 60` and assumes a
worst case near 40s for the draft call alone — see `src/app/api/messenger/inbound/route.ts` lines
12–21). The forward's own timeout must sit well under that, and a timeout on the forward call must
**not** be treated as a failure of ingestion — RikuOS answers `200` for everything it understood
(see "What RikuOS returns" below) well before the draft step even starts in some paths, and in
others the draft itself is what's taking the time. A short forward timeout just means ShikksTracker
stops waiting for the acknowledgment; it says nothing about whether RikuOS is actually working.

**Field limits, exactly as RikuOS enforces them** (`src/lib/triage.ts`, `parseInboundEvent`):

| field | required | limit | over-limit behaviour | why |
|---|---|---|---|---|
| `mid` | yes | 128 chars | **rejected** (whole event dropped, logged, not queued) | it's the dedup key; truncating it would silently corrupt dedup |
| `conversationId` | yes | 64 chars | **rejected** | it's the send target; truncating it would silently corrupt where a reply goes |
| `senderName` | no (unlinked conversation has none) | 200 chars | **clamped** (truncated, kept) | purely cosmetic display text — nothing keys off it |
| `text` | yes, non-empty after trim | 4000 chars | **truncated** (kept, cut) | display + prompt input, not an identifier |
| `sentAt` | yes | — | **rejected** if not strict ISO-8601 | see below |

`sentAt` must be **strict ISO-8601 with an explicit `Z` or a numeric offset** —
`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$`, e.g. `2026-09-04T14:32:07Z` or
`2026-09-04T14:32:07+08:00`. RikuOS rejects everything else, deliberately, including a bare year
(`"2026"`), a loose date (`"Sep 4 2026"`), and an epoch number or numeric-string timestamp. The
reason isn't pedantry: `new Date()` parses non-ISO strings in the **server's local timezone**, so
the same loosely-formatted string would resolve to a different real-world instant on a machine in a
different timezone than the one RikuOS actually runs on. `sentAt` is the anchor for a hard 24-hour
Meta send window — a silently-shifted instant means a silently-wrong deadline, in either direction.

**A rejected forward (unparseable body, or a shape `parseInboundEvent` doesn't recognise) gets a
plain `400`.** RikuOS logs the top-level *keys* of the body it received — never the body's
contents, since it can carry a stranger's message text — specifically so a contract drift (a
renamed field, say) is diagnosable from RikuOS's own logs rather than failing invisibly forever.

**What RikuOS returns**, so the forwarder can be built correctly and doesn't misread a healthy
response as a failure:

- **`200`** for everything RikuOS understood — a newly-queued item, a **skip** (triage switched
  off in settings, or the 24-hour window already closed by the time the forward arrived), and a
  **duplicate** `mid` (Meta redelivers; so might a retrying forward — RikuOS dedups on `mid` with a
  fast in-request check plus a unique partial index as the atomic backstop). **The forwarder must
  not treat a skip as a failure, and must not retry one.** It was considered and correctly declined.
- **`400`** only for a body RikuOS could not parse at all.
- **`401` / `500`** from the secret guard (bad secret / secret unset or too short — see below).
- **`500`** from a second, distinct source: a genuine infrastructure failure — the database
  unreachable, say — occurring *after* the secret and the body both checked out, but before
  anything was durably queued (`src/app/api/messenger/inbound/route.ts`, the outer `catch` block,
  lines 167–191). This is the honest case: nothing was understood or recorded, so a `500` doesn't
  misrepresent anything. It's distinct from a `500` that happens *after* an item was already queued
  — that path is deliberately **not** a `500`; it returns `200` with a `note` field, because the
  item exists regardless of what failed afterward (same route, lines 169–185). None of this changes
  what the forwarder should *do* — the forward is fire-and-forget and doesn't branch on the
  response either way — but it matters for anyone debugging a `500` by hand: it can mean either
  "the secret is misconfigured" or "RikuOS's own infrastructure is down," and the two call for
  different fixes.

**The forward secret.** Header `x-forward-secret`, value `MESSENGER_FORWARD_SECRET`. This is a
**new, separate** secret — not `CRON_SECRET`, not the existing `ST_API_SECRET` (ShikksTracker's own
`OS_API_SECRET`) that RikuOS already uses for `/api/os/*` calls. Rotating one must never invalidate
the others. RikuOS requires **at least 32 characters** and fails closed with a **`500`** — not
`401` — when the env var is unset or shorter, on purpose: this endpoint has no rate limiting in
front of it, so a short secret would be remotely brute-forceable with no lockout, and a
misconfigured-looking `500` is a more honest signal than a `401` that could be mistaken for "someone
guessed wrong once." Generate it with a CSPRNG, not a memorable phrase:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Open contract question — attachment-only messages.** A sticker, or a photo sent with no caption,
has no `text`. RikuOS's parser requires `text` to be present and non-empty after trimming; an event
missing it is dropped entirely — no card, no log line distinguishable from any other drop, and the
24-hour reply clock keeps running with nothing on RikuOS's side to show for it. **This needs an
answer from ShikksTracker, not an assumption from here:** does the webhook forward attachment-only
events at all, and if so, what goes in `text`? (A placeholder like `"[attachment]"` would at least
let it surface as a card, even an unhelpful one.) Left unanswered, those messages are invisible to
triage — nobody outside the raw Meta delivery would know they arrived.

### 2. The send endpoint: `POST /api/os/messenger-reply`, in ShikksTracker

Accepts `{ conversationId, text }`, authenticated the same way every other `/api/os/*` call already
is — header `x-os-secret`, the existing `ST_API_SECRET` / `OS_API_SECRET` shared value. **Not a new
secret.** Sends the text through the page token, inside the 24-hour window.

**The response contract is exact, and RikuOS's classifier (`src/lib/stApi.ts`,
`sendMessengerReply`, lines 507–569) is already built and tested against it:**

- **`200` with JSON body exactly `{ "ok": true }`** is the **only** thing read as confirmed
  (`done`). `done` is **terminal** on the RikuOS side — no sweep revisits it, there is no retry
  affordance for it, and it raises no alert. Getting this combination wrong doesn't just misreport
  status; it removes the only signal RikuOS has that a message actually left.
  - **Do not return `202`** for a send that was merely queued/accepted, not confirmed. RikuOS
    treats any non-`200` 2xx as unresolved.
  - **Do not signal a refusal as `200 { "ok": false }`.** RikuOS parses the body defensively — if
    it fails to parse, or parses without `ok === true`, the outcome falls through to
    `needs_verification`, not to "refused." A real refusal (see next point) must be a 4xx, so it is
    read correctly as *nothing was sent*, rather than parked as *unknown*.
- **Every `4xx` must be emitted BEFORE the Meta Graph call.** RikuOS classifies any 4xx as `failed`
  — provably no side effect, safe to retry — and `failed` is the **only** `actionStatus` its retry
  route (`src/app/api/queue/[id]/retry/route.ts`) will act on; retrying calls this same endpoint
  again with the same text. **A 4xx returned *after* a successful Graph send would let Riku press
  Retry and deliver the same message to a prospect twice.** "The 24-hour window is closed" is a
  legitimate 4xx *precisely because* it's refused before any send attempt — no Graph call happens,
  so nothing about repeating it is unsafe.
- **Anything else — including any failure after the Graph call, or any outcome that is genuinely
  unknown — must be `5xx`.** This covers a Graph error relayed back to RikuOS, a timeout mid-send,
  or any other "we don't know if it went through" state. RikuOS reads 5xx (and every other
  ambiguous case: a bare `204`, an unparseable `200` body, a network error, a timeout) as
  `needs_verification` — parked for Riku to check the actual Messenger thread before anything
  retries it.

Put plainly: **2xx-that-isn't-exactly-`200 {ok:true}`, or any unparseable response, is not treated
as evidence a message was sent** — because it isn't. RikuOS would rather park an item a human has to
glance at than guess wrong in either direction on an outward action to a real person.

## Manual steps — only Riku can do these

- [ ] Generate `MESSENGER_FORWARD_SECRET` (32+ random chars — the `node -e "..."` command above) and
      set the **same value** in both projects' environments (RikuOS: `MESSENGER_FORWARD_SECRET`;
      ShikksTracker: whatever name that session picks — flag the exact env var name back once it's
      decided, so `.env.example` here can note it).
- [ ] Confirm the RikuOS base origin the forward should call. RikuOS's own `.env.example` calls this
      `APP_BASE_URL` on its side (`https://<app>.vercel.app`, no trailing slash) — memory from
      earlier P3 work has the live deployment at `https://riku-os.vercel.app`, but that was not
      re-verified in this session; confirm it's still current before wiring the forward to it.
- [ ] After ShikksTracker's session lands (or even before, since the index doesn't depend on
      traffic existing), run in **this** repo:
      ```
      npm run migrate:indexes
      npm run migrate:indexes:apply
      ```
      A new partial unique index on `payload.messageId` (`src/models/ApprovalItem.ts`, lines
      150–158) is what backs the duplicate-`mid` protection described above. `autoIndex` is off in
      production (CLAUDE.md), so Mongoose will **not** create this index on its own — it has to be
      applied explicitly, and per CLAUDE.md's index-change rule the script is dry-run by default.

## Paste-ready block for the ShikksTracker session

Open a terminal in `C:\Users\Shikks\Projects\ClaudeProjects\ShikksTracker`, start Claude, and paste
the block below verbatim. It restates both contracts above in ShikksTracker's own frame — it does
not assume that session has read this file.

```
Two endpoints RikuOS needs, carried across from a RikuOS session (P6, inbound
Messenger triage). RikuOS's side is built and merged, but wired to nothing —
it cannot receive a message or send a reply until this repo adds both.

Context you can't get from the RikuOS repo: RikuOS drafts replies to inbound
Messenger messages inside Meta's 24-hour send window, queues every draft for
Riku to approve by hand (nothing auto-sends — that carve-out was revoked
2026-09-04), and depends on this repo for two things: notice that a message
arrived, and a way to actually send the approved reply. Both have to live
here because this repo holds META_PAGE_TOKEN, and RikuOS may not hold a copy
— regenerating a page token in Meta's console invalidates the previous one,
so a duplicate sitting in RikuOS's env would go dead the moment you rotate
the real one, silently, mid-window.

1. FORWARD every inbound Messenger event to RikuOS after your webhook
   handler stores it:

     POST <RikuOS base origin>/api/messenger/inbound
     Header: x-forward-secret: <a new shared secret, NOT your existing
             OS_API_SECRET, NOT a cron secret>
     Body: { "mid", "conversationId", "senderName" (nullable),
             "text", "sentAt" (strict ISO-8601, explicit Z or numeric
             offset — not a bare year, not "Sep 4 2026", not an epoch
             number) }

   Only forward INBOUND messages — never message_echoes (your own sends
   surface there too, and one forwarded would make RikuOS draft a reply
   to itself).

   Fire-and-forget with a short timeout, not awaited in your webhook's
   response path to Meta — RikuOS being slow must never delay your 200
   back to Meta. A RikuOS draft can take up to ~40s in the worst case
   when the model is slow, so pick a forward timeout well under that,
   and don't treat a forward timeout as proof anything failed on RikuOS's
   side — it likely just means the draft was still running.

   RikuOS answers 200 for everything it understood, INCLUDING a skip
   (triage switched off, window already closed) and a duplicate mid —
   none of those are failures, don't retry them. 400 means it couldn't
   parse the body at all. 401/500 come from the secret guard (unset or
   under 32 chars); a SEPARATE 500 means a genuine infra failure after
   the secret and body both checked out but before anything was queued
   (DB down, etc.) — doesn't change how you should treat the forward
   (still fire-and-forget, don't branch on it), just useful to know if
   you're ever debugging one by hand. mid over
   128 chars or conversationId over 64 chars gets the whole event
   rejected outright (not truncated) rather than silently corrupting a
   dedup key or send target — so validate those lengths before sending
   if you'd rather catch it here than have RikuOS drop it.

   Open question I can't answer from the RikuOS side: does your webhook
   see attachment-only messages (a sticker, a photo with no caption) at
   all, and if so, what would go in `text`? RikuOS requires non-empty
   text and silently drops anything without it — no card, no visible
   failure, the 24h clock just keeps running. If those exist and matter,
   they need at least a placeholder string so they don't vanish.

2. BUILD POST /api/os/messenger-reply — { conversationId, text },
   authenticated with your existing x-os-secret (OS_API_SECRET), same as
   every other /api/os/* endpoint. Sends through the page token, inside
   the 24h window.

   The response shape is load-bearing on the RikuOS side and already has
   a classifier written against it, so this isn't a suggestion:

     - 200 with body EXACTLY { "ok": true } — and only that — means
       "confirmed sent." RikuOS treats this as terminal: no retry, no
       follow-up check, no alert. Don't use 202 for a queued-not-yet-sent
       send, and don't answer a refusal with 200 { "ok": false } — RikuOS
       can't tell that apart from a malformed body and would park it for
       a human instead of reading it as the clean refusal it is.
     - Every 4xx MUST be emitted BEFORE you call the Graph API — a
       refusal, never a delivery failure. "Window closed" belongs here.
       RikuOS treats 4xx as safe to retry (nothing was sent), and its
       retry button calls this endpoint again with the same text — a
       4xx AFTER a real send would let a human accidentally double-
       message a prospect.
     - Anything else — a Graph error, a timeout, any outcome you can't
       positively confirm one way or the other — must be 5xx. RikuOS
       parks that for manual verification against the actual thread
       rather than guessing.

Shapes above are proposals in form, not in the response-classification
rules — those are fixed on the RikuOS side already (src/lib/stApi.ts). If
you'd rather shape the request/response differently, that's your call, but
flag it back so the classifier gets updated to match rather than silently
disagreeing with what you actually ship.

Once both exist, please tell the RikuOS side: the exact env var name you
chose for the forward secret, and the real base origin to forward to isn't
this repo's problem to guess (a manual Riku step handles that). Document
both endpoints in docs/os-api.md the way the rest of the messenger
contract already is there — a field this repo ships without documented
reading instructions has bitten this pairing before (see the messenger
lastEventAt ambiguity noted in the 2026-09-04 token-health handoff).
```

## Verified vs. proposed

Everything below the line was read directly out of RikuOS's own shipped code today (2026-09-04),
not recalled or assumed. Everything above the line describing ShikksTracker's side — the forward
hook's existence, the `/api/os/messenger-reply` endpoint's existence, any env var name it might
choose — is **proposed**, not built. Neither endpoint exists in ShikksTracker yet; nothing there was
read, changed, or connected to in producing this document, per the prime directive.

**Verified, from RikuOS:**

- P6 is merged to `master` here (commits `85efb66`…`81f78a8`), builds clean, and its own test suite
  passes.
- `src/app/api/messenger/inbound/route.ts` exists, is wired to `requireForwardSecret`, and returns
  exactly the status/body combinations described above for skip, duplicate, created, unparseable,
  and infra-failure cases — read directly from the route's code and its own inline commentary, not
  inferred.
- `src/lib/triage.ts`'s `parseInboundEvent` enforces every field limit and the strict-ISO-8601 rule
  described above; `INBOUND_TEXT_MAX = 4000`, `CONVERSATION_ID_MAX = 64`, `MESSAGE_ID_MAX = 128`,
  `SENDER_NAME_MAX = 200` are the actual constants, each imported (not duplicated) into the schema
  that persists them, per this repo's own rule against two copies of the same bound drifting apart.
- `src/lib/auth.ts`'s `requireForwardSecret` enforces the 32-char minimum and the 500-on-unset/short
  behaviour, using a separate env var (`MESSENGER_FORWARD_SECRET`) from both `CRON_SECRET` and
  `ST_API_SECRET`.
- `src/lib/stApi.ts`'s `sendMessengerReply` (lines 507–569) and its header comment (lines 9–40)
  already implement and document the exact classification rules stated above — this document
  restates code that exists, it does not invent new rules.
- `src/models/ApprovalItem.ts` carries a partial unique index on `payload.messageId` (lines
  150–158); `package.json` defines `migrate:indexes` and `migrate:indexes:apply` exactly as
  described.
- `src/app/api/queue/[id]/retry/route.ts` filters strictly on `actionStatus: "failed"` — confirmed
  by reading the route, not assumed from its name.
- **RikuOS is receiving nothing right now**, and that is the expected state, not a fault: the
  forward hook doesn't exist yet, so no inbound event has ever reached `/api/messenger/inbound`
  outside of this repo's own tests.

**Proposed, not verified (ShikksTracker's side):**

- That a forwarding hook can be added to the existing webhook handler the way described.
- That `/api/os/messenger-reply` can be built to the response contract above — RikuOS is imposing
  this shape; ShikksTracker's session may reasonably push back on parts of it, per the note at the
  end of the paste-ready block.
- Any answer to the attachment-only-message question — genuinely unknown from this side.
- The live RikuOS base origin Riku will point the forward at — noted above as recalled from memory,
  not re-checked this session.
