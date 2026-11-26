// Team Wrapped: one team's season from its division's season games (lib/wrapped.js seasonGames).
// No page code; pages/wrapped.js draws the cards. Everything reads the parsed replay fields the
// game pages already use: obs_pos (wardmap.js), death_log (deathmap.js), kill_t, gold_adv,
// objectives, buildings, first_blood.
import { CX, CY } from "./wardmap.js";
import { phasedDraft } from "./draft.js";

const sum = (a, f) => a.reduce((t, x) => t + (f(x) ?? 0), 0);
const won = ({ m, side }) => m.winner === side;
const mine = ({ m, side }) => (m.players ?? []).filter((p) => p.team === side);
const other = (side) => (side === "a" ? "b" : "a");
export const teamName = (m, side) => (side === "a" ? m.team_a : m.team_b);
const sideOf = (m, id) => (String(m.team_a_id) === String(id) ? "a" : String(m.team_b_id) === String(id) ? "b" : null);
// Dire (team "b") spots mirrored through the map's centre, so the team's base is always bottom left.
const flip = (side, x, y) => (side === "b" ? [+(2 * CX - x).toFixed(1), +(2 * CY - y).toFixed(1)] : [x, y]);

// The team's games: [{ m, side }].
export function teamGames(games, id) {
  const out = [];
  for (const m of games) { const side = sideOf(m, id); if (side) out.push({ m, side }); }
  return out;
}

// Densest spot of points [x, y]: the point with the most others within r, and the mean of those.
export function hotspot(pts, r = 5) {
  let best = null;
  for (const a of pts) {
    let n = 0;
    for (const b of pts) if ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 <= r * r) n++;
    if (!best || n > best.n) best = { a, n };
  }
  if (!best) return null;
  const near = pts.filter((b) => (best.a[0] - b[0]) ** 2 + (best.a[1] - b[1]) ** 2 <= r * r);
  return { x: +(sum(near, (q) => q[0]) / near.length).toFixed(1), y: +(sum(near, (q) => q[1]) / near.length).toFixed(1), n: near.length };
}

// Record, time played and the roster by games (stand-ins included, marked).
export function overview(tg) {
  const wins = tg.filter(won).length, roster = new Map(), heroes = new Map();
  for (const g of tg) for (const p of mine(g)) {
    const k = String(p.player_key ?? p.account_id ?? p.name);
    const r = roster.get(k) ?? { key: k, name: p.name, games: 0, standin: 0 };
    r.games++; if (p.standin) r.standin++; r.name = p.name; roster.set(k, r);
    const h = heroes.get(p.hero) ?? { hero: p.hero, n: 0, w: 0 }; h.n++; if (won(g)) h.w++; heroes.set(p.hero, h);
  }
  return {
    games: tg.length, wins, losses: tg.length - wins,
    minutes: Math.round(sum(tg, ({ m }) => m.duration_sec) / 60),
    kills: sum(tg, (g) => sum(mine(g), (p) => p.kills)), deaths: sum(tg, (g) => sum(mine(g), (p) => p.deaths)),
    roster: [...roster.values()].sort((a, b) => b.games - a.games),
    heroes: [...heroes.values()].sort((a, b) => b.n - a.n || b.w - a.w),
  };
}

// Every observer the team placed (flipped), its life capped at 6:00, and who placed it.
export function visionOf(tg) {
  const wards = [];
  for (const g of tg) for (const p of mine(g)) {
    const a = p.obs_pos ?? [];
    for (let i = 0; i + 4 < a.length; i += 5) {
      const [x, y] = flip(g.side, a[i], a[i + 1]);
      const life = Math.min(360, a[i + 3] < 0 ? g.m.duration_sec - a[i + 2] : a[i + 3]);
      wards.push({ x, y, t: a[i + 2], life, killed: a[i + 4] === 1, who: p.name });
    }
  }
  if (wards.length < 10) return null;
  const spot = hotspot(wards.map((w) => [w.x, w.y]), 5);
  const placers = new Map(); for (const w of wards) placers.set(w.who, (placers.get(w.who) ?? 0) + 1);
  return {
    wards, spot, total: wards.length, perGame: wards.length / tg.length,
    unfound: wards.filter((w) => !w.killed).length / wards.length,
    dewards: sum(tg, (g) => sum(mine(g), (p) => (p.obs_killed ?? 0) + (p.sen_killed ?? 0))),
    topPlacer: [...placers].sort((a, b) => b[1] - a[1])[0] ?? null,
  };
}

