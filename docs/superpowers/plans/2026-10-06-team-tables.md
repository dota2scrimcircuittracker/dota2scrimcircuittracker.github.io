# Team Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every team side by side on the site search results page: a team table that leads the results when a query asks for every team ("compare first blood"), an **All teams** scope on team-stat topic cards, and a table builder (columns, presets, minimum games, league, saved sets) whose state lives in the address.

**Architecture:** A pure module (`lib/teamtable.js`) turns a league's games into one row per team with a cell per column, reusing the team page's own functions (`teamSplits`, `teamTimeline`, `teamObjectives`, `teamSideSplit`) so the numbers can't disagree. `lib/topics.js` maps each team topic to its columns and lists table words; `lib/sitesearch.js` returns a `table` result. `parts/teamtable.js` loads a league and draws the table (the shared `sortableTable`) and the builder; `pages/search.js` places them.

**Tech Stack:** Vanilla ES modules, `node --test`, no build step. Spec: `docs/superpowers/specs/2026-10-06-team-tables-design.md`.

**Already proven:** the code in Tasks 1-3 (`seriesRecords`, `lib/teamtable.js` and its tests, the `topics.js` and `sitesearch.js` changes and their tests) was run in a scratch copy of the repo before this plan was written: all 20 tests in `test/sitesearch.test.js` and `test/teamtable.test.js` passed, the 13 existing search tests included, and `teamTable` took about 40 ms for Champion's synced file. Tasks 4-7 (the table component, builder and page) are written but not yet run; their browser checks are in Task 8.

**Git:** commit each task on the working branch. Never push to `main` (a push to `main` deploys and posts to the public Discord); pushing the feature branch is fine.

---

## File map

| File | Responsibility |
|---|---|
| `public/lib/teams.js` | `seriesRecords(series)`: AD2L records from PlayOn's series scores |
| `public/pages/teams.js` | Uses `seriesRecords` instead of its inline loop |
| `public/lib/teamtable.js` (new) | `COLUMNS`, `GROUPS`, `PRESETS`, `teamAggregates`, `teamTable`, `cellText`, `parseTable`, `tableParams` |
| `public/lib/topics.js` | `cols` on team topics; `TABLE_WORDS` |
| `public/lib/sitesearch.js` | Table words set aside; `table` result; `"teams"` scope |
| `public/core.js` | `sortableTable` options `dir`, `nullsLast`, `onSort` |
| `public/parts/teamtable.js` (new) | `leagueTeams`, `drawTeamTable`, `builderHtml`, `wireBuilder`, saved sets |
| `public/pages/search.js` | Table-first block, All teams scope, builder, `table=` / `league=` address |
| `public/style.css` | Builder, column picker, greyed cells |
| `docs/features.md` | Search section |
| `test/teamtable.test.js` (new), `test/sitesearch.test.js` | Tests |

---

### Task 1: PlayOn records in one place

**Files:** Modify `public/lib/teams.js`, `public/pages/teams.js`

- [ ] **Step 1: Add `seriesRecords`** at the end of `public/lib/teams.js`:

```js
// AD2L records from PlayOn's series scores (official; complete even when a game's stats
// couldn't be found): team id -> { wins, losses, games }, in games.
export function seriesRecords(series) {
  const out = new Map();
  for (const s of series) for (const [id, us, them] of [[s.home, s.home_score, s.away_score], [s.away, s.away_score, s.home_score]]) {
    if (id == null) continue;
    const r = out.get(id) ?? out.set(id, { wins: 0, losses: 0, games: 0 }).get(id);
    r.wins += us ?? 0; r.losses += them ?? 0; r.games = r.wins + r.losses;
  }
  return out;
}
```

- [ ] **Step 2: Use it in `pages/teams.js`.** Add `seriesRecords` to the `../lib/teams.js` import, then replace the loop in `renderTeams`:

```js
    teams = teams.map((t) => {
      let wins = 0, losses = 0;
      for (const s of ad2l.series.filter((x) => x.home === t.id || x.away === t.id)) {
        const [us, them] = s.home === t.id ? [s.home_score, s.away_score] : [s.away_score, s.home_score];
        wins += us ?? 0; losses += them ?? 0;
      }
      return { ...t, wins, losses, games: wins + losses };
    }).sort(
```

with

```js
    const recs = seriesRecords(ad2l.series);
    teams = teams.map((t) => ({ ...t, ...(recs.get(t.id) ?? { wins: 0, losses: 0, games: 0 }) })).sort(
```

- [ ] **Step 3: Check** `npm test` passes, then open `#/champion/teams/15026`: the header still says 9–3 (No Immortals, Champion).

- [ ] **Step 4: Commit** `git add public/lib/teams.js public/pages/teams.js && git commit -m "PlayOn records: one helper for the team page and tables"`

---

### Task 2: Columns, rows, cell text and the address (`lib/teamtable.js`)

**Files:** Create `public/lib/teamtable.js`, `test/teamtable.test.js`

