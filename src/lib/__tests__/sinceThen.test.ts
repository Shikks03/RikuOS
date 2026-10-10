import { describe, it, expect } from "vitest";
import { sinceThenLines, type SinceThenInput } from "@/lib/sinceThen";

const SENT = new Date("2026-09-09T23:00:00Z"); // 07:00 Manila
const NOW = new Date("2026-09-10T06:30:00Z"); // 14:30 Manila
const at = (hhmm: string) => new Date(`2026-09-10T${hhmm}:00+08:00`);

const NOTHING: SinceThenInput = {
  ticked: { titles: [], total: 0 },
  newDue: { titles: [], total: 0 },
  events: { events: [], partial: false },
  newDrafts: 0,
};

describe("sinceThenLines", () => {
  it("says so plainly when nothing has changed", () => {
    expect(sinceThenLines(NOTHING, SENT, NOW)).toEqual(["Nothing new since 07:00."]);
  });

  it("names one ticked to-do, counts several", () => {
    expect(sinceThenLines({ ...NOTHING, ticked: { titles: ["Essay draft"], total: 1 } }, SENT, NOW)).toEqual([
      "You’ve ticked off Essay draft.",
    ]);
    expect(sinceThenLines({ ...NOTHING, ticked: { titles: ["a", "b", "c"], total: 3 } }, SENT, NOW)).toEqual([
      "You’ve ticked off three to-dos.",
    ]);
  });

  it("names a new to-do due today, counts several", () => {
    expect(sinceThenLines({ ...NOTHING, newDue: { titles: ["Renew the domain"], total: 1 } }, SENT, NOW)).toEqual([
      "One new to-do is due today: Renew the domain.",
    ]);
    expect(sinceThenLines({ ...NOTHING, newDue: { titles: ["a", "b"], total: 2 } }, SENT, NOW)).toEqual([
      "Two new to-dos are due today.",
    ]);
  });

  // Fix round 1, item 3: find() and countDocuments() run in parallel in
  // sinceThenRead, so a total of 1 can arrive with zero titles (a to-do
  // ticked, or created, between the two reads settling). Grammar must stay
  // singular without a name to point to.
  it("stays grammatical when the count is one but the race left no title", () => {
    expect(sinceThenLines({ ...NOTHING, ticked: { titles: [], total: 1 } }, SENT, NOW)).toEqual([
      "You’ve ticked off one to-do.",
    ]);
    expect(sinceThenLines({ ...NOTHING, newDue: { titles: [], total: 1 } }, SENT, NOW)).toEqual([
      "One new to-do is due today.",
    ]);
  });

  it("tells the day so far: what's done and what's next", () => {
    const events = [
      { title: "Math Methods", allDay: false, startsAt: at("09:00"), endsAt: at("10:30") },
      { title: "Gym", allDay: false, startsAt: at("18:00"), endsAt: at("19:00") },
      { title: "Foundation Day", allDay: true, startsAt: null, endsAt: null },
    ];
    expect(sinceThenLines({ ...NOTHING, events: { events, partial: false } }, SENT, NOW)).toEqual([
      "Math Methods is done.",
      "Next up: Gym at 18:00.",
    ]);
  });

  it("says nothing else is on once the last timed event is past", () => {
    const events = [
      { title: "A", allDay: false, startsAt: at("09:00"), endsAt: at("10:00") },
      { title: "B", allDay: false, startsAt: at("11:00"), endsAt: at("12:00") },
    ];
    expect(sinceThenLines({ ...NOTHING, events: { events, partial: false } }, SENT, NOW)).toEqual([
      "Two things on your calendar are done.",
      "Nothing else on today.",
    ]);
  });

  it("does not call an event in progress done", () => {
    const events = [{ title: "Long one", allDay: false, startsAt: at("14:00"), endsAt: at("16:00") }];
    expect(sinceThenLines({ ...NOTHING, events: { events, partial: false } }, SENT, NOW)).toEqual([
      "Nothing new since 07:00.",
    ]);
  });

  // Fix round 1, item 2: a done event earlier today must not license "Nothing
  // else on today." while a later event is still running. "done" and
  // "in progress" are not exhaustive — "Next up" only covers a future start.
  it("does not say nothing else is on while a later event is in progress", () => {
    const events = [
      { title: "A", allDay: false, startsAt: at("09:00"), endsAt: at("10:00") },
      { title: "Long one", allDay: false, startsAt: at("14:00"), endsAt: at("16:00") },
    ];
    expect(sinceThenLines({ ...NOTHING, events: { events, partial: false } }, SENT, NOW)).toEqual([
      "A is done.",
    ]);
  });

  it("counts new drafts in the queue", () => {
    expect(sinceThenLines({ ...NOTHING, newDrafts: 1 }, SENT, NOW)).toEqual(["One new draft is waiting for your review."]);
    expect(sinceThenLines({ ...NOTHING, newDrafts: 2 }, SENT, NOW)).toEqual(["Two new drafts are waiting for your review."]);
  });

  it("says each failed read on its own and still shows the rest", () => {
    expect(
      sinceThenLines(
        { ticked: "unavailable", newDue: "unavailable", events: "unavailable", newDrafts: 2 },
        SENT,
        NOW,
      ),
    ).toEqual([
      "I couldn’t check your to-dos just now.",
      "I couldn’t check your calendar just now.",
      "Two new drafts are waiting for your review.",
    ]);
    expect(sinceThenLines({ ...NOTHING, newDrafts: "unavailable" }, SENT, NOW)).toEqual([
      "I couldn’t check the queue just now.",
    ]);
  });

  it("says nothing about the calendar when every layer is off", () => {
    expect(sinceThenLines({ ...NOTHING, events: "none-enabled" }, SENT, NOW)).toEqual(["Nothing new since 07:00."]);
  });

  // Fix round 1, item 1: one failed layer beside a working one must not be
  // read as a complete, quiet calendar.
  it("flags a partial calendar read and never claims nothing else is on", () => {
    const events = [{ title: "A", allDay: false, startsAt: at("09:00"), endsAt: at("10:00") }];
    expect(sinceThenLines({ ...NOTHING, events: { events, partial: true } }, SENT, NOW)).toEqual([
      "A is done.",
      "I couldn’t check every calendar just now.",
    ]);
  });

  it("still shows Next up on a partial read, alongside the partial flag", () => {
    const events = [{ title: "Gym", allDay: false, startsAt: at("18:00"), endsAt: at("19:00") }];
    expect(sinceThenLines({ ...NOTHING, events: { events, partial: true } }, SENT, NOW)).toEqual([
      "Next up: Gym at 18:00.",
      "I couldn’t check every calendar just now.",
    ]);
  });
});
