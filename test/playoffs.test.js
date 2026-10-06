import { test } from "node:test";
import assert from "node:assert/strict";
import { TBD, tiebreakFormat, resolveTable, bracket, pairWeek, projectSeries, playoffPicture, possibilities, pathsTo, pathsToEvent, bestOfP, bestOfScores, likelyScore } from "../public/lib/playoffs.js";

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
  assert.deepEqual(r.matches.map((m) => [m.a, m.b, m.bestOf]), [[4, 5, 3]]);  // 2 slots, 4 teams: 1v4 and 2v3, both Bo3.
  r = tiebreakFormat(2, [1, 2, 3, 4], play);
  assert.deepEqual(r.matches.map((m) => [m.a, m.b, m.bestOf]), [[1, 4, 3], [2, 3, 3]]);
  // 3 slots, 4 teams: 1st and 2nd in, 3 v 4 (Bo3).
  r = tiebreakFormat(3, [1, 2, 3, 4], play);
  assert.deepEqual(r.matches.map((m) => [m.a, m.b, m.bestOf]), [[3, 4, 3]]);
  assert.deepEqual(r.above.slice(0, 2), [1, 2]);
  // 3 slots, 5 teams: 1st in, then 2 slots for 4 teams (2v5, 3v4).
  r = tiebreakFormat(3, [1, 2, 3, 4, 5], play);
  assert.deepEqual(r.matches.map((m) => [m.a, m.b, m.bestOf]), [[2, 5, 3], [3, 4, 3]]);
  assert.equal(r.above[0], 1); assert.ok(r.stated);
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

test("playoffPicture: Heroic/Aegis seeds both divisions into an Aegis and a Heroic bracket", () => {
  const teams = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `T${i + 1}`, players: [], division: i % 2 ? "B" : "A" }));
  const p = playoffPicture(teams, [], rate(teams.map((t) => t.id)), { split: true });
  assert.deepEqual(p.divisions.map((d) => d.division), ["A", "B"]);
  assert.ok(p.divisions.every((d) => d.bracket === null));
  assert.deepEqual(p.divisions[0].lines.map((l) => [l.after, l.above]), [[2, "Aegis upper bracket"], [4, "Aegis lower bracket"], [6, "Heroic upper bracket"], [8, "Heroic lower bracket"]]);
  const [aegis, heroic] = p.brackets;
  assert.deepEqual([aegis.name, heroic.name], ["Aegis", "Heroic"]);
  const row = (div, place) => p.divisions[div].rows[place - 1].id;
  const m = Object.fromEntries(aegis.bracket.matches.map((x) => [x.id, x]));
  // Upper: A1 v B2, B1 v A2. Lower: A3 v B4, B3 v A4. No seed-1 choice.
  assert.deepEqual([m.u1.a, m.u1.b], [row(0, 1), row(1, 2)]); assert.deepEqual([m.u2.a, m.u2.b], [row(1, 1), row(0, 2)]);
  assert.deepEqual([m.l1.a, m.l1.b], [row(0, 3), row(1, 4)]); assert.deepEqual([m.l2.a, m.l2.b], [row(1, 3), row(0, 4)]);
  assert.ok(aegis.bracket.fixed);
  assert.equal(aegis.labels.get(row(1, 2)), "B2");
  const h = heroic.bracket.matches.find((x) => x.id === "u1");
  assert.deepEqual([h.a, h.b], [row(0, 5), row(1, 6)]);
  assert.equal(heroic.labels.get(row(0, 8)), "A8");
});

test("best-of odds", () => {
  assert.equal(bestOfP(0.5, 3), 0.5);
  assert.ok(bestOfP(0.6, 3) > 0.6 && bestOfP(0.6, 5) > bestOfP(0.6, 3));
});

test("bestOfScores: every score of a Bo3/Bo5, adding up to 1 and to the series chance", () => {
  const sum = (xs) => xs.reduce((a, s) => a + s.p, 0);
  for (const [n, p] of [[3, 0.6], [5, 0.55], [5, 0.8], [1, 0.7]]) {
    const s = bestOfScores(p, n);
    assert.ok(Math.abs(sum(s) - 1) < 1e-12);
    assert.ok(Math.abs(sum(s.filter((x) => x.a > x.b)) - bestOfP(p, n)) < 1e-12);
  }
  assert.deepEqual(bestOfScores(0.6, 3).map((s) => `${s.a}-${s.b}`), ["2-0", "2-1", "1-2", "0-2"]);
  const [w20, w21] = bestOfScores(0.6, 3);
  assert.ok(Math.abs(w20.p - 0.36) < 1e-12 && Math.abs(w21.p - 2 * 0.36 * 0.4) < 1e-12);
});

