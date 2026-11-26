import { test } from "node:test";
import assert from "node:assert/strict";
import { teamGames, hotspot, overview, visionOf, dangerOf, killClock, clutchOf, siegeOf, teamWrapped, teamRanks } from "../public/lib/team-wrapped.js";
import { CX, CY } from "../public/lib/wardmap.js";

// A game between teams 1 (side a) and 2 (side b) unless swapped; winner "a" or "b".
let gid = 0;
function game(winner, { swap = false, gold_adv = [], stat = {}, objectives = [], buildings = [], duration = 1800 } = {}) {
  const players = ["a", "b"].flatMap((team) => [1, 2, 3, 4, 5].map((pos) => {
    const key = `${team}${pos}`;
    return { team, name: key, player_key: key, hero: `h${key}`, kills: 2, deaths: 2, assists: 2, obs_placed: 0, camps_stacked: 0, tower_damage: 1000, obs_pos: [], death_log: [], kill_t: [], ...(stat[key] ?? {}) };
  }));
  return { id: ++gid, team_a_id: swap ? 2 : 1, team_b_id: swap ? 1 : 2, team_a: swap ? "Two" : "One", team_b: swap ? "One" : "Two", winner, duration_sec: duration, gold_adv, objectives, buildings, players };
}

test("teamGames finds the team on either side", () => {
  const tg = teamGames([game("a"), game("a", { swap: true })], 1);
  assert.deepEqual(tg.map((g) => g.side), ["a", "b"]);
});

test("hotspot picks the densest cluster", () => {
  const h = hotspot([[100, 100], [101, 100], [100, 101], [150, 150]], 5);
  assert.equal(h.n, 3);
  assert.ok(Math.abs(h.x - 100.3) < 0.1);
});

test("overview counts the record and the roster", () => {
  const o = overview(teamGames([game("a"), game("b"), game("b", { swap: true })], 1));
  assert.equal(o.wins, 2); assert.equal(o.losses, 1);
  assert.equal(o.roster.length, 10); // a1-a5 played for team 1 on side a, b1-b5 when it was side b
  assert.equal(o.roster[0].games, 2);
});

test("visionOf mirrors Dire wards and caps life at six minutes", () => {
  const w = [];
  for (let i = 0; i < 10; i++) w.push(100, 100, 60 * i, -1, i < 2 ? 1 : 0);
  const v = visionOf(teamGames([game("a", { swap: true, stat: { b4: { obs_pos: w } }, duration: 3000 })], 1));
  assert.equal(v.total, 10);
  assert.equal(v.wards[0].x, +(2 * CX - 100).toFixed(1));
  assert.equal(v.wards[0].y, +(2 * CY - 100).toFixed(1));
  assert.ok(v.wards.every((x) => x.life <= 360));
  assert.equal(v.unfound, 0.8);
});

test("dangerOf keeps teamfight deaths only", () => {
  const log = [];
  for (let i = 0; i < 8; i++) log.push(100 * i, 5, 0, 10, 120, 120);
  log.push(900, 5, 0, 10, -1, -1); // a lane death: no spot
  const d = dangerOf(teamGames([game("a", { stat: { a1: { death_log: log } } })], 1));
  assert.equal(d.pts.length, 8);
});

test("killClock bins kills by five minutes and reads the first blood rate", () => {
  // Two 30-minute games, so each 5-minute stretch has the 10 minutes of play a peak needs.
  const kills = Array.from({ length: 10 }, (_, i) => 600 + i);
  const k = killClock(teamGames([game("a", { stat: { a1: { kill_t: kills, first_blood: 1 } } }), game("a", { stat: { a1: { kill_t: kills } } })], 1));
  assert.equal(k.peak, 2); assert.equal(k.total, 20);
  assert.equal(k.fbWins, 1); assert.equal(k.fbWinRate, 1); assert.equal(k.games, 2); assert.equal(k.perGame[2], 10);
});

test("clutchOf finds the comeback from the team's own side", () => {
  // Team 1 is Dire here: gold_adv is Radiant's lead, so +6000 means team 1 was 6k down.
  const c = clutchOf(teamGames([game("b", { swap: true, gold_adv: [0, 6000, 2000, -3000] })], 1));
  assert.equal(c.comeback.d, 6000);
  assert.equal(c.behind, 1); assert.equal(c.behindWins, 1);
  assert.equal(c.thrown, null);
});

