/**
 * doorSentence.test.ts — a definite failure's words: the door's own
 * sentence when it wrote one, else pressOutcome's (plan deviation 8).
 */
import { describe, it, expect } from "vitest";
import { doorSentence } from "@/lib/doorSentence";

describe("doorSentence", () => {
  it("a sentence-only body says the door's sentence", () => {
    const body = { error: "Item is no longer pending (already decided or expired)." };
    expect(doorSentence({ kind: "failed", code: null, sentence: "Couldn’t save.", body })).toBe(
      "Item is no longer pending (already decided or expired).",
    );
  });

  it("a body with a code says pressOutcome's sentence for it", () => {
    const body = { error: "Could not save.", code: "save-failed" };
    expect(doorSentence({ kind: "failed", code: "save-failed", sentence: "Couldn’t save.", body })).toBe(
      "Couldn’t save.",
    );
  });

  it("an unknown code says pressOutcome's fallback", () => {
    expect(
      doorSentence({ kind: "failed", code: "weird-code", sentence: "Couldn’t save.", body: { error: "weird-code" } }),
    ).toBe("Couldn’t save.");
  });

  it("an empty or missing error says pressOutcome's sentence", () => {
    expect(doorSentence({ kind: "failed", code: null, sentence: "Couldn’t save.", body: { error: "  " } })).toBe(
      "Couldn’t save.",
    );
    expect(doorSentence({ kind: "failed", code: null, sentence: "Couldn’t save.", body: null })).toBe(
      "Couldn’t save.",
    );
  });
});
