/**
 * The Personal page's layout store — pure, and the one module a client
 * component imports (§7.5). It may never import a model, the server
 * guard package, Next's request headers or cache, read the environment, or call the
 * network; Task 4's grep is the guarantee, so this comment avoids its words.
 *
 * A layout is exactly four rows of `{ tile, span }`, spans on the twelve-column
 * grid. Two write/read halves (R35):
 *   - `validateLayout` is STRICT on write: four rows, every tile exactly once,
 *     every span an integer 2–12, every row ≤ 12. Empty rows are legal (§4.8).
 *   - `resolvePersonalLayout` is TOTAL on read: an unreadable value becomes the
 *     default with `fellBack: true`, and a stored layout that predates a tile
 *     keeps every placement it has and gains the newcomer (the P11 clause).
 *
 * And the render half (§5.4, R3): `buildCells` turns a layout into three frozen
 * class lookups per cell, every number through one clamp; `buildTracks` emits
 * the grid's inline `--tracks`.
 */

export const PERSONAL_TILES = ["today", "todos", "layers", "push", "week", "done"] as const;

export type PersonalTile = (typeof PERSONAL_TILES)[number];
export interface LayoutEntry { tile: PersonalTile; span: number }
/** Exactly 4 rows. */
export type PersonalLayout = LayoutEntry[][];
/** The same shape, read-only at every depth: what the default is, and what the render half accepts. */
export type ReadonlyPersonalLayout = ReadonlyArray<ReadonlyArray<Readonly<LayoutEntry>>>;

export interface CellView {
  tile: PersonalTile | null;   // null = the row's leftover (the dashed cell)
  rowClass: string;            // "pe-r1".."pe-r4"
  spanClass: string;           // "pe-s2".."pe-s12" for a tile; "pe-s1".."pe-s10" for a leftover; "pe-s0" for none
  collapsedClass: string;      // "pe-x1".."pe-x6", or "pe-x0"
}

/**
 * Row weights as MINIMUMS, in px: tall · short · medium · short (R4, R39).
 *
 * Row 2 is 200, not R4's 180. R39 measured the blank Layers tile at 197.85px
 * with R15's 44px switch rows at span 3, and dropping the 44px floor to make
 * 180 true is the cheat R4 forbids — a touch target shrunk to hit a number.
 * R92 then measured it at 191.85px (M2 moved the container to the cell, which
 * brought `.pe-tile{padding:12px}` alive at span 3 and took 6px out) and the
 * weight still stands at 200: it was never the tile's height, it is the
 * number that keeps "short" short while clearing the switch rows.
 */
export const PERSONAL_ROWS: readonly [340, 200, 240, 120] = [340, 200, 240, 120];

/**
 * Frozen at all three depths (the array, each row, each entry): it lives for
 * the life of the process, so a caller that mutated it would rewrite every
 * later caller's default. Everything that hands a layout OUT returns a
 * mutable copy instead (`resolvePersonalLayout`, `validateLayout`).
 */
export const PERSONAL_LAYOUT_DEFAULT: ReadonlyPersonalLayout = freezeLayout([
  [{ tile: "today", span: 8 }, { tile: "todos", span: 4 }],
  [{ tile: "layers", span: 3 }, { tile: "push",  span: 8 }],
  [{ tile: "week",  span: 12 }],
  [{ tile: "done",  span: 12 }],
]);

function freezeLayout(layout: PersonalLayout): ReadonlyPersonalLayout {
  return Object.freeze(layout.map((row) => Object.freeze(row.map((e) => Object.freeze(e)))));
}

const ROW_COUNT = 4;
const COLS = 12;
const COLS_COLLAPSED = 6;
const SPAN_MIN = 2;
const SPAN_MAX = 12;

/* Frozen class tables (R3). Every class the grid can carry comes out of one of
   these, never out of string concatenation, so nothing the tables lack can
   reach the DOM. Index = the number; index 0 means "no leftover at this
   count", and pe-s1 exists only for a leftover (the default's row 2). */
const ROW_CLASS = Object.freeze(["pe-r1", "pe-r2", "pe-r3", "pe-r4"] as const);
const SPAN_CLASS = Object.freeze([
  "pe-s0", "pe-s1", "pe-s2", "pe-s3", "pe-s4", "pe-s5", "pe-s6",
  "pe-s7", "pe-s8", "pe-s9", "pe-s10", "pe-s11", "pe-s12",
] as const);
const COLLAPSED_CLASS = Object.freeze(["pe-x0", "pe-x1", "pe-x2", "pe-x3", "pe-x4", "pe-x5", "pe-x6"] as const);

function isSpan(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= SPAN_MIN && n <= SPAN_MAX;
}

