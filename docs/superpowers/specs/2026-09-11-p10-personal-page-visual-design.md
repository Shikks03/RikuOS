# P10 — The Personal page: visual design and build spec

**Date:** 2026-09-11 (the day the design was ruled) · **Written:** 2026-09-25, after five design rounds · **Status:** awaiting Riku's ratification — he has ratified every decision this file records (2026-09-10 the content, 2026-09-24 the five calls, 2026-09-25 the ramp), but he has not read this document. This is the file P10 is planned and executed from.
**Repo:** RikuOS · **Phase:** P10 in `docs/ROADMAP.md`.

**The four companions, and no others.** A builder holding this file plus these four needs nothing else — not the round papers in `docs/superpowers/design/p10-team/`, not the conversation that produced them.

| File | What it is for |
|---|---|
| `docs/superpowers/specs/2026-09-10-p10-personal-page-content.md` | The content deck. **The authority on every string**, including the eleven ratified 2026-09-24 in its `§15`. Where this file quotes a deck string it quotes it exactly; if the two ever differ, the deck wins (R86). |
| `docs/superpowers/specs/2026-09-10-p10-personal-page-design.md` | Why the page is shaped this way — decisions D1–D14, the to-do store, the Google client, the layout store, the failure rules, *What needs Riku's hands*. Corrected 2026-09-25 to every ruling below. |
| `docs/design/DESIGN-INSPO.md` | The design system. Tokens §2, type §3, shell §4, components §5, build checklist §6, decisions §7. |
| `docs/design/p10-mockup.html` | The page drawn in production CSS, sectioned `tokens / base / components / components — P10 additions / personal / mockup-only`. **The first five sections are what the build ports.** Where prose here is ambiguous, the mockup is the truth. |

**What is in the mockup and ships nowhere.** Everything below the `mockup-only` banner: the three face variables `--display` / `--body` / `--mono` (in the app they come from `next/font/google` via the generated class names on the root element, which is why `tokens.css` does not declare them); document chrome (`.doc*`, `.spec-*`, `.tab`, `.lbl`, `.scroll`, `.stack`, `.pair`, `.sheet`); the frames and panes (`.frame`, `.f1240`, `.f932`, `.f390`, `.pane`, `.p920`, `.p706`); the tile holders (`.hold`, `.w920`…`.w106`, `.h340`, `.h404`); the `.ramp` chip strip that draws the nine tint states side by side; the provisional phone shell's CSS (`.phonebar`); and the `:where(.legacy-doc)` copy of `legacy.css` that lets specimen 07 draw the Settings page as it ships. One thing above the banner is also mockup-placement only: the three tint anchors are declared in a page-local `:root` inside the `personal` group **because the mockup's tokens block is a byte-verbatim copy of the shipped file** — in the app they go into `tokens.css` (R80, R84, §5.1).

This file records decisions. It does not re-argue them.

**How supersessions are marked.** The rounds moved three times on the hero's mark and twice on several numbers, and the superseded text is still sitting in the old files. Every place this spec carries a superseded ruling, it names the ruling that killed it and says in one clause what it replaced, in this shape: *~~R52's four-or-more threshold~~ → **R79's nine-step ramp**.* A builder who finds the old ruling in an old paper must be able to tell from here that it is dead. §11 is the whole list in one table.

---

## 1. Scope

### What P10 ships

1. **`/personal`** — six tiles plus one empty cell on a four-row weighted bento, on live Google Calendar data and the app's own to-do store, in every state the deck specifies.
2. **The layout editor** — move, widen, narrow, reset; the arrangement stored on the server; the page correct for **any legal arrangement**, not only the default (deck §2 item 8).
3. **The to-do store** — `Todo`, two indexes, two queries; ticking, adding, editing, deleting; the per-to-do calendar pin (S19).
4. **Google Calendar, read live and written through** — the first new external integration with its own auth since the OS API. Three scopes-worth of work: the calendar list for the Settings picker, the event window for the page, event creation.
5. **Two Settings cards** — `Google Calendar` (the connection) and `Calendar layers` (the picker), deck §9.
6. **The push's Today sentence** — the section P5a-7 dropped for want of a to-do store, plus the *LastDigest* singleton the push tile quotes.
7. **A fifth stylesheet** — `src/styles/personal.css`, namespace `pe-`, imported fourth (R32).
8. **Eight shared controls in `components.css`** — ported once, because the Settings picker ships this phase on another page (R46, §6).
9. **The phone shell, provisional** — below the phone threshold the 170px rail becomes a 44px top strip and the page takes the full width. **App-wide**, so the Freelance page inherits it (R50, S20, §3).

### What P10 does not ship

