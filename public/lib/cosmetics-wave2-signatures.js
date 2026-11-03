// Signatures for the October 30 wave. Same frame as the October 20 wave: a 300-wide strip, viewBox 0 185 300 110,
// the name centred near y 255. Long names shrink to fit. Motion comes from cosmetics-wave2.css at a fixed pace.
import {wrap as frame,sizeFor,escape} from './cosmetics-wave-signatures.js';
import {an} from './cosmetics-wave2-borders.js';
const rnd=n=>{const v=Math.sin(n*12.9898+78.233)*43758.5453;return v-Math.floor(v);};
const f=v=>Number(v.toFixed(2));
const wrap=(item,id,glow,defs,body)=>frame(item,id,glow,defs,`<g class="w2s">${body}</g>`);
const stops=colors=>colors.map((c,i)=>`<stop offset="${f(i/(colors.length-1))}" stop-color="${c}"/>`).join('');
const linear=(id,colors,x2=0,y2=1)=>`<linearGradient id="${id}" x2="${x2}" y2="${y2}">${stops(colors)}</linearGradient>`;
const radial=(id,colors,cx=.5,cy=.5)=>`<radialGradient id="${id}" cx="${cx}" cy="${cy}">${stops(colors)}</radialGradient>`;
const blur=(id,d)=>`<filter id="${id}" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="${d}"/></filter>`;
// A name set in one line: its font size, width and the text element maker.
const line=(text,advance,size,max=230)=>{const n=Math.max(1,[...text].length),s=sizeFor(n,advance,size,max),w=Math.min(max,n*s*advance),fit=n*s*advance>max?` textLength="${max}" lengthAdjust="spacingAndGlyphs"`:'';
 return {s,w,t:(attrs,x=150,y=258)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${f(s)}"${fit} ${attrs}>${escape(text)}</text>`};};
const star=(x,y,r,fill,extra='')=>`<path d="M${x} ${f(y-r)}L${f(x+r*.29)} ${f(y-r*.4)} ${f(x+r*.95)} ${f(y-r*.31)} ${f(x+r*.47)} ${f(y+r*.15)} ${f(x+r*.59)} ${f(y+r*.81)} ${x} ${f(y+r*.5)} ${f(x-r*.59)} ${f(y+r*.81)} ${f(x-r*.47)} ${f(y+r*.15)} ${f(x-r*.95)} ${f(y-r*.31)} ${f(x-r*.29)} ${f(y-r*.4)}Z" fill="${fill}" ${extra}/>`;
// Letters that take turns without per-letter delays: a stroke that stays blank until ti, draws over dt, then holds
// to the end of the cycle. L is a generous guess at the outline length. See .w2.scribe.
const scribe=(T,ti,dt,L)=>{const v=L/dt,G=f(L+v*T),P=2*G;return `stroke-dasharray="0 ${G} ${G} 0" ${an('scribe',T,0,`--a:${f(P+v*ti)};--b:${f(P+v*(ti-T))}`)}`;};

// Rare

function chalkHand(item,id,text){
 const {w,t}=line(text,.48,54);
 const defs=`<filter id="${id}-chalk" x="-10%" y="-30%" width="120%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.4 1.75" result="holes"/><feComposite in="SourceGraphic" in2="holes" operator="in"/></filter>`;
 const dust=Array.from({length:10},(_,k)=>`<g transform="translate(${f(150-w/2+rnd(k)*w)} 268)"><circle r="${f(.4+rnd(k+5)*.6)}" fill="#f1f4ee" ${an('move',3+rnd(k+9)*2,rnd(k+3)*5,`--dx:${f((rnd(k+7)-.5)*6)}px;--dy:14px;--o:.7`)}/></g>`).join('');
 return wrap(item,id,'#f1f4ee33',defs,`<g filter="url(#${id}-chalk)">${t('font-family="RoundCaveat,cursive" fill="#f1f4ee"')}<path d="M${f(150-w/2)} 268Q150 262 ${f(150+w/2+6)} 266" fill="none" stroke="#f1f4ee" stroke-width="2.2" stroke-linecap="round"/></g>${dust}`);
}

function rubberStamp(item,id,text){
 const {s,w,t}=line(text.toUpperCase(),.62,30,190),bw=w+28,bh=s+20;
 const defs=`<filter id="${id}-worn" x="-10%" y="-20%" width="120%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="13" result="n"/><feColorMatrix in="n" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.5 1.65" result="holes"/><feComposite in="SourceGraphic" in2="holes" operator="in"/></filter>`;
 return wrap(item,id,'#d6283933',defs,`<g transform="rotate(-6 150 250)"><g transform="translate(150 250)"><g ${an('thump',4,0,'--o:.92')}><g transform="translate(-150 -250)" filter="url(#${id}-worn)"><rect x="${f(150-bw/2)}" y="${f(250-bh/2)}" width="${f(bw)}" height="${f(bh)}" rx="3" fill="none" stroke="#d62839" stroke-width="3"/><rect x="${f(150-bw/2+4)}" y="${f(250-bh/2+4)}" width="${f(bw-8)}" height="${f(bh-8)}" rx="1.5" fill="none" stroke="#d62839" stroke-width="1"/>${t('font-family="RoundStencil,Impact,sans-serif" fill="#d62839" stroke="#d62839" stroke-width="1.2" letter-spacing="1.5"',150,f(250+s*.36))}</g></g></g></g>`);
}

function labelMaker(item,id,text){
 // Sized for monospace capitals plus the 2px letter spacing, so long names get smaller type rather than squashed letters.
 const label=escape(text.toUpperCase()),n=Math.max(1,[...text].length),s=f(Math.max(9,Math.min(20,(222/n-2)/.6))),w=f(n*(s*.6+2)),tw=w+24,y=250,h=f(s*.4+5);
 const tape=`M${f(150-tw/2)} ${f(y-h)}H${f(150+tw/2)}L${f(150+tw/2-4)} ${y}L${f(150+tw/2)} ${f(y+h)}H${f(150-tw/2)}L${f(150-tw/2+4)} ${y}Z`;
 const glyphs=(fill,dx,dy,extra='')=>`<text x="${f(150+dx)}" y="${f(y+s*.36+dy)}" text-anchor="middle" font-size="${s}" textLength="${w}" lengthAdjust="spacing" font-family="RoundMono,monospace" font-weight="700" fill="${fill}" ${extra}>${label}</text>`;
 return wrap(item,id,'#0000',linear(`${id}-tape`,['#2a2a2e','#111114','#202024']),`<g transform="rotate(-2 150 250)"><path d="${tape}" fill="#000" opacity=".4" transform="translate(1.2 2)"/><path d="${tape}" fill="url(#${id}-tape)"/><path d="M${f(150-tw/2+3)} ${f(y-h+1.4)}H${f(150+tw/2-3)}" stroke="#fff" stroke-opacity=".12" stroke-width="1"/>${glyphs('#000',.6,.8,'opacity=".8"')}${glyphs('#f6f6f6',0,0)}</g>`);
}

function highlighter(item,id,text){
 const {s,w,t}=line(text,.46,48),x0=150-w/2-8,len=w+16,top=258-s*.86,bot=258+s*.3;
 // The swipe spans the tallest capitals down to the deepest tails, with a chisel-tip slant at each end.
 return wrap(item,id,'#fff36b33','',`<g transform="translate(${f(x0)} 0)"><g ${an('swipe',6)}><path d="M0 ${f(top+3)}L${f(len)} ${f(top)}L${f(len+4)} ${f(bot-2)}L-3 ${f(bot)}Z" fill="#fff36b" opacity=".85"/><path d="M0 ${f(top+3)}L${f(len)} ${f(top)}" stroke="#fffbb0" stroke-width="1.2" opacity=".6"/></g></g>${t('font-family="RoundCaveat,cursive" fill="#1b1b2f"')}`);
}

const TILE_POINTS={A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10};
function letterTiles(item,id,text){
 const chars=[...text.toUpperCase()].slice(0,16),cell=Math.min(26,236/chars.length),x0=150-chars.length*cell/2,size=cell*.86;
 const tiles=chars.map((c,i)=>{if(c===' ')return '';const x=x0+i*cell+cell*.06,y=250-size/2+(rnd(i)-.5)*2;return `<g transform="rotate(${f((rnd(i+3)-.5)*4)} ${f(x+size/2)} ${f(y+size/2)})"><rect x="${f(x)}" y="${f(y+1.2)}" width="${f(size)}" height="${f(size)}" rx="${f(size*.12)}" fill="#8a6a38"/><rect x="${f(x)}" y="${f(y)}" width="${f(size)}" height="${f(size)}" rx="${f(size*.12)}" fill="url(#${id}-wood)" stroke="#c9a46a" stroke-width=".5"/><text x="${f(x+size*.46)}" y="${f(y+size*.74)}" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="${f(size*.62)}" fill="#3a2a12">${escape(c)}</text><text x="${f(x+size*.86)}" y="${f(y+size*.9)}" text-anchor="end" font-family="Georgia,serif" font-size="${f(size*.24)}" fill="#3a2a12">${TILE_POINTS[c]??0}</text></g>`;}).join('');
 const rack=`<path d="M${f(x0-8)} ${f(250+size/2+2)}H${f(x0+chars.length*cell+8)}L${f(x0+chars.length*cell+4)} ${f(250+size/2+9)}H${f(x0-4)}Z" fill="#7a4a20" stroke="#4a2a10" stroke-width=".6"/>`;
 return wrap(item,id,'#f1d9a633',linear(`${id}-wood`,['#f7e6be','#e7c88a','#d9b77a'],1,1),`${tiles}${rack}`);
}

function ballpoint(item,id,text){
 const {s,w,t}=line(text,.44,50),len=Math.round([...text].length*s*2.6+40);
 const und=`M${f(150-w/2)} 266C${f(150-w/6)} 270 ${f(150+w/4)} 262 ${f(150+w/2+8)} 265M${f(150-w/2+10)} 271C${f(150)} 274 ${f(150+w/3)} 268 ${f(150+w/2)} 270`;
 return wrap(item,id,'#5a7bff33','',`${t(`font-family="RoundAllura,cursive" fill="#9db4ff" stroke="#9db4ff" stroke-width="1.1" ${an('write',7,0,`--len:${len}`)}`)}<path d="${und}" pathLength="1" fill="none" stroke="#9db4ff" stroke-width="1.2" stroke-linecap="round" ${an('draw',7,-2.8)}/>${star(f(150+w/2+14),236,6,'none',`stroke="#9db4ff" stroke-width=".9" stroke-linejoin="round" pathLength="1" ${an('draw',7,-3.4)}`)}`);
}

function stickyNote(item,id,text){
 const {s,w,t}=line(text,.56,34,200),nw=Math.max(110,w+30),nh=70,x=150-nw/2,y=214;
 const note=`M${f(x)} ${y}H${f(x+nw)}V${y+nh-12}L${f(x+nw-14)} ${y+nh}H${f(x)}Z`;
 return wrap(item,id,'#0000',linear(`${id}-paper`,['#fff3a0','#ffe66d','#f5d84a']),`<g transform="rotate(-3 150 250)"><path d="${note}" fill="#000" opacity=".35" transform="translate(2 3)"/><path d="${note}" fill="url(#${id}-paper)"/><path d="M${f(x+nw)} ${y+nh-12}L${f(x+nw-14)} ${y+nh}L${f(x+nw-12)} ${y+nh-10}Z" fill="#d9b93a"/><rect x="${f(150-18)}" y="${y-5}" width="36" height="10" fill="#fff" opacity=".35" transform="rotate(4 150 ${y})"/>${t('font-family="RoundMarker,sans-serif" fill="#222"',150,f(y+nh/2+s*.34))}</g>`);
}

function pipedIcing(item,id,text){
 const {w,t}=line(text,.5,50),colors=['#ff4d6d','#ffd23f','#3ddc97','#4cc9f0','#b388ff'];
 const sprinkles=Array.from({length:22},(_,k)=>`<rect x="-1.6" y="-.45" width="3.2" height=".9" rx=".45" fill="${colors[k%5]}" transform="translate(${f(150-w/2-14+rnd(k)*(w+28))} ${f(222+rnd(k+9)*58)}) rotate(${f(rnd(k+3)*180)})"/>`).join('');
 const dots=Array.from({length:Math.max(3,Math.floor((w+20)/8))},(_,k)=>`<circle cx="${f(150-w/2-10+k*8)}" cy="276" r="2.6" fill="#ff8fc8" stroke="#e86aa8" stroke-width=".6"/><circle cx="${f(150-w/2-10.8+k*8)}" cy="275.2" r=".8" fill="#fff" opacity=".8"/>`).join('');
 return wrap(item,id,'#ff8fc844','',`${sprinkles}${t('font-family="RoundDafoe,cursive" fill="#ffd1e8" stroke="#e86aa8" stroke-width="5" stroke-linejoin="round" paint-order="stroke"')}${t('font-family="RoundDafoe,cursive" fill="none" stroke="#fff" stroke-width=".8" opacity=".7"',149.2,257.2)}${dots}`);
}

function licensePlate(item,id,text,opts={}){
 // The top band is the owner's own text (equipment.plateText), or the league's name.
 const top=escape(String(opts.plate||'AD2L · SCRIM LEAGUE').toUpperCase().slice(0,20)),{s,t}=line(text.toUpperCase(),.64,26,180),pw=220,ph=62,x=150-pw/2,y=219;
 const bolt=(bx,by)=>`<circle cx="${bx}" cy="${by}" r="2.6" fill="url(#${id}-bolt)" stroke="#555" stroke-width=".3"/><path d="M${bx-1.4} ${by-.4}L${bx+1.4} ${by+.4}" stroke="#555" stroke-width=".5"/>`;
 const defs=`${linear(`${id}-plate`,['#ffffff','#e9e9e2'])}${linear(`${id}-chrome`,['#f4f6f8','#8b939e','#e7eaee','#5b6370'])}${linear(`${id}-sheen`,['#fff0','#fffb','#fff0'],1,0)}<radialGradient id="${id}-bolt" cx=".35" cy=".35"><stop stop-color="#fff"/><stop offset="1" stop-color="#8a8a8a"/></radialGradient><clipPath id="${id}-face"><rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="6"/></clipPath>`;
 const emboss=`${t('font-family="RoundMono,monospace" font-weight="700" fill="#000" opacity=".35" letter-spacing="1"',151,f(y+41.2+s*.32))}${t('font-family="RoundMono,monospace" font-weight="700" fill="#0b1a44" letter-spacing="1"',150,f(y+40+s*.32))}${t('font-family="RoundMono,monospace" font-weight="700" fill="none" stroke="#7a8cc8" stroke-width=".5" letter-spacing="1"',149.5,f(y+39.4+s*.32))}`;
 return wrap(item,id,'#0000',defs,`<rect x="${x-3.5}" y="${y-3.5}" width="${pw+7}" height="${ph+7}" rx="8" fill="#000" opacity=".4" transform="translate(1.5 2.5)"/><rect x="${x-3.5}" y="${y-3.5}" width="${pw+7}" height="${ph+7}" rx="8" fill="url(#${id}-chrome)"/><rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="6" fill="url(#${id}-plate)" stroke="#1d3a8a" stroke-width="2"/><rect x="${x+3}" y="${y+3}" width="${pw-6}" height="11" rx="3" fill="#1d3a8a"/><text x="150" y="${y+11.6}" text-anchor="middle" font-family="RoundStencil,Impact,sans-serif" font-size="8.4" fill="#fff" letter-spacing="2">${top}</text>${emboss}<rect x="${x+pw-32}" y="${y+ph-18}" width="24" height="13" rx="2" fill="#3ddc97"/><text x="${x+pw-20}" y="${y+ph-8.6}" text-anchor="middle" font-family="RoundMono,monospace" font-size="8" font-weight="700" fill="#0b2a1a">26</text><text x="${x+22}" y="${y+ph-5.6}" font-family="RoundMono,monospace" font-size="5" fill="#1d3a8a">OCT · SCRIMS</text>${bolt(x+14,y+8)}${bolt(x+pw-14,y+8)}${bolt(x+14,y+ph-8)}${bolt(x+pw-14,y+ph-8)}<g clip-path="url(#${id}-face)"><g ${an('slide',4.5,0,`--dx:${pw+80}px`)}><rect x="${x-60}" y="${y-10}" width="34" height="${ph+20}" fill="url(#${id}-sheen)" transform="skewX(-24)" opacity=".7"/></g></g>`);
}

function fridgeMagnets(item,id,text){
 const chars=[...text].slice(0,16),cell=Math.min(30,236/chars.length),x0=150-chars.length*cell/2,size=cell*1.15,cols=['#ff4d6d','#3ddc97','#ffd23f','#4cc9f0','#b388ff','#ff9f1c'];
 const letters=chars.map((c,i)=>{const x=x0+(i+.5)*cell,col=cols[i%cols.length];return `<g transform="translate(${f(x)} 262) rotate(${f((rnd(i)-.5)*16)})"><g ${an('bob',1.6+rnd(i+3)*.8,rnd(i+5)*1.6,'--dy:-2px')}><text text-anchor="middle" font-family="RoundMarker,Impact,sans-serif" font-size="${f(size)}" fill="#000" opacity=".4" transform="translate(1.5 2)">${escape(c)}</text><text text-anchor="middle" font-family="RoundMarker,Impact,sans-serif" font-size="${f(size)}" fill="${col}" stroke="#0003" stroke-width="1">${escape(c)}</text><text text-anchor="middle" font-family="RoundMarker,Impact,sans-serif" font-size="${f(size)}" fill="#fff" opacity=".25" transform="translate(-.8 -1)">${escape(c)}</text></g></g>`;}).join('');
 return wrap(item,id,'#0000','',letters);
}

function helloBadge(item,id,text){
 const {s,w,t}=line(text,.56,28,200),bw=Math.max(150,w+36),bh=74,x=150-bw/2,y=213;
 // The red conference sticker, a little crooked, with its bottom corner starting to peel.
 return wrap(item,id,'#0000','',`<g transform="rotate(-4 150 250)"><rect x="${f(x+1.5)}" y="${y+2.5}" width="${f(bw)}" height="${bh}" rx="8" fill="#000" opacity=".35"/><rect x="${f(x)}" y="${y}" width="${f(bw)}" height="${bh}" rx="8" fill="#e2231a"/><text x="150" y="${y+16}" text-anchor="middle" font-family="Impact,RoundStencil,sans-serif" font-size="15" fill="#fff" letter-spacing="2">HELLO</text><text x="150" y="${y+25}" text-anchor="middle" font-family="Georgia,serif" font-size="7" fill="#fff">my name is</text><rect x="${f(x+5)}" y="${y+29}" width="${f(bw-10)}" height="${bh-38}" rx="2" fill="#fff"/>${t('font-family="RoundMarker,sans-serif" fill="#111"',150,f(y+29+(bh-38)/2+s*.34))}<path d="M${f(x+bw-14)} ${y+bh}L${f(x+bw)} ${y+bh-14}V${y+bh-8}Q${f(x+bw)} ${y+bh} ${f(x+bw-8)} ${y+bh}Z" fill="#7a0e08"/><path d="M${f(x+bw-14)} ${y+bh}L${f(x+bw)} ${y+bh-14}L${f(x+bw-9)} ${y+bh-9}Z" fill="#ffe1dc"/></g>`);
}

// Epic

function liveWire(item,id,text){
 const chars=[...text],n=Math.max(1,chars.length),{s,w,t}=line(text,.56,46),x0=150-w/2,adv=w/n,top=258-s*.62,cx=i=>x0+(i+.5)*adv;
 const jag=(x1,y1,x2,y2,seed,bow)=>{let d=`M${f(x1)} ${f(y1)}`;for(let i=1;i<=6;i++){const k=i/6,b=Math.sin(k*Math.PI)*bow;d+=`L${f(x1+(x2-x1)*k+(i<6?(rnd(seed+i)-.5)*4:0))} ${f(y1+(y2-y1)*k-b+(i<6?(rnd(seed+i+7)-.5)*5:0))}`;}return d;};
 // Arcs jump letter to letter, and from the end letters down to the ground, each on its own short fuse.
 const arc=(d,k)=>`<g ${an('zap',1+rnd(k)*1.6,rnd(k+5)*2)}><path d="${d}" fill="none" stroke="#5a7bff" stroke-width="2.8" stroke-linejoin="round" filter="url(#${id}-glow)"/><path d="${d}" fill="none" stroke="#fff" stroke-width=".8" stroke-linejoin="round"/></g>`;
 const pairs=Array.from({length:Math.min(n-1,14)},(_,i)=>i).flatMap(i=>[0,1].map(v=>arc(jag(cx(i),top,cx(i+1),top,i*20+v*11,6+rnd(i*3+v)*9),i*2+v)));
 const ground=[[cx(0),-1],[cx(n-1),1]].map(([x,dir],k)=>arc(jag(x,258,x+dir*14,288,90+k*7,-3),40+k));
 const sparks=Array.from({length:Math.min(n,14)},(_,i)=>`<circle cx="${f(cx(i))}" cy="${f(top)}" r="1.4" fill="#eaf6ff" ${an('blink',.3+rnd(i)*.4,rnd(i+3),'--lo:0')}/>`).join('');
 const defs=`${blur(`${id}-glow`,1.6)}<filter id="${id}-zap" x="-10%" y="-30%" width="120%" height="160%"><feTurbulence type="turbulence" baseFrequency=".09" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="2"/></filter>`;
 return wrap(item,id,'#5a7bff66',defs,`<g ${an('flicker',3,0,'--lo:.75')}>${t(`font-family="Impact,RoundStencil,sans-serif" fill="#3a5bff" stroke="#5a7bff" stroke-width="3" filter="url(#${id}-glow)"`)}<g filter="url(#${id}-zap)">${t('font-family="Impact,RoundStencil,sans-serif" fill="#bfe9ff" stroke="#fff" stroke-width=".7"')}</g>${t('font-family="Impact,RoundStencil,sans-serif" fill="#fff" opacity=".55" transform="translate(0 -.6)"')}</g>${ground.join('')}${pairs.join('')}${sparks}`);
}

function iceSculpture(item,id,text){
 const {s,w,t}=line(text,.56,46),x0=150-w/2;
 const defs=`${linear(`${id}-ice`,['#ffffff','#c9f1ff','#7fc8ff','#e3f8ff'])}<filter id="${id}-frost" x="-10%" y="-30%" width="120%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="2" result="n"/><feColorMatrix in="n" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1.4 -.6" result="w"/><feComposite in="w" in2="SourceGraphic" operator="in" result="f"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="f"/></feMerge></filter>${blur(`${id}-mist`,5)}`;
 const drips=Array.from({length:6},(_,k)=>`<g transform="translate(${f(x0+12+rnd(k)*(w-24))} 262)"><path d="M0 0Q1.6 3 0 4.4Q-1.6 3 0 0Z" fill="#c9f1ff" ${an('move',2.4+rnd(k+3)*1.6,rnd(k+5)*3,'--dy:20px;--o:.9')}/></g>`).join('');
 return wrap(item,id,'#7fc8ff55',defs,`<ellipse cx="150" cy="270" rx="${f(w/2+10)}" ry="8" fill="#e3f8ff" opacity=".4" filter="url(#${id}-mist)" ${an('pulse',3,0,'--lo:.2;--hi:.5')}/><g filter="url(#${id}-frost)">${t(`font-family="Georgia,serif" font-weight="700" fill="url(#${id}-ice)" fill-opacity=".88" stroke="#ffffff" stroke-width=".8"`)}</g>${t('font-family="Georgia,serif" font-weight="700" fill="none" stroke="#fff" stroke-width=".5" opacity=".8"',148.8,256.8)}${drips}`);
}

function splitFlap(item,id,text){
 const chars=[...text.toUpperCase()].slice(0,16),cell=Math.min(22,240/chars.length),x0=150-chars.length*cell/2,h=cell*1.4,y=250-h/2;
 const tiles=chars.map((c,i)=>{const x=x0+i*cell+cell*.05,tw=cell*.9;return `<g transform="translate(${f(x+tw/2)} 250)"><g ${an('flipy',6,6-i*.16)}><rect x="${f(-tw/2)}" y="${f(-h/2)}" width="${f(tw)}" height="${f(h)}" rx="1.6" fill="url(#${id}-tile)"/><text y="${f(h*.3)}" text-anchor="middle" font-family="RoundMono,monospace" font-weight="700" font-size="${f(h*.78)}" fill="#f6f6f6">${escape(c)}</text></g><path d="M${f(-tw/2)} 0H${f(tw/2)}" stroke="#000" stroke-width="1"/><circle cx="${f(-tw/2+.8)}" r=".6" fill="#555"/><circle cx="${f(tw/2-.8)}" r=".6" fill="#555"/></g>`;}).join('');
 return wrap(item,id,'#0000',linear(`${id}-tile`,['#2a2a30','#1b1b1f','#26262c']),`<rect x="${f(x0-6)}" y="${f(y-5)}" width="${f(chars.length*cell+12)}" height="${f(h+10)}" rx="3" fill="#0b0b0d"/>${tiles}`);
}

// Segments a-g of a seven-segment digit; letters take their usual display shapes.
const SEG={0:'abcdef',1:'bc',2:'abdeg',3:'abcdg',4:'bcfg',5:'acdfg',6:'acdefg',7:'abc',8:'abcdefg',9:'abcdfg',A:'abcefg',B:'cdefg',C:'adef',D:'bcdeg',E:'adefg',F:'aefg',G:'acdef',H:'bcefg',I:'ef',J:'bcde',K:'bcefg',L:'def',M:'aceg',N:'ceg',O:'cdeg',P:'abefg',Q:'abcfg',R:'eg',S:'acdfg',T:'defg',U:'bcdef',V:'cde',W:'bdf',X:'bcefg',Y:'bcdfg',Z:'abdeg','-':'g',' ':''};
function ledDisplay(item,id,text){
 const chars=[...text.toUpperCase()].slice(0,14),cell=Math.min(22,236/chars.length),sw=cell*.62,sh=sw*1.9,x0=150-chars.length*cell/2,y=250-sh/2,th=Math.max(1.6,sw*.16);
 const segs=(x)=>({a:[x,y,x+sw,y],b:[x+sw,y,x+sw,y+sh/2],c:[x+sw,y+sh/2,x+sw,y+sh],d:[x,y+sh,x+sw,y+sh],e:[x,y+sh/2,x,y+sh],f:[x,y,x,y+sh/2],g:[x,y+sh/2,x+sw,y+sh/2]});
 let k=0;
 const cells=chars.map((c,i)=>{const x=x0+i*cell+(cell-sw)/2,on=SEG[c];if(on===undefined)return `<text x="${f(x+sw/2)}" y="${f(y+sh*.85)}" text-anchor="middle" font-family="RoundMono,monospace" font-size="${f(sh)}" fill="#ff3b30" filter="url(#${id}-glow)">${escape(c)}</text>`;
  return Object.entries(segs(x)).map(([n,[x1,y1,x2,y2]])=>{const lit=on.includes(n),j=k++;return `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${lit?'#ff3b30':'#3a0d0d'}" stroke-width="${f(th)}" stroke-linecap="round"${lit?` filter="url(#${id}-glow)" ${an('flicker',4,rnd(j)*4,'--lo:.35')}`:''}/>`;}).join('');}).join('');
 return wrap(item,id,'#ff3b3044',`<filter id="${id}-glow" filterUnits="userSpaceOnUse" x="0" y="185" width="300" height="110"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,`<rect x="${f(x0-8)}" y="${f(y-8)}" width="${f(chars.length*cell+16)}" height="${f(sh+16)}" rx="3" fill="#120404" stroke="#2a0a0a"/>${cells}`);
}

function foilBalloons(item,id,text){
 const chars=[...text].slice(0,14),cell=Math.min(30,236/chars.length),x0=150-chars.length*cell/2,size=cell*1.3,foils=['gold','pink','blue'];
 const defs=`${linear(`${id}-gold`,['#fff3b0','#ffcf4a','#c98a00','#ffe48a'],1,1)}${linear(`${id}-pink`,['#ffd6f0','#ff6ad5','#b0308f','#ffb3e6'],1,1)}${linear(`${id}-blue`,['#d6f0ff','#5fb8ff','#2a5fbf','#b3dcff'],1,1)}`;
 const letters=chars.map((c,i)=>{const x=x0+(i+.5)*cell,foil=foils[i%3];return `<g transform="translate(${f(x)} 0)"><g ${an('bob',2+rnd(i)*1.2,rnd(i+3)*2,`--dy:${f(-3-rnd(i+5)*3)}px`)}><path d="M0 263Q${f((rnd(i+7)-.5)*8)} 276 ${f((rnd(i+9)-.5)*4)} 292" fill="none" stroke="#e9e9e9" stroke-width=".5" opacity=".8"/><text y="258" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="${f(size)}" fill="url(#${id}-${foil})" stroke="url(#${id}-${foil})" stroke-width="${f(size*.12)}" stroke-linejoin="round" paint-order="stroke">${escape(c)}</text><ellipse cx="${f(-size*.15)}" cy="${f(258-size*.55)}" rx="${f(size*.1)}" ry="${f(size*.05)}" fill="#fff" opacity=".8"/></g></g>`;}).join('');
 return wrap(item,id,'#ffcf4a44',defs,letters);
}

function comicBurst(item,id,text){
 const {s,w,t}=line(text.toUpperCase(),.58,38,200),rx=w/2+26,ry=s*.7+16;
 const burst=Array.from({length:28},(_,k)=>{const a=k/28*Math.PI*2,r=k%2?.78:1.08+rnd(k)*.12;return `${f(150+Math.cos(a)*rx*r)} ${f(250+Math.sin(a)*ry*r)}`;}).join('L');
 const defs=`<pattern id="${id}-dots" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.1" fill="#ff9f1c"/></pattern><clipPath id="${id}-burst"><path d="M${burst}Z"/></clipPath>`;
 return wrap(item,id,'#0000',defs,`<g ${an('jitter',.3,0,'--dx:.8px;--dy:-.6px')}><path d="M${burst}Z" fill="#000" transform="translate(3 4)"/><path d="M${burst}Z" fill="#ffe14d" stroke="#111" stroke-width="2.4" stroke-linejoin="round"/><rect x="0" y="185" width="300" height="110" fill="url(#${id}-dots)" clip-path="url(#${id}-burst)" opacity=".5"/><g transform="skewX(-8) translate(${f(Math.tan(8*Math.PI/180)*250)} 0)">${t('font-family="Impact,RoundStencil,sans-serif" fill="#e63946" stroke="#111" stroke-width="3" paint-order="stroke" letter-spacing="1"',150,f(250+s*.36))}</g></g>`);
}

function arcadeScore(item,id,text){
 const chars=[...text.toUpperCase()].slice(0,16),n=Math.max(1,chars.length),{s,w}=line(chars.join(''),.62,24,210),adv=w/n,x0=150-w/2,T=6,y=264,pw=Math.max(170,w+46);
 const head='NEW HIGH SCORE!',hc=['#ff4d6d','#ffd23f','#29f0ff'];
 // The banner cycles colour letter by letter; the name types itself in, holds, and clears for the next run.
 const banner=[...head].map((c,i)=>{const x=f(150+(i-(head.length-1)/2)*6.4);return hc.map((col,k)=>`<text x="${x}" y="236" text-anchor="middle" font-family="RoundMono,monospace" font-weight="700" font-size="8" fill="${col}" ${an('chase',.9,((i+k)%3)*.3,'--lo:0')}>${escape(c)}</text>`).join('');}).join('');
 const letters=chars.map((c,i)=>`<g ${an('type',T,T-i*.12)}><text x="${f(x0+(i+.5)*adv)}" y="${y}" text-anchor="middle" font-family="RoundMono,monospace" font-weight="700" font-size="${f(s)}" fill="#29f0ff" filter="url(#${id}-glow)">${escape(c)}</text><text x="${f(x0+(i+.5)*adv)}" y="${y}" text-anchor="middle" font-family="RoundMono,monospace" font-weight="700" font-size="${f(s)}" fill="#eaffff">${escape(c)}</text></g>`).join('');
 const defs=`<pattern id="${id}-scan" width="4" height="2" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".35"/></pattern>${blur(`${id}-glow`,1.4)}`;
 const l=f(150-pw/2);
 return wrap(item,id,'#29f0ff33',defs,`<rect x="${l}" y="222" width="${f(pw)}" height="68" rx="5" fill="#05060f" stroke="#29f0ff" stroke-width="1.2"/><rect x="${l}" y="222" width="${f(pw)}" height="68" rx="5" fill="none" stroke="#29f0ff" stroke-width="3" opacity=".3" filter="url(#${id}-glow)"/>${banner}${letters}<rect x="${f(x0+w+3)}" y="${f(y-s*.72)}" width="${f(s*.5)}" height="${f(s*.76)}" fill="#eaffff" ${an('blink',.8)}/><text x="${f(l+10)}" y="283" font-family="RoundMono,monospace" font-weight="700" font-size="6.4" fill="#ffd23f">1ST</text><text x="${f(l+pw-10)}" y="283" text-anchor="end" font-family="RoundMono,monospace" font-weight="700" font-size="6.4" fill="#ffd23f">999 990</text><rect x="${l}" y="222" width="${f(pw)}" height="68" rx="5" fill="url(#${id}-scan)"/>`);
}

function titleCard(item,id,text){
 const {s,w,t}=line(text.toUpperCase(),.7,40,230),T=7,y=f(256+s*.3);
 // A blockbuster title: the studio line fades up, the name pushes in from close and settles, a lens flare crosses it.
 const defs=`<linearGradient id="${id}-gold" x2="0" y2="1"><stop stop-color="#fff6cf"/><stop offset=".45" stop-color="#f2c94c"/><stop offset=".55" stop-color="#a8781a"/><stop offset="1" stop-color="#fff1b0"/></linearGradient>${linear(`${id}-flare`,['#9fd8ff00','#ffffff','#9fd8ff00'],1,0)}${blur(`${id}-soft`,2)}`;
 const flare=`<g transform="translate(150 ${f(y-s*.35)})"><g ${an('flare',T)}><ellipse rx="110" ry="1.4" fill="url(#${id}-flare)"/><circle r="9" fill="#bfe6ff" opacity=".6" filter="url(#${id}-soft)"/><circle r="3" fill="#fff"/><circle cx="-34" r="4" fill="#9fd8ff" opacity=".3"/><circle cx="28" r="2.4" fill="#ffd36b" opacity=".4"/></g></g>`;
 const title=`<g transform="translate(150 250)"><g ${an('zoomin',T)}><g transform="translate(-150 -250)">${t('font-family="Georgia,serif" font-weight="900" fill="#000" opacity=".6" letter-spacing="2"',151.6,f(y+2))}${t(`font-family="Georgia,serif" font-weight="900" fill="url(#${id}-gold)" stroke="#3a2608" stroke-width=".8" letter-spacing="2"`,150,y)}</g></g></g>`;
 return wrap(item,id,'#f2c94c33',defs,`<rect y="196" width="300" height="7" fill="#000" opacity=".7"/><rect y="287" width="300" height="7" fill="#000" opacity=".7"/><text x="150" y="222" text-anchor="middle" font-family="Georgia,serif" font-size="6" fill="#f6efdc" letter-spacing="3" ${an('fade',T,0,'--o:.85')}>AD2L PICTURES PRESENTS</text>${title}${flare}`);
}

function bubbleGum(item,id,text){
 const chars=[...text],n=Math.max(1,chars.length),{s,w}=line(text,.6,44,200),adv=w/n,x0=150-w/2,T=7,y=f(250+s*.34),cy=f(y-s*.36),r=f(Math.max(adv*.8,s*.6));
 // Puffy pink letters blown one after another: each swells inside its own bubble, pops into splats and puffs back.
 const px=i=>f(x0+(i+.5)*adv),start=i=>i/n*.8*T;
 const glyph=(c,attrs,dx=0,dy=0)=>`<text x="${f(dx)}" y="${f(y-cy+dy)}" text-anchor="middle" font-family="RoundMarker,sans-serif" font-size="${f(s)}" ${attrs}>${escape(c)}</text>`;
 const splat=i=>Array.from({length:9},(_,k)=>{const a=(k+rnd(i*9+k)*.6)/9*Math.PI*2,d=r*(1.05+rnd(i*9+k+3)*.5),x=f(Math.cos(a)*d),yy=f(Math.sin(a)*d);
  return `<path d="M${f(Math.cos(a)*r*.5)} ${f(Math.sin(a)*r*.5)}L${x} ${yy}" stroke="#ff8fc8" stroke-width="1.2" stroke-linecap="round" opacity=".8"/><ellipse cx="${x}" cy="${yy}" rx="${f(1.8+rnd(k+i)*1.8)}" ry="${f(1.3+rnd(k+i+2))}" fill="#ff8fc8" stroke="#c2185b" stroke-width=".5" transform="rotate(${f(a*57.3)} ${x} ${yy})"/>`;}).join('');
 const letter=(c,i)=>`<g transform="translate(${px(i)} ${cy})"><g ${an('gumletter',T,T-start(i))}>${glyph(c,'fill="#ff8fc8" stroke="#c2185b" stroke-width="5" stroke-linejoin="round" paint-order="stroke"')}${glyph(c,'fill="#ffd1e8" opacity=".55"',-.8,-1.2)}</g><g ${an('gumbubble',T,T-start(i))}><circle r="${r}" fill="url(#${id}-bubble)" stroke="#e0468f" stroke-width=".8"/><ellipse cx="${f(-r*.38)}" cy="${f(-r*.42)}" rx="${f(r*.24)}" ry="${f(r*.12)}" fill="#fff" opacity=".8" transform="rotate(-35 ${f(-r*.38)} ${f(-r*.42)})"/></g><g ${an('gumsplat',T,T-start(i))}>${splat(i)}</g></g>`;
 const defs=radial(`${id}-bubble`,['#ffe6f230','#ff8fc855','#ff5aa8b8']);
 return wrap(item,id,'#ff8fc844',defs,chars.map(letter).join(''));
}

// Legendary

function skywriting(item,id,text){
 const chars=[...text],n=Math.max(1,chars.length),{s,w,t}=line(text,.42,58),T=16,x0=f(150-w/2-14),x1=f(150+w/2+14),ly=280;
 // Slow and steady: a small biplane flies the underline from left to right, and each letter is written in smoke as
 // the plane passes under it. The smoke fills in, hangs, and fades before the next pass.
 const span=x1-x0,at=x=>T*(.05+.65*(x-x0)/span),dt=T*.65*(w/n)/span,fit=n*s*.42>230?' textLength="230" lengthAdjust="spacingAndGlyphs"':'';
 const defs=`<filter id="${id}-smoke" x="-15%" y="-40%" width="130%" height="180%"><feTurbulence type="fractalNoise" baseFrequency=".12" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" result="d"/><feGaussianBlur in="d" stdDeviation="1.1"/></filter>`;
 const strokes=`<text x="150" y="258" text-anchor="middle" font-size="${f(s)}"${fit} font-family="RoundAllura,cursive" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${chars.map((c,i)=>`<tspan ${scribe(T,at(150-w/2+i*w/n),dt,s*3)}>${escape(c)}</tspan>`).join('')}</text>`;
 const trail=`<path d="M${x0} ${ly}C${f(x0+span*.3)} ${ly+4} ${f(x0+span*.6)} ${ly-4} ${x1} ${ly}" pathLength="1" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" filter="url(#${id}-smoke)" ${an('skytrail',T)}/>`;
 const plane=`<g transform="translate(${x0} ${ly})"><g ${an('skyplane2',T,0,`--dx:${f(span)}px`)}><g transform="scale(.75)"><path d="M-12 -1.6L-16 -6.4H-13.4L-9 -1.8Z" fill="#b01c2e"/><rect x="-16" y="-.8" width="6" height="1.6" rx=".6" fill="#b01c2e"/><path d="M-12 -1.6C-6 -3.2 6 -3.2 10 -1.4L12 0L10 1.4C6 3.2 -6 3.2 -12 1.6Z" fill="#d62839" stroke="#7a1020" stroke-width=".4"/><path d="M-10 0H9" stroke="#fff" stroke-width=".6" opacity=".7"/><rect x="-4" y="-6.6" width="10" height="1.8" rx=".8" fill="#f6f6f6" stroke="#7a1020" stroke-width=".35"/><rect x="-3" y="2.6" width="9" height="1.5" rx=".7" fill="#f6f6f6" stroke="#7a1020" stroke-width=".35"/><path d="M-2 -4.8V2.6M4.4 -4.8V2.6" stroke="#7a1020" stroke-width=".4"/><circle cx="-1.6" cy="-3.2" r="1.3" fill="#3a2a1a"/><path d="M-2.6 -2.8Q-6 -3.6 -8 -2" fill="none" stroke="#ffd166" stroke-width=".7"/><g transform="translate(12.6 0)"><g ${an('flap',.06,0,'--fy:-1')}><ellipse rx=".7" ry="4.6" fill="#5a4a3a" opacity=".85"/></g></g></g></g></g>`;
 return wrap(item,id,'#ffffff44',defs,`<g ${an('skyfade',T)}><g filter="url(#${id}-smoke)" opacity=".92">${strokes}</g></g><g ${an('skyfill',T)}><g filter="url(#${id}-smoke)" opacity=".85">${t('font-family="RoundAllura,cursive" fill="#fff"')}</g></g>${trail}${plane}`);
}

function writtenInSand(item,id,text){
 const {s,w,t}=line(text,.42,58),T=12,sw=Math.max(180,w+56),l=f(150-sw/2);
 // Carved, not printed: a pale lip up-left, the dark groove, and a damp shade at the bottom of the cut. A wave runs
 // up from the sea side over the whole strip, the name goes under as the front crosses it, the water draws back and
 // leaves the sand dark and wet, and the name is carved again.
 const defs=`${linear(`${id}-sand`,['#f0dcae','#ddbd82','#c9a060'])}${linear(`${id}-water`,['#d8f4fbee','#7fcde2e6','#3f9fc2f2'])}<filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="9"/><feColorMatrix values="0 0 0 0 .4 0 0 0 0 .3 0 0 0 0 .15 0 0 0 .45 0"/></filter><clipPath id="${id}-strip"><rect x="${l}" y="220" width="${f(sw)}" height="60" rx="22"/></clipPath>`;
 const carved=`${t('font-family="RoundDafoe,cursive" fill="#fff1cf"',149.1,256.9)}${t('font-family="RoundDafoe,cursive" fill="#7a5426"')}${t('font-family="RoundDafoe,cursive" fill="#a8804a" opacity=".9"',150.7,258.9)}<path d="M${f(150-w/2)} 270Q150 266 ${f(150+w/2+10)} 271" fill="none" stroke="#7a5426" stroke-width="1.6" stroke-linecap="round"/><path d="M${f(150-w/2)} 269.2Q150 265.2 ${f(150+w/2+10)} 270.2" fill="none" stroke="#fff1cf" stroke-width=".7" stroke-linecap="round"/>`;
 // The front: a scalloped edge across the strip with foam along it; the body of the wave runs down off the bottom.
 const seg=(sw+20)/7,xs=Array.from({length:8},(_,i)=>+l-10+i*seg),edge=`M${f(xs[0])} 216${xs.slice(1).map((x,i)=>`Q${f(x-seg/2)} ${i%2?209:212} ${f(x)} 216`).join('')}`;
 const foam=Array.from({length:16},(_,k)=>`<circle cx="${f(+l+rnd(k)*sw)}" cy="${f(219+rnd(k+3)*7)}" r="${f(.7+rnd(k+5)*1.2)}" fill="#fff" opacity=".85"/>`).join('');
 const wave=`<g ${an('sandwave',T)}><g ${an('bob',1.4,0,'--dx:5px;--dy:1px')}><path d="${edge}V300H${f(xs[0])}Z" fill="url(#${id}-water)"/><path d="${edge}" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>${foam}<path d="${edge}" fill="none" stroke="#fff" stroke-width="1" opacity=".35" transform="translate(4 14)"/><path d="${edge}" fill="none" stroke="#fff" stroke-width=".8" opacity=".25" transform="translate(-6 32)"/></g></g>`;
 const shell=`<g transform="translate(${f(150+sw/2-16)} 272) rotate(-20)"><path d="M0 0L-6 -9Q0 -12 6 -9Z" fill="#f6d5c2" stroke="#c98a6a" stroke-width=".5"/><path d="M0 0L-3 -10M0 0V-11M0 0L3 -10" stroke="#c98a6a" stroke-width=".4"/></g>`;
 const starfish=`<g transform="translate(${f(150-sw/2+16)} 228) rotate(14)"><path d="M0 -6L1.6 -1.8L6 -1.8L2.4 1L3.8 5.4L0 2.8L-3.8 5.4L-2.4 1L-6 -1.8L-1.6 -1.8Z" fill="#ff8a5a" stroke="#c9502a" stroke-width=".5" stroke-linejoin="round"/></g>`;
 return wrap(item,id,'#0000',defs,`<g clip-path="url(#${id}-strip)"><rect x="${l}" y="220" width="${f(sw)}" height="60" fill="url(#${id}-sand)"/><rect x="${l}" y="220" width="${f(sw)}" height="60" filter="url(#${id}-grain)"/><g opacity=".5"><rect x="${l}" y="220" width="${f(sw)}" height="60" fill="#7a5a2e" ${an('sandwet',T)}/></g><g ${an('sandname',T)}>${carved}</g>${shell}${starfish}${wave}</g>`);
}

function laserEtch(item,id,text){
 const chars=[...text],n=Math.max(1,chars.length),{s,w}=line(text,.6,40,200),adv=w/n,pw=Math.max(170,w+50),x0=150-w/2,T=12,y=f(250+s*.34);
 // A fresh plate slides in, the laser traces each letter's outline in turn, the cuts cool and fill dark, then the
 // plate is tossed off to the left and the next one comes in.
 const px=i=>x0+(i+.5)*adv,dt=.55*T/n,ti=i=>T*.09+i*dt,L=s*3.4;
 const glyph=(c,i,attrs,dx=0,dy=0)=>`<text x="${f(px(i)+dx)}" y="${f(y+dy)}" text-anchor="middle" font-family="RoundMono,monospace" font-weight="700" font-size="${f(s)}" ${attrs}>${escape(c)}</text>`;
 const hot=chars.map((c,i)=>glyph(c,i,`fill="none" stroke="#ff8a1f" stroke-width="2.6" stroke-linejoin="round" ${scribe(T,ti(i),dt,L)}`)).join('');
 const cut=chars.map((c,i)=>glyph(c,i,`fill="none" stroke="#24272d" stroke-width="1.1" stroke-linejoin="round" ${scribe(T,ti(i),dt,L)}`)).join('');
 const filled=chars.map((c,i)=>glyph(c,i,'fill="#fff" opacity=".6"',.6,.7)+glyph(c,i,'fill="#24272d"')).join('');
 const flash=chars.map((c,i)=>glyph(c,i,`fill="#ffb347" filter="url(#${id}-hot)"`)).join('');
 const tip=f(y-s*.04),head=`<g transform="translate(${f(x0)} 0)"><g ${an('laserhead',T,0,`--dx:${f(w)}px`)}><g ${an('bob',dt/2,0,`--dx:${f(adv*.3)}px;--dy:${f(-s*.66)}px`)}><path d="M0 186V${tip}" stroke="#ff3b30" stroke-width="1.6" opacity=".35" filter="url(#${id}-hot)"/><path d="M0 186V${tip}" stroke="#ff7a6a" stroke-width=".6"/><circle cy="${tip}" r="4" fill="#ffb347" filter="url(#${id}-hot)"/><circle cy="${tip}" r="1.4" fill="#fff"/>${[0,1,2,3,4].map(k=>`<path d="M0 ${tip}l${f((k-2)*3)} ${f(-5+rnd(k)*3)}" stroke="#ffd166" stroke-width=".6" stroke-linecap="round" ${an('blink',.16,k*.04,'--lo:0')}/>`).join('')}</g></g></g>`;
 const screw=(sx,sy)=>`<circle cx="${f(sx)}" cy="${sy}" r="2.2" fill="url(#${id}-screw)" stroke="#4b5360" stroke-width=".3"/><path d="M${f(sx-1.3)} ${sy}H${f(sx+1.3)}" stroke="#4b5360" stroke-width=".5"/>`;
 const defs=`${linear(`${id}-steel`,['#e4e7eb','#a3abb5','#d1d5da','#848d98'])}<pattern id="${id}-brush" width="300" height="2" patternUnits="userSpaceOnUse"><path d="M0 1H300" stroke="#fff" stroke-width=".3" opacity=".3"/></pattern>${linear(`${id}-screw`,['#f4f6f8','#7d8691'],1,1)}${blur(`${id}-hot`,1.4)}`;
 const l=f(150-pw/2),r=f(150+pw/2);
 const plate=`<rect x="${l}" y="224" width="${f(pw)}" height="52" rx="4" fill="#000" opacity=".4" transform="translate(1.5 2)"/><rect x="${l}" y="224" width="${f(pw)}" height="52" rx="4" fill="url(#${id}-steel)"/><rect x="${l}" y="224" width="${f(pw)}" height="52" rx="4" fill="url(#${id}-brush)"/><path d="M${f(l+4)} 225.2H${f(r-4)}" stroke="#fff" stroke-width=".9" opacity=".8"/><path d="M${f(l+4)} 274.8H${f(r-4)}" stroke="#4b5360" stroke-width=".9" opacity=".7"/>${screw(l+6,230)}${screw(r-6,230)}${screw(l+6,270)}${screw(r-6,270)}<text x="${f(r-8)}" y="272" text-anchor="end" font-family="RoundMono,monospace" font-size="4" fill="#4b5360">AD2L FAB</text>`;
 return wrap(item,id,'#ff7a1f33',defs,`<g transform="translate(150 250)"><g ${an('platetoss',T)}><g transform="translate(-150 -250)">${plate}<g ${an('etchcool',T)}><g filter="url(#${id}-hot)">${hot}</g></g>${cut}<g ${an('etchfill',T)}>${filled}</g><g ${an('etchglow',T)}>${flash}</g></g></g></g>${head}`);
}

function blossomBranch(item,id,text){
 const {s,w,t}=line(text,.44,60),x0=150-w/2;
 const blossom=k=>`<g ${an('bloom',7,7-k*.4)}>${[0,72,144,216,288].map(a=>`<ellipse cx="2.6" rx="2.6" ry="1.8" fill="${k%3?'#ffb7c5':'#fff0f3'}" stroke="#e88aa0" stroke-width=".3" transform="rotate(${a})"/>`).join('')}<circle r="1" fill="#d6284f"/>${[0,72,144,216,288].map(a=>`<path d="M0 0L1.6 0" stroke="#ffd34d" stroke-width=".3" transform="rotate(${a+36})"/>`).join('')}</g>`;
 // A sumi-e cherry branch under the name: one tapering brush stroke from thick at the left to a fine tip, with
 // side twigs, and the blossoms opening along it in turn.
 const bx0=Math.max(14,x0-30),bx1=Math.min(290,150+w/2+26),by=x=>270-6*Math.sin((x-bx0)/(bx1-bx0)*Math.PI)+1.6*Math.sin(x/19),thick=x=>4.2*(1-(x-bx0)/(bx1-bx0))+.5;
 const xs=Array.from({length:25},(_,i)=>bx0+i/24*(bx1-bx0));
 const branch=`M${xs.map(x=>`${f(x)} ${f(by(x)-thick(x)/2)}`).join('L')}L${xs.slice().reverse().map(x=>`${f(x)} ${f(by(x)+thick(x)/2)}`).join('L')}Z`;
 const twigs=[.18,.36,.55,.72,.86].map((p,k)=>{const x=bx0+p*(bx1-bx0),y=by(x),up=k%2?-1:1,ex=x+10+rnd(k)*8,ey=y+up*(-9-rnd(k+3)*5);return {x:ex,y:ey,d:`M${f(x-1.4)} ${f(y)}Q${f(x+4)} ${f(y+up*-4)} ${f(ex)} ${f(ey)}L${f(x+1.4)} ${f(y)}Z`};});
 const spots=[...twigs.map(({x,y})=>[x,y]),...[.1,.3,.47,.64,.8,.95].map(p=>{const x=bx0+p*(bx1-bx0);return [x,by(x)-2];})];
 const buds=[.24,.6,.9].map(p=>{const x=bx0+p*(bx1-bx0);return `<circle cx="${f(x+2)}" cy="${f(by(x)+3)}" r="1.4" fill="#e8607a"/>`;}).join('');
 const petals=Array.from({length:9},(_,k)=>`<g transform="translate(${f(bx0+rnd(k)*(bx1-bx0))} ${f(232+rnd(k+3)*30)})"><ellipse rx="1.6" ry="1" fill="#ffb7c5" ${an('move',4+rnd(k+5)*3,rnd(k+7)*6,`--dx:${f(6+rnd(k+9)*10)}px;--dy:30px;--o:.9`)}/></g>`).join('');
 return wrap(item,id,'#ffb7c533','',`<path d="${branch}" fill="#3a2416"/>${twigs.map(({d})=>`<path d="${d}" fill="#3a2416"/>`).join('')}<path d="M${xs.map(x=>`${f(x)} ${f(by(x)-thick(x)*.2)}`).join('L')}" fill="none" stroke="#7a5236" stroke-width=".5" opacity=".7"/>${buds}${t('font-family="RoundDafoe,cursive" fill="#5a3520" stroke="#ffe3ea" stroke-width="2" paint-order="stroke"',150,252)}${spots.map(([x,y],k)=>`<g transform="translate(${f(x)} ${f(y)})">${blossom(k)}</g>`).join('')}${petals}`);
}

function lavaScript(item,id,text){
 const {s,w,t}=line(text,.56,48),x0=150-w/2,top=258-s*.7;
 // Bright molten letters under a cracked crust: the crust is the letters again, cut by a crack pattern, so the glow
 // shows through every split. Everything else comes out of the letters: flames lick up from inside them, bubbles
 // pop on their surface, embers rise off them and drips hang from their bottoms.
 const defs=`<linearGradient id="${id}-molten" x2="0" y2="1"><stop stop-color="#fff3a0"/><stop offset=".4" stop-color="#ffb347"/><stop offset=".75" stop-color="#ff6a1f"/><stop offset="1" stop-color="#c0260a"/></linearGradient>${linear(`${id}-rock`,['#4a2418','#2a1410','#1a0a06'])}<filter id="${id}-plates" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency=".075" numOctaves="1" seed="6"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 9 0 0 0 -.75"/></filter><mask id="${id}-crust" maskUnits="userSpaceOnUse" x="0" y="185" width="300" height="110"><rect x="0" y="185" width="300" height="110" fill="#fff" filter="url(#${id}-plates)"/></mask>${blur(`${id}-heat`,3)}${blur(`${id}-lick`,1.2)}`;
 const face='font-family="Impact,RoundStencil,sans-serif"';
 const flames=Array.from({length:Math.max(5,Math.min(14,Math.round(w/16)))},(_,k)=>`<g transform="translate(${f(x0+6+rnd(k+20)*(w-12))} ${f(258-s*.3)})"><path d="M-3.4 0Q-3.6 -7 0 -14Q3.6 -7 3.4 0Q0 2.4 -3.4 0Z" fill="${k%2?'#ffb347':'#ff6a1f'}" filter="url(#${id}-lick)" ${an('move',1.3+rnd(k+21)*.9,rnd(k+22)*2,`--dx:${f((rnd(k+23)-.5)*6)}px;--dy:${f(-s*.62-8)}px;--o:.9`)}/></g>`).join('');
 const drips=Array.from({length:Math.max(3,Math.min(9,Math.round(w/26)))},(_,k)=>`<g transform="translate(${f(x0+12+rnd(k)*(w-24))} 256)"><path d="M-1.4 0Q0 -2 1.4 0Q1.6 3 0 4Q-1.6 3 -1.4 0Z" fill="#ff8a1f" ${an('move',2.4+rnd(k+3)*1.6,rnd(k+5)*3,'--dy:20px;--o:.95')}/></g>`).join('');
 const bubbles=Array.from({length:16},(_,k)=>`<g transform="translate(${f(x0+rnd(k+40)*w)} ${f(258-rnd(k+41)*s*.62)})"><circle r="${f(1.4+rnd(k+42)*1.8)}" fill="#fff3a0" stroke="#ff6a1f" stroke-width=".6" ${an('pop',1.4+rnd(k+43)*1.4,rnd(k+44)*3,'--s0:.2;--s1:1.3;--o:.95')}/></g>`).join('');
 const embers=Array.from({length:12},(_,k)=>`<g transform="translate(${f(x0+rnd(k)*w)} ${f(258-s*(.2+rnd(k+1)*.4))})"><circle r="${f(.6+rnd(k+3)*.8)}" fill="#ffd166" ${an('move',2.4+rnd(k+5)*1.8,rnd(k+7)*4,`--dx:${f((rnd(k+9)-.5)*14)}px;--dy:${f(top-262)}px`)}/></g>`).join('');
 return wrap(item,id,'#ff6a1f55',`${defs}<clipPath id="${id}-letters">${t(face)}</clipPath>`,`<g ${an('pulse',2.4,0,'--lo:.45;--hi:.95')}>${t(`${face} fill="#ff4a0a" stroke="#ff4a0a" stroke-width="4" filter="url(#${id}-heat)"`)}</g>${flames}${t(`${face} fill="none" stroke="#120604" stroke-width="3.6" stroke-linejoin="round"`)}${drips}<g ${an('pulse',1.8,.6,'--lo:.8')}>${t(`${face} fill="url(#${id}-molten)"`)}</g><g mask="url(#${id}-crust)">${t(`${face} fill="url(#${id}-rock)"`)}</g><g clip-path="url(#${id}-letters)">${bubbles}</g>${t(`${face} fill="none" stroke="#ffb347" stroke-width=".7" opacity=".85"`)}${embers}`);
}

function roseWindow(item,id,text){
 const {s,w,t}=line(text,.6,46),cols=['#e63946','#1f4fbf','#f4b400','#2a9d8f','#9b5de5','#ff7b29','#3a86ff','#d62868'];
 // Random leading: a jittered triangulation over the name's box, so the lead lines run every which way.
 const x0=150-w/2-8,x1=150+w/2+8,y0=258-s*.9,y1=258+s*.35,gx=Math.max(4,Math.round((x1-x0)/13)),gy=4,cw=(x1-x0)/gx,ch=(y1-y0)/gy,P=[];
 for(let j=0;j<=gy;j++)for(let i=0;i<=gx;i++){const inside=i>0&&i<gx&&j>0&&j<gy;P.push([x0+i*cw+(inside?(rnd(i*31+j*7)-.5)*cw*.85:0),y0+j*ch+(inside?(rnd(i*17+j*13+3)-.5)*ch*.85:0)]);}
 const p=(i,j)=>P[j*(gx+1)+i];let panes='',lead='';
 for(let j=0;j<gy;j++)for(let i=0;i<gx;i++){const a=p(i,j),b=p(i+1,j),c=p(i,j+1),d=p(i+1,j+1),k=j*gx+i,tris=rnd(k+70)>.5?[[a,b,d],[a,d,c]]:[[a,b,c],[b,d,c]];
  for(const [q,m] of tris.map((q,m)=>[q,m])){const path=`M${q.map(([x,y])=>`${f(x)} ${f(y)}`).join('L')}Z`;panes+=`<path d="${path}" fill="${cols[Math.floor(rnd(k*2+m)*cols.length)]}" opacity="${f(.9+rnd(k*2+m+40)*.1)}"/>`;lead+=path;}}
 const defs=`${linear(`${id}-beam`,['#fff0','#fffd','#fff0'],1,0)}<clipPath id="${id}-letters">${t('font-family="Georgia,serif" font-weight="900"')}</clipPath>${blur(`${id}-glow`,3)}`;
 return wrap(item,id,'#e6394644',defs,`<g ${an('pulse',3,0,'--lo:.3;--hi:.7')}>${t(`font-family="Georgia,serif" font-weight="900" fill="#ff7b29" filter="url(#${id}-glow)"`)}</g>${t('font-family="Georgia,serif" font-weight="900" fill="#1a1612" stroke="#1a1612" stroke-width="3" stroke-linejoin="round"')}<g clip-path="url(#${id}-letters)">${panes}<path d="${lead}" fill="none" stroke="#1a1612" stroke-width=".8" stroke-linejoin="round"/><g ${an('slide',5,0,`--dx:${f(w+80)}px`)}><rect x="${f(150-w/2-60)}" y="200" width="30" height="80" fill="url(#${id}-beam)" transform="skewX(-20)"/></g></g>`);
}

function inkBloom(item,id,text){
 const {s,w,t}=line(text,.44,58),x0=150-w/2,T=9,n=Math.max(4,Math.min(10,Math.round(w/24)));
 // One beat per cycle: drops fall and land (inkdrop), spread into soft blots (inkblot), the name soaks up out of
 // them from blurred to sharp (soak), and everything fades out together before the next drops fall.
 const drops=Array.from({length:n},(_,k)=>[x0+(k+.5)*w/n+(rnd(k)-.5)*8,250+(rnd(k+3)-.5)*14]),lag=k=>T-k*.015*T;
 const defs=`${blur(`${id}-soft`,4)}<filter id="${id}-bleed" x="-10%" y="-30%" width="120%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".5" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter>`;
 const blots=drops.map(([x,y],k)=>`<g transform="translate(${f(x)} ${f(y)})"><circle r="${f(w/n*.7+8)}" fill="#111" filter="url(#${id}-soft)" ${an('inkblot',T,lag(k),'--o:.32')}/><circle r="${f(2+rnd(k+7)*2)}" fill="#111" ${an('inkblot',T,lag(k),'--o:1')}/><path d="M0 -4Q2.2 -1 0 0Q-2.2 -1 0 -4Z" fill="#111" ${an('inkdrop',T,lag(k))}/></g>`).join('');
 const splats=Array.from({length:12},(_,k)=>`<circle cx="${f(x0-12+rnd(k)*(w+24))}" cy="${f(222+rnd(k+5)*58)}" r="${f(.5+rnd(k+9)*1.6)}" fill="#111" opacity=".85"/>`).join('');
 return wrap(item,id,'#e9e2cf44',defs,`${blots}<g ${an('soak',T)}><g filter="url(#${id}-bleed)">${t('font-family="RoundDafoe,cursive" fill="#111" stroke="#e9e2cf" stroke-width="2.2" paint-order="stroke"')}</g>${splats}</g>`);
}

function arcaneSigil(item,id,text){
 const {s,w,t}=line(text,.56,46,200),T=9,rx=f(Math.min(140,w/2+36)),ry=38,cy=250;
 // A magic circle draws itself around the name, runes light up one by one around its ring, the name kindles in
 // violet fire, and motes orbit it; then the circle fades out and is drawn again.
 const ell=(a,b)=>`M${f(150-a)} ${cy}A${f(a)} ${f(b)} 0 1 1 ${f(150+a)} ${cy}A${f(a)} ${f(b)} 0 1 1 ${f(150-a)} ${cy}`;
 const RUNES=['M-2 -3V3M-2 0L2 -3','M-2 3L0 -3L2 3M-1 1H1','M-2 -3H2L-2 3H2','M0 -3V3M-2 -1L2 1','M-2 -3L2 3M2 -3L-2 3','M-2 3V-3L2 0L-2 3','M-2 -3V3H2M0 -3V0','M-2 0H2M0 -3L-2 3M0 -3L2 3'];
 const N=14,runes=Array.from({length:N},(_,k)=>{const a=k/N*Math.PI*2-Math.PI/2,x=f(150+Math.cos(a)*(+rx-6)),y=f(cy+Math.sin(a)*(ry-5));
  return `<g transform="translate(${x} ${y})"><g ${an('etch',T,T-(.3+k/N*.25)*T)}><path d="${RUNES[k%RUNES.length]}" fill="none" stroke="#e9d8ff" stroke-width=".9" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}-soft)"/><path d="${RUNES[k%RUNES.length]}" fill="none" stroke="#fff" stroke-width=".5" stroke-linecap="round" stroke-linejoin="round"/></g></g>`;}).join('');
 const rings=`<path d="${ell(rx,ry)}" pathLength="1" fill="none" stroke="#b98cff" stroke-width="1.4" filter="url(#${id}-soft)" ${an('draw',T)}/><path d="${ell(rx,ry)}" pathLength="1" fill="none" stroke="#f1e6ff" stroke-width=".6" ${an('draw',T)}/><path d="${ell(rx-12,ry-10)}" pathLength="1" fill="none" stroke="#9b6bff" stroke-width=".8" ${an('draw',T,-.05*T)}/><g ${an('fade',T,0,'--o:.7')}><path d="${ell(rx-3.5,ry-3)}" fill="none" stroke="#c9a6ff" stroke-width=".6" stroke-dasharray="1.5 4" ${an('dash',4,0,'--d:-22')}/></g>`;
 const motes=[0,1,2].map(k=>`<circle r="${k?1.4:2}" fill="#fff" filter="url(#${id}-soft)" ${an('ride',6,k*2,`offset-path:path('${ell(+rx-6,ry-5)}');offset-rotate:0deg`)}/>`).join('');
 const sparks=Array.from({length:10},(_,k)=>`<g transform="translate(${f(150-w/2+rnd(k)*w)} ${f(258-s*(.1+rnd(k+2)*.5))})"><circle r="${f(.5+rnd(k+4)*.7)}" fill="#e2ccff" ${an('move',2+rnd(k+6)*1.6,rnd(k+8)*3,`--dx:${f((rnd(k+10)-.5)*10)}px;--dy:-28px`)}/></g>`).join('');
 const defs=`<linearGradient id="${id}-ink" x2="0" y2="1"><stop stop-color="#ffffff"/><stop offset=".55" stop-color="#e2ccff"/><stop offset="1" stop-color="#a77bff"/></linearGradient>${blur(`${id}-soft`,1.2)}${blur(`${id}-fire`,3.2)}`;
 const face='font-family="Georgia,serif" font-weight="900" letter-spacing="1"';
 return wrap(item,id,'#9b6bff44',defs,`${rings}${runes}<g ${an('pulse',2.2,0,'--lo:.45;--hi:.9')}>${t(`${face} fill="#8a4dff" stroke="#8a4dff" stroke-width="4" filter="url(#${id}-fire)"`)}</g>${t(`${face} fill="url(#${id}-ink)" stroke="#2a0a4a" stroke-width="1.2" paint-order="stroke"`)}<g ${an('flash',T,.55*T)}>${t(`${face} fill="#fff" filter="url(#${id}-soft)"`)}</g>${sparks}${motes}`);
}

function northernLights(item,id,text){
 const {s,w,t}=line(text,.48,56,220),x0=150-w/2;
 // The name hangs inside the lights: the curtains' hems run below the letters and their rays climb up through and
 // past them, one behind and a fainter one in front. The letters are windows on a moving aurora.
 const defs=`<clipPath id="${id}-letters">${t('font-family="RoundDafoe,cursive"')}</clipPath><linearGradient id="${id}-aurora" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="150" y2="0" spreadMethod="repeat">${stops(['#3dffb0','#29d0ff','#9b5dff','#ff6ad5','#3dffb0'])}</linearGradient>${['green','violet'].map((n,k)=>`<linearGradient id="${id}-ray-${n}" gradientUnits="userSpaceOnUse" x1="0" y1="278" x2="0" y2="198"><stop stop-color="${k?'#c08bff':'#3dffb0'}" stop-opacity=".9"/><stop offset="1" stop-color="${k?'#c08bff':'#3dffb0'}" stop-opacity="0"/></linearGradient>`).join('')}${blur(`${id}-glow`,2.2)}${blur(`${id}-veilblur`,2.6)}`;
 // Curtains are rows of soft vertical rays along a wavy hem, bright at the hem and fading upward. The ends taper
 // and lift so a curtain has no hard sides.
 const N=Math.ceil((w+60)/4),curtain=(y0,col,k,lo,hi)=>`<g ${an('bob',4+k*1.3,k,`--dx:${f(6+k*3)}px;--dy:-2px`)}><g stroke="url(#${id}-ray-${col})" stroke-width="3.4" stroke-linecap="round" filter="url(#${id}-veilblur)" ${an('pulse',3+k,k*.8,`--lo:${lo};--hi:${hi}`)}>${Array.from({length:N},(_,j)=>{const x=x0-30+j*4,e=Math.sin(Math.PI*(j+.5)/N),y=y0+4*Math.sin(j/5+k*2)-(1-e)*14;return `<path d="M${f(x)} ${f(y)}V${f(y-(20+rnd(j+k*40)*44)*(.2+.8*e))}" stroke-opacity="${f(.25+.75*e)}"/>`;}).join('')}</g></g>`;
 const stars=Array.from({length:14},(_,k)=>`<circle cx="${f(x0-20+rnd(k)*(w+40))}" cy="${f(192+rnd(k+4)*26)}" r="${f(.4+rnd(k+8)*.6)}" fill="#fff" ${an('pulse',1.6+rnd(k+3)*2,rnd(k+5)*2,'--lo:.1')}/>`).join('');
 return wrap(item,id,'#3dffb044',defs,`${stars}<g style="mix-blend-mode:screen">${curtain(276,'violet',1.7,.25,.6)}${curtain(270,'green',0,.3,.65)}</g><g ${an('pulse',2.6,0,'--lo:.4;--hi:.8')}>${t(`font-family="RoundDafoe,cursive" fill="#3dffb0" stroke="#29d0ff" stroke-width="3" filter="url(#${id}-glow)"`)}</g><g clip-path="url(#${id}-letters)"><rect x="0" y="185" width="300" height="110" fill="#04201c"/><g ${an('slide',6,0,'--dx:150px')}><rect x="-150" y="185" width="600" height="110" fill="url(#${id}-aurora)"/></g><g ${an('slide',9,0,'--dx:-150px')} opacity=".45"><rect x="-150" y="185" width="600" height="110" fill="url(#${id}-aurora)" transform="translate(0 0) skewX(30)"/></g></g>${t('font-family="RoundDafoe,cursive" fill="none" stroke="#eafff6" stroke-width=".5" opacity=".7"')}<g style="mix-blend-mode:screen">${curtain(282,'green',2.4,.05,.2)}</g>`);
}

function lotusPond(item,id,text){
 const {s,w,t}=line(text,.5,50,210),sw=f(Math.min(292,Math.max(200,w+76))),l=f(150-sw/2),T=14;
 // A still pond: two koi circle under the name, ripples ring out on the surface, lily pads float at the ends and
 // the light shifts on the water.
 const orbit=`M${f(150-sw/2+20)} 250A${f(sw/2-20)} 25 0 1 1 ${f(150+sw/2-20)} 250A${f(sw/2-20)} 25 0 1 1 ${f(150-sw/2+20)} 250`;
 const koi=(k,c)=>`<g ${an('ride',T,k*T/2,`offset-path:path('${orbit}');offset-rotate:${k?'auto 180deg;animation-direction:reverse':'auto'}`)}><g transform="scale(1.15)"><g transform="translate(-8.6 0)"><g ${an('sway',.5,k*.2,'--a:22deg')}><path d="M0 0L-6 -4.4Q-4 0 -6 4.4Z" fill="${c}" opacity=".9"/></g></g><path d="M-3 -2.6L-1 -5.4L1 -2.8Z M-3 2.6L-1 5.4L1 2.8Z" fill="${c}" opacity=".8"/><path d="M9.4 0C8 -3.4 2 -4.2 -3 -2.6L-9 0L-3 2.6C2 4.2 8 3.4 9.4 0Z" fill="#fff6ea"/><ellipse cx="4.6" cy="-.6" rx="3.4" ry="2.1" fill="${c}"/><ellipse cx="-2.6" cy=".7" rx="2.6" ry="1.5" fill="${c}"/><circle cx="7.4" cy="-1.3" r=".5" fill="#111"/><circle cx="7.4" cy="1.3" r=".5" fill="#111"/></g></g>`;
 const ripples=Array.from({length:5},(_,k)=>`<g transform="translate(${f(+l+24+rnd(k+30)*(sw-48))} ${f(228+rnd(k+31)*44)})"><ellipse rx="9" ry="3.2" fill="none" stroke="#dff7f2" stroke-width=".7" ${an('pop',3.6+rnd(k+32)*2,rnd(k+33)*5,'--s0:.15;--s1:1.6;--o:.7')}/></g>`).join('');
 const light=Array.from({length:6},(_,k)=>`<path d="M${f(+l-40+k*sw/5)} ${f(222+rnd(k+50)*52)}q8 -2.4 16 0t16 0" fill="none" stroke="#bff3e6" stroke-width=".7" opacity=".35" ${an('bob',3+rnd(k+51)*2,rnd(k+52)*3,`--dx:${f(10+rnd(k+53)*8)}px;--dy:0px`)}/>`).join('');
 const pad=(x,y,r,a)=>`<g transform="translate(${f(x)} ${f(y)}) rotate(${a})"><path d="M0 0L${r} -2A${f(r+.3)} ${f(r+.3)} 0 1 0 ${r} 2Z" fill="#3f8f3a" stroke="#245a22" stroke-width=".6"/><path d="M0 0L${f(-r*.7)} ${f(-r*.4)}M0 0L${f(-r*.6)} ${f(r*.5)}M0 0L${f(r*.1)} ${f(-r*.8)}" stroke="#2c6a28" stroke-width=".4"/></g>`;
 const lotus=(x,y)=>`<g transform="translate(${f(x)} ${f(y)})">${[-40,-15,15,40].map(a=>`<ellipse cy="-3" rx="1.6" ry="3.6" fill="#ffc2d6" stroke="#d9668f" stroke-width=".4" transform="rotate(${a})"/>`).join('')}<circle r="1.3" fill="#ffd34d"/></g>`;
 const defs=`<radialGradient id="${id}-water" cx=".5" cy=".45" r=".7"><stop stop-color="#2f8f8a"/><stop offset=".6" stop-color="#155a63"/><stop offset="1" stop-color="#0a3340"/></radialGradient><clipPath id="${id}-pond"><rect x="${l}" y="214" width="${sw}" height="72" rx="32"/></clipPath>${blur(`${id}-deep`,.7)}`;
 return wrap(item,id,'#2f8f8a44',defs,`<rect x="${l}" y="214" width="${sw}" height="72" rx="32" fill="#4a5446" transform="translate(0 1.6)"/><g clip-path="url(#${id}-pond)"><rect x="${l}" y="214" width="${sw}" height="72" fill="url(#${id}-water)"/>${light}<g filter="url(#${id}-deep)" opacity=".92">${koi(0,'#ff6a1f')}${koi(1,'#e8322a')}</g>${ripples}</g><rect x="${l}" y="214" width="${sw}" height="72" rx="32" fill="none" stroke="#8a957f" stroke-width="2.4"/>${pad(+l+16,232,8,20)}${pad(+l+sw-18,270,9,200)}${pad(+l+sw-34,276,5.5,140)}${lotus(+l+sw-20,266)}<g ${an('bob',3.2,0,'--dy:.8px')}>${t('font-family="RoundDafoe,cursive" fill="#ffe7a8" stroke="#0a2a30" stroke-width="3" stroke-linejoin="round" paint-order="stroke"')}</g>`);
}

export const WAVE2_SIGNATURES={'chalk-hand':chalkHand,'rubber-stamp':rubberStamp,'label-maker':labelMaker,highlighter,'letter-tiles':letterTiles,ballpoint,'sticky-note':stickyNote,'piped-icing':pipedIcing,'hello-badge':helloBadge,'fridge-magnets':fridgeMagnets,
 'license-plate':licensePlate,'live-wire':liveWire,'ice-sculpture':iceSculpture,'split-flap':splitFlap,'led-display':ledDisplay,'foil-balloons':foilBalloons,'comic-burst':comicBurst,'arcade-score':arcadeScore,'title-card':titleCard,'bubble-gum':bubbleGum,
 skywriting,'written-in-sand':writtenInSand,'laser-etch':laserEtch,'blossom-branch':blossomBranch,'lava-script':lavaScript,'rose-window':roseWindow,'ink-bloom':inkBloom,'arcane-sigil':arcaneSigil,'northern-lights':northernLights,'lotus-pond':lotusPond};
