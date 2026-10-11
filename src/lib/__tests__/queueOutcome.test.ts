/**
 * queueOutcome.test.ts — what a decide answer means once the card has left
 * (smooth-feel spec §6; plan deviations 7, 8).
 */
import { describe, it, expect } from "vitest";
import { FILTER_LABEL, QUEUE_LINES, decideResult } from "@/lib/queueOutcome";

const ok = (item: unknown) => ({ kind: "ok", body: { item } }) as const;

describe("decideResult", () => {
  it("an approval whose action finished: nothing more", () => {
    expect(decideResult(ok({ status: "approved", actionStatus: "done" }))).toEqual({ restore: false, top: null });
  });

  it("a reject: nothing more", () => {
    expect(decideResult(ok({ status: "rejected", actionStatus: "pending" }))).toEqual({ restore: false, top: null });
  });

  it("an approval whose draft didn't reach ShikksTracker: the action-failed line, under its filter", () => {
    expect(decideResult(ok({ status: "approved", actionStatus: "failed" }))).toEqual({
      restore: false,
      top: { kind: "action-failed", filter: "approved" },
    });
    expect(decideResult(ok({ status: "edited_approved", actionStatus: "failed" }))).toEqual({
      restore: false,
      top: { kind: "action-failed", filter: "edited_approved" },
    });
  });

  it("an approval that can't be told: the needs-verification line", () => {
    expect(decideResult(ok({ status: "approved", actionStatus: "needs_verification" }))).toEqual({
      restore: false,
      top: { kind: "needs-verification", filter: "approved" },
    });
  });

  it("a 2xx without an item: nothing more (the decision saved)", () => {
    expect(decideResult({ kind: "ok", body: {} })).toEqual({ restore: false, top: null });
  });

  it("a refused decision brings the card back with the door's words", () => {
    const body = { error: "Item is no longer pending (already decided or expired)." };
    expect(decideResult({ kind: "failed", code: null, sentence: "Couldn’t save.", body })).toEqual({
      restore: true,
      reason: "Item is no longer pending (already decided or expired).",
    });
  });

  it("no answer: the couldn't-tell line, and the card stays gone", () => {
    expect(decideResult({ kind: "unknown", sentence: "Couldn’t tell if that saved." })).toEqual({
      restore: false,
      top: { kind: "unknown" },
    });
  });
});

describe("the words (Riku, 2026-10-11)", () => {
  it("read as approved, with the filter's name between lead and tail", () => {
    expect(`${QUEUE_LINES.actionFailed.lead}${FILTER_LABEL.approved}${QUEUE_LINES.actionFailed.tail}`).toBe(
      "Approved, but the draft didn’t reach ShikksTracker. It’s under Approved, with a retry.",
    );
    expect(
      `${QUEUE_LINES.needsVerification.lead}${FILTER_LABEL.approved}${QUEUE_LINES.needsVerification.tail}`,
    ).toBe(
      "Approved, but I can’t tell if the draft reached ShikksTracker. It’s under Approved. Check there before doing anything else.",
    );
    expect(QUEUE_LINES.unknown).toBe("Couldn’t tell if that went through.");
    expect(FILTER_LABEL.edited_approved).toBe("Edited approved");
  });
});
