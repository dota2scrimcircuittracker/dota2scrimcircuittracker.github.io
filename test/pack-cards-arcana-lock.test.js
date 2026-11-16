// Winter pack cards in the collection Worker: automatic entry, arcana cards from the Arcana Cup
// podium, and locks (docs/superpowers/specs/2026-11-13-player-packs-design.md section 1, 1.1).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {designKey,isPlainDesign} from '../public/lib/card-ratings.js';
import {DEFAULT_EQUIPMENT} from '../public/lib/cosmetics-catalog.js';
import {WINTER} from '../public/lib/winter.js';
import {CosmeticsVault} from '../workers/steam-auth/src/cosmetics.js';

const vaultRig=(prefix,clock)=>{
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),delete:async k=>rows.delete(k),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage});let n=0;
  if(clock)vault.clock=clock;
  const as=async(account,body)=>(await vault.fetch(new Request(`https://vault/action?account=${account}`,{method:'POST',body:JSON.stringify({requestId:`${prefix}-request-${String(++n).padStart(6,'0')}`,...body})}))).json();
  const raw=async a=>await (await vault.fetch(new Request(`https://vault/player-cards?account=${a}`))).text();
  const get=async a=>JSON.parse(await raw(a));
  return {rows,vault,as,get,raw};
};
const eq=(hue,extra={})=>({...DEFAULT_EQUIPMENT,hue,...extra});
const twinOf=(hue,back)=>eq(hue,{twin:{turn:'flip',design:eq(back)}});

// A Cup whose Artistic bracket is settled (seeds and every result stored, as cupSettle leaves them)
// and whose Funny bracket is still in round 1. Artistic podium: 1001-1 (1st, 1001), 1002-1 (2nd,
// 1002), 1001-2 (3rd, 1001 again); 1003-1 is 4th.
const r=(winner,loser)=>({winner,loser,votes:{}});
const CUP_RESULTS={'w0-0':r('1001-1','1002-1'),'w0-1':r('1001-2','1003-1'),'w1-0':r('1001-1','1001-2'),'l0-0':r('1002-1','1003-1'),'l1-0':r('1002-1','1001-2'),gf:r('1001-1','1002-1')};
const settledCup=(rows,vault,{votingAt})=>{
  vault.cupConfig={id:1,name:'Arcana Cup',votingAt,roundMs:864e5*30,firstRoundMs:864e5*30,maxEntries:3,maxPerCategory:2};
  const entry=(id,account,category,hue)=>{const design=eq(hue);rows.set(`cup:1:entry:${id}`,{id,account:String(account),category,slot:0,name:null,design,key:designKey(design),at:votingAt-1000});};
  entry('1001-1',1001,'artistic',201);entry('1002-1',1002,'artistic',202);entry('1001-2',1001,'artistic',203);entry('1003-1',1003,'artistic',204);
  entry('1004-1',1004,'funny',211);entry('1005-1',1005,'funny',212);
  rows.set('cup:1:artistic:seeds',{seeds:['1001-1','1002-1','1001-2','1003-1'],at:votingAt});
  rows.set('cup:1:artistic:results',structuredClone(CUP_RESULTS));
  rows.set('cup:1:artistic:awarded',votingAt);
  rows.set('cup:1:funny:seeds',{seeds:['1004-1','1005-1'],at:votingAt});
};

