# P8 design team — Frontend Architect, round 1

**Date:** 2026-09-06 · **Role:** how the design system lands in this codebase
**Standing question:** what is the cleanest build that survives Personal and Academics without a rewrite?
**Sources:** `docs/design/DESIGN-INSPO.md` (cited as §), `docs/design/components.html` (the recipe book), the P8 content deck (cited by Block), the P8 design doc, `ARCHITECTURE.md` §7 S10–S17, and the current `src/`.

---

## 1. Position

**One global stylesheet split into five files, one route group holding a server-rendered shell, and every decision the page makes pushed down into pure functions in `src/lib/` that a test can reach without a database or a network.** The page component becomes a renderer with no opinions in it. That is the whole strategy, and it survives Personal and Academics for one reason: **adding a page becomes `mkdir` plus one entry in a nav array**, because the shell, the tokens and the component vocabulary all live above the pages rather than inside them. Nothing new is installed — no Tailwind, no icon package, no CSS-in-JS, no date library, no `clsx`. The design system arrives as CSS custom properties and hand-ported class recipes; the graphics arrive as inline SVG built by tested pure functions; the collapsible blocks arrive as native `<details>`, which is HTML that already works. The Freelance route ships **exactly two client components in total** and neither one ever touches freelance data. Where the reference and the codebase pull in opposite directions I have taken the codebase's side on structure and the reference's side on looks, and I have said so each time rather than quietly splitting the difference.

---

## 2. The build, part by part

### 2.1 Stylesheet architecture

**Plain sentence:** one set of styles for the whole app, kept in five small files that are loaded in a fixed order, so that any page — including the two that do not exist yet — inherits the same look for free.

**One global stylesheet, not CSS Modules.** Three reasons, in order of force:

1. **Decision 4 is unimplementable with CSS Modules.** Re-skinning `.card`, `.badge`, `.meta`, `pre.body` and bare `button` in `queue/page.tsx` with zero TSX edits requires those selectors to exist globally. A module hashes its class names; it cannot reach a name already written in a file you may not touch.
2. **The reference is a global recipe book.** `components.html` is one `:root` and ~90 flat rules. Per-component modules fork `.btn` into a hero-card copy, an empty-card copy, a banner copy and a health-strip copy — four places to change when the pill's border moves.
3. **Modules push the wrong way for the next two pages.** Personal and Academics want the pipeline row grammar and the disclosure row. In a module those live inside `freelance/` and the second page copies them; in a global sheet they are already there.

**Where the files live and the order they load.**

```
src/styles/tokens.css       :root custom properties only — nothing else
src/styles/base.css         reset, html/body, headings, links, focus, main, ::selection
src/styles/components.css   the ported recipe book (the shared vocabulary)
src/styles/legacy.css       the re-skin of the old pages' class names — has an expiry date
src/app/globals.css         DELETED (its contents are redistributed above)
```

All five are imported side-effect style from `src/app/layout.tsx`, in that order, and **only from there**. Reason worth stating: in the App Router, CSS imported from different components can land in a non-deterministic order in the built stylesheet. Importing everything from the single root layout in a fixed sequence makes the cascade a thing you read in one file rather than a thing you discover in production.

`tokens.css` holds one `:root` block, hexes copied verbatim from §2 with a `/* source: DESIGN-INSPO §2 */` comment so drift is visible in a diff. Two token decisions:

- **Naming split between the two reference documents.** §2's table names the amber and red tokens `--stale` and `--missing`; `components.html`'s `:root` names them `--amber` and `--alert`. Same hexes, different names. **Take §2's names** — they carry the meaning, and §1.1's whole claim is that the meaning never moves. Add one comment line saying that a recipe copied out of `components.html` needs `--alert → --missing` and `--amber → --stale`. Do not define both; an alias is a second name for the same thing, which is how a hue eventually gets used for the wrong meaning.
- **Only port tokens with a consumer.** `--skill` (pink) is graph-only and P8 has no graph. `--spend-dim` / `--save-dim` have no use in anything we are building. Leave them out. An undefined token cannot be used decoratively; a defined unused one is an invitation.

Dark theme only (decision 5), so there is no `@media (prefers-color-scheme)` and no `[data-theme]` anywhere. Two things must follow from that or the re-skin will look broken in places nobody checks: `html { color-scheme: dark; }` so the browser paints scrollbars, spinners and the number input's stepper dark; and an explicit autofill override on the login page's password field, because Chrome paints its own near-white autofill background that no ordinary `background` declaration beats:

```css
input:-webkit-autofill { -webkit-text-fill-color: var(--ink); -webkit-box-shadow: 0 0 0 1000px #101318 inset; caret-color: var(--ink); }
```

That is exactly the kind of thing decision 4 (zero TSX edits) makes load-bearing: the only place it can be fixed is the stylesheet.

**Naming for new classes — a two-namespace rule.** Shared vocabulary keeps the reference's own names verbatim (`.stat`, `.btn`, `.tag`, `.statuspill`, `.eyebrow`, `.statstrip`, `.emptycard`, `.firstrun`, `.segmented`, `.range`, `.navitem`, `.agent`, `.track`, `.ticks`) so a recipe can be diffed against `components.html` by eye. Page-specific blocks get a two-letter page prefix (`.fl-pipeline`, `.fl-needs`, `.fl-health`; later `.pe-`, `.ac-`). No third namespace, no BEM, no utility classes. The rule in one line: **if the reference names it, keep the reference's name; if only this page has it, prefix it with the page.**

**Do not port the teardown document's own furniture.** `components.html` is a web page about components as well as a set of components. `.frame`, `.rail` (the doc's sticky sidebar, which is *not* the app rail), `.masthead`, `.kicker`, `.standfirst`, `.meta-strip`, `.well`, `.caption`, `.notes`, `.rules`, `.rule`, `.slot`, `.debt`, `.part`, `.scale`, `.swatches`, `.sw`, `footer` are all article chrome. None of it ships.

**The old pages' classes, re-tokened, zero TSX edits.**

