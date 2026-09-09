/**
 * The one block whose whole reason for existing is a refusal: half of it can
 * never have a number, and showing those rows as 0% would be a lie.
 *
 * The two assertions that must never be relaxed are that the upstream
 * replyRate is never printed, and that no rate is printed for a non-email
 * channel however many sends it has.
 */
import { describe, it, expect } from "vitest";
import { buildBlockD } from "@/lib/freelanceVariants";
import type { VariantStatsItem } from "@/lib/stApi";

function variant(over: Partial<VariantStatsItem>): VariantStatsItem {
  return {
    key: "k",
    label: "L",
    channel: "email",
    stage: 1,
    sends: 0,
    uniqueContacts: 0,
    replies: 0,
    replyRate: 0,
    ...over,
  };
}

/** The four real approaches that exist today, all at zero sends. */
function today(): VariantStatsItem[] {
  return [
    variant({ key: "e1", label: "Email S1 — specific compliment first", channel: "email" }),
    variant({ key: "e2", label: "Email S1 — pain point first", channel: "email" }),
    variant({ key: "f1", label: "Facebook DM S1 — specific compliment first", channel: "facebook" }),
    variant({ key: "f2", label: "Facebook DM S1 — pain point first", channel: "facebook" }),
  ];
}

describe("Block D — the two groups, always", () => {
  it("splits email from everything else, at equal typographic weight", () => {
    const out = buildBlockD(today());
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups).toHaveLength(2);
    expect(out.groups[0].eyebrow).toBe("Measured — email");
    expect(out.groups[1].eyebrow).toBe("Not measurable");
    expect(out.groups[0].rows.map((r) => r.key)).toEqual(["e1", "e2"]);
    expect(out.groups[1].rows.map((r) => r.key)).toEqual(["f1", "f2"]);
  });

  it("drops the replies column from group 2 and keeps sends live", () => {
    const out = buildBlockD([
      // One email variant so BOTH groups have rows: R66 drops an empty group,
      // and this test is about the two of them beside each other.
      variant({ key: "e1", channel: "email" }),
      variant({ key: "f1", channel: "facebook", sends: 31, replies: 4 }),
    ]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[0].headers).toEqual(["Approach", "Reply rate", "Sends", "Replies"]);
    expect(out.groups[1].headers).toEqual(["Approach", "Reply rate", "Sends"]);
    const row = out.groups[1].rows[0];
    expect(row.cells).toHaveLength(2);
    expect(row.cells[0]).toEqual({ text: "—", tone: "dash" });
    expect(row.cells[1]).toEqual({ text: "31", tone: "value" });
  });

  it("puts the explanation under the group heading, above its rows", () => {
    const out = buildBlockD(today());
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[0].explain).toBeNull();
    expect(out.groups[1].explain).toBe(
      "Replies are only detected on email, so these can't be scored."
    );
  });

  it("treats a channel it cannot read as not measurable — never as email", () => {
    const out = buildBlockD([variant({ key: "orphan", label: null, channel: null, sends: 9 })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    // R66: the measured group has no rows, so it is not drawn at all — which
    // is itself the proof that the orphan did not land in it.
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].eyebrow).toBe("Not measurable");
    expect(out.groups[0].rows).toHaveLength(1);
    // With no label the key is the only name there is.
    expect(out.groups[0].rows[0].name).toBe("orphan");
  });

  it("names a row by its key when the label is an EMPTY string, not just null", () => {
    const out = buildBlockD([variant({ key: "e1", label: "", channel: "email" })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[0].rows[0].name).toBe("e1");
  });

  it("draws no group for a half with no rows, and never zero groups (R66)", () => {
    const allEmail = buildBlockD([
      variant({ key: "e1", channel: "email" }),
      variant({ key: "e2", channel: "email" }),
    ]);
    if (allEmail.kind !== "groups") throw new Error("expected groups");
    expect(allEmail.groups).toHaveLength(1);
    expect(allEmail.groups[0].eyebrow).toBe("Measured — email");

    const noneEmail = buildBlockD([
      variant({ key: "f1", channel: "facebook" }),
      variant({ key: "f2", channel: null }),
    ]);
    if (noneEmail.kind !== "groups") throw new Error("expected groups");
    expect(noneEmail.groups).toHaveLength(1);
    expect(noneEmail.groups[0].eyebrow).toBe("Not measurable");

    // The two halves can never BOTH be empty: an empty list returns `empty`
    // before the split, so `groups` is never a zero-length array.
    expect(buildBlockD([])).toEqual({ kind: "empty", line: "No approaches set up." });
  });
});

