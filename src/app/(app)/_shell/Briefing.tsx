"use client";

/**
 * Briefing — the assistant's greeting line, the full-screen greeting, the
 * panel and the cause card (S21, spec §5). One island in the shell.
 *
 * Native <dialog> + showModal() gives the focus trap, Esc, and an inert page
 * behind it for free; Esc (`cancel`) and a backdrop click are routed through
 * close() so the shrink animation always runs. Focus returns to the line.
 *
 * STATE: `open` changes only in handlers (or the dialog's own `onClose`, fix
 * round item 7 — see below); the first value comes from the initialiser
 * (today's unseen Briefing, or ?briefing=open from the push). Effects only
 * touch the DOM, write a ref, or add/remove a listener. "Since then" is
 * fetched on every open and set only in the fetch's async callback (the lint
 * baseline holds).
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
import type { BriefingView, GreetingLine, Segment, SymptomView } from "@/lib/briefingView";
import { growFrom, shrinkTo } from "./flip";

type Open = null | "full" | "panel";
type Since = { kind: "loading" } | { kind: "lines"; lines: string[] } | { kind: "failed" };

function Said({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))}
    </>
  );
}

export default function Briefing({
  line,
  view,
  autoOpen,
}: {
  line: GreetingLine;
  view: BriefingView | null;
  autoOpen: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const forced = params.get("briefing") === "open";
  const canOpen = line.opens === "digest" && view !== null;
  const [open, setOpen] = useState<Open>(() => (canOpen && (forced || autoOpen) ? "full" : null));
  const [since, setSince] = useState<Since>({ kind: "loading" });
  const [card, setCard] = useState<SymptomView | null>(null);
  const lineRef = useRef<HTMLButtonElement>(null);
  const dlgRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDialogElement>(null);
  const cardFrom = useRef<HTMLButtonElement | null>(null);
  const seenSent = useRef(false);
  const closingMain = useRef(false);
  const closingCard = useRef(false);
  // null until the mount effect below sets it — Date.now() is impure and
  // must not run during render (react-hooks/purity), so the initial value
  // comes from the effect, which also runs once on mount.
  const lastPropsAt = useRef<number | null>(null);
  const titleId = useId();
  const cardTitleId = useId();

  // DOM/ref only: remembers when `line`/`view` last arrived fresh from the
  // server, so a later visibilitychange can judge staleness (fix round
  // item 5b). Writes a ref, never state.
  useEffect(() => {
    lastPropsAt.current = Date.now();
  }, [line, view]);

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
    setOpen("panel");
  }

  async function close() {
    const dlg = dlgRef.current;
    // Guards a double tap, a backdrop click mid-shrink, or two Escapes in a
    // row from running the shrink/seen-POST path twice (fix round item 6).
    if (!dlg || !dlg.open || closingMain.current) return;
    closingMain.current = true;
    dlg.inert = true; // no row can open a card while this dialog is shrinking
    const wasFull = open === "full";
    await shrinkTo(dlg, lineRef.current?.getBoundingClientRect() ?? null);
    dlg.close();
    dlg.inert = false;
    closingMain.current = false;
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
    await shrinkTo(c, cardFrom.current?.getBoundingClientRect() ?? null);
    c.close();
    c.inert = false;
    closingCard.current = false;
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

      {/* onClose (fix round item 7): if a refresh makes `view` null while this
          dialog is open, the conditional below unmounts the <dialog> with
          `open` still "full"/"panel" — the HTML spec's dialog-removing steps
          close an open dialog on removal, firing this native event, so this
          syncs React's state back to null rather than leaving it stuck (a
          later remount would otherwise never call showModal() again, since
          the show-dialog effect only re-runs on `open` changing). It never
          runs close()'s shrink or seen-POST — those stay in close() alone,
          reached only by an explicit dismissal. close()'s own dlg.close()
          also fires this event, so setOpen(null) there is a harmless repeat. */}
      {view !== null && (
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
                {view.label} · {view.stamp}
              </p>
              <h2 id={titleId} className="bf-title">
                {view.title}
              </h2>
              <button type="button" className="bf-x" aria-label="Close" onClick={() => void close()}>
                ✕
              </button>
            </header>

            {view.kind === "full" ? (
              <>
                {view.stories.length > 0 && (
                  <section className="bf-sec">
                    <h3 className="bf-h">As of {view.stamp}</h3>
                    <ul className="bf-stories">
                      {view.stories.map((story) =>
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
                      {view.omitted > 0 && <li className="bf-omitted">…and {view.omitted} more I couldn’t fit here.</li>}
                    </ul>
                  </section>
                )}
                <section className="bf-sec">
                  <h3 className="bf-h">The day, as of {view.stamp}</h3>
                  {view.today !== "" && <p className="bf-p">{view.today}</p>}
                  {view.freelance !== null && <p className="bf-p">{view.freelance}</p>}
                  {view.off !== null && <p className="bf-p">{view.off}</p>}
                </section>
              </>
            ) : (
              <section className="bf-sec">
                <p className="bf-p bf-quote">{view.body}</p>
              </section>
            )}

            {view.isToday && (
              <section className="bf-sec" aria-live="polite">
                <h3 className="bf-h">Since {view.stamp}</h3>
                {since.kind === "loading" && <p className="bf-p bf-wait">Checking…</p>}
                {since.kind === "failed" && <p className="bf-p">I couldn’t check what’s changed just now.</p>}
                {since.kind === "lines" && since.lines.map((l, i) => <p key={i} className="bf-p">{l}</p>)}
              </section>
            )}

            {open === "full" && (
              <div className="bf-foot">
                <button type="button" className="bf-got" onClick={() => void close()}>
                  Got it
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
