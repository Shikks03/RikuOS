import type { PushTileView } from "@/lib/personalView";
import { TileFoot, TileHead } from "../LayoutEditor";

export interface PushProps {
  view: PushTileView;
}

/**
 * Tile 4 — This morning's push (deck §6 Tile 4). HEAD ONLY in Task 1: the
 * eyebrow (curly apostrophe) and the `sent 07:00` stamp — sentAt in APP_TZ,
 * never the cron's hour, and present only when today's push is quoted. The
 * quotation arrives in Task 6.
 */
export default function Push({ view }: PushProps) {
  return (
    <section className="pe-tile">
      <TileHead tile="push">
        <div>
          <span className="eyebrow">This morning’s push</span>
        </div>
        {view.stamp !== null && <span className="pe-stamp">{view.stamp}</span>}
      </TileHead>
      <TileFoot tile="push" />
    </section>
  );
}
