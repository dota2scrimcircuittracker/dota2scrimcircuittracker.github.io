# Site audit — 2026-09-30

Measured on the live site and in the code on 2026-09-30.

Status (2026-10-01): speed #1–#4, missing basics #5–#8, navigation #9, #10 (tour and Discord
moved to the footer), #12 and accessibility #13–#16 are built and live. Still open: #11 (more
footer content) and code organisation #17–#21, written up for review at the end
("Code organisation: for review").

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

## Suggested order (original)

Favicon, `404.html`, page names in titles (#5, #6, #9) → preview image (#7) → accessibility
(#13–#15) → split `app.js` and table-driven divisions (#17, #18).

## Code organisation: for review

Re-checked against the code on 2026-10-01 (after the vision and GoatCounter commits). None of
these change what visitors see; they make the next change safer or cheaper. Each item ends
with the decisions to make.

**Decided 2026-10-01** (Fav: "do whatever you suggest"):
- 17: split `app.js`, one page per commit; load Upload and both Predict pages on demand, the
  rest up front; leave `style.css` whole.
- 18: one divisions table now, season name included; colours from the table; one
  `npm run sync -- <key>` replaces the per-division npm scripts.
- 19: three files (short README, `docs/features.md`, `docs/maintaining.md`); no player-facing
  "How it works" page for now.
- 20: topic subfolders; keep every script (backfills and setup scripts may be needed again),
  each with a header comment; keep `rules-live-test.js` (its header says how to clean up).
  `feedback.cjs` stays at `scripts/` (a scheduled task calls it by path).
- 21: integrity hashes via an import map for Firebase, Tesseract and modern-screenshot;
  GoatCounter stays off, and turning it on means adding its script with a hash first;
  Tesseract's runtime files left on its defaults.
- 11: footer gets the data sources and when the data last synced.

### 17. Split `public/app.js` (5,454 lines)

**Now:** every page's rendering lives in one file. Sections and sizes:

| Section | Lines | Section | Lines |
|---|---|---|---|
| Upload + review | 609 | Weekly recap | 261 |
| Matches (game page) | 565 | Tier list | 270 |
| Ranks (stat leaders, overall) | 421 | Game analysis (player page) | 214 |
| Teams | 318 | Hero page | 189 |
| Predictions (scrims) | 313 | AD2L standings | 153 |
| Player page | 288 | Leagues (data loading) | 152 |
| Predictions (AD2L) | 233 | Laning | 143 |
| Router + league switcher | ~640 | Leaderboards | 138 |
| Matches + crosstable | 121 | Draft | 103 |
| Combat | 89 | Items | 86 |

**Why it matters:** the tests only cover `lib/`; nothing tests `app.js`, so a slip there shows
up only in the browser (the `<th scope>` quoting bug on 2026-09-30 was one). Smaller files make
each change easier to review and to check.

**Proposal:**
- `public/core.js`: the shared pieces every page uses (`esc`, `fmt`, `pageHead`, `crumbs`,
  `DIVISIONS`/`SOURCES`, the data caches, `teamLink`).
- `public/pages/<page>.js`: one file per page (upload, game, standings, players, player,
  heroes, hero, teams, team, week, predict-ad2l, predict-scrims, tiers).
- `app.js` keeps the router and wiring, about 700 lines.
- Bonus: pages can load on first visit (`import()`), so a visitor who never opens Upload or
  Predict never downloads them (~1,150 lines between them).

**Risk and effort:** large but mechanical. Move one page per commit and click through that page
in the browser after each. A big-bang move is riskier and harder to review.

**Decide:**
- [ ] Do it at all, or leave `app.js` as is?
- [ ] One page per commit over time, or all at once?
- [ ] Load pages on demand, or keep them all loading up front?
- [ ] Also split `style.css` (3,072 lines) the same way, or leave it?

### 18. One table for divisions (and seasons)

**Now:** worse than the audit said. Adding a division touches **about 17 files**:

| Where | What has to change |
|---|---|
| `public/app.js` | `DIVISIONS` entry, `ALL_DIVS` order, a comment list |
| `public/index.html` | league menu link |
| `public/style.css` | ~6 colour rules per league (accent, light-theme accent, menu, brand mark ×3, search chip) |
| `public/lib/share.js` | `LEAGUES` regex |
| `public/lib/store.js` | `COLLECTIONS` entry |
| `scripts/deploy/share-pages.js` | `COLOR`, a `league(...)` line, the "every division" list, the hub description |
| `scripts/gen/gen-og-images.py` | `LEAGUES` entry, then rerun it |
| `scripts/sync/ad2l-sync.js` | usage comment |
| `package.json` | `<division>:sync` script and `sync:all` |
| `.github/workflows/sync.yml` | the division loop |
| `firebase/scrimleague.rules` | `knownColl()` regex and two league lists (3 places) |
| `scripts/rules/rules-dry-test.cjs` | test cases |
| `test/lite.test.js`, `test/share.test.js` | division lists |
| `README.md` | the division's section |

A new **season** (S49) is the same problem: "S48" or a PlayOn season id appears about 80 times
across 14 files (`app.js` 15, `ad2l-sync.js` 12, `share-pages.js` 10, `index.html` 7,
`package.json` 6, ...).

**Proposal:** one file, `public/divisions.json`, holding per division: key, slug, name, short
name, PlayOn season id, menu order, colours (main, dark, light-theme), sub-divisions; plus the
season name once. Then:
- `app.js`, `share.js`, `store.js`, `share-pages.js` and the tests read it, so menu, regexes,
  collections and lists come from it.
- Colours: one CSS block using variables set from the table, instead of ~6 rules per league.
- Sync: `npm run sync -- warrior` (and `sync.yml` loops over the file) replaces the seven
  per-division npm scripts.
- `gen-og-images.py` reads the same JSON.

**What stays by hand:** the Firestore rules. They're deployed from the Cookbook working copy
(shared ruleset), not from this repo, so a new division still needs a rules edit there. The
README section stays by hand too.

**Risk and effort:** medium. Touches routing and share paths, which have tests (`share.test.js`),
and the rules, which don't change.

**Decide:**
- [ ] Do it before the next division or season, or only when one is actually coming?
- [ ] Include the season name (S48 → S49 in one place), or divisions only?
- [ ] Colours from the table (CSS variables set by JS), or keep colours hand-written in CSS?
- [ ] Replace the per-division `npm run <division>:sync` scripts with one `npm run sync -- <key>`?

### 19. Split the README (485 lines)

**Now:** lines 1–323 are one list of 54 feature bullets; then Tier list (46), Uploading (15),
What's read (22), AD2L view (24), Develop (17), Firestore rules (20), Editing and deleting. It
mixes what the site does (for players), how parts work (for you), and how to run and maintain
it (commands, rules, sync).

**Proposal:**
- `README.md`: short. What the site is, the live link, how to run it, links to the rest.
- `docs/features.md`: the feature list, grouped by page (Teams, Weekly, Players, Heroes,
  Predict, Upload, Search, Feedback, Tour), not one long list.
- `docs/maintaining.md`: sync, deploy, Firestore rules, feedback tickets, adding a division or
  season, regenerating item/ability/hero data and preview images.
- `CLAUDE.md` keeps pointing at these.

**Decide:**
- [ ] Split three ways as above, or two (README + maintaining)?
- [ ] Should anything become player-facing on the site (an About or "How it works" page), or
  stay in the repo only? (Ties in with #11, the footer.)

### 20. Sort `scripts/` (32 files)

**Now:** pipeline, tools and one-offs share one folder. By what references them:

| Group | Scripts |
|---|---|
| **Deploy / sync** (workflows, npm) | `ad2l-sync.js`, `share-pages.js`, `lite-data.js`, `write-firebase-config.js`, `discord-updates.cjs` |
| **Sync helpers** (imported by the sync) | `league-json.js`, `combat-fields.js`, `lane-fields.js`, `vision.js` |
| **Regenerate data** (after a patch or change) | `gen-ability-meta.js`, `gen-hero-meta.js`, `gen-item-meta.js`, `gen-og-images.py` |
| **Backfills** (no network, from `.cache`) | `items-backfill.js`, `lanes-backfill.js`, `combat-backfill.js`, `vision-backfill.js`, `buybacks-backfill.js` |
| **Feedback tickets** | `feedback.cjs` |
| **Firestore rules** | `merge-rules.cjs`, `fetch-live-rules.cjs`, `rules-dry-test.cjs`, `rules-live-test.js` |
| **Firebase project setup** (one-off) | `add-auth-domain.cjs`, `restrict-api-key.cjs`, `check-api-key.cjs`, `check-auth-config.cjs` |
| **OCR dev tools** | `ocr-check.js`, `ocr-robustness.js`, `ocr-wide.js`, `ocr-probe.js`, `upload-local.js` |

Eight aren't mentioned anywhere outside their own file: `buybacks-backfill`, `check-api-key`,
`check-auth-config`, `fetch-live-rules`, `rules-live-test`, `upload-local`, `add-auth-domain`,
`ocr-probe`. `check-auth-config.cjs` and `fetch-live-rules.cjs` have no header comment.
`rules-live-test.js` writes a fake match to the live database (its header says how to delete
it).

**Proposal:** subfolders `scripts/sync/`, `scripts/gen/`, `scripts/backfill/`,
`scripts/rules/`, `scripts/firebase/`, `scripts/ocr/`, updating `package.json`, the workflows
and the README paths. Give every script a header comment (what, when, usage).

**Decide:**
- [ ] Subfolders as above, or just `scripts/` + `scripts/maintenance/`?
- [ ] Delete one-offs that are done, or keep them for next time? (Unchecked whether every
  backfill has run on all divisions; the sync writes those fields for new games either way.)
- [ ] Keep `rules-live-test.js`, given it writes to the live database?

### 21. Third-party scripts (integrity)

**Now:** five outside scripts, none with an integrity check:

| Script | From | Pinned? | Loads |
|---|---|---|---|
| Firebase app, auth, firestore | gstatic.com | 10.14.1 | every page |
| Tesseract | jsDelivr | 7.0.0 | first upload |
| Tesseract worker, WASM core, English data | jsDelivr / tessdata CDN | via Tesseract's defaults (unchecked) | first upload |
| modern-screenshot | jsDelivr | 4.7.0 | Feedback mode |
| GoatCounter `count.js` | gc.zgo.at | **no version** | every page once a site code is set (off now) |

These load as ES-module `import`s, which can't carry an `integrity` attribute. Import maps can:
an `integrity` section maps each URL to its hash, and the browser refuses a file that doesn't
match (Chrome 127+, Firefox 138+, Safari 18.4+).

**Risk:** a changed or hijacked CDN file runs with full access to the page, including the
Firebase session. Pinned versions on jsDelivr and gstatic rarely change, so the risk is low;
GoatCounter's unversioned script is the loosest. Integrity has a cost: every version bump needs
new hashes, or that script stops loading.

**Proposal:**
- An import map in `index.html` with hashes for Firebase (3 files), Tesseract and
  modern-screenshot, plus a small script that computes the hashes after a version bump.
- GoatCounter: when turning it on, use a versioned script with an integrity attribute (check
  whether GoatCounter publishes one; unchecked) or host `count.js` in this repo.
- Tesseract's worker, WASM and language files: set their paths explicitly and pin them;
  self-host if integrity is wanted there too (~5 MB).
- Option instead of or as well as hashes: copy the libraries into `public/vendor/` so nothing
  loads from a CDN (bigger repo, no third-party dependency at load time).

**Decide:**
- [ ] Integrity hashes via an import map, self-hosting in `public/vendor/`, or leave as is?
- [ ] GoatCounter: plan to turn it on? If so, versioned with integrity, or self-hosted?
- [ ] Tesseract's runtime files: pin, self-host, or leave?

### Also still open: 11. Footer content

About, data sources (PlayOn, OpenDota), when the data last synced. Ties in with #19's question
about a player-facing "How it works" page.

**Decide:**
- [ ] Which of: data sources, last sync time, About / How it works, Feedback link, privacy
  note (Firebase anonymous sign-in, GoatCounter if turned on)?

### Sources (21)

- [Shopify: shipping module script integrity in Chrome and Safari](https://shopify.engineering/shipping-support-for-module-script-integrity-in-chrome-safari)
- [Chromium: Intent to Ship, import map integrity](https://groups.google.com/a/chromium.org/g/blink-dev/c/mn0sRHwK7Dc)
- [Mozilla standards position: import map integrity](https://github.com/mozilla/standards-positions/issues/1010)
