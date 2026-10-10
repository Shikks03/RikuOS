/**
 * sinceThenRead.ts — the reads behind "since then" (S21, spec §6). Impure.
 * Every read is bounded (MONGO_READ_TIMEOUT_MS; Google's own per-layer
 * timeout inside readCalendarWindow) and settled on its own, so one slow or
 * failed read never costs the others. Read-only: settings through
 * readOsSettings, never the upserting accessor (R37).
 *
 * Index use (no index change, spec §7.1):
 *   ticked   Todo { done: 1, doneAt: -1 }
 *   newDue   Todo { done: 1, dueOn: 1 }
 *   drafts   ApprovalItem { status: 1, createdAt: -1 }
 */

import { connectDB } from "@/lib/db";
import { MONGO_READ_TIMEOUT_MS, withDeadline } from "@/lib/deadline";
import { dayStart, todayKey } from "@/lib/days";
import { readCalendarWindow } from "@/lib/google";
import { readOsSettings } from "@/lib/osSettings";
import Todo from "@/models/Todo";
import ApprovalItem from "@/models/ApprovalItem";
import type { SinceThenInput } from "@/lib/sinceThen";

const TITLES = 3;

export async function readSinceThen(sentAt: Date, now: Date): Promise<SinceThenInput> {
  const today = todayKey(now);
  const connected = connectDB();
  const bounded = <T,>(read: () => Promise<T>, label: string) =>
    withDeadline(connected.then(read), MONGO_READ_TIMEOUT_MS, `since-then ${label}`);

  const [ticked, newDue, drafts, settings] = await Promise.allSettled([
    bounded(async () => {
      const filter = { done: true, doneAt: { $gte: sentAt } };
      const [rows, total] = await Promise.all([
        Todo.find(filter, { title: 1 }).sort({ doneAt: -1 }).limit(TITLES).lean<Array<{ title: string }>>(),
        Todo.countDocuments(filter),
      ]);
      return { titles: rows.map((r) => r.title), total };
    }, "ticked"),
    bounded(async () => {
      const filter = { done: false, dueOn: dayStart(today), createdAt: { $gt: sentAt } };
      const [rows, total] = await Promise.all([
        Todo.find(filter, { title: 1 }).sort({ createdAt: 1 }).limit(TITLES).lean<Array<{ title: string }>>(),
        Todo.countDocuments(filter),
      ]);
      return { titles: rows.map((r) => r.title), total };
    }, "new due"),
    bounded(() => ApprovalItem.countDocuments({ status: "pending", createdAt: { $gt: sentAt } }), "drafts"),
    bounded(readOsSettings, "settings"),
  ]);

  const log = (label: string, r: PromiseSettledResult<unknown>) => {
    if (r.status === "rejected") console.error(`[since-then] ${label} failed:`, r.reason);
  };
  log("ticked", ticked);
  log("new due", newDue);
  log("drafts", drafts);
  log("settings", settings);

  let events: SinceThenInput["events"] = "unavailable";
  if (settings.status === "fulfilled") {
    try {
      const window = await readCalendarWindow(settings.value.layers, today, today);
      if (!window.ok) {
        events = window.reason === "none-enabled" ? "none-enabled" : "unavailable";
      } else if (window.failed.length > 0 && window.events.length === 0) {
        // Every enabled layer failed: nothing usable came back.
        events = "unavailable";
      } else {
        // Some layers may have failed while others answered — fix round 1,
        // item 1. That partial state rides along with the events that DID
        // come back, rather than erasing them or hiding the gap.
        events = {
          events: window.events
            .filter((e) => e.dayKey === today)
            .map((e) => ({ title: e.title, allDay: e.allDay, startsAt: e.startsAt, endsAt: e.endsAt })),
          partial: window.failed.length > 0,
        };
      }
    } catch (err) {
      console.error("[since-then] calendar failed:", err);
    }
  }

  return {
    ticked: ticked.status === "fulfilled" ? ticked.value : "unavailable",
    newDue: newDue.status === "fulfilled" ? newDue.value : "unavailable",
    newDrafts: drafts.status === "fulfilled" ? drafts.value : "unavailable",
    events,
  };
}
