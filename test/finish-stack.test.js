import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG} from '../public/lib/cosmetics-catalog.js';
import {grantLogin,equipCosmetics,saveCardDesign,cardAppearance,hasArcanaUpgrade,openArcanaUpgrade,recycleCards,MAX_FINISH_STACK,MAX_FINISH_LAYERS,finishStackLimit} from '../public/lib/cosmetics-engine.js';
import {equipmentUpdateKeys} from '../public/lib/cosmetics-update-keys.js';

const finishes=CATALOG.filter(i=>i.type==='finish');
const owning=(state,extra={})=>({...state,inventory:Object.fromEntries(finishes.map(i=>[i.key,1])),...extra});

test('the first arcana brings the Arcana upgrade sealed; opening it unlocks stacking',()=>{
  const first=grantLogin(null);
  assert.equal(hasArcanaUpgrade(first),false);
  assert.equal(hasArcanaUpgrade({...first,arcanaOwed:1,arcanaSealed:1}),false);
  assert.equal(hasArcanaUpgrade({...first,arcanaUpgrade:true}),true);
  assert.throws(()=>openArcanaUpgrade(first),/no sealed/);
  // Ten spare legendaries: an owed arcana plus the sealed upgrade.
  const legend=CATALOG.find(i=>i.rarity==='legendary');
  const recycled=recycleCards({...first,inventory:{[legend.key]:11}},{[legend.key]:10}).state;
  assert.equal(recycled.arcanaSealed,1);assert.equal(hasArcanaUpgrade(recycled),false);
  const opened=openArcanaUpgrade(recycled).state;
  assert.equal(hasArcanaUpgrade(opened),true);assert.equal('arcanaSealed' in opened,false);
  assert.equal(recycled.arcanaSealed,1,'input untouched');
  // A later arcana doesn't seal another upgrade.
  const again=recycleCards({...opened,inventory:{[legend.key]:11}},{[legend.key]:10}).state;
  assert.equal(again.arcanaSealed,undefined);assert.equal(again.arcanaOwed,2);
});

test('stacking finishes needs the upgrade, owned finishes, and at most MAX_FINISH_STACK',()=>{
  const [a,b,c,d]=finishes.map(i=>i.id);
  const plain=owning(grantLogin(null));
  assert.throws(()=>equipCosmetics(plain,{finish:a,finishStack:[b]}),/Arcana upgrade/);
  const arcana=owning(grantLogin(null),{arcanaUpgrade:true,arcanaOwed:2});
  const stacked=equipCosmetics(arcana,{finish:a,finishStack:[b,c]}).equipment;
  assert.deepEqual([stacked.finish,stacked.finishStack],[a,[b,c]]);
  assert.throws(()=>equipCosmetics(arcana,{finish:a,finishStack:[b,c,d]}),/stack 2 finishes/);
  assert.throws(()=>equipCosmetics(arcana,{finish:a,finishStack:[b,b]}),/once/);
  assert.throws(()=>equipCosmetics(arcana,{finish:a,finishStack:['none']}),/Unknown/);
  assert.throws(()=>equipCosmetics(arcana,{finish:a,finishStack:['not-a-finish']}),/Unknown/);
  assert.throws(()=>equipCosmetics(arcana,{finish:a,finishStack:'b'}),/Stack up to/);
  assert.throws(()=>equipCosmetics({...arcana,inventory:{...arcana.inventory,[`finish:${c}`]:0}},{finish:a,finishStack:[c]}),/Collect/);
  // An empty stack stores nothing; no upgrade is needed to clear one.
  assert.equal('finishStack' in equipCosmetics(plain,{finishStack:[]}).equipment,false);
});

