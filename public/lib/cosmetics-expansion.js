import {assetSource,pattern,signature} from './cosmetics-expansion-assets.js';
import {narrowBorder} from './cosmetics-expansion-frame.js';
import {restoredFinish,restoredSignature,signatureSVG} from './cosmetics-expansion-treatments.js';
import {editableWar,cloud,applySettings} from './cosmetics-expansion-details.js';
import {upgradeRealityRift} from './reality-rift.js';
import {tierBorderDetails} from './cosmetics-tier-borders.js';
import {tierFinishDetails} from './cosmetics-tier-finishes.js';
import {tierSignatureArt} from './cosmetics-tier-signatures.js';
import {borderSignature} from './cosmetics-border-upgrades.js';
import {waveBorderHtml} from './cosmetics-wave-borders.js';
import {redrawnBorderHtml,REDRAWN_BORDERS} from './cosmetics-redrawn-borders.js';
import {waveFinishHtml} from './cosmetics-wave-finishes.js';
import {waveSignatureHtml} from './cosmetics-wave-signatures.js';
import {houseBorder,houseSignature,signatureInk} from './cosmetics-house-style.js';
import {staticThumbnailImage} from './cosmetics-thumbnails.js';
import {normalizeSettings,defaults} from './cosmetics-expansion-settings.js';
import {particleGroups,groupOf,groupPace} from './cosmetics-particle-groups.js';
import {renderOuroboros,upgradeHorizon,polishBorder,borderColorFlow} from './cosmetics-expansion-upgrades.js';
import {itemByKey} from './cosmetics-catalog.js';
import {borderSymbolBox,borderSymbolDefaults,hasExpansionEmblems} from './cosmetics-expansion-symbols.js';
export {hasExpansionEmblems};
export {defaults as effectDefaults,normalizeSettings as normalizeEffect};

let serial=0;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ideaOf=item=>({...item,id:item.expansion.ideaId,type:item.type==='autograph'?'signature':item.type});
const holder=markup=>{const el=document.createElement('div');el.innerHTML=markup;return el;};
const sourceDefs=(idea,id,name)=>{
 const source=assetSource(idea,{name,hero:'invoker',prefix:'source'});
 return source.slice(source.indexOf('<defs>'),source.indexOf('</defs>')+7).replaceAll(`source-${idea.id}`,id);
};
const ring=w=>`M19 9H281Q292 9 292 21V379Q292 391 280 391H20Q8 391 8 379V21Q8 9 19 9ZM${8+w} ${9+w}V${391-w}H${292-w}V${9+w}Z`;
export const expansionSymbol=`<svg viewBox="0 0 59 68" aria-hidden="true"><path d="M8 58V14h9v9h7V10h10v13h7V14h10v44Z" fill="#657e81" stroke="#bcc7b1"/><path d="M15 56V33h29v23ZM22 32V16h12v16" fill="#344f59" stroke="#859b9e"/><circle class="tier-fortress-beacon" cx="28" cy="41" r="7" fill="none" stroke="#acffeb" stroke-width=".8"/><circle class="tier-fortress-core" cx="28" cy="41" r="4" fill="#97e6db"/></svg>`;
export const defaultExpansionEmblems=borderSymbolDefaults;
const ornamentGroups=root=>[...root.children].filter(el=>el.hasAttribute('data-corner-ornament')||/^translate\((0|300) (0|400)\) rotate\((0|90|180|270)\)$/.test(el.getAttribute('transform')??''));
const ornamentCache=new Map();
// Codex items' particle groups (lib/cosmetics-particle-groups.js): clone or trim the matching elements to the count,
// scale their dots and strokes, and pace them on the group's speed. Clones shift along their path, or nudge off their spot.
function applyParticleGroups(root,type,itemId,settings){
 for(const g of particleGroups(type,itemId)){
  if(!g.selector)continue;
  const {count,size,speed}=groupOf(type,itemId,settings,g.key),originals=[...root.querySelectorAll(g.selector)];
  if(!originals.length||(count===originals.length&&size===1&&speed===1))continue;
  for(let n=originals.length;n<count;n++){
   const source=originals[n%originals.length],copy=source.cloneNode(true),round=Math.floor(n/originals.length);
   copy.style.animationDelay=`-${(n*.71)%9}s`;
   const along=parseFloat(copy.style.offsetDistance);if(Number.isFinite(along))copy.style.offsetDistance=`${(along+round*37+n*7.3)%100}%`;
   else if(copy.hasAttribute('cx')){copy.setAttribute('cx',Number(copy.getAttribute('cx'))+Math.sin(n*3.1)*9);copy.setAttribute('cy',Number(copy.getAttribute('cy'))+Math.cos(n*2.3)*8);}
   source.after(copy);
  }
  const all=[...root.querySelectorAll(g.selector)];
  for(const extra of all.slice(count))extra.remove();
  for(const el of all.slice(0,count)){
   if(size!==1)for(const part of [el,...el.querySelectorAll('*')]){
    for(const a of ['r','rx','ry','stroke-width'])if(part.hasAttribute(a))part.setAttribute(a,Number(part.getAttribute(a))*size);
    if(part.tagName.toLowerCase()==='path'&&!part.hasAttribute('stroke-width')&&part.getAttribute('stroke'))part.setAttribute('stroke-width',size);
   }
   const pace=groupPace(type,speed);if(pace)el.setAttribute('style',`${el.getAttribute('style')??''};${pace}`);
  }
 }
}
export function expansionSymbolHtml(id,index=0){
 if(id==='ancient-war')return expansionSymbol;
 const box=borderSymbolBox(id),item=itemByKey(`border:${id}`);if(!box||!item)return '';
 if(!ornamentCache.has(id)){
  const root=holder(`<svg>${narrowBorder(ideaOf(item),'ornament',item.expansion.variant==='B'?8:6)}</svg>`).firstElementChild;
  ornamentCache.set(id,ornamentGroups(root)[0]?.innerHTML??'');
 }
 return `<svg viewBox="${box.join(' ')}" aria-hidden="true">${ornamentCache.get(id)}</svg>`;
}
export function expansionSymbolStyle(id){const box=borderSymbolBox(id);return box?`--ornament-width:${box[2]}px;--ornament-height:${box[3]}px;`:'';}
export function borderEmblemList(e){return e.borderEmblems?.[e.border]??(hasExpansionEmblems(e.border)&&e.border!=='ancient-war'?defaultExpansionEmblems(e.border):e.emblems??defaultExpansionEmblems(e.border));}

