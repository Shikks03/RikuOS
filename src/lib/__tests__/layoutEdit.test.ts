/**
 * The layout editor's moves and its disabling matrix (deck §8, R29, R31, R1).
 * Default arrangement (S21, push retired): [today 8, todos 4] · [layers 12] · [week 12] · [done 12].
 */
import { describe, it, expect } from "vitest";
import {
  EDIT_SIBLING,
  applyEdit,
  canEdit,
  copyLayout,
  formCapableAt,
  isDefaultLayout,
  locate,
  rowCaption,
  sameLayout,
  type EditAction,
} from "@/lib/layoutEdit";
import { PERSONAL_LAYOUT_DEFAULT, validateLayout, type PersonalTile } from "@/lib/personalLayout";

const D = PERSONAL_LAYOUT_DEFAULT;
const ALL: EditAction[] = ["left", "right", "up", "down", "narrow", "widen"];
const can = (tile: PersonalTile, layout = D) => ALL.filter((a) => canEdit(layout, tile, a));

describe("the disabling matrix on the default arrangement (specimen 04)", () => {
  it("Today: → and − only (row 1, row full)", () => expect(can("today")).toEqual(["right", "narrow"]));
  it("To-do: ← and − only", () => expect(can("todos")).toEqual(["left", "narrow"]));
  // CHANGED MEANING (S21): Layers is now alone on row 2 at span 12 (push
  // retired), so its row is full both ways — no →, ↑ or ↓, widen refused too.
  it("Layers: − only (alone on a full row)", () => expect(can("layers")).toEqual(["narrow"]));
  it("Next 7 days: − only", () => expect(can("week")).toEqual(["narrow"]));
  it("Done this week: − only (row 4 has no ↓)", () => expect(can("done")).toEqual(["narrow"]));
});

describe("the moves", () => {
  it("← / → swap with the neighbour", () => {
    const l = applyEdit(D, "todos", "left");
    expect(l[0].map((e) => e.tile)).toEqual(["todos", "today"]);
    expect(applyEdit(l, "todos", "right")[0].map((e) => e.tile)).toEqual(["today", "todos"]);
  });
  // CHANGED MEANING (S21): layers now starts alone at span 12 (not span 3
  // beside push), so it takes ten narrows to reach span 2, not one.
  it("↑ / ↓ move to the neighbouring row, at the end — when it has room", () => {
    let l = applyEdit(D, "week", "narrow"); // week 11, row 3 has 1 free
    for (let i = 0; i < 10; i++) l = applyEdit(l, "layers", "narrow"); // layers 12 -> 2
    expect(canEdit(l, "layers", "down")).toBe(false); // row 3 has 1 free, layers needs 2
    for (let i = 0; i < 9; i++) l = applyEdit(l, "week", "narrow"); // week 2, row 3 has 10 free
    expect(canEdit(l, "layers", "down")).toBe(true);
    l = applyEdit(l, "layers", "down");
    expect(l[2].map((e) => e.tile)).toEqual(["week", "layers"]);
    expect(locate(l, "layers")).toEqual({ row: 2, index: 1 });
  });
  it("empty rows are legal: moving the only tile out leaves the row empty", () => {
    let l = copyLayout(D);
    for (let i = 0; i < 10; i++) l = applyEdit(l, "done", "narrow"); // done 2
    for (let i = 0; i < 10; i++) l = applyEdit(l, "week", "narrow"); // week 2
    l = applyEdit(l, "done", "up");
    expect(l[3]).toEqual([]);
    expect(validateLayout(l).ok).toBe(true);
  });
  it("− stops at 2 and + at a row of 12, by the twelve-column sum alone (R1)", () => {
    let l = copyLayout(D);
    for (let i = 0; i < 20; i++) l = applyEdit(l, "week", "narrow");
    expect(l[2][0].span).toBe(2);
    expect(canEdit(l, "week", "narrow")).toBe(false);
    for (let i = 0; i < 20; i++) l = applyEdit(l, "week", "widen");
    expect(l[2][0].span).toBe(12);
    expect(canEdit(l, "week", "widen")).toBe(false);
  });
  it("a refused move returns an unchanged copy, never the same object", () => {
    const l = applyEdit(D, "today", "left");
    expect(sameLayout(l, D)).toBe(true);
    expect(l).not.toBe(D);
  });
  // Every step below is a REAL move against the actual D — never a refused
  // no-op — including one applied left/right reorder and one applied up/down
  // row move (layers narrowed down to fit beside week, then moved into its
  // row). The in-loop canEdit assertion is load-bearing: without it, a script
  // that was quietly all narrows/widens (no reorder, no row move) would still
  // make validateLayout pass and hollow out the test's own name.
  it("every reachable arrangement passes the strict write validator", () => {
    let l = copyLayout(D);
    const script: Array<[PersonalTile, EditAction]> = [
      ["todos", "left"], ["today", "narrow"], ["todos", "widen"],
      ...Array.from({ length: 6 }, (): [PersonalTile, EditAction] => ["layers", "narrow"]),
      ...Array.from({ length: 6 }, (): [PersonalTile, EditAction] => ["week", "narrow"]),
      ["layers", "down"], ["done", "narrow"],
    ];
    for (const [t, a] of script) {
      expect(canEdit(l, t, a)).toBe(true);
      l = applyEdit(l, t, a);
      expect(validateLayout(l).ok).toBe(true);
    }
  });
});

describe("the caption, Save and Reset", () => {
  it("row full · 1 column left · N columns left", () => {
    expect(rowCaption(D, "today")).toBe("row full");
    expect(rowCaption(D, "layers")).toBe("row full"); // CHANGED (S21): layers alone fills row 2 now
    expect(rowCaption(applyEdit(D, "week", "narrow"), "week")).toBe("1 column left");
    expect(rowCaption(applyEdit(applyEdit(D, "week", "narrow"), "week", "narrow"), "week")).toBe("2 columns left");
  });
  it("the default is the default; one move makes it not", () => {
    expect(isDefaultLayout(D)).toBe(true);
    expect(isDefaultLayout(applyEdit(D, "layers", "narrow"))).toBe(false);
  });
  it("siblings pair both ways", () => {
    for (const a of ALL) expect(EDIT_SIBLING[EDIT_SIBLING[a]]).toBe(a);
  });
});

describe("formCapableAt — the working copy's form floor (R40)", () => {
  it("Today at 8 and To-do at 4 are capable; at 3 To-do is not", () => {
    expect(formCapableAt(D, "today")).toBe(true);
    expect(formCapableAt(D, "todos")).toBe(true);
    let l = applyEdit(D, "todos", "narrow");
    expect(formCapableAt(l, "todos")).toBe(false);
    l = applyEdit(l, "todos", "widen");
    expect(formCapableAt(l, "todos")).toBe(true);
  });
});
