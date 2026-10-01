"use client";

/**
 * LayoutEditor — island 1 of five (visual spec §7.3), and the one client
 * boundary that spans BOTH the header band and the <main>: the header carries
 * the pills and the grid carries the toolbars, so one component owns both.
 *
 * This file is the normal view (Plan C Task 1) plus the page's one shared
 * client state (Task 2). Edit mode (Task 8) arrives here and nowhere else, so
 * the seams it needs are already cut:
 *
 *   - The six tiles are SERVER components handed in as ReactNode, keyed by
 *     tile id. They render — and their <Suspense> boundaries stream — on the
 *     server; this component only places them. Moving a tile never re-fetches
 *     it (deck §8: "the editor never touches tile contents").
 *   - Every tile renders its head, body and foot through TileHead / TileBody /
 *     TileFoot below. They read this component's context, so edit mode can
 *     make the head and body `inert` (R44) and put the toolbar in the foot
 *     (R29) without touching a single block file.
 *
 * No effect hook at all (R33). The cells and the tracks are pure functions of the
 * layout, called at render: buildCells / buildTracks from personalLayout.ts,
 * the one pure module a client component imports (§7.5).
 */

import { createContext, useContext, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  buildCells,
  buildTracks,
  type PersonalTile,
  type ReadonlyPersonalLayout,
} from "@/lib/personalLayout";
import type { SayLine } from "@/lib/personalView";

/** The six rendered tiles, by tile id. Every id present: the grid places all six. */
export type TileNodes = Readonly<Record<PersonalTile, ReactNode>>;

/**
 * A to-do row's place in the hidden set: its id AND the state the row shows.
 * A to-do's open row and its Done row share an id, and un-ticking must not be
 * hidden by the tick that came before it — so a press hides the row it was
 * pressed on and un-hides the opposite state, which the server has just been
 * asked to produce.
 */
export type HiddenKey = `${"open" | "done"}:${string}`;

/**
 * THE PAGE'S ONE SHARED CLIENT STATE (Task 2, visual spec §7.3, C11).
 *
 *   hidden  the rows a press has taken off the page. Every TodoRow reads it
 *           and filters itself, so the twin of a ticked overdue to-do leaves
 *           Today and the To-do tile at the same instant. The rule (lead
 *           ruling on B1): the set GROWS on a press, SHRINKS at once on a
 *           definite failure, and otherwise the press's own server re-read
 *           ENDS the hide. Each entry is in flight until the door answers;
 *           an ok or no-answer press then settles it, and the first server
 *           render after that (a new `stamp`) drops it — so the server
 *           decides, including for a no-answer press whose write never
 *           landed. A render that lands while the press is still in flight
 *           (another island's refresh) cannot end the hide. It is a local
 *           hide, never a source of truth.
 *   presses per tile, a count of presses. Every press outcome in a tile is
 *           cleared by the next press in that tile (visual spec §4.9), so a
 *           row's own sentence remembers the press it belongs to and shows
 *           only while that press is the tile's latest.
 *   notes   per tile, the one sentence under the head (R16): a no-answer
 *           press (`.pe-said`, no dot) or R49's claim about another system
 *           (`Done, but the calendar entry couldn't be removed…`, `--stale`).
 */
interface PageState {
  editing: boolean;
  /**
   * Bumped by edit mode on entry (Task 8). A TileBody with `resetOnEdit`
   * keys itself by it, so every native <details> inside — the week's open
   * days — remounts closed (R62) without anything reaching into the DOM.
   */
  editEpoch: number;
  /** The keys hidden in this render (in flight, or settled and not yet re-read). */
  hidden: ReadonlySet<HiddenKey>;
  presses: Readonly<Record<PersonalTile, number>>;
  /** Each tile's head sentence with the tile's press number when it was said. */
  notes: Readonly<Partial<Record<PersonalTile, { line: SayLine; press: number }>>>;
  /** Registers a press in `tile` and returns the press's number (clears the tile's sentences). */
  press: (tile: PersonalTile) => number;
  /** A press began: hide `key` until its own re-read (in flight). */
  hide: (key: HiddenKey) => void;
  /** The door answered ok, or gave no answer: the next server render decides. */
  settle: (key: HiddenKey) => void;
  /** A definite failure (or the opposite state's stale hide): show it again now. */
  reveal: (key: HiddenKey) => void;
  note: (tile: PersonalTile, line: SayLine) => void;
  /**
   * The sentence under one ROW (`Couldn't save.`), by the row's hidden key and
   * with the press number it was said at. Held here, not in the row, so it
   * survives the row remounting (the week body's edit-mode reset, R62).
   */
  rowNotes: ReadonlyMap<HiddenKey, { tile: PersonalTile; press: number; text: string }>;
  sayRow: (key: HiddenKey, tile: PersonalTile, press: number, text: string) => void;
}

