import type { DayKey } from "@/lib/days";
import type { TodayView } from "@/lib/personalView";
import { TileFoot, TileHead } from "../LayoutEditor";
import type { TodoDueKeys } from "./Todos";

/**
 * What EventForm (Task 4) needs, computed on the server so no default is ever
 * the browser's zone (deck §7): the switched-on layers in stored order (the
 * first is the default calendar), and today / the next full hour / +1h in
 * APP_TZ.
 */
export interface EventFormData {
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

/**
 * Tile 1 — Today (deck §6 Tile 1). HEAD ONLY in Task 1: eyebrow, the date as
 * the tile's heading, and the control slot `+ Event` fills in Task 4. The two
 * groups arrive in Task 4.
 *
 * Deviation 2: the mockup's `<span class="fl-h">` is an <h2> here, and the
 * wrapper that now holds a heading is a <div>.
 */
export default async function Today({ view }: TodayProps) {
  const v = await view;
  return (
    <section className={heroClass(v.heroTint)}>
      <TileHead>
        <div>
          <span className="eyebrow">Today</span>
          <h2 className="fl-h">{v.dateLabel}</h2>
        </div>
      </TileHead>
      <TileFoot tile="today" />
    </section>
  );
}

/**
 * The Suspense fallback (§7.4): the tile at full size with border, ground and
 * eyebrow, and the date, which needs no feed — and no sentence, no count, no
 * stamp, no control. An unanswered read is not a measured emptiness.
 */
export function TodayFallback({ dateLabel }: { dateLabel: string }) {
  return (
    <section className="pe-tile is-hero">
      <TileHead>
        <div>
          <span className="eyebrow">Today</span>
          <h2 className="fl-h">{dateLabel}</h2>
        </div>
      </TileHead>
    </section>
  );
}
