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
 * EVERYTHING A PRESS LEAVES BEHIND LIVES IN THE TILE, never in the form: the
 * typed values, the press in flight (`sending`), the refusal after a press
 * that got no answer (`parked`) and the press's sentence (`said`). The add
 * draft is TodoTile's state; each row's edit draft is the tile's FormDrafts
 * map. The form is a view of it, so a close, a reopen, a remount (edit mode
 * closing the form by bumping `editEpoch`, a body swap) can never lose what
 * was typed, drop a sentence, or re-enable a press that is still in flight —
 * no form can send twice. Only Cancel and a save that landed forget a draft.
 *
 * FOCUS, and no effect hook (R33). Opening the add form moves focus into
 * Title inside the pill's handler (flushSync, then the ref); closing returns
 * it to the pill. The edit form's Title takes `autoFocus`, honestly: its only
 * mount is the Edit press that opened it (TodoRow owns that handler), and
 * its close goes back through `useRowEdit().close()` to the row's Edit
 * button — or to the tile's pill when the row is leaving (deleted, or moved
 * to another section). The confirmation moves focus to `Keep`; `Keep`
 * returns it to `Delete`.
 *
 * BUSY WITHOUT DROPPING FOCUS (L9). Every pill in the form that can hold
 * focus when a press starts takes `aria-disabled` plus a guard, never
 * `disabled`. The switch keeps `disabled`: pressing it never submits.
 *
 * OUTCOMES (L7: pressOutcome decides, and nothing here re-derives it).
 *   ok       the form closes, the draft is forgotten, the page re-reads. A
 *            calendar leg that did not finish says so under the tile's head
 *            with the `--stale` dot (R49: a claim about Google).
 *   failed   the sentence sits above the buttons; the form keeps everything.
 *   unknown  `Couldn’t tell if that saved.` — never a claimed failure. An
 *            ADD parks: `Add` stays refused and `Cancel` is the only live
 *            control, so a to-do that may already exist is never added
 *            twice. An edit re-sends the same values harmlessly, so `Save`
 *            stays live.
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
import { ENTRY_LEFT_SENTENCE, ERROR_SENTENCES, type CalendarOutcome } from "@/lib/personalErrors";
import type { SayLine } from "@/lib/personalView";
import { pressOutcome } from "@/lib/pressOutcome";
import { TileBody, TileFoot, TileHead, usePersonalPage } from "./LayoutEditor";
import { useRowEdit } from "./TodoRow";

// ---- the calendar leg's words -----------------------------------------------

type CalendarFailCause = Extract<CalendarOutcome, { kind: "failed" }>["cause"];

/** Which deck §7 sentence a reason fills: `gone` reads differently in each. */
export type ReasonFor = "event" | "pin" | "move";

/**
 * THE ONE LIST of `<reason>` words, for deck §7's three sentences that carry
 * one: `Google didn’t accept it: <its reason>.` (Add an event), `Saved, but
 * the calendar entry failed: <reason>. …` (Add a to-do) and `Saved, but the
 * calendar entry couldn’t be moved: <reason>.` (Edit a to-do). The deck
 * names the slot and not the words, and the doors answer a cause, never
 * Google's own message. EventForm reads this through calendarReason.
 */
const CALENDAR_REASONS: Readonly<Record<CalendarFailCause, string | Readonly<Record<ReasonFor, string>>>> =
  Object.freeze({
    "not-configured": "Google isn’t connected yet", // PROVISIONAL (P10c)
    expired: "Google access has expired", // PROVISIONAL (P10c)
    refused: "Google refused the request", // PROVISIONAL (P10c)
    gone: Object.freeze({
      event: "the calendar is no longer on your Google account", // PROVISIONAL (P10c)
      pin: "the calendar is no longer on your Google account", // PROVISIONAL (P10c)
      move: "the entry is no longer on Google", // PROVISIONAL (P10c)
    }),
    changed: "the to-do changed at the same moment", // PROVISIONAL (P10c)
    store: "the app couldn’t record it", // PROVISIONAL (P10c)
  });

export function calendarReason(cause: CalendarFailCause, sentence: ReasonFor): string {
  const r = CALENDAR_REASONS[cause];
  return typeof r === "string" ? r : r[sentence];
}

/**
 * A pin whose entry may exist on Google with no record pointing at it (an
 * unanswered insert, or a failure whose clean-up did not take): saying `The
 * to-do is not on the calendar.` there could be false.
 */
const PIN_MAYBE_MADE =
  "Saved. A calendar entry may have been made anyway. Check Google Calendar before switching it on again."; // PROVISIONAL (P10c)

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

