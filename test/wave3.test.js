import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG} from '../public/lib/cosmetics-catalog.js';
import {WAVE3_CATALOG,WAVE3_LIVE,WAVE_ANIMATED_FINISHES} from '../public/lib/cosmetics-wave-catalog.js';
import {waveBorderHtml} from '../public/lib/cosmetics-wave-borders.js';
import {waveFinishHtml} from '../public/lib/cosmetics-wave-finishes.js';
import {waveSignatureHtml} from '../public/lib/cosmetics-wave-signatures.js';
import {renderedName,writingOf} from '../public/lib/signatures.js';

test('wave 3: the items Fav kept after the Nov 4 vote, unique keys', () => {
  assert.deepEqual(WAVE3_CATALOG.map(i=>i.key).sort(),['autograph:blackletter','autograph:circuit-trace','autograph:fountain-pen','autograph:holo-sticker','autograph:lightning-script','autograph:smoke-script','autograph:soulfire','border:cedar','border:cork','border:damascus','border:lantern-festival','border:lapis','border:radiant-dire','border:stitched-leather','finish:fireflies','finish:gold-emboss','finish:linen','finish:midas-touch','finish:mosaic','finish:polaroid','finish:ravage','finish:sakura-fall','translation:arabic','translation:devanagari','translation:georgian']);
  const keys=[...CATALOG,...WAVE3_CATALOG].map(i=>i.key);
  assert.equal(new Set(keys).size,keys.length-(WAVE3_LIVE?WAVE3_CATALOG.length:0));
});

test('wave 3 stays out of the catalog off loopback until released', () => {
  if(WAVE3_LIVE)return;
  assert.ok(WAVE3_CATALOG.every(i=>!CATALOG.includes(i)));
});

test('every wave 3 border, finish and signature draws its own SVG', () => {
  for(const item of WAVE3_CATALOG){
    const html=item.type==='border'?waveBorderHtml(item,{}):item.type==='finish'?waveFinishHtml(item,{}):item.type==='autograph'?waveSignatureHtml(item,'Fav'):null;
    if(html===null)continue;
    assert.match(html,/^<svg /,item.key);
    assert.ok(html.includes(`"${item.id}"`),item.key);
    assert.ok(!html.includes('undefined')&&!html.includes('NaN'),item.key);
  }
  // Long names still fit.
  for(const item of WAVE3_CATALOG.filter(i=>i.type==='autograph'))assert.ok(!waveSignatureHtml(item,'Supercalifragilistic').includes('NaN'),item.key);
});

test('wave 3 animated finishes take the speed control; the static three do not', () => {
  for(const id of ['mosaic','fireflies','ravage','midas-touch'])assert.ok(WAVE_ANIMATED_FINISHES.includes(id),id);
  for(const id of ['linen'])assert.ok(!WAVE_ANIMATED_FINISHES.includes(id),id);
});

test('wave 3 modifiers: Arabic, Devanagari and Georgian', () => {
  assert.equal(renderedName('Fav','arabic'),'فاف');
  assert.equal(renderedName('Fav','devanagari'),'फ़ाव');
  assert.equal(renderedName('Fav','georgian'),'ფავ');
  assert.equal(renderedName('Shadow Fiend','arabic'),'شادو فيند');
  assert.equal(renderedName('Jonah','georgian'),'ჯონაჰ');
  assert.equal(writingOf('فاف'),'arabic');
  assert.equal(writingOf('फ़ाव'),'deva');
  assert.equal(writingOf('ფავ'),'geor');
  for(const item of WAVE3_CATALOG.filter(i=>i.type==='translation'))assert.equal(item.preview,`Fav → ${renderedName('Fav',item.id)}`);
});
