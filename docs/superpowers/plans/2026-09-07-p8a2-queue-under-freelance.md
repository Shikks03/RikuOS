# P8a-2 — The queue under Freelance: spec delta and implementation plan

**Date:** 2026-09-07 · **Written by:** the Frontend Architect, from **R42** in `docs/superpowers/design/p8-team/round4-lead-rulings.md` ("Riku's decision after Plan A"). **Status:** for the lead's review. Nothing here is committed.

**Goal:** move the queue under the Freelance address, make the Freelance overview the landing page, and give the segment a header — the page title plus the design system's **view switch** — rendered above both views.

**Sequence:** A-2 runs after Plan A and **before Plan B**, because Plan C would otherwise build the page title in the wrong place. Plan A's Task 13 steps 5–6 are still outstanding; they fold into A-2's verification as one by-eye pass (R42).

**Architecture:** `/queue` becomes `/freelance/queue` by moving the folder. A new `freelance` segment layout renders `<h1 class="fl-title">Freelance</h1>` and, directly under it, a two-link view switch, then the view. The layout renders **no `<main>`** — the Dashboard brings `<main class="app-content">` and the Queue view brings `legacy.css`'s `<main>` — and the header reuses `.fl`, the same 920px column both views use, so the three columns align by construction rather than by arithmetic (R34). The old address is kept alive by a permanent redirect in `next.config.ts`, which runs before the proxy.

**Tech stack:** unchanged. **No new dependency. No CSP change. `src/proxy.ts` is not edited.**

---

# Part 1 — Spec delta

Amendments to `docs/superpowers/specs/2026-09-07-p8-freelance-page-visual-design.md`, written in the spec's own register so they can be pasted in. R42's calls are recorded, not re-argued; where R42 left a number or a mechanism open it is decided here and the reasoning is given.

## §3.1 Rail anatomy — amended

Replace the **Nav** bullet's first sentence:

> - **Nav.** Two items — **Freelance, Settings** — each a 13px hand-drawn stroke glyph plus a 12.5px label at `--ink-3`, padding `6px 9px`, radius 7px, gap 9px. **Both carry a glyph or neither does; never a mix.** The active item takes a raised fill `#171B21`, an `--ink` label, and an **inset hairline** (`box-shadow: inset 0 0 0 1px var(--line)`) — never a left accent bar.
>
> **The rail marks Freelance active on both Freelance views.** `NavList` matches with `pathname === href || pathname.startsWith(href + "/")`, so `/freelance/queue` lights Freelance. **The view switch (§3.4) matches with equality for the opposite reason** — see there.

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

**`<nav>`, with an accessible name.** R40 left the document's single `<nav>` unnamed on the grounds that it was the only one. A-2 makes it not the only one, so the new landmark is named: `aria-label="Freelance views"`. See **Open question 1** for the rail's.

**`aria-current="page"`** on the active link, and `class="on"` as the styling hook — the same split `NavList` already uses (`aria-current` for assistive tech, `.is-active` for CSS).

**Active is exact equality, never `startsWith`.** `/freelance` is a prefix of `/freelance/queue`, so `startsWith` would light **both** tabs on the Queue view. The rail uses `startsWith` precisely so Freelance stays lit there. **The two rules are deliberately opposite and each file says so.** (A future `/freelance/queue/:id` would light neither tab; there is no such route, and it is one line to change when there is.)

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

**The shipped rule**, with the three consequences of the element change:

```css
.segmented{
  display:inline-flex;background:#101318;border:1px solid var(--line);
  border-radius:9px;padding:3px;gap:3px;margin-top:var(--sp-3);
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
| `margin-top:var(--sp-3)` on the track | **derived** — the reference has no heading above it to space from. See the rhythm below. |
| `line-height:1.4` on the tab | **derived, and required by the element change.** A `<button>` takes the UA `font` shorthand's `line-height:normal`; an `<a>` inherits `body`'s `1.5`, which would make the track ~2px taller than the reference and make its height depend on JetBrains Mono's metrics. `1.4` is the value `legacy.css`'s bare `button` and `.btn` already declare, for exactly this reason (R34). |
| `.segmented a:hover{color:var(--ink)}` | **derived.** `base.css`'s `a:hover{color:var(--ink)}` is `(0,1,1)` and so is `.segmented a`; at a specificity tie the later stylesheet wins, and `components.css` loads after `base.css`, so the hover would be silently dead. The rail's `.navitem` is `(0,1,0)` and therefore *does* get that hover for free. Declaring it here gives the switch the same behaviour as the app's other navigation control, as a decision in the file rather than an accident of source order. `--ink-2` was considered and rejected: an inactive tab that hovers to a mid ink and an active tab at `--ink` would read as three states for two. The raised fill is what distinguishes the active tab, hovered or not. |

**Not ported:** the reference's sibling `.range` (the floating time-range switch). P8 has no time range, and §5.8 forbids declaring vocabulary with no consumer.

**Two literals, deliberately not tokens.** `#1D222A` happens to equal `var(--line)`; the reference writes the literal for the *fill* and the token for the *border* because they are two different jobs, exactly as `.navitem.is-active{background:#171B21; box-shadow:inset 0 0 0 1px var(--line)}` does. Tidying the fill into `var(--line)` would tie the raised fill to the hairline colour for ever. `#101318` is now written three times in the app (twice in `legacy.css`'s `input`/autofill rules, once here); R34's note stands — it becomes a token if it ever moves. Note also that `DESIGN-INSPO.md` §2 maps `--sunk` (`#050608`) to "Recessed wells, control tracks", while the reference's own control track is `#101318`. **The drawn file is the truth** (spec §"four companions": "Where prose here is ambiguous, the mockup is the truth"); the tension is recorded, not resolved here.

