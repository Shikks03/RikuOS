/**
 * Block E is "the things nothing else is handling", so the suppression rule is
 * the test that matters: a reply that already carries a live ApprovalItem lives
 * in /queue, and surfacing it here too would make both lists untrustworthy.
 *
 * The snippet's quotation marks are STRAIGHT, exactly as the deck writes them
 * in its Block E rows. Do not "improve" them into curly quotes.
 */
import { describe, it, expect } from "vitest";
import { buildBlockE, gapCount, GAP_DISPLAY_BOUND } from "@/lib/freelanceGaps";
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
  // null = ShikksTracker did not report the overdue block at all (R51).
  overdues: OverdueActionItem[] | null,
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

describe("Block E — R53: longest wait first, across both feeds", () => {
  it("orders by how long each row has waited, not by which feed it came from", () => {
    const out = build(
      [
        reply({ contactId: "young", replyToLogId: "l-young", repliedAt: agoIso(4 * HOUR) }),
        reply({ contactId: "older", replyToLogId: "l-older", repliedAt: agoIso(2 * DAY) }),
      ],
      [overdue({ contactId: "x", nextActionAt: agoIso(3 * DAY) })]
    );
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows.map((r) => r.id)).toEqual([
      "overdue:x",
      "reply:l-older",
      "reply:l-young",
    ]);
  });

  it("sorts STABLY, so equal waits keep feed order — replies before overdues", () => {
    const out = build(
      [reply({ contactId: "r", replyToLogId: "l-r", repliedAt: agoIso(3 * DAY) })],
      [overdue({ contactId: "o", nextActionAt: agoIso(3 * DAY) })]
    );
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows.map((r) => r.id)).toEqual(["reply:l-r", "overdue:o"]);
  });

  it("keeps the amber class visible: 25 fresh replies cannot hide 3 old overdue rows", () => {
    // The failure R53 exists to prevent: under a replies-first order the bound
    // truncated the whole amber class, and `Showing 20 of 28.` read as if the
    // 20 shown were representative.
    const replies = Array.from({ length: 25 }, (_, i) =>
      reply({ contactId: `c${i}`, replyToLogId: `log-${i}`, repliedAt: agoIso(4 * HOUR) })
    );
    const overdues = Array.from({ length: 3 }, (_, i) =>
      overdue({ contactId: `o${i}`, nextActionAt: agoIso(3 * DAY) })
    );
    const out = build(replies, overdues);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.count).toBe(28);
    expect(out.bound).toBe("Showing 20 of 28.");
    const shown = out.rows.map((r) => r.id);
    expect(shown).toContain("overdue:o0");
    expect(shown).toContain("overdue:o1");
    expect(shown).toContain("overdue:o2");
    expect(shown.slice(0, 3)).toEqual(["overdue:o0", "overdue:o1", "overdue:o2"]);
  });

  it("sorts an unparseable timestamp youngest, matching its `just now` reading", () => {
    const out = build(
      [
        reply({ contactId: "broken", replyToLogId: "l-broken", repliedAt: "not-a-date" }),
        reply({ contactId: "old", replyToLogId: "l-old", repliedAt: agoIso(2 * DAY) }),
      ],
      []
    );
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows.map((r) => r.id)).toEqual(["reply:l-old", "reply:l-broken"]);
  });
});

describe("Block E — R51: an unreported overdue feed is not a measured emptiness", () => {
  it("says `ShikksTracker didn't report overdue follow-ups.`, never `Nothing waiting.`", () => {
    expect(build([], null)).toEqual({
      kind: "absent",
      line: "ShikksTracker didn't report overdue follow-ups.",
    });
  });

  it("carries the same sentence UNDER measured rows when the overdue feed is missing", () => {
    const out = build([reply()], null);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.count).toBe(1);
    expect(out.absentNote).toBe("ShikksTracker didn't report overdue follow-ups.");
  });

  it("keeps `empty` for a REPORTED emptiness — both feeds answered, nothing survived", () => {
    expect(build([], [])).toEqual({ kind: "empty", line: "Nothing waiting." });
  });

  it("carries no note when the overdue feed reported an empty list", () => {
    const out = build([reply()], []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.absentNote).toBeNull();
  });
});

