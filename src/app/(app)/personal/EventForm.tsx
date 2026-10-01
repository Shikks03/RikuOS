"use client";

/**
 * EventForm — island 4 of five: `+ Event` on Tile 1 (deck §7, Add an event).
 * One event, written straight to Google through POST /api/calendar/events;
 * nothing is stored here (concept D5).
 *
 * The same form grammar as TodoForm: a real <form>, Enter submits, validation
 * on submit only (`Give it a title.` · `End must be after start.`), fields
 * `readonly` while busy, Escape closes keeping what was typed, Cancel closes
 * and forgets it. Every typed value — and the press in flight, its refusal
 * and its sentence — is state of EventTile, the tile, not the
 * form — so a close by Escape, by the pill or by edit mode (which bumps
 * `editEpoch`, see TodoTile) keeps it. Focus goes into Title inside the
 * pill's handler and back to the pill on close; no effect hook (R33).
 *
 * `End` tracks `Start` + 1h until it is edited, through days.ts's
 * oneHourAfter — the one rule the server's default uses too (capped at 23:59,
 * so it never wraps past midnight on the one day the door writes to).
 * `All day` hides Start and End with the `hidden` attribute and never
 * unmounts them, so what was typed survives the toggle.
 *
 * THE OUTCOMES — and the asymmetry is the point (CLAUDE.md: failed after the
 * side effect, or unknown, parks for a human; never guess):
 *   ok        the form closes and the page re-reads (Today and Next 7 days).
 *             A day the page cannot show says `Added. It’s on Fri 24 Oct,
 *             outside this week.` under the head (deck §15).
 *   refused   `Google didn’t accept it: <its reason>.` above the buttons; the
 *             form keeps everything and `Add` re-enables.
 *   no answer `Couldn’t reach Google. Check the calendar before trying
 *             again.` — `Add` STAYS refused and `Cancel` is the only live
 *             control, because the event may already exist and a second
 *             press would duplicate it. The page re-reads, so an event that
 *             landed shows itself. The refusal is part of the draft: a close
 *             and a reopen do not lift it; only Cancel does.
 */

import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { EVENT_TITLE_MAX, PRESS_TIMEOUT_MS } from "@/lib/constants";
import { addDays, formatDay, oneHourAfter } from "@/lib/days";
import { ERROR_SENTENCES } from "@/lib/personalErrors";
import { pressOutcome } from "@/lib/pressOutcome";
import { TileBody, TileFoot, TileHead, usePersonalPage } from "./LayoutEditor";
import type { EventFormData } from "./_blocks/Today";
import { FormDraftsProvider, calendarOf, calendarReason, focusPillOrTile, useFormDraftsState } from "./TodoForm";

/** deck §7 */
const NO_ANSWER = "Couldn’t reach Google. Check the calendar before trying again.";

interface EventDraft {
  title: string;
  calendarId: string;
  dayKey: string;
  allDay: boolean;
  start: string;
  end: string;
  /** Once End is edited it stops tracking Start + 1h (deck §7). */
  endEdited: boolean;
  /** Anything typed or chosen: an untouched draft re-reads the server's defaults when opened. */
  touched: boolean;
  /** The press in flight: the form is frozen and the pill cannot start a second. */
  sending: boolean;
  /** A press that got no answer: refused until Cancel. */
  parked: boolean;
  /** The press's sentence above the buttons. */
  said: string | null;
}

/** deck §7 defaults: the first switched-on layer, today, the next full hour, +1h — all from the server. */
function freshDraft(form: EventFormData): EventDraft {
  return {
    title: "",
    calendarId: form.calendars[0]?.calendarId ?? "",
    dayKey: form.defaults.dayKey,
    allDay: false,
    start: form.defaults.start,
    end: form.defaults.end,
    endEdited: false,
    touched: false,
    sending: false,
    parked: false,
    said: null,
  };
}

/**
 * Tile 1's client half: the `+ Event` pill, the body the form replaces, and
 * the FormDrafts the DUE rows' edit forms keep their typing in. The groups
 * (`body`) and the bound (`foot`) are rendered on the server.
 *
 * The pill is refused before the fact (R40, R20, R42): too narrow (`Too
 * narrow for the form.` under the head), or nothing to write to — every
 * layer off, layers unreadable, Google not set up or expired
 * (TodayView.eventFormBlocked, or no switched-on layer to list) — where it
 * points at the Scheduled group's own sentence (`reasonId`) as its reason.
 *
 * The tint is the server's, on the <section> around this, and nothing here
 * touches it: an open form covers the group that displays the count, not the
 * read that produced it (R78), and the count is re-read at render, never live
 * (R67).
 */