test('pack cards are automatic: the first four designs, Card 5 swaps in, plain slots skipped, a twin design is one of the four',async()=>{
  const {rows,as,get,raw}=vaultRig('auto');
  const order=async a=>(await get(a)).designs.map(d=>[d.slot,d.main]);
  for(const a of [801,802])await as(a,{action:'session'});
  rows.set('user:801',{...rows.get('user:801'),extraSlots:2,inventory:{...rows.get('user:801').inventory,'tool:twin-flip':1}});
  // Slot 1 is plain (skipped); slots 0, 2, 3, 4, 5 have designs: the first four by slot are entered.
  for(const slot of [0,2,3,4,5])await as(801,{action:'equip',equipment:eq(10+slot),cardSlot:slot});
  assert.equal(rows.get('user:801').packCards,undefined); // never touched: nothing stored
  assert.deepEqual(await order(801),[[0,null],[2,null],[3,null],[4,null]]);
  assert.deepEqual((await get(801)).arcana,[]);
  // Swap Card 6 (slot 5) in for slot 2.
  assert.ok((await as(801,{action:'pack-cards',cards:[{slot:0,main:null},{slot:5,main:'kills'},{slot:3,main:null},{slot:4,main:null}]})).state);
  assert.deepEqual(await order(801),[[0,null],[5,'kills'],[3,null],[4,null]]);
  // A stored slot that goes plain is dropped and the next unused design fills in (slot 2).
  await as(801,{action:'equip',equipment:eq(0),cardSlot:5});
  assert.ok(isPlainDesign(rows.get('user:801').cardDesigns[5]));
  assert.deepEqual(await order(801),[[0,null],[3,null],[4,null],[2,null]]);
  // A Twin Card design is an ordinary design now: it stays one of the four, and can be swapped in.
  await as(801,{action:'equip',equipment:twinOf(13,200),cardSlot:3});
  assert.deepEqual(await order(801),[[0,null],[3,null],[4,null],[2,null]]);
  await as(801,{action:'equip',equipment:twinOf(66,201),cardSlot:6});
  assert.ok((await as(801,{action:'pack-cards',cards:[{slot:6,main:'stuns'},{slot:3,main:null},{slot:4,main:null},{slot:2,main:null}]})).state);
  assert.deepEqual(await order(801),[[6,'stuns'],[3,null],[4,null],[2,null]]);
  assert.deepEqual((await get(801)).arcana,[]);
  // The old single arcana field ({slot, main}) is refused.
  assert.equal((await as(801,{action:'pack-cards',cards:[],arcana:{slot:3,main:null}})).error,'Choose your arcana cards.');
  assert.ok(!(await raw(801)).includes('"votes"'));
});

test('pack cards: an old opt-in packCards row (savedAt, fewer than four) still parses and fills up',async()=>{
  const {rows,as,get}=vaultRig('old');
  await as(851,{action:'session'});
  for(const slot of [0,1,2,3,4])await as(851,{action:'equip',equipment:eq(20+slot),cardSlot:slot});
  rows.set('user:851',{...rows.get('user:851'),packCards:[{slot:4,main:'kills',savedAt:1700},{slot:2,main:'stuns',savedAt:1600}]});
  assert.deepEqual((await get(851)).designs.map(d=>[d.slot,d.main]),[[4,'kills'],[2,'stuns'],[0,null],[1,null]]);
  // Sending a new list replaces it in the new shape.
  const ok=await as(851,{action:'pack-cards',cards:[{slot:4,main:'kills'},{slot:2,main:null},{slot:0,main:null},{slot:1,main:null}]});
  assert.deepEqual(ok.state.packCards,[{slot:4,main:'kills'},{slot:2,main:null},{slot:0,main:null},{slot:1,main:null}]);
});

