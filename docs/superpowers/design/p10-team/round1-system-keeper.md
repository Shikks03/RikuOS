# P10 round 1 — System Keeper

**Role:** guardian of `docs/design/DESIGN-INSPO.md` and `docs/design/components.html`, and of the system as shipped in `src/styles/`.
**Standing question:** would the reference do this? Where it is silent, what would it do, built from parts it already has.
**Date:** 2026-09-11 · Written without reading any other round-1 paper. Every claim checked at HEAD `3fa055e`.
**Sources:** the brief · content deck · design doc · P8 visual spec §5 · `DESIGN-INSPO.md` · `components.html` · the four shipped stylesheets · `freelance/_blocks/*` · p8-team `round3-lead-rulings.md` and `round1-system-keeper.md` · `CLAUDE.md` · `ARCHITECTURE.md` §7.

---

## 1. Position

The reference already contains most of this page. `DESIGN-INSPO §5.11` *is* the calendar with toggleable layers, written as the RikuOS layer from the source's parts, and it hands us the switch verbatim (`.swx`, `components.html:475–478`), the layer-row grammar, the "today" treatment and an explicit escape clause on layer colour. `components.html:483` hands us a 24×24 square icon button, which is the entire edit-mode toolbar. `legacy.css`'s `input`/`label` block hands us the form fields and `§6.1` already ruled their voice. `pre.body` inside `.card` on `/freelance/queue` is a shipped precedent for a recessed well inside a bordered object, which is the in-place form. So this page needs **five genuinely new things** — the tile itself, a tick box, a dashed empty cell, an editing ground, and a stepper assembled from two existing recipes — and **five additions to visual spec §5.3**, four of them promotions rather than inventions. Everything else hangs off `DESIGN-INSPO §1.4` / visual spec `§5.5`: *nothing nests more than one card deep*. Six tiles are six real objects and they are this page's only card level; every row, group, sentence, form and toolbar inside a tile is hairlines, wells and ground. Break that once and the bento becomes cards-in-cards, the failure the reference names first. The second risk is hue inflation: Riku's spec says size carries hierarchy, and on today's measured data (deck §12) **the correct number of coloured things on this page is zero**. I rule that the hero takes no hue at all and that the one permitted accent stays in the bank.

---

## 2. The rule this page turns on: the tile is the card level, and the only one

`DESIGN-INSPO §1.4` — *"Only real objects get a border and a radius… Nothing nests more than one card deep."* Visual spec `§5.5` restates it as shipped. The design doc already calls a tile a real object.

```
 ┌─ .tile ───────────────────────── 1px --line, radius 14px, --raised
 │  TODAY                              + Event      ← .tl-head grid
 │  Thu 10 Sep
 │
 │  SCHEDULED                                       ← .tl-grp, mono 9px --ink-4
 │  09:00–10:50  Math Methods       Classes         ← hairline row, NO box
 │  ─────────────────────────────────────────
 │  13:00–13:20  Call with Nova …   Personal
 │
 │  DUE
 │  [ ] Pay tuition                 Personal
 └──────────────────────────────────────────────────
```

Three consequences, each a thing somebody will try to do and must not:

1. **A group inside a tile gets no border, no fill, no radius.** `SCHEDULED` and `DUE` are 28px apart (`--sp-6`, the `.fl-group` value at `components.css:407`), not separated by a rule or a panel. `components.css:383` explains why 28 and not 20: at 20px a group label reads as a second eyebrow.
2. **The in-place form is a recessed well, not a card.** A well is the inverse of a card — recessed ground plus a soft hairline, no raised fill — and the app ships one inside a card today: `pre.body` inside `.card` at `queue/page.tsx:132,150`. One well inside one card is the shipped depth limit.
3. **The empty cell is ground.** Riku's spec says it exists *"to break the last bit of symmetry"* — an object does not break symmetry, it completes it. A treated hole is a seventh tile with nothing in it, which is the one thing the empty cell is not.

**Tile radius: `--r-feature` 14px, not `--r-card` 10px.** `DESIGN-INSPO §3` gives 10px to *"plain cards (provider, integration)"* and 14px to *"feature cards (stat hero, skill, insight)"* — the objects a page is built out of. Six tiles at 10px reads as a settings page; `.stat` is 14px (`components.css:262`).

**Ground and padding:** `--raised`, `1px solid var(--line)`, `padding: 15px 16px` — `.stat`'s own top and sides, inside `DESIGN-INSPO §3`'s 14–16px band (`.stat`'s 18px bottom exists only because its figure is bottom-anchored). Inner widths follow (span − 32, on deck §2's 63.83px column and 14px gutter): span 2 → 109.7px · 3 → 187.5 · 4 → 265.3 · 8 → 576.7 · 12 → 888.

---

## 3. One tile-head grammar for all six tiles

The deck gives every tile the same three slots in different combinations: an eyebrow, an optional second line, an optional right-hand thing. That is `.fl-headrow` (`components.css:423`) with one changed value — `start`, not `end`, because the right-hand slot is a pill or a stamp sitting on the **eyebrow's** line, not on the bottom of a two-line left cell:

```css
.tl-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--sp-3);align-items:start}
```

