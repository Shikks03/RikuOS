/**
 * draftChannels.ts — the closed set of channels the chaser drafts for.
 *
 * The `FollowupDraftApproval` schema's `enum` and the chaser's
 * `isSupportedChannel` type guard both read this list, so the database bound
 * and the logic layer's guard can never drift apart.
 *
 * THIS FILE MUST STAY IMPORT-FREE — a leaf. It used to live in the model, and
 * a value import of the model from a view model registers Mongoose models on
 * the global instance, which makes "testable without a database" false at the
 * module-graph level (R52).
 */

export const DRAFT_CHANNELS = ["email", "facebook"] as const;
export type DraftChannel = (typeof DRAFT_CHANNELS)[number];
