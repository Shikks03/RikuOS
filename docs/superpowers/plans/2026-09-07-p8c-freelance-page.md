# P8c — The Freelance page: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `/freelance` — blocks A to F on live ShikksTracker data, in every state the deck specifies — as a server component with exactly one client island.

**Architecture:** `page.tsx` is a renderer with no opinions in it. It reads the two local sources in one `try/catch`, fans out to ShikksTracker with `Promise.allSettled` so one dead source degrades one block, hands each result to a Plan B builder, and passes the resulting plain data to eight presentational components whose markup and class names are the mockup's, verbatim. The only client code on the page is `CheckNow`, which posts once and calls `router.refresh()`.

**Tech Stack:** Next.js 16.2.10 (App Router, server components) · React 19.2 · TypeScript `strict`. **No new dependency. No CSP change. No `NEXT_PUBLIC_*`.**

---

## The series, and what this plan consumes unchanged

- **Plan A** — `docs/superpowers/plans/2026-09-07-p8a-shell-and-skin.md`. Its **"Series file map"** section is the authority on every file all three plans touch. This plan implements the rows listed there under **Plan C** and renames nothing. Plan A already shipped: the four stylesheets (`src/styles/components.css` is the class vocabulary this page renders into), `src/components/icons.tsx`, the `(app)` shell, and the placeholder `src/app/(app)/freelance/page.tsx` that **Task 2 rewrites**.
- **Plan B** — `docs/superpowers/plans/2026-09-07-p8b-data-logic-health.md`. Its **"Types Plan C will render"** section is the contract this plan's JSX consumes: `Cell`, `StatCard`, `SayLine`, `BlockA`, `BlockB`, `BlockC`, `BlockD`, `BlockE`, `BlockF`, `FAIL_LINES`, and the two URLs the page builds server-side. **Not one of those types is changed here.** If a block seems to need a different shape, that is a Plan B change and a conversation, not a local edit.

**This plan adds no test *file*, and that is deliberate.** Every decision the page makes was pushed into Plan B's pure modules and is already pinned there; §8 records that the repo has no route- or component-level tests and P8 adds none. What is left — the cascade, the markup, the disclosure behaviour, the render against real data — is "verified by build and by looking", which is what Task 8 does. **The exceptions prove the rule, because every one of them is a decision inside a pure module:** R66 moves a rendering decision *out* of the JSX and into `freelanceVariants.ts`, and a decision that lives in a pure module gets a test there, in the file that already pins the rest of Block D (Task 6, step 1). The batch reviews then added eight more of exactly that kind, all in Plan B's existing test files — one for R72 in `freelanceView.test.ts`; three for R74, one for R75's block-level throw and one for Batch 4's chore in `stApi.test.ts`; two for R75's snippet guards in `freelanceGaps.test.ts`. **The suite ends at 526**, Plan B's 517 plus those nine. No test file is created and no test is added anywhere near a component.

---

## What the mockup fixes, and the three places this plan deviates from it

`docs/design/p8-mockup.html` is the **markup truth**. Specimens **01** (today's real data), **02** (the full render, both disclosures open, all three Block E kinds, the alarm strip) and **04** (whole page down, one source down, not-reported beside a measured zero) between them show every element this page produces. Reproduce the element structure and class names exactly.

**Read `src/styles/components.css` as shipped, not only the mockup** — it carries five numbered differences plus five from the quality review, and one of those matters here: `.stat-top .more` already has `border-bottom:0` because it becomes an `<a>` on this page. **Plan C makes exactly one CSS edit, R60's, one selector in Task 1 step 3** — and it is an exception named in the ground rules, not a licence. Everything else this page renders into is Plan A's vocabulary, unchanged.

Three deviations, each forced and each recorded here rather than discovered later:

1. **Block headings are real `<h2 className="fl-h">`, not the mockup's `<span className="fl-h">`,** and the page title is an `<h1 className="fl-title">` rendered by the segment layout, not by this page (R42). The margin fix in `94eddc9` put `margin:5px 0 0` on `.fl-h` and `margin:0` on `.fl-title`, so a real heading renders identically. The eyebrow stays a `<span className="eyebrow">` above it.
2. **Wrappers that contain an `<h2>` become `<div>`, where the mockup used `<span>`** — `.sumrow` and its first child in Blocks C and D, and `.fl-headrow`'s first child in Block E. A `<span>` is phrasing content and cannot legally contain a heading. Both are grid items, so nothing moves. **The cost, stated plainly: `<summary>`'s content model is phrasing content or a single heading element, so a `<div className="sumrow">` inside it is not strictly conformant HTML.** It renders correctly in every browser and React does not object. The ruling asked for real headings; this is what real headings cost inside a native disclosure. The alternative — keeping `<span className="fl-h">` inside the two `<summary>` elements only — was a one-word change per file, and **R65 declined it: the `<div>` stays**, and both docblocks now carry the argument so nobody trades the heading for a validator's approval. The one thing R74 softened is the mechanism, not the choice: the docblocks say `<summary>` maps to *a button-like control with name-from-contents in the major engines* rather than fixing it to `role="button"`, because the mapping is not settled by ARIA-in-HTML while the consequence — one accessible name from the subtree — holds under any of them.
3. **The mockup's inline `style="margin-top:6px"` on the `.fl-absent` hot line does not ship.** It is tuning inside specimen 04's `.mini` frame, which is mockup-only chrome. `.fl-absent`'s own `margin-top: var(--sp-3)` applies.

**Two further departures from the mockup's markup ship and are deliberately not counted above (S9).** The drafts card's `<span class="more">Open ↗</span>` (mockup 640) becomes `<a className="more" href target rel>`, and Block E's `<a class="fl-biz">` (mockup 916) — a bare anchor with no `href` in the mockup — gains `href`, `target` and `rel`. Both are the **R36** ground rule below doing exactly what it says, not a deviation discovered here, and `components.css` already carries `border-bottom:0` on `.stat-top .more` and on `.fl-biz` precisely because they become real anchors on this page. They are covered by the ground rule and are not in the count of three.

**Everything below the `mockup-only` comment ships nowhere** — `.doc`, `.spec`, `.frame`, `.scroll`, `.pair`, `.side`, `.mini`, `.minipair`, `.tab` and the rest are chrome for a document about the page.

---

## Ground rules for every task in this plan

- **R36 — the two links that leave the app.** The drafts card's `Open ↗` and Block E's business names are plain `<a>` elements with `target="_blank"` and `rel="noopener noreferrer"`. The `↗` is a **literal character**: part of the `Open ↗` text on the card, and inside `<span className="arr">↗</span>` on a Block E row. Never an icon component, never `dangerouslySetInnerHTML`.
- **R25 — the shell already renders the top-bar stamp.** This page adds nothing to the bar, and imports nothing from `_shell/`.
- **Icons carry no intrinsic size.** Every consumer sizes them through an existing CSS rule. `IconInfo` is used only inside `.honesty`, which has `.honesty svg{width:13px;height:13px}`. No other icon is used on this page.
- **Block F's warning marker is the hued dot** (`<i />` inside `.fl-warn`), never `⚠` or any glyph.
- **No client-side fetching anywhere except `CheckNow`'s single POST.** The page never fetches its own API from the browser.
- **`/queue`'s status filters are not touched, and the queue page itself is never edited (R18).** Since R42 the queue is a *view inside this segment*, so the old wording — "nothing outside `src/app/(app)/freelance/` changes" — no longer draws the line where it was meant. The line, reworded (the lead's own ruling, 2026-09-09): **nothing outside `src/app/(app)/freelance/page.tsx` and `src/app/(app)/freelance/_blocks/` changes in this plan, except eight named exceptions, each landing in the task or the fix pass that needs it.** Seven were named before the build; the eighth and three widenings came out of the batch reviews and are marked as such.
  1. `src/styles/components.css` — one selector (**R60**, Task 1).
  2. `src/lib/deadline.ts` — one exported constant (**R63**, Task 2).
  3. `src/app/(app)/_shell/AgentsBlock.tsx` — the same constant imported instead of declared, and the `DASH` import (**R63**, Task 2). **Widened by R71** to one `console.error` line in its `catch`, so the rail logs the read failure the page already logs.
  4. `src/app/layout.tsx` — the `title` template (**R64**, Task 2).
  5. `src/app/(app)/freelance/queue/layout.tsx` — a new file, the only exception that is not a small edit to an existing one (**R64**, Task 2). It exists *beside* the queue page and does not touch it.
  6. `src/lib/freelanceVariants.ts` and `src/lib/__tests__/freelanceVariants.test.ts` — one filter and the tests that pin it (**R66**, Task 6). **Widened by R72** to `src/lib/freelanceView.ts` and `src/lib/__tests__/freelanceView.test.ts` — `BlockAInput.summaryFailed` and the one test that pins all three hero cards in the failed register.
  7. `src/lib/freelanceGaps.ts` — one docblock line, a comment-only edit (**N8**, Task 3). **Widened by R75** to two guarded `snippet` lines and two tests in `src/lib/__tests__/freelanceGaps.test.ts`: an object where a string belongs drops the snippet, never the row.
  8. `src/lib/stApi.ts` and `src/lib/__tests__/stApi.test.ts` — **added by R74 and R75** (Batch 3's two fix passes and Batch 4's chore): `fetchAttention`'s two per-row guards, the slice to `limit`, the throw when `repliedUnanswered` is not an array, and the one `console.warn` naming how many rows were dropped.
- **Repo boundary.** `../ShikksTracker` is read-only and its database is never touched.
- Commands are for **Git Bash on Windows** from the repo root. Commits are on `master`, never pushed, and every message ends with the trailer shown in its commit step.
- **`src/styles/*.css` is not edited, with one named exception: R60's single selector in Task 1.** If any *other* rule seems to be missing, stop and raise it — Plan A shipped the vocabulary this page renders into, and a late CSS addition is how the cascade stops being readable in one file. R60 is that rule being raised and answered: `.fl-health.quiet .line .aged` cannot match in the alarm form, so R57's amber stamp had no way to render there. One selector, one comment, and the ground rule otherwise stands.
- **Port 3000 is Riku's dev server and is never bound, opened, or stopped by this plan (R62).** Every check below runs a production build on **3001**: `npm run build` then `npx next start -p 3001`, and every URL is `http://localhost:3001/…`. The two env-override runs prefix that same `next start` — `ST_API_BASE_URL` and `MONGODB_URI` are read at request time under `force-dynamic`, so a build made without them is fine, and Next does not overwrite a variable already present in `process.env`, so the inline value still beats `.env.local`. **Cookies are not port-scoped**, so the session Riku already holds on `:3000` authenticates `:3001` in the same browser profile — there is nothing to sign in to and nothing to sign out of. **Stop only the server this plan started, by its PID**, never with a blanket kill and never with a Ctrl-C aimed at a terminal that might be his. Two things this also buys, worth naming rather than discovering: a production build is the surface spec §9 item 6's route table and the `force-dynamic` marker are actually about, and `npx next start` cannot hot-reload, so a check that passes really did run against the committed code.
- **Each block is computed in the task that renders it** (R47's principle, the lead's own ruling). Task 2 keeps phases 1 and 2, `strip` and `wholePageDown`; Task 3 takes phase 3, `blockE` and `blockA`; Tasks 4, 5 and 6 take `blockB`, `blockC` and `blockD`; Task 7 renders the `blockE` Task 3 already built. **Imports move with them**, so no commit ever adds an unused local and no commit adds a lint warning. Consequently **every task's check step runs `npm run lint`**, and its expectation everywhere in this plan is: **the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and nothing new** (R61). `npm run lint` exits 1 on those four; that exit code is the pre-existing state, not a failure of this plan. A *fifth* error or a *fourth* warning is a failure and stops the task.

**Stopping a server this plan started, in Git Bash on Windows:**

```bash
netstat -ano | grep ":3001" | grep LISTENING   # the PID is the last column
taskkill //PID <pid> //F
```

The doubled slashes are not a typo — MSYS rewrites a single-slash `/PID` into a Windows path and `taskkill` then rejects it. If the `next start` is running in this session's own foreground terminal, Ctrl-C **in that terminal** is equivalent and safe. What is forbidden is a Ctrl-C or a kill aimed at anything on port 3000.

---

## Task 1: Block F — the health strip and its one control

Built first because it is the only block that survives a total ShikksTracker outage: site results are stored locally. Task 2's page can then render its worst case immediately.

**Files:**
- Create: `src/app/(app)/freelance/_blocks/CheckNow.tsx`
- Create: `src/app/(app)/freelance/_blocks/HealthStrip.tsx`
- Modify: `src/styles/components.css` — **one selector** (R60, exception 1 of 8)

- [ ] **Step 1: Create `src/app/(app)/freelance/_blocks/CheckNow.tsx`**

**R67 — a failed `Check now` says `Couldn't check`, and it has landed in the block below.** Plan B's Batch 5 review ruled that `check()` must read `res.ok`; R67 gave that ruling a body and took it one step further. A request that *succeeds* while the write inside it fails — `getHealthSnapshot` returns, `saveHealthSnapshot` throws, the route 500s — and a fetch that rejects outright are **one fact to the reader**: the reading did not move, and the reason is not the sites. The old argument for swallowing a *network* failure (*the unchanged reading already says nothing new was learned*) is false as a **signal**, because `formatAge` floors to whole hours: a reading under an hour old stamps `checked 0h ago` before the press and `checked 0h ago` after it, so a reader pressing twice in a morning genuinely cannot tell a silent failure from a successful no-op. One meaning, one string — **`Couldn't check`**, in the button's own label register, which `.btn` uppercases to `COULDN'T CHECK`. It is cleared on the next press, and `router.refresh()` stays **unconditional, including after a failure**, because a 401 from an expired cookie then redirects to `/login` for free. **`Couldn't check` is the fourth provisional string awaiting Riku.**

**As shipped at `09b465c`; amended after the plan was written by R69 in `950cf0d`, and by the Batch 1 re-review's first two comment nits in `04de80b`.**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * The only control on the page, and the page's only client code.
 *
 * router.refresh() re-runs the server render and reconciles in place — with the
 * one exception named below, a flip between the strip's two forms that remounts
 * this island — so the new reading arrives through the same server path as a
 * page load and this island never has to know a snapshot's shape. That is also
 * why the EXISTING READING STAYS ON SCREEN while the check runs: nothing here
 * blanks the strip.
 *
 * `busy` covers the POST and the refresh that follows it — useTransition's
 * isPending is what makes the second half honest, since router.refresh()
 * returns before the server render lands.
 *
 * A failed POST is NOT swallowed (R67). A non-2xx response and a thrown fetch
 * are ONE fact to the reader — the reading did not move, and the reason is not
 * the sites — so both produce the same label, `Couldn't check`, in the button's
 * own register rather than as a line in the strip: the strip's lines are claims
 * about the world, and a failed press is a fact about a button. The stamp
 * cannot carry it either, because formatAge floors to whole hours and a reading
 * under an hour old stamps `checked 0h ago` on both sides of the press.
 *
 * `Couldn't check` stands only until the next press — setFailed(false) at the
 * top of check() clears it — with ONE exception: when the refresh flips the
 * strip between its quiet and alarm forms, `<CheckNow />` sits at a different
 * position in each (a child of `.fl-health.quiet` in one, inside `.fl-stamp` in
 * the other), so React remounts the island with `failed=false` and a
 * `Couldn't check` shown before the flip is lost. A lost message, never a false
 * claim; the markup is the mockup's and stays. And .btn uppercases the label in
 * CSS, so it renders COULDN'T CHECK beside CHECK NOW and CHECKING….
 *
 * `failed` is tested BEFORE `busy` (R69). After a failed POST the refresh still
 * runs and still holds the button, but the label already says what happened
 * rather than reading `Checking…` for the whole re-render — which this page's
 * own budget puts at up to 16 s. `disabled={busy}` is unchanged, and the next
 * press still opens on `Checking…`, because setFailed(false) runs in the same
 * batch as setPosting(true).
 *
 * The route itself never errors on a rapid second press — a 60-second floor
 * returns the existing reading with 200 rather than a 429.
 */
