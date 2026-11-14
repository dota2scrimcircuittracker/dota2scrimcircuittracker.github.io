import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { playerStatProfile, cardBackRows, topStats, modelsFor, divisionGames } from "../public/lib/card-back.js";
import { gamePointsAt, WEIGHTS } from "../public/lib/tiers.js";

// A few real Heroic games: enough for the models, quick to score.
const all = JSON.parse(fs.readFileSync(new URL("../public/data/heroic.json", import.meta.url))).games;
const games = all.slice(0, 40);
const models = modelsFor(games);
// The account in the most of those games.
const seen = new Map();
for (const m of games) for (const p of m.players) seen.set(p.account_id, (seen.get(p.account_id) ?? 0) + 1);
const [account, played] = [...seen].sort((a, b) => b[1] - a[1])[0];

test("profile averages the player's stat points and scores at the card's position", () => {
  const prof = playerStatProfile(account, 5, games, models);
  assert.equal(prof.games, played);
  assert.deepEqual(Object.keys(prof.stats).sort(), Object.keys(WEIGHTS[5]).sort());
  const mine = games.map((m) => gamePointsAt(m, games, account, 5, models)).filter(Boolean);
  const pts = mine.map((g) => g.stats.find((s) => s.metric === "assists").points);
  const a = prof.stats.assists;
  assert.equal(a.games, played);
  assert.ok(Math.abs(a.avgPoints - pts.reduce((t, x) => t + x, 0) / pts.length) < 1e-9);
  assert.equal(a.max, WEIGHTS[5].assists);
  assert.ok(a.avgScore >= 0 && a.avgScore <= 100);
  assert.equal(playerStatProfile(account, 5, games, models), prof); // memoized
  assert.notEqual(playerStatProfile(account, 1, games, models), prof); // other position, own profile
});

test("rows show each bonus's potential: max, the player's average, the expected gain", () => {
  const prof = playerStatProfile(account, 1, games, models);
  const card = { pos: 1, main: { stat: "gpm", pct: 15 }, subs: [{ stat: "dmg", pct: 7.5 }, { stat: "kills", pct: 10.7 }, { stat: "lane", pct: 15 }] };
  const rows = cardBackRows(card, prof);
  assert.deepEqual(rows.map((r) => r.kind), ["main", "sub", "sub", "sub"]);
  const [gpm] = rows;
  assert.equal(gpm.label, "GPM");
  assert.equal(gpm.max, 20);
  assert.equal(gpm.maxGain, 3);
  assert.equal(gpm.avg, Math.round(prof.stats.gpm.avgPoints * 10) / 10);
  assert.equal(gpm.gain, Math.round(prof.stats.gpm.avgPoints * 1.5) / 10);
  assert.ok(rows.every((r) => r.avg <= r.max));
});

test("a player with no games gets nulls, not NaN", () => {
  const prof = playerStatProfile(1, 3, games, models);
  assert.equal(prof.games, 0);
  assert.ok(Object.values(prof.stats).every((s) => s.avgPoints === null && s.avgScore === null && s.games === 0));
  const rows = cardBackRows({ pos: 3, main: { stat: "soak", pct: 10 }, subs: [{ stat: "stuns", pct: 5 }] }, prof);
  assert.deepEqual(rows.map((r) => [r.avg, r.gain]), [[null, null], [null, null]]);
  assert.equal(rows[0].maxGain, Math.round(WEIGHTS[3].soak) / 10);
  assert.deepEqual(topStats(prof), []);
  assert.deepEqual(cardBackRows({ pos: 3, main: { stat: "soak", pct: 10 } }, null)[0].avg, null);
});

test("top stats are the player's best average scores at that position", () => {
  const prof = playerStatProfile(account, 5, games, models);
  const top = topStats(prof, 3);
  assert.equal(top.length, 3);
  assert.ok(top[0].score >= top[1].score && top[1].score >= top[2].score);
  const best = Math.max(...Object.values(prof.stats).filter((s) => s.avgScore != null).map((s) => s.avgScore));
  assert.equal(top[0].score, Math.round(best));
  for (const t of top) assert.equal(t.max, WEIGHTS[5][t.stat]);
});

test("division games are split by league and memoized", () => {
  const tagged = [{ id: 1, league: "a" }, { id: 2, league: "b" }, { id: 3, league: "a" }];
  const a = divisionGames(tagged, "a");
  assert.deepEqual(a.map((m) => m.id), [1, 3]);
  assert.equal(divisionGames(tagged, "a"), a);
});
