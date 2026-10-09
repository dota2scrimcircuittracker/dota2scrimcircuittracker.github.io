import { test } from "node:test";
import assert from "node:assert/strict";
import { laneRoleOf, gameLanes, laneCuts, verdict, playerLane, laneSummary, laneBoard, tierLaneResult, FALLBACK_CUT } from "../public/lib/lanes.js";

// A player with gold + XP at 10 = g (gold_t[10] = g, xp10 = 0).
const pl = (team, position, lane_role, g, extra = {}) => ({
  team, position, lane_role, name: `${team}${position}`, player_key: `${team}${position}`, hero: `H${team}${position}`,
  gold_t: Array.from({ length: 11 }, (_, i) => (i === 10 ? g : 0)), xp10: 0, ...extra,
});
// Standard lanes: Radiant (a) safe 1+5 vs Dire (b) off 3+4 at the bottom, and so on.
const game = (over = {}) => ({
  winner: "a",
  players: [
    pl("a", 1, 1, 5000), pl("a", 2, 2, 6000), pl("a", 3, 3, 4000), pl("a", 4, 3, 2000), pl("a", 5, 1, 2000),
    pl("b", 1, 1, 4500), pl("b", 2, 2, 6500), pl("b", 3, 3, 3000), pl("b", 4, 3, 2000), pl("b", 5, 1, 1500),
  ],
  ...over,
});

test("lane role from the replay, else from position; jungle has none", () => {
  assert.equal(laneRoleOf({ lane_role: 3, position: 1 }), 3);
  assert.equal(laneRoleOf({ lane_role: 4, position: 4 }), null);
  assert.equal(laneRoleOf({ lane_role: null, position: 5 }), 1);
  assert.equal(laneRoleOf({ position: 4 }), 3);
  assert.equal(laneRoleOf({}), null);
});

test("each lane pairs Radiant's role with Dire's opposite role; margin is Radiant's lead", () => {
  const [bot, mid, top] = gameLanes(game());
  // bottom: a safe (5000 + 2000) vs b off (3000 + 2000)
  assert.equal(bot.margin, 2000);
  assert.deepEqual(bot.b.map((p) => p.position), [3, 4]);
  assert.equal(mid.margin, -500);
  // top: a off (4000 + 2000) vs b safe (4500 + 1500)
  assert.equal(top.margin, 0);
});

test("a swapped lane follows the replay, not the position", () => {
  const m = game();
  m.players[3].lane_role = 1; // Radiant pos 4 went bottom with the carry: tri-lane
  const [bot, , top] = gameLanes(m);
  assert.equal(bot.a.length, 3);
  // 3v2 and 1v2 now: compared per hero, scaled to the average side size.
  assert.equal(bot.margin, (9000 / 3 - 5000 / 2) * 2.5);
  assert.equal(top.margin, (4000 - 6000 / 2) * 1.5);
});

test("cut-offs: a third of lanes each way; too few lanes falls back", () => {
  assert.deepEqual(laneCuts([game()]), { side: FALLBACK_CUT, mid: FALLBACK_CUT, lanes: 3 });
  // Bottom margins 0..900 step 100, top always 0: 20 side lanes, 11 of them at 0, so the
  // 1/3 quantile of |margin| is 0 and any lead wins.
  const games = Array.from({ length: 10 }, (_, i) => {
    const m = game();
    m.players[0].gold_t[10] = 3000 + i * 100; // bottom: a 3000+i*100 + 2000 vs b 5000
    return m;
  });
  const c = laneCuts(games);
  assert.equal(c.side, 0);
  assert.equal(verdict(301, 300), "won");
  assert.equal(verdict(-300, 300), "even");
  assert.equal(verdict(-301, 300), "lost");
  assert.equal(verdict(null, 300), null);
});

test("playerLane: own side of the lane, early kills and deaths", () => {
  const m = game();
  // death_log groups of 6: second, killer (player index), gold, dead, x, y
  m.players.forEach((p) => (p.death_log = []));
  m.players[5].death_log = [300, 0, 100, 20, -1, -1, 900, 0, 100, 20, -1, -1]; // b1 killed by a1 twice (one after 10')
  const cuts = { side: 1000, mid: 1000 };
  const a1 = playerLane(m, m.players[0], cuts), b3 = playerLane(m, m.players[7], cuts);
  assert.equal(a1.margin, 2000);
  assert.equal(a1.verdict, "won");
  assert.equal(a1.kills10, 1);
  assert.equal(b3.margin, -2000);
  assert.equal(b3.verdict, "lost");
  assert.deepEqual(a1.foes.map((p) => p.position), [3, 4]);
  assert.equal(playerLane(m, { ...m.players[0], lane_role: 4 }, cuts), null);
});

test("summary and board: even lanes count half; score is padded toward even", () => {
  const rows = [{ verdict: "won", score: 2, margin: 2000, won: true }, { verdict: "even", score: 0, margin: 0, won: false }];
  const s = laneSummary(rows, 2);
  assert.equal(s.lane_rate, 0.75);
  assert.equal(s.score, 0.5);
  assert.equal(s.win_when_won, 1);
  const board = laneBoard([game()], { side: 1000, mid: 1000 }, (p) => p.player_key);
  assert.equal(board.find((r) => r.key === "a1").group, "safe");
  assert.equal(board.find((r) => r.key === "b5").group, "support");
});

test("tier lane result: cores against the enemy cores in their lane, supports lane against lane", () => {
  const m = game();
  assert.equal(tierLaneResult(m, m.players[0]), 5000 - 3000); // a1 vs b3
  assert.equal(tierLaneResult(m, m.players[4]), 2000); // a5: (5000+2000) - (3000+2000)
  assert.equal(tierLaneResult(m, m.players[1]), -500);
  m.players[9].lane_role = 4; // b5 jungles
  assert.equal(tierLaneResult(m, m.players[9]), null);
});

test("uneven lanes compare per hero: a solo core who out-farms a duo wins it", () => {
  // Bottom 1v2: a's safe core alone (8600) vs b's off 3 + 4 (6600 + 4400). Top 3v2: a's off
  // 3 + 4 + a roaming 5 vs b's safe 1 + 5.
  const m = game({ players: [
    pl("a", 1, 1, 8600), pl("a", 2, 2, 6000), pl("a", 3, 3, 5700), pl("a", 4, 3, 4500), pl("a", 5, 3, 5200),
    pl("b", 1, 1, 8400), pl("b", 2, 2, 6000), pl("b", 3, 3, 6600), pl("b", 4, 3, 4400), pl("b", 5, 1, 4800),
  ] });
  const [bot, , top] = gameLanes(m);
  assert.equal(bot.margin, Math.round((8600 - 5500) * 1.5)); // the sum would say -2400
  assert.equal(top.margin, Math.round((5133.33 - 6600) * 2.5)); // the sum would say +2200
  // Equal sides are still the plain sum.
  assert.equal(gameLanes(game())[0].margin, 7000 - 5000);
  // The tier list's support lane result follows the same rule.
  assert.equal(tierLaneResult(m, m.players[4]), top.margin);
});
