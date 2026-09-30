"use client";

/**
 * LayoutEditor — island 1 of five (visual spec §7.3), and the one client
 * boundary that spans BOTH the header band and the <main>: the header carries
 * the pills and the grid carries the toolbars, so one component owns both.
 *
 * This file is the normal view (Plan C Task 1). Edit mode (Task 8) and the
 * page's one hidden-to-do-id context (Task 2) arrive here and nowhere else, so
 * the seams they need are already cut:
 *
 *   - The six tiles are SERVER components handed in as ReactNode, keyed by
 *     tile id. They render — and their <Suspense> boundaries stream — on the
 *     server; this component only places them. Moving a tile never re-fetches
 *     it (deck §8: "the editor never touches tile contents").
 *   - Every tile renders its head, body and foot through TileHead / TileBody /
 *     TileFoot below. They read this component's context, so edit mode can
 *     make the head and body `inert` (R44) and put the toolbar in the foot
 *     (R29) without touching a single block file.
 *
 * ZERO useEffect (R33). The cells and the tracks are pure functions of the
 * layout, called at render: buildCells / buildTracks from personalLayout.ts,
 * the one pure module a client component imports (§7.5).
 */

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import {
  buildCells,
  buildTracks,
  type PersonalTile,
  type ReadonlyPersonalLayout,
} from "@/lib/personalLayout";

/** The six rendered tiles, by tile id. Every id present: the grid places all six. */
export type TileNodes = Readonly<Record<PersonalTile, ReactNode>>;

/**
 * What a tile's shell needs to know about the page. Normal view is the only
 * value until Task 8 puts the editor's state here.
 */
interface PageState {
  editing: boolean;
}

const NORMAL_VIEW: PageState = Object.freeze({ editing: false });

const PageContext = createContext<PageState>(NORMAL_VIEW);

/** The tile's head (`.pe-head`). `inert` while editing (R44) — Task 8. */
export function TileHead({ inline = false, children }: { inline?: boolean; children: ReactNode }) {
  const { editing } = useContext(PageContext);
  return (
    <div className={inline ? "pe-head is-inline" : "pe-head"} inert={editing || undefined}>
      {children}
    </div>
  );
}

/**
 * The tile's body (`.pe-body`, `.is-pair` on the hero only when both groups
 * are empty — R17, decided by TodayView.spread). `inert` while editing (R44).
 */
export function TileBody({ pair = false, children }: { pair?: boolean; children: ReactNode }) {
  const { editing } = useContext(PageContext);
  return (
    <div className={pair ? "pe-body is-pair" : "pe-body"} inert={editing || undefined}>
      {children}
    </div>
  );
}

/**
 * The tile's foot (`.pe-foot`, R16): display meta (`Showing 20 of 34.`) and,
 * in edit mode, the toolbar — nothing else. Never inert: the toolbar is the
 * one live control while editing. Renders nothing when it has nothing to hold.
 */
export function TileFoot({ children }: { tile: PersonalTile; children?: ReactNode }) {
  if (children === undefined || children === null || children === false) return null;
  return <div className="pe-foot">{children}</div>;
}

export default function LayoutEditor({
  layout,
  tiles,
  notice,
}: {
  /** The RESOLVED layout (resolvePersonalLayout), never the stored value. */
  layout: ReadonlyPersonalLayout;
  tiles: TileNodes;
  /** The page-level sentence above the grid (deck §15's fallen-back arrangement), or null. */
  notice: ReactNode;
}) {
  const cells = buildCells(layout, false);
  // --tracks is set inline on .pe-grid, where --tb is declared (personal.css).
  const gridStyle = { "--tracks": buildTracks(layout, false) } as CSSProperties;

  return (
    <PageContext.Provider value={NORMAL_VIEW}>
      {/* .fl-head carries the padding and .fl the column — the same .fl the
          content uses, so the band and the grid share one left edge (P8 R34).
          No ancestor of this header may take container-type (R30, R87). */}
      <div className="fl-head">
        <div className="fl">
          <div className="fl-headrow">
            <h1 className="fl-title">Personal</h1>
          </div>
        </div>
      </div>
      <main className="app-content">
        <div className="fl">
          {notice}
          <div className="pe-wrap">
            <div className="pe-grid" style={gridStyle}>
              {cells.map((cell) => (
                // Keyed by tile id (R31): a moved tile keeps its DOM node and
                // its focus. In normal view buildCells emits no leftover cell —
                // the leftover is bare ground (§4.7) — so every cell is a tile.
                <div
                  key={cell.tile ?? `gap:${cell.rowClass}`}
                  className={`pe-cell ${cell.rowClass} ${cell.spanClass} ${cell.collapsedClass}${
                    cell.tile === null ? " is-gap" : ""
                  }`}
                >
                  {cell.tile === null ? null : tiles[cell.tile]}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </PageContext.Provider>
  );
}
