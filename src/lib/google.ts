/**
 * google.ts — the Google Calendar client. Raw `fetch`, no SDK (no `googleapis`,
 * no `google-auth-library`), five calls, one error taxonomy.
 *
 * Google Calendar is the single source of truth (concept D5): nothing here
 * stores an event. Reads are live, writes go straight through.
 *
 * THE TAXONOMY (GoogleErrorKind) — every failure leaves this module as a
 * GoogleError carrying exactly one of:
 *   not-configured  a GOOGLE_* variable is unset. Decided before any HTTP.
 *   expired         the token endpoint answered `invalid_grant`, or the API
 *                   answered 401 twice. Riku re-runs `npm run google:auth`.
 *   timeout         AbortSignal.timeout fired, matched on DOMException.name.
 *   gone            404 (or 410) — the calendar or the entry no longer exists.
 *                   Permanent; the page hands over a lever, not a retry (R42).
 *   http            anything else, with the status and Google's own message,
 *                   bounded. Also: a read still truncated at the page ceiling.
 *
 * RETRIES. Exactly one, and only for a 401: the cached token is dropped and the
 * request is made once more with a fresh one. A second 401 is `expired`. No
 * other call is ever retried (CLAUDE.md: no infinite retry).
 *
 * SECRETS. The three variables are read in this module and nowhere else in
 * src/. No response is logged whole, nothing here logs at all, and no error
 * message carries a token, the secret or the refresh token.
 *
 * THE TOKEN CACHE is a PROMISE on `global`, the db.ts shape: two concurrent
 * renders share one token request instead of making one each. It is cleared on
 * rejection (so the next call tries again) and treated as stale 60 s before the
 * token's expiry. Tests clear it by assigning `undefined` to
 * `globalThis._googleTokenPromise`.
 *
 * TIMEOUTS. Every request carries AbortSignal.timeout(GOOGLE_TIMEOUT_MS). A
 * paginated READ shares ONE signal across its pages (and its 401 retry), so a
 * layer costs at most one token request plus GOOGLE_TIMEOUT_MS, not a timeout
 * per page — the page's patience is what is being bounded.
 */

import { APP_TZ } from "@/lib/constants";
import { addDays, dayKey, dayStart, isDayKey, type DayKey } from "@/lib/days";
import { compareEvents } from "@/lib/eventOrder";
import type { Layer } from "@/lib/osSettings";

// --- Contract types (the plan's "Types Plan C will render") -----------------

/**
 * One event on one day, as one calendar holds it. The KEY is
 * `${dayKey}:${calendarId}:${id}` — never `id` alone, and never without the
 * calendar:
 *   - a multi-day all-day event yields one of these per day it covers, all
 *     sharing `id` (so the day is in the key);
 *   - Google gives an invited event the SAME `id` on every calendar that
 *     holds it, so two enabled layers can yield the same `id` on the same day
 *     (so the calendar is in the key).
 */
export interface CalendarEvent {
  id: string;
  /** The layer's Google calendar id — the key's middle part. */
  calendarId: string;
  title: string; // bounded to 200 for display
  layerName: string;
  allDay: boolean;
  startsAt: Date | null; // null for all-day
  endsAt: Date | null; // null for all-day
  dayKey: DayKey;
  htmlLink: string;
}

export type GoogleErrorKind = "not-configured" | "expired" | "timeout" | "gone" | "http";

export type CalendarWindow =
  /**
   * `failed` = the failed layers' CALENDAR IDS, never their names: two layers
   * may share a name, and an id is what the "all failed" / "partial" decisions
   * compare against the enabled layers. Consumers join an id to its name via
   * the stored layers only when they render a sentence.
   */
  | { ok: true; events: CalendarEvent[]; failed: string[] }
  | { ok: false; reason: "none-enabled" | "not-configured" | "expired" | "timeout" };

/** One row of the calendar list — what the Settings picker joins `layers` against. */
export interface CalendarListEntry {
  calendarId: string;
  name: string;
  primary: boolean;
}

/** An event as listEvents returns it; readCalendarWindow adds the layer's calendarId and name. */
export type LayerEvent = Omit<CalendarEvent, "layerName" | "calendarId">;

/** What insertEvent writes. Times are "HH:MM" wall-clock in APP_TZ. */
export type EventInput =
  | { title: string; allDay: true; dayKey: DayKey }
  | { title: string; allDay: false; dayKey: DayKey; start: string; end: string };

