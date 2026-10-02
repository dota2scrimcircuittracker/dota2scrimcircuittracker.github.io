import { test } from "node:test";
import assert from "node:assert/strict";
import { firstBloodRecord, streakRuns, bestStreakOf, multiKillsOf, firstBloodOf, deathSources, fullDeathLog, teamSplits, playerPairs, sideRecord, heroPairs, heroNeutrals, skillGrid, pubPrep, medalValue, medalFit, pausesOf, hitSource, heroOfSlug, benchSummary, combatTotals } from "../public/lib/combat.js";
import { combatSummary } from "../public/lib/stats.js";
import { combatFields, gameExtras, detailOf, firstBloodFrom, firstDeathOf } from "../scripts/sync/combat-fields.js";
import { streakChartHtml, skillGridHtml, buildOrderHtml, medalScatterHtml } from "../public/lib/combat-charts.js";

// death_log entry: [second, killer, gold lost, seconds dead, x, y]
const death = (t, killer, gold = 100) => [t, killer, gold, 20, -1, -1];
const pl = (team, i, extra = {}) => ({ team, name: `${team}${i}`, player_key: `${team}${i}`, hero: `Hero${team}${i}`, kills: 0, deaths: 0, assists: 0, death_log: [], kill_t: [], ...extra });
const game = (over = {}, players = null) => ({
  winner: "a", duration_sec: 2400, team_a: "A", team_b: "B",
  players: players ?? [0, 1, 2, 3, 4].map((i) => pl("a", i)).concat([0, 1, 2, 3, 4].map((i) => pl("b", i))),
  ...over,
});

test("streak runs climb per kill and reset at a death, with who ended them", () => {
  const m = game();
  m.players[0].kill_t = [100, 200, 300, 900];
  m.players[0].death_log = [...death(500, 7)];
  const { runs, points } = streakRuns(m, 0);
  assert.equal(runs.length, 2);
  assert.deepEqual(runs[0], { start: 100, kills: [100, 200, 300], peak: 3, peakT: 300, end: 500, endedBy: 7 });
  assert.equal(runs[1].end, null); // alive at the end
  assert.deepEqual(points.map((p) => p[1]), [1, 2, 3, 0, 1]);
});

test("a kill and a death in the same second count the kill first", () => {
  const m = game();
  m.players[0].kill_t = [100, 200];
  m.players[0].death_log = [...death(200, 6)];
  assert.equal(streakRuns(m, 0).runs[0].peak, 2);
});

test("best streak: OpenDota's level when 3-9, the kill log for 0-2 and for 10+", () => {
  const m = game();
  m.players[0].streaks = [1, 1, 0, 0, 0, 0, 0, 0];
  assert.equal(bestStreakOf(m, 0), 4);
  m.players[1].streaks = [0, 0, 0, 0, 0, 0, 0, 0];
  m.players[1].kill_t = [10, 20];
  m.players[1].death_log = [...death(15, 5)];
  assert.equal(bestStreakOf(m, 1), 1);
  m.players[2].streaks = [1, 1, 1, 1, 1, 1, 1, 1];
  m.players[2].kill_t = Array.from({ length: 12 }, (_, k) => k * 10);
  assert.equal(bestStreakOf(m, 2), 12);
});

test("leaderboard best streak and multi totals", () => {
  const s = combatSummary([
    { apm: 100, streaks: [1, 1, 0, 0, 0, 0, 0, 0], multi: [2, 1, 0, 0], kill_t: [], runes: [0, 0, 0, 0, 0, 3, 0, 0, 0, 0], first_blood: 1, tf_part: 0.5, pings: 10, courier_kills: 1 },
    { apm: 200, streaks: [0, 0, 0, 0, 0, 0, 0, 0], multi: [0, 0, 0, 1], kill_t: [1, 2], death_log: [], runes: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0], first_blood: 0, tf_part: 0.7, pings: 0, courier_kills: 0 },
    { apm: null }, // a screenshot game: no combat data, left out
  ]);
  assert.equal(s.combat_games, 2);
  assert.equal(s.apm, 150);
  assert.equal(s.best_streak, 4);
  assert.deepEqual([s.doubles, s.triples, s.ultras, s.rampages], [2, 1, 0, 1]);
  assert.equal(s.fb_rate, 0.5);
  assert.equal(s.runes_pg, 2);
  assert.equal(s.courier_kills, 1);
});

test("multi-kills chain kills within the window", () => {
  assert.deepEqual(multiKillsOf({ kill_t: [100, 110, 125, 300, 310, 600] }), [{ t: 100, end: 125, n: 3 }, { t: 300, end: 310, n: 2 }]);
  assert.deepEqual(multiKillsOf({ kill_t: [] }), []);
});

