// Combat and fun stats (AD2L parsed replays; scrim screenshots have none of these). Each game
// player can carry, from scripts/sync/combat-fields.js:
//   apm, tf_part (0-1 share of the team's teamfights), first_blood (1 = drew it),
//   multi [double, triple, ultra, rampage], streaks [times reaching 3 … 10+ kills without dying],
//   kill_t [second of each hero kill], runes [count per RUNES type], courier_kills,
//   max_hit [damage, ability/item key or null, target hero slug], pings,
//   bench [public percentile per BENCH stat, 0-100]
// and each game `pauses` (flat [second, length, ...]). This file also holds the team, hero and
// division numbers built from data the site already had (sides, stand-ins, game length, lead at
// a minute, fights, first blood, aegis steals, pairs, neutral items, pub practice).
import { hasDeaths, deathsOf } from "./deathmap.js";
import { fightsOf } from "./itemlead.js";
import { HERO_META } from "./hero-meta.js";
import { playerKey, hasDetails } from "./stats.js";

export const hasCombat = (p) => p.apm != null;
export const MULTI = ["Double kill", "Triple kill", "Ultra kill", "Rampage"];
// In-game kill-streak announcements, 3 kills without dying and up (10+ is "Beyond Godlike").
export const STREAKS = ["Killing Spree", "Dominating", "Mega Kill", "Unstoppable", "Wicked Sick", "Monster Kill", "Godlike", "Beyond Godlike"];
export const streakName = (n) => (n >= 3 ? STREAKS[Math.min(n, 10) - 3] : null);
// OpenDota's rune ids, in the order `runes` counts them.
export const RUNES = ["Double Damage", "Haste", "Illusion", "Invisibility", "Regeneration", "Bounty", "Arcane", "Water", "Wisdom", "Shield"];
// The benchmarks kept by the sync, in `bench` order.
export const BENCH = ["GPM", "XPM", "Kills / min", "Assists / min", "Last hits / min", "Hero damage / min", "Building damage"];
// Two kills this close (seconds) chain into a multi-kill. Fitted to OpenDota's own counts: 18s
// reproduces them for 86% of players; the rest differ by one (kill logs include the odd kill
// the counts don't). The counts (`multi`) are used for totals; this only places them in time.
export const MULTI_WINDOW = 18;

