import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedBracket,buildBracket,dueMatches,isVotable,decideMatch,placings,phaseAt,matchLabel,forfeits,coinFlip,threadAccess} from '../public/lib/arcana-cup.js';

const cup={id:9,votingAt:1000,roundMs:100,maxEntries:3,maxPerCategory:2};
let seed=1;const random=()=>(seed=(seed*16807)%2147483647)/2147483647;
const entries=n=>Array.from({length:n},(_,i)=>({id:`e${i}`,account:String(100+Math.floor(i/2))})); // pairs share an owner

test('seeding: next power of two, one bye per match at most, a player\'s two cards on opposite halves',()=>{
  for(const n of [2,3,5,8,9,13,16]){
    const list=entries(n),seeds=seedBracket(list,random);
    assert.equal(seeds.length,2**Math.ceil(Math.log2(n)));
    assert.deepEqual(seeds.filter(Boolean).sort(),list.map(e=>e.id).sort());
    for(let i=0;i<seeds.length;i+=2)assert.ok(seeds[i]||seeds[i+1],'no empty match');
    const half=seeds.length/2,side=id=>seeds.indexOf(id)<half?0:1;
    for(let i=0;i+1<n;i+=2)assert.notEqual(side(`e${i}`),side(`e${i+1}`),`owner of e${i} split`);
  }
  assert.throws(()=>seedBracket(entries(1)));
});

// Plays the bracket to the end: each closed round settles with votesFor(match) (voter -> card).
const play=(seeds,votesFor)=>{
  const results={};
  for(let t=cup.votingAt+cup.roundMs;t<=cup.votingAt+cup.roundMs*12;t+=cup.roundMs)
    for(const m of dueMatches(buildBracket(seeds,results,cup),t))results[m.id]=decideMatch(m,votesFor(m));
  return results;
};

test('double elimination: losers drop to the losers bracket, its winner meets the winners bracket\'s in the grand final',()=>{
  const seeds=['a','b','c','d'],won={'w0-0':'a','w0-1':'c','w1-0':'a','l0-0':'d','l1-0':'c',gf:'c'};
  let rounds=buildBracket(seeds,{},cup);
  assert.deepEqual(rounds.map(ms=>ms.map(m=>m.id)),[['w0-0','w0-1'],['w1-0','l0-0'],['l1-0'],['gf']]);
  assert.ok(isVotable(rounds[0][0],1050));assert.ok(!isVotable(rounds[0][0],1100));assert.ok(!isVotable(rounds[1][0],1050));
  assert.deepEqual(dueMatches(rounds,1099),[]);
  const results=play(seeds,m=>({v:won[m.id]}));
  rounds=buildBracket(seeds,results,cup);
  const at=id=>rounds.flat().find(m=>m.id===id);
  assert.deepEqual([at('l0-0').a,at('l0-0').b],['b','d']);
  assert.deepEqual([at('l1-0').a,at('l1-0').b],['d','c']);
  assert.deepEqual([at('gf').a,at('gf').b,at('gf').result.winner],['a','c','c']); // the losers bracket can win it
  assert.deepEqual(placings(rounds),['c','a','d','b']);
  assert.equal(phaseAt(1400,rounds,cup),'done');assert.equal(phaseAt(1150,buildBracket(seeds,{},cup),cup),'voting');
  assert.equal(phaseAt(999,null,cup),'entries');assert.equal(phaseAt(1000,null,cup),'cancelled');
  assert.equal(matchLabel(at('w1-0'),4),'Winners final');assert.equal(matchLabel(at('l1-0'),4),'Losers final');assert.equal(matchLabel(at('gf'),4),'Grand final');
});

test('every bracket size, byes included, finishes with everyone placed once',()=>{
  for(const n of [2,3,5,6,8,11,16]){
    const seeds=seedBracket(entries(n),random),k=Math.log2(seeds.length);
    const results=play(seeds,m=>m.a&&m.b?{v:random()<.5?m.a:m.b}:{});
    const rounds=buildBracket(seeds,results,cup);
    assert.equal(rounds.length,k===1?2:2*k,`rounds for ${n}`);
    assert.ok(rounds.flat().every(m=>m.result),`all settled for ${n}`);
    const order=placings(rounds);
    assert.deepEqual([...order].sort(),entries(n).map(e=>e.id).sort(),`placed once for ${n}`);
  }
});

