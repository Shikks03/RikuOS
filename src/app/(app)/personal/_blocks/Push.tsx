import type { PushTileView, SayLine } from "@/lib/personalView";
import { TileBody, TileFoot, TileHead } from "../LayoutEditor";

export interface PushProps {
  view: PushTileView;
}

/** A dotted line is `.pe-fail` (`.is-missing` for R22's dot); a bare one takes the register its state names. */
function Line({ line, bare }: { line: SayLine; bare: "fl-empty" | "fl-absent" }) {
  if (line.dot === null) return <p className={bare}>{line.text}</p>;
  return (
    <div className={line.dot === "missing" ? "pe-fail is-missing" : "pe-fail"}>
      <i></i>
      <span className="said">{line.text}</span>
    </div>
  );
}

/**
 * Tile 4 — This morning's push (deck §6 Tile 4, §15; visual spec §4.4; R14,
 * R22). The tile QUOTES and never evaluates: title and body are the stored
 * text, handed through untouched — never clamped, never `+N more`, nothing
 * recomputed, nothing hued. `devices` is not on the view and is not rendered.
 *
 * Every state is Plan B's (buildPushTileView), including the one judgement
 * that depends on the clock: `No push this morning.` carries the `missing`
 * dot only from PUSH_EXPECTED_HOUR in APP_TZ, and the view says which
 * (`line.dot`). Nothing here reads a clock. The stamp is sentAt in APP_TZ.
 *
 * Markup is the mockup's "push tile, four ways" specimen: today's push as
 * `.pe-ptitle` + `.fl-snip`; an older one under `.pe-last` in the
 * `pre.pe-quote` well, title and body on their own lines; the unstored and
 * never-stored sentences in `.fl-absent` (a field that never arrived), the
 * monitoring-off and pre-07:00 sentences in `.fl-empty`.
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
      <TileBody>
        {view.kind === "quote" ? (
          <>
            <p className="pe-ptitle">{view.title}</p>
            <p className="fl-snip">{view.body}</p>
          </>
        ) : (
          <>
            {view.line !== null && (
              <Line
                line={view.line}
                bare={view.kind === "went-out-unstored" || view.kind === "never" ? "fl-absent" : "fl-empty"}
              />
            )}
            {view.last !== null && (
              <>
                <p className="pe-last">{view.last.stamp}</p>
                <pre className="pe-quote">{`${view.last.title}\n${view.last.body}`}</pre>
              </>
            )}
          </>
        )}
      </TileBody>
      <TileFoot tile="push" />
    </section>
  );
}