describe("Block E — counting and the bound", () => {
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

describe("Block E — the unvalidated boundary", () => {
  it("suppresses regardless of channel: an instagram reply with a live anchor goes", () => {
    // Suppression is about whether something else is already handling the
    // reply, which has nothing to do with what channel it arrived on.
    const out = build(
      [reply({ channel: "instagram", replyToLogId: "log-ig" })],
      [],
      ["log-ig"]
    );
    expect(out).toEqual({ kind: "empty", line: "Nothing waiting." });
  });

  it("encodes a contact id with URL-significant characters", () => {
    const out = build([reply({ contactId: "a/b?c", replyToLogId: "log-1" })], []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0].href).toBe("https://st.example.com/contacts/a%2Fb%3Fc");
  });

  it("reads an unparseable repliedAt as `just now` rather than as NaN", () => {
    const out = build([reply({ repliedAt: "not-a-date" })], []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0].waiting).toBe("replied just now");
  });

  it("reads an unparseable nextActionAt as `just now` rather than as NaN", () => {
    const out = build([], [overdue({ nextActionAt: "not-a-date" })]);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0].waiting).toBe("follow-up due just now");
  });

  it("is `failed` when the reply feed is null even beside overdue rows", () => {
    // The attention call is the whole read: a null reply feed means it failed,
    // and rows from the other block cannot make a partial answer look whole.
    const out = buildBlockE({
      now: NOW,
      repliedUnanswered: null,
      overdueActions: [overdue()],
      liveAnchorIds: new Set(),
      contactsBaseUrl: CONTACTS_URL,
    });
    expect(out).toEqual({ kind: "failed", line: "Couldn't load what's waiting." });
  });

  it("treats an EMPTY snippet and an EMPTY note as no snippet, not as `\"\"`", () => {
    const emptyReply = build([reply({ replySnippet: "" })], []);
    if (emptyReply.kind !== "rows") throw new Error("expected rows");
    expect(emptyReply.rows[0].snippet).toBeNull();

    const emptyNote = build([], [overdue({ nextActionNote: "" })]);
    if (emptyNote.kind !== "rows") throw new Error("expected rows");
    expect(emptyNote.rows[0].snippet).toBeNull();
  });

  it("passes a `toString` channel through as a string — the labels are a Map", () => {
    // An object literal read the prototype chain here: labelFor returned the
    // function and the reason line printed its source.
    const out = build([reply({ channel: "toString" })], []);
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows[0].channel).toBe("toString");
    expect(out.rows[0].reason).toBe("Nothing drafts replies for toString.");
    expect(out.rows[0].kind).toBe("unsupported-channel");
  });
});

describe("gapCount — the figure Block A's third card shares", () => {
  it("is the computed gap count, never the raw feed length", () => {
    const out = build([reply({ replyToLogId: "log-1" }), reply({ contactId: "c2", replyToLogId: "log-2" })], [overdue()], ["log-1"]);
    if (out.kind !== "rows") throw new Error("expected rows");
    // Two replies in, one suppressed, one overdue: the feed had three rows and
    // the answer is two.
    expect(out.count).toBe(2);
    expect(gapCount(out)).toBe(2);
  });

  it("is the PRE-SLICE total, so the hero counts what the bound hid", () => {
    const many = Array.from({ length: 41 }, (_, i) =>
      reply({ contactId: `c${i}`, replyToLogId: `log-${i}` })
    );
    const out = build(many, []);
    expect(out.kind).toBe("rows");
    if (out.kind !== "rows") throw new Error("expected rows");
    expect(out.rows).toHaveLength(20);
    expect(gapCount(out)).toBe(41);
  });

  it("answers for all four kinds, and ONLY a measured emptiness is a zero", () => {
    const failed = buildBlockE({
      now: NOW,
      repliedUnanswered: null,
      overdueActions: null,
      liveAnchorIds: new Set(),
      contactsBaseUrl: CONTACTS_URL,
    });
    expect(failed.kind).toBe("failed");
    expect(gapCount(failed)).toBeNull();

    // R51: a claim of nothing may not rest on a feed that never arrived.
    const absent = build([], null);
    expect(absent.kind).toBe("absent");
    expect(gapCount(absent)).toBeNull();

    const empty = build([], []);
    expect(empty.kind).toBe("empty");
    expect(gapCount(empty)).toBe(0);

    const rows = build([reply()], []);
    expect(rows.kind).toBe("rows");
    expect(gapCount(rows)).toBe(1);
  });
});
