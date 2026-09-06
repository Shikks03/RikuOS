# P8 — The Freelance page (design)

**Date:** 2026-09-05 · **Status:** ratified design, awaiting implementation planning
**Scope:** `ROADMAP.md` P8 — repo: RikuOS. One read-only page on live OS-API data, plus the app's first navigation and one small persistence addition to the morning cron.
**Not in scope:** ~~visual design (P9)~~ — **superseded 2026-09-06 by S17: the page is built to the design system directly, so visual design IS in scope** · the quest board (P9b, its own design doc) · any action on a lead · any new agent · Personal or Academics content.

**Goal in one line:** Riku opens `/freelance` and learns, in one screen, what is true about his outreach right now — including when the honest answer is "you have not started yet".

---

## The content discussion this document records

Held 2026-09-05, satisfying S11 for this page. Riku answered six questions; each decision below cites his choice. **No part of this page was inferred from another page's discussion**, and this document settles nothing about P10 or P11.

---

## What the data actually is — measured, not assumed

All three OS-API endpoints were called live against `https://shikkstracker.vercel.app` on 2026-09-05 during the discussion. **This is the single most important input to the design**, and it is recorded here because a later session reading only the endpoint shapes would design a very different page.

| Reading | Live value, 2026-09-05 |
|---|---|
| `contacts.total` | 30 |
| `contacts.byPipelineStage` | `not_started` 25 · `contacted` 3 · `replied` 2 · **`call_booked`, `proposal_sent`, `won`, `lost` all 0** |
| `contacts.hot` | 2 |
| `queue.drafts` | **24** |
| `queue.approved` | 0 |
| `campaigns` | 2, both test data — "Test One" (5 sent, 2 opened, 0 clicked, 2 replied), "Test number 2" (all zeros) |
| `engine.lastRunAt` / `lastRunErrors` | same-day, 0 errors — healthy |
| `attention.repliedUnanswered` | **0** |
| `attention.overdueActions` | **0** |
| `variant-stats` | every variant: 0 sends, 0 replies, 0% |

**Two conclusions follow, and they shape everything:**

1. **The empty state is this page's primary state, not an edge case.** A layout designed for a full pipeline renders today as a seven-column row of five zeros, a campaigns block of test data, and an approach table where every line reads 0% of 0 sends. That is D11's failure mode wearing different clothes — a dashboard that looks informative and is not.
2. **The one number genuinely asking something of Riku is `queue.drafts` = 24**, and nothing watches it. `stApi.ts` says so in as many words: *"Drafts awaiting Riku's approval inside ShikksTracker. Not monitored."* No agent, no digest line, no page. This page is where that gap closes.

The pipeline being empty is **correct**, not broken: both of ShikksTracker's engine switches are off by Riku's standing instruction (S10). Nothing goes to a business until he says so, each time.

---

## Decisions settled in this session

| # | Decision | Why |
|---|----------|-----|
| D1 | **Numbers lead; the "needs you" list sits below them.** | Riku's choice over an action-first page and over a pure feed. It also keeps P8 the densest, most table-heavy page in the app, which is the hardest test a design system can face — the reason S12 put this page first. |
| D2 | **The headline reports the true state of play, not the scoreboard.** The top block carries only statements that are live and true today: drafts waiting, contacts never contacted, and (pending a contract change) whether sending is on. | Riku's choice, taken after seeing the live numbers. The scoreboard grows into the lead as real data arrives; until then it would be a screen of zeros. |
| D3 | **"Needs you" lists only the gaps — what no agent is handling.** Instagram and phone replies (the chaser skips these channels), email/Facebook replies with no live `ApprovalItem` (over cap, or Riku rejected the draft), and `overdueActions` (nothing watches these at all). | Riku's choice over listing everything. The chaser already turns supported-channel replies into drafts in `/queue`; repeating them here would put the same lead in two places and make neither list trustworthy. |
| D4 | **Machinery health is a quiet strip at the bottom of this page**, not a separate view and not push-only. | Riku's choice. It is silent and grey when all is well and only grows into detail when something is wrong, so it costs nothing when there is nothing to say — and gives him somewhere to look the moment a push arrives, rather than waiting for the next morning. |
| D5 | **Site status reads a stored snapshot, with an on-demand re-check.** The morning cron gains a small write; the strip shows how old the reading is. | Nothing currently persists it — the cron computes it, pushes it, discards it. Re-pinging three sites on every page load would be slow and would hit client sites on every view. |
| D6 | **The page performs no action on any lead.** Read, and link out to ShikksTracker. | Rule 4 and the approval queue stay untouched, with no new surface to reason about. Riku acting in ShikksTracker is Riku acting; nothing here lets an agent act. |
| D7 | **Ship without the sending-switch line; propose the contract change.** | Riku's choice. The fact exists in ShikksTracker's `Settings` (`sendingEnabled`, `draftGenerationEnabled`) but `/api/os/summary` does not return it. The prime directive forbids fixing that from this repo. Nothing blocks; the line is simply absent until the contract lands. |
| D8 | **A value that did not arrive is never drawn as a zero.** | The `readCount` / `readStamp` rule already in `stApi.ts`, carried into the UI: "the engine reported no errors" and "the engine reported nothing" are different findings, and the second is the interesting one. |