`border-radius:9px` on the track is outside the radius set (`--r-tag` 6 · `--r-nav` 7 · `--r-chip` 8 · `--r-card` 10 · `--r-feature` 14 · `--r-pill` 999) and ships as a literal, the same way `.app-brand .tile{border-radius:7px}` and `.track{border-radius:99px}` already do.

**Focus.** `base.css`'s `:focus-visible{outline:2px solid var(--spend);outline-offset:3px;border-radius:3px}`, unchanged and unqualified. Arithmetic: a tab's border box sits 4px inside the track's (1px border + 3px padding), and the ring is drawn 3px outside it and 2px thick, so the ring's outer edge lands ~1px beyond the track and overlaps the neighbouring tab by ~2px. Outlines do not affect layout and nothing here sets `overflow:hidden`, so this is a paint overlap and not a reflow. It is the system's ring verbatim (§5.7, "not changed" in round 4) and stays as is.

**Hover, active, motion.** Hover as above. No `transition` on the switch — the change of view is a navigation, not an animation, and `prefers-reduced-motion` therefore has nothing to suppress here.

### Label text and casing as rendered

The DOM text is **`Dashboard`** and **`Queue`**, sentence case, exactly as R42 names the views and exactly as the reference writes its own markup (`<button class="on">Subscription</button>`). `text-transform:uppercase` renders them **`DASHBOARD`** and **`QUEUE`** in JetBrains Mono at 9.5px / `0.13em`. This is the reference's stated rule for controls — "Controls are labelled in the machine's voice; content is labelled in yours" — and it matches the rail, which also stores sentence-case labels.

### The vertical rhythm, as numbers

Everything below is a declared value plus the arithmetic that turns it into what the eye sees.

| Gap | Value | Where it comes from |
|---|---|---|
| top bar → title | **28px** | `.fl-head{padding-top:var(--sp-6)}` — the same 28px `main` gave the title before A-2. **The title does not move.** |
| title → switch | **10px** (`--sp-3`) | new, derived; see below |
| switch → the view's first content, **Dashboard** | **28px** | `main.app-content{padding-top:var(--sp-6)}`, with `.fl`'s first child's own top margin zeroed |
| switch → the view's first content, **Queue** | **38px** | `legacy.css`'s `main{padding-top:var(--sp-6)}` **+** the page's first child `.row{margin-top:var(--sp-3)}` |

**Why 10px between the title and the switch.** `DESIGN-INSPO.md` §3 gives two numbers for this region — "Eyebrow → heading: 5px. Heading → content: 20px" — and no number for a control bound to a heading, which is what the switch is. It must read as *belonging to* the title and as clearly closer to it than the view content is to the switch. `.fl-title` is 24px display with `line-height:1.5` inherited from `body` (nothing overrides it), so its line box is 36px and roughly 3.9px of half-leading plus ~5.8px of descent sit below the baseline of a word with no descenders. So a declared 10px reads as **≈19.6px of optical space** from the bottom of "Freelance" to the top of the track — tighter than the 28px below the switch, and unmistakably attached. At 14px (`--sp-4`) the optical gap becomes ≈23.6px against 28px below, a 1.19 ratio, and the switch starts to float between the two.

**The switch's own height: 33.3px.** Tab text box `9.5 × 1.4 = 13.3px`, plus `6 + 6` padding = 25.3px; plus the track's `3 + 3` padding and `1 + 1` border = **33.3px** (33px in DevTools). Width is shrink-wrapped by `inline-flex` to **≈156px** at these strings.

**The `inline-flex` line box does not leak.** `.segmented` is an atomic inline-level box in an anonymous line box inside `.fl`, whose strut is `body`'s 13px / 1.5 = 19.5px. Per CSS 2.1 §10.8 an atomic inline contributes its **margin box** to the line box, and here that box is taller than the strut both above the baseline (≈30px vs ≈13.4px) and below it (≈13.3px vs ≈6.2px), so the strut adds nothing and the line box is exactly `10 + 33.3 = 43.3px`. The header's total height is therefore `28 + 36 + 10 + 33.3 = 107.3px`. **If a measurement ever shows extra space under the switch, the one-line fix is `display:flex;width:max-content`** — a block-level box with no strut, visually identical, and a marked difference from the reference. It is not taken now because the arithmetic says it is not needed and the port is meant to be verbatim.

