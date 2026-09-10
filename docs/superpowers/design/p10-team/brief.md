# P10 design team — the brief

**Date:** 2026-09-11 · **Lead:** the main session, which decides, rules and orchestrates and writes no code, CSS, HTML or mockup itself (Riku's instruction, 2026-09-06, extended to P10 on 2026-09-11: *"yes p10 should be built the same way"*).
**Method:** P8's, unchanged. Independent round-1 papers → round-2 responses → a Design Critic → the lead's numbered rulings → a mockup brief → the Mockup Builder → the critic again → rulings → a fix pass → published for Riku → the Spec Editor's visual spec → the Build Planner's plans → batched builds with spec and quality reviewers. All roles are Opus. The P8 files in `docs/superpowers/design/p8-team/` are the exemplars for format and depth.
**HEAD at dispatch:** `3fa055e`. Every claim about the codebase is checked against it, not remembered.

---

## 1. What we are designing

The Personal page, `/personal`. Read both of these in full before anything else — they are the authority on *what* the page is; this team settles *how it looks and how it is built*:

- `docs/superpowers/specs/2026-09-10-p10-personal-page-content.md` — every tile, string and state, the blank render (§12) and the full render (§13)
- `docs/superpowers/specs/2026-09-10-p10-personal-page-design.md` — the fourteen decisions with Riku's answers cited, the data model, the Google integration, failure rules, tests, what needs Riku's hands

Riku shaped this page in a fourteen-question discussion on 2026-09-10. Two things he said unprompted matter more than any answer: he wants *"multiple columns for the content … separated by blocks of features"*, and he specified a **loose weighted bento** with a **personally adjustable layout**. His bento spec is quoted verbatim in the content deck §2 item 7. Treat it as the client's brief: interpret it faithfully, do not improve it.

## 2. What is settled — not up for debate in any round

- **The design system as shipped.** Tokens, faces, the scale, row grammar, disclosure, focus and motion: the P8 visual spec `docs/superpowers/specs/2026-09-07-p8-freelance-page-visual-design.md` §5, drawn from `docs/design/DESIGN-INSPO.md` §2–§3 and `docs/design/components.html`, shipped as `src/styles/tokens.css`, `base.css`, `components.css`. The six semantic hues are a closed set with fixed meanings. Dark only. No new hue, no alias, no new face.
- **The content deck's strings and states.** Every sentence on the page is in the deck. A state the deck has no sentence for is a question for the lead, not a sentence you invent.
- **The design doc's fourteen decisions**, including: six tiles and the default arrangement; the arrangement is editable by Riku and stored on the server; row heights are fixed weights (tall, short, medium, short); edit mode is arrows plus a width stepper, not drag; forms open in place; layers are switches; Personal goes first in the rail.
- **The concept's D1–D11 and the architecture's S1–S17** (`ARCHITECTURE.md` §7). No new agent on this page (S13). Google Calendar is the only place events live (D5).
- **The P8 team's rulings on the system** — `docs/superpowers/design/p8-team/round3-lead-rulings.md` and the system-level parts of `round4-lead-rulings.md` (R1–R46). Do not reopen them; cite them.
- **The 920px column.** Inherited. The design doc's open item 1 lets it be *raised with Riku* if a span-8 hero proves cramped; it does not let this team change it.

## 3. What is open — the team's job

The bento is specified in words and the tiles in strings. Everything between is open:

- **Tile anatomy on the grid.** A tile is a real object (border, radius — the visual spec's row-grammar rule §5.5) sitting exactly on its cells. What is its padding, its header row (eyebrow, heading, control), its inner row grammar? The Freelance blocks' vocabulary (`.fl-head`, `.eyebrow`, `.fl-h`, `.fl-row`, `.tag`, `.btn`, `.fl-empty`, `.fl-note`, `.fl-absent`) is the starting point; what carries over unchanged, what needs a variant, what is genuinely new?
- **Row weights as a visual fact.** Tall, short, medium, short. How does the eye read four rows as weighted rather than as four rows that happen to differ? What are the minimum heights, and what happens when content exceeds them?
- **The empty cell.** One column wide by default. Ground, or something quieter than ground? In edit mode it is a dashed outline; in normal view, what?
- **Hierarchy by size alone.** The hero (Today, span 8, tall row) must read as the hero without a badge or an accent bar. Where does the one permitted hero accent go, and how much of it?
- **Real state in colour.** Overdue rows (`--missing`), a calendar that could not be read (the health strip's treatment of an old reading, `--stale`), and nothing else. Specify exactly where hue lands on a row.
- **New vocabulary this page needs and the system does not have:** a tick box, a switch, a stepper, a text field, a date field, a time field, a select, an in-place form, an edit-mode toolbar, a dashed empty cell. Each is derived from parts the reference already has, or it is argued for from first principles and flagged as new.
- **"Couldn't read" versus empty.** Visually distinct, on every tile, at every span.
- **The push tile.** A notification quoted back to its reader: title line, body, stamp. What face, what size, at span 8 and at span 4?
- **The Layers tile** at span 3 (default) and at span 2 (the narrowest a tile can go).
- **Edit mode.** Obviously a mode. The toolbar (`←→↑↓`, `− 8 +`, the row caption), Save/Cancel/Reset in the header, dashed empty cells, tiles still rendering live data while being moved.
- **Forms in place** without moving the grid — inside the tile that opened them, at any span the tile might have.
- **Collapse.** 12 → 6 → 1 with spans halved rounded up and the row weights held until the stack. Where the 6-column step and the 1-column step fall, and what a span-2 tile becomes at 6 columns.
- **How it lands in the codebase.** One grid component; the server emits each tile's span as a class; a client island wraps the grid for edit mode and moves server-rendered children; islands for ticks, forms, switches; where the page's CSS lives (`components.css` is P8's vocabulary — a page-scoped `personal.css` alongside it, or additions in place, and why); the lint baseline (four `react-hooks/set-state-in-effect` errors, three warnings — a fifth error fails).
- **"Looks finished when blank."** The blank week in deck §12 is what Riku sees on day one. A bento of near-empty tiles has to look deliberate. This is the hardest thing on the list.

## 4. Round 1 — five independent papers

Written **without reading each other's papers**. Each role reads the sources, forms a position, and writes it to its own file in this folder. Aim for 15–30KB: thorough, concrete, bounded. Name classes, tokens, pixel values; cite sources by section (`deck §6`, `visual spec §5.3`, `DESIGN-INSPO §3`, `components.css:372`). Where the reference is silent, say what it would do, built from parts it has.

| Role | File | Standing question |
|---|---|---|
| **Grid Architect** | `round1-grid-architect.md` | Does it stay a bento when Riku rearranges it? Owns the grid, row weights, spans, the empty cell, collapse, and the rule that any legal arrangement must look intentional. |
| **System Keeper** | `round1-system-keeper.md` | Would the reference do this? Owns the mapping from the shipped system to every tile and every new control; guards the hue set and the scale; names what is genuinely new. |
| **Interaction Designer** | `round1-interaction-designer.md` | Can Riku do everything one-handed on the phone and by keyboard on the laptop? Owns ticks, switches, forms in place, edit mode, busy states, focus order, what moves and what must not. |
| **Honesty Critic** | `round1-honesty-critic.md` | Where does this design lie? Owns every empty, missing, unreadable, expired and not-set-up state across six tiles, the forms, the push tile and Settings; the distinction between an empty day and an unread calendar; the blank week looking finished without pretending. |
| **Frontend Architect** | `round1-frontend-architect.md` | What is the cleanest build that survives Academics without a rewrite? Owns the grid component, server-emitted spans, the island boundaries, CSS placement, the editor moving server children, and the lint baseline. |

**Paper format** (P8's): a header with date, role, standing question, sources; `## 1. Position` in a paragraph; numbered sections for the substance; `## Where I expect to disagree` naming the other roles by title; `## Questions for the lead`; `## What I would cut`. Concrete over abstract. A drawing in a code block beats a paragraph.

## 5. Rules for every role in every round

- **No code in `src/` during the design rounds.** Papers, the mockup and the spec are documents.
- Write only your own file. Do not edit the specs, the P8 files, or another role's paper.
- Every claim about the codebase is checked at HEAD `3fa055e` with the Read and Grep tools.
- The product name renders from `APP_NAME`; never write "RikuOS" into a string.
- Plain language in anything that will be quoted to Riku; he asked for no jargon.
- Riku's dev server on port 3000 is never started, stopped or bound.
- `../ShikksTracker` is read-only and its database is never touched.
- Windows paths; the Bash tool strips backslashes from command text and heredocs, so text with backslashes goes through Write and Edit.

## 6. After round 1

- **Round 2:** each role reads the other four papers and writes `round2-<role>.md` — where they now agree, where they still disagree and why, what they concede. Short.
- **Round 2, Design Critic:** an adversarial read of all nine papers against the deck and the design doc, ranked must-fix / should-fix / note, to `round2-design-critic.md`.
- **Round 3:** the lead reads everything and rules, R-numbered, in `round3-lead-rulings.md`, then writes `round3-mockup-brief.md`.
- **Round 4:** the Mockup Builder writes `docs/design/p10-mockup.html` — no JavaScript, the shipped tokens and faces, specimens: **01** the blank week (deck §12, real data), **02** the full week (deck §13), **03** the failure states (Google expired; one layer down; database down), **04** edit mode, **05** the six-column collapse, **06** the two forms open in place, **07** the Settings additions. The Design Critic reviews it; the lead rules; one fix pass; the lead publishes it for Riku.
- **Then** the Spec Editor writes `docs/superpowers/specs/2026-09-11-p10-personal-page-visual-design.md` in the P8 visual spec's shape, and the Build Planner writes the plans.
