// Tables (site search's table builder, pages/search.js): every team, player or hero in a scope
// side by side, a column per stat. Pure, so the tests read it. Values come from the same
// functions as the team, Players and Heroes pages (lib/combat.js teamSplits, lib/timeline.js,
// lib/draft.js, lib/stats.js playerLeaderboard and heroStats), so they can't disagree.
// Spec: docs/superpowers/specs/2026-10-06-team-tables-design.md.
import { sideOf, record } from "./teams.js";
import { teamSplits } from "./combat.js";
import { teamTimeline, teamObjectives } from "./timeline.js";
import { teamSideSplit } from "./draft.js";
import { playerLeaderboard, heroStats, hasDetails } from "./stats.js";

// A cell: { v: number, n: games behind it (null = a count, no sample), of: "8–4" or null }.
const cell = (v, n = null, of = null) => (v == null || !Number.isFinite(v) ? null : { v, n, of });
const winRate = (games, wins) => (games ? cell(wins / games, games, `${wins}–${games - wins}`) : null);
const share = (a, b, n) => (a + b ? cell(a / (a + b), n, `${a}–${b}`) : null);
const perGame = (sum, games) => (games ? cell(sum / games, games) : null);

// ---------- teams ----------
const TEAM_GROUPS = [["results", "Results"], ["sides", "Sides and draft"], ["early", "Early game"], ["fights", "Fights and kills"],
  ["objectives", "Objectives"], ["vision", "Vision and jungle"], ["length", "Game length"], ["roster", "Roster"]];

// Every column: id (the address and topics use it), label, group, fmt (pct, dec, int, signed,
// gold), the glossary key for its header (false: none), low: true when lower is better (sorted
// low → high first), and get(a) from one row's aggregates.
const TEAM_COLUMNS = [
  { id: "games", label: "Games", group: "results", fmt: "int", key: false, get: (a) => cell(a.games) },
  { id: "win_rate", label: "Win %", group: "results", fmt: "pct", key: "game_rate", get: (a) => winRate(a.rec.games, a.rec.wins) },
  { id: "radiant_rate", label: "Radiant win %", group: "sides", fmt: "pct", key: "team_sides", get: (a) => winRate(a.sp.sides.a.games, a.sp.sides.a.wins) },
  { id: "dire_rate", label: "Dire win %", group: "sides", fmt: "pct", key: "team_sides", get: (a) => winRate(a.sp.sides.b.games, a.sp.sides.b.wins) },
  { id: "fp_rate", label: "First pick win %", group: "sides", fmt: "pct", key: "team_side_pick", get: (a) => winRate(a.ss.first.n, a.ss.first.wins) },
  { id: "sp_rate", label: "Second pick win %", group: "sides", fmt: "pct", key: "team_side_pick", get: (a) => winRate(a.ss.second.n, a.ss.second.wins) },
  { id: "fb_taken", label: "First blood %", group: "early", fmt: "pct", key: "team_first_blood", get: (a) => share(a.sp.first_blood.taken, a.sp.first_blood.games - a.sp.first_blood.taken, a.sp.first_blood.games) },
  { id: "fb_win", label: "Win % after first blood", group: "early", fmt: "pct", key: "team_first_blood", get: (a) => winRate(a.sp.first_blood.taken, a.sp.first_blood.wins_taken) },
  { id: "lead10", label: "Gold at 10'", group: "early", fmt: "gold", key: "lead10", get: (a) => cell(a.tl?.lead10, a.tl?.games) },
  { id: "lead20", label: "Gold at 20'", group: "early", fmt: "gold", key: "lead20", get: (a) => cell(a.tl?.lead20, a.tl?.games) },
  { id: "comebacks", label: "Comebacks", group: "early", fmt: "int", key: "comebacks", get: (a) => cell(a.tl?.comebacks) },
  { id: "fight_rate", label: "Teamfight win %", group: "fights", fmt: "pct", key: "team_fight_rate", get: (a) => share(a.sp.fights.won, a.sp.fights.lost, a.sp.fights.games) },
  { id: "kills_for", label: "Kills / game", group: "fights", fmt: "dec", key: "avg_kills", get: (a) => perGame(a.kills, a.games) },
  { id: "kills_against", label: "Deaths / game", group: "fights", fmt: "dec", key: "avg_kills", low: true, get: (a) => perGame(a.deaths, a.games) },
  { id: "kill_diff", label: "Kill diff / game", group: "fights", fmt: "signed", key: "avg_kills", get: (a) => perGame(a.kills - a.deaths, a.games) },
  { id: "rosh", label: "Roshan control", group: "objectives", fmt: "pct", key: "team_roshans", get: (a) => a.o && share(a.o.roshans, a.o.roshans_against, a.o.games) },
  { id: "first_rosh", label: "First Roshan %", group: "objectives", fmt: "pct", key: "first_roshan", get: (a) => a.o && winRate(a.o.first_rosh.games, a.o.first_rosh.taken) },
  { id: "aegis_steals", label: "Aegis steals", group: "objectives", fmt: "int", key: "aegis_steals", get: (a) => cell(a.sp.aegis.stole) },
  { id: "obs", label: "Observers / game", group: "vision", fmt: "dec", key: "team_wards", get: (a) => cell(a.o?.obs_pg, a.o?.games) },
  { id: "dewards", label: "Dewards / game", group: "vision", fmt: "dec", key: "team_dewards", get: (a) => cell(a.o?.dewards_pg, a.o?.games) },
  { id: "stacks", label: "Stacks / game", group: "vision", fmt: "dec", key: "team_stacks", get: (a) => cell(a.o?.stacks_pg, a.o?.games) },
  { id: "avg_min", label: "Avg game (min)", group: "length", fmt: "dec", key: "team_length", get: (a) => perGame(a.minutes, a.games) },
  { id: "short_rate", label: "Win % under 30'", group: "length", fmt: "pct", key: "team_length", get: (a) => winRate(a.sp.length[0].games, a.sp.length[0].wins) },
  { id: "long_rate", label: "Win % at 45'+", group: "length", fmt: "pct", key: "team_length", get: (a) => winRate(a.sp.length[2].games, a.sp.length[2].wins) },
  { id: "standin_rate", label: "Win % with stand-ins", group: "roster", fmt: "pct", key: "team_standins", get: (a) => winRate(a.sp.standin.with.games, a.sp.standin.with.wins) },
];

