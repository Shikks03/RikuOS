/**
 * personalView.ts — the Personal page's view models. Pure: no database, no
 * network, no environment, no clock read (`now` is a parameter). Plan B adds
 * the Today, week, to-do, push and layers models; Plan A ships the ramp, because R84 requires the
 * ramp's CSS, the tokens and the design-system footnote to land in one commit
 * and R80 makes the nine classes and this one lookup a single frozen artifact.
 *
 * THE RAMP (R79-R85). `pending` = to-dos due today + to-dos overdue. NOTHING
 * ELSE. Scheduled calendar events never count, however many there are: Riku's
 * word was "task", the page's word for a task is a to-do, and an event is never
 * tickable. An overdue to-do does NOT force the top of the ramp - it is inside
 * the count like any other item (R85, Riku: "No - it just counts as one.").
 *
 * `pending` is a FREE READ, not a new query (R70): it is the row count of the
 * DUE group the hero already renders. `Nothing due.` renders iff pending = 0
 * iff .pe-t0. A failed read renders .pe-fail in the group's place, and then
 * there is no .pe-tN at all.
 *
 * ONE FIELD, never two booleans (R80). PERSONAL_HERO_BUSY_AT is deleted:
 * R73's single-threshold constant is superseded by the anchor table below.
 *
 * P10b adds the six view models below the ramp. Every import here is a pure
 * module or `import type` (erased at build): google.ts reads the environment
 * and fetches, lastDigest.ts and osSettings.ts import models, and a view model
 * that reaches a model has stopped being testable without a database (R52,
 * viewModelPurity.test.ts).
 */

import { APP_TZ, PUSH_EXPECTED_HOUR } from "@/lib/constants";
import { addDays, clockHHMM, dayKey, formatDay, todayKey, type DayKey } from "@/lib/days";
import { compareEvents } from "@/lib/eventOrder";
import { dueChip, sortTodos, type CreateTodoInput } from "@/lib/todos";
import { formCapable, type PersonalTile, type ReadonlyPersonalLayout } from "@/lib/personalLayout";
import type { CalendarEvent, CalendarListEntry, CalendarWindow, GoogleErrorKind } from "@/lib/google";
import type { StoredDigest } from "@/lib/lastDigest";
import type { Layer } from "@/lib/osSettings";

/** The model's section union, reached through todos.ts so no path here names a model. */
type TodoSection = CreateTodoInput["section"];

/** Nine states, no tenth. The class is `.pe-t${n}`. */
export type HeroTint = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * The frozen anchor table - green at 0, orange at 3, red at 8 - and the three
 * numbers Riku can change. Changing one is a table edit plus nine regenerated
 * literals in personal.css, not a code change (R80). The two segments are
 * deliberately unequal: the first three items move the colour 1.8x as far as
 * the next five do, measured in OKLab between the deep stops: .0774 from 0 to
 * 3, then .0422 from 3 to 8 (the straight line from 0 to 8 is .1110; the ramp
 * bends through orange) (R79, corrected by R95.1). A day going from nothing
 * to three things has changed more, to Riku, than a day going from four to
 * eight.
 */
export const PERSONAL_HERO_ANCHORS: Readonly<{ save: 0; spend: 3; missing: 8 }> = Object.freeze({
  save: 0,
  spend: 3,
  missing: 8,
});

/**
 * One position on the ramp, or null.
 *
 *   null in  -> null out. The to-do read did not answer, so the page has no
 *              count and the hero claims nothing (R83). This is the ONLY
 *              meaning of the untinted hero.
 *   clamped  -> 9, 40, 1e9 all return 8. A day with fourteen things looks
 *              like a day with eight.
 *   not an integer >= 0 (Infinity included) -> null. Infinity is not a count
 *              a read can produce; null - untinted - is the honest answer.
 *              And even if a bad value escaped, `.pe-t{bad}` matches no rule
 *              and renders the untinted hero, which is the safe render (R80,
 *              on R3's reasoning).
 */
export function heroTint(pending: number | null): HeroTint | null {
  if (pending === null) return null;
  if (!Number.isInteger(pending) || pending < 0) return null;
  return Math.min(pending, PERSONAL_HERO_ANCHORS.missing) as HeroTint;
}

// =============================================================================
// P10b Task 9 — the six view models (R10 · R14 · R16–R23 · R42 · R45 · R49 ·
// R51b · R55 · R57–R59 · R69 · R73 · R83 · R85 · R90, visual spec §4.1–§4.6,
// §5.9). `now` is always a parameter.
//
// STRINGS. Every user-facing literal is the content deck's, verbatim
// (docs/superpowers/specs/2026-09-10-p10-personal-page-content.md), with its
// deck section beside it. Where the plan and the deck differ, the deck wins
// (R86). The strings the contract's comments already name for a `kind`
// (`Nothing scheduled.`, `Nothing due.`, `nothing open`, `—`, `0 open`,
// `Nothing ticked off yet this week.`) are rendered by Plan C from that kind
// and are not emitted here, so each is spelled in one place.
//
// DOTS (R10, R55, §5.9; the Honesty Critic's kinds table, round 1):
//   "stale"   every couldn't-read — including `Google access has expired.`
//   "missing" the past-07:00 `No push this morning.` and nothing else here
//             (lateness is the due chip's `late`, not a SayLine)
//   null      a measured emptiness; an absence by configuration (`Google
//             isn't connected yet…`, `No calendars chosen…`, `All layers are
//             switched off.`, `Monitoring is off…`); an absence of a record
//             (`No push recorded yet.`, `A push went out… wasn't stored.`);
//             and a vanished calendar (R42: permanent, and it hands over a
//             lever).
// =============================================================================

// ---- The contract (plan "Types Plan C will render") -------------------------

/** A sentence with an optional 5px dot. `dot: null` renders bare (5.9). */
export interface SayLine {
  text: string;
  dot: "stale" | "missing" | null;
}

