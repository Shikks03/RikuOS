import Link from "next/link";
import type { ReactNode } from "react";
import type { SayLine } from "@/lib/personalView";

/**
 * The deck's sentences that hand over a lever end `… Settings.` and link to
 * it (deck §6 Tile 1 "links to Settings", Tile 3; the mockup's
 * `<a>Settings</a>`). An in-app link, so no new tab. Shared by every tile
 * that can say one (Layers, Next 7 days), so the rule is spelled once.
 */
export function withSettingsLink(text: string): ReactNode {
  const tail = " Settings.";
  if (!text.endsWith(tail)) return text;
  return (
    <>
      {text.slice(0, -tail.length)} <Link href="/settings">Settings</Link>.
    </>
  );
}

/**
 * One SayLine. A dotted line is a couldn't-read (`.pe-fail`, R10 — `--stale`,
 * or `--missing` for `.is-missing`); a bare one is `.fl-empty`'s measured or
 * configured absence, no dot.
 */
export function SettingsLine({ line }: { line: SayLine }) {
  if (line.dot === null) return <p className="fl-empty">{withSettingsLink(line.text)}</p>;
  return (
    <div className={line.dot === "missing" ? "pe-fail is-missing" : "pe-fail"}>
      <i></i>
      <span className="said">{withSettingsLink(line.text)}</span>
    </div>
  );
}
