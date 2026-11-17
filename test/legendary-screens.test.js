import {test} from 'node:test';
import assert from 'node:assert/strict';
import {grantLogin,rollPack,setProfileBackground,equipCosmetics} from '../public/lib/cosmetics-engine.js';
import {LEGENDARY_SCREENS} from '../public/lib/legendary-screens.js';
import {screenArt,cardArtOptions} from '../public/lib/card-art.js';

const gaben='scr:saint-gaben';
const withPack=pack=>({...grantLogin(null,new Date(0)),packs:[pack]});
// Rolls in order: three different borders take two numbers each (a duplicate would add a reroll check),
// then the background check, then which one.
const seq=values=>{let n=0;return ()=>values[n++]??0;};

test('a border pack gives a legendary background on a roll under 4%', () => {
  const hit=rollPack(withPack('common:border'),0,seq([.5,.1,.5,.5,.5,.9,.039,0]));
  assert.deepEqual(hit.screens,[gaben]);
  assert.ok(hit.state.screens.includes(gaben));
  assert.equal(hit.rewards.length,3);
  const miss=rollPack(withPack('common:border'),0,seq([.5,.1,.5,.5,.5,.9,.04,0]));
  assert.deepEqual(miss.screens,[]);
});

test('no second copy, and other themed packs never give one', () => {
  const owned={...withPack('common:border'),screens:LEGENDARY_SCREENS.filter(s=>s.drops!==false).map(s=>s.id)};
  assert.deepEqual(rollPack(owned,0,()=>0).screens,[]);
  assert.deepEqual(rollPack(withPack('common:finish'),0,()=>0).screens,[]);
});

test('normal packs never roll a legendary background', () => {
  for(let n=0;n<50;n++)assert.ok(!rollPack(withPack('common'),0,Math.random).screens.includes(gaben));
});

test('Saint Gaben works as a profile background and card art', () => {
  const state={...withPack('common'),screens:[gaben]};
  assert.doesNotThrow(()=>setProfileBackground(state,{background:{id:gaben}}));
  const art=screenArt(gaben);
  assert.equal(art.legendary,true);
  assert.match(art.src,/img\/loading-screens\/saint-gaben\.webp$/);
});

test('gift-only backgrounds never drop from border packs', () => {
  const giftOnly=LEGENDARY_SCREENS.filter(s=>s.drops===false).map(s=>s.id);
  assert.ok(giftOnly.includes('scr:chen-spiroar'));
  for(let n=0;n<200;n++){
    const r=rollPack(withPack('common:border'),0,Math.random);
    assert.ok(!r.screens.some(id=>giftOnly.includes(id)));
  }
  const rest={...withPack('common:border'),screens:LEGENDARY_SCREENS.filter(s=>s.drops!==false).map(s=>s.id)};
  assert.deepEqual(rollPack(rest,0,()=>0).screens,[]);
});

test('Chen and El Sombrero belong to Chen and Storm Spirit', () => {
  const owned=['scr:chen-spiroar','scr:el-sombrero'];
  const ids=hero=>cardArtOptions(hero,owned).map(a=>a.id);
  assert.ok(ids('Chen').includes('scr:chen-spiroar'));
  assert.ok(!ids('Chen').includes('scr:el-sombrero'));
  assert.ok(ids('Storm Spirit').includes('scr:el-sombrero'));
  assert.ok(!ids('Storm Spirit').includes('scr:chen-spiroar'));
  assert.ok(!ids('Axe').some(id=>owned.includes(id)));
  assert.equal(screenArt('scr:chen-spiroar').hero,'Chen');
  assert.equal(screenArt('scr:el-sombrero').hero,'Storm Spirit');
});

test('a hero-tied background saves only on its hero', () => {
  const state={...withPack('common'),screens:['scr:chen-spiroar','scr:el-sombrero']};
  assert.doesNotThrow(()=>equipCosmetics(state,{baseCard:{hero:66,art:'scr:chen-spiroar'}}));
  assert.throws(()=>equipCosmetics(state,{baseCard:{hero:2,art:'scr:chen-spiroar'}}),/for Chen/);
  assert.doesNotThrow(()=>equipCosmetics(state,{baseCard:{hero:17,art:'scr:el-sombrero'}}));
  assert.throws(()=>equipCosmetics(state,{baseCard:{hero:2,art:'scr:el-sombrero'}}),/for Storm Spirit/);
});
