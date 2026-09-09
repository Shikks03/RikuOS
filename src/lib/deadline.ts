/**
 * deadline.ts — a caller-side time bound on a promise.
 *
 * Mongoose has no per-call timeout: connectDB bounds server selection (10 s)
 * and a stalled socket (45 s), but a query that has been accepted and never
 * answered is bounded by neither. On a path that runs on every page — the
 * rail's agent read — that is the whole response held open. withDeadline puts
 * the bound where the caller can see it (R38).
 *
 * It does not cancel the inner promise: nothing here can, and a Mongo read
 * that lands late is harmless. It only stops the caller waiting.
 */

/** Clears a cold Atlas connect with room; half connectDB's server-selection bound. */
export const MONGO_READ_TIMEOUT_MS = 5000;

/**
 * Resolves with `promise` if it settles within `ms`, otherwise rejects with
 * `${label} timed out after ${ms}ms`. A rejection from `promise` propagates
 * unchanged. The timer is cleared whichever side wins, so a serverless
 * invocation is never held open by a pending setTimeout.
 */
export function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  return Promise.race([promise, deadline]).finally(() => {
    clearTimeout(timer);
  });
}
