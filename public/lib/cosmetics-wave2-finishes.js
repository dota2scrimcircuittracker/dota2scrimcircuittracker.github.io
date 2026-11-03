// Finishes for the October 30 wave, drawn over the card art in its 300x400 space like the October 20 wave.
// Finishes that re-treat the art carry their own <image>, which the card watcher keeps pointed at the card's
// artwork. Motion comes from cosmetics-wave2.css and paces on --particle-speed.
import {layer,readable} from './cosmetics-wave-finishes.js';
import {an} from './cosmetics-wave2-borders.js';
import {normalizeSettings} from './cosmetics-expansion-settings.js';
const rnd=n=>{const v=Math.sin(n*12.9898+78.233)*43758.5453;return v-Math.floor(v);};
const f=v=>Number(v.toFixed(2));
const ART='/img/hero-art/invoker.webp';
const art=(extra='')=>`<image href="${ART}" x="0" y="0" width="300" height="400" preserveAspectRatio="xMidYMid slice" ${extra}/>`;
const wrap=(item,id,defs,body)=>layer(item,id,defs,`<g class="w2f">${body}</g>`);
const GREY='<feColorMatrix type="matrix" values=".3 .59 .11 0 0 .3 .59 .11 0 0 .3 .59 .11 0 0 0 0 0 1 0"/>';
// Luminance remapped through a table per channel: [r,g,b] each a list from shadow to highlight.
const tone=(id,[r,g,b],pre='')=>`<filter id="${id}" color-interpolation-filters="sRGB">${pre}${GREY}<feComponentTransfer><feFuncR type="table" tableValues="${r}"/><feFuncG type="table" tableValues="${g}"/><feFuncB type="table" tableValues="${b}"/></feComponentTransfer></filter>`;
const stops=colors=>colors.map((c,i)=>`<stop offset="${f(i/(colors.length-1))}" stop-color="${c}"/>`).join('');
const linear=(id,colors,x2=0,y2=1)=>`<linearGradient id="${id}" x2="${x2}" y2="${y2}">${stops(colors)}</linearGradient>`;
const radial=(id,colors,cx=.5,cy=.5,r=.5)=>`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(colors)}</radialGradient>`;
const blur=(id,d)=>`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${d}"/></filter>`;
const noise=(id,freq,seed,matrix)=>`<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${seed}"/><feColorMatrix values="${matrix}"/></filter>`;
// Darkens the bottom of a re-treated art so the white name plate still reads.
const foot=(id,color,amount=.85)=>`<linearGradient id="${id}-foot" x2="0" y2="1"><stop offset=".62" stop-color="${color}" stop-opacity="0"/><stop offset=".84" stop-color="${color}" stop-opacity="${amount}"/></linearGradient>`;
const footRect=id=>`<rect width="300" height="400" fill="url(#${id}-foot)"/>`;

// Rare

function duotone(item,id){
 const defs=`${tone(`${id}-ink`,['.17 .88 1','.06 .21 .48','.33 .54 .24'])}${foot(id,'#1a0636')}`;
 return wrap(item,id,defs,`${art(`filter="url(#${id}-ink)"`)}${footRect(id)}`);
}

function sepiaPhoto(item,id){
 const sepia='<feColorMatrix values=".39 .77 .19 0 0 .35 .69 .17 0 0 .27 .53 .13 0 0 0 0 0 1 0"/>';
 const defs=`<filter id="${id}-sepia" color-interpolation-filters="sRGB">${sepia}<feComponentTransfer><feFuncR type="linear" slope="1.1" intercept="-.04"/><feFuncG type="linear" slope="1.05" intercept="-.04"/><feFuncB type="linear" slope=".95" intercept="-.02"/></feComponentTransfer></filter>${radial(`${id}-vig`,['#2a1a0a00','#2a1a0a00','#2a1a0acc'],.5,.42,.78)}${noise(`${id}-grain`,'.9',7,'0 0 0 0 .2 0 0 0 0 .14 0 0 0 0 .08 0 0 0 .5 -.1')}${foot(id,'#1e130a',.75)}`;
 const scratches=[0,1,2].map(k=>`<g ${an('jitter',.9+k*.37,k*.3,`--dx:${f(40+k*30)}px;--dy:0px`)}><path d="M${60+k*80} 0L${f(62+k*80+rnd(k)*3)} 400" stroke="#f6ead2" stroke-width="${f(.4+rnd(k+3)*.4)}" opacity=".5"/></g>`).join('');
 const dust=Array.from({length:16},(_,k)=>`<circle cx="${f(rnd(k)*300)}" cy="${f(rnd(k+40)*400)}" r="${f(.4+rnd(k+80)*1.1)}" fill="${k%3?'#1e130a':'#f6ead2'}" ${an('blink',.5+rnd(k+9)*.9,rnd(k+11),'--lo:0')}/>`).join('');
 return wrap(item,id,defs,`${art(`filter="url(#${id}-sepia)"`)}<rect width="300" height="400" filter="url(#${id}-grain)"/><rect width="300" height="400" fill="url(#${id}-vig)"/>${footRect(id)}<path d="M0 150Q150 158 300 146" stroke="#f6ead2" stroke-width=".7" opacity=".25" fill="none"/>${scratches}${dust}`);
}

function nightVision(item,id){
 const defs=`${tone(`${id}-nv`,['0 .05 .3 .7','.04 .4 .85 1','0 .06 .25 .6'])}${noise(`${id}-grain`,'1.3',3,'0 0 0 0 .5 0 0 0 0 1 0 0 0 0 .5 0 0 0 .55 -.15')}${radial(`${id}-vig`,['#00000000','#00000000','#000000f0'],.5,.45,.72)}${foot(id,'#021004',.7)}`;
 const hud=`<g fill="#b9ff9f" font-family="RoundMono,monospace" font-size="7" opacity=".85"><circle cx="236" cy="350" r="3" fill="#ff3b30" ${an('blink',1.2)}/><text x="243" y="352.5">REC</text><text x="266" y="364" text-anchor="end">NV-2 ×4</text></g><g stroke="#b9ff9f" stroke-width=".7" opacity=".6" fill="none"><path d="M150 150V162M150 178V190M130 170H142M158 170H170"/><circle cx="150" cy="170" r="22" stroke-dasharray="3 4"/></g>`;
 return wrap(item,id,defs,`${art(`filter="url(#${id}-nv)"`)}<g ${an('jitter',.24,0,'--dx:9px;--dy:-7px')}><rect x="-20" y="-20" width="340" height="440" filter="url(#${id}-grain)" opacity=".45"/></g><rect width="300" height="400" fill="url(#${id}-vig)"/>${footRect(id)}${hud}`);
}

function xRay(item,id){
 const defs=`${tone(`${id}-ray`,['.85 .4 .1 .02','.98 .62 .2 .06','1 .82 .38 .14'])}${linear(`${id}-scan`,['#9fe8ff00','#9fe8ff88','#9fe8ff00'])}${foot(id,'#030a12',.85)}<pattern id="${id}-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#9fe8ff" stroke-width=".3" opacity=".25"/></pattern>`;
 return wrap(item,id,defs,`${art(`filter="url(#${id}-ray)"`)}<rect width="300" height="400" fill="url(#${id}-grid)"/>${footRect(id)}<g ${an('slide',5,0,'--dy:440px')}><rect x="0" y="-40" width="300" height="34" fill="url(#${id}-scan)"/></g><text x="252" y="342" font-family="Georgia,serif" font-weight="700" font-size="20" fill="#e6fbff" opacity=".8">R</text><text x="270" y="356" text-anchor="end" font-family="RoundMono,monospace" font-size="6" fill="#e6fbff" opacity=".7">AD2L · 30.10.26</text>`);
}

