// Wrapped's story player (pages/wrapped.js mountStory), the parts with no page code: how long a
// card stays up when the story plays by itself, the highlights cut of a player's story, where a
// story was left, and when to skip the moving renders.

// Auto-play: about 6 seconds a card, longer the more there is to read (words past the first 20,
// list rows and stat tiles past the first 3), never more than 15. A top play (a video clip) gets
// the most.
export const BASE_MS = 6000, MAX_MS = 15000;
export function slideMs(card) {
  if (!card) return BASE_MS;
  if (card.key === "clip") return MAX_MS;
  const html = `${card.kicker ?? ""} ${card.body ?? ""} ${card.views?.[0]?.body ?? ""}`;
  const words = html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
  const rows = (html.match(/<(dt|li)\b/g) ?? []).length;
  return Math.min(MAX_MS, Math.round(BASE_MS + Math.max(0, words - 20) * 150 + Math.max(0, rows - 3) * 400));
}

// Highlights only: a player's story cut to about 8 cards. Their opening (intro), best game,
// signature, MVPs, the awards they won, then the summary (the ending card goes after it, as in the
// full story). Each key once (the across-AD2L part repeats some); awards fill what's left of max.
export const HIGHLIGHT_KEYS = ["intro", "best", "signature", "mvps"];
export function highlightCards(cards, max = 8) {
  const first = (k) => cards.find((c) => c.key === k);
  const head = HIGHLIGHT_KEYS.map(first).filter(Boolean);
  const summary = first("summary");
  // The ending is added by the story itself, so it takes a place here too.
  const room = Math.max(0, max - head.length - (summary ? 1 : 0) - 1);
  const seen = new Set(), awards = [];
  for (const c of cards) if (c.key.startsWith("award:") && !seen.has(c.key) && awards.length < room) { seen.add(c.key); awards.push(c); }
  return [...head, ...awards, ...(summary ? [summary] : [])];
}

// Where a story was left: one saved card per story, keyed on its address (path, and the
// highlights cut apart from the full story, since their cards differ).
export const resumeKey = (path, short = false) => `wr-resume:${String(path).replace(/\/+$/, "") || "/"}${short ? "?short" : ""}`;
// The card to offer "Continue from" on (0-based), or null: past the first card and before the
// last (a finished story starts over), and still inside the story (it may have fewer cards now).
export function resumeAt(saved, total) {
  const i = Number(saved);
  return Number.isInteger(i) && i > 0 && i < total - 1 ? i : null;
}

// Data saver: the still render, not the moving one, when the browser asks to save data or the
// connection is 2G or 3G. conn: navigator.connection (missing in Safari and Firefox).
export const lowData = (conn) => !!conn && (!!conn.saveData || /^(slow-2g|2g|3g)$/.test(conn.effectiveType ?? ""));
