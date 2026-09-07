# P8a — Shell and skin: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the app shell (170px rail with six live agent badges, 44px top bar), the four-file visual system, the re-skin of `/queue` and `/settings`, and an empty `/freelance` route root — so that Plan B and Plan C build on a finished chrome.

**Architecture:** One global stylesheet split into four files loaded in a fixed order from the single root layout, so the cascade is read in one file rather than discovered in production. A Next route group `(app)` holds one server-rendered shell above `/queue`, `/settings` and `/freelance`; `/login` stays outside it. The per-agent judgement the watchdog digest already makes is extracted into a pure `classifyAgentRun`, and a second pure function `deriveAgentStatuses` turns it into one badge row per agent — total by construction, never inferring health from absence. A database failure in the rail is caught inside the async server component and renders six grey `—` badges rather than blanking the route.

**Tech Stack:** Next.js 16.2.10 (App Router) · React 19.2 · TypeScript `strict` · Mongoose 9 · Vitest 4 · `next/font/google` · plain CSS custom properties. **No new dependency is installed by this plan.**

---

## Series file map

P8 is three plans. **Plan A (this file)** builds the shell and the skin. **Plan B** builds data, logic and the health reading. **Plan C** builds the Freelance page render. B and C cite this map; the names and paths below are fixed here and must not be renamed later.

### Plan A — shell and skin (this plan)

| File | Plan | Responsibility |
|---|---|---|
| `src/styles/tokens.css` | A creates | `:root` custom properties only — colours, spacing, radii, layout. **No font families** (those come from `next/font`). |
| `src/styles/base.css` | A creates | Reset, `html`/`body`, `p`, `strong`, `a`, `:focus-visible`, `::selection`, reduced motion. |
| `src/styles/components.css` | A creates | The ported recipe book: shell, section rhythm, stat cards, rows, disclosure, tables, Block E/F vocabulary, buttons, tags. Plan C consumes the `.fl-*` half without editing it at all: `.stat-top .more` becomes an `<a>` in Plan C, and its `border-bottom:0` was added here by the quality review rather than left as a follow-up, the way `.navitem` and `.fl-biz` already have it. |
| `src/styles/legacy.css` | A creates | The old pages' bare selectors (`main`, `h1`, `button`, `.card`, `.badge`, `.meta`, `.row`, `.error`, `pre.body`, `input`, `textarea`, `label`, autofill). Has an expiry date. |
| `src/app/globals.css` | A **deletes** | Contents redistributed across the four above. |
| `src/app/layout.tsx` | A modifies | Loads the three faces via `next/font/google`, imports the four stylesheets in fixed order, sets `viewport.themeColor` / `colorScheme` and the black status bar. |
| `src/app/manifest.ts` | A modifies | `background_color` / `theme_color` become `#08090B` so the installed app does not flash white. |
| `src/app/icon.tsx` | A modifies | 512px app icon: the brand tile, full-bleed, no baked radius. |
| `src/app/apple-icon.tsx` | A modifies | The same at 180px. |
| `src/components/icons.tsx` | A creates | Named SVG components: `IconQueue`, `IconFreelance`, `IconSettings`, `IconInfo`, `IconMark`. Plan C consumes `IconInfo`. |
| `src/app/(app)/layout.tsx` | A creates | The shell: session check, `.app` / `.app-body` / `.app-main`. Renders **no** `<main>`. |
| `src/app/(app)/_shell/Rail.tsx` | A creates | Server. Brand tile, nav, agents group, foot. |
| `src/app/(app)/_shell/NavList.tsx` | A creates | `"use client"` — marks the active nav item from `usePathname()`; sets `aria-current`. |
| `src/app/(app)/_shell/AgentsBlock.tsx` | A creates | Server, async. Reads runs + switches (via `readOsSettings`, R37) in one `try/catch` under a five-second `withDeadline` (R38); one `BadgeRow` for all three renders (R40); exports `AgentsSkeleton`. |
| `src/app/(app)/_shell/TopBar.tsx` | A creates | `"use client"` since R39. The one freshness stamp, recomputed at every navigation, formatted in `Asia/Manila`. |
| `src/app/(app)/_shell/LogoutButton.tsx` | A creates | `"use client"`. The app's only sign-out control. |
| `src/app/(app)/queue/` | A moves | `git mv` from `src/app/queue/`. Contents otherwise untouched except the header deletion below. |
| `src/app/(app)/queue/page.tsx` | A modifies | Delete the inline `<header className="row">`, the now-unused `logout()`, and the `Link` / `APP_NAME` imports. Nothing else. |
| `src/app/(app)/settings/page.tsx` | A modifies | Delete the inline `<header className="row">` and the `Link` / `APP_NAME` imports. Nothing else. |
| `src/app/(app)/freelance/page.tsx` | A creates, **C rewrites** | Plan A ships a title and nothing else so the rail's third nav item is not a dead link. |
| `src/lib/watchdog.ts` | A modifies, **B reads** | Gains `classifyAgentRun`, `AgentVerdict`, `AGENT_STALE_HOURS`, `RAIL_AGENTS`, `AgentBadgeState`, `AgentSwitches`, `AgentStatus`, `deriveAgentStatuses`. `EXPECTATIONS` and `evaluateWatchdog`'s output are unchanged. Plan B imports `AGENT_STALE_HOURS` for Block F's 30-hour rule. |
| `src/lib/__tests__/watchdog.test.ts` | A leaves **byte-for-byte unchanged** | It is the refactor's proof. |
| `src/lib/__tests__/agentStatus.test.ts` | A creates | Pins all badge states, the switch-derived `off`, the `AGENT_STALE_HOURS` boundary, totality and ordering. |
| `src/lib/deadline.ts` | A creates (R38) | `withDeadline(promise, ms, label)` — `Promise.race` against a timer that is always cleared. Plan C's snapshot read uses it too. |
| `src/lib/__tests__/deadline.test.ts` | A creates (R38) | Fake-timer tests: the promise wins, the timer wins, the timer is cleared either way. |
| `src/lib/osSettings.ts` | A modifies (R37) | Gains `readOsSettings()` — `findOne`, never upsert-on-read; schema defaults when no document exists. `getOsSettings()` unchanged for its cron/API callers. |
| `src/models/OsSettings.ts` | A modifies (R37) | Gains `OS_SETTINGS_DEFAULTS`, the one home for the three defaults, used by the schema and the read fallback. |

### Plan B — data, logic and the health reading (not this plan)

| File | Responsibility |
|---|---|
| `src/lib/stApi.ts` | Widen `SummaryResponse` (`SummaryContacts`, `SummaryCampaign`, `PIPELINE_STAGES`, `PipelineStage`), carry the new blocks through `fetchSummary`'s reconstruction, add `fetchVariantStats`, add an optional `timeoutMs` to all three GETs, export `ATTENTION_LIMIT` (moved from the cron route) and `ST_PAGE_TIMEOUT_MS`. |
| `src/lib/format.ts` | `formatAge` (moved out of `outreachHealth.ts`), the Block E waiting grammar, pluralisation. Deliberately unprefixed. |
| `src/lib/freelanceView.ts` | Blocks A, B and C view models. |
| `src/lib/freelanceVariants.ts` | Block D — the email / not-measurable split, rate recomputed locally. |
| `src/lib/freelanceGaps.ts` | Block E — the gap calculation. |
| `src/lib/freelanceHealth.ts` | Block F — composes `evaluateOutreach` with the stored snapshot; takes the staleness threshold as an argument (`AGENT_STALE_HOURS` from `watchdog.ts`). |
| `src/lib/queue.ts` | Gains `fetchLiveAnchorIds`, extracted from the chaser route; both callers share it. |
| `src/models/HealthSnapshot.ts` | The singleton site-health reading. No TTL, no `Mixed`, bounded array. |
| `src/lib/healthSnapshot.ts` | `saveHealthSnapshot`, `getHealthSnapshot` (**`findOne`, never upsert-on-read**), `CHECK_FLOOR_MS`, `isWithinCheckFloor`. |
| `src/app/api/health/sites/route.ts` | `POST` — `requireSession`, `connectDB`, floor, `checkSites`, save, return. |
| `src/app/api/cron/morning/route.ts` | The `site-health` job writes the snapshot in its own `try/catch`; imports `ATTENTION_LIMIT` from `stApi.ts`. |
| `src/lib/__tests__/` | `format.test.ts`, `freelanceView.test.ts`, `freelanceVariants.test.ts`, `freelanceGaps.test.ts`, `freelanceHealth.test.ts`, `healthSnapshot.test.ts`, and `stApi.test.ts` extended. |

### Plan C — the Freelance page render (not this plan)

| File | Responsibility |
|---|---|
| `src/app/(app)/freelance/page.tsx` | Rewritten: `force-dynamic`, `maxDuration = 30`, `Promise.allSettled` over the three ShikksTracker calls, renders the blocks. |
| `src/app/(app)/freelance/_blocks/HeroRow.tsx` | Block A cards. |
| `src/app/(app)/freelance/_blocks/StateOfPlay.tsx` | Block A lines. |
| `src/app/(app)/freelance/_blocks/Pipeline.tsx` | Block B. |
| `src/app/(app)/freelance/_blocks/Campaigns.tsx` | Block C. |
| `src/app/(app)/freelance/_blocks/Approaches.tsx` | Block D. |
| `src/app/(app)/freelance/_blocks/NeedsYou.tsx` | Block E. |
| `src/app/(app)/freelance/_blocks/HealthStrip.tsx` | Block F. |
| `src/app/(app)/freelance/_blocks/CheckNow.tsx` | `"use client"` — the page's only client island. |

---

## Ground rules for every task in this plan

- **Repo boundary.** Nothing in this plan touches `../ShikksTracker`, and nothing connects to its database.
- **No new dependency.** Not `clsx`, not `date-fns`, not an icon package, not `next-themes`.
- **No CSP change.** `next/font/google` downloads at build time and serves from `/_next/static`, which `default-src 'self'` already covers.
- **No `dangerouslySetInnerHTML`.** Every SVG is JSX.
- **`src/proxy.ts` is not edited.** A route group changes no URL.
- **`src/app/login/page.tsx` is not edited.**
- Every commit runs on `master` and is never pushed. Every commit message ends with the trailer line shown in the commit steps.
- Commands are written for **Git Bash on Windows** from the repo root (`C:/Users/Shikks/Projects/ClaudeProjects/RikuOS`).

---

## Task 1: The three faces, the viewport and the manifest

Fonts land **before** the stylesheets on purpose. `tokens.css` deliberately does not define `--display`, `--body` or `--mono`; if the stylesheets shipped first, every `font-family: var(--body)` would resolve to nothing and silently inherit.

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/manifest.ts`

- [ ] **Step 1: Rewrite `src/app/layout.tsx`**

Replace the whole file with:

```tsx
import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

/**
 * Three faces, three CSS variables named exactly --display / --body / --mono,
 * so every recipe ported out of docs/design/p8-mockup.html works unchanged.
 *
 * Archivo and JetBrains Mono are variable families on Google Fonts and must
 * OMIT `weight`; IBM Plex Sans is served as static weights and requires it.
 * next/font/google throws a clear build error either way — let the build say
 * so rather than guessing.
 *
 * display: "swap", not "optional" — "optional" can silently drop the webfont
 * on a first load, and the mono is the part that must stay. adjustFontFallback
 * is left on (the default) so the swap does not shift the layout.
 */
const display = Archivo({ subsets: ["latin"], display: "swap", variable: "--display" });
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--body",
});
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--mono" });

export const metadata: Metadata = {
  title: APP_NAME,
  // "black", not "black-translucent": translucent slides content under the
  // status bar and needs the safe-area layout work this phase defers.
  appleWebApp: { capable: true, statusBarStyle: "black", title: APP_NAME },
};

// Next reads themeColor from `viewport`, not from `metadata`; putting it in
// metadata silently does nothing.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#08090B",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Rewrite `src/app/manifest.ts`**

Replace the whole file with:

```ts
import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    start_url: "/queue",
    display: "standalone",
    // --void. Left at #ffffff the installed app flashes white on every
    // launch, which is the most visible possible bug in a dark-only design.
    background_color: "#08090B",
    theme_color: "#08090B",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run build`
Expected: `✓ Compiled successfully`, then a route table listing `/queue`, `/settings`, `/login`. **If the build fails with a message about `weight`, that is `next/font` telling you a family is variable or static the other way round — follow the message, do not guess.**

