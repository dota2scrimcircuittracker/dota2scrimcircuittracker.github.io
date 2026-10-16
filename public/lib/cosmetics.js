import { CATALOG, DEFAULT_EQUIPMENT, itemByKey } from './cosmetics-catalog.js';
import { signatureHtml } from './signatures.js';
import { steamAccount, steamIdToken } from './store.js';
import { cardArtwork } from './card-art.js';
import { heroById, heroImg } from './hero-meta.js';
import { plusSlot } from './hero-levels.js';
import { cardAppearance, selectedCardDesign, shownNickname } from './cosmetics-engine.js';
import { CANVAS_FINISHES } from './card-fx.js';
// Finishes with a speed setting: the particle ones, plus fx- finishes that animate (lib/card-fx.js, cosmetics-fx.css).
export const PARTICLE_FINISHES=Object.freeze(['inferno','blizzard','voidstorm','sandstorm','cosmic','diamond','stars','goldust','starlight','fx-drift','fx-sheen','fx-waves',...Object.keys(CANVAS_FINISHES)]);
// Finishes drawn on a canvas have a particle amount setting too; fx- borders have a border speed.
export const isCanvasFinish=id=>id in CANVAS_FINISHES;
export const isFxBorder=id=>typeof id==='string'&&id.startsWith('fx-');
const tuning=e=>({speed:(e.particleSpeed??DEFAULT_EQUIPMENT.particleSpeed)/100,amount:(e.particleAmount??DEFAULT_EQUIPMENT.particleAmount)/100,border:(e.borderSpeed??DEFAULT_EQUIPMENT.borderSpeed)/100});
// The layer a finish draws its particles in: a canvas, or a set of small elements the stylesheet animates.
export function particleLayerHtml(finish,e={},count=24) {
  if(isCanvasFinish(finish)) {const t=tuning(e);return `<span class="particles" aria-hidden="true"><canvas class="fx-canvas" data-fx="${CANVAS_FINISHES[finish]}" data-amt="${t.amount}" data-spd="${t.speed}"></canvas></span>`;}
  return PARTICLE_FINISHES.includes(finish)?`<span class="particles" aria-hidden="true">${Array.from({length:count},(_,i)=>`<i style="--i:${i};left:${(i*43+13)%100}%;top:${(i*29+7)%100}%;animation-delay:-${i*.39}s"></i>`).join('')}</span>`:'';
}
import { syncPackOfferClaims } from './bonus-offers.js';
import { applyLayout } from './card-layout.js';
import { setPlayerNickname } from './nicknames.js';

