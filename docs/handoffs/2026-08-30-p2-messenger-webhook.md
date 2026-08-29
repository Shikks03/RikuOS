# Handoff — P2 (Messenger webhook + lane split) → ShikksTracker

**Written 2026-08-30 from the RikuOS repo. Disposable.**

> **Delete this file in the post-v0 cleanup**, along with the pointer line under P2 in
> `docs/ROADMAP.md`. It exists only to carry context across the repo boundary (S4) while P2 is
> unbuilt. Once P2 has shipped, the durable record is `docs/os-api.md` in ShikksTracker plus that
> repo's own commits — not this file.

## Why this exists

P2 is executed in ShikksTracker by a session running there (S4, and the prime directive in
`CLAUDE.md`). That session can read its own spec, but it cannot know what RikuOS is waiting on. The
P1 handoff was only ever spoken in a chat session and the context was lost; this is the fix for
that.

## How to use it

Open a terminal in `C:\Users\Shikks\Projects\ClaudeProjects\ShikksTracker`, start Claude, and paste
the block below verbatim.

```
Start P2 — the Messenger webhook and lane split.

The design is already ratified. Read these first, in order:
  1. docs/superpowers/specs/2026-08-28-rikuos-step1-messenger-api-variants-design.md
     — Features A and B are P2. Features C and D were P1 and are already shipped.
  2. ../RikuOS/docs/ROADMAP.md, section P2 — the task list (2.1-2.6) and the
     acceptance bar.
  3. CLAUDE.md here.

Do not relitigate the spec's decisions. Plan and execute Features A and B.

Three things you cannot learn from this repo:

1. RikuOS is waiting on `summary.messenger`. P1 ships those three fields
   hardcoded to zero, and docs/os-api.md has a paragraph saying they are
   "always zeroed in P1" and that `lastEventAt: null` means "no webhook yet",
   not "the webhook is dead". P2 must populate them with real values AND
   rewrite that paragraph. RikuOS's watchdog reads webhook staleness as an
   alarm condition, and that sentence is the only thing currently stopping it
   from firing a false alarm. Shipping the models without both halves silently
   breaks monitoring in the other repo.

2. Spec open item #1 is already done. The `sendOneLog` replied-contact guard
   was verified and resolved in P1 by commit 039f953. Do not redo it. Open
   items #2 (echo similarity threshold — ship manual-only if fiddly) and #3
   (density pass on /) are still live.

3. Separate known fault, NOT P2's scope, but verify before you trust any send
   path you touch: at RikuOS's P4 acceptance on 2026-08-29, `engine.lastRunAt`
   read 2026-08-01 — the send cron appeared not to be firing for 28 days. If
   that is still true it is its own bug and deserves its own fix, not a
   silent workaround inside P2.

Done when: a real reply to the RIKU page appears in /messenger within a
minute, and confirming a suggested link marks the contact replied with the
score bumped.
```

## Manual steps — only Riku can do these

Task 2.1 stalls without them, so do them before or early in that session.

- [ ] Create/confirm the Meta dev-mode app; subscribe the RIKU page to the `messages` and
      `message_echoes` webhook fields
- [ ] Choose a **verify token** (any random string) and generate a **page access token**
- [ ] Copy the **app secret**
- [ ] Set all three in ShikksTracker's env — locally *and* on Vercel
- [ ] Have a publicly reachable URL ready (a deployment or a tunnel); Meta will not accept the
      webhook subscription until it can complete the GET verification handshake

## Smaller notes

- ~~The `hkg1` → Anthropic `403` trap is **already fixed** in ShikksTracker (commit `7fe5a08`,
  region moved to `sin1`). Ignore it if older notes resurface it.~~ **Corrected 2026-08-30 — this
  was wrong, and the correction is urgent.** `7fe5a08` was committed but **never pushed**:
  `git show origin/main:vercel.json` still reads `"regions": ["hkg1"]`, and `origin/main` is the
  branch Vercel builds. **Production is still in Hong Kong and every Anthropic call from
  ShikksTracker is still 403-ing.** The fix is `git push origin main` from that repo. Fixed in a
  commit is not the same as fixed in production — this note is why that distinction is now written
  down twice.
