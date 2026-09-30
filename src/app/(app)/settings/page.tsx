import { connectDB } from "@/lib/db";
import { MONGO_READ_TIMEOUT_MS, withDeadline } from "@/lib/deadline";
import { GoogleError, listCalendars } from "@/lib/google";
import { readOsSettings, type Layer } from "@/lib/osSettings";
import { buildSettingsCards, type CalendarListFeed } from "@/lib/personalView";
import { LAYERS_MAX, LAYER_NAME_MAX } from "@/models/OsSettings";
import AgentSwitches from "./_blocks/AgentSwitches";
import CalendarPicker from "./_blocks/CalendarPicker";

/**
 * /settings — a server component since P10c, so that listCalendars() can be
 * called ONCE, here, and both Google cards derived from that one answer (R24):
 * `Connected.` means the calendar list came back and nothing less (deck §15),
 * and there is no client route to ask (`/api/google/*` stays cut).
 *
 * The two agent cards are P3's client page moved VERBATIM into
 * `_blocks/AgentSwitches.tsx`: the same client GET of /api/settings on mount,
 * the same PATCHes, the same strings. Its `setState`-in-an-effect is one of
 * the four baseline lint errors and travelled with it on purpose — rewriting
 * it would change a working P3 feature inside a P10 page task. Its only edit is
 * the outer `<main>`, now a fragment, because this page renders the one
 * `<main>` that holds all four cards (the mockup's specimen 07).
 *
 * `/settings` having no heading of any level is P8's open carry-forward
 * (§10 item 10), and now covers two more cards; recorded, not fixed here.
 */
export const dynamic = "force-dynamic";

/** Containment only: the Google read is bounded by google.ts's own timeouts and the Mongo read by withDeadline. */
export const maxDuration = 30;

/**
 * The stored layers, or "unavailable". readOsSettings, never getOsSettings:
 * the latter is an upsert, and a page view must not be a primary write (R37).
 * buildSettingsCards copies them out by field, so only plain objects cross to
 * the client island.
 */
async function readLayers(): Promise<Layer[] | "unavailable"> {
  try {
    const settings = await withDeadline(
      connectDB().then(() => readOsSettings()),
      MONGO_READ_TIMEOUT_MS,
      "settings read",
    );
    return settings.layers;
  } catch (err) {
    console.error("[settings] layers read failed:", err instanceof Error ? err.message : "unknown error");
    return "unavailable";
  }
}

/** listCalendars()'s one answer. google.ts's messages carry no secret, by design. */
async function readCalendarList(): Promise<CalendarListFeed> {
  try {
    return { ok: true, calendars: await listCalendars() };
  } catch (err) {
    if (err instanceof GoogleError) {
      console.error(`[settings] calendar list failed (${err.kind}):`, err.message);
      return { ok: false, kind: err.kind };
    }
    console.error("[settings] calendar list failed:", err instanceof Error ? err.message : "unknown error");
    return { ok: false, kind: "unknown" };
  }
}

export default async function SettingsPage() {
  const [google, stored] = await Promise.all([readCalendarList(), readLayers()]);
  const cards = buildSettingsCards(google, stored);

  return (
    <main>
      <AgentSwitches />

      <div className="card">
        <p className="meta">Google Calendar</p>
        <p>{cards.connection}</p>
      </div>

      <div className="card">
        <p className="meta">Calendar layers</p>
        {cards.layers.kind === "picker" ? (
          <CalendarPicker
            rows={cards.layers.rows}
            stored={cards.layers.stored}
            limits={{ layers: LAYERS_MAX, name: LAYER_NAME_MAX }}
          />
        ) : (
          <p>{cards.layers.text}</p>
        )}
      </div>
    </main>
  );
}
