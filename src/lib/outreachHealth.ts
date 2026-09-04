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
 * MESSENGER — what is judged here, and what is deliberately not.
 * ShikksTracker's P2 Messenger webhook is LIVE: verified against production on
 * 2026-09-04, where `messenger.lastEventAt` came back as a real, recent
 * timestamp rather than the P1 null. Its contract
 * (../ShikksTracker/docs/os-api.md) makes that field the webhook's liveness
 * signal — it is the `createdAt` of the newest Messenger message, inbound or
 * outbound, so it advances whenever Meta delivers anything at all. `null`
 * therefore no longer means "no webhook yet"; it now means no Messenger event
 * has EVER been received, which on a live deployment is a subscription that
 * has never worked.
 *
 * A `lastEventAt` that stops advancing is the EXPECTED failure mode, not a
 * rare one: the dev-mode page access token expires on a roughly 60-day cycle,
 * and Meta disables subscriptions that repeatedly fail to deliver. The
 * threshold is therefore calibrated against message VOLUME, not uptime — this
 * page receives a handful of messages a week, so a quiet day is silence, not
 * death, and the unit is days rather than hours.
 *
 * `unlinkedCount` and `unansweredCount` stay UNJUDGED, on the same rule that
 * keeps `queue.drafts` unjudged: they describe Riku's own queue of work, not a
 * machine that has broken. A monitor that reads a person's backlog back to
 * them every morning is a monitor they stop opening.
 *
 * That rationale is CONDITIONAL, and is written down so it expires out loud
 * rather than quietly becoming false. ShikksTracker's contract says a climbing
 * `unlinkedCount` means triage has stalled — which is Riku's own business only
 * while triage is Riku. When P6 ships a triage agent, these counts become the
 * output of a machine that can break, and judging them here becomes correct.
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
  | "stranded-approved"
  | "webhook-never-fired"
  | "webhook-unreadable"
  | "webhook-stale";

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

/**
 * How long `messenger.lastEventAt` may sit unchanged before it is a problem.
 *
 * Riku's call on 2026-09-04, chosen over 7 and 14. Ten days is well outside
 * normal traffic on this page: it receives a handful of messages a week, and
 * the field advances on OUTBOUND messages too — Riku's own replies from the
 * page move it — so ten days is silence in both directions at once, not a
 * quiet inbox.
 *
 * Be precise about what this buys, because it is easy to overclaim: the alarm
 * fires AFTER Meta stops delivering, so it trails the failure and gives no
 * advance warning of an expiring token. And the trailing gap is up to ELEVEN
 * days, not ten — the comparison is strict and the digest runs once a day, so
 * silence that crosses the threshold just after one morning's run waits for
 * the next. Eleven days is still under a fifth of the dev-mode token's ~60-day
 * life: short enough that an expiry is caught and regenerated inside the same
 * cycle rather than surfacing when a lead complains they were ignored. Advance
 * warning needs the token checked directly, which this repo cannot do (S9).
 *
 * Ten rather than seven or fourteen, on volume: at roughly five messages a
 * week counted in both directions the ordinary gap between events is a day or
 * two, so ten days is several times the longest quiet stretch seen so far.
 * The residual is real and is named rather than argued away — a fortnight with
 * no inbound message AND no reply sent from the page would raise this line
 * falsely. That is accepted: it is rare, a false alarm costs one glance at
 * Meta's dashboard, and a missed one costs leads nobody ever hears from.
 */
export const WEBHOOK_SILENT_DAYS = 10;

const DAY_MS = 24 * HOUR_MS;

