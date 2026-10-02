// The Captains Mode draft model: a win chance at every pick and ban, with each picked hero
// read as the player who is going to play it. Ported from Project Sybil (ybabts, with Fav):
// packages/sybil/{cmDraft,cmPlayers,leagueReading,math}.ts. The weights, pool parameters and
// hero-by-position shares are Sybil's fit (lib/sybil-fitted.js, regenerate with
// scripts/gen/gen-sybil-fitted.js); the measurements behind every constant are in Sybil's
// docs/captains-mode-draft-model.md. Held out on patch 7.41 it called 64% of games (AUC 0.70).
//
// Three layers:
//  1. Who plays what. A player's pool (recency-weighted heroes and positions) gives a
//     propensity for every hero. A side's picks are shared among its five players over every
//     way to give each hero to a different player (at most 120), so a later pick corrects an
//     earlier guess.
//  2. The draft as it stands. Each player's comfort on their hero (their record shrunk toward
//     the hero's win rate at the game's bracket), the rest at their usual value; how much of
//     it is borrowed from the hero's baseline; the rank lead; the team rating.
//  3. A logistic model over those columns, fitted on every draft state of 10,461 AD2L games.
//
// Two inputs Sybil has and we don't: the counter/synergy tables (no draft term without them,
// as Sybil does for a patch with no table) and the team rating (0, as Sybil's own sandbox
// reads it for typed-in rosters). Everything here is pure: no I/O, no clock.

import FITTED from "./sybil-fitted.js";

export const POSITIONS = 5;
const DAY = 86400;
export const WEIGHTS = FITTED.weights;
export const POOL = FITTED.pool; // { halfLifeDays: 30, leagueWeight: 10, rolePriorGames: 30 }
export const ROLES = new Map(Object.entries(FITTED.roles.shares).map(([id, s]) => [Number(id), s]));
export const FIT = FITTED.provenance;

// Records: shrunk by 10 pseudo-games, half-life 90 days, rows under 5% weight dropped, read
// once they hold half an effective game (Sybil's site constants).
export const RECORD = { k: 10, halfLifeDays: 90, epsilon: 0.05, minEffectiveGames: 0.5 };
const POOL_HALF_LIVES = 8; // pool rows older than 8 half-lives weigh under 0.4%
const NEUTRAL_HEROES = 10;
const POSITION_PRIOR_GAMES = 2;
const PROPENSITY_FLOOR = 1e-6;
const ASSUMED = 0.5;
const MEDAL = 5;
const MIN_BRACKET_PICKS = 500;
export const LOBBY_RANK = { maxGames: 20, maxDays: 180, minGames: 3 };
const LEAGUE_LOBBIES = new Set([1, 2]), PUB_LOBBIES = new Set([0, 7]);

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const logistic = (x, mid, k) => 1 / (1 + Math.exp(-(x - mid) / k));

// OpenDota rank tier (11 = Herald 1 … 75 = Divine 5, 80 = Immortal) as steps 1–36.
export function rankValue(tier) {
  if (tier == null || !Number.isFinite(tier)) return null;
  const medal = Math.floor(tier / 10), stars = tier % 10;
  if (medal < 1 || medal > 8) return null;
  if (medal === 8) return 36;
  return (medal - 1) * 5 + clamp(stars, 1, 5);
}

// ---------- records ----------

const timeWeight = (start, halfLifeDays, epsilon, now) => {
  const w = Math.exp(-(Math.LN2 / halfLifeDays) * ((now - start) / DAY)) - epsilon;
  return w > 0 ? w : 0;
};

// Recency-weighted win rate shrunk toward `prior` by `k` pseudo-games; n = effective games.
export function adjustedWinRate(games, prior, { k, halfLifeDays, epsilon }, now) {
  let W = 0, N = 0;
  for (const g of games) {
    const w = timeWeight(g.t, halfLifeDays, epsilon, now);
    if (!w) continue;
    W += w * g.win;
    N += w;
  }
  return { p: (prior * k + W) / (k + N), n: N };
}

// ---------- positions from one history row ----------

const CORE_LANES = [0.34, 0.33, 0.3, 0.03], SUPPORT_LANES = [0.5, 0.05, 0.4, 0.05];

