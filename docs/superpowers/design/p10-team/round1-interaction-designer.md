# P10 round 1 — the Interaction Designer

**Date:** 2026-09-11 · **Role:** Interaction Designer · **Round:** 1, written without reading the other four papers.
**Standing question:** can Riku do everything one-handed on the phone and by keyboard on the laptop?
**Sources, read at HEAD `3fa055e`:** the brief · the content deck · the design doc · the P8 visual spec §3.4, §4.6, §5.3, §5.5–5.8, §6.1 · `CheckNow.tsx` and `freelanceHealth.ts:170–216` · `(app)/settings/page.tsx` · `tokens/base/components/legacy.css` · `components.html` (`.swx`, `.layer`, `.cal-head button`, `.segmented`) · `DESIGN-INSPO.md` §5.3, §5.11, §7.1 · `p8-team/round3-lead-rulings.md` and R25–R46 of `round4` · `CLAUDE.md` · `src/app/layout.tsx`.

---

## 1. Position

This is the first page in the app where Riku **writes**. The Freelance page has one control, and the P8 team spent two review rounds getting that one control right; everything they learned is in `CheckNow.tsx` and it is the law this page inherits: **every press is answered, the answer is a fact about the control and is said in the control's own voice, and no press's outcome is ever written into the content, because the content makes claims about the world.** I adopt it unchanged and extend it to ticks, switches, three forms and an edit mode. Around it I put three rules of my own. **The grid never moves** — a form opens inside its tile, and if it does not fit the tile's own body scrolls; a row weight is never grown by a form, and edit mode's toolbars take height from the tile's content, not from the row. **Optimism only where the write is local-first** — a tick writes Mongo first and Google second (design doc, *write-through with compensation*), so a tick may remove its row instantly; an event insert is one external call whose timeout outcome is genuinely unknown, so nothing about it is drawn before Google answers. **No hue on any control outcome** — `--missing` and `--stale` are assigned to overdue to-dos and an unread calendar (deck §5), and a page that turns red because a save failed has spent a meaning it does not own; R67 already said a failed press in `.btn`'s ordinary ink. Underneath all of it, one engineering choice does most of the work: **every layout decision inside a tile is a container query, not a media query**, because a tile is 609px or 297px or 141px depending on where Riku last put it, and the deck requires the design to hold "for any legal arrangement, not only the default". And loudly: the shell has no phone form (`DESIGN-INSPO` §7.1, still open), so until it has one, *one-handed on the phone* is not achievable on this page at any span. That is my Question 1.

---

## 2. The container-query spine, and the widths every drawing uses

`.pg-tile { container-type: inline-size }`. Every rule that depends on how wide a tile is — the form's column count, the toolbar's wrapping, whether Today's row keeps its layer tag inline — is `@container`, never `@media`. **It is the only thing that makes "holds for any legal arrangement" true by construction:** a media query knows the viewport, not that Riku stepped Today down to 4 columns. It also makes the 12 → 6 → 1 collapse nearly free, since both breakpoints change a tile's width and every inner layout follows. `container-type:inline-size` applies `contain: layout style inline-size`, safe on a grid item with an explicit span whose width comes from the track. Precedent for a modern primitive: `components.css:328` ships `:has()` with the note "the app targets current Chrome".

Widths, from deck §2 item 9 ((920 − 11×14) / 12 = 63.83px per column), with 16px tile padding and 1px borders:

| Span | Tile outer | Body inner |
|---|---|---|
| 2 | 141.7px | 107.7px |
| 3 | 219.5px | 185.5px |
| 4 | 297.3px | 263.3px |
| 8 | 608.7px | 574.7px |

Row bodies, from the design doc's row minimums less a ~46px tile header and 32px of vertical padding: **row 1 (340) → 262px · row 2 (140) → 62px · row 3 (240) → 162px · row 4 (120) → 42px.** Those four numbers decide most of what follows.

---

## 3. Ticking, and un-ticking

