/**
 * Schema-validation tests, DB-less: both validateSync() and validate()
 * exercise required/enum/maxlength rules without a MongoDB connection —
 * neither ever touches a database. validateSync() is deprecated in Mongoose
 * 10, so newer blocks in this file use the async validate() instead; older
 * blocks still use validateSync() and are left as-is.
 */
import { describe, it, expect } from "vitest";
import FollowupDraftApproval from "@/models/approvals/FollowupDraftApproval";
import TriageResponseApproval from "@/models/approvals/TriageResponseApproval";
import ApprovalItem from "@/models/ApprovalItem";
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

describe("P4 — followup-draft payload carries the reply anchor", () => {
  it("accepts a payload with replyToLogId", () => {
    const doc = new FollowupDraftApproval({
      ...validItem(),
      payload: { ...validPayload, replyToLogId: "64b7f0c2e1a2b3c4d5e6f700" },
    });
    expect(doc.validateSync()).toBeUndefined();
  });

  it("rejects an over-length replyToLogId", () => {
    const doc = new FollowupDraftApproval({
      ...validItem(),
      payload: { ...validPayload, replyToLogId: "x".repeat(65) },
    });
    expect(doc.validateSync()?.errors["payload.replyToLogId"]).toBeDefined();
  });

  it("keeps replyToLogId optional — P3 seeds have none", () => {
    const doc = new FollowupDraftApproval(validItem());
    expect(doc.validateSync()).toBeUndefined();
  });

  it("carries replyToLogId on editedPayload too, so an edit cannot lose the anchor", () => {
    const doc = new FollowupDraftApproval({
      ...validItem(),
      editedPayload: { ...validPayload, replyToLogId: "64b7f0c2e1a2b3c4d5e6f700" },
    });
    expect(doc.validateSync()).toBeUndefined();
  });
});

describe("P4 — the action state machine", () => {
  it.each(["pending", "running", "done", "failed", "needs_verification"])(
    "accepts actionStatus %s",
    (s) => {
      const doc = new FollowupDraftApproval({ ...validItem(), actionStatus: s });
      expect(doc.validateSync()?.errors["actionStatus"]).toBeUndefined();
    }
  );

  it("rejects an unknown actionStatus", () => {
    const doc = new FollowupDraftApproval({ ...validItem(), actionStatus: "maybe" });
    expect(doc.validateSync()?.errors["actionStatus"]).toBeDefined();
  });

  it("accepts actionStartedAt — the claim timestamp the stale sweep reads", () => {
    const doc = new FollowupDraftApproval({ ...validItem(), actionStartedAt: new Date() });
    expect(doc.validateSync()).toBeUndefined();
  });
});

describe("P4 — the idempotency index", () => {
  // P4-e/P4-f: declared on the BASE schema even though the path lives on the
  // discriminator, because sync-indexes.mts iterates base models and
  // syncIndexes() drops any index it does not see declared there.
  function indexOn(path: string) {
    return ApprovalItem.schema
      .indexes()
      .find(([keys]) => Object.prototype.hasOwnProperty.call(keys, path));
  }

  it("declares a unique partial index on payload.replyToLogId scoped to pending", () => {
    const found = indexOn("payload.replyToLogId");
    expect(found).toBeDefined();
    const [, options] = found!;
    expect(options.unique).toBe(true);
    expect(options.partialFilterExpression).toEqual({
      status: "pending",
      "payload.replyToLogId": { $exists: true },
    });
  });

  it("is NOT declared on the discriminator schema", () => {
    const onDiscriminator = FollowupDraftApproval.schema
      .indexes()
      .find(([keys]) => Object.prototype.hasOwnProperty.call(keys, "payload.replyToLogId"));
    expect(onDiscriminator).toBeUndefined();
  });

  it("declares the stale-action sweep index", () => {
    expect(indexOn("actionStatus")).toBeDefined();
  });
});

describe("P4 — AgentRun counts", () => {
  it("defaults every count to zero", () => {
    const run = new AgentRun({ agent: "chaser", startedAt: new Date(), durationMs: 1, ok: true });
    expect(run.validateSync()).toBeUndefined();
    expect(run.counts.itemsCreated).toBe(0);
    expect(run.counts.itemsSkipped).toBe(0);
    expect(run.counts.itemsFailed).toBe(0);
  });

  it("rejects a negative skip count", () => {
    const run = new AgentRun({
      agent: "chaser",
      startedAt: new Date(),
      durationMs: 1,
      ok: true,
      counts: { itemsCreated: 0, itemsProcessed: 0, itemsSkipped: -1, itemsFailed: 0 },
    });
    expect(run.validateSync()?.errors["counts.itemsSkipped"]).toBeDefined();
  });
});

describe("TriageResponseApproval", () => {
  it("registers under the triage-response discriminator key", async () => {
    expect(TriageResponseApproval.baseModelName).toBe("ApprovalItem");
    const doc = new TriageResponseApproval({
      source: "triage",
      title: "New message from Ana",
      summary: "Asked how much a website costs",
      payload: {
        conversationId: "c1",
        messageId: "m1",
        senderName: "Ana",
        inboundText: "magkano po ang website?",
        holdingText: "Thanks for messaging!",
        answerText: "A1 starts at 3,000.",
      },
    });
    expect(doc.type).toBe("triage-response");
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it("drops an unknown payload field rather than storing it", async () => {
    // strict:true is what stops a drifting payload shape, which is the mistake
    // ShikksTracker's Mixed run-summary made and this repo's rules exist to
    // avoid. strict:true DROPS an unrecognized field silently — it does not
    // reject it; "throw" is what rejects.
    const doc = new TriageResponseApproval({
      source: "triage",
      title: "t",
      summary: "s",
      payload: { conversationId: "c", messageId: "m", inboundText: "i", holdingText: "h", nope: 1 },
    });
    // Asserting the whole shape at once, rather than just that `nope` is
    // absent, proves BOTH drop-unknown and keep-known in one line — a schema
    // that dropped every field (or misspelled a field name) would also leave
    // `payload.nope` undefined, so that narrower assertion alone would not
    // have caught it.
    const saved = doc.toObject<{ payload: Record<string, unknown> }>();
    expect(saved.payload).toEqual({
      conversationId: "c",
      messageId: "m",
      inboundText: "i",
      holdingText: "h",
    });
  });

  it("requires the fields a send cannot happen without", async () => {
    const doc = new TriageResponseApproval({
      source: "triage",
      title: "t",
      summary: "s",
      payload: { inboundText: "i", holdingText: "h" },
    });
    // Pin both error paths individually — conversationId and messageId are
    // what the send call routes on, so a dropped `required: true` on either
    // one must fail this test even though the other still throws on its own.
    let error: { errors: Record<string, unknown> } | undefined;
    try {
      await doc.validate();
    } catch (e) {
      error = e as { errors: Record<string, unknown> };
    }
    expect(error?.errors["payload.conversationId"]).toBeDefined();
    expect(error?.errors["payload.messageId"]).toBeDefined();
  });
});
