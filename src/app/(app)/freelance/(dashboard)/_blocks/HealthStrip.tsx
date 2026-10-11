import { Fragment } from "react";
import type { BlockF } from "@/lib/freelanceHealth";
import CheckNow from "./CheckNow";

/**
 * Silent when all is well: a hairline, one 11px line and the pill, reading as a
 * footer. The moment there is one warning it becomes a bordered card — cards
 * earn their borders, and a structural alarm is quieter and stronger than more
 * colour.
 *
 * The marker is the system's hued dot, never a glyph — the reason is written
 * once, in freelanceHealth.ts's header, and is not copied here: two copies of a
 * rule drift, and the view model is where the decision lives.
 *
 * Every key here is CONTENT-DERIVED — part.text, warning.text, and the fine
 * line's own text — because a HealthWarning has no id to key on. They are
 * unique in every render this page can produce: the quiet line's parts are the
 * engine phrase, `all sites ok` and the stamp, and SITES carries three distinct
 * names, so `warnings` and `fine` cannot collide (N7).
 *
 * The aged stamp nests <span className="aged"> INSIDE .line in BOTH forms,
 * never as a second class on .line itself. The rule is a descendant selector —
 * `.fl-health .line .aged`, components.css:465 as R60 widened it — so the two
 * forms have to write it the same way or the alarm form renders R57's amber
 * statement in ordinary grey and it looks like a timestamp.
 *
 * Markup is specimen 01 (quiet) and specimen 02 (alarm) of
 * docs/design/p8-mockup.html, verbatim.
 */
export default function HealthStrip({ strip }: { strip: BlockF }) {
  if (strip.kind === "quiet") {
    return (
      <div className="fl-health quiet">
        <span className="line">
          {strip.parts.map((part, index) => (
            <Fragment key={part.text}>
              {index > 0 && <i>·</i>}
              {part.aged ? <span className="aged">{part.text}</span> : part.text}
            </Fragment>
          ))}
        </span>
        <CheckNow />
      </div>
    );
  }

  return (
    <div className="fl-health alarm">
      {strip.warnings.map((warning) => (
        <div className={`fl-warn is-${warning.tone}`} key={warning.text}>
          <i />
          <span>{warning.text}</span>
        </div>
      ))}
      {strip.fine.length > 0 && (
        <p className="fl-fine">
          {strip.fine.map((text, index) => (
            <Fragment key={text}>
              {index > 0 && <i>·</i>}
              {text}
            </Fragment>
          ))}
        </p>
      )}
      <div className="fl-stamp">
        <span className="line">{strip.stamp.aged ? <span className="aged">{strip.stamp.text}</span> : strip.stamp.text}</span>
        <CheckNow />
      </div>
    </div>
  );
}
