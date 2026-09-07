# P8 round 1 — System Keeper

**Role:** guardian of `docs/design/DESIGN-INSPO.md` and `docs/design/components.html`.
**Standing question:** would the reference do this? Where it is silent, what would it do, built from parts it already has.
**Date:** 2026-09-06 · Written without reading any other specialist's paper.

---

## 1. Position

The reference was drawn for a page whose job was to show three money figures and a pile of expressive objects. P8's job is the opposite: it shows a handful of counts, three tables, a short list and a footer, and most of the time most of those are empty. So the mapping is **not** "find a home for every component" — it is "use the four or five recipes that fit, refuse the rest out loud, and build the two or three things the reference doesn't have from parts it already earns." Concretely: the shell and the rail come over whole; the stat hero row carries Riku's three numbers with three genuinely different graphics; Blocks B, C, D and E are all the same underlying thing — the **usage-row grammar** (§5.5): hairline-separated rows in a fixed grid, no boxes, numbers right-aligned and tabular; the health strip is the **stat strip** (§5.8) sealing the bottom, silent when healthy exactly as that component already specifies. Skill cards, the insight card, the memory graph, provider cards, integration cards, the calendar and the cadence strip all stay out, and I will argue against every attempt to smuggle them in. The single biggest risk in this build is not ugliness — it is that a page of four stacked tables reads as an admin template. The defences against that are, in order: the mono face, the eyebrow/heading rhythm with 44–72px between sections, tabular numerals, and exactly three loud things on screen. Those four are non-negotiable and cost almost nothing.

---

## 2. Tokens — as they land in `globals.css :root`

Fonts come from `next/font/google` (Archivo, IBM Plex Sans, JetBrains Mono), which downloads and self-hosts them at build time. The CSP has no `font-src` directive, so `default-src 'self'` covers `/_next/static/media/*.woff2` — this works and nothing external is fetched. The `<link>` to `fonts.googleapis.com` at the top of `components.html` must **not** be copied; it is blocked.

```css
:root{
  /* --- faces (wired from next/font's .variable classnames on <html>) --- */
  --display:var(--font-archivo),'Helvetica Neue',Arial,sans-serif;   /* 600/700 */
  --body:var(--font-plex),'Helvetica Neue',Arial,sans-serif;         /* 400/500/600 */
  --mono:var(--font-jetbrains),'SFMono-Regular',Consolas,monospace;  /* 400/500/700 */

  /* --- ground & structure (reference §2) --- */
  --void:#08090B;        /* page ground */
  --panel:#0E1013;       /* the health strip's ground; section wells */
  --raised:#14171C;      /* cards. one step up from panel, never two */
  --sunk:#050608;        /* recessed wells, control tracks, <pre> on /queue */
  --line:#1D222A;        /* card edges, table header rule, rail/topbar hairline */
  --line-soft:#15191F;   /* row dividers inside a list */

  /* --- ink --- */
  --ink:#E9ECF0;   --ink-2:#98A1AD;   --ink-3:#5B6470;   --ink-4:#3A424C;

  /* --- semantic hues. meaning is fixed; see the P8 column below --- */
  --spend:#FF8A3D;     --spend-dim:#B4551E;
  --save:#35D399;      --save-dim:#177A57;
  --roi:#A78BFA;
  --session:#5FA5FA;
  --stale:#FBBF24;
  --missing:#F87171;
  --skill:#F472B6;     /* graph-only. unused on this page. carried for the system */
  --track:#1A1E25;     /* ring track / bar track. the reference uses this literal 4× */

  /* --- card tints: 155deg, deep desaturated hue → near-neutral at 62% --- */
  --tint-spend:linear-gradient(155deg,#2A1408,#141013 62%);
  --tint-save:linear-gradient(155deg,#052620,#0F1417 62%);
  --tint-roi:linear-gradient(155deg,#171233,#111117 62%);
  --tint-stale:linear-gradient(155deg,#2A1E04,#141209 62%);   /* NEW — see note */

  /* --- type scale (reference §3) --- */
  --fs-fig:34px;   --fs-title:24px; --fs-head:19px;  --fs-card:13px;
  --fs-body:13px;  --fs-meta:10.5px; --fs-eyebrow:9.5px; --fs-micro:8.5px;
  --tr-fig:-.03em; --tr-title:-.02em; --tr-head:-.015em;
  --tr-eyebrow:.18em; --tr-micro:.15em; --tr-ctrl:.13em;

  /* --- spacing 4/6/10/14/20/28/44/72 --- */
  --sp-1:4px; --sp-2:6px; --sp-3:10px; --sp-4:14px;
  --sp-5:20px; --sp-6:28px; --sp-7:44px; --sp-8:72px;

  /* --- radii --- */
  --r-tag:6px; --r-nav:7px; --r-chip:8px; --r-card:10px; --r-feature:14px; --r-pill:999px;
}
```

