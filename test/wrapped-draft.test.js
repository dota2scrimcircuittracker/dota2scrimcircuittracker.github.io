import test from "node:test";
import assert from "node:assert/strict";
import { leagueDraftOf } from "../public/lib/wrapped-draft.js";

// a bans X, b bans Y, a picks A1 (pos 1), b picks B1 (pos 5), ... a's 5th pick A5 (pos 2).
const draft = (fp) => {
  const sp = fp === "a" ? "b" : "a";
  const steps = [{ side: "a", hero: "X" }, { side: "b", hero: "Y" }, { side: fp, hero: `${fp.toUpperCase()}1`, pick: true }, { side: sp, hero: `${sp.toUpperCase()}1`, pick: true }];
  for (let i = 2; i <= 5; i++) steps.push({ side: "a", hero: `A${i}`, pick: true }, { side: "b", hero: `B${i}`, pick: true });
  return steps.map((s, order) => ({ order, pick: !!s.pick, ...s }));
};
const players = [...[1, 2, 3, 4, 5].map((i) => ({ team: "a", hero: `A${i}`, position: [1, 3, 4, 5, 2][i - 1] })), ...[1, 2, 3, 4, 5].map((i) => ({ team: "b", hero: `B${i}`, position: [5, 1, 2, 3, 4][i - 1] }))];
const game = (winner, fp = "a") => ({ winner, draft: draft(fp), players });

test("leagueDraftOf reads bans, picks, pick order, side and first and last picks", () => {
  const games = [...Array(6)].map(() => game("a")).concat([...Array(4)].map(() => game("b", "b")));
  const d = leagueDraftOf(games, { heroCount: 30 });
  assert.equal(d.drafts, 10);
  assert.equal(d.bans[0].n, 10); assert.equal(d.bans[0].p1, 10);
  assert.deepEqual(d.order.first, { n: 10, w: 10 });
  assert.deepEqual(d.order.second, { n: 10, w: 0 });
  assert.deepEqual(d.side.radiant, { n: 10, w: 6 });
  assert.deepEqual(d.side.firstOn.b, { n: 4, w: 4 });
  assert.equal(d.first[0].hero, "A1"); assert.equal(d.firstCore, 0.5); // each team's first pick: A1 (pos 1) and B1 (pos 5)
  assert.equal(d.last[0].hero, "A5"); assert.equal(d.lastCore, 0.5); // A5 pos 2, B5 pos 4
  assert.equal(d.contested[0].rate, 1);
  assert.equal(d.pool.heroes, 10); assert.equal(d.pool.never, 18);
  assert.equal(d.best[0].rate, 0.6);
  assert.equal(leagueDraftOf(games.slice(0, 9)), null);
});
