import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { GoogleError } from "@/lib/google";
import type { Layer } from "@/lib/osSettings";
import {
  BAD_JSON,
  DELETE_FAILED,
  EVENT_TITLE_MAX,
  SAVE_FAILED,
  createReply,
  deleteReply,
  doneReply,
  eventCreatedReply,
  eventFailedReply,
  parseEventInput,
  parseTodoPatch,
  updateReply,
} from "@/lib/personalWrites";

const LAYERS: Layer[] = [
  { calendarId: "primary", name: "Riku", enabled: true },
  { calendarId: "classes@group.calendar.google.com", name: "Classes", enabled: true },
  { calendarId: "off@group.calendar.google.com", name: "Old", enabled: false },
];

const ok = { kind: "ok" } as const;

describe("personalWrites — purity", () => {
  it("registers no Mongoose model (todoStore imports are type-only)", () => {
    expect(mongoose.modelNames()).toEqual([]);
  });
});

describe("to-do replies", () => {
  it("create: invalid → 400 with the code; created → 201 with id and calendar", () => {
    expect(createReply({ kind: "invalid", error: "title-too-long" })).toEqual({
      status: 400,
      body: { error: "title-too-long" },
    });
    expect(createReply({ kind: "created", id: "abc", calendar: ok })).toEqual({
      status: 201,
      body: { id: "abc", calendar: ok },
    });
  });

  it("a saved to-do whose calendar leg failed or is unknown is still 2xx, carrying the outcome", () => {
    const failed = { kind: "failed", cause: "expired", orphaned: false } as const;
    const unknown = { kind: "unknown", orphaned: true } as const;
    expect(createReply({ kind: "created", id: "a", calendar: unknown }).status).toBe(201);
    expect(updateReply({ kind: "saved", calendar: failed })).toEqual({ status: 200, body: { calendar: failed } });
    expect(doneReply({ kind: "saved", done: true, calendar: unknown })).toEqual({
      status: 200,
      body: { done: true, calendar: unknown },
    });
    expect(deleteReply({ kind: "deleted", calendar: unknown })).toEqual({ status: 200, body: { calendar: unknown } });
  });

  it("update: store refusals are plain 400s; not-found is 404", () => {
    expect(updateReply({ kind: "invalid", error: "done-cannot-pin" })).toEqual({
      status: 400,
      body: { error: "done-cannot-pin" },
    });
    expect(updateReply({ kind: "invalid", error: "needs-due" }).status).toBe(400);
    expect(updateReply({ kind: "not-found" })).toEqual({ status: 404, body: { error: "not-found" } });
  });

  it("done and delete: not-found is 404", () => {
    expect(doneReply({ kind: "not-found" }).status).toBe(404);
    expect(doneReply({ kind: "invalid", error: "bad-done" }).status).toBe(400);
    expect(deleteReply({ kind: "not-found" }).status).toBe(404);
  });

  it("a thrown own-write is 500 with the deck's sentence; bad JSON is 400", () => {
    expect(SAVE_FAILED).toEqual({ status: 500, body: { error: "Couldn't save." } });
    expect(DELETE_FAILED).toEqual({ status: 500, body: { error: "Couldn't delete." } });
    expect(BAD_JSON.status).toBe(400);
  });
});

describe("parseTodoPatch", () => {
  it("{ done } alone is the tick", () => {
    expect(parseTodoPatch({ done: true })).toEqual({ ok: true, value: { kind: "done", done: true } });
    expect(parseTodoPatch({ done: false })).toEqual({ ok: true, value: { kind: "done", done: false } });
  });

  it("a non-boolean done is bad-done", () => {
    expect(parseTodoPatch({ done: "yes" })).toEqual({ ok: false, error: "bad-done" });
  });

  it("done beside any other key is refused, never half-applied", () => {
    expect(parseTodoPatch({ done: true, title: "x" })).toEqual({ ok: false, error: "mixed-patch" });
  });

  it("anything else is an edit, validated by parseUpdateTodo", () => {
    expect(parseTodoPatch({ title: " Buy milk " })).toEqual({
      ok: true,
      value: { kind: "edit", input: { title: "Buy milk" } },
    });
    expect(parseTodoPatch({ title: "x".repeat(141) })).toEqual({ ok: false, error: "title-too-long" });
    expect(parseTodoPatch({})).toEqual({ ok: false, error: "empty-patch" });
    expect(parseTodoPatch({ colour: "red" })).toEqual({ ok: false, error: "unknown-field" });
  });

  it("a non-object body is not-object", () => {
    for (const b of [null, [], "done", 3]) expect(parseTodoPatch(b)).toEqual({ ok: false, error: "not-object" });
  });
});

