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
 * The stamp is request-time rather than build-time because the (app) layout
 * reads cookies(), which opts this whole route subtree into dynamic
 * rendering. If that session check is ever removed, this stamp freezes at
 * build time — they are connected.
 */
const STAMP = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Manila",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default function TopBar() {
  return (
    <div className="topbar">
      <div className="topbar-in">
        <span className="crumb">
          <em>read {STAMP.format(new Date())}</em>
        </span>
      </div>
    </div>
  );
}
