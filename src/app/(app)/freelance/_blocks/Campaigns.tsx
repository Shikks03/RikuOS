import type { BlockC } from "@/lib/freelanceView";
import { IconInfo } from "@/components/icons";

/**
 * A native <details>, closed by default. The chevron is a CSS ::after box on
 * .sumrow that rotates on [open]; there is no icon and no script.
 *
 * The <div className="sumrow"> is a div rather than the mockup's span because
 * it contains a real <h2>, and a span is phrasing content. Both are grid items,
 * so nothing moves.
 *
 * It STAYS a div, and R65 is why. The cost is a validator complaint and nothing
 * else: <summary>'s content model is phrasing content or a single heading
 * element, so a <div> wrapper inside it is not strictly conformant — with no
 * rendering, assistive-technology or React consequence. What it buys is that
 * <summary> maps to a button-like control with name-from-contents in the major
 * engines, so the eyebrow, the heading and the count reach a screen-reader
 * user as ONE accessible name,
 * roughly "Campaigns Your campaigns 2, collapsed, button". Do not "fix" the
 * <div> back to a <span>: that deletes the <h2> with it, and whether a heading
 * nested inside a button survives into heading navigation varies by browser and
 * screen reader. Certain pedantry is not worth an uncertain loss.
 *
 * IconInfo carries no intrinsic size: `.honesty svg` gives it 13px. That rule
 * is the ONLY thing sizing it, which is why the icon is used nowhere else.
 *
 * Sorted by Sent, highest first, bounded at 20 — both decided in the view
 * model. No rate column, ever. No hue anywhere.
 *
 * Markup is specimen 02 of docs/design/p8-mockup.html, verbatim.
 */
export default function Campaigns({ block }: { block: BlockC }) {
  // A block with nothing to disclose is not a disclosure: a chevron that opens
  // onto one sentence is a control that lies about having content.
  if (block.kind !== "table") {
    return (
      <section className="fl-sect">
        <span className="eyebrow">Campaigns</span>
        <h2 className="fl-h">Your campaigns</h2>
        {block.kind === "failed" ? (
          <div className="fl-fail">
            <i />
            <div>
              <div className="said">{block.line}</div>
            </div>
          </div>
        ) : (
          <p className="fl-empty">{block.line}</p>
        )}
      </section>
    );
  }

  return (
    <details className="disclose fl-sect">
      <summary>
        {/* Written inline in the one branch that uses it. The summary row is
            the table state's own, and a `head` hoisted above the guard would be
            built and discarded on the empty and failed paths — and its count
            would need a `kind === "table" ? count : ""` ternary whose second
            arm can never render (S8). */}
        <div className="sumrow">
          <div>
            <span className="eyebrow">Campaigns</span>
            <h2 className="fl-h">Your campaigns</h2>
          </div>
          <span className="fl-count">{block.count}</span>
        </div>
      </summary>
      <div className="fl-open">
        <div className="fl-table is-campaigns">
          <div className="fl-thead">
            {block.headers.map((header) => (
              <span key={header}>{header}</span>
            ))}
          </div>
          {block.rows.map((row) => (
            <div className="fl-trow" key={row.id}>
              <span className="nm">{row.name}</span>
              {row.cells.map((cell, index) => (
                <span
                  className={cell.tone === "value" ? undefined : cell.tone}
                  key={block.headers[index + 1]}
                >
                  {cell.text}
                </span>
              ))}
            </div>
          ))}
        </div>
        {block.bound !== null && <p className="fl-bound">{block.bound}</p>}
        <p className="honesty">
          <IconInfo />
          {block.honesty}
        </p>
      </div>
    </details>
  );
}
