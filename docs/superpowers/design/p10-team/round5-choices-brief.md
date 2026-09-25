# P10 round 5 — the five choices, written up for Riku

**Purpose:** content for the short decision page that shows Riku's five remaining calls, each as a side-by-side picture, so he can point at the one he wants. Sourced from `round3-lead-rulings.md` (R1–R37, especially §K), `round4-lead-rulings.md` (R38–R49, "Not changed", "For Riku — additions to §K"), and the `.spec-q` blocks in `docs/design/p10-mockup.html`. All measured numbers below are read straight from the mockup's own captions, not recomputed.

---

## 1. The phone

**The question:** Right now the menu down the left side of every page is a strip 170 pixels wide, even on a phone. That leaves only about a third of a phone's screen for the actual page. Do you want that fixed now, or left for a later, dedicated phone design?

**Option A — fix it now.** On a narrow phone screen, the left strip turns into a thin bar across the top instead, and the page gets the phone's full width. Both the "add an event" and "add a to-do" buttons work at this width. The cost: the small coloured dots that show whether each background helper is running currently have no place to sit on a phone, so they disappear from the phone menu until a proper phone design happens.

**Option B — leave it.** The page stays built for a laptop screen for now; a full phone design comes later, on its own. The cost: with the menu strip still eating a third of the screen, the page is too narrow to open either the "add an event" or "add a to-do" box at all — both buttons are switched off. The whole reason this page exists — the phone buzzes at 7am, you open it, you deal with your day — doesn't really work yet on a phone.

**Who said what:** The person leading the design work recommends A, meant only as a stand-in until a real phone design replaces it. Four of the five people on the design team preferred B, on the reasoning that one page's design round shouldn't be the thing that changes the menu for the whole app.

**Where it is drawn:** Specimen 8, "The stack, drawn honestly" (`docs/design/p10-mockup.html`, lines 3078–3258). Two phone-width pictures side by side: the menu-strip version at roughly lines 3084–3168, the top-bar version at roughly lines 3170–3247. The question itself is spelled out at lines 3250–3257.

**What Riku's answer changes:** This changes the menu for the *whole app*, on every phone-width screen — not just this one page. Picking A means the app ships with a placeholder phone menu until a real phone design round happens later. Picking B means nothing about the menu changes now, and a phone user is limited to reading the morning notification until that later round.

---

## 2. The week tile

**The question:** The "Next 7 days" box can show its seven days in two side-by-side columns, or in one single list running down the page. Which do you want?

**Option A — two columns** (four days on the left, three on the right). This keeps that row a medium height: on the empty week you have today, it's 240 pixels tall; on a busy week (using invented sample data, just to test the design), about 328 pixels. The cost: because the box only splits into two columns once it's wide enough, its shape isn't fixed — it changes depending on how much room the page has at the time.

**Option B — one column**, all seven days in a single list. On the empty week, this row grows to 361 pixels tall — taller than the box at the very top of the page. On a busy week the gap narrows to about 363 pixels, because a busy day's details wrap onto a second line in a narrower column. The cost: your own plan for the page reads "tall, short, medium, short" from top to bottom; one column turns that into "tall, short, tall, short" instead.

**Who said what:** The team member who designed the grid ruled for two columns (option A). The design critic pushed back — a box whose shape changes with the page's width feels inconsistent — but the recommendation stands at two columns until you say otherwise.

**Where it is drawn:** Specimen 1, "The blank week." The two-column version is the main picture, lines 1333–1435 (the box itself is at 1414–1424). A second full picture of the one-column version sits right after it, lines 1497–1569, labelled "B-panel." The busy-week numbers (328 vs. about 363) are written out as text only, in the question at lines 1571–1576 and the caption at line 1585 — the busy week is only ever pictured in two columns (specimen 2); the one-column busy version is not drawn, only its number is stated.

**What Riku's answer changes:** Sets how tall that row — and the whole page — is, at every screen size, and becomes a written rule in the design spec either way.

---

## 3. The hero's look

**The question:** The "Today" box, top-left, is the most important one on the page. Four different quiet ways of marking it as special were drawn. Which one ships?

- **A — as recommended.** A touch darker background, a touch brighter border, slightly rounder corners than every other box. No colour anywhere.
- **B — no mark at all.** Looks exactly like every other box on the page.
- **C — lighter background plus an inner line.** An early idea, tried and dropped: a slightly lighter background with a second thin line drawn just inside the border.
- **D — a touch of blue.** A faint blue tint in one corner — the one place the design's rules allow any colour at all, anywhere on the page.

**Who said what:** Both the design critic and the person leading the design pick A. It also happens to be the only one of the four that keeps the page's "no colour except real warnings" rule intact.

**Where it is drawn:** Specimen 1. All four side by side at the wider size, lines 1444–1465; all four again at a narrower size, lines 1466–1487. The question is at lines 1489–1493.

**What Riku's answer changes:** Fixes the exact look of the single box you'll look at every morning. If A ships and you later want it to stand out more, the honest way to do that is a brighter border — never a splash of colour; that's the one path this decision leaves open.

---

## 4. A row holding only one small box

