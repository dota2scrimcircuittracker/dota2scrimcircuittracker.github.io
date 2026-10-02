// The playoff picture if the model calls every remaining result right: the rest of the group
// stage, the final table, AD2L's tiebreakers (week 8) and the bracket.
//
// AD2L rules (S48, rules §5–7, read 2026-10-02):
//  - Group stage: 7 weeks, pseudo-swiss, two-game series. The table counts game wins; a bye
//    is a 1–0 series.
//  - Playoffs: 8 teams, double elimination; seeds 1–4 start in the upper bracket, 5–8 in the
//    lower. Seed 1 picks seed 3 or 4 as its first opponent. Bo3; the grand final Bo3 or Bo5.
//  - A tie across a dividing line (upper/lower bracket, playoffs/out) is played off in week 8,
//    by the table in tiebreakFormat below, with the tied teams ranked by SoS (strength of
//    schedule: total wins of the opponents played), then head to head, then record against the
//    highest common opponent, then a 1v1 mid. A tie that only decides seed order isn't played:
//    SoS, head to head, highest common opponent, coin flip.
// Not in the rules, taken from S47's brackets on PlayOn: lower round 1 is 5 v 8 and 6 v 7; the
// loser of seed 1's match meets the 6 v 7 winner, the other upper loser the 5 v 8 winner.
// Smaller divisions (fewer than 8 teams) put everyone in: 4 teams all start upper (1 v 4,
// 2 v 3); 5–6 teams play 5 v 6 in the lower bracket. That part is the site's assumption.

import { seriesOdds, modelCall, ODDS_SPREAD } from "./predict.js";
import { isPlayed, gameWins, strengthOfSchedule } from "./schedule.js";

export const REG_WEEKS = 7;
export const isBye = (t) => /\bbye week\b/i.test(t?.name ?? "");

const sig = (x) => 1 / (1 + Math.exp(-x));
// Chance the first team wins one game: the same stretched gap as the series odds on Predict.
export const gameP = (ra, rb) => sig(ODDS_SPREAD * (ra - rb));
// Chance to win a best-of-n from the one-game chance (games independent).
export function bestOfP(p, n) {
  if (n === 1 || n == null) return p;
  if (n === 3) return p * p * (3 - 2 * p);
  if (n === 5) return p ** 3 * (10 - 15 * p + 6 * p * p);
  return p;
}
// Every final score of a best-of-n (odd n; anything else plays as a Bo1) and its chance, from
// the first team's one-game chance: [{ a, b, p }], first team's wins first (Bo3: 2–0, 2–1, 1–2,
// 0–2). A first-to-k win with j losses: the last game won, j of the other k-1+j lost.
export function bestOfScores(p, n) {
  const k = n === 3 || n === 5 ? (n + 1) / 2 : 1, q = 1 - p;
  const choose = (m, r) => { let c = 1; for (let i = 0; i < r; i++) c = (c * (m - i)) / (i + 1); return c; };
  const ways = (j) => choose(k - 1 + j, j);
  const out = [];
  for (let j = 0; j < k; j++) out.push({ a: k, b: j, p: ways(j) * p ** k * q ** j });
  for (let j = k - 1; j >= 0; j--) out.push({ a: j, b: k, p: ways(j) * q ** k * p ** j });
  return out;
}
// The likeliest score with `side` ("a" or "b") winning, as [winner's wins, loser's wins]. For
// the favourite a Bo3 is always 2–0 (2–1 needs a dropped game); a Bo5 is 3–1 below 2/3 a game.
export function likelyScore(scores, side) {
  const won = scores.filter((s) => (side === "a" ? s.a > s.b : s.b > s.a));
  const top = won.reduce((x, s) => (s.p > x.p ? s : x));
  return side === "a" ? [top.a, top.b] : [top.b, top.a];
}
// One match the model's way: the winner, its chance, the likeliest score and every score's chance.
function callMatch(ratings, a, b, bestOf) {
  const p = gameP(ratings.get(a) ?? 0, ratings.get(b) ?? 0), pa = bestOfP(p, bestOf ?? 1);
  const winner = pa >= 0.5 ? a : b, scores = bestOfScores(p, bestOf ?? 1);
  return { winner, loser: winner === a ? b : a, p: winner === a ? pa : 1 - pa, score: likelyScore(scores, winner === a ? "a" : "b"), scores };
}