// How likely a row was a support, from farm: last hits per minute (logistic at 3.4) and GPM
// (at 430), blended in log-odds 0.75/0.25, plus a bump above 60 healing a minute.
export function rowSupportness({ lastHits, durationSec, gpm, healing }) {
  if (lastHits == null || !durationSec) return 0.4;
  const minutes = Math.max(durationSec / 60, 1);
  const fromFarm = 1 - logistic(lastHits / minutes, 3.4, 0.9);
  const fromGold = gpm == null ? fromFarm : 1 - logistic(gpm, 430, 80);
  const l = (x) => { const p = clamp(x, 0, 1) * 0.998 + 0.001; return Math.log(p / (1 - p)); };
  let z = 0.75 * l(fromFarm) + 0.25 * l(fromGold);
  if (healing != null && healing / minutes > 60) z += 0.6;
  return 1 / (1 + Math.exp(-z));
}

// The row's position as shares of positions 1–5, from lane (1 safe, 2 mid, 3 off, 4 jungle;
// null unparsed) and farm.
export function rowPositions(e) {
  const s = rowSupportness(e);
  const lane = e.laneRole >= 1 && e.laneRole <= 4
    ? [0, 0, 0, 0].map((_, i) => (i === e.laneRole - 1 ? 1 : 0))
    : CORE_LANES.map((c, i) => c * (1 - s) + SUPPORT_LANES[i] * s);
  const d = [0, 0, 0, 0, 0];
  d[0] += lane[0] * (1 - s); d[4] += lane[0] * s;
  d[1] += lane[1] * (1 - s * 0.6); d[3] += lane[1] * s * 0.6;
  d[2] += lane[2] * (1 - s); d[3] += lane[2] * s;
  d[3] += lane[3] * s; d[0] += lane[3] * (1 - s) * 0.5; d[2] += lane[3] * (1 - s) * 0.5;
  const total = d.reduce((a, b) => a + b, 0);
  return d.map((x) => x / total);
}

// ---------- a player's history ----------

// The draft file's rows, flat groups of HISTORY_FIELDS (scripts/sync/ad2l-sync.js writes them):
// start time, hero id, won (1/0), lobby type, duration, last hits, GPM, healing (−1 unknown),
// lane role (0 unparsed), lobby average rank (0 unknown).
export const HISTORY_FIELDS = 10;

// Rows that started strictly before `now`, oldest first, with each hero's games and the pub
// lobbies' ranks: built once per player per game.
export function indexHistory(flat, now) {
  const rows = [];
  for (let i = 0; i + HISTORY_FIELDS - 1 < (flat?.length ?? 0); i += HISTORY_FIELDS) {
    const [t, hero, win, lobby, dur, lh, gpm, heal, lane, avgRank] = flat.slice(i, i + HISTORY_FIELDS);
    if (!(t < now) || !(hero > 0)) continue;
    rows.push({ t, hero, win, lobby, dur, lh, gpm, heal, lane, avgRank });
  }
  rows.sort((a, b) => a.t - b.t);
  const byHero = new Map(), lobbyTimes = [], lobbyRanks = [];
  for (const r of rows) {
    (byHero.get(r.hero) ?? byHero.set(r.hero, []).get(r.hero)).push(r);
    if (PUB_LOBBIES.has(r.lobby) && rankValue(r.avgRank) != null) { lobbyTimes.push(r.t); lobbyRanks.push(rankValue(r.avgRank)); }
  }
  return { rows, byHero, lobbyTimes, lobbyRanks };
}

const rowEvidence = (r) => ({
  laneRole: r.lane >= 1 ? r.lane : null,
  lastHits: r.lh >= 0 ? r.lh : null,
  durationSec: r.dur > 0 ? r.dur : null,
  gpm: r.gpm >= 0 ? r.gpm : null,
  healing: r.heal >= 0 ? r.heal : null,
});