const NO_PRESSES: Readonly<Record<PersonalTile, number>> = Object.freeze({
  today: 0,
  todos: 0,
  layers: 0,
  push: 0,
  week: 0,
  done: 0,
});

const noop = () => {};
const PageContext = createContext<PageState>({
  editing: false,
  editEpoch: 0,
  hidden: new Set(),
  presses: NO_PRESSES,
  notes: {},
  press: () => 0,
  hide: noop,
  settle: noop,
  reveal: noop,
  note: noop,
  rowNotes: new Map(),
  sayRow: noop,
});

/** For the islands inside a tile (TodoRow; the forms and switches later). */
export function usePersonalPage(): PageState {
  return useContext(PageContext);
}

/**
 * The tile's head (`.pe-head`), and directly under it the tile's one press
 * sentence when it has one (R16: under the head, never the foot).
 * `inert` while editing (R44) — Task 8.
 */
export function TileHead({
  tile,
  inline = false,
  children,
}: {
  /** Omitted, the head carries no press sentence (a fallback, or a tile with no to-do press). */
  tile?: PersonalTile;
  inline?: boolean;
  children: ReactNode;
}) {
  const { editing, notes, presses } = useContext(PageContext);
  const said = tile === undefined ? undefined : notes[tile];
  // Cleared by the next press in the tile: shown only while its press is the latest.
  const line = said !== undefined && tile !== undefined && said.press === presses[tile] ? said.line : undefined;
  return (
    <>
      <div className={inline ? "pe-head is-inline" : "pe-head"} inert={editing || undefined}>
        {children}
      </div>
      {line !== undefined &&
        (line.dot === null ? (
          <p className="pe-said">{line.text}</p>
        ) : (
          <div className={line.dot === "missing" ? "pe-fail is-missing" : "pe-fail"}>
            <i />
            <span className="said">{line.text}</span>
          </div>
        ))}
    </>
  );
}

/**
 * The tile's body (`.pe-body`, `.is-pair` on the hero only when both groups
 * are empty — R17, decided by TodayView.spread). `inert` while editing (R44).
 */
export function TileBody({
  pair = false,
  resetOnEdit = false,
  children,
}: {
  pair?: boolean;
  /**
   * Remount this body when edit mode opens (keyed by editEpoch), so its
   * uncontrolled <details> come back closed (R62). Only a body holding no
   * typed input may ask for it — a form's text must survive the mode (R30).
   */
  resetOnEdit?: boolean;
  children: ReactNode;
}) {
  const { editing, editEpoch } = useContext(PageContext);
  return (
    <div
      key={resetOnEdit ? `epoch:${editEpoch}` : undefined}
      className={pair ? "pe-body is-pair" : "pe-body"}
      inert={editing || undefined}
    >
      {children}
    </div>
  );
}

/**
 * The tile's foot (`.pe-foot`, R16): display meta (`Showing 20 of 34.`) and,
 * in edit mode, the toolbar — nothing else. Never inert: the toolbar is the
 * one live control while editing. Renders nothing when it has nothing to hold.
 */
export function TileFoot({ children }: { tile: PersonalTile; children?: ReactNode }) {
  if (children === undefined || children === null || children === false) return null;
  return <div className="pe-foot">{children}</div>;
}

