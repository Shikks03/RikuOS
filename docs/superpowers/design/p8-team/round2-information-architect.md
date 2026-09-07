# P8 round 2 — Information Architect

**Date:** 2026-09-06 · Read: System Keeper (SK), Honesty Critic (HC), Frontend Architect (FA), round 1.

---

## 1. Where I now agree

**HC — read "off" from `OsSettings`, never from the run's note string.** I flagged the green-badge lie in R1 then proposed fixing it by reading the note in `error`. HC is right: `runJob.ts` says "nothing reads it back programmatically", and making the UI the first reader turns a debugging note into a contract. Read `chaserEnabled` / `monitoringEnabled` instead, and render the lowercase word `off`.

**HC — the 30-hour stale-snapshot rule.** I treated `checked 6h ago` as neutral meta with no threshold. `all sites ok · checked 5d ago` is a present-tense claim from a stale reading, and 30h is not invented — it is `site-health`'s own `everyHours + graceHours`. It also turns an invisible `HealthSnapshot` write failure into a visible stale reading. A hole in my Block F.

**HC and FA — a null pipeline stage must not collapse into "Nothing yet at…".** Both found it; I missed it. That line means *measured zero*, so folding in a stage the API never sent is the D8 violation the page exists to avoid. FA's `unknownLine` is the right shape.

**FA — a page-level timeout shorter than `ST_TIMEOUT_MS`.** Three hung calls at 15s can outlive the function budget and hand Riku a Vercel error page instead of the deck's degraded copy — erasing every state in my paper. 6s is a precondition, not a detail.

**SK, HC and FA — the `--alert`/`--amber` vs `--stale`/`--missing` split.** I used the §2 names without checking that `components.html`'s `:root` defines neither. HC's framing is sharpest: the warning line then renders in inherited body grey, failing toward "everything is fine".

**HC — the tell for "intentional" is left-alignment, not hairlines.** I said `Nothing waiting.` gets no box and no pill; HC names the mechanism — centred in a box is an empty state, left-aligned where content lives is a finding.

**SK and HC — drop the green on `Won` (Block B) and `Replied` (Block C).** Both are successes, not signals (§5.8). HC's hue-inflation point — every hue elsewhere raises the floor the health strip must clear — is right, and I was spending two cells against it for little.

**SK — no `Refresh` control**, and **the strip's marker is a hued dot, not `⚠`.** The reference has no triangle anywhere and uses a glowing dot for exactly "this thing is in this state" (§5.10). The words are the deck's; the marker is the system's.

**HC — no ShikksTracker connection pill.** Detailed in §2, but it is a concession.

---

## 2. Where I still disagree, and why