// ---------- the rest of the group stage ----------

// Pairs a week swiss-style: teams in table order, each taking the nearest team below it that
// it hasn't met yet. If that can't pair everyone (small divisions run out of new opponents),
// the fewest repeat meetings win. PlayOn's own pairing ("pseudo-swiss") isn't published, so
// these are a stand-in until the real week is posted.
export function pairWeek(order, met) {
  const ids = order.length % 2 ? order.slice(0, -1) : order;
  const times = (a, b) => met.get(`${a}|${b}`) ?? 0;
  const solve = (list, allow) => {
    if (!list.length) return [];
    const [a, ...rest] = list;
    for (const b of rest) {
      if (times(a, b) > allow) continue;
      const more = solve(rest.filter((x) => x !== b), allow);
      if (more) return [[a, b], ...more];
    }
    return null;
  };
  for (let allow = 0; allow <= REG_WEEKS; allow++) {
    const p = solve(ids, allow);
    if (p) return p;
  }
  return [];
}

// A two-game series as the model calls it: favourite 2–0, or 1–1 for a coin flip. A bye is 1–0.
function callSeries(s, teamOf, ratings) {
  const h = teamOf.get(s.home), a = teamOf.get(s.away);
  if (isBye(h)) return { ...s, home_score: 0, away_score: 1 };
  if (isBye(a)) return { ...s, home_score: 1, away_score: 0 };
  const c = modelCall(seriesOdds(ratings.get(s.home) ?? 0, ratings.get(s.away) ?? 0));
  return { ...s, home_score: c === "home" ? 2 : c === "tie" ? 1 : 0, away_score: c === "away" ? 2 : c === "tie" ? 1 : 0 };
}

// Every series to the end of week 7: played ones as they are, the rest called by the model,
// and weeks PlayOn hasn't posted paired swiss-style (marked `paired`). Divisions inside one
// league (Heroic A/B) pair separately. Weeks posted = series ÷ (teams / 2), so a make-up
// played on another night doesn't count as its own week.
export function projectSeries(teams, series, ratings) {
  const teamOf = new Map(teams.map((t) => [t.id, t]));
  const real = series.filter((s) => teamOf.has(s.home) && teamOf.has(s.away));
  let out = real.map((s) => (isPlayed(s) ? { ...s } : { ...callSeries(s, teamOf, ratings), projected: true }));
  const divs = [...new Set(teams.map((t) => t.division ?? ""))];
  let next = -1;
  for (const div of divs) {
    const ids = teams.filter((t) => (t.division ?? "") === div).map((t) => t.id);
    const mine = (s) => ids.includes(s.home) && ids.includes(s.away);
    const perWeek = Math.floor(ids.length / 2);
    const posted = perWeek ? Math.round(real.filter(mine).length / perWeek) : REG_WEEKS;
    for (let wk = posted + 1; wk <= REG_WEEKS; wk++) {
      const wins = gameWins(out), met = new Map();
      for (const s of out.filter(mine)) for (const k of [`${s.home}|${s.away}`, `${s.away}|${s.home}`]) met.set(k, (met.get(k) ?? 0) + 1);
      const order = [...ids].sort((a, b) => (wins.get(b) ?? 0) - (wins.get(a) ?? 0) || (ratings.get(b) ?? 0) - (ratings.get(a) ?? 0));
      for (const [home, away] of pairWeek(order, met)) out.push({ ...callSeries({ id: next--, home, away, week: wk }, teamOf, ratings), projected: true, paired: true });
    }
  }
  return out;
}

// ---------- tiebreakers ----------

