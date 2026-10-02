// The draft model (public/lib/cmdraft.js), ported from Project Sybil. The port was checked
// against Sybil's own TypeScript on random histories (largest difference 0 over 722 numbers
// a run, three seeds); these tests hold the pieces that matter to it.
import test from "node:test";
import assert from "node:assert/strict";
import { rankValue, rowPositions, rowSupportness, assignmentMarginals, heroWinRate, bracketOf, indexHistory, lobbyRank,
  historyReading, gameContext, draftProbability, scoreHeroes, readDraft, CM_STEPS, HISTORY_FIELDS, ROLES,
  heroRoleShare, fitsRole, playedAtRoles, sideComposition, flexPositions, openRoleFor, stateFeatures, buildDraft } from "../public/lib/cmdraft.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const NOW = 1_790_000_000, DAY = 86400;

test("rankValue: medals and stars as steps 1–36; Immortal 36; nonsense null", () => {
  assert.equal(rankValue(11), 1);
  assert.equal(rankValue(75), 35);
  assert.equal(rankValue(80), 36);
  assert.equal(rankValue(50), 21); // a medal with no stars reads as its first star
  assert.equal(rankValue(0), null);
  assert.equal(rankValue(null), null);
});

test("positions: a farming row reads as a core, a low-farm healer as a support; shares sum to 1", () => {
  const core = { lastHits: 300, durationSec: 2400, gpm: 650, healing: 0, laneRole: 1 };
  const sup = { lastHits: 30, durationSec: 2400, gpm: 280, healing: 5000, laneRole: 3 };
  assert.ok(rowSupportness(core) < 0.1);
  assert.ok(rowSupportness(sup) > 0.9);
  near(rowPositions(core).reduce((a, b) => a + b, 0), 1);
  near(rowPositions(sup).reduce((a, b) => a + b, 0), 1);
  assert.ok(rowPositions(core)[0] > 0.9, "safe lane core is a 1");
  assert.ok(rowPositions(sup)[3] > 0.9, "off lane support is a 4");
  near(rowSupportness({ lastHits: null }), 0.4);
});

test("assignment: exact marginals; each hero goes to someone, nobody gets two", () => {
  const w = [[0.9, 0.1], [0.1, 0.9], [0.5, 0.5]];
  const m = assignmentMarginals(w);
  for (let h = 0; h < 2; h++) near(m.reduce((s, row) => s + row[h], 0), 1);
  for (const row of m) assert.ok(row.reduce((a, b) => a + b, 0) <= 1 + 1e-12);
  // Player 0 likes hero 0, player 1 hero 1: the diagonal dominates.
  assert.ok(m[0][0] > 0.6 && m[1][1] > 0.6);
  assert.deepEqual(assignmentMarginals([[], []]), [[], []]);
});

test("heroWinRate: a thin bracket widens to its neighbours, then to every bracket", () => {
  const picks = [0, 0, 0, 0, 0, 100, 1000, 100], wins = [0, 0, 0, 0, 0, 40, 520, 70];
  near(heroWinRate([...picks, ...wins], 7), 0.52);
  near(heroWinRate([...picks, ...wins], 6), (40 + 520 + 0) / (100 + 1000)); // 6 alone has 100: 5–7
  near(heroWinRate([...picks, ...wins], 1), 630 / 1200); // nothing near Herald: all
  assert.equal(heroWinRate(undefined, 7), null);
  assert.equal(bracketOf([null, null]), "all");
  assert.equal(bracketOf([31, 31, null]), 7); // Divine 1
});

// One player's flat history rows: [t, hero, win, lobby, dur, lh, gpm, heal, lane, avgRank].
const row = (daysAgo, hero, win, { lobby = 7, lh = 250, gpm = 600, heal = 0, lane = 1, rank = 71 } = {}) =>
  [NOW - daysAgo * DAY, hero, win, lobby, 2400, lh, gpm, heal, lane, rank];

