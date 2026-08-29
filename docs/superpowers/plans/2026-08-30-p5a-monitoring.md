# P5a — Watchdog, Site Health, Morning Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RikuOS notice its own failures and report them in one push each morning — P5 tasks 5.1, 5.2 and 5.4 from `docs/ROADMAP.md`.

**Architecture:** One new cron route, `/api/cron/morning`, runs four jobs in sequence: expiry sweep → watchdog → site health → dispatcher. Each job is a pure logic module wrapped by a shared `runJob` helper that writes that job's own `AgentRun` row and never throws, so one job's failure produces a record rather than stopping the run. The push is sent by the last job, after every other job's record is already written. The chaser route is not touched; the `expire` cron slot is what becomes the multiplexer, because Vercel Hobby allows only two crons.

**Tech Stack:** Next.js 16 App Router · TypeScript strict · Mongoose ^9 · Vitest ^4 · Vercel crons (region `sin1`) · web-push.

**Design source:** `docs/superpowers/specs/2026-08-29-p5a-monitoring-design.md`. Decisions P5a-1 … P5a-10 in that document are settled — implement them, do not reopen them.

---

## Boundaries (hard rules from CLAUDE.md)

- **Never edit anything in `../ShikksTracker`, and never connect to its database.** All freelance data comes through `/api/os/*` with `ST_API_SECRET`.
- Every `String` field bounded, every closed set an `enum`, no `Schema.Types.Mixed`.
- **No silent failure, no infinite retry.** Every job writes an `AgentRun`; the human is the escalation path.
- **Alerts are queued and sent last** in any multi-step job.
- UI stays plain and dense — the visual pass is P8 (D10).
- Never hardcode the product name; use `APP_NAME` from `src/lib/constants.ts`.
- Done requires `npm test` + `npx tsc --noEmit` + `npm run build` all green (Task 8), **plus** the on-device acceptance run against real data.
- Commits in this repo carry a `Claude-Session:` trailer. Use the URL of the session doing the work, not one copied from this document.

---

## State that is not derivable from this repo

1. **Vercel Hobby allows 2 cron jobs per project, each at most once per day.** Both slots are used (`expire`, `chaser`). This is the entire reason for the multiplexer. Do not "simplify" by adding a third cron entry — the deploy will reject it.
2. **Hobby cron firing time drifts within its hour.** Nothing may depend on the chaser finishing before the morning route starts.
3. **`AgentRun` already has the enum slots** `watchdog`, `site-health`, `dispatcher` and the index `{agent: 1, startedAt: -1}`. No model or index change is needed for them, so **no `npm run migrate:indexes` run is required by this plan.**
4. **`GET /api/os/attention` really returns `overdueActions` and `hotLeads`**, verified in `../ShikksTracker/src/lib/os/attention.ts:306`, but RikuOS's local `AttentionResponse` interface only declares `repliedUnanswered`. Task 6 widens the local interface. This is a local type change, not a contract change — the field is already in the documented response shape.
5. **The three watched sites are all Vercel subdomains**, so site health is a single uptime check (P5a-9, P5a-10). There is no certificate check and no RDAP call in this plan.

---

## File structure

**Created:**

| File | Responsibility |
|---|---|
| `src/lib/jobs/runJob.ts` | Wraps one job: times it, writes its `AgentRun`, converts a throw into an `ok: false` result. Never throws. |
| `src/lib/jobs/expirySweep.ts` | The expiry + stuck-action sweep, extracted from the `expire` route so two entry points can share it. |
| `src/lib/watchdog.ts` | Pure `evaluateWatchdog` over the expectations table, plus `fetchLatestRuns` to load its input. |
| `src/lib/siteHealth.ts` | Site list, pure result classification, and the parallel uptime check. |
| `src/lib/digest.ts` | Pure `composeDigest` — inputs to a push title and body. No I/O. |
| `src/app/api/cron/morning/route.ts` | The multiplexer. Thin: guard, connect, four `runJob` calls, JSON summary. |
| `src/lib/__tests__/runJob.test.ts` · `watchdog.test.ts` · `siteHealth.test.ts` · `digest.test.ts` | Tests, beside the logic they cover. |

**Modified:**

| File | Change |
|---|---|
| `src/models/OsSettings.ts` | add `monitoringEnabled` |
| `src/lib/osSettings.ts` | add `monitoringEnabled` to `OsSettingsPatch` |
| `src/lib/settings.ts` | allow and validate the new key |
| `src/app/api/settings/route.ts` | return the new field on GET and PATCH |
| `src/app/settings/page.tsx` | a monitoring toggle beside the chaser one |
| `src/app/api/cron/expire/route.ts` | becomes a thin caller of the extracted job |
| `src/lib/stApi.ts` | widen `AttentionResponse` |
| `vercel.json` | chaser to 22:00 UTC; `expire` entry replaced by `morning` at 23:00 UTC |

---

## Task 1: The `monitoringEnabled` setting, end to end

**Files:**
- Modify: `src/models/OsSettings.ts`
- Modify: `src/lib/osSettings.ts`
- Modify: `src/lib/settings.ts`
- Modify: `src/app/api/settings/route.ts`
- Modify: `src/app/settings/page.tsx`
- Test: `src/lib/__tests__/settings.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/settings.test.ts`:

```ts
describe("parseSettingsPatch — monitoringEnabled", () => {
  it("accepts a boolean", () => {
    const result = parseSettingsPatch({ monitoringEnabled: true });
    expect(result).toEqual({ ok: true, value: { monitoringEnabled: true } });
  });

  it("rejects a non-boolean", () => {
    const result = parseSettingsPatch({ monitoringEnabled: "yes" });
    expect(result.ok).toBe(false);
  });

  it("still rejects unknown keys", () => {
    const result = parseSettingsPatch({ monitoringEnable: true });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/settings.test.ts`
