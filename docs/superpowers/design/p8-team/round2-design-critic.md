# P8 round 2 — Design Critic

**Date:** 2026-09-06 · **Role:** judge the four Round 1 papers against the reference's §6 checklist, the deck's §9 checklist, and Riku's five decisions. Rank the conflicts and recommend a ruling on each.
**Standing question:** what would a senior designer reject?

---

## 1. Verdict

The four papers agree on far more than they disagree on, and what they agree on is the right stuff: one shell, one rail, no second sidebar, no boxed rows, hairlines everywhere, tabular numerals, no action on any lead, no first-run banner, no fake affordances in the top bar, no `0%` in Block D, no cadence strip smuggled in from §5.12, and the `--alert`/`--amber` versus `--missing`/`--stale` token split resolved the same way by three of them. That is a settled foundation and the lead should stop treating it as open. What is genuinely contested is smaller and sharper than the twenty-item list suggests: it is **which three numbers the hero row carries and what colour they are** (C1, C2), **whether those cards get graphics at all** (C3), and **whether the health strip is a permanent panel or a footer that grows into one** (C6). Everything else is either a coin-flip dressed as a principle or a case where one paper is simply right on the evidence. Two conflicts change the page more than the other eighteen combined. C1+C2 decide what Riku's eye lands on when he opens the page after a push — and today, under three of the four proposals, it lands on a violet or orange number he already knew, next to an amber number that accuses him of a decision he made on purpose. C3 decides whether the page's most prominent objects are readings of data or shapes drawn to fill 74px. Get those two right and the rest is bookkeeping. The single most dangerous thing across all four papers is not a disagreement at all: **all four print Block D's reply rates at full strength with no note that 11% is eight replies**, on a page whose reference lists "estimated numbers say so, right under them" as a Hold item and whose deck spends half a block explaining what cannot be measured.

---

## 2. Ranked conflicts

### 1. C1 — the third hero card

- **Hot leads (2 today):** SK, IA, FA — live, non-zero, forward-looking, stated nowhere else *(IA)*.
- **Needs you (0 today, the same count Block E renders):** HC — it is the page's own question, answered in one figure.

**Evidence.** Deck §1 names the dominant journey: *phone buzzes → glance → is this fine, or does it need me?* Deck Block B fixes the summary string `30 contacts · 2 hot` — **final, and unremovable**. Reference §1.3 rations the page to roughly three loud things; §5.14.1–2 make a drained card a legal, composed state.

**Recommendation: Needs you, with HC's hard condition** — the figure must be the same computed gap count `buildNeedsYou` returns for Block E, never raw `attention.repliedUnanswered`. Two reasons, one of them near-dispositive. First: `2 hot` is already on the page six lines below the card, in a string the deck declares final, so a hot-leads hero **forces a duplication that cannot be designed away**. Spending one of three loud figures restating plain text a screen-length below is the definition of padding. Second: cards 1 and 2 are both "what is owed / what is untouched"; a gap count completes a coherent triad — *what waits on you in the other app, what nothing has touched, what nothing is handling* — and it is the only card that answers the question the page exists for. IA's objection that "a card that reads 0 most days is a position Riku learns to skip" is exactly backwards for this system: 0 **is** the answer he is looking for, and the reference's whole empty-state doctrine (§5.14) exists so a drained container reads as a finding rather than a hole.

**If ruled the other way:** the row opens with a duplicated figure, Block B's summary line reads as an echo, and the page never answers its own question above the fold — which is IA's own risk 1 turned into a design choice.

---

### 2. C2 — hero hues, and the reserved money hue

- **Drafts:** orange (SK, HC) vs violet (IA, FA).
- **Contacts:** amber (SK) vs blue (FA) vs no hue (IA, HC).
- **Third card:** violet w/ near-white figure (SK) vs green (IA, FA) vs `--alert` red (HC).
- **Future money-in:** green (SK) vs orange (IA, FA).

**Evidence.** §2's fixed meanings: `--spend` = money out and the brand mark; `--roi` = ROI, **decisions**, insight; `--stale` = ageing data, idle agents; `--session` = activity, runs; `--save` = value recovered, healthy. §2 **Never**: "a hue used decoratively where it does not carry its assigned meaning." S10: an unsent pipeline is CORRECT and no surface may report it as a stall, a backlog or a gap. Decision 2: a money card must join without a redesign.

**Recommendation, four rulings:**

