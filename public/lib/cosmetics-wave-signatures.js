// Signatures for the October 20 wave. Same frame as the expansion signatures: a 300-wide strip, viewBox 0 185 300 110,
// with the name centred near y 250. Long names shrink to fit rather than overflow.
let serial=0;
const rnd=n=>{const v=Math.sin(n*12.9898+78.233)*43758.5453;return v-Math.floor(v);};
const f=v=>Number(v.toFixed(2));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Font size for a name of n characters at an average advance of `advance` em, capped by `max` width.
const sizeFor=(n,advance,size,max=230)=>Math.min(size,max/Math.max(1,n*advance));
const wrap=(item,id,glow,defs,body)=>`<svg class="exp-layer exp-signature-svg wave-signature" data-signature-id="${item.id}" viewBox="0 185 300 110" style="--signature-glow:${glow}" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;

function ransomNote(item,id,text){
 const chars=[...text],cell=Math.min(30,232/chars.length),x0=150-chars.length*cell/2;
 const papers=[['#f2efe6','#111'],['#ffe14d','#111'],['#111','#fff'],['#d8333a','#fff'],['#2b5bd7','#fff'],['#ff9ac8','#111'],['#e9e2cf','#b3122e']];
 const fonts=['RoundStencil,Impact,sans-serif','Georgia,serif','RoundMarker,sans-serif','RoundMono,monospace','RoundDafoe,cursive','Georgia,serif'];
 const pieces=chars.map((c,i)=>{if(c===' ')return '';const s=i*7+c.charCodeAt(0),[bg,ink]=papers[Math.floor(rnd(s)*papers.length)],font=fonts[Math.floor(rnd(s+3)*fonts.length)],cx=x0+(i+.5)*cell,rot=f((rnd(s+5)-.5)*18),hw=cell*.46,hh=cell*.62,j=k=>f((rnd(s+k)-.5)*cell*.12);
  const shape=`M${f(cx-hw+j(1))} ${f(246-hh+j(2))}L${f(cx+hw+j(3))} ${f(246-hh+j(4))}L${f(cx+hw+j(5))} ${f(246+hh+j(6))}L${f(cx-hw+j(7))} ${f(246+hh+j(8))}Z`,letter=i%3===1?c.toLowerCase():c.toUpperCase();
  return `<g transform="rotate(${rot} ${f(cx)} 246)"><g class="wave-ransom" style="animation-delay:-${f(rnd(s+9)*3)}s"><path d="${shape}" fill="#000" opacity=".4" transform="translate(1 1.4)"/><path d="${shape}" fill="${bg}"/><text x="${f(cx)}" y="${f(246+cell*.36)}" text-anchor="middle" font-family="${font}" font-size="${f(cell*(.9+rnd(s+11)*.25))}" font-weight="${rnd(s+13)>.5?700:400}" fill="${ink}">${escape(letter)}</text></g></g>`;}).join('');
 return wrap(item,id,'#ffe14d44','',pieces);
}

function sprayTag(item,id,text){
 const n=[...text].length,size=sizeFor(n,.62,64),w=Math.min(232,n*size*.62),x0=150-w/2,name=escape(text),fit=n*size*.62>232?`textLength="232" lengthAdjust="spacingAndGlyphs"`:'';
 const t=attrs=>`<text x="150" y="262" text-anchor="middle" font-family="RoundMarker,sans-serif" font-size="${f(size)}" ${fit} ${attrs}>${name}</text>`;
 const drips=[.12,.34,.57,.83].map((p,k)=>`<path class="wave-tag-drip" d="M${f(x0+w*p-1.3)} 258V${f(268+k%2*7)}Q${f(x0+w*p)} ${f(272+k%2*7)} ${f(x0+w*p+1.3)} ${f(268+k%2*7)}V258Z" fill="#ff2d95" stroke="#1b1030" stroke-width=".7" style="animation-delay:-${k*1.4}s"/>`).join('');
 const speckle=Array.from({length:26},(_,k)=>`<circle cx="${f(x0-10+rnd(k)*(w+20))}" cy="${f(212+rnd(k+40)*62)}" r="${f(.3+rnd(k+80)*.9)}" fill="#ff5fae" opacity="${f(.3+rnd(k+120)*.5)}"/>`).join('');
 const cx=x0+size*.32,cy=262-size*.92;
 const defs=`<linearGradient id="${id}-paint" x2="0" y2="1"><stop offset=".1" stop-color="#ffe14d"/><stop offset=".55" stop-color="#ff6a3d"/><stop offset=".95" stop-color="#ff2d95"/></linearGradient><filter id="${id}-mist" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>`;
 return wrap(item,id,'#ff3d8b55',defs,`${t('fill="#ff3d8b" opacity=".5" filter="url(#'+id+'-mist)"')}${speckle}${t('fill="#1b1030" transform="translate(3 3)"')}${drips}${t(`fill="url(#${id}-paint)" stroke="#1b1030" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke"`)}${t('fill="none" stroke="#fff" stroke-width=".6" stroke-dasharray="3 9" opacity=".7" transform="translate(-.8 -1.2)"')}<path d="M${f(cx-9)} ${f(cy+6)}L${f(cx-10)} ${f(cy-4)} ${f(cx-4)} ${f(cy+1)} ${f(cx)} ${f(cy-7)} ${f(cx+4)} ${f(cy+1)} ${f(cx+10)} ${f(cy-4)} ${f(cx+9)} ${f(cy+6)}Z" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M${f(x0+w+6)} 222l2 -6M${f(x0+w+10)} 228l6 -2M${f(x0-8)} 270l-5 3" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>`);
}