export default function CheckNow() {
  const router = useRouter();
  const [posting, setPosting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const busy = posting || isPending;

  async function check(): Promise<void> {
    setPosting(true);
    setFailed(false);
    let ok = false;
    try {
      const res = await fetch("/api/health/sites", { method: "POST" });
      ok = res.ok;
    } catch {
      // A rejected fetch and a response that arrived and said no are ONE fact
      // to the reader: the reading did not move, and the reason is not the
      // sites. The stamp cannot carry that — formatAge floors to hours, so a
      // reading under an hour old stamps `checked 0h ago` either way.
      ok = false;
    }
    setFailed(!ok);
    setPosting(false);
    // Unconditional, INCLUDING after a failure. The proxy returns 401 on an
    // expired cookie (requireSession behind it), and this refresh's RSC request
    // is redirected to /login by src/proxy.ts's fail-closed check
    // (proxy.ts:100-102), which answers before the (app) layout is ever
    // reached; the layout's own session check is defence in depth for a matcher
    // miss. That is the right outcome for the one failure with a real remedy,
    // and it is free.
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button type="button" className="btn" disabled={busy} onClick={() => void check()}>
      {failed ? "Couldn't check" : busy ? "Checking…" : "Check now"}
    </button>
  );
}
```

- [ ] **Step 2: Create `src/app/(app)/freelance/_blocks/HealthStrip.tsx`**

**As shipped at `09b465c`; unchanged since `49155b5` — no ruling touched this file.**

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
 * The marker is the system's hued dot, never a glyph — the reason is written
 * once, in freelanceHealth.ts's header, and is not copied here: two copies of a
 * rule drift, and the view model is where the decision lives.
 *
 * Every key here is CONTENT-DERIVED — part.text, warning.text, and the fine
 * line's own text — because a HealthWarning has no id to key on. They are
 * unique in every render this page can produce: the quiet line's parts are the
 * engine phrase, `all sites ok` and the stamp, and SITES carries three distinct
 * names, so `warnings` and `fine` cannot collide (N7).
 *
 * The aged stamp nests <span className="aged"> INSIDE .line in BOTH forms,
 * never as a second class on .line itself. The rule is a descendant selector —
 * `.fl-health .line .aged`, components.css:465 as R60 widened it — so the two
 * forms have to write it the same way or the alarm form renders R57's amber
 * statement in ordinary grey and it looks like a timestamp.
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
        <span className="line">{strip.stamp.aged ? <span className="aged">{strip.stamp.text}</span> : strip.stamp.text}</span>
        <CheckNow />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Widen the aged-stamp selector in `src/styles/components.css` (R60)**

**This is the plan's one CSS edit, and the only one.** `components.css:464` reads `.fl-health.quiet .line .aged`, which is scoped to the quiet form, so R57's amber stamp has no rule to match inside `.fl-health.alarm` — `sites not checked since 2d ago` would render in `.fl-stamp .line`'s ordinary grey (`components.css:482`, before this edit) and look like `checked 6h ago`. The state is real: `buildHealthStrip` computes `stamp` before it counts warnings and hands the same object to both returns, so engine-stale plus a 40-hour-old reading is the morning after the site-health cron misses. The mockup is **not** touched — it draws no alarm-aged state, and R29 stands: amend the record, never the mockup.

Lines 463–464 currently read:

```css
/* the 30-hour rule: past everyHours + graceHours the stamp becomes a statement */
.fl-health.quiet .line .aged{color:var(--stale)}
```

Replace those two lines with these three — the existing comment is unchanged, one comment line is added, and the selector loses `.quiet`:

```css
/* the 30-hour rule: past everyHours + graceHours the stamp becomes a statement */
/* not .quiet-scoped: the alarm form nests the same span, and R57's amber stamp must render there too (R60) */
.fl-health .line .aged{color:var(--stale)}
```

Nothing else in the file changes. Verify:

Run: `git diff --stat -- src/styles/components.css`
Expected: exactly `1 file changed, 2 insertions(+), 1 deletion(-)` — the new comment line is the second insertion.

Run: `git grep -n "aged" src/styles/`
Expected: exactly one rule, `src/styles/components.css:465:.fl-health .line .aged{color:var(--stale)}`. It is line **465**, not 464: the added comment pushed it down one. **Everything below it in the file also shifts by one**, so the `.fl-health.alarm` rules that were 468–482 are now **469–483** — Task 8 step 4 item 10 cites the post-edit numbers.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run lint`
Expected: the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and nothing new. (`npm run lint` exits 1 on those four; that exit code is the pre-existing state. A fifth error or a fourth warning stops the task.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/freelance/_blocks/CheckNow.tsx" "src/app/(app)/freelance/_blocks/HealthStrip.tsx" src/styles/components.css
git commit -F - << 'MSG'
feat(p8c): Block F — the health strip and Check now

Quiet form is a footer; one warning turns it into a bordered card. The
marker is the system's hued dot, never a glyph.

CheckNow is the page's only client code: one POST, then router.refresh(),
so the new reading arrives through the same server path as a page load and
the island never learns a snapshot's shape. The existing reading stays on
screen throughout, and busy covers the refresh as well as the POST.

R67: a failed check is not swallowed. A non-2xx response and a thrown fetch
are one fact to the reader, so both say `Couldn't check` in the button's own
label until the next press. The stamp cannot carry that — formatAge floors
to hours — and the refresh stays unconditional, so an expired cookie
redirects to /login for free.

R60: the aged-stamp rule loses its .quiet scope. It was written when the
mockup only ever drew the quiet form; R57's amber statement has to render in
the alarm card too, and both forms now nest the span the same way. The one
CSS edit in Plan C, named in the ground rules.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 2: `page.tsx` — the data layer, the whole-page-down state, and the strip

The first renderable page. Blocks A to E arrive in Tasks 3 to 7; until then the page renders the title, the whole-page-down statement when it applies, and the strip.

**Three phases, in this order, and the order is load-bearing:**

1. **The local reads**, in one `try/catch`: `connectDB`, **`readOsSettings`** (for `chaserNDays` and `monitoringEnabled`) and `getHealthSnapshot`. A failure here must degrade three things and blank nothing. **Never `getOsSettings()` — that accessor is `updateOsSettings({})` and therefore a write, so reading it here would make every view of this page a primary write (R37).** `readOsSettings` is the read-only accessor built for exactly this: `findOne`, no upsert, schema defaults for anything the document does not carry.
2. **The three ShikksTracker calls**, in parallel, through `Promise.allSettled` — that word *is* the per-block degradation mechanism.
3. **The gap read**, which needs both the attention result and the database, so it cannot join phase 1.

**This task builds phases 1 and 2 only.** Phase 3 lands in Task 3, beside the two blocks that consume it, so nothing computed here is left without a reader (the lead's standing amendment above). `baseUrl` and `dbOk` move with it for the same reason: both are read only by phase 3 and by `blockE` / `blockA`, so declaring them here would leave this commit with two locals ESLint reports as assigned-but-never-used, which is exactly the lint warning the amendment exists to prevent.

**Files:**
- Modify: `src/app/(app)/freelance/page.tsx` (replacing Plan A's placeholder)
- Modify: `src/lib/deadline.ts` — **one exported constant** (R63, exception 2 of 8)
- Modify: `src/app/(app)/_shell/AgentsBlock.tsx` — **three one-line swaps, one added import and one deletion** (R63, exception 3 of 8), **and one `console.error` line in its `catch`** (R71, added by the Batch 1 quality review)
- Modify: `src/app/layout.tsx` — **the title template** (R64, exception 4 of 8)
- Create: `src/app/(app)/freelance/queue/layout.tsx` (R64, exception 5 of 8)

**Steps 2 to 5 are not optional extras.** Step 1's page imports `MONGO_READ_TIMEOUT_MS` from `@/lib/deadline`, which Step 2 creates, and there is no type-check between them — all five edits land before Step 6 runs `npx tsc --noEmit`.

- [ ] **Step 1: Replace `src/app/(app)/freelance/page.tsx`**

**Amended after the plan was written, and shown here in its final form.** `settled`'s label and log line, the phase-1 comment's fourth degradation and the `maxDuration` docblock's "the platform's own default" are R70 and the Batch 1 accepted list, in `950cf0d`, with two comment nits in `04de80b`. The `five timeouts` count word and the view-models header are R72's accepted list, in `5159de1` — and the count word only became **true** when Task 3's anchor read landed, so at this commit it is written forward, not measured. Unlike the block files, `page.tsx` is built up across Tasks 2–7, so this block is the Task 2 state of it, not HEAD.

```tsx
import type { Metadata } from "next";
import { connectDB } from "@/lib/db";
import { MONGO_READ_TIMEOUT_MS, withDeadline } from "@/lib/deadline";
import { readOsSettings } from "@/lib/osSettings";
import type { OsSettingsValues } from "@/lib/osSettings";
import { getHealthSnapshot } from "@/lib/healthSnapshot";
import type { StoredHealth } from "@/lib/healthSnapshot";
import { AGENT_STALE_HOURS } from "@/lib/watchdog";
import { evaluateOutreach } from "@/lib/outreachHealth";
import {
  ATTENTION_LIMIT,
  ST_PAGE_TIMEOUT_MS,
  fetchAttention,
  fetchSummary,
  fetchVariantStats,
} from "@/lib/stApi";
import { FAIL_LINES } from "@/lib/freelanceView";
import { buildHealthStrip } from "@/lib/freelanceHealth";
import { OS_SETTINGS_DEFAULTS } from "@/models/OsSettings";
import HealthStrip from "./_blocks/HealthStrip";

/**
 * Every figure on this page is "what is true right now", so there is nothing to
 * cache and nothing to revalidate.
 */
export const dynamic = "force-dynamic";

/**
 * A CONTAINMENT bound, and nothing more. maxDuration does not prevent a Vercel
 * error page — it SCHEDULES one, at 30 s instead of the platform's own default.
 * The reader's protection is the five timeouts above it: ST_PAGE_TIMEOUT_MS on
 * each of the three ShikksTracker calls, and MONGO_READ_TIMEOUT_MS on each of
 * the two Mongo reads. Those bound the worst case at 5 + 6 + 5 = 16 s and land
 * in catches that produce states this page already designed. This line only
 * stops a pathological render from running to the platform's own limit (R63).
 */
export const maxDuration = 30;

/**
 * The tab title. The root layout carries the `%s · APP_NAME` template, so this
 * one word is the whole page-side half of it: the product name is joined in
 * exactly one place and no page file ever writes it (R64).
 */
export const metadata: Metadata = { title: "Freelance" };

/**
 * `PromiseSettledResult` -> the value, or null — and a rejection is LOGGED with
 * the call named, so the sentence on screen, a block's or the page's, has a
 * line in the log saying which of 401 / 503 / 404 / timeout it was; stApi's
 * messages were written to say exactly that, and readStConfig omits the secret
 * from its message by design (R70).
 */
function settled<T>(result: PromiseSettledResult<T>, label: string): T | null {
  if (result.status === "fulfilled") return result.value;
  console.error(`[freelance] ${label} failed:`, result.reason);
  return null;
}

/**
 * Connect and both reads as one awaitable, so ONE deadline covers all three —
 * the same shape as AgentsBlock's readRail(), for the same reason. Mongoose has
 * no per-call timeout, so an accepted-and-never-answered query is bounded by
 * nothing without this (R63).
 *
 * readOsSettings, never getOsSettings: the latter is updateOsSettings({}) and
 * would make every page view a primary write (R37).
 */
async function readLocal(): Promise<{ settings: OsSettingsValues; stored: StoredHealth | null }> {
  await connectDB();
  const [settings, stored] = await Promise.all([readOsSettings(), getHealthSnapshot()]);
  return { settings, stored };
}

export default async function FreelancePage() {
  const now = new Date();

  // --- Phase 1: the local reads, in ONE try/catch ---------------------------
  //
  // A database failure must never blank the route. It degrades exactly four
  // things: the gap figure reads `—` (`couldn't load`), the stored site reading
  // is UNREADABLE rather than absent (the strip stamps `sites — unknown`), the
  // monitoring switch is unknown (which the strip never reads in that state, so
  // it has no rendered effect either), and `chaserNDays` falls back to
  // OS_SETTINGS_DEFAULTS.chaserNDays, so the attention call below runs on a
  // window Riku did not set. The fourth is harmless: `days` bounds only
  // `repliedUnanswered` on ShikksTracker's side, and phase 3 (Task 3) is gated
  // on `dbOk`, so a gap list drawn on a guessed window is discarded before
  // anything renders it. Everything ShikksTracker answers still renders. A
  // TIMEOUT lands in the same catch and therefore in the same four
  // degradations — there is no new state to draw for it (R63).
  let chaserNDays = OS_SETTINGS_DEFAULTS.chaserNDays;
  let monitoringEnabled = false;
  // "unread" is not null: null means the read succeeded and nothing has ever
  // been written, "unread" means the read itself failed and nothing is known
  // (R56). Rendering the second as `sites never checked` would be the strip
  // claiming to have seen something it never saw.
  let snapshot: StoredHealth | null | "unread" = null;
  try {
    const { settings, stored } = await withDeadline(
      readLocal(),
      MONGO_READ_TIMEOUT_MS,
      "freelance local reads"
    );
    chaserNDays = settings.chaserNDays;
    monitoringEnabled = settings.monitoringEnabled;
    snapshot = stored;
  } catch (err) {
    snapshot = "unread";
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

  const summary = settled(summaryResult, "summary");
  const attention = settled(attentionResult, "attention");
  const variants = settled(variantsResult, "variant stats");

  // --- The view models ------------------------------------------------------
  //
  // Each block is built here in the task that renders it, so no commit in this
  // plan ever leaves a computed value without a consumer (R47's principle,
  // ruled for Plan C on 2026-09-09). blockE is the exception that proves it:
  // Block A's third card reads it through needsYouFigure, so it has a consumer
  // from the moment it exists, and Block E itself renders later.

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

- [ ] **Step 2: Export `MONGO_READ_TIMEOUT_MS` from `src/lib/deadline.ts` (R63)**

`deadline.ts` already owns this concept and already explains it in its header — *"Mongoose has no per-call timeout: connectDB bounds server selection (10 s) and a stalled socket (45 s), but a query that has been accepted and never answered is bounded by neither."* R38 named it the constant's intended home. Two module-local copies of a number whose whole purpose is to be the same on both Mongo paths is how they drift apart.

Insert the constant **between the module header and `withDeadline`'s docblock**, so the header's argument is followed by the value it justifies and then by the mechanism. The file currently reads, at lines 11–14:

```ts
 * that lands late is harmless. It only stops the caller waiting.
 */

/**
```

It becomes:

```ts
 * that lands late is harmless. It only stops the caller waiting.
 */

/** Clears a cold Atlas connect with room; half connectDB's server-selection bound. */
export const MONGO_READ_TIMEOUT_MS = 5000;

/**
```

Nothing else in the file changes; `withDeadline` itself is untouched.

- [ ] **Step 3: Point `src/app/(app)/_shell/AgentsBlock.tsx` at it, and discharge the `DASH` carry-forward (R63)**

**Six exact edits, no others.** The file is Plan A's and this plan does not otherwise touch it. (The heading said "four" over a list of five when the plan was written — a miscount, corrected at the session-8 close. R71 then added the sixth, in `950cf0d`.)

1. **Line 2** — extend the existing import:

   ```tsx
   import { withDeadline } from "@/lib/deadline";
   ```

   becomes

   ```tsx
   import { MONGO_READ_TIMEOUT_MS, withDeadline } from "@/lib/deadline";
   ```

2. **A new line 3** — the standing `DASH` carry-forward, discharged now that the file is open. It sorts between `@/lib/deadline` and `@/lib/osSettings`, matching the import block's existing path order:

   ```tsx
   import { DASH } from "@/lib/format";
   ```

3. **Lines 84–85 are deleted**, together with one of the blank lines around them so the file keeps single-blank-line separation:

   ```tsx
   /** Clears a cold Atlas connect with room; half connectDB's server-selection bound. */
   const RAIL_READ_TIMEOUT_MS = 5000;
   ```

   The comment is not lost — it moved to `deadline.ts` in Step 2, byte for byte.

4. **In the `withDeadline` call at ~113–118**, the argument changes name only:

   ```tsx
       const { latest, settings } = await withDeadline(
         readRail(),
         RAIL_READ_TIMEOUT_MS,
         "rail read"
       );
   ```

   becomes

   ```tsx
       const { latest, settings } = await withDeadline(
         readRail(),
         MONGO_READ_TIMEOUT_MS,
         "rail read"
       );
   ```

   The label stays `"rail read"` — it names the caller, not the constant.

5. **Line 136** — the literal em-dash becomes the exported one:

   ```tsx
             caption="—"
   ```

   becomes

   ```tsx
             caption={DASH}
   ```

6. **The `catch` at ~126 (R71)** — the rail logs the failure the page logs. `catch {}` swallowed the read failure: the badges say `—`, which is honest on screen, but a database outage on every page view left no line in the log. The page's `console.error` payload is proven URI-safe, so the rail takes the same one line, and two components stop logging one failure two ways:

   ```tsx
     } catch {
   ```

   becomes

   ```tsx
     } catch (err) {
       console.error("[rail] read failed:", err);
   ```

   Outside R63's named swaps; the lead's call, taken because the file is already open under R63 (ground rule exception 3, widened).

- [ ] **Step 4: The title template in `src/app/layout.tsx` (R64)**

Today `src/app/layout.tsx:38` is `title: APP_NAME`, a bare string, so **every** page in the app has the tab title `RikuOS`. Since R42 put two views under one address — the rail says `Freelance` on both, the `<h1>` says `Freelance` on both — the tab strip is the only place left where a person tells two open views of one app apart. It is a PWA, so the document title is also the installed window's title.

Lines 37–42 currently read:

```tsx
export const metadata: Metadata = {
  title: APP_NAME,
  // "black", not "black-translucent": translucent slides content under the
  // status bar and needs the safe-area layout work this phase defers.
  appleWebApp: { capable: true, statusBarStyle: "black", title: APP_NAME },
};
```

They become:

```tsx
export const metadata: Metadata = {
  // The product name is joined HERE and nowhere else: a page exports one word
  // (`title: "Freelance"`) and Next joins it to APP_NAME with the middot the
  // page already uses for exactly this job — .fl-sum i, .fl-fine i, all at
  // --ink-4. A page that exports no title falls through to `default` and reads
  // APP_NAME alone, which is what /settings and /login should say (R64).
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  // "black", not "black-translucent": translucent slides content under the
  // status bar and needs the safe-area layout work this phase defers.
  appleWebApp: { capable: true, statusBarStyle: "black", title: APP_NAME },
};
```

`appleWebApp` is unchanged. The template is inert until a child exports a title, so it costs nothing on the pages that do not.

- [ ] **Step 5: Create `src/app/(app)/freelance/queue/layout.tsx` (R64)**

**As shipped at `09b465c`; unchanged since `b87b5ab` — no ruling touched this file.**

```tsx
import type { Metadata } from "next";

/**
 * This file exists for ONE reason: /freelance/queue's page is "use client", and
 * a client component cannot export metadata. Since R42 the queue is a VIEW of
 * the Freelance page rather than a page of its own — the rail says `Freelance`
 * on both and the <h1> says `Freelance` on both — so the tab strip is the only
 * place left where the two can be told apart, and both reading the same would
 * solve the wrong half of the problem (R64).
 *
 * It renders NOTHING of its own: no <main>, no header, no wrapper. The segment
 * layout above already draws the title and the view switch, and the queue page
 * below brings its own <main> from legacy.css. A layout that added an element
 * here would put it between them.
 *
 * R18 still stands. The page beside this file is not edited by this plan, and
 * this file does not touch it.
 */
export const metadata: Metadata = { title: "Queue" };

export default function QueueLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

`React.ReactNode` without a React import is the shape both `src/app/layout.tsx` and `src/app/(app)/freelance/layout.tsx` already use, and the fragment return matches the sibling layout.

- [ ] **Step 6: Type-check, lint and build**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. Nothing is computed here without a consumer: phase 3 and the five block builders arrive in Tasks 3–6.

Run: `npm run lint`
Expected: the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and nothing new.

Run: `npm run build`
Expected: `✓ Compiled successfully`, with `/freelance` listed as dynamic (`ƒ`) and `/freelance/queue` still in the route table.

- [ ] **Step 7: Look at it once, on 3001**

**Port 3000 is Riku's — see the ground rules (R62).** After the build above:

Run: `npx next start -p 3001`, then open `http://localhost:3001/freelance` in the browser profile Riku is already signed in on. The session cookie is host-only, not port-scoped, so there is nothing to sign in to.

Expected: the rail and top bar from Plan A's shell, the `Freelance` title at 24px, and the quiet health strip at the bottom with a working `Check now`. Press it: the label becomes `Checking…`, the button disables, and the stamp updates. Press it twice inside a minute: **no error appears** — the second press returns the existing reading.

**And the tab strip, which is new here (R64):** `/freelance` reads `Freelance · RikuOS`, `/freelance/queue` reads `Queue · RikuOS`, and `/settings` reads `RikuOS` alone.

Then stop the server this plan started, by its PID (ground rules).

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/freelance/page.tsx" src/lib/deadline.ts "src/app/(app)/_shell/AgentsBlock.tsx" src/app/layout.tsx "src/app/(app)/freelance/queue/layout.tsx"
git commit -F - << 'MSG'
feat(p8c): the Freelance page's data layer and its whole-page-down state

Two phases here: the local reads in one try/catch, then the three
ShikksTracker calls through Promise.allSettled. Phase 3 and the block
builders land with the tasks that render them, so no commit leaves a
computed value without a consumer.

A database failure degrades the gap count, the stored reading and the
monitoring switch, and blanks nothing. Whole page down is all three calls
failing, not one — if any source answered, every block renders and only the
dead ones carry their own sentence. The strip survives either way because
site results are local.

R63: both Mongo reads are bounded. MONGO_READ_TIMEOUT_MS moves to
deadline.ts, the module that owns the concept, and AgentsBlock imports it
instead of keeping a second copy; its literal em-dash caption becomes the
exported DASH while the file is open. maxDuration is documented as what it
is — a containment bound that schedules a Vercel error page rather than
preventing one. The timeouts are what prevent it.

R64: the root layout gains a title template, so the product name is joined
in one place; this page exports one word, and a new queue/layout.tsx carries
the other, because the queue page is "use client" and cannot export
metadata. R18 is untouched — that page is not edited.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 3: Block A — the hero row and the statement lines

**This task also takes phase 3 and `blockE`.** `blockE` is not rendered here — Task 7 renders it — but it is *consumed* here, by `needsYouFigure(blockE)`, which is what Block A's third card reads. The two arrive together because they are one computation with two readers (the lead's standing amendment; R54).

**Files:**
- Create: `src/app/(app)/freelance/_blocks/HeroRow.tsx`
- Create: `src/app/(app)/freelance/_blocks/StateOfPlay.tsx`
- Modify: `src/app/(app)/freelance/page.tsx`
- Modify: `src/lib/freelanceGaps.ts` — **one docblock line** (N8, exception 7 of 8)

- [ ] **Step 1: Create `src/app/(app)/freelance/_blocks/HeroRow.tsx`**

**As shipped at `09b465c`; amended after the plan was written by R72's accepted comment fixes (S1) in `5159de1`, and by one Batch 2 re-review nit in `d97119e`.**

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
 * That inline width rests on `style-src 'self' 'unsafe-inline'` in
 * next.config.ts (line ~57). A hardened style-src would not remove the bar: it
 * would fill it to 100 % for every value, silently, because `.track i` has no
 * width rule of its own. That header and this line are coupled.
 *
 * R36: the drafts card's `Open ↗` is a plain <a> that leaves the app, so it
 * carries target and rel. The ↗ is a literal character in the link text, never
 * an icon component. .stat-top .more already carries border-bottom:0 in
 * components.css precisely because it becomes an anchor here.
 *
 * R68: it also carries aria-label="Open drafts in ShikksTracker". Sighted, the
 * eye reads the .stat-top row as `Drafts → Open`; tabbed to, the link's whole
 * accessible name was `Open ↗` and nothing in it said what opens. That is WCAG
 * 2.4.4 on the page's single most consequential control — its one exit, on a
 * page whose promise is that every action leaves for another app. The added
 * words are the card's own caption, and the visible word `Open` is contained in
 * the accessible name, so Label in Name (2.5.3) holds for voice control; the ↗
 * is a symbol no speech-input user can utter. Block E's business-name links
 * need nothing: their name is the business.
 *
 * The aria-label is hardcoded here for ANY card carrying an href, and only the
 * drafts card has one today — StatCard.href's own docblock says so. The day a
 * second card gains a link — the money card, whose place in the grid
 * components.css:257 already reserves — the label moves onto StatCard: this
 * component cannot tell the two apart.
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
                aria-label="Open drafts in ShikksTracker"
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

**As shipped at `09b465c`; amended after the plan was written by R72's accepted N7 clause in `5159de1`.**

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
 *
 * The key is the line's own text: buildBlockA emits at most one line and a
 * SayLine has no id, so a second line with identical text would need a real key
 * first.
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

- [ ] **Step 3: Add phase 3, `blockE` and `blockA` to `page.tsx`, and render Block A**

**Seven edits, in file order** — six as the plan was written, plus (g), which R72's accepted list added in `5159de1`. The `.filter(Boolean)` note in (d) and the `summaryFailed` line in (e) are also R72's, from the same commit; both are shown below in their final form.

**(a) The imports.** `fetchLiveAnchorIds` returns to its old position, just after the `healthSnapshot` type import; `readStConfig` returns to the `stApi` block; `buildBlockA` joins `FAIL_LINES`; `buildBlockE` and `needsYouFigure` return; and the two components are added at the end:

```tsx
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
import { FAIL_LINES, buildBlockA } from "@/lib/freelanceView";
import { buildBlockE, needsYouFigure } from "@/lib/freelanceGaps";
import { buildHealthStrip } from "@/lib/freelanceHealth";
import { OS_SETTINGS_DEFAULTS } from "@/models/OsSettings";
import HealthStrip from "./_blocks/HealthStrip";
import HeroRow from "./_blocks/HeroRow";
import StateOfPlay from "./_blocks/StateOfPlay";
```

**(b) `baseUrl`, first thing in the component**, above phase 1. Task 2 left it out because nothing there read it; the two builders below are its readers:

```tsx
  // The two ShikksTracker URLs are built HERE, server-side, and passed down as
  // plain strings. ST_API_BASE_URL never reaches a client bundle and no view
  // model reads an environment variable. A missing config throws, and the three
  // calls in phase 2 would throw for the same reason, so the page lands in its
  // whole-page-down state and the links never render.
  let baseUrl = "";
  try {
    baseUrl = readStConfig().baseUrl;
  } catch {
    // Left empty on purpose; see above.
  }
```

**(c) `dbOk` returns to phase 1**, for the same reason — phase 3 is its only reader. Two lines: the declaration goes beside `snapshot`'s,

```tsx
  let snapshot: StoredHealth | null | "unread" = null;
  let dbOk = false;
```

and the assignment goes last in the `try`, after `snapshot = stored;`:

```tsx
    snapshot = stored;
    dbOk = true;
```

**(d) Phase 3**, between the phase-2 block and the view models:

```tsx
  // --- Phase 3: the gap read, which needs both ------------------------------
  //
  // fetchLiveAnchorIds is the query the chaser uses for idempotency and this
  // page uses for suppression. Its own try/catch, because it can only run after
  // phase 2 and a failure here means one thing: the gap list is unavailable.
  //
  // Bounded like phase 1, and for the same reason: this is a second Mongo read
  // on the same request, and Mongoose has no per-call timeout. A timeout lands
  // in the catch below, which already produces a designed state — liveAnchorIds
  // stays null and Block E says `Couldn't load what's waiting.` (R63).
  //
  // No .filter(Boolean) on the ids: AttentionItem.replyToLogId is a required
  // string, so it narrowed nothing and only ever dropped empty strings. The ids
  // go into the `$in` unfiltered; an empty id matches nothing and the result
  // loop skips falsy anchors, so the answer is unchanged. The chaser
  // (route.ts:77) still filters, and the difference is deliberate.
  let liveAnchorIds: Set<string> | null = null;
  if (attention !== null) {
    if (dbOk) {
      try {
        liveAnchorIds = await withDeadline(
          fetchLiveAnchorIds(attention.repliedUnanswered.map((item) => item.replyToLogId)),
          MONGO_READ_TIMEOUT_MS,
          "freelance anchor read"
        );
      } catch (err) {
        console.error("[freelance] live-anchor read failed:", err);
      }
    }
  }
```

**(e) `blockE` and `blockA`**, above the `strip` that Task 2 already built. `blockE` is built here and rendered in Task 7; it is *consumed* here, by `needsYouFigure`:

```tsx
  const blockE = buildBlockE({
    now,
    // A gap list built without the suppression set would repeat leads that
    // already have a draft in /queue, which is the one thing this block must
    // never do — so a failed anchor read reads as "couldn't load", not as an
    // unsuppressed list.
    //
    // Written as a two-sided test rather than `liveAnchorIds === null ? null :
    // attention!.repliedUnanswered`: both halves ARE the precondition, and
    // saying both lets the compiler narrow `attention` instead of being told to
    // trust an assertion it cannot check (N8).
    repliedUnanswered:
      attention !== null && liveAnchorIds !== null ? attention.repliedUnanswered : null,
    overdueActions: attention?.overdueActions ?? null,
    liveAnchorIds: liveAnchorIds ?? new Set<string>(),
    contactsBaseUrl: `${baseUrl}/contacts`,
  });

  const blockA = buildBlockA({
    queue: summary?.queue ?? { drafts: null, approved: null },
    contacts: summary?.contacts ?? null,
    // R72: a null summary is a call that did not answer, which is the cards'
    // failed form — `didn't report` means it answered without the field.
    summaryFailed: summary === null,
    // Block A's third card renders the SAME figure Block E renders, by
    // construction rather than by coincidence. This is an IMPORT, not a
    // ternary: the inline `rows ? count : empty ? 0 : null` this replaced
    // collapsed `failed` and `absent` into one null, and the card then said
    // `couldn't load` above a block saying `didn't report` — two registers
    // disagreeing on one screen (R54). needsYouFigure is an exhaustive switch,
    // so a fifth Block E kind is a compile error here rather than a silent
    // fourth reading.
    needsYou: needsYouFigure(blockE),
    draftsUrl: `${baseUrl}/review`,
  });
```

**(f) The render.** Replace the whole-page-down ternary and everything after it, inside `<div className="fl">`, with:

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

**(g) One word out of the phase-1 comment (R72).** Task 2's block wrote `phase 3 (Task 3) is gated on dbOk` — plan scaffolding, addressed to a reader for whom phase 3 did not exist yet. It exists now, so the parenthetical goes and the sentence reads `and phase 3 is gated on dbOk`. Nothing else in that comment moves.

**Two lines worth pausing on.**

`repliedUnanswered: attention !== null && liveAnchorIds !== null ? attention.repliedUnanswered : null` — a `null` there is what makes Block E say `Couldn't load what's waiting.` It covers both "the attention call failed" and "the database read failed", and the second is deliberate: a list built without the suppression set would repeat leads that already have a draft in `/queue`. It replaced `liveAnchorIds === null ? null : attention!.repliedUnanswered` (N8): the assertion was **sound** — `liveAnchorIds` is assigned only inside `if (attention !== null)`, so a non-null `liveAnchorIds` implies a non-null `attention` — but it was sound in a way the compiler could not verify, and the two-sided test states the same precondition in a form it can.

`overdueActions: attention?.overdueActions ?? null` — the field is optional in the contract (`fetchAttention` omits it when the API does), and Plan B's builder already treats `null` as "no overdue rows" rather than a failure.

- [ ] **Step 4: Widen one docblock line in `src/lib/freelanceGaps.ts` (N8)**

A comment-only edit to a Plan B file — no code, no type, no behaviour. `BlockEInput.repliedUnanswered`'s docblock says only half of what a `null` there now means, and phase 3 above is what made the other half true.

Near `freelanceGaps.ts:100`, inside `export interface BlockEInput`:

```ts
  /** null = the attention call failed. */
  repliedUnanswered: AttentionItem[] | null;
```

becomes

```ts
  /** null = the attention call failed, or the suppression set could not be read. */
  repliedUnanswered: AttentionItem[] | null;
```

Verify: `git diff --stat -- src/lib/freelanceGaps.ts`
Expected: `1 file changed, 1 insertion(+), 1 deletion(-)`.

- [ ] **Step 5: Type-check, lint and build**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run lint`
Expected: the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and nothing new.

Run: `npm test`
Expected: every suite still green. This step changes one comment in a Plan B module and must not have moved a test.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Look at it once, on 3001**

**Port 3000 is Riku's — see the ground rules (R62).** After the build above:

Run: `npx next start -p 3001` and open `http://localhost:3001/freelance`.
Expected, against today's real data: three cards on one row — a violet `Drafts` card with `Open ↗` top-right, a hueless `Contacts` card with a 4px track under its figure, and a drained `Needs you` card reading `0` with the caption `nothing waiting` still legible. **All three figures sit on one baseline.** Clicking `Open ↗` opens ShikksTracker's review page in a new tab. Tab to that link and read its accessible name in the browser's accessibility panel: **`Open drafts in ShikksTracker`** (R68), not `Open ↗`.

Then stop the server this plan started, by its PID (ground rules).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/freelance/_blocks/HeroRow.tsx" "src/app/(app)/freelance/_blocks/StateOfPlay.tsx" "src/app/(app)/freelance/page.tsx" src/lib/freelanceGaps.ts
git commit -F - << 'MSG'
feat(p8c): Block A — the hero row, its statement lines, and the gap read

Three cards that never disappear; the tone comes from the view model, which
is where the measured-zero versus never-measured distinction is decided.
The track's width is the page's one inline style, because a percentage is
the datum and cannot live in a stylesheet.

Phase 3 and blockE land here rather than in Task 2, because this is where
they are first read: Block A's third card takes needsYouFigure(blockE), so
the card and the block report one computation and cannot disagree (R54).
The anchor read is bounded like phase 1 (R63), and its null case is written
as a two-sided test rather than a non-null assertion, so the compiler checks
the precondition instead of being told to trust it.

R36: the drafts card's Open link is a plain anchor with target and rel, and
the arrow is a literal character rather than an icon. R68: it also carries
an aria-label, because "Open" alone never said what opens — and this is the
page's one exit to another app.

freelanceGaps.ts gains one docblock word: a null repliedUnanswered now also
means the suppression set could not be read.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 4: Block B — the pipeline

**Files:**
- Create: `src/app/(app)/freelance/_blocks/Pipeline.tsx`
- Modify: `src/app/(app)/freelance/page.tsx`

- [ ] **Step 1: Create `src/app/(app)/freelance/_blocks/Pipeline.tsx`**

**As shipped at `09b465c`; unchanged since `42e2e0a` — no ruling touched this file.**

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

- [ ] **Step 2: Compute `blockB` and render it in `page.tsx`**

Extend the `freelanceView` import — `buildBlockB` arrives with the block that renders it, so this commit adds no unused local:

```tsx
import { FAIL_LINES, buildBlockA, buildBlockB } from "@/lib/freelanceView";
```

Add the component import at the end of the import block:

```tsx
import Pipeline from "./_blocks/Pipeline";
```

Add the view model beside `blockA`, after it:

```tsx
  const blockB = buildBlockB(summary?.contacts ?? null);
```

and add the block inside the fragment, directly after the `.fl-body` div:

```tsx
            <Pipeline block={blockB} />
```

- [ ] **Step 3: Type-check, lint, build and look**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run lint`
Expected: the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and nothing new.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

**Port 3000 is Riku's — see the ground rules (R62).** Run: `npx next start -p 3001` and open `http://localhost:3001/freelance`.
Expected, against today's real data: a mono `PIPELINE` eyebrow, `Your pipeline` at 19px 5px under it, the line `30 contacts · 2 hot` with tabular figures, three rows (`Not started 25`, `Contacted 3`, `Replied 2`) with hairlines between but **none above the first**, and the note `Nothing yet at call booked, proposal sent, won or lost`. Then stop the server this plan started, by its PID (ground rules).

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

**As shipped at `09b465c`; amended after the plan was written by the Batch 3 review's accepted R65 rewording in `2089d00`, and by R75's accepted rewrap in `ad36668`.**

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
 * It STAYS a div, and R65 is why. The cost is a validator complaint and nothing
 * else: <summary>'s content model is phrasing content or a single heading
 * element, so a <div> wrapper inside it is not strictly conformant — with no
 * rendering, assistive-technology or React consequence. What it buys is that
 * <summary> maps to a button-like control with name-from-contents in the major
 * engines, so the eyebrow, the heading and the count reach a screen-reader
 * user as ONE accessible name, roughly "Campaigns Your campaigns 2, collapsed,
 * button". Do not "fix" the <div> back to a <span>: that deletes the <h2> with
 * it, and whether a heading nested inside a button survives into heading
 * navigation varies by browser and screen reader. Certain pedantry is not worth
 * an uncertain loss.
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
      <summary>
        {/* Written inline in the one branch that uses it. The summary row is
            the table state's own, and a `head` hoisted above the guard would be
            built and discarded on the empty and failed paths — and its count
            would need a `kind === "table" ? count : ""` ternary whose second
            arm can never render (S8). */}
        <div className="sumrow">
          <div>
            <span className="eyebrow">Campaigns</span>
            <h2 className="fl-h">Your campaigns</h2>
          </div>
          <span className="fl-count">{block.count}</span>
        </div>
      </summary>
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

- [ ] **Step 2: Compute `blockC` and render it in `page.tsx`**

Extend the `freelanceView` import:

```tsx
import { FAIL_LINES, buildBlockA, buildBlockB, buildBlockC } from "@/lib/freelanceView";
```

Add the component import at the end of the import block:

```tsx
import Campaigns from "./_blocks/Campaigns";
```

Add the view model after `blockB`:

```tsx
  const blockC = buildBlockC(summary?.campaigns ?? null);
```

and add the block after `<Pipeline …/>`:

```tsx
            <Campaigns block={blockC} />
```

- [ ] **Step 3: Type-check, lint, build and look**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run lint`
Expected: the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and nothing new.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

**Port 3000 is Riku's — see the ground rules (R62).** Run: `npx next start -p 3001` and open `http://localhost:3001/freelance`.
Expected: a collapsed row reading `CAMPAIGNS` / `Your campaigns` with `2` to its right and a chevron pointing **right**. Click it — it opens in place, the chevron turns to point **down**, **the count keeps its ink**, and a five-column table appears with `Campaign · Sent · Opened · Clicked · Replied`, `Test One` above `Test number 2`, zeros in `--ink-4`, and the tracking-pixel note with a 13px info glyph under it. Press Tab to it and Enter — it toggles. Then stop the server this plan started, by its PID (ground rules).

**The count does not dim, and that is not a defect (R73).** `components.css:372` — `.disclose[open] .sumrow .fl-count{color:var(--ink-3)}` — sets the same ink as the base `.fl-count` rule, and the mockup's own line 302 is identical, so the earlier wording ("the count dims while open") has never rendered anywhere. The open rule is a recorded no-op the stylesheet shares with the mockup, left byte-identical to it; the open state is carried by the chevron and the table. `--ink-4` in the open rule was the candidate fix and was declined: that is the page's declared absence register, and a campaign total is a measurement.

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

**R66 — an empty Block D group is not drawn, and the view model decides it.** Plan B's Batch 3 review left this open; it is now ruled. Both groups are always built, so if every approach sits on one channel (all email, or none of them email) one group arrives with `rows: []`, and the JSX below would render an eyebrow, an explanation line and a four-column `.fl-thead` with its `--line` rule over nothing — which reads as a table that failed to load, on the block whose whole job is to make *"not measurable"* read as a state rather than an error. Task 5 already applies this principle one task earlier: *a chevron that opens onto one sentence is a control that lies about having content.* An empty group header is the same lie at a smaller scale.

**The decision lives in `freelanceVariants.ts`, not in the JSX.** This page's stated architecture is "a renderer with no opinions in it", and *which groups exist* is a content decision. It is a **value** change inside an existing type — `groups` is already `ApproachGroup[]` — so it is not a Plan B shape change and needs no Plan B conversation.

**Nothing is lost.** `Replies are only detected on email, so these can't be scored.` is a true sentence explaining rows that are not there. Spec §4.4's *"Two groups, always, at equal typographic weight"* is a rule about **weight** — that the not-measurable half is never demoted to a footnote — written in a world where both halves have rows. Suppression demotes nothing; it declines to draw a container for nothing.

**And the block can never render zero groups:** `variants.length === 0` returns `{ kind: "empty" }` before the split, so at least one group always has rows. Steps 1 and 2 pin exactly that, test first.

**`honesty` stays where it is**, guarded on `groupIndex === 0`. Moving it onto the measured group would make R27's *"under the MEASURED group only"* structural rather than positional, but that is a `BlockD` shape change and is **not** taken now. What is taken is the sentence that makes the coincidence legible — it is in the guard's own comment in Step 3.

**Files:**
- Modify: `src/lib/__tests__/freelanceVariants.test.ts` (R66, exception 6 of 8)
- Modify: `src/lib/freelanceVariants.ts` — **one filter** (R66, exception 6 of 8)
- Create: `src/app/(app)/freelance/_blocks/Approaches.tsx`
- Modify: `src/app/(app)/freelance/page.tsx`

- [ ] **Step 1: The test first — `src/lib/__tests__/freelanceVariants.test.ts` (R66)**

Add this to the end of the existing `describe("Block D — the two groups, always", …)` block, after `"names a row by its key when the label is an EMPTY string, not just null"`. It is written in that file's own style: build with the local `variant()` helper, narrow `kind` with the `throw` guard, assert on `groups`.

```ts
  it("draws no group for a half with no rows, and never zero groups (R66)", () => {
    const allEmail = buildBlockD([
      variant({ key: "e1", channel: "email" }),
      variant({ key: "e2", channel: "email" }),
    ]);
    if (allEmail.kind !== "groups") throw new Error("expected groups");
    expect(allEmail.groups).toHaveLength(1);
    expect(allEmail.groups[0].eyebrow).toBe("Measured — email");

    const noneEmail = buildBlockD([
      variant({ key: "f1", channel: "facebook" }),
      variant({ key: "f2", channel: null }),
    ]);
    if (noneEmail.kind !== "groups") throw new Error("expected groups");
    expect(noneEmail.groups).toHaveLength(1);
    expect(noneEmail.groups[0].eyebrow).toBe("Not measurable");

    // The two halves can never BOTH be empty: an empty list returns `empty`
    // before the split, so `groups` is never a zero-length array.
    expect(buildBlockD([])).toEqual({ kind: "empty", line: "No approaches set up." });
  });
```

Run: `npm test src/lib/__tests__/freelanceVariants.test.ts`
Expected: **this test FAILS**, on `expected [ …, … ] to have a length of 1 but got 2` at the first `toHaveLength(1)` — Vitest 4's wording for a length assertion. Both groups are still built unconditionally. Every other test in the file still passes. Do not go on until you have seen that failure.

- [ ] **Step 2: Make it pass — the filter in `src/lib/freelanceVariants.ts` (R66)**

**Two edits, and the second is the Batch 3 review's.** The plan first wrote `.filter(…)` straight onto the `groups: [ … ]` array literal; the Batch 3 quality review found that applying `.filter` to a bare literal turns **excess-property checking off** (verified with the repo's own `tsc`: a stray `honesty` on a group compiled clean that way and errored before), so the two literals were lifted into a typed intermediate in `2089d00`. No behaviour change — both forms are this plan's text. The shipped form:

```ts
  // R66: a group with no rows is not drawn — a ruled .fl-thead over nothing
  // reads as a failed table. Never both: `variants.length === 0` returns above.
  // The annotation is what keeps excess-property checking alive on both
  // literals; `.filter` applied straight to a bare array literal switches it
  // off, so a stray field on a group would have compiled clean.
  const allGroups: ApproachGroup[] = [
    {
      eyebrow: "Measured — email",
      explain: null,
      headers: ["Approach", "Reply rate", "Sends", "Replies"],
      rows: measuredRows,
    },
    {
      eyebrow: "Not measurable",
      explain: "Replies are only detected on email, so these can't be scored.",
      headers: ["Approach", "Reply rate", "Sends"],
      rows: otherRows,
    },
  ];
```

built above the `return`, whose `groups` member then reads:

```ts
    groups: allGroups.filter((g) => g.rows.length > 0),
```

And the `groups` docblock on `BlockD` stops promising a number the filter can no longer keep (the Batch 3 review's accepted list, same commit):

```ts
      /** Always exactly two, in order. */
```

becomes

```ts
      /** One or two, measured group first; a group with no rows is dropped (R66). */
```

**Three existing tests index `groups` by position on single-variant inputs, and the filter moves what those indices point at.** They are amended here, in the same step, because they are the same change:

1. `"drops the replies column from group 2 and keeps sends live"` — its input is one Facebook variant, so the measured group would vanish and `groups[1]` with it. The test is *about the two groups side by side*, so give it a second variant rather than re-pointing the indices:

   ```ts
     it("drops the replies column from group 2 and keeps sends live", () => {
       const out = buildBlockD([
         // One email variant so BOTH groups have rows: R66 drops an empty group,
         // and this test is about the two of them beside each other.
         variant({ key: "e1", channel: "email" }),
         variant({ key: "f1", channel: "facebook", sends: 31, replies: 4 }),
       ]);
   ```

   Every assertion below it is unchanged and still true.

2. `"treats a channel it cannot read as not measurable — never as email"` — its input is one channel-less variant. Under R66 the absence of the measured group *is* the assertion, and says it more directly than `groups[0].rows` being empty:

   ```ts
     it("treats a channel it cannot read as not measurable — never as email", () => {
       const out = buildBlockD([variant({ key: "orphan", label: null, channel: null, sends: 9 })]);
       if (out.kind !== "groups") throw new Error("expected groups");
       // R66: the measured group has no rows, so it is not drawn at all — which
       // is itself the proof that the orphan did not land in it.
       expect(out.groups).toHaveLength(1);
       expect(out.groups[0].eyebrow).toBe("Not measurable");
       expect(out.groups[0].rows).toHaveLength(1);
       // With no label the key is the only name there is.
       expect(out.groups[0].rows[0].name).toBe("orphan");
     });
   ```

3. `"prints no rate for a non-email channel, ever, however many sends it has"` — one Facebook variant, so the surviving group is now `groups[0]`. One index and one comment:

   ```ts
       // R66: with no email variant the measured group is not drawn, so the
       // not-measurable group is groups[0] here.
       expect(out.groups[0].rows[0].cells[0]).toEqual({ text: "—", tone: "dash" });
   ```

No other test in the file touches `groups` by index on a single-channel input; the rest either use `today()` (two of each channel, so both groups survive) or assert only on `collapsed`, `defaultOpen` or `honesty`.

Run: `npm test`
Expected: every suite green, **519 tests**. The suite stood at **518** when this task began — Plan B's 517 plus R72's one test in `freelanceView.test.ts`, which landed in Batch 2 — and Step 1 adds exactly one. The three amended tests are amendments, not additions, so the count rises by one. (The plan said 518 here; corrected in the docs pass under R72.)

- [ ] **Step 3: Create `src/app/(app)/freelance/_blocks/Approaches.tsx`**

**As shipped at `09b465c`; amended after the plan was written by the Batch 3 review's accepted fixes — the R65 rewording and N4's single-group clause — in `2089d00`, and by R75's accepted rewrap in `ad36668`.**

```tsx
import type { BlockD } from "@/lib/freelanceVariants";
import { IconInfo } from "@/components/icons";

/**
 * Two groups at equal typographic weight — and only the ones that have rows.
 * The view model drops an empty group before this file ever sees it (R66), and
 * it can never drop both, because an empty variant list returns `empty` first.
 * The `Not measurable` group keeps its rate column full of em-dashes and drops
 * the replies column entirely; its explanation sits UNDER the group heading and
 * ABOVE its rows, never below as a footnote.
 *
 * Group 2's three-column rows sit in the SAME four-column grid on purpose:
 * .fl-table declares --fl-cols once and serves both groups, so `Approach ·
 * Reply rate · Sends` occupies columns 1–3 and leaves the `Replies` column
 * empty — which is exactly what makes the two groups' Reply rate and Sends
 * columns share an x-position down the whole block. The obvious "fix", an
 * is-3col modifier, would break that alignment (N4). Since R66 a single-group
 * state exists as well — no email variant at all — where the `Not measurable`
 * group's three cells sit alone in the four-track grid with a dead right
 * gutter and nothing left to align to. That is the mockup's own accepted look
 * for group 2, not a bug.
 *
 * The <div className="sumrow"> inside <summary> stays a div, and R65 is why.
 * Against it: <summary>'s content model is phrasing content or a single heading
 * element, so the wrapper is not strictly conformant — a validator complaint
 * with no rendering, assistive-technology or React consequence. For it:
 * <summary> maps to a button-like control with name-from-contents in the major
 * engines, so the eyebrow and the heading reach a screen-reader user as ONE
 * accessible name. Do not "fix" it back to a <span>: that deletes the <h2> with
 * it, and whether a heading nested inside a button survives into heading
 * navigation varies by browser and screen reader. Certain pedantry is not worth
 * an uncertain loss.
 *
 * `open` is passed from the view model's defaultOpen (R31): open only while
 * every approach has zero sends, which is today's state and the clearest single
 * demonstration on the page of "not measurable is not zero". That is why it is
 * passed HERE and never on Campaigns — this block's open state is a claim the
 * data makes, and Campaigns' is not.
 *
 * It is not a controlled value, but it is not frozen either. defaultOpen is
 * `variants.every(v => v.sends === 0)`, so it holds still until the first send
 * lands; when it does, the prop flips true → false on the next render, React
 * writes the attribute back, and the block closes — CORRECTLY, because R31 says
 * it is closed by default once any approach has a send. What cannot happen is a
 * router.refresh() closing a block the reader opened while the numbers are the
 * same on both sides. Only a snap-shut with UNCHANGED data would be a defect,
 * and that is the distinction to watch for, never the flip itself (N11).
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
                decides the second half; this decides the first.

                `groupIndex === 0` is positional, and since R66 it is positional
                against a FILTERED array. It stays correct by coincidence, and
                the coincidence is written down here rather than rediscovered:
                `honesty` is non-null only when a rate was printed, rates exist
                only in the measured group, and the measured group is absent
                only when no email variant exists at all — in which case
                `honesty` is null and this guard never fires. Making it
                structural means carrying `honesty` on the measured group, which
                is a BlockD shape change and a Plan B conversation (R66). */}
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

- [ ] **Step 4: Compute `blockD` and render it in `page.tsx`**

Add the two imports — the builder and the component. The builder is its own line **between the `freelanceView` and `freelanceGaps` import lines**, which is where its path sorts in the block Task 3 left:

```tsx
import { FAIL_LINES, buildBlockA, buildBlockB, buildBlockC } from "@/lib/freelanceView";
import { buildBlockD } from "@/lib/freelanceVariants";
import { buildBlockE, needsYouFigure } from "@/lib/freelanceGaps";
```

and the component at the end of the import block:

```tsx
import Approaches from "./_blocks/Approaches";
```

Add the view model after `blockC`:

```tsx
  const blockD = buildBlockD(variants);
```

and add the block after `<Campaigns …/>`:

```tsx
            <Approaches block={blockD} />
```

- [ ] **Step 5: Type-check, lint, build and look**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run lint`
Expected: the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and nothing new.

Run: `npm test`
Expected: 519 green, as at the end of Step 2.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

**Port 3000 is Riku's — see the ground rules (R62).** Run: `npx next start -p 3001` and open `http://localhost:3001/freelance`.
Expected, against today's real data: the block is **open** (R31 — every approach has zero sends), its chevron points **down**, and the collapsed line is hidden. **Both groups render**, because today's four approaches are two of each channel and R66 only suppresses an empty one: `MEASURED — EMAIL` with a four-column table whose two email rows read `—` for rate and `0` for sends and replies, then `NOT MEASURABLE` with its explanation line above a three-column table whose two Facebook rows read `—` and `0`. The two tables' `Reply rate` and `Sends` columns line up vertically (N4). **No honesty note anywhere** — no rate is printed, so R27 withholds it. Close the block: the collapsed line reads `No sends yet — nothing to compare.` Then stop the server this plan started, by its PID (ground rules).

- [ ] **Step 6: Commit**

```bash
git add src/lib/freelanceVariants.ts src/lib/__tests__/freelanceVariants.test.ts "src/app/(app)/freelance/_blocks/Approaches.tsx" "src/app/(app)/freelance/page.tsx"
git commit -F - << 'MSG'
feat(p8c): Block D — two groups, and the R31 default-open rule

Open by default only while every approach has zero sends — today's state,
and the clearest single demonstration on the page that not measurable is not
zero. The prop is an initial value, not a controlled one, so a refresh
cannot close a block the reader opened.

R66: a group with no rows is not drawn, and the view model decides it. An
eyebrow, an explanation and a ruled header over nothing read as a table that
failed to load, which is the one misreading this block exists to prevent.
Both halves can never be empty at once, because an empty variant list
returns `empty` before the split — pinned by a new test. Three existing
tests indexed groups by position on single-channel inputs and are amended
with the filter.

The honesty note sits under the measured group only, and only when the view
model actually printed a rate (R27). Its guard is positional against a now
filtered array; it stays correct by a coincidence that is written down
beside it rather than left to be rediscovered.

R65: the sumrow div inside summary stays, and the docblock says what it
buys, so nobody trades a heading for a validator's approval. N4: group 2's
three columns sit in the four-column grid on purpose — that shared grid is
what aligns the two tables.

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

**As shipped at `09b465c`; amended after the plan was written by the Batch 3 review's accepted docblock correction in `2089d00` — the empty span reproduces the mockup's slot and keeps every row's DOM shape identical; it holds no column open.**

```tsx
import type { BlockE } from "@/lib/freelanceGaps";

/**
 * Rows built only from fields that exist. An overdue follow-up's channel slot
 * is EMPTY — inapplicable, not unmeasured — so it renders an empty <span/>
 * rather than a tag or an em-dash. The span reproduces the mockup's empty slot
 * and keeps every row's DOM shape identical; it holds no column open. The
 * two-track `.fl-row` grid lays out the same with or without it, unlike
 * Approaches.tsx's .fl-count span, which really is load-bearing in a
 * three-track grid.
 *
 * R36: the business name is a plain <a> leaving the app, with a persistent ↗ as
 * a literal character in a .arr span. The ROW is not an anchor.
 *
 * `Nothing waiting.` is left-aligned where content lives — never centred, never
 * in a dashed box, never with an action pill. It is today's state and it must
 * look intentional.
 *
 * FOUR block kinds since R51, and each has its own register (R59):
 *   failed  .fl-fail    — the attention call, or the suppression read, did not
 *                         land. `Couldn't load what's waiting.`
 *   absent  .fl-absent  — the overdue feed NEVER ARRIVED. --ink-4, and never
 *                         .fl-empty: an absence is not a measured emptiness,
 *                         and this block may not claim nothing is waiting on
 *                         the strength of a feed that never reported.
 *   empty   .fl-empty   — measured, and there is genuinely nothing. --ink-3.
 *   rows    the list    — then .fl-bound, then absentNote, in that order.
 *
 * absentNote renders LAST, AFTER .fl-bound, and the order is load-bearing. The
 * bound is a claim about the list (`Showing 20 of 41.`); absentNote is a claim
 * about the 41 (it may be short). A qualifier goes after the thing it
 * qualifies: put the absence first and the reader meets `didn't report overdue
 * follow-ups` and then `Showing 20 of 41.` and reads the 41 as complete, which
 * is the exact misreading the note exists to prevent. And unlike Block B's
 * pair — .fl-note at --ink-3 above .fl-absent at --ink-4 — BOTH of these render
 * at --ink-4 (components.css:413 and :359), so the inks do not separate them
 * and the order is the only thing carrying which claim is which. Specimen 04's
 * second .mini draws measured-then-absence in that order, and Pipeline.tsx
 * reproduces it; this block must not read backwards from Block B on the same
 * page.
 *
 * Markup is specimen 01 (empty) and specimen 02 (all three row kinds) of
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
        ) : block.kind === "absent" ? (
          // The overdue feed never arrived. --ink-4, not --ink-3: an absence is
          // not a measured emptiness, and this block may not claim nothing is
          // waiting on the strength of a feed that never reported (R51).
          <p className="fl-absent">{block.line}</p>
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
      {/* Last, and after the bound on purpose: the bound is a claim about the
          list (20 of 41), this is a claim about the 41 (it may be short). Both
          render at --ink-4, so order is what tells them apart. */}
      {block.absentNote !== null && <p className="fl-absent">{block.absentNote}</p>}
    </section>
  );
}
```

**`row.snippet` is guarded in the view model, and this task is why (R75).** Both `<div className="fl-snip">{row.snippet}</div>` above and `{row.businessName}` beside it render a contract value as a React child, so an object where a string belongs throws *Objects are not valid as a React child* and 500s the whole route — the failure the degradation design exists to forbid, made reachable by the batch that renders the rows. R74 answered the name and the channel with a row guard in `stApi.ts` (ground rule exception 8); R75 answered the two snippets **in `freelanceGaps.ts` instead**, because dropping a real overdue follow-up over a decorative field would lose the fact to protect the ornament:

```ts
        snippet:
          typeof item.replySnippet === "string" && item.replySnippet
            ? `"${item.replySnippet}"`
            : null,
