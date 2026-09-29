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
 * Problems come first in the body because buildPushPayload truncates it at 320
 * characters and a lock-screen preview is shorter still. The Today sentence
 * comes second (deck §10, D12): after the problems, so a bad night is never
 * cut off, and before the freelance line.
 */

import type { Anomaly } from "@/lib/watchdog";
import type { SiteResult } from "@/lib/siteHealth";
import type { OutreachFinding } from "@/lib/outreachHealth";
import type { CalendarWindow } from "@/lib/google";
import type { Layer } from "@/lib/osSettings";
import { APP_TZ, PUSH_BODY_MAX } from "@/lib/constants";
import { addDays, formatDay, type DayKey } from "@/lib/days";
import { daysLate, sortTodos, todoDueKey } from "@/lib/todos";

export interface DigestInput {
  /** ApprovalItems waiting on a decision. */
  pending: number;
  /** null means the OS API call failed — reported as unavailable, never as zero. */
  attention: { repliedUnanswered: number; overdue: number } | null;
  /**
   * Watchdog anomalies, down sites, and any job that failed in this same run
   * or whose write failed inside it.
   */
  problems: string[];
  /** Agents switched off in OsSettings, so a pause cannot be forgotten. */
  offAgents: string[];
  /** The Today sentence's parts. Required, so the route cannot forget it. */
  today: DigestTodayInput;
}

export interface Digest {
  title: string;
  body: string;
}

/**
 * One problem's worth of body text. A job failure carries a raw exception
 * message bounded only by runJob's 2000-character cap, and the body is sliced
 * at 200 — so without this, one long Mongo error silently evicts every finding
 * behind it. Every real finding ("expiry-sweep last ran 31h ago", "Meowchi
 * unreachable") is far shorter, so only the pathological case is touched.
 */
const MAX_PROBLEM_CHARS = 80;

/** Closes the problems line, without doubling a period `short` already added. */
function end(line: string): string {
  return /[.…!?]$/.test(line) ? line : `${line}.`;
}

function short(problem: string): string {
  return problem.length > MAX_PROBLEM_CHARS
    ? `${problem.slice(0, MAX_PROBLEM_CHARS - 1)}…`
    : problem;
}

/**
 * The problems line within `budget` characters. Problems lead, so the leading
 * fragments are kept whole and the tail collapses into `+N more`, N being the
 * fragments dropped (the title still carries the true count). If even one
 * fragment plus its `+N more` is over, that one fragment is cut to fit, so the
 * line never exceeds its budget and the payload's slice never has to cut.
 */
function problemsWithin(problems: string[], budget: number): string {
  const frags = problems.map(short);
  // PROVISIONAL (P10b): not in the deck - Riku to approve (the problems line's `+N more`)
  const more = (dropped: number) => `+${dropped} more`;
  for (let keep = frags.length; keep >= 1; keep--) {
    const dropped = frags.length - keep;
    const kept = frags.slice(0, keep);
    const line = capitalise(end((dropped > 0 ? [...kept, more(dropped)] : kept).join("; ")));
    if (line.length <= budget) return line;
  }
  const dropped = frags.length - 1;
  const suffix = dropped > 0 ? `; ${more(dropped)}.` : ".";
  const room = Math.max(2, budget - suffix.length);
  const first = frags[0].length > room ? `${frags[0].slice(0, room - 1)}…` : frags[0];
  return capitalise(end(dropped > 0 ? `${first}; ${more(dropped)}` : first));
}

/**
 * How the app's OWN problem fragments begin — the lowercase ones this file
 * writes (here and in buildProblems). Only these are capitalised when they
 * lead the line. Everything else leads as written: a site's detail begins
 * with its configured name (`meowchi.dev returned HTTP 503`) and a watchdog
 * anomaly with an agent id (`dispatcher failed`), and upper-casing either
 * would misspell a name. A new fragment in this file belongs in this list.
 */
const OWN_FRAGMENTS = [
  "pipeline check ",
  "calendar check ",
  "to-do check ",
  "expiry sweep failed",
  "watchdog failed",
  "site health failed",
  "site reading could not",
  "outreach check failed",
] as const;

/**
 * The first letter up, for an own fragment only. Fragments are written
 * lowercase so they read right anywhere in the joined line; the rendered line
 * is a sentence, so deck §10's `Calendar check unavailable.` is what the
 * fragment `calendar check unavailable` renders as when it leads (R23).
 */
