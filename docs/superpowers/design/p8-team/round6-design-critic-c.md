# P8 round 6 — the Design Critic on Plan C

**Date:** 2026-09-09 · **Role:** review `docs/superpowers/plans/2026-09-07-p8c-freelance-page.md` (1,384 lines, working-tree copy) — every JSX block, the three recorded deviations, Task 8's verification, and the four standing questions — against `docs/design/p8-mockup.html` as the markup truth, the ratified visual spec `2026-09-07-p8-freelance-page-visual-design.md`, the content deck `2026-09-05-p8-freelance-page-content.md`, the shipped `src/styles/*.css`, Plan B's four view-model modules, and rulings R25–R58.

**Reviewed:** specimens 01, 02, 04 and 07 of the mockup element by element against the seven components; `components.css` lines 33–500 declaration by declaration; `freelanceView.ts`, `freelanceGaps.ts`, `freelanceVariants.ts`, `freelanceHealth.ts`, `format.ts` in full; `stApi.ts`'s four signatures and three payload types; `deadline.ts` and `AgentsBlock.tsx`; `db.ts`, `healthSnapshot.ts`, `siteHealth.ts` and `api/health/sites/route.ts`; the shipped `(app)/layout.tsx`, `freelance/layout.tsx` and `app/layout.tsx`. **Every mechanical check in Task 8 steps 2–3 was run** against the current tree, read-only. No file was edited, no build or test was run, nothing on port 3000 was touched.

---

## 1. Verdict

The markup is right. I diffed all seven components against their specimens element by element, class by class, and traced every JSX whitespace boundary by hand — the middots carry no literal spaces, the `<i />` markers and the empty `<span />` slots are exactly the mockup's, `↗` is a literal character in both places, the five-column `is-campaigns` table is correct, and the two `<span>`→`<div>` wrappers move nothing. Type consistency against Plan B holds at every call site I checked, including the two the plan flags. That is genuinely good work and most of this review is not about it.

What is wrong is concentrated in two places, and both are places where the mockup could not help. **The states the mockup never drew are the ones the plan gets wrong:** Block E's `absent` kind renders in the wrong register, `absentNote` is not rendered at all, and R57's amber aged stamp is invisible in the alarm form because no stylesheet rule matches the class the plan writes — and Task 8 never renders the alarm form, so it would ship unseen. Separately, **the plan's whole verification apparatus is stale**: all five mechanical checks in Task 8 steps 2–3 fail today, before Plan C writes a line, and every by-eye step drives a `npm run dev` at `localhost:3000`, which is Riku's server and which the plan repeatedly instructs the executor to Ctrl-C.

Five must-fixes, nine should-fixes, twelve notes. Two of the must-fixes (M1, M2) are the lead's rulings not landing in code; one (M3) needs a decision because it cannot be fixed inside the plan's own no-CSS-edits rule; two (M4, M5) are mechanical and cost nothing but attention. Rulings needed from the lead: M3, and the four standing questions in §4.

---

## 2. Must fix

### M1 — Block E's `absent` kind renders in `.fl-empty`, the measured-emptiness register

**Where.** Plan lines 1074–1091 (`NeedsYou.tsx`). The guard is `if (block.kind !== "rows")`, the ternary is `block.kind === "failed" ? <div className="fl-fail">…</div> : <p className="fl-empty">{block.line}</p>`, so `absent` and `empty` land on the same element with the same class.

**What that renders.** `ShikksTracker didn't report overdue follow-ups.` in `.fl-empty` — `font-size:13px; color:var(--ink-3)` (`components.css:360`) — the identical treatment as `Nothing waiting.`. Both strings are quoted from `src/lib/freelanceGaps.ts`: `OVERDUE_ABSENT_LINE` and the `empty` branch's `line`.

**Fails.** R51 in terms: *"`line` is the new deck string **`ShikksTracker didn't report overdue follow-ups.`** in the `.fl-absent` register"*. Spec §4.5: *"a fourth state beside `failed` / `empty` / `rows`, **in the `.fl-absent` register**"*. And `components.css:356–359`, whose own comment is the rule: `.fl-note` = a measured emptiness, `.fl-absent` = the field never arrived, `--ink-4` reserved for the absences. Deck §9 checklist item 4 — *"Not reported" is visually distinct from "0"* — is the page's headline requirement and this is the one place the plan breaks it.

**Also fails the plan's own self-review**, line 1380: *"`absent` carries a `line` … and renders in the `.fl-absent` register, never as `Nothing waiting.`"* The prose says one thing and the code block does another. That is the pattern to watch for in this plan; it recurs at M2.

**Fix.** Split the three non-`rows` kinds instead of two:

```tsx
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
```

`.fl-absent{font-size:11px;color:var(--ink-4);margin-top:var(--sp-3)}` is 10px under the heading rather than `.fl-empty`'s 20px, which is correct: an absence note is a footnote, an answer is not.

---

### M2 — `absentNote` is never rendered, and the plan says it is

**Where.** Plan line 1124 is the last thing in the `rows` branch: `{block.bound !== null && <p className="fl-bound">{block.bound}</p>}`. There is no `absentNote` anywhere in `NeedsYou.tsx`. Contrast `Pipeline.tsx`, which gets the equivalent pair right at plan lines 677–678.

**Fails.** R51: *"`{ kind: "rows"; …; absentNote: string | null }` carries the same sentence under the measured rows when gaps exist and the overdue feed is missing"* and *"with `NeedsYou.tsx` rendering the `absent` line **and the `absentNote`**"*. Spec §4.5: *"**Measured rows with the overdue feed missing** → the rows render normally and one `.fl-absent` note carries the same sentence beneath them"*. The plan's own checkpoint at line 1321 — *"`NeedsYou.tsx` renders both"* — and its self-review at line 1380 — *"`NeedsYou.tsx` must render both"* — both assert it. Neither is true of the code block.