export const COLLECTION_API='https://steam-auth.ad2lstats.workers.dev/cosmetics';
let account=null, state=null, pending=null;
const appearances=new Map();
let viewerSeed;
try {viewerSeed=Number(sessionStorage.getItem('ad2l-card-shuffle-seed'));if(!viewerSeed){viewerSeed=Math.random();sessionStorage.setItem('ad2l-card-shuffle-seed',String(viewerSeed));}}catch {viewerSeed=Math.random();}
export function playerEquipment(id,fallback) {
  let hash=Math.floor(viewerSeed*4294967296);for(const c of String(id))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  return selectedCardDesign(appearances.get(String(id))??fallback,String(id)===String(account),hash/4294967296);
}
export const collectionState=()=>state;
// The nickname a player shows in place of their in-game name, or null (cosmetics-engine.js).
export const playerNickname=id=>appearances.get(String(id))?.nickname??null;
export async function collectionAction(action,details={}) {
  const token=await steamIdToken();if(!token)throw new Error('Sign in with Steam to collect cards.');
  account=await steamAccount();
  // Keep a failed request's ID for safe retry after a lost response.
  const payload=JSON.stringify({action,...details});
  const retryKey=`ad2l-collection-request:${account}:${payload}`;
  let previous;try {previous=localStorage.getItem(retryKey);}catch{}
  if(pending?.payload!==payload)pending={payload,id:previous??crypto.randomUUID()};
  if(action!=='session')try {localStorage.setItem(retryKey,pending.id);}catch{}
  const r=await fetch(COLLECTION_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,...details,requestId:pending.id})});
  const data=await r.json();
  if(!r.ok){if(r.status<500){try {localStorage.removeItem(retryKey);}catch{}pending=null;}throw new Error(data.error??'Could not update your collection.');}
  try {localStorage.removeItem(retryKey);}catch{}
  pending=null;
  // Read-only actions (Fav's ban list) don't send your collection back; keep the one we have.
  if(!data.state)return data;
  state=data.state;
  syncPackOfferClaims(state);
  appearances.set(String(account),cardAppearance(state));
  setPlayerNickname(account,shownNickname(state));
  document.querySelectorAll(`.ft-card[data-pick="${account}"]`).forEach(card=>applyEquipment(card,card.dataset.designSlot!=null?(state.cardDesigns?.[Number(card.dataset.designSlot)]??state.equipment):state.equipment,shownNickname(state)??card.dataset.playerName??'Your Name'));
  document.querySelectorAll(`.fantasy-tier-chip.open[data-expanded-account="${account}"]`).forEach(panel=>applyExpandedEquipment(panel,state.equipment,panel.dataset.playerName));
  dispatchEvent(new CustomEvent('collection-change',{detail:{state,account}}));
  return data;
}
export async function publicCollection(account) {
  const r=await fetch(`${COLLECTION_API}/collection/${account}`);if(!r.ok)throw new Error('Could not load this collection.');return r.json();
}
// Anyone's achievement progress and claims (lib/achievements.js), for their profile.
export async function publicAchievements(account) {
  const r=await fetch(`${COLLECTION_API}/achievements/${account}`);if(!r.ok)throw new Error('Achievements are unavailable. Try again shortly.');return r.json();
}
// Each saved design's rating counts (lib/card-ratings.js); rating one is the 'rate' action.
export async function cardRatings(account) {
  const r=await fetch(`${COLLECTION_API}/ratings/${account}`);if(!r.ok)throw new Error('Ratings unavailable.');return (await r.json()).cards;
}
// Every changed saved design in the league, with its ratings (the Gallery).
export async function galleryCards() {
  const r=await fetch(`${COLLECTION_API}/gallery`);if(!r.ok)throw new Error('Cards unavailable.');return (await r.json()).cards;
}
// The Feed (lib/feed.js): a page of posts older than before (ms), or the single post.
export async function feedPosts({before=null,post=null,account=null,type=[],exclude=[],sort='new',range='all',offset=0,from=null}={}) {
  const params=new URLSearchParams({...(from?{from:from.join(',')}:{}),...(before?{before}:{}),...(account!=null?{account}:{}),...(type.length?{type:[].concat(type).join(',')}:{}),...(exclude.length?{exclude:[].concat(exclude).join(',')}:{}),...(sort!=='new'?{sort}:{}),...(sort==='top'&&range!=='all'?{range}:{}),...(offset?{offset}:{})}).toString();
  const q=post?`?post=${encodeURIComponent(post)}`:params?`?${params}`:'';
  const r=await fetch(`${COLLECTION_API}/feed${q}`);if(!r.ok)throw new Error('Feed unavailable.');return r.json();
}
// A player's own Feed post (lib/feed.js buildUserPost). Images are base64 and can be megabytes,
// so this skips collectionAction's stored retry key: the request ID lives on the draft object, so
// pressing Post again after a lost response can't post twice.
export async function createFeedPost(draft,{text,mentions=[],clip,game,images,poll=null}) {
  const token=await steamIdToken();if(!token)throw new Error('Sign in with Steam to post.');
  draft.requestId??=crypto.randomUUID();
  const r=await fetch(`${COLLECTION_API}/post`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action:'post',text,...(mentions.length?{mentions}:{}),clip,game,images,...(poll?{poll}:{}),requestId:draft.requestId})});
  const data=await r.json().catch(()=>({error:r.status===413?'Those images are too large.':'Could not post.'}));
  if(!r.ok){if(r.status<500)draft.requestId=null;throw new Error(data.error??'Could not post.');}
  draft.requestId=null;state=data.state;return data;
}
// A comment with a picture or GIF (base64 image): the same larger-limit path as a post. A lost
// response isn't retried automatically, so the request ID lives on the draft like createFeedPost.
export async function createFeedComment(draft,{post,text,mentions=[],reply=null,image}) {
  const token=await steamIdToken();if(!token)throw new Error('Sign in with Steam to comment.');
  draft.requestId??=crypto.randomUUID();
  const r=await fetch(`${COLLECTION_API}/post`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action:'comment',post,text,...(mentions.length?{mentions}:{}),...(reply?{reply}:{}),image,requestId:draft.requestId})});
  const data=await r.json().catch(()=>({error:r.status===413?'That image is too large.':'Could not comment.'}));
  if(!r.ok){if(r.status<500)draft.requestId=null;throw new Error(data.error??'Could not comment.');}
  draft.requestId=null;state=data.state;return data;
}
export const feedCommentMediaUrl=(post,comment)=>`${COLLECTION_API}/cmedia/${encodeURIComponent(post)}/${comment}`;
export const feedMediaUrl=(post,n)=>`${COLLECTION_API}/media/${encodeURIComponent(post)}/${n}`;
// The signed-in player's own votes, "<owner>:<design key>" → rating; empty when signed out.
export async function myCardVotes() {
  const token=await steamIdToken().catch(()=>null);if(!token)return {};
  const r=await fetch(COLLECTION_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action:'my-votes'})});
  if(!r.ok)throw new Error('Your ratings are unavailable.');return (await r.json()).votes;
}
export async function cosmeticAppearances() {
  const r=await fetch(`${COLLECTION_API}/appearances`);if(!r.ok)throw new Error('Collection service unavailable.');const data=await r.json();
  for(const [id,equipment] of Object.entries(data)) {
    const appearance=String(account)===id&&state?.equipment?cardAppearance(state):equipment;
    appearances.set(id,appearance);setPlayerNickname(id,appearance.nickname);
  }
  return data;
}
export function cosmeticAttributes(raw) {
  const e={...DEFAULT_EQUIPMENT,...raw}, border=itemByKey(`border:${e.border}`);
  return ` data-cosmetic="true" data-texture="${border?.texture??'metal'}" data-finish="${itemByKey(`finish:${e.finish}`)?.id??'none'}" data-rarity="${border?.rarity??'free'}" style="--a:${border?.a??'#92969c'};--b:${border?.b??'#41454c'};--art-hue:${Number(e.hue)||0}deg;--particle-speed:${tuning(e).speed};--border-speed:${tuning(e).border}"`;
}
export function cosmeticLayers(e,name) {
  const equipment={...DEFAULT_EQUIPMENT,...e}, border=itemByKey(`border:${equipment.border}`);
  const symbol=equipment.emblem===false?'':border?.symbol??'';
  const particles=particleLayerHtml(equipment.finish,equipment);
  return `<span class="cosmetic-overlay" aria-hidden="true"></span>${particles}${!symbol?'':Array.isArray(equipment.emblems)&&equipment.emblems.length?equipment.emblems.map(m=>`<span class="cosmetic-emblem placed" aria-hidden="true" style="left:${Number(m.x)}%;top:${Number(m.y)}%;--emblem-size:${(Number(m.size)||100)/100}">${symbol}</span>`).join(''):`<span class="cosmetic-emblem" aria-hidden="true">${symbol}</span>`}${signatureHtml(equipment,name)}`;
}
export function applyEquipment(card,e,name) {
  if(!card)return;
  const border=itemByKey(`border:${e.border}`);
  card.dataset.cosmetic='true';card.dataset.texture=border?.texture??'metal';card.dataset.finish=e.finish;card.dataset.rarity=border?.rarity??'free';
  card.style.setProperty('--a',border?.a??'#92969c');card.style.setProperty('--b',border?.b??'#41454c');
  card.style.setProperty('--art-hue',`${Number(e.hue)||0}deg`);
  card.style.setProperty('--particle-speed',tuning(e).speed);card.style.setProperty('--border-speed',tuning(e).border);
  if(e.baseCard) {
    const base=e.baseCard,hero=base.hero??Number(card.dataset.autoHero),art=cardArtwork(hero,base);
    if(art) {
      [...card.classList].filter(c=>c.startsWith('src-')).forEach(c=>card.classList.remove(c));
      for(const c of art.cls?.split(' ')??[])if(c)card.classList.add(c);
      card.dataset.style=art.style;
      const host=card.querySelector('.ft-art');let img=host.querySelector('img');
      if(!img){img=document.createElement('img');img.alt='';host.append(img);}img.src=art.src;
      // The picture's aspect lets a rotated crop show the whole image under the frame, not a clipped card-shaped piece.
      const aspect=()=>{if(img.naturalWidth)card.style.setProperty('--art-ar',img.naturalWidth/img.naturalHeight);};img.addEventListener('load',aspect);aspect();
      img.dataset.wide=heroImg(heroById(hero)?.name)??'';
      card.classList.toggle('ft-custom-crop',!!art.crop);
      if(art.crop){for(const k of ['x','y']){card.style.setProperty(`--art-${k}`,`${art.crop[k]}%`);card.style.setProperty(`--art-${k}f`,art.crop[k]/100);}card.style.setProperty('--art-zoom',art.crop.zoom);card.style.setProperty('--art-rot',`${art.crop.rot??0}deg`);card.style.setProperty('--art-flip',art.crop.flip?-1:1);}
      const label=card.querySelector('.ft-sig');if(label)label.textContent=heroById(hero)?.name??'';
      // The Dota Plus badge belongs to the shown hero: redraw it (the page's observer fills it in).
      const plus=card.querySelector('.ft-plus');
      if(plus)plus.innerHTML=plusSlot(card.dataset.pick,hero);
    }
  }
  applyLayout(card,e.layout??null,name);
  // No card name of its own: the player's shown name (their nickname, else in-game name).
  if(e.layout?.name==null&&name)card.querySelectorAll('.ft-name').forEach(n=>{if(n.textContent!==name){n.textContent=name;n.title=name;}});
  const face=card.querySelector('.ft-front');face.querySelectorAll('.card-autograph,.cosmetic-overlay,.cosmetic-emblem,.particles').forEach(n=>n.remove());
  face.insertAdjacentHTML('beforeend',cosmeticLayers(e,e.layout?.name??name));
}
export function applyExpandedEquipment(panel,raw,name) {
  const e={...DEFAULT_EQUIPMENT,...raw},border=itemByKey(`border:${e.border}`);
  panel.dataset.cosmetic='true';panel.dataset.texture=border?.texture??'metal';
  panel.style.setProperty('--a',border?.a??'#92969c');panel.style.setProperty('--b',border?.b??'#41454c');
  panel.style.setProperty('--art-hue',`${Number(e.hue)||0}deg`);
  panel.style.setProperty('--expanded-signature-size',`clamp(18px,${e.size/5}cqi,64px)`);
  panel.querySelector(':scope > .tier-expanded-signature')?.remove();
  const html=signatureHtml(e,name);
  if(html) {const layer=document.createElement('div');layer.className='tier-expanded-signature';layer.setAttribute('aria-hidden','true');layer.innerHTML=html;panel.append(layer);}
  const art=panel.querySelector('.tier-card-main .ft-art img');
  if(art?.src)panel.style.setProperty('--tier-art',`url(${JSON.stringify(art.src)})`);
}
export { CATALOG, DEFAULT_EQUIPMENT };