- [ ] **Step 4: Confirm all three font variables are declared**

Run: `grep -c 'variable: "--' src/app/layout.tsx`
Expected: `3`

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/manifest.ts
git commit -F - <<'EOF'
feat(p8a): load the three faces, darken the splash and the status bar

Archivo / IBM Plex Sans / JetBrains Mono through next/font/google, exposed
as --display / --body / --mono so ported recipes work unchanged. They are
NOT tokens: tokens.css must not shadow them.

themeColor and colorScheme go on the viewport export (Next ignores them on
metadata), the manifest's splash ground becomes --void, and the iOS status
bar becomes black rather than the light default.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

---

## Task 2: The four stylesheets, and the death of `globals.css`

Ported nearly verbatim from `docs/design/p8-mockup.html`'s `tokens` / `base` / `components` / `legacy` sections. Five deliberate differences from the mockup, each marked in a comment in the file itself:

1. `.stat .marks` is **dropped** — Riku chose the plain hero row, so the mark field ships nowhere.
2. `.stat .sub` gains a two-line `min-height` (32px) — new CSS, not in the mockup — so a wrapping caption cannot lift its bottom-anchored figure above the others.
3. `.app-content` gains `max-width: none` so `legacy.css`'s `main` rule does not apply a second column to `/freelance`'s own `<main className="app-content">`.
4. `.navitem` gains `border-bottom: 0`. The mockup draws nav items as `<span>`; the app draws them as `<Link>` → `<a>`, and `base.css`'s `a` rule puts a hairline under every anchor. The mockup already does exactly this for `.fl-biz`.
5. `.app-body` gains `min-height: 100vh` (**R33**). The mockup was drawn inside a fixed-height frame; on a short page such as Plan A's `/freelance` root the rail column would otherwise stop mid-screen.

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/base.css`
- Create: `src/styles/components.css`
- Create: `src/styles/legacy.css`
- Delete: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/styles/tokens.css`**

```css
/* ============================================================
   tokens.css — :root custom properties only. Nothing else lives here.
   source: DESIGN-INSPO §2 / §3, hexes verbatim, ported from the
   `tokens` section of docs/design/p8-mockup.html so drift shows up
   in a diff.

   The six semantic hues are one closed set plus --track. No token is
   named after its colour and none ever will be: a token named for how
   it looks is how a hue eventually gets used for the wrong meaning.

   NAME MAP. docs/design/components.html names the amber and red tokens
   --amber and --alert. Same hexes, different names. A recipe copied out
   of that file needs  --alert -> --missing  and  --amber -> --stale.
   Do NOT define aliases: a second name for the same hue is how the hue
   eventually gets used for the wrong meaning. A custom property that
   resolves to nothing is invalid at computed-value time, so a stray
   var(--alert) would make a red warning silently INHERIT body grey.

   NOT DEFINED HERE: --display, --body and --mono. Those three come from
   next/font/google in src/app/layout.tsx, which puts them on <html> via
   the generated .variable class names. Declaring them here would shadow
   the loaded faces with family names that do not exist.

   Deliberately not ported: --skill (graph-only, and there is no graph)
   and the -dim tokens (the gradients inline their stops instead).
   --session is defined and unused on purpose — a fixed set stays
   complete, and that is settled.

   Dark only. No @media (prefers-color-scheme). No [data-theme].
   ============================================================ */
:root{
  /* ground & structure */
  --void:#08090B;
  --panel:#0E1013;
  --raised:#14171C;
  --sunk:#050608;
  --line:#1D222A;
  --line-soft:#15191F;

  /* ink */
  --ink:#E9ECF0;
  --ink-2:#98A1AD;
  --ink-3:#5B6470;
  --ink-4:#3A424C;

  /* semantic hues — meaning is fixed */
  --spend:#FF8A3D;
  --save:#35D399;
  --roi:#A78BFA;
  --session:#5FA5FA;
  --stale:#FBBF24;
  --missing:#F87171;

  /* the one non-hue graphic token */
  --track:#1A1E25;

  /* card tints — 155deg, deep desaturated hue into near-neutral at 62% */
  --tint-roi:linear-gradient(155deg,#171233,#111117 62%);
  --tint-stale:linear-gradient(155deg,#241A03,#141209 62%);

  /* spacing 4 / 6 / 10 / 14 / 20 / 28 / 44 / 72 */
  --sp-1:4px; --sp-2:6px; --sp-3:10px; --sp-4:14px;
  --sp-5:20px; --sp-6:28px; --sp-7:44px; --sp-8:72px;

  /* radii */
  --r-tag:6px; --r-nav:7px; --r-chip:8px; --r-card:10px; --r-feature:14px; --r-pill:999px;

  /* layout */
  --content-max:920px;
  --rail-w:170px;
}
```

- [ ] **Step 2: Create `src/styles/base.css`**

```css
/* ============================================================
   base.css — reset, html/body, prose, links, focus, selection,
   reduced motion. Ported from the `base` section of
   docs/design/p8-mockup.html.

   `h1` is NOT here: it is one of the old pages' bare selectors and
   lives in legacy.css beside the rest of them, which is where both
   the mockup and the spec's §6.1 selector table put it.
   ============================================================ */
*{box-sizing:border-box}
/* so the browser paints scrollbars, spinners and number steppers dark */
html,body{color-scheme:dark}
body{
  margin:0;
  background:var(--void);
  color:var(--ink);
  font-family:var(--body);
  font-size:13px;
  line-height:1.5;
  -webkit-font-smoothing:antialiased;
}
p{margin:var(--sp-3) 0 0;font-size:13px;color:var(--ink-2)}
strong{font-weight:600;color:var(--ink)}
/* A deliberate deviation from components.html, which makes links orange.
   That is right for a teardown article, where orange is the document's
   accent. In the app orange is --spend: money out, and the brand mark.
   A `Settings` link is neither. */
a{color:var(--ink-2);text-decoration:none;border-bottom:1px solid var(--line)}
a:hover{color:var(--ink);border-bottom-color:var(--ink-4)}
/* a reference-level convention, not a hue spend */
:focus-visible{outline:2px solid var(--spend);outline-offset:3px;border-radius:3px}
/* neutral, not violet: a selection band is not a decision, and no hue is spent
   where it does not carry its assigned meaning */
::selection{background:rgba(233,236,240,.16);color:var(--ink)}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
```

- [ ] **Step 3: Create `src/styles/components.css`**