describe("Block D — the rate, recomputed and rationed", () => {
  it("recomputes from sends and replies and never prints the upstream replyRate", () => {
    const out = buildBlockD([
      // Upstream says 99%. The truth is 8/72 = 11%.
      variant({ key: "e1", channel: "email", sends: 72, replies: 8, replyRate: 0.99 }),
    ]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[0].rows[0].cells[0]).toEqual({ text: "11%", tone: "value" });
  });

  it("prints no rate for zero sends — 0/0 is not 0%", () => {
    const out = buildBlockD([variant({ key: "e1", channel: "email", sends: 0, replies: 0 })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[0].rows[0].cells[0]).toEqual({ text: "—", tone: "dash" });
    expect(out.groups[0].rows[0].cells[1]).toEqual({ text: "0", tone: "zero" });
  });

  it("prints no rate for a non-email channel, ever, however many sends it has", () => {
    const out = buildBlockD([
      variant({ key: "f1", channel: "facebook", sends: 500, replies: 250, replyRate: 0.5 }),
    ]);
    if (out.kind !== "groups") throw new Error("expected groups");
    // R66: with no email variant the measured group is not drawn, so the
    // not-measurable group is groups[0] here.
    expect(out.groups[0].rows[0].cells[0]).toEqual({ text: "—", tone: "dash" });
  });

  it("prints no rate when sends never arrived", () => {
    const out = buildBlockD([variant({ key: "e1", channel: "email", sends: null, replies: 3 })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[0].rows[0].cells[0]).toEqual({ text: "—", tone: "dash" });
    expect(out.groups[0].rows[0].cells[1]).toEqual({ text: "—", tone: "dash" });
  });

  it("rounds rather than floors — the deck's own 54/3 row reads 6%, not 5%", () => {
    // 3/54 = 5.55…%. Math.floor would print 5% and the deck says 6%.
    const out = buildBlockD([variant({ key: "e2", channel: "email", sends: 54, replies: 3 })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[0].rows[0].cells[0]).toEqual({ text: "6%", tone: "value" });
  });

  it("prints no rate when replies never arrived, and dashes the replies cell too", () => {
    const out = buildBlockD([variant({ key: "e1", channel: "email", sends: 72, replies: null })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[0].rows[0].cells[0]).toEqual({ text: "—", tone: "dash" });
    expect(out.groups[0].rows[0].cells[1]).toEqual({ text: "72", tone: "value" });
    expect(out.groups[0].rows[0].cells[2]).toEqual({ text: "—", tone: "dash" });
  });

  it("REPORTS an impossible rate rather than repairing it — 10 replies to 5 sends is 200%", () => {
    // A decision, not an oversight: clamping at 100% would hide a broken feed
    // behind a plausible number. The page shows what ShikksTracker said, in
    // both places it says it.
    const out = buildBlockD([variant({ key: "e1", label: "Broken", channel: "email", sends: 5, replies: 10 })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.groups[0].rows[0].cells[0]).toEqual({ text: "200%", tone: "value" });
    expect(out.collapsed).toEqual({ kind: "best", name: "Broken", rate: "200%" });
  });
});

describe("Block D — the honesty note (R27)", () => {
  it("renders only when at least one rate is printed", () => {
    const none = buildBlockD(today());
    if (none.kind !== "groups") throw new Error("expected groups");
    // A table with no rates and no sends is not a table of small numbers, and
    // printing the note there would be the opposite of an honesty note.
    expect(none.honesty).toBeNull();

    const some = buildBlockD([variant({ key: "e1", channel: "email", sends: 72, replies: 8 })]);
    if (some.kind !== "groups") throw new Error("expected groups");
    expect(some.honesty).toBe("Rates are computed over small numbers of sends.");
  });

  it("does not render it for sends on a non-email channel alone", () => {
    const out = buildBlockD([variant({ key: "f1", channel: "facebook", sends: 500, replies: 9 })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.honesty).toBeNull();
  });
});

describe("Block D — the default-open rule (R31) and the collapsed line", () => {
  it("is open by default only while every approach has zero sends", () => {
    const zero = buildBlockD(today());
    if (zero.kind !== "groups") throw new Error("expected groups");
    expect(zero.defaultOpen).toBe(true);

    const sent = today();
    sent[0] = { ...sent[0], sends: 1 };
    const out = buildBlockD(sent);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.defaultOpen).toBe(false);
  });

  it("is closed by default when a send count never arrived — that is not zero sends", () => {
    const out = buildBlockD([variant({ key: "e1", sends: null })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.defaultOpen).toBe(false);
  });

  it("says `No sends yet — nothing to compare.` when nothing is measurable", () => {
    const out = buildBlockD(today());
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.collapsed).toEqual({
      kind: "statement",
      text: "No sends yet — nothing to compare.",
    });
  });

  it("carries the best measured row once there is one", () => {
    const out = buildBlockD([
      variant({ key: "e1", label: "Email S1 — specific compliment first", sends: 72, replies: 8 }),
      variant({ key: "e2", label: "Email S1 — pain point first", sends: 54, replies: 3 }),
    ]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.collapsed).toEqual({
      kind: "best",
      name: "Email S1 — specific compliment first",
      rate: "11%",
    });
  });

  it("breaks a tie on sends, so the better-evidenced row wins", () => {
    const out = buildBlockD([
      variant({ key: "small", label: "Small", sends: 10, replies: 1 }),
      variant({ key: "big", label: "Big", sends: 100, replies: 10 }),
    ]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.collapsed).toEqual({ kind: "best", name: "Big", rate: "10%" });
  });

  it("falls back to the statement when only non-email approaches have sends", () => {
    const out = buildBlockD([variant({ key: "f1", channel: "facebook", sends: 31, replies: 2 })]);
    if (out.kind !== "groups") throw new Error("expected groups");
    expect(out.collapsed).toEqual({
      kind: "statement",
      text: "No sends yet — nothing to compare.",
    });
    expect(out.defaultOpen).toBe(false);
  });
});

describe("Block D — the empty and failed states", () => {
  it("says `No approaches set up.` for a measured emptiness", () => {
    expect(buildBlockD([])).toEqual({ kind: "empty", line: "No approaches set up." });
  });

  it("reports a failure to load for an absence", () => {
    expect(buildBlockD(null)).toEqual({
      kind: "failed",
      line: "Couldn't load approach performance.",
    });
  });
});
