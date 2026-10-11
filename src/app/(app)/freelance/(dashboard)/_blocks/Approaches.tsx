import type { BlockD } from "@/lib/freelanceVariants";
import { IconInfo } from "@/components/icons";

/**
 * Two groups at equal typographic weight — and only the ones that have rows.
 * The view model drops an empty group before this file ever sees it (R66), and
 * it can never drop both, because an empty variant list returns `empty` first.
 * The `Not measurable` group keeps its rate column full of em-dashes and drops
 * the replies column entirely; its explanation sits UNDER the group heading and
 * ABOVE its rows, never below as a footnote.
 *
 * Group 2's three-column rows sit in the SAME four-column grid on purpose:
 * .fl-table declares --fl-cols once and serves both groups, so `Approach ·
 * Reply rate · Sends` occupies columns 1–3 and leaves the `Replies` column
 * empty — which is exactly what makes the two groups' Reply rate and Sends
 * columns share an x-position down the whole block. The obvious "fix", an
 * is-3col modifier, would break that alignment (N4). Since R66 a single-group
 * state exists as well — no email variant at all — where the `Not measurable`
 * group's three cells sit alone in the four-track grid with a dead right
 * gutter and nothing left to align to. That is the mockup's own accepted look
 * for group 2, not a bug.
 *
 * The <div className="sumrow"> inside <summary> stays a div, and R65 is why.
 * Against it: <summary>'s content model is phrasing content or a single heading
 * element, so the wrapper is not strictly conformant — a validator complaint
 * with no rendering, assistive-technology or React consequence. For it:
 * <summary> maps to a button-like control with name-from-contents in the major
 * engines, so the eyebrow and the heading reach a screen-reader user as ONE
 * accessible name. Do not "fix" it back to a <span>: that deletes the <h2> with
 * it, and whether a heading nested inside a button survives into heading
 * navigation varies by browser and screen reader. Certain pedantry is not worth
 * an uncertain loss.
 *
 * `open` is passed from the view model's defaultOpen (R31): open only while
 * every approach has zero sends, which is today's state and the clearest single
 * demonstration on the page of "not measurable is not zero". That is why it is
 * passed HERE and never on Campaigns — this block's open state is a claim the
 * data makes, and Campaigns' is not.
 *
 * It is not a controlled value, but it is not frozen either. defaultOpen is
 * `variants.every(v => v.sends === 0)`, so it holds still until the first send
 * lands; when it does, the prop flips true → false on the next render, React
 * writes the attribute back, and the block closes — CORRECTLY, because R31 says
 * it is closed by default once any approach has a send. What cannot happen is a
 * router.refresh() closing a block the reader opened while the numbers are the
 * same on both sides. Only a snap-shut with UNCHANGED data would be a defect,
 * and that is the distinction to watch for, never the flip itself (N11).
 *
 * The empty <span className="fl-count" /> is deliberate: .sumrow is a
 * three-column grid whose third column is the chevron, so the slot has to
 * exist even though this block carries no count.
 *
 * Markup is specimen 01 / 02 of docs/design/p8-mockup.html, verbatim.
 */
export default function Approaches({ block }: { block: BlockD }) {
  if (block.kind !== "groups") {
    return (
      <section className="fl-sect">
        <span className="eyebrow">Approach performance</span>
        <h2 className="fl-h">Your approaches</h2>
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
    <details className="disclose fl-sect" open={block.defaultOpen}>
      <summary>
        <div className="sumrow">
          <div>
            <span className="eyebrow">Approach performance</span>
            <h2 className="fl-h">Your approaches</h2>
          </div>
          <span className="fl-count" />
        </div>
        <span className="fl-collapsed">
          {block.collapsed.kind === "statement" ? (
            block.collapsed.text
          ) : (
            <>
              <span className="nm">{block.collapsed.name}</span>
              <b>{block.collapsed.rate}</b>
            </>
          )}
        </span>
      </summary>

      <div className="fl-open">
        {block.groups.map((group, groupIndex) => (
          <div className="fl-group" key={group.eyebrow}>
            <span className="eyebrow">{group.eyebrow}</span>
            {group.explain !== null && <p className="fl-explain">{group.explain}</p>}
            <div className="fl-table">
              <div className="fl-thead">
                {group.headers.map((header) => (
                  <span key={header}>{header}</span>
                ))}
              </div>
              {group.rows.map((row) => (
                <div className="fl-trow" key={row.key}>
                  <span className="nm">{row.name}</span>
                  {row.cells.map((cell, index) => (
                    <span
                      className={cell.tone === "value" ? undefined : cell.tone}
                      key={group.headers[index + 1]}
                    >
                      {cell.text}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            {/* R27: the honesty note belongs under the MEASURED group only, and
                only when at least one rate is actually printed. The view model
                decides the second half; this decides the first.

                `groupIndex === 0` is positional, and since R66 it is positional
                against a FILTERED array. It stays correct by coincidence, and
                the coincidence is written down here rather than rediscovered:
                `honesty` is non-null only when a rate was printed, rates exist
                only in the measured group, and the measured group is absent
                only when no email variant exists at all — in which case
                `honesty` is null and this guard never fires. Making it
                structural means carrying `honesty` on the measured group, which
                is a BlockD shape change and a Plan B conversation (R66). */}
            {groupIndex === 0 && block.honesty !== null && (
              <p className="honesty">
                <IconInfo />
                {block.honesty}
              </p>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
