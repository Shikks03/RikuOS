/**
 * google-auth.mts — the one-time Google sign-in, on a throwaway loopback server.
 *
 * Replaces the OAuth bootstrap routes and ALLOW_OAUTH_BOOTSTRAP (R36). Those
 * could not have worked here: `__Host-session` is sameSite "strict" and the
 * proxy fails closed, so Google's cross-site redirect back to an app route
 * arrives without the cookie and 401s before any handler runs. This script
 * needs no running app, no allowlist entry, no production redirect URI.
 *
 * What it does: listens on localhost:8787, prints the consent URL (scopes
 * calendar.events + calendar.readonly, access_type=offline, prompt=consent),
 * receives Google's redirect at /callback, exchanges the code, PRINTS THE
 * REFRESH TOKEN ONCE, and exits. Nothing else it prints is secret: not the
 * client secret, not the code, not the access token.
 *
 * PREREQUISITES (Riku, in Google Cloud Console): an OAuth client whose one
 * authorised redirect URI is exactly http://localhost:8787/callback, the
 * Calendar API enabled, and the consent screen's Publishing status set to
 * "In production" (Testing expires the refresh token every 7 days). Then
 * GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.
 *
 * USAGE:  npm run google:auth
 * Then put the printed token in .env.local and Vercel as GOOGLE_REFRESH_TOKEN.
 */

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const PORT = 8787;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EXCHANGE_TIMEOUT_MS = 15_000;
/** Give up if nobody completes consent in this long. */
const WAIT_MS = 10 * 60_000;

function bounded(s: string, max = 200): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

async function exchange(code: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }).toString(),
    signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON answer; reported by status below.
  }
  const record = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (!res.ok) {
    // Google's error fields name the problem (invalid_client, redirect_uri_mismatch…)
    // and carry no secret; nothing else from the body is printed.
    const error = typeof record.error === "string" ? record.error : "no error code";
    const description = typeof record.error_description === "string" ? `: ${record.error_description}` : "";
    throw new Error(`The token exchange answered ${res.status} (${bounded(error + description)}).`);
  }
  const refresh = record.refresh_token;
  if (typeof refresh !== "string" || refresh === "") {
    throw new Error(
      "Google answered without a refresh token. Revoke this app's access at " +
        "https://myaccount.google.com/permissions and run the script again.",
    );
  }
  return refresh;
}

async function main(): Promise<number> {
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
  const missing = [
    ...(clientId ? [] : ["GOOGLE_CLIENT_ID"]),
    ...(clientSecret ? [] : ["GOOGLE_CLIENT_SECRET"]),
  ];
  if (missing.length > 0) {
    console.error(`${missing.join(" and ")} not set in .env.local. (Value omitted from this message.)`);
    return 1;
  }

  // Binds the one redirect Google sends back to the consent this run started.
  const state = randomBytes(24).toString("hex");
  const consent = `${AUTH_URL}?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString()}`;

  return new Promise<number>((resolve) => {
    let finished = false;
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", REDIRECT_URI);
      if (url.pathname !== "/callback" || finished) {
        res.writeHead(404, { "content-type": "text/plain" }).end("Not found.");
        return;
      }
      const reply = (status: number, text: string) =>
        res.writeHead(status, { "content-type": "text/plain; charset=utf-8" }).end(text);

      const done = (code: number) => {
        finished = true;
        clearTimeout(timer);
        server.close();
        resolve(code);
      };

      if (url.searchParams.get("state") !== state) {
        reply(400, "State mismatch. Start again from the URL the terminal printed.");
        console.error("Ignored a callback whose state did not match this run.");
        return;
      }
      const denied = url.searchParams.get("error");
      if (denied) {
        reply(400, "Google did not grant access. See the terminal.");
        console.error(`Google did not grant access (${bounded(denied)}).`);
        done(1);
        return;
      }
      const code = url.searchParams.get("code");
      if (!code) {
        reply(400, "No code in the callback.");
        console.error("The callback carried no code.");
        done(1);
        return;
      }

      exchange(code, clientId, clientSecret).then(
        (refreshToken) => {
          reply(200, "Signed in. Return to the terminal; you can close this tab.");
          console.log("\nGOOGLE_REFRESH_TOKEN (shown once; put it in .env.local and Vercel):\n");
          console.log(refreshToken);
          console.log("");
          done(0);
        },
        (err: unknown) => {
          reply(502, "The token exchange failed. See the terminal.");
          const name = err instanceof Error ? err.name : "";
          console.error(
            name === "TimeoutError"
              ? `Google's token endpoint did not answer within ${EXCHANGE_TIMEOUT_MS / 1000} s.`
              : err instanceof Error
                ? bounded(err.message, 400)
                : "The token exchange failed.",
          );
          done(1);
        },
      );
    });

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      console.error(`No sign-in completed within ${WAIT_MS / 60_000} minutes. Run the script again.`);
      server.close();
      resolve(1);
    }, WAIT_MS);

    server.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      console.error(
        err.code === "EADDRINUSE"
          ? `Port ${PORT} is in use. Free it and run the script again.`
          : `Could not listen on port ${PORT} (${err.code ?? "unknown error"}).`,
      );
      resolve(1);
    });

    server.listen(PORT, "localhost", () => {
      console.log(`Listening on ${REDIRECT_URI}`);
      console.log("Open this URL, choose the Google account, and allow access:\n");
      console.log(consent);
      console.log("");
    });
  });
}

main().then((code) => process.exit(code));
