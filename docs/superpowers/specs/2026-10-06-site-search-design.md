# Site search: a results page for the whole site

Status: design approved 2026-10-06. Built 2026-10-06 (plan: `docs/superpowers/plans/2026-10-06-site-search.md`).

## Goal

Search works like Google for the site. Type a name, a stat, or a question ("radiant win rate",
"how often does No Immortals win radiant", "pudge ban rate") and get a page of links to the
exact page, tab and section that answer it. The results page links; it does not compute
numbers. A search the site can't place gets an empty-results page.

## Out of scope

- No AI or outside service. Everything runs in the browser from data the site already loads.
- No computed answers on the results page (the linked section shows the number).
- No logging of searches (offered, declined).

## 1. Header search (quick search)

- The pop-up of player and team suggestions stays as it is.
- Nothing is highlighted when the pop-up opens. Enter opens the results page for what's typed.
- Arrow Down / Up highlight a suggestion; Enter then opens that suggestion, as today.
- The pop-up's last row is "See all results for "…" →", which opens the results page.
- An empty box does nothing on Enter.

## 2. Results page

Address: `<league root>/search?q=<query>` (e.g. `#/champion/search?q=radiant+win+rate`; scrims
`#/search?q=…`). The league in the address is the default league for pickers and filters. The
page title is `"<query>" · Search`. Back returns to the page the search started from.

Layout, top to bottom:

1. **Search box** with the query, so it can be edited and searched again in place.
2. **Did you mean** (only when a word was corrected): "Showing results for **radiant win
   rate**. Search instead for "radaint wn rate"" (the second is a link that searches the exact
   words with correction off: `&exact=1`).
3. **Filters**: type chips `All · Teams · Players · Heroes · Pages`, and a league select (All
   leagues, then each division, then Scrims). They update the address (`&type=`, `&in=`) and
   the results without a reload.
4. **Results**, in this order:
   - **Direct links**: a name plus a topic ("No Immortals radiant") → one result per match:
     *No Immortals › Overview › Sides*, the topic's glossary text as the snippet, linking to the
     team page on that tab, scrolled to that section.
   - **Topic cards**: a topic with no name ("radiant win rate") → one card per matched topic,
     with the glossary text and a picker:
     - Scope buttons `League · Team · Player · Hero`, only those the topic exists on.
     - League: a league select (default: the address's league) and a Go link.
     - Team / Player / Hero: a type-to-filter box using the header search's matching (limited to
       the chosen league unless the filter says All). Picking one opens its page at the topic.
     - The type filter presets the scope (Teams → Team).
   - **Names**: teams, players and heroes that match, as the pop-up shows them. Each one lists its
     page's tabs underneath as sitelinks (from `lib/pagetabs.js`).
   - **Pages**: league pages whose name matches (Standings, Weekly, Players, Heroes, Predict,
     Drafter, Upload), with their tabs as sitelinks.
5. **Empty results** when nothing passes the score floor: "Nothing on the site matches "…"", and
   five example searches as links.

At most 5 topic cards, 20 names and all direct links; "Show more" reveals the rest of the names.

## 3. Reading the query

All in a new pure module, `public/lib/sitesearch.js`, so it runs in Node tests.

1. **Normalise**: `fold()` from `lib/search.js` (case, accents), `%` → " percent", strip other
   punctuation except inside names, split into words.
2. **Stop words** dropped: how, often, does, do, did, is, are, the, a, an, what, whats, who, which,
   in, on, at, of, for, to, as, and, or, by, my, their, his, her, its (full list in
   `lib/sitesearch.js`); possessive `'s` is stripped. "win", "vs", "with" and "against" are not
   stop words. Stop words inside a catalog phrase are skipped too, so "head to head" matches.
3. **Names first, longest first**: try every run of 1-4 consecutive words against team, player
   and hero names (and hero shorthand, below). A longer exact match beats a shorter one. Words a
   name claims are not reused for topics.
4. **Topic words**: the remaining words (and two-word phrases) against each topic's `words`.
   A topic scores by how many of its words it matched; a phrase match ("first pick") beats its
   single words.
5. **Typo correction** when a word has no exact match anywhere: compare it with the whole
   vocabulary (names' words, topic words, shorthand) by Damerau-Levenshtein distance (a swap of
   two neighbouring letters is one edit):
   - 3 letters or fewer: no correction.
   - 4-6 letters: at most 1 edit.
   - 7 or more: at most 2 edits.
   - Ties go to the more common target (names in the current league, then topics, then other
     leagues). Exact always beats corrected. Multi-word names are corrected word by word and
     must then match as a run.
   - Any correction triggers the Did-you-mean line. `&exact=1` turns correction off.
