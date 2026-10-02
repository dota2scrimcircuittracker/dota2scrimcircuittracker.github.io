import { test } from "node:test";
import assert from "node:assert/strict";
import { smokeKillsOf, teamSmokes, hasSmokes } from "../public/lib/smokemap.js";

// Two players a side is enough: death_log rows are [second, killer, gold, dead, x, y].
const game = () => ({
  id: "1", team_a: "A", team_b: "B", winner: "a", duration_sec: 1800,
  players: [
    { team: "a", hero: "Axe", kills: 2, smoke_used: 2, smoke_kill_t: [600], death_log: [] },
    { team: "a", hero: "Lina", kills: 0, smoke_used: 1, smoke_kill_t: [], death_log: [] },
    { team: "b", hero: "Lion", kills: 1, smoke_used: 0, smoke_kill_t: [900], death_log: [600, 0, 100, 20, 120, 130] },
    { team: "b", hero: "Zeus", kills: 0, smoke_used: 0, smoke_kill_t: [], death_log: [] },
  ],
});

test("smoked kills are matched to the victim's death and its spot", () => {
  const m = game();
  m.players[1].death_log = [900, 2, -1, -1, -1, -1]; // a pickoff: no spot
  assert.ok(hasSmokes(m));
  assert.deepEqual(smokeKillsOf(m), [
    { i: 0, v: 2, team: "a", t: 600, x: 120, y: 130 },
    { i: 2, v: 1, team: "b", t: 900, x: -1, y: -1 },
  ]);
});

test("a game without smoke_kill_t has no smoke data", () => {
  const m = game();
  delete m.players[3].smoke_kill_t;
  assert.equal(hasSmokes(m), false);
  assert.deepEqual(smokeKillsOf(m), []);
});

test("team view mirrors Dire games and counts smokes and kills per side", () => {
  const t = teamSmokes([game()], () => "b");
  assert.deepEqual(t.games, [["A", 0, "1", "b", 0, 3, 1, 2]]);
  // Team B's view of A's gank: an enemy smoke kill, mirrored through the map centre.
  const [x, y, own, sec, g, killer, victim] = t.k[0];
  assert.equal(own, 0); assert.equal(sec, 600); assert.equal(g, 0); assert.equal(killer, "Axe"); assert.equal(victim, "Lion");
  assert.equal(x, +(74.6 + 182.9 - 120).toFixed(1));
  assert.equal(y, +(78.0 + 177.9 - 130).toFixed(1));
});
