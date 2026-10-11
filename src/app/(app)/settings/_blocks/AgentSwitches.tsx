"use client";

import { useCallback, useEffect, useState } from "react";
import { PRESS_TIMEOUT_MS } from "@/lib/constants";
import { doorSentence } from "@/lib/doorSentence";
import { movedAfter, shownOn, type Moved } from "@/lib/instantSwitch";
import { pressOutcome } from "@/lib/pressOutcome";
import { CardsOutline } from "../../_shell/Outline";

interface Settings {
  chaserEnabled: boolean;
  chaserNDays: number;
  monitoringEnabled: boolean;
}

type SwitchKey = "chaserEnabled" | "monitoringEnabled";

/** The door's success body, checked before it is trusted (pressOutcome hands it back unvalidated). */
function settingsOf(body: unknown): Settings | null {
  if (typeof body !== "object" || body === null) return null;
  const s = (body as { settings?: unknown }).settings;
  if (typeof s !== "object" || s === null) return null;
  const { chaserEnabled, chaserNDays, monitoringEnabled } = s as Record<string, unknown>;
  if (typeof chaserEnabled !== "boolean" || typeof chaserNDays !== "number" || typeof monitoringEnabled !== "boolean") {
    return null;
  }
  return { chaserEnabled, chaserNDays, monitoringEnabled };
}

/**
 * P3's two agent cards. Smooth feel (spec §5, instantSwitch.ts): the chaser
 * and monitoring buttons flip on press — the button's word and `Currently
 * on/off` follow at once — and pressOutcome (L7) decides what the answer
 * means: ok shows the door's settings; a definite failure flips back with the
 * door's sentence (doorSentence); no answer keeps the flip, says `Couldn't
 * tell if that saved.`, and re-reads, so the server decides where it sits.
 * The threshold's Save is not a switch and does not flip. While loading, the
 * two cards draw as their outline (spec §3.1).
 *
 * The mount-time load in an effect is one of the four baseline lint errors
 * and keeps its shape on purpose.
 */
export default function AgentSwitches() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [days, setDays] = useState("4");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [moved, setMoved] = useState<Moved<SwitchKey> | null>(null);

  /** true when the read landed. */
  const load = useCallback(async (): Promise<boolean> => {
    setError(null);
    const res = await fetch("/api/settings");
    if (res.status === 401) {
      window.location.href = "/login?from=/settings";
      return false;
    }
    if (!res.ok) {
      setError("Could not load settings.");
      return false;
    }
    const body = (await res.json()) as { settings: Settings };
    setSettings(body.settings);
    setDays(String(body.settings.chaserNDays));
    return true;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(payload: Record<string, unknown>, flip: Moved<SwitchKey> | null = null) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    setMoved(flip);
    const out = await pressOutcome(
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }),
    );
    setMoved((m) => movedAfter(out.kind, m));
    if (out.kind === "ok") {
      const next = settingsOf(out.body);
      if (next !== null) {
        setSettings(next);
        setDays(String(next.chaserNDays));
        setSaved("Saved.");
      } else {
        await load(); // a success body this card can't read: re-read rather than guess
      }
    } else if (out.kind === "failed") {
      setError(doorSentence(out));
    } else {
      // No answer: the press may have landed. The re-read decides the switch.
      const read = await load();
      if (read) setError(out.sentence);
    }
    setMoved(null);
    setBusy(false);
  }

  if (!settings) {
    return (
      <>
        {error && <p className="error">{error}</p>}
        {!error && <CardsOutline labels={["Follow-up chaser", "Monitoring"]} />}
      </>
    );
  }

  const chaserOn = shownOn("chaserEnabled", settings.chaserEnabled, moved, busy);
  const monitoringOn = shownOn("monitoringEnabled", settings.monitoringEnabled, moved, busy);

  return (
    <>
      {error && <p className="error">{error}</p>}
      {saved && <p className="meta">{saved}</p>}

      <div className="card">
        <p className="meta">Follow-up chaser</p>
        <p>
          Currently <strong>{chaserOn ? "on" : "off"}</strong>. When on, it runs
          once each morning, drafts a reply for every lead who answered and got no response,
          and queues each one here for approval. It never sends anything by itself.
        </p>
        <div className="row">
          <button
            disabled={busy}
            className={chaserOn ? "danger" : ""}
            onClick={() => void patch({ chaserEnabled: !chaserOn }, { key: "chaserEnabled", on: !chaserOn })}
          >
            {chaserOn ? "Turn the chaser off" : "Turn the chaser on"}
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <label htmlFor="days">
            Chase a lead once they have waited this many days (1–30)
          </label>
          <input
            id="days"
            type="number"
            min={1}
            max={30}
            step={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
          <div className="row">
            <button
              disabled={busy || days === String(settings.chaserNDays)}
              onClick={() => void patch({ chaserNDays: Number(days) })}
            >
              Save threshold
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="meta">Monitoring</p>
        <p>
          Currently <strong>{monitoringOn ? "on" : "off"}</strong>. When on, each
          morning it checks that every agent actually ran, that the client sites are up, and
          sends you one summary — even when nothing is wrong, so a missing notification is
          itself a warning. Turning it off silences that summary. Stale queue items are still
          cleared either way, and you are still told if that clean-up fails or leaves an
          approved action it could not confirm.
        </p>
        <div className="row">
          <button
            disabled={busy}
            className={monitoringOn ? "danger" : ""}
            onClick={() =>
              void patch({ monitoringEnabled: !monitoringOn }, { key: "monitoringEnabled", on: !monitoringOn })
            }
          >
            {monitoringOn ? "Turn monitoring off" : "Turn monitoring on"}
          </button>
        </div>
      </div>
    </>
  );
}
