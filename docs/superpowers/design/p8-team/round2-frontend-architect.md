# P8 round 2 — Frontend Architect, rebuttal

**Date:** 2026-09-06 · Read: System Keeper (SK), Information Architect (IA), Honesty Critic (HC), round 1.

---

## 1. Where I now agree

**The contacts card takes no hue. (IA §4.2, HC §2.3-H2.)** My biggest concession. I reasoned in round 1 that amber on "25 of 30 never contacted" would be a daily false alarm under S10 — and then picked `--session` blue anyway, purely to keep three hues in the row. SK named the flaw exactly: blue has no consumer on this page. A hue chosen to fill a slot is a hue used decoratively, which §2 lists under **Never**. The row is **violet / no hue / green**, which is IA's row.

**Six agent badges, not five. (SK §3.2 note 2, IA §3.2.)** HC and I both said five, on "the page must not carry a rule the engine does not have". SK is right that a rail showing five of six workers is a lie of omission — and it costs nothing, because `deriveAgentStatuses` already takes `expectations` as a parameter: the rail iterates a hand-written `RAIL_AGENTS: Expectation[]` of six rows and **`EXPECTATIONS` is untouched**, so `watchdog.test.ts:82` keeps passing. SK is also right that the list must never come from the `AGENTS` enum (`lead-sweep`, `triage`, `retro` are ghosts).

**The "off" state, read from `OsSettings`. (HC §2.2.)** A real bug in my round 1. `runJob` writes `ok: true` with the note in `error` for a switched-off agent (`chaser/route.ts:65`; four agents in the morning route), and my derivation reads only `LatestRun` — so it would paint a switched-off chaser green. `deriveAgentStatuses` gains a `switches` argument; still pure, still tested. The note string must never be sniffed.

**Captions under the badges. (HC §2.2.)** No colour can separate "never run" from "off". A mono 8.5px `--ink-4` line under each badge does, and it gives `degraded` somewhere to say `2 items failed`.

**The stale-snapshot rule. (HC §2.9.)** `all sites ok · checked 5d ago` asserts a present state from a stale reading; past 30h — `site-health`'s own `everyHours + graceHours` — the phrase is dropped. This closes a hole *I* opened: my cron catches a failed snapshot write and counts it, which leaves the page saying everything is fine forever. `buildHealthStrip` takes the threshold as an argument rather than importing `EXPECTATIONS`.

**`0 sends → em-dash, not 0%`. (HC §2.7.)** My `splitVariants` recomputes the rate rather than trusting upstream, but I never specified 0/0. One guard, one test.

**The old pages' `button` — IA's mapping over mine. (IA §3.11.)** I proposed one neutral outline for all three meanings and called it "nothing is wrong, nothing is special". IA's `button` = outline pill **plus the active-nav fill** is better: it makes `/queue`'s filter row read as §5.3's view switch with zero TSX, and a filled Approve beside two outline buttons is right for a primary action.

**Logout in the rail foot, and I withdraw my pending-approvals pill. (IA §3.3.)** `.rail-foot` is the reference's own slot; HC's hue budget and SK's loud-thing count both land, and the pill was scope I added.

**The `var(--stale,#FBBF24)` fallback bug. (SK §2, HC §3.15.)** I found only the naming split. It is worse than either said: a custom property that resolves to nothing is invalid-at-computed-value-time, so `color: var(--missing)` **inherits** — a red warning renders in body grey, silently, in the one place it matters.

---

## 2. Where I still disagree

**Third hero card — hold hot leads (SK, IA, me) over HC's gap count.** HC's hard condition is right and I would adopt it if overruled: the figure must be the *computed* Block E gap count, never raw `repliedUnanswered`. But the card then costs a **Mongo read** — the gap needs `liveAnchorIds` from `ApprovalItem` — so when Mongo hiccups the page's most-read figure reads `—` for a reason that has nothing to do with the freelance pipeline, while the two cards beside it read fine. `contacts.hot` arrives free in the same `fetchSummary` call as the other two. HC's own §2.10 concedes the Mongo-down case is undesigned; this is where it bites.

**Drafts card — hold violet (me, IA) over orange (SK, HC).** IA's argument is decisive: decision 2 requires a money card to join "without a redesign", and money-in is orange by the token's definition. Spend orange now and the later card either fights for it or takes a wrong hue — a redesign, forbidden. SK's own §2 note ("money in is `--save`, not orange") frees orange, but then orange has no consumer on the page at all except the brand mark, which is worse than violet meaning what §2 says it means: judgement, decisions. 24 drafts is 24 decisions.

**Hero graphics — three, merged with SK's. (Against IA §4.3.)** SK and I independently designed nearly the same set, and his are better on two of three: the **lit population** (30 grey dots, 2 lit) beats my bare nodes, because a count of 2 with no denominator is not a reading; and the **ring** beats my ticks on the reference's own ~16-segment countability limit, which my `ratioTicks` threshold would have hit anyway. Merged: **mark field (count) / ring (ratio) / lit population (selection)** — SK's shapes, my pure builders with `null → empty`, determinism and a bounded element count. Against IA: we agree on the premise (no series, so no sparkline) but he stops one card short. §5.2 asks for three different *readings*, not three curves, and a count, a ratio and a selection are three readings built only from integers the API returns. One condition on SK's scatter: **no seeded PRNG** — an index lattice, so the picture is identical on every render and a test can assert it.

