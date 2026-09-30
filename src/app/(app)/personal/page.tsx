import type { Metadata } from "next";
import { Suspense } from "react";
import { connectDB } from "@/lib/db";
import { MONGO_READ_TIMEOUT_MS, withDeadline } from "@/lib/deadline";
import { addDays, eventTimeDefaults, formatDay, todayKey, type DayKey } from "@/lib/days";
import {
  listCalendars,
  readCalendarWindow,
  windowBounds,
  type CalendarListEntry,
  type CalendarWindow,
} from "@/lib/google";
import { getLastDigest, type StoredDigest } from "@/lib/lastDigest";
import { readOsSettings, type Layer, type OsSettingsValues } from "@/lib/osSettings";
import { resolvePersonalLayout } from "@/lib/personalLayout";
import {
  DISPLAY_BOUND,
  OPEN_TODOS_CAP,
  buildDoneView,
  buildLayersView,
  buildPushTileView,
  buildTodayDue,
  buildTodayView,
  buildTodoTileView,
  buildWeekView,
  formCapableFor,
  type CalendarFeed,
  type DoneInput,
  type OpenTodoInput,
  type OpenTodosFeed,
  type PushInput,
} from "@/lib/personalView";
import { doneWindowStart, todoDueKey } from "@/lib/todos";
import AgentRun from "@/models/AgentRun";
import Todo, { TODO_SECTIONS, type TodoSection } from "@/models/Todo";
import LayoutEditor from "./LayoutEditor";
import Done from "./_blocks/Done";
import Layers, { LayersFallback } from "./_blocks/Layers";
import Push from "./_blocks/Push";
import Today, { TodayFallback, type EventFormData } from "./_blocks/Today";
import Todos, { type TodoDueKeys } from "./_blocks/Todos";
import Week, { WeekFallback } from "./_blocks/Week";

/**
 * /personal — a renderer with no opinions in it. Every decision the page makes
 * lives in a Plan B pure module and is pinned by its tests: this file reads,
 * hands each builder its inputs, and places the results.
 *
 * Every figure is "what is true right now": nothing to cache, nothing to
 * revalidate.
 */
export const dynamic = "force-dynamic";

/**
 * A CONTAINMENT bound and nothing more. The reader's protection is the
 * explicit timeouts under it — MONGO_READ_TIMEOUT_MS on phase 1, and
 * GOOGLE_TIMEOUT_MS per layer inside readCalendarWindow in phase 2 — which land
 * in catches that produce states this page already designed.
 */
export const maxDuration = 30;

/** One word: the root layout carries the `%s · APP_NAME` template (P8 R64). */
export const metadata: Metadata = { title: "Personal" };

// --- Phase 1: the Mongo reads ------------------------------------------------

/**
 * `PromiseSettledResult` -> the value, or "unavailable" — and a rejection is
 * LOGGED with the read named, so every sentence on screen has a line in the
 * log saying which read it was. "unavailable" is never null: a LastDigest
 * that was never stored (null) and one that could not be read are different
 * tiles (R55).
 */
function settled<T>(result: PromiseSettledResult<T>, label: string): T | "unavailable" {
  if (result.status === "fulfilled") return result.value;
  console.error(`[personal] ${label} failed:`, result.reason);
  return "unavailable";
}

interface OpenTodoDoc {
  _id: unknown;
  title: string;
  section: TodoSection;
  dueOn?: Date | null;
  createdAt: Date;
  calendarEventId?: string | null;
  calendarBehind?: boolean;
}

const OPEN_FIELDS = { title: 1, section: 1, dueOn: 1, createdAt: 1, calendarEventId: 1, calendarBehind: 1 } as const;

function openRow(doc: OpenTodoDoc): OpenTodoInput {
  return {
    id: String(doc._id),
    title: doc.title,
    section: doc.section,
    dueOn: todoDueKey(doc.dueOn),
    createdAt: doc.createdAt,
    calendarEventId: doc.calendarEventId ?? null,
    // Absent on rows written before the field: absent reads as false.
    calendarBehind: doc.calendarBehind === true,
  };
}

/**
 * The open feed, in the OpenTodosFeed contract's order: dated rows by dueOn
 * ascending, then the undated by createdAt ascending. Mongo's ascending sort
 * puts a missing dueOn FIRST, so the two halves are read apart (both on the
 * `{done:1, dueOn:1}` index) and joined here, then cut at OPEN_TODOS_CAP.
 * The counts are the store's — one aggregate by section — never the list's,
 * so a capped read can shorten a section but never undercount it.
 */
