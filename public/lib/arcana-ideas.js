// Prototypes of nine arcana ideas on real cards, for Fav to try. Loopback only (?arcanaIdeas=1 on the Gallery);
// nothing here is saved or used anywhere else. Styles live in arcana-ideas.css, loaded on demand.
import {DEFAULT_EQUIPMENT} from './cosmetics-catalog.js';
import {cardArtOptions} from './card-art.js';
import {applyEquipment} from './cosmetics.js';
import {createPlayerCards,PAINT_FILTER} from '../parts/player-card.js';
import {esc} from '../core.js';

const eq=(hero,style,e={},art=null)=>({...DEFAULT_EQUIPMENT,rotation:-5,...e,baseCard:{hero,art,style}});
const renderer=createPlayerCards([],{});
let serial=0;
const card=(equipment)=>{const id=`ai-${++serial}`;return {id,equipment,html:`<div class="ai-card" data-ai-card="${id}">${renderer.card({account:910000+serial,name:'Fav',team:'AD2L Scrim League'},2,{own:true,equipmentOverride:equipment})}</div>`};};
const buttons=(name,list)=>`<div class="ai-buttons" role="group">${list.map(([v,l],i)=>`<button type="button" data-${name}="${v}" aria-pressed="${i===0}">${l}</button>`).join('')}</div>`;
const press=(fig,attr,btn)=>{fig.querySelectorAll(`[data-${attr}]`).forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));};

