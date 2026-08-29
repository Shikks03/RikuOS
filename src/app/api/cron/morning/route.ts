import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireCronSecret } from "@/lib/auth";
import { getOsSettings } from "@/lib/osSettings";
import { runJob } from "@/lib/jobs/runJob";
import { runExpirySweep } from "@/lib/jobs/expirySweep";
import { EXPECTATIONS, evaluateWatchdog, fetchLatestRuns } from "@/lib/watchdog";
import { checkSites } from "@/lib/siteHealth";
import { buildProblems, composeDigest } from "@/lib/digest";
import { fetchAttention } from "@/lib/stApi";
import { buildPushPayload, sendPushToAll } from "@/lib/push";
import ApprovalItem from "@/models/ApprovalItem";

/**
 * GET /api/cron/morning
 *
 * The multiplexer. Vercel Hobby allows two cron jobs, each once per day, and
 * the chaser owns the other slot — so the watchdog, the site check and the
 * daily digest share this one invocation rather than getting crons of their
 * own (design P5a-3).
 *
 * Ordering rules this route obeys (CLAUDE.md):
 *  - every job writes its own AgentRun record, success or failure, via runJob;
 *  - one job's failure never stops the next — it becomes an ok:false row that
 *    tomorrow's watchdog reports, and today's dispatcher names immediately;
 *  - the push is sent by the LAST job, after every other job's data state is
 *    settled, so a notification failure can never corrupt anything.
 */
export const maxDuration = 60;

/** Bounded, per CLAUDE.md's rule on list endpoints. */
const ATTENTION_LIMIT = 50;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = requireCronSecret(request);
  if (guard) return guard;

  try {
    await connectDB();
    const settings = await getOsSettings();

    // Data hygiene runs whatever the monitoring toggle says: it predates P5a,
    // and switching monitoring off must not quietly stop stale items expiring.
    const expiry = await runJob("expiry-sweep", async () => {
      const swept = await runExpirySweep(new Date());
      return { counts: { itemsProcessed: swept.expired + swept.unstuck }, data: swept };
    });

    if (!settings.monitoringEnabled) {
      // Still record a run per agent, exactly as the chaser does when disabled,
      // so the watchdog can tell "switched off" from "cron never fired".
      const note = "monitoring is disabled in OsSettings";
      for (const agent of ["watchdog", "site-health", "dispatcher"] as const) {
        await runJob(agent, async () => ({ data: null }), note);
      }

      // The sweep's OWN alerts survive the toggle. Switching monitoring off
      // silences the daily digest — that is the point of the switch — but the
      // digest is not what carried these two. They are P4's safety net, and
      // this route is now the only scheduled sweep, so without them a failed
      // sweep or an interrupted action would be silent (CLAUDE.md forbids it).
      // Alerts last: every run record above is already written.
      const strandedItems = expiry.data?.unstuck ?? 0;
      if (!expiry.ok) {
        await notify("Expiry sweep failed", expiry.error ?? "Unknown error");
      } else if (strandedItems > 0) {
        await notify(
          "Interrupted actions need checking",
          `${strandedItems} approved item${strandedItems === 1 ? "" : "s"} could not confirm their result.`
        );
      }

      return NextResponse.json({
        ok: expiry.ok,
        monitoring: "disabled",
        expiry: expiry.data,
        ...(expiry.ok ? {} : { error: expiry.error }),
      });
    }

    const watch = await runJob("watchdog", async () => {
      const latest = await fetchLatestRuns(EXPECTATIONS.map((e) => e.agent));
      const anomalies = evaluateWatchdog(new Date(), latest);
      return {
        counts: { itemsProcessed: EXPECTATIONS.length, itemsFailed: anomalies.length },
        data: anomalies,
      };
    });

    const health = await runJob("site-health", async () => {
      const results = await checkSites();
      return { counts: { itemsProcessed: results.length }, data: results };
    });

    // Dispatcher last: every other record is written by now.
    const dispatch = await runJob("dispatcher", async () => {
      const pending = await ApprovalItem.countDocuments({ status: "pending" });

      // A dependency being down must not cost the whole digest. The reason is
      // logged rather than discarded: the digest can only say "unavailable",
      // which cannot distinguish a rotated secret from an outage from DNS.
      const attention = await fetchAttention(settings.chaserNDays, ATTENTION_LIMIT).catch(
        (attentionErr: unknown) => {
          console.error("[cron/morning] attention check failed:", attentionErr);
          return null;
        }
      );

      const problems = buildProblems({
        expiry: { ok: expiry.ok, error: expiry.error, unstuck: expiry.data?.unstuck ?? 0 },
        watchdog: { ok: watch.ok, error: watch.error, anomalies: watch.data ?? [] },
        siteHealth: { ok: health.ok, error: health.error, sites: health.data ?? [] },
      });

      const digest = composeDigest({
        pending,
        attention: attention
          ? {
              repliedUnanswered: attention.repliedUnanswered.length,
              overdue: attention.overdueActions?.length ?? 0,
            }
          : null,
        problems,
        offAgents: settings.chaserEnabled ? [] : ["chaser"],
      });

      // A digest nobody received is a total failure of this run's purpose, not
      // a partial one — so it fails the run rather than being counted (design
      // §"Run-record counts per job"). sendPushToAll swallows per-device
      // errors and deletes subscriptions the push service reports as gone, so
      // without this an invalidated iPhone subscription would file a healthy
      // run every morning while reaching nobody, and the absent push — the
      // outer safety net this whole phase rests on — would be all that is left.
      const delivery = await sendPushToAll(buildPushPayload(digest.title, digest.body));
      if (delivery.sent === 0) {
        throw new Error(
          `the digest reached no device (failed ${delivery.failed}, removed ${delivery.removed}). ` +
            "Re-subscribe from /queue."
        );
      }
      return { counts: { itemsProcessed: problems.length }, data: digest };
    });

    return NextResponse.json({
      ok: true,
      expiry: { ok: expiry.ok, ...(expiry.data ?? {}) },
      watchdog: { ok: watch.ok, anomalies: watch.data?.length ?? 0 },
      siteHealth: { ok: health.ok, down: (health.data ?? []).filter((s) => !s.up).length },
      dispatcher: {
        ok: dispatch.ok,
        title: dispatch.data?.title ?? null,
        ...(dispatch.ok ? {} : { error: dispatch.error }),
      },
    });
  } catch (err) {
    // Only a failure of the route itself lands here — job failures are records,
    // not exceptions.
    const error = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
    try {
      await sendPushToAll(buildPushPayload("Morning run failed", error));
    } catch (pushErr) {
      console.error("[cron/morning] failure alert could not be sent:", pushErr);
    }
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}

/** Alerts are queued and sent last, and their failure never fails the run. */
async function notify(title: string, body: string): Promise<void> {
  try {
    await sendPushToAll(buildPushPayload(title, body));
  } catch (pushErr) {
    console.error("[cron/morning] push could not be sent:", pushErr);
  }
}