**Why the header's `padding-bottom` is 0.** The Queue view's `<main>` is `legacy.css`'s, whose `padding: var(--sp-6) var(--sp-6) var(--sp-8)` also serves `/login` and cannot be changed. So the Queue view's content can never begin less than 28px below the header. Any bottom padding on `.fl-head` is therefore added to *both* views on top of 28px, and the smallest achievable gap — and the smallest achievable difference between the two views — is reached with `padding-bottom:0`.

**What the eye will see, and whether the layout compensates.** It does not compensate, deliberately. The Queue view's first control row sits **10px lower** than the Dashboard's first block. That is the same 10px already recorded as carry-forward (5) after Plan A — `/queue`'s first child is a `.row` with `margin-top:var(--sp-3)` and the only ways to remove it are a TSX edit R18 forbids or a rule `legacy.css`'s own header forbids. A-2 does not create the cost; **it does make it more visible**, because the two views are now one click apart instead of one nav item apart, and the switch above them is a fixed reference edge the eye can measure from. At a 28px baseline a 10px difference is about 36% and is perceptible on a fast A/B switch, invisible otherwise. Recorded, not fixed. See **Open question 3** for the one CSS-only escape hatch and why it is not recommended.

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

Plus one normalisation rule, `.fl > :first-child { margin-top: 0 }`, which declares no vocabulary.

**No declared-but-unused vocabulary is added.** The §5.8 list stays `.statstrip`, `.btn.go`, `.statuspill`, `--session` — `.range` is explicitly not ported, and one entry is *removed* from the app (see §5.8 below).

## §5.3 The scale actually used — one row added

| Element | Spec |
|---|---|
| View-switch tab `.segmented a` | mono · 9.5px · `0.13em` · uppercase · `--ink-3`, `--ink` when active · `6px 12px` · radius 6px |

## §5.8 Declared vocabulary that renders nowhere — amended

`IconQueue` loses its only consumer when the rail drops to two items and is **deleted** from `src/components/icons.tsx`. §7.2's icon list becomes `IconFreelance`, `IconSettings`, `IconInfo`, `IconMark` — the same reasoning that already kept `IconLogout` out.

The `.statstrip` / `.btn.go` / `.statuspill` / `--session` list is unchanged and, per R42's own rule, does not grow: the view switch ships with its consumer, and the reference's `.range` is not ported.

## §6.2 Costs, named rather than discovered later — one added

> **The Queue view starts 10px lower than the Dashboard view.** `legacy.css`'s `main` gives both views a 28px top padding; the queue page's first child is a `.row`, whose `margin-top: var(--sp-3)` adds 10px on top of it. Removing it needs either a TSX edit (R18 forbids further edits to that file) or a new rule in `legacy.css` (its header forbids additions). This is the same 10px recorded as carry-forward (5) after Plan A; the view switch does not create it but does put the two views one click apart, which makes it easier to see. It goes when the queue page gets its own S11 content discussion and is rebuilt.

## §7.2 Route group and shell — amended

Replace the tree and the paragraphs that follow it:

```
src/app/(app)/layout.tsx                     server — the shell
src/app/(app)/freelance/layout.tsx           server — the segment header (new). NO <main>.
src/app/(app)/freelance/ViewSwitch.tsx       "use client" — the two-view switch (new)
src/app/(app)/freelance/page.tsx             the Dashboard view
src/app/(app)/freelance/queue/               git mv from src/app/(app)/queue/
src/app/(app)/settings/                      unchanged
src/app/(app)/_shell/…                       unchanged
src/app/login/page.tsx                       stays outside the group — no shell
src/components/icons.tsx                     IconFreelance, IconSettings, IconInfo, IconMark
```

> **The routes.** `/freelance` is the Dashboard view; `/freelance/queue` is the Queue view. The move is `git mv src/app/(app)/queue src/app/(app)/freelance/queue`; the folder's contents are unchanged except the one `?from=/queue` literal, which becomes `/freelance/queue` — a route move's mechanical consequence, allowed by R42 despite R18. The relative `./PushControls` import moves with the folder.
>
> **`/queue` is permanently redirected** to `/freelance/queue` by `redirects()` in `next.config.ts`. Config redirects run **before** the proxy, so a signed-out hit on `/queue` becomes `/login?from=/freelance/queue` rather than `/login?from=/queue`. `src/proxy.ts` is not touched and needs nothing: `isPublicPath` is an allowlist, `/freelance/queue` is not on it, and the path contains no `%`, `..` or `//`, so it is treated exactly as `/queue` was. `next.config.ts`'s `headers()` block — the CSP — is not touched either.
>
> **The landing.** `/` redirects to `/freelance`; `manifest.ts`'s `start_url` is `/freelance`; the login page's default `from` is `/freelance`. Push notifications keep opening the queue: `buildPushPayload`'s default url and `public/sw.js`'s two fallbacks become `/freelance/queue`, and the morning cron's `Re-subscribe from …` names the new path.
>
> **The segment layout renders no `<main>`.** It renders `.fl-head > .fl > h1 + nav.segmented`, then `{children}`. The `(app)` layout above it already did the session check; the segment layout does none.
>
> **The switch is the shell's fourth client island**, and like the other three it exists for exactly one reason: `usePathname()` for the active state. It lives at `src/app/(app)/freelance/ViewSwitch.tsx`, beside the layout that renders it — the same colocation `src/app/(app)/freelance/queue/PushControls.tsx` already uses beside its page. Not `_shell/`, which is for chrome rendered on every page; not `_blocks/`, which Plan C owns for the page's content blocks.