// Where the team died in teamfights (death_log x, y > 0: OpenDota keeps no spot for other deaths).
export function dangerOf(tg) {
  const pts = [];
  for (const g of tg) for (const p of mine(g)) {
    const a = p.death_log ?? [];
    for (let j = 0; j + 5 < a.length; j += 6) if (a[j + 4] > 0) pts.push(flip(g.side, a[j + 4], a[j + 5]));
  }
  if (pts.length < 8) return null;
  return { pts, spot: hotspot(pts, 9) };
}

// Kills per minute in each 5-minute stretch (last = 40:00+), so the open-ended 40+ bin doesn't win on size.
// mins[i] = game-minutes played in that stretch (times `per` players for a team, so it reads per player).
// A stretch needs 10 game-minutes before it can be the peak.
export function clockRates(bins, durations, per = 1) {
  const mins = Array(9).fill(0);
  for (const d of durations) for (let i = 0; i < 9; i++) mins[i] += Math.max(0, Math.min(i === 8 ? Infinity : 300, (d ?? 0) - i * 300)) / 60;
  const rate = bins.map((n, i) => (mins[i] ? n / mins[i] / per : 0));
  const ok = rate.map((r, i) => (mins[i] >= 10 ? r : -1));
  return { mins, rate, peak: ok.indexOf(Math.max(...ok)) };
}
// Team kills by 5-minute stretch (the last bin is 40:00+) and the first blood rate.
export function killClock(tg) {
  const bins = Array(9).fill(0);
  let total = 0;
  for (const g of tg) for (const p of mine(g)) for (const t of p.kill_t ?? []) { bins[Math.min(8, Math.max(0, Math.floor(t / 300)))]++; total++; }
  const withFb = tg.filter((g) => (g.m.players ?? []).some((p) => p.first_blood));
  const fb = withFb.filter((g) => mine(g).some((p) => p.first_blood));
  if (total < 20) return null;
  const { mins, rate, peak } = clockRates(bins, tg.map(({ m }) => m.duration_sec), 5);
  const perGame = bins.map((b) => b / tg.length), five = perGame.slice(0, 8);
  return { bins, mins, rate, total, peak, games: tg.length, perGame, peakGame: five.indexOf(Math.max(...five)), early: sum(bins.slice(0, 3), (n) => n) / total, fbGames: withFb.length, fbWins: fb.length, fbWinRate: fb.length ? fb.filter(won).length / fb.length : null };
}

// The team's lead minute by minute (its own side positive).
const leadOf = ({ m, side }) => (m.gold_adv ?? []).map((v) => (side === "a" ? v : -v));
// Biggest deficit won and biggest lead lost (each 3k+), with the game's lead line.
export function clutchOf(tg) {
  let comeback = null, thrown = null;
  for (const g of tg) {
    const lead = leadOf(g); if (!lead.length) continue;
    if (won(g)) { const d = -Math.min(0, ...lead); if (d >= 3000 && (!comeback || d > comeback.d)) comeback = { d, lead, m: g.m, vs: teamName(g.m, other(g.side)) }; }
    else { const d = Math.max(0, ...lead); if (d >= 3000 && (!thrown || d > thrown.d)) thrown = { d, lead, m: g.m, vs: teamName(g.m, other(g.side)) }; }
  }
  const behind = tg.filter((g) => { const l = leadOf(g); return l.length && Math.min(...l) <= -5000; });
  return comeback || thrown ? { comeback, thrown, behind: behind.length, behindWins: behind.filter(won).length } : null;
}

