// Strength of schedule, as AD2L's rules define it (rules §7): the total game wins of the
// opponents a team has played. It breaks ties for playoff seeding, so the site uses the same
// number. Each series counts once, so meeting a team twice counts their wins twice (the swiss
// way); the bye-week placeholder is an opponent with no wins. Opponents' wins are their whole
// record, games against this team included.
// Series: { home, away, home_score, away_score } with team ids; unplayed = null scores.

export const isPlayed = (s) => s.home_score != null && s.away_score != null && s.home_score + s.away_score > 0;

// Game wins per team id from the played series.
export function gameWins(series) {
  const w = new Map();
  for (const s of series.filter(isPlayed)) {
    w.set(s.home, (w.get(s.home) ?? 0) + s.home_score);
    w.set(s.away, (w.get(s.away) ?? 0) + s.away_score);
  }
  return w;
}

export function strengthOfSchedule(teamIds, series) {
  const played = series.filter(isPlayed).sort((a, b) => (a.time ?? 0) - (b.time ?? 0)); // oldest first
  const remaining = series.filter((s) => !isPlayed(s) && s.home != null && s.away != null);
  const wins = gameWins(played), winsOf = (t) => wins.get(t) ?? 0;
  return teamIds.map((t) => {
    const faced = played.filter((s) => s.home === t || s.away === t).map((s) => {
      const opp = s.home === t ? s.away : s.home;
      const us = s.home === t ? s.home_score : s.away_score, them = s.home === t ? s.away_score : s.home_score;
      return { opp, us, them, result: us > them ? "w" : us < them ? "l" : "t", opp_wins: winsOf(opp) };
    });
    const left = remaining.filter((s) => s.home === t || s.away === t).map((s) => (s.home === t ? s.away : s.home));
    return {
      id: t,
      sos: faced.length ? faced.reduce((a, f) => a + f.opp_wins, 0) : null,
      faced,
      remaining: left,
      remaining_sos: left.length ? left.reduce((a, o) => a + winsOf(o), 0) : null,
    };
  });
}