- [ ] **Step 1: Write the tests** — `test/teamtable.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { COLUMNS, COLUMN, PRESETS, GROUPS, teamTable, cellText, parseTable, tableParams, MIN_DEFAULT } from "../public/lib/teamtable.js";
import { INFO } from "../public/lib/glossary.js";

// Three teams; A beats B twice (once each side), B beats C, C beats A. A drafts first pick in
// its first game.
const g = (id, a, b, winner, sa, sb, min, extra = {}) => ({ id, team_a: a.name, team_b: b.name, team_a_id: a.id, team_b_id: b.id,
  winner, score_a: sa, score_b: sb, duration_sec: min * 60, createdAt: new Date(2026, 9, id), ...extra });
const A = { key: "id:1", id: 1, name: "Alpha" }, B = { key: "id:2", id: 2, name: "Bravo" }, C = { key: "id:3", id: 3, name: "Charlie" };
const games = [
  g(1, A, B, "a", 30, 10, 25, { draft: [{ order: 1, side: "a", pick: true, hero: "Pudge" }] }),
  g(2, B, A, "b", 12, 28, 40),
  g(3, B, C, "a", 20, 15, 50),
  g(4, C, A, "a", 25, 22, 35),
];
const rows = teamTable(games, [A, B, C]);
const of = (t) => rows.find((r) => r.team === t).cells;

test("column catalog: unique ids, real groups, glossary headers, presets of real columns", () => {
  assert.equal(new Set(COLUMNS.map((c) => c.id)).size, COLUMNS.length);
  const groups = new Set(GROUPS.map(([id]) => id));
  for (const c of COLUMNS) {
    assert.ok(groups.has(c.group), `${c.id}: group ${c.group}`);
    assert.ok(c.key === false || INFO[c.key], `${c.id}: no glossary entry "${c.key}"`);
    assert.ok(["pct", "dec", "int", "signed", "gold"].includes(c.fmt), `${c.id}: fmt ${c.fmt}`);
  }
  for (const p of PRESETS) for (const id of p.cols) assert.ok(COLUMN[id], `${p.id}: ${id}`);
});

test("values come from each team's own games", () => {
  const a = of(A);
  assert.deepEqual([a.games.v, a.win_rate.v, a.win_rate.of], [3, 2 / 3, "2–1"]);
  assert.deepEqual([a.radiant_rate.v, a.radiant_rate.n, a.dire_rate.v, a.dire_rate.n], [1, 1, 0.5, 2]); // Radiant (team A) in g1, won; Dire in g2 (won) and g4 (lost)
  assert.equal(a.kills_for.v, (30 + 28 + 22) / 3);
  assert.equal(a.kill_diff.v, ((30 - 10) + (28 - 12) + (22 - 25)) / 3);
  assert.equal(a.avg_min.v, (25 + 40 + 35) / 3);
  assert.deepEqual([a.fp_rate.v, a.fp_rate.n], [1, 1]);
  assert.equal(a.sp_rate, null); // no game where A picked second with a draft
  assert.equal(of(B).fp_rate, null);
  assert.deepEqual([of(B).sp_rate.v, of(B).sp_rate.n], [0, 1]);
  assert.equal(a.fight_rate, null); // no fight data
  assert.equal(a.aegis_steals.v, 0);
});

test("a record override (PlayOn's) replaces the games' own", () => {
  const r = teamTable(games, [A], { records: new Map([["id:1", { wins: 9, losses: 3 }]]) });
  assert.deepEqual([r[0].cells.win_rate.v, r[0].cells.win_rate.of, r[0].cells.games.v], [0.75, "9–3", 3]);
});

test("cell text", () => {
  assert.deepEqual([cellText("pct", 0.623), cellText("dec", 21.44), cellText("int", 3), cellText("signed", 4.25), cellText("signed", -1), cellText("gold", 1320), cellText("gold", -640), cellText("pct", null)],
    ["62%", "21.4", "3", "+4.3", "−1.0", "+1.3k", "−640", "—"]);
});

test("the address round-trips, unknown columns drop, lower-is-better sorts low first", () => {
  assert.equal(parseTable(new URLSearchParams("q=x")), null);
  const st = parseTable(new URLSearchParams("table=team&cols=radiant_rate,nope,fb_taken,radiant_rate&min=5"));
  assert.deepEqual(st, { cols: ["radiant_rate", "fb_taken"], sort: "radiant_rate", dir: "desc", min: 5 });
  assert.deepEqual(parseTable(tableParams(st)), st);
  assert.deepEqual(parseTable(new URLSearchParams("table=team")).cols, PRESETS[0].cols);
  assert.equal(parseTable(new URLSearchParams("table=team")).min, MIN_DEFAULT);
  assert.equal(parseTable(new URLSearchParams("table=team&cols=kills_against")).dir, "asc");
  assert.equal(tableParams({ ...st, min: MIN_DEFAULT }).has("min"), false);
});

import { seriesRecords } from "../public/lib/teams.js";

test("seriesRecords sums each team's series scores", () => {
  const r = seriesRecords([{ home: 1, away: 2, home_score: 2, away_score: 0 }, { home: 3, away: 1, home_score: 1, away_score: 1 }, { home: 2, away: 3, home_score: null, away_score: null }]);
  assert.deepEqual(r.get(1), { wins: 3, losses: 1, games: 4 });
  assert.deepEqual(r.get(2), { wins: 0, losses: 2, games: 2 });
  assert.deepEqual(r.get(3), { wins: 1, losses: 1, games: 2 });
});
```

- [ ] **Step 2: Run to see them fail** — `node --test test/teamtable.test.js` → `Cannot find module '…/public/lib/teamtable.js'`.

- [ ] **Step 3: Write the module** — `public/lib/teamtable.js`:

