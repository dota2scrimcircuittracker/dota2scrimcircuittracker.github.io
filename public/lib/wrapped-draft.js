// The draft part of a season review (a division's, or All AD2L's): the league's drafting meta from
// its season games (lib/wrapped.js seasonGames), the way Team Wrapped's draft part
// (lib/team-wrapped.js draftOf) reads one team. No page code; pages/wrapped.js draws the cards.
import { phasedDraft } from "./draft.js";

const tally = (list) => {
  const c = new Map();
  for (const x of list) { const e = c.get(x.hero) ?? { hero: x.hero, n: 0, w: 0 }; e.n++; if (x.won) e.w++; c.set(x.hero, e); }
  return [...c.values()].sort((a, b) => b.n - a.n || b.w - a.w || String(a.hero).localeCompare(String(b.hero)));
};
const coreShare = (list) => { const k = list.filter((e) => e.pos); return k.length ? k.filter((e) => e.pos <= 3).length / k.length : null; };

// games: season games. heroCount: how many heroes are in the game (for "never picked").
// Null under 10 drafts.
export function leagueDraftOf(games, { heroCount = null, phased = phasedDraft } = {}) {
  const drafted = games.filter((m) => m.draft?.some((s) => s.pick) && m.winner);
  if (drafted.length < 10) return null;
  const bans = [], picks = [], first = [], last = [], contest = new Map();
  const order = { first: { n: 0, w: 0 }, second: { n: 0, w: 0 } };
  const side = { radiant: { n: 0, w: 0 }, firstOn: { a: { n: 0, w: 0 }, b: { n: 0, w: 0 } } };
  for (const m of drafted) {
    const steps = phased(m.draft);
    const posOf = new Map((m.players ?? []).map((p) => [`${p.team}:${p.hero}`, p.position ?? null]));
    const fp = steps.find((s) => s.kind === "pick");
    side.radiant.n++; if (m.winner === "a") side.radiant.w++;
    if (fp) {
      const fw = m.winner === fp.side;
      order.first.n++; order.second.n++;
      if (fw) order.first.w++; else order.second.w++;
      side.firstOn[fp.side].n++; if (fw) side.firstOn[fp.side].w++;
    }
    const seen = new Set();
    for (const s of steps) {
      const won = m.winner === s.side;
      seen.add(s.hero);
      if (s.kind === "ban") { bans.push({ hero: s.hero, phase: s.phase, won }); continue; }
      const e = { hero: s.hero, won, pos: posOf.get(`${s.side}:${s.hero}`) ?? null };
      picks.push(e);
      if (s.team_pick === 1) first.push(e);
      if (s.team_pick === 5) last.push(e);
    }
    for (const h of seen) contest.set(h, (contest.get(h) ?? 0) + 1);
  }
  const n = drafted.length;
  const pool = tally(picks);
  // Win-rate picks need enough games to mean something: 5+, or 5% of drafts in a big league.
  const floor = Math.max(5, Math.round(n * 0.05));
  const rated = pool.filter((e) => e.n >= floor).map((e) => ({ ...e, rate: e.w / e.n }));
  const banList = tally(bans).map((e) => {
    const p1 = bans.filter((b) => b.hero === e.hero && b.phase === 1).length;
    return { ...e, p1, rate: e.n / n };
  });
  return {
    drafts: n,
    bans: banList, banTotal: bans.length,
    picks: pool.map((e) => ({ ...e, rate: e.n / n })), pickTotal: picks.length,
    contested: [...contest].map(([hero, c]) => ({ hero, n: c, rate: c / n, picks: pool.find((e) => e.hero === hero)?.n ?? 0, pw: pool.find((e) => e.hero === hero)?.w ?? 0, bans: banList.find((e) => e.hero === hero)?.n ?? 0 }))
      .sort((a, b) => b.n - a.n || b.bans - a.bans || a.hero.localeCompare(b.hero)),
    // Banned on sight: the most bans that came in phase 1 (10+ bans, or 10% of drafts).
    onSight: banList.filter((e) => e.n >= Math.max(10, Math.round(n * 0.1))).map((e) => ({ ...e, share: e.p1 / e.n })).sort((a, b) => b.share - a.share || b.n - a.n),
    first: tally(first), firstCore: coreShare(first),
    last: tally(last), lastCore: coreShare(last),
    order, side,
    best: [...rated].sort((a, b) => b.rate - a.rate || b.n - a.n), floor,
    worst: [...rated].sort((a, b) => a.rate - b.rate || b.n - a.n),
    pool: { heroes: pool.length, never: heroCount ? Math.max(0, heroCount - contest.size) : null, once: pool.filter((e) => e.n === 1).length },
  };
}
