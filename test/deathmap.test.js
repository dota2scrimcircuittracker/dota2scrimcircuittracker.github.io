import { test } from "node:test";
import assert from "node:assert/strict";
import { deathsFrom, deathsOf, deathMapHtml, playerDeathsHtml, LANE_END } from "../public/lib/deathmap.js";

const KEYS = { 1: "npc_dota_hero_antimage", 2: "npc_dota_hero_axe" };
const player = (slot, hero_id, deaths_log) => ({ player_slot: slot, hero_id, deaths_log });
const empty = (slot) => player(slot, 100 + slot, []);

// Slot 0 Anti-Mage dies in lane to Axe, then twice in one fight (one death logged twice, as
// Meepo's clones do), then alone at 20:00 to a tower. Axe (slot 128) dies once in that fight.
const match = () => ({
  players: [
    player(0, 1, [
      { time: 200, key: "npc_dota_hero_axe", gold_lost: 40, time_dead: 18 },
      { time: 910, key: "npc_dota_hero_axe", gold_lost: 150, time_dead: 30 },
      { time: 910, key: "npc_dota_hero_axe", gold_lost: 150, time_dead: 30 },
      { time: 960, key: "npc_dota_hero_axe", gold_lost: 160, time_dead: 31 },
      { time: 1200, key: "npc_dota_badguys_tower2_mid", gold_lost: 300, time_dead: 45 },
    ]),
    empty(1), empty(2), empty(3), empty(4),
    player(128, 2, [{ time: 930, key: "npc_dota_hero_antimage", gold_lost: 200, time_dead: 33 }]),
    empty(129), empty(130), empty(131), empty(132),
  ],
  teamfights: [{
    start: 900, end: 970, deaths: 3,
    players: [
      { deaths: 2, deaths_pos: { 120: { 130: 1 }, 125: { 128: 1 } } }, { deaths: 0 }, { deaths: 0 }, { deaths: 0 }, { deaths: 0 },
      { deaths: 1, deaths_pos: { 118: { 131: 1 } } }, { deaths: 0 }, { deaths: 0 }, { deaths: 0 }, { deaths: 0 },
    ],
  }],
});

test("deathsFrom: killers, dedupe, teamfight spots", () => {
  const out = deathsFrom(match(), (id) => KEYS[id]);
  assert.deepEqual(out.players[0], [
    200, 5, 40, 18, -1, -1,
    910, 5, 150, 30, 120, 130,
    960, 5, 160, 31, 125, 128,
    1200, -1, 300, 45, -1, -1,
  ]);
  assert.deepEqual(out.players[5], [930, 0, 200, 33, 118, 131]);
  assert.deepEqual(out.fights, [900, 970, 3]);
});

test("without deaths_log, deaths are rebuilt from kills_log; null when neither exists", () => {
  const d = match();
  for (const p of d.players) { delete p.deaths_log; p.kills_log = []; }
  d.players[5].kills_log = [{ time: 200, key: "npc_dota_hero_antimage" }, { time: 1300, key: "npc_dota_hero_antimage" }];
  d.players[0].kills_log = [{ time: 930, key: "npc_dota_hero_axe" }];
  const out = deathsFrom(d, (id) => KEYS[id]);
  assert.equal(out.full, false);
  assert.deepEqual(out.players[0], [200, 5, -1, -1, -1, -1, 1300, 5, -1, -1, -1, -1]);
  assert.deepEqual(out.players[5], [930, 0, -1, -1, 118, 131]);
  delete d.players[3].kills_log;
  assert.equal(deathsFrom(d, (id) => KEYS[id]), null);
});

test("a teamfight death with no recorded spot keeps 0,0", () => {
  const d = match();
  d.teamfights[0].players[0].deaths_pos = { 120: { 130: 1 } };
  assert.deepEqual(deathsFrom(d, (id) => KEYS[id]).players[0].slice(12, 18), [960, 5, 160, 31, 0, 0]);
});