/**
 * What a calendar leg that did not finish says, under the tile's head. The
 * to-do's own write landed (the door answered 2xx), so nothing here says the
 * save failed. An outcome the door did not spell out is treated as unknown.
 */
function calendarLine(leg: Leg, outcome: CalendarOutcome | null): SayLine | null {
  if (outcome !== null && (outcome.kind === "none" || outcome.kind === "ok")) return null;
  const c: CalendarOutcome = outcome ?? { kind: "unknown", orphaned: false };
  switch (leg) {
    case "unpin":
      // deck §7 (after done, switch-off, or delete) / §15: the entry may still be there.
      return { text: ENTRY_LEFT_SENTENCE, dot: "stale" };
    case "pin":
      if (c.kind === "failed" && !c.orphaned) {
        // deck §7, Add a to-do: nothing was left on Google.
        return {
          text: `Saved, but the calendar entry failed: ${calendarReason(c.cause, "pin")}. The to-do is not on the calendar.`,
          dot: "stale",
        };
      }
      return { text: PIN_MAYBE_MADE, dot: "stale" };
    case "move":
      if (c.kind === "failed") {
        // deck §7, Edit a to-do
        return { text: `Saved, but the calendar entry couldn’t be moved: ${calendarReason(c.cause, "move")}.`, dot: "stale" };
      }
      // deck §15: the move may or may not have landed; the row's own
      // `entry on the old day` reports it after the re-read if it did not.
      return { text: ERROR_SENTENCES["calendar-unknown"], dot: null };
  }
}

// ---- drafts: everything lives in the tile -----------------------------------

type Section = "personal" | "freelance" | "academics";

/** deck §7: Personal · Freelance · Academics, default Personal. */
const SECTIONS: ReadonlyArray<{ key: Section; label: string }> = [
  { key: "personal", label: "Personal" },
  { key: "freelance", label: "Freelance" },
  { key: "academics", label: "Academics" },
];

interface TodoValues {
  title: string;
  section: Section;
  /** "" = no due day; otherwise the <input type="date"> value, a DayKey. */
  due: string;
  onCalendar: boolean;
}

type Sending = false | "add" | "save" | "delete";

export interface TodoDraft {
  /** An edit's starting values — a PATCH sends only what differs from these. null for an add. */
  base: TodoValues | null;
  values: TodoValues;
  /** The press in flight: the form is frozen and no pill can start a second. */
  sending: Sending;
  /** An add that got no answer: refused until Cancel. Never set on an edit. */
  parked: boolean;
  /** The press's sentence above the buttons. */
  said: string | null;
}

