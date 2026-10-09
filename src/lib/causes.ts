/**
 * causes.ts — the fixed catalogue (S21, spec §4.2–§4.5): for every problem,
 * its plain sentence (push-form), the next step, and the likely cause.
 *
 * No AI. Causes from pattern-matching a raw error are worded "Most likely …";
 * a cause the app KNOWS (an expired Google token) is stated plainly; a raw
 * error no rule matches says so honestly and is counted (`unrecognised`).
 *
 * THE SEAM (spec §4.5): explainCause() is the one function that turns a raw
 * error into a cause. A later ask-Claude fallback for unrecognised errors
 * goes behind it and nothing else changes.
 *
 * A raw error travels only in Explained.raw — never interpolated into
 * sentence, nextStep or cause text (feature review, A-II). Every row() below
 * also clips its sentence/cause to BRIEFING_BOUNDS before returning: most
 * rows are fixed prose and never come close, but site/calendar names are
 * caller-supplied and, at their schema's own maxlength (60 for a site name,
 * HealthSnapshot.ts; 120 for a calendar layer name, OsSettings.ts), a
 * calendar-partial sentence can run past BRIEFING_BOUNDS.symptomSentence.
 * Clipping here means the catalogue can never hand `StoredSymptom` a string
 * its schema's maxlength will reject.
 */

import { BRIEFING_BOUNDS, type CauseKey } from "@/lib/briefingTypes";
import { AGENT_NAMES, type Problem } from "@/lib/problems";
import { b, capFirst, capWord, numberWord, say, type Said } from "@/lib/voice";

export interface Explained {
  sentence: Said;
  nextStep: string;
  causeKey: CauseKey;
  cause: Said;
  raw: string | null;
}

interface RawRule {
  test: RegExp;
  causeKey: Exclude<CauseKey, "known" | "fixed" | "none" | "unrecognised">;
  cause: Said;
}

/** Spec §4.3, in order. First match wins; numbers match as whole tokens only. */
const RAW_RULES: readonly RawRule[] = [
  {
    test: /ETIMEDOUT|timed out|timeout|aborted/i,
    causeKey: "timeout",
    cause: say("Most likely ", b("it took too long"), ": the service or network was slow. Usually clears by itself."),
  },
  {
    test: /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET/,
    causeKey: "network",
    cause: say("Most likely ", b("I couldn't find or connect to the server"), ": network or DNS trouble, or the service is down."),
  },
  {
    test: /MongoServerSelectionError|MongoNetworkError|MongooseServerSelectionError/,
    causeKey: "database",
    cause: say("Most likely ", b("the database didn't answer"), ": an Atlas blip or the connection limit."),
  },
  {
    test: /invalid_grant|\b401\b|expired/i,
    causeKey: "auth",
    cause: say("Most likely ", b("a key or token stopped working"), ". It needs renewing."),
  },
  {
    test: /\b403\b/,
    causeKey: "forbidden",
    cause: say("Most likely ", b("access was refused"), ": a permission changed."),
  },
  {
    test: /\b429\b/,
    causeKey: "rate-limit",
    cause: say("Most likely ", b("too many requests"), ". A rate limit that waits itself out."),
  },
  {
    test: /\b5\d\d\b/,
    causeKey: "upstream",
    cause: say("Most likely ", b("the other service had an error on its end"), "."),
  },
];

const UNRECOGNISED: Said = say(b("I don't recognise this one."), " The raw error is below.");
const NO_RAW: Said = say(b("I can see it failed, but not why."), " Its run record holds the error.");

/** A raw error's cause, by the rules above. */
export function matchRaw(raw: string): { causeKey: CauseKey; cause: Said } {
  for (const rule of RAW_RULES) {
    if (rule.test.test(raw)) return { causeKey: rule.causeKey, cause: rule.cause };
  }
  return { causeKey: "unrecognised", cause: UNRECOGNISED };
}

