import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RANK_STATS, withPerGame, rankStat, ends, placeOf, ordinal, formatStat } from "../public/lib/ranks.js";
import { heroRatings, heroTierList, heroPowerList, ratingOf, K_HERO, gameRatings, tierModel, tierList, MIN_GAMES, TIERS } from "../public/lib/tiers.js";
import { playerLeaderboard, wardLife } from "../public/lib/stats.js";
import { teamLeaderboard } from "../public/lib/teams.js";
import { parseDuration } from "../public/lib/validate.js";

const stat = (key) => RANK_STATS.find((s) => s.key === key);
const row = (name, games, v) => ({ key: name, name, games, kda: v, deaths_pg: v });

test("rankStat: best first, needs MIN_GAMES, lower-is-better stats flip", () => {
  const rows = [row("a", 5, 3), row("b", 5, 1), row("c", MIN_GAMES - 1, 9), row("d", 5, 2)];
  assert.deepEqual(rankStat(rows, stat("kda")).map((r) => r.name), ["a", "d", "b"]);
  assert.deepEqual(rankStat(rows, stat("deaths_pg")).map((r) => r.name), ["b", "d", "a"]);
});

test("ends: top 3 and bottom 3 (worst first), never overlapping on a short list", () => {
  const ranked = [1, 2, 3, 4, 5, 6, 7, 8].map(String);
  const e = ends(ranked);
  assert.deepEqual([e.top, e.bottom], [["1", "2", "3"], ["8", "7", "6"]]);
  assert.deepEqual(ends(["1", "2", "3", "4"]).bottom, ["4"]);
});

test("placeOf: rank, list size and which end", () => {
  const ranked = [..."abcdefgh"];
  assert.deepEqual(placeOf(ranked, (x) => x === "b"), { rank: 2, of: 8, fromBottom: 7, tied: 1, end: "top" });
  assert.deepEqual(placeOf(ranked, (x) => x === "h"), { rank: 8, of: 8, fromBottom: 1, tied: 1, end: "bottom" });
  assert.equal(placeOf(ranked, (x) => x === "e").end, null);
  assert.equal(placeOf(ranked, (x) => x === "z"), null);
});

test("ties share a place, and a tie that spills past the 3 gets no top/bottom mark", () => {
  // Values best first: 9, 7, 5, 5, 3, 0, 0, 0, 0
  const ranked = [9, 7, 5, 5, 3, 0, 0, 0, 0].map((v, i) => ({ id: i, v }));
  const val = (x) => x.v, at = (id) => placeOf(ranked, (x) => x.id === id, val);
  assert.deepEqual(at(2), { rank: 3, of: 9, fromBottom: 6, tied: 2, end: null });
  assert.equal(at(1).end, "top");
  assert.deepEqual(at(8), { rank: 6, of: 9, fromBottom: 1, tied: 4, end: null });
  const e = ends(ranked, val);
  assert.deepEqual(e.top.map((x) => x.v), [9, 7]);
  assert.deepEqual(e.top_spill, { count: 2, sample: ranked[2] });
  assert.deepEqual(e.bottom, []);
  assert.deepEqual(e.bottom_spill, { count: 4, sample: ranked[8] });
});

test("ordinal and formatStat", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st"]);
  assert.equal(formatStat(stat("win_rate"), 0.456), "46%");
  assert.equal(formatStat(stat("kda"), 3.14159), "3.14");
  assert.equal(formatStat(stat("obs_pm"), null), "—");
  assert.equal(formatStat(stat("obs_pm"), 0.2468), "0.25");
  assert.equal(formatStat(stat("ward_life"), 245.4), "4:05");
});

test("withPerGame: totals become per-game numbers", () => {
  const r = withPerGame({ games: 4, kills: 10, deaths: 6, assists: 20, map_games: 2, roshans: 1, tormentors: 0 });
  assert.equal(r.kills_pg, 2.5);
  assert.equal(r.deaths_pg, 1.5);
  assert.equal(r.roshans_pg, 0.5);
  assert.equal(withPerGame({ games: 1, kills: 0, deaths: 0, assists: 0, map_games: 0 }).roshans_pg, null);
});

