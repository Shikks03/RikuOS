# RikuOS — Design Reference

> Source: **"Claude Code Agentic OS… It self improves"** by Jack Roberts (`youtube.com/watch?v=MAuLQzcMrS0`), frames at 0:45, 0:48, 0:52, 0:56.
> Scope: **the app UI only** — the `localhost:8081` dashboard. The presentation page shown at 1:56 / 2:08 is a separate marketing system and is deliberately not covered here.
> Companion file: `components.html` — every component below rebuilt as live HTML. Open it when you need to see a thing rather than read about it.
> Status: teardown **plus** the RikuOS layer. Desktop-first by decision — see §7.
> Two halves: §1–§6 are a faithful read of the source. §5.11–§5.14 and §7 are the RikuOS layer, built from the source's parts.

---

## 0. How to use this file

This is a reference, not a spec to implement literally. When building any RikuOS surface:

1. Read §1 first. If a design choice contradicts one of those five ideas, the choice is wrong even if it matches a token.
2. Take tokens from §2 and §3 verbatim.
3. Take component anatomy from §5 as written. **Build desktop-first** — do not add responsive behaviour that isn't specified; §7.1 lists what will need a mobile pass later.
4. Check the build against §6 before calling it done.
5. Items in §7 marked **SETTLED** are safe to build against. Items marked **OPEN** are not — raise them rather than inventing an answer.

---

## 1. The five governing ideas

**1. Every number has a hue, and the hue never moves.**
Orange = money leaving. Green = money or time saved. Violet = judgement (ROI, decisions, insight). Blue = sessions and activity. Amber = ageing/stale. Red = missing or in conflict. The palette becomes readable in about four seconds and after that the whole app can be scanned by color alone. This is the highest-value thing in the entire design.

**2. Sections announce themselves twice.**
A tiny letterspaced mono label (`LIVE USAGE`) above a normal-weight sentence-case heading (`Plan limits & windows`). The label is the machine's name for the section; the heading is the human one. It repeats down every page without exception and it is what makes a long scroll feel indexed rather than endless.

**3. The chrome is silent so the data can shout.**
Sidebar, top bar, nav and labels are all near-monochrome, small, low contrast. Then one figure jumps to 34–40px display weight in a saturated hue. Exactly one loud thing per card, roughly three per screen.

**4. Cards earn their borders.**
Only real objects get a border and a radius: a stat, a provider, a skill, an integration. Rows inside a list are separated by a hairline, not boxed. Nothing nests more than one card deep.

**5. Decoration is data-shaped.**
The orange wash behind spend is a topographic reading of that spend. The green swoop is the savings curve. The constellation is the actual memory graph. Nothing exists purely to look expensive — which is why it looks expensive.

---

## 2. Color tokens

### Ground & structure

| Token | Hex | Use |
|---|---|---|
| `--void` | `#08090B` | Page ground. Cool near-black, not neutral. |
| `--panel` | `#0E1013` | Section wells, graph frames. |
| `--raised` | `#14171C` | Cards. One step up from panel, never two. |
| `--sunk` | `#050608` | Recessed wells, control tracks. |
| `--line` | `#1D222A` | 1px hairlines. Every card edge. |
| `--line-soft` | `#15191F` | Row dividers inside a card or list. |

### Ink

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#E9ECF0` | Headings, figures, card titles. |
| `--ink-2` | `#98A1AD` | Body copy, list items. |
| `--ink-3` | `#5B6470` | Captions, inactive nav, eyebrows. |
| `--ink-4` | `#3A424C` | Mono micro-labels, meta, dividers in text. |

### Semantic hues — meaning is fixed

| Token | Hex | Means |
|---|---|---|
| `--spend` | `#FF8A3D` | Money out, limits consumed, the brand mark. |
| `--save` | `#35D399` | Value recovered, healthy, connected. |
| `--roi` | `#A78BFA` | ROI, decisions, overnight insight. |
| `--session` | `#5FA5FA` | Activity, runs, workflow chains. |
| `--stale` | `#FBBF24` | Ageing data, idle agents. |
| `--missing` | `#F87171` | Conflicts, gaps, over-limit. |
| `--skill` | `#F472B6` | Skill nodes in the graph (graph-only). |

*One recorded exception: the Personal page's hero tile carries a background tint that ramps from `--save` through `--spend` to `--missing` with the day's pending-task count. This is a page-local reading of those hues **as a wash**; their fixed meanings in ink, on dots and on row borders are untouched, and no other surface may take a semantic hue as a wash without its own ruling. See P10 round 5, R79–R84.*

