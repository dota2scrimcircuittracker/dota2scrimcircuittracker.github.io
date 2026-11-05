// How living borders and Twin Cards draw (items in lib/cosmetics-arcana-catalog.js, styles in
// card-arcana.css). Both are plain markup with CSS animation: no timers, so they cost nothing off screen.
import { itemByKey } from './cosmetics-catalog.js';
import { TWIN_TURNS } from './cosmetics-arcana-catalog.js';

// A living border's layer, inside the card's .ft-flip over the frame. It takes the border's colours
// from the card (--a, --b). Rising Embers needs its sparks and Rune Trace its line; the rest are one ring.
const sparks = Array.from({ length: 22 }, (_, k) => {
  const side = k % 3, pos = (k * 37) % 100;
  return `<i style="--x:${side === 0 ? pos : side === 1 ? 2 : 98}%;--y:${side === 0 ? 100 : (k * 53) % 100}%;--d:${((k * 0.37) % 3).toFixed(2)}s;--s:${(0.7 + (k % 4) * 0.2).toFixed(1)}"></i>`;
}).join('');
const trace = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="1.5" y="1.2" width="97" height="97.6" rx="4" ry="3" pathLength="100"/></svg>';
export function livingBorderHtml(e) {
  const id = e?.living;
  if (!id || !itemByKey(`living:${id}`)) return '';
  return `<span class="living-fx living-${id}" data-living-id="${id}" aria-hidden="true">${id === 'embers' ? sparks : id === 'trace' ? trace : ''}</span>`;
}

// The Twin Card a design carries ({turn, design}), or null. The design is the card's back, built in the
// editor and checked by lib/cosmetics-engine.js saveCardDesign.
export const twinOf = (e) => (e?.twin?.design && TWIN_TURNS.includes(e.twin.turn) ? e.twin : null);
// Both cards stacked in one cell; card-arcana.css turns between them. The second is a full card of its
// own, hidden from screen readers so each player is read once.
export const twinHtml = (front, back, turn) => `<div class="ft-twin" data-twin="${turn}">${front}${back.replace('<div class="ft-card', '<div aria-hidden="true" class="ft-card ft-twin-b')}</div>`;

// The picture for a tool in the Collection and the Shop: two layered finishes, or two cards.
export const toolArtHtml = (item) => item?.turn
  ? `<span class="tool-art tool-twin tool-twin-${item.turn}" aria-hidden="true"><i></i><i></i></span>`
  : '<span class="tool-art tool-double" aria-hidden="true"><i></i><i></i><b></b></span>';
