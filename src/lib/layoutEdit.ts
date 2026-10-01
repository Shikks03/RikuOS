/**
 * layoutEdit.ts — the layout editor's moves, as pure functions over a
 * working copy (deck §8, visual spec §5.7, R29, R31). Client-safe: imports
 * only personalLayout.ts, the one pure module a client component reads.
 *
 * Every decision the editor's buttons make lives here and is pinned by
 * layoutEdit.test.ts: what each of the six moves does, when each one is
 * refused before the fact, and what the row caption says. The editor island
 * only renders these answers and moves focus.
 *
 *   ←  →   swap the tile with its neighbour in the row
 *   ↑  ↓   move it to the neighbouring row, at the end — refused in row 1 /
 *          row 4, or when that row has fewer free columns than the tile's span
 *   −  +   change its span by one, 2…12; `+` refused when the row sums to 12.
 *          By the twelve-column sum alone: collapseRow is not consulted (R1).
 *
 * Empty rows are legal (§4.8), and ↑ / ↓ do not prevent them.
 */

import {
  PERSONAL_LAYOUT_DEFAULT,
  clampSpan,
  formCapable,
  type PersonalLayout,
  type PersonalTile,
  type ReadonlyPersonalLayout,
} from "@/lib/personalLayout";

export type EditAction = "left" | "right" | "up" | "down" | "narrow" | "widen";

/**
 * The control a button hands focus to when its own press disables it (R31):
 * `+`→`−`, `→`→`←`, `↓`→`↑`, and back.
 */
export const EDIT_SIBLING: Readonly<Record<EditAction, EditAction>> = Object.freeze({
  left: "right",
  right: "left",
  up: "down",
  down: "up",
  narrow: "widen",
  widen: "narrow",
});

const COLS = 12;
const SPAN_MIN = 2;
const ROWS = 4;

/** A mutable copy, every span through clampSpan. */
export function copyLayout(layout: ReadonlyPersonalLayout): PersonalLayout {
  return layout.map((row) => row.map((e) => ({ tile: e.tile, span: clampSpan(e.span) })));
}

function used(row: ReadonlyArray<{ span: number }>): number {
  return row.reduce((a, e) => a + clampSpan(e.span), 0);
}

/** Where `tile` sits: its row (0-based, of four) and its index in that row. */
export function locate(layout: ReadonlyPersonalLayout, tile: PersonalTile): { row: number; index: number } | null {
  for (let row = 0; row < layout.length; row++) {
    const index = layout[row].findIndex((e) => e.tile === tile);
    if (index >= 0) return { row, index };
  }
  return null;
}

/** Whether `action` is allowed for `tile` — the disabling matrix. */
export function canEdit(layout: ReadonlyPersonalLayout, tile: PersonalTile, action: EditAction): boolean {
  const at = locate(layout, tile);
  if (at === null) return false;
  const row = layout[at.row];
  const span = clampSpan(row[at.index].span);
  switch (action) {
    case "left":
      return at.index > 0;
    case "right":
      return at.index < row.length - 1;
    case "up":
      return at.row > 0 && COLS - used(layout[at.row - 1]) >= span;
    case "down":
      return at.row < ROWS - 1 && at.row + 1 < layout.length && COLS - used(layout[at.row + 1]) >= span;
    case "narrow":
      return span > SPAN_MIN;
    case "widen":
      return used(row) < COLS;
  }
}

/** The layout after `action`, or an unchanged copy when the action is refused. */
export function applyEdit(layout: ReadonlyPersonalLayout, tile: PersonalTile, action: EditAction): PersonalLayout {
  const next = copyLayout(layout);
  if (!canEdit(layout, tile, action)) return next;
  const at = locate(next, tile)!;
  const row = next[at.row];
  switch (action) {
    case "left":
    case "right": {
      const other = action === "left" ? at.index - 1 : at.index + 1;
      [row[at.index], row[other]] = [row[other], row[at.index]];
      break;
    }
    case "up":
    case "down": {
      const [entry] = row.splice(at.index, 1);
      next[action === "up" ? at.row - 1 : at.row + 1].push(entry);
      break;
    }
    case "narrow":
      row[at.index].span -= 1;
      break;
    case "widen":
      row[at.index].span += 1;
      break;
  }
  return next;
}

/** The toolbar caption for the row `tile` sits in (deck §8): `2 columns left` · `1 column left` · `row full`. */
export function rowCaption(layout: ReadonlyPersonalLayout, tile: PersonalTile): string {
  const at = locate(layout, tile);
  const free = at === null ? 0 : Math.max(0, COLS - used(layout[at.row]));
  if (free === 0) return "row full";
  return free === 1 ? "1 column left" : `${free} columns left`;
}

/** Two layouts place every tile identically (rows, order, spans). */
export function sameLayout(a: ReadonlyPersonalLayout, b: ReadonlyPersonalLayout): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (row, r) =>
      row.length === b[r].length &&
      row.every((e, j) => e.tile === b[r][j].tile && clampSpan(e.span) === clampSpan(b[r][j].span)),
  );
}

/** The working copy already is the default: `Reset to default` has nothing to do. */
export function isDefaultLayout(layout: ReadonlyPersonalLayout): boolean {
  return sameLayout(layout, PERSONAL_LAYOUT_DEFAULT);
}

/** R40's form floor for `tile` in `layout` — the WORKING copy while editing (Task 8 step 7). */
export function formCapableAt(layout: ReadonlyPersonalLayout, tile: PersonalTile): boolean {
  const at = locate(layout, tile);
  if (at === null) return false;
  return formCapable(layout[at.row].map((e) => e.span), at.index);
}
