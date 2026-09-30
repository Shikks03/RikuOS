"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ERROR_SENTENCES } from "@/lib/personalErrors";
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
 *
 * Nothing flips locally (R21): the tick shows what the server read, and the
 * refresh decides what comes back — on success and on failure alike.
 *
 * Outcomes render in `.fl-note` under the pressed row's name, never `.pe-said`
 * (R46: `pe-` is the Personal page's namespace). They stand until the next
 * press and do not survive a reload:
 *   - `Up to 10 calendars.` — an eleventh tick, refused before any request (R43);
 *   - `Couldn't save.` — the door answered and said no. Its 400s carry a
 *     sentence and no code, its 500 `code: "save-failed"`; deck §9 names one
 *     failure sentence for the card, so every non-2xx reads as it;
 *   - `Couldn't tell if that saved.` — no answer at all (a rejected fetch):
 *     the write may have landed, so the page does not claim it failed (deck
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
  const [isPending, startTransition] = useTransition();
  const busy = saving || isPending;

  async function press(row: PickerRow): Promise<void> {
    const next = pickerToggle(stored, row, limits);
    if (!next.ok) {
      setSaid({ calendarId: row.calendarId, text: next.note });
      return;
    }
    setSaving(true);
    setSaid(null);
    let text: string | null = null;
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layers: next.layers }),
      });
      if (!res.ok) text = ERROR_SENTENCES["save-failed"]; // deck §9
    } catch {
      text = ERROR_SENTENCES["calendar-unknown"]; // deck §15
    }
    if (text !== null) setSaid({ calendarId: row.calendarId, text });
    setSaving(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div>
      {rows.map((row) => (
        <div className="pickrow" key={row.calendarId}>
          <button
            type="button"
            className="tick"
            role="checkbox"
            aria-checked={row.ticked}
            aria-label={row.name}
            disabled={busy}
            onClick={() => void press(row)}
          >
            {row.ticked && (
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
      ))}
    </div>
  );
}
