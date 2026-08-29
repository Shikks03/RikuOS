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
  ST_TIMEOUT_MS,
} from "@/lib/stApi";

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
});

describe("timeouts", () => {
  it("bounds every external call (CLAUDE.md)", () => {
    expect(ST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(ST_TIMEOUT_MS).toBeLessThanOrEqual(20_000);
  });
});
