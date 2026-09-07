"use client";

import { usePathname } from "next/navigation";

/**
 * 44px, one hairline bottom, and exactly one element: the freshness stamp.
 *
 * No breadcrumb — `Operator` named nobody in a system with exactly one user
 * and was the bar's brightest element, and the crumb's page name restated the
 * page title 70px below it. No pill of any kind: not ShikksTracker
 * reachability (it claims a liveness true only at the instant of render), not
 * push registration (client-only, and it duplicates a control already on the
 * queue view), not a pending-approvals count (two "waiting on you" numbers
 * from two systems on one screen). No search, no bell, no theme toggle.
 *
 * Asia/Manila is load-bearing: a server render on Vercel is UTC and would be
 * eight hours wrong. en-GB is named explicitly because en-US with hour12:false
 * can produce a 24:xx hour at midnight.
 *
 * The stamp is computed on the client at navigation time. A layout is
 * preserved across soft navigations, so a server-rendered stamp froze at the
 * moment the shell was first loaded and was wrong after one rail click — on
 * /freelance it would have under-claimed the freshness of numbers the server
 * had just read. The stamp is therefore a child keyed by the pathname: a
 * navigation changes the key, which remounts the child and recomputes the
 * time. The key is the same on the server and at hydration, so the first paint
 * — still the server's time — hydrates in place rather than remounting.
 * router.refresh() re-renders it too. At minute precision the navigation time
 * IS the read time on both kinds of page: /freelance is rendered by the server
 * at navigation, and queue and settings fetch their APIs on mount.
 */
const STAMP = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Manila",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default function TopBar() {
  const pathname = usePathname();

  return (
    <div className="topbar">
      <div className="topbar-in">
        <span className="crumb">
          <Stamp key={pathname} />
        </span>
      </div>
    </div>
  );
}

/**
 * Remounted by its key on every navigation, so the time is taken then. The
 * dependency on the path is the key rather than a bare usePathname() call,
 * which reached nothing a memoizing compiler could see and would have been
 * free to hoist — freezing the stamp again with nothing to catch it.
 *
 * Both halves are load-bearing and neither is redundant: the hook in TopBar is
 * what re-renders the component at all (a key on a child cannot re-render its
 * parent), and the key is what makes the path a visible dependency of the
 * time. Deleting either one breaks the stamp.
 *
 * router.refresh() re-renders this too — but as a re-render, not a remount:
 * a refresh leaves the key unchanged. That path holds only while nothing
 * memoizes Stamp.
 */
function Stamp() {
  return (
    /* One text node, so a minute rollover between the server render and
       hydration is a single mismatch this suppresses rather than a logged
       hydration error. */
    <em suppressHydrationWarning>{`read ${STAMP.format(new Date())}`}</em>
  );
}