1. **Drafts = `--roi` violet, figure in violet.** 24 drafts is 24 decisions not made — the token's literal definition. Orange means money *leaving*; a draft backlog is not money leaving, and SK's and HC's justifications ("money work", "this consumes you") are the §2 Never. Violet also makes this page and the Approval Queue speak one colour for one fact, which is what §7.2's single palette is for. **Do not take §5.2's ROI near-white exception here** — that exception exists because the ROI card spends its hue on a graphic; with no graphic (C3) the figure keeps the hue, or the card has nothing lit at all.
2. **Contacts = no hue.** Figure in `--ink` at full 34px, plain `--raised`, `--line` border. SK's amber is a **daily S10 violation** — a 34px amber figure is the loudest possible way to report a deliberate setting as ageing inventory. FA's blue inverts `--session`: this counts the *absence* of activity, and it forces a fourth invented gradient. Precedent for a hueless figure exists twice in the reference: §5.2's ROI figure and §5.8's "a healthy strip is entirely white on black".
3. **Third card = `--stale` amber when > 0, drained at 0.** HC's red is token-arguable (§2 says "gaps") but wrong in practice: these gaps are *permanent and normal* — an Instagram reply will never have a draft — and red must stay rationed to the health strip so the strip can be unmissable (deck Block F). Amber is token-true: every string in Block E is a duration, and §5.12 gives `COLD` amber for exactly "still there, no longer fresh". It also agrees with C13.
4. **Orange is reserved.** On P8 it appears only on the logo tile. §2 has no token for revenue — `--spend` is money *out*, `--save` is value *recovered* — so the money-in hue is a genuine open question for the reference's §7, not something this team can settle. Reserving orange means it is settled either way with nothing on P8 to move.

**Today's row therefore reads: one violet figure, one white figure, one grey figure.** One lit thing, which is the correct report.

**If ruled the other way:** amber on contacts starts a permanent argument with S10 that a future session will eventually "fix" by enabling a switch; orange on drafts spends the brand hue and re-opens the money-card question as a redesign.

---

### 3. C3 — hero graphics

- **Three bespoke SVGs:** SK (mark field / ring / lit dots), FA (count stack / ticks-or-bar / haloed nodes).
- **None except a 4px track on the proportion card:** IA. HC takes no position.

**Evidence.** §5.2 wants three *different* graphic treatments, each "a reading of that card's own number". §1.5: decoration is data-shaped; "nothing exists purely to look expensive — which is why it looks expensive." §6 Avoid: the same sparkline on every card. Deck §2.6: no decorative work that fights the content.

**Recommendation: IA.** The test §1.5 actually sets is whether the graphic tells you something the figure does not. The source's do: the contours show spend *over 28 days*, the swoop shows the savings *curve* — both add a dimension the figure lacks. A field of 24 marks and a scatter of 30 dots with 2 lit add nothing the digits already say; they are second drawings of the same number. **SK's own paper supplies the killing argument** — he rejects bars in Block B because "a bar would be a second drawing of the same digits, which is decoration, which governing idea 5 forbids." That rule does not stop at Block B. FA's `objectNodes` compounds it by using §5.8's halo, which the reference permits on graph nodes and status dots — a stat card's decorative circles are neither. SK's card-3 scatter additionally invents a spatial arrangement on a fixed seed: a layout with no meaning, which is FA's own determinism test failed on the other axis.

The contacts card is the exception and IA is right about it: 25 of 30 is a **ratio**, and a 4px `.track` at 83% shows a proportion the figure alone does not. One track, `--ink-4` on `#1A1E25`, no hue — matching its card.

**If ruled the other way:** three bespoke SVGs to build, test, maintain and give empty states to; two of the three fail the reference's own decoration test; and the first thing that gets flattened under time pressure is exactly the thing the reference warns about. If the row feels bare, the honest levers are the section rhythm and the 44–72px gaps, not shapes. **Check this on the real screen first** — it is the one ruling here whose cost only shows up in pixels.

---

### 4. C6 — Block F, the health strip

Three sub-questions plus HC's stale-snapshot rule.

**(a) Marker.** `⚠` (HC) vs hued dot (SK, IA, FA). **Rule: hued dot.** `⚠` is not a deck string — the deck's Block F lists "the exact strings the system produces" and none contains a triangle; the `⚠` appears only in the "worst case render" ASCII, which is a layout sketch. §7.3 therefore does not bind. The reference has no warning triangle anywhere and uses a 5px dot with a matching `box-shadow` glow for exactly "this thing is in this state" (§5.8 signals, §5.10 status pill). `⚠` also renders as a colour emoji on several platforms without a variation selector — an avoidable fidelity risk in the one element that must be unmissable. SK is right to flag it to Riku; the default is the dot.

