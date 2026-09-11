# P10 round 2 — Design Critic

**Date:** 2026-09-11 · **Role:** judge the ten papers against the content deck, the design doc, the shipped system and the P8 rulings. Rank the conflicts, recommend a ruling on each, answer the lead's thirteen questions.
**Standing question:** what would a senior designer reject?
**Sources:** `brief.md`; the content deck `2026-09-10-p10-personal-page-content.md` (*deck §n*); the design doc `2026-09-10-p10-personal-page-design.md`; `round2-questions.md`; the five round-1 papers and the five round-2 responses; P8 visual spec `2026-09-07-p8-freelance-page-visual-design.md` §5–§7 (*visual spec §n*); `DESIGN-INSPO.md`; `docs/design/components.html`; `src/styles/tokens.css`, `base.css`, `components.css`, `legacy.css`; `p8-team/round3-lead-rulings.md` and `round4-lead-rulings.md` (R1–R46); `p8-team/round2-design-critic.md` as the format exemplar; `ARCHITECTURE.md` §7; `CLAUDE.md`.
**Checked at HEAD `e17c23b`.** `src/` is unchanged since `3fa055e`, so every code claim below was read against the same source the papers were. Contrast ratios are computed from the shipped hexes by the WCAG 2.x formula and are reproducible.

---

## 1. Verdict

The five papers converged further and faster than P8's four, and most of it is right: the tile is the only card level, container queries at both levels, `collapseRow` on the server, one fifth stylesheet with the shared controls promoted, no `—` for a day nobody read, no dashed cell in normal view, ink not boxes for the due meta, reuse `Couldn't save.` rather than invent strings. That is a settled foundation. What is genuinely contested is smaller than thirteen questions suggests and it is almost entirely about **one state: the blank week Riku actually has today.** Three convergences fail on that render, together. **The hero's mark, once the accent was banked, is a 1.06:1 change in ground brightness plus an inset hairline drawn in the colour of the border it sits inside — so on deck §12 there is no hero, no focal point and no colour, and the rail is the brightest thing on the screen.** **The five group labels that are the blank page's only structure are specified at `--ink-4`, which is 1.75:1 on `--raised` and is the ink this same team reserves for absences.** And **row 3 cannot hold Next 7 days: seven day rows at the shipped row padding measure ≈363px against a 240px weight**, making the week tile the tallest object on the page on day one — and the one fix proposed makes the week's reading order change when Riku resizes the tile, which is the dependency its own author's standing question forbids. Four papers then answered Q1 on a false premise: **the 1-column step is not unreachable, it is reachable today at a 164px content column**, and the brief's specimen list has no 1-column specimen, so the render Riku meets when the push buzzes is the one nobody will draw. Two things I would send back to everybody. The papers measured the 920px twelve-column grid beautifully and almost never measured the **narrowest legal cell they themselves adopted as the floor** — the edit toolbar does not fit in it. And the team is one bare selector (`.tile`) away from putting a border and 15px of padding on the brand logo in the rail of every page in the app.

---

## 2. Ranked conflicts

### C1 — MUST-FIX. The hero's mark is arithmetically invisible, and its two owners swapped positions on the only other mark it has

**Positions.** Q4 is unanimous: bank the accent, mark Today with `#171B21` plus an inset hairline — the `.navitem.is-active` / `.day.today` idiom (System Keeper §6.1; Grid Architect r2 concession 1; the other three back it).

**Evidence.** `components.css:72` and `components.html:489` both carry that recipe. Both objects are, at rest, **unfilled and unbordered** — `.navitem` has no background and no border, `.day` has a `--line-soft` border and no fill — so the active treatment adds a ground *and* a hairline where there was neither, and the hairline is half the signal. A P10 tile is neither: every paper gives it `--raised` plus `1px solid var(--line)`.

```
page ground  --void   #08090B   L = 0.002712
tile ground  --raised #14171C   L = 0.008453     tile vs page ground   1.109 : 1
hero ground           #171B21   L = 0.011905     hero vs other tiles   1.059 : 1
inset hairline: 1px var(--line), drawn 1px inside a border already 1px var(--line)
```

**The hero's entire mark is a 5.9% ground lift — about half the contrast the system already spends to lift an ordinary tile off the page — plus a hairline that cannot be seen because it duplicates the border.** On deck §12 that is all that distinguishes the hero, on a page the same team has ruled carries zero hue.

**And the second mark is in contradiction.** Round 1: Grid Architect §4.2 wanted `--r-card` 10px on all, `--r-feature` 14px on the hero; System Keeper §2 wanted 14px on all six. Round 2 each conceded to the other's *round-1* position — System Keeper "Where I now agree" 2 and revision 1 → 10px on five, 14px on Today; Grid Architect concession 5 and revision 5 → 14px on all six, "no radius difference on the hero." They swapped, neither noticed, both filed it as agreement, and **neither Q4 answer mentions radius** — the hero's only remaining mark.

