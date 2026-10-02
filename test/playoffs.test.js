import { test } from "node:test";
import assert from "node:assert/strict";
import { tiebreakFormat, resolveTable, bracket, pairWeek, projectSeries, playoffPicture, bestOfP } from "../public/lib/playoffs.js";

// Higher id = stronger, so the model's winner is always the higher id.
const rate = (ids) => new Map(ids.map((id) => [id, id / 10]));
const play = (a, b, bestOf, note) => { const winner = Math.max(a, b); return { a, b, bestOf, note, winner, loser: Math.min(a, b) }; };
const S = (home, away, hs, as) => ({ home, away, home_score: hs, away_score: as });

test("tiebreak table: 1 slot", () => {
  let r = tiebreakFormat(1, [1, 2], play);
  assert.equal(r.matches.length, 1); assert.equal(r.matches[0].bestOf, 3); assert.deepEqual(r.above, [2]);
  // 3 teams: 2nd v 3rd (Bo1), the winner plays 1st (Bo1).
  r = tiebreakFormat(1, [1, 2, 3], play);
  assert.deepEqual(r.matches.map((m) => [m.a, m.b, m.bestOf]), [[2, 3, 1], [1, 3, 1]]);
  assert.deepEqual(r.above, [3]);
  // 4 teams: 1v4, 2v3, winners play.
  r = tiebreakFormat(1, [1, 2, 3, 4], play);
  assert.deepEqual(r.matches.map((m) => [m.a, m.b]), [[1, 4], [2, 3], [4, 3]]);
  assert.ok(r.stated);
  assert.equal(tiebreakFormat(1, [1, 2, 3, 4, 5], play).stated, false);
});

test("tiebreak table: 2+ slots", () => {
  // 2 slots, 3 teams: best SoS in, 2 v 3 (Bo3).
  let r = tiebreakFormat(2, [1, 2, 3], play);
  assert.deepEqual(r.matches.map((m) => [m.a, m.b, m.bestOf]), [[2, 3, 3]]);
  assert.deepEqual(r.above, [1, 3]);
  // 2 slots, 5 teams: 1v4, 2v3, 5th out.
  r = tiebreakFormat(2, [1, 2, 3, 4, 5], play);
  assert.deepEqual(r.matches.map((m) => [m.a, m.b]), [[1, 4], [2, 3]]);
  assert.ok(r.below.includes(5) && r.stated);
  // 3 slots, 6 teams: 1st in, 6th out, 2v5 and 3v4.
  r = tiebreakFormat(3, [1, 2, 3, 4, 5, 6], play);
  assert.deepEqual(r.matches.map((m) => [m.a, m.b]), [[2, 5], [3, 4]]);
  assert.deepEqual(r.above, [1, 5, 4]); assert.ok(r.below.includes(6) && r.stated);
  // 4 slots, 6 teams: 1st and 2nd in, then 2 slots for 4 teams.
  r = tiebreakFormat(4, [1, 2, 3, 4, 5, 6], play);
  assert.deepEqual(r.matches.map((m) => [m.a, m.b]), [[3, 6], [4, 5]]);
  assert.deepEqual(r.above.slice(0, 2), [1, 2]);
  // 4 slots, 5 teams: top 3 in, 4 v 5.
  r = tiebreakFormat(4, [1, 2, 3, 4, 5], play);
  assert.deepEqual(r.matches.map((m) => [m.a, m.b, m.bestOf]), [[4, 5, 3]]);
});

test("resolveTable plays off a tie across the line and settles seed ties on SoS", () => {
  // Teams 1..6. Wins: 1→6, 2→4, 3→4, 4→4, 5→2, 6→0 after these series.
  const series = [S(1, 2, 2, 0), S(1, 3, 2, 0), S(1, 6, 2, 0), S(2, 6, 2, 0), S(2, 5, 2, 0), S(3, 6, 2, 0), S(3, 5, 2, 0), S(4, 6, 2, 0), S(4, 5, 2, 0), S(5, 6, 2, 0)];
  const ids = [1, 2, 3, 4, 5, 6];
  const t = resolveTable(ids, series, rate(ids), [{ after: 2, above: "upper", below: "lower" }]);
  assert.equal(t.rows[0].id, 1);
  // 2, 3, 4 tied on 4 wins for one place above the line: 1 slot, 3 teams.
  const tb = t.tiebreakers[0];
  assert.equal(tb.slots, 1); assert.equal(tb.teams.length, 3);
  assert.equal(tb.matches.length, 2);
  assert.equal(t.rows[1].id, tb.above[0]);
  // SoS: 2 and 3 played 1 (6 wins), 5 and 6; 4 played 5 and 6 only.
  assert.equal(t.rows.find((r) => r.id === 2).sos, 6 + 2 + 0);
  assert.equal(t.rows.find((r) => r.id === 4).sos, 2 + 0);
});

