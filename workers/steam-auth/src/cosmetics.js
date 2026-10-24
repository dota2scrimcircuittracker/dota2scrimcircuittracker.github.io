import { grantLogin, applyPackGrants, rollPack, recycleCards, saveCardDesign, setCardPreferences, setCardName, setCardOrder, CARD_SLOTS, cardAppearance, cardDesignState, setNickname, shownNickname, setProfileBackground } from '../../../public/lib/cosmetics-engine.js';
import { designKey, castVote, tally } from '../../../public/lib/card-ratings.js';
import { DEFAULT_EQUIPMENT, itemByKey } from '../../../public/lib/cosmetics-catalog.js';
import { isAdmin, giftPacks, clearGifts, sendPack } from '../../../public/lib/pack-gifts.js';
import { claimAchievement, fantasyFacts } from '../../../public/lib/achievements.js';
import { checkImages } from './image-check.js';
import { isPostId, postOwner, toggleReaction, reactionTally, addComment, deleteComment, reactToComment, pushNotice, markNoticesSeen, cardPostId, FEED_PAGE, COMMENT_GAP, POST_GAP, MAX_IMAGES, MAX_IMAGE_BYTES, userPostId, buildUserPost, canRemovePost, feedAutoOf, setFeedAuto, pullPost, dedupePulls, setFollow, setBlock, setBan, isBanned, feedTypesOf, feedExcludesOf, feedShows, feedSortOf, feedRangeOf, FEED_RANGES, FEED_TYPES, postScore, sortFeed, castPollVote, pollTally } from '../../../public/lib/feed.js';
import { pingTargets, plainMentions } from '../../../public/lib/mentions.js';
import { CUP, PRIZES, CATEGORIES, MAX_STRIKES, categoryOf, entryId, seedBracket, buildBracket, dueMatches, forfeits, isVotable, decideMatch, placings, phaseAt, threadAccess } from '../../../public/lib/arcana-cup.js';

// A player's Fantasy entries from Firestore. The collection is public to read (firebase/scrimleague.rules),
// so no credentials: this asks for just their documents. Throws if Firestore can't be reached.
const FIRESTORE_DATA='https://firestore.googleapis.com/v1/projects/pistachio-kitchen/databases/(default)/documents/scrimLeague/data';
export async function firestoreWhere(collectionId,field,value,fetcher=fetch) {
  const r=await fetcher(`${FIRESTORE_DATA}:runQuery`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId}],where:{fieldFilter:{field:{fieldPath:field},op:'EQUAL',value}},limit:500}})});
  if(!r.ok)throw new Error('League data is unavailable. Try again shortly.');
  return (await r.json()).filter(row=>row.document).map(row=>row.document.fields??{});
}
export const fantasyEntries=async(account,fetcher=fetch)=>(await firestoreWhere('fantasy','account',{integerValue:String(account)},fetcher)).map(f=>({week:f.week?.stringValue}));
// Predictions and brackets made while signed in are saved under uid "steam:<account>" (lib/store.js).
export const madeCount=async(collectionId,account,fetcher=fetch)=>(await firestoreWhere(collectionId,'uid',{stringValue:`steam:${account}`},fetcher)).length;
const json=(value,status=200)=>Response.json(value,{status});
const secureRandom=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
// Feed post images arrive as base64; anything that doesn't decode is refused.
const decodeImage=b64=>{
  if(typeof b64!=='string'||b64.length>Math.ceil(MAX_IMAGE_BYTES/3)*4+8)throw new Error(`Each image must be under ${Math.round(MAX_IMAGE_BYTES/1024)} KB.`);
  let bin;try {bin=atob(b64);} catch {throw new Error('That image could not be read.');}
  return Uint8Array.from(bin,c=>c.charCodeAt(0));
};

// Restore pre-fix screen-pack openings once. Display failures were not reported to the
// server, so all old screen-only openings receive replacements; discoveries are preserved.
export function restoreScreenPacks(state, receipts, now=Date.now()) {
  if(state.screenPackRecovery==='images-v1')return state;
  const count=[...receipts.values()].filter(r=>r.action==='open'&&!r.openedAt&&r.result?.rewards?.length===0&&r.result?.screens?.length>0).length;
  return {...state,screenPackRecovery:'images-v1',packs:[...state.packs,...Array(count).fill('screens')],
    ...(count?{gifts:[...(state.gifts??[]),{kind:'pack',tier:'screens',count,note:'Replacement packs for the loading-screen display issue. Your collected screens are still yours.',at:now}].slice(-20)}:{})};
}

// The pull log: one row per opened pack that dealt an epic or legendary card, keyed by time.
const LOGGED=['epic','legendary'];
const pullRow=(account,openedAt,packType,rewards)=>{const items=(rewards??[]).map(r=>r.key).filter(k=>LOGGED.includes(itemByKey(k)?.rarity));return items.length?{account,at:openedAt,packType,items}:null;};
// A pack opened now posts what the player's auto-post settings let through (lib/feed.js pullPost).
const autoPullRow=(state,account,openedAt,packType,result)=>{const post=pullPost(result.rewards,result.screens,feedAutoOf(state),k=>itemByKey(k)?.rarity);return post&&{account,at:openedAt,packType,...post};};
const pullKey=(at,account,requestId)=>`pull:${String(at).padStart(15,'0')}:${account}:${requestId}`;
// The default card, as saved (saving adds hue 0): never posted or shown in the Gallery.
const PLAIN_DESIGN={...DEFAULT_EQUIPMENT,hue:0},PLAIN=designKey(PLAIN_DESIGN);
const isPlainDesign=design=>!design||designKey({...PLAIN_DESIGN,...design})===PLAIN;

