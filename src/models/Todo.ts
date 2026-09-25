import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * The three to-do sections. Work is not one of them: the Work page stays
 * parked until hired (D9), and a section with no page would be a drawer
 * nothing opens. `freelance` is this app's OWN to-dos about freelance work —
 * not a ShikksTracker read (the prime directive).
 */
export const TODO_SECTIONS = ["personal", "freelance", "academics"] as const;
export type TodoSection = (typeof TODO_SECTIONS)[number];

export interface ITodo extends Document {
  title: string;
  section: TodoSection;
  dueOn?: Date;
  done: boolean;
  doneAt?: Date;
  calendarId?: string;
  calendarEventId?: string;
  calendarBehind: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The app's own to-do store (S19, ARCHITECTURE.md §7) — the thing P5a-7's
 * Today sentence was dropped for want of.
 *
 * `dueOn` is a DAY, not an instant: that calendar day at 00:00:00Z, built by
 * dayStart() in src/lib/days.ts. Every comparison reads it back with
 * `dayKey(dueOn, "UTC")` — explicitly UTC, never APP_TZ — and never with raw
 * Date arithmetic. Reading a UTC midnight in APP_TZ happens to give the same
 * day only because Manila is ahead of UTC; a zone behind it would read the
 * day before.
 *
 * `calendarEventId` is present EXACTLY when the to-do is pinned to the
 * calendar. Only the entry's id is stored, never the entry — Google Calendar
 * is the single source of truth (concept D5). `calendarId` is always `primary`
 * in this version and is stored anyway, so a later change of target calendar
 * cannot orphan an entry written to the old one. 1024 is Google's stated
 * maximum for an event id.
 *
 * `calendarBehind` is SYNC STATE, not event data. S19 (ARCHITECTURE.md §7)
 * lets a to-do remember only its entry's id, so nothing about the entry — not
 * its day, not its title — is stored here. What is stored is a fact about the
 * to-do's own last write: "a change the entry should show was saved, and
 * Google has not confirmed it". It is set true in the same atomic write that
 * changes a to-do's title or due day (the move path is local-first,
 * src/lib/todoStore.ts), and set false only when a patch to the CURRENT title
 * and day succeeds, when a pin is claimed, or with the id when the entry is
 * removed. `calendarEventId && calendarBehind` is deck §15's
 * `entry on the old day`, and it is also how the next save knows to retry
 * the move. On a to-do with no `calendarEventId` it means nothing and is read
 * by nothing; a pin resets it. Required with a default of false; a row
 * written before the field existed has none, and every reader treats absent
 * as false.
 *
 * TWO INDEXES, TWO QUERIES, WHOLE PAGE:
 *   { done: 1, dueOn: 1 }    find({ done: false }).sort({ dueOn: 1 }) — every
 *                            open to-do, soonest first: Today, This week and
 *                            the To-do tile all read this one list.
 *   { done: 1, doneAt: -1 }  Done this week — the newest completions first.
 * A third, { section: 1, done: 1, dueOn: 1 }, was CUT (R35 / R86 §I item 3):
 * it served a per-section query that does not exist, because the To-do tile
 * shows all three sections together and grouping happens in the pure layer.
 * Do not add it back without the query that needs it.
 *
 * NO TTL, and that is not an oversight beside AgentRun's and LoginAttempt's:
 * done items are kept (D9). Nothing here is a nullable unique field, so there
 * is no partial index to go looking for either.
 *
 * autoIndex is off in production: Mongoose will NOT create these. They land
 * through `npm run migrate:indexes:apply`, which is Riku's step.
 *
 * updatedAt is on because updates — done, undone, pinned, unpinned, re-dated —
 * are the point of this record.
 */
const TodoSchema = new Schema<ITodo>(
  {
    title: { type: String, required: true, maxlength: 140, trim: true },
    section: { type: String, required: true, enum: TODO_SECTIONS },
    dueOn: { type: Date },
    done: { type: Boolean, required: true, default: false },
    // Set when `done` flips true, cleared when it flips back.
    doneAt: { type: Date },
    calendarId: { type: String, maxlength: 256 },
    calendarEventId: { type: String, maxlength: 1024 },
    calendarBehind: { type: Boolean, required: true, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: true }, strict: true }
);

TodoSchema.index({ done: 1, dueOn: 1 }); // find({done:false}).sort({dueOn:1})
TodoSchema.index({ done: 1, doneAt: -1 }); // Done this week

const Todo = (mongoose.models.Todo as Model<ITodo>) || mongoose.model<ITodo>("Todo", TodoSchema);

export default Todo;
