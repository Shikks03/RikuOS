/**
 * The failure classifier is the safety-critical part of P4: a mis-classified
 * failure is a duplicate message to a real client. These tests pin the table in
 * the plan's "action-execution failure contract" section. Do not relax one
 * without changing that table first.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  readStConfig,
  classifyDraftStatus,
  classifyFetchError,
  createDraft,
  fetchAttention,
  fetchSummary,
  sendMessengerReply,
  ST_TIMEOUT_MS,
} from "@/lib/stApi";
import { evaluateOutreach } from "@/lib/outreachHealth";

const GOOD_SECRET = "s".repeat(32);

function env(over: Record<string, string | undefined> = {}) {
  return {
    ST_API_BASE_URL: "https://st.example.com",
    ST_API_SECRET: GOOD_SECRET,
    ...over,
  } as unknown as NodeJS.ProcessEnv;
}

describe("readStConfig", () => {
  it("returns a trimmed base url and the secret", () => {
    expect(readStConfig(env({ ST_API_BASE_URL: "https://st.example.com///" }))).toEqual({
      baseUrl: "https://st.example.com",
      secret: GOOD_SECRET,
    });
  });

  it("throws when the base url is missing", () => {
    expect(() => readStConfig(env({ ST_API_BASE_URL: undefined }))).toThrow(/ST_API_BASE_URL/);
  });

  it("throws when the base url has no http scheme", () => {
    expect(() => readStConfig(env({ ST_API_BASE_URL: "st.example.com" }))).toThrow(/http/);
  });

  it("throws when the secret is shorter than 32 characters", () => {
    expect(() => readStConfig(env({ ST_API_SECRET: "short" }))).toThrow(/32/);
  });

  it("never puts the secret in the error message", () => {
    try {
      readStConfig(env({ ST_API_BASE_URL: undefined }));
    } catch (err) {
      expect((err as Error).message).not.toContain(GOOD_SECRET);
    }
  });
});

describe("classifyDraftStatus", () => {
  it.each([201])("treats %i as created", (s) => {
    expect(classifyDraftStatus(s)).toBe("created");
  });

  it("treats 409 as duplicate — the desired end state already holds", () => {
    expect(classifyDraftStatus(409)).toBe("duplicate");
  });

  it.each([400, 401, 404, 422, 503])(
    "treats %i as rejected — every early return precedes EmailLog.create",
    (s) => {
      expect(classifyDraftStatus(s)).toBe("rejected");
    }
  );

  it.each([500, 502, 504])("treats %i as unknown — may have happened after the write", (s) => {
    expect(classifyDraftStatus(s)).toBe("unknown");
  });

  it.each([200, 204, 301, 418])("treats unmodelled status %i as unknown", (s) => {
    expect(classifyDraftStatus(s)).toBe("unknown");
  });
});

describe("classifyFetchError", () => {
  function withCause(code: string): Error {
    const err = new Error("fetch failed");
    (err as Error & { cause?: { code: string } }).cause = { code };
    return err;
  }

  it.each([
    "ECONNREFUSED",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ERR_INVALID_URL",
    "CERT_HAS_EXPIRED",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
  ])("treats %s as rejected — the connection was never established", (code) => {
    expect(classifyFetchError(withCause(code))).toBe("rejected");
  });

  it("treats our own timeout as unknown — the request WAS sent", () => {
    const abort = new Error("The operation was aborted due to timeout");
    abort.name = "TimeoutError";
    expect(classifyFetchError(abort)).toBe("unknown");
  });

  it("treats a reset connection as unknown — the request may have been delivered", () => {
    expect(classifyFetchError(withCause("ECONNRESET"))).toBe("unknown");
  });

  it("defaults an unrecognised error to unknown, never to rejected", () => {
    expect(classifyFetchError(new Error("something else entirely"))).toBe("unknown");
    expect(classifyFetchError(withCause("SOME_NEW_CODE"))).toBe("unknown");
  });
});

describe("createDraft", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
    vi.unstubAllEnvs();
  });

  function stubEnv() {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
  }

  function stubFetch(impl: () => Promise<Response> | never) {
    globalThis.fetch = (async () => impl()) as typeof fetch;
  }

  const body = { contactId: "c1", channel: "email" as const, body: "hi", replyToLogId: "l1" };

  it("returns created with the log id on 201", async () => {
    stubEnv();
    stubFetch(async () => new Response(JSON.stringify({ _id: "log-9" }), { status: 201 }));
    expect(await createDraft(body)).toEqual({ kind: "created", logId: "log-9" });
  });

  it("returns created with a null id when a 201 body will not parse", async () => {
    stubEnv();
    stubFetch(async () => new Response("not json", { status: 201 }));
    expect(await createDraft(body)).toEqual({ kind: "created", logId: null });
  });

  it("returns duplicate on 409", async () => {
    stubEnv();
    stubFetch(async () => new Response(JSON.stringify({ error: "exists" }), { status: 409 }));
    expect((await createDraft(body)).kind).toBe("duplicate");
  });

  it("returns rejected on 422 and carries the server's message", async () => {
    stubEnv();
    stubFetch(
      async () =>
        new Response(JSON.stringify({ error: "Contact has no email address." }), { status: 422 })
    );
    const out = await createDraft(body);
    expect(out.kind).toBe("rejected");
    if (out.kind === "rejected") {
      expect(out.status).toBe(422);
      expect(out.message).toContain("no email address");
    }
  });

  it("returns unknown on 500", async () => {
    stubEnv();
    stubFetch(async () => new Response("boom", { status: 500 }));
    expect((await createDraft(body)).kind).toBe("unknown");
  });

  it("returns unknown when the request times out", async () => {
    stubEnv();
    stubFetch(() => {
      const err = new Error("aborted");
      err.name = "TimeoutError";
      throw err;
    });
    expect((await createDraft(body)).kind).toBe("unknown");
  });

  it("returns rejected — not unknown — when the connection is refused", async () => {
    stubEnv();
    stubFetch(() => {
      const err = new Error("fetch failed");
      (err as Error & { cause?: { code: string } }).cause = { code: "ECONNREFUSED" };
      throw err;
    });
    expect((await createDraft(body)).kind).toBe("rejected");
  });

  it("returns rejected without touching the network when config is missing", async () => {
    vi.stubEnv("ST_API_BASE_URL", "");
    vi.stubEnv("ST_API_SECRET", "");
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("", { status: 201 });
    }) as typeof fetch;
    expect((await createDraft(body)).kind).toBe("rejected");
    expect(called).toBe(false);
  });

  it("never throws, whatever fetch does", async () => {
    stubEnv();
    stubFetch(() => {
      throw "a string, not an Error";
    });
    await expect(createDraft(body)).resolves.toBeDefined();
  });

  it("sends the secret as x-os-secret and omits an absent subject", async () => {
    stubEnv();
    let seen: { url: string; init: RequestInit } | null = null;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ _id: "l" }), { status: 201 });
    }) as unknown as typeof fetch;
    await createDraft(body);
    expect(seen!.url).toBe("https://st.example.com/api/os/drafts");
    expect((seen!.init.headers as Record<string, string>)["x-os-secret"]).toBe(GOOD_SECRET);
    expect(JSON.parse(seen!.init.body as string)).toEqual({
      contactId: "c1",
      channel: "email",
      body: "hi",
      replyToLogId: "l1",
    });
  });
});

describe("fetchAttention", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
    vi.unstubAllEnvs();
  });

  it("throws with a diagnosable message on a non-200 — a GET has no side effect to protect", async () => {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
    globalThis.fetch = (async () => new Response("", { status: 503 })) as typeof fetch;
    await expect(fetchAttention(3, 50)).rejects.toThrow(/503/);
  });

  it("returns the repliedUnanswered array on 200", async () => {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ repliedUnanswered: [{ contactId: "c1" }] }), {
        status: 200,
      })) as typeof fetch;
    const out = await fetchAttention(3, 50);
    expect(out.repliedUnanswered).toHaveLength(1);
  });

  it("carries overdueActions through — the digest's overdue count depends on it", async () => {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          repliedUnanswered: [],
          overdueActions: [
            {
              contactId: "c2",
              businessName: "Acme",
              nextActionAt: "2026-08-01T00:00:00.000Z",
              nextActionNote: "call back",
            },
          ],
        }),
        { status: 200 }
      )) as typeof fetch;
    const out = await fetchAttention(3, 50);
    expect(out.overdueActions).toHaveLength(1);
    expect(out.overdueActions?.[0].businessName).toBe("Acme");
  });

  it("leaves overdueActions undefined when the API omits it, rather than throwing", async () => {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ repliedUnanswered: [] }), { status: 200 })) as typeof fetch;
    const out = await fetchAttention(3, 50);
    expect(out.overdueActions).toBeUndefined();
  });
});

describe("fetchSummary", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
    vi.unstubAllEnvs();
  });

  function respond(body: unknown, status = 200) {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(body), { status })) as typeof fetch;
  }

  it("throws with a diagnosable message on a non-200", async () => {
    respond({}, 401);
    await expect(fetchSummary()).rejects.toThrow(/401/);
  });

  it("sends the secret in the x-os-secret header and never in the URL", async () => {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
    let seenUrl = "";
    let seenHeaders: Record<string, string> = {};
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seenUrl = String(url);
      seenHeaders = init.headers as Record<string, string>;
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;
    await fetchSummary();
    expect(seenUrl).toBe("https://st.example.com/api/os/summary");
    expect(seenUrl).not.toContain(GOOD_SECRET);
    expect(seenHeaders["x-os-secret"]).toBe(GOOD_SECRET);
  });

  it("carries every consumed field through — widening the type alone is not enough", async () => {
    // The trap this file has already sprung once: the return value is
    // RECONSTRUCTED, so a field added to the interface but not to the object
    // below arrives undefined at runtime and the check silently reads clean.
    respond({
      queue: { drafts: 24, approved: 2 },
      engine: { lastRunAt: "2026-08-01T07:06:27.319Z", lastRunErrors: 3 },
      messenger: { lastEventAt: "2026-08-29T00:00:00.000Z", unlinkedCount: 1, unansweredCount: 2 },
      contacts: { total: 30 },
    });
    expect(await fetchSummary()).toEqual({
      queue: { drafts: 24, approved: 2 },
      engine: { lastRunAt: "2026-08-01T07:06:27.319Z", lastRunErrors: 3 },
      messenger: { lastEventAt: "2026-08-29T00:00:00.000Z", unlinkedCount: 1, unansweredCount: 2 },
    });
  });

  it("reads a missing count as null, never as a real zero", async () => {
    // "The engine reported no errors" and "the engine reported nothing" are
    // different findings, and only one of them is reassuring.
    respond({ queue: {}, engine: {}, messenger: {} });
    const out = await fetchSummary();
    expect(out.engine).toEqual({ lastRunAt: null, lastRunErrors: null });
    expect(out.queue).toEqual({ drafts: null, approved: null });
  });

  it("survives a response missing whole sections rather than throwing", async () => {
    respond({});
    const out = await fetchSummary();
    expect(out.engine.lastRunAt).toBeNull();
    expect(out.messenger.unansweredCount).toBeNull();
  });

  it("rejects a non-numeric count, and keeps a junk timestamp out of the null bucket", async () => {
    // The empty stamp used to become null. It must not any more: null is now a
    // FINDING in outreachHealth ("reports no event, ever") that sends Riku to
    // Meta's dashboard, and an empty string is a contract problem on
    // ShikksTracker's side, not a Meta one. It stays non-null so it lands in
    // the unreadable branch, which points at the API instead.
    respond({
      queue: { drafts: "24", approved: null },
      engine: { lastRunAt: "", lastRunErrors: Number.NaN },
      messenger: {},
    });
    const out = await fetchSummary();
    expect(out.queue.drafts).toBeNull();
    expect(out.engine.lastRunErrors).toBeNull();
    expect(out.engine.lastRunAt).not.toBeNull();
    expect(Number.isNaN(new Date(out.engine.lastRunAt as string).getTime())).toBe(true);
  });

  it("keeps a present-but-non-string stamp out of the null bucket too", async () => {
    // Four states used to collapse to null: field null, field absent, whole
    // block absent, and field present but the wrong type. Only the first three
    // are "ShikksTracker reported nothing". The fourth is a contract break, and
    // reporting it as "no event, ever" would send Riku to regenerate a page
    // token that was never broken. Coerced instead, so it fails to parse and
    // surfaces as unreadable.
    respond({
      queue: {},
      engine: { lastRunAt: { $date: 1 }, lastRunErrors: null },
      messenger: { lastEventAt: 1757000000, unlinkedCount: null, unansweredCount: null },
    });
    const out = await fetchSummary();
    for (const stamp of [out.engine.lastRunAt, out.messenger.lastEventAt]) {
      expect(stamp).not.toBeNull();
      expect(Number.isNaN(new Date(stamp as string).getTime())).toBe(true);
    }
  });

  it("makes a SMALL number unreadable too, not a date from the year 2026", async () => {
    // The case that motivated the typeof tag over String(value). `String(2026)`
    // parses cleanly as 2026-01-01, so a numeric field slipped past the
    // unreadable branch and came out as "Messenger webhook silent for 246d" —
    // a line pointing squarely at Meta for what is a contract break. Coercing
    // to a tag leaves no arithmetic for a wrong value to succeed at. This
    // assertion fails if anyone reverts to String(value).
    respond({
      queue: {},
      engine: {},
      messenger: { lastEventAt: 2026, unlinkedCount: null, unansweredCount: null },
    });
    const out = await fetchSummary();
    const findings = evaluateOutreach(new Date("2026-09-04T00:00:00.000Z"), out);
    expect(findings.map((f) => f.kind)).toContain("webhook-unreadable");
    expect(findings.map((f) => f.kind)).not.toContain("webhook-stale");
  });

  it("still reads an absent stamp, and an absent block, as null", async () => {
    // The other side of the same rule. These three ARE "ShikksTracker reported
    // nothing", and null is what outreachHealth reads as such.
    respond({ queue: {}, engine: { lastRunAt: null }, messenger: {} });
    const explicitNull = await fetchSummary();
    expect(explicitNull.engine.lastRunAt).toBeNull();
    expect(explicitNull.messenger.lastEventAt).toBeNull();

    respond({});
    expect((await fetchSummary()).messenger.lastEventAt).toBeNull();
  });
});

describe("timeouts", () => {
  it("bounds every external call (CLAUDE.md)", () => {
    expect(ST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(ST_TIMEOUT_MS).toBeLessThanOrEqual(20_000);
  });
});

describe("sendMessengerReply", () => {
  // Unlike the rest of this file, these tests stub fetch with vi.stubGlobal
  // rather than assigning globalThis.fetch directly, per the plan's spec.
  // vi.stubGlobal has no automatic cleanup, so — unlike the manual
  // save/restore the other describe blocks use — this block must call
  // vi.unstubAllGlobals() itself or a stubbed fetch leaks into whatever runs
  // next in this file. Also unstub envs, matching every other block here.
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function stubEnv() {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
  }

  it("reports done on a 200", async () => {
    stubEnv();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await sendMessengerReply("c1", "hello");
    expect(out.status).toBe("done");
  });

  it("reports FAILED (retry safe) on a 4xx refusal", async () => {
    // The far side answered and declined. Provably nothing was sent.
    stubEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "window closed" }), { status: 409 })
      )
    );
    const out = await sendMessengerReply("c1", "hello");
    expect(out.status).toBe("failed");
    expect(out.note).toMatch(/window closed/);
  });

  it("reports NEEDS_VERIFICATION on a timeout, never failed", async () => {
    // We do not know whether Meta sent it. Retrying could double-message a
    // prospect, which is worse than replying late (CLAUDE.md asymmetric rule).
    stubEnv();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("aborted")));
    const out = await sendMessengerReply("c1", "hello");
    expect(out.status).toBe("needs_verification");
  });

  it("reports needs_verification on a 5xx, because the send may have happened", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 502 })));
    const out = await sendMessengerReply("c1", "hello");
    expect(out.status).toBe("needs_verification");
  });

  it("returns failed without touching the network when config is missing", async () => {
    // The config-error path: readStConfig() throws before fetch is ever
    // called, so this must classify as failed (nothing was sent, safe to
    // retry once configured) rather than needs_verification.
    vi.stubEnv("ST_API_BASE_URL", "");
    vi.stubEnv("ST_API_SECRET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await sendMessengerReply("c1", "hello");
    expect(out.status).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws, whatever fetch does", async () => {
    stubEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        throw "a string, not an Error";
      })
    );
    await expect(sendMessengerReply("c1", "hello")).resolves.toBeDefined();
  });
});