Expected: FAIL — the first test reports `Unknown setting "monitoringEnabled"`.

- [ ] **Step 3: Add the field to the model**

In `src/models/OsSettings.ts`, add to the interface, after `chaserNDays`:

```ts
  monitoringEnabled: boolean;
```

and to the schema, after the `chaserNDays` line:

```ts
    monitoringEnabled: { type: Boolean, required: true, default: false },
```

- [ ] **Step 4: Add the field to the patch type**

In `src/lib/osSettings.ts`, extend `OsSettingsPatch`:

```ts
export interface OsSettingsPatch {
  chaserEnabled?: boolean;
  chaserNDays?: number;
  monitoringEnabled?: boolean;
}
```

- [ ] **Step 5: Validate it**

In `src/lib/settings.ts`, change the allowed-key set to:

```ts
const ALLOWED_KEYS = new Set(["chaserEnabled", "chaserNDays", "monitoringEnabled"]);
```

and add this block immediately before the final `if (Object.keys(value).length === 0)` check:

```ts
  if ("monitoringEnabled" in b) {
    if (typeof b.monitoringEnabled !== "boolean") {
      return { ok: false, error: "monitoringEnabled must be a boolean." };
    }
    value.monitoringEnabled = b.monitoringEnabled;
  }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/settings.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 7: Return the field from the API**

In `src/app/api/settings/route.ts`, both the GET and the PATCH handler end with a `NextResponse.json` carrying a `settings` object. Replace both of those objects with:

```ts
    settings: {
      chaserEnabled: settings.chaserEnabled,
      chaserNDays: settings.chaserNDays,
      monitoringEnabled: settings.monitoringEnabled,
    },
```

- [ ] **Step 8: Add the toggle to the settings page**

In `src/app/settings/page.tsx`, extend the local interface:

```ts
interface Settings {
  chaserEnabled: boolean;
  chaserNDays: number;
  monitoringEnabled: boolean;
}
```

Then add this second card immediately after the closing `</div>` of the existing chaser card, still inside the `{settings && ( … )}` block:

```tsx
          <div className="card">
            <p className="meta">Monitoring</p>
            <p>
              Currently <strong>{settings.monitoringEnabled ? "on" : "off"}</strong>. When on, each
              morning it checks that every agent actually ran, that the client sites are up, and
              sends you one summary — even when nothing is wrong, so a missing notification is
              itself a warning. Turning it off silences that summary; stale queue items are still
              cleared either way.
            </p>
            <div className="row">
              <button
                disabled={busy}
                className={settings.monitoringEnabled ? "danger" : ""}
                onClick={() => void patch({ monitoringEnabled: !settings.monitoringEnabled })}
              >
                {settings.monitoringEnabled ? "Turn monitoring off" : "Turn monitoring on"}
              </button>
            </div>
          </div>
```

The two cards are siblings inside a `{settings && ( … )}` expression, which must return a single element — so this **will** be a compile error until you wrap them. Change the opening of that block from:

```tsx
      {settings && (
        <div className="card">
```

to:

```tsx
      {settings && (
        <>
        <div className="card">
```

and change its closing from:

```tsx
        </div>
      )}
```

to:

```tsx
        </div>
        </>
      )}
```

with the new monitoring card sitting between the first card's `</div>` and the closing `</>`.

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: no output (success).

- [ ] **Step 10: Commit**

```bash
git add src/models/OsSettings.ts src/lib/osSettings.ts src/lib/settings.ts src/app/api/settings/route.ts src/app/settings/page.tsx src/lib/__tests__/settings.test.ts
git commit -m "feat(settings): monitoringEnabled toggle, defaulting to off"
```

---

## Task 2: The `runJob` helper

Every job in the morning route needs the same three guarantees: it is timed, it writes exactly one `AgentRun`, and it cannot throw out into its caller. That is this helper's whole job.

**Files:**
- Create: `src/lib/jobs/runJob.ts`
- Test: `src/lib/__tests__/runJob.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/runJob.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runJob } from "@/lib/jobs/runJob";
import AgentRun from "@/models/AgentRun";

vi.mock("@/models/AgentRun", () => ({
  default: { create: vi.fn().mockResolvedValue({}) },
}));

const create = AgentRun.create as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue({});
});