test('pack cards after the close: derived cards freeze; a first design after the close stays out; Card 5 edits change nothing',async()=>{
  let clock=WINTER.lockAt-864e5;
  const {rows,as,get}=vaultRig('tg3',()=>clock);
  for(const a of [901,902,903])await as(a,{action:'session'});
  rows.set('user:901',{...rows.get('user:901'),inventory:{...rows.get('user:901').inventory,'tool:twin-flip':1}});
  // 901 never touches pack cards: slots 0-3 are the four (slot 1 a Twin Card), slot 4 sits out.
  await as(901,{action:'equip',equipment:eq(70),cardSlot:0});
  await as(901,{action:'equip',equipment:twinOf(71,171),cardSlot:1});
  for(const slot of [2,3,4])await as(901,{action:'equip',equipment:eq(70+slot),cardSlot:slot});
  await as(902,{action:'rate',target:901,cardSlot:2,rating:'epic'});
  await as(902,{action:'rate',target:901,cardSlot:1,rating:'legendary'});
  clock=WINTER.lockAt+36e5;
  // Votes on auto-entered designs still count, the twin one too, but the first one freezes the four.
  assert.ok((await as(903,{action:'rate',target:901,cardSlot:0,rating:'rare'})).rating);
  assert.ok((await as(903,{action:'rate',target:901,cardSlot:1,rating:'rare'})).rating);
  assert.ok((await as(903,{action:'rate',target:901,cardSlot:4,rating:'rare'})).rating);
  assert.equal(rows.get('packslots:901').frozenAt,WINTER.lockAt+36e5);
  // Saving a new design in Card 5 after the close is allowed and can't move the four.
  assert.ok((await as(901,{action:'equip',equipment:eq(94),cardSlot:4})).state);
  // Editing a pack card freezes first, with the twin design from before the edit.
  await as(901,{action:'equip',equipment:eq(99),cardSlot:1});
  const frozen=rows.get('packslots:901');
  assert.equal(frozen.slots.legendary.slot,1);assert.equal(frozen.slots.legendary.design.hue,71);
  assert.equal(frozen.slots.epic.slot,2);assert.equal(frozen.arcana,undefined);assert.equal(frozen.slots.arcana,undefined);
  assert.ok(![...Object.values(frozen.slots)].some(x=>x&&x.slot===4));
  // More Card 5 edits after the freeze change nothing in packs.
  assert.ok((await as(901,{action:'equip',equipment:eq(95),cardSlot:4})).state);
  assert.deepEqual(rows.get('packslots:901'),frozen);
  const pc=await get(901);
  assert.equal(pc.locked,true);assert.deepEqual(pc.slots,frozen.slots);assert.deepEqual(pc.arcana,[]);
  // 903 had no design at the close: a first design saved after it stores an empty freeze and stays out.
  await as(903,{action:'equip',equipment:eq(80),cardSlot:0});
  assert.deepEqual(rows.get('packslots:903').slots,{common:'default',rare:null,epic:null,legendary:null});
  assert.ok((await as(902,{action:'rate',target:903,cardSlot:0,rating:'rare'})).rating);
  assert.deepEqual((await get(903)).slots,{common:'default',rare:null,epic:null,legendary:null});
});

