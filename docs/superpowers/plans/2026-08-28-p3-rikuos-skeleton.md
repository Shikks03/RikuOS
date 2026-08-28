# P3 — RikuOS Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the RikuOS skeleton (ROADMAP.md P3, tasks 3.1–3.6): Next.js scaffold with ported ShikksTracker auth/db patterns, the five core Mongoose models with discriminators, login, the Approval Queue page with guarded state transitions, and iOS web push.

**Architecture:** Single-user Next.js App Router app (mobile-first PWA) with a fail-closed proxy middleware, `__Host-` HMAC session cookie, and Mongoose against the `rikuos` Atlas database. The Approval Queue is the core surface: items are created only via a seed script in P3 (the chaser is P4), decided through guarded atomic updates (`findOneAndUpdate` with the expected current status in the filter), and executed through a per-type action-executor registry (no-op in P3). Web push (VAPID) reaches the iPhone lock screen.

**Tech Stack:** Next.js 16.2.10 · React 19.2.4 · TypeScript strict · Mongoose ^9.7.3 · Vitest ^4.1.10 · web-push ^3.6.7 · deployed on Vercel (region hkg1).

**Boundaries (hard rules from CLAUDE.md):**
- Never edit anything in `../ShikksTracker`; reading it for reference is fine.
- No `Schema.Types.Mixed`; every String bounded; every closed set an enum.
- No P4 work: no ShikksTracker API client, no Anthropic calls, no chaser cron.
- UI stays plain and dense; the visual pass is P8.
- Never hardcode the product name in user-visible strings — use `APP_NAME` from `src/lib/constants.ts`.
- Done requires `npm test` + `npx tsc --noEmit` + `npm run build` all green, plus the on-device acceptance test (Task 14).

**Porting note:** Files marked *(ported)* are taken from ShikksTracker (`../ShikksTracker/src/...`) with only naming changes. The full text is reproduced in this plan — do not go re-derive it; copy what is written here.

---

## File structure

```
RikuOS/
├── package.json                 # pinned deps, test + migrate scripts
├── tsconfig.json                # strict, @/* → src/*, allows .ts imports for scripts
├── next.config.ts               # security headers + CSP (ported)
├── vitest.config.ts             # node env, src/lib/__tests__ only
├── eslint.config.mjs            # eslint-config-next flat config (ported)
├── vercel.json                  # region hkg1 + daily expiry cron
├── .env.example                 # names + comments, never values
├── .gitignore
├── public/
│   └── sw.js                    # service worker: push display + click → /queue
├── scripts/
│   ├── sync-indexes.mts         # dry-run-by-default index migration (ported, generalized)
│   └── seed-approval.mts        # seeds one pending followup-draft item (P3 acceptance)
└── src/
    ├── proxy.ts                 # fail-closed middleware, public allowlist (ported)
    ├── lib/
    │   ├── constants.ts         # APP_NAME — the only place the product name lives
    │   ├── env.ts               # envInt, parseLimit (ported)
    │   ├── db.ts                # cached Mongoose connection (ported)
    │   ├── session.ts           # Edge-safe HMAC v2 session tokens (ported)
    │   ├── auth.ts              # requireSession + requireCronSecret (ported; cron guard also accepts Vercel's Bearer header)
    │   ├── loginRateLimit.ts    # Mongo-backed per-IP + global lockout (ported)
    │   ├── osSettings.ts        # singleton accessor (upsert pattern)
    │   ├── queue.ts             # decision parsing, guarded-update builders, expiry sweep, action executors
    │   ├── push.ts              # payload building, subscription parsing, send-to-all
    │   └── __tests__/           # env, session, loginRateLimit, proxy, models, queue, push
    ├── models/
    │   ├── ApprovalItem.ts      # discriminator base; statuses, sources, action state
    │   ├── approvals/
    │   │   └── FollowupDraftApproval.ts   # the one P3 discriminator (typed payload)
    │   ├── AgentRun.ts          # TTL 90 d
    │   ├── PushSubscription.ts  # endpoint unique
    │   ├── OsSettings.ts        # singleton
    │   └── LoginAttempt.ts      # TTL 15 min (ported)
    └── app/
        ├── layout.tsx           # metadata + appleWebApp, imports globals.css
        ├── globals.css          # plain, dense, mobile-first
        ├── page.tsx             # redirect → /queue
        ├── manifest.ts          # PWA manifest (standalone, start_url /queue)
        ├── icon.tsx             # generated 512×512 placeholder icon (no binary assets)
        ├── apple-icon.tsx       # generated 180×180 apple-touch-icon
        ├── login/page.tsx
        ├── queue/
        │   ├── page.tsx         # list + approve/edit/reject
        │   └── PushControls.tsx # enable-notifications + test-push buttons
        └── api/
            ├── auth/login/route.ts      # ported login handler
            ├── auth/logout/route.ts     # ported
            ├── queue/route.ts           # GET list (bounded, lazy expiry sweep)
            ├── queue/[id]/decide/route.ts  # POST approve/edit/reject
            ├── push/subscribe/route.ts  # POST upsert subscription
            ├── push/test/route.ts       # POST test notification
            └── cron/expire/route.ts     # GET sweep + AgentRun + failure alert
```

**Environment variables** (`.env.example` is written in Task 1): `MONGODB_URI` (must include the `/rikuos` db name), `DASHBOARD_PASSWORD` (≥12 chars), `SESSION_SECRET` (≥32 chars, never derived from the password), `APP_BASE_URL`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, optional `LOGIN_MAX_PER_IP` / `LOGIN_MAX_GLOBAL` / `LOGIN_WINDOW_MINUTES`.

**Prerequisite:** Node ≥ 22.6 (the `scripts/*.mts` files run via `node --experimental-strip-types`, same as ShikksTracker).

---

### Task 1: Scaffold