// One team's aggregates over its games. `rec` overrides the record (AD2L: PlayOn's series
// scores, as the team page shows; otherwise the games' own).
export function teamAggregates(matches, team, rec = null) {
  const side = (m) => sideOf(m, team);
  const gs = matches.filter(side);
  let kills = 0, deaths = 0, minutes = 0;
  for (const m of gs) {
    const s = side(m);
    kills += (s === "a" ? m.score_a : m.score_b) ?? 0;
    deaths += (s === "a" ? m.score_b : m.score_a) ?? 0;
    minutes += (m.duration_sec ?? 0) / 60;
  }
  const r = rec ?? record(matches, team);
  return {
    games: gs.length, kills, deaths, minutes, rec: { games: r.wins + r.losses, wins: r.wins },
    sp: teamSplits(gs, side), tl: teamTimeline(gs, side), o: teamObjectives(gs, side),
    ss: teamSideSplit(gs.map((m) => ({ m, side: side(m) }))),
  };
}

// ---------- players ----------
const PLAYER_GROUPS = [["results", "Results"], ["fighting", "Fighting"], ["farm", "Farm and damage"], ["support", "Vision and support"],
  ["jungle", "Jungle and objectives"], ["mechanics", "Mechanics"], ["pool", "Hero pool"]];
