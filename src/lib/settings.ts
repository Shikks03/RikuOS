/**
 * settings.ts — validation for PATCH /api/settings. Pure, so the rules are
 * testable without a request or a database.
 *
 * Bounds mirror OsSettings' schema exactly (chaserNDays: integer 1–30). Unknown
 * keys are REJECTED rather than ignored: a silently-dropped "chaserEnable" typo
 * looks identical to a successful save, and this toggle is an agent's kill
 * switch.
 *
 * `personalLayout` goes through validateLayout() and its typed message is the
 * 400's error verbatim. `layers` is the WHOLE array, replaced on write: the
 * Layers tile and the Settings picker both PATCH all of it, so two devices
 * editing at once is last-write-wins. Accepted and recorded (§7.5) — a
 * single-user tool does not need a version field for it.
 */

// Type-only on purpose. OsSettings.ts no longer imports bounds from this file
// (the five it took were all triage bounds, deleted with that lane in S15), so
// this file is off sync-indexes.mts's import graph again — but keep the `type`
// modifier anyway: it is what would let this file be re-imported from a model
// under `node --experimental-strip-types`, which erases type-only imports
// without resolving them and does NOT resolve "@/" tsconfig aliases.
import type { Layer, OsSettingsPatch } from "@/lib/osSettings";
import { validateLayout } from "@/lib/personalLayout";
import { LAYERS_MAX, LAYER_CALENDAR_ID_MAX, LAYER_NAME_MAX } from "@/models/OsSettings";

export type SettingsPatchResult =
  | { ok: true; value: OsSettingsPatch }
  | { ok: false; error: string };

// Derived from a record typed over every patch key (§7.5), so a setting added
// to OsSettingsPatch and forgotten here is a compile error, not a 400.
const PATCH_KEYS: Record<keyof OsSettingsPatch, true> = {
  chaserEnabled: true,
  chaserNDays: true,
  monitoringEnabled: true,
  layers: true,
  personalLayout: true,
};
const ALLOWED_KEYS: ReadonlySet<string> = new Set(Object.keys(PATCH_KEYS));
const LAYER_KEYS: ReadonlySet<string> = new Set(["calendarId", "name", "enabled"]);

function boundedString(v: unknown, max: number): v is string {
  return typeof v === "string" && v.length >= 1 && v.length <= max;
}

/** ≤ 10 objects of exactly {calendarId, name, enabled}; no duplicate calendarId. Returns clean copies. */
function parseLayers(input: unknown): { ok: true; value: Layer[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "layers must be a list." };
  if (input.length > LAYERS_MAX) {
    return { ok: false, error: `At most ${LAYERS_MAX} layers can be chosen.` };
  }
  const seen = new Set<string>();
  const out: Layer[] = [];
  for (let i = 0; i < input.length; i++) {
    const l: unknown = input[i];
    const n = i + 1;
    if (l === null || typeof l !== "object" || Array.isArray(l)) {
      return { ok: false, error: `Layer ${n} must be an object.` };
    }
    const o = l as Record<string, unknown>;
    const unknownKey = Object.keys(o).find((k) => !LAYER_KEYS.has(k));
    if (unknownKey !== undefined) {
      return { ok: false, error: `Layer ${n} has an unknown field "${unknownKey}".` };
    }
    if (!boundedString(o.calendarId, LAYER_CALENDAR_ID_MAX)) {
      return { ok: false, error: `Layer ${n}'s calendarId must be 1 to ${LAYER_CALENDAR_ID_MAX} characters.` };
    }
    if (!boundedString(o.name, LAYER_NAME_MAX)) {
      return { ok: false, error: `Layer ${n}'s name must be 1 to ${LAYER_NAME_MAX} characters.` };
    }
    if (typeof o.enabled !== "boolean") {
      return { ok: false, error: `Layer ${n}'s enabled must be a boolean.` };
    }
    if (seen.has(o.calendarId)) {
      return { ok: false, error: `Layer ${n} repeats a calendar already chosen.` };
    }
    seen.add(o.calendarId);
    out.push({ calendarId: o.calendarId, name: o.name, enabled: o.enabled });
  }
  return { ok: true, value: out };
}

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

  if ("monitoringEnabled" in b) {
    if (typeof b.monitoringEnabled !== "boolean") {
      return { ok: false, error: "monitoringEnabled must be a boolean." };
    }
    value.monitoringEnabled = b.monitoringEnabled;
  }

  if ("layers" in b) {
    const layers = parseLayers(b.layers);
    if (!layers.ok) return layers;
    value.layers = layers.value;
  }

  if ("personalLayout" in b) {
    const layout = validateLayout(b.personalLayout);
    if (!layout.ok) return { ok: false, error: layout.error };
    value.personalLayout = layout.value;
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, error: "No settings were supplied." };
  }
  return { ok: true, value };
}
