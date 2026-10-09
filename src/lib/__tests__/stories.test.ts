import { describe, it, expect } from "vitest";
import { groupProblems } from "@/lib/stories";
import type { Problem } from "@/lib/problems";
import { PROBLEM_KEYS } from "@/lib/briefingTypes";

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

  it("chains ShikksTracker down with the pipeline even with no sender problem", () => {
    const stories = groupProblems([
      { key: "site-unreachable", site: "ShikksTracker" },
      { key: "pipeline-unavailable", raw: "fetch failed" },
    ]);
    expect(stories).toHaveLength(1);
    expect(stories[0].symptoms.map((p) => p.key)).toEqual(["site-unreachable", "pipeline-unavailable"]);
  });

  it("includes a failed outreach-health check in the ShikksTracker-down story", () => {
    const stories = groupProblems([
      { key: "site-unreachable", site: "ShikksTracker" },
      { key: "pipeline-unavailable", raw: "fetch failed" },
      { key: "job-failed", job: "outreach-health", raw: "ST down" },
    ]);
    expect(stories).toHaveLength(1);
    expect(stories[0].symptoms.map((p) => p.key)).toEqual([
      "site-unreachable",
      "pipeline-unavailable",
      "job-failed",
    ]);
  });

  it("does not chain a ShikksTracker 401/403/404 with the pipeline — that's not an outage", () => {
    for (const status of [401, 403, 404]) {
      const stories = groupProblems([
        { key: "site-status", site: "ShikksTracker", status },
        { key: "pipeline-unavailable", raw: "answered " + status },
      ]);
      expect(stories).toHaveLength(2);
    }
  });

  it("does not chain a different site's outage with the pipeline being unavailable", () => {
    const stories = groupProblems([
      { key: "site-unreachable", site: "Meowchi" },
      { key: "pipeline-unavailable", raw: "fetch failed" },
    ]);
    expect(stories).toHaveLength(2);
  });

  it("still chains a real ShikksTracker outage (site-status >= 500) with the pipeline", () => {
    const stories = groupProblems([
      { key: "site-status", site: "ShikksTracker", status: 503 },
      { key: "pipeline-unavailable", raw: "ShikksTracker answered HTTP 503" },
    ]);
    expect(stories).toHaveLength(1);
  });

  it("ties a stalled sender to its stuck messages", () => {
    expect(
      texts([
        { key: "engine-stale", ageMs: 50 * 3600_000 },
        { key: "stranded-approved", count: 4 },
      ]),
    ).toEqual(["ShikksTracker's sender hasn't run in 2 days, so four approved messages are stuck."]);
  });

  it("ties a stalled sender to its stuck messages when the sender has never run", () => {
    expect(
      texts([
        { key: "engine-never-ran" },
        { key: "stranded-approved", count: 4 },
      ]),
    ).toEqual(["ShikksTracker's sender has never reported a run, so four approved messages are stuck."]);
  });

  it("joins an unreadable run report to its stuck messages with 'and', not 'so' (not shown to be the cause)", () => {
    const stories = groupProblems([
      { key: "engine-unreadable" },
      { key: "stranded-approved", count: 4 },
    ]);
    expect(stories).toHaveLength(1);
    expect(stories[0].sentence.text).toBe(
      "ShikksTracker's sender reported a run time I can't read, and four approved messages are stuck.",
    );
    expect(stories[0].symptoms.map((p) => p.key)).toEqual(["engine-unreadable", "stranded-approved"]);
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

  it("names the database as the thread behind a failed check and an unsaved site reading", () => {
    const stories = groupProblems([
      { key: "job-failed", job: "watchdog", raw: "MongoNetworkError: closed" },
      { key: "snapshot-unsaved" },
    ]);
    expect(stories).toHaveLength(1);
    expect(stories[0].sentence.text).toBe(
      "The database didn't answer this morning. That looks like what's behind the failed check and why the site reading wasn't saved.",
    );
  });

  it("never pulls pipeline-unavailable into the database chain — that's ShikksTracker's database, not ours", () => {
    const stories = groupProblems([
      { key: "pipeline-unavailable", raw: "MongoNetworkError: closed" },
      { key: "todos-unavailable" },
    ]);
    expect(stories).toHaveLength(2);
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

  it("keeps every story's bold ranges valid — within the sentence, never overlapping", () => {
    // Bounds (BRIEFING_BOUNDS.bold, .storySentence) are buildBriefing's job
    // (digest.ts, A6), not groupProblems' — see the BOUNDS SEAM note atop
    // stories.ts. A fixed cap here, pinned against a count stories.ts can
    // never realistically produce (this app watches 3 sites, siteHealth.ts's
    // SITES), would be testing a scenario that cannot happen. What must
    // always hold, however many symptoms a story carries, is that its bold
    // ranges are internally consistent.
    const scenarios: Problem[][] = [
      [
        { key: "site-status", site: "Meowchi", status: 503 },
        { key: "site-timeout", site: "AzeroTech" },
        { key: "site-unreachable", site: "ShikksTracker" },
      ],
      [
        { key: "agent-failed", agent: "chaser" },
        { key: "agent-failed", agent: "site-health" },
        { key: "agent-failed", agent: "watchdog" },
      ],
      [
        { key: "site-unreachable", site: "ShikksTracker" },
        { key: "pipeline-unavailable", raw: "fetch failed" },
        { key: "engine-stale", ageMs: 50 * 3600_000 },
        { key: "stranded-approved", count: 4 },
      ],
    ];
    for (const problems of scenarios) {
      for (const story of groupProblems(problems)) {
        const sorted = [...story.sentence.bold].sort((a, z) => a.start - z.start);
        for (const r of sorted) {
          expect(r.start).toBeGreaterThanOrEqual(0);
          expect(r.start).toBeLessThanOrEqual(r.end);
          expect(r.end).toBeLessThanOrEqual(story.sentence.text.length);
        }
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i].start).toBeGreaterThanOrEqual(sorted[i - 1].end);
        }
      }
    }
  });
});
