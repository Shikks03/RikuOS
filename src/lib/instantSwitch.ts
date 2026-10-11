/**
 * instantSwitch.ts — the one rule for a switch that saves on press
 * (smooth-feel spec §5): it flips at once; a DEFINITE failure (pressOutcome's
 * `failed`, L7) flips it back; ok and no-answer keep it where Riku put it
 * until the press's re-read lands, and from then on the server's position is
 * shown. LayerSwitches has behaved this way since P10c; CalendarPicker and
 * Settings' agent cards now share it. Client-safe: a type-only import.
 */
import type { PressOutcome } from "@/lib/pressOutcome";

/** The pressed switch and where the press moved it. */
export interface Moved<K extends string = string> {
  key: K;
  on: boolean;
}

/** What a switch shows: the moved position while its press and re-read are in flight, else the server's. */
export function shownOn<K extends string>(key: K, serverOn: boolean, moved: Moved<K> | null, busy: boolean): boolean {
  return busy && moved !== null && moved.key === key ? moved.on : serverOn;
}

/** After the door answers: a definite failure returns the switch; ok and unknown keep it. */
export function movedAfter<K extends string>(kind: PressOutcome["kind"], moved: Moved<K> | null): Moved<K> | null {
  return kind === "failed" ? null : moved;
}