test("first blood: the flagged player's first kill, and the victim from the death log", () => {
  const m = game();
  m.players[2].kill_t = [-20, 400];
  m.players[2].first_blood = 1;
  m.players[7].death_log = [...death(-20, 2)];
  m.players[8].kill_t = [50];
  assert.deepEqual(firstBloodOf(m), { i: 2, team: "a", t: -20, victim: 7 });
  delete m.players[2].first_blood;
  assert.equal(firstBloodOf(m).i, 2); // earliest kill without a flag
  assert.equal(firstBloodOf({ players: [pl("a", 0, { kill_t: undefined })] }), null);
});

test("deaths by source skip games whose log only has hero deaths", () => {
  const full = game();
  full.players[0].death_log = [...death(100, 6), ...death(200, -1), ...death(300, -3)];
  const rebuilt = game();
  rebuilt.players[0].death_log = [...death(100, 6, -1)];
  assert.ok(fullDeathLog(full));
  assert.ok(!fullDeathLog(rebuilt));
  const r = deathSources([full, rebuilt], (p) => p.name === "a0");
  assert.equal(r.games, 1);
  assert.equal(r.skipped, 1);
  assert.deepEqual(r.by, { hero: 1, tower: 1, creep: 0, neutral: 1, other: 0 });
  assert.deepEqual(r.killers, [{ hero: "Herob1", n: 1 }]);
});

test("team splits: sides, stand-ins, length, lead at a minute, first blood, aegis", () => {
  const g1 = game({ winner: "a", duration_sec: 25 * 60, gold_adv: Array.from({ length: 26 }, () => 1000), objectives: [{ type: "aegis_stolen", side: "a", time: 1500 }] });
  g1.players[0].kill_t = [60]; g1.players[0].first_blood = 1;
  const g2 = game({ winner: "a", duration_sec: 50 * 60, gold_adv: Array.from({ length: 51 }, (_, i) => (i < 20 ? 500 : -500)) });
  g2.players[3].standin = true;
  const s = teamSplits([g1, g2], (m) => (m === g1 ? "a" : "b"));
  assert.deepEqual(s.sides, { a: { games: 1, wins: 1 }, b: { games: 1, wins: 0 } });
  assert.deepEqual(s.standin.with, { games: 0, wins: 0 }); // g2's stand-in is on side a, not the team's side b
  assert.deepEqual(s.length.map((l) => l.games), [1, 0, 1]);
  assert.deepEqual(s.lead[10], { ahead: { games: 1, wins: 1 }, behind: { games: 1, wins: 0 } });
  assert.deepEqual(s.lead[30], { ahead: { games: 1, wins: 0 }, behind: { games: 0, wins: 0 } }); // g1 ended before 30'
  assert.deepEqual(s.first_blood, { games: 1, taken: 1, wins_taken: 1, wins_given: 0, times: [60] });
  assert.deepEqual(s.aegis, { stole: 1, lost: 0 });
});

test("player pairs and lineups count games together", () => {
  const g1 = game({ winner: "a" }), g2 = game({ winner: "b" });
  const r = playerPairs([g1, g2], () => "a");
  assert.equal(r.pairs.length, 10);
  assert.deepEqual([r.pairs[0].games, r.pairs[0].wins], [2, 1]);
  assert.equal(r.lineups.length, 1);
  assert.equal(r.lineups[0].players.length, 5);
});

test("radiant record, hero pairs and neutral items", () => {
  const g1 = game({ winner: "a", draft: [{}] }), g2 = game({ winner: "b", draft: [{}] }), g3 = game({ winner: "a" });
  assert.deepEqual(sideRecord([g1, g2, g3]), { games: 2, wins: 1, win_rate: 0.5 });
  g1.players[0].items = [null, null, null, null, null, null, "mysterious_hat"];
  const { allies, enemies } = heroPairs([g1, g2], "Heroa0");
  assert.deepEqual(allies.find((x) => x.hero === "Heroa1"), { hero: "Heroa1", games: 2, wins: 1, win_rate: 0.5 });
  assert.equal(enemies.length, 5);
  assert.deepEqual(heroNeutrals([g1, g2], "Heroa0"), [{ key: "mysterious_hat", games: 1, wins: 1, win_rate: 1 }]);
});

