"use client";

/**
 * TodoForm — island 3 of five: ONE form serving add (Tile 2's `+ To-do`) and
 * edit (a to-do row's second control, in the To-do tile and in Today's DUE
 * group). Deck §7 for every field and string, deck §15 for the eleven.
 *
 * A real <form>: Enter submits, validation runs on submit only (`Give it a
 * title.`, aria-invalid + aria-describedby, the message under the field in
 * `.pe-said`'s register, no hue), fields go `readonly` while busy. Escape
 * closes KEEPING what was typed; Cancel closes and forgets it.
 *
 * WHERE THE TYPING LIVES. Never in the form. Every typed value is state of
 * the TILE that holds the form — the add draft in TodoTile, each row's edit
 * draft in the tile's FormDrafts map — and the form is a view of it. So any
 * close keeps it, whoever closes: Escape, the row's own close, and edit mode
 * (Task 8), which closes an open add form by bumping `editEpoch` (the form
 * shows only while the epoch it was opened in is current) — no effect, no
 * reaching into the form. Only Cancel and a save that landed forget a draft.
 * The same draft carries `parked`: an add that got no answer stays refused
 * across a close and a reopen, so no reopen can invite a duplicate.
 *
 * FOCUS, and no effect hook (R33). Opening the add form moves focus into
 * Title inside the pill's handler (flushSync, then the ref); closing returns
 * it to the pill. The edit form's Title takes `autoFocus`, honestly: its only
 * mount is the Edit press that opened it (TodoRow owns that handler), and
 * its close goes back through `useRowEdit().close()` to the row's Edit
 * button. The delete confirmation moves focus to `Keep`, and `Keep` returns
 * it to `Delete`.
 *
 * BUSY WITHOUT DROPPING FOCUS (L9). Every pill in the form that can hold
 * focus when a press starts takes `aria-disabled` plus a guard, never
 * `disabled` (which would throw focus to <body>). The switch keeps
 * `disabled`: pressing it never submits, so it is never the focused control
 * when a press starts.
 *
 * OUTCOMES (L7: pressOutcome decides, and nothing here re-derives it).
 *   ok       the form closes, the draft is forgotten, and the page re-reads.
 *            A calendar leg that did not finish says its sentence under the
 *            tile's head, with the `--stale` dot (R49 — a claim about
 *            Google, not about the press).
 *   failed   the sentence sits above the buttons; the form keeps everything.
 *   unknown  `Couldn’t tell if that saved.` — never a claimed failure. An
 *            ADD parks: `Add` stays refused and `Cancel` is the only live
 *            control, because a to-do that may already exist must not be
 *            added twice. An edit re-sends the same values harmlessly, so
 *            `Save` stays live. The page re-reads either way.
 */

import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { PRESS_TIMEOUT_MS, TODO_TITLE_MAX } from "@/lib/constants";
import type { DayKey } from "@/lib/days";
import { ERROR_SENTENCES, type CalendarOutcome } from "@/lib/personalErrors";
import type { SayLine } from "@/lib/personalView";
import { pressOutcome } from "@/lib/pressOutcome";
import { TileBody, TileFoot, TileHead, usePersonalPage } from "./LayoutEditor";
import { useRowEdit } from "./TodoRow";

// ---- the calendar leg's words -----------------------------------------------

type CalendarFailCause = Extract<CalendarOutcome, { kind: "failed" }>["cause"];

/**
 * THE ONE LIST of `<reason>` words, for deck §7's three sentences that carry
 * one: `Google didn’t accept it: <its reason>.` (Add an event), `Saved, but
 * the calendar entry failed: <reason>. …` (Add a to-do) and `Saved, but the
 * calendar entry couldn’t be moved: <reason>.` (Edit a to-do). The deck
 * names the slot and not the words; the doors answer a cause, never Google's
 * own message. EventForm imports this map; nothing else writes a reason.
 */
export const CALENDAR_REASONS: Readonly<Record<CalendarFailCause, string>> = Object.freeze({
  "not-configured": "Google isn’t connected", // PROVISIONAL (P10c)
  expired: "Google access has expired", // PROVISIONAL (P10c)
  refused: "the request was refused", // PROVISIONAL (P10c)
  gone: "that calendar or entry no longer exists", // PROVISIONAL (P10c)
  changed: "the to-do changed while the entry was being added", // PROVISIONAL (P10c)
  store: "the entry couldn’t be recorded", // PROVISIONAL (P10c)
});

