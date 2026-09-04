/**
 * The tests that matter most here are the ones pinning what triage must NOT
 * do when it is under-configured. Riku is shipping this before filling in his
 * knowledge block, project list and demo URLs (design D11), so "safe when
 * unconfigured" is the normal operating state for a while, not an edge case.
 */

import { describe, it, expect } from "vitest";
import {
  WINDOW_HOURS,
  INBOUND_TEXT_MAX,
  CONVERSATION_ID_MAX,
  MESSAGE_ID_MAX,
  SENDER_NAME_MAX,
  TITLE_MAX,
  parseInboundEvent,
  windowClosesAt,
  isWithinWindow,
  draftPolicy,
  buildTriageTitle,
  buildTriageSummary,
  type TriageSettingsView,
} from "@/lib/triage";
// Type-only: erased at compile time, so this brings in none of Mongoose's
// runtime side effects. triage.ts cannot import the model itself (it must
// stay import-free — see its file header), so this check lives here instead.
import type { IOsSettings } from "@/models/OsSettings";

const NOW = new Date("2026-09-04T12:00:00.000Z");

// Compile-time only, no runtime effect: fails `tsc` if TriageSettingsView
// drifts from IOsSettings — a field renamed or retyped on OsSettings now
// breaks the build here instead of failing silently at runtime (e.g. a
// draftPolicy call reading `undefined` off a renamed field).
type AssertExtends<A extends B, B> = true;
type _SettingsShapeStillMatchesOsSettings = AssertExtends<
  TriageSettingsView,
  Pick<IOsSettings, keyof TriageSettingsView>
>;

function settings(over: Partial<TriageSettingsView> = {}): TriageSettingsView {
  return {
    triageEnabled: true,
    knowledgeBlock: "SERVICES REFERENCE — A1 from 3,000.",
    knowledgeReviewedAt: new Date("2026-09-01T00:00:00.000Z"),
    nameableProjects: ["Azerotech — repair shop site and admin panel"],
    holdingText: "Thanks for messaging! I'll get back to you shortly.",
    demoSiteUrls: [{ packageKey: "A1", url: "https://a1.example" }],
    ...over,
  };
}

describe("parseInboundEvent", () => {
  const valid = {
    mid: "m_123",
    conversationId: "c_1",
    senderName: "Ana",
    text: "magkano po ang website?",
    sentAt: "2026-09-04T11:55:00.000Z",
  };

  it("accepts a well-formed event", () => {
    expect(parseInboundEvent(valid)).toEqual({ ...valid, sentAt: new Date(valid.sentAt) });
  });

  it("rejects a missing message id, because it is the dedup key", () => {
    expect(parseInboundEvent({ ...valid, mid: undefined })).toBeNull();
  });

  it("rejects an unparseable timestamp rather than defaulting to now", () => {
    // Defaulting to now would silently extend a window that has already closed.
    expect(parseInboundEvent({ ...valid, sentAt: "not-a-date" })).toBeNull();
  });

  it("tolerates a missing sender name — unlinked conversations have none", () => {
    const parsed = parseInboundEvent({ ...valid, senderName: undefined });
    expect(parsed).not.toBeNull();
    expect(parsed?.senderName).toBeUndefined();
  });

  it("collapses an empty-string sender name to undefined, same as missing", () => {
    const parsed = parseInboundEvent({ ...valid, senderName: "" });
    expect(parsed).not.toBeNull();
    expect(parsed?.senderName).toBeUndefined();
  });

  it("truncates an overlong message rather than rejecting it", () => {
    const parsed = parseInboundEvent({ ...valid, text: "x".repeat(9000) });
    expect(parsed?.text.length).toBe(INBOUND_TEXT_MAX);
  });

  it("rejects a whitespace-only body instead of storing an empty card", () => {
    expect(parseInboundEvent({ ...valid, text: "   \n\t  " })).toBeNull();
  });

  it("rejects an over-long conversationId rather than truncating it — truncating would corrupt the dedup key", () => {
    const parsed = parseInboundEvent({
      ...valid,
      conversationId: "c".repeat(CONVERSATION_ID_MAX + 1),
    });
    expect(parsed).toBeNull();
  });

  it("rejects an over-long message id rather than truncating it — truncating would corrupt the send target", () => {
    const parsed = parseInboundEvent({ ...valid, mid: "m".repeat(MESSAGE_ID_MAX + 1) });
    expect(parsed).toBeNull();
  });

  it("clamps an over-long sender name instead of rejecting the event — it is cosmetic", () => {
    const parsed = parseInboundEvent({ ...valid, senderName: "A".repeat(SENDER_NAME_MAX + 50) });
    expect(parsed).not.toBeNull();
    expect(parsed?.senderName?.length).toBe(SENDER_NAME_MAX);
  });

  it("drops unknown extra keys from the parsed result", () => {
    const parsed = parseInboundEvent({ ...valid, extra: "not part of the contract" });
    expect(parsed).toEqual({ ...valid, sentAt: new Date(valid.sentAt) });
  });

  describe("is total: returns null rather than throwing for a non-object body", () => {
    it("null", () => {
      expect(parseInboundEvent(null)).toBeNull();
    });
    it("an array", () => {
      expect(parseInboundEvent([])).toBeNull();
    });
    it("a bare string", () => {
      expect(parseInboundEvent("x")).toBeNull();
    });
    it("a number", () => {
      expect(parseInboundEvent(42)).toBeNull();
    });
    it("undefined", () => {
      expect(parseInboundEvent(undefined)).toBeNull();
    });
  });

  describe("timestamp strictness — new Date() is too lenient to trust directly", () => {
    it("accepts a strict ISO-8601 timestamp", () => {
      const parsed = parseInboundEvent(valid);
      expect(parsed?.sentAt).toEqual(new Date(valid.sentAt));
    });

    it('rejects a bare year ("2026") — new Date("2026") parses but means nothing useful here', () => {
      expect(parseInboundEvent({ ...valid, sentAt: "2026" })).toBeNull();
    });

    it('rejects a non-ISO date string ("Sep 4 2026") — new Date() parses this in the SERVER\'S local zone, so the same string is a different instant on a laptop than on Vercel', () => {
      expect(parseInboundEvent({ ...valid, sentAt: "Sep 4 2026" })).toBeNull();
    });

    it("rejects an epoch-milliseconds string — new Date() would parse it as a date-only string, not as an epoch", () => {
      expect(parseInboundEvent({ ...valid, sentAt: "1757000000000" })).toBeNull();
    });

    it("rejects a parseable-but-insane year outside the sanity bound", () => {
      expect(parseInboundEvent({ ...valid, sentAt: "9999-01-01T00:00:00.000Z" })).toBeNull();
    });
  });
});

