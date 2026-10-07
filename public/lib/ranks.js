// Stat leaders: players ranked on one stat, within a league and across every AD2L league.
// Rows are playerLeaderboard() lines (plus the per-game numbers below). Only players with
// MIN_GAMES+ games are ranked, the same bar as the tier list.

import { MIN_GAMES } from "./tiers.js";

// Stat groups, in the order the player page shows them.
export const RANK_GROUPS = [["results", "Results"], ["economy", "Economy"], ["damage", "Damage"], ["combat", "Combat"], ["support", "Support"], ["objectives", "Objectives"]];

// Stats you can rank by. `low`: fewer is better, so the top 3 are the lowest. `map`: from
// parsed replays only (AD2L), missing for screenshot uploads.
export const RANK_STATS = [
  { key: "win_rate", label: "Win %", group: "results", fmt: "pct" },
  { key: "kda", label: "KDA", group: "results", fmt: "2" },
  { key: "kills_pg", label: "Kills a game", group: "results", fmt: "1" },
  { key: "deaths_pg", label: "Deaths a game", group: "results", fmt: "1", low: true },
  { key: "assists_pg", label: "Assists a game", group: "results", fmt: "1" },
  { key: "avg_gpm", label: "GPM", group: "economy", fmt: "0" },
  { key: "avg_xpm", label: "XPM", group: "economy", fmt: "0" },
  { key: "dmg_per_min", label: "Damage / min", group: "damage", fmt: "0" },
  { key: "dmg_per_1k_nw", label: "Damage per 1k net worth", group: "damage", fmt: "0" },
  { key: "dmg_taken_pg", label: "Damage taken a game", group: "damage", fmt: "0", map: true },
  { key: "avg_kp", label: "Kill participation", group: "results", fmt: "pct" },
  { key: "buybacks_pg", label: "Buybacks a game", group: "results", fmt: "2", map: true },
  { key: "apm", label: "APM", group: "combat", fmt: "0", map: true },
  { key: "tf_part", label: "Teamfight participation", group: "combat", fmt: "pct", map: true },
  { key: "fb_rate", label: "First blood rate", group: "combat", fmt: "pct", map: true },
  { key: "fb_death_rate", label: "Died first", group: "combat", fmt: "pct", map: true, low: true },
  { key: "best_streak", label: "Longest kill streak", group: "combat", fmt: "0", map: true },
  { key: "rampages", label: "Rampages", group: "combat", fmt: "0", map: true },
  { key: "ultras", label: "Ultra kills", group: "combat", fmt: "0", map: true },
  { key: "runes_pg", label: "Runes a game", group: "combat", fmt: "1", map: true },
  { key: "courier_kills", label: "Courier kills", group: "combat", fmt: "0", map: true },
  { key: "obs_pg", label: "Observers a game", group: "support", fmt: "1", map: true },
  { key: "sen_pg", label: "Sentries a game", group: "support", fmt: "1", map: true },
  { key: "dewards_pg", label: "Dewards a game", group: "support", fmt: "1", map: true },
  { key: "stacks_pg", label: "Stacks a game", group: "support", fmt: "1", map: true },
  { key: "healing_pg", label: "Healing a game", group: "support", fmt: "0", map: true },
  { key: "stuns_pg", label: "Stun seconds a game", group: "support", fmt: "1", map: true },
  { key: "lane_pg", label: "Lane creeps a game", group: "economy", fmt: "0", map: true },
  { key: "neutral_pg", label: "Neutrals a game", group: "economy", fmt: "0", map: true },
  { key: "building_pg", label: "Building damage a game", group: "objectives", fmt: "0", map: true },
  { key: "roshans_pg", label: "Roshans a game", group: "objectives", fmt: "2", map: true },
  { key: "tormentors_pg", label: "Tormentors a game", group: "objectives", fmt: "2", map: true },
];

export function formatStat(stat, v) {
  if (v == null) return "—";
  if (stat.fmt === "pct") return `${Math.round(v * 100)}%`;
  // "+0", "+1": signed, for margins and leads.
  if (stat.fmt[0] === "+") { const t = Number(v).toFixed(Number(stat.fmt.slice(1))); return Number(t) > 0 ? `+${t}` : t; }
  return Number(v).toFixed(Number(stat.fmt));
}

// A leaderboard line with the per-game numbers the leaderboard keeps as totals.
export const withPerGame = (r) => ({
  ...r,
  kills_pg: r.kills / r.games, deaths_pg: r.deaths / r.games, assists_pg: r.assists / r.games,
  roshans_pg: r.map_games ? r.roshans / r.map_games : null,
  tormentors_pg: r.map_games ? r.tormentors / r.map_games : null,
});

// Players with MIN_GAMES+ games and a value for the stat, best first. Ties: more games first.
export function rankStat(rows, stat, minGames = MIN_GAMES) {
  const dir = stat.low ? 1 : -1;
  return rows.filter((r) => r.games >= minGames && r[stat.key] != null)
    .sort((a, b) => dir * (a[stat.key] - b[stat.key]) || b.games - a.games || String(a.name).localeCompare(String(b.name)));
}

// Where one entry sits in a ranked list (best first). With `value`, equal values share a place:
// rank = 1 + how many are better, fromBottom = 1 + how many are worse, tied = how many share
// it. `end` is "top" / "bottom" only when the whole tied group fits in the first / last n, so a
// crowd tied at zero doesn't hand one of them "last" (top wins on a short list).
export function placeOf(ranked, match, value = null, n = 3) {
  const i = ranked.findIndex(match);
  if (i < 0) return null;
  const of = ranked.length;
  let first = i, last = i;
  if (value) {
    const v = value(ranked[i]);
    while (first > 0 && value(ranked[first - 1]) === v) first--;
    while (last < of - 1 && value(ranked[last + 1]) === v) last++;
  }
  const tied = last - first + 1, better = first, worse = of - 1 - last;
  return { rank: better + 1, of, fromBottom: worse + 1, tied, end: better + tied <= n ? "top" : worse + tied <= n ? "bottom" : null };
}

// Top and bottom n of a ranked list (bottom worst first), by placeOf's rule, plus the tied group
// that spilled past each end ({ count, sample }), if any.
export function ends(ranked, value = null, n = 3) {
  const at = ranked.map((x) => placeOf(ranked, (y) => y === x, value, n));
  const top = ranked.filter((x, i) => at[i].end === "top");
  const bottom = ranked.filter((x, i) => at[i].end === "bottom").reverse();
  const spill = (i) => (i >= 0 && i < ranked.length && !at[i].end ? { count: at[i].tied, sample: ranked[i] } : null);
  return {
    top, bottom,
    top_spill: top.length < n ? spill(top.length) : null,
    bottom_spill: bottom.length < n ? spill(ranked.length - 1 - bottom.length) : null,
  };
}

export const ordinal = (n) => {
  const t = n % 100;
  return `${n}${t >= 11 && t <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};