/** The door's `calendar` field, checked before it is trusted; null when it is not the door's shape. */
export function calendarOf(body: unknown): CalendarOutcome | null {
  if (typeof body !== "object" || body === null) return null;
  const c = (body as { calendar?: unknown }).calendar;
  if (typeof c !== "object" || c === null) return null;
  const { kind, cause, orphaned } = c as { kind?: unknown; cause?: unknown; orphaned?: unknown };
  if (kind === "none" || kind === "ok") return { kind };
  if (kind === "unknown") return { kind, orphaned: orphaned === true };
  if (kind === "failed" && typeof cause === "string" && Object.hasOwn(CALENDAR_REASONS, cause)) {
    return { kind, cause: cause as CalendarFailCause, orphaned: orphaned === true };
  }
  return null;
}

/**
 * Which calendar write a save asked for: pin (switched on), move (stays on;
 * the store re-dates or re-titles the entry), unpin (switched off, due day
 * cleared, or deleted).
 */
type Leg = "pin" | "move" | "unpin";

/** deck §7 / §15: what a calendar leg that did not finish says, under the tile's head. */
function calendarLine(leg: Leg, outcome: CalendarOutcome | null): SayLine | null {
  if (outcome !== null && (outcome.kind === "none" || outcome.kind === "ok")) return null;
  if (outcome === null || outcome.kind === "unknown") {
    return { text: ERROR_SENTENCES["calendar-unknown"], dot: null }; // deck §15
  }
  const reason = CALENDAR_REASONS[outcome.cause];
  switch (leg) {
    case "pin":
      // deck §7, Add a to-do
      return { text: `Saved, but the calendar entry failed: ${reason}. The to-do is not on the calendar.`, dot: "stale" };
    case "move":
      // deck §7, Edit a to-do
      return { text: `Saved, but the calendar entry couldn’t be moved: ${reason}.`, dot: "stale" };
    case "unpin":
      // deck §7, Edit a to-do (after done, switch-off, or delete)
      return { text: "Done, but the calendar entry couldn’t be removed. Remove it in Google Calendar.", dot: "stale" };
  }
}

// ---- drafts: the typing lives in the tile -----------------------------------

type Section = "personal" | "freelance" | "academics";

/** deck §7: Personal · Freelance · Academics, default Personal. */
const SECTIONS: ReadonlyArray<{ key: Section; label: string }> = [
  { key: "personal", label: "Personal" },
  { key: "freelance", label: "Freelance" },
  { key: "academics", label: "Academics" },
];

export interface TodoDraft {
  title: string;
  section: Section;
  /** "" = no due day; otherwise the <input type="date"> value, a DayKey. */
  due: string;
  onCalendar: boolean;
  /** An add that got no answer: refused until Cancel (see the header). Never set on an edit. */
  parked: boolean;
}

/** The add form's empty draft (deck §7 defaults). */
export const EMPTY_TODO: TodoDraft = Object.freeze({
  title: "",
  section: "personal",
  due: "",
  onCalendar: false,
  parked: false,
});

/** An open to-do as its edit form starts from. */
export interface EditableTodo {
  id: string;
  title: string;
  section: Section;
  dueOn: DayKey | null;
  onCalendar: boolean;
}

function draftOf(t: EditableTodo): TodoDraft {
  return { title: t.title, section: t.section, due: t.dueOn ?? "", onCalendar: t.onCalendar, parked: false };
}

interface FormDraftsValue {
  /** Each row's edit draft, by to-do id — state of the tile, so a closed row form keeps it. */
  drafts: ReadonlyMap<string, TodoDraft>;
  setDraft: (id: string, draft: TodoDraft | null) => void;
  /** Focus the tile's own pill (`+ To-do` / `+ Event`) — where a deleted row's focus goes. */
  focusPill: () => void;
}

const FormDrafts = createContext<FormDraftsValue | null>(null);

/**
 * The state behind FormDrafts, for the two tiles whose rows carry an edit
 * form (To-do, and Today's DUE group). Immutable updates: every keystroke is
 * a state change of the tile, never a mutation.
 */
export function useFormDraftsState(focusPill: () => void): FormDraftsValue {
  const [drafts, setDrafts] = useState<ReadonlyMap<string, TodoDraft>>(() => new Map());
  return {
    drafts,
    setDraft: (id, draft) =>
      setDrafts((all) => {
        if (draft === null && !all.has(id)) return all;
        const next = new Map(all);
        if (draft === null) next.delete(id);
        else next.set(id, draft);
        return next;
      }),
    focusPill,
  };
}

