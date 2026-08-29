/**
 * The check that would have caught the real fault: ShikksTracker's send engine
 * silently still for 29 days (observed 2026-08-30) while two approved
 * follow-ups sat undelivered, with nothing in either repo alarming.
 *
 * The two tests that matter most are the ones pinning what must STAY QUIET —
 * a healthy engine with approved messages about to go out, and every messenger
 * field while P2 is unbuilt. A monitor that cries every morning is a monitor
 * Riku stops reading, and the whole phase rests on the daily push being worth
 * opening.
 */

import { describe, it, expect } from "vitest";
import { evaluateOutreach, formatAge, ENGINE_STALE_HOURS } from "@/lib/outreachHealth";
import type { SummaryResponse } from "@/lib/stApi";

const NOW = new Date("2026-08-30T00:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * HOUR).toISOString();
}

function summary(over: Partial<SummaryResponse> = {}): SummaryResponse {
  return {
    queue: { drafts: 24, approved: 0 },
    engine: { lastRunAt: hoursAgo(2), lastRunErrors: 0 },
    messenger: { lastEventAt: null, unlinkedCount: 0, unansweredCount: 0 },
    ...over,
  };
}

describe("evaluateOutreach — quiet when it should be", () => {
  it("says nothing about a recently-run, error-free engine", () => {
    expect(evaluateOutreach(NOW, summary())).toEqual([]);
  });

  it("does not call approved messages stranded while the engine is healthy", () => {
    // They are about to be sent. Reporting this daily is how an alarm becomes
    // background noise.
    const findings = evaluateOutreach(NOW, summary({ queue: { drafts: 24, approved: 5 } }));
    expect(findings).toEqual([]);
  });

  it("never reports a messenger field while P2 is unbuilt", () => {
    // lastEventAt: null means "no webhook yet", not "the webhook is dead"
    // (design P5a-1). This test is the guard on that; it should start failing
    // deliberately, in the change that adds the webhook check after P2 ships.
    const findings = evaluateOutreach(
      NOW,
      summary({ messenger: { lastEventAt: null, unlinkedCount: 7, unansweredCount: 3 } })
    );
    expect(findings).toEqual([]);
  });

  it("treats a draft backlog as Riku's business, not a fault", () => {
    expect(evaluateOutreach(NOW, summary({ queue: { drafts: 500, approved: 0 } }))).toEqual([]);
  });

  it("stays quiet exactly at the threshold and speaks just past it", () => {
    const atLimit = summary({
      engine: { lastRunAt: hoursAgo(ENGINE_STALE_HOURS), lastRunErrors: 0 },
    });
    expect(evaluateOutreach(NOW, atLimit)).toEqual([]);

    const pastLimit = summary({
      engine: { lastRunAt: hoursAgo(ENGINE_STALE_HOURS + 1), lastRunErrors: 0 },
    });
    expect(evaluateOutreach(NOW, pastLimit)).toHaveLength(1);
    expect(pastLimit.engine.lastRunAt).toBeTruthy();
  });
});

describe("evaluateOutreach — the fault it was built for", () => {
  it("reports the 29-day stall and the messages it stranded", () => {
    const findings = evaluateOutreach(
      NOW,
      summary({
        queue: { drafts: 24, approved: 2 },
        engine: { lastRunAt: "2026-08-01T07:06:27.319Z", lastRunErrors: 0 },
      })
    );
    expect(findings.map((f) => f.kind)).toEqual(["engine-stale", "stranded-approved"]);
    expect(findings[0].detail).toBe("ShikksTracker send engine last ran 28d ago");
    expect(findings[1].detail).toBe("2 approved messages are stranded, unsent");
  });

  it("pluralises one stranded message correctly", () => {
    const findings = evaluateOutreach(
      NOW,
      summary({ queue: { drafts: 0, approved: 1 }, engine: { lastRunAt: hoursAgo(100), lastRunErrors: 0 } })
    );
    expect(findings[1].detail).toBe("1 approved message is stranded, unsent");
  });

  it("reports an engine that has never run", () => {
    const findings = evaluateOutreach(
      NOW,
      summary({ engine: { lastRunAt: null, lastRunErrors: null } })
    );
    expect(findings.map((f) => f.kind)).toEqual(["engine-never-ran"]);
  });

  it("reports an unreadable timestamp instead of passing it as healthy", () => {
    // NaN loses every comparison, so without its own branch a malformed date
    // would clear the staleness check forever.
    const findings = evaluateOutreach(
      NOW,
      summary({ engine: { lastRunAt: "not-a-date", lastRunErrors: 0 } })
    );
    expect(findings.map((f) => f.kind)).toEqual(["engine-unreadable"]);
  });

  it("counts an unreadable or absent timestamp as stalled for stranding too", () => {
    const findings = evaluateOutreach(
      NOW,
      summary({ queue: { drafts: 0, approved: 3 }, engine: { lastRunAt: null, lastRunErrors: null } })
    );
    expect(findings.map((f) => f.kind)).toEqual(["engine-never-ran", "stranded-approved"]);
  });

  it("reports engine errors on a fresh run, pluralised", () => {
    expect(
      evaluateOutreach(NOW, summary({ engine: { lastRunAt: hoursAgo(1), lastRunErrors: 1 } }))[0]
    ).toEqual({ kind: "engine-errors", detail: "ShikksTracker send engine reported 1 error" });

    expect(
      evaluateOutreach(NOW, summary({ engine: { lastRunAt: hoursAgo(1), lastRunErrors: 4 } }))[0]
        .detail
    ).toBe("ShikksTracker send engine reported 4 errors");
  });

  it("reports a stale engine instead of its errors, never both", () => {
    // lastRunErrors describes the run from BEFORE the stall, so naming it
    // would point Riku at the wrong problem.
    const findings = evaluateOutreach(
      NOW,
      summary({ engine: { lastRunAt: hoursAgo(400), lastRunErrors: 9 } })
    );
    expect(findings.map((f) => f.kind)).toEqual(["engine-stale"]);
  });
});

describe("evaluateOutreach — a field that was never sent is not a zero", () => {
  it("does not claim zero errors when the count is missing", () => {
    const findings = evaluateOutreach(
      NOW,
      summary({ engine: { lastRunAt: hoursAgo(1), lastRunErrors: null } })
    );
    expect(findings).toEqual([]);
  });

  it("does not invent a stranded count when approved is missing", () => {
    const findings = evaluateOutreach(
      NOW,
      summary({ queue: { drafts: null, approved: null }, engine: { lastRunAt: null, lastRunErrors: null } })
    );
    expect(findings.map((f) => f.kind)).toEqual(["engine-never-ran"]);
  });
});

describe("formatAge", () => {
  it("reads in hours below two days", () => {
    expect(formatAge(1 * HOUR)).toBe("1h");
    expect(formatAge(47 * HOUR)).toBe("47h");
  });

  it("switches to days at two days, where 696h stops being readable", () => {
    expect(formatAge(48 * HOUR)).toBe("2d");
    expect(formatAge(696 * HOUR)).toBe("29d");
  });
});

describe("every finding fits the digest's 80-character budget", () => {
  it("keeps the longest detail short enough not to be truncated", () => {
    const findings = evaluateOutreach(
      NOW,
      summary({
        queue: { drafts: 24, approved: 999 },
        engine: { lastRunAt: "not-a-date", lastRunErrors: 0 },
      })
    );
    for (const finding of findings) {
      expect(finding.detail.length).toBeLessThanOrEqual(80);
    }
  });
});
