// The League achievements (lib/achievements.js) each player has earned, from the postseason as
// played: their team made the playoffs, started in the upper bracket, played or won the grand
// final, or won a week 8 tiebreaker. Only played results count, never the model's picks. A player
// counts for every team whose roster lists them. The deploy writes these to
// data/league-achievements.json (scripts/deploy/league-achievements.js) and the collection Worker
// reads that file when it counts a player's achievements.
import { playoffPicture, bracketsOf, seedsSettled, TBD } from "./playoffs.js";
import { postseasonRows, playedPostseason, DIVISIONS } from "./divisions.js";
import { fitRatings } from "./predict.js";

export const LEAGUE_FACTS = ["playoffs", "upperBracket", "grandFinal", "leagueWin", "tiebreaker"];
const known = (t) => t != null && t !== TBD;

// One division's file -> { [team id]: { playoffs, upperBracket, grandFinal, leagueWin, tiebreaker } },
// only the teams that earned something.
export function teamFacts(key, d) {
  const series = [...d.series, ...playedPostseason(postseasonRows(key, d))];
  const split = !!DIVISIONS.find((x) => x.key === key)?.views;
  const pic = playoffPicture(d.teams, series, fitRatings(d.teams, series), { split, blank: true });
  const out = {};
  const give = (id, fact) => { if (known(id)) (out[id] ??= {})[fact] = 1; };
  for (const dv of pic.divisions) for (const tb of dv.tiebreakers) for (const m of tb.matches) if (m.real) give(m.winner, "tiebreaker");
  if (!seedsSettled(pic)) return out;
  for (const [, b] of bracketsOf(pic, split)) for (const m of b?.matches ?? []) {
    for (const t of [m.a, m.b]) give(t, "playoffs");
    if (m.side === "upper" && m.week === 1) for (const t of [m.a, m.b]) give(t, "upperBracket");
    if (m.id === "gf" && m.real) { for (const t of [m.a, m.b]) give(t, "grandFinal"); give(m.winner, "leagueWin"); }
  }
  return out;
}

// Every division's files -> { [account id]: { fact: 1, ... } }. files: { [key]: division data }.
export function leagueAchievements(files) {
  const out = {};
  for (const [key, d] of Object.entries(files)) {
    if (!d?.teams?.length) continue;
    const facts = teamFacts(key, d);
    for (const t of d.teams) {
      if (!facts[t.id]) continue;
      for (const p of t.players ?? []) if (p.account_id) Object.assign((out[p.account_id] ??= {}), facts[t.id]);
    }
  }
  return out;
}
