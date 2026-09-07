# P8 round 5 — the Design Critic on the Plan A-2 delta

**Date:** 2026-09-07 · **Role:** review `docs/superpowers/plans/2026-09-07-p8a2-queue-under-freelance.md` — Part 1 (the spec delta) and Task 3's CSS and markup — against `DESIGN-INSPO.md`, `components.html`, the ratified visual-design spec, the shipped stylesheets, `p8-mockup.html`, and the binding rulings (R3, R8, R16/R29/R30, R18, R25, R33/R34, R39, R40, R42).
**Reviewed:** `components.html` lines 191–273 and 860–890 declaration by declaration; all four shipped stylesheets in full; the shell TSX; the mockup's three Freelance specimens; Next 16.2.10's own routing source in `node_modules/`.

---

I read R42 in full, the draft's Part 1 and Task 3 line by line, `components.html` 191–273 and 860–890, all four shipped stylesheets, the shell TSX, the mockup's three Freelance specimens, and Next 16.2.10's own routing source. Findings below.

---

## 1. Verdict

The port is honest and the arithmetic is mostly right — I re-derived the column table (all four left edges really do reduce to `28 + max(0, (A−976)/2)`), the `inline-flex` line box (43.3px, no strut leak), the `a:hover` specificity tie, and the redirect ordering, and all four hold. The document is better than the thing it plans. But it has one **false claim about the cascade** written into a CSS comment that will be read as the record, one **`aria-current` defect it creates and does not see**, a spec-edit instruction that would **silently delete four ratified paragraphs**, and a headline design number (10px) whose justification compares an optical gap above against a declared gap below and so overstates the attachment by nearly 2×. Also: the visual record (`p8-mockup.html`) is not in the file map, so after A-2 the mockup draws a header the app will never render. Four must-fixes, six should-fixes; none needs new design work, and only one (S1) needs a ruling from you.

*(Note: the brief names "Task 4" for the CSS and markup. It is **Task 3**; Task 4 is verification. I reviewed Task 3.)*

---

## 2. Must fix

### M1 — `.fl>:first-child` is `(0,2,0)`, not `(0,1,0)`; "LAST IN THE FILE ON PURPOSE" is false

**Where.** Draft lines 784–788 (the CSS comment), line 773 ("At the **very end** of the file"), line 985 (the commit message), line 275 (open question 4).

The comment says:

> LAST IN THE FILE ON PURPOSE. This selector is (0,1,0) and so are .fl-body (in the section-rhythm block) and .fl-fail (in the failure block); at equal specificity the later rule wins, so it has to outlive both.

`:first-child` is a pseudo-class and counts in the **b** column. `.fl > :first-child` is therefore `(0,2,0)`; `.fl-body` and `.fl-fail` are `(0,1,0)`. The rule wins on **specificity**, from anywhere in the file. The stated mechanism is wrong, and the placement it justifies is wrong with it.

**Why it matters.** `components.css`'s whole premise is that its comments are the record — R34, R37–R41 all landed as comments in this file. A comment that teaches a false cascade rule is worse than no comment: the next person moves the rule, sees nothing break, and concludes the comment was cargo cult. The draft's own analogy makes the point against it — `.fl-stages>.fl-stage:first-child` (line 241) and `.fl-rows>.fl-row:first-child` (line 323) are both `(0,3,0)` and both sit **immediately beside the rules they override**, in their own sections. "Same species as the two `:first-child{border-top:0}` rules above" (line 787) argues for the opposite placement from the one chosen.

**Fix.** Put the rule at line 147, immediately after `.fl-body{margin-top:var(--sp-5)}`, inside the `/* ---- section rhythm ---- */` block, and replace the comment's second paragraph with:

```
   .fl>:first-child is (0,2,0) — a class plus a structural pseudo-class —
   so it outranks .fl-body and .fl-fail, both (0,1,0), from anywhere in the
   file. It sits here, beside the rules it overrides, the same way
   .fl-stages>.fl-stage:first-child and .fl-rows>.fl-row:first-child do.
```

