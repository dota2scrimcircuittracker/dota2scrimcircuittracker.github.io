# Team tables: every team side by side, in site search

Status: draft for approval, 2026-10-06. Not built.

## Goal

The team page shows a lot of numbers for one team at a time: record by side, first blood,
teamfights, Roshan control, game length and more. There's no place to see one of those
numbers for every team at once. The standings table only has the overall win rate.

Site search gets a **team table**: one row per team, a column per stat, sortable. It shows up
in three places, all on the results page:

1. A search that asks for every team ("compare first blood", "radiant win rate all teams",
   "rank teams by roshan") **leads with the table**.
2. A topic card for a team stat ("radiant win rate") gets an **All teams** scope next to
   League and Team. It shows the table inside the card.
3. A **table builder** on the results page: pick the columns, the league and a minimum number
   of games. The table goes in the address, so it can be shared.

No new data. Every number comes from the same functions the team page uses, so the two always
agree.

## Out of scope

- Player and hero tables. Same idea, later; the players and heroes pages already have
  leaderboards.
- A menu entry or page of its own. For now the builder lives on the results page. Moving it
  later is a route plus a link.
- Charts, a CSV export, and stats across seasons.

## 1. Where it shows

All on `pages/search.js`.

### Table first

When the query has a table word (section 4) and no team name, the results start with a
**Team table** block, above the direct links and cards:

- **Title:** "Every team: <the topics' titles>", e.g. "Every team: First blood, Roshan control".
- **The table** (section 3) with the matched topics' columns, sorted by the first one.
- **Links:** "Edit columns", which opens the builder with these columns, and "Copy link".

A table word with no team stat ("compare teams", "team table") opens the builder on its first
preset, Overview.

### All teams scope on topic cards

A topic with team columns (`cols` in `lib/topics.js`, section 4) gets an **All teams** scope
button between League and Team. The scope shows:

- A league select (default: the address's league; All divisions included).
- The table with the topic's columns, plus Games and Win %, sorted by the topic's first
  column.
- An "Edit columns" link to the builder.

The card keeps today's default scope (Team). When the query had a table word, the table
already leads the page, so the card doesn't show it a second time.

### The builder

- **Opening it:** a "Build a team table" link under the filters on every results page, and on
  the empty results page. Both open `search?table=team`, with the topic's columns when there
  is one.
- **With no query:** the page title is "Team table" and the search box is empty.
- **Layout, top to bottom:**
  - **League:** the divisions, All divisions and Scrims. The default is the address's league.
  - **Presets:** chips (section 5), plus the column sets saved in this browser.
  - **Columns:** checkboxes in groups (Results, Sides and draft, Early game, Fights and kills,
    Objectives, Vision and jungle, Game length, Roster). Each shows its glossary text on
    hover.
  - **Minimum games:** a number, default 3.
  - **The table.**
  - **Buttons:** "Save these columns" (named, in this browser), "Copy link", "Reset".
- **Updates:** every change redraws the table in place and updates the address with
  `history.replaceState`, so there's no reload and no extra history steps.

## 2. The address

```
<league root>/search?q=<query>&table=team&cols=radiant_rate,fb_taken&sort=radiant_rate&dir=desc&min=3&league=<league>
```

- **`table=team`** turns the builder on. Without it, the page shows a table only when the
  query asks for one (section 1).
- **`cols`:** column ids (section 3). Unknown ids are dropped; none left means the first
  preset.
- **`sort` and `dir`:** `sort` must be one of `cols`, else the first column that isn't Games.
  The default direction is high → low, or low → high for columns where lower is better
  (Deaths / game).
- **`min`:** minimum games behind a value, 0–50, default 3. Left out of the address at the
  default.
- **`league`:** the table's league: a division key, `all` (All divisions, which adds a
  Division column) or `scrim`. When it isn't set, the address's own league is used.
  - It's separate from the results page's `in` filter. There, "all" means every league for
    names, which is a different thing from one All divisions table.

## 3. The table

### Rows

Every team in the league, as the team list shows them:

- **AD2L:** the division file's teams. Bye-week slots are left out.
- **Scrims:** `listTeams` over the saved scrims.
- **All divisions:** every division's teams, with a Division column.

The first column is the team name, linking to its team page. It's sticky, as in every other
table.

### Columns: `public/lib/teamtable.js` `COLUMNS`

