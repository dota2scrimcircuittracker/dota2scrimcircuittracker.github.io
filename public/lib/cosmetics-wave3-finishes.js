// Finishes for the November 3 wave, drawn over the card art in its 300x400 space like the earlier waves.
// Finishes that re-treat the art carry their own <image>, which the card watcher keeps pointed at the card's
// artwork. Motion uses the .w2 classes (cosmetics-wave2.css) and the .w3 ones (cosmetics-wave3.css), paced on
// --particle-speed.
import {layer,readable} from './cosmetics-wave-finishes.js';
import {an} from './cosmetics-wave2-borders.js';
const rnd=n=>{const v=Math.sin(n*12.9898+78.233)*43758.5453;return v-Math.floor(v);};
const f=v=>Number(v.toFixed(2));
const ART='/img/hero-art/invoker.webp';
const art=(extra='')=>`<image href="${ART}" x="0" y="0" width="300" height="400" preserveAspectRatio="xMidYMid slice" ${extra}/>`;
const wrap=(item,id,defs,body)=>layer(item,id,defs,`<g class="w2f">${body}</g>`);
const w3=(cls,t,delay=0,extra='')=>`class="w2 w3 ${cls}" style="--t:${f(t)}s;animation-delay:${f(-delay)}s;${extra}"`;
const GREY='<feColorMatrix type="matrix" values=".3 .59 .11 0 0 .3 .59 .11 0 0 .3 .59 .11 0 0 0 0 0 1 0"/>';
const tone=(id,[r,g,b],pre='')=>`<filter id="${id}" color-interpolation-filters="sRGB">${pre}${GREY}<feComponentTransfer><feFuncR type="table" tableValues="${r}"/><feFuncG type="table" tableValues="${g}"/><feFuncB type="table" tableValues="${b}"/></feComponentTransfer></filter>`;
const stops=colors=>colors.map((c,i)=>`<stop offset="${f(i/(colors.length-1))}" stop-color="${c}"/>`).join('');
const linear=(id,colors,x2=0,y2=1)=>`<linearGradient id="${id}" x2="${x2}" y2="${y2}">${stops(colors)}</linearGradient>`;
const radial=(id,colors,cx=.5,cy=.5,r=.5)=>`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(colors)}</radialGradient>`;
const noise=(id,freq,seed,matrix,oct=2)=>`<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}"/><feColorMatrix values="${matrix}"/></filter>`;
const foot=(id,color,amount=.85)=>`<linearGradient id="${id}-foot" x2="0" y2="1"><stop offset=".62" stop-color="${color}" stop-opacity="0"/><stop offset=".84" stop-color="${color}" stop-opacity="${amount}"/></linearGradient>`;
const footRect=id=>`<rect width="300" height="400" fill="url(#${id}-foot)"/>`;
const sparkle=(x,y,s,k,color='#fff',t=1.8)=>`<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})"><path d="M0 -4L.7 -.7 4 0 .7 .7 0 4 -.7 .7 -4 0 -.7 -.7Z" fill="${color}" ${an('pulse',t+rnd(k)*1.4,rnd(k+3)*3,'--lo:0')}/></g>`;

// Common

function linen(item,id){
 const defs=`<pattern id="${id}-weave" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 1H2M2 3H4" stroke="#fff" stroke-width=".9" opacity=".22"/><path d="M1 2V4M3 0V2" stroke="#3a3020" stroke-width=".9" opacity=".22"/><path d="M2 1H4M0 3H2" stroke="#3a3020" stroke-width=".5" opacity=".14"/></pattern>${noise(`${id}-slub`,'.02 .6',3,'0 0 0 0 .95 0 0 0 0 .9 0 0 0 0 .8 0 0 0 .22 -.1',1)}`;
 return wrap(item,id,defs,`<rect width="300" height="400" fill="url(#${id}-weave)"/><rect width="300" height="400" filter="url(#${id}-slub)" opacity=".5"/>`);
}

// Rare