// Weighted games per hero and per position over the last 8 half-lives; a league game counts
// `leagueWeight` pubs.
export function historyPool(index, now, params = POOL) {
  const heroes = new Map(), positions = [0, 0, 0, 0, 0];
  let total = 0;
  const oldest = now - POOL_HALF_LIVES * params.halfLifeDays * DAY, decay = Math.LN2 / params.halfLifeDays;
  for (let i = index.rows.length - 1; i >= 0; i--) {
    const r = index.rows[i];
    if (r.t < oldest) break;
    const w = Math.exp(-decay * Math.max(0, (now - r.t) / DAY)) * (LEAGUE_LOBBIES.has(r.lobby) ? params.leagueWeight : 1);
    if (!(w > 0)) continue;
    heroes.set(r.hero, (heroes.get(r.hero) ?? 0) + w);
    total += w;
    const pos = rowPositions(rowEvidence(r));
    for (let p = 0; p < POSITIONS; p++) positions[p] += w * pos[p];
  }
  return { heroes, total, positions };
}

// Median of the last 20 pub lobbies' average rank in the 180 days before `now` (3+ needed).
export function lobbyRank(index, now, o = LOBBY_RANK) {
  const values = [];
  for (let i = index.lobbyTimes.length - 1; i >= 0 && values.length < o.maxGames; i--) {
    if (index.lobbyTimes[i] < now - o.maxDays * DAY) break;
    values.push(index.lobbyRanks[i]);
  }
  if (values.length < o.minGames) return null;
  values.sort((a, b) => a - b);
  const mid = values.length >> 1;
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

const borrowedShare = (n, k = RECORD.k) => (n == null ? 1 : k / (k + n));

// A player's worth on a hero: their record shrunk toward the hero's baseline once it holds
// half an effective game, else the baseline, else a coin flip. `borrowed` is how much of it is
// the baseline's.
export function historyReading(index, hero, now, baseline, record = RECORD) {
  const games = index.byHero.get(hero);
  if (games?.length) {
    const self = adjustedWinRate(games, 0.5, record, now);
    if (self.n >= record.minEffectiveGames) {
      return { comfort: adjustedWinRate(games, baseline ?? 0.5, record, now).p, borrowed: borrowedShare(self.n, record.k), baseline: baseline ?? 0.5, games: self.n };
    }
  }
  return { comfort: baseline ?? ASSUMED, borrowed: 1, games: 0 };
}

// ---------- hero baselines ----------

// A hero's win rate at a bracket (1–8 or "all") from OpenDota heroStats picks/wins per bracket
// ([p1..p8, w1..w8]): the bracket alone with 500+ picks, else it and its neighbours, else all.
export function heroWinRate(stats, bracket = "all") {
  if (!stats) return null;
  const sum = (from, to) => { let picks = 0, wins = 0; for (let b = from; b <= to; b++) { picks += stats[b - 1] ?? 0; wins += stats[b + 7] ?? 0; } return { picks, wins }; };
  if (bracket !== "all") {
    const one = sum(bracket, bracket);
    if (one.picks >= MIN_BRACKET_PICKS) return one.wins / one.picks;
    const near = sum(Math.max(1, bracket - 1), Math.min(8, bracket + 1));
    if (near.picks >= MIN_BRACKET_PICKS) return near.wins / near.picks;
  }
  const all = sum(1, 8);
  return all.picks > 0 ? all.wins / all.picks : null;
}

// The bracket a game is read at: the medal of the mean known rank of its ten players.
export function bracketOf(ranks) {
  const known = ranks.filter((r) => r != null);
  if (!known.length) return "all";
  const mean = known.reduce((a, b) => a + b, 0) / known.length;
  return clamp(Math.round((mean - 1) / MEDAL + 1), 1, 8);
}

// ---------- who plays what ----------

export const poolShares = (pool) => {
  const total = pool.positions.reduce((a, b) => a + b, 0);
  return pool.positions.map((p) => (p + POSITION_PRIOR_GAMES / POSITIONS) / (total + POSITION_PRIOR_GAMES));
};

// P(this player plays this hero): their weighted games on it plus `rolePriorGames` of what
// their positions suggest, over their games plus the same.
export function heroPropensity(pool, hero, roles = ROLES, rolePriorGames = POOL.rolePriorGames) {
  const shares = roles.get(hero), mine = poolShares(pool);
  let prior = 0;
  if (shares) for (let i = 0; i < POSITIONS; i++) prior += mine[i] * shares[i];
  return Math.max(PROPENSITY_FLOOR, ((pool.heroes.get(hero) ?? 0) + rolePriorGames * prior) / (pool.total + rolePriorGames));
}

// P(player j plays picked hero h), exact over every way to give each hero a different player.
export function assignmentMarginals(weights) {
  const players = weights.length, heroes = players ? weights[0].length : 0;
  const out = weights.map(() => new Array(heroes).fill(0));
  if (!heroes) return out;
  const taken = new Array(players).fill(false), chosen = new Array(heroes).fill(-1);
  let z = 0;
  const walk = (h, product) => {
    if (h === heroes) { z += product; for (let k = 0; k < heroes; k++) out[chosen[k]][k] += product; return; }
    for (let j = 0; j < players; j++) {
      if (taken[j] || !(weights[j][h] > 0)) continue;
      taken[j] = true; chosen[h] = j;
      walk(h + 1, product * weights[j][h]);
      taken[j] = false;
    }
  };
  walk(0, 1);
  if (!(z > 0)) return weights.map(() => new Array(heroes).fill(1 / players));
  for (const row of out) for (let k = 0; k < heroes; k++) row[k] /= z;
  return out;
}

// ---------- players ----------

// A value averaged over the player's ten most played heroes, weighted by games.
const neutralOf = (pool, f, empty = ASSUMED) => {
  const top = [...pool.heroes].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, NEUTRAL_HEROES);
  const weight = top.reduce((s, [, w]) => s + w, 0);
  return weight > 0 ? top.reduce((s, [h, w]) => s + w * f(h), 0) / weight : empty;
};