export function expansionBorderHtml(item,{detachedSymbols=true,settings}={}){
 if(!item?.expansion)return '';
 if(item.expansion.wave)return waveBorderHtml(item,settings);
 if(REDRAWN_BORDERS.includes(item.id))return redrawnBorderHtml(item,settings);
 const idea=ideaOf(item),id=`exp-border-${++serial}`,b=item.expansion.variant==='B',w=item.id==='ancient-war'?8:b?8:6;
 let markup=narrowBorder(idea,id,w);
 let defs=pattern(item.id,id,item.a,item.b)+`<clipPath id="${id}-frame"><path d="${ring(w)}" clip-rule="evenodd"/></clipPath>`;
 if(['naval','malachite'].includes(item.id)){
  defs+=pattern(item.id,id+'-vertical',item.a,item.b)+pattern(item.id,id+'-horizontal',item.a,item.b).replace('patternUnits="userSpaceOnUse"','patternUnits="userSpaceOnUse" patternTransform="rotate(90)"');
  defs+=`<clipPath id="${id}-paint-ring"><path d="${ring(w)}" clip-rule="evenodd"/></clipPath>`;
  const material=`<g clip-path="url(#${id}-paint-ring)"><rect x="8" y="9" width="284" height="382" fill="url(#${id}-vertical-material)"/><rect x="8" y="9" width="284" height="${w}" fill="url(#${id}-horizontal-material)"/><g transform="translate(300 400) rotate(180)"><rect x="8" y="9" width="284" height="${w}" fill="url(#${id}-horizontal-material)"/></g></g>`;
  const end=markup.indexOf('/>')+2;markup=markup.slice(0,end)+material+markup.slice(end);
 }
 const host=holder(`<svg class="exp-layer exp-border ${item.id==='ancient-war'?'exp-war':''}" data-border-id="${item.id}" viewBox="8 9 284 382" preserveAspectRatio="none" aria-hidden="true"><defs>${defs}</defs>${markup}</svg>`),root=host.firstElementChild;
 if(item.id==='naval'){
  root.querySelectorAll('rect[x="12"][y="12"][width="22"][height="20"],path[d="M14 16h17m-17 4h17m-17 4h17"]').forEach(e=>e.remove());
  root.querySelectorAll('rect[stroke-dasharray]').forEach(e=>e.setAttribute('stroke-width','.8'));
 }
 if(item.id==='ouroboros')renderOuroboros(root,id);
 if(detachedSymbols&&borderSymbolBox(item.id))ornamentGroups(root).forEach(el=>el.remove());
 if(item.id==='event-horizon')upgradeHorizon(root,id);
 if(item.id==='event-horizon')root.querySelector('[id$="-nebula"]')?.classList.add('exp-nebula-spectrum');
 if(item.id!=='ouroboros')polishBorder(root,id,w,{mirror:item.id==='mirror',animated:item.rarity!=='common',rare:item.rarity==='rare',tint:item.a});
 if(item.id==='ancient-war'){
  editableWar(root,id,true);root.querySelector('[data-emblems]')?.remove();
  if(!detachedSymbols){root.insertAdjacentHTML('beforeend',expansionSymbol.replace('<svg ','<svg x="0" y="0" width="59" height="68" '));root.insertAdjacentHTML('beforeend',`<g transform="translate(300 400) rotate(180)">${expansionSymbol.replace('<svg ','<svg x="0" y="0" width="59" height="68" ')}</g>`);}
  root.querySelector('linearGradient')?.classList.add('exp-war-metal');
 }
 borderColorFlow(root,id,w,item.id);
 tierBorderDetails(root,id,item,w);
 houseBorder(root,id,w,item);
 borderSignature(root,id,w,item);
 // In the thumbnail the corner pieces live inside this SVG; keep them above the rim details, as they are on the card.
 if(!detachedSymbols)ornamentGroups(root).forEach(el=>root.append(el));
 applyParticleGroups(root,'border',item.id,settings);
 if(item.id==='event-horizon'&&detachedSymbols)return horizonHalves(root);
 return host.innerHTML;
}
// The orbit's far half passes behind the card: a copy of the atmosphere sits behind the faces and
// shows only where it leaves the card, while the near half stays in front. Both clip in the tilted orbit's own space.
function horizonHalves(root){
 const id=root.querySelector('clipPath[id$="-frame"]').id.replace(/-frame$/,''),half=(name,y,h)=>`<clipPath id="${id}-${name}" clipPathUnits="userSpaceOnUse"><rect x="-200" y="${y}" width="700" height="${h}"/></clipPath>`;
 root.querySelector('defs').insertAdjacentHTML('beforeend',half('near',203,400)+half('far',-400,603));
 const orbit=[...root.children].filter(el=>/^rotate\(-24 150 203\)$/.test(el.getAttribute('transform')??''));
 const back=root.cloneNode(false);back.classList.add('exp-horizon-back');back.removeAttribute('data-border-id');
 back.append(root.querySelector('defs').cloneNode(true),...orbit.map(el=>{const copy=el.cloneNode(true);copy.setAttribute('clip-path',`url(#${id}-far)`);return copy;}));
 orbit.forEach(el=>el.setAttribute('clip-path',`url(#${id}-near)`));
 return root.outerHTML+back.outerHTML.replaceAll(`id="${id}-`,`id="${id}-b-`).replaceAll(`url(#${id}-`,`url(#${id}-b-`);
}
// Fit a frame to a wide sample without shrinking its corners into a tiny card.
// The nine windows reuse one copy of the real artwork; only the straight edges stretch.
const borderSwatches=new Map(),finishSwatches=new Map();
export function expansionBorderSwatchHtml(item){
 if(!item?.expansion)return '';
 if(borderSwatches.has(item.id))return borderSwatches.get(item.id);
 const art=expansionBorderHtml(item,{detachedSymbols:false});
 if(item.id==='event-horizon'){
  const sample=`<span class="border-preview-atmosphere">${staticThumbnailImage(art,'exp-border')}</span>`;
  borderSwatches.set(item.id,sample);return sample;
 }
 const root=holder(art).firstElementChild,id=`exp-frame-sample-${++serial}`;
 const xs=[0,76,224,300],ys=[0,80,320,400],targetYs=[0,70,130,200];
 const windows=Array.from({length:9},(_,n)=>{const x=n%3,y=Math.floor(n/3);return `<svg class="border-preview-slice" x="${xs[x]}" y="${targetYs[y]}" width="${xs[x+1]-xs[x]}" height="${targetYs[y+1]-targetYs[y]}" viewBox="${xs[x]} ${ys[y]} ${xs[x+1]-xs[x]} ${ys[y+1]-ys[y]}" preserveAspectRatio="none" aria-hidden="true"><use href="#${id}"/></svg>`;}).join('');
 const sample=staticThumbnailImage(`<svg viewBox="0 0 300 200" preserveAspectRatio="none"><defs><g id="${id}">${root.innerHTML}</g></defs>${windows}</svg>`,'border-preview-frame');
 borderSwatches.set(item.id,sample);return sample;
}
export function expansionFinishSwatchHtml(item){
 if(!finishSwatches.has(item.id))finishSwatches.set(item.id,staticThumbnailImage(expansionFinishHtml(item),'exp-layer exp-finish'));
 return finishSwatches.get(item.id);
}
export function expansionFinishHtml(item,e={}){
 if(!item?.expansion)return '';
 if(item.expansion.wave)return waveFinishHtml(item,e);
 const idea=ideaOf(item),id=`exp-finish-${++serial}`,b=item.expansion.variant==='B';
 const art=restoredFinish(idea,id,b,'invoker').replace('transform="translate(-37.5 -33.75) scale(1.25)"','transform="translate(0 0)"').replace('viewBox="0 0 300 400"','viewBox="0 0 300 400" x="0" y="0" width="300" height="400"');
 const host=holder(`<svg class="exp-layer exp-finish design-preview" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true">${sourceDefs(idea,id,'Fav')}${art}</svg>`),root=host.firstElementChild;
 root.dataset.finishId=item.id;
 const treatmentIds=new Set([...root.querySelectorAll('.v4-finish defs [id]')].map(el=>el.id));
 for(const definition of root.querySelector('defs').querySelectorAll('[id]'))if(treatmentIds.has(definition.id))definition.remove();
 // These materials fade their own edges; avoid cutting off the clear coat or ink blooms.
 if(['velvet','ink-water'].includes(item.id))root.querySelector(`mask[id="${id}-coverage"] rect`)?.setAttribute('fill','white');
 root.querySelector('.lenticules')?.setAttribute('opacity','.55');
 if(item.id==='reality-rift')upgradeRealityRift(root,id);
 if(item.id==='deep-sea')cloud(root,id,b,false);
 if(item.id==='shattered-time')root.querySelectorAll('feGaussianBlur').forEach(el=>el.setAttribute('stdDeviation','1.4'));
 if(item.id==='supernova'){
  root.querySelector('.nova-rings')?.setAttribute('opacity','.8');
  root.querySelector('.nova-rings')?.classList.add('exp-nova-spectrum');
  root.querySelector('.v4-finish [id$="-star"]')?.classList.add('exp-nova-core');
 }
 if(['deep-sea','reality-rift'].includes(item.id))root.querySelector('[id$="-vapor-light"]')?.classList.add(item.id==='deep-sea'?'exp-tide-spectrum':'exp-rift-spectrum');
 if(item.id==='lenticular'){
  root.querySelector('.v4-finish defs').insertAdjacentHTML('beforeend',`<radialGradient id="${id}-lens-gloss"><stop stop-color="#f5f4ff" stop-opacity=".2"/><stop offset=".28" stop-color="#d5ecf4" stop-opacity=".1"/><stop offset=".66" stop-color="#d9c5ea" stop-opacity=".025"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`);
  root.querySelector('.v4-finish g[mask] > g').insertAdjacentHTML('beforeend',`<g transform="rotate(24 150 200)"><g class="exp-lens-gloss"><ellipse cx="125" cy="155" rx="66" ry="330" fill="url(#${id}-lens-gloss)"/></g></g>`);
 }
 tierFinishDetails(root,id,item);
 // After the tier details, which rebuild the plankton and rift dust the groups clone.
 applyParticleGroups(root,'finish',item.id,e.finishSettings?.[item.id]);
 applySettings(host,idea,e.finishSettings?.[item.id]||item.expansion.settings||{});
 return host.innerHTML;
}
export function expansionSignatureHtml(item,text){
 if(!item?.expansion)return '';
 if(item.expansion.wave)return waveSignatureHtml(item,text);
 const idea=ideaOf(item),id=`exp-signature-${++serial}`,b=item.expansion.variant==='B';
 let art=item.expansion.source===3?signatureSVG(idea,id,item.expansion.variant,text):item.expansion.source===2?`<svg viewBox="0 0 300 400"><g>${signature(idea,id,text)}</g></svg>`:restoredSignature(idea,id,b,text);
 if(item.id==='stacked'){
  const glyphs=[...text],first=escape(glyphs.shift()||'F'),rest=escape(glyphs.join('')),width=Math.min(150,Math.max(30,glyphs.length*16)),start=(300-width-42)/2;
  // Tuck the small letters under the initial's crossbar. No artificial joining stroke.
  art=`<svg class="v4-signature" viewBox="0 0 300 400"><g><text x="${start}" y="260" fill="#f1e0ba" font-family="RoundDafoe" font-size="82">${first}</text><text x="${start+24}" y="265" fill="#f1e0ba" font-family="RoundCaveat" font-size="35" textLength="${width}" lengthAdjust="spacingAndGlyphs">${rest}</text><path d="M${start-3} 279C${start+29} 270 ${start+width+36} 289 ${start+width+39} 275C${start+width+41} 268 ${start+width+22} 270 ${start+width+13} 274" fill="none" stroke="#e6d4af" stroke-width="1.1" stroke-linecap="round"/></g></svg>`;
 }
 if(item.id==='fold'){
  art=art.replace(/<g style="mix-blend-mode:[^"]*">[\s\S]*?<\/g>/g,'').replace(/<path d="M38 275l27 -9h170l-24 9Z"[^>]*\/>/,'');
  art=art.replace('</g></svg>','<path d="M48 276H254" fill="none" stroke="#e9ddbd" stroke-width="1.3" stroke-linecap="round"/></g></svg>');
 }
 if(item.id==='continuous')art=art.replace(/(class="v4-flourish-trace"[^>]*stroke-width=")[^"]+/,`$1${b?'1':'1.3'}`);
 art=houseSignature(tierSignatureArt(art,item,id,text),item,id);
 art=art.replace('<svg ', '<svg x="0" y="0" width="300" height="400" ');
 let defs=sourceDefs(idea,id,text);
 if(item.expansion.source===3)defs=defs.replace(new RegExp(`<linearGradient id="${id}-ribbon"[\\s\\S]*?</linearGradient>`),'');
 return `<svg class="exp-layer exp-signature-svg" viewBox="0 185 300 110" style="--signature-glow:${signatureInk(item.id)[1]}" aria-hidden="true">${defs}${art}</svg>`;
}

