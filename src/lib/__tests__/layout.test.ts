/**
 * personalLayout.ts is the Personal page's whole arrangement: what a stored
 * layout may be (validateLayout, strict on write), what the page does when it
 * is not (resolvePersonalLayout, total on read), and how a layout becomes
 * grid classes and a track list (collapseRow, buildCells, buildTracks) —
 * §5.4, §7.5, R1, R3, R5 -> R53 -> R91, R40.
 *
 * Every expected value below is worked by hand in its comment, so a reader
 * can check the arithmetic without running anything.
 */

import { describe, it, expect } from "vitest";
import {
  PERSONAL_TILES,
  PERSONAL_ROWS,
  PERSONAL_LAYOUT_DEFAULT,
  clampSpan,
  collapseRow,
  compactRows,
  buildCells,
  buildTracks,
  formCapable,
  validateLayout,
  resolvePersonalLayout,
  resolveLayoutAgainst,
  type PersonalLayout,
} from "@/lib/personalLayout";

/** A deep copy of the default, to mutate per case. */
function def(): PersonalLayout {
  return PERSONAL_LAYOUT_DEFAULT.map((row) => row.map((e) => ({ ...e })));
}

const W = (px: number) => `minmax(calc(${px}px + var(--tb)), auto)`;

describe("the constants", () => {
  it("names the six tiles once each", () => {
    expect([...PERSONAL_TILES]).toEqual(["today", "todos", "layers", "push", "week", "done"]);
  });

  it("weighs the rows 340 · 200 · 240 · 120 (R4, R39: row 2 is 200, not 180)", () => {
    expect([...PERSONAL_ROWS]).toEqual([340, 200, 240, 120]);
  });

  it("the default is itself a valid layout", () => {
    expect(validateLayout(PERSONAL_LAYOUT_DEFAULT)).toEqual({ ok: true, value: PERSONAL_LAYOUT_DEFAULT });
  });
});

describe("validateLayout — strict on write", () => {
  it("accepts the default", () => {
    const r = validateLayout(def());
    expect(r.ok).toBe(true);
  });

  it("accepts an empty row (§4.8)", () => {
    const layout: PersonalLayout = [
      [{ tile: "today", span: 8 }, { tile: "todos", span: 4 }],
      [],
      [{ tile: "week", span: 12 }],
      [{ tile: "done", span: 4 }, { tile: "layers", span: 3 }, { tile: "push", span: 5 }],
    ];
    expect(validateLayout(layout).ok).toBe(true);
  });

  it("rejects a missing tile", () => {
    const layout = def();
    layout[3] = [];
    expect(validateLayout(layout)).toEqual({ ok: false, error: 'Tile "done" is missing from the layout.' });
  });

  it("rejects a duplicate", () => {
    const layout = def();
    layout[3] = [{ tile: "done", span: 6 }, { tile: "today", span: 6 }];
    expect(validateLayout(layout)).toEqual({ ok: false, error: 'Tile "today" appears more than once.' });
  });

  it("rejects a span of 1", () => {
    const layout = def();
    layout[1][0] = { tile: "layers", span: 1 };
    expect(validateLayout(layout)).toEqual({
      ok: false,
      error: 'Tile "layers" must span a whole number of columns from 2 to 12.',
    });
  });

  it("rejects a span of 13", () => {
    const layout = def();
    layout[2][0] = { tile: "week", span: 13 };
    expect(validateLayout(layout)).toEqual({
      ok: false,
      error: 'Tile "week" must span a whole number of columns from 2 to 12.',
    });
  });

  it("rejects a row over 12", () => {
    const layout = def();
    layout[1] = [{ tile: "layers", span: 4 }, { tile: "push", span: 9 }]; // 13
    expect(validateLayout(layout)).toEqual({ ok: false, error: "Row 2 is wider than 12 columns." });
  });

  it("rejects three rows", () => {
    expect(validateLayout(def().slice(0, 3))).toEqual({
      ok: false,
      error: "A layout has exactly 4 rows.",
    });
  });

  it("rejects an unknown tile and a non-array", () => {
    const layout = def() as unknown as Array<Array<{ tile: string; span: number }>>;
    layout[3][0] = { tile: "weather", span: 12 };
    expect(validateLayout(layout)).toEqual({ ok: false, error: "Row 4 holds an unknown tile." });
    expect(validateLayout("nope")).toEqual({ ok: false, error: "A layout has exactly 4 rows." });
  });

  it("returns a clean copy, not the caller's objects", () => {
    const input = def() as unknown as Array<Array<Record<string, unknown>>>;
    input[0][0].extra = "x";
    const r = validateLayout(input);
    expect(r.ok && r.value[0][0]).toEqual({ tile: "today", span: 8 });
    expect(r.ok && r.value[0][0]).not.toBe(input[0][0]);
  });
});

