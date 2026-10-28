// Write data/league-achievements.json into a built copy of public/: each player's League
// achievements from the postseason as played (public/lib/league-achievements.js). The collection
// Worker reads it from the site.
// Usage: node scripts/deploy/league-achievements.js <site dir>   (the deploy runs it on a copy of public/)
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { leagueAchievements } from "../../public/lib/league-achievements.js";
import { DIVISIONS } from "../../public/lib/divisions.js";

const dir = path.join(path.resolve(process.argv[2] ?? "_site"), "data");
const files = {};
for (const { key } of DIVISIONS) {
  const f = path.join(dir, `${key}.json`);
  if (existsSync(f)) files[key] = JSON.parse(await readFile(f, "utf8"));
}
const out = leagueAchievements(files);
await writeFile(path.join(dir, "league-achievements.json"), JSON.stringify(out));
console.log(`league-achievements.json: ${Object.keys(out).length} players`);
