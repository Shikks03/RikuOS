/**
 * queue.ts — Approval Queue logic layer.
 *
 * State machine (every transition out of `pending` happens exactly once,
 * enforced by guarded atomic updates — the filter always re-checks
 * status: "pending"; never read-modify-write):
 *
 *   pending ──approve──► approved          ──action──► actionStatus done|failed
 *   pending ──edit─────► edited_approved   ──action──► actionStatus done|failed
 *   pending ──reject───► rejected
 *   pending ──sweep────► expired            (staleAt in the past)
 *
 * Decisions are never TTL'd or deleted — they are the retro agent's training
 * data (ARCHITECTURE.md §3.1).
 */

import type { Model } from "mongoose";
import ApprovalItem, { IApprovalItemBase } from "@/models/ApprovalItem";
import type { IFollowupDraftPayload } from "@/models/approvals/FollowupDraftApproval";
// Side-effect import: registers the followup-draft discriminator so
// approvalModelForType() below can resolve it. This must be a VALUE import —
// the type-only import above is erased at compile time, which would leave the
// resolver silently falling back to the base model in any bundle that does not
// happen to import the discriminator itself (e.g. a cron route). Every future
// discriminator needs a line here too.
import "@/models/approvals/FollowupDraftApproval";

export type Decision =
  | { kind: "approve" }
  | { kind: "reject"; rejectNote?: string }
  | { kind: "edit"; editedPayload: IFollowupDraftPayload };

export type ParsedDecision =
  | { ok: true; value: Decision }
  | { ok: false; error: string };

/**
 * Pure: validates a decide-route body against an item's type and current
 * payload. Editing is per-type: an edit replaces the message text only —
 * identity fields (contactId, contactName, channel, replySnippet) are copied
 * from the original payload, because Riku edits the message, not the lead.
 */
export function parseDecision(
  body: unknown,
  itemType: string,
  payload: IFollowupDraftPayload | undefined
): ParsedDecision {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;

  switch (b.decision) {
    case "approve":
      return { ok: true, value: { kind: "approve" } };

    case "reject": {
      if (
        b.rejectNote !== undefined &&
        (typeof b.rejectNote !== "string" || b.rejectNote.length > 1000)
      ) {
        return { ok: false, error: "rejectNote must be a string of at most 1000 characters." };
      }
      return {
        ok: true,
        value: { kind: "reject", rejectNote: b.rejectNote as string | undefined },
      };
    }

    case "edit": {
      if (itemType !== "followup-draft" || !payload) {
        return { ok: false, error: `Editing is not supported for type "${itemType}".` };
      }
      if (
        typeof b.draftBody !== "string" ||
        b.draftBody.trim().length === 0 ||
        b.draftBody.length > 8000
      ) {
        return {
          ok: false,
          error: "draftBody must be a non-empty string of at most 8000 characters.",
        };
      }
      if (
        b.draftSubject !== undefined &&
        (typeof b.draftSubject !== "string" || b.draftSubject.length > 300)
      ) {
        return { ok: false, error: "draftSubject must be a string of at most 300 characters." };
      }
      // Explicit field copy, not a spread — the payload may be a Mongoose
      // subdocument, and spreading one drags internal state along.
      //
      // EVERY new IFollowupDraftPayload field must be added here by hand.
      // A field missing from this list is silently dropped the moment Riku
      // edits a draft. replyToLogId in particular is the threading anchor and
      // the 409 dedup key — losing it produces an unthreaded reply that can
      // also be duplicated by a retry.
      const editedPayload: IFollowupDraftPayload = {
        contactId: payload.contactId,
        contactName: payload.contactName,
        channel: payload.channel,
        draftSubject: (b.draftSubject as string | undefined) ?? payload.draftSubject,
        draftBody: b.draftBody,
        replySnippet: payload.replySnippet,
        replyToLogId: payload.replyToLogId,
      };
      return { ok: true, value: { kind: "edit", editedPayload } };
    }

    default:
      return { ok: false, error: 'decision must be one of "approve", "edit", "reject".' };
  }
}

/**
 * Pure: builds the guarded atomic update for a decision. The filter always
 * includes status: "pending" so only an undecided item can transition.
 */
