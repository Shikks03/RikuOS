/**
 * Blocks A, B and C. Every string here is quoted from the content deck
 * (docs/superpowers/specs/2026-09-05-p8-freelance-page-content.md) or the P8
 * spec's §4, and is asserted character for character on purpose: the deck is
 * the authority on every string, and a "tidied" word is a silent change to
 * what the page claims.
 *
 * The load-bearing assertion in this file is the one about
 * `Nothing waiting on you.` — it must fire only when drafts, approved,
 * never-contacted AND the needs-you count are ALL measured zeros (R35, R50) —
 * never under a lit card, never under a blank one.
 */
import { describe, it, expect } from "vitest";
import { buildBlockA, buildBlockB, buildBlockC, CAMPAIGN_DISPLAY_BOUND } from "@/lib/freelanceView";
import { PIPELINE_STAGES } from "@/lib/stApi";
import type { SummaryCampaign, SummaryContacts, SummaryQueue } from "@/lib/stApi";

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

  it("clamps the track at 100 when the feed reports more never-contacted than contacts", () => {
    // Contract garbage from ShikksTracker is reported, not repaired: the figure
    // stays 40, and only the track — which is a shape, not a fact — is clamped.
    const c = card(
      blockA({
        contacts: contacts({
          total: 10,
          byPipelineStage: { ...contacts().byPipelineStage, not_started: 40 },
        }),
      }),
      "contacts"
    );
    expect(c.trackPercent).toBe(100);
    expect(c.tone).toBe("plain");
    expect(c.figure).toBe("40");
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

  it("says `Nothing waiting on you.` only when all four are measured zeros (R50)", () => {
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
    expect(absent.lines).toEqual([]);
  });

  it("stays silent when any count never arrived, even beside three zeros (R50)", () => {
    // The absence is the point of each probe: the card beside the line already
    // reads `—` and says ShikksTracker didn't report, so a summary claiming
    // nothing is waiting would rest on a number that never arrived.
    const stageAbsent = blockA({
      queue: queue({ drafts: 0, approved: 0 }),
      contacts: contacts({ byPipelineStage: { ...contacts().byPipelineStage, not_started: null } }),
      needsYouCount: 0,
    });
    expect(stageAbsent.lines).toEqual([]);
    expect(card(stageAbsent, "contacts").tone).toBe("blank");

    const blockAbsent = blockA({
      queue: queue({ drafts: 0, approved: 0 }),
      contacts: null,
      needsYouCount: 0,
    });
    expect(blockAbsent.lines).toEqual([]);

    const countAbsent = blockA({
      queue: queue({ drafts: 0, approved: 0 }),
      contacts: contacts({ byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 } }),
      needsYouCount: null,
    });
    expect(countAbsent.lines).toEqual([]);
    expect(card(countAbsent, "needs-you").tone).toBe("blank");

    const draftsAbsent = blockA({
      queue: queue({ drafts: null, approved: 0 }),
      contacts: contacts({ byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 } }),
      needsYouCount: 0,
    });
    expect(draftsAbsent.lines).toEqual([]);
    expect(card(draftsAbsent, "drafts").tone).toBe("blank");

    const approvedAbsent = blockA({
      queue: queue({ drafts: 0, approved: null }),
      contacts: contacts({ byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 } }),
      needsYouCount: 0,
    });
    expect(approvedAbsent.lines).toEqual([]);
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
    const out = blockA({
      queue: queue({ drafts: 0, approved: 0 }),
      contacts: contacts({ byPipelineStage: { ...contacts().byPipelineStage, not_started: 0 } }),
      needsYouCount: 0,
    });
    expect(out.lines).toEqual([{ figure: null, text: "Nothing waiting on you." }]);
    expect(out.cards).toHaveLength(3);
    expect(card(out, "drafts").tone).toBe("drained");
    expect(card(out, "contacts").tone).toBe("drained");
    expect(card(out, "needs-you").tone).toBe("drained");
  });
});

