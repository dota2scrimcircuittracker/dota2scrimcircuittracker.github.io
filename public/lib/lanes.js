// Laning (AD2L, parsed replays): who laned against whom, and who came out ahead at 10 minutes.
//
// Lanes come from the replay: each player carries OpenDota's `lane_role` (1 safe, 2 mid, 3 off,
// 4 jungle) and `roaming`. Games synced before those fields fall back to the usual positions
// (1+5 safe, 2 mid, 3+4 off). Team a is Radiant, so a lane is keyed by Radiant's role in it:
// lane 1 = Radiant safe vs Dire off (bottom), 2 = mid, 3 = Radiant off vs Dire safe (top).
//
// A lane's margin is one side's gold + XP at 10:00 minus the other's, summed over everyone in
// it. Won / even / lost cut-offs are fitted per division (laneCuts): a third of lanes each way,
// side lanes and mid separately since a 1v1 swings less than a 2v2.

import { deathsOf } from "./deathmap.js";

export const LANE_END_MIN = 10;
export const LANE_LABEL = { 1: "Safe lane", 2: "Mid", 3: "Off lane" };
const OPP = { 1: 3, 2: 2, 3: 1 };
const FROM_POS = { 1: 1, 5: 1, 2: 2, 3: 3, 4: 3 };
// Physical lane names by Radiant's role in it.
export const MAP_LANE = { 1: "Bottom", 2: "Middle", 3: "Top" };

// 1 safe / 2 mid / 3 off, or null (jungle, or no data).
export function laneRoleOf(p) {
  if (p.lane_role != null) return p.lane_role >= 1 && p.lane_role <= 3 ? p.lane_role : null;
  return FROM_POS[p.position] ?? null;
}
export const at10 = (p) => (Array.isArray(p.gold_t) && p.gold_t[LANE_END_MIN] != null && p.xp10 != null ? p.gold_t[LANE_END_MIN] + p.xp10 : null);
const sumAt10 = (ps) => (ps.length && ps.every((p) => at10(p) != null) ? ps.reduce((s, p) => s + at10(p), 0) : null);
export const hasLanes = (m) => Array.isArray(m.players) && m.players.some((p) => at10(p) != null);

// The three lanes of a game: { lane (Radiant's role), a: [players], b: [players], margin } where
// margin is Radiant's lead (null when a side is empty or missing numbers).
export function gameLanes(m) {
  if (!hasLanes(m)) return [];
  return [1, 2, 3].map((lane) => {
    const a = m.players.filter((p) => p.team === "a" && laneRoleOf(p) === lane);
    const b = m.players.filter((p) => p.team === "b" && laneRoleOf(p) === OPP[lane]);
    const sa = sumAt10(a), sb = sumAt10(b);
    return { lane, a, b, margin: sa == null || sb == null ? null : sa - sb };
  });
}

// Cut-offs for won / lost: the margin a third of lanes beat. Each lane counts once from each
// side (+x and -x), so the cut is the 1/3 quantile of |margin|. Too few lanes: 1,000.
export const FALLBACK_CUT = 1000;
export function laneCuts(matches) {
  const side = [], mid = [];
  for (const m of matches) for (const l of gameLanes(m)) if (l.margin != null) (l.lane === 2 ? mid : side).push(Math.abs(l.margin));
  const q = (xs) => {
    if (xs.length < 6) return FALLBACK_CUT;
    const s = [...xs].sort((x, y) => x - y), at = (s.length - 1) / 3, lo = Math.floor(at);
    return Math.round(s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (at - lo));
  };
  return { side: q(side), mid: q(mid), lanes: side.length + mid.length };
}
export const cutFor = (cuts, laneRole) => (laneRole === 2 ? cuts.mid : cuts.side);
export function verdict(margin, cut) {
  if (margin == null) return null;
  return margin > cut ? "won" : margin < -cut ? "lost" : "even";
}

