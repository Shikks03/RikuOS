# Handoff — Meta page-token health in `GET /api/os/summary` → ShikksTracker

**Written 2026-09-04 from the RikuOS repo. Disposable.**

> **Delete this file in the post-v0 cleanup**, along with any pointer line to it in
> `docs/ROADMAP.md` (there is none as of writing; `ARCHITECTURE.md` S9 names it instead).
> It exists only to carry one contract proposal across the repo boundary (S4). Once the fields
> exist, the durable record is `docs/os-api.md` in ShikksTracker plus `ARCHITECTURE.md` S9 here —
> not this file. If the proposal is declined, that decision belongs in ShikksTracker's own docs
> too, and this file still goes.

## Why this exists

RikuOS is supposed to notice when the Meta page access token expires. It cannot, and the reason is
structural rather than a missing afternoon of work.

The token is ShikksTracker's. `docs/meta-setup.md` there (step 3, and the rotation note under
*Notes*) says it is generated from the Messenger settings panel in a browser, that it is derived
from Riku's Facebook login, that it typically expires in about **60 days**, and — the load-bearing
detail — that **generating a new one invalidates the old one**. So if RikuOS kept its own copy of
`META_PAGE_TOKEN` in its env and pinged Meta's Graph API with it, that copy would go dead the
moment Riku rotates the real one. RikuOS would then report an expired token while the live system
was perfectly healthy: the check failing in exactly the direction it exists to prevent, and failing
on a routine maintenance action rather than on a fault. Riku considered copying the token on
2026-09-04 and rejected it for that reason (recorded as **S9** in `ARCHITECTURE.md`).

It matters more than a missing nice-to-have, because two documents in two repos are each leaning on
the other:

- RikuOS's `ARCHITECTURE.md` §8 names Meta dev-mode token expiry **"the watchdog's founding use
  case"**.
- ShikksTracker's `docs/meta-setup.md` declines the durable alternative — exchanging a long-lived
  user token for a non-expiring page token — because it *"buys little here **given the watchdog
  exists**."*

That second decision was made on the assumption something is watching the token. Nothing is. Either
repo's position is reasonable on its own; together they leave the token unwatched.

## How to use it

Open a terminal in `C:\Users\Shikks\Projects\ClaudeProjects\ShikksTracker`, start Claude, and paste
the block below verbatim.

```
Proposal from the RikuOS side: expose Meta page-token health through
GET /api/os/summary.

Context you cannot get from this repo. RikuOS monitors this app's outreach
pipeline daily — one GET /api/os/summary, judged in src/lib/outreachHealth.ts.
As of 2026-09-04 it alarms on a stalled send engine, on approved messages
stranded by it, and (new) on messenger.lastEventAt going silent for 10 days.

What it still cannot do is check the page access token directly. RikuOS may
not hold a copy: docs/meta-setup.md here says generating a token invalidates
the previous one, so a duplicate in RikuOS's env would die on every routine
rotation and RikuOS would start crying wolf about a healthy system. The check
has to live in the repo that owns the token — this one.

Proposed contract addition, two fields inside the existing `messenger` block:

  messenger.tokenOk: boolean | null
    — whether the page access token was valid at the last check.
      null = never checked.
  messenger.tokenCheckedAt: string | null
    — ISO timestamp of that check. null = never checked.

The shape is a proposal. The implementation is entirely your call.

Two things worth weighing before you build it:

1. Do NOT make the Graph call inline on every GET /api/os/summary request.
   RikuOS polls that endpoint once a day and needs it cheap and reliable;
   an inline third-party call puts Meta's availability in the path of the
   one endpoint RikuOS's monitoring depends on, and a Meta timeout would
   then read as "ShikksTracker is down". Better shape: a cached or
   scheduled check whose result the summary merely reports.

   The honest wrinkle: this repo's scheduled work runs off an external
   pinger, so a scheduled check inherits whatever reliability that has.
   That is survivable and does not change the recommendation — RikuOS can
   also alarm on a tokenCheckedAt that has itself gone stale, which is a
   strictly better signal than no check at all.

2. If you ship the fields, RikuOS MUST be told. Its fetchSummary parser in
   src/lib/stApi.ts reads a fixed set of keys and drops the rest, so the
   fields stay invisible on that side until someone adds them there.
   Nothing can judge a field it never parsed.

   And ship the reading instructions with them, in docs/os-api.md, the way
   the messenger block itself was documented. That paragraph is not a
   courtesy. Last round, `lastEventAt: null` meant "no webhook yet" during
   P1 and "the subscription is broken" after P2, and RikuOS came close to
   alarming on the wrong one — the documentation paragraph is the only
   thing that stopped it. A field without its reading is a false alarm
   waiting for a deploy. Say explicitly what tokenOk: null means, and
   whether tokenOk: false is ever transient (a Graph outage, say) rather
   than a dead token.

Not urgent. RikuOS's silence check covers the same failure indirectly in the
meantime. Say no if you think it is the wrong shape — but if you decline it,
please record the decision in docs/meta-setup.md, because that file currently
declines the long-lived-token alternative on the grounds that a watchdog
covers this, and the watchdog does not cover it yet.
```

## What RikuOS ships in the meantime

A Messenger webhook **silence** check, in `src/lib/outreachHealth.ts` — roadmap 5.1's deferred half,
unblocked now that P2 is on `origin/main` in ShikksTracker.