| Tile | Left cell | Right cell |
|---|---|---|
| Today | `.eyebrow` TODAY + `.fl-h` `Thu 10 Sep` | `.btn` `+ Event` |
| To-do | `.eyebrow` TO-DO + `.fl-count` `0 open` | `.btn` `+ To-do` |
| Layers | `.eyebrow` LAYERS | — |
| Push | `.eyebrow` THIS MORNING'S PUSH | stamp `sent 07:00` |
| Next 7 days | `.eyebrow` NEXT 7 DAYS | — |
| Done this week | `.eyebrow` DONE THIS WEEK | `.fl-count` `3` |

All four recipes are §5.3 verbatim: `.eyebrow` mono 9.5px/`0.18em`/`--ink-3`; `.fl-h` display 600/19px/`-0.015em`, 5px under its eyebrow; `.fl-count` mono 10px `--ink-3` tabular; the health stamp 11px `--ink-3` tabular; `.btn` mono 9.5px/`0.14em` caps, `8px 14px`, radius 999.

**Two eyebrow levels, never three.** `.eyebrow` is a *tile's* name. Group labels inside a tile — `SCHEDULED`, `DUE`, `PERSONAL`, `FREELANCE`, `ACADEMICS` — take the next step §5.3 already defines: **mono 500 · 9px · `0.14em` · uppercase · `--ink-4`**, the `.fl-thead` type step minus its bottom rule. Call it `.tl-grp`. Not a new size, and it is the reference's own second-level mono label; the rail's `.grouplabel` (8.5px/`0.16em`) is the wrong pick because it carries `padding:0 9px` and belongs to a different container.

P8's Block D reused `.eyebrow` for group headings (`Approaches.tsx:100`), and that worked because a 19px `.fl-h` sat between the two. The To-do tile has no heading — the deck gives it none and I will not invent one — so `TO-DO` would sit ten pixels above `PERSONAL` at identical size and tracking, exactly the collision `components.css:383` warns about. The fix is the step down, not more space. One scoped override follows: `.tl-grp + .fl-empty{margin-top:var(--sp-3)}`, because `.fl-empty`'s 20px top margin was calibrated to sit under a 19px heading and under a 9px label it reads as a gap.

---

## 4. The six tiles, mapped

**[=]** carries over unchanged · **[v]** needs a variant · **[N]** genuinely new.

### 4.1 Today (hero)