function watercolour(item,id){
 const defs=`<filter id="${id}-wash" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".022" numOctaves="3" seed="8" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" result="d"/><feColorMatrix in="d" type="saturate" values="1.35" result="s"/><feComponentTransfer in="s"><feFuncR type="linear" slope=".85" intercept=".12"/><feFuncG type="linear" slope=".85" intercept=".12"/><feFuncB type="linear" slope=".85" intercept=".1"/></feComponentTransfer></filter><filter id="${id}-edge" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="2"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 -3 2.1"/></filter><mask id="${id}-bleed" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="400"><rect width="300" height="400" fill="url(#${id}-oval)"/><rect width="300" height="400" filter="url(#${id}-edge)" style="mix-blend-mode:multiply"/></mask>${radial(`${id}-oval`,['#fff','#fff','#000'],.5,.45,.62)}${noise(`${id}-paper`,'.7',4,'0 0 0 0 .55 0 0 0 0 .5 0 0 0 0 .42 0 0 0 .35 0')}${foot(id,'#203040',.7)}`;
 const blooms=[[70,90,'#5fa8d3'],[230,120,'#e07a9a'],[60,290,'#e8b04a'],[240,300,'#5fb07a']].map(([x,y,c],k)=>`<circle cx="${x}" cy="${y}" r="${30+k*6}" fill="${c}" opacity=".18" filter="url(#${id}-soft)"/>`).join('');
 return wrap(item,id,defs+blur(`${id}-soft`,10),`<rect width="300" height="400" fill="#f5efe3"/>${blooms}<g mask="url(#${id}-bleed)">${art(`filter="url(#${id}-wash)"`)}</g><rect width="300" height="400" filter="url(#${id}-paper)" style="mix-blend-mode:multiply"/>${footRect(id)}`);
}

function dandelionSeeds(item,id){
 const seed=k=>`<g ${an('sway',2+rnd(k)*1.5,rnd(k+3)*2,'--a:10deg')}><path d="M0 0V-8" stroke="#e9e2c8" stroke-width=".4"/>${Array.from({length:11},(_,i)=>{const a=(-90+(i-5)*15)*Math.PI/180;return `<path d="M0 -8L${f(Math.cos(a)*6)} ${f(-8+Math.sin(a)*6)}" stroke="#fffbe8" stroke-width=".3" opacity=".9"/>`;}).join('')}<ellipse cy="1" rx=".6" ry="1.4" fill="#8a7a50"/></g>`;
 const seeds=Array.from({length:22},(_,k)=>`<g transform="translate(${f(rnd(k)*300)} ${f(200+rnd(k+30)*230)}) scale(${f(.8+rnd(k+60)*.7)})"><g ${an('move',11+rnd(k+90)*8,rnd(k+120)*18,`--dx:${f(40+rnd(k+150)*80)}px;--dy:${f(-200-rnd(k+180)*180)}px;--o:.9`)}>${seed(k)}</g></g>`).join('');
 return wrap(item,id,readable(id,.66,.86,.4),`<g mask="url(#${id}-read)">${seeds}</g>`);
}

function soapBubbles(item,id){
 const defs=`<radialGradient id="${id}-film" cx=".5" cy=".5" r=".5"><stop offset=".7" stop-color="#fff" stop-opacity="0"/><stop offset=".86" stop-color="#ff9de2" stop-opacity=".22"/><stop offset=".93" stop-color="#9de8ff" stop-opacity=".45"/><stop offset=".97" stop-color="#d4ff9d" stop-opacity=".4"/><stop offset="1" stop-color="#fff" stop-opacity=".7"/></radialGradient>${readable(id,.7,.88,.5)}`;
 const bubbles=Array.from({length:18},(_,k)=>{const r=f(4+rnd(k)*11);return `<g transform="translate(${f(rnd(k+20)*300)} ${f(260+rnd(k+40)*180)})"><g ${an('move',9+rnd(k+60)*7,rnd(k+80)*16,`--dx:${f((rnd(k+100)-.5)*70)}px;--dy:${f(-240-rnd(k+120)*120)}px;--o:1`)}><circle r="${r}" fill="url(#${id}-film)"/><ellipse cx="${f(-r*.35)}" cy="${f(-r*.4)}" rx="${f(r*.25)}" ry="${f(r*.14)}" fill="#fff" opacity=".7" transform="rotate(-35 ${f(-r*.35)} ${f(-r*.4)})"/></g></g>`;}).join('');
 return wrap(item,id,defs,`<g mask="url(#${id}-read)">${bubbles}</g>`);
}

function lowPoly(item,id){
 const cols=7,rows=9,cw=300/cols,rh=400/rows,P=[];
 for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){const edge=x===0||x===cols||y===0||y===rows;P.push([f(x*cw+(edge&&(x===0||x===cols)?0:(rnd(x*31+y)-.5)*cw*.7)),f(y*rh+(edge&&(y===0||y===rows)?0:(rnd(x*17+y*7+3)-.5)*rh*.7))]);}
 const p=(x,y)=>P[y*(cols+1)+x];let tris='';
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=p(x,y),b=p(x+1,y),c=p(x,y+1),d=p(x+1,y+1),s=y*cols+x;for(const [t,k] of [[[a,b,d],0],[[a,d,c],1]]){const v=rnd(s*2+k),light=v>.5;tris+=`<path d="M${t.map(q=>q.join(' ')).join('L')}Z" fill="${light?'#fff':'#000'}" fill-opacity="${f(.03+Math.abs(v-.5)*.22)}" stroke="#fff" stroke-opacity=".08" stroke-width=".5"/>`;}}
 const defs=`${linear(`${id}-sheen`,['#fff0','#fff6','#fff0'],1,0)}${readable(id,.66,.86,.5)}`;
 return wrap(item,id,defs,`<g mask="url(#${id}-read)">${tris}</g><g ${an('slide',8,0,'--dx:520px')}><rect x="-140" y="-40" width="90" height="480" fill="url(#${id}-sheen)" transform="skewX(-18)"/></g>`);
}

function petrified(item,id){
 let s=0;const crack=(x,y,a,len)=>{let d=`M${x} ${y}`,px=x,py=y;for(let i=0;i<8;i++){a+=(rnd(++s)-.5)*1.1;px+=Math.cos(a)*len/8;py+=Math.sin(a)*len/8;d+=`L${f(px)} ${f(py)}`;}return d;};
 const cracks=[[40,60,.9,90],[250,40,2.2,110],[150,10,1.5,80],[20,230,.2,120],[290,200,3,100],[120,150,.6,70]].map(([x,y,a,l])=>crack(x,y,a,l)).join('');
 const defs=`${tone(`${id}-stone`,['.12 .42 .7 .86','.12 .41 .68 .84','.11 .38 .63 .8'])}<filter id="${id}-rock" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="4" seed="5" result="n"/><feDiffuseLighting in="n" lighting-color="#fff" surfaceScale="2.4" result="l"><feDistantLight azimuth="235" elevation="48"/></feDiffuseLighting><feColorMatrix in="l" values=".6 0 0 0 .2 .6 0 0 0 .2 .6 0 0 0 .19 0 0 0 0 1"/></filter>${radial(`${id}-moss`,['#5f8f3acc','#4f7a3a88','#4f7a3a00'])}${foot(id,'#1a1814',.7)}`;
 return wrap(item,id,defs,`${art(`filter="url(#${id}-stone)"`)}<rect width="300" height="400" filter="url(#${id}-rock)" style="mix-blend-mode:multiply" opacity=".85"/><path d="${cracks}" fill="none" stroke="#1c1a16" stroke-width="1.3" stroke-linejoin="round"/><path d="${cracks}" fill="none" stroke="#d8d4ca" stroke-width=".4" transform="translate(.7 .7)" opacity=".5"/><circle cx="10" cy="400" r="70" fill="url(#${id}-moss)"/><circle cx="295" cy="390" r="56" fill="url(#${id}-moss)"/>${footRect(id)}`);
}

function anaglyph(item,id){
 // Red and cyan halves of the art, offset and drifting apart and back like an old 3D comic without the glasses.
 const keep=(r,g,b)=>`<filter id="${id}-${r?'red':'cyan'}" color-interpolation-filters="sRGB"><feColorMatrix values="${r} 0 0 0 0 0 ${g} 0 0 0 0 0 ${b} 0 0 0 0 0 1 0"/></filter>`;
 const copy=(name,dx)=>`<g style="mix-blend-mode:screen"><g ${an('bob',3.2,0,`--dx:${dx}px;--dy:0px`)}><image href="${ART}" x="${-8+dx}" y="0" width="316" height="400" preserveAspectRatio="xMidYMid slice" filter="url(#${id}-${name})"/></g></g>`;
 const defs=`${keep(1,0,0)}${keep(0,1,1)}${foot(id,'#06040a',.75)}`;
 return wrap(item,id,defs,`<rect width="300" height="400" fill="#000"/>${copy('red',-3)}${copy('cyan',3)}${footRect(id)}`);
}

// Epic

