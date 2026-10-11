"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PRESS_TIMEOUT_MS } from "@/lib/constants";
import { movedAfter, shownOn, type Moved } from "@/lib/instantSwitch";
import { pressOutcome } from "@/lib/pressOutcome";
import { pickerToggle, type PickerLimits, type PickerRow } from "@/lib/personalView";
import type { Layer } from "@/lib/osSettings";

/**
 * The `Calendar layers` picker (deck §9, visual spec §4.10). The rows are the
 * server's — pickerRows() joined the stored layers against the one
 * listCalendars() answer — and this island owns only the press.
 *
 * A tap PATCHes /api/settings with the WHOLE `layers` array (the door replaces
 * it whole), built by pickerToggle() from the stored array the server read.
 * Saved on tap; EVERY box is disabled while a save and its refresh are in
 * flight, not only the tapped one: two whole-array PATCHes built from the
 * same stored array would each drop the other's change. `busy` covers the
 * refresh too, through useTransition (router.refresh() returns before the
 * server render lands), so a box never re-enables showing the old state.
 * Busy is `aria-disabled` plus a guard in the handler, never `disabled` (L9):
 * `disabled` on the focused box would send focus to <body>. The dim is the
 * same (`.tick[aria-disabled="true"]`, L1c).
 *
 * The tick flips on the tap (smooth-feel spec §5, instantSwitch.ts — this
 * supersedes R21's "nothing flips locally" for switches): a definite failure
 * flips it back with `Couldn't save.`; no answer leaves it where it was put
 * with `Couldn't tell if that saved.`; once the refresh lands the tick shows
 * what the server read. The next tap builds from `stored`, so if a refresh
 * fails to land, that tap is last-write-wins over stale data (accepted,
 * §7.5). A refusal made before any request (`Up to 10 calendars.`) never
 * flips.
 *
 * Outcomes render in `.fl-note` under the pressed row's name, never in the
 * Personal page's own classes (R46: its prefix is that page's alone). They
 * stand until the next press and do not survive a reload:
 *   - `Up to 10 calendars.` — an eleventh tick, refused before any request (R43);
 *   - `Couldn't save.` / `Couldn't tell if that saved.` — pressOutcome's one
 *     rule (L7): only the door's own JSON answer is a definite failure; a
 *     timeout (PRESS_TIMEOUT_MS), a network rejection or a platform error
 *     page may follow a write that landed, so it never claims failure (deck
 *     §15, CLAUDE.md's asymmetric rule).
 * An expired session is answered by the refresh itself: proxy.ts sends it to
 * /login.
 */
export default function CalendarPicker({
  rows,
  stored,
  limits,
}: {
  rows: PickerRow[];
  stored: Layer[];
  limits: PickerLimits;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState<{ calendarId: string; text: string } | null>(null);
  const [moved, setMoved] = useState<Moved | null>(null);
  const [isPending, startTransition] = useTransition();
  const busy = saving || isPending;

  async function press(row: PickerRow): Promise<void> {
    if (busy) return; // aria-disabled does not stop a click (L9)
    const next = pickerToggle(stored, row, limits);
    if (!next.ok) {
      setSaid({ calendarId: row.calendarId, text: next.note });
      return;
    }
    setSaving(true);
    setSaid(null);
    setMoved({ key: row.calendarId, on: !row.ticked });
    const out = await pressOutcome(
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layers: next.layers }),
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }),
    );
    setMoved((m) => movedAfter(out.kind, m)); // a definite failure returns the tick (smooth-feel §5)
    if (out.kind !== "ok") setSaid({ calendarId: row.calendarId, text: out.sentence }); // deck §9, §15
    setSaving(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div>
      {rows.map((row) => {
        const ticked = shownOn(row.calendarId, row.ticked, moved, busy);
        return (
          <div className="pickrow" key={row.calendarId}>
            <button
              type="button"
              className="tick"
              role="checkbox"
              aria-checked={ticked}
              aria-label={row.name}
              aria-disabled={busy}
              onClick={() => void press(row)}
            >
              {ticked && (
                <svg
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 5.3l2 2L8 2.7" />
                </svg>
              )}
            </button>
            <span>
              {row.name}
              {row.note !== null && <span className="fl-note">{row.note}</span>}
              {said?.calendarId === row.calendarId && <span className="fl-note">{said.text}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