const IDEAS=[
 {title:'Living Border',type:'Border arcana',how:'The frame reacts to your results: a gold pulse on a win streak, cracks and smoke after a losing run, a crown flare after an MVP game. More copies add more states.',
  build(){const c=card(eq(8,'cinema',{border:'gold',finish:'satin',autograph:'gold-ink'}));return {cards:[c],html:`<div class="ai-stage ai-living" data-state="win">${c.html}<span class="ai-living-fx" aria-hidden="true"><i class="ai-crack"></i><i class="ai-crown">♛</i></span></div>${buttons('living',[['win','Win streak'],['loss','Losing run'],['mvp','MVP game']])}`};},
  wire(fig){fig.querySelectorAll('[data-living]').forEach(b=>b.onclick=()=>{fig.querySelector('.ai-living').dataset.state=b.dataset.living;press(fig,'living',b);});}},
 {title:'Split Frame',type:'Border arcana',how:'Wear two borders at once. One copy splits the frame on the diagonal; more copies add top and bottom, then quarters with four borders.',
  build(){const cs=['neon-sign','molten-gilding','kraken','event-horizon'].map(border=>card(eq(126,'neon',{border,finish:'none',autograph:'neon-script'})));return {cards:cs,html:`<div class="ai-stage ai-split" data-split="diag">${cs.map((c,i)=>`<div class="ai-split-part" data-part="${i}">${c.html}</div>`).join('')}</div>${buttons('split',[['diag','Diagonal'],['half','Top / bottom'],['quarters','Quarters']])}`};},
  wire(fig){fig.querySelectorAll('[data-split]').forEach(b=>{if(b.tagName==='BUTTON')b.onclick=()=>{fig.querySelector('.ai-split').dataset.split=b.dataset.split;press(fig,'split',b);};});}},
 {title:'Self-Writing Signature',type:'Signature arcana',how:'Your signature writes itself, pen first, every time the card comes into view. More copies add a colour shift and a second pass in another ink.',
  build(){const c=card(eq(74,'cinema',{border:'ouroboros',finish:'starlight',autograph:'gold-foil',size:18,y:62}));return {cards:[c],html:`<div class="ai-stage ai-write">${c.html}</div>${buttons('write',[['again','Write it again']])}`};},
  wire(fig){fig.querySelector('[data-write]').onclick=()=>{const s=fig.querySelector('.ai-write');s.classList.remove('ai-write-on');void s.offsetWidth;s.classList.add('ai-write-on');};fig.querySelector('.ai-write').classList.add('ai-write-on');}},
 {title:'Parallax Art',type:'Art arcana',how:'The hero lifts off the background: move your mouse over the card and the two layers slide at different depths. More copies add more layers (smoke, embers, a foreground frame).',
  build(){const c=card(eq(8,'plain',{border:'fx-ember',finish:'none',autograph:'ronin-stroke'},'scr:87aa94970307'));const fg=cardArtOptions(8).find(a=>a.id==='render')?.src??'';return {cards:[c],html:`<div class="ai-stage ai-parallax" data-fg="${esc(fg)}">${c.html}</div><p class="ai-hint">Move your mouse over the card.</p>`};},
  wire(fig){const s=fig.querySelector('.ai-parallax');
   // The card rebuilds its markup after it first draws, which drops extra layers: put the hero back each time.
   const addHero=()=>{const art=s.querySelector('.ft-art');if(art&&!art.querySelector('.ai-fg'))art.insertAdjacentHTML('beforeend',`<img class="ai-fg" alt="" src="${s.dataset.fg}">`);};
   addHero();new MutationObserver(addHero).observe(s,{childList:true,subtree:true});
   s.onpointermove=e=>{const r=s.getBoundingClientRect();s.style.setProperty('--mx',((e.clientX-r.left)/r.width-.5).toFixed(3));s.style.setProperty('--my',((e.clientY-r.top)/r.height-.5).toFixed(3));};
   s.onpointerleave=()=>{s.style.setProperty('--mx',0);s.style.setProperty('--my',0);};}},
 {title:'Momentum',type:'Finish arcana',how:'Your finish runs on your last league game: faster and brighter after a big game, slow and dim after a rough one. Drag the slider to change the last game.',
  build(){const c=card(eq(110,'ember',{border:'solar',finish:'inferno',autograph:'phoenix-stroke'}));return {cards:[c],html:`<div class="ai-stage ai-momentum" data-heat="3">${c.html}<span class="ai-momentum-tag"></span></div><label class="ai-slider">Last game <input type="range" min="0" max="4" value="3" data-momentum><output></output></label>`};},
  wire(fig){const games=[['1/9/3','Cold',.35,.45],['4/6/8','Cooling',.7,.7],['7/4/11','Steady',1,1],['12/2/15','Hot',1.7,1.25],['18/1/22','On fire',2.6,1.55]];
   const s=fig.querySelector('.ai-momentum'),inp=fig.querySelector('[data-momentum]'),cardEl=s.querySelector('.ft-card');
   const set=()=>{const [kda,label,speed,glow]=games[inp.value];s.dataset.heat=inp.value;cardEl.style.setProperty('--particle-speed',speed);s.style.setProperty('--glow',glow);fig.querySelector('output').textContent=kda;s.querySelector('.ai-momentum-tag').textContent=label;};
   inp.oninput=set;set();}},
 {title:'Twin Card',type:'Card arcana',how:'A second full design on the same card. It turns over on its own, or click it. More copies add more faces in the rotation.',
  build(){const a=card(eq(5,'frost',{border:'fx-frost',finish:'frost-bloom',autograph:'ice-sculpture'})),b=card(eq(5,'ember',{border:'solar',finish:'magma-veins',autograph:'lava-script'}));return {cards:[a,b],html:`<div class="ai-stage ai-twin"><div class="ai-twin-inner"><div class="ai-twin-face">${a.html}</div><div class="ai-twin-face ai-twin-back">${b.html}</div></div></div><p class="ai-hint">Turns every 4 seconds. Click to turn it now.</p>`};},
  wire(fig){const s=fig.querySelector('.ai-twin'),flip=()=>s.classList.toggle('ai-turned');s.onclick=flip;setInterval(()=>{if(document.contains(s))flip();},4000);}},
 {title:'Title Plate',type:'Name arcana',how:'A title under your name, earned from achievements. One copy shows one title; more copies let it rotate through the titles you have earned.',
  build(){const c=card(eq(29,'cinema',{border:'kraken',finish:'deep-sea',autograph:'ink-bloom',y:44}));return {cards:[c],html:`<div class="ai-stage ai-titled">${c.html}<span class="ai-title" aria-live="polite"><b>Rampage</b></span></div>`};},
  wire(fig){const t=fig.querySelector('.ai-title'),s=fig.querySelector('.ai-titled'),name=s.querySelector('.ft-name');
   if(name){const r=name.getBoundingClientRect(),sr=s.getBoundingClientRect();t.style.top=`${r.top-sr.top-t.offsetHeight-3}px`;}
   const titles=['Rampage','Ward Lord','Roshan Slayer','Unkillable','Divine Rapier'];let n=0;
   setInterval(()=>{if(!document.contains(t))return;n=(n+1)%titles.length;t.classList.remove('ai-title-in');void t.offsetWidth;t.querySelector('b').textContent=titles[n];t.classList.add('ai-title-in');},2600);}},
 {title:'Highlight Ticker',type:'Card arcana',how:'A strip across the card that replays your best recent lines from the league data. More copies add more lines and a longer history. (Sample lines shown.)',
  build(){const c=card(eq(11,'noir',{border:'film-reel',finish:'sepia-photo',autograph:'title-card'}));const lines=['Week 6 · 14/2/19 on Shadow Fiend','34.2k hero damage vs Aegis','Triple kill at 31:40','9 wards dewarded in one game','6-game win streak'];return {cards:[c],html:`<div class="ai-stage ai-ticker">${c.html}<div class="ai-ticker-strip" aria-label="Recent highlights"><div class="ai-ticker-run">${[...lines,...lines].map(l=>`<span>${esc(l)}</span>`).join('')}</div></div></div>`};},
  wire(){}},
 {title:'Cup Champion',type:'Champion arcana',how:"An Arcana Cup winner, pulled as a complete fixed design: the winner's card exactly as entered, with the champion seal. It can't be edited, only shown off.",
  build(){const c=card(eq(110,'ember',{border:'solar',finish:'magma-veins',finishStack:['solar-eclipse','inferno'],autograph:'phoenix-stroke',rotation:-6}));return {cards:[c],html:`<div class="ai-stage ai-champion">${c.html}<span class="ai-seal" aria-hidden="true"><b>Arcana Cup</b><i>★</i><small>Champion · S48</small></span><span class="ai-champion-foil" aria-hidden="true"></span></div>`};},
  wire(){}},
];

