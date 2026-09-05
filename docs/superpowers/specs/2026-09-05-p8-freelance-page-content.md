# P8 — The Freelance page: complete content

**Date:** 2026-09-05 · **Purpose:** the full content inventory of `/freelance`, written to be handed to a design tool. Every string, every state, with real data.
**Companion to:** `2026-09-05-p8-freelance-page-design.md`, which holds the reasoning. This file holds the words.

---

## 1. What this page is

A personal operations page for one user, Riku. It answers one question: **what is true about my freelance outreach right now.**

It is read-only. Nothing on it sends, drafts, approves or edits — every action links out to ShikksTracker, a separate app where the client records live.

**Mobile-first.** Riku reads this on a phone. Assume a narrow screen first and let it widen; do not design a desktop dashboard and shrink it.

**This is the densest page in the app** and deliberately the first one designed. If a design system survives this page, it survives the rest.

---

## 2. Constraints the design must respect

1. **The product name may change.** It renders from a constant (`APP_NAME`, currently "RikuOS"). Do not build a design that depends on a fixed wordmark, a logo lockup, or a name of a particular length.
2. **Missing data is not zero.** "The engine reported no errors" and "the engine reported nothing" are different findings, and the second one matters more. These need *visually distinct* treatments. A design that renders both as `0` is wrong.
3. **Empty is the normal state right now.** See §3. The page must look deliberate and finished when almost every number is zero or absent — that is what it looks like today, and for a while yet.
4. **But it must not break when full.** §5 gives both a real render and a plausible full render. Design against both.
5. **Every count needs singular and plural forms.** They are specified inline below.
6. **No decorative work that fights the content.** This page is information, not marketing. Density and scanability beat impact.

---

## 3. The real data, measured 2026-09-05

Not illustrative — these are the live values from the API this page reads.

| Reading | Value |
|---|---|
| Contacts, total | 30 |
| Not started | 25 |
| Contacted | 3 |
| Replied | 2 |
| Call booked / Proposal sent / Won / Lost | 0 / 0 / 0 / 0 |
| Hot leads | 2 |
| Drafts waiting in ShikksTracker | **24** |
| Approved but unsent | 0 |
| Campaigns | 2 — "Test One" and "Test number 2" |
| Replies waiting on Riku | 0 |
| Overdue follow-ups | 0 |
| Outreach approaches | 4, all at 0 sends |
| Send engine | ran same-day, 0 errors |

**Why it is empty:** sending is switched off deliberately. Riku approves every message to a business himself, every time. The pipeline is not broken; it has not been started.

---

## 4. Page furniture

**Navigation** — three destinations, this being the second:

```
Queue    Freelance    Settings
```

**Page title:** `Freelance`

**Freshness control:** the page loads fresh every time. A refresh affordance is optional; if present, label it `Refresh`.

---

## 5. The blocks, in order

The page is six stacked blocks. Order is fixed — it was decided with Riku and it encodes what leads.

---

### Block A — State of play

**Job:** the first thing read. Only statements that are live and true. **Each line disappears entirely when it has nothing to say** — it never renders as a zero.

**Lines, in order:**

| Line | Text | Hidden when |
|---|---|---|
| A1 | `24 drafts waiting on you in ShikksTracker` — this line links out | count is 0 |
| A2 | `3 approved, not yet sent` | count is 0 |
| A3 | `25 of 30 contacts never contacted` | not-started is 0 |
| A4 | `Sending is off` — *not built yet, see note* | — |

**Singular forms:** `1 draft waiting on you in ShikksTracker` · `1 approved, not yet sent`

**Missing-data forms** (the API replied but omitted the field — visually distinct from a zero):
- `ShikksTracker didn't report how many drafts are waiting`
- `ShikksTracker didn't report how many contacts there are`

**When every line is hidden** (nothing waiting, everyone contacted) the block shows a single line:
- `Nothing waiting on you.`

**On A4:** the app cannot currently know whether sending is on — the other app holds that fact and does not expose it. The line is designed for but not shipped in the first version. **Design a slot for it**; it will arrive.

**Today this block renders as:**
```
24 drafts waiting on you in ShikksTracker    →
25 of 30 contacts never contacted
```

---

### Block B — Pipeline

**Job:** where every contact stands.

**Heading:** `Pipeline`
**Summary line:** `30 contacts · 2 hot`
**Singular:** `1 contact · 1 hot`

**Stage labels** (only stages holding at least one contact are listed):

