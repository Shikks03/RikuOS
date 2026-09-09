import type { StatCard } from "@/lib/freelanceView";

/**
 * Three cards that never disappear: hue drains, structure stays. The tone comes
 * from the view model, which is where the measured-zero / never-measured
 * distinction is decided; this file only renders it.
 *
 * The track's width is an inline style because it IS the datum — a percentage
 * cannot live in a stylesheet. It is the one inline style on the page.
 *
 * That inline width rests on `style-src 'self' 'unsafe-inline'` in
 * next.config.ts (line ~57). A hardened style-src would not remove the bar: it
 * would fill it to 100 % for every value, silently, because `.track i` has no
 * width rule of its own. That header and this line are coupled.
 *
 * R36: the drafts card's `Open ↗` is a plain <a> that leaves the app, so it
 * carries target and rel. The ↗ is a literal character in the link text, never
 * an icon component. .stat-top .more already carries border-bottom:0 in
 * components.css precisely because it becomes an anchor here.
 *
 * R68: it also carries aria-label="Open drafts in ShikksTracker". Sighted, the
 * eye reads the .stat-top row as `Drafts → Open`; tabbed to, the link's whole
 * accessible name was `Open ↗` and nothing in it said what opens. That is WCAG
 * 2.4.4 on the page's single most consequential control — its one exit, on a
 * page whose promise is that every action leaves for another app. The added
 * words are the card's own caption, and the visible word `Open` is contained in
 * the accessible name, so Label in Name (2.5.3) holds for voice control; the ↗
 * is a symbol no speech-input user can utter. Block E's business-name links
 * need nothing: their name is the business.
 *
 * The aria-label is hardcoded here for ANY card carrying an href, and only the
 * drafts card has one today — StatCard.href's own docblock says so. The day a
 * second card gains a link, which the money card (components.css:257)
 * anticipates, the label moves onto StatCard: this component cannot tell the
 * two apart.
 *
 * Markup is specimen 01 / 02 of docs/design/p8-mockup.html, verbatim.
 */
export default function HeroRow({ cards }: { cards: StatCard[] }) {
  return (
    <div className="stats">
      {cards.map((card) => (
        <div className={`stat ${card.tone}`} key={card.key}>
          <div className="stat-top">
            <span className="lbl">{card.label}</span>
            {card.href !== null && (
              <a
                className="more"
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open drafts in ShikksTracker"
              >
                Open ↗
              </a>
            )}
          </div>
          <div className="fig">{card.figure}</div>
          {card.trackPercent !== null && (
            <div className="track">
              <i style={{ width: `${card.trackPercent}%` }} />
            </div>
          )}
          <div className="sub">{card.caption}</div>
        </div>
      ))}
    </div>
  );
}
