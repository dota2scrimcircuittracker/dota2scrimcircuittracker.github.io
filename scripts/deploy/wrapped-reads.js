// Wrapped's series model reads, worked out once at deploy instead of on every visit
// (public/lib/wrapped-reads.js). Writes data/wrapped-reads.json into a built copy of public/:
//   { season, leagues: { <division key>: rows, ..., all: rows } }, rows [series id, q, p, hs, as]
// The page uses a league's rows when they match its data, and works them out itself otherwise.
// Also ranked: { <division key>: packed }, each division's draft-file `ranked` (main accounts'
// ranked pubs) cut to the season (packRanked), so Wrapped doesn't load every draft file for
// Most sandbagged. And names: every rostered player's name, for the Arcana Cup slides.
// Usage: node scripts/deploy/wrapped-reads.js <site dir>
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { withNicknames } from "../../public/lib/nicknames.js";
import { withDerived, isRemake, hasDetails, playerKey, gameMvp } from "../../public/lib/stats.js";
import { SEASON, DIVISIONS } from "../../public/lib/divisions.js";
import { modelReads, mergeDraftFiles, packReads, packRanked } from "../../public/lib/wrapped-reads.js";
import { wrappedDivision } from "../../public/lib/lite.js";
import { seasonGames, seasonOver, byPlayer, mainTeamOf, signatureOf, leaguePersonalities } from "../../public/lib/wrapped.js";
import { parsedPlayers, everyDivision } from "../../public/lib/wrapped-more.js";
import { tierModel, tierList, MIN_GAMES } from "../../public/lib/tiers.js";

const dir = path.join(path.resolve(process.argv[2] ?? "_site"), "data");
const json = (f) => readFile(path.join(dir, f), "utf8").then(JSON.parse).catch(() => null);

// As the page loads a division (core.js loadDivision).
const prep = (raw) => {
  const d = withNicknames(raw);
  d.games = d.games.filter((g) => !isRemake(g)).map((g) => withDerived({ ...g, createdAt: new Date(g.start_time * 1000) }));
  return d;
};

const started = Date.now();
const parts = [];
for (const dv of DIVISIONS) {
  const raw = await json(`${dv.key}.json`);
  if (raw) parts.push({ key: dv.key, d: prep(raw), draft: await json(`${dv.key}-draft.json`) });
}
const leagues = {};
for (const { key, d, draft } of parts) leagues[key] = packReads(modelReads(d, mergeDraftFiles([draft])));
// All divisions, as core.js allData puts them together (the menu's order).
if (parts.length) {
  const all = {
    teams: parts.flatMap(({ key, d }) => d.teams.map((t) => ({ ...t, league: key }))),
    series: parts.flatMap(({ d }) => d.series),
    games: parts.flatMap(({ d }) => d.games).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
  };
  leagues.all = packReads(modelReads(all, mergeDraftFiles(parts.map((x) => x.draft))));
}
// From the earliest season start of any league (pages/wrapped.js: a league's first series).
const starts = parts.flatMap(({ d }) => d.series.map((x) => x.time).filter(Boolean));
const since = starts.length ? Math.min(...starts) : Infinity;
const ranked = Object.fromEntries(parts.map(({ key, draft }) => [key, packRanked(draft?.ranked, since)]));
// Each division file's sync stamp, so a page with newer data reads the draft files instead.
const updated = Object.fromEntries(parts.map(({ key, d }) => [key, d.updated ?? null]));
// Every rostered player's name (account id -> name), for the Arcana Cup slides' podium players
// without a nickname, so a division's review doesn't load every division to find one name.
const names = Object.fromEntries(parts.flatMap(({ d }) => d.teams.flatMap((t) => t.players.map((q) => [String(q.account_id), q.name]))));
const out = JSON.stringify({ season: SEASON.name, leagues, ranked, updated, names });
await writeFile(path.join(dir, "wrapped-reads.json"), out);
const n = Object.values(leagues).reduce((s, r) => s + r.length, 0);
console.log(`wrapped-reads.json: ${Object.keys(leagues).length} leagues, ${n} reads, ${Math.round(out.length / 1024)} KB, ${((Date.now() - started) / 1000).toFixed(1)}s`);