| Key | Label |
|---|---|
| `not_started` | Not started |
| `contacted` | Contacted |
| `replied` | Replied |
| `call_booked` | Call booked |
| `proposal_sent` | Proposal sent |
| `won` | Won |
| `lost` | Lost |

**Empty stages collapse into one muted line**, listing them in pipeline order:
- `Nothing yet at call booked, proposal sent, won or lost`
- Two remaining: `Nothing yet at won or lost`
- One remaining: `Nothing yet at lost`
- None remaining: the line is absent

**No contacts at all:** `No contacts yet.`
**Failed to load:** `Couldn't load the pipeline.`

**Today this block renders as:**
```
Pipeline
30 contacts · 2 hot

Not started    25
Contacted       3
Replied         2

Nothing yet at call booked, proposal sent, won or lost
```

**Plausible full render** (invented values, for designing the populated case):
```
Pipeline
486 contacts · 19 hot

Not started   201
Contacted     178
Replied        54
Call booked    23
Proposal sent  16
Won             9
Lost            5
```

---

### Block C — Campaigns

**Job:** how each outreach campaign performed. Collapsed by default; opens in place.

**Collapsed row:** `Campaigns` · `2` · expand affordance
**Singular:** `1`

**Expanded — column headers:** `Sent` · `Opened` · `Clicked` · `Replied`

**Real rows today:**

| Name | Sent | Opened | Clicked | Replied |
|---|---|---|---|---|
| Test One | 5 | 2 | 0 | 2 |
| Test number 2 | 0 | 0 | 0 | 0 |

**Plausible full rows** (invented):

| Name | Sent | Opened | Clicked | Replied |
|---|---|---|---|---|
| September cold — Cebu cafés | 142 | 61 | 14 | 11 |
| August revival — old enquiries | 68 | 40 | 9 | 7 |
| Dental clinics, Metro Manila | 55 | 21 | 3 | 2 |

**Footnote, shown when expanded:**
> Open counts come from tracking pixels and undercount anyone whose mail client blocks images.

**No campaigns:** `No campaigns yet.`
**Bounded list:** `Showing 20 of 34 campaigns.`
**Failed to load:** `Couldn't load campaigns.`

*Note for the designer:* these count **contacts**, not messages — one person who was sent three emails counts once. Sorted by Sent, highest first.

---

### Block D — Approach performance

**Job:** which opening approach actually gets replies. Collapsed by default.

**This block has an unusual and permanent property that the design must carry: half of it can never have a number.** Replies are only ever detected on email. Facebook, Instagram and phone approaches can be *sent* but a reply to one is invisible to the system. Showing those as "0%" would be a lie — it is not a measurement of zero, it is an absence of measurement.

**So the block has two groups, always.**

**Collapsed row:** `Approach performance` · summary · expand affordance

**Today, with no sends at all:**
> `No sends yet — nothing to compare.`

**Expanded, group 1 heading:** `Measured — email`

| Approach | Reply rate | Sends | Replies |
|---|---|---|---|
| Email S1 — specific compliment first | 11% | 72 | 8 |
| Email S1 — pain point first | 6% | 54 | 3 |

**Expanded, group 2 heading:** `Not measurable`

**Group 2 explanatory line, always shown with the group:**
> Replies are only detected on email, so these can't be scored.

| Approach | Reply rate | Sends |
|---|---|---|
| Facebook DM S1 — specific compliment first | — | 31 |
| Facebook DM S1 — pain point first | — | 27 |

**These are the four real approaches that exist today.** There are exactly two of each kind, so the two groups are of equal size — the "not measurable" group is not a footnote, it is half the table.

**No approaches configured:** `No approaches set up.`
**Failed to load:** `Couldn't load approach performance.`

*Depth available but not required in the first version:* each approach also carries a breakdown by lead source and by how much web presence the business already had. Leave room for a third level if it is cheap; do not design around it.

---

### Block E — Needs you

**Job:** the things nothing else is handling. Deliberately **not** everything waiting — replies that already have a drafted follow-up live in the Queue page, and repeating them here would make both lists untrustworthy.

**Heading:** `Needs you` · count
**Singular:** `1`

**Three kinds of row.** Each links out to the contact.

**Kind 1 — a reply on a channel nothing drafts for:**
```
Bella's Cafe                        Instagram
replied 2 days ago
"Sounds good, what would the timeline look like?"
Nothing drafts replies for Instagram.
```

**Kind 2 — a reply with no draft in the queue:**
```
Nova Dental                             Email
replied 4 hours ago
"Do you do logos as well, or just the site?"
No draft in the queue.
```

