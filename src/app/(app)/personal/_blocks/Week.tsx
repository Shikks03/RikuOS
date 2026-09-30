import type { WeekView } from "@/lib/personalView";
import { TileFoot, TileHead } from "../LayoutEditor";

export interface WeekProps {
  /** buildWeekView's result, behind the page's one calendar promise (R34). */
  view: Promise<WeekView>;
}

/** Tile 5 — Next 7 days (deck §6 Tile 5). HEAD ONLY in Task 1; the day rows arrive in Task 5. */
export default async function Week({ view }: WeekProps) {
  await view;
  return (
    <section className="pe-tile">
      <TileHead tile="week">
        <div>
          <span className="eyebrow">Next 7 days</span>
        </div>
      </TileHead>
      <TileFoot tile="week" />
    </section>
  );
}

/**
 * The Suspense fallback (§7.4): border, ground and eyebrow — no day rows,
 * because a day not yet read cannot say `—`.
 */
export function WeekFallback() {
  return (
    <section className="pe-tile">
      <TileHead tile="week">
        <div>
          <span className="eyebrow">Next 7 days</span>
        </div>
      </TileHead>
    </section>
  );
}
