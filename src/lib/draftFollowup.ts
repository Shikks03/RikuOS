/**
 * draftFollowup.ts — generates the reply the chaser proposes.
 *
 * This is the "prompt plus data" half of the runtime split rule
 * (ARCHITECTURE.md §2.3): no skill is needed, so it runs as a Vercel cron
 * calling the Anthropic API rather than as a Claude scheduled task.
 *
 * The forced-tool-use shape mirrors ../ShikksTracker/src/lib/draft.ts, which is
 * already proven on this account and with these guardrails. Deliberately no
 * `strict: true` and no assistant prefill: the returned input is validated at
 * runtime by parseDraftToolInput instead.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AttentionItem } from "@/lib/stApi";
import type { DraftChannel } from "@/models/approvals/FollowupDraftApproval";

/** Matches IFollowupDraftPayload.draftBody's maxlength. */
export const FOLLOWUP_MAX_BODY = 8000;

/** Bound on each block of context pasted into the prompt. */
const CONTEXT_MAX = 1500;

export const ANTHROPIC_TIMEOUT_MS = 45_000;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set; the chaser cannot generate drafts.");
  }
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: ANTHROPIC_TIMEOUT_MS, // milliseconds in the TS SDK
      maxRetries: 1, // one retry keeps the run inside the cron's wall-clock budget
    });
  }
  return client;
}

/**
 * Pinned via env (ARCHITECTURE.md §4.2). Effort stays low and thinking stays
 * ON: with thinking disabled the model can write a tool call into visible text
 * instead of emitting a tool_use block, which is exactly the shape this file
 * depends on. Low effort is the cheap, safe combination.
 */
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

/**
 * Ported verbatim from ../ShikksTracker/src/lib/draft.ts so both apps' copy
 * reads the same. Distilled from the layered-humanizer skill's lexical-patterns
 * catalog down to what actually shows up in short outreach copy.
 */
const AI_TELL_GUARDRAILS = `Avoid these AI-writing tells:
- No em dashes or en dashes (— or –) anywhere. Use a period, comma, or colon instead.
- No AI-vocabulary words: delve, crucial, enhance, foster/fostering, tapestry, testament, underscore (verb), showcase, vibrant, boasts, nestled, "in the heart of", stunning, breathtaking, seamless, robust, leverage, elevate, unlock, game-changer, unparalleled.
- Don't dodge "is/has" with "serves as", "stands as", or "boasts a".
- No rule-of-three filler lists (three abstract nouns strung together just to sound thorough).
- No filler phrases ("in order to", "due to the fact that", "at this point in time") — say it plainly.
- No hedging stacks ("could potentially possibly").
- No assistant-speak: "I hope this helps", "let me know if", "Would you like me to", "Of course!", "Great question!".
- No generic uplifting closers ("exciting times ahead", "here's to a bright future").
- Vary sentence length instead of giving every sentence the same clipped, mid-length cadence.`;

const REPLY_FRAME = `You are writing a REPLY to a lead who already answered an outreach message and has been left waiting. This is NOT cold outreach: they wrote first, and this message answers them.`;

export const FOLLOWUP_EMAIL_SYSTEM_PROMPT = `${REPLY_FRAME}

RULES — follow every one, no exceptions:
1. Under ~120 words. Plain text only. Paragraphs separated by a blank line. No HTML, no markdown, no bullet lists.
2. Write the BODY ONLY. No subject line — the message threads onto the existing conversation.
3. Answer what they actually said. Their message is quoted in the input; respond to it directly in the first sentence.
4. No placeholders such as [Name] or [Company]. Use the names you are given or omit them gracefully.
5. Do not dwell on the delay. One short acknowledgement at most, or none at all. Never apologise twice.
6. End with ONE clear next step: a question they can answer in a sentence, or two concrete times for a call.
7. Match the language they wrote in. If their message is Taglish, reply in Taglish; if English, reply in English. Respect the tone notes.
8. No spammy phrasing, no ALL CAPS words, at most one "!" in the whole message.

${AI_TELL_GUARDRAILS}

Use the followup_draft tool to return your result.`;

