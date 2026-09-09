import type { Metadata } from "next";
import { connectDB } from "@/lib/db";
import { MONGO_READ_TIMEOUT_MS, withDeadline } from "@/lib/deadline";
import { readOsSettings } from "@/lib/osSettings";
import type { OsSettingsValues } from "@/lib/osSettings";
import { getHealthSnapshot } from "@/lib/healthSnapshot";
import type { StoredHealth } from "@/lib/healthSnapshot";
import { fetchLiveAnchorIds } from "@/lib/queue";
import { AGENT_STALE_HOURS } from "@/lib/watchdog";
import { evaluateOutreach } from "@/lib/outreachHealth";
import {
  ATTENTION_LIMIT,
  ST_PAGE_TIMEOUT_MS,
  fetchAttention,
  fetchSummary,
  fetchVariantStats,
  readStConfig,
} from "@/lib/stApi";
import { FAIL_LINES, buildBlockA, buildBlockB } from "@/lib/freelanceView";
import { buildBlockE, needsYouFigure } from "@/lib/freelanceGaps";
import { buildHealthStrip } from "@/lib/freelanceHealth";
import { OS_SETTINGS_DEFAULTS } from "@/models/OsSettings";
import HealthStrip from "./_blocks/HealthStrip";
import HeroRow from "./_blocks/HeroRow";
import StateOfPlay from "./_blocks/StateOfPlay";
import Pipeline from "./_blocks/Pipeline";

/**
 * Every figure on this page is "what is true right now", so there is nothing to
 * cache and nothing to revalidate.
 */
export const dynamic = "force-dynamic";

/**
 * A CONTAINMENT bound, and nothing more. maxDuration does not prevent a Vercel
 * error page — it SCHEDULES one, at 30 s instead of the platform's own default.
 * The reader's protection is the four timeouts above it: ST_PAGE_TIMEOUT_MS on
 * each of the three ShikksTracker calls, and MONGO_READ_TIMEOUT_MS on each of
 * the two Mongo reads. Those bound the worst case at 5 + 6 + 5 = 16 s and land
 * in catches that produce states this page already designed. This line only
 * stops a pathological render from running to the platform's own limit (R63).
 */
export const maxDuration = 30;

/**
 * The tab title. The root layout carries the `%s · APP_NAME` template, so this
 * one word is the whole page-side half of it: the product name is joined in
 * exactly one place and no page file ever writes it (R64).
 */
export const metadata: Metadata = { title: "Freelance" };

/**
 * `PromiseSettledResult` -> the value, or null — and a rejection is LOGGED with
 * the call named, so the sentence on screen, a block's or the page's, has a
 * line in the log saying which of 401 / 503 / 404 / timeout it was; stApi's
 * messages were written to say exactly that, and readStConfig omits the secret
 * from its message by design (R70).
 */