test('ties go to more rarity ratings, then the match\'s coin flip, never the entry time',()=>{
  const m={id:'w0-0',a:'x',b:'y'};
  assert.equal(decideMatch(m,{v:'x',w:'y'},{x:{ratings:1},y:{ratings:3}}).winner,'y');
  const flip=coinFlip(m);
  assert.ok([m.a,m.b].includes(flip));
  // Entering earlier changes nothing: the same winner whichever card was first in.
  assert.equal(decideMatch(m,{},{x:{ratings:2,at:5},y:{ratings:2,at:3}}).winner,flip);
  assert.equal(decideMatch(m,{},{x:{ratings:2,at:3},y:{ratings:2,at:5}}).winner,flip);
  assert.equal(coinFlip({...m,a:'y',b:'x'}),flip); // the same coin whichever side a card is on
  const wins=new Set(Array.from({length:40},(_,i)=>coinFlip({id:`w0-${i}`,a:'x',b:'y'})));
  assert.equal(wins.size,2); // and it isn't always the same card
  assert.equal(decideMatch(m,{v:'x',w:'nope'}).winner,'x');
  assert.deepEqual(decideMatch(m,{v:'x'}).votes,{x:1,y:0});
});

test('Fav extending a round pushes that round and every later one back, and nothing earlier',()=>{
  const seeds=['a','b','c','d'],results={'w0-0':{winner:'a',loser:'b',votes:{}},'w0-1':{winner:'c',loser:'d',votes:{}}};
  const plain=buildBracket(seeds,results,cup),ext=buildBracket(seeds,results,{...cup,extend:{1:50}});
  assert.equal(ext[0][0].closesAt,plain[0][0].closesAt);                       // round 0 untouched
  assert.equal(ext[1][0].opensAt,plain[1][0].opensAt);                         // round 1 opens on time
  assert.equal(ext[1][0].closesAt,plain[1][0].closesAt+50);                    // and runs 50 longer
  assert.equal(ext[2][0].opensAt,plain[2][0].opensAt+50);                      // the next starts later
  assert.equal(ext[3][0].closesAt,plain[3][0].closesAt+50);
  assert.ok(isVotable(ext[1][0],plain[1][0].closesAt+10)&&!isVotable(plain[1][0],plain[1][0].closesAt+10));
});

test('a live thread opens after you vote; owners and Fav see it too; a settled one is open to all but read-only',()=>{
  const live={id:'w0-0',a:'x',b:'y',opensAt:1000,closesAt:1100,result:null},done={...live,result:{winner:'x',loser:'y',votes:{x:2,y:1}}};
  assert.deepEqual(threadAccess(live,1050),{read:false,write:false});
  assert.deepEqual(threadAccess(live,1050,{pick:'x'}),{read:true,write:true});
  assert.deepEqual(threadAccess(live,1050,{owner:true}),{read:true,write:true});
  assert.deepEqual(threadAccess(live,1050,{admin:true}),{read:true,write:true});
  assert.deepEqual(threadAccess(live,1100,{pick:'x'}),{read:true,write:false}); // the round has closed
  assert.deepEqual(threadAccess(done,1200),{read:true,write:false});
});

test('placings past 2nd: later losers rounds first, then votes in the lost match',()=>{
  // The alphabetically first card wins every match; d takes one vote losing its first losers-bracket match, h none.
  const results=play(['a','b','c','d','e','f','g','h'],m=>{const w=[m.a,m.b].filter(Boolean).sort()[0];return m.id==='l0-0'?{1:w,2:w,3:'d'}:{1:w};});
  const order=placings(buildBracket(['a','b','c','d','e','f','g','h'],results,cup));
  assert.equal(order[0],'a');assert.equal(order.length,8);
  assert.deepEqual(order.slice(-2),['d','h']);
});

test('a removed card forfeits its match',()=>{
  const m={a:'x',b:'y'};
  assert.equal(decideMatch(m,{v:'x',w:'x'},{x:{removed:true}}).winner,'y');
  assert.equal(decideMatch(m,{v:'y'},{y:{removed:true}}).loser,'y');
  assert.deepEqual(forfeits([[{id:'1',a:'x',b:'y',result:null},{id:'2',a:'x',b:null,result:null},{id:'3',a:'x',b:'z',result:null}]],{y:{removed:true}}).map(f=>f.id),['1']);
});

