// Explicit loopback-only review mode in the normal Gallery UI. No collection API writes.
import {CATALOG,DEFAULT_EQUIPMENT} from './cosmetics-catalog.js';
import {grantLogin,rollPack,recycleCards,saveCardDesign,setCardPreferences,setCardName,setCardOrder,setNickname} from './cosmetics-engine.js';
import {createPlayerCards,PAINT_FILTER} from '../parts/player-card.js';
const key='ad2l-local-expansion-site-v1';
export function localCosmeticsReview(){
 if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname)||new URLSearchParams(location.search).get('reviewCosmetics')!=='1')return null;
 const design=(border,finish,autograph,hero=74)=>({...DEFAULT_EQUIPMENT,border,finish,autograph,rotation:0,baseCard:{hero,art:null,style:'cinema'}});
 const fresh=()=>{
  const first=design('ancient-war','reality-rift','stacked');
  return {...grantLogin(null),inventory:Object.fromEntries(CATALOG.map(i=>[i.key,1])),equipment:first,cardDesigns:[first,design('ouroboros','supernova','continuous'),design('malachite','deep-sea','fold',6),design('naval','shattered-time','thread',8),null],cardNames:['Ancients','Ouroboros',"Leviathan's Wake",'Shattered Time',null],primaryCard:0};
 };
 let state;try{state=JSON.parse(localStorage.getItem(key))??fresh();}catch{state=fresh();}
 // Include newly added designs when an existing local review is reopened.
 state.inventory={...Object.fromEntries(CATALOG.map(i=>[i.key,1])),...state.inventory};
 const matches=[{start_time:1,winner:'Radiant',players:[{account_id:101,team:'Radiant',hero:'Invoker',position:2,kills:12,deaths:3,assists:18,gpm:620,xpm:740,hero_damage:32000,last_hits:265}]}];
 const renderer=createPlayerCards(matches,{cards:new Map([[101,{hero:74,style:'cinema'}]]),tiers:new Map([['101',{tier:'A',rating:86}]])});
 return {name:'Fav',cardHtml:PAINT_FILTER+renderer.card({account:101,name:'Fav',team:'AD2L SCRIM LEAGUE'},2,{own:true,equipmentOverride:state.equipment}),adapter:{account:101,expansionReview:true,state,action:async(action,details={})=>{
  let result;
  if(action==='equip')result={state:saveCardDesign(state,details.equipment,details.cardSlot)};
  else if(action==='card-settings')result={state:setCardPreferences(state,details)};
  else if(action==='card-name')result={state:setCardName(state,details.cardSlot,details.name)};
  else if(action==='card-order')result={state:setCardOrder(state,details.order)};
  else if(action==='nickname')result={state:setNickname(state,details)};
  else if(action==='open')result=rollPack(state,details.packIndex);
  else if(action==='recycle')result=recycleCards(state,details.selections);
  else if(action==='session')result={state:grantLogin(state)};
  else throw Error('This action is unavailable in local cosmetics review.');
  state=result.state;localStorage.setItem(key,JSON.stringify(state));return result;
 }}};
}
