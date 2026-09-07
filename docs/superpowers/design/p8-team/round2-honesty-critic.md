# P8 round 2 — Honesty Critic, rebuttal

Read: `round1-system-keeper.md` (SK), `round1-information-architect.md` (IA), `round1-frontend-architect.md` (FA).

---

## 1. Where I now agree

**1. Drafts waiting is violet `--roi`, not orange (IA §4.1, FA §2.6).** Orange means money *leaving*, and a draft backlog is not that. Decision 2 also puts a money card in this row later — spending orange now forces that card to fight for the hue, which is the redesign decision 2 forbids. Violet is the better meaning, not a compromise: 24 drafts is 24 decisions Riku has not made.

**2. Degraded (`itemsFailed > 0`) is red, not my amber (IA §3.2, FA §2.2).** The field's own docstring settles it: `itemsSkipped` is "candidates deliberately not acted on", `itemsFailed` is "candidates that were attempted and failed. Never silent (CLAUDE.md)." A failed attempt on a real lead is not ageing.

**3. Six agent badges, not five (SK §3.2, IA §3.2).** SK's phrase — "a rail showing five of six workers is a lie of omission" — is the argument. `watchdog` is kept out of `EXPECTATIONS` because a watchdog cannot report its own death; that reason does not apply to a *display*. **Condition:** the rail's list is a hand-written constant beside `EXPECTATIONS` with a comment saying why, so nobody "fixes" it by adding `watchdog` there and breaking `watchdog.test.ts:82`.

**4. `getHealthSnapshot()` must not upsert on read (FA §2.5).** The best find of the round in my lane, and I missed it. Following the repo's own singleton pattern would manufacture a document with a defaulted `checkedAt` and an empty `sites` array — the strip would confidently report a fresh check of nothing. A lie built by copying house style correctly.

**5. The `0%` lie can arrive pre-made on the wire (FA §2.3.3).** I said "never compute a rate for non-email". FA points out the OS API *returns* a `replyRate`, which almost certainly already computes `0/0 → 0%`. Refusing to compute is not enough — the page must refuse to print the field it was handed.

**6. The `read 14:32` clock stamp (IA §3.3).** I dismissed the stale-tab risk because the page is `force-dynamic`. That protects the render, not the tab: a page left open overnight shows yesterday's numbers with full confidence and says nothing. An absolute wall-clock time cannot go stale.

**7. Block D expands today, showing four approaches at 0 sends (IA §3.7).** Better *by my own rule*: `—` for rate beside `0` for sends, in one row, is the clearest demonstration of "missing is not zero" anywhere on the page.

**8. All-external-down omits blocks A–E rather than drawing them drained (IA §3.10).** IA uses §5.14 rule 5's own reasoning against rule 1 — six identical notices is noise, one statement is the design — and deck §6 renders exactly that.

**9. The hued dot replaces my `⚠` (SK §3.11, IA §3.9), and the strip becomes a bordered card when wrong (IA §3.9).** The reference has no warning triangle; the dot-with-glow is its own grammar. **Condition:** the dot must not be the only difference between a warning line and a healthy one — warnings at `--ink` 12.5px, healthy meta at `--ink-3` 10.5px. IA's card-when-wrong is the stronger half: the strip changes *shape*, which survives any colour failure.

**10. The reachability pill (IA §3.3) answers my objection — conditionally.** My veto was on a *persistent* `● connected` pill claiming unmeasured liveness. IA's is fed by this render's own fetch and sits beside the clock stamp, so it is a measured fact with its timestamp attached. Accepted **only as a unit**: the pill without the stamp re-becomes the lie. Prefer past tense (`ShikksTracker answered`).

---

## 2. Where I still disagree

**a. The third hero card — I hold, and here is the direct answer.**

IA §4.5's argument (b) — "structurally blind since S15" — does not hold. It conflates *replies are only detected on email* (Block D's variant scoring, which reads sent-message logs) with *replies only exist on email*. The attention feed carries whatever channel a reply came in on; the deck's own Block E specimen row is an **Instagram** reply from Bella's Cafe.

