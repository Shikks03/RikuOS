/**
 * Schema-validation tests, DB-less: both validateSync() and validate()
 * exercise required/enum/maxlength rules without a MongoDB connection —
 * neither ever touches a database. validateSync() is deprecated in Mongoose
 * 10, so newer blocks in this file use the async validate() instead; older
 * blocks still use validateSync() and are left as-is.
 */
import { describe, it, expect } from "vitest";
import FollowupDraftApproval from "@/models/approvals/FollowupDraftApproval";
import ApprovalItem from "@/models/ApprovalItem";
import AgentRun from "@/models/AgentRun";
import PushSubscription from "@/models/PushSubscription";
import OsSettings from "@/models/OsSettings";
import { PERSONAL_LAYOUT_DEFAULT } from "@/lib/personalLayout";
import HealthSnapshot, { HEALTH_SNAPSHOT_ID } from "@/models/HealthSnapshot";

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

  it("defaults skipped to false, not required, and adds no index", () => {
    const doc = new AgentRun({ agent: "dispatcher", startedAt: new Date(), durationMs: 1, ok: true });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.skipped).toBe(false);
    expect(AgentRun.schema.path("skipped").isRequired).toBeFalsy();
    const indexed = AgentRun.schema.indexes().some(([fields]) => "skipped" in fields);
    expect(indexed).toBe(false);
    expect(AgentRun.schema.indexes()).toHaveLength(2);
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

describe("OsSettings — layers and personalLayout (P10b)", () => {
  const layout = () => [
    [{ tile: "today", span: 8 }, { tile: "todos", span: 4 }],
    [{ tile: "layers", span: 3 }, { tile: "push", span: 8 }],
    [{ tile: "week", span: 12 }],
    [{ tile: "done", span: 12 }],
  ];
  const errorPaths = (doc: InstanceType<typeof OsSettings>) =>
    Object.keys(doc.validateSync()?.errors ?? {});
  /**
   * The async validator. validateSync() does NOT descend into the entries of
   * an array of document arrays - measured: a `{tile: "weather", span: 13}`
   * entry passes it silently - while validate() reports
   * `personalLayout.0.0.tile` and `.span`. So the entry-level cases use this.
   */
  const asyncErrorPaths = async (doc: InstanceType<typeof OsSettings>) => {
    try {
      await doc.validate();
      return [];
    } catch (e) {
      return Object.keys((e as { errors?: Record<string, unknown> }).errors ?? {});
    }
  };

  it("defaults to no layers and the default layout, a fresh copy per document", () => {
    const a = new OsSettings({});
    const b = new OsSettings({});
    expect(a.validateSync()).toBeUndefined();
    expect(a.layers).toHaveLength(0);
    expect(a.toObject().personalLayout).toEqual(PERSONAL_LAYOUT_DEFAULT);
    a.personalLayout[0][0].span = 2;
    expect(b.personalLayout[0][0].span).toBe(8);
    expect(PERSONAL_LAYOUT_DEFAULT[0][0].span).toBe(8);
  });

  it("accepts a valid layer and layout, and defaults enabled to true", () => {
    const doc = new OsSettings({
      layers: [{ calendarId: "primary", name: "Me" }],
      personalLayout: layout(),
    });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.layers[0].enabled).toBe(true);
  });

  it("async validation accepts the default layout's entries", async () => {
    expect(await asyncErrorPaths(new OsSettings({}))).toEqual([]);
  });

  it("rejects an over-length layer name and calendarId", () => {
    const doc = new OsSettings({
      layers: [{ calendarId: "c".repeat(257), name: "n".repeat(121), enabled: true }],
    });
    expect(errorPaths(doc)).toEqual(expect.arrayContaining(["layers.0.name", "layers.0.calendarId"]));
  });

  it("rejects an eleventh layer", () => {
    const layers = Array.from({ length: 11 }, (_, i) => ({ calendarId: `c${i}`, name: `n${i}`, enabled: true }));
    expect(errorPaths(new OsSettings({ layers }))).toContain("layers");
  });

  it("rejects a span of 13", async () => {
    const l = layout();
    l[2][0].span = 13;
    expect(await asyncErrorPaths(new OsSettings({ personalLayout: l }))).toContain("personalLayout.2.0.span");
  });

  it("rejects three rows", () => {
    expect(errorPaths(new OsSettings({ personalLayout: layout().slice(0, 3) }))).toContain("personalLayout");
  });

  it("rejects an unknown tile", async () => {
    const l = layout();
    l[3][0].tile = "weather";
    expect(await asyncErrorPaths(new OsSettings({ personalLayout: l }))).toContain("personalLayout.3.0.tile");
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

describe("HealthSnapshot", () => {
  it("accepts a valid reading", async () => {
    const doc = new HealthSnapshot({
      checkedAt: new Date("2026-09-05T04:00:00.000Z"),
      sites: [{ name: "Meowchi", up: true, detail: "Meowchi ok" }],
    });
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it("requires checkedAt — a reading with no time is not a reading", async () => {
    const doc = new HealthSnapshot({ sites: [] });
    await expect(doc.validate()).rejects.toThrow(/checkedAt/);
  });

  it("accepts an empty sites array, which is different from no document", async () => {
    const doc = new HealthSnapshot({ checkedAt: new Date(), sites: [] });
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it("bounds the array, per CLAUDE.md", async () => {
    const doc = new HealthSnapshot({
      checkedAt: new Date(),
      sites: Array.from({ length: 21 }, (_, i) => ({
        name: `s${i}`,
        up: true,
        detail: "ok",
      })),
    });
    await expect(doc.validate()).rejects.toThrow(/sites/);
  });

  it("bounds every string", async () => {
    const long = new HealthSnapshot({
      checkedAt: new Date(),
      sites: [{ name: "x".repeat(61), up: true, detail: "ok" }],
    });
    await expect(long.validate()).rejects.toThrow(/name/);

    const longDetail = new HealthSnapshot({
      checkedAt: new Date(),
      sites: [{ name: "ok", up: true, detail: "x".repeat(201) }],
    });
    await expect(longDetail.validate()).rejects.toThrow(/detail/);
  });

  it("carries no TTL — the newest reading must always be present", () => {
    const ttl = HealthSnapshot.schema
      .indexes()
      .filter(([, options]) => (options as { expireAfterSeconds?: number }).expireAfterSeconds !== undefined);
    expect(ttl).toEqual([]);
  });

  it("accepts exactly 20 sites — the ceiling itself, not one under it", async () => {
    const doc = new HealthSnapshot({
      checkedAt: new Date(),
      sites: Array.from({ length: 20 }, (_, i) => ({
        name: `s${i}`,
        up: true,
        detail: "ok",
      })),
    });
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it("accepts a string of exactly the bound in both fields", async () => {
    const doc = new HealthSnapshot({
      checkedAt: new Date(),
      sites: [{ name: "x".repeat(60), up: true, detail: "y".repeat(200) }],
    });
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it("leaves `sites` deliberately not required", () => {
    // In Mongoose 9.9.4 `required: true` on an array does not reject [], so the
    // option would add nothing — and an empty reading is valid anyway: the
    // check ran and watched nothing. This pins the omission as a decision.
    expect(HealthSnapshot.schema.path("sites").isRequired).toBeFalsy();
  });

  it("defaults _id to the one singleton id (R55)", () => {
    const doc = new HealthSnapshot({ checkedAt: new Date(), sites: [] });
    expect(doc._id).toBe(HEALTH_SNAPSHOT_ID);
  });

  it("refuses any other _id, so a second document cannot be written", async () => {
    const doc = new HealthSnapshot({ _id: "other", checkedAt: new Date(), sites: [] });
    await expect(doc.validate()).rejects.toThrow(/_id/);
  });
});
