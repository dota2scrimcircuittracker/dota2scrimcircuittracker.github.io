// Team histories, from the same match list the other pages use. Works for both leagues:
// scrim teams are identified by name (case-insensitive); AD2L games also carry PlayOn
// team ids (team_a_id / team_b_id), which are preferred when present.
import { hasDetails } from "./stats.js";

export const teamSlug = (name) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team";

// Which side (a/b) a team played in a match, or null.
export function sideOf(m, team) {
  if (team.id != null && m.team_a_id != null) return m.team_a_id === team.id ? "a" : m.team_b_id === team.id ? "b" : null;
  const k = team.name.trim().toLowerCase();
  return m.team_a.trim().toLowerCase() === k ? "a" : m.team_b.trim().toLowerCase() === k ? "b" : null;
}

// Every team that appears in the matches (plus any given roster teams with no games yet).
export function listTeams(matches, rosterTeams = []) {
  const map = new Map();
  const add = (name, id = null) => {
    const key = id != null ? `id:${id}` : name.trim().toLowerCase();
    if (!map.has(key)) map.set(key, { key, id, name: name.trim(), slug: id != null ? String(id) : teamSlug(name) });
    return map.get(key);
  };
  for (const t of rosterTeams) add(t.name, t.id);
  for (const m of matches) { add(m.team_a, m.team_a_id ?? null); add(m.team_b, m.team_b_id ?? null); }
  return [...map.values()].map((t) => ({ ...t, ...record(matches, t) })).sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
}

export function record(matches, team) {
  let wins = 0, losses = 0;
  for (const m of matches) {
    const s = sideOf(m, team);
    if (!s) continue;
    m.winner === s ? wins++ : losses++;
  }
  return { wins, losses, games: wins + losses };
}

// Scrim standings: one row per team, ranked by game wins, then fewest losses, then name.
// Private games count (they carry teams, winner and kill score). `form` is the last five
// results, oldest first; `streak` is the current run, e.g. "W3".
export function standingsRows(matches) {
  return listTeams(matches).map((t) => {
    const games = matches.map((m) => ({ m, side: sideOf(m, t) })).filter((x) => x.side)
      .sort((a, b) => (a.m.createdAt ?? 0) - (b.m.createdAt ?? 0));
    const results = games.map(({ m, side }) => (m.winner === side ? "W" : "L"));
    let diff = 0;
    for (const { m, side } of games) diff += side === "a" ? m.score_a - m.score_b : m.score_b - m.score_a;
    let run = 0;
    while (run < results.length && results[results.length - 1 - run] === results.at(-1)) run++;
    return {
      team: t.name, slug: t.slug, games: t.games, wins: t.wins, losses: t.losses,
      win_rate: t.games ? t.wins / t.games : null,
      kill_diff: t.games ? diff / t.games : null,
      form: results.slice(-5),
      streak: run ? `${results.at(-1)}${run}` : "",
      last: games.at(-1)?.m.createdAt ?? null,
    };
  });
}

