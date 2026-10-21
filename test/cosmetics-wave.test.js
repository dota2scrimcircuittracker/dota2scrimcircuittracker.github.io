import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG as ALL,DEFAULT_EQUIPMENT} from '../public/lib/cosmetics-catalog.js';
import {WAVE_CATALOG,DOTA_CATALOG,WAVE_ANIMATED_FINISHES,WAVE_PARTICLE_FINISHES} from '../public/lib/cosmetics-wave-catalog.js';
import {redrawnBorderHtml,REDRAWN_BORDERS} from '../public/lib/cosmetics-redrawn-borders.js';
import {hasExpansionEmblems} from '../public/lib/cosmetics-expansion-symbols.js';
import {PARTICLE_GROUPS,normalizeParticles,validBorderSettings,particleDefaults,particleControlsHtml} from '../public/lib/cosmetics-particle-groups.js';
import {validFinishSettings,normalizeSettings} from '../public/lib/cosmetics-expansion-settings.js';
import {grantLogin,saveCardDesign} from '../public/lib/cosmetics-engine.js';
import {waveBorderHtml} from '../public/lib/cosmetics-wave-borders.js';
import {waveFinishHtml} from '../public/lib/cosmetics-wave-finishes.js';
import {waveSignatureHtml} from '../public/lib/cosmetics-wave-signatures.js';

test('the October 20 wave adds ten of each type, all in the catalog',()=>{
 for(const type of ['border','finish','autograph'])assert.equal(WAVE_CATALOG.filter(i=>i.type===type).length,10);
 for(const item of WAVE_CATALOG)assert.equal(ALL.find(i=>i.key===item.key),item);
 assert.ok(WAVE_CATALOG.every(i=>i.expansion.wave&&i.description&&['common','rare','epic','legendary'].includes(i.rarity)));
});

test('every wave item renders its own layer',()=>{
 for(const item of WAVE_CATALOG.filter(i=>i.type==='border'))assert.match(waveBorderHtml(item),new RegExp(`^<svg class="exp-layer exp-border wave-border" data-border-id="${item.id}"`));
 for(const item of WAVE_CATALOG.filter(i=>i.type==='finish'))assert.match(waveFinishHtml(item),new RegExp(`^<svg class="exp-layer exp-finish wave-finish" data-finish-id="${item.id}"`));
 for(const item of WAVE_CATALOG.filter(i=>i.type==='autograph'))assert.match(waveSignatureHtml(item,'Fav'),new RegExp(`^<svg class="exp-layer exp-signature-svg wave-signature" data-signature-id="${item.id}"`));
});

test('wave signatures escape the name and handle empty, long and non-Latin names',()=>{
 for(const item of WAVE_CATALOG.filter(i=>i.type==='autograph')){
  const html=waveSignatureHtml(item,'<b>&"x');
  assert.ok(!html.includes('<b>'),item.id);
  for(const name of ['', 'ThroneDestroyer99', 'Фав', '名前'])assert.doesNotMatch(waveSignatureHtml(item,name),/NaN|undefined/,`${item.id}: ${name}`);
 }
});

test('particle group counts, sizes and speeds change what wave layers draw',()=>{
 assert.ok(WAVE_PARTICLE_FINISHES.every(id=>WAVE_ANIMATED_FINISHES.includes(id)&&PARTICLE_GROUPS.finish[id]));
 const item=id=>WAVE_CATALOG.find(i=>i.id===id),count=(html,cls)=>html.split(`class="${cls}"`).length-1;
 const confetti=n=>waveFinishHtml(item('confetti-pop'),{finishSettings:{'confetti-pop':{confetti:n}}});
 assert.equal(count(confetti(undefined),'wave-confetti'),48);assert.equal(count(confetti(120),'wave-confetti'),120);assert.equal(count(confetti(0),'wave-confetti'),0);
 const molten=s=>waveBorderHtml(item('molten-gilding'),s);
 assert.equal(count(molten(),'wave-drip'),6);assert.equal(count(molten(),'wave-gild-run'),0);
 const more=molten({drips:12,runs:16,embers:40,dripsSize:1.5,embersSpeed:2});
 assert.equal(count(more,'wave-drip'),12);assert.equal(count(more,'wave-gild-run'),16);assert.equal(count(more,'wave-gild-ember'),40);
 assert.match(more,/scale\(2\.03\)/);assert.match(more,/--border-speed:calc\(var\(--border-speed-base,1\) \* 2\)/);
 assert.equal(count(waveBorderHtml(item('lane-creeps'),{creeps:6}),'wave-creep'),24);
 assert.equal(count(waveBorderHtml(item('overgrowth'),{petals:20,fireflies:10}),'wave-firefly'),10);
});