**Kind 3 — an overdue follow-up:**
```
Kiddo Co
follow-up due 3 days ago
Send the revised proposal
```

**Channel labels:** `Email` · `Facebook` · `Instagram` · `Phone`

**Waiting durations** read as `4 hours ago`, `2 days ago`, `3 weeks ago`. Under an hour: `just now`.

**Nothing waiting:** `Nothing waiting.` — *not* `0`. This is today's state, so it must look intentional rather than like a failure.

**Failed to load:** `Couldn't load what's waiting.`
**Bounded list:** `Showing 20 of 41.`

---

### Block F — Health strip

**Job:** is the machinery still moving. **Silent when all is well.** It is the last thing on the page and should read as a footer, not a panel — until something is wrong, when it must be impossible to miss.

**All well — a single quiet line:**
```
Engine ran 2h ago · all sites ok · checked 6h ago
```

**Engine warnings** — these are the exact strings the system produces:
- `ShikksTracker send engine has never reported a run`
- `ShikksTracker send engine reported an unreadable run time`
- `ShikksTracker send engine last ran 3d ago`
- `ShikksTracker send engine reported 2 errors` · singular: `reported 1 error`
- `3 approved messages are stranded, unsent` · singular: `1 approved message is stranded, unsent`

Ages read as hours below two days (`6h`, `36h`), then days (`3d`, `29d`).

**Site warnings** — three sites are watched: **AzeroTech**, **Meowchi**, **ShikksTracker**.
- `Meowchi returned HTTP 503`
- `Meowchi timed out`
- `Meowchi unreachable`

**Snapshot age:** `checked 6h ago` · never run: `sites never checked`

**Control:** `Check now` → while running: `Checking…`

**Worst case render:**
```
⚠ ShikksTracker send engine last ran 3d ago
⚠ 2 approved messages are stranded, unsent
⚠ Meowchi unreachable
  AzeroTech ok · ShikksTracker ok
  checked 6h ago                    Check now
```

---

## 6. Whole-page states

**Signed out:** the page is not reachable; the app sends Riku to sign in.

**One source down:** every other block renders normally and the affected block says so. A failure in one place must never blank the page.

**All external data down** — the health strip still works, because site results are stored locally:
```
Freelance

Couldn't reach ShikksTracker.
State of play, pipeline, campaigns, approaches and what's
waiting all come from there.

Engine — unknown · Meowchi ok · checked 6h ago
```

**Busy:** only `Check now` has a busy state. Everything else arrives with the page.

---

## 7. Today's page, end to end

The complete real render as of 2026-09-05 — this is what the design must make look finished:

```
Queue    Freelance    Settings

Freelance

24 drafts waiting on you in ShikksTracker    →
25 of 30 contacts never contacted

Pipeline
30 contacts · 2 hot
Not started    25
Contacted       3
Replied         2
Nothing yet at call booked, proposal sent, won or lost

Campaigns                                2  ›

Approach performance                        ›
No sends yet — nothing to compare.

Needs you
Nothing waiting.

Engine ran 2h ago · all sites ok · checked 6h ago
                                     Check now
```

---

## 8. A plausible future page, end to end

Same page, six months of real use. Invented values — for designing the populated case only.

```
Queue    Freelance    Settings

Freelance

6 drafts waiting on you in ShikksTracker     →
2 approved, not yet sent
201 of 486 contacts never contacted

Pipeline
486 contacts · 19 hot
Not started   201
Contacted     178
Replied        54
Call booked    23
Proposal sent  16
Won             9
Lost            5

Campaigns                                3  ›

Approach performance                        ›
Email S1 — specific compliment first     11%

Needs you                                   3
Bella's Cafe                        Instagram
replied 2 days ago
"Sounds good, what would the timeline look like?"
Nothing drafts replies for Instagram.

Nova Dental                             Email
replied 4 hours ago
"Do you do logos as well, or just the site?"
No draft in the queue.

Kiddo Co
follow-up due 3 days ago
Send the revised proposal

Engine ran 2h ago · all sites ok · checked 6h ago
                                     Check now
```

---

## 9. Checklist for whoever designs this

- [ ] Reads well on a phone first
- [ ] Looks finished with §7's near-empty content
- [ ] Does not break with §8's full content
- [ ] "Not reported" is visually distinct from "0"
- [ ] The health strip is quiet when fine and unmissable when not
- [ ] "Not measurable" in Block D reads as a real state, not an error
- [ ] Nothing implies the page can act on a lead — every action leaves for another app
- [ ] The product name is replaceable
