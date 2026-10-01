# Guided tour for first-time visitors — design

Date: 2026-09-29. Status: approved in chat, implementing.

## What it is

A first-visit prompt that offers a guided tour. The tour moves between real pages. Each stop
darkens the page, draws a gold box around one element, shows a caption card, and (on devices
with a mouse) animates a fake cursor that glides to the element and clicks it.

## Trigger

- Any page, first visit in this browser, about 2 s after the page renders.
- Small card in the bottom corner (not a modal): "First time here? Take the 1-minute tour."
  Buttons: **Start tour**, **Not now**.
- Starting, finishing, skipping or "Not now" sets `localStorage["tour-seen"]`. It never
  auto-shows again in that browser.
- A **Take the tour** link in the footer replays it any time.

## League

The tour runs in the league the visitor is on. Stops that don't exist there (e.g. the
Standings sub-tabs in scrims) are skipped. Heroic/Aegis gets an extra stop on the
Division A/B/Combined switch.

## Core tour (about 7 stops)

1. League switcher: cursor clicks it, menu opens. Tab carries over when switching.
2. Nav tabs: box sweeps the nav.
3. Standings table (AD2L Teams table / scrim Standings), then one ⓘ bubble.
4. Team page (cursor clicks the top team): box on the tab bar ("most pages split into tabs"),
   cursor clicks **Heroes**, box moves to Draft by phase (bans, banned against, picks per
   phase). Scrims have no drafts: the hero pool instead.
5. Weekly: the highlight cards.
6. Players: the tier list.
7. Search: cursor types a few letters; "press / from anywhere". Box is cleared afterwards.
   (Heroic only: the division switch, before search.)

End card: **Show me more** or **Done**. Done returns to the page the tour started on.

## Deep dive ("Show me everything")

About 63 stops in an AD2L division, fewer in scrims. The counter names the page
("Game page · 30 of 63"). It points at what's easy to miss, not at what draws the eye anyway:
no stat cards, standouts, page headers, or pages the core tour already covered.

- Every sub-tab is opened. Each tab's first stop boxes its button together with the section
  worth seeing in it (e.g. Scoreboard → team comparison, Stats → stat ranks).
- Every map view is clicked once per page that has it. Towers only on the game page.
- Filters, at least one per page, worked the way a visitor would:
  - Team: wards by time (0–10'), team fights Net.
  - Game: chart layers (Towers), one player's wards, deaths by time (20–35').
  - Players: tier list cores/supports, stat leaders (pick GPM), lane board (Mid).
  - Player: deaths Radiant/Dire switch; sort a table (GPM).
  - Hero: early deaths (0–10').
- Left out as weak: headline/overview/stat cards, standouts, headers, week picker,
  highlights, By draft pick, the Heroes list page.
- Order: Standings tabs → Weekly (series tabs, a game) → Team → Game → Players → Player →
  Hero → Predict → Tools (time machine, upload).

## Entry points, pause and resume

- First-visit invite (below).
- Footer: **New here?** starts the tour (moved from the top bar 2026-09-30). The card's
  **Pause tour** (or Esc) closes it where it is; the footer button then reads **Resume**. The
  card's **Exit tour** closes it and forgets the place, so it reads **New here?** again. Resume
  goes back to the same stop (same league: same team/game/player/hero; another league: fresh
  picks). Every stop saves its place, so a reload mid-tour also offers Resume.
- Done at the end forgets the place and returns to the starting page.
- Footer **Take the tour** starts over.

## Breadcrumb

Every stop's card shows where the boxed thing is and how to get there by hand, built from the
page: league › top tab › team/game/player/hero › sub-tab › map view (or weekly series).
Example: "Champion › Heroes › Rubick › Stats tab". Header stops read "League menu", "Top bar"
or "Search".

## Rules

- Targets are picked at runtime from live data (top team, first game, first player). A stop
  whose target doesn't appear within a few seconds is skipped.
- Controls: Back / Next / Pause tour, "3 of 7". Esc pauses; → and ← step.
- Phones (no hover / coarse pointer): no fake cursor; a tap ripple on the target; the caption
  card docks to the bottom of the screen.
- All of localStorage is snapshotted when the tour starts and restored when it pauses or
  ends (the tour's own seen and paused flags excepted), so tabs and filters it changes don't
  stick.
- `prefers-reduced-motion`: no cursor glide, box jumps instead of sliding.
- A stop that comes up empty is dropped from the list, so the count stays "n of N" with no gaps.
- The saved choices are also kept in `sessionStorage` (`tour-kept`): a reload mid-tour puts
  them back before the first page renders.
- Scrims have no map or laning data (OCR), so those two deep-dive stops are AD2L-only.
- The ⓘ stop uses a bubble in the standings table, or any bubble on the page when the table
  has none (the phone layout drops them). The box goes around the explanation it opens.
- Tab panels taller than the screen: the box goes around the panel's first block.

## Build

- `public/lib/tour.js`, no dependencies. Stops are data: `{ route, target, caption, click,
  skipIf }`. Navigation uses the site's own in-app link handling (pushState + hashchange);
  the tour waits for its target element to render.
- Overlay: one dimmer made from the gold box's huge `box-shadow`, a caption card, an SVG cursor
  moved with CSS transforms. Styles in `style.css`, using the site's gold and fonts.
- `app.js`: import and start the tour; footer link.
