import { test } from "node:test";
import assert from "node:assert/strict";
import { rosterTeams, requestProblem, offerProblem, openRequests, myRequests, myOffers, upcomingScrims, offerId, fixtureName } from "../public/lib/scheduler.js";

const NOW = Date.UTC(2026, 9, 27, 12);
const H = 3600e3;
const DIVS = ["ad2l", "heroic", "conqueror"];
const leagues = [
  { key: "ad2l", data: { teams: [{ id: 1, name: "Rats", players: [{ account_id: 100 }, { account_id: 101 }] }] } },
  { key: "heroic", data: { teams: [{ id: 2, name: "Owls", players: [{ account_id: 200 }] }, { id: 3, name: "Bats", players: [{ account_id: 100 }] }] } },
  { key: "conqueror", data: { teams: [{ id: 9, name: "Conqueror Bye Week", players: [{ account_id: 100 }] }] } },
  { key: "warrior", data: null },
];
const req = (extra = {}) => ({ id: "r1", team: 1, team_name: "Rats", div: "ad2l", open_to: ["ad2l"], start: new Date(NOW + 24 * H), best_of: 2, status: "open", ...extra });
const offer = (r, t, extra = {}) => ({ id: offerId(r.id, t), request: r.id, team: t.id, team_name: t.name, div: t.div, start: r.start, ...extra });

test("rosterTeams finds every roster an account is on, across divisions, not bye weeks", () => {
  assert.deepEqual(rosterTeams(100, leagues), [{ div: "ad2l", id: 1, name: "Rats" }, { div: "heroic", id: 3, name: "Bats" }]);
  assert.deepEqual(rosterTeams("200", leagues), [{ div: "heroic", id: 2, name: "Owls" }]);
  assert.deepEqual(rosterTeams(999, leagues), []);
  assert.deepEqual(rosterTeams(null, leagues), []);
});

test("requestProblem checks time, format, divisions and note", () => {
  const ok = { start: new Date(NOW + H), open_to: ["ad2l"], best_of: 1 };
  assert.equal(requestProblem(ok, DIVS, NOW), null);
  assert.match(requestProblem({ ...ok, start: new Date(NOW - H) }, DIVS, NOW), /passed/);
  assert.match(requestProblem({ ...ok, start: new Date(NOW + 61 * 864e5) }, DIVS, NOW), /60 days/);
  assert.match(requestProblem({ ...ok, start: new Date("x") }, DIVS, NOW), /start time/);
  assert.match(requestProblem({ ...ok, best_of: 5 }, DIVS, NOW), /format/);
  assert.match(requestProblem({ ...ok, open_to: [] }, DIVS, NOW), /division/);
  assert.match(requestProblem({ ...ok, open_to: ["nope"] }, DIVS, NOW), /Unknown/);
  assert.match(requestProblem({ ...ok, note: "x".repeat(141) }, DIVS, NOW), /note/);
});

test("offerProblem: own team, other divisions and closed requests can't answer", () => {
  const r = req({ open_to: ["ad2l", "heroic"] });
  assert.equal(offerProblem(r, { div: "heroic", id: 2 }, NOW), null);
  assert.match(offerProblem(r, { div: "ad2l", id: 1 }, NOW), /own/);
  assert.match(offerProblem(req(), { div: "heroic", id: 2 }, NOW), /division/);
  assert.match(offerProblem(req({ status: "confirmed" }), { div: "ad2l", id: 9 }, NOW), /closed/);
  assert.match(offerProblem(req({ start: new Date(NOW - H) }), { div: "ad2l", id: 9 }, NOW), /closed/);
  // Same id in another division is a different team.
  assert.equal(offerProblem(req(), { div: "ad2l", id: 2 }, NOW), null);
});

test("openRequests keeps open future requests, soonest first", () => {
  const rs = [req({ id: "a", start: new Date(NOW + 5 * H) }), req({ id: "b", start: new Date(NOW + H) }), req({ id: "c", status: "cancelled" }), req({ id: "d", start: new Date(NOW - H) })];
  assert.deepEqual(openRequests(rs, NOW).map((r) => r.id), ["b", "a"]);
});

test("myRequests attaches offers to the poster's open requests", () => {
  const r = req(), owls = { div: "heroic", id: 2, name: "Owls" };
  const offers = [offer(r, owls), offer({ id: "other" }, owls)];
  const mine = myRequests([r, req({ id: "r2", team: 2, div: "heroic" })], offers, [{ div: "ad2l", id: 1 }], NOW);
  assert.deepEqual(mine.map((x) => [x.id, x.offers.length]), [["r1", 1]]);
});

test("myOffers says whether an answer is waiting, won or lost", () => {
  const owls = { div: "heroic", id: 2, name: "Owls" }, bats = { div: "heroic", id: 3, name: "Bats" };
  const open = req({ id: "o" }), won = req({ id: "w", status: "confirmed", opp_div: "heroic", opp_team: 2 });
  const lost = req({ id: "l", status: "confirmed", opp_div: "heroic", opp_team: 3 }), gone = req({ id: "g", status: "cancelled" });
  const offers = [open, won, lost, gone].map((r) => offer(r, owls)).concat(offer(open, bats));
  assert.deepEqual(myOffers([open, won, lost, gone], offers, [owls], NOW).map((o) => [o.request, o.state]).sort(),
    [["l", "lost"], ["o", "waiting"], ["w", "won"]]);
});

test("upcomingScrims drops scrims that started over 3 hours ago", () => {
  const f = (id, at) => ({ id, start: new Date(at) });
  assert.deepEqual(upcomingScrims([f("a", NOW + H), f("b", NOW - 2 * H), f("c", NOW - 4 * H), { id: "d", start: null }], NOW).map((x) => x.id), ["b", "a"]);
});

test("fixtureName trims and caps at 40 characters", () => {
  assert.equal(fixtureName("  Rats  "), "Rats");
  assert.equal(fixtureName("x".repeat(50)).length, 40);
});
