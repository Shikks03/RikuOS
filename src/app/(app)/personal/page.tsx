import type { Metadata } from "next";

/**
 * PLACEHOLDER. Plan A ships the rail's new first nav item, so this route must
 * resolve; Plan C rewrites this file as the real page (force-dynamic, phase 1 /
 * phase 2, six tiles, five islands). Nothing here is load-bearing except the
 * header's shape, which Plan C keeps: the title band sits ABOVE <main>, in
 * .fl-head > .fl, exactly as the Freelance segment's header does, so the band,
 * the top bar and the content share one left edge by construction (P8 R34).
 *
 * The tab title is one word: the root layout carries the `%s · APP_NAME`
 * template, so no page file ever writes the product name (P8 R64).
 */
export const metadata: Metadata = { title: "Personal" };

export default function PersonalPage() {
  return (
    <>
      <div className="fl-head">
        <div className="fl">
          <div className="fl-headrow">
            <h1 className="fl-title">Personal</h1>
          </div>
        </div>
      </div>
      <main className="app-content">
        <div className="fl" />
      </main>
    </>
  );
}