// The rules' table for a tie across a dividing line: `slots` places above the line, the tied
// teams `list` ranked by SoS (best first). Returns who ends above the line, who below, and the
// week 8 matches. `stated` is false when the rules' table doesn't list this case and the
// nearest listed pattern was followed (1 slot with 5+ teams; 4 slots with 7+; 5+ slots).
const LISTED = new Set(["1,2", "1,3", "1,4", "2,3", "2,4+", "3,4", "3,5", "3,6+", "4,5", "4,6"]);
const caseKey = (s, n) => (s === 2 && n >= 4 ? "2,4+" : s === 3 && n >= 6 ? "3,6+" : `${s},${n}`);
export function tiebreakFormat(slots, list, play) {
  const n = list.length, s = slots;
  const stated = LISTED.has(caseKey(s, n));
  if (s <= 0) return { above: [], below: list, matches: [], stated: true };
  if (s >= n) return { above: list, below: [], matches: [], stated: true };
  if (s === 1 && n === 3) {
    const m1 = play(list[1], list[2], 1, "2nd v 3rd on SoS"), m2 = play(list[0], m1.winner, 1, `1st on SoS v the winner`);
    return { above: [m2.winner], below: [m2.loser, m1.loser], matches: [m1, m2], stated };
  }
  if (s === 1 && n >= 4) {
    const m1 = play(list[0], list[3], null, "1st v 4th on SoS"), m2 = play(list[1], list[2], null, "2nd v 3rd on SoS");
    const m3 = play(m1.winner, m2.winner, null, "the two winners");
    return { above: [m3.winner], below: [m3.loser, m1.loser, m2.loser, ...list.slice(4)], matches: [m1, m2, m3], stated };
  }
  if (n - s === 1) {
    const m = play(list[s - 1], list[s], 3, s === 1 ? "" : `${ord(s)} v ${ord(s + 1)} on SoS`);
    return { above: [...list.slice(0, s - 1), m.winner], below: [m.loser], matches: [m], stated };
  }
  if (s === 2) {
    const m1 = play(list[0], list[3], 3, "1st v 4th on SoS"), m2 = play(list[1], list[2], 3, "2nd v 3rd on SoS");
    return { above: [m1.winner, m2.winner], below: [m1.loser, m2.loser, ...list.slice(4)], matches: [m1, m2], stated };
  }
  // 3+ slots, 2+ teams below: the best SoS goes through, the rest follow the smaller case.
  const r = tiebreakFormat(s - 1, list.slice(1), play);
  return { above: [list[0], ...r.above], below: r.below, matches: r.matches, stated: stated && r.stated };
}
const ord = (n) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

// Compares two tied teams: SoS, head to head (games won between them), then record against
// the highest common opponent; `last` names what decides it after that ("1v1 mid" across a
// line, "coin flip" for seeding), which the model stands in for with the stronger rating.
function comparer(series, wins, sos, ratings) {
  const played = series.filter(isPlayed);
  const vs = (a, b) => played.filter((s) => (s.home === a && s.away === b) || (s.home === b && s.away === a))
    .reduce((x, s) => x + (s.home === a ? s.home_score - s.away_score : s.away_score - s.home_score), 0);
  const opps = (t) => new Set(played.filter((s) => s.home === t || s.away === t).map((s) => (s.home === t ? s.away : s.home)));
  return (last) => (a, b) => {
    const sa = sos.get(a) ?? 0, sb = sos.get(b) ?? 0;
    if (sa !== sb) return { d: sb - sa, by: "SoS", detail: `SoS ${Math.max(sa, sb)} v ${Math.min(sa, sb)}` };
    const h = vs(a, b);
    if (h) return { d: -h, by: "head to head", detail: "head to head" };
    const oa = opps(a), ob = opps(b);
    const common = [...oa].filter((o) => ob.has(o) && o !== a && o !== b);
    if (common.length) {
      const top = Math.max(...common.map((o) => wins.get(o) ?? 0));
      const best = common.filter((o) => (wins.get(o) ?? 0) === top);
      const r = best.reduce((x, o) => x + vs(a, o) - vs(b, o), 0);
      if (r) return { d: -r, by: "highest common opponent", detail: "record against the highest common opponent", opp: best };
    }
    const ra = ratings.get(a) ?? 0, rb = ratings.get(b) ?? 0;
    return { d: rb - ra || a - b, by: last, detail: `${last} (model: the stronger team)` };
  };
}