function capitalise(line: string): string {
  return OWN_FRAGMENTS.some((f) => line.startsWith(f))
    ? line.charAt(0).toUpperCase() + line.slice(1)
    : line;
}

export function composeDigest(input: DigestInput): Digest {
  // A pipeline check that could not run is itself a problem. Reporting it as
  // "All clear" would make a total ShikksTracker outage — the one dependency
  // every outreach feature rests on — read as reassurance, every morning, for
  // as long as it lasted. The route cannot count it either: it downgrades the
  // failed call to null rather than letting it fail the run, so this is the
  // only place the outage can still be named.
  //
  // The calendar and the to-do store are counted the same way (deck §10), and
  // a PARTIAL calendar read is counted too (R23), so the title never says all
  // clear over a blind spot. Every layer switched off is not counted: it is a
  // choice, not a fault (deck §15).
  const problems = [...input.problems];
  if (input.attention === null) problems.push("pipeline check unavailable");
  const { today } = input;
  if (today.events === "unavailable") {
    problems.push("calendar check unavailable");
  } else if (today.events !== "none-enabled" && today.missedLayers.length > 0) {
    // PROVISIONAL (P10b): not in the deck - Riku to approve
    problems.push("calendar check incomplete");
  }
  if (today.due === "unavailable") problems.push("to-do check unavailable");

  const problemCount = problems.length;
  const reviewPart = `${input.pending} to review`;

  const title =
    problemCount > 0
      ? `${problemCount} problem${problemCount === 1 ? "" : "s"} · ${reviewPart}`
      : `All clear · ${reviewPart}`;

  const after: string[] = [];
  if (input.attention !== null) {
    after.push(`${input.attention.repliedUnanswered} waiting on you, ${input.attention.overdue} overdue.`);
  }
  if (input.offAgents.length > 0) {
    after.push(`Off: ${input.offAgents.join(", ")}.`);
  }

  // Both lines ahead of the freelance line are budgeted, so the payload's
  // slice never cuts it (D12). One space separates each part. The problems
  // line may take everything except the parts after it and the Today
  // sentence's most compact form (budget 0 returns that form); the Today
  // sentence then gets whatever the problems line actually left.
  const afterLength = after.reduce((n, part) => n + 1 + part.length, 0);
  const problemsBudget = PUSH_BODY_MAX - afterLength - 1 - composeTodayLine(today, 0).length;
  const problemsLine = problemCount > 0 ? problemsWithin(problems, problemsBudget) : "All clear.";
  const others = [problemsLine, ...after];
  const budget = PUSH_BODY_MAX - (others.join(" ").length + others.length);
  const lines = [problemsLine, composeTodayLine(today, budget), ...after];

  return { title, body: lines.join(" ") };
}

// --- The Today sentence (deck §10, §15) --------------------------------------

/**
 * What the Today sentence is built from. Named apart from personalView.ts's
 * `TodayInput`, which is the page's and a different shape.
 *
 * `events` is `"none-enabled"` when every layer is switched off — a choice,
 * not a fault, so it is never counted as a problem (deck §15) — and
 * `"unavailable"` when no layer could be read. `missedLayers` names the layers
 * that did not answer when SOME did (R23's partial form), and is empty
 * otherwise. `overdue` is ignored when `due` is `"unavailable"`: both come
 * from one to-do read, and an omitted `Overdue:` must not read as "nothing
 * overdue" — `Due: to-dos unavailable.` covers it.
 *
 * `dueTotal` / `overdueTotal` are the STORE's counts, which the arrays may
 * fall short of (the read is bounded). `+N more` counts them, so it never
 * undercounts past the read's limit. Absent, the array length is the total.
 */
export interface DigestTodayInput {
  events: Array<{ title: string; time: string | null }> | "unavailable" | "none-enabled";
  missedLayers: string[];
  due: Array<{ title: string; dayLabel: string }> | "unavailable";
  overdue: Array<{ title: string; daysLate: number }>;
  dueTotal?: number;
  overdueTotal?: number;
}

/** Up to 3 names per part (deck §10). */
const TODAY_NAMES = 3;

/**
 * The title caps tried, longest first, when the sentence is over its budget.
 * A name's suffix — its time, its day, its lateness — is never cut; only the
 * title before it.
 */
const TITLE_CAPS = [60, 40, 24, 12] as const;

