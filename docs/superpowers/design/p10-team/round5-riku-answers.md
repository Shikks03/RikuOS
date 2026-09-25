# P10 round 5 — Riku's answers to §K, and the rulings that follow

**Answered 2026-09-24**, against the five-choices page (`docs/design/p10-choices.html`, artifact
`07fee453-1deb-4a84-87ca-dc47562b3a88`), which drew each open call at the size it really renders.
His words are quoted verbatim below each handle. Rulings continue the round-3/round-4 numbering.

Three answers are selections and close their questions outright. Two are **new design** — they ask for
mechanisms nobody drew — and open a short round 5 before the visual spec can be written.

---

## SHELL — answered: **A**

> "A"

**R50. The rail becomes a thin top strip below the phone threshold, app-wide, as a stopgap.**
Option A as drawn in specimen 08: the 170px fixed rail turns into a 44px bar across the top on a narrow
screen and the page takes the full width (334px on a 390px device instead of 164px). Both `+ Event` and
`+ To-do` open at that width; at 164px both are disabled behind `Too narrow for the form.`, which is why
the option exists.

Three things travel with this ruling, all already on record and none of them reopened:

- It is a **shell** change, so it lands on every page, not just Personal. The Freelance page inherits it.
- The coloured worker badges have nowhere to sit in a 44px strip and are **hidden at phone width** until
  the phone design round. That cost was stated in the question and is accepted.
- It is explicitly **provisional**. The later phone pass replaces it and owes nothing to this shape.

Four of five of the design team preferred B (a page phase should not change the shell). Riku chose A with
that disagreement in front of him, in writing, on the page. The lead's recommendation and his answer agree;
the team's lean is overruled by the owner, which is the whole point of putting it to him.

---

## ROW — answered: **A**

> "A"

**R53. A row holding one small tile shrinks to fit it.** `auto` replaces the row's weight in `--tracks`
when the row's only occupant is narrower than the row; in the drawn example row 1 falls from 340px to
131px. This is a **general rule for every arrangement**, not a rule about the push tile — any time the
editor leaves one narrow tile alone in a row, that row shrinks around it.

The content deck's line that a row's height does not depend on what sits in it is **amended** by this
ruling; §I's corrections list gains the entry. No recommendation was on record either way, so nothing is
overruled.

---

## WORDS — answered: **approved as written, with one instruction**

> "Looks good enough for me, just make sure to keep the glowing dot beside it to easily visualize how
> urgent or important it is."

**R54. The eleven sentences, both document edits and both nods ship as written.** No string is held open.
`Up to 10 calendars.` keeps its place as a press outcome under the refused row (R43) though it is drawn
nowhere; the two "(not drawn)" sentences — the push's `Today: no layers switched on.` and the `Saving…`
busy label — ship on the same footing as the nine that are drawn.

**R55. The dotted sentence keeps its dot, and the per-tile render stands.** The closing block offered to
collapse a whole-database outage into one page-level sentence instead of eight tile-level ones. **That
offer is declined.** Every failure sentence keeps the 5px dot with its 6px glow — `.pe-fail i`'s shipped
recipe — in the hue R9 and R10 assign it: `--stale` for a couldn't-read, `--missing` for the one case
that is an absence rather than lateness. The database-down render keeps all nine dots.

This is the honest reading of what he asked for: the dot is how urgency shows at a glance, so the fix for
"nine dots is a lot" is never to take the dots away. R9's four places stay four — this ruling adds no new
one, it refuses to remove any.

---

## TILE — answered: **two columns, and a new mechanism**

> "Two columns. It should show a short title of what needs to be done, but if there are 2 or more tasks
> then it should become a collapsible and be clicked to see all tasks that day."

**R51. Two columns stands** (R4 unchanged): four days left, three right, split at 720px of tile width.
The blank week's row 3 stays 240px against one column's 361px, and the deck's tall/short/medium/short
cadence survives.

**R51b. A day row holding two or more items becomes a disclosure.** This is new and is NOT a selection
between drawn options — nothing in the mockup draws it. It opens round 5 (below).

What is settled by his sentence, and is not for the design round to reopen:

- A day with **one** item shows that item, as today. No disclosure, no click.
- A day with **two or more** shows a **short title** — one line naming what the day holds — and opens to
  the full list on a click.
- The full list, when open, is every item on that day. Not a truncated one; `+3 more` does not survive
  into the open state.

What round 5 must rule, because his sentence does not settle it:

1. **What the short title says** when a day holds three different things. The deck's own rows already
   print a time, a name and a layer; a "short title" for a mixed day is a new string and every candidate
   is a proposed string under the same rule as the eleven.
2. **Where the count goes** — a day with four items must say so before it is opened, or the click is a
   guess. `.fl-count`'s register is the obvious home and the system already has it.
3. **The collapsed day's height**, and therefore whether R51 keeps its 240px. Seven collapsed rows are
   shorter than seven expanded ones; a week where every day holds three things now has two very different
   heights depending on what is open. The 240px in R51 was measured on a **blank** week and survives; the
   busy week's numbers do not, and must be re-measured, not derived.
