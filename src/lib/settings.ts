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
export const HOLDING_TEXT_MAX = 500;
export const DEMO_URLS_MAX = 20;

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
  }

  if ("knowledgeReviewedAt" in b) {
    // Riku's approval stamp. Accepts an ISO string or explicit null (un-approve).
    if (b.knowledgeReviewedAt === null) {
      value.knowledgeReviewedAt = null;
    } else if (typeof b.knowledgeReviewedAt === "string") {
      const d = new Date(b.knowledgeReviewedAt);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, error: "knowledgeReviewedAt must be an ISO date or null." };
      }
      value.knowledgeReviewedAt = d;
    } else {
      return { ok: false, error: "knowledgeReviewedAt must be an ISO date or null." };
    }
  }

  if ("nameableProjects" in b) {
    const list = b.nameableProjects;
    if (!Array.isArray(list) || list.some((p) => typeof p !== "string")) {
      return { ok: false, error: "nameableProjects must be an array of strings." };
    }
    if (list.length > NAMEABLE_PROJECTS_MAX) {
      return {
        ok: false,
        error: `nameableProjects must have at most ${NAMEABLE_PROJECTS_MAX} entries.`,
      };
    }
    if (list.some((p) => (p as string).length > 200)) {
      return { ok: false, error: "Each nameable project must be at most 200 characters." };
    }
    value.nameableProjects = list as string[];
  }

  if ("holdingText" in b) {
    if (typeof b.holdingText !== "string" || b.holdingText.trim().length === 0) {
      return { ok: false, error: "holdingText must be a non-empty string." };
    }
    if (b.holdingText.length > HOLDING_TEXT_MAX) {
      return { ok: false, error: `holdingText must be at most ${HOLDING_TEXT_MAX} characters.` };
    }
    value.holdingText = b.holdingText;
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
      // http(s) only. A javascript: or data: URL reaching a client-facing
      // draft is the kind of mistake that is only noticed after sending.
      if (!/^https?:\/\/\S+$/.test(url)) {
        return { ok: false, error: `demoSiteUrls.${packageKey} must be an http(s) URL.` };
      }
      if (packageKey.length > 20 || url.length > 500) {
        return { ok: false, error: `demoSiteUrls.${packageKey} is too long.` };
      }
      parsed.push({ packageKey, url });
    }
    value.demoSiteUrls = parsed;
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, error: "No settings were supplied." };
  }
  return { ok: true, value };
}