// Roshans, Tormentors and enemy buildings taken; building damage.
export function siegeOf(tg) {
  const obj = (type) => sum(tg, ({ m, side }) => (m.objectives ?? []).filter((o) => o.type === type && o.side === side).length);
  const bld = (re) => sum(tg, ({ m, side }) => (m.buildings ?? []).filter((b) => b.side === other(side) && re.test(b.b)).length);
  const out = { roshans: obj("roshan"), tormentors: obj("tormentor"), towers: bld(/^t[1-4]/), rax: bld(/^(melee|range)_/), damage: sum(tg, (g) => sum(mine(g), (p) => p.tower_damage)) };
  return out.roshans || out.towers || out.damage ? { ...out, perGame: out.roshans / tg.length } : null;
}

// Everything for one team's story, or null with too few games.
export function teamWrapped(games, id) {
  const tg = teamGames(games, id);
  if (tg.length < 3) return null;
  const last = tg[tg.length - 1];
  return { id: String(id), name: teamName(last.m, last.side), ...overview(tg), vision: visionOf(tg), danger: dangerOf(tg), clock: killClock(tg), clutch: clutchOf(tg), siege: siegeOf(tg), draft: draftOf(games, id), style: styleOf(games, id), tempo: tempoOf(games, id), ranks: teamRanks(games, id) };
}

// ---------- draft ----------
// Who on the team plays each hero most (its games for this team), so a ban can name its target.
function owners(tg) {
  const c = new Map();
  for (const g of tg) for (const p of mine(g)) {
    const m = c.get(p.hero) ?? new Map(); m.set(p.name, (m.get(p.name) ?? 0) + 1); c.set(p.hero, m);
  }
  return new Map([...c].map(([h, m]) => [h, [...m].sort((a, b) => b[1] - a[1])[0][0]]));
}
const tally = (list) => {
  const c = new Map();
  for (const x of list) { const e = c.get(x.hero) ?? { hero: x.hero, n: 0, w: 0 }; e.n++; if (x.won) e.w++; c.set(x.hero, e); }
  return [...c.values()].sort((a, b) => b.n - a.n || b.w - a.w || String(a.hero).localeCompare(String(b.hero)));
};

// The team's drafts: what it bans, what gets banned against it (and whose hero), what it opens and
// closes with, its pool, its pick-order record, and heroes it faced or kept to itself.
// games: the whole division (for division-wide bans and picks).
export function draftOf(games, id, phased = phasedDraft) {
  const tg = teamGames(games, id).filter(({ m }) => m.draft?.length);
  if (tg.length < 3) return null;
  const own = owners(tg);
  const against = [], ours = [], first = [], last = [], picks = [], faced = [];
  const order = { first: { n: 0, w: 0 }, second: { n: 0, w: 0 } };
  for (const g of tg) {
    const { m, side } = g, w = won(g), steps = phased(m.draft);
    const posOf = new Map(mine(g).map((p) => [p.hero, p.position]));
    const fp = steps.find((s) => s.kind === "pick");
    if (fp) { const o = order[fp.side === side ? "first" : "second"]; o.n++; if (w) o.w++; }
    for (const s of steps) {
      if (s.kind === "ban") (s.side === side ? ours : against).push({ hero: s.hero, phase: s.phase, won: w });
      else if (s.side === side) {
        const e = { hero: s.hero, won: w, pos: posOf.get(s.hero) ?? null };
        picks.push(e);
        if (s.team_pick === 1) first.push(e);
        if (s.team_pick === 5) last.push(e);
      } else faced.push({ hero: s.hero, won: w });
    }
  }
  // Bans against the team, put on the player who plays that hero for it.
  const magnet = new Map();
  for (const b of against) {
    const who = own.get(b.hero); if (!who) continue;
    const e = magnet.get(who) ?? { name: who, n: 0, heroes: new Map() };
    e.n++; e.heroes.set(b.hero, (e.heroes.get(b.hero) ?? 0) + 1); magnet.set(who, e);
  }
  // Bans and picks by the division's other teams, for steals and pocket picks.
  const divBans = new Map(), divPicks = new Set();
  for (const m of games) if (m.draft?.length && sideOf(m, id) == null) for (const s of m.draft) s.pick ? divPicks.add(s.hero) : divBans.set(s.hero, (divBans.get(s.hero) ?? 0) + 1);
  const pool = tally(picks);
  const core = (list) => { const k = list.filter((e) => e.pos); return k.length ? k.filter((e) => e.pos <= 3).length / k.length : null; };
  return {
    games: tg.length,
    against: tally(against).map((e) => ({ ...e, who: own.get(e.hero) ?? null })), againstTotal: against.length,
    magnets: [...magnet.values()].sort((a, b) => b.n - a.n).map((e) => ({ ...e, heroes: [...e.heroes].sort((a, b) => b[1] - a[1]) })),
    ours: tally(ours).map((e) => ({ ...e, p1: ours.filter((b) => b.hero === e.hero && b.phase === 1).length })), oursTotal: ours.length,
    first: tally(first), firstCore: core(first),
    last: tally(last), lastCore: core(last),
    order,
    pool: { heroes: pool.length, picks: picks.length, top5: sum(pool.slice(0, 5), (e) => e.n) / Math.max(1, picks.length), list: pool },
    steals: pool.filter((e) => divBans.get(e.hero)).map((e) => ({ ...e, divBans: divBans.get(e.hero) })).sort((a, b) => b.divBans - a.divBans || b.n - a.n),
    pocket: pool.filter((e) => !divPicks.has(e.hero) && !divBans.has(e.hero)),
    nemesis: tally(faced).filter((e) => e.n >= 3).map((e) => ({ ...e, l: e.n - e.w })).sort((a, b) => b.l - a.l || a.w - b.w),
  };
}