**The question:** After you rearrange the boxes, you can end up with a row holding just one narrow box — for example, "This morning's push" sitting alone in the top row, with a lot of empty space beside it. Should that row shrink down to fit just that one box, or keep the same height as every other row, with open space left under the box?

**Option A — shrink to fit.** The row becomes only as tall as the box needs. In the drawn example, the row drops to 131 pixels.

**Option B — keep the full height.** The row always stays at its planned height (340 pixels here), with plain empty ground under the small box. This matches what you originally wrote — that a row's height doesn't change depending on what's sitting in it.

**Who said what:** No recommendation is on record either way — this one is entirely yours. It's drawn both ways specifically so you can compare and decide.

**Where it is drawn:** Specimen 4 ("Edit mode" section). The shrink-to-fit picture is at roughly lines 2372–2416; the full-height picture right after it, lines 2417–2461. The question is at lines 2462–2465.

**What Riku's answer changes:** This isn't just about the push box — it sets a general rule for every future arrangement. Any time you rearrange things and end up with one narrow box alone in a row, this decides whether that row shrinks around it or keeps its full height with open space.

---

## 5. The wording

Eleven new sentences the app will need to show, two small edits to your own content document, and two existing rules that just need your nod. None of this is drawn as a separate "pick A or B" choice — it's a straight read-and-approve, with your wording winning over anything proposed here.

**Where it is drawn:** The two document edits are asked right after specimen 3's failure-state pictures, lines 1845–1850. The eleven sentences and the "not drawn" notes are gathered in one place at the very end of the mockup (the "Closing" section, lines 3265–3282). The two nods are just below that, lines 3283–3286.

### The eleven sentences (verbatim from the mockup's closing block)

1. Every calendar layer switched off — on the page: *All layers are switched off.* In the push: *Today: no layers switched on.* (not drawn; or the push's existing Off: shape, e.g. *Off: calendar layers.*)
2. The morning push went out but its text was not stored: *A push went out this morning. Its text wasn't stored.*
3. One calendar could not be read for the push: *Today: Math Methods 09:00. Classes wasn't read.* — and it counts as a problem in the title.
4. The edit form's Delete failed: *Couldn't delete.* Busy labels: *Saving…* (not drawn) and *Deleting…*
5. A tick or switch that got no answer in time: *Couldn't tell if that saved.*
6. Deleting a to-do that is on the calendar: *Delete "Renew ID" and its calendar entry?*
7. A done to-do whose calendar entry could not be removed, on its Done row: *entry left on Google* — and after a failed move, on the open row: *entry on the old day*
8. An event added outside the coming week: *Added. It's on Fri 24 Oct, outside this week.*
9. A chosen calendar that no longer exists on Google: *Classes is no longer on your Google account. Untick it in Settings.*
10. Your saved arrangement could not be read: *Couldn't load your arrangement, so this is the default.*
11. The tile is too narrow to open a form in: *Too narrow for the form.*

One sentence from Riku's own document is not drawn: *Up to 10 calendars.* It appears under a calendar's row in Settings when he ticks an eleventh — and only then; he currently has six.

### Two edits to Riku's content document (verbatim)

(a) When both the calendar and the to-do list fail to load, the week box shows only the two failure sentences and no day rows — because a dash means "we looked and the day was free," which isn't true when nothing was looked at. This removes the seven `Fri 11 — … Thu 17 —` rows from the document's example of that state.

(b) The problem fragments inside the push are written in lowercase and joined together; *Calendar check unavailable.* is how it renders first in that list.

### Two rules that need only a nod (verbatim)

*`Connected.`* in Settings means your calendar list came back, not just that the sign-in token worked; and *`No push this morning.`* only turns red after 07:00.

**What Riku's answer changes:** Approving the eleven sentences sends them, word for word, into the shipped page and push text. Approving the two document edits updates Riku's own content document to match. Nodding to the two rules just confirms the app already behaves that way — no wording changes needed for those two.

---

## What the page must not claim

- **The one-column busy week is not pictured.** Only its two numbers (about 328 vs. about 363 pixels) are written down, in specimen 1's question and specimen 2's caption. Do not invent a picture of a busy week in one column — it doesn't exist in the mockup.
- **The ten-calendar refusal (`Up to 10 calendars.`) is not drawn.** Riku only has six real calendars in his account; the team deliberately did not invent five fake ones just to show the message. It's described in text only.
- **Two of the eleven sentences are not drawn either:** the push's *"Today: no layers switched on."* version, and the *"Saving…"* busy label. Both are text-only, explicitly marked "(not drawn)" in the mockup.
- **No sample data is invented beyond what's already in the mockup.** The only made-up content anywhere in the whole mockup is one sample "busy" week (used so the full page could be shown with something in it); everything else — names, to-dos, calendar entries — comes straight from Riku's own content document. Don't add new sample events, to-dos, or calendars when building this page.
- **The dashed "leftover space" marker is never drawn on a phone-width page.** A single-column stack has no leftover space to mark, so there's nothing to draw there.
- **Don't add a fifth hero option, a third phone-menu option, or any other alternative not already described above.** Only the options listed here were built and reviewed.