test('arcana pack cards come only from the Arcana Cup podium: owners, mains, GET shape, read from the Cup after the close',async()=>{
  let clock=WINTER.lockAt-864e5;
  const {rows,vault,as,get,raw}=vaultRig('arc',()=>clock);
  settledCup(rows,vault,{votingAt:clock-3600e3});
  for(const a of [1001,1002,1003,1004,1006])await as(a,{action:'session'});
  await as(1001,{action:'equip',equipment:eq(31),cardSlot:0});
  // 1001: 1st and 3rd in Artistic, two arcana cards; 1002: 2nd; 1003 (4th) and 1004 (Funny, unsettled): none.
  let pc=await get(1001);
  assert.deepEqual(pc.arcana.map(c=>[c.entry,c.category,c.place,c.main]),[['1001-1','artistic',0,null],['1001-2','artistic',2,null]]);
  assert.deepEqual(Object.keys(pc.arcana[0]).sort(),['category','design','entry','key','main','place']);
  assert.equal(pc.arcana[0].design.hue,201);assert.equal(pc.arcana[0].key,designKey(eq(201)));
  assert.deepEqual((await get(1002)).arcana.map(c=>[c.entry,c.place]),[['1002-1',1]]);
  assert.deepEqual((await get(1003)).arcana,[]);
  assert.deepEqual((await get(1004)).arcana,[]);
  // The arcana cards aren't among the four.
  assert.deepEqual(pc.designs.map(d=>d.slot),[0]);
  // Only the podium owner sets an arcana card's main; null clears it back to the default.
  const cards=[{slot:0,main:null}],notYours='That arcana card is not yours.';
  assert.equal((await as(1002,{action:'pack-cards',cards:[],arcana:[{entry:'1001-1',main:'kills'}]})).error,notYours);
  assert.equal((await as(1003,{action:'pack-cards',cards:[],arcana:[{entry:'1003-1',main:'kills'}]})).error,notYours); // 4th
  assert.equal((await as(1004,{action:'pack-cards',cards:[],arcana:[{entry:'1004-1',main:'kills'}]})).error,notYours); // unsettled bracket
  assert.equal((await as(1001,{action:'pack-cards',cards,arcana:[{entry:'1001-1',main:'nonsense'}]})).error,'Choose a bonus stat.');
  let ok=await as(1001,{action:'pack-cards',cards,arcana:[{entry:'1001-1',main:'kills'},{entry:'1001-2',main:'stuns'}]});
  assert.deepEqual(ok.state.packArcanaMains,{'1001-1':'kills','1001-2':'stuns'});
  ok=await as(1001,{action:'pack-cards',cards,arcana:[{entry:'1001-2',main:null}]});
  assert.deepEqual(ok.state.packArcanaMains,{'1001-1':'kills'});
  assert.deepEqual((await get(1001)).arcana.map(c=>c.main),['kills',null]);
  assert.ok((await as(1002,{action:'pack-cards',cards:[],arcana:[{entry:'1002-1',main:'gpm'}]})).state);
  assert.ok(!(await raw(1001)).includes('"votes"'));
  // The podium was stored when the bracket was awarded (backfilled here, since the fixture had none).
  assert.deepEqual(rows.get('cup:1:artistic:podium').map(e=>e.id),['1001-1','1002-1','1001-2']);
  // After the close only the four voted slots freeze; arcana cards are still read from the Cup, with
  // the owner's mains (which pack-cards no longer changes).
  clock=WINTER.lockAt+36e5;
  pc=await get(1001);
  assert.equal(pc.locked,true);
  assert.equal(rows.get('packslots:1001').arcana,undefined);assert.equal(rows.get('packslots:1001').slots.arcana,undefined);
  assert.deepEqual(pc.arcana.map(c=>[c.entry,c.main,c.place,c.design.hue]),[['1001-1','kills',0,201],['1001-2',null,2,203]]);
  pc=await get(1002);
  assert.deepEqual(pc.arcana.map(c=>[c.entry,c.main]),[['1002-1','gpm']]);
  assert.deepEqual(pc.slots,{common:'default',rare:null,epic:null,legendary:null});
  assert.equal(rows.has('packslots:1002'),false); // arcana alone stores no freeze
  assert.equal((await as(1001,{action:'pack-cards',cards,arcana:[{entry:'1001-1',main:'gpm'}]})).error,'Pack cards locked on Mon Nov 23.');
  // Saving a pack card after the close freezes the four and nothing else (equip does no Cup work).
  assert.ok((await as(1001,{action:'equip',equipment:eq(32),cardSlot:0})).state);
  assert.deepEqual(Object.keys(rows.get('packslots:1001')).sort(),['designs','frozenAt','slots']);
  // An awarded podium is fixed: Fav removing an entry afterwards doesn't move 4th up.
  rows.set('cup:1:entry:1001-2',{...rows.get('cup:1:entry:1001-2'),removed:clock});
  assert.deepEqual((await get(1001)).arcana.map(c=>c.entry),['1001-1','1001-2']);
  assert.deepEqual((await get(1003)).arcana,[]);
  // Neither designs nor arcana: nothing stored.
  assert.deepEqual((await get(1006)).arcana,[]);assert.equal(rows.has('packslots:1006'),false);
});

test('arcana pack cards: a bracket settled after the close still adds its podium cards (never frozen per player)',async()=>{
  const clock=WINTER.lockAt+36e5;
  const {rows,vault,get}=vaultRig('arcl',()=>clock);
  settledCup(rows,vault,{votingAt:clock-3600e3});
  rows.delete('cup:1:artistic:results');rows.delete('cup:1:artistic:awarded');
  rows.set('user:1001',{packs:[]});
  assert.deepEqual((await get(1001)).arcana,[]);
  // The bracket's results come in later (as votes close): the podium cards appear.
  rows.set('cup:1:artistic:results',structuredClone(CUP_RESULTS));
  assert.deepEqual((await get(1001)).arcana.map(c=>[c.entry,c.place]),[['1001-1',0],['1001-2',2]]);
});

