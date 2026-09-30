import type { DayKey } from "@/lib/days";
import type { TodoTileView } from "@/lib/personalView";
import { TileFoot, TileHead } from "../LayoutEditor";

/**
 * Each open to-do's stored due day, by id — what the edit form (Task 3) needs
 * to show the current `Due`, since TodoRowView carries only the rendered chip.
 * Built from the same open read every tile renders; a plain object so it can
 * cross into a client island.
 */
export type TodoDueKeys = Readonly<Record<string, DayKey | null>>;

export interface TodosProps {
  view: TodoTileView;
  todoDue: TodoDueKeys;
  /** R40's form floor for this tile, from the stored row (formCapable(rowSpans, index)). */
  formCapable: boolean;
}

/**
 * Tile 2 — To-do (deck §6 Tile 2). HEAD ONLY in Task 1: eyebrow, the count,
 * and the control slot `+ To-do` fills in Task 3.
 *
 * The count is `0 open` / `1 open` — tabular, never hued, and ABSENT under a
 * failed read (R21): TodoTileView makes `count: null` the only failed form, so
 * nothing here zeroes a count that was never read.
 */
export default function Todos({ view }: TodosProps) {
  return (
    <section className="pe-tile">
      <TileHead tile="todos">
        <div>
          <span className="eyebrow">To-do</span>
          {view.count !== null && <span className="fl-count">{view.count} open</span>}
        </div>
      </TileHead>
      <TileFoot tile="todos" />
    </section>
  );
}