**(b) Structure.** Stat strip on `--panel`, always (SK) vs hairline footer that becomes a bordered card when wrong (IA) vs plain hairline footer (HC). **Rule: IA.** The deck's sentence has two clauses — *"should read as a footer, not a panel — until something is wrong, when it must be impossible to miss."* SK's permanent `--panel` fill breaks clause 1 every day; HC's unchanging footer carries clause 2 on hue alone. IA satisfies both with the system's own grammar: §1.4, cards earn their borders, and a warning **is** a real object. A structural alarm is stronger and quieter than a colour alarm, which is exactly what a page with a one-red budget needs.

**(c) `stranded-approved`.** Amber (IA) vs red (HC, SK). **Rule: red.** IA's reason is that approved-and-waiting is correct on its own under S10 — true, but `outreachHealth.ts` fires this line *only alongside a stalled engine*, so the case IA is protecting never produces the line. When it appears, messages that should have gone did not, and a human is waiting. `--missing` = "conflicts, gaps".

**(d) HC's 30h stale-snapshot rule.** **Adopt it.** "all sites ok · checked 5d ago" asserts a present-tense fact from a stored reading, and it makes a silent `HealthSnapshot` writer failure invisible forever — the strip would keep saying everything is fine while the stamp quietly ages. The 30h threshold is not invented: it is `site-health`'s own `everyHours + graceHours`, so the strip and the watchdog agree on what "fresh" means. Past it, drop `all sites ok` entirely and print the stamp as a statement, in `--stale` amber (the snapshot is ageing data — the token's literal definition). The string is new and goes to Riku for wording.

---

### 5. C15 — the old pages' `button`

- **SK:** bare `button` → neutral outline pill; *and* status filters → solid `--ink` pill; *and* Approve → green affirmative pill.
- **IA:** bare `button` → active-nav fill `#171B21` + inset hairline; `.secondary` → ghost.
- **FA:** one neutral outline pill for everything; filters lose their solid state.

**Evidence, from the code.** Unclassed `<button>` is Approve (`queue/page.tsx` ~192), Approve edited, the **active** status filter (~128–136), "Turn on" in Settings (~87, ~131) and Save. `.secondary` is Log out, Edit, Cancel, the inactive filter. `.danger` is Reject and "Turn off".

**Recommendation: FA's Option A.** SK's table is **not implementable** — his three rows describe three different treatments for one element selector, and decision 4 forbids the `className` edit that would separate them. IA's is implementable but collides semantically: `#171B21` + inset hairline is the *active-nav* treatment (§4) and the *today* cell (§5.11); reusing it for Approve makes a primary action look "selected", in a system whose first governing idea is that a treatment's meaning never moves. FA's single neutral outline pill obeys decision 4 literally, and the filter row still reads (bright outline vs dim outline).

**FA's second question — the ~10-line inline headers on queue/settings — is Riku's, not the lead's.** Keeping them puts two navigations and two Log out buttons on `/queue`. That is a visible defect the shell creates, not a style preference, and removing it changes no behaviour: every affordance survives in the rail. My recommendation to Riku is delete, and to take Option A for buttons rather than spending a decision-4 exception on a treatment `/queue` will revisit at its own S11 discussion.

---

### 6. C7 — section rhythm

- **SK:** eyebrow `SHIKKSTRACKER · CONTACTS` + heading `Pipeline`.
- **IA:** eyebrow `PIPELINE` + free heading `Where your contacts stand`; page pair `SOURCE · SHIKKSTRACKER` / `Where your outreach stands`.
- **HC:** eyebrow `PIPELINE` + heading `Pipeline` (the same word twice).

**Recommendation: IA's structure, not IA's strings.** IA's reconciliation is correct and it is the paper's best idea: §5.1 *defines* the eyebrow as the machine's name and the heading as the human one, and `Pipeline` / `Campaigns` / `Approach performance` **are** machine names. Putting the deck's word in the eyebrow keeps every final string on screen in the type role that matches what it is, and frees the heading to hold §6's Hold item. `text-transform` is presentation, not a string change.

But a senior designer would reject the four headings IA writes. "Where your contacts stand" / "How your campaigns did" / "Which of your openings gets replies" / "What only you can do" restate the eyebrow at greater length, on a page whose deck says density beats impact and whose only reader built the system. §5.1's own examples name a **thing you own** ("Your skills"), not a question the block answers. **Use short operator-addressed noun phrases:** `Your pipeline` · `Your campaigns` · `Your openings` · `Waiting on you`.

SK's `SHIKKSTRACKER ·` prefix repeats the same word in four eyebrows down one page. The deck already carries provenance where it matters — in A1's caption, in the missing-data strings, in Block F's warnings — so a fourfold stamp is belt-and-braces.

**Page level: the deck's `Freelance` is the page title at display 600 / 24px, with no eyebrow above it.** See §3 — all four papers lost it. The rail's active item plus the title already say where you are twice; a third saying is chrome that shouts.

---

### 7. C4 + C5 — the agents block

**C4, membership: six badges including `watchdog`** (SK, IA) over five from `EXPECTATIONS` (HC, FA). Decision 3 says the block is live *from run records*, and `watchdog` writes one. HC's principle — "the page must not carry a rule the engine does not have" — is sound but leads nowhere: `watchdog.ts`'s header and `watchdog.test.ts` both pin its absence from `EXPECTATIONS`, so HC's remedy can never be taken and the position collapses to a permanent five. A rail that shows five of six workers is a lie of omission, and it omits precisely the worker whose death the rail is best placed to show. **Condition:** the sixth badge's freshness reads the same `24 + 6` constant, exported from `watchdog.ts` and used by both, never a second literal.

**C5(a), `degraded`: red** (IA, FA) over amber (HC). It ran, and it did not run fine. Amber's badge meaning is "overdue" — a time claim — and a degraded run is not late, so amber would be factually false about the badge's own semantics. Red plus the item count in the caption.

**C5(b), the `off` state: adopt it** (HC, IA). This is not really a conflict; it is a hole in SK and FA. When `monitoringEnabled` is off, four agents get `ok: true` placeholder rows and a naive mapping paints them **green, "ran fine", while doing nothing**. That is the page lying every day. It costs no fifth colour: `off` renders as the grey never-run treatment with the caption `off`, read from `OsSettings` — never sniffed from the `error` note string, whose own docstring says nothing reads it back.

**C5(c), captions: only where colour cannot carry the meaning.** Twelve lines of text under six badges in a 170px rail is chrome shouting (§1.3). But grey has to separate `never run` from `off` from `unknown`, and those are opposite meanings. So: caption on grey and on red (`2 items failed`); none on green or amber, where the hue is the whole message. `title` is a bonus, never the only carrier.

**C5(d), healthy treatment: SK.** Green label on the plain `.agent` ground, `rgba(53,211,153,.18)` border, **no gradient**; amber and red keep the tinted fill. The specimen only ever shows two *problem* badges, so the reference is silent on healthy — and six permanently tinted badges make the broken one differ only in hue, not in weight. §5.12's own state-tag rule is the precedent: outline by default, only the exceptional state fills.

---

### 8. C17 — content column width

**980px (SK) over 920px (IA, FA) — and this is arithmetic, not taste.**

`--maxw: 920px` in `components.html` belongs to the *teardown article* (it styles `section`, `.masthead`, `footer`) — furniture FA's own rule says not to port. §4 specifies only "single column, generous side padding". So neither number is in the reference for the app. What *is* in the reference is `.stats { grid-template-columns: repeat(auto-fit, minmax(215px,1fr)); gap: 14px }`, a §5 component to be taken as written.

With `box-sizing: border-box` and 28px side padding, a **fourth** card needs `4×215 + 3×14 = 902px` of inner width. At 920px the inner width is 864px — **the money card wraps to a second row**, which is the redesign decision 2 forbids. At 980px the inner width is 924px and it fits with 22px to spare. IA gets there only by quietly dropping the card minimum to 200px, i.e. by deviating from the component rule to rescue the column width.

**Rule: 980px content column, `minmax(215px,1fr)` verbatim.** Three cards land at ~299px each. If the lead prefers 920px, the deviation to 200px must be written down as a deviation, because the next two pages inherit it.

---

### 9. C14 — whole page down

**IA: blocks A–E omitted, one statement.** The deck's §6 render is unambiguous — page title, the two-sentence statement, the strip, and nothing else. §7.3 makes that binding. §5.14 rule 1 (containers never disappear) is overridden by §5.14's own rule 5, which is the same shape of argument: one banner beats six identical prompts. HC's drained cards and SK's row of em-dashes each invite the reader to ask "is this zero or broken?" five times about a fact stated once at the top — the exact confusion the page exists to prevent. **Must stay distinguishable from "one source down"**, where only the affected block carries its string and everything else renders normally (all four agree on that).

---

### 10. C12 — Block D

**(a) Group headings: mono-caps eyebrows** (IA, HC) over sentence-case body (SK). These are the system naming two groups of its own data — §6's Hold item exactly. SK's objection conflates the string with its rendering; `text-transform` changes no string, and everyone caps `SENT · OPENED · CLICKED · REPLIED` on the same page. HC's requirement that both groups carry **equal** typographic weight — so group 2 cannot read as a footnote — is best served by two identical eyebrows. Set the em-dash in `MEASURED — EMAIL` with spaces; at 0.18em tracking it needs them.

**(b) Expanding today: IA.** The four approaches are real configured objects at a measured zero, so opening shows honest inventory rather than nothing, and the row `— | 0` is the clearest single demonstration on the page of deck §9's "'Not reported' is visually distinct from '0'" — here it is *not measurable* versus *measured zero*, in one line. The alternative leaves a disclosure control with nothing behind it, which is a fake affordance by everyone's own standard. The deck's `No sends yet — nothing to compare.` stays as the collapsed content.

---

### 11. C18 — failed-to-load treatment

**IA: 5px `--missing` dot + the deck's sentence in `--ink-2`, no retry.** The dot carries the hue because §6 forbids glow on text and §5.10's status pill works this way. HC's `--alert` pill on the heading can appear five times on one page, which makes a load failure louder than the health strip and inverts the alarm hierarchy. SK's plain sentence makes a failure look like content. No retry is right, unanimously: the page loads fresh and the browser already has reload.

---

### 12–17. The quick rulings

- **C13 — Block E kind-3 amber: IA.** `follow-up due 3 days ago` takes `--stale`; kinds 1 and 2 stay `--ink-4`; no hue on any reason line (all three who address it agree — these gaps are permanent by design, not faults). At 9.5px mono it does not compete with the strip, it makes the one row kind whose deadline has passed scannable, §5.12's `COLD` is the precedent, and it agrees with C2.3.
- **C10 — Block B `Won` green: IA, narrowly.** `--save` is "value recovered", and §5.12's own summary strip hues `9 replied` and `3 booked` green — the closest precedent, from the outreach component itself. (IA should cite that, not §5.8's "only the *problem* counts take a hue", which argues against its own ruling.) Costs nothing today, since `Won` is 0 and therefore absent. `Lost` takes no hue — a correct terminal state is not a conflict. **Cap it: `Won` is the only hued stage, ever.** Tie-breaker if the lead wants zero hue outside the hero row and the strip: drop it and nothing is lost today.
- **C11 — Block C `Replied` green: SK and HC, no hue anywhere.** §5.4's lesson: campaigns are inventory, not insight, and inventory takes a neutral fill. Greening a column invites the ranking Block D exists to forbid, one block earlier — 2 replies from 5 sends sitting green beside 11 from 142. The block is collapsed by default, so the hue buys nothing at the glance. IA's §5.10 tag-punchline analogy is about a tag *set*, not a table column.
- **C19 — A2/A4 statement lines: 13px `--ink-2`** (IA, HC), with IA's refinement — the leading figure in body 600 tabular `--ink`, the `.bar-head b` treatment from §5.5. SK's 11.5px `--ink-4` is §5.6's register for *disclaimers about how a number was made*; `3 approved, not yet sent` is a live finding, and the disclaimer register hides it. A4's `Sending is off` takes IA's 5px `--ink-3` dot — ambient state, §5.9's lowercase grammar, **never a warning hue** (S10).
- **C16 — `pre.body`: body face** (IA, FA). §3 gives mono to labelling and body to "anything read as a sentence"; a draft email is sentences addressed to a person, which is §6's Hold item verbatim. SK's reason — it sits in a `--sunk` well, and wells are machine output — confuses the container with the content. Keep `white-space: pre-wrap`.
- **C20 — tokens: neither position exactly.** Port the six semantic hues of §2's table as **one closed set** (`--spend --save --roi --session --stale --missing`); the set's value is that it is complete and fixed, and splitting it is how a meaning drifts. Do **not** port `--skill` (§2: graph-only, and there is no graph) or `--spend-dim` / `--save-dim`, which are gradient stops rather than tokens with meanings — inline them in the two recipes that use them. `--session` being unused on P8 is fine; an unused member of a fixed set is not an orphan. **Settled four ways and not to be reopened:** ship `--stale`/`--missing`, drop `--alert`/`--amber`, no aliases — because a build writing `var(--missing)` against `components.html`'s `:root` gets *no colour at all*, so the red warning renders as body text and fails toward "everything is fine".

