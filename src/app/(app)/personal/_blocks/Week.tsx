import { dayShape, type DayItemView, type DayRowView, type WeekView } from "@/lib/personalView";
import { TileBody, TileFoot, TileHead } from "../LayoutEditor";
import TodoRow from "../TodoRow";
import { SettingsLine } from "./SettingsLine";

export interface WeekProps {
  /** buildWeekView's result, behind the page's one calendar promise (R34). */
  view: Promise<WeekView>;
}

/**
 * One item: `time · title · layer` for an event, tick · title · section for a
 * to-do (TodoRow's week variant — the same island and hidden set as every
 * other to-do row, so a ticked item leaves every tile at once, C11).
 *
 * An event links out to Google (deck §6 Tile 5: "Each event links to Google
 * Calendar"). The mockup's week specimen draws the title as a bare span; the
 * anchor here is the base `a` (the items' own --ink-2 register with the
 * hairline every anchor carries), not `.fl-biz`, whose 600-weight --ink
 * would lift one item out of the day's sentence. An empty href means no
 * anchor (P10b carry-forward). The ROW is not the anchor (P8 R36).
 */
function Item({ item }: { item: DayItemView }) {
  if (item.kind === "todo") {
    return <TodoRow shape="item" tile="week" id={item.id} title={item.title} label={item.layerOrSection} />;
  }
  return (
    <span className="pe-it">
      {item.time !== null && <span className="pe-t">{item.time}</span>}
      {item.href !== null && item.href !== "" ? (
        <a href={item.href} target="_blank" rel="noopener noreferrer">
          {item.title}
        </a>
      ) : (
        <span>{item.title}</span>
      )}
      <span className="pe-l">· {item.layerOrSection}</span>
    </span>
  );
}

/** Every item of a day, in the view's order (all-day, timed by start, then to-dos). */
function Items({ row, items }: { row: DayRowView; items: DayItemView[] }) {
  return (
    <span className="pe-items">
      {items.map((item) => (
        // An event id repeats across days and calendars: the key is all three.
        <Item key={`${row.key}:${item.calendarId}:${item.id}`} item={item} />
      ))}
    </span>
  );
}

/**
 * One day row (R57): the label in its own track, OUTSIDE any disclosure, and
 * the second cell's structure decided by the item count — dayShape's rule,
 * pinned in personalView's tests:
 *   unread      an empty cell: no dash, no items (R18 — `—` is a measurement)
 *   0           `—` in --ink-3 (R19)
 *   1           the item, bare — never a disclosure (R57, R77)
 *   2+          native <details>, CLOSED: no `open` attribute, no data-driven
 *               default (R60–R63). The summary is the leading item's own
 *               title, bare (R58), and `2 items` (deck §15, R90).
 * The shape is decided here at render only; a tick inside an open day does
 * not collapse it until the next refresh (R67).
 */
function Day({ row }: { row: DayRowView }) {
  const shape = dayShape(row);
  let cell;
  switch (shape.kind) {
    case "unread":
      cell = <span></span>;
      break;
    case "dash":
      cell = <span className="pe-dash">—</span>;
      break;
    case "one":
      cell = <Items row={row} items={[shape.item]} />;
      break;
    case "disclosure":
      cell = (
        <details className="disclose">
          <summary>
            <div className="sumrow">
              <span>{shape.summary}</span>
              <span className="fl-count">{shape.count}</span>
            </div>
          </summary>
          <div className="fl-open">
            <Items row={row} items={shape.items} />
          </div>
        </details>
      );
      break;
  }
  return (
    <div className="pe-row is-day">
      <span className="pe-daylbl">{row.label}</span>
      {cell}
    </div>
  );
}

/**
 * Tile 5 — Next 7 days (deck §6 Tile 5, visual spec §4.5). Tomorrow through
 * the seventh day, one row each, in one chronological list at every width:
 * CSS splits it 4 | 3 at 720px of tile and suppresses the fifth row's
 * hairline. Nothing here aligns the paired rows — the slack under a shorter
 * day beside an open one is a true height difference and stays (R94).
 *
 * Failure sentences sit at the TOP of the tile (R16), each as the view gives
 * it: dotted for a couldn't-read, bare for an absence by configuration (`All
 * layers are switched off.`, R45 — the days still render and `—` is a
 * measurement). With both feeds down the view says `days: null` and no day
 * row renders at all (R18, deck §11); the row keeps its weight.
 *
 * The body asks to be remounted when edit mode opens, which is how every open
 * day closes on entry (R62) without an effect, a ref or a DOM query: the
 * <details> are uncontrolled and come back closed.
 */
export default async function Week({ view }: WeekProps) {
  const v = await view;
  return (
    <section className="pe-tile">
      <TileHead tile="week">
        <div>
          <span className="eyebrow">Next 7 days</span>
        </div>
      </TileHead>
      <TileBody resetOnEdit>
        {v.fails.map((line) => (
          <SettingsLine key={`${line.dot}|${line.text}`} line={line} />
        ))}
        {v.days !== null && (
          <div className="pe-week">
            {v.days.map((row) => (
              <Day key={row.key} row={row} />
            ))}
          </div>
        )}
      </TileBody>
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
      <TileHead>
        <div>
          <span className="eyebrow">Next 7 days</span>
        </div>
      </TileHead>
    </section>
  );
}