The tick box appears in four places (Today's DUE group, To-do, Next 7 days, inverted in Done this week) and is the page's most-pressed control. It is new vocabulary: `.swx` is the switch, `.tag` is a label, the system has no box.

**`.pg-tick`, built from parts the system has.** A `<button type="button" role="checkbox" aria-checked>` (not `<input>`, so it inherits `.btn`-family disabled behaviour and needs no `appearance:none` fight): 15×15px, `border-radius:5px` as a literal, 1px `--line`, ground `#12151A` — the `.agent` ground, already in `components.css:83`. 15px so a tick and a `.swx` switch (26×15) sit on one optical line; the literal radius has precedent in `.segmented`'s `9px` and the reference's 3px event chips. **Checked is an `--ink` checkmark on the same ground, border unchanged. No hue** — a green tick spends `--save` on "done", a meaning the closed set does not assign it, and puts colour on the page that is neither the hero nor real state (deck §5).

**Hit box 43×43, without moving anything:** `position:relative` plus `::after{position:absolute; inset:-14px -6px -14px -14px}`. Generous down, up and left into the tile's padding; tight on the right, because in the To-do tile the space right of the box belongs to *the row*, which opens the edit form.

### 3.1 Tick a to-do — Today, To-do, Next 7 days

| | |
|---|---|
| **Trigger** | Tap the box or its expander · `Space`/`Enter` with it focused. |
| **Immediately** | The row is gone from every list that showed it; the To-do count drops (`6 open` → `5 open`). Nothing else moves — the tile is its cell and the list is simply shorter. |
| **Busy** | **None, deliberately.** The row that would carry it has left. Nothing disables, nothing greys, no spinner — the app has none and must not gain one. |
| **Success** | The server render arrives with the row genuinely absent, and it reappears at the top of Done this week. Nothing flashes; the count already said it. |
| **Local write failed** | The row returns where it was, unticked, with `Couldn't save.` under it in `.pg-said` (§8). |
| **Done, but Google could not remove the pin** | The tick **stands** (the to-do's own change is written first and always succeeds on its own). The row is gone, so the deck's `Done, but the calendar entry couldn't be removed. Remove it in Google Calendar.` goes to the foot of the tile the press happened in. |

**Optimism without flicker.** Not `useOptimistic`: its state unwinds when *its* transition ends, and three fast ticks give three overlapping transitions and three chances for a row to blink back before its own refresh lands. Instead one `Set<string>` of hidden ids that only **grows** during the page's life (shrinking by exactly one on a failure); rendering is `rows.filter(r => !hidden.has(r.id))`. A stale id is harmless — the server render no longer contains that row. Monotone, cannot flicker under concurrency, and needs no `useEffect`, which matters because the lint baseline allows no fifth `react-hooks/set-state-in-effect` error. **The set is page-level, not tile-level:** an overdue to-do is in Today's DUE group *and* in the To-do tile at once, and a per-tile set leaves it visible in the tile Riku was not looking at.

### 3.2 Un-tick in Done this week

The mirror, with a `restored` set. `aria-checked` starts `true` and the accessible name is `Undo "Renew ID"` — a checked box in a list called *Done this week* needs its verb said. Failure: the row returns with `Couldn't save.` under it. Re-pinning the calendar entry is not attempted; the deck does not promise it back, and the edit form's switch is where that lives.

---

## 4. The layer switches

**The whole row is the control.** The reference draws `.swx` as the button and the name as a sibling (`components.html:1272`). At 26×15 that is a 390px² target; the row at span 3 is 185×34. So the row becomes a `<button type="button" role="switch" aria-checked>` containing the name and the `.swx` pill, with `.layer`'s and `.swx`'s CSS kept verbatim. Deviation named: **the reference's switch is the pill; ours is the row, because the pill is not a thumb target.** One tab stop per layer; `Space` and `Enter` toggle.

| | |
|---|---|
| **Trigger** | Tap anywhere on the row · `Space`/`Enter`. |
| **Immediately** | The knob moves. The row goes `disabled` + `aria-busy` — the deck: "While saving: the switch is disabled." Only that row; the other two stay live. |
| **Busy** | The knob has already moved (the deck's failure line says the switch "returns to its previous state", which presumes it left). Today and Next 7 days still show the **old** layer set — they cannot update without a Google read. The disabled switch is the honest signal that the page has not caught up, exactly as `CHECKING…` is on the Freelance strip. |
| **Success** | `router.refresh()`; the two calendar tiles re-render; the switch re-enables when the transition commits (`useTransition().isPending`, `CheckNow.tsx`'s pattern verbatim). |
| **Failure** | The knob returns, the row re-enables, `Couldn't save.` renders under that row in `.pg-said`. The other rows are untouched. |

**No layer dot and no hue.** The reference tints a layer row with the hue of what it means; this deck says colour is the hero and real state, and Personal / Classes / Events have no assigned meanings in the closed set. So `.layer i` renders nothing here, and off-ness is the knob plus the reference's 35% row opacity. That opacity puts 12.5px `--ink-2` at roughly `--ink-4` contrast; **I would keep the text at full strength and let the knob carry the state.** Flagged as a System Keeper collision (Q7).

---

## 5. The forms, in place, at every span

### 5.1 Rules that govern all three

1. **A real `<form>` with a real submit button.** Enter in any single-line field submits — which is what makes the button reachable when the tile's body scrolls, and is the whole keyboard answer on the laptop.
2. **The opening control is a disclosure:** `+ Event` carries `aria-expanded` and `aria-controls`, and pressing it again closes the form. Never disabled while open — a disabled control is a dead end for anyone tabbing back to it.
3. **Focus in, focus out.** Opening moves focus to the first field; closing (Cancel, Escape, the disclosure, or success) returns it to `+ Event`. Any programmatic scroll is `behavior:"auto"`, never `"smooth"`: the global reduced-motion rule (`base.css:35`) suppresses CSS transitions and cannot touch a scroll API, so a smooth scroll would be the one motion on the page that ignores the setting.
4. **Escape always closes, and nothing is lost.** What was typed stays in the island's state until a successful submit or a reload, so reopening restores it. That is the deck's own promise on a Google refusal ("the form keeps what was typed") applied to the exit too, and it is why the form needs no discard dialog.
5. **The grid never moves.** The form renders inside the tile's body; if it is taller, **the body scrolls** and the row's weight is not grown. One rule, every span, every row.
6. **Native `<input type="date">`, `<input type="time">`, `<select>`.** The OS picker one-handed on the phone; typed input and arrow keys on the laptop; zero JavaScript; and R24's "no new dependency" forbids a picker library. They work in this system for one shipped reason: `base.css:11` sets `html,body{color-scheme:dark}`, so every popup, spinner and menu is painted dark by the browser. The select's chevron is `appearance:none` plus `.sumrow::after`'s geometry (6px box, 1.5px `--ink-4` borders, rotated −45°, `components.css:366`), so the page's two chevrons are one shape.
7. **Fields are 16px; labels stay 12px.** `layout.tsx:54` sets `maximumScale:1`, which iOS Safari has ignored since iOS 10, so a focused input under 16px auto-zooms and never zooms back. `legacy.css`'s `input` is 13px. The alternative is a phone that zooms into a form and stays there.
8. **Validation on submit, never live.** The first offending field takes focus, `aria-invalid="true"`, `aria-describedby` at its message.

### 5.2 The event form — Tile 1's `+ Event`

At span 8 (574.7px body), two columns via `@container (min-width: 380px)`:

```
 TODAY                                                          [ + EVENT ]
 Thu 10 Sep
 +----------------------------------------------------------------------+
 | Title                                                                |
 | [ Call with Nova Dental                                            ] |
 |                                                                      |
 | Calendar                            Date                             |
 | [ Personal                     v ]  [ 10/09/2026                   ] |
 |                                                                      |
 | [ O-- ] All day                                                      |
 |                                                                      |
 | Start                               End                              |
 | [ 14:00                          ]  [ 15:00                        ] |
 |                                                                      |
 |                                          [ CANCEL ]      [ ADD ]     |
 +----------------------------------------------------------------------+
```

Height: 4 field rows at (17 label + 6 + 34 control) = 228, the all-day row 34, five 12px gaps = 60, a 16px gap and a 34px button row = **372px against 262px of body. It scrolls by 110px, and that is correct** — the alternative is growing row 1 and pushing the page down while Riku types.

At span 4 (263.3px body) the query drops to one column, same order:

```
 TODAY                       [ + EVENT ]
 Thu 10 Sep
 +-------------------------------------+
 | Title                               |
 | [ Call with Nova Dental           ] |
 | Calendar                            |
 | [ Personal                      v ] |
 | Date                                |
 | [ 10/09/2026                      ] |
 | [ O-- ] All day                     |
 | Start                               |
 | [ 14:00                           ] |
 | End                                 |
 | [ 15:00                           ] |
 |                                     |
 | [ CANCEL ]              [ ADD ]     |
 +-------------------------------------+
```

≈483px against 262px. It scrolls; Enter submits from Title, so `ADD` never has to be reached.

**Field behaviour.** `Calendar` lists only switched-on layers and defaults to the first (design doc open item 3); `Date` defaults to today. `All day` on **hides** Start and End (`hidden`, not removed, so a mind change keeps their values) and the button row rises ~102px — movement *inside* a tile, caused by a press, in the direction Riku is looking, which rule 5 does not forbid. **`End` tracks `Start + 1h` until Riku edits End, then stops tracking for the life of the form**; a field that keeps overwriting what you typed is the worst small bug in form design.

**The five outcomes.**

| Outcome | What happens |
|---|---|
| Validation | `Give it a title.` under Title, or `End must be after start.` under End. Focus to that field. Nothing was sent. |
| Busy | `ADD` reads `ADDING…`; **both buttons disabled** (deck §7); **fields go `readonly`, not `disabled`** — readonly keeps values visible, selectable and focusable, and stops an edit that has already been posted from looking like it counted. |
| Success | The form closes; focus returns to `+ Event`; Today and Next 7 days re-read. |
| Google refused | `Google didn't accept it: <its reason>.` above the button row. **The form stays open with everything typed and `ADD` re-enables** — a definite no is safe to retry once the reason is addressed. |
| **No answer in time** | `Couldn't reach Google. Check the calendar before trying again.` — and **`ADD` stays in place, disabled; `CANCEL` is the form's only live control.** The request may have landed, so the interface must not offer the one gesture that creates a duplicate. Riku reads the sentence, checks the calendar, and presses `+ Event` again if he needs to — a deliberate act, not a re-press. |

That contrast is the most important thing in this paper: two failures a naive design treats identically are treated oppositely, the difference is legible without reading the sentence — one form invites another press and one does not — and it is the asymmetric-failure rule (`CLAUDE.md`) made visible.

### 5.3 The to-do form — Tile 2's `+ To-do`

At span 4 (263.3px body), one column:

```
 TO-DO                     [ + TO-DO ]
 0 open
 +-------------------------------------+
 | Title                               |
 | [ Renew ID                        ] |
 | Section                             |
 | [ Personal                      v ] |
 | Due                                 |
 | [ dd/mm/yyyy                      ] |
 |                                     |
 | [ --O ] Put on calendar             |
 |         Needs a due date.           |
 |                                     |
 | [ CANCEL ]              [ ADD ]     |
 +-------------------------------------+
```

≈308px against 262px: it scrolls ~46px. At span 8 the query pairs `Section` with `Due` and the form is ~200px, well inside row 1. **At span 2 (107.7px body, and 62px or 42px of height in rows 2 and 4) the form does not exist** — see §6.4.

**The calendar switch.** `Needs a due date.` is present **whenever the switch is disabled**, not after a failed tap — the deck's own edit-mode principle ("disabled rather than refused after the fact") applied here. A valid `Due` enables it on `input`, not `blur`. **Clearing `Due` while it is on turns it off and restores the note** (Q5): a pinned to-do with no date is the one state the write path cannot honour.

**Outcomes:** `Give it a title.` · busy `ADDING…` with both buttons disabled and fields readonly · `Couldn't save.` with the form open and everything kept · and the partial, `Saved, but the calendar entry failed: <reason>. The to-do is not on the calendar.`, which **closes the form** and says the sentence at the foot of the To-do tile. The to-do exists; a form left open over a saved record invites a second `ADD` and a duplicate to-do, which is worse than losing the sentence's context.

### 5.4 Editing a to-do, and deleting one

Tapping the row — not the box — opens the edit form. **The form replaces that row in the list, in place**; the section labels and the rows around it do not move. The row's tap target is a second `<button>` wrapping the title, chip and tag, named `Edit "Renew ID"`; the `on calendar` tag inside it is a label and is never pressable.

```
 PERSONAL
 [ ] Renew ID                    Fri 12
 +-- editing -------------------------+
 | Title                              |
 | [ Book dentist                   ] |
 | Section                            |
 | [ Personal                     v ] |
 | Due                                |
 | [ dd/mm/yyyy                     ] |
 | [ --O ] Put on calendar            |
 |         Needs a due date.          |
 |                                    |
 | [ DELETE ]    [ CANCEL ]  [ SAVE ] |
 +------------------------------------+
 [ ] Send invoice        3 days late
```

`DELETE` sits apart from the `CANCEL`/`SAVE` pair, at the far left, in `.btn` at resting emphasis. **No red on `DELETE`** — the confirmation is the safety, and the hue budget is spent on overdue rows. **The confirmation replaces the button row in place** — no dialog, no overlay, no second layer:

```
 | Delete "Renew ID"?             [ DELETE ]  [ KEEP ] |
```

Focus moves to **`KEEP`**; `Escape` = `KEEP`; pressing `DELETE` again confirms. The deck's visual order is kept, but focus does not follow it, because the safe option takes the default. On confirm the row and the form both go; a Google failure sends `Done, but the calendar entry couldn't be removed…` to the tile foot. Busy labels: `SAVE` → `SAVING…`, `DELETE` → `DELETING…`, neither in the deck (Q2).

---

## 6. Edit mode

### 6.1 Entering and leaving

`Edit layout` in the page header. On press the header's controls become `Save` · `Cancel` · `Reset to default`, every tile grows a toolbar, and every empty cell shows its dashed outline.

**Focus on entry goes to the first tile's `←`.** Riku pressed `Edit layout` to move something, and that is the button that moves it; its accessible name (`Move Today left`) announces the mode more usefully than any live region. Not `Save` — Enter would close the mode he just opened. And not `<body>`, which is the default when React unmounts the button that had focus. `Escape` anywhere = `Cancel`; on `Save` or `Cancel`, focus returns to `Edit layout`.

**In edit mode the header's control row is `position:sticky; top:0`.** One declaration, and it is the difference between edit mode working on a phone and not: at one column the six tiles stack into a page several screens tall, and without it Riku arranges the last tile and then scrolls back to the top to save. Normal view keeps a plain header — the stickiness belongs to the mode. **Order:** `Reset to default`, a gap, `Cancel`, `Save` — least-used and most-destructive furthest from the two that end the session, `Save` last where thumb and eye finish.

### 6.2 The toolbar

The reference already owns this button: `.cal-head button` — 24×24, `border-radius:7px` (`--r-nav`), 1px `--line`, `--ink-3`, `display:grid; place-items:center`, 10px glyph, `padding:0` (`components.html:483`). Four of those, the stepper (the same button for `−` and `+`, the number between them display 600 / 13px tabular), then the caption.

**The toolbar is a full-bleed strip at the top of the tile**, above the padded body, with its own 6px padding — not inside the content padding. That matters at span 2: four 24px buttons with 4px gaps need 108px, and a span-2 tile's padded body is 107.7px. Full-bleed gives it ~128px. **The 108px arrow group is the toolbar's hard floor, and it is why these buttons are 24px and not 26px.**

Span 8 — one line:

```
 +----------------------------------------------------------------------+
 | [<] [>] [^] [v]      [-]  8  [+]      2 COLUMNS LEFT                 |
 +----------------------------------------------------------------------+
 | TODAY                                                       + Event  |   inert
 | Thu 10 Sep                                                           |
```

Span 3 — the caption wraps first:

```
 +-----------------------------------+
 | [<] [>] [^] [v]     [-]  3  [+]   |
 | ROW FULL                          |
 +-----------------------------------+
 | LAYERS                            |   inert
```

Span 2 — three lines, the narrowest legal tile:

```
 +-------------------------+
 | [<] [>] [^] [v]         |
 | [-]   2   [+]           |
 | 4 COLUMNS LEFT          |
 +-------------------------+
 | LAYERS                  |   inert
```

The caption is `.pg-cap`: mono 8.5px / `0.16em` / uppercase / `--ink-4` — the `.grouplabel` recipe, the system's existing "machine label about a container" voice. **It carries `aria-live="polite"`**, because it is the only feedback for the stepper other than the tile visibly changing width, and a width change is silent.

The toolbar takes its height from the tile's content, which is clipped (`overflow:hidden`) while editing. **The tile's box does not change and the grid does not move when edit mode opens — no scroll jump.** A tile being moved needs to be identifiable, not readable.

### 6.3 What is inert, and what is disabled

**Every control inside every tile is `inert` in edit mode.** One attribute on the tile body, natively supported, removes the subtree from the tab order *and* from hit testing — precisely right, because in edit mode a tap is a layout gesture and a tap that ticks a to-do is the classic mode error. The deck says the tiles "keep rendering their live data while being moved" — rendering, not operating. Tab order is then exactly three header buttons and six toolbars of six buttons: 39 stops in a rarely-entered mode, no roving tabindex, no custom key handling, `Shift+Tab` works. An open form closes on entry keeping what was typed, and leaving does not reopen it.

| Control | Disabled when |
|---|---|
| `←` / `→` | the tile is first / last in its row |
| `↑` / `↓` | the tile is in row 1 / row 4, **or** the neighbouring row has fewer than `span` columns free |
| `−` | `span === 2` · **and `span === 4` on Today and To-do (§6.4)** |
| `+` | the row is full (`sum === 12`) |
| `Save` | nothing has changed since edit mode opened |
| `Reset to default` | the working arrangement already equals the default |

All of it is "disabled rather than refused after the fact" — the deck's rule for the 12-column ceiling, generalised to the whole bar. An empty row is legal (`validateLayout` requires four rows, not four non-empty rows) and `↑`/`↓` are **not** disabled to prevent one: that is Riku's arrangement to make, exactly as the empty cell is.

**Two focus rules that will otherwise be bugs.**

1. **Tiles are keyed by tile id, never by position.** Press `→`, React re-renders, and if the key is the index the button unmounts and focus falls to `<body>` — so the second `→` does nothing. Keyed by id, the DOM node survives the move, the browser keeps focus, and Riku can press `→` twice to move a tile two places. This is the most important keyboard detail in edit mode.
2. **When a button disables itself, focus moves to its sibling.** Press `+` until the row is full and `+` disables under the pointer; focus would go to `<body>`. `+` → `−`, `−` → `+`, `→` → `←`, `↓` → `↑`.

### 6.4 The span floor on the two form-bearing tiles

At span 2 the To-do tile's body is 107.7px wide, and in row 2 or row 4 it is 62px or 42px tall. A form does not exist at that size — the title field alone would be 108px inside a 42px scroll window. The deck promises Riku any legal arrangement; it also promises the forms open in place.

**Proposal: `−` is disabled at span 4 on Today and To-do.** One line in the stepper's disabled rule, using machinery edit mode already has, refused *before* the fact like everything else on the bar, and it removes exactly two arrangements. The other four tiles step down to 2. If the lead would rather not take an arrangement away, the fallback is that the form opens and the body scrolls in 42px — which I would rather write down as a known-bad state than discover on a Sunday.

### 6.5 Save, Cancel, Reset

| | |
|---|---|
| `Save` | `SAVING…`; all three header buttons and all 36 toolbar buttons disabled. Success: the mode closes, the header returns to `Edit layout`, focus lands there. **Nothing re-reads** — no `router.refresh()`, no Google call. The editor already holds the arrangement it just saved; a Google round trip to confirm a layout change would be absurd. Failure: `Couldn't save the layout.` beside the buttons; the mode stays open with the changes intact (deck §8) and `Save` re-enables. |
| `Cancel` | Discards, closes, focus to `Edit layout`. **No confirmation** — the deck gives the delete one and gives this none, and Riku ratified that. Cost recorded in Q6: on a phone one mis-tap discards five minutes of arranging. |
| `Reset to default` | Loads `PERSONAL_LAYOUT_DEFAULT` into the working copy; focus stays on it; it still needs `Save`, so `Cancel` undoes it and it needs no confirmation of its own. Named cost: six caption live regions change at once and a screen reader queues six announcements. |

---

## 7. Busy, and the five-second Google call

**No spinners, no skeletons, no shimmer.** `CheckNow` set the register: busy is a label change plus `disabled`. Where a control has no label — a tick, a switch, an arrow — busy is `disabled` plus `aria-busy="true"` and nothing else.

| Action | External call | What disables | What Riku sees |
|---|---|---|---|
| Tick / un-tick | Mongo first, Google second, neither blocking | nothing | the row is already gone |
| Layer switch | none on save; Google on the refresh after | that switch row only | knob moved, row dimmed by `:disabled` |
| `+ Event` `ADD` | **Google insert, 5s timeout** | both buttons; fields readonly | `ADDING…` |
| `+ To-do` `ADD` | Mongo, then Google only if pinned | both buttons; fields readonly | `ADDING…` |
| Edit `SAVE` / `DELETE` | Mongo, then Google if pinned | all three buttons | `SAVING…` / `DELETING…` |
| Layout `Save` | none | header + all toolbars | `SAVING…` |

**`busy` covers the POST *and* the refresh that follows it**, via `useTransition().isPending` — `CheckNow.tsx`'s reason unchanged: `router.refresh()` returns before the server render lands, so a busy that ends at the POST is a lie.

**The five seconds are spent in one place only** — `+ Event` — and `GOOGLE_TIMEOUT_MS = 5000` is a ceiling, not a latency; three parallel `listEvents` calls typically answer in a few hundred ms. `ADDING…` on a disabled pill is the whole message; the app is an instrument panel and has no progress affordance anywhere.

**One thing in deck §11 I want changed for the phone.** "Busy: only the forms and the switches have busy states. Everything else arrives with the page." On a `force-dynamic` render that makes a rail click from Freelance to Personal a potential five-second dead tap with nothing on screen, because the page cannot paint until Google answers. **The two calendar-reading tiles go inside `<Suspense>`**, with a fallback that is the tile at full size rendering its eyebrow and heading over an empty body — no spinner, no skeleton, and **no sentence**, so it never claims `Nothing scheduled.` over a read that has not finished. Everything else paints immediately, and the grid does not move because the tile is its cell either way. R22's Suspense-plus-catch on the rail is the precedent.

---

## 8. What a press is allowed to say, and where

`.pg-said` — 11.5px, `--ink-3`, no dot, no hue, `margin-top: var(--sp-2)`. **New vocabulary, argued rather than reused:** `.fl-note` means *a measured emptiness — the source answered and the count was zero* (`components.css:355`); `.fl-absent` means *the field never arrived*; `.fl-fail` is a dot plus a statement about **a read that failed**, a claim about the world, which a press outcome is not; `.error` is `--missing` and lives in `legacy.css`, the layer with an expiry date.

| Placement | Used for |
|---|---|
| Under the field | validation: `Give it a title.` · `End must be after start.` |
| Above the form's button row | the form's own outcome: `Couldn't save.` · `Google didn't accept it: …` · `Couldn't reach Google. Check the calendar before trying again.` |
| Under the row | a row-scoped outcome: a failed tick, a failed layer switch |
| At the foot of the tile | an outcome whose control is gone: `Done, but the calendar entry couldn't be removed…` · `Saved, but the calendar entry failed: …` · `Saved, but the calendar entry couldn't be moved: …` |

**No hue on any of them.** **None survives a reload** — they are facts about a press, not about the world, and a page that loads fresh every time (deck §4) must not load carrying yesterday's failure. The tile-foot line is cleared by the next press in that tile.

---

## 9. Focus order, whole page, normal view

DOM order follows the **stored arrangement**, not the tile-component order — the design doc already requires it ("Source order is the stored reading order"), and the tab order is why it matters.

```
rail:   Personal > Freelance > Settings > Log out
head:   Edit layout
Today:  + Event > [each SCHEDULED row's event link] > [each DUE row's tick]
To-do:  + To-do > per row: tick > Edit "..."
Layers: Personal > Classes > Events           (one stop each; the row is the switch)
Push:   nothing focusable
Week:   per day, in order: event links > ticks
Done:   [each row's un-tick]
```

Two stops per to-do row (tick, then edit) is deliberate; the one-stop alternative — Space ticks, Enter edits — is clever and undiscoverable. Deck §13's full week is ~40 stops, acceptable for a one-user page; the app has no skip link and adding one is a shell change, so I record it as debt.

**Event links leave the app**, so R36 applies verbatim: a plain `<a target="_blank" rel="noopener noreferrer">` with a persistent `↗`, and **the row is not itself an anchor**, exactly as `NeedsYou.tsx` documents.

**Focus ring.** `base.css:32` gives everything `outline:2px solid var(--spend); outline-offset:3px; border-radius:3px`. A 15px tick with a 3px offset is a 23px halo and adjacent rings nearly touch in a dense list — acceptable, since only one is ever drawn. And `:focus-visible` is `(0,1,0)`, so a `.pg-tick` rule at `(0,1,0)` or higher keeps its own 5px radius against the ring's 3px — the trap §3.4 already documents for `.segmented a`.

---

## 10. Touch targets, and the phone

**Every control has a hit box of at least 44×44 CSS px, achieved with an absolutely positioned `::after`, never by growing the visual.** WCAG 2.2 AA's floor is 24×24 and Apple's guidance is 44×44; this is a phone page and takes the higher one.

| Control | Visual | Expander | Result |
|---|---|---|---|
| `.pg-tick` | 15×15 | `inset:-14px -6px -14px -14px` | 43×43 |
| `.btn` (`+ Event`, `ADD`, …) | ≈76×29 | `inset:-7px 0` | 76×43 |
| toolbar arrow / stepper | 24×24 | `inset:-10px` | 44×44 |
| layer row | full width × 34 | `min-height:44px` below 480px | ≥44 |

**And now the thing that decides my standing question.** `components.css:45` is `.app-body{display:grid; grid-template-columns:var(--rail-w) minmax(0,1fr)}` with **no media query anywhere in the app** (`grep -rn "@media" src/styles` returns one line, the reduced-motion rule). At a 390px viewport that leaves 220px for `.app-main`, and `.app-content`'s 28px horizontal padding takes it to **164px of content**. The one-column collapse the design doc specifies below 480px would render every tile — hero, forms, edit toolbars — into 164px, beside a 170px rail carrying six agent badges. `DESIGN-INSPO` §7.1 says it plainly and it is still open: *"170px fixed rail has no mobile form — bottom tabs or a sheet, decided later."*

**It is now later, and this is the page that forces it.** Freelance is a desktop instrument by ruling; Personal is the page Riku opens at 07:00 after the push buzzes. Until the rail collapses, nothing in this paper is achievable one-handed.

---

## Where I expect to disagree

**Grid Architect.** My rule 5 — *a form never grows its row; the tile's body scrolls* — constrains what a row weight can mean and makes `overflow` a property of every tile rather than a special case. My span floor (§6.4) removes two legal arrangements from a grid whose premise is that any legal arrangement must look intentional. And I put the edit toolbar in a full-bleed strip that ignores the tile's padding, which is a hole in the tile anatomy he owns.

**System Keeper.** Five pieces of new vocabulary (tick box, field set, select, in-place form, edit toolbar) plus one new register, `.pg-said`. Three will hurt: 16px fields, which make an input the largest text in its tile and are forced by iOS; a `border-radius:5px` literal outside the radius set; and porting `.layer`/`.swx` while **dropping** the reference's layer hue and questioning its 35% off-state. I will concede the radius before the font size.

**Honesty Critic.** He will want control outcomes louder than 11.5px `--ink-3` with no hue and no dot, and will be uneasy that they do not survive a reload. My position: a hue spent on a failed save is a hue no longer available for an overdue to-do, and a page that loads fresh must not load carrying yesterday's failure. He will also press on the Suspense fallback (§7) — a tile with a heading and an empty body for 300ms shows nothing and means nothing. I think that is honest precisely because it says nothing.

**Frontend Architect.** Most of §3.1, §6.3 and §7 is his: `inert` on tile bodies, tiles keyed by id so focus survives a move, one page-level hidden-ids set as the only shared client state, `<Suspense>` around the two calendar tiles, **no `router.refresh()` after a layout save**, and a hard ban on `useEffect`-plus-`setState` in every new island (derive from props; where a reset is needed use a `key` — R39's addendum is the repo's own precedent) to protect the lint baseline.

---

## Questions for the lead

**Q1 — the rail has no phone form, and it blocks the standing question.** **(a)** below 760px `.app-body` becomes one column and the rail a 44px top strip (brand, three nav items, `Log out`), agents block hidden on the phone — one media query and one `order`, and it loses the agents block where Riku most often looks at it; **(b)** a fixed bottom bar of three icon nav items, `Log out` and the agents block moving into Settings — best one-handed, a real shell change with its own S11 question; **(c)** formally defer and record `/personal` as a desktop page until the phone pass, which contradicts the deck's own journey. **Recommendation: (a) for P10, (b) named as the phone pass's job.**

**Q2 — six strings the deck does not have.** A failed tick and a failed un-tick (I propose reusing `Couldn't save.`, which the deck already uses for a failed layer switch and a failed to-do save, so nothing is invented); the edit form's failed `Save` and failed `Delete` (same); the busy labels `SAVING…` and `DELETING…` beside the deck's `Adding…`, and whether the layout `Save` uses `SAVING…` too.

**Q3 — the span floor.** May `−` be disabled at span 4 on Today and To-do (§6.4)? It takes two arrangements away from a layout the deck promised is Riku's to change, and it is the only way the forms are guaranteed a usable box.

**Q4 — does a partial success close its form?** I rule yes (§5.3): a form left open over a record that already saved invites a duplicate. The deck's sentences read as if the reader were still looking at the form.

**Q5 — clearing `Due` while `Put on calendar` is on.** I rule the switch turns off and `Needs a due date.` returns. The deck does not say, and a pinned to-do with no date is the one state the write path cannot honour.

**Q6 — `Cancel` in edit mode with unsaved changes.** The deck gives it no confirmation and Riku ratified that; on a phone one mis-tap costs five minutes of arranging. I record the cost and offer `Discard your changes?` · `Discard` · `Keep editing` — the delete confirmation's exact in-place shape — as an overturnable.

**Q7 — the off layer's 35% opacity.** The reference drops the whole row so the list still reads as a legend; this page has no layer dots, so the opacity only dims 12.5px `--ink-2` toward `--ink-4`. I would keep the text at full strength and let the knob carry the state.

**Q8 — accessible names.** `Edit "Renew ID"`, `Undo "Renew ID"`, `Move Today left`, `Widen Today`, `Today, row 1, 8 columns`. Strings, but never on screen. Do they need Riku's sign-off, or is the deck's authority over "every sentence on the page" limited to visible text?

---

## What I would cut

1. **Any hover-only affordance.** There is no hover on a phone, and this is the phone page. Hover may brighten; it may never reveal.
2. **Toasts, snackbars, any transient overlay.** The app has none. Every outcome in §8 has a fixed home beside the control that produced it, and a message floating over the grid violates the page's first rule.
3. **An undo control on a tick.** Un-ticking in Done this week *is* the undo, and it is ratified — a second mechanism is two ways to do one thing, the argument P8 used to refuse a retry button beside a page that reloads.
4. **A keyboard shortcut layer** (`e` for edit, `n` for new to-do). Undiscoverable, and one user with a real keyboard does not need it. Tab, Enter, Space, Escape is the whole vocabulary.
5. **Live validation.** On submit only.
6. **A "changes saved" confirmation on the layout `Save`.** The mode closing is the confirmation.
7. **Drag-and-drop in any form, including as a progressive enhancement.** A non-goal in the design doc; D7 chose buttons on purpose.
8. **`maximumScale: 1` (`src/app/layout.tsx:54`)** — not mine to remove, but it is a WCAG 1.4.4 problem, iOS ignores it, and its only live effect is blocking pinch-zoom on Android. One line, in the commit that ships the phone form.
