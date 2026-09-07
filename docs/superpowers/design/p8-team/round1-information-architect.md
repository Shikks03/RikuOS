# P8 round 1 — Information Architect

**Date:** 2026-09-06 · **Role:** information architecture — reading order, grouping, hue-by-meaning, states, strings.
**Sources:** content deck `2026-09-05-p8-freelance-page-content.md` (blocks A–F), design doc `2026-09-05-p8-freelance-page-design.md` (D1–D8), `docs/design/DESIGN-INSPO.md` (§ refs), `docs/design/components.html`, `ARCHITECTURE.md` §7 S10–S17, current code.
**Standing question:** *does Riku know what is true in three seconds?*

---

## 1. Position

This page is a **status line with an appendix**, not a dashboard. Riku's dominant journey is a push notification followed by a three-second glance, and in a dark UI with silent chrome the eye goes to the loudest saturated thing on screen, not to the top-left corner. So the design problem is not "what order do the blocks go in" — the deck already fixed that — it is **"which three figures earn saturation, and what stays deliberately grey."** My whole paper turns on one rule borrowed from the reference's stat strip (§5.8): *only the counts that mean something take a hue; a healthy strip is entirely white on black.* Applied to this page that rule does an enormous amount of work, because most of what is on this page today is **correct and uninteresting** — sending is off by Riku's standing instruction (S10), so 25 untouched contacts, 0 replies waiting and 0 stranded messages are all the *right* answers, and a design that colours them is a design that lies every morning. The page should therefore look mostly monochrome, carry exactly three loud figures, and reserve every hue for something that is genuinely a signal. Today that means one violet figure (24 decisions pending), one green figure (2 hot leads), one uncoloured figure (25 of 30 untouched), and a grey footer. That page reads in three seconds and it is honest, which on this page are the same requirement.

---

## 2. The whole page at desktop width — both states

Rail 170px + content column 920px. ASCII is compressed horizontally; real proportions are in §3. Hue annotations are in the right margin and are not on screen.

### 2.1 Today — deck §7's real data, 2026-09-05

```
┌──────────────────┬─────────────────────────────────────────────────────────────────────┐
│ ◆ RikuOS         │ Freelance · read 14:32              ● ShikksTracker connected       │  44px
│   PERSONAL OS    ├─────────────────────────────────────────────────────────────────────┤  hairline
│                  │                                                                     │
│ · Queue          │ SOURCE · SHIKKSTRACKER                                              │  mono eyebrow
│ ▣ Freelance      │ Where your outreach stands                                          │  display 24px
│ · Settings       │                                                                     │
│                  │ ┌───────────────────┐┌───────────────────┐┌───────────────────┐     │
│ AGENTS           │ │ DRAFTS    OPEN ↗  ││ CONTACTS          ││ HOT LEADS         │     │
│ ┌──────────────┐ │ │                   ││                   ││                   │     │
│ │ CHASER       │ │ │ 24                ││ 25                ││ 2                 │     │  34px figures
│ └──────────────┘ │ │                   ││ ▄▄▄▄▄▄▄▄▄▄▄▄▄░░   ││                   │     │
│ ┌──────────────┐ │ │ drafts waiting on ││ of 30 contacts    ││ contacts flagged  │     │
│ │ EXPIRY-SWEEP │ │ │ you in            ││ never contacted   ││ hot in            │     │
│ └──────────────┘ │ │ ShikksTracker     ││                   ││ ShikksTracker     │     │
│ ┌──────────────┐ │ └───────────────────┘└───────────────────┘└───────────────────┘     │
│ │ WATCHDOG     │ │      violet               neutral                green              │
│ └──────────────┘ │                                                                     │
│ ┌──────────────┐ │ PIPELINE                                                            │
│ │ SITE-HEALTH  │ │ Where your contacts stand                                           │
│ └──────────────┘ │ 30 contacts · 2 hot                                                 │
│ ┌──────────────┐ │ ─────────────────────────────────────────────────────────────────── │
│ │ OUTREACH-    │ │ Not started                                                     25  │  no hue
│ │ HEALTH       │ │ ─────────────────────────────────────────────────────────────────── │
│ └──────────────┘ │ Contacted                                                        3  │
│ ┌──────────────┐ │ ─────────────────────────────────────────────────────────────────── │
│ │ DISPATCHER   │ │ Replied                                                          2  │
│ └──────────────┘ │ ─────────────────────────────────────────────────────────────────── │
│                  │ Nothing yet at call booked, proposal sent, won or lost              │  --ink-4
│  all six green   │                                                                     │
│                  │ CAMPAIGNS                                                           │
│                  │ How your campaigns did                                       2  ›   │  <summary>
│                  │                                                                     │
│                  │ APPROACH PERFORMANCE                                                │
│                  │ Which of your openings gets replies                             ›   │  <summary>
│                  │ No sends yet — nothing to compare.                                  │
│                  │                                                                     │
│                  │ NEEDS YOU                                                           │
│                  │ What only you can do                                                │  no count
│                  │ Nothing waiting.                                                    │  --ink-3
│                  │                                                                     │
│                  │ ─────────────────────────────────────────────────────────────────── │
│ Log out          │ Engine ran 2h ago · all sites ok · checked 6h ago    [ CHECK NOW ]  │  footer
└──────────────────┴─────────────────────────────────────────────────────────────────────┘
```

Everything on this page fits one screen at 900px viewport height, which is why the deck's near-empty state passes the three-second test without help. Note what is *not* here: no `0 approved, not yet sent` line (hidden at zero), no `Sending is off` line (unshipped, and its slot renders nothing), no `Nothing waiting on you.` (it fires only when drafts, approved and not-started are all zero — today drafts is 24, so it would contradict the hero card).

### 2.2 Full — deck §8, with C and D opened

