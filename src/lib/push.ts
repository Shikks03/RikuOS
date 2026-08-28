/**
 * push.ts — web push over VAPID.
 *
 * buildPushPayload / parseSubscription are pure (unit-tested); sendPushToAll
 * does the I/O. Per CLAUDE.md, notification sending is always the LAST step
 * of any multi-step job and its failure must never corrupt data state —
 * callers wrap it accordingly (see /api/cron/expire).
 */

import webpush from "web-push";
import { connectDB } from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/** Pure: bounded title/body so a runaway agent can't push a novel. */
export function buildPushPayload(title: string, body: string, url = "/queue"): PushPayload {
  return { title: title.slice(0, 80), body: body.slice(0, 200), url };
}

export interface ParsedSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Pure: validates a browser PushSubscription.toJSON() body. */
export function parseSubscription(body: unknown): ParsedSubscription | null {
  if (body === null || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (
    typeof b.endpoint !== "string" ||
    b.endpoint.length === 0 ||
    b.endpoint.length > 1024 ||
    !b.endpoint.startsWith("https://")
  ) {
    return null;
  }
  const keys = b.keys as Record<string, unknown> | undefined | null;
  if (!keys || typeof keys !== "object") return null;
  if (typeof keys.p256dh !== "string" || keys.p256dh.length === 0 || keys.p256dh.length > 256) {
    return null;
  }
  if (typeof keys.auth !== "string" || keys.auth.length === 0 || keys.auth.length > 256) {
    return null;
  }
  return { endpoint: b.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

function configureWebPush(): void {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must all be set.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

/**
 * Sends one payload to every subscribed device. Gone subscriptions (404/410
 * from the push service) are deleted so the collection self-heals; other
 * failures are counted, never retried in a loop (CLAUDE.md: no infinite
 * retry — the human is the escalation path).
 */
export async function sendPushToAll(
  payload: PushPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  configureWebPush();
  await connectDB();

  // Bounded: this is a single-user app; 20 devices is already generous.
  const subs = await PushSubscription.find().limit(20);

  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        JSON.stringify(payload),
        { TTL: 3600, timeout: 10000 } // explicit timeout — external call (CLAUDE.md)
      );
      sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await PushSubscription.deleteOne({ _id: sub._id });
        removed++;
      } else {
        failed++;
      }
    }
  }

  return { sent, failed, removed };
}