const game = (id) => {
  const m = JSON.parse(readFileSync(new URL("./fixtures/game.json", import.meta.url), "utf8"));
  m.duration_sec = parseDuration(m.duration);
  m.id = `g${id}`;
  return m;
};

test("heroRatings: one list per hero, best first, on the tier curve", () => {
  const games = [0, 1, 2, 3].map((i) => { const g = game(i); g.players[0].kills += 5 * i; return g; });
  const model = tierModel(games);
  const byHero = heroRatings(games, { model });
  const heroes = new Set(games.flatMap((g) => g.players.map((p) => p.hero)));
  assert.deepEqual(new Set(byHero.keys()), heroes);
  for (const list of byHero.values()) {
    for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].score >= list[i].score);
    for (const p of list) assert.ok(p.rating >= 0 && p.rating <= 100);
  }
  // Same games and hero: the hero rating matches the tier score before season podium bonuses.
  const tiers = Object.fromEntries(tierList(games, { model }).tiers.flatMap((t) => t.players).map((p) => [p.key, Math.round(ratingOf(p.score_base ?? p.score, model.curve))]));
  for (const list of byHero.values()) for (const p of list) assert.equal(p.rating, tiers[p.key]);
  assert.equal(playerLeaderboard(games).length, Object.keys(tiers).length);
});

test("gameRatings: the ten players of one game, best first, each with a tier", () => {
  const games = [0, 1, 2, 3].map((i) => { const g = game(i); g.players[0].kills += 5 * i; return g; });
  const model = tierModel(games);
  const list = gameRatings(games[3], games, { model });
  assert.equal(list.length, 10);
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].score >= list[i].score);
  for (const p of list) {
    assert.ok(p.rating >= 0 && p.rating <= 100);
    assert.equal(p.tier, TIERS.find((t) => p.rating_exact >= t.min).tier);
  }
  // More kills in that game rates the same player higher than in the game without them.
  const key = list.find((p) => p.name === games[3].players[0].name).key;
  const at = (m) => gameRatings(m, games, { model }).find((p) => p.key === key).rating_exact;
  assert.ok(at(games[3]) > at(games[0]));
});

test("heroTierList: player-hero pairs at the games floor, banded by the tier cutoffs, best first", () => {
  const games = [0, 1, 2, 3].map((i) => { const g = game(i); g.players[0].kills += 5 * i; if (i === 3) g.players[1].hero = "Pudge"; return g; });
  const ratings = heroRatings(games, { model: tierModel(games) });
  const bands = heroTierList(ratings, { minGames: 2 });
  assert.deepEqual(bands.map((b) => b.tier), TIERS.map((t) => t.tier));
  const pairs = bands.flatMap((b) => b.pairs);
  // Ten players on their usual hero (4 or 3 games); the one Pudge game is under the floor.
  assert.equal(pairs.length, 10);
  assert.ok(pairs.every((p) => p.games >= 2 && p.hero !== "Pudge"));
  for (const b of bands) for (const p of b.pairs) assert.equal(p.tier, TIERS.find((t) => p.rating_exact >= t.min).tier);
  for (let i = 1; i < pairs.length; i++) assert.ok(pairs[i - 1].rating_exact >= pairs[i].rating_exact);
  assert.equal(heroTierList(ratings, { minGames: 1 }).flatMap((b) => b.pairs).length, 11);
  // The cached ratings aren't touched.
  assert.ok([...ratings.values()].flat().every((p) => p.tier === undefined));
});

