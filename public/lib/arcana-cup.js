// The Arcana Cup (Gallery › Arcana Cup): a week to enter up to two card designs, then a
// double-elimination bracket of them voted in 24-hour rounds. You can't vote in a matchup with your
// card in it. The top 3 of each bracket (6 in all) become Arcana player cards for the next mini's
// packs; 1st, 2nd and 3rd of each get a legendary, epic and rare pack. While voting, people still rate each card common to legendary
// (lib/card-ratings.js), which feeds player-pack rarities. The collection Worker
// (workers/steam-auth/src/cosmetics.js) stores entries, the seeded bracket, votes and each settled
// result; this file is the rules, no storage.

// Times are UTC. Entries close and round 1 opens at votingAt: Sat Oct 31 2026, 9pm ET (EDT, so 01:00 UTC Nov 1).
// Extended a day from Fri Oct 30.
// Three entries a player, two at most in one category: 2+1 either way.
export const CUP = Object.freeze({ id: 1, name: 'Arcana Cup', votingAt: Date.UTC(2026, 10, 1, 1), roundMs: 24 * 36e5, maxEntries: 3, maxPerCategory: 2 });
export const PRIZES = ['legendary', 'epic', 'rare'];
// Top 3 of each bracket become Arcana (6 in all) and win that bracket's packs.
export const ARCANA_PLACES = 3;
// Two lanes, each its own double-elimination bracket, so a joke card never beats a carefully made
// one. Funny judges the joke; Artistic judges the craft, and Fav removes troll entries from it.
export const CATEGORIES = Object.freeze({
  artistic: { name: 'Artistic', blurb: 'Craft, composition and taste. Voted on how good the card looks and feels. Troll entries are removed.' },
  funny: { name: 'Funny', blurb: 'The best joke. Memes, puns and bits belong here, not in Artistic.' },
});
export const categoryOf = (value) => (value in CATEGORIES ? value : null);
// Fav removes entries by judgement; a player with this many removals can't enter any more.
export const MAX_STRIKES = 3;

// A frozen copy of the design at the moment it was entered: later edits in Customize don't touch it.
export const entryId = (account, n) => `${account}-${n}`;

