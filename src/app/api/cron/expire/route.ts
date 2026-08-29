import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireCronSecret } from "@/lib/auth";
import { runJob } from "@/lib/jobs/runJob";
import { runExpirySweep } from "@/lib/jobs/expirySweep";
import { buildPushPayload, sendPushToAll } from "@/lib/push";

/**
 * GET /api/cron/expire
 *
 * Kept as a manual trigger for the same sweep the morning route runs
 * (/api/cron/morning). It is NO LONGER a Vercel cron entry: Hobby allows two
 * crons and the second slot is the multiplexer. The work itself lives in
 * src/lib/jobs/expirySweep.ts so both callers can never drift apart.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = requireCronSecret(request);
  if (guard) return guard;

  await connectDB();

  const result = await runJob("expiry-sweep", async () => {
    const swept = await runExpirySweep(new Date());
    return { counts: { itemsProcessed: swept.expired + swept.unstuck }, data: swept };
  });

  // Alerts last (CLAUDE.md): the data state above is already settled.
  if (!result.ok) {
    await notify("Expiry sweep failed", result.error ?? "Unknown error");
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  const unstuck = result.data?.unstuck ?? 0;
  if (unstuck > 0) {
    await notify(
      "Interrupted actions need checking",
      `${unstuck} approved item${unstuck === 1 ? "" : "s"} could not confirm their result.`
    );
  }

  return NextResponse.json({
    ok: true,
    expired: result.data?.expired ?? 0,
    unstuck,
  });
}

async function notify(title: string, body: string): Promise<void> {
  try {
    await sendPushToAll(buildPushPayload(title, body));
  } catch (pushErr) {
    console.error("[cron/expire] push could not be sent:", pushErr);
  }
}