const heroBySlug = new Map(HERO_META.map(([, name, slug]) => [slug, name]));
export const heroOfSlug = (slug) => heroBySlug.get(slug) ?? null;
// "void_spirit_dissimilate" -> "Dissimilate" (the hero's own prefix dropped); items by name.
export function hitSource(key, itemName = (k) => k) {
  if (!key) return "Right-click";
  const slug = [...heroBySlug.keys()].filter((s) => key.startsWith(`${s}_`)).sort((a, b) => b.length - a.length)[0];
  const rest = slug ? key.slice(slug.length + 1) : null;
  if (!rest) return itemName(key);
  return rest.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const addArr = (into, xs) => { if (xs) xs.forEach((v, i) => (into[i] = (into[i] ?? 0) + v)); return into; };

// Highest streak the player reached in one game: OpenDota's streak counts when they reach 3+
// (10+ read off the kill log for the real number), else what the kill log shows (0-2).
export function bestStreakOf(m, i) {
  const p = m.players[i];
  if (!p.streaks && !p.kill_t) return null;
  const top = p.streaks ? p.streaks.findLastIndex((n) => n > 0) : -1;
  if (top >= 0 && top < 7) return top + 3;
  const runs = streakRuns(m, i);
  const peak = Math.max(0, ...runs.runs.map((r) => r.peak));
  return top === 7 ? Math.max(10, peak) : Math.min(peak, 2);
}

// One player's kill streaks in a game, from kill_t and their deaths: the running count after
// each kill or death (points), and each run of 1+ kills (runs: start, end, peak, the kills, how
// it ended: killer index (0-9), a death code (-1 tower … -4 Roshan, as death_log) or null if they
// were alive at the end).
export function streakRuns(m, i) {
  const p = m.players[i];
  const kills = [...(p.kill_t ?? [])].sort((a, b) => a - b);
  const deaths = [];
  const a = p.death_log ?? [];
  for (let j = 0; j + 5 < a.length; j += 6) deaths.push({ t: a[j], killer: a[j + 1] });
  // A kill and a death in the same second: the kill first (traded, then died).
  const ev = [...kills.map((t) => ({ t, kill: true })), ...deaths.map((d) => ({ ...d, kill: false }))].sort((x, y) => x.t - y.t || y.kill - x.kill);
  const points = [], runs = [];
  let cur = 0, run = null;
  for (const e of ev) {
    if (e.kill) {
      cur++;
      run ??= { start: e.t, kills: [], peak: 0 };
      run.kills.push(e.t);
      run.peak = cur; run.peakT = e.t;
    } else {
      if (run) { run.end = e.t; run.endedBy = e.killer; runs.push(run); run = null; }
      cur = 0;
    }
    points.push([e.t, cur]);
  }
  if (run) { run.end = null; run.endedBy = null; runs.push(run); }
  return { points, runs };
}

// Multi-kills placed in time: chains of kills each within MULTI_WINDOW of the last, 2+ long.
export function multiKillsOf(p) {
  const t = [...(p.kill_t ?? [])].sort((a, b) => a - b), out = [];
  let chain = t.length ? [t[0]] : [];
  for (let j = 1; j <= t.length; j++) {
    if (j < t.length && t[j] - t[j - 1] <= MULTI_WINDOW) { chain.push(t[j]); continue; }
    if (chain.length >= 2) out.push({ t: chain[0], end: chain.at(-1), n: chain.length });
    chain = j < t.length ? [t[j]] : [];
  }
  return out;
}

// First blood: who drew it, when and on whom (player indexes). From the game's first_blood_at
// when the sync stored it; else the player flagged first_blood, at their first kill (or the
// earliest kill), with the victim from the death log. Null without kill logs.
export function firstBloodOf(m) {
  const at = m.first_blood_at;
  if (Array.isArray(at) && m.players?.[at[1]]) return { i: at[1], team: m.players[at[1]].team, t: at[0], victim: at[2] >= 0 ? at[2] : null };
  if (!m.players?.some((p) => Array.isArray(p.kill_t))) return null;
  let i = m.players.findIndex((p) => p.first_blood === 1);
  const first = (p) => Math.min(...(p.kill_t?.length ? p.kill_t : [Infinity]));
  if (i < 0 || !m.players[i].kill_t?.length) {
    i = m.players.reduce((best, p, j) => (first(p) < first(m.players[best]) ? j : best), 0);
    if (first(m.players[i]) === Infinity) return null;
  }
  const t = first(m.players[i]);
  const victim = hasDeaths(m) ? deathsOf(m).find((d) => d.killer === i && Math.abs(d.t - t) <= 1) : null;
  return { i, team: m.players[i].team, t, victim: victim ? victim.i : null };
}

// ---------- deaths by source ----------
export const DEATH_SOURCES = [["hero", "Heroes"], ["tower", "Towers & fountain"], ["creep", "Lane creeps"], ["neutral", "Neutrals"], ["other", "Roshan & other"]];
const SOURCE_OF = { "-1": "tower", "-2": "creep", "-3": "neutral", "-4": "other" };
// A full death log records gold lost. Games whose log was rebuilt from kill logs only have
// deaths to heroes, so they'd overstate how often someone dies to a hero; they're skipped.
export const fullDeathLog = (m) => hasDeaths(m) && m.players.some((p) => { const a = p.death_log; for (let j = 2; j < a.length; j += 6) if (a[j] >= 0) return true; return false; });

// Deaths by source over the player-games matching match(p, m): counts, per game, and the
// heroes that killed them most.
export function deathSources(matches, match) {
  const by = Object.fromEntries(DEATH_SOURCES.map(([k]) => [k, 0])), killers = new Map();
  let games = 0, skipped = 0;
  for (const m of matches) {
    if (!hasDetails(m)) continue;
    const mine = m.players.map((p, i) => [p, i]).filter(([p]) => match(p, m));
    if (!mine.length) continue;
    if (!fullDeathLog(m)) { skipped += mine.length; continue; }
    games += mine.length;
    for (const [p] of mine) {
      const a = p.death_log;
      for (let j = 0; j + 5 < a.length; j += 6) {
        const k = a[j + 1];
        if (k >= 0) {
          by.hero++;
          const h = m.players[k]?.hero;
          if (h) killers.set(h, (killers.get(h) ?? 0) + 1);
        } else by[SOURCE_OF[k] ?? "other"]++;
      }
    }
  }
  const deaths = sum(Object.values(by));
  return { games, skipped, deaths, by, per_game: games ? deaths / games : null,
    killers: [...killers].map(([hero, n]) => ({ hero, n })).sort((a, b) => b.n - a.n || a.hero.localeCompare(b.hero)) };
}

// Average public percentile per BENCH stat over some player-games ({ p }), and how many had one.
export function benchSummary(ps) {
  const withB = ps.filter((p) => Array.isArray(p.bench));
  if (!withB.length) return null;
  return {
    games: withB.length,
    avg: BENCH.map((_, k) => { const v = withB.map((p) => p.bench[k]).filter((x) => x != null); return v.length ? sum(v) / v.length : null; }),
  };
}

// Totals over some player-games: multi-kills, streak levels, runes by type.
export function combatTotals(ps) {
  const c = ps.filter(hasCombat);
  return {
    games: c.length,
    multi: c.reduce((t, p) => addArr(t, p.multi), [0, 0, 0, 0]),
    streaks: c.reduce((t, p) => addArr(t, p.streaks), Array(8).fill(0)),
    runes: c.reduce((t, p) => addArr(t, p.runes), Array(10).fill(0)),
  };
}

// ---------- teams ----------
// rec: { games, wins }
const rec = () => ({ games: 0, wins: 0 });
const tally = (r, won) => { r.games++; if (won) r.wins++; };
export const LENGTHS = [["Under 30'", 0, 30], ["30–45'", 30, 45], ["45'+", 45, Infinity]];
// Team A's gold lead at a minute, or null if the game (series) was shorter.
const leadAtMin = (m, min) => (Array.isArray(m.gold_adv) && m.gold_adv.length > min ? m.gold_adv[min] : null);

// A team's record split every way the overview and gold sections show, over its games with a
// side (sideOf(m) -> "a" / "b" / null). Private scrims count where they can (side, length).
export function teamSplits(games, sideOf) {
  const out = {
    sides: { a: rec(), b: rec() }, standin: { with: rec(), without: rec() },
    length: LENGTHS.map(([label]) => ({ label, ...rec() })),
    lead: Object.fromEntries([10, 20, 30].map((t) => [t, { ahead: rec(), behind: rec() }])),
    fights: { won: 0, lost: 0, even: 0, games: 0 },
    first_blood: { games: 0, taken: 0, wins_taken: 0, wins_given: 0, times: [] },
    aegis: { stole: 0, lost: 0 },
  };
  for (const m of games) {
    const side = sideOf(m);
    if (!side) continue;
    const won = m.winner === side, sign = side === "a" ? 1 : -1;
    tally(out.sides[side], won);
    const min = m.duration_sec / 60;
    tally(out.length[LENGTHS.findIndex(([, lo, hi]) => min >= lo && min < hi)], won);
    if (hasDetails(m)) tally(out.standin[m.players.some((p) => p.team === side && p.standin) ? "with" : "without"], won);
    for (const t of [10, 20, 30]) {
      const v = leadAtMin(m, t);
      if (v) tally(out.lead[t][v * sign > 0 ? "ahead" : "behind"], won);
    }
    if (Array.isArray(m.fights) && hasDeaths(m)) {
      out.fights.games++;
      for (const f of fightsOf(m)) out.fights[f.won == null ? "even" : f.won === side ? "won" : "lost"]++;
    }
    const fb = hasDetails(m) ? firstBloodOf(m) : null;
    if (fb) {
      out.first_blood.games++;
      if (fb.team === side) { out.first_blood.taken++; out.first_blood.times.push(fb.t); if (won) out.first_blood.wins_taken++; }
      else if (won) out.first_blood.wins_given++;
    }
    for (const o of m.objectives ?? []) if (o.type === "aegis_stolen") out.aegis[o.side === side ? "stole" : "lost"]++;
  }
  const f = out.fights;
  f.total = f.won + f.lost + f.even;
  f.win_rate = f.won + f.lost ? f.won / (f.won + f.lost) : null;
  return out;
}

// Pairs of players who played together for the team, and full five-player lineups: games and
// wins, most games first. Names are the latest seen for each player.
export function playerPairs(games, sideOf) {
  const pairs = new Map(), lineups = new Map(), names = new Map();
  for (const m of games) {
    const side = sideOf(m);
    if (!side || !hasDetails(m)) continue;
    const won = m.winner === side;
    const ps = m.players.filter((p) => p.team === side).map((p) => ({ key: playerKey(p), p })).sort((a, b) => a.key.localeCompare(b.key));
    for (const { key, p } of ps) names.set(key, p);
    for (let x = 0; x < ps.length; x++) for (let y = x + 1; y < ps.length; y++) {
      const k = `${ps[x].key}|${ps[y].key}`;
      tally(pairs.get(k) ?? pairs.set(k, { keys: [ps[x].key, ps[y].key], ...rec() }).get(k), won);
    }
    const lk = ps.map((q) => q.key).join("|");
    tally(lineups.get(lk) ?? lineups.set(lk, { keys: ps.map((q) => q.key), ...rec() }).get(lk), won);
  }
  const named = (r) => ({ ...r, players: r.keys.map((k) => names.get(k)), win_rate: r.wins / r.games });
  const order = (a, b) => b.games - a.games || b.wins - a.wins;
  return { pairs: [...pairs.values()].map(named).sort(order), lineups: [...lineups.values()].map(named).sort(order) };
}

// ---------- division ----------
// Radiant's record over games with a draft (ticketed AD2L: team A is Radiant).
export function sideRecord(matches) {
  const r = rec();
  for (const m of matches) if (m.draft?.length) tally(r, m.winner === "a");
  return { ...r, win_rate: r.games ? r.wins / r.games : null };
}

// The team that drew first blood: how often it won.
export function firstBloodRecord(matches) {
  const r = rec();
  for (const m of matches) { const fb = hasDetails(m) ? firstBloodOf(m) : null; if (fb) tally(r, m.winner === fb.team); }
  return { ...r, win_rate: r.games ? r.wins / r.games : null };
}

// ---------- heroes ----------
// Every hero seen with and against `hero`: games together and the hero's wins in them.
export function heroPairs(matches, hero) {
  const allies = new Map(), enemies = new Map();
  const add = (map, h, won) => tally(map.get(h) ?? map.set(h, { hero: h, ...rec() }).get(h), won);
  for (const m of matches) {
    if (!hasDetails(m)) continue;
    const me = m.players.find((p) => p.hero === hero);
    if (!me) continue;
    const won = m.winner === me.team;
    for (const p of m.players) if (p !== me) add(p.team === me.team ? allies : enemies, p.hero, won);
  }
  const list = (map) => [...map.values()].map((r) => ({ ...r, win_rate: r.wins / r.games })).sort((a, b) => b.games - a.games || b.wins - a.wins);
  return { allies: list(allies), enemies: list(enemies) };
}

// Neutral items held at the end of games on `hero` (the items' 7th slot): games and wins.
export function heroNeutrals(matches, hero) {
  const out = new Map();
  for (const m of matches) {
    if (!hasDetails(m)) continue;
    for (const p of m.players) {
      const key = p.hero === hero ? p.items?.[6] : null;
      if (key) tally(out.get(key) ?? out.set(key, { key, ...rec() }).get(key), m.winner === p.team);
    }
  }
  return [...out.values()].map((r) => ({ ...r, win_rate: r.wins / r.games })).sort((a, b) => b.games - a.games || b.wins - a.wins);
}

// Skill builds (lists of ability ids in level-up order) -> a grid: one row per ability (every
// talent in one "Talents" row, each cell remembering which), and per level the share of builds
// that took it then. `named(id)` -> [key, name] or null. Also the most common first 10 levels.
export function skillGrid(builds, named, levels = 18) {
  const list = builds.filter((b) => Array.isArray(b) && b.length);
  if (!list.length) return null;
  const isTalent = (id) => /^special_bonus/.test(named(id)?.[0] ?? "") && named(id)[0] !== "special_bonus_attributes";
  const rows = new Map();
  const rowOf = (id) => (isTalent(id) ? "talent" : String(id));
  for (const b of list) b.slice(0, levels).forEach((id, lv) => {
    const k = rowOf(id);
    const r = rows.get(k) ?? rows.set(k, { id: k === "talent" ? null : id, talent: k === "talent", cells: Array.from({ length: levels }, () => ({ n: 0, picks: new Map() })), total: 0 }).get(k);
    const c = r.cells[lv];
    c.n++; r.total++;
    c.picks.set(id, (c.picks.get(id) ?? 0) + 1);
  });
  // Rows in the order they're first taken (on average), talents last.
  const firstAt = (r) => { const i = r.cells.findIndex((c) => c.n / list.length >= 0.25); return i < 0 ? 99 : i; };
  const out = [...rows.values()].sort((a, b) => a.talent - b.talent || firstAt(a) - firstAt(b) || b.total - a.total)
    .map((r) => ({ ...r, name: r.talent ? "Talents" : named(r.id)?.[1] ?? `Ability ${r.id}`, key: r.talent ? null : named(r.id)?.[0] ?? null,
      cells: r.cells.map((c) => ({ share: c.n / list.length, n: c.n, picks: [...c.picks].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n, name: named(id)?.[1] ?? `Ability ${id}` })) })) }));
  const seqs = new Map();
  for (const b of list) { const k = b.slice(0, 10).map(rowOf).join(","); seqs.set(k, (seqs.get(k) ?? 0) + 1); }
  const [common, n] = [...seqs].sort((a, b) => b[1] - a[1])[0];
  return { builds: list.length, levels, rows: out, common: { seq: common.split(","), n } };
}

