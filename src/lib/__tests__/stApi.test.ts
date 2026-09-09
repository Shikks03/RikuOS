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
  fetchVariantStats,
  ATTENTION_LIMIT,
  PIPELINE_STAGES,
  ST_PAGE_TIMEOUT_MS,
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
    // R75's console.warn stubs, put back so a later test can still see it.
    vi.restoreAllMocks();
  });

  /** R75: dropping rows now says so out loud. The suite stays quiet anyway. */
  function silenceDropWarning() {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  }

  /**
   * A row that survives R74's guard. Since that ruling a stub row is no longer
   * a usable fixture anywhere in this block: an item missing the fields the
   * page renders is dropped on purpose, so every test that expects a row to
   * come back has to send a whole one.
   */
  function attentionItem(over: Record<string, unknown> = {}) {
    return {
      contactId: "c1",
      businessName: "Acme Bakery",
      contactName: null,
      channel: "email",
      repliedAt: "2026-09-01T00:00:00.000Z",
      replySnippet: null,
      lastOutboundBody: null,
      keyPoints: "wants a site",
      offerSummary: null,
      toneNotes: null,
      stage: 2,
      replyToLogId: "log-1",
      ...over,
    };
  }

  function respondWith(body: unknown) {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
  }

  it("throws with a diagnosable message on a non-200 — a GET has no side effect to protect", async () => {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
    globalThis.fetch = (async () => new Response("", { status: 503 })) as typeof fetch;
    await expect(fetchAttention(3, 50)).rejects.toThrow(/503/);
  });

  it("returns the repliedUnanswered array on 200", async () => {
    respondWith({ repliedUnanswered: [attentionItem()] });
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

  // R74. Block E prints `businessName` as link text and `channel` raw, so a row
  // carrying an object where a string belongs throws inside React and 500s the
  // whole route. Each bad row below is invalid in exactly ONE way, so a guard
  // that dropped rows for the wrong reason would still be visible here.
  it("drops a repliedUnanswered row that cannot render and keeps the rest (R74)", async () => {
    silenceDropWarning();
    const valid = attentionItem();
    respondWith({
      repliedUnanswered: [
        valid,
        attentionItem({ contactId: "c2", businessName: { first: "Acme" } }),
        attentionItem({ contactId: "" }),
        attentionItem({ contactId: "c4", replyToLogId: undefined }),
        attentionItem({ contactId: "c5", channel: 7 }),
        attentionItem({ contactId: "c6", repliedAt: null }),
      ],
    });
    const out = await fetchAttention(3, 50);
    // The survivor comes back UNCHANGED — fetchAttention filters, it never
    // reconstructs, because the chaser reads the fields the page does not.
    expect(out.repliedUnanswered).toEqual([valid]);
  });

  it("drops an overdueActions row that cannot render (R74)", async () => {
    silenceDropWarning();
    const valid = {
      contactId: "c1",
      businessName: "Acme Bakery",
      nextActionAt: "2026-08-01T00:00:00.000Z",
      nextActionNote: "call back",
    };
    respondWith({
      repliedUnanswered: [],
      overdueActions: [
        valid,
        { ...valid, contactId: "c2", businessName: 42 },
        { ...valid, contactId: "" },
      ],
    });
    const out = await fetchAttention(3, 50);
    // Filtering never changes PRESENCE: the block arrived, so it is still an
    // array here, and Block E must not read this as "the feed never reported".
    expect(Array.isArray(out.overdueActions)).toBe(true);
    expect(out.overdueActions).toEqual([valid]);
  });

  // R75. Row-level parity with the siblings was real; block-level was not.
  // Reading a missing block as [] made Block E say `Nothing waiting.` and the
  // digest count zero — a false all-clear from a contract break.
  it("throws when the body carries no repliedUnanswered array (R75)", async () => {
    respondWith({ repliedUnanswered: { items: [] } });
    await expect(fetchAttention(3, 50)).rejects.toThrow(/repliedUnanswered/);
  });

  // The same contract break arriving as a 200 whose whole body is `null`. The
  // bare property access does throw — but a TypeError from V8, which happens to
  // quote the property name, so `/repliedUnanswered/` alone cannot tell the
  // named error from the accident. The second assertion is what discriminates:
  // only the guard reports the BODY's own type, and only the guard runs before
  // anything reads into the body.
  it("names the contract error for a null body too (R75)", async () => {
    respondWith(null);
    await expect(fetchAttention(3, 50)).rejects.toThrow(/repliedUnanswered/);
    await expect(fetchAttention(3, 50)).rejects.toThrow(/got a null body/);
  });

  it("bounds repliedUnanswered to limit on this side too (R74)", async () => {
    respondWith({
      repliedUnanswered: ["c1", "c2", "c3", "c4", "c5"].map((contactId) =>
        attentionItem({ contactId })
      ),
    });
    const out = await fetchAttention(3, 3);
    expect(out.repliedUnanswered.map((item) => item.contactId)).toEqual(["c1", "c2", "c3"]);
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
      contacts: {
        total: 30,
        hot: 2,
        byPipelineStage: {
          not_started: 25,
          contacted: 3,
          replied: 2,
          call_booked: 0,
          proposal_sent: 0,
          won: 0,
          lost: 0,
        },
      },
      campaigns: [{ id: "c1", name: "Test One", sent: 5, opened: 2, clicked: 0, replied: 2 }],
    });
    expect(await fetchSummary()).toEqual({
      queue: { drafts: 24, approved: 2 },
      engine: { lastRunAt: "2026-08-01T07:06:27.319Z", lastRunErrors: 3 },
      contacts: {
        total: 30,
        hot: 2,
        byPipelineStage: {
          not_started: 25,
          contacted: 3,
          replied: 2,
          call_booked: 0,
          proposal_sent: 0,
          won: 0,
          lost: 0,
        },
      },
      campaigns: [{ id: "c1", name: "Test One", sent: 5, opened: 2, clicked: 0, replied: 2 }],
    });
  });

  it("reads a missing contacts block as null, not as seven zeros", async () => {
    respond({ queue: {}, engine: {} });
    const out = await fetchSummary();
    expect(out.contacts).toBeNull();
    expect(out.campaigns).toBeNull();
  });

  it("keys byPipelineStage by exactly PIPELINE_STAGES, with absent stages null", async () => {
    respond({
      queue: {},
      engine: {},
      contacts: { total: 30, hot: 2, byPipelineStage: { not_started: 25, contacted: 3 } },
    });
    const out = await fetchSummary();
    expect(Object.keys(out.contacts!.byPipelineStage)).toEqual([...PIPELINE_STAGES]);
    expect(out.contacts!.byPipelineStage.not_started).toBe(25);
    // The stage the API omitted must never read as a measured zero.
    expect(out.contacts!.byPipelineStage.won).toBeNull();
  });

  it("reads a non-numeric contacts count as null", async () => {
    respond({
      queue: {},
      engine: {},
      contacts: { total: "30", hot: null, byPipelineStage: { not_started: Number.NaN } },
    });
    const out = await fetchSummary();
    expect(out.contacts!.total).toBeNull();
    expect(out.contacts!.hot).toBeNull();
    expect(out.contacts!.byPipelineStage.not_started).toBeNull();
  });

  it("keeps a campaigns array that is present but empty distinct from an absent one", async () => {
    respond({ queue: {}, engine: {}, campaigns: [] });
    expect((await fetchSummary()).campaigns).toEqual([]);

    respond({ queue: {}, engine: {} });
    expect((await fetchSummary()).campaigns).toBeNull();
  });

  it("carries every campaign column through, nulling the ones that did not arrive", async () => {
    respond({
      queue: {},
      engine: {},
      campaigns: [
        { id: "c1", name: "Test One", sent: 5, opened: 2, clicked: 0, replied: 2 },
        { id: "c2", name: "Test number 2" },
      ],
    });
    const rows = (await fetchSummary()).campaigns!;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      id: "c1",
      name: "Test One",
      sent: 5,
      opened: 2,
      clicked: 0,
      replied: 2,
    });
    expect(rows[1]).toEqual({
      id: "c2",
      name: "Test number 2",
      sent: null,
      opened: null,
      clicked: null,
      replied: null,
    });
  });

  it("drops a campaign row that is not an object rather than throwing", async () => {
    respond({ queue: {}, engine: {}, campaigns: [null, "nope", { id: "c1", name: "Real" }] });
    const rows = (await fetchSummary()).campaigns!;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("c1");
  });

  it("drops a campaign row with no string id — it cannot be keyed", async () => {
    // The rule fetchVariantStats already applies to `key`. Block C's React key
    // is the id, so a row without one cannot be rendered honestly.
    respond({
      queue: {},
      engine: {},
      campaigns: [{ name: "Nameless" }, { id: "", name: "Empty" }, { id: "c1", name: "Real" }],
    });
    const rows = (await fetchSummary()).campaigns!;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("c1");
  });

  it("reads a contacts value that is not an object as null, not as a block of nulls", async () => {
    // "Not reported" and "reported, all unknown" are different findings. A
    // string is neither, and must not manufacture the second.
    respond({ queue: {}, engine: {}, contacts: "30" });
    expect((await fetchSummary()).contacts).toBeNull();

    respond({ queue: {}, engine: {}, contacts: [1, 2] });
    expect((await fetchSummary()).contacts).toBeNull();
  });

  it("reads a missing count as null, never as a real zero", async () => {
    // "The engine reported no errors" and "the engine reported nothing" are
    // different findings, and only one of them is reassuring.
    respond({ queue: {}, engine: {} });
    const out = await fetchSummary();
    expect(out.engine).toEqual({ lastRunAt: null, lastRunErrors: null });
    expect(out.queue).toEqual({ drafts: null, approved: null });
  });

  it("survives a response missing whole sections rather than throwing", async () => {
    respond({});
    const out = await fetchSummary();
    expect(out.engine.lastRunAt).toBeNull();
    expect(out.queue.drafts).toBeNull();
  });

  it("rejects a non-numeric count, and keeps a junk timestamp out of the null bucket", async () => {
    // The empty stamp used to become null. It must not any more: null is a
    // FINDING in outreachHealth ("has never reported a run"), and an empty
    // string is a contract problem on ShikksTracker's side rather than a
    // genuine "never ran". It stays non-null so it lands in the unreadable
    // branch, which points at the API instead.
    respond({
      queue: { drafts: "24", approved: null },
      engine: { lastRunAt: "", lastRunErrors: Number.NaN },
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
    // reporting it as "never ran" would point at the wrong repo. Coerced
    // instead, so it fails to parse and surfaces as unreadable.
    respond({
      queue: {},
      engine: { lastRunAt: { $date: 1 }, lastRunErrors: null },
    });
    const out = await fetchSummary();
    expect(out.engine.lastRunAt).not.toBeNull();
    expect(Number.isNaN(new Date(out.engine.lastRunAt as string).getTime())).toBe(true);
  });

  it("makes a SMALL number unreadable too, not a date from the year 2026", async () => {
    // The case that motivated the typeof tag over String(value). `String(2026)`
    // parses cleanly as 2026-01-01, so a numeric field slipped past the
    // unreadable branch and surfaced as a plausible-looking staleness figure —
    // a line blaming the upstream system for what is a contract break.
    // Coercing to a tag leaves no arithmetic for a wrong value to succeed at.
    // This assertion fails if anyone reverts to String(value).
    //
    // Originally written against messenger.lastEventAt; retargeted to
    // engine.lastRunAt when the Messenger lane was deleted (S15, 2026-09-05).
    // The rule under test is readStamp's, and was never specific to a field.
    respond({
      queue: {},
      engine: { lastRunAt: 2026, lastRunErrors: null },
    });
    const out = await fetchSummary();
    const findings = evaluateOutreach(new Date("2026-09-04T00:00:00.000Z"), out);
    expect(findings.map((f) => f.kind)).toContain("engine-unreadable");
    expect(findings.map((f) => f.kind)).not.toContain("engine-stale");
  });

  it("still reads an absent stamp, and an absent block, as null", async () => {
    // The other side of the same rule. These three ARE "ShikksTracker reported
    // nothing", and null is what outreachHealth reads as such.
    respond({ queue: {}, engine: { lastRunAt: null } });
    expect((await fetchSummary()).engine.lastRunAt).toBeNull();

    respond({ queue: {}, engine: {} });
    expect((await fetchSummary()).engine.lastRunAt).toBeNull();

    respond({});
    expect((await fetchSummary()).engine.lastRunAt).toBeNull();
  });
});

