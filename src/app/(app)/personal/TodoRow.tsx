"use client";

/**
 * TodoRow — island 2 of five: one component serves the four tiles that show a
 * to-do (Today's DUE group, the To-do tile, Next 7 days, Done this week).
 *
 * A to-do row is TWO controls (R13): the tick, and — where the tile hands in
 * an edit form — one button wrapping title and meta that opens it in place.
 * No chevron, no hover lift, and that button is never given CSS's `contents`
 * display (several browsers drop such a button from the accessibility tree).
 * Accessible names are never visible text: `Done “…”`, `Undo “…”`, `Edit “…”`
 * (curly quotes, as the delete confirmation’s `Delete “…”?`).
 *
 * THE PRESS (§7.3, R21, L7). The row leaves at once — no busy state on a tick —
 * by joining the page's hidden set, which every twin reads (C11). Before it
 * leaves, focus moves to a neighbour that stays (S1): the next tick in the
 * tile, else the previous, else the tile itself — never to <body>. The hide
 * lasts until the press's own server re-read, which decides (LayoutEditor). The door is
 * PATCH /api/todos/:id `{ done }`: idempotent, so an already-done tick is not
 * an error. Its answer is classified by pressOutcome and nothing else:
 *   ok       router.refresh(); the server decides what comes back. A tick whose
 *            calendar entry could not be removed says R49's sentence, with the
 *            `--stale` dot, under Done this week's head — where the row lands
 *            carrying `entry left on Google`.
 *   failed   the hide is undone (the set shrinks by one), `Couldn't save.`
 *            sits under the row, and the page re-reads. Nothing is restored
 *            locally beyond the hide (R21).
 *   unknown  `Couldn't tell if that saved.` sits under the tile's head, no
 *            dot, and the page re-reads: the row stays hidden until that
 *            render, and then shows exactly if the write did not land.
 * Every sentence is cleared by the next press in the same tile.
 *
 * No effect hook (R33): focus moves only inside handlers.
 */