function mosaic(item,id){
 const T=10;
 const defs=`<filter id="${id}-sat" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="1.45"/></filter><pattern id="${id}-tiles" width="${T}" height="${T}" patternUnits="userSpaceOnUse"><path d="M0 0H${T}V${T}" fill="none" stroke="#1a120a" stroke-width="1.6" opacity=".85"/><path d="M1 1H${T-1.5}" stroke="#fff" stroke-width=".6" opacity=".25"/><path d="M1 ${T-1.4}H${T-1}" stroke="#000" stroke-width=".6" opacity=".3"/></pattern><pattern id="${id}-shade" width="${T*3}" height="${T*2}" patternUnits="userSpaceOnUse">${[[0,0,.1],[T,0,-.08],[T*2,0,.04],[0,T,-.06],[T,T,.09],[T*2,T,-.03]].map(([x,y,a])=>`<rect x="${x}" y="${y}" width="${T}" height="${T}" fill="${a>0?'#fff':'#000'}" opacity="${Math.abs(a)}"/>`).join('')}</pattern>${foot(id,'#140c06',.7)}`;
 const catches=Array.from({length:12},(_,k)=>`<rect x="${Math.floor(rnd(k)*30)*T+.8}" y="${Math.floor(rnd(k+20)*28)*T+.8}" width="${T-1.6}" height="${T-1.6}" fill="#fff" ${an('press',3+rnd(k+40)*4,rnd(k+60)*7,'--o:.55')}/>`).join('');
 return wrap(item,id,defs,`${art(`filter="url(#${id}-sat)"`)}<rect width="300" height="400" fill="url(#${id}-shade)"/><rect width="300" height="400" fill="url(#${id}-tiles)"/>${catches}${footRect(id)}`);
}

function polaroid(item,id){
 const defs=`<filter id="${id}-film" color-interpolation-filters="sRGB"><feColorMatrix values=".9 .14 .04 0 .04 .06 .86 .06 0 .03 .04 .12 .72 0 .06 0 0 0 1 0"/><feComponentTransfer><feFuncR type="linear" slope=".86" intercept=".1"/><feFuncG type="linear" slope=".84" intercept=".09"/><feFuncB type="linear" slope=".8" intercept=".1"/></feComponentTransfer></filter>${radial(`${id}-vig`,['#3a1a0800','#3a1a0800','#3a1a08aa'],.5,.45,.75)}${radial(`${id}-leak`,['#ffc078ff','#ff6a2aaa','#ff6a2a00'],1,0,.85)}${radial(`${id}-leak2`,['#ffe0a0aa','#ffe0a000'],0,1,.5)}${noise(`${id}-grain`,'.95',2,'0 0 0 0 .3 0 0 0 0 .22 0 0 0 0 .14 0 0 0 .45 -.1')}`;
 return wrap(item,id,defs,`${art(`filter="url(#${id}-film)"`)}<rect width="300" height="400" filter="url(#${id}-grain)"/><rect width="300" height="400" fill="url(#${id}-vig)"/><rect width="300" height="400" fill="url(#${id}-leak)" style="mix-blend-mode:screen" ${an('pulse',3.4,0,'--lo:.35')}/><rect width="300" height="400" fill="url(#${id}-leak2)" style="mix-blend-mode:screen" ${an('pulse',4.6,1.2,'--lo:.1;--hi:.7')}/>`);
}

function goldEmboss(item,id){
 // Brightness becomes gold; a lit relief (light from the top left) is laid over it.
 const defs=`${tone(`${id}-gold`,['.18 .55 .92 1','.1 .36 .76 .96','.02 .1 .3 .7'])}<filter id="${id}-relief" color-interpolation-filters="sRGB">${GREY}<feConvolveMatrix order="3" kernelMatrix="-2 -1 0 -1 1 1 0 1 2" preserveAlpha="true"/><feComponentTransfer><feFuncR type="linear" slope="1.2" intercept="-.1"/><feFuncG type="linear" slope="1.2" intercept="-.1"/><feFuncB type="linear" slope="1.2" intercept="-.1"/></feComponentTransfer></filter><linearGradient id="${id}-sheen" x2="1"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff8d8" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>${foot(id,'#2a1804',.75)}`;
 return wrap(item,id,defs,`${art(`filter="url(#${id}-gold)"`)}${art(`filter="url(#${id}-relief)" style="mix-blend-mode:overlay" opacity=".9"`)}<g ${an('wash',5.5)}><rect x="110" y="-20" width="60" height="440" fill="url(#${id}-sheen)" transform="skewX(-20)" style="mix-blend-mode:screen"/></g>${footRect(id)}`);
}