test("skill grid: share per level, talents in one row, the common opening", () => {
  const names = { 1: ["q", "Q"], 2: ["w", "W"], 3: ["special_bonus_x", "Talent X"], 4: ["special_bonus_y", "Talent Y"] };
  const named = (id) => names[id] ?? null;
  const g = skillGrid([[1, 2, 1, 3], [1, 2, 1, 4], [2, 1, 1, 3]], named, 4);
  assert.equal(g.builds, 3);
  const q = g.rows.find((r) => r.key === "q"), t = g.rows.find((r) => r.talent);
  assert.deepEqual(q.cells.map((c) => c.n), [2, 1, 3, 0]);
  assert.deepEqual(t.cells[3].picks.map((p) => [p.name, p.n]), [["Talent X", 2], ["Talent Y", 1]]);
  assert.equal(g.rows.at(-1).talent, true);
  assert.deepEqual(g.common, { seq: ["1", "2", "1", "talent"], n: 2 });
  assert.match(skillGridHtml(g, named), /Talents/);
});

test("pub practice splits league games by a pub on the hero that week", () => {
  const day = 86400, since = 1000 * day;
  // flat groups of 7: start, hero, won, k, d, a, ranked
  const pubs = [since + 9 * day, "Axe", 1, 0, 0, 0, 0, since + 2 * day, "Lina", 1, 0, 0, 0, 0];
  const at = (d, hero, won) => ({ m: { start_time: since + d * day }, p: { hero }, won });
  const r = pubPrep(pubs, [at(10, "Axe", true), at(11, "Lina", false), at(3, "Axe", true)], since, 7);
  assert.equal(r.games, 2); // the day-3 game is too early: its week isn't all in the log
  assert.deepEqual(r.practiced, { games: 1, wins: 1 });
  assert.deepEqual(r.fresh, { games: 1, wins: 0 }); // Lina's pub was 9 days before
});

test("medal scale and fit", () => {
  assert.equal(medalValue(11), 1);
  assert.equal(medalValue(75), 35);
  assert.equal(medalValue(80), 36);
  assert.equal(medalValue(null), null);
  const fit = medalFit([{ medal: 10, rating: 40 }, { medal: 20, rating: 50 }, { medal: 30, rating: 60 }, { medal: 20, rating: 70 }]);
  assert.ok(Math.abs(fit.slope - 1) < 1e-9);
  assert.ok(fit.points.find((p) => p.rating === 70).gap > 0);
});

test("pauses, hit sources and hero slugs", () => {
  assert.deepEqual(pausesOf({ pauses: [-60, 30, 900, 45] }), { n: 2, total: 75 });
  assert.equal(pausesOf({}), null);
  assert.equal(hitSource("void_spirit_dissimilate"), "Dissimilate");
  assert.equal(hitSource(null), "Right-click");
  assert.equal(hitSource("item_dagon", (k) => `item:${k}`), "item:item_dagon");
  assert.equal(heroOfSlug("vengefulspirit"), "Vengeful Spirit");
});

test("benchmarks and combat totals over player-games", () => {
  const b = benchSummary([{ bench: [50, 60, null, 0, 0, 0, 0] }, { bench: [70, 80, 40, 0, 0, 0, 0] }, {}]);
  assert.equal(b.games, 2);
  assert.deepEqual(b.avg.slice(0, 3), [60, 70, 40]);
  const t = combatTotals([{ apm: 1, multi: [1, 0, 0, 1], streaks: [2, 1, 0, 0, 0, 0, 0, 0], runes: [0, 0, 0, 0, 0, 2, 0, 0, 0, 0] }, { apm: 1, multi: [1, 0, 0, 0] }]);
  assert.deepEqual(t.multi, [2, 0, 0, 1]);
  assert.deepEqual(t.streaks.slice(0, 2), [2, 1]);
});