test('vault cup: two brackets, Fav removes entries, three strikes ends entering, prizes per bracket',async()=>{
  const {CosmeticsVault}=await import('../workers/steam-auth/src/cosmetics.js');
  const {DEFAULT_EQUIPMENT}=await import('../public/lib/cosmetics-catalog.js');
  const FAV=173365627;
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),delete:async k=>rows.delete(k),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage});let now=500,n=0;
  vault.cupConfig={id:1,name:'Arcana Cup',votingAt:1000,roundMs:100,maxEntries:3,maxPerCategory:2};vault.clock=()=>now;
  const as=async(account,body)=>{const r=await vault.fetch(new Request(`https://vault/action?account=${account}`,{method:'POST',body:JSON.stringify({requestId:`cup-request-${String(++n).padStart(6,'0')}`,...body})}));return {status:r.status,...await r.json()};};
  const cup=async()=>(await vault.fetch(new Request('https://vault/cup'))).json();
  const accounts=[401,402,403,404,405,406,407,FAV];
  for(const a of accounts)await as(a,{action:'session'});
  const style=async(a,hue,cardSlot=0)=>as(a,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue},cardSlot});
  assert.equal((await as(401,{action:'cup-enter',cardSlot:0,category:'artistic'})).status,400); // a plain card
  for(const [a,hue] of [[401,10],[402,20],[403,30],[404,60],[405,70],[406,80],[407,90]])await style(a,hue);
  await style(401,40,1);await style(401,50,2);await style(401,55,3);
  assert.equal((await as(401,{action:'cup-enter',cardSlot:0})).status,400); // no category
  assert.equal((await as(401,{action:'cup-enter',cardSlot:0,category:'serious'})).status,400);
  assert.equal((await as(401,{action:'cup-enter',cardSlot:0,category:'artistic'})).entry.id,'401-1');
  assert.equal((await as(401,{action:'cup-enter',cardSlot:0,category:'funny'})).status,400); // same design
  assert.equal((await as(401,{action:'cup-enter',cardSlot:1,category:'artistic'})).entry.id,'401-2');
  assert.equal((await as(401,{action:'cup-enter',cardSlot:2,category:'artistic'})).status,400); // two per category
  assert.equal((await as(401,{action:'cup-enter',cardSlot:2,category:'funny'})).entry.id,'401-3'); // the third goes in the other one
  assert.equal((await as(401,{action:'cup-enter',cardSlot:3,category:'funny'})).status,400); // three in all
  assert.equal((await as(401,{action:'cup-withdraw',entry:'401-3'})).removed,'401-3');
  assert.equal((await as(401,{action:'cup-withdraw',entry:'401-1'})).removed,'401-1');
  assert.equal((await as(401,{action:'cup-enter',cardSlot:2,category:'funny'})).entry.id,'401-1'); // 401: one artistic, one funny
  await as(402,{action:'cup-enter',cardSlot:0,category:'artistic'});await as(403,{action:'cup-enter',cardSlot:0,category:'artistic'});await as(405,{action:'cup-enter',cardSlot:0,category:'artistic'});
  await as(404,{action:'cup-enter',cardSlot:0,category:'funny'});
  // Fav removes troll entries; only Fav can; each removal is a strike; three strikes and they can't enter.
  await as(406,{action:'cup-enter',cardSlot:0,category:'artistic'});
  assert.equal((await as(402,{action:'cup-remove',entry:'406-1'})).status,400);
  assert.equal((await as(402,{action:'cup-all'})).status,403);
  assert.equal((await as(FAV,{action:'cup-all'})).entries.length,7);
  assert.equal((await as(FAV,{action:'cup-remove',entry:'406-1'})).strikes,1);
  assert.equal((await as(406,{action:'cup-mine'})).entries.length,0);
  for(let i=1;i<=3;i++){
    assert.equal((await as(407,{action:'cup-enter',cardSlot:0,category:'artistic'})).status,200);
    assert.equal((await as(FAV,{action:'cup-remove',entry:'407-1'})).strikes,i);
  }
  const blocked=await as(407,{action:'cup-enter',cardSlot:0,category:'artistic'});
  assert.equal(blocked.status,400);assert.match(blocked.error,/no longer enter/);
  assert.equal((await as(407,{action:'cup-mine'})).strikes,3);
  assert.equal((await as(406,{action:'cup-enter',cardSlot:0,category:'funny'})).status,200); // two strikes is not three
  await as(FAV,{action:'cup-remove',entry:'406-1'});
  let view=await cup();
  assert.equal(view.categories.artistic.phase,'entries');assert.equal(view.categories.artistic.count,4);assert.equal(view.categories.funny.count,2);
  assert.deepEqual(view.categories.artistic.entries,[]);
  now=1000;view=await cup();
  const art=view.categories.artistic,fun=view.categories.funny;
  assert.equal(art.phase,'voting');assert.equal(art.entries.length,4);assert.equal(fun.entries.length,2);
  assert.deepEqual(art.entries.map(e=>e.category),Array(4).fill('artistic'));
  const [m0,m1]=art.rounds[0],owner=id=>id.split('-')[0];
  assert.equal((await as(owner(m0.a),{action:'cup-vote',category:'artistic',match:m0.id,pick:m0.a})).status,400); // your own card
  assert.equal((await as(404,{action:'cup-vote',category:'funny',match:'w0-0',pick:m0.a})).status,400); // that card is not in the funny bracket
  assert.equal((await as(404,{action:'cup-vote',category:'artistic',match:m0.id,pick:m0.b})).mine,m0.b);
  assert.equal((await as(404,{action:'cup-vote',match:m0.id,pick:m0.b})).status,400); // no category
  assert.deepEqual((await as(404,{action:'cup-mine'})).votes,{[`artistic:${m0.id}`]:m0.b});
  // Threads: shut until you vote, and the vote count with them.
  const thread=(a,body={})=>as(a,{category:'artistic',match:m0.id,...body});
  assert.equal((await thread(406,{action:'cup-thread'})).locked,true);
  assert.equal((await thread(406,{action:'cup-comment',text:'first!'})).status,400); // not voted yet
  assert.equal((await thread(owner(m0.a),{action:'cup-thread'})).locked,undefined); // the owner sees it
  const opened=await thread(404,{action:'cup-thread'});
  assert.deepEqual([opened.canComment,opened.counts[m0.b],opened.counts[m0.a],opened.mine],[true,1,0,m0.b]);
  const said=await thread(404,{action:'cup-comment',text:'  Great   shading  '});
  assert.equal(said.status,200);assert.equal(said.comments[0].text,'Great shading');
  assert.equal((await thread(404,{action:'cup-comment',text:'again'})).status,400); // too soon
  assert.equal((await thread(404,{action:'cup-comment',text:''})).status,400);
  assert.equal((await thread(404,{action:'cup-comment',match:'w0-99',text:'x'})).status,400);
  assert.equal((await thread(406,{action:'cup-comment-delete',comment:said.comments[0].id})).status,400); // not yours
  assert.equal((await thread(406,{action:'cup-thread'})).count,1); // locked still, but the count shows
  assert.equal((await thread(404,{action:'cup-vote',pick:null})).mine,null); // take the vote back...
  assert.equal((await thread(404,{action:'cup-thread'})).locked,true); // ...and it closes again
  await thread(404,{action:'cup-vote',pick:m0.b});
  assert.equal((await thread(402,{action:'cup-extend',hours:5})).status,400); // only Fav
  assert.equal((await as(FAV,{action:'cup-extend',hours:0})).status,400);
  assert.equal((await as(FAV,{action:'cup-extend',hours:99})).status,400);
  assert.equal((await as(FAV,{action:'cup-comment-delete',category:'artistic',match:m0.id,comment:said.comments[0].id})).comments.length,0); // Fav can
  // Fav removing a card mid-voting forfeits its match at once, and the opponent moves on.
  await as(FAV,{action:'cup-remove',entry:m1.a});
  view=await cup();
  assert.equal(view.categories.artistic.rounds[0][1].result.winner,m1.b);
  assert.ok(view.categories.artistic.entries.find(e=>e.id===m1.a).removed);
  assert.equal((await as(owner(m1.a),{action:'cup-mine'})).strikes,1);
  now=2500;view=await cup();
  assert.equal(view.categories.artistic.phase,'done');assert.equal(view.categories.funny.phase,'done');
  assert.equal(view.categories.artistic.order.length,4);assert.equal(view.categories.funny.order.length,2);
  assert.ok(view.categories.artistic.rounds[0][0].result.votes[m0.b]>=1);
  // A settled thread is open to everyone, with the final count, and shut to new comments.
  const closed=await thread(406,{action:'cup-thread'});
  assert.equal(closed.locked,undefined);assert.equal(closed.canComment,false);assert.ok(closed.counts[m0.b]>=1);
  assert.equal((await thread(404,{action:'cup-comment',text:'too late'})).status,400);
  assert.equal((await as(FAV,{action:'cup-extend',hours:1})).status,400); // nothing is open any more
  assert.equal((await cup()).threadCounts.artistic[m0.id],0); // the comment Fav removed
  await cup(); // a second look sends nothing more
  const packs=[];for(const a of accounts)packs.push(...(await storage.get(`user:${a}`)).packs.filter(p=>!['common','screens'].includes(p)));
  assert.deepEqual(packs.sort(),['epic','epic','legendary','legendary','rare']); // artistic 1-3 (not the removed card), funny 1-2
  const artWinners=view.categories.artistic.order.filter(id=>id!==m1.a).slice(0,3).map(owner);
  assert.ok(!artWinners.includes(owner(m1.a))||view.categories.artistic.entries.some(e=>e.account===owner(m1.a)&&!e.removed));
});