```

```ts
          snippet:
            typeof item.nextActionNote === "string" && item.nextActionNote
              ? item.nextActionNote
              : null,
```

Each carries its own comment, and two tests in `freelanceGaps.test.ts` pin them: an object where a string belongs leaves the row on screen and the snippet off it. That widened ground rule exception 7 from Task 3's one docblock line to these two lines and those two tests; it landed in `ad36668`, after this task.

- [ ] **Step 2: Render it in `page.tsx`**

**No new computation here.** `blockE` was built in Task 3, because Block A's third card reads it through `needsYouFigure`; this step only renders the value that already exists. Add the import:

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
Expected: the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and nothing new.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

**Port 3000 is Riku's — see the ground rules (R62).** Run: `npx next start -p 3001` and open `http://localhost:3001/freelance`.
Expected, against today's real data: `NEEDS YOU` / `Waiting on you`, no count, and the single line `Nothing waiting.` **left-aligned under the heading**, 20px below it, in `--ink-3`. Note what you cannot see here: `absent`, `absentNote` and `.fl-bound` all need ShikksTracker to answer 200 with a partial body, which no local override can produce — they are on Task 8's unobserved list. Then stop the server this plan started, by its PID (ground rules).

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

R59: four kinds, four registers. `absent` renders in .fl-absent, never in
.fl-empty — an absence is not a measured emptiness, and this block may not
say nothing is waiting on the strength of a feed that never reported. And
absentNote renders last, after the bound: the bound is a claim about the
list, the note a claim about the total, both are --ink-4, so order is the
only thing that separates them.

