/**
 * google.ts is the one import the Personal page's calendar reads come through,
 * so these tests stub `fetch` and touch no network. What they pin is the error
 * taxonomy (R24, R42), the single 401 retry (asserted by fetch CALL COUNT, which
 * is what makes "no infinite retry" a test rather than a claim), the three-page
 * pagination ceiling reported as that layer's failure, the config message that
 * names variables and never values, and `none-enabled` making zero calls (R45).
 *
 * The token cache lives on `globalThis._googleTokenPromise` (the db.ts shape).
 * Each test clears it in `beforeEach` by assigning `undefined` to that global —
 * no test-only export exists for it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  GOOGLE_TIMEOUT_MS,
  GOOGLE_PAGE_CEILING,
  GoogleError,
  deleteEvent,
  insertEvent,
  listCalendars,
  listEvents,
  patchEvent,
  readCalendarWindow,
  readGoogleConfig,
  windowBounds,
} from "@/lib/google";
import type { Layer } from "@/lib/osSettings";

const SECRET = "fixture-client-secret-9f8e7d6c";
const REFRESH = "fixture-refresh-token-1a2b3c4d";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function stubConfig() {
  vi.stubEnv("GOOGLE_CLIENT_ID", "fixture-client-id.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", SECRET);
  vi.stubEnv("GOOGLE_REFRESH_TOKEN", REFRESH);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const tokenOk = (expiresIn = 3600) => json({ access_token: "at-1", expires_in: expiresIn });

interface Call {
  url: string;
  method: string;
  body: string | null;
}

/**
 * Routes the token endpoint to `token` and everything else to `api`. Records
 * every call so tests can count them.
 */
function stubFetch(
  api: (url: URL, call: Call) => Response | Promise<Response>,
  token: () => Response | Promise<Response> = () => tokenOk(),
): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const call: Call = {
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : init?.body ? String(init.body) : null,
    };
    calls.push(call);
    if (url === TOKEN_URL) return token();
    return api(new URL(url), call);
  }) as typeof fetch;
  return calls;
}

const apiCalls = (calls: Call[]) => calls.filter((c) => c.url !== TOKEN_URL);
const tokenCalls = (calls: Call[]) => calls.filter((c) => c.url === TOKEN_URL);

async function kindOf(p: Promise<unknown>): Promise<GoogleError> {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(GoogleError);
    return err as GoogleError;
  }
  throw new Error("expected a rejection");
}

const original = globalThis.fetch;
beforeEach(() => {
  globalThis._googleTokenPromise = undefined;
});
afterEach(() => {
  globalThis.fetch = original;
  globalThis._googleTokenPromise = undefined;
  vi.unstubAllEnvs();
});

describe("readGoogleConfig", () => {
  it("returns the three values when all are set", () => {
    const cfg = readGoogleConfig({
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: SECRET,
      GOOGLE_REFRESH_TOKEN: REFRESH,
    } as unknown as NodeJS.ProcessEnv);
    expect(cfg).toEqual({ clientId: "id", clientSecret: SECRET, refreshToken: REFRESH });
  });

  it("names every missing variable and never echoes a present value", () => {
    let err: unknown;
    try {
      readGoogleConfig({ GOOGLE_CLIENT_SECRET: SECRET, GOOGLE_REFRESH_TOKEN: "  " } as unknown as NodeJS.ProcessEnv);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GoogleError);
    const g = err as GoogleError;
    expect(g.kind).toBe("not-configured");
    expect(g.message).toContain("GOOGLE_CLIENT_ID");
    expect(g.message).toContain("GOOGLE_REFRESH_TOKEN"); // whitespace-only counts as missing
    expect(g.message).not.toContain("GOOGLE_CLIENT_SECRET");
    expect(g.message).not.toContain(SECRET);
    expect(g.message).toContain("(Value omitted from this message.)");
  });
});

