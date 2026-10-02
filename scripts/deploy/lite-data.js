// Write a trimmed copy of every division file into a built copy of public/:
// data/<division>-lite.json (see public/lib/lite.js). Other divisions' pages load these for
// the overall ranks and search instead of the full files.
// Usage: node scripts/deploy/lite-data.js <site dir>   (the deploy runs it on a copy of public/)
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { liteDivision } from "../../public/lib/lite.js";

const dir = path.join(path.resolve(process.argv[2] ?? "_site"), "data");
for (const f of await readdir(dir)) {
  if (!f.endsWith(".json") || /-(detail|lite|draft)\.json$/.test(f)) continue;
  const full = await readFile(path.join(dir, f), "utf8");
  const lite = JSON.stringify(liteDivision(JSON.parse(full)));
  const out = f.replace(/\.json$/, "-lite.json");
  await writeFile(path.join(dir, out), lite);
  console.log(`${out}: ${Math.round(lite.length / 1024)} KB (full ${Math.round(full.length / 1024)} KB)`);
}
