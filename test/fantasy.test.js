import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { weekKey, fantasyWeeks, openWeek, pickable, checkPicks, pickPoints, scoreEntry, leaderboard, playoffWeeks, testWeek, TEST_WEEK, weekBoard, weekGames, GAMES_COUNTED } from "../public/lib/fantasy.js";

const T = (iso) => Date.parse(iso) / 1000;
const series = [
  { id: 1, time: T("2026-10-02T01:00:00Z"), home: 10, away: 11 }, // Thu night US = Fri UTC, week of Sep 28
  { id: 2, time: T("2026-10-02T02:00:00Z"), home: 12, away: 13 },
  { id: 3, time: T("2026-10-09T01:00:00Z"), home: 10, away: 12 }, // 11 and 13 have a bye
];
const teams = [10, 11, 12, 13].map((id) => ({ id, name: `T${id}`, players: [1, 2, 3, 4, 5].map((n) => ({ name: `P${id}-${n}`, account_id: id * 100 + n })) }));

test("weeks run Monday to Monday UTC and lock at the first series", () => {
  assert.equal(weekKey(T("2026-10-02T01:00:00Z")), "2026-09-28");
  assert.equal(weekKey(T("2026-10-05T00:00:00Z")), "2026-10-05");
  const ws = fantasyWeeks(series);
  assert.deepEqual(ws.map((w) => [w.key, w.lock, w.series.length]), [["2026-09-28", series[0].time, 2], ["2026-10-05", series[2].time, 1]]);
  assert.equal(openWeek(ws, series[0].time - 1).key, "2026-09-28");
  assert.equal(openWeek(ws, series[0].time).key, "2026-10-05"); // locked at the first start
  assert.equal(openWeek(ws, series[2].time + 1), null);
});

test("only teams playing that week can be picked, and never yourself", () => {
  const w = fantasyWeeks(series)[1];
  const pool = pickable(teams, w, 1001);
  assert.deepEqual([...new Set(pool.map((p) => p.team_id))], [10, 12]);
  assert.ok(!pool.some((p) => p.account === 1001));
  assert.equal(checkPicks([1002, 1003, 1201, 1202, 1203], pool, 1001), null);
  assert.equal(checkPicks([1001, 1003, 1201, 1202, 1203], pool, 1001), "You can't pick yourself.");
  assert.equal(checkPicks([1101, 1003, 1201, 1202, 1203], pool, 1001), "Every pick must be on a team that plays this week."); // bye
  assert.equal(checkPicks([1002, 1002, 1201, 1202, 1203], pool, 1001), "Each player can fill one position only.");
  assert.equal(checkPicks([1002, 1003, 1201, 1202], pool, 1001), "Pick a player for every position.");
});

// Real games: the Champion file.
const d = JSON.parse(fs.readFileSync(new URL("../public/data/ad2l.json", import.meta.url)));
const weeks = fantasyWeeks(d.series);

// A player with at least three games in the Champion file, and those games.
const byPlayer = new Map();
for (const g of d.games) for (const p of g.players ?? []) if (p.account_id) (byPlayer.get(p.account_id) ?? byPlayer.set(p.account_id, []).get(p.account_id)).push(g);
const [acct, acctGames] = [...byPlayer].find(([, gs]) => gs.length >= 3);

test("a game scores on the tier model's stat points, read as the slot's position, with no curve", () => {
  const one = pickPoints(acct, 1, [acctGames[0]], d.games), g = one.games[0];
  assert.ok(Number.isFinite(g.score));
  assert.ok(g.stats.length > 0);
  // The stats' points add up to the stat points before the multipliers.
  assert.ok(Math.abs(g.stats.reduce((t, x) => t + x.points, 0) - g.stat_points) < 1e-6);
  assert.ok(g.stats.every((x) => x.score >= 0 && x.score <= 100));
  // Each slot is its own position: the same game reads differently as a pos 5.
  assert.notEqual(pickPoints(acct, 5, [acctGames[0]], d.games).games[0].stats.map((x) => x.metric).join(), g.stats.map((x) => x.metric).join());
});

test("a pick counts its best two games added together", () => {
  const games = acctGames.slice(0, 3);
  const result = pickPoints(acct, 3, games, d.games);
  assert.equal(result.games.length, 3);
  const top = result.games.map((g) => g.score).sort((a, b) => b - a);
  assert.equal(result.points, Math.round((top[0] + top[1]) * 10) / 10);
  assert.equal(result.games.filter((g) => g.counted).length, GAMES_COUNTED);
  assert.equal(pickPoints(999, 3, games, d.games).points, 0);
});