```css
/* ============================================================
   components.css — the shared vocabulary, ported from the
   `components` section of docs/design/p8-mockup.html.

   Two namespaces and no third. Reference names are kept verbatim
   (.stat, .btn, .tag, .eyebrow, .navitem, .agent, .track,
   .statuspill) so a recipe can be diffed against components.html by
   eye; anything only the Freelance page has carries the page prefix
   `fl-`. No BEM, no utility classes.

   docs/design/components.html's own article furniture — .frame, its
   .rail, .masthead, .kicker, .standfirst, .well, .caption, .debt,
   .swatches — is chrome for a document ABOUT components and ships
   nowhere.

   Five deliberate differences from the mockup, each marked below:
     1. `.stat .marks` is dropped (Riku chose the plain hero row).
     2. `.stat .sub` gains a two-line min-height (new CSS).
     3. `.app-content` gains max-width:none.
     4. `.navitem` gains border-bottom:0 (it is an <a> in the app).
     5. `.app-body` gains min-height:100vh (R33).
   ============================================================ */

/* ---- shell ---------------------------------------------------- */
.app{background:var(--void);min-width:0}
/* DIFFERENCE 5 (R33): min-height:100vh, so the rail's ground reaches the
   bottom of the viewport on every page. The mockup was drawn inside a
   fixed-height frame; on a short page such as Plan A's /freelance root the
   rail column would otherwise stop mid-screen. */
.app-body{
  display:grid;grid-template-columns:var(--rail-w) minmax(0,1fr);
  align-items:stretch;min-height:100vh;
}

.app-side{
  background:#0B0D11;border-right:1px solid var(--line-soft);
  padding:16px 12px 16px 12px;display:flex;flex-direction:column;gap:16px;
}
.app-brand{display:flex;align-items:center;gap:9px;padding:0 4px}
.app-brand .tile{
  width:24px;height:24px;border-radius:7px;flex:none;display:grid;place-items:center;
  background:linear-gradient(150deg,#FF9E5C,#F2622B);
}
.app-brand .tile svg{width:14px;height:14px;display:block}
/* overflow-wrap + min-width:0 so nothing assumes the product name's length */
.app-brand .wm{
  font-family:var(--display);font-weight:600;font-size:13px;letter-spacing:-.01em;
  color:var(--ink);overflow-wrap:anywhere;min-width:0;
}

.app-nav{display:flex;flex-direction:column;gap:2px}
/* DIFFERENCE 4: border-bottom:0. The mockup draws nav items as <span>;
   the app draws them as <Link> -> <a>, and base.css puts a hairline
   under every anchor. .fl-biz below already does the same thing. */
.navitem{
  display:flex;align-items:center;gap:9px;padding:6px 9px;border-radius:var(--r-nav);
  font-size:12.5px;color:var(--ink-3);border-bottom:0;
}
.navitem svg{width:13px;height:13px;flex:none;opacity:.85;display:block}
/* a raised fill plus an INSET hairline — never a left accent bar */
.navitem.is-active{background:#171B21;color:var(--ink);box-shadow:inset 0 0 0 1px var(--line)}

.grouplabel{
  font-family:var(--mono);font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--ink-4);padding:0 9px;margin-top:6px;display:block;
}
.agents{display:flex;flex-direction:column;gap:6px;margin-top:7px}
.agent{
  display:block;padding:8px 9px;border-radius:var(--r-chip);background:#12151A;
  border:1px solid var(--line);font-family:var(--mono);font-size:10px;
  font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-4);
}
/* ok: green label, thin green border, deliberately NO tinted fill */
.agent.is-ok{color:var(--save);border-color:rgba(53,211,153,.18)}
/* overdue / failed: the reference's tinted-badge recipe in --stale / --missing.
   Failed carries the heavier fill (.14/.03) because amber is intrinsically
   brighter than red — at equal alpha the merely-late agent outshouts the broken one. */
.agent.is-overdue{
  color:var(--stale);border-color:rgba(251,191,36,.22);
  background:linear-gradient(180deg,rgba(251,191,36,.09),rgba(251,191,36,.02));
}
.agent.is-failed{
  color:var(--missing);border-color:rgba(248,113,113,.22);
  background:linear-gradient(180deg,rgba(248,113,113,.14),rgba(248,113,113,.03));
}
/* off / never run / unknown — inherits .agent's ground; a dead agent must never
   sit brighter than a live one */
.agent.is-grey{color:var(--ink-4);border-color:var(--line)}
.agent-cap{
  display:block;font-family:var(--mono);font-size:8.5px;letter-spacing:.06em;
  color:var(--ink-4);padding:0 9px;margin-top:4px;font-variant-numeric:tabular-nums;
}
.app-side .rail-foot{margin-top:auto}
/* the app's only sign-out control — --ink-3, never --ink-4 */
.app-side .btn.ghost{font-size:11.5px;letter-spacing:.1em;padding:6px 9px;color:var(--ink-3)}

.app-main{min-width:0}
.topbar{height:44px;border-bottom:1px solid var(--line-soft);padding:0 var(--sp-6);display:flex}
.topbar-in{width:100%;max-width:var(--content-max);margin:0 auto;display:flex;align-items:center;gap:12px}
/* the top bar carries the freshness stamp and nothing else: no breadcrumb.
   `Operator` named nobody in a one-user system and was the bar's brightest
   element; the crumb's page name restated the title 70px below it. What is
   left is the only thing in the bar that ever changes. The shell renders it
   on every page from the request time (Asia/Manila) — on a force-dynamic
   page that is the moment the data was read. */
.crumb{font-size:11.5px;color:var(--ink-2);font-variant-numeric:tabular-nums}
.crumb em{font-style:normal;color:var(--ink-4)}
/* DIFFERENCE 3: max-width:none, so legacy.css's `main` rule cannot apply a
   second column to /freelance's own <main className="app-content">. The
   28px horizontal padding lives HERE and the 920px max-width lives on .fl,
   because box-sizing:border-box means a 920px element WITH padding gives
   864px of content, at which point four hero cards wrap. */
.app-content{padding:var(--sp-6) var(--sp-6) var(--sp-8);max-width:none}

/* ---- section rhythm (the eyebrow / title pair) ----------------- */
.eyebrow{
  display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--ink-3);
}
.fl-h{
  display:block;font-family:var(--display);font-weight:600;font-size:19px;
  letter-spacing:-.015em;color:var(--ink);margin-top:5px;
}
.fl-title{
  font-family:var(--display);font-weight:600;font-size:24px;letter-spacing:-.02em;color:var(--ink);
}
.fl{max-width:var(--content-max);margin:0 auto}
.fl-sect{margin-top:var(--sp-7)}
.fl-body{margin-top:var(--sp-5)}

/* ---- stat hero cards ------------------------------------------ */
/* four cards at minmax(215px,1fr) with 14px gaps need 4*215 + 3*14 = 902 <= 920;
   they land at (920 - 42) / 4 = 219.5px each, so the money-in card fits later
   with 18px to spare and no deviation from this template */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:var(--sp-4)}
.stat{
  position:relative;overflow:hidden;border-radius:var(--r-feature);
  padding:15px 16px 18px;min-height:132px;
  border:1px solid var(--line);background:var(--raised);
  display:flex;flex-direction:column;
}
.stat-top{display:flex;align-items:center;gap:7px;position:relative;z-index:2}
.stat-top .lbl{
  font-family:var(--mono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--ink-3);
}
.stat-top .more{
  margin-left:auto;font-family:var(--mono);font-size:8.5px;letter-spacing:.13em;
  text-transform:uppercase;color:var(--ink-4);
}
.stat .fig{
  font-family:var(--display);font-weight:700;font-size:34px;letter-spacing:-.03em;
  line-height:1.06;margin-top:auto;position:relative;z-index:2;
  font-variant-numeric:tabular-nums;color:var(--ink);
}
/* DIFFERENCE 2: min-height reserves two lines of caption at 10.5px/1.5.
   .stat .fig is bottom-anchored, so a caption that wraps would otherwise
   lift its figure above the others — and the "didn't report" captions wrap
   at 219-297px card widths while `nothing waiting` does not. */
.stat .sub{
  font-size:10.5px;color:var(--ink-3);position:relative;z-index:2;margin-top:2px;
  min-height:32px;
}
/* violet — decisions not made */
.stat.roi{background:var(--tint-roi);border-color:rgba(167,139,250,.2)}
.stat.roi .lbl,.stat.roi .fig{color:var(--roi)}
/* this card's `Open ↗` is the page's one exit to ShikksTracker, not ornament */
.stat.roi .more{color:var(--ink-3)}
/* amber — a duration is waiting */
.stat.stale{background:var(--tint-stale);border-color:rgba(251,191,36,.2)}
.stat.stale .lbl,.stat.stale .fig{color:var(--stale)}
/* hueless WITH data */
.stat.plain{background:var(--raised);border-color:var(--line)}
.stat.plain .fig{color:var(--ink)}
/* a MEASURED zero (`0`) — the hue drains, the caption still reports.
   `nothing waiting` is the answer the page exists to give and must not be
   the dimmest text on the screen. */
.stat.drained{background:var(--raised);border-color:var(--line)}
.stat.drained .lbl,.stat.drained .fig{color:var(--ink-4)}
/* NOTHING WAS MEASURED (`—`) — the whole card drains, caption included,
   because that caption is a "ShikksTracker didn't report…" sentence. */
.stat.blank{background:var(--raised);border-color:var(--line)}
.stat.blank .lbl,.stat.blank .fig,.stat.blank .sub{color:var(--ink-4)}
/* the one hero graphic: a proportion track, no hue */
.track{
  height:4px;border-radius:99px;background:var(--track);overflow:hidden;
  margin-top:9px;position:relative;z-index:2;
}
.track i{display:block;height:100%;border-radius:99px;background:var(--ink-4)}
/* The track's 13px slot (4px + 9px) is reserved on the cards that have none,
   so all three figures and all three captions sit on one baseline. Only the
   contacts card ever fills it. The app targets current Chrome, so :has() is
   available; the explicit fallback if that ever changes is
   .stat.roi .sub,.stat.stale .sub,.stat.drained .sub,.stat.blank .sub{margin-top:15px} */
.stat:not(:has(.track)) .sub{margin-top:15px}
/* DIFFERENCE 1: the mockup's `.stat .marks` mark-field rule is NOT ported.
   Riku chose the plain hero row; the only graphic on it is .track above. */

/* ---- statements under the hero row ---------------------------- */
.fl-say{font-size:13px;color:var(--ink-2);margin-top:var(--sp-4)}
.fl-say b{font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}

/* ---- inline stat strip / Block B's summary line ---------------- */
/* .statstrip ships as declared, unused vocabulary. That list is
   .statstrip, .btn.go, .statuspill and --session, and it must not grow. */
.statstrip{display:flex;flex-wrap:wrap;gap:20px;padding:12px 16px;border-top:1px solid var(--line);background:var(--panel)}
.statstrip div{font-size:11px;color:var(--ink-3)}
.statstrip b{font-family:var(--display);font-size:13.5px;font-weight:700;margin-right:5px;font-variant-numeric:tabular-nums}
.fl-sum{
  border-top:0;background:none;margin:0;padding:6px 0 0;display:block;
  font-size:11px;color:var(--ink-3);font-variant-numeric:tabular-nums;
}
.fl-sum b{font-family:var(--display);font-size:13.5px;font-weight:700;color:var(--ink);margin:0;font-variant-numeric:tabular-nums}
.fl-sum i{font-style:normal;color:var(--ink-4);margin:0 5px}

/* ---- row grammar: hairlines, a fixed grid, no boxes ------------ */
.fl-stages{margin-top:var(--sp-4)}
.fl-stage{
  display:grid;grid-template-columns:minmax(0,1fr) 64px;gap:var(--sp-4);
  align-items:baseline;padding:11px 0;border-top:1px solid var(--line-soft);
}
.fl-stages>.fl-stage:first-child{border-top:0}
.fl-stage .nm{font-size:13px;color:var(--ink-2)}
.fl-stage .ct{
  font-family:var(--display);font-weight:600;font-size:15px;color:var(--ink);
  text-align:right;font-variant-numeric:tabular-nums;
}
/* Two notes, not rows — deliberately no hairline above either. They are the
   same shape in two inks because they are two different claims:
   .fl-note   = a MEASURED emptiness (the source answered, the count was zero)
   .fl-absent = the field NEVER ARRIVED (--ink-4 is reserved for these) */
.fl-note{font-size:11px;color:var(--ink-3);margin-top:var(--sp-3)}
.fl-absent{font-size:11px;color:var(--ink-4);margin-top:var(--sp-3)}
.fl-empty{font-size:13px;color:var(--ink-3);margin-top:var(--sp-5)}

/* ---- disclosure (Blocks C and D) ------------------------------- */
.disclose>summary{display:block;list-style:none;cursor:pointer}
.disclose>summary::-webkit-details-marker{display:none}
.sumrow{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:end}
.sumrow::after{
  content:"";width:6px;height:6px;align-self:end;margin-bottom:7px;
  border-right:1.5px solid var(--ink-4);border-bottom:1.5px solid var(--ink-4);
  transform:rotate(-45deg);transition:transform .14s ease;
}
.disclose[open] .sumrow::after{transform:rotate(45deg);margin-bottom:9px}
.disclose[open] .sumrow .fl-count{color:var(--ink-3)}
.fl-count{
  font-family:var(--mono);font-size:10px;color:var(--ink-3);
  font-variant-numeric:tabular-nums;padding-bottom:2px;
}
.fl-collapsed{display:block;font-size:11.5px;color:var(--ink-4);margin-top:var(--sp-3)}
/* when the collapsed line carries a row rather than a sentence, it borrows the
   summary-line grammar: name at --ink-2, figure at --ink, tabular */
.fl-collapsed .nm{color:var(--ink-2)}
.fl-collapsed b{font-weight:600;color:var(--ink);margin-left:var(--sp-4);font-variant-numeric:tabular-nums}
.disclose[open] .fl-collapsed{display:none}
/* 28px, not 20px: at 20px the group eyebrow reads as a second eyebrow under
   the block heading rather than the head of its own group */
.fl-open{margin-top:var(--sp-6)}

/* ---- table grammar --------------------------------------------
   The column template is a per-table custom property so one row grammar serves
   both tables: Block D has four columns, Block C has five. */
.fl-table{display:block;--fl-cols:minmax(0,1fr) 78px 66px 66px}
.fl-table.is-campaigns{--fl-cols:minmax(0,1fr) 66px 66px 66px 66px}
.fl-thead,.fl-trow{
  display:grid;grid-template-columns:var(--fl-cols);gap:var(--sp-3);
  align-items:baseline;
}
.fl-thead{
  padding:0 0 9px;border-bottom:1px solid var(--line);
  font-family:var(--mono);font-size:9px;font-weight:500;letter-spacing:.14em;
  text-transform:uppercase;color:var(--ink-4);
}
.fl-trow{padding:11px 0;border-bottom:1px solid var(--line-soft)}
.fl-thead>span+span,.fl-trow>span+span{text-align:right;font-variant-numeric:tabular-nums}
.fl-trow .nm{font-weight:600;font-size:13px;color:var(--ink)}
.fl-trow>span+span{font-size:12.5px;color:var(--ink-2)}
.fl-trow .zero{color:var(--ink-4)}
.fl-trow .dash{color:var(--ink-4)}
.fl-group{margin-top:var(--sp-6)}
.fl-group:first-child{margin-top:0}
.fl-explain{font-size:11.5px;color:var(--ink-3);margin-top:var(--sp-2)}
.fl-group .fl-table{margin-top:var(--sp-4)}
/* `Showing 20 of 34 campaigns.` / `Showing 20 of 41.` — a statement to the
   reader, so sentence case in the body face, not a mono machine label */
.fl-bound{font-size:11.5px;color:var(--ink-4);margin-top:var(--sp-3)}

/* ---- the honesty note ------------------------------------------ */
.honesty{
  display:flex;gap:7px;align-items:flex-start;
  font-size:11.5px;color:var(--ink-4);margin-top:var(--sp-4);
}
.honesty svg{width:13px;height:13px;flex:none;margin-top:2px;display:block}

/* ---- Block E rows ---------------------------------------------- */
.fl-headrow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:end}
.fl-rows{margin-top:var(--sp-5)}
.fl-row{
  display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--sp-4);
  padding:14px 0;border-top:1px solid var(--line-soft);
}
/* both row lists on the page open the same way: no hairline above the first */
.fl-rows>.fl-row:first-child{border-top:0}
.fl-row .tag{align-self:start;justify-self:end}
.fl-biz{
  font-weight:600;font-size:13px;color:var(--ink);border-bottom:0;
  display:inline-flex;align-items:baseline;gap:6px;
}
.fl-biz:hover{color:var(--ink);border-bottom:0}
.fl-biz .arr{color:var(--ink-4);font-size:11px}
.pwhen{
  font-family:var(--mono);font-size:9.5px;color:var(--ink-4);
  font-variant-numeric:tabular-nums;margin-top:5px;
}
.pwhen.is-stale{color:var(--stale)}
.fl-snip{font-size:12.5px;color:var(--ink-2);margin-top:6px}
.fl-why{font-size:11.5px;color:var(--ink-4);margin-top:4px}

/* ---- failed block / failed page -------------------------------- */
.fl-fail{display:grid;grid-template-columns:5px minmax(0,1fr);gap:9px;margin-top:var(--sp-5)}
.fl-fail i{
  width:5px;height:5px;border-radius:50%;background:var(--missing);
  box-shadow:0 0 6px var(--missing);margin-top:7px;
}
.fl-fail .said{font-size:13px;color:var(--ink-2)}
.fl-fail .because{font-size:12.5px;color:var(--ink-3);margin-top:6px;max-width:62ch}

/* ---- Block F, the health strip --------------------------------- */
.fl-health{margin-top:var(--sp-8)}
.fl-health.quiet{
  border-top:1px solid var(--line);padding-top:var(--sp-4);
  display:flex;align-items:center;gap:var(--sp-4);
}
.fl-health.quiet .line{font-size:11px;color:var(--ink-3);font-variant-numeric:tabular-nums}
.fl-health.quiet .line i{font-style:normal;color:var(--ink-4);margin:0 5px}
/* the 30-hour rule: past everyHours + graceHours the stamp becomes a statement */
.fl-health.quiet .line .aged{color:var(--stale)}
.fl-health .btn{margin-left:auto;flex:none}
/* cards earn their borders, and a structural alarm is quieter and stronger
   than more colour */
.fl-health.alarm{
  background:var(--panel);border:1px solid var(--line);border-radius:var(--r-card);
  padding:var(--sp-4) 16px;
}
/* the marker is the system's dot, never ⚠ — a coloured emoji glyph has no
   place in a monochrome instrument panel */
.fl-warn{display:grid;grid-template-columns:5px minmax(0,1fr);gap:9px;padding:3px 0}
.fl-warn i{width:5px;height:5px;border-radius:50%;margin-top:7px}
.fl-warn.is-stale i{background:var(--stale);box-shadow:0 0 6px var(--stale)}
.fl-warn.is-missing i{background:var(--missing);box-shadow:0 0 6px var(--missing)}
.fl-warn span{font-size:12.5px;color:var(--ink)}
.fl-fine{margin-left:14px;font-size:11px;color:var(--ink-3);margin-top:var(--sp-3);font-variant-numeric:tabular-nums}
.fl-fine i{font-style:normal;color:var(--ink-4);margin:0 5px}
.fl-stamp{margin-left:14px;margin-top:var(--sp-2);display:flex;align-items:center;gap:var(--sp-4)}
.fl-stamp .line{font-size:11px;color:var(--ink-3);font-variant-numeric:tabular-nums}

/* ---- buttons, tags, status pill -------------------------------- */
.btn{
  display:inline-flex;align-items:center;gap:7px;cursor:pointer;
  font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;
  padding:8px 14px;border-radius:var(--r-pill);background:none;
  border:1px solid var(--line);color:var(--ink-2);
}
.btn:hover{border-color:var(--ink-4);color:var(--ink)}
.btn:disabled{opacity:.45;cursor:not-allowed;color:var(--ink-4)}
.btn:disabled:hover{border-color:var(--line);color:var(--ink-4)}
/* the affirmative pill — declared vocabulary; P8 uses none */
.btn.go{border-color:rgba(53,211,153,.4);color:#8AE9C6}
.btn.go:hover{background:rgba(53,211,153,.09);border-color:var(--save)}
.btn.ghost{border-color:transparent;color:var(--ink-3)}
.tag{
  display:inline-block;font-family:var(--mono);font-size:9px;letter-spacing:.13em;
  text-transform:uppercase;padding:5px 10px;border-radius:var(--r-tag);
  border:1px solid var(--line);color:var(--ink-3);
}
/* status pill — declared vocabulary only. P8's top bar carries no pill of any kind. */
.statuspill{
  display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:var(--r-pill);
  background:rgba(53,211,153,.08);border:1px solid rgba(53,211,153,.2);
  font-size:10.5px;color:#7FE3BE;
}
.statuspill i{width:5px;height:5px;border-radius:50%;background:var(--save);box-shadow:0 0 6px var(--save)}
```

