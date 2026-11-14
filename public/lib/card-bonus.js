// Card bonuses (spec section 2). A bonus is "+X% points from stat S", sized so every stat has the
// same ceiling at a rarity: X% = budget / WEIGHTS[pos][stat]. Budgets are stat points; placeholders
// until scripts/calibrate-card-bonus.js is reviewed.
import { WEIGHTS } from "./tiers.js";

export const BUDGETS = {
  common: { main: 1, sub: 0.4 }, rare: { main: 1.5, sub: 0.6 }, epic: { main: 2, sub: 0.8 },
  legendary: { main: 3, sub: 1.2 }, arcana: { main: 4.5, sub: 1.8 },
};
export const statsFor = (pos) => Object.keys(WEIGHTS[pos]);
export const bonusPct = (pos, stat, rarity, kind) => Math.round((BUDGETS[rarity][kind] / WEIGHTS[pos][stat]) * 100);
const bonus = (pos, stat, rarity, kind) => ({ stat, pct: bonusPct(pos, stat, rarity, kind) });

export function rollSub(pos, mainStat, rarity, random = Math.random) {
  const pool = statsFor(pos).filter((s) => s !== mainStat);
  return bonus(pos, pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))], rarity, "sub");
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
  const raw = [card.main, card.sub].filter(Boolean).reduce((t, b) => t + (g.stats.find((s) => s.metric === b.stat)?.points ?? 0) * (b.pct / 100), 0);
  return Math.round(raw * k * 10) / 10;
}