export function FormDraftsProvider({ value, children }: { value: FormDraftsValue; children: ReactNode }) {
  return <FormDrafts.Provider value={value}>{children}</FormDrafts.Provider>;
}

// ---- Tile 2's client half: the pill, and the body the form replaces ---------

/**
 * The To-do tile's head pill and body. The eyebrow and count (`head`), the
 * sections (`body`) and the bounds (`foot`) are rendered on the server and
 * handed in; this places them and swaps the body for the add form while it
 * is open (R28: a form replaces the tile's body, never scrolls).
 *
 * `formCapable` false (R40, formCapableFor on the stored row) switches the
 * pill off with `Too narrow for the form.` under the head, and nothing is
 * taken away from the arrangement.
 */
export function TodoTile({
  head,
  body,
  foot,
  formCapable,
}: {
  head: ReactNode;
  body: ReactNode;
  foot: ReactNode;
  formCapable: boolean;
}) {
  const page = usePersonalPage();
  const pill = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLInputElement>(null);
  const formId = useId();
  const narrowId = useId();
  // The epoch the form was opened in; edit mode bumps the epoch, which closes
  // it (visual spec §7.3: "An open form closes on entry, keeping what was typed").
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [draft, setDraft] = useState<TodoDraft>(EMPTY_TODO);
  const drafts = useFormDraftsState(() => pill.current?.focus());
  const open = formCapable && openAt !== null && openAt === page.editEpoch && !page.editing;

  function close(keep: boolean) {
    if (!keep) setDraft(EMPTY_TODO);
    flushSync(() => setOpenAt(null));
    pill.current?.focus();
  }

  function toggle() {
    if (!formCapable) return;
    if (open) {
      close(true);
      return;
    }
    flushSync(() => setOpenAt(page.editEpoch));
    title.current?.focus();
  }

  return (
    <FormDraftsProvider value={drafts}>
      <TileHead tile="todos">
        {head}
        <button
          ref={pill}
          type="button"
          className="btn"
          disabled={!formCapable}
          aria-expanded={formCapable ? open : undefined}
          aria-controls={open ? formId : undefined}
          aria-describedby={formCapable ? undefined : narrowId}
          onClick={toggle}
        >
          {/* deck §6 Tile 2 */}
          + To-do
        </button>
      </TileHead>
      {!formCapable && (
        <p className="pe-said" id={narrowId}>
          {/* deck §15 */}
          Too narrow for the form.
        </p>
      )}
      <TileBody>
        {open ? (
          <TodoFormView
            mode="add"
            tile="todos"
            formId={formId}
            titleRef={title}
            draft={draft}
            setDraft={setDraft}
            close={close}
          />
        ) : (
          body
        )}
      </TileBody>
      <TileFoot tile="todos">{open ? null : foot}</TileFoot>
    </FormDraftsProvider>
  );
}

// ---- the edit form a row opens in place ---------------------------------------

/**
 * The edit form, as a tile hands it to TodoRow's `edit` seam: rendered on the
 * server with plain data, opened and closed by the row. Its draft lives in
 * the tile's FormDrafts.
 */
export default function TodoForm({ tile, todo }: { tile: "today" | "todos"; todo: EditableTodo }) {
  const store = useContext(FormDrafts);
  const rowEdit = useRowEdit();
  const draft = store?.drafts.get(todo.id) ?? draftOf(todo);
  return (
    <TodoFormView
      mode="edit"
      tile={tile}
      todo={todo}
      draft={draft}
      setDraft={(d) => store?.setDraft(todo.id, d)}
      close={(keep) => {
        if (!keep) store?.setDraft(todo.id, null);
        rowEdit?.close();
      }}
      focusPill={() => store?.focusPill()}
    />
  );
}

// ---- the form itself ------------------------------------------------------------

type ViewProps = {
  tile: "today" | "todos";
  draft: TodoDraft;
  setDraft: (d: TodoDraft) => void;
  /** keep=true keeps the draft (Escape, the pill); false forgets it (Cancel, a landed save). */
  close: (keep: boolean) => void;
} & (
  | { mode: "add"; formId: string; titleRef: RefObject<HTMLInputElement | null> }
  | { mode: "edit"; todo: EditableTodo; focusPill: () => void }
);

type Busy = null | "add" | "save" | "delete";