**Carry-forward (4) is partly closed.** `/freelance/queue` now inherits a real `<h1>` from the segment layout, so the Queue view is no longer a page with no heading of any level. `/settings` still has none, and the browser tab title is still `APP_NAME` on every page; both stay in that carry-forward.

## §9 Verification before "done" — additions

Add to the list:

> 5. **`git grep -nE '(^|[^a-zA-Z/])[/]queue' -- src/ public/ next.config.ts` returns exactly three lines** — the redirect's `source`, and the two `proxy.test.ts` fixtures that use `/queue` as an example protected path and a traversal string. Any other hit is an address that was missed.
>    **The pattern must be written with `[/]`, not a leading `/`.** In Git Bash on Windows, MSYS path conversion rewrites a `git grep` argument that begins with `/` into a Windows path, and the grep then matches nothing and *passes for the wrong reason*. (`MSYS_NO_PATHCONV=1` is the other fix.)
> 6. **The build's route table lists `/freelance`, `/freelance/queue`, `/settings`, `/login` and no `/queue`.** Delete `.next/` before the build: a route move leaves a stale manifest behind.
> 7. **By eye:** `/queue` redirects; signed out, it redirects to `/login?from=/freelance/queue`; sign-in lands on `/freelance`; the switch renders under the title on both views with exactly one tab active; the rail marks Freelance active on both; the four columns share one left edge; the rhythm is §3.4's.

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
| `src/styles/components.css` | **A-2 modifies** | Adds `.fl-head`, the `.segmented` port, and `.fl > :first-child{margin-top:0}`. |
| `src/app/(app)/freelance/layout.tsx` | **A-2 creates** | The segment header: `<h1 class="fl-title">` + the view switch. Renders **no** `<main>`. |
| `src/app/(app)/freelance/ViewSwitch.tsx` | **A-2 creates** | `"use client"`. Two `<Link>`s, `aria-current="page"`, exact-equality active match. |
| `src/app/(app)/freelance/page.tsx` | A creates, **A-2 modifies**, **C rewrites** | Loses the `<h1>`; the frame stays so Plan C's Task 2 replaces the file it expects. |

## Plan C amendments

`docs/superpowers/plans/2026-09-07-p8c-freelance-page.md` needs these and nothing else. A-2 was deliberately shaped to keep this list to two items.

1. **Task 2, Step 1 ("Replace `src/app/(app)/freelance/page.tsx`"), the code block at plan line ~380.** Delete the line

   ```tsx
           <h1 className="fl-title">Freelance</h1>
   ```

   The segment layout owns the title (R42). `.fl`'s first child becomes the whole-page-down `.fl-fail` or, after Task 3, the `.fl-body` group. Both of those carry `margin-top: var(--sp-5)` for a heading that is no longer above them; `components.css`'s new `.fl > :first-child{margin-top:0}` zeroes it, so **Plan C's markup needs no other change** and the hero row sits 28px under the switch.

2. **The "three deviations" preamble, deviation 1** (plan line ~30). Its sentence *"and the page title is `<h1 className="fl-title">`, not the mockup's `<h3>` with an inline margin"* becomes: *"and the page title is an `<h1 className="fl-title">` rendered by the segment layout, not by this page (R42)."* The rest of the deviation — real `<h2 className="fl-h">` block headings — is unchanged.

3. **Nothing else.** In particular: Plan C's ground rule *"`src/styles/*.css` is not edited"* still holds — A-2 ships every rule Plan C renders into. Its self-review class list (line ~1348) is still accurate; `.fl-title` moves out of the page's markup but the class still exists, and Plan C should drop it from that list when it drops the element. `.fl-body` keeps its consumer and its class; only its `margin-top` is neutralised in the position it currently occupies, the same way "DIFFERENCE 3" already neutralises two of `main`'s three declarations. Plan C's checkpoint *"whether `/freelance` exports `metadata.title` is a Plan C ruling"* is untouched by A-2 — see **Open question 2**.

## Open questions for the lead

1. **The rail's `<nav>` has no accessible name, and A-2 makes it one of two.** R40 declined to name it because it was the document's only `<nav>`; the switch is a second navigation landmark, so two unnamed ones would be announced as "navigation" and "navigation". A-2 names the new one (`aria-label="Freelance views"`). **Recommendation: name the rail's in the same commit** — `aria-label="Main"` on `.app-nav`, one attribute in a file A-2 is already editing, and the reason R40 gave for deferring is exactly what A-2 removes. Task 1 Step 5 includes it; strike that one line if the lead prefers to keep it with the a11y pass.

2. **A-2 creates `src/app/(app)/freelance/layout.tsx`, which is the vehicle carry-forward (4) named for page titles** ("a segment `layout.tsx` per page exporting `metadata.title`, plus a `title.template` on the root layout"). Half of it now exists. **Recommendation: do not add `metadata` in A-2.** It is recorded as Plan C's ruling, a layout-level title would give both views the same tab title, and the root-layout `title.template` half is not in A-2's scope. Noted here so the ruling is made knowingly rather than by omission.