export function EventTile({
  head,
  body,
  foot,
  pair,
  formCapable: stored,
  blocked,
  reasonId,
  form,
}: {
  head: ReactNode;
  body: ReactNode;
  foot: ReactNode;
  /** TodayView.spread (R17): both groups empty. Never while the form is open. */
  pair: boolean;
  formCapable: boolean;
  blocked: boolean;
  /** The id of the Scheduled sentence that explains a blocked pill, or null. */
  reasonId: string | null;
  form: EventFormData;
}) {
  const page = usePersonalPage();
  // R40 from the working copy while editing (Task 8 step 7), else the stored row's answer.
  const formCapable = page.formCapableNow("today") ?? stored;
  const pill = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLInputElement>(null);
  const formId = useId();
  const narrowId = useId();
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [draft, setDraft] = useState<EventDraft>(() => freshDraft(form));
  const drafts = useFormDraftsState(() => focusPillOrTile(pill.current));

  const canOpen = formCapable && !blocked;
  const open = canOpen && openAt !== null && openAt === page.editEpoch && !page.editing;
  const why = [!formCapable ? narrowId : null, blocked ? reasonId : null].filter((x) => x !== null).join(" ");

  function close(keep: boolean) {
    if (!keep) setDraft(freshDraft(form));
    flushSync(() => setOpenAt(null));
    focusPillOrTile(pill.current);
  }

  function toggle() {
    if (!canOpen || draft.sending) return;
    if (open) {
      close(true);
      return;
    }
    flushSync(() => {
      // Nothing typed yet: the defaults are the server's latest, not the first render's.
      if (!draft.touched && !draft.parked) setDraft(freshDraft(form));
      setOpenAt(page.editEpoch);
    });
    title.current?.focus();
  }

  return (
    <FormDraftsProvider value={drafts}>
      <TileHead tile="today">
        {head}
        <button
          ref={pill}
          type="button"
          className="btn"
          disabled={!canOpen}
          aria-disabled={(canOpen && draft.sending) || undefined}
          aria-expanded={canOpen ? open : undefined}
          aria-controls={open ? formId : undefined}
          aria-describedby={canOpen || why === "" ? undefined : why}
          onClick={toggle}
        >
          {/* deck §6 Tile 1 */}
          + Event
        </button>
      </TileHead>
      {!formCapable && (
        <p className="pe-said" id={narrowId}>
          {/* deck §15 */}
          Too narrow for the form.
        </p>
      )}
      <TileBody pair={pair && !open}>
        {open ? (
          <EventFormView
            formId={formId}
            titleRef={title}
            form={form}
            draft={draft}
            update={setDraft}
            close={close}
          />
        ) : (
          body
        )}
      </TileBody>
      <TileFoot tile="today">{open ? null : foot}</TileFoot>
    </FormDraftsProvider>
  );
}