`summary.messenger.lastEventAt` advances whenever Meta delivers anything, inbound or echoed. When
the token expires and Meta disables the subscription, that timestamp freezes. RikuOS alarms after
**10 days** of total silence — Riku's threshold, chosen 2026-09-04, calibrated against message
volume rather than uptime, following ShikksTracker's own note in `docs/os-api.md` that the page sees
"a handful of messages a week" and that the threshold belongs in days, not hours.

This does catch an expired token, but only indirectly:

- **Up to 10 days of detection latency, and it trails the fault rather than warning ahead of it.**
  The alarm fires ten days *after* Meta stops delivering, so there is no advance notice of an
  expiring token — only a delayed obituary. What the threshold buys is that ten days is a sixth of
  the ~60-day token life, so an expiry is caught and regenerated inside the same cycle instead of
  surfacing when a lead complains they were ignored. (An earlier draft of S9 called this "roughly
  50 days of margin". That was wrong and has been corrected there; it is not margin, it is latency.)
- **It cannot distinguish "token expired" from "nobody messaged the page."** Both produce silence.
  The digest line can only say the webhook has gone quiet, never why.

Hence the ask above. The silence check is a floor, not a substitute.

## Manual steps — only Riku can do these

- [ ] Decide whether the ask is worth a session in ShikksTracker at all — the silence check makes it
      optional, not urgent.
- [ ] If the fields ship, **tell the RikuOS side**, so `fetchSummary` in `src/lib/stApi.ts` carries
      them and `outreachHealth.ts` learns to judge them. They are inert here until then.
- [ ] If a *scheduled* token check is chosen there, the external pinger has to actually exist — see
      the last still-open note below.

## Verified on 2026-09-04, from RikuOS, read-only

Everything in this section was checked first-hand today. Everything above it is argument or
proposal.

- **The `hkg1` → Anthropic-403 trap is now genuinely fixed. The 2026-08-30 note is resolved.** That
  handoff recorded commit `7fe5a08` as committed but never pushed, so production still built from a
  `vercel.json` reading `"regions": ["hkg1"]`. Re-checked today with
  `git -C ../ShikksTracker show origin/main:vercel.json`: it reads `"regions": ["sin1"]`. `main` and
  `origin/main` are the same commit (`3beb0de`), and `git branch -a --contains 7fe5a08` lists
  `origin/main`. **Nothing to carry forward** — the old note is corrected a second time, in the good
  direction.
- **P2 is merged to `origin/main` there**, not merely sitting on a branch: `git ls-tree -r
  origin/main` shows `src/app/api/webhooks/messenger/route.ts` and the `src/lib/messenger/*`
  modules, and `git show origin/main:docs/os-api.md` carries the rewritten `messenger` paragraph,
  including *"That reading is now obsolete — do not apply it."* That merge is what unblocks the
  silence check. The P1 "always zeroed" caveats that were still sitting in `outreachHealth.ts` and
  `stApi.ts` when this was first drafted have since been rewritten in the same change.
- **The silence check landed in the working tree while this file was being written**, and the
  description above matches it. First check: `outreachHealth.ts` still carried its
  `SCOPE BOUNDARY — messenger` comment and `evaluateOutreach` had no messenger branch. Re-checked
  after: `WEBHOOK_SILENT_DAYS = 10`, judged off `messenger.lastEventAt`, with three findings —
  `webhook-never-fired` (`null`), `webhook-unreadable` (unparseable stamp), `webhook-stale` (silent
  past the threshold). Its own comment records that P2 was verified live against production on
  2026-09-04, `lastEventAt` returning a real recent timestamp rather than the P1 `null`. It is
  uncommitted at the time of writing, so `git status` will show it modified; trust
  `outreachHealth.ts` over this paragraph if the two ever disagree.
- The `meta-setup.md` facts (roughly 60-day expiry, regeneration invalidating the old token, the
  "given the watchdog exists" line) were read out of that file today, not recalled.

## Still open — pointers only, not re-argued here

- **`replyEffects.ts` destroys approved, human-reviewed drafts with no audit record.** Recorded in
  RikuOS's `ARCHITECTURE.md` §8 and argued in full in
  `docs/handoffs/2026-08-30-p2-messenger-webhook.md`. Proposal there: a terminal `cancelled` status
  (or a `cancelledReason` stamp) instead of the channel-unscoped `deleteMany`. Unchanged today.
- **What happened to the two v0 chaser drafts is still unknown**, and only a database query
  separates the three possible readings. RikuOS may never run it (prime directive); the query is
  written out at the end of the 2026-08-30 handoff, ready to paste into a Mongo shell.
- **The send engine's pinger is FIXED — the 2026-08-30 note is resolved.** Verified today: commit
  `61d36bb` on `origin/main` adds `.github/workflows/sequence-pinger.yml`, chosen over cron-job.org
  so the schedule is versioned beside the code and `CRON_SECRET` stays in GitHub. The live API
  confirms it runs: `engine.lastRunAt` read `2026-09-04T03:12:37Z` today, after 29 days frozen.
  A *scheduled* token check therefore has a real scheduler to hang on, which strengthens the
  recommendation above rather than weakening it.
- **The engine runs without sending, and that is deliberate — do not "fix" it.** `61d36bb`'s message
  records both engine switches (`draftGenerationEnabled`, `sendingEnabled`) as `false` in the live
  Settings document. That is the resting state under RikuOS decision **S10**: nothing goes to a
  business until Riku says so, each time. A healthy engine that sends nothing is correct, approved
  messages waiting beside it are correct, and neither is a stall to be reported or a switch to be
  proposed. Noted here only so a ShikksTracker session reading `lastRunAt` fresh and `sent` zero
  does not diagnose a bug that is not there.