// Round 2 (?arcanaIdeas=2): five takes each on the three ideas Fav liked.
const ring=`<span class="ai-ring" aria-hidden="true"></span>`;
const embers=()=>`<span class="ai-embers" aria-hidden="true">${Array.from({length:22},(_,k)=>{const side=k%3,pos=(k*37)%100;return `<i style="--x:${side===0?pos:side===1?2:98}%;--y:${side===0?100:(k*53)%100}%;--d:${((k*0.37)%3).toFixed(2)}s;--s:${(0.7+(k%4)*0.2).toFixed(1)}"></i>`;}).join('')}</span>`;
const trace=`<svg class="ai-trace" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="1.5" y="1.2" width="97" height="97.6" rx="4" ry="3" pathLength="100"/></svg>`;
const onOff=`<div class="ai-buttons" role="group"><button type="button" data-fx-toggle aria-pressed="true">Effect on</button></div>`;
const wireToggle=fig=>{const b=fig.querySelector('[data-fx-toggle]');b.onclick=()=>{const on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(on));b.textContent=on?'Effect on':'Effect off';fig.querySelector('.ai-stage').classList.toggle('ai-fx-off',!on);};};
// The border's own colours, from the card, so the effect matches whatever border it's on.
const borderColours=fig=>{const s=fig.querySelector('.ai-stage'),c=s.querySelector('.ft-card');if(!c)return;const cs=getComputedStyle(c);s.style.setProperty('--ba',cs.getPropertyValue('--a').trim()||'#ffd36b');s.style.setProperty('--bb',cs.getPropertyValue('--b').trim()||'#ff5ab4');};
const living=(title,how,cls,hero,style,e,extra='')=>({group:'Living Border',title,how,
  build(){const c=card(eq(hero,style,e));return {cards:[c],html:`<div class="ai-stage ai-lb ${cls}">${c.html}${extra}</div>${onOff}`};},
  wire(fig){borderColours(fig);wireToggle(fig);}});
