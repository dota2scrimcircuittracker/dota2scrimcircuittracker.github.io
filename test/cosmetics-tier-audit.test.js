import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EXPANSION_CATALOG} from '../public/lib/cosmetics-expansion-catalog.js';
import {DEFAULT_EQUIPMENT} from '../public/lib/cosmetics-catalog.js';
import {signatureHtml} from '../public/lib/signatures.js';
import {borderFlowBounds} from '../public/lib/cosmetics-expansion-upgrades.js';

test('rich signature definitions stay self-contained and collision-free across simultaneous cards',()=>{
 const seen=new Set();
 for(const item of EXPANSION_CATALOG.filter(i=>i.type==='autograph'&&i.rarity!=='common')){
  for(const name of ['Fav','AncientWarrior42','<img src=x>&Ω']){
   const markup=signatureHtml({...DEFAULT_EQUIPMENT,autograph:item.id},name);
   assert.doesNotMatch(markup,/<img\b/);
   const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
   assert.equal(new Set(ids).size,ids.length,`${item.id}: duplicate definition`);
   for(const id of ids){assert.ok(!seen.has(id),`${item.id}: definition shared between cards`);seen.add(id);}
   for(const [,ref] of markup.matchAll(/url\(#([^)]+)\)/g))assert.ok(ids.includes(ref),`${item.id}: missing definition ${ref}`);
  }
 }
});

test('SVG signatures keep the chosen footprint for long names instead of shrinking twice',()=>{
 for(const item of EXPANSION_CATALOG.filter(i=>i.type==='autograph')){
  for(const name of ['Fav','AncientWarriorOfTheRadiant']){
   const markup=signatureHtml({...DEFAULT_EQUIPMENT,autograph:item.id,size:20},name);
   assert.match(markup,/--signature-size:20cqi/,item.id);
  }
 }
 // Text-based signatures still need their existing overflow guard.
 const legacy=signatureHtml({...DEFAULT_EQUIPMENT,autograph:'brush-ink',size:20},'AncientWarriorOfTheRadiant');
 assert.ok(Number(legacy.match(/--signature-size:([\d.]+)cqi/)[1])<20);
});

test('animated whole-word signatures bound their stagger regardless of name length',()=>{
 for(const autograph of ['assembly','fold']){
  for(const name of ['A','Fav','AncientWarriorOfTheRadiant']){
   const markup=signatureHtml({...DEFAULT_EQUIPMENT,autograph},name);
   const delays=[...markup.matchAll(/animation-delay:([\d.]+)s/g)].map(m=>Number(m[1]));
   assert.equal(delays.length,[...name.toUpperCase()].length);
   assert.equal(Math.min(...delays),0);
   assert.ok(Math.max(...delays)<=.45,`${autograph}: whole word must complete within one short beat`);
  }
 }
});

test('compact color-flow surfaces cover the entire frame throughout their motion',()=>{
 const b=borderFlowBounds();
 assert.ok(b.width*b.height<1800*2200/10);
 for(let degrees=0;degrees<360;degrees+=5){
  const a=degrees*Math.PI/180;
  for(const [x,y] of [[0,0],[300,0],[300,400],[0,400]]){
   const px=150+(x-150)*Math.cos(a)+(y-200)*Math.sin(a);
   const py=200-(x-150)*Math.sin(a)+(y-200)*Math.cos(a);
   assert.ok(px>=b.x&&px<=b.x+b.width&&py>=b.y&&py<=b.y+b.height);
  }
 }
 const s=borderFlowBounds(true);
 for(const t of [0,.25,.5,.75,1]){
  assert.ok(s.x+360*t<=0&&s.y+440*t<=0);
  assert.ok(s.x+s.width+360*t>=300&&s.y+s.height+440*t>=400);
 }
});
