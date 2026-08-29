/**
 * siteHealth.ts — is each watched site answering?
 *
 * ONE check, not three. Certificate expiry and domain expiry were both
 * specified and both dropped on evidence (design P5a-9, P5a-10): every watched
 * host is a *.vercel.app subdomain, so neither the registration nor the
 * certificate is Riku's to renew, and a certificate that actually broke would
 * already fail the fetch below. Do not add them back without a domain he
 * controls.
 *
 * Nothing here throws. A site that is down is a FINDING, reported in the
 * morning digest; only an error in the checking machinery itself makes the
 * site-health run ok:false, because a client site being down for a week must
 * not make the watchdog report the monitoring as broken.
 */

export interface SiteTarget {
  name: string;
  url: string;
}

/**
 * Confirmed with Riku 2026-08-30, all three reachable when checked.
 * ShikksTracker is here because the whole outreach pipeline depends on it and
 * nothing else watches it.
 */
export const SITES: SiteTarget[] = [
  { name: "AzeroTech", url: "https://azerotech.vercel.app" },
  { name: "Meowchi", url: "https://meowchi.vercel.app" },
  { name: "ShikksTracker", url: "https://shikkstracker.vercel.app" },
];

export const SITE_TIMEOUT_MS = 8_000;

export interface SiteResult {
  name: string;
  up: boolean;
  /** One short human-readable line; goes straight into the digest. */
  detail: string;
}

/** Pure. Redirects are followed by fetch, so this judges the final status. */
export function classifyStatus(name: string, status: number): SiteResult {
  if (status >= 400) {
    return { name, up: false, detail: `${name} returned HTTP ${status}` };
  }
  return { name, up: true, detail: `${name} ok` };
}

/** Pure. DNS failure, refused connection and TLS failure all land here. */
export function classifyError(name: string, err: unknown): SiteResult {
  const message = err instanceof Error ? err.message : String(err);
  const timedOut = /abort|timeout|timed out/i.test(message);
  return {
    name,
    up: false,
    detail: `${name} ${timedOut ? "timed out" : "unreachable"}`,
  };
}

export async function checkSite(
  target: SiteTarget,
  timeoutMs: number = SITE_TIMEOUT_MS
): Promise<SiteResult> {
  try {
    const response = await fetch(target.url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    // Release the socket now. Only the status is read, and undici keeps the
    // connection pinned open while a body goes unconsumed — so a check that
    // already finished in milliseconds would otherwise hold a handle until the
    // abort timer fires seconds later.
    void response.body?.cancel().catch(() => {});
    return classifyStatus(target.name, response.status);
  } catch (err) {
    return classifyError(target.name, err);
  }
}

/** All sites in parallel; checkSite never rejects, so neither does this. */
export async function checkSites(
  targets: SiteTarget[] = SITES,
  timeoutMs: number = SITE_TIMEOUT_MS
): Promise<SiteResult[]> {
  return Promise.all(targets.map((target) => checkSite(target, timeoutMs)));
}