export interface TodoRowView {
  id: string;
  title: string;
  section: "personal" | "freelance" | "academics";
  sectionLabel: "Personal" | "Freelance" | "Academics";
  due: { text: string; late: boolean } | null; // "today" | "Fri 12" | "3 days late"
  onCalendar: boolean;
  note: string | null; // "entry on the old day"
}

/**
 * IDS REPEAT — ACROSS DAYS AND ACROSS CALENDARS. google.ts expands a multi-day
 * all-day event into one CalendarEvent per covered day, all with the SAME
 * Google `id`; and Google gives an invited event the same `id` on every
 * calendar holding it, so two enabled layers can each yield it on the same
 * day. An EventRowView or a DayItemView is therefore one calendar's one day's
 * appearance of an event, not the event: a React key or any lookup must be
 * `${dayKey}:${calendarId}:${id}`, never `id` alone. Nothing in this file
 * dedupes or indexes events by id.
 */
export interface EventRowView {
  id: string;
  /** The layer's Google calendar id — the key's middle part. */
  calendarId: string;
  title: string;
  layerName: string;
  time: string;
  href: string;
}

export interface TodayView {
  dateLabel: string; // "Thu 10 Sep"
  heroTint: HeroTint | null; // ONE field. null = the to-do read failed (R83)
  scheduled:
    | { kind: "rows"; rows: EventRowView[]; bound: string | null; fails: SayLine[] }
    | { kind: "empty" } // "Nothing scheduled."
    | { kind: "fail"; lines: SayLine[] };
  due:
    | { kind: "rows"; rows: TodoRowView[] }
    | { kind: "empty" } // "Nothing due."
    | { kind: "fail"; line: SayLine };
  /** true only when BOTH groups are empty AND the to-do read answered (R17). */
  spread: boolean;
  /** R40's 213px form floor, decided from the STORED SPAN. See formCapable. */
  formCapable: boolean;
  /**
   * `+ Event` cannot run, and the Scheduled group's sentence is its reason
   * (the mockup's disabled pill with aria-describedby): every layer switched
   * off (R20), the layers unreadable, Google not set up, or its access
   * expired (R42). NOT for a timeout or a partial window — the door can
   * still try, and its own outcome speaks for it.
   */
  eventFormBlocked: boolean;
}

/** R18's guard, in the TYPE: `—` is unreachable for an unread day. */
export type DayRowView =
  | { key: DayKey; label: string; items: DayItemView[] }
  | { key: DayKey; label: string; unread: true };

/**
 * Key by `${row.key}:${calendarId}:${id}` (see EventRowView): an event's `id`
 * repeats across day rows and across calendars.
 */
export interface DayItemView {
  kind: "event" | "todo";
  id: string;
  /**
   * An event's layer calendar id. A to-do's is always `""` (TODO_ITEM_CALENDAR_ID):
   * a stored layer's calendarId is 1–256 characters (settings.ts), so `""` can
   * never be an event's, and a to-do's Mongo id can never meet an event id that
   * happens to spell the same hex under one key.
   */
  calendarId: string;
  title: string;
  time: string | null;
  layerOrSection: string;
  href: string | null; // events only
}

export interface WeekView {
  /** null when the day rows are omitted entirely - both feeds down (R18). */
  days: DayRowView[] | null;
  fails: SayLine[]; // rendered at the TOP of the tile (R16)
}

/** One element of TodoTileView.sections, exactly as the plan wrote it inline. */
export interface TodoSectionView {
  key: "personal" | "freelance" | "academics";
  label: "Personal" | "Freelance" | "Academics";
  rows: TodoRowView[]; // empty array renders `nothing open`
  bound: string | null; // "Showing 20 of 34."
}

/**
 * The plan wrote this as one interface with `count: number | null` and
 * `sections: … | null` as independent fields — which still lets
 * `{count: 0, sections: null, fail}`, i.e. `0 open` above `Couldn't load
 * to-dos.`, type-check. Invariant 1 says that render is UNREPRESENTABLE, so
 * the same three fields are tied into two variants. Every field keeps its name
 * and its type; a consumer reading `.count`, `.sections` and `.fail` reads
 * exactly what it read before (R21).
 */
export type TodoTileView =
  | { count: number; sections: TodoSectionView[]; fail: null }
  | { count: null; sections: null; fail: SayLine }; // sections null = `Couldn't load to-dos.`

export interface DoneTileView {
  /**
   * Absent at zero (deck §12) — the view says null. NOT the To-do tile's rule:
   * `0 open` declares that the store answered; Done's figure is a tally, and a
   * tally of nothing is not shown. Two fields, two rules, on purpose.
   */
  count: number | null;
  rows: Array<{ id: string; title: string; sectionLabel: string; dayLabel: string; note: string | null }>;
  bound: string | null;
  fail: SayLine | null;
}

export interface PushTileView {
  kind: "quote" | "went-out-unstored" | "no-push-today" | "never" | "monitoring-off" | "fail";
  stamp: string | null; // "sent 07:00", in APP_TZ - never the cron's hour
  title: string | null;
  body: string | null;
  last: { stamp: string; title: string; body: string } | null;
  line: SayLine | null;
}

export interface LayersTileView {
  kind: "switches" | "sentence" | "fail";
  rows: Array<{ calendarId: string; name: string; enabled: boolean; note: string | null }>;
  line: SayLine | null;
}

// ---- Inputs -----------------------------------------------------------------

/** One open to-do, as the page's one `find({done:false})` read hands it over. */
export interface OpenTodoInput {
  id: string;
  title: string;
  section: TodoSection;
  /** todoDueKey(doc.dueOn) — the stored UTC-midnight day, read in UTC. */
  dueOn: DayKey | null;
  createdAt: Date;
  calendarEventId: string | null;
  /** Absent on rows written before the field: pass `doc.calendarBehind === true`. */
  calendarBehind: boolean;
}

