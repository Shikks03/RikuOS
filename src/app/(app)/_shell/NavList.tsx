"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconFreelance, IconPersonal, IconSettings } from "@/components/icons";

/**
 * One of the shell's client islands, each for exactly one reason:
 * usePathname() here, an onClick in LogoutButton, a per-navigation Date in
 * TopBar, and the same hook again in the Freelance segment's ViewSwitch. This
 * is the smallest correct way to mark the active item — no state, no effects,
 * no data. src/proxy.ts could forward the pathname as a header instead and is
 * deliberately NOT touched: it is the app's authorization boundary and must
 * stay boring. Editing a fail-closed security file to save a kilobyte of
 * hydration is a bad trade.
 *
 * Three items. R42 left two: the queue is a VIEW of Freelance, at
 * /freelance/queue, reached by the view switch the segment layout renders —
 * not a page of its own. P10 added /personal as one entry in this array, and
 * FIRST, because the daily page reads first (D13). Nothing else changed: the
 * two matching rules below were already right for it, since /personal has no
 * sub-route and so the prefix match and the equality match agree there.
 *
 * All three items carry a glyph. Never a mix.
 *
 * TWO MATCHES, NOT ONE (R44). The prefix match is the OPPOSITE of the view
 * switch's, which compares for equality: /freelance/queue must light
 * Freelance HERE, because the rail names an AREA, and must light only Queue
 * THERE, because the switch names a VIEW. A prefix match in the switch would
 * light both of its tabs; an equality match here would leave the rail with
 * nothing lit on the Queue view.
 *
 * But only the CLASS follows the area. aria-current="page" follows the PAGE
 * and so uses equality, because ARIA defines `page` as "the current page
 * within a set of pages" and on /freelance/queue this link points at a
 * different URL. Spending one boolean on both would make this link and the
 * switch's Queue link both claim to be the current page on one screen.
 *
 * aria-label because this is now one of two <nav> landmarks; two unnamed ones
 * announce as "navigation" and "navigation".
 */
const NAV = [
  { href: "/personal", label: "Personal", Icon: IconPersonal },
  { href: "/freelance", label: "Freelance", Icon: IconFreelance },
  { href: "/settings", label: "Settings", Icon: IconSettings },
] as const;

export default function NavList() {
  const pathname = usePathname();

  return (
    <nav className="app-nav" aria-label="Main">
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            // .is-active follows the AREA (startsWith): Freelance stays lit on
            // /freelance/queue. aria-current="page" follows the PAGE
            // (equality): on /freelance/queue the current page is the switch's
            // Queue tab, not this link. ViewSwitch matches by equality for both.
            className={active ? "navitem is-active" : "navitem"}
            aria-current={pathname === href ? "page" : undefined}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