function popArt(item,id){
 const inks=[['.9 1 1','.18 .55 .88','.58 .3 .3'],['0 .3 1','.25 .55 .31','.6 .85 .85'],['.17 .7 1','.35 .4 .88','1 .55 .3'],['.12 .24 1','.45 .86 .23','.25 .6 .23']];
 const panel=(x,y,k)=>`<svg x="${x}" y="${y}" width="150" height="200" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice">${art(`filter="url(#${id}-ink-${k})"`)}<rect width="300" height="400" fill="url(#${id}-dots)" opacity=".35"/><rect width="300" height="400" fill="#fff" opacity="0" ${an('press',6,k*1.5,'--o:.22')}/></svg>`;
 const defs=`${inks.map((ink,k)=>tone(`${id}-ink-${k}`,ink)).join('')}<pattern id="${id}-dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.6" fill="#000"/></pattern>${foot(id,'#000',.6)}`;
 return wrap(item,id,defs,`${panel(0,0,0)}${panel(150,0,1)}${panel(0,200,2)}${panel(150,200,3)}<path d="M150 0V400M0 200H300" stroke="#111" stroke-width="4"/>${footRect(id)}`);
}

function neonOutline(item,id){
 const edge=(name,[r,g,b])=>`<filter id="${id}-${name}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${GREY}<feConvolveMatrix order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true"/><feComponentTransfer><feFuncR type="linear" slope="5"/><feFuncG type="linear" slope="5"/><feFuncB type="linear" slope="5"/></feComponentTransfer><feColorMatrix values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 1.2 0 0 0 -.15" result="e"/><feGaussianBlur in="e" stdDeviation="2" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="e"/></feMerge></filter>`;
 const defs=`${edge('pink',[1,.31,.85])}${edge('cyan',[.16,.94,1])}${foot(id,'#05010a',.6)}`;
 return wrap(item,id,defs,`<rect width="300" height="400" fill="#07020f" opacity=".72"/><g style="mix-blend-mode:screen">${art(`filter="url(#${id}-pink)"`)}<g ${an('pulse',4,0,'--lo:0')}>${art(`filter="url(#${id}-cyan)"`)}</g></g>${footRect(id)}`);
}

function codeRain(item,id){
 const glyphs='アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF';
 const cols=Array.from({length:25},(_,k)=>{const x=6+k*12,n=10+Math.floor(rnd(k)*8),t=4+rnd(k+30)*5;return `<g transform="translate(${x} ${f(-n*13)})"><g ${an('slide',t,rnd(k+60)*t,`--dy:${f(400+n*13)}px`)}>${Array.from({length:n},(_,i)=>`<text y="${i*13}" text-anchor="middle" font-family="RoundMono,monospace" font-size="11" fill="${i===n-1?'#eaffef':'#3dff7a'}" fill-opacity="${f(i===n-1?1:.15+i/n*.75)}">${glyphs[Math.floor(rnd(k*40+i)*glyphs.length)]}</text>`).join('')}</g></g>`;}).join('');
 const defs=`${tone(`${id}-green`,['0 .02 .15','.02 .3 .9','0 .06 .3'])}${readable(id,.64,.84,.35)}`;
 return wrap(item,id,defs,`${art(`filter="url(#${id}-green)" opacity=".75"`)}<rect width="300" height="400" fill="#021a08" opacity=".45"/><g mask="url(#${id}-read)">${cols}</g>`);
}

function spotlight(item,id){
 // Each spot is a big dark sheet with a soft hole that roams; where they overlap the stage stays darkest.
 const spot=(x,y,cls,t,d,dx,dy,tint)=>`<g transform="translate(${x} ${y})"><g ${an(cls,t,d,`--dx:${dx}px;--dy:${dy}px`)}><rect x="-450" y="-500" width="900" height="1000" fill="url(#${id}-hole)"/><circle r="80" fill="url(#${id}-${tint})" style="mix-blend-mode:screen"/></g></g>`;
 const defs=`<radialGradient id="${id}-hole" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="450"><stop offset="0" stop-color="#05040a" stop-opacity="0"/><stop offset=".12" stop-color="#05040a" stop-opacity="0"/><stop offset=".22" stop-color="#05040a" stop-opacity=".6"/><stop offset="1" stop-color="#05040a" stop-opacity=".6"/></radialGradient>${radial(`${id}-warm`,['#ffe2a855','#ffe2a822','#ffe2a800'])}${radial(`${id}-cool`,['#a8d8ff44','#a8d8ff18','#a8d8ff00'])}`;
 return wrap(item,id,defs,`${spot(110,150,'wander',14,0,50,35,'warm')}${spot(200,210,'wander-back',17,4,40,30,'cool')}`);
}

function speedLines(item,id){
 const lines=set=>Array.from({length:70},(_,k)=>{const a=(k/70+rnd(k+set*100)*.012)*Math.PI*2,w=f(.6+rnd(k+set*50)*2.6),r0=f(108+rnd(k+set*70)*40),c=Math.cos(a),s=Math.sin(a),px=-s*w,py=c*w;return `<path d="M${f(150+c*r0)} ${f(175+s*r0)}L${f(150+c*330+px)} ${f(175+s*330+py)}L${f(150+c*330-px)} ${f(175+s*330-py)}Z"/>`;}).join('');
 const defs=`<pattern id="${id}-tone" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r=".9" fill="#f6f2e6"/></pattern>${radial(`${id}-corner`,['#fff','#fff','#000'],.5,.5,.5)}<mask id="${id}-tones" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="400"><rect width="300" height="400" fill="#fff"/><ellipse cx="150" cy="190" rx="190" ry="240" fill="url(#${id}-corner)"/></mask>${readable(id,.62,.84,.4)}`;
 const sfx=`<g transform="translate(196 300) rotate(-10)"><g ${an('jitter',.18,0,'--dx:1.2px;--dy:-1px')}><text font-family="RoundMarker,Impact,sans-serif" font-size="30" font-weight="900" fill="#fff" stroke="#111" stroke-width="5" paint-order="stroke" letter-spacing="-2">ドドド</text></g></g>`;
 return wrap(item,id,defs,`<rect width="300" height="400" fill="url(#${id}-tone)" opacity=".35" mask="url(#${id}-tones)"/><g mask="url(#${id}-read)" fill="#f6f2e6" opacity=".85"><g ${an('blink',.24,0,'--lo:0')}>${lines(0)}</g><g ${an('blink',.24,.12,'--lo:0')}>${lines(1)}</g></g>${sfx}`);
}

function magnifyingGlass(item,id){
 const cx=150,cy=150,r=42,s=1.7;
 const defs=`<clipPath id="${id}-lens"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>${radial(`${id}-glare`,['#fff8','#fff2','#fff0'],.35,.3,.6)}${linear(`${id}-brass`,['#f2d38a','#a8781a','#f2d38a','#6b4a10'],1,1)}`;
 const zoom=`<g clip-path="url(#${id}-lens)"><rect x="${cx-r}" y="${cy-r}" width="${2*r}" height="${2*r}" fill="#0b0a09"/><g transform="translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})"><g ${an('lens-anti',16)}>${art()}</g></g><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-glare)"/></g>`;
 const rim=`<circle cx="${cx}" cy="${cy}" r="${r+2}" fill="none" stroke="#2a1a05" stroke-width="7" opacity=".5"/><circle cx="${cx}" cy="${cy}" r="${r+2}" fill="none" stroke="url(#${id}-brass)" stroke-width="5"/><path d="M${cx+33} ${cy+33}L${cx+66} ${cy+66}" stroke="#3a2410" stroke-width="10" stroke-linecap="round"/><path d="M${cx+33} ${cy+33}L${cx+66} ${cy+66}" stroke="#7a4a20" stroke-width="7" stroke-linecap="round"/><path d="M${cx+31} ${cy+31}L${cx+38} ${cy+38}" stroke="url(#${id}-brass)" stroke-width="9"/>`;
 return wrap(item,id,defs,`<g ${an('lens',16)}><circle cx="${cx+4}" cy="${cy+6}" r="${r+3}" fill="#000" opacity=".3"/>${zoom}${rim}</g>`);
}