export const FOLLOWUP_DM_SYSTEM_PROMPT = `${REPLY_FRAME} It will be pasted straight into a Facebook direct message box, so it is NOT an email.

RULES — follow every one, no exceptions:
1. Under ~60 words. One or two short paragraphs. Plain text only — no HTML, no markdown, no bullet lists.
2. NO subject line. NO salutation block on its own line. NO email sign-off ("Best regards", "Sincerely"). Write it the way a real person types a direct message.
3. Answer what they actually said. Their message is quoted in the input; respond to it directly in the first sentence.
4. No placeholders such as [Name] or [Company]. Use the names you are given or omit them gracefully.
5. Do not dwell on the delay. One short acknowledgement at most, or none at all.
6. End with ONE clear next step: a question they can answer in a sentence, or two concrete times for a call.
7. Match the language they wrote in. If their message is Taglish, reply in Taglish; if English, reply in English. Respect the tone notes.
8. No spammy phrasing, no ALL CAPS words, at most one "!" in the whole message.

${AI_TELL_GUARDRAILS}

Use the followup_draft tool to return your result.`;

export function systemPromptFor(channel: DraftChannel): string {
  return channel === "email" ? FOLLOWUP_EMAIL_SYSTEM_PROMPT : FOLLOWUP_DM_SYSTEM_PROMPT;
}

function clip(value: string | null | undefined, max = CONTEXT_MAX): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function daysSince(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / (24 * 60 * 60 * 1000)));
}

/**
 * Builds the user message. Every nullable field is skipped rather than printed
 * as "null" — a prompt containing the literal word teaches the model that empty
 * context is a value worth mentioning.
 */
export function buildFollowupUserMessage(item: AttentionItem, now: Date): string {
  const days = daysSince(item.repliedAt, now);
  const lines: string[] = [
    `Business: ${item.businessName}`,
    ...(item.contactName ? [`Person: ${item.contactName}`] : []),
    `Channel: ${item.channel}`,
    `They replied ${days} ${days === 1 ? "day" : "days"} ago and have had no answer since.`,
  ];

  const reply = clip(item.replySnippet);
  lines.push("", "What they said:", reply ? `"""${reply}"""` : "(not captured)");

  const outbound = clip(item.lastOutboundBody);
  if (outbound) lines.push("", "The last thing we sent them:", `"""${outbound}"""`);

  const keyPoints = clip(item.keyPoints);
  if (keyPoints) lines.push("", `What we know about this business: ${keyPoints}`);

  const offer = clip(item.offerSummary);
  if (offer) lines.push("", `Our offer: ${offer}`);

  const tone = clip(item.toneNotes, 500);
  if (tone) lines.push("", `Tone notes: ${tone}`);

  lines.push("", "Write the reply.");
  return lines.join("\n");
}

/** Validates the tool input at runtime; throws with a diagnosable message. */
export function parseDraftToolInput(input: unknown): string {
  if (input === null || typeof input !== "object") {
    throw new Error("The model returned a non-object tool input.");
  }
  const raw = (input as Record<string, unknown>).body;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error("The model's tool input has no usable `body` string.");
  }
  const body = raw.trim();
  if (body.length > FOLLOWUP_MAX_BODY) {
    throw new Error(
      `The generated body is too long (${body.length} > ${FOLLOWUP_MAX_BODY} characters).`
    );
  }
  return body;
}

/**
 * Generates one follow-up body. Throws on any failure — the caller counts it as
 * a failed lead and moves on to the next one, so one bad draft never takes down
 * the whole run.
 */
export async function generateFollowupDraft(
  item: AttentionItem,
  channel: DraftChannel,
  now: Date = new Date()
): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: "low" },
    system: systemPromptFor(channel),
    tools: [
      {
        name: "followup_draft",
        description:
          "Return the generated follow-up reply as structured JSON with a single body field.",
        input_schema: {
          type: "object" as const,
          properties: {
            body: {
              type: "string",
              description:
                "The plain-text message body. No subject line. Paragraphs separated by blank lines.",
            },
          },
          required: ["body"],
          additionalProperties: false,
        },
      },
    ],
    tool_choice: { type: "tool", name: "followup_draft" },
    messages: [{ role: "user", content: buildFollowupUserMessage(item, now) }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error(
      `Expected a tool_use block from Claude but got stop_reason "${response.stop_reason}".`
    );
  }
  return parseDraftToolInput(toolBlock.input);
}
