"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLinkStatus } from "next/link";
import { beginLoading, isLoading, subscribeLoading } from "@/lib/navProgress";

/**
 * The top bar and its two signals (smooth-feel spec §3.2, plan deviation 2).
 *
 *   NavProgress   the 2px bar, mounted once in the (app) layout. It reads
 *                 navProgress's count; it never measures progress.
 *   LoadingSignal rendered inside every loading outline and Suspense
 *                 fallback: while it is mounted, something is loading.
 *                 That is the signal that matters on a dynamic route — a
 *                 prefetched loading.tsx commits the navigation at once,
 *                 and from then on only the outline knows the page is
 *                 still coming. `announce` adds the outline's one
 *                 screen-reader `Loading…`; fallbacks stay silent.
 *   LinkPending   a child of an in-app <Link>: covers the moment before an
 *                 outline exists (a route not yet prefetched).
 *
 * The effects touch only navProgress — an external store — and never set
 * React state, so the lint baseline is unchanged.
 */
export default function NavProgress() {
  const on = useSyncExternalStore(subscribeLoading, isLoading, () => false);
  return <div className="navbar" data-on={on ? "true" : "false"} aria-hidden="true" />;
}

export function LoadingSignal({ announce = false }: { announce?: boolean }) {
  useEffect(() => beginLoading(), []);
  return (
    <>
      {/*
       * A dehydrated Suspense fallback's server HTML never mounts on the
       * client until its boundary resolves, so the effect above — and
       * NavProgress's own useSyncExternalStore — never run on first open.
       * This static bar is already "on" in the server HTML itself, so the
       * top bar runs on a hard load with no client code involved. Several
       * fallbacks may each render one; they are identical and fixed-position,
       * so several read as one. feel.css hides it once the live bar (a
       * direct child of .app) is itself "on" (principal review W4).
       */}
      <span className="navbar ol-navbar" data-on="true" aria-hidden="true" />
      {announce && (
        <span className="ol-sr" role="status">
          Loading…
        </span>
      )}
    </>
  );
}

export function LinkPending() {
  const { pending } = useLinkStatus();
  useEffect(() => (pending ? beginLoading() : undefined), [pending]);
  return null;
}