function jigsaw(item,id){
 const C=4,R=5,cw=75,rh=80,tab=(i,j,h)=>rnd(i*13+j*7+(h?3:9))>.5?1:-1;
 // An edge from (x,y) of length L along h (horizontal) or vertical, with a knob pushed out by s.
 const edge=(x,y,L,h,s,rev)=>{const p=(u,v)=>h?`${f(x+u)} ${f(y+v*s)}`:`${f(x+v*s)} ${f(y+u)}`;const seg=[[.38,0],[.34,-.16],[.66,-.16],[.62,0],[1,0]].map(([u,v])=>[u*L,v*L]);
  if(!rev)return `L${p(seg[0][0],0)}C${p(seg[1][0],seg[1][1])} ${p(seg[2][0],seg[2][1])} ${p(seg[3][0],0)}L${p(L,0)}`;
  return `L${p(L-seg[0][0],0)}C${p(L-seg[1][0],seg[1][1])} ${p(L-seg[2][0],seg[2][1])} ${p(L-seg[3][0],0)}L${p(0,0)}`;};
 let grid='';
 for(let j=1;j<R;j++)for(let i=0;i<C;i++)grid+=`M${i*cw} ${j*rh}${edge(i*cw,j*rh,cw,true,tab(i,j,true),false)}`;
 for(let i=1;i<C;i++)for(let j=0;j<R;j++)grid+=`M${i*cw} ${j*rh}${edge(i*cw,j*rh,rh,false,tab(i,j,false),false)}`;
 const pi=1,pj=1,x=pi*cw,y=pj*rh;
 const piece=`M${x} ${y}${edge(x,y,cw,true,tab(pi,pj,true),false)}${edge(x+cw,y,rh,false,tab(pi+1,pj,false),false)}${edge(x,y+rh,cw,true,tab(pi,pj+1,true),true)}${edge(x,y,rh,false,tab(pi,pj,false),true)}Z`;
 const defs=`<clipPath id="${id}-piece"><path d="${piece}"/></clipPath><filter id="${id}-lift" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="4" dy="9" stdDeviation="4" flood-opacity=".8"/></filter>`;
 return wrap(item,id,defs,`<path d="${grid}" fill="none" stroke="#000" stroke-width="1.4" opacity=".45"/><path d="${grid}" fill="none" stroke="#fff" stroke-width=".6" opacity=".35" transform="translate(.8 .8)"/><path d="${piece}" fill="#0b0a09"/><path d="${piece}" fill="none" stroke="#000" stroke-width="2" opacity=".6"/><g transform="translate(150 120) rotate(-8) scale(1.08) translate(-112.5 -120)"><g ${an('bob',3,0,'--dy:-5px;--dx:2px')}><g filter="url(#${id}-lift)"><g clip-path="url(#${id}-piece)">${art()}</g></g><path d="${piece}" fill="none" stroke="#f6efdc" stroke-width="1.4" opacity=".85"/></g></g>`);
}

function hologram(item,id){
 const defs=`${tone(`${id}-holo`,['0 .05 .4 .9','.05 .4 .85 1','.12 .6 .95 1'])}<pattern id="${id}-lines" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.6" fill="#000" opacity=".55"/></pattern>${linear(`${id}-cone`,['#5ff2ff00','#5ff2ff33'])}${radial(`${id}-emit`,['#e9ffffee','#5ff2ff88','#5ff2ff00'])}${foot(id,'#02121e',.7)}`;
 return wrap(item,id,defs,`<rect width="300" height="400" fill="#020a14" opacity=".55"/><g ${an('flicker',3.4,0,'--lo:.6')} style="mix-blend-mode:screen">${art(`filter="url(#${id}-holo)" opacity=".9"`)}<g ${an('jitter',1.7,0,'--dx:3px;--dy:0px')}>${art(`filter="url(#${id}-holo)" opacity=".18" transform="translate(-3 0)"`)}</g></g><g ${an('slide',1.2,0,'--dy:4px')}><rect y="-4" width="300" height="408" fill="url(#${id}-lines)"/></g><path d="M150 410L-30 0H330Z" fill="url(#${id}-cone)" style="mix-blend-mode:screen"/>${footRect(id)}<ellipse cx="150" cy="398" rx="90" ry="14" fill="url(#${id}-emit)" ${an('pulse',1.6,0,'--lo:.6')}/>`);
}

function energyShield(item,id){
 const hits=[[90,120],[220,210],[120,300],[210,80]];
 // The ripples are rings painted with the hex grid, so the field only lights where a ring passes.
 const defs=`<pattern id="${id}-hex" width="17.32" height="30" patternUnits="userSpaceOnUse"><path d="M8.66 0L17.32 5V15L8.66 20L0 15V5Z M8.66 20V30" fill="none" stroke="#7ff6ff" stroke-width=".9"/></pattern>${radial(`${id}-edge`,['#43f0ff00','#43f0ff00','#43f0ff55'],.5,.5,.7)}`;
 const rings=hits.map(([x,y],k)=>`<g transform="translate(${x} ${y})"><circle r="60" fill="none" stroke="url(#${id}-hex)" stroke-width="22" ${an('pop',3.2,k*.8,'--s0:.05;--s1:1.6')}/><circle r="8" fill="#e9ffff" style="mix-blend-mode:screen" ${an('pop',3.2,k*.8,'--s0:.3;--s1:1.6;--o:.9')}/></g>`).join('');
 return wrap(item,id,defs,`<rect width="300" height="400" fill="url(#${id}-edge)"/><rect width="300" height="400" fill="url(#${id}-hex)" opacity=".2"/>${rings}`);
}

function frozenAmber(item,id){
 const defs=`${tone(`${id}-amber`,['.12 .55 .95 1','.04 .26 .62 .9','0 .03 .16 .45'])}${linear(`${id}-gloss`,['#fff5','#fff0','#fff0','#fff2'],1,1)}${linear(`${id}-sheen`,['#ffe7a800','#ffe7a866','#ffe7a800'],1,0)}${foot(id,'#2a1000',.75)}`;
 const bubbles=Array.from({length:22},(_,k)=>{const r=f(.8+rnd(k)*3);return `<g transform="translate(${f(rnd(k+10)*300)} ${f(rnd(k+20)*330)})"><g ${an('bob',9+rnd(k+30)*8,rnd(k+40)*9,`--dy:${f(-4-rnd(k+50)*8)}px`)}><circle r="${r}" fill="#fff3d0" fill-opacity=".15" stroke="#fff3d0" stroke-opacity=".55" stroke-width=".4"/><circle cx="${f(-r*.35)}" cy="${f(-r*.35)}" r="${f(r*.3)}" fill="#fff" opacity=".7"/></g></g>`;}).join('');
 const mosquito=`<g transform="translate(232 112) rotate(-24)" opacity=".75"><ellipse rx="5" ry="1.3" fill="#3a1800"/><circle cx="5.6" r="1.1" fill="#3a1800"/><path d="M6.4 0H11" stroke="#3a1800" stroke-width=".35"/><path d="M-1 -.5L-6 -6M-1 .5L-6 6M1 -.6L3 -6.6M1 .6L3 6.6M0 -.5L-2 -7.5M0 .5L-2 7.5" stroke="#3a1800" stroke-width=".3"/><ellipse cx="-1" cy="-3" rx="4" ry="1.2" fill="#fff3d0" opacity=".35" transform="rotate(-30 -1 -3)"/></g>`;
 return wrap(item,id,defs,`${art(`filter="url(#${id}-amber)"`)}<rect width="300" height="400" fill="url(#${id}-gloss)"/>${bubbles}${mosquito}<g ${an('slide',11,0,'--dx:520px')}><rect x="-150" y="-40" width="110" height="480" fill="url(#${id}-sheen)" transform="skewX(-20)"/></g>${footRect(id)}`);
}

// Legendary

function kaleidoscope(item,id,e){
 // The player places the mirror's centre, its zoom, starting turn and strength (finish placement controls);
 // the art it mirrors drifts underneath, so different parts of the image come through.
 const s=normalizeSettings('finish-kaleidoscope',e.finishSettings?.kaleidoscope),cx=f(s.x*3),cy=f(s.y*4),half=22.5*Math.PI/180;
 // The wedge samples along whichever way from the centre has the most art, zoomed far enough that, drift and all,
 // it still reaches the farthest corner; otherwise the corners come out empty.
 const [ext,axis]=[[300-cx,0],[400-cy,90],[cx,180],[cy,270]].sort((a,b)=>b[0]-a[0])[0],reach=Math.max(...[[0,0],[300,0],[0,400],[300,400]].map(([x,y])=>Math.hypot(x-cx,y-cy)));
 const zoom=f(Math.max(1.2*s.size/100,(reach+40)/Math.max(ext,1))),R=f(reach+60),a=axis*Math.PI/180;
 const defs=`<clipPath id="${id}-wedge"><path d="M${cx} ${cy}L${f(cx+Math.cos(a-half)*R)} ${f(cy+Math.sin(a-half)*R)}L${f(cx+Math.cos(a+half)*R)} ${f(cy+Math.sin(a+half)*R)}Z"/></clipPath>${readable(id,.66,.86,.3)}${radial(`${id}-core`,['#fff8','#fff0'])}`;
 const slice=`<g ${an('wander',22,0,'--dx:34px;--dy:26px')}><g transform="translate(${cx} ${cy}) scale(${zoom}) translate(${-cx} ${-cy})">${art()}</g></g>`;
 const mirror=`rotate(${axis} ${cx} ${cy}) translate(0 ${f(2*cy)}) scale(1 -1) rotate(${-axis} ${cx} ${cy})`;
 const wedges=Array.from({length:8},(_,k)=>`<g transform="rotate(${k*45} ${cx} ${cy})"><g clip-path="url(#${id}-wedge)">${k%2?`<g transform="${mirror}">${slice}</g>`:slice}</g></g>`).join('');
 // It opens on the plain art, turns into the kaleidoscope and fades back again.
 return wrap(item,id,defs,`<g ${an('kaleido',20)}><g mask="url(#${id}-read)" opacity="${f(.92*s.opacity/100)}"><g transform="translate(${cx} ${cy}) rotate(${s.rotation})"><g ${an('spin',60)}><g transform="translate(${-cx} ${-cy})">${wedges}</g></g></g></g><circle cx="${cx}" cy="${cy}" r="30" fill="url(#${id}-core)"/></g>`);
}