// Per game over all their games; replay numbers over the games that have them (map_games), and
// combat log numbers likewise (combat_games), as the Players page.
const pg = (k) => (a) => perGame(a[k], a.games);
const avg = (k, n = "games") => (a) => cell(a[k], a[n]);
const PLAYER_COLUMNS = [
  { id: "games", label: "Games", group: "results", fmt: "int", key: false, get: (a) => cell(a.games) },
  { id: "win_rate", label: "Win %", group: "results", fmt: "pct", key: false, get: (a) => winRate(a.games, a.wins) },
  { id: "kills_pg", label: "Kills / game", group: "fighting", fmt: "dec", key: false, get: pg("kills") },
  { id: "deaths_pg", label: "Deaths / game", group: "fighting", fmt: "dec", key: false, low: true, get: pg("deaths") },
  { id: "assists_pg", label: "Assists / game", group: "fighting", fmt: "dec", key: false, get: pg("assists") },
  { id: "kda", label: "KDA", group: "fighting", fmt: "dec2", key: "kda", get: avg("kda") },
  { id: "avg_kp", label: "Kill participation", group: "fighting", fmt: "pct", key: "avg_kp", get: avg("avg_kp") },
  { id: "tf_part", label: "Teamfights joined", group: "fighting", fmt: "pct", key: "tf_part", get: avg("tf_part", "combat_games") },
  { id: "fb_rate", label: "First blood %", group: "fighting", fmt: "pct", key: "fb_rate", get: avg("fb_rate", "combat_games") },
  { id: "fb_death_rate", label: "Died first %", group: "fighting", fmt: "pct", key: "fb_death_rate", low: true, get: avg("fb_death_rate", "combat_games") },
  { id: "best_streak", label: "Best streak", group: "fighting", fmt: "int", key: "best_streak", get: (a) => cell(a.best_streak) },
  { id: "rampages", label: "Rampages", group: "fighting", fmt: "int", key: "rampages", get: (a) => cell(a.rampages) },
  { id: "ultras", label: "Ultra kills", group: "fighting", fmt: "int", key: "ultras", get: (a) => cell(a.ultras) },
  { id: "avg_gpm", label: "GPM", group: "farm", fmt: "int", key: "avg_gpm", get: avg("avg_gpm") },
  { id: "avg_xpm", label: "XPM", group: "farm", fmt: "int", key: "avg_xpm", get: avg("avg_xpm") },
  { id: "dmg_per_min", label: "Damage / min", group: "farm", fmt: "int", key: "dmg_per_min", get: avg("dmg_per_min") },
  { id: "dmg_per_1k_nw", label: "Damage per 1k NW", group: "farm", fmt: "int", key: "dmg_per_1k_nw", get: avg("dmg_per_1k_nw") },
  { id: "dmg_taken_pg", label: "Damage taken / game", group: "farm", fmt: "int", key: "dmg_taken_pg", get: avg("dmg_taken_pg") },
  { id: "building_pg", label: "Building damage / game", group: "farm", fmt: "int", key: false, get: avg("building_pg") },
  { id: "lane_pg", label: "Lane creeps / game", group: "farm", fmt: "dec", key: "lane_pg", get: avg("lane_pg", "map_games") },
  { id: "healing_pg", label: "Healing / game", group: "support", fmt: "int", key: false, get: avg("healing_pg") },
  { id: "stuns_pg", label: "Stun seconds / game", group: "support", fmt: "dec", key: false, get: avg("stuns_pg") },
  { id: "obs_pg", label: "Observers / game", group: "support", fmt: "dec", key: "obs_pg", get: avg("obs_pg", "map_games") },
  { id: "sen_pg", label: "Sentries / game", group: "support", fmt: "dec", key: "sen_pg", get: avg("sen_pg", "map_games") },
  { id: "dewards_pg", label: "Dewards / game", group: "support", fmt: "dec", key: "dewards_pg", get: avg("dewards_pg", "map_games") },
  { id: "stacks_pg", label: "Stacks / game", group: "jungle", fmt: "dec", key: "stacks_pg", get: avg("stacks_pg", "map_games") },
  { id: "neutral_pg", label: "Neutrals / game", group: "jungle", fmt: "dec", key: "neutral_pg", get: avg("neutral_pg", "map_games") },
  { id: "roshans", label: "Roshans", group: "jungle", fmt: "int", key: "roshans", get: (a) => cell(a.roshans) },
  { id: "apm", label: "APM", group: "mechanics", fmt: "int", key: "apm", get: avg("apm", "combat_games") },
  { id: "runes_pg", label: "Runes / game", group: "mechanics", fmt: "dec", key: "runes_pg", get: avg("runes_pg", "combat_games") },
  { id: "buybacks_pg", label: "Buybacks / game", group: "mechanics", fmt: "dec", key: "buybacks_pg", get: avg("buybacks_pg") },
  { id: "hero_count", label: "Heroes played", group: "pool", fmt: "int", key: false, get: (a) => cell(a.hero_list?.length ?? null) },
];