// Fix: a Cup settle inside a player's own action used to send them their prize pack, then the
// action wrote back the row it read before settling, losing the pack (and `awarded` meant it was
// never re-sent). Every action that can settle now settles before reading the caller's row.
for(const [name,body] of [
  ['pack-cards with arcana mains',{action:'pack-cards',cards:[],arcana:[{entry:'1001-1',main:'kills'}]}],
  ['cup-vote in the other bracket',{action:'cup-vote',category:'funny',match:'w0-0',pick:'1004-1'}],
]) test(`Cup prize packs: a podium winner whose own action (${name}) settles the bracket keeps them`,async()=>{
  const clock=WINTER.lockAt-864e5;
  const {rows,vault,as}=vaultRig(`prize-${name.split(' ')[0]}`,()=>clock);
  settledCup(rows,vault,{votingAt:clock-3600e3});
  rows.delete('cup:1:artistic:awarded'); // results are in; nobody has settled yet
  await as(1001,{action:'session'});
  const before=rows.get('user:1001').packs.length;
  const ok=await as(1001,body);
  assert.ok(ok.state,ok.error);
  assert.ok(rows.get('cup:1:artistic:awarded'));
  const packs=rows.get('user:1001').packs;
  assert.equal(packs.length,before+2); // 1st and 3rd in Artistic
  assert.deepEqual(packs.slice(-2).sort(),['legendary','rare']);
  assert.deepEqual(ok.state.packs,packs);
});

test('arcana pack cards: an unsettled Cup has none',async()=>{
  const clock=WINTER.lockAt-864e5;
  const {rows,vault,as,get}=vaultRig('arc0',()=>clock);
  settledCup(rows,vault,{votingAt:clock-3600e3});
  rows.delete('cup:1:artistic:results');rows.delete('cup:1:artistic:awarded');
  for(const a of [1001,1002])await as(a,{action:'session'});
  assert.deepEqual((await get(1001)).arcana,[]);
  assert.deepEqual((await get(1002)).arcana,[]);
});