Argument (a), triple-counting, is answered by my round-1 condition: the hero figure is *the same computed number Block E renders* — a summary of the block below, not a rival to it. And SK §3.4 explicitly accepts exactly this duplication for hot leads (`2` also appears in Block B's `30 contacts · 2 hot`). Duplication cannot be disqualifying for one card and normal for the other.

Argument (c) — a card reading 0 most days is a position Riku learns to skip — is the real one, and three people made it. My answer: deck §1 says the journey is *push → glance → is this fine, or does it need me?* A card that answers "no" most days is not dead weight, it is the answer. A smoke detector is silent most days.

Against it: **hot leads is the only hero number RikuOS cannot account for.** It is ShikksTracker's scoring at 34px display weight, on a page whose §1 says its honesty about which system holds the truth is load-bearing — the closest thing here to a vanity metric.

**If the lead rules for hot leads anyway, two conditions.** It **must not be green** — IA and FA both give it `--save`, which means "value recovered, healthy"; a hot lead is an unconverted prospect and green claims money that does not exist. And **the hue budget for this row today is one**: drafts violet, the other two cards neutral, whichever occupies slot three. That also satisfies IA's own §4.2 reasoning about the untouched-contacts card.

**b. Money coming in is `--save` green, not `--spend` orange.** SK §2 says green; IA §3.4 and FA §2.6 both assume orange. `--spend` is defined as *money out*. Using it for money in makes orange mean both directions, which is the one-hue-two-meanings failure §1.1 exists to prevent. Lock green now, as SK asks — it also settles the drafts-hue question above without pressure.

**c. Two of the proposed hero graphics need conditions; one has a hidden failure mode.**

- **A field of discrete marks (SK, 24 squares) passes** — one mark per draft, no implied denominator, visible cap.
- **FA's `countStack` — "widths and opacity falling off toward the top" — does not.** That reads as a curve: the exact time-series illusion FA's own disagreement ① warns against. Flatten to uniform marks.
- **SK's 90px ring for 25-of-30: prefer IA's flat 4px track.** A ring is §5.5's *limit* component — how full, against what, until reset. This is a share of a whole with no limit and no reset. A bar says share; a ring imports semantics the number does not have.
- **The 30-dot population (SK card 3, FA `objectNodes`) has a hidden failure mode.** It draws one dot per *contact* on a card whose figure is `hot`, making a decoration depend on `contacts.total` — which can be `null` while `hot` is present, producing "2 lit dots on no population". **Condition:** it renders only when `total` is a real number, and the caption states the denominator.

Every hero graphic needs a specified `null` render. FA's `heroGraphics.ts` pins "null in, empty out" as a test; that rule should bind SK's shapes too.

**d. The 30-hour stale-snapshot rule — my firmest hold. Nobody addressed it, and FA's architecture makes it more necessary, not less.** The deck's healthy line prints `all sites ok` and `checked 6h ago` in one sentence. No paper drops the first clause when the second goes stale. FA §2.5 treats an ageing stamp as sufficient truth — but FA also *catches and swallows* a failed snapshot write (`itemsFailed: 1`, results flow on). So a persistently failing write yields a permanently ageing stamp beside a permanently confident **"all sites ok"**, from a reading nobody took. Past `site-health`'s own `everyHours + graceHours` (30h, not a number I invented), `all sites ok` must not print at all; the line becomes `sites not checked since 2d ago` in amber. This is also the only thing that makes a silent writer failure visible to the reader.

**e. FA's optional pending-approvals pill (§2.2) — cut it this phase.** No lie in the number itself, but it puts a second "waiting on you" count in the chrome, beside a 34px hero counting drafts waiting in ShikksTracker. `ApprovalItem` pending and `queue.drafts` are different lanes in different systems, and a pill has no room to say so. If kept, it must read `{n} to approve` and never a bare count. FA already marks it cuttable; I am asking for the cut.

---

## 3. What I noticed reading the others

**An internal contradiction between the two violet proposals.** FA §2.6 gives drafts `--roi` *and* applies §5.2's ROI exception — hue on the graphic, figure near-white. IA §4.3 gives drafts `--roi` and **no graphic at all**, so the exception has nothing to attach to and the card is violet in name only. The rule is conditional: the near-white figure is correct *only* when the hue is spent on a graphic. No graphic → the figure takes the hue.

**A concrete spec bug in the strongest build proposal.** FA's `deriveAgentStatuses(now, latest, expectations)` reads only run records. With `monitoringEnabled` off, `morning/route.ts` writes `ok: true` placeholder rows for four agents — so as specified, that function paints **four green badges on a system doing nothing.** SK's badge table has no off state either; only IA flags it, as an open question. The signature needs the switch state passed in. One detail all three missed: **`expiry-sweep` is never off** — it runs whatever the toggle says — so it must not be grouped with the four that can be.

**Two papers independently invented the same missing component.** SK's `.stat.plain` and IA's "hueless but with data" card are the same thing: the reference has only `.stat.blank`, which is hueless *because* it is empty. A card with real data and deliberately no hue has no name in the system, and two people needing it independently says it should be added by name rather than improvised twice.

**All four of us hit the `--stale`/`--missing` vs `--amber`/`--alert` token split independently and resolved it the same way.** Settled.