/**
 * The open to-do read, shared by Today, Next 7 days and the To-do tile (the
 * Todo model's "two indexes, two queries, whole page"). `rows` is the open
 * list as read (bounded by the page's safety cap); `total` is the store's
 * count, which the To-do header shows; `sectionTotals` is the store's count
 * per section (one aggregate), which each section's `Showing 20 of N.` uses.
 * The counts come from the store and never from `rows`, so a capped read can
 * shorten a section's list but never undercount it.
 * "unavailable" is a read that did not answer — never an empty list.
 *
 * ORDER IS PART OF THE CONTRACT: `rows` are ordered by dueOn ascending, with
 * UNDATED ROWS LAST, and the undated rows by createdAt ascending (oldest
 * first) — sortTodos's order for the undated. (Mongo's ascending sort puts
 * missing dueOn FIRST, so the loader must order them itself.) That order is
 * what lets a capped read be judged, and it is CHECKED, not trusted: a feed
 * whose dueOn order is broken reads as unavailable (readTodosForWindow).
 */
export type OpenTodosFeed =
  | { rows: readonly OpenTodoInput[]; total: number; sectionTotals: Readonly<Record<TodoSection, number>> }
  | "unavailable";

/**
 * The calendar side, shared by Today, Next 7 days and Layers.
 *
 *   "layers-unavailable"  the settings read failed, so no window was read.
 *   layers + window       the stored layers and readCalendarWindow's answer
 *                         for today … today+7, read ONCE for both tiles.
 *   calendars             listCalendars()'s answer, or null when the page did
 *                         not ask or the list failed. It is the only way to
 *                         tell a vanished calendar (R42) from one that merely
 *                         did not answer — the window's `failed` lists layer
 *                         calendarIds and nothing more. null means "never claim vanished".
 */
export type CalendarFeed =
  | "layers-unavailable"
  | {
      layers: readonly Readonly<Layer>[];
      window: CalendarWindow;
      calendars: readonly CalendarListEntry[] | null;
    };

export interface TodayInput {
  now: Date;
  calendar: CalendarFeed;
  todos: OpenTodosFeed;
  /** The resolved layout: formCapable is decided from the STORED span. */
  layout: ReadonlyPersonalLayout;
}

export interface WeekInput {
  now: Date;
  calendar: CalendarFeed;
  todos: OpenTodosFeed;
}

export interface TodoTileInput {
  now: Date;
  todos: OpenTodosFeed;
}

export interface DoneTodoInput {
  id: string;
  title: string;
  section: TodoSection;
  doneAt: Date;
  calendarEventId: string | null;
}

/**
 * "This week" is the deck's own definition: "what was ticked off in the last
 * seven days" (content deck §6 Tile 6, Job) — a ROLLING seven days, today and
 * the six before it, in APP_TZ, not a calendar week. todos.ts's
 * doneWindowStart(today) is the first of those days; the loader reads
 * `done: true, doneAt >=` the APP_TZ midnight that begins it (google.ts's
 * windowBounds(doneWindowStart(today), today).timeMin), for both the rows and
 * the count.
 */
export interface DoneInput {
  /** The newest completions (the page reads DISPLAY_BOUND of them) and the week's count. */
  done: { rows: readonly DoneTodoInput[]; total: number } | "unavailable";
}

export interface PushInput {
  now: Date;
  /** getLastDigest(): null = never stored (R55); "unavailable" = the read threw. */
  digest: StoredDigest | null | "unavailable";
  /**
   * The dispatcher's latest AgentRun; null if it never ran.
   *
   * `skipped` marks a run that recorded itself WITHOUT sending: with
   * monitoring off, the morning route still writes a `dispatcher` row with
   * `ok: true` so the watchdog can tell "switched off" from "cron never fired"
   * (src/app/api/cron/morning/route.ts). A skipped run is treated as NO run —
   * never as a push that went out, and never as a failure.
   *
   * HOW THE LOADER DERIVES IT. AgentRun carries a structured `skipped`
   * field: runJob (src/lib/jobs/runJob.ts) writes `skipped: true` on every
   * ok run it was handed a skip note for. fetchLatestRuns (watchdog.ts) does
   * not select it, so Plan C's loader reads the dispatcher row itself with
   * `skipped` and `error` projected, and sets `skipped = run.skipped === true`.
   *
   * FALLBACK, for rows written before the field existed (they have no
   * `skipped` key, and AgentRun's 90-day TTL retires them): `skipped =
   * run.ok === true && typeof run.error === "string"`. That held because
   * runJob wrote `error` on an ok row ONLY for a `note`, and the one note any
   * dispatcher row carried was the monitoring-off route's. Apply it only when
   * `run.skipped` is absent — never when it is `false`. Do not match the
   * note's text.
   */
  dispatcher: { ok: boolean; startedAt: Date; skipped: boolean } | null | "unavailable";
  /** OsSettings.monitoringEnabled, or "unavailable" when settings did not load. */
  monitoringEnabled: boolean | "unavailable";
}

export interface LayersInput {
  calendar: CalendarFeed;
}

// ---- Shared pieces ----------------------------------------------------------

/** deck §6 Tiles 1, 2, 6: 20 rows, then `Showing 20 of N.` */
export const DISPLAY_BOUND = 20;

/**
 * The open-to-do read's safety cap: Plan C's loader reads at most this many
 * rows (`.limit(OPEN_TODOS_CAP)`) in the OpenTodosFeed order. 200 because the
 * page's widest honest need is every row due on or before today+7 (Today and
 * Next 7 days) plus 20 per section on the To-do tile — a one-person list sits
 * far below it, so the cap exists to bound one read's payload on a runaway
 * list, not to shape a normal day. Past it, readTodosForWindow still answers
 * honestly: a cap that fell inside the window reads `Couldn't load to-dos.`.
 *
 * A read is CAPPED iff it came back FULL (`rows.length === OPEN_TODOS_CAP`)
 * AND the store holds more (`rows.length < total`). The first half is what
 * makes it a rule rather than a guess: the list and the count are two reads,
 * so a to-do created between them makes `rows.length < total` on a read that
 * was never cut, and only a full page can have been cut.
 */