describe("timeouts", () => {
  it("bounds every external call (CLAUDE.md)", () => {
    expect(ST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(ST_TIMEOUT_MS).toBeLessThanOrEqual(20_000);
  });
});

describe("fetchVariantStats", () => {
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
    respond([], 503);
    await expect(fetchVariantStats()).rejects.toThrow(/503/);
  });

  it("parses the row shape from the bare array the endpoint returns", async () => {
    respond([
      {
        key: "email-s1-compliment",
        label: "Email S1 — specific compliment first",
        channel: "email",
        stage: 1,
        sends: 72,
        uniqueContacts: 70,
        replies: 8,
        replyRate: 0.1111,
        bySlice: { leadSource: {}, webPresenceTier: {} },
      },
    ]);
    const rows = await fetchVariantStats();
    expect(rows).toEqual([
      {
        key: "email-s1-compliment",
        label: "Email S1 — specific compliment first",
        channel: "email",
        stage: 1,
        sends: 72,
        uniqueContacts: 70,
        replies: 8,
        replyRate: 0.1111,
      },
    ]);
  });

  it("nulls the metadata a deleted Variant leaves behind rather than inventing it", async () => {
    respond([{ key: "orphan", label: null, channel: null, stage: null, sends: 4, replies: 0 }]);
    const rows = await fetchVariantStats();
    expect(rows[0].label).toBeNull();
    expect(rows[0].channel).toBeNull();
    expect(rows[0].sends).toBe(4);
    expect(rows[0].uniqueContacts).toBeNull();
  });

  it("throws on a body that is not an array — a changed contract must not read as an empty one", async () => {
    // The exact body a move to an envelope would produce. Returning [] here
    // would render `No approaches set up.` forever, silently; the throw reaches
    // the page's per-block catch as `Couldn't load approach performance.`
    respond({ variants: [] });
    await expect(fetchVariantStats()).rejects.toThrow(/not an array/);
  });

  it("drops a row with no string key — it can never be identified or keyed", async () => {
    respond([{ label: "nameless" }, { key: "good", label: "Good" }]);
    const rows = await fetchVariantStats();
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("good");
  });

  it("sends the secret in the header and never in the URL", async () => {
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
    let seenUrl = "";
    let seenHeaders: Record<string, string> = {};
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seenUrl = String(url);
      seenHeaders = init.headers as Record<string, string>;
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;
    await fetchVariantStats();
    expect(seenUrl).toBe("https://st.example.com/api/os/variant-stats");
    expect(seenUrl).not.toContain(GOOD_SECRET);
    expect(seenHeaders["x-os-secret"]).toBe(GOOD_SECRET);
  });
});