test("heroPowerList: heroes by padded games-weighted hero rating, on a curve, at the games floor", () => {
  const games = [0, 1, 2, 3].map((i) => { const g = game(i); g.players[0].kills += 5 * i; if (i === 3) g.players[1].hero = "Pudge"; return g; });
  const ratings = heroRatings(games, { model: tierModel(games) });
  const { tiers } = heroPowerList(ratings, { minGames: 2 });
  assert.deepEqual(tiers.map((t) => t.tier), TIERS.map((t) => t.tier));
  const heroes = tiers.flatMap((t) => t.heroes);
  assert.equal(heroes.length, 10); // Pudge's one game is under the floor
  for (const h of heroes) {
    const ps = ratings.get(h.hero);
    const games = ps.reduce((s, p) => s + p.games, 0);
    assert.equal(h.games, games);
    assert.ok(Math.abs(h.avg - (ps.reduce((s, p) => s + p.rating_exact * p.games, 0) + 50 * K_HERO) / (games + K_HERO)) < 1e-9);
    assert.equal(h.tier, TIERS.find((t) => h.rating_exact >= t.min).tier);
    assert.equal(h.best, ps[0]);
    assert.equal(h.on, ps); // the breakdown lists these players, best first
  }
  // Same order as the padded averages: the curve only stretches them.
  for (let i = 1; i < heroes.length; i++) assert.ok(heroes[i - 1].avg >= heroes[i].avg - 1e-9);
  assert.deepEqual(heroes.map((h) => h.place), heroes.map((_, i) => i + 1));
  assert.ok(heroes.every((h) => h.of === heroes.length));
  assert.equal(heroPowerList(ratings, { minGames: 1 }).tiers.flatMap((t) => t.heroes).length, 11);
});

test("heroRatings: pos keeps only that position's games", () => {
  const games = [0, 1, 2, 3].map((i) => game(i));
  const model = tierModel(games);
  for (const pos of [1, 2, 3, 4, 5]) {
    const all = [...heroRatings(games, { model, pos }).values()].flat();
    assert.ok(all.length && all.every((p) => p.pos === pos));
  }
});

// Two games of one support: 20 and 40 minutes. Per-minute numbers are totals over total minutes,
// so the long game doesn't count double; ward uptime is averaged over every observer.
test("wards and stuns a minute, and average ward uptime", () => {
  const sup = (obs, sen, stuns, obs_pos) => ({ team: "a", account_id: 1, name: "Sup", hero: "Lion", kills: 0, deaths: 0, assists: 0, gpm: 300, xpm: 400, hero_damage: 0, net_worth: 0,
    obs_placed: obs, sen_placed: sen, obs_killed: 1, sen_killed: 1, stuns, obs_pos });
  const game = (min, p) => ({ duration_sec: min * 60, winner: "a", score_a: 10, score_b: 5, team_a: "A", team_b: "B", team_a_id: 1, team_b_id: 2, players: [p] });
  // 20 min: one observer killed after 100s, one still up when the game ends at 1200s (placed at 1000s: 200s).
  // 40 min: one observer that lived its full 360s.
  const games = [game(20, sup(4, 6, 30, [0, 0, 60, 100, 0, 0, 0, 1000, -1, 0])), game(40, sup(8, 12, 60, [0, 0, 300, 360, 0]))];
  assert.deepEqual(wardLife(games[0].players[0], 1200), { t: 300, n: 2 });
  const [r] = playerLeaderboard(games);
  assert.equal(r.obs_pm, 12 / 60);
  assert.equal(r.sen_pm, 18 / 60);
  assert.equal(r.dewards_pm, 4 / 60);
  assert.equal(r.stuns_pm, 90 / 60);
  assert.equal(r.ward_life, (100 + 200 + 360) / 3);
  // Team lines: five of that support on side a, five players without replay stats on side b.
  const full = games.map((g) => ({ ...g, players: [
    ...[1, 2, 3, 4, 5].map((id) => ({ ...g.players[0], account_id: id })),
    ...[6, 7, 8, 9, 10].map((id) => ({ ...g.players[0], team: "b", account_id: id, obs_placed: null, sen_placed: null, obs_killed: null, sen_killed: null, stuns: null, obs_pos: null })),
  ] }));
  const tl = teamLeaderboard(full), t = tl.find((x) => x.id === 1), b = tl.find((x) => x.id === 2);
  assert.equal(t.obs_pm, (5 * 12) / 60);
  assert.equal(t.stuns_pm, (5 * 90) / 60);
  assert.equal(t.ward_life, 220);
  assert.equal(b.obs_pm, null);
  assert.equal(b.ward_life, null);
});