test('particle settings save for borders and finishes and reject anything out of range',()=>{
 assert.deepEqual(normalizeParticles('border','molten-gilding',{drips:99,runsSize:9,embersSpeed:-1}),{drips:12,dripsSize:1,dripsSpeed:1,runs:0,runsSize:2,runsSpeed:1,embers:0,embersSize:1,embersSpeed:.25});
 const borderSettings={'molten-gilding':{...particleDefaults('border','molten-gilding'),drips:10,embers:30},tectonic:particleDefaults('border','tectonic')};
 const finishSettings={'rain-glass':{...particleDefaults('finish','rain-glass'),beads:150},'deep-sea':{...normalizeSettings('finish-deep-sea'),plankton:60}};
 const state={...grantLogin(null),inventory:{'border:molten-gilding':1,'finish:rain-glass':1}};
 const saved=saveCardDesign(state,{...DEFAULT_EQUIPMENT,border:'molten-gilding',finish:'rain-glass',borderSettings,finishSettings},0);
 assert.deepEqual(saved.cardDesigns[0].borderSettings,borderSettings);assert.deepEqual(saved.cardDesigns[0].finishSettings,finishSettings);
 for(const raw of [{'molten-gilding':{drips:13}},{'molten-gilding':{drips:1.5}},{'molten-gilding':{dripsSpeed:'2'}},{'molten-gilding':{lava:1}},{grey:{}},{'knit-scarf':{}},[]])assert.throws(()=>validBorderSettings(raw),/border controls|Border controls/);
 assert.throws(()=>validFinishSettings({'rain-glass':{beads:181}}),/Finish controls/);
 assert.throws(()=>validFinishSettings({halftone:{}}),/finish controls/);
 assert.match(particleControlsHtml('border','molten-gilding',{}),/data-particle="drips".*data-particle="embersSpeed"/s);
 assert.equal(particleControlsHtml('border','knit-scarf',{}),'');
});

test('no wave layer leaves a NaN or undefined in its markup',()=>{
 for(const item of WAVE_CATALOG.filter(i=>i.type!=='autograph')){
  const html=item.type==='border'?waveBorderHtml(item):waveFinishHtml(item);
  assert.doesNotMatch(html,/NaN|undefined/,item.id);
 }
});

test('the five Dota borders render, sit in the catalog and take their particle groups',()=>{
 assert.deepEqual(DOTA_CATALOG.map(i=>i.id),['roshan-pit','river-runes','courier-run','ward-vision','jungle-stack']);
 const count=(html,cls)=>html.split(`class="${cls}"`).length-1;
 for(const item of DOTA_CATALOG){
  assert.equal(ALL.find(i=>i.key===item.key),item);
  const html=waveBorderHtml(item);
  assert.match(html,new RegExp(`^<svg class="exp-layer exp-border wave-border" data-border-id="${item.id}"`));
  assert.doesNotMatch(html,/NaN|undefined/,item.id);
  assert.ok(PARTICLE_GROUPS.border[item.id],item.id);
 }
 const item=id=>DOTA_CATALOG.find(i=>i.id===id);
 assert.equal(count(waveBorderHtml(item('roshan-pit'),{heroes:2}),'wave-raider'),2);
 assert.equal(count(waveBorderHtml(item('roshan-pit')),'wave-rosh-pit'),2);
 assert.equal(count(waveBorderHtml(item('roshan-pit')),'wave-aegis'),2);
 assert.equal(count(waveBorderHtml(item('courier-run'),{couriers:6}),'wave-courier'),6);
 assert.equal(count(waveBorderHtml(item('ward-vision'),{wards:12}),'wave-ward'),12);
 assert.equal(count(waveBorderHtml(item('river-runes')),'wave-rune'),36);
});

test('the six redrawn codex borders draw their own frame with no placeable corner pieces',()=>{
 assert.deepEqual(REDRAWN_BORDERS,['parchment','ochre','carbon','checker','tectonic','clockwork']);
 for(const id of REDRAWN_BORDERS){
  const item=ALL.find(i=>i.key===`border:${id}`),html=redrawnBorderHtml(item);
  assert.match(html,new RegExp(`^<svg class="exp-layer exp-border wave-border" data-border-id="${id}"`));
  assert.doesNotMatch(html,/NaN|undefined/,id);
  assert.equal(hasExpansionEmblems(id),false,id);
 }
 const count=(html,cls)=>html.split(`class="${cls}"`).length-1,item=id=>ALL.find(i=>i.key===`border:${id}`);
 assert.equal(count(redrawnBorderHtml(item('clockwork'),{planets:12}),'wave-planet'),12);
 assert.equal(count(redrawnBorderHtml(item('tectonic'),{embers:40,steam:0}),'wave-gild-ember'),40);
 assert.equal(count(redrawnBorderHtml(item('tectonic'),{steam:0}),'wave-steam'),0);
});
