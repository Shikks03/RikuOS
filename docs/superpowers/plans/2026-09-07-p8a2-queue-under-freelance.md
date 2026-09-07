# P8a-2 — The queue under Freelance: spec delta and implementation plan

**Date:** 2026-09-07 · **Written by:** the Frontend Architect, from **R42** in `docs/superpowers/design/p8-team/round4-lead-rulings.md` ("Riku's decision after Plan A").
**Revision:** revised in one pass against the Design Critic's `round5-design-critic-a2.md` and the lead's rulings on it — **R43** (the title → switch gap is 6px), **R44** (`aria-current` follows the page, `.is-active` the area), M1–M4, S1–S6 and notes N2, N4–N7. `.segmented` keeps the reference's `display:inline-flex`; the provisional call for `display:flex;width:max-content` was reversed and is now the written fallback behind a required measurement. **Status:** for the lead's review. Nothing here is built.

**Goal:** move the queue under the Freelance address, make the Freelance overview the landing page, and give the segment a header — the page title plus the design system's **view switch** — rendered above both views.

**Sequence:** A-2 runs after Plan A and **before Plan B**, because Plan C would otherwise build the page title in the wrong place. Plan A's Task 13 steps 5–6 are still outstanding; they fold into A-2's verification as one by-eye pass (R42). Three build tasks, one verification task, then the Spec Editor's docs commit (Task 5), which also brings `p8-mockup.html` up to date.

**Architecture:** `/queue` becomes `/freelance/queue` by moving the folder. A new `freelance` segment layout renders `<h1 class="fl-title">Freelance</h1>` and, directly under it, a two-link view switch, then the view. The layout renders **no `<main>`** — the Dashboard brings `<main class="app-content">` and the Queue view brings `legacy.css`'s `<main>` — and the header reuses `.fl`, the same 920px column both views use, so the three columns align by construction rather than by arithmetic (R34). The old address is kept alive by a permanent redirect in `next.config.ts`, which runs before the proxy.

**Tech stack:** unchanged. **No new dependency. No CSP change. `src/proxy.ts` is not edited.**

---

# Part 1 — Spec delta

Amendments to `docs/superpowers/specs/2026-09-07-p8-freelance-page-visual-design.md`, written in the spec's own register so they can be pasted in. R42's calls are recorded, not re-argued; where R42 left a number or a mechanism open it is decided here and the reasoning is given.

## §3.1 Rail anatomy — amended

Replace the **Nav** bullet's first sentence:

> - **Nav.** Two items — **Freelance, Settings** — each a 13px hand-drawn stroke glyph plus a 12.5px label at `--ink-3`, padding `6px 9px`, radius 7px, gap 9px. **Both carry a glyph or neither does; never a mix.** The active item takes a raised fill `#171B21`, an `--ink` label, and an **inset hairline** (`box-shadow: inset 0 0 0 1px var(--line)`) — never a left accent bar.
>
> **The rail marks Freelance active on both Freelance views.** `NavList` matches `.is-active` with `pathname === href || pathname.startsWith(href + "/")`, so `/freelance/queue` lights Freelance.
>
> **`aria-current="page"` does not follow that match; it uses equality (R44).** The class follows the **area** — the rail names an area, and Freelance must stay lit on the Queue view. ARIA defines `page` as "the current page within a set of pages", and on `/freelance/queue` the rail's Freelance link points at a *different* URL; without the split, that link and the switch's Queue link would both claim to be the current page on one screen. **The view switch (§3.4) matches by equality for both**, because on the switch the area and the page are the same thing.

The sentence "Adding `/personal` later is one entry in this array" stands and is now the *second* entry rather than the fourth.

## §3.4 The Freelance header and the view switch — new

> A `freelance` segment layout renders the page header above **both** views. It renders **no `<main>`**: `/freelance` brings its own `<main class="app-content">` and `/freelance/queue` brings `legacy.css`'s `<main>`, and two `<main>` elements in one document is invalid HTML.
>
> ```
> <div class="fl-head">          padding 28px 28px 0
>   <div class="fl">             the same 920px column both views use
>     <h1 class="fl-title">Freelance</h1>
>     <nav class="segmented" aria-label="Freelance views">
>       <a href="/freelance"       class="on" aria-current="page">Dashboard</a>
>       <a href="/freelance/queue">Queue</a>
>     </nav>
>   </div>
> </div>
> {the view}
> ```

### The switch is two links, not a tablist

**Links, because they are two URLs.** `role="tablist"` describes panels swapped in place: no address change, `aria-controls` pointing at a panel in the same document, and roving-tabindex arrow-key behaviour the author must implement. These are two real routes. They are deep-linkable, back-button-able, right-click-openable, and one of them (`/freelance/queue`) is the target of every push notification the app sends. Announcing them as tabs would describe an interaction model the page does not have, and would be *worse* than plain links unless the arrow-key behaviour were also built — which would be client code written to make a lie consistent.

**`<nav>`, with an accessible name.** R40 left the document's single `<nav>` unnamed on the grounds that it was the only one. A-2 makes it not the only one, so the new landmark is named `aria-label="Freelance views"` — **and the rail's `<nav>` is named `aria-label="Main"` in the same commit**, because two unnamed navigation landmarks announce as "navigation" and "navigation" (ruled).

**`aria-current="page"`** on the active link, and `class="on"` as the styling hook. The switch computes both from the same equality test; the rail does not (R44, §3.1).

**Active is exact equality, never `startsWith`.** `/freelance` is a prefix of `/freelance/queue`, so `startsWith` would light **both** tabs on the Queue view. The rail uses `startsWith` for `.is-active` precisely so Freelance stays lit there, and equality for its `aria-current` (R44). **The class rules are deliberately opposite and each file says so.** (A future `/freelance/queue/:id` would light neither tab; there is no such route, and it is one line to change when there is.)

### The switch's CSS — ported, with the source quoted

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

**The recess is defined against a ground the app does not have.** `DESIGN-INSPO.md` §2 maps `--sunk` (`#050608`) to "Recessed wells, control tracks", while the reference's own control track is `#101318` — and the drawn file is the truth (spec §"four companions"). But the half of that tension that matters is the **ground**: in `components.html` the switch specimen sits inside `.well{background:var(--sunk)}`, so track-to-ground contrast is Δ(11,13,16). On `/freelance` the switch sits on `--void` `#08090B`, and Δ drops to (8,10,13) — **about a quarter less separation**. The port is byte-faithful and lands ~25% flatter than drawn, with the `--line` hairline doing more of the work. `#101318` is kept, because eye-diffability against `components.html` is the file's stated rule and this is not worth breaking it for. **If it reads as a floating lighter bar rather than a recess, the alternative is `--sunk` for the track, which would make the recess literal — that is a ruling, not a tidy.** Task 4 step 5 item 1 is the check that can fail.

`border-radius:9px` on the track is outside the radius set (`--r-tag` 6 · `--r-nav` 7 · `--r-chip` 8 · `--r-card` 10 · `--r-feature` 14 · `--r-pill` 999) and ships as a literal, the same way `.app-brand .tile{border-radius:7px}` and `.track{border-radius:99px}` already do.

**The first label sits 16px in from the track's left edge** (1px border + 3px track padding + 12px tab padding). That is the reference's own construction. **The track's edge, not the label, is what aligns with the title** — worth saying, because zeroing the first tab's left padding to "fix" the alignment would break the track.

**Focus.** `base.css`'s `:focus-visible{outline:2px solid var(--spend);outline-offset:3px;border-radius:3px}`, unchanged and unqualified. Arithmetic: a tab's border box sits 4px inside the track's (1px border + 3px padding), and the ring is drawn 3px outside it and 2px thick, so the ring's outer edge lands ~1px beyond the track and overlaps the neighbouring tab by ~2px. Outlines do not affect layout and nothing here sets `overflow:hidden`, so this is a paint overlap and not a reflow. **The ring rule's `border-radius:3px` would square the tab's corners while focused, except that `:focus-visible` is `(0,1,0)` and `.segmented a` is `(0,1,1)`, so the 6px radius survives** — the kind of thing a later radius tidy would break.

**Hover, active, motion.** Hover as above. No `transition` on the switch — the change of view is a navigation, not an animation, and `prefers-reduced-motion` therefore has nothing to suppress here.

**§5.7 is unchanged.** The switch takes `base.css`'s global focus ring and declares no transition, and `::selection` is untouched. Focus, selection and motion were considered, not skipped.

### Label text and casing as rendered

The DOM text is **`Dashboard`** and **`Queue`**, sentence case, exactly as R42 names the views and exactly as the reference writes its own markup (`<button class="on">Subscription</button>`). `text-transform:uppercase` renders them **`DASHBOARD`** and **`QUEUE`** in JetBrains Mono at 9.5px / `0.13em`. This is the reference's stated rule for controls — "Controls are labelled in the machine's voice; content is labelled in yours" — and it matches the rail, which also stores sentence-case labels.

### The vertical rhythm, as numbers

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

### The header's horizontal column — the arithmetic