/**
 * What patchEvent changes. Only ALL-DAY entries are moved by day — the one
 * patch caller is a pinned to-do, which is always an all-day entry.
 */
export interface EventPatch {
  title?: string;
  dayKey?: DayKey;
}

// --- Constants ---------------------------------------------------------------

/** Explicit timeout on every Google request (CLAUDE.md). */
export const GOOGLE_TIMEOUT_MS = 5000;

/**
 * Reads follow nextPageToken at most this many pages. A read still truncated
 * here FAILS (that layer's `Couldn't read …`), never returns a short list: a
 * cut with nothing said about it is the failure deck constraint 2 forbids (R24).
 */
export const GOOGLE_PAGE_CEILING = 3;

/** Google's own maximum page size for both list endpoints. */
const PAGE_SIZE = 250;
/** A token is treated as stale this long before Google says it expires. */
const TOKEN_SKEW_MS = 60_000;
/** Google's message, bounded before it enters an error. */
const GOOGLE_MESSAGE_MAX = 200;
const TITLE_MAX = 200;
const UNTITLED = "(No title)";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://www.googleapis.com/calendar/v3";

// --- Errors and config -------------------------------------------------------

export class GoogleError extends Error {
  readonly kind: GoogleErrorKind;
  readonly status?: number;

  constructor(kind: GoogleErrorKind, message: string, status?: number) {
    super(message);
    this.name = "GoogleError";
    this.kind = kind;
    this.status = status;
  }
}

/**
 * How a failed WRITE is classified — by whether the side effect could have
 * happened, never by guessing (CLAUDE.md's asymmetric-failure rule). Shared by
 * the to-do store's calendar legs and `POST /api/calendar/events`, so the
 * table lives once, beside the error it reads; todoStore.ts's header has it
 * written out row by row. `gone` is left to the caller: it is success on a
 * delete and a failure on an insert or a move.
 */
export type WriteClass =
  | { kind: "failed"; cause: "not-configured" | "expired" | "refused" }
  | { kind: "unknown" }
  | { kind: "gone" };

export function classifyWrite(err: unknown): WriteClass {
  if (!(err instanceof GoogleError)) return { kind: "unknown" };
  switch (err.kind) {
    case "not-configured":
      return { kind: "failed", cause: "not-configured" };
    case "expired":
      return { kind: "failed", cause: "expired" };
    case "gone":
      return { kind: "gone" };
    case "timeout":
      return { kind: "unknown" };
    case "http":
      return err.status !== undefined && err.status >= 400 && err.status < 500
        ? { kind: "failed", cause: "refused" }
        : { kind: "unknown" };
  }
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

const CONFIG_VARS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"] as const;

/**
 * Reads the three variables. Names every missing one — never a value — the
 * same shape as readStConfig. Whitespace-only counts as missing.
 */
export function readGoogleConfig(source: NodeJS.ProcessEnv = process.env): GoogleConfig {
  const value = (name: (typeof CONFIG_VARS)[number]) => (source[name] ?? "").trim();
  const missing = CONFIG_VARS.filter((name) => value(name) === "");
  if (missing.length > 0) {
    throw new GoogleError(
      "not-configured",
      `Google Calendar is not configured: ${missing.join(", ")} ${
        missing.length === 1 ? "is" : "are"
      } not set. GOOGLE_REFRESH_TOKEN comes from \`npm run google:auth\`. ` +
        "(Value omitted from this message.)",
    );
  }
  return {
    clientId: value("GOOGLE_CLIENT_ID"),
    clientSecret: value("GOOGLE_CLIENT_SECRET"),
    refreshToken: value("GOOGLE_REFRESH_TOKEN"),
  };
}

// --- Transport ---------------------------------------------------------------

function bound(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function isAbort(err: unknown): boolean {
  // By NAME, never by message (unstable) and never by instanceof (DOMException
  // is not the same class across runtimes).
  const name = typeof err === "object" && err !== null ? (err as { name?: unknown }).name : undefined;
  return name === "TimeoutError" || name === "AbortError";
}

/** Runs one request-and-read under the signal, mapping transport failures. */
async function guarded<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof GoogleError) throw err;
    if (isAbort(err)) {
      throw new GoogleError("timeout", `${what} did not answer within ${GOOGLE_TIMEOUT_MS} ms.`);
    }
    // A body that is not JSON gets a fixed phrase: a parser's message quotes the
    // body it choked on, and no response is echoed whole into an error.
    const detail =
      err instanceof Error && err.name === "SyntaxError"
        ? "unreadable response"
        : err instanceof Error
          ? err.message
          : "unknown error";
    throw new GoogleError("http", `${what} failed: ${bound(detail, GOOGLE_MESSAGE_MAX)}`);
  }
}