function solarEclipse(item,id){
 const x=60,y=62,R=20,T=14;
 // One cycle: the moon slides over the sun, the sky darkens into totality with the corona out, and it slides off again.
 // The diamond ring flashes at the last light before totality (right limb) and the first light after it (left limb).
 // The whole eclipse drifts slowly back and forth across the top of the card on a longer cycle of its own.
 const drift=`${an('bob',30,0,'--dx:180px;--dy:14px')}`;
 const streamers=Array.from({length:22},(_,k)=>`<path d="M0 ${f(-R+2)}Q${f((rnd(k)-.5)*10)} ${f(-R-14-rnd(k+3)*20)} ${f((rnd(k+5)-.5)*7)} ${f(-R-24-rnd(k+7)*34)}" fill="none" stroke="#fff3c4" stroke-width="${f(.5+rnd(k+9)*1.1)}" stroke-linecap="round" opacity="${f(.3+rnd(k+11)*.4)}" transform="rotate(${f(k/22*360+rnd(k+13)*10)})"/>`).join('');
 const stars=Array.from({length:30},(_,k)=>`<circle cx="${f(rnd(k)*300)}" cy="${f(rnd(k+40)*230)}" r="${f(.4+rnd(k+80)*.8)}" fill="#fff" ${an('pulse',2+rnd(k+3)*2.5,rnd(k+6)*3,'--lo:.2')}/>`).join('');
 const ring=(dx,phase)=>`<g transform="translate(${dx} 0)"><g ${an('flash',T,(.9-phase)*T,'--o:1')}><circle r="6" fill="#fff" filter="url(#${id}-soft)"/><path d="M-18 0H18M0 -12V12" stroke="#fff" stroke-width=".8"/><circle r="2.2" fill="#fff"/></g></g>`;
 const defs=`<linearGradient id="${id}-dusk" x2="0" y2="1"><stop stop-color="#04061a" stop-opacity=".6"/><stop offset=".45" stop-color="#0b0f2a" stop-opacity=".34"/><stop offset=".8" stop-color="#0b0f2a" stop-opacity="0"/></linearGradient>${radial(`${id}-glare`,['#ffffff','#fff3c4aa','#ffd36b22','#ffd36b00'])}${radial(`${id}-corona`,['#ffffff','#fff3c4','#cfe0ff55','#cfe0ff00'],.5,.5,.5)}${blur(`${id}-soft`,2.4)}${radial(`${id}-disk`,['#ffffff','#fff8d8','#ffe7a0'])}`;
 const sky=`<g ${an('eclipse-dark',T)}><rect width="300" height="400" fill="url(#${id}-dusk)"/>${stars}</g>`;
 const corona=`<g ${an('eclipse-dark',T)} style="mix-blend-mode:screen"><circle r="56" fill="url(#${id}-corona)" opacity=".85"/><g ${an('spin',90)}>${streamers}</g></g>`;
 const sun=`<g opacity=".7"><g ${an('eclipse-glare',T)}><circle r="54" fill="url(#${id}-glare)"/><circle r="${R+6}" fill="#fff3c4" filter="url(#${id}-soft)"/></g></g><circle r="${R}" fill="url(#${id}-disk)"/>`;
 const moon=`<g ${an('eclipse-moon',T)}><circle r="${R+.5}" fill="#070914"/><circle r="${R+.5}" fill="none" stroke="#3a4060" stroke-width=".5"/></g>`;
 return wrap(item,id,defs,`${sky}<g transform="translate(${x} ${y})"><g ${drift}>${corona}${sun}${moon}${ring(R,.39)}${ring(-R,.61)}</g></g>`);
}

function magmaVeins(item,id){
 let s=0;const joints=[];
 const vein=(x,y,a,len,depth)=>{let d=`M${f(x)} ${f(y)}`,px=x,py=y;const out=[];for(let i=0;i<10;i++){a+=(rnd(++s)-.5)*.9;px+=Math.cos(a)*len/10;py+=Math.sin(a)*len/10;d+=`L${f(px)} ${f(py)}`;if(depth&&rnd(s+77)>.78){joints.push([px,py]);out.push(vein(px,py,a+(rnd(s+5)>.5?.9:-.9),len*.45,depth-1));}}return [d,...out].join('');};
 const veins=[[0,90,.3,180],[300,60,2.7,170],[150,0,1.6,160],[0,260,-.2,190],[300,300,3.3,160],[80,400,-1.4,150],[220,400,-1.9,140]].map(([x,y,a,l])=>vein(x,y,a,l,2)).join('');
 // Hairline cracks between the main veins: thin and dim, so the art still shows through the crust.
 const hairs=[[40,180,.8,90],[260,200,2.4,90],[150,120,1.2,70],[90,40,.5,80],[210,330,-2,80],[30,340,-.6,70]].map(([x,y,a,l])=>vein(x,y,a,l,1)).join('');
 const spots=joints.slice(0,12).map(([x,y],k)=>`<circle cx="${f(x)}" cy="${f(y)}" r="${f(3+rnd(k)*3)}" fill="url(#${id}-spot)" ${an('pulse',2+rnd(k+3)*2,rnd(k+5)*2,'--lo:.2')}/>`).join('');
 const embers=Array.from({length:22},(_,k)=>`<g transform="translate(${f(rnd(k)*300)} ${f(260+rnd(k+20)*150)})"><circle r="${f(.6+rnd(k+40)*1.2)}" fill="${k%3?'#ffb347':'#ff6a1f'}" ${an('move',3.5+rnd(k+60)*3,rnd(k+80)*6,`--dx:${f((rnd(k+100)-.5)*40)}px;--dy:${f(-120-rnd(k+120)*120)}px`)}/></g>`).join('');
 const defs=`${blur(`${id}-heat`,2.6)}${linear(`${id}-char`,['#2a0d0522','#1a080244','#2a0d0566'])}${linear(`${id}-glow`,['#ff6a1f00','#ff6a1f00','#ff3a0a40'])}${radial(`${id}-spot`,['#fff3a0','#ff8a1f88','#ff6a1f00'])}${readable(id,.64,.86,.45)}`;
 return wrap(item,id,defs,`<rect width="300" height="400" fill="url(#${id}-char)" style="mix-blend-mode:multiply"/><rect width="300" height="400" fill="url(#${id}-glow)"/><g mask="url(#${id}-read)" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${hairs}" stroke="#ff9a3d" stroke-width=".5" opacity=".55"/><path d="${veins}" stroke="#ff4a0a" stroke-width="3.6" filter="url(#${id}-heat)" ${an('pulse',3,0,'--lo:.25;--hi:.75')}/><path d="${veins}" stroke="#1a0802" stroke-width="2.4" opacity=".55"/><path d="${veins}" stroke="#ff8a1f" stroke-width="1.3"/><path d="${veins}" stroke="#fff3a0" stroke-width=".55" stroke-dasharray="8 60" ${an('dash',4,0,'--d:-136')}/>${spots}</g>${embers}`);
}

