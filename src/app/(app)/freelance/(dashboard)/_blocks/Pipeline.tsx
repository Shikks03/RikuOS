import type { BlockB } from "@/lib/freelanceView";

/**
 * Rows, not a strip: a label left, a count right, a hairline above each and
 * none above the first. No boxes, no bars, no funnel.
 *
 * The two notes under the rows are the same shape in two inks because they are
 * two different claims — .fl-note is a MEASURED emptiness, .fl-absent is a
 * field that never arrived. The view model decides which; this file renders it.
 *
 * The middot in the summary line is an <i> with 5px either side and NO literal
 * spaces in the markup, exactly as the mockup writes it.
 *
 * Markup is specimen 01 / 02 / 04 of docs/design/p8-mockup.html, verbatim.
 */
export default function Pipeline({ block }: { block: BlockB }) {
  return (
    <section className="fl-sect">
      <span className="eyebrow">Pipeline</span>
      <h2 className="fl-h">Your pipeline</h2>

      {block.kind === "failed" && (
        <div className="fl-fail">
          <i />
          <div>
            <div className="said">{block.line}</div>
          </div>
        </div>
      )}

      {block.kind === "empty" && <p className="fl-empty">{block.line}</p>}

      {block.kind === "stages" && (
        <>
          <p className="fl-sum">
            <b>{block.summary.total}</b> {block.summary.totalWord}
            {block.summary.hot !== null && (
              <>
                <i>·</i>
                <b>{block.summary.hot}</b> {block.summary.hotWord}
              </>
            )}
          </p>
          {block.hotAbsentNote !== null && (
            <p className="fl-absent">{block.hotAbsentNote}</p>
          )}
          <div className="fl-stages">
            {block.rows.map((row) => (
              <div className="fl-stage" key={row.key}>
                <span className="nm">{row.label}</span>
                <span className="ct">{row.count}</span>
              </div>
            ))}
          </div>
          {block.emptyNote !== null && <p className="fl-note">{block.emptyNote}</p>}
          {block.absentNote !== null && <p className="fl-absent">{block.absentNote}</p>}
        </>
      )}
    </section>
  );
}
