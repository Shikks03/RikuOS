# P11 — The Academics page: content

**Date:** 2026-10-11 · **Status:** APPROVED by Riku 2026-10-11 ("looks good to me"), including the five defaults marked *(default)* below and the §5 school-line wordings. S23 recorded in `ARCHITECTURE.md` §7.
**Satisfies:** S11 for this page. Held 2026-10-11, thirteen questions answered by Riku; each decision below cites his choice. **Nothing here was inferred from another page's discussion.**
**Not in scope:** visual design (a design step follows once this is approved, S12/S17), the planner, the modules/reviewers area, timetable entry (§9).

---

## 1. What this page is

Coursework lives in Canvas, and Canvas only tells Riku about it when he goes and looks. This page reads Canvas live and answers one question first: **what's due soon?** It then shows today's classes, unread announcements and grades. The 07:00 Briefing gains a line about school, so the push reaches him even when he doesn't open the page.

**It is read-only towards Canvas.** Nothing on the page changes anything there. Tapping a Canvas item opens it in Canvas. The one thing Riku can act on here is his own to-dos (§4.1), which are the app's own data.

**No agent acts on this page.** Nothing goes through the Approval Queue, because nothing outward happens.

**The phase is done when** the page shows Riku's real courses from his real Canvas, and one 07:00 Briefing names real Canvas work (or correctly says nothing is due).

### Riku's answers, in order

| # | Question | Riku's answer |
|---|---|---|
| 1 | Where are you with school? | In a term, on Canvas |
| 2 | What should the page answer first? | What's due soon |
| 3 | How complete is Canvas? | Nearly everything is on it with a due date |
| 4 | What else belongs on the page? | Grades, announcements, today's classes. **Not** the study progress counter |
| 5 | How does the timetable reach the Classes calendar? | He adds it himself, once a term |
| 6 | The sentence-to-schedule planner? | Later, not now |
| 7 | How far ahead does the due list look? | Everything, grouped This week / Next week / Later |
| 8 | Submitted and past-due work? | Hide submitted; past-due unsubmitted goes on top as Missing |
| 9 | Canvas in the 07:00 Briefing? | Yes: due today or tomorrow, plus anything missing |
| 10 | Grades? | Both: recently graded work and each course's total |
| 11 | Which announcements? | Unread ones only |
| 12 | Layout? | The due list leads; classes, announcements and grades below |
| 13 | His Academics to-dos on this page? | Yes, mixed into the due list, marked as his |

Then, on the summary, Riku accepted live reads (§6) and the two defaults in §4.1 ("alright").

---

## 2. Where the data comes from

Three feeds. The page names each one when it fails; a feed that couldn't be read never draws as an empty one.