```
┌──────────────────┬─────────────────────────────────────────────────────────────────────┐
│ ◆ RikuOS         │ Freelance · read 08:14              ● ShikksTracker connected       │
│   PERSONAL OS    ├─────────────────────────────────────────────────────────────────────┤
│ · Queue          │ SOURCE · SHIKKSTRACKER                                              │
│ ▣ Freelance      │ Where your outreach stands                                          │
│ · Settings       │                                                                     │
│                  │ ┌───────────────────┐┌───────────────────┐┌───────────────────┐     │
│ AGENTS           │ │ DRAFTS    OPEN ↗  ││ CONTACTS          ││ HOT LEADS         │     │
│ ┌──────────────┐ │ │ 6                 ││ 201               ││ 19                │     │
│ │ CHASER       │ │ │                   ││ ▄▄▄▄▄▄▄░░░░░░░░   ││                   │     │
│ └──────────────┘ │ │ drafts waiting on ││ of 486 contacts   ││ contacts flagged  │     │
│ ┌──────────────┐ │ │ you in            ││ never contacted   ││ hot in            │     │
│ │ EXPIRY-SWEEP │ │ │ ShikksTracker     ││                   ││ ShikksTracker     │     │
│ └──────────────┘ │ └───────────────────┘└───────────────────┘└───────────────────┘     │
│ ┌──────────────┐ │ 2 approved, not yet sent                                            │  line, not card
│ │ WATCHDOG     │ │                                                                     │
│ └──────────────┘ │ PIPELINE                                                            │
│ ┌──────────────┐ │ Where your contacts stand                                           │
│ │ SITE-HEALTH  │ │ 486 contacts · 19 hot                                               │
│ └──────────────┘ │ ─────────────────────────────────────────────────────────────────── │
│ ┌──────────────┐ │ Not started                                                    201  │
│ │ OUTREACH-    │ │ Contacted                                                      178  │
│ │ HEALTH       │ │ Replied                                                         54  │
│ └──────────────┘ │ Call booked                                                     23  │
│ ┌──────────────┐ │ Proposal sent                                                   16  │
│ │ DISPATCHER   │ │ Won                                                              9  │  green
│ └──────────────┘ │ Lost                                                             5  │  no hue
│   ▲ amber        │ ─────────────────────────────────────────────────────────────────── │
│                  │                                                                     │
│                  │ CAMPAIGNS                                                           │
│                  │ How your campaigns did                                       3  ⌄   │
│                  │                              SENT  OPENED  CLICKED  REPLIED         │
│                  │ September cold — Cebu cafés   142      61       14       11         │  replied: green
│                  │ August revival — old enq.      68      40        9        7         │
│                  │ Dental clinics, Metro Manila   55      21        3        2         │
│                  │ ⓘ Open counts come from tracking pixels and undercount anyone       │
│                  │   whose mail client blocks images.                                  │
│                  │                                                                     │
│                  │ APPROACH PERFORMANCE                                                │
│                  │ Which of your openings gets replies                             ⌄   │
│                  │ MEASURED — EMAIL                                                    │
│                  │                            REPLY RATE   SENDS   REPLIES             │
│                  │ Email S1 — specific compliment    11%      72         8             │  no hue
│                  │ Email S1 — pain point first        6%      54         3             │
│                  │ NOT MEASURABLE                                                      │
│                  │ Replies are only detected on email, so these can't be scored.       │  above the rows
│                  │                            REPLY RATE   SENDS                       │
│                  │ Facebook DM S1 — specific compl.    —      31                       │  em-dash
│                  │ Facebook DM S1 — pain point         —      27                       │
│                  │                                                                     │
│                  │ NEEDS YOU                                                           │
│                  │ What only you can do                                            3   │
│                  │ ─────────────────────────────────────────────────────────────────── │
│                  │ Bella's Cafe ↗                                          INSTAGRAM   │
│                  │ replied 2 days ago                                                  │
│                  │ "Sounds good, what would the timeline look like?"                   │
│                  │ Nothing drafts replies for Instagram.                               │
│                  │ ─────────────────────────────────────────────────────────────────── │
│                  │ Nova Dental ↗                                               EMAIL   │
│                  │ replied 4 hours ago                                                 │
│                  │ "Do you do logos as well, or just the site?"                        │
│                  │ No draft in the queue.                                              │
│                  │ ─────────────────────────────────────────────────────────────────── │
│                  │ Kiddo Co ↗                                                          │  no channel
│                  │ follow-up due 3 days ago                                            │  amber
│                  │ Send the revised proposal                                           │
│                  │ ─────────────────────────────────────────────────────────────────── │
│                  │ ┌─────────────────────────────────────────────────────────────────┐ │
│                  │ │ ● ShikksTracker send engine last ran 3d ago            amber    │ │  becomes a
│ Log out          │ │ ● Meowchi unreachable                                  red      │ │  card only
│                  │ │   AzeroTech ok · ShikksTracker ok                               │ │  when wrong
│                  │ │   checked 6h ago                             [ CHECK NOW ]      │ │
│                  │ └─────────────────────────────────────────────────────────────────┘ │
└──────────────────┴─────────────────────────────────────────────────────────────────────┘
```

The full page scrolls, and §6 risk 1 names the cost: `Needs you` sits below seven pipeline rows and two opened tables. Collapsed by default, C and D cost two rows each, which is what keeps the ordinary full page short.

---

## 3. Block by block

Throughout: content column `--maxw: 920px`, rail 170px, top bar 44px. Dark only. Tabular numerals on every digit. Deck strings are quoted `like this` and are verbatim; strings I wrote are marked **(free)**.

### 3.0 Section rhythm — the eyebrow/heading reconciliation

The reference (§5.1, §6) requires a mono eyebrow above a sentence-case heading *addressed to the operator* — "Your skills", never "Skill management". The deck fixes four block headings that are all bare nouns: `Pipeline`, `Campaigns`, `Approach performance`, `Needs you`.

**These do not collide, because they belong in different slots.** §5.1 defines the eyebrow as *"the machine's name for the section"* and the heading as *"the human one"*. `Pipeline` and `Approach performance` **are** machine names — they are the nouns the system uses for those data shapes. Putting them in the eyebrow slot is not a workaround, it is the correct reading of the reference.

So: **the deck's word becomes the mono eyebrow, verbatim. The heading is free text I write, in sentence case, addressed to Riku.** The deck loses nothing — every fixed string is still on screen, rendered in the type role that matches what it is. `text-transform: uppercase` is presentation, not a string change; the source text stays as the deck wrote it.

| Block | Eyebrow — mono 9.5px/0.18em/`--ink-3` | Heading — display 600/19px, sentence case |
|---|---|---|
| Page | `SOURCE · SHIKKSTRACKER` **(free)** | `Where your outreach stands` **(free)**, display 600 24px |
| A | *none — the page heading serves it* | *none* |
| B | `PIPELINE` (deck) | `Where your contacts stand` **(free)** |
| C | `CAMPAIGNS` (deck) | `How your campaigns did` **(free)** |
| D | `APPROACH PERFORMANCE` (deck) | `Which of your openings gets replies` **(free)** |
| E | `NEEDS YOU` (deck) | `What only you can do` **(free)** |
| F | *none — it is a footer, not a section* | *none* |