### Alpha ladder

- `100%` — figures, glyphs, graph node cores
- `~30%` — glow around a status dot
- `~20%` — card borders on hued cards
- `~8–9%` — card fills, chip backgrounds

### Card tint recipe

Hued cards are **not** a flat wash. They are a `155deg` gradient from a deep desaturated version of the hue into the neutral card color at ~62%:

```css
.stat.spend { background: linear-gradient(155deg, #2A1408, #141013 62%); border-color: rgba(255,138,61,.2); }
.stat.save  { background: linear-gradient(155deg, #052620, #0F1417 62%); border-color: rgba(53,211,153,.2); }
.stat.roi   { background: linear-gradient(155deg, #171233, #111117 62%); border-color: rgba(167,139,250,.2); }
```

### Never

- Two hues inside one card.
- A hue used decoratively where it does not carry its assigned meaning.
- Glow on text. Glow belongs to graph nodes and status dots only.

---

## 3. Type & space

### Roles

| Role | Face in the rebuild | Notes |
|---|---|---|
| Display | Archivo 600/700 | Figures and headings. Any well-cut grotesque works. |
| Body | IBM Plex Sans 400/500/600 | Anything read as a sentence. |
| Mono | JetBrains Mono 400/500/700 | All labelling. **This is the part that must stay** — the mono is what makes the app read as an instrument rather than a website. |

### Scale

| Role | Spec | Example |
|---|---|---|
| Figure | display 700 · 34px · `-0.03em` · tabular | `$174.40` |
| Page title | display 600 · 24px · `-0.02em` | `Today at a glance` |
| Section head | display 600 · 19px · `-0.015em` | `Plan limits & windows` |
| Card title | body 600 · 13px | `Deep Research` |
| Body | body 400 · 13px · `--ink-2` | `Drag to rotate. Hover a node…` |
| Eyebrow | mono 500 · 9.5px · `0.18em` · uppercase · `--ink-3` | `LIVE USAGE` |
| Micro-label | mono 400 · 8.5px · `0.15em` · uppercase · `--ink-4` | `ANTHROPIC · OAUTH` |
| Meta | body 400 · 10.5px · `--ink-3` | `last 28 days · 40.7M in · 3.5M out` |

### Spacing scale

`4 / 6 / 10 / 14 / 20 / 28 / 44 / 72`

- Card padding: 14–16px
- Gap between cards in a row: 12–14px
- Gap between sections: 44–72px
- Eyebrow → heading: 5px. Heading → content: 20px.

### Radii