/** The add form's empty draft (deck §7 defaults). */
const EMPTY_ADD: TodoDraft = Object.freeze({
  base: null,
  values: Object.freeze({ title: "", section: "personal" as Section, due: "", onCalendar: false }),
  sending: false,
  parked: false,
  said: null,
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
  const values = { title: t.title, section: t.section, due: t.dueOn ?? "", onCalendar: t.onCalendar };
  return { base: values, values, sending: false, parked: false, said: null };
}

type DraftUpdate = (d: TodoDraft) => TodoDraft;

interface FormDraftsValue {
  /** Each row's edit draft, by to-do id. */
  drafts: ReadonlyMap<string, TodoDraft>;
  /** Functional update of one row's draft, starting from `init` when it has none. */
  update: (id: string, init: TodoDraft, fn: DraftUpdate) => void;
  forget: (id: string) => void;
  /** Focus the tile's own pill (`+ To-do` / `+ Event`), or the tile when it is off. */
  focusPill: () => void;
}

const FormDrafts = createContext<FormDraftsValue | null>(null);

/**
 * The state behind FormDrafts, for the two tiles whose rows carry an edit
 * form (To-do, and Today's DUE group). Immutable updates only.
 */
export function useFormDraftsState(focusPill: () => void): FormDraftsValue {
  const [drafts, setDrafts] = useState<ReadonlyMap<string, TodoDraft>>(() => new Map());
  return {
    drafts,
    update: (id, init, fn) =>
      setDrafts((all) => {
        const next = new Map(all);
        next.set(id, fn(all.get(id) ?? init));
        return next;
      }),
    forget: (id) =>
      setDrafts((all) => {
        if (!all.has(id)) return all;
        const next = new Map(all);
        next.delete(id);
        return next;
      }),
    focusPill,
  };
}

export function FormDraftsProvider({ value, children }: { value: FormDraftsValue; children: ReactNode }) {
  return <FormDrafts.Provider value={value}>{children}</FormDrafts.Provider>;
}

/**
 * Where focus goes when the control holding it is leaving: the tile's pill,
 * or — when the pill is switched off and cannot take focus — the tile itself
 * (focusable only programmatically, out of the tab order), so it never falls
 * to <body>. Called from handlers only.
 */
export function focusPillOrTile(pill: HTMLButtonElement | null) {
  if (pill === null) return;
  if (!pill.disabled) {
    pill.focus();
    return;
  }
  const tile = pill.closest<HTMLElement>(".pe-tile");
  if (tile === null) return;
  if (!tile.hasAttribute("tabindex")) tile.setAttribute("tabindex", "-1");
  tile.focus();
}

// ---- Tile 2's client half: the pill, and the body the form replaces ---------

/**
 * The To-do tile's head pill and body. The eyebrow and count (`head`) and
 * the sections (`body`) are rendered on the server and handed in; this
 * places them and swaps the body for the add form while it is open (R28: a
 * form replaces the tile's body, never scrolls).
 *
 * `formCapable` false (R40, formCapableFor on the stored row) switches the
 * pill off with `Too narrow for the form.` under the head, and nothing is
 * taken away from the arrangement. While an add is in flight the pill is
 * `aria-disabled`: closing then reopening must not offer a second send.
 */
export function TodoTile({ head, body, formCapable }: { head: ReactNode; body: ReactNode; formCapable: boolean }) {
  const page = usePersonalPage();
  const pill = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLInputElement>(null);
  const formId = useId();
  const narrowId = useId();
  // The epoch the form was opened in; edit mode bumps the epoch, which closes
  // it (visual spec §7.3: "An open form closes on entry, keeping what was typed").
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [draft, setDraft] = useState<TodoDraft>(EMPTY_ADD);
  const drafts = useFormDraftsState(() => focusPillOrTile(pill.current));
  const open = formCapable && openAt !== null && openAt === page.editEpoch && !page.editing;
  const sending = draft.sending !== false;

  function close(keep: boolean) {
    if (!keep) setDraft(EMPTY_ADD);
    flushSync(() => setOpenAt(null));
    focusPillOrTile(pill.current);
  }

  function toggle() {
    if (!formCapable || sending) return;
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
          aria-disabled={(formCapable && sending) || undefined}
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
            update={setDraft}
            close={close}
          />
        ) : (
          body
        )}
      </TileBody>
      <TileFoot tile="todos" />
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
  const init = draftOf(todo);
  const draft = store?.drafts.get(todo.id) ?? init;
  return (
    <TodoFormView
      mode="edit"
      tile={tile}
      todo={todo}
      draft={draft}
      update={(fn) => store?.update(todo.id, init, fn)}
      close={(keep) => {
        if (!keep) store?.forget(todo.id);
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
  update: (fn: DraftUpdate) => void;
  /** keep=true keeps the draft (Escape, the pill); false forgets it (Cancel, a landed save). */
  close: (keep: boolean) => void;
} & (
  | { mode: "add"; formId: string; titleRef: RefObject<HTMLInputElement | null> }
  | { mode: "edit"; todo: EditableTodo; focusPill: () => void }
);

function TodoFormView(props: ViewProps) {
  const { tile, draft, update, close } = props;
  const router = useRouter();
  const page = usePersonalPage();
  const ownTitle = useRef<HTMLInputElement>(null);
  const titleRef = props.mode === "add" ? props.titleRef : ownTitle;
  const deleteRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const ids = useId();
  const titleErrId = `${ids}-title-err`;
  const needId = `${ids}-need`;

  const [titleError, setTitleError] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const { values, sending } = draft;
  const busy = sending !== false;
  const frozen = busy || draft.parked;
  const hasDue = values.due !== "";

  function change(patch: Partial<TodoValues>) {
    if (frozen) return;
    update((d) => ({ ...d, values: { ...d.values, ...patch } }));
  }

  function onDue(value: string) {
    // deck §7: clearing Due while the switch is on turns it off (and the note returns).
    change(value === "" ? { due: "", onCalendar: false } : { due: value });
  }

  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Escape" || busy) return;
    e.preventDefault();
    if (confirming) {
      keep(); // Escape = Keep
      return;
    }
    close(true);
  }

  function askDelete() {
    if (busy) return;
    update((d) => ({ ...d, said: null }));
    flushSync(() => setConfirming(true));
    keepRef.current?.focus();
  }

  function keep() {
    if (busy) return;
    flushSync(() => setConfirming(false));
    deleteRef.current?.focus();
  }

  /** The PATCH body: only what differs from the values the edit started from. */
  function editPatch(base: TodoValues, title: string): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    if (title !== base.title) patch.title = title;
    if (values.section !== base.section) patch.section = values.section;
    if (values.due !== base.due) patch.dueOn = values.due === "" ? null : values.due;
    if (values.onCalendar !== base.onCalendar) patch.onCalendar = values.onCalendar;
    return patch;
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (frozen || confirming) return;
    const title = values.title.trim();
    if (title === "") {
      // deck §7: `Give it a title.` — on submit only, and focus goes to the field it is about.
      setTitleError(true);
      update((d) => ({ ...d, said: null }));
      titleRef.current?.focus();
      return;
    }
    setTitleError(false);

    const wantPinned = hasDue && values.onCalendar;
    let url: string;
    let method: "POST" | "PATCH";
    let payload: Record<string, unknown>;
    let leg: Leg | null;
    let leaves = false;
    if (props.mode === "add") {
      url = "/api/todos";
      method = "POST";
      payload = { title, section: values.section, dueOn: hasDue ? values.due : null, onCalendar: wantPinned };
      leg = wantPinned ? "pin" : null;
    } else {
      const base = draft.base ?? draftOf(props.todo).values;
      payload = editPatch(base, title);
      if (Object.keys(payload).length === 0) {
        close(false); // nothing changed: nothing to send
        return;
      }
      url = `/api/todos/${encodeURIComponent(props.todo.id)}`;
      method = "PATCH";
      leg = base.onCalendar ? (wantPinned ? "move" : "unpin") : wantPinned ? "pin" : null;
      // In the To-do tile a new section moves the row out from under its Edit button.
      leaves = tile === "todos" && values.section !== base.section;
    }

    page.press(tile);
    const kind: Sending = props.mode === "add" ? "add" : "save";
    update((d) => ({ ...d, sending: kind, said: null }));
    const out = await pressOutcome(
      fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }),
    );

    if (out.kind === "ok") {
      const line = leg === null ? null : calendarLine(leg, calendarOf(out.body));
      close(false);
      if (leaves && props.mode === "edit") props.focusPill();
      if (line !== null) page.note(tile, line);
    } else if (out.kind === "failed") {
      update((d) => ({ ...d, sending: false, said: out.sentence }));
    } else if (props.mode === "add") {
      update((d) => ({ ...d, sending: false, parked: true, said: null }));
    } else {
      update((d) => ({ ...d, sending: false, said: out.sentence }));
    }
    router.refresh();
  }

  async function remove() {
    if (props.mode !== "edit" || busy) return;
    const { todo, focusPill } = props;
    page.press(tile);
    update((d) => ({ ...d, sending: "delete", said: null }));
    const out = await pressOutcome(
      fetch(`/api/todos/${encodeURIComponent(todo.id)}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }),
      "delete-failed",
    );

    if (out.kind === "failed") {
      // deck §15 `Couldn’t delete.` — the question gives way to the buttons again.
      update((d) => ({ ...d, sending: false, said: out.sentence }));
      flushSync(() => setConfirming(false));
      deleteRef.current?.focus();
    } else {
      // The row leaves both tiles at once (C11). A delete that landed always
      // reports its entry by the unpin rule; one that got no answer keeps the
      // row hidden, as a no-answer tick does, and the re-read decides.
      const line = out.kind === "ok" ? calendarLine("unpin", calendarOf(out.body)) : { text: out.sentence, dot: null };
      close(false); // forgets the draft, closes the row's form
      page.hide(`open:${todo.id}`);
      focusPill(); // the row is leaving; its Edit button cannot keep focus
      if (line !== null) page.note(tile, line);
    }
    router.refresh();
  }

  const shownSaid = draft.parked ? ERROR_SENTENCES["calendar-unknown"] : draft.said; // deck §15
  const submitLabel =
    sending === "add" ? "Adding…" : sending === "save" ? "Saving…" : props.mode === "add" ? "Add" : "Save"; // deck §7, §15

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
            value={values.title}
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
                value={values.section}
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
              value={values.due}
              readOnly={frozen}
              onChange={(e) => onDue(e.target.value)}
            />
          </div>
        </div>
        <div>
          <div className="pe-ctl">
            <button
              type="button"
              className={values.onCalendar ? "swx on" : "swx"}
              role="switch"
              aria-checked={values.onCalendar}
              aria-label="Put on calendar"
              disabled={!hasDue || frozen}
              aria-describedby={hasDue ? undefined : needId}
              onClick={() => change({ onCalendar: !values.onCalendar })}
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
            <button type="button" className="btn" aria-disabled={sending === "delete" || undefined} onClick={remove}>
              {sending === "delete" ? "Deleting…" : "Delete" /* deck §7, §15 */}
            </button>
            <button
              ref={keepRef}
              type="button"
              className="btn hi"
              aria-disabled={sending === "delete" || undefined}
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
              aria-disabled={busy || undefined}
              onClick={askDelete}
            >
              Delete
            </button>
          )}
          <button
            type="button"
            className="btn"
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) close(false);
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