The page-level eyebrow does real work: §1 of the deck says the page's honesty about *which system holds the truth* is load-bearing. `SOURCE · SHIKKSTRACKER` states it once, at the top, in the machine's voice, which lets individual blocks say it less. It is static, so it can never lie — I deliberately rejected `SHIKKSTRACKER · LIVE`, which becomes false the moment the API is down.

Block A gets no section header of its own. Three text layers before the first number would cost exactly the glance the page exists for; the reference's own shell specimen puts the stat row directly under the page-title pair.

### 3.1 Shell — rail

Fixed ~170px, `border-right: 1px solid var(--line-soft)`, contents top to bottom:

1. **Identity tile.** 30px, 9px radius, orange gradient, sunburst glyph (§4). Beside it `APP_NAME` in display 600 14px, and a mono 9.5px sub-label `PERSONAL OS` **(free)** — a description, not the name, so it is safe under the rename constraint. Optional; the tile works without it.
2. **Nav** — three items in the deck's §4 order: `Queue` · `Freelance` · `Settings`. `6px 9px` padding, 7px radius, 13px, `--ink-3`. Active (`Freelance`) gets raised fill `#171B21` **plus inset hairline** — never a left accent bar (§4, §6). Each item carries the reference's 5px `.dot` glyph, `--ink-4` inactive / `--ink-2` active. **No icons**: there is no icon library and none may be added, and hand-cutting three SVGs to save nothing is not worth it. The dot is already in the reference's own rail.
3. **`AGENTS` group label** — mono 8.5px/0.16em/`--ink-4`, `padding: 0 9px`, `margin-top: 6px` (§4).
4. **Six agent badges** — see 3.2.
5. **`Log out`** in the `.rail-foot` slot (`margin-top: auto`), 11.5px `--ink-4`, sentence case. See 3.3 for why it lands here and not in the top bar.

### 3.2 Agents block — six live badges

**These are the six workers that actually write an `AgentRun` row today** (verified in `src/app/api/cron/morning/route.ts` and `src/app/api/cron/chaser/route.ts`): `chaser`, `expiry-sweep`, `watchdog`, `site-health`, `outreach-health`, `dispatcher`. The `AGENTS` enum in `src/models/AgentRun.ts` lists nine, but `lead-sweep` was cancelled (S8), `triage` was deleted (S15), and `retro` is unbuilt. Badging those three would be badging ghosts.

**Display names: the code's own kebab-case names, verbatim and uppercased** — `CHASER`, `EXPIRY-SWEEP`, `WATCHDOG`, `SITE-HEALTH`, `OUTREACH-HEALTH`, `DISPATCHER`. Not prettified. These are the strings that appear in `AgentRun.agent`, in the watchdog's anomaly text (`chaser last ran 31h ago`), and therefore in the push notification Riku reads on his lock screen. If the rail invented friendlier names, a push saying "outreach-health failed" would match nothing on screen. Matching the log beats looking nice. §6 backs this: *mono caps for anything the system names*. Width check: `OUTREACH-HEALTH` at mono 10px/0.08em ≈ 99px inside a ~128px badge. Fits.

**Order: execution order through the day**, not importance and not health.

```
CHASER            22:00, its own cron
EXPIRY-SWEEP      23:00, first job in the morning route
WATCHDOG
SITE-HEALTH
OUTREACH-HEALTH
DISPATCHER        last — it is what sends the push
```

Execution order is *data-shaped* (§1.5): it is a real property of the system, so a cascade of failures reads top to bottom. Health-sorting was rejected outright — badges that move destroy the positional memory that makes a six-item list glanceable.

**Colour from the last run record**, per Riku's decision 3, mapped onto `evaluateWatchdog`'s four anomaly kinds:

| State | Source | Hue | Treatment |
|---|---|---|---|
| ran fine | no anomaly | `--save` green | `.agent` tinted gradient + 22% border |
| overdue | `stale` | `--stale` amber | same, amber |
| failed | `failed` **or** `degraded` | `--missing` red | same, red |
| never run | `never-ran` | — | plain `#12151A`, `--line` border, `--ink-4` label |

`degraded` (`counts.itemsFailed > 0`) is folded into **red**, not amber. Amber means *ageing*; a degraded run means real work items failed, which CLAUDE.md's no-silent-failure rule says the human must see. Better to over-report a genuine failure than to let it hide beside a merely-late worker. This keeps Riku's four states exactly as specified.

**Two implementation gotchas the badge builder must not trip on:**

- **`watchdog` is deliberately absent from `EXPECTATIONS`** (`src/lib/watchdog.ts` says so in its header — it is running, which is the proof). So `evaluateWatchdog` never judges it. The rail needs its own display-only staleness rule for that one badge. **Do not add `watchdog` to `EXPECTATIONS`** — that table mirrors `vercel.json` by design.
- **A green badge can currently lie.** When `monitoringEnabled` is off, the morning route writes `ok: true` placeholder rows for `watchdog`, `site-health`, `outreach-health` and `dispatcher` with the note *"monitoring is disabled in OsSettings"* stashed in `error` (`runJob.ts`: *"Nothing reads it back programmatically"*). Under a naive mapping all four go green while doing nothing. See §5 open question 2.

No click behaviour this phase, per decision 3. The badges are not links and must not carry hover states that imply they are.

### 3.3 Top bar — truthful, two elements

The reference's top bar (§4) is breadcrumb → daemon status pill → ⌘K search → notification and theme icon buttons. RikuOS has **no search, no daemon, no notification centre, and one theme by decision 5.** Four of those five are fake affordances here. What is left is real:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Freelance · read 14:32                    ● ShikksTracker connected         │
└──────────────────────────────────────────────────────────────────────────────┘
   44px, hairline bottom (--line-soft), no shadow