// Epic

function fireflies(item,id){
 const dusk=`<rect width="300" height="400" fill="url(#${id}-dusk)"/>`;
 const fly=k=>{const x=f(20+rnd(k)*260),y=f(30+rnd(k+20)*250),t=f(7+rnd(k+40)*6);return `<g transform="translate(${x} ${y})"><g ${an('wander',t,rnd(k+60)*t,`--dx:${f((rnd(k+80)-.5)*50)}px;--dy:${f((rnd(k+100)-.5)*36)}px`)}><g ${an('pulse',1.2+rnd(k+120)*1.6,rnd(k+140)*2,'--lo:.05')}><circle r="11" fill="url(#${id}-halo)"/><circle r="2.2" fill="#fbffd0"/></g></g></g>`;};
 const defs=`${linear(`${id}-dusk`,['#0a143077','#1a2a1033','#00000000'])}${radial(`${id}-halo`,['#f2ff9acc','#d8ff4a55','#d8ff4a00'])}${readable(id,.7,.9,.45)}`;
 return wrap(item,id,defs,`${dusk}<g mask="url(#${id}-read)" style="mix-blend-mode:screen">${Array.from({length:16},(_,k)=>fly(k)).join('')}</g>`);
}

function sakuraFall(item,id){
 const petal=(k,s=1)=>`<path d="M0 -3.6C2.6 -3.6 3.6 -.8 2.4 1.6L0 3.6L-2.4 1.6C-3.6 -.8 -2.6 -3.6 0 -3.6Z" transform="scale(${s})" fill="url(#${id}-petal)"/><path d="M0 -3.2V-1.4" stroke="#ff8ab4" stroke-width=".5" transform="scale(${s})"/>`;
 const falling=Array.from({length:22},(_,k)=>{const t=f(7+rnd(k)*5),x=f(rnd(k+10)*330-10);return `<g transform="translate(${x} -12)"><g ${an('move',t,rnd(k+20)*t,`--dx:${f(-40-rnd(k+30)*60)}px;--dy:${f(360+rnd(k+40)*80)}px;--o:.95`)}><g ${an('spin',2.4+rnd(k+50)*2.6,rnd(k+60)*3,`--turn:${rnd(k+70)>.5?360:-360}deg`)}>${petal(k,.9+rnd(k+80)*.7)}</g></g></g>`;}).join('');
 const blossom=(x,y,s,k)=>`<g transform="translate(${x} ${y}) scale(${s})">${[0,72,144,216,288].map(a=>`<path transform="rotate(${a})" d="M0 0C-2.6 -2 -2.6 -6 0 -7.2C2.6 -6 2.6 -2 0 0Z" fill="url(#${id}-petal)" stroke="#e86a98" stroke-width=".3"/>`).join('')}<circle r="1.4" fill="#ffe08a"/></g>`;
 const branch=`<g transform="translate(300 0)"><g ${an('sway',4,0,'--a:2deg')}><path d="M0 18Q-40 30 -78 26Q-100 24 -120 40M-54 28Q-62 44 -58 60M-90 27Q-96 12 -110 6" fill="none" stroke="#3a2418" stroke-width="3.4" stroke-linecap="round"/><path d="M0 18Q-40 30 -78 26" fill="none" stroke="#6a4a38" stroke-width="1" opacity=".6"/>${[[-30,24,1.1],[-62,22,.9],[-80,30,1.2],[-104,30,.9],[-120,40,1],[-58,58,.85],[-110,8,.8],[-46,32,.7]].map(([x,y,s],k)=>blossom(x,y,s,k)).join('')}</g></g>`;
 const defs=`${radial(`${id}-petal`,['#fff4f8','#ffc2d8','#ff8ab4'],.4,.3,.7)}${readable(id,.68,.88,.45)}`;
 return wrap(item,id,defs,`<g mask="url(#${id}-read)">${falling}</g>${branch}`);
}

// Legendary

