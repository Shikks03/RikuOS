/**
 * draftTriage.ts — drafts a reply to someone who messaged the RIKU page.
 *
 * Shares its foundation with draftFollowup.ts deliberately: same SDK, same
 * timeout, same model constant, same Taglish-mirroring instruction. It does
 * NOT share draftFollowup's forced-tool-use shape — the output here is a
 * single string, not structured JSON with multiple fields, so there is
 * nothing a tool call would buy; `generateTriageDraft` just extracts the
 * text blocks from the response directly.
 *
 * The differences from draftFollowup are the audience (a stranger who
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

/** Matches ITriageResponsePayload.answerText's maxlength (TriageResponseApproval.ts). */
export const TRIAGE_MAX_BODY = 4000;

export const TRIAGE_TIMEOUT_MS = 45_000;

/** Pinned via env (ARCHITECTURE.md §4.2), same constant name as draftFollowup.ts. */
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