// One league's share of the file, data/wrapped-reads-<key>.json, so a division's Wrapped reads its
// own league's reads only (All's review keeps the whole file).
for (const { key } of parts) {
  await writeFile(path.join(dir, `wrapped-reads-${key}.json`),
    JSON.stringify({ season: SEASON.name, leagues: { [key]: leagues[key] }, ranked: { [key]: ranked[key] }, updated: { [key]: updated[key] }, names }));
}

// Each player's Wrapped, data/wrapped/<account>.json: the parts that compare them with every
// division, so their Wrapped loads their own division only (pages/wrapped.js playerStory). Worked
// out from Wrapped's own copies of the divisions (lib/lite.js wrappedDivision), as the page does:
//   home     the division the page opens their Wrapped in (the first, in menu order, they played in)
//   allOpen  whether All's review is open (every division's season over)
//   tier     their card's tier, { tier, rating }, as parts/tiers.js divisionTiers gives it
//   league   { signature, mvpRank, ranked }: their AD2L-wide ranks (lib/wrapped.js playerWrapped)
//   everyDiv where they'd rank in each division (lib/wrapped-more.js everyDivision)
//   personality  their shared personality (lib/wrapped.js leaguePersonalities), or null
// updated: their home division's sync stamp; the page works it all out itself when it differs.
const trimmed = [];
for (const dv of DIVISIONS) {
  const raw = await json(`${dv.key}.json`);
  if (raw) trimmed.push({ dv, key: dv.key, d: prep(wrappedDivision(raw)) });
}
for (const x of trimmed) x.games = seasonGames(x.d.games);
const allOpen = trimmed.length === DIVISIONS.length && trimmed.every(({ dv, d }) => seasonOver(d, { split: !!dv.views }));
const tiers = new Map();
for (const { d } of trimmed) {
  const detailed = d.games.filter(hasDetails);
  for (const { tier, players } of tierList(detailed, { model: tierModel(detailed, { minGames: MIN_GAMES }), minGames: MIN_GAMES }).tiers)
    for (const p of players) tiers.set(p.key, { tier, rating: p.rating });
}
const allGames = seasonGames(trimmed.flatMap(({ d }) => d.games).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
const field = byPlayer(allGames), fieldRanked = [...field.values()].filter((e) => e.rows.length >= MIN_GAMES);
const mvpsOf = (e) => e.rows.filter(({ m, p }) => gameMvp(m) === p).length;
const everyLeague = trimmed.map(({ dv, games }) => ({ key: dv.key, name: dv.name, games, players: parsedPlayers(games) }));
const personas = leaguePersonalities(trimmed.map(({ dv, d, games }) => {
  const players = byPlayer(games), teamDiv = new Map(d.teams.map((t) => [t.id, t.division ?? null]));
  const divisionOf = (key) => { const rows = players.get(key)?.rows; return rows?.length && dv.views ? teamDiv.get(mainTeamOf(rows).id) ?? null : null; };
  return { id: dv.key, players, divisionOf };
}), { pairsOnly: true, draft: true });
await rm(path.join(dir, "wrapped"), { recursive: true, force: true });
await mkdir(path.join(dir, "wrapped"), { recursive: true });
let files = 0, bytes = 0;
for (const [key, me] of field) {
  if (!/^\d+$/.test(key)) continue;
  const home = trimmed.find(({ games }) => games.some((m) => m.players.some((p) => playerKey(p) === key)));
  if (!home) continue;
  const mvps = mvpsOf(me);
  const body = JSON.stringify({
    season: SEASON.name, updated: home.d.updated ?? null, home: home.key, allOpen, tier: tiers.get(key) ?? null,
    league: { signature: signatureOf(field, me), mvpRank: me.rows.length >= MIN_GAMES && mvps ? 1 + fieldRanked.filter((e) => mvpsOf(e) > mvps).length : null, ranked: fieldRanked.length },
    everyDiv: everyDivision(everyLeague, home.key, key), personality: personas.get(home.key)?.get(key) ?? null,
  });
  await writeFile(path.join(dir, "wrapped", `${key}.json`), body);
  files++; bytes += body.length;
}
console.log(`wrapped/: ${files} players, ${Math.round(bytes / files / 1024 * 10) / 10} KB each, ${((Date.now() - started) / 1000).toFixed(1)}s`);
