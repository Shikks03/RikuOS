import type { LayersTileView } from "@/lib/personalView";
import { TileFoot, TileHead } from "../LayoutEditor";

export interface LayersProps {
  /**
   * buildLayersView's result, behind the page's one calendar promise: the
   * tile needs the window (not-configured / expired drop the switches, deck
   * §9) and listCalendars() (R42's vanished layer), so it streams with Today
   * and Next 7 days.
   */
  view: Promise<LayersTileView>;
}

/** Tile 3 — Layers (deck §6 Tile 3). HEAD ONLY in Task 1; the switches arrive in Task 7. */
export default async function Layers({ view }: LayersProps) {
  await view;
  return (
    <section className="pe-tile">
      <TileHead>
        <div>
          <span className="eyebrow">Layers</span>
        </div>
      </TileHead>
      <TileFoot tile="layers" />
    </section>
  );
}

/** The Suspense fallback: border, ground and eyebrow, nothing else (§7.4). */
export function LayersFallback() {
  return (
    <section className="pe-tile">
      <TileHead>
        <div>
          <span className="eyebrow">Layers</span>
        </div>
      </TileHead>
    </section>
  );
}
