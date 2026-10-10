import { describe, it, expect } from "vitest";
import {
  CALENDAR_FAIL,
  CALENDAR_FAIL_CAUSES,
  CALENDAR_FAIL_CAUSES_COMPLETE,
  ENTRY_LEFT,
  PIN_UNSURE,
  UNPIN_FAILED,
  calendarLine,
  eventFailSentence,
  isCalendarFailCause,
} from "@/lib/personalErrors";

const ALL = [...Object.values(CALENDAR_FAIL).flatMap((t) => Object.values(t)), ...Object.values(ENTRY_LEFT), PIN_UNSURE, UNPIN_FAILED];

describe("the calendar messages (S21, spec §7.4, amended 2026-10-10)", () => {
  it("has a sentence for every action and every cause", () => {
    for (const action of ["event", "pin", "move", "update"] as const) {
      for (const cause of CALENDAR_FAIL_CAUSES) expect(CALENDAR_FAIL[action][cause].length).toBeGreaterThan(0);
    }
  });

  it("S1: CALENDAR_FAIL_CAUSES is provably complete at compile time", () => {
    // If this were false the file would already have failed to compile —
    // this assertion is just making the proof visible at runtime too.
    expect(CALENDAR_FAIL_CAUSES_COMPLETE).toBe(true);
  });

  it("speaks in whole sentences: no old frames, curly apostrophes only, never 'Done' after a delete or an unpin", () => {
    for (const s of ALL) {
      expect(s).not.toMatch(/Google didn’t accept it:|calendar entry failed:|couldn’t be moved:/);
      expect(s).not.toMatch(/'/);
      expect(s).toMatch(/[.]$/);
    }
    expect(ENTRY_LEFT.delete.startsWith("Deleted.")).toBe(true);
    expect(ENTRY_LEFT.done.startsWith("Done.")).toBe(true);
    expect(UNPIN_FAILED).not.toMatch(/^Done/);
  });

  // S2 (2026-10-10 review): every row of spec §7.4 (amended), pinned exactly.
  const ROWS: ReadonlyArray<[action: "event" | "pin" | "move" | "update", cause: (typeof CALENDAR_FAIL_CAUSES)[number], sentence: string]> = [
    ["event", "not-configured", "I couldn’t add that. Google isn’t connected yet. You can set it up in Settings."],
    ["event", "expired", "I couldn’t add that. My access to Google has expired. You can renew it in Settings."],
    ["event", "refused", "Google turned that one down, so it’s not on your calendar."],
    ["event", "gone", "I couldn’t add that. That calendar isn’t on your Google account anymore."],
    ["event", "changed", "I couldn’t add that, and I’m not sure why. Have a look in Google Calendar."],
    ["event", "store", "I couldn’t add that, and I’m not sure why. Have a look in Google Calendar."],
    ["pin", "not-configured", "Saved, but I couldn’t put it on your calendar. Google isn’t connected yet."],
    ["pin", "expired", "Saved, but I couldn’t put it on your calendar. My Google access has expired."],
    ["pin", "refused", "Saved, but Google wouldn’t take the calendar entry."],
    ["pin", "gone", "Saved, but I couldn’t find your main calendar on Google, so it’s not on there."],
    ["pin", "changed", "Saved, but the to-do changed somewhere else while I was adding it, so I left it off the calendar."],
    ["pin", "store", "Saved, but I couldn’t keep track of the calendar entry, so I took it back off."],
    ["move", "not-configured", "Saved the new date, but I couldn’t move the calendar entry. Google isn’t connected yet."],
    ["move", "expired", "Saved the new date, but I couldn’t move the calendar entry. My Google access has expired."],
    ["move", "refused", "Saved the new date, but Google wouldn’t move the calendar entry."],
    ["move", "gone", "Saved the new date. Its calendar entry had already been deleted in Google, so I’ve unlinked it."],
    ["move", "changed", "Saved the new date, but I couldn’t move the calendar entry."],
    ["move", "store", "Saved the new date, but I couldn’t move the calendar entry."],
    ["update", "not-configured", "Saved, but I couldn’t update the calendar entry. Google isn’t connected yet."],
    ["update", "expired", "Saved, but I couldn’t update the calendar entry. My Google access has expired."],
    ["update", "refused", "Saved, but Google wouldn’t update the calendar entry."],
    ["update", "gone", "Saved. Its calendar entry had already been deleted in Google, so I’ve unlinked it."],
    ["update", "changed", "Saved, but I couldn’t update the calendar entry."],
    ["update", "store", "Saved, but I couldn’t update the calendar entry."],
  ];

  it.each(ROWS)("CALENDAR_FAIL.%s.%s reads exactly", (action, cause, sentence) => {
    expect(CALENDAR_FAIL[action][cause]).toBe(sentence);
  });

  it("PIN_UNSURE, ENTRY_LEFT and UNPIN_FAILED read exactly", () => {
    expect(PIN_UNSURE).toBe(
      "Saved. I’m not sure whether the calendar entry went through, so have a look in Google Calendar before switching it on again.",
    );
    expect(ENTRY_LEFT.done).toBe("Done. I couldn’t remove its calendar entry, though, so you’ll want to delete it in Google Calendar.");
    expect(ENTRY_LEFT.delete).toBe("Deleted. I couldn’t remove its calendar entry, though, so you’ll want to delete it in Google Calendar.");
    expect(UNPIN_FAILED).toBe("I couldn’t take it off your Google calendar, so it’s still pinned. Switch it off again to retry.");
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
    expect(calendarLine("update", { kind: "failed", cause: "refused", orphaned: false })).toEqual({
      text: "Saved, but Google wouldn’t update the calendar entry.",
      dot: "stale",
    });
    expect(calendarLine("update", { kind: "unknown", orphaned: false })).toEqual({ text: "Couldn’t tell if that saved.", dot: null });
    expect(calendarLine("move", { kind: "unknown", orphaned: false })).toEqual({ text: "Couldn’t tell if that saved.", dot: null });
    expect(calendarLine("delete", { kind: "unknown", orphaned: true })).toEqual({ text: ENTRY_LEFT.delete, dot: "stale" });
    expect(calendarLine("pin", { kind: "ok" })).toBeNull();
    expect(calendarLine("move", { kind: "none" })).toBeNull();

    // W2 (2026-10-10 ruling): a DEFINITE unpin failure says "still pinned" —
    // todoStore.ts's unpinLeg keeps calendarEventId for the retry on failure.
    expect(calendarLine("unpin", { kind: "failed", cause: "refused", orphaned: false })).toEqual({ text: UNPIN_FAILED, dot: "stale" });
    // An UNKNOWN (or null) unpin outcome may have landed either way, so it
    // must not claim "still pinned" — it reads like a move's unknown case.
    expect(calendarLine("unpin", { kind: "unknown", orphaned: false })).toEqual({ text: "Couldn’t tell if that saved.", dot: null });
    expect(calendarLine("unpin", null)).toEqual({ text: "Couldn’t tell if that saved.", dot: null });
  });

  it("eventFailSentence reads the event table", () => {
    expect(eventFailSentence("gone")).toBe("I couldn’t add that. That calendar isn’t on your Google account anymore.");
  });

  // S2 (2026-10-10 review): the cause-guard moved here from TodoForm.tsx.
  describe("isCalendarFailCause", () => {
    it.each([
      ["__proto__", false],
      ["toString", false],
      ["bogus-cause", false],
      ["expired", true],
    ] as const)("%s → %s", (cause, expected) => {
      expect(isCalendarFailCause(cause)).toBe(expected);
    });
  });
});
