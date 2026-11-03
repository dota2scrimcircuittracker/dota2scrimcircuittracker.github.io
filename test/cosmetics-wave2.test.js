import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATALOG} from '../public/lib/cosmetics-catalog.js';
import {WAVE2_CATALOG,WAVE2_ANIMATED_FINISHES,WAVE_ANIMATED_FINISHES} from '../public/lib/cosmetics-wave-catalog.js';
import {waveBorderHtml} from '../public/lib/cosmetics-wave-borders.js';
import {waveFinishHtml} from '../public/lib/cosmetics-wave-finishes.js';
import {waveSignatureHtml} from '../public/lib/cosmetics-wave-signatures.js';
import {equipCosmetics,grantLogin} from '../public/lib/cosmetics-engine.js';
import {signatureHtml} from '../public/lib/signatures.js';

// About thirty of each type across the three rarities. Counts are uneven on purpose: review rounds moved items
// between rarities and added two borders.
test('the October 30 wave adds thirty of each type across rare, epic and legendary',()=>{
 const want={border:{rare:12,epic:11,legendary:7},finish:{rare:10,epic:12,legendary:8},autograph:{rare:10,epic:12,legendary:8}};
 for(const type of ['border','finish','autograph'])for(const rarity of ['rare','epic','legendary'])
  assert.equal(WAVE2_CATALOG.filter(i=>i.type===type&&i.rarity===rarity).length,want[type]?.[rarity]??10,`${type} ${rarity}`);
 for(const item of WAVE2_CATALOG)assert.equal(CATALOG.find(i=>i.key===item.key),item);
 assert.equal(new Set(CATALOG.map(i=>i.key)).size,CATALOG.length);
 const names=t=>CATALOG.filter(i=>i.type===t).map(i=>i.name.toLowerCase());
 for(const t of ['border','finish','autograph'])assert.equal(new Set(names(t)).size,names(t).length,`${t} names repeat`);
 assert.ok(WAVE2_ANIMATED_FINISHES.every(id=>WAVE_ANIMATED_FINISHES.includes(id)));
});

test('every October 30 item draws its own layer with no NaN or undefined',()=>{
 for(const item of WAVE2_CATALOG){
  const html=item.type==='border'?waveBorderHtml(item):item.type==='finish'?waveFinishHtml(item):waveSignatureHtml(item,'Fav');
  const kind={border:'exp-border wave-border" data-border-id',finish:'exp-finish wave-finish" data-finish-id',autograph:'exp-signature-svg wave-signature" data-signature-id'}[item.type];
  assert.ok(html.startsWith(`<svg class="exp-layer ${kind}="${item.id}"`),item.id);
  assert.doesNotMatch(html,/NaN|undefined|\[object/,item.id);
 }
});

test('October 30 signatures escape names and handle empty, long and non-Latin ones',()=>{
 for(const item of WAVE2_CATALOG.filter(i=>i.type==='autograph')){
  assert.ok(!waveSignatureHtml(item,'<b>&"x').includes('<b>'),item.id);
  for(const name of ['','ThroneDestroyer99','Фав','名前'])assert.doesNotMatch(waveSignatureHtml(item,name),/NaN|undefined/,`${item.id}: ${name}`);
 }
});

// Chrome paints a mask once and does not repaint it when what is inside animates, so a mask must hold still.
test('no October 30 design animates inside a mask',()=>{
 for(const file of ['borders','finishes','signatures']){
  const src=readFileSync(new URL(`../public/lib/cosmetics-wave2-${file}.js`,import.meta.url),'utf8');
  for(const [,body] of src.matchAll(/<mask[^>]*>(.*?)<\/mask>/gs))assert.doesNotMatch(body,/an\(/,file);
 }
});

test('every motion class the October 30 wave uses has a rule in its stylesheet',()=>{
 const css=readFileSync(new URL('../public/cosmetics-wave2.css',import.meta.url),'utf8');
 const used=new Set();
 for(const item of WAVE2_CATALOG){
  const html=item.type==='border'?waveBorderHtml(item):item.type==='finish'?waveFinishHtml(item):waveSignatureHtml(item,'Fav');
  for(const [,cls] of html.matchAll(/class="w2 ([a-z-]+)"/g))used.add(cls);
 }
 for(const cls of used)assert.match(css,new RegExp(`\.w2\.${cls}\{`),cls);
});

test('License Plate shows the owner plate text, escaped, or the league name when blank',()=>{
 const plate=WAVE2_CATALOG.find(i=>i.id==='license-plate');
 assert.match(waveSignatureHtml(plate,'Fav'),/AD2L · SCRIM LEAGUE/);
 assert.match(waveSignatureHtml(plate,'Fav',{plate:'land of 10k lakes'}),/LAND OF 10K LAKES/);
 assert.ok(!waveSignatureHtml(plate,'Fav',{plate:'<b>'}).includes('<b>'));
});

test('Kaleidoscope centres where the owner placed it',()=>{
 const k=WAVE2_CATALOG.find(i=>i.id==='kaleidoscope');
 assert.match(waveFinishHtml(k),/translate\(150 170\)/);
 assert.match(waveFinishHtml(k,{finishSettings:{kaleidoscope:{x:20,y:60,rotation:0,size:100,opacity:100}}}),/translate\(60 240\)/);
});

test('saved cards keep plate text and the kaleidoscope centre, and the card shows them',()=>{
 const state={...grantLogin(null),inventory:{'autograph:license-plate':1,'finish:kaleidoscope':1}};
 const e=equipCosmetics(state,{autograph:'license-plate',plateText:'land of lakes',finish:'kaleidoscope',finishSettings:{kaleidoscope:{x:20,y:60,rotation:0,size:100,opacity:100}}}).equipment;
 assert.equal(e.plateText,'LAND OF LAKES');
 assert.deepEqual(e.finishSettings.kaleidoscope,{x:20,y:60,rotation:0,size:100,opacity:100});
 assert.match(signatureHtml({...e,x:50,y:80,size:12,rotation:0},'Fav'),/LAND OF LAKES/);
 assert.equal(equipCosmetics(state,{autograph:'license-plate',plateText:'  '}).equipment.plateText,undefined);
 for(const bad of ['x'.repeat(21),'<b>'])assert.throws(()=>equipCosmetics(state,{autograph:'license-plate',plateText:bad}),/Plate text/);
});