```js
// Team tables (site search's table builder, pages/search.js): one row per team, a column per
// stat the team page shows for one team at a time. Pure, so the tests read it. Values come from
// the same functions as the team page (lib/combat.js teamSplits, lib/timeline.js, lib/draft.js),
// so the two can't disagree. Spec: docs/superpowers/specs/2026-10-06-team-tables-design.md.
import { sideOf, record } from "./teams.js";
import { teamSplits } from "./combat.js";
import { teamTimeline, teamObjectives } from "./timeline.js";
import { teamSideSplit } from "./draft.js";

// A cell: { v: number, n: games behind it (null = a count, no sample), of: "8–4" or null }.
const cell = (v, n = null, of = null) => (v == null || !Number.isFinite(v) ? null : { v, n, of });
const winRate = (games, wins) => (games ? cell(wins / games, games, `${wins}–${games - wins}`) : null);
const share = (a, b, n) => (a + b ? cell(a / (a + b), n, `${a}–${b}`) : null);
const perGame = (sum, games) => (games ? cell(sum / games, games) : null);

export const GROUPS = [["results", "Results"], ["sides", "Sides and draft"], ["early", "Early game"], ["fights", "Fights and kills"],
  ["objectives", "Objectives"], ["vision", "Vision and jungle"], ["length", "Game length"], ["roster", "Roster"]];

// Every column: id (the address and topics use it), label, group, fmt (pct, dec, int, signed,
// gold), the glossary key for its header, low: true when lower is better (sorted low → high
// first), and get(a) from one team's aggregates (teamAggregates).
export const COLUMNS = [
  { id: "games", label: "Games", group: "results", fmt: "int", key: false, get: (a) => cell(a.games) },
  { id: "win_rate", label: "Win %", group: "results", fmt: "pct", key: "game_rate", get: (a) => winRate(a.rec.games, a.rec.wins) },
  { id: "radiant_rate", label: "Radiant win %", group: "sides", fmt: "pct", key: "team_sides", get: (a) => winRate(a.sp.sides.a.games, a.sp.sides.a.wins) },
  { id: "dire_rate", label: "Dire win %", group: "sides", fmt: "pct", key: "team_sides", get: (a) => winRate(a.sp.sides.b.games, a.sp.sides.b.wins) },
  { id: "fp_rate", label: "First pick win %", group: "sides", fmt: "pct", key: "team_side_pick", get: (a) => winRate(a.ss.first.n, a.ss.first.wins) },
  { id: "sp_rate", label: "Second pick win %", group: "sides", fmt: "pct", key: "team_side_pick", get: (a) => winRate(a.ss.second.n, a.ss.second.wins) },
  { id: "fb_taken", label: "First blood %", group: "early", fmt: "pct", key: "team_first_blood", get: (a) => share(a.sp.first_blood.taken, a.sp.first_blood.games - a.sp.first_blood.taken, a.sp.first_blood.games) },
  { id: "fb_win", label: "Win % after first blood", group: "early", fmt: "pct", key: "team_first_blood", get: (a) => winRate(a.sp.first_blood.taken, a.sp.first_blood.wins_taken) },
  { id: "lead10", label: "Gold at 10'", group: "early", fmt: "gold", key: "lead10", get: (a) => cell(a.tl?.lead10, a.tl?.games) },
  { id: "lead20", label: "Gold at 20'", group: "early", fmt: "gold", key: "lead20", get: (a) => cell(a.tl?.lead20, a.tl?.games) },
  { id: "comebacks", label: "Comebacks", group: "early", fmt: "int", key: "comebacks", get: (a) => cell(a.tl?.comebacks) },
  { id: "fight_rate", label: "Teamfight win %", group: "fights", fmt: "pct", key: "team_fight_rate", get: (a) => share(a.sp.fights.won, a.sp.fights.lost, a.sp.fights.games) },
  { id: "kills_for", label: "Kills / game", group: "fights", fmt: "dec", key: "avg_kills", get: (a) => perGame(a.kills, a.games) },
  { id: "kills_against", label: "Deaths / game", group: "fights", fmt: "dec", key: "avg_kills", low: true, get: (a) => perGame(a.deaths, a.games) },
  { id: "kill_diff", label: "Kill diff / game", group: "fights", fmt: "signed", key: "avg_kills", get: (a) => perGame(a.kills - a.deaths, a.games) },
  { id: "rosh", label: "Roshan control", group: "objectives", fmt: "pct", key: "team_roshans", get: (a) => a.o && share(a.o.roshans, a.o.roshans_against, a.o.games) },
  { id: "first_rosh", label: "First Roshan %", group: "objectives", fmt: "pct", key: "first_roshan", get: (a) => a.o && winRate(a.o.first_rosh.games, a.o.first_rosh.taken) },
  { id: "aegis_steals", label: "Aegis steals", group: "objectives", fmt: "int", key: "aegis_steals", get: (a) => cell(a.sp.aegis.stole) },
  { id: "obs", label: "Observers / game", group: "vision", fmt: "dec", key: "team_wards", get: (a) => cell(a.o?.obs_pg, a.o?.games) },
  { id: "dewards", label: "Dewards / game", group: "vision", fmt: "dec", key: "team_dewards", get: (a) => cell(a.o?.dewards_pg, a.o?.games) },
  { id: "stacks", label: "Stacks / game", group: "vision", fmt: "dec", key: "team_stacks", get: (a) => cell(a.o?.stacks_pg, a.o?.games) },
  { id: "avg_min", label: "Avg game (min)", group: "length", fmt: "dec", key: "team_length", get: (a) => perGame(a.minutes, a.games) },
  { id: "short_rate", label: "Win % under 30'", group: "length", fmt: "pct", key: "team_length", get: (a) => winRate(a.sp.length[0].games, a.sp.length[0].wins) },
  { id: "long_rate", label: "Win % at 45'+", group: "length", fmt: "pct", key: "team_length", get: (a) => winRate(a.sp.length[2].games, a.sp.length[2].wins) },
  { id: "standin_rate", label: "Win % with stand-ins", group: "roster", fmt: "pct", key: "team_standins", get: (a) => winRate(a.sp.standin.with.games, a.sp.standin.with.wins) },
];
export const COLUMN = Object.fromEntries(COLUMNS.map((c) => [c.id, c]));

// Ready-made column sets; the first is the builder's default.
export const PRESETS = [
  { id: "overview", name: "Overview", cols: ["games", "win_rate", "kill_diff", "avg_min", "fight_rate"] },
  { id: "sides", name: "Sides and draft", cols: ["win_rate", "radiant_rate", "dire_rate", "fp_rate", "sp_rate"] },
  { id: "early", name: "Early game", cols: ["win_rate", "fb_taken", "fb_win", "lead10", "lead20"] },
  { id: "fights", name: "Fights", cols: ["win_rate", "fight_rate", "kills_for", "kills_against", "kill_diff"] },
  { id: "objectives", name: "Objectives", cols: ["win_rate", "rosh", "first_rosh", "aegis_steals"] },
  { id: "vision", name: "Vision and jungle", cols: ["win_rate", "obs", "dewards", "stacks"] },
  { id: "length", name: "Game length", cols: ["win_rate", "avg_min", "short_rate", "long_rate", "comebacks"] },
];

// One team's aggregates over its games. `rec` overrides the record (AD2L: PlayOn's series
// scores, as the team page shows; otherwise the games' own).
export function teamAggregates(matches, team, rec = null) {
  const side = (m) => sideOf(m, team);
  const gs = matches.filter(side);
  let kills = 0, deaths = 0, minutes = 0;
  for (const m of gs) {
    const s = side(m);
    kills += (s === "a" ? m.score_a : m.score_b) ?? 0;
    deaths += (s === "a" ? m.score_b : m.score_a) ?? 0;
    minutes += (m.duration_sec ?? 0) / 60;
  }
  const r = rec ?? record(matches, team);
  return {
    games: gs.length, kills, deaths, minutes, rec: { games: r.wins + r.losses, wins: r.wins },
    sp: teamSplits(gs, side), tl: teamTimeline(gs, side), o: teamObjectives(gs, side),
    ss: teamSideSplit(gs.map((m) => ({ m, side: side(m) }))),
  };
}

// Rows for every team ({ team, cells: { id: cell | null } }), for the columns asked. records:
// team key -> { wins, losses } (AD2L's PlayOn record), else the games' own. Kept per matches
// array, so changing columns doesn't recount.
const cache = new WeakMap();
export function teamTable(matches, teams, { records = null } = {}) {
  let rows = cache.get(matches)?.get(teams);
  if (!rows) {
    rows = teams.map((team) => {
      const a = teamAggregates(matches, team, records?.get(team.key) ?? null);
      return { team, cells: Object.fromEntries(COLUMNS.map((c) => [c.id, c.get(a) ?? null])) };
    });
    if (!cache.has(matches)) cache.set(matches, new WeakMap());
    cache.get(matches).set(teams, rows);
  }
  return rows;
}

// A cell's text: 62%, 21.4, 3, +4.2, +1.3k.
export function cellText(fmt, v) {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "±";
  if (fmt === "pct") return `${Math.round(v * 100)}%`;
  if (fmt === "dec") return v.toFixed(1);
  if (fmt === "int") return String(Math.round(v));
  if (fmt === "signed") return `${sign}${Math.abs(v).toFixed(1)}`;
  if (fmt === "gold") return `${sign}${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}k` : Math.round(Math.abs(v))}`;
  return String(v);
}

