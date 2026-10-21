import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rollPack,NEW_CARD_REROLL} from '../public/lib/cosmetics-engine.js';
import {CATALOG} from '../public/lib/cosmetics-catalog.js';
import {PACK_KIND_TYPES} from '../public/lib/pack-types.js';

const seq=values=>{let n=0;return ()=>values[n++]??0;};
const commons=CATALOG.filter(i=>i.rarity==='common');
const own=items=>Object.fromEntries(items.map(i=>[i.key,1]));

test('a duplicate swaps for an unowned card of the same rarity on a roll under 1 in 10', () => {
  const first=commons[0], inventory=own(commons.slice(0,-1));
  // Rarity 0 (common), item 0 (owned), reroll check, which unowned card.
  const hit=rollPack({packs:['common'],inventory,screens:[]},0,seq([0,0,NEW_CARD_REROLL-.001,0, 0,0,.5, 0,0,.5]));
  assert.equal(hit.rewards[0].key,commons.at(-1).key);
  assert.equal(hit.rewards[0].duplicate,false);
  // The swapped-in card now counts as owned, so later cards in the pack stay duplicates.
  assert.ok(hit.rewards.slice(1).every(r=>r.duplicate));
  const miss=rollPack({packs:['common'],inventory,screens:[]},0,seq([0,0,NEW_CARD_REROLL]));
  assert.equal(miss.rewards[0].key,first.key);
  assert.equal(miss.rewards[0].duplicate,true);
});

test('owning every card of the rarity keeps the duplicate', () => {
  const opened=rollPack({packs:['common'],inventory:own(commons),screens:[]},0,()=>0);
  assert.ok(opened.rewards.every(r=>r.duplicate));
});

test('themed packs only swap for unowned cards of their kind', () => {
  const kind='border', mine=CATALOG.filter(i=>PACK_KIND_TYPES[kind].includes(i.type)&&i.rarity==='common');
  assert.ok(mine.length>1,'needs two common borders');
  const inventory={...own(commons),[mine.at(-1).key]:0};
  const opened=rollPack({packs:[`common:${kind}`],inventory,screens:[]},0,seq([0,0,0,0]));
  assert.equal(opened.rewards[0].key,mine.at(-1).key);
  assert.equal(opened.rewards[0].duplicate,false);
});

test('with half the commons owned, about 55% of common cards are new (50% + 10% of the other 50%)', () => {
  const inventory=own(commons.slice(0,Math.floor(commons.length/2)));
  const unowned=1-Math.floor(commons.length/2)/commons.length;
  let total=0,fresh=0;
  // First card only, so each pack starts from the same collection.
  for(let n=0;n<20000;n++){const r=rollPack({packs:['common'],inventory,screens:[]},0).rewards[0];if(!commons.some(c=>c.key===r.key))continue;total++;if(!r.duplicate)fresh++;}
  const expected=unowned+(1-unowned)*NEW_CARD_REROLL;
  assert.ok(Math.abs(fresh/total-expected)<.02,`${fresh/total} vs ${expected}`);
});
