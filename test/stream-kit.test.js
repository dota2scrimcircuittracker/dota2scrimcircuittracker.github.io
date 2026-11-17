import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obsCollection, rowLayout, streamCardUrl } from '../public/lib/stream-kit.js';

const root = 'https://example.test/champion';
const teams = [
  { name: 'o-b-j', players: [{ name: 'Jimmy', account: 229031494 }, { name: 'Sinatra', account: 88239134 }] },
  { name: 'Kaleb', players: [{ name: 'Jimmy', account: 1 }, { name: 'starboy', account: 124583057 }, { name: 'Lorenzo', account: 121514552 }] },
];

test('card links point at the stream card view', () => {
  assert.equal(streamCardUrl(root, 229031494), 'https://example.test/champion/player/229031494?stream=card');
});

test('one browser source per player, a scene per team and per player', () => {
  const c = obsCollection(teams, root);
  const browsers = c.sources.filter((s) => s.id === 'browser_source'), scenes = c.sources.filter((s) => s.id === 'scene');
  assert.equal(browsers.length, 5);
  assert.equal(scenes.length, 2 + 5);
  assert.equal(c.scene_order.length, scenes.length);
  assert.equal(c.current_scene, 'Team - o-b-j');
  assert.deepEqual(browsers.map((s) => s.settings.url).slice(0, 2), [streamCardUrl(root, 229031494), streamCardUrl(root, 88239134)]);
  assert.ok(browsers.every((s) => s.settings.width === 600 && s.settings.height === 840));
  // Every scene item points at a real source.
  const uuids = new Set(c.sources.map((s) => s.uuid));
  for (const s of scenes) for (const it of s.settings.items) assert.ok(uuids.has(it.source_uuid));
});

test('duplicate player names get unique source and scene names', () => {
  const names = obsCollection(teams, root).sources.map((s) => s.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes('Card - Jimmy') && names.includes('Card - Jimmy (2)'));
});

test('a row of cards stays inside the 1920x1080 canvas', () => {
  for (const n of [1, 5, 7, 10]) {
    const row = rowLayout(n);
    assert.equal(row.length, n);
    assert.ok(row[0].x >= 0 && row.at(-1).x + 600 * row.at(-1).scale <= 1920 + 1e-6, `n=${n}`);
    assert.ok(row[0].y >= 0 && row[0].y + 840 * row[0].scale <= 1080);
    assert.ok(row[0].scale <= 0.6);
  }
});

test('items carry the relative fields OBS 31+ positions by', () => {
  const it = obsCollection(teams, root).sources.find((s) => s.name === 'Player - Sinatra').settings.items[0];
  assert.deepEqual(it.pos, { x: 660, y: 120 });
  assert.deepEqual(it.pos_rel, { x: (660 - 960) / 540, y: (120 - 540) / 540 });
  assert.deepEqual(it.scale_rel, { x: 1, y: 1 });
});

test('a chosen card slot rides in the link and the OBS source name', () => {
  assert.equal(streamCardUrl(root, 5, 2), 'https://example.test/champion/player/5?stream=card&card=2');
  assert.equal(streamCardUrl(root, 5, null), 'https://example.test/champion/player/5?stream=card');
  const c = obsCollection([{ name: 'A', rootUrl: 'https://example.test/heroic', players: [{ name: 'Spiroar', account: 7, slot: 1, card: 'Chen' }] }], root);
  const src = c.sources.find((s) => s.id === 'browser_source');
  assert.equal(src.name, 'Card - Spiroar · Chen');
  assert.equal(src.settings.url, 'https://example.test/heroic/player/7?stream=card&card=1'); // the team's own league
});

test('card filters: main, highest rated, most recent', async () => {
  const { pickSlot } = await import('../public/lib/stream-kit.js');
  const designs = [
    { slot: 0, primary: true, pick: 'rare', total: 1, savedAt: 100 },
    { slot: 1, primary: false, pick: 'epic', total: 2, savedAt: 300 },
    { slot: 2, primary: false, pick: 'epic', total: 5, savedAt: 200 },
    { slot: 3, primary: false, pick: null, total: 0, savedAt: 0 },
  ];
  assert.equal(pickSlot('main', designs), null);
  assert.equal(pickSlot('top', designs), 2); // epic beats rare; more votes breaks the epic tie
  assert.equal(pickSlot('recent', designs), 1);
  // The main card winning means "main card" (null), so it follows the player's later changes.
  assert.equal(pickSlot('top', [{ slot: 0, primary: true, pick: 'legendary', total: 1 }, { slot: 1, pick: 'epic', total: 9 }]), null);
  // Nothing rated or dated: the main card.
  assert.equal(pickSlot('top', [{ slot: 1, pick: null }, { slot: 2, pick: null }]), null);
  assert.equal(pickSlot('recent', []), null);
});
