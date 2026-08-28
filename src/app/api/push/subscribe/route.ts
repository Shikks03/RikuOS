import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseSubscription } from "@/lib/push";
import PushSubscription from "@/models/PushSubscription";

/**
 * POST /api/push/subscribe
 *
 * Body: the browser's PushSubscription.toJSON() — { endpoint, keys }.
 * Upserts by endpoint (re-subscribing the same device is idempotent).
 * There is no unsubscribe route on purpose: dead endpoints are pruned
 * automatically when the push service returns 404/410 (see sendPushToAll).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseSubscription(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "Body must be a web-push subscription: { endpoint, keys: { p256dh, auth } }." },
      { status: 400 }
    );
  }

  await connectDB();
  await PushSubscription.findOneAndUpdate(
    { endpoint: parsed.endpoint },
    { $set: { keys: parsed.keys } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return NextResponse.json({ ok: true });
}
