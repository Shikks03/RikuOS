import type { NextConfig } from "next";

/**
 * React's DEVELOPMENT build calls eval() for debugging features, and
 * Turbopack's dev client does too — without 'unsafe-eval' the dev server logs
 * a console error on every page. React never uses eval() in production.
 *
 * This is deliberately dev-only: 'unsafe-eval' in production would let any
 * attacker-controlled string become executable code. Do NOT hoist this out of
 * the conditional.
 */
const isDev = process.env.NODE_ENV === "development";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const nextConfig: NextConfig = {
  devIndicators: false,
  /**
   * The queue moved under the Freelance address (R42). This keeps the old one
   * alive: a bookmark, and — the reason it is permanent — an already-installed
   * PWA whose cached start_url still points at the old address.
   *
   * next.config redirects run BEFORE the proxy, so a signed-out hit on the old
   * address becomes /login?from=/freelance/queue and the login page sends the
   * session to the right place. src/proxy.ts is not touched: /freelance/queue
   * is not on its allowlist, which is exactly how the old address was treated.
   *
   * permanent: true is a 308 and browsers cache it hard. That is intended —
   * the address is not coming back — but it means undoing this needs a cache
   * clear, not just a revert.
   */
  async redirects() {
    return [{ source: "/queue", destination: "/freelance/queue", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
