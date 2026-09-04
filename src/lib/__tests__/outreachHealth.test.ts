/**
 * The check that would have caught the real fault: ShikksTracker's send engine
 * silently still for 29 days (observed 2026-08-30) while two approved
 * follow-ups sat undelivered, with nothing in either repo alarming.
 *
 * The two tests that matter most are the ones pinning what must STAY QUIET —
 * a healthy engine with approved messages about to go out, and a Messenger
 * backlog (`unlinkedCount`, `unansweredCount`) that describes Riku's own queue
 * of work rather than a broken machine. A monitor that cries every morning is
 * a monitor Riku stops reading, and the whole phase rests on the daily push
 * being worth opening.
 */

import { describe, it, expect } from "vitest";
import {
  evaluateOutreach,
  formatAge,
  ENGINE_STALE_HOURS,
  WEBHOOK_SILENT_DAYS,
} from "@/lib/outreachHealth";
import type { SummaryResponse } from "@/lib/stApi";

const NOW = new Date("2026-08-30T00:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * HOUR).toISOString();
}

function daysAgo(days: number): string {
  return hoursAgo(days * 24);
}

// The baseline is a HEALTHY summary, which is why `lastEventAt` now carries a
// real recent stamp rather than the null it held while ShikksTracker's P2 was
// unbuilt: null is now the most fundamental webhook fault this file reports,
// so leaving it in the default fixture would make every other test assert
// around an alarm it never meant to raise.
function summary(over: Partial<SummaryResponse> = {}): SummaryResponse {
  return {
    queue: { drafts: 24, approved: 0 },
    engine: { lastRunAt: hoursAgo(2), lastRunErrors: 0 },
    messenger: { lastEventAt: hoursAgo(6), unlinkedCount: 0, unansweredCount: 0 },
    ...over,
  };
}