3. **The Queue view's 10px, and the one CSS-only escape hatch.** The segment layout could wrap `{children}` in `<div class="fl-view">`, and `components.css` could then carry `.fl-view > main > .row:first-child{margin-top:0}` — no TSX edit to the queue page, no addition to `legacy.css`, and both views would start at exactly 28px. **Recommendation: do not.** It is a `components.css` rule reaching into a legacy page's internals, which is the third namespace the file's header refuses, and it would break silently if the queue page's first element ever changed. Record the 10px in §6.2 (done above) and let the queue page's own S11 rebuild fix it.

4. **`.fl > :first-child{margin-top:0}` versus dropping `.fl-body`.** The alternative to the normalisation rule is to amend Plan C Task 3 Step 3 to drop the `<div className="fl-body">` wrapper and delete `.fl-body` from `components.css` — one fewer class, but a second Plan C amendment, and the whole-page-down notice would then sit 48px under the switch instead of 28px because `.fl-fail` keeps its own 20px. **Recommendation: keep the rule.** It makes §3.4's number true in every render state, it touches Plan C once instead of twice, and it is the same species as the two `:first-child{border-top:0}` rules already shipped.

5. **Three small edits R42 does not literally authorise, each one line, each easily struck.** (a) `login/page.tsx`'s comment `// malformed value — keep the "/queue" default` — R42 says "one string", but a comment that quotes the old default is wrong the moment the default changes. (b) `LogoutButton.tsx`'s docblock "moved here from `/queue`'s deleted inline header" — history that is still true but leaves a stale address in a grep; proposed as "from the queue page's deleted inline header". (c) `push.test.ts`'s explicit-url example `"/queue?status=pending"` — an example, so it may stay, but it teaches the shape of a push URL and after A-2 that shape is `/freelance/queue…`. **Recommendation: all three.** They are why the §9 grep can expect exactly three lines instead of "three plus some prose".

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

