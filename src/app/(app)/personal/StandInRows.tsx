"use client";

import { Fragment } from "react";
import { shortLateness } from "@/lib/todos";
import {
  SECTION_LABEL,
  STAND_IN_MARK,
  standInTime,
  standInsAt,
  type EventStandIn,
  type StandIn,
  type StandInPlace,
  type TodoStandIn,
} from "@/lib/standIns";
import { usePersonalPage } from "./LayoutEditor";

/**
 * The faded rows of adds still saving (smooth-feel spec §4), placed by each
 * tile beside its own server-rendered rows, in the shapes those rows use:
 * `.pe-row.is-item` for a to-do, `.pe-row.is-sched` for a Today event,
 * `.pe-it` inside a week day.
 *
 * A STAND-IN HAS NO CONTROL (plan deviation 3): no tick button, no link —
 * it cannot be ticked, edited or followed while it saves. The tick's box is
 * a plain span, aria-hidden.
 *
 * THE MARK'S OWN LINE (F2 review W3): inside `.pe-rows` a row's mark
 * (`saving` / `couldn’t tell if that saved`) overflowed at phone width, or
 * vanished inside `.pe-nm`'s ellipsis, so it sits AFTER the row as its own
 * `.pe-said` — the register every row's own sentence already uses — never
 * inside the row. A week item has no such overflow risk (the item wraps as
 * a whole), so its mark stays inside `.pe-it`, which wraps under the title
 * at narrow widths instead (personal.css).
 *
 * The server's own empty sentence in the same group (`nothing open`,
 * `Nothing scheduled.`, `Nothing due.`) is hidden by CSS while a stand-in
 * sits beside it (personal.css, `.fl-group:has(.pe-standins)>.fl-empty.
 * is-none`) — `is-none` marks exactly those three true-empty sentences,
 * never R42's vanished-layer line, which must still show (F2 review S1).
 */
export default function StandInRows({ place }: { place: StandInPlace }) {
  const { standIns } = usePersonalPage();
  const shown = standInsAt(standIns, place);
  if (shown.length === 0) return null;
  if (place.tile === "week") {
    return (
      <span className="pe-items pe-standins">
        {shown.map((s) => (
          <WeekItem key={s.key} s={s} />
        ))}
      </span>
    );
  }
  return (
    <div className="pe-rows pe-standins">
      {shown.map((s) => (
        <Fragment key={s.key}>
          {s.kind === "todo" ? (
            <TodoRowStandIn s={s} tag={place.tile === "today"} />
          ) : (
            <EventRowStandIn s={s} />
          )}
          <p className="pe-said is-standin">{STAND_IN_MARK[s.mark]}</p>
        </Fragment>
      ))}
    </div>
  );
}

function Mark({ s }: { s: StandIn }) {
  return <span className="pe-on">{STAND_IN_MARK[s.mark]}</span>;
}

/** The due chip, as TodoRow's own `Due` renders it: both forms when late, CSS shows one by width. */
function DueChip({ due }: { due: NonNullable<TodoStandIn["due"]> }) {
  if (!due.late) return <span className="pe-due">{due.text}</span>;
  return (
    <span className="pe-due is-late">
      <span className="pe-lf">{due.text}</span>
      <span className="pe-ls">{shortLateness(due.text)}</span>
    </span>
  );
}

function TodoRowStandIn({ s, tag }: { s: TodoStandIn; tag: boolean }) {
  return (
    <div className="pe-row is-item is-standin">
      <span className="tick" aria-hidden="true" />
      <span className="pe-nm">{s.title}</span>
      {tag && <span className="tag">{SECTION_LABEL[s.section]}</span>}
      {s.due !== null && <DueChip due={s.due} />}
    </div>
  );
}

function EventRowStandIn({ s }: { s: EventStandIn }) {
  return (
    <div className="pe-row is-sched is-standin">
      <span className="pe-time">{standInTime(s, "row")}</span>
      <span className="pe-nm">{s.title}</span>
      <span className="tag is-layer">{s.calendarName}</span>
    </div>
  );
}

function WeekItem({ s }: { s: StandIn }) {
  return (
    <span className="pe-it is-standin">
      {s.kind === "event" && <span className="pe-t">{standInTime(s, "item")}</span>}
      <span>{s.title}</span>
      <span className="pe-l">· {s.kind === "event" ? s.calendarName : SECTION_LABEL[s.section]}</span>
      <Mark s={s} />
    </span>
  );
}
