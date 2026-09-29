/**
 * The Todo schema reads its title bound from constants.ts (a relative import,
 * because sync-indexes.mts loads models without the "@/" alias), and todos.ts's
 * parser reads the same constant. One number for both.
 */
import { describe, it, expect } from "vitest";
import Todo from "@/models/Todo";
import { TODO_TITLE_MAX } from "@/lib/todos";

describe("the Todo schema's title bound", () => {
  it("is todos.ts's TODO_TITLE_MAX, one number for the parser and the schema", () => {
    expect(Todo.schema.path("title").options.maxlength).toBe(TODO_TITLE_MAX);
    expect(TODO_TITLE_MAX).toBe(140);
  });
});
