import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {BUNDLES,bundleBonus,bundleFor,tokensForPayment,creditTokens,buyItem,recyclable,priceOf,shopVisible,SHOP_ITEMS,PRICES,giftItem,buySlot,SLOT_PRICE,MAX_EXTRA_SLOTS,setSupporterBadge,supporterShown,orderCommission} from '../public/lib/shop.js';
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
  assert.deepEqual(PRICES,{common:1,rare:3,epic:5,legendary:10});
  assert.equal(priceOf(common.key),1);
  assert.equal(priceOf(legendary.key),10);
  assert.equal(SHOP_ITEMS.length,CATALOG.filter(i=>!i.commission).length);
  assert.ok(CATALOG.filter(i=>i.commission).every(i=>priceOf(i.key)!=null&&!SHOP_ITEMS.includes(i)));
  assert.equal(priceOf('screen:1'),null);
  assert.throws(()=>buyItem({tokens:99,inventory:{}},'screen:1'),/not for sale/);
});
test('the shop shows only on local dev hosts',()=>{
  for(const h of ['localhost','127.0.0.1','[::1]','site.test','a.localhost'])assert.ok(shopVisible(h),h);
  for(const h of ['jonahmatthews.github.io','ad2lstats.com','localhost.evil.com',''])assert.ok(!shopVisible(h),h);
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
  return {as,pay,rows};
};
test('vault: every shop action is refused while SHOP_ENABLED is off; a paid checkout still credits',async()=>{
  const {as,pay}=vaultWith({});
  await as(301,{action:'session'});
  for(const action of ['buy','shop-payments','shop-assign'])assert.match((await as(301,{action,item:common.key})).error,/not open yet/);
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
test('supporter badge: earned by buying tokens, hidden until the player turns it on, public in their appearance',()=>{
  assert.throws(()=>setSupporterBadge({},{profile:true,card:true}),/first token purchase/);
  let s=creditTokens({inventory:{},equipment:{...DEFAULT_EQUIPMENT}},10,'tx');
  assert.deepEqual(supporterShown(s),{profile:false,card:false});
  s=setSupporterBadge(s,{profile:true,card:false});
  assert.deepEqual(cardAppearance(s).supporter,{profile:true,card:false});
  assert.equal(cardAppearance({equipment:{}}).supporter,null);
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

test('an arcana card costs ARCANA_PRICE tokens; the first one seals the Double finish',async()=>{
  const {buyArcana,ARCANA_PRICE}=await import('../public/lib/shop.js');
  assert.equal(ARCANA_PRICE,30);
  assert.throws(()=>buyArcana({tokens:29,inventory:{}}),/30 tokens/);
  const first=buyArcana({tokens:45,inventory:{}});
  assert.equal(first.state.tokens,15);assert.equal(first.state.arcanaOwed,1);assert.equal(first.state.arcanaSealed,1);assert.equal(first.price,30);
  const unlocked={...first.state,tokens:30,arcanaUpgrade:true};delete unlocked.arcanaSealed;
  const second=buyArcana(unlocked).state;
  assert.equal(second.tokens,0);assert.equal(second.arcanaOwed,2);assert.equal(second.arcanaSealed,undefined);
});