```

- **Breadcrumb, left.** `Freelance` in body 11.5px `--ink`, then `·` and `read 14:32` in `--ink-4`. The freshness stamp is a **wall-clock time, not "just now"** — the page is `force-dynamic`, so "just now" is true at render and lies the moment the tab sits open. A clock time never lies and Riku can compare it to his watch. On a page whose entire premise is *what is true right now*, this is the only defence against a stale tab, and it costs one span.
- **Status pill, right** (`margin-left: auto`). §5.10 status pill: hue at 8% fill, 20% border, 5px dot with a matching glow, sentence-case label. Fed by the one fact that determines whether the page has data at all: `● ShikksTracker connected` **(free)** in green, `● ShikksTracker unreachable` **(free)** in red. This is the honest RikuOS equivalent of "local daemon connected" — an external dependency's liveness — and it makes the deck §6 whole-page-down state legible from the chrome before Riku reads a word of the body. It does not duplicate Block F: F reports ShikksTracker's *send engine*, the pill reports the *API*.
- **Nothing else.** No search field. No bell. No theme toggle.

**Does the push control move? No.** Riku's decision 4 puts `/queue` under a no-behaviour-change order, and `PushControls` is a client component that reads `navigator.serviceWorker` — a server-rendered top bar cannot know its state, and a bell icon that shows nothing is exactly the fake affordance the brief forbids. It stays where it is. When it does move, its home is **Settings**, not the top bar: it is a per-device setting and Settings is where settings live.

**Logout goes to the rail foot, not the top bar.** It is an identity action and identity is the rail's job; putting the exit at the rail's bottom is a strong convention; and it keeps the top bar to two elements. `/queue`'s own Log out button stays untouched this phase (decision 4). One turn of duplication, gone when `/queue` gets its own content discussion.

### 3.4 Block A — the hero row

**Structure: three stat hero cards (§5.2) + a line list beneath.** The deck's A1 and A3 become cards; A2 and A4 stay lines.

```
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│ DRAFTS        OPEN ↗  │ │ CONTACTS              │ │ HOT LEADS             │
│                       │ │                       │ │                       │
│ 24                    │ │ 25                    │ │ 2                     │
│ drafts waiting on you │ │ ▄▄▄▄▄▄▄▄▄▄▄▄▄▄░░░     │ │ contacts flagged hot  │
│ in ShikksTracker      │ │ of 30 contacts never  │ │ in ShikksTracker      │
│                       │ │ contacted             │ │                       │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
    violet, links out          neutral, 4px track          green
```

Grid `repeat(auto-fit, minmax(200px, 1fr))`, gap 14px, fixed `min-height: 132px` (§5.2 — they read as a set). At 920px three cards sit comfortably and **a fourth wraps into the row without a redesign**, which is decision 2's requirement for the money card. When money-in arrives it takes `--spend` orange — that is the token's literal definition — and slots **first**, pushing drafts to second. Nothing else changes.

**Card anatomy** (§5.2): mono label + optional link on one line → figure at 34px display 700 `-0.03em` tabular pushed down with `margin-top:auto` → caption in body 10.5px `--ink-3`. The mono label is **the machine's name for the slot and is therefore free** — it is not a deck string. The deck's sentence survives verbatim in the caption, minus only the leading numeral the figure already shows.

| | Label (free) | Figure | Caption | Hue and why |
|---|---|---|---|---|
| A1 | `DRAFTS` + `OPEN ↗` | `24` | `drafts waiting on you in ShikksTracker` | **`--roi` violet.** Judgement / decisions. 24 drafts is 24 decisions Riku has not made — literally the token's meaning. Violet also makes this page and the Approval Queue speak the same colour for the same fact, which is what §7.2's one-palette rule is for. And it leaves orange free for the money card. |
| A2 | `CONTACTS` | `25` | `of 30 contacts never contacted` | **No hue.** Figure in `--ink` at full 34px. See §4.2 — this is my most important call. |
| A3 | `HOT LEADS` | `2` | `contacts flagged hot in ShikksTracker` **(free)** | **`--save` green.** Value in the pipeline, healthy. |

**Graphics: none, except one.** §5.2 wants three *different* graphic treatments and §1.5 requires decoration to be data-shaped. **RikuOS has no time series for any of these numbers** — `queue.drafts` and `contacts.hot` are point-in-time counts and there is no history endpoint. A sparkline would be inventing data, which is the exact failure §1.5 and deck constraint 2 forbid. So A1 and A3 carry no graphic layer at all. **A2 does have an honest shape** — a proportion, 25 of 30 — so it gets one 4px `.track` (§5.5) filled to 83% in `--ink-4` on the `#1A1E25` track. No hue, matching its card. The three cards then differ by *content*, which is what §5.2 actually asks for.

**Zero vs missing — the deck/reference conflict, resolved by splitting it.**

The deck says A-lines disappear at zero (§5 Block A). §5.14 rule 1 says containers never disappear, hue drains. Both are right about different objects:

