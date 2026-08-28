import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import type { Model } from "mongoose";
import {
  approvalModelForType,
  buildDecisionUpdate,
  buildExpirySweep,
  parseDecision,
} from "@/lib/queue";
import type { Decision } from "@/lib/queue";
import ApprovalItem from "@/models/ApprovalItem";
import type { IApprovalItemBase } from "@/models/ApprovalItem";
import FollowupDraftApproval from "@/models/approvals/FollowupDraftApproval";
import type { IFollowupDraftPayload } from "@/models/approvals/FollowupDraftApproval";

const payload: IFollowupDraftPayload = {
  contactId: "c1",
  contactName: "Sample Bakery",
  channel: "facebook",
  draftBody: "Original body",
  replySnippet: "Magkano po?",
};

describe("parseDecision", () => {
  it("parses approve", () => {
    const res = parseDecision({ decision: "approve" }, "followup-draft", payload);
    expect(res).toEqual({ ok: true, value: { kind: "approve" } });
  });

  it("parses reject without a note", () => {
    const res = parseDecision({ decision: "reject" }, "followup-draft", payload);
    expect(res).toEqual({ ok: true, value: { kind: "reject", rejectNote: undefined } });
  });

  it("parses reject with a bounded note", () => {
    const res = parseDecision(
      { decision: "reject", rejectNote: "wrong tone" },
      "followup-draft",
      payload
    );
    expect(res).toEqual({ ok: true, value: { kind: "reject", rejectNote: "wrong tone" } });
  });

  it("rejects an over-length rejectNote", () => {
    const res = parseDecision(
      { decision: "reject", rejectNote: "x".repeat(1001) },
      "followup-draft",
      payload
    );
    expect(res.ok).toBe(false);
  });

  it("parses edit into a full editedPayload preserving identity fields", () => {
    const res = parseDecision(
      { decision: "edit", draftBody: "New body" },
      "followup-draft",
      payload
    );
    expect(res.ok).toBe(true);
    if (res.ok && res.value.kind === "edit") {
      expect(res.value.editedPayload.draftBody).toBe("New body");
      expect(res.value.editedPayload.contactId).toBe("c1");
      expect(res.value.editedPayload.contactName).toBe("Sample Bakery");
      expect(res.value.editedPayload.channel).toBe("facebook");
      expect(res.value.editedPayload.replySnippet).toBe("Magkano po?");
    }
  });

  it("rejects edit for a type with no edit support", () => {
    const res = parseDecision({ decision: "edit", draftBody: "x" }, "skill-edit", undefined);
    expect(res.ok).toBe(false);
  });

  it("rejects edit with an empty draftBody", () => {
    const res = parseDecision(
      { decision: "edit", draftBody: "   " },
      "followup-draft",
      payload
    );
    expect(res.ok).toBe(false);
  });

  it("rejects edit with an over-length draftBody", () => {
    const res = parseDecision(
      { decision: "edit", draftBody: "x".repeat(8001) },
      "followup-draft",
      payload
    );
    expect(res.ok).toBe(false);
  });

  it("rejects an unknown decision", () => {
    const res = parseDecision({ decision: "maybe" }, "followup-draft", payload);
    expect(res.ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseDecision(null, "followup-draft", payload).ok).toBe(false);
    expect(parseDecision("approve", "followup-draft", payload).ok).toBe(false);
  });
});

describe("buildDecisionUpdate", () => {
  const now = new Date("2026-08-28T10:00:00Z");

  it("always guards on status pending (the state-machine invariant)", () => {
    const decisions: Decision[] = [
      { kind: "approve" },
      { kind: "reject" },
      { kind: "edit", editedPayload: payload },
    ];
    for (const d of decisions) {
      expect(buildDecisionUpdate(d, now).filter).toEqual({ status: "pending" });
    }
  });

  it("approve sets status approved and decidedAt", () => {
    const { update } = buildDecisionUpdate({ kind: "approve" }, now);
    expect(update).toEqual({ $set: { status: "approved", decidedAt: now } });
  });

  it("edit sets edited_approved and stores the editedPayload", () => {
    const { update } = buildDecisionUpdate({ kind: "edit", editedPayload: payload }, now);
    expect(update).toEqual({
      $set: { status: "edited_approved", decidedAt: now, editedPayload: payload },
    });
  });

  it("reject stores the note only when given", () => {
    expect(buildDecisionUpdate({ kind: "reject" }, now).update).toEqual({
      $set: { status: "rejected", decidedAt: now },
    });
    expect(
      buildDecisionUpdate({ kind: "reject", rejectNote: "off-brand" }, now).update
    ).toEqual({
      $set: { status: "rejected", decidedAt: now, rejectNote: "off-brand" },
    });
  });
});