The repo currently contains only docs (`ARCHITECTURE.md`, `CLAUDE.md`, `RIKUOS_CONCEPT.md`, `docs/`) and a minimal `.gitignore`. Scaffold by writing files directly (no `create-next-app` — deterministic, and the repo is not empty).

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `.env.example`
- Create: `src/lib/constants.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/manifest.ts`, `src/app/icon.tsx`, `src/app/apple-icon.tsx`
- Modify: `.gitignore`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "rikuos",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "migrate:indexes": "node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/sync-indexes.mts",
    "migrate:indexes:apply": "node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/sync-indexes.mts --apply",
    "seed:approval": "node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/seed-approval.mts"
  },
  "dependencies": {
    "mongoose": "^9.7.3",
    "next": "16.2.10",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "web-push": "^3.6.7"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/web-push": "^3.6.4",
    "eslint": "^9",
    "eslint-config-next": "16.2.10",
    "typescript": "^5",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`** (ported from ShikksTracker; the `allowImportingTsExtensions` comment applies to our `scripts/*.mts` too)

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.ts`** (ported — security headers + CSP; the dev-only `unsafe-eval` conditional must stay conditional)

```ts
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
```

- [ ] **Step 4: Write `vitest.config.ts`** (ported)

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // Only run files in src/lib/__tests__/ to avoid picking up Next.js page/route files
    include: ["src/lib/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 5: Write `eslint.config.mjs`** (ported)

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
```

- [ ] **Step 6: Replace `.gitignore`** with the full Next.js set (keep any existing entries that still apply)

```
node_modules/
.next/
out/
build/
*.tsbuildinfo
next-env.d.ts
.env
.env.*
!.env.example
.vercel
.DS_Store
```

- [ ] **Step 7: Write `.env.example`** (names and comments only — never values; CLAUDE.md)

```
# --- Database ---
MONGODB_URI=             # Atlas connection string INCLUDING the /rikuos database name.
                         # mongodb+srv:// is REQUIRED in production (enforced in src/lib/db.ts).

# --- Auth ---
DASHBOARD_PASSWORD=      # required — login password; MINIMUM 12 CHARS (login fails closed with 503 below that)
SESSION_SECRET=          # required — HMAC key for the session cookie. MINIMUM 32 CHARS, random,
                         # and MUST be different from DASHBOARD_PASSWORD (never derived from it).
                         # PowerShell: -join ((1..32) | % { '{0:x2}' -f (Get-Random -Max 256) })
                         # Rotating this value invalidates all sessions — it is the revocation lever.
APP_BASE_URL=            # canonical origin, e.g. https://<app>.vercel.app — used for the Origin check on mutations

# --- Cron ---
CRON_SECRET=             # protects /api/cron/*. Vercel native crons send it automatically as
                         # "Authorization: Bearer <value>" when this env var is set on the project;
                         # manual curl tests can use the x-cron-secret header instead.

# --- Web push (generate the keypair with: npx web-push generate-vapid-keys) ---
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=                  # mailto: address, e.g. mailto:you@example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=   # SAME value as VAPID_PUBLIC_KEY (inlined into the client bundle;
                                # the public key is not a secret — the private key must never get
                                # a NEXT_PUBLIC_ prefix)

# --- Optional login rate-limit tuning (defaults shown) ---
# LOGIN_MAX_PER_IP=5          # failed logins per IP before a 429 lockout
# LOGIN_MAX_GLOBAL=20         # failed logins across all IPs in the window
# LOGIN_WINDOW_MINUTES=15     # lockout window; also the TTL on LoginAttempt docs

# --- Reserved for P4 (follow-up chaser) — NOT used in P3 ---
# ST_API_BASE_URL=
# ST_API_SECRET=
# ANTHROPIC_API_KEY=
```

- [ ] **Step 8: Write `src/lib/constants.ts`**

```ts
/**
 * APP_NAME is the single place the product name lives. The name may still
 * change (RIKUOS_CONCEPT.md §7), so user-visible strings must always use this
 * constant, never a literal.
 */
export const APP_NAME = "RikuOS";
```

- [ ] **Step 9: Write `src/app/globals.css`** (plain and dense on purpose — D10; the visual pass is P8)

```css
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 15px;
  line-height: 1.45;
  color: #111;
  background: #fff;
  -webkit-font-smoothing: antialiased;
}
main {
  max-width: 640px;
  margin: 0 auto;
  padding: 12px calc(12px + env(safe-area-inset-right))
    calc(24px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left));
}
h1 { font-size: 20px; margin: 8px 0 12px; }
button {
  font: inherit;
  padding: 8px 14px;
  border: 1px solid #111;
  background: #111;
  color: #fff;
  border-radius: 4px;
}
button:disabled { opacity: 0.5; }
button.secondary { background: #fff; color: #111; }
button.danger { border-color: #b00020; background: #fff; color: #b00020; }
input, textarea {
  font: inherit;
  width: 100%;
  padding: 8px;
  border: 1px solid #bbb;
  border-radius: 4px;
}
label { display: block; font-size: 13px; margin-bottom: 4px; color: #444; }
.error { color: #b00020; font-size: 14px; }
.card { border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; }
.meta { font-size: 12.5px; color: #666; }
.row { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.badge { font-size: 11.5px; border: 1px solid #bbb; border-radius: 3px; padding: 1px 6px; color: #555; }
pre.body { white-space: pre-wrap; font: inherit; background: #f6f6f6; padding: 8px; border-radius: 4px; margin: 8px 0 0; }
```

- [ ] **Step 10: Write `src/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  appleWebApp: { capable: true, statusBarStyle: "default", title: APP_NAME },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 11: Write `src/app/page.tsx`** (the Approval Queue is the core surface — the root just goes there)

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/queue");
}
```

- [ ] **Step 12: Write `src/app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    start_url: "/queue",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111111",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
```

- [ ] **Step 13: Write `src/app/icon.tsx` and `src/app/apple-icon.tsx`** (generated at build — no binary assets to manage; placeholder mark until the P8 design pass. iOS ignores manifest icons and uses the apple-touch-icon, which Next injects automatically from `apple-icon.tsx`.)

`src/app/icon.tsx`:

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111",
          color: "#fff",
          fontSize: 320,
          fontWeight: 700,
        }}
      >
        R
      </div>
    ),
    { ...size }
  );
}
```

`src/app/apple-icon.tsx`:

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111",
          color: "#fff",
          fontSize: 112,
          fontWeight: 700,
        }}
      >
        R
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 14: Install and verify**

Run: `npm install`
Expected: completes without errors; `package-lock.json` created.

Run: `npm run build`
Expected: `✓ Compiled successfully` — the build needs no env vars (nothing connects to Mongo at build time).

Run: `npx tsc --noEmit`
Expected: no output (exit 0).

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with PWA manifest and security headers"
```

---

### Task 2: Env helpers + DB connection

**Files:**
- Create: `src/lib/env.ts` *(ported)*, `src/lib/db.ts` *(ported)*
- Test: `src/lib/__tests__/env.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/env.test.ts`

```ts
import { describe, it, expect, afterEach } from "vitest";
import { envInt, parseLimit } from "@/lib/env";

describe("envInt", () => {
  afterEach(() => {
    delete process.env.TEST_ENV_INT;
  });

  it("falls back when unset", () => {
    expect(envInt("TEST_ENV_INT", 7)).toBe(7);
  });

  it("parses a valid integer", () => {
    process.env.TEST_ENV_INT = "42";
    expect(envInt("TEST_ENV_INT", 7)).toBe(42);
  });

  it("falls back on a non-numeric value", () => {
    process.env.TEST_ENV_INT = "abc";
    expect(envInt("TEST_ENV_INT", 7)).toBe(7);
  });
});

describe("parseLimit", () => {
  const sp = (v?: string) => new URLSearchParams(v === undefined ? "" : `limit=${v}`);

  it("defaults when absent", () => {
    expect(parseLimit(sp(), 50, 100)).toBe(50);
  });

  it("parses a value within range", () => {
    expect(parseLimit(sp("10"), 50, 100)).toBe(10);
  });

  it("clamps to max", () => {
    expect(parseLimit(sp("999"), 50, 100)).toBe(100);
  });

  it("clamps to at least 1", () => {
    expect(parseLimit(sp("0"), 50, 100)).toBe(1);
  });

  it("defaults on garbage", () => {
    expect(parseLimit(sp("abc"), 50, 100)).toBe(50);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/env.test.ts`
Expected: FAIL — cannot resolve `@/lib/env`.

- [ ] **Step 3: Write `src/lib/env.ts`** (ported; `parseOffset` deliberately not ported — nothing in P3 paginates)

```ts
/**
 * env.ts — small server-side env helpers (ported from ShikksTracker).
 */

/** Parse an integer environment variable, falling back when unset or invalid. */
export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Parse a `limit` query param, clamped to `[1, max]`. Falls back to `def`
 * when the param is absent or fails to parse to a finite number. Every list
 * endpoint bounds its result set with this (CLAUDE.md).
 */
export function parseLimit(searchParams: URLSearchParams, def: number, max: number): number {
  const raw = searchParams.get("limit");
  if (!raw) return def;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return def;
  return Math.min(Math.max(1, parsed), max);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/env.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Write `src/lib/db.ts`** (ported verbatim — no unit test; it needs a live DB and its behavior is proven upstream)

```ts
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

// Mongoose 9 defaults strictQuery to false, which lets a filter path that
// doesn't exist in the schema pass straight through to Mongo unfiltered
// instead of being stripped/rejected. Pin it to true at module scope (a
// global mongoose setting, not per-connection) so an unexpected field in a
// query object can't silently widen a filter.
mongoose.set("strictQuery", true);

/**
 * Global cache so that hot reloads (Next.js dev) and serverless lambda
 * invocations reuse an existing connection instead of creating a new one.
 *
 * The cache is cleared on connection failure so the next call retries
 * instead of returning a permanently-rejected promise.
 */
declare global {
  // eslint-disable-next-line no-var
  var _mongoosePromise: Promise<typeof mongoose> | undefined;
}

/**
 * Validate the URI scheme before connecting. Never include the URI itself
 * in a thrown message — it carries the DB credentials.
 *
 *  - Always require mongodb:// or mongodb+srv://.
 *  - In production, require mongodb+srv:// specifically: SRV connection
 *    strings imply TLS, so this enforces transport encryption in prod
 *    without breaking a local plain mongodb:// dev server.
 */
function assertValidUriScheme(uri: string): void {
  const isMongoScheme = uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://");
  if (!isMongoScheme) {
    throw new Error(
      "MONGODB_URI must start with mongodb:// or mongodb+srv:// (URI omitted from this message; it contains credentials)."
    );
  }
  if (process.env.NODE_ENV === "production" && !uri.startsWith("mongodb+srv://")) {
    throw new Error(
      "MONGODB_URI must use the mongodb+srv:// scheme in production (SRV implies TLS). " +
        "URI omitted from this message; it contains credentials."
    );
  }
}

export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI environment variable is not set. " +
        "Add it to .env.local before calling connectDB()."
    );
  }

  // Scheme validation happens here (per-call), not at module scope — an
  // import-time throw would break the build even for code paths that never
  // call connectDB().
  assertValidUriScheme(MONGODB_URI);

  if (!global._mongoosePromise) {
    global._mongoosePromise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      autoIndex: process.env.NODE_ENV !== "production",
    });
  }

  try {
    return await global._mongoosePromise;
  } catch (err) {
    global._mongoosePromise = undefined;
    throw err;
  }
}
```

- [ ] **Step 6: Verify types and commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add src/lib/env.ts src/lib/db.ts src/lib/__tests__/env.test.ts
git commit -m "feat: env helpers and cached Mongoose connection"
```

---

### Task 3: Session tokens

**Files:**
- Create: `src/lib/session.ts` *(ported verbatim)*
- Test: `src/lib/__tests__/session.test.ts` *(ported)*

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/session.test.ts`

```ts
/**
 * Unit tests for src/lib/session.ts (ported from ShikksTracker).
 *
 * Covers: v2 token round-trip, rejection of the old 2-part format (the
 * regression guard for the "HMAC keyed by the raw password" vulnerability),
 * tamper detection (MAC + expiry), expiry, cross-secret rejection,
 * malformed-input shapes, and assertSessionSecret's fail-closed behavior.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  assertSessionSecret,
} from "@/lib/session";

const SECRET_A = "a".repeat(32);
const SECRET_B = "b".repeat(32);

describe("createSessionToken / verifySessionToken", () => {
  it("round-trips: a token created with secret S verifies true with S", async () => {
    const token = await createSessionToken(SECRET_A);
    expect(await verifySessionToken(token, SECRET_A)).toBe(true);
  });

  it("produces the v2.<jti>.<issuedAt>.<expiresAt>.<hmac> shape", async () => {
    const token = await createSessionToken(SECRET_A);
    const parts = token.split(".");
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe("v2");
    expect(parts[1].length).toBeGreaterThan(0); // jti (uuid)
    expect(Number.isFinite(parseInt(parts[2], 10))).toBe(true); // issuedAt
    expect(Number.isFinite(parseInt(parts[3], 10))).toBe(true); // expiresAt
    expect(parts[4]).toMatch(/^[0-9a-f]{64}$/); // hex-encoded SHA-256 HMAC
  });

  it("rejects the old 2-part format '<expiresAtMs>.<hex-hmac>' outright", async () => {
    const farFuture = Date.now() + 1000 * 60 * 60 * 24 * 30;
    const oldStyleToken = `${farFuture}.${"a".repeat(64)}`;
    expect(await verifySessionToken(oldStyleToken, SECRET_A)).toBe(false);
  });

  it("rejects a token with a tampered HMAC", async () => {
    const token = await createSessionToken(SECRET_A);
    const parts = token.split(".");
    const tamperedHex =
      parts[4].slice(0, -1) + (parts[4].slice(-1) === "0" ? "1" : "0");
    const tampered = [...parts.slice(0, 4), tamperedHex].join(".");
    expect(await verifySessionToken(tampered, SECRET_A)).toBe(false);
  });

  it("rejects a token with a tampered expiry (prefix changed, MAC stale)", async () => {
    const token = await createSessionToken(SECRET_A);
    const parts = token.split(".");
    const bumpedExpiry = String(parseInt(parts[3], 10) + 1000 * 60 * 60 * 24 * 365);
    const tampered = [parts[0], parts[1], parts[2], bumpedExpiry, parts[4]].join(".");
    expect(await verifySessionToken(tampered, SECRET_A)).toBe(false);
  });

  it("rejects an expired token", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2020-01-01T00:00:00Z"));
      const token = await createSessionToken(SECRET_A);

      vi.setSystemTime(new Date("2020-01-15T00:00:00Z")); // 14 days later, past the 7-day max age
      expect(await verifySessionToken(token, SECRET_A)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(SECRET_A);
    expect(await verifySessionToken(token, SECRET_B)).toBe(false);
  });

  describe("malformed inputs", () => {
    it.each([
      ["empty string", ""],
      ["one part", "v2"],
      ["four parts", "v2.jti.123.456"],
      ["six parts", "v2.jti.123.456.abc.def"],
      ["wrong version", "v1.jti.123.456." + "a".repeat(64)],
      ["empty jti", "v2..123.456." + "a".repeat(64)],
      ["non-numeric issuedAt", "v2.jti.abc.456." + "a".repeat(64)],
      ["non-numeric expiresAt", "v2.jti.123.xyz." + "a".repeat(64)],
    ])("rejects %s", async (_label, token) => {
      expect(await verifySessionToken(token, SECRET_A)).toBe(false);
    });
  });
});

describe("assertSessionSecret", () => {
  const ORIGINAL = process.env.SESSION_SECRET;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = ORIGINAL;
  });

  it("throws when SESSION_SECRET is unset", () => {
    delete process.env.SESSION_SECRET;
    expect(() => assertSessionSecret()).toThrow(/not set/);
  });

  it("throws when SESSION_SECRET is shorter than 32 chars", () => {
    process.env.SESSION_SECRET = "short";
    expect(() => assertSessionSecret()).toThrow(/too short/);
  });

  it("returns the secret when valid", () => {
    process.env.SESSION_SECRET = "s".repeat(32);
    expect(assertSessionSecret()).toBe("s".repeat(32));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/session.test.ts`
Expected: FAIL — cannot resolve `@/lib/session`.

- [ ] **Step 3: Write `src/lib/session.ts`** (ported verbatim — this file is Edge-safe on purpose: the proxy runs it)

```ts
/**
 * session.ts — Edge-safe session token helpers (Web Crypto only, no Node imports).
 * Ported verbatim from ShikksTracker.
 *
 * Token format (v2): "v2.<jti>.<issuedAtMs>.<expiresAtMs>.<hex-hmac-sha256>"
 * The HMAC is computed over the exact prefix string
 * "v2.<jti>.<issuedAtMs>.<expiresAtMs>" (verbatim, including the "v2." and the dots).
 *
 * The HMAC key is `SESSION_SECRET` — a dedicated, random, 32+ char secret.
 * It is NEVER the dashboard login password. Historically the upstream file
 * signed with the password itself, which meant a leaked cookie was an offline
 * password-cracking oracle (one SHA-256 per guess, no salt, no KDF) — that
 * bug is why SESSION_SECRET exists as a separate, unrelated secret.
 *
 * The old 2-part format ("<expiresAtMs>.<hex-hmac>") is rejected outright with
 * no fallback — there is no code path that verifies a token against the
 * password.
 */

const COOKIE_NAME = "__Host-session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

const TOKEN_VERSION = "v2";

// ── Internal helpers ──────────────────────────────────────────────────────────

async function importKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Compares two hex strings of the same expected length.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ── Public API ────────────────────────────────────────────────────────────────

export { COOKIE_NAME, MAX_AGE_SECONDS };

/**
 * Reads SESSION_SECRET from the environment and validates it is present and
 * strong enough (>= 32 chars). Throws a clear Error otherwise so callers fail
 * loudly rather than silently signing with a weak/missing key.
 */
export function assertSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET environment variable is not set. It must be a random " +
        "string of at least 32 characters, distinct from DASHBOARD_PASSWORD."
    );
  }
  if (secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is too short. It must be at least 32 characters long."
    );
  }
  return secret;
}

/**
 * Creates a signed session token string.
 * Format: "v2.<jti>.<issuedAtMs>.<expiresAtMs>.<hmac-hex>"
 */
export async function createSessionToken(secret: string): Promise<string> {
  const jti = crypto.randomUUID();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + MAX_AGE_SECONDS * 1000;
  const prefix = `${TOKEN_VERSION}.${jti}.${issuedAt}.${expiresAt}`;

  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(prefix));
  return `${prefix}.${bufToHex(sig)}`;
}

/**
 * Verifies a session token.
 * Returns true only if the token is exactly the v2 5-part shape, the HMAC is
 * valid, AND the token has not expired. Returns false for any malformed,
 * tampered, expired, or old-format token.
 */
export async function verifySessionToken(
  token: string,
  secret: string
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 5) return false;

  const [version, jti, issuedAtStr, expiresAtStr, providedHex] = parts;
  if (version !== TOKEN_VERSION) return false;
  if (!jti) return false;

  const issuedAt = parseInt(issuedAtStr, 10);
  const expiresAt = parseInt(expiresAtStr, 10);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return false;

  // Recompute the HMAC over the RAW prefix substring taken verbatim from the
  // token — never over a re-serialization of the parsed numbers — so a
  // string like "12abc" for issuedAt/expiresAt can't be silently normalized
  // into a numerically-equal-but-differently-spelled prefix that still
  // passes a re-serialized HMAC check.
  const dotIdx4 = token.lastIndexOf(".");
  const prefix = token.slice(0, dotIdx4);

  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(prefix));
  const expectedHex = bufToHex(sig);

  // Compute both checks as separate consts, then AND them — never short-circuit
  // (e.g. `if (!hmacOk) return false; return notExpired;`) — because that shape
  // makes the total time-to-response depend on which check failed, which is
  // exactly the kind of timing signal constant-time comparison is meant to deny
  // an attacker probing for a valid-but-expired vs. invalid-signature token.
  const hmacOk = constantTimeEqual(expectedHex, providedHex);
  const notExpired = expiresAt > Date.now();

  return hmacOk && notExpired;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/session.test.ts`
Expected: PASS (18 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts src/lib/__tests__/session.test.ts
git commit -m "feat: Edge-safe HMAC session tokens"
```

---

### Task 4: Login rate limiting

**Files:**
- Create: `src/models/LoginAttempt.ts` *(ported)*, `src/lib/loginRateLimit.ts` *(ported)*
- Test: `src/lib/__tests__/loginRateLimit.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/loginRateLimit.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { isLockedOut, getClientIp } from "@/lib/loginRateLimit";

describe("isLockedOut", () => {
  it("is not locked below both thresholds", () => {
    expect(isLockedOut(4, 10, 5, 20)).toBe(false);
  });

  it("locks at exactly the per-IP threshold (inclusive boundary)", () => {
    expect(isLockedOut(5, 5, 5, 20)).toBe(true);
  });

  it("locks at the global threshold even when the IP is clean", () => {
    expect(isLockedOut(0, 20, 5, 20)).toBe(true);
  });
});

describe("getClientIp", () => {
  function reqWithXff(value?: string): NextRequest {
    const headers = value === undefined ? undefined : { "x-forwarded-for": value };
    return new NextRequest("http://localhost/api/auth/login", { headers });
  }

  it("returns 'unknown' when the header is absent", () => {
    expect(getClientIp(reqWithXff())).toBe("unknown");
  });

  it("takes the first hop, trimmed", () => {
    expect(getClientIp(reqWithXff(" 203.0.113.7 , 10.0.0.1"))).toBe("203.0.113.7");
  });

  it("caps the value at 64 characters", () => {
    expect(getClientIp(reqWithXff("x".repeat(200)))).toHaveLength(64);
  });

  it("returns 'unknown' for an empty first hop", () => {
    expect(getClientIp(reqWithXff(" , 10.0.0.1"))).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/loginRateLimit.test.ts`
Expected: FAIL — cannot resolve `@/lib/loginRateLimit`.

- [ ] **Step 3: Write `src/models/LoginAttempt.ts`** (ported verbatim)

```ts
import mongoose, { Document, Schema } from "mongoose";

export interface ILoginAttempt extends Document {
  ip: string;
  createdAt: Date;
}

const LoginAttemptSchema = new Schema<ILoginAttempt>(
  {
    ip: {
      type: String,
      required: true,
      maxlength: 64,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { strict: true }
);

// TTL index — failed-attempt records auto-expire 15 minutes after creation,
// so the collection never grows unbounded and old failures stop counting
// against the lockout window on their own.
LoginAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 900 });

// Supports the per-IP failure count query (ip match, newest first).
LoginAttemptSchema.index({ ip: 1, createdAt: -1 });

const LoginAttempt =
  (mongoose.models.LoginAttempt as mongoose.Model<ILoginAttempt>) ||
  mongoose.model<ILoginAttempt>("LoginAttempt", LoginAttemptSchema);

export default LoginAttempt;
```

- [ ] **Step 4: Write `src/lib/loginRateLimit.ts`** (ported verbatim)

```ts
/**
 * loginRateLimit.ts — Mongo-backed login rate limiting (ported from
 * ShikksTracker).
 *
 * Serverless instances don't share memory, so an in-process counter would
 * only ever see a fraction of the requests — every failed attempt is
 * recorded in the LoginAttempt collection instead (TTL 15 min) and counted
 * per-IP (strict) and globally (loose, catches a distributed guesser).
 */

import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { envInt } from "@/lib/env";
import LoginAttempt from "@/models/LoginAttempt";

const MAX_IP_LENGTH = 64;

/**
 * Pure decision function — no I/O — so it is unit-testable without a DB.
 * Locked out if either the per-IP count or the global count has reached its
 * threshold. Boundary is inclusive: exactly `max` failures already locks.
 */
export function isLockedOut(
  ipFailures: number,
  globalFailures: number,
  maxPerIp: number,
  maxGlobal: number
): boolean {
  return ipFailures >= maxPerIp || globalFailures >= maxGlobal;
}

/** First hop of X-Forwarded-For, trimmed, capped at 64 chars; "unknown" if absent. */
export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (!xff) return "unknown";
  const first = xff.split(",")[0]?.trim();
  if (!first) return "unknown";
  return first.slice(0, MAX_IP_LENGTH);
}

function getThresholds() {
  return {
    maxPerIp: envInt("LOGIN_MAX_PER_IP", 5),
    maxGlobal: envInt("LOGIN_MAX_GLOBAL", 20),
    windowMinutes: envInt("LOGIN_WINDOW_MINUTES", 15),
  };
}

export async function checkLoginRateLimit(
  ip: string
): Promise<{ locked: boolean; retryAfterSeconds: number }> {
  await connectDB();

  const { maxPerIp, maxGlobal, windowMinutes } = getThresholds();
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  const [ipFailures, globalFailures] = await Promise.all([
    LoginAttempt.countDocuments({ ip, createdAt: { $gte: windowStart } }),
    LoginAttempt.countDocuments({ createdAt: { $gte: windowStart } }),
  ]);

  const locked = isLockedOut(ipFailures, globalFailures, maxPerIp, maxGlobal);
  return { locked, retryAfterSeconds: windowMinutes * 60 };
}

export async function recordLoginFailure(ip: string): Promise<void> {
  await connectDB();
  await LoginAttempt.create({ ip, createdAt: new Date() });
}

export async function clearLoginFailures(ip: string): Promise<void> {
  await connectDB();
  await LoginAttempt.deleteMany({ ip });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/loginRateLimit.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/models/LoginAttempt.ts src/lib/loginRateLimit.ts src/lib/__tests__/loginRateLimit.test.ts
git commit -m "feat: Mongo-backed login rate limiting"
```

---

### Task 5: Auth guards + fail-closed proxy

**Files:**
- Create: `src/lib/auth.ts` *(ported; cron guard extended)*, `src/proxy.ts` *(ported; RikuOS allowlist)*
- Test: `src/lib/__tests__/proxy.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/proxy.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { isPublicPath } from "@/proxy";

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/api/auth/login",
    "/api/cron/expire",
    "/manifest.webmanifest",
    "/sw.js",
    "/favicon.ico",
    "/_next/static/chunk.js",
    "/icon",
    "/apple-icon",
  ])("allows %s", (p) => {
    expect(isPublicPath(p)).toBe(true);
  });

  it.each(["/", "/queue", "/api/queue", "/api/push/test", "/api/auth/logout"])(
    "protects %s",
    (p) => {
      expect(isPublicPath(p)).toBe(false);
    }
  );

  it.each([
    "/api/cron/%2e%2e/queue",
    "/api/cron/../queue",
    "//evil.example",
    "/login/../api/queue",
  ])("fails closed on bypass-prone pathname %s", (p) => {
    expect(isPublicPath(p)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/proxy.test.ts`
Expected: FAIL — cannot resolve `@/proxy`.

- [ ] **Step 3: Write `src/proxy.ts`** (Next 16 middleware; ported with the RikuOS public allowlist. `isPublicPath` is exported for the test.)

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

/**
 * Fail-closed middleware (Next 16 "proxy"), ported from ShikksTracker.
 *
 * Public paths:
 *   /login                — the login page itself
 *   /api/auth/login       — the login POST handler
 *   /api/cron/*           — guarded separately by the cron secret (requireCronSecret)
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/proxy.test.ts`
Expected: PASS (18 tests).

- [ ] **Step 5: Write `src/lib/auth.ts`** (ported; `requireCronSecret` additionally accepts Vercel's native `Authorization: Bearer` header — Vercel crons cannot send custom headers, but automatically send `Bearer ${CRON_SECRET}` when that env var is set on the project)

```ts
import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { COOKIE_NAME, assertSessionSecret, verifySessionToken } from "@/lib/session";

/**
 * Hash a string with SHA-256 so both sides produce equal-length buffers,
 * which is required by timingSafeEqual.
 */
function sha256(s: string): Buffer {
  return createHash("sha256").update(s).digest();
}

/**
 * Validates the cron secret with a timing-safe comparison. Accepts either:
 *   - `x-cron-secret: <secret>`         (manual curl / external schedulers)
 *   - `Authorization: Bearer <secret>`  (what Vercel native crons send when
 *                                        the CRON_SECRET env var is set)
 * Returns a NextResponse error (401 or 500) if validation fails, or null
 * if the request is authorised.
 */
export function requireCronSecret(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET environment variable is not set." },
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  const provided = request.headers.get("x-cron-secret") ?? bearer ?? "";

  const isValid = timingSafeEqual(sha256(provided), sha256(cronSecret));
  if (!isValid) {
    return NextResponse.json(
      { error: "Unauthorized: missing or invalid cron secret." },
      { status: 401 }
    );
  }

  return null;
}

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Session-cookie auth guard for API route handlers, mirroring the
 * `requireCronSecret` convention: returns `NextResponse | null`, called as
 * the first statement of a handler, and a non-null result is returned
 * immediately by the caller.
 *
 * WHY THIS EXISTS: src/proxy.ts (Next middleware) would otherwise be the ONLY
 * authorization check in front of the entire DB write surface. That is a
 * single point of failure — a matcher typo, a Next middleware CVE, or a
 * path-normalisation bypass in the framework would silently expose every
 * mutating route with nothing behind it. This helper is deliberately
 * redundant with the proxy: defence in depth, not a replacement for it.
 *
 * Behaviour:
 *  1. Resolve SESSION_SECRET via assertSessionSecret(). Missing/weak secret
 *     fails closed with 503 (never treated as "no auth required").
 *  2. Read the session cookie. Missing/empty -> 401.
 *  3. Verify the token. Invalid/expired -> 401.
 *  4. For mutating methods (POST/PATCH/PUT/DELETE) only: if an Origin header
 *     is present, it must match this app's own origin. This is a second
 *     layer behind the session cookie's SameSite=Strict attribute — browsers
 *     omit Origin on plenty of legitimate same-origin/non-browser requests,
 *     so its absence is allowed through; its presence-and-mismatch is not.
 *  5. Otherwise return null (authorized).
 */
export async function requireSession(request: NextRequest): Promise<NextResponse | null> {
  let secret: string;
  try {
    secret = assertSessionSecret();
  } catch {
    return NextResponse.json(
      { error: "SESSION_SECRET is not configured." },
      { status: 503 }
    );
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const valid = await verifySessionToken(token, secret);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (MUTATING_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      const expected = (process.env.APP_BASE_URL || request.nextUrl.origin).replace(/\/+$/, "");
      const actual = origin.replace(/\/+$/, "");
      if (actual !== expected) {
        return NextResponse.json(
          { error: "Cross-origin request rejected" },
          { status: 403 }
        );
      }
    }
  }

  return null;
}
```

- [ ] **Step 6: Verify types and commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add src/lib/auth.ts src/proxy.ts src/lib/__tests__/proxy.test.ts
git commit -m "feat: session/cron auth guards and fail-closed proxy"
```

---

### Task 6: Login page + auth routes

**Files:**
- Create: `src/app/api/auth/login/route.ts` *(ported)*, `src/app/api/auth/logout/route.ts` *(ported)*, `src/app/login/page.tsx`

- [ ] **Step 1: Write `src/app/api/auth/login/route.ts`** (ported; only the HMAC compare-key label and log prefix changed)

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  assertSessionSecret,
  COOKIE_NAME,
  MAX_AGE_SECONDS,
} from "@/lib/session";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
  getClientIp,
} from "@/lib/loginRateLimit";

/**
 * POST /api/auth/login
 *
 * Body: { password: string }
 *
 * On success: sets a signed HttpOnly session cookie and returns { ok: true }.
 * On failure: returns 401 { error: "Invalid password" }.
 *
 * Rate limited (Mongo-backed, per-IP strict + global loose — see
 * src/lib/loginRateLimit.ts) — locked-out requests get a 429 before the
 * password is even compared. Failures and successes are logged (IP + outcome
 * only, never the attempted password).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { error: "DASHBOARD_PASSWORD is not configured." },
      { status: 503 }
    );
  }

  if (password.length < 12) {
    return NextResponse.json(
      {
        error:
          "DASHBOARD_PASSWORD is too weak (must be at least 12 characters). Fix the configured password before logging in.",
      },
      { status: 503 }
    );
  }

  let sessionSecret: string;
  try {
    sessionSecret = assertSessionSecret();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "SESSION_SECRET is not configured.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const provided =
    body !== null &&
    typeof body === "object" &&
    "password" in body &&
    typeof (body as Record<string, unknown>).password === "string"
      ? (body as { password: string }).password
      : null;

  if (!provided) {
    return NextResponse.json({ error: "Missing password field." }, { status: 400 });
  }

  const ip = getClientIp(request);

  const { locked, retryAfterSeconds } = await checkLoginRateLimit(ip);
  if (locked) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  // Constant-time compare via Web Crypto to avoid timing attacks.
  // We derive an HMAC of the candidate and the real password against a fixed
  // message, then compare — this avoids a char-by-char short-circuit on the
  // raw strings.
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode("rikuos-login-compare"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const [hmacProvided, hmacExpected] = await Promise.all([
    crypto.subtle.sign("HMAC", key, enc.encode(provided)),
    crypto.subtle.sign("HMAC", key, enc.encode(password)),
  ]);

  const a = new Uint8Array(hmacProvided);
  const b = new Uint8Array(hmacExpected);
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  const passwordMatch = diff === 0;

  if (!passwordMatch) {
    await recordLoginFailure(ip);
    console.warn(`[auth/login] ${new Date().toISOString()} ip=${ip} outcome=failure`);
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  await clearLoginFailures(ip);
  console.info(`[auth/login] ${new Date().toISOString()} ip=${ip} outcome=success`);

  const token = await createSessionToken(sessionSecret);

  const response = NextResponse.json({ ok: true });
  // __Host- prefix requires: secure=true, path="/", and no Domain attribute.
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return response;
}
```

- [ ] **Step 2: Write `src/app/api/auth/logout/route.ts`** (ported verbatim)

```ts
import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/session";

/**
 * POST /api/auth/logout
 *
 * Clears the session cookie. No auth required — clearing your own cookie is
 * harmless (it cannot be used to affect any other session), and requiring
 * auth here would just mean a stale/expired cookie could never be cleared.
 */
export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
```

- [ ] **Step 3: Write `src/app/login/page.tsx`** (plain version — the `?from=` safety logic is ported verbatim; do not simplify it, string checks alone are insufficient because browsers normalize `/\evil.com` and `//evil.com` to external URLs)

```tsx
"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("/queue");

  // Read ?from= redirect param once on mount.
  // Resolve against our own origin and re-check it — string checks alone are
  // not enough (browsers normalize "/\evil.com" and "//evil.com" to external
  // URLs).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const f = params.get("from");
    if (!f || !f.startsWith("/")) return;
    try {
      const resolved = new URL(f, window.location.origin);
      if (resolved.origin === window.location.origin) {
        setFrom(resolved.pathname + resolved.search);
      }
    } catch {
      // malformed value — keep the "/queue" default
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.href = from;
        return;
      }

      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Login failed");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>{APP_NAME}</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
          required
        />
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" disabled={loading || !password}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Verify build and commit**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both clean. (Manual login can't be exercised yet without `.env.local` — Task 14 covers it end to end.)

```bash
git add src/app/api/auth src/app/login
git commit -m "feat: login page and auth routes"
```

---

### Task 7: Core data models

**Files:**
- Create: `src/models/AgentRun.ts`, `src/models/ApprovalItem.ts`, `src/models/approvals/FollowupDraftApproval.ts`, `src/models/PushSubscription.ts`, `src/models/OsSettings.ts`, `src/lib/osSettings.ts`
- Test: `src/lib/__tests__/models.test.ts`

Design notes locked in here:
- `ApprovalItem` uses Mongoose **discriminators** keyed on `type` — never `Schema.Types.Mixed` (CLAUDE.md). P3 registers only the `followup-draft` discriminator; `reply-draft` (P4), `client-issue-email` (P5), `triage-response` (P6), and `skill-edit` (P7) are each added in their own phase as a sibling file under `src/models/approvals/`. Items are always **created via a discriminator model**, never via the base model, so an unregistered type can't enter the collection.
- `editedPayload` has the **same typed sub-schema** as `payload` — an edit stores a complete typed copy, keeping "what the agent proposed" and "what Riku actually approved" separately (the retro agent's training signal).
- ApprovalItem decisions are retained forever — **no TTL index on this collection, ever** (CLAUDE.md).
- `AgentRun` gets a 90-day TTL on `startedAt`; `LoginAttempt` already has its 15-min TTL (Task 4).
- The tests use `validateSync()` — Mongoose validates documents without any DB connection, so required/enum/maxlength rules are unit-testable.

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/models.test.ts`

```ts
/**
 * Schema-validation tests, DB-less: validateSync() exercises required/enum/
 * maxlength rules without a MongoDB connection.
 */
import { describe, it, expect } from "vitest";
import FollowupDraftApproval from "@/models/approvals/FollowupDraftApproval";
import AgentRun from "@/models/AgentRun";
import PushSubscription from "@/models/PushSubscription";
import OsSettings from "@/models/OsSettings";

const validPayload = {
  contactId: "c1",
  contactName: "Sample Bakery",
  channel: "facebook",
  draftBody: "Hi po!",
};

function validItem() {
  return {
    source: "manual",
    title: "Follow up: Sample Bakery",
    summary: "Replied, no answer yet.",
    payload: validPayload,
  };
}

describe("ApprovalItem / followup-draft discriminator", () => {
  it("accepts a valid item and defaults status + actionStatus to pending", () => {
    const doc = new FollowupDraftApproval(validItem());
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.status).toBe("pending");
    expect(doc.actionStatus).toBe("pending");
    expect(doc.type).toBe("followup-draft");
  });

  it("rejects a missing payload", () => {
    const { payload: _payload, ...rest } = validItem();
    const doc = new FollowupDraftApproval(rest);
    expect(doc.validateSync()?.errors["payload"]).toBeDefined();
  });

  it("rejects an unknown source", () => {
    const doc = new FollowupDraftApproval({ ...validItem(), source: "skynet" });
    expect(doc.validateSync()?.errors["source"]).toBeDefined();
  });

  it("rejects an unknown channel in the payload", () => {
    const doc = new FollowupDraftApproval({
      ...validItem(),
      payload: { ...validPayload, channel: "telegram" },
    });
    expect(doc.validateSync()?.errors["payload.channel"]).toBeDefined();
  });

  it("rejects an over-length draftBody", () => {
    const doc = new FollowupDraftApproval({
      ...validItem(),
      payload: { ...validPayload, draftBody: "x".repeat(8001) },
    });
    expect(doc.validateSync()?.errors["payload.draftBody"]).toBeDefined();
  });

  it("rejects an unknown status", () => {
    const doc = new FollowupDraftApproval({ ...validItem(), status: "maybe" });
    expect(doc.validateSync()?.errors["status"]).toBeDefined();
  });

  it("accepts a typed editedPayload of the same shape", () => {
    const doc = new FollowupDraftApproval({
      ...validItem(),
      editedPayload: { ...validPayload, draftBody: "Edited body" },
    });
    expect(doc.validateSync()).toBeUndefined();
  });
});

describe("AgentRun", () => {
  it("accepts a valid run and defaults counts to zero", () => {
    const doc = new AgentRun({
      agent: "expiry-sweep",
      startedAt: new Date(),
      durationMs: 12,
      ok: true,
    });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.counts.itemsCreated).toBe(0);
    expect(doc.counts.itemsProcessed).toBe(0);
  });

  it("rejects an unknown agent", () => {
    const doc = new AgentRun({
      agent: "hal9000",
      startedAt: new Date(),
      durationMs: 1,
      ok: true,
    });
    expect(doc.validateSync()?.errors["agent"]).toBeDefined();
  });
});

describe("PushSubscription", () => {
  it("requires endpoint and keys", () => {
    const doc = new PushSubscription({});
    const errs = doc.validateSync()?.errors ?? {};
    expect(errs["endpoint"]).toBeDefined();
    expect(errs["keys"]).toBeDefined();
  });

  it("accepts a valid subscription", () => {
    const doc = new PushSubscription({
      endpoint: "https://push.example/abc",
      keys: { p256dh: "k1", auth: "k2" },
    });
    expect(doc.validateSync()).toBeUndefined();
  });
});

describe("OsSettings", () => {
  it("defaults every agent toggle to off", () => {
    const doc = new OsSettings({});
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.chaserEnabled).toBe(false);
    expect(doc.chaserNDays).toBe(4);
  });

  it("bounds chaserNDays to [1, 30]", () => {
    const doc = new OsSettings({ chaserNDays: 45 });
    expect(doc.validateSync()?.errors["chaserNDays"]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/models.test.ts`
Expected: FAIL — cannot resolve the model modules.

- [ ] **Step 3: Write `src/models/AgentRun.ts`** (exports the agent enum — ApprovalItem reuses it for `source`)

```ts
import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * Every scheduled/triggered job in the system. "expiry-sweep" is the P3 cron
 * that expires stale ApprovalItems; the rest arrive with their own phases
 * (ARCHITECTURE.md §2.3).
 */
export const AGENTS = [
  "chaser",
  "lead-sweep",
  "triage",
  "site-health",
  "dispatcher",
  "retro",
  "watchdog",
  "expiry-sweep",
] as const;
export type Agent = (typeof AGENTS)[number];

export interface IAgentRunCounts {
  itemsCreated: number;
  itemsProcessed: number;
}

const AgentRunCountsSchema = new Schema<IAgentRunCounts>(
  {
    itemsCreated: { type: Number, required: true, default: 0, min: 0 },
    itemsProcessed: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false, strict: true }
);

export interface IAgentRun extends Document {
  agent: Agent;
  startedAt: Date;
  durationMs: number;
  ok: boolean;
  counts: IAgentRunCounts;
  error?: string;
}

// No timestamps option: startedAt is the meaningful time and is set
// explicitly by every caller; a createdAt duplicate would just drift from it.
const AgentRunSchema = new Schema<IAgentRun>(
  {
    agent: { type: String, required: true, enum: AGENTS },
    startedAt: { type: Date, required: true },
    durationMs: { type: Number, required: true, min: 0 },
    ok: { type: Boolean, required: true },
    counts: {
      type: AgentRunCountsSchema,
      required: true,
      default: () => ({ itemsCreated: 0, itemsProcessed: 0 }),
    },
    error: { type: String, maxlength: 2000 },
  },
  { strict: true }
);

// TTL 90 days (ARCHITECTURE.md §3.1) — run history is operational, not training data.
AgentRunSchema.index({ startedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });
// Watchdog (P5) reads "latest run per agent".
AgentRunSchema.index({ agent: 1, startedAt: -1 });

const AgentRun =
  (mongoose.models.AgentRun as Model<IAgentRun>) ||
  mongoose.model<IAgentRun>("AgentRun", AgentRunSchema);

export default AgentRun;
```

- [ ] **Step 4: Write `src/models/ApprovalItem.ts`** (the discriminator base)

```ts
import mongoose, { Document, Model, Schema } from "mongoose";
import { AGENTS } from "@/models/AgentRun";

/** Who proposed the item — the agents, plus "manual" for seeded/test items. */
export const APPROVAL_SOURCES = [...AGENTS, "manual"] as const;
export type ApprovalSource = (typeof APPROVAL_SOURCES)[number];

export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "edited_approved",
  "rejected",
  "expired",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const ACTION_STATUSES = ["pending", "done", "failed"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export interface IApprovalItemBase extends Document {
  type: string; // discriminator key; one registered discriminator per item type
  source: ApprovalSource;
  title: string;
  summary: string;
  status: ApprovalStatus;
  staleAt?: Date; // when set, the expiry sweep flips a still-pending item to "expired"
  decidedAt?: Date;
  rejectNote?: string;
  actionStatus: ActionStatus;
  actionError?: string;
  actionAt?: Date;
  createdAt: Date;
}

/**
 * Base schema. Per-type payloads live on discriminators (typed, bounded
 * fields — never Schema.Types.Mixed, CLAUDE.md). Create items ONLY through a
 * discriminator model so an unregistered type can't enter the collection;
 * query through this base model when the type doesn't matter.
 */
const ApprovalItemSchema = new Schema<IApprovalItemBase>(
  {
    source: { type: String, required: true, enum: APPROVAL_SOURCES },
    title: { type: String, required: true, maxlength: 200 },
    summary: { type: String, required: true, maxlength: 2000 },
    status: { type: String, required: true, enum: APPROVAL_STATUSES, default: "pending" },
    staleAt: { type: Date },
    decidedAt: { type: Date },
    rejectNote: { type: String, maxlength: 1000 },
    actionStatus: { type: String, required: true, enum: ACTION_STATUSES, default: "pending" },
    actionError: { type: String, maxlength: 2000 },
    actionAt: { type: Date },
  },
  {
    discriminatorKey: "type",
    timestamps: { createdAt: true, updatedAt: false },
    strict: true,
  }
);

// Queue listing: filter by status, newest first.
ApprovalItemSchema.index({ status: 1, createdAt: -1 });
// Expiry sweep: pending items whose staleAt has passed.
ApprovalItemSchema.index({ status: 1, staleAt: 1 });

// NEVER add a TTL index to this collection — every decision (approve, edit,
// reject, expire) is retained indefinitely as the retro agent's training
// data (ARCHITECTURE.md §3.1, CLAUDE.md).

const ApprovalItem =
  (mongoose.models.ApprovalItem as Model<IApprovalItemBase>) ||
  mongoose.model<IApprovalItemBase>("ApprovalItem", ApprovalItemSchema);

export default ApprovalItem;
```

- [ ] **Step 5: Write `src/models/approvals/FollowupDraftApproval.ts`**

```ts
import { Model, Schema } from "mongoose";
import ApprovalItem, { IApprovalItemBase } from "@/models/ApprovalItem";

export const DRAFT_CHANNELS = ["email", "facebook"] as const;
export type DraftChannel = (typeof DRAFT_CHANNELS)[number];

/**
 * Payload for a chaser follow-up draft. contactId/contactName identify the
 * lead in ShikksTracker (opaque strings here — RikuOS never touches that DB;
 * P4's approve action passes them back through POST /api/os/drafts).
 */
export interface IFollowupDraftPayload {
  contactId: string;
  contactName: string;
  channel: DraftChannel;
  draftSubject?: string; // email only
  draftBody: string;
  replySnippet?: string; // what the lead said — shown in the queue card
}

export interface IFollowupDraftApproval extends IApprovalItemBase {
  type: "followup-draft";
  payload: IFollowupDraftPayload;
  editedPayload?: IFollowupDraftPayload;
}

const FollowupDraftPayloadSchema = new Schema<IFollowupDraftPayload>(
  {
    contactId: { type: String, required: true, maxlength: 64 },
    contactName: { type: String, required: true, maxlength: 200 },
    channel: { type: String, required: true, enum: DRAFT_CHANNELS },
    draftSubject: { type: String, maxlength: 300 },
    draftBody: { type: String, required: true, maxlength: 8000 },
    replySnippet: { type: String, maxlength: 2000 },
  },
  { _id: false, strict: true }
);

// editedPayload uses the SAME typed sub-schema: an edit stores a complete
// copy, keeping the agent's proposal and Riku's approved version separately
// (the retro agent compares them).
const FollowupDraftSchema = new Schema<IFollowupDraftApproval>(
  {
    payload: { type: FollowupDraftPayloadSchema, required: true },
    editedPayload: { type: FollowupDraftPayloadSchema },
  },
  { strict: true }
);

// Same hot-reload guard as plain models: calling .discriminator() twice for
// the same key throws, so reuse the registered one when it exists.
const FollowupDraftApproval =
  (ApprovalItem.discriminators?.["followup-draft"] as Model<IFollowupDraftApproval>) ||
  ApprovalItem.discriminator<IFollowupDraftApproval>("followup-draft", FollowupDraftSchema);

export default FollowupDraftApproval;
```

- [ ] **Step 6: Write `src/models/PushSubscription.ts`**

```ts
import mongoose, { Document, Model, Schema } from "mongoose";

export interface IPushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

const PushSubscriptionKeysSchema = new Schema<IPushSubscriptionKeys>(
  {
    p256dh: { type: String, required: true, maxlength: 256 },
    auth: { type: String, required: true, maxlength: 256 },
  },
  { _id: false, strict: true }
);

export interface IPushSubscription extends Document {
  endpoint: string;
  keys: IPushSubscriptionKeys;
  createdAt: Date;
}

/**
 * One doc per subscribed device (multiple devices allowed — ARCHITECTURE.md
 * §3.1). endpoint is required, so a plain unique index is safe here (the
 * partial-index rule applies to nullable uniques only).
 */
const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    endpoint: { type: String, required: true, maxlength: 1024, unique: true },
    keys: { type: PushSubscriptionKeysSchema, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: true }
);

const PushSubscription =
  (mongoose.models.PushSubscription as Model<IPushSubscription>) ||
  mongoose.model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);

export default PushSubscription;
```

- [ ] **Step 7: Write `src/models/OsSettings.ts`**

```ts
import mongoose, { Document, Model, Schema } from "mongoose";

export interface IOsSettings extends Document {
  chaserEnabled: boolean;
  chaserNDays: number;
  updatedAt: Date;
}

/**
 * Singleton: exactly one document ever exists — access ONLY through
 * src/lib/osSettings.ts, which always queries with the empty filter `{}` and
 * upserts (CLAUDE.md singleton rule).
 *
 * P3 carries only the chaser fields (ARCHITECTURE.md §3.1 names them
 * explicitly); each later agent adds its own toggle when it ships. Defaults
 * are off so deploying an agent never silently activates it.
 */
const OsSettingsSchema = new Schema<IOsSettings>(
  {
    chaserEnabled: { type: Boolean, required: true, default: false },
    chaserNDays: { type: Number, required: true, default: 4, min: 1, max: 30 },
  },
  { timestamps: { createdAt: false, updatedAt: true }, strict: true }
);

const OsSettings =
  (mongoose.models.OsSettings as Model<IOsSettings>) ||
  mongoose.model<IOsSettings>("OsSettings", OsSettingsSchema);

export default OsSettings;
```

- [ ] **Step 8: Write `src/lib/osSettings.ts`** (the singleton accessor — ported pattern)

```ts
/**
 * osSettings.ts — access layer for the singleton OsSettings doc (ported
 * pattern from ShikksTracker's settings accessor).
 *
 * Both getOsSettings() and updateOsSettings() go through the same atomic
 * findOneAndUpdate with upsert:true — getOsSettings() is just
 * updateOsSettings({}) (an empty $set changes nothing, and upsert still
 * creates the doc with schema defaults if none exists).
 *
 * Known, accepted limitation for a single-user tool: the `{}` filter has no
 * unique index behind it, so a two-caller race on the very first-ever call
 * could in theory produce two documents. Not worth a fixed-_id scheme here.
 *
 * Callers are responsible for calling connectDB() first — same convention as
 * the rest of the lib layer.
 */

import OsSettings from "@/models/OsSettings";
import type { IOsSettings } from "@/models/OsSettings";

export interface OsSettingsPatch {
  chaserEnabled?: boolean;
  chaserNDays?: number;
}

export async function updateOsSettings(patch: OsSettingsPatch): Promise<IOsSettings> {
  const updated = await OsSettings.findOneAndUpdate(
    {},
    { $set: patch },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return updated as IOsSettings;
}

export async function getOsSettings(): Promise<IOsSettings> {
  return updateOsSettings({});
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/models.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 10: Verify types and commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add src/models src/lib/osSettings.ts src/lib/__tests__/models.test.ts
git commit -m "feat: core models - ApprovalItem discriminators, AgentRun, PushSubscription, OsSettings"
```

---

### Task 8: Index sync script

**Files:**
- Create: `scripts/sync-indexes.mts` *(ported from ShikksTracker, generalized to all models)*

The npm scripts `migrate:indexes` / `migrate:indexes:apply` were already added in Task 1.

- [ ] **Step 1: Write `scripts/sync-indexes.mts`**

```ts
/**
 * sync-indexes.mts — dry-run-by-default index sync for every RikuOS model
 * (ported from ShikksTracker's sync-indexes.mts, generalized to iterate all
 * models instead of one).
 *
 * WHY THIS EXISTS: Mongoose only ever CREATES missing indexes. It will not
 * alter or drop an index that already exists under the same name with
 * different options — the old, wrong index silently stays. Any index change
 * therefore ships together with a run of this script (CLAUDE.md).
 *
 * USAGE
 *   npm run migrate:indexes          # DRY RUN — shows the diff, changes nothing
 *   npm run migrate:indexes:apply    # actually applies it
 *
 * Dry run is the default deliberately: syncIndexes() drops ANY index on the
 * collection that is not declared in the schema. If someone added one by hand
 * in Atlas, it would go. Look at the diff before applying, and run it while
 * nothing else is touching the database.
 */

import mongoose from "mongoose";
import ApprovalItem from "../src/models/ApprovalItem.ts";
import "../src/models/approvals/FollowupDraftApproval.ts"; // registers the discriminator's paths
import AgentRun from "../src/models/AgentRun.ts";
import PushSubscription from "../src/models/PushSubscription.ts";
import OsSettings from "../src/models/OsSettings.ts";
import LoginAttempt from "../src/models/LoginAttempt.ts";

const APPLY = process.argv.includes("--apply");

const MODELS = [ApprovalItem, AgentRun, PushSubscription, OsSettings, LoginAttempt];

interface IndexInfo {
  name?: string;
  key?: Record<string, unknown>;
  unique?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: Record<string, unknown>;
}

function describe(ix: IndexInfo): string {
  const bits: string[] = [`keys=${JSON.stringify(ix.key ?? {})}`];
  if (ix.unique) bits.push("unique");
  if (ix.expireAfterSeconds !== undefined) bits.push(`ttl=${ix.expireAfterSeconds}s`);
  if (ix.partialFilterExpression) {
    bits.push(`partial=${JSON.stringify(ix.partialFilterExpression)}`);
  }
  return `${(ix.name ?? "(unnamed)").padEnd(34)} ${bits.join(" · ")}`;
}

async function main(): Promise<number> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      "MONGODB_URI is not set.\n" +
        "This script reads it from .env.local via node --env-file. Check that\n" +
        ".env.local exists and defines MONGODB_URI."
    );
    return 1;
  }

  const redacted = uri.replace(/\/\/[^@]*@/, "//<credentials>@");
  console.log(`Connecting to: ${redacted}`);
  console.log(`Mode:          ${APPLY ? "APPLY (will modify indexes)" : "DRY RUN (no changes)"}`);

  // Short server-selection timeout so a wrong/unreachable URI fails in
  // seconds rather than hanging on the driver's default.
  await mongoose.connect(uri, { bufferCommands: false, serverSelectionTimeoutMS: 10_000 });
  console.log(`Database:      ${mongoose.connection.db?.databaseName ?? "(unknown)"}`);

  let pendingChanges = 0;
  for (const model of MODELS) {
    console.log(`\n── ${model.modelName} ${"─".repeat(Math.max(0, 56 - model.modelName.length))}`);

    let before: IndexInfo[] = [];
    try {
      before = (await model.collection.indexes()) as IndexInfo[];
    } catch {
      // collection does not exist yet — treated as no indexes
    }
    if (before.length === 0) console.log("   (collection does not exist yet)");
    for (const ix of before) console.log("   " + describe(ix));

    const diff = (await model.diffIndexes()) as {
      toDrop: string[];
      toCreate: Record<string, unknown>[];
    };

    if (diff.toDrop.length === 0 && diff.toCreate.length === 0) {
      console.log("   in sync — nothing to do");
      continue;
    }

    pendingChanges++;
    for (const name of diff.toDrop) console.log(`   DROP    ${name}`);
    for (const spec of diff.toCreate) console.log(`   CREATE  ${JSON.stringify(spec)}`);

    if (APPLY) {
      const dropped = await model.syncIndexes();
      console.log(`   applied (syncIndexes dropped: ${JSON.stringify(dropped)})`);
    }
  }

  if (!APPLY && pendingChanges > 0) {
    console.log(
      "\nDry run only — nothing was changed.\n" +
        "Re-run with `npm run migrate:indexes:apply` to apply the changes above.\n" +
        "Note: syncIndexes() drops ANY index not declared in the schema, so if a\n" +
        "DROP above is something you added by hand in Atlas, stop and reconsider."
    );
  }
  if (pendingChanges === 0) console.log("\nAll collections already match their schemas.");

  await mongoose.disconnect();
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch(async (err) => {
    console.error("\nIndex sync failed:", err instanceof Error ? err.message : err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: clean (the `.ts`-extensioned relative imports are legal because `allowImportingTsExtensions` is on — same arrangement as ShikksTracker).

- [ ] **Step 3: Run the dry run if `.env.local` exists** (otherwise defer to Task 14 — the script needs a real Atlas URI)

Run: `npm run migrate:indexes`
Expected: connects, prints one section per model, lists CREATE entries for every declared index (all collections are new), changes nothing.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-indexes.mts
git commit -m "feat: dry-run index sync script"
```

---

### Task 9: Queue logic layer

**Files:**
- Create: `src/lib/queue.ts`
- Test: `src/lib/__tests__/queue.test.ts`

The state machine, locked in:

```
pending ──approve──► approved          ──runApprovalAction──► actionStatus done|failed
pending ──edit─────► edited_approved   ──runApprovalAction──► actionStatus done|failed
pending ──reject───► rejected
pending ──sweep────► expired            (staleAt in the past)
```

Every transition out of `pending` is a guarded atomic update — the filter re-checks `status: "pending"` so a double-tap, a concurrent sweep, or two devices can never decide the same item twice (CLAUDE.md: never read-modify-write). The pure builders below are what the tests pin down; the route (Task 10) just applies them.

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/queue.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildDecisionUpdate, buildExpirySweep, parseDecision } from "@/lib/queue";
import type { Decision } from "@/lib/queue";
import type { IFollowupDraftPayload } from "@/models/approvals/FollowupDraftApproval";

const payload: IFollowupDraftPayload = {
  contactId: "c1",
  contactName: "Sample Bakery",
  channel: "facebook",
  draftBody: "Original body",
  replySnippet: "Magkano po?",
};

describe("parseDecision", () => {
  it("parses approve", () => {
    const res = parseDecision({ decision: "approve" }, "followup-draft", payload);
    expect(res).toEqual({ ok: true, value: { kind: "approve" } });
  });

  it("parses reject without a note", () => {
    const res = parseDecision({ decision: "reject" }, "followup-draft", payload);
    expect(res).toEqual({ ok: true, value: { kind: "reject", rejectNote: undefined } });
  });

  it("parses reject with a bounded note", () => {
    const res = parseDecision(
      { decision: "reject", rejectNote: "wrong tone" },
      "followup-draft",
      payload
    );
    expect(res).toEqual({ ok: true, value: { kind: "reject", rejectNote: "wrong tone" } });
  });

  it("rejects an over-length rejectNote", () => {
    const res = parseDecision(
      { decision: "reject", rejectNote: "x".repeat(1001) },
      "followup-draft",
      payload
    );
    expect(res.ok).toBe(false);
  });

  it("parses edit into a full editedPayload preserving identity fields", () => {
    const res = parseDecision(
      { decision: "edit", draftBody: "New body" },
      "followup-draft",
      payload
    );
    expect(res.ok).toBe(true);
    if (res.ok && res.value.kind === "edit") {
      expect(res.value.editedPayload.draftBody).toBe("New body");
      expect(res.value.editedPayload.contactId).toBe("c1");
      expect(res.value.editedPayload.contactName).toBe("Sample Bakery");
      expect(res.value.editedPayload.channel).toBe("facebook");
      expect(res.value.editedPayload.replySnippet).toBe("Magkano po?");
    }
  });

  it("rejects edit for a type with no edit support", () => {
    const res = parseDecision({ decision: "edit", draftBody: "x" }, "skill-edit", undefined);
    expect(res.ok).toBe(false);
  });

  it("rejects edit with an empty draftBody", () => {
    const res = parseDecision(
      { decision: "edit", draftBody: "   " },
      "followup-draft",
      payload
    );
    expect(res.ok).toBe(false);
  });

  it("rejects edit with an over-length draftBody", () => {
    const res = parseDecision(
      { decision: "edit", draftBody: "x".repeat(8001) },
      "followup-draft",
      payload
    );
    expect(res.ok).toBe(false);
  });

  it("rejects an unknown decision", () => {
    const res = parseDecision({ decision: "maybe" }, "followup-draft", payload);
    expect(res.ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseDecision(null, "followup-draft", payload).ok).toBe(false);
    expect(parseDecision("approve", "followup-draft", payload).ok).toBe(false);
  });
});

describe("buildDecisionUpdate", () => {
  const now = new Date("2026-08-28T10:00:00Z");

  it("always guards on status pending (the state-machine invariant)", () => {
    const decisions: Decision[] = [
      { kind: "approve" },
      { kind: "reject" },
      { kind: "edit", editedPayload: payload },
    ];
    for (const d of decisions) {
      expect(buildDecisionUpdate(d, now).filter).toEqual({ status: "pending" });
    }
  });

  it("approve sets status approved and decidedAt", () => {
    const { update } = buildDecisionUpdate({ kind: "approve" }, now);
    expect(update).toEqual({ $set: { status: "approved", decidedAt: now } });
  });

  it("edit sets edited_approved and stores the editedPayload", () => {
    const { update } = buildDecisionUpdate({ kind: "edit", editedPayload: payload }, now);
    expect(update).toEqual({
      $set: { status: "edited_approved", decidedAt: now, editedPayload: payload },
    });
  });

  it("reject stores the note only when given", () => {
    expect(buildDecisionUpdate({ kind: "reject" }, now).update).toEqual({
      $set: { status: "rejected", decidedAt: now },
    });
    expect(
      buildDecisionUpdate({ kind: "reject", rejectNote: "off-brand" }, now).update
    ).toEqual({
      $set: { status: "rejected", decidedAt: now, rejectNote: "off-brand" },
    });
  });
});

describe("buildExpirySweep", () => {
  it("matches only pending items whose staleAt has passed", () => {
    const now = new Date("2026-08-28T00:00:00Z");
    const { filter, update } = buildExpirySweep(now);
    // Range operators do not match documents where the field is missing, so
    // items without a staleAt are untouched by design.
    expect(filter).toEqual({ status: "pending", staleAt: { $lte: now } });
    expect(update).toEqual({ $set: { status: "expired", decidedAt: now } });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/queue.test.ts`
Expected: FAIL — cannot resolve `@/lib/queue`.

- [ ] **Step 3: Write `src/lib/queue.ts`**

```ts
/**
 * queue.ts — Approval Queue logic layer.
 *
 * State machine (every transition out of `pending` happens exactly once,
 * enforced by guarded atomic updates — the filter always re-checks
 * status: "pending"; never read-modify-write):
 *
 *   pending ──approve──► approved          ──action──► actionStatus done|failed
 *   pending ──edit─────► edited_approved   ──action──► actionStatus done|failed
 *   pending ──reject───► rejected
 *   pending ──sweep────► expired            (staleAt in the past)
 *
 * Decisions are never TTL'd or deleted — they are the retro agent's training
 * data (ARCHITECTURE.md §3.1).
 */

import ApprovalItem, { IApprovalItemBase } from "@/models/ApprovalItem";
import type { IFollowupDraftPayload } from "@/models/approvals/FollowupDraftApproval";

export type Decision =
  | { kind: "approve" }
  | { kind: "reject"; rejectNote?: string }
  | { kind: "edit"; editedPayload: IFollowupDraftPayload };

export type ParsedDecision =
  | { ok: true; value: Decision }
  | { ok: false; error: string };

/**
 * Pure: validates a decide-route body against an item's type and current
 * payload. Editing is per-type: an edit replaces the message text only —
 * identity fields (contactId, contactName, channel, replySnippet) are copied
 * from the original payload, because Riku edits the message, not the lead.
 */
export function parseDecision(
  body: unknown,
  itemType: string,
  payload: IFollowupDraftPayload | undefined
): ParsedDecision {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;

  switch (b.decision) {
    case "approve":
      return { ok: true, value: { kind: "approve" } };

    case "reject": {
      if (
        b.rejectNote !== undefined &&
        (typeof b.rejectNote !== "string" || b.rejectNote.length > 1000)
      ) {
        return { ok: false, error: "rejectNote must be a string of at most 1000 characters." };
      }
      return {
        ok: true,
        value: { kind: "reject", rejectNote: b.rejectNote as string | undefined },
      };
    }

    case "edit": {
      if (itemType !== "followup-draft" || !payload) {
        return { ok: false, error: `Editing is not supported for type "${itemType}".` };
      }
      if (
        typeof b.draftBody !== "string" ||
        b.draftBody.trim().length === 0 ||
        b.draftBody.length > 8000
      ) {
        return {
          ok: false,
          error: "draftBody must be a non-empty string of at most 8000 characters.",
        };
      }
      if (
        b.draftSubject !== undefined &&
        (typeof b.draftSubject !== "string" || b.draftSubject.length > 300)
      ) {
        return { ok: false, error: "draftSubject must be a string of at most 300 characters." };
      }
      // Explicit field copy, not a spread — the payload may be a Mongoose
      // subdocument, and spreading one drags internal state along.
      const editedPayload: IFollowupDraftPayload = {
        contactId: payload.contactId,
        contactName: payload.contactName,
        channel: payload.channel,
        draftSubject: (b.draftSubject as string | undefined) ?? payload.draftSubject,
        draftBody: b.draftBody,
        replySnippet: payload.replySnippet,
      };
      return { ok: true, value: { kind: "edit", editedPayload } };
    }

    default:
      return { ok: false, error: 'decision must be one of "approve", "edit", "reject".' };
  }
}

/**
 * Pure: builds the guarded atomic update for a decision. The filter always
 * includes status: "pending" so only an undecided item can transition.
 */
export function buildDecisionUpdate(
  decision: Decision,
  now: Date
): { filter: { status: "pending" }; update: Record<string, unknown> } {
  const filter = { status: "pending" as const };
  switch (decision.kind) {
    case "approve":
      return { filter, update: { $set: { status: "approved", decidedAt: now } } };
    case "edit":
      return {
        filter,
        update: {
          $set: {
            status: "edited_approved",
            decidedAt: now,
            editedPayload: decision.editedPayload,
          },
        },
      };
    case "reject":
      return {
        filter,
        update: {
          $set: {
            status: "rejected",
            decidedAt: now,
            ...(decision.rejectNote !== undefined ? { rejectNote: decision.rejectNote } : {}),
          },
        },
      };
  }
}

/**
 * Pure: the stale-item sweep. Range operators do not match documents where
 * the field is missing, so items without a staleAt are untouched. Stale
 * pending items flip to "expired" — they never linger (CLAUDE.md: never
 * leave an in-flight state behind).
 */
export function buildExpirySweep(now: Date): {
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
} {
  return {
    filter: { status: "pending", staleAt: { $lte: now } },
    update: { $set: { status: "expired", decidedAt: now } },
  };
}

type ActionExecutor = (item: IApprovalItemBase) => Promise<void>;

/**
 * One executor per discriminator type. P3 registers only followup-draft, as a
 * no-op: the real outward action (POST /api/os/drafts on ShikksTracker) is P4
 * task 4.3 and replaces this function body.
 *
 * Asymmetric failure rule for real executors (CLAUDE.md): a throw BEFORE the
 * external side effect is retry-safe; a failure after — or in an unknown
 * state — parks the item as actionStatus "failed" for the human to verify.
 * Never guess which one happened.
 */
const executors: Record<string, ActionExecutor> = {
  "followup-draft": async () => {
    // No outward action exists in P3 — approving records the decision and
    // completes, so the whole state machine is exercised end to end.
  },
};

/**
 * Runs the action for a just-approved item and records the outcome with a
 * guarded update on actionStatus (pending → done | failed). Callers must
 * have connectDB()'d already. This function never throws — an action failure
 * lands in actionStatus/actionError, not in the HTTP response path.
 */
export async function runApprovalAction(item: IApprovalItemBase): Promise<void> {
  const executor = executors[item.type];
  if (!executor) {
    await ApprovalItem.updateOne(
      { _id: item._id, actionStatus: "pending" },
      {
        $set: {
          actionStatus: "failed",
          actionError: `No action executor registered for type "${item.type}".`,
          actionAt: new Date(),
        },
      }
    );
    return;
  }

  try {
    await executor(item);
    await ApprovalItem.updateOne(
      { _id: item._id, actionStatus: "pending" },
      { $set: { actionStatus: "done", actionAt: new Date() } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ApprovalItem.updateOne(
      { _id: item._id, actionStatus: "pending" },
      {
        $set: {
          actionStatus: "failed",
          actionError: message.slice(0, 2000),
          actionAt: new Date(),
        },
      }
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/queue.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/queue.ts src/lib/__tests__/queue.test.ts
git commit -m "feat: approval queue logic layer"
```

---

### Task 10: Queue API routes

**Files:**
- Create: `src/app/api/queue/route.ts`, `src/app/api/queue/[id]/decide/route.ts`

Route handlers stay thin (CLAUDE.md) — the behavior lives in `src/lib/queue.ts`, which Task 9 already tested. Note the Next 16 signature: dynamic route params arrive as a **Promise** (`context.params` must be awaited).

- [ ] **Step 1: Write `src/app/api/queue/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseLimit } from "@/lib/env";
import { buildExpirySweep } from "@/lib/queue";
import ApprovalItem, { APPROVAL_STATUSES } from "@/models/ApprovalItem";
import "@/models/approvals/FollowupDraftApproval"; // register the discriminator

/**
 * GET /api/queue?status=pending|approved|edited_approved|rejected|expired|all&limit=N
 *
 * Lists approval items, newest first, bounded (default 50, max 100).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? "pending";
  if (status !== "all" && !(APPROVAL_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { error: `status must be "all" or one of: ${APPROVAL_STATUSES.join(", ")}.` },
      { status: 400 }
    );
  }
  const limit = parseLimit(searchParams, 50, 100);

  await connectDB();

  // Lazy sweep before listing so a stale item can never render as pending
  // between cron runs; /api/cron/expire remains the scheduled guarantee.
  const sweep = buildExpirySweep(new Date());
  await ApprovalItem.updateMany(sweep.filter, sweep.update);

  const filter = status === "all" ? {} : { status };
  const items = await ApprovalItem.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  return NextResponse.json({ items });
}
```

- [ ] **Step 2: Write `src/app/api/queue/[id]/decide/route.ts`**

```ts
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { buildDecisionUpdate, parseDecision, runApprovalAction } from "@/lib/queue";
import ApprovalItem from "@/models/ApprovalItem";
import type { IFollowupDraftApproval } from "@/models/approvals/FollowupDraftApproval";
import "@/models/approvals/FollowupDraftApproval"; // register the discriminator

/**
 * POST /api/queue/:id/decide
 *
 * Body: { decision: "approve" }
 *     | { decision: "reject", rejectNote?: string }
 *     | { decision: "edit", draftBody: string, draftSubject?: string }
 *
 * Applies the decision with a guarded atomic update (only a still-pending
 * item transitions; a lost race returns 409), then — for approvals — runs the
 * item's action executor and records actionStatus.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  await connectDB();

  // The read is only for validation context (type + current payload); the
  // write below re-checks status atomically, so this is not read-modify-write.
  const item = await ApprovalItem.findById(id);
  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  const payload =
    item.type === "followup-draft" ? (item as IFollowupDraftApproval).payload : undefined;
  const parsed = parseDecision(body, item.type, payload);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { filter, update } = buildDecisionUpdate(parsed.value, new Date());
  const updated = await ApprovalItem.findOneAndUpdate({ _id: item._id, ...filter }, update, {
    new: true,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "Item is no longer pending (already decided or expired)." },
      { status: 409 }
    );
  }

  if (updated.status === "approved" || updated.status === "edited_approved") {
    await runApprovalAction(updated);
  }

  const fresh = await ApprovalItem.findById(item._id).lean();
  return NextResponse.json({ item: fresh });
}
```

- [ ] **Step 3: Verify build and commit**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both clean.

```bash
git add src/app/api/queue
git commit -m "feat: queue API routes"
```

---

### Task 11: Web push

**Files:**
- Create: `src/lib/push.ts`, `src/app/api/push/subscribe/route.ts`, `src/app/api/push/test/route.ts`, `public/sw.js`, `src/app/queue/PushControls.tsx`
- Test: `src/lib/__tests__/push.test.ts`

iOS constraints baked into this design: web push works only when the PWA is **installed to the home screen** (iOS ≥ 16.4), the permission prompt must come from a **user gesture** (hence a button, never an on-load prompt), and the app must be served over HTTPS.

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/push.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildPushPayload, parseSubscription } from "@/lib/push";

describe("buildPushPayload", () => {
  it("passes short values through with the default url", () => {
    expect(buildPushPayload("Title", "Body")).toEqual({
      title: "Title",
      body: "Body",
      url: "/queue",
    });
  });

  it("truncates title to 80 and body to 200 chars", () => {
    const p = buildPushPayload("t".repeat(100), "b".repeat(300));
    expect(p.title).toHaveLength(80);
    expect(p.body).toHaveLength(200);
  });

  it("accepts an explicit url", () => {
    expect(buildPushPayload("T", "B", "/queue?status=pending").url).toBe(
      "/queue?status=pending"
    );
  });
});

describe("parseSubscription", () => {
  const valid = { endpoint: "https://push.example/abc", keys: { p256dh: "k1", auth: "k2" } };

  it("accepts a valid subscription", () => {
    expect(parseSubscription(valid)).toEqual(valid);
  });

  it("ignores extra fields (browsers send expirationTime)", () => {
    expect(parseSubscription({ ...valid, expirationTime: null })).toEqual(valid);
  });

  it("rejects a non-https endpoint", () => {
    expect(parseSubscription({ ...valid, endpoint: "http://push.example/abc" })).toBeNull();
  });

  it("rejects missing keys", () => {
    expect(parseSubscription({ endpoint: valid.endpoint })).toBeNull();
    expect(parseSubscription({ endpoint: valid.endpoint, keys: { p256dh: "k1" } })).toBeNull();
  });

  it("rejects an over-length endpoint", () => {
    expect(parseSubscription({ ...valid, endpoint: "https://" + "x".repeat(1024) })).toBeNull();
  });

  it("rejects non-object bodies", () => {
    expect(parseSubscription(null)).toBeNull();
    expect(parseSubscription("str")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/push.test.ts`
Expected: FAIL — cannot resolve `@/lib/push`.

- [ ] **Step 3: Write `src/lib/push.ts`**

```ts
/**
 * push.ts — web push over VAPID.
 *
 * buildPushPayload / parseSubscription are pure (unit-tested); sendPushToAll
 * does the I/O. Per CLAUDE.md, notification sending is always the LAST step
 * of any multi-step job and its failure must never corrupt data state —
 * callers wrap it accordingly (see /api/cron/expire).
 */

import webpush from "web-push";
import { connectDB } from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/** Pure: bounded title/body so a runaway agent can't push a novel. */
export function buildPushPayload(title: string, body: string, url = "/queue"): PushPayload {
  return { title: title.slice(0, 80), body: body.slice(0, 200), url };
}

export interface ParsedSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Pure: validates a browser PushSubscription.toJSON() body. */
export function parseSubscription(body: unknown): ParsedSubscription | null {
  if (body === null || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (
    typeof b.endpoint !== "string" ||
    b.endpoint.length === 0 ||
    b.endpoint.length > 1024 ||
    !b.endpoint.startsWith("https://")
  ) {
    return null;
  }
  const keys = b.keys as Record<string, unknown> | undefined | null;
  if (!keys || typeof keys !== "object") return null;
  if (typeof keys.p256dh !== "string" || keys.p256dh.length === 0 || keys.p256dh.length > 256) {
    return null;
  }
  if (typeof keys.auth !== "string" || keys.auth.length === 0 || keys.auth.length > 256) {
    return null;
  }
  return { endpoint: b.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

function configureWebPush(): void {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must all be set.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

/**
 * Sends one payload to every subscribed device. Gone subscriptions (404/410
 * from the push service) are deleted so the collection self-heals; other
 * failures are counted, never retried in a loop (CLAUDE.md: no infinite
 * retry — the human is the escalation path).
 */
export async function sendPushToAll(
  payload: PushPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  configureWebPush();
  await connectDB();

  // Bounded: this is a single-user app; 20 devices is already generous.
  const subs = await PushSubscription.find().limit(20);

  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        JSON.stringify(payload),
        { TTL: 3600, timeout: 10000 } // explicit timeout — external call (CLAUDE.md)
      );
      sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await PushSubscription.deleteOne({ _id: sub._id });
        removed++;
      } else {
        failed++;
      }
    }
  }

  return { sent, failed, removed };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/push.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Write `src/app/api/push/subscribe/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseSubscription } from "@/lib/push";
import PushSubscription from "@/models/PushSubscription";

/**
 * POST /api/push/subscribe
 *
 * Body: the browser's PushSubscription.toJSON() — { endpoint, keys }.
 * Upserts by endpoint (re-subscribing the same device is idempotent).
 * There is no unsubscribe route on purpose: dead endpoints are pruned
 * automatically when the push service returns 404/410 (see sendPushToAll).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseSubscription(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "Body must be a web-push subscription: { endpoint, keys: { p256dh, auth } }." },
      { status: 400 }
    );
  }

  await connectDB();
  await PushSubscription.findOneAndUpdate(
    { endpoint: parsed.endpoint },
    { $set: { keys: parsed.keys } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Write `src/app/api/push/test/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";
import { buildPushPayload, sendPushToAll } from "@/lib/push";

/**
 * POST /api/push/test — sends a test notification to every subscribed
 * device. This is the P3 acceptance-test button (ROADMAP 3.5).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  try {
    const result = await sendPushToAll(
      buildPushPayload(APP_NAME, "Test notification — push is working.")
    );
    if (result.sent === 0) {
      return NextResponse.json(
        { error: "No push was delivered (no subscribed devices, or all sends failed).", ...result },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Push failed." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 7: Write `public/sw.js`** (plain JS — service workers don't go through the TS build)

```js
/* Service worker: displays pushes and opens the queue on tap. */

self.addEventListener("push", (event) => {
  let data = { title: "Notification", body: "", url: "/queue" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // non-JSON payload — show the defaults rather than dropping the push
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/queue";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
```

- [ ] **Step 8: Write `src/app/queue/PushControls.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

/** Standard conversion of a base64url VAPID key for pushManager.subscribe. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type PushStatus = "checking" | "unsupported" | "idle" | "subscribed" | "error";

export default function PushControls() {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // On iOS this is the not-installed-to-home-screen case too.
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "subscribed" : "idle");
      })
      .catch(() => setStatus("error"));
  }, []);

  // Must be called from a user gesture (iOS requirement) — hence a button.
  async function enable() {
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Notifications were not allowed.");
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setMessage("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setStatus("subscribed");
      setMessage("Notifications enabled on this device.");
    } catch {
      setMessage("Could not enable notifications.");
    }
  }

  async function sendTest() {
    setMessage(null);
    const res = await fetch("/api/push/test", { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { sent?: number; error?: string };
    setMessage(
      res.ok
        ? `Test sent to ${body.sent} device${body.sent === 1 ? "" : "s"}.`
        : body.error ?? "Test push failed."
    );
  }

  return (
    <div className="card">
      <p className="meta">Notifications</p>
      {status === "checking" && <p className="meta">Checking…</p>}
      {status === "unsupported" && (
        <p className="meta">
          Push is unavailable here. On iPhone, install the app to the home screen first
          (Share → Add to Home Screen) and open it from its icon.
        </p>
      )}
      {status === "error" && <p className="error">Service worker registration failed.</p>}
      {(status === "idle" || status === "subscribed") && (
        <div className="row">
          {status === "idle" && <button onClick={() => void enable()}>Enable notifications</button>}
          {status === "subscribed" && (
            <button className="secondary" onClick={() => void sendTest()}>
              Send test push
            </button>
          )}
        </div>
      )}
      {message && <p className="meta">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 9: Verify build and commit**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both clean.

```bash
git add src/lib/push.ts src/lib/__tests__/push.test.ts src/app/api/push public/sw.js src/app/queue/PushControls.tsx
git commit -m "feat: web push - subscribe flow, send helper, service worker"
```

---

### Task 12: Expiry sweep cron

**Files:**
- Create: `src/app/api/cron/expire/route.ts`, `vercel.json`

This is the P3 embodiment of the CLAUDE.md error-handling rules: the sweep writes an `AgentRun` record every run, and on failure queues a push alert **last**, after all data state is settled, wrapped so a notification failure can never corrupt anything.

- [ ] **Step 1: Write `src/app/api/cron/expire/route.ts`** (GET — Vercel crons issue GET requests)

```ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireCronSecret } from "@/lib/auth";
import { buildExpirySweep } from "@/lib/queue";
import { buildPushPayload, sendPushToAll } from "@/lib/push";
import ApprovalItem from "@/models/ApprovalItem";
import AgentRun from "@/models/AgentRun";

/**
 * GET /api/cron/expire
 *
 * Flips pending ApprovalItems whose staleAt has passed to "expired" so stale
 * items never linger (ARCHITECTURE.md §2.2). Writes an AgentRun record every
 * run; on failure, a push alert is queued LAST — after all data state is
 * settled — so a notification failure can never corrupt data (CLAUDE.md).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = requireCronSecret(request);
  if (guard) return guard;

  const startedAt = new Date();
  let expired = 0;
  let ok = true;
  let error: string | undefined;

  try {
    await connectDB();
    const { filter, update } = buildExpirySweep(new Date());
    const result = await ApprovalItem.updateMany(filter, update);
    expired = result.modifiedCount;
  } catch (err) {
    ok = false;
    error = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
  }

  // Run record — wrapped so a logging failure can't mask the sweep outcome.
  try {
    await AgentRun.create({
      agent: "expiry-sweep",
      startedAt,
      durationMs: Date.now() - startedAt.getTime(),
      ok,
      counts: { itemsCreated: 0, itemsProcessed: expired },
      ...(error !== undefined ? { error } : {}),
    });
  } catch (runErr) {
    console.error("[cron/expire] failed to write AgentRun:", runErr);
  }

  // Alert queued last (CLAUDE.md: alerts are sent last; failures notify the
  // human — no silent failure, no retry loop).
  if (!ok) {
    try {
      await sendPushToAll(buildPushPayload("Expiry sweep failed", error ?? "Unknown error"));
    } catch (pushErr) {
      console.error("[cron/expire] failure alert could not be sent:", pushErr);
    }
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expired });
}
```

- [ ] **Step 2: Write `vercel.json`** (region matches ShikksTracker — Manila proximity. Daily schedule because Vercel Hobby crons are once-per-day; intra-day staleness is covered by the lazy sweep in GET /api/queue. 21:00 UTC = 05:00 Manila.)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["hkg1"],
  "crons": [{ "path": "/api/cron/expire", "schedule": "0 21 * * *" }]
}
```

- [ ] **Step 3: Verify build and commit**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both clean.

```bash
git add src/app/api/cron vercel.json
git commit -m "feat: expiry sweep cron with AgentRun record and failure alert"
```

---

### Task 13: Approval Queue page + seed script

**Files:**
- Create: `src/app/queue/page.tsx`, `scripts/seed-approval.mts`

The `seed:approval` npm script was already added in Task 1. UI stays plain and dense (D10) — the status filter exists so the state transitions can be verified on the phone, not for polish.

- [ ] **Step 1: Write `src/app/queue/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { APP_NAME } from "@/lib/constants";
import PushControls from "./PushControls";

const STATUS_FILTERS = [
  "pending",
  "approved",
  "edited_approved",
  "rejected",
  "expired",
  "all",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

interface QueuePayload {
  contactName?: string;
  channel?: string;
  draftSubject?: string;
  draftBody?: string;
  replySnippet?: string;
}

interface QueueItem {
  _id: string;
  type: string;
  source: string;
  title: string;
  summary: string;
  status: string;
  actionStatus: string;
  actionError?: string;
  createdAt: string;
  staleAt?: string;
  payload?: QueuePayload;
  editedPayload?: QueuePayload;
}

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/queue?status=${statusFilter}`);
      if (res.status === 401) {
        window.location.href = "/login?from=/queue";
        return;
      }
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { items: QueueItem[] };
      setItems(body.items);
    } catch {
      setError("Could not load the queue.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function decide(id: string, payload: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/queue/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Decision failed.");
        return;
      }
      setEditingId(null);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main>
      <header className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1>{APP_NAME} — Queue</h1>
        <button className="secondary" onClick={() => void logout()}>
          Log out
        </button>
      </header>

      <div className="row">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={s === statusFilter ? "" : "secondary"}
            onClick={() => setStatusFilter(s)}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading && <p className="meta">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="meta">No {statusFilter === "all" ? "" : `${statusFilter.replace("_", " ")} `}items.</p>
      )}

      {items.map((item) => {
        const effective = item.editedPayload ?? item.payload;
        return (
          <div key={item._id} className="card">
            <div className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
              <strong>{item.title}</strong>
              <span className="badge">
                {item.status.replace("_", " ")}
                {item.status !== "pending" && item.status !== "rejected" && item.status !== "expired"
                  ? ` · action ${item.actionStatus}`
                  : ""}
              </span>
            </div>
            <p className="meta">
              {item.source} · {item.type} · {new Date(item.createdAt).toLocaleString()}
            </p>
            <p>{item.summary}</p>
            {effective?.replySnippet && (
              <p className="meta">Their reply: “{effective.replySnippet}”</p>
            )}
            {effective?.draftSubject && <p className="meta">Subject: {effective.draftSubject}</p>}
            {effective?.draftBody && <pre className="body">{effective.draftBody}</pre>}
            {item.actionError && <p className="error">Action error: {item.actionError}</p>}

            {item.status === "pending" && editingId !== item._id && (
              <div className="row">
                <button
                  disabled={busyId === item._id}
                  onClick={() => void decide(item._id, { decision: "approve" })}
                >
                  Approve
                </button>
                <button
                  className="secondary"
                  disabled={busyId === item._id}
                  onClick={() => {
                    setEditingId(item._id);
                    setEditBody(effective?.draftBody ?? "");
                  }}
                >
                  Edit
                </button>
                <button
                  className="danger"
                  disabled={busyId === item._id}
                  onClick={() => void decide(item._id, { decision: "reject" })}
                >
                  Reject
                </button>
              </div>
            )}

            {item.status === "pending" && editingId === item._id && (
              <div>
                <div className="row">
                  <textarea
                    rows={6}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                  />
                </div>
                <div className="row">
                  <button
                    disabled={busyId === item._id || editBody.trim().length === 0}
                    onClick={() => void decide(item._id, { decision: "edit", draftBody: editBody })}
                  >
                    Approve edited
                  </button>
                  <button className="secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <PushControls />
    </main>
  );
}
```

- [ ] **Step 2: Write `scripts/seed-approval.mts`**

```ts
/**
 * seed-approval.mts — seeds one pending followup-draft ApprovalItem.
 *
 * P3's acceptance test uses this: the real producer (the chaser) is P4, and
 * P3 explicitly has no dependency on it — the queue is tested with manually
 * seeded items (ROADMAP.md P3).
 *
 * USAGE:  npm run seed:approval
 */

import mongoose from "mongoose";
import FollowupDraftApproval from "../src/models/approvals/FollowupDraftApproval.ts";

async function main(): Promise<number> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set (read from .env.local via node --env-file).");
    return 1;
  }

  await mongoose.connect(uri, { bufferCommands: false, serverSelectionTimeoutMS: 10_000 });
  console.log(`Database: ${mongoose.connection.db?.databaseName ?? "(unknown)"}`);

  const item = await FollowupDraftApproval.create({
    source: "manual",
    title: "Follow up: Sample Bakery",
    summary: "Replied 3 days ago asking about pricing; no answer has gone out yet.",
    staleAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    payload: {
      contactId: "seed-contact-1",
      contactName: "Sample Bakery",
      channel: "facebook",
      draftBody:
        "Hi po! Salamat sa pag-reply. Para po sa isang simpleng website na may menu at " +
        "contact form, nasa PHP 8k–12k po ang usual range. Pwede ko po kayong gawan ng " +
        "free mockup para makita niyo muna. Kailan po kayo free para sa quick chat?",
      replySnippet: "Magkano po ang website?",
    },
  });

  console.log(`Seeded pending ApprovalItem ${item._id}`);
  await mongoose.disconnect();
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch(async (err) => {
    console.error("Seeding failed:", err instanceof Error ? err.message : err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
```

- [ ] **Step 3: Verify build and commit**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both clean.

```bash
git add src/app/queue/page.tsx scripts/seed-approval.mts
git commit -m "feat: approval queue page and seed script"
```

---

### Task 14: Verification trio + deploy + on-device acceptance test

No new code. This task turns "all green" into "actually done" (CLAUDE.md: an agent feature is done when it has been observed doing its job once against real data). Steps 4–10 need Riku's hands (Atlas/Vercel accounts, the iPhone) — if executing as an agent, run steps 1–3, then STOP and hand this checklist back.

- [ ] **Step 1: Full verification trio**

Run: `npm test`
Expected: all suites pass (env 8, session 18, loginRateLimit 7, proxy 18, models 13, queue 15, push 9 — 88 tests).

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run build`
Expected: clean production build.

- [ ] **Step 2: Local `.env.local`** — create it from `.env.example`: Atlas URI pointing at the **`rikuos` database** (same cluster as ShikksTracker is fine; separate database is the rule — ARCHITECTURE.md §1), a 12+ char `DASHBOARD_PASSWORD`, a generated 32+ char `SESSION_SECRET`, a `CRON_SECRET`, and VAPID keys from `npx web-push generate-vapid-keys` (public key goes in **both** `VAPID_PUBLIC_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`; `VAPID_SUBJECT` is a `mailto:` address).

- [ ] **Step 3: Index sync against the real database**

Run: `npm run migrate:indexes` — review the diff (everything should be CREATE; nothing to drop on a fresh database).
Run: `npm run migrate:indexes:apply`
Expected: per-model "applied" lines; re-running the dry run reports everything in sync. Confirm in the output that `LoginAttempt` has `ttl=900s` and `AgentRun` has `ttl=7776000s`.

- [x] **Step 4: Local smoke test**

Run: `npm run dev` and open http://localhost:3000 — expect a redirect to `/login`. Log in with the password → lands on `/queue` (empty). Run `npm run seed:approval` in a second terminal → refresh → the Sample Bakery card appears. Approve it → status flips to `approved · action done` (visible under the `approved` filter). Wrong password → 401; five wrong attempts → 429.

**Verified 2026-08-29** against `npm run dev` + the real Atlas `rikuos` database. Every assertion passed at the HTTP layer:
`GET /` → 307 `/login?from=%2F` (confirmed in Chrome too) · `GET /queue` → 307 `/login?from=%2Fqueue` · `GET /api/queue` without a cookie → 401 ·
login with the correct password → 200 + `__Host-session` · `GET /api/queue?status=pending` → `{"items":[]}` ·
after `npm run seed:approval` → 1 pending item with the Taglish draft intact · `POST /api/queue/:id/decide {"decision":"approve"}` → 200 with
`status=approved`, `actionStatus=done` (which `src/app/queue/page.tsx` renders as the badge `approved · action done`), and the item moved out of the
`pending` filter into `approved` · six wrong passwords → 401 ×5 then 429 (`LOGIN_MAX_PER_IP` default 5 / 15 min).

Not observed by eye: the rendered card and the Approve button click. The queue page is a client component, so `curl` only sees its `Loading…`
shell; the browser pass was cut short and the visual check was deliberately deferred — **P8** owns UI/UX (D10/D11), and Step 7–9 exercise the
same screens on the iPhone anyway.

- [ ] **Step 5: Deploy to Vercel** — create the Vercel project (`vercel link`, or the dashboard's Import), set all env vars from Step 2 on it (plus `APP_BASE_URL` = the production URL once known), and deploy (`vercel --prod` or git push if connected). Confirm in the Vercel dashboard that the cron `/api/cron/expire @ 0 21 * * *` was picked up from `vercel.json`.

- [ ] **Step 6: Verify the deployed cron gate**

Run: `curl -s -H "x-cron-secret: <CRON_SECRET>" https://<app>.vercel.app/api/cron/expire`
Expected: `{"ok":true,"expired":0}`. Without the header: 401.

- [ ] **Step 7: Install the PWA on the iPhone** — open the production URL in Safari, log in, then Share → **Add to Home Screen**, and open the app **from its icon** (required for iOS push). It should launch standalone (no Safari chrome) straight into the queue.

- [ ] **Step 8: Push acceptance** — in the app, tap **Enable notifications** → allow the iOS prompt → tap **Send test push** → **lock the phone** → the notification must land on the lock screen, and tapping it must open the app on the queue.

- [ ] **Step 9: Queue acceptance on real state transitions** — run `npm run seed:approval` three times (against the same Atlas DB the deployment uses), then on the phone:
  1. **Approve** one → shows `approved · action done`.
  2. **Edit** one (change the Taglish text) → shows `edited approved · action done`; the `all` filter shows the original payload retained alongside the edit.
  3. **Reject** one → shows `rejected`.
  4. Double-tap protection: approving an already-decided item (two tabs) returns the 409 error message, not a second transition.

- [ ] **Step 10: Expiry check** — seed one more item, then set its `staleAt` into the past (Atlas UI or `mongosh`), reload the queue → it must show under `expired`, not `pending` (the lazy sweep), and the next cron run's response/`AgentRun` should count it.

**Done when** (ROADMAP P3, verbatim): installed on the iPhone, logged in, a manually seeded ApprovalItem shows up, approving it flips states correctly, and a push lands on the lock screen.

---

## Out of scope (do not build in P3)

- ShikksTracker API client, chaser cron, Anthropic drafting — **P4** (needs P1's OS API).
- Watchdog, site health, morning dispatcher — **P5**.
- Messenger triage endpoint — **P6**.
- `reply-draft`, `client-issue-email`, `triage-response`, `skill-edit` discriminators — each ships with its phase.
- Dashboard pages of any kind — **P8, last by hard rule (D10/D11)**.
- Passkey/WebAuthn login — post-v0 (S3).
- Any visual design work beyond the plain CSS above — **P8**.
