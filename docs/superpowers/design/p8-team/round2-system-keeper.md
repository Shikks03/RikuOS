# P8 round 2 — System Keeper rebuttal

Read: `round1-information-architect.md` (IA), `round1-honesty-critic.md` (HC), `round1-frontend-architect.md` (FA).

---

## 1. Where I now agree

**1. The "25 of 30 never contacted" card takes no hue at all.** (IA §4.2, HC §2.3 H2.) I gave it `--stale` amber. S10 says in as many words that an engine sending nothing is correct and that nothing may report it as a stall, a backlog or a gap — and a 34px amber figure is the loudest possible way to report exactly that, every morning, forever. My biggest concession. Consequence: `--tint-stale` is no longer needed, and today's row becomes orange / neutral / violet.

**2. "Off" is a fifth agent state, and the code will paint it green.** (HC §2.2, §4.4.) `morning/route.ts:54` writes `ok: true` placeholder rows for four agents when `monitoringEnabled` is off, and the chaser route does the same — so my four-state mapping would have shown a switched-off worker as "ran fine". Off renders as drained grey with a lowercase `off` caption, read from `OsSettings`, never sniffed from `runJob`'s note string.

**3. The strip drops "all sites ok" past 30h**, the threshold being `site-health`'s own `everyHours + graceHours` (HC §2.9). I kept the stamp and let the assertion stand beside it; a qualifier does not undo an assertion. It also turns a silent `HealthSnapshot` write failure into a visible stale reading, which nothing else catches.

**4. The strip earns its border only when something is wrong.** (IA §3.9.) Healthy is a hairline and one line — I withdraw the `--panel` fill I put on the quiet state. On a warning it gains `--panel`, a `--line` border and a 10px radius: §1.4 ("cards earn their borders") used as a structural alarm, stronger and quieter than a colour one. Best idea in the four papers.

**5. Native `<details>` / `<summary>` for Blocks C and D.** (IA §3.6, FA §2.4.) I proposed a styled `<button>`. `<details>` keeps both blocks server-rendered, gives keyboard and screen-reader behaviour free, and "is this open" is not application state. FA's Safari `::-webkit-details-marker` note is the trap I would have hit.

**6. No status pill in the top bar — mine included.** (HC §2.1.) HC kills IA's `● ShikksTracker connected` outright: RikuOS holds no connection, it makes request-time calls, so the pill claims a liveness nothing measures. That reasoning also weakens my push-registration pill — it is a per-device *setting*, and IA is right that its home is Settings. Cut. I also take IA's `Freelance · read 14:32` wall-clock stamp ("just now" lies the moment a tab sits open), and logout moves to the reference's own `.rail-foot` slot — leaving the bar one line, no controls.

**7. Two smaller ones.** Drop `--skill`, `--spend-dim`, `--save-dim` — FA is right that a defined unused token is an invitation (§2.1). And the empty state must not use `.emptycard`: HC §2.8's tell is exact — centred text in a dashed box is an empty state, left-aligned text where content lives is a finding.

---

## 2. Where I still disagree

**Third hero card — hot leads (me, IA, FA) over HC's gap count.** HC's own reasoning defeats it: since S15 replies are detected only on email, so a "waiting on you" figure is *structurally blind* to Instagram and phone — and HC's §2.7 argues at length that an unmeasurable thing must never be printed as a confident number. A 34px figure cannot carry the "not measurable" line Block D needs a whole heading for. HC's hard condition also puts a total directly above the list it totals, which is a header, not a reading. And HC's objection to hot ("a judgement RikuOS cannot explain") applies equally to `queue.drafts` — every number here comes from ShikksTracker, and the caption naming the source is the page's honesty device. **If the lead rules for HC anyway, HC's condition is non-negotiable: the Block E gap count, never raw `repliedUnanswered`.**

**Hero hues — and the money card, which must be ruled on in the same breath.** IA and FA both say money-in takes `--spend` orange. **That inverts the token.** §2 defines `--spend` as *money out, limits consumed* and `--save` as *value recovered*. Money arriving is not money leaving. If money-in takes orange, orange means both directions and governing idea 1 — the reference's own "single highest-value thing" — dies on the first card of the second phase. **Money-in is green.** That settles the rest by budget: green is then spoken for by money-in and by "the good outcome happened" (reply rate, healthy agent), so hot leads should not be green — which leaves violet for hot. IA's violet-for-drafts ("24 decisions not made") is genuinely good, but §2 defines violet as *ROI, decisions, **insight*** — a score the system produced. `hot` is a computed score; `drafts` is a count of objects in a tray. The stronger claim on violet is the score. Orange survives on drafts through §5.11's own extension — *Freelance is orange because it's money work* — the only place the reference maps orange onto RikuOS at all; HC reached it independently by the same route (§2.3 H1). **Hold: orange / none / violet, money-in green later.** FA's `--session` blue for contacts I reject outright: blue means activity, and this counts its absence.

