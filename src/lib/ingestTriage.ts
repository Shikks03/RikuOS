/**
 * ingestTriage.ts — turns one forwarded inbound message into a decision.
 *
 * Pure apart from the injected drafter, so every branch below is testable
 * without a database, a network or a clock.
 *
 * The ordering is deliberate: the cheap, certain checks run before the
 * expensive uncertain one. Triage being off, or the window already being
 * closed, are both knowable without spending an API call.
 */

import {
  buildTriageSummary,
  buildTriageTitle,
  isWithinWindow,
  windowClosesAt,
  type DraftPolicy,
  type InboundEvent,
} from "@/lib/triage";
import type { ITriageResponsePayload } from "@/models/approvals/TriageResponseApproval";

export type IngestDecision =
  | { action: "skip"; reason: string }
  | {
      action: "create";
      title: string;
      summary: string;
      staleAt: Date;
      payload: ITriageResponsePayload;
    };

export type Drafter = (inboundText: string, policy: DraftPolicy) => Promise<string | null>;

export async function decideIngest(
  now: Date,
  event: InboundEvent,
  policy: DraftPolicy,
  draft: Drafter
): Promise<IngestDecision> {
  if (!policy.enabled) {
    return { action: "skip", reason: "Triage is switched off." };
  }

  if (!isWithinWindow(now, event.sentAt)) {
    // Nothing can be sent, so an item would be a card Riku cannot act on.
    return { action: "skip", reason: "The 24-hour reply window has already closed." };
  }

  let answerText: string | undefined;
  let answerWithheldReason: string | undefined;

  if (!policy.mayAnswer) {
    answerWithheldReason = policy.withheldReason ?? "Services info not approved yet.";
  } else {
    try {
      const drafted = await draft(event.text, policy);
      if (drafted && drafted.trim().length > 0) {
        answerText = drafted;
      } else {
        answerWithheldReason = "The reply could not be drafted — send the holding reply.";
      }
    } catch {
      // A drafting outage costs a better draft, never the window. The holding
      // reply is a template and is always present, so Riku can still answer in
      // one tap.
      answerWithheldReason = "The reply could not be drafted — send the holding reply.";
    }
  }

  return {
    action: "create",
    title: buildTriageTitle(event.senderName),
    summary: buildTriageSummary(event.text),
    staleAt: windowClosesAt(event.sentAt),
    payload: {
      conversationId: event.conversationId,
      messageId: event.mid,
      senderName: event.senderName,
      inboundText: event.text,
      holdingText: policy.holdingText,
      answerText,
      answerWithheldReason,
    },
  };
}
