// The card finish, border, arcana and editor styles: about 150 KB of CSS that only cards use. They load
// with lib/cosmetics.js (which every card-drawing page imports) instead of blocking every page's first
// paint from index.html. cosmetics.js awaits this before it finishes loading, so a card never draws unstyled.
// Each sheet goes in before mobile.css, in index.html's old order, so the cascade is unchanged.
export const CARD_SHEETS = [
  "cosmetics-effects.css", "cosmetics-fx.css", "cosmetics-expansion.css", "cosmetics-expansion-upgrades.css",
  "cosmetics-wave.css", "cosmetics-wave2.css", "card-arcana.css", "cosmetics-wave3.css", "card-editor-ui.css",
];

let ready = null;
export function loadCardStyles() {
  if (typeof document === "undefined") return Promise.resolve(); // tests run in Node
  return (ready ??= Promise.all(CARD_SHEETS.map((name) => {
    const href = new URL(`../${name}`, import.meta.url).href;
    const have = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => l.href === href);
    if (have) return have.sheet ? null : new Promise((done) => { have.addEventListener("load", done, { once: true }); have.addEventListener("error", done, { once: true }); });
    const link = Object.assign(document.createElement("link"), { rel: "stylesheet", href });
    const done = new Promise((ok) => { link.onload = ok; link.onerror = ok; }); // a failed sheet still lets cards draw
    const before = document.querySelector('link[href$="mobile.css"]');
    before ? before.before(link) : document.head.append(link);
    return done;
  })));
}
