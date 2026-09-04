/**
 * settings.ts — validation for PATCH /api/settings. Pure, so the rules are
 * testable without a request or a database.
 *
 * Bounds mirror OsSettings' schema exactly (chaserNDays: integer 1–30). Unknown
 * keys are REJECTED rather than ignored: a silently-dropped "chaserEnable" typo
 * looks identical to a successful save, and this toggle is an agent's kill
 * switch.
 */

// This file now sits on sync-indexes.mts's import graph too — OsSettings.ts
// imports the constants below it under `node --experimental-strip-types`,
// which does not resolve "@/" tsconfig aliases. The `type` modifier here is
// load-bearing: strip-types erases type-only imports without resolving them,
// which is the only reason this "@/" import survives that script. Drop the
// `type`, or add any value import from "@/"-aliased code to this file, and
// `npm run migrate:indexes` breaks at runtime on an unresolvable specifier —
// and a real models/lib require cycle appears with it.
import type { OsSettingsPatch } from "@/lib/osSettings";

export type SettingsPatchResult =
  | { ok: true; value: OsSettingsPatch }
  | { ok: false; error: string };

const ALLOWED_KEYS = new Set([
  "chaserEnabled",
  "chaserNDays",
  "monitoringEnabled",
  "triageEnabled",
  "knowledgeBlock",
  "knowledgeReviewedAt",
  "nameableProjects",
  "holdingText",
  "demoSiteUrls",
]);