const split=(title,how,cls,borders,hero,style,e={},wire=()=>{},overlay='')=>({group:'Split Frame',title,how,
  build(){const cs=borders.map(border=>card(eq(hero,style,{border,finish:'none',...e})));return {cards:cs,html:`<div class="ai-stage ai-sp ${cls}">${cs.map((c,i)=>`<div class="ai-sp-part" data-part="${i}">${c.html}</div>`).join('')}${overlay}</div>`};},wire});
const twin=(title,how,cls,a,b,wire,hint)=>({group:'Twin Card',title,how,
  build(){const A=card(a),B=card(b);return {cards:[A,B],html:`<div class="ai-stage ai-tw ${cls}"><div class="ai-tw-face" data-face="a">${A.html}</div><div class="ai-tw-face" data-face="b">${B.html}</div></div><p class="ai-hint">${hint}</p>`};},wire});
const every=(ms,fn,el)=>{const t=setInterval(()=>{if(!document.contains(el))return clearInterval(t);fn();},ms);};
const IDEAS2=[
 split('Glowing Seam','Two borders meet on the diagonal, with a light running along the join.','ai-sp-diag',['neon-sign','molten-gilding'],126,'neon',{autograph:'neon-script'},()=>{},`<svg class="ai-seam" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="100" y1="0" x2="0" y2="100"/></svg>`),
 split('Sweeping Seam','The join slides slowly across the card, so the two borders keep trading places.','ai-sp-sweep',['kraken','event-horizon'],29,'cinema',{autograph:'ink-bloom'}),
 split('Lightning Cut','A jagged cut down the middle, crackling where the two borders meet.','ai-sp-bolt',['solar','fx-frost'],110,'ember',{autograph:'phoenix-stroke'},()=>{},`<svg class="ai-bolt" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="55,0 41,28 57,45 42,62 58,80 45,100"/></svg>`),
 split('Corner Inlay','Your main border, with the second one set into its four corners like metal caps.','ai-sp-corners',['obsidian','gold'],11,'noir',{autograph:'gold-ink'}),
 split('Spotlight Reveal','One border on show; move your mouse over the card and a spotlight shows the second one underneath.','ai-sp-spot',['emeraldgloss','fx-cosmic'],91,'hologram',{autograph:'northern-lights'},fig=>{const s=fig.querySelector('.ai-sp-spot');s.onpointermove=e=>{const r=s.getBoundingClientRect();s.style.setProperty('--sx',`${e.clientX-r.left}px`);s.style.setProperty('--sy',`${e.clientY-r.top}px`);s.classList.add('ai-spot-on');};s.onpointerleave=()=>s.classList.remove('ai-spot-on');}),
 twin('Flip','The classic: the card turns over in 3D to show its second design.','ai-tw-flip',eq(5,'frost',{border:'fx-frost',finish:'frost-bloom',autograph:'ice-sculpture'}),eq(5,'ember',{border:'solar',finish:'magma-veins',autograph:'lava-script'}),fig=>{const s=fig.querySelector('.ai-tw');const go=()=>s.classList.toggle('ai-b');s.onclick=go;every(4000,go,s);},'Turns every 4 seconds, or click.'),
 twin('Corner Peel','Hover the card and it peels from the corner to show the design underneath.','ai-tw-peel',eq(74,'cinema',{border:'ouroboros',finish:'starlight',autograph:'gold-foil'}),eq(74,'neon',{border:'neon-sign',finish:'neon-outline',autograph:'neon-script'}),()=>{},'Hover the card.'),
 twin('Shuffle','The two designs shuffle like a deck: the front card slides off and tucks in behind.','ai-tw-shuffle',eq(8,'cinema',{border:'gold',finish:'satin',autograph:'ronin-stroke'}),eq(8,'ink',{border:'enso-ink-border',finish:'enso-ink-finish',autograph:'kana-brush'}),fig=>{const s=fig.querySelector('.ai-tw');const go=()=>{s.classList.remove('ai-shuffling');void s.offsetWidth;s.classList.add('ai-shuffling');setTimeout(()=>s.classList.toggle('ai-b'),450);};s.onclick=go;every(4000,go,s);},'Shuffles every 4 seconds, or click.'),
 twin('Scan','A scan line passes down the card and the second design appears behind it.','ai-tw-scan',eq(113,'blueprint',{border:'circuit',finish:'blueprint-sheet',autograph:'architect'}),eq(113,'neon',{border:'light-cycles',finish:'code-rain',autograph:'led-display'}),fig=>{const s=fig.querySelector('.ai-tw');s.insertAdjacentHTML('beforeend','<span class="ai-scanbar" aria-hidden="true"></span>');const go=()=>s.classList.toggle('ai-b');s.onclick=go;every(4000,go,s);},'Scans every 4 seconds, or click.'),
 twin('Glitch Swap','The card glitches for a split second and comes back as the other design.','ai-tw-glitch',eq(11,'noir',{border:'film-reel',finish:'sepia-photo',autograph:'title-card'}),eq(11,'neon',{border:'neon-sign',finish:'vhs-tracking',autograph:'arcade-score'}),fig=>{const s=fig.querySelector('.ai-tw');const go=()=>{s.classList.remove('ai-glitching');void s.offsetWidth;s.classList.add('ai-glitching');setTimeout(()=>s.classList.toggle('ai-b'),180);};s.onclick=go;every(4000,go,s);},'Glitches every 4 seconds, or click.'),
 living('Pulse Glow','The frame breathes light in its own colours.','ai-lb-pulse',8,'cinema',{border:'rubygloss',finish:'satin',autograph:'gold-ink'},ring),
 living('Orbiting Spark','A bright spark travels round and round the frame.','ai-lb-orbit',74,'cinema',{border:'sapphiregloss',finish:'starlight',autograph:'silver-ink'},ring),
 living('Shimmer Sweep','A sheen of light runs across the frame every few seconds.','ai-lb-shimmer',5,'frost',{border:'platinum',finish:'pearlglaze',autograph:'ice-sculpture'},ring),
 living('Rising Embers','Sparks lift off the frame and drift up the card.','ai-lb-embers',110,'ember',{border:'ember',finish:'none',autograph:'phoenix-stroke'},embers()),
 living('Rune Trace','A line of light traces the frame, like a rune being drawn.','ai-lb-trace',29,'cinema',{border:'runes',finish:'deep-sea',autograph:'ancient-signature'},trace),
];

