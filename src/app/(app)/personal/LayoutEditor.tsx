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

import {
  createContext,
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { PRESS_TIMEOUT_MS } from "@/lib/constants";
import {
  EDIT_SIBLING,
  applyEdit,
  canEdit,
  copyLayout,
  formCapableAt,
  isDefaultLayout,
  locate,
  rowCaption,
  sameLayout,
  type EditAction,
} from "@/lib/layoutEdit";
import {
  PERSONAL_LAYOUT_DEFAULT,
  buildCells,
  buildTracks,
  type PersonalLayout,
  type PersonalTile,
  type ReadonlyPersonalLayout,
} from "@/lib/personalLayout";
import type { SayLine } from "@/lib/personalView";
import { pressOutcome } from "@/lib/pressOutcome";
import type { TodoDraft } from "./TodoForm";

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
   * The sentence under one ROW (`Couldn’t save.`) — the pressed row only,
   * keyed by its tile and hidden key, never its twin in another tile. Held
   * here, not in the row, so it survives the row remounting (the week body's
   * edit-mode reset, R62). Stamped with the tile's press count at the moment
   * it is said, so only a press made AFTER it clears it.
   */
  sayRow: (tile: PersonalTile, key: HiddenKey, text: string) => void;
  /** The row's sentence, or null once a later press in its tile cleared it. */
  rowNote: (tile: PersonalTile, key: HiddenKey) => string | null;
  /**
   * R40's form floor from the arrangement on screen when it is not yet the
   * server's — the WORKING copy while editing (Task 8 step 7), a just-saved
   * layout until its re-read lands — so a pill's disabled state agrees with
   * what is drawn; null otherwise, where the server's stored-row answer stands.
   */
  formCapableNow: (tile: PersonalTile) => boolean | null;
  /**
   * Every open row's edit-form draft, by to-do id — ONE store for the page,
   * so a to-do's twins (its row in Today's DUE group and in the To-do tile)
   * share one draft: what was typed, the press in flight, a parked refusal
   * (TodoForm). Held here so it outlives any row or tile remount.
   */
  todoDrafts: ReadonlyMap<string, TodoDraft>;
  /** Functional update of one draft, starting from `init` when there is none. */
  updateTodoDraft: (id: string, init: TodoDraft, fn: (d: TodoDraft) => TodoDraft) => void;
  forgetTodoDraft: (id: string) => void;
  /** The editor's working copy and its one move, while editing; null otherwise. */
  editor: Editor | null;
}

interface Editor {
  working: ReadonlyPersonalLayout;
  busy: boolean;
  act: (tile: PersonalTile, action: EditAction) => void;
  /** A callback ref for one toolbar button, so focus can move inside a handler (R31). */
  bind: (key: string) => (el: HTMLButtonElement | null) => void;
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
  sayRow: noop,
  rowNote: () => null,
  formCapableNow: () => null,
  todoDrafts: new Map(),
  updateTodoDraft: noop,
  forgetTodoDraft: noop,
  editor: null,
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
export function TileFoot({ tile, children }: { tile: PersonalTile; children?: ReactNode }) {
  const { editor } = useContext(PageContext);
  const empty = children === undefined || children === null || children === false;
  if (empty && editor === null) return null;
  return (
    <div className="pe-foot">
      {children}
      {editor !== null && <EditBar tile={tile} editor={editor} />}
    </div>
  );
}

/** The tile's name in the toolbar's accessible names (`Move Today left`, `Widen Today`). */
const TILE_NAME: Readonly<Record<PersonalTile, string>> = Object.freeze({
  today: "Today",
  todos: "To-do",
  layers: "Layers",
  push: "This morning’s push",
  week: "Next 7 days",
  done: "Done this week",
});

/**
 * The toolbar (R29, §5.7), in the order the shipped CSS expects: four arrows
 * in a 108px group, the stepper, then the row caption on its own line. The
 * glyphs are literal characters in the mono face (U+2190–2193 have no emoji
 * presentation, R26; − is U+2212). The stepper shows the TWELVE-column span
 * even at six (R1). Every refusal is `disabled` before the fact (deck §8).
 */
function EditBar({ tile, editor }: { tile: PersonalTile; editor: Editor }) {
  const name = TILE_NAME[tile];
  const at = locate(editor.working, tile);
  const span = at === null ? 0 : editor.working[at.row][at.index].span;
  const button = (action: EditAction, glyph: string, label: string) => (
    <button
      type="button"
      className="sq"
      ref={editor.bind(`${tile}:${action}`)}
      disabled={editor.busy || !canEdit(editor.working, tile, action)}
      aria-label={label}
      onClick={() => editor.act(tile, action)}
    >
      {glyph}
    </button>
  );
  return (
    <div className="pe-bar">
      <div className="pe-arrows">
        {button("left", "←", `Move ${name} left`)}
        {button("right", "→", `Move ${name} right`)}
        {button("up", "↑", `Move ${name} up`)}
        {button("down", "↓", `Move ${name} down`)}
      </div>
      <div className="pe-step">
        {button("narrow", "−", `Narrow ${name}`)}
        <span className="ct">{span}</span>
        {button("widen", "+", `Widen ${name}`)}
      </div>
      <span className="pe-cap" aria-live="polite">
        {rowCaption(editor.working, tile)}
      </span>
    </div>
  );
}

/** The editor's actions, in the order focus looks for a live one. */
const ACTIONS: readonly EditAction[] = ["left", "right", "up", "down", "narrow", "widen"];

/** deck §8 / §15: a definite failure of the layout's save. */
const LAYOUT_SAVE_FAILED = "Couldn’t save the layout.";

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
  const router = useRouter();

