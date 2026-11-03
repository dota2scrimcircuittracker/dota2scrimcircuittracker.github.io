// Borders for the October 30 wave. Same frame as the October 20 wave (viewBox 8 9 284 382, sides drawn in local space,
// x along the side and y inward). Motion comes from cosmetics-wave2.css: `an()` tags an element with a motion class and
// its cycle, and every animated element is drawn around its own origin. The wave border renderer looks these up by id.
import {rnd,f,OUTER,rim,eachSide,mitres,inner,keyline,frame,sprite,laneTower} from './cosmetics-wave-borders.js';

// A motion class, its cycle in seconds, a start offset into the cycle, and any custom properties it reads.
export const an=(cls,t,delay=0,extra='')=>`class="w2 ${cls}" style="--t:${f(t)}s;animation-delay:${f(-delay)}s;${extra}"`;
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
const cardClip=id=>`<clipPath id="${id}-card"><path d="${OUTER}"/></clipPath>`;
// Something carried round the rim at `inset`, `phase` of the way into its lap. Pass a rotate for things that stay upright.
const ride=(inset,t,phase,body,rotate='auto',extra='')=>`<g ${an('ride',t,phase*t,`offset-path:path('${rim(inset)}');offset-rotate:${rotate};${extra}`)}>${body}</g>`;
const glint=(x,y,s,k,color='#fff')=>`<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})"><path d="M0 -3L.6 -.6 3 0 .6 .6 0 3 -.6 .6 -3 0 -.6 -.6Z" fill="${color}" ${an('pulse',1.6+rnd(k)*1.6,rnd(k+3)*3,'--lo:0')}/></g>`;

// Rare

function chalkboard(item,id){
 const w=13,chalk='#eef3ea';
 const tally=(x,s)=>`<g opacity="${f(.6+rnd(s)*.35)}">${[0,1,2,3].map(i=>`<path d="M${f(x+i*2.3)} ${f(5.4+rnd(s+i)*.8)}L${f(x+i*2.3+.5)} 11.2"/>`).join('')}<path d="M${f(x-1.4)} 10.6L${f(x+8.6)} 6"/></g>`;
 const clear=(n,x)=>(n===2&&Math.abs(x-142)<36)||(n===1&&Math.abs(x-191)<16)||(n===3&&Math.abs(x-241)<16);
 const body=(len,n)=>{let out='';for(let x=22,k=0;x<len-26;x+=38+rnd(n*50+k)*46,k++)if(!clear(n,x))out+=tally(x,n*50+k);return `<g stroke="${chalk}" stroke-width=".7" stroke-linecap="round" fill="none">${out}</g>`;};
 const wood=`<path d="${rim(2)}" fill="none" stroke="#9a6a35" stroke-width="4"/><path d="${rim(1.2)}" fill="none" stroke="#6b4520" stroke-width=".4" stroke-dasharray="30 6 12 9"/><path d="${rim(2.9)}" fill="none" stroke="#c99a5b" stroke-width=".35" stroke-dasharray="18 7 40 5"/><path d="${rim(4)}" fill="none" stroke="#3b2410" stroke-width=".7"/>`;
 const dust=Array.from({length:14},(_,k)=>{const n=k%4,[x,y]=at(n,20+rnd(k)*(LENS[n]-40),w-1);return `<g transform="translate(${f(x)} ${f(y)})"><circle r="${f(.4+rnd(k+20)*.6)}" fill="${chalk}" ${an('move',5+rnd(k+40)*4,rnd(k+60)*9,`--dx:${f((rnd(k+80)-.5)*8)}px;--dy:${f(10+rnd(k+90)*12)}px;--o:.7`)}/></g>`;}).join('');
 const doodles=`<g stroke="${chalk}" stroke-width=".7" fill="none" stroke-linecap="round" opacity=".85"><circle cx="283.5" cy="200" r="3"/><path d="M282.4 199.2h.1M284.6 199.2h.1M282 201.1q1.5 1.2 3 0"/><path transform="translate(16.5 150)" d="M0 -3.4l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3Z"/></g><text x="150" y="386" text-anchor="middle" font-family="RoundCaveat,cursive" font-size="8" fill="${chalk}" opacity=".85">gg wp</text>`;
 const eraser=`<g transform="translate(238 385) rotate(-4)"><rect x="-11" y="-3.4" width="22" height="6.8" rx="1" fill="#7a5530"/><rect x="-11" y=".2" width="22" height="3.2" rx="1" fill="#d9d4cc"/></g>`;
 const defs=`<filter id="${id}-haze" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".05 .4" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .9 0 0 0 0 .95 0 0 0 0 .9 0 0 0 .5 -.12"/></filter>`;
 return box(item,id,w,defs,`${band(id,w,'#263b2f',body)}<g clip-path="url(#${id}-frame)"><rect x="8" y="9" width="284" height="382" filter="url(#${id}-haze)"/>${wood}</g>${keyline(w,'#c99a5b',.4)}${doodles}${eraser}${dust}`);
}

function buildingBricks(item,id){
 const w=11,colors=['#d62d20','#0057b8','#ffd700','#009b48','#f2f2f2','#ff7f00'];let seed=0;
 const brick=(x,L,c)=>`<rect x="${f(x+.3)}" y=".35" width="${f(L-.6)}" height="${w-.7}" rx="1" fill="${c}" stroke="#000" stroke-opacity=".35" stroke-width=".4"/><rect x="${f(x+.9)}" y=".8" width="${f(L-1.8)}" height="1" rx=".5" fill="#fff" opacity=".25"/>${Array.from({length:Math.round(L/8)},(_,k)=>[3.1,7.9].map(y=>`<circle cx="${f(x+4+k*8)}" cy="${y}" r="1.85" fill="${c}" stroke="#000" stroke-opacity=".3" stroke-width=".3"/><circle cx="${f(x+3.5+k*8)}" cy="${f(y-.5)}" r=".65" fill="#fff" opacity=".45"/>`).join('')).join('')}`;
 const body=len=>{let x=-4,out='';while(x<len){const L=rnd(++seed)>.5?24:16;out+=brick(x,L,colors[Math.floor(rnd(seed+99)*colors.length)]);x+=L;}return out;};
 const loose=`<g transform="translate(264 334) rotate(-12)"><ellipse cy="7" rx="7" ry="1.6" fill="#000" opacity=".3"/><g ${an('bob',.9,0,'--dy:-6px')}><g transform="translate(-8 -5.5)">${brick(0,16,'#ffd700')}</g></g></g>`;
 return box(item,id,w,'',`${band(id,w,'#222',body)}${keyline(w,'#ffd700',.35)}${loose}`);
}

function colouredPencils(item,id){
 const w=11,inks=[['#ffd54a','#f4b400','#c98a00','#3a3a3a'],['#ff7b86','#e63946','#a4161a','#e63946'],['#5fd3c6','#2a9d8f','#1d6f65','#2a9d8f'],['#b07ce0','#7b2cbf','#4f1a80','#7b2cbf']];
 // Pinwheel: each pencil starts in its own corner and points at the next pencil's eraser.
 const pencil=(len,[hi,mid,lo,lead])=>{const L=len-w,tip=L-17;return `<rect x="0" y=".6" width="9" height="${w-1.2}" rx="2" fill="#f7a1b5"/><rect x="0" y=".6" width="9" height="2" rx="1" fill="#fff" opacity=".35"/><rect x="8" y=".3" width="6" height="${w-.6}" fill="url(#${id}-ferrule)"/><path d="M9.5 .3V${w-.3}M11 .3V${w-.3}M12.5 .3V${w-.3}" stroke="#6d7177" stroke-width=".35"/><rect x="14" width="${tip-14}" height="3.7" fill="${hi}"/><rect x="14" y="3.7" width="${tip-14}" height="3.6" fill="${mid}"/><rect x="14" y="7.3" width="${tip-14}" height="3.7" fill="${lo}"/><path d="M${tip} 0L${L-3} ${w/2-.6}V${w/2+.6}L${tip} ${w}Z" fill="#f0c995"/><path d="M${tip} 0l1.6 1.8 1.4-1 .9 2.6M${tip} ${w}l1.6-1.8 1.4 1 .9-2.6" fill="none" stroke="${lo}" stroke-width=".7"/><path d="M${L-8} ${w/2-1.9}L${L-1} ${w/2}L${L-8} ${w/2+1.9}Z" fill="${lead}"/><text x="40" y="6.6" font-family="RoundMono,monospace" font-size="3.4" fill="${lo}">AD2L · No.2 HB</text>`;};
 const defs=linear(`${id}-ferrule`,['#eef1f4','#8b9096','#e7eaee','#6d7177']);
 const line=`<path d="${rim(w+1.6)}" pathLength="1" fill="none" stroke="#6a6a72" stroke-width=".55" stroke-linecap="round" opacity=".75" ${an('draw',10)}/>`;
 return box(item,id,w,defs,`<g clip-path="url(#${id}-frame)">${eachSide((len,n)=>pencil(len,inks[n]))}</g>${line}`);
}

function postageStamp(item,id){
 const w=13,holes=eachSide(len=>Array.from({length:Math.floor(len/7.2)+1},(_,k)=>`<circle cx="${f(k*7.2+(len%7.2)/2)}" cy="0" r="2.3" fill="#000"/>`).join(''));
 // Engraved guilloche: two sine threads out of step, woven along a red frame inside the perforated paper.
 const wave=(len,ph)=>{let d=`M0 ${f(6.5+1.5*Math.sin(ph))}`;for(let x=1;x<=len;x++)d+=`L${x} ${f(6.5+1.5*Math.sin(x/2.1+ph))}`;return d;};
 const engraving=len=>`<rect y="3.4" width="${len}" height="6.2" fill="#b3202a"/>${[0,Math.PI].map(ph=>`<path d="${wave(len,ph)}" fill="none" stroke="#f6dcc8" stroke-width=".35"/>`).join('')}<path d="M0 3.4H${len}M0 9.6H${len}" stroke="#6e0f15" stroke-width=".5"/><path d="M0 11.3H${len}" stroke="#1f3a6b" stroke-width=".45"/>`;
 const rosette=n=>corner(n,`<g transform="translate(6.5 6.5)"><circle r="4.6" fill="#f3eee0" stroke="#6e0f15" stroke-width=".5"/>${[0,45,90,135].map(a=>`<ellipse rx="3.6" ry="1.05" fill="none" stroke="#b3202a" stroke-width=".45" transform="rotate(${a})"/>`).join('')}<circle r=".9" fill="#b3202a"/></g>`);
 const label=(y,t,wd)=>`<rect x="${f(150-wd/2)}" y="${f(y-5)}" width="${wd}" height="7" rx="1" fill="#f3eee0" stroke="#6e0f15" stroke-width=".5"/><text x="150" y="${f(y)}" text-anchor="middle" font-family="Georgia,serif" font-size="4.6" fill="#b3202a" letter-spacing=".6">${t}</text>`;
 const value=`<g transform="translate(22 384)"><rect x="-8" y="-5.4" width="16" height="8" rx="1" fill="#f3eee0" stroke="#6e0f15" stroke-width=".5"/><text y="1" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="6" fill="#1f3a6b">50¢</text></g>`;
 const defs=`<mask id="${id}-perf" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="400"><rect width="300" height="400" fill="#fff"/>${holes}</mask><filter id="${id}-paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="5"/><feColorMatrix values="0 0 0 0 .5 0 0 0 0 .45 0 0 0 0 .35 0 0 0 .25 0"/></filter><filter id="${id}-lift" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy=".8" stdDeviation=".9" flood-opacity=".55"/></filter>`;
 const mark=`<g transform="translate(252 352) rotate(-14)"><g ${an('thump',7,1)}><g fill="none" stroke="#24283a" stroke-opacity=".6"><circle r="15" stroke-width="1.1"/><circle r="11.5" stroke-width=".5"/>${[-6,-2,2,6].map(y=>`<path d="M-62 ${y}q6 -3 12 0t12 0 12 0 12 0" stroke-width="1"/>`).join('')}</g><text y="-1.5" text-anchor="middle" font-family="RoundMono,monospace" font-size="4.6" fill="#24283a" fill-opacity=".7">OCT 30</text><text y="5" text-anchor="middle" font-family="RoundMono,monospace" font-size="4.6" fill="#24283a" fill-opacity=".7">2026</text></g></g>`;
 return box(item,id,w,defs,`<g filter="url(#${id}-lift)"><g mask="url(#${id}-perf)">${band(id,w,'#f3eee0',engraving)}<g clip-path="url(#${id}-frame)"><rect x="8" y="9" width="284" height="382" filter="url(#${id}-paper)"/></g>${[0,1,2,3].map(rosette).join('')}${label(17.6,'★ AD2L POST ★',62)}${label(387.4,'SCRIM LEAGUE · 2026',74)}${value}</g></g><path d="${inner(w)}" fill="none" stroke="#0b0a09" stroke-opacity=".6" stroke-width="1.2"/>${mark}`);
}