describe("Block B — the pipeline", () => {
  const b = (over: Partial<SummaryContacts> | null = {}) =>
    buildBlockB(over === null ? null : contacts(over));

  it("renders today's real reading exactly as the deck writes it", () => {
    const out = b();
    if (out.kind !== "stages") throw new Error("expected stages");
    expect(out.summary).toEqual({ total: 30, totalWord: "contacts", hot: 2, hotWord: "hot" });
    expect(out.rows).toEqual([
      { key: "not_started", label: "Not started", count: 25 },
      { key: "contacted", label: "Contacted", count: 3 },
      { key: "replied", label: "Replied", count: 2 },
    ]);
    expect(out.emptyNote).toBe("Nothing yet at call booked, proposal sent, won or lost");
    expect(out.absentNote).toBeNull();
    expect(out.hotAbsentNote).toBeNull();
  });

  it("goes singular on both halves of the summary line", () => {
    const out = b({
      total: 1,
      hot: 1,
      byPipelineStage: { ...contacts().byPipelineStage, not_started: 1, contacted: 0, replied: 0 },
    });
    if (out.kind !== "stages") throw new Error("expected stages");
    expect(out.summary.totalWord).toBe("contact");
    expect(out.summary.hot).toBe(1);
  });

  it("drops the hot clause at a measured zero, silently", () => {
    const out = b({ hot: 0 });
    if (out.kind !== "stages") throw new Error("expected stages");
    expect(out.summary.hot).toBeNull();
    expect(out.hotAbsentNote).toBeNull();
  });

  it("drops the hot clause when it never arrived, and says so", () => {
    const out = b({ hot: null });
    if (out.kind !== "stages") throw new Error("expected stages");
    expect(out.summary.hot).toBeNull();
    expect(out.hotAbsentNote).toBe("ShikksTracker didn't report how many are hot.");
  });

  it("writes the Nothing-yet grammar at four, two, one and none", () => {
    const stages = contacts().byPipelineStage;

    /** Narrows to the stages case so the assertions read as one line each. */
    const note = (over: Partial<SummaryContacts>) => {
      const out = b(over);
      if (out.kind !== "stages") throw new Error("expected stages");
      return out.emptyNote;
    };

    expect(note({ byPipelineStage: { ...stages, call_booked: 1, proposal_sent: 1 } })).toBe(
      "Nothing yet at won or lost"
    );

    expect(
      note({ byPipelineStage: { ...stages, call_booked: 1, proposal_sent: 1, won: 1 } })
    ).toBe("Nothing yet at lost");

    expect(
      note({ byPipelineStage: { ...stages, call_booked: 1, proposal_sent: 1, won: 1, lost: 1 } })
    ).toBeNull();

    expect(note({ byPipelineStage: { ...stages, proposal_sent: 1 } })).toBe(
      "Nothing yet at call booked, won or lost"
    );
  });

  it("keeps an omitted stage out of the Nothing-yet line — that line means measured zero", () => {
    const out = b({ byPipelineStage: { ...contacts().byPipelineStage, won: null, lost: null } });
    if (out.kind !== "stages") throw new Error("expected stages");
    // Two measured-empty stages are left, so the grammar is `a or b` — the
    // omitted pair is not silently appended with a comma.
    expect(out.emptyNote).toBe("Nothing yet at call booked or proposal sent");
    expect(out.absentNote).toBe("ShikksTracker didn't report every pipeline stage.");
    expect(out.rows.some((r) => r.key === "won")).toBe(false);
  });

  it("keeps pipeline order whatever order the keys arrive in", () => {
    // The rows follow PIPELINE_STAGES, never the JSON's key order: a feed that
    // serialised `lost` first must not put Lost at the top of the pipeline.
    const out = b({
      byPipelineStage: {
        lost: 0,
        replied: 2,
        won: 0,
        not_started: 25,
        proposal_sent: 0,
        contacted: 3,
        call_booked: 0,
      },
    });
    if (out.kind !== "stages") throw new Error("expected stages");
    expect(out.rows.map((r) => r.key)).toEqual(["not_started", "contacted", "replied"]);
  });

  it("returns stages with no rows when every stage is absent but the total arrived", () => {
    // A measured total with no measured stage is not an emptiness and not a
    // failure: the summary line is true, there is simply nothing to list.
    const out = b({
      total: 30,
      hot: 2,
      byPipelineStage: {
        not_started: null,
        contacted: null,
        replied: null,
        call_booked: null,
        proposal_sent: null,
        won: null,
        lost: null,
      },
    });
    if (out.kind !== "stages") throw new Error("expected stages");
    expect(out.rows).toEqual([]);
    expect(out.emptyNote).toBeNull();
    expect(out.absentNote).toBe("ShikksTracker didn't report every pipeline stage.");
  });

  it("says `No contacts yet.` at a measured total of zero", () => {
    const zeroed = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, 0]));
    const out = b({ total: 0, hot: 0, byPipelineStage: zeroed as never });
    expect(out).toEqual({ kind: "empty", line: "No contacts yet." });
  });

  it("reports a failure to load rather than inventing an emptiness", () => {
    expect(buildBlockB(null)).toEqual({ kind: "failed", line: "Couldn't load the pipeline." });
    expect(b({ total: null })).toEqual({ kind: "failed", line: "Couldn't load the pipeline." });
  });
});