Claude-Session: https://claude.ai/code/session_01PiTLrSiqmqRUq6P5JuQ4G5
MSG
```

---

## Task 8: Verification

Run every check in order. **Do not claim completion until each one has produced the expected output in front of you.** One item at the end is deliberately *not* claimable by this plan; read step 10 before starting. Step 9 is a list to report, not a check to pass.

**Files:** none modified.

**Every server in this task runs on 3001** — `npm run build` then `npx next start -p 3001`, env overrides prefixed on that command, URLs at `http://localhost:3001/…`, and only the server this plan started is ever stopped, by its PID. **Port 3000 is Riku's dev server**; it is never bound, opened or stopped here (R62, ground rules).

**Two lines of method, both learned in Batch 3 and both load-bearing here (R73's section).**

1. **After every rebuild and restart on 3001, open the URL in a fresh tab or reload the document. Never judge a rebuild by an in-app link click** — the previous build's client bundle answers it, and a stale render then reads as a defect that is not there.
2. **One `curl -sI http://localhost:3001/freelance`** to see the `force-dynamic` page's `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. Observe it **same-origin, with the session cookie**: a cookie-less `curl` gets the proxy's 307 to `/login` and its headers instead.

**One correction to Batch 4's opening chore, recorded because the premise was wrong rather than the fix.** The chore widened `fetchAttention`'s guard so that a 200 whose JSON body is literally `null` is caught before the property access, and it was briefed as a red-first change. It is not: V8's `TypeError` for a property read on `null` **already quotes the property name**, so the prescribed assertion passed before the fix. The discriminating assertion is the ruled **`(got a null body)`** clause, and that is what failed first. Red-first still held — on the second assertion, not the one the brief named. **526 tests from there.**

- [ ] **Step 1: The standing trio**

Run: `npm test`
Expected: every suite passes — Plan A's and Plan B's, all still green, **526 tests**. This plan adds no test *file*; it adds nine tests to four of Plan B's existing files and amends three (R66, R72, R74, R75 and Batch 4's chore — see the ground rules), and it must not have broken anything else.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run lint`
Expected: the four pre-existing `react-hooks/set-state-in-effect` errors and three warnings, and nothing new. Same count as before Plan C began.

Run: `npm run build`
Expected: `✓ Compiled successfully`, with `/freelance`, `/freelance/queue` and `/api/health/sites` in the route table and `/freelance` marked dynamic (`ƒ`).

- [ ] **Step 2: The two greps from spec §9**

Run: `git grep "var(--alert)\|var(--amber)" -- src/ ':!src/styles/tokens.css'`
Expected: **no output**, exit code 1.

**Two things about that command's shape, both learned the hard way.** `tokens.css` is excluded because its own opening block comment, at `tokens.css:17`, is the sentence explaining why those two aliases must not exist — the un-excluded form hits that comment and fails for the wrong reason. And the pathspecs go **after `--`, not before**: with `--` present a leading `src/` written before it is parsed as a revision and the command exits 128 with `fatal: unable to resolve revision: src/`. This is spec §9 item 2's amended form, verbatim.

The stylesheets name `components.html` in their comments on purpose — that is the audit trail the port left — so the second grep looks for a real reference rather than the bare name. This is Plan A's Task 13 step 3 form, unchanged:

Run: `git grep -n -E "(from|import|href|src|url)[[:space:]]*[:=(]?[[:space:]]*[\"'][^\"']*components\.html" src/ public/`
Expected: **no output**, exit code 1.

- [ ] **Step 3: The rules this plan promised to keep**

**These greps are scoped to what Plan C owns**, which is the page and its `_blocks/` — not the whole `freelance/` directory. Since A-2 moved the queue inside this segment (R42), a directory-wide grep sweeps up `queue/PushControls.tsx` and `queue/page.tsx`, which Plan C neither writes nor edits, and the check fails for the wrong reason. Say the distinction out loud, because it is exactly what made these drift: **the *segment* has two client islands — `ViewSwitch` (the header, R42) and `CheckNow` (the page) — while the *page* has one.**

```bash
git grep -n '"use client"' -- "src/app/(app)/freelance/page.tsx" "src/app/(app)/freelance/_blocks"
# exactly one line: _blocks/CheckNow.tsx