// ---------- heroes ----------
const HERO_GROUPS = [["draft", "Draft"], ["results", "Results"], ["play", "How it plays"]];
const HERO_COLUMNS = [
  { id: "picks", label: "Picks", group: "draft", fmt: "int", key: false, get: (a) => cell(a.picks) },
  { id: "pick_rate", label: "Pick rate", group: "draft", fmt: "pct", key: "pick_rate", get: (a) => cell(a.pick_rate, a.picks) },
  { id: "bans", label: "Bans", group: "draft", fmt: "int", key: false, get: (a) => cell(a.bans) },
  { id: "ban_rate", label: "Ban rate", group: "draft", fmt: "pct", key: "ban_rate", get: (a) => cell(a.ban_rate, a.drafted) },
  { id: "contest_rate", label: "Contest rate", group: "draft", fmt: "pct", key: "contest_rate", get: (a) => cell(a.contest_rate, a.drafted) },
  { id: "win_rate", label: "Win %", group: "results", fmt: "pct", key: false, get: (a) => winRate(a.picks, a.wins) },
  { id: "avg_kda", label: "Avg KDA", group: "play", fmt: "dec2", key: "avg_kda", get: (a) => cell(a.avg_kda, a.picks) },
  { id: "avg_damage", label: "Avg hero damage", group: "play", fmt: "int", key: "avg_damage", get: (a) => cell(a.avg_damage, a.picks) },
];

// ---------- kinds ----------
// scope: { matches (the scope's games), teams (team kind), records (team key -> PlayOn record) }.
// A row: { id, name, team?, cells: { column id: cell | null } }.
export const KINDS = {
  team: {
    label: "Teams", one: "team", groups: TEAM_GROUPS, columns: TEAM_COLUMNS,
    presets: [
      { id: "overview", name: "Overview", cols: ["games", "win_rate", "kill_diff", "avg_min", "fight_rate"] },
      { id: "sides", name: "Sides and draft", cols: ["win_rate", "radiant_rate", "dire_rate", "fp_rate", "sp_rate"] },
      { id: "early", name: "Early game", cols: ["win_rate", "fb_taken", "fb_win", "lead10", "lead20"] },
      { id: "fights", name: "Fights", cols: ["win_rate", "fight_rate", "kills_for", "kills_against", "kill_diff"] },
      { id: "objectives", name: "Objectives", cols: ["win_rate", "rosh", "first_rosh", "aegis_steals"] },
      { id: "vision", name: "Vision and jungle", cols: ["win_rate", "obs", "dewards", "stacks"] },
      { id: "length", name: "Game length", cols: ["win_rate", "avg_min", "short_rate", "long_rate", "comebacks"] },
    ],
    rows: ({ matches, teams, records = null }) => teams.map((team) => {
      const a = teamAggregates(matches, team, records?.get(team.key) ?? null);
      return { id: team.key, name: team.name, entity: team, cells: Object.fromEntries(TEAM_COLUMNS.map((c) => [c.id, c.get(a) ?? null])) };
    }),
  },
  player: {
    label: "Players", one: "player", groups: PLAYER_GROUPS, columns: PLAYER_COLUMNS,
    presets: [
      { id: "overview", name: "Overview", cols: ["games", "win_rate", "kda", "avg_gpm", "avg_kp"] },
      { id: "fighting", name: "Fighting", cols: ["games", "kills_pg", "deaths_pg", "assists_pg", "kda", "tf_part"] },
      { id: "farm", name: "Farm and damage", cols: ["games", "avg_gpm", "avg_xpm", "dmg_per_min", "dmg_per_1k_nw", "lane_pg"] },
      { id: "support", name: "Support", cols: ["games", "obs_pg", "sen_pg", "dewards_pg", "stacks_pg", "healing_pg"] },
      { id: "early", name: "First blood", cols: ["games", "fb_rate", "fb_death_rate", "kills_pg"] },
      { id: "mechanics", name: "Mechanics", cols: ["games", "apm", "runes_pg", "buybacks_pg", "best_streak"] },
    ],
    rows: ({ matches }) => playerLeaderboard(matches.filter(hasDetails)).map((p) => ({
      id: p.key, name: p.name, entity: p, team: p.team, cells: Object.fromEntries(PLAYER_COLUMNS.map((c) => [c.id, c.get(p) ?? null])),
    })),
  },
  hero: {
    label: "Heroes", one: "hero", groups: HERO_GROUPS, columns: HERO_COLUMNS,
    presets: [
      { id: "overview", name: "Overview", cols: ["picks", "win_rate", "ban_rate", "contest_rate"] },
      { id: "draft", name: "Draft", cols: ["picks", "pick_rate", "bans", "ban_rate", "contest_rate"] },
      { id: "play", name: "How it plays", cols: ["picks", "win_rate", "avg_kda", "avg_damage"] },
    ],
    rows: ({ matches }) => {
      const ms = matches.filter(hasDetails), drafted = ms.filter((m) => m.draft?.length).length;
      return heroStats(ms).map((h) => {
        const a = { ...h, drafted };
        return { id: h.hero, name: h.hero, entity: h, cells: Object.fromEntries(HERO_COLUMNS.map((c) => [c.id, c.get(a) ?? null])) };
      });
    },
  },
};
export const column = (kind, id) => KINDS[kind]?.columns.find((c) => c.id === id) ?? null;

