import { Model, Schema } from "mongoose";
// Relative + explicit .ts extension — see the note in ApprovalItem.ts. The
// scripts import this file under `node --experimental-strip-types`, which does
// not resolve the "@/" tsconfig path alias.
// `type` modifier required: strip-types erases annotations without type
// analysis, so an interface imported as a value becomes a runtime import of an
// export that does not exist.
import ApprovalItem, { type IApprovalItemBase } from "../ApprovalItem.ts";
// Same relative + .ts-extension requirement as above — src/models/OsSettings.ts
// already imports from lib/settings.ts this same way, for the same reason.
// HOLDING_TEXT_MAX is defined once in settings.ts (Task 1); importing it here
// rather than redeclaring it is what keeps the two 500s from ever disagreeing.
import { HOLDING_TEXT_MAX } from "../../lib/settings.ts";
// Same requirement again. INBOUND_TEXT_MAX, CONVERSATION_ID_MAX,
// MESSAGE_ID_MAX, SENDER_NAME_MAX and ANSWER_TEXT_MAX are defined once in
// triage.ts (Task 3), which owns them because they also drive real parsing
// decisions there — INBOUND_TEXT_MAX truncates, CONVERSATION_ID_MAX/
// MESSAGE_ID_MAX reject an over-long id outright (truncating either would
// corrupt the dedup key or the send target), SENDER_NAME_MAX clamps a
// cosmetic display name, and ANSWER_TEXT_MAX bounds what draftTriage.ts is
// allowed to hand back — before a payload ever reaches `.create()`. Importing
// them here rather than redeclaring them is what keeps a raised limit
// upstream from ever exceeding these maxlengths and turning a webhook call
// into a 500. triage.ts has zero imports of its own, which is what keeps
// this safe under strip-types.
import {
  INBOUND_TEXT_MAX,
  CONVERSATION_ID_MAX,
  MESSAGE_ID_MAX,
  SENDER_NAME_MAX,
  ANSWER_TEXT_MAX,
} from "../../lib/triage.ts";

/**
 * Payload for an inbound Messenger triage draft.
 *
 * TWO TEXTS, ONE ITEM (design D2). `holdingText` is a template — no model call,
 * no claims — so it survives an Anthropic outage and an unapproved knowledge
 * block. `answerText` is the substantive draft and is ABSENT whenever Riku has
 * not approved the knowledge block (design D11): a draft quoting prices he has
 * never read is worse than no draft. `chosenText` records which one he actually sent,
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
  /**
   * NOTHING WRITES THIS YET. executeTriageResponse (queue.ts) already reads
   * it as the highest-priority send candidate, and the field is documented
   * above as recording which text Riku actually sent — but no code path sets
   * it, because that requires a chooser control on the queue card (picking
   * between the answer and the holding reply) that is explicitly out of
   * scope for the P6 final review (queue-page design work, to be discussed
   * with Riku first — CLAUDE.md S11). Until that ships, the retro agent will
   * find this field undefined on every item, and the executor falls through
   * to answerText/holdingText exactly as designed.
   */
  chosenText?: string;
}

export interface ITriageResponseApproval extends IApprovalItemBase {
  type: "triage-response";
  payload: ITriageResponsePayload;
  editedPayload?: ITriageResponsePayload;
}

const TriageResponsePayloadSchema = new Schema<ITriageResponsePayload>(
  {
    conversationId: { type: String, required: true, maxlength: CONVERSATION_ID_MAX },
    messageId: { type: String, required: true, maxlength: MESSAGE_ID_MAX },
    senderName: { type: String, maxlength: SENDER_NAME_MAX },
    inboundText: { type: String, required: true, maxlength: INBOUND_TEXT_MAX },
    holdingText: { type: String, required: true, maxlength: HOLDING_TEXT_MAX },
    answerText: { type: String, maxlength: ANSWER_TEXT_MAX },
    answerWithheldReason: { type: String, maxlength: 300 },
    chosenText: { type: String, maxlength: ANSWER_TEXT_MAX },
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
