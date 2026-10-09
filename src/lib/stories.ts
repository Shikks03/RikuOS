/**
 * stories.ts — problems that happen together, told as one story (S21, spec §4.4).
 *
 * A story is one thing that went wrong, however many places it shows up. The
 * push's title counts stories (Riku confirmed 2026-10-09); the Briefing lists
 * every symptom under its story.
 *
 * Links are drawn ONLY from the fixed chains below or from matching causes.
 * Two problems that merely happen on the same morning are never claimed as
 * connected, and links say "looks like" / "point to", never "caused by".
 *
 * Order of rules: known chains, then same cause, then same kind; whatever is
 * left is a one-problem story. Each problem joins at most one story.
 *
 * BOUNDS SEAM: a story's sentence can, in principle, run past
 * BRIEFING_BOUNDS.storySentence (240) or carry more bold ranges than
 * BRIEFING_BOUNDS.bold (4) — a same-kind group grows one bold range per
 * member, and there is no fixed ceiling on how many problems can share a
 * kind. groupProblems does NOT clip here: digest.ts's buildBriefing (A6) is
 * the one place that owns BRIEFING_BOUNDS for the stored Briefing
 * (boundText/boundBold truncate text and drop later bold ranges), and the
 * push body is separately budgeted by composeDigest. Clipping twice would
 * risk disagreeing about where a sentence breaks. (The realistic worst case
 * — this app watches 3 sites, siteHealth.ts's SITES — is covered by
 * digest.test.ts's five-agents test, which exercises buildBriefing's own
 * cap; stories.test.ts checks only that every bold range groupProblems
 * produces is itself valid.)
 */

import { explain, explainCause } from "@/lib/causes";
import { AGENT_NAMES, type Problem } from "@/lib/problems";
import type { CauseKey } from "@/lib/briefingTypes";
import type { Agent } from "@/models/AgentRun";
import { b, capFirst, capWord, numberWord, say, type Said, type Seg } from "@/lib/voice";

export interface Story {
  sentence: Said;
  symptoms: Problem[];
}

const SITE_KEYS = new Set<Problem["key"]>(["site-status", "site-timeout", "site-unreachable"]);

function siteNote(p: Problem): string {
  if (p.key === "site-status") return `error ${p.status}`;
  if (p.key === "site-timeout") return "timed out";
  return "unreachable";
}

function siteName(p: Problem): string {
  return "site" in p ? p.site : "";
}

/** "A", "A and B", "A, B and C" as bold segments. */
function boldList(names: string[]): Seg[] {
  const segs: Seg[] = [];
  names.forEach((n, i) => {
    if (i > 0) segs.push(i === names.length - 1 ? " and " : ", ");
    segs.push(b(n));
  });
  return segs;
}

const CAUSE_THREAD: Partial<Record<CauseKey, string>> = {
  timeout: "something being too slow to answer",
  network: "the network",
  database: "the database",
  auth: "an expired key",
  forbidden: "a permission change",
  "rate-limit": "a rate limit",
  upstream: "the other service",
};

function causeOf(p: Problem): CauseKey | null {
  if (p.key === "job-failed" || p.key === "pipeline-unavailable") return explainCause(p.raw).causeKey;
  return null;
}

/** A real outage, not merely an unfriendly status (401/403/404 aren't down). */
function isRealOutage(p: Problem): boolean {
  if (p.key === "site-unreachable" || p.key === "site-timeout") return true;
  if (p.key === "site-status") return p.status >= 500;
  return false;
}

/** The agent a same-key group's problem names — `job` for job-failed, `agent` otherwise. */
function agentOf(p: Problem): Agent {
  if (p.key === "job-failed") return p.job;
  if ("agent" in p) return p.agent;
  throw new Error(`agentOf: ${p.key} names no agent`);
}

