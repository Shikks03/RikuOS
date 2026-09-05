# P9b — The quest board (design)

**Date:** 2026-09-05 · **Status:** ratified design, built after P9 · **Phase:** new, inserted after P9
**Scope:** repo: RikuOS, plus a convention adopted across `C:\Users\Shikks\Projects\Freelance Projects`.
**Not in scope:** anything on the P8 Freelance page · writing back into project folders · non-freelance projects.

**Goal in one line:** a project Riku stops working on stops being forgotten, because the OS shows it as an open quest with a real percentage and a real list of what is left.

---

## Why this exists, in Riku's words

Asked for on 2026-08-29 and carried in `ROADMAP.md`'s Deferred section since: *a page that renders currently-open projects as visible, persistent quests, because a project that stops being worked on currently stops being remembered.* Raised again by Riku unprompted on 2026-09-05, mid-P8 discussion, and specified then.

It was blocked for a year of project-days on one thing — **there was no source of truth for "what projects exist and which are open".** This design settles that, and the answer turned out not to be either candidate the roadmap had recorded.

---

## The source — settled, and it is not what the roadmap guessed

`ROADMAP.md` and the `rikuos-p8-carry-forward` memory both named two candidates: the unparked to-do store (P10), and `Obsidian Projects/` in the Freelance HQ vault. **Riku chose neither.**

**The source is `C:\Users\Shikks\Projects\Freelance Projects` — ongoing freelance projects only, one folder each.**

Two things follow that make this a better foundation than the vault:

1. **It is the working directory, not a record of one.** The Obsidian notes describe projects; this folder *is* them. A note goes stale the moment Riku stops updating it. A project folder is where the work happens, so a status file inside it sits where the work already is.
2. **An agent already works there.** Riku's requirement: *"every project must have a checklist and must be updated by the ai agent that is working on that project."* The checklist is maintained as a side effect of the work, by whoever is doing it, rather than by Riku remembering to write things down. That is the whole reason the tracker was worth building.

**What is in that folder today, checked 2026-09-05:** two entries, both templates — `AzeroTech-Template` and `A3-Lite-Template3-Test-1`. **No live client project yet.** So the board is empty on day one. That is the same honest-but-empty state P8 accepted, and for the same reason: the feed is real, the pipeline just has not started.

### What the Obsidian vault contributes instead

Not the feed, but it should not be discarded. `Obsidian Projects/` holds 23 `type: project` notes with usable frontmatter (`status`, `area`, `engagement_type`, `paid`, `path`, `stack`, `last_commit`) and a `## Next actions` checklist each. It stays what it always was — **a source to draft from, not a feed** — and it is the right place to look when seeding a new project's checklist. Correcting the `freelance-hq-vault` memory on one point: the *dashboard* note is hand-authored markup, but the individual project notes are cleanly structured. That was recorded too pessimistically.

---

## Decisions settled in this session

| # | Decision | Why |
|---|----------|-----|
| D1 | **Source is `Freelance Projects`, ongoing freelance work only.** | Riku's choice, over both candidates the roadmap had recorded. It is where the work is, and where an agent already runs. |
| D2 | **Every project carries a checklist, kept current by the agent working in that project.** Each project's own `CLAUDE.md` gains the rule. | Riku's requirement, verbatim. It is also the only version of this that survives contact with reality — a tracker Riku must update by hand is a tracker that goes stale exactly when he stops working on the project, which is the failure it exists to fix. |
| D3 | **Percentage is ticked ÷ total from that checklist.** | Riku's choice over deriving it from `npm run verify`. It works for any project, template-based or not, and Riku can read the list himself to check the agent is being honest. |
| D4 | **The feed is a push script Riku runs** — `npm run projects:sync` walks the folder, reads each status file, posts them to RikuOS in one request. | Riku's choice. The folder is on his laptop and RikuOS runs on Vercel, so something must carry it. A script keeps the API secret in one place instead of scattering it across every project folder. |
| D5 | **Collapsed shows the percentage; open shows everything.** | Riku's choice, confirmed explicitly. The board reads as a compact list of gauges; tapping one reveals the full checklist, when it was last touched, and where it lives. |
| D6 | **Read-only. RikuOS never writes into a project folder.** | Ticking a box in RikuOS would mean writing to Riku's laptop from Vercel, which is not possible and should not be simulated. Obsidian and the project folders stay the place where things change. |
| D7 | **Built after P9, as its own phase.** | Riku's choice over folding it into P8 or building it before the design system. A quest board built plain and then restyled is the one page where the visual treatment *is* the feature; building it after P9 means building it quest-styled once. |
| D8 | **The board always shows how stale it is.** | It is a synced snapshot, not a live read. The vault's own dashboard note was last reviewed 2026-07-29 while most `last_commit` dates were July — five weeks adrift. A tracker that hides its own staleness is worse than none. |

---

## The convention — the part that lives outside this repo

This is the crux, and it is work in other project folders, not in RikuOS.