Renaming one public address cannot be split without a wrong intermediate commit. If the redirect lands first, `/queue` 308s to a route that does not exist yet. If the folder moves first and the pointers do not, `/` redirects to a 404. So **Task 1 is one commit containing the move and every pointer at it** — after it, the app is internally consistent and only an external bookmark on `/queue` is dead. **Task 2 is the redirect alone**, which is a compatibility shim for the old address (including an already-installed PWA's cached `start_url`) and is a genuinely separate concern that is only correct after Task 1. **Task 3 is the header and the switch**, a new feature. **Task 4 verifies.**

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
 * The prefix match is deliberate and is the OPPOSITE of the view switch's,
 * which compares for equality. /freelance/queue must light Freelance HERE
 * (the rail names the area) and must light only Queue THERE (the switch names
 * the view). A prefix match in the switch would light both of its tabs;
 * an equality match here would leave the rail with nothing lit on the Queue
 * view.
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
            className={active ? "navitem is-active" : "navitem"}
            aria-current={active ? "page" : undefined}
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

> `aria-label="Main"` is **Open question 1**. If the lead prefers to keep landmark naming with the a11y pass, delete that one attribute and the paragraph is unaffected.

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

The default-url assertion **must** move in the same commit as the default. The explicit-url example is **Open question 5(c)**.

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

The rail keeps its prefix match so /freelance/queue lights Freelance; the
view switch that follows uses equality for the opposite reason, and both
files say so.

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
   * PWA whose cached start_url is still /queue.
   *
   * next.config redirects run BEFORE the proxy, so a signed-out hit on /queue
   * becomes /login?from=/freelance/queue and the login page sends the session
   * to the right place. src/proxy.ts is not touched: /freelance/queue is not
   * on its allowlist, which is exactly how /queue was treated.
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

Two insertions in `src/styles/components.css`.

**(a)** Immediately after `.fl-body{margin-top:var(--sp-5)}` (currently line 146) and before the `/* ---- stat hero cards ---- */` banner, add:

```css

/* ---- the page header: title + view switch (R42) ---------------- */
/* The Freelance segment layout renders these above BOTH views, so the header
   sits outside every <main>: /freelance brings its own
   <main class="app-content"> and /freelance/queue brings legacy.css's. It
   reuses .fl rather than declaring a second 920px column, which is what makes
   it align with the top bar and both views by construction (R34).
   padding-bottom is 0 on purpose: the <main> below contributes its own 28px
   top padding on both views, and legacy.css's `main` cannot be changed
   because it also serves /login. Spec §3.4 carries the arithmetic. */
.fl-head{padding:var(--sp-6) var(--sp-6) 0}
/* ADDED (R42): the design system's VIEW SWITCH, ported from
   docs/design/components.html's `.segmented`, whose note reads "Sits in a
   sunken track with a hairline border; the active tab is a raised fill.
   Left-aligned, directly under the heading it modifies."
   Values are the reference's, verbatim. Its sibling `.range` — the floating
   time-range switch — is NOT ported: P8 has no time range, and §5.8 forbids
   declaring vocabulary with no consumer.
   #1D222A happens to equal var(--line). The reference writes the literal for
   the FILL and the token for the BORDER because they are two different jobs;
   tidying the fill into var(--line) would tie the raised fill to the hairline
   colour for ever. .navitem.is-active keeps its literal #171B21 for the same
   reason. #101318 is the reference's control-track ground (it is now written
   three times in this app — see R34's note on legacy.css).
   margin-top is 10px, not the 20px of a heading→content gap: the switch
   belongs to the title above it, and 10px reads as ~19.6px optically once
   .fl-title's 36px line box is accounted for. */
.segmented{
  display:inline-flex;background:#101318;border:1px solid var(--line);
  border-radius:9px;padding:3px;gap:3px;margin-top:var(--sp-3);
}
/* DIFFERENCE: the reference draws the tabs as <button>; these are two real
   URLs, so they are <a>. Three consequences, each handled here:
     * base.css underlines every anchor — the reference's own `border:0`
       removes it, the same fix .navitem, .fl-biz and .stat-top .more carry.
     * a <button> takes the UA font shorthand's line-height:normal; an <a>
       inherits body's 1.5, which would make the track ~2px taller than the
       reference and tie its height to the mono's metrics. Pinned to 1.4 —
       the value legacy.css's bare `button` and .btn already declare for
       exactly this reason.
     * base.css's `a:hover` is (0,1,1) and so is this selector; at a tie the
       later stylesheet wins and this one is later, so the hover would be
       silently dead. It is declared below instead of left to source order.
       (.navitem is (0,1,0) and gets that hover for free — this is the same
       brightening, made explicit.) */
.segmented a{
  font-family:var(--mono);font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;
  background:none;border:0;color:var(--ink-3);padding:6px 12px;border-radius:6px;
  cursor:pointer;line-height:1.4;
}
.segmented a:hover{color:var(--ink)}
.segmented a.on{background:#1D222A;color:var(--ink)}
```

**(b)** At the **very end** of the file, after `.statuspill i{…}`, add:

```css

/* ---- the .fl column's top edge (R42) --------------------------- */
/* The page title moved into the segment layout, so .fl's first child is now
   the view's first block, sitting directly under the header. Every candidate
   still carries the top margin it had for the heading that used to be above
   it — .fl-body 20px, .fl-fail 20px — and that margin would now double the
   header's gap and make the number in §3.4 false in the whole-page-down
   state. Zeroed here.
   LAST IN THE FILE ON PURPOSE. This selector is (0,1,0) and so are .fl-body
   (in the section-rhythm block) and .fl-fail (in the failure block); at equal
   specificity the later rule wins, so it has to outlive both. Same species as
   the two `:first-child{border-top:0}` rules above. */
.fl>:first-child{margin-top:0}
```

Then update the file's header comment. Replace lines 16–21 —

```
   Five deliberate differences from the mockup, each marked below:
```

— with:

```
   Six deliberate differences from the mockup, each marked below:
```

and append to that numbered list, after item 5:

```
     6. `.segmented`'s tabs are <a>, not <button> (R42) — line-height,
        border and hover, each commented in place.
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
 * EQUALITY, NOT startsWith. /freelance is a prefix of /freelance/queue, so a
 * prefix match would light BOTH tabs on the Queue view. The rail's NavList
 * uses startsWith for the opposite reason — it names the area, so Freelance
 * must stay lit here. The two rules are deliberately opposite. A future
 * /freelance/queue/:id would light neither tab; there is no such route, and it
 * is one line to change when there is.
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

The switch is components.html's `.segmented` ported verbatim, with three
declarations added because the tabs are <a> and not <button>: line-height
pinned to 1.4 (a button takes the UA line-height:normal, an anchor
inherits 1.5), the anchor hairline removed by the reference's own border:0,
and the hover declared rather than left to a specificity tie with
base.css's a:hover. The reference's sibling `.range` is not ported - no
consumer, and dead vocabulary must not grow.

The switch matches the path by EQUALITY, the opposite of the rail's prefix
match: /freelance is a prefix of /freelance/queue, so a prefix match would
light both tabs. Links rather than role="tab" because these are two real
URLs - bookmarkable, back-buttonable, and the target of every push.

Rhythm: 28px above the title (unchanged from Plan A - the title does not
move), 10px to the switch, 28px from the switch to the view's first
content. The header reuses .fl, so it shares one left edge with the top
bar and both views by construction (R34). .fl>:first-child{margin-top:0}
makes that 28px true in every render state including whole-page-down; it
sits last in the file because it must outrank .fl-body and .fl-fail, which
are (0,1,0) like it.

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
Expected: all suites pass, zero failures — including `push.test.ts`, `proxy.test.ts`, `watchdog.test.ts`, `agentStatus.test.ts`, `deadline.test.ts`, `osSettings.test.ts`.

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
next.config.ts:NN:    return [{ source: "/queue", destination: "/freelance/queue", permanent: true }];
src/lib/__tests__/proxy.test.ts:19:  it.each(["/", "/queue", "/api/queue", "/api/push/test", "/api/auth/logout"])(
src/lib/__tests__/proxy.test.ts:28:    "/api/cron/../queue",
```

The first is the redirect's source. The other two use `/queue` as an example of a protected path and as a traversal fixture; `isPublicPath` is a pure function and both remain valid inputs, so `proxy.test.ts` stays byte-unchanged.

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
Expected: no output from either. The authorization boundary and its tests are untouched.

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

1. **The switch renders under the title on both views**, left-aligned, one recessed track with two labels reading `DASHBOARD` and `QUEUE` in mono caps.
2. **Exactly one tab is active on each view.** On `/freelance`, `DASHBOARD` has the raised fill and `QUEUE` does not. On `/freelance/queue`, the reverse. **If both are filled on the Queue view, the switch is using `startsWith`** — that is the one bug this component can have.
3. **`aria-current` is on the active tab and only there.** Inspect both anchors in DevTools; the active one carries `aria-current="page"`, the other carries no such attribute.
4. **Clicking a tab is a soft navigation** — the rail does not flash, the badges are not re-fetched, and the URL changes.
5. **Hover.** An inactive tab's label brightens from `--ink-3` to `--ink` on hover; the active tab does not change. Nothing moves.
6. **Focus.** Tab to each switch link with the keyboard: the orange `:focus-visible` ring appears, slightly overhanging the track and the neighbouring tab, which is expected (the ring is `outline-offset:3px` and the tab sits 4px inside the track). Enter navigates. Nothing reflows when the ring appears.
7. **`/queue` redirects.** Type `http://localhost:3000/queue` — the address bar lands on `/freelance/queue` and the page renders. Then, in a **private window** (no session), type the same URL: it must land on **`/login?from=/freelance/queue`**, not `?from=/queue`. That is the check that config redirects run before the proxy.
8. **Sign-in lands on `/freelance`.** In the private window, from `http://localhost:3000/login` with no `?from=`, sign in (Riku types it): the app lands on the Freelance overview.
9. **`/` lands on `/freelance`.** Type `http://localhost:3000/` while signed in.
10. **The push click target.** Read `public/sw.js`: both the push handler's default and `notificationclick`'s fallback read `/freelance/queue`. **Optional and at Riku's discretion:** press `Send test` in the queue view's `PushControls` and tap the notification — it must open `/freelance/queue`. Nothing is sent to anyone but Riku's own browser; skip it if he would rather not.
11. **The four columns share one left edge.** With DevTools' rulers, or by dragging a guide: the top bar's `read HH:MM`, the `Freelance` title, the Dashboard's (currently empty) `.fl`, and the Queue view's status-filter row all start at the same x. Then narrow the window below ~1150px and confirm all four collapse together to a flat 28px inset.
12. **The rhythm is §3.4's.** In DevTools, on `/freelance`: the `.fl-head` box is 28px below the top bar's border; `.segmented` has a 10px top margin and a computed height of ~33px; `main.app-content`'s padding box starts 28px below the switch. On `/freelance/queue`: the same 28px from the switch to the `<main>` padding box, and the first `.row` a further 10px down — **38px total, the recorded cost.** Flip between the two views and confirm the difference reads as a small settle, not a jump.
13. **No leak under the switch.** The `.segmented` line box in DevTools measures 43.3px tall (10px margin + 33.3px box) with no extra space below it. If it is taller, the inline-flex strut is leaking and the fix is `display:flex;width:max-content` on `.segmented` — record it as a seventh marked difference before changing it.

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

Report: the trio green, the address grep at exactly three lines, the route table, and the result of each by-eye item — in particular items 2, 7, 11 and 12 of step 5, which are the ones that can fail silently.

Spec §9's fourth verification item — `/freelance` observed on Vercel against real ShikksTracker data — belongs to **Plan C** and is not claimed here.

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

Two things R42 does not mention that A-2 must do, both mechanical consequences: the `LogoutButton` and `legacy.css` prose that name the old address (Task 1 steps 5, 8 — **Open question 5**), and `push.test.ts`'s assertion on the default url, which must move in the same commit as the default (Task 1 step 7).

**2. Placeholder scan.** No `TBD`, no `TODO`, no "implement later", no "similar to Task N", no "add appropriate error handling". Every code step carries the complete file or the exact lines to change, with the surrounding lines quoted so the edit is unambiguous. Every command carries its expected output. The `/freelance/page.tsx` frame is a *deliberately minimal shipped file* whose scope R42 fixes, not a placeholder — its comment says which plan replaces it and what replaces it with.

**3. Type and name consistency across tasks.**

- `NAV` in Task 1 step 4 is `{ href; label; Icon }[]` with two entries; both `Icon`s (`IconFreelance`, `IconSettings`) are named exports that survive Task 1 step 3.
- `VIEWS` in Task 3 step 2 is `{ href; label }[]` — **no `Icon`**; R42 says text only, and the switch imports nothing from `@/components/icons`.
- `ViewSwitch` is a default export; `layout.tsx` imports it as `import ViewSwitch from "./ViewSwitch"`, a relative path inside the same segment folder.
- `FreelanceLayout({ children }: { children: React.ReactNode })` matches the `(app)` layout's own signature; no `params`, so no Next 16 async-props question arises.
- Both `NavList` and `ViewSwitch` are `"use client"` and both call `usePathname()`; neither takes props, so no prop type crosses a boundary.
- `buildPushPayload(title, body, url = "/freelance/queue")` — the default in `src/lib/push.ts` and the expected value in `src/lib/__tests__/push.test.ts` are the same string, changed in the same step.
- The redirect's `destination` (`/freelance/queue`), the moved folder's route, `sw.js`'s two defaults, `push.ts`'s default and the queue page's `?from=` value are all the same literal, `/freelance/queue`; Task 4 step 2's grep is what proves no fifth spelling survives.
- `/freelance` is the same literal in `src/app/page.tsx`, `manifest.ts`, `login/page.tsx` and `VIEWS[0].href`.

**4. Every CSS class the TSX uses exists after Task 3 step 1.**

| Used in | Classes | Where declared |
|---|---|---|
| `freelance/layout.tsx` | `.fl-head` | `components.css`, new in Task 3 step 1(a) |
| | `.fl` | `components.css` line 144, shipped by Plan A |
| | `.fl-title` | `components.css` line 140, shipped by Plan A |
| `freelance/ViewSwitch.tsx` | `.segmented` | new in Task 3 step 1(a) |
| | `.on` (as `.segmented a.on`) | new in Task 3 step 1(a) |
| `freelance/page.tsx` | `.app-content`, `.fl` | `components.css` lines 125, 144 |
| `_shell/NavList.tsx` | `.app-nav`, `.navitem`, `.is-active` | `components.css` lines 59, 63, 69 |

And in the other direction: every selector Task 3 step 1 adds has a consumer in the same commit — `.fl-head` and `.segmented`/`.segmented a`/`.segmented a.on` in `layout.tsx` and `ViewSwitch.tsx`, and `.fl > :first-child` on `.fl` itself. **The §5.8 declared-unused list does not grow**, and `IconQueue` leaves it in the other direction.

**5. What A-2 deliberately does not do.** No test is added: `ViewSwitch` is a rendering component whose only logic is a string equality, the repo has no component harness and P8 introduces none (spec §8), and the one thing worth pinning — that `startsWith` would light both tabs — is checked by eye in Task 4 step 5 item 2 and stated in the component's own docblock. No `metadata` export (Open question 2). No change to `src/proxy.ts`, `src/lib/__tests__/proxy.test.ts`, the CSP, `package.json`, or any file under `src/app/(app)/freelance/queue/` beyond one literal.

---

# Part 4 — My opinions, as the Frontend Architect

Three, kept short. The document above is the deliverable; these are mine and the lead rules.

**The switch must not carry a pending-approval count, and I agree with the lead's prior.** Three reasons, in order of weight. (1) R25 refused a pending-approvals count in the top bar because it would put "two 'waiting on you' numbers from two systems on one screen" — and the switch is *worse* than the top bar for this, because on the Dashboard view the count would sit ~40px above ShikksTracker's own needs-you hero card. The collision R25 named would be at its most literal. (2) A view switch is a navigation control; a badge on it makes it a status display, and the reader then has to decide each time whether the number describes the tab or the page. (3) Mechanically, the count is a Mongo read, so the segment layout would become a data component on every Freelance page view — R37's write-on-read and R38's five-second deadline territory, for a number the page already surfaces. The honest counter-argument is that a queue nobody is prompted to visit is a queue that silently fills; the answer is that push already carries that signal and now opens `/freelance/queue` directly, which is the whole reason `push.ts` and `sw.js` are in Task 1.

**The landing costs one tap, not two, and only sometimes.** Riku chose `/freelance`, so this is a cost note, not an argument. From a cold PWA launch the queue is **one tap** — the `QUEUE` tab, which is on screen at launch, above the fold, at a fixed position. From a push notification it is **zero taps**. The cost is therefore paid only on a cold open that was motivated by an approval and not by a notification, which is the case where Riku opens the app on his own initiative to clear the queue. Against that: every cold open that *was* motivated by "how is the freelance work doing" now pays nothing, and that is the case R42 optimised for. I think it is the right trade and I would not have argued the other way.

**The status-filter row under the switch will read as two stacked tab rows, and within R18 there is nothing to do about it now.** The Queue view's first element is a `.row` of six bare `<button>`s in the same mono 9.5px uppercase register as the switch's labels, 38px below it. Two consequences. First, the shape: a control strip under a control strip, both left-aligned in the same column, reads as two tiers of tabs. Second, and worse: §6.2 already priced out the filters' solid active state as "the price of one-treatment-per-selector", and the switch now demonstrates 38px above them exactly what an active segment looks like in this system. The lost affordance stops being an abstraction. **What could be done:** the queue page happens to give the *active* filter no class at all (`className={s === statusFilter ? "" : "secondary"}`), so `button:not(.secondary)` selects it and a fill could be restored in CSS alone — but that rule would have to live either in `legacy.css`, whose header forbids additions, or in `components.css` reaching into a legacy page's internals, which is the third namespace that file refuses. **So: nothing now.** I would record it as the strongest single argument for bringing the queue page's own S11 content discussion forward, because the switch makes the flatness of the row beneath it a thing you notice rather than a thing you were told about.