// One player as the model reads them: propensity, comfort, borrowed and baseline per hero
// (memoised), and their usual values before a hero is known.
export function cmPlayer(pool, readingOf, roles = ROLES) {
  const readings = new Map(), props = new Map();
  const reading = (h) => readings.get(h) ?? readings.set(h, readingOf(h)).get(h);
  const comfort = (h) => reading(h).comfort, borrowed = (h) => reading(h).borrowed;
  const baseline = (h) => reading(h).baseline ?? reading(h).comfort;
  return {
    pool, reading,
    propensity: (h) => props.get(h) ?? props.set(h, heroPropensity(pool, h, roles)).get(h),
    comfort, borrowed, baseline,
    neutral: neutralOf(pool, comfort),
    neutralBorrowed: neutralOf(pool, borrowed, 1),
    neutralBaseline: neutralOf(pool, baseline),
  };
}

const EMPTY_POOL = () => ({ heroes: new Map(), total: 0, positions: [0, 0, 0, 0, 0] });

// A player from their stored history (flat rows, or none for an unknown account), read as of
// `now`. `fallbackRank` (a rank tier, e.g. the roster's PlayOn medal) stands in when their
// pubs don't give one.
export function playerFromHistory(flat, now, baselineOf, { fallbackRank = null } = {}) {
  const index = indexHistory(flat ?? [], now);
  const pool = index.rows.length ? historyPool(index, now) : EMPTY_POOL();
  const lobby = lobbyRank(index, now);
  return {
    index,
    games: index.rows.length,
    rank: lobby ?? rankValue(fallbackRank),
    rankFrom: lobby != null ? "pubs" : rankValue(fallbackRank) != null ? "medal" : null,
    make: (bracket) => ({ ...cmPlayer(pool, (h) => historyReading(index, h, now, baselineOf(h, bracket))), playedAt: playedAtRoles(index) }),
  };
}

// ---------- the draft as it stands ----------

const FLOOR = 0.3, CEILING = 0.7;
const logOdds = (p) => { const q = clamp(p, FLOOR, CEILING); return Math.log(q / (1 - q)); };
const lead = (radiant, dire) => {
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0.5);
  return logOdds(mean(radiant)) - logOdds(mean(dire));
};

