// ?wave3=1 on the Gallery, loopback only: every November 3 wave item on a real card, grouped by slot and rarity,
// for Fav to review. Nothing is saved. Borders show with no finish, finishes on the default border, signatures and
// modifiers on the default border with no finish. The items also drop and equip as normal on loopback.
import {DEFAULT_EQUIPMENT,TIERS} from './cosmetics-catalog.js';
import {WAVE3_CATALOG} from './cosmetics-wave-catalog.js';
import {applyEquipment} from './cosmetics.js';
import {renderedName} from './signatures.js';
import {createPlayerCards,PAINT_FILTER} from '../parts/player-card.js';
import {esc} from '../core.js';

const HEROES=[74,8,11,5,110,126,29,113,91,6];
const SLOTS=[['border','Borders','No finish, gold-ink signature.'],['finish','Finishes','Default border, gold-ink signature.'],['autograph','Signatures','Default border, no finish. Signatures start at Rare, so there are three tiers here.'],['translation','Modifiers','Gold-ink signature with the modifier applied. Rough transliterations: check with a native reader before release.']];
const VOTES=[['approve','Approve'],['tweak','Needs work'],['cut','Cut']];
const VOTE_KEY='ad2l-wave3-votes-v1';
const COLORS={common:'#b0c3d9',rare:'#4b69ff',epic:'#8847ff',legendary:'#d32ce6'};

export function localWave3Review(){
 if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname)||new URLSearchParams(location.search).get('wave3')!=='1')return null;
 const renderer=createPlayerCards([],{});
 const equipmentFor=(item,k)=>({...DEFAULT_EQUIPMENT,rotation:-6,autograph:'gold-ink',
  ...(item.type==='border'?{border:item.id}:item.type==='finish'?{finish:item.id}:item.type==='autograph'?{autograph:item.id}:{translation:item.id}),
  baseCard:{hero:HEROES[k%HEROES.length],art:null,style:'cinema'}});
 const cards=WAVE3_CATALOG.map((item,k)=>({item,id:`w3r-${k}`,equipment:equipmentFor(item,k)}));
 // Fav's votes: kept in this browser and written to scripts/debug/wave3-votes.json (server.js) so Claude can read them.
 let votes={};try{votes=JSON.parse(localStorage.getItem(VOTE_KEY))??{};}catch{}
 const voteBar=c=>{const v=votes[c.item.key]??{};return `<div class="w3r-vote" data-vote-for="${esc(c.item.key)}" data-vote="${v.vote??''}"><div class="w3r-vote-buttons" role="group" aria-label="Vote on ${esc(c.item.name)}">${VOTES.map(([id,label])=>`<button type="button" data-vote-pick="${id}" aria-pressed="${v.vote===id}">${label}</button>`).join('')}</div><textarea data-vote-note rows="2" maxlength="600" placeholder="Feedback (optional)" aria-label="Feedback on ${esc(c.item.name)}">${esc(v.note??'')}</textarea></div>`;};
 const tile=c=>`<figure class="w3r-item" style="--rarity:${COLORS[c.item.rarity]}"><div class="w3r-card" data-w3r="${c.id}">${renderer.card({account:930000+cards.indexOf(c),name:'Fav',team:'AD2L Scrim League'},2,{own:true,equipmentOverride:c.equipment})}</div><figcaption><small>${c.item.rarity}</small><strong>${esc(c.item.name)}</strong><code>${esc(c.item.key)}</code>${c.item.type==='translation'?`<span class="w3r-preview">Fav → ${esc(renderedName('Fav',c.item.id))}</span>`:''}<p>${esc(c.item.description)}</p></figcaption>${voteBar(c)}</figure>`;
 const tally=()=>`<div class="w3r-tally" data-vote-tally>${VOTES.map(([id,label])=>`<span data-tally="${id}">${label}: <b>${cards.filter(c=>votes[c.item.key]?.vote===id).length}</b></span>`).join('')}<span>Not voted: <b>${cards.filter(c=>!votes[c.item.key]?.vote).length}</b></span><output data-vote-status>${Object.keys(votes).length?'Votes loaded from this browser.':'Vote on each card. Votes save as you go.'}</output></div>`;
 const html=PAINT_FILTER+tally()+SLOTS.map(([type,title,note])=>{const list=cards.filter(c=>c.item.type===type);return `<section class="w3r-slot"><h2>${title} <span>${list.length}</span></h2><p class="w3r-note">${esc(note)}</p>${TIERS.filter(t=>list.some(c=>c.item.rarity===t)).map(t=>`<h3 style="--rarity:${COLORS[t]}">${t}</h3><div class="w3r-grid">${list.filter(c=>c.item.rarity===t).map(tile).join('')}</div>`).join('')}</section>`;}).join('');
 let timer=0;
 const save=root=>{
  try{localStorage.setItem(VOTE_KEY,JSON.stringify(votes));}catch{}
  root.querySelector('[data-vote-tally]').outerHTML=tally();
  root.querySelector('[data-vote-status]').textContent='Saving…';
  clearTimeout(timer);
  timer=setTimeout(async()=>{
   const out=root.querySelector('[data-vote-status]');
   const items=Object.fromEntries(cards.map(c=>[c.item.key,{name:c.item.name,type:c.item.type,rarity:c.item.rarity,vote:votes[c.item.key]?.vote??null,note:votes[c.item.key]?.note??''}]));
   try{const r=await fetch('/_review/wave3-votes.json',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({saved:new Date().toISOString(),items})});if(!r.ok)throw Error(r.status);out.textContent='Saved for Claude.';}
   catch{out.textContent='Saved in this browser only. Restart the dev server to save to file.';}
  },400);
 };
 const wire=root=>{
  for(const c of cards){const el=root.querySelector(`[data-w3r="${c.id}"] .ft-card`);if(el)applyEquipment(el,c.equipment,'Fav');}
  root.addEventListener('click',e=>{const b=e.target.closest('[data-vote-pick]');if(!b)return;const box=b.closest('[data-vote-for]'),key=box.dataset.voteFor,pick=b.dataset.votePick;
   const now=votes[key]?.vote===pick?null:pick;votes[key]={...votes[key],vote:now};box.dataset.vote=now??'';box.querySelectorAll('[data-vote-pick]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.votePick===now)));save(root);});
  root.addEventListener('input',e=>{const t=e.target.closest('[data-vote-note]');if(!t)return;const key=t.closest('[data-vote-for]').dataset.voteFor;votes[key]={...votes[key],note:t.value};save(root);});
 };
 return {html,wire,count:cards.length};
}