// ---------- players ----------
// Pub practice: of a player's league games inside the pub window, the ones on a hero they'd
// played in pubs in the `days` before, against the rest. pubs: flat groups of 7 (start time,
// hero, won, k, d, a, ranked), as the division file keeps them.
export function pubPrep(pubs, games, since, days = 7) {
  const rows = [];
  for (let j = 0; j + 6 < (pubs?.length ?? 0); j += 7) rows.push({ t: pubs[j], hero: pubs[j + 1] });
  const out = { practiced: rec(), fresh: rec(), heroes: new Map() };
  for (const { m, p, won } of games) {
    const t = m.start_time ?? (m.createdAt ? +m.createdAt / 1000 : null);
    if (t == null || t < since + days * 86400) continue; // the pub log doesn't reach back far enough
    const n = rows.filter((r) => r.hero === p.hero && r.t < t && r.t >= t - days * 86400).length;
    tally(out[n ? "practiced" : "fresh"], won);
    if (n) { const h = out.heroes.get(p.hero) ?? out.heroes.set(p.hero, { hero: p.hero, pubs: 0, ...rec() }).get(p.hero); h.pubs += n; tally(h, won); }
  }
  return { ...out, heroes: [...out.heroes.values()].sort((a, b) => b.games - a.games), games: out.practiced.games + out.fresh.games };
}

