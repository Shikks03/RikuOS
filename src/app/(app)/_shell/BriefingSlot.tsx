import { Suspense } from "react";
import { connectDB } from "@/lib/db";
import { MONGO_READ_TIMEOUT_MS, withDeadline } from "@/lib/deadline";
import { todayKey } from "@/lib/days";
import { getLastDigest, type StoredDigest } from "@/lib/lastDigest";
import { getLastDebrief } from "@/lib/lastDebrief";
import { readOsSettings } from "@/lib/osSettings";
import { readLatestDispatcher } from "@/lib/dispatcherRun";
import {
  buildBriefingView,
  buildGreetingLine,
  debriefIsToday,
  shouldAutoOpen,
  type BriefingView,
  type GreetingInput,
  type GreetingLine,
} from "@/lib/briefingView";
import { buildDebriefView, type DebriefView } from "@/lib/debriefView";
import type { StoredDebrief } from "@/lib/briefingTypes";
import Briefing from "./Briefing";

/**
 * The greeting line's server half (S21, spec §5.1; S22). Four read-only
 * reads, each bounded and settled on its own — the rail's discipline (R37:
 * settings through readOsSettings, never the upsert; R55: getLastDigest and
 * getLastDebrief never write). A failure becomes the line's honest "couldn't
 * load" state (a failed Debrief read is simply "no Debrief"); the page always
 * renders. Suspense keeps the reads off the shell's critical path.
 */
export default function BriefingSlot() {
  return (
    <Suspense fallback={<span className="bf-line is-loading" aria-hidden="true" />}>
      <BriefingRead />
    </Suspense>
  );
}

function settled<T>(r: PromiseSettledResult<T>, label: string): T | "unavailable" {
  if (r.status === "fulfilled") return r.value;
  console.error(`[briefing] ${label} failed:`, r.reason);
  return "unavailable";
}

async function BriefingRead() {
  const now = new Date();
  const connected = connectDB();
  const bounded = <T,>(read: () => Promise<T>, label: string) =>
    withDeadline(connected.then(read), MONGO_READ_TIMEOUT_MS, `briefing ${label}`);
  const [digestR, dispatcherR, settingsR, debriefR] = await Promise.allSettled([
    bounded(getLastDigest, "last-digest read"),
    bounded(readLatestDispatcher, "dispatcher read"),
    bounded(readOsSettings, "settings read"),
    bounded(getLastDebrief, "last-debrief read"),
  ]);
  const digest: StoredDigest | null | "unavailable" = settled(digestR, "last-digest read");
  const debraw: StoredDebrief | null | "unavailable" = settled(debriefR, "last-debrief read");
  const settings = settled(settingsR, "settings read");

  // Today's Debrief only (S22): yesterday's is never shown. Built BEFORE the
  // greeting line and in its own try/catch (fix round item 2): a Debrief
  // whose view throws, or that isn't today's, must never leave the line
  // saying "Debrief at …" with nothing underneath it for the panel to open.
  // A throw here is kept out of the morning `view` build below by using a
  // separate try of its own.
  let debriefView: DebriefView | null = null;
  if (debraw !== null && debraw !== "unavailable" && debriefIsToday(debraw, now)) {
    try {
      debriefView = buildDebriefView(debraw);
    } catch (err) {
      console.error("[briefing] debrief view build failed:", err);
    }
  }
  // The greeting line only ever sees a Debrief that will actually render.
  const debriefForLine: typeof debraw = debriefView === null ? null : debraw;

  const input: GreetingInput = {
    now,
    digest,
    debrief: debriefForLine,
    dispatcher: settled(dispatcherR, "dispatcher read"),
    monitoringEnabled: settings === "unavailable" ? "unavailable" : settings.monitoringEnabled,
  };
  // An unexpected stored record (a shape these don't recognise) must not
  // throw past this slot: BriefingSlot sits in the (app) layout, so an
  // uncaught throw here would take every page down with it (fix round
  // item 9). The fallback is the line's own "couldn't load" state, same
  // wording as buildGreetingLine's own `fail` kind, with no Briefing to open.
  let line: GreetingLine;
  let view: BriefingView | null;
  let autoOpen: boolean;
  try {
    line = buildGreetingLine(input);
    view = digest === null || digest === "unavailable" ? null : buildBriefingView(digest, now);
    autoOpen = shouldAutoOpen(digest, now);
  } catch (err) {
    console.error("[briefing] view build failed:", err);
    line = { kind: "fail", text: "I couldn’t load the briefing.", tone: "warning", opens: null };
    view = null;
    autoOpen = false;
  }

  // useSearchParams (inside Briefing) needs its own boundary.
  return (
    <Suspense
      fallback={
        <span className={`bf-line is-${line.tone}`}>
          <i aria-hidden="true" />
          <span>{line.text}</span>
        </span>
      }
    >
      {/* Keyed on the Briefing's own sentAt AND today's day key, not just
          mounted once per page load: a new morning's digest (or
          router.refresh() finding one) remounts the island so its `open`
          initialiser re-decides auto-open fresh, rather than carrying
          yesterday's state (fix round item 5a). The day key alone covers a
          monitoring-off morning with no new digest: without it, an
          overnight in-memory PWA resume could still show yesterday's
          `localDebrief` through "← Debrief" (fix round item 1) — the
          accepted side effect is that a panel left open across midnight
          closes on its next refresh. A new Debrief does NOT change the key,
          so a press's refresh never closes the panel it was pressed in. */}
      <Briefing
        key={`${view?.sentAtIso ?? "none"}|${todayKey(now)}`}
        line={line}
        view={view}
        debrief={debriefView}
        autoOpen={autoOpen}
      />
    </Suspense>
  );
}