- [ ] **Step 4: Create `src/styles/legacy.css`**

```css
/* ============================================================
   legacy.css — the old pages' bare selectors, re-skinned.

   THIS FILE HAS AN EXPIRY DATE. It exists so /queue, /settings and
   /login can be re-skinned without being rewritten: one treatment per
   selector, no className churn. It is DELETED in the phase where those
   pages get their own content discussion under S11 and are rebuilt on
   the components.css vocabulary. Do not add to it; do not let it
   outlive its reason.

   Ported from the `legacy` section of docs/design/p8-mockup.html, and
   it is where every rule from the deleted src/app/globals.css landed
   except one: the old `main` rule's env(safe-area-inset-*) padding is
   NOT carried over. That is a deliberate loss consistent with
   desktop-first, recorded in the spec's §6.2, and it comes back in the
   phone pass.

   Two named costs, so they are not discovered later as defects:
     * /queue's status filters lose their solid active state. Bare
       <button> carries three meanings there at once — affirmative,
       neutral, and the active segment of the filter row — and one
       element selector cannot be all three. The six filters now differ
       only by border and label brightness. That is the price of
       one-treatment-per-selector.
     * `main` widens from 640px to 920px. A visible layout change to
       /queue, forced by the shell.
   ============================================================ */
main{
  max-width:var(--content-max);margin:0 auto;
  padding:var(--sp-6) var(--sp-6) var(--sp-8);
}
h1{
  font-family:var(--display);font-weight:600;font-size:24px;letter-spacing:-.02em;
  color:var(--ink);margin:0;
}
/* the neutral-HIGH outline pill: Approve, Save, Enable, and the active filter */
button{
  font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;
  padding:8px 14px;border-radius:var(--r-pill);background:none;
  border:1px solid var(--ink-4);color:var(--ink);cursor:pointer;line-height:1.4;
}
button:hover{border-color:var(--ink-3)}
/* the same pill at resting emphasis: Edit, Cancel, inactive filters, Re-register */
button.secondary{border-color:var(--line);color:var(--ink-3);background:none}
button.secondary:hover{border-color:var(--ink-4);color:var(--ink-2)}
/* the same pill in red — never a solid fill */
button.danger{border-color:rgba(248,113,113,.4);color:#F5A5A5;background:none}
button.danger:hover{border-color:rgba(248,113,113,.6)}
button:disabled{opacity:.45;cursor:not-allowed}
.card{
  background:var(--raised);border:1px solid var(--line);border-radius:var(--r-card);
  padding:var(--sp-4);margin-bottom:var(--sp-4);
}
.badge{
  display:inline-block;font-family:var(--mono);font-size:9px;letter-spacing:.13em;
  text-transform:uppercase;border:1px solid var(--line);border-radius:var(--r-tag);
  padding:4px 8px;color:var(--ink-3);
}
.meta{font-size:10.5px;color:var(--ink-3)}
.row{display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap;margin-top:var(--sp-3)}
.error{color:var(--missing);font-size:12.5px}
/* pre.body keeps the BODY face deliberately. It holds a draft email to a
   business owner; rendering Riku's own outgoing message in JetBrains Mono
   would make him read it as machine output, in the one place he is
   checking tone. */
pre.body{
  white-space:pre-wrap;font-family:var(--body);font-size:12.5px;line-height:1.55;
  color:var(--ink-2);background:var(--sunk);border:1px solid var(--line-soft);
  border-radius:var(--r-chip);padding:10px 12px;margin:var(--sp-3) 0 0;
}
input,textarea{
  font-family:var(--body);font-size:13px;width:100%;padding:8px 10px;
  background:#101318;border:1px solid var(--line);border-radius:var(--r-chip);
  color:var(--ink);caret-color:var(--spend);
}
/* sentence case, not mono caps — a label addresses a person */
label{display:block;font-size:12px;color:var(--ink-3);margin-bottom:4px}
/* Chrome paints its own near-white autofill ground on the login field, and
   nothing else beats it. */
input:-webkit-autofill{
  -webkit-text-fill-color:var(--ink);
  -webkit-box-shadow:0 0 0 1000px #101318 inset;
  caret-color:var(--ink);
}
```

- [ ] **Step 5: Swap the imports in `src/app/layout.tsx` and delete `globals.css`**

In `src/app/layout.tsx`, replace this single line:

```tsx
import "./globals.css";
```

with:

```tsx
// The four stylesheets, imported side-effect style from the root layout ONLY,
// in this fixed order. CSS imported from different components can land in a
// non-deterministic order in the built stylesheet; importing everything here
// in sequence makes the cascade something you read in one file rather than
// discover in production. Relative paths, not "@/", so nothing depends on
// tsconfig path resolution inside a CSS import.
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/components.css";
import "../styles/legacy.css";
```

Then delete the old file:

```bash
git rm src/app/globals.css
```

Expected: `rm 'src/app/globals.css'`

- [ ] **Step 6: Verify nothing from `globals.css` was lost silently**

Every selector the deleted file carried now lives in `legacy.css` or `base.css`. Confirm the ported names are all present:

The four stylesheets are still untracked at this point, so these use plain `grep` — `git grep` searches tracked files only and would print nothing.

```bash
grep -c -E '^(main|h1|button|\.card|\.badge|\.meta|\.row|\.error|pre\.body|input,textarea|label)' src/styles/legacy.css
```

Expected: `17` — one line each for `main`, `h1`, `.card`, `.badge`, `.meta`, `.row`, `.error`, `pre.body`, `input,textarea` and `label`, plus the seven `button…` rules (`button`, `:hover`, `.secondary`, `.secondary:hover`, `.danger`, `.danger:hover`, `:disabled`).

And confirm `base.css` took the four rules that were not selector re-skins:

```bash
grep -c -E '^(\*|html,body|body|p|strong|a|:focus-visible|::selection)' src/styles/base.css
```

Expected: `9` (`*`, `html,body`, `body`, `p`, `strong`, `a`, `a:hover`, `:focus-visible`, `::selection`)

The only rule deliberately **not** carried over is the old `main` rule's `env(safe-area-inset-*)` padding, recorded in `legacy.css`'s header comment.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully` and no CSS resolution error.

- [ ] **Step 8: Commit**

```bash
git add src/styles src/app/layout.tsx
git commit -F - <<'EOF'
feat(p8a): the four stylesheets, and delete globals.css

tokens / base / components / legacy, ported from the first four sections
of docs/design/p8-mockup.html and imported from the root layout only, in
a fixed order, so the cascade is read in one file.

Five deliberate differences from the mockup, each commented in place:
.stat .marks dropped (Riku chose the plain hero row); .stat .sub gains a
two-line min-height so a wrapping caption cannot lift its bottom-anchored
figure; .app-content gains max-width:none so legacy's `main` rule cannot
apply a second column; .navitem gains border-bottom:0 because the app
draws nav items as anchors; and .app-body gains min-height:100vh (R33) so
the rail's ground reaches the bottom of the viewport on a short page.

globals.css is deleted and every rule it held is accounted for in
legacy.css or base.css. The one loss is the old `main` rule's
env(safe-area-inset-*) padding — deliberate, consistent with
desktop-first, and recorded in legacy.css's header.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

---

## Task 3: The brand tile becomes the app icon

**Files:**
- Modify: `src/app/icon.tsx`
- Modify: `src/app/apple-icon.tsx`

- [ ] **Step 1: Rewrite `src/app/icon.tsx`**

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/**
 * The rail's brand tile at icon scale: an orange gradient ground with the
 * sunburst glyph. Never a letterform — the product name may change and a
 * monogram would have to change with it.
 *
 * Exported FULL-BLEED: the 7px radius is specified at the rail's 24px tile;
 * at 512px it would be a hairline of a corner, and both iOS and Android mask
 * the icon themselves.
 *
 * ImageResponse renders through satori, whose SVG support is the historically
 * fragile part — a failure surfaces as a broken image rather than a compile
 * error, so look at the generated PNG after the first build.
 */
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
          background: "linear-gradient(150deg, #FF9E5C, #F2622B)",
        }}
      >
        <svg width="300" height="300" viewBox="0 0 24 24" fill="#2A1002">
          <path d="M12 1.6l1.7 6.1 4.5-4.4-2.4 6 6.1-1.7-5.4 3.3 5.4 3.3-6.1-1.7 2.4 6-4.5-4.4L12 22.4l-1.7-6.1-4.5 4.4 2.4-6-6.1 1.7 5.4-3.3-5.4-3.3 6.1 1.7-2.4-6 4.5 4.4z" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 2: Rewrite `src/app/apple-icon.tsx`**

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The same brand tile at the iOS home-screen size. Full-bleed; iOS masks it. */
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
          background: "linear-gradient(150deg, #FF9E5C, #F2622B)",
        }}
      >
        <svg width="106" height="106" viewBox="0 0 24 24" fill="#2A1002">
          <path d="M12 1.6l1.7 6.1 4.5-4.4-2.4 6 6.1-1.7-5.4 3.3 5.4 3.3-6.1-1.7 2.4 6-4.5-4.4L12 22.4l-1.7-6.1-4.5 4.4 2.4-6-6.1 1.7 5.4-3.3-5.4-3.3 6.1 1.7-2.4-6 4.5 4.4z" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 3: Build and look at the PNG**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

Run: `npm run dev` in one terminal, then open `http://localhost:3000/icon` in a browser.
Expected: an orange gradient square with a dark eight-point sunburst centred in it. **Not** a blank orange square, and **not** a broken-image glyph. If the glyph is missing, satori failed on the path — that is the fragile part the comment warns about. Stop the dev server with Ctrl-C when done.

