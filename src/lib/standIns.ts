/**
 * standIns.ts — the faded rows an add shows before the server confirms it
 * (smooth-feel spec §4; plan deviations 3, 5, 6). Pure and client-safe.
 *
 * A stand-in is CLIENT STATE ONLY: never sent anywhere, never stored, gone on
 * reload, and always replaced by the server's render. It carries what its row
 * needs to draw and nothing that could be mistaken for a record.
 *
 * LIFECYCLE — the hidden set's rule (LayoutEditor): put IN FLIGHT on the
 * press; the door's answer either DROPS it at once (a definite failure — the
 * form reopens with what was typed) or SETTLES it (ok, or no answer, with its
 * mark); the first server render after it settled removes it, whatever that
 * render holds (deviation 5). A render that lands while it is still in flight
 * (another island's refresh) cannot remove it.
 */
import type { DayKey } from "@/lib/days";

export type StandInSection = "personal" | "freelance" | "academics";
export type StandInMark = "saving" | "unknown";

interface Common {
  key: string;
  title: string;
  mark: StandInMark;
  inFlight: boolean;
}

export interface TodoStandIn extends Common {
  kind: "todo";
  section: StandInSection;
  dueOn: DayKey | null;
  /** The due chip, worked out in the press handler (todos.ts's dueChip), so render stays pure. */
  due: { text: string; late: boolean } | null;
}

export interface EventStandIn extends Common {
  kind: "event";
  calendarName: string;
  dayKey: DayKey;
  allDay: boolean;
  /** "HH:MM", as the event form holds them. */
  start: string;
  end: string;
}

export type StandIn = TodoStandIn | EventStandIn;

/** Where a tile draws stand-ins: each group or day that can hold one. */
export type StandInPlace =
  | { tile: "todos"; section: StandInSection }
  | { tile: "today"; group: "scheduled" | "due"; today: DayKey }
  | { tile: "week"; day: DayKey };

/** The words beside a stand-in's title (spec §4). */
export const STAND_IN_MARK: Readonly<Record<StandInMark, string>> = {
  saving: "saving",
  unknown: "couldn’t tell if that saved",
};

export const SECTION_LABEL: Readonly<Record<StandInSection, string>> = {
  personal: "Personal",
  freelance: "Freelance",
  academics: "Academics",
};

let seq = 0;

/** A key no other stand-in in this tab has. Called in handlers only. */
export function nextStandInKey(): string {
  seq += 1;
  return `standin:${seq}`;
}

export function putStandIn(list: readonly StandIn[], s: StandIn): StandIn[] {
  return [...list.filter((x) => x.key !== s.key), s];
}

export function settleStandIn(list: readonly StandIn[], key: string, mark: StandInMark): readonly StandIn[] {
  if (!list.some((x) => x.key === key)) return list;
  return list.map((x) => (x.key === key ? { ...x, mark, inFlight: false } : x));
}

export function dropStandIn(list: readonly StandIn[], key: string): readonly StandIn[] {
  return list.some((x) => x.key === key) ? list.filter((x) => x.key !== key) : list;
}

/** A new server render: settled stand-ins leave, in-flight ones stay. The same list when nothing leaves. */
export function afterServerRender(list: readonly StandIn[]): readonly StandIn[] {
  return list.some((x) => !x.inFlight) ? list.filter((x) => x.inFlight) : list;
}

function belongs(s: StandIn, place: StandInPlace): boolean {
  if (place.tile === "todos") return s.kind === "todo" && s.section === place.section;
  if (place.tile === "today") {
    if (place.group === "due") return s.kind === "todo" && s.dueOn !== null && s.dueOn <= place.today;
    return s.kind === "event" && s.dayKey === place.today;
  }
  return s.kind === "todo" ? s.dueOn === place.day : s.dayKey === place.day;
}

/** The stand-ins that belong in one group or day, in the order they were added. */
export function standInsAt(list: readonly StandIn[], place: StandInPlace): StandIn[] {
  return list.filter((s) => belongs(s, place));
}

/** An event stand-in's time: the range in a Today row, the start in a week item; `all day` either way. */
export function standInTime(s: EventStandIn, where: "row" | "item"): string {
  if (s.allDay) return "all day";
  return where === "row" ? `${s.start}–${s.end}` : s.start;
}