function TodoFormView(props: ViewProps) {
  const { tile, draft, setDraft, close } = props;
  const router = useRouter();
  const page = usePersonalPage();
  const ownTitle = useRef<HTMLInputElement>(null);
  const titleRef = props.mode === "add" ? props.titleRef : ownTitle;
  const deleteRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const ids = useId();
  const titleErrId = `${ids}-title-err`;
  const needId = `${ids}-need`;

  const [busy, setBusy] = useState<Busy>(null);
  const [titleError, setTitleError] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const frozen = busy !== null || draft.parked;
  const hasDue = draft.due !== "";

  function change(patch: Partial<TodoDraft>) {
    if (frozen) return;
    setDraft({ ...draft, ...patch });
  }

  function onDue(value: string) {
    // deck §7: clearing Due while the switch is on turns it off (and the note returns).
    change(value === "" ? { due: "", onCalendar: false } : { due: value });
  }

  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Escape" || busy !== null) return;
    e.preventDefault();
    if (confirming) {
      keep(); // Escape = Keep
      return;
    }
    close(true);
  }

  function askDelete() {
    if (busy !== null) return;
    setSaid(null);
    flushSync(() => setConfirming(true));
    keepRef.current?.focus();
  }

  function keep() {
    if (busy !== null) return;
    flushSync(() => setConfirming(false));
    deleteRef.current?.focus();
  }

  /** The PATCH body: only what changed, so an unchanged title or day never sends the entry a move. */
  function editPatch(todo: EditableTodo, title: string): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    if (title !== todo.title) patch.title = title;
    if (draft.section !== todo.section) patch.section = draft.section;
    const due = draft.due === "" ? null : draft.due;
    if (due !== todo.dueOn) patch.dueOn = due;
    if (draft.onCalendar !== todo.onCalendar) patch.onCalendar = draft.onCalendar;
    return patch;
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (frozen || confirming) return;
    const title = draft.title.trim();
    if (title === "") {
      // deck §7: `Give it a title.` — on submit only, and focus goes to the field it is about.
      setTitleError(true);
      setSaid(null);
      titleRef.current?.focus();
      return;
    }
    setTitleError(false);

    let url: string;
    let method: "POST" | "PATCH";
    let payload: Record<string, unknown>;
    let leg: Leg | null;
    if (props.mode === "add") {
      url = "/api/todos";
      method = "POST";
      payload = { title, section: draft.section, dueOn: hasDue ? draft.due : null, onCalendar: hasDue && draft.onCalendar };
      leg = hasDue && draft.onCalendar ? "pin" : null;
    } else {
      const { todo } = props;
      payload = editPatch(todo, title);
      if (Object.keys(payload).length === 0) {
        close(false); // nothing changed: nothing to send
        return;
      }
      url = `/api/todos/${encodeURIComponent(todo.id)}`;
      method = "PATCH";
      const wantPinned = hasDue && draft.onCalendar;
      leg = todo.onCalendar ? (wantPinned ? "move" : "unpin") : wantPinned ? "pin" : null;
    }

    page.press(tile);
    setSaid(null);
    setBusy(props.mode === "add" ? "add" : "save");
    const out = await pressOutcome(
      fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }),
    );
    setBusy(null);

    if (out.kind === "ok") {
      const line = leg === null ? null : calendarLine(leg, calendarOf(out.body));
      close(false);
      if (line !== null) page.note(tile, line);
    } else if (out.kind === "failed") {
      setSaid(out.sentence);
    } else if (props.mode === "add") {
      setDraft({ ...draft, parked: true });
    } else {
      setSaid(out.sentence);
    }
    router.refresh();
  }

  async function remove() {
    if (props.mode !== "edit" || busy !== null) return;
    const { todo, focusPill } = props;
    page.press(tile);
    setSaid(null);
    setBusy("delete");
    const out = await pressOutcome(
      fetch(`/api/todos/${encodeURIComponent(todo.id)}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }),
      "delete-failed",
    );
    setBusy(null);

    if (out.kind === "failed") {
      // deck §15 `Couldn’t delete.` — the question gives way to the buttons again.
      flushSync(() => {
        setConfirming(false);
        setSaid(out.sentence);
      });
      deleteRef.current?.focus();
    } else {
      // Gone, or maybe gone: the row leaves both tiles at once (C11). A no-answer
      // delete keeps it hidden, as a no-answer tick does; the re-read decides.
      const line =
        out.kind === "ok"
          ? todo.onCalendar
            ? calendarLine("unpin", calendarOf(out.body))
            : null
          : { text: out.sentence, dot: null };
      close(false); // forgets the draft, closes the row's form
      page.hide(`open:${todo.id}`);
      focusPill(); // the row is leaving; its Edit button cannot keep focus
      if (line !== null) page.note(tile, line);
    }
    router.refresh();
  }

  const shownSaid = draft.parked ? ERROR_SENTENCES["calendar-unknown"] : said; // deck §15
  const submitLabel =
    busy === "add" ? "Adding…" : busy === "save" ? "Saving…" : props.mode === "add" ? "Add" : "Save"; // deck §7, §15

  return (
    <form
      className="formwell"
      id={props.mode === "add" ? props.formId : undefined}
      noValidate
      onSubmit={submit}
      onKeyDown={onKeyDown}
    >
      <div className="pe-fields">
        <div>
          <label className="fld-l" htmlFor={`${ids}-title`}>
            Title
          </label>
          <input
            ref={titleRef}
            className="fld"
            id={`${ids}-title`}
            type="text"
            maxLength={TODO_TITLE_MAX /* deck §7: up to 140 */}
            autoComplete="off"
            autoFocus={props.mode === "edit"}
            value={draft.title}
            readOnly={frozen}
            aria-invalid={titleError || undefined}
            aria-describedby={titleError ? titleErrId : undefined}
            onChange={(e) => change({ title: e.target.value })}
          />
          {titleError && (
            <p className="pe-said" id={titleErrId}>
              {ERROR_SENTENCES["no-title"] /* deck §7 */}
            </p>
          )}
        </div>
        <div className="pe-pair">
          <div>
            <label className="fld-l" htmlFor={`${ids}-sec`}>
              Section
            </label>
            <span className="sel">
              <select
                className="fld"
                id={`${ids}-sec`}
                value={draft.section}
                aria-readonly={frozen || undefined}
                onChange={(e) => change({ section: e.target.value as Section })}
              >
                {SECTIONS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <div>
            <label className="fld-l" htmlFor={`${ids}-due`}>
              Due
            </label>
            <input
              className="fld"
              id={`${ids}-due`}
              type="date"
              value={draft.due}
              readOnly={frozen}
              onChange={(e) => onDue(e.target.value)}
            />
          </div>
        </div>
        <div>
          <div className="pe-ctl">
            <button
              type="button"
              className={draft.onCalendar ? "swx on" : "swx"}
              role="switch"
              aria-checked={draft.onCalendar}
              aria-label="Put on calendar"
              disabled={!hasDue || frozen}
              aria-describedby={hasDue ? undefined : needId}
              onClick={() => change({ onCalendar: !draft.onCalendar })}
            >
              <b></b>
            </button>
            <span>Put on calendar</span>
          </div>
          {!hasDue && (
            <p className="pe-said" id={needId}>
              {ERROR_SENTENCES["needs-due"] /* deck §7 */}
            </p>
          )}
        </div>
      </div>
      {shownSaid !== null && <p className="pe-said">{shownSaid}</p>}
      {confirming && props.mode === "edit" ? (
        <div className="pe-confirm">
          <span className="pe-q">
            {props.todo.onCalendar
              ? `Delete “${props.todo.title}” and its calendar entry?` // deck §15
              : `Delete “${props.todo.title}”?` /* deck §7 */}
          </span>
          {/* one group, wrapping together (S4) */}
          <span className="pe-yn">
            <button type="button" className="btn" aria-disabled={busy === "delete" || undefined} onClick={remove}>
              {busy === "delete" ? "Deleting…" : "Delete" /* deck §7, §15 */}
            </button>
            <button
              ref={keepRef}
              type="button"
              className="btn hi"
              aria-disabled={busy === "delete" || undefined}
              onClick={keep}
            >
              Keep
            </button>
          </span>
        </div>
      ) : (
        <div className="pe-acts">
          {props.mode === "edit" && (
            <button
              ref={deleteRef}
              type="button"
              className="btn pe-left"
              aria-disabled={busy !== null || undefined}
              onClick={askDelete}
            >
              Delete
            </button>
          )}
          <button
            type="button"
            className="btn"
            aria-disabled={busy !== null || undefined}
            onClick={() => {
              if (busy === null) close(false);
            }}
          >
            Cancel
          </button>
          <button type="submit" className="btn hi" aria-disabled={frozen || undefined}>
            {submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}
