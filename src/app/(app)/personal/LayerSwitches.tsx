"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PRESS_TIMEOUT_MS } from "@/lib/constants";
import { pressOutcome } from "@/lib/pressOutcome";
import type { LayersTileView } from "@/lib/personalView";

type LayerRow = LayersTileView["rows"][number];

/**
 * Tile 3's switches (deck §6 Tile 3, visual spec §4.3, R15): the WHOLE row is
 * the switch — `<button role="switch">` holding the name and the `.swx` pill.
 * The rows are the server's, in stored order; this island owns only the press.
 *
 * A tap PATCHes /api/settings with the WHOLE `layers` array (the door replaces
 * it whole), built from the rows the server read — which are every stored
 * layer, with every stored field. The same door and the same body as the
 * Settings picker (CalendarPicker.tsx), so the two agree.
 *
 * EVERY switch is disabled while a save and its refresh are in flight, not
 * only the tapped one, as the Settings picker does: two whole-array PATCHes
 * built from the same rows would each drop the other's change. `busy` covers
 * the refresh too, through useTransition (router.refresh() returns before the
 * server render lands).
 *
 * The knob (deck §6 Tile 3, §15; plan Task 7 Step 2):
 *   - moves on the tap, and holds while busy;
 *   - a DEFINITE failure (the door's own answer, via pressOutcome) returns it
 *     at once and says `Couldn't save.` under the row;
 *   - an UNKNOWN outcome (timeout, network, a platform error page) does NOT
 *     return it — a request that got no answer may have landed — and says
 *     `Couldn't tell if that saved.` under the row;
 *   - either way the page re-reads, and once the refresh lands the knob shows
 *     what the server read: the local position is shown only while busy.
 * The outcome stands until the next press and does not survive a reload.
 *
 * ZERO effects (R33).
 */
export default function LayerSwitches({ rows }: { rows: LayerRow[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [moved, setMoved] = useState<{ calendarId: string; enabled: boolean } | null>(null);
  const [said, setSaid] = useState<{ calendarId: string; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const busy = saving || isPending;

  async function press(row: LayerRow): Promise<void> {
    const enabled = !row.enabled;
    const layers = rows.map((r) => ({
      calendarId: r.calendarId,
      name: r.name,
      enabled: r.calendarId === row.calendarId ? enabled : r.enabled,
    }));
    setSaving(true);
    setSaid(null);
    setMoved({ calendarId: row.calendarId, enabled });
    const out = await pressOutcome(
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layers }),
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }),
    );
    if (out.kind === "failed") setMoved(null); // the knob returns (deck §6 Tile 3)
    if (out.kind !== "ok") setSaid({ calendarId: row.calendarId, text: out.sentence }); // deck §6 Tile 3, §15
    setSaving(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="pe-layers">
      {rows.map((row) => {
        const on = busy && moved?.calendarId === row.calendarId ? moved.enabled : row.enabled;
        return (
          <Fragment key={row.calendarId}>
            <button
              type="button"
              className="pe-sw"
              role="switch"
              aria-checked={on}
              disabled={busy}
              onClick={() => void press(row)}
            >
              <span className="nm">{row.name}</span>
              <span className={on ? "swx on" : "swx"}>
                <b></b>
              </span>
            </button>
            {said?.calendarId === row.calendarId && <p className="pe-said">{said.text}</p>}
          </Fragment>
        );
      })}
    </div>
  );
}
