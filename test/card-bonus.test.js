import { test } from "node:test";
import assert from "node:assert/strict";
import { BUDGETS, bonusPct, pctText, bonusText, statsFor, rollSubs, defaultMain, bonusPoints } from "../public/lib/card-bonus.js";
import { WEIGHTS } from "../public/lib/tiers.js";

test("equal ceiling: pct x weight is the budget for every stat", () => {
  for (const pos of [1, 2, 3, 4, 5]) for (const stat of statsFor(pos)) {
    const ceiling = (bonusPct(pos, stat, "legendary", "main") / 100) * WEIGHTS[pos][stat];
    assert.ok(Math.abs(ceiling - BUDGETS.legendary.main) <= WEIGHTS[pos][stat] * 0.005 + 1e-9, `${pos} ${stat}`);
  }
});
test("every bonus (position x stat x rarity x main/sub) maxes out within 2% of its budget", () => {
  let worst = 0;
  for (const pos of [1, 2, 3, 4, 5]) for (const stat of statsFor(pos)) for (const r of Object.keys(BUDGETS)) for (const kind of ["main", "sub"]) {
    const dev = Math.abs((bonusPct(pos, stat, r, kind) / 100) * WEIGHTS[pos][stat] - BUDGETS[r][kind]) / BUDGETS[r][kind];
    worst = Math.max(worst, dev);
    assert.ok(dev <= 0.02, `${pos} ${stat} ${r} ${kind}: ${dev}`);
  }
  console.log("worst equal-ceiling deviation:", (worst * 100).toFixed(2) + "%");
});
test("pos 1 kill share at common is +7%, stuns +33%", () => {
  assert.equal(bonusPct(1, "kills", "common", "main"), 7.1);
  assert.equal(bonusPct(1, "stuns", "common", "main"), 33.3);
  assert.equal(bonusText(1, "kills", "common"), "+7.1% Kill share");
  assert.equal(pctText(15), "15");
});
test("sub budget is half the main at every rarity", () => {
  for (const r of ["common", "rare", "epic", "legendary", "arcana"]) assert.equal(BUDGETS[r].sub, BUDGETS[r].main / 2, r);
  assert.deepEqual(["common", "rare", "epic", "legendary", "arcana"].map((r) => BUDGETS[r].sub), [0.5, 0.75, 1, 1.5, 2.25]);
});
test("rollSubs: 3 distinct stats, never the main stat", () => {
  for (let i = 0; i < 50; i++) {
    const subs = rollSubs(1, "kills", "rare", () => i / 50);
    assert.equal(subs.length, 3);
    assert.equal(new Set(subs.map((s) => s.stat)).size, 3);
    assert.ok(subs.every((s) => s.stat !== "kills" && statsFor(1).includes(s.stat)));
  }
  const real = rollSubs(1, "kills", "rare");
  assert.equal(new Set(real.map((s) => s.stat)).size, 3);
});
test("rollSubs: with fewer than n+1 stats it returns as many as are available", () => {
  const pos = [1, 2, 3, 4, 5][0], stats = statsFor(pos);
  assert.equal(rollSubs(pos, stats[0], "common", Math.random, 99).length, stats.length - 1);
  assert.deepEqual(rollSubs(pos, stats[0], "common", Math.random, 0), []);
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
test("bonus points sum main and all three subs (legacy card.sub still counts)", () => {
  const g = { stats: [{ metric: "kills", points: 10 }, { metric: "gpm", points: 8 }, { metric: "dmg", points: 5 }, { metric: "xpm", points: 4 }], mult: {} };
  const subs = [{ stat: "gpm", pct: 50 }, { stat: "dmg", pct: 20 }, { stat: "xpm", pct: 25 }];
  assert.equal(bonusPoints(g, { main: { stat: "kills", pct: 10 }, subs }), 7);
  assert.equal(bonusPoints(g, { main: { stat: "kills", pct: 10 }, sub: subs[0] }), 5);
});

test("bonusText: percent for listed stats, no NaN for stats off the position's list", () => {
  const on = statsFor(1)[0], off = [...new Set([2, 3, 4, 5].flatMap(statsFor))].find((s) => !statsFor(1).includes(s));
  assert.match(bonusText(1, on, "rare"), /^\+\d+(\.\d)?% /);
  assert.ok(off, "need a stat outside pos 1's list");
  const t = bonusText(1, off, "rare");
  assert.match(t, /\(not on your position's list\)$/);
  assert.doesNotMatch(t, /NaN|^[+]/);
});