**The third hero card — hot leads, not HC's gap count.** HC's hard condition (the hero must equal Block E's computed number) is correct *if* the card ships, and it also exposes the problem: the card then stops being an independent fact and becomes a label for a section four blocks below it. Today it reads `0` — HC's own render is "one orange, one white, one grey card," i.e. **one lit thing on the page's most-read line**. Two numbers both answering "does this need me?" and disagreeing (24 vs 0) is worse than one. HC's strongest point is that "hot" is ShikksTracker's judgement that RikuOS cannot explain — but `queue.drafts` is equally opaque, and the caption already attributes it (`contacts flagged hot in ShikksTracker`). SK and FA reached the same conclusion independently. **Hold.**

**Hero hues — violet / none / green.** SK locks money-in as green so orange can stay on drafts. That is the crux and I think it is backwards: §5.11's layer table assigns **Freelance = `--spend` orange "because it's money work"** — the reference putting freelance money on orange explicitly. Green is *value recovered*; money arriving is not recovered. So orange is reserved and drafts take violet (FA agrees). On card 2, three of four papers reject amber; HC's wording is the one to keep — any hue there "turns a setting into a daily accusation" under S10. FA's blue is wrong for a narrower reason SK already supplies: `--session` means activity, this counts its absence, and SK's own table says `--session` is unused on P8. Card 3 green vs SK's violet is **coupled to card 1** — if the lead gives drafts orange, violet on hot becomes right. Rule card 1 first.

**Hero graphics — I concede the principle, hold the objection.** SK and FA proved a shape can be data-shaped without a time series; I overstated. But 24 marks, 24 stacked lines and 30 scattered dots are a *second rendering of the same digit*. §1.5's test is not "derived from the number" — the spend contours say something the figure cannot. A field of 24 squares says 24, which the 34px figure already said louder, and it is a second countable thing in a card §5.2 limits to one loud figure. Both proposals also cap and fade above 48/60, so the graphic stops being true exactly when the page fills. My card-2 track passes because the *proportion* is a fact `25` does not state — which is why it is the only graphic I kept. **Hold.**

**Six agent badges, not HC's five.** Decision 3 says one badge per background worker, and `watchdog` is one — it writes an `AgentRun` row nightly. HC's own remedy (add it to `EXPECTATIONS`) is unavailable: `watchdog.ts` explains the omission and SK reports `watchdog.test.ts:82` asserts it. That leaves showing five while six run, which is SK's lie of omission. The display-only threshold is not a private rule — it is the same 24+6 every other agent has, and it feeds nothing. **Hold.**

**`degraded` is red, not HC's amber.** `itemsFailed > 0` means real work items failed, which CLAUDE.md's no-silent-failure rule says Riku must see; amber's meaning is *ageing* and a degraded run is fresh. FA reached red independently. I accept HC's captions, but only on non-green badges — six badges × two lines is twelve text rows in a 170px rail, which is SK's "second data display competing with the hero row".

**Health strip — footer when quiet (with HC, against SK), card when wrong (against both).** SK gives it `background: var(--panel)` permanently, which makes it a panel while quiet; the deck says footer and wins (§7.3). But the deck also says *impossible to miss*, and a 5px dot on 12.5px text at the bottom of a scrolled page is missable. Gaining a border and a ground is §4's own grammar for "this is a real object now" — a structural alarm that costs no hue budget, which matters given the concessions above. **Hold.**

**Headings — deck word as eyebrow, free sentence as heading.** SK and HC both invoke §7.3 ("the content spec wins"). §7.3 says this file "governs how things look and behave, **not what is rendered**" — a type role is how a thing looks, so there is no disagreement for §7.3 to resolve: the deck names the string, the reference names the slot. Neither paper addressed that scope point. And SK's alternative invents `SHIKKSTRACKER · CONTACTS` — invented text either way, repeated four times down the page where I say it once at the top. **Hold, but this is the one I would yield first.**

**Top bar — I drop my pill, keep the stamp, move logout back.** HC is right that RikuOS holds no live connection to ShikksTracker, only request-time calls, so a "connected" pill claims a liveness nothing measures — my own standard, correctly turned on me. Between SK's push pill and nothing I now prefer **nothing**: push state is client-only and would hydrate the top bar for an ornament that duplicates `PushControls`. The clock stamp stays (render time *is* measured). Logout moves to the bar per SK.

**Amber on Block E's overdue line — hold, and it is consistent with dropping the greens.** `Won` and `Replied` are successes needing no signal; `follow-up due 3 days ago` is *measured lateness against a date Riku set*, on the one row kind the design doc says nothing watches at all (D3). §5.12 gives `COLD` amber for precisely "still there, no longer fresh". One 9.5px mono line, not a card.

---

## 3. What I noticed reading the others

**HC's hero card has an argument HC did not make, and it is the one that would move me.** All four of us put Block E fifth, correctly, per D1. Nobody but me costed it: at §8 fullness the only actionable list sits below seven pipeline rows with no count above the fold. A "needs you" hero fixes that — the strongest case for HC's card, and if the lead rates that risk highly it outweighs my hold above.

**The token bug is in the half we are building from.** All three papers found the `--alert`/`--stale` split. None noted that `components.html` writes `var(--stale,#FBBF24)` twice and **both sites are in the RikuOS layer** (§5.12's pipeline strip, §5.13's course card). The reference's own new components are already broken against its own `:root`.

**Two papers invented two different fourth card tints for the same card** — SK's amber `--tint-stale` and FA's blue gradient, both for "contacts never contacted". Three of four papers then argue that card should be hueless, which leaves both tokens consumerless; FA's own rule says a defined unused token is an invitation.

**One thing nobody agrees on:** `/queue`'s inline header once the shell exists. FA votes delete (~10 lines, no behaviour change), SK says nothing structural moves, HC is silent, I said keep — and FA and SK also contradict each other on whether `main` widens to 920px. It is the only place decision 4 and a working shell genuinely conflict.
