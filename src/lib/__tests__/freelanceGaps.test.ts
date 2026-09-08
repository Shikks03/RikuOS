/**
 * Block E is "the things nothing else is handling", so the suppression rule is
 * the test that matters: a reply that already carries a live ApprovalItem lives
 * in /queue, and surfacing it here too would make both lists untrustworthy.
 *
 * The snippet's quotation marks are STRAIGHT, exactly as the deck writes them
 * in its Block E rows. Do not "improve" them into curly quotes.
 */
import { describe, it, expect } from "vitest";
import { buildBlockE, GAP_DISPLAY_BOUND } from "@/lib/freelanceGaps";
import type { AttentionItem, OverdueActionItem } from "@/lib/stApi";

const NOW = new Date("2026-09-05T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const CONTACTS_URL = "https://st.example.com/contacts";

function agoIso(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

function reply(over: Partial<AttentionItem> = {}): AttentionItem {
  return {
    contactId: "c1",
    businessName: "Nova Dental",
    contactName: null,
    channel: "email",
    repliedAt: agoIso(4 * HOUR),
    replySnippet: "Do you do logos as well, or just the site?",
    lastOutboundBody: null,
    keyPoints: "",
    offerSummary: null,
    toneNotes: null,
    stage: 1,
    replyToLogId: "log-1",
    ...over,
  };
}

function overdue(over: Partial<OverdueActionItem> = {}): OverdueActionItem {
  return {
    contactId: "c9",
    businessName: "Kiddo Co",
    nextActionAt: agoIso(3 * DAY),
    nextActionNote: "Send the revised proposal",
    ...over,
  };
}

function build(
  replies: AttentionItem[],
  overdues: OverdueActionItem[],
  live: string[] = []
) {
  return buildBlockE({
    now: NOW,
    repliedUnanswered: replies,
    overdueActions: overdues,
    liveAnchorIds: new Set(live),
    contactsBaseUrl: CONTACTS_URL,
  });
}

describe("Block E — the three kinds of row", () => {
  it("kind 1: a reply on a channel nothing drafts for", () => {
    const out = build(
      [
        reply({
          contactId: "c5",
          businessName: "Bella's Cafe",
          channel: "instagram",
          repliedAt: agoIso(2 * DAY),
          replySnippet: "Sounds good, what would the timeline look like?",
          replyToLogId: "log-5",
        }),
      ],
      []
    );
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0]).toEqual({
      id: "reply:log-5",
      kind: "unsupported-channel",
      businessName: "Bella's Cafe",
      href: "https://st.example.com/contacts/c5",
      channel: "Instagram",
      waiting: "replied 2 days ago",
      waitingIsStale: false,
      snippet: '"Sounds good, what would the timeline look like?"',
      reason: "Nothing drafts replies for Instagram.",
    });
  });

  it("kind 2: a reply with no draft in the queue", () => {
    const out = build([reply()], []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0]).toEqual({
      id: "reply:log-1",
      kind: "no-draft",
      businessName: "Nova Dental",
      href: "https://st.example.com/contacts/c1",
      channel: "Email",
      waiting: "replied 4 hours ago",
      waitingIsStale: false,
      snippet: '"Do you do logos as well, or just the site?"',
      reason: "No draft in the queue.",
    });
  });

  it("kind 3: an overdue follow-up, amber, with an EMPTY channel slot", () => {
    const out = build([], [overdue()]);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0]).toEqual({
      id: "overdue:c9",
      kind: "overdue-followup",
      businessName: "Kiddo Co",
      href: "https://st.example.com/contacts/c9",
      // Inapplicable, not unmeasured — so no tag and no em-dash.
      channel: null,
      waiting: "follow-up due 3 days ago",
      waitingIsStale: true,
      // The note sits in the snippet register, unquoted.
      snippet: "Send the revised proposal",
      reason: null,
    });
  });

  it("renders an overdue row with no note rather than dropping it", () => {
    const out = build([], [overdue({ nextActionNote: null })]);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0].snippet).toBeNull();
    expect(out.rows[0].waiting).toBe("follow-up due 3 days ago");
  });

  it("renders a reply with no snippet rather than quoting an empty string", () => {
    const out = build([reply({ replySnippet: null })], []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0].snippet).toBeNull();
  });
});

