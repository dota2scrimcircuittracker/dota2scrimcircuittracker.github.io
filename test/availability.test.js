// Runs in New York time (each test file is its own process), so local → UTC is checkable.
process.env.TZ = "America/New_York";
import { test } from "node:test";
import assert from "node:assert/strict";
import { zoneOffset, slotOf, localGrid, fromGrid, overlap, bestHours, emptySlots, validSlots, eventProblem, teamCalendar } from "../public/lib/availability.js";

const REF = 240; // New York in summer time (EDT)
const NOW = Date.UTC(2026, 9, 27, 12);

test("zoneOffset is the viewer's offset", { skip: new Date(2026, 9, 28).getTimezoneOffset() !== 240 && "TZ not applied" }, () => {
  assert.equal(zoneOffset(new Date(2026, 9, 28)), 240);
  assert.equal(zoneOffset(new Date(2026, 11, 1)), 300);
});

test("slotOf maps local hours to UTC slots", () => {
  assert.equal(slotOf(0, 20, REF), 1 * 24 + 0); // Mon 8pm EDT = Tue 00:00 UTC
  assert.equal(slotOf(0, 0, REF), 4); // Mon 00:00 EDT = Mon 04:00 UTC
  assert.equal(slotOf(6, 22, REF), 2); // Sun 10pm EDT = Mon 02:00 UTC, wraps to the week's start
  assert.equal(slotOf(0, 2, -330), 20 + 6 * 24); // India: Mon 02:00 = Sun 20:30 UTC, rounded down
  assert.equal(slotOf(0, 0, 0), 0);
});

test("every local hour has its own slot, in any zone", () => {
  for (const off of [240, 300, 0, -60, -330, -600, 720]) {
    const seen = new Set();
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) seen.add(slotOf(d, h, off));
    assert.equal(seen.size, 168, `offset ${off}`);
  }
});

test("grid round-trips through slots", () => {
  const grid = localGrid(emptySlots(), REF);
  grid[2][19] = grid[2][20] = grid[5][0] = true;
  const s = fromGrid(grid, REF);
  assert.ok(validSlots(s));
  assert.equal([...s].filter((c) => c === "1").length, 3);
  assert.deepEqual(localGrid(s, REF), grid);
  assert.deepEqual(localGrid("junk", REF).flat().filter(Boolean), []);
});

test("overlap and bestHours find when most of the team is free", () => {
  const g = (cells) => { const x = localGrid(emptySlots(), REF); cells.forEach(([d, h]) => (x[d][h] = true)); return fromGrid(x, REF); };
  const players = [{ name: "A", slots: g([[1, 20], [1, 21]]) }, { name: "B", slots: g([[1, 20]]) }, { name: "C", slots: g([[1, 20], [3, 9]]) }];
  const o = overlap(players, REF);
  assert.deepEqual(o[1][20], ["A", "B", "C"]);
  assert.deepEqual(o[1][21], ["A"]);
  assert.deepEqual(bestHours(o, 1).map(({ d, h, names }) => [d, h, names.length]), [[1, 20, 3], [1, 21, 1], [3, 9, 1]]);
  assert.deepEqual(bestHours(o, 2).length, 1);
});

test("eventProblem checks title, time and length", () => {
  const ok = { title: "Practice", start: new Date(NOW + 3600e3), minutes: 60 };
  assert.equal(eventProblem(ok, NOW), null);
  assert.match(eventProblem({ ...ok, title: "  " }, NOW), /title/);
  assert.match(eventProblem({ ...ok, title: "x".repeat(61) }, NOW), /title/);
  assert.match(eventProblem({ ...ok, start: new Date(NOW - 1) }, NOW), /passed/);
  assert.match(eventProblem({ ...ok, minutes: 45 }, NOW), /length/);
});

test("teamCalendar merges the team's events and confirmed scrims, upcoming only", () => {
  const team = { div: "heroic", id: 2 };
  const at = (h) => new Date(NOW + h * 3600e3);
  const events = [
    { id: "e1", div: "heroic", team: 2, title: "VOD review", start: at(5), minutes: 60 },
    { id: "e2", div: "heroic", team: 3, title: "Not ours", start: at(1), minutes: 60 },
    { id: "e3", div: "heroic", team: 2, title: "Over", start: at(-3), minutes: 60 },
  ];
  const requests = [
    { id: "r1", status: "confirmed", div: "ad2l", team: 1, team_name: "Rats", opp_div: "heroic", opp_team: 2, opp_name: "Owls", start: at(2), best_of: 2 },
    { id: "r2", status: "confirmed", div: "heroic", team: 2, team_name: "Owls", opp_div: "ad2l", opp_team: 9, opp_name: "Bats", start: at(8), best_of: 1 },
    { id: "r3", status: "open", div: "heroic", team: 2, team_name: "Owls", start: at(3), best_of: 1 },
  ];
  assert.deepEqual(teamCalendar(events, requests, team, NOW).map((e) => e.title), ["Scrim vs Rats", "VOD review", "Scrim vs Bats"]);
});