describe("the page timeout", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is well under the cron timeout — a human must not wait a cron's patience", () => {
    expect(ST_PAGE_TIMEOUT_MS).toBeGreaterThan(0);
    expect(ST_PAGE_TIMEOUT_MS).toBeLessThan(ST_TIMEOUT_MS);
  });

  it("is optional on all three GETs, and defaults to the cron timeout", async () => {
    // AbortSignal.timeout is the only observable difference, so the assertion
    // is on the signal each call was handed rather than on wall-clock time.
    // The spy is REAL (spyOn, not mockImplementation), so the fetch stub still
    // receives a genuine signal — and the recorded arguments are what pins the
    // feature this test names. Asserting `instanceof AbortSignal` alone could
    // not fail if timeoutMs were ignored entirely.
    vi.stubEnv("ST_API_BASE_URL", "https://st.example.com");
    vi.stubEnv("ST_API_SECRET", GOOD_SECRET);
    const seen: (AbortSignal | undefined)[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen.push(init.signal ?? undefined);
      // Each GET is answered with a body ITS OWN contract accepts: since R75
      // /attention rejects a body with no repliedUnanswered array, while the
      // other two read a bare array. One shared body would fail this test on a
      // rule it does not test — the subject here is only the timeout argument.
      const body = String(url).includes("/api/os/attention") ? { repliedUnanswered: [] } : [];
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const spy = vi.spyOn(AbortSignal, "timeout");

    await fetchSummary();
    await fetchSummary(ST_PAGE_TIMEOUT_MS);
    await fetchAttention(3, 50);
    await fetchAttention(3, 50, ST_PAGE_TIMEOUT_MS);
    await fetchVariantStats();
    await fetchVariantStats(ST_PAGE_TIMEOUT_MS);

    expect(seen).toHaveLength(6);
    for (const signal of seen) expect(signal).toBeInstanceOf(AbortSignal);
    expect(spy.mock.calls.map((c) => c[0])).toEqual([
      ST_TIMEOUT_MS,
      ST_PAGE_TIMEOUT_MS,
      ST_TIMEOUT_MS,
      ST_PAGE_TIMEOUT_MS,
      ST_TIMEOUT_MS,
      ST_PAGE_TIMEOUT_MS,
    ]);
    spy.mockRestore();
  });
});

describe("ATTENTION_LIMIT", () => {
  it("is one bounded value both the cron and the page read", () => {
    // CLAUDE.md: bounded query limits on every list endpoint. It lives here
    // rather than in a route so the two consumers cannot bound the same feed
    // differently and then disagree about what is waiting.
    expect(ATTENTION_LIMIT).toBe(50);
  });
});