| id | Label | Group | Value | n (games behind it) |
|---|---|---|---|---|
| `games` | Games | Results | games with this team in the league's games | — |
| `win_rate` | Win % | Results | wins / games; AD2L: PlayOn's series scores, as on the team page | games in the record |
| `radiant_rate` | Radiant win % | Sides and draft | `teamSplits` sides.a | games as Radiant |
| `dire_rate` | Dire win % | Sides and draft | `teamSplits` sides.b | games as Dire |
| `fp_rate` | First pick win % | Sides and draft | `teamSideSplit` first | games picking first |
| `sp_rate` | Second pick win % | Sides and draft | `teamSideSplit` second | games picking second |
| `fb_taken` | First blood % | Early game | first bloods taken / games | games with first blood known |
| `fb_win` | Win % after first blood | Early game | wins when they drew it | first bloods taken |
| `lead10`, `lead20` | Gold at 10', 20' | Early game | `teamTimeline` average lead | games with a gold graph |
| `comebacks` | Comebacks | Early game | `teamTimeline` comebacks | — |
| `fight_rate` | Teamfight win % | Fights and kills | fights won / decided | games with fights |
| `kills_for` | Kills / game | Fights and kills | kill score for | games |
| `kills_against` | Deaths / game | Fights and kills | kill score against (lower is better) | games |
| `kill_diff` | Kill diff / game | Fights and kills | for − against | games |
| `rosh` | Roshan control | Objectives | Roshans taken / all Roshans in their games | games with objectives |
| `first_rosh` | First Roshan % | Objectives | first Roshan taken / games with a Roshan | those games |
| `aegis_steals` | Aegis steals | Objectives | `teamSplits` aegis.stole | — |
| `obs`, `dewards`, `stacks` | Observers, Dewards, Stacks / game | Vision and jungle | `teamObjectives` per game | games with replay stats |
| `avg_min` | Avg game (min) | Game length | minutes / games | games |
| `short_rate` | Win % under 30' | Game length | `teamSplits` length[0] | games under 30' |
| `long_rate` | Win % at 45'+ | Game length | `teamSplits` length[2] | games of 45'+ |
| `standin_rate` | Win % with stand-ins | Roster | `teamSplits` standin.with | games with a stand-in |

Each column's header carries the glossary entry the team page uses for it (the info button),
so a header explains itself.

### Cells

- **Text:** the value formatted for its column (62%, 21.4, 3, +4.2, +1.3k). For a rate, the
  wins and losses behind it show on hover ("8–4"), as on the team page.
- **No data:** "—".
- **Too few games:** a value whose n is below the minimum shows greyed, with "only N games"
  on hover. It sorts after every team that meets the minimum, in both directions, and so do
  empty cells.
- **Bars:** rate columns draw the thin bar under the value, as the standings table does.

### Sorting and fitting

- **Sorting:** the shared `sortableTable` (core.js), with three new options that are off for
  every other table:
  - a starting direction (`dir`);
  - empty values last in both directions (`nullsLast`);
  - `onSort(key, dir)`, so the builder can write the sort into the address.
- **Fitting:** `sortableTable` already pages columns on narrow screens, so wide tables work
  on a phone.

## 4. Search words: `lib/topics.js`

### Topic columns

Each topic with a team scope lists its team table columns as `cols`:

| Topic | Columns |
|---|---|
| record | games, win_rate |
| sides | radiant_rate, dire_rate |
| side_pick | fp_rate, sp_rate |
| first_blood | fb_taken, fb_win |
| teamfights | fight_rate |
| standins | standin_rate |
| aegis | aegis_steals |
| length | avg_min, short_rate, long_rate |
| kills | kills_for, kills_against, kill_diff |
| gold_lead | lead10, lead20, comebacks |
| roshan | rosh, first_rosh |
| wards | obs, dewards |
| stacks, dewards | stacks; dewards |

### Table words

`TABLE_WORDS`, matched as phrases like topic words: table, tables, compare, comparison, all
teams, every team, each team, by team, per team, rank, ranked, ranking, rankings, league wide.

- They're set aside before topics are scored, the way rate words are, so they never count as
  unmatched words.
- They're added to the spelling vocabulary, so "compair" corrects to "compare".
- "best", "worst", "most" and "top" are **not** table words. They already mean other things
  ("most banned", stat leaders).

### What `siteSearch` returns

A new `table` field:

- **With a table word and no team name:** `{ cols, sort }`. `cols` is the matched topics'
  columns in order, with duplicates removed. If no matched topic has columns, it's the first
  preset's columns.
- **Otherwise:** `null`.
- **Empty results:** a table result is never empty.
- **Cards:** a card's `scopes` gains `"teams"` (between `"league"` and `"team"`) when its topic
  has `cols` and a team scope.