// Per-game laning numbers for one player, from their own side of their lane. Null when the
// replay has no lane numbers for them.
export function playerLane(m, p, cuts) {
  const role = laneRoleOf(p);
  if (role == null || at10(p) == null) return null;
  const lane = gameLanes(m).find((l) => l.lane === (p.team === "a" ? role : OPP[role]));
  const margin = lane?.margin == null ? null : p.team === "a" ? lane.margin : -lane.margin;
  const cut = cutFor(cuts, role);
  const i = m.players.indexOf(p), early = deathsOf(m).filter((d) => d.t < LANE_END_MIN * 60);
  const withDeaths = Array.isArray(p.death_log);
  return {
    role, roaming: !!p.roaming, margin, cut, verdict: verdict(margin, cut), score: margin == null ? null : margin / cut,
    mates: lane ? (p.team === "a" ? lane.a : lane.b).filter((q) => q !== p) : [],
    foes: lane ? (p.team === "a" ? lane.b : lane.a) : [],
    gold10: p.gold_t[LANE_END_MIN], xp10: p.xp10,
    lh10: p.lh10 ?? null, dn10: p.dn10 ?? null, eff: p.lane_eff ?? null,
    deaths10: withDeaths ? early.filter((d) => d.i === i).length : null,
    kills10: withDeaths ? early.filter((d) => d.killer === i).length : null,
    won: m.winner === p.team,
  };
}

// Ranking groups by the position played, as the tier list does.
export const LANE_GROUPS = [["safe", "Safe lane", [1]], ["mid", "Mid", [2]], ["off", "Off lane", [3]], ["support", "Supports", [4, 5]]];
export const groupOf = (pos) => LANE_GROUPS.find(([, , ps]) => ps.includes(pos))?.[0] ?? null;

// Averages over a list of playerLane() results (nulls skipped per stat). `pad` pulls the lane
// score toward even by that many lanes, so one great lane doesn't top a season list.
export function laneSummary(rows, pad = 0) {
  const rs = rows.filter(Boolean);
  const avg = (f) => { const v = rs.map(f).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const judged = rs.filter((r) => r.verdict);
  const count = (v) => judged.filter((r) => r.verdict === v).length;
  const wonLanes = judged.filter((r) => r.verdict === "won");
  return {
    lanes: judged.length, won: count("won"), even: count("even"), lost: count("lost"),
    lane_rate: judged.length ? (count("won") + 0.5 * count("even")) / judged.length : null,
    margin: avg((r) => r.margin),
    score: judged.length ? judged.reduce((s, r) => s + r.score, 0) / (judged.length + pad) : null,
    lh10: avg((r) => r.lh10), dn10: avg((r) => r.dn10), eff: avg((r) => r.eff),
    deaths10: avg((r) => r.deaths10), kills10: avg((r) => r.kills10),
    win_when_won: wonLanes.length ? wonLanes.filter((r) => r.won).length / wonLanes.length : null,
    won_lane_games: wonLanes.length,
  };
}

// Every player's laning over some games: [{ key, p (latest), group, rows, ...laneSummary }],
// grouped by the position they played (one entry per player per group).
export function laneBoard(matches, cuts, keyOf, pad = 2) {
  const by = new Map();
  for (const m of matches) {
    for (const p of m.players) {
      const g = groupOf(p.position), r = g && playerLane(m, p, cuts);
      if (!r) continue;
      const k = `${keyOf(p)}|${g}`;
      const e = by.get(k) ?? { key: keyOf(p), p, group: g, rows: [] };
      e.rows.push({ ...r, m, p });
      e.p = p;
      by.set(k, e);
    }
  }
  return [...by.values()].map((e) => ({ ...e, ...laneSummary(e.rows, pad) }));
}

// For the tier list: a player's gold + XP lead at 10 over who they actually laned against.
// Cores: themselves against the enemy cores in their lane (averaged); supports: their whole
// lane against the enemy's. Null without lane numbers or with nobody across the lane.
export function tierLaneResult(m, p) {
  const role = laneRoleOf(p), mine = at10(p);
  if (role == null || mine == null || p.position == null) return null;
  const lane = gameLanes(m).find((l) => l.lane === (p.team === "a" ? role : OPP[role]));
  if (!lane) return null;
  const us = p.team === "a" ? lane.a : lane.b, them = p.team === "a" ? lane.b : lane.a;
  if (p.position <= 3) {
    const cores = them.filter((q) => q.position != null && q.position <= 3 && at10(q) != null);
    return cores.length ? mine - cores.reduce((s, q) => s + at10(q), 0) / cores.length : null;
  }
  const a = sumAt10(us), b = sumAt10(them);
  return a == null || b == null ? null : a - b;
}
