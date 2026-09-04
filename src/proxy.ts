import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

/**
 * Fail-closed middleware (Next 16 "proxy"), ported from ShikksTracker.
 *
 * Public paths:
 *   /login                — the login page itself
 *   /api/auth/login       — the login POST handler
 *   /api/cron/*           — guarded separately by the cron secret (requireCronSecret)
 *   /api/messenger/*      — guarded separately by the forward secret (requireForwardSecret)
 *   /manifest.webmanifest — iOS fetches the PWA manifest without credentials
 *   /sw.js                — the service worker must stay fetchable when logged out,
 *                           or an expired session would break push delivery updates
 *   /icon, /apple-icon    — generated app icons; the OS fetches these without cookies
 *   /_next/*              — Next.js internals (also excluded by matcher, belt+suspenders)
 *   /favicon.ico          — static asset
 */
export function isPublicPath(pathname: string): boolean {
  // Fail closed on any encoded-traversal / bypass-prone pathname. URL parsing
  // resolves literal "../" segments but does NOT percent-decode, so something
  // like "/api/cron/%2e%2e/queue" would still pass a startsWith() prefix check
  // below while actually routing elsewhere once decoded. Treat any pathname
  // containing "%", "..", or "//" as protected rather than trying to
  // enumerate every bypass encoding.
  if (pathname.includes("%") || pathname.includes("..") || pathname.includes("//")) {
    return false;
  }

  if (
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/messenger/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon")
  ) {
    return true;
  }
  return (
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico"
  );
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Always let public paths through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Fail closed: both secrets must be configured.
  //
  // DASHBOARD_PASSWORD gates /api/auth/login; SESSION_SECRET is the HMAC key
  // for the session cookie. They are deliberately DIFFERENT secrets — the
  // cookie must never be a derivation of the password, or a leaked cookie
  // becomes an offline password-cracking oracle (see src/lib/session.ts).
  // Verify with SESSION_SECRET only; the password is never used as a key here.
  const password = process.env.DASHBOARD_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;
  const missing = !password
    ? "DASHBOARD_PASSWORD"
    : !sessionSecret || sessionSecret.length < 32
      ? "SESSION_SECRET (must be at least 32 characters)"
      : null;

  if (missing) {
    if (isApiPath(pathname)) {
      return NextResponse.json(
        { error: `${missing} is not configured.` },
        { status: 503 }
      );
    }
    return new NextResponse(
      `Service unavailable: ${missing} must be configured before the app can be accessed.`,
      { status: 503, headers: { "Content-Type": "text/plain" } }
    );
  }

  // Validate session cookie
  const token = request.cookies.get(COOKIE_NAME)?.value ?? "";
  const valid = token ? await verifySessionToken(token, sessionSecret!) : false;

  if (valid) {
    return NextResponse.next();
  }

  // Not authenticated
  if (isApiPath(pathname)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Redirect pages to /login with a ?from= param so the login page can redirect back
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *   - _next/static  (static assets)
     *   - _next/image   (image optimisation)
     *   - favicon.ico   (browser default request)
     * Fine-grained public-path logic is done in isPublicPath() above.
     */
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};