**Each project in `Freelance Projects` carries one status file** at its root, with YAML frontmatter and a checklist. Proposed shape, to be finalised when the phase starts:

```markdown
---
project: Sta. Clara Family Clinic
status: active
started: 2026-09-10
updated: 2026-09-12
---

## Checklist
- [x] Brand colours set
- [x] Fonts chosen
- [ ] Services copy
- [ ] Photography
```

**Each project's `CLAUDE.md` gains a rule** telling the agent working there to keep that file current as it completes work. Without this the board rots, and a rotted board is worse than no board — it reports confidently and wrongly, which is the failure mode the `messenger-lane-dropped` and `p7-variant-stats-blind-spot` lessons both circle.

**The templates are the natural place to establish it.** `AzeroTech-Template` already carries `CLAUDE.md`, `FILL-ME.md` (45 numbered questions, each mapping to one field), `BUILD-SPEC.md` with a "Definition of done for any agent", and `npm run verify` that reports what is still missing in plain language. A project copied from the template inherits the convention rather than having it added by hand.

**Not chosen, and worth recording why:** `npm run verify` could produce a percentage no agent can overstate, because it reads the real files. It was rejected as the primary measure (D3) because it only works for template-based builds and says nothing about work outside the fill-in. It remains available as a later cross-check.

---

## Page structure

A page of its own, reached from the Freelance page. **P8 ships no link to it** — a link to a page that does not exist is worse than no link — so the entry point is added by this phase.

**Collapsed** (the default): each project as one row — name, status, percentage, progress bar, ticked/total.

**Open:** the full checklist with ticked and unticked items, when the project was last touched, and its folder path.

Grouping follows status, so a paused project is visible rather than buried: what is being actively worked, and what has stopped. Paused is not a lesser state here — it is precisely the state Riku described as the problem.

---

## Data model

Following CLAUDE.md's Mongo patterns: every string bounded, every closed set an enum, dates as `Date`, no `Schema.Types.Mixed`, `timestamps` declared explicitly.

A `Project` document per project, keyed by a slug derived from the folder name:

- `slug` (unique), `name`, `status` (enum — the closed set to be fixed when the phase starts), `path`
- `checklist`: a **bounded** array of `{ label (maxlength), done (Boolean) }`. Bounded because an unbounded array from an external file is exactly the shapeless drift the no-`Mixed` rule exists to prevent.
- `startedAt`, `lastTouchedAt`, `syncedAt`, `lastSeenAt`

Percentage is **derived at read time**, never stored — a stored percentage and a stored checklist can disagree, and then neither can be trusted.

### Sync semantics — the part that is easy to get wrong

`npm run projects:sync` posts every project it found, in one request, to a secret-gated route.

**A project missing from a sync is flagged, not deleted.** It gets `lastSeenAt` left behind and is shown as "not seen in the last sync" rather than vanishing. A sync run from the wrong directory, or against a folder that failed to mount, would otherwise silently wipe the board — and a tracker that quietly loses projects fails at the one thing it was built for. This is the same instinct as CLAUDE.md's "never leave an in-flight state behind", applied to absence rather than to a pending status.

---

## Failure handling

- The sync route validates at the top, bounds the payload size and the project count, and returns typed JSON errors.
- A malformed status file fails **that project only**, and the board shows it as unreadable with the reason. One bad file must not reject the whole sync.
- The board never renders a stale snapshot as current — D8's staleness stamp is always present, and it warns rather than whispers once the snapshot passes an agreed age.

---

## Testing and acceptance

The status-file parser and the sync's fold-into-existing-state logic are pure functions in `src/lib/`, unit-tested with no database and no filesystem — including the malformed-file case and the missing-project case.

**Done when:** at least one real, ongoing freelance project appears on the board with a percentage that matches its checklist, having been put there by a sync of the real folder — and the trio (`npm test`, `npx tsc --noEmit`, `npm run build`) is green.

**A caveat on that bar, stated plainly:** there is no live client project today. This phase cannot be truly finished — in the sense CLAUDE.md means by "observed doing its job once against real data" — until Riku has one. Building it against the two templates proves the machinery, not the feature.

---

## Non-goals

No writing into project folders. No ticking checkboxes from RikuOS. No automatic sync (D4 chose the script deliberately; direct posting from each project's agent was considered and left for later, once the convention has proven itself). No academic or personal projects — freelance only.

---

## Open items for when this phase starts

1. **Fix the status enum.** The Obsidian notes use twelve free-text values (`active`, `in-progress`, `productizing`, `maintenance`, `paused`, `parked`, `delivered`, `complete`, `superseded`, `discontinued`, `archived`, `needs-review`). The new convention needs a small closed set, and a rule for what an unrecognised value does.
2. **Name the status file**, and decide whether it lives at the project root or inside `.claude/`.
3. **Decide the staleness threshold** at which the board warns rather than merely stating its age.
4. **Revisit direct posting** from each project's agent once a real client project has run through the convention end to end.