function settled<T>(result: PromiseSettledResult<T>, label: string): T | null {
  if (result.status === "fulfilled") return result.value;
  console.error(`[freelance] ${label} failed:`, result.reason);
  return null;
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

  // The two ShikksTracker URLs are built HERE, server-side, and passed down as
  // plain strings. ST_API_BASE_URL never reaches a client bundle and no view
  // model reads an environment variable. A missing config throws, and the three
  // calls in phase 2 would throw for the same reason, so the page lands in its
  // whole-page-down state and the links never render.
  let baseUrl = "";
  try {
    baseUrl = readStConfig().baseUrl;
  } catch {
    // Left empty on purpose; see above.
  }

  // --- Phase 1: the local reads, in ONE try/catch ---------------------------
  //
  // A database failure must never blank the route. It degrades exactly four
  // things: the gap figure reads `—` (`couldn't load`), the stored site reading
  // is UNREADABLE rather than absent (the strip stamps `sites — unknown`), the
  // monitoring switch is unknown (which the strip never reads in that state, so
  // it has no rendered effect either), and `chaserNDays` falls back to
  // OS_SETTINGS_DEFAULTS.chaserNDays, so the attention call below runs on a
  // window Riku did not set. The fourth is harmless: `days` bounds only
  // `repliedUnanswered` on ShikksTracker's side, and phase 3 (Task 3) is gated
  // on `dbOk`, so a gap list drawn on a guessed window is discarded before
  // anything renders it. Everything ShikksTracker answers still renders. A
  // TIMEOUT lands in the same catch and therefore in the same four
  // degradations — there is no new state to draw for it (R63).
  let chaserNDays = OS_SETTINGS_DEFAULTS.chaserNDays;
  let monitoringEnabled = false;
  // "unread" is not null: null means the read succeeded and nothing has ever
  // been written, "unread" means the read itself failed and nothing is known
  // (R56). Rendering the second as `sites never checked` would be the strip
  // claiming to have seen something it never saw.
  let snapshot: StoredHealth | null | "unread" = null;
  let dbOk = false;
  try {
    const { settings, stored } = await withDeadline(
      readLocal(),
      MONGO_READ_TIMEOUT_MS,
      "freelance local reads"
    );
    chaserNDays = settings.chaserNDays;
    monitoringEnabled = settings.monitoringEnabled;
    snapshot = stored;
    dbOk = true;
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

  const summary = settled(summaryResult, "summary");
  const attention = settled(attentionResult, "attention");
  const variants = settled(variantsResult, "variant stats");

  // --- Phase 3: the gap read, which needs both ------------------------------
  //
  // fetchLiveAnchorIds is the query the chaser uses for idempotency and this
  // page uses for suppression. Its own try/catch, because it can only run after
  // phase 2 and a failure here means one thing: the gap list is unavailable.
  //
  // Bounded like phase 1, and for the same reason: this is a second Mongo read
  // on the same request, and Mongoose has no per-call timeout. A timeout lands
  // in the catch below, which already produces a designed state — liveAnchorIds
  // stays null and Block E says `Couldn't load what's waiting.` (R63).
  //
  // No .filter(Boolean) on the ids: AttentionItem.replyToLogId is a required
  // string, so it narrowed nothing and only ever dropped empty strings, which
  // fetchLiveAnchorIds ignores anyway.
  let liveAnchorIds: Set<string> | null = null;
  if (attention !== null) {
    if (dbOk) {
      try {
        liveAnchorIds = await withDeadline(
          fetchLiveAnchorIds(attention.repliedUnanswered.map((item) => item.replyToLogId)),
          MONGO_READ_TIMEOUT_MS,
          "freelance anchor read"
        );
      } catch (err) {
        console.error("[freelance] live-anchor read failed:", err);
      }
    }
  }

  // --- The view models ------------------------------------------------------
  //
  // Only the strip is built here. Phase 3 and the five block builders arrive in
  // Tasks 3 to 6, each in the task that renders it, so no commit in this plan
  // ever leaves a computed value without a consumer (R47's principle, ruled for
  // Plan C on 2026-09-09).

  const blockE = buildBlockE({
    now,
    // A gap list built without the suppression set would repeat leads that
    // already have a draft in /queue, which is the one thing this block must
    // never do — so a failed anchor read reads as "couldn't load", not as an
    // unsuppressed list.
    //
    // Written as a two-sided test rather than `liveAnchorIds === null ? null :
    // attention!.repliedUnanswered`: both halves ARE the precondition, and
    // saying both lets the compiler narrow `attention` instead of being told to
    // trust an assertion it cannot check (N8).
    repliedUnanswered:
      attention !== null && liveAnchorIds !== null ? attention.repliedUnanswered : null,
    overdueActions: attention?.overdueActions ?? null,
    liveAnchorIds: liveAnchorIds ?? new Set<string>(),
    contactsBaseUrl: `${baseUrl}/contacts`,
  });

  const blockA = buildBlockA({
    queue: summary?.queue ?? { drafts: null, approved: null },
    contacts: summary?.contacts ?? null,
    // Block A's third card renders the SAME figure Block E renders, by
    // construction rather than by coincidence. This is an IMPORT, not a
    // ternary: the inline `rows ? count : empty ? 0 : null` this replaced
    // collapsed `failed` and `absent` into one null, and the card then said
    // `couldn't load` above a block saying `didn't report` — two registers
    // disagreeing on one screen (R54). needsYouFigure is an exhaustive switch,
    // so a fifth Block E kind is a compile error here rather than a silent
    // fourth reading.
    needsYou: needsYouFigure(blockE),
    draftsUrl: `${baseUrl}/review`,
  });

  const blockB = buildBlockB(summary?.contacts ?? null);

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
        ) : (
          <>
            <div className="fl-body">
              <HeroRow cards={blockA.cards} />
              <StateOfPlay lines={blockA.lines} />
            </div>
            <Pipeline block={blockB} />
          </>
        )}

        <HealthStrip strip={strip} />
      </div>
    </main>
  );
}
