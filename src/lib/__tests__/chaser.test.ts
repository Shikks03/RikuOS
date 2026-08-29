import { describe, it, expect } from "vitest";
import {
  planChaserRun,
  buildApprovalInput,
  isSupportedChannel,
  CHASER_MAX_PER_RUN,
  CHASER_STALE_DAYS,
} from "@/lib/chaser";
import type { AttentionItem } from "@/lib/stApi";

function lead(over: Partial<AttentionItem> = {}): AttentionItem {
  return {
    contactId: "c1",
    businessName: "Sample Bakery",
    contactName: "Ana",
    channel: "email",
    repliedAt: "2026-08-25T02:00:00.000Z",
    replySnippet: "Magkano po ang website?",
    lastOutboundBody: "Hi po!",
    keyPoints: "Small bakery in Cavite.",
    offerSummary: "One-page site.",
    toneNotes: "Casual.",
    stage: 1,
    replyToLogId: "l1",
    ...over,
  };
}

describe("isSupportedChannel", () => {
  it.each(["email", "facebook"])("accepts %s", (c) => {
    expect(isSupportedChannel(c)).toBe(true);
  });

  it.each(["instagram", "phone", "", "EMAIL", "telegram"])("rejects %s", (c) => {
    expect(isSupportedChannel(c)).toBe(false);
  });
});

describe("planChaserRun", () => {
  it("drafts a clean lead", () => {
    const plan = planChaserRun([lead()], new Set(), CHASER_MAX_PER_RUN);
    expect(plan.toDraft).toHaveLength(1);
    expect(plan.skipped).toHaveLength(0);
  });

  it("skips unsupported channels and says why (P4-a: counted, never silent)", () => {
    const plan = planChaserRun(
      [lead({ contactId: "c2", channel: "instagram" }), lead({ contactId: "c3", channel: "phone" })],
      new Set(),
      CHASER_MAX_PER_RUN
    );
    expect(plan.toDraft).toHaveLength(0);
    expect(plan.skipped).toEqual([
      { contactId: "c2", reason: "unsupported-channel" },
      { contactId: "c3", reason: "unsupported-channel" },
    ]);
  });

  it("skips a lead whose anchor already has a live queue item", () => {
    const plan = planChaserRun([lead()], new Set(["l1"]), CHASER_MAX_PER_RUN);
    expect(plan.toDraft).toHaveLength(0);
    expect(plan.skipped).toEqual([{ contactId: "c1", reason: "already-queued" }]);
  });

  it("skips a lead with no reply anchor (P4-d: it is required)", () => {
    const plan = planChaserRun([lead({ replyToLogId: "" })], new Set(), CHASER_MAX_PER_RUN);
    expect(plan.skipped).toEqual([{ contactId: "c1", reason: "missing-anchor" }]);
  });

  it("caps the run and counts the overflow as skipped", () => {
    const leads = Array.from({ length: 8 }, (_, i) =>
      lead({ contactId: `c${i}`, replyToLogId: `l${i}` })
    );
    const plan = planChaserRun(leads, new Set(), 3);
    expect(plan.toDraft).toHaveLength(3);
    expect(plan.skipped).toHaveLength(5);
    expect(plan.skipped.every((s) => s.reason === "over-cap")).toBe(true);
  });

  it("deduplicates two items sharing one anchor within a single run", () => {
    const plan = planChaserRun(
      [lead(), lead({ contactId: "c9" })],
      new Set(),
      CHASER_MAX_PER_RUN
    );
    expect(plan.toDraft).toHaveLength(1);
    expect(plan.skipped).toEqual([{ contactId: "c9", reason: "already-queued" }]);
  });

  it("returns an empty plan for an empty feed", () => {
    expect(planChaserRun([], new Set(), CHASER_MAX_PER_RUN)).toEqual({ toDraft: [], skipped: [] });
  });
});

describe("buildApprovalInput", () => {
  const now = new Date("2026-08-29T02:00:00.000Z");
  const built = buildApprovalInput(lead(), "Salamat sa reply po!", now);

  it("attributes the item to the chaser", () => {
    expect(built.source).toBe("chaser");
  });

  it("titles the card with the business name", () => {
    expect(built.title).toContain("Sample Bakery");
    expect(built.title.length).toBeLessThanOrEqual(200);
  });

  it("summarises how long they have waited", () => {
    expect(built.summary).toContain("4 days");
    expect(built.summary.length).toBeLessThanOrEqual(2000);
  });

  it("carries the anchor, the channel and the generated body", () => {
    expect(built.payload.replyToLogId).toBe("l1");
    expect(built.payload.channel).toBe("email");
    expect(built.payload.draftBody).toBe("Salamat sa reply po!");
    expect(built.payload.contactId).toBe("c1");
  });

  it("never sets draftSubject — ShikksTracker derives Re: from the anchor", () => {
    expect(built.payload.draftSubject).toBeUndefined();
  });

  it("falls back to the business name when the contact has no personal name", () => {
    const b = buildApprovalInput(lead({ contactName: null }), "x", now);
    expect(b.payload.contactName).toBe("Sample Bakery");
  });

  it("sets staleAt so a forgotten draft expires instead of lingering", () => {
    const expected = now.getTime() + CHASER_STALE_DAYS * 24 * 60 * 60 * 1000;
    expect(built.staleAt.getTime()).toBe(expected);
  });

  it("bounds every string against its schema maxlength", () => {
    const b = buildApprovalInput(
      lead({ businessName: "B".repeat(400), replySnippet: "r".repeat(4000) }),
      "x",
      now
    );
    expect(b.title.length).toBeLessThanOrEqual(200);
    expect(b.summary.length).toBeLessThanOrEqual(2000);
    expect(b.payload.contactName.length).toBeLessThanOrEqual(200);
    expect((b.payload.replySnippet ?? "").length).toBeLessThanOrEqual(2000);
  });
});
