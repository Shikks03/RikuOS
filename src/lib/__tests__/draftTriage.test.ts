import { describe, it, expect } from "vitest";
import { buildTriageUserMessage, TRIAGE_SYSTEM_PROMPT } from "@/lib/draftTriage";
import type { DraftPolicy } from "@/lib/triage";

function policy(over: Partial<DraftPolicy> = {}): DraftPolicy {
  return {
    enabled: true,
    mayAnswer: true,
    knowledgeBlock: "A1 Presence Starter 3,000-4,500.",
    nameableProjects: ["Azerotech — repair shop site"],
    demoSiteUrls: [{ packageKey: "A1", url: "https://a1.example" }],
    holdingText: "Thanks!",
    ...over,
  };
}

describe("buildTriageUserMessage", () => {
  it("carries the knowledge block and the inbound message", () => {
    const msg = buildTriageUserMessage("magkano po?", policy());
    expect(msg).toContain("A1 Presence Starter 3,000-4,500.");
    expect(msg).toContain("magkano po?");
  });

  it("lists the projects that may be named", () => {
    expect(buildTriageUserMessage("portfolio?", policy())).toContain("Azerotech");
  });

  it("states plainly that NO project may be named when the list is empty", () => {
    // Silence would let the model fall back on whatever it thinks it knows.
    const msg = buildTriageUserMessage("portfolio?", policy({ nameableProjects: [] }));
    expect(msg).toMatch(/do not name any/i);
  });

  it("states plainly that NO link may be given when there are no demo urls", () => {
    const msg = buildTriageUserMessage("can I see one?", policy({ demoSiteUrls: [] }));
    expect(msg).toMatch(/do not include any link/i);
  });

  it("includes a demo url only when one was supplied", () => {
    expect(buildTriageUserMessage("sample?", policy())).toContain("https://a1.example");
  });
});

describe("TRIAGE_SYSTEM_PROMPT", () => {
  it("forbids inventing links and clients", () => {
    expect(TRIAGE_SYSTEM_PROMPT).toMatch(/never/i);
    expect(TRIAGE_SYSTEM_PROMPT.toLowerCase()).toContain("url");
  });

  it("forbids committing to a final price or a date", () => {
    expect(TRIAGE_SYSTEM_PROMPT.toLowerCase()).toContain("range");
  });
});
