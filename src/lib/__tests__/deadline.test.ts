/**
 * withDeadline is the only bound on the rail's database read, so the two
 * things it must never get wrong are both timing bugs that leave no trace in
 * production: a timer that outlives the race (a serverless invocation held
 * open by a pending setTimeout) and a losing promise whose late rejection
 * escapes as an unhandled error.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withDeadline } from "@/lib/deadline";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("withDeadline", () => {
  it("resolves with the promise's value and leaves no timer behind", async () => {
    const value = await withDeadline(Promise.resolve("six run records"), 5000, "rail read");

    expect(value).toBe("six run records");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits the whole bound, then rejects with the label and the ms", async () => {
    const neverSettles = new Promise<string>(() => {});
    let settled = false;
    const caught = withDeadline(neverSettles, 5000, "rail read").catch((error: unknown) => {
      settled = true;
      return error;
    });

    // At the last millisecond before the bound the caller is still waiting: a
    // deadline that fires early would cut off reads that were going to answer.
    await vi.advanceTimersByTimeAsync(4999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    expect(await caught).toBeInstanceOf(Error);
    expect(((await caught) as Error).message).toBe("rail read timed out after 5000ms");
  });

  it("propagates the promise's own rejection unchanged, and still clears the timer", async () => {
    const refused = new Error("Atlas refused the connection");
    const caught = await withDeadline(Promise.reject(refused), 5000, "rail read").catch(
      (error: unknown) => error
    );

    expect(caught).toBe(refused);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("survives the losing promise rejecting after the deadline already won", async () => {
    let fail: (error: Error) => void = () => {};
    const late = new Promise<string>((_resolve, reject) => {
      fail = reject;
    });
    const caught = withDeadline(late, 5000, "rail read").catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(5000);
    expect(await caught).toBeInstanceOf(Error);

    fail(new Error("the read failed long after nobody was waiting"));
    await vi.advanceTimersByTimeAsync(0);

    // Vitest fails the run on an unhandled rejection, so reaching this line
    // without one IS the assertion.
    expect(vi.getTimerCount()).toBe(0);
  });
});
