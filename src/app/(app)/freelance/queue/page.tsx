"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
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

function withoutKey<V>(map: ReadonlyMap<string, V>, id: string): ReadonlyMap<string, V> {
  if (!map.has(id)) return map;
  const next = new Map(map);
  next.delete(id);
  return next;
}

/** The line at the top of the queue after a press (smooth-feel spec §6; F4 review, amendment 12(d)). */
function TopLine({ line, onFilter }: { line: QueueTopLine; onFilter: (f: ApprovedFilter) => void }) {
  if (line.kind === "unknown") {
    return (
      <p className="meta" role="status">
        {QUEUE_LINES.unknown}
      </p>
    );
  }
  if (line.kind === "refused") {
    // The door's own words, nothing added — the refused card may no longer be on screen to say them.
    return (
      <p className="error" role="status">
        {line.reason}
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
 * SMOOTH FEEL (spec §6; F4 review, amendment 12(d)). Approve, Approve edited
 * and Reject take the card off at once: it slides out (EXIT_MS, or at once
 * under reduced motion) and focus moves to the next card (not its Approve
 * button: a repeated Enter must never approve another draft), else the
 * previous card's, else the active filter. pressOutcome (L7) classifies the
 * answer and queueOutcome.ts decides: a refused decision brings the card back
 * with the door's words (an edit reopens with its own saved text); a saved
 * approval whose draft didn't reach ShikksTracker, or can't be told, says so
 * at the top with the filter it sits under; no answer says it couldn't tell.
 * A top line is only ever replaced by a newer non-null one — a later press
 * never silently clears an earlier warning — and is cleared only by the
 * q-link or a filter change. If a refused card's re-read then shows the
 * server no longer lists it (expired, or already decided), the refusal's
 * words move to the top line so they can't vanish along with the card.
 *
 * Every re-read after a decision is QUIET (no outline over a list already on
 * screen, deviation 10) and reports whether it landed: a card is only ever
 * settled (removed from `gone`) once a landed re-read has decided its fate,
 * never on a re-read that failed or was dropped — it then stays hidden until
 * the next loud load (a filter change or reload), and a dropped or failed
 * re-read after a restore still says the refusal at the top, so its reason
 * can never vanish either way. A load-sequence guard AND a filter guard
 * (`filterRef`, written only by the filter buttons and the q-link) drop a
 * stale response — one a newer request, or a filter change the response's
 * own filter no longer matches, has already overtaken — so a quiet re-read
 * can never repaint the list with the wrong filter's items. Initial loads
 * and filter changes draw the outline (spec §3.1), clear `top`, `gone`,
 * `leaving` and `cardSaid` for the new filter, and cancel every pending exit
 * timer so none can re-add an id to `gone` afterwards.
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
  const [editBodies, setEditBodies] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const [top, setTop] = useState<QueueTopLine | null>(null);
  const [cardSaid, setCardSaid] = useState<ReadonlyMap<string, string>>(() => new Map());
  const exits = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const seqRef = useRef(0);
  /** The filter actually chosen, written only by the filter buttons and the q-link, before setStatusFilter (F4 re-review). */
  const filterRef = useRef<StatusFilter>("pending");

  const refresh = useCallback(
    async (quiet = false): Promise<QueueItem[] | null> => {
      // Already out of date before it even claims a sequence number: a quiet re-read
      // whose filter the user has since left must never bump seqRef — doing so would
      // make the correct loud load's answer look stale and drop both of them.
      if (quiet && filterRef.current !== statusFilter) return null;
      const seq = ++seqRef.current;
      if (!quiet) {
        setLoading(true);
        setError(null);
        setTop(null);
        for (const t of exits.current.values()) clearTimeout(t);
        exits.current.clear();
        setLeaving(() => new Set());
        setGone(() => new Set());
        setCardSaid(() => new Map());
      }
      try {
        const res = await fetch(`/api/queue?status=${statusFilter}`);
        if (res.status === 401) {
          window.location.href = "/login?from=/freelance/queue";
          return null;
        }
        if (!res.ok) throw new Error();
        const body = (await res.json()) as { items: QueueItem[] };
        // A newer request has already answered, or this one's filter (the closure's
        // `statusFilter`) is no longer the one chosen (a filter change overtook it).
        if (seqRef.current !== seq || filterRef.current !== statusFilter) return null;
        setItems(body.items);
        if (quiet) setError(null); // cleared only after a successful read
        return body.items;
      } catch {
        if (seqRef.current !== seq || filterRef.current !== statusFilter) return null;
        setError("Could not load the queue.");
        return null;
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(
    () => () => {
      for (const t of exits.current.values()) clearTimeout(t);
    },
    [],
  );

  /** Focus the next card itself, else the previous card's, else the active filter — never a button inside one (S1, F4 safety ruling). */
  function focusAway(id: string) {
    const card = document.querySelector<HTMLElement>(`[data-card="${CSS.escape(id)}"]`);
    const at = document.activeElement;
    if (card !== null && at !== null && at !== document.body && !card.contains(at)) return;
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-card]")).filter(
      (c) => c === card || !c.classList.contains("is-leaving"),
    );
    const i = cards.findIndex((c) => c.dataset.card === id);
    const next = cards[i + 1] ?? cards[i - 1];
    if (next !== undefined) {
      next.focus();
      return;
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
    setCardSaid((m) => withoutKey(m, id));
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
      if (wasEditing) setEditingId(id); // its editBodies entry still holds the submitted text
    } else {
      if (result.top !== null) setTop(result.top); // never clear with null — a later press leaves an earlier warning up
      setEditBodies((m) => withoutKey(m, id)); // a decision that lands without restore needs its text no more
    }
    const fresh = await refresh(true);
    if (fresh !== null) {
      if (result.restore) {
        if (!fresh.some((item) => item._id === id)) {
          // The server no longer lists it (expired, or already decided elsewhere): the
          // refusal's reason moves to the top line so it can't vanish with the card.
          setTop({ kind: "refused", reason: result.reason });
          setCardSaid((m) => withoutKey(m, id));
        }
      } else {
        settleCard(id); // the re-read landed: it decides from here
      }
    } else if (result.restore) {
      // The re-read was dropped (a filter change overtook it) or failed outright: say the
      // refusal at the top too, so its reason can't vanish either way.
      setTop({ kind: "refused", reason: result.reason });
    }
    // else (not restore, fresh === null): the re-read was dropped or failed — the card
    // stays hidden until the next loud load (a filter change or reload).
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
      if (out.kind === "unknown") setTop({ kind: "unknown" });
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
            data-filter={s}
            className={s === statusFilter ? "" : "secondary"}
            aria-pressed={s === statusFilter}
            onClick={() => {
              filterRef.current = s;
              setStatusFilter(s);
            }}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {top !== null && (
        <TopLine
          line={top}
          onFilter={(f) => {
            filterRef.current = f;
            flushSync(() => {
              setTop(null);
              setStatusFilter(f);
            });
            document.querySelector<HTMLButtonElement>(`.q-filters [data-filter="${f}"]`)?.focus();
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
            <div
              key={item._id}
              data-card={item._id}
              tabIndex={-1}
              role="group"
              aria-label={item.title}
              className={leaving.has(item._id) ? "card is-leaving" : "card"}
            >
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
                      setEditBodies((m) => new Map(m).set(item._id, effective?.draftBody ?? ""));
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
                      value={editBodies.get(item._id) ?? ""}
                      onChange={(e) => setEditBodies((m) => new Map(m).set(item._id, e.target.value))}
                    />
                  </div>
                  <div className="row">
                    <button
                      disabled={busyId === item._id || (editBodies.get(item._id) ?? "").trim().length === 0}
                      onClick={() =>
                        void decide(item._id, { decision: "edit", draftBody: editBodies.get(item._id) ?? "" })
                      }
                    >
                      Approve edited
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setEditingId(null);
                        setEditBodies((m) => withoutKey(m, item._id));
                      }}
                    >
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
