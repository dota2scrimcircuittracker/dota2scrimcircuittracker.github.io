// Signatures for the November 3 wave. Same frame as the earlier waves: a 300-wide strip, viewBox 0 185 300 110,
// the name centred near y 258. Long names shrink to fit. Motion uses the .w2 classes at a fixed pace.
import {wrap as frame,sizeFor,escape} from './cosmetics-wave-signatures.js';
import {an} from './cosmetics-wave2-borders.js';
const rnd=n=>{const v=Math.sin(n*12.9898+78.233)*43758.5453;return v-Math.floor(v);};
const f=v=>Number(v.toFixed(2));
const wrap=(item,id,glow,defs,body)=>frame(item,id,glow,defs,`<g class="w2s">${body}</g>`);
const stops=colors=>colors.map((c,i)=>`<stop offset="${f(i/(colors.length-1))}" stop-color="${c}"/>`).join('');
const linear=(id,colors,x2=0,y2=1)=>`<linearGradient id="${id}" x2="${x2}" y2="${y2}">${stops(colors)}</linearGradient>`;
const blur=(id,d)=>`<filter id="${id}" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="${d}"/></filter>`;
// A name set in one line: its font size, width and the text element maker.
const line=(text,advance,size,max=230)=>{const n=Math.max(1,[...text].length),s=sizeFor(n,advance,size,max),w=Math.min(max,n*s*advance),fit=n*s*advance>max?` textLength="${max}" lengthAdjust="spacingAndGlyphs"`:'';
 return {s,w,t:(attrs,x=150,y=258)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${f(s)}"${fit} ${attrs}>${escape(text)}</text>`};};
const BLACKLETTER=`'UnifrakturMaguntia','Old English Text MT','Goudy Text MT',Georgia,serif`;

// Rare

function fountainPen(item,id,text){
 const {w,t}=line(text,.42,62);
 const end=150+w/2;
 const defs=`${linear(`${id}-ink`,['#7a9cff','#3d63e0','#1b2a8b'])}`;
 const nib=`<path d="M${f(150-w/2-4)} 270Q${f(150-w/4)} 278 150 271T${f(end+2)} 268" fill="none" stroke="url(#${id}-ink)" stroke-width="1.6" stroke-linecap="round"/>`;
 const drop=`<g transform="translate(${f(end+8)} 266)"><path d="M0 -4.4C1.6 -2 2.8 -.4 2.8 1.2A2.8 2.8 0 0 1 -2.8 1.2C-2.8 -.4 -1.6 -2 0 -4.4Z" fill="#2a48c8"/><ellipse cx="-.9" cy=".4" rx=".7" ry="1.1" fill="#cfdcff" opacity=".7"/></g>`;
 return wrap(item,id,'#5b86ff55',defs,`${t('font-family="RoundAllura,cursive" fill="#0d1440" opacity=".55" transform="translate(.8 1.2)"')}${t(`font-family="RoundAllura,cursive" fill="url(#${id}-ink)"`)}${t('font-family="RoundAllura,cursive" fill="none" stroke="#cfdcff" stroke-width=".35" opacity=".45" transform="translate(-.4 -.5)"')}${nib}${drop}`);
}

function blackletter(item,id,text){
 const {t}=line(text,.52,56);
 const defs=linear(`${id}-red`,['#ff3a52','#d0142f','#7a0616']);
 return wrap(item,id,'#d0142f44',defs,`${t(`font-family="${BLACKLETTER}" fill="#000" opacity=".7" transform="translate(1.2 2)"`)}${t(`font-family="${BLACKLETTER}" fill="url(#${id}-red)" stroke="#f3d27a" stroke-width="1.1" paint-order="stroke"`)}${t(`font-family="${BLACKLETTER}" fill="none" stroke="#fff3c0" stroke-width=".35" opacity=".6"`)}`);
}

// Epic

function circuitTrace(item,id,text){
 const {s,w,t}=line(text,.62,44,200),x0=150-w/2,x1=150+w/2,y=258-s*.34;
 // Traces leave both ends of the name, turn at right angles and end in solder pads.
 const traces=[`M${f(x0-3)} ${f(y)}H${f(x0-14)}V${f(y-14)}H${f(x0-26)}`,`M${f(x0-3)} ${f(y+6)}H${f(x0-10)}V${f(y+18)}H${f(x0-30)}`,`M${f(x1+3)} ${f(y)}H${f(x1+16)}V${f(y+14)}H${f(x1+28)}`,`M${f(x1+3)} ${f(y-6)}H${f(x1+10)}V${f(y-18)}H${f(x1+30)}`];
 const ends=[[x0-26,y-14],[x0-30,y+18],[x1+28,y+14],[x1+30,y-18]];
 const pads=ends.map(([px,py],k)=>`<circle cx="${f(px)}" cy="${f(py)}" r="3" fill="#0d2a1c" stroke="#39ff9a" stroke-width="1.2"/><circle cx="${f(px)}" cy="${f(py)}" r="1.2" fill="#d8ffe9" ${an('pulse',1.2,k*.3,'--lo:.2')}/>`).join('');
 const lines=traces.map(d=>`<path d="${d}" fill="none" stroke="#1d7a4c" stroke-width="2.4" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#39ff9a" stroke-width="1" stroke-linejoin="round"/>`).join('');
 const pulses=traces.map((d,k)=>`<path d="${d}" pathLength="100" fill="none" stroke="#e8fff2" stroke-width="1.6" stroke-dasharray="8 92" stroke-linecap="round" ${an('dash',1.4,k*.35,'--d:-100')}/>`).join('');
 const defs=blur(`${id}-glow`,2);
 return wrap(item,id,'#39ff9a44',defs,`${lines}${t('font-family="RoundMono,monospace" fill="#0d2a1c" stroke="#1d7a4c" stroke-width="4" stroke-linejoin="round" paint-order="stroke" letter-spacing="2"')}${t('font-family="RoundMono,monospace" fill="none" stroke="#39ff9a" stroke-width="1.3" letter-spacing="2"')}${t(`font-family="RoundMono,monospace" fill="none" stroke="#e8fff2" stroke-width="1.4" letter-spacing="2" pathLength="100" stroke-dasharray="14 86" ${an('dash',2.2,0,'--d:-100')}`)}<g filter="url(#${id}-glow)" opacity=".7">${pulses}</g>${pulses}${pads}`);
}

function smokeScript(item,id,text){
 const {w,t}=line(text,.44,60),x0=150-w/2;
 // The name is condensed smoke: pale letters with soft, ragged edges over a dark haze. Wisps peel off the tops of
 // the letters, curl upward as they thin out, and big slow puffs drift behind.
 const FONT='font-family="RoundDafoe,cursive"';
 // A wisp is a ribbon of smoke: it leaves the letter thin, widens as it climbs and wanders on its own curve.
 const ribbon=(k,len)=>{const P=[];let x=0,y=0,a=-Math.PI/2+(rnd(k+1)-.3)*.5;const fq=1+rnd(k+2)*1.5,ph=rnd(k+3)*6,amp=.09+rnd(k+4)*.08;
  for(let i=0;i<=24;i++){const t=i/24;P.push([x,y,a,1.4+t*t*11]);x+=Math.cos(a)*len/24;y+=Math.sin(a)*len/24;a+=Math.sin(t*fq*6.28+ph)*amp;}
  const side=s=>P.map(([x,y,a,w])=>[x-Math.sin(a)*w/2*s,y+Math.cos(a)*w/2*s]);
  return 'M'+[...side(1),...side(-1).reverse()].map(([u,v])=>`${f(u)} ${f(v)}`).join('L')+'Z';};
 const wisp=k=>{const x=x0+w*(.02+.96*(k+rnd(k*7))/16),y=236+rnd(k+3)*16,T=f(3.6+rnd(k+8)*2),d=ribbon(k*13,22+rnd(k+10)*18);
  return `<g transform="translate(${f(x)} ${f(y)})"><g ${an('move',T,rnd(k+9)*T,`--dx:${f(14+rnd(k+11)*18)}px;--dy:-${f(6+rnd(k+12)*10)}px;--o:1`)}><g ${an('pop',T,rnd(k+9)*T,'--s0:.5;--s1:1.5;--o:1')}><path d="${d}" fill="url(#${id}-fadedark)" filter="url(#${id}-wisp)" transform="translate(1.5 1.5)"/><path d="${d}" fill="url(#${id}-fade)" filter="url(#${id}-wisp)"/><path d="${d}" fill="url(#${id}-fade)" opacity=".8" filter="url(#${id}-thin)" transform="scale(.5 1)"/></g></g></g>`;};
 const wisps=Array.from({length:16},(_,k)=>wisp(k)).join('');
 const puffs=[0,1,2,3].map(k=>`<g transform="translate(${f(x0+w*(k/3))} ${f(250+rnd(k+20)*12)})"><ellipse rx="${f(26+rnd(k+21)*16)}" ry="${f(12+rnd(k+22)*6)}" fill="#cfd5de" filter="url(#${id}-haze)" ${an('move',6.5,k*1.6,'--dx:34px;--dy:-14px;--o:.5')}/></g>`).join('');
 const fade=(n,c,o)=>`<linearGradient id="${n}" gradientUnits="userSpaceOnUse" x1="0" y1="2" x2="0" y2="-36"><stop stop-color="${c}" stop-opacity="${o}"/><stop offset=".45" stop-color="${c}" stop-opacity="${f(o*.7)}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`;
 const defs=`${linear(`${id}-fill`,['#ffffff','#e9edf3','#aab2bf'])}${fade(`${id}-fade`,'#f1f4f8',.95)}${fade(`${id}-fadedark`,'#12161e',.35)}`
  +`<filter id="${id}-wisp" x="-80%" y="-40%" width="260%" height="180%"><feTurbulence type="fractalNoise" baseFrequency=".07 .04" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="8" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="1.3"/></filter>`
  +`<filter id="${id}-thin" x="-80%" y="-40%" width="260%" height="180%"><feTurbulence type="fractalNoise" baseFrequency=".08 .04" numOctaves="2" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation=".8"/></filter>`
  +`<filter id="${id}-edge" x="-10%" y="-30%" width="120%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="1.6"/></filter>`
  +blur(`${id}-haze`,7)+blur(`${id}-dark`,5);
 return wrap(item,id,'#ffffff33',defs,`${t(`${FONT} fill="#0b0e14" stroke="#0b0e14" stroke-width="14" stroke-linejoin="round" opacity=".5" filter="url(#${id}-dark)"`)}${puffs}${t(`${FONT} fill="#e4e8ee" stroke="#e4e8ee" stroke-width="3" opacity=".6" filter="url(#${id}-edge)"`)}${t(`${FONT} fill="url(#${id}-fill)"`)}${wisps}`);
}

function holoSticker(item,id,text){
 const {t}=line(text,.6,52,210);
 // A repeating rainbow slides under the letters by exactly one repeat per cycle, so the shift never jumps.
 const defs=`<linearGradient id="${id}-holo" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="40" spreadMethod="repeat">${stops(['#ff7ad9','#7af7ff','#c3ff7a','#ffd27a','#ff7ad9'])}</linearGradient><clipPath id="${id}-letters">${t('font-family="RoundMarker,Impact,sans-serif"')}</clipPath><filter id="${id}-drop" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="1.4" dy="2.4" stdDeviation="1.4" flood-color="#000" flood-opacity=".55"/></filter>`;
 return wrap(item,id,'#ff7ad944',defs,`<g filter="url(#${id}-drop)">${t('font-family="RoundMarker,Impact,sans-serif" fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round"')}</g><g clip-path="url(#${id}-letters)"><g ${an('slide',3,0,'--dx:120px;--dy:40px')}><rect x="-120" y="140" width="540" height="200" fill="url(#${id}-holo)"/></g></g>${t('font-family="RoundMarker,Impact,sans-serif" fill="none" stroke="#fff" stroke-width=".8" opacity=".55"')}`);
}

// Legendary

function lightningScript(item,id,text){
 const {w,t}=line(text,.44,62),x0=150-w/2;
 // Electric letters: a white-hot core in a blue glow, with small arcs crawling over them all the time. Every few
 // seconds a forked bolt drops from above onto a letter: the letters flare white and sparks fly from the strike.
 const FONT='font-family="RoundDafoe,cursive"';
 // A bolt from (x1,y1) to (x2,y2) by midpoint displacement: each split kicks the midpoint sideways by a share of
 // the segment's length, so it zigzags at every scale like real lightning. Returns the path and its points.
 const bolt=(x1,y1,x2,y2,rough,seed)=>{let pts=[[x1,y1],[x2,y2]];
  for(let level=0;level<4;level++){const next=[pts[0]];for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i],len=Math.hypot(bx-ax,by-ay),o=(rnd(seed+level*40+i)-.5)*len*rough;next.push([(ax+bx)/2-(by-ay)/len*o,(ay+by)/2+(bx-ax)/len*o],[bx,by]);}pts=next;}
  return {d:'M'+pts.map(([u,v])=>`${f(u)} ${f(v)}`).join('L'),pts};};
 const strike=(p,k)=>{const x=x0+w*p,T=f(2.8+k*.9),ey=228+rnd(k+4)*8,sx=x+(k-1)*-55+(rnd(k)-.5)*30,main=bolt(sx,183,x,ey,.34,k*31);
  const forks=[.3,.55,.72].map((q,j)=>{const [fx,fy]=main.pts[Math.floor(main.pts.length*q)],side=j%2?1:-1;return bolt(fx,fy,fx+side*(14+rnd(k*5+j)*16),fy+10+rnd(k*5+j+2)*14,.4,k*31+j*9+100).d;});
  const all=[main.d,...forks];
  const [ex]=main.pts.at(-1);
  const sparks=Array.from({length:8},(_,j)=>{const a=-Math.PI*(.05+.9*rnd(k*7+j)),r=7+rnd(k*7+j+3)*13;return `<path d="M${f(ex)} ${f(ey)}l${f(Math.cos(a)*r)} ${f(Math.sin(a)*r)}" stroke="#e8f7ff" stroke-width="1" stroke-linecap="round"/>`;}).join('');
  return `<g ${an('zap',T,k*1.1)}>${all.map((d,j)=>`<path d="${d}" fill="none" stroke="#3d9bff" stroke-width="${j?4:8}" opacity=".6" filter="url(#${id}-glow)"/>`).join('')}${all.map((d,j)=>`<path d="${d}" fill="none" stroke="#bfe6ff" stroke-width="${j?1.2:2.6}" stroke-linejoin="bevel"/><path d="${d}" fill="none" stroke="#fff" stroke-width="${j?.5:1.1}" stroke-linejoin="bevel"/>`).join('')}<ellipse cx="${f(ex)}" cy="${f(ey)}" rx="18" ry="10" fill="#cfeeff" opacity=".85" filter="url(#${id}-glow)"/>${sparks}<g opacity=".55">${t(`${FONT} fill="#fff" filter="url(#${id}-flare)"`)}</g></g>`;};
 const strikes=[.18,.52,.84].map((p,k)=>strike(p,k)).join('');
 // Crawling arcs: short jagged sparks over the letters, each flickering on its own beat.
 const arcs=Array.from({length:12},(_,k)=>{const x=x0+w*rnd(k*3+1),y=236+rnd(k*3+2)*30,a=rnd(k+70)*Math.PI*2;let d=`M${f(x)} ${f(y)}`,cx=x,cy=y;for(let i=0;i<4;i++){cx+=Math.cos(a)*4+(rnd(k*9+i)-.5)*5;cy+=Math.sin(a)*4+(rnd(k*9+i+4)-.5)*5;d+=`L${f(cx)} ${f(cy)}`;}
  return `<path d="${d}" fill="none" stroke="#e6f7ff" stroke-width=".9" stroke-linejoin="bevel" ${an('flash',f(.7+rnd(k+5)*1.1),rnd(k+6)*1.6,'--o:1')}/>`;}).join('');
 const defs=`${blur(`${id}-glow`,2.6)}${blur(`${id}-wide`,6)}${linear(`${id}-core`,['#ffffff','#dff3ff','#9fd4ff'])}<filter id="${id}-flare" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
 return wrap(item,id,'#3a9bff66',defs,`${t(`${FONT} fill="#1d6dff" stroke="#1d6dff" stroke-width="8" stroke-linejoin="round" opacity=".55" filter="url(#${id}-wide)"`)}${t(`${FONT} fill="none" stroke="#7fd0ff" stroke-width="2.6" stroke-linejoin="round" filter="url(#${id}-glow)"`)}${t(`${FONT} fill="url(#${id}-core)" stroke="#2f8cff" stroke-width=".6"`)}${arcs}${strikes}`);
}

function soulfire(item,id,text){
 const {s,w,t}=line(text,.44,60),x0=150-w/2;
 // Tongues of flame rise off the tops of the letters and fade.
 const flame=k=>{const x=x0+4+rnd(k)*(w-8),y=258-s*(.4+rnd(k+7)*.3),sc=1.3+rnd(k+9)*1,T=f(1+rnd(k+11)*.9);return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(sc)})"><g ${an('move',T,rnd(k+13)*T,`--dx:${f((rnd(k+15)-.5)*6)}px;--dy:-16px;--o:.95`)}><g ${an('flap',.22+rnd(k+17)*.2,rnd(k+19),'--fy:.75')}><path d="M0 0C-4 -4 -3.4 -9 0 -15C3.4 -9 4 -4 0 0Z" fill="url(#${id}-flame)"/><path d="M0 -1C-1.6 -3 -1.4 -6 0 -9C1.4 -6 1.6 -3 0 -1Z" fill="#effffe"/></g></g></g>`;};
 const defs=`${linear(`${id}-flame`,['#1aa89a00','#4de0e0','#d8ffff'])}${blur(`${id}-glow`,3)}`;
 return wrap(item,id,'#4de0e066',defs,`${t('font-family="RoundCaveat,cursive" font-weight="700" fill="#1aa89a" opacity=".8" filter="url(#'+id+'-glow)"')}${Array.from({length:Math.round(w/7)},(_,k)=>flame(k)).join('')}${t('font-family="RoundCaveat,cursive" font-weight="700" fill="#d8fbff"')}${t(`font-family="RoundCaveat,cursive" font-weight="700" fill="none" stroke="#4de0e0" stroke-width=".7" ${an('pulse',.6,0,'--lo:.3')}`)}`);
}

export const WAVE3_SIGNATURES={'fountain-pen':fountainPen,blackletter,'circuit-trace':circuitTrace,'smoke-script':smokeScript,'holo-sticker':holoSticker,'lightning-script':lightningScript,soulfire};