- **For the three hero cards, the reference wins: the card never disappears.** A hero row that shrinks from three cards to two makes the layout jump and destroys the learned positions, which is the entire value of a fixed row. At a **true zero**: figure prints `0` in `--ink-4`, the hued gradient reverts to plain `--raised`, border back to `--line`. At **not reported**: figure prints `—` in `--ink-4`, same drain, and the caption is replaced by the deck's exact missing-data sentence — `ShikksTracker didn't report how many drafts are waiting` / `ShikksTracker didn't report how many contacts there are`. `0` and `—` are the visually distinct treatments deck constraint 2 demands, and both keep their card. *(A3 has no deck string for the missing case; I wrote `ShikksTracker didn't report how many are hot` to the same pattern — flagged for the lead.)*
- **For the two lines below, the deck wins: the line disappears at zero.** A line is a sentence, not a container. There is no grid to jump and nothing is taught by printing "0 approved, not yet sent". §5.14's rule is written about cards in a grid.

**The line list (A2, A4).** Body 13px `--ink-2`, stacked with 6px gaps, no bullets, no hairlines. Each count-bearing line opens with its figure in body 600 tabular `--ink` — the `.bar-head b` treatment from §5.5 — so the number is scannable without a card:

- `3 approved, not yet sent` · singular `1 approved, not yet sent`
- `Sending is off` — **A4's slot.** It is a state, not a count, so it takes a 5px `--ink-3` dot instead of a figure. Ambient, not alarming: per S10, sending being off is **correct**, so it takes no warning hue, ever.

**What renders in A4's slot today: nothing.** Not a dashed placeholder, not "sending state unknown". §5.14's container rule does not apply to a line that has never existed, and rendering a permanent grey notice about a known contract gap (D7) would be daily noise in the one place that must stay quiet.

**Today's Block A** is therefore three cards and nothing beneath them. A2 is 0 so it is absent; A4 is unshipped.

**The all-hidden line, and a bug it would otherwise cause.** The deck's `Nothing waiting on you.` fires when every A-statement is silent. If that were scoped only to the *line list*, today's page would render `Nothing waiting on you.` directly under a violet **24** — a flat contradiction on screen. **Scope it to the whole block**: it renders only when drafts = 0 **and** approved = 0 **and** not-started = 0. Today it does not fire, and the line list simply renders nothing.

### 3.5 Block B — Pipeline

**Rows, not cards** — hairline-separated, no boxes (§4, §5.12's "why not cards").

```
PIPELINE
Where your contacts stand
30 contacts · 2 hot                                    ← meta, body 11px --ink-3
───────────────────────────────────────────────────────
Not started                                        25
Contacted                                           3
Replied                                             2
───────────────────────────────────────────────────────
Nothing yet at call booked, proposal sent, won or lost  ← --ink-4, not a row
```

Grid `minmax(0,1fr) | 64px`. Label body 13px `--ink`; count display 600 15px tabular, right-aligned. `--line-soft` between rows, none above the first. Rhythm: eyebrow → 5px → heading → 6px → summary meta → 14px → rows.

**Not §5.8's horizontal stat strip**, which was the tempting fit. Three reasons: a column of digits is the only place `tabular-nums` (§3, "non-negotiable") does any work, and a horizontal strip has no column; pipeline order is *meaningful* (`not_started` → `lost`) and a wrapping strip breaks that progression at the wrap; and §8's full render has seven stages, which wraps badly at 920px. The deck's §7/§8 ASCII shows vertical, and where the deck is explicit I follow it.

**Hue: almost none.** No stage is a problem, so §5.8's rule applies — a healthy list is white on black. Two exceptions considered:
- **`Won` takes `--save` green.** It is literally value recovered.
- **`Lost` takes no hue.** Red means *conflicts, gaps, over-limit*. A lost contact is a normal, correct terminal state. Colouring it red would make a healthy funnel look alarming and would break the token's fixed meaning.

Today neither stage exists, so today's Block B is entirely neutral — correct.

**The collapse line** (`Nothing yet at call booked, proposal sent, won or lost`, and its 2/1/0-remaining variants) is body 11px `--ink-4`, sitting below the last row **with no hairline above it**. It is a note, not a row; a hairline would make it read as a row with a missing number.

**States.** No contacts: `No contacts yet.` in the content area, `--ink-3`. Failed: `Couldn't load the pipeline.` in the failed-block treatment (3.10).

### 3.6 Block C — Campaigns

**The heading line *is* the toggle.** `<details>` / `<summary>` — native, no JavaScript, keyboard and screen-reader behaviour free, works with JS off, and it is the only thing on the page that needs to open at all. Default marker removed (`list-style: none` + `::-webkit-details-marker { display: none }`), replaced by the deck's `›` rotating to `⌄`.

```
CAMPAIGNS
How your campaigns did                                    2  ›     ← the <summary>
```

Grid `1fr | auto | 16px`; eyebrow and heading stacked in column 1, the deck's count in mono 10px `--ink-3` tabular and the chevron `align-self: end` so they sit on the heading's baseline, not the eyebrow's. **This is what "opens in place" looks like in this system** — nothing moves, because the table appears below the heading where content would have been anyway.

It also disposes of a duplication problem: the deck's collapsed-row string `Campaigns` is now the eyebrow, so the word appears once, not twice.

**Expanded** — a hairline row grid, `minmax(0,1fr) | 64px | 64px | 64px | 64px`:

```
                                    SENT   OPENED  CLICKED  REPLIED   ← mono 9px --ink-4
Test One                               5        2        0        2
Test number 2                          0        0        0        0
                                              Showing 20 of 34 campaigns.
ⓘ Open counts come from tracking pixels and undercount anyone whose
  mail client blocks images.
```

Names body 13px `--ink`; numbers body 12px tabular right-aligned. Header row mono 9px/0.14em `--ink-4`, no hairline above it. No borders anywhere — these are rows in a section, not objects.

**One hue: `Replied`.** Green `--save` when > 0, `--ink-4` when 0. It is the punchline column, and §5.10's tag rule — *the last tag in a set fills solid in the group's hue; that's how the eye finds the punchline of the row* — is the same idea in a different component. A `0` in `--ink-4` is a measured zero and stays visually distinct from a `—`.

**The footnote** is §5.6's honesty note, reused exactly: 11.5px `--ink-4` with the small ⓘ circle, directly under the table. §5.6 says of the source's version *"worth copying: it buys the panel credibility instead of undermining it"* — this is that, verbatim.

**States.** No campaigns: `No campaigns yet.` Bounded: `Showing 20 of 34 campaigns.` mono 9px `--ink-4`, right-aligned above the footnote. Failed: `Couldn't load campaigns.`

### 3.7 Block D — Approach performance

Same `<details>` grammar as C.

```
APPROACH PERFORMANCE
Which of your openings gets replies                          ›
No sends yet — nothing to compare.                                ← today, always visible
```

**Today the chevron stays and expanding is not a dead end.** Deck §3 records four real approaches configured at 0 sends, so opening it shows the honest inventory — which is *better* than hiding it, because Riku learns the two-group shape before it starts mattering:

```
MEASURED — EMAIL
Email S1 — specific compliment first          —      0
Email S1 — pain point first                   —      0

NOT MEASURABLE
Replies are only detected on email, so these can't be scored.
Facebook DM S1 — specific compliment first    —      0
Facebook DM S1 — pain point first             —      0
                                        REPLY RATE  SENDS
```

**`—` for reply rate, `0` for sends, in the same row.** A rate over a zero denominator is not measurable; a send count of zero is a measurement. This is deck constraint 2 doing real work inside a single line, and it is the clearest demonstration of the rule anywhere on the page.

**Making "Not measurable" read as a real state, not an error — four moves:**