export const CHASER_N_DAYS_MIN = 1;
export const CHASER_N_DAYS_MAX = 30;
export const KNOWLEDGE_BLOCK_MAX = 4000;
export const NAMEABLE_PROJECTS_MAX = 20;
export const NAMEABLE_PROJECT_MAX_LENGTH = 200;
export const HOLDING_TEXT_MAX = 500;
export const DEMO_URLS_MAX = 20;
export const DEMO_URL_PACKAGE_KEY_MAX_LENGTH = 20;
export const DEMO_URL_MAX_LENGTH = 500;

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

  if ("triageEnabled" in b) {
    if (typeof b.triageEnabled !== "boolean") {
      return { ok: false, error: "triageEnabled must be a boolean." };
    }
    value.triageEnabled = b.triageEnabled;
  }

  if ("knowledgeBlock" in b) {
    if (typeof b.knowledgeBlock !== "string") {
      return { ok: false, error: "knowledgeBlock must be a string." };
    }
    if (b.knowledgeBlock.length > KNOWLEDGE_BLOCK_MAX) {
      return {
        ok: false,
        error: `knowledgeBlock must be at most ${KNOWLEDGE_BLOCK_MAX} characters.`,
      };
    }
    value.knowledgeBlock = b.knowledgeBlock;
    // The stamp means "Riku has read THIS text", not "Riku has read
    // something once". Editing the block without also supplying a stamp
    // re-opens the approval gate; otherwise a plain content edit would leave
    // a stale approval standing over text he never reviewed. An explicit
    // knowledgeReviewedAt in the same patch (handled below) still wins, so
    // "edit and re-approve in one request" stays possible.
    if (!("knowledgeReviewedAt" in b)) {
      value.knowledgeReviewedAt = null;
    }
  }

  if ("knowledgeReviewedAt" in b) {
    // Riku's approval stamp. Accepts a date string or explicit null (un-approve).
    if (b.knowledgeReviewedAt === null) {
      value.knowledgeReviewedAt = null;
    } else if (typeof b.knowledgeReviewedAt === "string") {
      const d = new Date(b.knowledgeReviewedAt);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, error: "knowledgeReviewedAt must be a date string or null." };
      }
      value.knowledgeReviewedAt = d;
    } else {
      return { ok: false, error: "knowledgeReviewedAt must be a date string or null." };
    }
  }

  if ("nameableProjects" in b) {
    const list = b.nameableProjects;
    const isStringArray = Array.isArray(list) && list.every((p): p is string => typeof p === "string");
    if (!isStringArray) {
      return { ok: false, error: "nameableProjects must be an array of strings." };
    }
    if (list.length > NAMEABLE_PROJECTS_MAX) {
      return {
        ok: false,
        error: `nameableProjects must have at most ${NAMEABLE_PROJECTS_MAX} entries.`,
      };
    }
    if (list.some((p) => p.length > NAMEABLE_PROJECT_MAX_LENGTH)) {
      return {
        ok: false,
        error: `Each nameable project must be at most ${NAMEABLE_PROJECT_MAX_LENGTH} characters.`,
      };
    }
    // Trimmed and checked for emptiness AFTER the length check, on the same
    // pattern as holdingText below: the cap holds on what was typed, not on
    // what survives trimming. An untrimmed or empty entry isn't cosmetic here
    // — it renders directly into the model's prompt as a bare "- " line
    // (draftTriage.ts's buildTriageUserMessage), which reads as a nameable
    // project with no name.
    const trimmedProjects = list.map((p) => p.trim());
    if (trimmedProjects.some((p) => p.length === 0)) {
      return { ok: false, error: "nameableProjects entries must not be empty." };
    }
    value.nameableProjects = trimmedProjects;
  }

  if ("holdingText" in b) {
    if (typeof b.holdingText !== "string" || b.holdingText.trim().length === 0) {
      return { ok: false, error: "holdingText must be a non-empty string." };
    }
    // Deliberately bounds-checked against the raw, untrimmed input — a
    // 501-char value that would trim down to 499 is still rejected here.
    // Conservative and safe, not a bug: the cap is meant to hold on what
    // Riku typed, not on what happens to survive trimming.
    if (b.holdingText.length > HOLDING_TEXT_MAX) {
      return { ok: false, error: `holdingText must be at most ${HOLDING_TEXT_MAX} characters.` };
    }
    // Stored trimmed so padding never reaches a client.
    value.holdingText = b.holdingText.trim();
  }

  if ("demoSiteUrls" in b) {
    const raw = b.demoSiteUrls;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, error: "demoSiteUrls must be an object of package to URL." };
    }
    const entries = Object.entries(raw as Record<string, unknown>);
    if (entries.length > DEMO_URLS_MAX) {
      return { ok: false, error: `demoSiteUrls must have at most ${DEMO_URLS_MAX} entries.` };
    }
    const parsed: { packageKey: string; url: string }[] = [];
    for (const [packageKey, url] of entries) {
      if (typeof url !== "string") {
        return { ok: false, error: `demoSiteUrls.${packageKey} must be a string URL.` };
      }
      if (packageKey.length > DEMO_URL_PACKAGE_KEY_MAX_LENGTH) {
        return {
          ok: false,
          error: `demoSiteUrls key "${packageKey}" must be at most ${DEMO_URL_PACKAGE_KEY_MAX_LENGTH} characters.`,
        };
      }
      if (url.length > DEMO_URL_MAX_LENGTH) {
        return {
          ok: false,
          error: `demoSiteUrls.${packageKey} must be at most ${DEMO_URL_MAX_LENGTH} characters.`,
        };
      }
      // http(s) only. A javascript: or data: URL reaching a client-facing
      // draft is the kind of mistake that is only noticed after sending.
      if (!/^https?:\/\/\S+$/.test(url)) {
        return { ok: false, error: `demoSiteUrls.${packageKey} must be an http(s) URL.` };
      }
      // Trimmed and checked for emptiness AFTER the length/format checks, same
      // reasoning as nameableProjects above: an empty-after-trim key renders
      // straight into the model's prompt as "- : https://x" — a package with
      // no name paired with a link the model is told it may send.
      const trimmedKey = packageKey.trim();
      if (trimmedKey.length === 0) {
        return { ok: false, error: "demoSiteUrls keys must not be empty." };
      }
      parsed.push({ packageKey: trimmedKey, url });
    }
    value.demoSiteUrls = parsed;
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, error: "No settings were supplied." };
  }
  return { ok: true, value };
}
