# P8c — The Freelance page: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `/freelance` — blocks A to F on live ShikksTracker data, in every state the deck specifies — as a server component with exactly one client island.

**Architecture:** `page.tsx` is a renderer with no opinions in it. It reads the two local sources in one `try/catch`, fans out to ShikksTracker with `Promise.allSettled` so one dead source degrades one block, hands each result to a Plan B builder, and passes the resulting plain data to eight presentational components whose markup and class names are the mockup's, verbatim. The only client code on the page is `CheckNow`, which posts once and calls `router.refresh()`.

**Tech Stack:** Next.js 16.2.10 (App Router, server components) · React 19.2 · TypeScript `strict`. **No new dependency. No CSP change. No `NEXT_PUBLIC_*`.**

---

## The series, and what this plan consumes unchanged

- **Plan A** — `docs/superpowers/plans/2026-09-07-p8a-shell-and-skin.md`. Its **"Series file map"** section is the authority on every file all three plans touch. This plan implements the rows listed there under **Plan C** and renames nothing. Plan A already shipped: the four stylesheets (`src/styles/components.css` is the class vocabulary this page renders into), `src/components/icons.tsx`, the `(app)` shell, and the placeholder `src/app/(app)/freelance/page.tsx` that **Task 2 rewrites**.
- **Plan B** — `docs/superpowers/plans/2026-09-07-p8b-data-logic-health.md`. Its **"Types Plan C will render"** section is the contract this plan's JSX consumes: `Cell`, `StatCard`, `SayLine`, `BlockA`, `BlockB`, `BlockC`, `BlockD`, `BlockE`, `BlockF`, `FAIL_LINES`, and the two URLs the page builds server-side. **Not one of those types is changed here.** If a block seems to need a different shape, that is a Plan B change and a conversation, not a local edit.

**There are no unit tests in this plan, and that is deliberate.** Every decision the page makes was pushed into Plan B's pure modules and is already pinned there; §8 records that the repo has no route- or component-level tests and P8 adds none. What is left — the cascade, the markup, the disclosure behaviour, the render against real data — is "verified by build and by looking", which is what Task 8 does.

---

## What the mockup fixes, and the three places this plan deviates from it