- Head **[=]** `.tl-head` + `.eyebrow` + `.fl-h` + `.btn`. Groups **[=]** `.tl-grp`, 28px apart (`.fl-group`).
- Scheduled row **[v]** — `.fl-stage`'s grammar (hairline above each, none above the first; `components.css:343–348`) on `72px | minmax(0,1fr) | auto`, `gap:var(--sp-4)`, `align-items:baseline`. The **72px time track** holds `13:00–13:20` and `all day` at mono 9.5px tabular with room; ink `--ink-3`, not `.pwhen`'s `--ink-4`, because a start time is data the eye scans down, not meta. Title `.fl-trow .nm` **[=]** with `nowrap` + `text-overflow:ellipsis` (the deck's "cut with an ellipsis, never wrapped"), linking out through `.fl-biz` (`components.css:432`) — the shipped recipe for a name that leaves the app, `border-bottom:0` against base.css's anchor hairline plus the persistent `↗` in a `.arr` span (R36). **The row is not an anchor**, exactly as R12 ruled for Block E.
- Due row **[v]** — `auto | minmax(0,1fr) | auto | auto`: tick box, title, section tag, lateness.
- Empty **[=]** `.fl-empty` 13px `--ink-3`, left-aligned where content lives (R12: never centred, never in a dashed box, never with an action pill). Every couldn't-read state **[=]** `.fl-fail` (§6.2). Bound **[=]** `.fl-bound`.

**Row stacking.** At span 8 the three tracks leave 409px for a title; at span 4, 97px; at span 3, 15.5px. So **at span ≤ 3 the row goes two-line — time and tag on one mono line, title beneath.** That is `DESIGN-INSPO §7.1`'s own prescribed fix for the usage and pipeline rows. Key it off the span class the server already emits, not a third breakpoint.

### 4.2 To-do

- Head **[=]**; three `.tl-grp` labels always present, 28px apart. Row **[v]** — `auto | minmax(0,1fr) | auto | auto`: tick box, title, due meta, `on calendar`; hairline grammar as above. `nothing open` **[=]** `.fl-empty`, and it is lowercase in the deck and stays lowercase (`DESIGN-INSPO §5.9`, *"an ambient state, not a label"*). `Couldn't load to-dos.` **[=]** `.fl-fail`.
- Tapping the row opens the edit form, so the row is a `<button>` wrapping everything except the tick box, styled to inherit — no hover lift, no chevron. R12's "a row is not an anchor" concerns *leaving the app*; this row does not leave.

### 4.3 Layers — a port, not a design

`DESIGN-INSPO §5.11`'s legend is this list. `components.html:469–478`:

```css
.layer{display:flex;align-items:center;gap:9px;padding:8px 0;border-top:1px solid var(--line-soft)}
.layer:nth-of-type(1){border-top:0}
.layer .nm{font-size:12.5px;color:var(--ink-2)}
```

Take it verbatim **[=]**, minus the `i` colour dot (§6.3) and minus `.ct` (no per-layer count here — see *What I would cut*). One change: `color:var(--ink-4)` on an off row's name rather than the reference's `opacity:.35`. `--ink-2` `#98A1AD` at 35% over `--raised` computes to ≈`#3A4149`, which is `--ink-4` `#3A424C` to within a point — the trick and the ink ladder already agree, and the token keeps one system instead of two.

`Couldn't save.` **[=]** `.fl-note` (a measured failure with a remedy — not `.fl-absent`). `No calendars chosen…` **[=]** `.fl-empty`. `Couldn't load layers.` **[=]** `.fl-fail`.

At span 3 the switch (26) + gap (9) leaves 152px for the name; at span 2, 74.7px — `Personal` fits at ~47px, `Holidays in Philippines` truncates. Acceptable, but it must be `text-overflow:ellipsis` and never a wrap, or the row heights stop matching.

### 4.4 This morning's push

A message quoted back to its reader. `§6.1`'s ruling on `pre.body` is directly on point: *"rendering Riku's own outgoing message in JetBrains Mono would make him read it as machine output."* A push is machine output but it is **addressed to Riku in sentences**. Body face.

| Part | Recipe | |
|---|---|---|
| Stamp `sent 07:00` | 11px `--ink-3` tabular, right cell of `.tl-head` | **[=]** §5.3 |
| Title `All clear · 0 to review` | body 600 · 13px · `--ink` | **[=]** `.fl-trow .nm` / `DESIGN-INSPO §3` "card title" |
| Body | `.fl-snip` 12.5px `--ink-2` | **[=]** — `.fl-snip` *is* "a quoted snippet of a message" |
| `No push this morning.` | `.fl-empty` | **[=]** |
| `Last: Tue 9 Sep 07:00` + that push's text | the `pre.body` well | **[v]** |

**The one variant, and the reason.** Normally the quoted push needs no container: the tile *is* the container. In the `No push this morning.` state the tile reports a fact and then quotes something *else*, and a quotation inside a report wants edges — `pre.body`'s box, values verbatim.

**No hue on this tile, ever, including when the push it quotes reports problems.** `1 problem · 2 to review` stays `--ink`. This tile quotes; it does not evaluate. Colouring a quotation is an editorial act, and R8 reserved red on Freelance for the one surface that must be unmissable. On this page that surface does not exist and the tile must not invent it.

**Width:** two lines at span 8, ~4 at span 4, ~10 at span 2, and the row grows. **A tile never clamps or hides content because Riku made it narrow.** No `+N more` on a quotation.

### 4.5 Next 7 days

- Day row **[v]** — `.fl-stage`'s hairline grammar on `56px | minmax(0,1fr)`. 56px holds `Thu 17` at mono 9.5px tabular (≈34px) with room; `--ink-3`, tabular, so the seven labels form a true column. Items within a day wrap as a flex row of `time · title · layer` groups at 13px `--ink-2`; to-do items carry a tick box.
- Empty day `—` **[=]** `.fl-trow .dash` `--ink-4` (`components.css:406`). `+3 more` **[=]** `.fl-bound`'s ink and size, inline at the end of the day. The two failure sentences sit at the **top of the tile**, above the day list, per the deck; register `.fl-fail`.

**One reference conflict I have to resolve, and the Honesty Critic will care.** `DESIGN-INSPO §5.14` rule 3: *"An em-dash means nothing was measured."* An empty day here **was** measured. The two meanings only stay apart because the deck puts the couldn't-read sentence at the top of the tile and drops events from the days, so a `—` never appears under a failed read. **That sentence is load-bearing for the em-dash's honesty** — drop it and seven em-dashes become a lie. Record it in the spec beside the `—`.

### 4.6 Done this week

- Row **[v]** — `auto | minmax(0,1fr) | auto | auto`: ticked box, title, section tag, `Mon 8`. The ticked box is quiet: `--line` border, `--ink-3` check; twenty of them must not shout.
- Empty **[v]** — the deck renders it inline: `DONE THIS WEEK   Nothing ticked off yet this week.` I endorse it, and it needs one variant: when empty, the head becomes a two-track baseline grid (`auto minmax(0,1fr)`, `gap:var(--sp-5)`), eyebrow left, sentence right of it. **This is the empty form only**; with rows it is a normal stacked tile. Two forms, and the deck asked for both.

---

## 5. The vocabulary the system lacks, derived

### 5.1 Switch — ported, not new

`components.html:475–478`, `DESIGN-INSPO §5.11`. 26×15px, radius 999, track `#141820`, `1px var(--line)`; 9px knob at `top:2px;left:2px` in `--ink-4`; on → `border-color:currentColor`, `background:rgba(255,255,255,.05)`, knob to `left:13px` and `currentColor`.

The load-bearing word is `currentColor`: the reference wrote it so the *row* supplies the hue. Declining layer hues (§6.3), the row supplies `--ink`. **On = near-white border and knob; off = `--line` border, `--ink-4` knob.** A contrast step, not a hue spend — and a 9px dot, not a solid fill, so `§5.10`'s one-solid-fill ration is untouched. Disabled while saving: `.btn:disabled`'s `opacity:.45;cursor:not-allowed`. One recipe, three consumers: the Layers tile and the two form switches.

### 5.2 Tick box — **[N] genuinely new**

Nothing in the reference ticks. Built from parts:

- **Box:** 14px square (`--sp-4`), `1px solid var(--line)`, `--sunk` fill, radius **3px**. Not 6px: `DESIGN-INSPO §3` says 6px is for *tags — "they're labels, not controls"*, and this is a control. 3px is the reference's own small-square radius (`.ev`, `components.html:493`). No new radius.
- **Ticked:** never a fill. `§5.10` rations solid fills to one per screen and Done this week alone would put twenty on the page. Ticked = an 8px `currentColor` check at `stroke-width:1.8` — the nav glyphs' stroke weight (R15) — border to `--ink-4`.
- **Hit target:** the drawn size and the touch size are different numbers and only the first is a design decision. `<button>` with `padding:8px;margin:-8px` gives 30px, and the row's 11px vertical padding takes the vertical target past 44px. Geometry the page already has.
- **No busy state.** The deck says only forms and switches have busy states; ticking removes the row at once.

### 5.3 Stepper and arrows — assembled, zero new sizes

`−`, `+`, `←`, `→`, `↑`, `↓` are all `components.html:483`'s square icon button: `24×24; border-radius:7px; background:none; border:1px solid var(--line); color:var(--ink-3); display:grid; place-items:center; font-size:10px; padding:0`. Radius 7 is `--r-nav`. The stepper's number is `.fl-stage .ct` (`components.css:350`) — display 600 · 15px · `--ink` · tabular, §5.3's "Pipeline count" — with `min-width:22px;text-align:center` so 8 → 12 does not shift the buttons; a disabled `+` on a full row takes `.btn:disabled`'s values.

Arrow glyphs as literal characters in the mono face. Precedent: `↗` ships as a literal in `.fl-biz .arr` under R36, and U+2190–2193 have no emoji presentation by default, so R13's objection to `⚠` does not apply — but check it on a phone, because that objection was found by looking, not reasoning.

### 5.4 The edit-mode toolbar

**The tile's foot, never its head.** The head is the tile's identity and already carries the tile's own control. A foot toolbar is `.course .foot`'s shipped shape (`components.html:518`): `border-top:1px solid var(--line-soft); margin-top:12px; padding-top:11px`.

```
 ←  →  ↑  ↓        −  8  +          2 columns left
```

`display:flex; flex-wrap:wrap; gap:var(--sp-1)`, caption on `flex-basis:100%` so it always takes its own line. At the narrowest legal span: four arrows at 24 + three 4px gaps = 108px against 109.7px of inner width — it fits by 1.7px, and the stepper (24+22+24+8 = 78px) drops to line two. Caption = `.pwhen`'s recipe. Toolbar height ≈69px plus its rule; rows grow, nothing clips.

### 5.5 Text, date and time fields, and the select

The recipe comes from `legacy.css`'s `input,textarea` block — §8 for why the recipe is legitimate and the file is not:

```css
.fld{font-family:var(--body);font-size:13px;width:100%;padding:8px 10px;
     background:#101318;border:1px solid var(--line);border-radius:var(--r-chip);
     color:var(--ink);caret-color:var(--spend)}
.fld-l{display:block;font-size:12px;color:var(--ink-3);margin-bottom:4px}
```

- `caret-color:var(--spend)` stays: a text cursor is the same class of thing as the focus ring, which `base.css` annotates as *"a reference-level convention, not a hue spend"*. The label is sentence case, not mono caps — `§6.1`, *"it addresses a person"*.
- `type="date"` and `type="time"` use the **native** pickers. House style, not a shortcut: `§5.6` chose native `<details>`/`<summary>` on exactly these grounds — *"zero client JavaScript, correct keyboard behaviour… nothing to break under hydration"* — and a native picker is the only genuinely one-handed date entry on a phone. `base.css`'s `html{color-scheme:dark}` exists so the browser paints these dark; the mockup must show `::-webkit-calendar-picker-indicator` at readable contrast or the spec carries a filter for it.
- **`Section` is `.segmented`, not a select.** Personal / Freelance / Academics is a set closed by the schema enum, and the reference's control for a small closed set is the view switch (`DESIGN-INSPO §5.3`, shipped at `components.css:216–253`). Three tabs ≈240px, inside the To-do tile's 265px at span 4. **`Calendar` *is* a select**, styled as `.fld` — a set Riku controls, 1–10 arbitrary names. Two controls for two kinds of set, worth writing down so nobody unifies them later. Do not `appearance:none` and hand-draw a chevron: the option list stays native regardless.

### 5.6 The form in place — a well, not a card

```css
.tl-form{background:var(--sunk);border:1px solid var(--line-soft);
         border-radius:var(--r-chip);padding:var(--sp-4)}
```

Every value is `pre.body`'s. The tile is raised, the form is sunk into it, no second border, one card deep.

**It replaces the tile's body rather than adding to it** — that is what keeps the deck's "without moving the grid" promise. On the default arrangement: the event form's six fields pair onto four rows at 576.7px of inner width (`Date`/`All day`, `Start`/`End`), ≈260px + 33px of buttons + 28px of well padding = **321px**, inside row 1's 340px minimum; the to-do form's four fields ≈240px, shorter than the six-row blank list it replaces. Neither moves the grid. Below span 4 the pairs unstack and both grow the row — legal (rows are minimums) and honest.

Buttons `Add` · `Cancel` as `.btn`. **`Add` is not `.btn.go`.** `.btn.go` is declared-but-unused vocabulary (`components.css:499`) and `DESIGN-INSPO §5.7` defines the affirmative as *accepting a proposal the system made*. Riku adding his own to-do accepts no proposal — there is none — and green would claim the machine suggested it. Leave `.btn.go` unspent for the Approval Queue's S11 rebuild, which is a page of proposals. Validation and failure sentences take `legacy.css`'s `.error` register — `--missing`, 12.5px, **no box** (`§6.1`); `Delete "Renew ID"?` uses `button.danger`'s recipe (`rgba(248,113,113,.4)` border, `#F5A5A5` label, never a solid fill), in the same well.

### 5.7 The dashed empty cell — **[N]**

`1px dashed var(--line)`, radius `--r-feature` 14px so it reads as room for a *tile*, **no fill**, no caption. Edit mode only; in normal view the cell renders nothing at all.

### 5.8 Edit mode as a mode — **[N], one ground change**

Dashed cells and six foot toolbars already say a great deal. Two more signals, both free:

1. **Three pills where there was one.** `Save` takes `legacy.css`'s high-emphasis pill (`--ink-4` border, `--ink` label), `Cancel` and `Reset to default` the resting pill (`--line` / `--ink-3`) — R18's ladder, already the app's Approve/Edit/Cancel grammar.
2. **The grid sits in a `--panel` well.** `--panel` `#0E1013` is defined in `DESIGN-INSPO §2` as *"section wells"* and has no consumer today; editing is the one time the surface under the tiles is the thing being worked on. Geometry must not shift when the mode opens, so the well carries compensating margin — `padding:var(--sp-4); margin:calc(-1 * var(--sp-4)); border-radius:var(--r-feature)`. One rule, zero movement, a genuinely different ground.

**No hue in edit mode.** Tempting to tint the grid the way `§5.7` tints the insight card, but that tint is violet, violet means *judgement*, and its stated reason is *"the only place the system speaks rather than reports"*. In edit mode the system is neither speaking nor reporting; Riku is.

### 5.9 The layer tag — a variant, and the reason matters

`.tag` is `text-transform:uppercase` (`components.css:502`), and uppercasing `Holidays in Philippines` transforms *Riku's* data. `DESIGN-INSPO §2`'s rule is mono caps for what **the system** names, sentence case for what addresses the person — and a Google calendar's name is a name Riku gave. The reference already has a de-capsed mono treatment, `.scale-row .k em` (`components.html:425`):

```css
.tag.is-layer{text-transform:none;letter-spacing:.04em;font-size:10px;
              max-width:11ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
```

Same box (5px 10px, `--r-tag` 6px, `--line`, `--ink-3`); 10px mono is §5.3's `.fl-count` size. No new size, no new radius, one variant.

`on calendar` is the opposite case: `DESIGN-INSPO §5.9` — *"a lowercase word. Lowercase matters: it's an ambient state, not a label."* Lowercase, body face, 11px `--ink-3`, **no box at all**. It is a state of the row, not a category.

### 5.10 The due meta and the lateness

The deck calls these "due chips". A chip is a box; the deck's words are strings and the visual is ours. **They are not boxes.** `components.css:442` ships the pattern — `.pwhen.is-stale{color:var(--stale)}`, a waiting line that changes ink when a duration has gone wrong, no box (R12) — and `3 days late` is the same fact. One recipe, two inks: `today` · `tomorrow` · `Fri 12` · `24 Sep` at mono 9.5px tabular `--ink-3`, right-aligned; `3 days late` the same, in `--missing`. The **only** difference between a due date and an overdue one is the ink, which is `DESIGN-INSPO §1.1` working as designed. A chip would put six red boxes on a bad week — R8's loud-thing inflation, on the page meant to be calm.

---

## 6. Hue: exactly where it lands, and where it must not

### 6.1 The hero takes no hue

Riku's spec says two things in consecutive sentences: *"Hierarchy is carried by size alone… nothing needs an accent color or badge to signal priority"* and *"Accent color is reserved for the hero and for real state."* The second is a **reservation, not a requirement** — the hero is the only tile *allowed* an accent, not one that must have one. A permanent accent also fails the reference's own test: `§5.14` rule 2, *"Colour means 'there is a signal here.' No data means no signal"*, and `§5.5`, *"at 0% the number goes `--ink-3` rather than the hue — nothing is happening, so nothing lights up."* On deck §12 the hero says `Nothing scheduled.` and `Nothing due.` A lit `TODAY` over that is colour claiming a signal that is not there.

**So the hero is marked without hue, by the reference's own idiom for "this is the current one":**

```css
.tile.is-today{background:#171B21;box-shadow:inset 0 0 0 1px var(--line)}
```

`DESIGN-INSPO §4`: *"The active item gets a raised fill (`#171B21`) plus an inset hairline — never a left accent bar."* `DESIGN-INSPO §5.11`, on the calendar's today cell: *"Today reuses the exact active-nav treatment — raised fill `#171B21` plus inset hairline. Not a coloured ring, not a filled circle."* Shipped at `components.css:72` as `.navitem.is-active`. The Today tile is this page's "today" cell: one step brighter than `--raised`, the inset hairline doing most of the work, no hue — and crucially **it follows the Today tile rather than the biggest cell**, so it survives Riku moving the hero to row 3 or shrinking it to span 4, which is deck §14's third checklist item.

**The one permitted accent therefore stays in the bank, and I name the fallback rather than spend it.** If the mockup proves the hero does not read, the fallback is `--session` on the `TODAY` eyebrow only, drained to `--ink-3` when both groups are empty — `--session` because it is the one hue with no consumer anywhere in the app (visual spec §5.1: *"defined and unused… a fixed set stays complete"*) and its meaning is *activity*, which is what a day's schedule is. R3's pattern: rule the quiet version, show the fallback in the mockup, let pixels decide.

### 6.2 Real state: two hues, both on a dot or a line of mono

**Overdue → `--missing`, on text only.** `.pwhen`'s treatment in red, per §5.10. Nowhere else.

**Couldn't read the calendar → `--stale`, on a 5px dot.** The deck says this takes *"the same treatment the Freelance health strip gives an old reading"* — R57/R60's `.fl-health .line .aged{color:var(--stale)}`, an amber **stamp**. But `Couldn't read the calendar.` is a 13px sentence in a tile body, not a stamp, and P8 already has a register for "a source failed": `.fl-fail` (`components.css:447–453`) — a 5px dot in a 5px grid track, the sentence at `--ink-2`, no retry. I rule the synthesis: **`.fl-fail`'s shape with the dot in `--stale` rather than `--missing`**, using the dot `.fl-warn.is-stale i` already ships (`components.css:477`: `background:var(--stale);box-shadow:0 0 6px var(--stale)`). This honours the deck (amber), honours the built register, keeps hue off body text, adds nothing, and gives the page **one unambiguous shape for every couldn't-read state on every tile at every span** — deck §14's fourth checklist item — because a dot beside a sentence is visible at 110px of inner width and a coloured word is not.

Amber and not red, deliberately: `--missing` means *conflict or gap*; a calendar that did not answer is *ageing data*, the reading `--stale` already carries for an old health snapshot. Red stays on lateness and on form errors while a form is open.

### 6.3 Where hue must **not** land

- **Layer names.** `DESIGN-INSPO §5.11` maps Personal→`--roi` and Classes→`--session`, and the same section gives the escape clause: *"If a sixth layer appears, assign it by meaning or don't colour it."* P10's layers are Settings-chosen from up to 10 arbitrary Google calendars (design doc D10), so a fixed map cannot hold. And §5.11's hues existed because a 9.5px event chip in a month cell had no room to spell the layer out — here the name is **written in words** beside the title, so the hue adds nothing. **Decline it, and record the decline as a reference-level note**, or Academics will read §5.11 as binding for the Classes layer.
- **The push tile** (§4.4) · **`+ Event` / `+ To-do` / `Add` / `Save`** (§5.6) · **the switch when on** (§5.1) · **edit mode** (§5.8) · **the empty cell** (§2).
- **`--spend` orange:** the focus ring and the field caret only, never on content. R2: *"Orange appears on P8 only on the logo tile. It is reserved."* **`--save` and `--roi`:** unused here — no green tick, no green `Add`, no violet anything.

**The whole-page hue inventory is `--missing` and `--stale`, and on Riku's real data today the page renders with zero hue.** That is the correct report and it should be checked by eye on specimen 01.

---

## 7. The scale: every size, and the five additions

**Used unchanged from visual spec §5.3** — `.eyebrow`; `.fl-h`; `.fl-count`; `.btn`; the 11px `--ink-3` tabular stamp; group labels at the `.fl-thead` step (mono 500 · 9px · `0.14em` · `--ink-4`); `.fl-trow .nm` 600/13px; body sentences 13px `--ink-2`; times, days, due meta and the toolbar caption at `.pwhen`'s mono 9.5px tabular; the layer tag at `.tag`'s box and `.fl-count`'s 10px; `.fl-empty` 13px `--ink-3`; `.fl-note` 11px `--ink-3`; `.fl-absent` 11px `--ink-4`; `.fl-fail .said` 13px `--ink-2`; `.fl-bound` 11.5px `--ink-4`; `.fl-snip` 12.5px `--ink-2`; `.fl-stage .ct` display 600/15px; `.segmented a`; `.error` 12.5px `--missing`; the dash `--ink-4`. **`tabular-nums` on every time, date, day, count, lateness and stepper figure** — §5.3 calls it non-negotiable and this page is mostly digits.

**Added to §5.3 — five lines, four of them promotions:**

| # | Line | Source | Why it is not an invention |
|---|---|---|---|
| 1 | **Form field** `.fld` — body 13px, `8px 10px`, `#101318`, `1px --line`, radius 8px, `--ink`, caret `--spend` | `legacy.css` `input,textarea` / §6.1 | Already shipping on `/login` and `/settings`. §5.3 has no field line only because P8 had no form. |
| 2 | **Form label** `.fld-l` — 12px `--ink-3`, sentence case | `legacy.css` `label` / §6.1 | Same; §6.1 already ruled the voice. |
| 3 | **Tick box** — 14px square, radius 3px, `1px --line`, `--sunk`, an 8px `currentColor` check at `stroke-width:1.8` | first principles; radius from `.ev`, stroke from the nav glyphs | Genuinely new. Nothing in the reference ticks. |
| 4 | **Switch** — 26×15px, radius 999, `#141820`, `1px --line`, 9px knob | `components.html:475` / §5.11 | A port. Values verbatim. |
| 5 | **Square icon button** — 24×24, radius 7px, `1px --line`, `--ink-3`, 10px glyph | `components.html:483` | A port. Serves the arrows and the stepper. |

**No new tokens, no new hue, no new face, no new radius, no new spacing step.** Every dimension resolves to an existing token or a value already written in `components.html` or `legacy.css`.

**On row minimums**, which the brief lists as open. The design doc proposes `340 / 140 / 240 / 120`. Measured against the blank week at the default arrangement (13px/1.5 rows, 11px vertical padding, 15px tile padding): row 1's tallest is To-do at ≈287px (three labelled sections 28px apart), Today ≈217px, so **340 binds and leaves the blank hero ≈123px of slack**; row 2's tallest is Layers at ≈172px, so **140 does not bind and the row renders at ≈172**; row 3's seven day rows at ≈33px plus a head means **240 does not bind and the row renders at ≈285**; row 4's one inline sentence is ≈64px, so **120 binds**.

The rendered blank week is therefore roughly **340 / 172 / 285 / 120** — still tall, short, medium, short, and the ratios still read. Two rulings follow:

1. **The weights are minimums and must never be enforced by clipping, by shrinking type, or by tightening row padding below 11px.** If a mockup hits 240px on Next 7 days, it cheated.
2. **The 123px of slack in the blank hero is the design, not a defect.** `§5.14` rule 1: an empty container keeps its size. Riku's spec says the uneven row heights are *"what stops the page from reading as a machine-generated card grid"* — the slack **is** the weight. Do not fill it, centre content in it, or bottom-anchor anything into it.

---

## 8. Is `legacy.css` a legitimate source for the form fields?

**The recipe is. The file is not, and leaning on it directly would be a scheduled breakage.** Three facts at HEAD. (a) `legacy.css`'s own header says it *"HAS AN EXPIRY DATE… It is DELETED in the phase where those pages get their own content discussion under S11… Do not add to it."* (b) Its selectors are **bare elements** and it is imported globally from the root layout, so every `<input>` P10 renders is *already* styled by it, wanted or not — while `<select>` is not covered and would render unstyled beside styled siblings. (c) When it is deleted, P10's forms lose their styling silently, in a phase whose diff touches no P10 file.

**So: copy the recipe into `components.css` under classes, values verbatim, source cited in a comment — exactly the way R42 ported `.segmented` from `components.html`.** P10's fields then survive the deletion, and `legacy.css`'s `input`/`label` rules die as *superseded* rather than lost. Two carve-outs: the `input:-webkit-autofill` override stays with `legacy.css` and the login field (it exists for a password field Chrome autofills; nothing here is autofillable), and `button.danger`'s values are copied for the delete confirmation without relying on the bare `button` selector.

**Where the page's CSS lives.** `components.css`'s header declares *"two namespaces and no third"*; P10 adds `tl-`, a namespace, not a third system. **The shared vocabulary — `.fld`, `.fld-l`, the tick box, the switch, the 24px square button, `.tag.is-layer` — goes into `components.css`, because each has a named second consumer already** (Settings' layer picker ships in this same phase and needs the tick box and `.fld`; Academics needs the rest). **The page-specific vocabulary — `.pg`, `.tile`, `.tl-head`, `.tl-grp`, `.tl-form`, the toolbar, the dashed cell — goes into a page-scoped `personal.css`.** The test is `components.css`'s own §5.8 rule: declared vocabulary that renders nowhere does not grow, so anything with exactly one consumer on one page is not shared vocabulary yet.

---

## 9. The blank week, from the system's side

The blank page is not six boxes with a sentence each. It is a raised hero with two labelled groups that each *answer*; a tile with three labelled sections that each answer; three real switches showing real state; a real quoted message with a real timestamp; **seven true dated rows**; and one sentence. Only the last is thin, and the deck fixes it by putting it inline with its eyebrow. The seven `—` rows are the page's strongest asset when blank, because they are structure that is *true*.

**Three free moves.** Tiles keep their size and border (`§5.14` rule 1) with nothing collapsing, centring, or growing a dashed placeholder or an action pill — R12's `Nothing waiting.` ruling applies verbatim to all six sentences. Every empty sentence sits **where its first row would sit**, left-aligned 10px under its group label, so the eye learns the populated shape from the empty one. And zero hue anywhere (§6): one lit thing on a blank week reads as a page reporting a problem; nothing lit reads as a quiet day, which is what Riku said it is. **The trap** is my predecessor's, worse here: *the empty render is the real render*. Deck §13 is invented, §12 is measured — build specimen 01 first.

**Four places I argue from first principles rather than port**, flagged so nobody reads them later as reference: the tick box (§5.2); the dashed cell (§5.7 — R12 forbids a dashed box for an *empty state*, and this is legal only as edit-mode furniture); the `--panel` editing well (§5.8); and two eyebrow levels inside one bordered object (§3), most likely to fail at span 2.

---

## Where I expect to disagree

**With the Grid Architect** — on row minimums. He will want `340 / 140 / 240 / 120` to hold because they are written down. They do not: rows 2 and 3 are pushed past their minimums by the blank week's own content (§7), and the only ways to make 240 true for seven day rows are shrinking type below 12.5px or cutting row padding below 11px, both of which break §5.3 and §5.5. Better the spec says *"row 3 renders at ≈285 and that is correct"* than a build quietly tightens rows to hit a number. Also on the empty cell: if he wants it to carry *any* treatment in normal view I will oppose it, because a treated hole is an object and Riku's spec says the cell exists to break symmetry.

**With the Interaction Designer** — three things. (a) A bigger tick box: I want a 14px drawn box with a 30px transparent target, because the drawn size is a design decision and the target is geometry. (b) `appearance:none` on the date and time fields for a consistent look: I oppose it on §5.6's grounds — a native picker is the only genuinely one-handed date entry, and half-styling it leaves the popup native anyway. (c) A form that *adds* to the tile rather than replacing its body, so Riku can see the list while adding: I chose replacement because it keeps the deck's "without moving the grid" promise (§5.6's arithmetic), and will trade it only against heights.

**With the Honesty Critic** — on the em-dash. `§5.14` rule 3 says an em-dash means *nothing was measured*, and an empty day **was** measured. I keep the deck's `—` and put the honesty in the tile-level sentence instead (§4.5), making that sentence load-bearing rather than decorative; the reference offers nothing better, and a second mark for "measured nothing" costs more than the ambiguity. I also expect him to want red on the couldn't-read states; I want amber on a dot (§6.2), and the deck agrees with me.

**With the Frontend Architect** — on CSS placement. He will reasonably want one `personal.css` for everything. I want the six shared recipes in `components.css` (§8): the Settings layer picker ships in this same phase and needs the tick box and `.fld` on a page that is not `/personal`, so a page stylesheet means Settings either imports it or grows a duplicate. And if he proposes leaning on `legacy.css`'s bare `input` rule directly, that is the one place where the cheap answer is a scheduled breakage.

---

## Questions for the lead

1. **The hero accent — spend it or bank it?** I rule the Today tile takes the active-cell ground (`#171B21` + inset hairline) and **no hue at all**, so the page renders with zero colour on Riku's real data. The named fallback if pixels disagree is `--session` on the `TODAY` eyebrow, drained when both groups are empty. Show both in specimen 01, as R3 did for the mark field.
2. **Layer hues: decline `DESIGN-INSPO §5.11`'s map?** §5.11 assigns Personal→violet and Classes→blue. I decline it (layers are Settings-chosen and arbitrary; the name is spelled out in words) and want the decline recorded as a **reference-level note**, because Academics will otherwise read §5.11 as binding for the Classes layer.
3. **"Due chips" are not chips.** I render them as a right-aligned mono meta column where the only difference between `Fri 12` and `3 days late` is `--ink-3` versus `--missing` — no box either way. That is a visual reading of a content word. Confirm, or overrule and I will spec the `§5.10` status-pill box instead.
4. **`Done this week` has two forms** — inline with its eyebrow when empty (the deck's own §12 render), stacked when it has rows. I am reading a layout out of the deck's ASCII; confirm that reading is intended.
5. **Row 3 will render at ≈285px, not 240.** Confirm the spec should say so plainly rather than have the build tighten rows to hit the design doc's number.
6. **Namespace.** Third prefix `tl-` for tiles, with six shared recipes promoted into `components.css` and the rest in a page-scoped `personal.css`. Confirm before the Spec Editor writes it, because `components.css`'s header commits to "two namespaces and no third" and that sentence needs amending in the same change.

---

## What I would cut

- **Any hue on the hero** (§6.1) — the most likely thing to be added in the mockup because "the hero should look like a hero", and the one thing that makes the blank week look like a warning.
- **Layer colours** (§6.3). Three coloured dots in Layers plus three coloured tags per row in Today would put nine hued objects on a page whose own spec says size carries hierarchy.
- **`.btn.go` on `Add`** (§5.6). Keep it unspent for the queue rebuild, where a proposal actually exists.
- **A per-layer count in the Layers tile.** `components.html`'s `.layer` has a `.ct` (`3 events`). The deck does not ask for it, it needs a read the page does not do, and it would be wrong the moment a layer failed.
- **Any `+N more` or clamp on the push body** (§4.4) — a quotation is not a list. And **no caption inside the dashed cell** (§5.7): the dashes say "room"; a word saying "empty" is the machine explaining its own furniture.
- **A chevron, a hover lift or any affordance on a tile outside edit mode**, and **`<details>` anywhere on this page.** Tiles do not open, collapse or reorder in normal view; a hover that lifts implies a click; and six tiles that fold turn a bento into an accordion.
- **Any third breakpoint.** The design doc names 760px and 480px and says to reuse the shell's own width if it differs. Key the row-stacking rule (§4.1) off the span classes the server already emits.
