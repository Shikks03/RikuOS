"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconQueue, IconFreelance, IconSettings } from "@/components/icons";

/**
 * One of the shell's three client islands, each for exactly one reason:
 * usePathname() here, an onClick in LogoutButton, a per-navigation Date in
 * TopBar. This is the smallest correct way to mark the active item — no state,
 * no effects, no data. src/proxy.ts could forward the pathname as a header
 * instead and is deliberately NOT touched: it is the app's authorization
 * boundary and must stay boring. Editing a fail-closed security file to save a
 * kilobyte of hydration is a bad trade.
 *
 * Adding /personal later is one entry in this array.
 *
 * All three items carry a glyph. Never a mix.
 */
const NAV = [
  { href: "/queue", label: "Queue", Icon: IconQueue },
  { href: "/freelance", label: "Freelance", Icon: IconFreelance },
  { href: "/settings", label: "Settings", Icon: IconSettings },
] as const;

export default function NavList() {
  const pathname = usePathname();

  return (
    <nav className="app-nav">
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "navitem is-active" : "navitem"}
            aria-current={active ? "page" : undefined}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