---

## Page structure

`/freelance`, session-guarded, server-rendered fresh on every load (`dynamic = "force-dynamic"`, `cache: "no-store"` throughout).

**Built to the design system — corrected 2026-09-06, decision S17.** This paragraph originally read *"Built plain — no visual design. P9 rebuilds it to the design system"*, which was true when written and is now false. Riku had the design system built externally from the content deck before this page was built at all, so the plain build was dropped: it would have meant building the same page twice. **Everything else in this document is unaffected** — the blocks, their order, the strings and the states were all settled on content grounds, not visual ones, and the design system was drawn against them.

### Block A — State of play

Every line is live and true, and **each line disappears when it has nothing to say** rather than rendering a zero.

- `queue.drafts` → "24 drafts waiting on you in ShikksTracker", linking out. Hidden when 0.
- `queue.approved` → "N approved, not yet sent". Hidden when 0.
- `not_started` / `total` → "25 of 30 contacts never contacted". Hidden when `not_started` is 0.
- *Pending D7's contract change:* "sending is OFF".

As sending begins these lines stay meaningful — fewer drafts waiting, fewer untouched contacts — so the block does not need to become something else later.

### Block B — Pipeline

Stages that hold contacts, shown plainly, plus total and hot. **Empty stages collapse into one muted line** — "nothing yet at call booked, proposal sent, won, lost" — which naturally becomes the full row as the pipeline fills. Stage keys render as readable labels, never the raw enum.

### Block C — Campaigns

Collapsed to a single row (`Campaigns 2 ▸`), expanding in place — no second route. Name, sent, opened, clicked, replied, sorted by sent descending, list bounded. One footnote when expanded: **open counts come from tracking pixels and undercount anyone whose mail client blocks images.** These are contact counts, not raw log counts, matching ShikksTracker's own dashboard by design.

### Block D — Approach performance

Collapsed. Today it reads "no sends yet — nothing to compare."

When data exists, **email variants and every other channel are shown as separate groups.** Since S15, replies are only ever detected on email; a Facebook, Instagram or phone variant's 0% is not a measurement, it is a blind spot. Non-email variants are grouped under an explicit "not measurable — replies are only detected on email" heading and **never printed as 0%**. This is the blind spot recorded in the `p7-variant-stats-blind-spot` memory, closed here at the point of display.

This block shows raw numbers only. P7's retro agent adds judgment over the same data; there is no shared logic to duplicate.

### Block E — Needs you

The gaps from D3, each row carrying business, channel, how long it has waited, the reply snippet where there is one, and a link out to the contact. Bounded list. Empty state reads "Nothing waiting", not "0".

**The gap calculation is logic, not view.** It lives in `src/lib/` beside the chaser, is unit-tested without a database or network, and reuses the chaser's existing `liveAnchorIds` idea — the set of `replyToLogId`s already carrying an `ApprovalItem` in `pending` / `approved` / `edited_approved`. The route stays thin (CLAUDE.md).

