# P6 — Inbound Messenger Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When someone messages the RIKU Facebook page, a drafted reply reaches Riku's phone within a minute, and one tap sends it — without him opening Messenger, and without anything leaving the page he has not read.

**Architecture:** ShikksTracker's existing webhook forwards each inbound message to a new secret-gated RikuOS endpoint. RikuOS builds one `ApprovalItem` carrying two candidate texts — a holding reply (template, no model call) and a substantive answer (drafted by the Anthropic API from a knowledge block) — sets `staleAt` to the close of Meta's 24-hour window, writes an `AgentRun`, and pushes. On approval, an executor calls back to ShikksTracker, which owns the Meta page token and performs the send.

**Tech Stack:** Next.js App Router · TypeScript strict · Mongoose · Vitest · `@anthropic-ai/sdk` · web-push

**Design doc:** `docs/superpowers/specs/2026-09-04-p6-messenger-triage-design.md`. Read it before Task 1. Decisions D1–D11 there are settled; do not relitigate them.

---

## Before you start

**Five conventions in this codebase that are easy to violate and expensive to fix.**

1. **Discriminator files** (`src/models/approvals/`) import the base model with a **relative path and an explicit `.ts` extension**, and use `import type` for interfaces. The index-sync script runs them under `node --experimental-strip-types`, which does not resolve the `@/` alias and erases type annotations without analysis. Copy the import block from `FollowupDraftApproval.ts` verbatim.
2. **Never declare an index on a discriminator schema.** Mongoose creates it; the next migration drops it. Indexes live on the base schema in `ApprovalItem.ts`.
3. **Every `String` field needs a `maxlength`. Every closed set needs an `enum`. No `Schema.Types.Mixed`, ever.**
4. **Executors classify, they never guess.** `done` = side effect confirmed. `failed` = the target refused and provably nothing happened, so a retry is safe. `needs_verification` = unknown, a human checks. Getting this wrong sends a client two copies of the same message.
5. **Alerts are queued and sent last.** The push goes out after the item and the run record are written, so a push failure can never leave a drafted reply unrecorded.

