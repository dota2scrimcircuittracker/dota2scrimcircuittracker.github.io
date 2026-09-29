// Version 2 of finding the game in a screenshot, for when the usual reading (version 1:
// overview.js / scoreboard.js on the whole image) fails or reads too little. That happens
// with wider captures: the whole monitor, a second window beside the game, the Dota menu
// bar above. Version 2 finds the panel, crops to the framing version 1 was tuned on, and
// hands the crop to version 1 unchanged.
import { columnProfile, rowProfile, runs } from "./core.js";

// A crop of a grayscale image (same shape as loadImage's).
export function cropImage(image, r) {
  const x0 = Math.max(0, Math.round(r.x0)), y0 = Math.max(0, Math.round(r.y0));
  const x1 = Math.min(image.width, Math.round(r.x1)), y1 = Math.min(image.height, Math.round(r.y1));
  const width = x1 - x0, height = y1 - y0;
  const gray = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) gray.set(image.gray.subarray((y0 + y) * image.width + x0, (y0 + y) * image.width + x1), y * width);
  return { gray, width, height };
}

// Longest stretch of `keep` that's true, as [start, end).
function longestRun(keep) {
  let best = [0, 0], start = -1;
  for (let i = 0; i <= keep.length; i++) {
    if (i < keep.length && keep[i]) { if (start < 0) start = i; }
    else if (start >= 0) { if (i - start > best[1] - best[0]) best = [start, i]; start = -1; }
  }
  return best;
}

// Dota's post-game screens are dark; a light window (browser, Discord, Explorer) beside or
// above the game is mostly bright. Cut the image down to the biggest stretch of columns,
// then rows, that aren't mostly bright tiles. Hero art can light up a tile or two, never
// most of a column. Null when there's nothing to cut.
export function trimBright(image, { tileFrac = 1 / 40, bright = 150, share = 0.5 } = {}) {
  const { width: W, height: H, gray } = image;
  const t = Math.max(8, Math.round(Math.min(W, H) * tileFrac));
  const cols = Math.ceil(W / t), rows = Math.ceil(H / t);
  const lit = new Uint8Array(cols * rows);
  for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
    let s = 0, n = 0;
    for (let y = ty * t; y < Math.min(H, (ty + 1) * t); y += 2) for (let x = tx * t; x < Math.min(W, (tx + 1) * t); x += 2) { s += gray[y * W + x]; n++; }
    lit[ty * cols + tx] = s / n > bright ? 1 : 0;
  }
  const colKeep = Array.from({ length: cols }, (_, tx) => { let n = 0; for (let ty = 0; ty < rows; ty++) n += lit[ty * cols + tx]; return n / rows < share; });
  const [c0, c1] = longestRun(colKeep);
  const rowKeep = Array.from({ length: rows }, (_, ty) => { let n = 0; for (let tx = c0; tx < c1; tx++) n += lit[ty * cols + tx]; return n / Math.max(1, c1 - c0) < share; });
  const [r0, r1] = longestRun(rowKeep);
  if (c0 === 0 && c1 === cols && r0 === 0 && r1 === rows) return null;
  if (c1 - c0 < 8 || r1 - r0 < 6) return null; // nothing Dota-sized left
  return { x0: c0 * t, y0: r0 * t, x1: Math.min(W, c1 * t), y1: Math.min(H, r1 * t) };
}

// Overview hero cards: ten equal columns, 155 wide and 16 apart at the reference size, with a
// 76 gap between the teams (card pitch 170.75, as overview.js). Search bands at every height
// and several brightness cut-offs for ten runs with that shape; the most regular set wins.
const REF_PITCH = 170.75;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
function cardFit(rs) {
  const widths = rs.map(([a, b]) => b - a), mw = median(widths);
  if (widths.some((w) => Math.abs(w - mw) > 0.2 * mw)) return null;
  const gaps = rs.slice(1).map(([a], i) => a - rs[i][1]);
  const inner = gaps.filter((_, i) => i !== 4), mg = median(inner);
  if (mg < 0 || mg > 0.35 * mw || inner.some((g) => Math.abs(g - mg) > Math.max(4, 0.08 * mw))) return null;
  const extra = gaps[4] - mg; // the gap between the teams, beyond a normal gap
  if (extra < 0.2 * mw || extra > 0.7 * mw) return null;
  const pa = (rs[4][0] - rs[0][0]) / 4, pb = (rs[9][0] - rs[5][0]) / 4;
  if (Math.abs(pa - pb) > 0.03 * pa) return null;
  const err = widths.reduce((s, w) => s + Math.abs(w - mw), 0) / mw + inner.reduce((s, g) => s + Math.abs(g - mg), 0) / mw + Math.abs(pa - pb) / pa;
  return { err, pitch: (pa + pb) / 2 };
}

export function locateCards(image) {
  const { width: W, height: H } = image;
  let best = null;
  for (const bandFrac of [0.2, 0.3]) {
    const bh = Math.round(H * bandFrac), step = Math.max(4, Math.round(H * 0.04));
    for (let y0 = 0; y0 + bh <= H; y0 += step) {
      const prof = columnProfile(image, y0, y0 + bh);
      for (const thr of [20, 28, 35, 45, 55, 70]) {
        const rs = runs(prof, thr, Math.max(6, Math.round(W * 0.012)));
        for (let i = 0; i + 10 <= rs.length; i++) {
          const fit = cardFit(rs.slice(i, i + 10));
          if (fit && (!best || fit.err < best.err)) best = { ...fit, cards: rs.slice(i, i + 10), band: [y0, y0 + bh] };
        }
      }
    }
  }
  if (!best) return null;
  const { cards, pitch, band } = best;
  const k = pitch / REF_PITCH;
  // Card top: walk up from the band while the cards stay brighter than the gaps between
  // them. (Plain brightness would run on into a menu bar above; the title and score above
  // the cards span the gaps too, so the contrast drops to nothing there.)
  const sum = (xs) => xs.reduce((s, x) => s + x, 0);
  const cardRows = cards.map(([a, b]) => rowProfile(image, a, b));
  const gapRows = cards.slice(1).map(([a], i) => rowProfile(image, cards[i][1], a)).filter((_, i) => cards[i + 1][0] - cards[i][1] >= 2);
  const contrast = (y) => sum(cardRows.map((r) => r[y])) / cardRows.length - (gapRows.length ? sum(gapRows.map((r) => r[y])) / gapRows.length : 0);
  const smooth = (y) => { let s = 0, n = 0; for (let d = -2; d <= 2; d++) if (y + d >= 0 && y + d < H) { s += contrast(y + d); n++; } return s / n; };
  // The band can hang over the cards' edge: start from its strongest row.
  let top = band[0];
  const inBand = [];
  for (let y = band[0]; y < band[1]; y += 2) { inBand.push(contrast(y)); if (contrast(y) > contrast(top)) top = y; }
  const base = [...inBand].sort((a, b) => a - b)[Math.floor(inBand.length * 0.75)];
  while (top > 0 && smooth(top - 1) > 0.25 * base) top--;
  // The framing of the reference screenshots: title and score above the cards, a margin
  // either side, room below for net worth and K/D/A.
  return { k, top, rect: { x0: cards[0][0] - 70 * k, y0: top - 175 * k, x1: cards[9][1] + 70 * k, y1: top + 650 * k } };
}
