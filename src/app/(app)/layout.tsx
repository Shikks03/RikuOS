import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifySessionToken } from "@/lib/session";
import Rail from "./_shell/Rail";
import TopBar from "./_shell/TopBar";

/**
 * Defence in depth. src/proxy.ts already guarantees a session on every path in
 * this group; this exists so that a middleware-matcher typo cannot silently
 * expose the shell. It needs no ?from= — the login page already defaults to
 * /queue.
 *
 * Reading cookies() also opts this whole route subtree into dynamic
 * rendering, which is what makes TopBar's stamp a request time rather than a
 * build time. Do not remove it without moving that guarantee somewhere else.
 */
async function requireSessionOrRedirect(): Promise<void> {
  const secret = process.env.SESSION_SECRET;
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? "";
  const valid =
    secret && secret.length >= 32 && token
      ? await verifySessionToken(token, secret)
      : false;
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