// A pick pinned to a player (`pins[k]`, an index into the side's five; Sybil's "picking for") is
// theirs outright; the rest are shared over every matching as before.
const sideAssignment = (players, picks, pins) => assignmentMarginals(players.map((p, j) => picks.map((h, k) => (pins?.[k] != null ? (pins[k] === j ? 1 : 0) : p.propensity(h)))));

// Each player's expected value: their heroes by share, the rest at their usual value.
const expected = (players, picks, m, value, usual) => players.map((p, j) => {
  let given = 0, v = 0;
  picks.forEach((h, k) => { if (m[j][k] > 0) { given += m[j][k]; v += m[j][k] * value(p, h); } });
  return v + Math.max(0, 1 - given) * usual(p);
});

const sideUnfamiliar = (players, picks, m) => {
  let total = 0;
  players.forEach((p, j) => picks.forEach((h, k) => { if (m[j][k] > 0) total += m[j][k] * (p.borrowed(h) - p.neutralBorrowed); }));
  return total;
};

// ctx: { radiant: [5 players], dire: [5 players], rankLead (medals, Radiant − Dire), rating }
// state: { radiant: [hero ids picked], dire: [...], pins?: { radiant: [player index | null per pick], dire } }.
export function stateFeatures(ctx, state) {
  const radiant = sideAssignment(ctx.radiant, state.radiant, state.pins?.radiant), dire = sideAssignment(ctx.dire, state.dire, state.pins?.dire);
  const comfort = (p, h) => p.comfort(h), base = (p, h) => p.baseline(h);
  const reading = lead(expected(ctx.radiant, state.radiant, radiant, comfort, (p) => p.neutral), expected(ctx.dire, state.dire, dire, comfort, (p) => p.neutral));
  const heroReading = lead(expected(ctx.radiant, state.radiant, radiant, base, (p) => p.neutralBaseline), expected(ctx.dire, state.dire, dire, base, (p) => p.neutralBaseline));
  const before = lead(ctx.radiant.map((p) => p.neutralBaseline), ctx.dire.map((p) => p.neutralBaseline));
  return {
    picks: state.radiant.length + state.dire.length,
    reading,
    rankLead: ctx.rankLead,
    rating: ctx.rating ?? 0,
    counters: 0, // no counter/synergy tables yet: no draft term
    synergy: 0,
    unfamiliar: sideUnfamiliar(ctx.radiant, state.radiant, radiant) - sideUnfamiliar(ctx.dire, state.dire, dire),
    pickHero: heroReading - before,
    assignment: { radiant, dire },
  };
}

export function probability(f, weights = WEIGHTS) {
  const late = f.picks / 10;
  const x = { reading: f.reading, rankLead: f.rankLead, rating: f.rating, counters: f.counters, synergy: f.synergy, countersLate: f.counters * late, synergyLate: f.synergy * late, unfamiliar: f.unfamiliar, pickHero: f.pickHero };
  let z = weights.intercept;
  for (const [c, v] of Object.entries(x)) z += (weights.slopes[c] ?? 0) * v;
  return 1 / (1 + Math.exp(-z));
}

// P(Radiant wins) with the draft as it stands.
export const draftProbability = (ctx, state) => probability(stateFeatures(ctx, state));

// Every available hero scored for `side`, best pick first: `pick` = the side's chance if it
// takes the hero now; `ban` = how far the opponent's chance would rise if they took it;
// `player` = the side's most likely player on it (index) and their share. `pickFor` (a player
// index) pins the side's new pick to that player, as when you say who you're picking for.
export function scoreHeroes(ctx, state, side, available, { pickFor = null } = {}) {
  const other = side === "radiant" ? "dire" : "radiant";
  const forSide = (p, s) => (s === "radiant" ? p : 1 - p);
  const now = draftProbability(ctx, state);
  const withPick = (s, h, pin = null) => ({ ...state, [s]: [...state[s], h],
    pins: { radiant: state.pins?.radiant ?? [], dire: state.pins?.dire ?? [], [s]: [...(state.pins?.[s] ?? state[s].map(() => null)), pin] } });
  return available.map((hero) => {
    let pick = null, player = null, playerShare = null, ban = null;
    if (state[side].length < 5) {
      const next = withPick(side, hero, pickFor), f = stateFeatures(ctx, next);
      pick = forSide(probability(f), side);
      const k = next[side].length - 1, m = f.assignment[side];
      player = 0;
      for (let j = 1; j < m.length; j++) if (m[j][k] > m[player][k]) player = j;
      playerShare = m[player][k];
    }
    if (state[other].length < 5) ban = forSide(draftProbability(ctx, withPick(other, hero)), other) - forSide(now, other);
    return { hero, pick, ban, player, playerShare };
  }).sort((a, b) => (b.pick ?? -1) - (a.pick ?? -1));
}

