// public/data/player-pool.json: every rostered player in the Winter divisions with their main
// position, for player packs and the pack-cards panel. { updated, players: [{ account, pos, team, division }] }
// Runs in sync.yml right after the data sync. Written one player per line, with "updated" on its
// own line, so the "Drop timestamp-only changes" step sees real roster/position changes.
import fs from "node:fs";
import { WINTER } from "../../public/lib/winter.js";
import { mainPositions } from "../../public/lib/player-cards.js";

const players = [];
for (const div of WINTER.divisions) {
  const file = new URL(`../../public/data/${div}.json`, import.meta.url);
  if (!fs.existsSync(file)) continue;
  const d = JSON.parse(fs.readFileSync(file));
  const pos = mainPositions(d.games ?? []); // keyed by mainAccount(): a numeric player_key, else account_id
  for (const t of d.teams ?? []) for (const p of t.players ?? []) {
    if (p.account_id == null || !pos.has(p.account_id)) continue;
    players.push({ account: p.account_id, pos: pos.get(p.account_id), team: t.id, division: div });
  }
}
const out = `{"updated":${JSON.stringify(new Date().toISOString())},\n"players":[\n${players.map((p) => JSON.stringify(p)).join(",\n")}\n]}\n`;
fs.writeFileSync(new URL("../../public/data/player-pool.json", import.meta.url), out);
console.log(`player-pool: ${players.length} players`);