// Shuffled in place (Fisher-Yates) with the given random source.
function shuffle(list, random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// The first round as a flat list of slots (entry id or null for a bye), two per match. The size is
// the next power of two. A player's two cards go on opposite halves, so they can only meet in the
// final; byes are spread one per match, so no match is two byes.
export function seedBracket(entries, random = Math.random) {
  if (entries.length < 2) throw new Error('The cup needs at least two cards.');
  let size = 2;
  while (size < entries.length) size *= 2;
  const byOwner = new Map();
  for (const e of entries) byOwner.set(String(e.account), [...(byOwner.get(String(e.account)) ?? []), e.id]);
  const halves = [[], []], singles = [];
  for (const ids of shuffle([...byOwner.values()], random)) {
    if (ids.length > 1) { const [a, b] = shuffle([...ids], random); halves[0].push(a); halves[1].push(b); }
    else singles.push(ids[0]);
  }
  for (const id of singles) halves[halves[0].length <= halves[1].length ? 0 : 1].push(id);
  if (size === 2) return [halves[0][0] ?? halves[1][1], halves[1][0] ?? halves[0][1]];
  const perHalf = size / 4; // matches in each half
  return halves.flatMap((half) => {
    const ids = shuffle([...half], random), byes = perHalf * 2 - ids.length, matches = [];
    for (let m = 0; m < perHalf; m++) matches.push(m < byes ? [ids.shift(), null] : [ids.shift(), ids.shift()]);
    return shuffle(matches, random).flat();
  });
}

// Double elimination. Every match, built from the seeds and the results settled so far, grouped by
// the 24-hour round it's voted in (round s runs from votingAt + s rounds). A match whose sides
// aren't known yet has a or b undefined; a bye is null.
// - Winners bracket (w<r>-<i>): k = log2(size) rounds, round r voted in round r.
// - Losers bracket (l<r>-<i>): 2k - 2 rounds, round r voted in round r + 1. Even rounds pair the
//   losers bracket's own winners (round 0: the winners bracket's round-1 losers); odd rounds meet
//   the cards just dropped from the winners bracket, in reverse order so rematches come late.
// - Grand final (gf): the winners bracket's winner against the losers bracket's, one match, no reset.
export function buildBracket(seeds, results = {}, cup = CUP) {
  const k = Math.log2(seeds.length), rounds = [];
  const win = (id) => results[id] ? results[id].winner : undefined, lose = (id) => results[id] ? results[id].loser : undefined;
  // cup.extend ({ step: ms }) is Fav's extensions: a round that ran long pushes every later round back.
  const offset = (step) => { let t = 0; for (let s = 0; s < step; s++) t += cup.roundMs + (cup.extend?.[s] ?? 0); return t; };
  const add = (bracket, round, step, index, a, b) => {
    const id = bracket === 'gf' ? 'gf' : `${bracket}${round}-${index}`, opensAt = cup.votingAt + offset(step);
    (rounds[step] ??= []).push({ id, bracket, round, step, a, b, opensAt, closesAt: opensAt + cup.roundMs + (cup.extend?.[step] ?? 0), result: results[id] ?? null });
  };
  for (let r = 0; r < k; r++) for (let i = 0; i < seeds.length / 2 ** (r + 1); i++)
    add('w', r, r, i, ...(r === 0 ? [seeds[i * 2], seeds[i * 2 + 1]] : [win(`w${r - 1}-${i * 2}`), win(`w${r - 1}-${i * 2 + 1}`)]));
  for (let r = 0; r < 2 * k - 2; r++) {
    const j = Math.floor(r / 2), count = seeds.length / 2 ** (j + 2);
    for (let i = 0; i < count; i++) {
      if (r === 0) add('l', r, 1, i, lose(`w0-${i * 2}`), lose(`w0-${i * 2 + 1}`));
      else if (r % 2 === 0) add('l', r, r + 1, i, win(`l${r - 1}-${i * 2}`), win(`l${r - 1}-${i * 2 + 1}`));
      else add('l', r, r + 1, i, win(`l${r - 1}-${i}`), lose(`w${j + 1}-${count - 1 - i}`));
    }
  }
  add('gf', 0, k === 1 ? 1 : 2 * k - 1, 0, win(`w${k - 1}-0`), k === 1 ? lose('w0-0') : win(`l${2 * k - 3}-0`));
  return rounds;
}
// What a match is called: "Winners semi-finals", "Losers round 3", "Grand final".
export function matchLabel(m, size) {
  const k = Math.log2(size);
  if (m.bracket === 'gf') return 'Grand final';
  if (m.bracket === 'w') return `Winners ${m.round === k - 1 ? 'final' : m.round === k - 2 ? 'semi-finals' : m.round === k - 3 ? 'quarter-finals' : `round ${m.round + 1}`}`;
  return m.round === 2 * k - 3 ? 'Losers final' : `Losers round ${m.round + 1}`;
}

const sidesKnown = (m) => m.a !== undefined && m.b !== undefined;
// Matches that have closed, have both sides and no result yet. Settle them in this order, then
// rebuild: their winners fill the next round.
export const dueMatches = (rounds, now) => rounds.flat().filter((m) => !m.result && sidesKnown(m) && now >= m.closesAt);
// The match a voter can vote in right now: open, both sides cards, and neither card theirs.
export const isVotable = (m, now) => !m.result && sidesKnown(m) && m.a && m.b && now >= m.opensAt && now < m.closesAt;

// Matches with both cards known where a card was removed: settled at once as a forfeit, without
// waiting for the round to close.
export const forfeits = (rounds, info = {}) => rounds.flat().filter((m) => !m.result && m.a && m.b && (info[m.a]?.removed || info[m.b]?.removed));

// A tie nobody can call is settled by a coin that depends only on the match, so the Worker and the
// browser agree and entering early gives no edge.
export function coinFlip(m) {
  let h = 0;
  for (const ch of `${m.id}|${[m.a, m.b].sort().join('|')}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [lo, hi] = [m.a, m.b].sort();
  return h % 2 === 0 ? lo : hi;
}

// A closed match's result. A removed card forfeits. More votes wins; a tie goes to the card with
// more rarity ratings, then to the match's coin flip. A bye goes to the card that's there.
export function decideMatch(m, votes = {}, info = {}) {
  const count = { a: 0, b: 0 };
  for (const pick of Object.values(votes ?? {})) if (pick === m.a) count.a++; else if (pick === m.b) count.b++;
  const result = (winner, loser) => ({ winner, loser, votes: { [m.a ?? 'bye-a']: count.a, [m.b ?? 'bye-b']: count.b } });
  if (!m.a && !m.b) return result(null, null);
  if (!m.b) return result(m.a, null);
  if (!m.a) return result(m.b, null);
  const gone = (id) => !!info[id]?.removed;
  if (gone(m.a) !== gone(m.b)) return gone(m.a) ? result(m.b, m.a) : result(m.a, m.b);
  const ra = info[m.a]?.ratings ?? 0, rb = info[m.b]?.ratings ?? 0;
  const aWins = count.a !== count.b ? count.a > count.b : ra !== rb ? ra > rb : coinFlip(m) === m.a;
  return aWins ? result(m.a, m.b) : result(m.b, m.a);
}

// Final placings once the grand final is settled: its winner and loser, then everyone else by the
// losers-bracket round they went out in (later is higher, so the losers final's loser is 3rd), the
// votes they took in that match, then their rarity ratings.
export function placings(rounds, info = {}) {
  const all = rounds.flat(), gf = all.find((m) => m.id === 'gf');
  if (!gf?.result) return null;
  const top = [gf.result.winner, gf.result.loser].filter(Boolean);
  const out = all.filter((m) => m.bracket === 'l' && m.result?.loser && !top.includes(m.result.loser)).map((m) => ({ id: m.result.loser, round: m.round, votes: m.result.votes[m.result.loser] ?? 0 }));
  out.sort((x, y) => y.round - x.round || y.votes - x.votes || (info[y.id]?.ratings ?? 0) - (info[x.id]?.ratings ?? 0) || (info[x.id]?.at ?? 0) - (info[y.id]?.at ?? 0));
  return [...top, ...out.map((o) => o.id)];
}

// Each matchup has a discussion thread. A live one stays shut until you have voted in it, so the
// vote count and the comments can't sway your pick. The owner of a card in it (who can't vote) and
// Fav see it from the start. Once the match is settled anyone can read it; comments close with it.
export function threadAccess(m, now, { pick = null, owner = false, admin = false } = {}) {
  const voted = pick != null || owner || admin;
  return { read: !!m.result || voted, write: voted && isVotable(m, now) };
}

export function phaseAt(now, rounds, cup = CUP) {
  if (now < cup.votingAt) return 'entries';
  if (!rounds) return 'cancelled'; // fewer than two cards when entries closed
  return placings(rounds) ? 'done' : 'voting';
}
