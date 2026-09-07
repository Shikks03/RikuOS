# P8 — The Freelance page: visual design and build spec

**Date:** 2026-09-07 · **Status:** ratified by Riku 2026-09-07. This is the document P8 is planned and executed from.
**Repo:** RikuOS · **Phase:** P8 in `docs/ROADMAP.md`, with P9 folded into it by decision S17.

**The four companions, and no others.** A builder holding this file plus these four needs nothing else — not the round papers in `docs/superpowers/design/p8-team/`, not the conversation that produced them.

| File | What it is for |
|---|---|
| `docs/superpowers/specs/2026-09-05-p8-freelance-page-content.md` | The content deck. **The authority on every string.** Where this file quotes a deck string it quotes it exactly; if the two ever differ, the deck wins. |
| `docs/superpowers/specs/2026-09-05-p8-freelance-page-design.md` | Why the page is shaped this way — decisions D1–D8, the data model, the failure rules, the cross-repo contract proposal. |
| `docs/design/DESIGN-INSPO.md` | The design system. Tokens §2, type §3, shell §4, components §5, build checklist §6, decisions §7. |
| `docs/design/p8-mockup.html` | The page drawn at desktop width in honest production CSS, sectioned `tokens / base / components / legacy / mockup-only`. **The first four sections are what the build ports.** Where prose here is ambiguous, the mockup is the truth. |

**Two things in the mockup that ship nowhere.** Specimen 03's variant B (the mark field on the drafts card) and its `.stat .marks` rule — Riku chose the plain row. And everything below the `mockup-only` comment: document chrome, frames, captions, the specimen furniture.

This file records decisions. It does not re-argue them.

---

## 1. Scope

### What P8 ships

1. **The app shell** — a 170px rail (brand tile, wordmark, three nav items, an `AGENTS` group, `Log out` in the foot) and a 44px top bar carrying one freshness stamp. It wraps `/queue`, `/settings` and `/freelance`. `/login` gets no shell.
2. **The agents block in the rail** — six badges in fixed execution order, six states, read from the last `AgentRun` record per agent plus the two switches in `OsSettings`.
3. **`/freelance`** — the whole page, blocks A to F, on live ShikksTracker data, in every state the deck specifies.
4. **A global re-skin of `/queue`, `/settings` and `/login`** through the stylesheet only, plus one ruled TSX exception: the inline header on `/queue` and `/settings` is deleted.
5. **A stored site-health reading** — a `HealthSnapshot` singleton written by the existing morning cron, read by Block F, refreshable by `Check now`.
6. **Fonts, manifest, viewport and icons** — three faces through `next/font/google`, the dark splash and status bar, the brand tile as the app icon.

### What P8 does not ship