/** An integer 2..12 passes through; anything else becomes 2, the narrowest legal span. */
export function clampSpan(n: unknown): number {
  return isSpan(n) ? n : SPAN_MIN;
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * The six-column rule (R1): round every span up, then decrement the widest
 * entry (ties at the LAST index) until the row sums to ≤ 6. Not `ceil` alone —
 * a row overflows six whenever Σsᵢ + #odd > 12, which non-full rows satisfy
 * too (`[3,3,5]` is 11 of 12 and ceils to 7). Not round-down (makes span 3 equal
 * span 2) and not `max(2, ceil)` (overflows the legal six-span-2 row).
 * Render-time, one caller; the editor does not import it.
 */
export function collapseRow(spans: readonly number[]): number[] {
  const out = spans.map((s) => Math.ceil(s / 2));
  let sum = out.reduce((a, b) => a + b, 0);
  while (sum > COLS_COLLAPSED) {
    let widest = 0;
    for (let i = 1; i < out.length; i++) if (out[i] >= out[widest]) widest = i;
    if (out[widest] <= 1) break; // cannot trim below one column; unreachable for ≤ 6 tiles
    out[widest] -= 1;
    sum -= 1;
  }
  return out;
}

/** Drops empty rows, keeping the order of the rest. */
export function compactRows(layout: PersonalLayout): PersonalLayout {
  return layout.filter((row) => row.length > 0);
}

/** The non-empty rows (at most four) with the index each had before compaction. */
type ReadonlyRow = ReadonlyArray<Readonly<LayoutEntry>>;

function liveRows(layout: ReadonlyPersonalLayout): Array<{ weightIndex: number; row: ReadonlyRow }> {
  const out: Array<{ weightIndex: number; row: ReadonlyRow }> = [];
  layout.slice(0, ROW_COUNT).forEach((row, i) => {
    if (row.length > 0) out.push({ weightIndex: i, row });
  });
  return out;
}

/**
 * Three frozen class lookups per cell (§5.4, R3), every number through
 * `clampSpan` first. Rows are compacted and renumbered. A row's leftover is a
 * cell with `tile: null`, emitted only when `editing` — in normal view the
 * leftover is bare ground and renders nothing (§4.7) — and only when it exists
 * at one of the two counts; `pe-s0` / `pe-x0` say "none at this count".
 */
export function buildCells(layout: ReadonlyPersonalLayout, editing: boolean): CellView[] {
  const cells: CellView[] = [];
  liveRows(layout).forEach(({ row }, r) => {
    const rowClass = ROW_CLASS[r];
    const spans = row.map((e) => clampSpan(e.span));
    const collapsed = collapseRow(spans);
    row.forEach((e, j) => {
      cells.push({
        tile: e.tile,
        rowClass,
        spanClass: SPAN_CLASS[spans[j]],
        collapsedClass: COLLAPSED_CLASS[clampInt(collapsed[j], 1, COLS_COLLAPSED)],
      });
    });
    if (!editing) return;
    const left12 = clampInt(COLS - spans.reduce((a, b) => a + b, 0), 0, COLS - SPAN_MIN);
    const left6 = clampInt(COLS_COLLAPSED - collapsed.reduce((a, b) => a + b, 0), 0, COLS_COLLAPSED - 1);
    if (left12 === 0 && left6 === 0) return;
    cells.push({ tile: null, rowClass, spanClass: SPAN_CLASS[left12], collapsedClass: COLLAPSED_CLASS[left6] });
  });
  return cells;
}

/**
 * The grid's inline `--tracks` (§5.4): empty rows compacted out, each survivor
 * keeping its own row's weight. A row takes `auto` only when its ONE occupant
 * is narrower than the row (R53, narrowed by R91 — two tiles summing to 5 keep
 * the weight), and never while editing (R5's surviving suspension). `--tb` is
 * folded in by `.pe-grid.is-editing`, not here.
 */
export function buildTracks(layout: ReadonlyPersonalLayout, editing: boolean): string {
  return liveRows(layout)
    .map(({ weightIndex, row }) => {
      const shrinks = !editing && row.length === 1 && clampSpan(row[0].span) < COLS;
      return shrinks ? "auto" : `minmax(calc(${PERSONAL_ROWS[weightIndex]}px + var(--tb)), auto)`;
    })
    .join(" ");
}

/**
 * R40's 213px form floor as one predicate over the stored row. `disabled` is
 * an attribute no container query can set and R33 forbids measuring, so the
 * server decides from spans, at the NARROWEST grid each column count allows.
 *
 * Lead ruling, correcting the plan's Task 4 derivation (`span >= 3`, which
 * used 920px widths): twelve columns begin at an 820px grid, where a column
 * is (820 − 11×14) / 12 = 55.5px, so span 3 is 194.5px (under) and span 4 is
 * 264px (over). Six columns begin at 706px, a column (706 − 5×14) / 6 = 106px:
 * one collapsed column is 106px (under), two are 226px (over). And the trim
 * (R1) can take a tile to one column at six even at span 3 or 4 — `[3,3,4,2]`
 * collapses to `[2,2,1,1]` — so the tile's COLLAPSED span decides too, which
 * is why this takes the row. At one column every tile is the full width and a
 * form would have fitted — the safe mistake the mockup's caption blesses.
 */
export function formCapable(rowSpans: readonly number[], index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= rowSpans.length) return false;
  const spans = rowSpans.map((s) => clampSpan(s));
  return spans[index] >= 4 && collapseRow(spans)[index] >= 2;
}

