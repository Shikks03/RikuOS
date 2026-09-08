/**
 * Blocks A, B and C. Every string here is quoted from the content deck
 * (docs/superpowers/specs/2026-09-05-p8-freelance-page-content.md) or the P8
 * spec's §4, and is asserted character for character on purpose: the deck is
 * the authority on every string, and a "tidied" word is a silent change to
 * what the page claims.
 *
 * The load-bearing assertion in this file is the one about
 * `Nothing waiting on you.` — it must fire only when drafts, approved,
 * never-contacted AND the needs-you count are ALL zero or absent (R35), never
 * under a lit card.
 */
import { describe, it, expect } from "vitest";
import { buildBlockA } from "@/lib/freelanceView";
import type { SummaryContacts, SummaryQueue } from "@/lib/stApi";

const DRAFTS_URL = "https://st.example.com/review";

function queue(over: Partial<SummaryQueue> = {}): SummaryQueue {
  return { drafts: 24, approved: 0, ...over };
}

function contacts(over: Partial<SummaryContacts> = {}): SummaryContacts {
  return {
    total: 30,
    hot: 2,
    byPipelineStage: {
      not_started: 25,
      contacted: 3,
      replied: 2,
      call_booked: 0,
      proposal_sent: 0,
      won: 0,
      lost: 0,
    },
    ...over,
  };
}

function blockA(over: Partial<Parameters<typeof buildBlockA>[0]> = {}) {
  return buildBlockA({
    queue: queue(),
    contacts: contacts(),
    needsYouCount: 0,
    draftsUrl: DRAFTS_URL,
    ...over,
  });
}

const card = (out: ReturnType<typeof buildBlockA>, key: string) => {
  const found = out.cards.find((c) => c.key === key);
  if (!found) throw new Error(`no card ${key}`);
  return found;
};

describe("Block A — the three cards always render", () => {
  it("renders exactly three cards, in row order, in every state", () => {
    expect(blockA().cards.map((c) => c.key)).toEqual(["drafts", "contacts", "needs-you"]);
    const dead = blockA({ queue: queue({ drafts: null }), contacts: null, needsYouCount: null });
    expect(dead.cards.map((c) => c.key)).toEqual(["drafts", "contacts", "needs-you"]);
  });
});

describe("Block A — the drafts card", () => {
  it("reads the deck's sentence with no word added or lost", () => {
    const c = card(blockA(), "drafts");
    expect(c.tone).toBe("roi");
    expect(c.label).toBe("Drafts");
    expect(c.figure).toBe("24");
    expect(c.caption).toBe("drafts waiting on you in ShikksTracker");
  });

  it("goes singular at one", () => {
    const c = card(blockA({ queue: queue({ drafts: 1 }) }), "drafts");
    expect(c.caption).toBe("draft waiting on you in ShikksTracker");
  });

  it("drains at a measured zero and keeps the plural", () => {
    const c = card(blockA({ queue: queue({ drafts: 0 }) }), "drafts");
    expect(c.tone).toBe("drained");
    expect(c.figure).toBe("0");
    expect(c.caption).toBe("drafts waiting on you in ShikksTracker");
  });

  it("blanks when the count never arrived, and says so — a zero would be a lie", () => {
    const c = card(blockA({ queue: queue({ drafts: null }) }), "drafts");
    expect(c.tone).toBe("blank");
    expect(c.figure).toBe("—");
    expect(c.caption).toBe("ShikksTracker didn't report how many drafts are waiting");
  });

  it("is the only card carrying a link, and keeps it in every state", () => {
    const live = blockA();
    expect(card(live, "drafts").href).toBe(DRAFTS_URL);
    expect(card(live, "contacts").href).toBeNull();
    expect(card(live, "needs-you").href).toBeNull();
    expect(card(blockA({ queue: queue({ drafts: null }) }), "drafts").href).toBe(DRAFTS_URL);
  });
});