async function readOpenTodos(): Promise<Exclude<OpenTodosFeed, "unavailable">> {
  const [dated, undated, groups] = await Promise.all([
    Todo.find({ done: false, dueOn: { $ne: null } }, OPEN_FIELDS)
      .sort({ dueOn: 1, createdAt: 1 })
      .limit(OPEN_TODOS_CAP)
      .lean<OpenTodoDoc[]>(),
    Todo.find({ done: false, dueOn: null }, OPEN_FIELDS)
      .sort({ createdAt: 1 })
      .limit(OPEN_TODOS_CAP)
      .lean<OpenTodoDoc[]>(),
    Todo.aggregate<{ _id: string; n: number }>([
      { $match: { done: false } },
      { $group: { _id: "$section", n: { $sum: 1 } } },
    ]),
  ]);
  const sectionTotals = Object.fromEntries(TODO_SECTIONS.map((s) => [s, 0])) as Record<TodoSection, number>;
  let total = 0;
  for (const g of groups) {
    total += g.n;
    if ((TODO_SECTIONS as readonly string[]).includes(g._id)) sectionTotals[g._id as TodoSection] = g.n;
  }
  return { rows: [...dated, ...undated].slice(0, OPEN_TODOS_CAP).map(openRow), total, sectionTotals };
}

interface DoneTodoDoc {
  _id: unknown;
  title: string;
  section: TodoSection;
  doneAt: Date;
  calendarEventId?: string | null;
}

/**
 * Done this week: a rolling seven days in APP_TZ (deck §6 Tile 6), from the
 * APP_TZ midnight that begins doneWindowStart(today), for the rows and the
 * count alike. The newest DISPLAY_BOUND rows are all the tile can show.
 */
async function readDoneTodos(today: DayKey): Promise<Exclude<DoneInput["done"], "unavailable">> {
  const since = windowBounds(doneWindowStart(today), today).timeMin;
  const filter = { done: true, doneAt: { $gte: since } };
  const [docs, total] = await Promise.all([
    Todo.find(filter, { title: 1, section: 1, doneAt: 1, calendarEventId: 1 })
      .sort({ doneAt: -1 })
      .limit(DISPLAY_BOUND)
      .lean<DoneTodoDoc[]>(),
    Todo.countDocuments(filter),
  ]);
  return {
    rows: docs.map((d) => ({
      id: String(d._id),
      title: d.title,
      section: d.section,
      doneAt: d.doneAt,
      calendarEventId: d.calendarEventId ?? null,
    })),
    total,
  };
}

type Dispatcher = Exclude<PushInput["dispatcher"], "unavailable">;

/**
 * The dispatcher's newest run, with `skipped` and `error` projected — which
 * watchdog's fetchLatestRuns does not select (P10b carry-forward). A row with
 * a `skipped` key says so itself; only a row WITHOUT the key (written before
 * the field) falls back to `ok && error`, never a row where it is false.
 */
async function readDispatcher(): Promise<Dispatcher> {
  const doc = await AgentRun.findOne({ agent: "dispatcher" })
    .sort({ startedAt: -1 })
    .select({ ok: 1, startedAt: 1, skipped: 1, error: 1 })
    .lean<{ ok: boolean; startedAt: Date; skipped?: boolean; error?: string }>();
  if (!doc) return null;
  const skipped = typeof doc.skipped === "boolean" ? doc.skipped : doc.ok === true && typeof doc.error === "string";
  return { ok: doc.ok, startedAt: doc.startedAt, skipped };
}

// --- Phase 2: the calendar ----------------------------------------------------

/**
 * The ONE calendar promise (R34): the stored layers' window for today …
 * today+7, read once for every tile, with listCalendars() beside it in the
 * same round — R42's only way to tell a vanished calendar from one that did
 * not answer. It never rejects: a window read that throws (a programming
 * error; google.ts answers every Google failure in-band) is logged and read as
 * `Couldn't read the calendar.`; a calendar list that fails is null, which
 * calls nothing vanished. With no layer switched on the list is not asked
 * for, and readCalendarWindow answers `none-enabled` before any HTTP, so an
 * all-off switchboard costs no Google call (R20, R45).
 *
 * Logging: the window's own failure is logged once, by reason or by the
 * failed layers' names. The list's failure is logged only when the window
 * answered — under not-configured / expired / timeout it fails for the same
 * reason, and one outage is one line.
 */
async function readCalendarFeed(layers: Layer[], today: DayKey): Promise<CalendarFeed> {
  const [window, list] = await Promise.all([
    readCalendarWindow(layers, today, addDays(today, 7)).catch((err: unknown): CalendarWindow => {
      console.error("[personal] calendar window failed:", err);
      return { ok: false, reason: "timeout" };
    }),
    layers.some((l) => l.enabled)
      ? listCalendars().then(
          (calendars): { calendars: CalendarListEntry[] | null; err?: unknown } => ({ calendars }),
          (err: unknown) => ({ calendars: null, err }),
        )
      : { calendars: null },
  ]);
  if (!window.ok) {
    if (window.reason !== "none-enabled") console.error(`[personal] calendar window: ${window.reason}`);
  } else {
    if (window.failed.length > 0) {
      // Joined to names for the log; an id no layer holds is logged as the id.
      const names = window.failed.map((id) => layers.find((l) => l.calendarId === id)?.name ?? id);
      console.error(`[personal] calendar window: couldn't read ${names.join(", ")}`);
    }
    if ("err" in list) console.error("[personal] calendar list failed:", list.err);
  }
  return { layers, window, calendars: list.calendars };
}

