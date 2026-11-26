import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { liteDivision, wrappedDivision } from "../public/lib/lite.js";
import { seasonGames, seasonAwards, seasonResults, playerWrapped, byPlayer } from "../public/lib/wrapped.js";
import { parsedPlayers, moreOf, performanceOf, leaderboards } from "../public/lib/wrapped-more.js";
import { teamWrapped } from "../public/lib/team-wrapped.js";
import { laneCuts } from "../public/lib/lanes.js";
import { withNicknames } from "../public/lib/nicknames.js";
import { isRemake, withDerived, hasDetails, playerLeaderboard, heroStats } from "../public/lib/stats.js";
import { withPerGame } from "../public/lib/ranks.js";
import { heroRatings } from "../public/lib/tiers.js";
import { buildSearchIndex } from "../public/lib/search.js";
import { DIVISIONS } from "../public/lib/divisions.js";

// As app.js loads a division (loadDivision), then what the overall ranks read (statRows,
// heroRows, heroRanks) and the search index.
const games = (raw) => {
  const d = withNicknames(structuredClone(raw));
  return d.games.filter((g) => !isRemake(g)).map((g) => withDerived({ ...g, createdAt: new Date(g.start_time * 1000) })).filter(hasDetails);
};
const asHero = (ms) => ms.map((m) => ({ ...m, players: m.players.map((p) => ({ ...p, player_key: `hero:${p.hero}`, name: p.hero, team_name: null })) }));
const ranks = (raw) => {
  const ms = games(raw);
  return {
    players: playerLeaderboard(ms).map(withPerGame),
    heroes: playerLeaderboard(asHero(ms)).map(withPerGame),
    draft: heroStats(ms),
    ratings: [...heroRatings(ms)],
    search: buildSearchIndex([{ key: "x", label: "X", root: "#/x", data: withNicknames(structuredClone(raw)) }]),
  };
};

for (const { key } of DIVISIONS) {
  const file = `public/data/${key}.json`;
  test(`trimmed ${key} file gives the same ranks and search`, { skip: !existsSync(file) && "no data file" }, () => {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    const lite = liteDivision(raw);
    assert.ok(JSON.stringify(lite).length < JSON.stringify(raw).length * 0.6, "trimmed file should be much smaller");
    assert.deepEqual(ranks(lite), ranks(raw));
  });
}

// Wrapped's copy (wrappedDivision): every Wrapped number comes out the same. Games and players
// inside the results are compared by id, since the trimmed ones carry fewer fields.
const wrapGames = (raw) => {
  const d = withNicknames(structuredClone(raw));
  d.games = d.games.filter((g) => !isRemake(g)).map((g) => withDerived({ ...g, createdAt: new Date(g.start_time * 1000) }));
  return d;
};
const wrappedOut = (raw, key) => {
  const d = wrapGames(raw), games = seasonGames(d.games), cuts = laneCuts(d.games.filter(hasDetails));
  const known = new Map();
  for (const m of d.games) { known.set(m, `game:${m.id}`); for (const p of m.players ?? []) known.set(p, `p:${m.id}:${p.player_slot ?? p.account_id}:${p.hero}`); }
  const results = seasonResults(d, { split: !!DIVISIONS.find((x) => x.key === key)?.views });
  const awards = seasonAwards(games, { series: d.series, teams: d.teams, cuts, results });
  const parsed = parsedPlayers(games), players = [...byPlayer(games).keys()];
  const out = {
    awards, results, boards: leaderboards(games),
    players: players.map((k) => [playerWrapped(games, k, { cuts, awards, results }), moreOf(parsed, k), performanceOf(parsed, k)]),
    teams: d.teams.map((t) => teamWrapped(games, t.id)),
  };
  return JSON.stringify(out, (k, v) => (v && typeof v === "object" && known.has(v) ? known.get(v) : v instanceof Map ? [...v] : v instanceof Set ? [...v] : v));
};
for (const { key } of DIVISIONS) {
  const file = `public/data/${key}.json`;
  test(`Wrapped copy of ${key} gives the same Wrapped`, { skip: !existsSync(file) && "no data file" }, () => {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    const wrap = wrappedDivision(raw);
    assert.ok(JSON.stringify(wrap).length < JSON.stringify(raw).length * 0.75, "Wrapped copy should be smaller");
    assert.equal(wrappedOut(wrap, key), wrappedOut(raw, key));
  });
}
