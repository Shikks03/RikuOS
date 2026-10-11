"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import { buildCells, buildTracks, type PersonalTile } from "@/lib/personalLayout";
import { LAYOUT_MEMORY_KEY, layoutFromMemory } from "@/lib/personalLayoutMemory";
import { LoadingSignal } from "../_shell/NavProgress";
import { OutlineBars } from "../_shell/Outline";

/**
 * The Personal page's outline (smooth-feel spec §3.1): LayoutEditor's normal
 * view with every tile reduced to its border, ground, eyebrow and bars —
 * the same .fl-head band, the same .pe-grid tracks and cells, so nothing
 * jumps when the real tiles arrive. The arrangement is the one this browser
 * remembered (RememberLayout), else the default.
 *
 * useSyncExternalStore with a server snapshot of null: the first-open HTML
 * draws the default, hydration then swaps in the remembered grid; a soft
 * navigation draws the remembered grid at once. The hero is untinted on
 * purpose — the to-do read has not answered (R83).
 */

const LABELS: Readonly<Record<PersonalTile, string>> = {
  today: "Today",
  todos: "To-do",
  layers: "Layers",
  week: "Next 7 days",
  done: "Done this week",
};

function readMemory(): string | null {
  try {
    return window.localStorage.getItem(LAYOUT_MEMORY_KEY);
  } catch {
    return null;
  }
}

function subscribeStorage(fn: () => void): () => void {
  window.addEventListener("storage", fn);
  return () => window.removeEventListener("storage", fn);
}

export default function PersonalOutline() {
  const raw = useSyncExternalStore(subscribeStorage, readMemory, () => null);
  const layout = layoutFromMemory(raw);
  const cells = buildCells(layout, false);
  const gridStyle = { "--tracks": buildTracks(layout, false) } as CSSProperties;

  return (
    <>
      <div className="fl-head">
        <div className="fl">
          <div className="fl-headrow">
            <h1 className="fl-title">Personal</h1>
            <span className="btn ol-ghost" aria-hidden="true">
              Edit layout
            </span>
          </div>
        </div>
      </div>
      <main className="app-content" aria-busy="true">
        <LoadingSignal announce />
        <div className="fl">
          <div>
            <div className="pe-wrap">
              <div className="pe-grid" style={gridStyle}>
                {cells.map((cell) =>
                  cell.tile === null ? null : (
                    <div key={cell.tile} className={`pe-cell ${cell.rowClass} ${cell.spanClass} ${cell.collapsedClass}`}>
                      <section className={cell.tile === "today" ? "pe-tile is-hero" : "pe-tile"}>
                        <div className={cell.tile === "done" ? "pe-head is-inline" : "pe-head"}>
                          <div>
                            <span className="eyebrow">{LABELS[cell.tile]}</span>
                            {cell.tile === "today" && (
                              <div className="fl-h ol-ghost" aria-hidden="true">
                                &nbsp;
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="pe-body">
                          <OutlineBars lines={cell.tile === "today" || cell.tile === "week" ? 3 : 2} />
                        </div>
                      </section>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
