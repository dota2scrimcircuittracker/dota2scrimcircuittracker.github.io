// Version 2 screenshot locating (public/lib/ocr/locate.js) on drawn test images: no
// Tesseract, no real screenshots needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { trimBright, locateCards, cropImage } from "../public/lib/ocr/locate.js";

const canvas = (width, height, v = 14) => ({ width, height, gray: new Uint8Array(width * height).fill(v) });
const fill = (im, x0, y0, x1, y1, v) => { for (let y = y0; y < y1; y++) im.gray.fill(v, y * im.width + x0, y * im.width + x1); };
// Ten hero cards at scale k: 155 wide, 16 apart, 76 between the teams, 540 tall.
function drawCards(im, left, top, k = 1, v = 90) {
  const xs = [];
  for (let i = 0; i < 10; i++) {
    const x = Math.round(left + (i * 171 + (i >= 5 ? 60 : 0)) * k);
    fill(im, x, top, x + Math.round(155 * k), top + Math.round(540 * k), v);
    xs.push(x);
  }
  return xs;
}

test("finds the hero cards anywhere in a wider screenshot", () => {
  const im = canvas(3000, 1500);
  fill(im, 0, 0, 3000, 60, 40); // menu bar
  fill(im, 40, 120, 300, 1400, 70); // a side panel, card-bright
  const xs = drawCards(im, 900, 700);
  const loc = locateCards(im);
  assert.ok(loc, "found");
  assert.ok(Math.abs(loc.k - 1) < 0.02, `k ${loc.k}`);
  assert.ok(Math.abs(loc.top - 700) <= 3, `top ${loc.top}`); // framing only: version 1 re-finds the cards in the crop
  assert.ok(Math.abs(loc.rect.x0 - (xs[0] - 70)) <= 2 && Math.abs(loc.rect.y0 - (700 - 175)) <= 2);
});

test("scales with the screenshot", () => {
  const im = canvas(2400, 1300);
  drawCards(im, 300, 400, 0.72);
  const loc = locateCards(im);
  assert.ok(loc && Math.abs(loc.k - 0.72) < 0.02, `k ${loc?.k}`);
});

test("no cards: evenly spaced columns without the gap between teams, or only nine", () => {
  const even = canvas(2400, 1200);
  for (let i = 0; i < 10; i++) fill(even, 100 + i * 171, 300, 255 + i * 171, 840, 90);
  assert.equal(locateCards(even), null);
  const nine = canvas(2400, 1200);
  drawCards(nine, 100, 300);
  fill(nine, 100 + 9 * 171 + 60, 300, 100 + 9 * 171 + 60 + 155, 840, 14); // erase the last card
  assert.equal(locateCards(nine), null);
});

test("cuts a light window off the side, and leaves a plain Dota screenshot alone", () => {
  const im = canvas(3000, 1000);
  fill(im, 2000, 0, 3000, 1000, 245);
  fill(im, 2100, 100, 2600, 120, 30); // its text
  const r = trimBright(im);
  assert.ok(r && r.x0 === 0 && r.x1 <= 2000 && r.x1 >= 1950, JSON.stringify(r));
  const plain = canvas(2000, 850);
  drawCards(plain, 140, 180);
  fill(plain, 700, 400, 760, 460, 250); // a bright bit of hero art
  assert.equal(trimBright(plain), null);
});

test("cropImage copies the right pixels and clamps to the image", () => {
  const im = canvas(10, 10, 0);
  fill(im, 2, 3, 4, 5, 200);
  const c = cropImage(im, { x0: 2, y0: 3, x1: 20, y1: 5 });
  assert.equal(c.width, 8);
  assert.equal(c.height, 2);
  assert.equal(c.gray[0], 200);
  assert.equal(c.gray[2], 0);
});