function waxSeal(item,id,text){
 const n=[...text].length,size=sizeFor(n,.44,58,190),w=Math.min(190,n*size*.44),sx=Math.min(262,150+w/2-6),nx=sx-20-w/2,initial=escape(([...text][0]||'F').toUpperCase());
 const blob=Array.from({length:18},(_,k)=>{const a=k/18*Math.PI*2,r=17+(k%2?1.6:-.4)+rnd(k)*1.2;return `${f(sx+Math.cos(a)*r)} ${f(250+Math.sin(a)*r)}`;}).join('L');
 const defs=`<radialGradient id="${id}-wax" cx=".4" cy=".35" r=".7"><stop stop-color="#e2474e"/><stop offset=".6" stop-color="#b01d25"/><stop offset="1" stop-color="#6e0c10"/></radialGradient><clipPath id="${id}-seal"><path d="M${blob}Z"/></clipPath><linearGradient id="${id}-shine" x2="1"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
 const ribbon=(a)=>`<g transform="rotate(${a} ${f(sx)} 250)"><path d="M${f(sx-3)} 250H${f(sx+3)}V286L${f(sx)} 281 ${f(sx-3)} 286Z" fill="#d9b45a" stroke="#8a6a1c" stroke-width=".5"/></g>`;
 return wrap(item,id,'#ff9a5c33',defs,`<text x="${f(nx)}" y="262" text-anchor="middle" font-family="RoundAllura,cursive" font-size="${f(size)}" fill="#f1dfb2">${escape(text)}</text><path d="M${f(nx-w/2)} 270C${f(nx-w/4)} 276 ${f(nx+w/3)} 266 ${f(sx-18)} 268" fill="none" stroke="#e6d4af" stroke-width="1" stroke-linecap="round"/>${ribbon(18)}${ribbon(-22)}<path d="M${blob}Z" fill="#000" opacity=".35" transform="translate(1.2 1.8)"/><path d="M${blob}Z" fill="url(#${id}-wax)"/><circle cx="${f(sx)}" cy="250" r="11.5" fill="none" stroke="#6e0c10" stroke-width="1"/><circle cx="${f(sx-.5)}" cy="249.5" r="11.5" fill="none" stroke="#f0757a" stroke-width=".5" opacity=".6"/><text x="${f(sx-.6)}" y="255.4" text-anchor="middle" font-family="Georgia,serif" font-size="16" font-weight="700" fill="#f0757a" opacity=".7">${initial}</text><text x="${f(sx)}" y="256" text-anchor="middle" font-family="Georgia,serif" font-size="16" font-weight="700" fill="#7a0f14">${initial}</text><g clip-path="url(#${id}-seal)"><g class="wave-seal-glint"><rect x="${f(sx-40)}" y="225" width="12" height="50" fill="url(#${id}-shine)" transform="rotate(25 ${f(sx)} 250)"/></g></g>`);
}

const MORSE={A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..',0:'-----',1:'.----',2:'..---',3:'...--',4:'....-',5:'.....',6:'-....',7:'--...',8:'---..',9:'----.'};
function morseCode(item,id,text){
 const n=[...text].length,size=sizeFor(n,.78,28,240);
 let x=0;const marks=[];
 for(const c of text.toUpperCase()){const code=MORSE[c];if(!code){x+=7;continue;}for(const m of code){marks.push(m==='.'?`<circle cx="${x+2.1}" cy="0" r="2.1"/>`:`<rect x="${x}" y="-2.1" width="9" height="4.2" rx="2.1"/>`);x+=(m==='.'?4.2:9)+2.6;}x+=6;}
 const width=Math.max(1,x-8.6),scale=Math.min(1.7,240/width);
 return wrap(item,id,'#ffcf6e44','',`<text x="150" y="242" text-anchor="middle" font-family="RoundStencil,Impact,sans-serif" font-size="${f(size)}" letter-spacing="${f(size*.22)}" fill="#f0e1b8">${escape(text.toUpperCase())}</text><g transform="translate(${f(150-width*scale/2)} 264) scale(${f(scale)})" fill="#ffcf6e">${marks.join('')}</g><path d="M${f(150-width*scale/2-8)} 276H${f(150+width*scale/2+8)}" stroke="#ffcf6e" stroke-width=".6" opacity=".45"/><circle cx="${f(150-width*scale/2-8)}" cy="276" r="1.1" fill="#ffcf6e" opacity=".6"/><circle cx="${f(150+width*scale/2+8)}" cy="276" r="1.1" fill="#ffcf6e" opacity=".6"/>`);
}

function typewriter(item,id,text){
 const chars=[...text],size=sizeFor(chars.length,.6,34),adv=size*.6,x0=150-chars.length*adv/2;
 const keys=chars.map((c,i)=>`<text class="wave-key" x="${f(x0+i*adv+adv/2)}" y="${f(255+(rnd(i+3)-.5)*1.6)}" text-anchor="middle" font-family="RoundMono,monospace" font-size="${f(size)}" fill="#efe6d2" fill-opacity="${f(.78+rnd(i)*.22)}" style="animation-delay:${f(i*.14)}s">${escape(c)}</text>`).join('');
 return wrap(item,id,'#efe6d233','',`${keys}<rect class="wave-caret" x="${f(x0+chars.length*adv+2)}" y="${f(255-size*.72)}" width="${f(size*.42)}" height="${f(size*.86)}" fill="#efe6d2" opacity=".75" style="--typed:${f(chars.length*.14)}s"/><path class="wave-type-rule" d="M${f(x0)} ${f(262)}H${f(x0+chars.length*adv)}" stroke="#e2453c" stroke-width="1.6" stroke-dasharray="${f(adv*.8)} ${f(adv*.2)}" style="animation-delay:${f(chars.length*.14+.2)}s"/>`);
}

function constellation(item,id,text){
 const chars=[...text.toUpperCase()],n=chars.length,size=sizeFor(n,.78,48,230),cell=size*.78,x0=150-n*cell/2;
 const stars=chars.map((c,i)=>[x0+(i+.5)*cell,252-size*(c===' '?.4:i%2?.74:.08)+(rnd(i)-.5)*4]);
 const line=stars.map(([x,y],i)=>`${i?'L':'M'}${f(x)} ${f(y)}`).join('');
 const star=([x,y],i)=>`<g transform="translate(${f(x)} ${f(y)})"><g class="wave-twinkle" style="animation-delay:-${f(rnd(i+7)*3)}s"><circle r="5" fill="#9fc4ff" opacity=".45" filter="url(#${id}-glow)"/><path d="M0 -6.5L.9 -.9 6.5 0 .9 .9 0 6.5 -.9 .9 -6.5 0 -.9 -.9Z" fill="#fff"/><circle r="1.7" fill="#fff"/></g></g>`;
 const dust=Array.from({length:22},(_,k)=>`<circle class="wave-twinkle" cx="${f(x0-16+rnd(k+50)*(n*cell+32))}" cy="${f(208+rnd(k+90)*72)}" r="${f(.3+rnd(k+130)*.5)}" fill="#cfe3ff" style="animation-delay:-${f(rnd(k)*3)}s"/>`).join('');
 const defs=`<filter id="${id}-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.6"/></filter>`;
 return wrap(item,id,'#7fa8ff55',defs,`${dust}<text x="150" y="258" text-anchor="middle" font-family="Georgia,serif" font-size="${f(size)}" textLength="${f(n*cell)}" lengthAdjust="spacing" fill="#bcd4ff" opacity=".42">${escape(text.toUpperCase())}</text><path class="wave-star-line" d="${line}" pathLength="1" fill="none" stroke="#cfe3ff" stroke-width="1.1" stroke-linejoin="round" opacity=".9"/>${stars.map(star).join('')}`);
}

function varsityPatch(item,id,text){
 const n=[...text].length,size=sizeFor(n,.48,44,200),w=Math.min(200,n*size*.48)+44,h=50,x=150-w/2,y=222,fit=n*size*.48>200?'textLength="200" lengthAdjust="spacingAndGlyphs"':'';
 const name=attrs=>`<text x="150" y="${f(y+h/2+size*.32)}" text-anchor="middle" font-family="RoundCaveat,cursive" font-size="${f(size)}" font-weight="700" ${fit} ${attrs}>${escape(text)}</text>`;
 const star=sx=>`<path d="M${sx} ${y+h/2-5}L${sx+1.5} ${y+h/2-1.2} ${sx+5} ${y+h/2-1} ${sx+2.3} ${y+h/2+1.4} ${sx+3.2} ${y+h/2+5} ${sx} ${y+h/2+3} ${sx-3.2} ${y+h/2+5} ${sx-2.3} ${y+h/2+1.4} ${sx-5} ${y+h/2-1} ${sx-1.5} ${y+h/2-1.2}Z" fill="#d9a93a" stroke="#fff3c4" stroke-width=".3"/>`;
 const defs=`<pattern id="${id}-twill" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="2" fill="#1d2a4a"/><path d="M0 0V2" stroke="#2a3a63" stroke-width=".8"/></pattern><linearGradient id="${id}-thread" x2="0" y2="1"><stop stop-color="#ffe7a0"/><stop offset=".5" stop-color="#d9a93a"/><stop offset="1" stop-color="#a87a1e"/></linearGradient><pattern id="${id}-satin" width="1.3" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(62)"><path d="M.2 0V6" stroke="#fff6d0" stroke-width=".35" opacity=".55"/></pattern><clipPath id="${id}-name">${name('')}</clipPath><filter id="${id}-shadow" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>`;
 const shape=`M${f(x+h/2)} ${y}H${f(x+w-h/2)}A${h/2} ${h/2} 0 0 1 ${f(x+w-h/2)} ${y+h}H${f(x+h/2)}A${h/2} ${h/2} 0 0 1 ${f(x+h/2)} ${y}Z`;
 return wrap(item,id,'#d9a93a33',defs,`<path d="${shape}" fill="#000" opacity=".5" transform="translate(0 2)" filter="url(#${id}-shadow)"/><path d="${shape}" fill="url(#${id}-twill)"/><path d="${shape}" fill="none" stroke="#d9a93a" stroke-width="4.4" stroke-dasharray=".55 .45"/><path d="${shape}" fill="none" stroke="#7a5a14" stroke-width=".5" transform="translate(${f(w*.0)} 0)" opacity=".8"/>${star(f(x+h*.42))}${star(f(x+w-h*.42))}${name(`fill="url(#${id}-thread)" stroke="#5c4310" stroke-width=".7" paint-order="stroke"`)}<rect x="${f(x)}" y="${y}" width="${f(w)}" height="${h}" fill="url(#${id}-satin)" clip-path="url(#${id}-name)"/>`);
}

