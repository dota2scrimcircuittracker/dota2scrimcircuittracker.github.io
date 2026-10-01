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
  ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon",
};

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
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
