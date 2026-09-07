import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, assertSessionSecret, verifySessionToken } from "@/lib/session";
import Rail from "./_shell/Rail";
import TopBar from "./_shell/TopBar";

/**
 * Defence in depth. src/proxy.ts already guarantees a session on every path in
 * this group; this exists so that a middleware-matcher typo cannot silently
 * expose the shell. It needs no ?from= — the login page already defaults to
 * /freelance, the landing page (R42).
 *
 * Reading cookies() also opts this whole route subtree into dynamic
 * rendering. Nothing depends on that today — TopBar computes its stamp on the
 * client, and /freelance will declare force-dynamic itself. The session check
 * is the reason this read exists.
 *
 * The secret comes from assertSessionSecret() rather than a third hand-copied
 * `length >= 32`; a missing or weak secret throws there and is treated as no
 * session. redirect() stays OUTSIDE the try: it works by throwing
 * NEXT_REDIRECT, which a catch would swallow.
 */
async function requireSessionOrRedirect(): Promise<void> {
  let secret: string | null = null;
  try {
    secret = assertSessionSecret();
  } catch {
    secret = null;
  }
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? "";
  const valid = secret && token ? await verifySessionToken(token, secret) : false;
  if (!valid) redirect("/login");
}

/**
 * The shell renders NO <main>. Queue, settings and login each render their
 * own, and two <main> elements in one document is invalid HTML. This renders
 * .app, .app-body, .app-side (via Rail), .app-main and .topbar; the pages
 * bring the rest.
 *
 * /login sits outside this group and gets no shell.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSessionOrRedirect();

  return (
    <div className="app">
      <div className="app-body">
        <Rail />
        <div className="app-main">
          <TopBar />
          {children}
        </div>
      </div>
    </div>
  );
}
