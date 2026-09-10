# P10 — The Personal page (design)

**Date:** 2026-09-10 · **Status:** ratified design, awaiting implementation planning
**Scope:** `docs/ROADMAP.md` P10 — repo: RikuOS. One page on live Google Calendar data plus the app's one permitted manual supplement (the to-do store), Google sign-in as the first new external integration with its own auth since the OS API, a server-stored editable layout, and the Today sentence added to the morning push (S13).
**Not in scope:** any new agent (S13) · the Academics page and Canvas (P11) · the Classes layer being *populated* by Canvas (P11) · the sentence-to-schedule planner (P11) · the quest board (P9b) · editing or deleting calendar events from the app · drag-and-drop layout editing · holidays · a month grid.

**Goal in one line:** one morning push names what is actually due and scheduled that day — the section P5a-7 dropped for want of a to-do store — and Riku has a page that shows the same, laid out the way he likes.

**Companion:** `2026-09-10-p10-personal-page-content.md` holds every string and state. This document holds why, and how it is built.

---

## The content discussion this document records

Held 2026-09-10, satisfying S11 for this page. Riku answered fourteen questions; each decision below cites his choice. **No part of this page was inferred from the Freelance discussion**, and this document settles nothing about P11.

Two things Riku added unprompted shaped the page more than any answer: *"I want it to have multiple columns for the content and will be separated by blocks of features"*, and then the full specification of a **loose weighted bento** with a **personally adjustable layout** (content deck §2, item 7, verbatim).

---

## What the data actually is — measured, not assumed

Riku's Google account was read live during the discussion (content deck §3). Six calendars: Personal (main), Classes, Events, Org Stuff, and two subscribed holiday feeds. **Nothing at all in the coming week on any of them.** Classes holds two past terms' timetables and nothing since July; Org Stuff was heavily used March to June and is silent since; Events has two entries from March.

Asked directly, Riku's reading: *"It's accurate, nothing is scheduled."*

**Two conclusions follow, and they shape everything:**

1. **The empty state is this page's primary state, not an edge case** — exactly as it was for Freelance. A week of `—` and three to-do headings with nothing under them is what the page shows on day one, and it must look finished.
2. **The concept's layer names were a guess.** `RIKUOS_CONCEPT.md` §2.2 says *Workouts, Plans, Classes*. The real calendars are Personal, Classes, Events and Org Stuff. The page reads what exists; the concept's list is superseded by Riku's choice below, and the Settings picker (D10) means a Workouts calendar created later simply appears.

Also measured: the Org Stuff calendar is full of to-do-shaped entries placed as timed events (*"Email GCU"*, *"Clearance form"*, *"send sir den ung VERF"*). Riku already uses the calendar as a to-do list when nothing better exists. The per-to-do calendar switch (D5) gives that habit a proper home without forcing every to-do onto the calendar.

---

## Decisions settled in this session