---

### 18. C8 — top bar

**Merge SK and IA, drop both pills.** Breadcrumb `Operator / Freelance` (SK's shape, matching §4's role-then-location) with IA's freshness stamp appended as meta: `· read 14:32`. The stamp is the paper's other best idea — a `force-dynamic` page left open overnight shows yesterday's numbers with full confidence, and an absolute clock time is the only thing that cannot itself go stale.

**No ShikksTracker pill.** HC is right and IA is wrong: RikuOS holds no connection, it makes request-time HTTP calls. A persistent "connected" pill is true only for the instant of the render, restates what the blocks already say, and becomes a lie in exactly the stale tab IA's own stamp is defending against. **No push-registration pill** (SK): it is a client-only fact needing a third client island, it duplicates `PushControls` on `/queue` which decision 4 protects, and a read-only status you cannot act on is a dead end. **Cut FA's pending-approvals pill** this phase: it is a live number and it satisfies D11, but it puts two "waiting on you" counts from two different systems on one screen — D3's failure wearing chrome. If the app later wants a persistent queue count, its home is a count on the rail's `Queue` item, once, as its own decision.

**Log out at the rail foot** (IA): identity is the rail's job, and it keeps the bar to one element.

---

### 19. C9 — rail nav glyphs

**Icons** (SK, FA). IA justifies the 5px dot by saying "the dot is already in the reference's own rail" — but `.rail nav .dot` is the *teardown article's* sidebar, which is document furniture; the **app** specimen (`.navitem`) carries 13px stroke SVGs. On fidelity grounds that settles it. Condition: the reference's idiom exactly — `viewBox="0 0 24 24"`, `fill:none`, `stroke:currentColor`, `stroke-width:1.8`, round caps, 13px, `opacity:.85` — and if any of the three cannot be drawn legibly at 13px, all three drop to dots. Never a mix.