- [ ] **Step 4: Commit**

```bash
git add src/app/icon.tsx src/app/apple-icon.tsx
git commit -F - <<'EOF'
feat(p8a): the brand tile becomes the app icon

An orange gradient ground with the sunburst glyph, never a letterform —
the product name may change and a monogram would have to change with it.
Exported full-bleed: the 7px radius belongs to the rail's 24px tile, and
both platforms mask the icon themselves.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

---

## Task 4: The icon set

**Files:**
- Create: `src/components/icons.tsx`

- [ ] **Step 1: Create `src/components/icons.tsx`**

```tsx
/**
 * Hand-drawn stroke glyphs, ported from docs/design/p8-mockup.html.
 *
 * Named exports, no registry: they tree-shake, they are typo-proof under
 * `strict`, and one grep finds every use of a glyph. No "use client" — these
 * are plain server-renderable SVG. No dangerouslySetInnerHTML anywhere.
 *
 * Where the design uses a text glyph (the `↗` on a link, the disclosure
 * chevron) use the literal character or the CSS box, not a component.
 */

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function IconQueue() {
  return (
    <svg {...stroke}>
      <path d="M5.5 4.5h13l2.5 8.5v5a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 18v-5z" />
      <path d="M3 13h5l1.5 3h5l1.5-3h5" />
    </svg>
  );
}

export function IconFreelance() {
  return (
    <svg {...stroke}>
      <path d="M3 8.5h18v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />
      <path d="M9 8.5V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

export function IconSettings() {
  return (
    <svg {...stroke}>
      <path d="M4 7.5h8.5" />
      <circle cx="15.5" cy="7.5" r="2.4" />
      <path d="M18.5 7.5H20" />
      <path d="M4 16.5h3.5" />
      <circle cx="10.5" cy="16.5" r="2.4" />
      <path d="M13.5 16.5H20" />
    </svg>
  );
}

/** The 13px info glyph in the `.honesty` note register. Consumed by Plan C. */
export function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5M12 8h.01" />
    </svg>
  );
}

/**
 * The brand sunburst, and the one filled glyph in the set: it sits on the
 * orange gradient tile, so it is painted rather than stroked. The fill is the
 * tile's own dark orange rather than currentColor, exactly as the mockup
 * draws it.
 */
