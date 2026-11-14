import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playerCardPool,rollPlayerPack,addPlayerCards} from '../public/lib/player-packs.js';

const tiers=new Map([['1',{tier:'S'}],['2',{tier:'A'}],['3',{tier:'B'}],['4',{tier:'D'}],['5',{tier:null}]]);
test('pool rarity follows tier, untiered players are left out',()=>{
  assert.deepEqual(playerCardPool(tiers).map(c=>c.rarity),['legendary','epic','rare','common']);
});
test('three pulls, odds by rarity, missing rarities skipped',()=>{
  const pool=playerCardPool(tiers);
  assert.deepEqual(rollPlayerPack(pool,()=>0).map(p=>p.account),['4','4','4']); // common first
  assert.deepEqual(rollPlayerPack(pool,()=>0.999).map(p=>p.account),['1','1','1']); // legendary last
  assert.deepEqual(rollPlayerPack([{account:'9',rarity:'epic'}],()=>0).map(p=>p.key),['player:9','player:9','player:9']);
  assert.throws(()=>rollPlayerPack([]));
});
test('pulls count in the inventory and flag duplicates',()=>{
  const {state,rewards}=addPlayerCards({inventory:{'player:1':1}},[{key:'player:1',account:'1',rarity:'legendary'},{key:'player:2',account:'2',rarity:'epic'},{key:'player:2',account:'2',rarity:'epic'}]);
  assert.deepEqual(state.inventory,{'player:1':2,'player:2':2});
  assert.deepEqual(rewards.map(r=>r.duplicate),[true,false,true]);
});

// Winter player packs (spec section 3): legendary 4%, arcana 1% per card overall, even when some
// positions have nobody at a rarity.
import {PLAYER_PACK_ODDS,positionOdds} from '../public/lib/player-packs.js';
const all=['common','rare','epic','legendary','arcana'];
const full=Object.fromEntries([1,2,3,4,5].map(p=>[p,all]));
const overall=(odds,r)=>[1,2,3,4,5].reduce((s,p)=>s+odds[p][r],0)/5;
test('player pack odds: legendary 4, arcana 1, summing to 100',()=>{
  assert.equal(PLAYER_PACK_ODDS.legendary,4);
  assert.equal(PLAYER_PACK_ODDS.arcana,1);
  assert.equal(Object.values(PLAYER_PACK_ODDS).reduce((a,b)=>a+b,0),100);
});
test('every position has every rarity: odds are the base odds',()=>{
  const odds=positionOdds(full);
  for(const p of [1,2,3,4,5]) assert.deepEqual(odds[p],PLAYER_PACK_ODDS);
});
test('missing rarities move to positions that have them, overall rate unchanged',()=>{
  const has={...full,3:['common','rare','epic','legendary'],5:['common','rare','epic']};
  const odds=positionOdds(has);
  assert.equal(odds[5].legendary,0);
  assert.equal(odds[5].arcana,0);
  assert.equal(odds[1].legendary,5);
  assert.ok(Math.abs(odds[1].arcana-5/3)<1e-9);
  for(const r of all) assert.ok(Math.abs(overall(odds,r)-PLAYER_PACK_ODDS[r])<1e-9,r);
  for(const p of [1,2,3,4,5]) assert.ok(Math.abs(Object.values(odds[p]).reduce((a,b)=>a+b,0)-100)<1e-9);
});
test('a rarity nobody has goes to common',()=>{
  const odds=positionOdds(Object.fromEntries([1,2,3,4,5].map(p=>[p,['common','rare','epic','legendary']])));
  for(const p of [1,2,3,4,5]){ assert.equal(odds[p].arcana,0); assert.equal(odds[p].common,PLAYER_PACK_ODDS.common+1); }
});