// ---------- playstyle ----------
// Per-game numbers for a team's style, each compared across the division's teams (4+ games).
const at10 = (g) => { const l = leadOf(g); return l.length > 10 ? l[10] : null; };
export const STYLE = [
  { key: "aggro", name: "Bloodthirsty", trait: "fight all game", f: (g) => sum(mine(g), (p) => p.kills) / (g.m.duration_sec / 60) },
  { key: "early", name: "Fast starters", trait: "win the laning stage", f: at10 },
  { key: "late", name: "Late-game scalers", trait: "play long games", f: ({ m }) => m.duration_sec / 60 },
  { key: "vision", name: "Map watchers", trait: "ward and deward", f: (g) => sum(mine(g), (p) => (p.obs_placed ?? 0) + (p.obs_killed ?? 0) + (p.sen_killed ?? 0)) },
  { key: "obj", name: "Objective hunters", trait: "take Roshan and towers", f: ({ m, side }) => (m.objectives ?? []).filter((o) => o.type === "roshan" && o.side === side).length + (m.buildings ?? []).filter((b) => b.side === other(side) && /^t[1-4]/.test(b.b)).length / 3 },
  { key: "smoke", name: "Smoke gankers", trait: "live in smoke", f: (g) => sum(mine(g), (p) => p.smoke_used ?? 0) },
  { key: "farm", name: "Farm machines", trait: "stack and farm", f: (g) => sum(mine(g), (p) => p.gpm ?? 0) + 40 * sum(mine(g), (p) => p.camps_stacked ?? 0) },
  { key: "fight", name: "Teamfighters", trait: "show up to every fight", f: (g) => { const x = mine(g).filter((p) => p.tf_part != null); return x.length ? sum(x, (p) => p.tf_part) / x.length : null; } },
];
const avgOf = (tg, f) => { const v = tg.map(f).filter((x) => x != null && Number.isFinite(x)); return v.length ? sum(v, (x) => x) / v.length : null; };
export function styleOf(games, id) {
  const ids = [...new Set(games.flatMap((m) => [m.team_a_id, m.team_b_id]).filter((x) => x != null).map(String))];
  const teams = ids.map((t) => ({ id: t, tg: teamGames(games, t) })).filter((t) => t.tg.length >= 4);
  if (!teams.some((t) => t.id === String(id)) || teams.length < 3) return null;
  const axes = STYLE.map((a) => {
    const vals = teams.map((t) => ({ id: t.id, v: avgOf(t.tg, a.f) })).filter((x) => x.v != null);
    const me = vals.find((x) => x.id === String(id));
    if (!me) return null;
    const mean = sum(vals, (x) => x.v) / vals.length, sd = Math.sqrt(sum(vals, (x) => (x.v - mean) ** 2) / vals.length) || 1;
    return { key: a.key, name: a.name, trait: a.trait, v: me.v, avg: mean, z: (me.v - mean) / sd, rank: 1 + vals.filter((x) => x.v > me.v).length, of: vals.length };
  }).filter(Boolean);
  const by = [...axes].sort((a, b) => a.rank - b.rank || b.z - a.z); // best rank first, ties by how far ahead
  return { axes, top: by[0], second: by[1], least: by[by.length - 1] };
}

