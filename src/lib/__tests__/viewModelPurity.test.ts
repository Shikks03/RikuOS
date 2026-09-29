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
 * Vitest isolates each test file's module graph, so the side-effect imports
 * below are the whole graph this assertion measures.
 */
import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Imported for their side effects — the module graph IS the subject here.
import "@/lib/format";
import "@/lib/freelanceView";
import "@/lib/freelanceVariants";
import "@/lib/freelanceGaps";
import "@/lib/freelanceHealth";
// P10b: the pure half of the to-do store, which personalView.ts will import.
import "@/lib/todos";
// P10b Task 9: the six Personal view models (type-only imports of google.ts,
// lastDigest.ts, osSettings.ts and the Todo model must stay type-only).
import "@/lib/personalView";
// P10b integration: the layout's pure half (OsSettings imports it relatively)
// and the client-safe error sentences.
import "@/lib/personalLayout";
import "@/lib/personalErrors";

describe("view-model purity", () => {
  it("registers no Mongoose model when the view models load", () => {
    expect(mongoose.modelNames()).toEqual([]);
  });

  it("personalErrors.ts has no runtime import, so a client component can load it", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/personalErrors.ts"), "utf8");
    const imports = source.split(/\r?\n/).filter((line) => /^\s*(import|export)\b.*\bfrom\b/.test(line));
    expect(imports.length).toBeGreaterThan(0);
    for (const line of imports) expect(line).toMatch(/^\s*(import|export) type\b/);
    // A bare side-effect import (`import "x";`) has no `from`; refuse it too.
    expect(source).not.toMatch(/^\s*import\s+["']/m);
    expect(source).not.toMatch(/\brequire\(|\bimport\(/);
  });
});
