"use client";

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
 * a plain span, aria-hidden. Each row says its mark in words (`saving` /
 * `couldn’t tell if that saved`), so the fade never carries meaning alone.
 *
 * The server's own empty sentence in the same group (`nothing open`,
 * `Nothing scheduled.`, `Nothing due.`, a day's `—`) is hidden by CSS while a
 * stand-in sits beside it (personal.css, `:has(.pe-standins)`).
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
      {shown.map((s) =>
        s.kind === "todo" ? (
          <TodoRowStandIn key={s.key} s={s} tag={place.tile === "today"} />
        ) : (
          <EventRowStandIn key={s.key} s={s} />
        ),
      )}
    </div>
  );
}

function Mark({ s }: { s: StandIn }) {
  return <span className="pe-on">{STAND_IN_MARK[s.mark]}</span>;
}

function TodoRowStandIn({ s, tag }: { s: TodoStandIn; tag: boolean }) {
  return (
    <div className="pe-row is-item is-standin">
      <span className="tick" aria-hidden="true" />
      <span className="pe-nm">{s.title}</span>
      {tag && <span className="tag">{SECTION_LABEL[s.section]}</span>}
      <Mark s={s} />
      {s.due !== null && <span className={s.due.late ? "pe-due is-late" : "pe-due"}>{s.due.text}</span>}
    </div>
  );
}

function EventRowStandIn({ s }: { s: EventStandIn }) {
  return (
    <div className="pe-row is-sched is-standin">
      <span className="pe-time">{standInTime(s, "row")}</span>
      <span className="pe-nm">
        {s.title} <Mark s={s} />
      </span>
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