function ravage(item,id){
 // Tentacles burst up through a churning sea in a staggered wave, hold, and sink; spray flies as each one breaks
 // the surface and the art shakes on impact. Two smaller, darker ones rise behind for depth.
 // A tentacle grows from its base (0,0) along a spine: it leans one way, then the tip curls tight the other (c is the
 // curl side, 1 right, -1 left). The body tapers, lit along its outer edge, with a pale sucker-lined underside inside the curl.
 const tentacle=(x,len,width,c,k,pal)=>{
  const N=40,P=[];let px=0,py=0,a=-Math.PI/2-c*.12;
  for(let i=0;i<=N;i++){const t=i/N;P.push({x:px,y:py,a,t,w:width*Math.pow(1-t,.62)+1.6});const ds=len/N*(1.45-1.05*t)/.925;px+=Math.cos(a)*ds;py+=Math.sin(a)*ds;a+=c*(30*t**4+.55)/N;}
  // A point offset across the body: s from -1 (outer edge) to 1 (inner edge, inside the curl).
  const off=(p,s)=>{const nx=-Math.sin(p.a)*c,ny=Math.cos(p.a)*c;return [p.x+nx*s*p.w/2,p.y+ny*s*p.w/2];};
  const strip=(s1,s2,from=0,to=N)=>{const A=P.slice(from,to+1);return 'M'+[...A.map(p=>off(p,s1)),...A.reverse().map(p=>off(p,s2))].map(([u,v])=>`${f(u)} ${f(v)}`).join('L')+'Z';};
  const tip=P[N],body=strip(-1,1).replace('M',`M${f(-width/2*c)} 60L`);
  const suckers=P.filter((p,i)=>i%2===0&&p.t>.05&&p.t<.86).map(p=>{const [u,v]=off(p,.5),r=f(Math.max(1,p.w*.17));return `<circle cx="${f(u)}" cy="${f(v)}" r="${r}" fill="${pal.sucker}" stroke="${pal.line}" stroke-width=".5"/><circle cx="${f(u)}" cy="${f(v)}" r="${f(r*.42)}" fill="${pal.pit}"/>`;}).join('');
  const spots=P.filter((p,i)=>i%3===1&&p.t<.75).map((p,i)=>{const [u,v]=off(p,-.45+rnd(k*9+i)*.3);return `<ellipse cx="${f(u)}" cy="${f(v)}" rx="${f(p.w*.09+.6)}" ry="${f(p.w*.06+.4)}" fill="${pal.spot}" opacity=".7"/>`;}).join('');
  const shape=`<path d="${body}" fill="${pal.body}" stroke="${pal.line}" stroke-width="1.3" stroke-linejoin="round"/>`
   +`<path d="${strip(.15,1,0,N-2)}" fill="${pal.under}"/>`
   +`<path d="${strip(-.82,-.18,0,N-3)}" fill="${pal.lit}" opacity=".55" filter="url(#${id}-soft)"/>`
   +`<path d="${strip(-.9,-.72,0,N-4)}" fill="${pal.rim}" opacity=".6"/>`
   +spots+suckers+`<circle cx="${f(tip.x)}" cy="${f(tip.y)}" r=".8" fill="${pal.line}"/>`;
  return `<g transform="translate(${x} 404)"><g ${w3('erupt',5.4,-k*.32,`--dy:${f(len+40)}px`)}><g ${an('sway',2+k*.35,k*.5,`--a:${3+k%2*2}deg`)}>${shape}</g></g></g>`;};
 const FRONT={body:'#1f7a68',under:'#cfeedd',lit:'#5fd0b4',rim:'#b4f5e2',spot:'#0f4a3f',line:'#052a23',sucker:'#f4fff9',pit:'#7fae9f'};
 const BACK={body:'#13493f',under:'#7fa99a',lit:'#2f8a77',rim:'#5fb39f',spot:'#0a2f28',line:'#031914',sucker:'#a9c9bd',pit:'#4d7468'};
 const back=[[104,215,24,-1,1],[206,200,22,1,3]].map(([x,l,w,c,k])=>tentacle(x,l,w,c,k,BACK)).join('');
 const front=[[30,290,46,1,0],[272,270,44,-1,2]].map(([x,l,w,c,k])=>tentacle(x,l,w,c,k,FRONT)).join('');
 // Spray: each tentacle throws a crown of drops as it breaks the surface, on its own delay.
 const spray=[[30,0],[104,1],[206,3],[272,2]].map(([x,k])=>Array.from({length:9},(_,j)=>{const n=k*20+j;return `<g transform="translate(${f(x+(rnd(n)-.5)*30)} 384)"><circle r="${f(1.2+rnd(n+7)*2.4)}" fill="#e6fbff" ${w3('splash',5.4,-k*.32,`--dx:${f((rnd(n+40)-.5)*70)}px;--dy:-${f(40+rnd(n+60)*100)}px`)}/></g>`;}).join('')).join('');
 // The sea: two swells rolling across at different speeds, each one wavelength per cycle so the loop is seamless.
 const swell=(y,amp,len,fill,crest,t,dir)=>{let d=`M-${len*2} 410V${y}`;for(let x=-len*2;x<300+len*2;x+=len)d+=`Q${x+len/4} ${y-amp} ${x+len/2} ${y}T${x+len} ${y}`;d+=`V410Z`;
  return `<g ${an('slide',t,0,`--dx:${dir*len}px`)}><path d="${d}" fill="${fill}"/><path d="${d.replace(/V410Z$/,'').replace(/^M\S+ 410V/,`M-${len*2} `)}" fill="none" stroke="${crest}" stroke-width="2" opacity=".7"/></g>`;};
 const sea=swell(372,9,60,'#0c4f5acc','#bff4ff',4,1)+swell(386,7,44,'#06323bdd','#e6fbff',2.8,-1);
 const defs=`${linear(`${id}-deep`,['#04262c00','#04262c00','#04262caa'])}<filter id="${id}-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="${id}-far" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".7"/></filter>`;
 return wrap(item,id,defs,`<g ${w3('quake',5.4)}>${art()}</g><rect width="300" height="400" fill="url(#${id}-deep)"/><g filter="url(#${id}-far)">${back}</g>${front}${sea}${spray}`);
}