/**
 * Google's error body, read defensively. The token endpoint answers
 * `{error: "invalid_grant", error_description}`; the Calendar API answers
 * `{error: {code, message}}`. Anything else (an HTML 502) yields nulls.
 */
async function readError(res: Response): Promise<{ code: string | null; message: string | null }> {
  let body: unknown;
  try {
    body = JSON.parse(await res.text());
  } catch (err) {
    // The request's timeout can fire while the error body streams in; that is
    // still a timeout, not an unreadable body.
    if (isAbort(err)) throw err;
    return { code: null, message: null };
  }
  if (typeof body !== "object" || body === null) return { code: null, message: null };
  const error = (body as { error?: unknown }).error;
  const description = (body as { error_description?: unknown }).error_description;
  if (typeof error === "string") {
    return { code: error, message: typeof description === "string" ? description : error };
  }
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    return { code: null, message: typeof message === "string" ? message : null };
  }
  return { code: null, message: null };
}

// --- The token cache ---------------------------------------------------------

interface CachedToken {
  token: string;
  expiresAt: number;
}

declare global {
  var _googleTokenPromise: Promise<CachedToken> | undefined;
}

async function requestToken(config: GoogleConfig): Promise<CachedToken> {
  return guarded("Google's token endpoint", async () => {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: "refresh_token",
      }).toString(),
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      const { code, message } = await readError(res);
      if (code === "invalid_grant") {
        throw new GoogleError(
          "expired",
          "Google refused the refresh token (invalid_grant). Run `npm run google:auth` again.",
          res.status,
        );
      }
      throw new GoogleError(
        "http",
        `Google's token endpoint answered ${res.status}: ${bound(message ?? "no message", GOOGLE_MESSAGE_MAX)}`,
        res.status,
      );
    }
    const body: unknown = await res.json();
    const token = (body as { access_token?: unknown } | null)?.access_token;
    const expiresIn = (body as { expires_in?: unknown } | null)?.expires_in;
    if (typeof token !== "string" || token === "" || typeof expiresIn !== "number") {
      throw new GoogleError("http", "Google's token endpoint answered 200 without a usable token.", res.status);
    }
    return { token, expiresAt: Date.now() + expiresIn * 1000 };
  });
}

/** A live access token, from the cached promise when it is still fresh. */
async function accessToken(config: GoogleConfig): Promise<string> {
  const cached = global._googleTokenPromise;
  if (cached) {
    try {
      const t = await cached;
      if (Date.now() < t.expiresAt - TOKEN_SKEW_MS) return t.token;
    } catch {
      // A rejected promise is cleared by whoever awaited it first; fall through.
    }
    if (global._googleTokenPromise === cached) global._googleTokenPromise = undefined;
  }
  if (!global._googleTokenPromise) global._googleTokenPromise = requestToken(config);
  const pending = global._googleTokenPromise;
  try {
    return (await pending).token;
  } catch (err) {
    if (global._googleTokenPromise === pending) global._googleTokenPromise = undefined;
    throw err;
  }
}

// --- One API request ---------------------------------------------------------

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Shared across a paginated read; a fresh one per call otherwise. */
  signal?: AbortSignal;
}

/**
 * One Calendar API request with the single 401 retry. Resolves to the parsed
 * JSON body, or null for a 204.
 */