Strike "LAST IN THE FILE ON PURPOSE" from the plan (773), the comment (784) and the commit message (985–986).

---

### M2 — on `/freelance/queue` two elements claim `aria-current="page"`, and one of them is lying

**Where.** Draft line 52 (the `aria-current` / `.on` split), line 54 (the equality-vs-`startsWith` paragraph), line 241 (the NavList file-map row), ViewSwitch docblock lines 834–839.

`NavList.tsx:32,38` computes one boolean from `startsWith` and spends it on **both** `.is-active` and `aria-current="page"`. Today that is harmless: `/queue` and `/freelance` match by equality anyway. After A-2, on `/freelance/queue` the rail's **Freelance** link — `href="/freelance"`, a *different URL* — carries `aria-current="page"`, and the switch's **Queue** link carries it too. ARIA defines `page` as "the current page within a set of pages". `/freelance` is not the current page there.

**Why it matters.** The draft writes a careful paragraph (54) about the two matching rules being "deliberately opposite and each file says so" — and it is a paragraph about **CSS**. The same boolean drives an ARIA attribute where the two rules are *not* interchangeable: `startsWith` is right for the visual state (the rail names an *area*) and wrong for `aria-current="page"`. A-2 creates this, in a file A-2 is already editing, for one expression. It also makes the switch's own `aria-current` less useful, because a screen-reader user hears "current page" twice on one screen for two different URLs.

**Fix.** In Task 1 step 4, split the two in `NavList.tsx`:

```tsx
const active = pathname === href || pathname.startsWith(`${href}/`);
// .is-active follows the AREA (startsWith): Freelance stays lit on
// /freelance/queue. aria-current="page" follows the PAGE (equality): on
// /freelance/queue the current page is the switch's Queue tab, not this
// link. ViewSwitch matches by equality for both.
className={active ? "navitem is-active" : "navitem"}
aria-current={pathname === href ? "page" : undefined}
```

