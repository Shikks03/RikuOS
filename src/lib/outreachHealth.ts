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
 * triggered by an EXTERNAL hourly pinger that was never set up, so nothing has
 * ever called /api/cron/sequence on a schedule. Two consequences worth knowing
 * before reading a digest: this check will report the stall EVERY morning
 * until Riku wires that pinger, which is correct — a real fault stays reported
 * until it is fixed — and its two settings toggles both default to false, so a
 * pinger alone will not make the engine send.
 *
 * SCOPE BOUNDARY — messenger. `summary.messenger` is deliberately NOT
 * evaluated here. Until ShikksTracker's P2 is DEPLOYED, those fields are
 * hardcoded to zero and `lastEventAt: null` means "no webhook yet", NOT "the
 * webhook is dead" (design P5a-1; see
 * docs/handoffs/2026-08-30-p2-messenger-webhook.md). Deployed, not merely
 * written: as of 2026-08-30 P2 exists on a branch there while `origin/main` —
 * what production serves — still returns the P1 zeros. Evaluating them today
 * would produce a false alarm every single morning. The fields are carried
 * through fetchSummary so the check is a pure addition here once P2 is live —
 * do not add it before that.
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
 * Pure. Findings are ordered most-fundamental-first and the engine ones are
 * mutually exclusive, on the watchdog's rule: an engine that never ran cannot
 * also be stale, and a stale engine's `lastRunErrors` describes a run from
 * before the stall, so reporting it would point at the wrong problem.
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
