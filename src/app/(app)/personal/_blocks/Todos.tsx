import type { DayKey } from "@/lib/days";
import type { TodoRowView, TodoTileView } from "@/lib/personalView";
import TodoForm, { TodoTile, type EditableTodo } from "../TodoForm";
import TodoRow from "../TodoRow";

/**
 * Each open to-do's stored due day, by id — what the edit form needs to show
 * the current `Due`, since TodoRowView carries only the rendered chip. Built
 * from the same open read every tile renders; a plain object so it can cross
 * into a client island.
 */
export type TodoDueKeys = Readonly<Record<string, DayKey | null>>;

export interface TodosProps {
  view: TodoTileView;
  todoDue: TodoDueKeys;
  /** R40's form floor for this tile, from the stored row (formCapable(rowSpans, index)). */
  formCapable: boolean;
}

/**
 * What a row's edit form starts from. Shared with Today's DUE group, whose
 * rows open the same form. The due day is the stored one (todoDue), never
 * parsed back out of the chip.
 */
export function editableTodo(row: TodoRowView, todoDue: TodoDueKeys): EditableTodo {
  return {
    id: row.id,
    title: row.title,
    section: row.section,
    dueOn: todoDue[row.id] ?? null,
    onCalendar: row.onCalendar,
  };
}

/**
 * Tile 2 — To-do (deck §6 Tile 2). Rendered here on the server; TodoTile is
 * the client half that owns the `+ To-do` pill and swaps the body for the add
 * form while it is open.
 *
 * The count is `0 open` / `1 open` — tabular, never hued, and ABSENT under a
 * failed read (R21): TodoTileView makes `count: null` the only failed form, so
 * nothing here zeroes a count that was never read. Three section labels
 * always, in deck order; an empty section says `nothing open` and keeps its
 * label. Unreadable: `Couldn’t load to-dos.` once, in place of the sections.
 *
 * Rows carry the edit form only where a form can exist (R40): at a width
 * where it cannot, a row is the one-control shape (TodoRow without `edit`).
 * The section tag is off — the section label above already says it.
 */
export default function Todos({ view, todoDue, formCapable }: TodosProps) {
  const head = (
    <div>
      <span className="eyebrow">To-do</span>
      {view.count !== null && (
        // deck §6 Tile 2: `0 open` / `1 open`
        <span className="fl-count">{view.count} open</span>
      )}
    </div>
  );

  const body =
    view.sections === null ? (
      <div className="pe-fail">
        <i></i>
        <span className="said">{view.fail.text}</span>
      </div>
    ) : (
      view.sections.map((section) => (
        <div className="fl-group" key={section.key}>
          <span className="pe-grp">{section.label}</span>
          {section.rows.length === 0 ? (
            // deck §6 Tile 2: the label stays
            <p className="fl-empty">nothing open</p>
          ) : (
            <div className="pe-rows">
              {section.rows.map((row) => (
                <TodoRow
                  key={row.id}
                  shape="open"
                  tile="todos"
                  row={row}
                  tag={false}
                  edit={formCapable ? <TodoForm tile="todos" todo={editableTodo(row, todoDue)} /> : undefined}
                />
              ))}
            </div>
          )}
        </div>
      ))
    );

  // R16: the foot holds display meta — each section's `Showing 20 of 34.` (deck §6 Tile 2).
  const bounds =
    view.sections === null
      ? []
      : view.sections.flatMap((s) =>
          s.bound === null ? [] : [<p className="fl-bound" key={s.key}>{s.bound}</p>],
        );

  return (
    <section className="pe-tile">
      <TodoTile head={head} body={body} foot={bounds.length > 0 ? bounds : null} formCapable={formCapable} />
    </section>
  );
}
