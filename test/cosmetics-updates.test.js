import {test} from 'node:test';
import assert from 'node:assert/strict';
import {equipmentUpdateKeys} from '../public/lib/cosmetics-update-keys.js';
import {DEFAULT_EQUIPMENT} from '../public/lib/cosmetics-catalog.js';
import {staticThumbnailImage} from '../public/lib/cosmetics-thumbnails.js';

test('layout and speed edits leave unrelated expensive cosmetic layers intact',()=>{
 const e={...DEFAULT_EQUIPMENT,finish:'reality-rift',autograph:'assembly',border:'ancient-war',baseCard:{hero:74}};
 const original=equipmentUpdateKeys(e,'Fav');
 const layout=equipmentUpdateKeys({...e,layout:{nameSize:130}},'Fav');
 for(const key of ['finish','signature','symbols','art'])assert.equal(layout[key],original[key]);
 assert.notEqual(layout.layout,original.layout);
 const speed=equipmentUpdateKeys({...e,particleSpeed:180,borderSpeed:150},'Fav');
 assert.deepEqual(speed,original);
});

test('in-place mutations invalidate only the affected cosmetic state',()=>{
 const e={...DEFAULT_EQUIPMENT,finish:'reality-rift',finishSettings:{'reality-rift':{x:50}},emblems:[{x:7,y:8}]};
 const before=equipmentUpdateKeys(e,'Fav');e.finishSettings['reality-rift'].x=60;
 const moved=equipmentUpdateKeys(e,'Fav');assert.notEqual(moved.finish,before.finish);assert.equal(moved.symbols,before.symbols);
 e.emblems[0].x=14;assert.notEqual(equipmentUpdateKeys(e,'Fav').symbols,moved.symbols);
 assert.notEqual(equipmentUpdateKeys(e,'New name').signature,moved.signature);
});

test('cached thumbnail SVGs are isolated images with local artwork and fragment references',()=>{
 const source='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><defs><path id="rail"/></defs><use href="#rail"/><image href="/img/hero-art/invoker.webp"/></svg>';
 const html=staticThumbnailImage(source,'border-preview-frame');
 assert.match(html,/^<img /);assert.doesNotMatch(html,/<svg/);
 const svg=decodeURIComponent(html.match(/src="data:image\/svg\+xml,([^"]+)"/)[1]);
 assert.equal([...svg.matchAll(/xmlns=/g)].length,1);
 assert.match(svg,/href="#rail"/);assert.match(svg,/href="data:image\/webp;base64,/);
 assert.doesNotMatch(svg,/href="\/img\//);
});
