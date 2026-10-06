import { test } from "node:test";
import assert from "node:assert/strict";
import { KINDS, column, tableRows, cellText, parseTable, tableParams, tableState, inPeriod, MIN_DEFAULT } from "../public/lib/tables.js";
import { seriesRecords } from "../public/lib/teams.js";
import { INFO } from "../public/lib/glossary.js";

// Three teams; A beats B twice (once each side), B beats C, C beats A. A drafts first pick in
// its first game. Each game has ten players (a.1… on team A, b.1… on team B) on fixed heroes.
const T = { A: { key: "id:1", id: 1, name: "Alpha" }, B: { key: "id:2", id: 2, name: "Bravo" }, C: { key: "id:3", id: 3, name: "Charlie" } };
const HEROES = ["Pudge", "Lion", "Lina", "Axe", "Zeus"];
const five = (t, side, k) => HEROES.map((hero, i) => ({ team: side, name: `${t.name} ${i + 1}`, player_key: `${t.id}-${i + 1}`, hero,
  kills: k, deaths: 2, assists: 3, gpm: 400, xpm: 500, hero_damage: 10000, net_worth: 10000 }));
const g = (id, a, b, winner, sa, sb, min, extra = {}) => ({ id, team_a: a.name, team_b: b.name, team_a_id: a.id, team_b_id: b.id,
  winner, score_a: sa, score_b: sb, duration_sec: min * 60, createdAt: new Date(2026, 9, id), players: [...five(a, "a", 6), ...five(b, "b", 2)], ...extra });
const games = [
  g(1, T.A, T.B, "a", 30, 10, 25, { draft: [{ order: 1, side: "a", pick: true, hero: "Pudge" }, { order: 2, side: "b", pick: false, hero: "Sniper" }] }),
  g(2, T.B, T.A, "b", 12, 28, 40),
  g(3, T.B, T.C, "a", 20, 15, 50),
  g(4, T.C, T.A, "a", 25, 22, 35),
];
const scope = { matches: games, teams: [T.A, T.B, T.C] };
const team = (t) => tableRows("team", scope).find((r) => r.entity === t).cells;

test("column catalogs: unique ids, real groups, glossary headers, presets of real columns", () => {
  for (const [kind, K] of Object.entries(KINDS)) {
    assert.equal(new Set(K.columns.map((c) => c.id)).size, K.columns.length, kind);
    const groups = new Set(K.groups.map(([id]) => id));
    for (const c of K.columns) {
      assert.ok(groups.has(c.group), `${kind} ${c.id}: group ${c.group}`);
      assert.ok(c.key === false || INFO[c.key], `${kind} ${c.id}: no glossary entry "${c.key}"`);
      assert.ok(["pct", "dec", "dec2", "int", "signed", "signed2", "gold"].includes(c.fmt), `${kind} ${c.id}: fmt ${c.fmt}`);
    }
    for (const p of K.presets) for (const id of p.cols) assert.ok(column(kind, id), `${kind} preset ${p.id}: ${id}`);
    for (const c of K.columns) if (c.pm) assert.ok(column(kind, c.pm), `${kind} ${c.id}: pm ${c.pm}`);
  }
});

test("team values come from each team's own games", () => {
  const a = team(T.A);
  assert.deepEqual([a.games.v, a.win_rate.v, a.win_rate.of], [3, 2 / 3, "2–1"]);
  assert.deepEqual([a.radiant_rate.v, a.radiant_rate.n, a.dire_rate.v, a.dire_rate.n], [1, 1, 0.5, 2]); // Radiant (team A) in g1, won; Dire in g2 (won) and g4 (lost)
  assert.equal(a.kills_for.v, (30 + 28 + 22) / 3);
  assert.equal(a.kill_diff.v, ((30 - 10) + (28 - 12) + (22 - 25)) / 3);
  assert.equal(a.avg_min.v, (25 + 40 + 35) / 3);
  assert.equal(a.kills_pm.v, (30 + 28 + 22) / (25 + 40 + 35)); // over game time, not per game
  assert.equal(a.kill_diff_pm.v, ((30 - 10) + (28 - 12) + (22 - 25)) / 100);
  assert.deepEqual([a.fp_rate.v, a.fp_rate.n], [1, 1]);
  assert.equal(a.sp_rate, null); // no drafted game where A picked second
  assert.deepEqual([team(T.B).sp_rate.v, team(T.B).sp_rate.n], [0, 1]);
  assert.equal(a.fight_rate, null); // no fight data
  assert.equal(a.aegis_steals.v, 0);
});

