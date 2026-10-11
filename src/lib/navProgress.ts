/**
 * navProgress.ts — the top bar's one source of truth (smooth-feel spec §3.2,
 * plan deviation 2). Client-safe, no imports.
 *
 * A COUNT, not a flag: every loading outline, every Suspense fallback and
 * every pending in-app link calls beginLoading() and later the end function
 * it returns, so overlapping loads (the Personal page's outline, then its
 * three calendar fallbacks) keep the bar up until the last one ends.
 *
 * Module state is per browser tab. Nothing here runs on the server: callers
 * use it from effects only, and NavProgress reads it through
 * useSyncExternalStore with a server snapshot of `false`.
 */

let active = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

/** One load began. Returns its end; calling the end twice ends it once. */
export function beginLoading(): () => void {
  active += 1;
  emit();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    active -= 1;
    emit();
  };
}

export function isLoading(): boolean {
  return active > 0;
}

export function subscribeLoading(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Tests only: no loads and no listeners. */
export function resetLoadingForTests(): void {
  active = 0;
  listeners.clear();
}