| Existing selector | Where it is used | New treatment | Reference |
|---|---|---|---|
| `main` | queue, settings, login | content column: `max-width: var(--content-max, 920px)`, `margin: 0 auto`, padding `28px`, keeps its `env(safe-area-inset-*)` | §4 "single column, generous side padding" |
| `h1` | all three | display 600 · 24px · `-0.02em` · `--ink` | §3 "Page title" |
| `button` (bare) | approve, save, enable, active filter | outline pill: `.btn` recipe at highest emphasis — `--ink` label, `--ink-4` border, transparent fill, mono 9.5px/0.14em uppercase, radius 999px, padding `8px 14px` | §5.10 Pill |
| `button.secondary` | edit, cancel, inactive filter, re-register | same pill at resting emphasis — `--ink-3` label, `--line` border | §5.10 Pill |
| `button.danger` | reject, turn-off switches | same pill, `rgba(248,113,113,.4)` border, `#F5A5A5` label, **never a solid fill** | §5.10 Affirmative, inverted |
| `button:disabled` | everywhere | `opacity: .45`, `cursor: not-allowed`, hover lift suppressed | — |
| `.card` | queue items, settings groups, PushControls | `--raised` fill, `1px solid --line`, radius **10px**, padding 14px, margin-bottom 14px | §3 radii (10px = plain card); §1.4 |
| `.badge` | item status | the reference's `.tag`: radius **6px**, mono 9px/0.13em uppercase, `--line` border, `--ink-3` | §5.10 Tags |
| `.meta` | timestamps, section labels, notes | body 400 · 10.5px · `--ink-3` | §3 "Meta" |
| `.row` | flex groups | unchanged layout; `gap: 10px`, `align-items: center` | §3 spacing scale |
| `.error` | inline errors | `--missing`, 12.5px, no box | §2 semantic red |
| `pre.body` | draft email bodies | `--sunk` fill, `1px --line-soft`, radius 8px, `--ink-2`, 12.5px, `white-space: pre-wrap`, body face (it is human prose, not code) | §2 `--sunk` "recessed wells" |
| `input`, `textarea` | login, settings | `#101318` fill, `--line` border, radius 8px, `--ink` text, `caret-color: var(--spend)` | §4 search field |
| `label` | form labels | body 400 · 12px · `--ink-3`, sentence case — **not** mono caps | §6 "sentence case for anything addressed to the person" |
| `a` | nav links in old headers | `--ink-2`, `1px solid --line` underline, hover to `--ink` | deliberate deviation, below |
| `:focus-visible` | global | `2px solid var(--spend)`, `offset: 3px`, `border-radius: 3px` | `components.html` global rule, ported verbatim |

**One deliberate deviation:** `components.html` makes `a` orange. That is correct for a teardown article, where orange is the document's accent. In the app orange is `--spend` and means money out and the brand mark (§1.1). A "Settings" link is neither. Links get `--ink-2` with a hairline underline. Say it out loud so it is not read as a porting mistake.

**The three-way `button` overload — the one real problem in this table.** Unclassed `<button>` currently carries three different meanings in `queue/page.tsx` and `settings/page.tsx`: an affirmative action (Approve, Save threshold, Enable notifications), a neutral action, and an *active segment* in the status-filter row. That filter row is textbook §5.3 time-range — the active item should be a solid white pill. One element selector cannot be all three. My recommendation is the boring one: **map bare `button` to the neutral-high outline pill and accept that the filter row loses its solid active state**, because it still reads correctly (bright outline versus dim outline) and it needs no TSX at all, which is exactly what decision 4 asked for. The alternative — a three-line `className` diff — is listed for Riku in §4 below.

**Does "no solid hue buttons" apply to Approve?** Yes, and the usual justification for it ("the system proposes, it does not demand", §5.7) is the wrong one here — Riku pressing Approve *is* a demand and it should be. The rule still binds for a different, purely engineering reason: **§5.10's actual mechanism is rationing.** "Solid fills are rationed to at most one per screen." The queue renders one Approve per pending item. A solid Approve puts a dozen solid pills on one screen, which is precisely the noise the rationing rule exists to prevent, and it would make the loudest thing on the page a control that is repeated twelve times rather than the item that needs deciding. So Approve stays an outline pill. If it later earns distinction, the right treatment is §5.10's *affirmative* — `--save` border at 40% with a pale green label — which makes it the one green thing in a grey column, more findable in a stack than a solid fill would be, not less. That needs a class name and therefore a TSX edit; it is a later phase.

---

### 2.2 The shell

**Plain sentence:** put the rail and top bar in one layout file that wraps every signed-in page, and leave the login page outside it, so the chrome is written once and every future page gets it by being in the right folder.

**Route group, not conditional chrome.**

```
src/app/(app)/layout.tsx          server component — the shell
src/app/(app)/queue/              moved with `git mv`, contents untouched
src/app/(app)/settings/           moved with `git mv`, contents untouched
src/app/(app)/freelance/          new
src/app/login/page.tsx            stays where it is — bare, no shell
src/app/(app)/_shell/Rail.tsx     server
src/app/(app)/_shell/NavList.tsx  "use client" — the only client island in the shell
src/app/(app)/_shell/AgentsBlock.tsx  server, async
src/app/(app)/_shell/TopBar.tsx   server
src/app/(app)/_shell/LogoutButton.tsx "use client"
src/components/icons.tsx          plain SVG components, no "use client"
```

A route group changes no URL, so `/queue` and `/settings` keep working, the proxy matcher is untouched, and — the point for decision 4 — **moving a folder is not a TSX edit**. The relative `./PushControls` import moves with the folder. `_shell` has a leading underscore so Next excludes it from routing.

Rejected: one root layout with `usePathname()`-driven conditional chrome — it forces the root layout to be a client component, killing server data fetching for the agents block. Also rejected: each page rendering its own shell (three copies today, five in two phases).

**Why this survives the next two pages:** adding `/personal` is `mkdir src/app/(app)/personal` plus one entry in the `NAV` array. There is no other change.

**The layout renders no `<main>`.** `queue`, `settings` and `login` each render their own, and decision 4 forbids editing them; two `<main>` elements in one document is invalid HTML. So the shell renders `<div class="shell">`, `<aside class="rail">`, `<header class="topbar">` and `<div class="col">`, and each page keeps its own `<main>`, which `base.css` styles as the content column.

**Geometry** — straight from §4, desktop only, no media queries:

```css
.shell { display: grid; grid-template-columns: 170px minmax(0,1fr); min-height: 100dvh; background: var(--void); }
.rail  { position: sticky; top: 0; align-self: start; height: 100dvh; padding: 14px 10px;
         border-right: 1px solid var(--line-soft); display: flex; flex-direction: column; gap: 16px; }
.topbar{ height: 44px; display: flex; align-items: center; gap: 12px; padding: 0 18px;
         border-bottom: 1px solid var(--line-soft); }
.col   { min-width: 0; }
```

**The rail's active-nav island.** `usePathname()` is client-only. The smallest correct island is a ~25-line client component that renders the `<Link>`s and compares the pathname — no state, no effects, no data. Everything else in the rail stays server-side.

I considered and rejected a zero-JS version: `src/proxy.ts` already knows `request.nextUrl.pathname` and could forward it as a request header for the server layout to read via `headers()`. It works, and I am not doing it. **The proxy is the app's authorization boundary and must stay boring.** Editing a fail-closed security file to save 1 KB of hydration is a bad trade in a repo whose rules say `requireSession` is worth duplicating for defence in depth.

