/**
 * Hand-drawn stroke glyphs, ported from docs/design/p8-mockup.html.
 *
 * Named exports, no registry: they tree-shake, they are typo-proof under
 * `strict`, and one grep finds every use of a glyph. No "use client" — these
 * are plain server-renderable SVG. No dangerouslySetInnerHTML anywhere.
 *
 * Where the design uses a text glyph (the `↗` on a link, the disclosure
 * chevron) use the literal character or the CSS box, not a component.
 */

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function IconFreelance() {
  return (
    <svg {...stroke}>
      <path d="M3 8.5h18v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />
      <path d="M9 8.5V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

export function IconSettings() {
  return (
    <svg {...stroke}>
      <path d="M4 7.5h8.5" />
      <circle cx="15.5" cy="7.5" r="2.4" />
      <path d="M18.5 7.5H20" />
      <path d="M4 16.5h3.5" />
      <circle cx="10.5" cy="16.5" r="2.4" />
      <path d="M13.5 16.5H20" />
    </svg>
  );
}

/** The 13px info glyph in the `.honesty` note register. Consumed by Plan C. */
export function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5M12 8h.01" />
    </svg>
  );
}

/**
 * The brand sunburst, and the one filled glyph in the set: it sits on the
 * orange gradient tile, so it is painted rather than stroked. The fill is the
 * tile's own dark orange rather than currentColor, exactly as the mockup
 * draws it.
 */
export function IconMark() {
  return (
    <svg viewBox="0 0 24 24" fill="#2A1002" aria-hidden="true">
      <path d="M12 1.6l1.7 6.1 4.5-4.4-2.4 6 6.1-1.7-5.4 3.3 5.4 3.3-6.1-1.7 2.4 6-4.5-4.4L12 22.4l-1.7-6.1-4.5 4.4 2.4-6-6.1 1.7 5.4-3.3-5.4-3.3 6.1 1.7-2.4-6 4.5 4.4z" />
    </svg>
  );
}
