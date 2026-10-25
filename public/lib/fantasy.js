import { withAnnounced, isPostseason, SEASON } from "./divisions.js";
import { tierModels, gamePointsAt, LIVE } from "./tiers.js";

// Fantasy league, one per AD2L division, over the playoffs. Each week you pick five of that
// league's rostered players, one per position (slot 1–5), from teams with a series that week;
// picks lock at the week's first series start. A pick scores the tier model's game score (no bell
// curve) with every game read as the slot's position, and only their best two games of the week
// count, added together (a Bo3: the best two of three). You can pick yourself and your teammates.
// The leaderboard is the playoffs so far.
// The test week (TEST_WEEK): week 8's tiebreakers, one Fantasy across every division that plays
// one, stored under the league key "all".
//
// Pure functions over the league's data file (`teams`, `series`) and its games, so they run in the
// Node tests. Entries come from lib/store.js (listFantasy); sign-in from workers/steam-auth.

export const SLOTS = [1, 2, 3, 4, 5];
export const GAMES_COUNTED = 2;
// The first Fantasy week, a test: the week 8 tiebreakers of these divisions (lib/divisions.js
// ANNOUNCED), picked and scored as one league. New season: null.
export const TEST_WEEK = { key: "2026-10-12", league: "all", leagues: ["challenger", "ad2l", "heroic"] };

// A game's fantasy score is the playoff tier model's score for it, before the rating curve: the
// pick's stat points in the slot's position (whatever they played) x survival x consistency x
// opponents, plus winning. Each division is scored against its own games. Models are made once
// per game list.
const round1 = (x) => Math.round(x * 10) / 10;
const ctxMemo = new WeakMap();
function leagueCtx(matches, league) {
  const all = ctxMemo.get(matches) ?? ctxMemo.set(matches, new Map()).get(matches);
  const k = league ?? "";
  if (!all.has(k)) {
    const games = matches.filter((m) => (m.league ?? "") === k);
    all.set(k, { games, models: tierModels(games, { version: LIVE }) });
  }
  return all.get(k);
}

// Weeks run Monday 00:00 UTC to the next Monday; a week's key is that Monday's date, so it's the
// same in every time zone.
export function weekKey(t) {
  const d = new Date(t * 1000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))).toISOString().slice(0, 10);
}

// The league's weeks, oldest first: { key, lock (first series start, unix s), series, seriesIds,
// teams (team ids with a series that week) }.
export function fantasyWeeks(series) {
  const by = new Map();
  for (const s of series ?? []) {
    if (!s.time) continue;
    const k = weekKey(s.time);
    const w = by.get(k) ?? by.set(k, { key: k, lock: Infinity, series: [], seriesIds: new Set(), teams: new Set() }).get(k);
    w.series.push(s); w.seriesIds.add(s.id); w.lock = Math.min(w.lock, s.time);
    for (const t of [s.home, s.away]) if (t != null) w.teams.add(t);
  }
  return [...by.values()].sort((a, b) => a.lock - b.lock);
}

// Restrict later weeks to the division's playoff bracket. The shared test only includes
// its tiebreaker week; it remains available to review after it has ended.
// A series PlayOn dates days before its playoff night (Challenger's Castaway Baes v SUX, Sun
// Oct 18 US) belongs to that night's week and doesn't lock it early: it counts at the night's
// start (Thursday night US = Fri 01:00 UTC). Only within 5 days of it, so the week before's
// tiebreakers stay in their own week.
const nightStarts = (SEASON.playoffNights ?? []).map((n) => Date.parse(`${n}T00:00:00Z`) / 1000 + 25 * 3600);
export function onNight(s) {
  const n = nightStarts.find((t) => t >= s.time - 12 * 3600);
  return n != null && s.time < n && s.time > n - 5 * 86400 ? { ...s, time: n } : s;
}
// A week that locks before its first series start (a game moved earlier than PlayOn shows, or one
// onNight would move to the playoff night), per league: week key -> unix seconds. The earlier of
// the two counts. New season: empty it.
export const LOCK_EARLY = {
  conqueror: { "2026-10-26": Date.UTC(2026, 9, 27, 1) / 1000 }, // Monday 10/26 9pm ET: a game moved up from Thursday
};
export function playoffWeeks(league, series) {
  return fantasyWeeks(withAnnounced(league, series).filter((s) => isPostseason(s)).map(onNight)
    .filter((s) => !TEST_WEEK || weekKey(s.time) > TEST_WEEK.key))
    .map((w) => ({ ...w, league, lock: Math.min(w.lock, LOCK_EARLY[league]?.[w.key] ?? Infinity) }));
}
export function testWeek(divisions) {
  if (!TEST_WEEK) return null;
  const series = divisions.filter((d) => TEST_WEEK.leagues.includes(d.key)).flatMap((d) =>
    withAnnounced(d.key, d.series).filter((s) => isPostseason(s) && weekKey(s.time) === TEST_WEEK.key));
  const w = fantasyWeeks(series)[0];
  return w ? { ...w, league: TEST_WEEK.league } : null;
}