git grep -n "fetch(" -- "src/app/(app)/freelance/page.tsx" "src/app/(app)/freelance/_blocks"
# exactly one line: the POST in CheckNow.tsx
# (fetchSummary( / fetchAttention( / fetchVariantStats( / fetchLiveAnchorIds( do
#  not match: the pattern needs "fetch" immediately followed by "(")

git grep -n "dangerouslySetInnerHTML\|NEXT_PUBLIC" -- "src/app/(app)/freelance/page.tsx" "src/app/(app)/freelance/_blocks"
# no output, exit 1
```

**The diff base is `7cbe5d9`** — HEAD at the start of Plan C, verified 2026-09-09: nothing under `src/styles/`, `src/proxy.ts`, `src/app/(app)/freelance/queue/`, `package.json`, the lockfile or `next.config.ts` had changed since it. The old base, `169c21e`, predates the stylesheets entirely, and its last pathspec named `src/app/(app)/queue/`, a directory A-2 moved — so it matched nothing and would have passed for the wrong reason.

Run: `git diff --stat 7cbe5d9..HEAD -- package.json package-lock.json next.config.ts src/proxy.ts`
Expected: **no output.** No new dependency, no CSP change, no proxy edit.

The queue directory needs its own line, because R64 legitimately adds one file to it and R18 forbids touching anything else there:

Run: `git diff --stat 7cbe5d9..HEAD -- "src/app/(app)/freelance/queue/"`
Expected: **exactly one file, `src/app/(app)/freelance/queue/layout.tsx`, all insertions** — the metadata layout created in Task 2 step 5. `queue/page.tsx` and `queue/PushControls.tsx` must not appear. Either of them appearing means R18 was broken, whatever the diff says it changed.

Run: `git diff --stat 7cbe5d9..HEAD -- src/styles/`
Expected: exactly one file, `src/styles/components.css`, at **`1 file changed, 2 insertions(+), 1 deletion(-)`** — R60's widened selector plus the one comment line above it (Task 1 step 3), and nothing else. Any other file under `src/styles/`, or any larger count, is a stylesheet edit this plan did not authorise.

Run: `git -C ../ShikksTracker status --porcelain`
Expected: **no output.**

- [ ] **Step 4: By eye against the mockup, on real data, at a viewport wide enough for the column**

**Port 3000 is Riku's — see the ground rules (R62).** Run `npm run build`, then `npx next start -p 3001`. `next start` reads `.env.local` exactly as `next dev` does, so the server calls the **real** ShikksTracker API; it also cannot hot-reload, so what you are looking at is the committed code and nothing else. Open `docs/design/p8-mockup.html` in one Chrome tab and `http://localhost:3001/freelance` in another, at **a viewport wide enough for the 170 + 920 column** (170px rail + 28px + 920px column + 28px + scrollbar — nominally 1240px, but the number is not the test; the specimen fixes the column, and a display at DPR 1.25 may top out below 1240 CSS px, which is fine), and compare against **specimen 01**:

