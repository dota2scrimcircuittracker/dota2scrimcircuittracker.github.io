// Dev tool: paste the test screenshots into wider frames (the rest of the screen, a
// second window, a taskbar) and see how much of each game the OCR still reads.
// Usage: node scripts/ocr-wide.js            (every variant)
//        ONLY="ultrawide" node scripts/ocr-wide.js
//        SAVE=dir node scripts/ocr-wide.js   (also write the composed images to dir)
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createNodeEngine } from "../lib/ocr-node.js";
import { parseScreenshots } from "../public/lib/ocr/parse.js";

const GAMES = [
  ["game1", "data/sample-game1.json", ["test-screenshots/game1-overview.webp", "test-screenshots/game1-scoreboard.webp"]],
  ["game2", "data/sample-game2.json", ["test-screenshots/game2-overview.png", "test-screenshots/game2-scoreboard.png"]],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (x, y, size, fill, s, weight = 600) => `<text x="${x}" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(s)}</text>`;
// Dota's dashboard bar across the top: dark strip, bright menu words and icons.
const dotaBar = (W, h) => `<rect x="0" y="0" width="${W}" height="${h}" fill="#1c1b19"/>
  ${["DOTA 2", "HEROES", "STORE", "WATCH", "LEARN", "ARCADE"].map((s, i) => text(40 + i * 170, h * 0.62, h * 0.32, i ? "#b8b2a8" : "#ffffff", s)).join("")}
  ${[0, 1, 2, 3].map((i) => `<rect x="${W - 60 - i * 70}" y="${h * 0.2}" width="${h * 0.6}" height="${h * 0.6}" rx="6" fill="#d9d4ca"/>`).join("")}
  <rect x="${W / 2 - 140}" y="${h * 0.18}" width="280" height="${h * 0.64}" fill="#2f7d3b"/>${text(W / 2 - 70, h * 0.62, h * 0.3, "#ffffff", "PLAY DOTA")}`;
// Windows taskbar along the bottom.
const taskbar = (W, H, h) => `<rect x="0" y="${H - h}" width="${W}" height="${h}" fill="#202020"/>
  ${Array.from({ length: 9 }, (_, i) => `<rect x="${W / 2 - 250 + i * 56}" y="${H - h + h * 0.2}" width="${h * 0.6}" height="${h * 0.6}" rx="4" fill="${["#3a8ee6", "#f2c94c", "#e0e0e0", "#6fcf97", "#eb5757"][i % 5]}"/>`).join("")}
  ${text(W - 120, H - h * 0.35, h * 0.3, "#ffffff", "14:32", 400)}`;
// A friends list / chat panel: mid-gray rows of names.
const sidePanel = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#23211e"/>
  ${Array.from({ length: Math.floor(h / 46) }, (_, i) => `<rect x="${x + 12}" y="${y + 12 + i * 46}" width="30" height="30" fill="#8a8378"/>${text(x + 54, y + 34 + i * 46, 17, "#cfc8bc", ["Friends", "Nightfall", "Kaleb", "Party chat", "Anchor", "ttv_blink", "Scrim bot"][i % 7], 400)}`).join("")}`;
// A light-theme window (browser, Discord) on the other monitor half.
const lightWindow = (x, y, w, h, lines = ["Paste two screenshots", "Kills 29 Deaths 22", "Hero damage 30,151", "Net worth 12,915", "Captains Mode 44:43"]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>
  <rect x="${x}" y="${y}" width="${w}" height="44" fill="#e8e8e8"/>${text(x + 16, y + 29, 16, "#333333", "Scrim League — Upload", 400)}
  ${Array.from({ length: Math.floor((h - 80) / 34) }, (_, i) => text(x + 24, y + 90 + i * 34, 18, "#222222", lines[i % lines.length], 400)).join("")}`;

// Each variant: canvas size from the screenshot's (w, h), where it goes, what's around it,
// and an optional final width (a 1080p or 1440p full-screen capture).
const VARIANTS = [
  { name: "16:9 full screen", size: (w, h) => { const W = Math.round(w * 1.28); return [W, Math.max(Math.round(W * 9 / 16), h + 190)]; },
    at: (W, H, w, h) => [Math.round((W - w) / 2), Math.round((H - h) / 2) + 20], svg: (W, H) => dotaBar(W, 64) + taskbar(W, H, 48) },
  { name: "16:9 full screen @1920", size: (w, h) => { const W = Math.round(w * 1.28); return [W, Math.max(Math.round(W * 9 / 16), h + 190)]; },
    at: (W, H, w, h) => [Math.round((W - w) / 2), Math.round((H - h) / 2) + 20], svg: (W, H) => dotaBar(W, 64) + taskbar(W, H, 48), outWidth: 1920 },
  { name: "ultrawide", size: (w, h) => [Math.round(w * 1.75), Math.round(h * 1.12)],
    at: (W, H, w, h) => [Math.round((W - w) / 2), Math.round((H - h) / 2)], svg: (W, H) => sidePanel(W - 300, 40, 280, H - 80) },
  { name: "second window beside", size: (w, h) => [Math.round(w * 1.6), Math.round(h * 1.2)],
    at: (W, H, w, h) => [20, Math.round((H - h) / 2)], svg: (W, H, w) => lightWindow(w + 60, 30, W - w - 80, H - 60) },
  // This site open beside the game: its tables use the scoreboard's own words (GPM, XPM).
  { name: "site open beside", size: (w, h) => [Math.round(w * 1.6), Math.round(h * 1.2)],
    at: (W, H, w, h) => [20, Math.round((H - h) / 2)], svg: (W, H, w) => lightWindow(w + 60, 30, W - w - 80, H - 60, ["Players", "GPM 703 XPM 774", "Hero damage 30,151", "LH / DN 287 / 14"]) },
  { name: "off-centre + panels", size: (w, h) => [Math.round(w * 1.4), Math.round(h * 1.45)],
    at: (W, H, w, h) => [W - w - 10, H - h - 10], svg: (W, H) => dotaBar(W, 56) + sidePanel(10, 70, 240, H - 90) },
];

async function compose(buf, v) {
  const { width: w, height: h } = await sharp(buf).metadata();
  const [W, H] = v.size(w, h);
  const [x, y] = v.at(W, H, w, h);
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#151311"/><stop offset="1" stop-color="#0b0a09"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>${v.svg(W, H, w, h)}</svg>`;
  let img = sharp(Buffer.from(bg)).composite([{ input: await sharp(buf).removeAlpha().png().toBuffer(), left: x, top: y }]);
  let out = await img.png().toBuffer();
  if (v.outWidth) out = await sharp(out).resize(v.outWidth).png().toBuffer();
  return out;
}

const FIELDS = ["name", "hero", "level", "kills", "deaths", "assists", "net_worth", "last_hits", "denies", "gpm", "xpm", "hero_damage", "hero_healing"];
export function score(match, expected) {
  let right = 0, total = 0;
  for (const k of ["team_a", "team_b", "score_a", "score_b", "winner", "duration"]) {
    total++;
    if (String(match[k]).toLowerCase() === String(expected[k]).toLowerCase()) right++;
  }
  expected.players.forEach((w, i) => FIELDS.forEach((f) => {
    total++;
    const g = match.players[i]?.[f];
    if ((typeof g === "string" ? g.toLowerCase() : g) === (typeof w[f] === "string" ? w[f].toLowerCase() : w[f])) right++;
  }));
  return { right, total };
}

const ONLY = process.env.ONLY?.split(",");
const engine = createNodeEngine();
for (const [game, sample, files] of GAMES) {
  const expected = JSON.parse(await readFile(sample, "utf8"));
  const originals = await Promise.all(files.map((f) => readFile(f)));
  for (const v of [{ name: "original" }, ...VARIANTS].filter((x) => !ONLY || ONLY.includes(x.name))) {
    const inputs = v.size ? await Promise.all(originals.map((b) => compose(b, v))) : originals;
    if (process.env.SAVE) {
      await mkdir(process.env.SAVE, { recursive: true });
      await Promise.all(inputs.map((b, i) => writeFile(path.join(process.env.SAVE, `${game}-${v.name.replace(/\W+/g, "_")}-${i ? "scoreboard" : "overview"}.png`), b)));
    }
    const t = Date.now();
    const { match, notes } = await parseScreenshots(engine, inputs);
    const { right, total } = score(match, expected);
    const problems = notes.filter((n) => !n.startsWith("Row")).join(" / ");
    console.log(`${game} ${v.name.padEnd(24)} ${String(right).padStart(3)}/${total} (${Math.round((right / total) * 100)}%) ${Math.round((Date.now() - t) / 1000)}s${problems ? "  NOTE: " + problems : ""}`);
  }
}
await engine.terminate();