test("likelyScore: a Bo3 favourite's is 2–0; a Bo5's is 3–1 until 2/3 a game, then 3–0", () => {
  assert.deepEqual(likelyScore(bestOfScores(0.55, 3), "a"), [2, 0]);
  assert.deepEqual(likelyScore(bestOfScores(0.3, 3), "b"), [2, 0]);
  assert.deepEqual(likelyScore(bestOfScores(0.6, 5), "a"), [3, 1]);
  assert.deepEqual(likelyScore(bestOfScores(0.75, 5), "a"), [3, 0]);
  assert.deepEqual(likelyScore(bestOfScores(0.7, 1), "a"), [1, 0]);
});

test("bracket matches carry the model's score from the winner's side", () => {
  const ratings = new Map([["a", 2], ["b", 1], ["c", 0], ["d", -1]]);
  const b = bracket(["a", "b", "c", "d"], ratings);
  for (const m of b.matches) {
    assert.equal(m.score.length, 2);
    assert.ok(m.score[0] > m.score[1]);
    assert.equal(m.score[0], m.bestOf === 5 ? 3 : 2);
  }
});

test("a viewer's picks override the model: group results, tiebreakers, seed 1's choice, bracket", () => {
  const seeds = [8, 7, 6, 5, 4, 3, 2, 1];
  const b = bracket(seeds, rate(seeds), (k) => ({ pick: 3, "u1:6-8": 6 })[k]);
  const m = Object.fromEntries(b.matches.map((x) => [x.id, x]));
  assert.equal(b.pick, 3); assert.equal(b.modelPick, 4);
  assert.deepEqual([m.u1.a, m.u1.b, m.u1.winner], [8, 6, 6]); assert.ok(m.u1.mine && !m.u2.mine);
  // A pick naming a team not in the match is ignored.
  assert.equal(bracket(seeds, rate(seeds), (k) => (k.startsWith("u2:") ? 99 : undefined)).matches.find((x) => x.id === "u2").winner, 7);
  const teams = [1, 2].map((id) => ({ id, name: `T${id}`, players: [] }));
  const out = projectSeries(teams, [{ id: 5, ...S(1, 2, null, null) }], rate([1, 2]), () => "home");
  assert.deepEqual([out[0].home_score, out[0].away_score, out[0].mine], [2, 0, true]);
});

