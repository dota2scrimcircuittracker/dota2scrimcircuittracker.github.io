import test from "node:test";
import assert from "node:assert/strict";
import { teamSideSplit } from "../public/lib/draft.js";

const draft = (first) => [{ order: 1, pick: false, side: first, hero: "Axe" }, { order: 0, pick: false, side: "b", hero: "Lina" }, { order: 2, pick: true, side: first, hero: "Pudge" }, { order: 3, pick: true, side: first === "a" ? "b" : "a", hero: "Lion" }];

test("teamSideSplit counts side, pick order and the mix", () => {
  const s = teamSideSplit([
    { m: { winner: "a", draft: draft("a") }, side: "a" }, // Radiant, first pick, won
    { m: { winner: "a", draft: draft("b") }, side: "b" }, // Dire, first pick, lost
    { m: { winner: "b", draft: draft("b") }, side: "a" }, // Radiant, second pick, lost
    { m: { winner: "a" }, side: "a" },                   // no draft: side only
    { m: { winner: null, draft: draft("a") }, side: "a" }, // no result: skipped
  ]);
  assert.equal(s.games, 4);
  assert.deepEqual(s.a, { n: 3, wins: 2 });
  assert.deepEqual(s.b, { n: 1, wins: 0 });
  assert.equal(s.drafted, 3);
  assert.deepEqual(s.first, { n: 2, wins: 1 });
  assert.deepEqual(s.second, { n: 1, wins: 0 });
  assert.deepEqual(s.combo, { a: { first: 1, second: 1 }, b: { first: 1, second: 0 } });
});