describe("clampSpan", () => {
  it("passes integers 2..12 through", () => {
    for (let n = 2; n <= 12; n++) expect(clampSpan(n)).toBe(n);
  });
  it("sends everything else to 2", () => {
    for (const v of [1, 13, 0, -4, 2.5, NaN, Infinity, "8", null, undefined]) {
      expect(clampSpan(v)).toBe(2);
    }
  });
});

describe("collapseRow — ceil, then trim the widest (ties at the last index) to ≤ 6 (R1)", () => {
  it("[3,9]: ceil [2,5] = 7, trim the 5 -> [2,4]", () => {
    expect(collapseRow([3, 9])).toEqual([2, 4]);
  });

  it("[5,7]: ceil [3,4] = 7, trim the 4 -> [3,3]", () => {
    expect(collapseRow([5, 7])).toEqual([3, 3]);
  });

  it("[3,3,5]: a NON-FULL row (11 of 12) whose ceil sum is 7 — one trim -> [2,2,2]", () => {
    // Σsᵢ + #odd = 11 + 3 = 14 > 12, so it overflows though it is not full.
    const ceilSum = [3, 3, 5].map((s) => Math.ceil(s / 2)).reduce((a, b) => a + b, 0);
    expect(ceilSum).toBe(7);
    expect(collapseRow([3, 3, 5])).toEqual([2, 2, 2]);
  });

  it("[3,3,3,3]: ceil [2,2,2,2] = 8, the loop trims twice -> [2,2,1,1]", () => {
    expect(collapseRow([3, 3, 3, 3])).toEqual([2, 2, 1, 1]);
  });

  it("leaves the six-span-2 row untouched: [2×6] -> [1×6]", () => {
    expect(collapseRow([2, 2, 2, 2, 2, 2])).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("halves the default's rows (§5.4's specimen 05)", () => {
    expect(collapseRow([8, 4])).toEqual([4, 2]);
    expect(collapseRow([3, 8])).toEqual([2, 4]); // 11 at twelve, 6 at six — no leftover
    expect(collapseRow([12])).toEqual([6]);
  });

  it("does not mutate its input", () => {
    const spans = [3, 3, 3, 3];
    collapseRow(spans);
    expect(spans).toEqual([3, 3, 3, 3]);
  });
});

describe("compactRows", () => {
  it("drops empty rows and keeps the order of the rest", () => {
    const layout = def();
    layout[1] = [];
    layout[0].push({ tile: "layers", span: 0 } as never); // content is not its concern
    expect(compactRows(layout).map((r) => r.map((e) => e.tile))).toEqual([
      ["today", "todos", "layers"],
      ["week"],
      ["done"],
    ]);
  });
});

describe("buildTracks", () => {
  it("emits the four weights for the default", () => {
    expect(buildTracks(PERSONAL_LAYOUT_DEFAULT, false)).toBe([W(340), W(200), W(240), W(120)].join(" "));
  });

  it("compacts an empty row and renumbers, each survivor keeping its own row's weight", () => {
    const layout: PersonalLayout = [
      [{ tile: "today", span: 3 }, { tile: "todos", span: 3 }, { tile: "layers", span: 3 }, { tile: "push", span: 3 }],
      [],
      [{ tile: "week", span: 12 }],
      [{ tile: "done", span: 12 }],
    ];
    // the mockup's edit-mode specimen: 340 · 240 · 120
    expect(buildTracks(layout, false)).toBe([W(340), W(240), W(120)].join(" "));
    expect(buildTracks(layout, true)).toBe([W(340), W(240), W(120)].join(" "));
  });

  it("emits auto for a row whose only occupant is narrower than the row (R53)", () => {
    const layout: PersonalLayout = [
      [{ tile: "push", span: 4 }],
      [{ tile: "layers", span: 3 }, { tile: "today", span: 8 }],
      [{ tile: "week", span: 12 }],
      [{ tile: "done", span: 6 }, { tile: "todos", span: 6 }],
    ];
    expect(buildTracks(layout, false)).toBe(["auto", W(200), W(240), W(120)].join(" "));
  });

  it("keeps the weight for a one-occupant row that fills the row", () => {
    expect(buildTracks(PERSONAL_LAYOUT_DEFAULT, false).startsWith("auto")).toBe(false);
  });

  it("does NOT emit auto for a two-tile row summing to 5 (R91 narrows R5)", () => {
    const layout: PersonalLayout = [
      [{ tile: "push", span: 3 }, { tile: "layers", span: 2 }],
      [{ tile: "today", span: 8 }, { tile: "todos", span: 4 }],
      [{ tile: "week", span: 12 }],
      [{ tile: "done", span: 12 }],
    ];
    expect(buildTracks(layout, false)).toBe([W(340), W(200), W(240), W(120)].join(" "));
  });

  it("never emits auto while editing (R5's surviving suspension)", () => {
    const layout: PersonalLayout = [
      [{ tile: "push", span: 4 }],
      [{ tile: "layers", span: 3 }, { tile: "today", span: 8 }],
      [{ tile: "week", span: 12 }],
      [{ tile: "done", span: 6 }, { tile: "todos", span: 6 }],
    ];
    const tracks = buildTracks(layout, true);
    expect(tracks.split(" ").some((t) => t === "auto")).toBe(false);
    expect(tracks).toBe([W(340), W(200), W(240), W(120)].join(" "));
  });
});

describe("buildCells", () => {
  it("places the default in normal view: no leftover cell drawn", () => {
    expect(buildCells(PERSONAL_LAYOUT_DEFAULT, false)).toEqual([
      { tile: "today", rowClass: "pe-r1", spanClass: "pe-s8", collapsedClass: "pe-x4" },
      { tile: "todos", rowClass: "pe-r1", spanClass: "pe-s4", collapsedClass: "pe-x2" },
      { tile: "layers", rowClass: "pe-r2", spanClass: "pe-s3", collapsedClass: "pe-x2" },
      { tile: "push", rowClass: "pe-r2", spanClass: "pe-s8", collapsedClass: "pe-x4" },
      { tile: "week", rowClass: "pe-r3", spanClass: "pe-s12", collapsedClass: "pe-x6" },
      { tile: "done", rowClass: "pe-r4", spanClass: "pe-s12", collapsedClass: "pe-x6" },
    ]);
  });

  it("in edit mode adds row 2's leftover: 1 column at twelve, none at six (pe-s1 pe-x0)", () => {
    const gaps = buildCells(PERSONAL_LAYOUT_DEFAULT, true).filter((c) => c.tile === null);
    expect(gaps).toEqual([{ tile: null, rowClass: "pe-r2", spanClass: "pe-s1", collapsedClass: "pe-x0" }]);
  });

  it("the leftover trails its row's tiles", () => {
    const cells = buildCells(PERSONAL_LAYOUT_DEFAULT, true);
    expect(cells.map((c) => c.tile)).toEqual(["today", "todos", "layers", "push", null, "week", "done"]);
  });

  it("emits a leftover at both counts for a sparse row (pe-sN and pe-xN)", () => {
    const layout: PersonalLayout = [
      [{ tile: "push", span: 4 }], // 8 left at twelve; ceil 2 -> 4 left at six
      [{ tile: "layers", span: 3 }, { tile: "today", span: 9 }],
      [{ tile: "week", span: 12 }],
      [{ tile: "done", span: 6 }, { tile: "todos", span: 6 }],
    ];
    const gaps = buildCells(layout, true).filter((c) => c.tile === null);
    expect(gaps).toEqual([{ tile: null, rowClass: "pe-r1", spanClass: "pe-s8", collapsedClass: "pe-x4" }]);
  });

  it("[3,3,5] leaves 1 at twelve and 0 at six once trimmed", () => {
    const layout: PersonalLayout = [
      [{ tile: "today", span: 3 }, { tile: "todos", span: 3 }, { tile: "layers", span: 5 }],
      [{ tile: "push", span: 12 }],
      [{ tile: "week", span: 12 }],
      [{ tile: "done", span: 12 }],
    ];
    const row1 = buildCells(layout, true).filter((c) => c.rowClass === "pe-r1");
    expect(row1.map((c) => c.collapsedClass)).toEqual(["pe-x2", "pe-x2", "pe-x2", "pe-x0"]);
    expect(row1[3]).toEqual({ tile: null, rowClass: "pe-r1", spanClass: "pe-s1", collapsedClass: "pe-x0" });
  });

  it("renumbers rows after compaction and draws nothing for an empty row", () => {
    const layout: PersonalLayout = [
      [{ tile: "today", span: 3 }, { tile: "todos", span: 3 }, { tile: "layers", span: 3 }, { tile: "push", span: 3 }],
      [],
      [{ tile: "week", span: 12 }],
      [{ tile: "done", span: 12 }],
    ];
    const cells = buildCells(layout, true);
    expect(cells.map((c) => `${c.tile}:${c.rowClass}:${c.collapsedClass}`)).toEqual([
      "today:pe-r1:pe-x2",
      "todos:pe-r1:pe-x2",
      "layers:pe-r1:pe-x1",
      "push:pe-r1:pe-x1",
      "week:pe-r2:pe-x6",
      "done:pe-r3:pe-x6",
    ]);
  });

  it("clamps every number: an out-of-range span becomes 2, a class no rule lacks", () => {
    const layout = [
      [{ tile: "today", span: 99 }, { tile: "todos", span: 1.5 }],
      [{ tile: "layers", span: -3 }, { tile: "push", span: Number.NaN }],
      [{ tile: "week", span: 12 }],
      [{ tile: "done", span: 12 }],
    ] as PersonalLayout;
    const cells = buildCells(layout, true);
    const valid = /^pe-r[1-4]$|^pe-s([0-9]|1[0-2])$|^pe-x[0-6]$/;
    for (const c of cells) {
      expect(c.rowClass).toMatch(valid);
      expect(c.spanClass).toMatch(valid);
      expect(c.collapsedClass).toMatch(valid);
    }
    expect(cells.filter((c) => c.tile !== null).map((c) => c.spanClass)).toEqual([
      "pe-s2", "pe-s2", "pe-s2", "pe-s2", "pe-s12", "pe-s12",
    ]);
  });

  it("clamps a row that sums over 12 to no leftover rather than a negative one", () => {
    const layout: PersonalLayout = [
      [{ tile: "today", span: 12 }, { tile: "todos", span: 12 }],
      [{ tile: "layers", span: 3 }, { tile: "push", span: 8 }],
      [{ tile: "week", span: 12 }],
      [{ tile: "done", span: 12 }],
    ];
    const row1 = buildCells(layout, true).filter((c) => c.rowClass === "pe-r1");
    expect(row1.every((c) => c.tile !== null)).toBe(true);
  });

  it("emits at most four row classes, whatever it is handed", () => {
    const five = [...def(), [{ tile: "done", span: 2 }]] as PersonalLayout;
    expect(buildCells(five, false).every((c) => /^pe-r[1-4]$/.test(c.rowClass))).toBe(true);
  });
});

describe("formCapable — R40's 213px form floor, from the row (lead ruling)", () => {
  it("the default's Today (8) and To-do (4) are both capable", () => {
    expect(formCapable([8, 4], 0)).toBe(true);
    expect(formCapable([8, 4], 1)).toBe(true);
  });

  it("span 4 (264px at an 820px grid) clears the 213px floor (R40)", () => {
    expect(formCapable([4, 8], 0)).toBe(true);
  });

  it("span 3 (194.5px at an 820px grid) is under the 213px floor (R40)", () => {
    expect(formCapable([3, 8], 0)).toBe(false);
  });

  it("span 2 (111px at an 820px grid, 106px at six) is under the 213px floor (R40)", () => {
    expect(formCapable([2, 10], 0)).toBe(false);
  });

  it("a span 4 trimmed to one column at six (106px) is under the 213px floor (R40): [3,3,4,2] index 2", () => {
    expect(collapseRow([3, 3, 4, 2])).toEqual([2, 2, 1, 1]);
    expect(formCapable([3, 3, 4, 2], 2)).toBe(false);
  });

  it("[4,4,4]: each two columns at six (226px) and 264px at twelve — all capable", () => {
    expect([0, 1, 2].map((i) => formCapable([4, 4, 4], i))).toEqual([true, true, true]);
  });

  it("an out-of-range span or index is not capable", () => {
    expect(formCapable([Number.NaN, 8], 0)).toBe(false);
    expect(formCapable([8, 4], 2)).toBe(false);
    expect(formCapable([8, 4], -1)).toBe(false);
  });
});

describe("resolvePersonalLayout — total on read", () => {
  it("resolves a valid stored layout as itself, fellBack false", () => {
    const stored = def();
    stored[1] = [{ tile: "push", span: 8 }, { tile: "layers", span: 4 }];
    expect(resolvePersonalLayout(stored)).toEqual({ layout: stored, fellBack: false });
  });

  it("falls back to the default for anything unreadable, fellBack true", () => {
    for (const bad of [undefined, null, "x", 42, {}, [], [[], [], []], [[{ tile: "today", span: 1 }], [], [], []]]) {
      expect(resolvePersonalLayout(bad)).toEqual({ layout: PERSONAL_LAYOUT_DEFAULT, fellBack: true });
    }
  });

  it("falls back for a duplicate or a row over 12", () => {
    const dup = def();
    dup[3].push({ tile: "today", span: 0 } as never);
    expect(resolvePersonalLayout(dup).fellBack).toBe(true);
    const wide = def();
    wide[1] = [{ tile: "layers", span: 5 }, { tile: "push", span: 8 }];
    expect(resolvePersonalLayout(wide).fellBack).toBe(true);
  });

  it("hands back a copy the caller cannot use to mutate the default", () => {
    const { layout } = resolvePersonalLayout(undefined);
    layout[0][0].span = 2;
    expect(PERSONAL_LAYOUT_DEFAULT[0][0].span).toBe(8);
  });

  it("appends a tile the stored layout predates (the six tiles resolve against today's six)", () => {
    const stored = def();
    stored[3] = []; // stored before "done" existed
    const r = resolvePersonalLayout(stored);
    expect(r.fellBack).toBe(false);
    expect(r.layout[3]).toEqual([{ tile: "done", span: 12 }]);
    expect(validateLayout(r.layout).ok).toBe(true);
  });

  describe("the P11 clause: six stored tiles against a seven-tile default", () => {
    const TILES7 = ["today", "todos", "layers", "push", "week", "done", "habits"] as const;
    const DEFAULT7 = [
      [{ tile: "today", span: 8 }, { tile: "todos", span: 4 }],
      [{ tile: "layers", span: 3 }, { tile: "push", span: 8 }],
      [{ tile: "week", span: 12 }],
      [{ tile: "done", span: 6 }, { tile: "habits", span: 6 }],
    ] as const;

    it("keeps all six placements and appends the newcomer", () => {
      // Riku's own arrangement, which differs from both defaults.
      const stored = [
        [{ tile: "push", span: 4 }, { tile: "today", span: 8 }],
        [{ tile: "todos", span: 5 }, { tile: "layers", span: 3 }],
        [{ tile: "week", span: 12 }],
        [{ tile: "done", span: 4 }],
      ];
      const r = resolveLayoutAgainst(stored, TILES7, DEFAULT7);
      expect(r.fellBack).toBe(false);
      // every one of the six is exactly where it was
      expect(r.layout[0]).toEqual(stored[0]);
      expect(r.layout[1]).toEqual(stored[1]);
      expect(r.layout[2]).toEqual(stored[2]);
      expect(r.layout[3].slice(0, 1)).toEqual(stored[3]);
      // and the newcomer lands in its default row, at its default span
      expect(r.layout[3][1]).toEqual({ tile: "habits", span: 6 });
      expect(r.layout.flat()).toHaveLength(7);
    });

    it("puts the newcomer in the next row with room when its default row is full", () => {
      const stored = [
        [{ tile: "push", span: 4 }, { tile: "today", span: 8 }],
        [{ tile: "todos", span: 5 }, { tile: "layers", span: 3 }],
        [{ tile: "week", span: 12 }],
        [{ tile: "done", span: 12 }],
      ];
      const r = resolveLayoutAgainst(stored, TILES7, DEFAULT7);
      expect(r.fellBack).toBe(false);
      expect(r.layout[3]).toEqual(stored[3]);
      // rows after 4 do not exist, so it wraps to row 1 (full), then row 2 (4 free)
      expect(r.layout[1]).toEqual([...stored[1], { tile: "habits", span: 4 }]);
    });

    it("falls back only when no row has two columns free", () => {
      const stored = [
        [{ tile: "push", span: 4 }, { tile: "today", span: 8 }],
        [{ tile: "todos", span: 6 }, { tile: "layers", span: 6 }],
        [{ tile: "week", span: 12 }],
        [{ tile: "done", span: 12 }],
      ];
      const r = resolveLayoutAgainst(stored, TILES7, DEFAULT7);
      expect(r.fellBack).toBe(true);
      expect(r.layout).toEqual(DEFAULT7);
    });
  });
});