**What it costs.** The count in `.fl-count` beside `Waiting on you` is the number of *measured* rows. Without the note, a reader who sees `12` takes 12 as the total, when the overdue feed — the amber `.pwhen.is-stale` class, the rows R53 reordered the whole block to protect — is silently missing from it. That is the same error R50/R51/R54 were written to stop, arriving through the one door left open.

**Where it sits, and why.** **After `.fl-bound`, last in the block.** Reasoning, in order of weight:

1. `.fl-bound` (`Showing 20 of 41.`) is a claim about the *list*: these 20 are 20 of the 41 the page measured. `absentNote` is a claim about the *41*: it may be short. A qualifier goes after the thing it qualifies. Put the absence first and the reader meets `didn't report overdue follow-ups` and then `Showing 20 of 41.` and reads the 41 as complete — the exact misreading the note exists to prevent.
2. It matches the precedent the mockup actually draws. Specimen 04's second `.mini` (mockup lines 1133–1142) renders `<p class="fl-note">Nothing yet at won or lost</p>` and then `<p class="fl-absent">ShikksTracker didn't report every pipeline stage.</p>` — measured statement, then absence, last. Plan C's own `Pipeline.tsx` reproduces that order at lines 677–678. Block E should not read backwards from Block B on the same page.
3. Both are non-null together in a real state (21+ reply gaps with no overdue feed), and unlike Block B's pair — `.fl-note` at `--ink-3`, `.fl-absent` at `--ink-4` — **both of Block E's lines are `--ink-4`** (`.fl-bound` and `.fl-absent`, `components.css:413` and `:359`, 11.5px and 11px). The inks do not separate them, so the *order* is the only thing carrying which claim is which. That makes getting it right load-bearing here in a way it is not in Block B.

**Fix.** Replace plan line 1124 with:

```tsx
      {block.bound !== null && <p className="fl-bound">{block.bound}</p>}
      {/* Last, and after the bound on purpose: the bound is a claim about the
          list (20 of 41), this is a claim about the 41 (it may be short). Both
          render at --ink-4, so order is what tells them apart. */}
      {block.absentNote !== null && <p className="fl-absent">{block.absentNote}</p>}
```

---

### M3 — R57's amber aged stamp cannot render in the alarm form, and Task 8 never renders the alarm form

**Where.** Plan line 170 (`HealthStrip.tsx`, alarm branch):

```tsx
        <span className={strip.stamp.aged ? "line aged" : "line"}>{strip.stamp.text}</span>