test("sync fields from an OpenDota player and match", () => {
  const p = combatFields({
    kills_log: [{ time: 10, key: "x" }, { time: 20, key: "y", smoke: true }], actions_per_min: 250, teamfight_participation: 0.6666, firstblood_claimed: 1,
    multi_kills: { 2: 3, 6: 1 }, kill_streaks: { 3: 2, 12: 1 }, runes: { 5: 4, 0: 1 }, courier_kills: 1, pings: 7,
    max_hero_hit: { value: 900, inflictor: "lina_laguna_blade", key: "npc_dota_hero_axe" },
    benchmarks: { gold_per_min: { pct: 0.5 }, xp_per_min: { pct: 0.991 } },
  });
  assert.equal(p.apm, 250);
  assert.equal(p.tf_part, 0.67);
  assert.deepEqual(p.multi, [3, 0, 0, 1]); // 6 kills counts as a rampage
  assert.deepEqual(p.streaks, [2, 0, 0, 0, 0, 0, 0, 1]); // 12 counts as 10+
  assert.deepEqual(p.runes, [1, 0, 0, 0, 0, 4, 0, 0, 0, 0]);
  assert.deepEqual(p.max_hit, [900, "lina_laguna_blade", "axe"]);
  assert.deepEqual(p.bench.slice(0, 3), [50, 99, null]);
  assert.deepEqual(p.kill_t, [10, 20]);
  assert.deepEqual(p.smoke_kill_t, [20]);
  assert.equal(combatFields({}).apm, null); // unparsed
  assert.deepEqual(gameExtras({ pauses: [{ time: 5, duration: 30 }] }), { first_blood_at: null, pauses: [5, 30], fight_smokes: null });
  // Smokes per teamfight: [Radiant, Dire] per fight, teamfight players in d.players order.
  assert.deepEqual(gameExtras({ players: [{ isRadiant: true }, { isRadiant: false }, { isRadiant: false }], teamfights: [
    { players: [{ item_uses: { smoke_of_deceit: 1 } }, { item_uses: { smoke_of_deceit: 1 } }, { item_uses: { smoke_of_deceit: 1 } }] },
    { players: [{}, {}, {}] },
  ] }).fight_smokes, [1, 2, 0, 0]);
  const det = detailOf({ players: [
    { player_slot: 128, purchase_log: [{ key: "tango", time: -80 }, { key: "tango", time: 300 }, { key: "blink", time: 600 }], ability_upgrades_arr: [5, 6] },
    { player_slot: 0, purchase_log: [], ability_upgrades_arr: null },
  ] });
  assert.deepEqual(det[1], { buy: ["tango", -80, "blink", 600], skills: [5, 6] }); // mid-game tango dropped; slot order
  assert.equal(det[0].skills, null);
});

test("charts render from a game", () => {
  const m = game({ id: "g1" });
  m.players[0].kill_t = [100, 200, 300, 310];
  m.players[0].death_log = [...death(500, 7)];
  m.players[0].hero = "Axe";
  const html = streakChartHtml(m);
  assert.match(html, /Unstoppable|Mega Kill|Dominating/);
  assert.match(html, /ended by b2/);
  assert.equal(streakChartHtml(game({ players: [pl("a", 0, { kill_t: undefined })] })), "");
  const bo = buildOrderHtml(m, m.players.map(() => ({ buy: ["tango", -80, "branches", -80, "blink", 600, "recipe_x", 700], skills: [] })));
  assert.match(bo, /Blink Dagger/);
  assert.doesNotMatch(bo, /recipe_x/);
  assert.equal(medalScatterHtml([{ medal: 1, rating: 1 }]), "");
});

test("first blood from OpenDota: the flagged killer's first kill and its victim", () => {
  // slots out of order on purpose: indexes are into slot order (0-4 Radiant, 128-132 Dire)
  const od = { players: [
    { player_slot: 128, isRadiant: false, hero_id: 2, kills_log: [{ time: 30, key: "npc_dota_hero_bane" }] },
    { player_slot: 0, isRadiant: true, hero_id: 3, firstblood_claimed: 1, kills_log: [{ time: 95, key: "npc_dota_hero_axe" }, { time: 40, key: "npc_dota_hero_axe" }] },
  ] };
  assert.deepEqual(firstBloodFrom(od), [40, 0, 1]); // flagged over the earlier unflagged kill
  delete od.players[1].firstblood_claimed;
  assert.deepEqual(firstBloodFrom(od), [30, 1, 0]); // no flag: earliest kill
  assert.equal(firstBloodFrom({ players: [{ player_slot: 0 }] }), null);
  assert.equal(firstDeathOf([30, 1, 0], 0), 1);
  assert.equal(firstDeathOf([30, 1, 0], 1), 0);
  assert.equal(firstDeathOf(null, 0), null);
});

test("stored first blood wins over the logs; the drawing team's record", () => {
  const m = game({ first_blood_at: [-15, 6, 3], winner: "b" });
  m.players[0].kill_t = [5];
  assert.deepEqual(firstBloodOf(m), { i: 6, team: "b", t: -15, victim: 3 });
  const n = game({ first_blood_at: [100, 1, 7], winner: "b" });
  assert.deepEqual(firstBloodRecord([m, n]), { games: 2, wins: 1, win_rate: 0.5 });
  const s = combatSummary([{ apm: 1, first_blood: 1, first_death: 0 }, { apm: 1, first_blood: 0, first_death: 1 }, { apm: 1, first_blood: 0, first_death: 0 }]);
  assert.deepEqual([s.first_bloods, s.fb_deaths], [1, 1]);
  assert.ok(Math.abs(s.fb_death_rate - 1 / 3) < 1e-9);
});
