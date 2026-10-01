// Sync-time side of the ward vision (see public/lib/vision.js for what's measured and how):
// reading the map dump (a PNG, decoded with node:zlib so the sync needs no packages) and
// caching it in .cache/vision/.
import { inflateSync } from "node:zlib";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { VISION_MAPS, buildMap } from "../public/lib/vision.js";

export { VISION_MAPS, wardLog, buildMap, wardTile, fov, visionFields } from "../public/lib/vision.js";

// 8-bit RGBA, non-interlaced PNG -> { width, height, px } (4 bytes a pixel). All the map
// dumps are saved that way; anything else throws rather than misreading.
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let o = 8, width = 0, height = 0;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString("ascii", o + 4, o + 8), body = buf.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 6 || body[12] !== 0) throw new Error("map PNG must be 8-bit RGBA, not interlaced");
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = width * 4, px = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), at = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[at + x - 4] : 0, b = y ? px[at - stride + x] : 0, c = x >= 4 && y ? px[at - stride + x - 4] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[at + x] = v & 255;
    }
  }
  return { width, height, px };
}

const maps = new Map();
// The map for an OpenDota patch id, or null if there's none for that patch.
export function visionMap(patch, cacheDir) {
  const def = VISION_MAPS[patch];
  if (!def) return Promise.resolve(null);
  if (!maps.has(patch)) maps.set(patch, (async () => {
    const file = path.join(cacheDir, "vision", def.file);
    if (!existsSync(file)) {
      const res = await fetch(def.url);
      if (!res.ok) throw new Error(`vision map ${def.patch}: HTTP ${res.status}`);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
    }
    return buildMap(decodePng(await readFile(file)), def);
  })());
  return maps.get(patch);
}