```

**What is wrong, twice over.** `git grep -n aged src/styles/` returns exactly one rule, `components.css:464`:

```css
.fl-health.quiet .line .aged{color:var(--stale)}
```

It is scoped to `.quiet` **and** it is a descendant selector. The alarm branch fails both tests: the container is `.fl-health.alarm`, and the plan puts `aged` *on* `.line` rather than inside it. The only rule that matches is `.fl-stamp .line{…color:var(--ink-3)}` (`components.css:482`). So in the alarm form, `sites not checked since 2d ago` renders in ordinary grey and looks like `checked 6h ago`.

**The state is real and it is the one R57 is about.** `buildHealthStrip` computes `stamp` before it counts warnings and hands the same object to both returns (`freelanceHealth.ts`, the `alarm` return). `aged: monitoringEnabled` is true whenever monitoring is on and the stored reading is older than `AGENT_STALE_HOURS`; warnings arrive from `evaluateOutreach` or from a down site. Engine stale plus a 40-hour-old reading is not an exotic combination — it is the morning after the site-health cron misses, which is exactly why R57 exists.

**Fails.** R57 (*"the aged branch reads `aged: monitoringEnabled`; the text stays because it is true"* — the words survive, but the hue that makes them a statement rather than a timestamp does not). Spec §4.6: *"the stamp becomes an amber statement (`.aged`, `--stale`)"* and the table row *"the stamp | never hued, except by the 30-hour rule below"*. And the plan's own self-review claim at line 1401, *"Every class name used here exists in the shipped `src/styles/components.css`"* — `.aged` exists, but only as a descendant of `.fl-health.quiet .line`, so the claim is true of the token and false of the render.

**Why it would ship unseen.** Task 8 renders the quiet strip three times — step 4 item 7, step 6, step 7 — and the alarm form **zero** times. It is not locally forceable either: `SITES` is a hardcoded `const` in `src/lib/siteHealth.ts:27–31` (three real Vercel URLs), and the engine findings come from whatever ShikksTracker happens to report. So the block whose whole design premise is *"the state where the strip stops being a footer and becomes a bordered card you cannot miss"* (mockup line 753) is never once looked at, and the defect inside it is invisible.

**This one needs a ruling**, because the plan's ground rule at line 63 is *"`src/styles/*.css` is not edited. If a rule seems to be missing, stop and raise it."* I am raising it. Three ways out, in my order of preference:

- **(a) Broaden the selector and nest the span in both forms.** One CSS line changes and one JSX line changes; Plan C stops being a no-CSS-edits plan, which is a real loss to its story. Markup: `<span className="line">{strip.stamp.aged ? <span className="aged">{strip.stamp.text}</span> : strip.stamp.text}</span>` — identical in shape to the quiet branch. CSS: `.fl-health.quiet .line .aged` → `.fl-health .line .aged`. This is my recommendation: the rule was always about the stamp, not about the quiet form, and the `.quiet` in the selector is an artefact of the mockup only ever drawing one of them.
- **(b) Add `.fl-stamp .line.aged{color:var(--stale)}`** beside line 482 and keep the plan's markup. One CSS line, no JSX change, but the page then has two ways of writing "aged" and the next person has to know which form they are in.
- **(c) Accept grey in the alarm form and say so in the spec.** Defensible in one narrow sense — inside a bordered alarm card the reader is already alerted, so the stamp's amber is doing less work. I do not recommend it: the aged stamp and the warnings are claims about *different subjects* (the reading's age versus the sites' and engine's state, a distinction `freelanceHealth.ts`'s own header spends a paragraph on), and greying it makes an unsupported reading look like a current one on the one screen where a reader is already worried.

Whichever is taken, **add the alarm form to Task 8** — see S6.

---

### M4 — every mechanical check in Task 8 steps 2 and 3 fails today, before Plan C writes a line

I ran all five, read-only, at `747958c` + the working tree. Not one produces its stated expected output.

| Plan line | Command | Stated expectation | What it actually does now |
|---|---|---|---|
| 1207 | `git grep "var(--alert)\|var(--amber)" src/` | no output, exit 1 | **1 line, exit 0** — `src/styles/tokens.css:17`, the comment that explains why those aliases must not exist |
| 1213 | the `components.html` grep | no output, exit 1 | ✅ passes (verified: exit 1) |
| 1216 | `git grep -n "dangerouslySetInnerHTML\|NEXT_PUBLIC" "src/app/(app)/freelance/"` | no output, exit 1 | **2 lines, exit 0** — `freelance/queue/PushControls.tsx:45,47` |
| 1220 | `git grep -n "\"use client\"" "src/app/(app)/freelance/"` | exactly one line | **3 lines** — `ViewSwitch.tsx`, `queue/PushControls.tsx`, `queue/page.tsx` |
| 1223 | `git grep -n "fetch(" "src/app/(app)/freelance/"` | exactly one line | **5 lines** — two in `queue/PushControls.tsx`, three in `queue/page.tsx` |
| 1226 | `git diff --stat 169c21e..HEAD -- … src/styles/ … "src/app/(app)/queue/"` | no output | **723 insertions across 5 files.** `169c21e` is *"docs(p8a): the shell-and-skin implementation plan"* — the stylesheets did not exist yet (`git ls-tree 169c21e -- src/styles` is empty), and `src/app/(app)/queue/` never existed at that commit and does not exist now: A-2 moved it to `src/app/(app)/freelance/queue/`, so that pathspec matches nothing and would pass for the wrong reason even if the baseline were right — the failure mode §9 item 5 already warns about in a different guise |
| 1158 | `npm run lint` — *"Expected: no errors"* | no errors | lint exits 1 with the four pre-existing `react-hooks/set-state-in-effect` errors carried from Plan A |

**Causes, and they are three.** Steps 3's greps were written against the pre-A-2 tree, where `/queue` lived outside `src/app/(app)/freelance/`. Step 2's first grep predates today's amendment to spec §9 item 2, which now reads `git grep "var(--alert)\|var(--amber)" -- src/ ':!src/styles/tokens.css'` **with the pathspecs after `--`**, and records that the un-excluded form hits `tokens.css:17` and fails for the wrong reason. The lint line predates the Plan B ruling that lint expectations read *"no new errors"*.

**Why it is a must-fix and not a tidy.** An executor working the plan literally stops at Task 8 step 2, or — worse — reads five failing checks as noise and starts deleting them. A check that has never passed teaches the next person that the checks are decorative.

**Fix.** Take §9 item 2's amended form verbatim for the first grep. Scope the three `freelance/` greps to what Plan C actually owns, which is the page and its `_blocks/`:

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

Note the prose at plan line 1221 (*"the page's only client code"*) needs one clause too: after A-2 the **segment** has two client islands, `ViewSwitch` (the header, R42) and `CheckNow` (the page). The plan's claim is true of the page and false of the directory, which is precisely why the grep drifted.

For the diff check, capture the baseline rather than hardcoding a stale one — `BASE=$(git rev-parse HEAD)` recorded at Task 1 step 0, or `747958c` written down as *HEAD at the start of Plan C* — and repoint the last pathspec to `"src/app/(app)/freelance/queue/"`. And change Task 7 step 3's lint expectation to **"the four pre-existing errors and three warnings, and no new ones"**.

---

### M5 — every by-eye step drives `npm run dev` on port 3000, which is Riku's server, and the plan tells the executor to stop it

**Where.** Plan lines 425, 590, 710, 854, 1020, 1164 (`Run: npm run dev … open http://localhost:3000/freelance … Stop the server with Ctrl-C`), 1234 (the 1240px comparison), 1262 and 1285 (the two env-override runs).

**The fact.** `netstat` shows PID **75844** listening on `:3000` right now. That is Riku's dev server, the same PID the rulings file records as *"Riku's dev server on port 3000 (PID 75844, not ours)"*. It holds a signed-in session.

**The three consequences, all bad.** Next will not bind 3000, so it silently takes the next free port and every URL in the plan is wrong. If the executor opens `localhost:3000` anyway it is looking at **Riku's** server — which, running from this same working tree, will hot-reload Plan C's files, so the verification appears to work while running under Riku's session and Riku's process. And "Stop the server with Ctrl-C", repeated six times, is an instruction that at best stops the wrong thing and at worst ends Riku's session mid-task. None of this is recoverable by care at execution time; it has to be written into the plan.

**Fix.** Put a standing note at the head of Task 2 step 3 and Task 8, and change every command:

> **Port 3000 is Riku's dev server and is never bound, opened, or stopped by this plan.** Every check below runs a production build on **3001**: `npm run build` then `npx next start -p 3001`, and every URL is `http://localhost:3001/…`. The two env-override runs prefix that same `next start` — `ST_API_BASE_URL` and `MONGODB_URI` are read at request time under `force-dynamic`, so a build made without them is fine, and Next does not overwrite a variable already present in `process.env`, so the inline value still beats `.env.local`. **Cookies are not port-scoped**, so the session Riku already holds on `:3000` authenticates `:3001` in the same browser profile — there is nothing to sign in to and nothing to sign out of. Stop only the server this plan started.

Two things this also buys, worth naming rather than discovering: a production build is the surface §9 item 6's route table and the `force-dynamic` marker are actually about, and `npx next start` cannot hot-reload, so a check that passes really did run against the committed code.

---

## 3. Should fix

### S1 — `withDeadline` on the two local reads, and a `maxDuration` comment that describes the belt backwards

**Where.** Plan lines 246–252 and the standing question at 1328.

Three of the page's four reads are bounded: `ST_PAGE_TIMEOUT_MS = 6_000` on all three ShikksTracker calls (`stApi.ts:40`). The two Mongo reads — phase 1's `connectDB` + `readOsSettings` + `getHealthSnapshot`, and phase 3's `fetchLiveAnchorIds` — are bounded by nothing. `deadline.ts`'s own header states the reason this matters: *"Mongoose has no per-call timeout: connectDB bounds server selection (10 s) and a stalled socket (45 s), but a query that has been accepted and never answered is bounded by neither."*

**This is a design question, and the answer is not close.** The page's entire failure design is *say what you could not read* — §4.7's `Couldn't reach ShikksTracker.` with the deck's second sentence under it, and a strip that survives because site results are local. A page built on that promise must never fail by **hanging**, because a hang says nothing at all and then hands the reader Vercel's own error page, which says nothing in somebody else's typeface. And the comment at plan lines 248–251 has the mechanism inverted: *"Three hung calls plus two round trips to Atlas must never outlive the function and hand Riku a Vercel error page instead of the deck's `Couldn't reach ShikksTracker.`"* — `maxDuration = 30` does not prevent that error page, it **schedules** it, thirty seconds in instead of sixty. The thing that prevents it is the timeouts, and two of them are missing.

There is a sharper version of the same point. `AgentsBlock.tsx` already wraps its connect-plus-reads in `withDeadline(readRail(), 5000, "rail read")`, for this exact reason, on this exact request. So on a degraded Atlas the **rail** degrades gracefully to six grey `—` badges beside a **page** that never paints — one Mongo path on one response behaving two ways.

**Fix.** Bound both. Budget: 5 + 6 + 5 = 16 s worst case, comfortably inside `maxDuration = 30`. Phase 1's timeout lands in the existing `catch`, so it produces `snapshot = "unread"` and `dbOk = false` — the R56 state, already designed. Phase 3's lands in its own `catch`, so `liveAnchorIds` stays null and Block E says `Couldn't load what's waiting.` — also already designed. Nothing new has to be drawn.

On where the constant lives: not a second module-local `5000`. Export it from `src/lib/deadline.ts`, the module that already owns the concept and already explains it —

```ts
/** Clears a cold Atlas connect with room; half connectDB's server-selection bound. */
export const MONGO_READ_TIMEOUT_MS = 5000;
```

— and have `AgentsBlock.tsx` and `page.tsx` both import it. That is one edit to a file outside Plan C's map (one row added to Plan A's Series file map) against two copies of a number whose whole purpose is to be the same on both paths. And rewrite the `maxDuration` comment to say what it does: *a containment bound, so a pathological render is killed at 30 s rather than 60; the reader's protection is the four timeouts above it, not this.*

---

### S2 — `metadata.title` for `/freelance`: `Freelance · RikuOS`, through a root template

**Where.** Standing question at plan line 1329. `src/app/layout.tsx:38` is `title: APP_NAME` — a bare string, so every page in the app has the tab title `RikuOS`.

**Why it needs an answer now rather than later.** R42 put two views under one address. The rail says `Freelance` on both, the `<h1>` says `Freelance` on both (`freelance/layout.tsx`), and `aria-current` and the switch's raised fill are the only things that distinguish them. The tab strip is where a person tells two open views of one app apart, and today both read `RikuOS`. It is also a PWA — `manifest.ts` and `appleWebApp` are already wired — so the document title is the installed window's title.

**Recommendation.** Use Next's own title template so `APP_NAME` is joined in exactly one place and no page file ever writes the product name:

```tsx
// src/app/layout.tsx
export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  appleWebApp: { capable: true, statusBarStyle: "black", title: APP_NAME },
};
```

```tsx
// src/app/(app)/freelance/page.tsx
export const metadata = { title: "Freelance" };
```

```tsx
// src/app/(app)/freelance/queue/page.tsx  — the second half, whenever it is taken
export const metadata = { title: "Queue" };
```

Tabs read `Freelance · RikuOS` and `Queue · RikuOS`; `/settings` and `/login` fall through to `default` and read `RikuOS` unchanged. The separator is the middot the page already uses for exactly this job — `.fl-sum i`, `.fl-health.quiet .line i`, `.fl-fine i`, all `--ink-4` with 5px either side — so the tab is in the design system's own grammar rather than inventing a dash or a pipe.

**Cost, stated.** The template is a root-layout edit, one row on Plan A's Series file map, and `/freelance/queue/page.tsx` is a `"use client"` file — a client component cannot export `metadata`, so the Queue half has to go in a `layout.tsx` for that segment or wait for the S11 rebuild. That is a reason to take the root template now (it costs nothing and is inert until a child uses it) and the Queue title later, **not** a reason to put the whole title in `freelance/layout.tsx`, which would give both views the same tab title and solve the wrong half of the problem — the same conclusion round 5 reached for A-2.

**The alternative, if the lead wants zero files outside Plan C:** `export const metadata = { title: \`Freelance · ${APP_NAME}\` }` in `page.tsx` alone. It works, and it invents the join convention in a page file where the next page will copy it. I would not.

---

### S3 — the `<div className="sumrow">` inside `<summary>`: keep it, and record the trade properly

**Where.** Deviation 2, plan line 31; the standing question at line 1330.

The plan states the cost accurately: `<summary>`'s content model is phrasing content **or a single element of heading content**, so `<summary><h2>…</h2></summary>` would be conformant and `<summary><div>…<h2>…</h2>…</div></summary>` is not. A single heading child is not available here — `.sumrow` is a three-column grid (`minmax(0,1fr) auto auto`, `components.css:365`) whose third column is the `::after` chevron and whose second is `.fl-count`, so the summary needs three children.

**Recommendation: keep it as implemented.** The reasoning the plan does not give, and should:

- The non-conformance has **no** rendering, AT, or React consequence. It is a validator complaint about a wrapper element.
- Removing the `<h2>` has an **uncertain and non-zero** cost. `<summary>` maps to `role="button"` with name-from-contents, and whether a heading nested inside it survives into heading-navigation varies by browser and screen reader. It may well be that the `<h2>` buys nothing — but "may well be" is not a reason to spend it, and when one side of a trade is *a validator complains* and the other is *a heading may vanish from the outline for some users*, you take the validator complaint.
- The wrapper is also load-bearing for something the plan does not name: `<summary>`'s accessible name is the concatenation of its contents, so Block C announces as roughly *"Campaigns Your campaigns 2, collapsed, button"* — the eyebrow, the heading and the count all reach a screen-reader user in one name. That is a good outcome and it is what the three grid children buy.

**Cost, so it is on the record and not rediscovered:** the page's four block headings are not four `<h2>`s in a validator's outline; two of them live inside buttons. A future move of Blocks C or D to a non-disclosure form has to touch the wrapper. Write both sentences into the `Campaigns.tsx` / `Approaches.tsx` docblocks so nobody "fixes" the `<div>` back to a `<span>` and silently deletes the `<h2>` with it.

---

### S4 — a Block D group with zero rows: suppress it, in the view model, not in the JSX

**Where.** The checkpoint at plan line 883; `Approaches.tsx` at 973–996.

**The state.** `buildBlockD` always returns exactly two groups (`freelanceVariants.ts`, the `groups: [...]` literal). If every approach is on email, or none is, one group arrives with `rows: []` and the JSX renders an eyebrow, an explanation line and a four-column `.fl-thead` with its `--line` bottom rule over nothing. Note that both groups can never be empty at once: `variants.length === 0` returns `{ kind: "empty" }` first, so at least one group always has rows.

**Recommendation: suppress the empty group.** A group heading is a label for rows; with no rows there is nothing to label, and a `.fl-thead` with a rule under it and no `.fl-trow` beneath reads as a table that failed to load — the page's single most expensive misreading, on the block whose entire job is to make *"not measurable"* read as a state rather than an error. The plan already applies exactly this principle one task earlier, at line 780: *"A block with nothing to disclose is not a disclosure: a chevron that opens onto one sentence is a control that lies about having content."* An empty group header is the same lie at a smaller scale.

Nothing is lost. `Replies are only detected on email, so these can't be scored.` explains rows that are not there; it is a true sentence with no referent. And spec §4.4's *"Two groups, always, at equal typographic weight"* is a rule about **weight** — that the not-measurable half is not demoted to a footnote — written in a world where both halves have rows. Suppression does not demote anything; it declines to draw a container for nothing.

**Where the decision lives: the view model.** The plan's stated architecture is *"a renderer with no opinions in it"* (line 8), and "which groups exist" is a content decision. It is also not a shape change — `groups` is already `ApproachGroup[]`, so `groups: [measuredGroup, otherGroup].filter((g) => g.rows.length > 0)` changes a value, not a type, and needs no Plan B conversation under the plan's line-15 rule. Add the case to `freelanceVariants.test.ts` beside the existing two-group split test.

**One fragility to fix while you are there.** `Approaches.tsx` places the honesty note by position: `{groupIndex === 0 && block.honesty !== null && …}` (plan line 987). That is positional coupling to a two-element array, and the moment the array is filtered it is coupling to whichever group survived. It happens to stay correct — `honesty` is non-null only when a rate was printed, rates exist only in the measured group, and the measured group is only absent when there are no email variants, in which case `honesty` is null — but it is correct by coincidence across two files. Either say that sentence in the comment beside the guard, or, better, have the view model carry `honesty` on the measured group itself, which makes R27's *"under the MEASURED group only"* structural instead of positional. The latter is a `BlockD` shape change and therefore a Plan B conversation; the comment is free and I would take it now.

---

### S5 — `Check now` failing: one string, in the button's own register, for both causes

**Where.** Plan lines 66–110 (`CheckNow.tsx` and the Batch-5 amendment above it).

The deck gives `Check now` one busy state and nothing else: *"**Control:** `Check now` → while running: `Checking…`"* (deck §5, Block F). Spec §4.6 adds *"the button is `disabled`"* and *"**The existing reading stays on screen until the new one lands.** Never blank the strip while it re-reads."* There is no failure string anywhere, and the Batch 5 review ruled the failure must not be swallowed. So one has to be proposed.

**Where the signal goes: the button's own label.** Not a line in the strip. The strip's lines are claims about the world — `all sites ok`, `Engine ran 2h ago`, `checked 6h ago` — and a failed POST is a fact about a button press, not about the sites. Putting it in the strip would make the strip report something it has not learned, which is the register error R56 was written to stop one level up. The button is also the only element `CheckNow` owns: `HealthStrip` renders `<CheckNow />` as a leaf in both forms, and `.fl-health .btn{margin-left:auto;flex:none}` (`components.css:465`) means a wider label grows leftward from the right edge without reflowing the line beside it. No CSS, no new element, no markup change in `HealthStrip`.

**The string: `Couldn't check`** — a new string for Riku, to go on the pile with the other three. It is the deck's own `Couldn't …` family (`Couldn't reach ShikksTracker.`, `Couldn't load the pipeline.`, `Couldn't load what's waiting.`), sentence case in the DOM like `Check now` and `Checking…` because `.btn` uppercases in CSS (`text-transform:uppercase`, `components.css`), and it renders `COULDN'T CHECK`. Rejected: `Check failed` — `failed` is the rail's word for an agent badge and a button should not say what a badge says; `Try again` — an instruction rather than a report, and §4.7's *"No retry control anywhere"* means the button already **is** the retry.

**Both causes get the same string, and I disagree with the plan here.** The docblock at plan lines 79–81 argues a network failure should stay swallowed because *"the unchanged reading already says nothing new was learned"*. That premise is false as a **signal**. `formatAge` floors to whole hours, so a reading under an hour old stamps `checked 0h ago` before a successful check and `checked 0h ago` after one — a reader pressing the button twice in a morning genuinely cannot tell a silent failure from a successful no-op. And the case where a fetch actually rejects is offline, on a phone, which is precisely when Riku most needs the control to admit it did nothing. One meaning, one string: `res.ok === false` **or** a thrown fetch.

```tsx
  const [failed, setFailed] = useState(false);

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
    // Unconditional, INCLUDING after a failure. requireSession returns 401 on
    // an expired cookie, and this refresh re-runs the server render, which hits
    // the (app) layout's session check, which redirects to /login. That is the
    // right outcome for the one failure with a real remedy, and it is free.
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button type="button" className="btn" disabled={busy} onClick={() => void check()}>
      {busy ? "Checking…" : failed ? "Couldn't check" : "Check now"}
    </button>
  );
```

`setFailed(false)` at the top clears it on the next press, so the label is `Couldn't check` only until the reader tries again or navigates. The `disabled` state is unchanged (`busy = posting || isPending`), and `.btn:disabled{opacity:.45;color:var(--ink-4)}` is untouched.

---

### S6 — Task 8's by-eye list: three things to add, one to strike, and a list of what ships unobserved

**Where.** Plan lines 1232–1308.

Against spec §9 and the four states the mockup never drew, the list is good on today's render and blind everywhere else.

**Add.**

1. **The alarm strip, from the mockup, since the app cannot produce it.** Task 8 renders the quiet form three times and the alarm form never (M3). It is not locally forceable — `SITES` is a hardcoded const and the engine findings come from live ShikksTracker. So add a mockup-side item to step 4: *compare specimen 02's `.fl-health.alarm` (mockup lines 936–945) against `components.css:468–482` — the bordered `--panel` card, three `.fl-warn` rows with 5px hued dots and a 6px glow, `.fl-fine` indented 14px, `.fl-stamp` indented 14px with `Check now` pushed right* — and add the aged-stamp check M3 turns on.
2. **The absolute worst case, which is one command away and currently unrun.** Step 6 kills ShikksTracker; step 7 kills Mongo; nothing runs both. Combined, the page renders the `.fl-fail` block and a strip reading `Engine — unknown·sites — unknown` — the R56 stamp beside the failed-summary engine phrase, the only render in the app where the two "unknown" registers sit on one line. It is the state the whole degradation design exists for and it costs one line:
   ```bash
   ST_API_BASE_URL="https://shikkstracker.invalid" MONGODB_URI="mongodb+srv://nobody:nobody@nowhere.invalid/rikuos" npx next start -p 3001
   ```
3. **A named list of states this plan ships without ever seeing**, so the lead knows what is unobserved rather than assuming the list is complete. All of them need ShikksTracker to answer 200 with a partial body, which no local override can produce: Block E's `absent` line and its `absentNote` (M1, M2); Block A's third-card absence caption `ShikksTracker didn't report overdue follow-ups` (R54); Block B's `hotAbsentNote` and `absentNote`; the `.stat.blank` card's two-line caption beside a short one, which is what `components.css:285–289`'s `min-height:32px` exists for and which step 4 item 1 does not test (its `couldn't load` caption does not wrap); `.fl-bound` in either block; `.fl-say`'s `2 approved, not yet sent`; and R50's `Nothing waiting on you.`. Several of these can at least be checked against the mockup: specimen 04's third `.mini` (lines 1146–1160) draws the blank-beside-drained card pair, and its second `.mini` draws both Block B absence lines. Say which are mockup-checkable and which go to §9 item 4's deployed observation.

**Strike / reword.** Step 5's stop-rule at plan line 1305 — *"If a disclosure snaps shut here, stop. It means React is writing the `open` attribute back on reconcile"* — is wrong about one legitimate cause and prescribes deleting a ruling. `open={block.defaultOpen}` is `variants.every(v => v.sends === 0)`; if the first send lands between the render and the `router.refresh()`, the prop genuinely flips true→false, React writes it, and Block D closes — correctly, since R31 says it is closed by default once any approach has a send. The plan's prescription (*"the fix is to stop passing `open`"*) would delete R31. Reword to *"if a disclosure snaps shut **while the underlying data is unchanged** …"*, and note the legitimate flip beside it.

**Keep, and it is right:** step 8's PENDING handoff and its explicit "must not mark done" is the correct treatment of §9 item 4 and the best paragraph in Task 8.

---

### S7 — the drafts card's `Open ↗` is the page's one exit and its accessible name is "Open"

**Where.** Plan lines 483–491 (`HeroRow.tsx`); R36 at plan line 40; spec §4.1.

Sighted, the link reads in context: `.stat-top` is a flex row with `Drafts` at the left and `Open ↗` pushed right (`components.css:271–275`), so the eye reads *Drafts → Open*. Tabbed to, the link's accessible name is `Open ↗` and nothing in it says what opens. That is WCAG 2.4.4's canonical failure, and it is the page's single most consequential control — the one exit to ShikksTracker in a design whose whole promise is that every action leaves for another app (deck §9, final checklist item).

**Fix.** One attribute, no CSS, no markup change:

```tsx
<a className="more" href={card.href} target="_blank" rel="noopener noreferrer"
   aria-label="Open drafts in ShikksTracker">
  Open ↗
</a>
```

The visible word `Open` is contained in the accessible name, so WCAG 2.5.3 Label in Name holds for voice control, and the added words are the deck's own — `waiting on you in ShikksTracker` is already the card's caption. `aria-label` on a link with a `↗` in its text is a small new string; flag it to Riku with the others or take it as a mechanical composition of existing ones, the lead's call. Block E's business-name links need nothing: their name is the business.

---

### S8 — `Campaigns.tsx`'s `head` is computed in every branch and its ternary is unreachable

**Where.** Plan lines 764–772.

```tsx
  const head = (
    <div className="sumrow">
      …
      <span className="fl-count">{block.kind === "table" ? block.count : ""}</span>
    </div>
  );
```

`head` is only ever rendered inside the `kind === "table"` branch (line 812), so the `: ""` arm is dead and the element is built and discarded on the empty and failed paths. Worse, the ternary *implies* `head` serves the non-table states, which it does not — the non-table branch builds its own eyebrow/heading pair at lines 785–786. Move the JSX inside the table branch and drop the ternary: `<span className="fl-count">{block.count}</span>`. Costs nothing; removes a false signal about where the summary row is used. (`Approaches.tsx` gets this right — its `.sumrow` is written inline in the one branch that uses it.)

---

### S9 — the deviations section says "three" and there are five

**Where.** Plan lines 28–32.

Two further departures from the mockup's markup ship, both authorised — by R36 in the ground rules at line 40 and by `components.css:271`'s own comment — but neither is in the list that claims to be exhaustive:

- `<span class="more">Open ↗</span>` (mockup 640) becomes `<a className="more" href target rel>`.
- `<a class="fl-biz">Bella's Cafe <span class="arr">↗</span></a>` (mockup 916) — a bare anchor with no `href` in the mockup — gains `href`, `target` and `rel`.

Both are correct and both were anticipated in the stylesheet (`border-bottom:0` on `.stat-top .more` and `.fl-biz`, added precisely because they become real anchors). But "three deviations, each forced and each recorded here rather than discovered later" is the section's own promise, and the count is what a reader audits against. Renumber to five, or add one sentence saying the two R36 anchors are covered by the ground rule above and are not counted here.

---

## 4. The four standing questions, answered

**1. `withDeadline` (plan line 1328).** Adopt it, on both Mongo reads, with the constant exported from `deadline.ts`. Full reasoning at **S1**. The design case in one sentence: a page whose entire failure vocabulary is *say what you could not read* must never fail by hanging, and `maxDuration = 30` does not prevent the Vercel error page — it schedules it.

**2. `metadata.title` (plan line 1329).** `Freelance · RikuOS`, produced by a `title.template` in the root layout and a one-word `title: "Freelance"` in `page.tsx`, so `APP_NAME` is joined in exactly one place and no page file ever writes the product name. Full form, the `/freelance/queue` complication and the rejected alternative at **S2**.

**3. `<div className="sumrow">` inside `<summary>` (plan line 1330).** Keep it. The non-conformance costs a validator complaint; the alternative costs a heading whose exposure to assistive technology is uncertain, and uncertain-loss beats certain-pedantry. Record the two sentences the plan does not currently say — that `<summary>` maps to `role="button"` with name-from-contents, so the three grid children reach a screen reader as one useful name, and that the wrapper is what a future refactor must not silently undo. Full reasoning at **S3**.

**4. A Block D group with zero rows (plan line 883).** Suppress it, and decide it in `freelanceVariants.ts`, not in the JSX — a header with no rows is a container drawn for nothing, and *which groups exist* is a content decision in a renderer that is supposed to have no opinions. It is a value change inside an existing type, so it needs no Plan B conversation. Take the honesty-note comment at the same time. Full reasoning at **S4**.

---

## 5. Notes

**N1 — the states the mockup never drew, resolved.** Asked directly: does `HeroRow` or `HealthStrip` need changing for R54, R56, R57?

- **R54 — no change to `HeroRow`, the view model carries it entirely.** `needsYouCard` in `freelanceView.ts` returns `tone: "blank"`, `figure: DASH`, `caption: "ShikksTracker didn't report overdue follow-ups"` for the `absent` figure; `HeroRow` renders `className={\`stat ${card.tone}\`}` and `{card.caption}` blindly, and `.stat.blank .lbl,.stat.blank .fig,.stat.blank .sub{color:var(--ink-4)}` (`components.css:308`) drains the caption with the figure, which is what §4.1 requires for a "didn't report" sentence. Verified line by line.
- **R56 — no change to `HealthStrip`.** `sites — unknown` arrives as `stamp.text` with `aged: false` and reaches the quiet form as the last `HealthPart`, where it renders as a bare text node beside the middots. Correct.
- **R57 — the quiet half works, the alarm half does not render at all.** See **M3**. The view model carries the *decision* (`aged: monitoringEnabled`); the stylesheet only expresses it in one of the strip's two forms.

**N2 — every JSX whitespace boundary was traced and every one is right.** This is the class of error most likely to be introduced by a later "tidy", so it is worth recording that it currently is not present. `.fl-sum` (plan 656–665): `<b>{total}</b> {totalWord}` keeps its one space; the newline before `{block.summary.hot !== null && …}` and the newline between `<i>·</i>` and the following `<b>` are whitespace-containing-a-newline and are stripped, so the render is `<b>30</b> contacts<i>·</i><b>2</b> hot` — mockup line 665, character for character. Same result in `HealthStrip`'s quiet line and `.fl-fine`. `Open ↗` and `{row.businessName} <span className="arr">↗</span>` both keep exactly one space. Do not "fix" any of these.

**N3 — `.fl-biz` is `inline-flex`, so the space in the markup is not what separates the name from the arrow.** `components.css:432–434` sets `display:inline-flex; gap:6px`, and a whitespace-only anonymous flex item is not rendered — so the literal space collapses away and `gap:6px` does the work. The markup keeps the space because the mockup does and because it is the right fallback if the display ever changes. Anyone who deletes it will see no difference and will have removed the fallback.

**N4 — Block D group 2's three-column rows sit in the four-column grid on purpose.** `.fl-table{--fl-cols:minmax(0,1fr) 78px 66px 66px}` (`components.css:390`) serves both groups, so `Not measurable`'s `Approach · Reply rate · Sends` occupies columns 1–3 and leaves the `Replies` column empty — which is what makes the two groups' `Reply rate` and `Sends` columns share an x-position down the whole block. The mockup does the same (lines 890–894). The obvious "fix" — an `is-3col` modifier — would break that alignment. Worth one line in `Approaches.tsx`'s docblock.

**N5 — `.fl-bound` before `.honesty` in Block C contradicts the spec's literal wording, and the plan is right anyway.** §4.3 says *"The pixel footnote sits directly under the table"* and, separately, *"one `.fl-bound` statement below the table"*. Plan line 819–824 puts the bound first. That is the better rhythm — `.fl-bound` at `margin-top:10px` sits tight under the table as a statement about its extent, `.honesty` at `margin-top:14px` with its 13px glyph reads last as the block's footnote — and it matches Block E, where the bound also closes the list. Adjust §4.3's sentence in the next docs pass rather than the code.

**N6 — the two `.fl-fail` shapes justify the repetition better than economy does.** Plan line 1369 defends five copies of the markup on the grounds that a shared component would be a ninth file. True, but weaker than the real reason: the page-level copy carries `.said` **and** `.because`, the four block-level copies carry `.said` alone, so a `FailLine` component would need an optional second line that four of five callers pass as undefined. Two shapes, not one shape copied. Say that instead.

**N7 — keys are content-derived throughout, and one of them is thinner than it looks.** `key={part.text}` / `key={warning.text}` / `key={text}` in `HealthStrip`, `key={line.text}` in `StateOfPlay`, `key={header}` in both tables. All are unique in every render I could construct — the health strip's parts are engine phrase / `all sites ok` / stamp, and `SITES` has three distinct names, so `warnings` and `fine` cannot collide. It is fine, and it is a class of key that becomes a duplicate-key warning the day two site details read the same. `HealthWarning` has no id to key on, so this is not a defect; it is worth one clause in the docblock.

**N8 — `attention!` is safe, and `filter(Boolean)` is a no-op.** `liveAnchorIds` is assigned only inside `if (attention !== null)`, so `liveAnchorIds !== null` implies `attention !== null` — the assertion at plan line 349 is sound, if unverifiable by the compiler. `AttentionItem.replyToLogId` is `string` (not nullable, `stApi.ts:68`), so `.map(…).filter(Boolean)` narrows nothing and is only filtering empty strings, which `fetchLiveAnchorIds` would ignore anyway. Both harmless; both the kind of thing worth a word so the next reader does not go looking for the nullable field.

**N9 — the phase-1 `console.error` will print the Atlas hostname on an SRV failure.** `db.ts:25–26` is emphatic that the URI never appears in a thrown message because it carries credentials, and it does not — but a driver `querySrv ENOTFOUND _mongodb._tcp.<host>` carries the host, and Task 8 step 7 deliberately produces one. No credential leaks and CLAUDE.md's rule is about secrets, so this is not a violation. It is worth knowing that Vercel's log will name the cluster.

**N10 — Block A's `.fl-say` renders nothing on today's data, and never appears in Task 8.** `lines` is `[]` unless `queue.approved > 0`, or the R50 fallback fires on four measured zeros. Today's numbers give neither, so `StateOfPlay` is a component the executor will never see render. Fold into S6's unobserved list.

**N11 — the plan's claim that `open` is "an initial value, not a controlled one" is true only while the data holds still.** `defaultOpen` genuinely flips when the first send lands, and React will write the attribute back on that render. Correct behaviour under R31, wrong diagnosis in Task 8 step 5 — see S6's strike item.

**N12 — spec §7.4's `<main className="app-content">` is honoured and the column arithmetic still holds.** `page.tsx` renders `<main className="app-content"><div className="fl">`, matching the shipped `freelance/layout.tsx`'s deliberate refusal to render a `<main>` of its own and specimen 07's `.fl-head > .fl` / `.app-content > .fl` pair. `.fl>:first-child{margin-top:0}` zeroes `.fl-body`'s 20px in the normal state and `.fl-fail`'s 20px in the whole-page-down state, so §3.4's 28px header gap is true in both — which is exactly what that rule was added for, and Plan C's structure is what makes it true. Nothing to fix; worth confirming, since it is the one place A-2 and Plan C had to meet.

---

## 6. Verdict

Plan C reproduces the mockup faithfully — I checked every element, every class, every middot and every space, and the fidelity is real rather than claimed. Where it fails, it fails in exactly the region the mockup could not cover: the four states drawn since, where the plan's prose asserts three times over that `NeedsYou.tsx` renders `absent` and `absentNote`, and the code block renders neither correctly (M1, M2); and R57's aged stamp, which the view model decides correctly and the stylesheet has no rule to express in the strip's alarm form — a defect that hides inside the one form Task 8 never renders (M3). Underneath that sits a verification section that has quietly gone stale: five mechanical checks that all fail today against an untouched tree, and nine `npm run dev` invocations aimed at a port Riku's own server is holding, with six instructions to Ctrl-C it (M4, M5). None of the five is expensive — two are the lead's own rulings landing in code, one is a decision between three named options, and two are text edits — but none of them can be left to execution-time care, because four of the five are the kind of error that reports success. On the four standing questions I would bound both Mongo reads, take a root `title.template` so the tab says `Freelance · RikuOS` with `APP_NAME` joined in one place, keep the non-conformant `<summary>` wrapper and write down why, and suppress an empty Block D group in the view model rather than drawing a header over nothing. Fix the five, rule on M3 and the four questions, and this is ready to execute.
