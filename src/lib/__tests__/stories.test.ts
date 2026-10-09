import { describe, it, expect } from "vitest";
import { groupProblems } from "@/lib/stories";
import type { Problem } from "@/lib/problems";
import { BRIEFING_BOUNDS, PROBLEM_KEYS } from "@/lib/briefingTypes";

const texts = (problems: Problem[]) => groupProblems(problems).map((s) => s.sentence.text);

describe("groupProblems", () => {
  it("makes one story per unrelated problem, in order", () => {
    expect(
      texts([
        { key: "site-status", site: "Meowchi", status: 503 },
        { key: "agent-failed", agent: "chaser" },
      ]),
    ).toEqual(["Meowchi's site isn't answering (error 503).", "The chaser failed on its last run."]);
  });

  it("tells ShikksTracker being down as one story", () => {
    const stories = groupProblems([
      { key: "site-unreachable", site: "ShikksTracker" },
      { key: "pipeline-unavailable", raw: "fetch failed" },
      { key: "engine-stale", ageMs: 50 * 3600_000 },
      { key: "stranded-approved", count: 4 },
    ]);
    expect(stories).toHaveLength(1);
    expect(stories[0].sentence.text).toBe(
      "ShikksTracker looks down, which is why I couldn't check freelance and why its sender hasn't run. Four approved messages are stuck.",
    );
    expect(stories[0].symptoms.map((p) => p.key)).toEqual([
      "site-unreachable",
      "pipeline-unavailable",
      "engine-stale",
      "stranded-approved",
    ]);
  });

  it("does not claim ShikksTracker is down from the pipeline alone", () => {
    expect(groupProblems([{ key: "pipeline-unavailable", raw: null }])).toHaveLength(1);
    expect(texts([{ key: "pipeline-unavailable", raw: null }])[0]).toMatch(/^I couldn't reach ShikksTracker/);
  });

  it("ties a stalled sender to its stuck messages", () => {
    expect(
      texts([
        { key: "engine-stale", ageMs: 50 * 3600_000 },
        { key: "stranded-approved", count: 4 },
      ]),
    ).toEqual(["ShikksTracker's sender hasn't run in 2 days, so four approved messages are stuck."]);
  });

  it("names the database as the thread behind failed checks and unread to-dos", () => {
    const stories = groupProblems([
      { key: "job-failed", job: "watchdog", raw: "MongoNetworkError: closed" },
      { key: "job-failed", job: "site-health", raw: "MongoNetworkError: closed" },
      { key: "todos-unavailable" },
    ]);
    expect(stories).toHaveLength(1);
    expect(stories[0].sentence.text).toBe(
      "The database didn't answer this morning. That looks like what's behind the failed checks and why I couldn't read your to-dos.",
    );
  });

  it("groups failures that share a recognised cause", () => {
    expect(
      texts([
        { key: "job-failed", job: "watchdog", raw: "connect ETIMEDOUT" },
        { key: "job-failed", job: "site-health", raw: "aborted" },
        { key: "pipeline-unavailable", raw: "timed out" },
      ]),
    ).toEqual(["Three checks failed, and they all point to something being too slow to answer."]);
  });

  it("never groups unrecognised errors by cause", () => {
    expect(
      groupProblems([
        { key: "job-failed", job: "watchdog", raw: "weird one" },
        { key: "pipeline-unavailable", raw: "weird two" },
      ]),
    ).toHaveLength(2);
  });

  it("says several down sites once", () => {
    expect(
      texts([
        { key: "site-status", site: "Meowchi", status: 503 },
        { key: "site-timeout", site: "AzeroTech" },
      ]),
    ).toEqual(["Meowchi and AzeroTech are both down (error 503, timed out)."]);
    expect(
      texts([
        { key: "site-status", site: "A", status: 503 },
        { key: "site-unreachable", site: "B" },
        { key: "site-timeout", site: "C" },
      ]),
    ).toEqual(["A, B and C are all down (error 503, unreachable, timed out)."]);
  });

  it("says several failed agents once", () => {
    expect(
      texts([
        { key: "agent-failed", agent: "chaser" },
        { key: "agent-failed", agent: "site-health" },
      ]),
    ).toEqual(["The chaser and the site check both failed on their last run."]);
  });

  it("bolds the subjects of a grouped story", () => {
    const [story] = groupProblems([
      { key: "site-status", site: "Meowchi", status: 503 },
      { key: "site-timeout", site: "AzeroTech" },
    ]);
    expect(story.sentence.bold.map((r) => story.sentence.text.slice(r.start, r.end))).toEqual(["Meowchi", "AzeroTech"]);
  });

  it("keeps every symptom exactly once across all stories", () => {
    const input: Problem[] = [
      { key: "site-unreachable", site: "ShikksTracker" },
      { key: "pipeline-unavailable", raw: null },
      { key: "site-status", site: "Meowchi", status: 503 },
      { key: "agent-failed", agent: "chaser" },
      { key: "todos-unavailable" },
    ];
    const out = groupProblems(input).flatMap((s) => s.symptoms);
    expect(out).toHaveLength(input.length);
    for (const p of input) expect(out).toContain(p);
  });

  // --- Added by the Story Teller (A5), beyond the plan's given tests. ---

  it("keeps every symptom exactly once, one of every known key", () => {
    // Property-style check across the whole PROBLEM_KEYS closed set: no
    // symptom is ever dropped or duplicated, whatever rule claims it.
    const input: Problem[] = [
      { key: "site-status", site: "A", status: 503 },
      { key: "site-timeout", site: "B" },
      { key: "site-unreachable", site: "C" },
      { key: "agent-never-ran", agent: "chaser" },
      { key: "agent-stale", agent: "watchdog", ageHours: 40 },
      { key: "agent-failed", agent: "triage" },
      { key: "agent-degraded", agent: "dispatcher", itemsFailed: 2 },
      { key: "job-failed", job: "retro", raw: "weird error" },
      { key: "snapshot-unsaved" },
      { key: "unstuck-items", count: 3 },
      { key: "engine-never-ran" },
      { key: "engine-unreadable" },
      { key: "engine-stale", ageMs: 10 * 3600_000 },
      { key: "engine-errors", count: 2 },
      { key: "stranded-approved", count: 1 },
      { key: "pipeline-unavailable", raw: "oops" },
      { key: "calendar-unavailable", cause: "expired" },
      { key: "calendar-partial", calendars: ["Work"] },
      { key: "todos-unavailable" },
    ];
    // Sanity: this covers every key the closed set defines, not a subset.
    expect(input.map((p) => p.key).sort()).toEqual([...PROBLEM_KEYS].sort());

    const out = groupProblems(input).flatMap((s) => s.symptoms);
    expect(out).toHaveLength(input.length);
    for (const p of input) expect(out).toContain(p);
    // Every input problem lands in exactly one story.
    for (const p of input) expect(out.filter((q) => q === p)).toHaveLength(1);
  });

  it("does not self-clip a worst-case chain — bounds are buildBriefing's job (A6)", () => {
    // Five sites down at once is the realistic worst case for "same kind"
    // grouping: Rule 3 takes them all into ONE story, so its bold list grows
    // one range per site. groupProblems does not cap this itself (see the
    // BOUNDS SEAM note atop stories.ts) — digest.ts's buildBriefing clips the
    // stored sentence to BRIEFING_BOUNDS.storySentence and keeps only the
    // first BRIEFING_BOUNDS.bold ranges. This test pins the current,
    // uncapped shape so a future change to groupProblems can't silently grow
    // past what buildBriefing expects to truncate.
    const input: Problem[] = [
      { key: "site-status", site: "Meowchi", status: 503 },
      { key: "site-timeout", site: "AzeroTech" },
      { key: "site-unreachable", site: "ThirdSite" },
      { key: "site-status", site: "FourthSite", status: 500 },
      { key: "site-timeout", site: "FifthSite" },
    ];
    const [story] = groupProblems(input);
    expect(story.symptoms).toHaveLength(5);
    expect(story.sentence.bold).toHaveLength(5);
    expect(story.sentence.bold.length).toBeGreaterThan(BRIEFING_BOUNDS.bold);
    expect(story.sentence.text.length).toBeLessThanOrEqual(BRIEFING_BOUNDS.storySentence);
  });
});