export function groupProblems(problems: Problem[]): Story[] {
  const left = [...problems];
  const stories: Story[] = [];
  const take = (pred: (p: Problem) => boolean): Problem[] => {
    const hit = left.filter(pred);
    for (const p of hit) left.splice(left.indexOf(p), 1);
    return hit;
  };

  // --- Chain 1: ShikksTracker looks down (needs BOTH its site and the pipeline,
  // and the site problem must be a real outage — 401/403/404 are not a site
  // being down, so they must not chain).
  const stSite = left.find((p) => isRealOutage(p) && siteName(p) === "ShikksTracker");
  const pipeline = left.find((p) => p.key === "pipeline-unavailable");
  if (stSite && pipeline) {
    const symptoms = take(
      (p) =>
        p === stSite ||
        p === pipeline ||
        p.key === "engine-stale" ||
        p.key === "engine-never-ran" ||
        p.key === "stranded-approved" ||
        (p.key === "job-failed" && p.job === "outreach-health"),
    );
    const sender = symptoms.some((p) => p.key === "engine-stale" || p.key === "engine-never-ran");
    const stranded = symptoms.find((p) => p.key === "stranded-approved");
    const segs: Seg[] = [b("ShikksTracker looks down"), ", which is why I couldn't check freelance"];
    if (sender) segs.push(" and why its sender hasn't run");
    segs.push(".");
    if (stranded && stranded.key === "stranded-approved") {
      const one = stranded.count === 1;
      segs.push(" ", b(`${capWord(numberWord(stranded.count))} approved ${one ? "message" : "messages"}`), ` ${one ? "is" : "are"} stuck.`);
    }
    stories.push({ sentence: say(...segs), symptoms });
  }

  // --- Chain 2: a stalled sender and the messages it stranded. A malformed
  // run-time report (engine-unreadable) joins too, but it isn't SHOWN to be
  // the cause of the stranded messages, so it joins with "and", not "so".
  const engine = left.find((p) => p.key === "engine-stale" || p.key === "engine-never-ran" || p.key === "engine-unreadable");
  const stranded = left.find((p) => p.key === "stranded-approved");
  if (engine && stranded && stranded.key === "stranded-approved") {
    take((p) => p === engine || p === stranded);
    const head = explain(engine).sentence.text.replace(/\.$/, "");
    const one = stranded.count === 1;
    const joiner = engine.key === "engine-unreadable" ? "and" : "so";
    stories.push({
      sentence: say(
        b("ShikksTracker's sender"),
        head.slice("ShikksTracker's sender".length),
        `, ${joiner} ${numberWord(stranded.count)} approved ${one ? "message is" : "messages are"} stuck.`,
      ),
      symptoms: [engine, stranded],
    });
  }

  // --- Chain 3: the database behind failed checks / unread to-dos / unsaved
  // reading. Only job-failed problems count as "database failed" here —
  // pipeline-unavailable is ShikksTracker's OWN database, a different thing,
  // and must never be pulled into this chain even when its causeKey matches.
  const dbFails: Problem[] = left.filter((p) => p.key === "job-failed" && causeOf(p) === "database");
  const dbSide: Problem[] = left.filter((p) => p.key === "todos-unavailable" || p.key === "snapshot-unsaved");
  if (dbFails.length >= 1 && dbFails.length + dbSide.length >= 2) {
    const symptoms = take((p) => dbFails.includes(p) || dbSide.includes(p));
    const behind: string[] = [];
    if (dbFails.length > 0) behind.push(dbFails.length === 1 ? "the failed check" : "the failed checks");
    if (dbSide.some((p) => p.key === "snapshot-unsaved")) behind.push("why the site reading wasn't saved");
    if (dbSide.some((p) => p.key === "todos-unavailable")) behind.push("why I couldn't read your to-dos");
    const tail = behind.length === 1 ? behind[0] : `${behind.slice(0, -1).join(", ")} and ${behind[behind.length - 1]}`;
    stories.push({
      sentence: say(b("The database didn't answer"), ` this morning. That looks like what's behind ${tail}.`),
      symptoms,
    });
  }

  // --- Rule 2: same recognised cause across two or more failures.
  const byCause = new Map<CauseKey, Problem[]>();
  for (const p of left) {
    const c = causeOf(p);
    if (c === null || c === "unrecognised" || c === "none" || !(c in CAUSE_THREAD)) continue;
    byCause.set(c, [...(byCause.get(c) ?? []), p]);
  }
  for (const [cause, group] of byCause) {
    if (group.length < 2) continue;
    take((p) => group.includes(p));
    const verb = group.length === 2 ? "both" : "all";
    stories.push({
      sentence: say(`${capWord(numberWord(group.length))} checks failed, and they ${verb} point to `, b(CAUSE_THREAD[cause]!), "."),
      symptoms: group,
    });
  }

  // --- Rule 3: same kind.
  const sites = left.filter((p) => SITE_KEYS.has(p.key));
  if (sites.length >= 2) {
    take((p) => sites.includes(p));
    const both = sites.length === 2 ? "both" : "all";
    stories.push({
      sentence: say(...boldList(sites.map(siteName)), ` are ${both} down (${sites.map(siteNote).join(", ")}).`),
      symptoms: sites,
    });
  }
  for (const key of ["agent-failed", "agent-never-ran", "agent-stale", "agent-degraded", "job-failed"] as const) {
    const group = left.filter((p) => p.key === key);
    if (group.length < 2) continue;
    take((p) => group.includes(p));
    const names = group.map((p) => AGENT_NAMES[agentOf(p)]);
    const both = group.length === 2 ? "both" : "all";
    const tail =
      key === "agent-failed"
        ? ` ${both} failed on their last run.`
        : key === "agent-never-ran"
          ? ` have ${both} never run.`
          : key === "agent-stale"
            ? ` are ${both} overdue.`
            : key === "agent-degraded"
              ? ` ${both} had items that didn't go through on their last runs.`
              : ` ${both} broke this morning.`;
    stories.push({ sentence: capFirst(say(...boldList(names), tail)), symptoms: group });
  }

  // --- Whatever is left: one story each, in the order they came.
  for (const p of [...left]) stories.push({ sentence: explain(p).sentence, symptoms: [p] });

  // Keep the report order: a story sits where its first symptom was.
  const firstIndex = (s: Story) => Math.min(...s.symptoms.map((p) => problems.indexOf(p)));
  return stories.sort((a, z) => firstIndex(a) - firstIndex(z));
}