// ---------- composition: which position each pick plays ----------
// Ported from Sybil's cmRoles.ts / cmComposition.ts. The model itself has no rule against a third
// carry (a penalty for a doubled position measured as nothing there), so the Drafter filters its
// suggestions instead: a hero is offered only for a position the team hasn't filled.

// P(position | hero) from lane-parsed ranked pubs, each game counted whole at its likeliest
// position: Sybil's role table, separate from the model's own shares (those pay part of every
// safe-lane support game into position 1, so carry Tidehunter reads 19% there; here 0.9%).
export const LANE_ROLES = new Map(Object.entries(FITTED.laneRoles.shares).map(([id, s]) => [Number(id), s]));
export function heroRoleShare(hero, pos) {
  const s = LANE_ROLES.get(hero);
  if (!s) return 0;
  const total = s.reduce((a, b) => a + b, 0);
  return total > 0 ? s[pos] / total : 0;
}
// A hero fits a position when the population plays it there 8%+ of the time, or the player has
// played it there in 2+ lane-parsed games (measured by Sybil on 9,522 real 7.41 picks: keeps
// 98.2% of them at the position actually played, with 49–62 heroes per position).
export const ROLE_SHARE_FLOOR = 0.08, PLAYED_IN_ROLE = 2;
// How much a pick's position follows its player rather than the hero (sideComposition).
export const POS_LEAN = 0.25;
// A flex hero: one that plays two or more roles (carry, mid, off lane, support; 4 and 5 count as
// one), by the population (FLEX_SHARE+ of its games there) or by any of `players`
// (FLEX_PLAYED+ lane-parsed games there). Returns its positions, or [] when it isn't flex.
export const FLEX_SHARE = 0.2, FLEX_PLAYED = 4;
const FLEX_GROUP = [0, 1, 2, 3, 3];
export function flexPositions(hero, players = []) {
  const at = [0, 1, 2, 3, 4].filter((r) => heroRoleShare(hero, r) >= FLEX_SHARE || players.some((p) => (p.playedAt?.get(hero)?.[r] ?? 0) >= FLEX_PLAYED));
  return new Set(at.map((r) => FLEX_GROUP[r])).size > 1 ? at : [];
}
export const fitsRole = (hero, pos, playedAt) => (playedAt?.get(hero)?.[pos] ?? 0) >= PLAYED_IN_ROLE || heroRoleShare(hero, pos) >= ROLE_SHARE_FLOOR;

// A player's lane-parsed games on each hero at each position, each counted whole at its likeliest
// one. Unparsed rows are skipped: their lane guess would make a "carry" of every farmed hero.
export function playedAtRoles(index) {
  const out = new Map();
  for (const r of index.rows) {
    if (!(r.lane >= 1 && r.lane <= 4)) continue;
    const pos = rowPositions(rowEvidence(r));
    let best = 0;
    for (let i = 1; i < POSITIONS; i++) if (pos[i] > pos[best]) best = i;
    (out.get(r.hero) ?? out.set(r.hero, [0, 0, 0, 0, 0]).get(r.hero))[best]++;
  }
  return out;
}