| # | Decision | Why |
|---|----------|-----|
| D1 | **Today leads.** Today's events from every switched-on layer, plus to-dos due today and overdue, in one tile; the coming days below. | Riku's choice over a week-first and a to-do-first page. It is what the morning push says, so the page and the push agree. |
| D2 | **The horizon below Today is 7 days.** | Riku's choice over 3 days, 14 days and a month grid. Long enough to see the week's shape, short enough to stay one screen when quiet. |
| D3 | **Three layers: Personal (main), Classes, Events. Org Stuff is dropped.** | Riku's choice, shown the measured use of each. Holidays were not offered as layers and a Next-holiday tile was declined (D8). |
| D4 | **The page is a loose weighted bento on a 12-column grid, four weighted rows, one empty cell, and the arrangement is Riku's to change.** | Riku's spec, verbatim in the content deck. It replaces the column layouts first proposed. |
| D5 | **A to-do goes on Google Calendar only when Riku asks, per to-do**, via a switch that is off by default. On, it writes an all-day entry on the due day in the main calendar and remembers the entry's id; moving the date moves it; done, switch-off or delete removes it. | Riku's choice over never and over always. It gives the measured habit (to-dos as calendar entries) a home without two copies of everything. See *Why this is not a sync engine* below. |
| D6 | **On a quiet morning the push says so in one line:** `Today: nothing scheduled, nothing due.` | Riku's choice over omitting the part. Silence and "couldn't read the calendar" must never look the same — the same reasoning as P5a-4's unconditional push. |
| D7 | **Layout editing is move-and-size, with buttons, saved on the server.** Arrows to move a tile within and between rows, a width stepper, Save / Cancel / Reset to default. Row heights are fixed weights. | Riku's choice over free placement and over preset arrangements. Buttons rather than drag: they work on the phone and with a keyboard, need no library, and the stored shape does not change if dragging is added later. |
| D8 | **Six tiles: Today, To-do, Layers, This morning's push, Next 7 days, Done this week.** A Next-holiday tile was offered and declined. | Riku's choice. Push and Done earn their place as real data; holidays did not. |
| D9 | **To-do rules as written** in content deck §6–7: title, section, optional due day, done, the calendar switch, ordering, 20-per-section bound, done items kept and shown for seven days. | Riku's choice ("yes, as written"), including that ticking done removes the calendar entry rather than leaving a record. |
| D10 | **Layers are chosen in Settings** from the account's calendar list, stored as `{calendarId, name, enabled}`. | Riku's choice over three ids in environment variables. Nothing to copy by hand, and a calendar created later shows up to tick. |
| D11 | **Google sign-in uses ShikksTracker's Google Cloud project with a new OAuth client** for this app, Calendar API enabled, publishing status *In production*. | Riku's choice over a new project. Gmail's token is untouched; the *In production* lesson (GAPS G-22 in that repo) is carried over rather than re-learned. |
| D12 | **The push's Today sentence as written** in content deck §10: second in the body, up to 3 events and 3 to-dos named, an unreadable calendar counted as a problem, body limit raised to 320. | Riku's choice over Today-first. Problems stay first so a bad night is never cut off. |
| D13 | **Personal goes first in the rail; the post-login landing page stays as it is.** | Stated, not asked; Riku did not object. The daily page reads first. |
| D14 | **The push text is stored by the dispatcher when it sends** (a fixed-id singleton, *LastDigest*), because `AgentRun` records counts and an error, not the text. | Found while writing this up — the "read it from the run record" first said to Riku was wrong, and this is the correction. Same shape as the site-health reading (R55): overwritten whole, read-only accessor returns `null` when absent. |

**Why the calendar switch (decision 5 above) is not a sync engine, and does not touch the concept's D5.** The numbering clash is unfortunate and deliberate: this table numbers this session's decisions, as the P8 doc did, and the concept's D1–D11 are a different list. The concept's D5 forbids a two-copy calendar sync: events live only in Google. A pinned to-do is not an event copy. The to-do is the app's own record — the manual supplement S13 allows — and the calendar entry is a *projection* of it, created on request, addressed by id, one-directional. The app never reads that entry back to update the to-do; if Riku edits the entry in Google, the to-do does not change, and the content deck says so. This is recorded as S18 in `ARCHITECTURE.md` §7 by the plan's documentation task so a later session does not read `calendarEventId` as a stored event.

---

## Page structure