test("possibilities: every outcome counted, shares add up, and paths say what it takes", () => {
  // Four teams level after six weeks of 1–1s; week 7 (1 v 3, 2 v 4) still to play. 9 outcomes.
  const teams = [1, 2, 3, 4].map((id) => ({ id, name: `T${id}`, players: [] }));
  const series = [];
  for (let w = 0; w < 6; w++) series.push({ id: 10 + w * 2, ...S(1, 2, 1, 1) }, { id: 11 + w * 2, ...S(3, 4, 1, 1) });
  series.push({ id: 3, ...S(1, 3, null, null) }, { id: 4, ...S(2, 4, null, null) });
  const p = possibilities(teams, series, rate([1, 2, 3, 4]), { maxExact: 9 });
  assert.ok(p.exact); assert.equal(p.divisions[0].count, 9);
  const dv = p.divisions[0];
  for (const arr of dv.dist.values()) assert.ok(Math.abs(arr.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  for (let k = 0; k < 4; k++) assert.ok(Math.abs([...dv.dist.values()].reduce((a, arr) => a + arr[k], 0) - 1) < 1e-9);
  // Team 1 can only top the table by not losing to 3; the paths' shares add to its chance.
  const paths = pathsTo(dv, 1, 1, dv.total);
  assert.ok(paths.every((c) => (c.masks[0] & 4) === 0));
  assert.ok(Math.abs(paths.reduce((a, c) => a + c.p, 0) - dv.dist.get(1)[0]) < 1e-9);
});

test("a seed tie down to a 1v1 mid: the model's team on the Bracket, every order in Possibilities", () => {
  // Level on everything: no wins, no SoS, no head to head, no common opponent.
  const ids = [1, 2, 3];
  assert.deepEqual(resolveTable(ids, [], rate(ids), []).rows.map((r) => r.id), [3, 2, 1]);
  assert.deepEqual(resolveTable(ids, [], rate(ids), [], () => undefined).rows.map((r) => r.id), [3, 2, 1]); // no pick: the model's
  const flip = resolveTable(ids, [], rate(ids), [], (key, a, b) => (key.startsWith("mid:") && a === 1 ? 1 : b));
  assert.equal(flip.rows[0].id, 1);
  assert.deepEqual([flip.settled[0].by, flip.settled[0].detail], ["1v1 mid", "1v1 mid"]);
  // Four teams, seven weeks of 1–1s (1 v 2, 3 v 4): every place a quarter, either weighting.
  const four = [1, 2, 3, 4], series = [];
  for (let w = 0; w < 7; w++) series.push({ id: 10 + w * 2, ...S(1, 2, 1, 1) }, { id: 11 + w * 2, ...S(3, 4, 1, 1) });
  for (const weight of ["equal", "model"]) {
    const p = possibilities(four.map((id) => ({ id, name: `T${id}`, players: [] })), series, rate(four), { weight });
    assert.ok(p.exact);
    for (const arr of p.divisions[0].dist.values()) for (const x of arr) assert.ok(Math.abs(x - 1 / 4) < 1e-9, weight);
  }
});

test("possibilities list the week 8 tiebreakers and 1v1 mids that can happen, and what leads to each", () => {
  // Six teams level after six weeks of 1–1s; week 7 (1 v 3, 2 v 5, 4 v 6) to play. Line after 4th.
  const ids = [1, 2, 3, 4, 5, 6], series = [];
  for (let w = 0; w < 6; w++) series.push({ id: 100 + w * 3, ...S(1, 2, 1, 1) }, { id: 101 + w * 3, ...S(3, 4, 1, 1) }, { id: 102 + w * 3, ...S(5, 6, 1, 1) });
  series.push({ id: 1, ...S(1, 3, null, null) }, { id: 2, ...S(2, 5, null, null) }, { id: 3, ...S(4, 6, null, null) });
  const dv = possibilities(ids.map((id) => ({ id, name: `T${id}`, players: [] })), series, rate(ids)).divisions[0];
  assert.ok(dv.exact);
  const evs = [...dv.events.values()];
  // All 1–1s: six teams level for 4 places, a tiebreaker in that one outcome of 27.
  const all = dv.events.get("tb|4|1-2-3-4-5-6");
  assert.ok(Math.abs(all.p - 1 / 27) < 1e-9);
  assert.deepEqual([all.slots, all.places], [4, [1, 6]]);
  const ways = pathsToEvent(dv, all.key, dv.total);
  assert.equal(ways.length, 1); assert.ok(ways[0].masks.every((m) => m === 2) && ways[0].tb === "");
  // Every event's ways add up to its chance; some come down to a 1v1 mid.
  for (const e of evs) assert.ok(Math.abs(pathsToEvent(dv, e.key, dv.total).reduce((a, c) => a + c.p, 0) - e.p) < 1e-9, e.key);
  assert.ok(evs.some((e) => e.kind === "mid"));
});

test("a 1v1 mid decides 1st or a line; any other seed order level all the way down is a coin flip", () => {
  // 3–4 and 1–2 both level on everything, 1–2 on more wins: a 1v1 for 1st, a coin flip for 3rd.
  const ids = [1, 2, 3, 4];
  const series = [S(1, 3, 2, 0), S(2, 4, 2, 0)];
  const t = resolveTable(ids, series, rate(ids), []);
  assert.deepEqual(t.mids.map((m) => [m.purpose, m.places]), [["seed", [1, 2]]]);
  assert.deepEqual(t.settled.map((x) => [x.place, x.by]), [[1, "1v1 mid"], [3, "coin flip"]]);
  // A line after 3rd splits 3 and 4: a week 8 tiebreaker, whose SoS order takes the 1v1.
  const line = resolveTable(ids, series, rate(ids), [{ after: 3, above: "upper", below: "lower" }]);
  assert.ok(line.mids.some((m) => m.purpose === "week8" && m.places[0] === 3));
});

test("blank bracket: only week 1 is set until picks fill it in", () => {
  const seeds = [8, 7, 6, 5, 4, 3, 2, 1];
  let b = bracket(seeds, rate(seeds), () => undefined, { blank: true });
  let m = Object.fromEntries(b.matches.map((x) => [x.id, x]));
  assert.ok(["u1", "u2", "l1", "l2"].every((k) => m[k].open && m[k].winner === TBD && m[k].a !== TBD));
  assert.ok(m.uf.pending && m.l3.pending && m.gf.pending);
  assert.equal(b.champion, TBD);
  // Picking both upper round 1 winners sets the upper final, which is open but not decided.
  b = bracket(seeds, rate(seeds), (k) => ({ "u1:5-8": 5, "u2:6-7": 7 })[k], { blank: true });
  m = Object.fromEntries(b.matches.map((x) => [x.id, x]));
  assert.deepEqual([m.uf.a, m.uf.b, m.uf.winner], [5, 7, TBD]);
  assert.ok(m.uf.open && m.l3.pending); // l3 still waits on the 6 v 7 lower match
});