// The positions (0–4) a side's picks play. In league Dota a hero plays where its player plays,
// so the player's own positions lead (their share of the pick, from the model's assignment) and
// the hero's population positions only lean: a mid player's Earth Spirit is a 2, not the 3/4 it
// usually is in pubs. Each weight is the player's share at the position times (POS_LEAN + the
// hero's share there), matched one position each over every matching; the strongest reading
// takes its position first. Returns each pick's position and the positions still open.
// `fixed[k]`, when set, is the position pick k was made for (the Drafter's "as pos N"); those
// are kept and the rest are fitted around them. `reserve` is a position held for the pick about
// to be made, so no earlier pick is fitted there.
export function sideComposition(players, picks, assignment, fixed = [], reserve = null) {
  if (!picks.length) return { positions: [], open: [0, 1, 2, 3, 4].filter((r) => r !== reserve) };
  const playerPos = picks.map((_, k) => {
    const out = [0, 0, 0, 0, 0];
    players.forEach((p, j) => { const sh = poolShares(p.pool); for (let r = 0; r < POSITIONS; r++) out[r] += assignment[j][k] * sh[r]; });
    return out;
  });
  const weights = [0, 1, 2, 3, 4].map((r) => picks.map((h, k) => (POS_LEAN + heroRoleShare(h, r)) * playerPos[k][r] + 1e-9));
  const m = assignmentMarginals(weights);
  const takenR = new Set(), takenH = new Set(), positions = new Array(picks.length).fill(null);
  if (reserve != null) takenR.add(reserve);
  picks.forEach((_, k) => { const r = fixed[k]; if (r != null && !takenR.has(r)) { takenR.add(r); takenH.add(k); positions[k] = r; } });
  while (takenH.size < picks.length) {
    let best = null;
    for (let r = 0; r < POSITIONS; r++) {
      if (takenR.has(r)) continue;
      for (let k = 0; k < picks.length; k++) if (!takenH.has(k) && (!best || m[r][k] > best.share)) best = { r, k, share: m[r][k] };
    }
    takenR.add(best.r); takenH.add(best.k); positions[best.k] = best.r;
  }
  return { positions, open: [0, 1, 2, 3, 4].filter((r) => !takenR.has(r)) };
}

// The open position a hero would fill for a side, or null when it fits none: the open position
// it fits with the largest population share.
export function openRoleFor(hero, open, players) {
  let best = null, bestShare = -1;
  for (const r of open) {
    if (!players.some((p) => fitsRole(hero, r, p.playedAt))) continue;
    const sh = heroRoleShare(hero, r);
    if (sh > bestShare) { best = r; bestShare = sh; }
  }
  return best;
}

// ---------- a game's context ----------

// Both sides from the draft file: `sides.radiant` / `sides.dire` are five { key, rank_tier }
// (key = the account id the history is stored under; null for an unknown player), read as of
// `now`. Returns the model's context plus what each player was read from.
export function gameContext(draftData, sides, now, { rating = 0 } = {}) {
  const base = draftData?.baselines ?? {};
  const baselineOf = (h, bracket) => heroWinRate(base[h], bracket);
  const read = (list) => list.map((p) => ({ ...p, h: playerFromHistory(p?.key != null ? draftData?.history?.[p.key] : null, now, baselineOf, { fallbackRank: p?.rank_tier }) }));
  const r = read(sides.radiant), d = read(sides.dire);
  const bracket = bracketOf([...r, ...d].map((p) => p.h.rank));
  const meanRank = (list) => { const k = list.map((p) => p.h.rank).filter((x) => x != null); return k.length ? k.reduce((a, b) => a + b, 0) / k.length : null; };
  const rr = meanRank(r), dr = meanRank(d);
  return {
    radiant: r.map((p) => p.h.make(bracket)),
    dire: d.map((p) => p.h.make(bracket)),
    rankLead: rr == null || dr == null ? 0 : (rr - dr) / MEDAL,
    rating,
    bracket,
    info: { radiant: r.map((p) => ({ ...p, games: p.h.games, rank: p.h.rank, rankFrom: p.h.rankFrom })), dire: d.map((p) => ({ ...p, games: p.h.games, rank: p.h.rank, rankFrom: p.h.rankFrom })) },
  };
}

// The Captains Mode order (S48, patch 7.41): F = first-pick team, S = the other.
export const CM_STEPS = [
  ["F", "ban"], ["F", "ban"], ["S", "ban"], ["S", "ban"], ["F", "ban"], ["S", "ban"], ["S", "ban"],
  ["F", "pick"], ["S", "pick"],
  ["F", "ban"], ["F", "ban"], ["S", "ban"],
  ["S", "pick"], ["F", "pick"], ["F", "pick"], ["S", "pick"], ["S", "pick"], ["F", "pick"],
  ["F", "ban"], ["S", "ban"], ["F", "ban"], ["S", "ban"],
  ["F", "pick"], ["S", "pick"],
];

