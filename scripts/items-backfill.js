// Add `items` and `item_times` to every game already in public/data/*.json from the cached
// OpenDota matches (.cache/opendota), with no network calls. The sync writes them from now on.
// Usage: node scripts/items-backfill.js
import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { itemsFrom } from "../public/lib/items.js";
import { leagueJson } from "./league-json.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public", "data");
for (const f of (await readdir(DATA)).filter((f) => f.endsWith(".json"))) {
  const d = JSON.parse(await readFile(path.join(DATA, f), "utf8"));
  let done = 0, missing = 0;
  for (const g of d.games) {
    const file = path.join(ROOT, ".cache", "opendota", `match_${g.match_id}.json`);
    if (!existsSync(file)) { missing++; continue; }
    const od = JSON.parse(await readFile(file, "utf8"));
    const bySlot = [...od.players].sort((x, y) => x.player_slot - y.player_slot);
    g.players.forEach((p, i) => Object.assign(p, itemsFrom(bySlot[i])));
    done++;
  }
  await writeFile(path.join(DATA, f), leagueJson(d));
  console.log(`${f}: ${done} games with items${missing ? `, ${missing} not in the cache` : ""}`);
}
