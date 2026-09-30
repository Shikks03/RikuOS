import type { DoneTileView } from "@/lib/personalView";
import { TileBody, TileFoot, TileHead } from "../LayoutEditor";
import TodoRow from "../TodoRow";

export interface DoneProps {
  view: DoneTileView;
}

/**
 * Tile 6 — Done this week (deck §6 Tile 6, §12, §15; visual spec §4.6). The
 * one tile whose second head slot sits BESIDE the eyebrow (`.pe-head.is-inline`,
 * R11, C18): one grammar, both of the deck's renders — the count when
 * populated, `Nothing ticked off yet this week.` when the read answered with
 * nothing. The count is absent at zero (deck §12: the view says null) and `0`
 * never renders; under a failed read the slot is empty and the body carries
 * the sentence.
 *
 * Rows are TodoRow's done shape (the quiet ticked box, `Undo "…"`, un-ticking
 * returns the to-do to its section, `entry left on Google` via `.pe-on`), most
 * recent first as the view ordered them, bound 20 with `Showing 20 of 31.` in
 * the foot (R16). R49's dotted sentence — a tick whose calendar entry could
 * not be removed — sits under this head through TileHead's `tile`.
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
      {view.fail !== null ? (
        <TileBody>
          <div className="pe-fail">
            <i></i>
            <span className="said">{view.fail.text}</span>
          </div>
        </TileBody>
      ) : (
        view.rows.length > 0 && (
          <TileBody>
            <div className="pe-rows">
              {view.rows.map((row) => (
                <TodoRow key={row.id} shape="done" tile="done" row={row} />
              ))}
            </div>
          </TileBody>
        )
      )}
      <TileFoot tile="done">{view.bound !== null && <p className="fl-bound">{view.bound}</p>}</TileFoot>
    </section>
  );
}
