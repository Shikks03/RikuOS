import { Suspense } from "react";
import { APP_NAME } from "@/lib/constants";
import { IconMark } from "@/components/icons";
import NavList from "./NavList";
import AgentsBlock, { AgentsSkeleton } from "./AgentsBlock";
import LogoutButton from "./LogoutButton";

/**
 * 170px. Brand tile, wordmark, three nav items, the AGENTS group, and Log out
 * pushed down with margin-top:auto.
 *
 * The brand tile holds the sunburst glyph and NEVER a letterform: the product
 * name may change and a monogram would have to change with it. The wordmark
 * comes from APP_NAME for the same reason.
 *
 * Suspense keeps the agents read off the critical path so the shell and page
 * paint immediately; the try/catch inside AgentsBlock is the actual safety,
 * because an uncaught throw in an async server component bubbles to the
 * nearest error boundary and can blank the route. Both halves are required.
 */
export default function Rail() {
  return (
    <aside className="app-side">
      <div className="app-brand">
        <span className="tile">
          <IconMark />
        </span>
        <span className="wm">{APP_NAME}</span>
      </div>

      <NavList />

      <div>
        <span className="grouplabel">Agents</span>
        <Suspense fallback={<AgentsSkeleton />}>
          <AgentsBlock />
        </Suspense>
      </div>

      <div className="rail-foot">
        <LogoutButton />
      </div>
    </aside>
  );
}
