# P10 — The Personal page: complete content

**Date:** 2026-09-10 · **Purpose:** the full content inventory of `/personal`, written to be handed to whoever draws it. The concept behind the page, then every tile, every string and every state, with real data.
**Companion to:** `2026-09-10-p10-personal-page-design.md`, which holds the reasoning behind each decision and the engineering. This file holds the context and the words.
**Sibling:** `2026-09-05-p8-freelance-page-content.md` §1 describes the system this page belongs to. It is not repeated here; only what is different about this page is.

---

## 1. The concept — what this page really is

### What is different about this page

The Freelance page is a window on machinery: read-only, every action leaves for another app. **This page is the one place in the app where Riku acts on his own things directly** — ticks a to-do, adds a to-do, puts an event on his calendar. None of that goes through the Approval Queue, because the queue governs *agents* acting on his behalf, and here it is Riku acting. No agent acts on this page at all: the Personal side gets no new agents (decision S13). The one automated thing that touches it is the morning push, which gains a Today sentence fed by this page's data.

### The problem it exists to solve

Life admin is scattered — classes, org tasks, plans, deadlines — and the morning push had nothing to say about any of it. The Today section was dropped from the digest in P5 because there was no store of self-set deadlines to read (P5a-7). This page supplies that store, reads the calendar live, and gives the push its Today sentence. **The phase is done when one morning push names what is actually due and scheduled that day.**

### The journey

Phone buzzes at 07:00 with the push: *"Today: Math Methods 09:00 … Due: Pay tuition (today)."* The page is where Riku goes after that — to see the day laid out, tick things off, add what came up. The second journey is the slow one: at a desk, planning the week, moving tiles around until the page reads the way he likes.

### Where the data comes from, and what the page says about it

Three feeds, and the page names each one when it fails:

- **Google Calendar** — the only place events live. Read live on every view, written through on create, never copied (D5). Three of Riku's calendars are *layers*: Personal (his main calendar), Classes, and Events.
- **The to-do store** — the app's own, the one manual supplement this page is allowed (D11, S13). Sections Personal, Freelance, Academics.
- **The morning run** — the dispatcher stores what it pushed, so the page can show it back.

A calendar that could not be read says so in its spot. It never renders as an empty day.

### In one line

**A personal desk on a phone: what today holds, what is due, what is coming, and the list Riku keeps — laid out the way he likes.**

### Practical framing

Desktop first, phone collapse specified (§5), matching the Freelance page's order. Riku will read the morning result on the phone and rearrange on the laptop.

---

## 2. Constraints the design must respect