1. **Equal typographic weight.** Both group headings are the same mono 9.5px/0.18em `--ink-3` eyebrow, at the same left edge, with identical row grammar. If group 2 were dimmer, smaller or indented it would read as a footnote — and the deck says outright: *"the 'not measurable' group is not a footnote, it is half the table."*
2. **The explanatory line goes ABOVE the rows, not below.** `Replies are only detected on email, so these can't be scored.` sits immediately under the group heading, in §5.6's honesty register (11.5px `--ink-4`). Below the table it would *be* a footnote, which is the exact failure.
3. **The `Reply rate` column is kept, full of em-dashes.** Deck-specified, and correct: the column of dashes *is* the statement. It does not read as broken data because the explanation is already sitting above it.
4. **The `Replies` column is dropped in group 2** — deck-specified. An absent column says "this measurement does not exist here"; a fourth column of dashes would say "this data failed to load".

**No hue in this block at all.** Every figure `--ink`, every dash `--ink-4`. I considered greening the winning reply rate (§5.10's punchline logic) and rejected it: ranking 11% over 6% at 72 vs 54 sends is a judgement call with a hidden significance threshold Riku has not set, and the design doc says explicitly that **P7's retro agent adds judgment over this same data**. Ranking is that feature's job. This block's job is honesty about measurability.

**States.** No approaches: `No approaches set up.` Failed: `Couldn't load approach performance.`

### 3.8 Block E — Needs you

Not collapsible. Eyebrow `NEEDS YOU`, heading `What only you can do`, count right-aligned on the heading line in mono 10px `--ink-3` — same placement as C and D's count, no chevron.

**Row anatomy, built only from fields that exist.** `AttentionItem` gives businessName, channel, repliedAt, replySnippet, contactId. `OverdueActionItem` gives businessName, nextActionAt, nextActionNote, contactId. **There is no cadence and no state**, so §5.12's specimen — a four-column grid with a Mon/Wed/Fri cadence strip and a state tag — does not apply and must not be forced. What survives from §5.12 is its *principle* (rows down a column, hairlines, no boxes) and one component, `.pwhen`.

Grid `minmax(0,1fr) | auto`, hairline between rows, whole row is the link out:

```
Bella's Cafe ↗                                             INSTAGRAM
replied 2 days ago
"Sounds good, what would the timeline look like?"
Nothing drafts replies for Instagram.
───────────────────────────────────────────────────────────────────
Nova Dental ↗                                                  EMAIL
replied 4 hours ago
"Do you do logos as well, or just the site?"
No draft in the queue.
───────────────────────────────────────────────────────────────────
Kiddo Co ↗
follow-up due 3 days ago
Send the revised proposal
```

| Line | Register | Notes |
|---|---|---|
| business name | body 600 13px `--ink` + persistent `↗` in `--ink-4` | Whole row is the link; the arrow is always visible, never hover-only. |
| channel tag | §5.10 tag — 6px radius, mono 9px/0.13em uppercase, `--line` border, `--ink-3` | Deck labels `Email` `Facebook` `Instagram` `Phone`, uppercased by CSS. Neutral for all four — colouring Instagram to hint at Block D's blind spot would be a hue used decoratively. |
| waiting line | `.pwhen` from §5.12 — mono 9.5px `--ink-4` tabular, **not uppercase** | `replied 2 days ago` · `follow-up due 3 days ago` · `just now` under an hour. Lowercase because the deck fixes it lowercase. |
| reply snippet | body 12.5px `--ink-2`, in quotes as the deck writes them | Wraps freely; ShikksTracker already truncates it. Never ellipsised — a cut-off quote is worse than a wrapped one. |
| reason line | body 11.5px `--ink-3` | `Nothing drafts replies for Instagram.` · `No draft in the queue.` |

**Kind 3 has no channel column content — empty, not `—`.** `OverdueActionItem` has no channel field, and channel is not *unmeasured* for an overdue action, it is *inapplicable*. §5.14's em-dash rule covers unmeasured; conflating the two would be the same category error the whole page is built to avoid.

**One hue, on kind 3 only:** the waiting line `follow-up due 3 days ago` takes `--stale` amber. It is literally ageing, and §5.12 gives `COLD` amber for the identical reason — *still there, no longer fresh*. It also makes overdue rows scannable in a mixed list, which matters because an overdue action is the only kind whose deadline has already passed. Kinds 1 and 2 stay `--ink-4`.

**The reason line takes no hue**, and I want this on record. `--missing` red is defined as *"conflicts, **gaps**, over-limit"* and D3 calls this block "the gaps", so red is the obvious answer. It is wrong. These gaps are *permanent and normal* — an Instagram reply will never have a draft, by design. Red is for something that went wrong; these are things that were never automated. Colouring them red is the S10 mistake wearing a new outfit.

**States.** Nothing waiting (today): the section keeps its eyebrow and heading, **the count slot renders empty** — not `0`, per the deck — and the content area holds one line, `Nothing waiting.`, body 13px `--ink-3`, no hairlines. **No action pill**, deliberately: §5.14 rule 4 allows one, but the page performs no action on any lead (D6) and there is nothing to link to. Bounded: `Showing 20 of 41.` mono 9px `--ink-4`. Failed: `Couldn't load what's waiting.`

### 3.9 Block F — Health strip

**Quiet state — a hairline and one line, no panel, no border, no radius** (§4: it is not a real object):

```
─────────────────────────────────────────────────────────────────────────────
Engine ran 2h ago · all sites ok · checked 6h ago              [ CHECK NOW ]
```

`border-top: 1px solid var(--line)`, body 11px `--ink-3`, separators `--ink-4`, ages tabular. `Check now` is a §5.10 outline pill, mono 9.5px/0.14em, right-aligned on the same line as the age — **the control belongs beside the thing it changes**, which is §5.3's "directly under the heading it modifies" applied sideways. Busy: `Checking…`, disabled, `--ink-4`.

**Warning state — the strip becomes a card.** When anything is wrong it gains `background: var(--panel)`, a full `--line` border and a 10px radius. That is the system's own grammar for "this is a real object now" (§4: *cards earn their borders*), and it is a **structural** alarm — stronger than a colour alarm and quieter. Each warning gets a 5px dot in its hue and the deck's exact sentence; healthy items go silent on an indented continuation line.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ● ShikksTracker send engine last ran 3d ago                    amber      │
│ ● 2 approved messages are stranded, unsent                     amber      │
│ ● Meowchi unreachable                                          red        │
│   AzeroTech ok · ShikksTracker ok                              --ink-4    │
│   checked 6h ago                                     [ CHECK NOW ]        │
└───────────────────────────────────────────────────────────────────────────┘
```

| Warning | Hue | Why |
|---|---|---|
| `...has never reported a run` | red | A missing measurement. |
| `...reported an unreadable run time` | red | A contract break — a conflict. |
| `...last ran 3d ago` | amber | Ageing. This is the 29-day story's exact case. |
| `...reported 2 errors` / `reported 1 error` | red | A real failure. |
| `N approved messages are stranded, unsent` | **amber, not red** | Per S10, approved-and-waiting is *correct* on its own; the code fires this only beside a stalled engine. It is a staleness signal, not a fault. |
| `Meowchi returned HTTP 503` / `timed out` / `unreachable` | red | A client site is down. |
| `sites never checked` | red | Missing. |
| `checked 6h ago` | none, `--ink-4` | |

*Implementation note, not IA:* `Check now` is the page's **only** interactive element. Keep it a leaf client component so everything else stays server-rendered. And the design doc's open item 3 is real — it re-pings three sites, two of them **clients'**, on every click, with no floor between runs. That needs a minimum interval.

### 3.10 Whole-page states, and one component the system is missing

**Failed-block treatment (new, used by B, C, D, E and the page-level failure).** The system has empty states (§5.14) but no *failed-to-load* state, and this page needs one five times. Proposal: the block keeps its eyebrow and heading; its content area is replaced by a 5px `--missing` dot plus the deck's sentence in body 13px `--ink-2`. **The dot carries the hue, not the text** — §5.10's status pill works this way, glow on text is forbidden (§6), and five blocks of red 13px body would be shouty. **No retry pill**: the page loads fresh every time, so the action is "reload", which the browser already provides. Inventing a Retry affordance would fake one.

**All external data down** (deck §6). One statement, not six:

```
SOURCE · SHIKKSTRACKER
Where your outreach stands

● Couldn't reach ShikksTracker.
  State of play, pipeline, campaigns, approaches and what's
  waiting all come from there.
─────────────────────────────────────────────────────────────────
Engine — unknown · Meowchi ok · checked 6h ago      [ CHECK NOW ]
```

Blocks A–E are **omitted**, not rendered empty. This overrides §5.14 rule 1 using §5.14's own rule 5: *"six identical 'connect something' prompts is noise. One banner at the top."* Same shape, same reasoning. The health strip still renders because site results are stored locally, and `Engine — unknown` uses the em-dash exactly as deck constraint 2 requires. The top bar's pill reads `● ShikksTracker unreachable` in red, so the fault is legible from the chrome before Riku reads the sentence.

**One source down:** that block alone shows the failed-block treatment; every other block renders normally.

### 3.11 Old pages — re-skin only

`/login` is the exception: **it must not get the shell.** The rail's nav would 401 for an unauthenticated visitor. The shell renders for authenticated routes only; `/login` keeps a bare centred `main`.

Class-by-class mapping so the existing markup picks up the system with no edits:

| Existing | Becomes | Note |
|---|---|---|
| `body` | `--void` ground, `--ink`, `--body` face, 13px/1.62 | Down from 15px — that is the system's size. |
| `main` | `max-width: 920px`, `padding: 28px 32px 72px` | Up from 640px. A visible widening of `/queue`; a re-skin consequence, worth telling Riku. |
| `h1` | display 600 24px `-0.02em` | Page-title role. |
| `button` | §5.10 outline pill **plus** the active-nav fill `#171B21` + inset hairline | This one trick reproduces §5.3's segmented control on `/queue`'s status filters with zero markup change: default `button` = active tab, `.secondary` = inactive. |
| `button.secondary` | ghost pill — transparent border, `--ink-3` | |
| `button.danger` | outline pill, `--missing` border at 40%, pale red label | Mirrors `.btn.go`'s green treatment. |
| `input`, `textarea` | `--sunk` fill, `--line` border, 8px radius, `--ink` | `:focus-visible` orange outline per the reference. |
| `label` | body 11.5px `--ink-3`, sentence case | Addressed to the person, so **not** mono caps. |
| `.card` | `--raised`, `--line` border, 10px radius, `14px 16px` | Plain-card radius (§3). |
| `.meta` | body 10.5px `--ink-3` | |
| `.badge` | §5.10 tag — 6px radius, mono 9px/0.13em uppercase | |
| `.error` | `--missing` 12.5px, no glow | |
| `.row` | gap 8 → 10px | Spacing scale. |
| `pre.body` | `--sunk` ground, 8px radius, **`--body` face kept** | It holds prose written to a human, not machine output. Mono would be wrong (§6). `white-space: pre-wrap` already handles the whitespace. |

**One tempting improvement I am deliberately not making.** `/queue`'s Approve button *should* be §5.7's green outline pill — that section literally establishes green-outline-never-solid as "the system is proposing, not demanding", which is the approval queue's exact semantics. But swapping it is a semantic change to a page under a no-change order, and `/queue`'s design belongs to its own S11 content discussion. I'd add the `.btn.go` class to the stylesheet unused, ready for that phase, and leave Approve as an outline pill today.

---

## 4. Where I disagree with the obvious answer

### 4.1 Drafts waiting should be **violet**, not orange

The obvious answer is orange: it is the brand hue, it is the loudest number on the page, and it is the one number the whole page exists to close a gap on. I think that is wrong twice over. First, orange means *money leaving, limits consumed* — a draft backlog is neither; forcing it there is a hue used where it does not carry its assigned meaning, which §2 lists under **Never**. Second, decision 2 says a money card joins this row later, and money-in is orange by definition. Spending orange now means the money card arrives and either fights for the hue or takes a wrong one — a redesign, which decision 2 explicitly forbids. Violet is not a compromise, it is the better fit: `--roi` means *judgement, decisions*, and 24 drafts is 24 decisions Riku has not made. It also makes this page and the Approval Queue speak the same colour for the same fact, which is the whole point of §7.2's single palette.

### 4.2 "25 of 30 contacts never contacted" gets **no hue at all**

The obvious answer is amber — untouched contacts are ageing inventory, and `--stale` means ageing. **S10 forbids it.** Riku's standing instruction is that nothing goes to a business until he says so, and the decision says in as many words that an engine sending nothing is CORRECT and that *no agent, digest line or session may report it as a stall, a backlog, or a gap*. A 34px amber figure is the loudest possible way to report it as a finding. Red is worse. Blue means activity and this counts the absence of activity. Green means healthy value and this is unstarted inventory.

So the card takes **no hue**: full 34px display weight in `--ink`, neutral `--raised` fill, plain `--line` border. This is not a downgrade — the governing precedent is §5.8's stat strip, *"only the problem counts take a hue; a healthy strip is entirely white on black"*, and §5.14's `.stat.blank` already establishes a hueless stat card in the system. The difference from `.stat.blank` is that mine has data, so the figure stays `--ink`, not `--ink-4`. Call it `.stat.plain`. The consequence — a three-card row that is violet / neutral / green — is fine; the source's own ROI card already breaks "the figure takes the card's hue".

### 4.3 The hero cards get **no sparkline**

§5.2 asks for three different graphic treatments and warns against giving all three the same one. The obvious response is to draw three different sparklines. **There is no series to draw.** `queue.drafts` and `contacts.hot` are point-in-time counts; RikuOS has no history endpoint for either, and none is in scope. Any curve on those cards would be shape invented to fill a slot — precisely what §1.5 says the system never does (*"nothing exists purely to look expensive — which is why it looks expensive"*) and what deck §2.6 forbids. The one card with an honest shape available is the proportion card, so it alone gets a 4px track. Two empty graphic layers on a 132px card is not a defect; it is the reference's rule applied honestly to data that does not have a history.

### 4.4 The deck's headings become **eyebrows**, and the headings are text I write

A naive reading puts `Pipeline` in the `<h2>` and drops the eyebrow, because the deck's strings are final and the reference's rule about possessive headings is "just style". That gets it backwards. §5.1 defines the eyebrow as *the machine's name for the section* — and `Pipeline`, `Campaigns`, `Approach performance` **are** machine names. The deck loses nothing: every fixed string is on screen, in the type role that matches what it is. What the page gains is §1.2's indexing pattern, which the reference calls the reason a long scroll feels organised rather than endless — and this page will be a long scroll the moment the pipeline fills.

### 4.5 Hero 3 is **hot leads**, not replies waiting

Replies waiting looks like the better hero: it is a demand on Riku, and demands are what a glance is for. Three arguments against. **(a) It triple-counts.** The chaser already turns supported-channel replies into drafts, which are hero 1, and the un-drafted remainder is Block E. D3 exists precisely to stop one lead appearing in two places; a hero card would make it three. **(b) It is structurally blind.** Since S15 replies are only detected on email, so the number can never see an Instagram reply. Block D goes to great length to say so about its own data — and a 34px figure cannot carry a "not measurable" disclaimer. Putting a known-partial number in the loudest position on the page is a correctness problem. **(c) It will read 0 almost always**, and a card position that is dead most days is a position Riku learns to skip — worse than no card. Hot leads is a complete count over all contacts, honest, and it is the one number that *grows* as the business works, which is the right companion to "what do I owe" and "how much is untouched".

### 4.6 Two smaller ones, for the record

- **Agent badges use the code's kebab-case names verbatim** (`OUTREACH-HEALTH`, not `Outreach Health`). Prettier names would stop matching the push notification and the `AgentRun` log Riku reads when something breaks. Matching the log beats looking nice.
- **Block D gets no hue at all**, including no green on the winning reply rate. Ranking 11% over 6% at 72 vs 54 sends embeds a significance threshold nobody has set, and the design doc assigns judgement over this data to P7's retro agent. This block reports; it does not rank.

---

## 5. Open questions only Riku can answer

1. **Does the shell wrap `/queue` and `/settings`?** My reading of decision 4 is yes — the deck's furniture puts a three-destination nav on the page and the design doc says P8 adds it app-wide, so there is no other way to navigate. "No layout change" then means *within the page's own content column*, and the visible consequences are that `main` widens from 640px to 920px and `/queue`'s own header briefly duplicates the rail. `/login` gets no shell. Confirm.
2. **A worker that ran but was switched off — green or grey?** When `monitoringEnabled` is off, four agents get `ok: true` placeholder rows and would badge green while doing nothing. I recommend **grey**: grey already means "no signal from this worker", and "ran and deliberately did nothing" is much closer to that than to healthy. This keeps your four states and stops the badge lying. It needs the rail to read the run's note field, which nothing currently does.
3. **May a hero card persist at zero?** This overrides the deck's "hidden when count is 0" for A1 and A3 specifically, to stop the row jumping from three cards to two. I recommend yes, with `0` in drained grey. Everything else in Block A still disappears at zero exactly as the deck says.

---

## 6. Risks — what could make this page fail the three-second test

1. **Block E is fifth.** Today the whole page fits one screen, so this costs nothing. At §8's fullness Riku scrolls past seven pipeline rows, two collapsed blocks and a summary line to reach the only list that asks anything of him — and there is no count of it visible above the fold. D1 settled that numbers lead and I am not relitigating it, but this is the single thing most likely to break the glance once real data arrives. Worth measuring on the live page rather than assuming.
2. **Hue creep.** Violet hero, green hero, green `Won`, green `Replied`, amber overdue lines, six coloured agent badges, an amber-or-red health strip and a coloured top-bar pill. Each is individually justified; together they can push past §1.3's "roughly three loud things per screen" and dissolve the four-second palette read. The badges are the biggest offender because six of them sit in the rail permanently. Mitigation: everything except the three hero figures is *small* colour — 5px dots, 10px mono labels, single table cells — and never display weight. If the page still reads as a Christmas tree in build, the agent badges are the first thing to desaturate.
3. **Quiet mistaken for broken.** Today's page is mostly grey by design. It is genuinely not empty — three heroes, three stage rows, two campaigns, four approaches — but the *impression* of emptiness is a real failure mode for a page whose deck says it must look finished. The defence is that everything grey is grey **because it is correct**, and the one loud thing on screen is the one thing that is actually asking something.
4. **`Check now` has no floor.** It re-pings three external sites, two of them clients', on every press. Someone leaning on the button hammers a client's server from RikuOS's IP. Design-doc open item 3; it needs a minimum interval before ship.
5. **The stale-tab lie.** A `force-dynamic` page left open overnight shows yesterday's numbers with full confidence. The clock stamp in the breadcrumb is the mitigation and it is deliberately an absolute time, not "just now".
6. **`Freelance` said three times** — rail active item, top-bar breadcrumb, and (if the lead reinstates it) a page eyebrow. I dropped the third. If any two of these read as redundant in build, drop the breadcrumb and keep the freshness stamp alone.
