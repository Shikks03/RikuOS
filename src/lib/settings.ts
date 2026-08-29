/**
 * settings.ts — validation for PATCH /api/settings. Pure, so the rules are
 * testable without a request or a database.
 *
 * Bounds mirror OsSettings' schema exactly (chaserNDays: integer 1–30). Unknown
 * keys are REJECTED rather than ignored: a silently-dropped "chaserEnable" typo
 * looks identical to a successful save, and this toggle is an agent's kill
 * switch.
 */

import type { OsSettingsPatch } from "@/lib/osSettings";

export type SettingsPatchResult =
  | { ok: true; value: OsSettingsPatch }
  | { ok: false; error: string };

const ALLOWED_KEYS = new Set(["chaserEnabled", "chaserNDays"]);

export const CHASER_N_DAYS_MIN = 1;
export const CHASER_N_DAYS_MAX = 30;

export function parseSettingsPatch(body: unknown): SettingsPatchResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;

  for (const key of Object.keys(b)) {
    if (!ALLOWED_KEYS.has(key)) {
      return { ok: false, error: `Unknown setting "${key}".` };
    }
  }

  const value: OsSettingsPatch = {};

  if ("chaserEnabled" in b) {
    if (typeof b.chaserEnabled !== "boolean") {
      return { ok: false, error: "chaserEnabled must be a boolean." };
    }
    value.chaserEnabled = b.chaserEnabled;
  }

  if ("chaserNDays" in b) {
    const n = b.chaserNDays;
    if (
      typeof n !== "number" ||
      !Number.isInteger(n) ||
      n < CHASER_N_DAYS_MIN ||
      n > CHASER_N_DAYS_MAX
    ) {
      return {
        ok: false,
        error: `chaserNDays must be a whole number between ${CHASER_N_DAYS_MIN} and ${CHASER_N_DAYS_MAX}.`,
      };
    }
    value.chaserNDays = n;
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, error: "No settings were supplied." };
  }
  return { ok: true, value };
}