// The builder's state in the address: &table=team&cols=a,b&sort=a&dir=asc&min=3.
export const MIN_DEFAULT = 3;
export function parseTable(params) {
  if (params.get("table") !== "team") return null;
  const cols = (params.get("cols") ?? "").split(",").filter((id) => COLUMN[id]);
  const list = cols.length ? [...new Set(cols)] : PRESETS[0].cols;
  const sort = COLUMN[params.get("sort")] && list.includes(params.get("sort")) ? params.get("sort") : list.find((id) => id !== "games") ?? list[0];
  const dir = params.get("dir") === "asc" ? "asc" : params.get("dir") === "desc" ? "desc" : COLUMN[sort].low ? "asc" : "desc";
  const min = Math.max(0, Math.min(50, Number.parseInt(params.get("min") ?? "", 10)));
  return { cols: list, sort, dir, min: Number.isNaN(min) ? MIN_DEFAULT : min };
}
export function tableParams({ cols, sort, dir, min }) {
  const p = new URLSearchParams({ table: "team", cols: cols.join(",") });
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  if (min !== MIN_DEFAULT) p.set("min", String(min));
  return p;
}
```

- [ ] **Step 4: Run** `node --test test/teamtable.test.js` → 6 pass. Then `npm test`.

- [ ] **Step 5: Commit** `git add public/lib/teamtable.js test/teamtable.test.js && git commit -m "Team tables: columns, rows and address state"`

---

### Task 3: Search reads table requests (`topics.js`, `sitesearch.js`)

**Files:** Modify `public/lib/topics.js`, `public/lib/sitesearch.js`, `test/sitesearch.test.js`

- [ ] **Step 1: Write the tests.** In `test/sitesearch.test.js`, in "a topic with no name is a card with its scopes", change

```js
  assert.deepEqual(r.cards[0].scopes, ["league", "team"]);
```

to

```js
  assert.deepEqual(r.cards[0].scopes, ["league", "teams", "team"]);
  assert.equal(r.table, null);
```

and append:

```js
import { COLUMN } from "../public/lib/teamtable.js";

test("topic team columns are real table columns", () => {
  for (const t of TOPICS) for (const id of t.cols ?? []) assert.ok(COLUMN[id], `${t.id}: no column ${id}`);
});

test("asking for every team leads with a table of the topics' columns", () => {
  const r = run("compare first blood and roshan");
  assert.deepEqual(r.table, { cols: ["fb_taken", "fb_win", "rosh", "first_rosh"], sort: "fb_taken" });
  assert.equal(r.empty, false);
  assert.deepEqual(run("radiant win rate all teams").table, { cols: ["radiant_rate", "dire_rate"], sort: "radiant_rate" });
  assert.equal(run("team table").table.cols.length > 0, true);
  assert.equal(run("radiant win rate").table, null); // a card, with an All teams scope instead
  assert.equal(run("compare No Immortals radiant").table, null); // one team: the direct link
});
```

Run `node --test test/sitesearch.test.js` → the two new tests and the scopes test fail.

- [ ] **Step 2: Topic columns and table words** in `public/lib/topics.js`.

Under the header comment line about `rate: true`, add:

```js
// `cols`: the team table columns (lib/teamtable.js) that show the topic for every team.
```

Above `export const RATE_WORDS`, add:

```js
// Words asking for every team side by side ("compare first blood", "radiant win rate all teams"):
// the results page leads with a team table. Matched as phrases, like topic words.
export const TABLE_WORDS = ["table", "tables", "compare", "comparison", "all teams", "every team", "each team", "by team", "per team",
  "rank", "ranked", "ranking", "rankings", "league wide"];
