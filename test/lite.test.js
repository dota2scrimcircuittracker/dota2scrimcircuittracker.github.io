import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { liteDivision } from "../public/lib/lite.js";
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