// Shattered Time's shards show the hero's other artwork: the Steam portrait, or the site art when the card already uses the portrait.
const otherArtwork=(src,wide='')=>{const slug=wide.match(/heroes\/([a-z0-9_]+)\.png/)?.[1];return !slug?src:src.includes('_vert.')?`/img/hero-art/${slug}.webp`:`https://cdn.cloudflare.steamstatic.com/apps/dota2/images/heroes/${slug}_vert.jpg`;};
// Collect once per DOM batch: changing a card's many SVG layers should update that card once.
function collectCards(node,cards){
 if(node.matches?.('.ft-card'))cards.add(node);
 node.querySelectorAll?.('.ft-card').forEach(c=>cards.add(c));
 const nearest=node.closest?.('.ft-card');if(nearest)cards.add(nearest);
}
if(typeof document!=='undefined'){
 const watched=new WeakSet();
 const visibility=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
  for(const entry of entries)entry.target.toggleAttribute('data-effects-offscreen',!entry.isIntersecting);
 },{rootMargin:'120px'}):null;
 const syncCards=cards=>{
  for(const card of cards){
   if(!card.isConnected){visibility?.unobserve(card);watched.delete(card);continue;}
   if(visibility&&!watched.has(card)){watched.add(card);visibility.observe(card);}
   const image=card.querySelector('.ft-art img');if(!image)continue;
   const src=image.getAttribute('src'),other=otherArtwork(src,image.dataset.wide);
   for(const fragment of card.querySelectorAll('.exp-finish image,.exp-mirror image')){const want=fragment.classList.contains('exp-other-time')?other:src;if(fragment.getAttribute('href')!==want)fragment.setAttribute('href',want);}
  }
 };
 const observer=new MutationObserver(records=>{
  const cards=new Set();
  for(const record of records){
   if(record.type==='attributes')collectCards(record.target,cards);
   else for(const node of [...record.addedNodes,...record.removedNodes])if(node.nodeType===1)collectCards(node,cards);
  }
  syncCards(cards);
 });
 observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
 const existing=new Set();collectCards(document.documentElement,existing);syncCards(existing);
 const tabVisibility=()=>document.documentElement.classList.toggle('cosmetics-tab-hidden',document.hidden);
 document.addEventListener('visibilitychange',tabVisibility);tabVisibility();
}