  // ---- edit mode (Task 8) ------------------------------------------------
  //
  // THE WORKING COPY is seeded from the arrangement on screen ON ENTRY ONLY,
  // and nothing else ever writes it but the editor's own buttons and Reset.
  // Every server render hands this component a new `layout` object (and a new
  // stamp); neither is read while editing, so no refresh can wipe a working
  // copy mid-edit.
  const [working, setWorking] = useState<PersonalLayout | null>(null);
  /** The arrangement at entry: `Save` is live only once the working copy differs from it. */
  const [seed, setSeed] = useState<PersonalLayout | null>(null);
  /** Bumped on entry: closes the add forms and the row forms (drafts kept) and the open days (R62). */
  const [editEpoch, setEditEpoch] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveSaid, setSaveSaid] = useState<string | null>(null);
  /**
   * A saved arrangement shown from the moment Save answers until the page's
   * own re-read lands (a new stamp), so the grid never flicks back to the
   * old server layout in between.
   */
  const [saved, setSaved] = useState<{ layout: PersonalLayout; stamp: string } | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const toolButtons = useRef(new Map<string, HTMLButtonElement>());
  const editing = working !== null;

  // key -> in flight? A settled entry lives until the next server render.
  const [entries, setEntries] = useState<ReadonlyMap<HiddenKey, boolean>>(() => new Map());
  // Adjusting state to a new prop during render (React's documented pattern,
  // no effect): a new stamp is a new server render. It ends every settled
  // hide (in-flight entries survive it) and retires a just-saved layout,
  // which the server now renders itself.
  const [seenStamp, setSeenStamp] = useState(stamp);
  if (seenStamp !== stamp) {
    setSeenStamp(stamp);
    setEntries((m) => {
      if (![...m.values()].some((inFlight) => !inFlight)) return m;
      return new Map([...m].filter(([, inFlight]) => inFlight));
    });
    if (saved !== null && saved.stamp !== stamp) setSaved(null);
  }
  const hidden: ReadonlySet<HiddenKey> = new Set(entries.keys());
  const [presses, setPresses] = useState(NO_PRESSES);
  // The press count's source of truth, written only inside event handlers
  // (never during render), so two presses before a re-render still number
  // apart. `presses` is its rendered copy.
  const pressCount = useRef<Record<PersonalTile, number>>({ ...NO_PRESSES });
  const [notes, setNotes] = useState<PageState["notes"]>({});
  const [rowNotes, setRowNotes] = useState<ReadonlyMap<string, { press: number; text: string }>>(() => new Map());
  const [todoDrafts, setTodoDrafts] = useState<ReadonlyMap<string, TodoDraft>>(() => new Map());

  const shown: ReadonlyPersonalLayout = working ?? saved?.layout ?? layout;
  const changed = working !== null && seed !== null && !sameLayout(working, seed);

  /** The first live toolbar button of `tile`, preferring `first`. */
  function focusTool(tile: PersonalTile, first?: EditAction) {
    const order = first === undefined ? ACTIONS : [first, ...ACTIONS.filter((a) => a !== first)];
    for (const a of order) {
      const b = toolButtons.current.get(`${tile}:${a}`);
      if (b !== undefined && !b.disabled) {
        b.focus();
        return;
      }
    }
  }

  function enter() {
    const base = copyLayout(shown);
    flushSync(() => {
      setWorking(base);
      setSeed(base);
      setEditEpoch((e) => e + 1);
      setSaveSaid(null);
    });
    // R31: focus to the first tile's toolbar — its `←` when live; at a row's
    // start `←` is disabled and cannot hold focus, so its first live button.
    const first = buildCells(base, true).find((c) => c.tile !== null)?.tile;
    if (first !== undefined && first !== null) focusTool(first, "left");
  }

  function leave() {
    flushSync(() => {
      setWorking(null);
      setSeed(null);
      setSaveSaid(null);
    });
    editButton.current?.focus();
  }

  function act(tile: PersonalTile, action: EditAction) {
    if (working === null || saving) return;
    const next = applyEdit(working, tile, action);
    flushSync(() => {
      setWorking(next);
      setSaveSaid(null);
    });
    // A button that disabled itself hands focus to its sibling (R31); the
    // moved tile kept its DOM node because cells are keyed by tile id.
    const pressed = toolButtons.current.get(`${tile}:${action}`);
    if (pressed === undefined || pressed.disabled) focusTool(tile, EDIT_SIBLING[action]);
  }

  function reset() {
    if (saving) return;
    flushSync(() => {
      setWorking(copyLayout(PERSONAL_LAYOUT_DEFAULT));
      setSaveSaid(null);
    });
    // Reset disables itself (the copy now IS the default): focus to Cancel.
    cancelButton.current?.focus();
  }

  async function save() {
    if (working === null || saving || !changed) return;
    const sent = working;
    setSaving(true);
    setSaveSaid(null);
    const out = await pressOutcome(
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalLayout: sent }),
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }),
    );
    if (out.kind === "ok") {
      flushSync(() => {
        setSaving(false);
        setSaved({ layout: sent, stamp: seenStamp });
        setWorking(null);
        setSeed(null);
      });
      editButton.current?.focus();
      router.refresh();
      return;
    }
    // The mode stays open with the changes intact either way (deck §8). A
    // definite failure says so. No answer may have landed — and the PATCH
    // writes the whole arrangement, so pressing Save again is safe — so it
    // says only that it cannot tell, and never claims the save failed.
    setSaving(false);
    setSaveSaid(out.kind === "failed" ? LAYOUT_SAVE_FAILED : out.sentence);
  }

  /** `Escape` anywhere in the mode is `Cancel` (R31). */
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" && editing && !saving) {
      e.preventDefault();
      leave();
    }
  }

  // Every setter is a functional update, so two presses landing in one tick
  // never overwrite each other.
  const state: PageState = {
    editing,
    editEpoch,
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
    note: (tile, line) => {
      const press = pressCount.current[tile]; // read now, not when the updater runs
      setNotes((n) => ({ ...n, [tile]: { line, press } }));
    },
    sayRow: (tile, key, text) => {
      const press = pressCount.current[tile];
      setRowNotes((m) => new Map(m).set(`${tile}|${key}`, { press, text }));
    },
    rowNote: (tile, key) => {
      const said = rowNotes.get(`${tile}|${key}`);
      return said !== undefined && said.press === presses[tile] ? said.text : null;
    },
    // The arrangement on screen when it is not the server's: the working copy
    // while editing, and a just-saved layout until its re-read lands.
    formCapableNow: (tile) => {
      const onScreen = working ?? saved?.layout;
      return onScreen === undefined ? null : formCapableAt(onScreen, tile);
    },
    todoDrafts,
    updateTodoDraft: (id, init, fn) =>
      setTodoDrafts((all) => {
        const next = new Map(all);
        next.set(id, fn(all.get(id) ?? init));
        return next;
      }),
    forgetTodoDraft: (id) =>
      setTodoDrafts((all) => {
        if (!all.has(id)) return all;
        const next = new Map(all);
        next.delete(id);
        return next;
      }),
    editor:
      working === null
        ? null
        : {
            working,
            busy: saving,
            act,
            bind: (key) => (el) => {
              if (el === null) toolButtons.current.delete(key);
              else toolButtons.current.set(key, el);
            },
          },
  };

  // Edit mode: leftover cells drawn (dashed), sparse-row `auto` suspended (R5).
  const cells = buildCells(shown, editing);
  // --tracks is set inline on .pe-grid, where --tb is declared (personal.css).
  const gridStyle = { "--tracks": buildTracks(shown, editing) } as CSSProperties;

  const headRow = (
    <div className="fl-headrow">
      <h1 className="fl-title">Personal</h1>
      {working !== null ? (
        // R30: Reset to default · gap · Cancel · Save. Save is the high rung.
        <div className="pe-pills">
          {saveSaid !== null && <span className="pe-said">{saveSaid}</span>}
          <button type="button" className="btn" disabled={saving || isDefaultLayout(working)} onClick={reset}>
            Reset to default
          </button>
          <button type="button" ref={cancelButton} className="btn pe-sep" disabled={saving} onClick={leave}>
            Cancel
          </button>
          {/* L9: the focused Save goes busy through aria-disabled, so focus stays on it. */}
          <button
            type="button"
            className="btn hi"
            disabled={!changed && !saving}
            aria-disabled={saving || undefined}
            onClick={save}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      ) : (
        <button type="button" ref={editButton} className="btn" onClick={enter}>
          Edit layout
        </button>
      )}
    </div>
  );

  return (
    <PageContext.Provider value={state}>
      {/* .fl-head carries the padding and .fl the column — the same .fl the
          content uses, so the band and the grid share one left edge (P8 R34).
          No ancestor of this header may take container-type (R30, R87).

          The control row is sticky in edit mode only. DEVIATION from the
          mockup, which puts .pe-sticky INSIDE .fl-head > .fl: a sticky box
          can only travel within its parent, and .fl there is exactly the
          row's own height, so it never sticks (measured: scrolled 452px,
          the row went to -370px). Wrapping the whole band instead makes the
          page column its range. Same class, same rule; the band's padding
          is void ground under it either way, and the -10px margin still
          gives the clearance back, so title→grid does not move. */}
      {editing ? (
        <div className="pe-sticky">
          <div className="fl-head" onKeyDown={onKeyDown}>
            <div className="fl">{headRow}</div>
          </div>
        </div>
      ) : (
        <div className="fl-head">
          <div className="fl">{headRow}</div>
        </div>
      )}
      <main className="app-content">
        <div className="fl">
          {notice}
          {/* The well (.pe-edit) wraps .pe-wrap and is ALWAYS this one element,
              classless in normal view, so entering the mode never remounts the
              grid — the tiles, their islands and their typed drafts survive. */}
          <div className={editing ? "pe-edit" : undefined} onKeyDown={onKeyDown}>
            <div className="pe-wrap">
              <div className={editing ? "pe-grid is-editing" : "pe-grid"} style={gridStyle}>
                {cells.map((cell) =>
                  cell.tile === null ? (
                    // The row's leftover, edit mode only: dashed, empty, never
                    // focusable, never a drop target (§4.7).
                    <div
                      key={`gap:${cell.rowClass}`}
                      className={`pe-cell is-gap ${cell.rowClass} ${cell.spanClass} ${cell.collapsedClass}`}
                    >
                      <div className="pe-gap"></div>
                    </div>
                  ) : (
                    // Keyed by tile id (R31): a moved tile keeps its DOM node and its focus.
                    <div
                      key={cell.tile}
                      className={`pe-cell ${cell.rowClass} ${cell.spanClass} ${cell.collapsedClass}`}
                    >
                      {tiles[cell.tile]}
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </PageContext.Provider>
  );
}