export function localArcanaIdeas(){
 const round=new URLSearchParams(location.search).get('arcanaIdeas');
 if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname)||!['1','2'].includes(round))return null;
 if(!document.querySelector('link[data-arcana-ideas]'))document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="arcana-ideas.css" data-arcana-ideas>');
 const list=round==='2'?IDEAS2:IDEAS,built=list.map(idea=>({idea,...idea.build()}));
 const figure=(b,i,n)=>`<figure class="ai-idea" data-ai-idea="${i}"><figcaption><small>${n} · ${esc(b.idea.type??b.idea.group)}</small><strong>${esc(b.idea.title)}</strong></figcaption>${b.html}<p>${esc(b.idea.how)}</p></figure>`;
 const groups=[...new Set(built.map(b=>b.idea.group??''))];
 const body=round==='2'?groups.map(g=>`<h2 class="ai-group">${esc(g)}</h2><div class="ai-grid">${built.map((b,i)=>b.idea.group===g?figure(b,i,built.slice(0,i+1).filter(x=>x.idea.group===g).length):'').join('')}</div>`).join(''):`<div class="ai-grid">${built.map((b,i)=>figure(b,i,i+1)).join('')}</div>`;
 const wire=(root)=>{
  for(const b of built)for(const c of b.cards){const el=root.querySelector(`[data-ai-card="${c.id}"] .ft-card`);if(el)applyEquipment(el,c.equipment,'Fav');}
  // After the cards are in, so names and art have their size before ideas measure them. A timer, not a frame:
  // frames don't run in a hidden tab. One idea failing doesn't stop the rest.
  setTimeout(()=>built.forEach((b,i)=>{try{b.idea.wire(root.querySelector(`[data-ai-idea="${i}"]`));}catch(e){console.error(`Arcana idea ${b.idea.title}:`,e);}}),0);
 };
 return {html:PAINT_FILTER+body,wire,round};
}
