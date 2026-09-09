import { connectDB } from "@/lib/db";
import { MONGO_READ_TIMEOUT_MS, withDeadline } from "@/lib/deadline";
import { DASH } from "@/lib/format";
import { readOsSettings } from "@/lib/osSettings";
import type { OsSettingsValues } from "@/lib/osSettings";
import { RAIL_AGENTS, deriveAgentStatuses, fetchLatestRuns } from "@/lib/watchdog";
import type { AgentBadgeState, AgentStatus, LatestRun } from "@/lib/watchdog";
import type { Agent } from "@/models/AgentRun";

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

/**
 * One badge and its optional caption. All three states of this block — read,
 * loading, failed — render through here, so the rule that a null caption means
 * NO element (not an empty one) is written once. A blank caption line under
 * every green badge would change the rail's rhythm in the state it is in
 * almost all the time.
 */
function BadgeRow({
  agent,
  className,
  caption,
}: {
  agent: Agent;
  className: string;
  caption: string | null;
}) {
  return (
    <span>
      <span className={className}>{agent}</span>
      {caption !== null && <span className="agent-cap">{caption}</span>}
    </span>
  );
}

function Badges({ statuses }: { statuses: AgentStatus[] }) {
  return (
    <div className="agents">
      {statuses.map((status) => (
        <BadgeRow
          key={status.agent}
          agent={status.agent}
          className={BADGE_CLASS[status.state]}
          caption={status.caption}
        />
      ))}
    </div>
  );
}

/** What Suspense shows while the read is in flight: the structure, no claims. */
export function AgentsSkeleton() {
  return (
    <div className="agents">
      {RAIL_AGENTS.map((expectation) => (
        <BadgeRow
          key={expectation.agent}
          agent={expectation.agent}
          className="agent is-grey"
          caption={null}
        />
      ))}
    </div>
  );
}

/** Connect and both reads as one awaitable, so one deadline covers all three. */
async function readRail(): Promise<{ latest: LatestRun[]; settings: OsSettingsValues }> {
  await connectDB();
  const [latest, settings] = await Promise.all([
    fetchLatestRuns(RAIL_AGENTS.map((expectation) => expectation.agent)),
    readOsSettings(),
  ]);
  return { latest, settings };
}

/**
 * `unknown` — six grey badges captioned with an em-dash — is produced HERE and
 * never by deriveAgentStatuses. The pure function never sees a failure, so it
 * can never report one.
 *
 * The settings read sits inside the SAME try/catch as the run records, or a
 * settings failure would grey the badges for the wrong reason.
 *
 * The whole read is bounded at five seconds because it runs on every signed-in
 * page and Mongoose has no per-call timeout: a degraded Atlas would otherwise
 * hold each response open for up to connectDB's 10 s selection plus a 45 s
 * socket. A timeout is the same `unknown` as any other failure.
 */
export default async function AgentsBlock() {
  let statuses: AgentStatus[];

  try {
    const { latest, settings } = await withDeadline(
      readRail(),
      MONGO_READ_TIMEOUT_MS,
      "rail read"
    );
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
          <BadgeRow
            key={expectation.agent}
            agent={expectation.agent}
            className="agent is-grey"
            caption={DASH}
          />
        ))}
      </div>
    );
  }

  return <Badges statuses={statuses} />;
}