```

Add `cols` right after the `id` of each of these topics (e.g. `{ id: "sides", cols: ["radiant_rate", "dire_rate"], title: …`):

| id | cols |
|---|---|
| record | `["games", "win_rate"]` |
| sides | `["radiant_rate", "dire_rate"]` |
| side_pick | `["fp_rate", "sp_rate"]` |
| first_blood | `["fb_taken", "fb_win"]` |
| teamfights | `["fight_rate"]` |
| standins | `["standin_rate"]` |
| aegis | `["aegis_steals"]` |
| length | `["avg_min", "short_rate", "long_rate"]` |
| kills | `["kills_for", "kills_against", "kill_diff"]` |
| gold_lead | `["lead10", "lead20", "comebacks"]` |
| roshan | `["rosh", "first_rosh"]` |
| wards | `["obs", "dewards"]` |
| stacks | `["stacks"]` |
| dewards | `["dewards"]` |

- [ ] **Step 3: The reader** — in `public/lib/sitesearch.js`, make these replacements.

Imports:

```js
import { TOPICS, PAGES, HERO_SHORT, RATE_WORDS, TABLE_WORDS } from "./topics.js";
import { PRESETS } from "./teamtable.js";
```

After `const TOPIC_WORDS = …`:

```js
const TABLE = TABLE_WORDS.map((p) => p.split(" "));
```

Replace `const SCOPES = ["league", "team", "player", "hero"];` with:

```js
// "teams": every team in a table (topics with `cols`).
const SCOPES = ["league", "teams", "team", "player", "hero"];
```

In `prepare`, replace `for (const x of [...TOPIC_WORDS, ...RATE]) addWord(x, "*");` with:

```js
  for (const x of [...TOPIC_WORDS, ...RATE, ...TABLE.flat()]) addWord(x, "*");
```

In the comment above `siteSearch`, change `Returns { corrected, direct, cards, names, pages, empty }:` to `Returns { corrected, direct, cards, names, pages, table, empty }:` and add under the `pages:` line:

```js
//   table:  { cols, sort } when the query asks for every team (TABLE_WORDS): the topics' team
//           columns, or the builder's first preset when no topic has any; else null
```

`none` gains `table: null`:

```js
  const none = { corrected: null, direct: [], cards: [], names: [], pages: [], table: null, empty: true };
```

Replace

```js
  // Topics and pages from what's left.
  const rest = [], rate = [];
  w.forEach((x, i) => { if (!claimed.has(i) && !STOP.has(x)) (RATE.has(x) ? rate : rest).push(x); });
```

with

```js
  // Topics and pages from what's left, once table words ("compare", "all teams") are set aside.
  let rest = [];
  const rate = [];
  w.forEach((x, i) => { if (!claimed.has(i) && !STOP.has(x)) (RATE.has(x) ? rate : rest).push(x); });
  let wantsTable = false;
  for (const p of TABLE) for (let i = 0; i + p.length <= rest.length; i++) {
    if (!p.every((x, k) => rest[i + k] === x)) continue;
    rest = [...rest.slice(0, i), ...rest.slice(i + p.length)];
    wantsTable = true;
    i--;
  }
```

Replace the `const cards = …` line with:

```js
  const cards = topics.filter((t) => !covered.has(t.id)).map((t) => ({ topic: t, scopes: SCOPES.filter((s) => (s === "teams" ? t.cols && t.team : t[s])) }));
  // A team table: the matched topics' columns, in their order, or the default set.
  const cols = [...new Set(topics.filter((t) => t.cols && t.team).flatMap((t) => t.cols))];
  const table = wantsTable && !full.length ? { cols: cols.length ? cols : PRESETS[0].cols, sort: cols[0] ?? PRESETS[0].cols[1] } : null;
```

And the last two lines with:

```js
  const empty = !table && ((!direct.length && !cards.length && !names.length && !pages.length) || unmatched * 2 > total);
  return empty ? { ...none, corrected } : { corrected, direct, cards, names, pages, table, empty: false };
```

- [ ] **Step 4: Run** `node --test test/sitesearch.test.js` → 15 pass. `npm test` → all pass.

- [ ] **Step 5: Commit** `git add public/lib/topics.js public/lib/sitesearch.js test/sitesearch.test.js && git commit -m "Site search: table words and team columns"`

---

### Task 4: `sortableTable` options

**Files:** Modify `public/core.js`

- [ ] **Step 1:** Change the signature and first line:

```js
export function sortableTable(el, columns, rows, sortKey, { toolbar = false, dir: startDir = "desc", nullsLast = false, onSort = null } = {}) {
  let key = sortKey, dir = startDir === "asc" ? 1 : -1, density = 0, pages = null, page = 0;
```

Add to the comment above it: `// Options for the team table: dir ("asc" | "desc") to start with, nullsLast (empty values after every value, either direction) and onSort(key, dir) after a change.`

- [ ] **Step 2:** In `draw`'s sort, before `if (typeof x === "string")`:

```js
      if (nullsLast && (x == null || y == null)) return x == null ? (y == null ? 0 : 1) : -1;
```

- [ ] **Step 3:** Report sort changes. In the header click handler, after the `if/else` that sets `key`/`dir`, add `onSort?.(key, dir < 0 ? "desc" : "asc");`. Do the same in both toolbar handlers (`.sort-key` change and `.sort-dir` click), before `draw()`.

- [ ] **Step 4:** `npm test`; open `#/champion/` (standings table), `#/champion/players` and `#/champion/heroes` and sort a column on each: unchanged behaviour. Commit `git add public/core.js && git commit -m "sortableTable: start direction, nulls last, sort callback"`

---

### Task 5: The table and the builder (`parts/teamtable.js`)

**Files:** Create `public/parts/teamtable.js`

- [ ] **Step 1: Write it:**

```js
// The team table on the search results page (pages/search.js): one league's teams in the shared
// sortable table (lib/teamtable.js has the columns), and the builder around it: league, presets
// and saved sets, columns by group, minimum games. A league's games load only when a table is
// drawn, the same list the team page reads.
import { esc, SOURCES, DIVISIONS, sortableTable, teamLink } from "../core.js";
import { listTeams, seriesRecords } from "../lib/teams.js";
import { isBye } from "../lib/playoffs.js";
import { INFO } from "../lib/glossary.js";
import { COLUMNS, COLUMN, GROUPS, PRESETS, teamTable, cellText } from "../lib/teamtable.js";

export const TABLE_LEAGUES = [...Object.keys(DIVISIONS), "all", "scrim"];
export const leagueLabel = (k) => (k === "all" ? "All divisions" : k === "scrim" ? "Scrims" : DIVISIONS[k]?.short ?? k);

// One league's teams and games, as the team list shows them: AD2L's division file (bye slots out)
// with PlayOn's records; scrims from their games. All divisions adds each team's division.
const loaded = new Map();
export function leagueTeams(key) {
  if (!loaded.has(key)) loaded.set(key, (async () => {
    const src = SOURCES[key];
    const matches = await src.load();
    if (!src.ad2l) return { src, matches, teams: listTeams(matches), records: null, division: null };
    const d = await src.data();
    const ids = new Set(d.teams.filter((t) => !isBye(t)).map((t) => t.id));
    const teams = listTeams(matches, d.teams).filter((t) => ids.has(t.id));
    const recs = seriesRecords(d.series);
    return {
      src, matches, teams, records: new Map(teams.map((t) => [t.key, recs.get(t.id) ?? { wins: 0, losses: 0 }])),
      division: src.all ? new Map(d.teams.map((t) => [t.id, t.division])) : null,
    };
  })().catch((e) => { loaded.delete(key); throw e; }));
  return loaded.get(key);
}

// The table for st { cols, sort, dir, min } in el. A value from fewer than `min` games shows
// greyed and sorts after the rest (as does "—"). onSort(sort, dir) when the sort changes.
export async function drawTeamTable(el, league, st, { onSort = null } = {}) {
  el.innerHTML = `<div class="panel empty">Loading ${esc(leagueLabel(league))}'s games…</div>`;
  let L;
  try { L = await leagueTeams(league); }
  catch { el.innerHTML = `<div class="panel empty">${esc(leagueLabel(league))} couldn't load. Try again.</div>`; return; }
  if (!el.isConnected) return;
  if (!L.teams.length) { el.innerHTML = `<div class="panel empty">No teams in ${esc(leagueLabel(league))} yet.</div>`; return; }
  const rows = teamTable(L.matches, L.teams, { records: L.records }).map(({ team, cells }) => {
    const r = { team: team.name, _team: team, division: L.division?.get(team.id) ?? "" };
    for (const id of st.cols) {
      const c = cells[id];
      r[id] = c && !(c.n != null && c.n < st.min) ? c.v : null; // what it sorts by
      r[`${id}~`] = c; // what it shows
    }
    return r;
  });
  const show = (id) => (_, r) => {
    const c = r[`${id}~`];
    if (!c) return '<span class="muted">—</span>';
    const games = c.n != null ? `${c.n} game${c.n === 1 ? "" : "s"}` : "";
    const low = c.n != null && c.n < st.min;
    const tip = [c.of, low ? `only ${games}` : games].filter(Boolean).join(" · ");
    return `<span class="${low ? "tt-low" : ""}"${tip ? ` title="${esc(tip)}"` : ""}>${cellText(COLUMN[id].fmt, c.v)}</span>`;
  };
  const columns = [
    ["team", "Team", (_, r) => teamLink(L.src, r._team.name, r._team.id), "l", null, false],
    ...(L.division ? [["division", "Division", (v) => esc(v), "l", null, false]] : []),
    ...st.cols.map((id) => [id, COLUMN[id].label, show(id), "", COLUMN[id].fmt === "pct" ? "jade" : null, COLUMN[id].key]),
  ];
  sortableTable(el, columns, rows, st.sort, { toolbar: true, dir: st.dir, nullsLast: true, onSort });
}

// ---------- the builder ----------
const SAVED = "team-table-sets";
export const readSets = () => { try { const v = JSON.parse(localStorage.getItem(SAVED)); return Array.isArray(v) ? v.filter((s) => s?.name && Array.isArray(s.cols)) : []; } catch { return []; } };
const writeSets = (list) => { try { localStorage.setItem(SAVED, JSON.stringify(list)); return true; } catch { return false; } };

const presetsHtml = (st) => {
  const chip = (cols, name) => `<button type="button" class="tt-preset${cols.join(",") === st.cols.join(",") ? " on" : ""}" data-cols="${esc(cols.join(","))}">${esc(name)}</button>`;
  return `${PRESETS.map((p) => chip(p.cols, p.name)).join("")}${readSets().map((s, i) => `<span class="tt-saved">${chip(s.cols.filter((id) => COLUMN[id]), s.name)}<button type="button" class="tt-unsave" data-i="${i}" aria-label="Delete ${esc(s.name)}" title="Delete">✕</button></span>`).join("")}`;
};

// The builder for st { cols, sort, dir, min } in `league`.
export function builderHtml(st, league) {
  return `<div class="tt-builder">
    <div class="tt-row">
      <label class="sr-lgpick">League <select class="tt-league">${TABLE_LEAGUES.map((k) => `<option value="${k}"${k === league ? " selected" : ""}>${esc(leagueLabel(k))}</option>`).join("")}</select></label>
      <label class="sr-lgpick">Min games <input type="number" class="tt-min" min="0" max="50" value="${st.min}"></label>
    </div>
    <div class="tt-presets" role="group" aria-label="Column sets">${presetsHtml(st)}</div>
    <details class="tt-cols" open><summary>Columns · <span class="tt-count">${st.cols.length}</span></summary>
      <div class="tt-groups">${GROUPS.map(([g, label]) => `<fieldset><legend>${esc(label)}</legend>${COLUMNS.filter((c) => c.group === g).map((c) => `<label title="${esc(INFO[c.key] ?? "")}"><input type="checkbox" value="${c.id}"${st.cols.includes(c.id) ? " checked" : ""}> ${esc(c.label)}</label>`).join("")}</fieldset>`).join("")}</div>
    </details>
    <div class="tt-table"></div>
    <div class="row tt-btns"><button type="button" class="tt-save">Save these columns</button><button type="button" class="link-btn tt-copy">Copy link</button><button type="button" class="link-btn tt-reset">Reset</button><span class="tt-msg" role="status"></span></div>
  </div>`;
}

// Wire a builder (builderHtml) in root. onChange(st, league) after every change, for the address.
export function wireBuilder(root, st0, league0, onChange) {
  if (!root) return;
  let st = { ...st0 }, league = league0;
  const table = root.querySelector(".tt-table"), msg = root.querySelector(".tt-msg");
  const say = (text, cls = "") => { msg.textContent = text; msg.className = `tt-msg ${cls}`; };
  const drawTable = () => drawTeamTable(table, league, st, { onSort: (sort, dir) => { st = { ...st, sort, dir }; onChange(st, league); } });
  const changed = () => {
    root.querySelector(".tt-presets").innerHTML = presetsHtml(st);
    root.querySelectorAll(".tt-groups input").forEach((i) => (i.checked = st.cols.includes(i.value)));
    root.querySelector(".tt-count").textContent = st.cols.length;
    drawTable();
    onChange(st, league);
  };
  const setCols = (cols) => {
    if (!cols.length) return say("Pick at least one column.", "err");
    const sort = cols.includes(st.sort) ? st.sort : cols.find((id) => id !== "games") ?? cols[0];
    st = { ...st, cols, sort, dir: sort === st.sort ? st.dir : COLUMN[sort].low ? "asc" : "desc" };
    say("");
    changed();
  };
  root.addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches(".tt-league")) { league = t.value; changed(); }
    else if (t.matches(".tt-min")) { st = { ...st, min: Math.max(0, Math.min(50, Number.parseInt(t.value, 10) || 0)) }; changed(); }
    else if (t.matches(".tt-groups input")) setCols(t.checked ? [...st.cols, t.value] : st.cols.filter((id) => id !== t.value));
  });
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.matches(".tt-preset")) setCols(b.dataset.cols.split(","));
    else if (b.matches(".tt-unsave")) {
      const sets = readSets();
      sets.splice(Number(b.dataset.i), 1);
      writeSets(sets);
      root.querySelector(".tt-presets").innerHTML = presetsHtml(st);
    } else if (b.matches(".tt-save")) {
      const name = prompt("Name these columns:", "")?.trim();
      if (!name) return;
      if (!writeSets([...readSets().filter((s) => s.name !== name), { name, cols: st.cols }])) return say("This browser won't save it (private window or blocked storage).", "err");
      root.querySelector(".tt-presets").innerHTML = presetsHtml(st);
      say(`Saved "${name}".`, "ok");
    } else if (b.matches(".tt-copy")) {
      try { await navigator.clipboard.writeText(location.href); say("Link copied.", "ok"); }
      catch { say("Couldn't copy; copy the address bar instead.", "err"); }
    } else if (b.matches(".tt-reset")) setCols(PRESETS[0].cols);
  });
  drawTable();
}
```

- [ ] **Step 2:** `node --check public/parts/teamtable.js`. Commit `git add public/parts/teamtable.js && git commit -m "Team tables: the table and the builder"`

---

### Task 6: On the results page (`pages/search.js`)

**Files:** Modify `public/pages/search.js`

- [ ] **Step 1: Imports** — add:

```js
import { parseTable, tableParams, PRESETS, COLUMN, MIN_DEFAULT } from "../lib/teamtable.js";
import { drawTeamTable, builderHtml, wireBuilder, TABLE_LEAGUES, leagueLabel as tableLeague } from "../parts/teamtable.js";
```

- [ ] **Step 2: State.** After `const st = { type: …, league: … };` add:

```js
  // The team table: the builder's state (&table=team&cols=…), and its league (&league=, else this one).
  let tst = parseTable(p);
  const homeLeague = src.all ? "all" : here;
  let tleague = TABLE_LEAGUES.includes(p.get("league")) ? p.get("league") : homeLeague;
  const tableLink = (cols, sort = null, extra = {}) => link({ ...(q && { q }), ...Object.fromEntries(tableParams({ cols, sort, dir: null, min: MIN_DEFAULT })), ...extra });
  const keepTable = () => {
    const u = new URL(location.href);
    for (const k of ["table", "cols", "sort", "dir", "min", "league"]) u.searchParams.delete(k);
    if (tst) {
      for (const [k, v] of tableParams(tst)) u.searchParams.set(k, v);
      if (tleague !== homeLeague) u.searchParams.set("league", tleague);
    }
    history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    setRoutedAt(location.href);
  };
  // Every .tt-table[data-cols] in scope: a plain table (the table-first block, a card's All teams).
  const mount = (scope) => scope.querySelectorAll(".tt-table[data-cols]").forEach((el) => {
    const cols = el.dataset.cols.split(","), sort = el.dataset.sort;
    drawTeamTable(el, el.closest(".sr-card")?.querySelector(".sr-tlg")?.value ?? tleague, { cols, sort, dir: COLUMN[sort]?.low ? "asc" : "desc", min: MIN_DEFAULT });
  });
