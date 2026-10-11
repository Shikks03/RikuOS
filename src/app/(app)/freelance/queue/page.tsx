"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PRESS_TIMEOUT_MS } from "@/lib/constants";
import { doorSentence } from "@/lib/doorSentence";
import { pressOutcome } from "@/lib/pressOutcome";
import { FILTER_LABEL, QUEUE_LINES, decideResult, type ApprovedFilter, type QueueTopLine } from "@/lib/queueOutcome";
import { CardsOutline } from "../../_shell/Outline";
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

/** The card's exit (smooth-feel spec §6): legacy.css's `.card.is-leaving` runs this long. */
const EXIT_MS = 200;

function reducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function withId(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  return set.has(id) ? set : new Set(set).add(id);
}

function withoutId(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

/** The line at the top of the queue after a press (spec §6). */
function TopLine({ line, onFilter }: { line: QueueTopLine; onFilter: (f: ApprovedFilter) => void }) {
  if (line.kind === "unknown") {
    return (
      <p className="meta" role="status">
        {QUEUE_LINES.unknown}
      </p>
    );
  }
  const words = line.kind === "action-failed" ? QUEUE_LINES.actionFailed : QUEUE_LINES.needsVerification;
  return (
    <p className="error" role="status">
      {words.lead}
      <button type="button" className="q-link" onClick={() => onFilter(line.filter)}>
        {FILTER_LABEL[line.filter]}
      </button>
      {words.tail}
    </p>
  );
}

/**
 * The approval queue (still P3's plain view; its redesign is P12's).
 *
 * SMOOTH FEEL (spec §6). Approve, Approve edited and Reject take the card
 * off at once: it slides out (EXIT_MS, or at once under reduced motion) and
 * focus moves to the next card's first button, else the previous card's,
 * else the active filter (S1). pressOutcome (L7) classifies the answer and
 * queueOutcome.ts decides: a refused decision brings the card back with the
 * door's words (an edit reopens with its text); a saved approval whose draft
 * didn't reach ShikksTracker, or can't be told, says so at the top with the
 * filter it sits under; no answer says it couldn't tell. Then the list
 * re-reads QUIETLY (no outline over a list already on screen, deviation 10)
 * and the server decides: a card no longer pending is not in the list; one
 * that still is (a press that never landed) comes back. Initial loads and
 * filter changes draw the outline (spec §3.1).
 *
 * The mount-time load in an effect is one of the four baseline lint errors
 * and keeps its shape on purpose.
 */
export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const [top, setTop] = useState<QueueTopLine | null>(null);
  const [cardSaid, setCardSaid] = useState<ReadonlyMap<string, string>>(() => new Map());
  const exits = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const refresh = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/queue?status=${statusFilter}`);
        if (res.status === 401) {
          window.location.href = "/login?from=/freelance/queue";
          return;
        }
        if (!res.ok) throw new Error();
        const body = (await res.json()) as { items: QueueItem[] };
        setItems(body.items);
      } catch {
        setError("Could not load the queue.");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** S1: only when focus was in the leaving card, or nowhere. */
  function focusAway(id: string) {
    const card = document.querySelector<HTMLElement>(`[data-card="${CSS.escape(id)}"]`);
    const at = document.activeElement;
    if (card !== null && at !== null && at !== document.body && !card.contains(at)) return;
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-card]")).filter(
      (c) => c === card || !c.classList.contains("is-leaving"),
    );
    const i = cards.findIndex((c) => c.dataset.card === id);
    for (const c of [cards[i + 1], cards[i - 1]]) {
      const b = c?.querySelector<HTMLButtonElement>("button:not(:disabled)");
      if (b) {
        b.focus();
        return;
      }
    }
    document.querySelector<HTMLButtonElement>(".q-filters button[aria-pressed='true']")?.focus();
  }

  function stopExit(id: string) {
    const t = exits.current.get(id);
    if (t !== undefined) {
      clearTimeout(t);
      exits.current.delete(id);
    }
  }

  function leave(id: string) {
    focusAway(id);
    setLeaving((s) => withId(s, id));
    const t = setTimeout(
      () => {
        exits.current.delete(id);
        setGone((s) => withId(s, id));
        setLeaving((s) => withoutId(s, id));
      },
      reducedMotion() ? 0 : EXIT_MS,
    );
    exits.current.set(id, t);
  }

  function settleCard(id: string) {
    stopExit(id);
    setLeaving((s) => withoutId(s, id));
    setGone((s) => withoutId(s, id));
  }

  async function decide(id: string, payload: Record<string, unknown>) {
    if (busyId === id) return;
    const wasEditing = editingId === id;
    setBusyId(id);
    setTop(null);
    setCardSaid((m) => {
      if (!m.has(id)) return m;
      const next = new Map(m);
      next.delete(id);
      return next;
    });
    leave(id);
    if (wasEditing) setEditingId(null);
    const out = await pressOutcome(
      fetch(`/api/queue/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }),
    );
    const result = decideResult(out);
    if (result.restore) {
      settleCard(id); // the card comes back, in its place
      setCardSaid((m) => new Map(m).set(id, result.reason));
      if (wasEditing) setEditingId(id); // the edited text is still in editBody
    } else {
      setTop(result.top);
    }
    await refresh(true);
    if (!result.restore) settleCard(id); // the re-read decides from here
    setBusyId(null);
  }

  async function retry(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const out = await pressOutcome(
        fetch(`/api/queue/${id}/retry`, { method: "POST", signal: AbortSignal.timeout(PRESS_TIMEOUT_MS) }),
      );
      if (out.kind === "failed") {
        setError(doorSentence(out));
        return;
      }
      if (out.kind === "unknown") setError(out.sentence);
      await refresh(true);
    } finally {
      setBusyId(null);
    }
  }

  const shown = items.filter((item) => !gone.has(item._id));

  return (
    <main>
      <div className="row q-filters">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={s === statusFilter ? "" : "secondary"}
            aria-pressed={s === statusFilter}
            onClick={() => setStatusFilter(s)}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {top !== null && (
        <TopLine
          line={top}
          onFilter={(f) => {
            setTop(null);
            setStatusFilter(f);
          }}
        />
      )}
      {loading && <CardsOutline labels={[null, null]} />}
      {error && <p className="error">{error}</p>}
      {!loading && !error && shown.length === 0 && (
        <p className="meta">No {statusFilter === "all" ? "" : `${statusFilter.replace("_", " ")} `}items.</p>
      )}

      {!loading &&
        shown.map((item) => {
          const effective = item.editedPayload ?? item.payload;
          const said = cardSaid.get(item._id);
          return (
            <div key={item._id} data-card={item._id} className={leaving.has(item._id) ? "card is-leaving" : "card"}>
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
              {effective?.replySnippet && <p className="meta">Their reply: “{effective.replySnippet}”</p>}
              {effective?.draftSubject && <p className="meta">Subject: {effective.draftSubject}</p>}
              {effective?.draftBody && <pre className="body">{effective.draftBody}</pre>}
              {item.actionError && (
                <p className={item.actionStatus === "done" ? "meta" : "error"}>
                  {item.actionStatus === "done" ? "Note: " : "Action error: "}
                  {item.actionError}
                </p>
              )}

              {item.actionStatus === "failed" && (
                <div className="row">
                  <button className="secondary" disabled={busyId === item._id} onClick={() => void retry(item._id)}>
                    Retry action
                  </button>
                </div>
              )}

              {item.actionStatus === "needs_verification" && (
                <p className="error">
                  This may or may not have reached ShikksTracker. Open the contact there and check
                  whether the draft exists before doing anything else. There is no retry button on
                  purpose.
                </p>
              )}

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
                    <textarea rows={6} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
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

              {said !== undefined && <p className="error">{said}</p>}
            </div>
          );
        })}

      <PushControls />
    </main>
  );
}