// One serialized vault for this league. Inventory, receipts, daily grants and appearance
// writes commit together. Browser input never supplies drop odds, items or counts.
export class CosmeticsVault {
  constructor(ctx) {this.ctx=ctx;}
  // The Arcana Cup (lib/arcana-cup.js). Tests swap the cup's times and the clock.
  get cup() {return this.cupConfig??CUP;}
  now() {return this.clock?.()??Date.now();}
  async cupEntries(txn) {return [...(await txn.list({prefix:`cup:${this.cup.id}:entry:`})).values()];}
  // The Arcana Cup runs one double-elimination bracket per category (lib/arcana-cup.js CATEGORIES).
  // Each is seeded the first time anyone looks after entries close, settles every match that has
  // closed or has a removed card (in order, so winners fill the next round), and once the grand
  // final is settled sends 1st to 3rd of that bracket their packs. Fav's removed entries are kept
  // but forfeit, and never win a prize. Returns every category as everyone sees it.
  async cupSettle(txn,now=this.now()) {
    const out={},all=await this.cupEntries(txn);
    for(const category of Object.keys(CATEGORIES))out[category]=await this.cupSettleCategory(txn,now,category,all.filter(e=>e.category===category));
    return out;
  }
  async cupSettleCategory(txn,now,category,entries) {
    const cup={...this.cup,extend:await txn.get(`cup:${this.cup.id}:extend`)??{}},p=`cup:${cup.id}:${category}:`;
    if(now<cup.votingAt)return {entries,rounds:null,phase:'entries',order:null};
    let seeded=await txn.get(`${p}seeds`);
    if(!seeded){seeded={seeds:entries.length>=2?seedBracket(entries,secureRandom):null,at:now};await txn.put(`${p}seeds`,seeded);}
    if(!seeded.seeds)return {entries,rounds:null,phase:'cancelled',order:null};
    const info={};
    for(const e of entries)info[e.id]={at:e.at,removed:!!e.removed,ratings:tally(await txn.get(`votes:${e.account}:${e.key}`)).total};
    const results=await txn.get(`${p}results`)??{};
    let rounds=buildBracket(seeded.seeds,results,cup),due,changed=false;
    while((due=[...new Map([...dueMatches(rounds,now),...forfeits(rounds,info)].map(m=>[m.id,m])).values()]).length){
      for(const m of due)results[m.id]=decideMatch(m,await txn.get(`${p}votes:${m.id}`),info);
      changed=true;rounds=buildBracket(seeded.seeds,results,cup);
    }
    if(changed)await txn.put(`${p}results`,results);
    const order=placings(rounds,info);
    if(order&&!await txn.get(`${p}awarded`)) {
      const byId=new Map(entries.map(e=>[e.id,e]));
      const winners=order.map(id=>byId.get(id)).filter(e=>e&&!e.removed).slice(0,PRIZES.length);
      for(const [place,e] of winners.entries()){
        const key=`user:${e.account}`,state=await txn.get(key);
        if(state)await txn.put(key,giftPacks(state,{kind:'pack',tier:PRIZES[place],note:`${cup.name} ${CATEGORIES[category].name}: ${['1st','2nd','3rd'][place]} place`},now));
      }
      await txn.put(`${p}awarded`,now);
    }
    return {entries,rounds,phase:phaseAt(now,rounds,cup),order};
  }
  // One matchup, settled as of now, with who may read and write its thread (lib/arcana-cup.js threadAccess).
  async cupMatch(txn,now,category,matchId,account) {
    const view=(await this.cupSettle(txn,now))[category];
    const m=view.rounds?.flat().find(x=>x.id===matchId);
    if(!m||!m.a||!m.b)return null;
    const p=`cup:${this.cup.id}:${category}:`,votes=await txn.get(`${p}votes:${m.id}`)??{};
    const owner=view.entries.some(e=>(e.id===m.a||e.id===m.b)&&e.account===account);
    return {m,view,votes,pick:votes[account]??null,access:threadAccess(m,now,{pick:votes[account]??null,owner,admin:isAdmin(account)})};
  }
  // The pull log, filled once from the pack receipts opened before it existed.
  async backfillPulls() {
    if(await this.ctx.storage.get('pulls-backfilled'))return;
    const rows={};let after;
    for(;;) {
      const page=await this.ctx.storage.list({prefix:'receipt:',limit:256,...(after?{startAfter:after}:{})});
      for(const [k,r] of page) {
        if(r?.action!=='open'||!r.openedAt)continue;
        const [,acct,id]=k.split(':'),row=pullRow(acct,r.openedAt,r.packType,r.result?.rewards);
        if(row)rows[pullKey(r.openedAt,acct,id)]=row;
      }
      if(page.size<256)break;after=[...page.keys()].at(-1);
    }
    for(const [k,v] of Object.entries(rows))await this.ctx.storage.put(k,v);
    await this.ctx.storage.put('pulls-backfilled',true);
  }
  // Card posts for designs saved before the Feed existed: one per changed card, at its save time.
  async backfillPosts() {
    if(await this.ctx.storage.get('posts-backfilled'))return;
    for(const [k,state] of await this.ctx.storage.list({prefix:'user:',limit:5000})) {
      const account=k.slice(5),designs=cardDesignState(state).cardDesigns;
      for(let slot=0;slot<designs.length;slot++) {
        const design=designs[slot],at=state.cardSavedAt?.[slot];
        if(at&&!isPlainDesign(design))await this.ctx.storage.put(`post:c:${account}:${slot}:${at}`,{kind:'card',account,slot,design,at});
      }
    }
    await this.ctx.storage.put('posts-backfilled',true);
  }
  async postById(id,storage=this.ctx.storage) {
    if(id.startsWith('c:')||id.startsWith('u:')){const p=await storage.get(`post:${id}`);return p&&{id,...p};}
    const p=await storage.get(`pull:${id.slice(2)}`);return p&&{id,kind:'pull',...p};
  }
  // A Feed notice (lib/feed.js pushNotice) for a player who has a collection; others never signed in.
  async notify(txn,to,notice) {
    const toState=await txn.get(`user:${to}`);
    if(toState)await txn.put(`user:${to}`,pushNotice(toState,notice));
  }
  // What the achievements (lib/achievements.js) count, read from what the vault stores.
  async achievementFacts(txn,account,saved) {
    const posts=(await txn.list({prefix:`post:u:${account}:`})).size;
    let rated=0,legendaryVotes=0,comments=0;
    // Comments on other players' posts only, so commenting on your own can't farm it.
    for(const [k,list] of await txn.list({prefix:'comments:',limit:20000}))if(!k.startsWith(`comments:u:${account}:`))comments+=(list??[]).filter(c=>String(c.account)===String(account)&&!c.removed).length;
    for(const [k,v] of await txn.list({prefix:'votes:',limit:20000}))if(v?.[account]&&!k.startsWith(`votes:${account}:`))rated++;
    // Followers: other players whose own following list has this account.
    let followers=0;
    for(const [k,u] of await txn.list({prefix:'user:',limit:20000}))if(k!==`user:${account}`&&(u?.following??[]).includes(String(account)))followers++;
    for(const d of cardDesignState(saved).cardDesigns)if(d)legendaryVotes=Math.max(legendaryVotes,tally(await txn.get(`votes:${account}:${designKey(d)}`)).counts.legendary);
    return {...fantasyFacts(await fantasyEntries(account).catch(()=>null)),predictions:await madeCount('predictions',account).catch(()=>0),brackets:await madeCount('brackets',account).catch(()=>0),heroGrids:saved.achievementEvents?.heroGrid?1:0,packsSent:saved.packsSent??0,drafts:saved.achievementEvents?.draft?1:0,posts,comments,follows:(saved.following??[]).length,followers,rated,cards:(saved.cardDesigns??[]).filter(Boolean).length,legendaryVotes,nickname:saved.nickname?1:0,background:saved.profileBackground?1:0,signature:saved.profileBackground?.sig?1:0};
  }
  async fetch(req) {
    const url=new URL(req.url);
    if(url.pathname==='/appearances') {
      const rows=await this.ctx.storage.list({prefix:'appearance:',limit:5000});
      return json(Object.fromEntries([...rows].map(([k,v])=>[k.slice(11),v])));
    }
    // The gallery: every saved design anyone has changed from the default card, with its ratings.
    if(url.pathname==='/gallery') {
      const users=await this.ctx.storage.list({prefix:'user:',limit:5000});
      const votes=await this.ctx.storage.list({prefix:'votes:',limit:20000}), cards=[];
      for(const [k,state] of users) {
        const account=k.slice(5),prefs=cardDesignState(state);
        prefs.cardDesigns.forEach((design,slot)=>{
          if(isPlainDesign(design))return;
          const key=designKey(design);
          cards.push({account,slot,key,design,name:prefs.cardNames[slot],primary:slot===prefs.primaryCard,at:state.cardSavedAt?.[slot]??null,nickname:shownNickname(state),...tally(votes.get(`votes:${account}:${key}`))});
        });
      }
      return json({cards});
    }
    // The Arcana Cup for everyone: the bracket, settled results and placings. Other players'
    // entries stay hidden until entries close (only the count shows); live vote counts never show,
    // only each settled result's.
    if(url.pathname==='/cup') {
      const view=await this.ctx.storage.transaction(txn=>this.cupSettle(txn)),nicknames={},categories={};
      for(const [category,v] of Object.entries(view)) {
        const open=v.phase==='entries';
        categories[category]={phase:v.phase,count:v.entries.length,rounds:v.rounds,order:v.order,entries:open?[]:await Promise.all(v.entries.map(async e=>{
          nicknames[e.account]=shownNickname(await this.ctx.storage.get(`user:${e.account}`));
          return {...e,design:e.removed?null:e.design,...tally(await this.ctx.storage.get(`votes:${e.account}:${e.key}`))};
        }))};
      }
      // How many comments each matchup's thread has (never what they say or how the vote stands).
      const threadCounts={};
      for(const category of Object.keys(CATEGORIES)) {
        const pre=`cup:${this.cup.id}:${category}:thread:`;threadCounts[category]={};
        for(const [k,v] of await this.ctx.storage.list({prefix:pre}))threadCounts[category][k.slice(pre.length)]=(v??[]).filter(c=>!c.removed).length;
      }
      return json({cup:this.cup,categories,nicknames,threadCounts,serverNow:this.now()});
    }
    // The newest 150 epic and legendary pulls, with each puller's shown nickname. The first call
    // fills the log from the pack receipts opened before it existed.
    if(url.pathname==='/pulls') {
      await this.backfillPulls();
      const pulls=[...(await this.ctx.storage.list({prefix:'pull:'})).values()].sort((a,b)=>b.at-a.at).slice(0,150);
      const nicknames={};
      for(const a of new Set(pulls.map(p=>p.account)))nicknames[a]=shownNickname(await this.ctx.storage.get(`user:${a}`));
      return json({pulls:pulls.map(p=>({...p,nickname:nicknames[p.account]}))});
    }
    // A player post's image (lib/feed.js): ?post and ?n, served with the type its bytes showed.
    if(url.pathname==='/media') {
      const post=url.searchParams.get('post'),n=Number(url.searchParams.get('n'));
      const row=isPostId(post)&&post.startsWith('u:')&&Number.isInteger(n)&&n>=0&&n<MAX_IMAGES&&await this.ctx.storage.get(`media:${post}:${n}`);
      if(!row)return json({error:'Not found.'},404);
      return new Response(row.bytes,{headers:{'Content-Type':row.type}});
    }
    // A comment's picture: ?post and ?comment.
    if(url.pathname==='/cmedia') {
      const post=url.searchParams.get('post'),comment=url.searchParams.get('comment');
      const row=isPostId(post)&&post.startsWith('u:')&&/^[a-z0-9]+-\d{1,10}$/.test(comment??'')&&await this.ctx.storage.get(`cmedia:${post}:${comment}`);
      if(!row)return json({error:'Not found.'},404);
      return new Response(row.bytes,{headers:{'Content-Type':row.type}});
    }
    // The Feed (lib/feed.js): FEED_PAGE posts older than ?before, newest first, or the one ?post,
    // each with its reactions and comments, plus the shown nickname of everyone in them. ?account
    // keeps one player's posts (their profile's Feed tab). ?type keeps one kind (FEED_TYPES), and
    // ?sort=top or trending ranks by score (postScore), paged by ?offset instead of ?before.
    if(url.pathname==='/feed') {
      await this.backfillPulls();await this.backfillPosts();
      const one=url.searchParams.get('post'),before=Number(url.searchParams.get('before'))||Infinity,who=url.searchParams.get('account');
      const type=feedTypesOf(url.searchParams.get('type')),exclude=feedExcludesOf(url.searchParams.get('exclude')),sort=feedSortOf(url.searchParams.get('sort')),offset=Math.max(0,Math.floor(Number(url.searchParams.get('offset'))||0));
      if(who!=null&&!/^\d{1,10}$/.test(who))return json({error:'Invalid account.'},400);
      const from=url.searchParams.get('from')==null?null:new Set(url.searchParams.get('from').split(',').filter(a=>/^\d{1,10}$/.test(a)).slice(0,150));
      const range=feedRangeOf(url.searchParams.get('range')),pinId=await this.ctx.storage.get('feed-pin');
      let posts,pinned=null;
      if(one) {
        if(!isPostId(one))return json({error:'Choose a post.'},400);
        const p=await this.postById(one);posts=p?[p]:[];
      } else {
        const rows=who==null?[...await this.ctx.storage.list({prefix:'post:'})]:[...await this.ctx.storage.list({prefix:`post:c:${who}:`}),...await this.ctx.storage.list({prefix:`post:u:${who}:`})];
        const cards=rows.map(([k,v])=>({id:k.slice(5),...v}));
        const pulls=dedupePulls([...(await this.ctx.storage.list({prefix:'pull:'}))].map(([k,v])=>({id:`p:${k.slice(5)}`,kind:'pull',...v}))).filter(p=>who==null||String(p.account)===who);
        posts=[...cards,...pulls].filter(p=>feedShows(type,exclude,p));
        if(from)posts=posts.filter(p=>from.has(String(p.account)));
        // Fav's pinned post leads the first page of the whole Feed and is left out of the rest.
        if(pinId){
          if(who==null&&!from&&before===Infinity&&!offset){const p=await this.postById(pinId);if(p&&feedShows(type,exclude,p))pinned={...p,pinned:true};}
          if(who==null)posts=posts.filter(p=>p.id!==pinId);
        }
        if(sort==='top'&&range!=='all')posts=posts.filter(p=>p.at>=Date.now()-FEED_RANGES[range].ms);
        if(sort==='new')posts=posts.filter(p=>p.at<before).sort((a,b)=>b.at-a.at);
        else {
          const reacts=await this.ctx.storage.list({prefix:'react:'}),comments=await this.ctx.storage.list({prefix:'comments:'}),polls=await this.ctx.storage.list({prefix:'poll:'});
          for(const p of posts)p.score=postScore(reacts.get(`react:${p.id}`),comments.get(`comments:${p.id}`),polls.get(`poll:${p.id}`));
          posts=sortFeed(posts,sort,Date.now()).slice(offset);
        }
      }
      const more=posts.length>FEED_PAGE;posts=posts.slice(0,FEED_PAGE);
      if(pinned)posts.unshift(pinned);
      const nicknames={};
      for(const p of posts) {
        p.reactions=reactionTally(await this.ctx.storage.get(`react:${p.id}`));
        p.comments=await this.ctx.storage.get(`comments:${p.id}`)??[];
        if(p.poll)p.poll={...p.poll,votes:pollTally(await this.ctx.storage.get(`poll:${p.id}`),p.poll)};
        for(const a of [p.account,...p.comments.map(c=>c.account)])if(!(a in nicknames))nicknames[a]=shownNickname(await this.ctx.storage.get(`user:${a}`));
      }
      return json({posts,more,nicknames});
    }
    const account=url.searchParams.get('account');
    if(!/^\d{1,10}$/.test(account??'')) return json({error:'Invalid account.'},400);
    // Each saved design's ratings (lib/card-ratings.js), by the design's fingerprint.
    if(req.method==='GET' && url.pathname==='/ratings') {
      const state=await this.ctx.storage.get(`user:${account}`);
      const designs=state?cardDesignState(state).cardDesigns:[];
      const cards=await Promise.all(designs.map(async(design,slot)=>{
        if(!design)return null;
        const key=designKey(design);
        return {slot,key,...tally(await this.ctx.storage.get(`votes:${account}:${key}`))};
      }));
      return json({cards});
    }
    // Anyone's achievement progress, for their profile. Counting scans the whole vault, so each
    // account's answer is kept for 5 minutes.
    if(req.method==='GET' && url.pathname==='/achievements') {
      const cached=(this.achievementCache??=new Map()).get(account);
      if(cached&&cached.at>Date.now()-300000)return json(cached.value);
      const saved=await this.ctx.storage.get(`user:${account}`);
      const value=saved?{facts:await this.achievementFacts(this.ctx.storage,account,saved),claims:saved.achievementClaims??{}}:{facts:{},claims:{}};
      this.achievementCache.set(account,{at:Date.now(),value});
      return json(value);
    }
    if(req.method==='GET') {
      const state=await this.ctx.storage.get(`user:${account}`);
      // Followers: other players whose following list has this account (as in achievementFacts).
      let followers=0;
      for(const [k,u] of await this.ctx.storage.list({prefix:'user:',limit:20000}))if(k!==`user:${account}`&&(u?.following??[]).includes(String(account)))followers++;
      return json({followers,following:(state?.following??[]).length,inventory:state?.inventory??{},screens:state?.screens??[],achievements:state?.achievementClaims??{},equipment:state?.equipment??null,nickname:shownNickname(state),background:state?.profileBackground??null,...(state?cardDesignState(state):{})});
    }
    let body;try {body=await req.json();} catch {return json({error:'Invalid request.'},400);}
    // Which designs this player has rated, and how: "<owner>:<design key>" → rating. A read, so
    // no receipt.
    if(body.action==='my-votes') {
      const mine={};
      for(const [k,v] of await this.ctx.storage.list({prefix:'votes:',limit:20000}))if(v?.[account])mine[k.slice(6)]=v[account];
      return json({votes:mine});
    }
    // This player's Arcana Cup entries and their pick in each match. A read, so no receipt.
    if(body.action==='cup-mine') {
      const p=`cup:${this.cup.id}:`,votes={};
      for(const category of Object.keys(CATEGORIES))for(const [k,v] of await this.ctx.storage.list({prefix:`${p}${category}:votes:`}))if(v?.[account])votes[`${category}:${k.slice(`${p}${category}:votes:`.length)}`]=v[account];
      return json({entries:(await this.cupEntries(this.ctx.storage)).filter(e=>e.account===account&&!e.removed),votes,strikes:await this.ctx.storage.get(`${p}strikes:${account}`)??0,maxStrikes:MAX_STRIKES});
    }
    // A matchup's discussion thread. While the match is live it opens only once you have voted in it
    // (or own a card in it, or are Fav); then it also shows the live vote count. A read, so no receipt.
    if(body.action==='cup-thread') {
      const category=categoryOf(body.category);
      if(!category)return json({error:'Choose Artistic or Funny.'},400);
      const now=this.now(),found=await this.ctx.storage.transaction(txn=>this.cupMatch(txn,now,category,String(body.match??''),account));
      if(!found)return json({error:'That matchup is not in the bracket yet.'},400);
      const {m,votes,pick,access}=found,tk=`cup:${this.cup.id}:${category}:thread:${m.id}`,comments=await this.ctx.storage.get(tk)??[];
      if(!access.read)return json({locked:true,count:comments.filter(c=>!c.removed).length,live:isVotable(m,now),serverNow:now});
      const counts={[m.a]:0,[m.b]:0};
      if(m.result)Object.assign(counts,m.result.votes);else for(const v of Object.values(votes))if(v in counts)counts[v]++;
      const nicknames={};
      for(const a of new Set(comments.map(c=>c.account)))nicknames[a]=shownNickname(await this.ctx.storage.get(`user:${a}`));
      return json({comments,nicknames,counts,mine:pick,canComment:access.write,live:isVotable(m,now),serverNow:now});
    }
    // Fav's view of every entry, hidden or not, with each player's strikes. A read, so no receipt.
    if(body.action==='cup-all') {
      if(!isAdmin(account))return json({error:'Only Fav can review entries.'},403);
      const p=`cup:${this.cup.id}:strikes:`,strikes={},nicknames={},entries=await this.cupEntries(this.ctx.storage);
      for(const [k,v] of await this.ctx.storage.list({prefix:p}))strikes[k.slice(p.length)]=v;
      for(const a of new Set(entries.map(e=>e.account)))nicknames[a]=shownNickname(await this.ctx.storage.get(`user:${a}`));
      return json({entries,strikes,nicknames,maxStrikes:MAX_STRIKES});
    }
    // The facts behind this player's achievements. A read, so no receipt.
    if(body.action==='achievements') {
      const saved=await this.ctx.storage.get(`user:${account}`);
      if(!saved)return json({facts:{},claims:{}});
      return json({facts:await this.achievementFacts(this.ctx.storage,account,saved),claims:saved.achievementClaims??{}});
    }
    // Fav's list of players banned from the Feed (lib/feed.js setBan), with their shown nicknames.
    if(body.action==='feed-bans') {
      if(!isAdmin(account))return json({error:'Only Fav can see bans.'},403);
      const bans=await this.ctx.storage.get('feed-bans')??{},nicknames={};
      for(const a of Object.keys(bans))nicknames[a]=shownNickname(await this.ctx.storage.get(`user:${a}`));
      return json({bans,nicknames});
    }
    try {
      const result=await this.ctx.storage.transaction(async txn=>{
        const key=`user:${account}`, saved=await txn.get(key);
        if(body.action==='session') {
          let state=grantLogin(saved);
          if(state.screenPackRecovery!=='images-v1')state=restoreScreenPacks(state,await txn.list({prefix:`receipt:${account}:`}));
          state=applyPackGrants(state);await txn.put(key,state);return {state};
        }
        if(!saved) throw new Error('Load your collection first.');
        if(!/^[\w-]{16,80}$/.test(body.requestId??'')) throw new Error('Invalid request ID.');
        const receipt=`receipt:${account}:${body.requestId}`, old=await txn.get(receipt);
        if(old) {
          if(old.action!==body.action) throw new Error('Request ID already used.');
          // Feed receipts intentionally keep only the post id. On a safe retry, read the current
          // value back so the browser receives the same response shape as the original request.
          if(old.action==='react')return {...old.result,state:saved,reactions:reactionTally(await txn.get(`react:${old.result.post}`))};
          if(old.action==='post')return {state:saved,post:await this.postById(old.result.post,txn)};
          if(old.action==='post-delete')return {state:saved,removed:old.result.post};
          if(old.action==='poll-vote'){const p=await this.postById(old.result.post,txn);return {state:saved,post:old.result.post,votes:p?.poll?pollTally(await txn.get(`poll:${old.result.post}`),p.poll):[]};}
          if(['comment','comment-delete','comment-react'].includes(old.action))return {...old.result,state:saved,comments:await txn.get(`comments:${old.result.post}`)??[]};
          return {...old.result,state:saved};
        }
        let result;
        if(body.action==='open') result=rollPack(saved,body.packIndex,secureRandom);
        else if(body.action==='claim-bonus') {
          if(!['feedback','tour','discord'].includes(body.source)) throw new Error('Choose a valid pack offer.');
          const claims={...(saved.bonusPackClaims??{})};
          if(claims[body.source] || saved.bonusPackClaimed===body.source || saved.bonusPackClaimed===true) return {state:saved,source:body.source,alreadyClaimed:true};
          claims[body.source]=true;
          result={state:{...saved,packs:[...(saved.packs??[]),'common'],bonusPackClaims:claims},source:body.source};
        }
        // Something the browser did that the Worker can't see (lib/achievement-events.js). Only your own
        // account is credited, once each.
        else if(body.action==='record-event') {
          if(!['heroGrid','draft'].includes(body.event))throw new Error('Unknown event.');
          result={state:saved.achievementEvents?.[body.event]?saved:{...saved,achievementEvents:{...(saved.achievementEvents??{}),[body.event]:Date.now()}}};
        }
        else if(body.action==='claim-achievement')result={state:claimAchievement(saved,String(body.id??''),await this.achievementFacts(txn,account,saved)),id:String(body.id)};
        else if(body.action==='recycle') result=recycleCards(saved,body.selections);
        // cardSavedAt: when each card's design last changed (the Gallery's Newest sort).
        else if(body.action==='equip') {
          const slot=body.cardSlot??saved.primaryCard??0,before=cardDesignState(saved).cardDesigns[slot];
          const next=saveCardDesign(saved,body.equipment,body.cardSlot),savedAt=Array.from({length:CARD_SLOTS},(_,i)=>saved.cardSavedAt?.[i]??null);
          const design=next.cardDesigns[slot],changed=!before||designKey(before)!==designKey(design);
          let posts=Array.from({length:CARD_SLOTS},(_,i)=>saved.lastPosts?.[i]??null);
          if(changed) {
            const now=Date.now();savedAt[slot]=now;
            // A changed design goes in the Feed (lib/feed.js cardPostId), unless the player turned
            // card posts off.
            if(!isPlainDesign(design)&&feedAutoOf(saved).cards) {
              const lastId=posts[slot],last=lastId&&await txn.get(`post:${lastId}`);
              const id=cardPostId(account,slot,now,last&&{id:lastId,at:last.at});
              // Past the window the old post is replaced, with its reactions and comments.
              if(lastId&&id!==lastId) {
                for(const c of await txn.get(`comments:${lastId}`)??[])if(c.image)await txn.delete(`cmedia:${lastId}:${c.id}`);
                for(const k of [`post:${lastId}`,`react:${lastId}`,`comments:${lastId}`])await txn.delete(k);
                if(await txn.get('feed-pin')===lastId)await txn.delete('feed-pin');
              }
              await txn.put(`post:${id}`,{kind:'card',account,slot,design,at:now});
              posts=posts.map((p,i)=>i===slot?id:p);
            }
          }
          result={state:{...next,cardSavedAt:savedAt,lastPosts:posts}};
        }
        else if(body.action==='card-settings')result={state:setCardPreferences(saved,body)};
        else if(body.action==='card-name')result={state:setCardName(saved,body.cardSlot,body.name)};
        else if(body.action==='card-order')result={state:setCardOrder(saved,body.order)};
        else if(body.action==='nickname')result={state:setNickname(saved,body)};
        else if(body.action==='profile-background')result={state:setProfileBackground(saved,body)};
        else if(body.action==='gift') {
          // Fav only: packs, card items or a loading screen into another player's collection, with a
          // notice they see next visit.
          if(!isAdmin(account))throw new Error('Only Fav can gift packs.');
          const target=String(body.target??'');
          if(!/^\d{1,10}$/.test(target))throw new Error('Choose a player.');
          const targetKey=`user:${target}`,given=giftPacks((target===account?saved:await txn.get(targetKey))??grantLogin(null),body);
          if(target===account)result={state:given,gift:{target,kind:body.kind??'pack',tier:body.tier,item:body.item,count:body.count}};
          else {await txn.put(targetKey,given);result={state:saved,gift:{target,kind:body.kind??'pack',tier:body.tier,item:body.item,count:body.count}};}
        }
        // A player sending another a pack from their own inventory (lib/pack-gifts.js sendPack).
        else if(body.action==='send-pack') {
          const target=String(body.target??'');
          if(!/^\d{1,10}$/.test(target))throw new Error('Choose a player.');
          if(target===account)throw new Error("You can't send a pack to yourself.");
          const to=await txn.get(`user:${target}`);
          if(!to)throw new Error("That player hasn't connected Steam yet.");
          const sent=sendPack(grantLogin(saved),to,{index:body.packIndex,from:account,fromName:shownNickname(saved),note:body.note});
          await txn.put(`user:${target}`,sent.recipient);
          result={state:sent.sender,sent:{target,pack:sent.pack}};
        }
        else if(body.action==='gifts-seen')result={state:clearGifts(saved)};
        // The Feed (lib/feed.js): reactions and comments on any post, replies and reactions on its
        // comments; a comment notifies the post's owner, a reply the comment's writer.
        else if(['react','comment','comment-delete','comment-react'].includes(body.action)) {
          const post=String(body.post??''),owner=postOwner(post);
          const kind=body.action==='comment'?'comment':'react';
          if(body.action!=='comment-delete'&&isBanned(await txn.get('feed-bans'),account,Date.now(),kind))throw new Error(kind==='comment'?'Fav has banned you from commenting.':'Fav has banned you from reacting.');
          if(!await this.postById(post,txn))throw new Error('That post is gone.');
          if(body.action==='react') {
            const reactions=toggleReaction(await txn.get(`react:${post}`),account,body.emoji);
            await txn.put(`react:${post}`,reactions);
            result={state:saved,post,reactions:reactionTally(reactions)};
          } else if(body.action==='comment') {
            const now=Date.now();
            if(now-(saved.lastCommentAt??0)<COMMENT_GAP)throw new Error('Wait a moment before commenting again.');
            const image=body.image==null?null:decodeImage(body.image);
            const before=await txn.get(`comments:${post}`);
            const {comments,comment,parent}=addComment(before,{account,text:body.text,at:now,reply:body.reply,image});
            await txn.put(`comments:${post}`,comments);
            if(image)await txn.put(`cmedia:${post}:${comment.id}`,{type:comment.image.type,bytes:image});
            // The oldest comments fall off the end of the list; their pictures go with them.
            for(const gone of (before??[]).filter(c=>c.image&&!comments.some(x=>x.id===c.id)))await txn.delete(`cmedia:${post}:${gone.id}`);
            const notify=(to,kind)=>this.notify(txn,to,{kind,post,from:account,fromName:shownNickname(saved),text:plainMentions(comment.text).slice(0,120),at:now});
            if(parent&&parent.account!==account)await notify(parent.account,'reply');
            if(owner!==account&&owner!==parent?.account)await notify(owner,'comment');
            // @mentions (lib/mentions.js): anyone not already told above.
            for(const to of pingTargets(comment.text,body.mentions,account))if(to!==parent?.account&&to!==owner)await notify(to,'mention');
            result={state:{...saved,lastCommentAt:now},post,comments};
          } else if(body.action==='comment-react') {
            const comments=reactToComment(await txn.get(`comments:${post}`),String(body.comment??''),account,body.emoji);
            await txn.put(`comments:${post}`,comments);
            result={state:saved,post,comments};
          } else {
            const before=await txn.get(`comments:${post}`);
            const comments=deleteComment(before,String(body.comment??''),account,{owner,admin:isAdmin(account)});
            await txn.put(`comments:${post}`,comments);
            for(const gone of before.filter(c=>c.image&&!comments.find(x=>x.id===c.id)?.image))await txn.delete(`cmedia:${post}:${gone.id}`);
            result={state:saved,post,comments};
          }
        }
        // A player's own Feed post: text, images, a clip link and a highlighted game (lib/feed.js).
        else if(body.action==='post') {
          const now=Date.now();
          if(isBanned(await txn.get('feed-bans'),account,now,'post'))throw new Error('Fav has banned you from posting.');
          if(now-(saved.lastPostAt??0)<POST_GAP)throw new Error('Wait a moment before posting again.');
          if(!Array.isArray(body.images??[]))throw new Error('Choose images to add.');
          const images=(body.images??[]).slice(0,MAX_IMAGES+1).map(decodeImage),id=userPostId(account,now);
          const post=buildUserPost({account,at:now,text:body.text,clip:body.clip,game:body.game,images,poll:body.poll??null});
          await txn.put(`post:${id}`,post);
          for(let i=0;i<images.length;i++)await txn.put(`media:${id}:${i}`,{type:post.images[i].type,bytes:images[i]});
          for(const to of pingTargets(post.text,body.mentions,account))await this.notify(txn,to,{kind:'mention',post:id,from:account,fromName:shownNickname(saved),text:plainMentions(post.text).slice(0,120),at:now});
          result={state:{...saved,lastPostAt:now},post:{id,...post,...(post.poll?{poll:{...post.poll,votes:pollTally({},post.poll)}}:{}),reactions:{},comments:[]}};
        }
        // A vote on a poll post (lib/feed.js castPollVote): one choice each, changeable until it
        // ends. Banned from reacting means banned from voting.
        else if(body.action==='poll-vote') {
          const post=String(body.post??''),now=Date.now();
          if(!isPostId(post)||!post.startsWith('u:'))throw new Error('Choose a poll.');
          if(isBanned(await txn.get('feed-bans'),account,now,'react'))throw new Error('Fav has banned you from voting.');
          const stored=await txn.get(`post:${post}`);
          if(!stored)throw new Error('That post is gone.');
          const votes=castPollVote(await txn.get(`poll:${post}`),account,body.option??null,stored.poll,now);
          await txn.put(`poll:${post}`,votes);
          result={state:saved,post,votes:pollTally(votes,stored.poll)};
        }
        // The poster removes their post; Fav removes any (a saved card's or a pull's too), with its
        // images, reactions and comments.
        else if(body.action==='post-delete') {
          const post=String(body.post??'');
          if(!canRemovePost(post,account,isAdmin(account)))throw new Error('Only the poster can remove this post.');
          const stored=await this.postById(post,txn),row=post.startsWith('p:')?`pull:${post.slice(2)}`:`post:${post}`;
          if(!stored)throw new Error('That post is gone.');
          for(let i=0;i<(stored.images?.length??0);i++)await txn.delete(`media:${post}:${i}`);
          for(const c of await txn.get(`comments:${post}`)??[])if(c.image)await txn.delete(`cmedia:${post}:${c.id}`);
          for(const k of [row,`react:${post}`,`comments:${post}`,`poll:${post}`])await txn.delete(k);
          if(await txn.get('feed-pin')===post)await txn.delete('feed-pin');
          result={state:saved,removed:post};
        }
        // Fav pins one post to the top of the Feed, or unpins it (body.pinned false).
        else if(body.action==='post-pin') {
          if(!isAdmin(account))throw new Error('Only Fav can pin posts.');
          const post=String(body.post??'');
          if(!isPostId(post))throw new Error('Choose a post.');
          if(body.pinned===false){if(await txn.get('feed-pin')===post)await txn.delete('feed-pin');}
          else{if(!await this.postById(post,txn))throw new Error('That post is gone.');await txn.put('feed-pin',post);}
          result={state:saved,post};
        }
        // Fav sends a post (a poll, an update) to every player's notices. Pressing it again on the
        // same post replaces the earlier one instead of stacking.
        else if(body.action==='post-notify') {
          if(!isAdmin(account))throw new Error('Only Fav can notify players.');
          const post=String(body.post??'');
          if(!isPostId(post))throw new Error('Choose a post.');
          const stored=await this.postById(post,txn);
          if(!stored)throw new Error('That post is gone.');
          const text=String(body.text??'').trim().slice(0,120)||plainMentions(stored.text??'').slice(0,120)||'New from Fav',now=Date.now();
          const notice={kind:'announce',post,from:account,fromName:'Fav',text,at:now};
          let sent=0;
          for(const [k,state] of await txn.list({prefix:'user:',limit:5000})) {
            if(k.slice(5)===account)continue;
            const kept={...state,notices:(state.notices??[]).filter(n=>!(n.kind==='announce'&&n.post===post))};
            await txn.put(k,pushNotice(kept,notice));sent++;
          }
          result={state:saved,post,sent};
        }
        // Fav bans a player from posting, commenting or reacting (body.scope, all three when left
        // out), for some days or until lifted.
        else if(body.action==='ban') {
          if(!isAdmin(account))throw new Error('Only Fav can ban players.');
          if(String(body.target)===account)throw new Error("You can't ban yourself.");
          const days=body.days==null?null:Number(body.days);
          if(days!=null&&!(Number.isInteger(days)&&days>0&&days<=365))throw new Error('Choose 1 to 365 days.');
          const bans=setBan(await txn.get('feed-bans'),body.target,body.banned!==false,{at:Date.now(),days,...(body.scope==null?{}:{scope:body.scope})});
          await txn.put('feed-bans',bans);
          result={state:saved,bans};
        }
        else if(body.action==='follow')result={state:setFollow(saved,account,body.target,body.follow!==false)};
        else if(body.action==='block')result={state:setBlock(saved,account,body.target,body.block!==false)};
        else if(body.action==='feed-auto')result={state:setFeedAuto(saved,body)};
        else if(body.action==='notices-seen')result={state:markNoticesSeen(saved,Date.now())};
        else if(body.action==='rate') {
          // One vote per voter per design, never your own; the design is read here, not sent.
          const target=String(body.target??'');
          if(!/^\d{1,10}$/.test(target))throw new Error('Choose a player card.');
          if(target===account)throw new Error("Rate other players' cards, not your own.");
          if(!Number.isInteger(body.cardSlot)||body.cardSlot<0||body.cardSlot>2)throw new Error('Choose one of their cards.');
          const owner=await txn.get(`user:${target}`),design=owner&&cardDesignState(owner).cardDesigns[body.cardSlot];
          if(!design)throw new Error('That card has no saved design.');
          const key=designKey(design),votesKey=`votes:${target}:${key}`;
          const votes=castVote(await txn.get(votesKey),account,body.rating??null);
          await txn.put(votesKey,votes);
          result={state:saved,rating:{slot:body.cardSlot,key,mine:votes[account]??null,...tally(votes)}};
        }
        else if(body.action==='cup-enter') {
          // One of your saved cards, copied as it is now, into Artistic or Funny. Up to two in all,
          // different designs, until entries close; three removals by Fav and you can't enter.
          const cup=this.cup,category=categoryOf(body.category);
          if(this.now()>=cup.votingAt)throw new Error('Entries are closed.');
          if(!category)throw new Error('Choose Artistic or Funny.');
          if(!Number.isInteger(body.cardSlot)||body.cardSlot<0||body.cardSlot>=CARD_SLOTS)throw new Error('Choose one of your cards.');
          if((await txn.get(`cup:${cup.id}:strikes:${account}`)??0)>=MAX_STRIKES)throw new Error('Fav removed too many of your entries, so you can no longer enter the cup.');
          const prefs=cardDesignState(saved),design=prefs.cardDesigns[body.cardSlot];
          if(isPlainDesign(design))throw new Error('Customize this card before entering it.');
          const every=(await this.cupEntries(txn)).filter(e=>e.account===account),mine=every.filter(e=>!e.removed),key=designKey(design);
          if(mine.length>=cup.maxEntries)throw new Error(`You can enter ${cup.maxEntries} cards. Withdraw one to enter another.`);
          if(mine.some(e=>e.key===key))throw new Error("You have already entered this design.");
          const n=[1,2,3,4,5].find(i=>!every.some(e=>e.id===entryId(account,i)));
          const entry={id:entryId(account,n),account,category,slot:body.cardSlot,name:prefs.cardNames[body.cardSlot]??null,design,key,at:this.now()};
          await txn.put(`cup:${cup.id}:entry:${entry.id}`,entry);
          result={state:saved,entry};
        }
        else if(body.action==='cup-withdraw') {
          const k=`cup:${this.cup.id}:entry:${String(body.entry??'')}`,entry=await txn.get(k);
          if(!entry||entry.account!==account||entry.removed)throw new Error('Choose one of your entries.');
          if(this.now()>=this.cup.votingAt)throw new Error('Entries are closed, so entries stay in.');
          await txn.delete(k);
          result={state:saved,removed:entry.id};
        }
        else if(body.action==='cup-remove') {
          // Fav's call, any time. Before voting the entry is deleted; once voting has started it
          // stays in the bracket as a forfeit. Either way it is a strike against its owner.
          if(!isAdmin(account))throw new Error('Only Fav can remove entries.');
          const k=`cup:${this.cup.id}:entry:${String(body.entry??'')}`,entry=await txn.get(k);
          if(!entry||entry.removed)throw new Error('Choose an entry that is still in.');
          if(this.now()<this.cup.votingAt)await txn.delete(k);else await txn.put(k,{...entry,removed:this.now()});
          const sk=`cup:${this.cup.id}:strikes:${entry.account}`,strikes=(await txn.get(sk)??0)+1;
          await txn.put(sk,strikes);
          result={state:saved,removed:entry.id,owner:entry.account,strikes};
        }
        else if(body.action==='cup-vote') {
          // One pick per voter per match, changeable while it is open; null takes it back.
          const now=this.now(),category=categoryOf(body.category);
          if(!category)throw new Error('Choose Artistic or Funny.');
          const view=(await this.cupSettle(txn,now))[category];
          const m=view.rounds?.flat().find(x=>x.id===body.match);
          if(!m||!isVotable(m,now))throw new Error('That matchup is not open for votes.');
          if(view.entries.some(e=>(e.id===m.a||e.id===m.b)&&e.account===account))throw new Error("You can't vote in a matchup with your card in it.");
          const pick=body.pick??null;
          if(pick!=null&&pick!==m.a&&pick!==m.b)throw new Error('Pick one of the two cards.');
          const k=`cup:${this.cup.id}:${category}:votes:${m.id}`,votes={...(await txn.get(k)??{})};
          if(pick==null)delete votes[account];else votes[account]=pick;
          await txn.put(k,votes);
          result={state:saved,match:m.id,mine:pick};
        }
        else if(body.action==='cup-comment') {
          // One line in a live matchup's thread, once you have voted in it (lib/arcana-cup.js threadAccess).
          const now=this.now(),category=categoryOf(body.category);
          if(!category)throw new Error('Choose Artistic or Funny.');
          if(isBanned(await txn.get('feed-bans'),account,Date.now(),'comment'))throw new Error('Fav has banned you from commenting.');
          const found=await this.cupMatch(txn,now,category,String(body.match??''),account);
          if(!found)throw new Error('That matchup is not open.');
          if(!isVotable(found.m,now))throw new Error('This matchup is closed, so its thread is read-only.');
          if(!found.access.write)throw new Error('Vote in this matchup to join its thread.');
          if(Date.now()-(saved.lastCommentAt??0)<COMMENT_GAP)throw new Error('Wait a moment before commenting again.');
          const tk=`cup:${this.cup.id}:${category}:thread:${found.m.id}`,{comments}=addComment(await txn.get(tk),{account,text:body.text,at:Date.now(),reply:body.reply});
          await txn.put(tk,comments);
          result={state:{...saved,lastCommentAt:Date.now()},match:found.m.id,comments};
        }
        else if(body.action==='cup-comment-delete') {
          // The writer or Fav; a comment with replies stays as a "removed" placeholder.
          const category=categoryOf(body.category),found=category&&await this.cupMatch(txn,this.now(),category,String(body.match??''),account);
          if(!found)throw new Error('That matchup is not in the bracket.');
          const tk=`cup:${this.cup.id}:${category}:thread:${found.m.id}`,comments=deleteComment(await txn.get(tk),String(body.comment??''),account,{owner:null,admin:isAdmin(account)});
          await txn.put(tk,comments);
          result={state:saved,match:found.m.id,comments};
        }
        else if(body.action==='cup-extend') {
          // Fav gives the round that is open now more time (1 to 72 hours), for every bracket at once.
          // Later rounds move back by the same amount.
          if(!isAdmin(account))throw new Error('Only Fav can extend a round.');
          const hours=Number(body.hours);
          if(!(Number.isInteger(hours)&&hours>=1&&hours<=72))throw new Error('Choose 1 to 72 hours.');
          const now=this.now(),views=await this.cupSettle(txn,now),open=Object.values(views).flatMap(v=>v.rounds?.flat()??[]).find(m=>isVotable(m,now));
          if(!open)throw new Error('No round is open right now.');
          const ek=`cup:${this.cup.id}:extend`,extend={...(await txn.get(ek)??{})};
          extend[open.step]=(extend[open.step]??0)+hours*36e5;
          await txn.put(ek,extend);
          result={state:saved,step:open.step,extend};
        }
        else if(body.action==='cup-rate') {
          // Rating an entry is rating its design: the same votes as the Gallery and profiles.
          if(this.now()<this.cup.votingAt)throw new Error('Entries can be rated once voting starts.');
          const entry=await txn.get(`cup:${this.cup.id}:entry:${String(body.entry??'')}`);
          if(!entry)throw new Error('Choose a card in the cup.');
          if(entry.account===account)throw new Error("Rate other players' cards, not your own.");
          const votesKey=`votes:${entry.account}:${entry.key}`,votes=castVote(await txn.get(votesKey),account,body.rating??null);
          await txn.put(votesKey,votes);
          result={state:saved,rating:{slot:entry.slot,key:entry.key,mine:votes[account]??null,...tally(votes)}};
        }
        else throw new Error('Unknown collection action.');
        await txn.put(key,result.state);
        if(['equip','card-settings','nickname'].includes(body.action)) await txn.put(`appearance:${account}`,cardAppearance(result.state));
        const openedAt=Date.now();
        // Feed receipts keep only the post: its comments can be long and are read fresh anyway.
        await txn.put(receipt,{action:body.action,result:['react','comment','comment-delete','comment-react','poll-vote'].includes(body.action)?{post:result.post}:body.action==='post'?{post:result.post.id}:body.action==='post-delete'?{post:result.removed}:result,...(body.action==='open'?{openedAt,packType:saved.packs[body.packIndex]}:{})});
        const pull=body.action==='open'&&autoPullRow(saved,account,openedAt,saved.packs[body.packIndex],result);
        if(pull)await txn.put(pullKey(openedAt,account,body.requestId),pull);
        return result;
      });
      return json({...result,serverNow:Date.now()});
    } catch(e) {return json({error:e.message},400);}
  }
}

