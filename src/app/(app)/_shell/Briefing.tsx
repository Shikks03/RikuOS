"use client";

/**
 * Briefing — the assistant's greeting line, the full-screen greeting, the
 * panel and the cause card (S21, spec §5), and the Debrief inside the panel
 * (S22). One island in the shell.
 *
 * Native <dialog> + showModal() gives the focus trap, Esc, and an inert page
 * behind it for free; Esc (`cancel`) and a backdrop click are routed through
 * close() so the shrink animation always runs. Focus returns to the line.
 *
 * STATE: `open`, `pane`, `press` and the local Debrief change only in
 * handlers (or the dialog's own `onClose`, fix round item 7 — see below); the
 * first `open` comes from the initialiser (today's unseen Briefing, or
 * ?briefing=open from the push). Effects only touch the DOM, write a ref, or
 * add/remove a listener. "Since then" is fetched on every open and set only in
 * the fetch's async callback (the lint baseline holds).
 *
 * THE DEBRIEF (S22). "Debrief now" sits at the foot of the PANEL only — never
 * the once-a-day full-screen greeting, which stays the 07:00 Briefing's (D4).
 * A press is one POST; the button is disabled while it runs and a ref guards
 * a double click inside one render. The answer is shown from the response
 * itself (so a Debrief whose save failed is still seen, with the note), then
 * router.refresh() asks the server for the greeting line again — also after a
 * failure, since a press the browser gave up on may still have finished and
 * saved (D7). Closing the panel never aborts the request. The panel swaps
 * between the Debrief and this morning's Briefing in place, without closing.
 *
 * STALENESS (fix round item 5). BriefingSlot sits in the (app) layout, which
 * Next does not re-render on a soft navigation, and an installed PWA can be
 * resumed by the OS long after its last foreground with that render still in
 * memory. Two defences: BriefingSlot keys this island on the Briefing's
 * `sentAtIso`, so a new morning's digest remounts it and its initialiser
 * decides auto-open afresh; and here, regaining visibility after a long gap
 * since the last fresh props (`briefingRefresh.ts`'s pure rule) asks the
 * server again with `router.refresh()`.
 *
 * DOUBLE-CLOSE (fix round item 6). close()/closeCard() run an awaited shrink
 * animation before touching the dialog; a second tap, a backdrop click during
 * the shrink, or two Escapes in a row must not run that twice (it would
 * re-send the seen POST and re-focus mid-animation). A `closing` ref per
 * dialog guards it, and the dialog is `inert` while it shrinks so a tap on a
 * row underneath cannot open a card mid-close.
 */

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PRESS_TIMEOUT_MS } from "@/lib/constants";
import { shouldRefreshOnVisible } from "@/lib/briefingRefresh";
import { buildDebriefView, parseDebriefResponse, type DebriefRow, type DebriefView } from "@/lib/debriefView";
import type { BriefingView, GreetingLine, Segment, SymptomView } from "@/lib/briefingView";
import { growFrom, shrinkTo } from "./flip";

type Open = null | "full" | "panel";
type Pane = "morning" | "debrief";
type Since = { kind: "loading" } | { kind: "lines"; lines: string[] } | { kind: "failed" };
type Press = { kind: "idle" } | { kind: "waiting" } | { kind: "failed" };
type OpenCard = (e: MouseEvent<HTMLButtonElement>, symptom: SymptomView) => void;

/** The newer of two Debrief views; ISO instants compare correctly as strings. */
function newer(a: DebriefView | null, b: DebriefView | null): DebriefView | null {
  if (a === null) return b;
  if (b === null) return a;
  return a.atIso >= b.atIso ? a : b;
}

function Said({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))}
    </>
  );
}

function Row({ row, onCard }: { row: DebriefRow; onCard: OpenCard }) {
  return (
    <li>
      <button type="button" className="bf-row" onClick={(e) => onCard(e, row.symptom)}>
        <span className="bf-said">
          <Said segments={row.symptom.sentence} />
        </span>
        {row.note !== null && <span className="bf-note">{row.note}</span>}
        <span className="bf-next">{row.symptom.nextStep}</span>
      </button>
    </li>
  );
}