import { useId, useRef, useState, createContext, useContext, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { PRESS_TIMEOUT_MS } from "@/lib/constants";
import { shortLateness } from "@/lib/todos";
import { ENTRY_LEFT_SENTENCE } from "@/lib/personalErrors";
import { pressOutcome } from "@/lib/pressOutcome";
import type { PersonalTile } from "@/lib/personalLayout";
import type { DoneTileView, TodoRowView } from "@/lib/personalView";
import { usePersonalPage, type HiddenKey } from "./LayoutEditor";


/** The 8px check, in a 10-unit viewBox so strokeWidth 1.8 renders at 1.44px (R25). */
function Check() {
  return (
    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 5.3l2 2L8 2.7" />
    </svg>
  );
}

/**
 * The due meta. Lateness renders BOTH of R96's forms and CSS shows one by the
 * tile's width (L1): `3 days late` from 240px of tile up, `3d late` below
 * (todos.ts's shortLateness, a rendering of dueChip's own sentence). The
 * hidden form is display:none, so a description read from this element reads
 * only the one on screen.
 */
function Due({ due, id }: { due: NonNullable<TodoRowView["due"]>; id?: string }) {
  if (!due.late) return <span className="pe-due" id={id}>{due.text}</span>;
  return (
    <span className="pe-due is-late" id={id}>
      <span className="pe-lf">{due.text}</span>
      <span className="pe-ls">{shortLateness(due.text)}</span>
    </span>
  );
}

/**
 * S1: the pressed tick is about to unmount; hand focus to a tick that stays —
 * the next one in the tile, else the previous — or to the tile itself, so it
 * never falls to <body>. Only when the tick holds focus (a mouse press in
 * Safari does not focus a button, and must not start moving focus). Runs in
 * the handler, before the hide: no effect.
 */
function keepFocus(from: HTMLElement) {
  if (document.activeElement !== from) return;
  const tile = from.closest<HTMLElement>(".pe-tile");
  if (tile === null) return;
  // A tick inside a closed day (<details>) cannot take focus: skip it.
  const ticks = Array.from(tile.querySelectorAll<HTMLElement>(".tick")).filter(
    (t) => t === from || t.closest("details:not([open]) .fl-open") === null,
  );
  const i = ticks.indexOf(from);
  const next = ticks[i + 1] ?? ticks[i - 1];
  if (next !== undefined) {
    next.focus();
    return;
  }
  // The tile is focusable only programmatically; out of the tab order.
  if (!tile.hasAttribute("tabindex")) tile.setAttribute("tabindex", "-1");
  tile.focus();
}

/** The door's success body says the calendar leg did not finish (failed or unknown). */
function entryLeftBehind(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const { done, calendar } = body as { done?: unknown; calendar?: { kind?: unknown } | null };
  const kind = calendar?.kind;
  return done === true && (kind === "failed" || kind === "unknown");
}

/** One press on one tick, and everything it says. Shared by the three row shapes. */
function usePress(tile: PersonalTile, id: string, checked: boolean) {
  const router = useRouter();
  const page = usePersonalPage();
  const key: HiddenKey = `${checked ? "done" : "open"}:${id}`;
  const opposite: HiddenKey = `${checked ? "open" : "done"}:${id}`;

  async function toggle(e: MouseEvent<HTMLButtonElement>) {
    keepFocus(e.currentTarget);
    page.press(tile);
    page.hide(key);
    page.reveal(opposite);
    const out = await pressOutcome(
      fetch(`/api/todos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !checked }),
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }),
    );
    if (out.kind === "ok") {
      page.settle(key);
      if (entryLeftBehind(out.body)) page.note("done", { text: ENTRY_LEFT_SENTENCE, dot: "stale" });
    } else if (out.kind === "failed") {
      page.reveal(key);
      page.sayRow(tile, key, out.sentence);
    } else {
      page.settle(key);
      page.note(tile, { text: out.sentence, dot: null });
    }
    router.refresh();
  }

  const hidden = page.hidden.has(key);
  // The row's own sentence, from the page context (it survives a remount);
  // cleared by the next press in the tile it was said in.
  const sentence = page.rowNote(tile, key);
  return { toggle, hidden, sentence };
}

// ---- the edit seam ----------------------------------------------------------

const RowEdit = createContext<{ close: () => void } | null>(null);

/**
 * For the edit form a tile hands a row (TodoForm, Task 3): `close()` puts the
 * row back and returns focus to its `Edit "…"` button.
 */
export function useRowEdit(): { close: () => void } | null {
  return useContext(RowEdit);
}

// ---- the three shapes ---------------------------------------------------------

export type TodoRowProps =
  /**
   * An open row, in Today's DUE group or the To-do tile. With `edit`, the
   * second control opens it in place (`.pe-row.is-todo`); without, the row is
   * the one-control shape (`.pe-row.is-item`). `tag` shows the section — Today
   * shows it; the To-do tile's section label already says it.
   */
  | { shape: "open"; tile: "today" | "todos"; row: TodoRowView; tag: boolean; edit?: ReactNode }
  /** A to-do in a Next 7 days day row: `.pe-it`, tick · title · `· Section`. */
  | { shape: "item"; tile: "week"; id: string; title: string; label: string }
  /** A Done this week row: the quiet ticked box, and un-ticking. */
  | { shape: "done"; tile: "done"; row: DoneTileView["rows"][number] };

export default function TodoRow(props: TodoRowProps) {
  if (props.shape === "item") return <WeekItem {...props} />;
  if (props.shape === "done") return <DoneRow {...props} />;
  return <OpenRow {...props} />;
}

function Tick({
  checked,
  title,
  onPress,
}: {
  checked: boolean;
  title: string;
  onPress: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className="tick"
      role="checkbox"
      aria-checked={checked}
      aria-label={`${checked ? "Undo" : "Done"} “${title}”`}
      onClick={onPress}
    >
      {checked && <Check />}
    </button>
  );
}

function OpenRow({ tile, row, tag, edit }: Extract<TodoRowProps, { shape: "open" }>) {
  const { toggle, hidden, sentence } = usePress(tile, row.id, false);
  // The row's edit form is open only in the edit epoch it was opened in and
  // never while the layout editor is open: entering edit mode bumps the epoch,
  // which closes it (Task 8 step 3); its typing survives in the tile's drafts.
  const [editingAt, setEditingAt] = useState<number | null>(null);
  const page = usePersonalPage();
  const editing = editingAt !== null && editingAt === page.editEpoch && !page.editing;
  const editButton = useRef<HTMLButtonElement>(null);
  const metaId = useId();
  if (hidden) return null;

  // Row grammar (R47): no empty span for an undated or untagged row — the
  // meta flows into implicit columns. `entry on the old day` stands in for
  // `on calendar` on a pinned row whose entry could not be moved.
  const meta = (
    <>
      <span className="pe-nm">{row.title}</span>
      {tag && <span className="tag" id={`${metaId}t`}>{row.sectionLabel}</span>}
      {row.note !== null ? (
        <span className="pe-on" id={`${metaId}o`}>{row.note}</span>
      ) : (
        row.onCalendar && <span className="pe-on" id={`${metaId}o`}>on calendar</span>
      )}
      {row.due !== null && <Due due={row.due} id={`${metaId}d`} />}
    </>
  );
  // S2: the edit button is named `Edit "…"`; its description is the row's
  // meta — the tag, the calendar state, the due meta (its visible form only).
  const describedBy =
    [tag && `${metaId}t`, (row.note !== null || row.onCalendar) && `${metaId}o`, row.due !== null && `${metaId}d`]
      .filter((x): x is string => typeof x === "string")
      .join(" ") || undefined;
  const said = sentence !== null && <p className="pe-said">{sentence}</p>;

  if (edit === undefined) {
    return (
      <>
        <div className="pe-row is-item">
          <Tick checked={false} title={row.title} onPress={toggle} />
          {meta}
        </div>
        {said}
      </>
    );
  }

  if (editing) {
    const close = () => {
      flushSync(() => setEditingAt(null));
      editButton.current?.focus();
    };
    return (
      <div className="pe-inline">
        <RowEdit.Provider value={{ close }}>{edit}</RowEdit.Provider>
      </div>
    );
  }

  return (
    <>
      <div className="pe-row is-todo">
        <Tick checked={false} title={row.title} onPress={toggle} />
        <button
          type="button"
          ref={editButton}
          className="pe-edit-row"
          aria-label={`Edit “${row.title}”`}
          aria-describedby={describedBy}
          onClick={() => setEditingAt(page.editEpoch)}
        >
          {meta}
        </button>
      </div>
      {said}
    </>
  );
}

function WeekItem({ tile, id, title, label }: Extract<TodoRowProps, { shape: "item" }>) {
  const { toggle, hidden, sentence } = usePress(tile, id, false);
  if (hidden) return null;
  return (
    <>
      <span className="pe-it">
        <Tick checked={false} title={title} onPress={toggle} />
        <span>{title}</span>
        <span className="pe-l">· {label}</span>
      </span>
      {sentence !== null && <span className="pe-said">{sentence}</span>}
    </>
  );
}

function DoneRow({ tile, row }: Extract<TodoRowProps, { shape: "done" }>) {
  const { toggle, hidden, sentence } = usePress(tile, row.id, true);
  if (hidden) return null;
  return (
    <>
      <div className="pe-row is-item">
        <Tick checked title={row.title} onPress={toggle} />
        <span className="pe-nm">{row.title}</span>
        <span className="tag">{row.sectionLabel}</span>
        {row.note !== null && <span className="pe-on">{row.note}</span>}
        <span className="pe-due">{row.dayLabel}</span>
      </div>
      {sentence !== null && <p className="pe-said">{sentence}</p>}
    </>
  );
}