---

### 20. Conflicts the lead missed

- **C21 — Block E's row is not a link.** SK and IA both make the whole four-line row an anchor. Its accessible name then becomes the entire quoted reply, and neither §5.5 nor §5.12 has a whole-row link precedent. **Rule:** the business name is the link with a persistent `↗`; the row is a hover/focus target that raises the name.
- **C22 — the "Nothing waiting on you." fallback is mis-scoped in FA's view model.** `buildStateOfPlay` returns `[] → "Nothing waiting on you."` from the *lines*, which today would print that sentence directly under a 24-draft hero card. IA and SK both scope it correctly. **Rule:** it fires only when drafts, approved and not-started are all zero or absent. Pin it in `freelanceView.test.ts`.
- **C23 — the disclosure mechanism.** IA and FA specify native `<details>`/`<summary>`; SK specifies a `<button>` styled as a row, which needs client state and would turn Blocks C and D into client components. **Rule:** `<details>`, with `list-style:none` *and* the `::-webkit-details-marker` rule, and the chevron transition covered by the reduced-motion block. Verify by hand that `router.refresh()` after `Check now` reconciles rather than remounts, or an open block snaps shut.
- **C24 — `Check now` has no floor in three of four papers.** It re-pings three sites, two of them clients'. **Rule:** adopt FA's server-side 60s floor read from the snapshot's own `checkedAt`, returning 200 with the existing reading rather than a 429 — never an in-memory map, which on Vercel is per-instance and therefore not a limit.
- **C25 — the A1 link target is unspecified everywhere but FA.** `buildStateOfPlay(summary, stBaseUrl)` is the only plumbing for it. The base URL stays server-side; it must not become a `NEXT_PUBLIC_*`. Use `↗`, not the deck ASCII's `→` — the reference reserves `↗` for leaving the app, and this genuinely leaves for another application.

