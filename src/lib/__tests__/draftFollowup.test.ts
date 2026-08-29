/**
 * The Anthropic call itself is not unit-tested (it is a network call to a
 * non-deterministic service). What IS tested is everything around it: the
 * prompt the model receives, and the validation of what comes back — the two
 * places a silent regression would produce a bad message to a real lead.
 */
import { describe, it, expect } from "vitest";
import {
  buildFollowupUserMessage,
  systemPromptFor,
  parseDraftToolInput,
  FOLLOWUP_MAX_BODY,
} from "@/lib/draftFollowup";
import type { AttentionItem } from "@/lib/stApi";

const item: AttentionItem = {
  contactId: "c1",
  businessName: "Sample Bakery",
  contactName: "Ana",
  channel: "email",
  repliedAt: "2026-08-25T02:00:00.000Z",
  replySnippet: "Magkano po ang website?",
  lastOutboundBody: "Hi po, saw your bakery page and had an idea for the menu.",
  keyPoints: "Runs a small bakery in Cavite; posts daily on Facebook.",
  offerSummary: "One-page site with menu and contact form, PHP 8k-12k.",
  toneNotes: "Casual, warm, Taglish welcome.",
  stage: 1,
  replyToLogId: "l1",
};

const now = new Date("2026-08-29T02:00:00.000Z");

describe("buildFollowupUserMessage", () => {
  const msg = buildFollowupUserMessage(item, now);

  it("includes everything needed to draft without a second API call", () => {
    expect(msg).toContain("Sample Bakery");
    expect(msg).toContain("Ana");
    expect(msg).toContain("Magkano po ang website?");
    expect(msg).toContain("saw your bakery page");
    expect(msg).toContain("small bakery in Cavite");
    expect(msg).toContain("PHP 8k-12k");
    expect(msg).toContain("Casual, warm, Taglish welcome.");
  });

  it("states how long the lead has been waiting", () => {
    expect(msg).toContain("4 days ago");
  });

  it("handles every nullable field without printing 'null'", () => {
    const bare = buildFollowupUserMessage(
      {
        ...item,
        contactName: null,
        replySnippet: null,
        lastOutboundBody: null,
        offerSummary: null,
        toneNotes: null,
      },
      now
    );
    expect(bare).not.toContain("null");
    expect(bare).toContain("Sample Bakery");
  });

  it("bounds the prompt so a long inbound body cannot blow up the request", () => {
    const huge = buildFollowupUserMessage({ ...item, lastOutboundBody: "x".repeat(50_000) }, now);
    expect(huge.length).toBeLessThan(12_000);
  });
});

describe("systemPromptFor", () => {
  it("uses the DM prompt for facebook — no subject, no sign-off", () => {
    const p = systemPromptFor("facebook");
    expect(p).toMatch(/direct message/i);
    expect(p).toMatch(/60 words/);
  });

  it("uses the email prompt for email", () => {
    expect(systemPromptFor("email")).toMatch(/120 words/);
  });

  it("both prompts carry the anti-AI-tell guardrails", () => {
    for (const channel of ["email", "facebook"] as const) {
      expect(systemPromptFor(channel)).toMatch(/em dashes/);
      expect(systemPromptFor(channel)).toMatch(/assistant-speak/);
    }
  });

  it("both prompts frame this as a REPLY, never as cold outreach", () => {
    for (const channel of ["email", "facebook"] as const) {
      expect(systemPromptFor(channel)).toMatch(/they wrote first|already answered|reply/i);
    }
  });
});

describe("parseDraftToolInput", () => {
  it("accepts a well-formed body", () => {
    expect(parseDraftToolInput({ body: "Hi Ana, salamat sa reply." })).toBe(
      "Hi Ana, salamat sa reply."
    );
  });

  it("trims surrounding whitespace", () => {
    expect(parseDraftToolInput({ body: "  hello  " })).toBe("hello");
  });

  it("rejects a missing body", () => {
    expect(() => parseDraftToolInput({})).toThrow(/body/);
  });

  it("rejects an empty body", () => {
    expect(() => parseDraftToolInput({ body: "   " })).toThrow(/body/);
  });

  it("rejects a non-string body", () => {
    expect(() => parseDraftToolInput({ body: 42 })).toThrow(/body/);
  });

  it("rejects a body over the payload's schema bound", () => {
    expect(() => parseDraftToolInput({ body: "x".repeat(FOLLOWUP_MAX_BODY + 1) })).toThrow(
      /too long/
    );
  });

  it("rejects a null input", () => {
    expect(() => parseDraftToolInput(null)).toThrow();
  });
});