/** THE SEAM. Today: the rules, or the honest no-raw line. */
export function explainCause(raw: string | null): { causeKey: CauseKey; cause: Said } {
  if (raw === null) return { causeKey: "none", cause: NO_RAW };
  return matchRaw(raw);
}

function hoursOrDays(hours: number): string {
  return hours < 48 ? `${hours} hours` : `${Math.floor(hours / 24)} days`;
}

function fixed(cause: Said): { causeKey: CauseKey; cause: Said } {
  return { causeKey: "fixed", cause };
}

function calendarList(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Clips a Said to `max` characters, clamping any bold range that overruns it. */
function clipSaid(s: Said, max: number): Said {
  if (s.text.length <= max) return s;
  const text = s.text.slice(0, max);
  const bold = s.bold.filter((r) => r.start < max).map((r) => ({ start: r.start, end: Math.min(r.end, max) }));
  return { text, bold };
}

/** One problem, fully explained. Every string is push-form. */
export function explain(p: Problem): Explained {
  const row = (sentence: Said, nextStep: string, c: { causeKey: CauseKey; cause: Said }, raw: string | null = null): Explained => ({
    sentence: clipSaid(sentence, BRIEFING_BOUNDS.symptomSentence),
    nextStep: nextStep.length > BRIEFING_BOUNDS.nextStep ? nextStep.slice(0, BRIEFING_BOUNDS.nextStep) : nextStep,
    causeKey: c.causeKey,
    cause: clipSaid(c.cause, BRIEFING_BOUNDS.cause),
    raw,
  });

  switch (p.key) {
    case "site-status": {
      const s = p.status;
      const cause =
        s >= 500
          ? say("Most likely ", b("the site's server is crashing or mid-deploy"), ".")
          : s === 404
            ? say("Most likely ", b("the page or deployment was removed"), ".")
            : s === 401 || s === 403
              ? say("Most likely ", b("the site is asking for a login"), ".")
              : say("Most likely ", b("the site refused the request"), ".");
      return row(
        say(b(`${p.site}'s site`), ` isn't answering (error ${s}).`),
        "Open the site, then check its latest deploy on Vercel.",
        fixed(cause),
      );
    }
    case "site-timeout":
      return row(
        say(b(`${p.site}'s site`), " took too long to answer."),
        "Open it and see if it loads.",
        fixed(say("Most likely ", b("a slow or overloaded server"), ", or a cold start past 8 seconds. Often clears on its own.")),
      );
    case "site-unreachable":
      return row(
        say(b(`${p.site}'s site`), " can't be reached at all."),
        "Check the domain and the Vercel project still exist.",
        fixed(say("Most likely ", b("the address doesn't resolve or refused the connection"), ": a removed project or a network fault.")),
      );
    case "agent-never-ran":
      return row(
        capFirst(say(b(AGENT_NAMES[p.agent]), " has never run.")),
        "Check the cron is in vercel.json and deployed.",
        fixed(say(b("It was never scheduled."), " Usually a new job missing from the deployed cron list.")),
      );
    case "agent-stale":
      return row(
        capFirst(say(b(AGENT_NAMES[p.agent]), ` hasn't run in ${hoursOrDays(p.ageHours)}.`)),
        "Vercel → Crons: look for missed runs.",
        fixed(say("Most likely ", b("Vercel didn't trigger it"), ": a paused project, a failed deploy, or a cron limit.")),
      );
    case "agent-failed":
      return row(
        capFirst(say(b(AGENT_NAMES[p.agent]), " failed on its last run.")),
        "Look at its last run's error.",
        explainCause(null),
      );
    case "agent-degraded": {
      const n = p.itemsFailed;
      return row(
        capFirst(say(b(`${AGENT_NAMES[p.agent]}'s last run`), ` had ${numberWord(n)} ${n === 1 ? "item" : "items"} that didn't go through.`)),
        "Look at that run's failed items.",
        fixed(say("Most likely ", b("some items were rejected"), " while the rest went through, usually bad data on those items.")),
      );
    }
    case "job-failed":
      return row(
        capFirst(say(b(AGENT_NAMES[p.job]), " broke this morning.")),
        "Look at its last run's error.",
        explainCause(p.raw),
        p.raw,
      );
    case "snapshot-unsaved":
      return row(
        say("I checked the sites but ", b("couldn't save the result"), "."),
        "Nothing needed if it's gone tomorrow.",
        fixed(say(b("The database write failed"), " after the check succeeded.")),
      );
    case "unstuck-items": {
      const one = p.count === 1;
      return row(
        say(b(`${capWord(numberWord(p.count))} approved ${one ? "item" : "items"}`), ` couldn't confirm ${one ? "it" : "they"} went through.`),
        "Check those leads in ShikksTracker before resending.",
        fixed(say(b("It's unknown whether they were sent"), ", so they're parked for you and never resent automatically.")),
      );
    }
    case "engine-never-ran":
      return row(
        say(b("ShikksTracker's sender"), " has never reported a run."),
        "Check its pinger and crons.",
        fixed(say(b("It has never been triggered"), ", or it doesn't record its runs.")),
      );
    case "engine-unreadable":
      return row(
        say(b("ShikksTracker's sender"), " reported a run time I can't read."),
        "Check its last run record.",
        fixed(say(b("Its run record is malformed."), " That's a ShikksTracker bug to note there.")),
      );
    case "engine-stale":
      return row(
        say(b("ShikksTracker's sender"), ` hasn't run in ${hoursOrDays(Math.floor(p.ageMs / 3_600_000))}.`),
        "Check ShikksTracker's pinger and crons.",
        fixed(say("Most likely ", b("its hourly trigger stopped"), ". It only runs when pinged.")),
      );
    case "engine-errors":
      return row(
        say(b("ShikksTracker's sender"), ` hit ${numberWord(p.count)} ${p.count === 1 ? "error" : "errors"} on its last run.`),
        "Check its last run in ShikksTracker.",
        fixed(say("Most likely ", b("some sends were refused"), ": a bad address or a mail-provider limit.")),
      );
    case "stranded-approved": {
      const one = p.count === 1;
      return row(
        say(b(`${capWord(numberWord(p.count))} approved ${one ? "message" : "messages"}`), ` ${one ? "is" : "are"} stuck, unsent.`),
        "Fix the sender first. They go once it runs.",
        fixed(say(b("The sender is down"), ", so nothing approved can leave.")),
      );
    }
    case "pipeline-unavailable":
      return row(
        say(b("I couldn't reach ShikksTracker"), ", so I don't know how freelance is going."),
        "Open ShikksTracker and check it's up.",
        explainCause(p.raw),
        p.raw,
      );
    case "calendar-unavailable": {
      const known: Record<Exclude<typeof p.cause, "read-failed">, Said> = {
        "not-configured": say(b("Google isn't connected.")),
        expired: say(b("Google access has expired.")),
        timeout: say(b("Google didn't answer in time.")),
      };
      return row(
        say(b("I couldn't read your calendar"), "."),
        "Settings → Google Calendar.",
        p.cause === "read-failed" ? explainCause(null) : { causeKey: "known", cause: known[p.cause] },
      );
    }
    case "calendar-partial": {
      const many = p.calendars.length > 1;
      return row(
        say(b(`I couldn't read your ${calendarList(p.calendars)} ${many ? "calendars" : "calendar"}`), ", so today might be missing something."),
        many ? "Check those calendars still exist in Google." : "Check that calendar still exists in Google.",
        fixed(say("Most likely ", b(many ? "those calendars refused or were removed" : "that one calendar refused or was removed"), ", while the others answered.")),
      );
    }
    case "todos-unavailable":
      return row(
        say(b("I couldn't read your to-dos"), "."),
        "Reload the Personal page.",
        fixed(say("Most likely ", b("the database didn't answer"), ".")),
      );
  }
}
