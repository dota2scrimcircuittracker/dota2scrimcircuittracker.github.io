// Integrity hashes for every third-party script the site loads. The browser refuses a file
// whose bytes don't match, so a changed or hijacked CDN copy never runs.
// - ES modules (Firebase, Tesseract, modern-screenshot): the import map in public/index.html.
// - GoatCounter's count.js (a plain script tag, off until a site code is set): COUNT_JS_INTEGRITY
//   in public/lib/visits.js.
// Run after changing a CDN URL or version; --check only reports (exit 1 if anything is off).
// test/integrity.test.js checks, offline, that every CDN URL in the code has a hash.
// Usage: node scripts/gen/cdn-integrity.js [--check]
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PUBLIC = path.join(ROOT, "public");
const CHECK = process.argv.includes("--check");
export const CDN_URL = /https:\/\/(?:cdn\.jsdelivr\.net|www\.gstatic\.com|gc\.zgo\.at)\/[^"'`\s)]+\.m?js(?=["'`\s)])/g;
const GOATCOUNTER = /^https:\/\/gc\.zgo\.at\//;

async function jsFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!["data", "_dev", "img"].includes(e.name)) out.push(...(await jsFiles(p))); }
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}
const sha384 = (buf) => `sha384-${createHash("sha384").update(buf).digest("base64")}`;

const urls = new Set();
for (const f of await jsFiles(PUBLIC)) for (const m of (await readFile(f, "utf8")).matchAll(CDN_URL)) urls.add(m[0]);
const hashes = {};
for (const u of [...urls].sort()) {
  const res = await fetch(u);
  if (!res.ok) throw new Error(`${u}: HTTP ${res.status}`);
  hashes[u] = sha384(Buffer.from(await res.arrayBuffer()));
}

let bad = 0;
// The import map: every module URL.
const indexFile = path.join(PUBLIC, "index.html");
const index = await readFile(indexFile, "utf8");
const MAP = /(<script type="importmap">)([\s\S]*?)(<\/script>)/;
const current = JSON.parse(index.match(MAP)?.[2] ?? "{}").integrity ?? {};
const modules = Object.fromEntries(Object.entries(hashes).filter(([u]) => !GOATCOUNTER.test(u)));
for (const [u, h] of Object.entries(modules)) if (current[u] !== h) { bad++; console.log(`${current[u] ? "changed" : "missing"}: ${u}`); }
for (const u of Object.keys(current)) if (!modules[u]) { bad++; console.log(`unused: ${u}`); }
const json = JSON.stringify({ integrity: modules }, null, 2).replace(/\n/g, "\n  ");
if (!CHECK) await writeFile(indexFile, index.replace(MAP, `$1\n  ${json}\n  $3`));
// GoatCounter: the hash next to its URL in visits.js.
const visitsFile = path.join(PUBLIC, "lib", "visits.js");
let visits = await readFile(visitsFile, "utf8");
for (const [u, h] of Object.entries(hashes).filter(([u]) => GOATCOUNTER.test(u))) {
  const cur = visits.match(/const COUNT_JS_INTEGRITY = "([^"]*)";/)?.[1];
  if (cur !== h) { bad++; console.log(`${cur ? "changed" : "missing"}: ${u}`); }
  visits = visits.replace(/const COUNT_JS_INTEGRITY = "[^"]*";/, `const COUNT_JS_INTEGRITY = "${h}";`);
}
if (!CHECK) await writeFile(visitsFile, visits);
console.log(`${Object.keys(hashes).length} CDN files, ${bad ? `${bad} ${CHECK ? "to update" : "updated"}` : "all hashes current"}`);
if (CHECK && bad) process.exit(1);