test('pack card locks: final until packs open; refuse design, stat and swap changes; votes and self-rating carry on',async()=>{
  let clock=WINTER.lockAt-5*864e5;
  const {rows,as,get}=vaultRig('lock',()=>clock);
  for(const a of [1101,1102])await as(a,{action:'session'});
  rows.set('user:1101',{...rows.get('user:1101'),extraSlots:1});
  // Slot 0 plain; slots 1-5 saved: the four are 1-4, slot 5 sits out.
  for(const slot of [1,2,3,4,5])await as(1101,{action:'equip',equipment:eq(40+slot),cardSlot:slot});
  assert.ok((await as(1101,{action:'pack-cards',cards:[{slot:1,main:null},{slot:2,main:'kills'},{slot:3,main:null},{slot:4,main:null}]})).state);
  // Only one of the current four can be locked.
  const notFour='Lock one of your four pack cards.';
  assert.equal((await as(1101,{action:'pack-lock',slot:5})).error,notFour);
  assert.equal((await as(1101,{action:'pack-lock',slot:0})).error,notFour);
  assert.equal((await as(1101,{action:'pack-lock',slot:'2'})).error,notFour);
  let ok=await as(1101,{action:'pack-lock',slot:2});
  assert.deepEqual(ok.state.packLocks,[2]);
  ok=await as(1101,{action:'pack-lock',slot:2}); // idempotent
  assert.deepEqual(ok.state.packLocks,[2]);
  assert.deepEqual((await get(1101)).locks,[2]);
  const lockedDesign='This card is locked for Winter packs until Nov 26.',lockedCard='That card is locked.';
  // The design can't be re-saved, made plain or given a twin.
  assert.equal((await as(1101,{action:'equip',equipment:eq(99),cardSlot:2})).error,lockedDesign);
  assert.equal((await as(1101,{action:'equip',equipment:eq(0),cardSlot:2})).error,lockedDesign);
  rows.set('user:1101',{...rows.get('user:1101'),inventory:{...rows.get('user:1101').inventory,'tool:twin-flip':1}});
  assert.equal((await as(1101,{action:'equip',equipment:twinOf(42,5),cardSlot:2})).error,lockedDesign);
  rows.set('user:1101',{...rows.get('user:1101'),primaryCard:2});
  assert.equal((await as(1101,{action:'equip',equipment:eq(98)})).error,lockedDesign); // no cardSlot: the primary
  assert.equal(rows.get('user:1101').cardDesigns[2].hue,42);
  // It can't be swapped out or have its stat changed; the others can.
  assert.equal((await as(1101,{action:'pack-cards',cards:[{slot:1,main:null},{slot:5,main:null},{slot:3,main:null},{slot:4,main:null}]})).error,lockedCard);
  assert.equal((await as(1101,{action:'pack-cards',cards:[{slot:1,main:null},{slot:2,main:'stuns'},{slot:3,main:null},{slot:4,main:null}]})).error,lockedCard);
  assert.equal((await as(1101,{action:'pack-cards',cards:[{slot:1,main:null},{slot:2,main:null},{slot:3,main:null},{slot:4,main:null}]})).error,lockedCard);
  assert.ok((await as(1101,{action:'pack-cards',cards:[{slot:5,main:'gpm'},{slot:2,main:'kills'},{slot:3,main:null},{slot:4,main:null}]})).state);
  assert.deepEqual((await get(1101)).designs.map(d=>d.slot),[5,2,3,4]);
  // Other slots still save; a new design in the earlier plain slot doesn't move the locked card out.
  assert.ok((await as(1101,{action:'equip',equipment:eq(50),cardSlot:0})).state);
  assert.ok((await as(1101,{action:'equip',equipment:eq(51),cardSlot:3})).state);
  assert.ok((await get(1101)).designs.some(d=>d.slot===2&&d.main==='kills'));
  assert.ok((await as(1101,{action:'card-settings',primaryCard:3,shuffleCards:true})).state);
  // Self-rating and community votes carry on.
  assert.ok((await as(1101,{action:'self-rate',cardSlot:2,rating:'legendary'})).selfRating);
  assert.ok((await as(1102,{action:'rate',target:1101,cardSlot:2,rating:'epic'})).rating);
  const two=(await get(1101)).designs.find(d=>d.slot===2);
  assert.equal(two.self,'legendary');assert.equal(two.counts.epic,1);
  // Locking a fresh account's derived four stores those four, so they can't shift.
  for(const slot of [1,2])await as(1102,{action:'equip',equipment:eq(60+slot),cardSlot:slot});
  ok=await as(1102,{action:'pack-lock',slot:2});
  assert.deepEqual(ok.state.packCards,[{slot:1,main:null},{slot:2,main:null}]);
  assert.ok((await as(1102,{action:'equip',equipment:eq(70),cardSlot:0})).state);
  assert.deepEqual((await get(1102)).designs.map(d=>d.slot),[1,2,0]);
  // Still enforced after pack cards lock (Mon Nov 23)...
  clock=WINTER.lockAt+36e5;
  assert.equal((await as(1101,{action:'equip',equipment:eq(97),cardSlot:2})).error,lockedDesign);
  // No new locks after the close (the four are frozen anyway), nor once packs open.
  assert.equal((await as(1101,{action:'pack-lock',slot:3})).error,'Pack cards locked on Mon Nov 23.');
  // ...and ignored from opensAt on: the design saves again and GET shows no locks.
  clock=WINTER.opensAt;
  assert.deepEqual((await get(1101)).locks,[]);
  assert.ok((await as(1101,{action:'equip',equipment:eq(96),cardSlot:2})).state);
  assert.equal((await as(1101,{action:'pack-lock',slot:2})).error,'Pack cards locked on Mon Nov 23.');
});
