/**
 * debriefView.ts — the Debrief as the panel shows it (S22, spec §4). Pure and
 * client-safe: the shell builds it from the stored Debrief, and the island
 * builds it again from the door's response after a press. No clock — `at`
 * drives the heading — no database, no network. Imports are pure modules or
 * `import type` only (viewModelPurity.test.ts).
 *
 * PAGE TEXT. Stored strings are push-form; everything leaving here is curled
 * by toPage, which never changes a length, so stored bold ranges stay valid.
 * `since` lines arrive already curled (sinceThenLines); curling twice is a
 * no-op. Raw errors are NOT curled: they are quoted evidence.
 */

import { APP_TZ } from "@/lib/constants";
import { clockHHMM, dayKey } from "@/lib/days";
import { debriefHeading, toPage } from "@/lib/voice";
import { symptomView, type SymptomView } from "@/lib/briefingView";
import type {
  StoredDebrief,
  StoredDebriefSymptom,
  StoredSortedItem,
  StoredStandaloneLine,
  StoredSymptom,
} from "@/lib/briefingTypes";

/** Spec §4.2's literal for nothing then and nothing now (plan deviation 19). */
export const ALL_CLEAR_SAME = "All clear, same as this morning.";
/** Spec §4.3's heading (§10 item 6, approved). */
export const RIGHT_NOW = "Right now";
/** The no-baseline list with nothing in it (plan deviation 13 — provisional, for Riku's nod). */
export const NOTHING_NOW = "Nothing needs you right now.";

export interface DebriefRow {
  /** Tapping the row opens this card — fresh for a re-checked row, the 07:00 one otherwise. */
  symptom: SymptomView;
  /** The can't-say line under a row whose source couldn't be checked; page-form. */
  note: string | null;
}

export type DebriefComparisonView =
  | {
      kind: "since";
      /** "Since 07:00" — the baseline's own send time, never a literal (spec §4.2). */
      heading: string;
      sorted: string[];
      still: DebriefRow[];
      fresh: DebriefRow[];
      /** Shown at the end of New. */
      standalone: string[];
      /** ALL_CLEAR_SAME when every group is empty, else null. */
      allClear: string | null;
    }
  | {
      kind: "now";
      heading: string;
      rows: DebriefRow[];
      standalone: string[];
      /** NOTHING_NOW when there are no rows and no standalone lines, else null. */
      empty: string | null;
    };

export interface DebriefView {
  /** Identity for "which Debrief is newer" (ISO instants compare as strings). */
  atIso: string;
  /** "13:04" — `at` in APP_TZ. */
  stamp: string;
  /** "Afternoon, Riku. Here’s where things stand." */
  heading: string;
  comparison: DebriefComparisonView;
  /** What you've done; empty when there was no baseline. */
  done: string[];
  today: string;
  freelance: string | null;
  off: string | null;
}

function rows(list: ReadonlyArray<StoredSymptom | StoredDebriefSymptom>, prefix: string): DebriefRow[] {
  return list.map((m, i) => ({
    symptom: symptomView(m, `${prefix}.${i}`),
    note: "note" in m && typeof m.note === "string" ? toPage(m.note) : null,
  }));
}

export function buildDebriefView(d: StoredDebrief): DebriefView {
  const stamp = clockHHMM(d.at, APP_TZ);
  const hour = Number(stamp.slice(0, 2));
  const standalone = d.standaloneCouldntCheck.map((s) => toPage(s.sentence));

  let comparison: DebriefComparisonView;
  if (d.baselineSentAt === null) {
    const now = rows(d.now, "r");
    comparison = {
      kind: "now",
      heading: RIGHT_NOW,
      rows: now,
      standalone,
      empty: now.length === 0 && standalone.length === 0 ? NOTHING_NOW : null,
    };
  } else {
    const sorted = d.sorted.map((s) => toPage(s.sentence));
    const still = rows(d.stillNeedsYou, "s");
    const fresh = rows(d.new, "n");
    const nothing = sorted.length === 0 && still.length === 0 && fresh.length === 0 && standalone.length === 0;
    comparison = {
      kind: "since",
      heading: `Since ${clockHHMM(d.baselineSentAt, APP_TZ)}`,
      sorted,
      still,
      fresh,
      standalone,
      allClear: nothing ? ALL_CLEAR_SAME : null,
    };
  }

  return {
    atIso: d.at.toISOString(),
    stamp,
    heading: toPage(debriefHeading(dayKey(d.at, APP_TZ), hour)),
    comparison,
    done: d.since.map(toPage),
    today: toPage(d.today),
    freelance: d.freelance === null ? null : toPage(d.freelance),
    off: d.off === null ? null : toPage(d.off),
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isoDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The door's JSON back into a StoredDebrief (dates revived), or null when the
 * body isn't one. The top level is checked; rows are the door's own bounded
 * output and are taken as they come — the island builds the view inside a
 * try, so a malformed row reads as "didn't finish", never a crash.
 */
export function parseDebriefResponse(body: unknown): { debrief: StoredDebrief; saved: boolean } | null {
  if (!isObject(body)) return null;
  const at = isoDate(body.at);
  const baselineSentAt = body.baselineSentAt === null ? null : isoDate(body.baselineSentAt);
  if (at === null || (body.baselineSentAt !== null && baselineSentAt === null)) return null;
  if (typeof body.title !== "string" || typeof body.today !== "string" || typeof body.saved !== "boolean") return null;
  if (typeof body.unrecognised !== "number") return null;
  if (!(body.freelance === null || typeof body.freelance === "string")) return null;
  if (!(body.off === null || typeof body.off === "string")) return null;
  const lists = ["sorted", "stillNeedsYou", "new", "now", "standaloneCouldntCheck", "since"] as const;
  if (!lists.every((k) => Array.isArray(body[k]))) return null;
  const cc = isObject(body.couldntCheck) ? body.couldntCheck : {};

  return {
    saved: body.saved,
    debrief: {
      at,
      baselineSentAt,
      title: body.title,
      sorted: body.sorted as StoredSortedItem[],
      stillNeedsYou: body.stillNeedsYou as StoredDebriefSymptom[],
      new: body.new as StoredSymptom[],
      now: body.now as StoredSymptom[],
      standaloneCouldntCheck: body.standaloneCouldntCheck as StoredStandaloneLine[],
      since: (body.since as unknown[]).filter((line): line is string => typeof line === "string"),
      today: body.today,
      freelance: body.freelance,
      off: body.off,
      unrecognised: body.unrecognised,
      couldntCheck: { sites: cc.sites === true, watchdog: cc.watchdog === true, shikkstracker: cc.shikkstracker === true },
      saved: body.saved,
    },
  };
}