describe("parseEventInput", () => {
  const good = { title: "Dentist", calendarId: "primary", dayKey: "2026-09-28", allDay: false, start: "09:00", end: "10:00" };

  it("accepts a timed event on a switched-on layer", () => {
    expect(parseEventInput(good, LAYERS)).toEqual({
      ok: true,
      value: {
        calendarId: "primary",
        event: { title: "Dentist", allDay: false, dayKey: "2026-09-28", start: "09:00", end: "10:00" },
      },
    });
  });

  it("accepts an all-day event and ignores start/end", () => {
    expect(parseEventInput({ ...good, allDay: true, start: "bad" }, LAYERS)).toEqual({
      ok: true,
      value: { calendarId: "primary", event: { title: "Dentist", allDay: true, dayKey: "2026-09-28" } },
    });
  });

  it("title: 1–200 after trimming", () => {
    expect(parseEventInput({ ...good, title: "   " }, LAYERS)).toEqual({ ok: false, error: "no-title" });
    expect(parseEventInput({ ...good, title: 5 }, LAYERS)).toEqual({ ok: false, error: "no-title" });
    expect(parseEventInput({ ...good, title: "x".repeat(EVENT_TITLE_MAX) }, LAYERS).ok).toBe(true);
    expect(parseEventInput({ ...good, title: "x".repeat(EVENT_TITLE_MAX + 1) }, LAYERS)).toEqual({
      ok: false,
      error: "title-too-long",
    });
  });

  it("THE BOUNDARY: a calendarId not among the stored layers is refused", () => {
    expect(parseEventInput({ ...good, calendarId: "someone-else@gmail.com" }, LAYERS)).toEqual({
      ok: false,
      error: "bad-calendar",
    });
    expect(parseEventInput({ ...good, calendarId: undefined }, LAYERS)).toEqual({ ok: false, error: "bad-calendar" });
    expect(parseEventInput({ ...good, calendarId: ["primary"] }, LAYERS)).toEqual({ ok: false, error: "bad-calendar" });
    expect(parseEventInput(good, [])).toEqual({ ok: false, error: "bad-calendar" });
  });

  it("a stored layer that is switched off is refused as layer-off", () => {
    expect(parseEventInput({ ...good, calendarId: "off@group.calendar.google.com" }, LAYERS)).toEqual({
      ok: false,
      error: "layer-off",
    });
  });

  it("dayKey must be a real day", () => {
    for (const d of ["2026-02-30", "2026-9-28", "", null]) {
      expect(parseEventInput({ ...good, dayKey: d }, LAYERS)).toEqual({ ok: false, error: "bad-day" });
    }
  });

  it("allDay must be a boolean", () => {
    expect(parseEventInput({ ...good, allDay: "false" }, LAYERS)).toEqual({ ok: false, error: "bad-all-day" });
  });

  it("times must be HH:MM and start before end", () => {
    for (const t of [{ start: "9:00" }, { end: "24:00" }, { start: undefined }, { end: "10:60" }]) {
      expect(parseEventInput({ ...good, ...t }, LAYERS)).toEqual({ ok: false, error: "bad-time" });
    }
    expect(parseEventInput({ ...good, start: "10:00", end: "10:00" }, LAYERS)).toEqual({
      ok: false,
      error: "end-before-start",
    });
    expect(parseEventInput({ ...good, start: "11:00", end: "10:00" }, LAYERS)).toEqual({
      ok: false,
      error: "end-before-start",
    });
  });

  it("validates in §7.6's order: title before calendar before day before allDay", () => {
    const bad = { title: "", calendarId: "nope", dayKey: "x", allDay: "y" };
    expect(parseEventInput(bad, LAYERS)).toEqual({ ok: false, error: "no-title" });
    expect(parseEventInput({ ...bad, title: "a" }, LAYERS)).toEqual({ ok: false, error: "bad-calendar" });
    expect(parseEventInput({ ...bad, title: "a", calendarId: "primary" }, LAYERS)).toEqual({
      ok: false,
      error: "bad-day",
    });
  });
});

describe("event replies", () => {
  it("created → 201 with id, htmlLink and an ok outcome", () => {
    expect(eventCreatedReply({ id: "e1", htmlLink: "https://calendar.google.com/x" })).toEqual({
      status: 201,
      body: { id: "e1", htmlLink: "https://calendar.google.com/x", calendar: { kind: "ok" } },
    });
  });

  it("not connected / expired → 503 failed", () => {
    for (const kind of ["not-configured", "expired"] as const) {
      expect(eventFailedReply(new GoogleError(kind, "m"))).toEqual({
        status: 503,
        body: { error: "calendar-failed", calendar: { kind: "failed", cause: kind, orphaned: false } },
      });
    }
  });

  it("Google refused (4xx) or the calendar is gone → 502 failed", () => {
    expect(eventFailedReply(new GoogleError("http", "m", 403))).toEqual({
      status: 502,
      body: { error: "calendar-failed", calendar: { kind: "failed", cause: "refused", orphaned: false } },
    });
    expect(eventFailedReply(new GoogleError("gone", "m", 404)).body.calendar).toEqual({
      kind: "failed",
      cause: "gone",
      orphaned: false,
    });
  });

  it("timeout, 5xx, no status, or a non-Google error → 504 unknown, never failed", () => {
    const unknown = { status: 504, body: { error: "calendar-unknown", calendar: { kind: "unknown", orphaned: false } } };
    expect(eventFailedReply(new GoogleError("timeout", "m"))).toEqual(unknown);
    expect(eventFailedReply(new GoogleError("http", "m", 503))).toEqual(unknown);
    expect(eventFailedReply(new GoogleError("http", "m"))).toEqual(unknown);
    expect(eventFailedReply(new Error("boom"))).toEqual(unknown);
  });
});
