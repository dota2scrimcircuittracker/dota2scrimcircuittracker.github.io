import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fantasyFacts, rewardLabel, rewardGrantable, ACHIEVEMENTS, achievementStatus, claimAchievement, claimable } from '../public/lib/achievements.js';
import { fantasyEntries, madeCount } from '../workers/steam-auth/src/cosmetics.js';
import { packOdds, oddsText, ODDS_ROWS } from '../public/lib/pack-types.js';
import { rollPack } from '../public/lib/cosmetics-engine.js';
import { giftPacks, giftLabel } from '../public/lib/pack-gifts.js';
import { itemByKey, TIERS } from '../public/lib/cosmetics-catalog.js';

test('every achievement has a unique id and a pack reward', () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  for (const a of ACHIEVEMENTS) { assert.ok(rewardLabel(a.reward).endsWith('pack'), a.id); assert.ok(a.soon || a.goal > 0, a.id); }
  assert.equal(ACHIEVEMENTS.find((a) => a.id === 'fantasy-win').reward, 'legendary');
});

test('status caps progress at the goal and marks done and claimed', () => {
  const s = achievementStatus({ rated: 12, posts: 1, legendaryVotes: 15 }, { 'post-1': 1 });
  const by = (id) => s.find((a) => a.id === id);
  assert.equal(by('rate-5').done, true);
  assert.equal(by('rate-25').value, 12);
  assert.equal(by('rate-25').done, false);
  assert.equal(by('post-1').claimed, true);
  assert.equal(by('legend-15').done, true);
  assert.equal(by('fantasy-win').done, false);
});

test('claiming adds one pack of the reward tier and records the claim', () => {
  const next = claimAchievement({ packs: ['common'] }, 'legend-15', { legendaryVotes: 15 }, 99);
  assert.deepEqual(next.packs, ['common', 'epic']);
  assert.equal(next.achievementClaims['legend-15'], 99);
});

