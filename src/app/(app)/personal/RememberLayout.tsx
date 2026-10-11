"use client";

import { useEffect } from "react";
import type { ReadonlyPersonalLayout } from "@/lib/personalLayout";
import { LAYOUT_MEMORY_KEY, rememberedLayoutText } from "@/lib/personalLayoutMemory";

/**
 * Writes the server's arrangement to this browser whenever a render changes
 * it, for the loading outline (smooth-feel spec §3.1). The page renders this
 * only when the arrangement was READ (never its fallen-back default), so a
 * settings outage never overwrites a good memory. The effect writes storage
 * and never sets state. Storage that throws leaves nothing remembered, and
 * the outline draws the default.
 */
export default function RememberLayout({ layout }: { layout: ReadonlyPersonalLayout }) {
  const text = rememberedLayoutText(layout);
  useEffect(() => {
    try {
      window.localStorage.setItem(LAYOUT_MEMORY_KEY, text);
    } catch {
      // Nothing remembered: the outline falls back to the default.
    }
  }, [text]);
  return null;
}