---

## 3. What all four agreed on, and got wrong

**1. The page title is gone.** Deck §4 fixes **`Page title: Freelance`**, the reference's §3 scale has an explicit "Page title · display 600 · 24px" role, and deck §6's whole-page-down render *opens* with the word. SK, HC and FA demote it to an 11.5px breadcrumb; FA's breadcrumb doesn't even contain it (`OPERATOR / {APP_NAME}`); IA replaces it with free text. So the deck's one fixed page-level string appears at 24px on nobody's page, the type scale's page-title role goes unused, and the down-state render cannot be built as specified. **Fix:** `Freelance`, display 600 / 24px / `-0.02em`, no eyebrow above it.

**2. Block D's reply rates are printed bare.** §6's Hold list includes "Estimated numbers say so, right under them", and §5.6 calls the source's own honesty note the thing that "buys the panel credibility instead of undermining it." Every paper carries Block C's pixel-undercount footnote and every paper then prints `11%` and `6%` at full strength with nothing under them — rates over 72 and 54 sends, where the difference is five replies. HC bans a rate column in Block C for precisely this reason and then permits it in D; IA refuses to *rank* the rates and still prints them unqualified. **Fix:** one honesty note under the measured group, in §5.6's register (11.5px `--ink-4`, the ⓘ glyph), saying the rates are computed over small numbers of sends. It costs one line and it is the same move the deck already makes for opens.