describe("buildExpirySweep", () => {
  it("matches only pending items whose staleAt has passed", () => {
    const now = new Date("2026-08-28T00:00:00Z");
    const { filter, update } = buildExpirySweep(now);
    // Range operators do not match documents where the field is missing, so
    // items without a staleAt are untouched by design.
    expect(filter).toEqual({ status: "pending", staleAt: { $lte: now } });
    expect(update).toEqual({ $set: { status: "expired", decidedAt: now } });
  });
});

describe("approvalModelForType", () => {
  // These tests pin the trap that makes the resolver necessary. Do not delete
  // them to "simplify" the resolver away — a decide route that writes through
  // the base model loses the human's edit silently.
  it("documents the trap: editedPayload exists only on the discriminator schema", () => {
    expect(ApprovalItem.schema.path("editedPayload")).toBeUndefined();
    expect(FollowupDraftApproval.schema.path("editedPayload")).toBeDefined();
    // Base-schema paths are on both, which is why runApprovalAction's
    // actionStatus updates are safe through the base model.
    expect(ApprovalItem.schema.path("status")).toBeDefined();
    expect(FollowupDraftApproval.schema.path("status")).toBeDefined();
  });

  it("resolves followup-draft to the discriminator model, not the base", () => {
    const model = approvalModelForType("followup-draft");
    expect(model.modelName).toBe("followup-draft");
    expect(model.modelName).not.toBe(ApprovalItem.modelName);
    expect(model.schema.path("editedPayload")).toBeDefined();
  });

  it("falls back to the base model for an unregistered type", () => {
    const model = approvalModelForType("some-unregistered-type");
    expect(model.modelName).toBe(ApprovalItem.modelName);
    expect(model.schema.path("editedPayload")).toBeUndefined();
  });

  it("does not resolve inherited Object.prototype keys as models", () => {
    expect(approvalModelForType("toString").modelName).toBe(ApprovalItem.modelName);
    expect(approvalModelForType("constructor").modelName).toBe(ApprovalItem.modelName);
  });
});

describe("edit survives the guarded write (the invariant the resolver protects)", () => {
  // The three tests above pin the resolver; this one pins the thing that
  // actually matters — that an edit decision, cast for the wire through the
  // resolved model, still carries editedPayload. It is the only test here that
  // exercises Mongoose's update casting, which is where the field was being
  // silently dropped.
  //
  // _castUpdate is Mongoose private API (verified on 9.7.3 and 9.9.4). If a
  // major upgrade breaks this test, re-verify the behaviour before relaxing it:
  // a green suite with a stripped editedPayload is exactly the failure mode
  // this test exists to prevent.
  function castSetKeys(model: Model<IApprovalItemBase>): string[] {
    const { filter, update } = buildDecisionUpdate(
      { kind: "edit", editedPayload: payload },
      new Date()
    );
    const query = model.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(), ...filter }, update);
    const casted = (
      query as unknown as { _castUpdate: (u: unknown) => { $set?: Record<string, unknown> } }
    )._castUpdate(query.getUpdate());
    return Object.keys(casted.$set ?? {});
  }

  it("retains editedPayload when written through the resolved model", () => {
    expect(castSetKeys(approvalModelForType("followup-draft"))).toContain("editedPayload");
  });

  it("negative control: the base model silently drops editedPayload", () => {
    const keys = castSetKeys(ApprovalItem);
    expect(keys).not.toContain("editedPayload");
    // The write still "succeeds" with the other fields — that silence is the bug.
    expect(keys).toEqual(expect.arrayContaining(["status", "decidedAt"]));
  });
});
