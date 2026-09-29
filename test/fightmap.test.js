import { test } from "node:test";
import assert from "node:assert/strict";
import { teamFights, ownHalf } from "../public/lib/fightmap.js";

// Flat death_log groups of 6: second, killer, gold, dead, x, y (x > 0 = teamfight spot).
const player = (team, log) => ({ team, name: team, hero: "H", deaths: log.length / 6, death_log: log });
const game = (winner) => ({
  id: "g1", team_a: "Us", team_b: "Them", winner, fights: [900, 960, 3, 1500, 1520, 1],
  players: [
    player("a", [910, 5, 100, 30, 100, 100]), player("a", []), player("a", []), player("a", []), player("a", []),
    player("b", [915, 0, 100, 30, 110, 104, 930, 1, 100, 30, 108, 102]), player("b", [1200, 0, 50, 20, -1, -1]), player("b", []), player("b", []), player("b", []),
  ],
});

test("teamFights: one entry per fight, won when the enemy lost more, pickoffs left out", () => {
  const out = teamFights([game("a")], (m) => "a");
  assert.deepEqual(out.games, [["Them", 1, "g1", "a"]]);
  assert.deepEqual(out.fights, [[106, 102, 900, 1, 2, 0]]); // centre of the three deaths; 1 own, 2 enemy
  assert.equal(out.pts.length, 3); // the 20:00 pickoff has no spot
  assert.equal(out.pts.filter((p) => p[2] === 1).length, 1);
});

test("teamFights mirrors Dire so the team's own base is bottom left", () => {
  const out = teamFights([game("a")], (m) => "b");
  assert.deepEqual(out.games, [["Us", 0, "g1", "b"]]);
  // (106, 102) mirrored about (128.75, 127.95); now 2 own deaths, 1 enemy
  assert.deepEqual(out.fights, [[151.5, 153.9, 900, 2, 1, 0]]);
  assert.equal(ownHalf(100, 100), true);
  assert.equal(ownHalf(160, 160), false);
});