test('claiming is refused when unearned, repeated, unknown or not live yet', () => {
  assert.throws(() => claimAchievement({}, 'legend-15', { legendaryVotes: 14 }), /haven't earned/);
  const once = claimAchievement({}, 'post-1', { posts: 1 });
  assert.throws(() => claimAchievement(once, 'post-1', { posts: 9 }), /already claimed/);
  assert.throws(() => claimAchievement({}, 'nope', {}), /Choose/);
  assert.throws(() => claimAchievement({}, 'fantasy-win', { fantasyWins: 9 }), /isn't available/);
});

test('claimable lists earned, unclaimed, live achievements only', () => {
  const ids = claimable({ posts: 5, nickname: 1 }, { 'post-1': 1 }).map((a) => a.id);
  assert.deepEqual(ids, ['post-5', 'nickname']);
});

test('comments are live', () => {
  const by = (id) => achievementStatus({ comments: 10 }, {}).find((a) => a.id === id);
  assert.equal(by('comment-1').done, true);
  assert.equal(by('comment-10').done, true);
});

test('reward labels: plain packs have no kind, themed packs name it', () => {
  assert.equal(rewardLabel('common'), 'Common pack');
  assert.equal(rewardLabel('legendary'), 'Legendary pack');
  assert.equal(rewardLabel('screens'), 'Background pack');
  assert.equal(rewardLabel('epic:signature'), 'Epic signature pack');
  assert.equal(rewardLabel('rare:player'), 'Rare player card pack');
  assert.equal(rewardGrantable('epic:signature'), true);
  assert.equal(rewardGrantable('rare:player'), false);
});

test('a background achievement grants a signature pack', () => {
  assert.deepEqual(claimAchievement({ packs: [] }, 'background', { background: 1 }).packs, ['common:signature']);
});

test('league performance achievements are listed with rewards but not claimable yet', () => {
  const league = ACHIEVEMENTS.filter((a) => a.group === 'League');
  assert.deepEqual(league.map((a) => a.id), ['playoffs', 'upper-bracket', 'grand-final', 'league-win', 'tiebreaker']);
  assert.equal(league.find((a) => a.id === 'league-win').reward, 'legendary');
  assert.ok(league.every((a) => a.soon));
});

test('follow 10 is live; 25 followers pays an epic signature pack', () => {
  assert.equal(claimAchievement({}, 'follow-10', { follows: 10 }).packs[0], 'common');
  const a = achievementStatus({ followers: 25 }, {}).find((x) => x.id === 'followers-25');
  assert.equal(a.reward, 'epic:signature');
  assert.equal(rewardLabel(a.reward), 'Epic signature pack');
  assert.equal(a.done, true);
  assert.equal(a.payable, true);
  assert.deepEqual(claimAchievement({}, 'followers-25', { followers: 25 }).packs, ['epic:signature']);
});

test('five posts pays a rare signature pack; a player card pack can be named but not claimed', () => {
  const a = achievementStatus({ posts: 5 }, {}).find((x) => x.id === 'post-5');
  assert.equal(a.reward, 'rare:signature');
  assert.equal(a.done && a.payable, true);
  assert.deepEqual(claimAchievement({}, 'post-5', { posts: 5 }).packs, ['rare:signature']);
});

test('border and finish packs are named kinds; designer and comment rewards use them', () => {
  assert.equal(rewardLabel('common:border'), 'Common border pack');
  assert.equal(rewardLabel('rare:finish'), 'Rare finish pack');
  const by = (id) => ACHIEVEMENTS.find((a) => a.id === id).reward;
  assert.deepEqual([by('cards-1'), by('cards-3'), by('legend-5'), by('comment-10')], ['common:border', 'rare:border', 'rare:finish', 'rare:finish']);
});

test('predictions, brackets, hero grids and drafts are live and unlock from their facts', () => {
  for (const [id, stat] of [['predict', 'predictions'], ['bracket', 'brackets'], ['hero-grid', 'heroGrids'], ['draft', 'drafts']]) {
    assert.equal(ACHIEVEMENTS.find((a) => a.id === id).stat, stat);
    assert.throws(() => claimAchievement({}, id, { [stat]: 0 }), /haven't earned/);
    assert.equal(claimAchievement({}, id, { [stat]: 1 }).packs.length, 1);
  }
});

test('madeCount counts the documents a Steam account made in a collection', async () => {
  let sent;
  const fetcher = async (url, init) => { sent = JSON.parse(init.body); return Response.json([{ document: { fields: {} } }, { document: { fields: {} } }, { readTime: 'x' }]); };
  assert.equal(await madeCount('predictions', '42', fetcher), 2);
  assert.equal(sent.structuredQuery.from[0].collectionId, 'predictions');
  assert.equal(sent.structuredQuery.where.fieldFilter.value.stringValue, 'steam:42');
});

test('fantasyFacts counts distinct weeks and the longest run of weeks exactly 7 days apart', () => {
  const e = (...weeks) => weeks.map((week) => ({ week }));
  assert.deepEqual(fantasyFacts([]), { fantasyWeeks: 0, fantasyStreak: 0 });
  assert.deepEqual(fantasyFacts(null), { fantasyWeeks: 0, fantasyStreak: 0 });
  assert.deepEqual(fantasyFacts(e('2026-10-12')), { fantasyWeeks: 1, fantasyStreak: 1 });
  // two leagues in one week count once; a missed week breaks the run; month ends are fine
  const run = fantasyFacts(e('2026-10-12', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-23', '2026-11-30'));
  assert.deepEqual(run, { fantasyWeeks: 7, fantasyStreak: 5 });
  assert.deepEqual(fantasyFacts(e('bad', undefined, '2026-10-12')), { fantasyWeeks: 1, fantasyStreak: 1 });
});

test('fantasy achievements are live and unlock from the facts', () => {
  assert.equal(claimAchievement({}, 'fantasy-lineup', { fantasyWeeks: 1 }).packs[0], 'common');
  assert.throws(() => claimAchievement({}, 'fantasy-streak', { fantasyStreak: 4 }), /haven't earned/);
  assert.equal(claimAchievement({}, 'fantasy-streak', { fantasyStreak: 5 }).packs[0], 'epic');
});

test('fantasyEntries asks Firestore for one account and reads the weeks', async () => {
  let sent;
  const fetcher = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return Response.json([{ document: { fields: { week: { stringValue: '2026-10-12' } } } }, { readTime: 'x' }]); };
  assert.deepEqual(await fantasyEntries('173365627', fetcher), [{ week: '2026-10-12' }]);
  assert.match(sent.url, /runQuery$/);
  assert.equal(sent.body.structuredQuery.where.fieldFilter.value.integerValue, '173365627');
  await assert.rejects(fantasyEntries('1', async () => new Response('no', { status: 403 })), /unavailable/);
});

test('designer pays a common border pack that opens to three borders', () => {
  const next = claimAchievement({ packs: [], inventory: {} }, 'cards-1', { cards: 1 });
  assert.deepEqual(next.packs, ['common:border']);
  const opened = rollPack({ ...next, inventory: {}, screens: [] }, 0, () => 0.5);
  assert.equal(opened.rewards.length, 3);
  assert.ok(opened.rewards.every((r) => itemByKey(r.key).type === 'border'));
  assert.deepEqual(opened.state.packs, []);
  assert.deepEqual(opened.screens, []);
});

test('themed packs: finish and signature draw only their types, never below their rarity', () => {
  for (let n = 0; n < 40; n++) {
    const finish = rollPack({ packs: ['epic:finish'], inventory: {}, screens: [] }, 0, Math.random);
    assert.ok(finish.rewards.every((r) => itemByKey(r.key).type === 'finish' && ['epic', 'legendary'].includes(itemByKey(r.key).rarity)));
    const sig = rollPack({ packs: ['common:signature'], inventory: {}, screens: [] }, 0, Math.random);
    assert.ok(sig.rewards.every((r) => ['autograph', 'translation'].includes(itemByKey(r.key).type)));
  }
});

test('themed packs can be gifted and are labelled', () => {
  const next = giftPacks({ packs: [], gifts: [] }, { kind: 'pack', tier: 'rare:border', count: 2 });
  assert.deepEqual(next.packs, ['rare:border', 'rare:border']);
  assert.equal(giftLabel(next.gifts[0]), '2 rare border packs');
  assert.throws(() => giftPacks({ packs: [] }, { kind: 'pack', tier: 'rare:player' }), /Choose a pack type/);
});

test('signing your profile pays a border pack; best bracket is listed for later', () => {
  assert.deepEqual(claimAchievement({ packs: [] }, 'signature', { signature: 1 }).packs, ['common:border']);
  assert.throws(() => claimAchievement({}, 'signature', { signature: 0 }), /haven't earned/);
  const b = ACHIEVEMENTS.find((a) => a.id === 'best-bracket');
  assert.equal(b.soon, true);
  assert.throws(() => claimAchievement({}, 'best-bracket', {}), /isn't available/);
});

test('border and signature packs hold exactly three items and no bonus screens', () => {
  for (const pack of ['common:border', 'rare:border', 'common:signature', 'legendary:signature']) {
    const o = rollPack({ packs: [pack], inventory: {}, screens: [] }, 0, Math.random);
    assert.equal(o.rewards.length, 3);
    assert.deepEqual(o.screens, []);
  }
});

test('a themed pack keeps the site odds: a common signature pack is 4% legendary, empty rarities move up', () => {
  const share = (pack, n = 20000) => {
    const c = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < n / 3; i++) for (const r of rollPack({ packs: [pack], inventory: {}, screens: [] }, 0, Math.random).rewards) c[itemByKey(r.key).rarity]++;
    const t = Object.values(c).reduce((a, b) => a + b, 0);
    return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v / t]));
  };
  const near = (x, want) => assert.ok(Math.abs(x - want) < 0.03, `${x} vs ${want}`);
  const sig = share('common:signature');
  near(sig.legendary, 0.04); near(sig.epic, 0.10); near(sig.rare, 0.86); assert.equal(sig.common, 0);
  const rare = share('rare:signature');
  near(rare.legendary, 4 / 31); // floor of rare renormalises the same as a normal rare pack
  const border = share('common:border');
  near(border.common, 0.69); near(border.legendary, 0.04);
});

test('packOdds and oddsText give the odds shown on the site', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 0.001, `${a} vs ${b}`);
  const c = packOdds('common');
  near(c.common, 0.69); near(c.legendary, 0.04);
  near(packOdds('rare:border').rare, 17 / 31); near(packOdds('rare:finish').legendary, 4 / 31);
  near(packOdds('epic').epic, 10 / 14);
  near(packOdds('common:signature').rare, 0.86); near(packOdds('common:signature').common, 0);
  assert.equal(oddsText('common'), 'Common 69% · Rare 17% · Epic 10% · Legendary 4%');
  assert.equal(oddsText('legendary:signature'), 'Legendary 100%');
  assert.equal(oddsText('common:signature'), 'Rare 86% · Epic 10% · Legendary 4%');
  assert.equal(ODDS_ROWS.length, 16);
  for (const [pack] of ODDS_ROWS) near(Object.values(packOdds(pack)).reduce((a, b) => a + b, 0), 1);
});

test('sending a pack earns Generous', () => {
  assert.equal(ACHIEVEMENTS.find((a) => a.id === 'send-pack').stat, 'packsSent');
  assert.deepEqual(claimAchievement({ packs: [] }, 'send-pack', { packsSent: 1 }).packs, ['common']);
  assert.throws(() => claimAchievement({}, 'send-pack', { packsSent: 0 }), /haven't earned/);
});
