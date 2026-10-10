/**
 * briefingView.ts — the Briefing's view models (S21). Pure: no database, no
 * network, no clock (`now` is a parameter). Imports are pure modules or
 * `import type` only (viewModelPurity.test.ts).
 *
 * THE GREETING LINE is the retired push tile's state machine (buildPushTileView,
 * P10b), moved here unchanged in its precedence and re-voiced (spec §5.1), with
 * states two rounds of lead review have added since — a dispatcher run that
 * ran and failed is NOT "a run that didn't happen", and a run that was
 * skipped is a fact about this morning, not nothing:
 *
 *   digest unreadable                            → fail
 *   a digest sent today (APP_TZ):
 *     reached zero devices (devices === 0)       → undelivered
 *     otherwise                                  → today (its stored title)
 *   a dispatcher run started today, NOT skipped:
 *     ok                                          → unsaved
 *     failed, zero devices reached (noDevice)     → undelivered
 *     failed, otherwise                           → failed
 *   monitoring off                                 → monitoring-off
 *   a dispatcher run started today, skipped        → skipped (stopgap — see note below)
 *   dispatcher unreadable                          → fail (can't tell "none" from "unsaved")
 *   no digest ever                                 → never
 *   an older digest, in APP_TZ:
 *     before PUSH_EXPECTED_HOUR                    → before
 *     PUSH_EXPECTED_HOUR..PUSH_LATE_HOUR (grace)    → due
 *     from PUSH_LATE_HOUR                           → missing
 *
 * SKIPPED IS A STOPGAP. It reports "monitoring was off this morning" as a
 * fact, which is strictly better than the `missing` alarm it used to read as
 * (CLAUDE.md: no silent failure, never guess). Riku wants a manual "Debrief"
 * button here later, to catch up on what happened while monitoring was off —
 * a separate feature, not built here.
 *
 * Tone is colour AND a leading dot (spec §5.1), never colour alone.
 *
 * PAGE TEXT. Stored strings are push-form (straight apostrophes); everything
 * leaving this file for the page is curled by toPage, which never changes a
 * string's length, so stored bold ranges stay valid after curling. Raw
 * errors are NOT curled: they are quoted evidence.
 */

import { APP_TZ, PUSH_EXPECTED_HOUR, PUSH_LATE_HOUR } from "@/lib/constants";
import { addDays, clockHHMM, dayKey, formatDay, todayKey } from "@/lib/days";
import { toPage } from "@/lib/voice";
import type { StoredDigest } from "@/lib/lastDigest";
import type { StoredBold, StoredBriefing } from "@/lib/briefingTypes";

export interface GreetingInput {
  now: Date;
  /** getLastDigest(): null = never stored (R55); "unavailable" = the read threw. */
  digest: StoredDigest | null | "unavailable";
  /**
   * The dispatcher's newest run. `skipped` = monitoring was off for it.
   * `noDevice` = the run finished but the push reached zero devices
   * (the morning route's own NO_DEVICE_ERROR marker on an `ok: false` run) —
   * meaningful only when `ok` is false.
   */
  dispatcher: { ok: boolean; startedAt: Date; skipped: boolean; noDevice: boolean } | null | "unavailable";
  monitoringEnabled: boolean | "unavailable";
}

export type GreetingTone = "normal" | "warning" | "alarm" | "muted";

export interface GreetingLine {
  kind:
    | "today"
    | "unsaved"
    | "undelivered"
    | "failed"
    | "monitoring-off"
    | "skipped"
    | "fail"
    | "never"
    | "missing"
    | "due"
    | "before";
  text: string;
  tone: GreetingTone;
  /** "digest" = tapping opens the stored digest's Briefing; null = nothing to open. */
  opens: "digest" | null;
}

export function buildGreetingLine(input: GreetingInput): GreetingLine {
  const { digest, now } = input;
  const today = todayKey(now);

  if (digest === "unavailable") return { kind: "fail", text: "I couldn’t load the briefing.", tone: "warning", opens: null };
  if (digest !== null && dayKey(digest.sentAt, APP_TZ) === today) {
    if (digest.devices === 0) {
      return { kind: "undelivered", text: "This morning’s briefing reached none of your devices.", tone: "alarm", opens: "digest" };
    }
    const problems = digest.briefing !== null && digest.briefing.stories.length > 0;
    return { kind: "today", text: toPage(digest.title), tone: problems ? "warning" : "normal", opens: "digest" };
  }

  // The dispatcher's newest run, narrowed to one started today — read once,
  // since the skipped and non-skipped branches below both need it, at
  // different points in the precedence.
  const dispatcherToday =
    input.dispatcher !== "unavailable" && input.dispatcher !== null && dayKey(input.dispatcher.startedAt, APP_TZ) === today
      ? input.dispatcher
      : null;

  if (dispatcherToday !== null && !dispatcherToday.skipped) {
    if (dispatcherToday.ok) {
      return { kind: "unsaved", text: "A briefing went out, but I couldn’t save it.", tone: "warning", opens: null };
    }
    const opens = digest === null ? null : "digest";
    return dispatcherToday.noDevice
      ? { kind: "undelivered", text: "This morning’s briefing reached none of your devices.", tone: "alarm", opens }
      : { kind: "failed", text: "This morning’s briefing run failed.", tone: "alarm", opens };
  }
  if (input.monitoringEnabled === false) {
    return {
      kind: "monitoring-off",
      text: "Monitoring is off, so there’s no morning briefing.",
      tone: "muted",
      opens: digest === null ? null : "digest",
    };
  }
  if (dispatcherToday !== null && dispatcherToday.skipped) {
    return {
      kind: "skipped",
      text: "Monitoring was off at 07:00, so there’s no briefing today.",
      tone: "muted",
      opens: digest === null ? null : "digest",
    };
  }
  if (input.dispatcher === "unavailable") return { kind: "fail", text: "I couldn’t load the briefing.", tone: "warning", opens: null };
  if (digest === null) return { kind: "never", text: "No briefing yet.", tone: "muted", opens: null };

  const hour = Number(clockHHMM(now, APP_TZ).slice(0, 2));
  if (hour < PUSH_EXPECTED_HOUR) return { kind: "before", text: "Your briefing comes at 07:00.", tone: "muted", opens: "digest" };
  if (hour < PUSH_LATE_HOUR) return { kind: "due", text: "Your briefing is on its way.", tone: "muted", opens: "digest" };
  return { kind: "missing", text: "No briefing this morning. The 07:00 run didn’t happen.", tone: "alarm", opens: "digest" };
}

