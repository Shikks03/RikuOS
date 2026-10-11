# Smooth feel — loading outlines, instant presses

**Date:** 2026-10-11 · **Status:** design agreed with Riku in conversation ("yes"); this document awaits his review.
**What it is:** the first queued sub-project from the Briefing work (`rikuos-assistant-voice`, queued item 1): pages that load smoothly, and presses that show at once while the server works. **It changes how the app feels, not what it says or stores.**
**Not in scope:** restyling the queue page (still the plain v0 version; its redesign belongs to P12), the Academics page (P11 gets its own outline when it is built, under this document's rules), voice commands, drag-and-drop tiles.

---

## 1. Riku's answers

| # | Question | Answer |
|---|---|---|
| 1 | Which moments feel slow? | All four: opening the app, switching pages, adding things, buttons and switches |
| 2 | What to see while a page loads? | Both: the page's outline at once **and** a thin bar across the top |
| 3 | How should a just-added item look before it's confirmed? | Faded, with a small "saving" mark, until saved |
| 4 | Approve / Reject in the queue? | The card leaves at once, with its own exit animation |

He accepted the summary design (§2–§6) as written.

### What the app does today (measured from the code, 2026-10-11)

- **A to-do tick is already instant.** The row hides on press and comes back only on a definite failure (TodoRow, LayoutEditor's hide/settle/reveal).
- **No route has a `loading.tsx`.** A menu tap leaves the old page frozen until the new page's server render finishes.
- **The Personal page** streams its calendar tiles behind Suspense, but waits for its Mongo round (phase 1) before anything draws.
- **The to-do add form, the event form, the layer switches, the Settings switches and the queue buttons** all wait for the server before anything changes on screen.

---

## 2. The approach

**Small changes inside the existing structure, with no new library.** Two alternatives were turned down:

- **A client-side data cache** (SWR / React Query). It would turn the server-rendered pages into client fetchers, which is a rewrite of every page for a feel change.
- **Showing the last-seen page instantly on open** from a service-worker cache. It would present stale numbers as current, which breaks the constraint every page spec carries ("missing data is not zero"; nothing pretends).

The tools used are Next's own `loading.tsx` Suspense boundaries, `useLinkStatus` for the bar, and React 19's `useOptimistic` for presses. **`pressOutcome` (L7) stays the one rule for what a press's answer means.** Nothing in this work re-derives it.

---

## 3. Opening the app and switching pages

### 3.1 Outlines

- Each route under `(app)` gets a `loading.tsx` that draws **that page's outline**: the same grid, the same boxes with their headings, and grey bars where text will go. The routes are `/freelance`, `/freelance/queue`, `/personal` and `/settings`. Any page added later gets its own outline when it is built.
- **The outline is the real page's frame, not a generic spinner.** Box sizes and positions match the loaded page, so nothing jumps when content arrives. The outline has to appear without waiting for the server, so it can't read the saved arrangement from the database. Instead, the Personal page **remembers its last arrangement in the browser** (`localStorage`, wrapped in try/catch) each time it renders, and its outline draws from that, falling back to the default arrangement. This copy is a per-device convenience and never the record. The server's arrangement always wins when the page lands, so a stale or missing copy costs one layout shift and nothing more.
- **An outline never contains a number, a word of content or a fake row.** Headings and labels are fixed text and may show; figures, names and counts never do. A loading box can never be mistaken for "nothing there", which keeps `Nothing due.` and a loading list distinguishable.
- **The Personal page draws in two waves.** First its outline shows, then the Mongo-fed tiles fill in, then the calendar tiles stream in behind their existing Suspense fallbacks. The fallbacks that exist today keep their wording.
- Outline bars use the design system's quietest surface tone (no new colour), with a slow shimmer that is switched off under `prefers-reduced-motion`.

### 3.2 The top bar

- A **2px bar across the top** of the content area runs while a navigation is pending, and finishes and fades when the new page has rendered. It starts on the menu links, the Freelance/Queue view switch, and any other in-app `<Link>`.
- It appears only after a short delay (about 150 ms), so a fast navigation doesn't flash it.
- It is **not a real progress measure**, and it doesn't pretend to be one. It eases towards about 80% and holds there until the page lands.
- Built in-house on `useLinkStatus` (Next 15.3+; the app is on 16.2), with no router monkey-patching and no dependency. `useLinkStatus` reports per link, so each in-app link carries a small child that reports its pending state into one shared context, and the bar reads that context. The plan confirms the hook's behaviour on 16.2 before relying on it. If it falls short, the fallback is a context set on link click and cleared on the pathname change.

### 3.3 The honest limit

If the serverless function has gone to sleep, the first second or two after opening the app is blank, because an outline can only appear once the server starts answering. **The build measures this:** cold and warm opens on Riku's phone, time to first outline. Whether it earns more work, such as a static launch screen from the service worker that holds no data, is decided from those numbers and not assumed here.

---

## 4. Adding a to-do or an event

The pattern below is shared by the to-do add form (Tile 2's `+ To-do`) and the event form.

| Moment | What Riku sees |
|---|---|
| Press **Add** | The form closes. The new item appears **at once in every place it belongs** (e.g. Today *and* Next 7 days), faded, with a small `saving` mark. Focus goes back to the pill the form opened from, as on a successful add today. |
| **ok** | The page re-reads, as now. The server's real row replaces the stand-in, so it turns normal, and the draft is forgotten. |
| **failed** (definite) | The stand-in disappears. The form reopens **with everything Riku typed** and the door's sentence (`Couldn't save.` or the specific one, e.g. `Google didn't accept it: …`) above the buttons. Focus goes to the form's first field. |
| **unknown** | The stand-in stays faded, its mark changes to `couldn't tell if that saved`, and the page re-reads. If the server's render has the item, the stand-in is replaced. If it doesn't, the stand-in is removed and the tile's note says `Couldn't tell if that saved.`. **The add draft stays parked**, as today: reopening the form shows `Add` refused and `Cancel` live, so an item that may already exist is never added twice. |

- **Stand-ins are never sent anywhere and never survive a reload.** They are client state only, and the server render always wins.
- **A stand-in can't be ticked, edited or deleted** while it's saving. Its controls are refused (L9: `aria-disabled` plus a guard), and it reads as one quiet row.
- Edits to an existing to-do (`Save`) keep today's behaviour: the form stays open with `Saving…`. They aren't part of Riku's "adding things" answer, and an edit already shows its values where he typed them. The **delete** press is already instant (it hides before the request).

---

## 5. Switches

Switches that save on press: the **Personal page's layer switches**, **Settings' agent switches** and **Settings' calendar picker ticks**.

| Moment | What Riku sees |
|---|---|
| Press | The switch **flips at once**. While the save is in flight the switch is refused (L9) so it can't be double-flipped. |
| **ok** | It stays. The page re-reads where it does today. |
| **failed** | It **flips back**, with `Couldn't save.` (or the door's own sentence, e.g. `Up to 10 calendars.`) where that switch's sentence sits today. |
| **unknown** | It stays where Riku put it, `Couldn't tell if that saved.` shows, and the page re-reads. The server's render decides the switch's final position. |

**Refusals made before any request** (e.g. an eleventh calendar, `Up to 10 calendars.`) never flip at all, as today.

---

## 6. The approval queue

**Approve, Approve edited and Reject: the card leaves at once with its own exit animation.** It collapses and slides out, about 200 ms, or simply disappears under reduced motion. Focus moves to the next card's first button, else the previous card's, else the list heading.

| The door's answer | What happens |
|---|---|
| **ok, and the action finished** (`actionStatus: done`, or a reject) | Nothing more. The card is gone, and the list re-reads quietly. |
| **ok, decision saved but the draft didn't reach ShikksTracker** (`actionStatus: failed`) | A line at the top of the queue: `Approved, but the draft didn't reach ShikksTracker. It's under Approved, with a retry.` The filter name is a link that switches to that filter. |
| **ok, and it can't be told whether the draft arrived** (`needs_verification`) | A line at the top: `Approved, but I can't tell if the draft reached ShikksTracker. It's under Approved. Check there before doing anything else.` There's no retry, the same as today's card wording. |
| **failed** (the decision itself didn't save) | **The card comes back** in its old place, with the door's reason under its buttons. |
| **unknown** (timeout, no answer) | The card stays gone, the line at the top says `Couldn't tell if that went through.`, and the list re-reads. The server decides whether the card comes back as still pending. |

- **The queue's own load** gets the outline treatment from §3 in place of its `Loading…` line.
- The queue page currently reads its answers ad hoc (`res.ok` and `body.error`). **It moves onto `pressOutcome`** so the same honesty rule governs it as every other press. A queue answer that is not the door's own JSON is unknown, never a claimed failure.
- The wording in this section is **provisional**, for Riku's nod at review.

**The Debrief button is unchanged.** It honestly takes 10–20 s and already says `Checking your sites and ShikksTracker…`.

---

## 7. Rules across all of it

1. **`pressOutcome` decides every press's meaning** (L7). An optimistic change is undone only on `failed`. On `unknown` the page re-reads and the server decides. **A failure is claimed only when it is known** (CLAUDE.md's asymmetric rule).
2. **The server render always wins.** Every optimistic state ends at the next server render after its press. Nothing optimistic is stored, cached or carried across a reload.
3. **Motion is short and switched off under `prefers-reduced-motion`.** Exits about 200 ms, the bar's fade about 200 ms, outline shimmer slow and subtle. No motion carries meaning on its own: every state also has its words or its mark.
4. **Focus never falls to `<body>`** when something leaves (P10's S1 rule, extended to the queue and to stand-ins).
5. **No effect hooks for focus** (R33): focus moves inside handlers, as on the Personal page.
6. **Lint stays at its baseline.** The four `set-state-in-effect` errors are not added to, and the queue page's `useEffect` load is not made worse.

### Supersedes

- **P10 lead ruling R21's "a failed press restores nothing locally"**, but **for switches only**: a layer switch, agent switch or calendar tick now flips on press and flips back on a definite failure. R21's other parts stand: no zeroed figures under a failed read, `Couldn't save.` reuse, and unknown never asserted as failure. So does its core for ticks and deletes: the hide, and the server deciding.
- **CalendarPicker's and LayerSwitches' "nothing flips locally" island rule** (same change, same scope).
- **TodoForm's and EventForm's add outcome "ok: the form closes"**, which becomes "the form closes on press" with §4's outcomes. The parked-draft rule for an unknown add is kept.
- **The queue page's own answer handling**, replaced by `pressOutcome`.

**Unchanged:** every string the app already says (only §6's new lines are added), L7, L9, R33, S1, the approval rule, and the Debrief.

---

## 8. Testing and "done"

- **Logic tests** (Vitest, `src/lib/__tests__/`): the pure parts are pulled out and pinned. That covers the stand-in reducer (add → ok / failed / unknown, replace-on-render), the switch outcome mapping, and the queue's answer-to-line mapping (`done` / `failed` / `needs_verification` / failed decision / unknown).
- **Browser checks on an isolated copy** (the Verification Lead method from the Briefing and Debrief builds), with a slowed network and forced door answers, covering each row of the tables in §4–§6, reduced motion, and focus after each exit.
- **The verification trio** green, with lint at baseline.
- **Done when** Riku has used it on his phone: a menu tap shows the outline and bar at once, an add shows faded then normal, a switch flips at once, and an approve slides the card away. The cold-open measurement in §3.3 is recorded.

---

## 9. Build shape

Four features, each reviewed once when finished (Riku's per-feature review rule):

| Feature | Covers |
|---|---|
| **F1 — Outlines and the top bar** | `loading.tsx` for the four routes, the shared outline pieces, the bar on `useLinkStatus`, the cold-open measurement |
| **F2 — Instant adds** | the stand-in pattern in TodoForm (add) and EventForm, shared across the tiles that show the item |
| **F3 — Instant switches** | LayerSwitches, AgentSwitches, CalendarPicker |
| **F4 — The queue** | exit animation, focus, `pressOutcome`, the top-of-queue lines, the queue outline |

F1 is independent. F2 and F3 share only the outcome helpers. F4 is independent. The order is F1 → F3 → F2 → F4, smallest risk first, with the most visible change landing first.
