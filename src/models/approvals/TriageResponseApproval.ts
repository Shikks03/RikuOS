import { Model, Schema } from "mongoose";
// Relative + explicit .ts extension — see the note in ApprovalItem.ts. The
// scripts import this file under `node --experimental-strip-types`, which does
// not resolve the "@/" tsconfig path alias.
// `type` modifier required: strip-types erases annotations without type
// analysis, so an interface imported as a value becomes a runtime import of an
// export that does not exist.
import ApprovalItem, { type IApprovalItemBase } from "../ApprovalItem.ts";

/**
 * Payload for an inbound Messenger triage draft.
 *
 * TWO TEXTS, ONE ITEM (design D2). `holdingText` is a template — no model call,
 * no claims — so it survives an Anthropic outage and an unapproved knowledge
 * block. `answerText` is the substantive draft and is ABSENT whenever Riku has
 * not approved the knowledge block (D11): a draft quoting prices he has never
 * read is worse than no draft. `chosenText` records which one he actually sent,
 * which is why one item can carry both without a second status enum.
 *
 * conversationId/messageId are opaque ShikksTracker and Meta identifiers.
 * RikuOS never touches that database; they travel back through the send call.
 */
export interface ITriageResponsePayload {
  conversationId: string;
  messageId: string;
  senderName?: string;
  inboundText: string;
  holdingText: string;
  answerText?: string;
  /** Why the substantive answer is missing, shown on the queue card. */
  answerWithheldReason?: string;
  chosenText?: string;
}

export interface ITriageResponseApproval extends IApprovalItemBase {
  type: "triage-response";
  payload: ITriageResponsePayload;
  editedPayload?: ITriageResponsePayload;
}

const TriageResponsePayloadSchema = new Schema<ITriageResponsePayload>(
  {
    conversationId: { type: String, required: true, maxlength: 64 },
    messageId: { type: String, required: true, maxlength: 128 },
    senderName: { type: String, maxlength: 200 },
    inboundText: { type: String, required: true, maxlength: 4000 },
    holdingText: { type: String, required: true, maxlength: 500 },
    answerText: { type: String, maxlength: 4000 },
    answerWithheldReason: { type: String, maxlength: 300 },
    chosenText: { type: String, maxlength: 4000 },
  },
  { _id: false, strict: true }
);

// editedPayload uses the SAME typed sub-schema, exactly as the chaser's does:
// an edit stores a complete copy, keeping the agent's proposal and Riku's
// approved version separately (the retro agent compares them).
const TriageResponseSchema = new Schema<ITriageResponseApproval>(
  {
    payload: { type: TriageResponsePayloadSchema, required: true },
    editedPayload: { type: TriageResponsePayloadSchema },
  },
  { strict: true }
);

// NO INDEXES HERE. Mongoose would create them on a discriminator schema and
// the next migration would drop them; base-schema indexes serve this model.

// Same hot-reload guard as plain models: calling .discriminator() twice for
// the same key throws, so reuse the registered one when it exists.
const TriageResponseApproval =
  (ApprovalItem.discriminators?.["triage-response"] as Model<ITriageResponseApproval>) ||
  ApprovalItem.discriminator<ITriageResponseApproval>("triage-response", TriageResponseSchema);

export default TriageResponseApproval;
