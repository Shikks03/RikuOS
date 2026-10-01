/**
 * The layout editor's moves and its disabling matrix (deck §8, R29, R31, R1).
 * Default arrangement: [today 8, todos 4] · [layers 3, push 8] · [week 12] · [done 12].
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
  it("Layers: → − + (↑ row 1 full, ↓ row 3 full; its row sums to 11)", () =>
    expect(can("layers")).toEqual(["right", "narrow", "widen"]));
  it("Push: ← − +", () => expect(can("push")).toEqual(["left", "narrow", "widen"]));
  it("Next 7 days: − only", () => expect(can("week")).toEqual(["narrow"]));
  it("Done this week: − only (row 4 has no ↓)", () => expect(can("done")).toEqual(["narrow"]));
});

describe("the moves", () => {
  it("← / → swap with the neighbour", () => {
    const l = applyEdit(D, "todos", "left");
    expect(l[0].map((e) => e.tile)).toEqual(["todos", "today"]);
    expect(applyEdit(l, "todos", "right")[0].map((e) => e.tile)).toEqual(["today", "todos"]);
  });
  it("↑ / ↓ move to the neighbouring row, at the end — when it has room", () => {
    let l = applyEdit(D, "week", "narrow"); // week 11
    l = applyEdit(l, "layers", "narrow"); // layers 2 — row 2 sums to 10
    expect(canEdit(l, "layers", "down")).toBe(false); // row 3 has 1 free
    for (let i = 0; i < 9; i++) l = applyEdit(l, "week", "narrow"); // week 2
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
  it("every reachable arrangement passes the strict write validator", () => {
    let l = copyLayout(D);
    const script: Array<[PersonalTile, EditAction]> = [
      ["todos", "widen"], ["today", "narrow"], ["today", "narrow"], ["todos", "widen"], ["push", "narrow"],
      ["layers", "up"], ["push", "left"], ["week", "narrow"], ["done", "narrow"], ["done", "up"],
    ];
    for (const [t, a] of script) {
      l = applyEdit(l, t, a);
      expect(validateLayout(l).ok).toBe(true);
    }
  });
});

describe("the caption, Save and Reset", () => {
  it("row full · 1 column left · N columns left", () => {
    expect(rowCaption(D, "today")).toBe("row full");
    expect(rowCaption(D, "layers")).toBe("1 column left");
    expect(rowCaption(applyEdit(D, "week", "narrow"), "week")).toBe("1 column left");
    expect(rowCaption(applyEdit(applyEdit(D, "week", "narrow"), "week", "narrow"), "week")).toBe("2 columns left");
  });
  it("the default is the default; one move makes it not", () => {
    expect(isDefaultLayout(D)).toBe(true);
    expect(isDefaultLayout(applyEdit(D, "push", "narrow"))).toBe(false);
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
