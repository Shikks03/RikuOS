/**
 * flip.ts — the Briefing's grow/shrink (S21, spec §5.4): an element grows out
 * of the rectangle it came from and shrinks back into it. First-Last-Invert-
 * Play with the Web Animations API, which base.css's reduced-motion rule does
 * not reach, so reduced motion is honoured here: a plain fade, no scaling.
 */

const GROW_MS = 220;
const FADE_MS = 120;
const EASE = "cubic-bezier(.2,.8,.2,1)";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function invert(el: HTMLElement, from: DOMRect): string {
  const to = el.getBoundingClientRect();
  if (to.width === 0 || to.height === 0) return "none";
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const sx = Math.max(from.width / to.width, 0.05);
  const sy = Math.max(from.height / to.height, 0.05);
  return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
}

/** Grows `el` out of `from` (or fades it in when there is no origin). */
export function growFrom(el: HTMLElement, from: DOMRect | null): void {
  if (typeof el.animate !== "function") return;
  if (from === null || prefersReducedMotion()) {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "ease-out" });
    return;
  }
  el.animate([{ transform: invert(el, from), opacity: 0.4 }, { transform: "none", opacity: 1 }], {
    duration: GROW_MS,
    easing: EASE,
  });
}

/** Shrinks `el` into `to` (or fades it out). Resolves when done; never rejects. */
export async function shrinkTo(el: HTMLElement, to: DOMRect | null): Promise<void> {
  if (typeof el.animate !== "function") return;
  const anim =
    to === null || prefersReducedMotion()
      ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: "ease-in", fill: "forwards" })
      : el.animate([{ transform: "none", opacity: 1 }, { transform: invert(el, to), opacity: 0.2 }], {
          duration: GROW_MS,
          easing: EASE,
          fill: "forwards",
        });
  try {
    await anim.finished;
  } catch {
    // cancelled — closing anyway
  }
  anim.cancel();
}
