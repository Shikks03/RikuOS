import { CardsOutline } from "../../_shell/Outline";

const STATUS_LABELS = ["pending", "approved", "edited approved", "rejected", "expired", "all"] as const;

/**
 * The queue's outline (smooth-feel spec §3.1, §6): the filter row's six
 * buttons, held in place as invisible, unfocusable placeholders (F1 review
 * — the real row sits above the cards, so an outline without it left the
 * filter row out), then two unlabelled cards. The first loading boundary on
 * this path: the dashboard's sits inside the (dashboard) route group, off it.
 */
export default function Loading() {
  return (
    <main>
      <div className="row" aria-hidden="true">
        {STATUS_LABELS.map((label) => (
          <button key={label} type="button" className="secondary ol-ghost" tabIndex={-1}>
            {label}
          </button>
        ))}
      </div>
      <CardsOutline labels={[null, null]} />
    </main>
  );
}
