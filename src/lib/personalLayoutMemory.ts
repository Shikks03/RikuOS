/**
 * personalLayoutMemory.ts — the Personal page's last arrangement as this
 * browser remembers it, so the page's loading outline can draw the right
 * grid before the server has answered (smooth-feel spec §3.1). A per-device
 * convenience, never the record: the server's arrangement wins the moment
 * the page lands, so a stale or missing copy costs one layout shift.
 *
 * Pure; the localStorage calls live in RememberLayout and PersonalOutline,
 * wrapped in try/catch there (storage can throw in private mode or with
 * blocked site data). Read TOTAL through resolvePersonalLayout — the same
 * rule as the stored layout's read path — so anything unreadable is the
 * default and a retired tile is dropped, never a throw.
 */
import {
  PERSONAL_LAYOUT_DEFAULT,
  resolvePersonalLayout,
  type ReadonlyPersonalLayout,
} from "@/lib/personalLayout";

export const LAYOUT_MEMORY_KEY = "personal-layout:v1";

/** Only tile and span, so nothing else a layout object carries is ever written. */
export function rememberedLayoutText(layout: ReadonlyPersonalLayout): string {
  return JSON.stringify(layout.map((row) => row.map((e) => ({ tile: e.tile, span: e.span }))));
}

export function layoutFromMemory(raw: string | null): ReadonlyPersonalLayout {
  if (raw === null) return PERSONAL_LAYOUT_DEFAULT;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return PERSONAL_LAYOUT_DEFAULT;
  }
  return resolvePersonalLayout(parsed).layout;
}