and add the sentence to the §3.1 amendment at draft line 25. (`aria-current="true"` on the prefix match is the alternative; `undefined` is cleaner, because the rail's raised fill already says it.)

---

### M3 — the §7.2 instruction deletes four ratified paragraphs

**Where.** Draft line 192: *"Replace the tree and the paragraphs that follow it."*

The paragraphs that follow §7.2's tree in the ratified spec are: the route-group paragraph, **"Rejected:** one root layout with `usePathname()`-driven conditional chrome…", **"The shell renders no `<main>`"**, **"Active nav is a client island"**, **"A session check in the layout, as defence in depth"**, and **"Icons."** The delta's five replacement blockquotes cover the routes, the landing, the redirect and the segment layout. It does not restate the rejected alternative, the defence-in-depth rationale, or the icon inventory — all three ratified, all three still true.

Separately, the new tree collapses six shell files into `src/app/(app)/_shell/… unchanged`, deleting the per-file annotations — including `NavList.tsx "use client" — the only client island in the shell`, which R39/R40 already corrected to three and A-2 makes four.

**Why it matters.** The spec is the record; the delta is written "in the spec's own register so they can be pasted in", which means someone will paste it. Losing "Rejected: one root layout…" is losing the reason nobody may propose it again.

**Fix.** Change line 192 to: *"Replace the tree, and the paragraph beginning 'A route group changes no URL'. The **Rejected**, **Active nav is a client island**, **A session check in the layout** and **Icons** paragraphs stand, with two corrections: the login default is `/freelance`, and the shell has **four** client islands — `NavList`, `LogoutButton`, `TopBar` (R39) and `ViewSwitch` — each for one reason."* Keep the six `_shell/*` rows verbatim in the tree and add the corrected island annotations. Move the `IconQueue` deletion from §5.8 (draft 182) to §7.2's Icons paragraph, where the inventory actually lives; §5.8 keeps only the sentence that the unused list does not grow.

---

### M4 — the 10px is true only because of a `line-height` nobody declared, and §5.3 claims to be complete

**Where.** Draft line 140 (the derivation), line 178 (the §5.3 row added).

The whole rhythm rests on: *"`.fl-title` is 24px display with `line-height:1.5` inherited from `body` (nothing overrides it), so its line box is 36px."* Correct — `components.css:140–143` declares no line-height, `legacy.css:36–39` declares none, `base.css:19` sets 1.5. But §5.3's header says **"Read off the mockup's CSS. This is the whole inventory; nothing else has a size,"** and its `.fl-title` row reads only "display 600 · 24px · `-0.02em`". The one value the header's entire arithmetic depends on is absent from the inventory that claims completeness — and `line-height:1.2` on a display heading is the single most natural "tidy" anyone would apply to that rule. R42 says in terms: *"The vertical rhythm … is a design number the spec delta must state, not leave to the build."* A number that silently depends on an undeclared inherited value is not stated.

The same §5.3 row for the new tab omits `line-height 1.4`, which the delta itself calls "**derived, and required**".

**Fix.** Amend §5.3's existing page-title row and the new tab row:

| Page title `.fl-title` | display 600 · 24px · `-0.02em` · **line-height 1.5 (inherited; load-bearing for §3.4's title→switch gap — do not tighten without re-deriving it)** |
| View-switch tab `.segmented a` | mono · 9.5px · `0.13em` · uppercase · **line-height 1.4** · `--ink-3`, `--ink` when active or hovered · `6px 12px` · radius 6px |

and add `line-height:1.5` explicitly to `.fl-title` in `components.css` with a one-line comment naming §3.4, exactly as `.stat .fig` already carries an explicit `line-height:1.06` for the same reason.

---

## 3. Should fix

### S1 — 10px reads as 19.6px against 28px: ratio 1.43, not "unmistakably attached"

**Where.** Draft line 140.

The derivation is arithmetically fine (I get ~18.9px against the draft's ~19.6px; within a pixel). The **comparison** is not. Line 140 compares an *optical* gap above (19.6) with a *declared* gap below (28) and concludes "tighter than the 28px below the switch, and unmistakably attached." But below the switch there is no leading to add — the delta's own analysis (line 144) establishes the line box is exactly `10 + 33.3`, so the 28px below is a true 28px of whitespace. The like-for-like reading is **19.6 above vs 28 below — a ratio of 1.43**. The declared-vs-declared reading (10 vs 28, 2.8) is the flattering one and it is not what the eye does.

Against the system's own numbers: eyebrow→heading is 5px declared ≈ **9px optical** (the bound pair); heading→content is 20px declared ≈ **29px optical**. 19.6 sits almost exactly at the midpoint of those two. The reference's rule is "**directly** under the heading it modifies" (`DESIGN-INSPO.md:197`, `components.html:885`). 19.6px of air, against 28px, is not "directly under" — it is a control floating between its heading and the content, which is the exact failure line 140 says it is avoiding at 14px.

**Fix (a ruling for you, two options, both one token):**
- **`margin-top:var(--sp-2)`** (6px) → **≈15.6px optical against 28px = 1.79**. Still on the scale, clear of the focus ring (the ring's outer edge sits 1px above the track, so 5px of clearance under the title's line box remains), and it puts the switch nearer the eyebrow's 9px than the content's 29px. **My recommendation.**
- Keep 10px and pin `.fl-title{line-height:1.25}` (30px box, zero half-leading) → ≈15.9px optical, the same result with an extra declaration and a heading whose leading no longer matches the body scale.

Whichever you take, line 140's comparison must be rewritten as optical-vs-optical so the number survives the next person's arithmetic.

---

### S2 — "three declarations added" is two

**Where.** Draft line 90 ("the three consequences of the element change"), the Task 3 comment at 750–763, the commit message at 967–971.

The commit message says: *"three declarations added because the tabs are `<a>` and not `<button>`: line-height…, **the anchor hairline removed by the reference's own `border:0`**, and the hover."* A declaration that is verbatim from the reference is not an addition — and the delta's own table (line 109) correctly lists `border` under **verbatim**. Two declarations are added (`line-height:1.4`, `.segmented a:hover`); one verbatim declaration happens to do a second job.

**Why it matters.** This file's audit story is "which declarations are the reference's and which are ours". Miscounting it in the commit message and in §3.4's prose is how a later port copies three exceptions instead of two.

**Fix.** Line 90 → *"with the two declarations the element change requires, and one note on a verbatim declaration that does double duty."* Commit message → *"two declarations added … and one verbatim declaration, `border:0`, that also removes `base.css`'s anchor hairline."*

---

### S3 — `line-height:1.4` does not reproduce the reference's height; say why it is right anyway

**Where.** Draft line 112, comment at 754–758.

The claim: an `<a>` at 1.5 *"would make the track ~2px taller than the reference"* and 1.4 is the fix. A `<button>`'s UA `line-height:normal` resolves from the font's metrics — for JetBrains Mono that lands near **1.3**, so the reference's track is ≈32.5px and the port at 1.4 is ≈33.3px. `1.4` is ~0.8px **taller** than the reference, not equal to it.

That is invisible and I would not change the value. But the stated reason is the wrong one, and the right one is stronger: **1.4 makes the height deterministic and font-independent** (which line 112 half-says: "tie its height to the mono's metrics"), **and it is the line-height `legacy.css:44`'s bare `button` and `components.css:385`'s `.btn` already carry** — so the switch's tabs and the queue's filter pills, which will sit 38px apart on the Queue view, share one line-height. That second reason is the one that matters at the pixel level and it is not in the comment.

**Fix.** Rewrite line 112 and the CSS comment: *"`normal` is font-metric-derived (≈1.3 for JetBrains Mono), so the reference's track is ≈32.5px and this one is ≈33.3px. 1.4 is taken not to match that number but to stop the track's height depending on the mono's metrics at all, and because it is the line-height `.btn` and `legacy.css`'s bare `button` already declare — the switch and the queue's filter pills sit 38px apart and must share it."*

---

### S4 — the track's recess is defined against a ground the app does not have

**Where.** Draft line 117 (the `#101318` / `--sunk` tension paragraph).

The delta records that `DESIGN-INSPO §2` maps `--sunk` (`#050608`) to "Recessed wells, control tracks" while the reference's track is `#101318`, and defers to the drawn file. Right procedure, wrong half of the tension. The thing that matters is the **ground**: in `components.html` the switch specimen sits inside `.well{background:var(--sunk)}` — `#050608`. Track-to-ground contrast there is Δ(11,13,16). On `/freelance` the switch sits on `--void` `#08090B`, so Δ drops to **(8,10,13) — about a quarter less separation**. The port is byte-faithful and lands ~25% flatter than drawn, and the recess has to be carried entirely by the `--line` hairline.

**Fix.** Keep `#101318` — diffability against `components.html` is the file's stated rule and I would not break it for this. But say the real thing in the comment: *"The reference draws this track inside a `--sunk` well; here it sits on `--void`, so the track/ground separation is ~25% smaller than in the specimen and the `--line` hairline does more of the work. If it reads as a floating lighter bar rather than a recess, the alternative is `--sunk` for the track, which would make the recess literal — that is a ruling, not a tidy."* And sharpen Task 4 step 5 item 1 (draft 1093) from "one recessed track" to **"the track reads as recessed against the page ground, not as a floating lighter bar."** That is a check that can fail; the current wording cannot.

---

### S5 — §6.2 gains one cost; it should gain three

**Where.** Draft line 188.

§6.2's contract is "costs, named rather than discovered later". A-2 adds the 10px. It creates two more it does not name:

**(a) Two stacked control rows on the Queue view.** The draft's best paragraph on this is stranded in **Part 4 — My opinions** (line 1207), which is explicitly the architect's and will not be pasted into the spec. It belongs in §6.2, where it is a *cost of A-2*, not an opinion. And it is worse than Part 4 says, in a way that is worth stating precisely: `DESIGN-INSPO §5.3` assigns the **recessed track** to the view switch and **no track** to the filter row, so the two rows are correctly differentiated *by grammar* — but §5.3 also gives the filter row the **loudest active state in the system** ("a solid white pill with dark text… correctly so, because it silently reframes every number on the page"), and `legacy.css`'s named cost took that away. So A-2 inverts the reference's emphasis: the navigation control now shouts and the reframing control whispers, 38px apart, in the same 9.5px mono caps.

**(b) `/settings` now has no header at all.** Both Freelance views gain a 107px header band with a 24px title; `/settings` has had no heading of any level since Task 11 and gains nothing. Two of three pages are titled, one is not, and the asymmetry is now structural rather than incidental. That is carry-forward (4), but A-2 sharpens it and should say so.

**Fix.** Add both to §6.2, in the spec's register. For (a), end with the forward pointer: *when the queue page gets its S11 discussion, the fix is to port `components.html`'s `.range` for the status-filter row — it is the reference's own answer to "a filter under a view switch", and it restores the emphasis order.* That also retires the "`.range` has no consumer" objection at line 115 by naming its future consumer.

---

### S6 — the mockup is not in the file map, and after A-2 it draws a header the app never renders

**Where.** Draft line 227 (the series file map) — `docs/design/p8-mockup.html` does not appear.

All three Freelance specimens draw `<h3 class="fl-title" style="margin:0">Freelance</h3>` immediately followed by `.fl-body` (mockup lines 599–602, 771, 1059). After A-2 that sequence does not exist in the app. The spec's own "four companions" rule is *"Where prose here is ambiguous, the mockup is the truth"* — so leaving it stale does not just make it out of date, it makes a **falsehood authoritative** for the one region A-2 changes.

**Fix, in preference order.** A **seventh specimen** — the header band alone, drawn twice (`DASHBOARD` active, `QUEUE` active), at the real 920px column, with the 28 / 6-or-10 / 28 rhythm — plus a one-line marked note on the three existing specimens saying their title→hero sequence predates R42. This is also the only way you get to *see* S1's gap before it is built, which is the argument for the specimen over the note. If you'd rather not reopen a closed design file, the note alone is the floor; silence is not.

---

## 4. Notes

**N1 — the port itself is clean.** I diffed `components.html:262–267` against the shipped rule at draft 92–104 declaration by declaration. Track: `display / background / border / border-radius / padding / gap` — verbatim. Tab: `font-family / font-size / letter-spacing / text-transform / background / border / color / padding / border-radius / cursor` — verbatim. Active: `background:#1D222A; color:var(--ink)` — verbatim. The `.range` sibling is correctly not ported (§5.8). **No hue is spent** — `#101318`, `var(--line)`, `#1D222A`, `--ink-3`, `--ink`, all hueless; R8's budget (violet drafts / hueless contacts / amber needs-you) is untouched, and the switch's only colour is the shared `:focus-visible` ring, which round 4 already ruled is a reference-level convention and not a hue spend. `cursor:pointer` on an anchor is a no-op carried verbatim; leave it, it is in the "verbatim" column and removing it would make the diff dirtier than keeping it.

**N2 — the hover is right, for a better reason than the one given.** Line 113 rejects `--ink-2` as "three states for two". The stronger argument is conventional: **every hover in `components.css` lands on `--ink`** — `.btn:hover` (387), `.app-side .btn.ghost:hover` (107), `.fl-biz:hover` (329), and `base.css`'s `a:hover` (29). The single `--ink-2` hover in the app is `legacy.css:49`'s `button.secondary`, which is the layer with an expiry date. Say that instead. The specificity analysis behind the rule is correct and I verified it: `.segmented a` and `a:hover` are both `(0,1,1)`, `components.css` loads after `base.css`, so without the explicit rule the hover really is dead. `.segmented a:hover` at `(0,2,1)` beats both, and `.segmented a.on` ties it and wins on order — so the active tab does not change on hover, which is right.

**N3 — `redirects()` really does precede the proxy in Next 16.** I checked, rather than trusting the claim. `node_modules/next/dist/server/lib/router-utils/resolve-routes.js:51–75` builds the pipeline in this order: `middleware_next_data` → `fsChecker.headers` → **`fsChecker.redirects`** → **`middleware`** → `rewrites.beforeFiles` → `middleware` → `rewrites.afterFiles`. Config redirects are evaluated two steps before the proxy runs. The draft's claim at line 208, and Task 4 step 5 item 7's private-window check for `?from=/freelance/queue`, are both sound. Version confirmed 16.2.10.

**N4 — the focus ring: arithmetic verified, plus one thing the draft missed.** Line 121's geometry is right — the tab's border box sits 4px inside the track (1px border + 3px padding), `outline-offset:3px` puts the ring's inner edge 1px inside the track and its 2px outer edge ~1px beyond it, overlapping the neighbour by ~2px; outlines do not reflow and nothing sets `overflow:hidden`. What the draft does not say: `base.css:31`'s `:focus-visible` also sets **`border-radius:3px`**, which would square the tab's corners while focused — except `:focus-visible` is `(0,1,0)` and `.segmented a` is `(0,1,1)`, so the 6px radius survives. Worth one clause in the CSS comment, because it is exactly the kind of thing a later `border-radius` tidy would break.

**N5 — the switch's first label starts 16px right of the title's first letter** (1px border + 3px track padding + 12px tab padding). That is the reference's own construction and it is correct — but it is visible under a left-aligned title, and it is the sort of thing someone "fixes" later by zeroing the first tab's left padding, which would break the track. One line in the comment: *"the first label sits 16px in from the track's left edge; the track's edge, not the label, is what aligns with the title."*

**N6 — the header is not sticky.** On the Queue view with a full list, the switch scrolls away and there is no way back to the Dashboard except the rail. Consistent with carry-forward (2) (the rail is not sticky either), so not A-2's to fix — but it is the first time the app has an *in-page* navigation control that can leave the screen, and it belongs in carry-forward (2)'s sentence.

**N7 — a right-aligned control beside the title, later.** The header is `h1` (block) + `nav` (inline-flex in an anonymous block). When a title-level control eventually arrives, the pattern already exists: `.fl-headrow{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end}` (`components.css:316`). One line in the `.fl-head` comment so the next person does not invent a second one.

**N8 — the tabs do not wrap.** `.segmented` is a flex container with no `flex-wrap`; below ~200px of available width the tabs overflow rather than stack. Desktop-first (§7.1), and S18's phone pass starts at `.app-body` anyway. Recorded only.

**N9 — `/settings` and `/login`.** Correct that neither changes. `/login`'s `<h1>{APP_NAME}</h1>` stays the document's only `h1` there and is outside the route group; the `?from=` validation (`login/page.tsx:19`, `startsWith("/")`) already accepts `/freelance/queue`, so the one-string change is genuinely one string.

**N10 — the brief's "Task 4" is Task 3.** Flagging so the record is straight.

---

## 5. The six questions

**1. The port.** Byte-faithful where it claims to be — I checked all eighteen declarations against `components.html:262–267` and found no drift (N1). It spends **no hue**; R8 is intact. Labels render exactly as the system renders segmented labels: DOM text sentence-case (`Dashboard`, `Queue`, matching the reference's own `<button>Subscription</button>`), uppercased by CSS, JetBrains Mono 9.5px at `0.13em` — `DESIGN-INSPO §5.3`'s "Both: mono, uppercase, ~0.13em, 9.5px" and its "Controls are labelled in the machine's voice" verbatim. **The active treatment is correct and must not be unified with `.navitem.is-active`.** The rail's active item takes a raised fill `#171B21` **plus** an inset hairline, because it stands alone on the rail's flat ground and needs its own edge; the switch's active tab takes a raised fill `#1D222A` and **no** hairline, because it sits inside a track that already has a `--line` border. Making them match would either give the switch a redundant second edge inside a bordered track, or take the rail's edge away and leave a fill floating on `#0B0D11`. The reference is not "internally inconsistent" here (draft line 88 half-concedes that about the `.is-active` / `.on` naming, which is fair) — the two treatments are different because their containers are. The three additions are two (S2), and both are the minimum: the hover is *required* by a specificity tie, the line-height by determinism. The one thing the port gets wrong is context, not values — the recess is defined against `--sunk` and lands on `--void` (S4).

**2. Placement and rhythm.** 28px above the title is right and unchanged — the title does not move, which is worth as much as any number here. **10px under it is the one number I would change** (S1): it reads as ~19.6px optical against 28px below, a 1.43 ratio, where the system's own bound pair (eyebrow→heading) is ~9px optical and its content gap ~29px. 19.6 is the midpoint, and `DESIGN-INSPO §5.3`'s rule is "**directly** under the heading it modifies." `--sp-2` (6px) → ~15.6px, ratio 1.79, is the one-token fix. The **10px Dashboard/Queue difference is acceptable** and I would not spend anything on it: it falls on the *legacy* view, not on the landing page the user sees most, and the draft's own escape hatch (open question 3) is correctly refused — a `components.css` rule reaching into a legacy page's internals is the third namespace that file exists to refuse. One correction to the reasoning at line 146: bottom padding on `.fl-head` would add to both views equally, so it changes the *gap* but not the *difference*; "the smallest achievable difference … is reached with `padding-bottom:0`" is false — the difference is 10px at any value. `.fl>:first-child{margin-top:0}` is a **clean rule, not a smell** — it is a column-top-edge normalisation with a bounded surface (two authored `.fl` elements), it makes §3.4's number true in every render state including whole-page-down, and it is genuinely the same species as the two shipped `:first-child{border-top:0}` rules. But it belongs at **line 147, beside `.fl` and `.fl-body` in the section-rhythm block**, not at the end of the file, and the comment justifying the end-of-file placement is factually wrong (M1).

**3. The two stacked control rows.** Yes, it will read as two tab rows — 38px apart, same left edge, same 9.5px mono caps, both bearing a selection. It is nevertheless **acceptable for now**, and for a better reason than "nothing can be done": the reference's own grammar already separates them — recessed track = "switches what you're looking at", no track = "switches the window you're looking through" — and a status filter genuinely is the second. What is broken is the *emphasis*, not the *grammar*: §5.3 gives the filter row the loudest active state in the system precisely because it reframes every number, and `legacy.css`'s named cost took that away, so the navigation control now outshouts the reframing control. The draft sees this (Part 4, line 1207) but leaves it in an opinions section that will not be pasted into the spec — move it to §6.2 (S5a). **The S11 rebuild should port `.range`**: `components.html:268–273`, the floating pattern with the solid `--ink` pill and dark text, for the six status filters. That is the reference's own answer to "a filter row under a view switch", it restores the emphasis order in one rule, and it gives `.range` the consumer whose absence is currently the reason not to port it (draft line 115).

**4. The header's semantics.** Links over `role="tablist"` is **right and well argued** — two URLs, deep-linkable, back-buttonable, and one of them is the target of every push the app sends; ARIA's own guidance is that content at a distinct URL is a link, and a `tablist` without roving-tabindex arrow keys would be a worse announcement than a plain nav, not a better one. The plain `<div class="fl-head">` over `<header>` is also right: at that nesting `<header>` maps to `role="banner"`, and the shell has deliberately declined a banner (`(app)/layout.tsx` renders the top bar as a `<div className="topbar">`, and the rail as `<aside>`). **Yes, name the `<nav>` — and name the rail's in the same commit.** R40 declined precisely on the grounds that it was the only one, and A-2 removes that ground; two unnamed navigation landmarks announce as "navigation" and "navigation". `aria-label="Freelance views"` and `aria-label="Main"` are both fine. The `<h1>` **is** the document's only `<h1>` on both views — I verified: `git grep "<h1"` over `src/` returns exactly two hits, `freelance/page.tsx:15` (which Task 3 step 4 removes) and `login/page.tsx:58` (outside the group). So A-2 takes `/freelance/queue` from *no heading of any level* to exactly one, which is a real improvement to carry-forward (4). What it does not fix: the only `<h1>` says "Freelance" on both views, so the view's identity lives entirely in a control and in `aria-current` — and the tab title is `APP_NAME` on every page, which is now the weakest link, because two Freelance views at two URLs are indistinguishable in a tab strip. That argues for pulling carry-forward (4) forward, not for changing A-2.

**5. The five open questions, and the three uncertainties.** **Q1 — yes, name both navs, in this commit** (see Q4 above). **Q2 — agree, no `metadata` in A-2**: a segment-layout title would give both views the same tab title, which is the wrong half of the problem, and the `title.template` half is out of scope. **Q3 — agree, do not reach into the queue page**; the reasoning about the third namespace is exactly right, and §6.2 is the correct home for the cost. **Q4 — keep the rule**, with M1's placement and comment fix; the alternative costs a second Plan C amendment and puts `.fl-fail` 48px under the switch. **Q5 — take all three**; a comment that quotes a default it no longer has is a lie in the file, and the whole point of §9's grep expecting *exactly three lines* is that prose does not get to be the exception. — On the three uncertainties: **the `inline-flex` strut does not leak, and I derived it independently.** An `inline-flex` box's baseline is the baseline of its first flex item; the anchor's baseline sits ~10.1px into its 13.3px line box, +6px padding, +3px track padding, +1px border = **~20.1px above the baseline**, leaving **~13.2px below** it, against `.fl`'s 13px/1.5 strut at ~13.4/6.2. The below-baseline max is the switch's 13.2, not the strut's 6.2, so the line box is exactly `10 + 33.3 = 43.3px` and the header is 107.3px. Vertical margins on an atomic inline do count toward the line box, so `margin-top` works. `display:flex;width:max-content` is genuinely the more *robust* default — it removes the strut and the dependency on both fonts' metrics — but it changes the single most visible line of a port whose stated value is eye-diffability against `components.html`, and `width:max-content` is itself a non-reference declaration needed only to stop a block-level track spanning 920px. **Keep `inline-flex`**, and treat Task 4 step 5 item 13 (measure 43.3px) as a required check rather than a contingency; the fallback is already written down correctly. **`.fl>:first-child` placement: line 147, not end of file** (M1). **`redirects()` before the proxy: verified in Next 16.2.10's own source** (N3) — the draft's claim is correct and the private-window check at Task 4 step 5 item 7 will prove it at runtime.

**6. What the delta forgets.** The **mockup** (S6) — a seventh specimen is worth it, and not only for the record: it is the only way you see S1's gap before it is built. **`p8-mockup.html` is missing from the file map entirely.** **§6.2 should gain three costs, not one** (S5). **§5.3 must pin two line-heights** (M4). **§5.7 is not amended and does not need to be**, but the delta should say so in one line — "the switch takes `base.css`'s global ring and declares no transition; §5.7 is unchanged" — so the reader knows focus, selection and motion were considered rather than skipped. `:focus-visible` on the links: present via the global rule, geometry verified, plus the radius-specificity point at N4. **Reduced motion: correctly nothing to suppress** — there is no transition on the switch and view changes are navigations. **The switch and the title share a left edge exactly** (both children of the same `.fl`), and the four-column arithmetic at draft 152–161 is right — I checked both branches, above and below `A = 976`. What no one has aligned is the *label*, which starts 16px in (N5) — deliberate, and worth saying so. **Settings: correct, no header change** — but that is now a named asymmetry, not a non-event (S5b). **The login redirect landing on `/freelance` is fine** and the `?from=` validation already accepts the new path (N9). The two things the *keyboard* would notice that are not in the plan: the duplicate `aria-current="page"` (M2), and that the switch is now the first two tab-stops after the rail on every Freelance page — which is correct ordering, and worth one item in Task 4 step 5 confirming the tab order is rail → switch → content, not rail → content → switch.