describe("runJob", () => {
  it("returns the work's data and records a successful run", async () => {
    const result = await runJob("watchdog", async () => ({
      counts: { itemsProcessed: 4 },
      data: ["anomaly"],
    }));

    expect(result.ok).toBe(true);
    expect(result.data).toEqual(["anomaly"]);
    expect(create).toHaveBeenCalledTimes(1);

    const record = create.mock.calls[0][0];
    expect(record.agent).toBe("watchdog");
    expect(record.ok).toBe(true);
    expect(record.counts).toEqual({
      itemsCreated: 0,
      itemsProcessed: 4,
      itemsSkipped: 0,
      itemsFailed: 0,
    });
  });

  it("converts a throw into a failed run instead of propagating it", async () => {
    const result = await runJob("site-health", async () => {
      throw new Error("network exploded");
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("network exploded");
    expect(result.data).toBeNull();
    expect(create.mock.calls[0][0].ok).toBe(false);
  });

  it("records the supplied note on an otherwise successful run", async () => {
    const result = await runJob("dispatcher", async () => ({ data: null }), "monitoring is disabled");

    expect(result.ok).toBe(true);
    expect(create.mock.calls[0][0].error).toBe("monitoring is disabled");
  });

  it("survives the AgentRun write itself failing", async () => {
    create.mockRejectedValue(new Error("mongo down"));

    const result = await runJob("watchdog", async () => ({ data: 1 }));

    expect(result.ok).toBe(true);
    expect(result.data).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/runJob.test.ts`
Expected: FAIL — cannot resolve `@/lib/jobs/runJob`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/jobs/runJob.ts`:

```ts
/**
 * runJob.ts — the contract every scheduled job in this app obeys.
 *
 * One call = one AgentRun row, written whether the work succeeded or threw,
 * because CLAUDE.md forbids silent failure. The helper NEVER throws: a
 * multiplexed route runs several jobs in sequence, and one job's failure must
 * leave a record and let the next job run rather than aborting the request.
 *
 * A failure to write the record itself is logged and swallowed — losing the
 * bookkeeping must not lose the work's result too.
 */

import AgentRun from "@/models/AgentRun";
import type { Agent, IAgentRunCounts } from "@/models/AgentRun";

const ZERO_COUNTS: IAgentRunCounts = {
  itemsCreated: 0,
  itemsProcessed: 0,
  itemsSkipped: 0,
  itemsFailed: 0,
};

export interface JobWork<T> {
  counts?: Partial<IAgentRunCounts>;
  data: T;
}

export interface JobResult<T> {
  agent: Agent;
  ok: boolean;
  error?: string;
  data: T | null;
}

/**
 * @param note recorded on the run when the job did no work for a legitimate
 *   reason (e.g. switched off). It lands in `error` on an `ok: true` row, the
 *   same shape the chaser uses — deliberately, so "disabled" and "never fired"
 *   stay distinguishable. Nothing reads it back programmatically.
 */
export async function runJob<T>(
  agent: Agent,
  work: () => Promise<JobWork<T>>,
  note?: string
): Promise<JobResult<T>> {
  const startedAt = new Date();
  let ok = true;
  let error: string | undefined = note;
  let counts: IAgentRunCounts = { ...ZERO_COUNTS };
  let data: T | null = null;

  try {
    const outcome = await work();
    counts = { ...ZERO_COUNTS, ...outcome.counts };
    data = outcome.data;
  } catch (err) {
    ok = false;
    error = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
  }

  try {
    await AgentRun.create({
      agent,
      startedAt,
      durationMs: Date.now() - startedAt.getTime(),
      ok,
      counts,
      ...(error !== undefined ? { error: error.slice(0, 2000) } : {}),
    });
  } catch (runErr) {
    console.error(`[jobs/${agent}] failed to write AgentRun:`, runErr);
  }

  return { agent, ok, data, ...(error !== undefined ? { error } : {}) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/runJob.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/jobs/runJob.ts src/lib/__tests__/runJob.test.ts
git commit -m "feat(jobs): runJob wrapper that records every run and never throws"
```

---

## Task 3: Extract the expiry sweep into a job module

The sweep must run from two entry points — the existing manual route and the new morning route — so the logic moves out of the route. Behaviour is unchanged; this is a move plus a rewire.

**Files:**
- Create: `src/lib/jobs/expirySweep.ts`
- Modify: `src/app/api/cron/expire/route.ts`

- [ ] **Step 1: Create the job module**

Create `src/lib/jobs/expirySweep.ts`:

```ts
/**
 * expirySweep.ts — the P3 expiry sweep plus P4's interrupted-action sweep,
 * extracted from /api/cron/expire so the morning multiplexer can run the same
 * code. The route keeps its own alerting policy; this module only does the work
 * and reports what it changed.
 */

import { buildActionSweep, buildExpirySweep } from "@/lib/queue";
import ApprovalItem from "@/models/ApprovalItem";

export interface ExpirySweepResult {
  /** Pending items whose staleAt passed. */
  expired: number;
  /** Claimed actions that never recorded a result, parked for a human. */
  unstuck: number;
}

export async function runExpirySweep(now: Date): Promise<ExpirySweepResult> {
  const expiry = buildExpirySweep(now);
  const expired = (await ApprovalItem.updateMany(expiry.filter, expiry.update)).modifiedCount;

  // P4: an action claimed but never resolved means the function died between
  // the outward call and recording its result. Park it rather than leaving an
  // in-flight state behind (CLAUDE.md).
  const stuck = buildActionSweep(now);
  const unstuck = (await ApprovalItem.updateMany(stuck.filter, stuck.update)).modifiedCount;

  return { expired, unstuck };
}
```

- [ ] **Step 2: Rewire the existing route**

Replace the whole body of `src/app/api/cron/expire/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireCronSecret } from "@/lib/auth";
import { runJob } from "@/lib/jobs/runJob";
import { runExpirySweep } from "@/lib/jobs/expirySweep";
import { buildPushPayload, sendPushToAll } from "@/lib/push";

/**
 * GET /api/cron/expire
 *
 * Kept as a manual trigger for the same sweep the morning route runs
 * (/api/cron/morning). It is NO LONGER a Vercel cron entry: Hobby allows two
 * crons and the second slot is the multiplexer. The work itself lives in
 * src/lib/jobs/expirySweep.ts so both callers can never drift apart.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = requireCronSecret(request);
  if (guard) return guard;

  await connectDB();

  const result = await runJob("expiry-sweep", async () => {
    const swept = await runExpirySweep(new Date());
    return { counts: { itemsProcessed: swept.expired + swept.unstuck }, data: swept };
  });

  // Alerts last (CLAUDE.md): the data state above is already settled.
  if (!result.ok) {
    await notify("Expiry sweep failed", result.error ?? "Unknown error");
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  const unstuck = result.data?.unstuck ?? 0;
  if (unstuck > 0) {
    await notify(
      "Interrupted actions need checking",
      `${unstuck} approved item${unstuck === 1 ? "" : "s"} could not confirm their result.`
    );
  }

  return NextResponse.json({
    ok: true,
    expired: result.data?.expired ?? 0,
    unstuck,
  });
}

async function notify(title: string, body: string): Promise<void> {
  try {
    await sendPushToAll(buildPushPayload(title, body));
  } catch (pushErr) {
    console.error("[cron/expire] push could not be sent:", pushErr);
  }
}
```

- [ ] **Step 3: Verify nothing else broke**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all existing tests PASS, no type errors. The sweep's own logic is covered by `queue.test.ts`, which is untouched because `buildExpirySweep` and `buildActionSweep` did not change.

- [ ] **Step 4: Commit**

```bash
git add src/lib/jobs/expirySweep.ts src/app/api/cron/expire/route.ts
git commit -m "refactor(cron): extract the expiry sweep so two entry points can share it"
```

---

## Task 4: The watchdog

**Files:**
- Create: `src/lib/watchdog.ts`
- Test: `src/lib/__tests__/watchdog.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/watchdog.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { evaluateWatchdog, EXPECTATIONS } from "@/lib/watchdog";
import type { LatestRun } from "@/lib/watchdog";

const NOW = new Date("2026-08-30T00:00:00.000Z");

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000);
}

/** A healthy run for every agent the table expects. */
function allHealthy(): LatestRun[] {
  return EXPECTATIONS.map((e) => ({
    agent: e.agent,
    startedAt: hoursAgo(1),
    ok: true,
    itemsFailed: 0,
  }));
}

describe("evaluateWatchdog", () => {
  it("reports nothing when every expected agent ran recently and succeeded", () => {
    expect(evaluateWatchdog(NOW, allHealthy())).toEqual([]);
  });

  it("flags an agent that has never run", () => {
    const runs = allHealthy().filter((r) => r.agent !== "chaser");
    const anomalies = evaluateWatchdog(NOW, runs);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].agent).toBe("chaser");
    expect(anomalies[0].kind).toBe("never-ran");
  });

  it("flags an agent whose newest run is past its grace period", () => {
    const runs = allHealthy();
    runs[0] = { ...runs[0], startedAt: hoursAgo(31) };
    const anomalies = evaluateWatchdog(NOW, runs);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].kind).toBe("stale");
  });

  it("does not flag a run inside the grace period", () => {
    const runs = allHealthy();
    runs[0] = { ...runs[0], startedAt: hoursAgo(29) };
    expect(evaluateWatchdog(NOW, runs)).toEqual([]);
  });

  it("flags a failed run", () => {
    const runs = allHealthy();
    runs[1] = { ...runs[1], ok: false };
    const anomalies = evaluateWatchdog(NOW, runs);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].kind).toBe("failed");
  });

  it("flags a run that succeeded but lost items", () => {
    const runs = allHealthy();
    runs[1] = { ...runs[1], itemsFailed: 2 };
    const anomalies = evaluateWatchdog(NOW, runs);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].kind).toBe("degraded");
    expect(anomalies[0].detail).toContain("2");
  });

  it("reports staleness rather than failure when a run is both", () => {
    const runs = allHealthy();
    runs[0] = { ...runs[0], startedAt: hoursAgo(40), ok: false };
    const anomalies = evaluateWatchdog(NOW, runs);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].kind).toBe("stale");
  });

  it("ignores agents that are not in the expectations table", () => {
    const runs = [
      ...allHealthy(),
      { agent: "retro" as const, startedAt: hoursAgo(500), ok: false, itemsFailed: 9 },
    ];
    expect(evaluateWatchdog(NOW, runs)).toEqual([]);
  });

  it("does not expect itself to have run", () => {
    expect(EXPECTATIONS.some((e) => e.agent === "watchdog")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/watchdog.test.ts`
Expected: FAIL — cannot resolve `@/lib/watchdog`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/watchdog.ts`:

```ts
/**
 * watchdog.ts — "did every agent actually run, and did it succeed?"
 *
 * The expectations table lives here rather than in OsSettings on purpose
 * (design P5a-2): it mirrors vercel.json, so it should change in the same
 * commit vercel.json does. Only agents that have actually shipped are listed;
 * lead-sweep, triage and retro join the table when they exist.
 *
 * The watchdog is deliberately absent from its own table. It is running, which
 * is the proof. A watchdog that dies mid-run is instead reported by the
 * dispatcher, which sees the outcome of every job in the same invocation.
 *
 * P5a scope: agent freshness only. Messenger webhook freshness and the Meta
 * token ping wait for ShikksTracker's P2 (design P5a-1) — until that ships,
 * `messenger.lastEventAt` means "no webhook yet", not "the webhook is dead".
 */

import AgentRun from "@/models/AgentRun";
import type { Agent } from "@/models/AgentRun";

export interface Expectation {
  agent: Agent;
  everyHours: number;
  graceHours: number;
}

export const EXPECTATIONS: Expectation[] = [
  { agent: "chaser", everyHours: 24, graceHours: 6 },
  { agent: "expiry-sweep", everyHours: 24, graceHours: 6 },
  { agent: "site-health", everyHours: 24, graceHours: 6 },
  { agent: "dispatcher", everyHours: 24, graceHours: 6 },
];

export interface LatestRun {
  agent: Agent;
  startedAt: Date;
  ok: boolean;
  itemsFailed: number;
}

export type AnomalyKind = "never-ran" | "stale" | "failed" | "degraded";

export interface Anomaly {
  agent: Agent;
  kind: AnomalyKind;
  /** One short human-readable line; goes straight into the digest. */
  detail: string;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Pure. At most one anomaly per agent, most-fundamental first: an agent that
 * never ran cannot also be stale, and a stale run's `ok` flag describes a run
 * from before the outage, so reporting it would point at the wrong problem.
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
    const run = byAgent.get(expectation.agent);

    if (!run) {
      anomalies.push({
        agent: expectation.agent,
        kind: "never-ran",
        detail: `${expectation.agent} has never run`,
      });
      continue;
    }

    const ageMs = now.getTime() - run.startedAt.getTime();
    const limitMs = (expectation.everyHours + expectation.graceHours) * HOUR_MS;
    if (ageMs > limitMs) {
      anomalies.push({
        agent: expectation.agent,
        kind: "stale",
        detail: `${expectation.agent} last ran ${Math.floor(ageMs / HOUR_MS)}h ago`,
      });
      continue;
    }

    if (!run.ok) {
      anomalies.push({
        agent: expectation.agent,
        kind: "failed",
        detail: `${expectation.agent} failed`,
      });
      continue;
    }

    if (run.itemsFailed > 0) {
      anomalies.push({
        agent: expectation.agent,
        kind: "degraded",
        detail: `${expectation.agent}: ${run.itemsFailed} item${run.itemsFailed === 1 ? "" : "s"} failed`,
      });
    }
  }

  return anomalies;
}

/**
 * Loads the newest run per agent. One indexed findOne each rather than an
 * aggregation: the table has a handful of rows and {agent, startedAt} is
 * already indexed for exactly this query.
 */
export async function fetchLatestRuns(agents: Agent[]): Promise<LatestRun[]> {
  const docs = await Promise.all(
    agents.map((agent) =>
      AgentRun.findOne({ agent })
        .sort({ startedAt: -1 })
        .select({ agent: 1, startedAt: 1, ok: 1, "counts.itemsFailed": 1 })
        .lean()
    )
  );

  const runs: LatestRun[] = [];
  for (const doc of docs) {
    if (!doc) continue;
    const row = doc as unknown as {
      agent: Agent;
      startedAt: Date;
      ok: boolean;
      counts?: { itemsFailed?: number };
    };
    runs.push({
      agent: row.agent,
      startedAt: row.startedAt,
      ok: row.ok,
      itemsFailed: row.counts?.itemsFailed ?? 0,
    });
  }
  return runs;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/watchdog.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/watchdog.ts src/lib/__tests__/watchdog.test.ts
git commit -m "feat(watchdog): flag agents that never ran, went stale, failed or lost items"
```

---

## Task 5: Site health

**Files:**
- Create: `src/lib/siteHealth.ts`
- Test: `src/lib/__tests__/siteHealth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/siteHealth.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { checkSite, checkSites, classifyError, classifyStatus, SITES } from "@/lib/siteHealth";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("classifyStatus", () => {
  it("treats 2xx as up", () => {
    expect(classifyStatus("Meowchi", 200)).toEqual({
      name: "Meowchi",
      up: true,
      detail: "Meowchi ok",
    });
  });

  it("treats 4xx and 5xx as down, naming the status", () => {
    expect(classifyStatus("Meowchi", 404).up).toBe(false);
    expect(classifyStatus("Meowchi", 503).detail).toContain("503");
  });
});

describe("classifyError", () => {
  it("names a timeout as such", () => {
    const result = classifyError("AzeroTech", new Error("The operation was aborted due to timeout"));
    expect(result.up).toBe(false);
    expect(result.detail).toContain("timed out");
  });

  it("reports anything else as unreachable", () => {
    const result = classifyError("AzeroTech", new Error("getaddrinfo ENOTFOUND"));
    expect(result.up).toBe(false);
    expect(result.detail).toContain("unreachable");
  });
});

describe("checkSite", () => {
  it("reports a reachable site as up", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200 }));
    const result = await checkSite({ name: "Meowchi", url: "https://example.test" });
    expect(result.up).toBe(true);
  });

  it("turns a rejected fetch into a finding rather than throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("socket hang up")));
    const result = await checkSite({ name: "Meowchi", url: "https://example.test" });
    expect(result.up).toBe(false);
    expect(result.detail).toContain("unreachable");
  });
});

describe("checkSites", () => {
  it("checks every site and keeps going when one is down", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 200 })
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce({ status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const results = await checkSites();

    expect(results).toHaveLength(SITES.length);
    expect(results.filter((r) => !r.up)).toHaveLength(1);
  });
});