// Record by game length, by the lead at 10:00, in stomps and close games; smokes and buybacks.
export function tempoOf(games, id) {
  const tg = teamGames(games, id);
  if (tg.length < 3) return null;
  const rec = (list) => ({ n: list.length, w: list.filter(won).length });
  const mins = ({ m }) => m.duration_sec / 60;
  const lead10 = tg.map((g) => ({ g, v: at10(g) })).filter((x) => x.v != null);
  const final = (g) => { const l = leadOf(g); return l.length ? l[l.length - 1] : null; };
  return {
    games: tg.length,
    // League median is ~42 min, so the long end gets its own buckets.
    lengths: [[0, 30], [30, 40], [40, 50], [50, 60], [60, Infinity]].map(([lo, hi]) =>
      ({ lo, hi, ...rec(tg.filter((g) => mins(g) >= lo && mins(g) < hi)) })),
    lead10: lead10.length ? sum(lead10, (x) => x.v) / lead10.length : null,
    ahead10: rec(lead10.filter((x) => x.v > 0).map((x) => x.g)), behind10: rec(lead10.filter((x) => x.v < 0).map((x) => x.g)),
    stomps: tg.filter((g) => won(g) && (final(g) ?? 0) >= 15000).length, stomped: tg.filter((g) => !won(g) && (final(g) ?? 0) <= -15000).length,
    // Back-and-forth games: each team led by 3k+ at some point.
    swing: rec(tg.filter((g) => { const l = leadOf(g); return l.length && Math.max(...l) >= 3000 && Math.min(...l) <= -3000; })),
    smokes: sum(tg, (g) => sum(mine(g), (p) => p.smoke_used ?? 0)) / tg.length,
    smokeKills: sum(tg, (g) => sum(mine(g), (p) => (p.smoke_kill_t ?? []).length)) / tg.length,
    buybacks: sum(tg, (g) => sum(mine(g), (p) => (p.buybacks ?? []).length)) / tg.length,
  };
}

// Where the team ranks among the division's teams (4+ games) on the numbers the cards rank:
// { key: { rank, of } }, #1 = the most.
const RANKED = {
  pool: (games, id) => draftOf(games, id)?.pool.heroes,
  lead10: (games, id) => tempoOf(games, id)?.lead10,
  smokes: (games, id) => tempoOf(games, id)?.smokes,
  smokeKills: (games, id) => tempoOf(games, id)?.smokeKills,
  buybacks: (games, id) => tempoOf(games, id)?.buybacks,
};
export function teamRanks(games, id) {
  const ids = [...new Set(games.flatMap((m) => [m.team_a_id, m.team_b_id]).filter((x) => x != null).map(String))].filter((t) => teamGames(games, t).length >= 4);
  if (!ids.includes(String(id))) return {};
  const out = {};
  for (const [key, f] of Object.entries(RANKED)) {
    const vals = ids.map((t) => [t, f(games, t)]).filter(([, v]) => v != null && Number.isFinite(v));
    const me = vals.find(([t]) => t === String(id));
    if (me) out[key] = { rank: 1 + vals.filter(([, v]) => v > me[1]).length, of: vals.length };
  }
  return out;
}
