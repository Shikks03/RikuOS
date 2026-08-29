"use client";

import { useEffect, useState } from "react";

/** Standard conversion of a base64url VAPID key for pushManager.subscribe. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type PushStatus = "checking" | "unsupported" | "idle" | "subscribed" | "error";

export default function PushControls() {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // On iOS this is the not-installed-to-home-screen case too.
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "subscribed" : "idle");
      })
      .catch(() => setStatus("error"));
  }, []);

  // Must be called from a user gesture (iOS requirement) — hence a button.
  async function enable() {
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Notifications were not allowed.");
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setMessage("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setStatus("subscribed");
      setMessage("This device is registered for notifications.");
    } catch {
      setMessage("Could not enable notifications.");
    }
  }

  async function sendTest() {
    setMessage(null);
    const res = await fetch("/api/push/test", { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { sent?: number; error?: string };
    setMessage(
      res.ok
        ? `Test sent to ${body.sent} device${body.sent === 1 ? "" : "s"}.`
        : body.error ?? "Test push failed."
    );
  }

  return (
    <div className="card">
      <p className="meta">Notifications</p>
      {status === "checking" && <p className="meta">Checking…</p>}
      {status === "unsupported" && (
        <p className="meta">
          Push is unavailable here. On iPhone, install the app to the home screen first
          (Share → Add to Home Screen) and open it from its icon.
        </p>
      )}
      {status === "error" && <p className="error">Service worker registration failed.</p>}
      {(status === "idle" || status === "subscribed") && (
        <div className="row">
          {status === "idle" && <button onClick={() => void enable()}>Enable notifications</button>}
          {status === "subscribed" && (
            <>
              <button className="secondary" onClick={() => void sendTest()}>
                Send test push
              </button>
              {/*
                This device can be "subscribed" here while the SERVER has no row
                for it: the push service returns 410 for a lapsed endpoint and
                sendPushToAll prunes it, but the browser keeps its own
                subscription object, so the enable button above stays hidden.
                Without this the morning digest would report reaching no device
                every day with no way to recover from the UI. Re-registering is
                idempotent — pushManager.subscribe returns the existing
                subscription and /api/push/subscribe upserts by endpoint.
              */}
              <button className="secondary" onClick={() => void enable()}>
                Re-register this device
              </button>
            </>
          )}
        </div>
      )}
      {message && <p className="meta">{message}</p>}
    </div>
  );
}