// The rows for a kind and scope, kept per scope's games, so changing columns doesn't recount.
const cache = new WeakMap();
export function tableRows(kind, scope) {
  const byKind = cache.get(scope.matches) ?? cache.set(scope.matches, new Map()).get(scope.matches);
  const key = `${kind}|${scope.key ?? ""}`;
  if (!byKind.has(key)) byKind.set(key, KINDS[kind].rows(scope));
  return byKind.get(key);
}

// The scope's games: the whole season, or the last `weeks` weeks before `now` (ms).
export const WEEKS = [2, 4, 8];
export function inPeriod(matches, weeks, now = Date.now()) {
  if (!weeks) return matches;
  const from = now - weeks * 7 * 864e5;
  return matches.filter((m) => +new Date(m.createdAt ?? (m.start_time ?? 0) * 1000) >= from);
}

// A cell's text: 62%, 21.4, 3.25, 3, +4.2, +1.3k.
export function cellText(fmt, v) {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "±";
  if (fmt === "pct") return `${Math.round(v * 100)}%`;
  if (fmt === "dec") return v.toFixed(1);
  if (fmt === "dec2") return v.toFixed(2);
  if (fmt === "int") return Math.round(v).toLocaleString("en-US");
  if (fmt === "signed") return `${sign}${Math.abs(v).toFixed(1)}`;
  if (fmt === "gold") return `${sign}${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}k` : Math.round(Math.abs(v))}`;
  return String(v);
}

// The builder's state in the address: &table=team&cols=a,b&sort=a&dir=asc&min=3&weeks=4&team=…
// (`league` is the page's: pages/search.js reads it).
export const MIN_DEFAULT = 3;
export function parseTable(params) {
  const kind = params.get("table");
  if (!KINDS[kind]) return null;
  const K = KINDS[kind];
  const cols = (params.get("cols") ?? "").split(",").filter((id) => column(kind, id));
  const list = cols.length ? [...new Set(cols)] : K.presets[0].cols;
  const want = params.get("sort");
  const sort = list.includes(want) ? want : list.find((id) => id !== "games" && id !== "picks") ?? list[0];
  const dir = params.get("dir") === "asc" ? "asc" : params.get("dir") === "desc" ? "desc" : column(kind, sort).low ? "asc" : "desc";
  const min = Number.parseInt(params.get("min") ?? "", 10);
  const weeks = Number(params.get("weeks"));
  return {
    kind, cols: list, sort, dir, min: Number.isNaN(min) ? MIN_DEFAULT : Math.max(0, Math.min(50, min)),
    weeks: WEEKS.includes(weeks) ? weeks : 0, team: kind === "player" ? params.get("team") || null : null,
  };
}
export function tableParams({ kind = "team", cols, sort, dir, min = MIN_DEFAULT, weeks = 0, team = null }) {
  const p = new URLSearchParams({ table: kind, cols: cols.join(",") });
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  if (min !== MIN_DEFAULT) p.set("min", String(min));
  if (weeks) p.set("weeks", String(weeks));
  if (team && kind === "player") p.set("team", team);
  return p;
}
// A fresh state for a kind: its first preset, or the columns given.
export function tableState(kind, cols = null, sort = null) {
  return parseTable(tableParams({ kind, cols: cols ?? KINDS[kind].presets[0].cols, sort }));
}
