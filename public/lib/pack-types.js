// Themed packs: three cards of one kind, at or above a rarity. A pack in a player's `packs` list is
// "<rarity>" (a normal card pack of that rarity or better), "screens" (loading screens) or
// "<rarity>:<kind>" for a themed pack. Kinds and the card item types each draws from: signature
// packs hold signatures and their modifiers. Player card packs come later.
import { TIERS, CATALOG, PACK_ODDS } from './cosmetics-catalog.js';

export const PACK_KIND_TYPES = { border: ['border'], finish: ['finish'], signature: ['autograph', 'translation'] };
export const KIND_NAMES = { border: 'border', finish: 'finish', signature: 'signature', player: 'player card' };
export const THEMED_PACKS = TIERS.flatMap((t) => Object.keys(PACK_KIND_TYPES).map((k) => `${t}:${k}`));

export const isThemedPack = (pack) => THEMED_PACKS.includes(pack);
export function parsePack(pack) {
  const [tier, kind] = String(pack).split(':');
  return { tier: TIERS.includes(tier) ? tier : null, kind: kind ?? null };
}
const cap = (w) => w[0].toUpperCase() + w.slice(1);
// "Common border pack", "Epic signature pack"; a normal pack stays "Common pack".
export const themedLabel = (pack) => {
  const { tier, kind } = parsePack(pack);
  return `${cap(tier ?? 'common')} ${KIND_NAMES[kind] ?? kind} pack`;
};

// The chance each rarity comes up per item in a pack (fractions): the pack's rarity or better,
// weighted by PACK_ODDS. For a themed pack, a roll on a rarity the kind has no items in moves up to
// the next one it has. The engine rolls the same way.
export function packOdds(pack) {
  const { tier, kind } = parsePack(pack), types = kind ? PACK_KIND_TYPES[kind] : null;
  const groups = TIERS.slice(TIERS.indexOf(tier)).map((r) => ({ r, w: PACK_ODDS[r], n: CATALOG.filter((i) => (!types || types.includes(i.type)) && i.rarity === r).length }));
  const total = groups.reduce((s, g) => s + g.w, 0), out = Object.fromEntries(TIERS.map((t) => [t, 0]));
  groups.forEach((g, i) => { out[(types ? groups.slice(i).find((x) => x.n) ?? groups.findLast((x) => x.n) : g).r] += g.w / total; });
  return out;
}
const pct = (x) => `${Math.round(x * 1000) / 10}%`;
// "Rare 54.8% · Epic 32.3% · Legendary 12.9%": the rarities that can come up.
export const oddsText = (pack) => Object.entries(packOdds(pack)).filter(([, v]) => v > 0).map(([t, v]) => `${cap(t)} ${pct(v)}`).join(' · ');
// What a pack holds, for the odds table: [pack, name, what's in it].
export const ODDS_ROWS = ['common', 'rare', 'epic', 'legendary'].flatMap((t) => [[t, `${cap(t)} pack`, '3 cards + 2 screens'], ...Object.keys(PACK_KIND_TYPES).map((k) => [`${t}:${k}`, themedLabel(`${t}:${k}`), k === 'border' ? `3 border items + ${PACK_ODDS.legendary}% legendary background` : `3 ${k} items`])]);

// A pack in a player's list, by name: "Normal pack", "Rare pack", "Epic border pack", "Loading screen pack".
export const packName = (pack) => pack === 'screens' ? 'Loading screen pack' : pack === 'common' ? 'Normal pack' : isThemedPack(pack) ? themedLabel(pack) : `${cap(String(pack))} pack`;
