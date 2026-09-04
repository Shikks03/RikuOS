/**
 * The tests that matter most here are the ones pinning what triage must NOT
 * do when it is under-configured. Riku is shipping this before filling in his
 * knowledge block, project list and demo URLs (design D11), so "safe when
 * unconfigured" is the normal operating state for a while, not an edge case.
 */

import { describe, it, expect } from "vitest";
import {
  WINDOW_HOURS,
  parseInboundEvent,
  windowClosesAt,
  isWithinWindow,
  draftPolicy,
  buildTriageTitle,
} from "@/lib/triage";

const NOW = new Date("2026-09-04T12:00:00.000Z");

function settings(over: Record<string, unknown> = {}) {
  return {
    triageEnabled: true,
    knowledgeBlock: "SERVICES REFERENCE — A1 from 3,000.",
    knowledgeReviewedAt: new Date("2026-09-01T00:00:00.000Z"),
    nameableProjects: ["Azerotech — repair shop site and admin panel"],
    holdingText: "Thanks for messaging! I'll get back to you shortly.",
    demoSiteUrls: [{ packageKey: "A1", url: "https://a1.example" }],
    ...over,
  } as Parameters<typeof draftPolicy>[0];
}

describe("parseInboundEvent", () => {
  const valid = {
    mid: "m_123",
    conversationId: "c_1",
    senderName: "Ana",
    text: "magkano po ang website?",
    sentAt: "2026-09-04T11:55:00.000Z",
  };

  it("accepts a well-formed event", () => {
    expect(parseInboundEvent(valid)).toEqual({ ...valid, sentAt: new Date(valid.sentAt) });
  });

  it("rejects a missing message id, because it is the dedup key", () => {
    expect(parseInboundEvent({ ...valid, mid: undefined })).toBeNull();
  });

  it("rejects an unparseable timestamp rather than defaulting to now", () => {
    // Defaulting to now would silently extend a window that has already closed.
    expect(parseInboundEvent({ ...valid, sentAt: "not-a-date" })).toBeNull();
  });

  it("tolerates a missing sender name — unlinked conversations have none", () => {
    const parsed = parseInboundEvent({ ...valid, senderName: undefined });
    expect(parsed).not.toBeNull();
    expect(parsed?.senderName).toBeUndefined();
  });

  it("truncates an overlong message rather than rejecting it", () => {
    const parsed = parseInboundEvent({ ...valid, text: "x".repeat(9000) });
    expect(parsed?.text.length).toBe(4000);
  });
});

describe("the 24-hour window", () => {
  it("closes exactly 24 hours after the message was sent", () => {
    const sent = new Date("2026-09-04T11:00:00.000Z");
    expect(windowClosesAt(sent).toISOString()).toBe("2026-09-05T11:00:00.000Z");
    expect(WINDOW_HOURS).toBe(24);
  });

  it("is open at 23 hours and closed at 25", () => {
    const sent = new Date(NOW.getTime() - 23 * 3600_000);
    expect(isWithinWindow(NOW, sent)).toBe(true);
    const old = new Date(NOW.getTime() - 25 * 3600_000);
    expect(isWithinWindow(NOW, old)).toBe(false);
  });

  it("treats the exact boundary as closed", () => {
    const exact = new Date(NOW.getTime() - WINDOW_HOURS * 3600_000);
    expect(isWithinWindow(NOW, exact)).toBe(false);
  });
});

describe("draftPolicy — what may be said", () => {
  it("allows a substantive answer when the block is approved", () => {
    const policy = draftPolicy(settings());
    expect(policy.mayAnswer).toBe(true);
    expect(policy.withheldReason).toBeUndefined();
  });

  it("WITHHOLDS the answer entirely when the block is unapproved", () => {
    // The block states his real prices. A draft quoting a number he has never
    // read is worse than no draft (design D11).
    const policy = draftPolicy(settings({ knowledgeReviewedAt: null }));
    expect(policy.mayAnswer).toBe(false);
    expect(policy.withheldReason).toMatch(/not approved/i);
  });

  it("withholds the answer when the block is approved but empty", () => {
    const policy = draftPolicy(settings({ knowledgeBlock: "   " }));
    expect(policy.mayAnswer).toBe(false);
  });

  it("passes through no projects and no urls when unset", () => {
    const policy = draftPolicy(settings({ nameableProjects: [], demoSiteUrls: [] }));
    expect(policy.mayAnswer).toBe(true);
    expect(policy.nameableProjects).toEqual([]);
    expect(policy.demoSiteUrls).toEqual([]);
  });

  it("reports triage switched off", () => {
    const policy = draftPolicy(settings({ triageEnabled: false }));
    expect(policy.enabled).toBe(false);
  });
});

describe("buildTriageTitle", () => {
  it("names the sender when known", () => {
    expect(buildTriageTitle("Ana")).toBe("New message from Ana");
  });

  it("says so plainly when the conversation is not linked to a contact", () => {
    expect(buildTriageTitle(undefined)).toBe("New message from an unlinked conversation");
  });
});
