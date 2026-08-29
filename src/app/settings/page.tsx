"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

interface Settings {
  chaserEnabled: boolean;
  chaserNDays: number;
  monitoringEnabled: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [days, setDays] = useState("4");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/settings");
    if (res.status === 401) {
      window.location.href = "/login?from=/settings";
      return;
    }
    if (!res.ok) {
      setError("Could not load settings.");
      return;
    }
    const body = (await res.json()) as { settings: Settings };
    setSettings(body.settings);
    setDays(String(body.settings.chaserNDays));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        settings?: Settings;
        error?: string;
      };
      if (!res.ok || !body.settings) {
        setError(body.error ?? "Could not save.");
        return;
      }
      setSettings(body.settings);
      setDays(String(body.settings.chaserNDays));
      setSaved("Saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1>{APP_NAME} — Settings</h1>
        <Link href="/queue">Queue</Link>
      </header>

      {error && <p className="error">{error}</p>}
      {saved && <p className="meta">{saved}</p>}
      {!settings && !error && <p className="meta">Loading…</p>}

      {settings && (
        <>
        <div className="card">
          <p className="meta">Follow-up chaser</p>
          <p>
            Currently <strong>{settings.chaserEnabled ? "on" : "off"}</strong>. When on, it runs
            once each morning, drafts a reply for every lead who answered and got no response,
            and queues each one here for approval. It never sends anything by itself.
          </p>
          <div className="row">
            <button
              disabled={busy}
              className={settings.chaserEnabled ? "danger" : ""}
              onClick={() => void patch({ chaserEnabled: !settings.chaserEnabled })}
            >
              {settings.chaserEnabled ? "Turn the chaser off" : "Turn the chaser on"}
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
            Currently <strong>{settings.monitoringEnabled ? "on" : "off"}</strong>. When on, each
            morning it checks that every agent actually ran, that the client sites are up, and
            sends you one summary — even when nothing is wrong, so a missing notification is
            itself a warning. Turning it off silences that summary; stale queue items are still
            cleared either way.
          </p>
          <div className="row">
            <button
              disabled={busy}
              className={settings.monitoringEnabled ? "danger" : ""}
              onClick={() => void patch({ monitoringEnabled: !settings.monitoringEnabled })}
            >
              {settings.monitoringEnabled ? "Turn monitoring off" : "Turn monitoring on"}
            </button>
          </div>
        </div>
        </>
      )}
    </main>
  );
}