**3. The four-card future breaks the three-loud-things budget, and nobody costs it.** All four satisfy decision 2 with `auto-fit / minmax`, which is right. None says what the row looks like *with* the money card: four 34px figures, which is past §1.3's "roughly three per screen" on the page's most-read line. The reference supplies the answer and it should be written down now, while it is free: **at most three of the four cards are ever hued**, using §5.2's ROI exception and §5.8's "only the counts that mean something take a hue". Under my C2 rulings today's row is already violet / white / grey, so the money card arrives into a row with room for it.

*(Lower stakes, same class: deck §9's first checklist item, "Reads well on a phone first", and deck §1's "Mobile-first" paragraph are superseded by decision 1. All four correctly ignore them; none proposes marking the deck. Someone should, or the next reader will think the page failed its own checklist.)*

---

## 4. Per paper — three things a senior designer sends back

### System Keeper

1. **The `button` mapping cannot be built.** Bare `button` is simultaneously Approve, Approve edited, the active status filter and Settings' "Turn on" (`queue/page.tsx` ~128 and ~192; `settings/page.tsx` ~87, ~131). The table gives that one selector three different treatments — neutral outline pill, solid `--ink` pill, green affirmative pill — and decision 4 forbids the `className` edit that would separate them. **Fix:** one treatment for bare `button`, and say out loud which affordance loses.
2. **The hero graphics fail your own §1.5 test.** You reject bars in Block B because "a bar would be a second drawing of the same digits, which is decoration". A field of 24 marks and a scatter of 30 dots are second drawings of the same digits, and the scatter adds an arrangement with no meaning. **Fix:** drop the graphics on cards 1 and 3; keep a ratio track on card 2, which adds the dimension the figure lacks.
3. **`--stale` amber on "25 of 30 never contacted" argues with S10 every morning.** A 34px amber figure is the loudest available way to report a deliberate standing instruction as ageing inventory. **Fix:** no hue; figure in `--ink` on plain `--raised` (§5.2's ROI precedent, §5.8's healthy-strip rule).
   *(Also: `--panel` on the health strip permanently makes a footer read as a panel, against the deck's own sentence; and four `SHIKKSTRACKER ·` eyebrows down one page is a provenance stamp, not a section name.)*

### Information Architect

1. **The four free headings are sentences where the system wants names.** "Where your contacts stand", "How your campaigns did", "Which of your openings gets replies", "What only you can do" restate their eyebrows at greater length, on a page whose deck says density beats impact and whose only reader built the system. §5.1's examples name a thing you own. **Fix:** keep the eyebrow move — it is the paper's best idea — and replace the headings with `Your pipeline`, `Your campaigns`, `Your openings`, `Waiting on you`.
2. **The ShikksTracker top-bar pill claims a liveness nothing measures.** RikuOS makes request-time HTTP calls; the pill can only ever mean "the fetch at render time worked", which the blocks already say, and it becomes a lie in exactly the stale tab your own freshness stamp exists to defend against. **Fix:** drop the pill, keep the stamp.
3. **The 920px column is bought by silently narrowing the reference's card.** You drop `.stats`' `minmax(215px)` to 200px so a fourth card fits; at 920px with 215px it wraps, which is the redesign decision 2 forbids. **Fix:** widen to 980px and take §5.2's component rule verbatim — or write the deviation down, because Personal and Academics inherit it.
   *(Also: `Won` green is right, but cite §5.12's summary strip, not §5.8's "only the *problem* counts take a hue", which argues the other way.)*

### Honesty Critic

1. **`⚠` is not a deck string.** It appears only in the "worst case render" ASCII sketch; the deck's own list of "the exact strings the system produces" has no triangle. Holding it as final imports a colour-emoji rendering risk into the one element that must be unmissable, and the reference has a dot-with-glow for exactly this. **Fix:** 5px hued dot; ask Riku only if he objects.
2. **The paper never covers the old pages, and it should.** Decision 4's re-skin is where "where does this design lie?" bites hardest: a treatment that makes Approve look *selected*, or greys a disabled Reject into invisibility, is a lie about affordance in the one place the system takes an irreversible action. Every other paper has a legacy-CSS section. **Fix:** add one.
3. **`--alert` red on the third hero card spends the page's only red outside the strip**, on rows that are permanently normal by design — an Instagram reply will never have a draft. **Fix:** `--stale` amber, which is token-true (§5.12's `COLD`: still there, no longer fresh) and keeps red rationed to Block F, which is the rationing your own risk 2 argues for.

### Frontend Architect