// Final order for one division and the week 8 tiebreakers. `lines`: [{ after, above, below }]
// — places 1..after are above the line. Returns rows in order, the tiebreakers played across
// lines (with predicted winners) and the seed-order ties settled without playing.
export function resolveTable(ids, series, ratings, lines) {
  const wins = gameWins(series), sos = new Map(strengthOfSchedule(ids, series).map((r) => [r.id, r.sos ?? 0]));
  const cmp = comparer(series, wins, sos, ratings);
  const seedCmp = cmp("coin flip"), lineCmp = cmp("1v1 mid");
  const w = (t) => wins.get(t) ?? 0;
  const order = [...ids].sort((a, b) => w(b) - w(a) || seedCmp(a, b).d);
  // Segments of the table still tied with each other (same wins, not split by a tiebreaker).
  let segs = [];
  for (const t of order) {
    const last = segs.at(-1);
    if (last && w(last[0]) === w(t)) last.push(t); else segs.push([t]);
  }
  const tiebreakers = [];
  const play = (pName) => (a, b, bestOf, note) => ({ a, b, bestOf, note, ...callMatch(ratings, a, b, bestOf), for: pName });
  for (const line of lines) {
    let start = 0;
    const i = segs.findIndex((seg) => { const hit = start < line.after && start + seg.length > line.after; if (!hit) start += seg.length; return hit; });
    if (i < 0) continue;
    const seg = segs[i], slots = line.after - start;
    const ranked = [...seg].sort((a, b) => lineCmp(a, b).d);
    const r = tiebreakFormat(slots, ranked, play(line.above));
    const byPos = (xs) => [...xs].sort((a, b) => seedCmp(a, b).d);
    tiebreakers.push({ line, wins: w(seg[0]), teams: ranked, sosRank: ranked.map((t, k) => ({ id: t, sos: sos.get(t) ?? 0, by: k ? lineCmp(ranked[k - 1], t) : null })),
      slots, places: [start + 1, start + seg.length], matches: r.matches, above: r.above, below: r.below, stated: r.stated });
    segs.splice(i, 1, ...[byPos(r.above), byPos(r.below)].filter((x) => x.length));
  }
  const final = segs.flat();
  // Seed-order ties: neighbours on the same wins whose order no tiebreaker match decided.
  const settled = [];
  for (const seg of segs) for (let k = 1; k < seg.length; k++) {
    const c = seedCmp(seg[k - 1], seg[k]);
    settled.push({ above: seg[k - 1], below: seg[k], place: final.indexOf(seg[k - 1]) + 1, ...c });
  }
  return {
    rows: final.map((id, k) => ({ id, place: k + 1, wins: w(id), sos: sos.get(id) ?? 0, played: series.filter((s) => isPlayed(s) && (s.home === id || s.away === id)).length })),
    tiebreakers, settled,
  };
}

// ---------- the bracket ----------