1. **The hero row.** Three cards, one row, equal heights. All three **figures share one baseline** and all three captions start on one line — including when the `Needs you` caption is the short `nothing waiting`.
2. **The three tones.** Drafts violet on its tinted card; Contacts near-white on a plain `--raised` card; Needs you fully drained at `0` with its caption still `--ink-3` and clearly brighter than the figure above it.
3. **The track.** A 4px bar under the contacts figure only, ground `#1A1E25`, fill `--ink-4`, **no hue**, and its width matches `not_started / total`.
4. **The two disclosures.** Campaigns closed with its count at the right and a chevron pointing **right**; Approaches **open** with its chevron pointing **down** and its collapsed line hidden. Click each: they open and close in place, and the chevron rotates over ~140ms. **The campaigns count keeps its ink through the toggle** — `.disclose[open] .sumrow .fl-count` sets the same `--ink-3` the base rule sets, byte-identical to the mockup's own line 302, so it is a recorded no-op and **not** a failure (R73).
5. **Block D open.** Two groups at equal weight, `MEASURED — EMAIL` above `NOT MEASURABLE`, the explanation line under the second heading and above its rows, four columns in the first table and three in the second, every rate an em-dash in `--ink-4`, every `0` in `--ink-4`, and **no honesty note**.
6. **`Nothing waiting.`** Left-aligned under `Waiting on you`, no box, no pill, no centring.
7. **The quiet strip.** One hairline, one 11px line reading `Engine ran Nh ago · all sites ok · checked Nh ago` with `·` in `--ink-4`, and `Check now` pushed right as an outline pill.
8. **The rail beside it.** Six agent badges live, `Freelance` marked active with the raised fill and inset hairline, and the `#0B0D11` column reaching the bottom of the viewport — `/freelance` is the shortest page in the app and the one that would expose R33 failing.
9. **The console.** Clean. No CSP violation, no hydration warning, no request to `fonts.googleapis.com` or `fonts.gstatic.com`.
10. **The alarm strip — against the mockup, not the app.** The app cannot produce this state locally: `SITES` is a hardcoded `const` in `src/lib/siteHealth.ts` (three real Vercel URLs) and the engine findings come from whatever ShikksTracker reports. So check it the only way it can be checked: read **specimen 02's `.fl-health.alarm`, mockup lines 949–958** (the mockup's only alarm strip), beside `components.css:469–483` — 468–482 before Task 1's one-line comment insertion — and confirm the shipped rules draw what the specimen draws — the bordered `--panel` card with `--r-card` corners, three `.fl-warn` rows on a `5px minmax(0,1fr)` grid with 5px hued dots and a `0 0 6px` glow, `.fl-fine` indented 14px, `.fl-stamp` indented 14px with `Check now` pushed right by `.fl-health .btn{margin-left:auto}`. **Then confirm R60 landed:** `.fl-health .line .aged` (Task 1 step 3) now matches a nested `.aged` inside `.fl-stamp .line`, so R57's amber stamp renders in the alarm form as well as the quiet one. This is the block whose whole premise is *the state where the strip stops being a footer and becomes a bordered card you cannot miss* — it must not ship unlooked-at just because it cannot ship rendered.
11. **`.fl-bound` — against the stylesheet, since no specimen draws it.** `components.css:413`: 11.5px, `--ink-4`, `margin-top: var(--sp-3)`, body face and sentence case, **not** mono caps — a statement to the reader, not a machine label. Confirm the JSX in `Campaigns.tsx` and `NeedsYou.tsx` renders it as a bare `<p className="fl-bound">` with no wrapper that would change its top margin.

- [ ] **Step 5: `Check now`, and the disclosure state surviving `router.refresh()`**

With the `npx next start -p 3001` server still running and `http://localhost:3001/freelance` open:

1. **Open Campaigns** (it is closed by default) and leave Approaches open.
2. Press **`Check now`**. The label becomes `Checking…` and the button disables.
3. When it settles: the stamp has updated, **both disclosures are still in the state you left them**, and the page did not flash empty — the previous reading stayed on screen throughout.
4. Press `Check now` **twice inside a minute**. No error, no 429 in the Network tab; the second press returns 200 with the existing reading. The label never becomes `Couldn't check` — that is R67's failure string and it is not expected here.

**If a disclosure snaps shut here *while the underlying data is unchanged*, stop.** It means React is writing the `open` attribute back on reconcile, and the fix is to stop passing `open` to that element — not to add client state.

**The qualifier is load-bearing, because one flip is legitimate and must not be "fixed".** `open={block.defaultOpen}` is `variants.every(v => v.sends === 0)`. If the first send lands between the render and the `router.refresh()`, that prop genuinely goes true → false, React writes it, and Block D closes — **correctly**, because R31 says the block is closed once any approach has a send. Deleting the `open` prop to stop that would delete R31. Look at the data before you conclude anything: only a snap-shut with the same underlying numbers on both sides is the defect this step is watching for.

- [ ] **Step 6: Whole page down, once, on purpose**

Stop the server this plan started (ground rules), then start it again with the override prefixed on the same `next start`, so the three ShikksTracker calls all fail:

```bash
ST_API_BASE_URL="https://shikkstracker.invalid" npx next start -p 3001
```

No rebuild is needed: `ST_API_BASE_URL` is read at request time under `force-dynamic`, so a build made without it is fine. And Next does not overwrite an env var already present in `process.env`, so this inline value beats `.env.local`. Open `http://localhost:3001/freelance`.

Expected: the title, then a `.fl-fail` block — a 5px red dot with a glow, `Couldn't reach ShikksTracker.` at 13px `--ink-2`, and the explanation under it at 12.5px `--ink-3` capped at 62ch — and then the health strip, which **still works** because site results are stored locally. **Blocks A to E are absent, not drawn drained.** `Check now` still functions. The page renders inside `ST_PAGE_TIMEOUT_MS`, not after fifteen seconds.

Stop that server and start it again without the override, to confirm the page comes back.

- [ ] **Step 7: Re-run Plan A's by-eye list on the finished page**

Plan A's Task 13 step 5 was written when `/freelance` was a title and nothing else. It is now both the shortest page in the app (its failure state) and the fullest (its normal state), so it is the right surface to re-check the shell against. With `npx next start -p 3001` running, walk Plan A's Task 13 step 5 items **1 to 6** again on `/freelance` specifically:

1. The three faces render — Archivo on the figures and headings, IBM Plex Sans on the sentences, JetBrains Mono on every eyebrow, label and tag. **Not the stamps:** the top-bar crumb and the strip's own line are IBM Plex Sans with tabular numerals, as the mockup has them, so a mono stamp is the failure here, not the pass.
2. Six agent badges live in the rail, in execution order, green ones without captions.
3. `/freelance/queue` and `/settings` still work under the shell with exactly one `Log out`.
4. `/freelance` marks Freelance active in the rail; `/freelance/queue` marks **Freelance** active in the rail and **Queue** in the view switch (R42 — one address, two views).
5. No CSP violation and no console error on any of the three pages.
6. The rail's ground reaches the bottom of the viewport — **on `/freelance` in its whole-page-down state**, which is the shortest the page ever gets.

Also re-run Plan A's Task 13 step 6 once, since the rail's degraded state now has a full page beside it. Stop the server this plan started, then:

```bash
MONGODB_URI="mongodb+srv://nobody:nobody@nowhere.invalid/rikuos" npx next start -p 3001
```

Expected on `http://localhost:3001/freelance`: six grey `—` badges in the rail, **and the page still renders** — Block A's `Needs you` card reads `—` with the caption `couldn't load`, Block E says `Couldn't load what's waiting.`, and the strip stamps **`sites — unknown`** (R56), **not** `sites never checked`. The distinction is the whole point of the `"unread"` sentinel: `never checked` is a claim the strip may only make when the read *succeeded* and found nothing. Everything ShikksTracker answers is still on screen. Then stop that server.

- [ ] **Step 8: The combined worst case, which is one command away**

Step 6 killed ShikksTracker; step 7 killed Mongo; nothing so far has run both. Together they are the state the whole degradation design exists for, and it is the only render in the app where the two "unknown" registers sit on one line:

```bash
ST_API_BASE_URL="https://shikkstracker.invalid" MONGODB_URI="mongodb+srv://nobody:nobody@nowhere.invalid/rikuos" npx next start -p 3001
```

Expected on `http://localhost:3001/freelance`: the `.fl-fail` block above a strip reading `Engine — unknown · sites — unknown` — the failed-summary engine phrase beside the R56 stamp, separated by the `--ink-4` middot. `Check now` still renders and is still pressable. **Press it once:** the POST cannot write, so the route answers non-2xx and the button reads **`Couldn't check`** (R67). This is the one place in the plan where that string can be seen locally, so look at it: sentence case in the DOM, uppercased by `.btn` to `COULDN'T CHECK`, and **cleared when the next press begins** — `setFailed(false)` runs in the same batch as `setPosting(true)`, so in an always-failing environment like this one the next press reads `Checking…` and then `Couldn't check` again; it never returns to `Check now` while the POST keeps failing. Then stop that server.

- [ ] **Step 9: What this plan ships without ever seeing**

Not a check — a **named list**, so the lead knows what is unobserved rather than assuming the by-eye steps were exhaustive. Every state below needs ShikksTracker to answer **200 with a partial body**, which no local override can produce: killing the host produces `failed`, not `absent`, and there is no way from here to make it answer while omitting a block.

**Mockup-checkable — look at these before claiming Task 8, they cost two minutes:**

1. **The `.stat.blank` card beside a drained one.** Specimen 04's third `.mini` draws the pair: the drafts card at `—` with the two-line caption `ShikksTracker didn't report how many drafts are waiting` beside the needs-you card at `0`. Check it against `.stat .sub` at `components.css:286–289`, whose `min-height:32px` exists precisely so a two-line caption sits beside a one-line one without moving the card — the comment above it names the 219–297px card widths where the "didn't report" captions wrap and `nothing waiting` does not. Step 4 item 1 does **not** test this — its `couldn't load` caption does not wrap.
2. **Both of Block B's absence lines.** Specimen 04's second `.mini` draws `<p class="fl-note">` (measured, `--ink-3`) above `<p class="fl-absent">` (never reported, `--ink-4`), in that order — which is the same order R59 fixes for Block E, and the reason it is that order.

**Deployed-only — these go to spec §9 item 4 and are Riku's to see, not this plan's:**

3. Block E's `absent` line, `ShikksTracker didn't report overdue follow-ups.` in `.fl-absent` (R59, M1).
4. Block E's `absentNote`, the same sentence beneath measured rows (R59, M2).
5. Block A's third card in its absence form — `—` with the caption `ShikksTracker didn't report overdue follow-ups` (R54).
6. Block B's `hotAbsentNote` and `absentNote`.
7. `.fl-bound` in **either** block — no specimen draws it, and today's data is far under the bound of 20.
8. `.fl-say`'s `2 approved, not yet sent` — `lines` is `[]` unless `queue.approved > 0`, and today's numbers give none, so `StateOfPlay` is a component this plan never sees render.
9. R50's fallback `Nothing waiting on you.` — it needs four *measured* zeros and is suppressed by any absence.
10. R57's amber aged stamp **inside the alarm form** — the rule is checked against the stylesheet at step 4 item 10, but the render needs a stale engine and a >30h reading at the same time.

**Report this list with the task.** A state that ships unlooked-at is not a defect; a state that ships unlooked-at and unrecorded is.

- [ ] **Step 10: The D11 observation — pending, and this plan does not claim it**

Spec §9 item 4 requires `/freelance` **rendered on Vercel** with today's real ShikksTracker numbers and nothing typed by hand, with the rail's six badges live beside it, `Check now` pressed once and then twice inside a minute.

**Steps 4 to 8 satisfy every part of that against real data, but locally.** The deployed half cannot be done from this plan: the repo commits on `master` and never pushes, and deploying is Riku's action.

So this step is a **handoff, not a check**:

> Riku pushes `master`, waits for the Vercel deployment, opens `/freelance`, and confirms: the three real figures match what ShikksTracker shows, the six rail badges show real agent states, `Check now` updates the stamp, and a second press inside a minute produces no error.

**The executor must report §9 item 4 as PENDING and must not mark it done.** The lead reports it as pending until Riku confirms. Everything else in this plan can be claimed complete.

- [ ] **Step 11: Final state**

Run: `git status --porcelain`
Expected: **no output** — everything is committed.

Run: `ls "src/app/(app)/freelance/_blocks/"`
Expected: exactly eight files — `Approaches.tsx`, `Campaigns.tsx`, `CheckNow.tsx`, `HealthStrip.tsx`, `HeroRow.tsx`, `NeedsYou.tsx`, `Pipeline.tsx`, `StateOfPlay.tsx`. **Still eight** — R64 added no block. No ninth file: Plan A's Series file map lists these eight and a new one would need a new decision.

Run: `ls "src/app/(app)/freelance/queue/"`
Expected: `layout.tsx` beside the existing `page.tsx` and `PushControls.tsx` — the metadata layout R64 added, and nothing else new.

Run: `git grep -n "RAIL_READ_TIMEOUT_MS" src/`
Expected: **no output**, exit code 1. The constant moved to `src/lib/deadline.ts` as `MONGO_READ_TIMEOUT_MS` (R63); a surviving hit means `AgentsBlock.tsx` kept its own copy and the two Mongo paths can drift again.

---

## Checkpoints from Plan B — ruled 2026-09-09

Plan B is closed (517 tests, `tsc` clean, build clean, 35 commits since `7cbe5d9`). It left this plan seven amendments and four standing questions. **All eleven are now ruled** — R59 to R68 and the accepted-without-a-number items, in `docs/superpowers/design/p8-team/round4-lead-rulings.md`, "Rulings on Plan C before it is built". Every one is written into the text above; they are listed here in one place so a reviewer can tick them. **Seven more rulings — R69 to R75 — came out of the batch reviews during the build**; they are in the same file, batch by batch, and in the Post-build record below.

**The seven amendments, all applied:**

- [x] **ruled: R37** — the page reads `chaserNDays` and `monitoringEnabled` through `readOsSettings()`, never `getOsSettings()`. Prose, import and call site, in `readLocal()` (Task 2 step 1).
- [x] **ruled: R56** — the phase-1 `catch` sets `snapshot = "unread"` and the declaration is `StoredHealth | null | "unread"`; a timeout lands in the same catch (Task 2 step 1).
- [x] **ruled: R54** — Block A's third card reads `needsYou: needsYouFigure(blockE)`, imported, never an inline ternary (Task 3 step 3e).
- [x] **ruled: R51 + R59** — `BlockE` is a four-member union, and `NeedsYou.tsx` renders `absent` in `.fl-absent` and `absentNote` last, after `.fl-bound` (Task 7 step 1).
- [x] **ruled: R67** — `CheckNow` reads `res.ok`, and a failed check is **not** swallowed: `Couldn't check` for a non-2xx and a thrown fetch alike (Task 1 step 1). **R69 then fixed the order in which it is said:** `failed` is tested before `busy`, or the button reads `CHECKING…` through the whole refresh and says R67's failure as its opposite for up to 16 s.
- [x] **ruled: R66** — a Block D group with zero rows is not drawn, decided in `freelanceVariants.ts` and pinned by a test (Task 6 steps 1–2). **the Batch 3 review then moved the two literals into a typed `const allGroups: ApproachGroup[]`**, because `.filter` on a bare array literal had switched excess-property checking off.
- [x] **ruled: R47's principle (Batch 4)** — `HealthStrip.tsx` points at `freelanceHealth.ts`'s marker paragraph rather than copying it (Task 1 step 2).