1. **`OPERATOR / {APP_NAME}` carries no information.** It is identical on every page, and it puts the app name where §4 puts the *identity*. Meanwhile the deck's specified page title `Freelance` appears at 24px nowhere. **Fix:** breadcrumb `Operator / Freelance`; page title `Freelance` at display 600 / 24px.
2. **`--session` blue on "25 of 30 never contacted" inverts the token.** `--session` is *activity*; this counts the absence of activity — and it forces a fourth invented gradient to carry a meaning the token does not have. **Fix:** no hue, no fourth gradient.
3. **`buildStateOfPlay` returning `[] → "Nothing waiting on you."` fires on the wrong condition.** Today the lines are empty and drafts is 24, so the page would print "Nothing waiting on you." under a 24-draft card. **Fix:** scope the fallback to the whole block and pin it in `freelanceView.test.ts`.
   *(Also: a near-white figure on a violet drafts card that has no graphic leaves the card with nothing lit — the §5.2 exception exists only when the hue is spent on a graphic.)*

Everything else in FA's paper — `Promise.allSettled`, the `readCount` carry-through, the 6s page timeout, `classifyAgentRun` extracted rather than `evaluateWatchdog` widened, `fetchLiveAnchorIds` shared with the chaser, `getHealthSnapshot` refusing the upsert-on-read, the manifest and status-bar colours — is the strongest engineering in the four papers and should be adopted as written.

---

## 5. Checklist run

### Reference §6 — Hold

| Item | Held / broken |
|---|---|
| One loud figure per card, one hue per card | Held per card by all four. **Page-level ("roughly three per screen") broken by SK** — three hero figures plus six gradient badges plus a hued Block D rate plus a hued strip. IA names the risk itself; HC holds hardest (one lit thing today). |
| Mono caps for what the system names; sentence case for what addresses the person | **IA holds most completely.** SK breaks it on Block D's group headings. HC holds. FA does not address section rhythm — a gap, not a break. |
| Headings address the operator directly | **Only IA attempts it.** SK and HC keep the deck's bare nouns (legal under §7.3, but the item is unheld); FA silent. Resolved by C7. |
| Hairlines between rows; borders only around real objects | Held by all four. Nearest miss: SK's permanent `--panel` on Block F — a footer that reads as a panel. |
| `tabular-nums` everywhere | Held by all four. |
| Estimated numbers say so, right under them | **Broken by all four** on Block D's reply rates — see §3.2. Held by all four on Block C's opens. |
| Background agents get their own visual class | Held by all four; **HC and FA hold it only partially** — a class that omits a running worker (C4). |

### Reference §6 — Avoid

| Item | Held / broken |
|---|---|
| Boxing every row | Held by all four, explicitly. |
| The same sparkline on every stat card | Held by all four — IA by having none, SK and FA by three different shapes. Nobody breaks it. |
| Solid accent-colored buttons | Held by all four. SK's and FA's solid `--ink` filter pill is §5.3's legal exception, not an accent. |
| A hue used decoratively once it carries a meaning | **IA holds cleanly. SK breaks it twice** (orange on drafts, amber on untouched); **HC once** (orange on drafts); **FA once** (blue on untouched). |
| Left accent bars on cards | Held by all four; all four say so unprompted. |
| Glow on text | Held by all four. SK's card-3 halo and HC's warning dots are on graphics and dots, which is legal. |
| A second sidebar | Held by all four. |

### Deck §9

| Item | Held / broken |
|---|---|
| Reads well on a phone first | **Superseded by decision 1.** All four correctly ignore it; none proposes marking the deck. |
| Looks finished with §7's near-empty content | HC and IA argue it explicitly; SK asserts it and names it as his top risk; **FA does not test it** — it appears only under "verified by looking at it". |
| Does not break with §8's full content | SK checks the seven-row pipeline and the digit column; IA renders §8 in full and names the below-the-fold risk; FA specifies the bounds; **HC does not render §8.** |
| "Not reported" is visually distinct from "0" | Held by all four. **HC strongest** (five kinds of nothing, drain per value not per container); **FA turns it into tests** and, with HC, catches the `?? 0` / `fetchSummary` carry-through hazard that would silently void the whole item. |
| The health strip is quiet when fine and unmissable when not | **IA holds both halves.** SK breaks the quiet half (permanent panel); HC holds quiet, weaker on unmissable (hue only); **FA does not design it.** |
| "Not measurable" reads as a real state, not an error | **IA and HC hold hardest** (equal typographic weight; explanation above the rows; sends stay live while the rate drains). SK holds — his "group 2 stays at full `--ink-2`" is the same catch. FA holds in the view model. |
| Nothing implies the page can act on a lead | Held by all four; all four refuse an empty-state action pill, SK, IA and HC explicitly. |
| The product name is replaceable | **SK strongest** (no letterform tile, no fixed rail width). IA holds. **FA holds the constant but spends it in the breadcrumb**, where the page name belongs. HC silent. |