**Hero graphics — hold, firmly, against IA's "none".** IA conflates *graphic* with *sparkline*. §1.5 requires decoration to be data-shaped; it never requires a time dimension. §5.13's ticks and §5.5's ring are both graphics in the reference with no series behind them. A field of 24 marks **is** the number 24 — it invents nothing. I take IA's real point as a rule: **no curves, no sparklines, anywhere on this page.** But three plain numbers on tinted rectangles is precisely the "dark admin template" outcome, and FA reached the same three shapes independently (`countStack` / `ratioTicks` / `objectNodes`, §2.6) — two papers converging from different directions. On the contacts card, IA's 4px `.track` versus my clipped ring is low-stakes, but a bar reads as *progress toward a goal*, reintroducing the S10 accusation the hueless figure just removed. A ring reads as composition. Keep the ring, now `--ink-4` on `--track`.

**Six agent badges, not HC's five.** HC's principle — "the page must not carry a rule the engine does not have" — is right, but the conclusion is backwards. The watchdog *is* machinery, and it writes a run record every morning (`morning/route.ts:82`). A rail showing five of six workers is a lie of omission on a page whose whole brief is not lying. HC's own remedy (add it to `EXPECTATIONS`) is forbidden: `watchdog.ts`'s header says that table mirrors `vercel.json`, and `watchdog.test.ts:82` asserts the absence — so HC's rule would either hide a live worker or force a change the code refuses. **Middle ground:** the watchdog's freshness comes from a named constant beside `EXPECTATIONS`, consumed by FA's `deriveAgentStatuses`, with a comment pointing at the docstring. The rule then lives in code, visibly, without being smuggled into deploy-mirroring config.

**Badge captions — only on non-green badges.** (HC §2.2.) HC captions all six; that is twelve lines of chrome in a 170px rail, against governing idea 3. HC's essential point survives — colour cannot separate `never run` from `off`, so the word must — but a green badge has nothing to add. FA's `title` attribute is not an answer either: a hover tooltip is invisible on the phone this app is read on.

**The `⚠` marker — hold the hued dot.** IA and I replace it; HC and FA keep the character. The reference has no warning triangle anywhere and exactly one mark for "this thing is in this state": a 5px dot with a matching glow (§5.10, §5.8). `⚠` also renders as a colour emoji on several platforms — the single most template-looking object we could put on the page. Already flagged as Riku's call, since the deck draws it.

**Eyebrows — half concession, half hold.** IA is right that `SHIKKSTRACKER · CONTACTS` says "ShikksTracker" five times down one page, so I take IA's static page-level `SOURCE · SHIKKSTRACKER`, which states it once where it cannot lie. But IA then writes **five new headings** on a page whose deck declares every string final and whose §1 forbids help text; §7.3 settles it — the content spec wins. **Synthesis:** eyebrow = the API's noun for the data shape (`CONTACTS`, `CAMPAIGNS`, `VARIANTS`, `ATTENTION`), heading = the deck's word verbatim. Two voices, no repetition, nothing invented.

---

## 3. What I noticed reading the others

**HC §3.15 is a build-stopper the rest of us under-rated.** A recipe copied out of `components.html` that writes `color: var(--missing)` gets **no colour** — the warning inherits body grey and reads as ordinary text. It fails toward "everything is fine", silently, in the one place that matters. FA's one comment line is not enough: add `git grep -n "var(--alert)\|var(--amber)" src/` returning nothing to the verification list.

**An internal contradiction in IA's hero.** IA gives the drafts card violet and invokes §5.2's ROI exception — "the violet card spends its hue on the graphic and the figure goes near-white" — while §4.3 of the same paper removes the graphic. The hue then has nowhere to go: a near-white figure on a violet tint with no violet object in it. FA's version (violet *plus* a graphic) is consistent; IA's is not. Whichever hue wins, that exception can only be invoked by a card that has a graphic.

**One formatter, three consumers.** FA spotted that `formatAge` already lives in `outreachHealth.ts` and produces Block F's exact `6h` / `36h` / `3d` grammar. The rail now carries ages too (`last ran 41h ago`), so all three consumers must share it — or the strip will say `36h` while a badge says `1d` about the same clock.

**Nobody costed the hue budget on today's real render.** After these concessions: one orange figure, one neutral figure, one violet figure, six quiet green words in the rail, a grey footer. That is exactly §1.3's "roughly three loud things per screen" — and it only lands there *because* the contacts card went hueless. The concession is not merely principled; it is what makes the arithmetic work.
