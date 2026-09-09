import type { BlockE } from "@/lib/freelanceGaps";

/**
 * Rows built only from fields that exist. An overdue follow-up's channel slot
 * is EMPTY — inapplicable, not unmeasured — so it renders an empty <span/> to
 * hold the grid's second column rather than a tag or an em-dash.
 *
 * R36: the business name is a plain <a> leaving the app, with a persistent ↗ as
 * a literal character in a .arr span. The ROW is not an anchor.
 *
 * `Nothing waiting.` is left-aligned where content lives — never centred, never
 * in a dashed box, never with an action pill. It is today's state and it must
 * look intentional.
 *
 * FOUR block kinds since R51, and each has its own register (R59):
 *   failed  .fl-fail    — the attention call, or the suppression read, did not
 *                         land. `Couldn't load what's waiting.`
 *   absent  .fl-absent  — the overdue feed NEVER ARRIVED. --ink-4, and never
 *                         .fl-empty: an absence is not a measured emptiness,
 *                         and this block may not claim nothing is waiting on
 *                         the strength of a feed that never reported.
 *   empty   .fl-empty   — measured, and there is genuinely nothing. --ink-3.
 *   rows    the list    — then .fl-bound, then absentNote, in that order.
 *
 * absentNote renders LAST, AFTER .fl-bound, and the order is load-bearing. The
 * bound is a claim about the list (`Showing 20 of 41.`); absentNote is a claim
 * about the 41 (it may be short). A qualifier goes after the thing it
 * qualifies: put the absence first and the reader meets `didn't report overdue
 * follow-ups` and then `Showing 20 of 41.` and reads the 41 as complete, which
 * is the exact misreading the note exists to prevent. And unlike Block B's
 * pair — .fl-note at --ink-3 above .fl-absent at --ink-4 — BOTH of these render
 * at --ink-4 (components.css:413 and :359), so the inks do not separate them
 * and the order is the only thing carrying which claim is which. Specimen 04's
 * second .mini draws measured-then-absence in that order, and Pipeline.tsx
 * reproduces it; this block must not read backwards from Block B on the same
 * page.
 *
 * Markup is specimen 01 (empty) and specimen 02 (all three row kinds) of
 * docs/design/p8-mockup.html, verbatim.
 */
export default function NeedsYou({ block }: { block: BlockE }) {
  if (block.kind !== "rows") {
    return (
      <section className="fl-sect">
        <span className="eyebrow">Needs you</span>
        <h2 className="fl-h">Waiting on you</h2>
        {block.kind === "failed" ? (
          <div className="fl-fail">
            <i />
            <div>
              <div className="said">{block.line}</div>
            </div>
          </div>
        ) : block.kind === "absent" ? (
          // The overdue feed never arrived. --ink-4, not --ink-3: an absence is
          // not a measured emptiness, and this block may not claim nothing is
          // waiting on the strength of a feed that never reported (R51).
          <p className="fl-absent">{block.line}</p>
        ) : (
          <p className="fl-empty">{block.line}</p>
        )}
      </section>
    );
  }

  return (
    <section className="fl-sect">
      <div className="fl-headrow">
        <div>
          <span className="eyebrow">Needs you</span>
          <h2 className="fl-h">Waiting on you</h2>
        </div>
        <span className="fl-count">{block.count}</span>
      </div>
      <div className="fl-rows">
        {block.rows.map((row) => (
          <div className="fl-row" key={row.id}>
            <div>
              <a
                className="fl-biz"
                href={row.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {row.businessName} <span className="arr">↗</span>
              </a>
              <div className={row.waitingIsStale ? "pwhen is-stale" : "pwhen"}>
                {row.waiting}
              </div>
              {row.snippet !== null && <div className="fl-snip">{row.snippet}</div>}
              {row.reason !== null && <div className="fl-why">{row.reason}</div>}
            </div>
            {row.channel !== null ? <span className="tag">{row.channel}</span> : <span />}
          </div>
        ))}
      </div>
      {block.bound !== null && <p className="fl-bound">{block.bound}</p>}
      {/* Last, and after the bound on purpose: the bound is a claim about the
          list (20 of 41), this is a claim about the 41 (it may be short). Both
          render at --ink-4, so order is what tells them apart. */}
      {block.absentNote !== null && <p className="fl-absent">{block.absentNote}</p>}
    </section>
  );
}