// ---- validate (strict on write) and resolve (total on read) ---------------

export type LayoutValidation = { ok: true; value: PersonalLayout } | { ok: false; error: string };

type Entry<T extends string> = { tile: T; span: number };
type Parsed<T extends string> = { ok: true; value: Entry<T>[][] } | { ok: false; error: string };

/**
 * The structural checks both halves share. With `requireAll`, a tile absent
 * from the layout is an error; without it (the read path), it is left for the
 * caller to place.
 */
function parseLayout<T extends string>(input: unknown, tiles: readonly T[], requireAll: boolean): Parsed<T> {
  if (!Array.isArray(input) || input.length !== ROW_COUNT) {
    return { ok: false, error: `A layout has exactly ${ROW_COUNT} rows.` };
  }
  const known = new Set<string>(tiles);
  const seen = new Set<string>();
  const rows: Entry<T>[][] = [];
  for (let r = 0; r < ROW_COUNT; r++) {
    const row: unknown = input[r];
    if (!Array.isArray(row)) return { ok: false, error: `Row ${r + 1} must be a list of tiles.` };
    const out: Entry<T>[] = [];
    let sum = 0;
    for (const e of row as unknown[]) {
      const tile = typeof e === "object" && e !== null ? (e as { tile?: unknown }).tile : undefined;
      if (typeof tile !== "string" || !known.has(tile)) {
        return { ok: false, error: `Row ${r + 1} holds an unknown tile.` };
      }
      if (seen.has(tile)) return { ok: false, error: `Tile "${tile}" appears more than once.` };
      seen.add(tile);
      const span = (e as { span?: unknown }).span;
      if (!isSpan(span)) {
        return { ok: false, error: `Tile "${tile}" must span a whole number of columns from 2 to 12.` };
      }
      sum += span;
      out.push({ tile: tile as T, span });
    }
    if (sum > COLS) return { ok: false, error: `Row ${r + 1} is wider than ${COLS} columns.` };
    rows.push(out);
  }
  if (requireAll) {
    const missing = tiles.find((t) => !seen.has(t));
    if (missing !== undefined) return { ok: false, error: `Tile "${missing}" is missing from the layout.` };
  }
  return { ok: true, value: rows };
}

/** Strict on write; anything it rejects is a 400 with this message. Returns a clean copy. */
export function validateLayout(input: unknown): LayoutValidation {
  return parseLayout(input, PERSONAL_TILES, true);
}

function copyLayout<T extends string>(layout: ReadonlyArray<ReadonlyArray<Entry<T>>>): Entry<T>[][] {
  return layout.map((row) => row.map((e) => ({ tile: e.tile, span: e.span })));
}

/**
 * `resolvePersonalLayout` against any tile set — exported so the P11 clause
 * can be asserted before a seventh tile exists (§7.5).
 *
 * A stored layout that passes every structural check but lacks a tile keeps
 * all its placements; each newcomer goes, at its default span, into the first
 * row with room scanning from its default row onward and wrapping; failing
 * that, into the first row with at least two columns free, at as much of its
 * default span as fits. Only if no row has two columns free does the whole
 * default replace the stored layout (`fellBack: true`).
 */
export function resolveLayoutAgainst<T extends string>(
  stored: unknown,
  tiles: readonly T[],
  fallback: ReadonlyArray<ReadonlyArray<Entry<T>>>,
): { layout: Entry<T>[][]; fellBack: boolean } {
  const fell = { layout: copyLayout(fallback), fellBack: true };
  const parsed = parseLayout(stored, tiles, false);
  if (!parsed.ok) return fell;
  const layout = parsed.value;
  const placed = new Set<string>(layout.flat().map((e) => e.tile));
  const free = (r: number) => COLS - layout[r].reduce((a, e) => a + e.span, 0);

  for (const tile of tiles) {
    if (placed.has(tile)) continue;
    const home = fallback.findIndex((row) => row.some((e) => e.tile === tile));
    if (home < 0) return fell;
    const want = fallback[home].find((e) => e.tile === tile)!.span;
    const order = Array.from({ length: ROW_COUNT }, (_, k) => (home + k) % ROW_COUNT);
    let row = order.find((r) => free(r) >= want);
    let span = want;
    if (row === undefined) {
      row = order.find((r) => free(r) >= SPAN_MIN);
      if (row === undefined) return fell;
      span = Math.min(want, free(row));
    }
    layout[row].push({ tile, span });
    placed.add(tile);
  }
  return { layout, fellBack: false };
}

/** Total. `fellBack` drives deck 15's `Couldn't load your arrangement, so this is the default.` */
export function resolvePersonalLayout(stored: unknown): { layout: PersonalLayout; fellBack: boolean } {
  return resolveLayoutAgainst(stored, PERSONAL_TILES, PERSONAL_LAYOUT_DEFAULT);
}
