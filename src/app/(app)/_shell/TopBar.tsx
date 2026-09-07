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
 * queue page), not a pending-approvals count (two "waiting on you" numbers
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
 * had just read. Subscribing to usePathname() re-renders this on every
 * navigation, and router.refresh() re-renders it too. At minute precision the
 * navigation time IS the read time on both kinds of page: /freelance is
 * rendered by the server at navigation, and queue and settings fetch their
 * APIs on mount. The first paint is still the server's time.
 */
const STAMP = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Manila",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default function TopBar() {
  // Subscribed to, not read: the subscription is the whole point — it is what
  // re-renders the stamp on every navigation. Do not "clean up" this call.
  usePathname();

  const stamp = STAMP.format(new Date());

  return (
    <div className="topbar">
      <div className="topbar-in">
        <span className="crumb">
          {/* One text node, so a minute rollover between the server render and
              hydration is a single mismatch this suppresses rather than a
              logged hydration error. */}
          <em suppressHydrationWarning>{`read ${stamp}`}</em>
        </span>
      </div>
    </div>
  );
}