```

- [ ] **Step 3: Title and heading** — replace `setTitle(q ? `“${q}”` : "Search", "Search");` with `setTitle(q ? `“${q}”` : tst ? "Team table" : "Search", "Search");` and in the `<h1>`, `${q ? esc(q) : "Search"}` with `${q ? esc(q) : tst ? "Team table" : "Search"}`.

- [ ] **Step 4: Keep the table on a new search** — in `form.onsubmit`, add `...(tst && Object.fromEntries(tableParams(tst))), ...(tst && tleague !== homeLeague && { league: tleague })` to the `link({ … })` object.

- [ ] **Step 5: The All teams scope** — at the top of `picker`, add:

```js
    if (scope === "teams") {
      const cols = [...new Set(["games", "win_rate", ...t.cols])];
      return `<label class="sr-lgpick">League <select class="sr-tlg">${TABLE_LEAGUES.map((k) => `<option value="${k}"${k === tleague ? " selected" : ""}>${esc(tableLeague(k))}</option>`).join("")}</select></label>
        <a class="sr-go" href="${tableLink(cols, t.cols[0])}">Edit columns →</a>
        <div class="tt-table" data-cols="${cols.join(",")}" data-sort="${t.cols[0]}"></div>`;
    }
```

and add `teams: "All teams"` to the `SCOPE` labels.

- [ ] **Step 6: Builder, table-first block, build link** — in `draw()`, replace the empty branch

```js
    if (!q || res.empty) {
      body.innerHTML = `<div class="panel empty sr-empty">…`;
      return;
    }