function DebriefBody({ d, onCard }: { d: DebriefView; onCard: OpenCard }) {
  const c = d.comparison;
  return (
    <>
      {c.kind === "since" ? (
        <section className="bf-sec">
          <h3 className="bf-h">{c.heading}</h3>
          {c.allClear !== null && <p className="bf-p">{c.allClear}</p>}
          {c.sorted.length > 0 && (
            <div className="bf-group">
              <h4 className="bf-g">Sorted</h4>
              <ul className="bf-stories">
                {c.sorted.map((s, i) => (
                  <li key={i} className="bf-sorted">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {c.still.length > 0 && (
            <div className="bf-group">
              <h4 className="bf-g">Still needs you</h4>
              <ul className="bf-stories">
                {c.still.map((r) => (
                  <Row key={r.symptom.id} row={r} onCard={onCard} />
                ))}
              </ul>
            </div>
          )}
          {(c.fresh.length > 0 || c.standalone.length > 0) && (
            <div className="bf-group">
              <h4 className="bf-g">New</h4>
              <ul className="bf-stories">
                {c.fresh.map((r) => (
                  <Row key={r.symptom.id} row={r} onCard={onCard} />
                ))}
                {c.standalone.map((s, i) => (
                  <li key={`standalone-${i}`} className="bf-sorted is-blind">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <section className="bf-sec">
          <h3 className="bf-h">{c.heading}</h3>
          {c.empty !== null && <p className="bf-p">{c.empty}</p>}
          {(c.rows.length > 0 || c.standalone.length > 0) && (
            <ul className="bf-stories">
              {c.rows.map((r) => (
                <Row key={r.symptom.id} row={r} onCard={onCard} />
              ))}
              {c.standalone.map((s, i) => (
                <li key={`standalone-${i}`} className="bf-sorted is-blind">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {d.done.length > 0 && (
        <section className="bf-sec">
          <h3 className="bf-h">What you’ve done</h3>
          {d.done.map((l, i) => (
            <p key={i} className="bf-p">
              {l}
            </p>
          ))}
        </section>
      )}
      {(d.today !== "" || d.freelance !== null || d.off !== null) && (
        <section className="bf-sec">
          <h3 className="bf-h">Rest of today</h3>
          {d.today !== "" && <p className="bf-p">{d.today}</p>}
          {d.freelance !== null && <p className="bf-p">{d.freelance}</p>}
          {d.off !== null && <p className="bf-p">{d.off}</p>}
        </section>
      )}
    </>
  );
}

export default function Briefing({
  line,
  view,
  debrief,
  autoOpen,
}: {
  line: GreetingLine;
  view: BriefingView | null;
  /** Today's saved Debrief, from the server (S22); null when there is none today. */
  debrief: DebriefView | null;
  autoOpen: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const forced = params.get("briefing") === "open";
  // A Debrief this island pressed for itself. Kept even when its save failed —
  // then it is the only copy (spec §6).
  const [localDebrief, setLocalDebrief] = useState<DebriefView | null>(null);
  const shownDebrief = newer(localDebrief, debrief);
  const canOpen = (line.opens === "digest" && view !== null) || (line.opens === "debrief" && shownDebrief !== null);
  // The full-screen greeting is the 07:00 Briefing's alone (D4), and keeps
  // S21's exact rule either way in here (S22 fix round item 3, then its
  // own re-review): never for `unsaved` — a briefing that went out but
  // couldn't be saved has nothing of today's to greet with full-screen,
  // `opens: "digest"` on that state exists only so tapping the LINE can
  // still reach the panel and the older Briefing inside it (deviation 7) —
  // and, through a Debrief line, only when today's Briefing actually
  // exists (`view.isToday`), so a 02:00 Debrief can't full-screen-greet on
  // yesterday's Briefing once Riku taps that morning's push. Deviation 7
  // widens the PANEL only.
  const [open, setOpen] = useState<Open>(
    () =>
      view !== null &&
      ((line.opens === "digest" && line.kind !== "unsaved") || (line.opens === "debrief" && view.isToday)) &&
      (forced || autoOpen)
        ? "full"
        : null,
  );
  const [pane, setPane] = useState<Pane>("morning");
  const [since, setSince] = useState<Since>({ kind: "loading" });
  const [card, setCard] = useState<SymptomView | null>(null);
  const [press, setPress] = useState<Press>({ kind: "idle" });
  const [unsavedAt, setUnsavedAt] = useState<string | null>(null);
  const lineRef = useRef<HTMLButtonElement>(null);
  const dlgRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardFrom = useRef<HTMLButtonElement | null>(null);
  const seenSent = useRef(false);
  const closingMain = useRef(false);
  const closingCard = useRef(false);
  const pressing = useRef(false);
  // null until the mount effect below sets it — Date.now() is impure and
  // must not run during render (react-hooks/purity), so the initial value
  // comes from the effect, which also runs once on mount.
  const lastPropsAt = useRef<number | null>(null);
  const titleId = useId();
  const cardTitleId = useId();

  // What the panel shows. The full-screen greeting is always the morning; the
  // morning needs a view; the Debrief needs one to show.
  const showing: Pane =
    open === "full" || shownDebrief === null ? "morning" : pane === "debrief" || view === null ? "debrief" : "morning";
  const debriefShown = showing === "debrief" ? shownDebrief : null;
  const morningShown = showing === "morning" ? view : null;

  // DOM/ref only: remembers when the props last arrived fresh from the
  // server, so a later visibilitychange can judge staleness (fix round
  // item 5b). Writes a ref, never state.
  useEffect(() => {
    lastPropsAt.current = Date.now();
  }, [line, view, debrief]);

  // Resuming an installed PWA fires visibilitychange, not a navigation —
  // the shell's props can be hours stale. Ask the server again only past the
  // threshold, so a brief app switch never re-fetches (fix round item 5b).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      const last = lastPropsAt.current;
      if (last !== null && shouldRefreshOnVisible(last, Date.now())) router.refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  // DOM only: show the dialog when state says so, grown from the line.
  useEffect(() => {
    const dlg = dlgRef.current;
    if (!dlg || open === null || dlg.open) return;
    dlg.showModal();
    growFrom(dlg, open === "panel" ? (lineRef.current?.getBoundingClientRect() ?? null) : null);
  }, [open]);

  useEffect(() => {
    const c = cardRef.current;
    if (!c || card === null || c.open) return;
    c.showModal();
    growFrom(c, cardFrom.current?.getBoundingClientRect() ?? null);
  }, [card]);

  // The push's ?briefing=open has done its job once the state is initialised.
  // `null`, not `window.history.state`: Next patches replaceState and skips
  // its own URL bookkeeping whenever the passed state already carries its
  // `__NA` marker (app-router.js), which `window.history.state` does once
  // Next has rendered. Passing null takes Next's normal path instead, which
  // copies that bookkeeping in itself and updates its own canonical URL — so
  // a later router.refresh() (e.g. CheckNow) doesn't write ?briefing=open
  // back and re-greet (fix round item 1).
  useEffect(() => {
    if (!forced) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("briefing");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [forced, pathname]);

  // Since then: fetched on every open of today's Briefing; state set only async.
  useEffect(() => {
    if (open === null || view === null || !view.isToday) return;
    let live = true;
    fetch(`/api/briefing/since?sentAt=${encodeURIComponent(view.sentAtIso)}`, {
      signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { lines?: unknown }) => {
        if (!live) return;
        const lines = Array.isArray(body.lines) ? body.lines.filter((l): l is string => typeof l === "string") : null;
        setSince(lines === null ? { kind: "failed" } : { kind: "lines", lines });
      })
      .catch(() => {
        if (live) setSince({ kind: "failed" });
      });
    return () => {
      live = false;
    };
  }, [open, view]);

  function openPanel() {
    if (!canOpen) return;
    setSince({ kind: "loading" });
    setPane(line.opens === "debrief" ? "debrief" : "morning");
    if (press.kind === "failed") setPress({ kind: "idle" });
    setOpen("panel");
  }

  /** Swap the panel's content in place (spec §3.6), focus to the new heading. */
  function swapTo(next: Pane) {
    setPane(next);
    requestAnimationFrame(() => titleRef.current?.focus());
  }

  async function pressDebrief() {
    // The ref, not `press`, is the guard: two clicks inside one render both read press.kind as "idle".
    if (pressing.current) return;
    pressing.current = true;
    setPress({ kind: "waiting" });
    let next: Press = { kind: "failed" };
    try {
      const r = await fetch("/api/briefing/debrief", {
        method: "POST",
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
        cache: "no-store",
      });
      const parsed = r.ok ? parseDebriefResponse(await r.json()) : null;
      if (parsed !== null) {
        const v = buildDebriefView(parsed.debrief);
        setLocalDebrief(v);
        setUnsavedAt(parsed.saved ? null : v.atIso);
        setPane("debrief");
        // A successful press swaps the panel's content silently otherwise,
        // leaving focus stranded on "Debrief now" (S22 fix round item 4) —
        // the same announcement swapTo() gives a manual swap.
        if (dlgRef.current?.open) requestAnimationFrame(() => titleRef.current?.focus());
        next = { kind: "idle" };
      }
    } catch {
      // A timeout, a network error, a body that isn't a Debrief, or a view
      // that wouldn't build: all of them read "didn't finish" (spec §6).
    } finally {
      pressing.current = false;
      setPress(next);
      // The line is server-rendered: ask for it again (spec §7.2 item 5).
      router.refresh();
    }
  }

  async function close() {
    const dlg = dlgRef.current;
    // Guards a double tap, a backdrop click mid-shrink, or two Escapes in a
    // row from running the shrink/seen-POST path twice (fix round item 6).
    if (!dlg || !dlg.open || closingMain.current) return;
    closingMain.current = true;
    dlg.inert = true; // no row can open a card while this dialog is shrinking
    const wasFull = open === "full";
    // finally, not just after the await: shrinkTo documents that it never
    // rejects, but if it (or anything else here) ever threw, leaving the
    // guard set and the dialog inert would strand it closed-but-stuck — Esc
    // is already swallowed by onCancel's preventDefault, so nothing else
    // could ever close it again (principal review, round 2, item 2).
    try {
      await shrinkTo(dlg, lineRef.current?.getBoundingClientRect() ?? null);
    } finally {
      dlg.inert = false;
      closingMain.current = false;
    }
    dlg.close();
    setOpen(null);
    lineRef.current?.focus();
    if (wasFull && view !== null && view.isToday && !view.seen && !seenSent.current) {
      seenSent.current = true;
      // Fire and forget: a failure only means it may greet once more (spec §5.2).
      void fetch("/api/briefing/seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentAt: view.sentAtIso }),
        signal: AbortSignal.timeout(PRESS_TIMEOUT_MS),
      }).catch(() => {});
    }
  }

  function openCard(e: MouseEvent<HTMLButtonElement>, symptom: SymptomView) {
    cardFrom.current = e.currentTarget;
    setCard(symptom);
  }

  async function closeCard() {
    const c = cardRef.current;
    if (!c || !c.open || closingCard.current) return;
    closingCard.current = true;
    c.inert = true;
    try {
      await shrinkTo(c, cardFrom.current?.getBoundingClientRect() ?? null);
    } finally {
      c.inert = false;
      closingCard.current = false;
    }
    c.close();
    setCard(null);
    cardFrom.current?.focus();
  }

  return (
    <>
      <button
        ref={lineRef}
        type="button"
        className={`bf-line is-${line.tone}`}
        onClick={openPanel}
        disabled={!canOpen}
        aria-haspopup={canOpen ? "dialog" : undefined}
      >
        <i aria-hidden="true" />
        <span>{line.text}</span>
      </button>

      {/* onClose guards any native close that doesn't go through close()
          itself — e.g. a future change that calls dlg.close() directly —
          keeping `open` in sync with the dialog's actual state rather than
          React's. It is not a fix for view becoming null while open:
          removing a <dialog> from the DOM does not fire `close`, and an
          unmounted element drops its own handlers regardless; BriefingSlot
          keying this island on the Briefing's sentAtIso makes that scenario
          moot anyway (a new key remounts the component, so `open` comes
          fresh from its initialiser). close()'s own dlg.close() call fires
          this event too, so setOpen(null) there is a harmless repeat of
          what close() already does a few lines later (principal review,
          round 2, item 3). */}
      {(view !== null || shownDebrief !== null) && (
        <dialog
          ref={dlgRef}
          className={`bf-dialog ${open === "full" ? "is-full" : "is-panel"}`}
          aria-labelledby={titleId}
          onCancel={(e) => {
            e.preventDefault();
            void close();
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) void close();
          }}
          onClose={() => setOpen(null)}
        >
          <div className="bf-in">
            <header className="bf-head">
              <p className="bf-when">
                {debriefShown !== null
                  ? `Debrief · ${debriefShown.stamp}`
                  : morningShown !== null
                    ? `${morningShown.label} · ${morningShown.stamp}`
                    : ""}
              </p>
              <h2 id={titleId} ref={titleRef} tabIndex={-1} className="bf-title">
                {debriefShown !== null ? debriefShown.heading : (morningShown?.title ?? "")}
              </h2>
              <button type="button" className="bf-x" aria-label="Close" onClick={() => void close()}>
                ✕
              </button>
            </header>

            {debriefShown !== null && (
              <>
                {unsavedAt === debriefShown.atIso && (
                  <p className="bf-p bf-warn">I couldn’t save this one, so other devices won’t see it.</p>
                )}
                <DebriefBody d={debriefShown} onCard={openCard} />
                {view !== null && view.isToday && (
                  <button type="button" className="bf-swap" onClick={() => swapTo("morning")}>
                    This morning’s briefing →
                  </button>
                )}
              </>
            )}

            {morningShown !== null && (
              <>
                {open === "panel" && shownDebrief !== null && (
                  <button type="button" className="bf-swap" onClick={() => swapTo("debrief")}>
                    ← Debrief
                  </button>
                )}
                {morningShown.kind === "full" ? (
                  <>
                    {morningShown.stories.length > 0 && (
                      <section className="bf-sec">
                        <h3 className="bf-h">As of {morningShown.stamp}</h3>
                        <ul className="bf-stories">
                          {morningShown.stories.map((story) =>
                            story.symptoms.length === 1 ? (
                              <li key={story.id}>
                                <button type="button" className="bf-row" onClick={(e) => openCard(e, story.symptoms[0])}>
                                  <span className="bf-said">
                                    <Said segments={story.sentence} />
                                  </span>
                                  <span className="bf-next">{story.symptoms[0].nextStep}</span>
                                </button>
                              </li>
                            ) : (
                              <li key={story.id}>
                                <p className="bf-story">
                                  <Said segments={story.sentence} />
                                </p>
                                <ul className="bf-symptoms">
                                  {story.symptoms.map((s) => (
                                    <li key={s.id}>
                                      <button type="button" className="bf-row" onClick={(e) => openCard(e, s)}>
                                        <span className="bf-said">
                                          <Said segments={s.sentence} />
                                        </span>
                                        <span className="bf-next">{s.nextStep}</span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            ),
                          )}
                          {morningShown.omitted > 0 && (
                            <li className="bf-omitted">…and {morningShown.omitted} more I couldn’t fit here.</li>
                          )}
                        </ul>
                      </section>
                    )}
                    <section className="bf-sec">
                      <h3 className="bf-h">The day, as of {morningShown.stamp}</h3>
                      {morningShown.today !== "" && <p className="bf-p">{morningShown.today}</p>}
                      {morningShown.freelance !== null && <p className="bf-p">{morningShown.freelance}</p>}
                      {morningShown.off !== null && <p className="bf-p">{morningShown.off}</p>}
                    </section>
                  </>
                ) : (
                  <section className="bf-sec">
                    <p className="bf-p bf-quote">{morningShown.body}</p>
                  </section>
                )}

                {morningShown.isToday && (
                  <section className="bf-sec" aria-live="polite">
                    <h3 className="bf-h">Since {morningShown.stamp}</h3>
                    {since.kind === "loading" && <p className="bf-p bf-wait">Checking…</p>}
                    {since.kind === "failed" && <p className="bf-p">I couldn’t check what’s changed just now.</p>}
                    {since.kind === "lines" && since.lines.map((l, i) => <p key={i} className="bf-p">{l}</p>)}
                  </section>
                )}
              </>
            )}

            {open === "full" && (
              <div className="bf-foot">
                <button type="button" className="bf-got" onClick={() => void close()}>
                  Got it
                </button>
              </div>
            )}

            {open === "panel" && (
              <div className="bf-foot is-press">
                <p className={`bf-status${press.kind === "failed" ? " is-failed" : ""}`} aria-live="polite">
                  {press.kind === "waiting"
                    ? "Checking your sites and ShikksTracker…"
                    : press.kind === "failed"
                      ? "The Debrief didn’t finish. Try again."
                      : ""}
                </p>
                <button
                  type="button"
                  className="bf-got bf-press"
                  onClick={() => void pressDebrief()}
                  disabled={press.kind === "waiting"}
                >
                  Debrief now
                </button>
              </div>
            )}
          </div>
        </dialog>
      )}

      <dialog
        ref={cardRef}
        className="bf-card"
        aria-labelledby={cardTitleId}
        onCancel={(e) => {
          e.preventDefault();
          void closeCard();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) void closeCard();
        }}
        onClose={() => setCard(null)}
      >
        {card !== null && (
          <div className="bf-in">
            <h3 id={cardTitleId} className="bf-h">
              {card.causeHeading}
            </h3>
            <p className="bf-p">
              <Said segments={card.cause} />
            </p>
            <h3 className="bf-h">What to do</h3>
            <p className="bf-p">{card.nextStep}</p>
            {card.raw !== null && (
              <>
                <h3 className="bf-h">Raw error</h3>
                <pre className="bf-raw">{card.raw}</pre>
              </>
            )}
            <div className="bf-foot">
              <button type="button" className="bf-got" onClick={() => void closeCard()}>
                Close
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
