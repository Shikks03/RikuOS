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
import { createDraft, sendMessengerReply } from "@/lib/stApi";
import type { DraftOutcome, DraftRequest, MessengerSendOutcome } from "@/lib/stApi";
import type { IFollowupDraftApproval } from "@/models/approvals/FollowupDraftApproval";
import type { ITriageResponseApproval } from "@/models/approvals/TriageResponseApproval";
// Side-effect import: registers the triage-response discriminator so
// approvalModelForType() below can resolve it. Same reason as the
// FollowupDraftApproval import above — the type-only import is erased at
// compile time and does NOT register anything with Mongoose on its own.
import "@/models/approvals/TriageResponseApproval";

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

/**
 * The result an executor reports. An executor CLASSIFIES; it never guesses and
 * it never decides on its own to retry.
 *
 *   done               the side effect is confirmed, or already existed
 *   failed             the target refused; PROVABLY no side effect. Retryable.
 *   needs_verification unknown. A human checks the far side before anything else
 *                      happens (CLAUDE.md asymmetric-failure rule).
 */
export type ActionResultStatus = "done" | "failed" | "needs_verification";

export interface ActionOutcome {
  status: ActionResultStatus;
  note?: string;
}

/**
 * Compile-time binding between MessengerSendOutcome's status union (stApi.ts,
 * Task 5) and this file's ActionResultStatus. Both Record checks together
 * prove the two literal unions have exactly the same members: the first
 * catches a status MessengerSendOutcome can produce that ActionResultStatus
 * cannot express; the second catches the reverse. Either direction drifting —
 * e.g. a future rename in ApprovalItem's ACTION_STATUSES that isn't mirrored
 * here — fails this line to compile instead of degrading the executor's
 * classification silently.
 */
const _messengerStatusBoundToActionStatus = {
  done: "done",
  failed: "failed",
  needs_verification: "needs_verification",
} satisfies Record<ActionResultStatus, MessengerSendOutcome["status"]> &
  Record<MessengerSendOutcome["status"], ActionResultStatus>;
void _messengerStatusBoundToActionStatus;

type ActionExecutor = (item: IApprovalItemBase) => Promise<ActionOutcome>;

/** A claimed action older than this is presumed interrupted and is swept. */
export const STALE_ACTION_MS = 10 * 60 * 1000;

const ACTION_ERROR_MAX = 2000; // matches ApprovalItem.actionError's maxlength

/**
 * Pure: claims an action for execution.
 *
 * WHY A CLAIM EXISTS. Before P4 the executor ran unconditionally and only the
 * RECORDING of its outcome was guarded, so a second invocation performed the
 * side effect again and then silently failed to record it. That was harmless
 * while the executor was a no-op. From P4 it would be a duplicate message to a
 * real client. The claim is the guard that makes at-most-once real.
 */
export function buildActionClaim(now: Date): {
  filter: { actionStatus: "pending" };
  update: Record<string, unknown>;
} {
  return {
    filter: { actionStatus: "pending" as const },
    update: {
      $set: { actionStatus: "running", actionStartedAt: now },
      // A retry re-enters through `pending`; clear the previous attempt's error
      // so the card never shows a stale reason next to a fresh result.
      $unset: { actionError: "" },
    },
  };
}

/** Pure: records an executor's classified outcome. Guarded on the claim. */
export function buildActionOutcomeUpdate(
  outcome: ActionOutcome,
  now: Date
): { filter: { actionStatus: "running" }; update: Record<string, unknown> } {
  return {
    filter: { actionStatus: "running" as const },
    update: {
      $set: {
        actionStatus: outcome.status,
        actionAt: now,
        ...(outcome.note !== undefined
          ? { actionError: outcome.note.slice(0, ACTION_ERROR_MAX) }
          : {}),
      },
    },
  };
}

/**
 * Pure: the stale-claim sweep. A `running` row means the function died between
 * claiming and recording — the side effect may or may not have landed, which is
 * exactly `needs_verification`. Never `failed`: that state asserts no side
 * effect, and here we have no such proof.
 *
 * CLAUDE.md: never leave an in-flight state behind — a pending/sending-style
 * status needs a sweep that returns stale rows to a safe state with a note.
 */
export function buildActionSweep(
  now: Date,
  staleMs: number = STALE_ACTION_MS
): { filter: Record<string, unknown>; update: Record<string, unknown> } {
  return {
    filter: {
      actionStatus: "running",
      actionStartedAt: { $lte: new Date(now.getTime() - staleMs) },
    },
    update: {
      $set: {
        actionStatus: "needs_verification",
        actionAt: now,
        actionError:
          "The action was interrupted before its result was recorded. It may or may not " +
          "have taken effect — check the contact's lane in ShikksTracker before re-sending.",
      },
    },
  };
}

/**
 * Pure: returns a failed action to `pending` so it can be claimed again.
 * Guarded on `failed` — the ONLY state with proof that no side effect occurred.
 * A needs_verification row can never enter here.
 */
export function buildActionRetry(): {
  filter: { actionStatus: "failed" };
  update: Record<string, unknown>;
} {
  return {
    filter: { actionStatus: "failed" as const },
    update: {
      $set: { actionStatus: "pending" },
      $unset: { actionError: "", actionAt: "", actionStartedAt: "" },
    },
  };
}