async function googleRequest(
  config: GoogleConfig,
  url: string,
  { method = "GET", body, signal }: RequestOptions = {},
): Promise<unknown> {
  const what = `Google Calendar (${method})`;
  const requestSignal = signal ?? AbortSignal.timeout(GOOGLE_TIMEOUT_MS);
  for (let attempt = 0; ; attempt++) {
    const token = await accessToken(config);
    const outcome = await guarded(what, async () => {
      const res = await fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: requestSignal,
        cache: "no-store",
      });
      if (res.status === 401) return { retry: true as const };
      if (res.status === 404 || res.status === 410) {
        throw new GoogleError("gone", `${what} answered ${res.status}: the calendar or entry no longer exists.`, res.status);
      }
      if (!res.ok) {
        const { message } = await readError(res);
        throw new GoogleError(
          "http",
          `${what} answered ${res.status}: ${bound(message ?? "no message", GOOGLE_MESSAGE_MAX)}`,
          res.status,
        );
      }
      if (res.status === 204) return { retry: false as const, value: null };
      return { retry: false as const, value: (await res.json()) as unknown };
    });
    if (!outcome.retry) return outcome.value;
    // 401: the token is dead. Drop it; one fresh attempt, then `expired`.
    global._googleTokenPromise = undefined;
    if (attempt >= 1) {
      throw new GoogleError("expired", `${what} answered 401 twice; the Google sign-in no longer works.`, 401);
    }
  }
}

/** Follows nextPageToken up to the ceiling; a read still truncated there fails. */
async function readPages(
  config: GoogleConfig,
  baseUrl: string,
  params: Record<string, string>,
  label: string,
): Promise<unknown[]> {
  const signal = AbortSignal.timeout(GOOGLE_TIMEOUT_MS);
  const items: unknown[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < GOOGLE_PAGE_CEILING; page++) {
    const query = new URLSearchParams({ ...params, maxResults: String(PAGE_SIZE) });
    if (pageToken) query.set("pageToken", pageToken);
    const body = await googleRequest(config, `${baseUrl}?${query.toString()}`, { signal });
    const record = (typeof body === "object" && body !== null ? body : {}) as {
      items?: unknown;
      nextPageToken?: unknown;
    };
    if (Array.isArray(record.items)) items.push(...record.items);
    pageToken = typeof record.nextPageToken === "string" && record.nextPageToken !== "" ? record.nextPageToken : null;
    if (!pageToken) return items;
  }
  throw new GoogleError(
    "http",
    `${label} is longer than ${GOOGLE_PAGE_CEILING} pages of ${PAGE_SIZE}; not showing a partial list.`,
  );
}

// --- The day window ----------------------------------------------------------

/** How far `tz` is ahead of UTC at instant `at`, in ms. No offset is hard-coded. */
function zoneOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant `key` begins in `tz` — NOT dayStart, which is UTC midnight. */
function zoneMidnight(key: DayKey, tz: string): Date {
  const utcMidnight = dayStart(key).getTime();
  const first = utcMidnight - zoneOffsetMs(new Date(utcMidnight), tz);
  // Second pass so a zone whose offset differs at the real instant still lands.
  return new Date(utcMidnight - zoneOffsetMs(new Date(first), tz));
}

/**
 * The RFC3339 bounds of a window of APP_TZ days. BOTH day keys are inclusive:
 * timeMin is the APP_TZ midnight that begins `fromKey`; timeMax is the APP_TZ
 * midnight that begins the day AFTER `toKey` (Google's timeMax is exclusive).
 * For Manila, `2026-09-10` begins at 2026-09-09T16:00:00Z.
 *
 * Google returns every event that OVERLAPS the window. An ALL-DAY event is
 * expanded onto every day it covers, clipped to the window (see listEvents).
 * A TIMED event is keyed to its start day only — one that began before
 * `fromKey`, or crosses midnight, does not appear on the later day(s). Known
 * limit, accepted: the page reads it on the day it starts.
 */
export function windowBounds(fromKey: DayKey, toKey: DayKey, tz: string = APP_TZ): { timeMin: Date; timeMax: Date } {
  if (!isDayKey(fromKey) || !isDayKey(toKey)) {
    throw new RangeError(`Not a day window: ${JSON.stringify(fromKey)} … ${JSON.stringify(toKey)}`);
  }
  if (toKey < fromKey) {
    throw new RangeError(`Reversed day window: ${fromKey} … ${toKey}`);
  }
  return { timeMin: zoneMidnight(fromKey, tz), timeMax: zoneMidnight(addDays(toKey, 1), tz) };
}

// --- Normalisation -----------------------------------------------------------

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

