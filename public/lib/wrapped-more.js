// More Wrapped cards (the ten kept from _dev/wrapped-ideas.html, 2026-11-25): the numbers only;
// pages/wrapped.js draws them. Everything reads parsed replay fields the game pages already use.
// A card's numbers are null when the card wouldn't make sense for that player (a carry with three
// wards gets no vision slide), so a story only carries the slides that say something.
import { playerKey } from "./stats.js";
import { mainTeamOf } from "./wrapped.js";
import { CX, CY } from "./wardmap.js";
import { hotspot, clockRates } from "./team-wrapped.js";
import { RUNES } from "./combat.js";
import { assistBins } from "./lite.js";

const MIN = 3;
const sum = (a, f) => a.reduce((t, x) => t + (f(x) ?? 0), 0);
const per = (rows, f) => (rows.length ? sum(rows, f) / rows.length : 0);
const median = (a) => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
const parsed = (p) => p.apm != null;
const won = (m, p) => m.winner === p.team;
const opp = (m, p) => (p.team === "a" ? m.team_b : m.team_a);
// Dire spots mirrored through the centre, so the player's base is always bottom left.
const mirror = (p, x, y) => (p.team === "b" ? [+(2 * CX - x).toFixed(1), +(2 * CY - y).toFixed(1)] : [x, y]);
const arr = (v) => (Array.isArray(v) ? v : []);

// Parsed rows per player with MIN games: key -> { key, p, rows, pos (main position) }.
export function parsedPlayers(games) {
  const out = new Map();
  for (const m of games) for (const p of m.players ?? []) {
    if (!parsed(p)) continue;
    const k = playerKey(p), e = out.get(k) ?? { key: k, p, rows: [] };
    e.rows.push({ m, p }); e.p = p; out.set(k, e);
  }
  for (const [k, e] of out) {
    if (e.rows.length < MIN) { out.delete(k); continue; }
    const c = {}; for (const { p } of e.rows) if (p.position) c[p.position] = (c[p.position] ?? 0) + 1;
    e.team = mainTeamOf(e.rows);
    e.pos = +(Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0);
  }
  return out;
}
// Where me ranks among players on f(rows) -> number|null (higher first unless low).
function rankOf(players, key, f, { low = false } = {}) {
  const vals = [];
  for (const e of players.values()) { const v = f(e.rows); if (v != null && Number.isFinite(v)) vals.push([e.key, v]); }
  vals.sort((a, b) => (low ? a[1] - b[1] : b[1] - a[1]));
  const i = vals.findIndex(([k]) => k === key);
  return i < 0 ? null : { rank: i + 1, of: vals.length, avg: sum(vals, (x) => x[1]) / vals.length };
}
const topHalf = (r) => r && r.rank <= Math.ceil(r.of / 2);
const best = (rows, f) => rows.reduce((a, b) => ((f(b.p) ?? 0) > (f(a.p) ?? 0) ? b : a));

// Observers as { x, y, killed } (Dire mirrored). obs_pos: x, y, placed at, lifetime, killed.
const obsOf = (rows) => rows.flatMap(({ p }) => { const a = arr(p.obs_pos), o = []; for (let i = 0; i + 4 < a.length; i += 5) { const [x, y] = mirror(p, a[i], a[i + 1]); o.push({ x, y, killed: a[i + 4] === 1 }); } return o; });
// Teamfight death spots (death_log: 6 numbers a death, x and y at 4 and 5; 0 when not in a fight).
const deathSpots = (rows) => rows.flatMap(({ p }) => { const a = arr(p.death_log), o = []; for (let j = 0; j + 5 < a.length; j += 6) if (a[j + 4] > 0) o.push(mirror(p, a[j + 4], a[j + 5])); return o; });
const dewards = (p) => (p.obs_killed ?? 0) + (p.sen_killed ?? 0);
const runesOf = (p) => sum(arr(p.runes), (n) => n);
const smokeKills = (p) => arr(p.smoke_kill_t).length;
const gainOf = (m, p) => arr(m.gold_adv).map((v) => (p.team === "a" ? v : -v));

// ---------- a player's cards (division scope) ----------
// players: parsedPlayers(games) for the division. Each field null when its card doesn't fit.
export function moreOf(players, key) {
  const me = players.get(key);
  if (!me) return null;
  const rows = me.rows, R = (f, o) => rankOf(players, key, f, o);
  // RP: the same rank among players at their main position (3+ of them).
  const pos = new Map([...players].filter(([, e]) => e.pos === me.pos)), RP = (f, o) => (me.pos && pos.size >= 3 ? rankOf(pos, key, f, o) : null);
  // RC: the same rank among cores (positions 1-3): last hits matter to all three (Fav, 2026-11-25).
  const cores = new Map([...players].filter(([, e]) => e.pos >= 1 && e.pos <= 3)), RC = (f, o) => (me.pos >= 1 && me.pos <= 3 && cores.size >= 3 ? rankOf(cores, key, f, o) : null);
  const sup = me.pos === 4 || me.pos === 5;
  return { vision: visionOf(rows, R), fight: fightOf(rows, R), early: earlyOf(rows, R), map: mapOf(rows, R),
    clutch: clutchOf(rows), siege: siegeOf(rows, R), hands: handsOf(rows, R), items: itemRaceOf(players, rows),
    farm: sup ? null : withRecords(farmOf(rows, R, RC), players), assists: sup ? withRecords(assistOf(rows, R, RP, me.pos), players) : null };
}