`docs/design/p8-mockup.html` is the **markup truth**. Specimens **01** (today's real data), **02** (the full render, both disclosures open, all three Block E kinds, the alarm strip) and **04** (whole page down, one source down, not-reported beside a measured zero) between them show every element this page produces. Reproduce the element structure and class names exactly.

**Read `src/styles/components.css` as shipped, not only the mockup** — it carries five numbered differences plus five from the quality review, and one of those matters here: `.stat-top .more` already has `border-bottom:0` because it becomes an `<a>` on this page, so **Plan C edits no CSS at all.**

Three deviations, each forced and each recorded here rather than discovered later:

1. **Block headings are real `<h2 className="fl-h">`, not the mockup's `<span className="fl-h">`,** and the page title is `<h1 className="fl-title">`, not the mockup's `<h3>` with an inline margin. The margin fix in `94eddc9` put `margin:5px 0 0` on `.fl-h` and `margin:0` on `.fl-title`, so a real heading renders identically. The eyebrow stays a `<span className="eyebrow">` above it.
2. **Wrappers that contain an `<h2>` become `<div>`, where the mockup used `<span>`** — `.sumrow` and its first child in Blocks C and D, and `.fl-headrow`'s first child in Block E. A `<span>` is phrasing content and cannot legally contain a heading. Both are grid items, so nothing moves. **The cost, stated plainly: `<summary>`'s content model is phrasing content or a single heading element, so a `<div className="sumrow">` inside it is not strictly conformant HTML.** It renders correctly in every browser and React does not object. The ruling asked for real headings; this is what real headings cost inside a native disclosure. The alternative — keeping `<span className="fl-h">` inside the two `<summary>` elements only — is a one-word change per file if the lead prefers conformance over heading semantics.
3. **The mockup's inline `style="margin-top:6px"` on the `.fl-absent` hot line does not ship.** It is tuning inside specimen 04's `.mini` frame, which is mockup-only chrome. `.fl-absent`'s own `margin-top: var(--sp-3)` applies.

**Everything below the `mockup-only` comment ships nowhere** — `.doc`, `.spec`, `.frame`, `.scroll`, `.pair`, `.side`, `.mini`, `.minipair`, `.tab` and the rest are chrome for a document about the page.

---

## Ground rules for every task in this plan

- **R36 — the two links that leave the app.** The drafts card's `Open ↗` and Block E's business names are plain `<a>` elements with `target="_blank"` and `rel="noopener noreferrer"`. The `↗` is a **literal character**: part of the `Open ↗` text on the card, and inside `<span className="arr">↗</span>` on a Block E row. Never an icon component, never `dangerouslySetInnerHTML`.
- **R25 — the shell already renders the top-bar stamp.** This page adds nothing to the bar, and imports nothing from `_shell/`.
- **Icons carry no intrinsic size.** Every consumer sizes them through an existing CSS rule. `IconInfo` is used only inside `.honesty`, which has `.honesty svg{width:13px;height:13px}`. No other icon is used on this page.
- **Block F's warning marker is the hued dot** (`<i />` inside `.fl-warn`), never `⚠` or any glyph.
- **No client-side fetching anywhere except `CheckNow`'s single POST.** The page never fetches its own API from the browser.
- **`/queue`'s status filters are not touched.** Nothing outside `src/app/(app)/freelance/` changes in this plan.
- **Repo boundary.** `../ShikksTracker` is read-only and its database is never touched.
- Commands are for **Git Bash on Windows** from the repo root. Commits are on `master`, never pushed, and every message ends with the trailer shown in its commit step.
- **`src/styles/*.css` is not edited.** If a rule seems to be missing, stop and raise it — Plan A shipped the vocabulary this page renders into, and a late CSS addition is how the cascade stops being readable in one file.

---

## Task 1: Block F — the health strip and its one control

Built first because it is the only block that survives a total ShikksTracker outage: site results are stored locally. Task 2's page can then render its worst case immediately.

**Files:**
- Create: `src/app/(app)/freelance/_blocks/CheckNow.tsx`
- Create: `src/app/(app)/freelance/_blocks/HealthStrip.tsx`

- [ ] **Step 1: Create `src/app/(app)/freelance/_blocks/CheckNow.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * The only control on the page, and the page's only client code.
 *
 * router.refresh() re-runs the server render and reconciles in place, so the
 * new reading arrives through the same server path as a page load and this
 * island never has to know a snapshot's shape. That is also why the EXISTING
 * READING STAYS ON SCREEN while the check runs: nothing here blanks the strip.
 *
 * `busy` covers the POST and the refresh that follows it — useTransition's
 * isPending is what makes the second half honest, since router.refresh()
 * returns before the server render lands.
 *
 * A failed POST is swallowed on purpose. The strip keeps showing the reading it
 * already had, which is the truthful thing to display: nothing new was learned.
 * The route itself never errors on a rapid second press — a 60-second floor
 * returns the existing reading with 200 rather than a 429.
 */
export default function CheckNow() {
  const router = useRouter();
  const [posting, setPosting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const busy = posting || isPending;

  async function check(): Promise<void> {
    setPosting(true);
    try {
      await fetch("/api/health/sites", { method: "POST" });
    } catch {
      // Nothing to say here that the unchanged reading does not already say.
    }
    setPosting(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button type="button" className="btn" disabled={busy} onClick={() => void check()}>
      {busy ? "Checking…" : "Check now"}
    </button>
  );
}
```

- [ ] **Step 2: Create `src/app/(app)/freelance/_blocks/HealthStrip.tsx`**

```tsx
import { Fragment } from "react";
import type { BlockF } from "@/lib/freelanceHealth";
import CheckNow from "./CheckNow";

/**
 * Silent when all is well: a hairline, one 11px line and the pill, reading as a
 * footer. The moment there is one warning it becomes a bordered card — cards
 * earn their borders, and a structural alarm is quieter and stronger than more
 * colour.
 *
 * The marker is the system's hued dot, never a glyph: U+26A0 renders in emoji
 * presentation on several platforms, and a colour glyph has no place in a
 * monochrome instrument panel.
 *
 * Markup is specimen 01 (quiet) and specimen 02 (alarm) of
 * docs/design/p8-mockup.html, verbatim.
 */
export default function HealthStrip({ strip }: { strip: BlockF }) {
  if (strip.kind === "quiet") {
    return (
      <div className="fl-health quiet">
        <span className="line">
          {strip.parts.map((part, index) => (
            <Fragment key={part.text}>
              {index > 0 && <i>·</i>}
              {part.aged ? <span className="aged">{part.text}</span> : part.text}
            </Fragment>
          ))}
        </span>
        <CheckNow />
      </div>
    );
  }

  return (
    <div className="fl-health alarm">
      {strip.warnings.map((warning) => (
        <div className={`fl-warn is-${warning.tone}`} key={warning.text}>
          <i />
          <span>{warning.text}</span>
        </div>
      ))}
      {strip.fine.length > 0 && (
        <p className="fl-fine">
          {strip.fine.map((text, index) => (
            <Fragment key={text}>
              {index > 0 && <i>·</i>}
              {text}
            </Fragment>
          ))}
        </p>
      )}
      <div className="fl-stamp">
        <span className={strip.stamp.aged ? "line aged" : "line"}>{strip.stamp.text}</span>
        <CheckNow />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/freelance/_blocks/CheckNow.tsx" "src/app/(app)/freelance/_blocks/HealthStrip.tsx"
git commit -F - << 'MSG'
feat(p8c): Block F — the health strip and Check now

Quiet form is a footer; one warning turns it into a bordered card. The
marker is the system's hued dot, never a glyph.

CheckNow is the page's only client code: one POST, then router.refresh(),
so the new reading arrives through the same server path as a page load and
the island never learns a snapshot's shape. The existing reading stays on
screen throughout, and busy covers the refresh as well as the POST.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 2: `page.tsx` — the data layer, the whole-page-down state, and the strip

The first renderable page. Blocks A to E arrive in Tasks 3 to 7; until then the page renders the title, the whole-page-down statement when it applies, and the strip.

**Three phases, in this order, and the order is load-bearing:**

1. **The local reads**, in one `try/catch`: `connectDB`, `getOsSettings` (for `chaserNDays` and `monitoringEnabled`) and `getHealthSnapshot`. A failure here must degrade three things and blank nothing.
2. **The three ShikksTracker calls**, in parallel, through `Promise.allSettled` — that word *is* the per-block degradation mechanism.
3. **The gap read**, which needs both the attention result and the database, so it cannot join phase 1.

**Files:**
- Modify: `src/app/(app)/freelance/page.tsx` (replacing Plan A's placeholder)

- [ ] **Step 1: Replace `src/app/(app)/freelance/page.tsx`**

```tsx
import { connectDB } from "@/lib/db";
import { getOsSettings } from "@/lib/osSettings";
import { getHealthSnapshot } from "@/lib/healthSnapshot";
import type { StoredHealth } from "@/lib/healthSnapshot";
import { fetchLiveAnchorIds } from "@/lib/queue";
import { AGENT_STALE_HOURS } from "@/lib/watchdog";
import { evaluateOutreach } from "@/lib/outreachHealth";
import {
  ATTENTION_LIMIT,
  ST_PAGE_TIMEOUT_MS,
  fetchAttention,
  fetchSummary,
  fetchVariantStats,
  readStConfig,
} from "@/lib/stApi";
import { FAIL_LINES, buildBlockA, buildBlockB, buildBlockC } from "@/lib/freelanceView";
import { buildBlockD } from "@/lib/freelanceVariants";
import { buildBlockE } from "@/lib/freelanceGaps";
import { buildHealthStrip } from "@/lib/freelanceHealth";
import HealthStrip from "./_blocks/HealthStrip";

/**
 * Every figure on this page is "what is true right now", so there is nothing to
 * cache and nothing to revalidate.
 */
export const dynamic = "force-dynamic";

/**
 * A second belt behind ST_PAGE_TIMEOUT_MS. Three hung calls plus two round
 * trips to Atlas must never outlive the function and hand Riku a Vercel error
 * page instead of the deck's `Couldn't reach ShikksTracker.`
 */
export const maxDuration = 30;

/** OsSettings' own default, used only when the settings read failed. */
const DEFAULT_CHASER_N_DAYS = 4;

/** `PromiseSettledResult` -> the value, or null. */
function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

export default async function FreelancePage() {
  const now = new Date();

  // The two ShikksTracker URLs are built HERE, server-side, and passed down as
  // plain strings. ST_API_BASE_URL never reaches a client bundle and no view
  // model reads an environment variable. A missing config throws, and the three
  // calls below would throw for the same reason, so the page lands in its
  // whole-page-down state and the links never render.
  let baseUrl = "";
  try {
    baseUrl = readStConfig().baseUrl;
  } catch {
    // Left empty on purpose; see above.
  }

  // --- Phase 1: the local reads, in ONE try/catch ---------------------------
  //
  // A database failure must never blank the route. It degrades exactly three
  // things: the gap count reads `—` (`couldn't load`), the stored site reading
  // is absent, and the monitoring switch is unknown. Everything ShikksTracker
  // answers still renders.
  let chaserNDays = DEFAULT_CHASER_N_DAYS;
  let monitoringEnabled = false;
  let snapshot: StoredHealth | null = null;
  let dbOk = false;
  try {
    await connectDB();
    const [settings, stored] = await Promise.all([getOsSettings(), getHealthSnapshot()]);
    chaserNDays = settings.chaserNDays;
    monitoringEnabled = settings.monitoringEnabled;
    snapshot = stored;
    dbOk = true;
  } catch (err) {
    console.error("[freelance] local reads failed:", err);
  }

  // --- Phase 2: ShikksTracker, in parallel ---------------------------------
  //
  // Promise.allSettled, not Promise.all — that is the whole per-block
  // degradation mechanism in one word. `cache: "no-store"` is already set
  // inside every stApi fetch.
  // No explicit generic: Promise.allSettled's `T extends readonly unknown[] | []`
  // constraint makes TypeScript infer a TUPLE from the array literal, so each
  // destructured result already carries its own type.
  const [summaryResult, attentionResult, variantsResult] = await Promise.allSettled([
    fetchSummary(ST_PAGE_TIMEOUT_MS),
    fetchAttention(chaserNDays, ATTENTION_LIMIT, ST_PAGE_TIMEOUT_MS),
    fetchVariantStats(ST_PAGE_TIMEOUT_MS),
  ]);

  const summary = settled(summaryResult);
  const attention = settled(attentionResult);
  const variants = settled(variantsResult);

  // --- Phase 3: the gap read, which needs both ------------------------------
  //
  // fetchLiveAnchorIds is the query the chaser uses for idempotency and this
  // page uses for suppression. Its own try/catch, because it can only run after
  // phase 2 and a failure here means one thing: the gap list is unavailable.
  let liveAnchorIds: Set<string> | null = null;
  if (attention !== null) {
    if (dbOk) {
      try {
        liveAnchorIds = await fetchLiveAnchorIds(
          attention.repliedUnanswered.map((item) => item.replyToLogId).filter(Boolean)
        );
      } catch (err) {
        console.error("[freelance] live-anchor read failed:", err);
      }
    }
  }

  // --- The view models ------------------------------------------------------

  const blockE = buildBlockE({
    now,
    // A gap list built without the suppression set would repeat leads that
    // already have a draft in /queue, which is the one thing this block must
    // never do — so a failed anchor read reads as "couldn't load", not as an
    // unsuppressed list.
    repliedUnanswered: liveAnchorIds === null ? null : attention!.repliedUnanswered,
    overdueActions: attention?.overdueActions ?? null,
    liveAnchorIds: liveAnchorIds ?? new Set<string>(),
    contactsBaseUrl: `${baseUrl}/contacts`,
  });

  // Block A's third card renders the SAME computed count Block E renders, by
  // construction rather than by coincidence: `rows` gives the count, `empty`
  // gives 0, and anything else is an absence.
  const needsYouCount =
    blockE.kind === "rows" ? blockE.count : blockE.kind === "empty" ? 0 : null;

  const blockA = buildBlockA({
    queue: summary?.queue ?? { drafts: null, approved: null },
    contacts: summary?.contacts ?? null,
    needsYouCount,
    draftsUrl: `${baseUrl}/review`,
  });
  const blockB = buildBlockB(summary?.contacts ?? null);
  const blockC = buildBlockC(summary?.campaigns ?? null);
  const blockD = buildBlockD(variants);

  const strip = buildHealthStrip({
    now,
    findings: summary === null ? null : evaluateOutreach(now, summary),
    engineLastRunAt: summary?.engine.lastRunAt ?? null,
    snapshot,
    monitoringEnabled,
    staleHours: AGENT_STALE_HOURS,
  });

  // Whole page down is ALL THREE calls failing, not one. If any source
  // answered, every block renders and only the dead ones carry their own
  // sentence — which is what "one source down" means. The strip survives
  // either way, because site results are stored locally.
  const wholePageDown = summary === null && attention === null && variants === null;

  return (
    <main className="app-content">
      <div className="fl">
        <h1 className="fl-title">Freelance</h1>

        {wholePageDown ? (
          <div className="fl-fail">
            <i />
            <div>
              <div className="said">{FAIL_LINES.page.said}</div>
              <div className="because">{FAIL_LINES.page.because}</div>
            </div>
          </div>
        ) : null}

        <HealthStrip strip={strip} />
      </div>
    </main>
  );
}
```

**Two lines worth pausing on.**

`repliedUnanswered: liveAnchorIds === null ? null : attention!.repliedUnanswered` — a `null` there is what makes Block E say `Couldn't load what's waiting.` It covers both "the attention call failed" and "the database read failed", and the second is deliberate: a list built without the suppression set would repeat leads that already have a draft in `/queue`.

`overdueActions: attention?.overdueActions ?? null` — the field is optional in the contract (`fetchAttention` omits it when the API does), and Plan B's builder already treats `null` as "no overdue rows" rather than a failure.

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. (`blockA`, `blockB`, `blockC` and `blockD` are computed and not yet rendered; TypeScript does not error on unused locals, and they are consumed in Tasks 3–6. `npm run lint` is run at the end of Task 7, once every one has a consumer.)

Run: `npm run build`
Expected: `✓ Compiled successfully`, with `/freelance` listed as dynamic (`ƒ`).

- [ ] **Step 3: Look at it once**

Run: `npm run dev`, sign in, open `http://localhost:3000/freelance`.
Expected: the rail and top bar from Plan A's shell, the `Freelance` title at 24px, and the quiet health strip at the bottom with a working `Check now`. Press it: the label becomes `Checking…`, the button disables, and the stamp updates. Press it twice inside a minute: **no error appears** — the second press returns the existing reading. Stop the server with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/freelance/page.tsx"
git commit -F - << 'MSG'
feat(p8c): the Freelance page's data layer and its whole-page-down state

Three phases: the local reads in one try/catch, the three ShikksTracker
calls through Promise.allSettled, then the gap read that needs both. A
database failure degrades the gap count, the stored reading and the
monitoring switch, and blanks nothing.

Whole page down is all three calls failing, not one — if any source
answered, every block renders and only the dead ones carry their own
sentence. The strip survives either way because site results are local.

Block A's needs-you card takes the same computed count Block E renders, by
construction: rows gives the count, empty gives 0, anything else is an
absence.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 3: Block A — the hero row and the statement lines

**Files:**
- Create: `src/app/(app)/freelance/_blocks/HeroRow.tsx`
- Create: `src/app/(app)/freelance/_blocks/StateOfPlay.tsx`
- Modify: `src/app/(app)/freelance/page.tsx`

- [ ] **Step 1: Create `src/app/(app)/freelance/_blocks/HeroRow.tsx`**

```tsx
import type { StatCard } from "@/lib/freelanceView";

/**
 * Three cards that never disappear: hue drains, structure stays. The tone comes
 * from the view model, which is where the measured-zero / never-measured
 * distinction is decided; this file only renders it.
 *
 * The track's width is an inline style because it IS the datum — a percentage
 * cannot live in a stylesheet. It is the one inline style on the page.
 *
 * R36: the drafts card's `Open ↗` is a plain <a> that leaves the app, so it
 * carries target and rel. The ↗ is a literal character in the link text, never
 * an icon component. .stat-top .more already carries border-bottom:0 in
 * components.css precisely because it becomes an anchor here.
 *
 * Markup is specimen 01 / 02 of docs/design/p8-mockup.html, verbatim.
 */
export default function HeroRow({ cards }: { cards: StatCard[] }) {
  return (
    <div className="stats">
      {cards.map((card) => (
        <div className={`stat ${card.tone}`} key={card.key}>
          <div className="stat-top">
            <span className="lbl">{card.label}</span>
            {card.href !== null && (
              <a
                className="more"
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open ↗
              </a>
            )}
          </div>
          <div className="fig">{card.figure}</div>
          {card.trackPercent !== null && (
            <div className="track">
              <i style={{ width: `${card.trackPercent}%` }} />
            </div>
          )}
          <div className="sub">{card.caption}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(app)/freelance/_blocks/StateOfPlay.tsx`**

```tsx
import type { SayLine } from "@/lib/freelanceView";

/**
 * The statement lines under the hero row. They are sentences, and they
 * disappear entirely when they have nothing to say — they never render as a
 * zero, and there is no empty slot left behind.
 *
 * The figure sits in <b> and the rest is plain text, separated by one space:
 * `<b>3</b> approved, not yet sent`. A line with no figure — today's
 * `Nothing waiting on you.` — renders the text alone.
 */
export default function StateOfPlay({ lines }: { lines: SayLine[] }) {
  if (lines.length === 0) return null;

  return (
    <>
      {lines.map((line) => (
        <p className="fl-say" key={line.text}>
          {line.figure !== null ? (
            <>
              <b>{line.figure}</b> {line.text}
            </>
          ) : (
            line.text
          )}
        </p>
      ))}
    </>
  );
}
```

- [ ] **Step 3: Render Block A in `page.tsx`**

Add the two imports beside the `HealthStrip` one:

```tsx
import HeroRow from "./_blocks/HeroRow";
import StateOfPlay from "./_blocks/StateOfPlay";
```

Then replace the whole-page-down ternary and everything after it, inside `<div className="fl">`, with:

```tsx
        {wholePageDown ? (
          <div className="fl-fail">
            <i />
            <div>
              <div className="said">{FAIL_LINES.page.said}</div>
              <div className="because">{FAIL_LINES.page.because}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="fl-body">
              <HeroRow cards={blockA.cards} />
              <StateOfPlay lines={blockA.lines} />
            </div>
          </>
        )}

        <HealthStrip strip={strip} />
```

Tasks 4 to 7 add their blocks inside that same fragment, in order.

- [ ] **Step 4: Type-check, build and look**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

Run: `npm run dev` and open `/freelance`.
Expected, against today's real data: three cards on one row — a violet `Drafts` card with `Open ↗` top-right, a hueless `Contacts` card with a 4px track under its figure, and a drained `Needs you` card reading `0` with the caption `nothing waiting` still legible. **All three figures sit on one baseline.** Clicking `Open ↗` opens ShikksTracker's review page in a new tab. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/freelance/_blocks/HeroRow.tsx" "src/app/(app)/freelance/_blocks/StateOfPlay.tsx" "src/app/(app)/freelance/page.tsx"
git commit -F - << 'MSG'
feat(p8c): Block A — the hero row and its statement lines

Three cards that never disappear; the tone comes from the view model, which
is where the measured-zero versus never-measured distinction is decided.
The track's width is the page's one inline style, because a percentage is
the datum and cannot live in a stylesheet.

R36: the drafts card's Open link is a plain anchor with target and rel, and
the arrow is a literal character rather than an icon.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 4: Block B — the pipeline

**Files:**
- Create: `src/app/(app)/freelance/_blocks/Pipeline.tsx`
- Modify: `src/app/(app)/freelance/page.tsx`

- [ ] **Step 1: Create `src/app/(app)/freelance/_blocks/Pipeline.tsx`**

```tsx
import type { BlockB } from "@/lib/freelanceView";

/**
 * Rows, not a strip: a label left, a count right, a hairline above each and
 * none above the first. No boxes, no bars, no funnel.
 *
 * The two notes under the rows are the same shape in two inks because they are
 * two different claims — .fl-note is a MEASURED emptiness, .fl-absent is a
 * field that never arrived. The view model decides which; this file renders it.
 *
 * The middot in the summary line is an <i> with 5px either side and NO literal
 * spaces in the markup, exactly as the mockup writes it.
 *
 * Markup is specimen 01 / 02 / 04 of docs/design/p8-mockup.html, verbatim.
 */
export default function Pipeline({ block }: { block: BlockB }) {
  return (
    <section className="fl-sect">
      <span className="eyebrow">Pipeline</span>
      <h2 className="fl-h">Your pipeline</h2>

      {block.kind === "failed" && (
        <div className="fl-fail">
          <i />
          <div>
            <div className="said">{block.line}</div>
          </div>
        </div>
      )}

      {block.kind === "empty" && <p className="fl-empty">{block.line}</p>}

      {block.kind === "stages" && (
        <>
          <p className="fl-sum">
            <b>{block.summary.total}</b> {block.summary.totalWord}
            {block.summary.hot !== null && (
              <>
                <i>·</i>
                <b>{block.summary.hot}</b> {block.summary.hotWord}
              </>
            )}
          </p>
          {block.hotAbsentNote !== null && (
            <p className="fl-absent">{block.hotAbsentNote}</p>
          )}
          <div className="fl-stages">
            {block.rows.map((row) => (
              <div className="fl-stage" key={row.key}>
                <span className="nm">{row.label}</span>
                <span className="ct">{row.count}</span>
              </div>
            ))}
          </div>
          {block.emptyNote !== null && <p className="fl-note">{block.emptyNote}</p>}
          {block.absentNote !== null && <p className="fl-absent">{block.absentNote}</p>}
        </>
      )}
    </section>
  );
}
```

**One markup note worth keeping.** `<b>30</b> {totalWord}` renders as `30 contacts` with a real space between the figure and the word — that space is a JSX text node and is preserved. The middot has none: `<i>·</i>` carries its own 5px margins from `.fl-sum i`, and a literal space either side would double them.

- [ ] **Step 2: Render it in `page.tsx`**

Add the import:

```tsx
import Pipeline from "./_blocks/Pipeline";
```

and add the block inside the fragment, directly after the `.fl-body` div:

```tsx
            <Pipeline block={blockB} />
```

- [ ] **Step 3: Type-check, build and look**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

Run: `npm run dev` and open `/freelance`.
Expected, against today's real data: a mono `PIPELINE` eyebrow, `Your pipeline` at 19px 5px under it, the line `30 contacts · 2 hot` with tabular figures, three rows (`Not started 25`, `Contacted 3`, `Replied 2`) with hairlines between but **none above the first**, and the note `Nothing yet at call booked, proposal sent, won or lost`. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/freelance/_blocks/Pipeline.tsx" "src/app/(app)/freelance/page.tsx"
git commit -F - << 'MSG'
feat(p8c): Block B — the pipeline rows

Rows, not a strip: no boxes, no bars, no funnel, and no hairline above the
first row. The two notes under the rows are the same shape in two inks
because they are two different claims — a measured emptiness and a field
that never arrived.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 5: Block C — campaigns, in a native disclosure

Closed by default. **Zero client JavaScript:** native `<details>` gives correct keyboard behaviour, correct `aria-expanded`, find-on-page expansion, and nothing to break under hydration because there is none. "Is this section open" has no consumers, no persistence and no sharing — it is not application state.

**`open` is never passed here.** The element is closed on first render and the user owns it from then on. Passing `open={false}` on every render would risk React writing the attribute back and snapping the disclosure shut after `router.refresh()`.

**Files:**
- Create: `src/app/(app)/freelance/_blocks/Campaigns.tsx`
- Modify: `src/app/(app)/freelance/page.tsx`

- [ ] **Step 1: Create `src/app/(app)/freelance/_blocks/Campaigns.tsx`**

```tsx
import type { BlockC } from "@/lib/freelanceView";
import { IconInfo } from "@/components/icons";

/**
 * A native <details>, closed by default. The chevron is a CSS ::after box on
 * .sumrow that rotates on [open]; there is no icon and no script.
 *
 * The <div className="sumrow"> is a div rather than the mockup's span because
 * it contains a real <h2>, and a span is phrasing content. Both are grid items,
 * so nothing moves.
 *
 * IconInfo carries no intrinsic size: `.honesty svg` gives it 13px. That rule
 * is the ONLY thing sizing it, which is why the icon is used nowhere else.
 *
 * Sorted by Sent, highest first, bounded at 20 — both decided in the view
 * model. No rate column, ever. No hue anywhere.
 *
 * Markup is specimen 02 of docs/design/p8-mockup.html, verbatim.
 */
export default function Campaigns({ block }: { block: BlockC }) {
  const head = (
    <div className="sumrow">
      <div>
        <span className="eyebrow">Campaigns</span>
        <h2 className="fl-h">Your campaigns</h2>
      </div>
      <span className="fl-count">{block.kind === "table" ? block.count : ""}</span>
    </div>
  );

  // A block with nothing to disclose is not a disclosure: a chevron that opens
  // onto one sentence is a control that lies about having content.
  if (block.kind !== "table") {
    return (
      <section className="fl-sect">
        <span className="eyebrow">Campaigns</span>
        <h2 className="fl-h">Your campaigns</h2>
        {block.kind === "failed" ? (
          <div className="fl-fail">
            <i />
            <div>
              <div className="said">{block.line}</div>
            </div>
          </div>
        ) : (
          <p className="fl-empty">{block.line}</p>
        )}
      </section>
    );
  }

  return (
    <details className="disclose fl-sect">
      <summary>{head}</summary>
      <div className="fl-open">
        <div className="fl-table is-campaigns">
          <div className="fl-thead">
            {block.headers.map((header) => (
              <span key={header}>{header}</span>
            ))}
          </div>
          {block.rows.map((row) => (
            <div className="fl-trow" key={row.id}>
              <span className="nm">{row.name}</span>
              {row.cells.map((cell, index) => (
                <span
                  className={cell.tone === "value" ? undefined : cell.tone}
                  key={block.headers[index + 1]}
                >
                  {cell.text}
                </span>
              ))}
            </div>
          ))}
        </div>
        {block.bound !== null && <p className="fl-bound">{block.bound}</p>}
        <p className="honesty">
          <IconInfo />
          {block.honesty}
        </p>
      </div>
    </details>
  );
}
```

**Why the cells are keyed by their header.** `block.headers[index + 1]` is `Sent` / `Opened` / `Clicked` / `Replied` — stable, unique within a row, and it fails loudly if the view model ever returns a different number of cells than headers. An array index would silently tolerate that mismatch.

- [ ] **Step 2: Render it in `page.tsx`**

Add the import:

```tsx
import Campaigns from "./_blocks/Campaigns";
```

and add the block after `<Pipeline …/>`:

```tsx
            <Campaigns block={blockC} />
```

- [ ] **Step 3: Type-check, build and look**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

Run: `npm run dev` and open `/freelance`.
Expected: a collapsed row reading `CAMPAIGNS` / `Your campaigns` with `2` to its right and a chevron pointing down-right. Click it — it opens in place, the chevron flips, the count dims, and a five-column table appears with `Campaign · Sent · Opened · Clicked · Replied`, `Test One` above `Test number 2`, zeros in `--ink-4`, and the tracking-pixel note with a 13px info glyph under it. Press Tab to it and Enter — it toggles. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/freelance/_blocks/Campaigns.tsx" "src/app/(app)/freelance/page.tsx"
git commit -F - << 'MSG'
feat(p8c): Block C — campaigns in a native disclosure

Native <details>, closed by default, zero client JavaScript: correct
keyboard behaviour, correct aria-expanded, find-on-page expansion, and
nothing to break under hydration because there is none. `open` is never
passed, so the user owns the state and a router.refresh() cannot snap it
shut.

Empty and failed states are not disclosures at all — a chevron that opens
onto one sentence is a control that lies about having content.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 6: Block D — approach performance

The same disclosure, with **no count** in the summary: the collapsed line carries the meaning instead. `open` **is** passed here, from the view model's `defaultOpen` (R31) — open by default only while every approach has zero sends.

**Files:**
- Create: `src/app/(app)/freelance/_blocks/Approaches.tsx`
- Modify: `src/app/(app)/freelance/page.tsx`

- [ ] **Step 1: Create `src/app/(app)/freelance/_blocks/Approaches.tsx`**

```tsx
import type { BlockD } from "@/lib/freelanceVariants";
import { IconInfo } from "@/components/icons";

/**
 * Two groups, always, at equal typographic weight. The `Not measurable` group
 * keeps its rate column full of em-dashes and drops the replies column
 * entirely; its explanation sits UNDER the group heading and ABOVE its rows,
 * never below as a footnote.
 *
 * `open` is passed from the view model's defaultOpen (R31): open only while
 * every approach has zero sends, which is today's state and the clearest single
 * demonstration on the page of "not measurable is not zero". It is an INITIAL
 * value, not a controlled one — the prop does not change between renders, so
 * React never writes the attribute back and a router.refresh() cannot close a
 * block the reader opened.
 *
 * The empty <span className="fl-count" /> is deliberate: .sumrow is a
 * three-column grid whose third column is the chevron, so the slot has to
 * exist even though this block carries no count.
 *
 * Markup is specimen 01 / 02 of docs/design/p8-mockup.html, verbatim.
 */
export default function Approaches({ block }: { block: BlockD }) {
  if (block.kind !== "groups") {
    return (
      <section className="fl-sect">
        <span className="eyebrow">Approach performance</span>
        <h2 className="fl-h">Your approaches</h2>
        {block.kind === "failed" ? (
          <div className="fl-fail">
            <i />
            <div>
              <div className="said">{block.line}</div>
            </div>
          </div>
        ) : (
          <p className="fl-empty">{block.line}</p>
        )}
      </section>
    );
  }

  return (
    <details className="disclose fl-sect" open={block.defaultOpen}>
      <summary>
        <div className="sumrow">
          <div>
            <span className="eyebrow">Approach performance</span>
            <h2 className="fl-h">Your approaches</h2>
          </div>
          <span className="fl-count" />
        </div>
        <span className="fl-collapsed">
          {block.collapsed.kind === "statement" ? (
            block.collapsed.text
          ) : (
            <>
              <span className="nm">{block.collapsed.name}</span>
              <b>{block.collapsed.rate}</b>
            </>
          )}
        </span>
      </summary>

      <div className="fl-open">
        {block.groups.map((group, groupIndex) => (
          <div className="fl-group" key={group.eyebrow}>
            <span className="eyebrow">{group.eyebrow}</span>
            {group.explain !== null && <p className="fl-explain">{group.explain}</p>}
            <div className="fl-table">
              <div className="fl-thead">
                {group.headers.map((header) => (
                  <span key={header}>{header}</span>
                ))}
              </div>
              {group.rows.map((row) => (
                <div className="fl-trow" key={row.key}>
                  <span className="nm">{row.name}</span>
                  {row.cells.map((cell, index) => (
                    <span
                      className={cell.tone === "value" ? undefined : cell.tone}
                      key={group.headers[index + 1]}
                    >
                      {cell.text}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            {/* R27: the honesty note belongs under the MEASURED group only, and
                only when at least one rate is actually printed. The view model
                decides the second half; this decides the first. */}
            {groupIndex === 0 && block.honesty !== null && (
              <p className="honesty">
                <IconInfo />
                {block.honesty}
              </p>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
```

- [ ] **Step 2: Render it in `page.tsx`**

Add the import:

```tsx
import Approaches from "./_blocks/Approaches";
```

and add the block after `<Campaigns …/>`:

```tsx
            <Approaches block={blockD} />
```

- [ ] **Step 3: Type-check, build and look**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

Run: `npm run dev` and open `/freelance`.
Expected, against today's real data: the block is **open** (R31 — every approach has zero sends), its chevron points up-right, and the collapsed line is hidden. Two groups: `MEASURED — EMAIL` with a four-column table whose two email rows read `—` for rate and `0` for sends and replies, then `NOT MEASURABLE` with its explanation line above a three-column table whose two Facebook rows read `—` and `0`. **No honesty note anywhere** — no rate is printed, so R27 withholds it. Close the block: the collapsed line reads `No sends yet — nothing to compare.` Stop the server.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/freelance/_blocks/Approaches.tsx" "src/app/(app)/freelance/page.tsx"
git commit -F - << 'MSG'
feat(p8c): Block D — two groups, and the R31 default-open rule

Open by default only while every approach has zero sends — today's state,
and the clearest single demonstration on the page that not measurable is not
zero. The prop is an initial value, not a controlled one, so a refresh
cannot close a block the reader opened.

The honesty note sits under the measured group only, and only when the view
model actually printed a rate (R27). The empty fl-count span is deliberate:
.sumrow is a three-column grid and the slot must exist.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 7: Block E — what is waiting on you

**The row itself is not an anchor.** A whole clickable row on a page whose promise is "nothing here acts on a lead" is the wrong affordance; only the business name links out.

**Files:**
- Create: `src/app/(app)/freelance/_blocks/NeedsYou.tsx`
- Modify: `src/app/(app)/freelance/page.tsx`

- [ ] **Step 1: Create `src/app/(app)/freelance/_blocks/NeedsYou.tsx`**

```tsx
import type { BlockE } from "@/lib/freelanceGaps";

/**
 * Rows built only from fields that exist. An overdue follow-up's channel slot
 * is EMPTY — inapplicable, not unmeasured — so it renders an empty <span/> to
 * hold the grid's second column rather than a tag or an em-dash.
 *
 * R36: the business name is a plain <a> leaving the app, with a persistent ↗ as
 * a literal character in a .arr span. The ROW is not an anchor.
 *
 * `Nothing waiting.` is left-aligned where content lives — never centred, never
 * in a dashed box, never with an action pill. It is today's state and it must
 * look intentional.
 *
 * Markup is specimen 01 (empty) and specimen 02 (all three kinds) of
 * docs/design/p8-mockup.html, verbatim.
 */
export default function NeedsYou({ block }: { block: BlockE }) {
  if (block.kind !== "rows") {
    return (
      <section className="fl-sect">
        <span className="eyebrow">Needs you</span>
        <h2 className="fl-h">Waiting on you</h2>
        {block.kind === "failed" ? (
          <div className="fl-fail">
            <i />
            <div>
              <div className="said">{block.line}</div>
            </div>
          </div>
        ) : (
          <p className="fl-empty">{block.line}</p>
        )}
      </section>
    );
  }

  return (
    <section className="fl-sect">
      <div className="fl-headrow">
        <div>
          <span className="eyebrow">Needs you</span>
          <h2 className="fl-h">Waiting on you</h2>
        </div>
        <span className="fl-count">{block.count}</span>
      </div>
      <div className="fl-rows">
        {block.rows.map((row) => (
          <div className="fl-row" key={row.id}>
            <div>
              <a
                className="fl-biz"
                href={row.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {row.businessName} <span className="arr">↗</span>
              </a>
              <div className={row.waitingIsStale ? "pwhen is-stale" : "pwhen"}>
                {row.waiting}
              </div>
              {row.snippet !== null && <div className="fl-snip">{row.snippet}</div>}
              {row.reason !== null && <div className="fl-why">{row.reason}</div>}
            </div>
            {row.channel !== null ? <span className="tag">{row.channel}</span> : <span />}
          </div>
        ))}
      </div>
      {block.bound !== null && <p className="fl-bound">{block.bound}</p>}
    </section>
  );
}
```

- [ ] **Step 2: Render it in `page.tsx`**

Add the import:

```tsx
import NeedsYou from "./_blocks/NeedsYou";
```

and add the block after `<Approaches …/>`, so the fragment now reads, in deck order:

```tsx
          <>
            <div className="fl-body">
              <HeroRow cards={blockA.cards} />
              <StateOfPlay lines={blockA.lines} />
            </div>
            <Pipeline block={blockB} />
            <Campaigns block={blockC} />
            <Approaches block={blockD} />
            <NeedsYou block={blockE} />
          </>
```

- [ ] **Step 3: Type-check, lint, build and look**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run lint`
Expected: no errors — every view model computed in Task 2 now has a consumer.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

Run: `npm run dev` and open `/freelance`.
Expected, against today's real data: `NEEDS YOU` / `Waiting on you`, no count, and the single line `Nothing waiting.` **left-aligned under the heading**, 20px below it, in `--ink-3`. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/freelance/_blocks/NeedsYou.tsx" "src/app/(app)/freelance/page.tsx"
git commit -F - << 'MSG'
feat(p8c): Block E — what is waiting on you, and nothing else

Rows built only from fields that exist. The overdue row's channel slot is an
empty span rather than a tag or an em-dash: inapplicable is not unmeasured.

R36: only the business name links out, never the row — a whole clickable row
on a page whose promise is "nothing here acts on a lead" is the wrong
affordance. "Nothing waiting." is left-aligned where content lives, because
it is today's state and it must look intentional.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 8: Verification

Run every check in order. **Do not claim completion until each one has produced the expected output in front of you.** One item at the end is deliberately *not* claimable by this plan; read step 6 before starting.

**Files:** none modified.

- [ ] **Step 1: The standing trio**

Run: `npm test`
Expected: every suite passes — Plan A's and Plan B's, all still green. This plan adds no test file, and it must not have broken one.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run build`
Expected: `✓ Compiled successfully`, with `/freelance` and `/api/health/sites` in the route table and `/freelance` marked dynamic (`ƒ`).

- [ ] **Step 2: The two greps from spec §9**

Run: `git grep "var(--alert)\|var(--amber)" src/`
Expected: **no output**, exit code 1.

The stylesheets name `components.html` in their comments on purpose — that is the audit trail the port left — so the second grep looks for a real reference rather than the bare name. This is Plan A's Task 13 step 3 form, unchanged:

Run: `git grep -n -E "(from|import|href|src|url)[[:space:]]*[:=(]?[[:space:]]*[\"'][^\"']*components\.html" src/ public/`
Expected: **no output**, exit code 1.

- [ ] **Step 3: The rules this plan promised to keep**

Run: `git grep -n "dangerouslySetInnerHTML\|NEXT_PUBLIC" "src/app/(app)/freelance/"`
Expected: **no output**, exit code 1.

Run: `git grep -n "\"use client\"" "src/app/(app)/freelance/"`
Expected: exactly one line — `src/app/(app)/freelance/_blocks/CheckNow.tsx`.

Run: `git grep -n "fetch(" "src/app/(app)/freelance/"`
Expected: exactly one line, the POST inside `CheckNow.tsx`. The page never fetches its own API from the browser.

Run: `git diff --stat 169c21e..HEAD -- package.json package-lock.json next.config.ts src/styles/ src/proxy.ts "src/app/(app)/queue/"`
Expected: **no output.** No new dependency, no CSP change, no stylesheet edit, no proxy edit, and `/queue`'s status filters untouched.

Run: `git -C ../ShikksTracker status --porcelain`
Expected: **no output.**

- [ ] **Step 4: By eye against the mockup, at 1240px, on real data**

`npm run dev` reads `.env.local`, so the local server calls the **real** ShikksTracker API. Open `docs/design/p8-mockup.html` in one Chrome tab and `http://localhost:3000/freelance` in another, with the window at **1240px** wide (170px rail + 28px + 920px column + 28px + scrollbar), and compare against **specimen 01**:

1. **The hero row.** Three cards, one row, equal heights. All three **figures share one baseline** and all three captions start on one line — including when the `Needs you` caption is the short `nothing waiting`.
2. **The three tones.** Drafts violet on its tinted card; Contacts near-white on a plain `--raised` card; Needs you fully drained at `0` with its caption still `--ink-3` and clearly brighter than the figure above it.
3. **The track.** A 4px bar under the contacts figure only, ground `#1A1E25`, fill `--ink-4`, **no hue**, and its width matches `not_started / total`.
4. **The two disclosures.** Campaigns closed with its count at the right and a chevron pointing down-right; Approaches **open** with its chevron up-right and its collapsed line hidden. Click each: they open and close in place, the chevron rotates over ~140ms, and the campaigns count dims while open.
5. **Block D open.** Two groups at equal weight, `MEASURED — EMAIL` above `NOT MEASURABLE`, the explanation line under the second heading and above its rows, four columns in the first table and three in the second, every rate an em-dash in `--ink-4`, every `0` in `--ink-4`, and **no honesty note**.
6. **`Nothing waiting.`** Left-aligned under `Waiting on you`, no box, no pill, no centring.
7. **The quiet strip.** One hairline, one 11px line reading `Engine ran Nh ago · all sites ok · checked Nh ago` with `·` in `--ink-4`, and `Check now` pushed right as an outline pill.
8. **The rail beside it.** Six agent badges live, `Freelance` marked active with the raised fill and inset hairline, and the `#0B0D11` column reaching the bottom of the viewport — `/freelance` is the shortest page in the app and the one that would expose R33 failing.
9. **The console.** Clean. No CSP violation, no hydration warning, no request to `fonts.googleapis.com` or `fonts.gstatic.com`.

- [ ] **Step 5: `Check now`, and the disclosure state surviving `router.refresh()`**

With the dev server still running and `/freelance` open:

1. **Open Campaigns** (it is closed by default) and leave Approaches open.
2. Press **`Check now`**. The label becomes `Checking…` and the button disables.
3. When it settles: the stamp has updated, **both disclosures are still in the state you left them**, and the page did not flash empty — the previous reading stayed on screen throughout.
4. Press `Check now` **twice inside a minute**. No error, no 429 in the Network tab; the second press returns 200 with the existing reading.

**If a disclosure snaps shut here, stop.** It means React is writing the `open` attribute back on reconcile, and the fix is to stop passing `open` to that element — not to add client state.

- [ ] **Step 6: Whole page down, once, on purpose**

Stop the dev server, then run it against an unreachable host so the three ShikksTracker calls all fail:

```bash
ST_API_BASE_URL="https://shikkstracker.invalid" npm run dev
```

Next does not overwrite an env var already present in `process.env`, so this beats `.env.local`. Open `/freelance`.

Expected: the title, then a `.fl-fail` block — a 5px red dot with a glow, `Couldn't reach ShikksTracker.` at 13px `--ink-2`, and the explanation under it at 12.5px `--ink-3` capped at 62ch — and then the health strip, which **still works** because site results are stored locally. **Blocks A to E are absent, not drawn drained.** `Check now` still functions. The page renders inside `ST_PAGE_TIMEOUT_MS`, not after fifteen seconds.

Stop the server and restart it normally to confirm the page comes back.

- [ ] **Step 7: Re-run Plan A's by-eye list on the finished page**

Plan A's Task 13 step 5 was written when `/freelance` was a title and nothing else. It is now both the shortest page in the app (its failure state) and the fullest (its normal state), so it is the right surface to re-check the shell against. With the dev server running, walk Plan A's Task 13 step 5 items **1 to 6** again on `/freelance` specifically:

1. The three faces render — Archivo on the figures and headings, IBM Plex Sans on the sentences, JetBrains Mono on every eyebrow, label, tag and stamp.
2. Six agent badges live in the rail, in execution order, green ones without captions.
3. `/queue` and `/settings` still work under the shell with exactly one `Log out`.
4. `/freelance` marks Freelance active, `/queue` marks Queue active.
5. No CSP violation and no console error on any of the three pages.
6. The rail's ground reaches the bottom of the viewport — **on `/freelance` in its whole-page-down state**, which is the shortest the page ever gets.

Also re-run Plan A's Task 13 step 6 once, since the rail's degraded state now has a full page beside it:

```bash
MONGODB_URI="mongodb+srv://nobody:nobody@nowhere.invalid/rikuos" npm run dev
```

Expected on `/freelance`: six grey `—` badges in the rail, **and the page still renders** — Block A's `Needs you` card reads `—` with the caption `couldn't load`, Block E says `Couldn't load what's waiting.`, and the strip says `sites never checked`. Everything ShikksTracker answers is still on screen. Stop the server.

- [ ] **Step 8: The D11 observation — pending, and this plan does not claim it**

Spec §9 item 4 requires `/freelance` **rendered on Vercel** with today's real ShikksTracker numbers and nothing typed by hand, with the rail's six badges live beside it, `Check now` pressed once and then twice inside a minute.

**Steps 4 to 7 satisfy every part of that against real data, but locally.** The deployed half cannot be done from this plan: the repo commits on `master` and never pushes, and deploying is Riku's action.

So this step is a **handoff, not a check**:

> Riku pushes `master`, waits for the Vercel deployment, opens `/freelance`, and confirms: the three real figures match what ShikksTracker shows, the six rail badges show real agent states, `Check now` updates the stamp, and a second press inside a minute produces no error.

**The executor must report §9 item 4 as PENDING and must not mark it done.** The lead reports it as pending until Riku confirms. Everything else in this plan can be claimed complete.

- [ ] **Step 9: Final state**

Run: `git status --porcelain`
Expected: **no output** — everything is committed.

Run: `ls "src/app/(app)/freelance/_blocks/"`
Expected: exactly eight files — `Approaches.tsx`, `Campaigns.tsx`, `CheckNow.tsx`, `HealthStrip.tsx`, `HeroRow.tsx`, `NeedsYou.tsx`, `Pipeline.tsx`, `StateOfPlay.tsx`. No ninth file: Plan A's Series file map lists these eight and a new one would need a new decision.

---

## Self-review

**1. Spec coverage.** Every section in Plan C's scope maps to a task:

| Spec | Task |
|---|---|
| §7.4 `page.tsx`: `force-dynamic`, `maxDuration = 30`, the `Promise.allSettled` fan-out, `ST_PAGE_TIMEOUT_MS` on all three calls | 2 |
| §7.4 the two URLs built server-side from `readStConfig().baseUrl` | 2 |
| §7.4 the local reads (`connectDB`, `getOsSettings`, `getHealthSnapshot`) and `fetchLiveAnchorIds`, in `try/catch` | 2 |
| §4.1 Block A — three cards, the track, the statement lines | 3 |
| §4.2 Block B | 4 |
| §4.3 Block C, the native disclosure, the bound, the honesty note | 5 |
| §4.4 Block D, two groups, R31 `defaultOpen`, R27's note under the measured group | 6 |
| §4.5 Block E, three row kinds, the empty channel slot, the bound | 7 |
| §4.6 Block F both forms, the hued dot, `CheckNow` | 1 |
| §4.7 whole page down and one source down | 2 (page), 4–7 (per-block `.fl-fail`) |
| §5.6 native `<details>`, zero client JS for disclosure | 5, 6 |
| R25 the page adds nothing to the top bar | Ground rules (nothing imported from `_shell/`) |
| R36 the two outward links | 3, 7 |
| §9 items 1–3 | 8, steps 1–2 |
| §9 item 4 | 8, steps 4–8 — **local halves done, deployment handed to Riku, reported PENDING** |
| Plan A Task 13 by-eye re-read on the finished page | 8, step 7 |

**One thing I could not plan as written, and one I resolved against the mockup:**

- **§9 item 4 cannot be claimed by this plan.** It requires a Vercel render, the repo never pushes, and deploying is Riku's action. Task 8 step 8 states it as a handoff and forbids the executor from marking it done.
- **`<summary>` conformance versus real headings.** The ruling asks for `<h2 className="fl-h">`; `<summary>`'s content model is phrasing content or a single heading element, so the `<div className="sumrow">` wrapper this forces is not strictly conformant. Implemented as ruled, cost stated in the deviations section with the one-word alternative if the lead prefers conformance.

**Three places the shipped code, the mockup and the spec disagreed:**

1. **The mockup's `<span className="fl-h">` and `<h3 className="fl-title" style="margin:0">`** versus the ruling's real headings. Followed the ruling; the margins that made the mockup use inline styles were moved into `components.css` in `94eddc9`, so nothing shifts. Wrappers containing an `<h2>` became `<div>` (deviation 2).
2. **The mockup's inline `margin-top:6px` on the hot `.fl-absent` line** is specimen-frame tuning inside `.mini`, which is mockup-only chrome. Not ported; `.fl-absent`'s own 10px applies (deviation 3).
3. **`.stat-top .more` already carries `border-bottom:0` in the shipped CSS**, added by the quality review "now rather than in Plan C". So Plan C edits no CSS at all, which is why Task 8 step 3 asserts `src/styles/` is untouched in the diff.

**A fourth, smaller one, resolved by repetition rather than a new file:** the `.fl-fail` markup (four lines) appears in `page.tsx` and in each of the four blocks that can fail. A shared `FailLine` component would be a ninth file in `_blocks/` or a new file in `src/components/`, and Plan A's Series file map fixes both lists. Repeated deliberately; if the lead wants it factored out, that is a map change first.

**2. Placeholder scan.** No `TBD`, no `TODO`, no "implement later", no "similar to Task N", no "handle edge cases". Every code step carries a complete file or the exact lines to add, and every command carries its expected output. Task 8 step 8 is a named handoff with an explicit "do not mark done", not a placeholder.

**3. Type consistency.** Checked against Plan B's "Types Plan C will render", which this plan consumes unchanged:

- `StatCard` — `key`, `tone`, `label`, `figure`, `caption`, `href`, `trackPercent`. `HeroRow` reads exactly those seven and renders `className={`stat ${card.tone}`}`, which matches `.stat.roi` / `.stale` / `.plain` / `.drained` / `.blank` in `components.css`.
- `SayLine` — `figure: string | null`, `text`. `StateOfPlay` keys by `text`, which is unique per line.
- `BlockB` — the three-member union `failed` / `empty` / `stages`; `Pipeline` handles all three, and reads `summary.total`, `summary.totalWord`, `summary.hot`, `summary.hotWord`, `rows[].key/label/count`, `emptyNote`, `absentNote`, `hotAbsentNote`.
- `BlockC` — `count`, `headers`, `rows[].id/name/cells`, `bound`, `honesty`. Cells are keyed by `headers[index + 1]`, which is why `headers` has one more entry than `cells`.
- `BlockD` — `defaultOpen`, `collapsed` (the `statement` / `best` union), `groups[].eyebrow/explain/headers/rows`, `honesty`. `ApproachRow.cells` is 3 long in group 1 and 2 long in group 2, and both are keyed by `group.headers[index + 1]`.
- `BlockE` — `count`, `rows[].id/kind/businessName/href/channel/waiting/waitingIsStale/snippet/reason`, `bound`. `channel === null` renders the empty span.
- `BlockF` — `quiet` with `parts: HealthPart[]`, `alarm` with `warnings`/`fine`/`stamp`. `HealthWarning.tone` is `"stale" | "missing"`, and `.fl-warn.is-stale` / `.fl-warn.is-missing` are the two classes in `components.css`, so `is-${warning.tone}` is exhaustive.
- `FAIL_LINES.page.said` / `.because` are the only two `FAIL_LINES` members this plan reads directly; the four per-block sentences arrive inside their block's `failed` member.
- Every class name used here exists in the shipped `src/styles/components.css`: `.stats`, `.stat`, `.stat-top`, `.lbl`, `.more`, `.fig`, `.track`, `.sub`, `.fl-say`, `.fl-sect`, `.eyebrow`, `.fl-h`, `.fl-title`, `.fl`, `.fl-body`, `.fl-sum`, `.fl-stages`, `.fl-stage`, `.nm`, `.ct`, `.fl-note`, `.fl-absent`, `.fl-empty`, `.disclose`, `.sumrow`, `.fl-count`, `.fl-collapsed`, `.fl-open`, `.fl-table`, `.is-campaigns`, `.fl-thead`, `.fl-trow`, `.zero`, `.dash`, `.fl-group`, `.fl-explain`, `.fl-bound`, `.honesty`, `.fl-headrow`, `.fl-rows`, `.fl-row`, `.fl-biz`, `.arr`, `.tag`, `.pwhen`, `.is-stale`, `.fl-snip`, `.fl-why`, `.fl-fail`, `.said`, `.because`, `.fl-health`, `.quiet`, `.alarm`, `.line`, `.aged`, `.fl-warn`, `.is-missing`, `.fl-fine`, `.fl-stamp`, `.btn`, `.app-content`.
