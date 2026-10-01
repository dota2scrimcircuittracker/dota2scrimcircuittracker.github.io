// Local dev server: serves public/ exactly as GitHub Pages will. No backend — the site
// talks to Firestore directly. Usage: npm start → http://localhost:3000
// `node server.js _site` serves a deploy build instead (preview pages, trimmed data files).
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), process.argv[2] ?? "public");
const PORT = Number(process.env.PORT ?? 3000);
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon",
};

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  const file = path.normalize(path.join(root, decodeURIComponent(pathname === "/" ? "/index.html" : pathname)));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    // /warrior/players/ etc.: the deploy writes preview pages there; locally, serve the app.
    if (!path.extname(pathname)) {
      res.writeHead(200, { "content-type": MIME[".html"], "cache-control": "no-store" }).end(await readFile(path.join(root, "index.html")));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Dota Scrim League (static) at http://localhost:${PORT}`));