`/personal`, session-guarded, server-rendered fresh on every load (`dynamic = "force-dynamic"`), built to the design system from the start (S17's order). The page is one grid; the tiles are its children; the arrangement comes from the settings record.

### The grid

`.pg` — a CSS grid, `grid-template-columns: repeat(12, 1fr)`, `gap: var(--sp-4)` (14px, the same gutter the Freelance hero row uses), four explicit rows with weighted minimum heights:

| Row | Weight | Minimum |
|---|---|---|
| 1 | tall | `minmax(340px, auto)` |
| 2 | short | `minmax(140px, auto)` |
| 3 | medium | `minmax(240px, auto)` |
| 4 | short | `minmax(120px, auto)` |

Each tile is placed explicitly — `grid-row` from its row, `grid-column: span N` from its stored width — never auto-flowed, so the stored arrangement is exactly what renders and a hole is where the arrangement says it is. Leftover columns in a row are empty ground. The column stays `--content-max` (920px), giving 63.8px per grid column; the arithmetic is in the content deck §2 so nobody re-derives it.

**Collapse:** below 760px of viewport the grid becomes `repeat(6, 1fr)` and every span is `ceil(N / 2)`; below 480px it becomes `1fr` and every tile spans 1. Both are CSS: the server emits one class per tile carrying its 12-column span, and the stylesheet maps each class to its 6-column value, so no JavaScript decides widths. Source order is the stored reading order, so the stack needs no reordering. If the shell already collapses its rail at a different width by the time this is built, use that width for the 6-column step rather than introducing a second breakpoint.

### The tiles

Six tiles, each a server component reading a view model built by a pure function, each carrying at most one small client island. A tile is `.tile`, with the eyebrow / heading / control row the Freelance blocks already use (`.fl-head` grammar), and a border and radius because a tile *is* a real object (the row-grammar rule in the visual spec §5.5).

| Tile | Reads | Island |
|---|---|---|
| **Today** | enabled layers → Google events for the Manila day; to-dos due ≤ today, open | tick boxes; the event form |
| **To-do** | open to-dos, all sections | tick boxes; the to-do form; the edit form |
| **Layers** | settings `layers` | the switches |
| **This morning's push** | *LastDigest* + `monitoringEnabled` | none |
| **Next 7 days** | enabled layers → Google events for days +1…+7; to-dos due in that span | tick boxes |
| **Done this week** | to-dos done in the last 7 days | un-tick boxes |

Strings and states: content deck §6.

### Edit mode

A client island wrapping the grid (`LayoutEditor`). Off, it renders the tiles as the server sent them. On, it re-renders the same tiles with a toolbar each, working on a local copy of the arrangement, and `Save` PATCHes `personalLayout`. Tile *contents* stay the server-rendered children — the editor moves them, it never re-fetches them. `Reset to default` loads `PERSONAL_LAYOUT_DEFAULT` into the local copy.

---

## The to-do store

`src/models/Todo.ts`, following the repo's schema rules: every string bounded, every closed set an enum, dates are `Date`, no `Mixed`.

| Field | Type | Rule |
|---|---|---|
| `title` | String | required, `maxlength: 140`, trimmed |
| `section` | String enum | `personal` · `freelance` · `academics` — Work stays parked (D9) |
| `dueOn` | Date, optional | **a day, not an instant:** stored as that calendar day at `00:00:00Z`. Comparisons go through `dayKey` (below), never through raw `Date` arithmetic |
| `done` | Boolean | default `false` |
| `doneAt` | Date, optional | set when `done` flips true, cleared when it flips back |
| `calendarId` | String, optional | `maxlength: 256` — the Google calendar the pin was written to (always `primary` in this version, stored anyway so a later change cannot orphan an entry) |
| `calendarEventId` | String, optional | `maxlength: 1024` (Google's stated maximum) — present exactly when the to-do is on the calendar |
| `timestamps` | `{createdAt: true, updatedAt: true}` | updates are the point of this record |

Indexes: `{done: 1, dueOn: 1}` for Today / week / digest reads; `{section: 1, done: 1, dueOn: 1}` for the To-do tile; `{done: 1, doneAt: -1}` for Done this week. No TTL: done items are kept (D9). Any index change ships with the existing `migrate:indexes` sync.

**Ordering is a pure function** (`sortTodos`): overdue first, most overdue first; then by `dueOn`; then undated by `createdAt` ascending.

**Bounds:** every list read takes a limit and reports `total` so the tile can say `Showing 20 of 34.`

### Days and the time zone

`APP_TZ = "Asia/Manila"` joins `constants.ts`. Vercel runs in UTC and the cron fires at 23:00 UTC, which is 07:00 Manila — "today" must be Manila's today or the digest reports yesterday.

`src/lib/days.ts`, pure, no library: `dayKey(date, tz)` → `"YYYY-MM-DD"` in the zone (via `Intl.DateTimeFormat` parts); `dayStart(key)` → the `Date` stored in `dueOn`; `addDays(key, n)`; `daysBetween(a, b)`; `formatDay(key)` → `Thu 10 Sep`; `todayKey(now)`. Every "is this due today / overdue / within 3 days" question is asked of day keys.

### The calendar switch — write-through with compensation

`pinTodo(id)`: insert the all-day entry (`start.date = end.date = dueOn` in Google's date-only form, `summary = title`) into `primary`; then `findOneAndUpdate` the to-do with `calendarEventId` guarded on `calendarEventId: {$exists: false}`. If the guarded update fails or matches nothing, delete the entry just created and throw the original error. If *that* delete fails, throw an error whose message says an entry may have been left on the calendar — the content deck's sentence.

`unpinTodo`, `moveTodoPin` (date change), and the done / delete paths follow the asymmetric rule: the to-do's own change is written **first** and always succeeds on its own; the Google call follows; a Google failure is reported with the deck's *"Done, but the calendar entry couldn't be removed"* sentence and leaves `calendarEventId` in place so the next attempt retries the same entry rather than losing it.

---

## Google Calendar

### Sign-in, once

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` in the environment, never in the database, never logged, never echoed in an error. Two scopes: `https://www.googleapis.com/auth/calendar.events` (read and write events) and `https://www.googleapis.com/auth/calendar.readonly` (the calendar list, for the Settings picker).

Two bootstrap routes ported from ShikksTracker's Gmail pair, with the same protections: `GET /api/auth/google` redirects to Google's consent screen with `access_type=offline`, `prompt=consent`, and a random `state` bound to a short-lived `httpOnly` `sameSite=lax` cookie; `GET /api/auth/google/callback` verifies the state, exchanges the code, and **shows the refresh token once on the page** for pasting. Both answer `404` unless `NODE_ENV === "development"` or `ALLOW_OAUTH_BOOTSTRAP=true`. Redirect URI `${APP_BASE_URL}/api/auth/google/callback`; locally RikuOS runs on 3001.

The Google Cloud side is Riku's (D11) and is listed under *What needs Riku's hands*.

### The client module

`src/lib/google.ts` — raw `fetch` against the REST API, not the `googleapis` SDK. Four endpoints are used; each needs an explicit timeout (`GOOGLE_TIMEOUT_MS = 5000`) through `AbortSignal`, and a wrapper this thin is easier to reason about than an SDK whose timeouts and retries are its own.

- `readGoogleConfig()` — throws `GoogleError("not-configured")` naming which variables are missing, never their values
- `getAccessToken()` — POST `oauth2.googleapis.com/token` with the refresh token; cached on `global` until 60 s before expiry, cleared on failure (the same shape as the DB connection cache). An `invalid_grant` answer becomes `GoogleError("expired")` — the deck's *"Google access has expired"* state
- `listCalendars()` — `GET /calendar/v3/users/me/calendarList`
- `listEvents(calendarId, fromKey, toKey)` — `GET /calendar/v3/calendars/{id}/events` with `singleEvents=true`, `orderBy=startTime`, `timeZone=Asia/Manila`, `timeMin/timeMax` from the day keys, `maxResults=100`; recurring class entries arrive already expanded
- `insertEvent(calendarId, event)`, `patchEvent(calendarId, eventId, patch)`, `deleteEvent(calendarId, eventId)`

`GoogleError` carries a `kind` — `not-configured` · `expired` · `timeout` · `http` (with status and Google's own message, bounded) — and the tiles map each kind to its deck sentence. A `401` on a calendar call clears the cached token and retries once; a second `401` is `expired`.

### Reading for the page

`readCalendarWindow(layers, fromKey, toKey)`: one `listEvents` per *enabled* layer, `Promise.allSettled`, each under the timeout, returning `{ events, failed: string[] }` where `failed` holds the names of layers that did not answer. Events are normalised to `{ id, title, layerName, allDay, startsAt, endsAt, dayKey, htmlLink }` with `title` bounded to 200 characters for display. The page reads today and the 7-day window in **one** call (`today … today+7`) and splits by `dayKey`, so a slow Google costs one round of calls, not two.

### Writing

`POST /api/calendar/events` — validated at the top: `title` 1–200, `calendarId` must be one of the stored layers, `dayKey` well-formed, `allDay` boolean, else `start < end` as `HH:MM`. Builds the Google event with `Asia/Manila` and calls `insertEvent`. No local write, so there is no half-state and nothing to sweep. The response returns Google's `htmlLink` so the form can offer it; the page re-reads.

### Layers

`OsSettings.layers`: a bounded array (max 10) of `{ calendarId: String maxlength 256, name: String maxlength 120, enabled: Boolean }` as a typed sub-schema. The Settings picker (`GET /api/google/calendars` → the list; `PATCH /api/settings` with `layers`) sets membership; the Layers tile toggles `enabled` through the same PATCH. Membership order is display order.

`GET /api/google/status` backs the Settings connection card: attempts a token refresh and reports `connected` · `not-configured` · `expired` · `unreachable`. One call, on the Settings page only — never on `/personal`.

---

## The layout store

`OsSettings.personalLayout`: exactly four rows, each an array of `{ tile: enum, span: Number 2–12 }`, as a typed sub-schema. `PERSONAL_TILES = ["today","todos","layers","push","week","done"]` and

```ts
PERSONAL_LAYOUT_DEFAULT = [
  [{ tile: "today", span: 8 }, { tile: "todos", span: 4 }],
  [{ tile: "layers", span: 3 }, { tile: "push", span: 8 }],
  [{ tile: "week", span: 12 }],
  [{ tile: "done", span: 12 }],
];
```

`validateLayout(input)` is pure and runs in `parseSettingsPatch`: four rows; every tile in `PERSONAL_TILES` exactly once across all rows; every span an integer 2–12; every row's spans summing to ≤ 12. Anything else is a 400 with a typed message. `readOsSettings` returns the default when the field is absent, following the "an absent value reads as its default" rule the accessor already enforces per field. `collapseSpan(span, cols)` is the pure `ceil(span / 2)` rule, tested.

---

## The push's Today sentence

`composeDigest` gains `today: TodayInput | null`:

```ts
interface TodayInput {
  events: Array<{ title: string; time: string | null }> | "unavailable";
  due: Array<{ title: string; dayLabel: string }> | "unavailable";
  overdue: Array<{ title: string; daysLate: number }>;
}
```

`composeTodayLine(today)` is pure and produces the deck's forms (§10): up to 3 names per part, `+N more`, `(today)` / `(tomorrow)` / `(Fri)`, `(3d)`, and `Today: nothing scheduled, nothing due.` when every part is empty. `composeDigest` places it second in the body and, when `events` or `due` is `"unavailable"`, adds `calendar check unavailable` / `to-do check unavailable` to the problems, exactly as it already adds `pipeline check unavailable` for a failed attention call — so the title's count is honest.

`buildPushPayload`'s body slice rises from 200 to 320; its test moves with it.

**In the morning route,** inside the dispatcher job: read `layers`, read the Manila day's events for enabled layers (caught → `"unavailable"`, logged), read open to-dos due within 3 days and overdue (caught → `"unavailable"`). Then compose, send, and — after the send, caught and counted like the site snapshot — write *LastDigest*. A failed *LastDigest* write is named in the problems on the morning it happens (`push record could not be stored`), the R58 pattern.

### *LastDigest*

`src/models/LastDigest.ts`: fixed `_id: "latest"`, `sentAt: Date`, `title: String maxlength 80`, `body: String maxlength 320`, `devices: Number min 0`. Written by `findOneAndUpdate` on that id with `upsert` and one retry on E11000, read by a `findOne` accessor that returns `null` when absent — HealthSnapshot's pattern (R55). The tile's "this morning" test is `dayKey(sentAt) === todayKey(now)`.

---

## Navigation

`NavList.tsx` gains `{ href: "/personal", label: "Personal", Icon: IconPersonal }` **first** (D13); `icons.tsx` gains the glyph. The prefix/equality matching rules the file documents (R44) apply unchanged. The post-login redirect and the `/` route are not touched.

---

## Data model — the additions

| Collection | Change |
|---|---|
| `Todo` | new |
| `LastDigest` | new singleton, fixed id |
| `OsSettings` | `layers` (bounded typed array) · `personalLayout` (four-row typed array) — `OS_SETTINGS_DEFAULTS`, `SETTINGS_PROJECTION`, `readOsSettings` and `parseSettingsPatch` all widen, and the projection's typing makes forgetting one a compile error, as designed |
| `AgentRun` | unchanged |

`ARCHITECTURE.md` §3.1 gains the three rows; §4.2's Google Calendar line becomes *RikuOS P10, OAuth refresh token in env, two scopes, read live + write-through + to-do pins*; §5 gains the Today read in the morning flow; §7 gains S18. All in the plan's documentation task.

---

## Failure handling

- **One thing down, one spot affected.** Google calls are per layer under `Promise.allSettled`; the DB reads sit in one deadline-bounded `try` (the Freelance page's phase-1 pattern) and degrade the to-do, layers and push tiles together while the calendar still reads — except that unreadable layers mean the calendar cannot be read either, and the deck says exactly that.
- **No failure is ever rendered as data.** An unreadable calendar is a sentence, not a quiet day (constraint 2).
- **Writes are classified before any retry.** Event creation: single external call, no local state, a timeout reports *"check the calendar before trying again"* because the request may have landed. To-do pin: Google first, then a guarded local write, with a compensating delete (above). Done / unpin / delete: local first, Google second, failure reported and the id kept for retry. Nothing is left `pending`; there is no in-flight status to sweep.
- **The digest never fails for Google.** Both new reads are caught into `"unavailable"`; the dispatcher's own failure modes are unchanged.
- **The layout can always render.** An unreadable or invalid stored layout falls back to the default; the page never blanks for a settings problem.

---

## Security

- Every new route: `requireSession` first, the Origin check on every mutation, inputs validated at the top with typed JSON errors, list reads bounded.
- The Google token lives only in the environment; `readGoogleConfig` names missing *variables*, never values; no Google response is logged whole.
- The bootstrap routes `404` outside development unless `ALLOW_OAUTH_BOOTSTRAP=true`, and the flag comes off the moment the token is pasted — the same one-time rule ShikksTracker documents.
- The `state` cookie on the bootstrap is `httpOnly`, `secure`, `sameSite=lax`, ten minutes.
- `calendarId` on the event route must match a stored layer, so the app can only ever write to calendars Riku chose.

---

## Testing and acceptance

Logic layer under `src/lib/__tests__/`, Vitest, pure, no database and no network. The Google module is one import that tests replace.

- `days.test.ts` — Manila day keys around midnight UTC, `addDays`, `daysBetween`, `formatDay`
- `todos.test.ts` — `sortTodos` order, due-chip labels, overdue days, the 3-day digest window at day boundaries
- `personalView.test.ts` — Today and week view models: empty, one layer failed, all failed, not configured, expired, to-dos unavailable, the 20 / 8 bounds and their `Showing` / `+N more` strings
- `layout.test.ts` — `validateLayout` accepts the default and rejects a missing tile, a duplicate, a span of 1 or 13, a row over 12, three rows; `collapseSpan`
- `digest.test.ts` — `composeTodayLine` forms, placement second in the body, `unavailable` adding to the problems and the title's count, the 320 bound, the quiet-morning line
- `google.test.ts` — error-kind mapping (`invalid_grant` → expired, abort → timeout, 4xx → http with bounded message), the single 401 retry

**Done when:** `/personal` is live on Vercel reading Riku's real calendars and his real to-dos; `npm test`, `npx tsc --noEmit`, `npm run build` green and `npm run lint` at its recorded baseline; **and one real morning push has named what was actually due and scheduled that day** — the roadmap's bar, observed against real data, not inferred from tests.

---

## Non-goals

No new agent. No editing or deleting of calendar events from the app (link out). No drag-and-drop. No holidays. No month grid. No Canvas or Classes population. No planner. No Work section. No change to the Freelance page or the queue beyond the rail gaining an item.

---

## What needs Riku's hands

Listed here so the plan can mark them; each is surfaced at the moment it blocks, per his standing instruction.

1. **Google Cloud, ShikksTracker's project:** enable the Google Calendar API; create a second OAuth client (Web application) named for this app; add redirect URIs `http://localhost:3001/api/auth/google/callback` and `https://riku-os.vercel.app/api/auth/google/callback`; on the consent screen add the two calendar scopes; confirm **Publishing status: In production** (Testing kills the token every 7 days).
2. **Locally:** put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`, run the app on 3001, open `/api/auth/google`, consent, copy the refresh token the callback shows.
3. **Vercel:** add the three `GOOGLE_*` variables to the project; redeploy.
4. **Settings:** tick Personal, Classes and Events under *Calendar layers*.
5. **Wait for one 07:00 push** and confirm its Today sentence matches the day.

---

## Open items for the executing session

1. **The 920px column.** The bento was specified without a width; 920 is inherited. If the hero at span 8 (609px) proves cramped for a timed-event row, widening `--content-max` is a *system* change that also widens Freelance — raise it with Riku, do not change it quietly.
2. **The Classes layer and P11.** Canvas will populate Classes later. Nothing here assumes the Classes calendar is empty or full; the plan should not either.
3. **`+ Event` default calendar** is the first enabled layer. If Riku wants a fixed default, it is one more settings field; do not add it speculatively.
4. **Ticking in Today and the week.** A tick re-reads only the to-do tiles, not Google. Confirm the island boundaries let that happen without a full page reload; if not, a reload is acceptable and cheaper than a client-side store.
5. **Lint baseline.** Four `react-hooks/set-state-in-effect` errors are the recorded baseline; the new islands (forms, switches, editor) must not add a fifth.
