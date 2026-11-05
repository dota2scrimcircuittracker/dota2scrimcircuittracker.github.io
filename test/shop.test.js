import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {BUNDLES,bundleBonus,bundleFor,tokensForPayment,creditTokens,reverseTokens,buyItem,recyclable,priceOf,shopVisible,SHOP_ITEMS,PRICES,giftItem,buySlot,SLOT_PRICE,MAX_EXTRA_SLOTS,orderCommission} from '../public/lib/shop.js';
import {localDevHost} from '../public/lib/shop-flag.js';
import {cardDesignState,saveCardDesign,setCardOrder,cardAppearance,CARD_SLOTS} from '../public/lib/cosmetics-engine.js';
import {DEFAULT_EQUIPMENT} from '../public/lib/cosmetics-catalog.js';
import {recycleCards,RECYCLE_COST} from '../public/lib/cosmetics-engine.js';
import {CATALOG} from '../public/lib/cosmetics-catalog.js';
import {ADMIN_ACCOUNT} from '../public/lib/pack-gifts.js';
import {CosmeticsVault,cosmeticsRequest,stripeCheckout} from '../workers/steam-auth/src/cosmetics.js';

const byRarity=r=>CATALOG.find(i=>i.rarity===r);
const common=byRarity('common'),legendary=byRarity('legendary');

test('bundles: $5, $10, $20 and $30 in US cents buy 10, 25, 55 and 85 tokens; any other payment buys none',()=>{
  assert.deepEqual([500,1000,2000,3000].map(c=>tokensForPayment(c,'usd')),[10,25,55,85]);
  for(const [c,cur] of [[300,'usd'],[501,'usd'],[500,'eur'],[1500,'usd'],[5,'usd'],[5.5,'usd'],['500','usd']])assert.equal(tokensForPayment(c,cur),0);
  assert.equal(bundleFor('20').tokens,55);
  assert.equal(bundleFor(15),null);
  // Every step up is a better rate, so one big bundle always beats several small ones.
  assert.deepEqual(BUNDLES.map(bundleBonus),[0,25,38,42]);
});
test('prices by rarity, every card item for sale, loading screens never',()=>{
  assert.deepEqual(PRICES,{common:1,rare:3,epic:5,legendary:10,arcana:30});
  assert.equal(priceOf(common.key),1);
  assert.equal(priceOf(legendary.key),10);
  assert.equal(SHOP_ITEMS.length,CATALOG.filter(i=>!i.commission).length);
  assert.ok(CATALOG.filter(i=>i.commission).every(i=>priceOf(i.key)!=null&&!SHOP_ITEMS.includes(i)));
  assert.equal(priceOf('screen:1'),null);
  assert.throws(()=>buyItem({tokens:99,inventory:{}},'screen:1'),/not for sale/);
});
test('the shop shows everywhere; the ?testShop account only on local dev hosts',()=>{
  for(const h of ['localhost','dota2scrimcircuittracker.github.io',''])assert.ok(shopVisible(h),h);
  for(const h of ['localhost','127.0.0.1','[::1]','site.test','a.localhost'])assert.ok(localDevHost(h),h);
  for(const h of ['dota2scrimcircuittracker.github.io','ad2lstats.com','localhost.evil.com',''])assert.ok(!localDevHost(h),h);
});
test('credit once per payment; buy takes tokens and the copy cannot be recycled',()=>{
  let s={tokens:0,inventory:{}};
  s=creditTokens(s,10,'tx1');s=creditTokens(s,10,'tx1');
  assert.equal(s.tokens,10);
  assert.throws(()=>buyItem({...s,tokens:0},common.key),/need 1 token/);
  let {state}=buyItem(s,legendary.key);
  assert.equal(state.tokens,0);
  assert.equal(state.inventory[legendary.key],1);
  assert.equal(s.tokens,10); // the input is untouched
  // Eleven copies of a common, two bought: eight spare, so a recycle of RECYCLE_COST (10) fails.
  state={...state,tokens:2,inventory:{[common.key]:9},packs:[]};
  state=buyItem(state,common.key).state;state=buyItem(state,common.key).state;
  assert.equal(recyclable(state,common.key),8);
  assert.throws(()=>recycleCards(state,{[common.key]:RECYCLE_COST}),/bought in the shop/);
  assert.equal(recycleCards({...state,bought:{}},{[common.key]:RECYCLE_COST}).minimum,'rare');
});