- **Canvas** — read live on every view with Riku's personal access token, the same way the calendar is read (D5's spirit: no copy kept). Two env vars: `CANVAS_BASE_URL` (his school's Canvas address, `https://` required) and `CANVAS_TOKEN`. Nothing from Canvas is stored in the database.
- **Google Calendar** — the Classes calendar, read through the existing calendar code. Riku fills it himself each term (answer 5).
- **The to-do store** — open to-dos in the `academics` section (answer 13). Existing data, existing endpoints.

**Which courses:** only courses where Riku's enrollment is currently active. Past terms' courses never appear. **Course names** are shown as Canvas shows them to him, which includes any nickname he has set inside Canvas, so he renames a course in Canvas and not in this app.

---

## 3. Page structure — top to bottom (answer 12)

```
MISSING & LATE (2)
  Lab report 2 · Image Processing              missing · due Oct 9
  Renew library card                 to-do     late · 2 days

THIS WEEK
  Quiz 4 · Math Methods                        today 23:59
  Essay draft · Project Management             Thu 17:00
NEXT WEEK
  Problem set 5 · Math Methods                 Mon 23:59
  Reviewer ch.3                      to-do     Wed
LATER
  Final project · Image Processing             Nov 28
NO DATE
  Print lab manual                   to-do

TODAY'S CLASSES
  07:00–08:50  Project Management
  09:00–10:50  Math Methods

UNREAD ANNOUNCEMENTS (2)
  Room change on Thursday · Math Methods       Oct 10
  Project rubric posted · Project Management   Oct 8

GRADES
  Recently graded
    Quiz 3 · Math Methods                      18 / 20   Oct 10
    Lab report 1 · Image Processing            45 / 50   Oct 7
  Course totals
    Math Methods          91%
    Project Management    88%
    Image Processing      —   hidden by teacher
```

The order is fixed. Unlike the Personal page, this page has no layout editor. Riku chose an order and didn't ask to rearrange it.

---

## 4. Each section

### 4.1 The due list (leads the page)

**What's in it:** every Canvas item with a due date in Riku's active courses (assignments, quizzes, graded discussions), plus his open Academics to-dos.

**Groups, in this order** (answer 7):

| Group | Holds |
|---|---|
| **Missing & late** | Canvas work Canvas itself marks *missing*; to-dos past their due day, marked `late · N days`. *(Riku said "Missing"; "& late" is added because overdue to-dos share the group. Default, for Riku to confirm.)* |
| **This week** | Due from now through Sunday (weeks run Monday–Sunday, Asia/Manila) |
| **Next week** | Due next Monday–Sunday |
| **Later** | Everything after that |
| **No date** | To-dos with no due date *(default — Riku to confirm)* |

A group with nothing in it is left out, except that when the whole list is empty it reads `Nothing due.`

**Rules:**
- **Submitted work drops off** (answer 8). Excused work drops off too.
- **"Missing" uses Canvas's own flag** rather than the app working it out. Canvas doesn't mark work you hand in on paper or in class as missing. So a paper assignment leaves the list once its due date passes, instead of being shown as missing forever. *(Canvas's behaviour here is to be confirmed against real data, §10 step 2.)*
- Each row shows the title, the course (Canvas items) or a `to-do` mark (his items), and when it's due: `today 23:59`, `tomorrow 09:00`, `Thu 17:00` within the next seven days, `Nov 28` beyond that. Times are shown only for Canvas items; to-dos are day-only.
- **Tapping a Canvas row opens that item in Canvas.**
- **To-dos can be ticked done here**, the same tick as on the Personal page, through the same endpoint. Canvas rows have no tick, because they leave when he submits. *(Default — Riku to confirm.)*
- No add form on this page. To-dos are still added on the Personal page.
- Canvas planner notes (to-dos made inside Canvas itself) are not shown. Undated Canvas assignments are not shown.

### 4.2 Today's classes (answer 5)

Today's events from the Classes calendar, in time order: `07:00–08:50  Project Management`. Read live, never stored (D5).

**Which calendar:** Settings gains one choice, *"Calendar for classes"*, picked from the calendars already listed there. By default it's the one named "Classes" if one exists. So the page doesn't break if Riku renames the calendar.

Empty: `No classes today.` · No calendar chosen: `Pick your classes calendar in Settings.`

### 4.3 Unread announcements (answer 11)

Announcements from his active courses that Canvas says he hasn't read, newest first: the title, the course and the day posted. **Tapping one opens it in Canvas.** Once he has read it there, it leaves the page on the next load, because the app never marks anything read itself.

Bound: unread announcements from the **last 30 days**, at most 10 shown, then `and N more`. *(Default — Riku to confirm.)* This stops an old unread pile from the start of term from filling the page.

Empty: `No unread announcements.`

### 4.4 Grades (answer 10)

- **Recently graded:** work graded in the **last 14 days**, newest first, up to 5 rows. Each shows the title, the course, the score as Canvas gives it (`18 / 20`, or a letter grade, or `complete`) and the day it was graded. Tapping a row opens it in Canvas. Empty: `Nothing graded in the last two weeks.` *(14 days and 5 rows are defaults.)*
- **Course totals:** one row per active course with Canvas's current score. Some teachers hide the total, so a hidden or missing total reads `—  hidden by teacher` and never `0%`.

---

## 5. The 07:00 Briefing gains a school line (answer 9)

The morning push and the Briefing panel get one more sentence, placed after the Today sentence and in the same voice (S21). **Riku approved the wording below on 2026-10-11:**

- `For school: Quiz 4 for Math Methods is due tonight at 23:59, and Essay draft tomorrow.`
- `Lab report 2 is missing.` / `Two pieces of work are missing: Lab report 2 and Worksheet 3.`
- Up to three names per part, then `and N more`, cut to fit the push the same way the Today sentence is.
- Nothing due today or tomorrow and nothing missing: the line is left out entirely. It never says "nothing due for school" over an unread Canvas.
- **Canvas couldn't be read:** that's a *problem*, counted in the title and told as a story with a cause from the catalogue, so a morning never reads as all clear over a blind spot (R23's meaning). Two new catalogue entries:
  - Token turned down (401): `Canvas turned down the app's access token. It may have expired. Make a new one in Canvas (Account → Settings) and update CANVAS_TOKEN on Vercel.`
  - No answer or timeout: `Canvas didn't answer this morning.`
- Missing work is **not** a system problem. It goes in the school line and doesn't change the title's problem count. It does count towards a "busy" day for the greeting's mood.
- **The Debrief carries the school line the same way.** A Debrief re-reads Canvas, and a Canvas read failure can be compared against the morning's (subject `canvas`).

This changes push wording that S21 ratified, so it needs a new decision recorded in `ARCHITECTURE.md` §7 (§8 below).

---

## 6. How it reads Canvas, and failure

- **Live on every page view** (Riku accepted, over a stored hourly copy). Nothing is stored, so nothing goes stale, there's nothing to sweep, and the database has no copy of his coursework.
- **Explicit timeouts** on every Canvas call, and the page's Canvas reads run in parallel under one overall deadline. **Bounded** results: every list request is capped and paginated with a page limit.
- **One outage degrades only what it touches.** If Canvas can't be read, the three Canvas sections each say so (`Couldn't read Canvas.`), while today's classes and the to-do rows still render. If the calendar can't be read, only Today's classes says so.
- **A turned-down token** reads differently from an outage on the page too: `Canvas turned down the access token. Make a new one in Canvas and update it on Vercel.` That message points to the fix, so it isn't presented as something to retry.
- The token is never logged, never echoed in an error and never sent to the browser. All Canvas calls happen on the server.

---

## 7. What changes in the app

- **New page** `/academics`, added to the rail and the phone strip.
- **New server-side Canvas client** (read-only) with timeouts and pagination bounds, and pure shaping functions (grouping, missing, due wording) tested in `src/lib/__tests__/`.
- **OsSettings** gains one bounded field: the classes calendar's id (optional; written only through the existing settings accessor).
- **Briefing / Debrief**: the school line, the problem when Canvas can't be read, and two cause-catalogue entries.
- **`.env.example`**: `CANVAS_BASE_URL`, `CANVAS_TOKEN` (names and comments only).
- **No new collection, no new agent, no new cron.** The 07:00 dispatcher reads Canvas as part of its existing run.

---

## 8. Decision S23 (recorded in `ARCHITECTURE.md` §7, 2026-10-11)

> **S23 — P11 Academics is Canvas-only: the modules/reviewers area is dropped, the planner is parked, and the timetable is Riku's to enter. The morning push gains a school line.** Riku's call, 2026-10-11, in the page's content discussion (S11). The page reads Canvas live (due list, unread announcements, grades) plus the Classes calendar and his Academics to-dos. **Dropped:** the manual modules/reviewers area with per-course counters (concept §2.2, architecture §2.2, ROADMAP P11). He didn't pick it when asked, and Canvas already carries his coursework, so D11's example supplement simply has no job here. **Parked:** the sentence-to-schedule planner, to be reconsidered after he has used the page. It stays the only calendar writer meant to go through the queue, whenever it returns. **Not built:** automatic Classes-calendar population. He adds the timetable himself each term. **Push:** a school line after the Today sentence, and an unreadable Canvas is a counted problem (R23's meaning). This extends S21's push wording and supersedes nothing else. **Unchanged:** D5 (nothing from Canvas or the calendar is stored), D11 (Canvas is the live feed), the approval rule (nothing outward happens), Canvas read-only.

The ROADMAP's P11 row and architecture §2.2's Academics bullet are updated to match when S23 is recorded.

---

## 9. Left out, on purpose

| Item | Why |
|---|---|
| Modules/reviewers area and per-course counters | Riku left it out (answer 4) |
| Sentence-to-schedule planner | Later, after using the page (answer 6) |
| Timetable helper / Classes auto-fill | He adds the timetable himself (answer 5) |
| Marking announcements read, submitting, any Canvas write | Canvas is read-only for this app |
| Adding to-dos on this page | Not asked for; the Personal page has the form |
| Rearranging the page | Not asked for; the order is fixed (answer 12) |

---

## 10. Before planning

1. **Riku's hands:** make a Canvas access token (Canvas → Account → Settings → *+ New Access Token*) and say his school's Canvas address. The token goes into `.env.local` and Vercel's env, never into chat history if it can be avoided.
2. **Measure the real data once, as P10 did:** read his real Canvas with the token. That means his active courses, how names come back, whether totals are hidden, what planner items, missing flags and unread announcements actually look like, and whether the token has an expiry date. Write the findings into this document as a "real data" section before the plan relies on any of it.
3. Visual design for the page follows its own step (S12/S17), after this document is approved.
