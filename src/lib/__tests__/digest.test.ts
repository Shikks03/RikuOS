import { describe, it, expect } from "vitest";
import { composeDigest } from "@/lib/digest";

const base = {
  pending: 0,
  attention: { repliedUnanswered: 0, overdue: 0 },
  problems: [] as string[],
  offAgents: [] as string[],
};

describe("composeDigest", () => {
  it("says all clear when nothing is wrong", () => {
    const digest = composeDigest({ ...base, pending: 2 });
    expect(digest.title).toContain("All clear");
    expect(digest.title).toContain("2");
    expect(digest.body).toContain("All clear");
  });

  it("leads the title with the problem count", () => {
    const digest = composeDigest({ ...base, problems: ["chaser failed", "Meowchi unreachable"] });
    expect(digest.title).toContain("2 problems");
  });

  it("puts problems first in the body so truncation cannot eat them", () => {
    const digest = composeDigest({
      ...base,
      pending: 5,
      attention: { repliedUnanswered: 3, overdue: 1 },
      problems: ["Meowchi unreachable"],
    });
    expect(digest.body.indexOf("Meowchi unreachable")).toBe(0);
  });

  it("reports the pipeline as unavailable rather than as zero", () => {
    const digest = composeDigest({ ...base, attention: null });
    expect(digest.body).toContain("unavailable");
    expect(digest.body).not.toContain("0 waiting");
  });

  it("names agents that are switched off", () => {
    const digest = composeDigest({ ...base, offAgents: ["chaser"] });
    expect(digest.body).toContain("Off: chaser");
  });

  it("says nothing about off agents when none are off", () => {
    expect(composeDigest(base).body).not.toContain("Off:");
  });

  it("uses singular wording for one problem", () => {
    const digest = composeDigest({ ...base, problems: ["chaser failed"] });
    expect(digest.title).toContain("1 problem");
    expect(digest.title).not.toContain("problems");
  });

  it("counts an unreachable pipeline as a problem instead of saying all clear", () => {
    const digest = composeDigest({ ...base, pending: 5, attention: null });
    expect(digest.title).toContain("1 problem");
    expect(digest.title).not.toContain("All clear");
    expect(digest.body).not.toContain("All clear");
  });

  it("adds the pipeline failure to problems that already exist", () => {
    const digest = composeDigest({
      ...base,
      attention: null,
      problems: ["Meowchi unreachable"],
    });
    expect(digest.title).toContain("2 problems");
    expect(digest.body).toContain("Meowchi unreachable");
    expect(digest.body).toContain("unavailable");
  });

  it("states the attention line exactly, so the two counts cannot be swapped", () => {
    const digest = composeDigest({
      ...base,
      attention: { repliedUnanswered: 3, overdue: 1 },
    });
    expect(digest.body).toContain("3 waiting on you, 1 overdue.");
  });

  it("caps one long problem so it cannot evict the findings behind it", () => {
    const long = `expiry sweep failed: ${"x".repeat(300)}`;
    const digest = composeDigest({
      ...base,
      problems: [long, "Meowchi unreachable"],
    });
    expect(digest.body).toContain("Meowchi unreachable");
    expect(digest.body.length).toBeLessThanOrEqual(200);
  });

  it("ends the problems line once, without doubling a period or an ellipsis", () => {
    expect(composeDigest({ ...base, problems: ["Meowchi unreachable"] }).body).toContain(
      "Meowchi unreachable. "
    );
    expect(composeDigest({ ...base, problems: ["sweep failed."] }).body).not.toContain("..");
    const truncated = composeDigest({
      ...base,
      problems: [`expiry sweep failed: ${"x".repeat(300)}`],
    }).body;
    expect(truncated).toContain("…");
    expect(truncated).not.toContain("….");
  });
});