## 5. Presets and saved sets

### Presets

`PRESETS` in `lib/teamtable.js`:

| Preset | Columns |
|---|---|
| Overview | Games, Win %, Kill diff, Avg game, Teamfight win % |
| Sides and draft | Win %, Radiant, Dire, First pick, Second pick win % |
| Early game | Win %, First blood %, Win % after first blood, Gold at 10', Gold at 20' |
| Fights | Win %, Teamfight win %, Kills, Deaths, Kill diff / game |
| Objectives | Win %, Roshan control, First Roshan %, Aegis steals |
| Vision and jungle | Win %, Observers, Dewards, Stacks / game |
| Game length | Win %, Avg game, under 30', 45'+, Comebacks |

### Saved sets

"Save these columns" asks for a name and stores `{ name, cols }` in `localStorage`
(`team-table-sets`). Saved sets show as chips after the presets, each with a ✕ to delete it.
If storage is blocked, a message says so, the same as hero grid templates.

## 6. Data and speed

- **Loading:** the table loads the chosen league's games with `SOURCES[key].load()`, the same
  list the team page reads, uploaded scrim games included. AD2L also loads `data()` for the
  teams and series. The block shows "Loading <league>'s games…" until it's ready.
- **Records:** PlayOn records move from inline code in `pages/teams.js` to
  `seriesRecords(series)` in `lib/teams.js`. The team page and the table both call it.
- **Speed:** each team's aggregates are computed once per league per visit, and kept by the
  games array. About 40 ms for Champion's 10 teams (measured on the synced file). All
  divisions is about 70 teams.
- **Lazy:** nothing loads until a table is on screen. A results page with no table loads only
  the search index, as today.

## 7. Files

| File | Change |
|---|---|
| `public/lib/teamtable.js` | New: columns, presets, aggregates, rows, cell text, address state |
| `public/lib/teams.js` | `seriesRecords(series)` |
| `public/lib/topics.js` | `cols` on team topics; `TABLE_WORDS` |
| `public/lib/sitesearch.js` | Table words; `table` result; `"teams"` scope |
| `public/core.js` | `sortableTable` options: `dir`, `nullsLast`, `onSort` |
| `public/parts/teamtable.js` | New: load a league's teams, draw the table, the builder |
| `public/pages/search.js` | Table-first block, All teams scope, builder, `table=` address |
| `public/pages/teams.js` | Use `seriesRecords` |
| `public/style.css` | Builder, column picker, greyed cells |
| `docs/features.md` | Search section: team tables |
| `test/teamtable.test.js` | New |
| `test/sitesearch.test.js` | Table words, scopes, topic columns |

## 8. Tests

`test/teamtable.test.js`, over a three-team fixture:

- **Catalog:** unique ids, real groups, glossary keys that exist, presets that name real
  columns.
- **Values:** Radiant and Dire win % split by side, kills and diff per game, average length,
  first and second pick win %, and empty values when there's no data.
- **Record override:** a PlayOn record replaces the games' own (9–3 → 75%).
- **Cell text:** every format.
- **Address:** a round trip; unknown and duplicate columns dropped; lower-is-better columns
  sort low first; `min` left out at its default.
- **`seriesRecords`:** sums series scores per team.

`test/sitesearch.test.js` additions:

- Every topic's `cols` are real columns.
- "compare first blood and roshan" → a table of fb_taken, fb_win, rosh, first_rosh, sorted by
  fb_taken.
- "radiant win rate all teams" → a table of radiant_rate and dire_rate.
- "team table" → the default columns.
- "radiant win rate" → no table, and the card's scopes are league, teams, team.
- "compare No Immortals radiant" → no table (one team: the direct link).

### Browser checks

1. "compare first blood" on Champion leads with the table. Sorting by a column updates
   `&sort=`.
2. "radiant win rate" → the card's All teams scope shows every Champion team, and switching
   the league to Warrior shows Warrior's.
3. The builder: tick and untick columns, apply a preset, save a set and see it after a reload,
   raise the minimum games and watch low-sample cells grey and drop to the bottom, copy the
   link and open it in a new tab to get the same table.
4. All divisions adds the Division column. Scrims has no PlayOn record and works from its
   games.
5. At phone width, the columns page and nothing scrolls sideways. No console errors.

## Open questions

- Should the builder later get its own page and menu entry ("Tables")? The address already
  carries everything, so it's a route and a link.
- Players next, with KDA, GPM, KP, stacks, dewards and laning per player? Then heroes?