### Block F — Health strip

One grey line when all is well: engine last run, site status, and how old the site reading is. It grows into explicit warnings when something is wrong.

- **Engine** data arrives free with the summary call the page already makes.
- **Sites** come from the stored snapshot (D5), with a *Check now* control that re-runs `checkSites()` on demand.

---

## Navigation

The app currently has no way to reach a second page — `/` redirects to `/queue` and nothing links anywhere. P8 adds a top nav (Queue · Freelance · Settings), built to the design system along with the rest of the page (S17; this read "unstyled on purpose" before that decision). `/` keeps redirecting to `/queue`.

---

## Data model — the one addition

Site-health results must survive between the morning run and a page view. Following the repo's patterns (CLAUDE.md): bounded fields, no `Schema.Types.Mixed`, explicit `timestamps`, singleton reached through one accessor using `findOneAndUpdate({}, …, {upsert: true})`.

A single-document `HealthSnapshot`: `checkedAt` (Date), and a bounded array of `{ name, up, detail }` with `maxlength` on both strings. `timestamps: { createdAt: true, updatedAt: true }` — updates are the point of this record. No TTL: the newest reading must always be present, and it is overwritten rather than accumulated.

---

## Failure handling

- **Each block degrades on its own.** If `/attention` fails, Block E says so and every other block renders. One provider's outage degrades one feature, not the app (CLAUDE.md).
- **The three upstream calls run in parallel**, each under the existing `ST_TIMEOUT_MS`.
- **No failure is ever rendered as data.** A block that could not load says it could not load. A field ShikksTracker did not send says so. Neither becomes a zero (D8).
- Nothing here writes, so there is no in-flight state to sweep and no asymmetric-failure classification to make. That is a consequence of D6, and it is why D6 is worth keeping.

---

## Cross-repo contract — one proposal, not a change

**RikuOS cannot make this change.** Recorded here for a future ShikksTracker session to pick up, per the prime directive.

`GET /api/os/summary` should return the two switch states it already holds in `Settings`:

```jsonc
"engine": { "lastRunAt": null, "lastRunErrors": 0, "sendingEnabled": false, "draftGenerationEnabled": false }
```

Additive, so it breaks no consumer. It obliges a matching edit to ShikksTracker's `docs/os-api.md` and to `ARCHITECTURE.md` §4.1 in the same change. When it lands, RikuOS widens `SummaryEngine` **and** carries the fields through `fetchSummary`, which reconstructs its return value — widening the interface alone silently yields `undefined`. That exact pair was missed once already, in P4's `overdueActions`.

Until then, Block A simply omits the line. Nothing infers the switch state from behaviour; guessing it would be tunnelling around the contract.

---

## Testing and acceptance

Logic layer under `src/lib/__tests__/`, in the existing Vitest style — the gap calculation for Block E, the variant-stats email/non-email split, and the "missing is not zero" rendering decisions, all as pure functions with no database and no network.

**Done when:** `/freelance` is live on Vercel showing real OS-API data with nothing typed by hand — D11 satisfied for one page — `npm test`, `npx tsc --noEmit` and `npm run build` are all green, and Riku has seen the page report correctly once against real data.

---

## Non-goals

No visual design. No quest board. No action on any lead — no drafting, sending, or marking. No new agent. No new cron (Vercel Hobby's two are both used; the site-snapshot write rides inside the existing morning route). No change to `/queue`.

---

## Open items for the executing session

1. **Over-cap leads in Block E.** A reply the chaser skipped only because it hit `CHASER_MAX_PER_RUN` will be drafted on the next run, so it is arguably not a gap. It has no `ApprovalItem` yet, so it will surface. Left deliberately: a backlog that never clears is worth seeing, and suppressing it would hide a real signal. Revisit if it proves noisy.
2. **Campaign list bound.** The OS API defaults to 50 and caps at 200. Pick a display bound and state what happens beyond it.
3. **`Check now` and rate limiting.** The control re-pings three external sites. Decide whether it needs a floor between runs.