function midasTouch(item,id){
 // A gilded copy of the art, uncovered by a circle spreading from the bottom-left corner.
 const sparks=Array.from({length:18},(_,k)=>sparkle(20+rnd(k)*260,30+rnd(k+20)*300,.8+rnd(k+40)*.8,k,'#fff6c0')).join('');
 const flecks=Array.from({length:30},(_,k)=>`<circle cx="${f(rnd(k+100)*300)}" cy="${f(rnd(k+130)*400)}" r="${f(.4+rnd(k+160)*.9)}" fill="#ffe27a" opacity=".8"/>`).join('');
 const defs=`${tone(`${id}-gild`,['.25 .62 .95 1 1','.12 .4 .74 .9 .98','.02 .1 .26 .5 .78'])}${radial(`${id}-edge`,['#fff','#fff','#fff','#000'],.5,.5,.5)}<mask id="${id}-spread" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="400"><g transform="translate(30 380)"><g ${w3('gild',8)}><circle r="520" fill="url(#${id}-edge)"/></g></g></mask><radialGradient id="${id}-rim" r=".5">${stops(['#ffe27a00','#ffe27a00','#ffe27a00','#fff3b0','#ffe27a00'])}</radialGradient><linearGradient id="${id}-sheen" x2="1"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fffbe0" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>${foot(id,'#2a1804',.6)}`;
 const front=`<g transform="translate(30 380)"><g ${w3('gild',8)}><circle r="520" fill="url(#${id}-rim)" opacity=".7"/></g></g>`;
 return wrap(item,id,defs,`<g mask="url(#${id}-spread)">${art(`filter="url(#${id}-gild)"`)}${flecks}<g ${an('wash',4)}><rect x="110" y="-20" width="50" height="440" fill="url(#${id}-sheen)" transform="skewX(-20)" style="mix-blend-mode:screen"/></g>${sparks}${footRect(id)}</g>${front}`);
}

export const WAVE3_FINISHES={linen,mosaic,polaroid,'gold-emboss':goldEmboss,fireflies,'sakura-fall':sakuraFall,ravage,'midas-touch':midasTouch};