test("8-team bracket follows S47's shape", () => {
  const seeds = [8, 7, 6, 5, 4, 3, 2, 1]; // seed k = team 9-k; higher id stronger, so seeds win
  const b = bracket(seeds, rate(seeds));
  const m = Object.fromEntries(b.matches.map((x) => [x.id, x]));
  // Seed 1 takes the weaker of 3 and 4: seed 4 (team 5).
  assert.equal(b.pick, 4);
  assert.deepEqual([m.u1.a, m.u1.b], [8, 5]); assert.deepEqual([m.u2.a, m.u2.b], [7, 6]);
  assert.deepEqual([m.l1.a, m.l1.b], [4, 1]); assert.deepEqual([m.l2.a, m.l2.b], [3, 2]);
  // Loser of seed 1's match meets the 6v7 winner; the other upper loser the 5v8 winner.
  assert.deepEqual([m.l3.a, m.l3.b], [5, 3]); assert.deepEqual([m.l4.a, m.l4.b], [6, 4]);
  assert.equal(m.gf.bestOf, 5);
  assert.equal(b.champion, 8);
});

test("smaller brackets: 7 teams give seed 5 a bye; 6 play 5 v 6; 4 all start upper", () => {
  const seven = bracket([7, 6, 5, 4, 3, 2, 1], rate([1, 2, 3, 4, 5, 6, 7]));
  assert.ok(seven.matches.find((x) => x.id === "l1").bye);
  const six = bracket([6, 5, 4, 3, 2, 1], rate([1, 2, 3, 4, 5, 6]));
  const l1 = six.matches.find((x) => x.id === "l1");
  assert.deepEqual([l1.a, l1.b], [2, 1]);
  const four = bracket([4, 3, 2, 1], rate([1, 2, 3, 4]));
  const fl1 = four.matches.find((x) => x.id === "l1");
  assert.deepEqual([fl1.a, fl1.b, fl1.week], [1, 2, 2]); // the two upper round 1 losers
  assert.ok(!four.matches.some((x) => x.id === "l2"));
  assert.equal(four.champion, 4);
  assert.equal(bracket([2, 1, 3], rate([1, 2, 3])), null);
});

test("swiss pairing avoids rematches, and repeats only when it must", () => {
  const met = new Map([["1|2", 1], ["2|1", 1]]);
  assert.deepEqual(pairWeek([1, 2, 3, 4], met), [[1, 3], [2, 4]]);
  const all = new Map(); for (const a of [1, 2, 3, 4]) for (const b of [1, 2, 3, 4]) if (a !== b) all.set(`${a}|${b}`, 1);
  assert.equal(pairWeek([1, 2, 3, 4], all).length, 2);
});

test("projectSeries calls unplayed series and pairs the weeks PlayOn hasn't posted", () => {
  const teams = [1, 2, 3, 4].map((id) => ({ id, name: `T${id}`, players: [] }));
  // 6 weeks of 2 series posted, the last one unplayed.
  const series = [];
  const pairs = [[1, 2, 3, 4], [1, 3, 2, 4], [1, 4, 2, 3], [1, 2, 3, 4], [1, 3, 2, 4], [1, 4, 2, 3]];
  pairs.forEach(([a, b, c, d], w) => series.push({ ...S(a, b, w === 5 ? null : 2, w === 5 ? null : 0), id: w * 2 }, { ...S(c, d, w === 5 ? null : 1, w === 5 ? null : 1), id: w * 2 + 1 }));
  const out = projectSeries(teams, series, rate([1, 2, 3, 4]));
  assert.equal(out.length, 14); // 12 posted + one projected week of 2
  assert.equal(out.filter((s) => s.paired).length, 2);
  const last = out.find((s) => s.id === 10); // 1 v 4: 4 is far stronger
  assert.deepEqual([last.home_score, last.away_score], [0, 2]);
  // A bye placeholder hands its opponent 1–0.
  const withBye = projectSeries([...teams, { id: 9, name: "Explorer Bye Week", players: [] }], [{ id: 99, ...S(9, 1, null, null) }], rate([1, 2, 3, 4]));
  assert.deepEqual([withBye[0].home_score, withBye[0].away_score], [0, 1]);
});

test("playoffPicture: split leagues get tables per division and no bracket", () => {
  const teams = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => ({ id, name: `T${id}`, players: [], division: id % 2 ? "A" : "B" }));
  const p = playoffPicture(teams, [], rate(teams.map((t) => t.id)), { split: true });
  assert.deepEqual(p.divisions.map((d) => d.division), ["A", "B"]);
  assert.ok(p.divisions.every((d) => d.bracket === null));
  assert.equal(p.divisions[0].lines[0].above, "Aegis playoffs");
});

test("best-of odds", () => {
  assert.equal(bestOfP(0.5, 3), 0.5);
  assert.ok(bestOfP(0.6, 3) > 0.6 && bestOfP(0.6, 5) > bestOfP(0.6, 3));
});
