// Add `buybacks` (seconds of each buyback) to every game already in public/data/*.json from the
// cached OpenDota matches (.cache/opendota), with no network calls. The sync writes it from now on.
// Usage: node scripts/buybacks-backfill.js
import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { leagueJson } from "./league-json.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public", "data");
for (const f of (await readdir(DATA)).filter((f) => f.endsWith(".json") && !f.endsWith("-detail.json"))) {
  const d = JSON.parse(await readFile(path.join(DATA, f), "utf8"));
  let done = 0, missing = 0, total = 0;
  for (const g of d.games) {
    const file = path.join(ROOT, ".cache", "opendota", `match_${g.match_id}.json`);
    if (!existsSync(file)) { missing++; continue; }
    const od = JSON.parse(await readFile(file, "utf8"));
    const bySlot = [...od.players].sort((x, y) => x.player_slot - y.player_slot);
    // Placed just before dust_used, where the sync writes it, so the next sync doesn't reorder keys.
    g.players = g.players.map((p, i) => {
      const log = bySlot[i].buyback_log, buybacks = Array.isArray(log) ? log.map((b) => b.time) : null;
      total += buybacks?.length ?? 0;
      const { buybacks: _, ...rest } = p, out = {};
      for (const [k, v] of Object.entries(rest)) { if (k === "dust_used") out.buybacks = buybacks; out[k] = v; }
      if (!("buybacks" in out)) out.buybacks = buybacks;
      return out;
    });
    done++;
  }
  await writeFile(path.join(DATA, f), leagueJson(d));
  console.log(`${f}: ${done} games, ${total} buybacks${missing ? `, ${missing} not in the cache` : ""}`);
}
