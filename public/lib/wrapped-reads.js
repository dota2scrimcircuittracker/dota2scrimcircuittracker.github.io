// The model's read of every decided series, from the nights before it only (as the Teams tab's
// Biggest upset): q, the home side's chance in one game; p, the chance of the result that happened.
// Wrapped's team awards (upset, overachiever) use them. The deploy works them out once
// (scripts/deploy/wrapped-reads.js -> data/wrapped-reads.json); the page does it live only when
// that file is missing or out of step (npm start, which serves public/ as committed).
import { fitRatings, gameChance, matchOdds, matchPostOdds, isPlayed, MODEL_PARAMS } from "./predict.js";
import { draftAt } from "./cmdraft.js";
import { isPostseason } from "./divisions.js";

// Several divisions' draft files as one: histories merged, heroes and baselines from the first.
export function mergeDraftFiles(files) {
  const all = files.filter(Boolean);
  if (!all.length) return null;
  return { ...all[0], history: Object.assign({}, ...all.map((d) => d.history)), totals: Object.assign({}, ...all.map((d) => d.totals ?? {})), ranked: Object.assign({}, ...all.map((d) => d.ranked ?? {})) };
}

// The series a read is made for: played, with games, and no bye-week team.
export function readableSeries(d) {
  const bye = new Set(d.teams.filter((t) => /\bbye week\b/i.test(t.name)).map((t) => t.id));
  return d.series.filter((s) => isPlayed(s) && s.home_score + s.away_score > 0 && !bye.has(s.home) && !bye.has(s.away));
}

// d: a league's data (teams, series, games); draftFile: its draft file (mergeDraftFiles), or null.
// Every series on one night shares one fit (fitRatings only counts series before that night).
export function modelReads(d, draftFile) {
  const played = readableSeries(d);
  if (!played.length) return [];
  const atNight = draftFile && draftAt(draftFile, d.teams, d.games), nights = new Map();
  const ratingsAt = (t) => {
    if (!nights.has(t)) {
      const r = fitRatings(d.teams, d.series, { ...MODEL_PARAMS, before: t });
      r.draft = atNight ? atNight(t) : null;
      nights.set(t, r);
    }
    return nights.get(t);
  };
  return played.map((s) => {
    const r = ratingsAt(s.time ?? 0);
    const o = isPostseason(s) ? matchPostOdds(r, s.home, s.away) : matchOdds(r, s.home, s.away);
    const res = s.home_score > s.away_score ? "home" : s.home_score < s.away_score ? "away" : "tie";
    return { s, home: s.home, away: s.away, q: gameChance(r, s.home, s.away), p: o[res] ?? 0 };
  });
}

// For the file: [series id, q, p, home score, away score] per read (the scores catch a result
// corrected after the file was written).
export const packReads = (reads) => reads.map((r) => [r.s.id, r.q, r.p, r.s.home_score, r.s.away_score]);
// Most sandbagged (lib/wrapped.js rankedRecords) reads the draft file's `ranked`: per main
// account (no smurfs), flat groups of 3 [time, won, lobby medal]. For the file: cut to `since`
// on (the earliest season start any league uses, so every league's own start is covered).
export function packRanked(ranked, since) {
  const out = {};
  for (const [acct, h] of Object.entries(ranked ?? {})) {
    const rows = [];
    for (let i = 0; i < h.length; i += 3) if (h[i] >= since) rows.push(h[i], h[i + 1], h[i + 2]);
    if (rows.length) out[acct] = rows;
  }
  return out;
}

// Back from the file against the league's own series. null when they don't line up (the data
// changed since the file was written), so the page works them out itself.
export function unpackReads(rows, d) {
  if (!Array.isArray(rows)) return null;
  const played = readableSeries(d);
  if (rows.length !== played.length) return null;
  const byId = new Map(played.map((s) => [s.id, s]));
  const out = [];
  for (const [id, q, p, hs, as] of rows) {
    const s = byId.get(id);
    if (!s || s.home_score !== hs || s.away_score !== as) return null;
    out.push({ s, home: s.home, away: s.away, q, p });
  }
  return out;
}
