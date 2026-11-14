import { test } from "node:test";
import assert from "node:assert/strict";
import { BUDGETS, bonusPct, bonusText, statsFor, rollSub, defaultMain, bonusPoints } from "../public/lib/card-bonus.js";
import { WEIGHTS } from "../public/lib/tiers.js";

test("equal ceiling: pct x weight is the budget for every stat", () => {
  for (const pos of [1, 2, 3, 4, 5]) for (const stat of statsFor(pos)) {
    const ceiling = (bonusPct(pos, stat, "legendary", "main") / 100) * WEIGHTS[pos][stat];
    assert.ok(Math.abs(ceiling - BUDGETS.legendary.main) <= WEIGHTS[pos][stat] * 0.005 + 1e-9, `${pos} ${stat}`);
  }
});
test("pos 1 kill share at common is +7%, stuns +33%", () => {
  assert.equal(bonusPct(1, "kills", "common", "main"), 7);
  assert.equal(bonusPct(1, "stuns", "common", "main"), 33);
});
test("sub is 40% of main and never the main stat", () => {
  assert.equal(BUDGETS.epic.sub, BUDGETS.epic.main * 0.4);
  for (let i = 0; i < 50; i++) assert.notEqual(rollSub(1, "kills", "rare", () => i / 50).stat, "kills");
});
test("default main: random among the 3 best stats", () => {
  const scores = { gpm: 90, dmg: 80, kills: 70, xpm: 10, lane: 5 };
  const picks = new Set([0, 0.4, 0.99].map((r) => defaultMain(1, scores, "common", () => r).stat));
  assert.deepEqual([...picks].sort(), ["dmg", "gpm", "kills"]);
});
test("bonus points: stat points x pct x the game's multipliers; a stat missing at the slot adds 0", () => {
  const g = { stats: [{ metric: "kills", points: 10 }], mult: { survival: 1, consistency: 1, opponents: 1.1, winning: 1 } };
  const card = { main: { stat: "kills", pct: 20 }, sub: { stat: "vispct", pct: 50 } };
  assert.equal(bonusPoints(g, card), 2.2);
});

test("bonusText: percent for listed stats, no NaN for stats off the position's list", () => {
  const on = statsFor(1)[0], off = [...new Set([2, 3, 4, 5].flatMap(statsFor))].find((s) => !statsFor(1).includes(s));
  assert.match(bonusText(1, on, "rare"), /^\+\d+% /);
  assert.ok(off, "need a stat outside pos 1's list");
  const t = bonusText(1, off, "rare");
  assert.match(t, /\(not on your position's list\)$/);
  assert.doesNotMatch(t, /NaN|^[+]/);
});
