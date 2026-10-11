import { Suspense } from "react";
import { connectDB } from "@/lib/db";
import { MONGO_READ_TIMEOUT_MS, withDeadline } from "@/lib/deadline";
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
  const debrief: StoredDebrief | null | "unavailable" = settled(debriefR, "last-debrief read");
  const settings = settled(settingsR, "settings read");
  const input: GreetingInput = {
    now,
    digest,
    debrief,
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

  // Today's Debrief only (S22): yesterday's is never shown. Built on its own,
  // so a malformed Debrief costs only the Debrief, never the morning view.
  let debriefView: DebriefView | null = null;
  if (debrief !== null && debrief !== "unavailable" && debriefIsToday(debrief, now)) {
    try {
      debriefView = buildDebriefView(debrief);
    } catch (err) {
      console.error("[briefing] debrief view build failed:", err);
    }
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
      {/* Keyed on the Briefing's own sentAt, not just mounted once per page
          load: a new morning's digest (or router.refresh() finding one)
          remounts the island so its `open` initialiser re-decides auto-open
          fresh, rather than carrying yesterday's state (fix round item 5a).
          A new Debrief does NOT change the key, so a press's refresh never
          closes the panel it was pressed in. */}
      <Briefing key={view?.sentAtIso ?? "none"} line={line} view={view} debrief={debriefView} autoOpen={autoOpen} />
    </Suspense>
  );
}