**Alpha ladder** (used as `rgba()` literals, as the reference does): `100%` figures and glyphs · `~30%` glow on a status dot · `~20%` border on a hued card · `~8–9%` card and chip fills.

**Two token names I am changing, and why.** `components.html` defines `--alert` and `--amber`, then twice writes `var(--stale,#FBBF24)` — a fallback for a token it never defined. That is a bug in the reference file, not a naming choice. I am shipping **`--stale` and `--missing`** (the names the written reference §2 uses) and dropping `--alert`/`--amber` entirely. Governing idea 1 is that a hue carries a fixed meaning; the moment a token is named after its colour, the next person reaches for `--alert` for a form error and red stops meaning "the machine is in conflict."

**One tint I am adding.** The reference gives three card tints and P8 needs a fourth (amber, for the contacts card). Built to the documented recipe — deep desaturated hue at `0%`, near-neutral nudged toward the hue at `62%`, border at 20% alpha: `linear-gradient(155deg,#2A1E04,#141209 62%)` with `border-color:rgba(251,191,36,.2)`. Nothing invented; the recipe was already written down.

**Dropped:** `--r-xl:20px` (unused in the reference, unused here).

### What each hue means *on this page*

| Token | Fixed meaning (reference §2) | Carries on P8 |
|---|---|---|
| `--spend` | money out, limits consumed, the brand mark | the drafts hero card, and the logo tile only |
| `--stale` | ageing data, idle agents | the never-contacted hero card; an overdue agent badge; a stale-engine warning |
| `--roi` | judgement, decisions, insight | the hot-leads hero card (ShikksTracker's own scoring) — and nothing else |
| `--save` | value recovered, healthy, connected | reply rate in Block D; a healthy agent badge; the push status dot |
| `--missing` | conflicts, gaps, over-limit | agent failed; engine errors; a site down; stranded messages |
| `--session` | activity, runs, workflow chains | **unused on P8.** No component here reads as activity. Leave it alone. |

**Lock this now, before the money phase:** money coming in is `--save` green (green is "money or time saved/recovered"), **not** orange. Orange is money *leaving* and is already spent on the drafts card and the brand mark. If the later money card takes orange, orange means two things and governing idea 1 breaks.

---

## 3. Block by block

Content column: `max-width:980px`, padding `28px 28px 72px`, sections `44px` apart (`72px` before the health strip). Rail `170px` fixed.

### 3.1 Shell & nav

Straight from §4, no changes. Rail 170px fixed, `border-right:1px solid var(--line-soft)`. Logo tile 24px at 7px radius, `linear-gradient(150deg,#FF9E5C,#F2622B)`, hand-written sunburst SVG — **the tile must not be a letter**; an "R" tile hardcodes the product name into a glyph and breaks the `APP_NAME` rule. Wordmark is `{APP_NAME}` in display 600 14px, and the rail must not assume a short name (`overflow-wrap` set, no fixed width).

Nav: three items, `padding:6px 9px`, `border-radius:7px`, 11.5–13px, `--ink-3`. Active = `background:#171B21; color:var(--ink); box-shadow:inset 0 0 0 1px var(--line)`. **Never a left accent bar.** Each item carries a 13px hand-written stroke glyph at `stroke-width:1.8`, `currentColor`, `opacity:.85` — no icon library, and the reference's own glyphs are hand-written so there is no incompatibility.

`/login` does **not** get the rail. A nav rail on a signed-out screen is a broken affordance; login keeps a bare centred column.

### 3.2 The agents block (decision 3)

Rail, under a `.grouplabel` reading `AGENTS` (mono 8.5px, 0.16em, `--ink-4`). Six badges — `EXPIRY-SWEEP`, `WATCHDOG`, `SITE-HEALTH`, `OUTREACH-HEALTH`, `DISPATCHER`, `CHASER` — in **fixed order** (the order the morning cron runs them), never sorted by state. Colour does the scanning; a list that reorders itself defeats the muscle memory that makes governing idea 1 work.

Recipe is `.agent` verbatim: `padding:8px 9px`, `border-radius:8px`, mono 700 10px, `letter-spacing:.08em`, uppercase.

State derivation, from the latest `AgentRun` per agent, checked in this order (most-fundamental first, matching `evaluateWatchdog`):

| State | Test | Treatment |
|---|---|---|
| grey | no run record | `--ink-4` label, `--line` border, `--raised` fill, no gradient |
| amber | `age > (24 + 6)h` | `--stale` label, `rgba(251,191,36,.22)` border, `linear-gradient(180deg,rgba(251,191,36,.09),rgba(251,191,36,.02))` |
| red | `!ok \|\| counts.itemsFailed > 0` | same shape in `--missing` |
| green | otherwise | `--save` **label only** — no gradient fill, `rgba(53,211,153,.18)` border |

**Three System-Keeper notes on this block.**

1. **Green gets no tinted fill.** This deviates from the specimen, which gradients every badge. I am doing it because governing idea 3 says the chrome is silent so the data can shout, and six gradient badges in a 170px rail is a second data display competing with the hero row. §5.8 already sets the precedent — "a healthy strip is entirely white on black." A healthy rail should be six quiet green words; a broken one should have one badge that glows.
2. **`watchdog` is not in `EXPECTATIONS` and must not be added** — `watchdog.test.ts:82` asserts its absence, and the file explains why (it is running, which is the proof). Its badge takes freshness from the same 24+6h rule computed locally, not by asking `evaluateWatchdog`, which will never return an anomaly for it. A rail showing five of six workers is a lie of omission.
3. **`lead-sweep`, `triage` and `retro` must never render.** They are in the `AGENTS` enum but are dead (S8, S15) or unbuilt. The rail's list is a hand-written constant next to `EXPECTATIONS`, never derived from the enum. A grey `TRIAGE` badge advertises a lane that was deliberately deleted.

No click behaviour this phase, so badges are `<span>` with **no hover state at all**. A hover that lifts implies a click.

### 3.3 Top bar

44px, one row, `border-bottom:1px solid var(--line-soft)`, no shadow. The source's bar has four things RikuOS does not have. What it truthfully carries:

- **Breadcrumb** — `Operator / Freelance`. Exactly the source's shape (role, then where you are), `Operator` in `--ink` at weight 500, separator `--ink-4`, location `--ink-2`, 11.5px. It needs no identity: there is one user. Not a link.
- **Status pill** — `.statuspill` recipe, reading push registration on this device. Subscribed: green dot with `box-shadow:0 0 6px var(--save)`, `rgba(53,211,153,.08)` fill, `rgba(53,211,153,.2)` border, label `Notifications on` in sentence case. Not subscribed: `--ink-4` dot, `--line` border, no fill, `Notifications off`. Unsupported: **the pill is absent entirely**, not shown dead. This is a genuine live status of the shell and it tells Riku whether the "phone buzzes → glance" loop is armed, which is the page's whole premise (deck §1).
- **Log out** — `.btn` outline pill, mono 9.5px caps, pushed right with `margin-left:auto`. The only control in the bar.

**Deleted, deliberately:** the `⌘K` search field (no search exists), the notification icon button (no notification centre), the theme icon button (dark only, decision 5). Do not fake affordances.

The pill is **read-only this phase**. Making it the enable-notifications control would move `PushControls` off `/queue`, which decision 4 forbids. Recorded as a later change, not this one.

**No `Refresh` control.** The deck makes it optional; I am declining it. The page is `force-dynamic` — reloading is refreshing. A `Refresh` next to `Check now` gives two refresh-shaped controls with different scopes, and §5.10's one rationed solid fill is reserved for a control that reframes every number on the page. This page has none.

### 3.4 Block A — the hero row (decision 2)

**Structure.** `display:grid; grid-template-columns:repeat(auto-fit,minmax(215px,1fr)); gap:14px`. At a 980px column: three cards ≈ 313px each; **four cards ≈ 234px, still above the 215px minimum**, so the money card joins later with zero CSS change. Five wraps to a second row. That is decision 2's "no redesign" requirement satisfied by one line of grid, and it is the reference's own `.stats` rule, unmodified.

Card: `min-height:132px`, `padding:15px 16px 18px`, `border-radius:14px`, flex column, figure pushed down with `margin-top:auto`, graphic absolutely positioned bleeding to the lower edges at `z-index:1`, content at `z-index:2`.

**The voice problem, and its fix.** The reference says mono caps for what the system names and sentence case for what addresses the person. The deck's strings address the person ("waiting on you"). A mono-caps `DRAFTS WAITING ON YOU` would be the wrong voice. So the sentence splits across the two slots the card already has, and **no word is added or lost**:

```
DRAFTS                    OPEN ↗       ← mono 9px caps .16em, in the card's hue
24                                     ← display 700 34px -.03em tabular, in the hue
waiting on you in ShikksTracker        ← body 10.5px --ink-3, sentence case
```

The three cards:

| # | Label / figure / meta | Hue | Link out |
|---|---|---|---|
| 1 | `DRAFTS` · `24` · `waiting on you in ShikksTracker` | `--spend` + `--tint-spend` | `OPEN ↗` — the only card with one |
| 2 | `CONTACTS` · `25` · `of 30 never contacted` | `--stale` + `--tint-stale` | none |
| 3 | `HOT` · `2` · `of 30 contacts` | `--roi` + `--tint-roi`, **figure in `#EDE9FE`** | none |

Cards 2 and 3 get **no `DETAILS ↗`** — the reference makes it optional and there is no honest destination for either. An arrow that goes nowhere is a fake affordance.

Card 3 takes the reference's own ROI exception (§5.2): the hue is spent on the graphic, so the figure goes near-white to stay the headline. That exception exists for exactly this case — a judgement number whose graphic is the interesting part.

**Why hot leads is the third card** (decision 2 asked the team to argue): replies-waiting cannot be defined without either duplicating Block E's count or contradicting it — Block E is deliberately *only the gaps* (D3), so a hero "replies waiting" would have to pick a different definition and then two numbers on one page would both claim to be the answer. It is also 0 today, so the row would open with a drained card on the page's most-read line. Hot is live today (2), it is the only forward-looking number on the page, and it is a judgement number, which is what `--roi` is for. The cost is that `2` also appears in Block B's summary line (`30 contacts · 2 hot`) — accepted, because deck strings are final and a hero reading a number that the detail block also states is normal in this system.

### 3.5 The three hero graphics

The reference demands three *different* shapes, each a reading of its own number. **Warning honoured: none of these invents data.** All three read only the integers the API actually returns.

**Card 1 — drafts (a count of discrete waiting things).** A field of marks, one mark per draft: 5×5px squares at 3px gaps, `rgba(255,138,61,.22)`, laid out in rows of 8 from the bottom-right, bleeding off the lower and right edges. 24 drafts = three full rows, countable. Above 48 the drawn marks stop at 48 and the last row fades to zero alpha — the same honesty device as the calendar's `+2 more`; the figure still states the truth. This is not a sparkline and it is not a bar: a count with no denominator must not be drawn against an implied limit. (I considered and rejected §5.13's ticks — that component's own rule caps countability at ~16 segments, and 24 is past it.)

**Card 2 — never contacted (a part of a whole).** The ring from §5.5, used as a graphic rather than a control: 90px diameter, 4px stroke, rotated `-90deg`, round caps, track `--track`, arc `--stale` at 25/30 = 83%, positioned so its lower-right quadrant is clipped by the card edge. **No number inside it** — that would be a second loud figure in one card. The ring is the reference's own answer to "how full is this against what", which is exactly the shape of 25-of-30.

**Card 3 — hot (a selection out of a population).** 30 dots, one per contact, scattered on a fixed seed in the lower half of the card, `--ink-4` at 3px. The 2 hot ones are lit using §5.8's node recipe: a small solid `--roi` core under a wide low-alpha radial halo. It reads literally as "these two, out of these thirty." Glow is legal here — the reference permits it on graph nodes and status dots and forbids it only on text. Population caps at 60 dots with the same fade.

**At a real zero** (§5.14.2 — hue drains, structure stays): figure `0` in `--ink-4`, tint reverts to plain `--raised` with a `--line` border, label to `--ink-4`. Card 1 draws no marks; card 2 draws the ring track with no arc; card 3 draws the population dots with none lit.

**At missing** (the field did not arrive): figure `—`, and the meta line becomes the deck's exact string — `ShikksTracker didn't report how many drafts are waiting` / `…how many contacts there are` — in `--ink-4`. Tracks stay drawn, per the reference's own empty-row specimen. That is the visually distinct treatment deck constraint 2 demands: `0` versus `—` versus two different sentences.

**Failed to load:** all three cards go to `—` and the page-level line from deck §6 (`Couldn't reach ShikksTracker.` plus its explanation) renders above the row.

### 3.6 Block A's leftovers — the statement strip

Directly under the hero row, at 16px: A2 (`3 approved, not yet sent`) and A4 (`Sending is off`) as **sentences that disappear when they have nothing to say**, per the deck. Recipe is the skill-card honesty note (§5.6): 11.5px `--ink-4`, a 13px hand-written info glyph, `gap:7px`, flush left, directly under the cards it qualifies. Today both are absent and the strip is not rendered.

A4's slot is designed and empty (D7): the strip simply has one fewer line until the contract lands. Nothing infers the switch state.

`Nothing waiting on you.` renders in this strip when every hero number is 0 or absent *and* neither A2 nor A4 applies. Today it does not show (drafts = 24).

### 3.7 Block B — Pipeline

Eyebrow `SHIKKSTRACKER · CONTACTS` / heading `Pipeline` (display 600 19px). Under it, the summary line as a §5.8 stat strip inline: `30` in `--ink` display 700 13.5px + `contacts` in `--ink-3`, then `2` in `--roi` + `hot`. Only the meaningful count takes a hue, per that component's rule, and `--roi` matches the hero card.

Rows: `display:grid; grid-template-columns:minmax(0,1fr) 56px; padding:11px 0; border-top:1px solid var(--line-soft)`, first row no border. Label body 400 13px `--ink-2`; count display 600 15px, **right-aligned, tabular**, `--ink`. **No boxes.**

Collapsed-empty line under the rows: `Nothing yet at call booked, proposal sent, won or lost` — 10.5px `--ink-4`, 10px above.

`No contacts yet.` / `Couldn't load the pipeline.` — 12.5px `--ink-3`, in place of the rows; the eyebrow, heading and hairline stay (§5.14.1, the container never disappears).

Full render (§8, seven rows): identical, no change needed. The 56px count column holds four digits at 15px tabular.

### 3.8 Block C — Campaigns

Eyebrow `SHIKKSTRACKER · CAMPAIGNS` / heading `Campaigns`. Collapsed row is a `<button>` styled as a list row, not a card: full width, `border-top`/`border-bottom` `--line-soft`, 44px tall, heading left, count right in display 600 15px tabular, then a hand-written chevron in `--ink-4` that rotates 90° when open. Open state raises the label to `--ink` and the chevron to `--ink-3`. No fill, no accent bar.

Expanded table (the `.debt` recipe from `components.html`, which is already exactly this): header row mono 8.5px caps `--ink-4` with `border-bottom:1px solid var(--line)`; body rows `padding:11px 0; border-bottom:1px solid var(--line-soft)`. Grid `minmax(0,1fr) 64px 64px 64px 64px`, all four number columns right-aligned and tabular. Name in body 600 13px `--ink`; numbers in body 400 12.5px `--ink-2`.

**No hue anywhere in Block C.** Campaigns are inventory, not insight — §5.4's lesson, applied. A "best campaign" highlight would be judgement this block does not make.

Footnote when expanded (open counts undercount) — honesty-note recipe again, 11.5px `--ink-4`. Bounded-list line `Showing 20 of 34 campaigns.` under it in 10.5px `--ink-4`, as a statement, not a control — there is no second route to link to.

### 3.9 Block D — Approach performance

Eyebrow `SHIKKSTRACKER · VARIANTS` / heading `Approach performance`. Same disclosure row as C. Collapsed today, the summary under the row reads `No sends yet — nothing to compare.` in 11.5px `--ink-4`. In the full render the collapsed row's right side carries the best approach's name (`--ink-2`, truncated with ellipsis) and its rate (`--save`, 12.5px tabular).

Expanded, two groups, always both.

- Group headings `Measured — email` and `Not measurable` in **body 600 12.5px `--ink-2`, sentence case as written**. I am deliberately *not* rendering them as mono caps: forcing caps would change strings the deck declares final.
- Group 1 grid: `minmax(0,1fr) 72px 56px 56px`. Reply rate is the only hued cell — `--save`, body 600 12.5px, tabular. Everything else `--ink-2`.
- Group 2 grid: `minmax(0,1fr) 72px` — there is no replies column, because there are no replies to count. Reply-rate cell is `—` in `--ink-4`. **The rest of group 2 stays at full `--ink-2` strength.** This is the trap: a naive build drains the whole group to `--ink-4` and it reads as an error. The deck is explicit — the not-measurable group is half the table, not a footnote.
- The explanatory line (`Replies are only detected on email, so these can't be scored.`) always renders with the group, 11.5px `--ink-3`, directly under the heading. Not a footnote at the bottom.

`0%` must never appear in group 2. That is the em-dash rule (§5.14.3) and the `p7-variant-stats-blind-spot` finding, closed at the point of display.

### 3.10 Block E — Needs you

Eyebrow `SHIKKSTRACKER · ATTENTION` / heading `Needs you`, count right-aligned in display 600 15px tabular `--ink`.

Row (whole row is a link out, hairline `--line-soft` between rows, no box):

```
Bella's Cafe                          Instagram   ← 600 13px --ink | mono 8.5px caps --ink-4
replied 2 days ago                                ← 10.5px --ink-3
"Sounds good, what would the timeline look like?" ← 12.5px --ink-2
Nothing drafts replies for Instagram.             ← 10.5px --ink-4
```

Kind 3 (overdue follow-up) is the same row with lines 3 and 4 collapsed into one: `follow-up due 3 days ago` / `Send the revised proposal`. Hover raises the name to `--ink` and reveals a `↗` in `--ink-4` at the right edge.

**No hue on any row, and no hue on the count.** Red means the machine is broken or in conflict; three business replies are the system working. Hueing them would spend the loudest colour on the calmest fact and rob the health strip of its ability to be unmissable. Under S10 a backlog is explicitly not a problem, so the count stays `--ink`.

`Nothing waiting.` — 12.5px `--ink-3`, heading and hairline retained. **No action pill in the empty state.** §5.14 allows one at most; D6 allows none.

### 3.11 Block F — Health strip

`margin-top:72px`, `border-top:1px solid var(--line)`, `background:var(--panel)`, `padding:12px 16px`, full content width, no radius, no side borders. It is the §5.8 stat strip, and that component already specifies the behaviour the deck wants: healthy means entirely neutral.

**Healthy** — one line, 10.5px `--ink-3`, dot-separated exactly as written: `Engine ran 2h ago · all sites ok · checked 6h ago`. `Check now` as a `.btn` outline pill, `margin-left:auto`. Busy state: label becomes `Checking…`, pill disabled at `--ink-4`. The only busy state on the page.

**Warning** — one line per warning, each with a 5px dot at left, hued and glowing (`box-shadow:0 0 6px <hue>`); text in `--ink` at 12.5px; healthy sites and the snapshot age fall to a `--ink-3` meta line beneath. Hues: engine stale → `--stale`; engine errors, stranded messages, a site down → `--missing`.

**I am replacing the deck's `⚠` with the hued dot.** The reference has no warning triangle anywhere and uses a dot-with-glow for exactly "this thing is in this state." The *words* are final; the marker is the system's own. Flagged for the lead in §5.

**Block F is the one place the §5.1 eyebrow/heading rhythm is deliberately skipped** — the deck says it must read as a footer, and a footer with an eyebrow and a heading is a panel. The deck wins.

### 3.12 The old pages (decision 4)

The shell lives in a layout wrapping `/queue`, `/freelance` and `/settings`; `/login` stays bare. Page bodies are untouched; only `globals.css` changes.

| Existing rule | New treatment |
|---|---|
| `body` | `--void` ground, `--ink`, `--body` face, 13px/1.5 |
| `main` | keeps its column; now sits inside the shell's content area |
| `h1` | page-title role: display 600 24px `-0.02em` |
| `button` (default) | `.btn` neutral outline pill, mono 9.5px caps |
| `button.secondary` | `.btn.ghost` — transparent border, `--ink-3` |
| `button.danger` | outline pill, `rgba(248,113,113,.4)` border, `#FCA5A5` label. **Never a solid red fill.** |
| the queue's Approve | the affirmative pill: `rgba(53,211,153,.4)` border, `#8AE9C6` label |
| the queue's status filters | §5.3 **time-range** recipe: no track, active item inverts to a solid `--ink` pill with `#0A0C0F` text — the page's one rationed solid fill, correctly spent, because that control reframes every item below it |
| `.card` | `--raised`, 1px `--line`, 14px radius, 15px padding |
| `.badge` | `.uchip`: mono 8px caps, `--line` border, 4px radius, `--ink-4` |
| `.meta` | 10.5px `--ink-3` |
| `.error` | `--missing` at 12.5px — text, not a red box |
| `pre.body` | `--sunk` ground, `--line` hairline, `--mono` 11.5px `--ink-2` |
| `input`,`textarea` | `#101318` fill, `--line` border, 8px radius, `--ink`; focus `2px solid var(--spend)` at `outline-offset:3px` (the reference's own choice — a focus ring is chrome, not data) |
| `label` | 10.5px `--ink-3` |

Nothing structural moves on any of the three. Login gains the ground, the faces and the pill; it does not gain an eyebrow, a logo or a rail.

---

## 4. Where I disagree with the obvious answer

**1. Block B gets no bars.** The obvious build gives each pipeline stage a share bar or a stacked bar. Reject. In this system a bar is read against a *limit* (§5.5's entire premise: how full, how long till reset, against what). Pipeline stages have no limit — only each other — so a bar would be a second drawing of the same digits, which is decoration, which governing idea 5 forbids. Right-aligned tabular counts separated by hairlines *is* the reference's answer for a column of numbers, and it survives the seven-row full render unchanged. If the row feels bare, the fix is the eyebrow/heading rhythm and the section gap, not a chart.

**2. Block E takes no hue at all — not even amber.** The obvious build hues "Needs you" because the name says it needs you. Reject on two grounds. Semantically, red means the machine is in conflict and amber means data is ageing; a business owner asking about timelines is neither. Practically, this page has exactly one place that must be unmissable — the health strip — and it can only be unmissable if it is the only thing on the page allowed to go red. Spending red on the calm list costs the loud one its voice.

**3. The hero cards drain; Block A's remaining lines still disappear.** Both obvious readings of the tension are wrong. §5.14 governs **containers** — a card, a row, a grid slot — and its reason is that vanishing containers make the layout jump and teach nothing. The deck governs **statements**, and a false sentence teaches something wrong: "0 drafts waiting on you" reads as a cleared backlog when the truth is that sending is off (S10). So hero cards are permanent and drain; A2 and A4 are sentences and disappear. And within a drained card, a real measured `0` is `0` — the em-dash is reserved for a field that never arrived.

**4. `--stale` and `--missing`, not `--amber` and `--alert`.** The live component file ships the appearance names and then twice reaches for a semantic name it never defined. Shipping `--alert` guarantees someone uses red for a form-validation error inside six months, at which point red no longer means "the machine is in conflict" and governing idea 1 — the highest-value thing in the whole reference by its own account — is dead. This is worth a rename even though it means the CSS in `components.html` cannot be copy-pasted verbatim.

**5. The third hero card is hot leads, not replies waiting.** Set out in §3.4. The short version: replies-waiting has no definition that doesn't collide with Block E or the Queue, and it is zero today, so the page's most-read line would open on a drained card.

**6. Healthy agent badges get no tinted fill.** The specimen gradients every badge. Six gradient badges in the rail turn the chrome into a second data display and break governing idea 3. Healthy is a quiet green word; only a problem badge lights up. This mirrors §5.8's own "a healthy strip is entirely white on black."

**7. No `Refresh` and no time-range control.** The deck permits a refresh affordance; I decline it. The page is force-dynamic, the feeds carry no time dimension, and §5.10 rations the one solid fill to a control that reframes every number — which on `/queue` is the status filter and on `/freelance` is nothing. Two refresh-shaped controls with different scopes is worse than one.

---

## 5. Open questions only Riku can answer

1. **The `⚠` in the health strip** — is the triangle a final string, or is it shorthand for "this is a warning"? I have replaced it with the system's own hued status dot. One word from Riku settles it.
2. **The push-status pill in the top bar is read-only this phase**, because making it the control would move `PushControls` off `/queue`, which decision 4 forbids. Confirm the control stays on the Queue page for now.
3. **Block B keeps `· 2 hot` while `2` is also a hero card.** Strings are final so I keep it. Confirm the repetition is acceptable rather than dropping the clause.
4. **Nothing else.** The rest is settled by the deck, the reference and the five decisions.

---

## 6. Risks — what would make this look like another dark admin template

- **The mono face going missing.** The reference says it outright: the mono is what makes the app read as an instrument rather than a website. Three self-hosted families is the single biggest "does this feel expensive" lever and the easiest thing to quietly drop when the font pipeline gets fiddly. If anything gets cut, cut a *weight*, never the third family.
- **Four stacked tables with no rhythm.** Blocks B, C, D and E are all lists of numbers. Without the mono eyebrow above each sentence-case heading, and without 44px between sections, they merge into one long table and the page becomes exactly the thing the reference warns about. The rhythm costs nothing and is most of why the source feels organised.
- **The empty render is the real render.** Today's page (deck §7) is what Riku sees for months. A design tuned against §8's full render will look unfinished today. Build §7 first, then check §8 — not the other way round.
- **Loud-thing inflation.** Today's page should have exactly three loud things: the three hero figures. Add a hued Block E count, hued stage counts, six gradient rail badges and a red health strip and it becomes eight. Count them on the finished screen.
- **The three hero graphics degrading into three sparklines.** They are three bespoke SVGs, each with an empty state, and they are the first thing to get flattened under time pressure. The reference names this trap by itself: "don't give all three the same sparkline."
- **Filling the desktop width.** At 980px with narrow tables the page is short and airy. The temptation is a two-column layout, a filter panel or a chart to fill it. §4 says single column, no secondary sidebar, ever. Short and quiet is correct here.
- **Nesting.** Block C expanded is the likeliest place someone puts a card inside a card. Rows live directly on the page ground under a hairline header; nothing nests more than one card deep.
- **`APP_NAME` leaking.** The logo tile must not be a letterform, the rail wordmark must not assume a length, and no eyebrow may hardcode "RikuOS."