/** A title cut to `cap` characters, the cut marked with `…`. */
function capTitle(title: string, cap: number): string {
  return title.length > cap ? `${title.slice(0, cap - 1).trimEnd()}…` : title;
}

/**
 * `A, B, C, +2 more` — singular `+1 more`. `total` is the true count when the
 * names are a bounded read of something larger; never below `names.length`.
 * `limit` is how many names are shown before `+N more` takes the rest.
 */
function listPart(names: string[], total: number = names.length, limit: number = TODAY_NAMES): string {
  const shown = names.slice(0, limit);
  const rest = Math.max(total, names.length) - shown.length;
  // PROVISIONAL (P10b): not in the deck - Riku to approve (the comma before `+N more`)
  return rest > 0 ? [...shown, `+${rest} more`].join(", ") : shown.join(", ");
}

/** `Classes wasn't read.` · `Classes and Events weren't read.` */
function missedSentence(layers: string[]): string {
  if (layers.length === 1) return `${layers[0]} wasn't read.`;
  const shown = layers.slice(0, TODAY_NAMES);
  const rest = layers.length - shown.length;
  // PROVISIONAL (P10b): not in the deck - Riku to approve (the plural forms)
  const named =
    rest > 0
      ? `${shown.join(", ")} and ${rest} more`
      : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
  // PROVISIONAL (P10b): not in the deck - Riku to approve
  return `${named} weren't read.`;
}

/**
 * Pure. The push's Today sentence, in deck §10's and §15's forms:
 *
 *   Today: Math Methods 09:00, Meeting 13:00. Due: Pay tuition (today). Overdue: Send invoice (3d).
 *   Today: nothing scheduled, nothing due.           every part empty (D6)
 *   Today: calendar unavailable. Due: …              no layer answered
 *   Today: Math Methods 09:00. Classes wasn't read.  some answered (R23)
 *   Due: to-dos unavailable.                         the to-do read failed
 *   Today: no layers switched on.                    every layer off (deck §15)
 *
 * Absent parts are omitted; the quiet line is the one exception, so silence
 * and "couldn't read the calendar" never look the same (D6).
 *
 * `budget` is the most characters the sentence may take. Over it, the titles
 * are cut to each of TITLE_CAPS in turn, then names are moved into `+N more`
 * three, two, one, none per part — until it fits. A part's label, a name's
 * time/day/lateness, the partial-read clause and every failure sentence are
 * never cut (under pressure a missed layer's NAME is cut like a title, the
 * clause itself never). If even no names at all does not fit, that most
 * compact form is returned — `budget` 0 asks for it. composeDigest reserves
 * room for this form before it sizes the problems line, so inside a digest it
 * always fits and the payload's slice never cuts the freelance line.
 */
export function composeTodayLine(today: DigestTodayInput, budget: number = Infinity): string {
  const full = renderToday(today, Infinity, TODAY_NAMES);
  if (full.length <= budget) return full;
  let line = full;
  for (const cap of TITLE_CAPS) {
    line = renderToday(today, cap, TODAY_NAMES);
    if (line.length <= budget) return line;
  }
  const smallest = TITLE_CAPS[TITLE_CAPS.length - 1];
  for (let limit = TODAY_NAMES - 1; limit >= 0; limit--) {
    line = renderToday(today, smallest, limit);
    if (line.length <= budget) return line;
  }
  return line;
}

function renderToday(today: DigestTodayInput, cap: number, limit: number): string {
  const t = (title: string) => capTitle(title, cap);
  const parts: string[] = [];

  if (today.events === "none-enabled") {
    parts.push("Today: no layers switched on.");
  } else if (today.events === "unavailable") {
    parts.push("Today: calendar unavailable.");
  } else {
    const names = today.events.map((e) => `${t(e.title)} ${e.time ?? "(all day)"}`);
    const missed = today.missedLayers.length > 0 ? missedSentence(today.missedLayers.map(t)) : null;
    if (names.length > 0) {
      parts.push(`Today: ${listPart(names, names.length, limit)}.`);
      if (missed) parts.push(missed);
    } else if (missed) {
      // Nothing arrived from the layers that answered. Naming only the miss
      // makes no claim about the day: `nothing scheduled` here would be said
      // over a calendar that was not read.
      // PROVISIONAL (P10b): not in the deck - Riku to approve (the miss alone)
      parts.push(`Today: ${missed}`);
    }
  }

  if (today.due === "unavailable") {
    parts.push("Due: to-dos unavailable.");
  } else {
    if (today.due.length > 0) {
      parts.push(`Due: ${listPart(today.due.map((d) => `${t(d.title)} (${d.dayLabel})`), today.dueTotal, limit)}.`);
    }
    if (today.overdue.length > 0) {
      parts.push(
        `Overdue: ${listPart(today.overdue.map((o) => `${t(o.title)} (${o.daysLate}d)`), today.overdueTotal, limit)}.`
      );
    }
  }

  return parts.length > 0 ? parts.join(" ") : "Today: nothing scheduled, nothing due.";
}

