// Card bonuses (spec section 2). A bonus is "+X% points from stat S", sized so every stat has the
// same ceiling at a rarity: X% = budget / WEIGHTS[pos][stat]. Budgets are stat points; placeholders
// until scripts/calibrate-card-bonus.js is reviewed.
import { WEIGHTS, METRICS } from "./tiers.js";

// Each card has 1 main and 3 subs; a sub is worth half the main at every rarity.
const MAINS = { common: 1, rare: 1.5, epic: 2, legendary: 3, arcana: 4.5 };
export const SUB_COUNT = 3;
export const BUDGETS = Object.fromEntries(Object.entries(MAINS).map(([r, main]) => [r, { main, sub: main / 2 }]));
export const statsFor = (pos) => Object.keys(WEIGHTS[pos]);
export const bonusPct = (pos, stat, rarity, kind) => Math.round((BUDGETS[rarity][kind] / WEIGHTS[pos][stat]) * 1000) / 10;
// "7.1" or "15": one decimal only when needed.
export const pctText = (pct) => String(Math.round(pct * 10) / 10);
// Plain text for a main-stat bonus ("+11% GPM"); never NaN when the stat isn't on the position's list.
// Callers escape it where it goes into innerHTML.
export function bonusText(pos, stat, rarity) {
  const name = METRICS[stat]?.label ?? stat;
  return statsFor(pos).includes(stat) ? `+${pctText(bonusPct(pos, stat, rarity, "main"))}% ${name}` : `${name} (not on your position's list)`;
}
const bonus = (pos, stat, rarity, kind) => ({ stat, pct: bonusPct(pos, stat, rarity, kind) });

// n distinct stats from the position's list, none the main stat (fewer if the list is short).
export function rollSubs(pos, mainStat, rarity, random = Math.random, n = SUB_COUNT) {
  const pool = statsFor(pos).filter((s) => s !== mainStat), out = [];
  while (out.length < n && pool.length) {
    out.push(bonus(pos, pool.splice(Math.min(pool.length - 1, Math.floor(random() * pool.length)), 1)[0], rarity, "sub"));
  }
  return out;
}
// scores: { stat: season 0-100 at their main position }.
export function defaultMain(pos, scores, rarity, random = Math.random) {
  const best = statsFor(pos).filter((s) => scores[s] != null).sort((a, b) => scores[b] - scores[a]).slice(0, 3);
  const pool = best.length ? best : statsFor(pos).slice(0, 3);
  return bonus(pos, pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))], rarity, "main");
}
export function mainFor(pos, stat, rarity) {
  if (!statsFor(pos).includes(stat)) throw new Error("Choose a stat from that position's list.");
  return bonus(pos, stat, rarity, "main");
}
// Extra points in one game: each bonus stat's points at the slot's position x its pct, then the
// game's multipliers, the same as base stat points. `g` is gamePointsAt's result.
export function bonusPoints(g, card) {
  const m = g.mult ?? {}, k = (m.survival ?? 1) * (m.consistency ?? 1) * (m.opponents ?? 1) * (m.winning ?? 1);
  const raw = [card.main, ...(card.subs ?? []), card.sub].filter(Boolean).reduce((t, b) => t + (g.stats.find((s) => s.metric === b.stat)?.points ?? 0) * (b.pct / 100), 0);
  return Math.round(raw * k * 10) / 10;
}