describe("Block E — suppression, which is the whole point", () => {
  it("drops a reply that already carries a live ApprovalItem", () => {
    const out = build([reply({ replyToLogId: "log-1" })], [], ["log-1"]);
    expect(out).toEqual({ kind: "empty", line: "Nothing waiting." });
  });

  it("suppresses before it classifies, so a drafted email never reappears here", () => {
    const out = build([reply({ replyToLogId: "log-1" }), reply({ contactId: "c2", replyToLogId: "log-2" })], [], ["log-1"]);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows.map((r) => r.id)).toEqual(["reply:log-2"]);
  });

  it("never suppresses an overdue follow-up — it has no anchor to match", () => {
    const out = build([], [overdue()], ["log-1", "c9"]);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows).toHaveLength(1);
  });

  it("keeps a reply with no anchor: nothing can ever draft it", () => {
    const out = build([reply({ replyToLogId: "" })], []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0].kind).toBe("no-draft");
    expect(out.rows[0].id).toBe("reply:c1");
  });
});

describe("Block E — channel labels", () => {
  it("uses the deck's four labels, and names the channel in the reason", () => {
    for (const [channel, label] of [
      ["email", "Email"],
      ["facebook", "Facebook"],
      ["instagram", "Instagram"],
      ["phone", "Phone"],
    ] as const) {
      const out = build([reply({ channel, replyToLogId: `log-${channel}` })], []);
      if (out.kind !== "rows") throw new Error("expected rows");
      expect(out.rows[0].channel).toBe(label);
    }
    const phone = build([reply({ channel: "phone" })], []);
    if (phone.kind !== "rows") throw new Error("expected rows");
    expect(phone.rows[0].reason).toBe("Nothing drafts replies for Phone.");
  });

  it("passes an unrecognised channel through rather than inventing a label", () => {
    const out = build([reply({ channel: "carrier-pigeon" })], []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0].channel).toBe("carrier-pigeon");
    expect(out.rows[0].kind).toBe("unsupported-channel");
  });
});

describe("Block E — ordering, counting and the bound", () => {
  it("puts replies before overdue follow-ups and keeps each feed's order", () => {
    const out = build(
      [reply({ contactId: "a", replyToLogId: "la" }), reply({ contactId: "b", replyToLogId: "lb" })],
      [overdue({ contactId: "x" }), overdue({ contactId: "y" })]
    );
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows.map((r) => r.id)).toEqual([
      "reply:la",
      "reply:lb",
      "overdue:x",
      "overdue:y",
    ]);
  });

  it("counts every gap, bounds the display at 20, and states what it did", () => {
    const many = Array.from({ length: 41 }, (_, i) =>
      reply({ contactId: `c${i}`, replyToLogId: `log-${i}` })
    );
    const out = build(many, []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(GAP_DISPLAY_BOUND).toBe(20);
    expect(out.count).toBe(41);
    expect(out.rows).toHaveLength(20);
    expect(out.bound).toBe("Showing 20 of 41.");
  });

  it("states no bound at exactly the bound", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      reply({ contactId: `c${i}`, replyToLogId: `log-${i}` })
    );
    const out = build(many, []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.bound).toBeNull();
  });

  it("says `Nothing waiting.` — today's state, and it must look intentional", () => {
    expect(build([], [])).toEqual({ kind: "empty", line: "Nothing waiting." });
  });

  it("reports a failure to load rather than an emptiness", () => {
    const out = buildBlockE({
      now: NOW,
      repliedUnanswered: null,
      overdueActions: null,
      liveAnchorIds: new Set(),
      contactsBaseUrl: CONTACTS_URL,
    });
    expect(out).toEqual({ kind: "failed", line: "Couldn't load what's waiting." });
  });
});

describe("countGaps — the figure Block A's third card shares", () => {
  it("is the computed gap count, never the raw feed length", () => {
    const out = build([reply({ replyToLogId: "log-1" }), reply({ contactId: "c2", replyToLogId: "log-2" })], [overdue()], ["log-1"]);
    if (out.kind !== "rows") throw new Error("expected rows");
    // Two replies in, one suppressed, one overdue: the feed had three rows and
    // the answer is two.
    expect(out.count).toBe(2);
  });
});