test('a stack survives other edits and drops a copy of the main finish',()=>{
  const [a,b,c]=finishes.map(i=>i.id);
  const arcana=owning(grantLogin(null),{arcanaUpgrade:true,arcanaOwed:2});
  const saved=equipCosmetics(arcana,{finish:a,finishStack:[b,c]});
  assert.deepEqual(equipCosmetics(saved,{hue:90}).equipment.finishStack,[b,c]);
  // Making a stacked finish the main one removes it from the stack instead of failing.
  assert.deepEqual(equipCosmetics(saved,{finish:b}).equipment.finishStack,[c]);
  assert.deepEqual(equipCosmetics(arcana,{finish:a,finishStack:[a,b]}).equipment.finishStack,[b]);
  // Saved to a card slot and shown publicly.
  const slot=saveCardDesign(arcana,{finish:a,finishStack:[b]},0);
  assert.deepEqual(cardAppearance(slot).finishStack,[b]);
});

test('every finish stacks with every other finish',()=>{
  const arcana=owning(grantLogin(null),{arcanaUpgrade:true});
  for(const main of finishes)for(const layer of finishes){
    if(main.id===layer.id)continue;
    const e=equipCosmetics(arcana,{finish:main.id,finishStack:[layer.id]}).equipment;
    assert.deepEqual(e.finishStack,[layer.id],`${main.id} + ${layer.id}`);
  }
});

test('changing the stack, or a stacked finish setting, redraws the finish layer',()=>{
  const e={border:'grey',finish:'holo',finishStack:['inferno'],x:50,y:60,size:15,rotation:-7};
  const base=equipmentUpdateKeys(e,'Fav').finish;
  assert.notEqual(equipmentUpdateKeys({...e,finishStack:['inferno','stars']},'Fav').finish,base);
  assert.notEqual(equipmentUpdateKeys({...e,finishSettings:{inferno:{speed:2}}},'Fav').finish,base);
  assert.equal(equipmentUpdateKeys({...e,hue:40},'Fav').finish,base);
});

test('each arcana card adds one finish layer, up to MAX_FINISH_LAYERS',()=>{
  const ids=finishes.map(i=>i.id),base=owning(grantLogin(null));
  assert.equal(MAX_FINISH_LAYERS,5);assert.equal(MAX_FINISH_STACK,4);
  assert.equal(finishStackLimit(base),0);
  assert.equal(finishStackLimit({...base,arcanaOwed:3,arcanaSealed:1}),0,'sealed upgrade: no stacking yet');
  const counts=[[1,1],[2,2],[3,3],[4,4],[9,4]];
  for(const [owned,limit] of counts){
    const s={...base,arcanaUpgrade:true,arcanaOwed:owned};
    assert.equal(finishStackLimit(s),limit);
    assert.deepEqual(equipCosmetics(s,{finish:ids[0],finishStack:ids.slice(1,limit+1)}).equipment.finishStack,ids.slice(1,limit+1));
    assert.throws(()=>equipCosmetics(s,{finish:ids[0],finishStack:ids.slice(1,limit+2)}),/Stack up to 4|You can stack/);
  }
  // Owned arcana designs count the same as owed ones.
  assert.equal(finishStackLimit({...base,arcanaUpgrade:true,arcana:['a','b'],arcanaOwed:1}),3);
  // A saved stack over the limit keeps its bottom layers when something else changes.
  const one={...base,arcanaUpgrade:true,arcanaOwed:1,equipment:{...base.equipment,finish:ids[0],finishStack:[ids[1],ids[2]]}};
  assert.deepEqual(equipCosmetics(one,{hue:30}).equipment.finishStack,[ids[1]]);
});

test('accounts that earned arcana before the sealed box keep the upgrade',()=>{
  const legacy={...grantLogin(null),arcanaOwed:1};
  assert.equal(hasArcanaUpgrade(legacy),true);assert.equal(finishStackLimit(legacy),1);
  const legend=CATALOG.find(i=>i.rarity==='legendary');
  const again=recycleCards({...legacy,inventory:{[legend.key]:11}},{[legend.key]:10}).state;
  assert.equal(again.arcanaSealed,undefined,'no box to open for an account that already stacks');
  assert.equal(finishStackLimit(again),2);
});
