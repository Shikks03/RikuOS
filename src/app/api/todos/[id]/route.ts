import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { deleteTodo, setTodoDone, updateTodo } from "@/lib/todoStore";
import {
  BAD_JSON,
  DELETE_FAILED,
  SAVE_FAILED,
  deleteReply,
  doneReply,
  parseTodoPatch,
  updateReply,
  type Reply,
} from "@/lib/personalWrites";

const send = (r: Reply) => NextResponse.json(r.body, { status: r.status });

type Context = { params: Promise<{ id: string }> };

/**
 * PATCH /api/todos/:id
 *
 * Body: `{ done: boolean }` ALONE is the tick (setTodoDone); any other body is
 * an edit — `{ title?, section?, dueOn?, onCalendar? }` (updateTodo). `done`
 * beside another key is a 400 `mixed-patch`. 200 `{ calendar }` (plus `done`
 * for a tick) once the to-do is saved, whatever its calendar leg did; 404 for
 * no such to-do (a malformed id included — the store reads it as not-found);
 * 400 `{ error: <code> }`; 500 `Couldn't save.`.
 */
export async function PATCH(request: NextRequest, context: Context): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return send(BAD_JSON);
  }

  const parsed = parseTodoPatch(body);
  if (!parsed.ok) return send({ status: 400, body: { error: parsed.error } });

  try {
    await connectDB();
    const patch = parsed.value;
    return send(
      patch.kind === "done"
        ? doneReply(await setTodoDone(id, patch.done))
        : updateReply(await updateTodo(id, patch.input)),
    );
  } catch (err) {
    console.error("[api/todos/:id] save failed:", err instanceof Error ? err.name : "unknown error");
    return send(SAVE_FAILED);
  }
}

/**
 * DELETE /api/todos/:id — 200 `{ calendar }` once the to-do is gone (an
 * `orphaned` outcome means its entry may still be on Google: the client says
 * `Remove it in Google Calendar.`); 404; 500 `Couldn't delete.`.
 */
export async function DELETE(request: NextRequest, context: Context): Promise<NextResponse> {
  const denied = await requireSession(request);
  if (denied) return denied;

  const { id } = await context.params;

  try {
    await connectDB();
    return send(deleteReply(await deleteTodo(id)));
  } catch (err) {
    console.error("[api/todos/:id] delete failed:", err instanceof Error ? err.name : "unknown error");
    return send(DELETE_FAILED);
  }
}