test("history: only games before the moment read; records shrink toward the baseline", () => {
  const flat = [...row(10, 1, 1), ...row(5, 1, 1), ...row(-1, 1, 0)]; // the last one is after NOW
  assert.equal(flat.length % HISTORY_FIELDS, 0);
  const ix = indexHistory(flat, NOW);
  assert.equal(ix.rows.length, 2);
  const r = historyReading(ix, 1, NOW, 0.5);
  assert.ok(r.comfort > 0.5 && r.comfort < 0.7, "2–0 is shrunk hard toward 50%");
  assert.ok(r.borrowed > 0.8 && r.borrowed < 1);
  assert.deepEqual(historyReading(ix, 2, NOW, 0.47), { comfort: 0.47, borrowed: 1, games: 0 });
  // Rank: median of the last pub lobbies, 3+ needed.
  assert.equal(lobbyRank(ix, NOW), null);
  const ix3 = indexHistory([...row(3, 1, 1, { rank: 61 }), ...row(2, 1, 1, { rank: 65 }), ...row(1, 1, 1, { rank: 63 })], NOW);
  assert.equal(lobbyRank(ix3, NOW), rankValue(63));
});

// Two teams: Radiant players each have a comfort hero they win on; Dire are unknown accounts.
const heroIds = [...ROLES.keys()].slice(0, 30);
const data = {
  baselines: Object.fromEntries(heroIds.map((h) => [h, [0, 0, 0, 0, 0, 0, 2000, 0, 0, 0, 0, 0, 0, 0, 1000, 0]])),
  history: Object.fromEntries([0, 1, 2, 3, 4].map((j) => [`p${j}`, Array.from({ length: 30 }, (_, i) => row(i * 3 + 1, heroIds[j], i % 4 ? 1 : 0, { lh: j < 3 ? 280 : 40, gpm: j < 3 ? 620 : 300, heal: j > 2 ? 4000 : 0, lane: j < 3 ? j + 1 : 3 })).flat()])),
};
const sides = { radiant: [0, 1, 2, 3, 4].map((j) => ({ key: `p${j}`, rank_tier: 71 })), dire: [0, 1, 2, 3, 4].map(() => ({ key: null, rank_tier: 71 })) };

test("a draft: the comfort hero is the best pick, played by its owner; an unplayed hero costs", () => {
  const ctx = gameContext(data, sides, NOW);
  assert.equal(ctx.rankLead, 0);
  const empty = { radiant: [], dire: [] };
  const p0 = draftProbability(ctx, empty);
  assert.ok(p0 > 0.5, "the side with known, winning players starts ahead");
  const best = scoreHeroes(ctx, empty, "radiant", heroIds);
  assert.ok(heroIds.slice(0, 5).includes(best[0].hero), "a comfort hero tops the list");
  assert.equal(best[0].player, heroIds.indexOf(best[0].hero), "and goes to the player who plays it");
  // Banning a comfort hero denies Radiant the most: from Dire's view, its ban value is highest.
  const bans = scoreHeroes(ctx, empty, "dire", heroIds).sort((a, b) => b.ban - a.ban);
  assert.ok(heroIds.slice(0, 5).includes(bans[0].hero));
  // A pick moves a player only by how far the hero is from their usual one: their own hero
  // leaves the chance about where it was, a hero none of them plays costs more.
  const own = draftProbability(ctx, { radiant: [heroIds[0]], dire: [] }), unplayed = draftProbability(ctx, { radiant: [heroIds[20]], dire: [] });
  near(own, p0, 0.01);
  assert.ok(unplayed < own - 0.01);
});

test("readDraft walks a Captains Mode draft: 24 steps, ranks for each choice, bans don't move the chance", () => {
  const ctx = gameContext(data, sides, NOW);
  const steps = CM_STEPS.map(([fs, kind], i) => ({ side: fs === "F" ? "radiant" : "dire", pick: kind === "pick", hero: heroIds[(i + 5) % 30] }));
  const r = readDraft(ctx, steps, heroIds);
  assert.equal(r.steps.length, 24);
  r.steps.forEach((s, i) => {
    const before = i ? r.steps[i - 1].p : r.start;
    if (!s.pick) near(s.p, before);
    assert.ok(s.view.rank >= 1 && s.view.rank <= s.view.of);
  });
  assert.equal(r.assignment.radiant.length, 5);
  assert.equal(CM_STEPS.filter(([, k]) => k === "pick").length, 10);
});

