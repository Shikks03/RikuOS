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

- The `hkg1` → Anthropic `403` trap is **already fixed** in ShikksTracker (commit `7fe5a08`, region
  moved to `sin1`). Ignore it if older notes resurface it.
- P2 has **no dependency on P1** and cannot break the chaser. The two features touch different
  surfaces.
- RikuOS does not consume `GET /api/os/summary` at all yet — only `attention` and `drafts`. The
  `summary.messenger` consumer is built on the RikuOS side *after* P2 deploys, as the deferred half
  of roadmap 5.1 (watchdog webhook freshness).