export const OPEN_TODOS_CAP = 200;

const SECTION_ORDER: readonly TodoSection[] = ["personal", "freelance", "academics"]; // deck §6 Tile 2
const SECTION_LABEL: Record<TodoSection, "Personal" | "Freelance" | "Academics"> = {
  personal: "Personal", // deck §6 Tile 2
  freelance: "Freelance",
  academics: "Academics",
};

const stale = (text: string): SayLine => ({ text, dot: "stale" });
const bare = (text: string): SayLine => ({ text, dot: null });

/** deck §6 Tile 1 (`Showing 20 of 26.`), Tile 2 (`… of 34.`), Tile 6 (`… of 31.`). */
function boundLine(shown: number, total: number): string | null {
  return total > shown ? `Showing ${shown} of ${total}.` : null;
}

/** deck §6 Tiles 1, 2, 5, 6 and §11. */
const todosFail = (): SayLine => stale("Couldn’t load to-dos.");

/** "07:00" — the wall clock in APP_TZ, 24-hour (days.ts's clockHHMM). */
const clock = (at: Date): string => clockHHMM(at, APP_TZ);

/** "Fri 11" — formatDay's weekday and day (deck §6 Tiles 5 and 6). */
function shortDay(key: DayKey): string {
  const [weekday, day] = formatDay(key).split(" ");
  return `${weekday} ${day}`;
}

/** DayItemView.calendarId for a to-do: never a real calendar id. */
export const TODO_ITEM_CALENDAR_ID = "";

const ALL_DAY = "all day"; // deck §6 Tile 1 and Tile 5 renders

function isPinned(eventId: string | null): boolean {
  return eventId !== null && eventId !== "";
}

function todoRow(t: OpenTodoInput, today: DayKey): TodoRowView {
  const pinned = isPinned(t.calendarEventId);
  return {
    id: t.id,
    title: t.title,
    section: t.section,
    sectionLabel: SECTION_LABEL[t.section],
    due: dueChip(t.dueOn, today),
    onCalendar: pinned,
    // deck §15: on the open row of a to-do whose entry could not be moved
    // after a date change.
    note: pinned && t.calendarBehind ? "entry on the old day" : null,
  };
}

// ---- The calendar, read once into one of four states ------------------------

type CalendarRead =
  /** Every enabled layer answered. */
  | { kind: "answered"; events: CalendarEvent[] }
  /** No enabled layer: nothing to read, so answered vacuously (R45). */
  | { kind: "none-enabled"; line: SayLine }
  /** Some layers answered and some did not. */
  | { kind: "partial"; events: CalendarEvent[]; lines: SayLine[] }
  /** Nothing was read. */
  | { kind: "unread"; lines: SayLine[] };

function readCalendar(feed: CalendarFeed): CalendarRead {
  if (feed === "layers-unavailable") {
    return { kind: "unread", lines: [stale("Couldn’t load layers, so the calendar wasn’t read.")] }; // deck §6 Tile 1, §11
  }
  const { layers, window, calendars } = feed;
  if (!window.ok) {
    switch (window.reason) {
      case "none-enabled":
        return layers.length === 0
          ? { kind: "none-enabled", line: bare("No calendars chosen. Pick them in Settings.") } // deck §6 Tile 1
          : { kind: "none-enabled", line: bare("All layers are switched off.") }; // deck §15
      case "not-configured":
        return { kind: "unread", lines: [bare("Google isn’t connected yet. Set it up in Settings.")] }; // deck §6 Tile 1
      case "expired":
        return { kind: "unread", lines: [stale("Google access has expired. Renew it from Settings.")] }; // deck §6 Tile 1
      case "timeout":
        return { kind: "unread", lines: [stale("Couldn’t read the calendar.")] }; // deck §6 Tile 1, §11
    }
  }
  // google.ts already returns this order; sorting again with the SAME
  // comparator keeps the view total over any window it is handed (the loader
  // is Plan C's, and the CalendarWindow type does not carry the order).
  const events = [...window.events].sort(compareEvents);
  if (window.failed.length === 0) return { kind: "answered", events };

  // `failed` is calendarIds (google.ts): every decision compares ids, and a
  // name is joined in only to write a sentence — two layers may share one.
  const failedIds = new Set(window.failed);
  const enabled = layers.filter((l) => l.enabled);
  const failedLayers = enabled.filter((l) => failedIds.has(l.calendarId));
  // An id that joins to no enabled layer is outside the window's contract; it
  // is still a failure, so it is said, never dropped into a `Nothing scheduled.`
  const unjoined = failedLayers.length < failedIds.size;
  const allFailed = enabled.length > 0 && enabled.every((l) => failedIds.has(l.calendarId));
  const present = calendars === null ? null : new Set(calendars.map((c) => c.calendarId));
  // With `calendars` null nothing is ever called vanished: a calendar that
  // merely did not answer must not be told to be unticked.
  const vanished = (l: Readonly<Layer>) => present !== null && !present.has(l.calendarId);
  const anyVanished = failedLayers.some(vanished);

  const lines: SayLine[] =
    allFailed && !anyVanished
      ? [stale("Couldn’t read the calendar.")] // deck §6 Tile 1: every layer failed
      : uniqueLines([
          ...failedLayers.map((l) =>
            vanished(l)
              ? bare(`${l.name} is no longer on your Google account. Untick it in Settings.`) // deck §15, R42
              : stale(`Couldn’t read ${l.name}.`), // deck §6 Tile 1: the layer's own name
          ),
          ...(unjoined ? [stale("Couldn’t read the calendar.")] : []), // deck §6 Tile 1, §11
        ]);
  return allFailed ? { kind: "unread", lines } : { kind: "partial", events, lines };
}