function bambooGrove(item,id){
 const w=12;let seed=0;
 const nodes=LENS.map(len=>{const out=[];let x=10+rnd(++seed)*20;while(x<len-8){out.push(x);x+=30+rnd(++seed)*16;}return out;});
 const leaf=(x,y,a,s)=>`<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)}) scale(${f(s)})"><g ${an('sway',3+rnd(++seed)*3,rnd(seed+7)*4,'--a:7deg')}><path d="M0 0C4 -2.6 13 -2.4 21 0C13 2.2 4 2.4 0 0Z" fill="url(#${id}-leaf)"/><path d="M1 0H19" stroke="#2f5a16" stroke-width=".35"/></g></g>`;
 const culm=(len,n)=>`<rect y="1" width="${len}" height="${w-2}" fill="url(#${id}-culm)"/>${nodes[n].map(x=>`<rect x="${f(x-1.3)}" y="1" width="2.6" height="${w-2}" fill="#2f5a16" opacity=".55"/><rect x="${f(x-.4)}" y="1" width=".9" height="${w-2}" fill="#e4f2b8" opacity=".75"/>`).join('')}<rect y="1.6" width="${len}" height="1.4" fill="#fff" opacity=".2"/>`;
 const leaves=eachSide((len,n)=>nodes[n].filter((_,k)=>k%2===0).map((x,k)=>leaf(x+1,w-2,k%2?35+rnd(n*9+k)*30:115+rnd(n*9+k)*30,.75+rnd(n+k)*.4)).join(''));
 const lash=[0,1,2,3].map(n=>corner(n,`<g stroke="#8b5a2b" stroke-width="1.1" stroke-linecap="round"><path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5"/><path d="M0 4H12M0 8H12M4 0V12M8 0V12" stroke-width=".7" stroke="#c49a5a"/></g>`)).join('');
 const defs=linear(`${id}-culm`,['#3f6e22','#a8d86c','#7fb24a','#4e8a2a','#2f5a16'])+linear(`${id}-leaf`,['#4f8f2f','#a8d86c'],1,0);
 return box(item,id,w,defs,`${band(id,w,'#2a3a1a',culm)}${keyline(w,'#d8c48a',.35)}${lash}${leaves}`);
}

function honeycomb(item,id){
 const w=12,r=3.2,W=f(r*Math.sqrt(3)),H=f(r*3);
 const hex=(cx,cy)=>`M${Array.from({length:6},(_,k)=>{const a=(k*60-90)*Math.PI/180;return `${f(cx+Math.cos(a)*r*.9)} ${f(cy+Math.sin(a)*r*.9)}`;}).join('L')}Z`;
 const centres=[[0,0],[W,0],[W/2,1.5*r],[0,3*r],[W,3*r]];
 const defs=`<pattern id="${id}-comb" width="${W}" height="${H}" patternUnits="userSpaceOnUse"><rect width="${W}" height="${H}" fill="#8a5a00"/><path d="${centres.map(([x,y])=>hex(x,y)).join('')}" fill="#f2c14e"/></pattern><pattern id="${id}-honey" width="${W}" height="${H}" patternUnits="userSpaceOnUse">${centres.map(([x,y])=>`<path d="${hex(x,y)}" fill="url(#${id}-drop)"/>`).join('')}</pattern>${radial(`${id}-drop`,['#ffe08a','#e08a00','#8a4200'],.4,.35)}<filter id="${id}-patch" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".07" seed="4"/><feColorMatrix values="9 0 0 0 -4.2 9 0 0 0 -4.2 9 0 0 0 -4.2 0 0 0 0 1"/></filter><mask id="${id}-filled" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="400"><rect width="300" height="400" filter="url(#${id}-patch)"/></mask>`;
 const bee=`<g ${an('bob',.35,0,'--dy:-1.2px')}><ellipse rx="2.8" ry="1.7" fill="#ffc300"/><path d="M-.9 -1.6V1.6M.9 -1.6V1.6" stroke="#1a1208" stroke-width=".8"/><circle cx="2.8" r="1" fill="#1a1208"/><g ${an('flap',.08,0,'--fy:.25')}><ellipse cx="-.4" cy="-2.2" rx="1.8" ry="1.1" fill="#eaf6ff" opacity=".8"/><ellipse cx="-.4" cy="2.2" rx="1.8" ry="1.1" fill="#eaf6ff" opacity=".8"/></g></g>`;
 const bees=[0,.37,.71].map((p,k)=>ride(w/2+(k-1)*2.4,26+k*7,p,bee)).join('');
 const glints=Array.from({length:10},(_,k)=>{const n=k%4,[x,y]=at(n,15+rnd(k+5)*(LENS[n]-30),2+rnd(k+9)*(w-4));return glint(x,y,.7,k+30,'#fff6c8');}).join('');
 return box(item,id,w,defs,`<g clip-path="url(#${id}-frame)"><rect x="8" y="9" width="284" height="382" fill="url(#${id}-comb)"/><rect x="8" y="9" width="284" height="382" fill="url(#${id}-honey)" mask="url(#${id}-filled)"/></g>${keyline(w,'#ffd166',.5)}${glints}${bees}`);
}

function pianoKeys(item,id){
 const w=13,kw=6.4;let count=0;
 const keys=len=>{const n=Math.floor(len/kw),x0=(len-n*kw)/2;let out='',blacks='';for(let i=0;i<n;i++){const x=x0+i*kw,s=++count;
  out+=`<rect x="${f(x+.2)}" width="${f(kw-.4)}" height="${w}" rx=".8" fill="url(#${id}-ivory)" stroke="#7d7a72" stroke-width=".3"/><rect x="${f(x+.2)}" width="${f(kw-.4)}" height="${w}" rx=".8" fill="#ffd166" opacity="0" ${an('press',5+rnd(s)*7,rnd(s+300)*12,'--o:.85')}/>`;
  if(i<n-1&&[0,1,3,4,5].includes(i%7))blacks+=`<rect x="${f(x+kw-1.9)}" width="3.8" height="${f(w*.6)}" rx=".6" fill="url(#${id}-ebony)"/>`;}return out+blacks;};
 const notes=Array.from({length:8},(_,k)=>{const n=k%4,[x,y]=at(n,30+rnd(k)*(LENS[n]-60),w),dx=(150-x)/Math.hypot(150-x,200-y)*22,dy=(200-y)/Math.hypot(150-x,200-y)*22;return `<g transform="translate(${f(x)} ${f(y)})"><text font-family="Georgia,serif" font-size="8" fill="#ffd166" ${an('move',4+rnd(k+4)*3,rnd(k+8)*7,`--dx:${f(dx)}px;--dy:${f(dy)}px;--o:.85`)}>${k%2?'♪':'♫'}</text></g>`;}).join('');
 const defs=linear(`${id}-ivory`,['#fffdf6','#e9e4d6'])+linear(`${id}-ebony`,['#3a3a3a','#050505']);
 return box(item,id,w,defs,`${band(id,w,'#111',keys)}${keyline(w,'#d9d4c4',.4)}${notes}`);
}