/** Hours read badly past a couple of days; the real fault was 696h old. */
export function formatAge(ms: number): string {
  const hours = Math.floor(ms / HOUR_MS);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Pure. Findings are ordered most-COSTLY-first rather than most-fundamental
 * first, which is the one place this file departs from the watchdog: the
 * webhook block is emitted ahead of the engine block because the push body is
 * truncated and last means lost (the reasoning sits inline at that block).
 * Within each subsystem the findings are mutually exclusive, on the watchdog's
 * rule: an engine that never ran cannot also be stale, and a stale engine's
 * `lastRunErrors` describes a run from before the stall, so reporting it would
 * point at the wrong problem.
 *
 * `stranded-approved` is separate and CAN accompany a stale engine, because it
 * is a different fact about a different victim: the engine finding says the
 * machine stopped, this one says real messages to real clients are sitting
 * undelivered because of it. Riku needs both — one is a repair, the other is a
 * promise someone is still waiting on.
 *
 * The webhook findings are exclusive among THEMSELVES on the same rule, but
 * fully independent of the engine ones: the send engine pushes outbound and
 * the webhook receives inbound, they are two separate subsystems, and letting
 * either suppress the other would report half of a total outage as the whole.
 */
export function evaluateOutreach(
  now: Date,
  summary: SummaryResponse,
  staleHours: number = ENGINE_STALE_HOURS,
  silentDays: number = WEBHOOK_SILENT_DAYS
): OutreachFinding[] {
  const findings: OutreachFinding[] = [];
  const { engine, queue, messenger } = summary;

  // The webhook goes FIRST, and the order is not cosmetic. These findings are
  // appended after the watchdog's and siteHealth's in buildProblems, and the
  // push body is sliced at 200 chars (push.ts) — a raw slice, no ellipsis and
  // no line-awareness, so a line straddling the cut is truncated mid-word and
  // a line starting past it is gone entirely. With no dashboard, that push is
  // the only channel any of this has, so what falls off is lost rather than
  // merely shortened. Of the two subsystems, a dead inbound webhook is the
  // unrecoverable one: leads message the page and are silently dropped, and
  // nobody ever learns it happened. A stalled outbound engine holds its
  // messages and sends them when it restarts. The loss that cannot be undone
  // is the one that must survive truncation.
  //
  // Same reason two of the three lines below drop the "ShikksTracker" prefix
  // the engine lines carry. The asymmetry is deliberate — do not "restore
  // consistency" here; every character saved is headroom against that slice.
  // Only the null line keeps the prefix, where it is load-bearing for
  // diagnosis (see below); the other two already name the subsystem, and the
  // digest has exactly one upstream.
  if (messenger.lastEventAt === null) {
    // Named as ShikksTracker REPORTING nothing rather than as Meta failing,
    // because the payload cannot tell those apart: a rollback to any pre-P2
    // deploy sends `messenger: {lastEventAt: null, …}` — block present, field
    // null — which is byte-identical on the wire to a genuine "no event has
    // ever arrived". No parser fix reaches that case (readStamp separates the
    // non-string shapes, not this one), so the wording carries it instead: this
    // line stays true under both readings and points at the repo to check
    // first.
    findings.push({
      kind: "webhook-never-fired",
      detail: "ShikksTracker reports no Messenger event, ever",
    });
  } else if (Number.isNaN(new Date(messenger.lastEventAt).getTime())) {
    // Closes the same hole the engine's unreadable branch closes: NaN loses
    // every comparison, so an unparseable stamp would slip past the silence
    // check below and read as healthy forever.
    //
    // Only the UNPARSEABLE case, though — claim no more than that. A
    // parseable but future-dated stamp still reads as healthy indefinitely and
    // nothing here catches it. That is left alone on purpose rather than
    // overlooked: the field is ShikksTracker's own server `createdAt` at
    // ingest, not a value Meta or a sender supplies, so the only realistic
    // error is clock skew of seconds against a ten-day window.
    findings.push({
      kind: "webhook-unreadable",
      detail: "Messenger webhook event time unreadable",
    });
  } else {
    const silentMs = now.getTime() - new Date(messenger.lastEventAt).getTime();
    if (silentMs > silentDays * DAY_MS) {
      findings.push({
        kind: "webhook-stale",
        detail: `Messenger webhook silent for ${formatAge(silentMs)}`,
      });
    }
  }

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
