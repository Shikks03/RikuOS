/**
 * Schema-validation tests, DB-less: validateSync() exercises required/enum/
 * maxlength rules without a MongoDB connection.
 */
import { describe, it, expect } from "vitest";
import FollowupDraftApproval from "@/models/approvals/FollowupDraftApproval";
import AgentRun from "@/models/AgentRun";
import PushSubscription from "@/models/PushSubscription";
import OsSettings from "@/models/OsSettings";

const validPayload = {
  contactId: "c1",
  contactName: "Sample Bakery",
  channel: "facebook",
  draftBody: "Hi po!",
};

function validItem() {
  return {
    source: "manual",
    title: "Follow up: Sample Bakery",
    summary: "Replied, no answer yet.",
    payload: validPayload,
  };
}

describe("ApprovalItem / followup-draft discriminator", () => {
  it("accepts a valid item and defaults status + actionStatus to pending", () => {
    const doc = new FollowupDraftApproval(validItem());
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.status).toBe("pending");
    expect(doc.actionStatus).toBe("pending");
    expect(doc.type).toBe("followup-draft");
  });

  it("rejects a missing payload", () => {
    const { payload: _payload, ...rest } = validItem();
    const doc = new FollowupDraftApproval(rest);
    expect(doc.validateSync()?.errors["payload"]).toBeDefined();
  });

  it("rejects an unknown source", () => {
    const doc = new FollowupDraftApproval({ ...validItem(), source: "skynet" });
    expect(doc.validateSync()?.errors["source"]).toBeDefined();
  });

  it("rejects an unknown channel in the payload", () => {
    const doc = new FollowupDraftApproval({
      ...validItem(),
      payload: { ...validPayload, channel: "telegram" },
    });
    expect(doc.validateSync()?.errors["payload.channel"]).toBeDefined();
  });

  it("rejects an over-length draftBody", () => {
    const doc = new FollowupDraftApproval({
      ...validItem(),
      payload: { ...validPayload, draftBody: "x".repeat(8001) },
    });
    expect(doc.validateSync()?.errors["payload.draftBody"]).toBeDefined();
  });

  it("rejects an unknown status", () => {
    const doc = new FollowupDraftApproval({ ...validItem(), status: "maybe" });
    expect(doc.validateSync()?.errors["status"]).toBeDefined();
  });

  it("accepts a typed editedPayload of the same shape", () => {
    const doc = new FollowupDraftApproval({
      ...validItem(),
      editedPayload: { ...validPayload, draftBody: "Edited body" },
    });
    expect(doc.validateSync()).toBeUndefined();
  });
});

describe("AgentRun", () => {
  it("accepts a valid run and defaults counts to zero", () => {
    const doc = new AgentRun({
      agent: "expiry-sweep",
      startedAt: new Date(),
      durationMs: 12,
      ok: true,
    });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.counts.itemsCreated).toBe(0);
    expect(doc.counts.itemsProcessed).toBe(0);
  });

  it("rejects an unknown agent", () => {
    const doc = new AgentRun({
      agent: "hal9000",
      startedAt: new Date(),
      durationMs: 1,
      ok: true,
    });
    expect(doc.validateSync()?.errors["agent"]).toBeDefined();
  });
});

describe("PushSubscription", () => {
  it("requires endpoint and keys", () => {
    const doc = new PushSubscription({});
    const errs = doc.validateSync()?.errors ?? {};
    expect(errs["endpoint"]).toBeDefined();
    expect(errs["keys"]).toBeDefined();
  });

  it("accepts a valid subscription", () => {
    const doc = new PushSubscription({
      endpoint: "https://push.example/abc",
      keys: { p256dh: "k1", auth: "k2" },
    });
    expect(doc.validateSync()).toBeUndefined();
  });
});

describe("OsSettings", () => {
  it("defaults every agent toggle to off", () => {
    const doc = new OsSettings({});
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.chaserEnabled).toBe(false);
    expect(doc.chaserNDays).toBe(4);
  });

  it("bounds chaserNDays to [1, 30]", () => {
    const doc = new OsSettings({ chaserNDays: 45 });
    expect(doc.validateSync()?.errors["chaserNDays"]).toBeDefined();
  });
});