export async function cosmeticsRequest(req,env,allowedOrigins) {
  const origin=req.headers.get('origin'), url=new URL(req.url);
  if(origin && !allowedOrigins.includes(origin)) return json({error:'Unknown origin.'},403);
  const headers={'Access-Control-Allow-Origin':origin??allowedOrigins[0],'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Cache-Control':'no-store'};
  const respond=r=>new Response(r.body,{status:r.status,headers:{...Object.fromEntries(r.headers),...headers}});
  if(req.method==='OPTIONS') return respond(new Response(null,{status:204}));
  if(!env.COSMETICS) return respond(json({error:'The collection service is not configured yet.'},503));
  const vault=env.COSMETICS.get(env.COSMETICS.idFromName('league-v1'));
  if(req.method==='GET' && url.pathname==='/cosmetics/appearances') return respond(await vault.fetch('https://vault/appearances'));
  if(req.method==='GET' && url.pathname==='/cosmetics/gallery') return respond(await vault.fetch('https://vault/gallery'));
  if(req.method==='GET' && url.pathname==='/cosmetics/cup') return respond(await vault.fetch('https://vault/cup'));
  if(req.method==='GET' && url.pathname==='/cosmetics/pulls') return respond(await vault.fetch('https://vault/pulls'));
  if(req.method==='GET' && url.pathname==='/cosmetics/feed') return respond(await vault.fetch(`https://vault/feed${url.search}`));
  // Feed post images: served as stored, cached for good (a post's images never change), and
  // sandboxed so a file can never run as a page.
  const media=/^\/cosmetics\/media\/(u:\d{1,10}:\d{1,15})\/(\d)$/.exec(url.pathname.replace(/%3A/gi,':'));
  if(req.method==='GET' && media) {
    const r=await vault.fetch(`https://vault/media?post=${encodeURIComponent(media[1])}&n=${media[2]}`);
    return new Response(r.body,{status:r.status,headers:{'Content-Type':r.headers.get('content-type'),'Access-Control-Allow-Origin':'*','Cache-Control':r.ok?'public, max-age=31536000, immutable':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }
  const cmedia=/^\/cosmetics\/cmedia\/(u:\d{1,10}:\d{1,15})\/([a-z0-9]+-\d{1,10})$/.exec(url.pathname.replace(/%3A/gi,':'));
  if(req.method==='GET' && cmedia) {
    const r=await vault.fetch(`https://vault/cmedia?post=${encodeURIComponent(cmedia[1])}&comment=${cmedia[2]}`);
    return new Response(r.body,{status:r.status,headers:{'Content-Type':r.headers.get('content-type'),'Access-Control-Allow-Origin':'*','Cache-Control':r.ok?'public, max-age=31536000, immutable':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }
  const publicAccount=/^\/cosmetics\/collection\/(\d{1,10})$/.exec(url.pathname)?.[1];
  if(req.method==='GET' && publicAccount) return respond(await vault.fetch(`https://vault/collection?account=${publicAccount}`));
  const achAccount=/^\/cosmetics\/achievements\/(\d{1,10})$/.exec(url.pathname)?.[1];
  if(req.method==='GET' && achAccount) return respond(await vault.fetch(`https://vault/achievements?account=${achAccount}`));
  const ratedAccount=/^\/cosmetics\/ratings\/(\d{1,10})$/.exec(url.pathname)?.[1];
  if(req.method==='GET' && ratedAccount) return respond(await vault.fetch(`https://vault/ratings?account=${ratedAccount}`));
  // Feed posts carry images, so they go to their own path with a larger size limit.
  const limit=url.pathname==='/cosmetics/post'?Math.ceil(MAX_IMAGES*MAX_IMAGE_BYTES*4/3)+16000:12000;
  if(req.method!=='POST' || !['/cosmetics','/cosmetics/post'].includes(url.pathname)) return respond(json({error:'Not found.'},404));
  if(!env.FIREBASE_WEB_API_KEY) return respond(json({error:'Collection authentication is not configured yet.'},503));
  const token=/^Bearer (.+)$/.exec(req.headers.get('authorization')??'')?.[1];
  if(!token) return respond(json({error:'Sign in with Steam first.'},401));
  try {
    // The site's Firebase web key requires an allowed HTTP referrer. Use only the
    // origin validated above; the Firebase ID token still verifies account identity.
    const verification=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/json','Referer':`${origin??allowedOrigins[0]}/`},body:JSON.stringify({idToken:token})});
    const data=await verification.json(), user=data.users?.[0];
    if(!verification.ok && !['INVALID_ID_TOKEN','TOKEN_EXPIRED','USER_DISABLED','USER_NOT_FOUND'].includes(data.error?.message)) return respond(json({error:'Collection authentication is temporarily unavailable. Please try again.'},503));
    const account=/^steam:(\d{1,10})$/.exec(user?.localId??'')?.[1];
    if(!verification.ok || !account || user.disabled) return respond(json({error:'Your Steam session expired. Sign in again.'},401));
    if(Number(req.headers.get('content-length')??0)>limit) return respond(json({error:'Request too large.'},413));
    const body=await req.text();if(body.length>limit) return respond(json({error:'Request too large.'},413));
    // Images are checked by the AI filter (image-check.js) before the vault sees the post.
    // Anything carrying a picture (a post, or a comment with an image) must come through
    // /cosmetics/post, so it can't reach the vault from /cosmetics without being checked.
    let parsed;try {parsed=JSON.parse(body);} catch {parsed=null;}
    const hasImages=parsed?.action==='post'||(parsed?.action==='comment'&&parsed.image!=null);
    if(hasImages && url.pathname!=='/cosmetics/post') return respond(json({error:'Invalid request.'},400));
    if(url.pathname==='/cosmetics/post') {
      if(!['post','comment'].includes(parsed?.action)) return respond(json({error:'Invalid request.'},400));
      const images=parsed.action==='comment'?(typeof parsed.image==='string'?[parsed.image]:[]):parsed.images;
      try {await checkImages(env.AI,Array.isArray(images)?images.slice(0,MAX_IMAGES):[]);} catch(e) {return respond(json({error:e.message},400));}
    }
    return respond(await vault.fetch(new Request(`https://vault/action?account=${account}`,{method:'POST',headers:{'Content-Type':'application/json'},body})));
  } catch {return respond(json({error:'The collection service is temporarily unavailable.'},503));}
}