// ---- The Briefing ------------------------------------------------------------

export interface Segment {
  text: string;
  bold: boolean;
}

/** Text split by bold ranges, curled for the page. Bad or overlapping ranges are skipped. */
export function segments(text: string, bold: readonly StoredBold[]): Segment[] {
  const page = toPage(text);
  const ranges = [...bold].sort((a, z) => a.start - z.start);
  const out: Segment[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start < at || r.end > page.length || r.start >= r.end) continue;
    if (r.start > at) out.push({ text: page.slice(at, r.start), bold: false });
    out.push({ text: page.slice(r.start, r.end), bold: true });
    at = r.end;
  }
  if (at < page.length) out.push({ text: page.slice(at), bold: false });
  return out;
}

export interface SymptomView {
  /** `${story}.${symptom}` — stable within one Briefing, for keys and the card. */
  id: string;
  sentence: Segment[];
  nextStep: string;
  causeHeading: "Likely cause" | "Cause";
  cause: Segment[];
  /** Quoted evidence, NOT curled. */
  raw: string | null;
}

export interface StoryView {
  id: string;
  sentence: Segment[];
  symptoms: SymptomView[];
}

interface ViewBase {
  /** "This morning" · "Yesterday" · "Last: Sun 9 Aug" */
  label: string;
  /** "07:00" — sentAt in APP_TZ, never the cron's hour. */
  stamp: string;
  title: string;
  isToday: boolean;
  /** Sent back by the client to the seen door and the since door. */
  sentAtIso: string;
  seen: boolean;
}

export type BriefingView =
  | (ViewBase & {
      kind: "full";
      stories: StoryView[];
      today: string;
      freelance: string | null;
      off: string | null;
      /** Stories the stored record dropped past BRIEFING_BOUNDS.stories (0 normally). */
      omitted: number;
    })
  | (ViewBase & { kind: "quote"; body: string });

function storyViews(b: StoredBriefing): StoryView[] {
  return b.stories.map((s, i) => ({
    id: String(i),
    sentence: segments(s.sentence, s.bold),
    symptoms: s.symptoms.map((m, j) => ({
      id: `${i}.${j}`,
      sentence: segments(m.sentence, m.bold),
      nextStep: toPage(m.nextStep),
      causeHeading: m.causeKey === "unrecognised" || m.causeKey === "none" ? "Cause" : "Likely cause",
      cause: segments(m.cause, m.causeBold),
      raw: m.raw,
    })),
  }));
}

export function buildBriefingView(digest: StoredDigest, now: Date): BriefingView {
  const today = todayKey(now);
  const sent = dayKey(digest.sentAt, APP_TZ);
  const label = sent === today ? "This morning" : sent === addDays(today, -1) ? "Yesterday" : `Last: ${formatDay(sent)}`;
  const base: ViewBase = {
    label,
    stamp: clockHHMM(digest.sentAt, APP_TZ),
    title: toPage(digest.title),
    isToday: sent === today,
    sentAtIso: digest.sentAt.toISOString(),
    seen: digest.seenAt !== null,
  };
  if (digest.briefing === null) return { ...base, kind: "quote", body: toPage(digest.body) };
  const b = digest.briefing;
  return {
    ...base,
    kind: "full",
    stories: storyViews(b),
    today: toPage(b.today),
    freelance: b.freelance === null ? null : toPage(b.freelance),
    off: b.off === null ? null : toPage(b.off),
    omitted: b.omitted,
  };
}

/**
 * The full-screen greeting: today's Briefing, not yet seen on any device
 * (spec §5.2, V10). Stays true for a Briefing that reached zero devices
 * (`devices === 0`, the `undelivered` greeting line) — the site is Riku's
 * only channel that morning, so it must still greet him here.
 */
export function shouldAutoOpen(digest: StoredDigest | null | "unavailable", now: Date): boolean {
  if (digest === null || digest === "unavailable") return false;
  return dayKey(digest.sentAt, APP_TZ) === todayKey(now) && digest.seenAt === null;
}

/** The doors' one input: an ISO instant, not more than a minute in the future. */
export function parseSentAt(value: unknown, now: Date): Date | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 40) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value)) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() > now.getTime() + 60_000) return null;
  return d;
}