// Hero ids: Luna 48 and Lifestealer 54 (carries), Axe 2 and Tidehunter 29 (offlaners), Crystal Maiden 5.
test("role filter: Sybil's lane-parsed table separates carries from offlaners; a player's own parsed games count", () => {
  assert.ok(heroRoleShare(48, 0) > 0.9 && heroRoleShare(29, 2) > 0.8);
  assert.ok(!fitsRole(29, 0, null), "carry Tidehunter is not offered on population numbers");
  assert.ok(fitsRole(29, 2, null));
  // Two lane-parsed safe-lane farming games on Tidehunter make it this player's carry; unparsed ones don't.
  const parsed = indexHistory([...row(3, 29, 1, { lane: 1 }), ...row(2, 29, 1, { lane: 1 })], NOW);
  const unparsed = indexHistory([...row(3, 29, 1, { lane: 0 }), ...row(2, 29, 1, { lane: 0 })], NOW);
  assert.ok(fitsRole(29, 0, playedAtRoles(parsed)));
  assert.ok(!fitsRole(29, 0, playedAtRoles(unparsed)));
});

test("composition: two carries take position 1 once; a third carry fits no open position", () => {
  const ctx = gameContext(data, sides, NOW);
  const state = { radiant: [48, 2], dire: [] };
  const comp = sideComposition(ctx.radiant, state.radiant, stateFeatures(ctx, state).assignment.radiant);
  assert.equal(comp.positions[0], 0);
  assert.notEqual(comp.positions[1], 0);
  assert.ok(!comp.open.includes(0) && comp.open.includes(4));
  // Lifestealer only plays 1 (taken); Crystal Maiden fits the open 5.
  const fake = ctx.radiant.map((p) => ({ ...p, playedAt: new Map() }));
  assert.equal(openRoleFor(54, comp.open, fake), null);
  assert.equal(openRoleFor(5, comp.open, fake), 4);
});

test("composition: a hero plays where its player plays, not where pubs play it", () => {
  const ctx = gameContext(data, sides, NOW);
  // Axe (pubs: a 3) picked for p1, who plays mid: a 2. For p2, the off laner: a 3.
  for (const [j, pos] of [[1, 1], [2, 2]]) {
    const state = { radiant: [2], dire: [], pins: { radiant: [j], dire: [] } };
    assert.equal(sideComposition(ctx.radiant, state.radiant, stateFeatures(ctx, state).assignment.radiant).positions[0], pos);
  }
  // Axe is an off laner only; Earth Spirit plays mid and support. A 4/5 swap alone isn't flex.
  assert.deepEqual(flexPositions(2), []);
  assert.deepEqual(flexPositions(107), [1, 3]);
});

test("composition: a pick's chosen position is kept, and a held position refits the pick there", () => {
  const ctx = gameContext(data, sides, NOW);
  const state = { radiant: [48, 2], dire: [] };
  const m = stateFeatures(ctx, state).assignment.radiant;
  // Axe picked as a 4: kept, though the model would fit it at 3.
  assert.deepEqual(sideComposition(ctx.radiant, state.radiant, m, [null, 3]).positions, [0, 3]);
  // Position 3 held for the next pick: Axe, fitted there before, moves.
  const held = sideComposition(ctx.radiant, state.radiant, m, [], 2);
  assert.equal(held.positions[0], 0);
  assert.notEqual(held.positions[1], 2);
  assert.ok(!held.open.includes(2));
});

test("buildDraft: 24 steps, no hero twice, each side's picks to five different players at five positions", () => {
  const ctx = gameContext(data, sides, NOW);
  const order = CM_STEPS.map(([f, k]) => [f === "F" ? "radiant" : "dire", k]);
  const r = buildDraft(ctx, order, [...ROLES.keys()]);
  assert.equal(r.steps.length, 24);
  assert.equal(r.values.length, 25);
  assert.equal(new Set(r.steps.map((x) => x.hero)).size, 24);
  for (const side of ["radiant", "dire"]) {
    const picks = r.steps.filter((x) => x.pick && x.side === side);
    assert.deepEqual(picks.map((x) => x.player).sort(), [0, 1, 2, 3, 4]);
    const st = { radiant: [], dire: [], pins: { radiant: [], dire: [] } };
    for (const x of r.steps.filter((y) => y.pick)) { st[x.side].push(x.hero); st.pins[x.side].push(x.player); }
    const comp = sideComposition(ctx[side], st[side], stateFeatures(ctx, st).assignment[side]);
    assert.deepEqual([...comp.positions].sort(), [0, 1, 2, 3, 4]);
  }
});