test("the first week pools tiebreakers and later weeks only include the playoff bracket", () => {
  const divisions = TEST_WEEK.leagues.map((key) => ({ key, ...JSON.parse(fs.readFileSync(new URL(`../public/data/${key}.json`, import.meta.url))) }));
  const w = testWeek(divisions);
  assert.equal(w.key, TEST_WEEK.key);
  assert.equal(w.league, "all");
  assert.equal(w.teams.size, 7);
  assert.equal(pickable(divisions.flatMap((x) => x.teams), w).length, 35);
  const later = { id: "playoff", time: T("2026-10-23T01:00:00Z"), home: 10, away: 11 };
  const ws = playoffWeeks("ad2l", [...series, later]);
  assert.deepEqual(ws.map((x) => x.key), ["2026-10-19"]);
  assert.equal(weekGames([{ ...later, series_id: "playoff", league: "heroic" }], ws[0]).length, 0);
});

test("entries saved after the lock never count; the board adds weeks up", () => {
  const w = weeks.find((x) => weekGames(d.games, x).length);
  const picks = d.teams.filter((t) => w.teams.has(t.id)).flatMap((t) => t.players.map((p) => p.account_id)).slice(0, 5);
  const early = { account: 1, name: "Early", week: w.key, picks, updatedAt: new Date((w.lock - 60) * 1000) };
  const late = { account: 2, name: "Late", week: w.key, picks, updatedAt: new Date((w.lock + 60) * 1000) };
  assert.equal(scoreEntry(late, w, d.games), null);
  assert.equal(scoreEntry(early, { ...w, eligible: new Set() }, d.games), null);
  assert.equal(scoreEntry({ ...early, updatedAt: new Date(w.lock * 1000) }, w, d.games), null);
  const board = leaderboard([early, late], weeks, d.games, w.lock + 1);
  assert.deepEqual(board.map((r) => r.name), ["Early"]);
  assert.equal(board[0].points, scoreEntry(early, w, d.games).points);
  assert.deepEqual(weekBoard([early, late], w, d.games).map((r) => r.name), ["Early"]);
  // Before the lock nothing is scored yet.
  assert.deepEqual(leaderboard([early], weeks, d.games, w.lock - 1), []);
});

test("announced series join the week until PlayOn posts its own", async () => {
  const { withAnnounced, ANNOUNCED } = await import("../public/lib/divisions.js");
  const a = ANNOUNCED.ad2l[0];
  const withA = withAnnounced("ad2l", d.series);
  assert.equal(withA.length, d.series.length + 1);
  const w = fantasyWeeks(withA).find((x) => x.seriesIds.has(a.id));
  assert.deepEqual([...w.teams].sort(), [a.home, a.away].sort());
  assert.equal(pickable(d.teams, w).length, 10);
  // PlayOn posts it (another id, same teams, same night): the announced one drops out.
  const posted = [...d.series, { id: 99999, time: a.time + 3600, home: a.away, away: a.home }];
  assert.equal(withAnnounced("ad2l", posted).length, posted.length);
  // Its games count by teams and week even without a PlayOn series id.
  const g = { ...d.games[0], id: "x", series_id: null, start_time: a.time + 600, team_a_id: a.home, team_b_id: a.away };
  assert.equal(weekGames([g], w).length, 1);
});
test("captain doubles one pick's best-two-game total and legacy entries retain their score", () => {
  const w = weeks.find((x) => weekGames(d.games, x).length);
  const picks = d.teams.filter((t) => w.teams.has(t.id)).flatMap((t) => t.players.map((p) => p.account_id)).slice(0, 5);
  const entry = { account: 99, picks, week: w.key, updatedAt: new Date((w.lock - 60) * 1000) };
  const original = scoreEntry(entry, w, d.games), result = scoreEntry({ ...entry, captain: picks[1] }, w, d.games);
  const base = original.picks[1].points;
  assert.equal(result.picks[1].basePoints, base);
  assert.equal(result.picks[1].points, Math.round(base * 2 * 10) / 10);
  assert.equal(result.picks.filter((p) => p.captain).length, 1);
  assert.equal(result.points, Math.round((original.points + base) * 10) / 10);
  assert.equal(weekBoard([{ ...entry, captain: picks[1] }], w, d.games)[0].points, result.points);
  assert.equal(scoreEntry({ ...entry, captain: 99 }, w, d.games), null);
  assert.equal(scoreEntry({ ...entry, captain: "12" }, w, d.games), null);
});
