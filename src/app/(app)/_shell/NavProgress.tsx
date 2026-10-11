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
  return announce ? (
    <span className="ol-sr" role="status">
      Loading…
    </span>
  ) : null;
}

export function LinkPending() {
  const { pending } = useLinkStatus();
  useEffect(() => (pending ? beginLoading() : undefined), [pending]);
  return null;
}
