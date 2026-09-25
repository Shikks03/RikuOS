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