export function IconMark() {
  return (
    <svg viewBox="0 0 24 24" fill="#2A1002" aria-hidden="true">
      <path d="M12 1.6l1.7 6.1 4.5-4.4-2.4 6 6.1-1.7-5.4 3.3 5.4 3.3-6.1-1.7 2.4 6-4.5-4.4L12 22.4l-1.7-6.1-4.5 4.4 2.4-6-6.1 1.7 5.4-3.3-5.4-3.3 6.1 1.7-2.4-6 4.5 4.4z" />
    </svg>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. (If `aria-hidden: true` in the spread object errors, change it to `"aria-hidden": "true"` — React accepts the string form on every element.)

- [ ] **Step 3: Commit**

```bash
git add src/components/icons.tsx
git commit -F - <<'EOF'
feat(p8a): the icon set as named SVG components

IconQueue, IconFreelance, IconSettings, IconInfo and IconMark, ported
from the mockup. Named exports so they tree-shake and one grep finds
every use of a glyph. No registry, no dangerouslySetInnerHTML, no icon
package.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

---

## Task 5: Extract `classifyAgentRun` — refactor, proved by an unchanged test file

The rail needs one row per agent **including the healthy ones**. `evaluateWatchdog` returns *anomalies*, where an empty array means healthy — a different type with a different totality guarantee. Making one function serve both would either hand the digest `ok` rows it must filter, or make the rail infer "healthy" from *absence*, which would paint an agent missing from the table green. So the per-agent judgement both want is extracted, and `evaluateWatchdog` becomes a switch over it.

**`src/lib/__tests__/watchdog.test.ts` must not be edited. Not one character. It is this task's proof.**

**Files:**
- Modify: `src/lib/watchdog.ts`
- Test (unchanged): `src/lib/__tests__/watchdog.test.ts`

- [ ] **Step 1: Record the baseline — the suite is green before the refactor**

Run: `npx vitest run src/lib/__tests__/watchdog.test.ts`
Expected: `Test Files  1 passed (1)` and `Tests  9 passed (9)`.

- [ ] **Step 2: Record the file's hash, so the "unchanged" claim is checkable**

Run: `git hash-object src/lib/__tests__/watchdog.test.ts`
Expected: a 40-character hash. Write it down; Step 5 compares against it.

- [ ] **Step 3: Replace `evaluateWatchdog` in `src/lib/watchdog.ts` with the extraction**

In `src/lib/watchdog.ts`, replace everything from the `/**` comment above `evaluateWatchdog` through its closing `}` (currently lines 61–120) with:

```ts
/**
 * The per-agent judgement, pure and shared by two consumers with different
 * needs: the watchdog digest (which wants only the anomalies) and the rail's
 * agents block (which wants a row for every agent, healthy ones included).
 *
 * Order is most-fundamental first and must not be rearranged: an agent that
 * never ran cannot also be stale, and a stale run's `ok` flag describes a run
 * from BEFORE the outage, so reporting `failed` would point at the wrong
 * problem. The rail must not disagree with the digest about the same agent,
 * which is why there is one function rather than two.
 */
export type AgentVerdict =
  | { kind: "never" }
  | { kind: "stale"; ageHours: number }
  | { kind: "failed" }
  | { kind: "degraded"; itemsFailed: number }
  | { kind: "ok"; ageHours: number };

export function classifyAgentRun(
  now: Date,
  run: LatestRun | undefined,
  exp: Expectation
): AgentVerdict {
  if (!run) return { kind: "never" };

  const ageMs = now.getTime() - run.startedAt.getTime();
  const ageHours = Math.floor(ageMs / HOUR_MS);
  const limitMs = (exp.everyHours + exp.graceHours) * HOUR_MS;

  if (ageMs > limitMs) return { kind: "stale", ageHours };
  if (!run.ok) return { kind: "failed" };
  if (run.itemsFailed > 0) return { kind: "degraded", itemsFailed: run.itemsFailed };
  return { kind: "ok", ageHours };
}

/**
 * Pure. At most one anomaly per agent, in classifyAgentRun's order.
 *
 * A switched-off agent is NOT an anomaly and needs no special case here: a
 * disabled agent still writes a run record every day, so it is never stale.
 * The digest reports the "off" status separately, read from OsSettings.
 */
export function evaluateWatchdog(
  now: Date,
  latest: LatestRun[],
  expectations: Expectation[] = EXPECTATIONS
): Anomaly[] {
  const byAgent = new Map(latest.map((run) => [run.agent, run]));
  const anomalies: Anomaly[] = [];

  for (const expectation of expectations) {
    const agent = expectation.agent;
    const verdict = classifyAgentRun(now, byAgent.get(agent), expectation);

    switch (verdict.kind) {
      case "never":
        anomalies.push({ agent, kind: "never-ran", detail: `${agent} has never run` });
        break;
      case "stale":
        anomalies.push({
          agent,
          kind: "stale",
          detail: `${agent} last ran ${verdict.ageHours}h ago`,
        });
        break;
      case "failed":
        anomalies.push({ agent, kind: "failed", detail: `${agent} failed` });
        break;
      case "degraded":
        anomalies.push({
          agent,
          kind: "degraded",
          detail: `${agent}: ${verdict.itemsFailed} item${verdict.itemsFailed === 1 ? "" : "s"} failed`,
        });
        break;
      case "ok":
        break;
    }
  }

  return anomalies;
}
```

- [ ] **Step 4: Run the unchanged suite — this is the refactor's proof**

Run: `npx vitest run src/lib/__tests__/watchdog.test.ts`
Expected: `Test Files  1 passed (1)` and `Tests  9 passed (9)` — the same nine, including `does not expect itself to have run`, which pins that `watchdog` is deliberately absent from `EXPECTATIONS`.

Run: `npm test`
Expected: every suite passes; the totals match whatever the repo produced before this task.

- [ ] **Step 5: Prove the test file was not touched**

Run: `git hash-object src/lib/__tests__/watchdog.test.ts`
Expected: **exactly the hash recorded in Step 2.**

Run: `git status --porcelain src/lib/__tests__/watchdog.test.ts`
Expected: no output.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/watchdog.ts
git commit -F - <<'EOF'
refactor(p8a): extract classifyAgentRun from evaluateWatchdog

The rail needs one row per agent including the healthy ones;
evaluateWatchdog returns anomalies, where empty means healthy. Widening
it would either hand the digest ok rows it must filter or make the rail
infer health from absence, which would paint an agent missing from the
table green. So the per-agent judgement both consumers want is extracted
and evaluateWatchdog becomes a switch over it.

Behaviour is unchanged, and watchdog.test.ts passing byte-for-byte
unchanged is the proof.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

---

## Task 6: `RAIL_AGENTS`, `AGENT_STALE_HOURS` and `deriveAgentStatuses`

Real TDD: the test file is written first and must fail on missing exports before anything is implemented.

**Files:**
- Test: `src/lib/__tests__/agentStatus.test.ts` (create)
- Modify: `src/lib/watchdog.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/agentStatus.test.ts`:

```ts
/**
 * Pins the rail's six badges. Pure — no database, no clock of its own.
 *
 * The two things most likely to be broken by a later "tidy-up" are pinned
 * hardest: that `off` comes from the OsSettings switches and NEVER from a run
 * record (runJob writes an ok:true placeholder for a switched-off agent, with
 * the reason in a prose note string that must never be parsed), and that the
 * result is total — one row per expectation, in order, never more, never fewer.
 */

import { describe, it, expect } from "vitest";
import {
  AGENT_STALE_HOURS,
  EXPECTATIONS,
  RAIL_AGENTS,
  deriveAgentStatuses,
} from "@/lib/watchdog";
import type { AgentStatus, AgentSwitches, LatestRun } from "@/lib/watchdog";

const NOW = new Date("2026-08-30T00:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * HOUR_MS);
}

const ALL_ON: AgentSwitches = { chaserEnabled: true, monitoringEnabled: true };

/** A healthy, recent run for every agent the rail shows. */
function healthyRuns(): LatestRun[] {
  return RAIL_AGENTS.map((e) => ({
    agent: e.agent,
    startedAt: hoursAgo(1),
    ok: true,
    itemsFailed: 0,
  }));
}

function rowFor(rows: AgentStatus[], agent: string): AgentStatus {
  const row = rows.find((r) => r.agent === agent);
  if (!row) throw new Error(`no row for ${agent}`);
  return row;
}

describe("RAIL_AGENTS", () => {
  it("lists six agents in execution order", () => {
    expect(RAIL_AGENTS.map((e) => e.agent)).toEqual([
      "chaser",
      "expiry-sweep",
      "watchdog",
      "site-health",
      "outreach-health",
      "dispatcher",
    ]);
  });

  it("includes watchdog, which EXPECTATIONS deliberately omits", () => {
    expect(RAIL_AGENTS.some((e) => e.agent === "watchdog")).toBe(true);
    expect(EXPECTATIONS.some((e) => e.agent === "watchdog")).toBe(false);
  });

  it("carries no agent that does not exist", () => {
    const names = RAIL_AGENTS.map((e) => e.agent);
    expect(names).not.toContain("lead-sweep");
    expect(names).not.toContain("triage");
    expect(names).not.toContain("retro");
  });

  it("agrees with the exported staleness threshold", () => {
    for (const e of RAIL_AGENTS) {
      expect(e.everyHours + e.graceHours).toBe(AGENT_STALE_HOURS);
    }
  });
});

describe("deriveAgentStatuses", () => {
  it("returns one row per expectation, in order, and nothing else", () => {
    const rows = deriveAgentStatuses(NOW, healthyRuns(), ALL_ON, RAIL_AGENTS);
    expect(rows).toHaveLength(RAIL_AGENTS.length);
    expect(rows.map((r) => r.agent)).toEqual(RAIL_AGENTS.map((e) => e.agent));
  });

  it("ignores a run for an agent outside the expectations it was given", () => {
    const runs: LatestRun[] = [
      ...healthyRuns(),
      { agent: "retro", startedAt: hoursAgo(500), ok: false, itemsFailed: 9 },
    ];
    const rows = deriveAgentStatuses(NOW, runs, ALL_ON, RAIL_AGENTS);
    expect(rows).toHaveLength(RAIL_AGENTS.length);
    expect(rows.some((r) => r.agent === "retro")).toBe(false);
  });

  it("gives a healthy agent the ok state and NO caption — the hue is the whole message", () => {
    const rows = deriveAgentStatuses(NOW, healthyRuns(), ALL_ON, RAIL_AGENTS);
    for (const row of rows) {
      expect(row.state).toBe("ok");
      expect(row.caption).toBeNull();
    }
  });

  it("reports an agent with no run record as never run", () => {
    const runs = healthyRuns().filter((r) => r.agent !== "dispatcher");
    const row = rowFor(deriveAgentStatuses(NOW, runs, ALL_ON, RAIL_AGENTS), "dispatcher");
    expect(row.state).toBe("never");
    expect(row.caption).toBe("never run");
  });

  it("reports a failed run as failed", () => {
    const runs = healthyRuns().map((r) =>
      r.agent === "dispatcher" ? { ...r, ok: false } : r
    );
    const row = rowFor(deriveAgentStatuses(NOW, runs, ALL_ON, RAIL_AGENTS), "dispatcher");
    expect(row.state).toBe("failed");
    expect(row.caption).toBe("failed");
  });

  it("reports itemsFailed > 0 as failed, and counts the items in the caption", () => {
    const runs = healthyRuns().map((r) =>
      r.agent === "chaser" ? { ...r, itemsFailed: 2 } : r
    );
    const row = rowFor(deriveAgentStatuses(NOW, runs, ALL_ON, RAIL_AGENTS), "chaser");
    expect(row.state).toBe("failed");
    expect(row.caption).toBe("2 items failed");
  });

  it("makes the items-failed caption singular at one", () => {
    const runs = healthyRuns().map((r) =>
      r.agent === "chaser" ? { ...r, itemsFailed: 1 } : r
    );
    expect(rowFor(deriveAgentStatuses(NOW, runs, ALL_ON, RAIL_AGENTS), "chaser").caption).toBe(
      "1 item failed"
    );
  });

  it("is not overdue exactly at AGENT_STALE_HOURS, and is one millisecond later", () => {
    const atLimit = healthyRuns().map((r) =>
      r.agent === "chaser"
        ? { ...r, startedAt: new Date(NOW.getTime() - AGENT_STALE_HOURS * HOUR_MS) }
        : r
    );
    expect(rowFor(deriveAgentStatuses(NOW, atLimit, ALL_ON, RAIL_AGENTS), "chaser").state).toBe(
      "ok"
    );

    const pastLimit = healthyRuns().map((r) =>
      r.agent === "chaser"
        ? { ...r, startedAt: new Date(NOW.getTime() - AGENT_STALE_HOURS * HOUR_MS - 1) }
        : r
    );
    expect(rowFor(deriveAgentStatuses(NOW, pastLimit, ALL_ON, RAIL_AGENTS), "chaser").state).toBe(
      "overdue"
    );
  });

  it("captions an overdue agent with its age in whole hours", () => {
    const runs = healthyRuns().map((r) =>
      r.agent === "outreach-health" ? { ...r, startedAt: hoursAgo(41) } : r
    );
    const row = rowFor(deriveAgentStatuses(NOW, runs, ALL_ON, RAIL_AGENTS), "outreach-health");
    expect(row.state).toBe("overdue");
    expect(row.caption).toBe("last ran 41h ago");
  });

  it("reports overdue rather than failed when a run is both", () => {
    const runs = healthyRuns().map((r) =>
      r.agent === "chaser" ? { ...r, startedAt: hoursAgo(40), ok: false } : r
    );
    expect(rowFor(deriveAgentStatuses(NOW, runs, ALL_ON, RAIL_AGENTS), "chaser").state).toBe(
      "overdue"
    );
  });

  it("takes off from the chaser switch, never from a healthy-looking run record", () => {
    // runJob writes an ok:true placeholder run for a switched-off agent. A
    // derivation reading only run records would paint this chaser green.
    const rows = deriveAgentStatuses(
      NOW,
      healthyRuns(),
      { chaserEnabled: false, monitoringEnabled: true },
      RAIL_AGENTS
    );
    const chaser = rowFor(rows, "chaser");
    expect(chaser.state).toBe("off");
    expect(chaser.caption).toBe("off");
    expect(rowFor(rows, "dispatcher").state).toBe("ok");
  });

  it("switches the four monitoring agents off together, and leaves the chaser alone", () => {
    const rows = deriveAgentStatuses(
      NOW,
      healthyRuns(),
      { chaserEnabled: true, monitoringEnabled: false },
      RAIL_AGENTS
    );
    for (const agent of ["watchdog", "site-health", "outreach-health", "dispatcher"]) {
      expect(rowFor(rows, agent).state).toBe("off");
    }
    expect(rowFor(rows, "chaser").state).toBe("ok");
  });

  it("never switches expiry-sweep off, whatever the switches say", () => {
    const rows = deriveAgentStatuses(
      NOW,
      healthyRuns(),
      { chaserEnabled: false, monitoringEnabled: false },
      RAIL_AGENTS
    );
    expect(rowFor(rows, "expiry-sweep").state).toBe("ok");
  });

  it("puts off ahead of never run, overdue and failed", () => {
    const runs = healthyRuns()
      .filter((r) => r.agent !== "dispatcher")
      .map((r) => (r.agent === "site-health" ? { ...r, startedAt: hoursAgo(99), ok: false } : r));
    const rows = deriveAgentStatuses(
      NOW,
      runs,
      { chaserEnabled: true, monitoringEnabled: false },
      RAIL_AGENTS
    );
    expect(rowFor(rows, "dispatcher").state).toBe("off"); // no run record at all
    expect(rowFor(rows, "site-health").state).toBe("off"); // stale AND failed
  });

  it("never reports unknown — that state belongs to the component's catch block", () => {
    const rows = deriveAgentStatuses(NOW, [], { chaserEnabled: false, monitoringEnabled: false }, RAIL_AGENTS);
    for (const row of rows) {
      expect(["off", "never", "failed", "overdue", "ok"]).toContain(row.state);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/agentStatus.test.ts`
Expected: FAIL. The failure is a module resolution / import error naming `AGENT_STALE_HOURS`, `RAIL_AGENTS` or `deriveAgentStatuses` as not exported from `@/lib/watchdog`.

- [ ] **Step 3: Implement in `src/lib/watchdog.ts`**

Append to the end of `src/lib/watchdog.ts` (after `fetchLatestRuns`):

```ts
/**
 * The staleness threshold, exported ONCE and read by both consumers: the
 * rail's overdue rule and the Freelance page's 30-hour site-snapshot rule.
 * It is `everyHours + graceHours`, the same 24 + 6 every expectation row
 * already carries. Two hardcoded 30s in two files is how they drift apart.
 */
export const AGENT_STALE_HOURS = 30;

/**
 * The six agents the rail shows, in execution order.
 *
 * A hand-written superset of EXPECTATIONS, and it must stay hand-written for
 * two separate reasons. The AGENTS enum in models/AgentRun.ts contains
 * lead-sweep, triage and retro — three agents that do not exist, so a rail
 * built from it would show three permanent ghosts. And EXPECTATIONS
 * deliberately omits `watchdog`: it is running, which is the proof — an
 * absence this file's header documents and watchdog.test.ts pins. So the rail
 * gets its own list and EXPECTATIONS is not touched.
 */
export const RAIL_AGENTS: Expectation[] = [
  { agent: "chaser", everyHours: 24, graceHours: 6 },
  { agent: "expiry-sweep", everyHours: 24, graceHours: 6 },
  { agent: "watchdog", everyHours: 24, graceHours: 6 },
  { agent: "site-health", everyHours: 24, graceHours: 6 },
  { agent: "outreach-health", everyHours: 24, graceHours: 6 },
  { agent: "dispatcher", everyHours: 24, graceHours: 6 },
];

export type AgentBadgeState = "off" | "never" | "failed" | "overdue" | "ok";

export interface AgentSwitches {
  chaserEnabled: boolean;
  monitoringEnabled: boolean;
}

export interface AgentStatus {
  agent: Agent;
  state: AgentBadgeState;
  /** Mono micro-caption under the badge. null on `ok` — the hue is the message. */
  caption: string | null;
}

/** The four agents the monitoring switch governs. expiry-sweep is not one of them. */
const MONITORING_AGENTS = new Set<Agent>([
  "watchdog",
  "site-health",
  "outreach-health",
  "dispatcher",
]);

function isSwitchedOff(agent: Agent, switches: AgentSwitches): boolean {
  // expiry-sweep is never off: it is the safety net that expires stale
  // ApprovalItems, and it has no switch.
  if (agent === "expiry-sweep") return false;
  if (agent === "chaser") return !switches.chaserEnabled;
  if (MONITORING_AGENTS.has(agent)) return !switches.monitoringEnabled;
  return false;
}

/**
 * Total by construction: one row per expectation, in the given order, never
 * more, never fewer. Pure — no database, no clock of its own.
 *
 * The switches are an ARGUMENT and are never sniffed from a run record.
 * runJob writes an ok:true placeholder run for a switched-off agent with the
 * reason in the run's note string, so a derivation reading only run records
 * would paint a switched-off chaser green. The note string is prose and must
 * never be parsed.
 *
 * Precedence: off -> never run -> overdue -> failed -> ok. `off` is checked
 * ahead of everything; the rest is classifyAgentRun's own order, which the
 * digest already uses, so the rail can never disagree with the digest about
 * the same agent.
 *
 * It never returns "unknown". That state is what the component's catch block
 * renders when the database read throws — the derivation never sees a
 * failure, so it can never report one.
 */
export function deriveAgentStatuses(
  now: Date,
  latest: LatestRun[],
  switches: AgentSwitches,
  expectations: Expectation[]
): AgentStatus[] {
  const byAgent = new Map(latest.map((run) => [run.agent, run]));

  return expectations.map((expectation) => {
    const agent = expectation.agent;

    if (isSwitchedOff(agent, switches)) {
      return { agent, state: "off", caption: "off" };
    }

    const verdict = classifyAgentRun(now, byAgent.get(agent), expectation);
    switch (verdict.kind) {
      case "never":
        return { agent, state: "never", caption: "never run" };
      case "stale":
        return { agent, state: "overdue", caption: `last ran ${verdict.ageHours}h ago` };
      case "failed":
        return { agent, state: "failed", caption: "failed" };
      case "degraded":
        return {
          agent,
          state: "failed",
          caption: `${verdict.itemsFailed} item${verdict.itemsFailed === 1 ? "" : "s"} failed`,
        };
      case "ok":
        return { agent, state: "ok", caption: null };
    }
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/agentStatus.test.ts`
Expected: `Test Files  1 passed (1)` and `Tests  19 passed (19)`.

Run: `npx vitest run src/lib/__tests__/watchdog.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  9 passed (9)` — still untouched, still green.

Run: `npm test`
Expected: every suite passes.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/watchdog.ts src/lib/__tests__/agentStatus.test.ts
git commit -F - <<'EOF'
feat(p8a): derive the rail's six agent badge states

RAIL_AGENTS is a hand-written six-row superset of EXPECTATIONS: the
AGENTS enum carries three agents that do not exist, and EXPECTATIONS
deliberately omits watchdog. AGENT_STALE_HOURS is exported once so the
rail's overdue rule and the Freelance page's site-snapshot rule cannot
drift apart.

deriveAgentStatuses is total by construction — one row per expectation,
in order — and takes the OsSettings switches as an argument. It never
sniffs a run's note string, because runJob writes an ok:true placeholder
for a switched-off agent and a run-records-only derivation would paint a
switched-off chaser green. It never returns "unknown": that belongs to
the component's catch block.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

---

## Task 7: The route group

A route group changes no URL, so `/queue` and `/settings` keep working and `src/proxy.ts` is untouched. **Moving a folder is not a TSX edit**, and the relative `./PushControls` import moves with it.

**Files:**
- Move: `src/app/queue/` → `src/app/(app)/queue/`
- Move: `src/app/settings/` → `src/app/(app)/settings/`

- [ ] **Step 1: Move both folders**

```bash
mkdir -p "src/app/(app)"
git mv src/app/queue "src/app/(app)/queue"
git mv src/app/settings "src/app/(app)/settings"
```

Expected: no output.

- [ ] **Step 2: Confirm the move was recorded as renames and nothing was edited**

Run: `git status --porcelain`
Expected: three `R ` (rename) lines and nothing else:

```
R  src/app/queue/PushControls.tsx -> src/app/(app)/queue/PushControls.tsx
R  src/app/queue/page.tsx -> src/app/(app)/queue/page.tsx
R  src/app/settings/page.tsx -> src/app/(app)/settings/page.tsx
```

(Three renames, in whatever order git prints them. If any line starts with `M`, a file was edited — undo it.)

Run: `git diff --cached -M --stat`
Expected: `0 insertions(+), 0 deletions(-)` on every renamed file.

- [ ] **Step 3: Build and confirm the URLs did not move**

Run: `npm run build`
Expected: `✓ Compiled successfully`, and the route table still lists `/queue` and `/settings` (not `/(app)/queue`).

- [ ] **Step 4: Commit**

```bash
git commit -F - <<'EOF'
refactor(p8a): move queue and settings into the (app) route group

A route group changes no URL, so /queue and /settings keep working and
src/proxy.ts — the app's authorization boundary — is untouched. The
relative ./PushControls import moves with the folder. Contents are
byte-for-byte unchanged: this is a rename, not an edit.

Adding /personal later becomes mkdir plus one entry in the nav array.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

---

## Task 8: The shell's leaf components

**Files:**
- Create: `src/app/(app)/_shell/TopBar.tsx`
- Create: `src/app/(app)/_shell/LogoutButton.tsx`
- Create: `src/app/(app)/_shell/NavList.tsx`

`_shell` has a leading underscore so Next excludes it from routing.

- [ ] **Step 1: Create `src/app/(app)/_shell/TopBar.tsx`**

```tsx
/**
 * 44px, one hairline bottom, and exactly one element: the freshness stamp.
 *
 * No breadcrumb — `Operator` named nobody in a system with exactly one user
 * and was the bar's brightest element, and the crumb's page name restated the
 * page title 70px below it. No pill of any kind: not ShikksTracker
 * reachability (it claims a liveness true only at the instant of render), not
 * push registration (client-only, and it duplicates a control already on the
 * queue page), not a pending-approvals count (two "waiting on you" numbers
 * from two systems on one screen). No search, no bell, no theme toggle.
 *
 * Asia/Manila is load-bearing: a server render on Vercel is UTC and would be
 * eight hours wrong. en-GB is named explicitly because en-US with hour12:false
 * can produce a 24:xx hour at midnight.
 *
 * The stamp is request-time rather than build-time because the (app) layout
 * reads cookies(), which opts this whole route subtree into dynamic
 * rendering. If that session check is ever removed, this stamp freezes at
 * build time — they are connected.
 */
const STAMP = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Manila",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default function TopBar() {
  return (
    <div className="topbar">
      <div className="topbar-in">
        <span className="crumb">
          <em>read {STAMP.format(new Date())}</em>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(app)/_shell/LogoutButton.tsx`**

```tsx
"use client";

/**
 * The app's only sign-out control, moved here from /queue's deleted inline
 * header. Styled by `.app-side .btn.ghost` at --ink-3 rather than --ink-4 —
 * it must be legible.
 */
export default function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <button type="button" className="btn ghost" onClick={() => void logout()}>
      Log out
    </button>
  );
}
```

- [ ] **Step 3: Create `src/app/(app)/_shell/NavList.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconQueue, IconFreelance, IconSettings } from "@/components/icons";

/**
 * The shell's only client island: usePathname() is client-only, and this is
 * the smallest correct way to mark the active item — no state, no effects, no
 * data. src/proxy.ts could forward the pathname as a header instead and is
 * deliberately NOT touched: it is the app's authorization boundary and must
 * stay boring. Editing a fail-closed security file to save a kilobyte of
 * hydration is a bad trade.
 *
 * Adding /personal later is one entry in this array.
 *
 * All three items carry a glyph. Never a mix.
 */
const NAV = [
  { href: "/queue", label: "Queue", Icon: IconQueue },
  { href: "/freelance", label: "Freelance", Icon: IconFreelance },
  { href: "/settings", label: "Settings", Icon: IconSettings },
] as const;

export default function NavList() {
  const pathname = usePathname();

  return (
    <nav className="app-nav">
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className={active ? "navitem is-active" : "navitem"}>
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/_shell"
git commit -F - <<'EOF'
feat(p8a): the shell's top bar, nav island and sign-out control

The top bar carries the freshness stamp and nothing else, formatted in
Asia/Manila because a server render on Vercel is UTC and would be eight
hours wrong.

NavList is the shell's only client island — usePathname() is client-only
and this is the smallest correct way to mark the active item. src/proxy.ts
is deliberately not touched to avoid it.

LogoutButton is where /queue's logout() behaviour moves to.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

---

## Task 9: The agents block

**Files:**
- Create: `src/app/(app)/_shell/AgentsBlock.tsx`

- [ ] **Step 1: Create `src/app/(app)/_shell/AgentsBlock.tsx`**

```tsx
import { connectDB } from "@/lib/db";
import { getOsSettings } from "@/lib/osSettings";
import { RAIL_AGENTS, deriveAgentStatuses, fetchLatestRuns } from "@/lib/watchdog";
import type { AgentBadgeState, AgentStatus } from "@/lib/watchdog";

/**
 * Six badges in fixed execution order, read from the last run record per agent
 * plus the two switches in OsSettings.
 *
 * Captions appear on grey, amber and red. Green carries none — the hue is the
 * whole message. No click, no hover, no title tooltip.
 *
 * No polling, no unstable_cache, no revalidate tag: these agents run once a
 * day. On a soft <Link> navigation inside (app) this layout sits above the
 * changed segment and is reused from the client router cache, so the badges
 * can go stale during a long session. That is fine and is not to be "fixed".
 */
const BADGE_CLASS: Record<AgentBadgeState, string> = {
  off: "agent is-grey",
  never: "agent is-grey",
  overdue: "agent is-overdue",
  failed: "agent is-failed",
  ok: "agent is-ok",
};

function Badges({ statuses }: { statuses: AgentStatus[] }) {
  return (
    <div className="agents">
      {statuses.map((status) => (
        <span key={status.agent}>
          <span className={BADGE_CLASS[status.state]}>{status.agent}</span>
          {status.caption !== null && <span className="agent-cap">{status.caption}</span>}
        </span>
      ))}
    </div>
  );
}

/** What Suspense shows while the read is in flight: the structure, no claims. */
export function AgentsSkeleton() {
  return (
    <div className="agents">
      {RAIL_AGENTS.map((expectation) => (
        <span key={expectation.agent}>
          <span className="agent is-grey">{expectation.agent}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * `unknown` — six grey badges captioned with an em-dash — is produced HERE and
 * never by deriveAgentStatuses. The pure function never sees a failure, so it
 * can never report one.
 *
 * The settings read sits inside the SAME try/catch as the run records, or a
 * settings failure would grey the badges for the wrong reason.
 */
export default async function AgentsBlock() {
  let statuses: AgentStatus[];

  try {
    await connectDB();
    const [latest, settings] = await Promise.all([
      fetchLatestRuns(RAIL_AGENTS.map((expectation) => expectation.agent)),
      getOsSettings(),
    ]);
    statuses = deriveAgentStatuses(
      new Date(),
      latest,
      {
        chaserEnabled: settings.chaserEnabled,
        monitoringEnabled: settings.monitoringEnabled,
      },
      RAIL_AGENTS
    );
  } catch {
    return (
      <div className="agents">
        {RAIL_AGENTS.map((expectation) => (
          <span key={expectation.agent}>
            <span className="agent is-grey">{expectation.agent}</span>
            <span className="agent-cap">—</span>
          </span>
        ))}
      </div>
    );
  }

  return <Badges statuses={statuses} />;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/_shell/AgentsBlock.tsx"
git commit -F - <<'EOF'
feat(p8a): the rail's agents block, read from run records and switches

fetchLatestRuns over RAIL_AGENTS plus getOsSettings, in one try/catch —
a settings failure must not grey the badges for the wrong reason. The
catch renders six grey em-dash badges: `unknown` is produced here and
never by the pure derivation, which never sees a failure.

No polling and no cache tag. These agents run once a day, and badges
going stale during a long soft-navigated session is fine.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

---

## Task 10: The shell layout

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/_shell/Rail.tsx`

- [ ] **Step 1: Create `src/app/(app)/_shell/Rail.tsx`**

```tsx
import { Suspense } from "react";
import { APP_NAME } from "@/lib/constants";
import { IconMark } from "@/components/icons";
import NavList from "./NavList";
import AgentsBlock, { AgentsSkeleton } from "./AgentsBlock";
import LogoutButton from "./LogoutButton";

/**
 * 170px. Brand tile, wordmark, three nav items, the AGENTS group, and Log out
 * pushed down with margin-top:auto.
 *
 * The brand tile holds the sunburst glyph and NEVER a letterform: the product
 * name may change and a monogram would have to change with it. The wordmark
 * comes from APP_NAME for the same reason.
 *
 * Suspense keeps the agents read off the critical path so the shell and page
 * paint immediately; the try/catch inside AgentsBlock is the actual safety,
 * because an uncaught throw in an async server component bubbles to the
 * nearest error boundary and can blank the route. Both halves are required.
 */
export default function Rail() {
  return (
    <aside className="app-side">
      <div className="app-brand">
        <span className="tile">
          <IconMark />
        </span>
        <span className="wm">{APP_NAME}</span>
      </div>

      <NavList />

      <div>
        <span className="grouplabel">Agents</span>
        <Suspense fallback={<AgentsSkeleton />}>
          <AgentsBlock />
        </Suspense>
      </div>

      <div className="rail-foot">
        <LogoutButton />
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create `src/app/(app)/layout.tsx`**

```tsx
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
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run build`
Expected: `✓ Compiled successfully`. `/queue` and `/settings` are now listed as dynamic (`ƒ`) rather than static, because the layout reads `cookies()`. That is intended.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/layout.tsx" "src/app/(app)/_shell/Rail.tsx"
git commit -F - <<'EOF'
feat(p8a): the app shell — rail and top bar above every signed-in page

One server-rendered layout over the (app) group. It renders no <main>:
queue, settings and login each render their own, and two <main> elements
in one document is invalid HTML.

A ten-line session check sits at the top as defence in depth — the proxy
already guarantees one, and this is here so a middleware-matcher typo
cannot silently expose the shell. Reading cookies() also makes the route
dynamic, which is what keeps the top bar's stamp a request time.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

---

## Task 11: Delete the duplicated inline headers

The one TSX exception, bounded to two elements. Without it `/queue` shows two `Log out` buttons and two `Settings` links, and the fattest duplication is the `h1` itself, which puts the app name and the page name at display weight under a rail that already says both.

**Nothing else in either file changes.**

**Files:**
- Modify: `src/app/(app)/queue/page.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Edit `src/app/(app)/queue/page.tsx` — remove the header element**

Delete these nine lines (currently 118–126, plus the blank line 127 under them):

```tsx
      <header className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1>{APP_NAME} — Queue</h1>
        <span className="row">
          <Link href="/settings">Settings</Link>
          <button className="secondary" onClick={() => void logout()}>
            Log out
          </button>
        </span>
      </header>
```

so that the returned JSX now opens:

```tsx
  return (
    <main>
      <div className="row">
        {STATUS_FILTERS.map((s) => (
```

- [ ] **Step 2: Edit `src/app/(app)/queue/page.tsx` — remove the now-unused `logout()`**

Delete these four lines (currently 111–114, plus the blank line 115 after them):

```tsx
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
```

The behaviour is not lost — it moved to `src/app/(app)/_shell/LogoutButton.tsx` in Task 8, which is where the rail's `Log out` lives.

- [ ] **Step 3: Edit `src/app/(app)/queue/page.tsx` — remove the two dead imports**

Delete these two lines (currently 4–5):

```tsx
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
```

The file's import block is then:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import PushControls from "./PushControls";
```

- [ ] **Step 4: Edit `src/app/(app)/settings/page.tsx` — remove the header element**

Delete these four lines (currently 68–71, plus the blank line 72 under them):

```tsx
      <header className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1>{APP_NAME} — Settings</h1>
        <Link href="/queue">Queue</Link>
      </header>
```

so that the returned JSX now opens:

```tsx
  return (
    <main>
      {error && <p className="error">{error}</p>}
```

- [ ] **Step 5: Edit `src/app/(app)/settings/page.tsx` — remove the two dead imports**

Delete these two lines (currently 4–5):

```tsx
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
```

The file's import block is then:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
```

- [ ] **Step 6: Confirm the edits are bounded to exactly those elements**

Run: `git diff --stat`
Expected: two files changed, `0 insertions(+)`, `24 deletions(-)` — 17 from `queue/page.tsx` (9 header + 1 blank + 4 `logout()` + 1 blank + 2 imports) and 7 from `settings/page.tsx` (4 header + 1 blank + 2 imports). **Any insertion is a mistake — this task deletes only.**

Run: `git grep -n "APP_NAME\|next/link\|logout" "src/app/(app)/queue/page.tsx" "src/app/(app)/settings/page.tsx"`
Expected: no output.

- [ ] **Step 7: Type-check, lint and build**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. (An unused-import error here means a deletion was missed.)

Run: `npm run lint`
Expected: no **new** errors. Lint already exits 1 with four pre-existing `react-hooks/set-state-in-effect` errors (`queue/PushControls.tsx`, `queue/page.tsx`, `settings/page.tsx`, `login/page.tsx`); two are in files this task edits, in `useEffect`s this task does not touch. They are carried forward (round 4 rulings, quality review of tasks 7–10), not fixed here.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/queue/page.tsx" "src/app/(app)/settings/page.tsx"
git commit -F - <<'EOF'
feat(p8a): delete the duplicated inline headers on queue and settings

Riku's answer of 2026-09-07, and the one TSX exception in the re-skin —
bounded to two elements. The rail already carries the app name, both
page links and Log out; without this /queue would show two Log out
buttons and two Settings links.

The queue page's logout() goes with its header: the behaviour moved to
the shell's LogoutButton. The Link and APP_NAME imports lose their last
consumer in both files. Nothing else in either file changes.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

---

## Task 12: A minimal `/freelance` root

So the rail's third nav item is not a dead link. **Plan C fills this file in; Plan A ships the title and nothing else.**

**Files:**
- Create: `src/app/(app)/freelance/page.tsx`

- [ ] **Step 1: Create `src/app/(app)/freelance/page.tsx`**

```tsx
/**
 * Placeholder. Plan C (docs/superpowers/plans/) rewrites this file with
 * force-dynamic, maxDuration, the Promise.allSettled fan-out and Blocks A–F.
 * It exists now only so the rail's third nav item is not a dead link.
 *
 * The 28px horizontal padding lives on .app-content and the 920px max-width
 * lives on .fl. Do not move either: box-sizing:border-box means a 920px
 * element WITH padding gives 864px of content, at which point four hero cards
 * wrap.
 */
export default function FreelancePage() {
  return (
    <main className="app-content">
      <div className="fl">
        <h1 className="fl-title">Freelance</h1>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, and the route table now lists `/freelance`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/freelance/page.tsx"
git commit -F - <<'EOF'
feat(p8a): a minimal /freelance root under the shell

The title and nothing else, so the rail's third nav item is not a dead
link. Plan C fills the page in.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

---

## Task 13: Verification

Run every check in order. **Do not claim completion until each one has produced the expected output in front of you.**

**Files:** none modified.

- [ ] **Step 1: The standing trio**

Run: `npm test`
Expected: all suites pass, including `watchdog.test.ts` (9 tests), `agentStatus.test.ts` (19 tests) and `deadline.test.ts` (R38). Zero failures.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run build`
Expected: `✓ Compiled successfully` and a route table listing `/queue`, `/settings`, `/freelance`, `/login`.

- [ ] **Step 2: No stray `components.html` token names**

Run: `git grep "var(--alert)\|var(--amber)" src/`
Expected: **no output**, exit code 1.

Why it matters: a custom property that resolves to nothing is invalid at computed-value time, so `color: var(--alert)` would silently **inherit** — a red warning rendering in body grey, in the one place it matters.

- [ ] **Step 3: `components.html` is never served and never bundled**

The stylesheets name the file in their comments on purpose — that is the audit
trail the port was designed to leave — so the grep looks for a real reference
(an import, a link, a URL) rather than the bare name.

Run: `git grep -n -E "(from|import|href|src|url)[[:space:]]*[:=(]?[[:space:]]*[\"'][^\"']*components\.html" src/ public/`
Expected: **no output**, exit code 1.

It also carries a `<link>` to `fonts.googleapis.com`, which from the app's own origin would be both a CSP violation and a real third-party request.

- [ ] **Step 4: No new dependency, no CSP change, no `dangerouslySetInnerHTML`**

Run: `git diff --stat 0a9a978..HEAD -- package.json package-lock.json next.config.ts`
Expected: **no output**. None of the three was touched. (`0a9a978` is the commit this plan started from — `docs(p8): ratify the visual-design spec…`. If the plan file itself was committed on top of it first, that commit touches none of these three, so the range is still correct.)

Run: `git grep -n "dangerouslySetInnerHTML" src/`
Expected: no output, exit code 1.

Run: `git status --porcelain src/proxy.ts src/app/login/page.tsx`
Expected: no output — neither file was modified.

- [ ] **Step 5: By eye, in a browser**

Run: `npm run dev`

Open `http://localhost:3000/queue`, sign in, and check each of these:

1. **The three faces render.** The `AGENTS` group label and the badge text are JetBrains Mono (letterspaced, monospaced digits); the `h1` and the wordmark are Archivo; body copy is IBM Plex Sans. If everything looks like the system UI font, the `next/font` variables did not reach `<html>`.
2. **Six badges are live** in the rail, in order: `CHASER · EXPIRY-SWEEP · WATCHDOG · SITE-HEALTH · OUTREACH-HEALTH · DISPATCHER`, each showing a real state. Green badges carry no caption; grey, amber and red ones do.
3. **`/queue` and `/settings` both work under the shell**, and each shows **exactly one** `Log out` (in the rail's foot) and no inline `<h1>` reading `RikuOS — Queue`.
4. **`/freelance` renders** its title under the shell, and the rail marks Freelance active when you are on it and Queue active when you are not.
5. **No CSP violation and no error in the DevTools console** on any of the three pages. Specifically, no request to `fonts.googleapis.com` or `fonts.gstatic.com` in the Network tab — `next/font` self-hosts.
6. **The rail's `#0B0D11` column reaches the bottom of the viewport on `/freelance`**, which is the shortest page in the app (R33, `.app-body{min-height:100vh}`).
7. **The stamp follows navigation** (R39). Note the `read HH:MM` in the top bar, wait for the minute to roll over, then click a different rail item: the stamp shows the new minute without a reload. (After a hard load the first stamp is the server's; every rail click after that recomputes it.)

Stop the dev server with Ctrl-C.

- [ ] **Step 6: By eye — the rail degrades to six grey em-dash badges**

In Git Bash, force a database failure. Next does not overwrite an env var already present in `process.env`, so a shell-level assignment beats `.env.local`:

```bash
MONGODB_URI="mongodb+srv://nobody:nobody@nowhere.invalid/rikuos" npm run dev
```

Open `http://localhost:3000/queue`.
Expected: the page still renders, the rail still renders, and the six badges are all grey with an `—` caption under each. **The route must not blank and must not show an error page.** Stop the server with Ctrl-C and restart normally to confirm the badges come back.

- [ ] **Step 7: By eye — the generated icon**

Run: `npm run dev`, then open `http://localhost:3000/icon` and `http://localhost:3000/apple-icon`.
Expected: both are an orange gradient square with a dark eight-point sunburst centred in it — no letterform, no white ground, no broken-image glyph, and no baked corner radius. Stop the server.

- [ ] **Step 8: Final commit of anything outstanding**

Run: `git status --porcelain`
Expected: **no output.** Every change made by this plan is already committed. If anything is listed, commit it:

```bash
git add -A
git commit -F - <<'EOF'
chore(p8a): verification follow-ups

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
EOF
```

- [ ] **Step 9: Hand back to the design lead**

Report to the lead: the trio green, both greps empty, and the result of each by-eye item.

Spec §9's fourth verification item — `/freelance` observed on Vercel against real ShikksTracker data — belongs to **Plan C** and is not claimed here.

---

## Self-review

**1. Spec coverage.** Every section in Plan A's scope maps to a task:

| Spec | Task |
|---|---|
| §3.1 rail anatomy | 8 (NavList), 10 (Rail) |
| §3.2 agents block, states, precedence, badge visuals | 6 (derivation), 9 (component), 2 (`.agent*` CSS) |
| §3.3 top bar, `Asia/Manila`, no pill | 8 |
| §5.1 tokens, name map, dark only, autofill | 2 |
| §5.2 faces via `next/font`, the `tokens.css` comment | 1, 2 |
| §5.3 the type scale | 2 (it is the ported CSS) |
| §5.4 the 920px column and the four-card arithmetic | 2 (`.fl`, `.stats`, `.app-content`), 12 |
| §5.5 row grammar, §5.6 disclosure, §5.7 focus/selection/motion | 2 |
| §5.8 declared unused vocabulary, and the rule that it must not grow | 2 (commented in place) |
| §6.1 selector table | 2 (`legacy.css`) |
| §6.2 named costs, incl. the `env(safe-area-inset-*)` drop | 2 (`legacy.css` header) |
| §6.3 the two header deletions | 11 |
| §7.1 four stylesheets, fixed order, `globals.css` deleted | 2 |
| §7.2 route group, no `<main>` in the shell, session check, icons | 4, 7, 8, 9, 10 |
| §7.3 extract don't widen, `RAIL_AGENTS`, `AGENT_STALE_HOURS`, Suspense + try/catch | 5, 6, 9, 10 |
| §7.7 fonts, manifest, viewport, status bar, icons | 1, 3 |
| §7.8 what must not ship | 13 (steps 3, 4) |
| §8 `watchdog.test.ts` unchanged; `agentStatus.test.ts` new | 5, 6 |
| §9 items 1–3 | 13 |
| Minimal `/freelance` root | 12 |

One gap, deliberate and accepted by the lead:

- **`IconLogout`.** §7.2 names it among `icons.tsx`'s exports, but §3.1 and the mockup both draw the rail's foot as text only, so nothing would render it — and §5.8 says the declared-but-unused list must not grow. It is omitted.

One addition beyond the spec, ruled in by the lead as **R33**: `.app-body{min-height:100vh}`, so the rail's ground reaches the bottom of the viewport on every page. It ships as the fifth deliberate difference from the mockup in Task 2, commented in place, and is checked by eye in Task 13.

**2. Placeholder scan.** No `TBD`, no `TODO`, no "implement later", no "similar to Task N", no "add appropriate error handling". Every code step carries the complete file or the exact lines to delete. Every command carries its expected output. The `/freelance` page is a *deliberately minimal shipped file* whose scope the brief fixes, not a placeholder — its comment says which plan replaces it.

**3. Type consistency.** Checked across tasks:

- `AgentBadgeState` = `"off" | "never" | "failed" | "overdue" | "ok"` in Task 6, and `BADGE_CLASS` in Task 9 is `Record<AgentBadgeState, string>` with exactly those five keys.
- `AgentStatus` = `{ agent; state; caption: string | null }` in Task 6; Task 9 renders the caption only when `!== null`, matching `ok`'s `null`.
- `AgentSwitches` = `{ chaserEnabled; monitoringEnabled }` in Task 6; Task 9 builds it from `IOsSettings`'s fields of the same names.
- `deriveAgentStatuses(now, latest, switches, expectations)` — four required arguments, same order in the test (Task 6), the implementation (Task 6) and the caller (Task 9).
- `classifyAgentRun(now, run, exp)` returns `AgentVerdict`; `evaluateWatchdog`'s switch and `deriveAgentStatuses`'s switch both handle all five kinds, so `strict` exhaustiveness holds in both.
- `connectDB` is a **named** export of `src/lib/db.ts` (Task 9 imports it as such), `getOsSettings` a named export of `src/lib/osSettings.ts`, `COOKIE_NAME` and `verifySessionToken` named exports of `src/lib/session.ts` (Task 10).
- CSS class names used in TSX all exist in `components.css`: `.app`, `.app-body`, `.app-side`, `.app-brand`, `.tile`, `.wm`, `.app-nav`, `.navitem`, `.is-active`, `.grouplabel`, `.agents`, `.agent`, `.is-ok`/`.is-overdue`/`.is-failed`/`.is-grey`, `.agent-cap`, `.rail-foot`, `.btn.ghost`, `.app-main`, `.topbar`, `.topbar-in`, `.crumb`, `.app-content`, `.fl`, `.fl-title`.