```

with

```js
    const builder = tst ? `<section class="sr-card tt-card"><h2 class="sr-title">Team table</h2>${builderHtml(tst, tleague)}</section>` : "";
    const buildLink = tst ? "" : `<a class="sr-build" href="${tableLink(res.table?.cols ?? res.cards.find((c) => c.topic.cols)?.topic.cols ?? PRESETS[0].cols)}">Build a team table →</a>`;
    const after = () => { if (tst) wireBuilder(body.querySelector(".tt-builder"), tst, tleague, (next, lg) => { tst = next; tleague = lg; keepTable(); }); mount(body); };
    if (!q || res.empty) {
      body.innerHTML = `${builder}${tst && !q ? "" : `<div class="panel empty sr-empty"><strong>${q ? `Nothing on the site matches “${esc(q)}”` : "Search players, teams, heroes and stats"}</strong>
        Try ${EXAMPLES.map((x) => `<a href="${link({ q: x })}">${esc(x)}</a>`).join(" · ")} ${buildLink}</div>`}`;
      return after();
    }
```

Then, before `const nothing = …`, add:

```js
    const titles = res.cards.filter((c) => c.topic.cols).map((c) => c.topic.title).join(", ") || PRESETS[0].name;
    const tableFirst = res.table && !tst ? `<section class="sr-card sr-tablefirst"><h2 class="sr-title">Every team: ${esc(titles)}</h2>
        <div class="tt-table" data-cols="${res.table.cols.join(",")}" data-sort="${res.table.sort}"></div>
        <p class="table-note"><a href="${tableLink(res.table.cols, res.table.sort)}">Edit columns →</a></p></section>` : "";