function EventFormView({
  formId,
  titleRef,
  form,
  draft,
  update,
  close,
}: {
  formId: string;
  titleRef: RefObject<HTMLInputElement | null>;
  form: EventFormData;
  draft: EventDraft;
  update: (fn: (d: EventDraft) => EventDraft) => void;
  close: (keep: boolean) => void;
}) {
  const router = useRouter();
  const page = usePersonalPage();
  const endRef = useRef<HTMLInputElement>(null);
  const ids = useId();
  const titleErrId = `${ids}-title-err`;
  const endErrId = `${ids}-end-err`;

  const [titleError, setTitleError] = useState(false);
  const [endError, setEndError] = useState(false);

  const busy = draft.sending;
  const frozen = busy || draft.parked;
  // A layer switched off since the draft began falls back to the first one still on.
  const calendarId = form.calendars.some((c) => c.calendarId === draft.calendarId)
    ? draft.calendarId
    : (form.calendars[0]?.calendarId ?? "");

  function change(patch: Partial<EventDraft>) {
    if (frozen) return;
    update((d) => ({ ...d, ...patch, touched: true }));
  }

  function onStart(start: string) {
    // deck §7: End tracks Start + 1h until edited — the server default's own rule.
    change(draft.endEdited ? { start } : { start, end: oneHourAfter(start) ?? draft.end });
  }

  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Escape" || busy) return;
    e.preventDefault();
    close(true);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (frozen) return;
    const title = draft.title.trim();
    const noTitle = title === "";
    const badEnd = !draft.allDay && (draft.start === "" || draft.end === "" || draft.end <= draft.start);
    if (noTitle || badEnd) {
      // On submit only; focus goes to the first field the message is about.
      setTitleError(noTitle);
      setEndError(badEnd);
      update((d) => ({ ...d, said: null }));
      (noTitle ? titleRef : endRef).current?.focus();
      return;
    }
    setTitleError(false);
    setEndError(false);

    const dayKey = draft.dayKey;
    page.press("today");
    update((d) => ({ ...d, sending: true, said: null }));
    const out = await pressOutcome(
      fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          draft.allDay
            ? { title, calendarId, dayKey, allDay: true }
            : { title, calendarId, dayKey, allDay: false, start: draft.start, end: draft.end },
        ),
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }),
    );

    if (out.kind === "ok") {
      close(false);
      // The page shows today (Tile 1) and today+1 … today+7 (Tile 5); anything else would vanish silently.
      if (dayKey < form.today || dayKey > addDays(form.today, 7)) {
        page.note("today", { text: `Added. It’s on ${formatDay(dayKey)}, outside this week.`, dot: null }); // deck §15
      }
    } else if (out.kind === "failed") {
      const cal = out.code === "calendar-failed" ? calendarOf(out.body) : null;
      const said =
        cal !== null && cal.kind === "failed"
          ? `Google didn’t accept it: ${calendarReason(cal.cause, "event")}.` // deck §7
          : out.sentence;
      update((d) => ({ ...d, sending: false, said }));
    } else {
      update((d) => ({ ...d, sending: false, parked: true, said: null }));
    }
    router.refresh();
  }

  const shownSaid = draft.parked ? NO_ANSWER : draft.said;

  return (
    <form className="formwell" id={formId} noValidate onSubmit={submit} onKeyDown={onKeyDown}>
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
            maxLength={EVENT_TITLE_MAX}
            autoComplete="off"
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
            <label className="fld-l" htmlFor={`${ids}-cal`}>
              Calendar
            </label>
            <span className="sel">
              <select
                className="fld"
                id={`${ids}-cal`}
                value={calendarId}
                aria-readonly={frozen || undefined}
                onChange={(e) => change({ calendarId: e.target.value })}
              >
                {form.calendars.map((c) => (
                  <option key={c.calendarId} value={c.calendarId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <div>
            <label className="fld-l" htmlFor={`${ids}-date`}>
              Date
            </label>
            <input
              className="fld"
              id={`${ids}-date`}
              type="date"
              value={draft.dayKey}
              readOnly={frozen}
              onChange={(e) => change({ dayKey: e.target.value })}
            />
          </div>
        </div>
        <div className="pe-ctl">
          <button
            type="button"
            className={draft.allDay ? "swx on" : "swx"}
            role="switch"
            aria-checked={draft.allDay}
            aria-label="All day"
            disabled={frozen}
            onClick={() => change({ allDay: !draft.allDay })}
          >
            <b></b>
          </button>
          <span>All day</span>
        </div>
        <div className="pe-pair" hidden={draft.allDay}>
          <div>
            <label className="fld-l" htmlFor={`${ids}-start`}>
              Start
            </label>
            <input
              className="fld"
              id={`${ids}-start`}
              type="time"
              value={draft.start}
              readOnly={frozen}
              onChange={(e) => onStart(e.target.value)}
            />
          </div>
          <div>
            <label className="fld-l" htmlFor={`${ids}-end`}>
              End
            </label>
            <input
              ref={endRef}
              className="fld"
              id={`${ids}-end`}
              type="time"
              value={draft.end}
              readOnly={frozen}
              aria-invalid={endError || undefined}
              aria-describedby={endError ? endErrId : undefined}
              onChange={(e) => change({ end: e.target.value, endEdited: true })}
            />
            {endError && (
              <p className="pe-said" id={endErrId}>
                {ERROR_SENTENCES["end-before-start"] /* deck §7 */}
              </p>
            )}
          </div>
        </div>
      </div>
      {shownSaid !== null && <p className="pe-said">{shownSaid}</p>}
      <div className="pe-acts">
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
          {busy ? "Adding…" : "Add" /* deck §7 */}
        </button>
      </div>
    </form>
  );
}