**Verification trio — all three must pass before any task is called done:**

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/triage.ts` | **Create.** Pure: parse a forwarded event, compute the window, decide what may be drafted given unfilled settings. No I/O. |
| `src/lib/draftTriage.ts` | **Create.** The Anthropic call and its prompt. Mirrors `draftFollowup.ts`. |
| `src/models/approvals/TriageResponseApproval.ts` | **Create.** The `triage-response` discriminator. |
| `src/app/api/messenger/inbound/route.ts` | **Create.** Secret-gated ingest endpoint. Thin — logic lives in `triage.ts`. |
| `src/models/OsSettings.ts` | **Modify.** Five new fields. |
| `src/lib/osSettings.ts` | **Modify.** Extend `OsSettingsPatch`. |
| `src/lib/settings.ts` | **Modify.** Validate the new keys. |
| `src/lib/stApi.ts` | **Modify.** Add `sendMessengerReply`. |
| `src/lib/queue.ts` | **Modify.** Register the `triage-response` executor. |
| `src/lib/auth.ts` | **Modify.** Add `requireForwardSecret`. |
| `src/proxy.ts` | **Modify.** Allowlist the new endpoint. |
| `.env.example` | **Modify.** Document `MESSENGER_FORWARD_SECRET`. |

---

### Task 1: Settings — the five new fields

**Files:**
- Modify: `src/models/OsSettings.ts`
- Modify: `src/lib/osSettings.ts`
- Modify: `src/lib/settings.ts`
- Test: `src/lib/__tests__/settings.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/settings.test.ts`:

```ts
describe("parseSettingsPatch — triage settings", () => {
  it("accepts a knowledge block at the cap", () => {
    const result = parseSettingsPatch({ knowledgeBlock: "x".repeat(4000) });
    expect(result.ok).toBe(true);
  });

  it("rejects a knowledge block over the cap", () => {
    // The block enters EVERY draft's prompt, so length is a per-message cost,
    // not a storage concern. The cap is a budget, not a formality.
    const result = parseSettingsPatch({ knowledgeBlock: "x".repeat(4001) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/4000/);
  });

  it("accepts a nameable project list and rejects a non-array", () => {
    expect(parseSettingsPatch({ nameableProjects: ["Azerotech"] }).ok).toBe(true);
    expect(parseSettingsPatch({ nameableProjects: "Azerotech" }).ok).toBe(false);
  });

  it("rejects more nameable projects than the cap allows", () => {
    const many = Array.from({ length: 21 }, (_, i) => `P${i}`);
    expect(parseSettingsPatch({ nameableProjects: many }).ok).toBe(false);
  });

  it("accepts demo site urls as a flat string map and rejects nesting", () => {
    expect(parseSettingsPatch({ demoSiteUrls: { A1: "https://a1.example" } }).ok).toBe(true);
    expect(parseSettingsPatch({ demoSiteUrls: { A1: { url: "x" } } }).ok).toBe(false);
  });

  it("rejects a demo url that is not http(s)", () => {
    // A javascript: or data: URL pasted into a client-facing message is the
    // kind of thing that only gets noticed after it is sent.
    expect(parseSettingsPatch({ demoSiteUrls: { A1: "javascript:alert(1)" } }).ok).toBe(false);
  });

  it("still rejects unknown keys", () => {
    expect(parseSettingsPatch({ triageEnable: true }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/lib/__tests__/settings.test.ts`
Expected: FAIL — `Unknown setting "knowledgeBlock".`

- [ ] **Step 3: Add the fields to the model**

In `src/models/OsSettings.ts`, add to the schema definition alongside the existing fields:

```ts
    triageEnabled: { type: Boolean, required: true, default: false },
    knowledgeBlock: { type: String, maxlength: 4000, default: "" },
    // null means "Riku has not approved this yet" and is load-bearing:
    // draftPolicy withholds the substantive answer entirely until it is set
    // (design D11). Do NOT give this a default.
    knowledgeReviewedAt: { type: Date, default: null },
    nameableProjects: {
      type: [{ type: String, maxlength: 200 }],
      default: [],
    },
    holdingText: {
      type: String,
      maxlength: 500,
      default: "Hi! Thanks for messaging — I've seen this and I'll get back to you shortly.",
    },
```

Add `demoSiteUrls` as a typed sub-schema rather than a free map, so it stays bounded:

```ts
// Above the OsSettings schema. A Map of String would be unbounded per entry;
// this keeps both halves capped and keeps CLAUDE.md's "no Mixed" rule.
const DemoSiteSchema = new Schema(
  {
    packageKey: { type: String, required: true, maxlength: 20 },
    url: { type: String, required: true, maxlength: 500 },
  },
  { _id: false, strict: true }
);
```

and in the main schema:

```ts
    demoSiteUrls: { type: [DemoSiteSchema], default: [] },
```

Add the matching fields to the `IOsSettings` interface in the same file:

```ts
  triageEnabled: boolean;
  knowledgeBlock: string;
  knowledgeReviewedAt: Date | null;
  nameableProjects: string[];
  holdingText: string;
  demoSiteUrls: { packageKey: string; url: string }[];
```

- [ ] **Step 4: Extend the patch type**

In `src/lib/osSettings.ts`, extend `OsSettingsPatch`:

```ts
export interface OsSettingsPatch {
  chaserEnabled?: boolean;
  chaserNDays?: number;
  monitoringEnabled?: boolean;
  triageEnabled?: boolean;
  knowledgeBlock?: string;
  knowledgeReviewedAt?: Date | null;
  nameableProjects?: string[];
  holdingText?: string;
  demoSiteUrls?: { packageKey: string; url: string }[];
}
```

- [ ] **Step 5: Validate them**

In `src/lib/settings.ts`, extend `ALLOWED_KEYS` and add the bounds. Add these constants near the existing ones:

```ts
export const KNOWLEDGE_BLOCK_MAX = 4000;
export const NAMEABLE_PROJECTS_MAX = 20;
export const HOLDING_TEXT_MAX = 500;
export const DEMO_URLS_MAX = 20;
```

Update the key set:

```ts
const ALLOWED_KEYS = new Set([
  "chaserEnabled",
  "chaserNDays",
  "monitoringEnabled",
  "triageEnabled",
  "knowledgeBlock",
  "knowledgeReviewedAt",
  "nameableProjects",
  "holdingText",
  "demoSiteUrls",
]);
```

Add the validation blocks before the final `return { ok: true, value }`:

```ts
  if ("triageEnabled" in b) {
    if (typeof b.triageEnabled !== "boolean") {
      return { ok: false, error: "triageEnabled must be a boolean." };
    }
    value.triageEnabled = b.triageEnabled;
  }

  if ("knowledgeBlock" in b) {
    if (typeof b.knowledgeBlock !== "string") {
      return { ok: false, error: "knowledgeBlock must be a string." };
    }
    if (b.knowledgeBlock.length > KNOWLEDGE_BLOCK_MAX) {
      return {
        ok: false,
        error: `knowledgeBlock must be at most ${KNOWLEDGE_BLOCK_MAX} characters.`,
      };
    }
    value.knowledgeBlock = b.knowledgeBlock;
  }

  if ("knowledgeReviewedAt" in b) {
    // Riku's approval stamp. Accepts an ISO string or explicit null (un-approve).
    if (b.knowledgeReviewedAt === null) {
      value.knowledgeReviewedAt = null;
    } else if (typeof b.knowledgeReviewedAt === "string") {
      const d = new Date(b.knowledgeReviewedAt);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, error: "knowledgeReviewedAt must be an ISO date or null." };
      }
      value.knowledgeReviewedAt = d;
    } else {
      return { ok: false, error: "knowledgeReviewedAt must be an ISO date or null." };
    }
  }

  if ("nameableProjects" in b) {
    const list = b.nameableProjects;
    if (!Array.isArray(list) || list.some((p) => typeof p !== "string")) {
      return { ok: false, error: "nameableProjects must be an array of strings." };
    }
    if (list.length > NAMEABLE_PROJECTS_MAX) {
      return {
        ok: false,
        error: `nameableProjects must have at most ${NAMEABLE_PROJECTS_MAX} entries.`,
      };
    }
    if (list.some((p) => (p as string).length > 200)) {
      return { ok: false, error: "Each nameable project must be at most 200 characters." };
    }
    value.nameableProjects = list as string[];
  }

  if ("holdingText" in b) {
    if (typeof b.holdingText !== "string" || b.holdingText.trim().length === 0) {
      return { ok: false, error: "holdingText must be a non-empty string." };
    }
    if (b.holdingText.length > HOLDING_TEXT_MAX) {
      return { ok: false, error: `holdingText must be at most ${HOLDING_TEXT_MAX} characters.` };
    }
    value.holdingText = b.holdingText;
  }

  if ("demoSiteUrls" in b) {
    const raw = b.demoSiteUrls;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, error: "demoSiteUrls must be an object of package to URL." };
    }
    const entries = Object.entries(raw as Record<string, unknown>);
    if (entries.length > DEMO_URLS_MAX) {
      return { ok: false, error: `demoSiteUrls must have at most ${DEMO_URLS_MAX} entries.` };
    }
    const parsed: { packageKey: string; url: string }[] = [];
    for (const [packageKey, url] of entries) {
      if (typeof url !== "string") {
        return { ok: false, error: `demoSiteUrls.${packageKey} must be a string URL.` };
      }
      // http(s) only. A javascript: or data: URL reaching a client-facing
      // draft is the kind of mistake that is only noticed after sending.
      if (!/^https?:\/\/\S+$/.test(url)) {
        return { ok: false, error: `demoSiteUrls.${packageKey} must be an http(s) URL.` };
      }
      if (packageKey.length > 20 || url.length > 500) {
        return { ok: false, error: `demoSiteUrls.${packageKey} is too long.` };
      }
      parsed.push({ packageKey, url });
    }
    value.demoSiteUrls = parsed;
  }
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/lib/__tests__/settings.test.ts`
Expected: PASS, all cases.

- [ ] **Step 7: Sync indexes (dry run) and commit**

```bash
npm run migrate:indexes
git add src/models/OsSettings.ts src/lib/osSettings.ts src/lib/settings.ts src/lib/__tests__/settings.test.ts
git commit -m "feat(triage): settings for the knowledge block and what a draft may name"
```

The dry run should report no index changes — these are all plain fields.

---

### Task 2: The `triage-response` discriminator

**Files:**
- Create: `src/models/approvals/TriageResponseApproval.ts`
- Test: `src/lib/__tests__/models.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/models.test.ts`:

```ts
describe("TriageResponseApproval", () => {
  it("registers under the triage-response discriminator key", async () => {
    const { default: TriageResponseApproval } = await import(
      "@/models/approvals/TriageResponseApproval"
    );
    expect(TriageResponseApproval.baseModelName).toBe("ApprovalItem");
    const doc = new TriageResponseApproval({
      source: "triage",
      title: "New message from Ana",
      summary: "Asked how much a website costs",
      payload: {
        conversationId: "c1",
        messageId: "m1",
        senderName: "Ana",
        inboundText: "magkano po ang website?",
        holdingText: "Thanks for messaging!",
        answerText: "A1 starts at 3,000.",
      },
    });
    expect(doc.type).toBe("triage-response");
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it("rejects an unknown payload field rather than silently storing it", async () => {
    // strict:true is what stops a drifting payload shape, which is the mistake
    // ShikksTracker's Mixed run-summary made and this repo's rules exist to avoid.
    const { default: TriageResponseApproval } = await import(
      "@/models/approvals/TriageResponseApproval"
    );
    const doc = new TriageResponseApproval({
      source: "triage",
      title: "t",
      summary: "s",
      payload: { conversationId: "c", messageId: "m", inboundText: "i", holdingText: "h", nope: 1 },
    });
    const saved = doc.toObject() as { payload: Record<string, unknown> };
    expect(saved.payload.nope).toBeUndefined();
  });

  it("requires the fields a send cannot happen without", async () => {
    const { default: TriageResponseApproval } = await import(
      "@/models/approvals/TriageResponseApproval"
    );
    const doc = new TriageResponseApproval({
      source: "triage",
      title: "t",
      summary: "s",
      payload: { inboundText: "i", holdingText: "h" },
    });
    await expect(doc.validate()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/lib/__tests__/models.test.ts`
Expected: FAIL — cannot resolve `@/models/approvals/TriageResponseApproval`.

- [ ] **Step 3: Create the discriminator**

Create `src/models/approvals/TriageResponseApproval.ts`:

```ts
import { Model, Schema } from "mongoose";
// Relative + explicit .ts extension — see the note in ApprovalItem.ts. The
// scripts import this file under `node --experimental-strip-types`, which does
// not resolve the "@/" tsconfig path alias.
// `type` modifier required: strip-types erases annotations without type
// analysis, so an interface imported as a value becomes a runtime import of an
// export that does not exist.
import ApprovalItem, { type IApprovalItemBase } from "../ApprovalItem.ts";

/**
 * Payload for an inbound Messenger triage draft.
 *
 * TWO TEXTS, ONE ITEM (design D2). `holdingText` is a template — no model call,
 * no claims — so it survives an Anthropic outage and an unapproved knowledge
 * block. `answerText` is the substantive draft and is ABSENT whenever Riku has
 * not approved the knowledge block (D11): a draft quoting prices he has never
 * read is worse than no draft. `chosenText` records which one he actually sent,
 * which is why one item can carry both without a second status enum.
 *
 * conversationId/messageId are opaque ShikksTracker and Meta identifiers.
 * RikuOS never touches that database; they travel back through the send call.
 */
export interface ITriageResponsePayload {
  conversationId: string;
  messageId: string;
  senderName?: string;
  inboundText: string;
  holdingText: string;
  answerText?: string;
  /** Why the substantive answer is missing, shown on the queue card. */
  answerWithheldReason?: string;
  chosenText?: string;
}

export interface ITriageResponseApproval extends IApprovalItemBase {
  type: "triage-response";
  payload: ITriageResponsePayload;
  editedPayload?: ITriageResponsePayload;
}

const TriageResponsePayloadSchema = new Schema<ITriageResponsePayload>(
  {
    conversationId: { type: String, required: true, maxlength: 64 },
    messageId: { type: String, required: true, maxlength: 128 },
    senderName: { type: String, maxlength: 200 },
    inboundText: { type: String, required: true, maxlength: 4000 },
    holdingText: { type: String, required: true, maxlength: 500 },
    answerText: { type: String, maxlength: 4000 },
    answerWithheldReason: { type: String, maxlength: 300 },
    chosenText: { type: String, maxlength: 4000 },
  },
  { _id: false, strict: true }
);

// editedPayload uses the SAME typed sub-schema, exactly as the chaser's does:
// an edit stores a complete copy, keeping the agent's proposal and Riku's
// approved version separately (the retro agent compares them).
const TriageResponseSchema = new Schema<ITriageResponseApproval>(
  {
    payload: { type: TriageResponsePayloadSchema, required: true },
    editedPayload: { type: TriageResponsePayloadSchema },
  },
  { strict: true }
);

// NO INDEXES HERE. Mongoose would create them on a discriminator schema and
// the next migration would drop them; base-schema indexes serve this model.

// Same hot-reload guard as plain models: calling .discriminator() twice for
// the same key throws, so reuse the registered one when it exists.
const TriageResponseApproval =
  (ApprovalItem.discriminators?.["triage-response"] as Model<ITriageResponseApproval>) ||
  ApprovalItem.discriminator<ITriageResponseApproval>("triage-response", TriageResponseSchema);

export default TriageResponseApproval;
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/__tests__/models.test.ts`
Expected: PASS.

- [ ] **Step 5: Confirm `triage` is a valid `source`**

Run: `grep -n "triage" src/models/AgentRun.ts`
Expected: `triage` appears in the `AGENTS` list. `APPROVAL_SOURCES` is derived from `AGENTS`, so no change is needed. If it is absent, stop and report — the design assumed P3 built it.

- [ ] **Step 6: Commit**

```bash
git add src/models/approvals/TriageResponseApproval.ts src/lib/__tests__/models.test.ts
git commit -m "feat(triage): the triage-response approval type"
```

---

### Task 3: `triage.ts` — window arithmetic and the degradation rules

**Files:**
- Create: `src/lib/triage.ts`
- Test: `src/lib/__tests__/triage.test.ts`

This is the heart of the phase and it is entirely pure. Everything decidable without I/O is decided here.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/triage.test.ts`:

```ts
/**
 * The tests that matter most here are the ones pinning what triage must NOT
 * do when it is under-configured. Riku is shipping this before filling in his
 * knowledge block, project list and demo URLs (design D11), so "safe when
 * unconfigured" is the normal operating state for a while, not an edge case.
 */

import { describe, it, expect } from "vitest";
import {
  WINDOW_HOURS,
  parseInboundEvent,
  windowClosesAt,
  isWithinWindow,
  draftPolicy,
  buildTriageTitle,
} from "@/lib/triage";

const NOW = new Date("2026-09-04T12:00:00.000Z");

function settings(over: Record<string, unknown> = {}) {
  return {
    triageEnabled: true,
    knowledgeBlock: "SERVICES REFERENCE — A1 from 3,000.",
    knowledgeReviewedAt: new Date("2026-09-01T00:00:00.000Z"),
    nameableProjects: ["Azerotech — repair shop site and admin panel"],
    holdingText: "Thanks for messaging! I'll get back to you shortly.",
    demoSiteUrls: [{ packageKey: "A1", url: "https://a1.example" }],
    ...over,
  } as Parameters<typeof draftPolicy>[0];
}

describe("parseInboundEvent", () => {
  const valid = {
    mid: "m_123",
    conversationId: "c_1",
    senderName: "Ana",
    text: "magkano po ang website?",
    sentAt: "2026-09-04T11:55:00.000Z",
  };

  it("accepts a well-formed event", () => {
    expect(parseInboundEvent(valid)).toEqual({ ...valid, sentAt: new Date(valid.sentAt) });
  });

  it("rejects a missing message id, because it is the dedup key", () => {
    expect(parseInboundEvent({ ...valid, mid: undefined })).toBeNull();
  });

  it("rejects an unparseable timestamp rather than defaulting to now", () => {
    // Defaulting to now would silently extend a window that has already closed.
    expect(parseInboundEvent({ ...valid, sentAt: "not-a-date" })).toBeNull();
  });

  it("tolerates a missing sender name — unlinked conversations have none", () => {
    const parsed = parseInboundEvent({ ...valid, senderName: undefined });
    expect(parsed).not.toBeNull();
    expect(parsed?.senderName).toBeUndefined();
  });

  it("truncates an overlong message rather than rejecting it", () => {
    const parsed = parseInboundEvent({ ...valid, text: "x".repeat(9000) });
    expect(parsed?.text.length).toBe(4000);
  });
});

describe("the 24-hour window", () => {
  it("closes exactly 24 hours after the message was sent", () => {
    const sent = new Date("2026-09-04T11:00:00.000Z");
    expect(windowClosesAt(sent).toISOString()).toBe("2026-09-05T11:00:00.000Z");
    expect(WINDOW_HOURS).toBe(24);
  });

  it("is open at 23 hours and closed at 25", () => {
    const sent = new Date(NOW.getTime() - 23 * 3600_000);
    expect(isWithinWindow(NOW, sent)).toBe(true);
    const old = new Date(NOW.getTime() - 25 * 3600_000);
    expect(isWithinWindow(NOW, old)).toBe(false);
  });

  it("treats the exact boundary as closed", () => {
    const exact = new Date(NOW.getTime() - WINDOW_HOURS * 3600_000);
    expect(isWithinWindow(NOW, exact)).toBe(false);
  });
});

describe("draftPolicy — what may be said", () => {
  it("allows a substantive answer when the block is approved", () => {
    const policy = draftPolicy(settings());
    expect(policy.mayAnswer).toBe(true);
    expect(policy.withheldReason).toBeUndefined();
  });

  it("WITHHOLDS the answer entirely when the block is unapproved", () => {
    // The block states his real prices. A draft quoting a number he has never
    // read is worse than no draft (design D11).
    const policy = draftPolicy(settings({ knowledgeReviewedAt: null }));
    expect(policy.mayAnswer).toBe(false);
    expect(policy.withheldReason).toMatch(/not approved/i);
  });

  it("withholds the answer when the block is approved but empty", () => {
    const policy = draftPolicy(settings({ knowledgeBlock: "   " }));
    expect(policy.mayAnswer).toBe(false);
  });

  it("passes through no projects and no urls when unset", () => {
    const policy = draftPolicy(settings({ nameableProjects: [], demoSiteUrls: [] }));
    expect(policy.mayAnswer).toBe(true);
    expect(policy.nameableProjects).toEqual([]);
    expect(policy.demoSiteUrls).toEqual([]);
  });

  it("reports triage switched off", () => {
    const policy = draftPolicy(settings({ triageEnabled: false }));
    expect(policy.enabled).toBe(false);
  });
});

describe("buildTriageTitle", () => {
  it("names the sender when known", () => {
    expect(buildTriageTitle("Ana")).toBe("New message from Ana");
  });

  it("says so plainly when the conversation is not linked to a contact", () => {
    expect(buildTriageTitle(undefined)).toBe("New message from an unlinked conversation");
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/lib/__tests__/triage.test.ts`
Expected: FAIL — cannot resolve `@/lib/triage`.

- [ ] **Step 3: Write `src/lib/triage.ts`**

```ts
/**
 * triage.ts — "someone messaged the page; what may we say back?"
 *
 * Pure. No database, no network, no clock of its own — `now` is always passed
 * in, exactly as watchdog.ts and outreachHealth.ts do, so every rule here is
 * testable without mocking anything.
 *
 * THE WINDOW IS META'S, NOT OURS. The Messenger Platform refuses to send
 * outside 24 hours of the user's last message. That makes `staleAt` a real
 * deadline rather than a housekeeping age: an expired item is not untidy, it
 * is a conversation that can no longer be answered at all.
 *
 * NOTHING AUTO-SENDS (S14). Everything here produces text for a queue card;
 * the send happens only after Riku taps, and it happens in ShikksTracker,
 * which holds the Meta page token (S9).
 *
 * SAFE WHEN UNDER-CONFIGURED. Riku is shipping this before writing his
 * knowledge block, project list and demo URLs, so an unfilled setting is the
 * normal state for a while (design D11). Each has a defined degradation rather
 * than an empty variable, because a model given a hole improvises into it —
 * and the worst realistic failure of this feature is a draft inventing client
 * work or a portfolio link that does not exist.
 */

const HOUR_MS = 60 * 60 * 1000;

/** Meta's rule, not a preference. Do not make this configurable. */
export const WINDOW_HOURS = 24;

/** Inbound text longer than this is truncated for the card and the prompt. */
export const INBOUND_TEXT_MAX = 4000;

export interface InboundEvent {
  /** Meta's message id. The dedup key — Meta redelivers. */
  mid: string;
  conversationId: string;
  senderName?: string;
  text: string;
  sentAt: Date;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Total: returns null rather than throwing, because the caller answers a
 * webhook forward and must return a fast 2xx either way — a rejected event is
 * logged and dropped, never retried into a loop.
 */
export function parseInboundEvent(body: unknown): InboundEvent | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;

  const mid = str(b.mid);
  const conversationId = str(b.conversationId);
  const text = str(b.text);
  const sentAtRaw = str(b.sentAt);
  if (!mid || !conversationId || !text || !sentAtRaw) return null;

  const sentAt = new Date(sentAtRaw);
  // Never default a bad timestamp to now: that would silently extend a window
  // which may already have closed, and the card would promise time we do not
  // have.
  if (Number.isNaN(sentAt.getTime())) return null;

  return {
    mid,
    conversationId,
    senderName: str(b.senderName),
    text: text.slice(0, INBOUND_TEXT_MAX),
    sentAt,
  };
}

export function windowClosesAt(sentAt: Date): Date {
  return new Date(sentAt.getTime() + WINDOW_HOURS * HOUR_MS);
}

/** Strictly inside. At the exact boundary the window is closed. */
export function isWithinWindow(now: Date, sentAt: Date): boolean {
  return now.getTime() < windowClosesAt(sentAt).getTime();
}

export interface TriageSettingsView {
  triageEnabled: boolean;
  knowledgeBlock: string;
  knowledgeReviewedAt: Date | null;
  nameableProjects: string[];
  holdingText: string;
  demoSiteUrls: { packageKey: string; url: string }[];
}

export interface DraftPolicy {
  enabled: boolean;
  /** False means: produce the holding reply only, and say why on the card. */
  mayAnswer: boolean;
  withheldReason?: string;
  knowledgeBlock: string;
  nameableProjects: string[];
  demoSiteUrls: { packageKey: string; url: string }[];
  holdingText: string;
}

/**
 * The single place that decides how much a draft is allowed to say.
 *
 * Keeping this pure and separate from the prompt builder is deliberate: the
 * rule "no approved block means no substantive answer" is a safety property,
 * and safety properties belong somewhere a test can state them in one line.
 */
export function draftPolicy(s: TriageSettingsView): DraftPolicy {
  const blockReady = s.knowledgeReviewedAt !== null && s.knowledgeBlock.trim().length > 0;

  return {
    enabled: s.triageEnabled,
    mayAnswer: blockReady,
    withheldReason: blockReady
      ? undefined
      : "Services info not approved yet — holding reply only.",
    knowledgeBlock: s.knowledgeBlock,
    nameableProjects: s.nameableProjects,
    demoSiteUrls: s.demoSiteUrls,
    holdingText: s.holdingText,
  };
}

export function buildTriageTitle(senderName: string | undefined): string {
  return senderName
    ? `New message from ${senderName}`
    : "New message from an unlinked conversation";
}

/** First line of the inbound message, for the queue card's summary. */
export function buildTriageSummary(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 200 ? `${oneLine.slice(0, 199)}…` : oneLine;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/__tests__/triage.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/triage.ts src/lib/__tests__/triage.test.ts
git commit -m "feat(triage): the window, and the rules for what a draft may say"
```

---

### Task 4: `draftTriage.ts` — the Anthropic call

**Files:**
- Create: `src/lib/draftTriage.ts`
- Test: `src/lib/__tests__/draftTriage.test.ts`

**Read `src/lib/draftFollowup.ts` first.** Its Taglish handling, timeout, tool-use parsing and model constant are proven. Mirror them; do not reinvent.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/draftTriage.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildTriageUserMessage, TRIAGE_SYSTEM_PROMPT } from "@/lib/draftTriage";
import type { DraftPolicy } from "@/lib/triage";

function policy(over: Partial<DraftPolicy> = {}): DraftPolicy {
  return {
    enabled: true,
    mayAnswer: true,
    knowledgeBlock: "A1 Presence Starter 3,000-4,500.",
    nameableProjects: ["Azerotech — repair shop site"],
    demoSiteUrls: [{ packageKey: "A1", url: "https://a1.example" }],
    holdingText: "Thanks!",
    ...over,
  };
}

describe("buildTriageUserMessage", () => {
  it("carries the knowledge block and the inbound message", () => {
    const msg = buildTriageUserMessage("magkano po?", policy());
    expect(msg).toContain("A1 Presence Starter 3,000-4,500.");
    expect(msg).toContain("magkano po?");
  });

  it("lists the projects that may be named", () => {
    expect(buildTriageUserMessage("portfolio?", policy())).toContain("Azerotech");
  });

  it("states plainly that NO project may be named when the list is empty", () => {
    // Silence would let the model fall back on whatever it thinks it knows.
    const msg = buildTriageUserMessage("portfolio?", policy({ nameableProjects: [] }));
    expect(msg).toMatch(/do not name any/i);
  });

  it("states plainly that NO link may be given when there are no demo urls", () => {
    const msg = buildTriageUserMessage("can I see one?", policy({ demoSiteUrls: [] }));
    expect(msg).toMatch(/do not include any link/i);
  });

  it("includes a demo url only when one was supplied", () => {
    expect(buildTriageUserMessage("sample?", policy())).toContain("https://a1.example");
  });
});

describe("TRIAGE_SYSTEM_PROMPT", () => {
  it("forbids inventing links and clients", () => {
    expect(TRIAGE_SYSTEM_PROMPT).toMatch(/never/i);
    expect(TRIAGE_SYSTEM_PROMPT.toLowerCase()).toContain("url");
  });

  it("forbids committing to a final price or a date", () => {
    expect(TRIAGE_SYSTEM_PROMPT.toLowerCase()).toContain("range");
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/lib/__tests__/draftTriage.test.ts`
Expected: FAIL — cannot resolve `@/lib/draftTriage`.

- [ ] **Step 3: Write `src/lib/draftTriage.ts`**

```ts
/**
 * draftTriage.ts — drafts a reply to someone who messaged the RIKU page.
 *
 * Mirrors draftFollowup.ts deliberately: same SDK, same timeout, same
 * tool-use extraction. The differences are the audience (a stranger who
 * messaged first, not a lead being chased) and the fact that everything the
 * model may claim is supplied to it explicitly.
 *
 * WHY THE PROMPT IS SO PROHIBITIVE. Riku had zero paid clients as of August
 * 2026, and his vault records no portfolio URLs and no contact details. A
 * model asked "do you have a portfolio?" with nothing to point at will
 * improvise, and an invented client or link is the worst realistic failure
 * this feature has — it reaches a prospect under his business's name. So the
 * allowed projects and URLs are passed in, and their ABSENCE is stated
 * explicitly rather than left as silence for the model to fill.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { DraftPolicy } from "@/lib/triage";

export const TRIAGE_MAX_BODY = 4000;
export const TRIAGE_TIMEOUT_MS = 45_000;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

export const TRIAGE_SYSTEM_PROMPT = `You draft the FIRST reply to someone who has just messaged Riku's web-development business page on Facebook. Riku reads and sends every message himself; you are writing a draft for him to approve, not talking to the customer.

Write the way he does: warm, plain, and brief. English or Taglish, mirroring whatever the person used. Two to five sentences. No bullet lists, no headings, no emoji-heavy filler — this is a Messenger chat, not an email.

HARD RULES. Breaking any of these is worse than writing nothing:
- NEVER include a URL that was not given to you in the reference below. Do not guess a domain, do not reconstruct a link, do not say "check our website".
- NEVER name a client, project or company that is not in the list you were given.
- NEVER state a final price. Prices in the reference are STARTING RANGES. Give a range, then ask what they need.
- NEVER promise a start date, a delivery date, or availability. You do not know his schedule.
- NEVER invent a phone number, an email address or a booking link.
- If the reference does not answer their question, say honestly that Riku will confirm, and ask the one question that would move it forward.

Always end by moving it forward: ask one or two short qualifying questions, and suggest continuing here on Messenger to find a time to talk.`;

/**
 * Builds the user turn. The policy's empty states are rendered as explicit
 * prohibitions, never omitted — see the module comment.
 */
export function buildTriageUserMessage(inboundText: string, policy: DraftPolicy): string {
  const parts: string[] = [];

  parts.push("SERVICES REFERENCE (the only facts you may state):");
  parts.push(policy.knowledgeBlock.trim());

  parts.push("");
  if (policy.nameableProjects.length > 0) {
    parts.push("PAST WORK you may mention by name:");
    for (const p of policy.nameableProjects) parts.push(`- ${p}`);
  } else {
    parts.push(
      "PAST WORK: none has been cleared for mention. Do not name any client, project or company. If asked for examples, offer to walk them through relevant work when you talk."
    );
  }

  parts.push("");
  if (policy.demoSiteUrls.length > 0) {
    parts.push("EXAMPLE LINKS you may send, and only these:");
    for (const d of policy.demoSiteUrls) parts.push(`- ${d.packageKey}: ${d.url}`);
  } else {
    parts.push(
      "EXAMPLE LINKS: none available. Do not include any link at all. If asked to see something, offer to show examples when you talk."
    );
  }

  parts.push("");
  parts.push("THE MESSAGE THEY SENT:");
  parts.push(inboundText.trim());

  return parts.join("\n");
}

/**
 * Returns the drafted text, or null when the model could not be reached or
 * produced nothing usable. Null is not an error path the caller should retry —
 * the item is still created with the holding reply, so a drafting outage costs
 * Riku a better draft, never the window itself.
 */
export async function generateTriageDraft(
  inboundText: string,
  policy: DraftPolicy
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey, timeout: TRIAGE_TIMEOUT_MS });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: TRIAGE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildTriageUserMessage(inboundText, policy) }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (text.length === 0) return null;
  return text.slice(0, TRIAGE_MAX_BODY);
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/__tests__/draftTriage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/draftTriage.ts src/lib/__tests__/draftTriage.test.ts
git commit -m "feat(triage): draft a reply, with what it may claim passed in explicitly"
```

---

### Task 5: `sendMessengerReply` in the ShikksTracker client

**Files:**
- Modify: `src/lib/stApi.ts`
- Test: `src/lib/__tests__/stApi.test.ts`

**Read `postDraft` in `stApi.ts` first** — it is the existing outward call and it is *total by contract*: it never throws, it returns a classified outcome. Mirror that exactly. This function's classification decides whether a failed send is retried, and a wrong `done` sends a prospect two copies of the same message.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/stApi.test.ts`:

```ts
describe("sendMessengerReply", () => {
  it("reports done on a 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await sendMessengerReply("c1", "hello");
    expect(out.status).toBe("done");
  });

  it("reports FAILED (retry safe) on a 4xx refusal", async () => {
    // The far side answered and declined. Provably nothing was sent.
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
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("aborted")));
    const out = await sendMessengerReply("c1", "hello");
    expect(out.status).toBe("needs_verification");
  });

  it("reports needs_verification on a 5xx, because the send may have happened", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 502 })));
    const out = await sendMessengerReply("c1", "hello");
    expect(out.status).toBe("needs_verification");
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/lib/__tests__/stApi.test.ts`
Expected: FAIL — `sendMessengerReply` is not exported.

- [ ] **Step 3: Implement it**

Add to `src/lib/stApi.ts`, next to `postDraft`:

```ts
/**
 * POST /api/os/messenger-reply — the one outward action in P6.
 *
 * TOTAL BY CONTRACT, exactly as postDraft is: never throws, always returns a
 * classified outcome, because the caller must record a result it can act on
 * rather than catch an exception it cannot classify.
 *
 * The classification is the whole point and it is asymmetric on purpose:
 *   2xx        -> done. Confirmed.
 *   4xx        -> failed. The far side ANSWERED and refused, so nothing was
 *                 sent and a retry is safe. "Window closed" lands here.
 *   5xx / net  -> needs_verification. We do not know. A retry could send a
 *                 prospect the same message twice, which is worse than a late
 *                 reply. A human checks the thread.
 */
export async function sendMessengerReply(
  conversationId: string,
  text: string
): Promise<{ status: "done" | "failed" | "needs_verification"; note: string }> {
  let baseUrl: string;
  let secret: string;
  try {
    ({ baseUrl, secret } = readStConfig());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "failed", note: `ShikksTracker is not configured: ${message}` };
  }

  try {
    const res = await fetch(`${baseUrl}/api/os/messenger-reply`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-os-secret": secret },
      body: JSON.stringify({ conversationId, text }),
      signal: AbortSignal.timeout(ST_TIMEOUT_MS),
    });

    if (res.ok) {
      return { status: "done", note: "Sent by ShikksTracker." };
    }

    if (res.status >= 400 && res.status < 500) {
      const body = await res.text().catch(() => "");
      return {
        status: "failed",
        note: `ShikksTracker refused the send (${res.status}): ${body.slice(0, 300)}`,
      };
    }

    return {
      status: "needs_verification",
      note: `ShikksTracker returned ${res.status}. Check the Messenger thread before retrying.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "needs_verification",
      note: `The send call did not complete (${message}). Check the Messenger thread before retrying.`,
    };
  }
}
```

`ST_TIMEOUT_MS` is already exported from that file (15s) and is what `postDraft` uses. Reuse it — do not introduce a second timeout value.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/__tests__/stApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stApi.ts src/lib/__tests__/stApi.test.ts
git commit -m "feat(triage): ask ShikksTracker to send, and classify the answer honestly"
```

---

### Task 6: Register the executor

**Files:**
- Modify: `src/lib/queue.ts`
- Test: `src/lib/__tests__/queue.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/queue.test.ts`:

```ts
describe("executeTriageResponse", () => {
  it("sends the edited text when Riku edited the draft", async () => {
    const calls: string[] = [];
    const item = {
      type: "triage-response",
      payload: { conversationId: "c1", holdingText: "h", answerText: "original" },
      editedPayload: { conversationId: "c1", holdingText: "h", answerText: "edited" },
    };
    const out = await executeTriageResponse(item as never, async (_c, text) => {
      calls.push(text);
      return { status: "done", note: "ok" };
    });
    expect(calls).toEqual(["edited"]);
    expect(out.status).toBe("done");
  });

  it("sends the holding reply when that is the chosen text", () => {
    // chosenText is how one item carries two options without a second enum.
    const item = {
      type: "triage-response",
      payload: { conversationId: "c1", holdingText: "hold", answerText: "answer", chosenText: "hold" },
    };
    return executeTriageResponse(item as never, async (_c, text) => {
      expect(text).toBe("hold");
      return { status: "done", note: "ok" };
    });
  });

  it("fails without sending when there is no text to send", async () => {
    const out = await executeTriageResponse(
      { type: "triage-response", payload: { conversationId: "c1", holdingText: "" } } as never,
      async () => {
        throw new Error("must not be called");
      }
    );
    expect(out.status).toBe("failed");
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/lib/__tests__/queue.test.ts`
Expected: FAIL — `executeTriageResponse` is not exported.

- [ ] **Step 3: Implement and register**

Add to `src/lib/queue.ts`, next to `executeFollowupDraft`:

```ts
/**
 * Sends an approved triage reply.
 *
 * The sender is injected so the classification can be tested without a
 * network — the same shape executeFollowupDraft uses.
 *
 * Text precedence: an edited payload wins over the original (Riku changed it
 * for a reason), then the explicitly chosen text, then the answer, then the
 * holding reply. The last fallback matters: with the knowledge block
 * unapproved there IS no answer, and the holding reply is the whole item.
 */
export async function executeTriageResponse(
  item: IApprovalItemBase,
  send: (
    conversationId: string,
    text: string
  ) => Promise<{ status: ActionResultStatus; note: string }> = sendMessengerReply
): Promise<ActionOutcome> {
  const source = (item as { editedPayload?: ITriageResponsePayload }).editedPayload
    ?? (item as { payload: ITriageResponsePayload }).payload;

  const text = source.chosenText ?? source.answerText ?? source.holdingText ?? "";
  if (text.trim().length === 0) {
    return { status: "failed", note: "No text to send — nothing was attempted." };
  }
  if (!source.conversationId) {
    return { status: "failed", note: "No conversation id — nothing was attempted." };
  }

  return send(source.conversationId, text);
}
```

Add the imports at the top of `queue.ts`:

```ts
import { sendMessengerReply } from "@/lib/stApi";
import type { ITriageResponsePayload } from "@/models/approvals/TriageResponseApproval";
```

Register it:

```ts
const executors: Record<string, ActionExecutor> = {
  "followup-draft": (item) => executeFollowupDraft(item),
  "triage-response": (item) => executeTriageResponse(item),
};
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/__tests__/queue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queue.ts src/lib/__tests__/queue.test.ts
git commit -m "feat(triage): execute an approved reply through the queue's existing action path"
```

---

### Task 7: The forward secret

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `.env.example`
- Test: `src/lib/__tests__/session.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/session.test.ts`:

```ts
describe("requireForwardSecret", () => {
  const req = (headers: Record<string, string>) =>
    new NextRequest("https://x.test/api/messenger/inbound", { method: "POST", headers });

  it("fails closed with 500 when the secret is not configured", () => {
    delete process.env.MESSENGER_FORWARD_SECRET;
    const res = requireForwardSecret(req({ "x-forward-secret": "anything" }));
    expect(res?.status).toBe(500);
  });

  it("rejects a wrong secret with 401", () => {
    process.env.MESSENGER_FORWARD_SECRET = "a".repeat(32);
    expect(requireForwardSecret(req({ "x-forward-secret": "b".repeat(32) }))?.status).toBe(401);
  });

  it("accepts the right secret", () => {
    process.env.MESSENGER_FORWARD_SECRET = "a".repeat(32);
    expect(requireForwardSecret(req({ "x-forward-secret": "a".repeat(32) }))).toBeNull();
  });

  it("rejects a missing header without throwing", () => {
    process.env.MESSENGER_FORWARD_SECRET = "a".repeat(32);
    expect(requireForwardSecret(req({}))?.status).toBe(401);
  });
});
```

Import `requireForwardSecret` and `NextRequest` at the top of that file if not already present.

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/lib/__tests__/session.test.ts`
Expected: FAIL — `requireForwardSecret` is not exported.

- [ ] **Step 3: Implement it**

Add to `src/lib/auth.ts`, directly below `requireCronSecret`:

```ts
/**
 * Validates the secret ShikksTracker sends when forwarding an inbound
 * Messenger event. Separate from CRON_SECRET on purpose: this one is shared
 * with another system, so rotating it must not also invalidate Vercel's cron
 * authentication.
 *
 * Same shape as requireCronSecret — SHA-256 both sides so timingSafeEqual gets
 * equal-length buffers, and fail closed when the variable is unset.
 */
export function requireForwardSecret(request: NextRequest): NextResponse | null {
  const forwardSecret = process.env.MESSENGER_FORWARD_SECRET;
  if (!forwardSecret) {
    return NextResponse.json(
      { error: "MESSENGER_FORWARD_SECRET environment variable is not set." },
      { status: 500 }
    );
  }

  const provided = request.headers.get("x-forward-secret") ?? "";
  if (!timingSafeEqual(sha256(provided), sha256(forwardSecret))) {
    return NextResponse.json(
      { error: "Unauthorized: missing or invalid forward secret." },
      { status: 401 }
    );
  }

  return null;
}
```

- [ ] **Step 4: Document the variable**

Add to `.env.example`, after the cron section:

```
# --- Messenger triage (P6) ---
MESSENGER_FORWARD_SECRET=  # shared with ShikksTracker, which sends it as x-forward-secret when
                           # forwarding an inbound Messenger event. MINIMUM 32 CHARS, random.
                           # Deliberately NOT the same value as CRON_SECRET: this one is shared
                           # with another system, and rotating it must not break Vercel's crons.
                           # PowerShell: -join ((1..32) | % { '{0:x2}' -f (Get-Random -Max 256) })
```

- [ ] **Step 5: Run the tests and commit**

Run: `npx vitest run src/lib/__tests__/session.test.ts`
Expected: PASS.

```bash
git add src/lib/auth.ts .env.example src/lib/__tests__/session.test.ts
git commit -m "feat(triage): a forward secret separate from the cron secret"
```

---

### Task 8: The ingest endpoint

**Files:**
- Create: `src/app/api/messenger/inbound/route.ts`
- Modify: `src/proxy.ts`
- Create: `src/lib/ingestTriage.ts`
- Test: `src/lib/__tests__/ingestTriage.test.ts`

The route stays thin; the orchestration lives in `ingestTriage.ts` so it is testable (CLAUDE.md: route handlers stay thin, the logic layer holds behaviour).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/ingestTriage.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { decideIngest } from "@/lib/ingestTriage";
import type { DraftPolicy } from "@/lib/triage";

const NOW = new Date("2026-09-04T12:00:00.000Z");

function policy(over: Partial<DraftPolicy> = {}): DraftPolicy {
  return {
    enabled: true,
    mayAnswer: true,
    knowledgeBlock: "A1 from 3,000.",
    nameableProjects: [],
    demoSiteUrls: [],
    holdingText: "Thanks for messaging!",
    ...over,
  };
}

const event = {
  mid: "m1",
  conversationId: "c1",
  senderName: "Ana",
  text: "magkano po?",
  sentAt: new Date("2026-09-04T11:00:00.000Z"),
};

describe("decideIngest", () => {
  it("skips when triage is switched off", async () => {
    const out = await decideIngest(NOW, event, policy({ enabled: false }), async () => "draft");
    expect(out.action).toBe("skip");
    expect(out.reason).toMatch(/off/i);
  });

  it("skips a message whose window has already closed", async () => {
    const old = { ...event, sentAt: new Date("2026-09-03T10:00:00.000Z") };
    const out = await decideIngest(NOW, old, policy(), async () => "draft");
    expect(out.action).toBe("skip");
    expect(out.reason).toMatch(/window/i);
  });

  it("creates an item with both texts when the block is approved", async () => {
    const out = await decideIngest(NOW, event, policy(), async () => "A1 starts at 3,000.");
    expect(out.action).toBe("create");
    if (out.action !== "create") throw new Error("expected create");
    expect(out.payload.holdingText).toBe("Thanks for messaging!");
    expect(out.payload.answerText).toBe("A1 starts at 3,000.");
    expect(out.staleAt.toISOString()).toBe("2026-09-05T11:00:00.000Z");
  });

  it("creates a holding-only item when the block is unapproved, and never calls the model", async () => {
    const draft = vi.fn();
    const out = await decideIngest(
      NOW,
      event,
      policy({ mayAnswer: false, withheldReason: "Services info not approved yet." }),
      draft as never
    );
    expect(draft).not.toHaveBeenCalled();
    if (out.action !== "create") throw new Error("expected create");
    expect(out.payload.answerText).toBeUndefined();
    expect(out.payload.answerWithheldReason).toMatch(/not approved/i);
  });

  it("still creates the item when drafting fails", async () => {
    // A drafting outage must cost a better draft, never the window itself.
    const out = await decideIngest(NOW, event, policy(), async () => null);
    if (out.action !== "create") throw new Error("expected create");
    expect(out.payload.holdingText).toBe("Thanks for messaging!");
    expect(out.payload.answerText).toBeUndefined();
    expect(out.payload.answerWithheldReason).toMatch(/could not be drafted/i);
  });

  it("never lets a drafting error escape", async () => {
    const out = await decideIngest(NOW, event, policy(), async () => {
      throw new Error("anthropic down");
    });
    expect(out.action).toBe("create");
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/lib/__tests__/ingestTriage.test.ts`
Expected: FAIL — cannot resolve `@/lib/ingestTriage`.

- [ ] **Step 3: Write `src/lib/ingestTriage.ts`**

```ts
/**
 * ingestTriage.ts — turns one forwarded inbound message into a decision.
 *
 * Pure apart from the injected drafter, so every branch below is testable
 * without a database, a network or a clock.
 *
 * The ordering is deliberate: the cheap, certain checks run before the
 * expensive uncertain one. Triage being off, or the window already being
 * closed, are both knowable without spending an API call.
 */

import {
  buildTriageSummary,
  buildTriageTitle,
  isWithinWindow,
  windowClosesAt,
  type DraftPolicy,
  type InboundEvent,
} from "@/lib/triage";
import type { ITriageResponsePayload } from "@/models/approvals/TriageResponseApproval";

export type IngestDecision =
  | { action: "skip"; reason: string }
  | {
      action: "create";
      title: string;
      summary: string;
      staleAt: Date;
      payload: ITriageResponsePayload;
    };

export type Drafter = (inboundText: string, policy: DraftPolicy) => Promise<string | null>;

export async function decideIngest(
  now: Date,
  event: InboundEvent,
  policy: DraftPolicy,
  draft: Drafter
): Promise<IngestDecision> {
  if (!policy.enabled) {
    return { action: "skip", reason: "Triage is switched off." };
  }

  if (!isWithinWindow(now, event.sentAt)) {
    // Nothing can be sent, so an item would be a card Riku cannot act on.
    return { action: "skip", reason: "The 24-hour reply window has already closed." };
  }

  let answerText: string | undefined;
  let answerWithheldReason: string | undefined;

  if (!policy.mayAnswer) {
    answerWithheldReason = policy.withheldReason ?? "Services info not approved yet.";
  } else {
    try {
      const drafted = await draft(event.text, policy);
      if (drafted && drafted.trim().length > 0) {
        answerText = drafted;
      } else {
        answerWithheldReason = "The reply could not be drafted — send the holding reply.";
      }
    } catch {
      // A drafting outage costs a better draft, never the window. The holding
      // reply is a template and is always present, so Riku can still answer in
      // one tap.
      answerWithheldReason = "The reply could not be drafted — send the holding reply.";
    }
  }

  return {
    action: "create",
    title: buildTriageTitle(event.senderName),
    summary: buildTriageSummary(event.text),
    staleAt: windowClosesAt(event.sentAt),
    payload: {
      conversationId: event.conversationId,
      messageId: event.mid,
      senderName: event.senderName,
      inboundText: event.text,
      holdingText: policy.holdingText,
      answerText,
      answerWithheldReason,
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/__tests__/ingestTriage.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the route**

Create `src/app/api/messenger/inbound/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireForwardSecret } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getOsSettings } from "@/lib/osSettings";
import { draftPolicy, parseInboundEvent } from "@/lib/triage";
import { decideIngest } from "@/lib/ingestTriage";
import { generateTriageDraft } from "@/lib/draftTriage";
import { buildPushPayload, sendPushToAll } from "@/lib/push";
import TriageResponseApproval from "@/models/approvals/TriageResponseApproval";
import ApprovalItem from "@/models/ApprovalItem";
import AgentRun from "@/models/AgentRun";

export const maxDuration = 60;

/**
 * POST /api/messenger/inbound — ShikksTracker forwards an inbound Messenger
 * message here.
 *
 * Always answers 200 for anything it understood, including skips. The caller
 * is a webhook handler in another repo: a non-2xx would make it look as though
 * message ingestion had failed, when in fact RikuOS simply decided there was
 * nothing to queue. Only an unauthenticated or unparseable request is an error.
 */
export async function POST(request: NextRequest) {
  const unauthorized = requireForwardSecret(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  const event = parseInboundEvent(body);
  if (!event) {
    return NextResponse.json({ error: "Unrecognised event shape." }, { status: 400 });
  }

  const startedAt = new Date();
  await connectDB();

  // Dedup by Meta's message id — Meta redelivers, and so may a retrying
  // forward. Cheaper than a unique index on a discriminator field, which this
  // repo does not allow anyway.
  const existing = await ApprovalItem.findOne({
    type: "triage-response",
    "payload.messageId": event.mid,
  }).select({ _id: 1 });
  if (existing) {
    return NextResponse.json({ ok: true, action: "duplicate" });
  }

  const settings = await getOsSettings();
  const policy = draftPolicy(settings);
  const decision = await decideIngest(startedAt, event, policy, generateTriageDraft);

  if (decision.action === "skip") {
    await AgentRun.create({
      agent: "triage",
      startedAt,
      durationMs: Date.now() - startedAt.getTime(),
      ok: true,
      counts: { itemsProcessed: 0, itemsSkipped: 1 },
    });
    return NextResponse.json({ ok: true, action: "skip", reason: decision.reason });
  }

  const item = await TriageResponseApproval.create({
    source: "triage",
    title: decision.title,
    summary: decision.summary,
    staleAt: decision.staleAt,
    payload: decision.payload,
  });

  await AgentRun.create({
    agent: "triage",
    startedAt,
    durationMs: Date.now() - startedAt.getTime(),
    ok: true,
    counts: { itemsProcessed: 1 },
  });

  // Alerts last (CLAUDE.md): the item and the run record are already durable,
  // so a push failure cannot leave a drafted reply unrecorded. And the push is
  // load-bearing here rather than a convenience — with nothing auto-sending,
  // it is the only thing that can reach Riku inside a 24-hour window.
  const hours = Math.max(
    0,
    Math.floor((decision.staleAt.getTime() - Date.now()) / 3_600_000)
  );
  await sendPushToAll(
    buildPushPayload(decision.title, `${decision.summary} · ${hours}h to reply`, "/queue")
  ).catch(() => undefined);

  return NextResponse.json({ ok: true, action: "created", id: String(item._id) });
}
```

- [ ] **Step 6: Allowlist the route**

In `src/proxy.ts`, add to the public-path condition, beside the `/api/cron/` line:

```ts
    pathname.startsWith("/api/messenger/") ||
```

Add a line to that file's header comment, matching the existing style:

```
 *   /api/messenger/*      — guarded separately by the forward secret (requireForwardSecret)
```

- [ ] **Step 7: Run everything**

```bash
npx vitest run
npx tsc --noEmit
npm run build
```
Expected: all green. The build must list `/api/messenger/inbound` among its routes.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/messenger/inbound/route.ts src/lib/ingestTriage.ts src/lib/__tests__/ingestTriage.test.ts src/proxy.ts
git commit -m "feat(triage): ingest a forwarded message, queue it, push it"
```

---

### Task 9: The invented-URL guard

**Files:**
- Test: `src/lib/__tests__/draftTriage.test.ts`

A standalone task because it is the single assertion that catches this feature's worst failure, and it must not be buried among the prompt-shape tests.

- [ ] **Step 1: Write the test**

Append to `src/lib/__tests__/draftTriage.test.ts`:

```ts
describe("the invented-URL guard", () => {
  it("tells the model, in words, that it has no links when none are configured", () => {
    // Riku ships with demoSiteUrls empty (design D11). This is the state the
    // feature will actually run in for a while, so it gets its own test.
    //
    // What this CANNOT do is stop a model that ignores the instruction. The
    // real protection is that Riku reads every draft before it sends (S14).
    // This test pins the instruction's presence; the human tap is the backstop.
    const msg = buildTriageUserMessage("do you have samples?", {
      enabled: true,
      mayAnswer: true,
      knowledgeBlock: "A1 from 3,000.",
      nameableProjects: [],
      demoSiteUrls: [],
      holdingText: "Thanks!",
    });
    expect(msg).toMatch(/do not include any link at all/i);
    expect(msg).not.toMatch(/https?:\/\//);
  });

  it("contains no URL anywhere in the prompt when none was supplied", () => {
    const msg = buildTriageUserMessage("link?", {
      enabled: true,
      mayAnswer: true,
      knowledgeBlock: "Contact us anytime.",
      nameableProjects: ["Azerotech — repair shop site"],
      demoSiteUrls: [],
      holdingText: "Thanks!",
    });
    expect(msg).not.toMatch(/https?:\/\//);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/lib/__tests__/draftTriage.test.ts`
Expected: PASS (the implementation from Task 4 already satisfies it — this task exists to make the guarantee explicit and named).

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/draftTriage.test.ts
git commit -m "test(triage): pin the instruction that stops an invented portfolio link"
```

---

### Task 10: The cross-repo handoff

**Files:**
- Create: `docs/handoffs/2026-09-04-p6-messenger-forwarding.md`

RikuOS cannot make either change; both are ShikksTracker's (prime directive). This file carries the request across.

- [ ] **Step 1: Write the handoff**

Read `docs/handoffs/2026-09-04-meta-token-health.md` first and match its structure: disposable banner, "Why this exists", a paste-ready fenced block, manual steps, and a section separating what was verified from what is proposed.

It must contain:

1. **The forwarding hook.** After ShikksTracker's webhook stores an inbound message, POST to `<RIKUOS_BASE_URL>/api/messenger/inbound` with header `x-forward-secret` and body:
   ```json
   { "mid": "...", "conversationId": "...", "senderName": "Ana or null", "text": "...", "sentAt": "ISO-8601" }
   ```
   **Fire-and-forget with a short timeout.** RikuOS being slow or down must never delay ShikksTracker's 200 to Meta — a webhook that does not return fast makes Meta retry a delivery that already succeeded. Do not await the result in the request path.
   Only forward **inbound** messages. Echoes (`message_echoes`) are Riku's own sends and must not produce a draft reply to himself.

2. **`POST /api/os/messenger-reply`.** Accepts `{ conversationId, text }` with `x-os-secret`. Sends via the page token inside the 24-hour window. **The response classification is what RikuOS depends on**, and it must be honest: `2xx` only when the send is confirmed; `4xx` when refused with provably nothing sent (window closed belongs here); `5xx` when the outcome is genuinely unknown. RikuOS treats 4xx as retry-safe and 5xx as needs-human-verification, so a 5xx returned for a refusal would park an item that could simply have been retried, and a 4xx returned for an unknown could double-message a prospect.

3. **State the reason both live in that repo:** it holds `META_PAGE_TOKEN`, and RikuOS may never hold a copy — regenerating a token in Meta's console invalidates the previous one, so a copy in RikuOS would fail silently mid-window (S9).

4. **Manual steps for Riku:** generate `MESSENGER_FORWARD_SECRET` (32+ chars) and set it in *both* projects' environments; confirm the RikuOS base URL used by the forward.

- [ ] **Step 2: Commit**

```bash
git add docs/handoffs/2026-09-04-p6-messenger-forwarding.md
git commit -m "docs: hand the forwarding hook and send endpoint to ShikksTracker"
```

---

## Acceptance

Not done until observed against real data, per this repo's standard.

- [ ] Deploy. Set `MESSENGER_FORWARD_SECRET` in Vercel.
- [ ] Riku runs the ShikksTracker session for the handoff.
- [ ] Send a real message to the RIKU page from another account.
- [ ] **Within a minute:** a push arrives on the iPhone naming the sender and the hours left.
- [ ] The queue shows one item with the holding reply. If the knowledge block is still unapproved, the card says so and carries no substantive answer — **this is correct, not a bug.**
- [ ] Tap approve. `actionStatus` reaches `done`, and the reply appears in the Messenger thread.
- [ ] Re-send the same forward by hand; no second item is created.
- [ ] **Capture the real forward body and commit it as a test fixture.** The design asks for parsing to be tested against a recorded event rather than a hand-written one, and that recording cannot exist until ShikksTracker has sent a real one. Add it to `src/lib/__tests__/triage.test.ts` as a `parseInboundEvent` case. Redact nothing structural; replace only the message text if it is personal.

Record the result under P6 in `docs/ROADMAP.md`, in the style of P4's and P5's entries — including anything that did not work.

---

## Notes for the executing session

- **Do not add a cron.** Both Vercel Hobby slots are used. If the expiry sweep needs to cover triage items, it already does: it works off the base schema's `staleAt`, which Task 8 sets.
- **Open item from the design, still open:** whether the watchdog should notice that `messenger.lastEventAt` advanced while no `triage` run exists — a forward that never arrived. The data already flows. Decide during execution whether it belongs here or in a follow-up; do not silently skip it.
- **Deliberate deviation from the design's D6, and why.** The spec said the knowledge *block* carries the "never claim / always defer" list. This plan puts those prohibitions in `TRIAGE_SYSTEM_PROMPT` and in the rendered empty-state lines instead — in code, not in editable prose. Reason: a safety rule living inside a settings field Riku edits is a safety rule he can delete by accident while trimming the block to fit 4,000 characters. The block holds facts; the code holds the rules about them. The spec has been updated to match.
- **`answerText` is absent, not empty**, when withheld. The queue UI must distinguish "no answer was drafted" from "an empty answer was drafted", or the card will offer Riku a blank message to send.
