// A player card's fantasy back: what each bonus on the card multiplies, from the player's own games.
// Pure (no DOM, no fetch). The mock pack opener (public/_dev/player-packs.js) uses it; the real
// cards will too.
//
// Numbers are stat points a game before the survival / consistency / opponents multipliers: a
// game's stat at `pos` earns score/100 x WEIGHTS[pos][stat] (lib/tiers.js gamePointsAt), and a
// +X% bonus adds X% of those points (lib/card-bonus.js bonusPoints).
import { tierModels, gamePointsAt, WEIGHTS, METRICS, LIVE } from "./tiers.js";

const round1 = (x) => Math.round(x * 10) / 10;
const label = (stat) => METRICS[stat]?.label ?? stat;

// Models made once per game list (the same list a division's Fantasy scores against).
const modelMemo = new WeakMap();
export function modelsFor(games) {
  if (!modelMemo.has(games)) modelMemo.set(games, tierModels(games, { version: LIVE }));
  return modelMemo.get(games);
}
// One division's games out of everything loaded (m.league tags them), memoized per list and league.
const divMemo = new WeakMap();
export function divisionGames(matches, league) {
  const all = divMemo.get(matches) ?? divMemo.set(matches, new Map()).get(matches);
  const k = league ?? "";
  if (!all.has(k)) all.set(k, matches.filter((m) => (m.league ?? "") === k));
  return all.get(k);
}

// A player's keys in the game data: their account and any player_key their rows carry (an alt
// account's rows carry the main's player_key).
function keysOf(account, games) {
  const a = String(account), keys = new Set();
  for (const m of games) for (const p of m.players ?? []) {
    if (String(p.account_id) === a || String(p.player_key) === a) keys.add(String(p.player_key ?? p.account_id));
  }
  return keys;
}

// Every stat at `pos`, averaged over the player's games read at `pos` (as Fantasy scores a pick in
// a slot, whatever they played). { account, pos, games, stats: { [stat]: { stat, label, max,
// avgPoints, avgScore, games } } }. A stat the player has no number for has nulls and games 0.
const profileMemo = new WeakMap();
export function playerStatProfile(account, pos, games, models = modelsFor(games)) {
  const memo = profileMemo.get(games) ?? profileMemo.set(games, new Map()).get(games);
  const id = `${account}:${pos}`;
  if (memo.has(id)) return memo.get(id);
  const keys = keysOf(account, games), sums = {};
  let n = 0;
  for (const m of games) {
    const p = (m.players ?? []).find((x) => keys.has(String(x.player_key ?? x.account_id)));
    if (!p) continue;
    const g = gamePointsAt(m, games, String(p.player_key ?? p.account_id), pos, models);
    if (!g) continue;
    n++;
    for (const s of g.stats) {
      if (!Number.isFinite(s.score) || !Number.isFinite(s.points)) continue;
      const t = (sums[s.metric] ??= { points: 0, score: 0, games: 0 });
      t.points += s.points; t.score += s.score; t.games++;
    }
  }
  const stats = Object.fromEntries(Object.entries(WEIGHTS[pos]).map(([stat, max]) => {
    const t = sums[stat];
    return [stat, { stat, label: label(stat), max, avgPoints: t ? t.points / t.games : null, avgScore: t ? t.score / t.games : null, games: t?.games ?? 0 }];
  }));
  const out = { account: Number(account), pos, games: n, stats };
  memo.set(id, out);
  return out;
}

// The card's main and subs, each with the potential its % multiplies:
// [{ kind, stat, label, pct, max, avg, gain, maxGain }]. avg/gain are null with no games.
export function cardBackRows(card, profile) {
  const pos = card.pos;
  const row = (kind, b) => {
    const max = WEIGHTS[pos]?.[b.stat] ?? null, avg = profile?.stats?.[b.stat]?.avgPoints ?? null;
    return {
      kind, stat: b.stat, label: label(b.stat), pct: b.pct, max,
      avg: avg == null ? null : round1(avg),
      gain: avg == null ? null : round1((avg * b.pct) / 100),
      maxGain: max == null ? null : round1((max * b.pct) / 100),
    };
  };
  return [card.main && row("main", card.main), ...(card.subs ?? []).map((b) => row("sub", b))].filter(Boolean);
}

// The player's n best stats at that position by average score: [{ stat, label, score, avg, max }].
// Empty with no games.
export function topStats(profile, n = 3) {
  return Object.values(profile?.stats ?? {})
    .filter((s) => s.avgScore != null)
    .sort((a, b) => b.avgScore - a.avgScore || b.max - a.max)
    .slice(0, n)
    .map((s) => ({ stat: s.stat, label: s.label, score: Math.round(s.avgScore), avg: round1(s.avgPoints), max: s.max }));
}
