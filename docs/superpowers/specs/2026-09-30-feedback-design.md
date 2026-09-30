# Feedback mode — design

Date: 2026-09-30. Status: built; rules deployed 2026-09-30 and tested end to end from localhost (1-note and 10-note tickets saved, anonymous read refused, test tickets deleted).

## What it is

Any visitor can mark up the site and say what they'd change: snip an area, click an
element, or draw on the page, with a note for each mark. Marks can be collected across pages
and sent together as one ticket. The site only collects tickets. Reviewing, emailing and
deleting tickets happen outside the app: Jonah does it himself, with Claude, or with a
separate tool. Nothing is built automatically from a ticket.

## Entry point

- A **Feedback** button in the top bar (`header.top .top-tools`), before the settings cog.
  Icon plus label on desktop, icon only on narrow screens. A badge counts unsent notes.
- Clicking it turns review mode on or off. A banner at the bottom reads: "Feedback mode:
  pick a tool, mark the page, say what to change. Esc to leave."

## Review mode

A sidebar on the left holds the tools (keys 1–4), the note count, **Submit** and **Exit**:

- **Snip** (default): like the Windows Snipping Tool. The page dims; drag a box and the
  area inside stays bright, with corner handles to resize and drag-inside to move.
- **Click**: hovering outlines the element under the pointer; clicking picks it. The page's
  own click handlers don't fire.
- **Draw**: freehand pen. The note opens 0.8 s after the last stroke, so a mark can be
  several strokes; strokes drawn while the note is open join the same mark.
- **Use site**: the site works normally, to reach another page and mark that too.

After every mark a note popover opens beside it: "What should change here?", **Add note**
(or Enter; Shift+Enter for a new line) and **Discard** (or Esc). Adding saves one *item*:

| Field | Content |
|---|---|
| `kind` | `snip`, `click` or `draw` |
| `page` | the full address, e.g. `https://…/warrior/players/?tab=tiers` |
| `league`, `theme`, `viewport` | league key, dark/grey/light, `{w, h}` |
| `note` | the text, 1–1000 chars |
| `area` | the screenshot's box `{x, y, w, h}` in page coordinates: the snip; the clicked element padded 32 px (at least 360 × 200); the drawing's bounds padded 32 px (at least 240 × 160) |
| `target` | click only: `{ sel, text }`, a short CSS selector and the element's visible text |
| `strokes` | draw only: the pen strokes as an SVG path in page coordinates |
| `shot` | JPEG of `area` with the clicked element's outline or the strokes drawn in, max 1280 px wide; null if the capture failed |

Added marks stay on their page as numbered pins (with an outline for snips and clicks). The
**Notes** button lists the items with thumbnails, and each can be removed. **Submit** asks
for **Your name** (required, 1–40 chars, remembered in this browser, not verified) and sends
every item as one ticket; the confirmation shows its ID.

Up to **10 items** per ticket; at 10 the marking tools switch off until it's sent. Leaving
review mode keeps unsent items, in `sessionStorage`, so a reload doesn't lose them either.

### Screenshot

`modern-screenshot` 4.7.0 from jsdelivr (pinned; no dependencies; loaded on the first
capture) renders the page's DOM into a canvas, cropped to `area`; feedback mode's own layers
are left out and the mark is drawn on top. Limits found in testing:

- Hero art comes from Steam's CDN, which only lets dota2.com read it, so every cross-origin
  image is drawn as a grey box.