function paperCranes(item,id){
 const cols=['#ffb5c2','#9ad1ff','#ffe08a','#b8f2c8','#d9c2ff','#ff9a8a'];
 const crane=(c,k)=>`<g><path d="M-9 1L0 -1L10 -4L6 1L0 2Z" fill="${c}"/><path d="M10 -4L13 -8L12.4 -3.4Z" fill="${c}"/><path d="M-9 1L-14 -3L-6 0Z" fill="${c}"/><g ${an('flap',1+rnd(k)*.4,rnd(k+3),'--fy:-.5')}><path d="M-2 0L3 -14L5 -1Z" fill="${c}"/><path d="M-2 0L3 -14L1 -1Z" fill="#000" opacity=".15"/></g><g ${an('flap',1+rnd(k)*.4,rnd(k+3)+.1,'--fy:-.4')}><path d="M-1 1L-4 9L4 1Z" fill="${c}"/><path d="M-1 1L-4 9L1 1Z" fill="#fff" opacity=".25"/></g></g>`;
 // Each crane glides left to right along its own long, shallow curve, banking gently with it.
 const flock=Array.from({length:11},(_,k)=>{const y=f(50+rnd(k+10)*230),d=f((rnd(k+5)-.5)*50),t=f(16+rnd(k+30)*8),path=`M-50 ${y}C70 ${f(y-24+d)} 210 ${f(y+24+d)} 350 ${f(y+d*.6)}`;return `<g ${an('ride',t,rnd(k+40)*t,`offset-path:path('${path}');offset-rotate:auto`)}><g transform="scale(${f(1.3+rnd(k+20)*.9)})">${crane(cols[k%cols.length],k)}</g></g>`;}).join('');
 return wrap(item,id,readable(id,.68,.88,.45),`<g mask="url(#${id}-read)">${flock}</g>`);
}

function overture(item,id){
 // Each staff is a long wave that slides one wavelength per cycle, so it travels without a seam; its notes ride with it.
 const L=120,wav=(x,y0,amp)=>y0+amp*Math.sin(x/L*Math.PI*2);
 const staff=(y0,amp,dir,t,k)=>{const line=o=>{let d=`M-240 ${f(wav(-240,y0,amp)+o)}`;for(let x=-230;x<=540;x+=10)d+=`L${x} ${f(wav(x,y0,amp)+o)}`;return d;};
  const notes=Array.from({length:20},(_,i)=>{const x=-210+i*38+rnd(k*30+i)*10,o=[-6,-3,0,3,6][Math.floor(rnd(k*30+i+5)*5)],y=wav(x,y0,amp)+o,eighth=rnd(i+k)>.5;return `<g transform="translate(${f(x)} ${f(y)})"><ellipse rx="3.4" ry="2.4" fill="#ffd36b" transform="rotate(-22)"/><path d="M3 -.6V-15${eighth?'q5 3 4 9':''}" fill="none" stroke="#ffd36b" stroke-width=".9"/></g>`;}).join('');
  return `<g ${an('slide',t,0,`--dx:${dir*L}px`)}><path d="${line(0)}" fill="none" stroke="url(#${id}-ribbon)" stroke-width="18" opacity=".18"/><path d="${[-6,-3,0,3,6].map(line).join('')}" fill="none" stroke="#ffd36b" stroke-width="1.6" opacity=".3" filter="url(#${id}-glow)"/><path d="${[-6,-3,0,3,6].map(line).join('')}" fill="none" stroke="#ffe7a8" stroke-width=".6" opacity=".9"/><g filter="url(#${id}-glow)" opacity=".6">${notes}</g>${notes}</g>`;};
 const notes='♪♫♩♬';
 const floaters=Array.from({length:12},(_,k)=>`<g transform="translate(${f(rnd(k)*300)} ${f(150+rnd(k+10)*250)})"><text font-family="Georgia,serif" font-size="${f(8+rnd(k+20)*8)}" fill="#ffe7a8" ${an('move',6+rnd(k+30)*4,rnd(k+40)*10,`--dx:${f((rnd(k+50)-.5)*40)}px;--dy:-120px;--o:.8`)}>${notes[k%4]}</text></g>`).join('');
 const sparks=Array.from({length:14},(_,k)=>`<g transform="translate(${f(rnd(k+60)*300)} ${f([90,200,300][k%3]+(rnd(k+70)-.5)*30)})"><path d="M0 -3L.6 -.6 3 0 .6 .6 0 3 -.6 .6 -3 0 -.6 -.6Z" fill="#fff6d0" ${an('pulse',1.2+rnd(k+80),rnd(k+90)*2,'--lo:0')}/></g>`).join('');
 const defs=`${blur(`${id}-glow`,2)}${linear(`${id}-ribbon`,['#ffd36b00','#ffd36b','#ffd36b00'])}${readable(id,.66,.86,.4)}`;
 return wrap(item,id,defs,`<g mask="url(#${id}-read)">${staff(90,14,-1,7,0)}${staff(200,18,1,9,1)}${staff(300,12,-1,8,2)}${sparks}${floaters}</g>`);
}

function frostBloom(item,id){
 const T=24;let s=0;
 // Ice grows slowly and unevenly: every arm kinks as it goes and forks at random angles and lengths, so no two sprays
 // match. Arms set off at different moments, the whole card frosts over, holds, then melts and runs away.
 // Each arm is a feathery fern: a kinking stem with twigs off both sides that shorten towards its tip, and finer twigs
 // off those, all at slightly different angles.
 const arm=(x,y,a,len,depth)=>{const n=[3,4,6][depth];let d=`M${f(x)} ${f(y)}`,px=x,py=y,h=a;const twigs=[];
  for(let i=1;i<=n;i++){h+=(rnd(++s)-.5)*.35;px+=Math.cos(h)*len/n;py+=Math.sin(h)*len/n;d+=`L${f(px)} ${f(py)}`;
   if(depth>0)for(const side of [-1,1])if(rnd(++s)<(depth===2?.8:.5))twigs.push([px,py,h+side*(.8+rnd(++s)*.4),len*(depth===2?.42:.5)*(1-i/(n+1))*(.7+rnd(++s)*.6),depth-1]);}
  return d+twigs.map(t=>arm(...t)).join('');};
 const seeds=[];
 for(let k=0;k<14;k++){const t=.08+rnd(k+200)*.84,[x,y,a]=[[t*300,0,Math.PI/2],[300,t*400,Math.PI],[t*300,400,-Math.PI/2],[0,t*400,0]][k%4];seeds.push([x,y,a+(rnd(k+220)-.5)*1.2,70+rnd(k+240)*80]);}
 for(let k=0;k<4;k++){const x=50+rnd(k+300)*200,y=50+rnd(k+320)*260;for(let j=0;j<3;j++)seeds.push([x,y,(j/3+rnd(k*4+j+340)*.2)*Math.PI*2,30+rnd(k*4+j+360)*30]);}
 const arms=seeds.map(([x,y,a,l],k)=>`<path d="${arm(x,y,a,l,2)}" pathLength="1" fill="none" stroke="#eefaff" stroke-width="${f(.3+rnd(k+420)*.25)}" stroke-linecap="round" stroke-linejoin="round" ${an('frostgrow',T,T-rnd(k+400)*5)}/>`).join('');
 const flake=r=>`<g stroke="#f4fcff" stroke-width=".6" stroke-linecap="round">${[0,60,120].map(a=>`<path d="M${-r} 0H${r}M${f(r*.55)} 0l${f(r*.25)} ${f(-r*.22)}M${f(r*.55)} 0l${f(r*.25)} ${f(r*.22)}M${f(-r*.55)} 0l${f(-r*.25)} ${f(-r*.22)}M${f(-r*.55)} 0l${f(-r*.25)} ${f(r*.22)}" transform="rotate(${a})"/>`).join('')}</g>`;
 const flakes=Array.from({length:16},(_,k)=>`<g transform="translate(${f(20+rnd(k)*260)} ${f(20+rnd(k+9)*360)}) rotate(${f(rnd(k+4)*60)})">${flake(f(3+rnd(k+6)*4))}</g>`).join('');
 const glints=Array.from({length:20},(_,k)=>`<g transform="translate(${f(rnd(k+30)*300)} ${f(rnd(k+39)*400)})"><path d="M0 -3L.5 -.5 3 0 .5 .5 0 3 -.5 .5 -3 0 -.5 -.5Z" fill="#fff" ${an('pulse',1.6+rnd(k+3)*1.6,rnd(k+5)*3,'--lo:0')}/></g>`).join('');
 // Meltwater: drops gather and run down the card as the frost goes.
 const drips=Array.from({length:28},(_,k)=>`<g transform="translate(${f(8+rnd(k+60)*284)} ${f(rnd(k+70)*300)})"><g ${an('melt',T,T*(rnd(k+80)*.03),`--dy:${f(50+rnd(k+90)*70)}px;--o:.75`)}><path d="M0 -9V0" stroke="#dff4ff" stroke-width="${f(.6+rnd(k+95)*.6)}" stroke-linecap="round" opacity=".5"/><circle r="${f(1+rnd(k+97)*.8)}" fill="#eefaff"/></g></g>`).join('');
 const defs=`${radial(`${id}-haze`,['#dff4ff33','#dff4ff55','#dff4ffaa'],.5,.5,.75)}${blur(`${id}-glow`,1)}<filter id="${id}-rime" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .92 0 0 0 0 .97 0 0 0 0 1 0 0 0 1.6 -.9"/></filter>${readable(id,.6,.84,.4)}`;
 return wrap(item,id,defs,`<g mask="url(#${id}-read)"><g ${an('frostcover',T,0,'--o:1')}><rect width="300" height="400" fill="url(#${id}-haze)"/><rect width="300" height="400" filter="url(#${id}-rime)" opacity=".5"/>${flakes}${glints}</g><g filter="url(#${id}-glow)" opacity=".3">${arms}</g>${arms}${drips}</g>`);
}

