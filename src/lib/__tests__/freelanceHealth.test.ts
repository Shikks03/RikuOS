/**
 * Block F is the one place on the page where red is spent, so the switch
 * between the quiet footer and the bordered alarm card is the test that
 * matters most — followed by the 30-hour rule, which stops a stored reading
 * from asserting a present state it can no longer support.
 *
 * Every warning string is passed through from evaluateOutreach and siteHealth
 * VERBATIM. Nothing here rewrites one.
 */
import { describe, it, expect } from "vitest";
import { buildHealthStrip } from "@/lib/freelanceHealth";
import { evaluateOutreach } from "@/lib/outreachHealth";
import { AGENT_STALE_HOURS } from "@/lib/watchdog";
import type { SummaryResponse } from "@/lib/stApi";

const NOW = new Date("2026-09-05T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * HOUR);
}

function summary(over: Partial<SummaryResponse> = {}): SummaryResponse {
  return {
    queue: { drafts: 24, approved: 0 },
    engine: { lastRunAt: hoursAgo(2).toISOString(), lastRunErrors: 0 },
    contacts: null,
    campaigns: null,
    ...over,
  };
}

const OK_SITES = [
  { name: "AzeroTech", up: true, detail: "AzeroTech ok" },
  { name: "Meowchi", up: true, detail: "Meowchi ok" },
  { name: "ShikksTracker", up: true, detail: "ShikksTracker ok" },
];

function strip(over: Partial<Parameters<typeof buildHealthStrip>[0]> = {}) {
  const s = summary();
  return buildHealthStrip({
    now: NOW,
    findings: evaluateOutreach(NOW, s),
    engineLastRunAt: s.engine.lastRunAt,
    snapshot: { checkedAt: hoursAgo(6), sites: OK_SITES },
    monitoringEnabled: true,
    staleHours: AGENT_STALE_HOURS,
    ...over,
  });
}

describe("Block F — the quiet form", () => {
  it("renders the deck's single line when all is well", () => {
    const out = strip();
    if (out.kind !== "quiet") throw new Error("expected quiet");
    expect(out.parts).toEqual([
      { text: "Engine ran 2h ago", aged: false },
      { text: "all sites ok", aged: false },
      { text: "checked 6h ago", aged: false },
    ]);
  });

  it("says `Engine — unknown` in grey when the summary call failed", () => {
    const out = strip({ findings: null, engineLastRunAt: null });
    if (out.kind !== "quiet") throw new Error("expected quiet");
    expect(out.parts[0]).toEqual({ text: "Engine — unknown", aged: false });
  });

  it("makes no claim about sites it has never checked", () => {
    const out = strip({ snapshot: null });
    if (out.kind !== "quiet") throw new Error("expected quiet");
    expect(out.parts.map((p) => p.text)).toEqual(["Engine ran 2h ago", "sites never checked"]);
  });

  it("makes `sites never checked` amber with monitoring on and grey with it off", () => {
    const on = strip({ snapshot: null, monitoringEnabled: true });
    if (on.kind !== "quiet") throw new Error("expected quiet");
    expect(on.parts[1].aged).toBe(true);

    // With monitoring off the reading is EXPECTED to be absent, and an alarm
    // about an expected absence is a daily false alarm.
    const off = strip({ snapshot: null, monitoringEnabled: false });
    if (off.kind !== "quiet") throw new Error("expected quiet");
    expect(off.parts[1].aged).toBe(false);
  });

  it("claims nothing about sites when the reading holds none", () => {
    const out = strip({ snapshot: { checkedAt: hoursAgo(6), sites: [] } });
    if (out.kind !== "quiet") throw new Error("expected quiet");
    expect(out.parts.map((p) => p.text)).toEqual(["Engine ran 2h ago", "checked 6h ago"]);
  });
});

describe("Block F — the 30-hour rule", () => {
  it("keeps the claim inside the threshold", () => {
    const out = strip({ snapshot: { checkedAt: hoursAgo(AGENT_STALE_HOURS), sites: OK_SITES } });
    if (out.kind !== "quiet") throw new Error("expected quiet");
    expect(out.parts.map((p) => p.text)).toContain("all sites ok");
  });

  it("stops printing `all sites ok` past it, and ages the stamp", () => {
    const out = strip({
      snapshot: { checkedAt: hoursAgo(AGENT_STALE_HOURS + 18), sites: OK_SITES },
    });
    if (out.kind !== "quiet") throw new Error("expected quiet");
    expect(out.parts.map((p) => p.text)).not.toContain("all sites ok");
    expect(out.parts[1]).toEqual({ text: "sites not checked since 2d ago", aged: true });
  });

  it("takes the threshold as an argument rather than importing EXPECTATIONS", () => {
    const out = strip({
      snapshot: { checkedAt: hoursAgo(5), sites: OK_SITES },
      staleHours: 4,
    });
    if (out.kind !== "quiet") throw new Error("expected quiet");
    expect(out.parts[1].aged).toBe(true);
  });
});

