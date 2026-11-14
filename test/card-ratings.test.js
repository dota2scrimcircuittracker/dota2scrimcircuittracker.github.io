import {test} from 'node:test';
import assert from 'node:assert/strict';
import {designKey,castVote,tally} from '../public/lib/card-ratings.js';
import {DEFAULT_EQUIPMENT,CATALOG} from '../public/lib/cosmetics-catalog.js';
import {CosmeticsVault} from '../workers/steam-auth/src/cosmetics.js';

test('a design fingerprint ignores key order and changes with the design',()=>{
  assert.equal(designKey({a:1,b:{c:2,d:[1,2]}}),designKey({b:{d:[1,2],c:2},a:1}));
  assert.notEqual(designKey({...DEFAULT_EQUIPMENT}),designKey({...DEFAULT_EQUIPMENT,hue:10}));
  assert.match(designKey(DEFAULT_EQUIPMENT),/^[0-9a-f]{16}$/);
});
test('one vote per voter, null takes it back, ties go to the rarer pick',()=>{
  let v=castVote({},'1','rare');v=castVote(v,'1','epic');v=castVote(v,'2','common');
  assert.deepEqual(tally(v),{counts:{common:1,rare:0,epic:1,legendary:0},total:2,pick:'epic'});
  assert.deepEqual(tally(castVote(v,'1',null)).total,1);
  assert.throws(()=>castVote(v,'3','mythic'));
  assert.deepEqual(tally(null),{counts:{common:0,rare:0,epic:0,legendary:0},total:0,pick:null});
});
test('vault ratings: signed-in voters only once per design, never their own, reset on change, back on revert',async()=>{
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage});let n=0;
  const as=(account,body)=>vault.fetch(new Request(`https://vault/action?account=${account}`,{method:'POST',body:JSON.stringify({requestId:`rating-request-${String(++n).padStart(6,'0')}`,...body})}));
  const ratings=async()=>(await (await vault.fetch(new Request('https://vault/ratings?account=201'))).json()).cards[0];
  for(const a of [201,202,203])await as(a,{action:'session'});
  assert.equal((await as(201,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:30}})).status,200);
  assert.equal((await as(201,{action:'rate',target:201,cardSlot:0,rating:'legendary'})).status,400);
  assert.equal((await as(202,{action:'rate',target:201,cardSlot:1,rating:'rare'})).status,400); // empty slot
  assert.equal((await as(202,{action:'rate',target:201,cardSlot:0,rating:'mythic'})).status,400);
  const first=await (await as(202,{action:'rate',target:201,cardSlot:0,rating:'rare'})).json();
  assert.equal(first.rating.mine,'rare');
  await as(202,{action:'rate',target:201,cardSlot:0,rating:'epic'});
  await as(203,{action:'rate',target:201,cardSlot:0,rating:'epic'});
  assert.deepEqual((await ratings()).counts,{common:0,rare:0,epic:2,legendary:0});
  // A changed card has no votes; the old design keeps them for a revert.
  await as(201,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:90}});
  assert.equal((await ratings()).total,0);
  await as(201,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:30}});
  assert.deepEqual((await ratings()).counts.epic,2);
});
test('vault gallery: changed designs only, with ratings; my-votes lists only the asker\'s votes',async()=>{
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage});let n=0;
  const as=(account,body)=>vault.fetch(new Request(`https://vault/action?account=${account}`,{method:'POST',body:JSON.stringify({requestId:`gallery-request-${String(++n).padStart(6,'0')}`,...body})}));
  const gallery=async()=>(await (await vault.fetch(new Request('https://vault/gallery'))).json()).cards;
  for(const a of [301,302,303])await as(a,{action:'session'});
  assert.deepEqual(await gallery(),[]); // fresh collections are the default card
  await as(301,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:30}});
  await as(302,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:60},cardSlot:2});
  await as(303,{action:'rate',target:301,cardSlot:0,rating:'legendary'});
  await as(302,{action:'rate',target:301,cardSlot:0,rating:'legendary'});
  const cards=await gallery();
  assert.deepEqual(cards.map(c=>[c.account,c.slot,c.primary]).sort(),[['301',0,true],['302',2,false]]);
  const card=cards.find(c=>c.account==='301');
  assert.equal(card.pick,'legendary');assert.equal(card.total,2);assert.equal(card.design.hue,30);
  const mine=await (await as(303,{action:'my-votes'})).json();
  assert.deepEqual(mine.votes,{[`301:${card.key}`]:'legendary'});
  assert.deepEqual((await (await as(301,{action:'my-votes'})).json()).votes,{});
});
test('nicknames: plain text up to 24, shown only when chosen, in the appearance, collection and gallery',async()=>{
  const {setNickname,shownNickname,cardAppearance}=await import('../public/lib/cosmetics-engine.js');
  const base={v:2,inventory:{},packs:[],equipment:{...DEFAULT_EQUIPMENT}};
  assert.equal(shownNickname(setNickname(base,{nickname:'  Big   Dog ',showNickname:false})),null);
  const on=setNickname(base,{nickname:'Big Dog',showNickname:true});
  assert.equal(shownNickname(on),'Big Dog');assert.equal(cardAppearance(on).nickname,'Big Dog');
  assert.throws(()=>setNickname(base,{nickname:'<b>x</b>',showNickname:true}));
  assert.throws(()=>setNickname(base,{nickname:'x'.repeat(25),showNickname:true}));
  assert.throws(()=>setNickname(base,{nickname:'',showNickname:true}));
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage});let n=0;
  const as=(account,body)=>vault.fetch(new Request(`https://vault/action?account=${account}`,{method:'POST',body:JSON.stringify({requestId:`nickname-request-${String(++n).padStart(6,'0')}`,...body})}));
  await as(401,{action:'session'});
  await as(401,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:40}});
  assert.equal((await as(401,{action:'nickname',nickname:'Big Dog',showNickname:true})).status,200);
  assert.equal((await (await vault.fetch(new Request('https://vault/collection?account=401'))).json()).nickname,'Big Dog');
  assert.equal((await (await vault.fetch(new Request('https://vault/appearances'))).json())['401'].nickname,'Big Dog');
  assert.equal((await (await vault.fetch(new Request('https://vault/gallery'))).json()).cards[0].nickname,'Big Dog');
  await as(401,{action:'nickname',nickname:'Big Dog',showNickname:false});
  assert.equal((await (await vault.fetch(new Request('https://vault/collection?account=401'))).json()).nickname,null);
});
test('pull log: epic and legendary pulls only, newest first, filled once from older receipts',async()=>{
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)).sort(([a],[b])=>a<b?-1:1).map(([k,v])=>[k,structuredClone(v)]))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage});let n=0;
  const as=(account,body)=>vault.fetch(new Request(`https://vault/action?account=${account}`,{method:'POST',body:JSON.stringify({requestId:`pull-request-${String(++n).padStart(6,'0')}`,...body})}));
  const pulls=async()=>(await (await vault.fetch(new Request('https://vault/pulls'))).json()).pulls;
  // A receipt from before the log existed: one legendary among commons.
  const legendary=CATALOG.find(i=>i.rarity==='legendary'),common=CATALOG.find(i=>i.rarity==='common');
  rows.set('user:401',{nickname:'Dops',showNickname:true});
  rows.set('receipt:401:old-request-000000001',{action:'open',openedAt:1000,packType:'common',result:{rewards:[{key:common.key},{key:legendary.key}]}});
  rows.set('receipt:401:old-request-000000002',{action:'open',openedAt:2000,packType:'common',result:{rewards:[{key:common.key}]}});
  assert.deepEqual(await pulls(),[{account:'401',at:1000,packType:'common',items:[legendary.key],nickname:'Dops'}]);
  // New opens log as they happen; an epic upgrade pack is all epic or better.
  await as(402,{action:'session'});
  rows.set('user:402',{...rows.get('user:402'),packs:['epic']});
  const opened=await (await as(402,{action:'open',packIndex:0})).json();
  const log=await pulls();
  assert.equal(log.length,2);assert.equal(log[0].account,'402');
  // A random pack can repeat an item; the Feed posts first copies only, except arcana, which always post.
  assert.deepEqual(log[0].items,opened.rewards.filter(r=>r.arcana||!r.duplicate).map(r=>r.key));
  assert.ok(log[0].items.every(k=>['epic','legendary'].includes(CATALOG.find(i=>i.key===k).rarity)||CATALOG.find(i=>i.key===k).rarity==='arcana'));
});
test('pack cards: nominate up to 4 with a main stat, self-rate apart from votes, rate any slot',async()=>{
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),delete:async k=>rows.delete(k),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage});let n=0;
  const as=async(account,body)=>(await vault.fetch(new Request(`https://vault/action?account=${account}`,{method:'POST',body:JSON.stringify({requestId:`pc-request-${String(++n).padStart(6,'0')}`,...body})}))).json();
  for(const a of [401,402])await as(a,{action:'session'});
  for(const slot of [0,1,3])await as(401,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:10+slot},cardSlot:slot});
  const bad=await as(401,{action:'pack-cards',cards:[{slot:0,main:'kills'},{slot:1,main:'kills'},{slot:3,main:'kills'},{slot:4,main:'kills'},{slot:2,main:'kills'}]});
  assert.match(bad.error,/up to 4/);
  const ok=await as(401,{action:'pack-cards',cards:[{slot:0,main:'kills'},{slot:3,main:'stuns'}]});
  assert.deepEqual(ok.state.packCards.map(c=>[c.slot,c.main]),[[0,'kills'],[3,'stuns']]);
  assert.match((await as(401,{action:'pack-cards',cards:[{slot:2,main:'kills'}]})).error,/no saved design/);
  await as(401,{action:'self-rate',cardSlot:3,rating:'legendary'});
  await as(402,{action:'rate',target:401,cardSlot:3,rating:'rare'}); // slot 3: past the old 0-2 limit
  const res=await vault.fetch(new Request('https://vault/player-cards?account=401')),text=await res.text(),cards=JSON.parse(text);
  const three=cards.designs.find(d=>d.slot===3);
  assert.equal(three.self,'legendary');assert.equal(three.counts.rare,1);assert.equal(three.total,1); // self-rating isn't a vote
  assert.equal(three.main,'stuns');
  // Public: counts only, never who voted what.
  assert.ok(cards.designs.every(d=>!('votes' in d)));assert.ok(!text.includes('402'));
});
test('pack cards: stricter nominations and self-ratings',async()=>{
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),delete:async k=>rows.delete(k),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage});let n=0;
  const as=async(account,body)=>(await vault.fetch(new Request(`https://vault/action?account=${account}`,{method:'POST',body:JSON.stringify({requestId:`pcs-request-${String(++n).padStart(6,'0')}`,...body})}))).json();
  const playerCards=async a=>(await (await vault.fetch(new Request(`https://vault/player-cards?account=${a}`))).json()).designs;
  for(const a of [501,502,503])await as(a,{action:'session'});
  // A fresh slot 0 is the plain default card: not a saved design.
  assert.match((await as(503,{action:'pack-cards',cards:[{slot:0,main:'kills'}]})).error,/no saved design/);
  const realNow=Date.now;let clock=1000;Date.now=()=>clock;
  try {
    await as(501,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:20},cardSlot:0});
    clock=2000;await as(501,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:21},cardSlot:1});
    assert.match((await as(501,{action:'pack-cards',cards:[{slot:0,main:'kills'},{slot:0,main:'kills'}]})).error,/^Each card can be a pack card once\.$/);
    assert.match((await as(501,{action:'pack-cards',cards:[{slot:0,main:'nonsense'}]})).error,/bonus stat/);
    for(const cards of [undefined,null,'0'])assert.equal((await as(501,{action:'pack-cards',cards})).error,'Choose your pack cards.');
    clock=3000;let ok=await as(501,{action:'pack-cards',cards:[{slot:0,main:'kills'},{slot:1,main:null}]});
    assert.deepEqual(ok.state.packCards,[{slot:0,main:'kills'},{slot:1,main:null}]); // null: the position's default
    assert.deepEqual((await playerCards(501)).map(c=>c.savedAt),[1000,2000]); // how old each design is
    clock=4000;await as(501,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:40},cardSlot:0});
    assert.deepEqual((await playerCards(501)).map(c=>c.savedAt),[4000,2000]); // a re-saved design is newer
    assert.deepEqual((await as(501,{action:'pack-cards',cards:[]})).state.packCards,[]);
  } finally {Date.now=realNow;}
  await as(501,{action:'pack-cards',cards:[{slot:0,main:'kills'}]});
  assert.match((await as(501,{action:'self-rate',cardSlot:0,rating:'mythic'})).error,/common, rare, epic or legendary/);
  assert.match((await as(501,{action:'self-rate',cardSlot:2,rating:'rare'})).error,/no saved design/);
  await as(501,{action:'self-rate',cardSlot:0,rating:'legendary'});
  assert.equal((await playerCards(501))[0].self,'legendary');
  await as(501,{action:'self-rate',cardSlot:0,rating:null});
  assert.equal((await playerCards(501))[0].self,null);
  await as(501,{action:'self-rate',cardSlot:1,rating:'epic'});
  assert.match((await as(502,{action:'rate',target:501,cardSlot:5,rating:'rare'})).error,/one of their cards/);
  await as(502,{action:'rate',target:501,cardSlot:1,rating:'common'});
  // A self-rating never counts in the Gallery or my-votes.
  const card=(await (await vault.fetch(new Request('https://vault/gallery'))).json()).cards.find(c=>c.account==='501'&&c.slot===1);
  assert.equal(card.total,1);assert.equal(card.counts.epic,0);
  assert.deepEqual((await as(501,{action:'my-votes'})).votes,{});
  assert.deepEqual(Object.values((await as(502,{action:'my-votes'})).votes),['common']);
});
test('pack cards: voting closes on Thanksgiving and pack cards freeze once',async()=>{
  const {WINTER}=await import('../public/lib/winter.js');
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),delete:async k=>rows.delete(k),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage});let n=0,clock=WINTER.votesCloseAt-864e5;vault.clock=()=>clock;
  const as=async(account,body)=>(await vault.fetch(new Request(`https://vault/action?account=${account}`,{method:'POST',body:JSON.stringify({requestId:`tg-request-${String(++n).padStart(6,'0')}`,...body})}))).json();
  const get=async a=>{const t=await (await vault.fetch(new Request(`https://vault/player-cards?account=${a}`))).text();return {text:t,...JSON.parse(t)};};
  for(const a of [601,602,603])await as(a,{action:'session'});
  // Five designs: the first four are pack cards (two with a stat chosen), Card 5 sits out.
  for(const slot of [0,1,2,3,4])await as(601,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:50+slot},cardSlot:slot});
  // Before the close: everything works and nothing is frozen.
  assert.ok((await as(601,{action:'pack-cards',cards:[{slot:0,main:'kills'},{slot:1,main:'stuns'}]})).state);
  assert.ok((await as(601,{action:'self-rate',cardSlot:0,rating:'epic'})).selfRating);
  assert.ok((await as(602,{action:'rate',target:601,cardSlot:1,rating:'legendary'})).rating);
  let pc=await get(601);
  assert.equal(pc.locked,false);assert.equal(pc.slots,undefined);
  assert.equal(rows.has('packslots:601'),false);
  // After the close.
  clock=WINTER.votesCloseAt;
  assert.equal((await as(601,{action:'pack-cards',cards:[{slot:2,main:'kills'}]})).error,'Pack cards were locked on Thanksgiving.');
  assert.equal((await as(601,{action:'self-rate',cardSlot:1,rating:'common'})).error,'Pack cards were locked on Thanksgiving.');
  assert.equal((await as(603,{action:'rate',target:601,cardSlot:0,rating:'common'})).error,'Voting on Winter pack cards closed on Thanksgiving.');
  assert.equal((await as(603,{action:'rate',target:601,cardSlot:2,rating:'rare'})).error,'Voting on Winter pack cards closed on Thanksgiving.'); // entered automatically
  assert.ok((await as(603,{action:'rate',target:601,cardSlot:4,rating:'rare'})).rating); // Card 5: not a pack card
  assert.equal(rows.has('packslots:601'),false); // nothing has needed the freeze yet
  // Editing a nominated slot freezes first, so the freeze has the design from before the edit.
  const before=structuredClone(rows.get('user:601').cardDesigns?.[1]??null);
  assert.ok((await as(601,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:99},cardSlot:1})).state);
  const frozen=rows.get('packslots:601');
  assert.equal(frozen.frozenAt,WINTER.votesCloseAt);
  assert.equal(frozen.slots.legendary.slot,1);assert.equal(frozen.slots.legendary.main,'stuns');assert.equal(frozen.slots.legendary.design.hue,51);
  if(before)assert.equal(frozen.slots.legendary.design.hue,before.hue);
  assert.equal(frozen.slots.epic.slot,0);assert.equal(frozen.slots.epic.main,'kills');
  // The two untouched designs were entered automatically, with the default stat (null).
  assert.deepEqual([frozen.slots.common.slot,frozen.slots.rare.slot].sort(),[2,3]);
  assert.equal(frozen.slots.common.main,null);assert.equal(frozen.slots.arcana,undefined);
  assert.match(frozen.slots.epic.designKey,/^[0-9a-f]{16}$/);
  // Later edits and votes elsewhere change nothing.
  clock+=864e5;
  await as(601,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:77},cardSlot:0});
  await as(602,{action:'rate',target:601,cardSlot:4,rating:'legendary'});
  await as(603,{action:'rate',target:601,cardSlot:1,rating:'common'}); // the new design in slot 1 isn't the frozen one
  assert.deepEqual(rows.get('packslots:601'),frozen);
  // The public GET: locked, the frozen slots, never raw votes.
  pc=await get(601);
  assert.equal(pc.locked,true);assert.deepEqual(pc.slots,frozen.slots);
  assert.ok(!pc.text.includes('602')&&!pc.text.includes('603'));assert.ok(!pc.text.includes('"votes"'));
  // A player with nothing nominated gets the default common, and nothing is stored.
  pc=await get(603);
  assert.deepEqual(pc.slots,{common:'default',rare:null,epic:null,legendary:null});
  assert.equal(rows.has('packslots:603'),false);
});
test('pack cards after the close: cup votes, duplicate designs and lookups can\'t move the freeze',async()=>{
  const {WINTER}=await import('../public/lib/winter.js');
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),delete:async k=>rows.delete(k),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage});let n=0,clock=WINTER.votesCloseAt-864e5;vault.clock=()=>clock;
  // The cup's voting started before the close, so cup ratings are allowed by the cup itself.
  vault.cupConfig={id:1,name:'Arcana Cup',votingAt:WINTER.votesCloseAt-2*36e5,roundMs:864e5,maxEntries:3,maxPerCategory:2};
  const as=async(account,body)=>(await vault.fetch(new Request(`https://vault/action?account=${account}`,{method:'POST',body:JSON.stringify({requestId:`tg2-request-${String(++n).padStart(6,'0')}`,...body})}))).json();
  const get=async a=>(await vault.fetch(new Request(`https://vault/player-cards?account=${a}`))).json();
  for(const a of [701,702,703,704])await as(a,{action:'session'});
  // 701 (six slots): slots 0-3 are pack cards (0 and 1 with a stat); slot 4 is a copy of slot 1's
  // design; slot 5 is unrelated and sits out.
  rows.set('user:701',{...rows.get('user:701'),extraSlots:1});
  for(const [slot,hue] of [[0,60],[1,61],[2,62],[3,63],[4,61],[5,65]])await as(701,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue},cardSlot:slot});
  assert.ok((await as(701,{action:'pack-cards',cards:[{slot:0,main:'kills'},{slot:1,main:'stuns'}]})).state);
  assert.ok((await as(701,{action:'cup-enter',cardSlot:0,category:'artistic'})).entry);
  assert.ok((await as(701,{action:'cup-enter',cardSlot:5,category:'funny'})).entry);
  await as(702,{action:'rate',target:701,cardSlot:1,rating:'legendary'});
  await as(703,{action:'rate',target:701,cardSlot:0,rating:'epic'});
  clock=WINTER.votesCloseAt+36e5; // strictly after the close
  const closed='Voting on Winter pack cards closed on Thanksgiving.';
  const votesBefore=structuredClone([...rows].filter(([k])=>k.startsWith('votes:701:')));
  // A cup vote on a nominated design is a vote on that design: refused.
  assert.equal((await as(704,{action:'cup-rate',entry:'701-1',rating:'common'})).error,closed);
  assert.ok((await as(704,{action:'cup-rate',entry:'701-2',rating:'rare'})).rating); // not nominated
  // A copy of a nominated design in another slot shares its votes: refused.
  assert.equal((await as(704,{action:'rate',target:701,cardSlot:4,rating:'common'})).error,closed);
  for(const [k,v] of votesBefore)assert.deepEqual(rows.get(k),v);
  assert.equal(rows.has('packslots:701'),false);
  // Card order and settings change nothing assignSlots reads: the late freeze equals a close-time one.
  const twin=new Map([...rows].map(([k,v])=>[k,structuredClone(v)]));
  assert.ok((await as(701,{action:'card-order',order:rows.get('user:701').cardDesigns.map((_,i,a)=>a.length-1-i)})).state);
  assert.ok((await as(701,{action:'card-settings',primaryCard:2,shuffleCards:true})).state);
  clock+=864e5;
  const late=(await get(701)).slots;
  rows.clear();for(const [k,v] of twin)rows.set(k,v);clock=WINTER.votesCloseAt+36e5;
  const early=(await get(701)).slots;
  assert.deepEqual(late,early);
  assert.equal(early.legendary.slot,1);assert.equal(early.epic.slot,0);
  assert.equal(rows.get('packslots:701').frozenAt,WINTER.votesCloseAt+36e5);
  // Looking up an account that doesn't exist, or one with nothing nominated, writes nothing.
  const keys=()=>[...rows.keys()].sort();
  let before=keys();
  assert.deepEqual((await get(799)).slots,{common:'default',rare:null,epic:null,legendary:null});
  assert.deepEqual((await get(702)).slots,{common:'default',rare:null,epic:null,legendary:null});
  assert.deepEqual(keys(),before);
  assert.equal(rows.has('packslots:799'),false);assert.equal(rows.has('packslots:702'),false);
});
test('pack cards are automatic: the first four designs, Card 5 swaps in, plain slots skipped, arcana is a 5th card',async()=>{
  const {isPlainDesign}=await import('../public/lib/card-ratings.js');
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),delete:async k=>rows.delete(k),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage});let n=0;
  const as=async(account,body)=>(await vault.fetch(new Request(`https://vault/action?account=${account}`,{method:'POST',body:JSON.stringify({requestId:`auto-request-${String(++n).padStart(6,'0')}`,...body})}))).json();
  const get=async a=>(await vault.fetch(new Request(`https://vault/player-cards?account=${a}`))).json();
  const order=async a=>(await get(a)).designs.map(d=>[d.slot,d.main]);
  for(const a of [801,802])await as(a,{action:'session'});
  rows.set('user:801',{...rows.get('user:801'),extraSlots:2,inventory:{...rows.get('user:801').inventory,'tool:twin-flip':1}});
  // Slot 1 is plain (skipped); slots 0, 2, 3, 4, 5 have designs: the first four by slot are entered.
  for(const slot of [0,2,3,4,5])await as(801,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:10+slot},cardSlot:slot});
  assert.equal(rows.get('user:801').packCards,undefined); // never touched: nothing stored
  assert.deepEqual(await order(801),[[0,null],[2,null],[3,null],[4,null]]);
  assert.equal((await get(801)).arcana,null);
  // Swap Card 6 (slot 5) in for slot 2.
  assert.ok((await as(801,{action:'pack-cards',cards:[{slot:0,main:null},{slot:5,main:'kills'},{slot:3,main:null},{slot:4,main:null}]})).state);
  assert.deepEqual(await order(801),[[0,null],[5,'kills'],[3,null],[4,null]]);
  // A stored slot that goes plain is dropped and the next unused design fills in (slot 2).
  await as(801,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:0},cardSlot:5});
  assert.ok(isPlainDesign(rows.get('user:801').cardDesigns[5]));
  assert.deepEqual(await order(801),[[0,null],[3,null],[4,null],[2,null]]);
  // An arcana design (a Twin Card) never takes one of the four: it's the arcana card, and slot 6 fills its place.
  await as(801,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:66},cardSlot:6});
  await as(801,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:13,twin:{turn:'flip',design:{...DEFAULT_EQUIPMENT,hue:200}}},cardSlot:3});
  assert.deepEqual(await order(801),[[0,null],[4,null],[2,null],[6,null]]);
  assert.deepEqual((await get(801)).arcana,{slot:3,main:null});
  // Validation: no arcana design in the four, the arcana slot must be arcana.
  assert.match((await as(801,{action:'pack-cards',cards:[{slot:3,main:null}]})).error,/arcana card, not a voted one/);
  assert.match((await as(801,{action:'pack-cards',cards:[],arcana:{slot:0,main:null}})).error,/no arcana item/);
  assert.match((await as(801,{action:'pack-cards',cards:[],arcana:{slot:3,main:'nonsense'}})).error,/bonus stat/);
  const ok=await as(801,{action:'pack-cards',cards:[{slot:0,main:null},{slot:4,main:null},{slot:2,main:null},{slot:6,main:null}],arcana:{slot:3,main:'stuns'}});
  assert.deepEqual(ok.state.packArcana,{slot:3,main:'stuns'});
  assert.deepEqual((await get(801)).arcana,{slot:3,main:'stuns'});
  // Public: counts only.
  const text=await (await vault.fetch(new Request('https://vault/player-cards?account=801'))).text();
  assert.ok(!text.includes('"votes"'));
});
test('pack cards after the close: derived cards and the arcana card freeze; a first design after the close stays out',async()=>{
  const {WINTER}=await import('../public/lib/winter.js');
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),delete:async k=>rows.delete(k),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage});let n=0,clock=WINTER.votesCloseAt-864e5;vault.clock=()=>clock;
  const as=async(account,body)=>(await vault.fetch(new Request(`https://vault/action?account=${account}`,{method:'POST',body:JSON.stringify({requestId:`tg3-request-${String(++n).padStart(6,'0')}`,...body})}))).json();
  const get=async a=>(await vault.fetch(new Request(`https://vault/player-cards?account=${a}`))).json();
  for(const a of [901,902,903])await as(a,{action:'session'});
  rows.set('user:901',{...rows.get('user:901'),inventory:{...rows.get('user:901').inventory,'tool:twin-flip':1}});
  // 901 never touches pack cards: slots 0 and 2 are voted, slot 1 is arcana.
  await as(901,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:70},cardSlot:0});
  await as(901,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:71,twin:{turn:'flip',design:{...DEFAULT_EQUIPMENT,hue:171}}},cardSlot:1});
  await as(901,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:72},cardSlot:2});
  await as(902,{action:'rate',target:901,cardSlot:2,rating:'epic'});
  clock=WINTER.votesCloseAt+36e5;
  const closed='Voting on Winter pack cards closed on Thanksgiving.';
  // Votes on an auto-entered design lock; the arcana card isn't voted, so its votes stay open.
  assert.equal((await as(903,{action:'rate',target:901,cardSlot:0,rating:'rare'})).error,closed);
  assert.ok((await as(903,{action:'rate',target:901,cardSlot:1,rating:'rare'})).rating);
  assert.equal(rows.has('packslots:901'),false);
  // Editing the arcana card freezes first, with the arcana design from before the edit.
  await as(901,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:99},cardSlot:1});
  const frozen=rows.get('packslots:901');
  assert.equal(frozen.slots.arcana.slot,1);assert.equal(frozen.slots.arcana.design.hue,71);assert.equal(frozen.slots.arcana.main,null);
  assert.equal(frozen.slots.epic.slot,2);assert.equal(frozen.slots.common.slot,0);assert.equal(frozen.slots.common.main,null);
  const pc=await get(901);
  assert.equal(pc.locked,true);assert.deepEqual(pc.slots,frozen.slots);
  // 903 had no design at the close: a first design saved after it stores an empty freeze and stays out.
  await as(903,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:80},cardSlot:0});
  assert.deepEqual(rows.get('packslots:903').slots,{common:'default',rare:null,epic:null,legendary:null});
  assert.ok((await as(902,{action:'rate',target:903,cardSlot:0,rating:'rare'})).rating);
  assert.deepEqual((await get(903)).slots,{common:'default',rare:null,epic:null,legendary:null});
});