const vaultWith=env=>{
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage},env);let n=0;
  const as=async(account,body)=>{const r=await vault.fetch(new Request(`https://vault/action?account=${account}`,{method:'POST',body:JSON.stringify({requestId:`shop-request-${String(++n).padStart(6,'0')}`,...body})}));return {status:r.status,...await r.json()};};
  // A paid checkout as the Stripe webhook hands it to the vault.
  const pay=async({id,account,dollars,cents=dollars*100,currency='usd'})=>{const r=await vault.fetch(new Request('https://vault/stripe',{method:'POST',body:JSON.stringify({id,account,cents,currency})}));return {status:r.status,...await r.json()};};
  const reverse=async(body)=>(await vault.fetch(new Request('https://vault/stripe-reverse',{method:'POST',body:JSON.stringify(body)}))).json();
  return {as,pay,reverse,rows,vault};
};
test('vault: every shop action is refused while SHOP_ENABLED is off; a paid checkout still credits',async()=>{
  const {as,pay}=vaultWith({});
  await as(301,{action:'session'});
  for(const action of ['buy','shop-payments','shop-assign','shop-purchases','refund-request'])assert.match((await as(301,{action,item:common.key})).error,/not open yet/);
  // Money already taken is never lost to the switch.
  assert.equal((await pay({id:'cs_test_000001',account:'301',dollars:5})).status,'credited');
});
test('vault: a paid checkout credits its account once; buy spends it',async()=>{
  const {as,pay}=vaultWith({SHOP_ENABLED:'on'});
  await as(301,{action:'session'});
  assert.equal((await pay({id:'cs_test_000001',account:'301',dollars:10})).status,'credited');
  assert.equal((await pay({id:'cs_test_000001',account:'301',dollars:10})).duplicate,true);
  assert.equal((await pay({id:'cs_test_000002',account:'301',cents:300})).status,'ignored');
  const bought=await as(301,{action:'buy',item:legendary.key});
  assert.equal(bought.state.tokens,15); // 25 from the $10 bundle, less 10
  assert.equal(bought.state.inventory[legendary.key],1);
  assert.deepEqual(bought.state.tokenPayments,['stripe:cs_test_000001']);
});
test('vault: a checkout whose account has no collection waits for Fav, who assigns it',async()=>{
  const {as,pay}=vaultWith({SHOP_ENABLED:'on'});
  for(const a of [301,113])await as(a,{action:'session'});
  assert.equal((await pay({id:'cs_test_000003',account:'424242',dollars:5})).status,'unmatched');
  assert.match((await as(301,{action:'shop-payments'})).error,/Only Fav/);
  assert.match((await as(301,{action:'shop-assign',payment:'cs_test_000003',target:'301'})).error,/Only Fav/);
  const admin=ADMIN_ACCOUNT;
  await as(admin,{action:'session'});
  assert.deepEqual(Object.keys((await as(admin,{action:'shop-payments'})).payments),['cs_test_000003']);
  assert.equal((await as(admin,{action:'shop-assign',payment:'cs_test_000003',target:'301'})).status,200);
  assert.match((await as(admin,{action:'shop-assign',payment:'cs_test_000003',target:'301'})).error,/not waiting/);
  assert.equal((await as(301,{action:'buy',item:common.key})).state.tokens,9);
});
test('Stripe webhook: 404 without the secret, 403 on a bad or stale signature, credits a paid checkout once',async()=>{
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage},{}),COSMETICS={idFromName:()=>'id',get:()=>vault};
  await vault.fetch(new Request('https://vault/action?account=301',{method:'POST',body:JSON.stringify({action:'session',requestId:'stripe-test-000001'})}));
  const event=(type,object)=>JSON.stringify({id:'evt_1',type,data:{object:{id:'cs_test_a1b2c3d4',object:'checkout.session',payment_status:'paid',amount_total:2000,currency:'usd',client_reference_id:'301',...object}}});
  const sign=(body,secret='whsec_right',t=Math.floor(Date.now()/1000))=>`t=${t},v1=${createHmac('sha256',secret).update(`${t}.${body}`).digest('hex')}`;
  const send=(env,body,sig=sign(body))=>cosmeticsRequest(new Request('https://w/cosmetics/stripe',{method:'POST',headers:{'stripe-signature':sig},body}),{COSMETICS,...env},['https://site']);
  const paid=event('checkout.session.completed');
  assert.equal((await send({},paid)).status,404);
  assert.equal((await send({STRIPE_WEBHOOK_SECRET:'whsec_right'},paid,sign(paid,'whsec_wrong'))).status,403);
  assert.equal((await send({STRIPE_WEBHOOK_SECRET:'whsec_right'},paid,sign(paid,'whsec_right',Math.floor(Date.now()/1000)-600))).status,403);
  // A body changed after signing (a bigger amount) fails.
  assert.equal((await send({STRIPE_WEBHOOK_SECRET:'whsec_right'},paid.replace('2000','3000'),sign(paid))).status,403);
  // Unpaid or other events are acknowledged and dropped.
  assert.equal((await (await send({STRIPE_WEBHOOK_SECRET:'whsec_right'},event('checkout.session.completed',{payment_status:'unpaid'}))).json()).ignored,true);
  assert.equal((await (await send({STRIPE_WEBHOOK_SECRET:'whsec_right'},event('charge.refunded'))).json()).ignored,true);
  // A secret pasted with a trailing newline still matches.
  const ok=await send({STRIPE_WEBHOOK_SECRET:'whsec_right\r\n'},paid);
  assert.equal(ok.status,200);
  assert.deepEqual((({tokens,status})=>({tokens,status}))(await ok.json()),{tokens:55,status:'credited'});
  assert.equal((await (await send({STRIPE_WEBHOOK_SECRET:'whsec_right'},paid)).json()).duplicate,true);
  assert.equal(rows.get('user:301').tokens,55);
});
test('Stripe checkout: the Worker sets the price and the account; the browser picks only the bundle',async()=>{
  const real=globalThis.fetch;let sent;
  globalThis.fetch=async(url,init)=>{sent={url,auth:init.headers.Authorization,form:Object.fromEntries(new URLSearchParams(init.body))};return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/cs_test_x'}),{status:200});};
  try {
    const env={SHOP_ENABLED:'on',STRIPE_SECRET_KEY:'sk_test_x'};
    assert.match((await (await stripeCheckout({dollars:20},'301',{STRIPE_SECRET_KEY:'sk_test_x'},'https://site')).json()).error,/not open yet/);
    assert.equal((await stripeCheckout({dollars:20},'301',{SHOP_ENABLED:'on'},'https://site')).status,503);
    assert.equal((await stripeCheckout({dollars:15},'301',env,'https://site')).status,400);
    const ok=await stripeCheckout({dollars:20,path:'/',hash:'#/champion/gallery/shop',amount:1},'301',env,'https://site');
    assert.equal((await ok.json()).url,'https://checkout.stripe.com/c/pay/cs_test_x');
    assert.equal(sent.url,'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(sent.auth,'Bearer sk_test_x');
    assert.equal(sent.form['line_items[0][price_data][unit_amount]'],'2000');
    assert.equal(sent.form['line_items[0][price_data][currency]'],'usd');
    assert.equal(sent.form.client_reference_id,'301');
    assert.equal(sent.form.success_url,'https://site/?paid=1#/champion/gallery/shop');
    assert.equal(sent.form.cancel_url,'https://site/#/champion/gallery/shop');
    // A return address that isn't a plain path on this site falls back to the home page.
    await stripeCheckout({dollars:5,path:'//evil.com',hash:'javascript:x'},'301',env,'https://site');
    assert.equal(sent.form.success_url,'https://site/?paid=1');
  } finally {globalThis.fetch=real;}
});

test('gift: the buyer pays, the recipient gets a bought copy and a notice naming them',()=>{
  const {sender,recipient,price}=giftItem({tokens:5,inventory:{}},{inventory:{}},{key:common.key,from:301,fromName:'Ace',note:' gg  wp '},1000);
  assert.equal(price,1);assert.equal(sender.tokens,4);
  assert.equal(recipient.inventory[common.key],1);assert.equal(recyclable(recipient,common.key),0);
  assert.deepEqual(recipient.gifts.at(-1),{kind:'item',item:common.key,count:1,note:'gg wp',at:1000,from:'301',fromName:'Ace'});
  assert.throws(()=>giftItem({tokens:0,inventory:{}},{inventory:{}},{key:common.key,from:1}),/need 1 token/);
});
test('extra card slots: up to the cap, the new slot is usable and a custom order keeps its shape',()=>{
  let s={tokens:SLOT_PRICE*(MAX_EXTRA_SLOTS+1),inventory:{},equipment:{...DEFAULT_EQUIPMENT}};
  s=setCardOrder(s,[4,3,2,1,0]);
  s=buySlot(s).state;
  assert.equal(cardDesignState(s).cardDesigns.length,CARD_SLOTS+1);
  assert.deepEqual(cardDesignState(s).cardOrder,[4,3,2,1,0,5]);
  s=saveCardDesign(s,{...DEFAULT_EQUIPMENT,hue:40},CARD_SLOTS);
  assert.equal(cardDesignState(s).cardDesigns[CARD_SLOTS].hue,40);
  s=buySlot(buySlot(s).state).state;
  assert.throws(()=>buySlot(s),/all 3 extra/);
  assert.throws(()=>saveCardDesign({inventory:{},equipment:{...DEFAULT_EQUIPMENT}},DEFAULT_EQUIPMENT,CARD_SLOTS),/Choose one of your cards/);
});
test('commissions: 15 for one item you pick, 30 for a team set; tokens taken up front',()=>{
  const one=orderCommission({tokens:20},{kind:'single',pick:'border',note:'fire'},5);
  assert.equal(one.state.tokens,5);assert.deepEqual(one.order,{kind:'single',pick:'border',team:null,note:'fire',price:15,at:5,status:'open'});
  assert.throws(()=>orderCommission({tokens:20},{kind:'single',pick:'translation'}),/signature style, border or finish/);
  assert.throws(()=>orderCommission({tokens:40},{kind:'team',team:'  '}),/your team/);
  assert.equal(orderCommission({tokens:30},{kind:'team',team:'Pango Pals'}).order.team,'Pango Pals');
  assert.throws(()=>orderCommission({tokens:29},{kind:'team',team:'Pango Pals'}),/need 30 tokens/);
});
test('vault: gift, slot, commission and Fav closing an order with a refund',async()=>{
  const {as,pay}=vaultWith({SHOP_ENABLED:'on'});
  for(const a of [301,302,ADMIN_ACCOUNT])await as(a,{action:'session'});
  await pay({id:'cs_test_000010',account:'301',dollars:20});
  await pay({id:'cs_test_000011',account:'301',dollars:10});
  assert.equal((await as(301,{action:'gift-item',target:'301',item:common.key})).status,400);
  const g=await as(301,{action:'gift-item',target:'302',item:common.key,note:'gl'});
  assert.equal(g.state.tokens,79); // 55 + 25, less the 1-token gift
  assert.equal((await as(302,{action:'session'})).state.gifts.at(-1).from,'301');
  assert.equal((await as(301,{action:'buy-slot'})).state.extraSlots,1);
  const o=await as(301,{action:'commission',kind:'team',team:'Pango Pals'});
  assert.equal(o.state.tokens,79-SLOT_PRICE-30);
  assert.match((await as(301,{action:'shop-orders'})).error,/Only Fav/);
  const list=await as(ADMIN_ACCOUNT,{action:'shop-orders'});
  assert.equal(list.orders.length,1);assert.equal(list.orders[0].team,'Pango Pals');
  await as(ADMIN_ACCOUNT,{action:'shop-order-close',order:o.order.id,status:'refunded'});
  assert.match((await as(ADMIN_ACCOUNT,{action:'shop-order-close',order:o.order.id,status:'done'})).error,/not open/);
  assert.equal((await as(301,{action:'session'})).state.tokens,79-SLOT_PRICE);
});
test('a refused note says why: too long, or < and >',()=>{
  const s={tokens:99};
  assert.throws(()=>orderCommission(s,{kind:'single',pick:'border',note:'red <glow>'}),/can't use < or >/);
  assert.throws(()=>orderCommission(s,{kind:'single',pick:'border',note:'a'.repeat(301)}),/up to 300 characters/);
  assert.throws(()=>orderCommission(s,{kind:'team',team:'a'.repeat(61)}),/up to 60 characters/);
});
test('vault: a refund to a player whose collection is gone is refused and the order stays open',async()=>{
  const {as,pay,rows}=vaultWith({SHOP_ENABLED:'on'});
  for(const a of [303,ADMIN_ACCOUNT])await as(a,{action:'session'});
  await pay({id:'cs_test_000020',account:'303',dollars:10});
  const o=await as(303,{action:'commission',kind:'single',pick:'border'});
  rows.delete('user:303');
  assert.match((await as(ADMIN_ACCOUNT,{action:'shop-order-close',order:o.order.id,status:'refunded'})).error,/nowhere to refund/);
  assert.equal(rows.get(`order:${o.order.id}`).status,'open');
  assert.ok(!(await as(ADMIN_ACCOUNT,{action:'shop-order-close',order:o.order.id,status:'done'})).error);
});

test('arcana tools sell for ARCANA_PRICE like any item; arcana player cards are never for sale',async()=>{
  const {ARCANA_PRICE}=await import('../public/lib/shop.js');
  assert.equal(ARCANA_PRICE,30);
  const tools=SHOP_ITEMS.filter(i=>i.rarity==='arcana').map(i=>i.key);
  assert.deepEqual(tools,['tool:double-finish','tool:twin-flip','tool:twin-peel','tool:twin-shuffle','tool:twin-scan','tool:twin-glitch']);
  for(const key of tools)assert.equal(priceOf(key),30);
  assert.deepEqual(SHOP_ITEMS.filter(i=>i.type==='living').map(i=>priceOf(i.key)),[10,10,10,10,10]);
  const {state,price}=buyItem({tokens:30,inventory:{}},'tool:twin-scan');
  assert.deepEqual([state.tokens,state.inventory['tool:twin-scan'],price],[0,1,30]);
  assert.throws(()=>buyItem({tokens:29,inventory:{}},'tool:double-finish'),/30 tokens/);
  assert.equal(recyclable(state,'tool:twin-scan'),0);
  // Nothing in the shop hands out arcana player cards.
  assert.equal(buyItem({tokens:30,inventory:{}},'tool:double-finish').state.arcana,undefined);
});
test('vault: the old buy-arcana action is gone; a tool buys through buy',async()=>{
  const {as,pay}=vaultWith({SHOP_ENABLED:'on'});
  await as(301,{action:'session'});
  await pay({id:'cs_test_000040',account:'301',dollars:20});
  assert.ok((await as(301,{action:'buy-arcana',card:'anything'})).error);
  assert.equal((await as(301,{action:'buy',item:'tool:double-finish'})).state.tokens,25);
});
test('refund requests: your own bundle, within 24 hours, once; Fav sees it until it is refunded',async()=>{
  const {refundable,refundNote,REFUND_WINDOW_MS}=await import('../public/lib/shop.js');
  const {as,pay,reverse,rows,vault}=vaultWith({SHOP_ENABLED:'on'});
  let now=Date.now();vault.clock=()=>now;
  for(const a of [301,302,ADMIN_ACCOUNT])await as(a,{action:'session'});
  await pay({id:'cs_test_000050',account:'301',dollars:10});
  await pay({id:'cs_test_000051',account:'301',dollars:5});
  await as(301,{action:'buy',item:legendary.key}); // 35 less 10
  assert.deepEqual((await as(301,{action:'shop-purchases'})).purchases.map(p=>[p.id,p.tokens,p.refundRequested]),[['cs_test_000050',25,null],['cs_test_000051',10,null]]);
  assert.deepEqual((await as(302,{action:'shop-purchases'})).purchases,[]);
  assert.match((await as(302,{action:'refund-request',payment:'cs_test_000050'})).error,/not yours/);
  const asked=await as(301,{action:'refund-request',payment:'cs_test_000050'});
  assert.deepEqual(asked.refund,{id:'cs_test_000050',amount:'10.00',tokens:25,at:rows.get('stripe:cs_test_000050').at,unspent:25});
  assert.match((await as(301,{action:'refund-request',payment:'cs_test_000050'})).error,/already asked/);
  assert.match(refundNote(asked.refund,'Tester (Steam account 301)'),/^Refund request: \$10\.00 for 25 tokens, paid .* UTC by Tester \(Steam account 301\)\. 25 of those 25 tokens are still unspent\. Stripe checkout cs_test_000050\./);
  // Fav's panel lists it until the Stripe refund lands.
  assert.deepEqual(Object.keys((await as(ADMIN_ACCOUNT,{action:'shop-payments'})).payments),['cs_test_000050']);
  await reverse({id:'cs_test_000050',cents:1000,total:1000,kind:'refunded'});
  assert.deepEqual((await as(ADMIN_ACCOUNT,{action:'shop-payments'})).payments,{});
  // A day later the other bundle can't be asked about, and drops off the list.
  now+=REFUND_WINDOW_MS;
  assert.match((await as(301,{action:'refund-request',payment:'cs_test_000051'})).error,/first 24 hours/);
  assert.deepEqual((await as(301,{action:'shop-purchases'})).purchases,[]);
  assert.equal(refundable({status:'credited',account:'301',at:0},301,REFUND_WINDOW_MS-1),true);
  assert.equal(refundable({status:'unmatched',account:'301',at:0},301,1),false);
});
test('refunds and disputes take the tokens back, never below zero',()=>{
  assert.deepEqual(reverseTokens({tokens:25},10),{state:{tokens:15},taken:10,owed:0});
  assert.deepEqual(reverseTokens({tokens:4},10),{state:{tokens:0},taken:4,owed:6});
  assert.deepEqual(reverseTokens({},10),{state:{tokens:0},taken:0,owed:10});
});
test('vault: a refund takes back what the checkout bought, once; spent tokens are kept as owed',async()=>{
  const {as,pay,reverse,rows}=vaultWith({SHOP_ENABLED:'on'});
  await as(301,{action:'session'});
  await pay({id:'cs_test_000030',account:'301',dollars:10});
  await as(301,{action:'buy',item:legendary.key}); // 25 less 10
  // Half refunded first, then the rest: Stripe sends the running total each time.
  assert.equal((await reverse({id:'cs_test_000030',cents:500,total:1000,kind:'refunded'})).reversed,13);
  assert.equal(rows.get('user:301').tokens,2);
  const all=await reverse({id:'cs_test_000030',cents:1000,total:1000,kind:'refunded'});
  assert.deepEqual([all.reversed,all.owed,all.status],[25,10,'refunded']);
  assert.equal(rows.get('user:301').tokens,0);
  // The same refund again, or a dispute after it, takes nothing more.
  await reverse({id:'cs_test_000030',cents:1000,total:1000,kind:'refunded'});
  await reverse({id:'cs_test_000030',cents:1000,total:1000,kind:'disputed'});
  assert.equal(rows.get('stripe:cs_test_000030').reversed,25);
  assert.equal((await reverse({id:'cs_test_nothing',cents:1000,total:1000,kind:'refunded'})).unknown,true);
});
test('vault: a refunded payment that never found its player can no longer be assigned',async()=>{
  const {as,pay,reverse,rows}=vaultWith({SHOP_ENABLED:'on'});
  for(const a of [301,ADMIN_ACCOUNT])await as(a,{action:'session'});
  await pay({id:'cs_test_000031',account:'424242',dollars:5});
  assert.equal((await reverse({id:'cs_test_000031',cents:500,total:500,kind:'disputed'})).status,'disputed');
  assert.deepEqual((await as(ADMIN_ACCOUNT,{action:'shop-payments'})).payments,{});
  assert.match((await as(ADMIN_ACCOUNT,{action:'shop-assign',payment:'cs_test_000031',target:'301'})).error,/not waiting/);
  assert.equal(rows.get('user:301').tokens??0,0);
});
test('Stripe webhook: charge.refunded finds its checkout through Stripe and takes the tokens back',async()=>{
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage},{}),COSMETICS={idFromName:()=>'id',get:()=>vault};
  await vault.fetch(new Request('https://vault/action?account=301',{method:'POST',body:JSON.stringify({action:'session',requestId:'stripe-test-000002'})}));
  await vault.fetch(new Request('https://vault/stripe',{method:'POST',body:JSON.stringify({id:'cs_test_r1r2r3r4',account:'301',cents:2000,currency:'usd'})}));
  const sign=(body,t=Math.floor(Date.now()/1000))=>`t=${t},v1=${createHmac('sha256','whsec_right').update(`${t}.${body}`).digest('hex')}`;
  const env={COSMETICS,STRIPE_WEBHOOK_SECRET:'whsec_right',STRIPE_SECRET_KEY:'sk_test_x'};
  const send=body=>cosmeticsRequest(new Request('https://w/cosmetics/stripe',{method:'POST',headers:{'stripe-signature':sign(body)},body}),env,['https://site']);
  const real=globalThis.fetch;let asked;
  globalThis.fetch=async url=>{asked=String(url);return new Response(JSON.stringify({data:url.includes('pi_test_known')?[{id:'cs_test_r1r2r3r4'}]:[]}),{status:200});};
  try {
    const refunded=JSON.stringify({type:'charge.refunded',data:{object:{object:'charge',payment_intent:'pi_test_known1',amount:2000,amount_refunded:2000}}});
    const r=await (await send(refunded)).json();
    assert.match(asked,/checkout\/sessions\?payment_intent=pi_test_known1/);
    assert.deepEqual([r.status,r.reversed],['refunded',55]);
    assert.equal(rows.get('user:301').tokens,0);
    // A payment that wasn't a shop checkout is dropped.
    const other=JSON.stringify({type:'charge.dispute.created',data:{object:{object:'dispute',payment_intent:'pi_test_other1',amount:900}}});
    assert.equal((await (await send(other)).json()).ignored,true);
  } finally {globalThis.fetch=real;}
});
