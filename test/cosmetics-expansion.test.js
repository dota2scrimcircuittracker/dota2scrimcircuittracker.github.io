import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG,DEFAULT_EQUIPMENT} from '../public/lib/cosmetics-catalog.js';
import {EXPANSION_CATALOG} from '../public/lib/cosmetics-expansion-catalog.js';
import {equipCosmetics,grantLogin,saveCardDesign} from '../public/lib/cosmetics-engine.js';
import {defaults,validFinishSettings,EDITABLE_FINISHES,finishPlacement} from '../public/lib/cosmetics-expansion-settings.js';
import {signatureHtml} from '../public/lib/signatures.js';
import {borderEmblemList,defaultExpansionEmblems} from '../public/lib/cosmetics-expansion.js';
import {borderSymbolBox,hasExpansionEmblems} from '../public/lib/cosmetics-expansion-symbols.js';

test('reviewed catalog excludes retired designs and preserves selected variants',()=>{
 assert.equal(EXPANSION_CATALOG.length,49);
 for(const id of ['porcelain','oil-slick','chalk-lilac'])assert.ok(!EXPANSION_CATALOG.some(i=>i.id===id));
 assert.equal(CATALOG.find(i=>i.key==='border:ouroboros').rarity,'epic');
 assert.equal(CATALOG.find(i=>i.key==='autograph:fold').expansion.variant,'A');
 assert.deepEqual(defaults('finish-supernova'),{x:54,y:63,rotation:0,size:100,opacity:100,stars:60,starSize:1.8,starSpeed:1.5,burst:0,burstSize:.5,burstSpeed:3});
});
test('finish controls survive saving and swapping, while invalid values are rejected',()=>{
 const state={...grantLogin(null),inventory:{'finish:supernova':1,'finish:shattered-time':1}};
 const finishSettings={supernova:{...defaults('finish-supernova'),x:31,burst:12},'shattered-time':{x:20,y:55,rotation:-80,size:100,opacity:100}};
 const saved=saveCardDesign(state,{...DEFAULT_EQUIPMENT,finish:'supernova',finishSettings},0);
 assert.deepEqual(saved.cardDesigns[0].finishSettings,finishSettings);
 const swapped=equipCosmetics(saved,{finish:'shattered-time'});
 assert.deepEqual(swapped.equipment.finishSettings,finishSettings);
 for(const raw of [{supernova:{stars:61}},{supernova:{stars:1.5}},{supernova:{x:Infinity}},{supernova:{x:'40'}},{supernova:{starSpeed:0}},{supernova:{script:'bad'}},{unknown:{}},[]])assert.throws(()=>validFinishSettings(raw),/finish controls|Finish controls/);
 assert.throws(()=>equipCosmetics(grantLogin(null),{finish:'supernova'}),/Collect/);
});
test('new signature compositions use escaped displayed names and paperfold has no covering hatch',()=>{
 for(const item of EXPANSION_CATALOG.filter(i=>i.type==='autograph')){
  const markup=signatureHtml({...DEFAULT_EQUIPMENT,autograph:item.id,text:'ignored'},'<img>');
  assert.doesNotMatch(markup,/<img>|ignored/);
  assert.match(markup,/exp-signature-svg/);
 }
 const fold=signatureHtml({...DEFAULT_EQUIPMENT,autograph:'fold'},'Fav');
 assert.doesNotMatch(fold,/mix-blend-mode:multiply|M50 212l26 48/);
 assert.match(fold,/M48 276H254/);
});
test('each border symbol saves its own rotation without losing placement or size',()=>{
 const state=grantLogin(null),emblems=[{x:14,y:20,size:125,rotation:90},{x:88,y:93,size:75,rotation:-135},{x:50,y:50,size:100}];
 const saved=saveCardDesign(state,{...DEFAULT_EQUIPMENT,emblems},0);
 assert.deepEqual(saved.cardDesigns[0].emblems,emblems);
 assert.deepEqual(equipCosmetics(saved,{hue:40}).equipment.emblems,emblems);
 for(const rotation of [-181,181,NaN,Infinity,'90',null])assert.throws(()=>equipCosmetics(state,{emblems:[{x:50,y:50,rotation}]}),/rotation/);
 assert.deepEqual(equipCosmetics(state,{emblems:[{x:50,y:50,rotation:0}]}).equipment.emblems,[{x:50,y:50,size:100}]);
});

test('corner pieces and fortresses retain separate placements across saves and border changes',()=>{
 const legacy=[{x:8,y:7,size:110,rotation:90},{x:93,y:94,size:90}];
 const gears=[{x:20,y:25,size:150,rotation:-45},{x:96,y:97,size:75}];
 const state={...grantLogin(null),inventory:{'border:olive':1,'border:ancient-war':1}};
 assert.equal(defaultExpansionEmblems('olive').length,4);
 assert.deepEqual(borderEmblemList({border:'olive',emblems:legacy}),defaultExpansionEmblems('olive'));
 assert.deepEqual(borderEmblemList({border:'ancient-war',emblems:legacy}),legacy);
 const saved=saveCardDesign(state,{...DEFAULT_EQUIPMENT,border:'olive',emblems:legacy,borderEmblems:{olive:gears}},0);
 assert.deepEqual(saved.cardDesigns[0].borderEmblems.olive,gears);
 const war=equipCosmetics(saved,{border:'ancient-war'});
 assert.deepEqual(borderEmblemList(war.equipment),legacy);
 const scoped={...war.equipment.borderEmblems,'ancient-war':[{x:50,y:60,size:200,rotation:180}]};
 const changed=equipCosmetics(war,{border:'olive',borderEmblems:scoped});
 assert.deepEqual(borderEmblemList(changed.equipment),gears);
 assert.deepEqual(changed.equipment.borderEmblems['ancient-war'],scoped['ancient-war']);
 assert.equal(equipCosmetics(changed,{borderEmblems:null}).equipment.borderEmblems,undefined);
 for(const borderEmblems of [[],{unknown:gears},{olive:[]},{olive:Array(13).fill(gears[0])},{olive:[{x:-1,y:20}]},{olive:[{x:10,y:20,rotation:181}]}])assert.throws(()=>equipCosmetics(state,{borderEmblems}),/symbol/);
});

