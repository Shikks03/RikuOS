import { describe, it, expect } from "vitest";
import { CALENDAR_FAIL, CALENDAR_FAIL_CAUSES, ENTRY_LEFT, PIN_UNSURE, calendarLine, eventFailSentence } from "@/lib/personalErrors";

const ALL = [...Object.values(CALENDAR_FAIL).flatMap((t) => Object.values(t)), ...Object.values(ENTRY_LEFT), PIN_UNSURE];

describe("the calendar messages (S21, spec §7.4)", () => {
  it("has a sentence for every action and every cause", () => {
    for (const action of ["event", "pin", "move"] as const) {
      for (const cause of CALENDAR_FAIL_CAUSES) expect(CALENDAR_FAIL[action][cause].length).toBeGreaterThan(0);
    }
  });

  it("speaks in whole sentences: no old frames, curly apostrophes only, never 'Done' after a delete", () => {
    for (const s of ALL) {
      expect(s).not.toMatch(/Google didn’t accept it:|calendar entry failed:|couldn’t be moved:/);
      expect(s).not.toMatch(/'/);
      expect(s).toMatch(/[.]$/);
    }
    expect(ENTRY_LEFT.delete.startsWith("Deleted.")).toBe(true);
    expect(ENTRY_LEFT.done.startsWith("Done.")).toBe(true);
    expect(ENTRY_LEFT.unpin).not.toMatch(/^Done/);
  });

  it("uses the approved wording", () => {
    expect(CALENDAR_FAIL.event.expired).toBe("I couldn’t add that. My access to Google has expired. You can renew it in Settings.");
    expect(CALENDAR_FAIL.pin.changed).toBe(
      "Saved, but the to-do changed somewhere else while I was adding it, so I left it off the calendar.",
    );
    expect(CALENDAR_FAIL.move.gone).toBe("Saved the new date. Its calendar entry had already been deleted in Google, so I’ve unlinked it.");
  });

  it("calendarLine picks the sentence for each leg", () => {
    expect(calendarLine("pin", { kind: "failed", cause: "refused", orphaned: false })).toEqual({
      text: "Saved, but Google wouldn’t take the calendar entry.",
      dot: "stale",
    });
    expect(calendarLine("pin", { kind: "failed", cause: "refused", orphaned: true })).toEqual({ text: PIN_UNSURE, dot: "stale" });
    expect(calendarLine("pin", { kind: "unknown", orphaned: true })).toEqual({ text: PIN_UNSURE, dot: "stale" });
    expect(calendarLine("move", { kind: "failed", cause: "expired", orphaned: false })?.text).toBe(
      "Saved the new date, but I couldn’t move the calendar entry. My Google access has expired.",
    );
    expect(calendarLine("move", { kind: "unknown", orphaned: false })).toEqual({ text: "Couldn’t tell if that saved.", dot: null });
    expect(calendarLine("unpin", { kind: "failed", cause: "refused", orphaned: false })).toEqual({ text: ENTRY_LEFT.unpin, dot: "stale" });
    expect(calendarLine("delete", { kind: "unknown", orphaned: true })).toEqual({ text: ENTRY_LEFT.delete, dot: "stale" });
    expect(calendarLine("pin", { kind: "ok" })).toBeNull();
    expect(calendarLine("move", { kind: "none" })).toBeNull();
    expect(calendarLine("unpin", null)).toEqual({ text: ENTRY_LEFT.unpin, dot: "stale" });
  });

  it("eventFailSentence reads the event table", () => {
    expect(eventFailSentence("gone")).toBe("I couldn’t add that. That calendar isn’t on your Google account anymore.");
  });
});
