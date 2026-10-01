import type { DayKey } from "@/lib/days";
import type { SayLine, TodayView } from "@/lib/personalView";
import { EventTile } from "../EventForm";
import { TileHead } from "../LayoutEditor";
import TodoForm from "../TodoForm";
import TodoRow from "../TodoRow";
import { withSettingsLink } from "./SettingsLine";
import { editableTodo, type TodoDueKeys } from "./Todos";

/**
 * What EventForm (Task 4) needs, computed on the server so no default is ever
 * the browser's zone (deck §7): the switched-on layers in stored order (the
 * first is the default calendar), and today / the next full hour / +1h in
 * APP_TZ.
 */
export interface EventFormData {
  /** Today in APP_TZ — the week the page shows is today+1 … today+7 (deck §15's "outside this week"). */
  today: DayKey;
  calendars: ReadonlyArray<{ calendarId: string; name: string }>;
  defaults: { dayKey: DayKey; start: string; end: string };
}

export interface TodayProps {
  /** buildTodayView's result, behind the page's one calendar promise (R34). */
  view: Promise<TodayView>;
  eventForm: EventFormData;
  /** The open to-dos' due days, for a DUE row's edit form (TodoRowView carries only the chip). */
  todoDue: TodoDueKeys;
}

/** `pe-tile is-hero` plus the ramp's one class (R80). null = the to-do read failed (R83): untinted. */
function heroClass(tint: TodayView["heroTint"]): string {
  return tint === null ? "pe-tile is-hero" : `pe-tile is-hero pe-t${tint}`;
}

/** The id of the Scheduled sentence a blocked `+ Event` points at as its reason (one Today tile per page). */
const REASON_ID = "pe-today-reason";

/** One sentence: dotted is a couldn't-read (`.pe-fail`, R10), bare is `.fl-empty` (R42's vanished layer, a switch you made). */
function Line({ line, id }: { line: SayLine; id?: string }) {
  if (line.dot === null) {
    return (
      <p className="fl-empty" id={id}>
        {withSettingsLink(line.text)}
      </p>
    );
  }
  return (
    <div className={line.dot === "missing" ? "pe-fail is-missing" : "pe-fail"} id={id}>
      <i></i>
      <span className="said">{withSettingsLink(line.text)}</span>
    </div>
  );
}

/**
 * Tile 1 — Today, the hero (deck §6 Tile 1). Rendered here on the server;
 * EventTile is the client half that owns `+ Event` and swaps the body for
 * the event form while it is open.
 *
 * Two groups, in order. SCHEDULED: today's events, all-day first then by
 * start (the view's order); every row links out to Google and the row is not
 * the anchor (P8 R36) — the anchor is the title's grid item. The calendar's
 * sentence goes AFTER the rows that arrived (deck), and `Nothing scheduled.`
 * renders only when the view says `empty` — the view already suppresses it
 * while any enabled layer is unread (P8 R51), so nothing here tests a row
 * count. DUE: due today, then overdue, through TodoRow, ticks as in Tile 2.
 *
 * THE TINT (R79–R85) is one class from heroTint, on this <section>, decided
 * here at render and nowhere else: from the to-do read alone (R74) — no
 * calendar state touches it — and untinted only when that read failed (R83).
 * An open form or edit mode leaves it as it is (R75, R78); a to-do added
 * through a form warms it at the next server render, not as the form closes
 * (R67).
 *
 * `.pe-body.is-pair` (space-between) only when both groups are empty (R17,
 * TodayView.spread) — no other tile spreads.
 *
 * Deviation 2: the mockup's `<span class="fl-h">` is an <h2> here, and the
 * wrapper that now holds a heading is a <div>.
 */
export default async function Today({ view, eventForm, todoDue }: TodayProps) {
  const v = await view;
  const s = v.scheduled;
  const blocked = v.eventFormBlocked || eventForm.calendars.length === 0;

  const head = (
    <div>
      <span className="eyebrow">Today</span>
      <h2 className="fl-h">{v.dateLabel}</h2>
    </div>
  );

  const scheduled = (
    <div className="fl-group">
      <span className="pe-grp">Scheduled</span>
      {s.kind === "empty" && <p className="fl-empty">Nothing scheduled.</p> /* deck §6 Tile 1 */}
      {s.kind === "fail" &&
        s.lines.map((line, i) => (
          <Line key={line.text} line={line} id={blocked && i === 0 ? REASON_ID : undefined} />
        ))}
      {s.kind === "rows" && (
        <>
          <div className="pe-rows">
            {s.rows.map((r) => (
              <div className="pe-row is-sched" key={`${eventForm.today}:${r.calendarId}:${r.id}`}>
                <span className="pe-time">{r.time}</span>
                {r.href === "" ? (
                  <span className="pe-nm">{r.title}</span>
                ) : (
                  <a className="fl-biz" href={r.href} target="_blank" rel="noopener noreferrer">
                    <span className="pe-nm">{r.title}</span>
                    <span className="arr">↗</span>
                  </a>
                )}
                <span className="tag is-layer">{r.layerName}</span>
              </div>
            ))}
          </div>
          {s.fails.map((line) => (
            <Line key={line.text} line={line} />
          ))}
        </>
      )}
    </div>
  );

  const d = v.due;
  const due = (
    <div className="fl-group">
      <span className="pe-grp">Due</span>
      {d.kind === "empty" && <p className="fl-empty">Nothing due.</p> /* deck §6 Tile 1 */}
      {d.kind === "fail" && <Line line={d.line} />}
      {d.kind === "rows" && (
        <div className="pe-rows">
          {d.rows.map((row) => (
            <TodoRow
              key={row.id}
              shape="open"
              tile="today"
              row={row}
              tag
              edit={v.formCapable ? <TodoForm tile="today" todo={editableTodo(row, todoDue)} /> : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );

  // R16: the foot holds the bound (deck §6 Tile 1, `Showing 20 of 26.`).
  const bound = s.kind === "rows" && s.bound !== null ? <p className="fl-bound">{s.bound}</p> : null;

  return (
    <section className={heroClass(v.heroTint)}>
      <EventTile
        head={head}
        body={
          <>
            {scheduled}
            {due}
          </>
        }
        foot={bound}
        pair={v.spread}
        formCapable={v.formCapable}
        blocked={blocked}
        reasonId={blocked && s.kind === "fail" && s.lines.length > 0 ? REASON_ID : null}
        form={eventForm}
      />
    </section>
  );
}

/**
 * The Suspense fallback (§7.4): the tile at full size with border, ground and
 * eyebrow, and the date, which needs no feed — and no sentence, no count, no
 * stamp, no control. An unanswered read is not a measured emptiness.
 *
 * It carries the tint (R83): the to-do read has answered before the calendar
 * has, and an untinted hero would say it had not. The page hands it
 * buildTodayDue's tint — the same derivation buildTodayView uses.
 */
export function TodayFallback({ dateLabel, heroTint }: { dateLabel: string; heroTint: TodayView["heroTint"] }) {
  return (
    <section className={heroClass(heroTint)}>
      <TileHead tile="today">
        <div>
          <span className="eyebrow">Today</span>
          <h2 className="fl-h">{dateLabel}</h2>
        </div>
      </TileHead>
    </section>
  );
}