- P2 has **no dependency on P1** and cannot break the chaser. The two features touch different
  surfaces.
- ~~RikuOS does not consume `GET /api/os/summary` at all yet — only `attention` and `drafts`.~~
  **Changed 2026-08-30:** RikuOS now reads `summary` daily and monitors `engine` and `queue` from it
  (roadmap 5.5). It still reads **nothing** from `summary.messenger` — those fields are carried
  through its client but deliberately not judged, so the P1 "always zeroed" reading stays safe. The
  `summary.messenger` consumer is built on the RikuOS side *after* P2 **deploys** — deploys, not
  merely lands on a branch — as the deferred half of roadmap 5.1 (watchdog webhook freshness).
  P2 has already rewritten that paragraph in its `docs/os-api.md` on the feature branch; it takes
  effect for RikuOS only when `origin/main` carries it.

---

## Found from RikuOS on 2026-08-30, after this brief was written

A read-only investigation of ShikksTracker's source (no edits, no DB, no git mutations — S4 and the
prime directive hold) turned up three things while diagnosing why RikuOS's chaser drafts had not
gone out. Recorded here because this is the file the ShikksTracker session is told to open.

**1. Production is still on `hkg1`.** See the corrected note above. One `git push origin main` away.

**2. `replyEffects.ts` destroys approved, human-reviewed drafts with no audit record — proposed as
a spec change, not a fix to make from here.** The `deleteMany({contactId, status: {$in: ["draft",
"approved"]}})` there is not channel-scoped, so a single inbound Messenger message removes that
contact's pending *email* drafts as well. `suppressContact` runs the same delete and is reachable
from the **public, unauthenticated** unsubscribe route. P2 adds two more triggers for it (webhook
ingest, and the link button, which replays effects over stored history).

Why it matters to RikuOS specifically: the chaser's entire audience is contacts who have just
replied — exactly the rows this deletes. RikuOS marks its `ApprovalItem` `actionStatus: done` the
moment `POST /api/os/drafts` returns 201 and never looks again, so a draft deleted afterwards reads
as delivered on this side, permanently. **Proposal: a terminal `cancelled` status (or a
`cancelledReason` stamp) instead of a destroying delete**, so the record survives its cancellation.
Recorded in `ARCHITECTURE.md` §8 as a standing risk until it changes there.

**3. The send engine has never been scheduled.** `vercel.json` has no `crons` key by design; the
engine expects an external hourly pinger (`docs/cron-setup.md`) that was never wired up, which is
why `engine.lastRunAt` has read 2026-08-01 for 29 days. Two toggles (`sendingEnabled`,
`draftGenerationEnabled`) also default to **false**, so a pinger alone will not make it send. That
session had already found this independently and listed it under pending user actions — it is noted
here only because RikuOS now *monitors* it (roadmap 5.5) and will report it every morning until it
is fixed. Not P2's job to paper over.

**Still unresolved: what happened to the two v0 drafts.** They were `approved` on 2026-08-29 and
`queue.approved` read 0 on 2026-08-30, but the engine never ran, so they were not sent by it. The
code allows three readings — sent by hand, un-approved back to `draft`, or deleted by one of the
paths in item 2. Only a database query separates them, and it must be run by Riku (RikuOS may never
connect to that database):

```js
db.emaillogs.find({ origin: "rikuos" }, {
  contactId: 1, channel: 1, status: 1, createdAt: 1, sentAt: 1,
  sentManuallyAt: 1, gmailMessageId: 1, replyToLogId: 1
}).sort({ createdAt: -1 })
```

`status: "sent"` with `sentManuallyAt` set means Riku marked it sent by hand; with `gmailMessageId`
and no `sentManuallyAt` it went through Gmail (which, with the cron dead, means the review UI's send
button — still a human). `status: "draft"` means un-approved and recoverable. **Zero documents means
they were deleted**, which confirms item 2 as real data loss rather than a latent risk.