test("siegeOf counts the team's objectives and the enemy's buildings", () => {
  const s = siegeOf(teamGames([game("a", { objectives: [{ type: "roshan", side: "a" }, { type: "roshan", side: "b" }, { type: "tormentor", side: "a" }],
    buildings: [{ side: "b", b: "t1_top" }, { side: "b", b: "melee_top" }, { side: "a", b: "t1_bot" }] })], 1));
  assert.deepEqual([s.roshans, s.tormentors, s.towers, s.rax], [1, 1, 1, 1]);
});

test("teamWrapped needs three games", () => {
  assert.equal(teamWrapped([game("a"), game("a")], 1), null);
  assert.equal(teamWrapped([game("a"), game("a"), game("b")], 1).name, "One");
});

test("draftOf reads bans against, first and last picks, and who the bans target", async () => {
  const { draftOf } = await import("../public/lib/team-wrapped.js");
  const { phasedDraft } = await import("../public/lib/draft.js");
  // Team 1 is side a with first pick; b bans a1's hero twice; a's 5th pick is a core (pos 2).
  const draft = [
    { order: 0, pick: false, side: "b", hero: "ha1" }, { order: 1, pick: false, side: "a", hero: "X" },
    { order: 2, pick: true, side: "a", hero: "ha5" }, { order: 3, pick: true, side: "b", hero: "hb1" },
    { order: 4, pick: true, side: "a", hero: "ha4" }, { order: 5, pick: true, side: "a", hero: "ha3" },
    { order: 6, pick: true, side: "a", hero: "ha1" }, { order: 7, pick: true, side: "a", hero: "ha2" },
  ];
  const stat = { a1: { position: 1 }, a2: { position: 2 }, a3: { position: 3 }, a4: { position: 4 }, a5: { position: 5 } };
  const games = [game("a", { stat }), game("b", { stat }), game("a", { stat })].map((m) => ({ ...m, draft }));
  const d = draftOf(games, 1, phasedDraft);
  assert.equal(d.against[0].hero, "ha1"); assert.equal(d.against[0].n, 3); assert.equal(d.against[0].who, "a1");
  assert.equal(d.magnets[0].name, "a1");
  assert.equal(d.first[0].hero, "ha5"); assert.equal(d.firstCore, 0);
  assert.equal(d.last[0].hero, "ha2"); assert.equal(d.lastCore, 1);
  assert.deepEqual(d.order.first, { n: 3, w: 2 });
  assert.equal(d.pool.heroes, 5);
});

test("tempoOf splits the record by game length and counts back-and-forth games", async () => {
  const { tempoOf } = await import("../public/lib/team-wrapped.js");
  const t = tempoOf([game("a", { duration: 1500 }), game("b", { duration: 2700, gold_adv: [0, 4000, -4000] }), game("a", { duration: 2700 })], 1);
  const len = (lo) => { const b = t.lengths.find((x) => x.lo === lo); return { n: b.n, w: b.w }; };
  assert.deepEqual(len(0), { n: 1, w: 1 }); assert.deepEqual(len(40), { n: 2, w: 1 });
  assert.deepEqual(t.swing, { n: 1, w: 0 });
});

test("styleOf names the team by its strongest trait against the division", async () => {
  const { styleOf } = await import("../public/lib/team-wrapped.js");
  // Teams 1-3 play each other; team 1 lights far more smokes than anyone.
  const vs = (a, b, smoke) => ({ ...game("a", { stat: { a1: { smoke_used: smoke } } }), team_a_id: a, team_b_id: b });
  const games = [];
  for (let i = 0; i < 4; i++) games.push(vs(1, 2, 20), vs(2, 3, 0), vs(3, 1, 0));
  assert.equal(styleOf(games, 1).top.key, "smoke");
});

test("teamRanks ranks against teams with 4+ games", () => {
  const games = [1, 2, 3, 4].map(() => game("a", { stat: { a1: { smoke_used: 5 } } }));
  assert.deepEqual(teamRanks(games, 1).smokes, { rank: 1, of: 2 });
});