describe("Block A — the contacts card", () => {
  it("is hueless with data, and reconstructs the deck's sentence", () => {
    const c = card(blockA(), "contacts");
    expect(c.tone).toBe("plain");
    expect(c.label).toBe("Contacts");
    expect(c.figure).toBe("25");
    expect(c.caption).toBe("of 30 contacts never contacted");
    expect(c.trackPercent).toBe(83);
  });

  it("goes singular at a total of one", () => {
    const c = card(
      blockA({
        contacts: contacts({
          total: 1,
          byPipelineStage: { ...contacts().byPipelineStage, not_started: 1 },
        }),
      }),
      "contacts"
    );
    expect(c.caption).toBe("of 1 contact never contacted");
  });

  it("keeps the track's ground at a measured zero, so the row's baseline holds", () => {
    const c = card(
      blockA({
        contacts: contacts({ byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 } }),
      }),
      "contacts"
    );
    expect(c.tone).toBe("drained");
    expect(c.figure).toBe("0");
    expect(c.trackPercent).toBe(0);
  });

  it("draws no track at a total of zero — a proportion of nothing is not a shape", () => {
    const c = card(
      blockA({
        contacts: contacts({
          total: 0,
          byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 },
        }),
      }),
      "contacts"
    );
    expect(c.tone).toBe("drained");
    expect(c.figure).toBe("0");
    expect(c.caption).toBe("of 0 contacts never contacted");
    expect(c.trackPercent).toBeNull();
  });

  it("blanks with no track when the block, the total or the stage did not arrive", () => {
    for (const over of [
      { contacts: null },
      { contacts: contacts({ total: null }) },
      {
        contacts: contacts({
          byPipelineStage: { ...contacts().byPipelineStage, not_started: null },
        }),
      },
    ]) {
      const c = card(blockA(over), "contacts");
      expect(c.tone).toBe("blank");
      expect(c.figure).toBe("—");
      expect(c.caption).toBe("ShikksTracker didn't report how many contacts there are");
      expect(c.trackPercent).toBeNull();
    }
  });
});

describe("Block A — the needs-you card", () => {
  it("goes amber above zero, because every row it counts is a duration", () => {
    const c = card(blockA({ needsYouCount: 3 }), "needs-you");
    expect(c.tone).toBe("stale");
    expect(c.label).toBe("Needs you");
    expect(c.figure).toBe("3");
    expect(c.caption).toBe("waiting on you");
  });

  it("drains at zero but keeps its caption legible — 0 is the answer the page exists to give", () => {
    const c = card(blockA({ needsYouCount: 0 }), "needs-you");
    expect(c.tone).toBe("drained");
    expect(c.figure).toBe("0");
    expect(c.caption).toBe("nothing waiting");
  });

  it("blanks when the database read failed, exactly like Block E beside it", () => {
    const c = card(blockA({ needsYouCount: null }), "needs-you");
    expect(c.tone).toBe("blank");
    expect(c.figure).toBe("—");
    expect(c.caption).toBe("couldn't load");
  });
});

describe("Block A — the statement lines", () => {
  it("says the approved line only when there is something to say", () => {
    expect(blockA({ queue: queue({ approved: 3 }) }).lines).toEqual([
      { figure: "3", text: "approved, not yet sent" },
    ]);
    expect(blockA({ queue: queue({ approved: 1 }) }).lines).toEqual([
      { figure: "1", text: "approved, not yet sent" },
    ]);
  });

  it("hides the approved line at zero and when the field never arrived", () => {
    expect(blockA({ queue: queue({ approved: 0 }) }).lines).toEqual([]);
    expect(blockA({ queue: queue({ approved: null }) }).lines).toEqual([]);
  });

  it("never renders `Sending is off` — the contract gap is unshipped, not stubbed", () => {
    const texts = blockA({ queue: queue({ approved: 2 }) }).lines.map((l) => l.text);
    expect(texts.join(" ")).not.toContain("Sending");
  });

  it("says `Nothing waiting on you.` only when all four are zero or absent", () => {
    const all = blockA({
      queue: queue({ drafts: 0, approved: 0 }),
      contacts: contacts({ byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 } }),
      needsYouCount: 0,
    });
    expect(all.lines).toEqual([{ figure: null, text: "Nothing waiting on you." }]);

    const absent = blockA({
      queue: queue({ drafts: null, approved: null }),
      contacts: null,
      needsYouCount: null,
    });
    expect(absent.lines).toEqual([{ figure: null, text: "Nothing waiting on you." }]);
  });

  it("never says it beside a lit needs-you card (R35)", () => {
    // The contradiction this rule exists to stop: `Nothing waiting on you.`
    // printed under an amber card reading `3 / waiting on you`, on one screen.
    const out = blockA({
      queue: queue({ drafts: 0, approved: 0 }),
      contacts: contacts({ byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 } }),
      needsYouCount: 3,
    });
    expect(out.lines).toEqual([]);
  });

  it("never says it under a lit card", () => {
    // Drafts lit.
    expect(
      blockA({
        queue: queue({ drafts: 24, approved: 0 }),
        contacts: contacts({ byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 } }),
      }).lines
    ).toEqual([]);

    // Never-contacted lit.
    expect(blockA({ queue: queue({ drafts: 0, approved: 0 }) }).lines).toEqual([]);

    // Approved lit — the fallback and the approved line are mutually exclusive.
    expect(
      blockA({
        queue: queue({ drafts: 0, approved: 2 }),
        contacts: contacts({ byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 } }),
      }).lines
    ).toEqual([{ figure: "2", text: "approved, not yet sent" }]);
  });

  it("still renders all three cards under the whole-block fallback, drained", () => {
    const out = blockA({ queue: queue({ drafts: 0, approved: 0 }), contacts: null });
    expect(out.cards).toHaveLength(3);
    expect(card(out, "drafts").tone).toBe("drained");
  });
});