function warpSpeed(item,id){
 const cx=150,cy=180,T=14;
 // The jump to lightspeed: still stars, then every star stretches into a streak flying outward, a flash, the blue
 // hyperspace tunnel, and back to stars. Everything shares one long cycle so each stage has room to breathe.
 const stars=Array.from({length:140},(_,k)=>{const r0=f(10+rnd(k+90)*150),wd=f(.7+rnd(k+360)*1.2);return `<g transform="rotate(${f(rnd(k)*360)}) translate(${r0} 0)"><rect y="${f(-wd/2)}" width="1" height="${wd}" fill="${k%5?'#eef6ff':'#9fc4ff'}" ${an('jump',T,0,`--far:${f(30+rnd(k+180)*120)}px;--long:${f(70+rnd(k+270)*170)}`)}/></g>`;}).join('');
 // The tunnel: soft walls of light turning round the vanishing point, with a few bold streaks rushing past.
 const walls=Array.from({length:9},(_,k)=>{const a=k/9*Math.PI*2,da=.13+rnd(k+600)*.1;return `<path d="M0 0L${f(Math.cos(a-da)*280)} ${f(Math.sin(a-da)*280)}L${f(Math.cos(a+da)*280)} ${f(Math.sin(a+da)*280)}Z" fill="url(#${id}-wall)" opacity="${f(.35+rnd(k+610)*.3)}"/>`;}).join('');
 const streaks=Array.from({length:26},(_,k)=>{const t=f(.45+rnd(k+500)*.4);return `<g transform="rotate(${f(rnd(k+400)*360)})"><path d="M${f(20+rnd(k+450)*40)} 0h${f(40+rnd(k+470)*60)}" stroke="${k%3?'#dfeaff':'#8fb0ff'}" stroke-width="${f(1.4+rnd(k+490)*2.2)}" stroke-linecap="round" ${an('move',t,rnd(k+510)*t,'--dx:280px;--o:.9')}/></g>`;}).join('');
 const defs=`${radial(`${id}-tunnel`,['#e9f2ff','#3a5aff88','#0b1a6acc','#020615ee'],.5,.45,.75)}${radial(`${id}-core`,['#ffffffdd','#9fc4ff66','#3a5aff00'])}<radialGradient id="${id}-wall" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="260">${stops(["#ffffff00","#cfdcffaa","#7a9cff77","#3a5aff22"])}</radialGradient>${blur(`${id}-wallblur`,7)}${readable(id,.7,.9,.45)}`;
 return wrap(item,id,defs,`<g mask="url(#${id}-read)"><g transform="translate(${cx} ${cy})" style="mix-blend-mode:screen">${stars}</g><g ${an('jumptunnel',T)}><rect width="300" height="400" fill="url(#${id}-tunnel)"/><g transform="translate(${cx} ${cy})" style="mix-blend-mode:screen"><g filter="url(#${id}-wallblur)"><g ${an('spin',5)}>${walls}</g></g><circle r="40" fill="none" stroke="#bcd0ff" stroke-width="2" ${an('pop',1.6,0,'--s0:.2;--s1:6;--o:.45')}/>${streaks}<circle r="30" fill="url(#${id}-core)"/></g></g></g><rect width="300" height="400" fill="#eef6ff" ${an('jumpflash',T,0,'--o:.85')}/>`);
}

function powerSurge(item,id){
 // Powering up: the hero's own light lifts off the art as gold fire, rising and thinning, with lighter flames licking
 // up round them, arcs crackling on the aura, rubble lifting off the ground and the card shaking.
 const lift=[0,1,2,3].map(k=>`<g ${an('move',2.4,k*.6,'--dy:-50px;--o:.42')}>${art(`filter="url(#${id}-fire)"`)}</g>`).join('');
 const flames=Array.from({length:22},(_,k)=>{const side=k%2?1:-1,x=150+side*(14+rnd(k)*62),y=250+rnd(k+5)*120,h=f(26+rnd(k+9)*40),wd=f(5+rnd(k+11)*7);return `<g transform="translate(${f(x)} ${f(y)})"><path d="M0 0C${-wd} ${f(-h*.35)} ${f(-wd*.3)} ${f(-h*.7)} 0 ${-h}C${f(wd*.3)} ${f(-h*.7)} ${wd} ${f(-h*.35)} 0 0Z" fill="url(#${id}-flame)" filter="url(#${id}-soft)" ${an('move',.8+rnd(k+13)*.7,rnd(k+17)*1.5,`--dx:${f(-side*(4+rnd(k+19)*8))}px;--dy:${f(-80-rnd(k+21)*80)}px;--o:.45`)}/></g>`;}).join('');
 const on=(a)=>[150+Math.cos(a)*112,200+Math.sin(a)*160];
 const bolt=k=>{const a=rnd(k)*Math.PI*2,[x1,y1]=on(a),[x2,y2]=on(a+.35+rnd(k+3)*.4);let d=`M${f(x1)} ${f(y1)}`;for(let i=1;i<=6;i++){const t=i/6;d+=`L${f(x1+(x2-x1)*t+(rnd(k*9+i)-.5)*16)} ${f(y1+(y2-y1)*t+(rnd(k*9+i+4)-.5)*16)}`;}return `<path d="${d}" fill="none" stroke="#fff6c0" stroke-width="1.4" stroke-linejoin="round" filter="url(#${id}-glow)" ${an('zap',1.1+rnd(k+5)*1.2,rnd(k+7)*2)}/>`;};
 const rocks=Array.from({length:12},(_,k)=>{const r=1.6+rnd(k+3)*2.6;return `<g transform="translate(${f(30+rnd(k)*240)} ${f(380+rnd(k+5)*20)})"><path d="M${f(-r)} 0L${f(-r*.3)} ${f(-r)}L${f(r)} ${f(-r*.4)}L${f(r*.6)} ${f(r*.8)}L${f(-r*.5)} ${f(r*.7)}Z" fill="#4a3a2a" stroke="#ffcf4a" stroke-width=".4" ${an('move',4+rnd(k+7)*3,rnd(k+9)*6,`--dx:${f((rnd(k+11)-.5)*20)}px;--dy:${f(-120-rnd(k+13)*120)}px`)}/></g>`;}).join('');
 const streaks=Array.from({length:18},(_,k)=>`<rect x="${f(rnd(k+30)*300)}" y="${f(380+rnd(k+31)*60)}" width="1" height="${f(18+rnd(k+32)*30)}" fill="#fff6c0" ${an('move',.5+rnd(k+33)*.4,rnd(k+34),'--dy:-460px;--o:.45')}/>`).join('');
 // The art's brightest parts, warped by noise and turned to gold fire with everything dark left transparent.
 const fire=`<filter id="${id}-fire" x="-10%" y="-20%" width="120%" height="140%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".02 .07" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G"/>${GREY}<feComponentTransfer><feFuncR type="table" tableValues="0 1 1"/><feFuncG type="table" tableValues="0 .55 1"/><feFuncB type="table" tableValues="0 .05 .5"/></feComponentTransfer><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 1.7 0 0 -.55"/><feGaussianBlur stdDeviation="2.4"/></filter>`;
 const defs=`<linearGradient id="${id}-flame" x2="0" y2="1"><stop stop-color="#fffbe0"/><stop offset=".45" stop-color="#ffcf4a"/><stop offset="1" stop-color="#ff8a1f" stop-opacity="0"/></linearGradient><radialGradient id="${id}-aura" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#ffd34d" stop-opacity="0"/><stop offset=".8" stop-color="#ffd34d" stop-opacity=".3"/><stop offset="1" stop-color="#ffd34d" stop-opacity="0"/></radialGradient>${fire}${blur(`${id}-glow`,1.4)}${blur(`${id}-soft`,1.2)}${readable(id,.66,.88,.45)}`;
 return wrap(item,id,defs,`<rect width="300" height="400" fill="#ffcf4a" ${an('pulse',.8,0,'--lo:.04;--hi:.12;mix-blend-mode:overlay')}/><g ${an('jitter',.14,0,'--dx:1.2px;--dy:-1px')}><g mask="url(#${id}-read)"><ellipse cx="150" cy="200" rx="130" ry="185" fill="url(#${id}-aura)" ${an('pulse',.6,0,'--lo:.5;mix-blend-mode:screen')}/><g style="mix-blend-mode:screen">${lift}${streaks}${flames}</g>${Array.from({length:7},(_,k)=>bolt(k)).join('')}</g>${rocks}</g><rect width="300" height="400" fill="#fff" ${an('flash',3,0,'--o:.14')}/>`);
}