| Radius | Applied to |
|---|---|
| `6px` | Tags (they're labels, not controls) |
| `7–8px` | Nav items, small chips, brand tiles |
| `10px` | Plain cards (provider, integration) |
| `14px` | Feature cards (stat hero, skill, insight) |
| `999px` | Pills, status, progress tracks |

### Numerals

`font-variant-numeric: tabular-nums` on every figure, every progress readout, every column of digits. Non-negotiable.

---

## 4. Shell

```
┌──────────┬──────────────────────────────────────────────┐
│  rail    │  topbar (44px, hairline bottom)              │
│  ~170px  ├──────────────────────────────────────────────┤
│  fixed   │                                              │
│          │  single scrolling content column             │
│  logo    │  sections stacked 44–72px apart              │
│  nav     │                                              │
│  AGENTS  │                                              │
└──────────┴──────────────────────────────────────────────┘
```

**Rail** — ~170px fixed. Logo tile 20–30px at 6–9px radius, orange gradient, sunburst glyph. Nav items `6px 9px` padding, 7px radius, 11.5–13px text in `--ink-3`. The active item gets a raised fill (`#171B21`) **plus an inset hairline** — never a left accent bar.

**Agents block** — separated by a mono group label (`AGENTS`), then hue-coded badge cards in uppercase mono, each with a tinted gradient fill and a matching border. This is the move worth stealing: background workers are not pages, so they must not look like nav.

**Top bar** — breadcrumb (`Operator / jackroberts`) → live daemon status pill → search field with `⌘K` pushed right with `margin-left:auto` → notification and theme icon buttons. One row, ~44px, hairline bottom, no shadow.

**Content** — single column, generous side padding, no secondary sidebar anywhere, ever.

---

## 5. Components

### 5.1 Section rhythm

```
LIVE USAGE                    ← mono, uppercase, 0.18em, --ink-3
Plan limits & windows         ← display 600, sentence case
```

Headings are **possessive and addressed to the operator** — "*Your* skills", "plugged into *your* operator". Never a noun phrase like "Skill management".

### 5.2 Stat hero cards

Three across, three hues, three *different* graphic treatments.

- **Anatomy** — icon + mono label + optional `DETAILS ↗` on one line → figure pushed to the bottom with `margin-top:auto` → meta caption under it. Graphic bleeds to the lower edges at `z-index:1`, content sits at `z-index:2`.
- **Figure** — display 700, 34px, `-0.03em`, tabular, in the card's hue. **Exception:** ROI spends its hue on the graphic, so the figure goes near-white to stay the headline.
- **Graphic** — spend gets stacked topographic contours; savings gets a filled area with an emphasised endpoint dot; ROI gets a single wide-stroke swoosh. Different shapes for different kinds of number. Do not give all three the same sparkline.
- **Height** — fixed `min-height` so the row stays even. These read as a set.

### 5.3 Controls

Two segmented patterns, two jobs:

- **View switch** (`SUBSCRIPTION | TOKENS · API-EQUIVALENT`) — recessed track with a hairline border; active tab is a raised fill. Left-aligned, directly under the heading it modifies.
- **Time range** (`TODAY / 7 DAYS / 28 DAYS`) — no track at all. Active item inverts to a **solid white pill with dark text** — the strongest contrast anywhere in the UI, correctly so, because it silently reframes every number on the page.

Both: mono, uppercase, ~0.13em, 9.5px.

### 5.4 Provider cards

Flattest card in the system. 28px brand tile at 8px radius → name at 12.5px/600 with a mono micro-label under it → price pushed right, figure over unit. Neutral fill, no hue: these are inventory, not insight. Empty value is an em-dash with the unit label retained, never "N/A" or `0`.

### 5.5 Usage rows

The densest and best-designed thing in the app. Grid: `64px | 176px | 1fr`.

- **Ring** — 52px, 4px stroke, rotated `-90deg`, round caps, percentage centred inside in display weight. Track `#1A1E25`. **At 0% the number goes `--ink-3` rather than the hue** — nothing is happening, so nothing lights up.
- **Identity** — 19px provider icon + name (13px/600), plan name (10.5px, `--ink-3`), then a small outlined mono chip (`OAUTH` / `API KEY`).
- **Bar line** — window name in mono caps → `used / limit` with the used half in body weight → reset countdown (`⏱ 4h 22m`) and percentage pushed right. A 4px track sits under it. **Over-limit fills to 100% and keeps its hue; it does not turn red.**

Why it works: a limit has three facts — how full, how long until reset, and against what. Most dashboards show one. This shows all three in a row under 76px tall.

### 5.6 Skill cards

The one place the app allows itself real color.

- **Cap** — ~74px, a two- or three-stop gradient unique per skill, a 34px glass chip centred (`rgba(10,10,14,.42)` + `backdrop-filter: blur(7px)` + inset white hairline), and a live dot top-right.
- **Body order** (identical on every card, so the row scans as columns): name → recency → value in green display weight → hairline → two mono-labelled stats (`USED`, `~PER RUN`).
- **Honesty note** — "Time-per-run is AI-estimated. Click any card to edit on the Skills tab." sits directly under the cards. Worth copying: it buys the panel credibility instead of undermining it.
- **Overflow** — rows cap at 3–4 with a `SHOW ALL 10` pill right-aligned beneath, plus an `All skills ↗` text link above. Two exits, two different intents.

### 5.7 Insight card

The agentic part made visible: the system proposes, shows its reasoning, offers two ways out.

- **Ground** — a violet gradient panel; the only place a whole section is tinted, because it's the only place the system speaks rather than reports.
- **Layout** — illustration left (~210px), argument right, actions bottom-right, dot pagination far right.
- **Argument** — three bullets maximum, each a countable observation with a real number in it. No adjectives. This is what separates a suggestion from a nag.
- **Actions** — dismiss is a neutral outline pill; accept is outlined in green. **Neither is a solid button** — the system is proposing, not demanding.
- **Queue** — dot pagination; the current dot elongates into a bar. Tells you how many are waiting without a count.

### 5.8 Memory graph

- **Render** — canvas, true black ground, additive glow: a wide low-alpha halo under a small solid core. Edges 1px at 6–12% warm white, drawn as quadratic curves rather than straight lines. Node radius encodes importance, hue encodes type.
- **Floating panels** — `rgba(6,7,9,.6)` + `blur(8px)` + hairline, 10px radius, inset 14px from the corners. Legend top-left, live signals top-right. Never solid — the graph must show through.
- **Signals** — colored dot → bold one-line title → muted meta. The dot uses the same node hue, so a stale signal and a stale node are the same amber. That link is the point.
- **Stat strip** — inline counts sealing the bottom, figure in display weight, label in `--ink-3`. Only the *problem* counts take a hue; a healthy strip is entirely white on black.

### 5.9 Integration cards

White brand tile (8px radius, 28px) → name → `● connected` in 4px green with a **lowercase** word. Lowercase matters: it's an ambient state, not a label, so it does not get the mono-caps treatment. Brand logos stay on their own ground rather than being tinted to the palette — these are foreign objects and should look it.

### 5.10 Buttons & tags

- **Pill** — `8px 14px` padding, fully rounded, 1px `--line` border, mono 9.5px at 0.14em uppercase. Hover lifts the border to `--ink-4` and the label to `--ink`.
- **Affirmative** — green border at 40% with a pale green label. **Never a solid green button.**
- **Solid fills** — rationed to at most one per screen, reserved for the control that reframes everything else (the time range).
- **Tags** — 6px radius, not pills. The last tag in a set fills solid in the group's hue with dark text; that's how the eye finds the punchline of the row.
- **Status pill** — hue at 8% fill, 20% border, 5px dot with a matching `box-shadow` glow, sentence-case label.

---

## 5.11 Calendar with toggleable layers *(RikuOS layer)*

The graph legend made interactive, beside a month grid.

**The colour rule — read this first.** Layer colours would normally collide with the semantic palette. They don't, because each layer takes the hue of what it *means*:

| Layer | Hue | Why |
|---|---|---|
| Freelance | `--spend` orange | It's money work |
| Classes | `--session` blue | They're sessions |
| Workouts | `--save` green | The healthy state |
| Deadlines | `--missing` red | A missed one is a conflict |
| Personal | `--roi` violet | Judgement / discretionary |

No new colour language was invented. If a sixth layer appears, assign it by meaning or don't colour it.

- **Toggle** — 26×15px pill, track `#141820` with a hairline. On: border and knob take the layer hue via `currentColor`. Off: the whole row drops to 35% opacity including its dot, so the list still reads as a legend.
- **Day cell** — 78px min, 8px radius, `--line-soft` border. **Today reuses the exact active-nav treatment** — raised fill `#171B21` plus inset hairline. Not a coloured ring, not a filled circle.
- **Event chip** — 2px left border in the layer hue, 9% fill, text in a lightened hue. Two chips max per cell, then a mono `+2 more`. 3px radius — labels, not pills.
- **Adjacent months** — dimmed to 34%, never hidden, so the grid keeps its shape.
- **Views** — `MONTH / WEEK / AGENDA` using the floating range switch (§5.3), right-aligned in the calendar header.

## 5.12 Outreach pipeline *(RikuOS layer)*

This is the usage row (§5.5) wearing different clothes. A lead is a thing with a cadence, a limit and a state — structurally identical to a plan window, so it gets the same row grammar.

- **Grid** — `1fr | 118px | 148px | 92px` — identity, cadence, state, recency. Hairline between rows, no boxes.
- **Cadence strip** — three 17×4px bars, one per Mon/Wed/Fri touch. Empty `#1A1E25` → sent `--ink-4` → opened `--session` → replied `--save`. Reads left to right without a legend; the mono `3/3` is the fallback.
- **State tag** — outline by default. **Only `BOOKED` fills solid** — terminal success, the one thing you scan for. `COLD` takes amber, same idea as a stale memory node: still there, no longer fresh.
- **Summary strip** — the graph stat strip (§5.8) reused verbatim, flush to the bottom of the panel. Only meaningful counts take a hue.
- **Why not cards** — a lead list is scanned down a column, not compared side by side. Cards would force a width and break the alignment that makes the cadence strip readable.

## 5.13 Academics module counter *(RikuOS layer)*

A skill card with the gradient cap removed and a segmented counter in its place.

- **Ticks, not a bar** — one segment per module, 5px tall, 3px gaps. A bar gives a proportion; ticks give a **count**, which is what you want when the denominator is 9 or 12. Countable to ~16 segments; past that use a bar.
- **Hue from state** — green on track, amber behind, red at risk. Derived from progress against the next deadline, **not** a per-course colour. Same semantic palette, no new meanings.
- **Figure** — display 700 at 26px, a step down from the stat hero because this is a section-level number. Denominator in body weight beside it.
- **Foot** — two facts only: what you have (reviewers) and what's coming (next due). A finished course says `complete` rather than a date so the row doesn't look broken.

## 5.14 Empty & first-run states *(RikuOS layer)*

The source only ever shows a full, healthy dashboard. Day-one RikuOS is empty, and an undesigned empty version of this system reads as broken rather than new.

1. **The container never disappears.** An empty stat card is still a card, same height, same grid position. If containers vanish when empty, the layout jumps when data arrives — and the page teaches the user nothing about what will live there.
2. **Hue drains, structure stays.** Colour means "there is a signal here." No data means no signal: labels and figures fall to `--ink-4`, hued backgrounds revert to the plain card fill. Border and radius unchanged.
3. **Em-dash, never zero.** A zero is a measurement (you used nothing). An em-dash means nothing was measured. Confusing the two in a dashboard is a correctness bug, not a style choice.
4. **One action per empty component, maximum.** An outline pill, the same one used everywhere. Never a solid CTA, never two options, never an illustration.
5. **First run is a banner, not a state.** Before anything is connected every card would be empty, and six identical "connect something" prompts is noise. One banner at the top of the page in the brand hue with a single action; the cards below sit quiet.

---

## 6. Build checklist

**Hold**

- [ ] One loud figure per card, one hue per card
- [ ] Mono caps for anything the system names; sentence case for anything addressed to the person
- [ ] Headings address the operator directly — "your skills"
- [ ] Hairlines between rows; borders only around real objects
- [ ] `tabular-nums` everywhere a digit repeats
- [ ] Estimated numbers say so, right under them
- [ ] Background agents get their own visual class, apart from navigation

**Avoid**

- [ ] Boxing every row — it flattens the hierarchy the hairlines create
- [ ] The same sparkline on every stat card
- [ ] Solid accent-colored buttons
- [ ] A hue used decoratively once it carries a meaning
- [ ] Left accent bars on cards
- [ ] Glow on text
- [ ] A second sidebar

---

## 7. Decisions

### 7.1 Desktop first, mobile as a later pass — **SETTLED**

Build at desktop width against this system as documented. No mobile specimens, no responsive hedging. The debt this takes on, precisely:

| Component | At 390px |
|---|---|
| Stat heroes | Reflows on its own — already `auto-fit / minmax`. No work. |
| Skill & provider cards | Reflows cleanly. No work. |
| Integrations, tags, buttons | Reflows cleanly. No work. |
| Course cards | Reflows; ticks compress but stay countable to ~12 modules. |
| **Usage rows** | `64px \| 176px \| 1fr` — three encodings side by side. Ring and identity must stack above the bars. |
| **Outreach pipeline** | Four columns. Cadence strip and state tag must move under the business name. |
| **App shell** | 170px fixed rail has no mobile form — bottom tabs or a sheet, decided later. |
| **Insight card** | `210px \| 1fr` — illustration must go above the argument. |
| **Memory graph** | Two floating panels over a 250px canvas will overlap. |
| **Calendar** | A 7-column month grid does not fit. Mobile likely defaults to the agenda view. |

Six components need real work, and five of them are the same fix: a fixed multi-column grid becoming a stack.

### 7.2 One semantic palette across all four life pages — **SETTLED**

No per-page accent hues. Orange, green, violet, blue, amber and red keep fixed meanings everywhere; pages are told apart by content and heading, not colour. This preserves the four-second readability that makes the source work, and it is why the calendar layers could be coloured at all without a second colour language.

### 7.3 Content and page structure live outside this document — **SETTLED**

Sections, page inventory and data shapes are specified elsewhere for Claude Code. This file governs how things look and behave, not what is rendered. Where the two disagree, the content spec wins.

### 7.4 What the three hero figures are — **OPEN**

The source opens on money spent / money saved / net ROI — three numbers that exist only because it's an AI-cost tracker. RikuOS needs its own three: the figures worth seeing first thing in the morning, across freelance, academics and personal. Until named, the hero row is a shape with nothing in it.

### 7.5 Where the agents block goes — **OPEN**

The source rail separates background agents from navigation — the single best structural idea in it. RikuOS has real background work (outreach sweeps, calendar sync, Canvas pulls) but no decision on whether those surface as named agents in the rail, as a status row, or not at all.

---

*§1–§6 are rebuilt from four frames of the source video; §5.11–§5.14 and §7 are original work built from its parts. Every specimen in `components.html` is hand-written HTML and CSS — no assets were taken from the video. Sample data throughout is illustrative. Reference only.*