describe("evaluateOutreach — quiet when it should be", () => {
  it("says nothing about a recently-run, error-free engine", () => {
    expect(evaluateOutreach(NOW, summary())).toEqual([]);
  });

  it("does not call approved messages stranded while the engine is healthy", () => {
    // Two reasons, and the second is the load-bearing one.
    //
    // Anti-noise: beside a healthy engine they are simply about to be sent, and
    // reporting that daily is how an alarm becomes background noise.
    //
    // DECISION S10: sending is off until Riku says so, each time, and off is
    // the resting state — so approved messages waiting beside a running engine
    // is the NORMAL condition of this system, not a transient one. This
    // assertion is therefore not a nicety about tone; it is what stops the
    // morning push from nagging him every day to send to businesses he has not
    // agreed to contact. Do not "improve" this into a warning, and do not add a
    // finding for approved-count or a stopped send switch. See ARCHITECTURE §7.
    const findings = evaluateOutreach(NOW, summary({ queue: { drafts: 24, approved: 5 } }));
    expect(findings).toEqual([]);

    // Holds no matter how many accumulate, because under S10 they can pile up
    // indefinitely without anything being wrong.
    expect(evaluateOutreach(NOW, summary({ queue: { drafts: 500, approved: 500 } }))).toEqual([]);
  });

  it("never judges the Messenger backlog counts, however large they grow", () => {
    // Successor to the old "P2 is unbuilt" tripwire, which this change retires
    // on purpose. unlinkedCount and unansweredCount are real signals, but they
    // describe Riku's own queue of work — exactly like queue.drafts — not a
    // machine that has broken. A live webhook with a big backlog is a busy
    // week, and saying so every morning is how the digest becomes noise.
    const findings = evaluateOutreach(
      NOW,
      summary({
        messenger: { lastEventAt: hoursAgo(3), unlinkedCount: 40, unansweredCount: 25 },
      })
    );
    expect(findings).toEqual([]);
  });

  it("says nothing about a webhook that fired recently", () => {
    const findings = evaluateOutreach(
      NOW,
      summary({ messenger: { lastEventAt: daysAgo(1), unlinkedCount: 0, unansweredCount: 0 } })
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

  it("stays quiet exactly at the webhook threshold and speaks just past it", () => {
    // The boundary has to be exact. This page receives a handful of messages a
    // week, so a day of drift either way is the difference between catching a
    // dead subscription and crying at a quiet fortnight.
    const atLimit = summary({
      messenger: {
        lastEventAt: daysAgo(WEBHOOK_SILENT_DAYS),
        unlinkedCount: 0,
        unansweredCount: 0,
      },
    });
    expect(evaluateOutreach(NOW, atLimit)).toEqual([]);

    const pastLimit = summary({
      messenger: {
        lastEventAt: daysAgo(WEBHOOK_SILENT_DAYS + 1),
        unlinkedCount: 0,
        unansweredCount: 0,
      },
    });
    expect(evaluateOutreach(NOW, pastLimit).map((f) => f.kind)).toEqual(["webhook-stale"]);
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

describe("evaluateOutreach — the Messenger webhook's liveness", () => {
  it("holds the threshold at the ten days Riku chose", () => {
    // The boundary test above is written in terms of the constant, so it
    // proves the comparison is strict but would stay green if someone set the
    // threshold to 60 — silently disabling the alarm inside the very token
    // expiry cycle it exists to catch. Ten was a product decision on
    // 2026-09-04; a product decision living in a constant gets one test that
    // names the number, so changing it is a deliberate act.
    expect(WEBHOOK_SILENT_DAYS).toBe(10);
  });

  it("reports a webhook that has never received an event", () => {
    // Since ShikksTracker's P2 shipped, null no longer means "no webhook yet".
    // It means no Messenger event has EVER arrived, which on a live deployment
    // is a subscription Meta has never delivered to.
    const findings = evaluateOutreach(
      NOW,
      summary({ messenger: { lastEventAt: null, unlinkedCount: 0, unansweredCount: 0 } })
    );
    expect(findings).toEqual([
      {
        kind: "webhook-never-fired",
        detail: "ShikksTracker reports no Messenger event, ever",
      },
    ]);
  });

  it("names ShikksTracker as the reporter on the null line, not Meta", () => {
    // Load-bearing wording, not style. A rollback of ShikksTracker to any
    // pre-P2 deploy sends `messenger: {lastEventAt: null}` — byte-identical to
    // a genuine "no event has ever arrived" — so this one line has to stay
    // true under both readings and point at the place to look first.
    const [finding] = evaluateOutreach(
      NOW,
      summary({ messenger: { lastEventAt: null, unlinkedCount: 0, unansweredCount: 0 } })
    );
    expect(finding.detail).toContain("ShikksTracker");
    expect(finding.detail).not.toMatch(/webhook/i);
  });

  it("reports an unreadable event time instead of passing it as healthy", () => {
    // The same hole the engine has: NaN loses every comparison, so without its
    // own branch a malformed stamp would clear the silence check forever.
    const findings = evaluateOutreach(
      NOW,
      summary({ messenger: { lastEventAt: "not-a-date", unlinkedCount: 0, unansweredCount: 0 } })
    );
    expect(findings).toEqual([
      {
        kind: "webhook-unreadable",
        detail: "Messenger webhook event time unreadable",
      },
    ]);
  });

  it("names the age of the silence, in the same words as the engine line", () => {
    const findings = evaluateOutreach(
      NOW,
      summary({ messenger: { lastEventAt: daysAgo(21), unlinkedCount: 0, unansweredCount: 0 } })
    );
    expect(findings).toEqual([
      { kind: "webhook-stale", detail: "Messenger webhook silent for 21d" },
    ]);
  });

  it("drops the ShikksTracker prefix on the two lines that can afford to", () => {
    // Deliberate asymmetry, pinned so a later tidy-up does not "restore
    // consistency" and undo it. The push body is capped at 200 chars and these
    // findings are last in every ordering, so every character bought here is
    // one more concurrent problem that survives the slice. Only the null line
    // keeps the prefix, where it is load-bearing for diagnosis.
    const stale = evaluateOutreach(
      NOW,
      summary({ messenger: { lastEventAt: daysAgo(30), unlinkedCount: 0, unansweredCount: 0 } })
    );
    const unreadable = evaluateOutreach(
      NOW,
      summary({ messenger: { lastEventAt: "not-a-date", unlinkedCount: 0, unansweredCount: 0 } })
    );
    for (const [finding] of [stale, unreadable]) {
      expect(finding.detail).not.toContain("ShikksTracker");
      expect(finding.detail.length).toBeLessThanOrEqual(45);
    }
  });

  it("takes an overridden threshold without mocking anything but now", () => {
    const quiet = summary({
      messenger: { lastEventAt: daysAgo(12), unlinkedCount: 0, unansweredCount: 0 },
    });
    expect(evaluateOutreach(NOW, quiet, ENGINE_STALE_HOURS, 30)).toEqual([]);
  });

  it("puts the webhook FIRST when it and the engine are both down", () => {
    // Two different subsystems inside ShikksTracker: the send engine pushes
    // outbound, the webhook receives inbound. Both can be down at once, and
    // letting either suppress the other would hide half of a total outage.
    //
    // The order is not cosmetic. The push body is sliced at 200 chars and is
    // the only channel these findings have, so last means lost once enough
    // problems pile up. A dead inbound webhook loses leads permanently —
    // nobody ever learns they messaged — while a stalled outbound engine only
    // delays queued messages. The unrecoverable loss goes first.
    const findings = evaluateOutreach(
      NOW,
      summary({
        queue: { drafts: 24, approved: 2 },
        engine: { lastRunAt: hoursAgo(400), lastRunErrors: 0 },
        messenger: { lastEventAt: null, unlinkedCount: 0, unansweredCount: 0 },
      })
    );
    expect(findings.map((f) => f.kind)).toEqual([
      "webhook-never-fired",
      "engine-stale",
      "stranded-approved",
    ]);
  });

  it("reports the webhook while the engine is perfectly healthy", () => {
    const findings = evaluateOutreach(
      NOW,
      summary({ messenger: { lastEventAt: daysAgo(60), unlinkedCount: 0, unansweredCount: 0 } })
    );
    expect(findings.map((f) => f.kind)).toEqual(["webhook-stale"]);
  });

  it("raises exactly one webhook finding, never two", () => {
    // null and unreadable are both "no usable timestamp"; if either fell
    // through to the age comparison it would add a second line describing the
    // same single fault.
    for (const lastEventAt of [null, "not-a-date"]) {
      const findings = evaluateOutreach(
        NOW,
        summary({ messenger: { lastEventAt, unlinkedCount: 0, unansweredCount: 0 } })
      );
      expect(findings).toHaveLength(1);
    }
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
    const findings = [
      ...evaluateOutreach(
        NOW,
        summary({
          queue: { drafts: 24, approved: 999 },
          engine: { lastRunAt: "not-a-date", lastRunErrors: 0 },
          messenger: { lastEventAt: "not-a-date", unlinkedCount: 0, unansweredCount: 0 },
        })
      ),
      ...evaluateOutreach(
        NOW,
        summary({ messenger: { lastEventAt: null, unlinkedCount: 0, unansweredCount: 0 } })
      ),
      ...evaluateOutreach(
        NOW,
        summary({ messenger: { lastEventAt: daysAgo(999), unlinkedCount: 0, unansweredCount: 0 } })
      ),
      // The three engine kinds the fixtures above never reach. Without these
      // the block's name promised coverage it did not have, and a reworded
      // engine line could grow past the budget unchallenged.
      ...evaluateOutreach(NOW, summary({ engine: { lastRunAt: null, lastRunErrors: 0 } })),
      ...evaluateOutreach(
        NOW,
        summary({ engine: { lastRunAt: hoursAgo(999), lastRunErrors: 0 } })
      ),
      ...evaluateOutreach(
        NOW,
        summary({ engine: { lastRunAt: hoursAgo(1), lastRunErrors: 99 } })
      ),
    ];

    // Guards the guard: if a fixture stops producing its finding, the loop
    // below would pass vacuously on a shorter list and the budget would go
    // unchecked for whatever went missing.
    const kinds = new Set(findings.map((f) => f.kind));
    expect(kinds).toEqual(
      new Set([
        "engine-never-ran",
        "engine-unreadable",
        "engine-stale",
        "engine-errors",
        "stranded-approved",
        "webhook-never-fired",
        "webhook-unreadable",
        "webhook-stale",
      ])
    );

    for (const finding of findings) {
      expect(finding.detail.length).toBeLessThanOrEqual(80);
    }
  });
});