**Should the shell read the session?** The proxy already guarantees one. But CLAUDE.md's instinct — verify anyway — is cheap here, so yes: a ten-line `requireSessionOrRedirect()` in the layout that reads the cookie with `cookies()`, verifies with the existing `verifySessionToken`, and `redirect("/login")` otherwise. It is not there to catch a normal failure; it is there so that a middleware matcher typo cannot silently expose the shell. It does **not** need the pathname for `?from=`, and I would not add it — the login page already defaults to `/queue`.

**The agents block.**

Data comes from the existing `fetchLatestRuns(EXPECTATIONS.map(e => e.agent))`, which is already five indexed `findOne`s written for exactly this question. No new query.

**Decompose `evaluateWatchdog`; do not widen it.** It returns *anomalies* — an empty array means healthy. The rail needs one badge per agent including the healthy ones, a different type with a different totality guarantee. Making one function serve both means either the digest receives `ok` rows it must filter (a silent contract change to the one push Riku is meant to trust) or the rail reconstructs "healthy" from *absence*, which would paint an agent missing from `EXPECTATIONS` green. Extract the per-agent judgement both already want:

```ts
// src/lib/watchdog.ts
export type AgentVerdict =
  | { kind: "never" }
  | { kind: "stale"; ageHours: number }
  | { kind: "failed" }
  | { kind: "degraded"; itemsFailed: number }
  | { kind: "ok"; ageHours: number };

export function classifyAgentRun(now: Date, run: LatestRun | undefined, exp: Expectation): AgentVerdict;

export type AgentBadgeState = "ok" | "stale" | "failed" | "never";
export interface AgentStatus { agent: Agent; state: AgentBadgeState; ageHours: number | null; note: string }
export function deriveAgentStatuses(now: Date, latest: LatestRun[], expectations?: Expectation[]): AgentStatus[];
```

`evaluateWatchdog` becomes a map-and-filter over `classifyAgentRun` — **the existing `watchdog.test.ts` must pass unchanged, and that is the refactor's proof.** `deriveAgentStatuses` is total by construction: one row per expectation, in `EXPECTATIONS` order, never more, never fewer.

Riku's decision 3 names four badge colours, and the watchdog has five kinds, so `degraded` has to fold. It folds into **failed / red**, because "it ran and N items failed" is a failure of the work, not ageing. The item count goes in the badge's `title` attribute. Colours are §2's, unchanged: ok `--save`, stale `--stale`, failed `--missing`, never `--ink-4` grey — which is also §5.14's rule 2 in miniature (no signal, hue drains, structure stays). Badge recipe is `components.html`'s `.agent`: 8px radius, mono 10px/700/0.08em uppercase, a hue-tinted vertical gradient at ~9%→2% and a border at ~22%. No click behaviour this phase.