// A PlayOn / OpenDota medal (rank_tier 11-80) on one scale: Herald 1 = 1 … Divine 5 = 35,
// Immortal = 36.
export const medalValue = (r) => (r == null || r < 10 ? null : r >= 80 ? 36 : (Math.floor(r / 10) - 1) * 5 + (r % 10));

// Rating against medal: a straight line fitted through every player, and each player's gap
// from it (positive = rated higher than players of that medal usually are).
export function medalFit(points) {
  const ps = points.filter((p) => p.medal != null && p.rating != null);
  if (ps.length < 3) return null;
  const mx = sum(ps.map((p) => p.medal)) / ps.length, my = sum(ps.map((p) => p.rating)) / ps.length;
  const sxx = sum(ps.map((p) => (p.medal - mx) ** 2));
  const slope = sxx ? sum(ps.map((p) => (p.medal - mx) * (p.rating - my))) / sxx : 0;
  const at = (x) => my + slope * (x - mx);
  return { slope, at, points: ps.map((p) => ({ ...p, gap: p.rating - at(p.medal) })) };
}

// Pauses in a game: count and total seconds.
export function pausesOf(m) {
  const a = m.pauses;
  if (!Array.isArray(a)) return null;
  let n = 0, total = 0;
  for (let j = 0; j + 1 < a.length; j += 2) { n++; total += a[j + 1]; }
  return { n, total };
}