test("a team record override (PlayOn's) replaces the games' own", () => {
  const r = tableRows("team", { matches: games, teams: [T.A], records: new Map([["id:1", { wins: 9, losses: 3 }]]), key: "playon" });
  assert.deepEqual([r[0].cells.win_rate.v, r[0].cells.win_rate.of, r[0].cells.games.v], [0.75, "9–3", 3]);
});

test("player rows: the Players page's numbers, per game", () => {
  const p = tableRows("player", scope).find((r) => r.id === "1-1");
  assert.equal(p.name, "Alpha 1");
  assert.deepEqual([p.cells.games.v, p.cells.win_rate.v], [3, 2 / 3]);
  assert.equal(p.cells.kills_pg.v, (6 + 2 + 2) / 3); // 6 kills a game as team A (g1), 2 as team B (g2, g4)
  assert.equal(p.cells.kda.v, (10 + 9) / 6);
  assert.equal(p.cells.kills_pm.v, (6 + 2 + 2) / (25 + 40 + 35));
  assert.equal(p.cells.hero_count.v, 1);
  assert.equal(p.cells.avg_gpm.v, 400);
  assert.equal(p.cells.obs_pg, null); // no replay stats in the fixture
});

test("hero rows: picks, win rate, bans over drafted games", () => {
  const rows = tableRows("hero", scope), pudge = rows.find((r) => r.id === "Pudge").cells;
  assert.deepEqual([pudge.picks.v, pudge.win_rate.v, pudge.win_rate.of], [8, 0.5, "4–4"]);
  assert.deepEqual([pudge.ban_rate.v, pudge.ban_rate.n], [0, 1]);
  assert.equal(rows.find((r) => r.id === "Sniper"), undefined); // banned, never picked
});

test("the period keeps only recent games", () => {
  assert.equal(inPeriod(games, 0).length, 4);
  assert.deepEqual(inPeriod(games, 2, +new Date(2026, 9, 17)).map((m) => m.id), [3, 4]);
});

test("seriesRecords sums each team's series scores", () => {
  const r = seriesRecords([{ home: 1, away: 2, home_score: 2, away_score: 0 }, { home: 3, away: 1, home_score: 1, away_score: 1 }, { home: 2, away: 3, home_score: null, away_score: null }]);
  assert.deepEqual(r.get(1), { wins: 3, losses: 1, games: 4 });
  assert.deepEqual(r.get(2), { wins: 0, losses: 2, games: 2 });
  assert.deepEqual(r.get(3), { wins: 1, losses: 1, games: 2 });
});

test("cell text", () => {
  assert.deepEqual([cellText("pct", 0.623), cellText("dec", 21.44), cellText("dec2", 3.256), cellText("int", 1234.4), cellText("signed", 4.25), cellText("signed", -1), cellText("signed2", 0.153), cellText("gold", 1320), cellText("gold", -640), cellText("pct", null)],
    ["62%", "21.4", "3.26", "1,234", "+4.3", "−1.0", "+0.15", "+1.3k", "−640", "—"]);
});

test("the address round-trips per kind; unknown columns drop; lower-is-better sorts low first", () => {
  assert.equal(parseTable(new URLSearchParams("q=x")), null);
  assert.equal(parseTable(new URLSearchParams("table=nope")), null);
  const st = parseTable(new URLSearchParams("table=team&cols=radiant_rate,nope,fb_taken,radiant_rate&min=5&weeks=4"));
  assert.deepEqual(st, { kind: "team", cols: ["radiant_rate", "fb_taken"], sort: "radiant_rate", dir: "desc", min: 5, weeks: 4, team: null });
  assert.deepEqual(parseTable(tableParams(st)), st);
  const pl = parseTable(new URLSearchParams("table=player&cols=kda,deaths_pg&sort=deaths_pg&team=Alpha&weeks=3"));
  assert.deepEqual(pl, { kind: "player", cols: ["kda", "deaths_pg"], sort: "deaths_pg", dir: "asc", min: MIN_DEFAULT, weeks: 0, team: "Alpha" });
  assert.deepEqual(parseTable(tableParams(pl)), pl);
  assert.equal(parseTable(new URLSearchParams("table=team&team=Alpha")).team, null); // team filter is players only
  assert.deepEqual(parseTable(new URLSearchParams("table=hero")).cols, KINDS.hero.presets[0].cols);
  assert.equal(parseTable(new URLSearchParams("table=hero")).sort, "win_rate");
  assert.equal(tableParams({ ...st, min: MIN_DEFAULT }).has("min"), false);
  assert.deepEqual(tableState("player", ["kda"]).cols, ["kda"]);
});
