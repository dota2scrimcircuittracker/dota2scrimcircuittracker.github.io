// Player card packs for Fantasy: the bare bones, not wired to the site or the collection Worker yet.
// A pack pulls three league players' cards. A card's rarity comes from the player's tier, and
// rarities roll with the cosmetics packs' odds (cosmetics-catalog.js PACK_ODDS), skipping any
// rarity no player has. Pulled cards count in the inventory as player:<account>.
// Still to decide before it goes live: which league's pool a pack draws from, whether the
// community's card ratings (card-ratings.js) should feed rarity, and what pulled cards unlock.
import { TIERS, PACK_ODDS } from './cosmetics-catalog.js';

export const TIER_RARITY = { S: 'legendary', A: 'epic', B: 'rare', C: 'common', D: 'common' };

// The pool: one entry per tiered player.
export function playerCardPool(tiers) {
  return [...tiers].filter(([, t]) => TIER_RARITY[t?.tier]).map(([account, t]) => ({ account: String(account), rarity: TIER_RARITY[t.tier] }));
}

export function rollPlayerPack(pool, random = Math.random) {
  const groups = TIERS.map((rarity) => ({ rarity, weight: PACK_ODDS[rarity], cards: pool.filter((c) => c.rarity === rarity) })).filter((g) => g.cards.length);
  if (!groups.length) throw new Error('No player cards to pull yet.');
  const total = groups.reduce((s, g) => s + g.weight, 0), pulls = [];
  for (let n = 0; n < 3; n++) {
    let r = random() * total, group = groups.at(-1);
    for (const g of groups) { r -= g.weight; if (r < 0) { group = g; break; } }
    const card = group.cards[Math.min(group.cards.length - 1, Math.floor(random() * group.cards.length))];
    pulls.push({ key: `player:${card.account}`, account: card.account, rarity: card.rarity });
  }
  return pulls;
}

export function addPlayerCards(state, pulls) {
  const inventory = { ...(state.inventory ?? {}) };
  const rewards = pulls.map((p) => { const duplicate = (inventory[p.key] ?? 0) > 0; inventory[p.key] = (inventory[p.key] ?? 0) + 1; return { ...p, duplicate }; });
  return { state: { ...state, inventory }, rewards };
}

// Winter player packs (docs/superpowers/specs/2026-11-13-player-packs-design.md section 3): their
// own odds per card, apart from cosmetics packs' PACK_ODDS.
export const PLAYER_PACK_ODDS = { common: 68, rare: 17, epic: 10, legendary: 4, arcana: 1 };

// Odds per position, given which rarities each position has cards at ({ 1: ['common', ...], ... }).
// A rarity some positions lack is scaled up at the positions that have it, so the overall rate per
// card stays at PLAYER_PACK_ODDS (pos 5 with no legendary: pos 1-4 roll legendary at 5%). Common
// takes whatever is left, so each position sums to 100.
export function positionOdds(has, base = PLAYER_PACK_ODDS) {
  const positions = Object.keys(has);
  const out = Object.fromEntries(positions.map((p) => [p, { common: 0 }]));
  for (const [r, w] of Object.entries(base)) {
    if (r === 'common') continue;
    const with_ = positions.filter((p) => has[p].includes(r));
    for (const p of positions) out[p][r] = with_.includes(p) ? (w * positions.length) / with_.length : 0;
  }
  for (const p of positions) out[p].common = 100 - Object.entries(out[p]).reduce((s, [r, w]) => s + (r === 'common' ? 0 : w), 0);
  return out;
}
