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
vi.mock("@/lib/osSettings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/osSettings")>();
  return { ...actual, readOsSettings: vi.fn() };
});
vi.mock("@/lib/digestToday", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/digestToday")>();
  return { ...actual, readDigestToday: vi.fn() };
});
vi.mock("@/lib/sinceThenRead", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sinceThenRead")>();
  return { ...actual, readSinceThen: vi.fn() };
});
vi.mock("@/models/ApprovalItem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/models/ApprovalItem")>();
  return { ...actual, default: { countDocuments: vi.fn() } };
});

import {
  readDebriefChecks,
  readShikksTrackerForDebrief,
  readSitesForDebrief,
  readTodaysBaseline,
  readWatchdogForDebrief,
} from "@/lib/debriefRead";
import { getHealthSnapshot, saveHealthSnapshot } from "@/lib/healthSnapshot";
import { checkSites, type SiteResult } from "@/lib/siteHealth";
import { GOOGLE_TIMEOUT_MS } from "@/lib/google";
import { EXPECTATIONS, fetchLatestRuns } from "@/lib/watchdog";
import { fetchAttention, fetchSummary, type AttentionResponse, type SummaryResponse } from "@/lib/stApi";
import { getLastDigest } from "@/lib/lastDigest";
import { readOsSettings, type OsSettingsValues } from "@/lib/osSettings";
import { readDigestToday } from "@/lib/digestToday";
import { readSinceThen } from "@/lib/sinceThenRead";
import ApprovalItem from "@/models/ApprovalItem";
import { OS_SETTINGS_DEFAULTS } from "@/models/OsSettings";
import { toStoredSymptom } from "@/lib/digest";

const NOW = new Date("2026-10-13T05:04:00.000Z"); // 13:04 Manila
const SENT_AT = new Date("2026-10-12T23:00:04.000Z"); // 07:00 Manila
const DOWN: SiteResult[] = [{ name: "Meowchi", up: false, detail: "Meowchi returned HTTP 503", failure: "status", status: 503 }];
const countDocuments = ApprovalItem.countDocuments as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  // setTimeout/clearTimeout are faked alongside Date (fix round) so a write's
  // withDeadline bound can be driven deterministically; every existing test
  // below never advances them, so a mocked promise that settles immediately
  // still wins its race on the microtask queue exactly as before.
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(NOW);
  vi.mocked(getHealthSnapshot).mockReset();
  vi.mocked(saveHealthSnapshot).mockReset();
  vi.mocked(checkSites).mockReset();
  vi.mocked(fetchLatestRuns).mockReset();
  vi.mocked(fetchSummary).mockReset();
  vi.mocked(fetchAttention).mockReset();
  vi.mocked(getLastDigest).mockReset();
  vi.mocked(readOsSettings).mockReset();
  vi.mocked(readDigestToday).mockReset();
  vi.mocked(readSinceThen).mockReset();
  countDocuments.mockReset();
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

  // Fix round (feature review, item 1): the write has no deadline of its own
  // otherwise, and a stuck save could hold the press open past maxDuration,
  // losing the AgentRun row with it. A timeout here must read exactly like a
  // save that threw: ownSaveJustFailed, the last good savedAt kept.
  it("a stuck snapshot save times out and is treated as a failed save", async () => {
    const previous = new Date(NOW.getTime() - 3_600_000);
    vi.mocked(getHealthSnapshot).mockResolvedValue({ checkedAt: previous, sites: [] });
    vi.mocked(checkSites).mockResolvedValue(DOWN);
    vi.mocked(saveHealthSnapshot).mockImplementation(() => new Promise(() => {}));

    const pending = readSitesForDebrief();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await pending).toEqual({ ok: true, results: DOWN, savedAt: previous, ownSaveJustFailed: true });
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

// Fix round (feature review, item 2): readDebriefChecks itself had no test —
// every leg was proven alone but never assembled. Every sub-read not under
// test is given a healthy mock so each test isolates the one leg it names.
describe("readDebriefChecks — assembling every leg (fix round)", () => {
  const SUMMARY = { engine: { lastRunAt: NOW.toISOString(), lastRunErrors: 0 }, queue: { drafts: 0, approved: 0 } } as unknown as SummaryResponse;
  const ATTENTION = { repliedUnanswered: [], overdueActions: [] } as unknown as AttentionResponse;
  const SETTINGS_OK: OsSettingsValues = {
    chaserEnabled: true,
    chaserNDays: 9,
    monitoringEnabled: true,
    layers: [],
    personalLayout: [],
  };
  const TODAY_STUB = { events: [], missedLayers: [], due: [], overdue: [] };

  beforeEach(() => {
    vi.mocked(fetchLatestRuns).mockResolvedValue([]);
    vi.mocked(getHealthSnapshot).mockResolvedValue({ checkedAt: new Date(NOW.getTime() - 10_000), sites: [] });
    vi.mocked(fetchSummary).mockResolvedValue(SUMMARY);
    vi.mocked(fetchAttention).mockResolvedValue(ATTENTION);
    vi.mocked(readDigestToday).mockResolvedValue(TODAY_STUB);
    countDocuments.mockResolvedValue(0);
  });

  it("a failed settings read: the calendar reads as failed, the default chaserNDays is used, chaserEnabled is unavailable", async () => {
    vi.mocked(readOsSettings).mockRejectedValue(new Error("MongoNetworkError"));

    const out = await readDebriefChecks(NOW, null);

    expect(out.chaserEnabled).toBe("unavailable");
    expect(out.today).toEqual({ ...TODAY_STUB, events: "unavailable", missedLayers: [], calendarCause: "read-failed" });
    expect(fetchAttention).toHaveBeenCalledWith(OS_SETTINGS_DEFAULTS.chaserNDays, 50);
    // No layers to read without settings — only the to-do half is read.
    expect(readDigestToday).toHaveBeenCalledWith([], expect.any(String));
  });

  it("a failed pending-count read reads as unavailable", async () => {
    vi.mocked(readOsSettings).mockResolvedValue(SETTINGS_OK);
    countDocuments.mockRejectedValue(new Error("MongoNetworkError"));

    const out = await readDebriefChecks(NOW, null);

    expect(out.pending).toBe("unavailable");
  });

  it("baselineSentAt === null makes no since-then read", async () => {
    vi.mocked(readOsSettings).mockResolvedValue(SETTINGS_OK);

    const out = await readDebriefChecks(NOW, null);

    expect(readSinceThen).not.toHaveBeenCalled();
    expect(out.since).toBeNull();
  });

  // Fix round (principal review, item 2): the today leg carried no deadline
  // of its own — readDigestToday's Todo queries have none — so a stalled
  // query could wait out the ~45s socket timeout and run the whole press
  // past maxDuration, losing the AgentRun row with it. A timeout here reads
  // as an unreadable calendar AND unreadable to-dos, never a hang.
  it("a stuck today leg times out and reads as unavailable, not a hang", async () => {
    vi.mocked(readOsSettings).mockResolvedValue(SETTINGS_OK);
    vi.mocked(readDigestToday).mockImplementation(() => new Promise(() => {}));

    const pending = readDebriefChecks(NOW, null);
    await vi.advanceTimersByTimeAsync(GOOGLE_TIMEOUT_MS * 2);
    const out = await pending;

    expect(out.today).toEqual({
      events: "unavailable",
      missedLayers: [],
      calendarCause: "timeout",
      due: "unavailable",
      overdue: [],
    });
  });
});
