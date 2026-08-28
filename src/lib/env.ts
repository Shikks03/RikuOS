/**
 * env.ts — small server-side env helpers (ported from ShikksTracker).
 */

/** Parse an integer environment variable, falling back when unset or invalid. */
export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Parse a `limit` query param, clamped to `[1, max]`. Falls back to `def`
 * when the param is absent or fails to parse to a finite number. Every list
 * endpoint bounds its result set with this (CLAUDE.md).
 */
export function parseLimit(searchParams: URLSearchParams, def: number, max: number): number {
  const raw = searchParams.get("limit");
  if (!raw) return def;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return def;
  return Math.min(Math.max(1, parsed), max);
}