6. **Score floor**: a result needs a name match or at least one topic word match. Leftover words
   that matched nothing lower the score; a query where more than half the non-stop words matched
   nothing returns empty. Example: "who's best at the side of the river" → "side" matches but
   "best", "river" don't → empty.

## 4. Topic catalog

New `public/lib/topics.js`: one entry per thing worth linking to.

```js
{ id: "sides", title: "Record by side", key: "team_sides",
  words: ["radiant", "dire", "side", "sides", "rad"],
  at: { team: "overview", player: null, league: null } }
```

- `key`: the glossary entry; its text is the snippet, and the section is found on the page by
  its info button (`[data-info="<key>"]`). Topics without a glossary entry name an element `id`
  instead (`anchor: "side-pick"`), added to that section's heading.
- `at`: per page type (`team`, `player`, `hero`, `league`, `game`), the tab id it lives on.
  League-level entries give a path and tab instead (`{ path: "heroes", tab: "table" }`).
- Shared words (`win`, `win rate`, `wr`, `winrate`, `percent`, `record`) are listed once and
  boost any topic that is a record or rate (`kind: "rate"`).
- Hero shorthand (`am`, `wk`, `sf`, `qop`, `cm`, `ta`, `pl`, `od`, `ss`, `es`, `ns`, `bh`, `nyx`,
  …) in `topics.js` as `HERO_SHORT`, checked against `lib/heroes.js` names by a test.
- Sources for the entries: every `info("…")` call on the team, player, hero, standings, players
  and heroes pages, plus the section headings with no info button (Head to head, Roster, Hero
  pool, Pairs, Lineups, Drafts, Hero grid, Highlights).

## 5. Deep links

- Results link to `<page>?tab=<tab>&at=<key or anchor>`.
- After a page renders, if `at` is in the address: find `[data-info="<at>"]` (its closest stat
  card or `h2`), else `#<at>`; scroll it under the sticky header and flash it once
  (`.search-flash`, 1.2 s, reduced-motion: none). The existing `data-goto-anchor` scroll in
  `pages/teams.js` moves to a shared helper in `core.js` that both use.
- `at` is dropped from the address after the scroll, so a copied link doesn't re-flash. `tab`
  stays.
- If the section isn't on the page (e.g. a team with no drafts), the page opens on the tab
  and nothing scrolls.

## 6. Data loading

The results page uses the header search's loaded index (`loadSearch()` in `app.js`, moved to a
small shared module so the page can await it), plus a hero list from `lib/heroes.js`. First
visit shows "Loading every league…", as the pop-up does. A league that fails to load is left
out, as today.

## 7. Files

| File | Change |
|---|---|
| `public/lib/topics.js` | New: topic catalog and hero shorthand |
| `public/lib/sitesearch.js` | New: normalise, stop words, name runs, typo correction, scoring, results |
| `public/lib/search.js` | Heroes and league pages join the index; `fold` stays exported |
| `public/pages/search.js` | New: the results page, filters, topic-card pickers |
| `public/app.js` | `/search` route; pop-up Enter and "See all results" row; index loader shared |
| `public/core.js` | Shared scroll-to-section + flash helper; reads `at` after render |
| `public/pages/teams.js` | Uses the shared helper; ids on headings without info buttons |
| `public/style.css` | Results page, topic card, sitelinks, flash |
| `docs/features.md` | Search section rewritten |
| `test/sitesearch.test.js` | New |

## 8. Tests

`test/sitesearch.test.js`, over a small fixture index:

- "how often does No Immortals win radiant" → first result is the direct link to No Immortals'
  overview at `team_sides`.
- "radiant win rate" → a topic card for Sides with Team and League scopes, no direct link.
- "radaint win rate" → same result, with the correction reported.
- "No Imortals" → No Immortals (team), corrected.
- "pudge" → the Pudge hero page with its tabs as sitelinks.
- "am ban rate" → Anti-Mage at the hero ban-rate topic.
- "kp" does not correct to "kd" (3 letters, exact only).
- "who's best at the side of the river" and "asdfgh" → empty.
- `&exact=1` behaviour: "radaint" → empty.
- Catalog checks: every `key` exists in the glossary; every `at` tab exists in `lib/pagetabs.js`
  for that page type; every hero shorthand names a real hero; no two topics share an `id`.

Browser check: the pop-up still suggests; Enter opens results; arrowing then Enter opens a
suggestion; a direct link opens the right tab and flashes the section; a topic-card pick lands
on the right page; the empty page; phone width.
