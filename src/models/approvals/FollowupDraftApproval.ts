import { Model, Schema } from "mongoose";
// Relative + explicit .ts extension — see the note in ApprovalItem.ts. The
// scripts import this file under `node --experimental-strip-types`, which does
// not resolve the "@/" tsconfig path alias.
// `type` modifier required: strip-types erases annotations without type
// analysis, so an interface imported as a value becomes a runtime import of an
// export that does not exist.
import ApprovalItem, { type IApprovalItemBase } from "../ApprovalItem.ts";

export const DRAFT_CHANNELS = ["email", "facebook"] as const;
export type DraftChannel = (typeof DRAFT_CHANNELS)[number];

/**
 * Payload for a chaser follow-up draft. contactId/contactName identify the
 * lead in ShikksTracker (opaque strings here — RikuOS never touches that DB;
 * P4's approve action passes them back through POST /api/os/drafts).
 */
export interface IFollowupDraftPayload {
  contactId: string;
  contactName: string;
  channel: DraftChannel;
  draftSubject?: string; // email only
  draftBody: string;
  replySnippet?: string; // what the lead said — shown in the queue card
  /**
   * The ShikksTracker EmailLog id of the message being answered. Optional
   * because P3-seeded items have none, but the chaser ALWAYS sets it (P4-d):
   * it is the Gmail threading anchor and the dedup key behind ShikksTracker's
   * 409, which is what makes a retried approve action safe.
   */
  replyToLogId?: string;
}

export interface IFollowupDraftApproval extends IApprovalItemBase {
  type: "followup-draft";
  payload: IFollowupDraftPayload;
  editedPayload?: IFollowupDraftPayload;
}

const FollowupDraftPayloadSchema = new Schema<IFollowupDraftPayload>(
  {
    contactId: { type: String, required: true, maxlength: 64 },
    contactName: { type: String, required: true, maxlength: 200 },
    channel: { type: String, required: true, enum: DRAFT_CHANNELS },
    draftSubject: { type: String, maxlength: 300 },
    draftBody: { type: String, required: true, maxlength: 8000 },
    replySnippet: { type: String, maxlength: 2000 },
    replyToLogId: { type: String, maxlength: 64 },
  },
  { _id: false, strict: true }
);

// editedPayload uses the SAME typed sub-schema: an edit stores a complete
// copy, keeping the agent's proposal and Riku's approved version separately
// (the retro agent compares them).
const FollowupDraftSchema = new Schema<IFollowupDraftApproval>(
  {
    payload: { type: FollowupDraftPayloadSchema, required: true },
    editedPayload: { type: FollowupDraftPayloadSchema },
  },
  { strict: true }
);

// Same hot-reload guard as plain models: calling .discriminator() twice for
// the same key throws, so reuse the registered one when it exists.
const FollowupDraftApproval =
  (ApprovalItem.discriminators?.["followup-draft"] as Model<IFollowupDraftApproval>) ||
  ApprovalItem.discriminator<IFollowupDraftApproval>("followup-draft", FollowupDraftSchema);

export default FollowupDraftApproval;
