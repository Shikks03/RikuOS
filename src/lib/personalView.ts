/**
 * personalView.ts — the Personal page's view models. Pure: no database, no
 * network, no environment, no Date.now(). Plan B adds the Today, week, to-do,
 * push and layers models; Plan A ships the ramp, because R84 requires the
 * ramp's CSS, the tokens and the design-system footnote to land in one commit
 * and R80 makes the nine classes and this one lookup a single frozen artifact.
 *
 * THE RAMP (R79-R85). `pending` = to-dos due today + to-dos overdue. NOTHING
 * ELSE. Scheduled calendar events never count, however many there are: Riku's
 * word was "task", the page's word for a task is a to-do, and an event is never
 * tickable. An overdue to-do does NOT force the top of the ramp - it is inside
 * the count like any other item (R85, Riku: "No - it just counts as one.").
 *
 * `pending` is a FREE READ, not a new query (R70): it is the row count of the
 * DUE group the hero already renders. `Nothing due.` renders iff pending = 0
 * iff .pe-t0. A failed read renders .pe-fail in the group's place, and then
 * there is no .pe-tN at all.
 *
 * ONE FIELD, never two booleans (R80). PERSONAL_HERO_BUSY_AT is deleted:
 * R73's single-threshold constant is superseded by the anchor table below.
 */

/** Nine states, no tenth. The class is `.pe-t${n}`. */
export type HeroTint = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * The frozen anchor table - green at 0, orange at 3, red at 8 - and the three
 * numbers Riku can change. Changing one is a table edit plus nine regenerated
 * literals in personal.css, not a code change (R80). The two segments are
 * deliberately unequal: the first three items move the colour 1.8x as far as
 * the next five do, measured in OKLab between the deep stops: .0774 from 0 to
 * 3, then .0422 from 3 to 8 (the straight line from 0 to 8 is .1110; the ramp
 * bends through orange) (R79, corrected by R95.1). A day going from nothing
 * to three things has changed more, to Riku, than a day going from four to
 * eight.
 */
export const PERSONAL_HERO_ANCHORS: Readonly<{ save: 0; spend: 3; missing: 8 }> = Object.freeze({
  save: 0,
  spend: 3,
  missing: 8,
});

/**
 * One position on the ramp, or null.
 *
 *   null in  -> null out. The to-do read did not answer, so the page has no
 *              count and the hero claims nothing (R83). This is the ONLY
 *              meaning of the untinted hero.
 *   clamped  -> 9, 40, 1e9 all return 8. A day with fourteen things looks
 *              like a day with eight.
 *   not an integer >= 0 (Infinity included) -> null. Infinity is not a count
 *              a read can produce; null - untinted - is the honest answer.
 *              And even if a bad value escaped, `.pe-t{bad}` matches no rule
 *              and renders the untinted hero, which is the safe render (R80,
 *              on R3's reasoning).
 */
export function heroTint(pending: number | null): HeroTint | null {
  if (pending === null) return null;
  if (!Number.isInteger(pending) || pending < 0) return null;
  return Math.min(pending, PERSONAL_HERO_ANCHORS.missing) as HeroTint;
}