```

Change `const nothing = !direct.length && …` to also require `!tableFirst && !tst`. In the `body.innerHTML = …` template, put `${builder}` right after `${filters}` with `${buildLink}` inside the filters row (after the league select), and `${tableFirst}` before `${directHtml …}`. After the assignment, call `after();`.

- [ ] **Step 7: Card events** — in the `[data-scope]` click branch, after `card.querySelector(".sr-pick").innerHTML = picker(…)`, add `mount(card);`. In the `change` listener, add:

```js
    if (e.target.classList.contains("sr-tlg")) return mount(e.target.closest(".sr-card"));
```

- [ ] **Step 8:** `node --check public/pages/search.js`, `npm test`. Commit `git add public/pages/search.js && git commit -m "Site search: team tables on the results page"`

---

### Task 7: Styles

**Files:** Modify `public/style.css` — append:

```css
/* Team tables (parts/teamtable.js) on the search results page. */
.sr-pick .tt-table, .sr-card .tt-table { flex-basis: 100%; min-width: 0; margin-top: 8px; }
.sr-tablefirst { max-width: none; }
.sr-build { font: 600 12px/1.3 var(--mono); white-space: nowrap; }
.tt-card { max-width: none; }
.tt-builder { display: grid; gap: 12px; }
.tt-row { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; }
.tt-min { width: 64px; padding: 5px 8px; background: var(--ink); color: var(--bone); border: 1px solid var(--seam-2); border-radius: 4px; font: inherit; }
.tt-presets { display: flex; flex-wrap: wrap; gap: 6px; }
.tt-preset { padding: 5px 10px; border: 1px solid var(--seam-2); border-radius: 999px; background: none; color: var(--bone); font: 500 13px var(--body); text-transform: none; letter-spacing: 0; clip-path: none; }
.tt-preset.on { border-color: var(--accent); color: var(--accent); }
.tt-saved { display: inline-flex; align-items: center; gap: 2px; }
.tt-unsave { padding: 2px 6px; background: none; border: 0; color: var(--dust); clip-path: none; }
.tt-cols > summary { cursor: pointer; font: 600 12px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--dust); }
.tt-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px 16px; margin-top: 8px; }
.tt-groups fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: 3px; }
.tt-groups legend { font: 600 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--dust); margin-bottom: 4px; }
.tt-groups label { font-size: 13px; display: flex; gap: 6px; align-items: center; cursor: pointer; }
.tt-low { opacity: .45; }
.tt-btns { gap: 10px 16px; align-items: center; }
.tt-msg.ok { color: var(--jade); } .tt-msg.err { color: var(--ember); }
```

Commit `git add public/style.css && git commit -m "Team tables: styles"`

---

### Task 8: Browser checks

Run the app (`npm start`) and check, with the console open:

1. `#/champion/` search "compare first blood" → the **Every team: First blood** block leads; its table lists every Champion team with First blood % and Win % after first blood; clicking a header re-sorts. "Edit columns" opens the builder with those columns.
2. Search "radiant win rate" → the card has League · All teams · Team; All teams shows Games, Win %, Radiant and Dire win %; switching its league to Warrior shows Warrior's teams. No Immortals' Win % is 75% (9–3, as its team page).
3. The builder (`Build a team table →` under the filters): tick and untick columns; apply each preset; raise Min games to 8 and see small samples grey and drop to the bottom; sort a column and see `&sort=` in the address; Save a set, reload, see its chip; ✕ deletes it; Copy link, open it in a new tab → the same table.
4. League **All divisions** adds a Division column; **Scrims** works from its games (no PlayOn records).
5. Phone width (390px): the table pages its columns, nothing scrolls sideways.
6. No console errors; the standings, players and heroes tables still sort as before.

Fix anything that fails, then commit the fixes.

---

### Task 9: Docs

- [ ] In `docs/features.md`, append to the **Search** bullet:

```markdown
  **Team tables:** a search that asks for every team ("compare first blood", "radiant win rate
  all teams", "rank teams by roshan") leads with a table of every team in the league; a team
  stat's card has an **All teams** scope; and **Build a team table** opens a builder (columns
  in groups, presets, saved sets, minimum games, league incl. All divisions and Scrims) whose
  state is in the address (`&table=team&cols=…&sort=…&min=…&league=…`), so a table can be
  shared. Values come from the team page's own functions (`lib/teamtable.js`); AD2L win % is
  PlayOn's record. Spec: `docs/superpowers/specs/2026-10-06-team-tables-design.md`.
```

- [ ] Set the spec's status line to built. Commit `git add docs && git commit -m "Docs: team tables"`

---

### Task 10: Final check

- [ ] `npm test` — paste the summary lines.
- [ ] Re-run Task 8 end to end; screenshot the table-first block and the builder.
- [ ] Report what passed, with output, and anything skipped.
