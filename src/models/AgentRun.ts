import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * Every scheduled/triggered job in the system. "expiry-sweep" is the P3 cron
 * that expires stale ApprovalItems; the rest arrive with their own phases
 * (ARCHITECTURE.md §2.3).
 */
export const AGENTS = [
  "chaser",
  "lead-sweep",
  "triage",
  "site-health",
  "outreach-health",
  "dispatcher",
  "retro",
  "watchdog",
  "expiry-sweep",
] as const;
export type Agent = (typeof AGENTS)[number];

export interface IAgentRunCounts {
  itemsCreated: number;
  itemsProcessed: number;
  /** Candidates deliberately not acted on (P4: wrong channel, already queued, out of time). */
  itemsSkipped: number;
  /** Candidates that were attempted and failed. Never silent (CLAUDE.md). */
  itemsFailed: number;
}

const AgentRunCountsSchema = new Schema<IAgentRunCounts>(
  {
    itemsCreated: { type: Number, required: true, default: 0, min: 0 },
    itemsProcessed: { type: Number, required: true, default: 0, min: 0 },
    itemsSkipped: { type: Number, required: true, default: 0, min: 0 },
    itemsFailed: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false, strict: true }
);

export interface IAgentRun extends Document {
  agent: Agent;
  startedAt: Date;
  durationMs: number;
  ok: boolean;
  counts: IAgentRunCounts;
  error?: string;
}

// No timestamps option: startedAt is the meaningful time and is set
// explicitly by every caller; a createdAt duplicate would just drift from it.
const AgentRunSchema = new Schema<IAgentRun>(
  {
    agent: { type: String, required: true, enum: AGENTS },
    startedAt: { type: Date, required: true },
    durationMs: { type: Number, required: true, min: 0 },
    ok: { type: Boolean, required: true },
    counts: {
      type: AgentRunCountsSchema,
      required: true,
      default: () => ({ itemsCreated: 0, itemsProcessed: 0, itemsSkipped: 0, itemsFailed: 0 }),
    },
    error: { type: String, maxlength: 2000 },
  },
  { strict: true }
);

// TTL 90 days (ARCHITECTURE.md §3.1) — run history is operational, not training data.
AgentRunSchema.index({ startedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });
// Watchdog (P5) reads "latest run per agent".
AgentRunSchema.index({ agent: 1, startedAt: -1 });

const AgentRun =
  (mongoose.models.AgentRun as Model<IAgentRun>) ||
  mongoose.model<IAgentRun>("AgentRun", AgentRunSchema);

export default AgentRun;
