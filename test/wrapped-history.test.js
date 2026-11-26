import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { packRanked, mergeDraftFiles } from "../public/lib/wrapped-reads.js";
import { rankedRecords, byPlayer } from "../public/lib/wrapped.js";
import { withNicknames } from "../public/lib/nicknames.js";
import { withDerived, isRemake } from "../public/lib/stats.js";
import { DIVISIONS } from "../public/lib/divisions.js";

// Most sandbagged from the deploy's cut of the draft files' `ranked` (packRanked) comes out as
// from the draft files: every player, for each division and for all of them, from each one's start.
test("unit: packRanked keeps ranked games from `since`", () => {
  const h = { 1: [50, 1, 20, 100, 1, 30, 130, 0, 0] };
  const packed = packRanked(h, 90);
  assert.deepEqual(packed, { 1: [100, 1, 30, 130, 0, 0] });
  assert.deepEqual(packRanked({ 2: [50, 1, 20] }, 90), {});
  const field = [{ key: "1", p: { account_id: 1 }, rows: [] }];
  assert.deepEqual(rankedRecords(field, packed, 90), rankedRecords(field, h, 90));
});

// Only the draft files a sync has given `ranked` (older ones would compare empty to empty).
const have = DIVISIONS.filter(({ key }) => existsSync(`public/data/${key}.json`) && existsSync(`public/data/${key}-draft.json`)
  && Object.keys(JSON.parse(readFileSync(`public/data/${key}-draft.json`, "utf8")).ranked ?? {}).length);
test("Most sandbagged is the same from the packed ranked games", { skip: !have.length && "no draft file has `ranked` yet (run a sync)" }, () => {
  const parts = have.map(({ key }) => {
    const d = withNicknames(JSON.parse(readFileSync(`public/data/${key}.json`, "utf8")));
    d.games = d.games.filter((g) => !isRemake(g)).map((g) => withDerived({ ...g }));
    return { key, d, draft: JSON.parse(readFileSync(`public/data/${key}-draft.json`, "utf8")) };
  });
  const startOf = (series) => Math.min(...series.map((s) => s.time).filter(Boolean));
  const since = Math.min(...parts.map(({ d }) => startOf(d.series)));
  const packed = Object.fromEntries(parts.map(({ key, draft }) => [key, packRanked(draft.ranked, since)]));
  const ranks = new Map(parts.flatMap(({ d }) => d.teams.flatMap((t) => t.players.filter((q) => q.rank_tier).map((q) => [String(q.account_id), q.rank_tier]))));
  const out = (r) => r.map(({ key, wins, losses, from, to, climb }) => [key, wins, losses, from, to, climb]);
  const check = (keys, games, start) => {
    const field = [...byPlayer(games).values()];
    const full = mergeDraftFiles(keys.map((k) => parts.find((x) => x.key === k).draft)).ranked;
    const cut = Object.assign({}, ...keys.map((k) => packed[k]));
    assert.deepEqual(out(rankedRecords(field, cut, start, ranks)), out(rankedRecords(field, full, start, ranks)), keys.join("+"));
  };
  for (const { key, d } of parts) check([key], d.games, startOf(d.series));
  check(parts.map((x) => x.key), parts.flatMap(({ d }) => d.games), since);
});