test('all standalone expansion ornaments have bounded independent saved layouts',()=>{
 const items=EXPANSION_CATALOG.filter(i=>borderSymbolBox(i.id));
 assert.equal(items.length,7);
 const state={...grantLogin(null),inventory:Object.fromEntries(items.map(i=>[i.key,1]))};
 const borderEmblems={};
 for(const item of items){
  assert.ok(hasExpansionEmblems(item.id));
  const initial=defaultExpansionEmblems(item.id);
  assert.equal(initial.length,4);
  assert.ok(initial.every(m=>m.x>=0&&m.x<=100&&m.y>=0&&m.y<=100));
  borderEmblems[item.id]=initial.map((m,n)=>n?m:{x:25,y:40,size:175,rotation:135});
  assert.notDeepEqual(initial,borderEmblems[item.id]);
  assert.deepEqual(borderEmblemList({border:item.id,emblems:[{x:50,y:50,size:300}]}),initial);
 }
 const saved=saveCardDesign(state,{...DEFAULT_EQUIPMENT,border:items[0].id,borderEmblems},0);
 assert.deepEqual(saved.cardDesigns[0].borderEmblems,borderEmblems);
 for(const item of items)assert.deepEqual(borderEmblemList(equipCosmetics(saved,{border:item.id}).equipment),borderEmblems[item.id]);
 for(const id of ['ouroboros','event-horizon','mirror','naval','__proto__']){
  assert.equal(hasExpansionEmblems(id),false);
  assert.throws(()=>equipCosmetics(state,{borderEmblems:{[id]:[{x:50,y:50,size:100}]}}),/symbol/);
 }
});

test('every new finish saves independent positioning, scale and translucent strength',()=>{
 const items=EXPANSION_CATALOG.filter(i=>i.type==='finish');
 assert.ok(items.every(i=>EDITABLE_FINISHES.includes(i.id)));
 const state={...grantLogin(null),inventory:Object.fromEntries(items.map(i=>[i.key,1]))};
 const finishSettings=Object.fromEntries(items.map((i,n)=>[i.id,{...defaults('finish-'+i.id),x:20+n*5,y:70-n*4,rotation:n*20-70,size:75+n*10,opacity:60+n*3}]));
 const saved=saveCardDesign(state,{...DEFAULT_EQUIPMENT,finish:'ink-water',finishSettings},0);
 assert.deepEqual(saved.cardDesigns[0].finishSettings,finishSettings);
 for(const item of items)assert.deepEqual(equipCosmetics(saved,{finish:item.id}).equipment.finishSettings,finishSettings);
 for(const [key,value] of [['size',24],['size',201],['rotation',181],['opacity',101],['opacity',-1],['x',Infinity],['y','50']])assert.throws(()=>validFinishSettings({'deep-sea':{[key]:value}}),/controls/);
 const legacy=validFinishSettings({'shattered-time':{x:20,y:55,rotation:-80}})['shattered-time'];
 assert.equal(legacy.size,100);assert.equal(legacy.opacity,100);
 assert.deepEqual([legacy.x,legacy.y,legacy.rotation],[20,55,-80]);
});

test('finish placement preserves the original focal points and applies scale around that point',()=>{
 assert.deepEqual(finishPlacement('supernova',{...defaults('finish-supernova'),x:154/3,y:133/4}),{transform:'translate(154 133) rotate(0) scale(1) translate(-154 -133)',opacity:1});
 assert.deepEqual(finishPlacement('reality-rift',{x:20,y:30,rotation:90,size:50,opacity:40}),{transform:'translate(60 120) rotate(90) scale(0.5) translate(-150 -200)',opacity:.4});
});

test('all new signature styles preserve movable, resizable, rotated placement when saved',()=>{
 const items=EXPANSION_CATALOG.filter(i=>i.type==='autograph');
 const state={...grantLogin(null),inventory:Object.fromEntries(items.map(i=>[i.key,1]))};
 for(const item of items){
  const saved=saveCardDesign(state,{...DEFAULT_EQUIPMENT,autograph:item.id,x:25,y:35,size:12,rotation:90},0).cardDesigns[0];
  assert.deepEqual([saved.x,saved.y,saved.size,saved.rotation],[25,35,12,90]);
  const markup=signatureHtml(saved,'Fav');
  assert.match(markup,/left:25%;top:35%;/);assert.match(markup,/--placement-rotation:90deg/);
 }
});