1. **The product name may change.** It renders from `APP_NAME`. Nothing depends on a fixed wordmark.
2. **Missing data is not zero.** *"Couldn't read the calendar"* and *"nothing scheduled"* are different findings and need visually distinct treatments. An unreadable calendar must never draw as a quiet day.
3. **Empty is the normal state right now.** See §3. The page must look deliberate and finished when the week is blank and the to-do list has three headings and nothing under them.
4. **But it must not break when full.** §11 and §12 give both renders.
5. **Every count needs singular and plural forms**, specified inline.
6. **The container never disappears.** An empty tile is still a tile, same size, same cell. Content arriving must not move the grid.
7. **The grid is a loose weighted bento — Riku's spec, verbatim:**

   > One 12-column CSS grid with four rows. Every block sits exactly on its cells — nothing overlaps, nothing is transformed, and the gutter is the same everywhere.
   >
   > The irregularity comes from three things only: uneven column spans (blocks span different widths — a wide hero, then mixes of narrow and mid-width tiles — so no two blocks in a row share a size unless it's deliberate); uneven row heights (the four rows are weighted rather than equal — a tall first row, a short second, a medium third, a short fourth — which is what stops the page from reading as a machine-generated card grid); and one empty cell, left blank on purpose, which breaks the last bit of symmetry.
   >
   > Hierarchy is carried by size alone: the biggest block is the most important, so nothing needs an accent color or badge to signal priority. Accent color is reserved for the hero and for real state (overdue, unread, needs reply).
   >
   > The payoff is that it stays a normal grid underneath, so responsive collapse is trivial — 12 columns to 6 to 1, with the uneven row weights preserved until it stacks.

8. **The layout is Riku's to change.** What §5 shows is the *default*. Any tile can be moved and resized in an edit mode, and the arrangement is remembered on the server. The design must therefore hold for any legal arrangement, not only the default.
9. **The column is 920px**, inherited from the Freelance page (`--content-max`). Twelve columns with the 14px gutter give **63.8px per column**; a span of 3 is 219px, 4 is 297px, 8 is 609px.

---

## 3. The real data, measured 2026-09-10

Not illustrative — read live from Riku's Google account during the content discussion.

| Calendar | Holds | Last touched |
|---|---|---|
| Personal (main, `Asia/Manila`) | 12 events since 1 June; latest 2 Sep. **Nothing in the next 8 days.** | 8 Sep |
| Classes | Recurring class timetables for the Mar–Apr and Apr–Jun terms. Nothing since. | 31 Jul |
| Events | 2 entries, both in March. | 14 May |
| Org Stuff | ~50 org meetings and tasks Mar–Jun. Nothing since. **Not a layer — dropped by Riku.** | 22 Aug |
| Holidays in Philippines / United States | Subscribed feeds. **Not layers.** | — |

**Riku's reading of it, asked directly:** *"It's accurate, nothing is scheduled."* Quiet period; the calendar is still where things go when they come up. So an empty week is the true state, not a failure, and the page's first job is to look finished showing it.

**To-dos:** none exist — the store does not exist yet.
**This morning's push:** goes out at 07:00 Manila; its text is not stored anywhere today, which is why the tile that shows it needs a small store (design doc, *LastDigest*).

---

## 4. Page furniture

**Navigation** — three destinations, this being the first:

```
Personal    Freelance    Settings
```

**Page title:** `Personal`

**Header control:** `Edit layout`. In edit mode the header shows `Save` · `Cancel` · `Reset to default` instead.

**Freshness:** the page loads fresh every time. After any action — a tick, an add, a switch — the tiles that read the changed data re-read. No manual refresh control.

---

## 5. The grid and the default arrangement

Six tiles plus one empty cell, on four weighted rows.

```
 Row 1 · tall
 +------------------------------------------------+-----------------------+
 | TODAY                                + Event   | TO-DO         + To-do |
 | Thu 10 Sep                                     | 0 open                |
 |                                                |                       |
 | SCHEDULED                                      | PERSONAL              |
 | Nothing scheduled.                             |  nothing open         |
 |                                                | FREELANCE             |
 | DUE                                            |  nothing open         |
 | Nothing due.                                   | ACADEMICS             |
 |                                                |  nothing open         |
 +----------------+-------------------------------+--------------------+--+
 | LAYERS         | THIS MORNING'S PUSH                      sent 07:00 |  |
 | [x] Personal   | All clear · 0 to review                             |  |
 | [x] Classes    | All clear. Today: nothing scheduled, nothing due.   |  |
 | [ ] Events     | 0 waiting on you, 0 overdue.                        |  |
 +----------------+-----------------------------------------------------+--+
 Row 2 · short                                                    empty ^
 +------------------------------------------------------------------------+
 | NEXT 7 DAYS                                                            |
 | Fri 11   —                                                             |
 | Sat 12   —                                                             |
 | Sun 13   —                                                             |
 | Mon 14   —                                                             |
 | Tue 15   —                                                             |
 | Wed 16   —                                                             |
 | Thu 17   —                                                             |
 +------------------------------------------------------------------------+
 Row 3 · medium
 +------------------------------------------------------------------------+
 | DONE THIS WEEK   Nothing ticked off yet this week.                     |
 +------------------------------------------------------------------------+
 Row 4 · short
```

| Row | Weight | Tiles and spans |
|---|---|---|
| 1 | tall | Today **8** · To-do **4** |
| 2 | short | Layers **3** · This morning's push **8** · *(1 column empty)* |
| 3 | medium | Next 7 days **12** |
| 4 | short | Done this week **12** |

**Row weights are fixed** — tall, short, medium, short — whatever tiles sit in them. They are minimum heights; content may grow a row but never shrink it below its weight. The short second row is **200px**: the three layer switches need 44px each to stay tappable, so a smaller minimum would be one the tile already exceeds. "Short" is a little less short than first written.

**One exception, on Riku's answer of 2026-09-24.** A row whose only occupant is one tile narrower than the row shrinks to fit that tile — the weight gives way to the tile's own height. This is a general rule for every arrangement, not a rule about any one tile: any time rearranging leaves a single narrow tile alone in a row, that row closes up around it. It is suspended while edit mode is open, so moving one tile never resizes a row that is not being touched.

**The empty cell** is whatever a row has left over. The default leaves exactly one. A rearranged layout may leave more or none; that is Riku's choice.

**Collapse.** At 6 columns every span halves, rounded up (8 → 4, 4 → 2, 3 → 2, 12 → 6), so the hero stays wide and small tiles stay small. At 1 column the tiles stack in reading order — row by row, left to right. Row weights hold until the stack.

**Colour.** The accent belongs to the hero (Today) and to real state: overdue rows take the alarm colour; a calendar that could not be read takes the same treatment the Freelance health strip gives an old reading. Nothing else on the page is coloured for priority; size does that.

---

## 6. The tiles, one by one

Each tile: its job, its strings, its states. Order here is the default reading order; the arrangement may change, the strings do not.

---

### Tile 1 — Today

**Job:** the hero. What today holds and what is due, in one place. The first thing read.

**Eyebrow:** `TODAY` · **Heading:** the date, `Thu 10 Sep` · **Control:** `+ Event`, opens the event form (§7).

**Two groups, in order.**

**Group `SCHEDULED`** — today's events from every switched-on layer, all-day entries first, then by start time. Each row links to the event in Google Calendar.

```
all day      Baguio trip                       Personal
09:00–10:50  Math Methods                      Classes
13:00–13:20  Shikkari Jerard I. Ipil and …     Personal
```

Time range on the left, title, then the layer's name as a tag. A title longer than the row is cut with an ellipsis, never wrapped.

- Empty: `Nothing scheduled.`
- One layer failed, others answered: the rows that arrived, then `Couldn't read Classes.` — the layer's own name
- Every layer failed: `Couldn't read the calendar.`
- Google not set up: `Google isn't connected yet. Set it up in Settings.` — links to Settings
- Google access expired: `Google access has expired. Renew it from Settings.` — links to Settings
- No layers chosen in Settings: `No calendars chosen. Pick them in Settings.`
- Layers unreadable (database down): `Couldn't load layers, so the calendar wasn't read.`
- Bound: 20 rows, then `Showing 20 of 26.`

**Group `DUE`** — to-dos due today, then overdue to-dos. Tick boxes work here exactly as in the To-do tile.

```
[ ] Pay tuition                     Personal
[ ] Send invoice                    Freelance   3 days late
```

`3 days late` · singular `1 day late` — in the alarm colour.

- Empty (nothing due today, nothing overdue): `Nothing due.`
- To-dos unreadable: `Couldn't load to-dos.`

**Today, this tile renders as:**

```
TODAY                                   + Event
Thu 10 Sep

SCHEDULED
Nothing scheduled.

DUE
Nothing due.
```

---

### Tile 2 — To-do

**Job:** the list Riku keeps. Open items, by section.

**Eyebrow:** `TO-DO` · **Count:** `0 open` · singular `1 open` · **Control:** `+ To-do`, opens the to-do form (§7).

**Three section labels, always present, in this order:** `PERSONAL` · `FREELANCE` · `ACADEMICS`.

**Row:** tick box · title · due chip when dated · `on calendar` tag when the to-do has been put on the calendar. Tapping the row (not the box) opens the edit form.

```
[ ] Renew ID                         Fri 12
[ ] Book dentist
[ ] Send invoice                     3 days late     on calendar
```

**Due chips:** `today` · `tomorrow` · `Fri 12` (weekday and day within the next 7 days) · `24 Sep` (beyond) · `3 days late` (alarm colour; singular `1 day late`). Undated rows have no chip.

**Order within a section:** overdue first (most overdue first), then by due date, then undated items oldest first.

- Empty section: `nothing open` — the label stays
- Bound per section: 20, then `Showing 20 of 34.`
- Unreadable: `Couldn't load to-dos.` — once, in place of the sections

**Ticking** removes the row at once; it reappears in Done this week. Ticking is the only action on the row itself.

**Today, this tile renders as:**

```
TO-DO                            + To-do
0 open

PERSONAL
nothing open
FREELANCE
nothing open
ACADEMICS
nothing open
```

---

### Tile 3 — Layers

**Job:** which calendars the page reads. Saved on the server the moment a switch is tapped, so phone and laptop agree.

**Eyebrow:** `LAYERS`

```
[x] Personal
[x] Classes
[ ] Events
```

One row per calendar chosen in Settings, in the order chosen there. **Defaults when first chosen: on.** (Riku's measured use suggests Events off; that is a tap.)

- While saving: the switch is disabled
- Save failed: `Couldn't save.` under the row; the switch returns to its previous state
- No calendars chosen: `No calendars chosen. Pick them in Settings.` — links to Settings
- Unreadable: `Couldn't load layers.`

The push respects these switches too: a calendar switched off here does not appear in the morning push.

---

### Tile 4 — This morning's push

**Job:** re-read the notification after dismissing it. Read from the copy the dispatcher stores when it sends.

**Eyebrow:** `THIS MORNING'S PUSH` · **Stamp:** `sent 07:00`

**Body:** the push's title on one line, its body beneath, exactly as sent.

```
All clear · 0 to review
All clear. Today: nothing scheduled, nothing due. 0 waiting on you, 0 overdue.
```

- No push today, but an earlier one exists: `No push this morning.` then, muted, `Last: Tue 9 Sep 07:00` and that push's text
- Never stored: `No push recorded yet.`
- Monitoring switched off: `Monitoring is off, so no push goes out.`
- Unreadable: `Couldn't load this morning's push.`

*"No push this morning" is a fact worth seeing:* the missing push is the outer safety net of the whole monitoring design, and this tile is the one place it is visible in daylight.

---

### Tile 5 — Next 7 days

**Job:** the shape of the week. Tomorrow through the seventh day, one row each, events and dated to-dos together.

**Eyebrow:** `NEXT 7 DAYS`

```
Fri 11   09:00 Math Methods · Classes        [ ] Reviewer ch.3 · Academics
Sat 12   all day Baguio trip · Personal
Sun 13   —
Mon 14   07:00 Project Management · Classes
Tue 15   —
Wed 16   —
Thu 17   [ ] Renew ID · Personal
```

Within a day: all-day events, timed events by start, then to-dos. Each event links to Google Calendar; each to-do's box ticks.

- Empty day: `—`
- Calendar unreadable (any of the Tile 1 calendar states): one line at the top of the tile — the same sentence Tile 1 shows — and the days list to-dos only
- To-dos unreadable: one line at the top, `Couldn't load to-dos.`, and the days list events only
- **A day holding two or more items collapses** (Riku, 2026-09-24): it shows a short title naming what the day holds, and opens on a click to that day's full list. A day holding one item shows that item as above — no disclosure, no click. An empty day keeps its `—`
- **No bound inside an open day.** The earlier bound — 8 items, then `+3 more` · singular `+1 more` — is superseded for the open state: an opened day shows every item it holds, untruncated, so the cap and `+3 more` have nowhere left to apply. A day holding eleven items collapses exactly as a day holding two does, and opening it shows all eleven

---

### Tile 6 — Done this week

**Job:** what was ticked off in the last seven days, so finishing something leaves a trace.

**Eyebrow:** `DONE THIS WEEK` · **Count:** `3` · singular `1`

```
[x] Renew ID            Personal     Mon 8
[x] Send invoice        Freelance    Tue 9
```

Most recent first. Tapping the box un-ticks: the row leaves and the to-do returns to its section.

- Empty: `Nothing ticked off yet this week.`
- Bound: 20, then `Showing 20 of 31.`
- Unreadable: `Couldn't load to-dos.`

---

### The empty cell

Not a tile. In normal view it is blank ground. In edit mode every empty cell shows as a dashed outline so Riku can see the room a row has.

---

## 7. The forms

Forms open in place, inside the tile whose control opened them. Nothing navigates away.

### Add an event — from Tile 1's `+ Event`

| Field | Rule | Default |
|---|---|---|
| `Title` | required, up to 200 characters | empty |
| `Calendar` | one of the layers | the first switched-on layer |
| `Date` | a day | today |
| `All day` | switch | off |
| `Start` | time, shown when not all-day | the next full hour |
| `End` | time, must be after start | one hour after start |

Buttons `Add` · `Cancel`. While sending: `Adding…`, both buttons disabled.

- Validation: `Give it a title.` · `End must be after start.`
- Google refused: `Google didn't accept it: <its reason>.` — the form keeps what was typed
- No answer from Google in time: `Couldn't reach Google. Check the calendar before trying again.` — because a request that timed out may still have landed
- Success: the form closes; Today and Next 7 days re-read

### Add a to-do — from Tile 2's `+ To-do`

| Field | Rule | Default |
|---|---|---|
| `Title` | required, up to 140 characters | empty |
| `Section` | Personal · Freelance · Academics | Personal |
| `Due` | optional day | none |
| `Put on calendar` | switch; disabled until Due is set, with the note `Needs a due date.` | off |

Buttons `Add` · `Cancel`. While sending: `Adding…`.

- Validation: `Give it a title.`
- Save failed: `Couldn't save.`
- Saved, but the calendar entry failed: `Saved, but the calendar entry failed: <reason>. The to-do is not on the calendar.` — the to-do exists, the switch shows off
- Success: the form closes; the To-do tile and, when dated, Today or Next 7 days re-read

### Edit a to-do — tapping a row in Tile 2

Same fields, plus `Delete`. Buttons `Save` · `Cancel` · `Delete`.

- `Delete` asks once, in place: `Delete "Renew ID"?` · `Delete` · `Keep`
- Calendar entry could not be moved after a date change: `Saved, but the calendar entry couldn't be moved: <reason>.`
- Calendar entry could not be removed after done, switch-off, or delete: `Done, but the calendar entry couldn't be removed. Remove it in Google Calendar.` — the to-do's own change still went through

**What the calendar switch does, in words for the reader:** on, it writes an all-day entry titled after the to-do on the due day in the main calendar and remembers which entry. Moving the date moves the entry. Ticking done, switching off, or deleting removes the entry. The app never keeps a copy of the entry — only its id.

---

## 8. Edit mode

`Edit layout` in the page header. The header becomes `Save` · `Cancel` · `Reset to default`.

Every tile grows a small toolbar:

```
←  →  ↑  ↓        −  8  +        2 columns left
```

- `←` `→` swap the tile with its neighbour in the row · `↑` `↓` move it to the neighbouring row, at the end
- `−` `+` change its width by one column, between 2 and 12; `+` is disabled when the row is full
- The row caption reads `2 columns left` · singular `1 column left` · `row full`
- Empty cells show as dashed outlines
- `Reset to default` restores §5's arrangement in the editor; it still needs `Save`
- `Cancel` discards everything since edit mode opened

- Save failed: `Couldn't save the layout.` — edit mode stays open with the changes intact
- A row would exceed 12 columns: the move or `+` is disabled rather than refused after the fact

The editor never touches tile contents; the tiles keep rendering their live data while being moved.

---

## 9. Settings additions

Two cards on the existing Settings page.

**`Google Calendar`** — the state of the connection:

- `Connected.`
- `Not set up. Add the three Google values to the environment and redeploy.`
- `Access expired. Run the sign-in again and replace the token.`
- `Couldn't check right now.`

**`Calendar layers`** — every calendar on Riku's Google account, each with a tick box; ticked calendars become layers:

```
[x] Personal (main)
[x] Classes
[x] Events
[ ] Org Stuff
[ ] Holidays in Philippines
[ ] Holidays in United States
```

- Saved on tap · while saving the box is disabled · failed: `Couldn't save.`
- Google not set up or expired: the card shows the same sentence as the connection card and no list
- Couldn't list: `Couldn't list your calendars.`
- Bound: 10 layers; an eleventh tick says `Up to 10 calendars.`

Unticking a calendar removes its layer and its switch from the page. Events from it stop appearing in the push.

---

## 10. The push's Today sentence

The push keeps its title. The body gains one sentence in second place — after the problems line, before the freelance line.

```
All clear. Today: Math Methods 09:00, Meeting 13:00. Due: Pay tuition (today), Reviewer ch.3 (Fri). Overdue: Send invoice (3d). 0 waiting on you, 0 overdue.

All clear. Today: nothing scheduled, nothing due. 0 waiting on you, 0 overdue.

1 problem · 0 to review
Calendar check unavailable. Today: calendar unavailable. Due: Pay tuition (today). 0 waiting on you, 0 overdue.
```

**Rules:**

- `Today:` names up to 3 events, each `Title HH:MM` (all-day: `Title (all day)`), then `+2 more` · singular `+1 more`
- `Due:` names up to 3 to-dos due within the next 3 days, each with the day in brackets: `(today)` · `(tomorrow)` · `(Fri)`; then `+2 more`
- `Overdue:` names up to 3, each with days late: `(3d)` · `(1d)`; then `+2 more`
- Absent parts are omitted, except that an entirely empty Today reads `Today: nothing scheduled, nothing due.`
- A calendar that could not be read: `Today: calendar unavailable.` in the sentence **and** `Calendar check unavailable.` counted in the problems, so the title's count never says all clear over a blind spot
- **Some layers answered and one did not:** the sentence names what arrived and then names the calendar that was not read — `Today: Math Methods 09:00. Classes wasn't read.` — and the miss is still counted in the problems, so a partial reading never passes as a complete one
- To-dos that could not be read: `Due: to-dos unavailable.` and `To-do check unavailable.` in the problems, the same way
- **Problem fragments are written lowercase and without a full stop.** The push joins the fragments and adds the terminal stop itself, so `Calendar check unavailable.` above is the *rendered* form of the fragment `calendar check unavailable`, not the fragment as written. The same holds for `To-do check unavailable.` and every other problem fragment
- Only switched-on layers count
- The body limit rises from 200 to 320 characters so Today cannot push the freelance line off the end. Problems still come first, so a bad night is never cut off

---

## 11. Whole-page states

**Signed out:** the page is not reachable; the app sends Riku to sign in.

**The grid always renders.** There is no whole-page-down state: the arrangement falls back to the default when it cannot be read, and each tile carries its own sentence. Two feeds down at once look like this:

```
Personal                                              Edit layout

TODAY                                                 TO-DO
Thu 10 Sep                                            Couldn't load to-dos.
SCHEDULED
Couldn't load layers, so the calendar wasn't read.
DUE
Couldn't load to-dos.

LAYERS                    THIS MORNING'S PUSH
Couldn't load layers.     Couldn't load this morning's push.

NEXT 7 DAYS
Couldn't load layers, so the calendar wasn't read.
Couldn't load to-dos.

DONE THIS WEEK
Couldn't load to-dos.
```

**Why the week tile shows no day rows there** (Riku's nod, 2026-09-24): `—` means a day that was read and held nothing. With both feeds down nothing was read, so a row of dashes would be seven small lies. The tile shows only its two failure sentences; the row keeps its height.

**Google down, database fine:** every calendar spot says `Couldn't read the calendar.`; to-dos, layers, the push and edit mode all work.

**Busy:** only the forms and the switches have busy states. Everything else arrives with the page.

---

## 12. Today's page, end to end

The complete real render as of 2026-09-10 — what the design must make look finished:

```
Personal    Freelance    Settings

Personal                                                       Edit layout

TODAY                                    + Event   TO-DO              + To-do
Thu 10 Sep                                         0 open
SCHEDULED                                          PERSONAL
Nothing scheduled.                                 nothing open
DUE                                                FREELANCE
Nothing due.                                       nothing open
                                                   ACADEMICS
                                                   nothing open

LAYERS            THIS MORNING'S PUSH                            sent 07:00
[x] Personal      All clear · 0 to review
[x] Classes       All clear. Today: nothing scheduled, nothing due.
[ ] Events        0 waiting on you, 0 overdue.

NEXT 7 DAYS
Fri 11   —
Sat 12   —
Sun 13   —
Mon 14   —
Tue 15   —
Wed 16   —
Thu 17   —

DONE THIS WEEK   Nothing ticked off yet this week.
```

---

## 13. A plausible future page, end to end

Same default arrangement, mid-term, a real week. Invented values — for designing the populated case only.

```
Personal    Freelance    Settings

Personal                                                       Edit layout

TODAY                                    + Event   TO-DO              + To-do
Mon 19 Oct                                         6 open
SCHEDULED                                          PERSONAL
07:00–08:50  Project Management       Classes      [ ] Renew ID           Fri 23
09:00–10:50  Math Methods             Classes      [ ] Book dentist
13:00–13:30  Call with Nova Dental    Personal     FREELANCE
DUE                                                [ ] Send invoice   3 days late  on calendar
[ ] Pay tuition                       Personal     [ ] Revise proposal    Wed 21
[ ] Send invoice          Freelance   3 days late  ACADEMICS
                                                   [ ] Reviewer ch.3      tomorrow
                                                   [ ] Lab report 2       26 Oct

LAYERS            THIS MORNING'S PUSH                            sent 07:00
[x] Personal      1 problem · 2 to review
[x] Classes       Meowchi unreachable. Today: Project Management 07:00,
[ ] Events        Math Methods 09:00, Call with Nova Dental 13:00. Due: Pay
                  tuition (today), Reviewer ch.3 (tomorrow). Overdue: Send
                  invoice (3d). 1 waiting on you, 0 overdue.

NEXT 7 DAYS
Tue 20   09:00 Math Methods · Classes      [ ] Reviewer ch.3 · Academics
Wed 21   07:00 Project Management · Classes      [ ] Revise proposal · Freelance
Thu 22   09:00 Math Methods · Classes      15:00 Image Processing · Classes
Fri 23   07:00 Project Management · Classes      [ ] Renew ID · Personal
Sat 24   all day Baguio trip · Personal
Sun 25   all day Baguio trip · Personal
Mon 26   07:00 Project Management · Classes      [ ] Lab report 2 · Academics

DONE THIS WEEK   3
[x] Submit clearance form      Academics    Sun 18
[x] Reply to sir Pura          Personal     Sat 17
[x] Update DP blast            Freelance    Thu 15
```

---

## 14. Checklist for whoever designs this

- [ ] Looks finished with §12's blank week
- [ ] Does not break with §13's full week
- [ ] Holds for any legal arrangement, not only §5's default — including a hero moved to row 3 or shrunk to 4 columns
- [ ] "Couldn't read the calendar" is visually distinct from an empty day
- [ ] The row weights survive the collapse to 6 columns and read as tall, short, medium, short at 12
- [ ] Only the hero and real state carry colour; importance is size
- [ ] The empty cell reads as intentional at 12 columns and disappears cleanly when tiles stack
- [ ] Edit mode is obviously a mode: the toolbars and dashed cells cannot be mistaken for content
- [ ] The forms open in place without moving the grid
- [ ] The product name is replaceable

---

## 15. Strings ratified 2026-09-24, and one on 2026-09-25

Eleven states had no words when this deck was written. Most of them are failures that only surfaced once the page was drawn — a calendar that vanished from Google, a tick that got no answer, a tile too narrow to hold a form. Riku read all eleven on 2026-09-24 and approved them as written. They live here with the rest, because this deck is where the words live.

**Every calendar layer switched off.** On the page, where the events would have been: `All layers are switched off.` In the morning push: `Today: no layers switched on.` It is a choice and not a fault, so neither is counted as a problem.

**The push went out but its text was not stored.** In Tile 4, in place of the quotation: `A push went out this morning. Its text wasn't stored.`

**One calendar could not be read for the push.** The sentence names what arrived and then names the calendar that did not: `Today: Math Methods 09:00. Classes wasn't read.` — and the miss is counted in the title's problems, so the push never reads all clear over a blind spot (§10).

**The edit form's `Delete` failed.** `Couldn't delete.` under the row. Its busy labels, beside §7's `Adding…`: `Saving…` and `Deleting…`

**A tick or a switch that got no answer in time.** `Couldn't tell if that saved.` Not *couldn't save*: a request that timed out may still have landed, and the page must not claim an outcome nobody knows.

**Deleting a to-do that is on the calendar.** The confirmation names the entry too: `Delete "Renew ID" and its calendar entry?`

**A calendar entry that outlived its to-do.** On the Done row of a to-do whose entry could not be removed: `entry left on Google`. On the open row of a to-do whose entry could not be moved after a date change: `entry on the old day`

**An event added outside the coming week.** `Added. It's on Fri 24 Oct, outside this week.` — so a successful add that lands where the page cannot show it does not read as nothing having happened.

**A chosen calendar that no longer exists on Google.** `Classes is no longer on your Google account. Untick it in Settings.` It is permanent and it hands over a lever, so it reads as a setting to fix rather than a reading to retry. The layer stays in the Settings list, ticked and live, so there is something to untick.

**The saved arrangement could not be read.** `Couldn't load your arrangement, so this is the default.`

**The tile is too narrow to open a form in.** `Too narrow for the form.` — under the head, where the switched-off `+ Event` or `+ To-do` sits. The form is refused before the fact; no arrangement is taken away.

**Two rules nodded to at the same time.**

- `Connected.` on the Settings connection card (§9) means *your calendar list came back* — not merely that the sign-in token refreshed. The state between pasting the token and switching the Calendar API on is the first one Riku will hit, and only the list proves it.
- `No push this morning.` (§6, Tile 4) turns red only once 07:00 has passed. Before then the sentence stands on its own: it is simply true at 00:30, and only the alarm would be lying.

**One older string, kept where it already was.** `Up to 10 calendars.` (§9) is Riku's own and is not one of the eleven. It stays a press outcome — it appears under the picker row whose tick was refused, at the moment it is refused, and never as a standing note on the card.

**And one more, ratified a day later — 2026-09-25.** The day row's collapsible did not exist when the eleven were read, so the count it needs had no words yet. `2 items` / `3 items`, in Tile 5 (§6) on a **collapsed** day row, beside the leading item's own title, where the day holds more than one thing. It is deliberately generic, because a day mixes events and to-dos, and **no singular form is needed**: a day only collapses at two or more, so there is no `1 item`. Dated separately from the eleven because it was approved separately, after them.

**And one short rendering of a sentence already in this deck — also 2026-09-25, and not a new sentence at all.** `3 days late` / `1 day late` is the wording, in Tile 1's `DUE` and Tile 2's due chips (§6) and in the page walked end to end (§13), and it stays. At one width it does not fit: a tile shrunk in the layout editor to the narrowest cell the grid allows — 1 of 6, 106 pixels — puts the due chip on a line of its own with 52 pixels to spend, and `3 days late` needs 62.7. In that narrow band, and only there, the chip reads `3d late` / `1d late`. Every other width the page can reach keeps the full form. Riku read both renderings and the shorter `3d` beside them and chose this one, because `3d` leaves the alarm colour carrying the meaning with no word behind it. **The count of new sentences he ratified is unchanged** — eleven on 2026-09-24, `2 items` above — because this is the same sentence, said short, in the one cell that cannot hold it.
