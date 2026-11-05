// Borders for the November 3 wave. Same frame as the October 20 and 30 waves: viewBox 8 9 284 382, sides drawn in
// local space (x along the side, y inward from the card edge). Motion uses the .w2 motion classes from
// cosmetics-wave2.css (`an()`), plus the few in cosmetics-wave3.css; everything paces on --border-speed.
import {rnd,f,rim,eachSide,mitres,inner,keyline,frame} from './cosmetics-wave-borders.js';
import {an} from './cosmetics-wave2-borders.js';

const LENS=[284,382,284,382];
// Side n's local point (x along, y inward) in card space.
const at=(n,x,y)=>[[8+x,9+y],[292-y,9+x],[292-x,391-y],[8+y,391-x]][n];
const CORNERS=[[8,9,0],[292,9,90],[292,391,180],[8,391,270]];
const corner=(n,body)=>{const [x,y,a]=CORNERS[n];return `<g transform="translate(${x} ${y}) rotate(${a})">${body}</g>`;};
const box=(item,id,w,defs,body)=>frame(item,id,w,mitres(id,w)+defs,`<g class="w2b">${body}</g>`);
const band=(id,w,fill,body=()=>'')=>`<g clip-path="url(#${id}-frame)">${eachSide((len,n)=>`<g clip-path="url(#${id}-mitre-${len})"><rect width="${len}" height="${w}" fill="${fill}"/>${body(len,n)}</g>`)}</g>`;
const stops=colors=>colors.map((c,i)=>`<stop offset="${f(i/(colors.length-1))}" stop-color="${c}"/>`).join('');
const linear=(id,colors,x2=0,y2=1)=>`<linearGradient id="${id}" x2="${x2}" y2="${y2}">${stops(colors)}</linearGradient>`;
const radial=(id,colors,cx=.5,cy=.5)=>`<radialGradient id="${id}" cx="${cx}" cy="${cy}">${stops(colors)}</radialGradient>`;
const blur=(id,d)=>`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${d}"/></filter>`;
const noise=(id,freq,seed,matrix,oct=2)=>`<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}"/><feColorMatrix values="${matrix}"/></filter>`;
const ride=(inset,t,phase,body,rotate='0deg')=>`<g ${an('ride',t,phase*t,`offset-path:path('${rim(inset)}');offset-rotate:${rotate}`)}>${body}</g>`;
const glint=(x,y,s,k,color='#fff')=>`<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})"><path d="M0 -3L.6 -.6 3 0 .6 .6 0 3 -.6 .6 -3 0 -.6 -.6Z" fill="${color}" ${an('pulse',1.6+rnd(k)*1.6,rnd(k+3)*3,'--lo:0')}/></g>`;
// A bevel: a light line on the outer edge of the band and a dark one on the inner edge.
const bevel=(w,light='#fff',dark='#000',a=.45)=>`<path d="${rim(.7)}" fill="none" stroke="${light}" stroke-opacity="${a}" stroke-width="1"/><path d="${rim(w-.7)}" fill="none" stroke="${dark}" stroke-opacity="${a}" stroke-width="1"/>`;
// A soft light sweeping across the whole frame once a cycle.
const sheen=(id,t,opacity=.7)=>`<g clip-path="url(#${id}-frame)"><g ${an('wash',t)}><rect x="100" y="-20" width="46" height="440" fill="url(#${id}-sheen)" transform="skewX(-22)" opacity="${opacity}"/></g></g>`;
const sheenDef=id=>`<linearGradient id="${id}-sheen" x2="1"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;

// Common

function cedar(item,id){
 const w=10;
 // Grain runs along each side; the mitred corners show where the four planks meet.
 const grain=(len,n)=>Array.from({length:7},(_,k)=>{const y=1.2+k*1.3,ph=rnd(n*20+k)*6;let d=`M0 ${f(y)}`;for(let x=6;x<=len;x+=6)d+=`L${x} ${f(y+Math.sin(x/(14+k*3)+ph)*.45)}`;return `<path d="${d}" fill="none" stroke="${k%2?'#6b3a1c':'#c88458'}" stroke-width="${k%3?.35:.6}" opacity=".7"/>`;}).join('');
 const knots=(len,n)=>[0,1].map(k=>{const x=f(30+rnd(n*7+k)*(len-60)),y=f(3+rnd(n*9+k)*4);return `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="1.5" fill="#5a2f17" opacity=".7"/><ellipse cx="${x}" cy="${y}" rx="5.4" ry="2.6" fill="none" stroke="#6b3a1c" stroke-width=".4" opacity=".6"/>`;}).join('');
 const defs=linear(`${id}-plank`,['#c47d50','#a5633c','#8b4f2c','#9c5b35']);
 return box(item,id,w,defs,`${band(id,w,`url(#${id}-plank)`,(len,n)=>grain(len,n)+knots(len,n))}<g clip-path="url(#${id}-frame)">${[0,1,2,3].map(n=>corner(n,`<path d="M0 0L${w} ${w}" stroke="#3a1f10" stroke-width=".7" opacity=".8"/>`)).join('')}${bevel(w,'#ffd9b8','#2a1408',.4)}</g>${keyline(w,'#e0a070',.45)}`);
}

function cork(item,id){
 const w=11;
 const defs=`${linear(`${id}-cork`,['#d6ae7c','#c09062','#a87a4c'],1,1)}<pattern id="${id}-fleck" width="13" height="11" patternUnits="userSpaceOnUse">${Array.from({length:14},(_,k)=>`<circle cx="${f(rnd(k)*13)}" cy="${f(rnd(k+30)*11)}" r="${f(.25+rnd(k+60)*.6)}" fill="${k%3?'#7a5230':'#efd2a6'}" opacity="${f(.5+rnd(k+90)*.5)}"/>`).join('')}</pattern>${radial(`${id}-pin`,['#ff8a80','#d32f2f','#7f1010'],.35,.35)}`;
 const pin=`<g transform="translate(280 379)"><ellipse cx="2.2" cy="3" rx="4.2" ry="1.8" fill="#000" opacity=".35"/><circle r="4.2" fill="url(#${id}-pin)"/><circle cx="-1.3" cy="-1.4" r="1.2" fill="#fff" opacity=".7"/></g>`;
 return box(item,id,w,defs,`<g clip-path="url(#${id}-frame)"><rect x="8" y="9" width="284" height="382" fill="url(#${id}-cork)"/><rect x="8" y="9" width="284" height="382" fill="url(#${id}-fleck)"/>${bevel(w,'#f4dcb6','#4a3018',.45)}</g>${keyline(w,'#6a4522',.6)}${pin}`);
}

// Rare

function damascus(item,id){
 const w=10;
 // Folded steel: wavy light and dark layers that drift slowly, under a bright edge.
 const layers=(len,n)=>{let out='';for(let k=0;k<9;k++){const y=k*1.25,ph=rnd(n*30+k)*6,amp=.6+rnd(n*31+k)*.9;let d=`M-20 ${f(y)}`;for(let x=-16;x<=len+20;x+=4)d+=`L${x} ${f(y+Math.sin(x/(9+k%3*4)+ph)*amp)}`;out+=`<path d="${d}" fill="none" stroke="${k%2?'#f2f5f8':'#2a3036'}" stroke-width="${k%2?.8:1}" opacity="${k%2?.95:.85}"/>`;}return `<g ${an('bob',7+n,n,'--dx:8px;--dy:0px')}>${out}</g>`;};
 const defs=`${linear(`${id}-steel`,['#9aa2aa','#6c737b','#878f97','#555c63'])}${sheenDef(id)}`;
 return box(item,id,w,defs,`${band(id,w,`url(#${id}-steel)`,layers)}<g clip-path="url(#${id}-frame)">${bevel(w,'#fff','#15181b',.6)}</g>${sheen(id,7)}${keyline(w,'#eef2f5',.7)}`);
}

function lapis(item,id){
 const w=11;
 const flecks=Array.from({length:46},(_,k)=>{const n=k%4,[x,y]=at(n,8+rnd(k)*(LENS[n]-16),1.5+rnd(k+50)*(w-3));return k%5===0?glint(x,y,.55+rnd(k+70)*.3,k,'#ffe7a0'):`<circle cx="${f(x)}" cy="${f(y)}" r="${f(.35+rnd(k+90)*.6)}" fill="#f3cf6b" opacity="${f(.6+rnd(k+110)*.4)}"/>`;}).join('');
 const defs=`${linear(`${id}-stone`,['#2f55bd','#1b3486','#14276e','#2a47a6'],1,1)}${noise(`${id}-vein`,'.06 .12',8,'0 0 0 0 .55 0 0 0 0 .7 0 0 0 0 1 0 0 0 .9 -.45')}`;
 return box(item,id,w,defs,`<g clip-path="url(#${id}-frame)"><rect x="8" y="9" width="284" height="382" fill="url(#${id}-stone)"/><rect x="8" y="9" width="284" height="382" filter="url(#${id}-vein)" opacity=".5"/>${bevel(w,'#bcd0ff','#081030',.45)}</g><path d="${rim(.6)}" fill="none" stroke="#e9c25a" stroke-width=".8"/>${keyline(w,'#e9c25a',.9)}${flecks}`);
}

function stitchedLeather(item,id){
 const w=12;
 const stitch=inset=>`<path d="${rim(inset)}" fill="none" stroke="#2a160a" stroke-width="1.6" stroke-dasharray="3.2 2.2" opacity=".6" transform="translate(.3 .4)"/><path d="${rim(inset)}" fill="none" stroke="#e3c08a" stroke-width="1.1" stroke-dasharray="3.2 2.2" stroke-linecap="round"/>`;
 const rivet=n=>corner(n,`<g transform="translate(6 6)"><circle r="3.2" fill="url(#${id}-brass)" stroke="#4a3010" stroke-width=".5"/><circle cx="-.9" cy="-.9" r=".9" fill="#fff6d0" opacity=".8"/></g>`);
 const defs=`${linear(`${id}-hide`,['#8a4f2c','#6a391e','#4a2510','#6e3d20'],1,1)}${noise(`${id}-grain`,'1.1',11,'0 0 0 0 .1 0 0 0 0 .05 0 0 0 0 0 0 0 0 .6 -.2')}${radial(`${id}-brass`,['#fff0b0','#d6a640','#7a5216'],.35,.35)}`;
 return box(item,id,w,defs,`<g clip-path="url(#${id}-frame)"><rect x="8" y="9" width="284" height="382" fill="url(#${id}-hide)"/><rect x="8" y="9" width="284" height="382" filter="url(#${id}-grain)"/><path d="${rim(w/2)}" fill="none" stroke="#2a1408" stroke-width=".6" opacity=".5"/><path d="${rim(w/2+.6)}" fill="none" stroke="#c88a5a" stroke-width=".4" opacity=".35"/>${bevel(w,'#e8b48a','#1a0c04',.4)}</g>${stitch(2.6)}${stitch(w-2.6)}${keyline(w,'#e3c08a',.4)}${[0,1,2,3].map(rivet).join('')}`);
}

// Epic

function lanternFestival(item,id){
 const w=10;
 const clouds=eachSide(len=>Array.from({length:Math.floor(len/40)},(_,k)=>`<path transform="translate(${20+k*40} ${w/2})" d="M-6 1.5Q-6 -2 -3 -1.5Q-2 -4 1 -3Q4 -4 4.5 -1Q7 -1 6.5 1.5Z" fill="none" stroke="#f0c060" stroke-width=".6" opacity=".7"/>`).join(''));
 // Lanterns hang below the top rail, between the rating badge and the corner buttons.
 const lantern=(x,k)=>{const drop=6+k%2*8,s=k%2?1.3:1.55;return `<g transform="translate(${x} ${9+w-1})"><g ${an('sway',2.6+rnd(k)*1.2,rnd(k+4)*2,'--a:7deg')}><path d="M0 0V${drop}" stroke="#f0c060" stroke-width=".6"/><g transform="translate(0 ${drop}) scale(${s})"><circle cy="10" r="14" fill="#ff9a2e" opacity=".35" filter="url(#${id}-glow)" ${an('pulse',1.4+rnd(k+8)*.8,rnd(k+9),'--lo:.5')}/><rect x="-4" y="0" width="8" height="2.2" rx=".6" fill="#2a0a08"/><ellipse cy="10" rx="8.5" ry="8" fill="url(#${id}-paper)"/>${[-5,-2.2,0,2.2,5].map(x=>`<path d="M${x} 2.6Q${f(x*1.5)} 10 ${x} 17.4" fill="none" stroke="#8e1a17" stroke-width=".45" opacity=".7"/>`).join('')}<rect x="-4" y="17.6" width="8" height="2.2" rx=".6" fill="#2a0a08"/><path d="M0 19.8V27M-1 20.5V25.5M1 20.5V25.5" stroke="#f0c060" stroke-width=".55"/><text y="12.6" text-anchor="middle" font-family="Georgia,serif" font-size="7" fill="#ffe6a0" opacity=".9">福</text></g></g></g>`;};
 const lanterns=[104,150,196].map(lantern).join('');
 const defs=`${linear(`${id}-lacquer`,['#d23a33','#a01f1b','#6a0f0d'])}${radial(`${id}-paper`,['#ffe08a','#ff8a2a','#c2261a'],.5,.45)}${blur(`${id}-glow`,4)}`;
 return box(item,id,w,defs,`${band(id,w,`url(#${id}-lacquer)`)}<g clip-path="url(#${id}-frame)">${clouds}${bevel(w,'#ff9a8a','#2a0404',.45)}</g><path d="${rim(.5)}" fill="none" stroke="#f0c060" stroke-width=".8"/>${keyline(w,'#f0c060',.9)}${lanterns}`);
}

// Legendary

function radiantDire(item,id){
 const w=12;
 // Each faction holds its half of the frame; the seam runs down the middle.
 const motes=Array.from({length:24},(_,k)=>{const left=k%2===0,n=left?3:1,len=382,x=10+rnd(k)*(len-20),[px,py]=at(n,x,rnd(k+40)*w);return `<g transform="translate(${f(px)} ${f(py)})"><circle r="${f(.6+rnd(k+70)*.8)}" fill="${left?(k%4?'#f6ffd0':'#9fff8a'):(k%3?'#ffb347':'#ff4a1a')}" ${an('move',2.4+rnd(k+90)*2,rnd(k+110)*4,`--dx:${f((rnd(k+130)-.5)*6)}px;--dy:-${f(18+rnd(k+150)*20)}px;--o:1`)}/></g>`;}).join('');
 const cracks=eachSide((len,n)=>Array.from({length:Math.floor(len/26)},(_,k)=>{const x=10+k*26+rnd(n*30+k)*10;return `<path d="M${f(x)} 1L${f(x+3)} ${f(w*.45)}L${f(x+1)} ${f(w*.7)}L${f(x+4)} ${w-1}" fill="none" stroke="#ff7a2a" stroke-width=".8" ${an('pulse',1.2+rnd(n*30+k+5),rnd(k+n),'--lo:.25')}/>`;}).join(''));
 const leaves=eachSide((len,n)=>Array.from({length:Math.floor(len/22)},(_,k)=>`<path transform="translate(${f(8+k*22+rnd(n*40+k)*8)} ${f(w/2)}) rotate(${f(rnd(n*40+k+3)*360)})" d="M0 -3Q2.2 0 0 3Q-2.2 0 0 -3Z" fill="#c7ff9a" opacity=".55"/>`).join(''));
 const clash=y=>`<g transform="translate(150 ${y})"><circle r="9" fill="#fff3c0" opacity=".5" filter="url(#${id}-glow)" ${an('pulse',.9,0,'--lo:.15')}/>${Array.from({length:8},(_,k)=>`<g transform="rotate(${k*45})"><path d="M0 0L0 -7" stroke="${k%2?'#9fff8a':'#ff9a3a'}" stroke-width="1" stroke-linecap="round" ${an('pop',.9,k*.11,'--s0:.2;--s1:1.4')}/></g>`).join('')}<circle r="2" fill="#fff"/></g>`;
 const defs=`<clipPath id="${id}-rad"><rect x="0" y="0" width="150" height="400"/></clipPath><clipPath id="${id}-dire"><rect x="150" y="0" width="160" height="400"/></clipPath>${linear(`${id}-r`,['#e9f7b0','#5fb84a','#2b7a42','#c7e27a'],1,1)}${linear(`${id}-d`,['#5a0a0a','#2a0505','#7a1808','#1a0303'],1,1)}${blur(`${id}-glow`,2.5)}${noise(`${id}-ash`,'.8',4,'0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .7 -.25')}`;
 return box(item,id,w,defs,`<g clip-path="url(#${id}-frame)"><g clip-path="url(#${id}-rad)"><rect x="8" y="9" width="284" height="382" fill="url(#${id}-r)"/>${leaves}</g><g clip-path="url(#${id}-dire)"><rect x="8" y="9" width="284" height="382" fill="url(#${id}-d)"/><rect x="8" y="9" width="284" height="382" filter="url(#${id}-ash)"/>${cracks}</g><path d="M150 9V${9+w}M150 391V${391-w}" stroke="#fff6d0" stroke-width="1.4"/>${bevel(w,'#fff','#000',.35)}</g><g clip-path="url(#${id}-rad)">${keyline(w,'#e9f7b0',.8)}</g><g clip-path="url(#${id}-dire)">${keyline(w,'#ff6a2a',.8)}</g>${motes}${clash(9+w/2)}${clash(391-w/2)}`);
}

export const WAVE3_BORDERS={cedar,cork,damascus,lapis,'stitched-leather':stitchedLeather,'lantern-festival':lanternFestival,'radiant-dire':radiantDire};