describe("the token", () => {
  it("maps invalid_grant from the token endpoint to expired, with one call", async () => {
    stubConfig();
    const calls = stubFetch(
      () => json({ items: [] }),
      () => json({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400),
    );
    const err = await kindOf(listCalendars());
    expect(err.kind).toBe("expired");
    expect(calls).toHaveLength(1);
    expect(err.message).not.toContain(REFRESH);
    expect(err.message).not.toContain(SECRET);
  });

  it("sends the refresh token only to the token endpoint, as a form body", async () => {
    stubConfig();
    const calls = stubFetch(() => json({ items: [] }));
    await listCalendars();
    const [t] = tokenCalls(calls);
    expect(t.method).toBe("POST");
    expect(new URLSearchParams(t.body ?? "").get("grant_type")).toBe("refresh_token");
    for (const c of apiCalls(calls)) expect(c.url).not.toContain(REFRESH);
  });

  it("caches the token PROMISE: two concurrent reads make one token request", async () => {
    stubConfig();
    const calls = stubFetch(() => json({ items: [] }));
    await Promise.all([listCalendars(), listCalendars()]);
    expect(tokenCalls(calls)).toHaveLength(1);
    await listCalendars();
    expect(tokenCalls(calls)).toHaveLength(1);
  });

  it("refetches a token within 60 s of its expiry", async () => {
    stubConfig();
    const calls = stubFetch(() => json({ items: [] }), () => tokenOk(59));
    await listCalendars();
    await listCalendars();
    expect(tokenCalls(calls)).toHaveLength(2);
  });

  it("clears the cache on a rejected token request, so the next call tries again", async () => {
    stubConfig();
    let n = 0;
    const calls = stubFetch(
      () => json({ items: [] }),
      () => (n++ === 0 ? json({ error: "server_error" }, 500) : tokenOk()),
    );
    expect((await kindOf(listCalendars())).kind).toBe("http");
    await expect(listCalendars()).resolves.toEqual([]);
    expect(tokenCalls(calls)).toHaveLength(2);
  });
});

describe("error kinds", () => {
  it("maps a TimeoutError by name to timeout", async () => {
    stubConfig();
    stubFetch(() => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    expect((await kindOf(listCalendars())).kind).toBe("timeout");
  });

  it("maps a timed-out token request to timeout", async () => {
    stubConfig();
    stubFetch(
      () => json({ items: [] }),
      () => {
        throw new DOMException("aborted", "TimeoutError");
      },
    );
    expect((await kindOf(listCalendars())).kind).toBe("timeout");
  });

  it("maps 404 to gone", async () => {
    stubConfig();
    stubFetch(() => json({ error: { code: 404, message: "Not Found" } }, 404));
    const err = await kindOf(listEvents("vanished@group.calendar.google.com", "2026-09-10", "2026-09-17"));
    expect(err.kind).toBe("gone");
    expect(err.status).toBe(404);
  });

  it("maps 410 on a delete to gone", async () => {
    stubConfig();
    stubFetch(() => json({ error: { code: 410, message: "Resource has been deleted" } }, 410));
    expect((await kindOf(deleteEvent("primary", "evt1"))).kind).toBe("gone");
  });

  it("maps another 4xx to http, with the status and Google's message bounded", async () => {
    stubConfig();
    const long = "Rate limit exceeded. ".repeat(50);
    stubFetch(() => json({ error: { code: 403, message: long } }, 403));
    const err = await kindOf(listCalendars());
    expect(err.kind).toBe("http");
    expect(err.status).toBe(403);
    expect(err.message).toContain("Rate limit exceeded.");
    expect(err.message.length).toBeLessThanOrEqual(300);
  });

  it("keeps a timeout while reading an error body a timeout, not http", async () => {
    stubConfig();
    stubFetch(
      () =>
        ({
          ok: false,
          status: 500,
          text: async () => {
            throw new DOMException("aborted", "TimeoutError");
          },
        }) as unknown as Response,
    );
    expect((await kindOf(listCalendars())).kind).toBe("timeout");
  });

  it("reports an unparseable 200 body with a fixed phrase, never the parser's message", async () => {
    stubConfig();
    stubFetch(() => new Response("<html>not json</html>", { status: 200 }));
    const err = await kindOf(listCalendars());
    expect(err.kind).toBe("http");
    expect(err.message).toContain("unreadable response");
    expect(err.message).not.toContain("html");
  });

  it("maps a 5xx with a non-JSON body to http", async () => {
    stubConfig();
    stubFetch(() => new Response("<html>oops</html>", { status: 502 }));
    const err = await kindOf(listCalendars());
    expect(err.kind).toBe("http");
    expect(err.status).toBe(502);
  });
});

describe("the single 401 retry", () => {
  it("retries once on 401 with a fresh token, then succeeds", async () => {
    stubConfig();
    let n = 0;
    const calls = stubFetch(() => (n++ === 0 ? json({}, 401) : json({ items: [] })));
    await expect(listCalendars()).resolves.toEqual([]);
    expect(apiCalls(calls)).toHaveLength(2);
    expect(tokenCalls(calls)).toHaveLength(2);
  });

  it("a second 401 is expired, after exactly one retry", async () => {
    stubConfig();
    const calls = stubFetch(() => json({}, 401));
    const err = await kindOf(listCalendars());
    expect(err.kind).toBe("expired");
    expect(apiCalls(calls)).toHaveLength(2);
    expect(calls).toHaveLength(4);
  });
});

describe("pagination", () => {
  it("follows nextPageToken and merges the pages", async () => {
    stubConfig();
    const calls = stubFetch((url) =>
      url.searchParams.get("pageToken") === "p2"
        ? json({ items: [{ id: "b", summary: "B" }] })
        : json({ items: [{ id: "a", summary: "A" }], nextPageToken: "p2" }),
    );
    const cals = await listCalendars();
    expect(cals.map((c) => c.calendarId)).toEqual(["a", "b"]);
    expect(apiCalls(calls)).toHaveLength(2);
  });

  it(`stops at ${3} pages and fails the read rather than returning a short list`, async () => {
    stubConfig();
    expect(GOOGLE_PAGE_CEILING).toBe(3);
    let page = 0;
    const calls = stubFetch(() =>
      json({
        items: [{ id: `e${page}`, status: "confirmed", summary: "x", start: { date: "2026-09-10" } }],
        nextPageToken: `p${++page}`,
      }),
    );
    const err = await kindOf(listEvents("cal", "2026-09-10", "2026-09-17"));
    expect(err.kind).toBe("http");
    expect(err.message).toMatch(/3 pages/);
    expect(apiCalls(calls)).toHaveLength(3);
  });
});

describe("listEvents", () => {
  it("asks for expanded recurrences in Manila, over Manila day boundaries", async () => {
    stubConfig();
    const calls = stubFetch(() => json({ items: [] }));
    await listEvents("classes@group.calendar.google.com", "2026-09-10", "2026-09-17");
    const url = new URL(apiCalls(calls)[0].url);
    expect(url.pathname).toBe("/calendar/v3/calendars/classes%40group.calendar.google.com/events");
    expect(url.searchParams.get("singleEvents")).toBe("true");
    expect(url.searchParams.get("orderBy")).toBe("startTime");
    expect(url.searchParams.get("timeZone")).toBe("Asia/Manila");
    expect(url.searchParams.get("timeMin")).toBe("2026-09-09T16:00:00.000Z");
    expect(url.searchParams.get("timeMax")).toBe("2026-09-17T16:00:00.000Z");
  });

  it("normalises all-day and timed events, keying timed ones to the Manila day", async () => {
    stubConfig();
    stubFetch(() =>
      json({
        items: [
          {
            id: "allday",
            status: "confirmed",
            summary: "Holiday",
            htmlLink: "https://www.google.com/calendar/event?eid=1",
            start: { date: "2026-09-12" },
            end: { date: "2026-09-13" },
          },
          {
            id: "early",
            status: "confirmed",
            summary: "x".repeat(500),
            htmlLink: "https://www.google.com/calendar/event?eid=2",
            // 01:00 Manila on the 11th is 17:00Z on the 10th.
            start: { dateTime: "2026-09-11T01:00:00+08:00" },
            end: { dateTime: "2026-09-11T02:00:00+08:00" },
          },
          { id: "gone", status: "cancelled", start: { date: "2026-09-12" } },
          { id: "untitled", status: "confirmed", start: { date: "2026-09-14" }, htmlLink: "javascript:alert(1)" },
        ],
      }),
    );
    const events = await listEvents("cal", "2026-09-10", "2026-09-17");
    expect(events.map((e) => e.id)).toEqual(["allday", "early", "untitled"]);
    const [allday, early, untitled] = events;
    expect(allday).toMatchObject({ allDay: true, startsAt: null, endsAt: null, dayKey: "2026-09-12" });
    expect(early.allDay).toBe(false);
    expect(early.dayKey).toBe("2026-09-11");
    expect(early.startsAt?.toISOString()).toBe("2026-09-10T17:00:00.000Z");
    expect(early.title).toHaveLength(200);
    expect(untitled.title).toBe("(No title)");
    expect(untitled.htmlLink).toBe("");
  });
});

describe("multi-day all-day events", () => {
  const trip = (start: string, end: string) =>
    json({
      items: [
        {
          id: "trip",
          status: "confirmed",
          summary: "Baguio trip",
          htmlLink: "https://www.google.com/calendar/event?eid=t",
          start: { date: start },
          end: { date: end },
        },
      ],
    });

  it("a 4-day event across the window's start yields only the in-window days", async () => {
    stubConfig();
    // Covers 09-08 … 09-11 (end.date 09-12 is exclusive); the window opens 09-10.
    stubFetch(() => trip("2026-09-08", "2026-09-12"));
    const events = await listEvents("cal", "2026-09-10", "2026-09-17");
    expect(events.map((e) => e.dayKey)).toEqual(["2026-09-10", "2026-09-11"]);
    for (const e of events) {
      expect(e).toMatchObject({
        id: "trip",
        title: "Baguio trip",
        allDay: true,
        htmlLink: "https://www.google.com/calendar/event?eid=t",
      });
    }
  });

  it("a 4-day event across the window's end yields only the in-window days", async () => {
    stubConfig();
    stubFetch(() => trip("2026-09-16", "2026-09-20"));
    const events = await listEvents("cal", "2026-09-10", "2026-09-17");
    expect(events.map((e) => e.dayKey)).toEqual(["2026-09-16", "2026-09-17"]);
  });

  it("a single-day all-day event yields one entry", async () => {
    stubConfig();
    stubFetch(() => trip("2026-09-12", "2026-09-13"));
    const events = await listEvents("cal", "2026-09-10", "2026-09-17");
    expect(events.map((e) => e.dayKey)).toEqual(["2026-09-12"]);
  });

  it("readCalendarWindow carries the expansion through, in day order", async () => {
    stubConfig();
    stubFetch(() => trip("2026-09-10", "2026-09-13"));
    const w = await readCalendarWindow(
      [{ calendarId: "cal", name: "Personal", enabled: true }],
      "2026-09-10",
      "2026-09-17",
    );
    expect(w.ok && w.events.map((e) => `${e.dayKey}:${e.id}`)).toEqual([
      "2026-09-10:trip",
      "2026-09-11:trip",
      "2026-09-12:trip",
    ]);
  });
});

describe("windowBounds", () => {
  it("is Manila midnight of fromKey to Manila midnight after toKey (both days inclusive)", () => {
    const { timeMin, timeMax } = windowBounds("2026-12-31", "2027-01-01");
    expect(timeMin.toISOString()).toBe("2026-12-30T16:00:00.000Z");
    expect(timeMax.toISOString()).toBe("2027-01-01T16:00:00.000Z");
  });

  it("rejects a reversed or malformed window", () => {
    expect(() => windowBounds("2026-09-17", "2026-09-10")).toThrow(RangeError);
    expect(() => windowBounds("2026-02-31", "2026-03-01")).toThrow(RangeError);
  });
});

describe("readCalendarWindow", () => {
  const classes: Layer = { calendarId: "classes", name: "Classes", enabled: true };
  const personal: Layer = { calendarId: "personal", name: "Personal", enabled: true };
  const gym: Layer = { calendarId: "gym", name: "Gym", enabled: true };

  it("none-enabled makes zero fetch calls, configured or not", async () => {
    const calls = stubFetch(() => json({ items: [] }));
    const off = [{ ...classes, enabled: false }, { ...gym, enabled: false }];
    expect(await readCalendarWindow(off, "2026-09-10", "2026-09-17")).toEqual({
      ok: false,
      reason: "none-enabled",
    });
    expect(await readCalendarWindow([], "2026-09-10", "2026-09-17")).toEqual({
      ok: false,
      reason: "none-enabled",
    });
    stubConfig();
    await readCalendarWindow(off, "2026-09-10", "2026-09-17");
    expect(calls).toHaveLength(0);
  });

  it("a reversed or malformed window throws before any HTTP, but none-enabled still wins", async () => {
    stubConfig();
    const calls = stubFetch(() => json({ items: [] }));
    await expect(readCalendarWindow([classes], "2026-09-17", "2026-09-10")).rejects.toThrow(RangeError);
    await expect(readCalendarWindow([classes], "2026-02-31", "2026-03-07")).rejects.toThrow(RangeError);
    expect(await readCalendarWindow([{ ...classes, enabled: false }], "2026-09-17", "2026-09-10")).toEqual({
      ok: false,
      reason: "none-enabled",
    });
    expect(calls).toHaveLength(0);
  });

  it("not-configured makes zero fetch calls", async () => {
    const calls = stubFetch(() => json({ items: [] }));
    expect(await readCalendarWindow([classes], "2026-09-10", "2026-09-17")).toEqual({
      ok: false,
      reason: "not-configured",
    });
    expect(calls).toHaveLength(0);
  });

  it("returns failed: ['Classes'] when one of three layers rejects", async () => {
    stubConfig();
    const calls = stubFetch((url) =>
      url.pathname.includes("/calendars/classes/")
        ? json({ error: { message: "Backend Error" } }, 500)
        : json({
            items: [
              {
                id: `${url.pathname.split("/")[4]}-1`,
                status: "confirmed",
                summary: "Thing",
                start: { date: "2026-09-10" },
              },
            ],
          }),
    );
    const w = await readCalendarWindow([classes, personal, gym], "2026-09-10", "2026-09-17");
    expect(w.ok).toBe(true);
    if (!w.ok) return;
    expect(w.failed).toEqual(["Classes"]);
    expect(w.events.map((e) => e.layerName).sort()).toEqual(["Gym", "Personal"]);
    expect(tokenCalls(calls)).toHaveLength(1);
  });

  it("skips disabled layers and reports a layer truncated at the ceiling as that layer's failure", async () => {
    stubConfig();
    let page = 0;
    const calls = stubFetch((url) =>
      url.pathname.includes("/calendars/classes/")
        ? json({ items: [], nextPageToken: `p${++page}` })
        : json({ items: [] }),
    );
    const w = await readCalendarWindow(
      [classes, personal, { ...gym, enabled: false }],
      "2026-09-10",
      "2026-09-17",
    );
    expect(w).toEqual({ ok: true, events: [], failed: ["Classes"] });
    expect(apiCalls(calls).some((c) => c.url.includes("/calendars/gym/"))).toBe(false);
  });

  it("an expired refresh token is expired for the whole window, not N layer failures", async () => {
    stubConfig();
    const calls = stubFetch(
      () => json({ items: [] }),
      () => json({ error: "invalid_grant" }, 400),
    );
    expect(await readCalendarWindow([classes, personal], "2026-09-10", "2026-09-17")).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(apiCalls(calls)).toHaveLength(0);
  });

  it("every layer timing out is a timeout for the window", async () => {
    stubConfig();
    stubFetch(() => {
      throw new DOMException("aborted", "TimeoutError");
    });
    expect(await readCalendarWindow([classes, personal], "2026-09-10", "2026-09-17")).toEqual({
      ok: false,
      reason: "timeout",
    });
  });

  it("merges layers in day order, all-day first within a day", async () => {
    stubConfig();
    stubFetch((url) =>
      url.pathname.includes("/calendars/classes/")
        ? json({
            items: [
              { id: "c1", summary: "Lecture", start: { dateTime: "2026-09-10T09:00:00+08:00" }, end: { dateTime: "2026-09-10T10:00:00+08:00" } },
              { id: "c2", summary: "Lab", start: { dateTime: "2026-09-11T08:00:00+08:00" }, end: { dateTime: "2026-09-11T09:00:00+08:00" } },
            ],
          })
        : json({
            items: [
              { id: "p1", summary: "Errand", start: { dateTime: "2026-09-10T08:00:00+08:00" }, end: { dateTime: "2026-09-10T08:30:00+08:00" } },
              { id: "p2", summary: "Birthday", start: { date: "2026-09-10" }, end: { date: "2026-09-11" } },
            ],
          }),
    );
    const w = await readCalendarWindow([classes, personal], "2026-09-10", "2026-09-17");
    expect(w.ok && w.events.map((e) => e.id)).toEqual(["p2", "p1", "c1", "c2"]);
  });
});

describe("writes", () => {
  it("insertEvent writes an all-day entry with Google's exclusive end date", async () => {
    stubConfig();
    const calls = stubFetch(() => json({ id: "new1", htmlLink: "https://www.google.com/calendar/event?eid=n" }));
    const out = await insertEvent("primary", { title: "Pay rent", allDay: true, dayKey: "2026-09-30" });
    expect(out).toEqual({ id: "new1", htmlLink: "https://www.google.com/calendar/event?eid=n" });
    const call = apiCalls(calls)[0];
    expect(call.method).toBe("POST");
    expect(JSON.parse(call.body ?? "{}")).toEqual({
      summary: "Pay rent",
      start: { date: "2026-09-30" },
      end: { date: "2026-10-01" },
    });
  });

  it("insertEvent writes a timed entry in Manila time", async () => {
    stubConfig();
    const calls = stubFetch(() => json({ id: "new2", htmlLink: "https://www.google.com/x" }));
    await insertEvent("primary", {
      title: "Call",
      allDay: false,
      dayKey: "2026-09-30",
      start: "09:00",
      end: "09:30",
    });
    expect(JSON.parse(apiCalls(calls)[0].body ?? "{}")).toEqual({
      summary: "Call",
      start: { dateTime: "2026-09-30T09:00:00", timeZone: "Asia/Manila" },
      end: { dateTime: "2026-09-30T09:30:00", timeZone: "Asia/Manila" },
    });
  });

  it("patchEvent moves an all-day entry and deleteEvent accepts 204", async () => {
    stubConfig();
    const calls = stubFetch((_url, call) =>
      call.method === "DELETE" ? new Response(null, { status: 204 }) : json({ id: "e1" }),
    );
    await patchEvent("primary", "e1", { dayKey: "2026-10-02", title: "Moved" });
    await deleteEvent("primary", "e1");
    const [patch, del] = apiCalls(calls);
    expect(patch.method).toBe("PATCH");
    expect(JSON.parse(patch.body ?? "{}")).toEqual({
      summary: "Moved",
      start: { date: "2026-10-02" },
      end: { date: "2026-10-03" },
    });
    expect(del.method).toBe("DELETE");
    expect(new URL(del.url).pathname).toBe("/calendar/v3/calendars/primary/events/e1");
  });
});

it("exposes a five-second timeout", () => {
  expect(GOOGLE_TIMEOUT_MS).toBe(5000);
});
