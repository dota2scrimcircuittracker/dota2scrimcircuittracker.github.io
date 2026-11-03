import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG} from '../public/lib/cosmetics-catalog.js';
import {grantLogin,equipCosmetics,saveCardDesign,cardAppearance,hasArcanaUpgrade,MAX_FINISH_STACK} from '../public/lib/cosmetics-engine.js';
import {equipmentUpdateKeys} from '../public/lib/cosmetics-update-keys.js';

const finishes=CATALOG.filter(i=>i.type==='finish');
const owning=(state,extra={})=>({...state,inventory:Object.fromEntries(finishes.map(i=>[i.key,1])),...extra});

test('the Arcana upgrade comes with an arcana card, an owed one or a grant',()=>{
  const first=grantLogin(null);
  assert.equal(hasArcanaUpgrade(first),false);
  assert.equal(hasArcanaUpgrade({...first,arcanaOwed:1}),true);
  assert.equal(hasArcanaUpgrade({...first,arcana:['x']}),true);
  assert.equal(hasArcanaUpgrade({...first,arcanaUpgrade:true}),true);
  assert.equal(hasArcanaUpgrade({...first,arcana:[],arcanaOwed:0}),false);
});

test('stacking finishes needs the upgrade, owned finishes, and at most MAX_FINISH_STACK',()=>{
  const [a,b,c,d]=finishes.map(i=>i.id);
  const plain=owning(grantLogin(null));
  assert.throws(()=>equipCosmetics(plain,{finish:a,finishStack:[b]}),/Arcana upgrade/);
  const arcana=owning(grantLogin(null),{arcanaOwed:1});
  const stacked=equipCosmetics(arcana,{finish:a,finishStack:[b,c]}).equipment;
  assert.deepEqual([stacked.finish,stacked.finishStack],[a,[b,c]]);
  assert.equal(MAX_FINISH_STACK,2);
  assert.throws(()=>equipCosmetics(arcana,{finish:a,finishStack:[b,c,d]}),/up to 2/);
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
  const arcana=owning(grantLogin(null),{arcanaOwed:1});
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
  const arcana=owning(grantLogin(null),{arcanaOwed:1});
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
