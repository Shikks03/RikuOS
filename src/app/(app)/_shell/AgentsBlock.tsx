import { connectDB } from "@/lib/db";
import { getOsSettings } from "@/lib/osSettings";
import { RAIL_AGENTS, deriveAgentStatuses, fetchLatestRuns } from "@/lib/watchdog";
import type { AgentBadgeState, AgentStatus } from "@/lib/watchdog";

/**
 * Six badges in fixed execution order, read from the last run record per agent
 * plus the two switches in OsSettings.
 *
 * Captions appear on grey, amber and red. Green carries none — the hue is the
 * whole message. No click, no hover, no title tooltip.
 *
 * No polling, no unstable_cache, no revalidate tag: these agents run once a
 * day. On a soft <Link> navigation inside (app) this layout sits above the
 * changed segment and is reused from the client router cache, so the badges
 * can go stale during a long session. That is fine and is not to be "fixed".
 */
const BADGE_CLASS: Record<AgentBadgeState, string> = {
  off: "agent is-grey",
  never: "agent is-grey",
  overdue: "agent is-overdue",
  failed: "agent is-failed",
  ok: "agent is-ok",
};

function Badges({ statuses }: { statuses: AgentStatus[] }) {
  return (
    <div className="agents">
      {statuses.map((status) => (
        <span key={status.agent}>
          <span className={BADGE_CLASS[status.state]}>{status.agent}</span>
          {status.caption !== null && <span className="agent-cap">{status.caption}</span>}
        </span>
      ))}
    </div>
  );
}

/** What Suspense shows while the read is in flight: the structure, no claims. */
export function AgentsSkeleton() {
  return (
    <div className="agents">
      {RAIL_AGENTS.map((expectation) => (
        <span key={expectation.agent}>
          <span className="agent is-grey">{expectation.agent}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * `unknown` — six grey badges captioned with an em-dash — is produced HERE and
 * never by deriveAgentStatuses. The pure function never sees a failure, so it
 * can never report one.
 *
 * The settings read sits inside the SAME try/catch as the run records, or a
 * settings failure would grey the badges for the wrong reason.
 */
export default async function AgentsBlock() {
  let statuses: AgentStatus[];

  try {
    await connectDB();
    const [latest, settings] = await Promise.all([
      fetchLatestRuns(RAIL_AGENTS.map((expectation) => expectation.agent)),
      getOsSettings(),
    ]);
    statuses = deriveAgentStatuses(
      new Date(),
      latest,
      {
        chaserEnabled: settings.chaserEnabled,
        monitoringEnabled: settings.monitoringEnabled,
      },
      RAIL_AGENTS
    );
  } catch {
    return (
      <div className="agents">
        {RAIL_AGENTS.map((expectation) => (
          <span key={expectation.agent}>
            <span className="agent is-grey">{expectation.agent}</span>
            <span className="agent-cap">—</span>
          </span>
        ))}
      </div>
    );
  }

  return <Badges statuses={statuses} />;
}
