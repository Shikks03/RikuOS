"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import PushControls from "./PushControls";

const STATUS_FILTERS = [
  "pending",
  "approved",
  "edited_approved",
  "rejected",
  "expired",
  "all",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

interface QueuePayload {
  contactName?: string;
  channel?: string;
  draftSubject?: string;
  draftBody?: string;
  replySnippet?: string;
  replyToLogId?: string;
}

interface QueueItem {
  _id: string;
  type: string;
  source: string;
  title: string;
  summary: string;
  status: string;
  actionStatus: string;
  actionError?: string;
  createdAt: string;
  staleAt?: string;
  payload?: QueuePayload;
  editedPayload?: QueuePayload;
}

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/queue?status=${statusFilter}`);
      if (res.status === 401) {
        window.location.href = "/login?from=/queue";
        return;
      }
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { items: QueueItem[] };
      setItems(body.items);
    } catch {
      setError("Could not load the queue.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function decide(id: string, payload: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/queue/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Decision failed.");
        return;
      }
      setEditingId(null);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main>
      <header className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1>{APP_NAME} — Queue</h1>
        <span className="row">
          <Link href="/settings">Settings</Link>
          <button className="secondary" onClick={() => void logout()}>
            Log out
          </button>
        </span>
      </header>

      <div className="row">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={s === statusFilter ? "" : "secondary"}
            onClick={() => setStatusFilter(s)}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading && <p className="meta">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="meta">No {statusFilter === "all" ? "" : `${statusFilter.replace("_", " ")} `}items.</p>
      )}

      {items.map((item) => {
        const effective = item.editedPayload ?? item.payload;
        return (
          <div key={item._id} className="card">
            <div className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
              <strong>{item.title}</strong>
              <span className="badge">
                {item.status.replace("_", " ")}
                {item.status !== "pending" && item.status !== "rejected" && item.status !== "expired"
                  ? ` · action ${item.actionStatus}`
                  : ""}
              </span>
            </div>
            <p className="meta">
              {item.source} · {item.type} · {new Date(item.createdAt).toLocaleString()}
            </p>
            <p>{item.summary}</p>
            {effective?.replySnippet && (
              <p className="meta">Their reply: “{effective.replySnippet}”</p>
            )}
            {effective?.draftSubject && <p className="meta">Subject: {effective.draftSubject}</p>}
            {effective?.draftBody && <pre className="body">{effective.draftBody}</pre>}
            {item.actionError && <p className="error">Action error: {item.actionError}</p>}

            {item.status === "pending" && editingId !== item._id && (
              <div className="row">
                <button
                  disabled={busyId === item._id}
                  onClick={() => void decide(item._id, { decision: "approve" })}
                >
                  Approve
                </button>
                <button
                  className="secondary"
                  disabled={busyId === item._id}
                  onClick={() => {
                    setEditingId(item._id);
                    setEditBody(effective?.draftBody ?? "");
                  }}
                >
                  Edit
                </button>
                <button
                  className="danger"
                  disabled={busyId === item._id}
                  onClick={() => void decide(item._id, { decision: "reject" })}
                >
                  Reject
                </button>
              </div>
            )}

            {item.status === "pending" && editingId === item._id && (
              <div>
                <div className="row">
                  <textarea
                    rows={6}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                  />
                </div>
                <div className="row">
                  <button
                    disabled={busyId === item._id || editBody.trim().length === 0}
                    onClick={() => void decide(item._id, { decision: "edit", draftBody: editBody })}
                  >
                    Approve edited
                  </button>
                  <button className="secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <PushControls />
    </main>
  );
}
