/**
 * eventOrder.ts — the one order calendar events are shown in.
 *
 * Day first; within a day all-day before timed; timed by start; then title.
 * deck §6 Tile 1 and Tile 5 ("all-day events, timed events by start").
 * google.ts sorts readCalendarWindow's merged answer with it, and
 * personalView.ts sorts the window it is handed with it again, so a
 * hand-built or re-ordered window renders in the same order.
 *
 * Pure: no import at all. It compares the four fields it reads and nothing
 * else, so it is typed on that shape rather than on CalendarEvent.
 */

export interface EventOrderFields {
  dayKey: string;
  allDay: boolean;
  startsAt: Date | null;
  title: string;
}

export function compareEvents(a: EventOrderFields, b: EventOrderFields): number {
  if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? -1 : 1;
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  const at = a.startsAt?.getTime() ?? 0;
  const bt = b.startsAt?.getTime() ?? 0;
  if (at !== bt) return at - bt;
  return a.title.localeCompare(b.title);
}
