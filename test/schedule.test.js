import { test } from "node:test";
import assert from "node:assert/strict";
import { strengthOfSchedule, gameWins } from "../public/lib/schedule.js";

const S = (home, away, hs, as) => ({ home, away, home_score: hs, away_score: as });
// A beats everyone 2-0; B and C split; D loses everything.
const series = [
  S(1, 2, 2, 0), S(1, 3, 2, 0), S(1, 4, 2, 0),
  S(2, 3, 1, 1), S(2, 4, 2, 0), S(3, 4, 2, 0),
  S(4, 1, null, null), S(2, 3, null, null),
];
const by = Object.fromEntries(strengthOfSchedule([1, 2, 3, 4], series).map((r) => [r.id, r]));

test("game wins come from played series only", () => {
  assert.deepEqual(Object.fromEntries(gameWins(series)), { 1: 6, 2: 3, 3: 3, 4: 0 });
});

test("SoS is the total game wins of the opponents played (AD2L rules §7)", () => {
  assert.equal(by[1].sos, 3 + 3 + 0); // B, C, D
  assert.equal(by[2].sos, 6 + 3 + 0); // A, C, D
  assert.equal(by[4].sos, 6 + 3 + 3); // A, B, C
  // Opponents' wins include their wins against this team.
  assert.equal(by[4].faced.find((f) => f.opp === 1).opp_wins, 6);
});

test("meeting a team twice counts their wins twice; a 0-win bye adds nothing", () => {
  const r = Object.fromEntries(strengthOfSchedule([2, 9], [...series, S(2, 3, 2, 0), S(9, 2, 0, 1)]).map((x) => [x.id, x]));
  // B played A (6 wins), C (3), D (0), C again (3) and the bye (0).
  assert.equal(r[2].sos, 12);
});

test("remaining schedule uses unplayed series and current wins", () => {
  assert.deepEqual(by[4].remaining, [1]);
  assert.equal(by[4].remaining_sos, 6);
  assert.deepEqual(by[2].remaining, [3]);
  assert.equal(by[1].faced.length, 3);
  assert.equal(by[2].faced.find((f) => f.opp === 3).result, "t");
});

test("teams with no games get nulls, not 0 or NaN", () => {
  const [r] = strengthOfSchedule([9], series);
  assert.equal(r.sos, null); assert.equal(r.remaining_sos, null);
});