**The four standing questions, all answered:**

- [x] **ruled: R63** — `withDeadline` on **both** Mongo reads, with `MONGO_READ_TIMEOUT_MS = 5000` exported from `src/lib/deadline.ts`, R38's intended home. `AgentsBlock.tsx` drops its module-local copy and imports it, and takes `DASH` while it is open. The `maxDuration` comment is rewritten to say it is a containment bound. Budget 5 + 6 + 5 = 16 s (Task 2 steps 1–3).
- [x] **ruled: R64** — `/freelance` exports `metadata.title = "Freelance"`, joined by a `title.template` in the root layout, with a new `freelance/queue/layout.tsx` for the other view. `/settings` and `/login` fall through to the default (Task 2 steps 1, 4, 5).
- [x] **ruled: R65** — the `<div className="sumrow">` inside `<summary>` **stays**, and both docblocks say why: the cost is a validator complaint, the alternative risks a heading, and the wrapper is what buys one accessible name (Tasks 5 and 6, step 1 each).
- [x] **ruled: R50, unchanged** — `StateOfPlay` renders `blockA.lines` as it stands. Confirmed by reading, not assumed; the fallback is on Task 8 step 9's unobserved list because today's data never produces it.

**And the items accepted without a number, also applied:**

- [x] **S8** — `Campaigns.tsx`'s `head` moved inline into the table branch and the dead ternary is gone (Task 5 step 1).
- [x] **S9** — the deviations section says the two R36 anchors are covered by the ground rule and are not counted (header).
- [x] **N4** — one docblock line in `Approaches.tsx` on the shared four-column grid (Task 6 step 3).
- [x] **N5** — spec §4.3's "directly under the table" sentence amended to the plan's bound-then-honesty order, in the spec, not here.
- [x] **N6** — line 1369's justification is now "two shapes, not one shape copied" (self-review below).
- [x] **N7** — one clause in `HealthStrip.tsx`'s docblock on content-derived keys (Task 1 step 2).
- [x] **N8** — the `repliedUnanswered` restructure, `.filter(Boolean)` dropped, and `freelanceGaps.ts`'s docblock widened (Task 3 steps 3d, 3e, 4).
- [x] **R60** — the aged-stamp selector loses `.quiet`; the plan's one CSS edit (Task 1 step 3).
- [x] **R61 / R62** — Task 8's apparatus rebuilt, and every server on 3001.
- [x] **R68** — the drafts card's link carries `aria-label="Open drafts in ShikksTracker"` (Task 3 step 1).
- [x] **The lead's own** — `OS_SETTINGS_DEFAULTS.chaserNDays` replaces `DEFAULT_CHASER_N_DAYS`; each block is computed in the task that renders it; every check step runs lint; the segment ground rule reworded with seven named exceptions, since widened to eight by R71, R72, R74 and R75; Plan A's Series file map gains the rows.

**For Riku, when he next reviews:** `Couldn't check` is the **fourth** provisional string, on the pile with the other three. The `aria-label` is information, not a confirmation item.

---

## Post-build record

What actually landed, in order, so a later reader is not left inferring it from `git log`. Base `7cbe5d9`, the same base Plan B took, with the pre-build rulings on top; every commit on `master`, unpushed. Four batches, each implementer → spec reviewer → quality reviewer → fix → read-only re-review, all Opus, the lead never coding, every look a production build on port 3001. **The code is done at `09b465c`.**

