// Local dev server: serves public/ exactly as GitHub Pages will. No backend — the site
// talks to Firestore directly (one dev-only exception, the dev-page saves below).
// Usage: npm start → http://localhost:3000
// `node server.js _site` serves a deploy build instead (preview pages, trimmed data files).
import http from "node:http";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), process.argv[2] ?? "public");
const PORT = Number(process.env.PORT ?? 3000);
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

// Dev only: the hero-art picker (public/_dev/cards.html) and the loading-screen sorter
// (public/_dev/screen-sort.html) save their choices here, so Claude can read them.
// public/_dev/ is gitignored and never deployed.
const DEV_SAVES = new Set(["/_dev/hero-art.json", "/_dev/screen-sort.json", "/_dev/cosmetics-expansion-votes.json", "/_dev/cosmetics-expansion-v2-votes.json", "/_dev/cosmetics-expansion-v3-votes.json", "/_dev/cosmetics-expansion-v4-votes.json", "/_dev/cosmetics-expansion-v5-votes.json", "/_dev/cosmetics-expansion-v6-votes.json", "/_review/cosmetics-tier-ranks.json"]);

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (req.method === "PUT" && DEV_SAVES.has(pathname)) {
    let body = "";
    for await (const c of req) { body += c; if (body.length > 100_000) { res.writeHead(413).end(); return; } }
    try { JSON.parse(body); } catch { res.writeHead(400).end(); return; }
    // The tier ranking (public/_review/tier-rank.html) saves outside public/ so Claude can read it.
    const target = pathname === "/_review/cosmetics-tier-ranks.json" ? path.join(root, "..", "scripts", "debug", "cosmetics-tier-ranks.json") : path.join(root, pathname);
    try { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, body); }
    catch { res.writeHead(500).end("Could not save review"); return; }
    res.writeHead(204).end();
    return;
  }
  // Dev only: a ticket's ?fbreview= link (Discord posts it before anyone runs `show`) fetches its
  // replay file; write it on first open with `feedback.cjs show`, using Jonah's Firebase login.
  const review = pathname.match(/^\/_dev\/feedback\/(FB-[A-Z0-9]{6})\.json$/);
  if (review) {
    const have = await readFile(path.join(root, pathname)).then(() => true, () => false);
    if (!have) await new Promise((done) => execFile(process.execPath, [path.join(root, "..", "scripts", "feedback.cjs"), "show", review[1]], { cwd: path.join(root, "..") }, done));
  }
  const file = path.normalize(path.join(root, decodeURIComponent(pathname === "/" ? "/index.html" : pathname)));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  // A folder serves its index.html (a deploy build's preview pages), as GitHub Pages does.
  const target = pathname.endsWith("/") && pathname !== "/" ? path.join(file, "index.html") : file;
  try {
    const body = await readFile(target);
    res.writeHead(200, { "content-type": MIME[path.extname(target)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    // Any other page address: a deploy build answers with its 404.html (the app) like GitHub
    // Pages; public/ has none, so npm start serves the app as a normal page.
    if (!path.extname(pathname)) {
      const notFound = await readFile(path.join(root, "404.html")).catch(() => null);
      res.writeHead(notFound ? 404 : 200, { "content-type": MIME[".html"], "cache-control": "no-store" }).end(notFound ?? await readFile(path.join(root, "index.html")));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Dota Scrim League (static) at http://localhost:${PORT}`));