**Recommendation.** Keep the ruling to bank the hue; §6.1's argument from `DESIGN-INSPO` §3's Never list and §5.14 rule 2 is sound. Then make the mark visible, structurally, with no new token: **keep the `#171B21` ground**; **take the radius split — `--r-card` 10px on five, `--r-feature` 14px on Today** (§3's table is literal, and six feature radii mean no tile is the feature; this is the mark that survives Riku moving the hero to row 3 and shrinking it to span 4, deck §14 item 3); and **drop the inset hairline, lifting the hero's border to `border-color: var(--ink-4)`** instead — not a new value, `.btn:hover` (`components.css:495`) is the shipped precedent, hueless and permanent, and on a bordered object it is the half of the idiom that works. **Specimen 01 shows all four grounds at span 8 and again at span 4** — plain `--raised`; `#171B21` + inset hairline as ruled; this recommendation; and the `--session` eyebrow fallback both papers named — judged against `Nothing scheduled.` / `Nothing due.`, not a full day. R3's pattern.

**If ruled the other way**, say so as a decision and not as a port, because deck §12 then has no focal point: the brightest object in Riku's field of view is the agents block in the rail, and governing idea 3 — the chrome is silent so the data can shout — is inverted on the render the page will spend most of its life in.

---

### C2 — MUST-FIX. Row 3 cannot hold the week tile, and the only fix on the table makes the week's reading order a function of the arrangement

**Positions.** Q5. Grid Architect: `340 / 180 / 240 / 120`, with 240 **conditional** on Next 7 days taking two inner columns at ≥720px of tile width; without them the weight must be 300. System Keeper: record the measured render, never tighten rows to hit a number; his §7 measured ≈285 and he did not answer the two-column proposal in round 2. The other three: "not mine on the numbers."

**Evidence, at the row padding the System Keeper's own ruling 1 protects.** `.fl-stage` is `padding:11px 0` with a 1px `--line-soft` top border (`components.css:344–348`); a 13px line at 1.5 is 19.5px. A day row is `11+19.5+11+1 = 42.5px`; the first, borderless, is 41.5. Seven rows = `41.5 + 6×42.5 = 296.5`. Add eyebrow 14.25, the 20px head→body gap, 30px of tile padding, 2px of border:

```
Next 7 days, blank, one column, span 12   30 + 2 + 14.25 + 20 + 296.5 = 363 px
Next 7 days, blank, two inner columns     30 + 2 + 14.25 + 20 + 169   = 235 px
row 1's weight                                                          340 px
```

**363px is taller than row 1.** On the measured, primary, day-one render the "medium" row is the tallest object on the page and Riku's cadence inverts. The Grid Architect's 318px assumes ~33.5px day rows — about 7px of padding, below the 11px his co-author ruled may never be tightened — so the real number is worse than the one he argued from.

**But the fix has an unpriced cost.** Two inner columns fire on the *tile's* width, so the week is chronological at span 8 (609px) and two-column at span 12 (920px). **The week's reading order becomes a function of the arrangement** — Fri Sat Sun Mon | Tue Wed Thu when wide — which is exactly what the Grid Architect's own rule forbids ("nothing on the page may depend on the arrangement"), and it fires on the *default*, so the page ships reordered. Deck §6 Tile 5 gives the tile one job: "the shape of the week." A week that reorders when you resize it has no shape.

**Recommendation. Reject the two inner columns** — one chronological column at every width. Then 240 is a number no render meets, and the options are **(a)** raise row 3's weight to the measured ≈365 and re-specify the cadence — weights ≈`340 / 180 / 365 / 120`, the blank page reading tall / short / **tall** / short, still uneven and now true; it changes one word in deck §5's table, which is Riku's spec §2.7 language, **so it is a sentence for Riku, not a ruling**, and it is arguably more faithful to him, since his own rule is "the biggest block is the most important" and by area Next 7 days already is — or **(b)** keep 240 as a minimum and state that row 3 renders at ≈365, which is cheaper but leaves in the spec a number no state produces, the defect both papers just found in row 2's 140. I recommend **(a)**, with the cadence sentence going to Riku alongside §3.4's strings.

**If the lead takes two columns anyway:** specimen 02 must draw deck §13's `Wed 21` line inside a 437px inner column (≈429px of items against ≈367px of track — it wraps), and specimen 05 must draw the same tile in one column at six, so the reordering is visible in the mockup rather than discovered later.

---

### C3 — MUST-FIX. The 1-column step is reachable today, at 164px, and the mockup has no specimen for it

**Positions.** Q1. Grid Architect, Frontend Architect, System Keeper, Honesty Critic: defer, specify the stack, leave it "unreachable until the phone pass." Interaction Designer: ship one media query now, or the spec must void every one-handed claim in his paper.

**Evidence.** The lead's question says "specified but unreachable," and four papers adopted the wording. **It is false, and both the Grid Architect (§8.3) and the Interaction Designer (§10) supply the numbers without drawing the conclusion.** `.app-body{grid-template-columns:var(--rail-w) minmax(0,1fr)}`, `--rail-w:170px`, and no `@media` in `src/styles` outside `base.css:35`. At a 390px viewport the content column is `390 − 170 − 56 = 164px`; under the container thresholds everyone adopted (6 columns at a ≥706px grid, 12 at ≥820px) a 164px grid is below both, so **the 1-column stack renders.** It is the state every phone gets today, and it is the deck's primary journey (§1: "phone buzzes at 07:00 … the page is where Riku goes after that").

Brief §6 lists seven specimens and none of them is the 1-column stack.

**Recommendation — this half is a ruling.** Strike "unreachable" everywhere. The spec says: *below a 706px grid the page renders as a 1-column stack; with the rail at 170px that is a 164px content column at a 390px viewport, and the page is not usable at that width until the shell has a phone form.* Add **specimen 08: the 1-column stack at 164px**, drawn honestly, so the cost is visible when the lead publishes the mockup.

**The other half is Riku's. The plainest framing I can give the lead to put to him:**

> The menu on the left is a fixed strip 170 pixels wide on every screen, phone included. On a phone that leaves about 164 pixels for the page — roughly a third of the screen — so Personal would be squeezed into a narrow ribbon beside a menu you are not using.
>
> **Option A — fix the menu now.** On a narrow screen the menu becomes a thin bar across the top and the page gets the whole width. It is a small change and it makes the morning work: push buzzes, you open the page, you read your day and tick things off with one thumb. The cost is that the agents panel — the coloured worker badges — has nowhere to sit on a phone and would move to Settings or be hidden there.
>
> **Option B — leave it.** Personal is a laptop page for now. On a phone you read the push notification itself and open the page at a desk. The phone layout gets designed properly in its own round later. The cost is that the reason this page exists — *phone buzzes at 07:00, this is where you go next* — does not work yet.

Take A if Riku wants that morning journey, B if he is content to read the push and open the page at a desk. Either is buildable; only the pretence that the stack is unreachable is not.

---

### C4 — MUST-FIX. The blank page's only structure is drawn at 1.75:1, in the ink this team reserves for absences

**Positions.** System Keeper §3 rules group labels — `SCHEDULED`, `DUE`, `PERSONAL`, `FREELANCE`, `ACADEMICS` — at `.fl-thead`'s step: mono 500 · 9px · `0.14em` · **`--ink-4`**. Uncontested. Separately, Honesty Critic §3.2 point 4 insists `nothing open` is `--ink-3` and never `--ink-4` because "`--ink-4` is reserved" (`components.css:357`). Neither noticed they are describing the same three lines of the same tile.

**Evidence.**

```
--ink-4 #3A424C on --raised #14171C   = 1.75 : 1
--ink-4 #3A424C on #171B21 (the hero) = 1.65 : 1
--ink-3 #5B6470 on --raised           = 2.99 : 1
```

The Interaction Designer computed this ratio himself (r2) to win the off-layer-name argument, then did not apply it to the five labels carrying the blank page's whole skeleton. On deck §12 the To-do tile is `TO-DO` / `0 open` / three section names / three `nothing open`s — and the three names, the "frame, not content" the Honesty Critic's §3.2 argument rests on, render at 1.75:1 in 9px mono at 0.14em tracking. `SCHEDULED` and `DUE` in the hero are 1.65:1. `.fl-thead`'s `--ink-4` is legitimate on `/freelance` because it labels **populated columns** — meta above `--ink` names and `--ink-2` figures. Here there is no data under the label.

**Recommendation.** Group labels take `.fl-thead`'s **type step** at **`--ink-3`**. The collision the System Keeper stepped down to avoid — `TO-DO` (9.5px, `0.18em`) ten pixels above `PERSONAL` — is then carried by tracking, size and **position**: the eyebrow is in the tile head, the group labels are in the body under a 20px gap, and `.fl-group`'s 28px separation (`components.css:407`, reasoned at `:383`) already does what `:383` says it does. `--ink-4` stays where `:357` reserves it — absences, `.fl-bound`, `.fl-absent` — which is the distinction the Honesty Critic's entire paper depends on. One scoped override survives unchanged: `.pe-grp + .fl-empty{margin-top:var(--sp-3)}`.

**If ruled the other way**, judge specimen 01 at 100% on a real panel before accepting it: at ambient brightness 1.75:1 on 9px mono is not a quiet label, it is an absent one, and the tile then reads as three sentences floating in a box — the failure §3.2 was written to prevent.

---

### C5 — MUST-FIX. `No push this morning.` fires in red every day between midnight and 07:00

**Positions.** Honesty Critic §3.4: the sentence is kind 6, `--missing` red, "the only red that can appear on a completely blank week." System Keeper r2 half-agrees (only if the tile can tell a missing send from a missing record). Frontend Architect Q8: spend the read. Nobody applies a clock.

**Evidence.** The tile's test is `dayKey(sentAt) === todayKey(now)` and the cron is `0 23 * * *` UTC (`vercel.json`) = 07:00 Manila. **So for the seven hours between 00:00 and 07:00 Manila, every day, there is no push for today and the tile is in state 2.** Rule that red and the page's one credible alarm is a false alarm on a schedule — the mechanism the Honesty Critic invokes against it three paragraphs earlier, and what R57 ruled on.

**Recommendation.** Gate the alarm on time, not only on absence. `No push this morning.` takes the `--missing` dot **only when `now` is past the expected send time in `APP_TZ`**; before that the tile shows the same content with no dot and needs no new string, because the deck's sentence is still true at 00:30 — it is only the alarm that would lie. The app owns this shape already: `AGENT_STALE_HOURS = 30` is `everyHours + graceHours`, exported once from `watchdog.ts:186` precisely so two files cannot drift on what "late" means. Use that provenance, not a second literal. This also halves the pressure on C16's extra read, since both states that need separating are after 07:00.

---

### C6 — MUST-FIX. The edit toolbar does not fit the narrowest legal cell, which the same papers adopted as the floor

**Positions.** System Keeper §5.4 puts the toolbar in the tile's foot: "four arrows at 24 + three 4px gaps = 108px against 109.7px of inner width — it fits by 1.7px." The Interaction Designer concedes his full-bleed strip on those numbers; the Grid Architect agrees. **All three computed span 2 of *twelve* columns on a *920px* grid.** The System Keeper also wrote the rider that kills it: `collapseRow` "can push *any* tile to 1 of 6, so the legibility specimen must be built at the bottom of the six-column band (~106px), not at 141.67px."

**Evidence.** At the adopted threshold (grid ≥706px) 1 of 6 is `(706 − 70)/6 = 106px`. The Grid Architect's narrow band drops tile padding to 12px below 200px of tile width, so inner width is `106 − 2 − 24 = 80px`. The arrow group needs `4×24 + 3×4 = 108px`. **It overflows by 28px, and `.tile` carries `overflow:hidden`, so `↓` is clipped — invisible and unreachable by pointer at the narrowest cell edit mode itself can produce.**

**Recommendation.** The toolbar degrades before it clips: **the arrows wrap 2×2 below ~120px of inner width** (`flex-wrap:wrap` is already declared; the group becomes 52px wide and three lines tall, and rows are minimums). The alternative — 20px buttons in the narrow band — changes `components.html:483`'s ported values and must be named as a deviation. Do **not** answer it by making edit mode 12-column-only: deck §8 promises the mode on the page, and a mode that silently disappears at a width is a worse lie than a cramped toolbar. Specimen 04 includes one tile at 1 of 6 on a 706px grid with its toolbar, not only the span-8 and span-3 cases drawn so far.

---

### C7 — MUST-FIX. A bare `.tile` rule puts a border and 15px of padding on the brand logo, on every page

**Positions.** Both the Grid Architect and the System Keeper wrote `.tile` in round 1 and both moved to `pe-` in round 2 (revision 10; concession "`pe-`, one prefix"). **Frontend Architect r2 concession 3 moved the other way** — "The namespace is the Keeper's — `pg-`, `tl-`, `.tile`; `pe-` dropped" — and revision 13 lists `personal.css` as `.pgw, .pg, .pg-cell, .pg-tilewrap, .pg-gap, .tile, .tl-*`. He conceded to a namespace the Keeper had abandoned in the same round: the second inverted concession this round (C1 is the first).

**Evidence, and this one breaks the build.** `components.css:51` — `.app-brand .tile{width:24px;height:24px;border-radius:7px;flex:none;display:grid;place-items:center;background:linear-gradient(...)}`. It declares **no `padding` and no `border`.** A later bare `.tile{background:var(--raised);border:1px solid var(--line);padding:15px 16px;…}` at (0,1,0) loses the properties `.app-brand .tile` declares and **wins the ones it does not** — so the 24px brand tile in the rail gains a `--line` border and 15px/16px of padding, with `box-sizing:border-box` crushing the 14px sunburst glyph. On every page, `/freelance` included.

**Recommendation.** **One prefix, `pe-`, and no bare element-shaped class names in `personal.css`**: `.pe-grid`, `.pe-cell`, `.pe-tile`, `.pe-head`, `.pe-grp`, `.pe-form`, `.pe-bar`, `.pe-gap`. Three of four papers are already there. Take the Frontend Architect's *file* (a fifth stylesheet, imported fourth, before `legacy.css`) and the System Keeper's *split* (six shared controls into `components.css`, because the Settings layer picker ships this same phase on another page), and amend `components.css`'s "Two namespaces and no third" header line in the same commit. Q6 is otherwise correct and unanimous.

---

### C8 — SHOULD-FIX. `—` for a measured-empty day inverts the reference rule both papers cite, and nobody recorded the deviation

**Positions.** Q9 is unanimous after round 2: `—` only when every source that fills the day answered; otherwise blank ground under the reason sentence; both feeds down, the day rows are omitted.

**Evidence — the residue neither cleared.** `DESIGN-INSPO` §5.14 rule 3: *"Em-dash, never zero. A zero is a measurement (you used nothing). **An em-dash means nothing was measured.** Confusing the two in a dashboard is a correctness bug, not a style choice."* `components.css:406` ships it as `.fl-trow .dash{color:var(--ink-4)}` — the absence ink. The deck uses `—` for the opposite fact: a day that **was** read and held nothing (deck §6 Tile 5). Q9 fixes the *unread* case and leaves the *read-and-empty* case pointing the wrong way — and that case is not a corner: **seven of them are the largest single piece of structure on the blank page**, and the System Keeper's §9 calls them "the page's strongest asset when blank, because they are structure that is *true*."

**Recommendation.** Keep the deck's `—`: it is Riku's string and it reads correctly in plain English. But **record it as a deliberate page-scoped deviation from §5.14 rule 3** in the visual spec, with the guard: *on this page `—` means a day that was read and held nothing; the unread case never prints it (Q9), and the tile-level sentence plus blank ground is what keeps the two apart.* Without the note the next reader either "fixes" the seven dashes into blanks or reads §5.14 rule 3 as no longer binding for Academics. And because `—` here is a **measurement**, do not carry `.fl-trow .dash`'s `--ink-4` over unexamined — that is the absence register and this mark is now its opposite. Put it at `--ink-3` with the other measured emptinesses, or say why not.

---

### C9 — SHOULD-FIX. The Q9 ruling edits a render inside the content deck, which makes it Riku's, not the lead's

**Evidence.** Deck §11 draws the two-feeds-down page and it contains, verbatim, `NEXT 7 DAYS / Couldn't load layers, so the calendar wasn't read. / Couldn't load to-dos. / Fri 11 — … Thu 17 —`. The unanimous Q9 answer deletes those seven rows. That is not a visual decision about an unspecified state; it is a change to a render the deck publishes, in the document the brief calls the authority on "every tile, string and state."

**Recommendation.** Take the ruling — it is right, and the Honesty Critic's §3.5 is the best-argued finding in the ten papers — but route it as **content**, in the same pass as §3.4's strings, phrased plainly: *"when both the calendar and the to-do list fail to load, this tile shows only the two sentences and no day rows, because a dash means we looked and the day was free."* Deck §11 is the one place Riku can see what a bad day looks like, and it is the render he will be shown.

---

### C10 — SHOULD-FIX. `collapseRow` is right; its bug statement is incomplete and its editor clause is wrong

**Positions.** Q2 is unanimous on `collapseRow(spans)` — server-side, `ceil` first, then decrement the widest entry (ties at the last index) until ≤6. The Frontend Architect withdrew `collapseSpan` and his `Math.max(2,…)` floor. Good ruling; three corrections.

**(a) The overflow condition is stated too narrowly.** Grid Architect §8.1: *"exceeds 6 whenever the row is **full** and contains an odd span."* The true condition is `Σ ceil(sᵢ/2) > 6`, i.e. `Σsᵢ + #odd > 12`, which **non-full rows also satisfy**: `[3,3,5]` sums to 11, is legal under `validateLayout` as ratified, and collapses to `2+2+3 = 7`. Every example in his table sums to exactly 12. `layout.test.ts` will be written from the characterization, so **the test set must include a non-full overflowing row.**

**(b) The greedy trim makes equal tiles unequal.** `[3,3,3,3] → [2,2,2,2] → [2,2,2,1] → [2,2,1,1]`: four identical tiles at twelve columns become two at 226px and two at 106px at six, the *rightmost* pair shrinking. Acceptable — round-down contradicts the deck's explicit "rounded up" — but **specimen 05 must include `[3,3,3,3]`** so the lead sees it before the spec fixes it.

**(c) The editor must not import it.** Frontend Architect Q2: *"The editor imports it too, to disable `+`."* A leftover from the Grid Architect's round-1 framing, now unnecessary and harmful: `collapseRow` never refuses anything, so there is no six-column reason to dim a `+` at twelve, and the Interaction Designer is right that such a `+` declines the move its own caption promises. **`+` is disabled by the twelve-column sum and nothing else; `collapseRow` is pure, render-time, one caller.**

---

### C11 — SHOULD-FIX. After a tick the page disagrees with itself for seconds, and nothing says so

**Positions.** The Interaction Designer withdrew his page-level `Set` of hidden ids for the Frontend Architect's row-island cut and named the cost himself: *"for one refresh the row is gone from one tile and still showing in the other."* He also ruled, in §3.1, **"Busy: None, deliberately."**

**Evidence.** An overdue to-do appears in Today's `DUE` group *and* in the To-do tile at once (deck §6 Tiles 1–2; deck §13 shows exactly that with `Send invoice`). Ticking it hides it in one island; the twin is a server-rendered sibling that cannot know. Reconciliation is `router.refresh()`, which re-runs the route — ≤3 parallel `listEvents` under `GOOGLE_TIMEOUT_MS = 5000` plus the Mongo reads. So on a slow morning one to-do reads as both done and open, in two tiles, for seconds, with **no busy state anywhere** by ruling — on the most-pressed control on the page, on the device the page exists for.

**Recommendation — the fix is already in the room, unconnected.** `LayoutEditor` is a client component wrapping the whole grid and receiving the six tiles as `ReactNode` props (Frontend Architect §6). A client component can render a context provider around server-rendered children, and client islands nested *inside* those children consume it at runtime. So: `LayoutEditor` (or a thin `PersonalClient` around it, if the lead would rather not widen the editor) provides one page-level `Set<string>` of hidden to-do ids; every `TodoRow` reads it and filters itself; the set only grows during the page's life and shrinks by one on a definite failure — the Interaction Designer's original monotone design, which cannot flicker under concurrency and needs no `useEffect`, so the lint baseline holds. The Frontend Architect's objection was about *where state lives*, not about whether the twins must agree; the component that already owns page-level client state answers both. Keep the idempotent write (`setDone(id,true)` guarded, already-done is not an error) — this supplements it.

---

### C12 — SHOULD-FIX. `<Suspense>` contradicts the design doc's one-window calendar read, and nobody resolved it

**Positions.** Interaction Designer §7 proposes `<Suspense>` on the two calendar tiles so a rail click is not a five-second dead tap; r2 downgrades it to a fallback past about a second. System Keeper concedes it with a rider (border, ground, eyebrow, **no sentence, no count, no stamp**). Frontend Architect r2: "right but not a one-liner: it must wrap the tile on the *server*."

**Evidence of the conflict.** The design doc is explicit: *"The page reads today and the 7-day window in **one** call … so a slow Google costs one round of calls, not two."* The Frontend Architect's §15 read plan honours it by doing `readCalendarWindow` in the **page** and passing view models down — at which point the page awaits everything before rendering and **nothing suspends**. To get a boundary the await must move into the tile, and two tiles awaiting independently is two windows, which the doc forbids.

**Recommendation.** One promise, two boundaries: the page creates the `readCalendarWindow(...)` promise **without awaiting it**, passes the same promise to both calendar tiles, and each awaits it inside its own `<Suspense>`. One round of Google calls, two independently streaming tiles, no second source of truth. Write it down — "wrap the tile on the server" does not imply it and the obvious implementation is two reads. Keep the System Keeper's fallback rider verbatim: an unanswered read is not a measured emptiness and must not print `Nothing scheduled.`, `0 open` or `sent 07:00`.

---

### C13 — SHOULD-FIX. At span 2 a form control sits at its intrinsic minimum, which is a different claim from "ugly"

**Positions.** Q12 split four ways. Interaction Designer: **withdrawn entirely** — no span floor, the form is one column and the row grows, "a span-2 form is ugly, not broken." Grid Architect and Frontend Architect: no floor. Honesty Critic: supports disabling `−` at span 4. System Keeper: leave the arrangement whole, put the floor on the **control** — below ~180px of tile width the `+ Event` / `+ To-do` pill is disabled with its reason.

**Evidence.** Span 2 is 141.67px; less 2px of border and the narrow band's 24px of padding leaves **~116px of content, and ~80px at 1 of 6 on a 706px grid**. Into that go a `Title` field, a `Section`/`Calendar` select and a native `Date` field, all at `width:100%`. A native `<input type="date">` renders `dd/mm/yyyy` plus a picker indicator; at 13px the text alone is ~68px and the indicator ~18px, so around 96px of content box the field is at its intrinsic minimum and **clips rather than reflows — there is no narrower form of it.** The three "no floor" positions all rest on the premise that the result is merely poor, and nobody measured it.

**Recommendation.** Take the **System Keeper's control floor**, for three reasons that are one mechanism: it refuses **before the fact**, which is deck §8's own rule for the twelve-column ceiling generalised; it takes **no arrangement away**, which is what the other three were protecting in D7; and it is the **same treatment** the Honesty Critic (§3.1c) and the Interaction Designer (r2) already agreed for `+ Event` when Google is not connected — one mechanism, three causes, nothing invented. Two conditions: the ~180px threshold is **measured in the mockup against the native date field**, not asserted; and the reason needs a short sentence Riku has not written (§3.4 row 15). Specimen 06 draws the To-do tile at span 2 with the pill disabled beside the same tile at span 4 with the form open.

---

### C14 — SHOULD-FIX. Q7: take the script, and record what it removes

**Positions.** Frontend Architect: either works, `scripts/google-auth.mts` by a nose; the allowlisted callback is acceptable under five conditions. Everyone else: not mine, weak lean to the script.

**Evidence.** The finding is solid and verified: `__Host-session` is `sameSite:"strict"`, `src/proxy.ts` fails closed and 401s any unmatched `/api/` path, and `isPublicPath` allowlists `/api/auth/login` **by exact equality** with nothing else under `/api/auth/`. Google's consent redirect is a cross-site top-level navigation, so the cookie is withheld and the handler never runs. One correction to the conditions: `/api/cron/` is allowlisted by **`startsWith`, not equality** (`proxy.ts:33`), so the "shipped precedent" cited for exact-equality is the looser form. The condition is better than its precedent — fine — but the spec must not repeat the claim.

**Recommendation: the script.** Four tie-breakers nobody put on the table. It **deletes two of Riku's manual steps and one production redirect URI** — design doc *What needs Riku's hands* item 1 asks him to register `https://riku-os.vercel.app/api/auth/google/callback` and item 2 to run the app on 3001, which `package.json`'s bare `next dev` does not do — and against the standing "surface manual steps" rule fewer steps is a real benefit. `ALLOW_OAUTH_BOOTSTRAP` is a production flag whose only safe value is unset, for a feature used exactly once, whose failure mode is silent. It touches no authorization boundary, so `src/proxy.ts` stays on the files-no-plan-touches list where R20 kept it through all of P8. And the three existing `scripts/*.mts` already sit outside the verification trio's surface, so it adds no test, route or lint exposure. **Record it as a deviation from the design doc** and amend items 1 and 2 in the same change. If the lead prefers the routes, the five conditions are the right five and the `proxy.test.ts` case is not optional.

---

### C15 — SHOULD-FIX. *LastDigest* must store the sliced payload, or it manufactures the failure the tile exists to report

**Evidence.** `LastDigest` is `title` ≤80, `body` ≤320, written with `runValidators:true` (the repo's rule). `buildPushPayload` slices title at 80 and body at 320 (`push.ts:21`, rising from 200 this phase). `composeDigest` returns an **unsliced** `{title, body}`. Store the digest rather than the payload and a 321-character body throws a Mongoose validation error, the write fails, and the tile reports *"a push went out this morning, its text wasn't stored"* — about a push whose text was perfectly storable. Deck §6 Tile 4 is explicit: the tile shows the body "**exactly as sent**."

**Recommendation.** The write takes `buildPushPayload`'s output, not `composeDigest`'s. One line, and it removes a self-inflicted instance of the very state C16's extra read exists to detect. (The Honesty Critic reached the same hazard from the other side and treated it as a risk to report rather than one to remove.)

---

### C16 — SHOULD-FIX. Q8's `AgentRun` read needs a day filter, and the failure is already on screen in the rail

**Positions.** Honesty Critic and Frontend Architect both: the write moves after the `delivery.sent === 0` guard, must not throw, returns `itemsFailed: 1`; spend the read; sentence #4. Correct — I verified every mechanism. Two corrections.

**(a) `fetchLatestRuns` returns the latest run, not today's.** `watchdog.ts:156` — `AgentRun.findOne({agent}).sort({startedAt:-1}).select({agent:1,startedAt:1,ok:1,"counts.itemsFailed":1})`. The Honesty Critic's decision table reads `ok:true` + no record → *"it went out; its text was not recorded"* **with no day qualifier**. Before 07:00 that is yesterday's successful run beside no record for today, so the tile would assert a storage failure every morning — C5's clock bug from the other direction. The rule is `run.ok && dayKey(run.startedAt, APP_TZ) === todayKey(now) && no LastDigest for today`, written with the day keys in it.

**(b) The same-day surface already exists, and it re-prices the read.** `dispatcher` is in `EXPECTATIONS` (`watchdog.ts:40`) and `classifyAgentRun` maps `run.ok && itemsFailed > 0` to `degraded` (`:92`). The rail's agents block reads `fetchLatestRuns` **live at page render**, so on the morning of the failure the rail already shows `DISPATCHER` degraded with its item count 170px to the left of the tile, and tomorrow's watchdog names it in the push with no work. So option (a) is free and already built, and option (b)'s value is not *visibility* — the Frontend Architect's premise — but **the tile's own honesty**: without it `No push this morning.` is false on that one morning. Still worth one indexed `findOne` inside a `Promise.all` already running, but the spec must say what it buys or a later session deletes it as redundant with the rail.

---

### C17 — NOTE. The empty cell — the thing that makes it a bento — closes at six columns

The default is `[8,4] / [3,8] / [12] / [12]`; `collapseRow` gives `[4,2] / [2,4] / [6] / [6]` — **every row full, no hole.** Riku's spec §2.7 names the one empty cell as one of exactly three sources of irregularity, "left blank on purpose, which breaks the last bit of symmetry," and at six columns it is gone by arithmetic. Deck §14 says the cell must "disappear cleanly when tiles stack"; it disappears one step earlier. Not a defect — a fact specimen 05 must state, or a reviewer files the missing hole as a mockup error.

### C18 — NOTE. `Done this week` blank: two papers measured two different tiles, and it is the emptiest object on the page

System Keeper §4.6 reads deck §12's `DONE THIS WEEK   Nothing ticked off yet this week.` as an inline head (~52px of content); Grid Architect §3 measured it stacked (106px). Against a 120px weight that is 43% versus 88% full — and at span 12 the inline form puts eleven words across 34% of an 888px line, at the bottom of the page, as the last thing the eye meets.

**Recommendation:** one grammar, not two forms. The tile head is `auto | minmax(0,1fr)`; the second cell holds **the count when populated** (deck §13: `DONE THIS WEEK   3`) and **the sentence when empty** (deck §12). Both of the deck's own renders fall out of one rule and the System Keeper's question 4 is answered without inventing a second layout. Write down the one asymmetry: this tile's head slot is *adjacent* to the eyebrow, while Today's, To-do's and the push tile's are *flush right*. That is in the deck's ASCII and should be recorded rather than tidied.

### C19 — NOTE. Q10's push sentence has a shipped register nobody cited

`composeDigest` already emits `Off: chaser.` from `input.offAgents` — the push's existing voice for *"this is switched off, by you, and that is not a problem."* That is exactly Q10's case (all layers off; R57 says not a counted problem). Offer it to Riku as the shape for strings 1 and 2; a new sentence pattern for a fact the push already has a pattern for is the drift the `Mixed` rule exists to prevent, one layer up.

### C20 — NOTE. Casing, twice

**(a)** `.btn` is `text-transform:uppercase` (`components.css:488`), so the deck's `Adding…` renders `ADDING…`. Confirm that `text-transform` is presentation and no deck string changes, the way R42 settled it for the view switch.
**(b)** Deck §10 writes `Calendar check unavailable.` (capital, full stop); the design doc writes `calendar check unavailable`; `composeDigest` joins lowercase fragments with `"; "` and `end()` adds the single terminal stop. Capitalised, it reads correctly only when it is the first problem. The deck's strings are law, so this is a question for Riku, not a tidy — one line in §3.4's rules block.

### C21 — NOTE. Citations that will propagate into the spec if left

`.day.today` is `components.html:489` (cited as 490 and 498). The `:has()` "app targets current Chrome" comment is `components.css:316–321` (cited as `:319`, `:321`, `:328`). `--panel` is **not** unconsumed — `.statstrip:332` and `.fl-health.alarm:470` both use it; the System Keeper's §5.8 editing-well argument needs its reason changed, not its conclusion. `.eyebrow` is mono **400** in visual spec §5.3 and mono 500 in `DESIGN-INSPO` §3; the shipped rule sets no weight. `isPublicPath` allowlists `/api/cron/` by prefix, not equality.

---

## 3. What all five agreed on, and got wrong

### 3.1 The blank week, judged

The brief calls this the hardest thing on the list. **The combined answer does not yet achieve it, because round 2 removed the one mechanism for it and replaced it with nothing.** Deck §12 as the ten papers currently specify it:

| Tile | Span | Row weight | Blank content | Fill | Verdict |
|---|---|---|---|---|---|
| Today | 8 | 340 | ≈217px, top-aligned | **64%** | 123px of dead air under `Nothing due.`, and no hero mark (C1) |
| To-do | 4 | 340 | ≈275px | 81% | the strongest blank tile — but its three labels are at 1.75:1 (C4) |
| Layers | 3 | 180 | ≈172px | 96% | fine; three real switches showing real state |
| Push | 8 | 180 | ≈111px | 62% | fine; it quotes a real message with a real stamp |
| Next 7 days | 12 | 240 | **≈363px** | 151% | breaks the row and inverts the cadence (C2) |
| Done this week | 12 | 120 | 52–106px | 43–88% | undecided, and 66% empty across the line (C18) |

**The tile that fails is Today**, for a compound reason no single paper owns. In round 1 the Grid Architect answered it with `.tile-body.is-pair{justify-content:space-between}` — `.stat`'s own `margin-top:auto` move, which is how a 132px card holding `0` reads as composed. In round 2 he **withdrew it entirely** (concession 4), the System Keeper **conceded it in** under a bound (two always-present groups, Today alone), and the Honesty Critic **restricted it to the all-empty state**. Three positions on one mechanism for the one tile that needs it, all filed as agreement. And the withdrawal was argued from a measurement he corrected in the same document — "row 1's blank slack is ~65px, not 115px" — computed against the **blank To-do tile at ≈275px**, not the blank *hero* at ≈217px, which leaves 123px. **The mechanism was withdrawn on a number about a different tile.**

**Recommendation.** Reinstate it with the Honesty Critic's bound, the only one that survives both objections: **`space-between` fires on the hero only, and only when both groups are empty.** With rows under `SCHEDULED` and nothing under `DUE`, top-align — otherwise `Nothing due.` drops to the bottom edge and opens ~100px that reads as content which failed to render, which is his objection and it is right. With both empty the air is enclosed on both sides by two real findings, the bottom edge carries content, and the tile is the same size before and after data arrives (deck §2 constraint 6). That is `.stat`'s move, on `.stat`'s reasoning, in the one state it applies to.

**What actually makes the blank page look finished is not inside the tiles**, and the Grid Architect was right about that in round 1: the grid is airtight (every tile fills its cell, `align-items` stays `stretch`, one 14px gutter everywhere, exactly one hole), the seven day rows are true structure, and three real switches show real state. Four of six tiles are fine. Fix Today's air, Today's mark, row 3's height, the label ink and Done's form and the answer is there. Leave them and §12 reads as a template: six boxes, five grey sentences, one of them overflowing its row, nothing lit, and the brightest thing on screen in the rail.

### 3.2 The hero mark, banked onto a treatment that does not survive the transplant

C1 in one line, because it is the round's most dangerous shared finding and all five share it: the reference's "this is the current one" idiom works on objects that have neither a fill nor a border, and a tile has both. Transplanted, it reduces to a 1.06:1 ground change and a redundant hairline. Every paper cited the idiom; none computed it.

### 3.3 Nobody measured the narrowest legal cell they all adopted as the floor

The System Keeper wrote the rider ("build the legibility specimen at ~106px, not 141.67px"), the Honesty Critic built §10 on the 106px floor, the Grid Architect corrected the Critic's derivation of it — and then **every control was sized against 141.67px**: the toolbar at 108px into 80px (C6), the forms (C13), the layer row, the tick-and-title row. Rule: **no control ships a measurement until it has been measured at 1 of 6 on a 706px grid**, and specimens 04 and 05 are drawn at that width.

### 3.4 Strings the lead must take to Riku

Every state the ten papers found with no deck sentence, once each. **Rows 1–13 are the Honesty Critic's table, checked and carried forward; 14–17 are mine.** The lead proposes, Riku ratifies. All proposals are plain language, sentence case after the first word, a full stop, no exclamation, no "please", no product name.

| # | State with no deck sentence | Where it renders | Proposed |
|---|---|---|---|
| 1 | Every layer switched off — three taps from the shipped default | Today's `SCHEDULED`, atop Next 7 days | `All layers are switched off.` — grey, no dot |
| 2 | The same state in the 07:00 push | push body, for `Today: …` | `Today: no layers switched on.` — **not** a counted problem (R57); consider the shipped `Off: …` shape (C19) |
| 3 | A partial calendar failure in the push (Personal answers, Classes times out) | push body | `Today: <events>. One calendar wasn't read.` |
| 4 | The push went out; its text was not stored | push tile, for `No push this morning.` | `A push went out this morning. Its text wasn't stored.` |
| 5 | The push reached only some devices | push tile | `Sent to 1 of 2 devices.` — or cut `devices` from the model, cheaper |
| 6 | The edit form's `Delete` failed | in the form | `Couldn't delete.` |
| 7 | Busy labels beside the deck's `Adding…` | both forms, the layout save | `Saving…` · `Deleting…` |
| 8 | A done to-do that still holds a calendar entry | the Done this week row | `entry left on Google` — lowercase, the `on calendar` register |
| 9 | Deleting a to-do that is pinned to the calendar | the delete confirmation | `Delete "Renew ID" and its calendar entry?` |
| 10 | A created event landing outside this week, or on a layer now switched off | the tile that opened the form | `Added. It's on Fri 24 Oct, outside this week.` — or restrict `Calendar` to switched-on layers |
| 11 | A stored layer whose Google calendar no longer exists — a 404 that never clears | calendar tiles / Settings | `Classes is no longer on your Google account. Untick it in Settings.` |
| 12 | The arrangement could not be read, so the default is showing | the page header row | `Couldn't load your arrangement, so this is the default.` |
| 13 | A Google read truncated at `maxResults=100` | the affected day | none — follow `nextPageToken`; failing that `Some entries couldn't be listed.` |
| 14 | A write whose outcome is **unknown** — a tick or switch that timed out (Interaction Designer Q11: `Couldn't save.` is a claim we cannot make) | under the row | `Couldn't tell if that saved.` |
| 15 | `+ Event` / `+ To-do` disabled because the tile is too narrow for a form (C13) | on the disabled pill, as its reason | `This tile is too narrow for the form.` |
| 16 | The date heading on a page left open past midnight (Honesty Critic §3.1, unresolved) | Today's heading | none — rule that the page is re-read, or accept and record it |
| 17 | `Saved, but the calendar entry couldn't be moved` — the row's `on calendar` tag now means *on the wrong day* | the To-do row | `entry on the old day` — lowercase, same register as #8 |

**Rules, not strings — same pass, none needs Riku's wording, only his nod:**

- `Nothing scheduled.` is suppressed whenever **any** enabled layer is unread (R51); never printed beside `Couldn't read Classes.`
- Header figures — `0 open`, Done's count, `sent 07:00` — are **omitted** under a failed read, never zeroed. Deck §11's own render already does this: ratify it and write no strings (the Honesty Critic's concession 1).
- `Overdue:` is omitted under a failed to-do read, **and the omission is stated**, so it cannot look like "no overdue to-dos exist."
- A push stored for today outranks `Monitoring is off, so no push goes out.`
- `Connected.` on the Settings card means *a calendar list came back*, not *a token refreshed* — the state between pasting the token and enabling the Calendar API is the first one Riku will hit.
- **Two content-deck changes that go to Riku with the strings:** deck §11's render loses its seven day rows (C9), and deck §5's row-3 weight stops being "medium" (C2).
- **One reference deviation the spec records rather than asks about:** `—` means a day that was read and held nothing, against `DESIGN-INSPO` §5.14 rule 3 (C8).

---

## 4. Per paper — three things a senior designer sends back

### Grid Architect

1. **You withdrew `space-between` on a measurement of the wrong tile** — ≈275px is the blank To-do tile; the hero is ≈217px and leaves 123px of dead air under `Nothing due.` **Fix:** reinstate it, bounded to the hero with both groups empty (§3.1).
2. **Your row-3 case is right and your arithmetic undersells it.** 318px assumes ~7px of row padding, below the 11px your co-author rules may never be tightened; at 11px it is **363px**, taller than row 1. **Fix:** re-derive at the shipped row grammar and let the lead rule on the cadence, not on the two-column workaround.
3. **`repeat(12,minmax(0,1fr))` is the best single correction in the ten papers — and you filed the toolbar beside it unchecked.** You wrote the narrow band and you know the narrowest cell is 106px; 108px of arrows into 80px of inner width is clipped by your own `overflow:hidden`. **Fix:** wrap the arrows 2×2 in the narrow band; draw specimen 04 at 1 of 6.
   *(Also: your `[3,9] / [5,7] / [3,3,3,3]` table is all full rows; `[3,3,5]` sums to 11, is legal, and collapses to 7.)*

### System Keeper

1. **`--ink-4` on five group labels is 1.75:1, and it is the ink you and the Honesty Critic both reserve for absences.** On the blank page those labels are the whole structure and there is no data under them to carry the tile — the only reason `.fl-thead`'s `--ink-4` works on `/freelance`. **Fix:** `--ink-3`, with separation carried by tracking and position and `.fl-group`'s 28px doing what `components.css:383` says it does.
2. **You conceded the radius split in the same round its author conceded it away.** You hold 10px on five and 14px on Today; he holds 14px on all six; neither Q4 answer mentions it. With the accent banked it is the hero's only other mark. **Fix:** hold your position — §3's table is literal and six feature radii mean no tile is the feature.
3. **`#171B21` is a 1.06:1 lift on a tile that already has a border, and the inset hairline you ported is drawn in the colour of the border it sits inside.** **Fix:** keep the ground, drop the inset hairline, lift the hero's border to `--ink-4` (`.btn:hover`'s shipped value), and show all four grounds on specimen 01.
   *(Also: `--panel` "has no consumer today" is false at HEAD — `.statstrip:332`, `.fl-health.alarm:470`. The editing well is still right; its reason changes.)*

### Interaction Designer

1. **You withdrew the page-level hidden set and named the cost without fixing it.** An overdue to-do sits in two tiles, a row island cannot see its twin, reconciliation is a full route refresh through up to three 5-second Google calls, and you ruled ticking has **no busy state**. **Fix:** the set lives in `LayoutEditor`'s context — the client component that already wraps the grid and already owns page-level state. That answers the ownership objection without a second source of truth.
2. **`<Suspense>` as specified cannot coexist with the design doc's single calendar window.** **Fix:** one unawaited promise created in the page, passed to both tiles, awaited inside two boundaries.
3. **Your Q12 withdrawal rests on "ugly, not broken", which nobody measured.** At span 2 the form's content box is ~116px, and ~80px at 1 of 6; a native date field is at its intrinsic minimum around 96px and clips rather than reflows. **Fix:** take the System Keeper's control floor — it is your own "disabled rather than refused after the fact" rule applied to the pill instead of the stepper, and it takes no arrangement away.
   *(Also: the 1.80:1 ratio was your finding. Apply it to the five group labels, not only the off-layer name.)*

### Honesty Critic

1. **Your one red sentence fires every day between midnight and 07:00.** The test is `dayKey(sentAt) === todayKey(now)`; the cron is 07:00 Manila. Seven hours a day, every day, there is no push for today — "a false alarm with a schedule," in your own words three paragraphs above. **Fix:** gate the dot on the expected send time having passed, the way `AGENT_STALE_HOURS` gates the rail's overdue rule. No new string needed.
2. **Your push-tile decision table has no day filter.** `fetchLatestRuns` returns the newest run per agent regardless of date, so `ok:true` + no record for today is also what every morning before 07:00 looks like. **Fix:** `run.ok && dayKey(run.startedAt) === todayKey(now)`, written with the day keys in it.
3. **Deleting deck §11's seven day rows is a content change.** You are right on the substance — it is the best-argued finding in the ten papers — but §11 is a render Riku will be shown. **Fix:** route it to him with the strings table rather than letting the Spec Editor take it.
   *(Also: you held `—` for read-and-empty days while citing §5.14 rule 3 against it for unread ones. That residue needs a recorded deviation, or seven dashes on the blank page mean the opposite of what the reference says a dash means.)*

### Frontend Architect

1. **`.tile` as a bare class name breaks the brand logo on every page.** `.app-brand .tile` declares no `padding` and no `border`, so a bare `.tile` rule wins both and puts a hairline and 15px of padding on the 24px sunburst in the rail. Revision 13 still lists `.tile` and `.tl-*`, and you conceded to a namespace the Keeper abandoned in the same round. **Fix:** one prefix, `pe-`, no bare element-shaped names.
2. **"The editor imports `collapseRow` to disable `+`" undoes what `collapseRow` was adopted for.** The trim always produces a fitting row, so there is no six-column reason to refuse a twelve-column move, and a `+` dark for a width Riku cannot see is a caption that lies. **Fix:** pure, render-time, one caller; `+` disabled by the twelve-column sum alone.
3. **Your Q7 conditions are stricter than the precedent you cite for them** — `/api/cron/` is allowlisted by `startsWith`, not equality. The conditions are right; the precedent sentence is not. **Fix:** take the script (C14), which needs none of the five, and amend *What needs Riku's hands* items 1 and 2 in the same change.
   *(Also: store `buildPushPayload`'s sliced output in *LastDigest*, not `composeDigest`'s, or a 321-character body manufactures the exact "wasn't stored" state your extra read exists to detect.)*

Everything else in the Frontend Architect's two papers — `resolvePersonalLayout` total on read with the P11 clause, the `readOsSettings` shared-array hazard, the derived `ALLOWED_KEYS`, the `CalendarWindow` union with `reason:"none-enabled"` decided before any token fetch, the cached token *promise*, the `DOMException.name === "TimeoutError"` match, the `todos`/`todoStore` purity split, cutting the third `Todo` index, the three read phases with phase 2 skipped when phase 1 failed, the no-`useEffect` rule and its `git grep` verification line — is the strongest engineering in the ten papers and should be adopted as written.

---

## 5. Checklist run

### Deck §14 — the designer's checklist

| Item | Held / broken |
|---|---|
| Looks finished with §12's blank week | **Broken.** 123px of unaddressed air in the hero and no mark on it; row 3 over by 123px; five group labels at 1.75:1; Done's blank form undecided. §3.1 lists the fixes. |
| Does not break with §13's full week | **Held**, except under the two-column week, where `Wed 21` wraps in a 437px inner column. Rejected in C2 for a different reason. |
| Holds for any legal arrangement | **Held, and well** — the container-query spine makes it a property, not a hope. Exception: the two-column week would make reading order a function of the arrangement (C2). |
| "Couldn't read" distinct from an empty day | **Held for tiles** via `.fl-fail`'s shape with the dot at `--stale` — the right synthesis. **Held for days only after Q9**; the em-dash's residual meaning is unrecorded (C8). |
| Row weights survive collapse and read tall/short/medium/short at 12 | **Broken.** Row 3 renders ≈363px against a 340px row 1 (C2). The collapse itself is sound once `collapseRow` lands. |
| Only the hero and real state carry colour; importance is size | **Held on hue, broken on the hero.** Zero hue is honest; a 1.06:1 mark means importance is carried by nothing (C1). |
| The empty cell is intentional at 12 and disappears cleanly when tiles stack | **Held at 12 and at 1.** Unremarked: it also disappears at **6** (C17). |
| Edit mode is obviously a mode | **Held** — foot toolbars, dashed cells, three header pills, the `--panel` well, `inert` bodies. One failure at the narrowest cell (C6). |
| Forms open in place without moving the grid | **Held at the default** (≈321px inside row 1's 340px); below ~280px of tile width the row grows, legal and stated. Broken at span 2 (C13). |
| The product name is replaceable | **Held.** No wordmark anywhere, no product name in any proposed string. |

### Reference §6 — Hold and Avoid

| Item | Held / broken |
|---|---|
| One loud figure per card, one hue per card | **Held to the point of vacancy** — zero loud things on §12, which is honest and leaves the rail as the brightest object on screen (C1). |
| Mono caps for what the system names; sentence case for what addresses the person | **Held.** `.fld-l` sentence case (§6.1), group labels mono caps, `on calendar` lowercase (§5.9), layer names de-capsed via `.tag.is-layer` — the best single piece of System Keeper reasoning this round. |
| Hairlines between rows; borders only around real objects | **Held, unanimously and early.** The tile is the only card level; the form is a `--sunk` well inside it, one card deep (`pre.body` inside `.card`). |
| `tabular-nums` everywhere | **Held** — the §7 inventory is complete and the page is mostly digits. |
| Headings address the operator · estimated numbers say so | **Not applicable, correctly.** The deck fixes every eyebrow and heading (§7.3 gives it precedence), and "no derived numbers anywhere on this page" removes the second category before it exists. |
| Background agents get their own visual class | **Held** — S13 means no agent touches this page. |
| Boxing rows · solid accent buttons · left accent bars · glow on text · a second sidebar · the same sparkline everywhere | **Held by all five, explicitly.** `.btn.go` stays unspent on `Add`; the 5px dot carries the glow and the sentence never does; no graphic anywhere, and the seven-day dot strip on Done this week is pre-emptively refused. |
| A hue used decoratively once it carries a meaning | **Held**, and it is what decided Q4. |
| **Em-dash, never zero** (§5.14 rule 3) | **Broken by all five, in the same direction.** Here `—` means a day that was read and held nothing; the reference says it means nothing was measured. Q9 fixes half; the rest needs a recorded deviation (C8). |

---

## 6. My Q1–Q13 table

One line per question; the reasoning is in the C-item named.

| Q | Recommended ruling |
|---|---|
| **Q1** | **Riku's call, on a corrected premise (C3).** Strike "unreachable": the stack renders today at a 164px content column on any viewport below ~932px. Add **specimen 08**. Put C3's two options to Riku verbatim. |
| **Q2** | **`collapseRow(spans)` — server, pure, render-time, one caller (C10).** Condition is `Σsᵢ + #odd > 12`, so `layout.test.ts` needs a non-full row (`[3,3,5] → 7`). Don't tighten `validateLayout`; don't let the editor import it — `+` is disabled by the twelve-column sum alone. Specimen 05 includes `[3,3,3,3]`. |
| **Q3** | **Adopt at both levels.** Two named containers, `min-width` off a 1-column base, 6 columns at a ≥706px grid and 12 at ≥820px, with `repeat(12,minmax(0,1fr))`. No `@supports` duplication. **Every control is re-measured at 1 of 6 on a 706px grid — 80px of inner width — not at 141.67px (C6, §3.3).** |
| **Q4** | **Bank the hue — yes. `#171B21` + inset hairline alone — no (C1).** Hero = `#171B21` ground **+ `--r-feature` 14px against `--r-card` 10px on the other five + `border-color: var(--ink-4)`**, inset hairline dropped. `--session` on the eyebrow stays the named fallback. Specimen 01 shows all four grounds at span 8 and span 4, judged against `Nothing scheduled.` |
| **Q5** | **Weights are minimums; the spec records the measured render beside them. Reject** two inner columns for Next 7 days (C2). Row 3 rises to ≈365 and the cadence becomes tall / short / tall / short — **one sentence to Riku**, since "medium" is his word. Rows 1, 2, 4 stay 340 / 180 / 120. **Sparse row → `auto`: adopt**, suspended while edit mode is open. |
| **Q6** | **Fifth stylesheet `src/styles/personal.css`, imported fourth. One prefix `pe-`; no bare `.tile` (C7).** Six shared controls into `components.css`; copy `legacy.css`'s `input`/`label` recipe under classes with the source cited; amend the "two namespaces and no third" header line in the same commit. Nothing in `components.css` changes shape for this page. |
| **Q7** | **`scripts/google-auth.mts` (C14).** It needs none of the five conditions, touches no authorization boundary, adds no permanent flag, and removes two of Riku's manual steps and one production redirect URI. Record the design-doc deviation and amend *What needs Riku's hands* 1 and 2. If the routes win, the five conditions and the `proxy.test.ts` case are not optional. |
| **Q8** | **All three halves (C15, C16).** Write after the `delivery.sent === 0` guard, **wrapped so it cannot throw**, returning `itemsFailed: 1` — already `degraded` in the rail the same morning and in tomorrow's push. Store **`buildPushPayload`'s sliced output**. Spend the `AgentRun` read, gated on `run.ok && dayKey(run.startedAt) === todayKey(now)`; take string #4. And **`No push this morning.` takes red only after 07:00 Manila (C5)**, or the one alarm is false seven hours a day. |
| **Q9** | **Adopt**, enforced in the view-model types (`{items}` or `{unread:true}`) so `—` is unreachable for an unread day rather than merely avoided; both feeds down, the rows are omitted and **the tile keeps its weight** — an outage must not shrink the page. Riders: the §11 render edit goes to Riku (C9); the residual `—`/§5.14-rule-3 inversion is recorded as a deliberate deviation (C8). |
| **Q10** | **Adopt.** `.fl-empty`'s register, `--ink-3`, no dot, no hue, naming the Layers tile, decided **before any network call** (`{ok:false, reason:"none-enabled"}`). Not a counted problem in the push (R57), and offer Riku the shipped `Off: …` shape (C19). Strings 1 and 2. |
| **Q11** | **Mostly no new strings.** Reuse `Couldn't save.` for a failed tick, un-tick, edit `Save` and layer switch. Header figures **omitted** under a failed read — deck §11 already does this; ratify it and enforce it as a type (`number \| null`). Add `Couldn't delete.`, `Saving…`, `Deleting…`. Add **one** new sentence for a write whose outcome is unknown (string 14): `Couldn't save.` is a claim we cannot make about a timeout. |
| **Q12** | **The System Keeper's control floor (C13)** — not a span floor and not "the row just grows." The pill is disabled below a threshold **measured in the mockup against the native date field**, with its reason (string 15). Refused before the fact, no arrangement removed, and the same mechanism already agreed for `+ Event` when Google is not connected. Specimen 06 draws span 2 disabled beside span 4 open. |
| **Q13** | **Adopt both, unanimously and correctly.** Due meta is a right-aligned mono 9.5px tabular column differing only in ink (`--ink-3` / `--missing`), no box — `.pwhen.is-stale` is the precedent and a chip would put six red boxes on a bad week. Empty cell bare in normal view, **one** dashed rectangle across the whole leftover in edit mode, at `--r-feature`, not focusable and not a drop target. Specimen 05 notes that at six columns the default leaves no leftover at all (C17). |

---

*If only one thing survives this round:* the team banked the hero's accent onto a mark that is 1.06 to 1, drew the blank page's only structure at 1.75 to 1, and sized every control against a cell twice as wide as the narrowest one it had just adopted — three arithmetic facts, all on the one render Riku actually has today.
