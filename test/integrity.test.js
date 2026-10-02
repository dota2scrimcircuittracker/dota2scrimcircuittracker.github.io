import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Offline: every third-party script URL in the site's code has an integrity hash (the import map
// in index.html for modules, COUNT_JS_INTEGRITY for GoatCounter). Whether the hashes still match
// the CDN needs the network: node scripts/gen/cdn-integrity.js --check.
const CDN_URL = /https:\/\/(?:cdn\.jsdelivr\.net|www\.gstatic\.com|gc\.zgo\.at)\/[^"'`\s)]+\.m?js(?=["'`\s)])/g;
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (["data", "_dev", "img"].includes(e.name) ? [] : files(path.join(dir, e.name))) : e.name.endsWith(".js") ? [path.join(dir, e.name)] : []);
const SRI = /^sha384-[A-Za-z0-9+/]{64}$/;

test("every CDN script in the code has an integrity hash", () => {
  const urls = new Set(files("public").flatMap((f) => [...readFileSync(f, "utf8").matchAll(CDN_URL)].map((m) => m[0])));
  assert.ok(urls.size >= 5, "expected Firebase, Tesseract, modern-screenshot and GoatCounter");
  const map = JSON.parse(readFileSync("public/index.html", "utf8").match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).integrity;
  const goat = readFileSync("public/lib/visits.js", "utf8").match(/const COUNT_JS_INTEGRITY = "([^"]*)";/)[1];
  for (const u of urls) {
    const h = u.startsWith("https://gc.zgo.at/") ? goat : map[u];
    assert.match(h ?? "", SRI, `${u} has no integrity hash (node scripts/gen/cdn-integrity.js)`);
  }
  for (const u of Object.keys(map)) assert.ok(urls.has(u), `import map lists ${u}, which the code no longer loads`);
});
