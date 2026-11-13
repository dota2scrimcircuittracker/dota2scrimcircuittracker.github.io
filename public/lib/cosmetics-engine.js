import { CATALOG, TIERS, PACK_ODDS, arcanaOdds, DEFAULT_EQUIPMENT, itemByKey } from './cosmetics-catalog.js';
import { PACK_KIND_TYPES, parsePack, isThemedPack } from './pack-types.js';
import { TWIN_TURNS } from './cosmetics-arcana-catalog.js';
import { heroById } from './hero-meta.js';
import { CARD_ART } from './card-art-data.js';
import { SCREEN_ART } from './screen-art-data.js';
import { ALL_SCREENS, LEGENDARY_SCREENS } from './legendary-screens.js';
const screenHero=new Map(ALL_SCREENS.map(s=>[s.id,s.hero??null]));
import { CARD_STYLES, validCardCrop } from './card-art.js';
import { validLayout, MAX_NAME } from './card-layout.js';
import { LETTER_CASES } from './signatures.js';
import {validFinishSettings} from './cosmetics-expansion-settings.js';
import {validBorderSettings} from './cosmetics-particle-groups.js';
import {hasExpansionEmblems} from './cosmetics-expansion-symbols.js';

export const PACK_INTERVAL_MS=8*60*60*1000;
export const NORMAL_PACK_CAP=3;
// How many card designs a player can save: CARD_SLOTS free, plus any bought in the shop (lib/shop.js).
export const CARD_SLOTS=5;
export const slotCount=state=>CARD_SLOTS+(state?.extraSlots??0);
const slotList=(list,n=CARD_SLOTS)=>Array.from({length:n},(_,i)=>list?.[i]??null);
export function cardDesignState(state) {
  const n=slotCount(state),designs=Array.from({length:n},(_,i)=>state.cardDesigns?.[i]??(i===0?state.equipment:null));
  return {cardDesigns:designs,cardNames:slotList(state.cardNames,n),primaryCard:state.primaryCard??0,shuffleCards:state.shuffleCards??false,cardOrder:cardOrderOf(state.cardOrder,n)};
}
// The order your card slots show on your profile: every slot once. Only the display moves, so a
// slot's ratings, Feed posts and name stay with it. Anything else reads as the plain order.
const isCardOrder=(order,n=CARD_SLOTS)=>Array.isArray(order)&&order.length===n&&[...order].sort((a,b)=>a-b).every((v,i)=>v===i);
export const cardOrderOf=(order,n=CARD_SLOTS)=>isCardOrder(order,n)?[...order]:Array.from({length:n},(_,i)=>i);
export function setCardOrder(state,order) {
  if(!isCardOrder(order,slotCount(state)))throw new Error('Choose an order for all of your cards.');
  return {...state,cardOrder:[...order]};
}
// What a saved card is called in the slot list and under it on the profile: its name, else "Card 2".
export const cardSlotName=(prefs,slot)=>prefs?.cardNames?.[slot]??`Card ${slot+1}`;
// Names one of your card slots (null or blank clears it, back to "Card 2"). Same rules as nicknames.
export function setCardName(state,slot,raw) {
  if(!Number.isInteger(slot)||slot<0||slot>=slotCount(state))throw new Error('Choose one of your cards.');
  const name=raw==null?'':String(raw).replace(/\s+/g,' ').trim();
  if(name&&([...name].length>MAX_NAME||/[\u0000-\u001f\u007f<>]/.test(name)))throw new Error(`Card names are 1 to ${MAX_NAME} characters, plain text.`);
  const cardNames=slotList(state.cardNames,slotCount(state));cardNames[slot]=name||null;
  return {...state,cardNames};
}
// The public look of a player's cards; nickname is the name they chose to show, else null.
export function cardAppearance(state) {
  const preferences=cardDesignState(state);
  return {...state.equipment,...preferences,nickname:shownNickname(state)};
}
// Your name on the site: a nickname, and whether it shows in place of your in-game name (on your
// cards and your profile, where the in-game name follows in brackets). Same rules as card names.
export function setNickname(state,{nickname=null,showNickname=false}={}) {
  if(typeof showNickname!=='boolean')throw new Error('Choose which name to show.');
  let name=nickname==null?'':String(nickname).replace(/\s+/g,' ').trim();
  if(name&&([...name].length>MAX_NAME||/[\u0000-\u001f\u007f<>]/.test(name)))throw new Error(`Nicknames are 1 to ${MAX_NAME} characters, plain text.`);
  if(showNickname&&!name)throw new Error('Type a nickname to show it.');
  return {...state,nickname:name||null,showNickname};
}
export const shownNickname=state=>state?.showNickname&&state.nickname?state.nickname:null;
// Your profile's background: one of your collected loading screens, or null for none. place is
// 'head' (behind your name) or 'page' (the whole profile); x, y and zoom frame it like a card
// crop; dim (0-90) darkens it so the page stays readable; style is a card image style (null for
// the plain image) and hue turns its colours (0-360). sig is your signature on it, or null: an
// owned signature style and modifier, placed at x, y (percent of the background), size and
// rotation like a card's. text is the colour of the profile head's text over it: 'auto' (the
// default: each piece of text goes dark where the art behind it is bright), 'site' (the site's
// own colours) or a '#rrggbb'. A bare screen id is the defaults.
export const PROFILE_BG_PLACES=['head','page'],PROFILE_TEXT_MODES=['auto','site'];
export function profileBackgroundOf(bg) {
  if(!bg)return null;
  const b=typeof bg==='string'?{id:bg}:bg;
  return {id:b.id,place:b.place??'head',x:b.x??50,y:b.y??30,zoom:b.zoom??1,dim:b.dim??(b.place==='page'?70:45),style:b.style??null,hue:b.hue??0,text:b.text??'auto',sig:b.sig?{translation:'none',x:50,y:50,size:5,rotation:-7,...b.sig}:null};
}
export function setProfileBackground(state,{background=null}={}) {
  if(background==null)return {...state,profileBackground:null};
  if(typeof background!=='object'||Array.isArray(background))throw new Error('Choose a valid background.');
  const bg=profileBackgroundOf(background);
  if(!(state.screens??[]).includes(bg.id))throw new Error('Collect this loading screen before using it as your background.');
  if(!PROFILE_BG_PLACES.includes(bg.place))throw new Error('Choose the header or the whole page.');
  if(!validCardCrop({x:bg.x,y:bg.y,zoom:bg.zoom}))throw new Error('Choose a valid framing.');
  if(typeof bg.dim!=='number'||!Number.isFinite(bg.dim)||bg.dim<0||bg.dim>90)throw new Error('Choose a valid dim level.');
  if(bg.style!=null&&!CARD_STYLES.some(([id])=>id===bg.style))throw new Error('Choose a valid image style.');
  if(typeof bg.hue!=='number'||!Number.isFinite(bg.hue)||bg.hue<0||bg.hue>360)throw new Error('Choose a valid hue.');
  if(!PROFILE_TEXT_MODES.includes(bg.text)&&(typeof bg.text!=='string'||!/^#[0-9a-f]{6}$/i.test(bg.text)))throw new Error('Choose a valid text colour.');
  bg.text=bg.text.toLowerCase();
  if(bg.sig) {
    const owns=(type,id)=>typeof id==='string'&&!!itemByKey(`${type}:${id}`)&&state.inventory?.[`${type}:${id}`]>0;
    if(!owns('autograph',bg.sig.autograph))throw new Error('Collect this signature style before using it.');
    if(bg.sig.translation!=='none'&&!owns('translation',bg.sig.translation))throw new Error('Collect this modifier before using it.');
    for(const [k,min,max] of [['x',0,100],['y',0,100],['size',2,12],['rotation',-180,180]])
      if(typeof bg.sig[k]!=='number'||!Number.isFinite(bg.sig[k])||bg.sig[k]<min||bg.sig[k]>max)throw new Error('Invalid signature position or size.');
    const {autograph,translation,x,y,size,rotation,letterCase='lower'}=bg.sig;bg.sig={autograph,translation,x,y,size,rotation};
    if(!LETTER_CASES.includes(letterCase))throw new Error('Choose lower or upper case.');
    if(letterCase==='upper')bg.sig.letterCase='upper';
  }
  return {...state,profileBackground:bg};
}
export function saveCardDesign(state,raw,slot=state.primaryCard??0) {
  if(!Number.isInteger(slot)||slot<0||slot>=slotCount(state))throw new Error('Choose one of your cards.');
  const preferences=cardDesignState(state),current=preferences.cardDesigns[slot]??state.equipment;
  const validated=equipCosmetics({...state,equipment:current},raw).equipment;
  // Twin Card (a tool:twin-<turn> arcana): the card has a back, a second design built in the editor
  // (its own artwork, border, finish...), and turns between the two. Anything the back leaves out
  // is the front's. A save that leaves the twin out keeps it; null removes it.
  const twin=raw?.twin!==undefined?raw.twin:current?.twin??null;
  if(twin!=null) {
    const {turn,design}=twin&&typeof twin==='object'?twin:{};
    if(!TWIN_TURNS.includes(turn))throw new Error('Choose how your twin card turns.');
    if(!(state.inventory?.[`tool:twin-${turn}`]>0))throw new Error('Get this Twin Card in the shop before using it.');
    if(!design||typeof design!=='object'||Array.isArray(design))throw new Error('Build the back of your card first.');
    validated.twin={turn,design:twinCopy(equipCosmetics({...state,equipment:validated},twinCopy({...validated,...design})).equipment)};
  }
  preferences.cardDesigns[slot]=validated;
  return {...state,...preferences,equipment:preferences.cardDesigns[preferences.primaryCard]};
}
// The back's own twin is left off: a card turns between two designs, never a chain.
const twinCopy=design=>{const {twin,...rest}=design;return rest;};
export function setCardPreferences(state,{primaryCard=state.primaryCard??0,shuffleCards=state.shuffleCards??false}) {
  const preferences=cardDesignState(state);
  if(!Number.isInteger(primaryCard)||primaryCard<0||primaryCard>=slotCount(state)||!preferences.cardDesigns[primaryCard])throw new Error('Save this card before making it primary.');
  if(typeof shuffleCards!=='boolean')throw new Error('Choose a valid shuffle setting.');
  return {...state,...preferences,primaryCard,shuffleCards,equipment:preferences.cardDesigns[primaryCard]};
}
export function selectedCardDesign(appearance,own=false,random=0) {
  if(!appearance?.cardDesigns)return appearance;
  const saved=appearance.cardDesigns.filter(Boolean);
  return !own&&appearance.shuffleCards&&saved.length?saved[Math.min(saved.length-1,Math.floor(random*saved.length))]:appearance.cardDesigns[appearance.primaryCard??0]??appearance;
}
export function grantLogin(saved, now = new Date()) {
  const time=now.getTime();
  if (!saved) return {v:2, inventory:{}, packs:['common','common','common'], equipment:{...DEFAULT_EQUIPMENT}, nextPackAt:null};
  const state = structuredClone(saved), normal=state.packs.filter(p=>p==='common').length;
  // Preserve every existing pack during migration, even inventories above the new cap.
  if(state.v!==2) {state.v=2;state.nextPackAt=normal>=NORMAL_PACK_CAP?null:time+PACK_INTERVAL_MS;delete state.lastDay;}
  if(normal>=NORMAL_PACK_CAP) {state.nextPackAt=null;return state;}
  if(state.nextPackAt==null)state.nextPackAt=time+PACK_INTERVAL_MS;
  if(time>=state.nextPackAt) {
    const earned=Math.min(NORMAL_PACK_CAP-normal,1+Math.floor((time-state.nextPackAt)/PACK_INTERVAL_MS));
    state.packs.push(...Array(earned).fill('common'));
    state.nextPackAt=normal+earned>=NORMAL_PACK_CAP?null:state.nextPackAt+earned*PACK_INTERVAL_MS;
  }
  return state;
}
// A rolled card the player already owns has a 1 in 10 chance to swap for one they don't own of the
// same rarity (and pack kind). Rarity odds are untouched; with every card of that rarity owned it stays a duplicate.
export const NEW_CARD_REROLL=0.1;
function preferNew(item,items,inventory,random) {
  if(!((inventory[item.key]??0)>0))return item;
  const left=items.filter(i=>!((inventory[i.key]??0)>0));
  if(!left.length||random()>=NEW_CARD_REROLL)return item;
  return left[Math.min(left.length-1,Math.floor(random()*left.length))];
}
// A themed pack (lib/pack-types.js): three items of its kind, rolled with the same odds as a normal
// pack of that rarity or better (the floor's rarities, weighted by PACK_ODDS). A roll that lands on
// a rarity the kind has no items in moves up to the next rarity it has (signatures have no commons),
// so legendary stays as rare as in a normal pack. No bonus screens (border packs may hold a legendary
// background, below), and no effect on the
// normal-pack timer.
function rollThemedPack(state, packIndex, random) {
  const {tier,kind}=parsePack(state.packs[packIndex]), types=PACK_KIND_TYPES[kind], next=structuredClone(state), rewards=[];
  const groups=TIERS.slice(TIERS.indexOf(tier)).map(rarity=>({rarity,weight:PACK_ODDS[rarity],items:CATALOG.filter(i=>i.drops!==false&&types.includes(i.type)&&i.rarity===rarity)}));
  if(!groups.some(g=>g.items.length)) throw new Error('That pack has nothing to give.');
  const ARCANA_ODDS=arcanaOdds(tier);
  for(let n=0;n<3;n++) {
    const u=random();
    if(u>=1-ARCANA_ODDS){rewards.push(dropArcana(next,random));continue;}
    let r=u/(1-ARCANA_ODDS)*groups.reduce((s,g)=>s+g.weight,0), at=groups.length-1;
    for(let i=0;i<groups.length;i++) {r-=groups[i].weight;if(r<0){at=i;break;}}
    const group=groups.slice(at).find(g=>g.items.length)??groups.findLast(g=>g.items.length);
    const item=preferNew(group.items[Math.min(group.items.length-1,Math.floor(random()*group.items.length))],group.items,next.inventory,random);
    rewards.push({key:item.key,duplicate:(next.inventory[item.key]??0)>0});
    next.inventory[item.key]=(next.inventory[item.key]??0)+1;
  }
  // Border packs also have the legendary odds of a legendary background (lib/legendary-screens.js)
  // the player doesn't have yet, on top of the three borders.
  const screens=[];
  if(kind==='border'&&random()<PACK_ODDS.legendary/100) {
    const left=LEGENDARY_SCREENS.filter(s=>!(next.screens??[]).includes(s.id));
    if(left.length)screens.push(left[Math.min(left.length-1,Math.floor(random()*left.length))].id);
  }
  if(screens.length)next.screens=[...(next.screens??[]),...screens];
  next.packs.splice(packIndex,1);
  return {state:next,rewards:arcanaLast(rewards),screens};
}
export function rollPack(state, packIndex, random = Math.random, now = new Date()) {
  if(!Number.isInteger(packIndex) || packIndex<0 || packIndex>=state.packs.length) throw new Error('Choose an available pack.');
  if(isThemedPack(state.packs[packIndex])) return rollThemedPack(state,packIndex,random);
  const next=grantLogin(state,now), min=TIERS.indexOf(next.packs[packIndex]), rewards=[];
  if(next.packs[packIndex]==='screens') {
    // A loading screen pack: five screens the player doesn't have, no cards.
    const screens=rollScreens(next.screens??[],random,SCREEN_PACK_SIZE);
    if(!screens.length)throw new Error('You already have every loading screen.');
    next.screens=[...(next.screens??[]),...screens];next.packs.splice(packIndex,1);
    return {state:next,rewards,screens};
  }
  const groups=TIERS.slice(min).map(rarity=>({rarity,weight:PACK_ODDS[rarity],items:CATALOG.filter(i=>i.drops!==false&&i.rarity===rarity)}));
  if(groups.some(g=>!g.items.length)) throw new Error('The collection is missing a rarity.');
  const ARCANA_ODDS=arcanaOdds(next.packs[packIndex]);
  for(let n=0;n<3;n++) {
    const u=random();
    if(u>=1-ARCANA_ODDS){rewards.push(dropArcana(next,random));continue;}
    let r=u/(1-ARCANA_ODDS)*groups.reduce((s,g)=>s+g.weight,0), group=groups.at(-1);
    for(const g of groups) {r-=g.weight;if(r<0){group=g;break;}}
    const item=preferNew(group.items[Math.min(group.items.length-1,Math.floor(random()*group.items.length))],group.items,next.inventory,random);
    rewards.push({key:item.key,duplicate:(next.inventory[item.key]??0)>0});
    next.inventory[item.key]=(next.inventory[item.key]??0)+1;
  }
  const screens=rollScreens(next.screens??[],random);
  if(screens.length)next.screens=[...(next.screens??[]),...screens];
  next.packs.splice(packIndex,1);
  if(next.nextPackAt==null && next.packs.filter(p=>p==='common').length<NORMAL_PACK_CAP)next.nextPackAt=now.getTime()+PACK_INTERVAL_MS;
  return {state:next,rewards:arcanaLast(rewards),screens};
}
// Bonus loading screens (screen-art-data.js): two per pack, always ones the player doesn't have,
// until they own them all. Usable as card art with any hero.
export const SCREENS_PER_PACK=2, SCREEN_PACK_SIZE=5;
function rollScreens(owned,random,count=SCREENS_PER_PACK) {
  const have=new Set(owned),left=SCREEN_ART.filter(s=>!have.has(s.id)),picked=[];
  while(picked.length<count&&left.length)picked.push(left.splice(Math.min(left.length-1,Math.floor((random()||0)*left.length)),1)[0].id);
  return picked;
}
export const RECYCLE_COST=10;
// Arcana cards (the Arcana Cup winners, lib/arcana-cup.js) aren't made yet. Ten legendaries draw a
// random one from this pool into state.arcana; while it's empty the card is owed (state.arcanaOwed)
// and handed out once the pool is filled.
export const ARCANA_CARDS=[];
// Any card in any pack can instead be an arcana: the top of its roll, above legendary (arcanaOdds in
// lib/cosmetics-catalog.js: 0.5% a card in a common pack up to 15% in a legendary one). An arcana from a
// pack or a recycle is an arcana tool (Double finish or a Twin Card, lib/cosmetics-arcana-catalog.js),
// each equally likely; arcana player cards (ARCANA_CARDS) will come from player packs. Returns its key.
const ARCANA_DROPS=()=>CATALOG.filter(i=>i.type==='tool');
function giveArcana(next,random) {
  const tools=ARCANA_DROPS(),key=tools[Math.min(tools.length-1,Math.floor(random()*tools.length))].key;
  next.inventory={...next.inventory,[key]:(next.inventory?.[key]??0)+1};
  return key;
}
// An arcana tool on its own (a recycle of ten legendaries).
export function grantArcana(state, random=Math.random) {
  const next=structuredClone(state);
  return {state:next,arcana:giveArcana(next,random)};
}
// Arcana cards are always dealt last in the pack.
const arcanaLast=rewards=>[...rewards.filter(r=>!r.arcana),...rewards.filter(r=>r.arcana)];
const dropArcana=(next,random)=>{const had=next.inventory??{},key=giveArcana(next,random);return {key,arcana:true,duplicate:(had[key]??0)>0};};
export function recycleCards(state, selections, random=Math.random) {
  if(!selections || typeof selections!=='object' || Array.isArray(selections)) throw new Error(`Choose ${RECYCLE_COST} duplicates.`);
  const entries=Object.entries(selections).filter(([,n])=>n!==0);
  if(entries.some(([,n])=>!Number.isSafeInteger(n)||n<1) || entries.reduce((s,[,n])=>s+n,0)!==RECYCLE_COST) throw new Error(`Choose exactly ${RECYCLE_COST} duplicates.`);
  const rarity=itemByKey(entries[0]?.[0])?.rarity, tier=TIERS.indexOf(rarity);
  if(tier<0) throw new Error(`Use ${RECYCLE_COST} duplicates of the same rarity.`);
  const next=structuredClone(state);
  for(const [key,n] of entries) {
    if(itemByKey(key)?.rarity!==rarity) throw new Error(`Use ${RECYCLE_COST} duplicates of the same rarity.`);
    if(n>Math.max(0,(next.inventory[key]??0)-1)) throw new Error('Your last copy is protected.');
    // Copies bought with tokens (lib/shop.js) can't be turned into a random pack.
    if(n>Math.max(0,(next.inventory[key]??0)-1-(next.bought?.[key]??0))) throw new Error('Copies bought in the shop cannot be recycled.');
    next.inventory[key]-=n;
  }
  if(rarity==='legendary') {
    return {state:next,arcana:giveArcana(next,random)};
  }
  next.packs.push(TIERS[tier+1]);
  return {state:next,minimum:TIERS[tier+1]};
}
// The Arcana upgrade lets a card wear more finishes on top of its main one: one layer per arcana card
// owned, up to MAX_FINISH_LAYERS in all. The first arcana card brings it sealed (state.arcanaSealed);
// opening it sets state.arcanaUpgrade. Accounts that earned arcana before the sealed box existed (arcana, none
// sealed) already have it.
export const MAX_FINISH_LAYERS=5;
export const MAX_FINISH_STACK=MAX_FINISH_LAYERS-1;
export const arcanaCount=state=>(state?.arcana?.length??0)+(state?.arcanaOwed??0);
// Double finish copies (tool:double-finish, bought in the shop) unlock it at once, one layer each. Arcana
// cards earned before it was sold keep counting, so nobody loses a layer.
export const doubleFinishCopies=state=>state?.inventory?.['tool:double-finish']??0;
export const finishArcanas=state=>doubleFinishCopies(state)+arcanaCount(state);
export const hasArcanaUpgrade=state=>!!state?.arcanaUpgrade||doubleFinishCopies(state)>0||(!state?.arcanaSealed&&arcanaCount(state)>0);
// How many finishes this account can stack over the main one.
export const finishStackLimit=state=>hasArcanaUpgrade(state)?Math.min(MAX_FINISH_STACK,Math.max(1,finishArcanas(state))):0;
export function openArcanaUpgrade(state) {
  if(!state?.arcanaSealed)throw new Error('There is no sealed Arcana upgrade to open.');
  const next=structuredClone(state);delete next.arcanaSealed;next.arcanaUpgrade=true;
  return {state:next};
}
export const MAX_EMBLEMS=12;
function validEmblems(emblems){
  if(!Array.isArray(emblems)||emblems.length<1||emblems.length>MAX_EMBLEMS)throw new Error(`Place 1 to ${MAX_EMBLEMS} border symbols.`);
  return emblems.map(m=>{
    const {x,y,size=100,rotation=0}=m&&typeof m==='object'?m:{};
    if(![x,y].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100)||typeof size!=='number'||!Number.isFinite(size)||size<50||size>300)throw new Error('Invalid border symbol position or size.');
    if(typeof rotation!=='number'||!Number.isFinite(rotation)||rotation< -180||rotation>180)throw new Error('Choose a border symbol rotation from -180 to 180 degrees.');
    return {x:Math.round(x*10)/10,y:Math.round(y*10)/10,size:Math.round(size),...(rotation?{rotation:Math.round(rotation)}:{})};
  });
}
export function equipCosmetics(state, raw) {
  if(!raw || typeof raw!=='object') throw new Error('Choose your card cosmetics.');
  const equipment={...DEFAULT_EQUIPMENT};
  for(const type of ['border','finish','autograph','translation']) {
    const id=raw[type]??equipment[type];
    if(typeof id!=='string') throw new Error('Invalid cosmetic.');
    if(id!==DEFAULT_EQUIPMENT[type] && !(state.inventory[`${type}:${id}`]>0)) throw new Error('Collect this cosmetic before equipping it.');
    if(id!==DEFAULT_EQUIPMENT[type] && !itemByKey(`${type}:${id}`)) throw new Error('Unknown cosmetic.');
    equipment[type]=id;
  }
  // Arcana upgrade: finishes stacked over the main one, each in its own layer. A stacked copy of
  // the main finish is dropped, so swapping the main finish never breaks a saved stack.
  // A saved stack carried over from an earlier edit keeps its bottom layers if the limit is lower.
  const limit=finishStackLimit(state),kept=raw.finishStack===undefined;
  let stack=kept?state.equipment?.finishStack:raw.finishStack;
  if(stack!=null) {
    if(!Array.isArray(stack)||stack.length>MAX_FINISH_STACK)throw new Error(`Stack up to ${MAX_FINISH_STACK} finishes.`);
    let ids=stack.filter(id=>id!==equipment.finish);
    if(kept)ids=ids.slice(0,limit);
    if(ids.length&&!hasArcanaUpgrade(state))throw new Error('Stacking finishes needs the Arcana upgrade.');
    if(ids.length>limit)throw new Error(`You can stack ${limit} finish${limit===1?'':'es'}. Each Double finish you own adds one more, up to ${MAX_FINISH_STACK}.`);
    if(new Set(ids).size!==ids.length)throw new Error('Stack each finish once.');
    for(const id of ids) {
      if(typeof id!=='string'||id===DEFAULT_EQUIPMENT.finish||!itemByKey(`finish:${id}`))throw new Error('Unknown cosmetic.');
      if(!(state.inventory[`finish:${id}`]>0))throw new Error('Collect this cosmetic before equipping it.');
    }
    if(ids.length)equipment.finishStack=ids;
  }
  // Signatures use the card's name: the player's, or the owner's own (layout.name, checked there).
  equipment.text='';
  const finishSettings=validFinishSettings(raw.finishSettings!==undefined?raw.finishSettings:state.equipment?.finishSettings);
  if(finishSettings)equipment.finishSettings=finishSettings;
  const borderSettings=validBorderSettings(raw.borderSettings!==undefined?raw.borderSettings:state.equipment?.borderSettings);
  if(borderSettings)equipment.borderSettings=borderSettings;
  const layout=validLayout(raw.layout!==undefined?raw.layout:state.equipment?.layout??null);
  if(layout)equipment.layout=layout;
  equipment.hue=raw.hue??state.equipment?.hue??0;
  if(!Number.isFinite(equipment.hue)||equipment.hue<0||equipment.hue>360)throw new Error('Choose a valid hue.');
  // Per-card tuning, 50% to 200% of each effect's own pace: finish speed, canvas particle amount, border speed.
  for(const [k,label] of [['particleSpeed','a particle speed'],['particleAmount','a particle amount'],['borderSpeed','a border speed']]) {
    equipment[k]=raw[k]??state.equipment?.[k]??DEFAULT_EQUIPMENT[k];
    if(!Number.isInteger(equipment[k])||equipment[k]<50||equipment[k]>200)throw new Error(`Choose ${label} from 50% to 200%.`);
  }
  // Lower or upper case for modifiers with capitals (lib/signatures.js); only upper is stored.
  const letterCase=raw.letterCase??state.equipment?.letterCase??'lower';
  if(!LETTER_CASES.includes(letterCase))throw new Error('Choose lower or upper case.');
  if(letterCase==='upper')equipment.letterCase='upper';
  // The signature's lettering on its own, 50% to 200% of the signature size (its flourish keeps that size); only non-100 is stored.
  const textSize=raw.textSize??state.equipment?.textSize??100;
  if(!Number.isInteger(textSize)||textSize<50||textSize>200)throw new Error('Choose a signature text size from 50% to 200%.');
  if(textSize!==100)equipment.textSize=textSize;
  // The License Plate signature's top band: up to 20 plain capitals, digits and a little punctuation; only set text is stored.
  const plateText=String(raw.plateText??state.equipment?.plateText??'').trim().toUpperCase();
  if([...plateText].length>20||!/^[A-Z0-9 .·'&!-]*$/.test(plateText))throw new Error('Plate text is up to 20 letters, digits, spaces and . · \' & ! -');
  if(plateText)equipment.plateText=plateText;
  // A living border (lib/cosmetics-arcana-catalog.js) over the equipped one; absent means none.
  const living=raw.living!==undefined?raw.living:state.equipment?.living;
  if(living!=null&&living!=='none') {
    if(typeof living!=='string'||!itemByKey(`living:${living}`))throw new Error('Unknown cosmetic.');
    if(!(state.inventory[`living:${living}`]>0))throw new Error('Collect this cosmetic before equipping it.');
    equipment.living=living;
  }
  // The border's corner symbol shows unless the owner turns it off; only false is stored.
  const emblem=raw.emblem??state.equipment?.emblem??true;
  if(typeof emblem!=='boolean')throw new Error('Choose whether to show the border symbol.');
  if(!emblem)equipment.emblem=false;
  // Border symbols the owner placed: 1 to MAX_EMBLEMS, each at x/y % of the card with a size %. Absent (or null)
  // means the one default symbol at the top.
  const emblems=raw.emblems!==undefined?raw.emblems:state.equipment?.emblems??null;
  if(emblems!=null)equipment.emblems=validEmblems(emblems);
  const borderEmblems=raw.borderEmblems!==undefined?raw.borderEmblems:state.equipment?.borderEmblems;
  if(borderEmblems!=null){
    if(typeof borderEmblems!=='object'||Array.isArray(borderEmblems)||Object.keys(borderEmblems).some(id=>!hasExpansionEmblems(id)))throw new Error('Choose valid border symbol placements.');
    const entries=Object.entries(borderEmblems).map(([id,list])=>[id,validEmblems(list)]);
    if(entries.length)equipment.borderEmblems=Object.fromEntries(entries);
  }
  const base=raw.baseCard??state.equipment?.baseCard;
  if(base!=null) {
    if(typeof base!=='object'||Array.isArray(base))throw new Error('Choose a valid base card.');
    const {hero=null,pos=null,art=null,style=null,crop=null}=base;
    if(hero!=null&&!heroById(hero))throw new Error('Choose a valid hero.');
    if(art!=null&&hero==null)throw new Error('Choose a hero for this artwork.');
    if(pos!=null&&![1,2,3,4,5].includes(pos))throw new Error('Choose a valid role.');
    if(style!=null&&!CARD_STYLES.some(([id])=>id===style))throw new Error('Choose a valid filter.');
    if(art!=null&&String(art).startsWith('scr:')) {
      if(!(state.screens??[]).includes(art))throw new Error('Collect this loading screen before using it.');
      const owner=screenHero.get(art);if(owner&&owner!==heroById(hero)?.name)throw new Error(`This loading screen is for ${owner}.`);
    }
    else if(art!=null&&!['vert','crop','render',...(CARD_ART[heroById(hero)?.name]??[]).filter(i=>!/mini[\s_-]*heroes/i.test(i.label)).map(i=>i.id)].includes(art))throw new Error('Choose artwork for your selected hero.');
    if(crop!=null&&!validCardCrop(crop))throw new Error('Choose a valid crop.');
    equipment.baseCard={hero,pos,art,style,crop};
  }
  for(const [k,min,max] of [['x',0,100],['y',0,100],['size',5,30],['rotation',-180,180]]) {
    const n=raw[k]??equipment[k];
    if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max) throw new Error('Invalid signature position or size.');
    equipment[k]=n;
  }
  return {...state,equipment};
}
// One-time grants, applied on the player's next visit (the Worker's session action) and to new
// players. Each shows in the "Fav sent you" notice (parts/pack-gifts.js).
// A grant with an account goes to that account only (the Claude account's starter packs, lib/claude-account.js).
export const PACK_GRANTS=[{id:'screens-2026-10',packs:['screens','screens','screens'],note:"Loading screens are here. Each pack has five you don't have yet."},
  {id:'claude-start-2026-11',account:'4000000001',packs:Array(10).fill('common'),note:'Ten common packs to start your collection.'}];
export function applyPackGrants(state,now=Date.now(),account=null) {
  const due=PACK_GRANTS.filter(g=>!(state.grants??[]).includes(g.id)&&(!g.account||g.account===String(account??'')));
  if(!due.length)return state;
  return {...state,packs:[...state.packs,...due.flatMap(g=>g.packs)],grants:[...(state.grants??[]),...due.map(g=>g.id)],
    gifts:[...(state.gifts??[]),...due.map(g=>({kind:'pack',tier:g.packs[0],count:g.packs.length,note:g.note,at:now}))].slice(-20)};
}