// The week open for picks at `now` (unix s): the first whose lock is still ahead. null if PlayOn
// hasn't posted one.
export const openWeek = (weeks, now) => weeks.find((w) => w.lock > now) ?? null;

// Who can be picked in `week`: every rostered player of a team playing that week, the picker
// included. [{ account, name, team, team_id }]
export function pickable(teams, week) {
  return (teams ?? []).filter((t) => week.teams.has(t.id)).flatMap((t) => t.players
    .filter((p) => p.account_id)
    .map((p) => ({ account: p.account_id, name: p.name, team: t.name, team_id: t.id })));
}

// Why `picks` (five account ids, slot 1 first) can't be saved, or null if they can.
export function checkPicks(picks, pool) {
  if (!Array.isArray(picks) || picks.length !== SLOTS.length || picks.some((a) => !Number.isInteger(a))) return "Pick a player for every position.";
  if (new Set(picks).size !== picks.length) return "Each player can fill one position only.";
  const ok = new Set(pool.map((p) => p.account));
  if (picks.some((a) => !ok.has(a))) return "Every pick must be on a team that plays this week.";
  return null;
}

// The week's games: those of its series, or (a series PlayOn hadn't posted, see
// divisions.js ANNOUNCED) played that week between two of its teams, or (a series played before
// its date: Champion's No Immortals v Piranhas, dated Oct 23, played Oct 16) unlinked games
// between a scored series' two teams in the 8 days before the lock.
export function weekGames(matches, week) {
  const done = (week.series ?? []).filter((s) => (s.home_score ?? 0) + (s.away_score ?? 0) > 0);
  const early = (m) => m.series_id == null && m.start_time && m.start_time < week.lock && m.start_time >= week.lock - 8 * 86400
    && done.some((s) => (s.home === m.team_a_id && s.away === m.team_b_id) || (s.home === m.team_b_id && s.away === m.team_a_id));
  return matches.filter((m) => (!week.league || week.league === "all" || m.league === week.league)
    && (week.seriesIds.has(m.series_id)
    || (m.start_time && weekKey(m.start_time) === week.key && week.teams.has(m.team_a_id) && week.teams.has(m.team_b_id))
    || early(m)));
}

// A team's roster as the games show it: the players who played for it and weren't stand-ins (the
// sync flags anyone off the current roster), each with the positions they played. Map of
// account -> { position: games }. Built once per game list.
const rosterMemo = new WeakMap(), subMemo = new WeakMap();
const teamKey = (m, side) => `${m.league ?? ""}|${side === "a" ? m.team_a_id : m.team_b_id}`;
function rosterOf(matches, key) {
  let all = rosterMemo.get(matches);
  if (!all) {
    all = new Map();
    for (const m of matches) for (const p of m.players ?? []) {
      if (p.standin || p.account_id == null) continue;
      const t = all.get(teamKey(m, p.team)) ?? all.set(teamKey(m, p.team), new Map()).get(teamKey(m, p.team));
      const pos = t.get(p.account_id) ?? t.set(p.account_id, {}).get(p.account_id);
      if (p.position) pos[p.position] = (pos[p.position] ?? 0) + 1;
    }
    rosterMemo.set(matches, all);
  }
  return all.get(key) ?? new Map();
}

