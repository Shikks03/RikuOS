import type { Metadata } from "next";

/**
 * This file exists for ONE reason: /freelance/queue's page is "use client", and
 * a client component cannot export metadata. Since R42 the queue is a VIEW of
 * the Freelance page rather than a page of its own — the rail says `Freelance`
 * on both and the <h1> says `Freelance` on both — so the tab strip is the only
 * place left where the two can be told apart, and both reading the same would
 * solve the wrong half of the problem (R64).
 *
 * It renders NOTHING of its own: no <main>, no header, no wrapper. The segment
 * layout above already draws the title and the view switch, and the queue page
 * below brings its own <main> from legacy.css. A layout that added an element
 * here would put it between them.
 *
 * R18 still stands. The page beside this file is not edited by this plan, and
 * this file does not touch it.
 */
export const metadata: Metadata = { title: "Queue" };

export default function QueueLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