describe("the 24-hour window", () => {
  it("closes exactly 24 hours after the message was sent", () => {
    const sent = new Date("2026-09-04T11:00:00.000Z");
    expect(windowClosesAt(sent).toISOString()).toBe("2026-09-05T11:00:00.000Z");
    expect(WINDOW_HOURS).toBe(24);
  });

  it("is open at 23 hours and closed at 25", () => {
    const sent = new Date(NOW.getTime() - 23 * 3600_000);
    expect(isWithinWindow(NOW, sent)).toBe(true);
    const old = new Date(NOW.getTime() - 25 * 3600_000);
    expect(isWithinWindow(NOW, old)).toBe(false);
  });

  it("treats the exact boundary as closed", () => {
    const exact = new Date(NOW.getTime() - WINDOW_HOURS * 3600_000);
    expect(isWithinWindow(NOW, exact)).toBe(false);
  });
});

describe("draftPolicy — what may be said", () => {
  it("allows a substantive answer when the block is approved", () => {
    const policy = draftPolicy(settings());
    expect(policy.mayAnswer).toBe(true);
    expect(policy.withheldReason).toBeUndefined();
  });

  it("WITHHOLDS the answer entirely when the block is unapproved", () => {
    // The block states his real prices. A draft quoting a number he has never
    // read is worse than no draft (design D11).
    const policy = draftPolicy(settings({ knowledgeReviewedAt: null }));
    expect(policy.mayAnswer).toBe(false);
    expect(policy.withheldReason).toMatch(/not approved/i);
  });

  it("never passes the withheld block's text through, even to a caller that forgets to check mayAnswer first", () => {
    const policy = draftPolicy(settings({ knowledgeReviewedAt: null }));
    expect(policy.knowledgeBlock).toBe("");
  });

  it("withholds the answer when the block is approved but empty", () => {
    const policy = draftPolicy(settings({ knowledgeBlock: "   " }));
    expect(policy.mayAnswer).toBe(false);
  });

  it("passes through no projects and no urls when unset", () => {
    const policy = draftPolicy(settings({ nameableProjects: [], demoSiteUrls: [] }));
    expect(policy.mayAnswer).toBe(true);
    expect(policy.nameableProjects).toEqual([]);
    expect(policy.demoSiteUrls).toEqual([]);
  });

  it("reports triage switched off", () => {
    const policy = draftPolicy(settings({ triageEnabled: false }));
    expect(policy.enabled).toBe(false);
  });
});

describe("buildTriageTitle", () => {
  it("names the sender when known", () => {
    expect(buildTriageTitle("Ana")).toBe("New message from Ana");
  });

  it("says so plainly when the conversation is not linked to a contact", () => {
    expect(buildTriageTitle(undefined)).toBe("New message from an unlinked conversation");
  });

  it("clamps a 200-char sender name so the assembled title never exceeds TITLE_MAX — an over-length one would otherwise throw a ValidationError inside the webhook handler (TriageResponseApproval's title maxlength mirrors TITLE_MAX)", () => {
    const senderName = "A".repeat(SENDER_NAME_MAX); // the max parseInboundEvent allows through
    const title = buildTriageTitle(senderName);
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(title.startsWith("New message from A")).toBe(true);
  });
});

describe("buildTriageSummary", () => {
  it("passes short single-line text through unchanged", () => {
    expect(buildTriageSummary("magkano po ang website?")).toBe("magkano po ang website?");
  });

  it("collapses newlines and repeated whitespace into single spaces — it is not just the first line", () => {
    expect(buildTriageSummary("hi po\n\ngusto ko\tmag  website")).toBe(
      "hi po gusto ko mag website"
    );
  });

  it("trims leading and trailing whitespace", () => {
    expect(buildTriageSummary("   hello there   ")).toBe("hello there");
  });

  it("passes exactly 200 characters through unclipped", () => {
    const exact = "a".repeat(200);
    expect(buildTriageSummary(exact)).toBe(exact);
    expect(buildTriageSummary(exact).length).toBe(200);
  });

  it("clips at 201 characters and appends an ellipsis", () => {
    const over = "a".repeat(201);
    const summary = buildTriageSummary(over);
    expect(summary).toBe(`${"a".repeat(199)}…`);
    expect(summary.length).toBe(200);
  });
});
