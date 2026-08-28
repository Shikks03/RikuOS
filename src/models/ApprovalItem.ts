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

export const ACTION_STATUSES = ["pending", "done", "failed"] as const;
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

// NEVER add a TTL index to this collection — every decision (approve, edit,
// reject, expire) is retained indefinitely as the retro agent's training
// data (ARCHITECTURE.md §3.1, CLAUDE.md).

const ApprovalItem =
  (mongoose.models.ApprovalItem as Model<IApprovalItemBase>) ||
  mongoose.model<IApprovalItemBase>("ApprovalItem", ApprovalItemSchema);

export default ApprovalItem;