function meteorShower(item,id){
 // Meteors streak in from the top right on long fiery tails and burn out over the art.
 const meteor=(k,s,t)=>`<g transform="translate(${f(80+rnd(k)*300)} ${f(-30-rnd(k+5)*60)}) rotate(124) scale(${s})"><g ${an('move',t,rnd(k+17)*t*1.6,'--dx:640px;--dy:0px;--o:1')}><path d="M2 -3.4L-120 0L2 3.4Z" fill="url(#${id}-tail)"/><path d="M2 -1.4L-64 0L2 1.4Z" fill="#fff6d0" opacity=".8"/>${[0,1,2].map(i=>`<circle cx="${-14-i*12}" cy="${f((rnd(k*5+i)-.5)*6)}" r=".9" fill="#ffd166" ${an('blink',.2+i*.07,i*.05,'--lo:0')}/>`).join('')}<circle r="5" fill="#ffb347" filter="url(#${id}-glow)"/><circle r="2.6" fill="#fff"/></g></g>`;
 const meteors=Array.from({length:12},(_,k)=>meteor(k,f(.6+rnd(k+9)*.8),f(2.4+rnd(k+13)*2.2))).join('')+meteor(40,1.7,5.4);
 const stars=Array.from({length:26},(_,k)=>`<circle cx="${f(rnd(k)*300)}" cy="${f(rnd(k+40)*170)}" r="${f(.4+rnd(k+80)*.7)}" fill="#fff" ${an('pulse',2+rnd(k+3)*2.5,rnd(k+6)*3,'--lo:.15')}/>`).join('');
 const defs=`<linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="#0b0a20" stop-opacity=".7"/><stop offset=".55" stop-color="#0b0a20" stop-opacity="0"/></linearGradient>${linear(`${id}-tail`,['#ff6a1f00','#ff8a1f99','#ffe7a8'],1,0)}${blur(`${id}-glow`,2.4)}${readable(id,.66,.88,.4)}`;
 return wrap(item,id,defs,`<rect width="300" height="400" fill="url(#${id}-sky)"/>${stars}<g mask="url(#${id}-read)" style="mix-blend-mode:screen">${meteors}</g>`);
}

function blackHole(item,id){
 const x=164,y=92,R=21;
 // The art round the hole is dragged into a whirlpool: bands of the image turn faster the nearer they are, under a
 // fade so the outermost band melts into the still art.
 const bands=[[96,46],[72,24],[52,12],[38,6]];
 const swirl=bands.map(([r,t],k)=>`<g clip-path="url(#${id}-band${k})"><g transform="translate(${x} ${y})"><g ${an('spin',t)}><g transform="translate(${-x} ${-y})">${art()}</g></g></g></g>`).join('');
 // The accretion disk, tilted nearly edge-on: its far half passes behind the hole, its near half in front.
 const arcs=Array.from({length:40},(_,k)=>{const r=f(30+rnd(k)*46),sweep=(18+rnd(k+9)*60)*Math.PI/180;return `<path d="M${r} 0A${r} ${r} 0 0 1 ${f(r*Math.cos(sweep))} ${f(r*Math.sin(sweep))}" transform="rotate(${f(rnd(k+5)*360)})" stroke="${k%3?'#ffd9a0':'#fff6e0'}" stroke-width="${f(.8+rnd(k+11)*1.8)}" fill="none" stroke-linecap="round" opacity="${f(.35+rnd(k+13)*.5)}"/>`;}).join('');
 const disk=half=>`<g transform="translate(${x} ${y}) rotate(-10) scale(1 .24)"><g clip-path="url(#${id}-${half})"><circle r="82" fill="url(#${id}-disk)"/><g ${an('spin',6)}>${arcs}</g></g></g>`;
 // Light from the far side of the disk is bent up over the top of the hole and under its bottom.
 const lens=`<g transform="translate(${x} ${y}) rotate(-10)"><ellipse rx="${R+8}" ry="${R+6}" fill="none" stroke="url(#${id}-lens)" stroke-width="6" filter="url(#${id}-glow)" ${an('pulse',2.4,0,'--lo:.6')}/><ellipse rx="${R+7}" ry="${R+5}" fill="none" stroke="url(#${id}-lens)" stroke-width="1.6"/></g>`;
 const spiral=a0=>{let d='';for(let i=0;i<=60;i++){const t=i/60,r=150*(1-t)+(R-4)*t,a=a0+t*Math.PI*4.4;d+=`${i?'L':'M'}${f(x+Math.cos(a)*r)} ${f(y+Math.sin(a)*r*.5)}`;}return d;};
 const motes=Array.from({length:16},(_,k)=>{const t=f(3+rnd(k+20)*2.5);return `<g ${an('ride',t,rnd(k+30)*t,`offset-path:path('${spiral(rnd(k+40)*Math.PI*2)}');offset-rotate:0deg`)}><circle r="${f(.8+rnd(k+50)*1)}" fill="#ffe7c0"/></g>`;}).join('');
 const defs=`${bands.map(([r],k)=>`<clipPath id="${id}-band${k}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath>`).join('')}<clipPath id="${id}-back"><rect x="-100" y="-100" width="200" height="100"/></clipPath><clipPath id="${id}-front"><rect x="-100" y="0" width="200" height="100"/></clipPath>${radial(`${id}-fade`,['#fff','#fff','#000'],.5,.5,.5)}<mask id="${id}-pull" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="400"><circle cx="${x}" cy="${y}" r="96" fill="url(#${id}-fade)"/></mask><radialGradient id="${id}-dark" gradientUnits="userSpaceOnUse" cx="${x}" cy="${y}" r="130">${stops(['#000000cc','#00000066','#00000000'])}</radialGradient><radialGradient id="${id}-disk" r=".5">${stops(['#ffffff00','#ffffff00','#fff6e0','#ffb347cc','#ff6a1f55','#ff6a1f00'])}</radialGradient>${linear(`${id}-lens`,['#fff3d0','#ffb347','#ff6a1f66'])}${blur(`${id}-glow`,2.2)}${readable(id,.66,.88,.45)}`;
 return wrap(item,id,defs,`<g mask="url(#${id}-read)"><g mask="url(#${id}-pull)">${swirl}</g><rect width="300" height="400" fill="url(#${id}-dark)"/>${disk('back')}${lens}${motes}<circle cx="${x}" cy="${y}" r="${R}" fill="#000"/><circle cx="${x}" cy="${y}" r="${R+1.2}" fill="none" stroke="#fff3d0" stroke-width="1" filter="url(#${id}-glow)"/><circle cx="${x}" cy="${y}" r="${R+.6}" fill="none" stroke="#fff6e0" stroke-width=".5"/>${disk('front')}</g>`);
}

export const WAVE2_FINISHES={duotone,'sepia-photo':sepiaPhoto,'night-vision':nightVision,'x-ray':xRay,watercolour,'dandelion-seeds':dandelionSeeds,'soap-bubbles':soapBubbles,'low-poly':lowPoly,anaglyph,petrified,
 'pop-art':popArt,'neon-outline':neonOutline,'code-rain':codeRain,spotlight,'speed-lines':speedLines,'magnifying-glass':magnifyingGlass,jigsaw,hologram,'energy-shield':energyShield,'frozen-amber':frozenAmber,'paper-cranes':paperCranes,overture,
 kaleidoscope,'solar-eclipse':solarEclipse,'magma-veins':magmaVeins,'frost-bloom':frostBloom,'warp-speed':warpSpeed,'power-surge':powerSurge,'meteor-shower':meteorShower,'black-hole':blackHole};
