/**
 * briefingRefresh.ts — the Briefing island's "is this stale" rule (S21 fix
 * round). Pure: no clock, no DOM, no React. The (app) layout is not
 * re-rendered on soft navigation, and an installed PWA can be resumed by the
 * OS long after it was last foregrounded with the shell's last server render
 * still sitting in memory — at 09:00 the greeting line can still read "your
 * briefing comes at 07:00" and the full-screen greeting never shows for a
 * morning that has since arrived.
 *
 * The rule: visibility regained after a long-enough gap since the island last
 * received fresh server props is worth asking the server again
 * (router.refresh()); a short gap — switching apps for a few seconds — is
 * not, or every tab switch would re-fetch the shell's reads.
 */

/** Ten minutes: long enough that a new morning or a new push is plausible,
 *  short enough that a stale greeting line doesn't sit for long. */
export const STALE_REFRESH_MS = 10 * 60 * 1000;

/**
 * `lastPropsAt`/`now` are both epoch milliseconds (`Date.now()`-shaped).
 * A `now` at or before `lastPropsAt` (clock skew, or no time has passed)
 * never refreshes.
 */
export function shouldRefreshOnVisible(lastPropsAt: number, now: number): boolean {
  return now - lastPropsAt >= STALE_REFRESH_MS;
}