export default async function PersonalPage() {
  const now = new Date();
  const today = todayKey(now);

  // --- Phase 1: one deadline-bounded round of Mongo reads ----------------
  //
  // All five reads start together behind one connect, and each is bounded by
  // the same MONGO_READ_TIMEOUT_MS from the same moment, so the phase costs
  // one deadline however it fails. Settled one by one, not all-or-nothing:
  // a LastDigest that cannot be read must not take the to-dos down with it.
  // readOsSettings, never getOsSettings — the latter is an upsert, and would
  // make every page view a primary write (R37).
  const connected = connectDB();
  const bounded = <T,>(read: () => Promise<T>, label: string) =>
    withDeadline(
      connected.then(() => read()),
      MONGO_READ_TIMEOUT_MS,
      `personal ${label}`,
    );
  const [settingsR, openR, doneR, digestR, dispatcherR] = await Promise.allSettled([
    bounded(readOsSettings, "settings read"),
    bounded(readOpenTodos, "open to-do read"),
    bounded(() => readDoneTodos(today), "done to-do read"),
    bounded(getLastDigest, "last-digest read"),
    bounded(readDispatcher, "dispatcher run read"),
  ]);
  const settings: OsSettingsValues | "unavailable" = settled(settingsR, "settings read");
  const todos: OpenTodosFeed = settled(openR, "open to-do read");
  const done: DoneInput["done"] = settled(doneR, "done to-do read");
  const digest: StoredDigest | null | "unavailable" = settled(digestR, "last-digest read");
  const dispatcher: PushInput["dispatcher"] = settled(dispatcherR, "dispatcher run read");

  // The grid always renders (deck §11). An arrangement that cannot be read —
  // settings down included — is the default, and says so once (deck §15).
  const { layout, fellBack } = resolvePersonalLayout(
    settings === "unavailable" ? undefined : settings.personalLayout,
  );

  // --- Phase 2: created, NOT awaited (R34) -------------------------------
  //
  // Skipped entirely when the layers are unknown (§7.4): there is no calendar
  // read to attempt, and attempting one would say `Couldn't read the
  // calendar.` where the truth is `Couldn't load layers, so the calendar
  // wasn't read.`
  const calendar: Promise<CalendarFeed> =
    settings === "unavailable"
      ? Promise.resolve("layers-unavailable")
      : readCalendarFeed(settings.layers, today);

  // --- The view models ---------------------------------------------------
  const todayView = calendar.then((feed) => buildTodayView({ now, calendar: feed, todos, layout }));
  const weekView = calendar.then((feed) => buildWeekView({ now, calendar: feed, todos }));
  const layersView = calendar.then((feed) => buildLayersView({ calendar: feed }));
  const todoTile = buildTodoTileView({ now, todos });
  const doneTile = buildDoneView({ done });
  const pushTile = buildPushTileView({
    now,
    digest,
    dispatcher,
    monitoringEnabled: settings === "unavailable" ? "unavailable" : settings.monitoringEnabled,
  });

  const todoDue: TodoDueKeys =
    todos === "unavailable" ? {} : Object.fromEntries(todos.rows.map((t) => [t.id, t.dueOn]));
  const eventForm: EventFormData = {
    calendars:
      settings === "unavailable"
        ? []
        : settings.layers.filter((l) => l.enabled).map((l) => ({ calendarId: l.calendarId, name: l.name })),
    defaults: eventTimeDefaults(now),
  };

  return (
    <LayoutEditor
      layout={layout}
      notice={
        fellBack ? (
          // deck §15 — the ninth dot of the whole-database outage render (R55).
          <div className="pe-fail">
            <i />
            <span className="said">Couldn’t load your arrangement, so this is the default.</span>
          </div>
        ) : null
      }
      tiles={{
        today: (
          <Suspense fallback={<TodayFallback dateLabel={formatDay(today)} heroTint={buildTodayDue(todos, now).heroTint} />}>
            <Today view={todayView} eventForm={eventForm} todoDue={todoDue} />
          </Suspense>
        ),
        todos: <Todos view={todoTile} todoDue={todoDue} formCapable={formCapableFor(layout, "todos")} />,
        layers: (
          <Suspense fallback={<LayersFallback />}>
            <Layers view={layersView} />
          </Suspense>
        ),
        push: <Push view={pushTile} />,
        week: (
          <Suspense fallback={<WeekFallback />}>
            <Week view={weekView} />
          </Suspense>
        ),
        done: <Done view={doneTile} />,
      }}
    />
  );
}