function barcode(item,id,text){
 const codes=[42,...[...text.toUpperCase()].map(c=>c.codePointAt(0)),42];
 let x=0;const bars=[];
 for(const [k,code] of codes.entries()){let bits=(code*2654435761+k*40503)>>>0;for(let i=0;i<9;i++){const wide=(bits>>i)&1,bw=wide?2.4:1;if(i%2===0)bars.push([x,bw]);x+=bw;}x+=1.4;}
 const scale=Math.min(1.6,168/x),bw=x*scale,bx=150-bw/2,size=Math.min(10,170/Math.max(1,[...text].length*.66+2));
 const defs=`<filter id="${id}-shadow" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="1.4"/></filter>`;
 return wrap(item,id,'transparent',defs,`<g transform="rotate(-3 150 244)"><rect x="${f(bx-14)}" y="211" width="${f(bw+28)}" height="64" rx="3" fill="#000" opacity=".45" filter="url(#${id}-shadow)" transform="translate(1 2)"/><rect x="${f(bx-14)}" y="211" width="${f(bw+28)}" height="64" rx="3" fill="#f6f2e6"/><path d="M${f(bx+bw+14)} 222L${f(bx+bw+3)} 211H${f(bx+bw+11)}Q${f(bx+bw+14)} 211 ${f(bx+bw+14)} 214Z" fill="#d9d2bd"/><text x="${f(bx-6)}" y="219.6" font-family="RoundMono,monospace" font-size="4.4" fill="#5a5448" letter-spacing=".3">AD2L · SCRIM LEAGUE · GRADE A</text><g fill="#111">${bars.map(([bx2,w])=>`<rect x="${f(bx+bx2*scale)}" y="223" width="${f(w*scale)}" height="32"/>`).join('')}</g><text x="150" y="267" text-anchor="middle" font-family="RoundMono,monospace" font-size="${f(size)}" font-weight="600" letter-spacing="${f(size*.25)}" fill="#111">*${escape(text.toUpperCase())}*</text><text x="${f(bx-9)}" y="255" font-family="RoundMono,monospace" font-size="5" fill="#111">0</text><text x="${f(bx+bw+4)}" y="255" font-family="RoundMono,monospace" font-size="5" fill="#111">74</text></g>`);
}

