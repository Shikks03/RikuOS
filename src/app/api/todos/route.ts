import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseCreateTodo } from "@/lib/todos";
import { createTodo } from "@/lib/todoStore";
import { BAD_JSON, SAVE_FAILED, createReply, type Reply } from "@/lib/personalWrites";

const send = (r: Reply) => NextResponse.json(r.body, { status: r.status });

/**
 * POST /api/todos — body: { title, section?, dueOn?, onCalendar? } (todos.ts).
 *
 * 201 `{ id, calendar }` once the to-do is saved, whatever its calendar leg
 * did; 400 `{ error: <code> }`; 500 `Couldn't save.` if the to-do's own write
 * threw. The mapping is personalWrites.ts's. No GET: the page reads its own
 * rows, bounded, in a server component.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return send(BAD_JSON);
  }

  const parsed = parseCreateTodo(body);
  if (!parsed.ok) return send({ status: 400, body: { error: parsed.error } });

  try {
    await connectDB();
    return send(createReply(await createTodo(parsed.value)));
  } catch (err) {
    console.error("[api/todos] create failed:", err instanceof Error ? err.name : "unknown error");
    return send(SAVE_FAILED);
  }
}
