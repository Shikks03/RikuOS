import type { LayersTileView } from "@/lib/personalView";
import { TileBody, TileFoot, TileHead } from "../LayoutEditor";
import LayerSwitches from "../LayerSwitches";
import { SettingsLine, withSettingsLink } from "./SettingsLine";

export interface LayersProps {
  /**
   * buildLayersView's result, behind the page's one calendar promise: the
   * tile needs the window (not-configured / expired drop the switches, deck
   * §9) and listCalendars() (R42's vanished layer), so it streams with Today
   * and Next 7 days.
   */
  view: Promise<LayersTileView>;
}

/**
 * Tile 3 — Layers (deck §6 Tile 3, visual spec §4.3). One switch per stored
 * layer, in stored order; the switches are LayerSwitches' island. When the
 * window reports not-configured or expired the tile shows Tile 1's sentence
 * and no switches, matching the Settings card (deck §9); a per-layer or
 * whole-calendar read failure keeps the switches live. A vanished calendar
 * keeps its row (R42) and its sentence sits after the rows, where a layer's
 * couldn't-read sits in Tiles 1 and 5 — `.fl-empty`, no dot.
 */
export default async function Layers({ view }: LayersProps) {
  const v = await view;
  return (
    <section className="pe-tile">
      <TileHead>
        <div>
          <span className="eyebrow">Layers</span>
        </div>
      </TileHead>
      <TileBody>
        {v.kind === "switches" ? (
          <>
            <LayerSwitches rows={v.rows} />
            {v.rows.map(
              (r) =>
                r.note !== null && (
                  <p className="fl-empty" key={r.calendarId}>
                    {withSettingsLink(r.note) /* deck §15, R42 */}
                  </p>
                ),
            )}
          </>
        ) : (
          v.line !== null && <SettingsLine line={v.line} />
        )}
      </TileBody>
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