// Who stood in for whom in one game: Map of the absent rostered player's account -> the stand-in's
// row. A side's absent players and its stand-ins pair off by the position the absent one mostly
// plays, then, if one of each is left, together. Anything murkier stays unpaired.
function subsOf(m, matches) {
  let memo = subMemo.get(matches);
  if (!memo) subMemo.set(matches, memo = new Map());
  if (memo.has(m)) return memo.get(m);
  const out = new Map();
  for (const side of ["a", "b"]) {
    const roster = rosterOf(matches, teamKey(m, side)), on = (m.players ?? []).filter((p) => p.team === side);
    const left = on.filter((p) => p.standin), rest = [];
    for (const [a, played] of roster) {
      if (on.some((p) => p.account_id === a)) continue;
      const main = Object.entries(played).sort((x, y) => y[1] - x[1])[0]?.[0], i = main ? left.findIndex((p) => String(p.position) === main) : -1;
      if (i >= 0) out.set(a, left.splice(i, 1)[0]); else rest.push(a);
    }
    if (rest.length === 1 && left.length === 1) out.set(rest[0], left[0]);
  }
  memo.set(m, out);
  return out;
}

// One pick's week: each game it played scored as `pos`, and the best GAMES_COUNTED added up. A game
// the pick sat out while a stand-in took their place scores the stand-in (`sub`), so the pick isn't
// left with a zero for a game their team played.
// { points, games: [{ id, match, time, score, stats, mult, counted, account, sub }] } (games oldest first).
// `matches`: every game loaded (the models come from them, per division).
export function pickPoints(account, pos, games, matches) {
  const scored = games.flatMap((m) => {
    const { games: league, models } = leagueCtx(matches, m.league);
    const sub = subsOf(m, matches).get(account) ?? null;
    const who = sub ? sub.account_id : account;
    const g = gamePointsAt(m, league, sub ? sub.player_key ?? sub.account_id : account, pos, models);
    return g ? [{ id: m.id, match: m, time: m.start_time ?? 0, score: g.score, stats: g.stats, stat_points: g.stat_points, mult: g.mult, win_points: g.win_points, account: who, sub: sub ? { account: sub.account_id, name: sub.name } : null }] : [];
  }).sort((a, b) => a.time - b.time);
  const best = new Set([...scored].sort((a, b) => b.score - a.score).slice(0, GAMES_COUNTED).map((g) => g.id));
  for (const g of scored) g.counted = best.has(g.id);
  return { points: round1(scored.filter((g) => g.counted).reduce((t, g) => t + g.score, 0)), games: scored };
}

// An entry's week: null when it was saved after the lock (the server's clock; such entries never
// count), else its points and each pick's.
export function scoreEntry(entry, week, matches) {
  if (!entry.updatedAt || !Number.isFinite(+entry.updatedAt) || +entry.updatedAt / 1000 >= week.lock
    || !Array.isArray(entry.picks) || entry.picks.length !== SLOTS.length || new Set(entry.picks).size !== SLOTS.length
    || entry.picks.some((a) => !Number.isInteger(a) || (week.eligible && !week.eligible.has(a)))) return null;
  if(entry.captain!=null&&(!Number.isInteger(entry.captain)||!entry.picks.includes(entry.captain)))return null;
  const games = weekGames(matches, week);
  const picks = entry.picks.map((account, i) => {
    const result=pickPoints(account,SLOTS[i],games,matches),captain=account===entry.captain;
    return {account,pos:SLOTS[i],...result,captain,basePoints:result.points,points:round1(result.points*(captain?2:1))};
  });
  return { points: round1(picks.reduce((t, p) => t + p.points, 0)), picks };
}

// One week's standings: every entry that counts, best first. [{ account, name, points, picks }]
export function weekBoard(entries, week, matches) {
  return entries.filter((e) => e.week === week.key).flatMap((e) => {
    const s = scoreEntry(e, week, matches);
    return s ? [{ account: e.account, name: e.name, ...s }] : [];
  }).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

// The season standings: every entrant's points over the weeks already locked at `now`, best
// first. entries: [{ account, name, week, picks, updatedAt }] for this league.
export function leaderboard(entries, weeks, matches, now) {
  const byKey = new Map(weeks.map((w) => [w.key, w]));
  const rows = new Map();
  for (const e of entries) {
    const w = byKey.get(e.week);
    if (!w || w.lock > now) continue;
    const s = scoreEntry(e, w, matches);
    if (!s) continue;
    const r = rows.get(e.account) ?? rows.set(e.account, { account: e.account, name: e.name, points: 0, weeks: [] }).get(e.account);
    r.points = round1(r.points + s.points);
    r.weeks.push({ week: w.key, ...s });
    if (w.lock >= (byKey.get(r.lastWeek)?.lock ?? -Infinity)) { r.lastWeek = w.key; r.name = e.name; }
  }
  return [...rows.values()].map((r) => ({ ...r, weeks: r.weeks.sort((a, b) => b.week.localeCompare(a.week)) }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}
