// Add the combat fields (APM, multi-kills, streaks, kill times, first blood and its victim,
// teamfight share, runes, courier kills, biggest hit, pings, benchmarks) and game-level first
// blood and pauses to every game already in public/data/*.json, and write each division's detail
// file (purchases and skill builds), from the cached OpenDota matches (.cache/opendota), with no
// network calls. The sync writes all of it from now on. Usage: node scripts/backfill/combat-backfill.js
import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { combatFields, gameExtras, firstDeathOf, detailOf, detailName, detailJson } from "../sync/combat-fields.js";
import { leagueJson } from "../sync/league-json.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA = path.join(ROOT, "public", "data");

// Keys go in after `item_times` (players) and `fights` (games), where the sync writes them, so
// the next sync doesn't reorder anything.
const placeAfter = (obj, after, add) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (!(k in add)) { out[k] = v; if (k === after) Object.assign(out, add); }
  return after in obj ? out : { ...out, ...add };
};

for (const f of (await readdir(DATA)).filter((f) => f.endsWith(".json") && !f.endsWith("-detail.json"))) {
  const d = JSON.parse(await readFile(path.join(DATA, f), "utf8"));
  const detail = {};
  let done = 0, missing = 0;
  d.games = await Promise.all(d.games.map(async (g) => {
    const file = path.join(ROOT, ".cache", "opendota", `match_${g.match_id}.json`);
    if (!existsSync(file)) { missing++; return g; }
    const od = JSON.parse(await readFile(file, "utf8"));
    const bySlot = [...od.players].sort((x, y) => x.player_slot - y.player_slot);
    const det = detailOf(od);
    if (det) detail[g.match_id] = det;
    done++;
    const extras = gameExtras(od);
    return placeAfter({ ...g, players: g.players.map((p, i) => placeAfter(p, "item_times", combatFields(bySlot[i], firstDeathOf(extras.first_blood_at, i)))) }, "fights", extras);
  }));
  await writeFile(path.join(DATA, f), leagueJson(d));
  await writeFile(path.join(DATA, detailName(f)), detailJson(detail));
  console.log(`${f}: ${done} games${missing ? `, ${missing} not in the cache` : ""}; ${Object.keys(detail).length} in ${detailName(f)}`);
}