/** Google's event resource → LayerEvent, or null for a cancelled/unreadable one. */
function toLayerEvent(raw: unknown): LayerEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as {
    id?: unknown;
    status?: unknown;
    summary?: unknown;
    htmlLink?: unknown;
    start?: { date?: unknown; dateTime?: unknown };
    end?: { date?: unknown; dateTime?: unknown };
  };
  const id = str(e.id);
  if (!id || e.status === "cancelled") return null;

  const title = (str(e.summary)?.trim() || UNTITLED).slice(0, TITLE_MAX);
  const link = str(e.htmlLink);
  // Only an https link ever reaches an href.
  const htmlLink = link && link.startsWith("https://") ? link : "";

  const allDayKey = str(e.start?.date);
  if (allDayKey) {
    if (!isDayKey(allDayKey)) return null;
    return { id, title, allDay: true, startsAt: null, endsAt: null, dayKey: allDayKey, htmlLink };
  }
  const startIso = str(e.start?.dateTime);
  if (!startIso) return null;
  const startsAt = new Date(startIso);
  if (Number.isNaN(startsAt.getTime())) return null;
  const endIso = str(e.end?.dateTime);
  const endsAt = endIso ? new Date(endIso) : null;
  return {
    id,
    title,
    allDay: false,
    startsAt,
    endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
    dayKey: dayKey(startsAt, APP_TZ),
    htmlLink,
  };
}

// --- The five calls ----------------------------------------------------------

const calendarPath = (calendarId: string) => `${API_BASE}/calendars/${encodeURIComponent(calendarId)}`;

/** Every calendar on Riku's account (the Settings picker's source, R24/R42). */
export async function listCalendars(): Promise<CalendarListEntry[]> {
  const config = readGoogleConfig();
  const items = await readPages(config, `${API_BASE}/users/me/calendarList`, {}, "The calendar list");
  const out: CalendarListEntry[] = [];
  for (const raw of items) {
    if (typeof raw !== "object" || raw === null) continue;
    const c = raw as { id?: unknown; summary?: unknown; summaryOverride?: unknown; primary?: unknown };
    const calendarId = str(c.id);
    if (!calendarId) continue;
    out.push({
      calendarId,
      name: bound(str(c.summaryOverride) ?? str(c.summary) ?? calendarId, TITLE_MAX),
      primary: c.primary === true,
    });
  }
  return out;
}

/**
 * One calendar's events over a window of APP_TZ days (both ends inclusive; see
 * windowBounds). Recurring entries arrive already expanded (singleEvents).
 *
 * A multi-day ALL-DAY event (a trip: start.date 09-10, end.date 09-13, the end
 * exclusive) becomes one entry PER DAY it covers — 09-10, 09-11, 09-12 — clipped
 * to [fromKey, toKey], each with its own dayKey and the SAME id, title and
 * htmlLink. Keyed to its start day alone, the page would say `Nothing
 * scheduled.` on 09-11 while Riku is away. So an id CAN REPEAT across days —
 * and, for an invited event, across calendars: consumers key rows by
 * `${dayKey}:${calendarId}:${id}` (see CalendarEvent), never by id alone.
 *
 * A TIMED event crossing midnight stays keyed to its start day (known limit).
 */
export async function listEvents(calendarId: string, fromKey: DayKey, toKey: DayKey): Promise<LayerEvent[]> {
  const { timeMin, timeMax } = windowBounds(fromKey, toKey);
  const config = readGoogleConfig();
  const items = await readPages(
    config,
    `${calendarPath(calendarId)}/events`,
    {
      singleEvents: "true",
      orderBy: "startTime",
      timeZone: APP_TZ,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
    },
    "This calendar's window",
  );
  const events: LayerEvent[] = [];
  for (const raw of items) {
    const e = toLayerEvent(raw);
    if (!e) continue;
    if (!e.allDay) {
      events.push(e);
      continue;
    }
    const endRaw = str((raw as { end?: { date?: unknown } }).end?.date);
    // end.date is exclusive; a missing or nonsensical end means one day.
    const end = endRaw && isDayKey(endRaw) && endRaw > e.dayKey ? endRaw : addDays(e.dayKey, 1);
    for (let day = e.dayKey < fromKey ? fromKey : e.dayKey; day < end && day <= toKey; day = addDays(day, 1)) {
      events.push({ ...e, dayKey: day });
    }
  }
  return events;
}

function allDayRange(key: DayKey) {
  // Google's all-day end.date is EXCLUSIVE: a one-day entry ends the next day.
  return { start: { date: key }, end: { date: addDays(key, 1) } };
}