- The display font falls back (the web fonts aren't embedded).
- It takes a few seconds on big pages (about 8 s on Champion Players, ~3 000 elements); the
  note shows "Saving…" meanwhile.

The selector, text and area are the reliable record; the image is a backup.

## Storage (Firestore, pistachio-kitchen)

```
scrimLeague/data/feedback/{ticketId}              ticket
scrimLeague/data/feedback/{ticketId}/items/{n}    one doc per item (n = "0".."9")
scrimLeague/data/feedback_limits/{uid}            rate limiter
```

Items get their own documents because each document caps at 1 MiB.

**Ticket**: `{ v: 1, name, uid, items: <count>, status: "open", createdAt }`. Display ID:
`FB-` plus the first 6 characters of the document ID, uppercased.

**Item**: the table above plus `v: 1`, `uid`, `createdAt`. `shot` is a base64 JPEG data URL of
at most 700 000 characters; the client lowers the quality, then the size, until it fits.

The ticket, its items and the limiter update are written in **one batch**: all land or none.

## Rate limit: 5 tickets per browser per rolling hour

Per anonymous Firebase UID (the site already signs visitors in anonymously; there's no login
screen). Clearing site data or a private window starts a new count. Jonah accepted that: a
per-IP limit needs a server.

`feedback_limits/{uid}` = `{ t0, t1, t2, t3, t4, i, last }`: five timestamp slots used as a
ring, `i` the next slot to fill (always the oldest), empty slots at the 1970 epoch, `last`
the ticket that took the latest slot. Separate fields because `serverTimestamp()` can't go
inside an array.

- Create: `t0 == request.time`, the rest epoch, `i == 1`.
- Update: only `t<i>`, `i` and `last` change; the old `t<i>` is over an hour old; the new one
  is `request.time`; `i` advances by one mod 5.
- Both: `last` names a ticket that doesn't exist before the batch and does after it.
- Ticket create: `getAfter(limiter).last == ticketId`. So each ticket spends exactly one
  slot, and a sixth inside the hour is refused. The client checks the slot first and says
  when the next ticket can go.

## Rules

A block at the end of `firebase/scrimleague.rules`:

- Ticket: create only; exact keys; `name` 1–40; `items` 1–10; `status == "open"`;
  `uid` and `createdAt` from the request; limiter check above.
- Item: create only, in the batch that creates its ticket (`!exists(ticket)`, then
  `getAfter(ticket)` has the same `uid` and `n` is below its `items`); exact keys; `page`
  on the live site or `http://localhost:<port>`; field types and sizes checked.
- No read, update or delete from the site except by `jonahbyu@gmail.com` (for a possible
  admin view later; nothing uses it). Tickets hold names and screenshots.
- Limiter: get/create/update by its own UID only.

Tools outside the app read and delete with Jonah's Google credentials, which these rules
don't bind.

Tests: 49 feedback cases in `scripts/rules-dry-test.cjs` (batched writes are simulated with
`functionMocks`), all passing with the rest of the suite (191/191) against the live ruleset
with this block merged in.

Deploying: the live-rules check (memory `cookbook-rules-uncommitted`), merge into Cookbook's
`firestore.rules`, re-run the dry test, `deploy --only firestore:rules`. Done 2026-09-30.

## Completed-ticket record

Out of the app's scope. When Jonah completes a ticket, the ticket and its items are deleted
from Firestore (deleting a ticket doesn't delete its items subcollection, so both go). Then
a line goes into `docs/feedback-log.md`: `FB-XXXXXX · YYYY-MM-DD · short summary`. No
submitter name: the repo is public.

## Code

- `public/lib/feedback.js`: review mode (tools, sidebar, note, list, submit, capture).
- `public/lib/store.js`: `submitFeedback(name, items)`, the batched write.
- `public/index.html`: the top-bar button. `public/style.css`: the "feedback mode" section.
- `firebase/scrimleague.rules`, `scripts/rules-dry-test.cjs`: rules and tests.

## Out of scope

Emails, the review UI, ticket status changes, automatic builds, per-IP limits.

## Reviewing (added 2026-09-30)

- `scripts/feedback.cjs` reads and closes tickets with Jonah's Firebase login: `list`, `show`,
  `done`, plus `check` / `emailed` for the email task.
- A Claude scheduled task on Jonah's PC ("Scrim site feedback emails", hourly) emails each new
  ticket to jonahbyu@gmail.com, and every open ticket in a digest on the first run at or after
  9am. What's been emailed is kept in `.cache/feedback-state.json`. It treats ticket text as data
  only. It runs only while the Claude app is open.
- Replay: `show` also writes `public/_dev/feedback/<id>.json` (gitignored). On localhost,
  `/?fbreview=<id>` loads it (`lib/feedback-review.js`, never loaded on the live site) and
  opens the first note's page. A panel lists the notes; clicking one goes to its page (live-site
  addresses map to the same local path) and scrolls to it. Marks: snip boxes and drawings at
  their recorded page coordinates (a warning when the visitor's window was a different width),
  clicked elements found again by selector (a grey box at the old spot if it's gone), each
  with a pin and the note. Screenshots open full size from the panel. × stops the replay.