/** Two layers sharing a name that both fail say their sentence once. */
function uniqueLines(lines: SayLine[]): SayLine[] {
  const seen = new Set<string>();
  return lines.filter((l) => {
    const k = `${l.dot}|${l.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** R40's form floor for one tile, from its stored row: formCapable takes the whole row. */
export function formCapableFor(layout: ReadonlyPersonalLayout, tile: PersonalTile): boolean {
  for (const row of layout) {
    const index = row.findIndex((e) => e.tile === tile);
    if (index >= 0) return formCapable(row.map((e) => e.span), index);
  }
  return false;
}

/**
 * The open feed as the page's WINDOW (overdue … today+7) may use it. A capped
 * read (full at OPEN_TODOS_CAP and short of `total` — see OPEN_TODOS_CAP) is
 * safe inside the window only if the cap fell
 * beyond it: rows are ordered by dueOn ascending with undated last (the
 * OpenTodosFeed contract), so when the LAST row read is undated or due after
 * today+7, every row due on or before today+7 is in hand. Otherwise the cap
 * may have cut a due, overdue or this-week item, and the honest answer is
 * the existing unreadable path — `Couldn't load to-dos.`, an untinted hero,
 * and the week's to-do side unread — never `Nothing due.`, green and `—`.
 * The To-do tile does not use this: its bounds count from `sectionTotals`.
 */
function readTodosForWindow(feed: OpenTodosFeed, today: DayKey): OpenTodosFeed {
  if (feed === "unavailable") return feed;
  // The order is checked, not trusted: a feed out of contract order (Mongo's
  // default puts the undated FIRST) cannot have its cap judged, and even
  // uncapped it signals a loader that is not the one this contract describes.
  if (!inWindowOrder(feed.rows)) return "unavailable";
  const capped = feed.rows.length === OPEN_TODOS_CAP && feed.rows.length < feed.total;
  if (!capped) return feed;
  const last = feed.rows[feed.rows.length - 1];
  if (last === undefined) return "unavailable";
  if (last.dueOn !== null && last.dueOn <= addDays(today, 7)) return "unavailable";
  return feed;
}

/**
 * The part of the contracted order the window judgement relies on: dated rows
 * by dueOn ascending, every undated row after every dated one. The undated
 * rows' createdAt order is not checked — it cannot move the cut across
 * today+7, and sortTodos re-sorts each group anyway.
 */
function inWindowOrder(rows: readonly OpenTodoInput[]): boolean {
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].dueOn;
    const cur = rows[i].dueOn;
    if (prev === null && cur !== null) return false;
    if (prev !== null && cur !== null && cur < prev) return false;
  }
  return true;
}

// ---- 1. Today ---------------------------------------------------------------

/** deck §6 Tile 1: `09:00–10:50`, `all day`; the start alone when there is no end. */
function eventRange(e: CalendarEvent): string {
  if (e.allDay || e.startsAt === null) return ALL_DAY;
  return e.endsAt === null ? clock(e.startsAt) : `${clock(e.startsAt)}–${clock(e.endsAt)}`;
}

/**
 * Today's DUE group and the hero's tint, from the to-do feed ALONE — the one
 * derivation of both. buildTodayView calls it, and so does the page for
 * Today's Suspense fallback: the to-do read has answered before the calendar
 * has, and an untinted hero would claim it had not (R83). One function, so
 * the fallback and the tile can never disagree about the tint.
 */
export function buildTodayDue(
  todos: OpenTodosFeed,
  now: Date,
): { due: TodayView["due"]; heroTint: HeroTint | null } {
  const today = todayKey(now);
  const todosFeed = readTodosForWindow(todos, today);
  if (todosFeed === "unavailable") return { due: { kind: "fail", line: todosFail() }, heroTint: heroTint(null) };
  // deck §6 Tile 1: "to-dos due today, then overdue to-dos" — the deck's
  // order, not sortTodos's overdue-first. Each half is sortTodos'd: today's
  // oldest-created first, the overdue most-overdue first.
  const dueToday = sortTodos(todosFeed.rows.filter((t) => t.dueOn === today));
  const overdue = sortTodos(todosFeed.rows.filter((t) => t.dueOn !== null && t.dueOn < today));
  const rows = [...dueToday, ...overdue].map((t) => todoRow(t, today));
  return { due: rows.length > 0 ? { kind: "rows", rows } : { kind: "empty" }, heroTint: heroTint(rows.length) };
}

/**
 * The hero. `heroTint` is called with the DUE group's row count — to-dos due
 * today plus overdue — or null when that read failed, and NEVER with anything
 * the calendar said (R74, R83, R85): a crowded calendar, a failed layer, an
 * expired token and an all-off switchboard all leave the tint where the to-do
 * read put it. An overdue to-do counts as one, like any other.
 */
export function buildTodayView(input: TodayInput): TodayView {
  const today = todayKey(input.now);
  const cal = readCalendar(input.calendar);

  let scheduled: TodayView["scheduled"];
  if (cal.kind === "none-enabled") {
    scheduled = { kind: "fail", lines: [cal.line] };
  } else if (cal.kind === "unread") {
    scheduled = { kind: "fail", lines: cal.lines };
  } else {
    const todays = cal.events.filter((e) => e.dayKey === today);
    const fails = cal.kind === "partial" ? cal.lines : [];
    if (todays.length > 0) {
      const rows = todays.slice(0, DISPLAY_BOUND).map(
        (e): EventRowView => ({
          id: e.id,
          calendarId: e.calendarId,
          title: e.title,
          layerName: e.layerName,
          time: eventRange(e),
          href: e.htmlLink,
        }),
      );
      scheduled = { kind: "rows", rows, bound: boundLine(rows.length, todays.length), fails };
    } else if (fails.length > 0) {
      // `Nothing scheduled.` is suppressed while any enabled layer is unread (P8 R51).
      scheduled = { kind: "fail", lines: fails };
    } else {
      scheduled = { kind: "empty" };
    }
  }

  const { due, heroTint: tint } = buildTodayDue(input.todos, input.now);

  return {
    dateLabel: formatDay(today), // deck §6 Tile 1: `Thu 10 Sep`
    heroTint: tint,
    scheduled,
    due,
    spread: scheduled.kind === "empty" && due.kind === "empty",
    formCapable: formCapableFor(input.layout, "today"),
    eventFormBlocked: eventFormBlocked(input.calendar),
  };
}

function eventFormBlocked(feed: CalendarFeed): boolean {
  if (feed === "layers-unavailable") return true;
  if (feed.window.ok) return false;
  return feed.window.reason !== "timeout";
}

// ---- 2. Next 7 days ---------------------------------------------------------

/**
 * Tomorrow through the seventh day. A day is `{items}` — and may print `—` —
 * only when every source that could fill it answered; a day that came back
 * with nothing while a source was down is `{unread: true}` (R18). Items that
 * DID arrive are shown, since they are real. `none-enabled` counts as answered
 * (R45). Both feeds down: `days: null` (R18, deck §11).
 *
 * Nothing is truncated inside a day (R51b): every item is in `items`.
 */
export function buildWeekView(input: WeekInput): WeekView {
  const today = todayKey(input.now);
  const cal = readCalendar(input.calendar);
  const todosFeed = readTodosForWindow(input.todos, today);
  const todosDown = todosFeed === "unavailable";

  const fails: SayLine[] = [];
  if (cal.kind === "none-enabled") fails.push(cal.line);
  else if (cal.kind === "partial" || cal.kind === "unread") fails.push(...cal.lines);
  if (todosDown) fails.push(todosFail());

  if (todosDown && cal.kind === "unread") return { days: null, fails };

  const everySourceAnswered = (cal.kind === "answered" || cal.kind === "none-enabled") && !todosDown;
  const events = cal.kind === "answered" || cal.kind === "partial" ? cal.events : [];
  const todos = todosFeed === "unavailable" ? [] : sortTodos(todosFeed.rows);

  const days: DayRowView[] = [];
  for (let n = 1; n <= 7; n++) {
    const key = addDays(today, n);
    const label = shortDay(key);
    // deck §6 Tile 5: all-day events, timed events by start, then to-dos.
    const items: DayItemView[] = [
      ...events
        .filter((e) => e.dayKey === key)
        .map(
          (e): DayItemView => ({
            kind: "event",
            id: e.id,
            calendarId: e.calendarId,
            title: e.title,
            time: e.allDay || e.startsAt === null ? ALL_DAY : clock(e.startsAt),
            layerOrSection: e.layerName,
            href: e.htmlLink,
          }),
        ),
      ...todos
        .filter((t) => t.dueOn === key)
        .map(
          (t): DayItemView => ({
            kind: "todo",
            id: t.id,
            calendarId: TODO_ITEM_CALENDAR_ID,
            title: t.title,
            time: null,
            layerOrSection: SECTION_LABEL[t.section],
            href: null,
          }),
        ),
    ];
    days.push(items.length === 0 && !everySourceAnswered ? { key, label, unread: true } : { key, label, items });
  }
  return { days, fails };
}

/**
 * The shape a day row renders in (R57), from its item count, so the rule lives
 * here and is tested here:
 *   unread        no dash and no items (R18)
 *   0 → dash      `—`, a measurement (deck §6 Tile 5, R19)
 *   1 → one       the item, plain — never wrapped in a disclosure (R57, R77)
 *   2+ → disclosure  summary = the leading item's own title, bare (R58);
 *                 count = `N items` (deck §15, R90). There is no singular:
 *                 this branch is reached only at two or more.
 */
export type DayShape =
  | { kind: "unread" }
  | { kind: "dash" }
  | { kind: "one"; item: DayItemView }
  | { kind: "disclosure"; summary: string; count: string; items: DayItemView[] };

export function dayShape(row: DayRowView): DayShape {
  if ("unread" in row) return { kind: "unread" };
  if (row.items.length === 0) return { kind: "dash" };
  if (row.items.length === 1) return { kind: "one", item: row.items[0] };
  return {
    kind: "disclosure",
    summary: row.items[0].title,
    count: `${row.items.length} items`, // deck §15 (2026-09-25): `2 items` / `3 items`
    items: row.items,
  };
}

// ---- 3. To-do ---------------------------------------------------------------

/**
 * Three sections, always, in deck order; each sorted by sortTodos and bounded
 * at 20 with `Showing 20 of 34.` (deck §6 Tile 2). The header figure is the
 * store's `total`; under a failed read there is no figure at all (R21).
 */
export function buildTodoTileView(input: TodoTileInput): TodoTileView {
  if (input.todos === "unavailable") return { count: null, sections: null, fail: todosFail() };
  const today = todayKey(input.now);
  const { rows, sectionTotals } = input.todos;
  const sections = SECTION_ORDER.map((key): TodoSectionView => {
    const all = sortTodos(rows.filter((t) => t.section === key));
    const shown = all.slice(0, DISPLAY_BOUND).map((t) => todoRow(t, today));
    // The store's count, never the read's length; the max only guards a
    // count that arrived lower than the rows actually in hand.
    const sectionTotal = Math.max(sectionTotals[key], all.length);
    return { key, label: SECTION_LABEL[key], rows: shown, bound: boundLine(shown.length, sectionTotal) };
  });
  return { count: Math.max(input.todos.total, rows.length), sections, fail: null };
}

// ---- 4. Done this week ------------------------------------------------------

/**
 * Most recent first, bounded at 20 (deck §6 Tile 6). A done row that still
 * holds a calendarEventId is the page's one in-flight state — an entry Google
 * refused to remove — and the row says so (deck §15).
 */
export function buildDoneView(input: DoneInput): DoneTileView {
  if (input.done === "unavailable") return { count: null, rows: [], bound: null, fail: todosFail() };
  const sorted = [...input.done.rows].sort((a, b) => b.doneAt.getTime() - a.doneAt.getTime());
  const rows = sorted.slice(0, DISPLAY_BOUND).map((t) => ({
    id: t.id,
    title: t.title,
    sectionLabel: SECTION_LABEL[t.section],
    dayLabel: shortDay(dayKey(t.doneAt, APP_TZ)), // deck §6 Tile 6: `Mon 8`
    // deck §15: the Done row of a to-do whose entry could not be removed.
    note: isPinned(t.calendarEventId) ? "entry left on Google" : null,
  }));
  const total = Math.max(input.done.total, rows.length);
  return {
    count: total === 0 ? null : total, // deck §6 Tile 6, §12: absent at zero
    rows,
    bound: boundLine(rows.length, total),
    fail: null,
  };
}

// ---- 5. This morning's push -------------------------------------------------

/**
 * The quotation tile (R14): title and body are handed through exactly as
 * stored — never clamped, re-counted or evaluated — and `devices` is not
 * carried. Precedence, first match wins:
 *
 *   digest unreadable                   → fail
 *   a digest sent today (APP_TZ)        → quote; `sent HH:MM` from sentAt
 *   (a `skipped` dispatcher run counts as no run at all — see PushInput)
 *   dispatcher ok, started today        → went-out-unstored (no dot, R22)
 *   monitoring off                      → monitoring-off
 *   dispatcher unreadable               → fail: "no push" and "a push whose
 *                                         text was not stored" can no longer
 *                                         be told apart, and the tile does
 *                                         not guess
 *   no digest ever                      → never
 *   an older digest                     → no-push-today, with `Last: …`; the
 *                                         `missing` dot from 07:00 in APP_TZ
 *
 * Monitoring-off loses to a push stored for today (invariant 11) and — a
 * judgement call — to a push the run log says went out today: the tile says
 * what happened this morning before what the switch will do.
 */
export function buildPushTileView(input: PushInput): PushTileView {
  const blank = { stamp: null, title: null, body: null, last: null } as const;
  const { digest, now } = input;
  // A skipped run (monitoring off) is NO run: not a push, not a failure.
  const dispatcher =
    input.dispatcher !== "unavailable" && input.dispatcher !== null && input.dispatcher.skipped
      ? null
      : input.dispatcher;
  const today = todayKey(now);
  const unreadable = stale("Couldn’t load this morning’s push."); // deck §6 Tile 4, §11

  if (digest === "unavailable") return { kind: "fail", ...blank, line: unreadable };
  if (digest !== null && dayKey(digest.sentAt, APP_TZ) === today) {
    return {
      kind: "quote",
      stamp: `sent ${clock(digest.sentAt)}`, // deck §6 Tile 4: `sent 07:00` — sentAt, never the cron's hour
      title: digest.title,
      body: digest.body,
      last: null,
      line: null,
    };
  }
  if (dispatcher !== "unavailable" && dispatcher !== null && dispatcher.ok && dayKey(dispatcher.startedAt, APP_TZ) === today) {
    return { kind: "went-out-unstored", ...blank, line: bare("A push went out this morning. Its text wasn’t stored.") }; // deck §15
  }
  if (input.monitoringEnabled === false) {
    return { kind: "monitoring-off", ...blank, line: bare("Monitoring is off, so no push goes out.") }; // deck §6 Tile 4
  }
  if (dispatcher === "unavailable") return { kind: "fail", ...blank, line: unreadable };
  if (digest === null) return { kind: "never", ...blank, line: bare("No push recorded yet.") }; // deck §6 Tile 4

  // deck §15: `No push this morning.` turns red only once 07:00 has passed.
  const pastExpected = Number(clock(now).slice(0, 2)) >= PUSH_EXPECTED_HOUR;
  return {
    kind: "no-push-today",
    ...blank,
    last: {
      stamp: `Last: ${formatDay(dayKey(digest.sentAt, APP_TZ))} ${clock(digest.sentAt)}`, // deck §6 Tile 4: `Last: Tue 9 Sep 07:00`
      title: digest.title,
      body: digest.body,
    },
    line: { text: "No push this morning.", dot: pastExpected ? "missing" : null }, // deck §6 Tile 4
  };
}

// ---- 6. Layers --------------------------------------------------------------

/**
 * One switch per stored layer, in stored order. Not-configured and expired
 * show Tile 1's sentence and no switches, matching the Settings card (deck §9,
 * visual spec §4.3); a per-layer or whole-calendar read failure keeps the
 * switches live, because switching still means something. A vanished calendar
 * keeps its row and carries deck §15's sentence as its note (R42).
 */
export function buildLayersView(input: LayersInput): LayersTileView {
  const feed = input.calendar;
  if (feed === "layers-unavailable") {
    return { kind: "fail", rows: [], line: stale("Couldn’t load layers.") }; // deck §6 Tile 3, §11
  }
  if (feed.layers.length === 0) {
    return { kind: "sentence", rows: [], line: bare("No calendars chosen. Pick them in Settings.") }; // deck §6 Tile 3
  }
  if (!feed.window.ok && feed.window.reason === "not-configured") {
    return { kind: "sentence", rows: [], line: bare("Google isn’t connected yet. Set it up in Settings.") }; // deck §6 Tile 1
  }
  if (!feed.window.ok && feed.window.reason === "expired") {
    return { kind: "sentence", rows: [], line: stale("Google access has expired. Renew it from Settings.") }; // deck §6 Tile 1
  }
  const present = feed.calendars === null ? null : new Set(feed.calendars.map((c) => c.calendarId));
  return {
    kind: "switches",
    rows: feed.layers.map((l) => ({
      calendarId: l.calendarId,
      name: l.name,
      enabled: l.enabled,
      note:
        present !== null && !present.has(l.calendarId)
          ? `${l.name} is no longer on your Google account. Untick it in Settings.` // deck §15, R42
          : null,
    })),
    line: null,
  };
}

// ---- The Settings page's two Google cards (P10c Task 9) ----------------------

/** One row of the Settings picker (`.pickrow`). `ticked` = the calendar is a stored layer. */
export interface PickerRow {
  calendarId: string;
  name: string;
  ticked: boolean;
  /** deck §15's vanished-calendar sentence, or null. Rendered in `.fl-note`, no dot. */
  note: string | null;
}

/**
 * The picker's rows: the STORED layers first, in stored order (membership
 * order is display order, D10), then every Google calendar that is not a
 * layer, unticked, in Google's order (deck §9). Derived from `layers` joined
 * against Google's list and NOT from Google's list alone (R42): a stored
 * layer Google no longer returns keeps its row — ticked and live, so there is
 * something to untick — and carries deck §15's sentence. A stored row keeps
 * its stored name, the name the Personal page shows.
 */
export function pickerRows(
  stored: readonly Layer[],
  fromGoogle: readonly CalendarListEntry[],
): PickerRow[] {
  const present = new Set(fromGoogle.map((c) => c.calendarId));
  const chosen = new Set(stored.map((l) => l.calendarId));
  return [
    ...stored.map((l) => ({
      calendarId: l.calendarId,
      name: l.name,
      ticked: true,
      note: present.has(l.calendarId)
        ? null
        : `${l.name} is no longer on your Google account. Untick it in Settings.`, // deck §15, R42
    })),
    ...fromGoogle
      .filter((c) => !chosen.has(c.calendarId))
      .map((c) => ({ calendarId: c.calendarId, name: c.name, ticked: false, note: null })),
  ];
}

/** The two bounds a tick is checked against — OsSettings' LAYERS_MAX and LAYER_NAME_MAX, passed in so this module never imports a model (R52). */
export interface PickerLimits {
  layers: number;
  name: number;
}

export type PickerToggle =
  | { ok: true; layers: Layer[] }
  | { ok: false; note: "Up to 10 calendars." };

/**
 * One tap on a picker row → the WHOLE `layers` array the PATCH sends (the
 * door replaces it whole; settings.ts). Unticking removes the layer, and its
 * switch with it (deck §9). Ticking appends it switched on ("Defaults when
 * first chosen: on", deck §6 Tile 3), its name bounded to the model's
 * maxlength so a long Google name cannot turn a tick into a 400. A tick past
 * the bound is refused before any request with deck §9's `Up to 10
 * calendars.` — a press outcome, never a standing note (R43). An untick is
 * never refused, so a store somehow over the bound can still be brought back
 * under it.
 *
 * Not refused here: a calendarId past the model's 256 would 400 at the door
 * and read `Couldn't save.`. The deck has no sentence for refusing one before
 * the fact, so none is invented; real Google ids are ~50 characters.
 */
export function pickerToggle(
  stored: readonly Layer[],
  row: { calendarId: string; name: string },
  limits: PickerLimits,
): PickerToggle {
  const copy = stored.map((l) => ({ calendarId: l.calendarId, name: l.name, enabled: l.enabled }));
  if (copy.some((l) => l.calendarId === row.calendarId)) {
    return { ok: true, layers: copy.filter((l) => l.calendarId !== row.calendarId) };
  }
  if (copy.length >= limits.layers) return { ok: false, note: "Up to 10 calendars." }; // deck §9, R43
  const name = row.name.length > limits.name ? `${row.name.slice(0, limits.name - 1)}…` : row.name;
  return { ok: true, layers: [...copy, { calendarId: row.calendarId, name, enabled: true }] };
}

/** What `listCalendars()` answered, as the Settings page hands it over: the list, or the failure's kind. */
export type CalendarListFeed =
  | { ok: true; calendars: CalendarListEntry[] }
  | { ok: false; kind: GoogleErrorKind | "unknown" };

export interface SettingsCardsView {
  /** The `Google Calendar` card's one sentence (deck §9). */
  connection: string;
  /**
   * The `Calendar layers` card: its picker, or one sentence and no list.
   * `stored` is the array the rows were joined from: pickerToggle builds each
   * PATCH from it.
   */
  layers: { kind: "picker"; rows: PickerRow[]; stored: Layer[] } | { kind: "sentence"; text: string };
}

const NOT_SET_UP = "Not set up. Add the three Google values to the environment and redeploy."; // deck §9
const EXPIRED = "Access expired. Run the sign-in again and replace the token."; // deck §9

/**
 * Both Settings cards from ONE `listCalendars()` answer (R24). `Connected.`
 * means exactly that the list came back (deck §15) — not that a token exists.
 * Not set up or expired: the layers card repeats the connection card's own
 * sentence and shows no list, because an empty picker reads as a page that
 * failed rather than a connection never made (visual spec §4.10). Any other
 * failure — timeout, http, gone, or something that is not a GoogleError — is
 * `Couldn't check right now.` / `Couldn't list your calendars.`. A list that
 * came back beside a stored `layers` that could not be read cannot be joined
 * (R42 needs both), so the layers card says Tile 3's `Couldn't load layers.`
 * and the connection card still says `Connected.`: the two facts are separate.
 */
export function buildSettingsCards(
  google: CalendarListFeed,
  stored: readonly Layer[] | "unavailable",
): SettingsCardsView {
  if (!google.ok) {
    if (google.kind === "not-configured") {
      return { connection: NOT_SET_UP, layers: { kind: "sentence", text: NOT_SET_UP } };
    }
    if (google.kind === "expired") {
      return { connection: EXPIRED, layers: { kind: "sentence", text: EXPIRED } };
    }
    return {
      connection: "Couldn’t check right now.", // deck §9
      layers: { kind: "sentence", text: "Couldn’t list your calendars." }, // deck §9
    };
  }
  if (stored === "unavailable") {
    return { connection: "Connected.", layers: { kind: "sentence", text: "Couldn’t load layers." } }; // deck §9; deck §6 Tile 3, §11
  }
  return {
    connection: "Connected.", // deck §9
    layers: {
      kind: "picker",
      rows: pickerRows(stored, google.calendars),
      stored: stored.map((l) => ({ calendarId: l.calendarId, name: l.name, enabled: l.enabled })),
    },
  };
}
