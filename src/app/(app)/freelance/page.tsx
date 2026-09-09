import type { Metadata } from "next";
import { connectDB } from "@/lib/db";
import { MONGO_READ_TIMEOUT_MS, withDeadline } from "@/lib/deadline";
import { readOsSettings } from "@/lib/osSettings";
import type { OsSettingsValues } from "@/lib/osSettings";
import { getHealthSnapshot } from "@/lib/healthSnapshot";
import type { StoredHealth } from "@/lib/healthSnapshot";
import { AGENT_STALE_HOURS } from "@/lib/watchdog";
import { evaluateOutreach } from "@/lib/outreachHealth";
import {
  ATTENTION_LIMIT,
  ST_PAGE_TIMEOUT_MS,
  fetchAttention,
  fetchSummary,
  fetchVariantStats,
} from "@/lib/stApi";
import { FAIL_LINES } from "@/lib/freelanceView";
import { buildHealthStrip } from "@/lib/freelanceHealth";
import { OS_SETTINGS_DEFAULTS } from "@/models/OsSettings";
import HealthStrip from "./_blocks/HealthStrip";

/**
 * Every figure on this page is "what is true right now", so there is nothing to
 * cache and nothing to revalidate.
 */
export const dynamic = "force-dynamic";

/**
 * A CONTAINMENT bound, and nothing more. maxDuration does not prevent a Vercel
 * error page — it SCHEDULES one, at 30 s instead of 60. The reader's protection
 * is the four timeouts above it: ST_PAGE_TIMEOUT_MS on each of the three
 * ShikksTracker calls, and MONGO_READ_TIMEOUT_MS on each of the two Mongo
 * reads. Those bound the worst case at 5 + 6 + 5 = 16 s and land in catches
 * that produce states this page already designed. This line only stops a
 * pathological render from running to the platform's own limit (R63).
 */
export const maxDuration = 30;

/**
 * The tab title. The root layout carries the `%s · APP_NAME` template, so this
 * one word is the whole page-side half of it: the product name is joined in
 * exactly one place and no page file ever writes it (R64).
 */
export const metadata: Metadata = { title: "Freelance" };

/** `PromiseSettledResult` -> the value, or null. */
function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

/**
 * Connect and both reads as one awaitable, so ONE deadline covers all three —
 * the same shape as AgentsBlock's readRail(), for the same reason. Mongoose has
 * no per-call timeout, so an accepted-and-never-answered query is bounded by
 * nothing without this (R63).
 *
 * readOsSettings, never getOsSettings: the latter is updateOsSettings({}) and
 * would make every page view a primary write (R37).
 */
async function readLocal(): Promise<{ settings: OsSettingsValues; stored: StoredHealth | null }> {
  await connectDB();
  const [settings, stored] = await Promise.all([readOsSettings(), getHealthSnapshot()]);
  return { settings, stored };
}

export default async function FreelancePage() {
  const now = new Date();

  // --- Phase 1: the local reads, in ONE try/catch ---------------------------
  //
  // A database failure must never blank the route. It degrades exactly three
  // things: the gap figure reads `—` (`couldn't load`), the stored site reading
  // is UNREADABLE rather than absent (the strip stamps `sites — unknown`), and
  // the monitoring switch is unknown. Everything ShikksTracker answers still
  // renders. A TIMEOUT lands in the same catch and therefore in the same three
  // degradations — there is no new state to draw for it (R63).
  let chaserNDays = OS_SETTINGS_DEFAULTS.chaserNDays;
  let monitoringEnabled = false;
  // "unread" is not null: null means the read succeeded and nothing has ever
  // been written, "unread" means the read itself failed and nothing is known
  // (R56). Rendering the second as `sites never checked` would be the strip
  // claiming to have seen something it never saw.
  let snapshot: StoredHealth | null | "unread" = null;
  try {
    const { settings, stored } = await withDeadline(
      readLocal(),
      MONGO_READ_TIMEOUT_MS,
      "freelance local reads"
    );
    chaserNDays = settings.chaserNDays;
    monitoringEnabled = settings.monitoringEnabled;
    snapshot = stored;
  } catch (err) {
    snapshot = "unread";
    console.error("[freelance] local reads failed:", err);
  }

  // --- Phase 2: ShikksTracker, in parallel ---------------------------------
  //
  // Promise.allSettled, not Promise.all — that is the whole per-block
  // degradation mechanism in one word. `cache: "no-store"` is already set
  // inside every stApi fetch.
  // No explicit generic: Promise.allSettled's `T extends readonly unknown[] | []`
  // constraint makes TypeScript infer a TUPLE from the array literal, so each
  // destructured result already carries its own type.
  const [summaryResult, attentionResult, variantsResult] = await Promise.allSettled([
    fetchSummary(ST_PAGE_TIMEOUT_MS),
    fetchAttention(chaserNDays, ATTENTION_LIMIT, ST_PAGE_TIMEOUT_MS),
    fetchVariantStats(ST_PAGE_TIMEOUT_MS),
  ]);

  const summary = settled(summaryResult);
  const attention = settled(attentionResult);
  const variants = settled(variantsResult);

  // --- The view models ------------------------------------------------------
  //
  // Only the strip is built here. Phase 3 and the five block builders arrive in
  // Tasks 3 to 6, each in the task that renders it, so no commit in this plan
  // ever leaves a computed value without a consumer (R47's principle, ruled for
  // Plan C on 2026-09-09).

  const strip = buildHealthStrip({
    now,
    findings: summary === null ? null : evaluateOutreach(now, summary),
    engineLastRunAt: summary?.engine.lastRunAt ?? null,
    snapshot,
    monitoringEnabled,
    staleHours: AGENT_STALE_HOURS,
  });

  // Whole page down is ALL THREE calls failing, not one. If any source
  // answered, every block renders and only the dead ones carry their own
  // sentence — which is what "one source down" means. The strip survives
  // either way, because site results are stored locally.
  const wholePageDown = summary === null && attention === null && variants === null;

  return (
    <main className="app-content">
      <div className="fl">
        {wholePageDown ? (
          <div className="fl-fail">
            <i />
            <div>
              <div className="said">{FAIL_LINES.page.said}</div>
              <div className="because">{FAIL_LINES.page.because}</div>
            </div>
          </div>
        ) : null}

        <HealthStrip strip={strip} />
      </div>
    </main>
  );
}