describe("Block F — the alarm form", () => {
  it("becomes a card the moment there is one warning", () => {
    const stalled = summary({ engine: { lastRunAt: hoursAgo(72).toISOString(), lastRunErrors: 0 } });
    const out = buildHealthStrip({
      now: NOW,
      findings: evaluateOutreach(NOW, stalled),
      engineLastRunAt: stalled.engine.lastRunAt,
      snapshot: { checkedAt: hoursAgo(6), sites: OK_SITES },
      monitoringEnabled: true,
      staleHours: AGENT_STALE_HOURS,
    });
    if (out.kind !== "alarm") throw new Error("expected alarm");
    expect(out.warnings).toEqual([
      { tone: "stale", text: "ShikksTracker send engine last ran 3d ago" },
    ]);
    expect(out.stamp).toEqual({ text: "checked 6h ago", aged: false });
  });

  it("passes every evaluateOutreach string through verbatim, with the right hue", () => {
    const stalled = summary({
      queue: { drafts: 0, approved: 2 },
      engine: { lastRunAt: null, lastRunErrors: null },
    });
    const out = buildHealthStrip({
      now: NOW,
      findings: evaluateOutreach(NOW, stalled),
      engineLastRunAt: null,
      snapshot: { checkedAt: hoursAgo(6), sites: OK_SITES },
      monitoringEnabled: true,
      staleHours: AGENT_STALE_HOURS,
    });
    if (out.kind !== "alarm") throw new Error("expected alarm");
    expect(out.warnings).toEqual([
      { tone: "missing", text: "ShikksTracker send engine has never reported a run" },
      // Red, because it only ever fires beside a stalled engine — a human is
      // waiting.
      { tone: "missing", text: "2 approved messages are stranded, unsent" },
    ]);
  });

  it("passes a site's own detail string through, in red", () => {
    const out = strip({
      snapshot: {
        checkedAt: hoursAgo(6),
        sites: [
          { name: "AzeroTech", up: true, detail: "AzeroTech ok" },
          { name: "Meowchi", up: false, detail: "Meowchi returned HTTP 503" },
          { name: "ShikksTracker", up: true, detail: "ShikksTracker ok" },
        ],
      },
    });
    if (out.kind !== "alarm") throw new Error("expected alarm");
    expect(out.warnings).toEqual([
      { tone: "missing", text: "Meowchi returned HTTP 503" },
    ]);
    // Healthy items follow on one indented line — including the engine, which
    // is healthy here.
    expect(out.fine).toEqual(["Engine ran 2h ago", "AzeroTech ok", "ShikksTracker ok"]);
  });

  it("puts `Engine — unknown` among the healthy items, never among the warnings", () => {
    const out = strip({
      findings: null,
      engineLastRunAt: null,
      snapshot: {
        checkedAt: hoursAgo(6),
        sites: [{ name: "Meowchi", up: false, detail: "Meowchi unreachable" }],
      },
    });
    if (out.kind !== "alarm") throw new Error("expected alarm");
    expect(out.warnings.map((w) => w.text)).toEqual(["Meowchi unreachable"]);
    expect(out.fine).toEqual(["Engine — unknown"]);
  });

  it("still warns about a site that was down at the last reading, however old it is", () => {
    // Over-report: suppressing a red warning because the reading aged would be
    // the wrong direction to fail in. The stamp already says how old it is.
    const out = strip({
      snapshot: {
        checkedAt: hoursAgo(AGENT_STALE_HOURS + 18),
        sites: [{ name: "Meowchi", up: false, detail: "Meowchi timed out" }],
      },
    });
    if (out.kind !== "alarm") throw new Error("expected alarm");
    expect(out.warnings.map((w) => w.text)).toEqual(["Meowchi timed out"]);
    expect(out.stamp).toEqual({ text: "sites not checked since 2d ago", aged: true });
  });

  it("reports an engine error count with the singular the deck writes", () => {
    const one = summary({ engine: { lastRunAt: hoursAgo(2).toISOString(), lastRunErrors: 1 } });
    const out = buildHealthStrip({
      now: NOW,
      findings: evaluateOutreach(NOW, one),
      engineLastRunAt: one.engine.lastRunAt,
      snapshot: { checkedAt: hoursAgo(6), sites: OK_SITES },
      monitoringEnabled: true,
      staleHours: AGENT_STALE_HOURS,
    });
    if (out.kind !== "alarm") throw new Error("expected alarm");
    expect(out.warnings).toEqual([
      { tone: "missing", text: "ShikksTracker send engine reported 1 error" },
    ]);
  });
});