Let `A` be the width of `.app-main` (viewport minus the 170px rail track; the rail's right border is inside that track under `box-sizing:border-box`). Four columns must share one left edge (R34):

| Column | Computation | Left edge |
|---|---|---|
| `.topbar` → `.topbar-in` | `padding:0 28px`; inner `width:100%; max-width:920px; margin:0 auto` (auto margins absorb free space in a flex container) | `28 + max(0, (A − 56 − 920) / 2)` |
| `.fl-head` → `.fl` | `padding:28px 28px 0`; `.fl{max-width:920px;margin:0 auto}` | `28 + max(0, (A − 56 − 920) / 2)` |
| `main.app-content` → `.fl` (Dashboard) | `padding:28px 28px 72px; max-width:none`; the same `.fl` | `28 + max(0, (A − 56 − 920) / 2)` |
| `legacy.css` `main` (Queue) | `max-width:calc(920px + 2 × 28px) = 976px; margin:0 auto; padding:28px …` | `max(0, (A − 976) / 2) + 28` |

`A − 976 = A − 56 − 920`, so all four expressions are the same number, and below `A = 976` all four collapse to a flat 28px inset. **The header reuses `.fl` rather than declaring its own 920px column** — that is what makes the alignment true by construction rather than by two rules that must be kept in step. The cost is two `.fl` elements in the Dashboard's document, the header column and the content column, which is honest: they are deliberately the same column.

### New class names

Exactly two, and both have a consumer in the same commit:

- `.fl-head` — the header's padding shell. New page vocabulary, `fl-` prefixed, because the reference has no name for it.
- `.segmented` / `.segmented a` / `.segmented a.on` — the reference's own names, ported.

Plus one normalisation rule, `.fl > :first-child { margin-top: 0 }`, which declares no vocabulary, and one declaration added to the existing `.fl-title` rule (`line-height:1.5`, M4) — a pin, not a change: the value is what `.fl-title` already inherits, and it is **not** a difference from the mockup and must not be added to `components.css`'s numbered differences list.

**No declared-but-unused vocabulary is added.** The §5.8 list stays `.statstrip`, `.btn.go`, `.statuspill`, `--session` — `.range` is explicitly not ported, and one entry is *removed* from the app (see §5.8 below).

## §5.3 The scale actually used — one row amended, one added (M4)

§5.3's header says "Read off the mockup's CSS. This is the whole inventory; nothing else has a size." The header's entire arithmetic depends on `.fl-title`'s line-height, which the inventory did not carry — and `line-height:1.2` on a display heading is the single most natural "tidy" anyone would apply to that rule. R42 requires the rhythm to be *stated*, and a number that silently depends on an undeclared inherited value is not stated.

**Amend the existing page-title row:**

| Element | Spec |
|---|---|
| Page title `.fl-title` | display 600 · 24px · `-0.02em` · **line-height 1.5 (inherited; load-bearing for §3.4's title→switch gap — do not tighten without re-deriving it)** |

**Add:**

| Element | Spec |
|---|---|
| View-switch tab `.segmented a` | mono · 9.5px · `0.13em` · uppercase · **line-height 1.4** · `--ink-3`, `--ink` when active or hovered · `6px 12px` · radius 6px |

And declare `line-height:1.5` explicitly on `.fl-title` in `components.css` with a one-line comment naming §3.4, exactly as `.stat .fig` already carries an explicit `line-height:1.06` for the same reason.

## §5.8 Declared vocabulary that renders nowhere — amended

The `.statstrip` / `.btn.go` / `.statuspill` / `--session` list is unchanged and, per its own rule, **does not grow**: the view switch ships with its consumer, and the reference's `.range` is not ported. (`IconQueue`'s deletion is recorded in §7.2's Icons paragraph, where the icon inventory lives.)

## §6.2 Costs, named rather than discovered later — three added

> **The Queue view starts 10px lower than the Dashboard view.** `legacy.css`'s `main` gives both views a 28px top padding; the queue page's first child is a `.row`, whose `margin-top: var(--sp-3)` adds 10px on top of it. Removing it needs either a TSX edit (R18 forbids further edits to that file) or a new rule in `legacy.css` (its header forbids additions). This is the same 10px recorded as carry-forward (5) after Plan A; the view switch does not create it but does put the two views one click apart, which makes it easier to see. It goes when the queue page gets its own S11 content discussion and is rebuilt.
>
> **Two stacked control rows on the Queue view, with the emphasis inverted.** The view switch and the status-filter row sit 38px apart, on the same left edge, both in 9.5px mono caps, both bearing a selection. The *grammar* is correct and is the reference's own: §5.3 gives the recessed track to the control that "switches what you're looking at" and no track to the one that "switches the window you're looking through", and a status filter genuinely is the second. What is inverted is the **emphasis**. §5.3 gives that second control the loudest active state in the system — "a solid white pill with dark text… correctly so, because it silently reframes every number on the page" — and the named cost above took it away, so the six filters differ only by border and label brightness. A-2 therefore puts a navigation control with a solid raised fill 38px above a reframing control with none: **the navigation shouts and the reframing whispers.** When the queue page gets its S11 discussion, the fix is to port `components.html`'s `.range` (lines 268–273) for the status-filter row — the reference's own answer to "a filter row under a view switch", one rule, and it restores the emphasis order. That is also the future consumer whose absence is today the reason not to port `.range` (§5.8).
>
> **`/settings` now has no header at all.** Both Freelance views gain a 103px header band with a 24px title; `/settings` has had no heading of any level since the inline headers were deleted (§6.3) and gains nothing. Two of the three signed-in pages are titled and one is not, and the asymmetry is now structural rather than incidental. That is carry-forward (4); A-2 sharpens it and does not fix it.

## §7.2 Route group and shell — amended

**Replace the tree, and the paragraph beginning "A route group changes no URL". The *Rejected*, *Active nav is a client island*, *A session check in the layout* and *Icons* paragraphs stand, with two corrections: the login default is `/freelance`, and the shell has **four** client islands — `NavList`, `LogoutButton`, `TopBar` (R39) and `ViewSwitch` — each for one reason.** (M3. The delta's blockquotes below cover the routes, the redirect, the landing and the segment layout; they do **not** restate the rejected alternative, the defence-in-depth rationale or the icon inventory, and all three are ratified and still true.)

The tree, with every `_shell/*` row kept and its annotation corrected:

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

And the **Icons** paragraph gains its inventory correction:

> **Icons.** `src/components/icons.tsx`, named exports, no registry: `IconFreelance`, `IconSettings`, `IconInfo`, `IconMark` (the brand sunburst). **`IconQueue` is deleted by A-2** — the rail's two items are Freelance and Settings, so the glyph loses its only consumer, and §5.8 forbids declared-unused vocabulary. That is the same reasoning that already kept `IconLogout` out. All `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.8}`, round caps, `aria-hidden="true"`. Where the design uses a text glyph — `↗`, the chevron — use the literal character, not a component.

> **The routes.** `/freelance` is the Dashboard view; `/freelance/queue` is the Queue view. The move is `git mv src/app/(app)/queue src/app/(app)/freelance/queue`; the folder's contents are unchanged except the one `?from=/queue` literal, which becomes `/freelance/queue` — a route move's mechanical consequence, allowed by R42 despite R18. The relative `./PushControls` import moves with the folder.
>
> **`/queue` is permanently redirected** to `/freelance/queue` by `redirects()` in `next.config.ts`. Config redirects run **before** the proxy, so a signed-out hit on `/queue` becomes `/login?from=/freelance/queue` rather than `/login?from=/queue`. `src/proxy.ts` is not touched and needs nothing: `isPublicPath` is an allowlist, `/freelance/queue` is not on it, and the path contains no `%`, `..` or `//`, so it is treated exactly as `/queue` was. `next.config.ts`'s `headers()` block — the CSP — is not touched either.
>
> **The landing.** `/` redirects to `/freelance`; `manifest.ts`'s `start_url` is `/freelance`; the login page's default `from` is `/freelance`. Push notifications keep opening the queue: `buildPushPayload`'s default url and `public/sw.js`'s two fallbacks become `/freelance/queue`, and the morning cron's `Re-subscribe from …` names the new path.
>
> **The segment layout renders no `<main>`.** It renders `.fl-head > .fl > h1 + nav.segmented`, then `{children}`. The `(app)` layout above it already did the session check; the segment layout does none.
>
> **The switch is the shell's fourth client island**, and like the other three it exists for exactly one reason: `usePathname()` for the active state. It lives at `src/app/(app)/freelance/ViewSwitch.tsx`, beside the layout that renders it — the same colocation `src/app/(app)/freelance/queue/PushControls.tsx` already uses beside its page. Not `_shell/`, which is for chrome rendered on every page; not `_blocks/`, which Plan C owns for the page's content blocks.

**Carry-forward (4) is partly closed, and sharpened.** `/freelance/queue` now inherits a real `<h1>` from the segment layout, so the Queue view goes from *no heading of any level* to exactly one — verified: `git grep "<h1" src/` returns two hits, `freelance/page.tsx` (which Task 3 step 4 removes) and `login/page.tsx` (outside the group). What A-2 does not fix: the one `<h1>` says `Freelance` on **both** views, so the view's identity lives entirely in a control and in `aria-current`, and the browser tab title is still `APP_NAME` on every page — which is now the weakest link, because two Freelance views at two URLs are indistinguishable in a tab strip. That argues for pulling carry-forward (4) forward; it does not argue for changing A-2.

**Carry-forward (2) gains a sentence.** The header is not sticky. On the Queue view with a full list the switch scrolls away, and there is no way back to the Dashboard except the rail — which is not sticky either, which is why this belongs in that carry-forward rather than here. It is the first time the app has an *in-page* navigation control that can leave the screen, and carry-forward (2)'s sentence should say so.

## §9 Verification before "done" — additions

Add to the list:

> 5. **`git grep -nE '(^|[^a-zA-Z/])[/]queue' -- src/ public/ next.config.ts` returns exactly three lines** — the redirect's `source`, and the two `proxy.test.ts` fixtures that use `/queue` as an example protected path and a traversal string. Any other hit is an address that was missed.
>    **The pattern must be written with `[/]`, not a leading `/`.** In Git Bash on Windows, MSYS path conversion rewrites a `git grep` argument that begins with `/` into a Windows path, and the grep then matches nothing and *passes for the wrong reason*. (`MSYS_NO_PATHCONV=1` is the other fix.)
> 6. **The build's route table lists `/freelance`, `/freelance/queue`, `/settings`, `/login` and no `/queue`.** Delete `.next/` before the build: a route move leaves a stale manifest behind.
> 7. **By eye:** `/queue` redirects; signed out, it redirects to `/login?from=/freelance/queue`; sign-in lands on `/freelance`; the switch renders under the title on both views with **exactly one tab active** and **exactly one element on the page claiming `aria-current="page"`** (R44); the track reads as **recessed against `--void`**, not as a floating lighter bar; the rail marks Freelance active on both views; the four columns share one left edge; the rhythm is §3.4's, and the switch's line box measures `margin-top + 33.3px` with nothing under it; the tab order is rail → switch → content.

## Series file map — the A-2 delta

| File | Plan | Responsibility |
|---|---|---|
| `next.config.ts` | **A-2 modifies** | Gains `redirects()`: `/queue` → `/freelance/queue`, `permanent: true`. `headers()` byte-unchanged. |
| `src/app/page.tsx` | **A-2 modifies** | `/` redirects to `/freelance`, the landing page. |
| `src/app/manifest.ts` | **A-2 modifies** | `start_url: "/freelance"` — the installed app's start page. |
| `src/app/login/page.tsx` | **A-2 modifies** | The default `from` becomes `/freelance` (and the comment that quotes it). Nothing else; the `?from=` validation is unchanged and already accepts `/freelance/queue`. |
| `src/lib/push.ts` | **A-2 modifies** | `buildPushPayload`'s default url becomes `/freelance/queue`. |
| `src/lib/__tests__/push.test.ts` | **A-2 modifies** | The default-url assertion, in the same commit as the code it pins. |
| `public/sw.js` | **A-2 modifies** | Both fallback urls — the push handler's and `notificationclick`'s. |
| `src/app/api/cron/morning/route.ts` | **A-2 modifies** | One message string: `Re-subscribe from /freelance/queue.` |
| `src/app/(app)/queue/` → `src/app/(app)/freelance/queue/` | **A-2 moves** | `git mv`. Contents byte-unchanged except the one `?from=` literal. |
| `src/app/(app)/freelance/queue/page.tsx` | **A-2 modifies** | The `?from=/queue` literal only (R42 over R18). |
| `src/app/(app)/_shell/NavList.tsx` | **A-2 modifies** | `NAV` becomes Freelance, Settings. The `IconQueue` import goes. The `startsWith` match is commented against the switch's equality match. |
| `src/components/icons.tsx` | **A-2 modifies** | `IconQueue` deleted — no consumer, and §5.8 forbids dead vocabulary. |
| `src/app/(app)/layout.tsx` | **A-2 modifies** | Docblock only: the login default is `/freelance`. |
| `src/app/(app)/_shell/LogoutButton.tsx` | **A-2 modifies** | Docblock only: the provenance sentence loses a stale address. |
| `src/styles/legacy.css` | **A-2 modifies** | Header comments only: the three prose mentions of `/queue` name the new address. No rule is added. |
| `src/styles/components.css` | **A-2 modifies** | Adds `.fl > :first-child{margin-top:0}` inside the section-rhythm block, then `.fl-head` and the `.segmented` port in a new header block; pins `line-height:1.5` on the existing `.fl-title` rule (M4). |
| `src/app/(app)/freelance/layout.tsx` | **A-2 creates** | The segment header: `<h1 class="fl-title">` + the view switch. Renders **no** `<main>`. |
| `src/app/(app)/freelance/ViewSwitch.tsx` | **A-2 creates** | `"use client"`. Two `<Link>`s, `aria-current="page"`, exact-equality active match. |
| `src/app/(app)/freelance/page.tsx` | A creates, **A-2 modifies**, **C rewrites** | Loses the `<h1>`; the frame stays so Plan C's Task 2 replaces the file it expects. |
| `docs/design/p8-mockup.html` | **A-2 modifies** (Task 5) | A **seventh specimen**: the header band alone at the real 920px column, drawn twice — `DASHBOARD` active and `QUEUE` active — with the 28 / 6 / 28 rhythm. Plus a one-line marked note on the three existing Freelance specimens that their `title → .fl-body` sequence predates R42. The mockup is one of the spec's four companions and "where prose is ambiguous, the mockup is the truth", so leaving it stale would make a falsehood authoritative for the one region A-2 changes. Republished to its existing artifact URL by the lead. |

## Plan C amendments

`docs/superpowers/plans/2026-09-07-p8c-freelance-page.md` needs these and nothing else. A-2 was deliberately shaped to keep this list to two items.

1. **Task 2, Step 1 ("Replace `src/app/(app)/freelance/page.tsx`"), the code block at plan line ~380.** Delete the line

   ```tsx
           <h1 className="fl-title">Freelance</h1>
   ```

   The segment layout owns the title (R42). `.fl`'s first child becomes the whole-page-down `.fl-fail` or, after Task 3, the `.fl-body` group. Both of those carry `margin-top: var(--sp-5)` for a heading that is no longer above them; `components.css`'s new `.fl > :first-child{margin-top:0}` zeroes it, so **Plan C's markup needs no other change** and the hero row sits 28px under the switch.

2. **The "three deviations" preamble, deviation 1** (plan line ~30). Its sentence *"and the page title is `<h1 className="fl-title">`, not the mockup's `<h3>` with an inline margin"* becomes: *"and the page title is an `<h1 className="fl-title">` rendered by the segment layout, not by this page (R42)."* The rest of the deviation — real `<h2 className="fl-h">` block headings — is unchanged.

3. **Nothing else.** In particular: Plan C's ground rule *"`src/styles/*.css` is not edited"* still holds — A-2 ships every rule Plan C renders into. Its self-review class list (line ~1348) is still accurate; `.fl-title` moves out of the page's markup but the class still exists, and Plan C should drop it from that list when it drops the element. `.fl-body` keeps its consumer and its class; only its `margin-top` is neutralised in the position it currently occupies, the same way "DIFFERENCE 3" already neutralises two of `main`'s three declarations. Plan C's checkpoint *"whether `/freelance` exports `metadata.title` is a Plan C ruling"* is untouched by A-2, which adds no `metadata` (ruled), even though it now builds the segment layout that would carry one.

## The draft's open questions, and how they were ruled

All five are closed; recorded here so the document asks nothing that has already been decided.

1. **Name the rail's `<nav>` too — yes.** R40 declined only on the grounds that it was the document's only `<nav>`, and A-2 removes that ground; two unnamed navigation landmarks announce as "navigation" and "navigation". `aria-label="Main"` on `.app-nav` and `aria-label="Freelance views"` on the switch, both in Task 1 step 4 and Task 3 step 2.
2. **No `metadata` in A-2.** It stays Plan C's ruling, with the root layout's `title.template`. A segment-layout title would give both views the same tab title, which is the wrong half of the problem.
3. **No CSS reaching into the queue page's internals for the 10px.** The recorded carry-forward stands; §6.2 is the correct home for the cost. (The refused hatch was a `.fl-view > main > .row:first-child` rule — the third namespace `components.css` exists to refuse.)
4. **Keep `.fl > :first-child{margin-top:0}`** — with M1's placement and comment. The alternative costs a second Plan C amendment and puts `.fl-fail` 48px under the switch.
5. **Take all three one-line edits** — `login/page.tsx`'s comment, `LogoutButton.tsx`'s docblock, `push.test.ts`'s explicit-url example. A comment that quotes a default it no longer has is a lie in the file, and the point of §9's grep expecting *exactly three lines* is that prose does not get to be the exception.

Two rulings were made on the draft itself and are applied throughout: **R43** (the title → switch gap is 6px, not 10px) and **R44** (`aria-current` follows the page, `.is-active` follows the area). The one provisional call that the Design Critic contested was reversed: **`.segmented` keeps the reference's `display:inline-flex`**, and the line-box measurement becomes a required check with `display:flex;width:max-content` as the written fallback.

---

# Part 2 — The plan

## Ground rules for every task in this plan

- **No new dependency.** Not `clsx`, not an icon package, nothing.
- **No CSP change.** `next.config.ts` gains a `redirects()` block; its `headers()` block is byte-unchanged and the verification checks that.
- **No `dangerouslySetInnerHTML`.** The switch is text; there is no new SVG.
- **`src/proxy.ts` is not edited.** `/freelance/queue` is protected by the same allowlist logic that protected `/queue`.
- **The queue page is not edited beyond the one `?from=` literal** (R18, as amended by R42).
- **Repo boundary.** Nothing touches `../ShikksTracker` and nothing connects to its database.
- Every commit runs on `master` and is never pushed. Every commit message ends with the trailer shown in its commit step.
- Commands are written for **Git Bash on Windows** from the repo root (`C:/Users/Shikks/Projects/ClaudeProjects/RikuOS`). Paths containing `(app)` are quoted.
- **`git grep` patterns never begin with `/`.** MSYS path conversion rewrites such an argument into a Windows path and the grep silently matches nothing. Use `[/]` as the first token.

### Why the tasks are ordered this way

Renaming one public address cannot be split without a wrong intermediate commit. If the redirect lands first, `/queue` 308s to a route that does not exist yet. If the folder moves first and the pointers do not, `/` redirects to a 404. So **Task 1 is one commit containing the move and every pointer at it** — after it, the app is internally consistent and only an external bookmark on `/queue` is dead. **Task 2 is the redirect alone**, which is a compatibility shim for the old address (including an already-installed PWA's cached `start_url`) and is a genuinely separate concern that is only correct after Task 1. **Task 3 is the header and the switch**, a new feature. **Task 4 verifies.** **Task 5 is the Spec Editor's docs commit, and it comes after verification rather than before it — one line: the spec should record what shipped, so a by-eye finding (the track's recess, the rhythm) can change the text before it is pasted into a ratified document.** Task 4 therefore keeps its number and nothing else in this plan is renumbered.

---

## Task 1: The address moves

**Files:**
- Move: `src/app/(app)/queue/` → `src/app/(app)/freelance/queue/`
- Modify: `src/app/(app)/freelance/queue/page.tsx` (one literal)
- Modify: `src/app/(app)/_shell/NavList.tsx`
- Modify: `src/components/icons.tsx`
- Modify: `src/app/(app)/layout.tsx` (docblock)
- Modify: `src/app/(app)/_shell/LogoutButton.tsx` (docblock)
- Modify: `src/app/page.tsx`
- Modify: `src/app/manifest.ts`
- Modify: `src/app/login/page.tsx`
- Modify: `src/lib/push.ts`
- Modify: `src/lib/__tests__/push.test.ts`
- Modify: `public/sw.js`
- Modify: `src/app/api/cron/morning/route.ts`
- Modify: `src/styles/legacy.css` (comments)

- [ ] **Step 1: Move the folder**

```bash
git mv "src/app/(app)/queue" "src/app/(app)/freelance/queue"
```

Expected: no output.

Run: `git status --porcelain`
Expected: exactly two rename lines and nothing else:

```
R  src/app/(app)/queue/PushControls.tsx -> src/app/(app)/freelance/queue/PushControls.tsx
R  src/app/(app)/queue/page.tsx -> src/app/(app)/freelance/queue/page.tsx
```

Run: `git diff --cached -M --stat`
Expected: `0 insertions(+), 0 deletions(-)` on both files. If either shows a change, something edited the file — undo it.

- [ ] **Step 2: The one literal in the moved page**

In `src/app/(app)/freelance/queue/page.tsx`, line 55, replace

```tsx
        window.location.href = "/login?from=/queue";
```

with

```tsx
        window.location.href = "/login?from=/freelance/queue";
```

**Nothing else in this file changes** — R18 stands; R42 allows this one literal as the move's mechanical consequence.

- [ ] **Step 3: Delete `IconQueue`**

In `src/components/icons.tsx`, delete the whole export (currently lines 22–29):

```tsx
export function IconQueue() {
  return (
    <svg {...stroke}>
      <path d="M5.5 4.5h13l2.5 8.5v5a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 18v-5z" />
      <path d="M3 13h5l1.5 3h5l1.5-3h5" />
    </svg>
  );
}

```

Leave the file's docblock, the `stroke` constant and every other export untouched. `IconFreelance` becomes the first export.

- [ ] **Step 4: The rail drops to two items**

Replace `src/app/(app)/_shell/NavList.tsx` with this file in full:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconFreelance, IconSettings } from "@/components/icons";

/**
 * One of the shell's client islands, each for exactly one reason:
 * usePathname() here, an onClick in LogoutButton, a per-navigation Date in
 * TopBar, and the same hook again in the Freelance segment's ViewSwitch. This
 * is the smallest correct way to mark the active item — no state, no effects,
 * no data. src/proxy.ts could forward the pathname as a header instead and is
 * deliberately NOT touched: it is the app's authorization boundary and must
 * stay boring. Editing a fail-closed security file to save a kilobyte of
 * hydration is a bad trade.
 *
 * Two items since R42: the queue is a VIEW of Freelance, at /freelance/queue,
 * reached by the view switch the segment layout renders — not a page of its
 * own. Adding /personal later is one entry in this array.
 *
 * Both items carry a glyph. Never a mix.
 *
 * TWO MATCHES, NOT ONE (R44). The prefix match is the OPPOSITE of the view
 * switch's, which compares for equality: /freelance/queue must light
 * Freelance HERE, because the rail names an AREA, and must light only Queue
 * THERE, because the switch names a VIEW. A prefix match in the switch would
 * light both of its tabs; an equality match here would leave the rail with
 * nothing lit on the Queue view.
 *
 * But only the CLASS follows the area. aria-current="page" follows the PAGE
 * and so uses equality, because ARIA defines `page` as "the current page
 * within a set of pages" and on /freelance/queue this link points at a
 * different URL. Spending one boolean on both would make this link and the
 * switch's Queue link both claim to be the current page on one screen.
 *
 * aria-label because this is now one of two <nav> landmarks; two unnamed ones
 * announce as "navigation" and "navigation".
 */
const NAV = [
  { href: "/freelance", label: "Freelance", Icon: IconFreelance },
  { href: "/settings", label: "Settings", Icon: IconSettings },
] as const;

export default function NavList() {
  const pathname = usePathname();

  return (
    <nav className="app-nav" aria-label="Main">
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            // .is-active follows the AREA (startsWith): Freelance stays lit on
            // /freelance/queue. aria-current="page" follows the PAGE
            // (equality): on /freelance/queue the current page is the switch's
            // Queue tab, not this link. ViewSwitch matches by equality for both.
            className={active ? "navitem is-active" : "navitem"}
            aria-current={pathname === href ? "page" : undefined}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

> Both the split (R44) and `aria-label="Main"` are ruled, not optional. `aria-current="true"` on the prefix match was the alternative to `undefined`; `undefined` is cleaner, because the rail's raised fill already says the area is current.

- [ ] **Step 5: The two docblocks that name the old address**

In `src/app/(app)/layout.tsx`, lines 9–11, replace

```tsx
 * expose the shell. It needs no ?from= — the login page already defaults to
 * /queue.
```

with

```tsx
 * expose the shell. It needs no ?from= — the login page already defaults to
 * /freelance, the landing page (R42).
```

In `src/app/(app)/_shell/LogoutButton.tsx`, lines 3–5, replace

```tsx
 * The app's only sign-out control, moved here from /queue's deleted inline
 * header. Styled by `.app-side .btn.ghost` at --ink-3 rather than --ink-4 —
 * it must be legible.
```

with

```tsx
 * The app's only sign-out control, moved here from the queue page's deleted
 * inline header. Styled by `.app-side .btn.ghost` at --ink-3 rather than
 * --ink-4 — it must be legible.
```

- [ ] **Step 6: The landing**

`src/app/page.tsx` — replace the file:

```tsx
import { redirect } from "next/navigation";

/**
 * The landing page is the Freelance overview (R42): the numbers Riku wants
 * first thing in the morning. The approvals queue is one tap away on the view
 * switch, and a push notification opens it directly.
 */
export default function Home() {
  redirect("/freelance");
}
```

`src/app/manifest.ts` — line 8:

```ts
    start_url: "/freelance",
```

**R45, after review:** the manifest also declares `id: "/"` above `start_url`, with a comment, so the installed app's identity no longer follows `start_url`.

`src/app/login/page.tsx` — line 10:

```tsx
  const [from, setFrom] = useState("/freelance");
```

and line 26:

```tsx
      // malformed value — keep the "/freelance" default
```

**Nothing else in `login/page.tsx` changes.** Its `?from=` validation — `startsWith("/")` plus a same-origin re-check against `window.location.origin` — already accepts `/freelance/queue` and needs no edit.

- [ ] **Step 7: The push target**

`src/lib/push.ts` — line 21:

```ts
export function buildPushPayload(title: string, body: string, url = "/freelance/queue"): PushPayload {
```

`src/lib/__tests__/push.test.ts` — the two `/queue` addresses become `/freelance/queue`:

```ts
  it("passes short values through with the default url", () => {
    expect(buildPushPayload("Title", "Body")).toEqual({
      title: "Title",
      body: "Body",
      url: "/freelance/queue",
    });
  });
```

```ts
  it("accepts an explicit url", () => {
    expect(buildPushPayload("T", "B", "/freelance/queue?status=pending").url).toBe(
      "/freelance/queue?status=pending"
    );
  });
```

The default-url assertion **must** move in the same commit as the default. The explicit-url example is one of the three one-line edits that were ruled in (open question 5c).

`public/sw.js` — line 1 and the two defaults:

```js
/* Service worker: displays pushes and opens the queue view on tap. */

self.addEventListener("push", (event) => {
  let data = { title: "Notification", body: "", url: "/freelance/queue" };
```

```js
  const url = (event.notification.data && event.notification.data.url) || "/freelance/queue";
```

`src/app/api/cron/morning/route.ts` — line 158:

```ts
            "Re-subscribe from /freelance/queue."
```

- [ ] **Step 8: The stylesheet's three prose mentions**

`src/styles/legacy.css`, header comment only — **no rule is added, changed or removed.** Line 4:

```
   THIS FILE HAS AN EXPIRY DATE. It exists so /freelance/queue, /settings
   and /login can be re-skinned without being rewritten: one treatment per
```

Line 19:

```
     * the queue view's status filters lose their solid active state. Bare
```

Line 26:

```
       A visible layout change to the queue view, forced by the shell.
```

- [ ] **Step 9: Build on a clean `.next/`**

A route move leaves a stale build manifest behind, and the route table is the thing being checked.

```bash
rm -rf .next
npm run build
```

Expected: `✓ Compiled successfully`, and a route table listing `/freelance`, `/freelance/queue`, `/settings`, `/login` — **and no `/queue`**.

- [ ] **Step 10: Types and tests**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. (If `IconQueue` still has a consumer anywhere, this is what says so.)

Run: `npm test`
Expected: all suites pass, including `push.test.ts`. Zero failures.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -F - <<'EOF'
refactor(p8a2): the queue becomes a view of Freelance, at /freelance/queue

R42. Riku: "since it is still under the jurisdiction of the freelance
work, put it as a sub-tab in the freelance." The queue is a VIEW of the
Freelance page, not a page of its own.

git mv src/app/(app)/queue -> src/app/(app)/freelance/queue. The folder's
contents are byte-unchanged except the one ?from= literal, which is the
move's mechanical consequence and the only edit R18 allows here. The
relative ./PushControls import moves with the folder.

Everything that pointed at the old address moves with it in one commit,
because splitting a rename of a public address guarantees a wrong
intermediate: a redirect landing first would 308 to a route that does not
exist, and the folder landing first would leave / redirecting to a 404.
So: the rail drops to Freelance and Settings (IconQueue loses its only
consumer and is deleted, per the no-dead-vocabulary rule), / and the PWA
start_url and the login default all land on /freelance, and push
notifications - the actual trigger for an approval - open
/freelance/queue directly. push.test.ts moves in the same commit as the
default it pins.

The rail keeps its prefix match for .is-active so /freelance/queue lights
Freelance, and takes equality for aria-current so the rail's Freelance link
and the switch's Queue link do not both claim to be the current page on one
screen (R44). The view switch that follows uses equality for both. Both
navs are named, since two unnamed navigation landmarks announce alike.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

---

## Task 2: The permanent redirect

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add `redirects()`**

Insert the block immediately **before** `async headers()` in `nextConfig`, leaving `headers()` byte-for-byte unchanged:

```ts
const nextConfig: NextConfig = {
  devIndicators: false,
  /**
   * The queue moved under the Freelance address (R42). This keeps the old one
   * alive: a bookmark, and — the reason it is permanent — an already-installed
   * PWA whose cached start_url still points at the old address.
   *
   * next.config redirects run BEFORE the proxy, so a signed-out hit on the old
   * address becomes /login?from=/freelance/queue and the login page sends the
   * session to the right place. src/proxy.ts is not touched: /freelance/queue
   * is not on its allowlist, which is exactly how the old address was treated.
   *
   * permanent: true is a 308 and browsers cache it hard. That is intended —
   * the address is not coming back — but it means undoing this needs a cache
   * clear, not just a revert.
   */
  async redirects() {
    return [{ source: "/queue", destination: "/freelance/queue", permanent: true }];
  },
  async headers() {
```

The docblock names the old address without quoting it, so §9 item 5's grep stays at three lines (ruled after Task 2).

- [ ] **Step 2: Confirm the CSP was not touched**

Run: `git diff -- next.config.ts`
Expected: additions only, all of them inside the new `redirects()` block and its docblock. **No line inside `headers()` appears as changed**, and no `-` line appears anywhere except the one `async headers() {` line if the diff chose to anchor there.

Run: `git diff --stat -- package.json package-lock.json`
Expected: **no output.** No dependency was added.

- [ ] **Step 3: Build**

```bash
rm -rf .next
npm run build
```

Expected: `✓ Compiled successfully`. The route table is unchanged from Task 1 — a `redirects()` entry is not a route and does not appear in it.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -F - <<'EOF'
feat(p8a2): permanently redirect /queue to /freelance/queue

A compatibility shim for the old address, correct only now that the new
one exists. permanent (308) because the address is not coming back, and
because an already-installed PWA has /queue cached as its start_url.

next.config redirects run before the proxy, so a signed-out hit becomes
/login?from=/freelance/queue rather than a redirect into a dead address.
src/proxy.ts is untouched and needs nothing: its allowlist treats
/freelance/queue exactly as it treated /queue. headers() - the CSP - is
byte-unchanged.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

---

## Task 3: The header and the view switch

**Files:**
- Modify: `src/styles/components.css`
- Create: `src/app/(app)/freelance/ViewSwitch.tsx`
- Create: `src/app/(app)/freelance/layout.tsx`
- Modify: `src/app/(app)/freelance/page.tsx`

- [ ] **Step 1: The CSS**

**One insertion, one edit to an existing rule, and the file's header comment** — all in `src/styles/components.css`. Nothing is added at the end of the file (M1).

**(a)** One contiguous insertion immediately after `.fl-body{margin-top:var(--sp-5)}` (currently line 146) and before the `/* ---- stat hero cards ---- */` banner. **The first rule closes the section-rhythm block**, beside the rules it overrides (M1); the header banner follows it.

```css
/* The page title moved into the segment layout, so .fl's first child is now
   the view's first block, sitting directly under the header. Every candidate
   still carries the top margin it had for the heading that used to be above
   it — .fl-body 20px, .fl-fail 20px — and that margin would now double the
   header's gap and make the number in §3.4 false in the whole-page-down
   state. Zeroed here.
   .fl>:first-child is (0,2,0) — a class plus a structural pseudo-class —
   so it outranks .fl-body and .fl-fail, both (0,1,0), from anywhere in the
   file. It sits here, beside the rules it overrides, the same way
   .fl-stages>.fl-stage:first-child and .fl-rows>.fl-row:first-child do. */
.fl>:first-child{margin-top:0}

/* ---- the page header: title + view switch (R42) ---------------- */
/* The Freelance segment layout renders these above BOTH views, so the header
   sits outside every <main>: /freelance brings its own
   <main class="app-content"> and /freelance/queue brings legacy.css's. It
   reuses .fl rather than declaring a second 920px column, which is what makes
   it align with the top bar and both views by construction (R34).
   padding-bottom is 0 on purpose: the <main> below contributes its own 28px
   top padding on both views, and legacy.css's `main` cannot be changed
   because it also serves /login. Any bottom padding here would change that
   gap on both views and would NOT change the 10px difference between them.
   Spec §3.4 carries the arithmetic.
   When a title-level control eventually needs to sit RIGHT of the title, the
   pattern already exists — .fl-headrow's
   `grid-template-columns:minmax(0,1fr) auto; align-items:end`. Do not invent
   a second one. */
.fl-head{padding:var(--sp-6) var(--sp-6) 0}
/* ADDED (R42): the design system's VIEW SWITCH, ported from
   docs/design/components.html's `.segmented`, whose note reads "Sits in a
   sunken track with a hairline border; the active tab is a raised fill.
   Left-aligned, directly under the heading it modifies."
   Values are the reference's, verbatim. Its sibling `.range` — the floating
   time-range switch — is NOT ported: P8 has no time range, and §5.8 forbids
   declaring vocabulary with no consumer. It has a named future consumer: the
   queue page's S11 rebuild ports it for the status-filter row (§6.2).
   #1D222A happens to equal var(--line). The reference writes the literal for
   the FILL and the token for the BORDER because they are two different jobs;
   tidying the fill into var(--line) would tie the raised fill to the hairline
   colour for ever. .navitem.is-active keeps its literal #171B21 for the same
   reason — and keeps its INSET HAIRLINE, which this does not need, because
   this fill sits inside a track that already has a border.
   GROUND: the reference draws this track inside a --sunk well; here it sits
   on --void, so the track/ground separation is ~25% smaller than in the
   specimen and the --line hairline does more of the work. If it reads as a
   floating lighter bar rather than a recess, the alternative is --sunk for
   the track, which would make the recess literal — that is a ruling, not a
   tidy. (#101318 is now written three times in this app — see R34's note on
   legacy.css.)
   margin-top is 6px (R43), not the 20px of a heading→content gap: the switch
   belongs to the title above it. Optical, not declared, is the comparison
   that matters — .fl-title's 36px line box leaves ~9.7px of dead space under
   the word, so 6px reads as ~15.6px against a true 28px below (ratio 1.79),
   where the system's bound pair is ~9px optical and its content gap ~29px.
   The first label sits 16px in from the track's left edge (1px border + 3px
   track padding + 12px tab padding). The TRACK's edge, not the label, is what
   aligns with the title; zeroing the first tab's left padding to "fix" that
   would break the track. */
.segmented{
  display:inline-flex;background:#101318;border:1px solid var(--line);
  border-radius:9px;padding:3px;gap:3px;margin-top:var(--sp-2);
}
/* DIFFERENCE: the reference draws the tabs as <button>; these are two real
   URLs, so they are <a>. Two declarations are added and one verbatim
   declaration does double duty:
     * `border:0` is the reference's own, and it also removes base.css's
       anchor hairline — the same fix .navitem, .fl-biz and .stat-top .more
       carry. Verbatim, not an addition.
     * ADDED line-height:1.4. A <button> takes the UA font shorthand's
       line-height:normal, which is font-metric-derived (~1.3 for JetBrains
       Mono), so the reference's track is ~32.5px and this one ~33.3px. 1.4
       is taken NOT to match that number but to stop the track's height
       depending on the mono's metrics at all, and because it is the
       line-height .btn and legacy.css's bare `button` already declare — the
       switch and the queue view's filter pills sit 38px apart and must
       share it.
     * ADDED :hover. base.css's `a:hover` is (0,1,1) and so is this selector;
       at a tie the later stylesheet wins and this one is later, so the hover
       would be silently dead. --ink because every hover in this file lands
       on --ink (.btn:hover, .app-side .btn.ghost:hover, .fl-biz:hover, and
       base.css's a:hover); the app's one --ink-2 hover is legacy.css's
       button.secondary, in the layer with an expiry date.
   base.css's :focus-visible also sets border-radius:3px, which would square
   these corners while focused — except it is (0,1,0) and this rule is
   (0,1,1), so the 6px survives. A later radius tidy could break that. */
.segmented a{
  font-family:var(--mono);font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;
  background:none;border:0;color:var(--ink-3);padding:6px 12px;border-radius:6px;
  cursor:pointer;line-height:1.4;
}
.segmented a:hover{color:var(--ink)}
/* (0,2,1), tying .segmented a:hover and winning on order, so the active tab
   does not change on hover. */
.segmented a.on{background:#1D222A;color:var(--ink)}
```

**(b)** One **edit** to the existing `.fl-title` rule (currently lines 140–143), not a new rule (M4). It is an edit rather than a third insertion because `.fl-title` already exists and a second `.fl-title` block elsewhere in the file would split one selector's declarations across two places — exactly what this file's one-rule-per-selector organisation avoids. Replace:

```css
.fl-title{
  font-family:var(--display);font-weight:600;font-size:24px;letter-spacing:-.02em;color:var(--ink);
  margin:0;
}
```

with:

```css
.fl-title{
  font-family:var(--display);font-weight:600;font-size:24px;letter-spacing:-.02em;color:var(--ink);
  margin:0;
  /* Declared, not inherited: §3.4's title→switch gap is derived from this
     36px line box, and `line-height:1.2` is the most natural tidy anyone
     would apply to a display heading. Same reason .stat .fig carries an
     explicit 1.06. This is a PIN, not a difference from the mockup — the
     value is what the rule already inherited from base.css — so it does not
     join the numbered differences list above. */
  line-height:1.5;
}
```

**(c)** Then update the file's header comment. Replace line 16 —

```
   Five deliberate differences from the mockup, each marked below:
```

— with:

```
   Six deliberate differences from the mockup, each marked below:
```

and append to that numbered list, after item 5:

```
     6. `.segmented`'s tabs are <a>, not <button> (R42) — two added
        declarations, line-height and hover, plus one verbatim `border:0`
        doing double duty. Each commented in place.
```

- [ ] **Step 2: Create `src/app/(app)/freelance/ViewSwitch.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The design system's view switch (DESIGN-INSPO §5.3, components.html
 * `.segmented`): a recessed track with a hairline border, the active view a
 * raised fill, left-aligned directly under the heading it modifies. The
 * segment layout renders it under <h1>Freelance</h1>, above both views.
 *
 * The shell's fourth client island, and like the other three it exists for
 * exactly one reason: usePathname() for the active state. No data, no state,
 * no effects.
 *
 * LINKS, NOT A TABLIST. role="tab" describes panels swapped in place — no
 * address change, aria-controls into the same document, and roving-tabindex
 * arrow keys the author must implement. These are two real routes: bookmarked,
 * back-buttoned, and /freelance/queue is what every push notification opens.
 * Calling them tabs would describe an interaction this page does not have.
 *
 * EQUALITY FOR BOTH THE CLASS AND aria-current. /freelance is a prefix of
 * /freelance/queue, so a prefix match would light BOTH tabs on the Queue
 * view. The rail's NavList uses startsWith for its CLASS, for the opposite
 * reason — it names an area, so Freelance must stay lit there — and equality
 * for its aria-current, so that link and this one never both claim it while
 * pointing at DIFFERENT URLs (R44). On /freelance they point at the same URL
 * and both are right — one per <nav>, which is what ARIA's one-per-set rule
 * means (R46). Here the area and the page are the same thing, so one test
 * serves both. A future /freelance/queue/:id would light
 * neither tab; there is no such route, and it is one line to change when
 * there is.
 *
 * aria-label because this is now the document's second <nav>; an unnamed pair
 * of navigation landmarks is announced as "navigation" twice.
 */
const VIEWS = [
  { href: "/freelance", label: "Dashboard" },
  { href: "/freelance/queue", label: "Queue" },
] as const;

export default function ViewSwitch() {
  const pathname = usePathname();

  return (
    <nav className="segmented" aria-label="Freelance views">
      {VIEWS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={active ? "on" : undefined}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Create `src/app/(app)/freelance/layout.tsx`**

```tsx
import ViewSwitch from "./ViewSwitch";

/**
 * The Freelance segment's header, rendered above BOTH views (R42): the queue
 * is a view of this page, not a page of its own.
 *
 * IT RENDERS NO <main>. /freelance brings its own <main className="app-content">
 * and /freelance/queue brings legacy.css's, and two <main> elements in one
 * document is invalid HTML. The header is a plain <div> for the same kind of
 * reason: a <header> at this nesting maps to role="banner", a document-level
 * landmark this shell has not designed, and the element is doing layout, not
 * semantics. The <h1> inside it is the document's heading either way.
 *
 * .fl-head carries the padding and .fl the 920px column — the SAME .fl both
 * views use, so the header, the top bar and both views share one left edge by
 * construction rather than by two rules kept in step (R34).
 *
 * No session check: the (app) layout above this one already did it.
 */
export default function FreelanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="fl-head">
        <div className="fl">
          <h1 className="fl-title">Freelance</h1>
          <ViewSwitch />
        </div>
      </div>
      {children}
    </>
  );
}
```

- [ ] **Step 4: The Dashboard placeholder loses its `<h1>`**

Replace `src/app/(app)/freelance/page.tsx` with:

```tsx
/**
 * Placeholder for the Dashboard view. Plan C rewrites this file with
 * force-dynamic, maxDuration, the Promise.allSettled fan-out and Blocks A–F.
 *
 * The title and the view switch are NOT here: the segment layout renders them
 * above both views (R42). What is left is the frame — Plan C fills the column
 * in, and .fl's first child becomes the hero row.
 *
 * The 28px horizontal padding lives on .app-content and the 920px max-width
 * lives on .fl. Do not move either: box-sizing:border-box means a 920px
 * element WITH padding gives 864px of content, at which point four hero cards
 * wrap.
 */
export default function FreelancePage() {
  return (
    <main className="app-content">
      <div className="fl" />
    </main>
  );
}
```

- [ ] **Step 5: Types, tests, lint and build**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm test`
Expected: all suites pass. Zero failures. (No test touches the switch — it is a rendering component and the repo has no component harness. See the self-review.)

Run: `npm run lint`
Expected: the **four pre-existing** `react-hooks/set-state-in-effect` errors and **no new ones**. The paths of two of them changed with the folder: they are now `src/app/(app)/freelance/queue/PushControls.tsx` and `src/app/(app)/freelance/queue/page.tsx`, alongside `src/app/(app)/settings/page.tsx` and `src/app/login/page.tsx`. Lint still exits 1; that is the state Plan A recorded, not a regression.

Run:
```bash
rm -rf .next
npm run build
```
Expected: `✓ Compiled successfully`, route table unchanged.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(p8a2): the Freelance header and the design system's view switch

R42. A freelance segment layout renders <h1 class="fl-title">Freelance</h1>
and, directly under it, the view switch - two links, Dashboard and Queue -
above both views. The layout renders no <main>: the Dashboard brings
<main class="app-content"> and the Queue view brings legacy.css's, and two
<main> in one document is invalid HTML.

The switch is components.html's `.segmented` ported verbatim, with two
declarations added because the tabs are <a> and not <button> - line-height
pinned to 1.4, for determinism and for parity with .btn and legacy.css's
bare `button`, which the queue view's filter pills use 38px away; and the
hover, which a specificity tie with base.css's a:hover would otherwise
leave dead - and one verbatim declaration, `border:0`, that also removes
base.css's anchor hairline. The reference's sibling `.range` is not ported;
its future consumer is the queue page's S11 rebuild.

The switch matches the path by EQUALITY for both its class and its
aria-current: /freelance is a prefix of /freelance/queue, so a prefix match
would light both tabs. Links rather than role="tab" because these are two
real URLs - bookmarkable, back-buttonable, and the target of every push.

Rhythm (R43): 28px above the title (unchanged from Plan A - the title does
not move), 6px to the switch, 28px from the switch to the view's first
content. 6px because the comparison that matters is optical against
optical - the title's 36px line box leaves ~9.7px of dead space, so 6px
reads as ~15.6px against a true 28px, ratio 1.79, near the system's bound
pair rather than midway to its content gap. The header reuses .fl, so it
shares one left edge with the top bar and both views by construction (R34).
.fl>:first-child{margin-top:0} makes that 28px true in every render state
including whole-page-down; at (0,2,0) it outranks .fl-body and .fl-fail
from anywhere, so it sits beside them in the section-rhythm block.
.fl-title's inherited line-height is pinned explicitly, because the whole
rhythm is derived from it.

The Queue view still starts 10px lower - legacy.css's main padding plus
the page's first .row - the cost already recorded after Plan A, now one
click away instead of one nav item away.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

---

## Task 4: Verification

Run every check in order. **Do not claim completion until each one has produced the expected output in front of you.**

**Files:** none modified.

- [ ] **Step 1: The standing trio**

Run: `npm test`
Expected: all suites pass, zero failures — **330 tests in 22 files** (R45 added one `proxy.test.ts` case) — including `push.test.ts`, `proxy.test.ts`, `watchdog.test.ts`, `agentStatus.test.ts`, `deadline.test.ts`, `osSettings.test.ts`.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run:
```bash
rm -rf .next
npm run build
```
Expected: `✓ Compiled successfully`, and a route table listing **`/freelance`, `/freelance/queue`, `/settings`, `/login`** — and **no `/queue`**. A `redirects()` entry is not a route and correctly does not appear.

- [ ] **Step 2: No address was missed**

```bash
git grep -nE '(^|[^a-zA-Z/])[/]queue' -- src/ public/ next.config.ts
```

Expected: **exactly three lines** —

```
next.config.ts:34:    return [{ source: "/queue", destination: "/freelance/queue", permanent: true }];
src/lib/__tests__/proxy.test.ts:22:    "/queue",
src/lib/__tests__/proxy.test.ts:32:    "/api/cron/../queue",
```

The first is the redirect's source. The other two use `/queue` as an example of a protected path and as a traversal fixture; `isPublicPath` is a pure function and both remain valid inputs. `proxy.test.ts` is **not** byte-unchanged, though: its protected-path list was re-wrapped one element per line and gained `/freelance/queue` (R45), which does not match the pattern.

**Note the `[/]`.** In Git Bash on Windows, MSYS path conversion rewrites a `git grep` pattern that *begins* with `/` into a Windows path, so `git grep -n '"/queue' -- src/` silently matches nothing and **the check passes for the wrong reason.** Verified during planning: `git grep -n '/queue' src/app/manifest.ts` returns nothing on a file that contains `"/queue"`. `[/]` and `MSYS_NO_PATHCONV=1` both fix it; `[/]` needs no environment.

- [ ] **Step 3: The rules this plan promised to keep**

```bash
git diff --stat 0f83b86..HEAD -- package.json package-lock.json
```
Expected: **no output.** No dependency was added.

```bash
git diff 0f83b86..HEAD -- next.config.ts
```
Expected: additions only, all inside the new `redirects()` block and its docblock. **No line of `headers()` — the CSP — is changed.**

```bash
git status --porcelain src/proxy.ts
git diff --stat 0f83b86..HEAD -- src/proxy.ts src/lib/__tests__/proxy.test.ts
```
Expected: `src/proxy.ts` — **no output from either command**. `src/lib/__tests__/proxy.test.ts` — **one changed block**: the `it.each` protected-path list, re-wrapped one element per line to match the file's other two lists and gaining `"/freelance/queue"` (R45). Nothing else in that file, and nothing at all in the authorization boundary itself.

```bash
git diff 0f83b86..HEAD -- "src/app/(app)/freelance/queue/page.tsx"
```
Expected: **exactly one changed line** — the `?from=` literal. (Add `-M --find-renames` if git does not pair the rename automatically.)

```bash
git grep -nE 'dangerouslySetInnerHTML[[:space:]]*=' -- src/
```
Expected: no output, exit 1.

```bash
git grep -n 'IconQueue' -- src/
```
Expected: no output, exit 1. The glyph and its last consumer went in the same commit.

- [ ] **Step 4: By eye, in a browser — Plan A's Task 13 step 5, updated**

Plan A's step 5 was never run. It runs here, at the new addresses, plus A-2's own items.

**Riku must be at the keyboard to sign in. The verifier never types the password** — hand the browser over for that one step, or ask Riku to sign in first and then drive.

Run: `npm run dev`

Open `http://localhost:3000/freelance/queue`, sign in, then check each of these:

1. **The three faces render.** The `AGENTS` group label, the badge text and the two switch labels are JetBrains Mono (letterspaced, monospaced digits); the `h1` and the wordmark are Archivo; body copy is IBM Plex Sans. If everything looks like the system UI font, the `next/font` variables did not reach `<html>`.
2. **Six badges are live** in the rail, in order: `CHASER · EXPIRY-SWEEP · WATCHDOG · SITE-HEALTH · OUTREACH-HEALTH · DISPATCHER`, each showing a real state. Green badges carry no caption; grey, amber and red ones do.
3. **Both views work under the shell**, and each shows **exactly one** `Log out` (in the rail's foot) and no inline `<h1>` reading `RikuOS — Queue`. `/settings` likewise.
4. **The rail is two items**, Freelance and Settings, and **Freelance is marked active on both Freelance views** — including `/freelance/queue`. `/settings` marks Settings.
5. **No CSP violation and no error in the DevTools console** on any of the pages. Specifically, no request to `fonts.googleapis.com` or `fonts.gstatic.com` in the Network tab — `next/font` self-hosts.
6. **The rail's `#0B0D11` column reaches the bottom of the viewport on `/freelance`**, which is now the shortest page in the app — an empty column under the header (R33, `.app-body{min-height:100dvh}`).
7. **The stamp follows navigation** (R39). Note the `read HH:MM` in the top bar, wait for the minute to roll over, then click a different rail item: the stamp shows the new minute without a reload. Then do the same with the **view switch** — a switch click is a soft navigation too, so the stamp must move there as well.
8. **Cold-load badge timing** (R38). On the first load after the app has been idle a while, note how long the six badges take to resolve from the grey skeleton. If it is regularly above ~2.5 s, raise `RAIL_READ_TIMEOUT_MS` in `AgentsBlock.tsx`.

- [ ] **Step 5: By eye — A-2's own items**

Still in the dev server, still signed in:

1. **The switch renders under the title on both views**, left-aligned, two labels reading `DASHBOARD` and `QUEUE` in mono caps — and **the track reads as recessed against the page ground, not as a floating lighter bar.** It sits on `--void` here rather than in the reference's `--sunk` well, so it has ~25% less separation than the specimen and the `--line` hairline carries the recess. If it reads as a raised bar, say so: the alternative is `--sunk` for the track, which is a ruling for the lead, not a tidy.
2. **Exactly one tab is active on each view.** On `/freelance`, `DASHBOARD` has the raised fill and `QUEUE` does not. On `/freelance/queue`, the reverse. **If both are filled on the Queue view, the switch is using `startsWith`** — that is the one bug this component can have.
3. **At most one `aria-current="page"` per `<nav>`, and every one of them points at the current URL (R44, R46).** On `/freelance` there are **two**, and both are right: the rail's Freelance link and the switch's `DASHBOARD` anchor both carry it, and both `href="/freelance"` — ARIA's one-per-set rule is per `<nav>`, and the rail and the switch are two sets. On `/freelance/queue` there is **exactly one**: the switch's `QUEUE` anchor. Inspect the rail's Freelance link there — it is `.navitem is-active` and **carries none**, because it points at a different URL. A link claiming to be the current page while pointing somewhere else is the defect R44 exists to prevent.
4. **Clicking a tab is a soft navigation** — the rail does not flash, the badges are not re-fetched, and the URL changes.
5. **Hover.** An inactive tab's label brightens from `--ink-3` to `--ink` on hover; the active tab does not change. Nothing moves.
6. **Focus.** Tab to each switch link with the keyboard: the orange `:focus-visible` ring appears, slightly overhanging the track and the neighbouring tab, which is expected (the ring is `outline-offset:3px` and the tab sits 4px inside the track). Enter navigates. Nothing reflows when the ring appears.
7. **`/queue` redirects.** Type `http://localhost:3000/queue` — the address bar lands on `/freelance/queue` and the page renders. Then, in a **private window** (no session), type the same URL: it must land on **`/login?from=/freelance/queue`**, not `?from=/queue`. That is the check that config redirects run before the proxy.
8. **Sign-in lands on `/freelance`.** In the private window, from `http://localhost:3000/login` with no `?from=`, sign in (Riku types it): the app lands on the Freelance overview.
9. **`/` lands on `/freelance`.** Type `http://localhost:3000/` while signed in.
10. **The push click target.** Read `public/sw.js`: both the push handler's default and `notificationclick`'s fallback read `/freelance/queue`. **Optional and at Riku's discretion:** press `Send test` in the queue view's `PushControls` and tap the notification — it must open `/freelance/queue`. Nothing is sent to anyone but Riku's own browser; skip it if he would rather not.
11. **The four columns share one left edge.** With DevTools' rulers, or by dragging a guide: the top bar's `read HH:MM`, the `Freelance` title, the Dashboard's (currently empty) `.fl`, and the Queue view's status-filter row all start at the same x. Then narrow the window below ~1150px and confirm all four collapse together to a flat 28px inset.
12. **The rhythm is §3.4's.** In DevTools, on `/freelance`: the `.fl-head` box is 28px below the top bar's border; `.segmented` has a **6px** top margin (R43) and a computed height of ~33px; `main.app-content`'s padding box starts 28px below the switch. The header band totals **103.3px** (28 + 36 + 6 + 33.3). On `/freelance/queue`: the same 28px from the switch to the `<main>` padding box, and the first `.row` a further 10px down — **38px total, the recorded cost (§6.2).** Flip between the two views and confirm the difference reads as a small settle, not a jump.
13. **No leak under the switch — a required check, not a contingency.** The `.segmented` line box in DevTools must measure **39.3px** (its 6px margin plus its 33.3px box) with **no extra space below it**. If it is taller, the `inline-flex` strut is leaking; the written fallback is `display:flex;width:max-content` on `.segmented`, recorded as a seventh marked difference from the reference before it is changed. (The critic's independently derived figure of 43.3px was taken at the draft's 10px margin; R43's 6px makes it 39.3px. The check — line box equals `margin-top + 33.3px` and nothing more — is the same.)
14. **Tab order is rail → switch → content.** From the address bar, press Tab repeatedly on `/freelance/queue`: focus moves through the rail's links and `Log out`, then the switch's two tabs, then the page's status filters. The switch is the first two tab-stops after the rail on every Freelance page, which is the correct order — it is above the content in the document and must be above it in the focus order too.

Stop the dev server with Ctrl-C.

- [ ] **Step 6: By eye — the rail degrades to six grey em-dash badges (Plan A Task 13 step 6, updated)**

In Git Bash, force a database failure. Next does not overwrite an env var already present in `process.env`, so a shell-level assignment beats `.env.local`:

```bash
MONGODB_URI="mongodb+srv://nobody:nobody@nowhere.invalid/rikuos" npm run dev
```

Open `http://localhost:3000/freelance/queue`.
Expected: the page still renders, the rail still renders, **the header and the switch still render** — they read no data — and the six badges are all grey with an `—` caption under each. **The route must not blank and must not show an error page.** Stop the server with Ctrl-C and restart normally to confirm the badges come back.

- [ ] **Step 7: Final state**

Run: `git status --porcelain`
Expected: **no output.** Every change made by this plan is already committed.

Run: `git log --oneline -3`
Expected: the three A-2 commits, on `master`, unpushed.

- [ ] **Step 8: Hand back to the design lead**

Report: the trio green, the address grep at exactly three lines, the route table, and the result of each by-eye item — in particular step 5's items **1** (the recess), **2** (one active tab), **3** (one `aria-current`), **7** (the signed-out redirect), **11** (the columns), **12** (the rhythm) and **13** (the 39.3px line box), which are the ones that can fail silently.

Spec §9's fourth verification item — `/freelance` observed on Vercel against real ShikksTracker data — belongs to **Plan C** and is not claimed here.

**Then Task 5 runs.** The docs commit is deliberately last: the spec should record what shipped, not what was planned, so a by-eye finding in step 5 (the recess, the rhythm) can change the text before it is pasted into a ratified document.

---

## Task 5: The Spec Editor's docs commit

Run by an Opus **Spec Editor** after the build and its verification, not by the implementer. **No source file is touched.** One commit.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-07-p8-freelance-page-visual-design.md`
- Modify: `docs/superpowers/specs/2026-09-05-p8-freelance-page-content.md`
- Modify: `docs/superpowers/plans/2026-09-07-p8c-freelance-page.md`
- Modify: `docs/design/p8-mockup.html`

- [ ] **Step 1: Paste Part 1 into the ratified visual-design spec**

Section by section, from this document's Part 1, into `docs/superpowers/specs/2026-09-07-p8-freelance-page-visual-design.md`:

| Part 1 section | Where it goes | Rule |
|---|---|---|
| §3.1 | §3.1's **Nav** bullet | Replace the bullet's first sentence and add the two paragraphs (the area/page split, R44). Nothing else in §3.1 changes. |
| §3.4 | **New**, after §3.3, before §4 | The whole section, including the ported CSS, the quoted source lines, the rhythm table and the column arithmetic. |
| §5.3 | §5.3's table | **Amend** the existing `Page title .fl-title` row; **add** the `View-switch tab .segmented a` row. Both as written in Part 1. |
| §5.8 | §5.8 | Replace with Part 1's one sentence. **Do not add `IconQueue` here** — its deletion belongs to §7.2's Icons paragraph. |
| §6.2 | §6.2 | Append the three cost paragraphs, in Part 1's order and register. |
| §7.2 | §7.2 | **M3's rule: replace the tree, and the paragraph beginning "A route group changes no URL" — and nothing else.** The **Rejected**, **Active nav is a client island**, **A session check in the layout** and **Icons** paragraphs stand, with the two corrections Part 1 names (the login default is `/freelance`; four client islands). Paste the corrected Icons paragraph over the old one, since that is where `IconQueue`'s deletion is recorded. Then add Part 1's five blockquotes and its two carry-forward paragraphs. |
| §9 | §9's numbered list | Append items 5–7. Item 5 carries the `[/]queue` warning verbatim — a verification grep that cannot fail is worse than none. |

**Check before committing:** §7.2 still contains the sentence beginning `**Rejected:** one root layout with `usePathname()`-driven conditional chrome`, and `**A session check in the layout, as defence in depth.**`. If either is gone, the paste over-reached (M3).

- [ ] **Step 2: The content deck**

In `docs/superpowers/specs/2026-09-05-p8-freelance-page-content.md`, beside the existing `**Page title:** \`Freelance\`` line, add:

```
**The page has two views, named `Dashboard` and `Queue` (R42).** Both strings are Riku's own words, so this deck is their authority like every other string on the page. The title is the same on both views; the view's identity is carried by the switch and by `aria-current`.
```

- [ ] **Step 3: The two Plan C amendments**

Apply, in `docs/superpowers/plans/2026-09-07-p8c-freelance-page.md`, exactly the two amendments listed under **Plan C amendments** in Part 1: delete the `<h1 className="fl-title">Freelance</h1>` line from Task 2 Step 1's code block, and rewrite the one clause in deviation 1 of the "three deviations" preamble. **Plan C's markup needs no other change**, and `src/styles/*.css` stays off-limits to it.

- [ ] **Step 4: The mockup's seventh specimen**

In `docs/design/p8-mockup.html`, inside the `mockup-only` specimen area:

1. Add a **seventh specimen** — the header band alone, at the real 920px column, drawn **twice**: once with `DASHBOARD` active and once with `QUEUE` active. Rhythm **28 / 6 / 28**: 28px above the title, 6px from the title's line box to the track, and a 28px rule or ghost block below standing in for the view's first content. Use the shipped `.fl-head`, `.fl`, `.fl-title` and `.segmented` recipes — the mockup carries its own copy of the `components` section, so add `.segmented` there too, byte-identical to `components.css`'s.
2. Add a **one-line marked note** on each of the three existing Freelance specimens: *their `title → .fl-body` sequence predates R42, and the app now renders the title and the switch in the segment layout above the view.*

**Why this and not a note alone.** The mockup is one of the spec's four companions, and its own rule is "where prose here is ambiguous, the mockup is the truth" — so leaving it stale would not merely date it, it would make a falsehood authoritative for the one region A-2 changes. The specimen is also the only way Riku *sees* R43's 6px before it ships, and R43 is explicitly cheap to overturn.

- [ ] **Step 5: Republish the mockup — the lead's step**

The mockup is published as an artifact. **The lead republishes `docs/design/p8-mockup.html` to its existing URL** so the link Riku already has shows the seventh specimen. Do not publish it to a new URL: a second link for the same document is how the wrong one gets reviewed.

- [ ] **Step 6: Commit**

```bash
git add docs/
git commit -F - <<'EOF'
docs(p8a2): the spec, the deck, Plan C and the mockup catch up with R42

Part 1 of the A-2 plan pasted into the ratified visual-design spec: §3.1's
two-item nav with R44's area/page split, a new §3.4 for the Freelance
header and the view switch, §5.3's two pinned line-heights, §5.8 reduced
to its does-not-grow sentence, §6.2's three costs and §7.2's routes.

§7.2 is a replacement of the tree and one paragraph, not of the section:
the Rejected alternative, the client-island rationale, the defence-in-depth
session check and the Icons inventory are ratified and stand, corrected to
four islands and a /freelance login default. IconQueue's deletion is
recorded in the Icons paragraph, where the inventory lives.

The content deck gains R42's line: the page has two views, Dashboard and
Queue, and those strings are Riku's.

Plan C loses the <h1> from its page and one clause from its deviations
preamble; nothing else in it changes.

p8-mockup.html gains a seventh specimen - the header band at 920px, drawn
with each tab active, at the 28 / 6 / 28 rhythm - and a note on the three
existing Freelance specimens that their title-to-hero sequence predates
R42. The mockup is one of the spec's four companions and its own rule is
that it wins where prose is ambiguous, so a stale header there would make
a falsehood authoritative for exactly the region A-2 changes.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

- [ ] **Step 7: Hand back**

Report to the lead: the seven spec sections written, the deck line, the two Plan C amendments, and that the mockup is ready to republish. The lead republishes and re-reads.

## Post-build record

What actually landed, in order, so a later reader is not left inferring it from `git log`.

- **Task 1** — `0386327`, then the review fixes `7a5bd87` and `498b9d2`. R45: the manifest declares `id: "/"` above `start_url`; `proxy.test.ts`'s protected list gained `/freelance/queue` and was re-wrapped one element per line; three docblocks the move had made false were swept (`Rail.tsx`'s "three nav items", the `(app)` layout's queue sentence, `TopBar.tsx`'s "a control already on the queue page"). The manifest comment was reworded in `498b9d2` because its own prose quoted the old address, and prose is not an exception to §9 item 5's grep.
- **Task 2** — `2ddd61b`, then `1192868`, which reworded the redirect's docblock for the same reason. The redirect was exercised live against the running dev server: `/queue` — 308 — `/freelance/queue`, the query string carried, `/api/queue` untouched, and a signed-out hit terminating at `/login?from=/freelance/queue` in two hops.
- **Task 3** — `92f5f7e`, then `8c26088` (three comment fixes: the `.segmented` placement margin is ours, not the reference's; the `.on` order-tie note no longer claims a visible consequence; the Dashboard placeholder's pointer to Plan C regained its path), then the R46 docblock commit on `ViewSwitch.tsx`.
- **Task 4** — verified 2026-09-07. The trio green at 330 tests, the guard grep at exactly three lines, and A-2's own items measured rather than eyeballed: the rhythm **28 / 36 / 6 / 32.9 / 28** on both views, the `.fl-head > .fl` line box **74.9** = 36 + 6 + 32.9 with no strut leak, one active tab per view, the 308 and the signed-out `?from=/freelance/queue` both observed, `/` landing on `/freelance`, the four columns on one left edge, and the degrade run rendering header, switch, rail and six grey `—` badges. **R46** was ruled here: `aria-current="page"` is at most one per `<nav>`, not one per document.
- **Manual steps handed to Riku, due now:** sign out and in once from `/login` with no `?from=` and confirm it lands on `/freelance`; drag the window under ~1150px once and watch the four left edges move together (the extension could not resize a maximised window); if the app is installed to a home screen or desktop, remove it and add it again (R45); and, optionally, `Send test` on the Queue view and tap the notification, which must open `/freelance/queue`.

---

# Part 3 — Self-review

**1. Spec coverage.** Every R42 bullet maps to a task:

| R42 bullet | Task |
|---|---|
| `git mv src/app/(app)/queue → …/freelance/queue`, contents unchanged | 1 (steps 1–2) |
| The one `?from=/queue` literal becomes `/freelance/queue` | 1 (step 2) |
| `/queue` permanently redirected in `next.config.ts`, before the proxy | 2 |
| `src/proxy.ts` is not touched | ground rules; 4 (step 3) |
| `src/app/page.tsx` redirects to `/freelance` | 1 (step 6) |
| `manifest.ts` `start_url: "/freelance"` | 1 (step 6) |
| Login's default `from` is `/freelance` | 1 (step 6) |
| `push.ts` default url and `public/sw.js`'s two defaults → `/freelance/queue` | 1 (step 7) |
| The morning cron's `Re-subscribe from …` names the new path | 1 (step 7) |
| The `(app)` layout docblock's "defaults to /queue" corrected | 1 (step 5) |
| `NAV` is Freelance then Settings, each with its glyph | 1 (step 4) |
| `IconQueue` deleted | 1 (step 3); checked in 4 (step 3) |
| `/freelance/queue` already marks Freelance active (`startsWith`) | 1 (step 4); checked in 4 (step 4, item 4) |
| Spec, deck, Plan C and the mockup brought up to date | 5 |
| A segment layout renders `<h1 class="fl-title">Freelance</h1>` | 3 (step 3) |
| The view switch directly under it: recessed track, hairline border, raised active fill, left-aligned | 3 (steps 1–2); spec §3.4 |
| Two links, `Dashboard` and `Queue`, text only | 3 (step 2) |
| `aria-current="page"` on the active one | 3 (step 2); checked in 4 (step 5, item 3) |
| A small client component, the shell's fourth island, one reason | 3 (step 2) |
| The layout renders **no `<main>`** | 3 (step 3) |
| The header uses the same column so all three align (R34) | 3 (steps 1, 3); arithmetic in §3.4; checked in 4 (step 5, item 11) |
| Plan C's page no longer renders the `<h1>`; `.fl` starts at the hero row | 3 (step 4) for the placeholder; Plan C amendments 1–2 |
| The vertical rhythm is a design number the spec states, not the build | §3.4's table, with the arithmetic |
| A-2 runs before Plan B; Task 13's steps 5–6 fold in | Sequence note; Task 4 steps 4–6 |

Two things R42 does not mention that A-2 must do, both mechanical consequences: the `LogoutButton` and `legacy.css` prose that name the old address (Task 1 steps 5, 8 — ruled in as open question 5), and `push.test.ts`'s assertion on the default url, which must move in the same commit as the default (Task 1 step 7).

**And every round-5 ruling maps to a place in this document:**

| Ruling | Where it landed |
|---|---|
| **R43** — 6px, not 10px | §3.4's rhythm table and its rewritten optical-vs-optical paragraph; the header height `28 + 36 + 6 + 33.3 = 103.3`; Task 3 step 1(a)'s `margin-top:var(--sp-2)` and its comment; Task 3 step 6's commit message; Task 4 step 5 items 12–13; Task 5 step 4's specimen rhythm |
| **R44** — `aria-current` follows the page, `.is-active` the area | §3.1; §3.4's two `aria-current` paragraphs; Task 1 step 4's `NavList` (docblock and the split expression); Task 1 step 11's commit message; `ViewSwitch`'s docblock; Task 4 step 5 item 3 |
| **M1** — `.fl>:first-child` is (0,2,0), placed beside `.fl-body` | Task 3 step 1(a), first rule; "last in the file" struck from the plan text, the CSS comment and the commit message |
| **M2** — the duplicate `aria-current` | = R44 above |
| **M3** — the §7.2 paste must not delete four ratified paragraphs | §7.2's replacement instruction; the tree's six `_shell/*` rows with four-island annotations; the Icons paragraph; §5.8 reduced; Task 5 step 1's table and its pre-commit check |
| **M4** — pin the two line-heights | §5.3's amended and added rows; Task 3 step 1(b)'s edit to `.fl-title` |
| **S1** — the comparison must be optical vs optical | = R43 above |
| **S2** — two declarations, not three | §3.4's "The shipped rule" lead-in; the declaration table; Task 3 step 1(a)'s comment; the commit message; `components.css`'s header item 6 |
| **S3** — the `line-height:1.4` reason is determinism and parity | §3.4's declaration table; Task 3 step 1(a)'s comment; the commit message |
| **S4** — the recess is defined against a ground the app lacks | §3.4's "The recess is defined against a ground…" paragraph; Task 3 step 1(a)'s GROUND comment; Task 4 step 5 item 1 |
| **S5** — §6.2 gains three costs | §6.2's three paragraphs, including the `.range` forward pointer; Part 4 shortened accordingly |
| **S6** — the mockup joins the file map | The file-map row for `docs/design/p8-mockup.html`; Task 5 steps 4–5 |
| **N4** focus-ring radius · **N5** the 16px label inset · **N7** `.fl-headrow` for a future title-level control | Comment lines in Task 3 step 1(a); N4 and N5 also as §3.4 paragraphs |
| **N6** — the header is not sticky | The carry-forward (2) paragraph at the end of §7.2 |
| **N2** — the hover's stronger reason | §3.4's declaration table and the CSS comment |
| §5.7 unchanged, said explicitly | The last line of §3.4's CSS section |
| Tab order rail → switch → content | Task 4 step 5 item 14 |
| **N10** — the brief's task numbering | Nothing to do: this document has always called the CSS and markup **Task 3** and verification **Task 4**. |

**2. Placeholder scan.** No `TBD`, no `TODO`, no "implement later", no "similar to Task N", no "add appropriate error handling". Every code step carries the complete file or the exact lines to change, with the surrounding lines quoted so the edit is unambiguous. Every command carries its expected output. The `/freelance/page.tsx` frame is a *deliberately minimal shipped file* whose scope R42 fixes, not a placeholder — its comment says which plan replaces it and what replaces it with.

**3. Type and name consistency across tasks.**

- `NAV` in Task 1 step 4 is `{ href; label; Icon }[]` with two entries; both `Icon`s (`IconFreelance`, `IconSettings`) are named exports that survive Task 1 step 3.
- `VIEWS` in Task 3 step 2 is `{ href; label }[]` — **no `Icon`**; R42 says text only, and the switch imports nothing from `@/components/icons`.
- `ViewSwitch` is a default export; `layout.tsx` imports it as `import ViewSwitch from "./ViewSwitch"`, a relative path inside the same segment folder.
- `FreelanceLayout({ children }: { children: React.ReactNode })` matches the `(app)` layout's own signature; no `params`, so no Next 16 async-props question arises.
- Both `NavList` and `ViewSwitch` are `"use client"` and both call `usePathname()`; neither takes props, so no prop type crosses a boundary.
- **The two matching rules are stated identically in three places and nowhere contradicted** (R44): `NavList` computes `active` from `startsWith` for `className` and `pathname === href` for `aria-current`; `ViewSwitch` computes one `active` from `pathname === href` and spends it on both. §3.1, §3.4, both docblocks, both commit messages and Task 4 step 5 item 3 agree.
- `buildPushPayload(title, body, url = "/freelance/queue")` — the default in `src/lib/push.ts` and the expected value in `src/lib/__tests__/push.test.ts` are the same string, changed in the same step.
- The redirect's `destination` (`/freelance/queue`), the moved folder's route, `sw.js`'s two defaults, `push.ts`'s default and the queue page's `?from=` value are all the same literal, `/freelance/queue`; Task 4 step 2's grep is what proves no fifth spelling survives.
- `/freelance` is the same literal in `src/app/page.tsx`, `manifest.ts`, `login/page.tsx` and `VIEWS[0].href`.

**4. Every CSS class the TSX uses exists after Task 3 step 1.**

| Used in | Classes | Where declared |
|---|---|---|
| `freelance/layout.tsx` | `.fl-head` | `components.css`, new in Task 3 step 1(a) |
| | `.fl` | `components.css` line 144, shipped by Plan A |
| | `.fl-title` | `components.css` line 140, shipped by Plan A; step 1(b) adds `line-height:1.5` to that same rule |
| `freelance/ViewSwitch.tsx` | `.segmented` | new in Task 3 step 1(a) |
| | `.on` (as `.segmented a.on`) | new in Task 3 step 1(a) |
| `freelance/page.tsx` | `.app-content`, `.fl` | `components.css` lines 125, 144 |
| `_shell/NavList.tsx` | `.app-nav`, `.navitem`, `.is-active` | `components.css` lines 59, 63, 69 |

And in the other direction: every selector Task 3 step 1 adds has a consumer in the same commit — `.fl-head` and `.segmented`/`.segmented a`/`.segmented a.on` in `layout.tsx` and `ViewSwitch.tsx`, and `.fl > :first-child` on `.fl` itself. Step 1(a) is **one contiguous insertion** at line 147: the `.fl>:first-child` rule closes the section-rhythm block beside the two rules it overrides (M1, `(0,2,0)` beats their `(0,1,0)` from anywhere), then the header banner follows. Step 1(b) is an **edit** to an existing rule, not a fourth declaration site for `.fl-title`. **The §5.8 declared-unused list does not grow**, and `IconQueue` leaves the vocabulary in the other direction.

**5. What A-2 deliberately does not do.** No test is added: `ViewSwitch` is a rendering component whose only logic is a string equality, the repo has no component harness and P8 introduces none (spec §8), and the two things worth pinning — that `startsWith` would light both tabs, and that two elements must not claim `aria-current="page"` — are checked by eye in Task 4 step 5 items 2 and 3 and stated in both components' docblocks. No `metadata` export (ruled). No reach into the queue page for the 10px (ruled). No change to `src/proxy.ts`, the CSP, `package.json`, or any file under `src/app/(app)/freelance/queue/` beyond one literal (`proxy.test.ts`'s protected list gained `/freelance/queue`, R45). **`docs/design/p8-mockup.html` *is* changed** — Task 5, after verification — because it is one of the spec's four companions and a stale header there would outrank the prose it contradicts.

---

# Part 4 — My opinions, as the Frontend Architect

Three, kept short. The document above is the deliverable; these are mine and the lead rules.

**The switch must not carry a pending-approval count, and I agree with the lead's prior.** Three reasons, in order of weight. (1) R25 refused a pending-approvals count in the top bar because it would put "two 'waiting on you' numbers from two systems on one screen" — and the switch is *worse* than the top bar for this, because on the Dashboard view the count would sit ~40px above ShikksTracker's own needs-you hero card. The collision R25 named would be at its most literal. (2) A view switch is a navigation control; a badge on it makes it a status display, and the reader then has to decide each time whether the number describes the tab or the page. (3) Mechanically, the count is a Mongo read, so the segment layout would become a data component on every Freelance page view — R37's write-on-read and R38's five-second deadline territory, for a number the page already surfaces. The honest counter-argument is that a queue nobody is prompted to visit is a queue that silently fills; the answer is that push already carries that signal and now opens `/freelance/queue` directly, which is the whole reason `push.ts` and `sw.js` are in Task 1.

**The landing costs one tap, not two, and only sometimes.** Riku chose `/freelance`, so this is a cost note, not an argument. From a cold PWA launch the queue is **one tap** — the `QUEUE` tab, which is on screen at launch, above the fold, at a fixed position. From a push notification it is **zero taps**. The cost is therefore paid only on a cold open that was motivated by an approval and not by a notification, which is the case where Riku opens the app on his own initiative to clear the queue. Against that: every cold open that *was* motivated by "how is the freelance work doing" now pays nothing, and that is the case R42 optimised for. I think it is the right trade and I would not have argued the other way.

**The two stacked control rows are now a §6.2 cost, not an opinion — and I think they are the strongest argument for bringing the queue page's S11 discussion forward.** The substance moved into §6.2 above, where it belongs: it is a cost A-2 creates, and the critic was right that leaving it here would have kept it out of the spec. What remains mine is the priority call. Two things could be done and only one of them is available: restoring the filters' active fill in CSS alone is *technically* possible — the queue page gives the active filter no class at all (`className={s === statusFilter ? "" : "secondary"}`), so `button:not(.secondary)` selects it — but the rule would have to live either in `legacy.css`, whose header forbids additions, or in `components.css` reaching into a legacy page's internals, which is the third namespace that file exists to refuse. So the real fix is the S11 rebuild, porting `.range` for the filter row. **I would move that phase up.** Until A-2 the filters' flatness was a cost you had been told about; after A-2 there is a worked example of the correct treatment 38px above it, on the same screen, and it is a thing you notice.