function writeResult(body: unknown): { id: string; htmlLink: string } {
  const e = toLayerEvent(body);
  const id = e?.id ?? str((body as { id?: unknown } | null)?.id);
  if (!id) throw new GoogleError("http", "Google Calendar answered the write without an event id.");
  const link = str((body as { htmlLink?: unknown } | null)?.htmlLink);
  return { id, htmlLink: link && link.startsWith("https://") ? link : "" };
}

export async function insertEvent(
  calendarId: string,
  event: EventInput,
): Promise<{ id: string; htmlLink: string }> {
  const config = readGoogleConfig();
  const body = event.allDay
    ? { summary: event.title, ...allDayRange(event.dayKey) }
    : {
        summary: event.title,
        start: { dateTime: `${event.dayKey}T${event.start}:00`, timeZone: APP_TZ },
        end: { dateTime: `${event.dayKey}T${event.end}:00`, timeZone: APP_TZ },
      };
  return writeResult(await googleRequest(config, `${calendarPath(calendarId)}/events`, { method: "POST", body }));
}

/** Retitles and/or moves an ALL-DAY entry. */
export async function patchEvent(calendarId: string, eventId: string, patch: EventPatch): Promise<void> {
  const config = readGoogleConfig();
  const body = {
    ...(patch.title !== undefined ? { summary: patch.title } : {}),
    ...(patch.dayKey !== undefined ? allDayRange(patch.dayKey) : {}),
  };
  await googleRequest(config, `${calendarPath(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body,
  });
}

/** 204 on success; an entry already removed is `gone` — the caller decides. */
export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  const config = readGoogleConfig();
  await googleRequest(config, `${calendarPath(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });
}

// --- The window --------------------------------------------------------------

/**
 * Every enabled layer's events over `fromKey … toKey` (both inclusive), in one
 * round of calls. The page asks for today … today+7 once and splits by dayKey.
 *
 *   none-enabled    decided FIRST — no config read, no token, no HTTP (R20, R45).
 *   not-configured  a variable is unset; still no HTTP.
 *   expired         the token was refused, or any layer hit the second 401:
 *                   a credential problem is the whole window's, not N layers'.
 *   timeout         the token request timed out, or EVERY layer timed out.
 *   ok              `failed` lists the calendarId of each layer that did not
 *                   answer (ids, not names: two layers may share a name) — including a
 *                   vanished calendar (`gone`) and a layer truncated at the page
 *                   ceiling. The kinds are not carried: the Settings page tells
 *                   a vanished calendar apart by joining `layers` to listCalendars.
 *
 * A token failure of kind `http` (e.g. `invalid_client`) is reported as every
 * enabled layer failing, since the union has no reason for it.
 */
export async function readCalendarWindow(
  layers: readonly Layer[],
  fromKey: DayKey,
  toKey: DayKey,
): Promise<CalendarWindow> {
  const enabled = layers.filter((l) => l.enabled);
  if (enabled.length === 0) return { ok: false, reason: "none-enabled" };

  // Checked once, before any HTTP: a malformed or reversed window is a
  // programming error and throws RangeError, rather than rendering as every
  // layer failing one by one.
  windowBounds(fromKey, toKey);

  let config: GoogleConfig;
  try {
    config = readGoogleConfig();
  } catch {
    return { ok: false, reason: "not-configured" };
  }

  try {
    await accessToken(config);
  } catch (err) {
    const kind = err instanceof GoogleError ? err.kind : "http";
    if (kind === "expired" || kind === "timeout") return { ok: false, reason: kind };
    return { ok: true, events: [], failed: enabled.map((l) => l.calendarId) };
  }

  const settled = await Promise.allSettled(enabled.map((l) => listEvents(l.calendarId, fromKey, toKey)));

  const events: CalendarEvent[] = [];
  const failed: string[] = [];
  const kinds: GoogleErrorKind[] = [];
  settled.forEach((result, i) => {
    const layer = enabled[i];
    if (result.status === "fulfilled") {
      for (const e of result.value) events.push({ ...e, calendarId: layer.calendarId, layerName: layer.name });
    } else {
      failed.push(layer.calendarId);
      kinds.push(result.reason instanceof GoogleError ? result.reason.kind : "http");
    }
  });

  if (kinds.includes("expired")) return { ok: false, reason: "expired" };
  if (failed.length === enabled.length && kinds.every((k) => k === "timeout")) {
    return { ok: false, reason: "timeout" };
  }
  events.sort(compareEvents);
  return { ok: true, events, failed };
}