describe("Block C — campaigns", () => {
  const row = (over: Partial<SummaryCampaign>): SummaryCampaign => ({
    id: "c1",
    name: "Test One",
    sent: 5,
    opened: 2,
    clicked: 0,
    replied: 2,
    ...over,
  });

  it("renders today's two real rows with the deck's headers", () => {
    const out = buildBlockC([
      row({}),
      row({ id: "c2", name: "Test number 2", sent: 0, opened: 0, clicked: 0, replied: 0 }),
    ]);
    if (out.kind !== "table") throw new Error("expected table");
    expect(out.headers).toEqual(["Campaign", "Sent", "Opened", "Clicked", "Replied"]);
    expect(out.count).toBe(2);
    expect(out.rows[0].name).toBe("Test One");
    expect(out.rows[0].cells.map((c) => c.text)).toEqual(["5", "2", "0", "2"]);
    expect(out.bound).toBeNull();
    expect(out.honesty).toBe(
      "Open counts come from tracking pixels and undercount anyone whose mail client blocks images."
    );
  });

  it("marks a measured zero and an absent cell differently — never the same ink", () => {
    const out = buildBlockC([row({ clicked: 0, replied: null })]);
    if (out.kind !== "table") throw new Error("expected table");
    const cells = out.rows[0].cells;
    expect(cells[2]).toEqual({ text: "0", tone: "zero" });
    expect(cells[3]).toEqual({ text: "—", tone: "dash" });
  });

  it("sorts by Sent, highest first, with a measured zero above an unmeasured sent, unmeasured last, ties in feed order", () => {
    const out = buildBlockC([
      row({ id: "a", name: "A", sent: 5 }),
      row({ id: "b", name: "B", sent: null }),
      row({ id: "c", name: "C", sent: 142 }),
      row({ id: "d", name: "D", sent: 5 }),
      row({ id: "z", name: "Z", sent: 0 }),
    ]);
    if (out.kind !== "table") throw new Error("expected table");
    // `z` sent nothing and `b` never said: a measured zero is still a number,
    // so it outranks the row that is no number at all.
    expect(out.rows.map((r) => r.id)).toEqual(["c", "a", "d", "z", "b"]);
  });

  it("bounds the display at 20 and states what it did, in sentence case", () => {
    const many = Array.from({ length: 34 }, (_, i) =>
      row({ id: `c${i}`, name: `Campaign ${i}`, sent: 100 - i })
    );
    const out = buildBlockC(many);
    if (out.kind !== "table") throw new Error("expected table");
    expect(out.rows).toHaveLength(20);
    expect(out.count).toBe(34);
    expect(out.bound).toBe("Showing 20 of 34 campaigns.");
  });

  it("states no bound at exactly twenty, and the bound is twenty", () => {
    const many = Array.from({ length: 20 }, (_, i) => row({ id: `c${i}`, sent: 100 - i }));
    const out = buildBlockC(many);
    if (out.kind !== "table") throw new Error("expected table");
    expect(out.bound).toBeNull();
    expect(out.count).toBe(20);
    expect(out.rows).toHaveLength(20);
    expect(CAMPAIGN_DISPLAY_BOUND).toBe(20);
  });

  it("states the bound at twenty-one, the first count that exceeds it", () => {
    const many = Array.from({ length: 21 }, (_, i) => row({ id: `c${i}`, sent: 100 - i }));
    const out = buildBlockC(many);
    if (out.kind !== "table") throw new Error("expected table");
    expect(out.bound).toBe("Showing 20 of 21 campaigns.");
  });

  it("says `No campaigns yet.` for a measured emptiness and reports a failure for an absence", () => {
    expect(buildBlockC([])).toEqual({ kind: "empty", line: "No campaigns yet." });
    expect(buildBlockC(null)).toEqual({ kind: "failed", line: "Couldn't load campaigns." });
  });

  it("never produces a rate column", () => {
    const out = buildBlockC([row({})]);
    if (out.kind !== "table") throw new Error("expected table");
    expect(out.headers.join(" ")).not.toMatch(/rate/i);
    expect(out.rows[0].cells).toHaveLength(4);
  });
});
