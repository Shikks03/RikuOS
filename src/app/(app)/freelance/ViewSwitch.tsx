"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The design system's view switch (DESIGN-INSPO §5.3, components.html
 * `.segmented`): a recessed track with a hairline border, the active view a
 * raised fill, left-aligned directly under the heading it modifies. The
 * segment layout renders it under <h1>Freelance</h1>, above both views.
 *
 * The shell's fourth client island, and like the other three it exists for
 * exactly one reason: usePathname() for the active state. No data, no state,
 * no effects.
 *
 * LINKS, NOT A TABLIST. role="tab" describes panels swapped in place — no
 * address change, aria-controls into the same document, and roving-tabindex
 * arrow keys the author must implement. These are two real routes: bookmarked,
 * back-buttoned, and /freelance/queue is what every push notification opens.
 * Calling them tabs would describe an interaction this page does not have.
 *
 * EQUALITY FOR BOTH THE CLASS AND aria-current. /freelance is a prefix of
 * /freelance/queue, so a prefix match would light BOTH tabs on the Queue
 * view. The rail's NavList uses startsWith for its CLASS, for the opposite
 * reason — it names an area, so Freelance must stay lit there — and equality
 * for its aria-current, so that link and this one do not both claim to be the
 * current page on one screen (R44). Here the area and the page are the same
 * thing, so one test serves both. A future /freelance/queue/:id would light
 * neither tab; there is no such route, and it is one line to change when
 * there is.
 *
 * aria-label because this is now the document's second <nav>; an unnamed pair
 * of navigation landmarks is announced as "navigation" twice.
 */
const VIEWS = [
  { href: "/freelance", label: "Dashboard" },
  { href: "/freelance/queue", label: "Queue" },
] as const;

export default function ViewSwitch() {
  const pathname = usePathname();

  return (
    <nav className="segmented" aria-label="Freelance views">
      {VIEWS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={active ? "on" : undefined}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
