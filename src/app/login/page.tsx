"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("/queue");

  // Read ?from= redirect param once on mount.
  // Resolve against our own origin and re-check it — string checks alone are
  // not enough (browsers normalize "/\evil.com" and "//evil.com" to external
  // URLs).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const f = params.get("from");
    if (!f || !f.startsWith("/")) return;
    try {
      const resolved = new URL(f, window.location.origin);
      if (resolved.origin === window.location.origin) {
        setFrom(resolved.pathname + resolved.search);
      }
    } catch {
      // malformed value — keep the "/queue" default
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.href = from;
        return;
      }

      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Login failed");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>{APP_NAME}</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
          required
        />
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" disabled={loading || !password}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </main>
  );
}
