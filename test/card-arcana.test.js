import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG,TIERS,itemByKey} from '../public/lib/cosmetics-catalog.js';
import {ARCANA_TOOLS,LIVING_BORDERS,TWIN_TURNS} from '../public/lib/cosmetics-arcana-catalog.js';
import {saveCardDesign,finishStackLimit,hasArcanaUpgrade,rollPack,equipCosmetics,grantLogin,cardDesignState} from '../public/lib/cosmetics-engine.js';
import {PACK_KIND_TYPES} from '../public/lib/pack-types.js';
import {livingBorderHtml,twinOf,twinHtml,toolArtHtml} from '../public/lib/card-arcana.js';

const player=(inventory={})=>({...grantLogin(null),inventory});

test('the catalog has the six arcana tools and five legendary living borders, keys unique',()=>{
  assert.deepEqual(ARCANA_TOOLS.map(i=>i.key),['tool:double-finish',...TWIN_TURNS.map(t=>`tool:twin-${t}`)]);
  assert.ok(ARCANA_TOOLS.every(i=>i.rarity==='arcana'&&itemByKey(i.key)===i));
  assert.deepEqual(LIVING_BORDERS.map(i=>[i.key,i.rarity]),['pulse','orbit','shimmer','embers','trace','lightning'].map(id=>[`living:${id}`,'legendary']));
  assert.equal(new Set(CATALOG.map(i=>i.key)).size,CATALOG.length);
  // Arcana isn't a pack tier, so tools never drop; living borders drop with the borders.
  assert.ok(!TIERS.includes('arcana'));
  assert.ok(PACK_KIND_TYPES.border.includes('living'));
});

test('arcana tools drop from packs, more often in rarer packs',()=>{
  const rate=pack=>{let s=player(),tools=0,cards=0;let seed=7;const random=()=>(seed=(seed*16807)%2147483647)/2147483647;
    for(let i=0;i<3000;i++){s.packs=[pack];const r=rollPack(s,0,random);s=r.state;for(const x of r.rewards){cards++;if(x.key.startsWith('tool:'))tools++;}}
    return tools/cards;};
  const [c,l]=[rate('common'),rate('legendary')];
  assert.ok(c<0.007,'common '+c);assert.ok(l>0.055&&l<0.095,'legendary '+l);
});

test('Double finish: a bought copy unlocks stacking, one layer per copy, up to four stacked',()=>{
  assert.equal(hasArcanaUpgrade(player()),false);
  assert.equal(finishStackLimit(player({'tool:double-finish':1})),1);
  assert.equal(finishStackLimit(player({'tool:double-finish':3})),3);
  assert.equal(finishStackLimit(player({'tool:double-finish':9})),4);
  // Arcana earned before it was sold keeps counting, so nobody loses a layer.
  assert.equal(finishStackLimit({...player({'tool:double-finish':1}),arcanaOwed:1,arcanaUpgrade:true}),2);
  const s=player({'tool:double-finish':1,'finish:starlight':1,'finish:fx-sheen':1});
  assert.deepEqual(equipCosmetics(s,{finish:'starlight',finishStack:['fx-sheen']}).equipment.finishStack,['fx-sheen']);
  assert.throws(()=>equipCosmetics(player({'finish:starlight':1,'finish:fx-sheen':1}),{finish:'starlight',finishStack:['fx-sheen']}),/Arcana upgrade/);
});

test('living border: only one you own, absent or "none" means none',()=>{
  const s=player({'living:orbit':1});
  assert.equal(equipCosmetics(s,{living:'orbit'}).equipment.living,'orbit');
  assert.equal(equipCosmetics(s,{living:'none'}).equipment.living,undefined);
  assert.equal(equipCosmetics(s,{}).equipment.living,undefined);
  assert.throws(()=>equipCosmetics(s,{living:'pulse'}),/Collect this cosmetic/);
  assert.throws(()=>equipCosmetics(s,{living:'nope'}),/Unknown cosmetic/);
  // Kept when a later save leaves it out.
  assert.equal(equipCosmetics({...s,equipment:{living:'orbit'}},{border:'grey'}).equipment.living,'orbit');
});

test('Twin Card: a back built in the editor, checked like a front; never a chain',()=>{
  let s=player({'tool:twin-flip':1,'border:copper':1,'border:slate':1});
  const back={border:'slate',baseCard:{hero:1,pos:null,art:'vert',style:null,crop:null}};
  assert.throws(()=>saveCardDesign(s,{border:'copper',twin:{turn:'scan',design:back}},0),/Get this Twin Card/);
  assert.throws(()=>saveCardDesign(s,{border:'copper',twin:{turn:'spin',design:back}},0),/how your twin card turns/);
  assert.throws(()=>saveCardDesign(s,{border:'copper',twin:{turn:'flip'}},0),/Build the back/);
  assert.throws(()=>saveCardDesign(s,{border:'copper',twin:{turn:'flip',design:{border:'gold'}}},0),/Collect this cosmetic/);
  s=saveCardDesign(s,{border:'copper',twin:{turn:'flip',design:{...back,twin:{turn:'flip',design:{}}}}},0);
  const first=cardDesignState(s).cardDesigns[0];
  assert.deepEqual([first.border,first.twin.turn,first.twin.design.border,first.twin.design.baseCard.art],['copper','flip','slate','vert']);
  assert.equal(first.twin.design.twin,undefined);
  // What the back leaves out is the front's.
  s=saveCardDesign(s,{border:'copper',twin:{turn:'flip',design:{finish:'none'}}},0);
  assert.equal(cardDesignState(s).cardDesigns[0].twin.design.border,'copper');
  // A save that leaves the twin out keeps it; null takes it off.
  s=saveCardDesign(s,{border:'slate'},0);
  assert.equal(cardDesignState(s).cardDesigns[0].twin.turn,'flip');
  s=saveCardDesign(s,{border:'slate',twin:null},0);
  assert.equal(cardDesignState(s).cardDesigns[0].twin,undefined);
});

test('drawing: living layer, twin wrapper and tool pictures',()=>{
  assert.equal(livingBorderHtml({}),'');
  assert.equal(livingBorderHtml({living:'nope'}),'');
  assert.match(livingBorderHtml({living:'trace'}),/class="living-fx living-trace" data-living-id="trace".*<svg/);
  assert.equal((livingBorderHtml({living:'embers'}).match(/<i /g)??[]).length,22);
  assert.equal(twinOf({twin:{turn:'flip'}}),null);
  assert.equal(twinOf({twin:{turn:'spin',design:{}}}),null);
  const html=twinHtml('<div class="ft-card a"></div>','<div class="ft-card b"></div>','scan');
  assert.equal(html,'<div class="ft-twin" data-twin="scan"><div class="ft-card a"></div><div aria-hidden="true" class="ft-card ft-twin-b b"></div></div>');
  assert.match(toolArtHtml(itemByKey('tool:twin-peel')),/tool-twin-peel/);
  assert.match(toolArtHtml(itemByKey('tool:double-finish')),/tool-double/);
});