// Vision: supports (15+ observers). Their spot, how many were never found, and dewards.
function visionOf(rows, R) {
  const w = obsOf(rows);
  if (w.length < 15) return null;
  const spot = hotspot(w.map((o) => [o.x, o.y]), 5), dw = sum(rows, ({ p }) => dewards(p));
  const g = best(rows, dewards);
  return { wards: w, total: w.length, games: rows.length, spot, unfound: w.filter((o) => !o.killed).length / w.length, dewards: dw,
    bestNight: dewards(g.p) ? { n: dewards(g.p), hero: g.p.hero } : null,
    rank: R((rs) => { const x = obsOf(rs); return x.length >= 10 ? x.length / rs.length : null; }) };
}
// In the fight: fights joined, stun time, damage soaked, and where their teamfight deaths bunch up.
function fightOf(rows, R) {
  const tf = rows.filter(({ p }) => p.tf_part != null);
  if (tf.length < MIN) return null;
  const pts = deathSpots(rows), spot = pts.length >= 4 ? hotspot(pts, 9) : null;
  return { games: rows.length, share: per(tf, ({ p }) => p.tf_part), stuns: sum(rows, ({ p }) => p.stuns), soaked: sum(rows, ({ p }) => p.dmg_taken),
    rank: R((rs) => { const x = rs.filter(({ p }) => p.tf_part != null); return x.length ? per(x, ({ p }) => p.tf_part) : null; }),
    stunRank: R((rs) => per(rs, ({ p }) => p.stuns)),
    deaths: spot && spot.n >= 3 ? { pts, spot } : null };
}
// Most active time: the five-minute stretch with most of their kills and assists (Fav, 2026-11-25),
// first bloods drawn and suffered. Assist times are estimated (lite.js assistBins), enough for the
// shape; the per-minute numbers use the real counts. Games without teamfights count kills only.
function earlyOf(rows, R) {
  const bins = Array(9).fill(0);
  let assists = false;
  for (const { m, p } of rows) {
    for (const t of arr(p.kill_t)) bins[Math.min(8, Math.max(0, Math.floor(t / 300)))]++;
    const a = assistBins(m, p);
    if (a) { assists = true; a.forEach((n, i) => { bins[i] += n; }); }
  }
  const total = sum(bins, (n) => n);
  if (total < 8) return null;
  const { mins, rate, peak } = clockRates(bins, rows.map(({ m }) => m.duration_sec));
  const dur = sum(rows, ({ m }) => m.duration_sec) / 60, n = rows.length;
  // A game: each stretch's count over every game, games that ended before it counting 0. The peak
  // is among the eight 5-minute stretches: 40+ holds every minute past 40, so it isn't one.
  const perGame = bins.map((b) => b / n), five = perGame.slice(0, 8);
  return { bins, mins, rate, peak, perGame, peakGame: five.indexOf(Math.max(...five)), total, assists, early: (bins[0] + bins[1] + bins[2]) / total,
    kpm: sum(rows, ({ p }) => p.kills) / dur, apm: sum(rows, ({ p }) => p.assists) / dur,
    kpg: sum(rows, ({ p }) => p.kills) / n, apg: sum(rows, ({ p }) => p.assists) / n,
    rankGame: R((rs) => per(rs, ({ p }) => p.kills + p.assists)),
    fb: sum(rows, ({ p }) => p.first_blood), fd: sum(rows, ({ p }) => p.first_death),
    fbRank: R((rs) => sum(rs, ({ p }) => p.first_blood)),
    rank: R((rs) => { const d = sum(rs, ({ m }) => m.duration_sec) / 60; return d ? sum(rs, ({ p }) => p.kills + p.assists) / d : null; }) };
}
// Around the map: stacks, runes and smoke kills. Only for players who stand out at one of them.
function mapOf(rows, R) {
  const stacks = sum(rows, ({ p }) => p.camps_stacked), runes = sum(rows, ({ p }) => runesOf(p)), smoke = sum(rows, ({ p }) => smokeKills(p));
  const ranks = { stacks: R((rs) => sum(rs, ({ p }) => p.camps_stacked)), runes: R((rs) => sum(rs, ({ p }) => runesOf(p))), smoke: R((rs) => sum(rs, ({ p }) => smokeKills(p))) };
  const top = Object.entries(ranks).filter(([, r]) => r && r.rank <= Math.max(3, Math.ceil(r.of / 5))).sort((a, b) => a[1].rank / a[1].of - b[1].rank / b[1].of)[0];
  if (!top) return null;
  const types = Array(RUNES.length).fill(0);
  for (const { p } of rows) arr(p.runes).forEach((n, i) => { if (i < types.length) types[i] += n ?? 0; });
  const g = best(rows, (p) => p.camps_stacked);
  return { lead: top[0], stacks, runes, smoke, ranks, ancients: sum(rows, ({ p }) => p.ancient_kills),
    mostStacks: g.p.camps_stacked ? { n: g.p.camps_stacked, hero: g.p.hero } : null,
    runeTypes: RUNES.map((name, i) => ({ name, n: types[i] })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 5) };
}
// Clutch: their biggest comeback (5k+ down and won), the lead that got away, buybacks.
function clutchOf(rows) {
  let cb = null, th = null;
  for (const { m, p } of rows) {
    const g = gainOf(m, p);
    if (!g.length) continue;
    if (won(m, p)) { const d = -Math.min(0, ...g); if (!cb || d > cb.d) cb = { d, m, p, lead: g }; }
    else { const d = Math.max(0, ...g); if (!th || d > th.d) th = { d, m, p, lead: g }; }
  }
  if (!cb || cb.d < 5000) return null;
  const bb = rows.flatMap(({ m, p }) => arr(p.buybacks).map(() => won(m, p)));
  return { comeback: { ...cb, vs: opp(cb.m, cb.p) }, thrown: th && th.d >= 5000 ? { ...th, vs: opp(th.m, th.p) } : null,
    buybacks: bb.length, buybackWins: bb.filter(Boolean).length };
}
// Objectives: building damage, Roshans and Tormentors. For players in the division's top half for
// building damage a game, or with 3+ Roshans.
function siegeOf(rows, R) {
  const dmg = sum(rows, ({ p }) => p.tower_damage), rosh = sum(rows, ({ p }) => p.roshan_kills), torm = sum(rows, ({ p }) => p.tormentor_kills);
  const rank = R((rs) => per(rs, ({ p }) => p.tower_damage));
  if (!dmg || (!topHalf(rank) && rosh < 3)) return null;
  return { damage: dmg, perGame: dmg / rows.length, towers: Math.round(dmg / 1800), roshans: rosh, tormentors: torm, rank };
}
// Hands and mouth: APM and pings.
function handsOf(rows, R) {
  const r = rows.filter(({ p }) => p.apm != null);
  if (!r.length) return null;
  const g = best(r, (p) => p.apm), pg = best(r, (p) => p.pings);
  return { games: r.length, apm: per(r, ({ p }) => p.apm), actions: sum(r, ({ m, p }) => (p.apm * m.duration_sec) / 60), top: { apm: g.p.apm, hero: g.p.hero },
    pings: sum(r, ({ p }) => p.pings), perGame: per(r, ({ p }) => p.pings), loudest: pg.p.pings ? { n: pg.p.pings, hero: pg.p.hero } : null,
    rank: R((rs) => per(rs, ({ p }) => p.apm)), pingRank: R((rs) => per(rs, ({ p }) => p.pings)) };
}
// Item race: the item they finished furthest ahead of the usual time on the same hero (Fav,
// 2026-11-25: "tie item timings to heroes"). A hero's usual time needs 5+ builds of the item on it
// across the division, 3+ of them someone else's; they need 2+ builds of it on that hero. When no
// hero qualifies, the division's usual time for the item on any hero (8+ builds), as before. Only
// items usually finished after 12:00, and only a lead of a minute or more (median times).
// rows: up to three of their per-hero leads, the biggest first.
const pairs = (p) => { const a = arr(p.item_times), o = []; for (let i = 0; i + 1 < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };
function itemRaceOf(players, rows) {
  const put = (map, k, v) => { if (!map.has(k)) map.set(k, []); map.get(k).push(v); };
  const meKey = playerKey(rows[0].p), lg = new Map(), lgHero = new Map(), mine = new Map(), mineHero = new Map();
  for (const e of players.values()) for (const { p } of e.rows) for (const [k, t] of pairs(p)) { put(lg, k, t); put(lgHero, `${p.hero}|${k}`, { t, me: e.key === meKey }); }
  for (const { p } of rows) for (const [k, t] of pairs(p)) { put(mine, k, t); put(mineHero, `${p.hero}|${k}`, t); }
  const hero = [];
  for (const [hk, ts] of mineHero) {
    const all = lgHero.get(hk) ?? [];
    if (ts.length < 2 || all.length < 5 || all.filter((x) => !x.me).length < 3) continue;
    const usual = median(all.map((x) => x.t)), mm = median(ts), cut = hk.lastIndexOf("|");
    if (usual >= 720 && usual - mm >= 60) hero.push({ key: hk.slice(cut + 1), hero: hk.slice(0, cut), mine: mm, usual, gain: usual - mm, builds: ts.length, of: all.length });
  }
  if (hero.length) { hero.sort((x, y) => y.gain - x.gain); return { ...hero[0], vs: "hero", rows: hero.slice(0, 3) }; }
  let b = null;
  for (const [k, ts] of mine) {
    const all = lg.get(k) ?? [];
    if (ts.length < 2 || all.length < 8) continue;
    const lm = median(all);
    if (lm < 720) continue;
    const mm = median(ts), gain = lm - mm;
    if (!b || gain > b.gain) {
      const hc = {}; for (const { p } of rows) if (arr(p.item_times).includes(k)) hc[p.hero] = (hc[p.hero] ?? 0) + 1;
      b = { key: k, mine: mm, usual: lm, gain, builds: ts.length, hero: Object.entries(hc).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null };
    }
  }
  return b && b.gain >= 60 ? { ...b, vs: "all", rows: [] } : null;
}
// Last hits, for cores (positions 1-3, or no main position): at 10 minutes and a minute over the
// whole game, denies at 10, their best games, ranked in the division and among cores (Fav,
// 2026-11-25: "lasthits at 10 and throughout the game. Just for people to flex"). Sync keeps
// last hits at 10 minutes only, so "throughout the game" is the whole-game rate.
const lhm = (m, p) => (p.last_hits ?? 0) / (m.duration_sec / 60);
function farmOf(rows, R, RC) {
  const t = rows.filter(({ p }) => p.lh10 != null);
  if (t.length < MIN || !sum(rows, ({ p }) => p.last_hits)) return null;
  const lh10 = (rs) => { const x = rs.filter(({ p }) => p.lh10 != null); return x.length >= MIN ? per(x, ({ p }) => p.lh10) : null; };
  const perMin = (rs) => per(rs, ({ m, p }) => lhm(m, p)), perGame = (rs) => per(rs, ({ p }) => p.last_hits ?? 0);
  const b10 = best(t, (p) => p.lh10), bAll = best(rows, (p) => p.last_hits), bRate = rows.reduce((x, c) => (lhm(c.m, c.p) > lhm(x.m, x.p) ? c : x));
  return { lh10: lh10(rows), dn10: per(t, ({ p }) => p.dn10 ?? 0), perMin: perMin(rows), perGame: perGame(rows), total: sum(rows, ({ p }) => p.last_hits),
    best10: { n: b10.p.lh10, hero: b10.p.hero, m: b10.m }, bestGame: { n: bAll.p.last_hits, hero: bAll.p.hero, m: bAll.m },
    bestRate: { n: lhm(bRate.m, bRate.p), hero: bRate.p.hero },
    rank10: R(lh10), rankMin: R(perMin), rankGame: R(perGame), core10: RC(lh10), coreMin: RC(perMin), coreGame: RC(perGame) };
}
// Where a card's best single games rank among each player's best game in the division, the way the
// season review's record boards (gameRecords) list them: best10 on last hits at 10, bestGame on
// last hits or assists. of: players with a game counted.
function withRecords(c, players) {
  if (!c) return c;
  const rank = (v, f) => {
    const bests = [...players.values()].map((e) => Math.max(-1, ...e.rows.map(({ p }) => f(p) ?? -1))).filter((x) => x >= 0);
    return { rank: 1 + bests.filter((x) => x > v).length, of: bests.length };
  };
  if (c.best10) c.best10.rank = rank(c.best10.n, (p) => p.lh10);
  if (c.bestGame) c.bestGame.rank = rank(c.bestGame.n, c.best10 ? (p) => p.last_hits : (p) => p.assists);
  return c;
}
// Supports (positions 4 and 5) get assists in that slot: assists a game and a minute, kill
// participation (their kills + assists over their team's kills), their best game, ranked in the
// division and at their position.
function assistOf(rows, R, RP, pos) {
  if (!sum(rows, ({ p }) => p.assists)) return null;
  const apg = (rs) => per(rs, ({ p }) => p.assists);
  const apm = (rs) => { const d = sum(rs, ({ m }) => m.duration_sec) / 60; return d ? sum(rs, ({ p }) => p.assists) / d : null; };
  const kp = (rs) => { let x = 0, y = 0; for (const { m, p } of rs) { x += p.kills + p.assists; y += sum(m.players.filter((q) => q.team === p.team), (q) => q.kills); } return y ? x / y : null; };
  const g = best(rows, (p) => p.assists);
  return { pos, total: sum(rows, ({ p }) => p.assists), perGame: apg(rows), perMin: apm(rows), kp: kp(rows),
    bestGame: { n: g.p.assists, hero: g.p.hero, m: g.m, k: g.p.kills, d: g.p.deaths },
    rankGame: R(apg), rankMin: R(apm), rankKp: R(kp), posGame: RP(apg), posKp: RP(kp) };
}

// ---------- across AD2L ----------
// You in every division: their averages ranked against each division's players at their main
// position. leagues: [{ key, name, players: parsedPlayers }]; home: their division's key.
// What each role is judged on (Fav, 2026-11-25: "compare things by role", GPM matters less for
// supports; wards, assists and stun time do). Position 1-5 -> [label, rows -> number]; 0 (no main
// position) uses the core set. The performance tables show all four, the every-division table the first three.
const S = {
  gpm: ["GPM", (rs) => per(rs, ({ p }) => p.gpm ?? 0)],
  lhm: ["LH/min", (rs) => per(rs, ({ m, p }) => (p.last_hits ?? 0) / (m.duration_sec / 60))],
  dmg: ["Dmg/min", (rs) => per(rs, ({ m, p }) => (p.hero_damage ?? 0) / (m.duration_sec / 60))],
  kda: ["KDA", (rs) => sum(rs, ({ p }) => p.kills + p.assists) / Math.max(1, sum(rs, ({ p }) => p.deaths))],
  kills: ["Kills", (rs) => per(rs, ({ p }) => p.kills)],
  assists: ["Assists", (rs) => per(rs, ({ p }) => p.assists)],
  stuns: ["Stun sec", (rs) => per(rs, ({ p }) => p.stuns ?? 0)],
  fights: ["Fights", (rs) => per(rs, ({ p }) => p.tf_part ?? 0)],
  wards: ["Wards", (rs) => per(rs, ({ p }) => (p.obs_placed ?? 0) + (p.sen_placed ?? 0))],
  stacks: ["Stacks", (rs) => per(rs, ({ p }) => p.camps_stacked ?? 0)],
};
const ROLE_STATS = {
  0: [S.gpm, S.dmg, S.kda, S.kills],
  1: [S.gpm, S.lhm, S.dmg, S.kda],
  2: [S.gpm, S.dmg, S.kda, S.kills],
  3: [S.stuns, S.fights, S.dmg, S.kda],
  4: [S.assists, S.stuns, S.wards, S.kda],
  5: [S.wards, S.assists, S.stacks, S.kda],
};
export const roleStats = (pos) => ROLE_STATS[pos] ?? ROLE_STATS[0];
export function everyDivision(leagues, home, key) {
  const me = leagues.find((l) => l.key === home)?.players.get(key);
  if (!me || !me.pos) return null;
  const EVERY = roleStats(me.pos).slice(0, 3);
  const mine = EVERY.map(([, f]) => f(me.rows));
  const rows = leagues.map((l) => ({ key: l.key, name: l.name, home: l.key === home,
    ranks: EVERY.map(([, f], i) => { const v = [...l.players.values()].filter((e) => e.pos === me.pos && e.key !== key).map((e) => f(e.rows)); return { rank: 1 + v.filter((x) => x > mine[i]).length, of: v.length + 1 }; }) }))
    .filter((r) => r.ranks[0].of > 1);
  if (rows.length < 2) return null;
  // The headline: their best rank in another division (a lower division's #1 reads best).
  let top = null;
  for (const r of rows) if (!r.home) r.ranks.forEach((x, i) => { if (!top || x.rank < top.rank || (x.rank === top.rank && x.of > top.of)) top = { ...x, div: r.name, stat: EVERY[i][0] }; });
  return { pos: me.pos, stats: EVERY.map(([n]) => n), rows, top };
}
// Division showdown: per division, game length, kills a minute, observers a game and how often the
// winner came back from 5k down. leagues: [{ key, name, games }].
export function divisionShowdown(leagues) {
  const rows = leagues.map((l) => {
    const g = l.games.filter((m) => m.players?.length === 10 && m.duration_sec);
    if (!g.length) return null;
    return { key: l.key, name: l.name, games: g.length,
      length: per(g, (m) => m.duration_sec), kpm: per(g, (m) => sum(m.players, (p) => p.kills) / (m.duration_sec / 60)),
      wards: per(g, (m) => sum(m.players, (p) => p.obs_placed ?? 0)),
      comeback: g.filter((m) => { const a = arr(m.gold_adv), s = m.winner === "a" ? 1 : -1; return a.length && Math.min(...a.map((v) => v * s)) <= -5000; }).length / g.length };
  }).filter(Boolean);
  if (rows.length < 2) return null;
  const top = (k, low = false) => rows.reduce((a, b) => ((low ? b[k] < a[k] : b[k] > a[k]) ? b : a)).key;
  return { rows, best: { length: top("length"), kpm: top("kpm"), wards: top("wards"), comeback: top("comeback") }, bloodiest: rows.find((r) => r.key === top("kpm")) };
}

// ---------- leaderboards (season review, division and AD2L) ----------
// One podium per new card: the top 5. Player boards need 5 parsed games.
const AMIN = 5;
const topHero = (rows) => { const c = {}; for (const { p } of rows) c[p.hero] = (c[p.hero] ?? 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; };
const BOARDS = [
  { key: "vision", group: "Vision", title: "Lights out", blurb: "Most enemy wards destroyed.", tone: 6, f: (r) => sum(r, ({ p }) => dewards(p)), show: (v) => `${v}` },
  { key: "fight", group: "In the fight", title: "Always there", blurb: "Highest share of their team's fights joined.", tone: 1, f: (r) => { const x = r.filter(({ p }) => p.tf_part != null); return x.length >= AMIN ? per(x, ({ p }) => p.tf_part) : null; }, show: (v) => `${Math.round(v * 100)}%` },
  { key: "early", group: "Early game", title: "Bloodthirsty", blurb: "Most first bloods drawn.", tone: 1, f: (r) => sum(r, ({ p }) => p.first_blood), show: (v) => `${v}` },
  { key: "map", group: "Around the map", title: "The stacker", blurb: "Most camps stacked.", tone: 4, f: (r) => sum(r, ({ p }) => p.camps_stacked), show: (v) => `${v}` },
  { key: "siege", group: "Objectives", title: "Siege engine", blurb: "Most building damage a game.", tone: 2, f: (r) => per(r, ({ p }) => p.tower_damage), show: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`) },
  { key: "hands", group: "Hands and mouth", title: "Fastest hands", blurb: "Highest average APM.", tone: 6, f: (r) => per(r, ({ p }) => p.apm), show: (v) => `${Math.round(v)}` },
];
// hero: the hero a row shows when the stat comes from one game (else their most played).
// More podiums (Fav, 2026-11-25: "expand champion awards ... just have more"). They go after the
// comeback slide so the boards above keep their places. low: fewest first.
const k1 = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);
const MORE_BOARDS = [
  { key: "farm", group: "Farm", title: "Gold rush", blurb: "Highest GPM.", tone: 4, f: (r) => per(r, ({ p }) => p.gpm), show: (v) => `${Math.round(v)}` },
  { key: "damage", group: "Damage", title: "Damage dealer", blurb: "Most hero damage a minute.", tone: 1, f: (r) => per(r, ({ m, p }) => (p.hero_damage ?? 0) / (m.duration_sec / 60)), show: (v) => `${Math.round(v)}` },
  { key: "heal", group: "Healing", title: "The medic", blurb: "Most hero healing a game.", tone: 5, f: (r) => per(r, ({ p }) => p.hero_healing), show: k1 },
  { key: "stuns", group: "Control", title: "Lockdown", blurb: "Most stun time a game.", tone: 6, f: (r) => per(r, ({ p }) => p.stuns), show: (v) => `${v.toFixed(1)}s` },
  { key: "wards", group: "Warding", title: "Ward machine", blurb: "Most wards placed a game.", tone: 6, f: (r) => per(r, ({ p }) => (p.obs_placed ?? 0) + (p.sen_placed ?? 0)), show: (v) => v.toFixed(1) },
  { key: "lane", group: "Laning", title: "Lane bully", blurb: "Most last hits at 10 minutes.", tone: 2, f: (r) => { const x = r.filter(({ p }) => p.lh10 != null); return x.length >= AMIN ? per(x, ({ p }) => p.lh10) : null; }, show: (v) => v.toFixed(1) },
  { key: "multi", group: "Multi-kills", title: "Multi-kill machine", blurb: "Most multi-kills.", tone: 1, f: (r) => sum(r, ({ p }) => sum(arr(p.multi), (n) => n)), show: (v) => `${v}` },
  { key: "hit", group: "Big hit", title: "Heaviest hitter", blurb: "Biggest single hit of the season.", tone: 3, f: (r) => Math.max(0, ...r.map(({ p }) => +arr(p.max_hit)[0] || 0)), show: (v) => `${Math.round(v)}`,
    hero: (r) => r.reduce((a, b) => ((+arr(b.p.max_hit)[0] || 0) > (+arr(a.p.max_hit)[0] || 0) ? b : a)).p.hero },
  { key: "rosh", group: "Roshan", title: "Rosh hunter", blurb: "Most Roshan kills.", tone: 2, f: (r) => sum(r, ({ p }) => p.roshan_kills), show: (v) => `${v}` },
  { key: "runes", group: "Runes", title: "Rune hunter", blurb: "Most runes picked up.", tone: 4, f: (r) => sum(r, ({ p }) => runesOf(p)), show: (v) => `${v}` },
  { key: "smoke", group: "Smokes", title: "Out of the fog", blurb: "Most kills off a smoke.", tone: 3, f: (r) => sum(r, ({ p }) => smokeKills(p)), show: (v) => `${v}` },
  { key: "tank", group: "Frontline", title: "Punching bag", blurb: "Most damage taken a minute.", tone: 5, f: (r) => per(r, ({ m, p }) => (p.dmg_taken ?? 0) / (m.duration_sec / 60)), show: (v) => `${Math.round(v)}` },
  { key: "alive", group: "Survival", title: "Hard to kill", blurb: "Fewest deaths a game.", tone: 5, low: true, f: (r) => per(r, ({ p }) => p.deaths), show: (v) => v.toFixed(1) },
  { key: "comms", group: "Comms", title: "Chatterbox", blurb: "Most map pings a game.", tone: 6, f: (r) => per(r, ({ p }) => p.pings), show: (v) => `${Math.round(v)}` },
];
const podium = (players, b) => {
  const vals = [...players.values()].filter((e) => e.rows.length >= AMIN).map((e) => ({ e, v: b.f(e.rows) })).filter((x) => x.v != null && Number.isFinite(x.v) && (b.low ? x.v >= 0 : x.v > 0));
  vals.sort((a, c) => (b.low ? a.v - c.v : c.v - a.v));
  return { ...b, top: vals.slice(0, 5).map(({ e, v }) => ({ key: e.key, p: e.p, team: e.team.name, hero: b.hero ? b.hero(e.rows) : topHero(e.rows), val: b.show(v) })) };
};
// Single-game records (Fav, 2026-11-25: "who had the most last hits at 10 mins in one game"): the
// top 5 games of the season, one per player (their best), with the game for a link. For Champion
// and AD2L reviews alike (whatever games are passed).
const RECORDS = [
  { key: "lh10", title: "Most last hits at 10", blurb: "In one game, at 10:00.", tone: 2, f: (p) => p.lh10 },
  { key: "lh", title: "Most last hits", blurb: "In one game.", tone: 4, f: (p) => p.last_hits },
  { key: "kills", title: "Most kills", blurb: "In one game.", tone: 1, f: (p) => p.kills },
  { key: "assists", title: "Most assists", blurb: "In one game.", tone: 6, f: (p) => p.assists },
  { key: "damage", title: "Most hero damage", blurb: "In one game.", tone: 1, f: (p) => p.hero_damage, show: k1 },
  { key: "gpm", title: "Highest GPM", blurb: "In one game.", tone: 4, f: (p) => p.gpm },
  { key: "heal", title: "Most healing", blurb: "In one game.", tone: 5, f: (p) => p.hero_healing, show: k1 },
  { key: "wards", title: "Most wards", blurb: "Observers and sentries placed in one game.", tone: 6, f: (p) => (p.obs_placed == null ? null : p.obs_placed + (p.sen_placed ?? 0)) },
  // Stats no other card shows as a single game (Fav, 2026-11-25: "other stats that arent elsewhere").
  { key: "xpm", title: "Highest XPM", blurb: "Experience a minute, in one game.", tone: 2, f: (p) => p.xpm },
  { key: "nw", title: "Richest", blurb: "Highest net worth at the end of one game.", tone: 4, f: (p) => p.net_worth, show: k1 },
  { key: "denies", title: "Most denies", blurb: "In one game.", tone: 2, f: (p) => p.denies },
  { key: "towers", title: "Most building damage", blurb: "In one game.", tone: 2, f: (p) => p.tower_damage, show: k1 },
  { key: "stuns", title: "Most stun time", blurb: "Seconds of disable in one game.", tone: 6, f: (p) => p.stuns, show: (v) => `${v.toFixed(1)}s` },
  { key: "stacks", title: "Most stacks", blurb: "Camps stacked in one game.", tone: 4, f: (p) => p.camps_stacked },
  { key: "dewards", title: "Most dewards", blurb: "Enemy wards destroyed in one game.", tone: 6, f: (p) => (p.obs_killed == null ? null : p.obs_killed + (p.sen_killed ?? 0)) },
  { key: "streak", title: "Longest kill streak", blurb: "Kills without dying, in one game.", tone: 1, f: (p) => { const a = arr(p.streaks); for (let i = a.length - 1; i >= 0; i--) if (a[i]) return i + 3; return null; } },
  { key: "tank", title: "Most damage taken", blurb: "From heroes, in one game.", tone: 5, f: (p) => p.dmg_taken, show: k1 },
];
export function gameRecords(games) {
  return RECORDS.map((r) => {
    const mine = new Map();
    for (const m of games) for (const p of m.players ?? []) {
      const v = r.f(p);
      if (v == null || !Number.isFinite(v) || v <= 0) continue;
      const k = playerKey(p), b = mine.get(k);
      if (!b || v > b.v) mine.set(k, { v, m, p });
    }
    const top = [...mine].sort((a, b) => b[1].v - a[1].v).slice(0, 5).map(([key, { v, m, p }]) => ({ key, p, m, hero: p.hero, team: p.team === "a" ? m.team_a : m.team_b, vs: p.team === "a" ? m.team_b : m.team_a, val: (r.show ?? ((x) => `${Math.round(x)}`))(v) }));
    return { key: `rec-${r.key}`, group: "Records", title: r.title, blurb: r.blurb, tone: r.tone, record: true, top };
  }).filter((r) => r.top.length >= 3);
}
// A player's records: the record boards (gameRecords, for their division and for AD2L) they're in
// the top 5 of, best place first, AD2L before the division at the same place (and a record only
// once). Leaves out what their own cards already show (more: moreOf's result: last hits for a
// core with the last-hits card, assists for a support with the assists card). At most `max`.
// scopes: [{ name, records }]. Returns [{ ...board, scope, rank }].
export function playerRecords(scopes, key, more = null, max = 2) {
  const skip = new Set([...(more?.farm ? ["rec-lh10", "rec-lh"] : []), ...(more?.assists ? ["rec-assists"] : [])]);
  const out = [];
  scopes.forEach((s, si) => { for (const r of s.records ?? []) {
    const i = r.top.findIndex((t) => t.key === key);
    if (i >= 0 && !skip.has(r.key)) out.push({ ...r, scope: s.name, rank: i + 1, si });
  } });
  out.sort((a, b) => a.rank - b.rank || a.si - b.si);
  const seen = new Set();
  return out.filter((r) => !seen.has(r.key) && seen.add(r.key)).slice(0, max);
}
// Board key -> the one-game record on the same stat (RECORDS key), folded into that board.
const BOARD_RECORD = { farm: "gpm", damage: "damage", heal: "heal", stuns: "stuns", wards: "wards", vision: "dewards", map: "stacks", siege: "towers", tank: "tank", lane: "lh10" };
// games: the scope's season games. Returns [{ ...board, top: [{ key, p, team, hero, val }], best? }].
// best: the matching record's top game ({ key, p, m, hero, team, vs, val }).
export function leaderboards(games) {
  const players = parsedPlayers(games);
  const out = BOARDS.map((b) => podium(players, b)).filter((b) => b.top.length);
  // The comeback of the season: the biggest gold deficit a winner came back from.
  let cb = null;
  for (const m of games) {
    const a = arr(m.gold_adv); if (!a.length) continue;
    const s = m.winner === "a" ? 1 : -1, d = -Math.min(0, ...a.map((v) => v * s));
    if (d >= 5000 && (!cb || d > cb.d)) cb = { d, m };
  }
  if (cb) {
    const w = cb.m.winner, team = w === "a" ? cb.m.team_a : cb.m.team_b, lost = w === "a" ? cb.m.team_b : cb.m.team_a;
    const star = cb.m.players.filter((p) => p.team === w).sort((x, y) => (y.net_worth ?? 0) - (x.net_worth ?? 0))[0];
    out.push({ key: "clutch", group: "Clutch", title: "Comeback of the season", tone: 3, game: cb.m, d: cb.d, team, lost, hero: star?.hero ?? null });
  }
  for (const b of MORE_BOARDS) { const x = podium(players, b); if (x.top.length) out.push(x); }
  // A record on the same stat as a board doesn't get its own slide: its top game goes on the board
  // (b.best), so the season average and the one-game best aren't two slides saying the same thing.
  const recs = gameRecords(games), byKey = new Map(recs.map((r) => [r.key, r])), folded = new Set();
  for (const x of out) {
    const r = byKey.get(`rec-${BOARD_RECORD[x.key]}`);
    if (r && x.top) { x.best = r.top[0]; folded.add(r.key); }
  }
  out.push(...recs.filter((r) => !folded.has(r.key)));
  return out;
}

// ---------- team version: around the map ----------
// A team's stacks, runes and smoke kills a game, ranked against the division's teams.
// tgs: Map team id -> [{ m, side }] for every team in the division; id: the team.
export function teamMapOf(tgs, id) {
  const of = (tg) => { const ps = tg.flatMap(({ m, side }) => (m.players ?? []).filter((p) => p.team === side && parsed(p))); return tg.length ? { stacks: sum(ps, (p) => p.camps_stacked) / tg.length, runes: sum(ps, runesOf) / tg.length, smoke: sum(ps, smokeKills) / tg.length, top: (() => { const c = new Map(); for (const p of ps) c.set(p.name, (c.get(p.name) ?? 0) + (p.camps_stacked ?? 0)); return [...c].sort((a, b) => b[1] - a[1])[0] ?? null; })() } : null; };
  const all = [...tgs].filter(([, tg]) => tg.length >= MIN).map(([k, tg]) => [String(k), of(tg)]);
  const me = all.find(([k]) => k === String(id))?.[1];
  if (!me || !me.stacks) return null;
  const rank = (f) => ({ rank: 1 + all.filter(([, x]) => f(x) > f(me)).length, of: all.length });
  return { ...me, ranks: { stacks: rank((x) => x.stacks), runes: rank((x) => x.runes), smoke: rank((x) => x.smoke) } };
}

// ---------- performance (part 2: team, division) ----------
// Their averages ranked among a set of players, on their role's stats (roleStats).
const ranksIn = (field, me) => roleStats(me.pos).map(([name, f]) => { const v = f(me.rows), all = field.map((e) => f(e.rows)); return { name, value: v, rank: 1 + all.filter((x) => x > v).length, of: all.length }; });
// players: parsedPlayers for the division. Null under MIN games.
export function performanceOf(players, key) {
  const me = players.get(key);
  if (!me) return null;
  const team = me.team.name;
  const mates = [...players.values()].filter((e) => team && e.team.name === team);
  // Their share of their side's kills, hero damage and gold, over their games.
  const side = (f) => { let a = 0, b = 0; for (const { m, p } of me.rows) { a += f(p, m) ?? 0; b += sum(m.players.filter((q) => q.team === p.team), (q) => f(q, m)); } return b ? a / b : null; };
  const all = [...players.values()], pos = all.filter((e) => e.pos === me.pos);
  return {
    team: mates.length >= 2 ? { name: team, of: mates.length, ranks: ranksIn(mates, me),
      share: { kills: side((p) => p.kills), damage: side((p) => p.hero_damage), gold: side((p) => p.net_worth) } } : null,
    division: { ranks: ranksIn(all, me), pos: me.pos, posRanks: pos.length >= 3 ? ranksIn(pos, me) : null },
  };
}
