// Reads the real test screenshots with the same OCR code the website runs.
// Slow (~5 s): it runs Tesseract. Tags are deliberately not read, so they're excluded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createNodeEngine } from "../lib/ocr-node.js";
import { parseScreenshots } from "../public/lib/ocr/parse.js";
import sharp from "sharp";

// The screenshots and their transcription aren't in the repo (real gamertags).
const haveFixtures = existsSync(new URL("../test-screenshots/game1-scoreboard.webp", import.meta.url))
  && existsSync(new URL("../data/sample-game1.json", import.meta.url));

test("OCR reads the sample game's screenshots", { timeout: 120000, skip: !haveFixtures && "test screenshots not present" }, async () => {
  const expected = JSON.parse(readFileSync(new URL("../data/sample-game1.json", import.meta.url), "utf8"));
  const engine = createNodeEngine();
  const files = ["game1-overview.webp", "game1-scoreboard.webp"].map((f) => readFileSync(new URL(`../test-screenshots/${f}`, import.meta.url)));
  const { match } = await parseScreenshots(engine, files);
  await engine.terminate();

  // Every number, hero, team and the result must be exact.
  for (const k of ["team_a", "team_b", "score_a", "score_b", "winner", "duration"]) assert.equal(match[k], expected[k], k);
  const exact = ["hero", "level", "kills", "deaths", "assists", "net_worth", "last_hits", "denies", "gpm", "xpm", "hero_damage", "hero_healing"];
  expected.players.forEach((w, i) => {
    for (const f of exact) assert.equal(match.players[i][f], w[f], `${w.name}.${f}`);
  });
  // Names exact, with the clan tag dropped (including on the highlighted row).
  expected.players.forEach((w, i) => assert.equal(match.players[i].name, w.name, `name ${i + 1}`));
});

// Wider captures: the same screenshots with the Dota menu bar above and a white window
// beside them. Version 1 can't read these (11 "cards", no scoreboard headers); version 2
// (lib/ocr/locate.js) finds the game and must read it exactly as well as the original.
async function widen(buf) {
  const { width: w, height: h } = await sharp(buf).metadata();
  const W = Math.round(w * 1.6), H = Math.round(h * 1.3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#121110"/>
    <rect width="${W}" height="60" fill="#1c1b19"/><text x="40" y="40" font-size="22" font-family="Arial" fill="#ddd">DOTA 2   HEROES   STORE   WATCH</text>
    <rect x="${w + 60}" y="80" width="${W - w - 80}" height="${H - 100}" fill="#fff"/><text x="${w + 90}" y="140" font-size="18" font-family="Arial" fill="#222">Paste two screenshots</text></svg>`;
  return sharp(Buffer.from(svg)).composite([{ input: await sharp(buf).removeAlpha().png().toBuffer(), left: 20, top: 150 }]).png().toBuffer();
}

test("OCR finds the game in a wider screenshot (version 2)", { timeout: 180000, skip: !haveFixtures && "test screenshots not present" }, async () => {
  const expected = JSON.parse(readFileSync(new URL("../data/sample-game1.json", import.meta.url), "utf8"));
  const engine = createNodeEngine();
  const files = await Promise.all(["game1-overview.webp", "game1-scoreboard.webp"].map((f) => widen(readFileSync(new URL(`../test-screenshots/${f}`, import.meta.url)))));
  const { match } = await parseScreenshots(engine, files);
  await engine.terminate();
  for (const k of ["team_a", "team_b", "score_a", "score_b", "winner", "duration"]) assert.equal(match[k], expected[k], k);
  const exact = ["name", "hero", "level", "kills", "deaths", "assists", "net_worth", "last_hits", "denies", "gpm", "xpm", "hero_damage", "hero_healing"];
  expected.players.forEach((w, i) => {
    for (const f of exact) assert.equal(match.players[i][f], w[f], `${w.name}.${f}`);
  });
});