// Walk a draft step by step: `steps` are { side: "radiant" | "dire", pick, hero }, in order.
// Each step gets the Radiant win chance after it, and, when `alternatives` is set, the model's
// view of the choice: the hero's rank among those available and the best few.
export function readDraft(ctx, steps, allHeroes, { alternatives = 3 } = {}) {
  const state = { radiant: [], dire: [] }, gone = new Set();
  const start = draftProbability(ctx, state);
  const out = [];
  for (const s of steps) {
    const available = allHeroes.filter((h) => !gone.has(h));
    let view = null;
    if (alternatives && available.includes(s.hero)) {
      const scored = scoreHeroes(ctx, state, s.side, available);
      const key = s.pick ? "pick" : "ban";
      const ranked = scored.filter((x) => x[key] != null).sort((a, b) => b[key] - a[key]);
      const i = ranked.findIndex((x) => x.hero === s.hero);
      view = { rank: i + 1 || null, of: ranked.length, chosen: ranked[i] ?? null, best: ranked.slice(0, alternatives) };
    }
    if (s.pick) state[s.side] = [...state[s.side], s.hero];
    gone.add(s.hero);
    out.push({ ...s, p: draftProbability(ctx, state), view });
  }
  return { start, steps: out, assignment: stateFeatures(ctx, state).assignment };
}

// ---------- the model's own draft ----------

// The model drafts both sides: `order` is [["radiant" | "dire", "ban" | "pick"], ...]. Each pick is
// for the player on that side with the least of a hero so far, at the open position they play
// most, and takes the hero with the best chance among those that fit there; each ban takes the
// hero worth most to the other side among those that fit one of its open positions (the
// Drafter's rules). Returns the steps, the chance before and after every step (Radiant's), and
// who plays each pick. `heroes` is every hero id.
export function buildDraft(ctx, order, heroes) {
  const state = { radiant: [], dire: [], pins: { radiant: [], dire: [] } }, gone = new Set();
  const steps = [], values = [draftProbability(ctx, state)];
  for (const [side, kind] of order) {
    const other = side === "radiant" ? "dire" : "radiant";
    const available = heroes.filter((h) => !gone.has(h));
    const assign = stateFeatures(ctx, state).assignment;
    let best = null, player = null;
    if (kind === "pick") {
      const comp = sideComposition(ctx[side], state[side], assign[side]);
      const taken = new Set(state.pins[side]);
      const held = (j) => assign[side][j].reduce((a, b) => a + b, 0);
      player = [0, 1, 2, 3, 4].filter((j) => !taken.has(j)).sort((a, b) => held(a) - held(b) || a - b)[0];
      const sh = poolShares(ctx[side][player].pool);
      const pos = comp.open.reduce((b, r) => (b == null || sh[r] > sh[b] ? r : b), null);
      const fits = (h) => pos == null || fitsRole(h, pos, ctx[side][player].playedAt);
      const scored = scoreHeroes(ctx, state, side, available.filter(fits), { pickFor: player });
      best = (scored[0] ?? scoreHeroes(ctx, state, side, available, { pickFor: player })[0]).hero;
      state[side] = [...state[side], best];
      state.pins[side] = [...state.pins[side], player];
    } else {
      const comp = sideComposition(ctx[other], state[other], assign[other]);
      const fits = (h) => openRoleFor(h, comp.open, ctx[other]) != null;
      const scored = scoreHeroes(ctx, state, side, available).filter((x) => x.ban != null);
      best = ([...scored].filter((x) => fits(x.hero)).sort((a, b) => b.ban - a.ban)[0] ?? scored.sort((a, b) => b.ban - a.ban)[0]).hero;
    }
    gone.add(best);
    steps.push({ side, pick: kind === "pick", hero: best, player });
    values.push(draftProbability(ctx, state));
  }
  return { steps, values };
}
