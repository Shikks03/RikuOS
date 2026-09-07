import ViewSwitch from "./ViewSwitch";

/**
 * The Freelance segment's header, rendered above BOTH views (R42): the queue
 * is a view of this page, not a page of its own.
 *
 * IT RENDERS NO <main>. /freelance brings its own <main className="app-content">
 * and /freelance/queue brings legacy.css's, and two <main> elements in one
 * document is invalid HTML. The header is a plain <div> for the same kind of
 * reason: a <header> at this nesting maps to role="banner", a document-level
 * landmark this shell has not designed, and the element is doing layout, not
 * semantics. The <h1> inside it is the document's heading either way.
 *
 * .fl-head carries the padding and .fl the 920px column — the SAME .fl both
 * views use, so the header, the top bar and both views share one left edge by
 * construction rather than by two rules kept in step (R34).
 *
 * No session check: the (app) layout above this one already did it.
 */
export default function FreelanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="fl-head">
        <div className="fl">
          <h1 className="fl-title">Freelance</h1>
          <ViewSwitch />
        </div>
      </div>
      {children}
    </>
  );
}
