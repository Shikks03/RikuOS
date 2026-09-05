/**
 * outreachHealth.ts — "is ShikksTracker's outreach pipeline still moving?"
 *
 * The watchdog answers "did every RikuOS agent run?". This answers a question
 * nothing was asking: the outreach pipeline lives in another repo, behind an
 * API, and RikuOS is the only thing watching it.
 *
 * WHY THIS EXISTS. On 2026-08-30 a read of GET /api/os/summary showed
 * `engine.lastRunAt` at 2026-08-01 — the send engine had been silently still
 * for 29 days — while two approved follow-ups the chaser had produced sat
 * undelivered. Nothing alarmed, because nothing was looking: RikuOS consumed
 * only /attention and /drafts. That is precisely the class of failure the OS
 * exists to catch (concept §1), so the check is now part of the morning run.
 *
 * The root cause was then found in ShikksTracker's own source: its engine is
 * triggered by an EXTERNAL hourly pinger that had never been set up, so nothing
 * had ever called /api/cron/sequence on a schedule.
 *
 * RESOLVED 2026-09-04: that pinger now exists (a GitHub Actions workflow,
 * ShikksTracker commit 61d36bb) and engine.lastRunAt reads same-day again.
 *
 * What has NOT changed, and must not be read as a leftover fault: both engine
 * switches are off, so it runs and sends nothing. That is the resting state by
 * Riku's standing instruction (decision S10) — nothing goes to a business
 * until he says so, each time. A healthy engine that sends nothing is correct,
 * and approved messages waiting beside it are correct. Do not report either,
 * and do not propose enabling a switch.
 *
 * NO MESSENGER CHECK LIVES HERE ANY MORE, and it must not come back.
 * This file used to judge `messenger.lastEventAt` as the inbound webhook's
 * liveness signal. The whole Messenger lane was deleted in S15 (2026-09-05)
 * because Meta only delivers webhook events to role-holding accounts while the
 * app is unpublished, so prospect DMs never arrived at all.
 *
 * The trap that made removing this NON-OPTIONAL: ShikksTracker is dropping the
 * `messenger` block from GET /api/os/summary, and `readStamp` in stApi.ts maps
 * a MISSING block to `null` — which was exactly the `webhook-never-fired`
 * branch. Leaving the check in would have turned a staleness false alarm into
 * a "no Messenger event, ever" false alarm, fired in the morning push every
 * single day. A daily false alarm in the one push Riku is meant to trust is
 * precisely how P5's design says a monitor gets ignored.
 *
 * Nothing here throws. A stalled engine is a FINDING, reported in the digest;
 * only a failure of the checking machinery itself (the fetch) makes the run
 * ok:false — the same split siteHealth uses, and for the same reason: a
 * dependency being broken for a week must not read as the monitor being broken.
 */

import type { SummaryResponse } from "@/lib/stApi";

export type OutreachFindingKind =
  | "engine-never-ran"
  | "engine-unreadable"
  | "engine-stale"
  | "engine-errors"
  | "stranded-approved";

export interface OutreachFinding {
  kind: OutreachFindingKind;
  /** One short human-readable line; goes straight into the digest. */
  detail: string;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * How old `engine.lastRunAt` may get before it is a problem.
 *
 * Derived from ShikksTracker's real cadence, verified in its source on
 * 2026-08-30 rather than assumed. Its engine is driven by an external hourly
 * pinger, scheduled only for UTC hours 0-9 (= 08:00-18:00 Manila, matching its
 * own send window), so the longest LEGITIMATE gap is the overnight one: about
 * 14 hours. 36 gives roughly 2.5x that margin while still raising a dead
 * engine on the second morning after it stops.
 *
 * The staleness reading is only valid because that engine records its run
 * UNCONDITIONALLY — `CronRun.create` sits at the end of `runSequenceEngine`
 * with no early return before it, so a run that fires with sending disabled,
 * outside the window, or at its daily cap still stamps `lastRunAt`. A frozen
 * timestamp therefore means the engine did not run, never "it ran but had
 * nothing to do". If ShikksTracker ever moves that write behind a condition,
 * this whole check silently becomes a lie.
 */
export const ENGINE_STALE_HOURS = 36;

/** Hours read badly past a couple of days; the real fault was 696h old. */
export function formatAge(ms: number): string {
  const hours = Math.floor(ms / HOUR_MS);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Pure. The engine findings are mutually exclusive, on the watchdog's rule: an
 * engine that never ran cannot also be stale, and a stale engine's
 * `lastRunErrors` describes a run from before the stall, so reporting it would
 * point at the wrong problem.
 *
 * `stranded-approved` is separate and CAN accompany a stale engine, because it
 * is a different fact about a different victim: the engine finding says the
 * machine stopped, this one says real messages to real clients are sitting
 * undelivered because of it. Riku needs both — one is a repair, the other is a
 * promise someone is still waiting on.
 */
export function evaluateOutreach(
  now: Date,
  summary: SummaryResponse,
  staleHours: number = ENGINE_STALE_HOURS
): OutreachFinding[] {
  const findings: OutreachFinding[] = [];
  const { engine, queue } = summary;

  let engineStalled = false;

  if (engine.lastRunAt === null) {
    engineStalled = true;
    findings.push({
      kind: "engine-never-ran",
      detail: "ShikksTracker send engine has never reported a run",
    });
  } else if (Number.isNaN(new Date(engine.lastRunAt).getTime())) {
    // Without this branch a malformed timestamp reads as healthy forever:
    // NaN fails every comparison below, so the engine would silently pass its
    // staleness check no matter how long it had been down.
    engineStalled = true;
    findings.push({
      kind: "engine-unreadable",
      detail: "ShikksTracker send engine reported an unreadable run time",
    });
  } else {
    const ageMs = now.getTime() - new Date(engine.lastRunAt).getTime();
    if (ageMs > staleHours * HOUR_MS) {
      engineStalled = true;
      findings.push({
        kind: "engine-stale",
        detail: `ShikksTracker send engine last ran ${formatAge(ageMs)} ago`,
      });
    } else if (engine.lastRunErrors !== null && engine.lastRunErrors > 0) {
      findings.push({
        kind: "engine-errors",
        detail: `ShikksTracker send engine reported ${engine.lastRunErrors} error${
          engine.lastRunErrors === 1 ? "" : "s"
        }`,
      });
    }
  }

  // Only meaningful while the engine is stalled. Approved messages waiting
  // beside a HEALTHY engine are simply about to be sent, and saying so every
  // morning would train Riku to ignore the line that matters.
  if (engineStalled && queue.approved !== null && queue.approved > 0) {
    findings.push({
      kind: "stranded-approved",
      detail: `${queue.approved} approved message${
        queue.approved === 1 ? " is" : "s are"
      } stranded, unsent`,
    });
  }

  return findings;
}
