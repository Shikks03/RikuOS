import { LoadingSignal } from "./NavProgress";

/**
 * The outline pieces every page's loading state shares (smooth-feel spec
 * §3.1). No "use client": a server component where a loading.tsx renders it,
 * and part of the client bundle where a client island (the queue, Settings'
 * agent cards) imports it — it holds no state and no server import.
 *
 * AN OUTLINE NEVER HOLDS CONTENT. Fixed labels and headings may show (they
 * are the page's frame); figures, names, counts and rows never do, so a
 * loading box can never be mistaken for `nothing there`.
 */

const WIDTHS = ["w90", "w70", "w50"] as const;

/** Grey bars where text will go. aria-hidden: the outline's one status says `Loading…`. */
export function OutlineBars({ lines = 3 }: { lines?: number }) {
  return (
    <span className="ol-bars" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={`ol-bar ${WIDTHS[i % WIDTHS.length]}`} />
      ))}
    </span>
  );
}

/**
 * The legacy pages' cards in outline (Settings, the queue): each card's fixed
 * label when it has one, then bars. `null` is a card with no label.
 */
export function CardsOutline({ labels }: { labels: readonly (string | null)[] }) {
  return (
    <div aria-busy="true">
      <LoadingSignal announce />
      {labels.map((label, i) => (
        <div className="card" key={i}>
          {label !== null && <p className="meta">{label}</p>}
          <OutlineBars />
        </div>
      ))}
    </div>
  );
}
