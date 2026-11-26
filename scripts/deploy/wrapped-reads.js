// Wrapped's series model reads, worked out once at deploy instead of on every visit
// (public/lib/wrapped-reads.js). Writes data/wrapped-reads.json into a built copy of public/:
//   { season, leagues: { <division key>: rows, ..., all: rows } }, rows [series id, q, p, hs, as]
// The page uses a league's rows when they match its data, and works them out itself otherwise.
// Also ranked: { <division key>: packed }, each division's draft-file `ranked` (main accounts'
// ranked pubs) cut to the season (packRanked), so Wrapped doesn't load every draft file for
// Most sandbagged.
// Usage: node scripts/deploy/wrapped-reads.js <site dir>
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { withNicknames } from "../../public/lib/nicknames.js";
import { withDerived, isRemake } from "../../public/lib/stats.js";
import { SEASON, DIVISIONS } from "../../public/lib/divisions.js";
import { modelReads, mergeDraftFiles, packReads, packRanked } from "../../public/lib/wrapped-reads.js";

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
const out = JSON.stringify({ season: SEASON.name, leagues, ranked, updated });
await writeFile(path.join(dir, "wrapped-reads.json"), out);
const n = Object.values(leagues).reduce((s, r) => s + r.length, 0);
console.log(`wrapped-reads.json: ${Object.keys(leagues).length} leagues, ${n} reads, ${Math.round(out.length / 1024)} KB, ${((Date.now() - started) / 1000).toFixed(1)}s`);