function frostedDonut(item,id){
 const w=13,colors=['#ff2d55','#ffcc00','#00c853','#2979ff','#5a2d0c','#aa00ff','#ff6d00'];let s=0;
 const edge=len=>{const pts=[];for(let x=len;x>=0;x-=3){const drip=rnd(Math.floor(x/23)+len)>.7?Math.max(0,Math.sin((x%23)/23*Math.PI))*2.6:0;pts.push(`${f(x)} ${f(8.4+1.1*Math.sin(x/5.5)+drip)}`);}return `M0 0H${len}L${pts.join('L')}Z`;};
 // Sprinkles are saturated with a dark rim so they read on the pink.
 const sprinkles=len=>Array.from({length:Math.floor(len/4)},()=>{const k=++s;return `<rect x="-1.9" y="-.6" width="3.8" height="1.2" rx=".6" fill="${colors[k%colors.length]}" stroke="#2a0a1a" stroke-opacity=".45" stroke-width=".3" transform="translate(${f(rnd(k)*len)} ${f(1.6+rnd(k+50)*5.4)}) rotate(${f(rnd(k+90)*180)})"/>`;}).join('');
 // A soft wet highlight runs along the icing, with a crisp line on its crest.
 const icing=eachSide(len=>`<g clip-path="url(#${id}-mitre-${len})"><path d="${edge(len)}" fill="url(#${id}-icing)"/><path d="M0 3.4H${len}" stroke="#fff" stroke-width="2.2" opacity=".5" filter="url(#${id}-gloss)"/><path d="M0 1.6H${len}" stroke="#fff" stroke-width=".8" opacity=".7"/>${sprinkles(len)}</g>`);
 const glints=Array.from({length:14},(_,k)=>{const n=k%4,[x,y]=at(n,14+rnd(k+20)*(LENS[n]-28),2.4+rnd(k+40)*3);return glint(x,y,.7+rnd(k+60)*.4,k+80);}).join('');
 const defs=`${linear(`${id}-dough`,['#e8b878','#b8742f'])}${linear(`${id}-icing`,['#ffd6ea','#ff9fd0','#f07ab8'])}${linear(`${id}-sheen`,['#fff0','#fffe','#fff0'],1,0)}${blur(`${id}-gloss`,.9)}<mask id="${id}-bite" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="400"><rect width="300" height="400" fill="#fff"/><circle cx="292" cy="391" r="14" fill="#000"/><circle cx="277" cy="392" r="6" fill="#000"/><circle cx="293" cy="376" r="6" fill="#000"/></mask>`;
 const crumbs=Array.from({length:6},(_,k)=>`<circle cx="${f(268+rnd(k)*14)}" cy="${f(366+rnd(k+7)*14)}" r="${f(.5+rnd(k+3)*.7)}" fill="#d9a05a"/>`).join('');
 return box(item,id,w,defs,`<g mask="url(#${id}-bite)">${band(id,w,`url(#${id}-dough)`)}${icing}<g clip-path="url(#${id}-frame)"><g ${an('slide',6,0,'--dx:420px')}><rect x="-90" y="0" width="34" height="420" fill="url(#${id}-sheen)" transform="skewX(-20)" opacity=".8"/></g></g>${keyline(w,'#ff8fc8',.35)}${glints}</g>${crumbs}`);
}

function zipper(item,id){
 const w=12;
 const teeth=len=>Array.from({length:Math.floor(len/3)},(_,k)=>`<rect x="${f(k*3+.4)}" y="${k%2?5.6:2.2}" width="2.2" height="4.2" rx=".7" fill="url(#${id}-tooth)" stroke="#4b5360" stroke-width=".25"/>`).join('');
 const body=len=>`<path d="M0 1.2H${len}M0 ${w-1.2}H${len}" stroke="#8fa1b8" stroke-width=".35" stroke-dasharray="1.5 1"/>${teeth(len)}`;
 const slider=`<path d="M-6 -4.4H4.5L7 -2V2L4.5 4.4H-6Z" fill="url(#${id}-slider)" stroke="#3b414b" stroke-width=".4"/><rect x="-3" y="-1.2" width="6" height="2.4" rx="1" fill="#59606b"/><g ${an('sway',1.6,0,'--a:16deg')}><path d="M-1.4 0H1.4L2.2 13Q0 15 -2.2 13Z" fill="url(#${id}-slider)" stroke="#3b414b" stroke-width=".4"/><circle cy="11" r="1.1" fill="#25303f"/></g>`;
 const defs=linear(`${id}-tooth`,['#f2f5f8','#a9b0ba','#6b7380'])+linear(`${id}-slider`,['#eef1f4','#9aa3ae','#d7dce2'],1,1);
 return box(item,id,w,defs,`${band(id,w,'#25303f',body)}${keyline(w,'#c7ccd3',.4)}${ride(w/2,16,0,slider)}`);
}

function crayonBox(item,id){
 const w=12,cols=['#e63946','#ffb703','#2a9d8f','#457b9d'];
 const wob=(inset,seed)=>{const l=8+inset,t=9+inset,r=292-inset,b=391-inset,pts=[];let k=0;const push=(x,y)=>{k++;pts.push(`${f(x+(rnd(seed+k)-.5)*1.1)} ${f(y+(rnd(seed+k+500)-.5)*1.1)}`);};
  for(let x=l;x<r;x+=7)push(x,t);for(let y=t;y<b;y+=7)push(r,y);for(let x=r;x>l;x-=7)push(x,b);for(let y=b;y>t;y-=7)push(l,y);return `M${pts.join('L')}Z`;};
 const lines=cols.map((c,k)=>`<path d="${wob(1.6+k*2.9,k*1000)}" pathLength="1" fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="round" filter="url(#${id}-wax)" ${k===0?an('draw',9):''}/>`).join('');
 const scribble=(x,y,c,flip)=>`<path d="M0 0${Array.from({length:9},(_,i)=>`L${f(i*2+2)} ${i%2?-16+i*1.6:0}`).join('')}" fill="none" stroke="${c}" stroke-width="1.3" stroke-linejoin="round" filter="url(#${id}-wax)" transform="translate(${x} ${y}) scale(${flip?-1:1} 1)" opacity=".85"/>`;
 const crayon=`<g transform="translate(268 238) rotate(-62)"><rect x="-14" y="-3" width="24" height="6" rx="1" fill="#2a9d8f"/><path d="M-10 -3V3M-7 -3V3M5 -3V3M7 -3V3" stroke="#14504a" stroke-width=".7"/><text x="-1.5" y="1.4" text-anchor="middle" font-family="RoundMarker,sans-serif" font-size="3.6" fill="#fff">TEAL</text><path d="M10 -2.6L16 0L10 2.6Z" fill="#2a9d8f"/><rect x="-14" y="-3" width="24" height="1.6" fill="#fff" opacity=".25"/></g>`;
 const defs=`<filter id="${id}-wax" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="9" result="n"/><feColorMatrix in="n" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.4 1.45" result="holes"/><feComposite in="SourceGraphic" in2="holes" operator="in"/></filter>`;
 return box(item,id,w,defs,`${band(id,w,'#fbf6ea')}<g clip-path="url(#${id}-frame)">${lines}</g>${scribble(262,372,'#ffd166',false)}${crayon}`);
}

// Epic

function koiPond(item,id){
 const w=14,c=w/2;
 const koi=(c1,c2)=>`<g transform="translate(-5 0)"><g ${an('sway',.9,0,'--a:14deg')}><path d="M0 0L-4 -3Q-3 0 -4 3Z" fill="${c1}" opacity=".9"/></g></g><path d="M5.5 0C5 -2.4 1 -2.8 -5 -.8L-5.5 0L-5 .8C1 2.8 5 2.4 5.5 0Z" fill="${c1}"/><path d="M3 -1.4C1 -1 -1 .4 -3 -.3" stroke="${c2}" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M1 -1.9L-.5 -3.4M1 1.9L-.5 3.4" stroke="${c1}" stroke-width="1" stroke-linecap="round"/><circle cx="4.2" cy="-.7" r=".35" fill="#111"/>`;
 const fish=[['#ff7b29','#fff'],['#f4f1ea','#e63946'],['#ffb703','#1a1a1a'],['#ff7b29','#1a1a1a'],['#f4f1ea','#ff7b29']].map(([a,b],k)=>ride(c+(k%3-1)*2.4,22+k*5,k*.21,koi(a,b),k%2?'auto 180deg':'auto',k%2?'animation-direction:reverse':'')).join('');
 const pads=Array.from({length:9},(_,k)=>{const n=k%4,[x,y]=at(n,20+rnd(k+2)*(LENS[n]-40),c+(rnd(k+6)-.5)*4);return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rnd(k)*360)})"><path d="M0 0L4.6 -1.2A4.8 4.8 0 1 1 4.6 1.2Z" fill="#3f8f3a" stroke="#255e22" stroke-width=".4"/><path d="M0 0L-3 -2M0 0L-3 2M0 0L-3.8 0" stroke="#6cc05f" stroke-width=".3"/>${k%3===0?`<g transform="translate(-1 0)">${[0,72,144,216,288].map(a=>`<ellipse cx="1.4" rx="1.4" ry=".7" fill="#ff9ec0" transform="rotate(${a})"/>`).join('')}<circle r=".7" fill="#ffd34d"/></g>`:''}</g>`;}).join('');
 const ripples=Array.from({length:7},(_,k)=>{const n=k%4,[x,y]=at(n,25+rnd(k+40)*(LENS[n]-50),c);return `<g transform="translate(${f(x)} ${f(y)})"><circle r="5" fill="none" stroke="#e6fbff" stroke-width=".6" ${an('pop',3.6+rnd(k)*2,rnd(k+9)*5,'--s0:.2;--s1:1.4;--o:.7')}/></g>`;}).join('');
 const defs=linear(`${id}-water`,['#0b4a52','#1f8a8f','#0e5c63']);
 return box(item,id,w,defs,`${band(id,w,`url(#${id}-water)`)}<g clip-path="url(#${id}-frame)"><path d="${rim(w*.35)}" fill="none" stroke="#9fe8ef" stroke-opacity=".25" stroke-width=".5" stroke-dasharray="6 9" ${an('dash',6,0,'--d:-30')}/>${ripples}${fish}${pads}</g>${keyline(w,'#9fe8ef',.35)}`);
}

function modelRailway(item,id){
 const w=13,c=w/2,T=26,gap=.012;
 const car=(fill,roof)=>`<rect x="-6" y="-3.2" width="12" height="6.4" rx="1" fill="${fill}" stroke="#1a1a1a" stroke-width=".4"/><rect x="-5" y="-2.2" width="10" height="4.4" rx=".6" fill="${roof}"/>`;
 const engine=`<rect x="-6" y="-3.2" width="12.5" height="6.4" rx="1.2" fill="#1d1f24" stroke="#000" stroke-width=".4"/><rect x="-1" y="-2.6" width="7" height="5.2" rx="2.6" fill="#b3122e"/><circle cx="4.8" r="1.2" fill="#2b2b2b"/><rect x="-6" y="-3" width="4" height="6" fill="#3a3d44"/>${[0,1,2].map(k=>`<g transform="translate(4.8 0)"><circle r="1.7" fill="#e9eef2" ${an('move',1.4,k*.47,'--dx:-16px;--dy:-2px;--o:.75')}/></g>`).join('')}`;
 const train=[engine,car('#2f6f3a','#d9c9a0'),car('#2f6f3a','#d9c9a0'),car('#7a1414','#3a2a2a')].map((body,k)=>ride(c,T,1-k*gap,body)).join('');
 const trees=Array.from({length:16},(_,k)=>{const n=k%4,[x,y]=at(n,14+rnd(k+3)*(LENS[n]-28),1.4);return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.3+rnd(k)*.6)}" fill="#244a18"/><circle cx="${f(x-.4)}" cy="${f(y-.4)}" r=".6" fill="#5a9a3a"/>`;}).join('');
 const track=`<path d="${rim(c)}" fill="none" stroke="#8a8070" stroke-width="8"/><path d="${rim(c)}" fill="none" stroke="#5a3a20" stroke-width="7" stroke-dasharray="1.4 2.6"/>${[c-2.3,c+2.3].map(i=>`<path d="${rim(i)}" fill="none" stroke="#2a2a2a" stroke-width="1.1"/><path d="${rim(i)}" fill="none" stroke="#d9dde2" stroke-width=".55"/>`).join('')}`;
 const sign=`<g transform="translate(150 15.5)"><rect x="-15" y="-3.6" width="30" height="7.2" rx="1" fill="#1f3a8a" stroke="#fff" stroke-width=".5"/><text y="2" text-anchor="middle" font-family="RoundMono,monospace" font-size="4.4" fill="#fff">AD2L JCT</text></g>`;
 return box(item,id,w,'',`${band(id,w,'#3c6e2e')}<g clip-path="url(#${id}-frame)">${trees}${track}${train}</g>${keyline(w,'#9fd36b',.35)}${sign}`);
}

function lavaLamp(item,id){
 const w=14,tubes=[[8,'l'],[292-w,'r']];
 const blobs=(x0,k0)=>Array.from({length:10},(_,k)=>{const s=k0+k,r=f(3.6+rnd(s)*3),y=f(40+rnd(s+10)*320),dy=f((rnd(s+20)>.5?-1:1)*(60+rnd(s+30)*110));return `<g transform="translate(${f(x0+w/2+(rnd(s+40)-.5)*4)} ${y})"><circle r="${r}" fill="url(#${id}-wax)" ${an('bob',7+rnd(s+50)*8,rnd(s+60)*10,`--dy:${dy}px`)}/></g>`;}).join('');
 const lamp=([x,side],k)=>`<rect x="${x}" y="9" width="${w}" height="382" fill="url(#${id}-liquid)"/><g filter="url(#${id}-goo)">${blobs(x,k*20)}<ellipse cx="${x+w/2}" cy="378" rx="${w/2}" ry="5" fill="url(#${id}-wax)"/><ellipse cx="${x+w/2}" cy="22" rx="${w/2-1}" ry="3" fill="url(#${id}-wax)"/></g><rect x="${x+3}" y="9" width="1.6" height="382" fill="#fff" opacity=".22"/>`;
 const cap=y=>`<rect x="8" y="${y}" width="284" height="${w}" fill="url(#${id}-chrome)"/><path d="M8 ${y+3}H292M8 ${y+w-3}H292" stroke="#fff" stroke-opacity=".5" stroke-width=".4"/>${[30,80,150,220,270].map(x=>`<circle cx="${x}" cy="${y+w/2}" r="1.1" fill="#6b7380"/>`).join('')}`;
 const glow=tubes.map(([x])=>`<rect x="${x===8?22:268}" y="30" width="10" height="340" fill="#ff8a3d" filter="url(#${id}-blur)" ${an('pulse',5,0,'--lo:.12;--hi:.35')}/>`).join('');
 const defs=`${radial(`${id}-wax`,['#ffd166','#ff8a1f','#e8590c'],.4,.35)}${linear(`${id}-liquid`,['#2a0845','#7b2cbf','#2a0845'],1,0)}${linear(`${id}-chrome`,['#f4f6f8','#9aa3ae','#e7eaee','#5b6370'])}${blur(`${id}-blur`,4)}<filter id="${id}-goo" filterUnits="userSpaceOnUse" x="0" y="0" width="300" height="400"><feGaussianBlur stdDeviation="2.2"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 16 -6"/></filter>`;
 return box(item,id,w,defs,`${glow}<g clip-path="url(#${id}-frame)">${tubes.map(lamp).join('')}${cap(9)}${cap(391-w)}</g>${keyline(w,'#c77dff',.4)}`);
}

function marqueeLights(item,id){
 const w=14,c=w/2;let k=0;
 const bulbs=eachSide(len=>{const N=Math.round((len-w)/10),step=(len-w)/N;return Array.from({length:N},(_,j)=>{const i=k++;return `<g transform="translate(${f(c+j*step)} ${c})"><circle r="3" fill="#3a2a10"/><g ${an('chase',1.2,(i%3)*.4,'--lo:.28')}><circle r="5" fill="#ffd34d" opacity=".45" filter="url(#${id}-glow)"/><circle r="2.6" fill="url(#${id}-bulb)"/></g><circle r="2.9" fill="none" stroke="#c9993a" stroke-width=".6"/></g>`;}).join('');});
 const defs=`${linear(`${id}-lacquer`,['#5a0814','#b3122e','#5a0814'])}${radial(`${id}-bulb`,['#fffbe8','#ffcf4a','#d48a00'],.4,.4)}${blur(`${id}-glow`,1.6)}`;
 return box(item,id,w,defs,`${band(id,w,`url(#${id}-lacquer)`)}<g clip-path="url(#${id}-frame)"><path d="${rim(.9)}" fill="none" stroke="#e8c25a" stroke-width="1"/><path d="${rim(w-.9)}" fill="none" stroke="#e8c25a" stroke-width="1"/></g>${bulbs}`);
}

function festivalBunting(item,id){
 const w=9,cols=['#e63946','#f4a261','#2a9d8f','#ffd166','#457b9d','#ff8fab'];let k=0;
 const flags=eachSide(len=>{const N=Math.floor((len-12)/13),step=(len-12)/N;return Array.from({length:N},(_,j)=>{const i=k++,c=cols[i%cols.length];return `<g transform="translate(${f(6+j*step+step/2)} 3.4)"><g ${an('flutter',1.4+rnd(i)*1.2,rnd(i+9)*2,'--a:9deg')}><path d="M-5 0H5L0 13Z" fill="${c}" stroke="#0003" stroke-width=".3"/>${i%3===0?`<circle cy="3" r="1" fill="#fff" opacity=".8"/><circle cx="-1.8" cy="1.2" r=".6" fill="#fff" opacity=".8"/><circle cx="1.8" cy="1.2" r=".6" fill="#fff" opacity=".8"/>`:i%3===1?`<path d="M-3.4 2.4H3.4M-2.4 5H2.4M-1.4 7.6H1.4" stroke="#fff" stroke-opacity=".6" stroke-width=".7"/>`:''}</g></g>`;}).join('');});
 const defs=linear(`${id}-canvas`,['#f6ecd6','#e3d2ae']);
 return box(item,id,w,defs,`${band(id,w,`url(#${id}-canvas)`)}<path d="${rim(3.4)}" fill="none" stroke="#7a5a30" stroke-width="1.2"/><path d="${rim(3.4)}" fill="none" stroke="#c49a5a" stroke-width=".5" stroke-dasharray="1.2 1.2"/>${keyline(w,'#e3d2ae',.3)}${flags}`);
}

function conveyorBelt(item,id){
 const w=13,c=w/2;
 const belt=len=>`<g ${an('slide',.9,0,'--dx:6px')}><rect x="-6" y="2" width="${len+12}" height="${w-4}" fill="url(#${id}-chev)"/></g><rect width="${len}" height="2" fill="url(#${id}-hazard)"/><rect y="${w-2}" width="${len}" height="2" fill="#5a5d63"/>`;
 const rollers=[[8+c,9+c],[292-c,9+c],[292-c,391-c],[8+c,391-c]].map(([x,y])=>`<g transform="translate(${x} ${y})"><circle r="6.5" fill="url(#${id}-roller)" stroke="#111" stroke-width=".6"/><g ${an('spin',1.6)}><path d="M-5 0H5M0 -5V5M-3.5 -3.5L3.5 3.5M3.5 -3.5L-3.5 3.5" stroke="#3a3d44" stroke-width=".9"/></g><circle r="1.4" fill="#c9ccd1"/></g>`).join('');
 const parcel=(k)=>{const pw=7+rnd(k)*3,ph=6+rnd(k+1)*2;return `<g transform="rotate(${f((rnd(k+2)-.5)*8)})"><rect x="${f(-pw/2)}" y="${f(-ph/2)}" width="${f(pw)}" height="${f(ph)}" rx=".5" fill="#c8a165" stroke="#7a5a30" stroke-width=".4"/><path d="M${f(-pw/2)} 0H${f(pw/2)}" stroke="#e6d3a8" stroke-width="1.5"/>${k%2?`<path d="M-1 -1.8l1 -1 1 1M-1 2.6l1 -1 1 1" stroke="#7a1414" stroke-width=".4" fill="none"/>`:''}</g>`;};
 const defs=`<pattern id="${id}-chev" width="6" height="${w}" patternUnits="userSpaceOnUse"><rect width="6" height="${w}" fill="#2b2b2e"/><path d="M1 2L4 ${c}L1 ${w-2}" fill="none" stroke="#4d4f55" stroke-width="1.2"/></pattern><pattern id="${id}-hazard" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#f5c400"/><rect width="2" height="4" fill="#111"/></pattern>${radial(`${id}-roller`,['#e7eaee','#8b939e','#4b5360'],.4,.35)}`;
 return box(item,id,w,defs,`${band(id,w,'#2b2b2e',belt)}${rollers}${Array.from({length:5},(_,k)=>ride(c,34,k/5,parcel(k))).join('')}${keyline(w,'#f5c400',.3)}`);
}

function antFarm(item,id){
 const w=14,c=7,wig=(n,x,len)=>Math.sin((x-c)/(len-2*c)*Math.PI)*(3*Math.sin(x/17+n*2)+1.2*Math.sin(x/5.3+n));
 // One tunnel the whole way round: each side's wiggle fades to the middle line at its ends, so the corners join up.
 const pts=[];for(let n=0;n<4;n++)for(let x=c;x<LENS[n]-c;x+=4)pts.push(at(n,x,c+wig(n,x,LENS[n])));
 const tunnel=`M${pts.map(([x,y])=>`${f(x)} ${f(y)}`).join('L')}Z`;
 const ant=crumb=>`<g ${an('bob',.25,0,'--dy:.3px')}><ellipse cx="1.9" rx=".8" ry=".7" fill="#120a04"/><ellipse cx=".4" rx=".7" ry=".55" fill="#120a04"/><ellipse cx="-1.3" rx="1.2" ry=".85" fill="#120a04"/><path d="M.4 0L-.5 -1.5M.4 0L-.5 1.5M.6 0L1.3 -1.5M.6 0L1.3 1.5M.2 0L-1.1 -1.3M.2 0L-1.1 1.3" stroke="#120a04" stroke-width=".25"/>${crumb?'<rect x="2.6" y="-.65" width="1.3" height="1.3" fill="#fff8e0"/>':''}</g>`;
 const ants=Array.from({length:8},(_,k)=>{const rev=k%3===1,t=38+rnd(k)*22;return `<g ${an('ride',t,rnd(k+9)*t,`offset-path:path('${tunnel}');offset-rotate:${rev?'auto 180deg;animation-direction:reverse':'auto'}`)}>${ant(k%3===2)}</g>`;}).join('');
 const chamber=(x,y,a,rx)=>`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="2.8" fill="#3d2610" transform="rotate(${a} ${f(x)} ${f(y)})"/>`;
 const rooms=[...[0,1,2,3].map(n=>chamber(...at(n,c,c),45+n*90,4)),...Array.from({length:7},(_,k)=>{const n=k%4,x=40+rnd(k+3)*(LENS[n]-80);return chamber(...at(n,x,c+wig(n,x,LENS[n])),n*90,4+rnd(k+5)*2.5);})].join('');
 const grass=eachSide(len=>Array.from({length:Math.floor(len/9)},(_,j)=>`<path d="M${f(j*9+rnd(j)*4)} 0v${f(1+rnd(j+3)*1.4)}" stroke="#5a8a2a" stroke-width=".6"/>`).join(''));
 const defs=`<pattern id="${id}-sand" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#d9b77a"/><circle cx="1.5" cy="2" r=".5" fill="#a8844a"/><circle cx="5" cy="5.5" r=".4" fill="#f2dcae"/><circle cx="4.5" cy="1" r=".3" fill="#8a6a38"/></pattern>${linear(`${id}-glass`,['#fff6','#fff0','#fff3'],1,1)}`;
 return box(item,id,w,defs,`${band(id,w,`url(#${id}-sand)`)}<g clip-path="url(#${id}-frame)">${grass}<path d="${tunnel}" fill="none" stroke="#6b4520" stroke-width="4.4" stroke-linejoin="round"/>${rooms}<path d="${tunnel}" fill="none" stroke="#3d2610" stroke-width="3" stroke-linejoin="round"/>${ants}<rect x="8" y="9" width="284" height="382" fill="url(#${id}-glass)"/></g>${keyline(w,'#f2dcae',.4)}`);
}

function pinball(item,id){
 const w=13,c=w/2;
 const bumper=([x,y,col],k)=>`<g transform="translate(${x} ${y})"><g ${an('hit',2.6+k*.7,k*.9,'--s:1.25')}><circle r="6.2" fill="${col}" stroke="#fff" stroke-width="1"/><circle r="4" fill="#fff" opacity=".9"/><circle r="2.4" fill="${col}"/><circle cx="-1.6" cy="-1.8" r="1" fill="#fff" opacity=".7"/></g></g>`;
 const flipper=(x,flip)=>`<g transform="translate(${x} ${391-c}) scale(${flip?-1:1} 1)"><g ${an('flick',2.4,flip?1.2:0,'--a:-26deg')}><path d="M0 -2.2L15 -.8Q16.4 0 15 .8L0 2.2Q-2.4 0 0 -2.2Z" fill="#f4f6f8" stroke="#e63946" stroke-width=".8"/></g><circle r="1.2" fill="#e63946"/></g>`;
 let k=0;const arrows=eachSide(len=>Array.from({length:Math.floor(len/40)},(_,j)=>{const i=k++;return `<path d="M${30+j*40} ${c-2.2}L${33.5+j*40} ${c}L${30+j*40} ${c+2.2}Z" fill="${['#ff9f1c','#ff4d6d','#3ddc97'][i%3]}" ${an('chase',.9,(i%3)*.3,'--lo:.2')}/>`;}).join(''));
 const score=`<g transform="translate(150 15.5)"><rect x="-23" y="-4.6" width="46" height="9.2" rx="1.5" fill="#120a04" stroke="#ff9f1c" stroke-width=".5"/><text y="2.5" text-anchor="middle" font-family="RoundMono,monospace" font-size="6.4" fill="#ff9f1c" letter-spacing=".8" ${an('blink',1.2,0,'--lo:.5')}>1 337 420</text></g>`;
 const ball=`<circle r="2.5" fill="url(#${id}-steel)"/><circle cx="-.8" cy="-.9" r=".7" fill="#fff"/>`;
 const defs=`${linear(`${id}-field`,['#16205a','#2b59ff','#16205a'])}${radial(`${id}-steel`,['#ffffff','#b9c0c9','#4b5360'],.35,.3)}`;
 return box(item,id,w,defs,`${band(id,w,`url(#${id}-field)`,()=>'')}<g clip-path="url(#${id}-frame)">${arrows}<path d="${rim(.9)}" fill="none" stroke="#e7eaee" stroke-width="1.6"/><path d="${rim(w-.9)}" fill="none" stroke="#e7eaee" stroke-width="1.6"/></g>${[[8+c,120,'#ff4d6d'],[292-c,250,'#3ddc97'],[90,9+c,'#ff9f1c'],[220,391-c,'#b388ff']].map(bumper).join('')}${flipper(122,false)}${flipper(178,true)}${ride(c,5.5,0,ball,'0deg')}${score}`);
}

function dominoRun(item,id){
 const w=16,T=16,u=1.4,pips=[[],[[2.5,2.5]],[[1.4,1.4],[3.6,3.6]],[[1.2,1.2],[2.5,2.5],[3.8,3.8]],[[1.4,1.4],[3.6,1.4],[1.4,3.6],[3.6,3.6]],[[1.2,1.2],[3.8,1.2],[2.5,2.5],[1.2,3.8],[3.8,3.8]],[[1.3,1.1],[3.7,1.1],[1.3,2.5],[3.7,2.5],[1.3,3.9],[3.7,3.9]]];
 const step=13,counts=LENS.map(len=>Math.floor((len-8)/step)),N=counts.reduce((a,b)=>a+b);let idx=0;
 const tile=(a,b)=>`<rect width="14" height="7" rx=".8" fill="#f4efe2" stroke="#2a2a2a" stroke-width=".35"/><rect width="14" height="1.2" rx=".6" fill="#fff" opacity=".6"/><path d="M7 .8V6.2" stroke="#2a2a2a" stroke-width=".35"/>${pips[a].map(([x,y])=>`<circle cx="${f(x*u)}" cy="${f(y*u)}" r=".7" fill="#111"/>`).join('')}${pips[b].map(([x,y])=>`<circle cx="${f(x*u+7)}" cy="${f(y*u)}" r=".7" fill="#111"/>`).join('')}`;
 const body=(len,n)=>Array.from({length:counts[n]},(_,j)=>{const i=idx++;return `<g transform="translate(${f(4+j*step)} 4.5)"><g ${an('topple',T,T-i/N*T)}>${tile(Math.floor(rnd(i)*7),Math.floor(rnd(i+500)*7))}</g></g>`;}).join('');
 const defs=`<filter id="${id}-felt" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="6"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 .1 0 0 0 0 .05 0 0 0 .3 0"/></filter>`;
 return box(item,id,w,defs,`${band(id,w,'#145c3a')}<g clip-path="url(#${id}-frame)"><rect x="8" y="9" width="284" height="382" filter="url(#${id}-felt)"/>${eachSide(body)}</g>${keyline(w,'#c9a36b',.45)}`);
}

function equalizer(item,id){
 const w=14,cols=['#3ddc97','#3ddc97','#a8e05f','#ffd23f','#ff9f1c','#ff4d6d'],seg=w/cols.length;let k=0;
 // Each bar is a column of lit segments with a dark cover hung from its inner end; the cover's drop is the music.
 const bars=len=>{const N=Math.floor((len-w*2)/4.2),x0=(len-N*4.2)/2;return Array.from({length:N},(_,j)=>{const i=k++,x=x0+j*4.2;return `${cols.map((c,s)=>`<rect x="${f(x)}" y="${f(s*seg+.3)}" width="3.2" height="${f(seg-.6)}" rx=".4" fill="${c}"/>`).join('')}<g transform="translate(${f(x-.2)} ${w})"><rect y="${-w}" width="3.6" height="${w}" fill="#0b0d14" ${an('eq',1.4+rnd(i)*1.2,rnd(i+300)*3)}/></g>`;}).join('');};
 // Corner speakers on a shared beat: the cone punches out and a ring of bass spreads from it, with a bigger glow
 // every fourth beat.
 const B=.9,speaker=n=>corner(n,`<g transform="translate(9 9)">${[1,2,3].map(b=>`<circle r="9" fill="none" stroke="#29f0ff" stroke-width="1" ${an('pop',B*4,B*b,'--s0:.9;--s1:2.6;--o:.55')}/>`).join('')}<circle r="14" fill="url(#${id}-blast)" ${an('hit',B*4,0,'--s:1.6')}/><circle r="9.4" fill="#1a1d26" stroke="#3a3f4d" stroke-width=".8"/><circle r="8.2" fill="none" stroke="#29f0ff" stroke-width=".4" opacity=".6"/><g ${an('hit',B,0,'--s:1.28')}><circle r="7" fill="url(#${id}-cone)"/><circle r="4.4" fill="none" stroke="#000" stroke-width=".4" opacity=".5"/><circle r="2.2" fill="#2a2e38" stroke="#666" stroke-width=".4"/></g></g>`);
 const defs=`${radial(`${id}-cone`,['#6a7080','#2a2e38','#111'])}${radial(`${id}-blast`,['#29f0ff88','#29f0ff22','#29f0ff00'])}${blur(`${id}-glow`,1.4)}`;
 return box(item,id,w,defs,`${band(id,w,'#0b0d14',bars)}<path d="${inner(w)}" fill="none" stroke="#29f0ff" stroke-width="1.6" filter="url(#${id}-glow)" ${an('press',B,0,'--o:.9')}/>${keyline(w,'#29f0ff',.5)}${[0,1,2,3].map(speaker).join('')}`);
}

// Legendary

function dayNight(item,id){
 const w=14,c=w/2,T=30;
 const sky=`<linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="#3d9cf5" ${an('skyhi',T)}/><stop offset="1" stop-color="#cdeeff" ${an('skylo',T)}/></linearGradient>`;
 const stars=Array.from({length:40},(_,k)=>{const n=k%4,[x,y]=at(n,8+rnd(k)*(LENS[n]-16),1.5+rnd(k+60)*(w-3));return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(.3+rnd(k+90)*.5)}" fill="#fff"/>`;}).join('');
 const sun=`<g ${an('spin',12)}>${Array.from({length:8},(_,k)=>`<path d="M0 -5.6V-7.8" stroke="#ffd34d" stroke-width="1" stroke-linecap="round" transform="rotate(${k*45})"/>`).join('')}</g><circle r="4.4" fill="url(#${id}-sun)"/>`;
 const moon=`<circle r="4.6" fill="#f4f1de" opacity=".25" filter="url(#${id}-soft)"/><path d="M1.6 -4.4A4.6 4.6 0 1 0 1.6 4.4A3.6 3.6 0 1 1 1.6 -4.4Z" fill="#f4f1de"/>`;
 const cloud=`<g opacity=".9"><circle r="2.4" cx="-2.6" fill="#fff"/><circle r="3.2" cx=".8" cy="-.8" fill="#fff"/><circle r="2.2" cx="3.8" fill="#fff"/><rect x="-4.8" y="0" width="10.6" height="2.4" rx="1.2" fill="#fff"/></g>`;
 const shooting=`<g transform="translate(60 14) rotate(8)"><path d="M0 0H-26" stroke="url(#${id}-trail)" stroke-width="1" ${an('flash',T/2,2)}/></g>`;
 const defs=`${sky}${radial(`${id}-sun`,['#fffbe0','#ffd34d','#ff9a1f'])}${blur(`${id}-soft`,1.4)}${`<linearGradient id="${id}-trail" gradientUnits="userSpaceOnUse" x1="0" x2="-26">${stops(['#fff','#fff0'])}</linearGradient>`}`;
 return box(item,id,w,defs,`${band(id,w,`url(#${id}-sky)`)}<g clip-path="url(#${id}-frame)"><g ${an('night',T)}>${stars}${shooting}</g>${Array.from({length:6},(_,k)=>ride(c+(k%2?2:-2),70,k/6,cloud,'0deg')).join('')}${ride(c,T,.12,sun,'0deg')}${ride(c,T,.62,moon,'0deg')}</g>${keyline(w,'#cdeeff',.4)}`);
}

function fireworksShow(item,id){
 const w=12,T=6.4,cols=['#ff4d6d','#ffd23f','#4cc9f0','#b388ff','#3ddc97','#ff9f1c','#ff6ad5'];
 // Shells climb the side bands and burst on the rim, so every burst spills in over the art.
 const shells=[[15,300],[285,330],[15,190],[285,240],[15,336],[285,150],[15,96]];
 const burst=(col,k)=>{const rays=Array.from({length:18},(_,i)=>{const a=i/18*Math.PI*2+k;return `<path d="M${f(Math.cos(a)*4)} ${f(Math.sin(a)*4)}L${f(Math.cos(a)*30)} ${f(Math.sin(a)*30)}" stroke="${col}" stroke-width="1.5" stroke-linecap="round"/><circle cx="${f(Math.cos(a)*32)}" cy="${f(Math.sin(a)*32)}" r="1.6" fill="#fff"/>`;}).join('');
  const glitter=Array.from({length:14},(_,i)=>{const a=rnd(k*20+i)*Math.PI*2,r=12+rnd(k*20+i+5)*26;return `<circle cx="${f(Math.cos(a)*r)}" cy="${f(Math.sin(a)*r+6)}" r=".9" fill="#fff6d0" ${an('blink',.18+rnd(i)*.2,rnd(i+3)*.3,'--lo:0')}/>`;}).join('');
  return `<g filter="url(#${id}-glow)" opacity=".7">${rays}</g>${rays}${glitter}<circle r="7" fill="#fff" opacity=".85" filter="url(#${id}-glow)"/>`;};
 const fire=shells.map(([x,dy],k)=>{const t=T+k*.37,d=k*1.07,col=cols[k];return `<g transform="translate(${x} 386)"><g ${an('rocket',t,d,`--dy:${-dy}px`)}><circle r="1.4" fill="#fff6d0"/><path d="M0 1.4V11" stroke="${col}" stroke-width="1.1" stroke-linecap="round" opacity=".8"/></g></g><g transform="translate(${x} ${386-dy})"><g ${an('burst',t,d)}>${burst(col,k)}</g></g>`;}).join('');
 // Fountains on the bottom rail spray sparks up over the card.
 const fountains=[70,150,230].map((x,j)=>`<g transform="translate(${x} 388)"><path d="M-3 0H3L2 -4H-2Z" fill="#c9a36b" stroke="#5a3a10" stroke-width=".4"/>${Array.from({length:12},(_,i)=>{const s=j*30+i;return `<circle cy="-4" r="${f(.6+rnd(s)*.7)}" fill="${i%3?'#ffe08a':'#fff'}" ${an('move',.9+rnd(s+3)*.8,rnd(s+5)*1.6,`--dx:${f((rnd(s+7)-.5)*34)}px;--dy:${f(-26-rnd(s+9)*34)}px`)}/>`;}).join('')}</g>`).join('');
 const skyline=(len,n)=>n!==2?'':Array.from({length:Math.floor(len/9)},(_,j)=>{const h=4+rnd(j)*7,x=j*9+rnd(j+3)*2;return `<rect x="${f(x)}" width="${f(7+rnd(j+5)*2)}" height="${f(h)}" fill="#05060f"/>${h>7?`<rect x="${f(x+2)}" y="${f(h-3)}" width="1" height="1" fill="#ffd34d" opacity=".8"/>`:''}`;}).join('');
 const stars=Array.from({length:30},(_,k)=>{const n=[0,1,3][k%3],[x,y]=at(n,8+rnd(k)*(LENS[n]-16),1.5+rnd(k+60)*(w-3));return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(.3+rnd(k+90)*.4)}" fill="#fff" ${an('pulse',2+rnd(k)*2,rnd(k+4)*3,'--lo:.2')}/>`;}).join('');
 const defs=`${linear(`${id}-night`,['#05081c','#141a48'])}${cardClip(id)}${blur(`${id}-glow`,2.2)}`;
 return box(item,id,w,defs,`${band(id,w,`url(#${id}-night)`,skyline)}<g clip-path="url(#${id}-frame)">${stars}</g>${keyline(w,'#4c5aa8',.4)}<g clip-path="url(#${id}-card)" style="mix-blend-mode:screen">${fire}${fountains}</g>`);
}

function kraken(item,id){
 const w=14;
 // The left tentacle grows from well under the mantle, so no gap shows when it sways: along the bottom rail, round the corner, up the side, then a
 // clockwise curl over the top-left corner. The right one mirrors it.
 const pts=[];
 for(let i=0;i<=12;i++){const x=118-i/12*88;pts.push([x,392-1.6*Math.sin(x/8)*(x-30)/88]);}
 for(let i=1;i<=8;i++){const a=(90+i/8*90)*Math.PI/180;pts.push([30+Math.cos(a)*16,376+Math.sin(a)*16]);}
 for(let i=1;i<=30;i++){const y=376-i/30*256;pts.push([14+2.6*Math.sin(y/23)*(y-120)*(376-y)/16384,y]);}
 for(let i=1;i<=48;i++){const a=(180+i/48*340)*Math.PI/180,r=24-20*i/48;pts.push([38+Math.cos(a)*r,120+Math.sin(a)*r]);}
 const M=pts.length,width=t=>12*(1-t)**.75+1.4,side=[[],[]],shine=[],suckers=[],lights=[];
 pts.forEach(([x,y],i)=>{const [px,py]=pts[Math.max(0,i-1)],[nx,ny]=pts[Math.min(M-1,i+1)],dx=nx-px,dy=ny-py,l=Math.hypot(dx,dy)||1,ux=-dy/l,uy=dx/l,hw=width(i/(M-1))/2;
  side[0].push(`${f(x+ux*hw)} ${f(y+uy*hw)}`);side[1].unshift(`${f(x-ux*hw)} ${f(y-uy*hw)}`);shine.push(`${f(x-ux*hw*.45)} ${f(y-uy*hw*.45)}`);
  if(i>4&&i<M-3&&i%3===0)suckers.push(`<circle cx="${f(x+ux*hw*.45)}" cy="${f(y+uy*hw*.45)}" r="${f(hw*.42)}" fill="#f2b8c6" stroke="#8a2a4a" stroke-width=".3"/><circle cx="${f(x+ux*hw*.45)}" cy="${f(y+uy*hw*.45)}" r="${f(hw*.16)}" fill="#7a1a3a"/>`);
  if(i>2&&i%5===1)lights.push(`<circle cx="${f(x-ux*hw*.8)}" cy="${f(y-uy*hw*.8)}" r="${f(Math.max(.6,hw*.18))}" fill="#7ff6ff" ${an('pulse',1.8+rnd(i)*1.4,rnd(i+3)*2,'--lo:.1')}/>`);});
 const arm=`<path d="M${side[0].join('L')}L${side[1].join('L')}Z" fill="url(#${id}-skin)" stroke="#3a0a20" stroke-width=".6"/><path d="M${shine.join('L')}" fill="none" stroke="#ffb3cf" stroke-width="1.1" stroke-linecap="round" opacity=".55"/>${suckers.join('')}${lights.join('')}`;
 const tentacle=(mirror,k)=>`<g transform="${mirror?'translate(300 0) scale(-1 1)':''}"><g transform="translate(118 392)"><g ${an('sway',5+k,k*2,'--a:1.1deg')}><g transform="translate(-118 -392)">${arm}</g></g></g></g>`;
 // The kraken itself surfaces at the bottom centre, both tentacles running out from under its mantle.
 const eye=x=>`<g transform="translate(${x} 377)"><ellipse rx="7.4" ry="6" fill="#2a0f1f"/><g ${an('blinkeye',6,x>150?.12:0)}><ellipse rx="5.8" ry="4.8" fill="url(#${id}-iris)"/><ellipse rx="1" ry="3.8" fill="#111"/><circle cx="-1.8" cy="-1.8" r="1.1" fill="#fff" opacity=".85"/></g></g>`;
 const mantle=`<g filter="url(#${id}-aura)" opacity=".75" ${an('pulse',3,0,'--lo:.35')}><path d="M98 398C100 368 122 352 150 352C178 352 200 368 202 398" fill="none" stroke="#ff6fa3" stroke-width="3"/></g><path d="M98 398C100 368 122 352 150 352C178 352 200 368 202 398Z" fill="url(#${id}-dome)" stroke="#3a0a20" stroke-width=".8"/>${[[120,368,2.2],[178,366,1.8],[150,360,1.6],[110,384,1.4],[192,384,1.6]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#5a1a3a" opacity=".7"/>`).join('')}<path d="M118 362C130 356 170 356 182 362" fill="none" stroke="#ffd0e0" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>${eye(134)}${eye(166)}`;
 const bubbles=Array.from({length:14},(_,k)=>`<g transform="translate(${k%2?f(281+rnd(k)*6):f(13+rnd(k)*6)} ${f(250+rnd(k+4)*130)})"><circle r="${f(.6+rnd(k+8)*.9)}" fill="none" stroke="#9fe8ef" stroke-width=".4" ${an('move',4+rnd(k+2)*3,rnd(k+5)*6,'--dy:-70px;--o:.8')}/></g>`).join('');
 const crest=len=>`<path d="M0 2.2${Array.from({length:Math.ceil(len/8)},(_,j)=>`q2 -2 4 0t4 0`).join('')}" fill="none" stroke="#9fe8ef" stroke-width=".6" opacity=".6"/>`;
 const defs=`${linear(`${id}-sea`,['#04151a','#0b2a33','#0e3a44'])}${linear(`${id}-skin`,['#d9507e','#9a2852','#5a1a3a'],1,0)}${radial(`${id}-dome`,['#e8628f','#a8325a','#5a1a3a'],.5,.25)}${radial(`${id}-iris`,['#fff3a0','#ffb703','#c96a00'])}${blur(`${id}-aura`,3)}${cardClip(id)}`;
 return box(item,id,w,defs,`${band(id,w,`url(#${id}-sea)`,crest)}<g clip-path="url(#${id}-frame)"><path d="${rim(5)}" fill="none" stroke="#cfeff3" stroke-opacity=".5" stroke-width=".8" stroke-dasharray="3 5 1 6" ${an('dash',4,0,'--d:-30')}/><path d="${rim(9)}" fill="none" stroke="#7ff6ff" stroke-opacity=".35" stroke-width=".6" stroke-dasharray="2 9" ${an('dash',6,0,'--d:22')}/>${bubbles}</g>${keyline(w,'#4fb3c2',.45)}<g clip-path="url(#${id}-card)">${tentacle(false,0)}${tentacle(true,1)}<g transform="translate(150 402) scale(.82) translate(-150 -402)">${mantle}</g></g>`);
}

function spiderSilk(item,id){
 const w=11;
 const web=n=>{const spokes=[5,25,45,65,85].map(a=>a*Math.PI/180),R=52;
  let out=spokes.map(a=>`<path d="M0 0L${f(Math.cos(a)*R)} ${f(Math.sin(a)*R)}"/>`).join('');
  for(let r=9;r<=48;r+=6.5)out+=`<path d="${spokes.map((a,i)=>{const p=`${f(Math.cos(a)*r)} ${f(Math.sin(a)*r)}`;if(!i)return `M${p}`;const m=(a+spokes[i-1])/2;return `Q${f(Math.cos(m)*r*.86)} ${f(Math.sin(m)*r*.86)} ${p}`;}).join('')}"/>`;
  const drops=Array.from({length:9},(_,k)=>{const s=n*10+k,a=(10+rnd(s)*70)*Math.PI/180,r=12+rnd(s+3)*34;return `<g transform="translate(${f(Math.cos(a)*r)} ${f(Math.sin(a)*r)})"><circle r="${f(.7+rnd(s+5)*.8)}" fill="url(#${id}-dew)"/>${glint(0,0,.55,s+40)}</g>`;}).join('');
  // The web twice: pale silk, then an iridescent copy that comes and goes as the light catches it.
  return corner(n,`<g stroke="#eef3f8" stroke-width=".45" fill="none" opacity=".75">${out}</g><g stroke="url(#${id}-iris)" stroke-width=".7" fill="none" ${an('pulse',3.2,n*1.1,'--lo:0;--hi:.85')}>${out}</g>${drops}`);};
 // Two silk lines along each side, sagging a little between the corners and strung with dew.
 const strands=len=>`${[3.2,7.6].map((y,k)=>`<path d="M0 ${y}Q${len/2} ${f(y+2.6)} ${len} ${y}" fill="none" stroke="#eef3f8" stroke-width=".5" opacity=".7"/>`).join('')}${Array.from({length:Math.floor(len/22)},(_,j)=>{const x=8+j*22+rnd(len+j)*12,y=j%2?7.6:3.2,t=x/len;return `<circle cx="${f(x)}" cy="${f(y+2.6*4*t*(1-t))}" r="${f(.8+rnd(j)*.6)}" fill="url(#${id}-dew)"/>`;}).join('')}`;
 const sheen=[0,.5].map(p=>`<path d="${rim(5.4)}" pathLength="1" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-dasharray=".025 .975" stroke-dashoffset="${p}" filter="url(#${id}-soft)" ${an('dash',9,0,`--d:${f(p-1)}`)}/>`).join('');
 const leg=(y,a,s)=>`<path d="M0 ${y}Q${f(3.4*s)} ${f(y+a-2)} ${f(6*s)} ${f(y+a+2.5)}" fill="none" stroke="#111" stroke-width=".55"/>`;
 const spider=`${[-3,-1,1,3].map((y,k)=>leg(y-4,[-3,-1,1,3][k],1)+leg(y-4,[-3,-1,1,3][k],-1)).join('')}<circle cy="-4.4" r="2" fill="#111"/><ellipse cy=".6" rx="3.2" ry="4" fill="url(#${id}-body)"/><path d="M-.9 -1L.9 -1L0 .6Z M-.9 2.2L.9 2.2L0 .6Z" fill="#d62828"/><ellipse cx="-1" cy="-.6" rx=".9" ry="1.6" fill="#fff" opacity=".35"/><circle cx="-.7" cy="-5.2" r=".35" fill="#fff"/><circle cx=".7" cy="-5.2" r=".35" fill="#fff"/>`;
 const hang=`<g transform="translate(118 9)"><g ${an('bob',9,0,'--dy:46px')}><path d="M0 -70V22" stroke="#eef3f8" stroke-width=".4" opacity=".8"/><g transform="translate(0 28)"><g ${an('sway',2.2,0,'--a:6deg')}>${spider}</g></g></g></g>`;
 const defs=`${linear(`${id}-mist`,['#2a2d36','#121317'])}<linearGradient id="${id}-iris" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="60" y2="60">${stops(['#ff9de2','#9de8ff','#d4ff9d','#ffe29d'])}</linearGradient>${radial(`${id}-dew`,['#ffffff','#cfe8ff','#7a8aa0'],.35,.3)}${radial(`${id}-body`,['#3a3a44','#111'],.35,.3)}${blur(`${id}-soft`,.8)}${cardClip(id)}`;
 return box(item,id,w,defs,`${band(id,w,`url(#${id}-mist)`,strands)}<g clip-path="url(#${id}-frame)">${sheen}</g>${keyline(w,'#dfe7f0',.45)}${[1,2,3].map(web).join('')}<g clip-path="url(#${id}-card)">${hang}</g>`);
}

function stormFront(item,id){
 const w=14,T=9;
 // Storm cloud rolls along the band; the puffs repeat every 60 so the slide loops without a seam.
 const puffs=Array.from({length:8},(_,j)=>[j*7.5+rnd(j)*3,3+rnd(j+5)*6,5.5+rnd(j+9)*3]);
 const clouds=len=>`<g filter="url(#${id}-cloud)"><g ${an('slide',14,0,'--dx:-60px')}>${Array.from({length:Math.ceil(len/60)+2},(_,p)=>puffs.map(([x,y,r])=>`<circle cx="${f(p*60+x)}" cy="${f(y)}" r="${f(r)}" fill="#353c50"/>`).join('')+puffs.map(([x,y,r])=>`<circle cx="${f(p*60+x-1)}" cy="${f(y-r*.35)}" r="${f(r*.55)}" fill="#5d6780"/>`).join('')).join('')}</g></g>`;
 // Forked bolts strike in from the rim one after another; the cloud on that side and the whole card flash with each.
 const strikes=[[0,90],[1,250],[2,200],[3,120],[0,220],[1,100]];
 const pt=(n,x,a,i)=>at(n,x+a,i).map(f).join(' ');
 const bolts=strikes.map(([n,x],k)=>{let d=`M${pt(n,x,0,0)}`,a=0,i=0,fork='';
  for(let j=1;j<=7;j++){a+=(rnd(k*13+j)-.5)*14;i+=8+rnd(k*13+j+40)*6;d+=`L${pt(n,x,a,i)}`;
   if(j===3){let fa=a,fi=i;fork=`M${pt(n,x,fa,fi)}`;for(let m=1;m<=3;m++){fa+=(rnd(k*7+m)>.5?1:-1)*(5+rnd(k*7+m+3)*5);fi+=6+rnd(k*7+m+9)*4;fork+=`L${pt(n,x,fa,fi)}`;}}}
  return `<g ${an('zap',T,k*T/6)}><path d="${d}${fork}" fill="none" stroke="#8fc4ff" stroke-width="3.4" filter="url(#${id}-glow)"/><path d="${d}${fork}" fill="none" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/></g>`;}).join('');
 const flashes=strikes.map((_,k)=>`<g opacity=".16"><rect x="8" y="9" width="284" height="382" fill="#dbe9ff" ${an('zap',T,k*T/6)}/></g>`).join('');
 const lit=(len,n)=>strikes.map(([s],k)=>s!==n?'':`<g opacity=".6"><rect width="${len}" height="${w}" fill="#cfe4ff" ${an('zap',T,k*T/6)}/></g>`).join('');
 const rain=Array.from({length:60},(_,k)=>`<g transform="translate(${f(10+rnd(k)*320)} ${f(-10+rnd(k+3)*290)})"><path d="M0 0l-3 9" stroke="#bcd6ff" stroke-width=".6" stroke-linecap="round" ${an('move',.9+rnd(k+6)*.5,rnd(k+9)*2,'--dx:-36px;--dy:110px;--o:.35')}/></g>`).join('');
 const defs=`${linear(`${id}-sky`,['#0e111a','#232a3b'])}${blur(`${id}-cloud`,.9)}${blur(`${id}-glow`,1.8)}${cardClip(id)}`;
 return box(item,id,w,defs,`${band(id,w,`url(#${id}-sky)`,(len,n)=>clouds(len)+lit(len,n))}${keyline(w,'#8fc4ff',.35)}<g clip-path="url(#${id}-card)">${flashes}${rain}${bolts}</g>`);
}

function hauntedHollow(item,id){
 const w=14;
 // A thorny vine winds along a dusk band, dark against the orange glow on its inner edge.
 const vine=len=>`<path d="M0 ${f(w/2)}${Array.from({length:Math.ceil(len/16)},()=>'q4 4 8 0t8 0').join('')}" fill="none" stroke="#1a0f1f" stroke-width="1.4"/>${Array.from({length:Math.floor(len/16)},(_,j)=>`<path d="M${j*16+4} ${f(w/2+(j%2?-2.6:2.6))}l1.6 ${j%2?-3:3}l1 ${j%2?3:-3}Z" fill="#1a0f1f"/>`).join('')}`;
 const bat=s=>`<g transform="scale(${f(s)})"><g ${an('flap',.22,0,'--fy:.25')}><path d="M0 0C-3 -5 -8 -6 -12 -3C-10 -2 -10 1 -11 2C-8 0 -6 1 -5 3C-4 1 -2 1 0 2Z" fill="#0c0610"/><path d="M0 0C3 -5 8 -6 12 -3C10 -2 10 1 11 2C8 0 6 1 5 3C4 1 2 1 0 2Z" fill="#0c0610"/></g><ellipse cy="1" rx="2.2" ry="3" fill="#0c0610"/><circle cy="-2.4" r="1.8" fill="#0c0610"/><path d="M-1.6 -3.6L-1 -5.4L-.4 -3.8M1.6 -3.6L1 -5.4L.4 -3.8" fill="#0c0610"/><circle cx="-.7" cy="-2.6" r=".35" fill="#ff3b30"/><circle cx=".7" cy="-2.6" r=".35" fill="#ff3b30"/></g>`;
 const bats=Array.from({length:7},(_,k)=>ride(w/2+(k%3-1)*4,22+k*3,k/7,`<g ${an('bob',.8+rnd(k)*.5,rnd(k+2),'--dy:-4px')}>${bat(1+rnd(k+4)*.5)}</g>`,'0deg')).join('');
 // Jack-o'-lanterns in three corners, their faces flickering like candles.
 const pumpkin=(x,y,s,k)=>`<g transform="translate(${x} ${y}) scale(${s})"><circle r="13" fill="url(#${id}-candle)" ${an('flicker',1.3+k*.2,k*.3,'--lo:.4')}/>${[-4,4,0].map(cx=>`<ellipse cx="${cx}" rx="${cx?5:5.4}" ry="${cx?7:7.4}" fill="url(#${id}-pumpkin)" stroke="#7a2a00" stroke-width=".5"/>`).join('')}<path d="M-1 -6.6Q0 -10 2.4 -10.6" stroke="#3a5a1a" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M-5 -1.6H-2.2L-3.6 -4.4ZM5 -1.6H2.2L3.6 -4.4ZM-.8 .4H.8L0 -1.2ZM-6 1.8Q0 6.4 6 1.8L4.6 1.8L3.8 3.2L2.6 2L1.2 3.6L0 2.2L-1.2 3.6L-2.6 2L-3.8 3.2L-4.6 1.8Z" fill="#ffd34d" ${an('flicker',.9+k*.17,k*.4,'--lo:.55')}/></g>`;
 const pumpkins=`${pumpkin(18,380,1.5,0)}${pumpkin(282,380,1.5,1)}${pumpkin(19,22,1.1,2)}`;
 const moon=`<g transform="translate(276 25)"><circle r="16" fill="#fff3c4" opacity=".4" filter="url(#${id}-glow)" ${an('pulse',3,0,'--lo:.2;--hi:.5')}/><circle r="9" fill="url(#${id}-moon)"/><circle cx="-2.6" cy="-2" r="1.8" fill="#e6d79c"/><circle cx="3" cy="2.6" r="1.2" fill="#e6d79c"/><circle cx="1.2" cy="-4" r=".8" fill="#e6d79c"/></g>`;
 const gp='M-8 8C-8 -4 -5 -11 0 -11C5 -11 8 -4 8 8L5.3 5.6L2.7 8.4L0 5.6L-2.7 8.4L-5.3 5.6Z';
 const ghost=`<path d="${gp}" fill="#fff" opacity=".5" filter="url(#${id}-soft)"/><path d="${gp}" fill="#f4f0ff" opacity=".8"/><ellipse cx="-2.6" cy="-3" rx="1.2" ry="1.8" fill="#1a0f1f"/><ellipse cx="2.6" cy="-3" rx="1.2" ry="1.8" fill="#1a0f1f"/><ellipse cy="1.2" rx="1.4" ry="1.8" fill="#1a0f1f"/>`;
 // Two ghosts drift about near the sides, fading in and out of view.
 const ghosts=[[42,180,'wander',1.3],[252,250,'wander-back',1.1]].map(([x,y,cls,s],k)=>`<g transform="translate(${x} ${y})"><g ${an(cls,16+k*3,k*5,'--dx:22px;--dy:-30px')}><g ${an('fade',8+k*2,k*3,'--o:1')}><g ${an('sway',1.6,0,'--a:6deg')}><g transform="scale(${s})">${ghost}</g></g></g></g></g>`).join('');
 const fog=Array.from({length:6},(_,k)=>`<g transform="translate(${30+k*48} 386)"><ellipse rx="40" ry="9" fill="#d9d0ff" opacity=".22" filter="url(#${id}-glow)" ${an('bob',4+rnd(k)*3,rnd(k+3)*3,'--dx:18px;--dy:-3px')}/></g>`).join('');
 const defs=`${linear(`${id}-dusk`,['#1a0a2a','#5a1f5a','#ff7a2a'])}${radial(`${id}-pumpkin`,['#ffb347','#ff7a1a','#b84a00'],.4,.35)}${radial(`${id}-candle`,['#ffb347bb','#ff7a1a44','#ff7a1a00'])}${radial(`${id}-moon`,['#fffbe6','#f4e3a0'],.4,.4)}${blur(`${id}-glow`,3)}${blur(`${id}-soft`,2)}${cardClip(id)}`;
 return box(item,id,w,defs,`${band(id,w,`url(#${id}-dusk)`,vine)}${keyline(w,'#ff9a3d',.4)}<g clip-path="url(#${id}-card)">${fog}${ghosts}</g>${moon}${bats}${pumpkins}`);
}

function goldLaurel(item,id){
 const w=14,c=w/2;
 const leaf=(x,a)=>`<path d="M0 0C2.4 -2.2 6.4 -2.2 9 0C6.4 2.2 2.4 2.2 0 0Z" fill="url(#${id}-leaf)" stroke="#6b4a10" stroke-width=".3" transform="translate(${f(x)} ${c}) rotate(${a})"/>`;
 // Laurel round the rim: pairs of leaves on a gold stem, all pointing the same way round the card.
 const laurel=len=>{let out=`<path d="M0 ${c}H${len}" stroke="#8a6a1a" stroke-width=".8"/>`;for(let x=4;x<len-4;x+=7)out+=leaf(x,-28)+leaf(x+3.5,28);return out;};
 // A gold medallion at the foot of the card on red ribbons, with a laurel sprig curving up each side of it.
 const sprig=Array.from({length:6},(_,i)=>{const a=(100+i*24)*Math.PI/180;return `<path d="M0 0C2.4 -2.2 6.4 -2.2 9 0C6.4 2.2 2.4 2.2 0 0Z" fill="url(#${id}-leaf)" stroke="#6b4a10" stroke-width=".3" transform="translate(${f(Math.cos(a)*15)} ${f(Math.sin(a)*15)}) rotate(${f(a*180/Math.PI+120)})"/>`;}).join('');
 const ribbon=`<path d="M-3 6L-11 23L-6.6 21L-4 25.6L1 9Z" fill="#9a1c1c" stroke="#4a0a0a" stroke-width=".4"/>`;
 const star='M0 -6.4L1.7 -1.8L6.4 -1.8L2.6 1L4 5.6L0 2.8L-4 5.6L-2.6 1L-6.4 -1.8L-1.7 -1.8Z';
 const medal=`<g transform="translate(150 376)"><circle r="24" fill="url(#${id}-halo)" ${an('pulse',2.6,0,'--lo:.35')}/>${ribbon}<g transform="scale(-1 1)">${ribbon}</g>${sprig}<g transform="scale(-1 1)">${sprig}</g><circle r="11.5" fill="url(#${id}-metal)" stroke="#5a3a08" stroke-width=".9"/><circle r="8.6" fill="#7a1414" stroke="#fff1b0" stroke-width=".5"/><path d="${star}" fill="#ffe08a"/><g clip-path="url(#${id}-medal)"><g ${an('slide',3.4,0,'--dx:44px')}><rect x="-30" y="-14" width="7" height="28" fill="#fff" opacity=".7" transform="skewX(-20)"/></g></g></g>`;
 const motes=Array.from({length:18},(_,k)=>{const n=k%4,[x,y]=at(n,20+rnd(k)*(LENS[n]-40),w);return `<g transform="translate(${f(x)} ${f(y)})"><circle r="${f(.6+rnd(k+3)*.7)}" fill="#ffe08a" ${an('move',3+rnd(k+5)*2.4,rnd(k+7)*5,`--dx:${f((150-x)*.08)}px;--dy:${f((200-y)*.08)}px;--o:.9`)}/></g>`;}).join('');
 const flare=[0,.5].map(p=>ride(c,9,p,`<ellipse rx="18" ry="5" fill="url(#${id}-flare)"/><ellipse rx="5" ry="1.6" fill="#fff"/>`)).join('');
 const defs=`${linear(`${id}-band`,['#6b4a10','#f2d38a','#c9993a','#fff1b0','#8a6420'])}${linear(`${id}-metal`,['#fff6cf','#e8b84a','#a8781a','#f2d38a'],1,1)}${linear(`${id}-leaf`,['#fff1b0','#c9993a'],1,0)}${radial(`${id}-halo`,['#fff3c4cc','#ffd36b55','#ffd36b00'])}${radial(`${id}-flare`,['#ffffffcc','#fff1b066','#fff1b000'])}<clipPath id="${id}-medal"><circle r="11.5"/></clipPath>`;
 return box(item,id,w,defs,`${band(id,w,`url(#${id}-band)`,laurel)}<g clip-path="url(#${id}-frame)"><path d="${rim(1.2)}" fill="none" stroke="#5a3a08" stroke-width=".7"/><path d="${rim(w-1.2)}" fill="none" stroke="#5a3a08" stroke-width=".7"/><g style="mix-blend-mode:screen">${flare}</g></g>${keyline(w,'#fff1b0',.55)}${motes}${medal}`);
}

function lightCycles(item,id){
 const w=12,c=w/2,T=7,path=rim(c);
 // A dash the length of the trail travels the rim in step with its cycle, so the light wall follows it round.
 const trail=(col,rev)=>[[.34,.3,4.4,true],[.17,.6,2.6,false],[.06,1,1.5,false]].map(([L,o,sw,glow])=>`<path d="${path}" pathLength="1" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${L} ${f(1-L)}" stroke-dashoffset="${rev?0:L}" opacity="${o}"${glow?` filter="url(#${id}-glow)"`:''} ${an('dash',T,0,`--d:${rev?-1:f(L-1)}${rev?';animation-direction:reverse':''}`)}/>`).join('');
 const cycle=col=>`<rect x="-6.4" y="-2" width="12.8" height="4" rx="2" fill="#05070d" stroke="${col}" stroke-width=".8"/><circle cx="-4.2" r="1.7" fill="none" stroke="${col}" stroke-width=".7"/><circle cx="4.2" r="1.7" fill="none" stroke="${col}" stroke-width=".7"/><path d="M-1.6 -2L1 -3.4L3.6 -2" fill="none" stroke="${col}" stroke-width=".6"/><circle cx="6.6" r="1" fill="#fff"/>`;
 const rider=(col,rev)=>`<g ${an('ride',T,0,`offset-path:path('${path}');offset-rotate:${rev?'auto 180deg;animation-direction:reverse':'auto'}`)}><g transform="scale(1.4)">${cycle(col)}</g></g>`;
 const defs=`<pattern id="${id}-grid" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M6 0H0V6" fill="none" stroke="#29f0ff" stroke-width=".25" opacity=".35"/></pattern>${blur(`${id}-glow`,1.6)}`;
 return box(item,id,w,defs,`${band(id,w,'#04060c')}<g clip-path="url(#${id}-frame)"><rect x="8" y="9" width="284" height="382" fill="url(#${id}-grid)" ${an('pulse',3,0,'--lo:.4')}/><path d="${rim(.8)}" fill="none" stroke="#29f0ff" stroke-width=".6" opacity=".7"/><path d="${rim(w-.8)}" fill="none" stroke="#ff9a1f" stroke-width=".6" opacity=".7"/>${trail('#29f0ff',false)}${trail('#ff9a1f',true)}${rider('#29f0ff',false)}${rider('#ff9a1f',true)}</g>${keyline(w,'#29f0ff',.4)}`);
}

function clockwork(item,id){
 const w=14,c=w/2,R=4.6,teeth=8,pitch=10.6;
 const p=(a,r)=>`${f(Math.cos(a)*r)} ${f(Math.sin(a)*r)}`;
 const cog=(r,n)=>{const da=Math.PI/n;let d='';for(let i=0;i<n;i++){const a=i/n*Math.PI*2;d+=`${i?'L':'M'}${p(a-da*.55,r)}L${p(a-da*.3,r+1.7)}L${p(a+da*.3,r+1.7)}L${p(a+da*.55,r)}L${p(a+da*1.45,r)}`;}return d+'Z';};
 const gearPath=cog(R,teeth),big=cog(11,16);
 const gear=(fill,d=gearPath,r=R)=>`<path d="${d}" fill="${fill}" stroke="#3a2a10" stroke-width=".4"/><circle r="${f(r*.62)}" fill="none" stroke="#3a2a10" stroke-width=".5"/><path d="M${f(-r*.6)} 0H${f(r*.6)}M0 ${f(-r*.6)}V${f(r*.6)}" stroke="#3a2a10" stroke-width=".7"/><circle r="${f(r*.22)}" fill="#2a2620"/>`;
 // Neighbouring cogs mesh: they turn opposite ways and every other one starts half a tooth round.
 let k=0;const train=len=>{const N=Math.floor((len-2*c)/pitch),x0=(len-(N-1)*pitch)/2;return Array.from({length:N},(_,j)=>{const i=k++;return `<g transform="translate(${f(x0+j*pitch)} ${c}) rotate(${j%2?180/teeth:0})"><g ${an('spin',8,0,`--turn:${j%2?-360:360}deg`)}>${gear(i%3===2?`url(#${id}-copper)`:`url(#${id}-brass)`)}</g></g>`;}).join('');};
 const corners=[0,1,2,3].map(n=>corner(n,`<g transform="translate(5 5)"><g ${an('spin',16,0,`--turn:${n%2?360:-360}deg`)}>${gear(`url(#${id}-brass)`,big,11)}</g></g>`)).join('');
 const clock=`<g transform="translate(150 378)"><circle r="14" fill="url(#${id}-brass)" stroke="#3a2a10" stroke-width=".8"/><circle r="11.4" fill="#f6efdc" stroke="#8a6420" stroke-width=".6"/>${Array.from({length:12},(_,i)=>`<path d="M0 -10V${i%3?-8.8:-7.8}" stroke="#2a2620" stroke-width="${i%3?.5:.9}" transform="rotate(${i*30})"/>`).join('')}<g ${an('spin',60)}><path d="M0 1.4V-6" stroke="#2a2620" stroke-width="1.2" stroke-linecap="round"/></g><g ${an('spin',5)}><path d="M0 1.8V-9" stroke="#2a2620" stroke-width=".7" stroke-linecap="round"/></g><circle r="1.2" fill="#b3202a"/></g>`;
 // Soft puffs leave the vent, rise up the band and swell as they thin out.
 const steam=`<g transform="translate(285 134)">${[0,1,2,3].map(i=>`<g ${an('move',3.2,i*.8,'--dx:-2px;--dy:-34px;--o:.8')}><g transform="translate(0 -3)"><circle r="2.4" fill="#eef2f4" filter="url(#${id}-steam)" ${an('pop',3.2,i*.8,'--s0:.5;--s1:2.2;--o:.8')}/></g></g>`).join('')}<rect x="-3" y="-2" width="6" height="7" rx="1" fill="url(#${id}-copper)" stroke="#3a2a10" stroke-width=".4"/></g>`;
 const defs=`${radial(`${id}-brass`,['#fff1b0','#d9a93a','#7a5a1a'],.4,.35)}${radial(`${id}-copper`,['#ffd0b0','#c96a3a','#6b2a10'],.4,.35)}${blur(`${id}-steam`,.9)}`;
 return box(item,id,w,defs,`${band(id,w,'#2a2620',train)}${keyline(w,'#d9a93a',.5)}${corners}${steam}${clock}`);
}

function mangaPanel(item,id){
 const w=14;
 // Focus lines from the card's centre, seen only in the frame, flicker between two sets like an anime freeze-frame.
 const lines=set=>Array.from({length:120},(_,k)=>{const a=(k/120+rnd(k+set*100)*.007)*Math.PI*2,wd=.4+rnd(k+set*50)*2,ca=Math.cos(a),sa=Math.sin(a),px=-sa*wd,py=ca*wd;return `M${f(150+ca*120)} ${f(200+sa*120)}L${f(150+ca*330+px)} ${f(200+sa*330+py)}L${f(150+ca*330-px)} ${f(200+sa*330-py)}Z`;}).join('');
 const spike=(x,y,r,k)=>`<g transform="translate(${x} ${y})"><path d="M${Array.from({length:16},(_,i)=>{const a=i/16*Math.PI*2,rr=i%2?r*.45:r*(.8+rnd(k+i)*.4);return `${f(Math.cos(a)*rr)} ${f(Math.sin(a)*rr)}`;}).join('L')}Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round" ${an('pop',2.4,k*.6,'--s0:.3;--s1:1.15;--o:1')}/></g>`;
 const sfx=`<g transform="translate(286 222) rotate(-10)"><g ${an('jitter',.16,0,'--dx:.9px;--dy:-.7px')}><text text-anchor="end" font-family="RoundMarker,Impact,sans-serif" font-size="24" font-weight="900" fill="#111" stroke="#fff" stroke-width="4" paint-order="stroke">ドン!</text></g></g>`;
 const defs=`<pattern id="${id}-tone" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" fill="#111"/></pattern>`;
 return box(item,id,w,defs,`${band(id,w,'#f6f2e6')}<g clip-path="url(#${id}-frame)"><rect x="8" y="9" width="284" height="382" fill="url(#${id}-tone)" opacity=".28"/><g fill="#111"><g ${an('blink',.24,0,'--lo:0')}><path d="${lines(0)}"/></g><g ${an('blink',.24,.12,'--lo:0')}><path d="${lines(1)}"/></g></g></g><path d="${rim(.9)}" fill="none" stroke="#111" stroke-width="1.8"/><path d="${inner(w)}" fill="none" stroke="#111" stroke-width="2.6"/><path d="${inner(w)}" fill="none" stroke="#f6f2e6" stroke-width=".6" transform="translate(-.8 -.8)" opacity=".6"/>${spike(22,120,16,0)}${spike(20,300,12,2)}${sfx}`);
}

export const WAVE2_BORDERS={chalkboard,'building-bricks':buildingBricks,'coloured-pencils':colouredPencils,'postage-stamp':postageStamp,'bamboo-grove':bambooGrove,honeycomb,'piano-keys':pianoKeys,'frosted-donut':frostedDonut,zipper,'crayon-box':crayonBox,
 'koi-pond':koiPond,'model-railway':modelRailway,'lava-lamp':lavaLamp,'marquee-lights':marqueeLights,'festival-bunting':festivalBunting,'conveyor-belt':conveyorBelt,'ant-farm':antFarm,pinball,'domino-run':dominoRun,equalizer,
 'day-night':dayNight,'fireworks-show':fireworksShow,kraken,'spider-silk':spiderSilk,'storm-front':stormFront,'haunted-hollow':hauntedHollow,'gold-laurel':goldLaurel,'light-cycles':lightCycles,'cog-train':clockwork,'manga-panel':mangaPanel};