- **Any new agent.** The Personal side gets none (S13). The one automated thing that touches this page is the morning push.
- **The Academics page, Canvas, the Classes layer being *populated*, the sentence-to-schedule planner, the quest board.** P11 and P9b.
- **Editing or deleting a calendar event from the app.** Event rows link out to Google (D5 / concept D5: Google is the single source of truth).
- **Drag-and-drop layout editing.** Buttons, by D7 — they work on a phone and with a keyboard, need no library, and the stored shape does not change if dragging is added later.
- **Holidays, a month grid, a Next-holiday tile, a Work section.** Offered and declined (D3, D8, D9).
- **A real phone design.** S20's strip is a stopgap; the phone pass replaces it and owes it nothing. Its threshold is still unnamed (§10 item 1).
- **Layer hues.** `DESIGN-INSPO.md` §5.11's layer-colour map is declined for this page (R9), recorded there as a reference-level note so the Academics phase does not read it as binding.
- **Anything with no data behind it.** No placeholder content, no ghost rows, no skeleton, no spinner, no toast, no hover-only affordance, no drag, no retry control, no freshness stamp on the page, no streak, no rate, no derived number, no onboarding, no first-run banner, no dashed box or centred empty state, no interpretive copy, nothing filling the empty cell, and no tile that hides itself. (The Honesty Critic's nine prohibitions, adopted verbatim by R17.)

---

## 2. The decisions this rests on

Recorded as **S19** (the calendar pin) and **S20** (the phone shell) in `ARCHITECTURE.md` §7, on top of S11 (the content discussion of 2026-09-10) and S13 (no new agents). Do not relitigate any of them without a new decision there.

**Riku's content discussion, 2026-09-10** — fourteen questions, D1–D14 in the design doc. The two he added unprompted shaped the page more than any answer: *"I want it to have multiple columns for the content and will be separated by blocks of features"*, and then the full specification of a **loose weighted bento with a personally adjustable layout** (deck §2 item 7, verbatim). **S19** records why the per-to-do calendar pin is a one-directional projection and not the two-copy sync concept D5 forbids.

**Riku's five calls, 2026-09-24**, answered against `docs/design/p10-choices.html`, which drew each open question at the size it really renders:

1. **SHELL → A.** The phone gets the top strip, app-wide and provisional (R50, S20). Four of five team members preferred leaving the shell alone; he chose the change with that disagreement in front of him, in writing.
2. **ROW → A.** A row whose only occupant is one small tile shrinks to fit it — a general rule for every arrangement (R53).
3. **WORDS → approved as written, with one instruction.** All eleven sentences, both document edits and both nods ship (R54). The instruction: *"just make sure to keep the glowing dot beside it to easily visualize how urgent or important it is"* → **the offer to collapse a whole-database outage into one page-level sentence is declined; every failure sentence keeps its 5px dot** (R55).
4. **TILE → two columns, and a new mechanism.** The week keeps two inner columns (R51); *"if there are 2 or more tasks then it should become a collapsible"* opened the day-row disclosure (R51b, R56–R69, R77).
5. **MARK → not one of the four drawn alternatives.** A tinted hero driven by state (R52).

**Riku's ramp, 2026-09-25:** *"rather than pure orange color, make it so that its a gradient, starting from green it goes more red the more tasks there is"* · *"3 is orange and then goes until the most busy at 8"*. This is the second time he moved the hero's mark, and it supersedes R52's two states and its four-or-more threshold (R79). In the same answer he closed R73's one open flag: asked whether any overdue to-do should force the busy end on its own — *"No — it just counts as one."* (R85).

**The lead rulings he let stand** (offered as overturnable, not contested): the hue budget's four ink places (R9); the amber dot as the one marker for a couldn't-read (R10); group labels at `--ink-3` rather than `--ink-4` (R12); `space-between` on the hero only, and only when both groups are empty (R17); `—` meaning a day that was read and held nothing, a recorded deviation from `DESIGN-INSPO.md` §5.14 rule 3 (R19); the seven dash rows deleted from the deck's two-feeds-down render (R18); the push's partial-calendar sentence and the lowercase problem fragments (R23); `Connected.` meaning the calendar list came back, and `No push this morning.` waiting for 07:00 (R54's two nods, now deck §15).

### The costs he accepted with his eyes open

**Three extra hue meanings, and a colour system that now needs a sentence before it makes sense (R79).** R52 already cost `--spend` a second, page-local meaning — a busy day, on one tile. The ramp spends three more:

- **`--missing` (red) acquires a page-local second meaning** — a very full day — on top of "overdue". The page can show a red-washed hero whose every row is on time.
- **`--stale`'s hue is crossed by the ramp** without meaning "a feed did not answer" — **on the green→orange leg, at step 2**, not between orange and red as R79 first said. Amber sits at hue ≈42°, between green's ≈158° and orange's ≈22°; nothing semantic sits between orange and red at all. Step 2's border gamut-maps to `rgba(217,169,0,.2)`, which is effectively `--stale`. *(R79 corrected its own error here; carry the corrected fact.)*
- **`--save` (green) becomes a claim about volume**, not only "healthy".

**What contains it is register, and it is the only thing that does (R84, §5.1).** On the Personal page, hue in a **background wash** means volume; hue in **ink, on a dot, or on a row** means what R9 says. That sentence is now load-bearing for the page's whole colour system, which is why it ships as a rule and not as a note. Riku was shown the composition this produces — an orange hero, an amber dot and a red row on one page — and chose it.

**The asymmetry is his, and it measures 1.8×.** The first three items move the colour 1.8× as far as the next five do — measured, not estimated, as an end-to-end OKLab ΔE of .1110 split .0774 across the first leg and .0422 across the second. *(R79's first draft said "as far as"; the claim was corrected rather than the ramp retuned to make it true.)* A day going from nothing to three things has changed more, to him, than a day going from four to eight.

**Nine amber and red dots on one page when the database is down.** One per failure sentence, one per tile, plus a ninth above the grid for the unreadable arrangement. He was offered one page-level sentence instead and declined (R55).

**The coloured agent badges disappear on a phone** until the phone design round (R50, S20).

**The stepper shows the twelve-column span even at six columns.** A tile that is visibly 1 of 6 reads `3` on its stepper, because twelve-column spans are the only number the editor can change. Accepted with the cost visible (R1, round 4's *Not changed* list); specimen 04's 932px frame is where it first shows.

**Equal tiles stop being equal at six columns.** `collapseRow` rounds up and then trims the widest entry, so `[3,3,3,3]` becomes `[2,2,1,1]` — two tiles that were the same width at twelve are 226px and 106px at six (R1). Drawn in specimen 05 rather than described.

**Native controls render in the OS locale.** A native `<input type="time">` prints `02:00 pm` beside 24-hour rows. A fact about native controls, recorded and not fought (round 4's *Not changed* list).

---

## 3. The shell

The shell is P8's (spec §3): a 170px rail (brand tile, wordmark, nav, `AGENTS` group, `Log out`) and a 44px top bar carrying one freshness stamp. P10 changes it in exactly two ways.

### 3.1 One nav item, first

`NavList.tsx` gains `{ href: "/personal", label: "Personal", Icon: IconPersonal }` **first** (D13) and `icons.tsx` gains the glyph, built to the existing contract: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.8}`, round caps, `aria-hidden="true"`. The rail's prefix/equality matching rules (P8 R44 — `.is-active` by `startsWith`, `aria-current` by equality) apply unchanged. The post-login redirect and the `/` route are not touched. **Both nav items carry a glyph or neither does** — P8's rule, and P10 must not be the page that breaks it.

### 3.2 The phone strip — R50, S20

Below the phone threshold the fixed 170px rail becomes a **44px bar across the top** holding the brand, the three nav items and `Log out`; the page takes the full width. Three things travel with the ruling, all on record:

- **It is a shell change, so it lands on every page**, the Freelance page included. It must not be built as a Personal-page rule.
- **The coloured agent badges are hidden at phone width.** There is nowhere for them to sit in a 44px strip. Stated in the question and accepted.
- **It is provisional.** The later phone pass replaces it and owes this shape nothing.

**The measured fact that produced the answer, and it is the whole argument.** With the rail beside the page, a 390px device leaves a **164px** content column; with the strip, **334px**. The form floor is 213px of tile width (R40, §5.4), so at 164px **both `+ Event` and `+ To-do` are disabled behind `Too narrow for the form.`** — the one journey this page exists for (the push buzzes, open the page, read the day, tick with one thumb, add what came up) did not work. At 334px both forms open, one column. Specimen 08 draws the ruled strip beside the 170px rail it replaces, with identical markup in both frames; at 164px a to-do title gets 110px, **17 characters of `Submit clearance form`** before it is cut.

**R7 is answered, and its sentence stays true in the other direction.** R7 struck "specified but unreachable" from every document and required the one-column stack to be drawn honestly at 390px. It is: below a 706px grid the page is a one-column stack, and the stack is correct at either shell width because it is keyed to the **grid's own width**, never the viewport (R2). Nothing else in P10 depends on the shell's answer.

**The threshold itself is not named anywhere.** S20 and R50 both say "below the phone threshold" without a number, and the mockup draws the strip in a fixed 390px frame rather than through a query (its constraints forbid `@media` beyond reduced-motion). **This is unmeasured, not implied.** §10 item 1 carries it.

---

## 4. The Personal page, tile by tile

Page root: `/personal`, session-guarded, `dynamic = "force-dynamic"`. `<main className="app-content">` → `<div className="fl">` (920px, centred) → the page header (`Personal` as `.fl-title`, display 600 / 24px / `-0.02em`, and the `Edit layout` pill) → `.pe-wrap` → `.pe-grid`.

**Eyebrows and group labels are stored sentence case and uppercased by CSS.** The DOM reads `Today`, `To-do`, `Layers`, `This morning's push` (curly apostrophe), `Next 7 days`, `Done this week`, and `Scheduled` / `Due` / `Personal` / `Freelance` / `Academics`; `.eyebrow` and `.pe-grp` render them `TODAY` … `ACADEMICS`. Same for `.btn` labels (`+ Event`, `+ To-do`, `Edit layout`, `Save`, `Cancel`, `Reset to default`, `Add`, `Delete`, `Keep`). The deck's uppercase spellings are the **rendered** form, which is the reading P8 R42 already established.

**Every tile renders its eyebrow in every state** (R10). A tile reduced to one sentence at 106px still says which tile it is — that is what makes a 106px tile attributable at all.

**Every count is tabular. No count is hued. A header figure is omitted under a failed read, never zeroed** (R21): `0 open`, Done's count and `sent 07:00` are `number | null` / `string | null` in the view model, so `0 open` above `Couldn't load to-dos.` is unrepresentable. Done's count is absent at zero (deck §12) while To-do's reads `0 open` — the two differ on purpose: `0 open` declares the store answered; Done's is a tally.

### 4.1 Tile 1 — Today (the hero)

Eyebrow `Today`, heading the date (`Thu 10 Sep`, `.fl-h`), control `+ Event`. Two groups in order: `SCHEDULED`, then `DUE`.

**`SCHEDULED`** — today's events from every switched-on layer, all-day first then by start time. Row grammar in §5.5. Every event row links out to Google (`.fl-biz`'s anchor with the persistent `↗`, `target="_blank" rel="noopener noreferrer"`); **the row is not the anchor** (P8 R36). States and strings: deck §6 Tile 1 — `Nothing scheduled.` · `Couldn't read Classes.` · `Couldn't read the calendar.` · `Google isn't connected yet. Set it up in Settings.` · `Google access has expired. Renew it from Settings.` · `No calendars chosen. Pick them in Settings.` · `Couldn't load layers, so the calendar wasn't read.` · `All layers are switched off.` (deck §15) · bound 20, then `Showing 20 of 26.`

**`Nothing scheduled.` is suppressed whenever any enabled layer is unread** (P8 R51): the tile cannot claim the day is empty while one calendar did not answer.

**`DUE`** — to-dos due today, then overdue, merged into one list; tick boxes behave exactly as in the To-do tile. Lateness is `3 days late` / `1 day late` in `--missing`, in the due-meta column, and nowhere else. Empty: `Nothing due.` Unreadable: `Couldn't load to-dos.`

**`space-between` fires here and nowhere else, and only when both groups are empty** (R17). `.pe-body.is-pair { flex:1 1 auto; justify-content: space-between }` — with both groups empty the blank hero measures **213.35px** in a 340px row, and 123px of dead air under `Nothing due.` reads as failed content; spread, the air is enclosed by two real findings and the bottom edge carries content, which is `.stat`'s own move on `.stat`'s reasoning. **With rows under `SCHEDULED` and nothing under `DUE` the tile top-aligns** — dropping `Nothing due.` to the bottom edge would open exactly the air the rule exists to close. No other tile spreads: three peers spread across slack read as a list come apart.

#### The hero's mark — the ramp

> **Superseded, twice.** ~~R8's hueless mark (ground `#171B21`, border `--ink-4`, feature radius, no hue)~~ → overruled by **R52** (tinted by the state of the day). ~~R52's two states and its four-or-more threshold~~ and ~~R70–R72's two-recipe machinery~~ → superseded by **R79–R84** (a nine-step ramp). **What survives:** R52's settled half — the hero is tinted by state at all, and R8's hueless mark is dead — plus R8's radius (`--r-feature`) and R8's honest-render principle. R8's four drawn alternatives (a)–(d) are closed, their CSS and markup retired.

**The ramp, stated exactly.** `pending` drives one position on a two-segment ramp:

| pending | 0 | 1 | 2 | **3** | 4 | 5 | 6 | 7 | **8+** |
|---|---|---|---|---|---|---|---|---|---|
| tint | **green** | | | **orange** | | | | | **red** |

Green at 0, orange at 3, red at 8, **clamped at 8** — a day with fourteen things looks like a day with eight. 1 and 2 interpolate green→orange; 4 through 7 interpolate orange→red. **Nine states, no tenth.** The two segments are deliberately unequal (§2).

**What `pending` counts (R73, confirmed by Riku as R85).** `pending = to-dos due today + to-dos overdue`. **Nothing else. Scheduled calendar events never count**, however many there are: his word was *task*, the page's word for a task is a to-do, and an event is never tickable. **An overdue to-do does not force the red end on its own** — it is inside the count like any other item, so one overdue thing with nothing else due is `pending = 1`. Lateness keeps its one escalation, the red ink on its own row. R73's flagged one-line `OR` is **declined by the owner** and the flag is closed.

**`pending` is a free read, not a new query (R70's load-bearing finding).** It is the row count of the `DUE` group the hero already renders. `Nothing due.` renders ⟺ `pending = 0` ⟺ `.pe-t0`. `.pe-fail` renders in the group's place ⟺ the read failed ⟺ no `.pe-tN`.

**The untinted hero now means exactly one thing: the to-do store did not answer** (R83; ~~R72's shared "1–3 pending or unknown" render~~ is narrowed away, because 1, 2 and 3 have tints of their own). `.pe-tile.is-hero` with no `.pe-tN` keeps R8's `#171B21` ground, `--ink-4` border and feature radius, and claims nothing. R72's *reason* survives its rule: an untinted hero asserts nothing, and that is the honest render when the number is unknown.

**The tint answers to the to-do read alone (R74), and under R83 that is load-bearing rather than tidy.** A calendar failure, a `none-enabled`, a vanished layer, a half-read window — none of them touches the tint, because events never counted. Getting it wrong would make the hero say *"I don't know what's pending"* because **Google** did not answer, which is a plain falsehood. Three panes in the mockup are the proof: specimen 03's expired-Google hero, specimen 03's all-layers-off hero and specimen 05's "Did not answer" hero all tint **green**, because their to-do read answered `Nothing due.` The amber dot is what tells them apart from a hero whose calendar answered.

**The tint survives edit mode (R75) and an open form (R78), undimmed, unswapped.** R44 dims *controls*, because controls genuinely stop responding; a tint is not a control and does not stop responding to anything. It is a structural fact about the tile, the fourth member of the set R8 opened with ground, border and radius — all of which travel with the tile when Riku moves or shrinks it (deck §14 item 3). Opening a form is the same event as opening the editor under a different name: **the count was read; the form covers the group that displays it, not the read that produced it.** Under R83 untinting for a form would be a false statement at the exact moment Riku is adding to the day. Specimen 06's two hero panes are drawn tinted (`.pe-t3`).

**The tint is decided at render and refresh time, never live mid-interaction** (R67's existing rule, not a new one). Adding a to-do due today that takes the count from 2 to 3 does not warm the hero as the form closes; the next server render does it.

Literal values, the pure function and where each half lives: §5.1 and §7.7.

#### The hero's states, in full

| State | Render |
|---|---|
| both groups empty, to-do read answered | `.is-pair` spread · `.pe-t0` green · `Nothing scheduled.` + `Nothing due.` |
| events present, `pending` 1–8+ | top-aligned · `.pe-t{n}` |
| `pending` above 8 | `.pe-t8`, clamped |
| to-do read failed | no `.pe-tN` · `Couldn't load to-dos.` with the amber dot in the `DUE` group's place |
| calendar failed, wholly or per layer | the tint is unaffected · `SCHEDULED` carries its sentence after the rows that arrived |
| both feeds failed (deck §11) | untinted · two dotted sentences · no header figure zeroed |
| a form is open | tinted, unchanged (R78) |
| edit mode | tinted, unchanged; head and body `inert`, controls at `.45` (R44, R75) |

### 4.2 Tile 2 — To-do

Eyebrow `To-do`, count `0 open` / `1 open` (`.fl-count`, mono 10px `--ink-3`, tabular), control `+ To-do`. Three section labels **always present, in this order**: `PERSONAL` · `FREELANCE` · `ACADEMICS`. An empty section reads `nothing open` at `.fl-empty` (13px `--ink-3`), left-aligned where the first row would sit; **the label stays**.

**A to-do row is two controls** (R13): the tick, and a second `<button>` wrapping title, meta and tag, named `Edit "…"`, which opens the edit form in place. No chevron, no hover lift. Never `display:contents` on that button — several browsers drop a `display:contents` button out of the accessibility tree.

Due meta, ordering, bounds and every string: deck §6 Tile 2 — due chips `today` · `tomorrow` · `Fri 12` · `24 Sep` · `3 days late`; `on calendar` as a lowercase word with no box; order overdue-first then by due date then undated oldest first (`sortTodos`); bound 20 per section, then `Showing 20 of 34.`; unreadable → `Couldn't load to-dos.` once, in place of the sections.

**Ticking removes the row at once and it reappears in Done this week.** The twin of a ticked overdue to-do leaves Today's `DUE` group at the same instant, through the one page-level context of hidden ids (R33, §7.3).

### 4.3 Tile 3 — Layers

Eyebrow `Layers`. `DESIGN-INSPO.md` §5.11's `.layer` row ported **minus the colour dot and minus `.ct`, with the whole row as the switch** (R15): `<button role="switch" aria-checked>` containing the name and the `.swx` pill (26×15, radius 999, `#141820`, 9px knob), `padding: 8px 0`, `--line-soft` separators, `min-height: 44px` below 480px of tile width.

**The name is `--ink-2` in both states; the knob carries the state.** On: `--ink` border and knob. Off: `--line` border, `--ink-4` knob. The reference's 35%-opacity off row is declined — it would drop the label of a control to 1.8:1. Busy: `:disabled` at `.45` on that row only.

**When the calendar window reports `not-configured` or `expired`, the tile shows Tile 1's matching sentence and no switches** — the page tile must match the Settings card (deck §9). On a per-layer or whole-calendar read failure **the switches stay live**, because switching is still meaningful. Strings: `Couldn't save.` under the row on a failed write with the knob returned; `Couldn't tell if that saved.` (deck §15) when the write timed out, with the knob **not** returned; `No calendars chosen. Pick them in Settings.`; `Couldn't load layers.`

### 4.4 Tile 4 — This morning's push

Eyebrow `This morning's push`, stamp `sent 07:00` (`.pe-stamp`, 11px `--ink-3`, tabular, `sentAt` rendered in `APP_TZ` — **never the cron's nominal hour**).

**The tile is a quotation (R14).** Title in body 600 / 13px / `--ink` (`.pe-ptitle`); body in the `pre.body` well (`.pe-quote` — `--sunk`, `1px --line-soft`, `--r-chip`, `10px 12px`, `white-space:pre-wrap`, body face 12.5px/1.55 `--ink-2`), exactly as sent. **Never clamped, never `+N more`, nothing recomputed, and nothing inside a quoted push is ever hued** — this tile quotes, it never evaluates. `devices` stays on the *LastDigest* model and is not rendered.

**Four states, and it can tell "no push" from "no record" (R22).** The page spends one `AgentRun` read — `fetchLatestRuns(["dispatcher"])` inside the phase-1 `Promise.all`, no round trip of its own:

| Condition | Render |
|---|---|
| a *LastDigest* record for today | quote it |
| `run.ok && dayKey(run.startedAt, APP_TZ) === todayKey(now)` and no record | `A push went out this morning. Its text wasn't stored.` (deck §15) in `.fl-absent`'s register, **no dot** |
| no record | `No push this morning.` and, beneath, `Last: Tue 9 Sep 07:00` with that push's text in the well |
| never stored at all | `No push recorded yet.` |
| monitoring off | `Monitoring is off, so no push goes out.` — **outranked by a push stored for today** |
| unreadable | `Couldn't load this morning's push.` |

**`No push this morning.` takes the `--missing` dot only once `now` in `APP_TZ` is past the expected send hour** (R22, nodded by Riku in deck §15). Before 07:00 the sentence stands undotted — it is true at 00:30, and only the alarm would lie. The expected hour is exported once, beside the cron's provenance, the way `AGENT_STALE_HOURS` is. This is **the one `--missing` dot on the page that is not lateness** (R9 item 2): an expected event that did not happen.

### 4.5 Tile 5 — Next 7 days

Eyebrow `Next 7 days`. Tomorrow through the seventh day, one row each, events and dated to-dos together. **Two inner columns — days 1–4 left, 5–7 right, a 14px inner gutter — at ≥720px of tile width** (R4, chosen by Riku 2026-09-24 as R51): one chronological list in the markup at every width, split by `grid-auto-flow: column` with `grid-template-rows: repeat(4, auto)`, and the only thing that moves is which row gets its hairline suppressed (`.pe-week > .pe-row:nth-child(5) { border-top: 0 }`).

**Day row grammar:** `56px | minmax(0,1fr)`, baseline-aligned. Day label mono 9.5px tabular `--ink-3` in its own fixed track. Items are a wrapping flex row of `time · title · layer` groups at 13px `--ink-2`, to-dos with a tick.

#### The disclosure — R51b, R56–R69, R77

> **Amends a unanimous, not-reopened decision, narrowly.** Round 3's settled list included **"native `<details>` nowhere"**, true when written because no tile disclosed anything. Riku's 2026-09-24 sentence asks for exactly that mechanism. `<details>` now appears in **exactly one place on this page — the day row, and only at two or more items**. Nothing else gains a disclosure by extension; the settled line still holds everywhere it originally meant to hold.
>
> **And it supersedes a deck bound.** ~~Deck Tile 5's "bound per day: 8 items, then `+3 more`"~~ → **R51b**: an opened day shows **every** item, untruncated, so the cap and `+3 more` have nowhere left to apply. A day holding eleven items collapses exactly as a day holding two does, and opening it shows all eleven. Already corrected in the deck.

**The vocabulary is the shipped one, wholesale (R56).** `<details class="disclose">` → `<summary>` → `.sumrow`'s three-column grid → the short title, `.fl-count`, the chevron pseudo-element. **No `.fl-collapsed`** — `Campaigns.tsx`, not `Approaches.tsx`, is the analogue: a day row has no generic heading needing a second data-driven line, because the day label sits in its own column outside `.sumrow` entirely. **No second disclosure invented, no new island (R68), no script, no state, no effect.**

**One CSS addition and one override, both scoped to this row kind:**

- `.pe-row.is-day .sumrow { font-size:13px; color:var(--ink-2) }` — the summary reads in `.pe-items`' own register, so a 1-item day and a collapsed 2-item day read as the same kind of sentence. `.fl-count` keeps its own mono / `--ink-3` rule.
- `.pe-row.is-day .fl-open { margin-top: var(--sp-3) }` — **10px, chosen by eye against the row's rhythm and reported, as R56 required.** `.fl-open`'s shipped 28px is tuned for a page-level block (heading, table, honesty note); 28px between a one-line summary and its own list reads as a gap in the week, not a reveal.

**Structure by item count (R57), and the 0- and 1-item renders are byte-identical to today's markup:**

| Items | Second cell |
|---|---|
| 0 | `<span class="pe-dash">—</span>` (R69) |
| 1 | `<span class="pe-items">` with one `.pe-it` — **never** wrapped in `<details>` (R57, R77) |
| 2+ | `<details class="disclose">` → `<summary>`/`.sumrow` → `.fl-open` → the same `.pe-items` markup with every item in it |

Wrapping a single item would be a click that does nothing, and would make a 1-item and a 2-item day harder to tell apart by silhouette — which R58 leans on. Specimen 02 draws the two side by side to prove they are distinguishable.

**The short title is the leading item's own title, bare (R58)** — `Math Methods`, `Baguio trip`. The leading item is chosen by the sort order the tile already defines (all-day first, then timed by start, then to-dos), so no new ordering rule exists. **No time prefix and no tag**: a time would make the string's shape depend on whether the leading item happens to be timed, untimed or all-day — three different silhouettes for one slot. Two shapes were considered and set aside: `Math Methods +1 more` (it restates, in a second register, the number `.fl-count` prints a few pixels away) and a generic `3 things today` / `Class, to-do, trip` (a bare count names nothing; naming kinds invents a vocabulary the page does not have). **No new string here** — only a rule for which of Riku's own words gets picked.

**The count is `.fl-count`, formatted `N items` (R59).** Not a bare number: Campaigns' bare `2` works because its eyebrow says what is counted, and a day row's `.sumrow` has no label above it. `items` is deliberately generic — the list mixes events and to-dos. **No singular form is needed**: the disclosure exists only at 2+. `N items` is a **proposed string** under the same rule as the eleven (deck §15 does not carry it; see §10 item 5).

**Behaviour:** every day loads **closed**, whatever it holds (R60) — no data-driven `defaultOpen`, because "has 2+ items" is not a state worth pre-surfacing and it would make the week's collapsed height unpredictable from render to render. Each day's state is **independent**; opening one never closes another (R61) — native behaviour, zero script. **An open day pushes the row's height; it never overlays** (R63) — the deck's own grid rule forecloses an overlay (*"nothing overlaps, nothing is transformed"*), and this is the identical treatment R28 already gives the forms, for the identical reason: visible and stated. The row weight is a **minimum**, never a fixed number (R3, R4), so this is legal by construction. **Entering edit mode closes every open day** (R62), the same way R30 closes an open form, and for the same reason: a day left open would sit there dimmed, consuming its expanded height, while Riku is trying to judge and resize the rows around it.

**Ticking inside an open day (R67).** The item vanishes from every tile at once through R33's shared hidden-ids context. **The row's *shape* is decided only at render and refresh time, never rebuilt live**: a day ticked from 2 items down to 1 does not collapse from `<details>` to a plain span in front of Riku; it stays as rendered until the next `router.refresh()` re-evaluates it from server truth. `Approaches.tsx`'s documented behaviour is the precedent almost word for word.

**Failure states (deck §6 Tile 5):** the calendar's sentence at the **top** of the tile (never pinned to a bottom edge 130px from the rows it qualifies — R16) and the days list to-dos only; `Couldn't load to-dos.` likewise, and the days list events only. **With both feeds down the day rows are omitted entirely and the row keeps its weight** (R18, Riku's nod, now deck §11): seven dashes would be seven small lies. Enforced in the type, not by care: `DayRowView = { key; label; items } | { key; label; unread: true }`, so `—` is unreachable for an unread day and `+N more` cannot render on one.

**With every layer switched off the day rows render and `—` is a measurement** (R45): `none-enabled` is decided before any read, so there is no calendar source left to answer and every source that *could* fill a day — the to-do store — has answered. R18's condition holds vacuously. `DayRowView`'s `unread` variant is reserved for an *enabled* source that failed.

**A mechanical consequence, flagged and not fixed (R64).** The two-column split shares row-tracks across columns — day 1 pairs with day 5, day 2 with day 6, day 3 with day 7, day 4 alone — and grid's default `stretch` (the same posture the outer grid uses) means **opening day 7 can leave visible slack under day 3's shorter, closed content, inside day 3's own row box.** This is honest: it reflects a real height difference between two unrelated days. It is **not** to be clipped, collapsed or papered over; the "real slack is shown, not hidden" rule (R17, and the settled "no filling the empty cell") points the same way. Specimen 02 renders the case (only `Mon 26` open, beside a closed `Thu 22`). **If it ever reads as a defect the fix is `align-items: start` on the paired cells, once, not case by case** — that is a ruling, not a tidy. §10 item 4.

### 4.6 Tile 6 — Done this week

Eyebrow `Done this week`, count `3` / `1`, **absent at zero** (deck §12). **The one tile whose second head slot is *adjacent* to the eyebrow rather than flush right** (R11, C18): `.pe-head.is-inline` is `auto | minmax(0,1fr)` with `--sp-5` gap, baseline-aligned, and the second cell holds the count when populated and the sentence when empty — one grammar producing both of the deck's renders.

Rows: a ticked box (quiet — `--line` border, `--ink-3` check), title, section tag, `Mon 8` in mono `--ink-3`. Most recent first. Tapping the box un-ticks; the row leaves and the to-do returns to its section; the accessible name is `Undo "Renew ID"`. Empty: `Nothing ticked off yet this week.` Bound 20, then `Showing 20 of 31.` Unreadable: `Couldn't load to-dos.`

**This row is the surface of the page's one in-flight state.** A to-do marked done that still holds a `calendarEventId` is an entry Google refused to remove; its Done row carries `entry left on Google` (deck §15) until a retry clears it. Nothing is left silently `pending` and nothing is swept by a job — the design doc's earlier "there is no in-flight status to sweep" was wrong and is corrected (R86 via §I item 4).

### 4.7 The empty cell

**Not a tile.** In normal view it is **bare ground** — no fill, no caption, no dashed outline, nothing in it, ever (the settled list; R17's "no filling the empty cell"). In **edit mode only** it is **one dashed rectangle across the row's whole leftover**: `1px dashed var(--line)`, no fill, no caption, the radius of the tile it stands in for (`--r-card`). **Never focusable, never a drop target.** The leftover always trails, because auto-placement packs each row left to right in DOM order and that is all the editor's arrows can express (R3).

Its span differs between the two column counts — a row can have a leftover at twelve and none at six — so the cell carries a class for each, and `pe-x0` / `pe-s0` mean *"no leftover at this count"*. `.pe-cell.is-gap { display:none }` is **the only rule in the stylesheet that ever hides a cell**, and it hides it at one column, where a stack has no leftover. The default arrangement's leftover is 1 column at twelve (row 2 is 3 + 8 = 11) and **nothing at six** (2 + 4 = 6, full) — so the one cell that makes this a bento closes when the page narrows and comes back when it widens. Specimen 05's caption says so rather than letting it look like a bug.

### 4.8 Edit mode

**Four signals say this is a mode, and none of them is a colour** (R30):

1. **Three pills where there was one** — `Reset to default` · gap (`.pe-sep`, `--sp-4`) · `Cancel` · `Save`. `Save` is `.btn.hi`, the system's high rung; the other two rest (P8 R18's ladder).
2. **The grid sunk into a `--panel` well** — `.pe-edit { padding: var(--sp-4); margin: calc(-1 * var(--sp-4)); border-radius: var(--r-feature) }`, the negative margin exactly the padding **so nothing shifts**. `--panel` is the reference's section-well ground, already consumed twice; that is the reason, not "unspent". The well wraps `.pe-wrap` rather than being applied to it, so the container's inline size is unchanged. **`.fl > .pe-edit { margin-top: calc(-1 * var(--sp-4)) }` is required** (M6): the shipped `.fl > :first-child { margin-top:0 }` is (0,2,0) and would zero the top half of the compensation, dropping the grid 14px the moment the mode opens. **Measured: title→grid is 28px in specimen 01 and 28px in specimen 04.**
3. **A toolbar in the foot of every tile** (R29, §5.7).
4. **The row's leftover drawn dashed** (§4.7).

**The header's control row is `position: sticky; top: 0` on a `--void` ground, in edit mode only**, with 10px bottom padding as clearance for the stuck state and a −10px margin giving it back. **No ancestor of the header may take `container-type`** — containment silently kills sticky.

**Edit mode keeps every tile's contents, controls included (R44).** `.pe-head` and `.pe-body` take `inert` — out of the tab order and out of hit testing — so a tap is a layout gesture and never a tick; the foot keeps the live toolbar. Controls inside an inert region render at `.btn:disabled`'s `opacity:.45`: `.pe-tile [inert] .btn, .pe-tile [inert] .pe-sw, .pe-tile [inert] .tick`. A to-do row's **title** does not dim — it is the tile's content, not a signal. The dimmed pill is **the honest form of "the tiles keep rendering live data", not a fifth signal**. Deck §8's "never touches tile contents" is now literally true of the DOM. ~~R30's bare "nothing shifts"~~ is true **only** with M6's margin rule.

**An open form closes on entry, keeping what was typed. Every open day closes (R62). Sparse-row `auto` is suspended (R5)** — so a move never resizes a row Riku is not touching.

**Focus and disabling (R31).** Entering moves focus to the first tile's `←`; `Escape` anywhere is `Cancel`; leaving returns focus to `Edit layout`. **Cells are keyed by tile id** so a moved tile keeps its DOM node and its focus; a button that disables itself hands focus to its sibling (`+`→`−`, `→`→`←`, `↓`→`↑`). Disabled: `←`/`→` at a row's ends; `↑`/`↓` in row 1 / row 4 or when the neighbouring row has fewer than `span` columns free; `−` at span 2; `+` when the row sums to 12; `Save` until something changed; `Reset to default` when the working copy already equals the default. **Empty rows are legal** and `↑`/`↓` do not prevent them. `Save`: `Saving…`, everything disabled, `PATCH /api/settings`, then `router.refresh()`; failure `Couldn't save the layout.` beside the pills **with the mode open and the changes intact**. `Cancel`: no confirmation (the deck gives none; Riku ratified it). `Reset to default`: loads the default into the working copy, no confirmation.

Accessible names, approved as proposed and never visible text: `Move Today left`, `Widen Today`, `Edit "Renew ID"`, `Undo "Renew ID"`, `Done "Send invoice"`.

**Measured:** specimen 04's four rows render **382 · 263 · 305 · 162** — each row grows by the toolbar's 42px allowance, the middle two a little more because Layers and the week were already close to their weights.

### 4.9 The forms

**A form replaces the tile's body, never scrolls, and grows its row when it must** (R28). A real `<form>`; Enter submits. The opening pill is a disclosure (`aria-expanded`, `aria-controls`) and pressing it again closes. Focus into the first field on open, back to the pill on close. `Escape` closes keeping what was typed. **Validation on submit only**, `aria-invalid` + `aria-describedby`, the message under the field in `.pe-said`'s register, **no hue**. Fields go `readonly` while busy. `End` tracks `Start + 1h` until edited. Defaults (today, the next full hour, +1h) are computed **on the server in `APP_TZ`**. `All day` hides `Start`/`End` with `hidden`. Clearing `Due` while `Put on calendar` is on turns it off and restores `Needs a due date.` `Calendar` lists **switched-on layers only**, so a created event lands on a visible layer.

Field order: title full width, then pairs — `Calendar | Date`, `All day`, `Start | End`; `Section | Due`, `Put on calendar` — **pairing at ≥406px of tile width** and one column below (§5.4). Buttons are `.btn`; `Add`, `Save` and `Keep` take `.btn.hi`; **neither is `.btn.go`**, which stays unspent. `Delete` sits apart at the left (`.pe-left { margin-right:auto }`) at **resting emphasis with no red** — the confirmation is the safety, and the page's red is spent on lateness. The confirmation replaces the button row in place: `Delete "Renew ID"?` · `Delete` · `Keep`, focus on `Keep`, `Escape` = `Keep`; for a pinned to-do it names the entry, `Delete "Renew ID" and its calendar entry?` (deck §15). **The two pills are one group that wraps together** (S4), so `Keep` is never orphaned on a line of its own under `Delete`.

**Outcomes, and the asymmetry is the point.** Google **refused** → the sentence above the buttons, the form stays open, `Add` **re-enables**. **Timed out** → `Couldn't reach Google. Check the calendar before trying again.`, `Add` **stays disabled**, `Cancel` is the only live control, **and Today and Next 7 days re-read** so a landed request shows itself. A partial success closes the form and says its sentence under the head. An event dated outside the week: `Added. It's on Fri 24 Oct, outside this week.` (deck §15).

**A failed press restores nothing locally (R21).** It clears the local hide and calls `router.refresh()`; the server render decides whether the row comes back. A **definite** failure says `Couldn't save.` / `Couldn't delete.` under the row; a **timeout** says `Couldn't tell if that saved.` and **never asserts the save failed** — `CLAUDE.md`'s asymmetric rule. Busy labels `Adding…` / `Saving…` / `Deleting…` (sentence case in the source; `.btn` uppercases as presentation). Press outcomes render in `.pe-said` (11px `--ink-3`) **directly under the head** (R16), with no dot and no hue, not surviving a reload, cleared by the next press in that tile. **The one exception is R9 item 4**, reworded by R49: *the dot beside a sentence under a tile's head that names a wrong state in another system* — `Done, but the calendar entry couldn't be removed…`, `Saved, but the calendar entry failed…`, `…couldn't be moved…` — takes the `--stale` dot, because that is a claim about the world and not about a press. ~~R9 item 4's "a tile-foot sentence"~~ → **R49's "a sentence under a tile's head"**: R16 governs place, R9 governs hue, and the foot holds meta and the toolbar only.

**The pill is disabled where a form cannot exist** (R28, R40): below **213px of tile width** `+ Event` / `+ To-do` is `disabled` with `Too narrow for the form.` (deck §15) in `.pe-said`'s register under the head, and `aria-describedby` pointing at it. Refused before the fact; **no arrangement is removed** — `−` still runs to span 2 on every tile. The same mechanism serves R20 (every layer off) and R42 (Google not connected or expired).

**Measured:** the event form's well is **322px** and its tile **421.35px**, so it grows row 1 from 340 to 421 — visible and stated, which is the point. The to-do form at span 4 is one column top to bottom, its well **340.5px** and its tile **426.35px**.

### 4.10 The two Settings cards

Deck §9, on the existing Settings page, which has no page stylesheet of its own — which is exactly why the eight shared controls live in `components.css` (§6).

**`Google Calendar`** — `Connected.` · `Not set up. Add the three Google values to the environment and redeploy.` · `Access expired. Run the sign-in again and replace the token.` · `Couldn't check right now.`

**`Connected.` means one thing precisely: a calendar list came back** (R24, nodded by Riku, deck §15) — not that a token exists, not that the sign-in worked. The Settings page calls `listCalendars()` **once, server-side**, and derives **both** cards from that one answer; **`GET /api/google/status` is cut.** The state between pasting the token and enabling the Calendar API is the first one Riku will hit, and only the list proves it.

**`Calendar layers`** — the card is the heading and the list, nothing else: **the intro sentence is deleted** (M8). Rows are `.pickrow` (R46's eighth shared item): tick, name, `padding: 8px 0`, `min-height: 40px` so two 40px tick hit boxes never overlap, `--line-soft` separators. Saved on tap; the box is disabled while saving; failure `Couldn't save.` Google not set up or expired → the card shows the connection card's own sentence **and no list**, because a picker with nothing in it reads as a page that failed rather than a connection that was never made. Couldn't list → `Couldn't list your calendars.`

**`Up to 10 calendars.` is a press outcome, not a footnote (R43).** It renders in `.pe-said`'s register under the row whose tick was refused, **at the moment it is refused, and never as a standing note on the card.** The mockup does not draw it — Riku has six calendars and inventing five more would break the no-sample-data rule.

**A vanished calendar keeps its row (R42).** ~~R24's "must not share `try again later`'s register"~~ is honoured by a specific register: `Classes is no longer on your Google account. Untick it in Settings.` takes `.fl-empty`'s 13px `--ink-3` **with no dot** where that layer's couldn't-read would have sat — kind 2 in the Honesty Critic's table, because the state is permanent and the sentence hands over a lever. Not `--stale` (transient) and not `--missing` (R9's four places stay four). **On the card the layer stays in the list as a ticked, live row** with the sentence under the name in `.fl-note`'s recipe (11px `--ink-3`), so there is something to untick; `.pickrow:has(.fl-note)` aligns the tick with the name's line (`margin-top: 2.4px`) rather than the middle of two lines. **The build derives the picker's rows from the stored `layers` array, not from Google's list, for exactly this case.**

---

## 5. The visual system as shipped

### 5.1 Tokens

`src/styles/tokens.css` is P8's, unchanged in its ground, ink, hue, spacing, radius and layout groups (P8 spec §5.1). P10 adds three values and amends four comments. **Nothing else in the file moves, and `--alert` / `--amber` never appear** — a stray `var(--alert)` resolves to nothing, is invalid at computed-value time, and would make a red warning silently inherit body grey.

**Three tint tokens are ported, not two** (R81; ~~R70's pair~~ is widened by one):

```css
--tint-save:   linear-gradient(155deg,#052620,#0F1417 62%);  /* anchor 0 */
--tint-spend:  linear-gradient(155deg,#2A1408,#141013 62%);  /* anchor 3 */
--tint-missing:linear-gradient(155deg,#3A0B0B,#191016 62%);  /* anchor 8 */
```

`--tint-save` and `--tint-spend` are **ported verbatim** from `DESIGN-INSPO.md`'s Card tint recipe (lines 83–91, mirrored in `components.html:253–256`), which already specified them; they were never in `tokens.css` because P8 shipped no spend or save stat card. **`--tint-missing` had no source to port from** and is **built** to the same formula — `155deg`, a deep desaturated `--missing` `#F87171`, into a near-neutral at 62%, border at the hue's `.2` alpha. Its two stops are **tuned and measured, not computed**:

- deep `#3A0B0B` — WCAG relative luminance .01163, between `--tint-stale`'s deep stop (.01121) and `--tint-save`'s (.01523); **mid-band, so the red end is no more present than the green end**, which is what keeps it a tint and not an alarm. Three candidates were drawn and rejected; `#440D0D` matched the green anchor's presence exactly but was the brightest deep stop in the system and began to read as an alarm.
- 62% `#191016` — luminance .00635, inside the band the other four near-neutral stops sit in (`#141013` .00566, `#111117` .00582, `#141209` .00601, `#0F1417` .00664). **R81's one hard constraint**: R70's whole contrast result rests on the 62%-and-beyond region of every tint being effectively `--raised`, so a red tint that brightened that stop would move contrast for every ink on the tile at once.

**The calibration used WCAG relative luminance, not HSL lightness**, which disagrees wildly across the four existing tints and is not a usable family test. Recorded because the nine values are frozen and someone will eventually ask how they were derived.

**The nine ramp classes, frozen, with their literal values** (R79, R80, R82). All gradients are `155deg`; all borders are the hue at `.2` alpha. The three anchors read their fill from the tokens above; the six intermediate pairs are **page-local literals in `personal.css`** — they have exactly one consumer and `tokens.css` does not carry values one page uses.

| Class | `pending` | deep stop | 62% stop | border |
|---|---|---|---|---|
| `.pe-t0` | 0 | `#052620` | `#0F1417` | `rgba(53,211,153,.2)` |
| `.pe-t1` | 1 | `#16220E` | `#111316` | `rgba(155,196,72,.2)` |
| `.pe-t2` | 2 | `#231B03` | `#131114` | `rgba(217,169,0,.2)` |
| `.pe-t3` | 3 | `#2A1408` | `#141013` | `rgba(255,138,61,.2)` |
| `.pe-t4` | 4 | `#2D1307` | `#151014` | `rgba(255,132,72,.2)` |
| `.pe-t5` | 5 | `#311107` | `#161014` | `rgba(254,127,83,.2)` |
| `.pe-t6` | 6 | `#341007` | `#171015` | `rgba(253,122,93,.2)` |
| `.pe-t7` | 7 | `#370D09` | `#181015` | `rgba(251,117,103,.2)` |
| `.pe-t8` | 8 or more | `#3A0B0B` | `#191016` | `rgba(248,113,113,.2)` |

Selector shape: `.pe-tile.is-hero.pe-t{n}{background:…;border-color:…}`. The untinted render is `.pe-tile.is-hero{background:#171B21;border-color:var(--ink-4);border-radius:var(--r-feature)}` and nothing else.

**Nine frozen classes, chosen by one pure lookup — no runtime colour maths (R80).** R3's argument transfers without a word changed: an out-of-range value **matches no rule and is therefore visible** as the untinted hero, which is the safe render, where an interpolation function would return an arbitrary colour and look certain about it. No inline style, no per-render custom property, no Sass-style function. It is also what makes the ruling verifiable: nine states is nine contrast measurements a builder can report; a continuous computation is an infinite list and the spec would have to argue about a curve instead of stating numbers.

**Interpolated once, then frozen.** The six intermediate pairs were computed **in OkLCh on the short hue arc for the deep stop and the border, and in straight OKLab for the near-neutral** — a straight OKLab line on the deep stop collapses chroma through grey on the green→orange leg and produced a muddy grey-green that made steps 1 and 2 look like mistakes; hue in LCh is meaningless at the near-neutral's chroma, so that one stays OKLab. Out-of-gamut results were gamut-mapped by **reducing chroma, never by clipping a channel**. **This is a build-time method only; the shipped CSS is frozen hex.** A tuned value that got checked is worth more than a formula that did not — R70's own reasoning for porting rather than retuning.

**The border moves with the fill; the radius never does (R82, extending R71).** Each of the nine classes carries its own border colour, interpolated on the same curve. `--r-feature` is invariant across all nine **and** across the untinted render. There is no precedent in this system for a tinted fill under a hueless border, and nine fills under one frozen border colour would be that mistake nine times. **Cost:** the hero's border has ten possible colours where every other tile has one (`--line`); nine of the ten are a hair apart from their neighbours by construction.

**Measured contrast, all nine states at both bounding stops** (the two stops bound the whole surface, because the gradient holds flat from 62% to 100%): `--ink` **13.58–15.92** against a `--raised` baseline of 15.1 · `--ink-3` **2.68–3.15** against 2.99 · `--missing` **5.82–6.82** against 6.49 · `--ink-2` unchanged in kind. **Nothing moves materially, and the red end is better than the green end on every ink** — the single lowest reading anywhere is R70's already-accepted green-anchor number. `--ink-3` was already sub-4.5:1 on plain `--raised` (it is meta ink by design, the register R12 accepts at 1.75:1 for `--ink-4`'s absences) and the tint does not make that worse. **Every ink lands before the 62% stop at every width**, so the deep-stop column is a conservative floor rather than an optimistic one; narrower tiles push ink earlier on the gradient and the floor still holds at 106px. The composition that had to be drawn rather than described — **red `--missing` ink on the red wash** — is drawn at `.pe-t8`, span 8, with a genuine overdue row.

**Does it read as a ramp?** Yes. Segment A's three steps are visible and uniform at ≈.031 OKLab ΔE each; segment B's five are at or below the just-noticeable threshold, so 3→8 reads continuous. **Steppiness, where any is seen, is in segment A and is there by construction** — it is the 1.8× asymmetry Riku asked for.

**R84's rule, stated as a rule because it is the only thing containing the exception:**

> **On the Personal page, hue in a background wash means volume; hue in ink, on a dot, or on a row means what R9 says it means.** No surface may carry a semantic hue as a wash except the hero, and no wash hue is ever read as its ink meaning.

R9's four **ink** places stay exactly four. R10's dot keeps `--stale` alone. `--missing` as ink keeps lateness alone. Nothing else on the page gains a tint by extension — R79 is a ruling about one tile.

**The four comment edits, and R84's text is the wording that ships.** ~~R76's two-token wording~~ → **R84's**, because a ramp crossing four hues cannot be recorded as one token's second meaning without four comments that each tell a quarter of the truth. `src/styles/tokens.css`, the semantic-hues group comment:

```css
  /* semantic hues — meaning is fixed in ink; one recorded exception
     for background washes on the Personal page's hero tile (P10 R79–R84) */
```

and the three anchored tokens each gain a **pointer, not a restatement**:

```css
  --spend:#FF8A3D;   /* money out, limits consumed, the brand mark — also P10 R84 */
  --save:#35D399;    /* value recovered, healthy, connected — also P10 R84 */
  --missing:#F87171; /* overdue, absent, late — also P10 R84 */
```

`docs/design/DESIGN-INSPO.md`, a footnote **directly under** the "Semantic hues — meaning is fixed" table (the table itself is not rewritten), in the register R9's layer-hue decline and R42's note already use:

> *One recorded exception: the Personal page's hero tile carries a background tint that ramps from `--save` through `--spend` to `--missing` with the day's pending-task count. This is a page-local reading of those hues **as a wash**; their fixed meanings in ink, on dots and on row borders are untouched, and no other surface may take a semantic hue as a wash without its own ruling. See P10 round 5, R79–R84.*

**`docs/design/components.html` is not edited** — it is the frozen teardown reference, a source to translate *from*, and `tokens.css`'s own NAME MAP comment already treats it that way. Its `.stat.spend` / `.stat.save` entries are the citation this port comes from, not a claim to correct. All of this ships **in the same commit as the ramp**, so the file is never in a state where the comment and the code disagree.

**Dark only.** No `@media (prefers-color-scheme)`, no `[data-theme]`. No new token beyond the three tints — the ramp **spends existing hues, it does not add one**.

### 5.2 Faces

P8's three, through `next/font/google`, with CSS variables named exactly `--display`, `--body`, `--mono` so every recipe copied from `components.html` works unchanged: **Archivo 600/700** for figures and headings, **IBM Plex Sans 400/500/600** for anything read as a sentence, **JetBrains Mono 400/500/700** for all labelling. `tokens.css` carries the comment saying those three are defined by `layout.tsx` and not by the token file.

### 5.3 The scale actually used

Read off the mockup's CSS. Everything the Personal page adds; P8's inventory (spec §5.3) still holds for `.fl-title`, `.eyebrow`, `.fl-h`, `.fl-count`, `.fl-empty`, `.fl-note`, `.fl-absent`, `.fl-bound`, `.fl-snip`, `.btn`, `.tag`.

| Element | Spec |
|---|---|
| Group label `.pe-grp` | mono 500 · 9px · `0.14em` · uppercase · **`--ink-3`** (R12) |
| Tile heading `.fl-h` | display 600 · 19px, **dropping to 15px below 200px of tile width** — two sizes, never three (R11) |
| Head stamp `.pe-stamp` | 11px · `--ink-3` · tabular · `nowrap` |
| Row title `.pe-nm` | 600 · 13px · `--ink` · ellipsis, never wraps |
| Scheduled time `.pe-time` | mono · 9.5px · `--ink-3` · tabular · `nowrap` |
| Due meta `.pe-due` | mono · 9.5px · `--ink-3` · tabular · right; `.is-late` → `--missing`. **Ink is the only difference between a due date and an overdue one** — no box either way (Q13, unanimous) |
| `on calendar` `.pe-on` | 11px · `--ink-3` · body face · lowercase · **no box** — an ambient state of the row, not a category |
| Day label `.pe-daylbl` | mono · 9.5px · `--ink-3` · tabular |
| Day items `.pe-items` | 13px · `--ink-2`; inner time `.pe-t` mono 9.5px `--ink-3` tabular; layer `.pe-l` `--ink-3` |
| Read-and-empty day `.pe-dash` | **`--ink-3`** (R19) — a measurement, not `.fl-trow .dash`'s absence ink |
| Day summary `.pe-row.is-day .sumrow` | 13px · `--ink-2` (R56) |
| Press outcome / validation `.pe-said` | 11px · `--ink-3`; 4px under a field or a control row |
| Failure sentence `.pe-fail .said` | 13px · `--ink-2`, beside a 5px dot |
| Push title `.pe-ptitle` | 600 · 13px · `--ink` |
| Push `Last:` stamp `.pe-last` | 11px · `--ink-3` · tabular |
| Push quotation `.pe-quote` | body face · 12.5px / 1.55 · `--ink-2` · `pre.body`'s well, verbatim |
| Layer name `.pe-sw .nm` | 12.5px · `--ink-2` **in both states** · `flex:1 1 0` · ellipsis (S11) |
| Stepper number `.pe-step .ct` | display 600 · 15px · `--ink` · tabular · `min-width:22px` · centred |
| Toolbar caption `.pe-cap` | mono · 9.5px · `--ink-4` · tabular · sentence case · own line · `aria-live="polite"` |
| Field `.fld` | body face · **16px** · line-height 1.4 · `8px 10px` · `#101318` · `1px --line` · `--r-chip` · `--ink` · caret `--spend` |
| Field label `.fld-l` | 12px · `--ink-3` · **sentence case, not mono caps** — it addresses a person |

**The 16px on `.fld` is a control dimension and is recorded as one (R27).** `layout.tsx` sets `maximumScale:1`, which iOS Safari has ignored since iOS 10, so a focused input under 16px auto-zooms and never zooms back. **It is never licence for 16px prose.** `line-height:1.4` is declared for the same reason `.btn` declares it: a UA gives form controls `line-height:normal`, which is font-metric derived, so the field's height would otherwise depend on IBM Plex Sans's metrics. `caret-color: --spend` stays — a caret is the same class of thing as `base.css`'s focus ring, a reference-level convention and not a hue spend.

**`font-variant-numeric: tabular-nums` on every figure and every column of digits.** Non-negotiable. Every count on this page is tabular; **no count is hued** (the settled list).

### 5.4 The grid, its arithmetic, and every threshold

**The column stays `--content-max` 920px** (deck §2 item 9). Twelve columns with the 14px gutter: `(920 − 11 × 14) / 12 = 63.83px` per column. **These are the legal cell widths, and every threshold below is derived from them rather than from round numbers:**

| Span | at twelve columns (920px) | at six columns (706px) |
|---|---|---|
| 1 | 63.83 (leftover only) | **106** |
| 2 | **141.67** | **226** |
| 3 | **219.5** | **346** |
| 4 | **297.33** | **466** |
| 5 | 375.17 | *not drawn* |
| 6 | 452.5 | **706** |
| 7 | *not drawn* | — |
| 8 | **608.67** | — |
| 12 | **920** | — |

Every figure above is the mockup's own — its holder widths (`.w609`, `.w466`, `.w406`, `.w297`, `.w226`, `.w219`, `.w213`, `.w142`, `.w106`, `.w334`, `.w164`) and the width list its grid comment carries. **Span 7 at twelve and 5 of 6 are the two legal cells the mockup never draws, so their widths are unmeasured here** — do not derive them into a threshold argument. *(R38's sentence "480 catches everything up to span 7 at twelve (452.5)" attaches span 7's name to span 6's width; 452.5 is span 6, as the mockup's own pair-threshold comment states, and the band's top edge is what the sentence is actually about.)*

**Two container thresholds on the grid's own width, mobile-first, never the viewport (R2).** A named container `pgw` on `.pe-wrap` drives the column count: **the base is one column**; `@container pgw (min-width:706px)` gives six; `(min-width:820px)` gives twelve. Both are derived from the narrowest legal cell — **106px at six, 125px at twelve**. Tracks are `repeat(6, minmax(0,1fr))` and `repeat(12, minmax(0,1fr))`, **never a bare `1fr`**; `min-width:0; overflow:hidden` on the tile. **No `@media` and no `@supports`**: a browser without container queries takes the one-column base, which is correct. **The design doc's 760px and 480px viewport breakpoints are struck** — nothing about the shell's width reaches the grid, so the page is right whatever the rail does.

**A second named container `tile` sits on every `.pe-cell`, not on the tile (M2).** An element cannot query itself, and a container query measures the container's **content box** — a container on the tile would fire 34px late and could never change the tile's own padding. On the cell, **every `@container tile` number is the tile's border-box width**, which is the width every ruling names. ~~R2/R6/R11/R13/R15/R28/R29's thresholds read as content widths~~ → **M2: every one of them is a border-box width.** `.pe-tile{padding:12px}` comes alive as a consequence.

**The three inner thresholds R38 names, in one table, against the cells they catch:**

| Threshold | What changes | Cells caught |
|---|---|---|
| **< 480px** (R13, R15, S2) | the scheduled row goes two-line (time and tag on one mono line, title beneath); `.pe-sw` takes `min-height:44px`; **above** 480 the due column takes `min-width:64px` so neighbouring rows' right-hand cells form a column | 106 · 141.67 · 219.5 · 226 · 297.33 · 346 · 375.17 · 452.5 · 466 — i.e. everything up to span 6 at twelve and 4 of 6 |
| **< 240px** — the narrow band (R38) | tile padding `12px`; the form well's padding to `--sp-3`; **every row with more than two cells goes two-line** (leading cell + title on line one; tag, `on calendar`, due meta, `Mon 8` on line two); the head's pill to `8px 10px`; the toolbar's stepper loses its 10px indent; `.sumrow` splits two-line (R66) | 106 · 141.67 · 219.5 · 226 |
| **< 200px** (R11) | the head stacks (control under eyebrow); `.fl-h` steps to 15px; the inline head stacks with a `--sp-3` gap | 106 · 141.67 |

**Why 240 and not 200.** ~~R6's 200px for padding~~ → **R38's 240px.** 200 caught 141.67 and 106 and **missed the two cells the mockup shows need the room**: 219.5 (span 3 at twelve) and 226 (2 of 6). A boundary at 240 separates the two narrowest spans **at each column count** from the rest, which is a definition and not a round number. At 226px a to-do title beside `on calendar` and `3 days late` is one letter. **R11's 200px for head stacking stands** — at 226 the head fits unstacked and a stacked head would cost the tile a line for nothing. **R13's 480px for the scheduled row stands**; the band adds the other rows.

**Three more thresholds are in the shipped CSS and are not R38's three.** They are listed here so nobody looks for them elsewhere:

| Threshold | What changes | Measured from |
|---|---|---|
| **< 134px** (R29, R66) | the arrow group wraps 2×2 to a 52×52 block and the stepper drops to the next line; **a disclosure day row puts its day label above its content instead of beside it** | 108px of arrows need 134px of tile (108 + 12px padding + 1px border each side). Catches 106 only |
| **≥ 406px** (R40) | `.pe-pair` becomes two columns | the native date field measured at **164.8px**; two of them plus the 12px gap need 341.6px of well content = 406px of tile |
| **≥ 720px** (R4) | `.pe-week` splits into two inner columns, `grid-auto-flow: column`, `grid-template-rows: repeat(4,auto)`, 14px column gap | the week's own measurement |

**Placement is three frozen class lookups per cell plus one inline track list (R3).** `.pe-cell` carries `pe-r{1..4}` (its row after compaction), `pe-s{2..12}` (its twelve-column span) and `pe-x{1..6}` (its six-column span from `collapseRow`), all emitted from `Object.freeze`d tables **so an out-of-range stored value matches no rule and is visible**. Columns are never pinned: with `grid-row` fixed and `grid-column: span N`, auto-placement packs each row left to right in DOM order and **the leftover always trails** — all the editor's arrows can express. `--tracks` is per-render data emitted inline by a pure `buildTracks(layout, editing)`: empty rows compacted out and the rest renumbered, a shrinking row `auto`, every other row `minmax(calc(Wpx + var(--tb)), auto)`. **`--tracks` is read only inside the six- and twelve-column blocks**, so the one-column stack never sees it and needs no override. `--tb` is `0px`, rising to `42px` on `.pe-grid.is-editing`, folded into every row minimum by **one class on the grid** so a short row never swallows its own heading.

**At six columns the spans come from `collapseRow`, not from `ceil` alone (R1).** Round every span up, then **decrement the widest entry (ties at the last index) until the row sums to ≤ 6**. Pure, render-time, server-side, one caller. Round-down is rejected (it contradicts the deck's "rounded up" and makes span 3 identical to span 2); `Math.max(2, ceil)` is rejected (it overflows the legal six-span-2 row). **The editor does not import it**: `+` is disabled by the twelve-column sum alone, because a `+` dimmed for a width Riku cannot see declines the move its own caption promises. The overflow condition is `Σsᵢ + #odd > 12`, which non-full rows also satisfy.

**Row weights: 340 · 200 · 240 · 120, as minimums** (R4, R39). ~~R4's 180 for row 2~~ → **R39's 200**: the pixels said 197.85 with R15's 44px switch rows at span 3, and dropping the 44px floor to make 180 true is exactly the cheat R4 forbids — a touch target shrunk to hit a number. **200 → 240 is a narrower step than 180 → 240 was**, so "short" stays short; it cost one word in the deck, already changed.

**The measured blank renders sit beside the weights, and that is what makes the weights real** (R4). Specimen 01: the four rows render **340 · 200 · 240 · 120**, so the grid is **942px** tall, and left to their own heights the tiles would measure **Today 213.35 · To-do 270.85 · Layers 191.85 · push 112.35 · Next 7 days 234.25 · Done this week 51.1** — every one under its row's weight. **No row on the blank page is being held open by its contents.** *(Layers reads 191.85 rather than R39's 197.85 because M2/R38 made the 12px padding fire at span 3's 219.5px, which was not true when R39 measured. 200 stands as ruled; the design doc still carries 197.85 — §10 item 8.)*

**A build never tightens row padding below 11px, shrinks type, or clips to hit a weight** (R4). If a render reaches 240 with one column, it cheated.

**A row whose only occupant is one tile narrower than the row takes `auto` and shrinks to fit it** (R53; ~~R5's "tiles summing to fewer than 6 columns"~~ is superseded by R53's one-occupant condition, which is what the corrected deck and design doc now carry). **A general rule for every arrangement**, not a rule about the push tile. It can never make a row taller than its weight would; the default never triggers it; **R5's suspension in edit mode survives**, so a move never resizes a row Riku is not touching. Specimen 04's drawn case: row 1 falls from **340px to 131px**, the push tile's own height at span 4.

*How that answer was got, because it is the model for the next one:* R48 refused to put the question to Riku in prose. It drew both outcomes in one frame — the push tile alone in row 1 with the row shrunk, and the same arrangement with the row held at 340px and bare ground under the tile — captioned in his own words. He answered in one letter. Both panes are still in the mockup, the rejected one labelled as what the ruling replaces.

**Content grows a row but never shrinks it.** Specimen 02's row 1 renders **463.75px** because the To-do tile's six rows in three sections come to 463.75 against a 340 weight.

**The collapse, measured.** Specimen 05, a 932px window → a 706px grid → six columns: the default's spans halve rounded up (8→4, 4→2, 3→2, 12→6) and the tiles render **466 · 226 · 226 · 466 · 706 · 706**, the rows **551 · 200 · 362.75 · 210**. Row 1 grows because the To-do tile at 226px puts each row's date and tag on a second line; row 3 because at 706px the week is one column. **`[3,3,3,3] → [2,2,1,1]`** renders **226 · 226 · 106 · 106** in a 340px row. The narrowest cell edit mode can produce: a 932px frame's rows read **438.9 · 432.2 · 162**, the first set by the push tile at 1 of 6 whose quoted message wraps to eight lines.

**The one-column week, if Riku ever reverses R51.** Specimen 01's B-panel: the week tile measures **361.15px** instead of 234.25, row 3 has to be re-weighted to **365**, the grid becomes **1067px** tall, and the cadence reads tall / short / **tall** / short. Kept drawn because it is what two columns buys.

### 5.5 Row grammar

**Rows are hairline rows, never boxes (R13).** `.fl-stage`'s grammar: `padding: 11px 0`, a `--line-soft` top border on **every row but the first** (`.pe-rows > .pe-row:first-child`, `.pe-week > .pe-row:first-child`, `.pe-rows > .pe-inline:first-child`). **The tile is the only card level on the page** — every row, group, sentence, form and toolbar inside a tile is hairlines, wells and ground, and **nothing nests a second card** (the settled list). A tile is `--raised`, `1px solid var(--line)`, `--r-card` 10px, padding `15px 16px` dropping to `12px` in the narrow band (R6, R38); the hero alone takes `--r-feature` 14px, because `DESIGN-INSPO.md` §3's radius table is literal and **six feature radii mean no tile is the feature**.

**Tile content is top-aligned in a stretched cell.** `.pe-cell` is a grid and `align-items` stays `stretch`, so every tile fills its cell exactly. The one exception is R17's hero.

The five row kinds:

| Kind | Grid | Notes |
|---|---|---|
| **Scheduled** | `72px \| minmax(0,1fr) \| auto` | time (`all day` in the same slot), title on one line with an ellipsis, layer tag. Two-line below 480px, with the **anchor** placed as the grid item (placing the span inside it would leave the anchor auto-placed in the time column, which then grows to the title's width) |
| **Due / done / plain item** | `auto \| minmax(0,1fr)` + `grid-auto-flow:column; grid-auto-columns:auto` | tick, title, then whatever meta the row has, in **implicit** columns |
| **To-do** | `auto \| minmax(0,1fr)` | two controls: the tick, and one `<button>` carrying title, tag and meta |
| **Day** | `56px \| minmax(0,1fr)`, baseline-aligned | day label in its own fixed track, **outside `.sumrow` entirely** (R57) |
| **Inline form** | `.pe-inline` | `--line-soft` top border, `padding: 11px 0` — replaces one row in place; the rows around it do not move |

**A row never pays for a cell it does not have (R47).** Undated rows and rows without a tag emit **no empty `<span>`s**; the explicit tracks are the leading cell and the title, and the rest flow into implicit auto columns. So `Pay tuition`'s tag ends at the row's edge, and an undated name at 164px does not lose 28px to nothing. `.pe-edit-row` carries the same shape.

**The layer tag `.tag.is-layer`** — `.tag`'s box with `text-transform:none`, `letter-spacing:.04em`, **10px** (`.fl-count`'s size, so no new size), `max-width: calc(11ch + 20px)`, ellipsis. **Eleven characters *of name*** (M5): `.tag`'s 10px side padding is added back, because border-box would otherwise spend 20px of the 11ch on padding and cut `Classes` to `Classe…`. Uppercasing `Holidays in Philippines` would transform **Riku's data**; mono caps are for what the system names. **The section tag on a to-do row stays a plain `.tag`** — those are the system's names.

**Every name-bearing row ellipsises and never wraps.** The deck's rule for event titles applies to layer names and to-do titles too. **A failure sentence is the opposite: it never truncates — it wraps and the tile grows** (R10), because a failure sentence that truncates is a failure to report.

### 5.6 The one disclosure

Native `<details>` / `<summary>`, in exactly one place (§4.5). `.disclose > summary { display:block; list-style:none; cursor:pointer }` plus `::-webkit-details-marker { display:none }`; the chevron is a rotated CSS box on `.sumrow::after`, `transition: transform .14s ease`, covered by the reduced-motion rule. Zero client JavaScript, correct keyboard behaviour, correct `aria-expanded`, find-on-page expansion, nothing to break under hydration because there is none. **"Is this day open" has no consumers, no persistence and no sharing — it is not application state.**

The chevron's geometry is also the page's **one** chevron shape: `.sel::after` reuses it for the selects, so `appearance:none` does not introduce a second one (R27).

### 5.7 The edit toolbar

`.pe-bar` is `.course .foot`'s shipped shape: `border-top: 1px solid var(--line-soft); margin-top: 12px; padding-top: 11px; display:flex; flex-wrap:wrap; align-items:center; gap: var(--sp-1)`. Four arrows in a 108px group, then the stepper (`.pe-step`, `margin-left: var(--sp-3)`), then the caption on its own line (`flex-basis:100%`).

**It wraps before it clips (R29).** 108px of arrows need 134px of tile, so at 1 of 6 (106px) the group wraps **2×2** into a 52×52 block and the stepper drops to the next line — the tile carries `overflow:hidden`, so the fourth arrow would otherwise be invisible **and** unreachable by pointer. At span 2 on twelve (141.67) they fit. In the narrow band the stepper also loses its 10px indent, so arrows + stepper (190px) stay on one line at span 3 (193.5px of inner width) and 2 of 6 (200px) instead of wrapping and growing row 2 by a line.

**Arrow glyphs are literal characters in the mono face** — U+2190–2193 have no emoji presentation (R26). **Check on a phone.** The square icon button is `.sq`: 24×24, `--r-nav` 7px, `1px --line`, `--ink-3`, 10px mono glyph, hover to `--ink-4` / `--ink`, disabled at `.btn:disabled`'s `opacity:.45; cursor:not-allowed`. It serves the four arrows **and** the stepper.

The caption is `.pwhen`'s recipe, sentence case as the deck writes it: `2 columns left` · `1 column left` · `row full`.

### 5.8 Focus, selection, motion

- `:focus-visible { outline: 2px solid var(--spend); outline-offset: 3px; border-radius: 3px }` — `base.css`'s, unchanged and unqualified. A reference-level convention, not a hue spend. **`--spend` on this page stays on the focus ring and the field caret only** (R9) — the hero's wash is the ramp's, not `--spend`'s ink.
- **`.tick` must outrank the focus ring's radius.** `.tick` is (0,1,0) and so is `:focus-visible`, but `.tick` is later in the sheet, so its 3px radius survives a focus ring (R25).
- `::selection { background: rgba(233,236,240,.16); color: var(--ink) }` — neutral, untouched.
- `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important } }` — **the only `@media` in the personal layer.** The chevron's `.14s` transform is the one thing it has to suppress.
- **No spinner, skeleton, toast, hover-only affordance, drag or retry control anywhere** (the settled list). Busy states exist on the forms and the switches only; everything else arrives with the page.

### 5.9 The hue budget, in full

Hue appears in **five places** on this page, and only the fifth is new (R9, extended by R84):

1. **`--missing` as ink on lateness** — `3 days late`, `1 day late` — in the due-meta column, **nowhere else**.
2. **`--missing` on the 5px dot beside `No push this morning.`**, and only once the expected send hour has passed (R22).
3. **`--stale` on the 5px dot beside every couldn't-read sentence** (R10).
4. **`--stale` on the dot beside a sentence under a tile's head that names a wrong state in another system** (R9 item 4, as reworded by R49).
5. **The hero's background wash** — the nine-step ramp (R79–R84), **a wash and never ink**.

**Nothing else.** No hued count, tag, switch, tick, pill, form field, validation message, press outcome, empty cell or edit-mode surface. No green on a ticked row. No hue on a layer name (`DESIGN-INSPO.md` §5.11's map declined, R9). No hue inside a quoted push, ever — the tile quotes and never evaluates. `.fl-bound` stays `--ink-4`: meta about the display, not a claim about the world. **On deck §12 — today's real page — the content column renders with exactly one hue, the hero's green wash.**

**The dot, and only the dot, marks a couldn't-read (R10, R55).** `.pe-fail` is `.fl-fail`'s shape: `grid-template-columns: 5px minmax(0,1fr)`, 9px gap, a 5px disc with a 6px glow at `--stale` (`.is-missing` swaps in `--missing`), then a 13px `--ink-2` sentence. **The same shape at every tile and every span**, because a 5px dot is visible at 80px of inner width and a coloured word is not. **Amber, not red:** a calendar that did not answer is ageing data — the reading `--stale` already carries — and red stays on lateness.

**A measured emptiness takes no marker.** `Nothing scheduled.` · `Nothing due.` · `nothing open` · `—` · `Nothing ticked off yet this week.` all render bare, at `.fl-empty`'s 13px `--ink-3`, left-aligned where the first row would sit, and **that absence of a dot is itself the signal.** The Honesty Critic's kinds 1–3 — measured emptiness, absence by configuration, absence of a record — take no marker at all.

**`—` means a day that was read and held nothing** — a deliberate, recorded deviation from `DESIGN-INSPO.md` §5.14 rule 3 ("em-dash, never zero") (R19). The deck's string is Riku's and reads correctly in English; the guard that keeps it honest is R18's type. **Because it is a measurement it takes `--ink-3`, not `.fl-trow .dash`'s absence ink.** Written down so nobody "fixes" the seven dashes into blanks, and so nobody reads rule 3 as no longer binding for the Academics page.

### 5.10 Group and section spacing

`.pe-body { margin-top: var(--sp-5) }` (20px under the head), `flex-direction: column`, `min-width:0`, and `.pe-body > :first-child { margin-top: 0 }`. Groups sit **28px** apart (`.fl-group`) — at 20px the group eyebrow reads as a second eyebrow under the tile's own. `.pe-grp + .fl-empty`, `.pe-grp + .pe-rows` and `.pe-grp + .pe-fail` take `--sp-3` (10px): `.fl-empty`'s 20px was calibrated to sit under a 19px heading and under a 9px label it reads as a gap. A sentence then a list takes `--sp-4` (14px). `.pe-fail + .pe-fail` is `--sp-3`; `.pe-head + .pe-fail` is `--sp-3` (R49's dotted press outcome, directly under the head).

**The foot holds display meta and the edit toolbar, nothing else (R16).** `.pe-foot { margin-top: auto }` carries `.fl-bound` (`Showing 20 of 26.`) and, in edit mode, the toolbar. **Couldn't-read sentences go where the deck places them** — Today's after the rows that arrived, Next 7 days' at the top — never pinned to a bottom edge 130px from the rows they qualify.

### 5.11 Declared vocabulary that renders nowhere

P8's §5.8 list — `.statstrip`, `.btn.go`, `.statuspill`, `--session` — **does not grow**, and `.btn.go` **stays unspent on this page** (the settled list): the one affirmative pill in a row takes `.btn.hi` (R46). `--skill` and the `-dim` tokens are still not ported. `.range` is still not ported; its named future consumer is the queue page's own rebuild.

**One entry is added, and it is a live tension rather than a clean addition.** `.pe-more` (`+3 more`, 11.5px `--ink-4`) is declared in the mockup and **used nowhere**: R51b removed its only consumer by making an open day untruncated, and R58 deliberately declined the `Math Methods +1 more` shape for the collapsed summary. The mockup keeps it "because the deck still names it" — but the deck's §6 Tile 5 now says the bound is superseded, and §5.8's rule is that declared-unused vocabulary is an invitation. **The shipped default is to drop `.pe-more` unless the build finds a bound that consumes it**; §10 item 3 puts it to the lead, because reversing it is one line either way.

---

## 6. What other pages inherit

### 6.1 The shared-control block in `components.css`

**Eight controls plus two modifiers, in `components.css` and not in `personal.css`, because the Settings layer picker ships this phase on another page — and the Settings page has no stylesheet of its own** (R32, R46):

| Class | What it is |
|---|---|
| `.tick` | the 14px tick box — radius 3px, `1px --line`, `--sunk` fill, an 8px `currentColor` check at 1.8 stroke in `--ink-3`, **never a fill** |
| `.swx` | the 26×15 switch, `components.html:475`'s port |
| `.sq` | the 24×24 square icon button (arrows, stepper) |
| `.fld` | the field |
| `.fld-l` | the field label |
| `.sel` | the select wrapper with `.sumrow::after`'s chevron |
| `.formwell` | the form well |
| `.pickrow` | the Settings picker's row |
| `.tag.is-layer` | the de-capsed data tag |
| `.btn.hi` | the high rung of P8 R18's ladder |

**Names are reference-style with no page prefix** (R46). ~~R25's `.pe-tick` and R27's `.pe-form` / `.pe-sel`~~ → **`.tick`, `.formwell`, `.sel`**: R25 and R27 put two conventions in one block, and the inconsistency was the rulings'. `pe-` stays the Personal page's and nothing else's. **None of these is element-shaped** — a bare `.tile` rule would border and pad `.app-brand .tile`, the 24px sunburst in the rail, on every page in the app (R32, C7). **Nothing already in `components.css` changes shape**, and `components.css`'s "two namespaces, no third" header line is amended **in the same commit** to name this block rather than a third prefix.

**`.btn.hi` replaces the mockup's page-scoped `.pe-hi`** because `Save` on the Settings page will want the same rung: `border-color:var(--ink-4); color:var(--ink)` at rest (`.btn:hover`'s two values), hover lifting the border to `--ink-3`. It is a **modifier used with `.btn`**, so it must restate `.btn:disabled`'s ink and border — at equal specificity the later rule wins, and a disabled `Save` must still read as disabled.

**`.tick`'s hit target is `inset: -13px` on all four sides → 40×40** (R41; ~~R25's `inset:-13px -6px -13px -13px`~~ gave 33×40 and is struck). Drawn with `position:relative` and an absolutely positioned `::after`, **never negative margins**, which would move the drawn box too. The row's `gap: var(--sp-4)` puts the edit button 14px away, so the target stops **1px clear of it**. In Done this week the accessible name is `Undo "Renew ID"`. **No busy state on a tick: the row leaves.**

**`.pickrow` takes `min-height: 40px`** so two 40px tick hit boxes never overlap (N8).

**Why the tick is a check and not a fill:** solid fills are rationed to one per screen, and Done this week alone would put twenty on the page.

### 6.2 What the Freelance page inherits whether it likes it or not

**The phone strip (S20).** It is a shell change; `/freelance` and `/freelance/queue` get it, the agent badges vanish at phone width there too, and P8's §10 phone debt is **partly** paid — the shell now has a phone form, but no page has had a phone design pass.

**The three tint tokens and the four comment edits** land in `tokens.css` and `DESIGN-INSPO.md`, which every page reads. **The rule that contains them (R84) is written as a page-local exception**, so no other surface may take a semantic hue as a wash without its own ruling.

**One nav item** in the rail, first (D13).

---

## 7. Engineering

### 7.1 Stylesheets

A **fifth** file, imported side-effect style from `src/app/layout.tsx` only, **fourth in the fixed order**:

```
src/styles/tokens.css       :root only — plus the three tints and four comments (§5.1)
src/styles/base.css         unchanged
src/styles/components.css   the shared block gains ten entries (§6.1); nothing changes shape
src/styles/personal.css     NEW — namespace pe-, no other
src/styles/legacy.css       unchanged; still has an expiry date
```

**Namespace `pe-` and no other; no bare element-shaped class names** (R32). The full inventory: `.pe-wrap` · `.pe-grid` (+`.is-editing`) · `.pe-cell` (+`.is-gap`) · `.pe-gap` · `.pe-edit` · `.pe-r1`–`.pe-r4` · `.pe-s1`–`.pe-s12` · `.pe-x1`–`.pe-x6` (+`pe-s0`/`pe-x0` as "no leftover at this count") · `.pe-tile` (+`.is-hero`, `.pe-t0`–`.pe-t8`) · `.pe-head` (+`.is-inline`) · `.pe-stamp` · `.pe-body` (+`.is-pair`) · `.pe-grp` · `.pe-said` · `.pe-fail` (+`.is-missing`, its `i` and `.said`) · `.pe-rows` · `.pe-row` (+`.is-sched`, `.is-item`, `.is-todo`, `.is-day`) · `.pe-time` · `.pe-nm` · `.pe-edit-row` · `.pe-due` (+`.is-late`) · `.pe-on` · `.pe-daylbl` · `.pe-items` (+`.pe-it`, `.pe-t`, `.pe-l`) · `.pe-dash` · `.pe-more` (§5.11) · `.pe-week` · `.pe-layers` · `.pe-sw` (+`.nm`) · `.pe-ptitle` · `.pe-last` · `.pe-quote` · `.pe-foot` · `.pe-fields` · `.pe-pair` · `.pe-ctl` · `.pe-acts` (+`.pe-left`) · `.pe-confirm` (+`.pe-q`, `.pe-yn`) · `.pe-inline` · `.pe-bar` · `.pe-arrows` · `.pe-step` (+`.ct`) · `.pe-cap` · `.pe-sticky` · `.pe-pills` (+`.pe-sep`).

**One recorded exception to R2's `minmax(0,1fr)`**: `.pe-pair`'s columns are `minmax(min-content,1fr)` (S13), because a native control squeezed under its minimum **clips its own text silently** and an overflow is at least visible. `.pe-week` and `.pe-layers` take `minmax(0,1fr)` as R2 says — an auto track would take the switch row's min-content, which at 106px is wider than the tile, and the knob would land in the padding (S11).

### 7.2 Route and files

```
src/app/(app)/personal/page.tsx              server — the page
src/app/(app)/personal/_blocks/              the six tiles, server components
src/app/(app)/personal/LayoutEditor.tsx      "use client" — island 1, and the context provider
src/app/(app)/personal/TodoRow.tsx           "use client" — island 2, one component serves four tiles
src/app/(app)/personal/TodoForm.tsx          "use client" — island 3
src/app/(app)/personal/EventForm.tsx         "use client" — island 4
src/app/(app)/personal/LayerSwitches.tsx     "use client" — island 5
src/lib/personalLayout.ts                    pure — imported by a client component
src/lib/google.ts · src/lib/days.ts · src/lib/todos.ts · src/lib/personalView.ts
src/models/Todo.ts · src/models/LastDigest.ts
scripts/google-auth.mts                      the loopback OAuth bootstrap
```

`src/proxy.ts` stays on the files-no-plan-touches list.

### 7.3 Five islands, one context, no effects (R33)

`LayoutEditor` (edit mode, the working arrangement, the header pills, the cell wrappers — **always rendered, keyed by tile id**, the toolbar a conditional child, `inert` toggled), `TodoRow`, `TodoForm`, `EventForm`, `LayerSwitches`.

**`LayoutEditor` also provides one page-level context holding the `Set` of hidden to-do ids**, which every `TodoRow` reads and filters itself by, so the twin of a ticked overdue to-do leaves Today and the To-do tile at the same instant (C11). The set only grows during the page's life and **shrinks by one on a definite failure**; the write is idempotent (`setDone(id,true)` guarded, already-done is not an error); `router.refresh()` reconciles. **While edit mode is open nothing else calls `router.refresh()`** — `inert` bodies guarantee it.

**No `useEffect` in any P10 island.** `git grep -n useEffect 'src/app/(app)/personal/'` must return nothing, and `npm run lint` must still end `4 errors, 3 warnings` (§9).

**No sixth island (R68).** `<details>` needs no script, no state and no effect. Written down so nobody goes looking for a missing island when the disclosure ships.

### 7.4 One calendar promise, two Suspense boundaries (R34)

The page creates the `readCalendarWindow(layers, today, today+7)` promise **without awaiting it** and passes the same promise to Today and Next 7 days, each awaiting inside its own `<Suspense>` **on the server** — one round of Google calls, two independently streaming tiles. **The fallback is the tile at full size with border, ground and eyebrow** (and Today's date, which needs no feed) **and no sentence, no count, no stamp, no control** — an unanswered read is not a measured emptiness.

**Phase 2 is skipped entirely when phase 1 failed.** Phase 1 is one deadline-bounded Mongo `Promise.all`: settings, open to-dos, done to-dos, *LastDigest*, the dispatcher run. Skipping keeps `Couldn't load layers, so the calendar wasn't read.` distinct from `Couldn't read the calendar.`

### 7.5 The layout store (R35)

`validateLayout` **strict on write**: four rows; every tile in `PERSONAL_TILES` exactly once; every span an integer 2–12; every row summing to ≤ 12. Anything else is a 400 with a typed message. `resolvePersonalLayout` **total on read**, with the P11 clause — a six-tile layout resolved against a seven-tile default keeps all six placements, **asserted in the test before P11 exists**. `PERSONAL_ROWS` exported once.

**`personalLayout.ts` is pure, is imported by a client component, and may never import a model, `server-only` or `next/headers`.** It holds `clampSpan`, `collapseRow`, `compactRows`, `buildCells`, `buildTracks`. **Every number passes through one clamping, unit-tested `buildCells`.**

`OsSettings.personalLayout` and `layers` are typed sub-schemas with `_id:false`, bounds and enums; `OS_SETTINGS_DEFAULTS` gets `readonly` arrays and `readOsSettings` copies on read; `ALLOWED_KEYS` is derived from a typed record. **Last-write-wins on the `layers` array from two devices is accepted and recorded.** **Two `Todo` indexes, two queries** — the third, `{section:1,done:1,dueOn:1}`, is **cut**, because the per-section query it existed for does not exist: the tile shows all three sections together and grouping happens in the pure layer. Index creation joins *What needs Riku's hands* (`npm run migrate:indexes`, then `:apply`).

### 7.6 Google (R24, R36, R37)

**The OAuth bootstrap is `scripts/google-auth.mts` on a loopback port; the two routes and `ALLOW_OAUTH_BOOTSTRAP` are dropped.** `__Host-session` is `sameSite:"strict"` and `proxy.ts` fails closed, so Google's cross-site redirect back to an app route arrives **cookieless** and 401s before the handler runs — the ported pair could not have worked. The script is a throwaway `http.createServer` on 8787: print the consent URL, exchange the code, print the refresh token once, exit. No allowlist entry, no flag, no production redirect URI, **no route to protect**, and two fewer manual steps. **The one registered redirect URI is `http://localhost:8787/callback`.** `package.json`'s `dev` becomes `next dev -p 3001` regardless, because ShikksTracker holds 3000.

**The client.** `readGoogleConfig(env)` names missing **variables**, never values. A cached token **promise** on `global`, cleared on rejection. `DOMException.name === "TimeoutError"` matched **by name**. `GOOGLE_TIMEOUT_MS = 5000` on every call through `AbortSignal`. `GoogleError.kind` is `not-configured` · `expired` · `timeout` · `gone` · `http`.

**Reads are paginated to a stated ceiling (R24).** `listEvents` follows `nextPageToken` to **three pages per layer per window**, and **a layer still truncated at the ceiling is reported as that layer's failure** (`Couldn't read Classes.`), never as a quiet day — a `maxResults` cap with nothing said about what it cut is exactly the failure the deck's constraint 2 forbids. `listCalendars` is paginated the same way. **A `404` on a stored layer is `GoogleError("gone")`** and renders per R42 (§4.10).

```ts
type CalendarWindow =
  | { ok: true; events: CalendarEvent[]; failed: string[] }
  | { ok: false; reason: "none-enabled" | "not-configured" | "expired" | "timeout" };
```

**`none-enabled` is decided before any token fetch** — no HTTP at all when every layer is off, because that is a configuration state and not a failed read (R20, R45). A `401` clears the cached token and retries **once**; a second `401` is `expired`.

**Writing.** `POST /api/calendar/events`, validated at the top: `title` 1–200, **`calendarId` must be one of the stored layers**, `dayKey` well-formed, `allDay` boolean, else `start < end` as `HH:MM`. No local write, so there is no half-state and nothing to sweep.

### 7.7 `heroTint` — the pure function and the frozen table

```ts
// personalView.ts (pure). Anchors are the constants Riku can move.
export type HeroTint = 0|1|2|3|4|5|6|7|8;
export function heroTint(pending: number | null): HeroTint | null;
```

- **`null` in → `null` out.** The to-do read did not answer, so the page has no count and the hero claims nothing (R83).
- **Clamped at 8.** `pending` of 9, 40 or `Infinity` all return 8.
- **Not a float, not negative, not `NaN`.** Anything that is not a non-negative integer returns `null` — and even if a bad value escaped, `.pe-t{bad}` matches no rule and renders the untinted hero, which is the safe render (R80, R3's reasoning).
- **One field in the view model, never two booleans.** `heroTint: 0|1|…|8 | null`, so two flags can never disagree. **`PERSONAL_HERO_BUSY_AT = 4` is deleted** — ~~R73's single-threshold constant~~ → **R80's anchor table.**
- **The anchors — 0, 3, 8 — are the frozen table** and the numbers Riku can change. Changing one is a table edit plus nine regenerated literals, not a code change.

### 7.8 The morning route and the push (R22, R23, R37)

Inside the dispatcher job, **before `composeDigest`**: read `layers`, read the Manila day's events for enabled layers, read open to-dos due within 3 days and overdue. **Both new reads are caught into `"unavailable"` and logged, never thrown.** `composeTodayLine` is pure and produces the deck's forms (§10) **plus the partial form** — *some layers answered, one did not* names what arrived and then names the calendar that was not read, and the miss is counted in the problems, so **the title never says all clear over a blind spot** (R23). `Overdue:` is omitted under a failed to-do read and the omission is covered by `Due: to-dos unavailable.`

**Problem fragments are lowercase with no terminal stop.** `digest.ts` joins fragments and `end()` adds the stop, so the deck's `Calendar check unavailable.` is the **rendered** form, not the fragment as written (R23, deck §10).

**`buildPushPayload`'s body bound rises to 320 for every push**, and its test moves with it.

***LastDigest*, and three mechanisms that make the push tile honest (R22).** The write sits **after** the `delivery.sent === 0` guard — nothing is recorded as sent that was not — is **wrapped so it cannot throw**, and stores **`buildPushPayload`'s sliced output**, not `composeDigest`'s, so a 321-character body cannot manufacture the very state the tile reports. On failure the dispatcher's `AgentRun` carries `itemsFailed: 1`, which the rail already renders as degraded that same morning and which **tomorrow's** watchdog names in the push. **The design doc's claim that the failure is named in *that* morning's problems line is struck by name** — the push has already been composed by then.

---

## 8. Tests to pin

Logic layer under `src/lib/__tests__/`, Vitest, pure, no database and no network; the Google module is one import tests replace. Route handlers stay thin.

**`heroTint.test.ts` *(new)* — the ramp, because nine frozen states are exactly the kind of thing a refactor silently re-derives.**
- `0 → 0`, `3 → 3`, `8 → 8`; `1,2 → 1,2`; `4..7 → 4..7`.
- **`9, 40, 1e9 → 8`** (clamped).
- **`null → null`**, and that is the only way to get `null` from a successful read.
- `-1`, `1.5`, `NaN` → `null`.
- The returned value is **one field**, and there is no boolean pair anywhere in the view model.
- **`pending` excludes events**: a day with ten scheduled events and nothing due is `0`.
- **An overdue to-do counts as one** (R85): one overdue item, nothing else due → `1`, not `8`.

**`layout.test.ts`** — `validateLayout` accepts the default and rejects a missing tile, a duplicate, a span of 1 or 13, a row over 12, three rows. `collapseRow` against `[3,9]`, `[5,7]`, **`[3,3,5] → 7`**, `[3,3,3,3] → [2,2,1,1]` and the six-span-2 row it must leave **untouched**. `resolvePersonalLayout` total on read, **including the P11 clause** (six tiles against a seven-tile default keeps all six). `buildTracks` compacts empty rows, renumbers, emits `auto` for a shrinking row and `minmax(calc(Wpx + var(--tb)), auto)` otherwise. `buildCells` clamps every number.

**`personalView.test.ts`** — Today and week view models: empty, one layer failed, all failed, `not-configured`, `expired`, `none-enabled`, to-dos unavailable, and the 20-row bounds with their `Showing 20 of 34.` strings. **`0 open` above a failed read is unrepresentable** (the type, not an assertion about behaviour). **`—` is unreachable for an unread day** — `DayRowView`'s two variants, pinned. **Nothing is truncated inside a day**, however many items it holds: ~~the per-day 8-item cap and its `+N more`~~ → **R51b**, so what the test pins there is the opposite of what it used to (R86 §I item 4). A day with 2+ items produces the disclosure shape; a day with 1 produces the plain shape; a day with 0 produces the dash; **`N items` never reads `1 items`.**

**`todos.test.ts`** — `sortTodos` order, due-chip labels, overdue days, the 3-day digest window at day boundaries.

**`days.test.ts`** — Manila day keys around midnight UTC, `addDays`, `daysBetween`, `formatDay`.

**`digest.test.ts`** — `composeTodayLine`'s forms, **the partial-calendar form**, placement second in the body, `"unavailable"` adding to the problems **and to the title's count**, the **lowercase fragment** rule, the 320 bound, the quiet-morning line.

**`google.test.ts`** — error-kind mapping (`invalid_grant` → `expired`, abort → `timeout`, `404` → `gone`, 4xx → `http` with a bounded message), the single `401` retry, **and the three-page pagination ceiling reporting that layer's failure rather than a short list**.

---

## 9. Verification before "done"

`CLAUDE.md`'s trio, quoted exactly:

> `npm test` (Vitest, logic layer) + `npx tsc --noEmit` + `npm run build` — all green before claiming completion — and `npm run lint` at its recorded baseline (four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, on which it exits 1); a fifth error or a fourth warning fails the step.

**The five new islands must not add a fifth error.** No `useEffect` in any of them (R33) is the mechanism that keeps that true, not care.

**And the phase's own bar, which no test can meet.** From the design doc and the roadmap: `/personal` live on Vercel reading Riku's real calendars and his real to-dos, **and one real morning push that has named what was actually due and scheduled that day.** `CLAUDE.md`: *an agent feature is actually done when it has been observed doing its job once against real data.*

**Riku's hands, in order, each surfaced when it blocks** (design doc, *What needs Riku's hands*): Google Cloud (enable the Calendar API, a second OAuth client, **one** redirect URI `http://localhost:8787/callback`, the two scopes, **Publishing status: In production** — Testing kills the token every 7 days); `.env.local` + `scripts/google-auth.mts`; the three `GOOGLE_*` variables on Vercel and a redeploy; `npm run migrate:indexes` then `:apply`; tick Personal, Classes and Events under *Calendar layers*; **open both forms on his phone at the shell width he chose and confirm the date field fits** (R40 — the floor was measured in Chrome on Windows; a floor that is too generous overflows the well on his device, and that is the failure that does not announce itself); wait for one 07:00 push.

---

## 10. Open items carried forward

1. **The phone threshold is not a number anywhere.** S20 and R50 say "below the phone threshold"; the mockup draws the strip in a fixed 390px frame because its constraints forbid `@media`. The shell is app-wide, so it needs a real breakpoint (and a mechanism for hiding the agent badges at that width). **Unmeasured — do not invent one; put it to the lead or to Riku with two candidates drawn.**
2. **`3d late` at 106px.** Specimen 01's three 1-of-6 hero panes render the due meta as `3d late` / `5d late`. The deck says `3 days late` · singular `1 day late`, at every width, and **no ruling introduces an abbreviated form**. The deck wins: **ship `3 days late`.** Flagged because three panes of the mockup disagree with it and someone will read them as the spec.
3. **`.pe-more` has no consumer** (§5.11). Drop it, or find it a bound. One line either way.
4. **R64's cross-column slack.** Drawn in specimen 02 (`Mon 26` open beside a closed, shorter `Thu 22`) and deliberately not fixed. If it reads as a defect, the fix is `align-items: start` on the paired cells, once — **a ruling, not a tidy**.
5. **`N items` is a proposed string that never reached Riku.** R59 proposed it; R54 ratified the eleven **before** R56–R69 existed, and deck §15 does not carry it. It is one word of format; put it to him with the next thing he reads.
6. **Two of R65's four busy-week heights are still unmeasured.** Measured and recorded: the collapsed busy week is **240px** at two columns (specimen 02 — converging exactly on the floor R51 set on the *blank* week, an unplanned finding) and **362.75px** at one column (specimen 05, barely moved by the collapse because at 706px the day rows were already single-line). **Drawn but not captioned with a figure:** the fully-open busy week at either column count, and the mixed open/closed week — which is the state Riku will actually see most often. Do not derive them; measure them.
7. **Whether a two-tile sparse row still shrinks.** R5 said "tiles summing to fewer than 6 columns"; R53 and the corrected deck and design doc say "a row whose only occupant is one tile narrower than the row". **The newest wins, so a row holding two tiles summing to 5 of 12 keeps its weight** — recorded because R5's broader wording is still in its file.
8. **The design doc still says row 2's blank Layers tile measures 197.85px.** The fixed mockup measures **191.85px**, because M2/R38 made the 12px padding fire at span 3. **The weight stays 200 as R39 ruled it** (191.85 > 180 still), but the two documents disagree on the figure by 6px.
9. **The 920px column.** The bento was specified without a width and 920 is inherited. If the hero at span 8 (608.67px) proves cramped for a timed-event row, widening `--content-max` is a **system** change that also widens Freelance — **raise it with Riku, do not change it quietly.**
10. **P8's carry-forwards this phase touches and does not close.** The phone pass (S20 is a stopgap, not a design); `env(safe-area-inset-*)`, still dropped; the Queue view's 10px offset; `/settings` having no heading of any level — a page that now gains **two** cards under no title.
11. **`+ Event`'s default calendar** is the first enabled layer. If Riku wants a fixed default it is one more settings field; **do not add it speculatively.**
12. **Ticking in Today and the week** re-reads only the to-do tiles, not Google. Confirm the island boundaries allow that without a full reload; a reload is acceptable and cheaper than a client-side store.
13. **The Classes layer and P11.** Canvas will populate it later. Nothing here assumes that calendar is empty or full, and the plan should not either.

---

## 11. Every supersession, in one table

A builder who finds the old ruling in an old paper reads this table and stops.

| Superseded | By | What changed |
|---|---|---|
| **R8** — hero hueless: `#171B21`, `--ink-4` border, feature radius | **R52**, then **R79** | the hero is tinted by state. **Surviving from R8:** the feature radius, the untinted render's ground and border (now one meaning only), the honest-render principle. Its four drawn alternatives (a)–(d) are closed and their CSS retired |
| **R52** — two tinted states, threshold at four or more | **R79** | a nine-step ramp: green 0, orange 3, red 8, clamped. **Surviving:** that the hero is tinted by state at all |
| **R70–R72** — two recipes, `.is-clear`/`.is-busy`, a shared "1–3 or unknown" render | **R79–R83** | three anchors and nine frozen classes; `.is-clear`/`.is-busy` retired; the untinted render narrowed to one meaning |
| **R72** — untinted = "a few" **or** "unknown" | **R83** | untinted means exactly one thing: the to-do read did not answer |
| **R71** — border takes the hue at `.2`, three colours | **R82** | the border interpolates across all nine; ten colours; the radius still never moves |
| **R76** — `tokens.css` and DESIGN-INSPO wording, two tokens | **R84** | R84's exact text, three tokens, and wash-versus-ink stated as a **rule** |
| **R73** — `PERSONAL_HERO_BUSY_AT = 4`; `heroTint: "clear"\|"busy"\|null` | **R80** | the constant is deleted; the anchor table replaces it; `heroTint: 0..8 \| null` |
| **R73's overdue flag** — a one-line `OR` likely wanted | **R85** (Riku: *"No — it just counts as one."*) | closed, declined, not carried forward |
| **R4** — row 2 = 180 | **R39** | **200**; the 44px switch floor is why |
| **R6** — 12px padding below 200px | **R38** | below **240px**; the well's padding drops with it; R11's 200 for the head stands |
| **R5** — sparse = "tiles summing to fewer than 6 columns" | **R53** | "a row whose only occupant is one tile narrower than the row"; R5's edit-mode suspension survives |
| **R7** — "not usable at that width until the shell has a phone form" | **R50 / S20** | the shell has a provisional phone form; the 164px stack is kept drawn as what it replaces |
| **R9 item 4** — "a tile-foot sentence" | **R49** | "a sentence under a tile's head"; R16 governs place, R9 hue |
| **R9** — hue in exactly four places | **R84** | a fifth **place** (the hero's wash); the four **ink** places stay four |
| **R13** — `.tag.is-layer{max-width:11ch}` | **M5** | `calc(11ch + 20px)` — eleven characters *of name* |
| **R13** — one-line rows | **R38 / S2 / R47** | two-line in the narrow band; `.pe-due{min-width:64px}` above 480; no empty cells |
| **R24** — vanished calendar "must not share `try again later`'s register" | **R42** | `.fl-empty`, no dot, row kept in the picker |
| **R25** — `.pe-tick`, `inset:-13px -6px -13px -13px` | **R41 / R46** | `.tick`, `inset:-13px` → 40×40 |
| **R27** — `.pe-form`, `.pe-sel` | **R46** | `.formwell`, `.sel` |
| **R28** — pairs ≥280; floor ≈96; "nothing moves at the default" | **R40** | pairs at **406px** of tile; floor **213px**; the event form grows row 1 to 421.35 and **that is** the ruled "grows its row when it must" |
| **R2/R6/R11/R13/R15/R28/R29** — thresholds as content widths | **M2** | the container is the **cell**; every number is the tile's border-box width |
| **R30** — "nothing shifts" | **M6** | true only with `.fl > .pe-edit`'s margin rule; **measured** equal in specimens 01 and 04 |
| **R32** — shared controls under `pe-` | **R46** | reference-style names, eight items plus `.tag.is-layer` and `.btn.hi` |
| **R18** — a day prints `—` only when every source answered | **R45** | `none-enabled` counts as answered, so all-layers-off days print `—` legitimately |
| **Round 3's "native `<details>` nowhere"** | **R56 / R69** | `<details>` in exactly one place — the day row, at 2+ items. Nothing else by extension |
| **Deck Tile 5's 8-item / `+3 more` bound** | **R51b** | superseded for the open state: an opened day shows every item |
| **Deck §5's "row heights whatever tiles sit in them"** | **R53** | one exception, already written into the deck |
| **Deck §11's seven `Fri 11 — … Thu 17 —` rows** | **R18** | deleted with Riku's nod; the row keeps its weight |
| **The design doc's "there is no in-flight status to sweep"** | **R86 §I item 4** | a done to-do holding a `calendarEventId` is exactly that state, and the Done row is its surface |
| **The design doc's "the failure is named in that morning's push"** | **R22** | struck by name; tomorrow's watchdog names it |
| **`GET /api/google/status`** | **R24** | cut; the Settings page derives both cards from one `listCalendars()` |
| **The two OAuth bootstrap routes and `ALLOW_OAUTH_BOOTSTRAP`** | **R36** | `scripts/google-auth.mts` on loopback 8787; one redirect URI |
| **The third `Todo` index** | **R35 / R86 §I item 3** | two indexes, two queries |
| **The design doc's 760px and 480px viewport breakpoints** | **R2** | container queries on the grid's own width, 706 and 820 |
| **`collapseSpan`'s bare `ceil`** | **R1** | `collapseRow` — round up, then trim the widest entry |
| **The eleven strings living in the visual spec** | **R86 item 5** | they live in **deck §15**; this file quotes and points, never competes |