// Double elimination from seeds (team ids, best first; a missing seed is a bye that sends its
// opponent through). Every match is played the model's way: the higher one-game chance wins.
// Rounds carry the playoff week they're played in, as S47 ran them.
export function bracket(seeds, ratings) {
  const n = seeds.length;
  if (n < 4) return null;
  const ms = [];
  const M = (id, side, week, a, b, bestOf, label) => {
    let m;
    if (a == null || b == null) m = { a, b, winner: a ?? b, loser: null, bye: true };
    else m = { a, b, ...callMatch(ratings, a, b, bestOf) };
    ms.push({ id, side, week, bestOf, label, ...m });
    return ms.at(-1);
  };
  const seed = (k) => seeds[k - 1] ?? null;
  // Seed 1 chooses 3 or 4: the model has it take whichever is weaker.
  const r = (id) => ratings.get(id) ?? 0;
  const pick = n >= 4 && r(seed(4)) > r(seed(3)) ? 3 : 4;
  const u1 = M("u1", "upper", 1, seed(1), seed(pick), 3, "Upper round 1");
  const u2 = M("u2", "upper", 1, seed(2), seed(pick === 4 ? 3 : 4), 3, "Upper round 1");
  let lbWinner;
  if (n === 4) {
    const l1 = M("l1", "lower", 2, u1.loser, u2.loser, 3, "Lower round 1");
    lbWinner = l1.winner;
    const uf = M("uf", "upper", 2, u1.winner, u2.winner, 3, "Upper final");
    const lf = M("lf", "lower", 3, uf.loser, lbWinner, 3, "Lower final");
    M("gf", "final", 4, uf.winner, lf.winner, 5, "Grand final");
  } else if (n <= 6) {
    const l1 = M("l1", "lower", 1, seed(5), seed(6), 3, "Lower round 1");
    const l2 = M("l2", "lower", 2, u2.loser, l1.winner, 3, "Lower round 2");
    const uf = M("uf", "upper", 3, u1.winner, u2.winner, 3, "Upper final");
    const l3 = M("l3", "lower", 3, u1.loser, l2.winner, 3, "Lower semifinal");
    const lf = M("lf", "lower", 4, uf.loser, l3.winner, 3, "Lower final");
    M("gf", "final", 5, uf.winner, lf.winner, 5, "Grand final");
  } else {
    const l1 = M("l1", "lower", 1, seed(5), seed(8), 3, "Lower round 1");
    const l2 = M("l2", "lower", 1, seed(6), seed(7), 3, "Lower round 1");
    const l3 = M("l3", "lower", 2, u1.loser, l2.winner, 3, "Lower round 2");
    const l4 = M("l4", "lower", 2, u2.loser, l1.winner, 3, "Lower round 2");
    const uf = M("uf", "upper", 3, u1.winner, u2.winner, 3, "Upper final");
    const l5 = M("l5", "lower", 3, l3.winner, l4.winner, 3, "Lower semifinal");
    const lf = M("lf", "lower", 4, uf.loser, l5.winner, 3, "Lower final");
    M("gf", "final", 5, uf.winner, lf.winner, 5, "Grand final");
  }
  return { matches: ms, pick, champion: ms.at(-1).winner };
}

// ---------- the whole picture ----------

// teams/series: a division's data. split: a league played in sub-divisions whose top 4 go to
// one playoff and 5–8 to another (Heroic/Aegis); those get the table and tiebreakers, but no
// bracket until AD2L says how the two divisions are seeded against each other.
export function playoffPicture(teams, series, ratings, { split = false } = {}) {
  const projected = projectSeries(teams, series, ratings);
  const divs = [...new Set(teams.map((t) => t.division ?? ""))].sort();
  return {
    series: projected,
    divisions: divs.map((div) => {
      const ids = teams.filter((t) => (t.division ?? "") === div && !isBye(t)).map((t) => t.id);
      const mine = projected.filter((s) => ids.includes(s.home) || ids.includes(s.away));
      const n = ids.length;
      const lines = split
        ? [{ after: 4, above: "Aegis playoffs", below: "Heroic playoffs" }, { after: 8, above: "Heroic playoffs", below: "out" }]
        : n >= 8 ? [{ after: 4, above: "upper bracket", below: "lower bracket" }, { after: 8, above: "playoffs", below: "out" }]
        : n > 4 ? [{ after: 4, above: "upper bracket", below: "lower bracket" }] : [];
      const table = resolveTable(ids, mine, ratings, lines.filter((l) => l.after < n));
      const seeds = table.rows.slice(0, 8).map((r) => r.id);
      return { division: div, lines, ...table, bracket: split ? null : bracket(seeds, ratings) };
    }),
  };
}