export default function LayoutEditor({
  layout,
  tiles,
  notice,
  stamp,
}: {
  /** New on every server render of the page: how a hide knows its re-read has landed. */
  stamp: string;
  /** The RESOLVED layout (resolvePersonalLayout), never the stored value. */
  layout: ReadonlyPersonalLayout;
  tiles: TileNodes;
  /** The page-level sentence above the grid (deck §15's fallen-back arrangement), or null. */
  notice: ReactNode;
}) {
  // key -> in flight? A settled entry lives until the next server render.
  const [entries, setEntries] = useState<ReadonlyMap<HiddenKey, boolean>>(() => new Map());
  // Adjusting state to a new prop during render (React's documented pattern,
  // no effect): a new stamp is a new server render, which ends every settled
  // hide. In-flight entries survive it.
  const [seenStamp, setSeenStamp] = useState(stamp);
  if (seenStamp !== stamp) {
    setSeenStamp(stamp);
    setEntries((m) => {
      if (![...m.values()].some((inFlight) => !inFlight)) return m;
      return new Map([...m].filter(([, inFlight]) => inFlight));
    });
  }
  const hidden: ReadonlySet<HiddenKey> = new Set(entries.keys());
  const [presses, setPresses] = useState(NO_PRESSES);
  // The press count's source of truth, written only inside event handlers
  // (never during render), so two presses before a re-render still number
  // apart. `presses` is its rendered copy.
  const pressCount = useRef<Record<PersonalTile, number>>({ ...NO_PRESSES });
  const [notes, setNotes] = useState<PageState["notes"]>({});
  const [rowNotes, setRowNotes] = useState<PageState["rowNotes"]>(() => new Map());

  // Every setter is a functional update, so two presses landing in one tick
  // never overwrite each other.
  const state: PageState = {
    editing: false,
    editEpoch: 0,
    hidden,
    presses,
    notes,
    press: (tile) => {
      const n = pressCount.current[tile] + 1;
      pressCount.current[tile] = n;
      setPresses({ ...pressCount.current });
      return n;
    },
    hide: (key) => setEntries((m) => (m.get(key) === true ? m : new Map(m).set(key, true))),
    settle: (key) => setEntries((m) => (m.get(key) === true ? new Map(m).set(key, false) : m)),
    reveal: (key) =>
      setEntries((m) => {
        if (!m.has(key)) return m;
        const next = new Map(m);
        next.delete(key);
        return next;
      }),
    // Stamped with the tile's current press number, so the next press there clears it.
    note: (tile, line) => setNotes((n) => ({ ...n, [tile]: { line, press: pressCount.current[tile] } })),
    rowNotes,
    sayRow: (key, tile, press, text) => setRowNotes((m) => new Map(m).set(key, { tile, press, text })),
  };

  const cells = buildCells(layout, false);
  // --tracks is set inline on .pe-grid, where --tb is declared (personal.css).
  const gridStyle = { "--tracks": buildTracks(layout, false) } as CSSProperties;

  return (
    <PageContext.Provider value={state}>
      {/* .fl-head carries the padding and .fl the column — the same .fl the
          content uses, so the band and the grid share one left edge (P8 R34).
          No ancestor of this header may take container-type (R30, R87). */}
      <div className="fl-head">
        <div className="fl">
          <div className="fl-headrow">
            <h1 className="fl-title">Personal</h1>
          </div>
        </div>
      </div>
      <main className="app-content">
        <div className="fl">
          {notice}
          <div className="pe-wrap">
            <div className="pe-grid" style={gridStyle}>
              {cells.map((cell) => (
                // Keyed by tile id (R31): a moved tile keeps its DOM node and
                // its focus. In normal view buildCells emits no leftover cell —
                // the leftover is bare ground (§4.7) — so every cell is a tile.
                <div
                  key={cell.tile ?? `gap:${cell.rowClass}`}
                  className={`pe-cell ${cell.rowClass} ${cell.spanClass} ${cell.collapsedClass}${
                    cell.tile === null ? " is-gap" : ""
                  }`}
                >
                  {cell.tile === null ? null : tiles[cell.tile]}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </PageContext.Provider>
  );
}
