import { describe, it, expect } from "vitest";
import { dispatcherFromRow } from "@/lib/dispatcherRun";
import { NO_DEVICE_ERROR } from "@/lib/constants";

const startedAt = new Date("2026-09-09T23:00:00Z");

describe("dispatcherFromRow — the greeting line's one impure read, made pure for testing", () => {
  it("no row at all is null", () => {
    expect(dispatcherFromRow(null)).toBeNull();
    expect(dispatcherFromRow(undefined)).toBeNull();
  });

  it("a successful run is never noDevice", () => {
    expect(dispatcherFromRow({ ok: true, startedAt })).toEqual({ ok: true, startedAt, skipped: false, noDevice: false });
  });

  it("a failed run whose error starts with NO_DEVICE_ERROR is noDevice", () => {
    expect(dispatcherFromRow({ ok: false, startedAt, error: `${NO_DEVICE_ERROR} (0/2)` })).toEqual({
      ok: false,
      startedAt,
      skipped: false,
      noDevice: true,
    });
  });

  it("a failed run with some other error is not noDevice", () => {
    expect(dispatcherFromRow({ ok: false, startedAt, error: "ECONNRESET" })).toEqual({
      ok: false,
      startedAt,
      skipped: false,
      noDevice: false,
    });
  });

  it("a failed run with no error at all is not noDevice", () => {
    expect(dispatcherFromRow({ ok: false, startedAt })).toEqual({ ok: false, startedAt, skipped: false, noDevice: false });
  });

  it("an ok run whose error happens to start with the marker text is never noDevice (noDevice requires ok: false)", () => {
    expect(dispatcherFromRow({ ok: true, startedAt, error: NO_DEVICE_ERROR })?.noDevice).toBe(false);
  });

  it("an explicit `skipped` key wins over the ok&&error fallback", () => {
    expect(dispatcherFromRow({ ok: true, startedAt, skipped: true })?.skipped).toBe(true);
    expect(dispatcherFromRow({ ok: true, startedAt, skipped: false, error: "would have skipped" })?.skipped).toBe(false);
  });

  it("a pre-S9 row with no `skipped` key falls back to ok && typeof error === 'string'", () => {
    expect(dispatcherFromRow({ ok: true, startedAt, error: "monitoring off" })?.skipped).toBe(true);
    expect(dispatcherFromRow({ ok: false, startedAt, error: "monitoring off" })?.skipped).toBe(false);
    expect(dispatcherFromRow({ ok: true, startedAt })?.skipped).toBe(false);
  });
});
