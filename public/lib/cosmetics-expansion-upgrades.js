// Card-native ornaments and transparent atmosphere. All motion respects border speed.
const add=(root,markup)=>root.insertAdjacentHTML('beforeend',markup);
const line=(d,color,width,extra='')=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const orbit='M316 203a166 43 0 1 1 -332 0a166 43 0 1 1 332 0';
const perimeter='M24 13H276Q288 13 288 25V375Q288 387 276 387H24Q12 387 12 375V25Q12 13 24 13';

// A 540px square covers the card's 500px diagonal at every rotation. The old
// 1800x2200 surface wasted raster work even though only the narrow rim is visible.
export function borderFlowBounds(serpent=false){
 return serpent?{x:-360,y:-440,width:660,height:840}:{x:-120,y:-70,width:540,height:540};
}

export function renderOuroboros(root,id){
 for(const child of [...root.children])if(child.tagName.toLowerCase()!=='defs')child.remove();
 const body='M86 12C134 10.7 202 13.3 257 12C278 11.4 289 23 289 44C287.8 122 290.3 205 289 278C288.2 306 289.7 331 289 355C289.6 377 278.5 388.8 258 388C186 386.7 110 389.3 43 388C21 388.5 11 376 11.5 355C13 285 10 211 11.5 142C12.2 106 11.1 73 11.5 42';
 const head='M7 96C7.3 72 6.2 36 12.7 23C18.1 12.2 27 6.8 37.4 8C45.5 8.6 54 12 59.5 17L56.5 23.5C50.5 29.3 41.3 30.7 32 26.8C23 32.4 18.2 49.7 16 96';
 add(root,`<defs><linearGradient id="${id}-skin" x2="1" y2=".5"><stop stop-color="#a2ad78"/><stop offset=".24" stop-color="#668259"/><stop offset=".62" stop-color="#345c43"/><stop offset="1" stop-color="#9aab75"/></linearGradient><linearGradient id="${id}-head" x2=".75" y2="1"><stop stop-color="#b8c18f"/><stop offset=".35" stop-color="#739665"/><stop offset="1" stop-color="#31533d"/></linearGradient><linearGradient id="${id}-tail-color" x2="0" y2="1"><stop stop-color="#d0ca8c"/><stop offset=".48" stop-color="#9bad70"/><stop offset="1" stop-color="#526b46"/></linearGradient><pattern id="${id}-head-scales" width="8" height="7" patternUnits="userSpaceOnUse">${line('M0 0Q4 5 8 0M-4 3.5Q0 8.5 4 3.5Q8 8.5 12 3.5','#c4cc95',.5)}</pattern><clipPath id="${id}-head-clip"><path d="${head}Z"/></clipPath></defs><g class="exp-serpent"><path d="${body}" fill="none" stroke="#203d2e" stroke-width="8.5"/><path data-snake-body d="${body}" fill="none" stroke="url(#${id}-skin)" stroke-width="6.5"/><g data-scales></g><g data-snake-head-skin mask="url(#${id}-neck-blend)"><path d="${head}Z" fill="url(#${id}-head)"/><path d="${head}" fill="none" stroke="#aab887" stroke-width=".65"/><g clip-path="url(#${id}-head-clip)"><rect x="5" y="5" width="58" height="70" fill="url(#${id}-head-scales)" opacity=".48"/></g><path d="M17 65C17 45 21 33 31 25L39 27C26 36 24 49 23 60Z" fill="#bed09a" opacity=".38"/>
 <g clip-path="url(#${id}-head-clip)" fill="none" stroke-linecap="round">
 ${line('M9.4 68C9 48 10 33 17.5 23Q25 11 35 10.5','#dbe2b0',1.1,'opacity=".42"')}
 ${line('M15.2 66C17 46 20.5 33 31.5 25.2','#263f30',1.5,'opacity=".45"')}
 ${['M20 20L23 14 29 12 30 17 26 22Z','M17 23L23 23 24.5 28 20 32 15.5 30Z','M13.5 33L19.5 34 18 40 12 42 10.5 38Z','M10.5 45L16.8 43 15.5 49 9.5 52Z','M9.2 55L14.5 52 13.5 58 8.8 62Z'].map(d=>`<path d="${d}" fill="#789867" fill-opacity=".65" stroke="#c0cb94" stroke-opacity=".55" stroke-width=".55"/>`).join('')}
 <path d="M29 10L34 9.5 35.7 13 32.5 17 28.5 16Z" fill="#afbd86" stroke="#d1d5a3" stroke-width=".45"/>
 </g></g>
 <path data-snake-mouth d="M35 20.6Q46.5 15.3 59 17.5L58 24Q47.5 28.6 35.5 25Z" fill="#15281e"/>
 <path data-snake-tail d="M86 7.35C74 7.35 69 11.4 62.5 16.4C58.5 19.6 54.3 21.5 45.5 23.1C55.5 24.6 61.5 22.7 66.7 19.5C73 16.65 77.5 16.65 86 16.65Z" fill="url(#${id}-tail-color)" stroke="#b4be83" stroke-width=".45"/>
 ${line('M81 9.1l.5 5.6M75 9.9l1.4 5.8M69.7 11.9l2 5.2M65 15.1l2.1 3.9M60.9 18.1l1.6 3.3M56.5 20.5l.7 2.5','#4f6948',.55,'opacity=".65"')}
 ${line('M83 10C72 10.3 68 13.7 62 18.4Q55 23 47 23','#e4dfac',.65,'opacity=".6"')}
 <path data-upper-jaw d="M33.5 17Q39.5 12.2 47 13.8Q54.6 14.1 59.5 17L58.2 19.8Q53.8 18 49 18.4Q42.5 18.2 36 22Z" fill="url(#${id}-head)" stroke="#adbd86" stroke-width=".55"/>
 <path data-lower-jaw d="M35 24Q47.5 27.5 58 22.5L58.5 24.8Q48 31 36.5 26.7Z" fill="#97ab78" stroke="#486846" stroke-width=".55"/>
 ${line('M38 26Q49 28.8 56 25.5','#d6d9a9',.65,'opacity=".7"')}
 <path d="M51 18.6L51.6 21.1Q52.4 20.5 52.7 18.7M56 19.2L56.4 20.7 57.3 19.5" fill="#e8e6bd" stroke="#667856" stroke-width=".25"/>
 <path d="M33 14Q37 10.1 42 12L43.5 15.4Q38.5 17.8 34.5 16Z" fill="#38583c" opacity=".7"/>
 <ellipse cx="38.7" cy="13.7" rx="2.6" ry="1.9" fill="#cdb66a" stroke="#294531" stroke-width=".6"/><ellipse cx="39.1" cy="13.7" rx=".6" ry="1.65" fill="#14291b"/><circle class="exp-serpent-eye" cx="38.2" cy="13.1" r=".45" fill="#fff3c1"/>${line('M33 12.6Q38 9.1 43.5 12.6','#d2d6a3',.85)}${line('M44 14.5L48 16 52 15.9','#b9c695',.55,'opacity=".8"')}<ellipse cx="55.4" cy="16.5" rx=".8" ry=".5" fill="#284430"/>
 <path class="exp-serpent-sheen" d="${body}" fill="none" stroke="#f5e2a6" stroke-width="1.35" stroke-dasharray="30 1372" opacity=".65"/>${Array.from({length:30},(_,n)=>`<g class="exp-serpent-spark" style="offset-path:path('${body}');offset-distance:${n/30*100}%;animation-delay:-${n*.76}s">${n%4===0?'<path d="M-2 0H2M0 -2V2" stroke="#fff1bd" stroke-width=".55"/>':''}<circle r="${n%4?.65:1}" fill="${n%2?'#efdc9f':'#a9dbbc'}"/></g>`).join('')}</g>`);
 add(root,`<defs><linearGradient id="${id}-body-round" gradientUnits="userSpaceOnUse" x1="0" y1="-4.7" x2="0" y2="4.7"><stop stop-color="#476647"/><stop offset=".2" stop-color="#90ac79"/><stop offset=".4" stop-color="#b4c391"/><stop offset=".66" stop-color="#819e6e"/><stop offset="1" stop-color="#3b5b40"/></linearGradient><linearGradient id="${id}-scale-skin" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#aec18c"/><stop offset=".4" stop-color="#8ca974"/><stop offset="1" stop-color="#5b7c52"/></linearGradient><linearGradient id="${id}-neck-fade" gradientUnits="userSpaceOnUse" x1="0" y1="56" x2="0" y2="96"><stop stop-color="white"/><stop offset=".2" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><mask id="${id}-neck-blend" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="400"><rect width="300" height="400" fill="url(#${id}-neck-fade)"/></mask><mask id="${id}-body-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="400"><path d="${body}" fill="none" stroke="white" stroke-width="11" stroke-linecap="round"/></mask></defs>`);
 const track=root.querySelector('[data-snake-body]'),scales=root.querySelector('[data-scales]'),length=track.getTotalLength();
 track.setAttribute('stroke-width','11');track.previousElementSibling.setAttribute('stroke-width','12.8');
 scales.setAttribute('mask',`url(#${id}-body-mask)`);
 // Rounded overlapping shields and the head's soft dorsal highlight run through every corner.
 for(let at=0;at<length;at+=6.4){const p=track.getPointAtLength(at),q=track.getPointAtLength(Math.min(at+1,length)),angle=Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI;add(scales,`<g transform="translate(${p.x} ${p.y}) rotate(${angle}) scale(1.18)"><path d="M-4 -5H4V5H-4Z" fill="url(#${id}-body-round)"/><g fill="url(#${id}-scale-skin)" stroke="#4c6a48" stroke-width=".35"><path d="M-3.3 0Q-1.7 -2.1 2.6 -1.5Q3.3 0 2.6 1.5Q-1.7 2.1 -3.3 0Z"/><path d="M-2.8 -3.5Q-1.6 -4.6 2 -4L3 -2.7Q0 -1.2 -2.8 -3.5Z" opacity=".65"/><path d="M-2.8 3.5Q-1.6 4.6 2 4L3 2.7Q0 1.2 -2.8 3.5Z" opacity=".7"/></g>${line('M-2.4 -.2Q-.5 -1.7 2 -1.2','#d4dcb0',.5,'opacity=".55"')}</g>`);}
 // Emerald and gold skin in place of the original sage, a dorsal pattern that slides toward the head,
 // and a glowing eye, so the serpent reads as alive and swallowing its own tail.
 const skin={'#a2ad78':'#d9bf55','#668259':'#1f8a5b','#345c43':'#0f4a36','#9aab75':'#d4b955','#b8c18f':'#e3d17a','#739665':'#2a9a66','#31533d':'#0e3d2c','#d0ca8c':'#ecd47e','#9bad70':'#3aa772','#526b46':'#165c40','#476647':'#0c3d2b','#90ac79':'#2a9e68','#b4c391':'#e9cf6a','#819e6e':'#1f7d55','#3b5b40':'#0a3222','#aec18c':'#e8d47c','#8ca974':'#3fb27a','#5b7c52':'#17684a','#4c6a48':'#0d3b2a','#203d2e':'#05211a','#c4cc95':'#f0dd8a','#aab887':'#e6cf74','#bed09a':'#b8f0b0','#97ab78':'#d8c46a','#cdb66a':'#ff7a3d','#c0cb94':'#ecd47e','#789867':'#2a9a66'};
 const serpent=root.querySelector('.exp-serpent');
 serpent.innerHTML=serpent.innerHTML.replace(/#[0-9a-f]{6}/gi,c=>skin[c.toLowerCase()]??c);
 root.querySelectorAll('defs').forEach(defs=>{defs.innerHTML=defs.innerHTML.replace(/#[0-9a-f]{6}/gi,c=>skin[c.toLowerCase()]??c);});
 serpent.querySelector('[data-scales]').insertAdjacentHTML('afterend',`<path class="exp-serpent-slither" d="${body}" fill="none" stroke="#06261c" stroke-width="3.4" stroke-dasharray="5 7" stroke-linecap="round" opacity=".55" mask="url(#${id}-body-mask)"/>`);
 serpent.querySelector('.exp-serpent-eye')?.insertAdjacentHTML('beforebegin','<circle class="exp-serpent-eye-glow" cx="38.9" cy="13.7" r="5.5" fill="#ff8a3d" opacity=".7" style="filter:blur(1.8px)"/>');
}

export function upgradeHorizon(root,id){
 root.classList.add('exp-horizon');
 root.querySelectorAll('.accretion-back,.accretion-front,ellipse').forEach(el=>el.remove());
 add(root,`<defs><radialGradient id="${id}-nebula"><stop stop-color="#d1bde7" stop-opacity=".34"/><stop offset=".32" stop-color="#a69bdb" stop-opacity=".21"/><stop offset=".66" stop-color="#91c7d5" stop-opacity=".08"/><stop offset="1" stop-color="#beb4e5" stop-opacity="0"/></radialGradient><radialGradient id="${id}-warm-vapor"><stop stop-color="#f0cda3" stop-opacity=".3"/><stop offset=".4" stop-color="#d6b1c6" stop-opacity=".15"/><stop offset="1" stop-color="#c5a1da" stop-opacity="0"/></radialGradient><filter id="${id}-vapor" x="-35%" y="-60%" width="170%" height="220%"><feTurbulence type="fractalNoise" baseFrequency=".035 .065" numOctaves="3" seed="19" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="13" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="1.35"/></filter><filter id="${id}-filament"><feGaussianBlur stdDeviation="1.1"/></filter></defs>
 <g class="exp-horizon-plane" transform="rotate(-24 150 203)"><g filter="url(#${id}-vapor)">${Array.from({length:30},(_,n)=>`<ellipse class="exp-horizon-vapor" cx="0" cy="0" rx="${22+n%5*3}" ry="${7+n%4*2}" fill="url(#${id}-${n%3?'nebula':'warm-vapor'})" style="offset-path:path('${orbit}');offset-distance:${n/30*100}%;--orbit-cycle:${22+n%5*2}s;animation-delay:-${n*1.03}s;--vapor-scale:${.8+n%4*.13}"/>`).join('')}</g>
 <g filter="url(#${id}-filament)">${Array.from({length:12},(_,n)=>{const a=n*Math.PI/6,x=150+166*Math.cos(a),y=203+43*Math.sin(a),x2=150+166*Math.cos(a+.29),y2=203+43*Math.sin(a+.29);return line(`M${x} ${y}Q${150+171*Math.cos(a+.14)} ${203+46*Math.sin(a+.14)} ${x2} ${y2}`,n%2?'#c5c0ec':'#e9c6a2',2+n%3,'class="exp-horizon-filament" opacity=".12" style="animation-delay:-'+n*.63+'s"');}).join('')}</g>
 ${Array.from({length:54},(_,n)=>`<g class="exp-horizon-dust" style="offset-path:path('${orbit}');offset-distance:${n/54*100}%;--orbit-cycle:${16+n%7*2}s;animation-delay:-${n*.57}s"><circle cy="${Math.sin(n*2.39)*7}" r="${n%8?.45+n%3*.15:1.05}" fill="${n%3?'#cdd6e8':'#f1d8ae'}" opacity=".68"/>${n%13===0?'<path d="M-2 0H2M0 -2V2" stroke="#f1e7d0" stroke-width=".45" opacity=".6"/>':''}</g>`).join('')}</g>`);
 // Loose plumes escape the orbit rather than forming a second solid ring.
 add(root,`<g transform="rotate(-24 150 203)" filter="url(#${id}-vapor)">${Array.from({length:18},(_,n)=>{const a=n*2.39996,x=150+161*Math.cos(a),y=203+43*Math.sin(a);return `<g transform="translate(${x} ${y}) rotate(${a*180/Math.PI+90})"><g class="exp-horizon-plume" style="--wisp-drift:${n%2?16:-13}px;animation-delay:-${n*.83}s;--wisp-time:${8+n%5}s"><ellipse cx="0" cy="${n%3*4}" rx="${17+n%4*5}" ry="${15+n%5*3}" fill="url(#${id}-${n%4?'nebula':'warm-vapor'})" opacity=".85"/><path d="M-26 0C-7 -22 13 23 34 1S62 -19 69 -10" fill="none" stroke="${n%3?'#bab7e8':'#e4c3c3'}" stroke-width="${2+n%3}" opacity=".13"/></g></g>`;}).join('')}</g>`);
}

export function polishBorder(root,id,width,{mirror=false,animated=false,rare=false,tint='#d4e8de'}={}){
 const ring=`M19 9H281Q292 9 292 21V379Q292 391 280 391H20Q8 391 8 379V21Q8 9 19 9ZM${8+width} ${9+width}V${391-width}H${292-width}V${9+width}Z`;
 add(root,`<defs><clipPath id="${id}-polish-ring"><path d="${ring}" clip-rule="evenodd"/></clipPath><linearGradient id="${id}-polish"><stop stop-color="#fff7d9" stop-opacity="0"/><stop offset=".34" stop-color="${rare?tint:mirror?'#e6f5ff':'#fff3c9'}" stop-opacity="${rare?.12:.02}"/><stop offset=".5" stop-color="#fffcec" stop-opacity="${rare?.62:mirror?.55:.23}"/><stop offset=".57" stop-color="${tint}" stop-opacity="${rare?.22:.05}"/><stop offset="1" stop-color="#d7c4b6" stop-opacity="0"/></linearGradient></defs><g clip-path="url(#${id}-polish-ring)"><rect class="${animated?'exp-border-gloss':'exp-border-luster'}" x="-180" y="-40" width="160" height="500" fill="url(#${id}-polish)" transform="rotate(-18 150 200)"/></g>`);
 if(rare){
  root.classList.add('exp-rare-polish');
  add(root,`<defs><linearGradient id="${id}-rare-luster" x2=".75" y2="1"><stop stop-color="#fff6dd" stop-opacity=".42"/><stop offset=".27" stop-color="${tint}" stop-opacity=".08"/><stop offset=".56" stop-color="#fff" stop-opacity=".32"/><stop offset=".8" stop-color="${tint}" stop-opacity=".06"/><stop offset="1" stop-color="#fff7e4" stop-opacity=".3"/></linearGradient></defs><path class="exp-rare-rim" d="${perimeter}" fill="none" stroke="url(#${id}-rare-luster)" stroke-width="1" clip-path="url(#${id}-polish-ring)"/>`);
 }
 if(mirror){
  root.classList.add('exp-mirror');
  root.querySelectorAll('g[clip-path] > g').forEach((g,n)=>{g.classList.add('exp-mirror-facet');g.style.animationDelay=`-${n*.61}s`;});
  add(root,`<g clip-path="url(#${id}-polish-ring)"><path class="exp-mirror-runner" d="${perimeter}" fill="none" stroke="#e2f7fb" stroke-width="1.6" stroke-dasharray="20 1300" opacity=".8"/>${Array.from({length:22},(_,n)=>`<g class="exp-mirror-spark" style="offset-path:path('${perimeter}');offset-distance:${n/22*100}%;animation-delay:-${n*.71}s"><path d="M-2 0H2M0 -2V2" stroke="#e3e7ff" stroke-width=".6"/><circle r=".55" fill="#fff6e1"/></g>`).join('')}</g>`);
 }
}

// Moving light stays inside the authored material. Never tint the hero or add a solid overlay.
export function borderColorFlow(root,id,width,kind){
 const palettes={
  'ancient-war':['#f3c79e','#4fe0c9','#fff1c2','#ed738f','#f3c79e'],
  'event-horizon':['#db8eff','#61dcea','#ffd18b','#8877ef','#db8eff'],
  ouroboros:['#e0d57d','#60cdaa','#fff1aa','#79a9d3','#e0d57d'],
  'hammered-bronze':['#dc994b','#ffe4a0','#ab614f','#eabf72','#dc994b'],
  obsidian:['#653c99','#eaa0c9','#697ce0','#b78ae7','#653c99'],
  circuit:['#48ddb8','#8dc8ff','#edb76e','#9b8ce6','#48ddb8'],
  malachite:['#43c7a0','#a4edcf','#e3b369','#438eaa','#43c7a0'],
  mirror:['#92e7f4','#e8b6ff','#fff1c4','#9aabf3','#92e7f4'],
  'brushed-tin':['#98b6d5','#edf3ff','#b6a6d1','#99d1ce','#98b6d5'],
  'dusty-rose':['#d99ab5','#f5d6b6','#b59ad6','#e3b2c9','#d99ab5'],
  naval:['#657da8','#d6e3ea','#89b6c1','#afa9cb','#657da8'],
 };
 const colors=palettes[kind];if(!colors)return;
 root.classList.add('exp-color-flow');
 const serpent=kind==='ouroboros',clip=serpent?`${id}-serpent-light`:`${id}-flow-ring`;
 const ring=`M19 9H281Q292 9 292 21V379Q292 391 280 391H20Q8 391 8 379V21Q8 9 19 9ZM${8+width} ${9+width}V${391-width}H${292-width}V${9+width}Z`;
 const body=root.querySelector('[data-snake-body]')?.getAttribute('d'),head=root.querySelector('[id$="-head-clip"] path')?.getAttribute('d');
 add(root,`<defs><linearGradient id="${id}-flow-colors" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="360" y2="440" spreadMethod="repeat">${colors.map((c,n)=>`<stop offset="${n/4}" stop-color="${c}"/>`).join('')}</linearGradient>${serpent?`<mask id="${clip}" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="400"><path d="${body}" fill="none" stroke="white" stroke-width="9.3"/><path d="${head}" fill="white"/></mask>`:`<clipPath id="${clip}"><path d="${ring}" clip-rule="evenodd"/></clipPath>`}</defs>`);
 const subtle=['brushed-tin','dusty-rose','naval'].includes(kind);
 const rare=['hammered-bronze','obsidian','circuit','malachite'].includes(kind);
 const epic=['mirror'].includes(kind);
 const bounds=borderFlowBounds(serpent);
 const light=`<g class="exp-spectrum-coating" ${serpent?'mask':'clip-path'}="url(#${clip})" opacity="${serpent?.42:rare?.28:epic?.38:subtle?.32:.58}"><g class="${serpent?'exp-spectrum-drift':'exp-spectrum-turn'}"><rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="url(#${id}-flow-colors)"/></g></g>`;
 // Keep the face, jaws and tail on top of the lighting layer.
 if(serpent)root.querySelector('[data-snake-mouth]').insertAdjacentHTML('beforebegin',light);else add(root,light);
 if(!serpent)add(root,`<path class="exp-spectrum-runner" d="${perimeter}" fill="none" stroke="url(#${id}-flow-colors)" stroke-width="${kind==='ancient-war'?3:2}" stroke-dasharray="85 160 26 220" opacity=".72" clip-path="url(#${clip})"/>`);
}