// Full history for one team: its games (newest first), plus aggregates.
export function teamHistory(matches, team) {
  const games = matches.map((m) => ({ m, side: sideOf(m, team) })).filter((x) => x.side)
    .sort((a, b) => (b.m.createdAt ?? 0) - (a.m.createdAt ?? 0));
  const rec = record(matches, team);
  const minutes = games.reduce((s, { m }) => s + m.duration_sec / 60, 0);
  const killsFor = games.reduce((s, { m, side }) => s + (side === "a" ? m.score_a : m.score_b), 0);
  const killsAgainst = games.reduce((s, { m, side }) => s + (side === "a" ? m.score_b : m.score_a), 0);

  // Hero pool and players: only games with details (private scrims are results only).
  const detailed = games.filter(({ m }) => hasDetails(m));
  const heroes = new Map(), players = new Map();
  for (const { m, side } of detailed) {
    const won = m.winner === side;
    for (const p of m.players.filter((q) => q.team === side)) {
      const h = heroes.get(p.hero) ?? { hero: p.hero, picks: 0, wins: 0 };
      h.picks++; if (won) h.wins++;
      heroes.set(p.hero, h);
      const key = p.player_key ?? p.name.trim().toLowerCase();
      const pl = players.get(key) ?? { key, name: p.name, account_id: p.account_id ?? null, games: 0, wins: 0, standin: false, kills: 0, deaths: 0, assists: 0, positions: {}, heroes: {} };
      pl.games++; if (won) pl.wins++; if (p.standin) pl.standin = true;
      pl.kills += p.kills ?? 0; pl.deaths += p.deaths ?? 0; pl.assists += p.assists ?? 0;
      if (p.position) pl.positions[p.position] = (pl.positions[p.position] ?? 0) + 1;
      const ph = (pl.heroes[p.hero] ??= { hero: p.hero, games: 0, wins: 0 });
      ph.games++; if (won) ph.wins++;
      players.set(key, pl);
    }
  }

  // Draft tendencies (games with a draft): what they ban, and what gets banned against them.
  const bans = new Map(), bannedAgainst = new Map();
  let drafted = 0;
  for (const { m, side } of detailed) {
    if (!m.draft?.length) continue;
    drafted++;
    for (const s of m.draft.filter((x) => !x.pick)) {
      const target = s.side === side ? bans : bannedAgainst;
      target.set(s.hero, (target.get(s.hero) ?? 0) + 1);
    }
  }
  const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([hero, n]) => ({ hero, n }));

  // Head-to-head: record against each opponent (every game, private ones included).
  const opp = new Map();
  for (const { m, side } of games) {
    const o = side === "a" ? { name: m.team_b, id: m.team_b_id ?? null } : { name: m.team_a, id: m.team_a_id ?? null };
    const k = o.id != null ? `id:${o.id}` : o.name.trim().toLowerCase();
    const r = opp.get(k) ?? { ...o, games: 0, wins: 0, last: null };
    r.games++; if (m.winner === side) r.wins++;
    r.last ??= m.createdAt ?? null; // games are newest first
    opp.set(k, r);
  }

  // Players: KDA, their usual position (most games there) and heroes, most played first.
  const playerList = [...players.values()].map(({ positions, heroes: hs, ...pl }) => ({
    ...pl,
    kda: (pl.kills + pl.assists) / Math.max(1, pl.deaths),
    position: Number(Object.entries(positions).sort((a, b) => b[1] - a[1])[0]?.[0]) || null,
    heroes: Object.values(hs).sort((a, b) => b.games - a.games || b.wins - a.wins || a.hero.localeCompare(b.hero)),
  }));

  return {
    wins: rec.wins,
    losses: rec.losses,
    played: rec.games, // count; `games` below is the list
    win_rate: rec.games ? rec.wins / rec.games : null,
    avg_minutes: games.length ? minutes / games.length : null,
    avg_kills_for: games.length ? killsFor / games.length : null,
    avg_kills_against: games.length ? killsAgainst / games.length : null,
    private_games: games.length - detailed.length,
    games,
    detailed: detailed.map((x) => x.m),
    heroes: [...heroes.values()].sort((a, b) => b.picks - a.picks || b.wins - a.wins || a.hero.localeCompare(b.hero)),
    players: playerList.sort((a, b) => b.games - a.games || a.name.localeCompare(b.name)),
    opponents: [...opp.values()].sort((a, b) => b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name)),
    drafted,
    bans: top(bans),
    banned_against: top(bannedAgainst),
  };
}

// AD2L records from PlayOn's series scores (official; complete even when a game's stats
// couldn't be found): team id -> { wins, losses, games }, in games.
export function seriesRecords(series) {
  const out = new Map();
  for (const s of series) for (const [id, us, them] of [[s.home, s.home_score, s.away_score], [s.away, s.away_score, s.home_score]]) {
    if (id == null) continue;
    const r = out.get(id) ?? out.set(id, { wins: 0, losses: 0, games: 0 }).get(id);
    r.wins += us ?? 0; r.losses += them ?? 0; r.games = r.wins + r.losses;
  }
  return out;
}