- **The money-in card and its log.** A fourth hero card and the freelance money-in record are a later phase. The hero row is built so it can take a fourth card without moving (§5.4).
- **The phone pass.** Desktop only, by Riku's decision 1 of 2026-09-06 and `DESIGN-INSPO.md` §7.1. No media queries, no responsive hedging, no mobile specimens. The debt is listed in §10.
- **`Sending is off`** (the deck's line A4). **Blocked on a ShikksTracker contract gap:** `GET /api/os/summary` does not return `sendingEnabled`, the fact lives in ShikksTracker's own `Settings`, and the prime directive forbids fixing that from this repo. The proposal is already written in the P8 design doc under "Cross-repo contract — one proposal, not a change". Until it lands the line renders **nothing** — no drained slot, no placeholder, and nothing infers the switch state from behaviour.
- **Anything from the reference with no data behind it.** No cadence strip, no state tags, no `21% reply rate`, no sparkline on any hero card, no search field, no theme toggle, no notification bell, no first-run banner, no `Refresh` control, no reachability or push-registration pill, no second sidebar, and no action on any lead anywhere on the page.

---

## 2. The decisions this rests on

Recorded as **S18** in `ARCHITECTURE.md` §7. Do not relitigate any of them without a new decision there.

**Riku's five calls, 2026-09-06:**

1. **Desktop first.** Built at desktop width against the design system as documented; the phone pass is a later phase.
2. **Three real hero numbers, no placeholder.** The hero row carries only figures the system actually holds.
3. **The agents block goes in the rail, driven by run records.** This closes `DESIGN-INSPO.md` §7.5, which was OPEN.
4. **`/queue`, `/settings` and `/login` are re-skinned through the global stylesheet only** — and, by his answer of 2026-09-07, their inline headers are deleted.
5. **Dark only.** No light theme, no `prefers-color-scheme` block, no `[data-theme]` attribute anywhere.

**Riku's four answers, 2026-09-07, after reviewing the mockup:**

- **Hero graphics: plain.** No mark field. The only graphic on the row is the 4px proportion track on the contacts card.
- **The health strip's warning marker: the glowing dot.** `⚠` appears nowhere in the app.
- **The duplicated inline headers on `/queue` and `/settings`: delete.** The one TSX exception, and it is bounded to those two elements.
- **All five new strings accepted as written:** `ShikksTracker didn't report how many are hot.` · `ShikksTracker didn't report every pipeline stage.` · `sites not checked since 2d ago` · `Rates are computed over small numbers of sends.` · the column header `Campaign`.

**Two lead rulings offered as overturnable that Riku let stand:**

- **The top bar carries the freshness stamp and nothing else.** No breadcrumb. `Operator` named nobody in a system with exactly one user and was the bar's brightest element; the crumb's page name restated the page title 70px below it.
- **The rail's six green badges are the page's largest colour mass, and that is accepted.** If it ever reads loud, the amendment is to the badge rule (`ok` → grey label with a green border only), never a one-page tweak.

---

## 3. The shell

Written once, above the pages, so adding `/personal` later is a folder plus one entry in the nav array.

### 3.1 Rail anatomy

`.app-side` — 170px, ground `#0B0D11`, right border `--line-soft`, padding `16px 12px`, `display:flex; flex-direction:column; gap:16px`.

- **Brand.** A 24px tile at 7px radius, `linear-gradient(150deg,#FF9E5C,#F2622B)`, holding a 14px sunburst glyph filled `#2A1002`. **Never a letterform** — the product name may change and a monogram would have to change with it. Beside it the wordmark: display 600 / 13px / `-0.01em` / `--ink`, from `APP_NAME`, with `overflow-wrap:anywhere` and `min-width:0` so nothing assumes its length.
- **Nav.** Two items — **Freelance, Settings** — each a 13px hand-drawn stroke glyph plus a 12.5px label at `--ink-3`, padding `6px 9px`, radius 7px, gap 9px. **Both carry a glyph or neither does; never a mix.** The active item takes a raised fill `#171B21`, an `--ink` label, and an **inset hairline** (`box-shadow: inset 0 0 0 1px var(--line)`) — never a left accent bar.

  **The rail marks Freelance active on both Freelance views.** `NavList` matches `.is-active` with `pathname === href || pathname.startsWith(href + "/")`, so `/freelance/queue` lights Freelance.

  **`aria-current="page"` does not follow that match; it uses equality (R44).** The class follows the **area** — the rail names an area, and Freelance must stay lit on the Queue view. ARIA defines `page` as "the current page within a set of pages", and on `/freelance/queue` the rail's Freelance link points at a *different* URL; without the split, that link and the switch's Queue link would both claim to be the current page on one screen. On `/freelance` the rail's Freelance link and the switch's Dashboard link both carry it and both are right — ARIA's one-per-set rule is per `<nav>` (R46). **The view switch (§3.4) matches by equality for both**, because on the switch the area and the page are the same thing.
- **Agents group.** A mono group label reading `Agents`, uppercased by CSS: mono 8.5px / `0.16em` / `--ink-4`, padding `0 9px`. Then the badges (§3.2).
- **Foot.** `Log out`, pushed down with `margin-top:auto`, styled `.btn.ghost` at 11.5px / `0.1em` / **`--ink-3`, not `--ink-4`** — it is the app's only sign-out control and it must be legible.

`/login` renders none of this. It sits outside the route group.

### 3.2 The agents block

**Six badges, fixed execution order, kebab names uppercased by CSS:**

`CHASER · EXPIRY-SWEEP · WATCHDOG · SITE-HEALTH · OUTREACH-HEALTH · DISPATCHER`

**They come from a hand-written `RAIL_AGENTS` constant *(new)*, not from an existing list, for two separate reasons.** The `AGENTS` enum in `src/models/AgentRun.ts` contains `lead-sweep`, `triage` and `retro` — three agents that do not exist, so the rail would show three permanent ghosts. And `EXPECTATIONS` in `src/lib/watchdog.ts` deliberately omits `watchdog` — it is running, which is the proof — an absence that file documents in its header and `src/lib/__tests__/watchdog.test.ts` pins. So `RAIL_AGENTS` is a six-row superset declared beside `EXPECTATIONS`, and `EXPECTATIONS` is not touched.

**The threshold is exported once.** `AGENT_STALE_HOURS` *(new)* in `src/lib/watchdog.ts` = `24 + 6` = 30, the `everyHours + graceHours` every expectation row already carries. Both consumers read it: the rail's overdue rule here, and Block F's 30-hour site-snapshot rule (§4.6). Two hardcoded `30`s in two files is how they drift apart.

**The states.** Derived from the last run record **and** the switches in `OsSettings`, passed in as an argument.

| State | Rule | Badge | Caption (mono 8.5px `--ink-4`) |
|---|---|---|---|
| off | `chaserEnabled` false (chaser) · `monitoringEnabled` false (watchdog, site-health, outreach-health, dispatcher) · **expiry-sweep is never off** | grey, plain | `off` |
| never run | no run record for that agent | grey, plain | `never run` |
| unknown | the database read failed | grey, plain | `—` |
| failed | last run `ok: false`, or `itemsFailed > 0` | red, tinted gradient | `failed` / `2 items failed` |
| overdue | age > `AGENT_STALE_HOURS` | amber, tinted gradient | `last ran 41h ago` |
| ok | otherwise | green label, thin green border, **no tinted fill** | none |

Captions appear on grey, amber and red. **Green carries none — the hue is the whole message.** No click, no hover, no title tooltip.

**Why the switches must be an argument and never sniffed.** `runJob` writes an `ok: true` placeholder run for a switched-off agent, with the reason in the run's note string, so a derivation reading only run records paints a switched-off chaser green. The note string is prose and must never be parsed; the two booleans are read from `OsSettings` in the same `try/catch` as the run records and handed to the pure function.

**`unknown` is not produced by the pure function.** It is what the layout's catch block renders when the database read throws: six grey badges captioned `—`. The derivation never sees a failure, so it can never report one.

**Precedence: off → never run → overdue → failed → ok.** `classifyAgentRun` keeps `evaluateWatchdog`'s existing order — never ran, then stale, then failed, then degraded — because a stale run's `ok` flag describes a run from *before* the outage, so reporting `failed` would point at the wrong problem. That reason is already written in `watchdog.ts`, the existing tests pin it, and the rail must not disagree with the digest about the same agent. `off` is checked ahead of all of it.

**Badge visual.** `.agent` — mono 10px / 700 / `0.08em` / uppercase, padding `8px 9px`, radius 8px, ground `#12151A`, border `--line`, label `--ink-4`. Then:

- `.is-ok` — label `--save`, border `rgba(53,211,153,.18)`, **no fill**.
- `.is-overdue` — label `--stale`, border `rgba(251,191,36,.22)`, fill `linear-gradient(180deg,rgba(251,191,36,.09),rgba(251,191,36,.02))`.
- `.is-failed` — label `--missing`, border `rgba(248,113,113,.22)`, fill `linear-gradient(180deg,rgba(248,113,113,.14),rgba(248,113,113,.03))`. **The heavier fill is deliberate:** amber is intrinsically brighter than red, so at equal alpha the merely-late agent outshouts the broken one.
- `.is-grey` — label `--ink-4`, border `--line`, **inheriting `.agent`'s ground**. A dead agent must never sit brighter than a live one.

### 3.3 Top bar

`.topbar` — 44px, `border-bottom: 1px solid var(--line-soft)`, horizontal padding 28px, holding an inner column (`.topbar-in`) capped at `--content-max` and centred, so the bar's content aligns to the same left edge as the page below it.

**It carries one element: the freshness stamp.** `read 14:32`, inside `.crumb > em`, which renders at `--ink-4`, 11.5px, tabular. **Formatted in `Asia/Manila`** — a server render on Vercel is UTC and would be eight hours wrong. Use `Intl.DateTimeFormat` with `{ timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false }`.

**The shell renders it on every page**, from the request time. On a `force-dynamic` page that is the moment the data was read, which is exactly what the stamp claims. `/queue` and `/settings` carry the same stamp and nothing else.

No breadcrumb. No pill of any kind — not ShikksTracker reachability (it claims a liveness true only at the instant of render), not push registration (client-only, and it duplicates a control that already lives on the queue page), not a pending-approvals count (two "waiting on you" numbers from two systems on one screen). No search, no bell, no theme toggle.

### 3.4 The Freelance header and the view switch

A `freelance` segment layout renders the page header above **both** views. It renders **no `<main>`**: `/freelance` brings its own `<main class="app-content">` and `/freelance/queue` brings `legacy.css`'s `<main>`, and two `<main>` elements in one document is invalid HTML.

```
<div class="fl-head">          padding 28px 28px 0
  <div class="fl">             the same 920px column both views use
    <h1 class="fl-title">Freelance</h1>
    <nav class="segmented" aria-label="Freelance views">
      <a href="/freelance"       class="on" aria-current="page">Dashboard</a>
      <a href="/freelance/queue">Queue</a>
    </nav>
  </div>
</div>
{the view}
```

#### The switch is two links, not a tablist

**Links, because they are two URLs.** `role="tablist"` describes panels swapped in place: no address change, `aria-controls` pointing at a panel in the same document, and roving-tabindex arrow-key behaviour the author must implement. These are two real routes. They are deep-linkable, back-button-able, right-click-openable, and one of them (`/freelance/queue`) is the target of every push notification the app sends. Announcing them as tabs would describe an interaction model the page does not have, and would be *worse* than plain links unless the arrow-key behaviour were also built — which would be client code written to make a lie consistent.

**`<nav>`, with an accessible name.** R40 left the document's single `<nav>` unnamed on the grounds that it was the only one. A-2 makes it not the only one, so the new landmark is named `aria-label="Freelance views"` — **and the rail's `<nav>` is named `aria-label="Main"` in the same commit**, because two unnamed navigation landmarks announce as "navigation" and "navigation" (ruled).

**`aria-current="page"`** on the active link, and `class="on"` as the styling hook. The switch computes both from the same equality test; the rail does not (R44, §3.1).

**Active is exact equality, never `startsWith`.** `/freelance` is a prefix of `/freelance/queue`, so `startsWith` would light **both** tabs on the Queue view. The rail uses `startsWith` for `.is-active` precisely so Freelance stays lit there, and equality for its `aria-current` (R44). **The class rules are deliberately opposite and each file says so.** (A future `/freelance/queue/:id` would light neither tab; there is no such route, and it is one line to change when there is.)

#### The switch's CSS — ported, with the source quoted

Source, `docs/design/components.html` lines 261–267, verbatim:

```css
/* segmented + range controls */
.segmented{display:inline-flex;background:#101318;border:1px solid var(--line);border-radius:9px;padding:3px;gap:3px}
.segmented button{
  font-family:var(--mono);font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;
  background:none;border:0;color:var(--ink-3);padding:6px 12px;border-radius:6px;cursor:pointer;
}
.segmented button.on{background:#1D222A;color:var(--ink)}
```

Its markup, lines 868–872:

```html
<p class="caption" style="margin-bottom:12px">View switch &mdash; recessed</p>
<div class="segmented">
  <button class="on" type="button">Subscription</button>
  <button type="button">Tokens &middot; API-equivalent</button>
</div>
```

Its note, line 885, and `DESIGN-INSPO.md` §5.3 line 197 in the same words:

> **View switch** — Sits in a sunken track with a hairline border; the active tab is a raised fill. Left-aligned, directly under the heading it modifies.

and line 887:

> **Both** — Mono, uppercase, ~0.13em tracking, 9.5px. Controls are labelled in the machine's voice; content is labelled in yours.

**Names are the reference's, verbatim** — `.segmented`, `.on` — under `components.css`'s stated rule ("Reference names are kept verbatim … so a recipe can be diffed against `components.html` by eye"). The `fl-` prefix is for vocabulary the reference has no name for (`.fl-title`, `.fl-say`, `.fl-stage`); it is not a "only this page uses it" prefix — `.stat`, `.track`, `.disclose` and `.honesty` are Freelance-only and keep reference names. The reference is internally inconsistent about the active-state hook (`.navitem.is-active`, `.segmented button.on`); both ports follow their own source.

**The active treatment is deliberately not unified with `.navitem.is-active`.** The rail's active item takes a raised fill `#171B21` **plus** an inset hairline, because it stands alone on the rail's flat ground and needs its own edge. The switch's active tab takes a raised fill `#1D222A` and **no** hairline, because it sits inside a track that already has a `--line` border. Making them match would either give the switch a redundant second edge inside a bordered track, or take the rail's edge away and leave a fill floating on `#0B0D11`. The two treatments differ because their containers do.

**The shipped rule**, with the two declarations the element change requires, and one note on a verbatim declaration that does double duty:

```css
.segmented{
  display:inline-flex;background:#101318;border:1px solid var(--line);
  border-radius:9px;padding:3px;gap:3px;margin-top:var(--sp-2);
}
.segmented a{
  font-family:var(--mono);font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;
  background:none;border:0;color:var(--ink-3);padding:6px 12px;border-radius:6px;
  cursor:pointer;line-height:1.4;
}
.segmented a:hover{color:var(--ink)}
.segmented a.on{background:#1D222A;color:var(--ink)}
```

| Declaration | Status |
|---|---|
| track: `display`, `background`, `border`, `border-radius`, `padding`, `gap` | **verbatim** |
| tab: `font-family`, `font-size`, `letter-spacing`, `text-transform`, `background`, `border`, `color`, `padding`, `border-radius`, `cursor` | **verbatim** |
| active: `background:#1D222A`, `color:var(--ink)` | **verbatim** |
| `margin-top:var(--sp-2)` on the track | **derived** — the reference has no heading above it to space from. R43; see the rhythm below. |
| `line-height:1.4` on the tab | **derived, and required by the element change.** A `<button>` takes the UA `font` shorthand's `line-height:normal`, which is font-metric-derived (≈1.3 for JetBrains Mono), so the reference's track is ≈32.5px and this one is ≈33.3px. **1.4 is taken not to match that number** but to stop the track's height depending on the mono's metrics at all, and because it is the line-height `.btn` (`components.css:385`) and `legacy.css`'s bare `button` (`legacy.css:44`) already declare — the switch and the queue's filter pills sit 38px apart and must share it. |
| `.segmented a:hover{color:var(--ink)}` | **derived.** `base.css`'s `a:hover{color:var(--ink)}` is `(0,1,1)` and so is `.segmented a`; at a specificity tie the later stylesheet wins, and `components.css` loads after `base.css`, so the hover would be silently dead. The rail's `.navitem` is `(0,1,0)` and therefore *does* get that hover for free. `--ink` rather than `--ink-2` because **every hover in `components.css` lands on `--ink`** — `.btn:hover` (387), `.app-side .btn.ghost:hover` (107), `.fl-biz:hover` (329), and `base.css`'s `a:hover` (29). The app's one `--ink-2` hover is `legacy.css:49`'s `button.secondary`, in the layer with an expiry date. `.segmented a.on` ties `.segmented a:hover` at `(0,2,1)` and wins on order, so the active tab does not change on hover, which is right. |

**Not ported:** the reference's sibling `.range` (the floating time-range switch). P8 has no time range, and §5.8 forbids declaring vocabulary with no consumer. **It has a named future consumer**: §6.2 records that the queue page's S11 rebuild ports `.range` for the status-filter row.

**Two literals, deliberately not tokens.** `#1D222A` happens to equal `var(--line)`; the reference writes the literal for the *fill* and the token for the *border* because they are two different jobs, exactly as `.navitem.is-active{background:#171B21; box-shadow:inset 0 0 0 1px var(--line)}` does. Tidying the fill into `var(--line)` would tie the raised fill to the hairline colour for ever. `#101318` is now written three times in the app (twice in `legacy.css`'s `input`/autofill rules, once here); R34's note stands — it becomes a token if it ever moves.

**The recess is defined against a ground the app does not have.** `DESIGN-INSPO.md` §2 maps `--sunk` (`#050608`) to "Recessed wells, control tracks", while the reference's own control track is `#101318` — and the drawn file is the truth (spec §"four companions"). But the half of that tension that matters is the **ground**: in `components.html` the switch specimen sits inside `.well{background:var(--sunk)}`, so track-to-ground contrast is Δ(11,13,16). On `/freelance` the switch sits on `--void` `#08090B`, and Δ drops to (8,10,13) — **about a quarter less separation**. The port is byte-faithful and lands ~25% flatter than drawn, with the `--line` hairline doing more of the work. `#101318` is kept, because eye-diffability against `components.html` is the file's stated rule and this is not worth breaking it for. **If it reads as a floating lighter bar rather than a recess, the alternative is `--sunk` for the track, which would make the recess literal — that is a ruling, not a tidy.** Task 4 step 5 item 1 is the check that can fail. Verified live 2026-09-07: the Verifier read the value stack as raised; the lead read it as a housed control in the reference's own grammar; Riku decides on the mockup's seventh specimen, and the `--sunk` alternative stays written in the CSS comment.

`border-radius:9px` on the track is outside the radius set (`--r-tag` 6 · `--r-nav` 7 · `--r-chip` 8 · `--r-card` 10 · `--r-feature` 14 · `--r-pill` 999) and ships as a literal, the same way `.app-brand .tile{border-radius:7px}` and `.track{border-radius:99px}` already do.

**The first label sits 16px in from the track's left edge** (1px border + 3px track padding + 12px tab padding). That is the reference's own construction. **The track's edge, not the label, is what aligns with the title** — worth saying, because zeroing the first tab's left padding to "fix" the alignment would break the track.

**Focus.** `base.css`'s `:focus-visible{outline:2px solid var(--spend);outline-offset:3px;border-radius:3px}`, unchanged and unqualified. Arithmetic: a tab's border box sits 4px inside the track's (1px border + 3px padding), and the ring is drawn 3px outside it and 2px thick, so the ring's outer edge lands ~1px beyond the track and overlaps the neighbouring tab by ~2px. Outlines do not affect layout and nothing here sets `overflow:hidden`, so this is a paint overlap and not a reflow. **The ring rule's `border-radius:3px` would square the tab's corners while focused, except that `:focus-visible` is `(0,1,0)` and `.segmented a` is `(0,1,1)`, so the 6px radius survives** — the kind of thing a later radius tidy would break.

**Hover, active, motion.** Hover as above. No `transition` on the switch — the change of view is a navigation, not an animation, and `prefers-reduced-motion` therefore has nothing to suppress here.

**§5.7 is unchanged.** The switch takes `base.css`'s global focus ring and declares no transition, and `::selection` is untouched. Focus, selection and motion were considered, not skipped.

#### Label text and casing as rendered

The DOM text is **`Dashboard`** and **`Queue`**, sentence case, exactly as R42 names the views and exactly as the reference writes its own markup (`<button class="on">Subscription</button>`). `text-transform:uppercase` renders them **`DASHBOARD`** and **`QUEUE`** in JetBrains Mono at 9.5px / `0.13em`. This is the reference's stated rule for controls — "Controls are labelled in the machine's voice; content is labelled in yours" — and it matches the rail, which also stores sentence-case labels.

#### The vertical rhythm, as numbers

Everything below is a declared value plus the arithmetic that turns it into what the eye sees.

| Gap | Value | Where it comes from |
|---|---|---|
| top bar → title | **28px** | `.fl-head{padding-top:var(--sp-6)}` — the same 28px `main` gave the title before A-2. **The title does not move.** |
| title → switch | **6px** (`--sp-2`) | new, derived (R43); see below |
| switch → the view's first content, **Dashboard** | **28px** | `main.app-content{padding-top:var(--sp-6)}`, with `.fl`'s first child's own top margin zeroed |
| switch → the view's first content, **Queue** | **38px** | `legacy.css`'s `main{padding-top:var(--sp-6)}` **+** the page's first child `.row{margin-top:var(--sp-3)}` |

**Why 6px between the title and the switch (R43).** `DESIGN-INSPO.md` §3 gives two numbers for this region — "Eyebrow → heading: 5px. Heading → content: 20px" — and no number for a control bound to a heading, which is what the switch is. It must read as *belonging to* the title and as clearly closer to it than the view content is to the switch.

**The comparison must be optical against optical.** `.fl-title` is 24px display at `line-height:1.5` (§5.3, and now declared explicitly — see M4 below), so its line box is 36px and roughly 3.9px of half-leading plus ~5.8px of descent sit below the baseline of a word with no descenders: about **9.7px of dead space** under "Freelance" before the declared margin begins. Below the switch there is no leading to add — the line box is exactly `margin-top + 33.3px` (see the next paragraph) — so the 28px below is a **true** 28px of whitespace. The system's own two reference gaps, read the same way: eyebrow → heading is 5px declared ≈ **9px optical** (the bound pair); heading → content is 20px declared ≈ **29px optical**.

At `--sp-3` (10px) the switch sits at ≈19.6px optical against a true 28px — **a ratio of 1.43**, almost exactly the midpoint between the bound pair and the content gap. That is a control floating between its heading and the content, which is not what "**directly** under the heading it modifies" (`DESIGN-INSPO.md:197`, `components.html:885`) describes. At `--sp-2` (6px) it sits at **≈15.6px optical against 28px — a ratio of 1.79**, nearer the eyebrow's 9px than the content's 29px, still on the spacing scale, and clear of the focus ring (the ring's outer edge sits ~1px above the track, leaving ~5px under the title's line box). **6px is the shipped number.** Riku sees it in the mockup's seventh specimen (Task 5) and may overturn it cheaply — it is one token.

**The switch's own height: 33.3px.** Tab text box `9.5 × 1.4 = 13.3px`, plus `6 + 6` padding = 25.3px; plus the track's `3 + 3` padding and `1 + 1` border = **33.3px** (33px in DevTools). Width is shrink-wrapped by `inline-flex` to **≈156px** at these strings.

**The `inline-flex` line box does not leak.** `.segmented` is an atomic inline-level box in an anonymous line box inside `.fl`, whose strut is `body`'s 13px / 1.5 = 19.5px. Per CSS 2.1 §10.8 an atomic inline contributes its **margin box** to the line box, and its baseline is its first flex item's: the anchor's baseline sits ~10.1px into its 13.3px line box, plus 6px tab padding, plus 3px track padding, plus 1px border = **~20.1px above the baseline, ~13.2px below it**. Against the strut's ~13.4px above and ~6.2px below, the switch dominates *below* the baseline (13.2 > 6.2) and, with its 6px top margin, above it (26.1 > 13.4). The strut therefore adds nothing and the line box is exactly `6 + 33.3 = **39.3px**`. Vertical margins on an atomic inline do count toward the line box, so `margin-top` works. The header's total height is `28 + 36 + 6 + 33.3 = **103.3px**`.

**This is a required check, not a contingency** (Task 4 step 5 item 13). `display:inline-flex` is kept — the critic re-derived the line box independently and the port's value is eye-diffability against `components.html`. **The written fallback, if the measurement disagrees, is `display:flex;width:max-content`**: a block-level box with no strut and no dependency on either font's metrics, visually identical, and a marked difference from the reference (`width:max-content` is itself a non-reference declaration, needed only to stop a block-level track spanning 920px).

> The critic derived 43.3px for this line box; that figure was taken at the draft's 10px margin. R43's 6px makes it 39.3px. The check — that the line box equals `margin-top + 33.3px` and nothing more — is unchanged.

**Why the header's `padding-bottom` is 0.** The Queue view's `<main>` is `legacy.css`'s, whose `padding: var(--sp-6) var(--sp-6) var(--sp-8)` also serves `/login` and cannot be changed. So the Queue view's content can never begin less than 28px below the header. Any bottom padding on `.fl-head` is added to *both* views on top of 28px, so it changes the **gap** and not the **difference** — the difference is 10px at any value. `padding-bottom:0` is chosen because it gives the smallest gap, which is what puts the Dashboard's first block at the system's own 28px rather than 28 plus an invented number.

**What the eye will see, and whether the layout compensates.** It does not compensate, deliberately. The Queue view's first control row sits **10px lower** than the Dashboard's first block. That is the same 10px already recorded as carry-forward (5) after Plan A — `/queue`'s first child is a `.row` with `margin-top:var(--sp-3)` and the only ways to remove it are a TSX edit R18 forbids or a rule `legacy.css`'s own header forbids. A-2 does not create the cost; **it does make it more visible**, because the two views are now one click apart instead of one nav item apart, and the switch above them is a fixed reference edge the eye can measure from. At a 28px baseline a 10px difference is about 36% and is perceptible on a fast A/B switch, invisible otherwise. Recorded in §6.2, not fixed; the one CSS-only escape hatch — a rule reaching into the queue page's internals — was refused, because that is the third namespace `components.css` exists to refuse.

#### The header's horizontal column — the arithmetic

Let `A` be the width of `.app-main` (viewport minus the 170px rail track; the rail's right border is inside that track under `box-sizing:border-box`). Four columns must share one left edge (R34):

| Column | Computation | Left edge |
|---|---|---|
| `.topbar` → `.topbar-in` | `padding:0 28px`; inner `width:100%; max-width:920px; margin:0 auto` (auto margins absorb free space in a flex container) | `28 + max(0, (A − 56 − 920) / 2)` |
| `.fl-head` → `.fl` | `padding:28px 28px 0`; `.fl{max-width:920px;margin:0 auto}` | `28 + max(0, (A − 56 − 920) / 2)` |
| `main.app-content` → `.fl` (Dashboard) | `padding:28px 28px 72px; max-width:none`; the same `.fl` | `28 + max(0, (A − 56 − 920) / 2)` |
| `legacy.css` `main` (Queue) | `max-width:calc(920px + 2 × 28px) = 976px; margin:0 auto; padding:28px …` | `max(0, (A − 976) / 2) + 28` |

`A − 976 = A − 56 − 920`, so all four expressions are the same number, and below `A = 976` all four collapse to a flat 28px inset. **The header reuses `.fl` rather than declaring its own 920px column** — that is what makes the alignment true by construction rather than by two rules that must be kept in step. The cost is two `.fl` elements in the Dashboard's document, the header column and the content column, which is honest: they are deliberately the same column.

#### New class names

Exactly two, and both have a consumer in the same commit:

- `.fl-head` — the header's padding shell. New page vocabulary, `fl-` prefixed, because the reference has no name for it.
- `.segmented` / `.segmented a` / `.segmented a.on` — the reference's own names, ported.

Plus one normalisation rule, `.fl > :first-child { margin-top: 0 }`, which declares no vocabulary, and one declaration added to the existing `.fl-title` rule (`line-height:1.5`, M4) — a pin, not a change: the value is what `.fl-title` already inherits, and it is **not** a difference from the mockup and must not be added to `components.css`'s numbered differences list.

**No declared-but-unused vocabulary is added.** The §5.8 list stays `.statstrip`, `.btn.go`, `.statuspill`, `--session` — `.range` is explicitly not ported, and one entry is *removed* from the app (see §5.8 below).

---

## 4. The Freelance page, block by block

Above the page root, the Freelance segment layout renders the title and the view switch (§3.4, R42): `Freelance`, `.fl-title`, display 600 / 24px / `-0.02em`, **no eyebrow above it**, then the switch. Page root: `<main className="app-content">` holding `<div className="fl">` (max-width 920px, centred), whose first child is the hero row — the page itself renders no title.

**Section rhythm, every block below A.** A mono eyebrow — the machine's name for the block, from the deck — above a short heading addressed to the operator:

| Block | Eyebrow | Heading |
|---|---|---|
| B | `Pipeline` | `Your pipeline` |
| C | `Campaigns` | `Your campaigns` |
| D | `Approach performance` | `Your approaches` |
| E | `Needs you` | `Waiting on you` |

Block A has no header. Block F has none. Blocks sit 44px apart (`.fl-sect{margin-top:var(--sp-7)}`); Block F sits 72px down.

**The hue budget for the whole page, as a rule.** Colour appears in exactly four places:

1. the hero figures,
2. the amber waiting line on an overdue follow-up in Block E,
3. the health strip's warnings,
4. the agent badges in the rail.

Everything else is neutral. **No green on `Won`, no green on `Replied`, no green on the best reply rate, no hue on any Block E reason line, no hue on the needs-you count in the heading.** Today's page renders one lit figure and six quiet green words. Orange appears on P8 only on the logo tile — and in the `:focus-visible` ring, which is a reference-level convention rather than a hue spend.

**Three card treatments and two note treatments carry the deck's most important distinction — a measurement is not an absence:**

| Class | Means | Ink |
|---|---|---|
| `.stat.plain` | hueless **with** data (the contacts card) | figure `--ink` |
| `.stat.drained` | a **measured zero** — label and figure drain, **the caption stays `--ink-3`** | `--ink-4`, caption `--ink-3` |
| `.stat.blank` | **nothing was measured** (`—`) — the whole card drains, caption included, because that caption is a "ShikksTracker didn't report…" sentence | all `--ink-4` |
| `.fl-note` | a measured emptiness inside a block | `--ink-3` |
| `.fl-absent` | a field that never arrived | `--ink-4` |

`0` is a measurement. `—` is an absence. Rendering both the same way is a correctness bug, not a style choice, and `--ink-4` is reserved for the absences.

### 4.1 Block A — State of play

Three hero cards in `.stats` — `grid-template-columns: repeat(auto-fit, minmax(215px,1fr))`, gap 14px — then any live statement lines beneath.

**Card anatomy** (`.stat`, radius 14px, padding `15px 16px 18px`, `min-height:132px`, border `--line`): mono label → figure pushed to the bottom with `margin-top:auto` → caption. Each card reconstructs the deck's sentence with no word added or lost.

**Card 1 — Drafts.** `.stat.roi`. Label `Drafts`. `Open ↗` top-right at `--ink-3` — the page's one exit to ShikksTracker, its URL built server-side so the base URL is never public. Figure = `queue.drafts`, taking the violet hue (the reference's near-white exception applies only when a card spends its hue on a graphic, and this card has none). Caption `drafts waiting on you in ShikksTracker`; at 1, `draft waiting on you in ShikksTracker`.

Violet because violet means decisions, and 24 drafts is 24 decisions not made.

- Not reported → `.stat.blank`, figure `—`, caption `ShikksTracker didn't report how many drafts are waiting`. The `Open ↗` link stays in every state and inherits `--ink-4` on a drained card.
- Measured zero → `.stat.drained`, figure `0`.

**Card 2 — Contacts.** `.stat.plain`. Label `Contacts`. Figure = `not_started` at full 34px in `--ink` on a plain `--raised` card with a `--line` border. A 4px `.track` beneath it, filled to `not_started / total`, ground `--track` `#1A1E25`, fill `--ink-4`, **no hue**. Caption `of 30 contacts never contacted`; at a total of 1, `of 1 contact never contacted`.

**Hueless deliberately.** Any hue here would report Riku's own standing instruction (S10 — nothing goes to a business until he says so, each time) as a fault, every morning. The track is the one permitted graphic on the row because 25-of-30 as a shape is something the figure does not state; a field of marks or dots would only say the figure again, louder.

- Not reported → `.stat.blank`, `—`, caption `ShikksTracker didn't report how many contacts there are`, no track.
- `not_started` measured 0 with contacts present → `.stat.drained`, figure `0`, track at `width:0%` (the ground stays, which keeps the row's baseline).
- `total` measured 0 → `.stat.drained`, figure `0`, caption `of 0 contacts never contacted`, **no track** — a proportion of nothing is not a shape.

**Card 3 — Needs you.** The **same computed gap count Block E renders**, never the raw attention feed. The row then reads as one idea in three parts: what waits on you in the other app, what nothing has touched, what nothing is handling.

- Above zero → `.stat.stale`, figure and label amber, caption `waiting on you`. Amber because every row it counts is a duration, and red stays rationed to the health strip so the strip can be unmissable.
- At zero → `.stat.drained`, figure `0`, caption `nothing waiting`. **A card that reads 0 most days is not dead weight; 0 is the answer the page exists to give** — which is why this caption keeps `--ink-3` rather than draining with the figure.
- The gap count needs a database read, so when that read fails → `.stat.blank`, figure `—`, caption `couldn't load`, exactly like Block E beside it.

**Cards never disappear. Hue drains, structure stays.**

**Two height reservations, both so the three figures share one baseline.**

- **The track's slot is reserved on the cards that have none:** `.stat:not(:has(.track)) .sub{margin-top:15px}` (4px track + 9px margin). Only the contacts card ever fills it. The app targets current Chrome, so `:has()` is available; the explicit fallback if that ever changes is `.stat.roi .sub,.stat.stale .sub,.stat.drained .sub,.stat.blank .sub{margin-top:15px}`.
- **Two lines of caption height are reserved** *(new CSS, not in the mockup)*. `.stat .fig` is bottom-anchored, so a caption that wraps lifts its figure above the others — and the `—` captions wrap at 219–297px card widths while `nothing waiting` does not. Give `.stat .sub` a `min-height` of two lines at 10.5px / 1.5 (32px), so figures stay level whatever the caption says.

**The lines under the row** (`.fl-say`, 13px `--ink-2`, leading figure in `<b>` at body 600 tabular `--ink`). These are sentences and they **disappear entirely when they have nothing to say** — they never render as a zero.

- `3 approved, not yet sent` · singular `1 approved, not yet sent`. Hidden at 0 and hidden when the field did not arrive.
- `Sending is off` — **not shipped** (§1). It renders nothing today: no drained slot, no placeholder. When the contract lands it takes a 5px `--ink-3` dot and **never a warning hue** — it is a setting, not a fault.

The deck's A1 and A3 lines are not lines any more: they were absorbed into the drafts and contacts card captions. A2 is the only surviving line; A4 is the unshipped one.

**The whole-block fallback.** `Nothing waiting on you.` renders in the `.fl-say` register, with no figure, **only when drafts, approved and never-contacted are all zero or absent** — never under a lit card. The hero cards still render, drained. Pinned in a test.

### 4.2 Block B — Pipeline

**Summary line** (`.fl-sum`): `30 contacts · 2 hot`. Counts in display 700 / 13.5px / `--ink` / tabular; words in 11px `--ink-3`; the middot in `--ink-4` with 5px either side and **no literal spaces in the markup**. Singular `1 contact · 1 hot`.

- `hot` measured 0 → the `· N hot` clause is dropped.
- `hot` not reported → the clause is dropped **and** one `.fl-absent` line says so: `ShikksTracker didn't report how many are hot.`

**Rows, not a strip** (`.fl-stage`): label left at 13px `--ink-2`, count right at display 600 / 15px / `--ink` / tabular, grid `minmax(0,1fr) 64px`, padding `11px 0`, a `--line-soft` hairline above each row and **none above the first**. No boxes, no bars, no funnel.

Only stages holding at least one contact are listed, in pipeline order, with the deck's labels: `Not started` · `Contacted` · `Replied` · `Call booked` · `Proposal sent` · `Won` · `Lost`.

**Empty stages collapse into one `.fl-note` line**, in pipeline order, lowercased, with `or` before the last:

- `Nothing yet at call booked, proposal sent, won or lost`
- two remaining: `Nothing yet at won or lost`
- one remaining: `Nothing yet at lost`
- none remaining: the line is absent

**A stage the API omitted must not fold into that line** — that line means measured zero. One `.fl-absent` line instead: `ShikksTracker didn't report every pipeline stage.`

- No contacts at all → `.fl-empty` (13px `--ink-3`): `No contacts yet.`
- Failed to load → `.fl-fail`: `Couldn't load the pipeline.`

### 4.3 Block C — Campaigns

A native `<details>`, **closed by default**. The `<summary>` is the eyebrow-and-heading pair with the count and a chevron, laid out by `.sumrow` (grid `minmax(0,1fr) auto auto`, baseline-aligned). Count in `.fl-count`, mono 10px `--ink-3` tabular, dimming further while open. The chevron is a CSS `::after` box rotated `-45deg`, flipping to `45deg` when open, `transition: .14s`.

**Expanded:** `.fl-table.is-campaigns`, five columns (`minmax(0,1fr) 66px 66px 66px 66px`). Header row in mono caps 9px / weight 500 / `--ink-4` with a `--line` rule under it: `Campaign · Sent · Opened · Clicked · Replied`.

`Campaign` is the fifth new string, approved 2026-09-07: a headerless name column beside four headed ones reads unfinished, and it parallels Block D's deck-authorised `Approach`.

Rows: name at 600 / 13px / `--ink`, the four numbers right-aligned at 12.5px `--ink-2`, tabular, `--line-soft` beneath each. **Sorted by Sent, highest first. No rate column, ever. No hue anywhere.**

- A measured `0` cell is `0` in `--ink-4` (`.zero`).
- A missing cell is `—` (`.dash`).

**The pixel footnote sits directly under the table**, in the honesty-note register (`.honesty`, 11.5px `--ink-4` with a 13px info glyph): `Open counts come from tracking pixels and undercount anyone whose mail client blocks images.`

**Display bound: 20.** Past that, one `.fl-bound` statement below the table: `Showing 20 of 34 campaigns.` — 11.5px `--ink-4`, **body face, sentence case, left-aligned**. It is a statement to the reader, not a machine label, so it never takes mono caps.

- No campaigns → `.fl-empty`: `No campaigns yet.`
- Failed to load → `.fl-fail`: `Couldn't load campaigns.`

*Context worth keeping:* these count **contacts**, not messages — one person sent three emails counts once. That matches ShikksTracker's own dashboard by design, so the two numbers can never disagree.

### 4.4 Block D — Approach performance

The same disclosure. **No count** in the summary — the collapsed line carries the meaning instead (`.fl-collapsed`, 11.5px `--ink-4`, hidden when open):

- Today: `No sends yet — nothing to compare.`
- With data, the best measured row, borrowing the summary-line grammar (name at `--ink-2`, rate at `--ink` 600 tabular): `Email S1 — specific compliment first` · `11%`

**Default-open rule (R31).** Block D is open by default **only while every approach has zero sends** — today's state, where the four real approaches at `—` rate and `0` sends are the clearest single demonstration on the page of "not measurable is not zero". **Once any approach has a send, it is closed by default like Block C**, and the collapsed line carries the best measured row.

**Two groups, always, at equal typographic weight**, each under a mono-caps eyebrow:

**`Measured — email`** — four columns (`minmax(0,1fr) 78px 66px 66px`): `Approach · Reply rate · Sends · Replies`.

**`Not measurable`** — the explanation line sits **under the group heading, above its rows**, never below as a footnote (`.fl-explain`, 11.5px `--ink-3`): `Replies are only detected on email, so these can't be scored.` The group keeps the rate column **full of em-dashes** and drops the replies column entirely. Sends stay live at `--ink-2` while the rate drains to `--ink-4`.

**The rate is recomputed locally** from `sends` and `replies` — `Math.round(replies / sends * 100)`, printed as a whole percent. **The upstream `replyRate` is never printed.** It returns 0 for zero sends, which is precisely the lie this block exists to refuse: since S15 replies are only ever detected on email, so a Facebook, Instagram or phone variant's 0% is not a measurement, it is an absence of measurement. **No rate for zero sends. No rate for a non-email channel, ever. No hue on any rate.**

**One honesty note, under the measured group only**, in the `.honesty` register: `Rates are computed over small numbers of sends.`

**It renders only when at least one rate is printed.** A table with no rates and no sends is not a table of small numbers, and printing the note there would be the opposite of an honesty note. State it in the code as an explicit condition, or someone will "fix" its absence later.

- No approaches configured → `.fl-empty`: `No approaches set up.`
- Failed to load → `.fl-fail`: `Couldn't load approach performance.`

*Available but not required:* each approach also carries a breakdown by lead source and by web-presence tier. Do not design around it.

### 4.5 Block E — Needs you

**The gaps only** — the things nothing else is handling. Replies that already have a drafted follow-up live in `/queue`, and repeating them here would make both lists untrustworthy.

The heading row is `.fl-headrow` (grid `minmax(0,1fr) auto`, baseline-aligned) with the count right in `.fl-count`. **The count is neutral and absent at zero.**

**Rows built only from fields that exist** (`.fl-row`, grid `minmax(0,1fr) auto`, padding `14px 0`, `--line-soft` above each, **none above the first**):

- **Business name** — `.fl-biz`, 600 / 13px / `--ink`, the link out, with a **persistent** `↗` in `--ink-4` at 11px. **The row itself is not an anchor** — a whole clickable row on a page whose promise is "nothing here acts on a lead" is the wrong affordance.
- **Channel** — a neutral `.tag` on the right, `align-self:start`: mono 9px / `0.13em` / uppercase, radius 6px, `--line` border, `--ink-3`. Labels: `Email` · `Facebook` · `Instagram` · `Phone`.
- **The waiting line** — `.pwhen`, mono 9.5px `--ink-4`, tabular.
- **The quoted snippet** — `.fl-snip`, 12.5px `--ink-2`, quotation marks as the deck writes them.
- **The reason line** — `.fl-why`, 11.5px `--ink-4`.

**Three kinds:**

1. **A reply on a channel nothing drafts for** — instagram and phone; the chaser's `isSupportedChannel` covers email and facebook only. `replied 2 days ago` · snippet · `Nothing drafts replies for Instagram.`
2. **A reply with no draft in the queue** — over cap, or Riku rejected the draft. `replied 4 hours ago` · snippet · `No draft in the queue.`
3. **An overdue follow-up.** `follow-up due 3 days ago` in **`--stale` amber** (`.pwhen.is-stale`), the note in the snippet register. **Its channel slot is empty** — inapplicable, not unmeasured — so no tag and no em-dash.

**Waiting durations:** `just now` under an hour, then `4 hours ago`, `2 days ago`, `3 weeks ago`.

- Nothing waiting → `.fl-empty`: `Nothing waiting.` **Left-aligned where content lives — never centred, never in a dashed box, never with an action pill.** This is today's state and it must look intentional.
- Display bound 20 → `.fl-bound`: `Showing 20 of 41.`
- Failed to load → `.fl-fail`: `Couldn't load what's waiting.`

*On register:* the hero caption `nothing waiting` and this block's `Nothing waiting.` differ deliberately. Hero captions are lowercase fragments completing a label→figure→caption sentence; block bodies are sentences.

### 4.6 Block F — Health strip

**Silent when all is well.** It reads as a footer until something is wrong, and then it must be impossible to miss.

**Quiet form** (`.fl-health.quiet`) — a hairline top border, 14px of padding above, one 11px `--ink-3` line, and `Check now` as an outline pill pushed right:

```
Engine ran 2h ago · all sites ok · checked 6h ago          [Check now]
```

Middots are `--ink-4` with 5px either side. Ages read as hours below two days (`6h`, `36h`), then days (`3d`, `29d`) — `formatAge`'s existing grammar.

**Alarm form** (`.fl-health.alarm`) — **it becomes a bordered card**: `--panel` fill, `--line` border, 10px radius, padding `14px 16px`. Cards earn their borders, and a structural alarm is quieter and stronger than more colour.

- Each warning is a `.fl-warn` row: a **5px hued dot with a 6px glow**, then the warning text at `--ink` 12.5px.
- Healthy items follow on one indented `--ink-3` line (`.fl-fine`, `margin-left:14px`).
- Then the indented stamp line and `Check now` (`.fl-stamp`).

**The marker is the system's dot, never `⚠`.** The triangle appears only in the deck's ASCII layout sketch, not in its string list; it renders as a colour emoji on some platforms, and a coloured glyph has no place in a monochrome instrument panel. Riku confirmed the dot on 2026-09-07.

**Hues:**

| Warning | Hue |
|---|---|
| engine stale | `--stale` amber |
| engine never ran / unreadable run time / reported errors | `--missing` red |
| approved messages stranded | **`--missing` red** — it only ever fires beside a stalled engine, so a human is waiting |
| a site down | `--missing` red |
| the stamp | never hued, except by the 30-hour rule below |

**Warning strings, verbatim from `evaluateOutreach` in `src/lib/outreachHealth.ts`.** These are already the deck's exact strings, character for character; nothing is rewritten.

- `ShikksTracker send engine has never reported a run`
- `ShikksTracker send engine reported an unreadable run time`
- `ShikksTracker send engine last ran 3d ago`
- `ShikksTracker send engine reported 2 errors` · singular `reported 1 error`
- `3 approved messages are stranded, unsent` · singular `1 approved message is stranded, unsent`

**Site strings, verbatim from `classifyStatus` / `classifyError` in `src/lib/siteHealth.ts`**, over the three watched sites (AzeroTech, Meowchi, ShikksTracker):

- `Meowchi returned HTTP 503` · `Meowchi timed out` · `Meowchi unreachable` · healthy: `Meowchi ok`

**The 30-hour rule.** Past `AGENT_STALE_HOURS` — site-health's own `everyHours + graceHours` — a stored reading no longer supports a claim about the present. So **`all sites ok` is not printed at all**, and the stamp becomes an amber statement (`.aged`, `--stale`): `sites not checked since 2d ago`.

This closes a hole the cron's own error handling opens: the snapshot write is caught and counted rather than allowed to fail the job (§7.6), which would otherwise leave the page saying everything is fine forever.

**`sites never checked`** — amber with monitoring on, grey with monitoring off. With monitoring off the reading is *expected* to be absent, and an alarm about an expected absence is a daily false alarm.

**`Engine — unknown`** in grey when the summary call failed.

**`Check now`** — the only control on the page.

- Label `Checking…` while busy, and the button is `disabled`.
- **The existing reading stays on screen until the new one lands.** Never blank the strip while it re-reads.
- **A server-side 60-second floor**, read from the snapshot's own `checkedAt`. Inside the floor the route **returns the existing reading rather than an error**: a reading twenty seconds old *is* current, and Riku pressing twice is not a mistake that deserves an error state. The floor exists so a stuck finger cannot fire nine requests at client sites, not to defend against abuse — there is exactly one user behind a session cookie.

### 4.7 Whole page down, and one source down

**Whole page down** — ShikksTracker unreachable. The page renders the title, a two-sentence statement, and the strip. **Blocks A to E are omitted, not drawn drained.** The strip survives because site results are stored locally.

```
Freelance

●  Couldn't reach ShikksTracker.
   State of play, pipeline, campaigns, approaches and what's waiting all come from there.

Engine — unknown · Meowchi ok · checked 6h ago             [Check now]
```

Treatment: `.fl-fail`, grid `5px minmax(0,1fr)`, a 5px `--missing` dot with a 6px glow, the statement at 13px `--ink-2` and the explanation at 12.5px `--ink-3` capped at `62ch`.

**One source down** — every other block renders normally and only the affected block carries its own sentence, in the same `.fl-fail` treatment. **No retry control anywhere.** The page loads fresh every time; a retry button is a second way to do what reloading already does.

---

## 5. The visual system as shipped

### 5.1 Tokens

`src/styles/tokens.css` — one `:root` block, hexes copied verbatim from `DESIGN-INSPO.md` §2 with a `/* source: DESIGN-INSPO §2 */` comment so drift shows up in a diff.

**Ground and structure:** `--void` `#08090B` · `--panel` `#0E1013` · `--raised` `#14171C` · `--sunk` `#050608` · `--line` `#1D222A` · `--line-soft` `#15191F`.
**Ink:** `--ink` `#E9ECF0` · `--ink-2` `#98A1AD` · `--ink-3` `#5B6470` · `--ink-4` `#3A424C`.
**Semantic hues — one closed set, meaning fixed:** `--spend` `#FF8A3D` · `--save` `#35D399` · `--roi` `#A78BFA` · `--session` `#5FA5FA` · `--stale` `#FBBF24` · `--missing` `#F87171`.
**One non-hue graphic token:** `--track` `#1A1E25`.
**Card tints** (155deg, deep desaturated hue into near-neutral at 62%): `--tint-roi: linear-gradient(155deg,#171233,#111117 62%)` · `--tint-stale: linear-gradient(155deg,#241A03,#141209 62%)`.
**Spacing** `--sp-1`…`--sp-8` = 4 / 6 / 10 / 14 / 20 / 28 / 44 / 72.
**Radii** `--r-tag` 6 · `--r-nav` 7 · `--r-chip` 8 · `--r-card` 10 · `--r-feature` 14 · `--r-pill` 999.
**Layout** `--content-max` 920px · `--rail-w` 170px.

**Naming, and it is load-bearing.** `DESIGN-INSPO.md` §2 names the amber and red tokens `--stale` and `--missing`; `components.html` names them `--amber` and `--alert`. Same hexes, different names. **Take §2's names — they carry the meaning, and the whole claim of the system is that the meaning never moves.** Carry one comment saying that a recipe copied out of `components.html` needs `--alert → --missing` and `--amber → --stale`.

**Define no aliases.** A second name for the same hue is how a hue eventually gets used for the wrong meaning.

**Do not port `--skill`** (pink) — it is graph-only and there is no graph. **Do not port the `-dim` tokens** — inline the gradient stops instead. An undefined token cannot be used decoratively; a defined unused one is an invitation. `--session` is defined and unused, and that is settled: a fixed set stays complete.

**Dark only.** No `@media (prefers-color-scheme)`, no `[data-theme]`. `html { color-scheme: dark }` so the browser paints scrollbars, spinners and steppers dark, plus an explicit `input:-webkit-autofill` override for the login field, because Chrome paints its own near-white autofill ground that no ordinary `background` declaration beats.

### 5.2 Faces

Three, through `next/font/google`, with CSS variables named **exactly** `--display`, `--body`, `--mono`, so every recipe copied from `components.html` works unchanged:

| Variable | Family | Role |
|---|---|---|
| `--display` | Archivo 600/700 | Figures, page and section headings |
| `--body` | IBM Plex Sans 400/500/600 | Anything read as a sentence |
| `--mono` | JetBrains Mono 400/500/700 | All labelling — this is what makes the app read as an instrument rather than a website |

`tokens.css` carries a comment saying those three are defined by `layout.tsx`, not by the token file, or the next reader will look for them there and not find them.

### 5.3 The scale actually used

Read off the mockup's CSS. This is the whole inventory; nothing else has a size.

| Element | Spec |
|---|---|
| Page title `.fl-title` | display 600 · 24px · `-0.02em` · **line-height 1.5 (inherited; load-bearing for §3.4's title→switch gap — do not tighten without re-deriving it)** |
| View-switch tab `.segmented a` | mono · 9.5px · `0.13em` · uppercase · **line-height 1.4** · `--ink-3`, `--ink` when active or hovered · `6px 12px` · radius 6px |
| Block heading `.fl-h` | display 600 · 19px · `-0.015em` · 5px under its eyebrow |
| Eyebrow `.eyebrow` | mono 400 · 9.5px · `0.18em` · uppercase · `--ink-3` |
| Rail group label `.grouplabel` | mono · 8.5px · `0.16em` · uppercase · `--ink-4` |
| Hero figure `.stat .fig` | display 700 · 34px · `-0.03em` · line-height 1.06 · tabular |
| Hero label `.stat-top .lbl` | mono · 9px · `0.16em` · uppercase · `--ink-3` |
| Hero exit `.stat-top .more` | mono · 8.5px · `0.13em` · uppercase · `--ink-4` (`--ink-3` on the drafts card) |
| Hero caption `.stat .sub` | 10.5px · `--ink-3` |
| Body / statement lines | 13px · line-height 1.5 · `--ink-2` |
| Pipeline count `.fl-stage .ct` | display 600 · 15px · `--ink` · tabular · right |
| Summary figure `.fl-sum b` | display 700 · 13.5px · `--ink` · tabular |
| Table header `.fl-thead` | mono 500 · 9px · `0.14em` · uppercase · `--ink-4` |
| Table name `.fl-trow .nm` | 600 · 13px · `--ink` |
| Table number | 12.5px · `--ink-2` · tabular · right |
| Disclosure count `.fl-count` | mono · 10px · `--ink-3` · tabular |
| Collapsed line `.fl-collapsed` | 11.5px · `--ink-4` |
| Notes `.fl-note` / `.fl-absent` | 11px · `--ink-3` / `--ink-4` |
| Empty state `.fl-empty` | 13px · `--ink-3` |
| Bound / explain / honesty / reason | 11.5px |
| Waiting line `.pwhen` | mono · 9.5px · `--ink-4` · tabular |
| Snippet `.fl-snip` | 12.5px · `--ink-2` |
| Health line / stamp | 11px · `--ink-3` · tabular |
| Warning text `.fl-warn span` | 12.5px · `--ink` |
| Pill `.btn` | mono · 9.5px · `0.14em` · uppercase · `8px 14px` · radius 999px |
| Tag `.tag` | mono · 9px · `0.13em` · uppercase · `5px 10px` · radius 6px |
| Agent badge `.agent` | mono 700 · 10px · `0.08em` · uppercase · `8px 9px` · radius 8px |
| Agent caption `.agent-cap` | mono · 8.5px · `0.06em` · `--ink-4` · tabular |
| Nav item `.navitem` | 12.5px · `--ink-3` · `6px 9px` · radius 7px |
| Wordmark `.app-brand .wm` | display 600 · 13px · `-0.01em` · `--ink` |
| Top-bar stamp `.crumb em` | 11.5px · `--ink-4` · tabular |

**`font-variant-numeric: tabular-nums` on every figure and every column of digits.** Non-negotiable.

### 5.4 The column, and the four-card arithmetic

**920px — and it must be written down, because Personal and Academics inherit it and someone will re-derive it wrongly.**

`.fl` is 920px with **no padding of its own**: the 28px horizontal padding lives on `.app-content`. So the stats grid's inner width is the full 920. Four hero cards at `minmax(215px,1fr)` with 14px gaps need `4 × 215 + 3 × 14 = 902 ≤ 920`; they land at `(920 − 42) / 4 = 219.5px` each. **The money-in card fits with 18px to spare and no deviation from `minmax(215px,1fr)`.** The 980px column argued for at one point was arithmetic error.

The trap that produces the wrong answer: `box-sizing: border-box` means a `max-width: 920px` element *with* horizontal padding gives 864px of content, at which point four cards wrap. Keep the padding on the outer element and the max-width on the inner one.

`.app-content` also needs `max-width: none`, so the `main` column rule in `legacy.css` — which exists for the old pages — does not apply a second column to `/freelance`'s own `<main className="app-content">`.

### 5.5 Row grammar

**Hairlines between rows; borders only around real objects.** A stat card, the alarm-form health strip and the old pages' `.card` get a border and a radius. Nothing else does, and nothing nests more than one card deep.

Every row list on the page opens the same way: **no hairline above the first row** (`.fl-stages > .fl-stage:first-child`, `.fl-rows > .fl-row:first-child`).

### 5.6 Disclosure

Native `<details>` / `<summary>`. Zero client JavaScript, correct keyboard behaviour, correct `aria-expanded`, find-on-page expansion, and nothing to break under hydration because there is none. "Is this section open" has no consumers, no persistence and no sharing — it is not application state.

`.disclose > summary { display:block; list-style:none; cursor:pointer }` plus `::-webkit-details-marker { display:none }` for Safari. The chevron is a rotated CSS box on `.sumrow::after`, `transition: transform .14s ease`, covered by the reduced-motion rule below. The cost is no open/close animation, and the design does not want one.

### 5.7 Focus, selection, motion

- `:focus-visible { outline: 2px solid var(--spend); outline-offset: 3px; border-radius: 3px }` — `components.html` verbatim. A reference-level convention, not a hue spend.
- `::selection { background: rgba(233,236,240,.16); color: var(--ink) }` — **neutral**. A selection band is not a decision, and no hue is spent where it does not carry its assigned meaning.
- `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important } }`.

### 5.8 Declared vocabulary that renders nowhere

The `.statstrip` / `.btn.go` / `.statuspill` / `--session` list is unchanged and, per its own rule, **does not grow**: the view switch ships with its consumer, and the reference's `.range` is not ported. (`IconQueue`'s deletion is recorded in §7.2's Icons paragraph, where the icon inventory lives.)

---

## 6. The old pages

**One treatment per selector, through the stylesheet, plus exactly one TSX deletion.** `src/styles/legacy.css` is deliberately a layer with an expiry date — it dies in the phase where queue and settings get their own content discussion. Say so in the file's header comment or it will outlive its reason.

### 6.1 The selector table

| Selector | Used by | New treatment |
|---|---|---|
| `main` | queue, settings, login | The content column: `max-width: var(--content-max)`, `margin: 0 auto`, padding `28px 28px 72px` |
| `h1` | all three | display 600 · 24px · `-0.02em` · `--ink` · `margin: 0` |
| `button` (bare) | Approve, Save, Enable, and the **active** status filter | Outline pill at high emphasis: mono 9.5px / `0.14em` / uppercase, `8px 14px`, radius 999px, transparent fill, `--ink-4` border, `--ink` label; hover border `--ink-3` |
| `button.secondary` | Edit, Cancel, inactive filters, Re-register | The same pill at resting emphasis: `--line` border, `--ink-3` label; hover `--ink-4` / `--ink-2` |
| `button.danger` | Reject, switch-off controls | The same pill: `rgba(248,113,113,.4)` border, `#F5A5A5` label, **never a solid fill**; hover border to `.6` |
| `button:disabled` | everywhere | `opacity: .45`, `cursor: not-allowed`, hover lift suppressed |
| `.card` | queue items, settings groups, `PushControls` | `--raised` fill, 1px `--line`, radius 10px, padding 14px, `margin-bottom` 14px |
| `.badge` | item status | The tag recipe: radius 6px, mono 9px / `0.13em` / uppercase, `--line` border, `--ink-3`, padding `4px 8px` |
| `.meta` | timestamps, section labels | 10.5px `--ink-3` |
| `.row` | flex groups | Layout unchanged; `gap: 10px`, `align-items: center`, wrap, `margin-top: 10px` |
| `.error` | inline errors | `--missing`, 12.5px, no box |
| `label` | form labels | 12px `--ink-3`, sentence case — **not** mono caps; it addresses a person |
| `input`, `textarea` | login, settings | `#101318` fill, `--line` border, radius 8px, `--ink` text, `caret-color: var(--spend)`, plus the `-webkit-autofill` override |
| `pre.body` | draft email bodies | **The body face**, 12.5px / 1.55, `--ink-2`, `--sunk` fill, 1px `--line-soft`, radius 8px, padding `10px 12px`, `white-space: pre-wrap` |
| `a` | links in old markup | `--ink-2` with a 1px `--line` underline; hover `--ink` / `--ink-4` |

**`pre.body` keeps the body face deliberately.** It holds a draft email to a business owner. Rendering Riku's own outgoing message in JetBrains Mono would make him read it as machine output, in the one place he is checking tone.

**`a` is a deliberate deviation from `components.html`, which makes links orange.** That is right for a teardown article, where orange is the document's accent. In the app orange is `--spend` and means money out and the brand mark. A `Settings` link is neither.

### 6.2 Costs, named rather than discovered later

**The status filters lose their solid active state.** Bare `<button>` carries three meanings at once on `/queue` — an affirmative action, a neutral action, and the active segment of the status-filter row — and one element selector cannot be all three. Mapped to the neutral-high outline pill, the six filters differ only by border and label brightness, so the row reads as one strip until you look. **That is the price of one-treatment-per-selector, not a defect.** The alternative is a `className` diff, which belongs to a later phase.

**`main` widens from 640px to 920px.** A visible layout change to `/queue`, forced by the shell. Recorded, not hidden.

**The `env(safe-area-inset-*)` padding is dropped.** The current `main` rule in `globals.css` carries it; the ported rule does not. That is consistent with desktop-first and it is a deliberate loss, not an oversight. It comes back in the phone pass (§10).

**The Queue view starts 10px lower than the Dashboard view.** `legacy.css`'s `main` gives both views a 28px top padding; the queue page's first child is a `.row`, whose `margin-top: var(--sp-3)` adds 10px on top of it. Removing it needs either a TSX edit (R18 forbids further edits to that file) or a new rule in `legacy.css` (its header forbids additions). This is the same 10px recorded as carry-forward (5) after Plan A; the view switch does not create it but does put the two views one click apart, which makes it easier to see. It goes when the queue page gets its own S11 content discussion and is rebuilt.

**Two stacked control rows on the Queue view, with the emphasis inverted.** The view switch and the status-filter row sit 38px apart, on the same left edge, both in 9.5px mono caps, both bearing a selection. The *grammar* is correct and is the reference's own: §5.3 gives the recessed track to the control that "switches what you're looking at" and no track to the one that "switches the window you're looking through", and a status filter genuinely is the second. What is inverted is the **emphasis**. §5.3 gives that second control the loudest active state in the system — "a solid white pill with dark text… correctly so, because it silently reframes every number on the page" — and the named cost above took it away, so the six filters differ only by border and label brightness. A-2 therefore puts a navigation control with a solid raised fill 38px above a reframing control with none: **the navigation shouts and the reframing whispers.** When the queue page gets its S11 discussion, the fix is to port `components.html`'s `.range` (lines 268–273) for the status-filter row — the reference's own answer to "a filter row under a view switch", one rule, and it restores the emphasis order. That is also the future consumer whose absence is today the reason not to port `.range` (§5.8).

**`/settings` now has no header at all.** Both Freelance views gain a 103px header band with a 24px title; `/settings` has had no heading of any level since the inline headers were deleted (§6.3) and gains nothing. Two of the three signed-in pages are titled and one is not, and the asymmetry is now structural rather than incidental. That is carry-forward (4); A-2 sharpens it and does not fix it.

### 6.3 The inline headers, deleted

Riku's answer of 2026-09-07. This is the one place where "no TSX change" and "the shell works" genuinely conflict, and it is bounded to two elements.

**`src/app/queue/page.tsx`** — delete the `<header className="row">` element that opens the returned `<main>`. It contains an `<h1>` reading `{APP_NAME} — Queue`, a `<Link href="/settings">Settings</Link>`, and a `<button className="secondary">Log out</button>`. The rail already carries all three; without the deletion `/queue` shows two `Log out` buttons and two `Settings` links, and the fattest duplication is the `h1` itself, which puts the app name and the page name at display weight under a rail that already says both.

Deleting it also deletes the page's copy of `logout()` — **the behaviour is not lost, it moves to the shell's `LogoutButton.tsx` (§7.2)**, which is where the rail's `Log out` lives. The `Link` and `APP_NAME` imports lose their last consumer and go in the same edit. **Nothing else in the file changes.**

**`src/app/settings/page.tsx`** — delete the matching `<header className="row">`, which contains an `<h1>` reading `{APP_NAME} — Settings` and a `<Link href="/queue">Queue</Link>`. Its now-unused `Link` and `APP_NAME` imports go with it. **Nothing else in the file changes.**

**`src/app/login/page.tsx` is untouched.** It renders `<h1>{APP_NAME}</h1>` and there is no rail there to duplicate it.

---

## 7. Engineering

### 7.1 Stylesheets

Four files ship, imported side-effect style **from `src/app/layout.tsx` only**, in this fixed order:

```
src/styles/tokens.css       :root custom properties only — nothing else
src/styles/base.css         reset, html/body, headings, links, focus, ::selection, reduced motion
src/styles/components.css   the ported recipe book — the shared vocabulary
src/styles/legacy.css       the old pages' class names — has an expiry date
```

`src/app/globals.css` is **deleted**, its contents redistributed across the four. CSS imported from different components can land in a non-deterministic order in the built stylesheet, so importing everything from the single root layout in a fixed sequence makes the cascade something you read in one file rather than discover in production.

**Two namespaces, no third.** Shared vocabulary keeps the reference's own names verbatim (`.stat`, `.btn`, `.tag`, `.eyebrow`, `.navitem`, `.agent`, `.track`, `.statuspill`) so a recipe can be diffed against `components.html` by eye. Anything only this page has takes the page prefix `fl-`. No BEM, no utility classes.

**Do not port `components.html`'s article furniture** — `.frame`, its own `.rail`, `.masthead`, `.kicker`, `.standfirst`, `.well`, `.caption`, `.debt`, `.swatches` and the rest are chrome for a document *about* components.

### 7.2 Route group and shell

```
src/app/(app)/layout.tsx                     server — the shell
src/app/(app)/freelance/layout.tsx           server — the segment header (new). Renders NO <main>.
src/app/(app)/freelance/ViewSwitch.tsx       "use client" — the view switch (new); the fourth island
src/app/(app)/freelance/page.tsx             the Dashboard view
src/app/(app)/freelance/queue/               git mv from src/app/(app)/queue/; contents otherwise untouched
src/app/(app)/settings/                      contents untouched
src/app/(app)/_shell/Rail.tsx                server
src/app/(app)/_shell/NavList.tsx             "use client" — one of four client islands (usePathname)
src/app/(app)/_shell/AgentsBlock.tsx         server, async
src/app/(app)/_shell/TopBar.tsx              "use client" since R39 — the stamp, keyed to the path
src/app/(app)/_shell/LogoutButton.tsx        "use client" — an onClick
src/app/login/page.tsx                       stays outside the group — no shell
src/components/icons.tsx                     IconFreelance, IconSettings, IconInfo, IconMark
```

**Rejected:** one root layout with `usePathname()`-driven conditional chrome — it forces the root layout to be a client component, which kills server data fetching for the agents block.

**The shell renders no `<main>`.** Queue, settings and login each render their own, and two `<main>` elements in one document is invalid HTML. The shell renders `.app`, `.app-body`, `.app-side`, `.app-main` and `.topbar`; `/freelance` renders its own `<main className="app-content">`.

**Active nav is a client island** — `usePathname()` is client-only. The smallest correct island renders the `<Link>`s and compares the pathname: no state, no effects, no data, about 25 lines. **The proxy is not touched to avoid it.** `src/proxy.ts` is the app's authorization boundary and stays boring; editing a fail-closed security file to save a kilobyte of hydration is a bad trade in a repo whose rules say `requireSession` is worth duplicating for defence in depth.

**A session check in the layout, as defence in depth.** Ten lines: read the cookie, verify with the existing `verifySessionToken`, `redirect("/login")` otherwise. The proxy already guarantees a session; this exists so a middleware-matcher typo cannot silently expose the shell. It does not need a `?from=` — the login page already defaults to `/freelance`.

**Icons.** `src/components/icons.tsx`, named exports, no registry: `IconFreelance`, `IconSettings`, `IconInfo`, `IconMark` (the brand sunburst). **`IconQueue` is deleted by A-2** — the rail's two items are Freelance and Settings, so the glyph loses its only consumer, and §5.8 forbids declared-unused vocabulary. That is the same reasoning that already kept `IconLogout` out. All `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.8}`, round caps, `aria-hidden="true"`. Where the design uses a text glyph — `↗`, the chevron — use the literal character, not a component.

**The routes.** `/freelance` is the Dashboard view; `/freelance/queue` is the Queue view. The move is `git mv src/app/(app)/queue src/app/(app)/freelance/queue`; the folder's contents are unchanged except the one `?from=/queue` literal, which becomes `/freelance/queue` — a route move's mechanical consequence, allowed by R42 despite R18. The relative `./PushControls` import moves with the folder.

**`/queue` is permanently redirected** to `/freelance/queue` by `redirects()` in `next.config.ts`. Config redirects run **before** the proxy, so a signed-out hit on `/queue` becomes `/login?from=/freelance/queue` rather than `/login?from=/queue`. `src/proxy.ts` is not touched and needs nothing: `isPublicPath` is an allowlist, `/freelance/queue` is not on it, and the path contains no `%`, `..` or `//`, so it is treated exactly as `/queue` was. `next.config.ts`'s `headers()` block — the CSP — is not touched either.

**The landing.** `/` redirects to `/freelance`; `manifest.ts`'s `start_url` is `/freelance`; the login page's default `from` is `/freelance`. Push notifications keep opening the queue: `buildPushPayload`'s default url and `public/sw.js`'s two fallbacks become `/freelance/queue`, and the morning cron's `Re-subscribe from …` names the new path.

**The segment layout renders no `<main>`.** It renders `.fl-head > .fl > h1 + nav.segmented`, then `{children}`. The `(app)` layout above it already did the session check; the segment layout does none.

**The switch is the shell's fourth client island**, and like the other three it exists for exactly one reason: `usePathname()` for the active state. It lives at `src/app/(app)/freelance/ViewSwitch.tsx`, beside the layout that renders it — the same colocation `src/app/(app)/freelance/queue/PushControls.tsx` already uses beside its page. Not `_shell/`, which is for chrome rendered on every page; not `_blocks/`, which Plan C owns for the page's content blocks.

**Carry-forward (4) is partly closed, and sharpened.** `/freelance/queue` now inherits a real `<h1>` from the segment layout, so the Queue view goes from *no heading of any level* to exactly one — verified: `git grep "<h1" src/` returns two hits, `freelance/page.tsx` (which Task 3 step 4 removes) and `login/page.tsx` (outside the group). What A-2 does not fix: the one `<h1>` says `Freelance` on **both** views, so the view's identity lives entirely in a control and in `aria-current`, and the browser tab title is still `APP_NAME` on every page — which is now the weakest link, because two Freelance views at two URLs are indistinguishable in a tab strip. That argues for pulling carry-forward (4) forward; it does not argue for changing A-2.

**Carry-forward (2) gains a sentence.** The header is not sticky. On the Queue view with a full list the switch scrolls away, and there is no way back to the Dashboard except the rail — which is not sticky either, which is why this belongs in that carry-forward rather than here. It is the first time the app has an *in-page* navigation control that can leave the screen, and carry-forward (2)'s sentence should say so.

### 7.3 The agents block

**Extract, do not widen.** `evaluateWatchdog` returns *anomalies*; an empty array means healthy. The rail needs one row per agent **including** the healthy ones — a different type with a different totality guarantee. Making one function serve both would either hand the digest `ok` rows it must filter (a silent contract change to the one push Riku is meant to trust) or make the rail infer "healthy" from *absence*, which would paint an agent missing from the table green.

So extract the per-agent judgement both want, in `src/lib/watchdog.ts`:

```ts
export type AgentVerdict =                                   // (new)
  | { kind: "never" }
  | { kind: "stale"; ageHours: number }
  | { kind: "failed" }
  | { kind: "degraded"; itemsFailed: number }
  | { kind: "ok"; ageHours: number };

export function classifyAgentRun(                            // (new)
  now: Date, run: LatestRun | undefined, exp: Expectation
): AgentVerdict;
```

`evaluateWatchdog` becomes a map-and-filter over it. **`src/lib/__tests__/watchdog.test.ts` must pass unchanged, and that is the refactor's proof.**

Then, also in `watchdog.ts`:

```ts
export const AGENT_STALE_HOURS = 30;                          // (new) — 24 + 6
export const RAIL_AGENTS: Expectation[] = [ /* six rows, execution order */ ];  // (new)

export type AgentBadgeState = "off" | "never" | "failed" | "overdue" | "ok";    // (new)
export interface AgentSwitches { chaserEnabled: boolean; monitoringEnabled: boolean }  // (new)
export interface AgentStatus { agent: Agent; state: AgentBadgeState; caption: string | null }  // (new)

export function deriveAgentStatuses(                          // (new)
  now: Date,
  latest: LatestRun[],
  switches: AgentSwitches,
  expectations: Expectation[]
): AgentStatus[];
```

**Total by construction:** one row per expectation, in the given order, never more, never fewer. Pure — no database, no clock of its own. It never returns `unknown`; that state belongs to the component's catch block.

**Data.** `fetchLatestRuns(RAIL_AGENTS.map(e => e.agent))` — the existing function, already one indexed `findOne` per agent, written for exactly this question. No new query. `getOsSettings()` supplies the two switches, **in the same `try/catch`**, or a settings failure greys the badges for the wrong reason.

**A database failure must never break a page render, and the guard is structural:**

```tsx
<Suspense fallback={<AgentsSkeleton />}>
  <AgentsBlock />
</Suspense>
```

with a `try/catch` **inside** `AgentsBlock` returning six grey `—` badges. Both halves are required: Suspense keeps the read off the critical path so the shell and page paint immediately, but an uncaught throw inside an async server component bubbles to the nearest error boundary and can blank the route, so the `try/catch` is the actual safety.

**No polling, no `unstable_cache`, no revalidate tag.** These agents run once a day. On a soft `<Link>` navigation inside `(app)` the layout sits above the changed segment and is reused from the client router cache, so the badges can go stale during a long session. That is fine and is not to be "fixed".

### 7.4 The Freelance page

```
src/app/(app)/freelance/page.tsx                     server, force-dynamic — a renderer
src/app/(app)/freelance/_blocks/HeroRow.tsx          Block A cards
src/app/(app)/freelance/_blocks/StateOfPlay.tsx      Block A lines
src/app/(app)/freelance/_blocks/Pipeline.tsx         Block B
src/app/(app)/freelance/_blocks/Campaigns.tsx        Block C
src/app/(app)/freelance/_blocks/Approaches.tsx       Block D
src/app/(app)/freelance/_blocks/NeedsYou.tsx         Block E
src/app/(app)/freelance/_blocks/HealthStrip.tsx      Block F
src/app/(app)/freelance/_blocks/CheckNow.tsx         "use client" — the only client island on the page
```

```tsx
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const [summary, attention, variants] = await Promise.allSettled([
  fetchSummary(ST_PAGE_TIMEOUT_MS),
  fetchAttention(days, ATTENTION_LIMIT, ST_PAGE_TIMEOUT_MS),
  fetchVariantStats(ST_PAGE_TIMEOUT_MS),
]);
```

**`Promise.allSettled`, not `Promise.all`** — that is the whole per-block-degradation mechanism in one word. Each block receives either its data or a rejection and renders its own sentence from the deck. `cache: "no-store"` is already set inside every `stApi` fetch.

**`ATTENTION_LIMIT` moves to `src/lib/stApi.ts` as an export** *(moved)*. It is currently a module-private constant inside `src/app/api/cron/morning/route.ts`, so the page cannot import it, and a second copy would let the cron and the page bound the same feed differently. The cron route imports it from `stApi.ts` in the same change; both callers share one value.

**`ST_PAGE_TIMEOUT_MS = 6_000`** *(new)*. `ST_TIMEOUT_MS` is 15 s, which is right for a cron and wrong for a human: three hung calls in parallel can outlive the function budget and hand Riku a Vercel error page instead of the deck's carefully written `Couldn't reach ShikksTracker.` This is the single most likely way the page fails badly in production. `maxDuration = 30` is a second belt.

**View models, flat in `src/lib/`** to match the repo's existing shape (`chaser.ts`, `digest.ts`, `siteHealth.ts` — no folders), with tests in `src/lib/__tests__/` because `vitest.config.ts` only collects from there. All *(new)*:

| Module | Holds |
|---|---|
| `src/lib/freelanceView.ts` | Blocks A, B and C view models |
| `src/lib/freelanceVariants.ts` | Block D — the email / not-measurable split |
| `src/lib/freelanceGaps.ts` | Block E — the gap calculation |
| `src/lib/freelanceHealth.ts` | Block F — composes `evaluateOutreach` with the stored snapshot |
| `src/lib/format.ts` | Pluralisation and both age grammars — **deliberately unprefixed**, because Personal and Academics need the same two |

**There is no hero-graphics module.** Riku chose the plain row, so the only graphic left is the contacts track, and its whole shape is one percentage: `not_started / total`, clamped to 0–100, `null` in → no track. That belongs in `freelanceView` beside the caption it draws, not in a module of its own.

`formatAge` already exists **inside `src/lib/outreachHealth.ts`** and produces exactly Block F's `6h` / `36h` / `3d` grammar. **Move it into `format.ts` and re-import it**, rather than writing a second implementation that will drift. Block E needs a different grammar (`just now` / `4 hours ago` / `2 days ago` / `3 weeks ago`), so both live side by side with their boundary cases pinned.

`buildHealthStrip` **takes the staleness threshold as an argument** rather than importing `EXPECTATIONS`, so it stays pure and its 30-hour rule is testable.

**The gap calculation is logic, not view.** It lives beside the chaser, is unit-tested without a database or network, and reuses the chaser's `liveAnchorIds` idea — the set of `replyToLogId`s already carrying an `ApprovalItem` in `pending` / `approved` / `edited_approved`.

### 7.5 What `stApi.ts` gains

Four things, and the second is the one that has already bitten this repo once.

**1. Widen `SummaryResponse`** with the two blocks the file currently leaves unmodelled. The contract is in `../ShikksTracker/docs/os-api.md`:

```ts
export const PIPELINE_STAGES = ["not_started","contacted","replied","call_booked","proposal_sent","won","lost"] as const;  // (new)
export type PipelineStage = (typeof PIPELINE_STAGES)[number];                                                             // (new)

export interface SummaryContacts {          // (new)
  total: number | null;
  hot: number | null;
  byPipelineStage: Record<PipelineStage, number | null>;
}
export interface SummaryCampaign {          // (new)
  id: string; name: string;
  sent: number | null; opened: number | null; clicked: number | null; replied: number | null;
}
export interface SummaryResponse {
  queue: SummaryQueue;
  engine: SummaryEngine;
  contacts: SummaryContacts | null;   // null = the whole block was absent
  campaigns: SummaryCampaign[] | null;
}
```

**2. Carry them through `fetchSummary`'s reconstruction, in the same change, with a test.** `fetchSummary` rebuilds its return value field by field, so **widening the interface alone yields `undefined` at runtime with a green type-check**. The file says so in as many words, and that exact pair was missed once already, in P4's `overdueActions`. Every count goes through the existing `readCount`, per stage, so a stage the API omitted arrives as `null` and never as a zero.

**3. `fetchVariantStats(timeoutMs?)`** *(new)*. One row per variant — `{ key, label, channel, stage, sends, uniqueContacts, replies, replyRate, bySlice }` — documented as deliberately not truncated, so the display bound is ours to enforce. **Read `sends` and `replies`; ignore `replyRate`.** ShikksTracker's own `rate()` returns 0 for zero sends, which is exactly the blind spot Block D exists to refuse.

**4. An optional timeout parameter on all three GETs**, backwards compatible so the existing cron callers are unchanged.

**Also:** extract the chaser route's inline live-anchor query into `src/lib/queue.ts` as `fetchLiveAnchorIds(anchors: string[]): Promise<Set<string>>` *(new)*, and have **both** the chaser route and `freelanceGaps` use it. Writing a second copy on the page is the single most likely way this feature goes wrong: if the two status lists ever drift, the page and the chaser will disagree about the same lead and neither list will be trustworthy.

### 7.6 The stored site-health reading

**Model — `src/models/HealthSnapshot.ts`** *(new)*. A singleton, following the repo's Mongo rules exactly:

- `checkedAt: Date`, required.
- `sites`: a bounded array (validator at 20) of `{ name: String maxlength 60, up: Boolean, detail: String maxlength 200 }`, `_id: false`, `strict: true`.
- `timestamps: { createdAt: true, updatedAt: true }` — updates are the point of this record.
- **No TTL.** The newest reading must always be present, and it is overwritten rather than accumulated.
- No `Schema.Types.Mixed`, no unbounded string.

`SiteResult` from `siteHealth.ts` is already `{ name, up, detail }`, so the stored shape is the produced shape and there is no mapping layer to drift.

**Accessor — `src/lib/healthSnapshot.ts`** *(new)*: `saveHealthSnapshot(checkedAt, sites)`, `getHealthSnapshot()`, and the floor itself as a pure function (R32):

```ts
export const CHECK_FLOOR_MS = 60_000;                                          // (new)
export function isWithinCheckFloor(                                            // (new)
  now: Date, checkedAt: Date | null, floorMs: number = CHECK_FLOOR_MS
): boolean;   // a null snapshot is never within the floor
```

**The floor is a pure function, not a branch inside the handler**, so it is unit-testable without a route, a database or a network — the same rule the rest of the logic layer follows.

**One trap that contradicts the house pattern.** `getOsSettings()` reaches its singleton with `findOneAndUpdate({}, …, { upsert: true })` on *read*. **`getHealthSnapshot()` must not.** An upsert-on-read would manufacture a document with a defaulted `checkedAt` and an empty `sites` array, and the strip would confidently report "checked just now, no sites watched" when in truth it has never run. Read with `findOne().lean()`, return `null`, and let Block F say `sites never checked`. The upsert belongs to the write path only.

**Route — `POST /api/health/sites`** *(new)*, thin. POST means "take a new reading"; the noun is what is being read, which leaves `GET` free if a JSON view is ever wanted. Handler order, first line first:

1. `const denied = await requireSession(request); if (denied) return denied;` — this is also the Origin check, which `requireSession` already performs for mutating methods. **No proxy change:** the path is under `/api/` and not in `isPublicPath`, so it is already fail-closed.
2. `await connectDB()`. **The floor reads the stored snapshot, so it needs the database** — it cannot sit above this line.
3. `getHealthSnapshot()`, then `isWithinCheckFloor(new Date(), snapshot?.checkedAt ?? null)`. Inside the floor, **return 200 with the existing reading**, not a 429. **No new collection, no counter, and specifically not an in-memory map** — on Vercel that is per-instance and therefore not a limit at all.
4. `checkSites()`, then `saveHealthSnapshot()`.
5. Return the reading as JSON.

**Client island — `CheckNow.tsx`** *(new)*, about 30 lines: `useState` for busy, `fetch` the POST, then `router.refresh()` from `next/navigation`. `router.refresh()` re-runs the server render and reconciles in place, so the new reading arrives through the same server path as a page load and the island never has to know a snapshot's shape. **Check by hand once that the `<details>` blocks do not snap shut on refresh** — an element remounted rather than reconciled would.

**The cron's write goes inside the existing `site-health` job** in `src/app/api/cron/morning/route.ts`, after `checkSites()` resolves, **in its own `try/catch`**, counted as `itemsFailed: 1` on failure:

```ts
const health = await runJob("site-health", async () => {
  const results = await checkSites();
  let saveFailed = false;
  try { await saveHealthSnapshot(new Date(), results); }
  catch (err) { saveFailed = true; console.error("[cron/morning] snapshot write failed:", err); }
  return { counts: { itemsProcessed: results.length, itemsFailed: saveFailed ? 1 : 0 }, data: results };
});
```

**Why that ordering.** The dispatcher composes the digest from `health.data` later in the same invocation. If the snapshot write were allowed to throw, the job would be `ok: false` and today's digest would lose its site lines — trading the outer safety net for a cosmetic persistence step. Catching it and counting it means tomorrow's watchdog names it as `site-health: 1 item failed`, which is the right report: a failure of our own machinery is a real failed item, unlike `outreach-health`'s *findings* about another system.

It correctly does **not** run in the monitoring-disabled branch, where `site-health` only files a note-run. The snapshot then ages and Block F says so, which is the truth.

### 7.7 Fonts, manifest, icons

**Fonts** — `next/font/google` in `src/app/layout.tsx`. It downloads at build time and serves from `/_next/static`, which is `'self'`, so **the CSP needs no change at all** — not even a `font-src`, because `default-src 'self'` covers it.

```ts
import { Archivo, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
const display = Archivo({ subsets: ["latin"], display: "swap", variable: "--display" });
const body    = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400","500","600"], display: "swap", variable: "--body" });
const mono    = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--mono" });
// <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
```

Pitfalls: variable families must **omit** `weight` while static families require it, and `next/font/google` throws a clear build error either way — let the build tell you rather than guessing. Keep `adjustFontFallback` on (the default) so the swap does not shift the layout. Use `display: "swap"`, not `"optional"`, which can silently drop the webfont on a first load — and the mono is the part that must stay. The recorded escape hatch, if Google's CDN ever fails a build, is `next/font/local` with committed `.woff2` files; all three families are OFL-licensed. Do not do it pre-emptively.

**Manifest** (`src/app/manifest.ts`): `background_color` and `theme_color` both `#08090B` (`--void`). The background colour is the splash ground; left at `#ffffff` the installed app flashes white on every launch, which is the most visible possible bug in a dark-only design.

**Viewport** (`src/app/layout.tsx`): add `themeColor: "#08090B"` and `colorScheme: "dark"` to the **`viewport`** export. Next reads `themeColor` from `viewport`, not from `metadata`; putting it in `metadata` silently does nothing.

**Status bar**: `appleWebApp.statusBarStyle` changes from `"default"` (which paints a light bar) to **`"black"`** — not `"black-translucent"`, which slides content under the status bar and needs the safe-area layout work this phase defers.

**Icons** (`src/app/icon.tsx`, `src/app/apple-icon.tsx`): the brand tile becomes the app icon — an orange gradient square with the sunburst glyph. **Export full-bleed; do not bake the 7px radius into the PNG** — that radius is specified at the rail's 24px tile, at 512px it would be a hairline of a corner, and both iOS and Android mask the icon themselves. `ImageResponse` renders through satori, whose SVG support is the historically fragile part: a failure surfaces as a broken image rather than a compile error, so **look at the output after the first build**.

`public/sw.js` is unchanged; its default notification target `/queue` is still correct.

### 7.8 What must not ship

- **`docs/design/components.html` is never served and never bundled.** It lives under `docs/`, so Next will not serve it; the rule is that it is never copied into `public/` and never imported. It also carries a `<link>` to `fonts.googleapis.com`, which from the app's own origin would be both a CSP violation and a real third-party request. The stylesheets name the file in their comments on purpose, so the check looks for a real reference rather than the bare name. Verification: `git grep -n -E "(from|import|href|src|url)[[:space:]]*[:=(]?[[:space:]]*["'][^"']*components\.html" src/ public/` returns nothing.
- **Its `<script>` block ships nowhere** — the night-sky illustration and the animated constellation are decorative by construction and belong to a graph that does not exist.
- **No `dangerouslySetInnerHTML`, anywhere.** Every SVG is JSX.
- **No client-side fetching where the server already has the data.** The Freelance page never fetches its own API from the browser. (`/queue` does today; it is left alone.)
- **No new dependency.** Not `clsx`, not `date-fns`, not an icon package, not `next-themes`.
- **No CSP change.** No `font-src`, no `img-src`, no `style-src`.
- **No new `NEXT_PUBLIC_*`.** `ST_API_SECRET` never leaves the server; `CheckNow` posts to a route.

---

## 8. Tests to pin

All pure, in `src/lib/__tests__/`, in the existing Vitest style — no database, no network.

| File | Pins |
|---|---|
| `watchdog.test.ts` (existing, **unchanged**) | That the `classifyAgentRun` extraction did not move the digest, and that **`watchdog` is deliberately absent from `EXPECTATIONS`** |
| `agentStatus.test.ts` *(new)* | All six badge states, including **`off` derived from the switches and never from a run's note string**; `expiry-sweep` is never `off`; the boundary at `AGENT_STALE_HOURS`; `itemsFailed > 0` → failed with the `N items failed` caption; totality — one row per expectation, in order; an agent outside `RAIL_AGENTS` never appears |
| `freelanceView.test.ts` *(new)* | **`Nothing waiting on you.` fires only when drafts, approved and never-contacted are all zero or absent** — never under a lit card. Block A singular and plural; hidden-at-zero; "didn't report" is never a zero; only the drafts card carries a link. Block B stage order and labels; the `Nothing yet at …` grammar at four, two, one and none; the separate not-reported line; the dropped `· N hot` clause at zero and at absent; `No contacts yet.`. Block C bound, the `0`-vs-`—` cell rule, sort order |
| `freelanceVariants.test.ts` *(new)* | **The reply rate is recomputed locally and the upstream `replyRate` is never printed**; no rate for zero sends; no rate for a non-email channel, ever; the two-group split; the replies column dropped from group 2; `No sends yet — nothing to compare.` when every `sends` is 0; **the honesty note renders only when at least one rate is printed** |
| `freelanceGaps.test.ts` *(new)* | The three row kinds; `liveAnchorIds` suppression; the overdue row's empty channel slot; the bound and `Showing 20 of 41.`; ordering stability |
| `freelanceHealth.test.ts` *(new)* | The quiet single line; every `evaluateOutreach` warning passed through verbatim; **the card-vs-footer switch** — quiet form with no warnings, alarm form with one or more; **the 30-hour stamp rule**: past the threshold `all sites ok` is not printed and the stamp becomes `sites not checked since 2d ago`; `sites never checked` amber with monitoring on and grey with it off; `Engine — unknown` |
| `format.test.ts` *(new)* | **Both `formatAge` grammars** at their boundaries — 59 min, 60 min, 47 h, 48 h, 6 d, 7 d — plus pluralisation |
| `stApi.test.ts` (extended) | **The carry-through:** a full JSON body arrives with no `undefined`; a missing `contacts` block yields `null`, not seven zeros; a non-numeric count yields `null`; `Object.keys(byPipelineStage)` equals `PIPELINE_STAGES`; `fetchVariantStats` parses the row shape |
| `healthSnapshot.test.ts` *(new)* | **The 60-second floor**, as a pure function: 59 s since `checkedAt` is within the floor, 60 s and 61 s are not, and a `null` snapshot is never within it |

**The repo has no route-level tests, and P8 adds none.** The route stays thin, its one decision lives in `isWithinCheckFloor`, and that is what a test can reach.

**Verified by build and by looking, because they are not unit-testable:** the cascade order of the four stylesheets; that no `fonts.googleapis.com` reference survives into the built HTML; a clean browser console with no CSP violation; the rail degrading to six grey `—` badges (force it by pointing `MONGODB_URI` at nothing locally); the `<details>` chevron and its survival across `router.refresh()`; the generated icon PNG; and the deck's §7 render actually looking finished with today's near-empty data.

---

## 9. Verification before "done"

1. **The standing trio, all green:** `npm test` · `npx tsc --noEmit` · `npm run build`.
2. **`git grep "var(--alert)\|var(--amber)" src/` returns nothing.** A custom property that resolves to nothing is invalid at computed-value time, so `color: var(--missing)` would silently **inherit** — a red warning rendering in body grey, in the one place it matters.
3. **`git grep -n -E "(from|import|href|src|url)[[:space:]]*[:=(]?[[:space:]]*["'][^"']*components\.html" src/ public/` returns nothing.**
4. **Observed once against real data** (`CLAUDE.md`). Concretely: `/freelance` rendered on Vercel with today's real ShikksTracker numbers and nothing typed by hand — D11 satisfied for one page — with the rail's six badges live beside it showing real agent states. `Check now` pressed once and the strip updated; pressed twice inside a minute without an error.
5. **`git grep -nE '(^|[^a-zA-Z/])[/]queue' -- src/ public/ next.config.ts` returns exactly three lines** — the redirect's `source`, and the two `proxy.test.ts` fixtures that use `/queue` as an example protected path and a traversal string. Any other hit is an address that was missed.
   **The pattern must be written with `[/]`, not a leading `/`.** In Git Bash on Windows, MSYS path conversion rewrites a `git grep` argument that begins with `/` into a Windows path, and the grep then matches nothing and *passes for the wrong reason*. (`MSYS_NO_PATHCONV=1` is the other fix.)
6. **The build's route table lists `/freelance`, `/freelance/queue`, `/settings`, `/login` and no `/queue`.** Delete `.next/` before the build: a route move leaves a stale manifest behind.
7. **By eye:** `/queue` redirects; signed out, it redirects to `/login?from=/freelance/queue`; sign-in lands on `/freelance`; the switch renders under the title on both views with **exactly one tab active** and **at most one `aria-current="page"` per `<nav>`, and every one of them points at the current URL** (R44, R46) — two on `/freelance` (the rail's Freelance link and the switch's Dashboard link point at the same URL), one on `/freelance/queue`, one on `/settings`; the track reads as **recessed against `--void`**, not as a floating lighter bar; the rail marks Freelance active on both views; the four columns share one left edge; the rhythm is §3.4's, and the switch's line box measures `margin-top + 33.3px` with nothing under it; the tab order is rail → switch → content.

---

## 10. Open items carried forward

1. **The `sendingEnabled` contract gap.** `GET /api/os/summary` should additively return the two switch states it already holds in ShikksTracker's `Settings`: `"engine": { …, "sendingEnabled": false, "draftGenerationEnabled": false }`. The proposal is written in full in the P8 design doc; **RikuOS cannot make this change** (prime directive). When it lands, widen `SummaryEngine` **and** carry the fields through `fetchSummary`'s reconstruction in the same change, with a test — and Block A's `Sending is off` line ships with a 5px `--ink-3` dot and no warning hue.
2. **The money-in card, and the hue question it carries.** The fourth hero card is a later phase, and the 920px column already holds it. **Whether it takes orange or green is an open question at the reference's level, not this phase's:** `DESIGN-INSPO.md` §5.11 maps freelance to orange "because it is money work", while §2 defines orange as money *leaving* and green as value *recovered*. Both have a claim. It is decided when the money-in phase is designed and recorded as a reference decision then. **Nothing on P8 needs to move either way**, and at most three of the four cards are ever hued.
3. **The money-in log itself** stays inside RikuOS as the future feed for money statistics — a D11 supplement, recorded in S18, built in its own phase.
4. **The phone pass.** Six components need work at 390px and five of them are the same fix: a fixed multi-column grid becoming a stack. For P8 specifically — the 170px rail has no mobile form (bottom tabs or a sheet, decided later), Block B's pipeline rows and Block E's needs-you rows must stack, the top bar's pushed-right group must reflow, and the `env(safe-area-inset-*)` padding dropped from `main` in §6.2 comes back. The hero row already uses `auto-fit / minmax` and needs no work.
5. **Dead vocabulary must not grow.** `.statstrip`, `.btn.go`, `.statuspill` and `--session` ship declared and unused, and that is settled. Nothing may be added to the list.
6. **`legacy.css` has an expiry date.** It exists so queue, settings and login can be re-skinned without being rewritten; it is deleted in the phase where those pages get their own content discussion under S11.
7. **Over-cap leads in Block E, left deliberately.** A reply the chaser skipped only because it hit `CHASER_MAX_PER_RUN` will be drafted on the next run, so it is arguably not a gap — but it has no `ApprovalItem` yet, so it surfaces here. A backlog that never clears is worth seeing, and suppressing it would hide a real signal. Revisit only if it proves noisy.

**Two of the P8 design doc's three open items are closed by this spec:** the campaign display bound is 20 (§4.3 — the deck's own `Showing 20 of 34 campaigns.` settles it), and `Check now`'s floor is 60 seconds enforced server-side (§4.6, §7.6). The third — over-cap leads — is item 7 above.