describe("SITES", () => {
  it("watches the three agreed hosts over https", () => {
    expect(SITES).toHaveLength(3);
    for (const site of SITES) {
      expect(site.url.startsWith("https://")).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/siteHealth.test.ts`
Expected: FAIL — cannot resolve `@/lib/siteHealth`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/siteHealth.ts`:

```ts
/**
 * siteHealth.ts — is each watched site answering?
 *
 * ONE check, not three. Certificate expiry and domain expiry were both
 * specified and both dropped on evidence (design P5a-9, P5a-10): every watched
 * host is a *.vercel.app subdomain, so neither the registration nor the
 * certificate is Riku's to renew, and a certificate that actually broke would
 * already fail the fetch below. Do not add them back without a domain he
 * controls.
 *
 * Nothing here throws. A site that is down is a FINDING, reported in the
 * morning digest; only an error in the checking machinery itself makes the
 * site-health run ok:false, because a client site being down for a week must
 * not make the watchdog report the monitoring as broken.
 */

export interface SiteTarget {
  name: string;
  url: string;
}

/**
 * Confirmed with Riku 2026-08-30, all three reachable when checked.
 * ShikksTracker is here because the whole outreach pipeline depends on it and
 * nothing else watches it.
 */
export const SITES: SiteTarget[] = [
  { name: "AzeroTech", url: "https://azerotech.vercel.app" },
  { name: "Meowchi", url: "https://meowchi.vercel.app" },
  { name: "ShikksTracker", url: "https://shikkstracker.vercel.app" },
];

export const SITE_TIMEOUT_MS = 8_000;

export interface SiteResult {
  name: string;
  up: boolean;
  /** One short human-readable line; goes straight into the digest. */
  detail: string;
}

/** Pure. Redirects are followed by fetch, so this judges the final status. */
export function classifyStatus(name: string, status: number): SiteResult {
  if (status >= 400) {
    return { name, up: false, detail: `${name} returned HTTP ${status}` };
  }
  return { name, up: true, detail: `${name} ok` };
}

/** Pure. DNS failure, refused connection and TLS failure all land here. */
export function classifyError(name: string, err: unknown): SiteResult {
  const message = err instanceof Error ? err.message : String(err);
  const timedOut = /abort|timeout|timed out/i.test(message);
  return {
    name,
    up: false,
    detail: `${name} ${timedOut ? "timed out" : "unreachable"}`,
  };
}

export async function checkSite(
  target: SiteTarget,
  timeoutMs: number = SITE_TIMEOUT_MS
): Promise<SiteResult> {
  try {
    const response = await fetch(target.url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return classifyStatus(target.name, response.status);
  } catch (err) {
    return classifyError(target.name, err);
  }
}

/** All sites in parallel; checkSite never rejects, so neither does this. */
export async function checkSites(
  targets: SiteTarget[] = SITES,
  timeoutMs: number = SITE_TIMEOUT_MS
): Promise<SiteResult[]> {
  return Promise.all(targets.map((target) => checkSite(target, timeoutMs)));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/siteHealth.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/siteHealth.ts src/lib/__tests__/siteHealth.test.ts
git commit -m "feat(site-health): daily uptime check for the three watched sites"
```

---

## Task 6: The digest

**Files:**
- Create: `src/lib/digest.ts`
- Modify: `src/lib/stApi.ts`
- Test: `src/lib/__tests__/digest.test.ts`

- [ ] **Step 1: Widen the attention response type**

In `src/lib/stApi.ts`, replace the `AttentionResponse` interface with:

```ts
/** A contact whose next-action date has passed. */
export interface OverdueActionItem {
  contactId: string;
  businessName: string;
  nextActionAt: string;
  nextActionNote: string | null;
}

export interface AttentionResponse {
  repliedUnanswered: AttentionItem[];
  /**
   * Also returned by the OS API (verified in ShikksTracker's
   * src/lib/os/attention.ts). Optional here because P4 shipped without it, so
   * nothing may assume its presence at runtime — read it defensively.
   */
  overdueActions?: OverdueActionItem[];
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/__tests__/digest.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { composeDigest } from "@/lib/digest";

const base = {
  pending: 0,
  attention: { repliedUnanswered: 0, overdue: 0 },
  problems: [] as string[],
  offAgents: [] as string[],
};

describe("composeDigest", () => {
  it("says all clear when nothing is wrong", () => {
    const digest = composeDigest({ ...base, pending: 2 });
    expect(digest.title).toContain("All clear");
    expect(digest.title).toContain("2");
    expect(digest.body).toContain("All clear");
  });

  it("leads the title with the problem count", () => {
    const digest = composeDigest({ ...base, problems: ["chaser failed", "Meowchi unreachable"] });
    expect(digest.title).toContain("2 problems");
  });

  it("puts problems first in the body so truncation cannot eat them", () => {
    const digest = composeDigest({
      ...base,
      pending: 5,
      attention: { repliedUnanswered: 3, overdue: 1 },
      problems: ["Meowchi unreachable"],
    });
    expect(digest.body.indexOf("Meowchi unreachable")).toBe(0);
  });

  it("reports the pipeline as unavailable rather than as zero", () => {
    const digest = composeDigest({ ...base, attention: null });
    expect(digest.body).toContain("unavailable");
    expect(digest.body).not.toContain("0 waiting");
  });

  it("names agents that are switched off", () => {
    const digest = composeDigest({ ...base, offAgents: ["chaser"] });
    expect(digest.body).toContain("Off: chaser");
  });

  it("says nothing about off agents when none are off", () => {
    expect(composeDigest(base).body).not.toContain("Off:");
  });

  it("uses singular wording for one problem", () => {
    const digest = composeDigest({ ...base, problems: ["chaser failed"] });
    expect(digest.title).toContain("1 problem");
    expect(digest.title).not.toContain("problems");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/digest.test.ts`
Expected: FAIL — cannot resolve `@/lib/digest`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/digest.ts`:

```ts
/**
 * digest.ts — the one push Riku gets each morning.
 *
 * Pure, so the wording is testable without sending anything.
 *
 * It goes out EVERY day, including when nothing is wrong (design P5a-4). That
 * is deliberate: Riku chose "the missing push is enough" as the outer safety
 * net, and an absence only means something if the presence is unconditional.
 * Hence "All clear" rather than a silent morning.
 *
 * Problems come first in the body because buildPushPayload truncates it at 200
 * characters and a lock-screen preview is shorter still.
 */

export interface DigestInput {
  /** ApprovalItems waiting on a decision. */
  pending: number;
  /** null means the OS API call failed — reported as unavailable, never as zero. */
  attention: { repliedUnanswered: number; overdue: number } | null;
  /** Watchdog anomalies, down sites, and any job that failed in this same run. */
  problems: string[];
  /** Agents switched off in OsSettings, so a pause cannot be forgotten. */
  offAgents: string[];
}

export interface Digest {
  title: string;
  body: string;
}

export function composeDigest(input: DigestInput): Digest {
  const problemCount = input.problems.length;
  const reviewPart = `${input.pending} to review`;

  const title =
    problemCount > 0
      ? `${problemCount} problem${problemCount === 1 ? "" : "s"} · ${reviewPart}`
      : `All clear · ${reviewPart}`;

  const lines: string[] = [];
  lines.push(problemCount > 0 ? input.problems.join("; ") : "All clear.");

  if (input.attention === null) {
    lines.push("Pipeline check unavailable.");
  } else {
    lines.push(
      `${input.attention.repliedUnanswered} waiting on you, ${input.attention.overdue} overdue.`
    );
  }

  if (input.offAgents.length > 0) {
    lines.push(`Off: ${input.offAgents.join(", ")}.`);
  }

  return { title, body: lines.join(" ") };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/digest.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/digest.ts src/lib/stApi.ts src/lib/__tests__/digest.test.ts
git commit -m "feat(digest): compose the one daily push, problems first"
```

---

## Task 7: The morning route and the cron schedule

**Files:**
- Create: `src/app/api/cron/morning/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Write the route**

Create `src/app/api/cron/morning/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireCronSecret } from "@/lib/auth";
import { getOsSettings } from "@/lib/osSettings";
import { runJob } from "@/lib/jobs/runJob";
import { runExpirySweep } from "@/lib/jobs/expirySweep";
import { EXPECTATIONS, evaluateWatchdog, fetchLatestRuns } from "@/lib/watchdog";
import { checkSites } from "@/lib/siteHealth";
import { composeDigest } from "@/lib/digest";
import { fetchAttention } from "@/lib/stApi";
import { buildPushPayload, sendPushToAll } from "@/lib/push";
import ApprovalItem from "@/models/ApprovalItem";

/**
 * GET /api/cron/morning
 *
 * The multiplexer. Vercel Hobby allows two cron jobs, each once per day, and
 * the chaser owns the other slot — so the watchdog, the site check and the
 * daily digest share this one invocation rather than getting crons of their
 * own (design P5a-3).
 *
 * Ordering rules this route obeys (CLAUDE.md):
 *  - every job writes its own AgentRun record, success or failure, via runJob;
 *  - one job's failure never stops the next — it becomes an ok:false row that
 *    tomorrow's watchdog reports, and today's dispatcher names immediately;
 *  - the push is sent by the LAST job, after every other job's data state is
 *    settled, so a notification failure can never corrupt anything.
 */
export const maxDuration = 60;

/** Bounded, per CLAUDE.md's rule on list endpoints. */
const ATTENTION_LIMIT = 50;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = requireCronSecret(request);
  if (guard) return guard;

  try {
    await connectDB();
    const settings = await getOsSettings();

    // Data hygiene runs whatever the monitoring toggle says: it predates P5a,
    // and switching monitoring off must not quietly stop stale items expiring.
    const expiry = await runJob("expiry-sweep", async () => {
      const swept = await runExpirySweep(new Date());
      return { counts: { itemsProcessed: swept.expired + swept.unstuck }, data: swept };
    });

    if (!settings.monitoringEnabled) {
      // Still record a run per agent, exactly as the chaser does when disabled,
      // so the watchdog can tell "switched off" from "cron never fired".
      const note = "monitoring is disabled in OsSettings";
      for (const agent of ["watchdog", "site-health", "dispatcher"] as const) {
        await runJob(agent, async () => ({ data: null }), note);
      }
      return NextResponse.json({ ok: true, monitoring: "disabled", expiry: expiry.data });
    }

    const watch = await runJob("watchdog", async () => {
      const latest = await fetchLatestRuns(EXPECTATIONS.map((e) => e.agent));
      const anomalies = evaluateWatchdog(new Date(), latest);
      return {
        counts: { itemsProcessed: EXPECTATIONS.length, itemsFailed: anomalies.length },
        data: anomalies,
      };
    });

    const health = await runJob("site-health", async () => {
      const results = await checkSites();
      return { counts: { itemsProcessed: results.length }, data: results };
    });

    // Dispatcher last: every other record is written by now.
    const dispatch = await runJob("dispatcher", async () => {
      const pending = await ApprovalItem.countDocuments({ status: "pending" });

      // A dependency being down must not cost the whole digest.
      const attention = await fetchAttention(settings.chaserNDays, ATTENTION_LIMIT).catch(
        () => null
      );

      const problems: string[] = [];
      if (!expiry.ok) problems.push(`expiry sweep failed: ${expiry.error ?? "unknown"}`);
      if (!watch.ok) problems.push(`watchdog failed: ${watch.error ?? "unknown"}`);
      if (!health.ok) problems.push(`site health failed: ${health.error ?? "unknown"}`);

      const unstuck = expiry.data?.unstuck ?? 0;
      if (unstuck > 0) {
        problems.push(
          `${unstuck} approved item${unstuck === 1 ? "" : "s"} could not confirm their result`
        );
      }

      for (const anomaly of watch.data ?? []) problems.push(anomaly.detail);
      for (const site of health.data ?? []) {
        if (!site.up) problems.push(site.detail);
      }

      const digest = composeDigest({
        pending,
        attention: attention
          ? {
              repliedUnanswered: attention.repliedUnanswered.length,
              overdue: attention.overdueActions?.length ?? 0,
            }
          : null,
        problems,
        offAgents: settings.chaserEnabled ? [] : ["chaser"],
      });

      await sendPushToAll(buildPushPayload(digest.title, digest.body));
      return { counts: { itemsProcessed: problems.length }, data: digest };
    });

    return NextResponse.json({
      ok: true,
      expiry: { ok: expiry.ok, ...(expiry.data ?? {}) },
      watchdog: { ok: watch.ok, anomalies: watch.data?.length ?? 0 },
      siteHealth: { ok: health.ok, down: (health.data ?? []).filter((s) => !s.up).length },
      dispatcher: { ok: dispatch.ok, title: dispatch.data?.title ?? null },
    });
  } catch (err) {
    // Only a failure of the route itself lands here — job failures are records,
    // not exceptions.
    const error = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
    try {
      await sendPushToAll(buildPushPayload("Morning run failed", error));
    } catch (pushErr) {
      console.error("[cron/morning] failure alert could not be sent:", pushErr);
    }
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
```

- [ ] **Step 2: Update the cron schedule**

Replace the `crons` array in `vercel.json` so the whole file reads:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "regions": ["sin1"],
  "crons": [
    { "path": "/api/cron/chaser", "schedule": "0 22 * * *" },
    { "path": "/api/cron/morning", "schedule": "0 23 * * *" }
  ]
}
```

That is 06:00 and 07:00 Manila. Still exactly two entries — a third will be rejected on a Hobby plan. `/api/cron/expire` remains as a route for manual triggering; it is simply no longer scheduled.

- [ ] **Step 3: Type-check and run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; every test passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/morning/route.ts vercel.json
git commit -m "feat(cron): morning multiplexer running sweep, watchdog, health and digest"
```

---

## Task 8: Verification, deploy, and the acceptance run

An agent feature is only done when it has been observed doing its job once against real data.

- [ ] **Step 1: Run the full verification trio**

Run: `npm test`
Expected: all suites pass.

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm run build`
Expected: build completes; `/api/cron/morning` appears in the route list.

- [ ] **Step 2: Exercise the route locally**

Start the dev server on port 3001 (ShikksTracker uses 3000):

```bash
npm run dev -- -p 3001
```

Then, with the `CRON_SECRET` from `.env.local`:

```bash
curl -s -H "x-cron-secret: $CRON_SECRET" http://localhost:3001/api/cron/morning
```

Expected while `monitoringEnabled` is still false: `{"ok":true,"monitoring":"disabled",...}`.

- [ ] **Step 3: Turn monitoring on and run it again**

Open `http://localhost:3001/settings`, press **Turn monitoring on**, then re-run the curl above.
Expected: `ok: true`, with `watchdog`, `siteHealth` and `dispatcher` all reporting `ok: true`. On a fresh database the watchdog will legitimately report `never-ran` anomalies for agents that have not run locally — that is the check working, not a bug.

- [ ] **Step 4: Commit any fixes, then push and deploy**

```bash
git push origin master
```

Vercel builds `master`. Afterwards, confirm in the Vercel dashboard that **exactly two** cron jobs are listed: `/api/cron/chaser` at 22:00 UTC and `/api/cron/morning` at 23:00 UTC.

- [ ] **Step 5: Acceptance test 1 — a real run, a real push**

Trigger production with the production `CRON_SECRET`:

```bash
curl -s -H "x-cron-secret: $CRON_SECRET" https://riku-os.vercel.app/api/cron/morning
```

Expected: HTTP 200, a push notification arrives on the iPhone, and four new `AgentRun` rows exist (`expiry-sweep`, `watchdog`, `site-health`, `dispatcher`).

- [ ] **Step 6: Acceptance test 2 — prove absence is detected**

Temporarily add a never-run agent to the expectations table in `src/lib/watchdog.ts`:

```ts
  { agent: "retro", everyHours: 24, graceHours: 6 },
```

Deploy, trigger the route, and confirm the digest names `retro has never run`. Then **remove that line**, deploy again, and confirm the digest returns to normal.

- [ ] **Step 7: Acceptance test 3 — prove a down site is reported**

Temporarily point one entry in `SITES` at a hostname that does not resolve:

```ts
  { name: "AzeroTech", url: "https://azerotech-does-not-exist.vercel.app" },
```

Deploy, trigger, and confirm the digest reads `AzeroTech unreachable`. Then **restore the real URL** and deploy again.

- [ ] **Step 8: Record the outcome**

Add a `**DONE**` line under P5 in `docs/ROADMAP.md` noting the date and what was observed, in the same style as the P3 and P4 entries. Note explicitly that tasks 5.1, 5.2 and 5.4 are done and that **5.3 (lead sweep) remains open as P5b**.

```bash
git add docs/ROADMAP.md
git commit -m "docs: record the P5a acceptance run"
git push origin master
```

---

## What this plan deliberately does not build

Messenger webhook freshness and the Meta Graph ping (they wait for ShikksTracker's P2) · the lead sweep (P5b) · certificate and domain expiry checks (P5a-9, P5a-10) · per-site history or uptime records (P8) · drafted client emails on health issues (P5a-5) · a to-do store or a "Today" digest section (post-v0).