function sparkler(item,id,text){
 const n=[...text].length,size=sizeFor(n,.5,64),w=Math.min(232,n*size*.5),x0=150-w/2,fit=n*size*.5>232?'textLength="232" lengthAdjust="spacingAndGlyphs"':'',name=escape(text);
 const t=attrs=>`<text x="150" y="262" text-anchor="middle" font-family="RoundDafoe,cursive" font-size="${f(size)}" ${fit} ${attrs}>${name}</text>`;
 const sparks=Array.from({length:12},(_,k)=>{const a=k*30+rnd(k)*14,l=4+rnd(k+9)*6;return `<path d="M${f(Math.cos(a*Math.PI/180)*2)} ${f(Math.sin(a*Math.PI/180)*2)}L${f(Math.cos(a*Math.PI/180)*l)} ${f(Math.sin(a*Math.PI/180)*l)}" stroke="${k%3?'#fff4c4':'#ffb347'}" stroke-width=".7" stroke-linecap="round"/>`;}).join('');
 const embers=Array.from({length:14},(_,k)=>`<circle class="wave-ember" cx="${f(x0+rnd(k)*w)}" cy="${f(236+rnd(k+30)*30)}" r="${f(.4+rnd(k+60)*.7)}" fill="#ffcf6e" style="animation-delay:-${f(rnd(k+90)*2)}s"/>`).join('');
 const defs=`<linearGradient id="${id}-light" x2="0" y2="1"><stop stop-color="#fffdf2"/><stop offset=".6" stop-color="#ffe9a8"/><stop offset="1" stop-color="#ffb347"/></linearGradient><filter id="${id}-glow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="3"/></filter><filter id="${id}-hot" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.4"/></filter><clipPath id="${id}-reveal"><rect class="wave-spark-reveal" x="${f(x0-12)}" y="196" width="${f(w+24)}" height="96"/></clipPath>`;
 return wrap(item,id,'#ffcf6e66',defs,`<g clip-path="url(#${id}-reveal)" class="wave-spark-text">${t(`fill="#ffcf6e" opacity=".75" filter="url(#${id}-glow)"`)}${t(`fill="url(#${id}-light)"`)}${embers}</g><g class="wave-spark-head" style="--from:${f(x0-6)}px;--to:${f(x0+w+6)}px"><g class="wave-spark-bob"><circle r="5" fill="#ffcf6e" filter="url(#${id}-hot)"/><circle r="1.8" fill="#fff"/><g class="wave-spark-burst">${sparks}</g></g></g>`);
}

