/**
 * The Debrief's per-source readers (debriefRead.ts), each with its edges
 * mocked. The decisions under test: the site floor shared with "Check now",
 * the save outcome snapshot-unsaved reads, ShikksTracker as one source behind
 * two endpoints, and that a failed read is a failed SOURCE — never a throw,
 * never a problem.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/healthSnapshot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/healthSnapshot")>();
  return { ...actual, getHealthSnapshot: vi.fn(), saveHealthSnapshot: vi.fn() };
});
vi.mock("@/lib/siteHealth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/siteHealth")>();
  return { ...actual, checkSites: vi.fn() };
});
vi.mock("@/lib/watchdog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/watchdog")>();
  return { ...actual, fetchLatestRuns: vi.fn() };
});
vi.mock("@/lib/stApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stApi")>();
  return { ...actual, fetchSummary: vi.fn(), fetchAttention: vi.fn() };
});
vi.mock("@/lib/lastDigest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/lastDigest")>();
  return { ...actual, getLastDigest: vi.fn() };
});

import {
  readShikksTrackerForDebrief,
  readSitesForDebrief,
  readTodaysBaseline,
  readWatchdogForDebrief,
} from "@/lib/debriefRead";
import { getHealthSnapshot, saveHealthSnapshot } from "@/lib/healthSnapshot";
import { checkSites, type SiteResult } from "@/lib/siteHealth";
import { EXPECTATIONS, fetchLatestRuns } from "@/lib/watchdog";
import { fetchAttention, fetchSummary, type AttentionResponse, type SummaryResponse } from "@/lib/stApi";
import { getLastDigest } from "@/lib/lastDigest";
import { toStoredSymptom } from "@/lib/digest";

const NOW = new Date("2026-10-13T05:04:00.000Z"); // 13:04 Manila
const SENT_AT = new Date("2026-10-12T23:00:04.000Z"); // 07:00 Manila
const DOWN: SiteResult[] = [{ name: "Meowchi", up: false, detail: "Meowchi returned HTTP 503", failure: "status", status: 503 }];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.mocked(getHealthSnapshot).mockReset();
  vi.mocked(saveHealthSnapshot).mockReset();
  vi.mocked(checkSites).mockReset();
  vi.mocked(fetchLatestRuns).mockReset();
  vi.mocked(fetchSummary).mockReset();
  vi.mocked(fetchAttention).mockReset();
  vi.mocked(getLastDigest).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("readSitesForDebrief — the site floor shared with Check now (spec §3.3)", () => {
  it("reuses a reading inside the floor: no site pinged, nothing saved", async () => {
    const checkedAt = new Date(NOW.getTime() - 20_000);
    vi.mocked(getHealthSnapshot).mockResolvedValue({ checkedAt, sites: DOWN });
    expect(await readSitesForDebrief()).toEqual({ ok: true, results: DOWN, savedAt: checkedAt, ownSaveJustFailed: false });
    expect(checkSites).not.toHaveBeenCalled();
    expect(saveHealthSnapshot).not.toHaveBeenCalled();
  });

  it("past the floor, checks fresh and saves the reading for the Freelance page", async () => {
    vi.mocked(getHealthSnapshot).mockResolvedValue({ checkedAt: new Date(NOW.getTime() - 61_000), sites: [] });
    vi.mocked(checkSites).mockResolvedValue(DOWN);
    vi.mocked(saveHealthSnapshot).mockResolvedValue(undefined);
    expect(await readSitesForDebrief()).toEqual({ ok: true, results: DOWN, savedAt: NOW, ownSaveJustFailed: false });
    expect(saveHealthSnapshot).toHaveBeenCalledWith(NOW, DOWN);
  });

  it("a failed save keeps the reading, flags it, and keeps the last good save time", async () => {
    const previous = new Date(NOW.getTime() - 3_600_000);
    vi.mocked(getHealthSnapshot).mockResolvedValue({ checkedAt: previous, sites: [] });
    vi.mocked(checkSites).mockResolvedValue(DOWN);
    vi.mocked(saveHealthSnapshot).mockRejectedValue(new Error("write failed"));
    expect(await readSitesForDebrief()).toEqual({ ok: true, results: DOWN, savedAt: previous, ownSaveJustFailed: true });
  });

  it("a failed snapshot read checks fresh rather than failing", async () => {
    vi.mocked(getHealthSnapshot).mockRejectedValue(new Error("MongoNetworkError"));
    vi.mocked(checkSites).mockResolvedValue(DOWN);
    vi.mocked(saveHealthSnapshot).mockResolvedValue(undefined);
    expect(await readSitesForDebrief()).toEqual({ ok: true, results: DOWN, savedAt: NOW, ownSaveJustFailed: false });
  });

  it("a check that throws is the whole source failing, carrying the last save time", async () => {
    const previous = new Date(NOW.getTime() - 3_600_000);
    vi.mocked(getHealthSnapshot).mockResolvedValue({ checkedAt: previous, sites: [] });
    vi.mocked(checkSites).mockRejectedValue(new Error("boom"));
    expect(await readSitesForDebrief()).toEqual({ ok: false, savedAt: previous });
  });
});

describe("readShikksTrackerForDebrief — one source, two endpoints (spec §3.5)", () => {
  const SUMMARY = { engine: { lastRunAt: NOW.toISOString(), lastRunErrors: 0 }, queue: { drafts: 0, approved: 0 } } as unknown as SummaryResponse;
  const ATTENTION = { repliedUnanswered: [{}, {}], overdueActions: [{}] } as unknown as AttentionResponse;

  it("both answering: the sender's findings and the attention counts", async () => {
    vi.mocked(fetchSummary).mockResolvedValue(SUMMARY);
    vi.mocked(fetchAttention).mockResolvedValue(ATTENTION);
    expect(await readShikksTrackerForDebrief(NOW, 7)).toEqual({
      ok: true,
      findings: [],
      attention: { repliedUnanswered: 2, overdue: 1 },
    });
    expect(fetchAttention).toHaveBeenCalledWith(7, 50);
  });

  it.each(["summary", "attention"] as const)("%s failing fails the whole source — no problem, no throw", async (which) => {
    vi.mocked(fetchSummary).mockImplementation(async () => {
      if (which === "summary") throw new Error("GET /api/os/summary returned 503.");
      return SUMMARY;
    });
    vi.mocked(fetchAttention).mockImplementation(async () => {
      if (which === "attention") throw new Error("fetch failed");
      return ATTENTION;
    });
    expect(await readShikksTrackerForDebrief(NOW, 7)).toEqual({ ok: false });
  });
});

describe("readWatchdogForDebrief", () => {
  it("judges the run history as the morning's watchdog does, and keeps the runs", async () => {
    const runs = EXPECTATIONS.map((e) => ({ agent: e.agent, startedAt: new Date(NOW.getTime() - 3_600_000), ok: true, itemsFailed: 0 }));
    vi.mocked(fetchLatestRuns).mockResolvedValue(runs);
    expect(await readWatchdogForDebrief(NOW)).toEqual({ ok: true, anomalies: [], runs });
  });

  it("a failed read is the source failing, never a problem and never a throw", async () => {
    vi.mocked(fetchLatestRuns).mockRejectedValue(new Error("MongoNetworkError"));
    expect(await readWatchdogForDebrief(NOW)).toEqual({ ok: false });
  });
});

describe("readTodaysBaseline (D5)", () => {
  it("today's structured Briefing is the baseline", async () => {
    const symptom = toStoredSymptom({ key: "todos-unavailable" });
    vi.mocked(getLastDigest).mockResolvedValue({
      sentAt: SENT_AT,
      title: "T",
      body: "B",
      devices: 1,
      seenAt: null,
      briefing: { stories: [{ sentence: "s", bold: [], symptoms: [symptom] }], today: "", freelance: null, off: null, unrecognised: 0, omitted: 0 },
    });
    expect(await readTodaysBaseline(NOW)).toEqual({ sentAt: SENT_AT, symptoms: [symptom] });
  });

  it("a failed read compares against nothing rather than failing the Debrief", async () => {
    vi.mocked(getLastDigest).mockRejectedValue(new Error("MongoNetworkError"));
    expect(await readTodaysBaseline(NOW)).toBeNull();
  });
});