const game = () => {
  const d = deathsFrom(match(), (id) => KEYS[id]);
  return {
    team_a: "Rad", team_b: "Dire", duration_sec: 1800, fights: d.fights,
    players: d.players.map((log, i) => ({ team: i < 5 ? "a" : "b", name: `P${i}`, hero: i === 0 ? "Anti-Mage" : i === 5 ? "Axe" : `H${i}`, death_log: log })),
  };
};

test("deathsOf sorts deaths into lane, pickoff and fight", () => {
  const ds = deathsOf(game());
  assert.deepEqual(ds.map((d) => [d.t, d.kind]), [[200, "lane"], [910, "fight"], [930, "fight"], [960, "fight"], [1200, "pickoff"]]);
  assert.ok(200 < LANE_END && 1200 > LANE_END);
});

const card = (html) => JSON.parse(html.match(/data-deaths="([^"]*)"/)[1].replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&amp;/g, "&"));

test("the game card carries every death with its killer; empty without data", () => {
  const D = card(deathMapHtml(game()));
  assert.equal(D.mode, "game");
  assert.deepEqual(D.d.map((x) => [x[1], x[4], x[8]]), [[200, 1, "a"], [910, 0, "a"], [930, 0, "b"], [960, 0, "a"], [1200, 2, "a"]]);
  assert.equal(D.d[4][7], "P0 (Anti-Mage) died at 20:00 to a tower. Lost 300 gold, dead 45s.");
  assert.equal(D.d[0][7], "P0 (Anti-Mage) died at 3:20 to P5 (Axe). Lost 40 gold, dead 18s.");
  assert.equal(deathMapHtml({ ...game(), players: game().players.map((p) => ({ ...p, death_log: null })) }), "");
});

test("the player card keeps only that player, mirrors Dire games, splits wins and losses", () => {
  const won = { ...game(), id: "1", winner: "a" };
  const lost = { ...game(), id: "2", winner: "a" }; // Axe (Dire) lost this one
  const D = card(playerDeathsHtml([won, lost], (p) => p.hero === "Axe"));
  assert.equal(D.mode, "player");
  assert.deepEqual(D.games, [["Axe", "l"], ["Axe", "l"]]);
  assert.equal(D.d[0][10], "Axe");
  assert.equal(D.d.length, 2);
  // 118,131 mirrored about the map centre (128.75, 127.95)
  assert.deepEqual([D.d[0][2], D.d[0][3], D.d[0][8]], [139.5, 124.9, "l"]);
  assert.equal(D.d[0][7], "Axe vs Rad (lost): died at 15:30 to P0 (Anti-Mage). Lost 200 gold, dead 33s.");
  assert.equal(D.d[0][9], "15:30 · Axe vs Rad (L) · by Anti-Mage");
  assert.equal(playerDeathsHtml([won], (p) => p.hero === "Nobody"), "");
});

test("kills: each hero death credited to the killer, in the victim's spot", () => {
  const D = card(deathMapHtml(game()));
  // Axe (5) killed Anti-Mage at 3:20, 15:10 and 16:00; Anti-Mage killed Axe at 15:30. The tower kill isn't a kill.
  assert.deepEqual(D.k.map((x) => [x[0], x[1], x[8], x[10]]), [[5, 200, "b", "Axe"], [5, 910, "b", "Axe"], [0, 930, "a", "Anti-Mage"], [5, 960, "b", "Axe"]]);
  assert.deepEqual([D.k[1][2], D.k[1][3], D.k[1][4]], [120, 130, 0]);
  const P = card(playerDeathsHtml([{ ...game(), winner: "b" }], (p) => p.hero === "Axe"));
  assert.equal(P.k.length, 3);
  assert.equal(P.k[0][11], "Anti-Mage"); // the map shows who they killed
  assert.equal(P.k[0][9], "3:20 · Axe killed Anti-Mage · vs Rad (W)");
});
