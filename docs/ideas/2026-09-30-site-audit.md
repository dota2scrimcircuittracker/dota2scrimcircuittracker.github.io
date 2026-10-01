# Site audit — 2026-09-30

Measured on the live site and in the code on 2026-09-30.

Status (2026-09-30): speed #1–#4, missing basics #5–#8, navigation #9, #10 (tour and Discord
moved to the footer), #12 and accessibility #13–#16 are built, uncommitted. Still open: #11 (more
footer content) and code organisation #17–#21.

## Missing basics

5. **No favicon.** Every page logs a 404 error in the console for `/favicon.ico`, and browser
   tabs show a blank icon.
6. **No 404 page.** A mistyped or stale link shows GitHub's generic error page. Usual fix on
   GitHub Pages: copy `index.html` to `404.html` at deploy so the app handles the address
   (https://github.com/rafgraph/spa-github-pages).
7. **No image in Discord link previews** (`og:image`). Previews show only title, description and
   colour. Overlaps with the parked Discord highlight-card work (satori + resvg).
8. **No `robots.txt`, sitemap or canonical link.** Only matters if the site should show up in
   Google. Low priority.

## Navigation and layout

9. **Browser tab titles don't name the page.** In the app, Players reads "AD2L S48 Heroic/Aegis ·
   Combined · AD2L Stat Tracker". The preview page has "Players · …", but the router replaces it
   (`document.title` in the router, `public/app.js`).
10. **The header is crowded.** 6 tabs plus search, New here?, League, Feedback, Discord and
    Settings: 12 controls (guideline: 4–7). On a phone, 371 of 812px is controls before the page
    heading. Option: move Discord and Feedback into the footer or settings on small screens.
11. **The footer is almost empty.** Could hold About, feedback, data sources (PlayOn, OpenDota)
    and when the data last synced.
12. **No breadcrumbs on detail pages** (player, team, game sit league › tab › item deep).

## Accessibility

13. **Screen readers don't notice page changes.** Focus stays put on route change and there is
    no live region. Fix: move focus to the new page's heading after each route.
14. **The main tabs don't set `aria-current="page"`.** Week chips and division links do.
15. **No "skip to content" link.** Keyboard users tab through 12 header controls on every page.
16. **Table header cells have no `scope`** (62 on the Players page). Low priority: tables are simple.

## Code organisation

17. **`public/app.js` is ~5,200 lines in ~20 sections** (upload, standings, both prediction
    modes, player, hero, team, tier list pages). Option: one file per page.
18. **Adding a division touches ~8 places** (`DIVISIONS`, sync script, menu link, colour,
    `store.js`, rules, `share-pages.js`, `share.js` regexes). Menu, colours and the `share.js`
    patterns could come from the `DIVISIONS` table.
19. **README is 432 lines** and doubles as user guide, spec and maintenance manual. Option: split
    out a features guide and a maintenance doc.
20. **`scripts/` mixes the regular sync/deploy steps with one-off tools** (`add-auth-domain`,
    `restrict-api-key`, `ocr-probe`, `ocr-wide`, backfills). Option: `scripts/maintenance/`.
21. **CDN scripts load without integrity hashes** (Tesseract and modern-screenshot from jsDelivr,
    Firebase from gstatic). Firebase is pinned to 10.14.1; how the other two are pinned is unchecked.

## Suggested order

Favicon, `404.html`, page names in titles (#5, #6, #9) → preview image (#7) → accessibility
(#13–#15) → split `app.js` and table-driven divisions (#17, #18).