/**
 * The one outward action in P4: create the response draft in ShikksTracker.
 *
 * `send` is injected so the mapping is unit-testable without a network call;
 * production passes stApi.createDraft, which is TOTAL (never throws) and
 * returns a classified DraftOutcome.
 *
 * The edited payload wins when Riku edited the draft — that is the version he
 * approved, and it is what must reach the lead.
 */
export async function executeFollowupDraft(
  item: IApprovalItemBase,
  send: (request: DraftRequest) => Promise<DraftOutcome> = createDraft
): Promise<ActionOutcome> {
  const typed = item as unknown as IFollowupDraftApproval;
  const payload = typed.editedPayload ?? typed.payload;

  if (!payload || !payload.contactId || !payload.draftBody) {
    return {
      status: "failed",
      note: "The item has no usable payload; nothing was sent.",
    };
  }

  const request: DraftRequest = {
    contactId: payload.contactId,
    channel: payload.channel,
    body: payload.draftBody,
    // `subject` is deliberately omitted: the attention feed does not expose the
    // anchor's subject, so ShikksTracker derives "Re: <anchor subject>" itself
    // and the email threads correctly. See "Contract gaps" in the P4 plan.
    ...(payload.replyToLogId ? { replyToLogId: payload.replyToLogId } : {}),
  };

  const outcome = await send(request);

  switch (outcome.kind) {
    case "created":
      return { status: "done", note: undefined };
    case "duplicate":
      // The draft is already in ShikksTracker's lane; the desired end state
      // holds. Recording the reason keeps the retry path honest.
      return { status: "done", note: `Already present in ShikksTracker: ${outcome.message}` };
    case "rejected":
      return {
        status: "failed",
        note: `ShikksTracker refused the draft (HTTP ${outcome.status}): ${outcome.message}`,
      };
    case "unknown":
      return { status: "needs_verification", note: outcome.message };
  }
}

/**
 * Sends an approved triage reply.
 *
 * The sender is injected so the classification can be tested without a
 * network — the same shape executeFollowupDraft uses; production passes
 * stApi.sendMessengerReply, which is TOTAL (never throws) and returns a
 * classified MessengerSendOutcome.
 *
 * Text precedence: an edited payload wins over the original (Riku changed it
 * for a reason); within whichever payload is in play, the explicitly chosen
 * text wins, then the answer, then the holding reply. The last fallback is
 * load-bearing, not defensive padding: while the knowledge block is
 * unapproved there IS no answerText, so the holding reply is the entire item
 * and the only thing one tap can send. This feature ships deliberately
 * under-configured, so that is the normal path right now.
 *
 * Refuses to send — returns `failed` with no call to `send` — for a missing
 * payload, missing text, or missing conversation id. A missing payload is
 * the same "nothing to work with" case executeFollowupDraft fails closed on
 * for a missing draftBody/contactId; it is not thrown, because a throw would
 * misclassify a provable no-op as `needs_verification` instead of `failed`.
 */
export async function executeTriageResponse(
  item: IApprovalItemBase,
  send: (
    conversationId: string,
    text: string
  ) => Promise<{ status: ActionResultStatus; note: string }> = sendMessengerReply
): Promise<ActionOutcome> {
  const typed = item as unknown as ITriageResponseApproval;
  const source = typed.editedPayload ?? typed.payload;

  if (!source) {
    return { status: "failed", note: "The item has no usable payload; nothing was sent." };
  }

  const text = source.chosenText ?? source.answerText ?? source.holdingText ?? "";
  if (text.trim().length === 0) {
    return { status: "failed", note: "No text to send — nothing was attempted." };
  }
  if (!source.conversationId) {
    return { status: "failed", note: "No conversation id — nothing was attempted." };
  }

  return send(source.conversationId, text);
}

/**
 * One executor per discriminator type.
 */
const executors: Record<string, ActionExecutor> = {
  "followup-draft": (item) => executeFollowupDraft(item),
  "triage-response": (item) => executeTriageResponse(item),
};

/**
 * Claims, runs, and records the action for a just-approved item.
 *
 * Callers must have connectDB()'d already. This never throws — an action
 * failure lands in actionStatus/actionError, not in the HTTP response path.
 *
 * Note the order: CLAIM FIRST. If the claim is lost, another invocation owns
 * the action and this one returns without running the executor.
 */
export async function runApprovalAction(item: IApprovalItemBase): Promise<void> {
  const claimedAt = new Date();
  const claim = buildActionClaim(claimedAt);
  const claimed = await ApprovalItem.findOneAndUpdate(
    { _id: item._id, ...claim.filter },
    claim.update,
    { new: true }
  );
  if (!claimed) {
    // Already running, already resolved, or parked. Not ours to run.
    return;
  }

  let outcome: ActionOutcome;
  const executor = executors[claimed.type];
  if (!executor) {
    outcome = {
      status: "failed",
      note: `No action executor registered for type "${claimed.type}".`,
    };
  } else {
    try {
      outcome = await executor(claimed);
    } catch (err) {
      // Executors are written to be total, so this is defensive. A throw means
      // we learned nothing about whether the side effect happened.
      const message = err instanceof Error ? err.message : String(err);
      outcome = {
        status: "needs_verification",
        note: `The action threw before reporting a result: ${message}`,
      };
    }
  }

  const record = buildActionOutcomeUpdate(outcome, new Date());
  await ApprovalItem.updateOne({ _id: claimed._id, ...record.filter }, record.update);
}