export function buildDecisionUpdate(
  decision: Decision,
  now: Date
): { filter: { status: "pending" }; update: Record<string, unknown> } {
  const filter = { status: "pending" as const };
  switch (decision.kind) {
    case "approve":
      return { filter, update: { $set: { status: "approved", decidedAt: now } } };
    case "edit":
      return {
        filter,
        update: {
          $set: {
            status: "edited_approved",
            decidedAt: now,
            editedPayload: decision.editedPayload,
          },
        },
      };
    case "reject":
      return {
        filter,
        update: {
          $set: {
            status: "rejected",
            decidedAt: now,
            ...(decision.rejectNote !== undefined ? { rejectNote: decision.rejectNote } : {}),
          },
        },
      };
  }
}

/**
 * Pure: the stale-item sweep. Range operators do not match documents where
 * the field is missing, so items without a staleAt are untouched. Stale
 * pending items flip to "expired" — they never linger (CLAUDE.md: never
 * leave an in-flight state behind).
 */
export function buildExpirySweep(now: Date): {
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
} {
  return {
    filter: { status: "pending", staleAt: { $lte: now } },
    update: { $set: { status: "expired", decidedAt: now } },
  };
}

/**
 * Resolves the model an item must be written through.
 *
 * Per-type fields (payload, editedPayload) live on the discriminator schema,
 * never on the strict base schema. A guarded update issued through the base
 * model with a filter that omits the discriminator key has those fields
 * SILENTLY STRIPPED by Mongoose's update casting — the write succeeds and the
 * data is lost. Always write through the discriminator model.
 *
 * Do not "simplify" this away: verified against mongoose 9.7.3 and 9.9.4, a
 * base-model findOneAndUpdate filtered on { _id, status } casts an edit update
 * down to $set { status, decidedAt }, dropping editedPayload with no error.
 * Base-schema paths only (actionStatus, actionError, actionAt) are safe either
 * way — which is why runApprovalAction and the expiry sweeps stay on the base
 * model deliberately (they are cross-type and touch no per-type field).
 *
 * Note: mongoose injects the discriminator key into the filter at exec time, so
 * the effective guard becomes { type, _id, status } — harmless, since `type` is
 * read from the very document being updated and cannot be changed by an update.
 *
 * hasOwn, not a bare index: `discriminators` is a plain object, so a `type` of
 * "toString" would otherwise resolve up the prototype chain to a function with
 * no findOneAndUpdate.
 */
export function approvalModelForType(type: string): Model<IApprovalItemBase> {
  const registered = ApprovalItem.discriminators ?? {};
  if (!Object.hasOwn(registered, type)) return ApprovalItem;
  return registered[type] as Model<IApprovalItemBase>;
}

type ActionExecutor = (item: IApprovalItemBase) => Promise<void>;

/**
 * One executor per discriminator type. P3 registers only followup-draft, as a
 * no-op: the real outward action (POST /api/os/drafts on ShikksTracker) is P4
 * task 4.3 and replaces this function body.
 *
 * Asymmetric failure rule for real executors (CLAUDE.md): a throw BEFORE the
 * external side effect is retry-safe; a failure after — or in an unknown
 * state — parks the item as actionStatus "failed" for the human to verify.
 * Never guess which one happened.
 */
const executors: Record<string, ActionExecutor> = {
  "followup-draft": async () => {
    // No outward action exists in P3 — approving records the decision and
    // completes, so the whole state machine is exercised end to end.
  },
};

/**
 * Runs the action for a just-approved item and records the outcome with a
 * guarded update on actionStatus (pending → done | failed). Callers must
 * have connectDB()'d already. This function never throws — an action failure
 * lands in actionStatus/actionError, not in the HTTP response path.
 */
export async function runApprovalAction(item: IApprovalItemBase): Promise<void> {
  const executor = executors[item.type];
  if (!executor) {
    await ApprovalItem.updateOne(
      { _id: item._id, actionStatus: "pending" },
      {
        $set: {
          actionStatus: "failed",
          actionError: `No action executor registered for type "${item.type}".`,
          actionAt: new Date(),
        },
      }
    );
    return;
  }

  try {
    await executor(item);
    await ApprovalItem.updateOne(
      { _id: item._id, actionStatus: "pending" },
      { $set: { actionStatus: "done", actionAt: new Date() } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ApprovalItem.updateOne(
      { _id: item._id, actionStatus: "pending" },
      {
        $set: {
          actionStatus: "failed",
          actionError: message.slice(0, 2000),
          actionAt: new Date(),
        },
      }
    );
  }
}
