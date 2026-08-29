import mongoose, { Document, Model, Schema } from "mongoose";
// Relative, not the "@/" alias, and with an explicit .ts extension on purpose:
// scripts/*.mts run under `node --experimental-strip-types`, which strips types
// but does NOT resolve tsconfig "paths" — an "@/" import here breaks
// `npm run migrate:indexes` and `npm run seed:approval` with ERR_MODULE_NOT_FOUND.
// Keep model-to-model imports relative so both the bundler and plain Node can
// resolve them.
import { AGENTS } from "./AgentRun.ts";

/** Who proposed the item — the agents, plus "manual" for seeded/test items. */
export const APPROVAL_SOURCES = [...AGENTS, "manual"] as const;
export type ApprovalSource = (typeof APPROVAL_SOURCES)[number];

export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "edited_approved",
  "rejected",
  "expired",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/**
 * The action state machine (P4). See the P4 plan's "action-execution failure
 * contract" for the full table — the short version:
 *
 *   pending            nothing has run yet
 *   running            CLAIMED by runApprovalAction; the executor is in flight.
 *                      The claim is what stops an executor running twice.
 *   done               the side effect is confirmed (or already existed: a 409
 *                      from ShikksTracker means the draft is there already)
 *   failed             the server refused; PROVABLY no side effect. The only
 *                      state the Retry affordance accepts.
 *   needs_verification we do NOT know whether the side effect happened. Never
 *                      retried automatically or by a button — a human checks
 *                      ShikksTracker's lane first (CLAUDE.md: never guess).
 */
export const ACTION_STATUSES = [
  "pending",
  "running",
  "done",
  "failed",
  "needs_verification",
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export interface IApprovalItemBase extends Document {
  type: string; // discriminator key; one registered discriminator per item type
  source: ApprovalSource;
  title: string;
  summary: string;
  status: ApprovalStatus;
  staleAt?: Date; // when set, the expiry sweep flips a still-pending item to "expired"
  decidedAt?: Date;
  rejectNote?: string;
  actionStatus: ActionStatus;
  /** Set when the action is claimed; the stale-`running` sweep reads it. */
  actionStartedAt?: Date;
  actionError?: string;
  actionAt?: Date;
  createdAt: Date;
}

/**
 * Base schema. Per-type payloads live on discriminators (typed, bounded
 * fields — never Schema.Types.Mixed, CLAUDE.md). Create items ONLY through a
 * discriminator model so an unregistered type can't enter the collection;
 * query through this base model when the type doesn't matter.
 */
const ApprovalItemSchema = new Schema<IApprovalItemBase>(
  {
    source: { type: String, required: true, enum: APPROVAL_SOURCES },
    title: { type: String, required: true, maxlength: 200 },
    summary: { type: String, required: true, maxlength: 2000 },
    status: { type: String, required: true, enum: APPROVAL_STATUSES, default: "pending" },
    staleAt: { type: Date },
    decidedAt: { type: Date },
    rejectNote: { type: String, maxlength: 1000 },
    actionStatus: { type: String, required: true, enum: ACTION_STATUSES, default: "pending" },
    actionStartedAt: { type: Date },
    actionError: { type: String, maxlength: 2000 },
    actionAt: { type: Date },
  },
  {
    discriminatorKey: "type",
    timestamps: { createdAt: true, updatedAt: false },
    strict: true,
  }
);

// Queue listing: filter by status, newest first.
ApprovalItemSchema.index({ status: 1, createdAt: -1 });
// Expiry sweep: pending items whose staleAt has passed.
ApprovalItemSchema.index({ status: 1, staleAt: 1 });

/**
 * Chaser idempotency (P4-e). At most ONE pending item may exist per reply
 * anchor. ShikksTracker's attention feed only stops proposing a lead once a
 * draft exists THERE — i.e. after Riku approves — so between creation and
 * approval the same lead returns in the feed every single day. The chaser also
 * filters in the query layer; this index is the atomic backstop under it.
 *
 * Scoped to `status: "pending"` on purpose: a rejected or expired item must NOT
 * block a fresh proposal, because Riku rejected the wording, not the lead.
 *
 * DECLARED ON THE BASE SCHEMA even though `payload` lives on the discriminator
 * (P4-f). scripts/sync-indexes.mts iterates base models, and syncIndexes()
 * DROPS any index it does not see declared there — an index declared on a
 * discriminator schema would be created and then dropped on the next migration.
 * Never declare an index on a discriminator schema in this repo.
 */
ApprovalItemSchema.index(
  { "payload.replyToLogId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "pending",
      "payload.replyToLogId": { $exists: true },
    },
  }
);

// Stale-action sweep: claimed actions that never resolved (see buildActionSweep).
ApprovalItemSchema.index({ actionStatus: 1, actionStartedAt: 1 });

// NEVER add a TTL index to this collection — every decision (approve, edit,
// reject, expire) is retained indefinitely as the retro agent's training
// data (ARCHITECTURE.md §3.1, CLAUDE.md).

const ApprovalItem =
  (mongoose.models.ApprovalItem as Model<IApprovalItemBase>) ||
  mongoose.model<IApprovalItemBase>("ApprovalItem", ApprovalItemSchema);

export default ApprovalItem;