**Does the shell's DB query run on every navigation, and what does it cost?** On a hard page load, yes: one round trip to Atlas, five indexed lookups on a TTL'd collection with a handful of rows. On a soft `<Link>` navigation between two pages inside `(app)`, the layout sits *above* the changed segment and is reused from the client router cache rather than re-rendered — which means the badges can go stale during a long session. That is fine and I would not fix it: these agents run once a day. **No polling, no `unstable_cache`, no revalidate tag.** (Confirm the reuse behaviour with a temporary log line during the build; I am describing Next's documented segment behaviour, not asserting an internal I have measured.)

**A DB failure in the rail must never break page render**, and the guard has to be structural rather than a promise:

```tsx
<Suspense fallback={<AgentsSkeleton />}>
  <AgentsBlock />
</Suspense>
```

with a `try/catch` **inside** `AgentsBlock` that returns the grey never-run badges plus a `title` note on failure. Both halves are required: Suspense keeps the DB read off the critical path so the shell and page paint immediately, but an uncaught throw inside an async server component bubbles to the nearest error boundary and can blank the route — so the `try/catch` is the actual safety, and Suspense is the latency fix.

**The top bar.** §4 lists breadcrumb → daemon status pill → search with `⌘K` → notification and theme icon buttons. Two of those do not ship:

- **No search field.** It would search nothing. D10 forbids decorative work, and a control that does not work is worse than decoration.
- **No theme toggle.** Dark only (decision 5).

What ships: a mono micro-label breadcrumb on the left (`OPERATOR / {APP_NAME}` — from the constant, never a literal), and on the right, pushed with `margin-left: auto`, a logout icon button. I would additionally recommend **one status pill carrying a real number: pending approvals**, linking to `/queue`. It is a single `countDocuments({ status: "pending" })` that rides in the same Suspense-guarded server read as the agents block — one DB trip, two consumers — it satisfies D11 (no chrome without a live feed), and Personal and Academics inherit it. It is beyond Riku's five decisions, so mark it cuttable: if it is cut, the bar carries breadcrumb and logout only, and that is fine.

---

### 2.3 The Freelance page

**Plain sentence:** the page asks ShikksTracker three questions at once, and if one of them fails only that part of the page says so. All the thinking about what the words should say happens in tested functions, not in the page file.

```
src/app/(app)/freelance/page.tsx              server, force-dynamic — a renderer
src/app/(app)/freelance/_blocks/StateOfPlay.tsx    Block A
src/app/(app)/freelance/_blocks/Pipeline.tsx       Block B
src/app/(app)/freelance/_blocks/Campaigns.tsx      Block C
src/app/(app)/freelance/_blocks/Approaches.tsx     Block D
src/app/(app)/freelance/_blocks/NeedsYou.tsx       Block E
src/app/(app)/freelance/_blocks/HealthStrip.tsx    Block F
src/app/(app)/freelance/_blocks/CheckNow.tsx       "use client" — the only client island
src/app/(app)/freelance/_blocks/HeroRow.tsx        the three stat cards
```

Logic, flat in `src/lib/` to match the repo's existing shape (`chaser.ts`, `digest.ts`, `siteHealth.ts` — no folders anywhere), tests in `src/lib/__tests__/` because `vitest.config.ts` only collects from there:

```
src/lib/freelanceView.ts       Blocks A, B, C view models
src/lib/freelanceVariants.ts   Block D — the email / not-measurable split
src/lib/freelanceGaps.ts       Block E — the gap calculation
src/lib/freelanceHealth.ts     Block F — composes evaluateOutreach + the snapshot
src/lib/heroGraphics.ts        SVG path builders
src/lib/format.ts              pluralise, relative ages — shared, NOT freelance-prefixed
```

`src/lib/format.ts` is deliberately unprefixed because Personal and Academics need the same two age formats. `formatAge` already exists inside `outreachHealth.ts` and produces exactly Block F's `6h` / `36h` / `3d` grammar — **move it into `format.ts` and re-import it**, rather than writing a second implementation that will drift. Block E needs a different one (`just now` / `4 hours ago` / `2 days ago` / `3 weeks ago`), so both live side by side with the boundary cases pinned in tests.

**Page shell:**

```tsx
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const [summary, attention, variants] = await Promise.allSettled([
  fetchSummary(PAGE_TIMEOUT_MS),
  fetchAttention(days, ATTENTION_LIMIT, PAGE_TIMEOUT_MS),
  fetchVariantStats(PAGE_TIMEOUT_MS),
]);
```

`Promise.allSettled`, not `Promise.all` — that is the whole per-block-degradation mechanism in one word. Each block receives either its data or a rejection and renders its own "Couldn't load…" line from the deck. `cache: "no-store"` is already set inside every `stApi` fetch.

**What `stApi.ts` must gain.** Four things, and the fourth is the one that has already bitten this repo once.

1. **Widen `SummaryResponse`** with the two blocks the deck needs. The real contract, read from `../ShikksTracker/docs/os-api.md`, is `contacts: { total, byPipelineStage, hot }` and `campaigns: [{ id, name, sent, opened, clicked, replied }]`.

```ts
export const PIPELINE_STAGES = ["not_started","contacted","replied","call_booked","proposal_sent","won","lost"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export interface SummaryContacts {
  total: number | null;
  hot: number | null;
  byPipelineStage: Record<PipelineStage, number | null>;
}
export interface SummaryCampaign {
  id: string; name: string;
  sent: number | null; opened: number | null; clicked: number | null; replied: number | null;
}
export interface SummaryResponse {
  queue: SummaryQueue;
  engine: SummaryEngine;
  contacts: SummaryContacts | null;   // null = the whole block was absent
  campaigns: SummaryCampaign[] | null;
}
```

2. **Carry them through `fetchSummary`'s reconstruction, in the same change.** The file says so in as many words and the design doc names it as the exact pair missed in P4's `overdueActions`: widening the interface alone yields `undefined` at runtime with a green type-check. Every count goes through `readCount`, per stage, so a stage the API omitted arrives as `null` and not as a zero (D8).

3. **A new call, `fetchVariantStats()`.** The contract is `[{ key, label, channel, stage, sends, replies, replyRate, bySlice }]`, and it is documented as "deliberately not truncated", so the display bound is ours to enforce. **Ignore the upstream `replyRate` and recompute it locally from `sends` and `replies`.** Almost certainly the upstream computes `0/0 → 0%` for non-email variants, which is exactly the lie the `p7-variant-stats-blind-spot` memory names and Block D exists to refuse. Read the two numbers; derive the rate only for email; never print a rate for anything else.

4. **A page-level timeout, shorter than the agent-level one.** `ST_TIMEOUT_MS` is 15 s, which is right for a cron job and wrong for a human. Three hung calls at 15 s each in parallel is a 15 s page plus render — and if the Vercel function budget expires first, Riku gets a platform error page instead of the deck's carefully written "Couldn't reach ShikksTracker." So give the three fetches an optional timeout parameter (backwards compatible, existing callers unchanged) and pass `ST_PAGE_TIMEOUT_MS = 6_000` from the page. Then the worst case is a degraded page in ~6 s, which is the behaviour the deck specifies. Set `maxDuration = 30` on the page as a second belt.

**The view models.** Signatures, so the boundary is unambiguous:

```ts
// freelanceView.ts
export interface StateLine { key: "drafts"|"approved"|"untouched"; text: string; href?: string; tone: "normal"|"missing" }
export function buildStateOfPlay(summary: SummaryResponse, stBaseUrl: string): StateLine[];   // [] → "Nothing waiting on you."

export interface PipelineView {
  summaryLine: string;                        // "30 contacts · 2 hot"
  rows: { stage: PipelineStage; label: string; count: number }[];
  collapsedLine: string | null;               // "Nothing yet at call booked, proposal sent, won or lost"
  unknownLine: string | null;                 // stages ShikksTracker did not report
  empty: boolean;
}
export function buildPipeline(contacts: SummaryContacts | null): PipelineView;

export interface CampaignsView { count: number; rows: SummaryCampaign[]; boundNote: string | null }
export function buildCampaigns(campaigns: SummaryCampaign[] | null, bound: number): CampaignsView;
```

`buildPipeline` carries a distinction the deck did not have to make but the code does: a stage that is genuinely **0** collapses into the muted line, and a stage that is **`null`** — not reported — must not, because collapsing it would be exactly the "missing rendered as zero" that D8 forbids. Hence `unknownLine`. This needs one new string; it is in §4 for Riku.

```ts
// freelanceVariants.ts
export function isMeasurableChannel(channel: string): boolean;   // "email" only, since S15
export interface ApproachesView {
  measured: { label: string; ratePct: number; sends: number; replies: number }[];
  unmeasurable: { label: string; sends: number }[];   // rendered "—", never "0%"
  summary: string;                                    // "No sends yet — nothing to compare." or the top line
}
export function splitVariants(stats: VariantStat[]): ApproachesView;
```

```ts
// freelanceGaps.ts
export type NeedsRow =
  | { kind: "unsupported-channel"; business: string; channel: string; waitedMs: number; snippet: string | null; contactId: string }
  | { kind: "no-draft";            business: string; channel: string; waitedMs: number; snippet: string | null; contactId: string }
  | { kind: "overdue";             business: string; dueMs: number; note: string | null; contactId: string };

export function buildNeedsYou(
  now: Date,
  attention: AttentionResponse,
  liveAnchorIds: Set<string>,
  limit: number
): { rows: NeedsRow[]; total: number; boundNote: string | null };
```

`liveAnchorIds` is the same set the chaser uses, and it is **currently built inline in `src/app/api/cron/chaser/route.ts`, lines 70–89.** Extract that query into `src/lib/queue.ts` as `fetchLiveAnchorIds(anchors: string[]): Promise<Set<string>>` and have both callers use it. Writing a second copy on the page is the single most likely way this feature goes wrong: if the two status lists ever drift, the page and the chaser will disagree about the same lead and neither list will be trustworthy — which is the exact failure D3 in the design doc was written to prevent.

```ts
// freelanceHealth.ts
export interface HealthView { warnings: string[]; quietLine: string | null; sitesLine: string; checkedLine: string }
export function buildHealthStrip(now: Date, summary: SummaryResponse | null, snapshot: StoredSnapshot | null): HealthView;
```

`buildHealthStrip` calls the existing `evaluateOutreach` unchanged. Worth noticing as confirmation the reuse is right: the deck's "exact strings the system produces" in Block F **are** `evaluateOutreach`'s `detail` strings, character for character. Nothing is rewritten; the view model only orders them and adds the sites and the snapshot age.

---

### 2.4 Collapsible blocks C and D

**Plain sentence:** use the browser's own expand/collapse element instead of writing JavaScript for it.

**Native `<details>` / `<summary>`.** Four reasons: it works in a server component with **zero client JavaScript** (a `useState` version turns Blocks C and D into client components, serializing every campaign name and approach label twice — RSC payload and rendered HTML — for "show me the rest of the row"); "is this section open" is **not application state**, having no consumers, no persistence and no sharing; keyboard operation, focus behaviour, `aria-expanded` and find-on-page expansion all come free and correct; and it cannot break under hydration because there is none.

The cost is no open/close animation. Given §5's instrument-panel restraint and that `components.html` ends with `@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}`, that cost is close to zero.

Styling a `<summary>` to look like the reference's row plus an affordance:

```css
.disclose > summary {
  list-style: none; cursor: pointer;
  display: grid; grid-template-columns: minmax(0,1fr) auto auto; gap: 12px; align-items: center;
  padding: 13px 0; border-top: 1px solid var(--line-soft);
  font-size: 13px; font-weight: 600; color: var(--ink);
}
.disclose > summary::-webkit-details-marker { display: none; }   /* Safari */
.disclose > summary .n { font-family: var(--mono); font-size: 10px; color: var(--ink-3);
                         font-variant-numeric: tabular-nums; }
.disclose > summary::after {                                      /* the chevron */
  content: ""; width: 6px; height: 6px; transform: rotate(-45deg); transition: transform .14s ease;
  border-right: 1.5px solid var(--ink-4); border-bottom: 1.5px solid var(--ink-4);
}
.disclose[open] > summary::after { transform: rotate(45deg); }
```

That is §5.5's and §5.12's row grammar exactly — hairline above, identity left, count and affordance right, no box — with the chevron the deck draws as `›`. Two traps: `list-style: none` alone is not enough on Safari, hence the `::-webkit-details-marker` rule; and the reduced-motion rule must cover the `transition`.

---

### 2.5 The `Check now` control

**Plain sentence:** a small button that asks the server to re-check the three sites, save the result, and redraw the page.

**Route: `POST /api/health/sites`.** POST means "take a new reading"; the noun is what is being read. It leaves `GET /api/health/sites` free if a JSON view is ever wanted.

```
src/app/api/health/sites/route.ts     thin: guard → floor → checkSites() → save → JSON
src/models/HealthSnapshot.ts          the singleton document
src/lib/healthSnapshot.ts             saveHealthSnapshot() / getHealthSnapshot()
```

Handler order, first line first, per CLAUDE.md:

1. `const denied = await requireSession(request); if (denied) return denied;` — this is also the Origin check, which `requireSession` already performs for mutating methods. **No proxy change:** the path is under `/api/` and not in `isPublicPath`, so it is already fail-closed.
2. Rate-limit floor.
3. `await connectDB()`, `checkSites()`, `saveHealthSnapshot()`.
4. Return the fresh snapshot as JSON.

**The rate-limit floor (design doc open item 3): 60 seconds, enforced server-side, read from the snapshot's own `checkedAt`.** No new collection, no new counter, and specifically **not** an in-memory map — on Vercel that is per-instance and therefore not a limit at all. On a hit, return **200 with the existing snapshot and `throttled: true`**, not a 429: the control's promise is "the strip is current", a reading twenty seconds old *is* current, and Riku pressing twice is not an error that deserves an error state. The button shows `Checked just now` and settles. The floor exists to stop a stuck finger from firing nine GETs at client sites, not to defend against abuse — there is exactly one user behind a session cookie.

**The client island** is ~30 lines: `useState` for `busy`, `fetch` the POST, then `router.refresh()` from `next/navigation`. `router.refresh()` re-runs the server render and reconciles in place — so the new reading arrives through the same server path as a page load, and the island never has to know the shape of a snapshot. Busy label `Checking…` per the deck; `disabled` while busy. It is styled `.btn` (outline pill, §5.10) and it is the *only* control on the page, which keeps the deck's "nothing here acts on a lead" promise visibly true.

**The model**, following the repo's Mongo rules exactly:

```ts
// src/models/HealthSnapshot.ts
const SiteEntrySchema = new Schema({
  name:   { type: String, required: true, maxlength: 60 },
  up:     { type: Boolean, required: true },
  detail: { type: String, required: true, maxlength: 200 },
}, { _id: false, strict: true });

// checkedAt required; sites bounded to 20 by a validator; timestamps { createdAt: true, updatedAt: true }
// No TTL — the newest reading must always exist, and it is overwritten, not accumulated.
```

`SiteResult` from `siteHealth.ts` is already `{ name, up, detail }`, so the stored shape is the produced shape and there is no mapping layer to drift.

**One trap that contradicts the house pattern.** `osSettings.ts` reaches its singleton with `findOneAndUpdate({}, …, { upsert: true })` on *read*. `getHealthSnapshot()` must **not** do that. An upsert-on-read would manufacture a document with a defaulted `checkedAt` and an empty `sites` array, and the strip would confidently report "checked just now, no sites watched" when in truth it has never run. Read with `findOne().lean()`, return `null`, and let Block F say `sites never checked` (the deck's own string). Write path only uses the upsert.

**The morning cron.** The write goes **inside the existing `site-health` job**, after `checkSites()` resolves, in its own `try/catch`:

```ts
const health = await runJob("site-health", async () => {
  const results = await checkSites();
  let saveFailed = false;
  try { await saveHealthSnapshot(new Date(), results); }
  catch (err) { saveFailed = true; console.error("[cron/morning] snapshot write failed:", err); }
  return { counts: { itemsProcessed: results.length, itemsFailed: saveFailed ? 1 : 0 }, data: results };
});
```

**Why that ordering.** The dispatcher composes the digest from `health.data` later in the same invocation. If the snapshot write were allowed to throw, the job would be `ok: false` and today's digest would lose its site lines — trading the outer safety net for a cosmetic persistence step. So the write is caught, counted (`itemsFailed: 1`, which tomorrow's watchdog names as "site-health: 1 item failed"), and the results flow on untouched. This is consistent with the repo's existing split: `outreach-health` keeps `itemsFailed` at 0 for *findings* about another system, but a failure of our own machinery is a real failed item and should be counted.

And it correctly does **not** run in the monitoring-disabled branch, where `site-health` only files a note-run. The snapshot then ages, Block F says `checked 3d ago`, and that is the truth.

---

### 2.6 Hero card graphics

**Plain sentence:** each of the three cards gets a small picture drawn from its own number — a different kind of picture for a different kind of number — and the picture is built by a function a test can check.

Inline `<svg>` in the server component, `viewBox="0 0 240 74"`, `preserveAspectRatio="none"`, `aria-hidden="true"`, absolutely positioned to bleed to the lower edges at `z-index: 1` with content at `z-index: 2` — the reference's `.stat svg.viz` recipe verbatim. **No canvas, no JavaScript, no animation.**

**The three numbers** (Riku's decision 2): drafts waiting on you (24), contacts never contacted (25 of 30), and — the one the team is arguing about — **hot leads (2)**. My vote is hot leads over replies-waiting, for two reasons. Replies waiting is `attention.repliedUnanswered`, which is **0 today** and is also the list rendered in Block E immediately below; putting the count in the hero and the list underneath states the same fact twice, and D2 rejected the scoreboard precisely to avoid a row of zeros. Hot leads is 2, is live, and is stated nowhere else on the page.

**Hues, all meaning-true under §1.1 and §7.2, no new meanings invented:**

| Card | Hue | Why that hue |
|---|---|---|
| Drafts waiting on you | `--roi` violet | Violet is judgement and decisions. A draft waiting is a decision waiting — it is literally the queue. Per §5.2's stated exception, the violet card spends its hue on the graphic and the figure goes near-white (`#EDE9FE`). |
| Contacts never contacted | `--session` blue | Blue is activity. "25 of 30 untouched" is a statement about how much of the list has been worked. Needs a fourth gradient, derived by §2's own formula (`linear-gradient(155deg,#0B1B2E,#101418 62%)`, border `rgba(95,165,250,.2)`) — that is porting the recipe, not inventing one. |
| Hot leads | `--save` green | Green is value in hand. |

Amber and red are deliberately not used here: 25 untouched contacts is the *correct resting state* under S10, and a card that glows amber every single day is the visual form of the daily false alarm that S15's post-mortem says trains a person to ignore the one signal that matters. When money-in arrives later it takes `--spend` orange as a fourth or replacement card, and nothing above has to move.

**The shapes.** §5.2 demands three *different* treatments and §1.5 demands each is a reading of that card's own number. We hold no time series anywhere, so the shapes read a **count**, a **ratio**, and a **small set of objects**:

```ts
// src/lib/heroGraphics.ts — all pure, all deterministic, all bounded
export function countStack(n: number | null, cap?: number): { y: number; w: number; opacity: number }[];
export function ratioTicks(part: number | null, total: number | null, maxTicks?: number):
  | { mode: "ticks"; filled: number; total: number }
  | { mode: "bar"; fraction: number }
  | { mode: "empty" };
export function objectNodes(n: number | null, cap?: number): { cx: number; cy: number; r: number }[];
```

- **`countStack`** — one thin horizontal line per draft, stacked from the bottom, widths and opacity falling off toward the top. 24 drafts draws 24 lines. It changes visibly when the number changes and it is countable at a glance.
- **`ratioTicks`** — §5.13's segmented counter, one tick per contact when the total is small enough to count, degrading to a proportional bar past `maxTicks` (the reference's own guidance is ticks to about sixteen). Today's 30 contacts land on the bar side; a test pins the threshold.
- **`objectNodes`** — one circle per hot lead, drawn with §5.8's halo-and-core treatment as an SVG `<radialGradient>` (a wide low-alpha halo under a small solid core). Small counts of *things* want objects, not aggregates.

Three properties the tests pin, each a correctness rule rather than a style preference: **`null` in, empty out** (no shape is ever drawn for an unreported number — the card falls to §5.14's `.blank` treatment and an em-dash); **determinism** (no `Math.random()`; `objectNodes(3)` must equal `objectNodes(3)`, because a randomised layout makes the same reading look different on every load, which is decoration in a data costume); and **bounded output** (every builder caps its element count, exactly as every list endpoint here is bounded — a future 5,000 must not emit 5,000 nodes).

---

### 2.7 Icons

**Plain sentence:** eight small hand-written pictures in one file; no library.

`src/components/icons.tsx`, named exports, no `"use client"` (SVG renders fine on the server): `IconQueue`, `IconFreelance`, `IconSettings`, `IconLogout`, `IconChevron`, `IconWarning`, `IconArrowOut`, `IconMark` (the brand sunburst). All `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.8}`, round caps, `aria-hidden="true"` unless given a title — that is `components.html`'s own icon idiom, so they will sit correctly beside the ported CSS. Size comes from a `size` prop defaulting to 13 (nav) or 16. Total well under 3 KB, no dependency, no font, no CSP surface.

One opinion: **do not build an `<Icon name="warning" />` registry.** Named exports tree-shake, are typo-proof under `strict`, and one grep finds every use of a glyph. A string-keyed registry loses all three and gains nothing.

Where the reference uses a text glyph — `DETAILS ↗`, the `›` affordance, `⚠` in Block F's worst case — use the literal character inside the mono label rather than an icon component. Fewer nodes, and it is what `components.html` does.

---

### 2.8 PWA bits

**Plain sentence:** make the installed app open on the same dark ground as the page, and make the app icon the brand tile from the design.

- **`manifest.ts`:** `background_color: "#08090B"` and `theme_color: "#08090B"` — both `--void`. The background colour is the splash ground; if it stays `#ffffff` the app flashes white every launch, which is the most visible possible bug in a dark-only design.
- **`layout.tsx` viewport export:** add `themeColor: "#08090B"` and `colorScheme: "dark"`. Next reads `themeColor` from the `viewport` export, not from `metadata` — putting it in `metadata` silently does nothing and is an easy hour to lose.
- **`appleWebApp.statusBarStyle`:** change `"default"` (which paints a light bar) to **`"black"`**, not `"black-translucent"`. `black-translucent` is the prettier answer but it slides content under the status bar and therefore needs `env(safe-area-inset-top)` layout work, which decision 1 defers. `"black"` is a colour change with no layout consequence.
- **`icon.tsx` / `apple-icon.tsx`: yes, the brand tile becomes the app icon.** It is already exactly what an app icon is — an orange gradient square with a sunburst glyph (`components.html`'s `.mark-tile`). Two cautions. First, **do not bake the 6–9px radius into the PNG**: that radius is specified at the rail's 20–30px tile; at 512px it would be a hairline of a corner, and both iOS and Android mask the icon themselves. Export full-bleed. Second, `ImageResponse` renders through satori, whose SVG support has historically been the flaky part — render the tile as a gradient `div` with the glyph as an inline `<svg>` child and **verify it in `npm run build`**, because a satori failure surfaces as a broken image rather than a compile error. If it misbehaves, draw the glyph with positioned divs rather than adding a dependency.
- **`public/sw.js`:** no change. Its default notification target `/queue` is still correct.

---

### 2.9 Testing plan

Pure, in `src/lib/__tests__/`, in the existing Vitest style — no database, no network:

| Test file | Pins |
|---|---|
| `watchdog.test.ts` (existing, unchanged) | that the `classifyAgentRun` extraction did not change the digest |
| `agentStatus.test.ts` | four badge states; the boundary at `everyHours + graceHours`; `degraded → failed`; totality (one row per expectation, in order); an agent absent from `EXPECTATIONS` never appears |
| `freelanceView.test.ts` | Block A singular/plural, hidden-at-zero, "didn't report" ≠ zero, link only on the drafts line, the all-hidden fallback; Block B stage order and labels, the collapse-line grammar at four/two/one/none, `unknownLine`, "No contacts yet."; Block C bound and note |
| `freelanceVariants.test.ts` | email vs non-email split; a non-email variant never yields a percentage; `replyRate` recomputed, not trusted; "No sends yet — nothing to compare." when every `sends` is 0 |
| `freelanceGaps.test.ts` | the three row kinds; `liveAnchorIds` suppression; overdue rows; bound and `Showing 20 of 41.`; ordering stability |
| `freelanceHealth.test.ts` | the quiet single line; every `evaluateOutreach` warning passed through verbatim; `sites never checked`; snapshot-age formatting |
| `format.test.ts` | age boundaries — 59 min, 60 min, 47 h, 48 h, 6 d, 7 d — for both formats |
| `heroGraphics.test.ts` | `null → empty`; determinism (`f(3)` deep-equals `f(3)`); bounded element count; the ticks→bar threshold |
| `stApi.test.ts` (extended) | **the carry-through**: a full JSON body arrives with no `undefined`; a missing `contacts` block yields `null`, not seven zeros; a non-numeric count yields `null`; `Object.keys(byPipelineStage)` equals `PIPELINE_STAGES` |

Verified by build and by looking at it, because it is not unit-testable: the cascade order of the five stylesheets; that no `fonts.googleapis.com` reference survives into the built HTML; a clean browser console (no CSP violation); the rail degrading to grey badges (force it by pointing `MONGODB_URI` at nothing locally); the `<details>` chevron in the target browser; the generated icon PNG; and the deck's §7 render actually looking finished with today's near-empty data.

Plus the standing trio before anything is called done: `npm test`, `npx tsc --noEmit`, `npm run build`.

---

### 2.10 What must not ship

- **`docs/design/components.html` is never served and never bundled.** It lives under `docs/`, so Next will not serve it — the rule is that it is never copied into `public/` and never imported. Note it also carries a `<link>` to `fonts.googleapis.com`, which would be both a CSP violation and a real third-party request from the app's own origin. Verification line: `git grep -n "components.html" src/ public/` returns nothing.
- **Its `<script>` block does not ship** — the night-sky illustration and the animated constellation. Both are decorative by construction, both need a client component and a `requestAnimationFrame` loop, and the graph they belong to does not exist in P8.
- **No `dangerouslySetInnerHTML`, anywhere.** Every SVG is JSX.
- **No client-side fetching where the server already has the data.** The Freelance page never fetches its own API from the browser. (`/queue` does, today; it is left alone.)
- **No new dependency.** Not `clsx`, not `date-fns`, not an icon package, not `next-themes`. Class lists here are short enough for template strings.
- **No CSP change.** No `font-src` addition (self-hosted fonts are covered by `default-src 'self'`), no `img-src` addition (every SVG is inline), no `style-src` change.
- **No secret near the client.** `CheckNow` posts to a route; `ST_API_SECRET` never leaves the server. No new `NEXT_PUBLIC_*`.
- **No `Schema.Types.Mixed`, no unbounded string** in `HealthSnapshot`.

### 2.11 Fonts under the CSP

`next/font/google` is the right answer: it downloads at build time and serves from `/_next/static`, which is `'self'`, so the CSP needs no change at all — not even a `font-src`, because `default-src 'self'` covers it. The `@font-face` rules ship in a same-origin stylesheet and the preload links are same-origin.

```ts
// src/app/layout.tsx
import { Archivo, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
const display = Archivo({ subsets: ["latin"], display: "swap", variable: "--display" });
const body    = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400","500","600"], display: "swap", variable: "--body" });
const mono    = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--mono" });
// <html className={`${display.variable} ${body.variable} ${mono.variable}`}>
```

Note the variable names are chosen to be **exactly** `--display`, `--body`, `--mono`, matching `components.html`'s `:root` — so every recipe copied from the reference works unchanged. `tokens.css` carries a comment saying those three are defined by `layout.tsx`, not by the token file, because otherwise the next reader will look for them and not find them.

Pitfalls worth knowing before they cost an afternoon:

- **Variable versus static families.** Archivo and JetBrains Mono ship as variable fonts on Google Fonts, so you must *omit* `weight` (one file covers the whole range, usually smaller than two statics). Static families require an explicit `weight` array. Which is which can change; `next/font/google` throws a clear build error either way, so let the build tell you rather than guessing.
- **Build-time network.** The download happens at build. Vercel builds have network access and cache fonts in `.next/cache` across builds, so this is fine — but it is a build-time dependency on Google's CDN, and if that ever fails the fallback is `next/font/local` with nine `.woff2` files committed under `src/app/fonts/`. All three families are OFL-licensed, so redistribution is permitted. Record it as the escape hatch; do not do it pre-emptively.
- **Keep `adjustFontFallback` on** (it is the default). It synthesises a metric-matched local fallback so the `swap` moment does not shift the layout. Do not disable it.
- **`display: "swap"`, not `"optional"`.** `optional` avoids the swap entirely on repeat visits but can silently drop the webfont on a first load — and §3 says the mono is "the part that must stay". A brief metric-matched flash is the cheaper failure.
- **`tabular-nums` is non-negotiable** (§3). It goes on a `.fig` / `.num` class and on `input[type=number]`. Both Archivo and IBM Plex ship `tnum`; JetBrains Mono needs nothing.

---

## 3. Where I disagree with the obvious answer

**① No sparklines on the hero cards, and none of `components.html`'s canvas script. (Strongest.)**
The naive read of §5.2 gives every stat card a curve, because that is what the reference's three cards have. But those curves read a *time series* — spend over 28 days, savings accumulating — and **RikuOS has no time series anywhere**: no money-in log yet, no stored history of draft counts, no coverage curve. A curve under "24 drafts" is a shape invented to look like data, which §1.5 forbids in the same breath it demands data-shaped decoration, and it is exactly what makes a rebuild look "like a template with the same colors". Alternative in §2.6: three shapes matched to the kinds of number we actually hold. Corollary — the `<script>` at the bottom of `components.html` ships nowhere: it is illustration, it needs a client component and an animation loop, and its subject (the memory graph) does not exist in this phase.

**② One global stylesheet; CSS Modules are the wrong tool here, and not only for the old pages. (Strongest.)**
The obvious modern-Next answer is a module per component. It is unimplementable against decision 4 — you cannot scope-hash a class name in a file you may not edit — but that is the least interesting reason. The one that matters for my standing question: Personal and Academics will want the pipeline row and the disclosure row, and a `freelance/Pipeline.module.css` guarantees the second page *copies* them rather than using them. Modules also fork `.btn` into four near-copies today and eight by Academics. The usual objection to going global — name collisions — is answered by a naming rule, not by a build tool. Split by **concern into five files**, not by component into twenty.

**③ `evaluateWatchdog` gets decomposed, not widened. (Strongest.)**
The obvious move is "make `evaluateWatchdog` return every agent and let the digest filter". That is wrong twice: it silently changes the contract of the function composing the one push Riku is meant to trust, and it makes "healthy" representable inside a type whose entire meaning is `Anomaly`. The inverted version is worse — a rail inferring green from *absence* would paint an agent missing from `EXPECTATIONS` as running fine. Extract `classifyAgentRun`, build two total functions on it, and keep `watchdog.test.ts` unchanged as proof the digest did not move.

**④ `<details>`, not `useState` — and the whole route ships exactly two client components.**
The reflex answer to "collapsed by default, opens in place" is a boolean in a client component. It costs a bundle, a hydration pass and a double serialization of every campaign name and reply snippet, and it buys an animation the design does not want. "Is this open" has no consumers, is not persisted, is not shared — it is not application state. The two islands in the route are `NavList` (`usePathname` is client-only) and `CheckNow` (a click is); neither receives freelance data.

**⑤ Do not match §4's top bar item for item.**
§4 lists a `⌘K` search field and notification and theme icon buttons. A search that searches nothing and a theme toggle in a dark-only app are decoration, which D10 forbids — and a portfolio piece is judged harder for a control that does not work than for a bar with fewer things on it. Related and smaller: the shell renders **no `<main>`**, because all three existing pages render their own and decision 4 forbids editing them. Two `<main>` elements in one document is invalid HTML — the kind of thing that only surfaces in an accessibility audit six months later.

---

## 4. Open questions only Riku can answer

1. **The third hero card: hot leads (2 today) or replies waiting (0 today)?** My vote is hot leads — replies waiting is zero right now and is also the list rendered directly below it in Block E, so the page would state the same fact twice. Hot leads is live, non-zero, and stated nowhere else.
2. **The `button` overload on the queue page.** Unclassed `<button>` currently means three things at once (affirmative action, neutral action, active filter segment). Option A, my recommendation and the literal reading of decision 4: one neutral outline treatment for all of them, zero TSX edits, nothing looks wrong but nothing is special. Option B: a three-line `className` diff so Approve becomes the affirmative green outline and the active status filter becomes the solid pill it structurally is. Riku said re-skin only, so I have planned for A.
3. **The old pages' inline headers now duplicate the shell.** `queue/page.tsx` and `settings/page.tsx` each render a header with a cross-link and, on queue, a Log out button — all of which the rail and top bar now provide. Keeping them means two navigations on screen. Removing them is a deletion of about ten lines per page with no behaviour change. My vote is delete; it is the only place where "no TSX changes" and "the shell works" genuinely conflict.
4. **One new string, not in the deck.** When ShikksTracker omits a pipeline stage entirely (rather than reporting it as zero), the page must not collapse it silently into "Nothing yet at…". Proposed wording, in the deck's existing missing-data voice: **`ShikksTracker didn't report call booked.`** Approve or replace.

The campaigns display bound is *not* a question: the deck already writes `Showing 20 of 34 campaigns.`, so 20 is settled by the content.

---

## 5. Risks

**Build-time.**
`next/font/google` needs network access during the build; a Google CDN failure fails the build. Mitigation named, not pre-built: `next/font/local` with committed `.woff2` files. — `icon.tsx` renders through satori, whose SVG handling is the historically fragile part; a failure surfaces as a broken image, not a compile error, so it must be looked at after the first build. — The five stylesheets must be imported from the root layout in a fixed order; imported from anywhere else, the built cascade order is not guaranteed. — `git mv`-ing `queue/` and `settings/` into `(app)/` changes no URL but does invalidate the `.next` cache; a running dev server will 404 once and needs a restart. That will look like a broken move and is not one.

**Runtime.**
The shell's DB read adds one Atlas round trip to every hard page load; Suspense keeps it off the critical path, and the `try/catch` inside `AgentsBlock` is what actually prevents a Mongo outage from blanking a page. Both are required — Suspense alone does not catch a throw. — `router.refresh()` after `Check now` re-renders the server tree; a `<details>` element that gets remounted rather than reconciled would snap shut. Keep the disclosure elements at stable positions and check the behaviour once by hand. — The 15 s `ST_TIMEOUT_MS` is a cron timeout wearing a page's clothes; without the 6 s page-level override, three hung upstream calls could outlive the function budget and hand Riku a platform error page instead of the deck's degraded copy. This is the single most likely way the page fails badly in production. — Font `swap` produces a brief metric-matched flash on a cold load; `adjustFontFallback` keeps it from shifting the layout.

**Maintenance.**
`legacy.css` is deliberately a layer with an expiry date: it exists so queue, settings and login can be re-skinned without being touched, and it should be deleted in the phase where those pages get designed properly. Name that in the file's header comment or it will outlive its reason. — Token drift between §2 and `tokens.css` is the quiet failure mode of any ported design system; the `/* source: DESIGN-INSPO §2 */` comment plus verbatim hexes make it a visible diff. — The `--alert` / `--missing` and `--amber` / `--stale` naming split between the two reference documents will trip whoever copies a recipe out of `components.html`; one comment line in `tokens.css` is the whole fix. — Two age formatters now exist for genuinely different jobs; keeping both in `format.ts` with their boundaries pinned in tests is what stops a third appearing on the Personal page.

**Deferred by decision 1, recorded so the size of the debt is known.** Per §7.1, the parts of *this* build that will need the mobile pass are: the 170px fixed rail (no mobile form — bottom tabs or a sheet, decided later), Block E's `Needs you` rows and Block B's pipeline rows where a fixed multi-column grid must become a stack, and the top bar's `margin-left: auto` group. The hero row already uses `auto-fit / minmax` and needs no work.
