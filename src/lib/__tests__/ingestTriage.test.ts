import { describe, it, expect, vi } from "vitest";
import { decideIngest } from "@/lib/ingestTriage";
import type { DraftPolicy } from "@/lib/triage";

const NOW = new Date("2026-09-04T12:00:00.000Z");

function policy(over: Partial<DraftPolicy> = {}): DraftPolicy {
  return {
    enabled: true,
    mayAnswer: true,
    knowledgeBlock: "A1 from 3,000.",
    nameableProjects: [],
    demoSiteUrls: [],
    holdingText: "Thanks for messaging!",
    ...over,
  };
}

const event = {
  mid: "m1",
  conversationId: "c1",
  senderName: "Ana",
  text: "magkano po?",
  sentAt: new Date("2026-09-04T11:00:00.000Z"),
};

describe("decideIngest", () => {
  it("skips when triage is switched off", async () => {
    const out = await decideIngest(NOW, event, policy({ enabled: false }), async () => "draft");
    expect(out.action).toBe("skip");
    if (out.action !== "skip") throw new Error("expected skip");
    expect(out.reason).toMatch(/off/i);
  });

  it("skips a message whose window has already closed", async () => {
    const old = { ...event, sentAt: new Date("2026-09-03T10:00:00.000Z") };
    const out = await decideIngest(NOW, old, policy(), async () => "draft");
    expect(out.action).toBe("skip");
    if (out.action !== "skip") throw new Error("expected skip");
    expect(out.reason).toMatch(/window/i);
  });

  it("creates an item with both texts when the block is approved", async () => {
    const out = await decideIngest(NOW, event, policy(), async () => "A1 starts at 3,000.");
    expect(out.action).toBe("create");
    if (out.action !== "create") throw new Error("expected create");
    expect(out.payload.holdingText).toBe("Thanks for messaging!");
    expect(out.payload.answerText).toBe("A1 starts at 3,000.");
    expect(out.staleAt.toISOString()).toBe("2026-09-05T11:00:00.000Z");
  });

  it("creates a holding-only item when the block is unapproved, and never calls the model", async () => {
    const draft = vi.fn();
    const out = await decideIngest(
      NOW,
      event,
      policy({ mayAnswer: false, withheldReason: "Services info not approved yet." }),
      draft as never
    );
    expect(draft).not.toHaveBeenCalled();
    if (out.action !== "create") throw new Error("expected create");
    expect(out.payload.answerText).toBeUndefined();
    expect(out.payload.answerWithheldReason).toMatch(/not approved/i);
  });

  it("still creates the item when drafting fails", async () => {
    // A drafting outage must cost a better draft, never the window itself.
    const out = await decideIngest(NOW, event, policy(), async () => null);
    if (out.action !== "create") throw new Error("expected create");
    expect(out.payload.holdingText).toBe("Thanks for messaging!");
    expect(out.payload.answerText).toBeUndefined();
    expect(out.payload.answerWithheldReason).toMatch(/could not be drafted/i);
  });

  it("never lets a drafting error escape", async () => {
    const out = await decideIngest(NOW, event, policy(), async () => {
      throw new Error("anthropic down");
    });
    expect(out.action).toBe("create");
  });
});