/** `HH:MM` on a 24-hour clock, in `tz`. */
function clockTime(at: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("hour")}:${part("minute")}`;
}

/**
 * Pure. readCalendarWindow's answer for `today … today` as the sentence's
 * calendar half. Only events keyed to `today` count. A multi-day all-day
 * event is expanded by google.ts into one entry per day it covers (bd9459a),
 * so one that began earlier still has a `today` entry and is named; only a
 * TIMED event stays keyed to its start day, so a timed event that began
 * yesterday and runs into today is dropped — as the page drops it.
 *
 * A window that is `ok` but in which EVERY enabled layer failed (a token
 * failure of kind `http` is reported that way) is `"unavailable"`, not a
 * partial read: nothing arrived to be named.
 *
 * `window.failed` is calendarIds (google.ts). "Every enabled layer failed" is
 * decided by id against `layers`' enabled ids — never by name, since two
 * layers may share one — and the ids are joined to names only to fill
 * `missedLayers`, one name once. A failed id that joins to no enabled layer is
 * outside the window's contract and reads as `"unavailable"`: the push must
 * not call a morning clear over a read it cannot name.
 */
export function calendarForDigest(
  window: CalendarWindow,
  layers: readonly Layer[],
  today: DayKey,
  tz: string = APP_TZ
): Pick<DigestTodayInput, "events" | "missedLayers"> {
  if (!window.ok) {
    return {
      events: window.reason === "none-enabled" ? "none-enabled" : "unavailable",
      missedLayers: [],
    };
  }
  const failedIds = new Set(window.failed);
  const enabled = layers.filter((l) => l.enabled);
  const failedLayers = enabled.filter((l) => failedIds.has(l.calendarId));
  if (
    failedIds.size > 0 &&
    (failedLayers.length < failedIds.size || enabled.every((l) => failedIds.has(l.calendarId)))
  ) {
    return { events: "unavailable", missedLayers: [] };
  }
  const events = window.events
    .filter((e) => e.dayKey === today)
    .map((e) => ({
      title: e.title,
      time: e.allDay || e.startsAt === null ? null : clockTime(e.startsAt, tz),
    }));
  return { events, missedLayers: [...new Set(failedLayers.map((l) => l.name))] };
}

/** A to-do as the digest's read returns it; `dueOn` is the stored UTC-midnight day. */
export interface DigestTodoRow {
  title: string;
  dueOn: Date | null | undefined;
  createdAt: Date;
}

/**
 * Pure. Open to-dos as the sentence's `Due:` and `Overdue:` halves. Due is
 * today … today+3 inclusive (digestWindow's span), labelled `today` ·
 * `tomorrow` · `Fri`; overdue is anything before today, most overdue first,
 * labelled with whole days late. Undated rows and rows past the window are not
 * the digest's business and are dropped.
 *
 * `totals` is required: the rows are a bounded read, and only the store's own
 * counts (same filters) let `+N more` stay exact past the bound.
 */
export function todosForDigest(
  rows: readonly DigestTodoRow[],
  today: DayKey,
  totals: { due: number; overdue: number }
): {
  due: Array<{ title: string; dayLabel: string }>;
  overdue: Array<{ title: string; daysLate: number }>;
  dueTotal: number;
  overdueTotal: number;
} {
  const tomorrow = addDays(today, 1);
  const lastDay = addDays(today, 3);
  const keyed = sortTodos(
    rows.flatMap((r) => {
      const dueOn = todoDueKey(r.dueOn);
      return dueOn === null ? [] : [{ title: r.title, dueOn, createdAt: r.createdAt }];
    })
  );

  const due: Array<{ title: string; dayLabel: string }> = [];
  const overdue: Array<{ title: string; daysLate: number }> = [];
  for (const row of keyed) {
    if (row.dueOn < today) {
      overdue.push({ title: row.title, daysLate: daysLate(row.dueOn, today) });
    } else if (row.dueOn <= lastDay) {
      const dayLabel =
        row.dueOn === today
          ? "today"
          : row.dueOn === tomorrow
            ? "tomorrow"
            : formatDay(row.dueOn).split(" ")[0];
      due.push({ title: row.title, dayLabel });
    }
  }
  return {
    due,
    overdue,
    dueTotal: Math.max(totals.due, due.length),
    overdueTotal: Math.max(totals.overdue, overdue.length),
  };
}

/**
 * The job outcomes a morning run produces, as `runJob` reports them. Typed
 * against the real Anomaly/SiteResult so the "expiry-sweep" comparison below
 * is checked by the compiler — a renamed agent would otherwise disable the
 * de-duplication silently. `import type` keeps this module free of runtime
 * imports, so it stays pure.
 */
export interface MorningOutcomes {
  expiry: { ok: boolean; error?: string; unstuck: number };
  watchdog: { ok: boolean; error?: string; anomalies: Anomaly[] };
  /**
   * `snapshotStored` is false when the job ran but its reading could not be
   * stored — the write is caught and counted inside the job, never allowed to
   * fail it.
   */
  siteHealth: { ok: boolean; error?: string; sites: SiteResult[]; snapshotStored: boolean };
  outreachHealth: { ok: boolean; error?: string; findings: OutreachFinding[] };
}

/**
 * Pure. Turns one morning's job outcomes into the lines the digest reports.
 *
 * This lives here rather than in the route because it is the only branching
 * logic in the phase that decides what Riku is actually TOLD — inverting one
 * condition would report every healthy site as down, and a route is not
 * testable (CLAUDE.md: handlers stay thin, the logic layer holds behaviour).
 *
 * A job that failed in THIS run — or that ran but could not store its write —
 * is reported from its in-memory outcome, not from the watchdog: the watchdog
 * reads run records, so it would otherwise only notice tomorrow. That is why
 * site-health carries snapshotStored beside ok: the job itself did not fail,
 * so the watchdog only ever sees the failed write tomorrow, in the run record,
 * as a red `1 item failed` — and only this file can name it on the morning it
 * happened (R58).
 *
 * The expiry sweep is the one job that both runs before the watchdog and
 * writes its record first, so the watchdog re-reads the row that was just
 * written — hence the filter, without which a single failed sweep is counted
 * as two problems and the title's count is wrong.
 *
 * That filter is deliberately as narrow as the duplicate it removes: only a
 * `failed` anomaly, and only when the sweep really did fail here. A `stale` or
 * `degraded` expiry-sweep anomaly still gets through, so a broader skip cannot
 * quietly punch a hole in the monitor.
 */
export function buildProblems(outcomes: MorningOutcomes): string[] {
  const { expiry, watchdog, siteHealth, outreachHealth } = outcomes;
  const problems: string[] = [];

  if (!expiry.ok) problems.push(`expiry sweep failed: ${expiry.error ?? "unknown"}`);
  if (!watchdog.ok) problems.push(`watchdog failed: ${watchdog.error ?? "unknown"}`);
  if (!siteHealth.ok) problems.push(`site health failed: ${siteHealth.error ?? "unknown"}`);
  // Named on its own morning: the watchdog reads yesterday's record and would
  // only notice tomorrow, and itemsFailed on the run is the rail's generic
  // vocabulary (R58).
  if (siteHealth.ok && !siteHealth.snapshotStored) {
    problems.push("site reading could not be stored");
  }
  // Distinct wording from composeDigest's "pipeline check unavailable", which
  // means the /attention call failed. Both can be true at once — one API, two
  // endpoints — and two identical lines would read as one duplicated bug.
  if (!outreachHealth.ok) {
    problems.push(`outreach check failed: ${outreachHealth.error ?? "unknown"}`);
  }

  if (expiry.unstuck > 0) {
    problems.push(
      `${expiry.unstuck} approved item${expiry.unstuck === 1 ? "" : "s"} could not confirm their result`
    );
  }

  for (const anomaly of watchdog.anomalies) {
    const alreadyReported = !expiry.ok && anomaly.agent === "expiry-sweep" && anomaly.kind === "failed";
    if (alreadyReported) continue;
    problems.push(anomaly.detail);
  }
  for (const site of siteHealth.sites) {
    if (!site.up) problems.push(site.detail);
  }
  for (const finding of outreachHealth.findings) {
    problems.push(finding.detail);
  }

  return problems;
}
