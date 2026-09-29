/**
 * digestToday.ts — the morning push's two new reads, for the Today sentence.
 *
 * The impure half of digest.ts's Today sentence: one calendar read, one to-do
 * read, each caught into `"unavailable"` and logged, never thrown — the digest
 * never fails for Google or for the to-do store (plan Task 11 step 4). The
 * shaping is pure and lives in digest.ts (calendarForDigest, todosForDigest),
 * where it is tested; this file only fetches.
 *
 * Callers must have connectDB()'d already — same convention as the rest of the
 * lib layer.
 */

import Todo from "@/models/Todo";
import { readCalendarWindow } from "@/lib/google";
import type { Layer } from "@/lib/osSettings";
import { addDays, dayStart, type DayKey } from "@/lib/days";
import { calendarForDigest, todosForDigest, type DigestTodayInput, type DigestTodoRow } from "@/lib/digest";

/**
 * Per query. Two queries, not one, so a long overdue list can never evict the
 * to-dos due in the next three days. Only three names per part are shown, and
 * `+N more` counts each group with countDocuments on the same filter, so the
 * bound never makes it undercount.
 */
export const DIGEST_TODO_LIMIT = 50;

/** Everything the Today sentence needs, for the APP_TZ day `today`. Never throws. */
export async function readDigestToday(layers: readonly Layer[], today: DayKey): Promise<DigestTodayInput> {
  const [calendar, todos] = await Promise.all([readCalendarPart(layers, today), readTodoPart(today)]);
  return { ...calendar, ...todos };
}

async function readCalendarPart(
  layers: readonly Layer[],
  today: DayKey
): Promise<Pick<DigestTodayInput, "events" | "missedLayers">> {
  try {
    const window = await readCalendarWindow(layers, today, today);
    if (!window.ok && window.reason !== "none-enabled") {
      console.error(`[cron/morning] calendar check unavailable: ${window.reason}`);
    } else if (window.ok && window.failed.length > 0) {
      console.error(`[cron/morning] calendar layers not read: ${window.failed.length}`);
    }
    return calendarForDigest(window, layers, today);
  } catch (err) {
    console.error("[cron/morning] calendar check failed:", err);
    return { events: "unavailable", missedLayers: [] };
  }
}

async function readTodoPart(
  today: DayKey
): Promise<Pick<DigestTodayInput, "due" | "overdue" | "dueTotal" | "overdueTotal">> {
  try {
    const start = dayStart(today);
    const fields = { title: 1, dueOn: 1, createdAt: 1, _id: 0 };
    // Both served by the { done: 1, dueOn: 1 } index. `dueOn` is a UTC
    // midnight, so day bounds are dayStart() values, never APP_TZ instants.
    const overdueFilter = { done: false, dueOn: { $lt: start } };
    const dueFilter = { done: false, dueOn: { $gte: start, $lte: dayStart(addDays(today, 3)) } };
    const [overdue, due, overdueCount, dueCount] = await Promise.all([
      Todo.find(overdueFilter, fields).sort({ dueOn: 1 }).limit(DIGEST_TODO_LIMIT).lean<DigestTodoRow[]>(),
      Todo.find(dueFilter, fields).sort({ dueOn: 1 }).limit(DIGEST_TODO_LIMIT).lean<DigestTodoRow[]>(),
      Todo.countDocuments(overdueFilter),
      Todo.countDocuments(dueFilter),
    ]);
    return todosForDigest([...overdue, ...due], today, { due: dueCount, overdue: overdueCount });
  } catch (err) {
    console.error("[cron/morning] to-do check failed:", err);
    return { due: "unavailable", overdue: [] };
  }
}
