/**
 * APP_NAME is the single place the product name lives. The name may still
 * change (RIKUOS_CONCEPT.md §7), so user-visible strings must always use this
 * constant, never a literal.
 */
export const APP_NAME = "RikuOS";

/**
 * Every "is this due today / overdue / within 3 days" question on the Personal
 * page and in the morning push is asked of a day key in THIS zone. Vercel runs
 * in UTC and the morning cron fires at 23:00 UTC, which is 07:00 here, so a
 * naive UTC "today" reports yesterday for seven hours of every day.
 */
export const APP_TZ = "Asia/Manila";

/**
 * The hour the morning push is expected, in APP_TZ. Exported once, beside the
 * cron's provenance, the way AGENT_STALE_HOURS is — because two copies of an
 * expectation drift and this one decides whether an alarm is a lie.
 *
 * `No push this morning.` takes its --missing dot ONLY once `now` in APP_TZ is
 * past this hour (R22, nodded by Riku in deck 15). Before 07:00 the sentence
 * stands undotted: it is simply true at 00:30, and only the alarm would lie.
 * The push tile's stamp renders `sentAt` in APP_TZ and NEVER this number — a
 * stamp that printed the cron's nominal hour would report a send that did not
 * happen at the time it says.
 */
export const PUSH_EXPECTED_HOUR = 7;

/**
 * The push payload's bounds (buildPushPayload in push.ts). Here rather than
 * in push.ts because digest.ts budgets the Today sentence against the body
 * bound and must stay pure — push.ts imports web-push and the database. 320
 * for every push (§7.8, D12); LastDigest's maxlengths match both.
 */
export const PUSH_TITLE_MAX = 80;
export const PUSH_BODY_MAX = 320;

/**
 * A to-do title's bound. Here, not in todos.ts, because the Todo model's
 * schema reads it too and models/Todo.ts is loaded by sync-indexes.mts under
 * `node --experimental-strip-types`, which resolves no "@/" alias: the model
 * can only import a file with no imports of its own, and todos.ts imports
 * days.ts through "@/". This file imports nothing. todos.ts re-exports it, so
 * the lib and the routes keep reading it from there.
 */
export const TODO_TITLE_MAX = 140;
