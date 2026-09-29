import { describe, it, expect } from "vitest";
import { compareEvents, type EventOrderFields } from "@/lib/eventOrder";

const e = (title: string, dayKey: string, startsAt: string | null): EventOrderFields => ({
  title,
  dayKey,
  allDay: startsAt === null,
  startsAt: startsAt === null ? null : new Date(startsAt),
});

describe("compareEvents", () => {
  it("orders by day, then all-day first, then start, then title", () => {
    const events = [
      e("Lab", "2026-09-11", "2026-09-11T00:00:00Z"),
      e("Lecture", "2026-09-10", "2026-09-10T01:00:00Z"),
      e("Beta", "2026-09-10", "2026-09-10T00:00:00Z"),
      e("Alpha", "2026-09-10", "2026-09-10T00:00:00Z"),
      e("Birthday", "2026-09-10", null),
    ];
    expect([...events].sort(compareEvents).map((x) => x.title)).toEqual(["Birthday", "Alpha", "Beta", "Lecture", "Lab"]);
  });

  it("is the one comparator: google.ts and personalView.ts import it rather than keep a copy", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["src/lib/google.ts", "src/lib/personalView.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source).toMatch(/import \{ compareEvents \} from "@\/lib\/eventOrder";/);
      expect(source).not.toMatch(/function compareEvents\(/);
    }
  });
});
