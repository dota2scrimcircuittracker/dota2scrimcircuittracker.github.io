// Ten cards Claude designed with every cosmetic unlocked, signed "Claude". Loopback only (?claudeCards=1 on the
// Gallery): nothing is saved to any account. Each design passes equipCosmetics like a player's would.
import {CATALOG,DEFAULT_EQUIPMENT} from './cosmetics-catalog.js';
import {grantLogin,equipCosmetics} from './cosmetics-engine.js';
import {createPlayerCards,PAINT_FILTER} from '../parts/player-card.js';
import {esc} from '../core.js';

const card=(title,note,hero,style,e)=>({title,note,equipment:{...DEFAULT_EQUIPMENT,...e,baseCard:{hero,art:null,style}}});
export const CLAUDE_CARDS=[
 card('Event Horizon','Enigma falling into his own black hole, a cosmic field swirling over it.',33,'cinema',
  {border:'event-horizon',finish:'black-hole',finishStack:['cosmic'],autograph:'constellation',y:64,rotation:-4}),
 card('Arcane Engine','Invoker inside a turning kaleidoscope with a supernova at its core. Signed in runes.',74,'neon',
  {border:'ouroboros',finish:'kaleidoscope',finishStack:['supernova'],autograph:'arcane-sigil',translation:'runic',rotation:0}),
 card('Leviathan','Tidehunter in the deep, seen through rain on glass, with the kraken around the frame.',29,'cinema',
  {border:'kraken',finish:'deep-sea',finishStack:['rain-glass'],autograph:'ink-bloom',y:62}),
 card('Frostbound','Frost growing across Crystal Maiden while a blizzard and starlight drift over it.',5,'frost',
  {border:'fx-frost',finish:'frost-bloom',finishStack:['blizzard','starlight'],autograph:'ice-sculpture',rotation:-3}),
 card('Field Schematic','Arc Warden drawn as a blueprint, with code raining down over the sheet.',113,'blueprint',
  {border:'circuit',finish:'blueprint-sheet',finishStack:['code-rain'],autograph:'architect',rotation:0,y:66}),
 card('Neon Ronin','Juggernaut in neon outline inside an ink circle, signed with a brush in kanji.',8,'neon',
  {border:'neon-sign',finish:'enso-ink-finish',finishStack:['neon-outline'],autograph:'ronin-stroke',translation:'kanji',rotation:-9}),
 card('Second Sun','Phoenix in front of an eclipse, magma cracking underneath and embers rising.',110,'ember',
  {border:'solar',finish:'magma-veins',finishStack:['solar-eclipse','inferno'],autograph:'phoenix-stroke',rotation:-6}),
 card('Midnight Matinee','Shadow Fiend on an old sepia tape, tracking lines and all, signed like a title card.',11,'cinema',
  {border:'film-reel',finish:'sepia-photo',finishStack:['vhs-tracking'],autograph:'title-card',rotation:0,y:63}),
 card('Panel Seven','Dark Willow as a comic panel: pop art over halftone print.',119,'comic',
  {border:'manga-panel',finish:'halftone-print',finishStack:['pop-art'],autograph:'comic-burst',rotation:-8}),
 card('Full Spectrum','Every layer the Arcana allows: aurora, meteors, starlight, sheen and a rainbow veil over Io.',91,'hologram',
  {border:'opalescent',finish:'aurora-veil',finishStack:['meteor-shower','starlight','fx-sheen','rainbowveil'],autograph:'northern-lights',translation:'greek',rotation:-5}),
];

export function localClaudeCards(){
 if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname)||new URLSearchParams(location.search).get('claudeCards')!=='1')return null;
 // Everything owned, four arcana for the full five layers.
 const state={...grantLogin(null),inventory:Object.fromEntries(CATALOG.map(i=>[i.key,1])),arcanaUpgrade:true,arcanaOwed:4};
 const renderer=createPlayerCards([],{});
 const cards=CLAUDE_CARDS.map(c=>({...c,equipment:{...equipCosmetics(state,c.equipment).equipment,baseCard:c.equipment.baseCard}}));
 return {cards,html:PAINT_FILTER+`<div class="claude-cards">${cards.map((c,i)=>`<figure class="claude-card" data-claude-card="${i}">${renderer.card({account:900000+i,name:'Claude',team:'House cards'},2,{own:true,equipmentOverride:c.equipment})}<figcaption><strong>${i+1}. ${esc(c.title)}</strong><span>${esc(c.note)}</span></figcaption></figure>`).join('')}</div>`};
}
