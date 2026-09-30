import type { DoneTileView } from "@/lib/personalView";
import { TileFoot, TileHead } from "../LayoutEditor";

export interface DoneProps {
  view: DoneTileView;
}

/**
 * Tile 6 — Done this week (deck §6 Tile 6). The one tile whose second head
 * slot sits BESIDE the eyebrow (`.pe-head.is-inline`, R11, C18): one grammar,
 * both of the deck's renders — the count when populated, `Nothing ticked off
 * yet this week.` when the read answered with nothing. The count is absent at
 * zero (deck §12: the view says null) and `0` never renders; under a failed
 * read the slot is empty and the body carries the sentence (Task 6).
 *
 * HEAD ONLY in Task 1; the rows arrive in Task 6.
 */
export default function Done({ view }: DoneProps) {
  const empty = view.fail === null && view.count === null && view.rows.length === 0;
  return (
    <section className="pe-tile">
      <TileHead tile="done" inline>
        <span className="eyebrow">Done this week</span>
        {view.count !== null && <span className="fl-count">{view.count}</span>}
        {empty && <p className="fl-empty">Nothing ticked off yet this week.</p>}
      </TileHead>
      <TileFoot tile="done" />
    </section>
  );
}
