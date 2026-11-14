// Player cards: which of a player's nominated designs is their common, rare, epic and legendary
// card (docs/superpowers/specs/2026-11-13-player-packs-design.md section 1.1).
// Community votes set each design's wanted rarity. Designs whose wanted rarity is uncontested take
// it. Each contest's extra designs then take the nearest open slot below, else above, placed lowest
// wanted rarity first so the voted order holds even when two contests are tied. Finally, inside
// each contest the slots it ended up with are handed out in the owner's order (their own rating,
// then community score, then the older design), so the owner's favourite always sits highest.
// Common left empty -> the player's default card.
import { tally, RATINGS } from "./card-ratings.js";
import { mainAccount } from "./stats.js";

const idx = (r) => RATINGS.indexOf(r);
const score = (votes) => {
  const { counts, total } = tally(votes);
  return total ? RATINGS.reduce((s, r, i) => s + counts[r] * (i + 1), 0) / total : 0;
};

// designs: [{ slot, votes, self, savedAt }] -> { common, rare, epic, legendary }: a slot number,
// "default" (common only) or null.
export function assignSlots(designs) {
  const rows = designs.map((x) => {
    const selfIdx = x.self ? idx(x.self) : -1; // an unknown rating counts as none
    const self = selfIdx >= 0 ? x.self : null;
    return { ...x, want: idx(tally(x.votes).pick ?? self ?? "common"), selfIdx, score: score(x.votes) };
  });
  rows.sort((a, b) => b.want - a.want || b.selfIdx - a.selfIdx || b.score - a.score || a.savedAt - b.savedAt);
  const seat = Array(RATINGS.length).fill(null), contests = new Map(), losers = [];
  for (const r of rows) {
    if (seat[r.want] == null) { seat[r.want] = r.slot; contests.set(r.want, [r]); } else losers.push(r);
  }
  // Lowest wanted rarity first (stable, so the owner's order holds inside a contest): a higher
  // contest's loser must not take a slot that a lower contest's loser needs to move up into.
  losers.sort((a, b) => a.want - b.want);
  for (const r of losers) {
    let at = -1;
    for (let i = r.want - 1; i >= 0 && at < 0; i--) if (seat[i] == null) at = i;
    for (let i = r.want + 1; i < seat.length && at < 0; i++) if (seat[i] == null) at = i;
    if (at >= 0) { seat[at] = r.slot; contests.get(r.want).push(r); }
  }
  // Inside each contest: the owner's order gets the contest's slots highest first. `contests`
  // lists rows in the owner's order already (the sort above).
  for (const group of contests.values()) {
    if (group.length < 2) continue;
    const slots = group.map((r) => seat.indexOf(r.slot)).sort((a, b) => b - a);
    group.forEach((r, i) => { seat[slots[i]] = r.slot; });
  }
  if (seat[0] == null) seat[0] = "default";
  return Object.fromEntries(RATINGS.map((r, i) => [r, seat[i]]));
}

// Map of account -> the position (1-5) they played most in these games, stand-ins skipped.
export function mainPositions(games) {
  const counts = new Map();
  for (const g of games) for (const p of g.players ?? []) {
    if (p.standin || p.account_id == null || !p.position) continue;
    const a = mainAccount(p), c = counts.get(a) ?? counts.set(a, {}).get(a);
    c[p.position] = (c[p.position] ?? 0) + 1;
  }
  return new Map([...counts].map(([a, c]) => [a, +Object.entries(c).sort((x, y) => y[1] - x[1] || x[0] - y[0])[0][0]]));
}

// The public /player-cards GET gives vote counts, not who voted what. Rebuild a stand-in votes
// object (one made-up voter per vote) so assignSlots can preview the same rarities.
export function votesFromCounts(counts) {
  const votes = {};
  for (const [r, n] of Object.entries(counts ?? {})) for (let i = 0; i < n; i++) votes[`${r}${i}`] = r;
  return votes;
}
