// More Wrapped cards (the ten kept from _dev/wrapped-ideas.html, 2026-11-25): the numbers only;
// pages/wrapped.js draws them. Everything reads parsed replay fields the game pages already use.
// A card's numbers are null when the card wouldn't make sense for that player (a carry with three
// wards gets no vision slide), so a story only carries the slides that say something.
import { playerKey } from "./stats.js";
import { mainTeamOf } from "./wrapped.js";
import { CX, CY } from "./wardmap.js";
import { hotspot, clockRates } from "./team-wrapped.js";
import { RUNES } from "./combat.js";

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
  return { vision: visionOf(rows, R), fight: fightOf(rows, R), early: earlyOf(rows, R), map: mapOf(rows, R),
    clutch: clutchOf(rows), siege: siegeOf(rows, R), hands: handsOf(rows, R), items: itemRaceOf(players, rows) };
}

// Vision: supports (15+ observers). Their spot, how many were never found, and dewards.
function visionOf(rows, R) {
  const w = obsOf(rows);
  if (w.length < 15) return null;
  const spot = hotspot(w.map((o) => [o.x, o.y]), 5), dw = sum(rows, ({ p }) => dewards(p));
  const g = best(rows, dewards);
  return { wards: w, total: w.length, spot, unfound: w.filter((o) => !o.killed).length / w.length, dewards: dw,
    bestNight: dewards(g.p) ? { n: dewards(g.p), hero: g.p.hero } : null,
    rank: R((rs) => { const x = obsOf(rs); return x.length >= 10 ? x.length / rs.length : null; }) };
}
// In the fight: fights joined, stun time, damage soaked, and where their teamfight deaths bunch up.
function fightOf(rows, R) {
  const tf = rows.filter(({ p }) => p.tf_part != null);
  if (tf.length < MIN) return null;
  const pts = deathSpots(rows), spot = pts.length >= 4 ? hotspot(pts, 9) : null;
  return { share: per(tf, ({ p }) => p.tf_part), stuns: sum(rows, ({ p }) => p.stuns), soaked: sum(rows, ({ p }) => p.dmg_taken),
    rank: R((rs) => { const x = rs.filter(({ p }) => p.tf_part != null); return x.length ? per(x, ({ p }) => p.tf_part) : null; }),
    stunRank: R((rs) => per(rs, ({ p }) => p.stuns)),
    deaths: spot && spot.n >= 3 ? { pts, spot } : null };
}
// Early game: the five-minute stretch with most of their kills, first bloods drawn and suffered.
function earlyOf(rows, R) {
  const ks = rows.flatMap(({ p }) => arr(p.kill_t));
  if (ks.length < 8) return null;
  const bins = Array(9).fill(0);
  for (const t of ks) bins[Math.min(8, Math.max(0, Math.floor(t / 300)))]++;
  const { mins, rate, peak } = clockRates(bins, rows.map(({ m }) => m.duration_sec));
  return { bins, mins, rate, peak, total: ks.length, early: ks.filter((t) => t < 900).length / ks.length,
    fb: sum(rows, ({ p }) => p.first_blood), fd: sum(rows, ({ p }) => p.first_death),
    fbRank: R((rs) => sum(rs, ({ p }) => p.first_blood)) };
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
  return { apm: per(r, ({ p }) => p.apm), actions: sum(r, ({ m, p }) => (p.apm * m.duration_sec) / 60), top: { apm: g.p.apm, hero: g.p.hero },
    pings: sum(r, ({ p }) => p.pings), perGame: per(r, ({ p }) => p.pings), loudest: pg.p.pings ? { n: pg.p.pings, hero: pg.p.hero } : null,
    rank: R((rs) => per(rs, ({ p }) => p.apm)), pingRank: R((rs) => per(rs, ({ p }) => p.pings)) };
}
// Item race: the item they finished furthest ahead of the division's usual time (2+ builds, an item
// the division usually finishes after 12:00). Null when they're not ahead on anything by a minute.
function itemRaceOf(players, rows) {
  const times = (rs) => { const t = new Map(); for (const { p } of rs) { const a = arr(p.item_times); for (let i = 0; i + 1 < a.length; i += 2) { if (!t.has(a[i])) t.set(a[i], []); t.get(a[i]).push(a[i + 1]); } } return t; };
  const lg = times([...players.values()].flatMap((e) => e.rows)), mine = times(rows);
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
  return b && b.gain >= 60 ? b : null;
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
// games: the scope's season games. Returns [{ ...board, top: [{ key, p, team, hero, val }] }].
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
