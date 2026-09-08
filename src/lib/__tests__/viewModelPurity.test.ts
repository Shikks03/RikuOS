/**
 * The transitive form of Plan B Task 16 step 5's purity rule.
 *
 * A view model that reaches a Mongoose model has stopped being testable
 * without a database, however pure its own body is: the import alone registers
 * schemas and discriminators on the global instance. Task 16's grep sees
 * DIRECT imports only, so it stayed green while `freelanceGaps` pulled three
 * models in through `chaser.ts` (R52). This assertion is the check the grep
 * cannot make.
 *
 * Vitest isolates each test file's module graph, so the four imports below are
 * the whole graph this assertion measures.
 */
import { describe, it, expect } from "vitest";
import mongoose from "mongoose";

// Imported for their side effects — the module graph IS the subject here.
import "@/lib/format";
import "@/lib/freelanceView";
import "@/lib/freelanceVariants";
import "@/lib/freelanceGaps";
import "@/lib/freelanceHealth";

describe("view-model purity", () => {
  it("registers no Mongoose model when the view models load", () => {
    expect(mongoose.modelNames()).toEqual([]);
  });
});