**`degraded` is red, not amber. (Me, IA §3.2 vs HC.)** Amber means *ageing*; a run that completed with failed work items is not late, it failed at its job, and CLAUDE.md's no-silent-failure rule says over-report. HC's caption carries `2 items failed`, so the stakes are small.

**`⚠` vs the hued dot — SK's dot, settled by the deck rather than taste.** Deck Block F's string table ("these are the exact strings the system produces") contains **no `⚠`**; the glyph appears only in the ASCII "worst case render". So SK's substitution changes no final string, and HC treated it as one. Engineering reason to prefer the dot: `⚠` is U+26A0, which several platforms render in emoji presentation — a colour glyph in a monochrome instrument panel — and defeating that needs a variation selector. A `<span>` with a token colour and a `box-shadow` has no font dependency.

**IA's health strip becoming a bordered card when wrong — agreed.** §1.4's "cards earn their borders" makes it a structural alarm, quieter and stronger than more colour. `buildHealthStrip` returns a `severity` the component switches on; one more tested value.

**Column width: 920, not 980 — and SK's own arithmetic gets there.** SK wants 980 so a fourth hero card clears the 215px minimum. At 920 with 14px gaps, four cards are (920 − 42) / 4 = **219.5px**, which clears it. The catch is that `globals.css` sets `box-sizing: border-box`, so `max-width: 920px` *with* padding gives 864px of real content and four cards wrap. Fix: **horizontal padding on the shell's `.col`, `max-width: 920px` on `main`** — then 920 means 920, the reference's own `--maxw` stands, and decision 2's four-card requirement is met. Both are CSS; zero TSX.

**`pre.body` keeps the body face (me, IA) over mono (SK).** It holds a draft email to a business owner. §6's rule is mono for what the machine names, sentence case for what addresses a person — rendering Riku's own outgoing message in JetBrains Mono makes him read it as machine output, in the one place he is checking tone.

**The duplicated headers — I concede the phase, and raise one consequence.** SK and IA both leave `/queue`'s inline header alone; 2–1, I accept it for P8. But if logout moves to the rail foot, `/queue` shows **two logout buttons at once**. That is the one duplication that is confusing rather than merely untidy, and it stays my open question for Riku.

### Costs the other papers did not price

- **HC's "off" state** needs an `OsSettings` read in the shell — a second collection in the layout's DB trip. Cheap, but it must sit inside the *same* try/catch, or a settings failure greys the badges for the wrong reason.
- **SK's push-registration pill (§3.3) cannot be server-rendered at all.** `navigator.serviceWorker` and `pushManager.getSubscription()` are browser-only, so the pill needs a client island in the layout running an async check on every page, plus a third "unsupported" state. IA spotted this; I agree, and it is a build cost, not a preference.
- **IA's reachability pill — the coordinator asked whether it is possible. It is, but only one way.** A layout is a *sibling* of the page in the RSC tree and cannot receive the page's fetch outcome; there is no data channel upward. The one supported route is React `cache()`, so layout and page call the same wrapped function and the request is deduped. That works — and it means **`/queue` and `/settings` both call ShikksTracker just to paint a pill**, putting an external system's latency in front of every page in the app. Reject on that, not on impossibility.
- **IA's clock stamp — take it, with a trap.** A server render on Vercel formats in **UTC**, so `read 14:32` would be eight hours wrong for Riku. It needs an explicit `timeZone: "Asia/Manila"`.
- **IA's `main` widening 640 → 920** is a visible layout change to `/queue`, which is under a no-change order. Unavoidable if the shell wraps it; flag it to Riku rather than letting him find it.
- **HC's Mongo-down rail state** (`—`, distinct from grey "never run") must come from the layout's catch block, not from the derivation — the pure function never sees a failure.

---

## 3. What I noticed reading the others

**All three missed the same runtime state.** No state matrix covers what happens when the upstream calls are *slow* rather than failed. `ST_TIMEOUT_MS` is 15 s — a cron's timeout — and three parallel calls at 15 s can outlive the function budget, at which point Riku gets a Vercel error page instead of the deck's carefully written `Couldn't reach ShikksTracker.` A 6 s page-level timeout is what makes every degraded state the three papers designed actually reachable.

**A second instance of the reconstruct-trap, in `fetchAttention`.** HC correctly flags that widening `SummaryResponse` without carrying the field through `fetchSummary` yields `undefined`. The same file does it twice: `/api/os/attention` returns three arrays per ShikksTracker's contract (`repliedUnanswered`, `hotLeads`, `overdueActions`) and `fetchAttention` reconstructs only two — `hotLeads` is already being silently dropped today. It does not matter for the hero (hot comes from `summary.contacts.hot`), but it means the trap is a pattern in this file, not a one-off.

**IA and HC contradict each other on the top-bar pill**, and HC is right: IA's `● ShikksTracker connected` is exactly the claimed liveness HC's §2.1 forbids — true at render, false a second later, on a page whose premise is *what is true right now*. My cost ruling lands on the same side for a different reason, which is usually a good sign.