4. **Whether an open day pushes or overlays.** Pushing changes the row's height while Riku reads it, which
   the editor's stored arrangement does not expect; the grid's rows are weighted, not fixed, so it is legal
   — but it is a ruling, not a detail.
5. **The vocabulary.** The design system already owns a disclosure: `.disclose > summary`, `.sumrow`, its
   chevron and `.fl-count`, shipped and proven on the Freelance page. The day row **uses that grammar** or
   states why it cannot; it does not invent a second disclosure. The strong prior is that it can.
6. **The narrow column.** At 226px and 106px of tile width a summary line, a count and a chevron compete
   for one line. R38's two-line band already exists for exactly this and probably answers it.
7. **The empty day.** `—` (R19) means a day that was read and held nothing. A day with nothing has no
   disclosure and no title; the dash stays. R18's guard is untouched.

---

## MARK — answered: **not one of the four; a tinted hero driven by state**

> "The hero should have a tinted look, however it should depend on what is the status. Should there be a
> lot of task need to be done then orange, and green is all is done or no task is pending."

Confirmed in follow-up, with the cost stated in front of him: **green when clear, orange when busy**, a
new page-local meaning for orange, threshold proposed at four or more due today and not contested.

**R52. The hero is tinted by the state of the day. R8 is overruled.** The ruled treatment — ground
`#171B21`, border lifted to `--ink-4`, feature radius, and no hue — is replaced. Variants (a) through (d)
are all closed; (d)'s blue is not it either. The hero now carries a tint that changes with what the day
holds:

- **nothing pending** → a green tint, in `--save`'s hue
- **a lot pending** → an orange tint, in `--spend`'s hue
- the threshold between them: **four or more items due today**, proposed by the lead and accepted by
  default. Riku may name a different number at any point before the spec is written; it is one constant.

**This costs something real and it is recorded here so nobody rediscovers it as a bug.** The page's rule
was that colour means one fixed thing: `--spend` is money out and the brand mark, `--stale` is late or
unread, `--missing` is overdue, `--save` is fine. Workload was none of them. After this ruling the
Personal page can show three warm hues at once with three meanings: an **orange hero** (a lot on today),
an **amber dot** (something couldn't be read) and **red ink** on a row (that to-do is overdue). Riku was
shown exactly this and chose it. It is his page and his call; it is not relitigated.

Two consequences follow by existing rules, not by new decision, and round 5 draws them:

- **A hero that does not know cannot claim.** If the to-do store did not answer, the page has no count, so
  it has no state — and a green "all clear" tint would be a claim about data nobody read. The untinted
  ground is then the honest render, exactly as R18 prints nothing for a day whose sources did not answer
  and R45 lets `none-enabled` count as answered. The failure sentence and its dot carry the news.
- **`--spend` on the Personal page acquires a second meaning**, and the token's comment in `tokens.css`
  says it means money out. The comment is amended in the same commit as the rule, or the next person to
  read it is misled.

What round 5 must rule:

1. **The two tint recipes.** `--tint-roi` and `--tint-stale` are the system's shipped pattern — 155°, a
   deep desaturated hue into near-neutral at 62% — and the new pair is built to it or states why not.
   They must read as a tint at span 4 (297px) as well as span 8 (609px), and must not fight the hero's
   own border and radius, which survive R52.
2. **Whether the border moves with the tint.** `--tint-roi`'s card lifts its border to the hue at .2
   alpha. The hero's border is `--ink-4` by R8's surviving half; a tinted hero with a neutral border may
   read as unfinished.
3. **The third state.** Between "nothing pending" and "four or more" there is a day with one, two or
   three things on it. It takes the untinted ground, or a step between the two hues — a ruling, and the
   cheaper answer is almost certainly the untinted ground, which also keeps the no-data render from
   needing a fourth appearance.
4. **What "pending" counts.** Due to-dos only, or scheduled events too. His sentence says *task*, and the
   page's word for a task is a to-do; events are not tasks and are not ticked. The strong reading is
   **to-dos due today plus anything overdue**, and it should be written down either way.
5. **Whether the tint survives edit mode.** R44 dims controls and keeps contents; a tint is neither.

---

## What is now closed, and what is open

**Closed:** SHELL (R50), ROW (R53), WORDS (R54, R55), and TILE's column count (R51).
**Open, and the whole content of round 5:** the day-row disclosure (R51b) and the state-driven hero tint
(R52), each with the numbered questions above.

Round 5 is a design round, not a build round: it rules the two mechanisms, draws them into
`docs/design/p10-mockup.html`, and republishes that file to its own artifact
(`b81d7e29-3126-4a20-882a-5bdb982debc3`) — never to a second one. Only then do the Spec Editor and the
Build Planner run.

`docs/design/p10-choices.html` and its artifact are left exactly as they are: they are the record of what
was asked and what was answered, and editing them after the fact would destroy that.