function liquidChrome(item,id,text){
 const n=[...text].length,size=sizeFor(n,.62,58),w=Math.min(232,n*size*.62),x0=150-w/2,fit=n*size*.62>232?'textLength="232" lengthAdjust="spacingAndGlyphs"':'',name=escape(text);
 const t=attrs=>`<text x="150" y="264" text-anchor="middle" font-family="RoundMarker,sans-serif" font-size="${f(size)}" ${fit} ${attrs}>${name}</text>`;
 const glint=(x,y,s,k)=>`<path class="wave-chrome-glint" d="M${f(x)} ${f(y-s)}Q${f(x)} ${f(y)} ${f(x+s)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y+s)}Q${f(x)} ${f(y)} ${f(x-s)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y-s)}Z" fill="#fff" style="animation-delay:-${k*.8}s"/>`;
 const defs=`<linearGradient id="${id}-chrome" x2="0" y2="1"><stop offset=".08" stop-color="#ffffff"/><stop offset=".4" stop-color="#b7d3f2"/><stop offset=".52" stop-color="#2b3f63"/><stop offset=".55" stop-color="#f1d9b5"/><stop offset=".78" stop-color="#fff6e8"/><stop offset="1" stop-color="#9aa9bf"/></linearGradient><linearGradient id="${id}-sweep" x2="1"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="${id}-letters">${t('')}</clipPath>`;
 return wrap(item,id,'#9fd0ff55',defs,`${t('fill="#000" opacity=".45" transform="translate(2.5 3.2)"')}${t('fill="#0c1a3a" stroke="#0c1a3a" stroke-width="7" stroke-linejoin="round"')}${t(`fill="url(#${id}-chrome)" stroke="#e8f2ff" stroke-width=".7" paint-order="stroke"`)}<g clip-path="url(#${id}-letters)"><g class="wave-chrome-sweep" style="--from:${f(x0-40)}px;--to:${f(x0+w+20)}px"><rect x="0" y="200" width="22" height="90" fill="url(#${id}-sweep)" transform="skewX(-20)"/></g></g>${glint(x0+4,264-size*.66,4.5,0)}${glint(x0+w-6,264-size*.3,3.5,1)}${glint(150,264-size*.8,3,2)}`);
}

const SIGNATURES={'ransom-note':ransomNote,'spray-tag':sprayTag,'wax-seal':waxSeal,'morse-code':morseCode,typewriter,constellation,'varsity-patch':varsityPatch,barcode,sparkler,'liquid-chrome':liquidChrome};
export const waveSignatureHtml=(item,text)=>SIGNATURES[item.id]?.(item,`wave-signature-${++serial}`,String(text||'Fav'))??'';
