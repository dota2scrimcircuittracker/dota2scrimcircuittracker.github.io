// Loopback-only shop test (?testShop=1 on the Gallery): a fake account with 30 tokens, kept in this
// browser. Buys run through lib/shop.js locally; nothing reaches the collection API or a real account.
// ?testShop=reset starts over at 30 tokens; ?testShop=fav is the same wallet signed in as Fav, with
// the orders placed here and two made-up unmatched payments in the orders panel. A bundle button
// credits its tokens straight away instead of opening Stripe. Profiles get the same account for the gift panels
// (parts/pack-gifts.js); a gift or sent pack leaves the test account and reaches no one. A bundle bought here
// can be refund-requested like a real one; it's only marked, and no ticket is filed.
// ?testShop=me starts from Fav's real public collection (designs, items, screens) with 100 tokens;
// ?testShop=unlock is that plus every item (Double finish x4 for all five layers), every screen, all
// extra slots, 999 tokens and packs of every kind. Each keeps its own copy here; add -reset to start
// over (?testShop=unlock-reset). Nothing is written to the real account.
import {grantLogin,rollPack,recycleCards,openArcanaUpgrade,saveCardDesign,setCardPreferences,setCardName,setCardOrder,setNickname} from './cosmetics-engine.js';
import {buyItem,buySlot,orderCommission,giftItem,refundCommission,creditTokens,bundleFor,refundable,REFUND_WINDOW_MS} from './shop.js';
import {sendPack,isAdmin,ADMIN_ACCOUNT} from './pack-gifts.js';
import {CATALOG,TIERS} from './cosmetics-catalog.js';
import {ALL_SCREENS} from './legendary-screens.js';
import {PACK_KIND_TYPES} from './pack-types.js';
import {publicCollection} from './cosmetics.js';
import {createPlayerCards,PAINT_FILTER} from '../parts/player-card.js';
const key='ad2l-local-shop-test-v1', ordersKey='ad2l-local-shop-test-orders-v1', START=30, ACCOUNT=1;
export function localShopAdapter(){
 const flag=new URLSearchParams(location.search).get('testShop');
 if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname)||!['1','reset','fav','me','me-reset','unlock','unlock-reset'].includes(flag))return null;
 const real=/^(me|unlock)/.test(flag)?flag.split('-')[0]:null;
 const me=flag==='fav'||real?ADMIN_ACCOUNT:ACCOUNT;
 const stateKey=real?`${key}-${real}`:key;
 // Starts like a new player, plus the test tokens.
 const fresh=()=>({...grantLogin(null),tokens:START});
 let state;try{state=flag==='reset'||flag.endsWith('-reset')?null:JSON.parse(localStorage.getItem(stateKey));}catch{state=null;}
 const save=()=>{try{localStorage.setItem(stateKey,JSON.stringify(state));}catch{}};
 if(!state&&real){
  // Fav's real collection, read from the public API once, then kept here. The page reloads when it's in.
  state=fresh();
  publicCollection(ADMIN_ACCOUNT).then(c=>{state=seedFromReal(c,real==='unlock');save();const u=new URL(location.href);u.searchParams.set('testShop',real);if(u.href===location.href)location.reload();else location.replace(u);}).catch(e=>alert('Could not load your collection: '+e.message));
 }
 else {state??=fresh();save();}

 // Orders and unmatched payments, shaped like the Worker's order: and stripe: rows.
 const freshShop=()=>({orders:[],payments:{'local-pay-1':{at:Date.now(),amount:'5.00',currency:'USD',tokens:10,account:null,status:'unmatched'},'local-pay-2':{at:Date.now(),amount:'20.00',currency:'USD',tokens:55,account:'999999',status:'unmatched'}}});
 let shop;try{shop=flag==='reset'?freshShop():JSON.parse(localStorage.getItem(ordersKey))??freshShop();}catch{shop=freshShop();}
 const saveShop=()=>{try{localStorage.setItem(ordersKey,JSON.stringify(shop));}catch{}};saveShop();
 const fav=(what)=>{if(!isAdmin(me))throw Error(`Only Fav can ${what}.`);};
 if(flag==='reset'){const u=new URL(location.href);u.searchParams.set('testShop','1');history.replaceState(history.state,'',u);}
 localShopName=real?'Fav':'Shop Tester';
 return {account:me,get state(){return state;},action:async(action,details={})=>{
  let result;
  if(action==='buy')result=buyItem(state,String(details.item??''));
  else if(action==='buy-slot')result=buySlot(state);
  else if(action==='stripe-checkout'){const b=bundleFor(details.dollars);if(!b)throw Error('Choose a bundle.');const id=`cs_local_${Date.now()}`;shop.payments[id]={at:Date.now(),amount:b.dollars.toFixed(2),currency:'USD',tokens:b.tokens,account:String(me),status:'credited'};saveShop();result={state:creditTokens(state,b.tokens,`stripe:${id}`)};}
  else if(action==='shop-purchases')result={state,purchases:Object.entries(shop.payments).filter(([,p])=>p.account===String(me)&&Date.now()-p.at<REFUND_WINDOW_MS).map(([id,p])=>({id,amount:p.amount,tokens:p.tokens,at:p.at,status:p.status,refundRequested:p.refundRequested??null}))};
  else if(action==='refund-request'){const id=String(details.payment??''),row=shop.payments[id];if(!refundable(row,me))throw Error(row?.refundRequested?'You already asked for a refund on that one.':'Refunds are only for the first 24 hours after buying.');row.refundRequested=Date.now();saveShop();result={state,refund:{id,amount:row.amount,tokens:row.tokens,at:row.at,unspent:Math.min(row.tokens,state.tokens??0),local:true}};}
  // Marked local so parts/shop.js files no ticket for it.
  else if(action==='commission'){const r=orderCommission(state,details),id=`${r.order.at}:${me}`;shop.orders.push({...r.order,id,account:String(me)});saveShop();result={...r,order:{...r.order,id,local:true}};}
  // Fav's panel. Every local order was paid from this one wallet, so a refund comes back to it.
  else if(action==='shop-orders'){fav('see orders');result={state,orders:shop.orders,nicknames:{[ACCOUNT]:'Shop Tester',[ADMIN_ACCOUNT]:'Shop Tester (Fav)'}};}
  else if(action==='shop-payments'){fav('see payments');result={state,payments:Object.fromEntries(Object.entries(shop.payments).filter(([,p])=>p.status==='unmatched'||(p.refundRequested&&p.status==='credited')))};}
  else if(action==='shop-order-close'){
   fav('close orders');const order=shop.orders.find(o=>o.id===String(details.order??''));
   if(order?.status!=='open')throw Error('That order is not open.');
   if(!['done','refunded'].includes(details.status))throw Error('Choose done or refunded.');
   Object.assign(order,{status:details.status,closedAt:Date.now()});saveShop();
   result={state:details.status==='refunded'?refundCommission(state,order):state};
  }
  // A payment given to this wallet's account credits it; any other ID is only marked, no one is credited.
  else if(action==='shop-assign'){
   fav('assign payments');const id=String(details.payment??''),row=shop.payments[id],target=String(details.target??'');
   if(row?.status!=='unmatched')throw Error('That payment is not waiting.');
   if(!/^\d{1,10}$/.test(target))throw Error('That player has no collection yet.');
   Object.assign(row,{status:'credited',account:target,assignedAt:Date.now()});saveShop();
   result={state:[String(ACCOUNT),String(ADMIN_ACCOUNT)].includes(target)?creditTokens(state,row.tokens,`stripe:${id}`):state};
  }
  // The recipient side is dropped: only the test account's tokens or pack go.
  else if(action==='gift-item'){const r=giftItem(state,{},{key:String(details.item??''),from:ACCOUNT,note:details.note});result={state:r.sender,sent:{target:details.target,item:details.item,price:r.price}};}
  else if(action==='send-pack')result={state:sendPack(grantLogin(state),{},{index:details.packIndex,from:ACCOUNT,note:details.note}).sender};
  else if(action==='equip')result={state:saveCardDesign(state,details.equipment,details.cardSlot)};
  else if(action==='card-settings')result={state:setCardPreferences(state,details)};
  else if(action==='card-name')result={state:setCardName(state,details.cardSlot,details.name)};
  else if(action==='card-order')result={state:setCardOrder(state,details.order)};
  else if(action==='nickname')result={state:setNickname(state,details)};
  else if(action==='open')result=rollPack(state,details.packIndex);
  else if(action==='recycle')result=recycleCards(state,details.selections);
  else if(action==='open-arcana')result=openArcanaUpgrade(state);
  else if(action==='session')result={state:grantLogin(state)};
  else throw Error('Not available in the local shop test.');
  state=result.state;save();return result;
 }};
}
export function localShopTest(){
 const adapter=localShopAdapter();
 if(!adapter)return null;
 const matches=[{start_time:1,winner:'Radiant',players:[{account_id:ACCOUNT,team:'Radiant',hero:'Invoker',position:2,kills:12,deaths:3,assists:18,gpm:620,xpm:740,hero_damage:32000,last_hits:265}]}];
 const renderer=createPlayerCards(matches,{cards:new Map([[ACCOUNT,{hero:74,style:'cinema'}]]),tiers:new Map([[String(ACCOUNT),{tier:'A',rating:86}]])});
 return {name:localShopName,cardHtml:PAINT_FILTER+renderer.card({account:ACCOUNT,name:localShopName,team:'TEST'},2,{own:true,equipmentOverride:adapter.state.equipment}),adapter};
}

let localShopName='Shop Tester';
// The test state for ?testShop=me / unlock: Fav's public collection, and with unlock everything on top.
function seedFromReal(c,unlock){
 const s={...grantLogin(null),tokens:100,inventory:{...(c.inventory??{})},screens:[...(c.screens??[])],equipment:c.equipment??undefined,
  cardDesigns:c.cardDesigns??undefined,cardNames:c.cardNames??undefined,primaryCard:c.primaryCard??0,shuffleCards:!!c.shuffleCards,cardOrder:c.cardOrder??undefined,nickname:c.nickname??undefined};
 for(const k of Object.keys(s))if(s[k]===undefined)delete s[k];
 if(!unlock)return s;
 for(const i of CATALOG)s.inventory[i.key]=Math.max(s.inventory[i.key]??0,i.key==='tool:double-finish'?4:2);
 s.screens=[...new Set([...s.screens,...ALL_SCREENS.map(x=>x.id)])];
 s.tokens=999;s.extraSlots=3;
 s.packs=[...TIERS.flatMap(t=>[t,t,...Object.keys(PACK_KIND_TYPES).map(k=>`${t}:${k}`)]),'screens'];
 return s;
}