- **Before the build** — `91eaf99` and `99931fd`. The lead read all 1,384 lines against HEAD; a Plan Checker verified 58 contracts against the shipped code and found eleven text mismatches, and the Design Critic's round 6 raised 5 must-fix, 9 should-fix and 12 notes. **R59–R68** came out of that read and are ticked one by one in the section above; a Spec Editor amended the plan in place under them (`99931fd`), and that is the text the four batches were built from. **R67** is the only one of the ten that added a string — `Couldn't check` — and it is the fourth awaiting Riku.

- **Batch 1, Tasks 1–2** — `49155b5` (Task 1: `CheckNow.tsx`, `HealthStrip.tsx`, R60's selector) and `b87b5ab` (Task 2: `page.tsx` phases 1–2, `MONGO_READ_TIMEOUT_MS` in `deadline.ts`, `AgentsBlock.tsx`'s constant and `DASH` swaps, the root title template, `queue/layout.tsx`), then `a907eee` (the rulings), `950cf0d` (the fix) and `04de80b` (four comment nits, carried into Batch 2's opening chore). The spec review found every file byte-identical to the plan. **The quality review was dispatched and stopped at the session close before it reported, so it was re-run in full the next session** rather than assumed: 517 tests, `tsc` clean, lint at the four pre-existing errors and three warnings, build clean. Every focus item came back OK on the mechanism — the state machine never re-enables between the POST and the refresh, the 401 path really lands on `/login`, no key can collide in any state `buildHealthStrip` produces, R60's selector matches in both forms and reaches nothing else, a timed-out `readLocal()` leaves only discarded reads and an intact cache, no error it can throw carries the URI. No Critical, no Important; six Minor. **Approved with fixes.**

  **R69 — a failed press says `Couldn't check` at once, not after the refresh.** The label tested `busy` before `failed`, and `busy` stays true through the unconditional `router.refresh()` that follows a failure — so with Atlas and ShikksTracker both down the button read `CHECKING…` for the whole re-render, up to this page's own 16 s budget, and only then said what had happened. R67 asked for the failure in the button's register; for that window it was said as its opposite. The ternary became `failed ? … : busy ? … : …`; `disabled={busy}` is unchanged, and the next press still opens on `Checking…` because `setFailed(false)` runs in the same batch as `setPosting(true)`. Two docblock corrections rode with it: the one case where the message is *lost* (a flip between the strip's two forms puts `<CheckNow />` at a different position and React remounts it with `failed=false` — a lost message, never a false claim), and the component that actually answers the 401 (`src/proxy.ts`'s fail-closed check at `proxy.ts:100–102`, with the `(app)` layout as defence in depth behind it).

  **R70 — a ShikksTracker rejection is logged, with the call named.** `settled<T>()` discarded `result.reason` while phase 1's failure was logged four lines away, so `Couldn't reach ShikksTracker.` on screen had no diagnostic behind it — although `stApi`'s error messages were written to say exactly which of 401 / 503 / 404 / timeout it was. CLAUDE.md's "no silent failure" is about diagnosis as much as the screen. `settled` took a `label`, logs `console.error` on a rejection and returns `null` as before; the three call sites pass `"summary"`, `"attention"` and `"variant stats"`. Verified safe: no `stApi` error interpolates the secret or the base URL, and `readStConfig` omits the secret from its message by design.

  **R71 — the rail logs the same failure the page logs.** `AgentsBlock.tsx` swallowed its read failure with a bare `catch {}`: the badges say `—`, which is honest on screen, but a database outage on every page view left no line in the log. With the page's payload proven URI-safe the rail took the same one line, and ground rule exception 3 widened by it. Outside the plan's named swaps; the lead's call, taken because the file was already open under R63 and two components logging one failure two ways is the drift the rule exists to prevent.

  **Accepted without a number:** the phase-1 comment names a **fourth** degradation it had claimed did not exist — `chaserNDays` falls back to `OS_SETTINGS_DEFAULTS.chaserNDays` — and says why it is harmless (`days` bounds only `repliedUnanswered` upstream, and phase 3 is gated on `dbOk`, so a list drawn on a guessed window is discarded before anything renders it); Task 3 was **not** changed. The `maxDuration` docblock's "instead of 60" became "instead of the platform's own default", since Vercel's default varies by plan and compute mode and the repo cannot verify it. Recorded as decisions, no change: the POST has no client-side timeout, like every client fetch in the repo, and the route's `maxDuration` bounds it; the strip's key uniqueness rests on `SITES` never gaining a duplicate name, which nothing enforces and nothing today violates.

  **Two process notes from the batch, neither Plan C's:** `npx tsc --noEmit` can fail spuriously on `.next/dev/types/validator.ts` when Riku's dev server has regenerated the route types before a production build has — errors only under `.next/**` are that artifact, so run `npm run build` before `tsc` whenever a task adds a routable file. And a Mongoose `findOneAndUpdate` `new`-option deprecation warning fires on first render, from `osSettings.ts:49` and `queue.ts:404`.

- **Batch 2, Tasks 3–4** — `bff64d9` (Task 3: `HeroRow.tsx`, `StateOfPlay.tsx`, phase 3, `blockE`, `blockA`, the `freelanceGaps.ts` docblock) and `42e2e0a` (Task 4: `Pipeline.tsx`), then `544ee24` (the rulings), `5159de1` (the fix) and `d97119e` (three nits, carried into Batch 3's opening chore). The spec review found no deviation, and both handed-down checklist items confirmed: the fourth-degradation claim rests on the `dbOk` gate and the two-sided `liveAnchorIds` test, and the 16 s figure became true when the anchor read landed. The quality review: build clean, `tsc` clean, lint 4/3, 517 tests; `trackPercent` clamped by construction, the CSP's `style-src 'unsafe-inline'` permits the one inline style, every key unique by construction, the empty `Set` provably dead, all four Block E kinds reachable and mapped to the deck's cards. One Important, twelve Minor. **Approved with fixes.**

  **R72 — a failed summary call is a failure on the hero cards, not an absence.** `page.tsx` collapsed `summary === null` into `queue: { drafts: null, approved: null }` and `contacts: null`, and Plan B's factories then read `ShikksTracker didn't report how many drafts are waiting` / `…how many contacts there are` — but the deck defines those strings as *"the API replied but omitted the field"*, and a 6 s timeout on the summary endpoint, or a 500 on that one route while attention and variants answer, is neither. Below them Block B said `Couldn't load the pipeline.` about the same event: two registers for one cause on one screen, the exact class R54 removed between the third card and Block E. The remedy is R54's own and adds **no string** — the hero register already owns `couldn't load`. `BlockAInput` gained `summaryFailed: boolean`; when true, `draftsCard` and `contactsCard` return the R54 shape (`tone: "blank"`, `figure: DASH`, `caption: "couldn't load"`, the drafts link kept as in every state), and when false an omitted field keeps its `didn't report` caption, which is then true by the deck's own definition. The lines are unaffected. One test pins all three cards in one register, and the count became **518**. **The reverse case stands as Plan B recorded it:** a summary that answered without a `contacts` block gives the card `didn't report` and Block B `Couldn't load the pipeline.` — the deck offers no absence sentence for a whole block and none was invented. And the ruling covered Tasks 5 and 6 in advance: `summary?.campaigns ?? null` and a null `variants` reach builders whose `null` already means *failed*, so no collapse exists there and nothing changed.

  **Accepted comment fixes**, all in the same commit: the timeout count word ("four" → "five", stale by one since the anchor read); the view-models header, false since Task 3, rewritten in the R47 form that stays true through Task 7; the `.filter(Boolean)` note's last clause, which claimed `fetchLiveAnchorIds` ignores empty ids when in fact they enter the `$in` and only the result loop skips falsy anchors; the `phase 3 (Task 3)` scaffolding parenthetical; and in `HeroRow.tsx` three lines on the `aria-label`'s coupling to the one card with a link, on Label in Name and the unutterable `↗`, and on the track's dependence on `style-src 'unsafe-inline'` in `next.config.ts:57` — a hardened header would fail *silently* to a 100 % bar, because `.track i` has no width rule. **Not changed, on the record:** the nested `if (attention !== null) { if (dbOk) {` stays; an empty `.fl-stages` div renders when the summary reports a total and omits every stage — harmless, recorded so Task 8 would not mistake it for a bug.

- **Batch 3, Tasks 5–7** — `daf82bc` (Task 5: `Campaigns.tsx`), `b90f4ba` (Task 6: R66's test and filter, `Approaches.tsx`) and `113a983` (Task 7: `NeedsYou.tsx`), then `4d3ce81` (R73–R74), `2089d00` (the fix), `ed58557` (R75, raised by the re-review), `ad36668` (the second fix) and `09b465c` (two nits, carried into Batch 4's opening chore). The spec review found no deviation — the R66 test and its three amendments exact with no fifth hunk. The quality review verified React 19.2.4's prop diff from source (an absent `open` is never written, an unchanged `open` is never re-written, so a refresh can neither close Campaigns nor re-open a closed Approaches, and R31's `true → false` flip is the only write), the R66 honesty-guard coincidence exactly true through `email → measured → honesty`, no cross-kind id collision in Block E, and the `force-dynamic` page's `no-store` from Next's own source. Three Important, six Minor. **Approved with fixes**, twice.

  **R73 — the count does not dim; the record says so.** `components.css:372` sets the same ink as the base `.fl-count` rule, and the mockup's own line 302 is identical, so "the count dims while open" — spec §4.3, and this plan's Task 5 step 3 and Task 8 step 4 item 4 — had never rendered anywhere. The candidate fix, `--ink-4` in the open rule, was declined: `--ink-4` is the page's declared absence register, a campaign total is a measurement, the dimmed figure would sit directly above an open table whose measured zeros and dashes are at `--ink-4`, and the open state is already carried by the chevron and the table. R29 stands — amend the record, never the mockup — so **no code changed**, the stylesheet stays byte-identical to the mockup, and the dead rule is written down here so it is not rediscovered as a bug.

  **R74 — the attention feed is guarded like its siblings, and the local bound becomes real.** `fetchSummary` drops a campaign row without a string `id` and `fetchVariantStats` drops a variant without a string `key`; `fetchAttention` cast the whole payload. Two raw values reach the DOM through Task 7 — `businessName` in `NeedsYou.tsx`'s link text and an unmapped `channel`, since `labelFor` returns the raw value on a miss — so one row with an object where a string belongs would throw *Objects are not valid as a React child* and 500 the whole route: the exact failure CLAUDE.md's degradation rule forbids, made reachable by the batch that renders the rows. `fetchAttention` now **filters and never reconstructs**, because the chaser consumes the same rows — a `repliedUnanswered` item survives only if `contactId`, `businessName`, `replyToLogId`, `channel` and `repliedAt` are all strings and the first three non-empty; an `overdueActions` item only if `contactId`, `businessName` and `nextActionAt` are strings and the first two non-empty. Batch 2's first carry-forward rode along, since the function was open: `repliedUnanswered` is `.slice(0, limit)` after the filter, so `ATTENTION_LIMIT` bounds this side too and `fetchLiveAnchorIds`'s docblock claim became true. Three tests; the count became **522**. This opened **ground rule exception 8**, `src/lib/stApi.ts` and its test.

  **R75 — the two snippets degrade, a missing reply block throws, and dropped rows are said out loud.** The Batch 3 re-review approved `2089d00` and then found a hole in R74's own list, raised to the lead rather than filed against the commit. (a) R74 named two raw values; there are four. `freelanceGaps.ts` passed `nextActionNote` through untouched — an object there still throws and 500s the route by one field — and wrapped `replySnippet` in a template literal, which does not throw but prints `"[object Object]"` in quotation marks as if it were the customer's words. Both were fixed **in the view model, not the guard**: dropping a real overdue follow-up over a decorative field would lose the fact to protect the ornament, so the row survives and the note does not. That widened exception 7 from one docblock line to two guarded lines and two tests. (b) Row-level parity was now real; block-level was not. `fetchVariantStats` throws on a non-array body, while `fetchAttention` read a non-array `repliedUnanswered` as `[]` — so a contract break made Block E say `Nothing waiting.` and the digest count zero: a false all-clear, the exact null-versus-zero failure these rules forbid. All three consumers already meet a rejection with a designed state (the page's `settled` → `Couldn't load what's waiting.` and the card's `—`; the morning job's `.catch` → "unavailable" with the reason logged; the chaser's run fails and pushes), so `fetchAttention` now **throws**, in `fetchVariantStats`'s message style. (c) Neither guard logged, so a contract break showed only as leads quietly missing: one `console.warn` now names how many rows were dropped and from which block, only when the count is not zero, counts-only and free of row content. The count became **525**.

  **Accepted comment and test fixes:** `freelanceVariants.ts`'s `groups` docblock (`Always exactly two, in order.`) is false since R66 and became "One or two, measured group first; a group with no rows is dropped (R66)"; R66's `.filter` on a bare array literal had turned excess-property checking **off** — verified with the repo's own `tsc` — so the two literals moved into `const allGroups: ApproachGroup[]`, no behaviour change, both forms this plan's text; `NeedsYou.tsx`'s docblock stopped claiming its empty `<span />` holds a grid column, which is false for a two-track grid; the R65 paragraphs softened `role="button"` to "a button-like control with name-from-contents in the major engines"; and `Approaches.tsx`'s N4 paragraph gained a clause on the single-group state R66 made possible — three cells in the four-track grid with a dead right gutter, the mockup's own accepted look for group 2, not a bug.

- **Batch 4, Task 8** — `09b465c`, then **Task 8 run in full, every check passing**. The opening chore's brief carried a wrong premise, recorded because the premise was wrong rather than the fix: V8's message for the null property access already quotes `repliedUnanswered`, so the prescribed assertion passed before the fix, and the test gained a second assertion on the ruled `(got a null body)` clause, which failed first. The guard reads the body as `unknown` and casts only after it; the needless warn stub is gone. **526 tests.**

  **What was observed.** Step 1: 526 tests across 29 files, `tsc` clean, lint 4/3 pre-existing, build with the three dynamic routes. Step 2: both greps empty. Step 3: exactly one `"use client"` and one `fetch(`, both `CheckNow.tsx`; no `dangerouslySetInnerHTML` and no `NEXT_PUBLIC`; no diff to `package.json`, the lockfile, `next.config.ts` or `src/proxy.ts` since `7cbe5d9`; the queue directory's only change `layout.tsx`; `src/styles/` exactly `2 insertions(+), 1 deletion(-)`; `../ShikksTracker` clean. Step 4, on the production build at a 1218-px viewport (1240 is not reachable on this display at DPR 1.25, and the 170 + 920 column is what the specimen fixes): the three cards on one baseline with all three captions on one line, the three tones at their token values, the one track at `83%` with no hue, both disclosures behaving with the chevron's `.14s` rotation, **R73's no-op observed live** — the count is `--ink-3` closed and open, byte-identical to the mockup — Block D's two groups at equal weight with no honesty note, `Nothing waiting.` left-aligned, the quiet strip reading `Engine ran 3h ago · all sites ok · checked 4h ago`, six live badges and the rail's ground reaching the document's bottom, an empty console with seventeen same-origin requests and no Google Fonts; item 10 by a rule-for-rule diff of the `.fl-health*` family against the mockup showing exactly one difference, R60's; item 11 against `components.css:413`. `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` observed same-origin. Step 5: `Check now` → `Checking…` (disabled) → the stamp moving from `checked 4h ago` to `checked 0h ago`, both disclosures kept, the hero figures constant throughout; three POSTs inside a minute, all 200, never `Couldn't check`. Step 6: `.fl-fail` with the deck's two sentences, Blocks A–E absent, the strip alive at `Engine — unknown · all sites ok · checked 0h ago`, `Check now` working, render 611 ms; the page came back in full without the override. Step 7: the three faces where the plan puts them; six badges in execution order, green ones without captions; `/freelance/queue` and `/settings` under the shell with one `Log out` each; Freelance active in the rail on both views and Queue in the switch; empty consoles; the rail's ground at document height in the shortest state. Degraded rail: six grey `—` badges, the page rendering, the third card `— / couldn't load`, Block E `Couldn't load what's waiting.`, the strip `Engine ran 3h ago · sites — unknown` and `never checked` nowhere. Step 8: `Engine — unknown · sites — unknown` above `.fl-fail`, one press → the POST 503 → `Couldn't check` in sentence case, uppercased to `COULDN'T CHECK`. Step 11: tree clean, eight block files, `layout.tsx` beside the two queue files, `RAIL_READ_TIMEOUT_MS` gone. Five servers on 3001, each stopped by PID; **3000 untouched throughout**.

  **What ships unobserved.** Step 9's list was reported in full and its two mockup-checkable items were checked — the `min-height:32px` mechanism seen working in step 4, with the drafts caption wrapped to two lines beside a one-line `nothing waiting` and all three cards holding 132 px, and Block B's `.fl-note` above `.fl-absent` pair. The eight deployed-only states stand as the plan listed them: Block E's `absent` line and its `absentNote`, Block A's third card in its absence form, Block B's `hotAbsentNote` and `absentNote`, `.fl-bound` in either block, `.fl-say`'s `2 approved, not yet sent`, R50's `Nothing waiting on you.` fallback, and R57's amber aged stamp inside the alarm form. Every one needs ShikksTracker to answer **200 with a partial body**, which no local override can produce.

  **Step 10, spec §9 item 4: PENDING, and Riku's.** The local halves are done against real data; the deployed half is not this plan's to claim. Riku pushes `master`, waits for the Vercel deployment, opens `/freelance`, and confirms the three real figures, the six live rail badges, `Check now` updating the stamp, and a second press inside a minute producing no error.

  **Plan-text corrections found by the verifier, all applied in this docs pass:** the chevron reads **right when closed and down when open** (the plan said down-right / up-right); step 7 item 1's mono list drops "stamp"; step 8's "cleared to `Check now` on the next press" becomes "cleared when the next press begins", because in an always-failing environment the next press goes `Checking…` → `Couldn't check`; and "at 1240px" becomes "a viewport wide enough for the 170 + 920 column".

**Four strings await Riku's confirmation**, presented as one checklist and marked provisional in the content deck until he answers: `ShikksTracker didn't report overdue follow-ups.` (Block E) and its hero-caption form without the full stop (Block A's third card) — one pair, R51 and R54 — `sites — unknown` (Block F, R56), and **`Couldn't check`** (the button after a failed check, R67). The first three are Plan B's; the fourth is this plan's. **The `aria-label` `Open drafts in ShikksTracker` is information, not a confirmation item** (R68) — it is the card's own caption, added because the link's whole accessible name was `Open ↗` and nothing in it said what opens.

**Carried forward, none of it Plan C's to fix:**

- `fetchLiveAnchorIds` projects the whole `payload` — draft bodies included — to read one id. `{ "payload.replyToLogId": 1 }` when `queue.ts` is next opened. It stayed a carry-forward rather than joining R74 because it is a different file, shared with the chaser.
- **An object `replySnippet` still throws chaser-side** (`chaser.ts:129`, `.trim()` on a non-string), inside the per-lead `try`, costing one lead and the "some leads failed" push but never the run. That is the trade R74 made and R75 confirmed: `fetchAttention` filters on five fields while the `raw is AttentionItem` predicate asserts twelve, and every consumer of the unchecked seven sits inside that `try/catch`. R75's view-model fix was ruled for the page path only.
- **The transient `?_rsc=` prefetch 503s across server restarts** — seen in Task 8, not reproducible on demand, every navigation fine. Recorded, not filed.
- **`/settings` reads `RikuOS` alone**, by R64's design: a page that exports no title falls through to the root `default`. Not a missing title.
- Two smaller things seen in the Batch 3 re-review and left alone: two older tests in `describe("fetchAttention")` still hand-roll what the file's `respondWith` helper now does, and `queue.ts:486` names `ATTENTION_LIMIT` where the chaser path bounds by `CHASER_ATTENTION_LIMIT` (both 50).
- **Plan B's carry-forward "`fetchAttention` validates no field of `AttentionItem`" is DISCHARGED** by R74 and R75 — the boundary read it asked for landed the moment this plan rendered the rows. So is Plan B's `DASH` carry-forward on `AgentsBlock.tsx`, discharged by R63.
- Two older manual items stay open at Riku's choice: the optional `Send test` push, and whether the switch's `#101318` track reads right on specimen 07.

---

## Self-review

**1. Spec coverage.** Every section in Plan C's scope maps to a task:

| Spec | Task |
|---|---|
| §7.4 `page.tsx`: `force-dynamic`, `maxDuration = 30`, the `Promise.allSettled` fan-out, `ST_PAGE_TIMEOUT_MS` on all three calls | 2 |
| §7.4 the two URLs built server-side from `readStConfig().baseUrl` | 3 |
| §7.4 the local reads (`connectDB`, `readOsSettings`, `getHealthSnapshot`) in `try/catch` | 2 |
| §7.4 `fetchLiveAnchorIds`, in its own `try/catch` | 3 |
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
| **R59** Block E's `absent` in `.fl-absent`, and `absentNote` last, after `.fl-bound` | 7 |
| **R60** the aged-stamp selector loses `.quiet`; the plan's one CSS edit | 1 |
| **R61** Task 8's apparatus — the greps, the `7cbe5d9` base, the lint expectation, the alarm form, `.fl-bound`, the unobserved list, the reworded stop-rule | 8 |
| **R62** port 3000 is Riku's; every look is a production build on 3001 | Ground rules, and every look step in 2–8 |
| **R63** `withDeadline` on both Mongo reads; `MONGO_READ_TIMEOUT_MS` in `deadline.ts`; `AgentsBlock` imports it and takes `DASH`; the `maxDuration` comment rewritten | 2 (steps 1–3), 3 (step 3d) |
| **R64** the tab title — root template, `title: "Freelance"`, `queue/layout.tsx` | 2 (steps 1, 4, 5) |
| **R65** the `sumrow` `<div>` inside `<summary>` stays, and both docblocks say why | 5, 6 |
| **R66** an empty Block D group is not drawn; the view model decides it; one new test, three amended | 6 (steps 1–3) |
| **R67** a failed `Check now` says `Couldn't check` | 1 |
| **R68** the drafts link's `aria-label` | 3 |
| §9 items 1–3 | 8, steps 1–3 |
| §9 item 4 | 8, steps 4–10 — **local halves done, deployment handed to Riku, reported PENDING** |
| Plan A Task 13 by-eye re-read on the finished page | 8, step 7 |

**One thing I could not plan as written, and one I resolved against the mockup:**

- **§9 item 4 cannot be claimed by this plan.** It requires a Vercel render, the repo never pushes, and deploying is Riku's action. Task 8 step 10 states it as a handoff and forbids the executor from marking it done.
- **`<summary>` conformance versus real headings.** The ruling asks for `<h2 className="fl-h">`; `<summary>`'s content model is phrasing content or a single heading element, so the `<div className="sumrow">` wrapper this forces is not strictly conformant. Implemented as ruled, cost stated in the deviations section with the one-word alternative if the lead prefers conformance.

**Three places the shipped code, the mockup and the spec disagreed:**

1. **The mockup's `<span className="fl-h">` and `<h3 className="fl-title" style="margin:0">`** versus the ruling's real headings. Followed the ruling; the margins that made the mockup use inline styles were moved into `components.css` in `94eddc9`, so nothing shifts. Wrappers containing an `<h2>` became `<div>` (deviation 2).
2. **The mockup's inline `margin-top:6px` on the hot `.fl-absent` line** is specimen-frame tuning inside `.mini`, which is mockup-only chrome. Not ported; `.fl-absent`'s own 10px applies (deviation 3).
3. **`.stat-top .more` already carries `border-bottom:0` in the shipped CSS**, added by the quality review "now rather than in Plan C". That anchor costs no CSS edit. **R60 does**, and it is the only one: `.fl-health.quiet .line .aged` could not match in the alarm form, so R57's amber stamp had no rule to render under. Task 8 step 3 therefore expects `src/styles/components.css` in the diff at exactly `2 insertions(+), 1 deletion(-)`, and nothing else under `src/styles/`.

**A fourth, smaller one, resolved by repetition rather than a new file:** the `.fl-fail` markup (four lines) appears in `page.tsx` and in each of the four blocks that can fail. The reason is not economy — a shared `FailLine` would be a ninth file in `_blocks/`, which Plan A's Series file map forbids, but that is the weaker half of the argument. **The real reason is that these are two shapes, not one shape copied:** the page-level copy carries `.said` **and** `.because`, the four block-level copies carry `.said` alone. A `FailLine` component would need an optional second line that four of its five callers pass as `undefined` (N6). If the lead wants it factored out anyway, that is a map change first.

**2. Placeholder scan.** No `TBD`, no `TODO`, no "implement later", no "similar to Task N", no "handle edge cases". Every code step carries a complete file or the exact lines to add, and every command carries its expected output. Task 8 step 10 is a named handoff with an explicit "do not mark done", and step 9 is a list to report rather than a check to pass — neither is a placeholder.

**3. Type consistency.** Checked against Plan B's "Types Plan C will render", which this plan consumes unchanged:

- `StatCard` — `key`, `tone`, `label`, `figure`, `caption`, `href`, `trackPercent`. `HeroRow` reads exactly those seven and renders `className={`stat ${card.tone}`}`, which matches `.stat.roi` / `.stale` / `.plain` / `.drained` / `.blank` in `components.css`.
- `SayLine` — `figure: string | null`, `text`. `StateOfPlay` keys by `text`, which is unique per line.
- `BlockB` — the three-member union `failed` / `empty` / `stages`; `Pipeline` handles all three, and reads `summary.total`, `summary.totalWord`, `summary.hot`, `summary.hotWord`, `rows[].key/label/count`, `emptyNote`, `absentNote`, `hotAbsentNote`.
- `BlockC` — `count`, `headers`, `rows[].id/name/cells`, `bound`, `honesty`. Cells are keyed by `headers[index + 1]`, which is why `headers` has one more entry than `cells`.
- `BlockD` — `defaultOpen`, `collapsed` (the `statement` / `best` union), `groups[].eyebrow/explain/headers/rows`, `honesty`. `ApproachRow.cells` is 3 long in the measured group and 2 long in the other, and both are keyed by `group.headers[index + 1]`. **Since R66, `groups` carries one entry or two, never zero** — a value change inside the same `ApproachGroup[]` type, so the contract is untouched and `Approaches.tsx` maps whatever arrives without knowing how many there are.
- `BlockE` — a **four**-member union since R51: `failed` / **`absent`** / `empty` / `rows`. `absent` carries a `line` (`ShikksTracker didn't report overdue follow-ups.`) and renders in the `.fl-absent` register, never as `Nothing waiting.`; `rows` carries `count`, `rows[].id/kind/businessName/href/channel/waiting/waitingIsStale/snippet/reason`, `bound` and **`absentNote: string | null`**, the same sentence beneath measured rows when only the overdue feed is missing. `NeedsYou.tsx` must render both. `channel === null` renders the empty span.
- `BlockF` — `quiet` with `parts: HealthPart[]`, `alarm` with `warnings`/`fine`/`stamp`. `HealthWarning.tone` is `"stale" | "missing"`, and `.fl-warn.is-stale` / `.fl-warn.is-missing` are the two classes in `components.css`, so `is-${warning.tone}` is exhaustive.
- `FAIL_LINES.page.said` / `.because` are the only two `FAIL_LINES` members this plan reads directly; the four per-block sentences arrive inside their block's `failed` member.
- Every class name used here exists in the shipped `src/styles/components.css`: `.stats`, `.stat`, `.stat-top`, `.lbl`, `.more`, `.fig`, `.track`, `.sub`, `.fl-say`, `.fl-sect`, `.eyebrow`, `.fl-h`, `.fl-title`, `.fl`, `.fl-body`, `.fl-sum`, `.fl-stages`, `.fl-stage`, `.nm`, `.ct`, `.fl-note`, `.fl-absent`, `.fl-empty`, `.disclose`, `.sumrow`, `.fl-count`, `.fl-collapsed`, `.fl-open`, `.fl-table`, `.is-campaigns`, `.fl-thead`, `.fl-trow`, `.zero`, `.dash`, `.fl-group`, `.fl-explain`, `.fl-bound`, `.honesty`, `.fl-headrow`, `.fl-rows`, `.fl-row`, `.fl-biz`, `.arr`, `.tag`, `.pwhen`, `.is-stale`, `.fl-snip`, `.fl-why`, `.fl-fail`, `.said`, `.because`, `.fl-health`, `.quiet`, `.alarm`, `.line`, `.aged`, `.fl-warn`, `.is-missing`, `.fl-fine`, `.fl-stamp`, `.btn`, `.app-content`.

**One of those was true of the token and false of the render, and R60 fixed it.** `.aged` existed only as `.fl-health.quiet .line .aged`, so the class name was in the stylesheet but no rule matched it in the alarm form — the claim above passed a grep and failed a browser. With the selector widened and both branches nesting the span the same way, it is now true of both. That is the shape of error this list is easiest to be wrong about: a class name exists, and the *selector* it lives in does not reach where the markup puts it.
