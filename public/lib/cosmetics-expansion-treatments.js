import {finish,signature} from './cosmetics-expansion-assets.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const line=(d,color='#d9d1ad',width=1,extra='')=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const line3=(d,color,width=1,opacity=.3,extra='')=>line(d,color,width,`opacity="${opacity}" ${extra}`);
function sparkPath(path,n=6,color='#caede1',seconds=6){return Array.from({length:n},(_,k)=>`<circle class="v4-spark" r="${k%3===0?1.5:.8}" fill="${color}" opacity="${k%3===0?.85:.6}" style="offset-path:path('${path}');--flight:${seconds}s;animation-delay:-${k*.55}s"/>`).join('');}
export function signatureSVG(i,id,variant,name){
  const b=variant==='B';
  let markup=signature(i,id,name);
  // Retain every composition; tune its stroke weight, spacing, and motion only.
  if(i.id==='signature-bookplate')markup=markup.replaceAll('stroke-width="1.2"',`stroke-width="${b?.75:.65}"`);
  if(i.id==='signature-stacked'){
    markup=markup.replace('font-size="87"',`font-size="${b?84:80}"`).replace('x="171" y="237"',`x="${b?177:167}" y="${b?232:240}"`);
    if(b)markup=markup.replace('M108 250H237M108 257h77','M103 250H247M110 257h88');
  }
  if(i.id==='signature-tall'){
    markup=markup.replace('font-size="44"',`font-size="${b?42:44}"`).replace('M37 266h176l44 -17',b?'M55 266h158l28 -12':'M43 266h170l40 -16');
    if(b)markup=markup.replace(/textLength="([\d.]+)"/,(_,n)=>`textLength="${Math.min(214,Number(n)+10)}"`);
  }
  if(i.id==='signature-continuous')markup=markup.replaceAll('stroke-width="1.2"',`stroke-width="${b?.7:.8}"`).replace('letter-spacing="6"',`letter-spacing="${b?8:6}"`);
  if(i.id==='signature-negative'){
    markup=markup.replace('M23 231L253 205 276 259 44 277Z','M23 234L253 217 276 253 44 270Z');
    if(b)markup=markup.replace('d="M23 234L253 217 276 253 44 270Z"',`d="M23 234L253 217 276 253 44 270Z" filter="url(#${id}-swash-edge)"`);
  }
  if(i.id==='signature-draft'){
    markup=markup.replace('stroke-dasharray="7 3 1 3"',`stroke-dasharray="${b?'4 5':'5 4 1 4'}"`).replace('stroke-width="0.6"','stroke-width="0.35"');
    if(b)markup=markup.replace('M30 217H270M30 257H270M48 203V274M251 203V274','M30 257H270M48 218V274');
  }
  if(i.id==='signature-thread')markup=markup.replace('stroke-dasharray="3 2"',`stroke-dasharray="${b?'3.4 1.7':'2.1 1.3'}"`);
  if(i.id==='signature-thread')markup=markup.replace('stroke-width="3.6"',`stroke-width="${b?2.8:2.4}"`).replace('stroke-width="1.4"',`stroke-width="${b?1.3:1.15}"`);
  if(i.id==='signature-contour'){
    markup=markup.replaceAll('stroke-width="0.8"',`stroke-width="${b?.45:.55}"`);
    if(b){let n=0;markup=markup.replace(/<path d="M15 [^"]+"[^>]*\/>/g,m=>n++%2?'':m);}
  }
  if(b&&i.id==='signature-bookplate')markup+=line3('M89 273q59 -12 128 1','#dbcda8',.7,.75);
  if(b&&i.id==='signature-continuous')markup=markup.replace('M32 261Q86 249 137 259T253 257Q285 264 250 277L204 275','M42 261Q102 252 159 259T247 257Q264 263 238 269');
  if(b&&i.id==='signature-pixel')markup=markup.replace('M41 272h18v-5h24v5h28v-5h35v5h68l32 -14','M60 269h26v-4h32v4h91l25 -10');
  if(b&&i.id==='signature-pixel')markup=markup.replaceAll('height="5"','height="4.65"');
  if(i.id==='signature-ribbon')markup=markup.replaceAll('stroke-width="1.3"',`stroke-width="${b?.4:.65}"`).replace('stroke-width="4"',`stroke-width="${b?1.8:2.5}"`);
  const opacity=i.id==='signature-negative'?(b?.64:.76):b?.88:.95;
  return `<svg class="v3-signature-overlay ${b?'variant-b':'variant-a'}" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true" style="--ink-opacity:${opacity};--stroke-polish:${b?.75:.9}"><defs><filter id="${id}-swash-edge"><feGaussianBlur stdDeviation=".35"/></filter><linearGradient id="${id}-ribbon" x2=".2" y2="1"><stop stop-color="#ecdcba"/><stop offset=".45" stop-color="#c5d4cc"/><stop offset=".5" stop-color="#81979b"/><stop offset=".72" stop-color="#c4d4ce"/><stop offset="1" stop-color="#e6d1ae"/></linearGradient></defs><g opacity="${opacity}">${markup}</g></svg>`;
}

export function restoredFinish(i,id,b,hero){
  let art=finish(i,id,hero),extra='';
  if(i.id==='finish-etched')art=art.replaceAll('stroke-width="1.2"',`stroke-width="${b?.9:1.1}" stroke-opacity="${b?.22:.28}"`).replace('opacity=".20"',`opacity="${b?.22:.17}"`);
  if(i.id==='finish-oil-slick')art=art.replace('opacity=".65"',`class="v4-oil" opacity="${b?.5:.42}"`);
  if(i.id==='finish-shattered-time')art=art.replace('class="time-shard"',`class="time-shard" opacity="${b?.5:.38}"`).replace('opacity=".7"',`opacity="${b?.18:.24}"`);
  if(i.id==='finish-supernova'){
    // Keep the original 14px core, 38/57/79px rings and all 24 sparks.
    art=`<g opacity="${b?.8:.72}">${art}</g>`;
    if(b)extra=sparkPath('M154 133C220 100 246 61 276 34',8,'#f8d2a3',6)+sparkPath('M154 133C101 122 68 202 32 269',7,'#cbb7e8',7);
  }
  if(i.id==='finish-deep-sea'){
    art=art.replace('opacity=".43"',`opacity="${b?.18:.12}"`).replace('class="leviathan"',`class="leviathan" opacity="${b?.68:.58}"`).replace('fill="#081a2b"','fill="#081a2b" fill-opacity=".62"');
    if(b)extra=sparkPath('M44 290C78 230 100 130 161 44',10,'#a0e6dd',11);
  }
  if(i.id==='finish-reality-rift'){
    art=art.replace('fill="#12142c"',`fill="#12142c" fill-opacity="${b?.4:.32}"`).replace('stroke-width="1.5"',`stroke-width="1.5" stroke-opacity="${b?.6:.48}"`).replaceAll('stroke-width=".7"',`stroke-width=".7" stroke-opacity="${b?.7:.55}"`);
    if(b)extra=sparkPath('M148 219L151 151 154 124',6,'#c6ddeb',4.6);
  }
  return `<svg class="v3-finish-overlay v4-finish" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="${id}-soft"><feGaussianBlur stdDeviation=".7"/></filter><filter id="${id}-feather"><feGaussianBlur stdDeviation="${b?1:.65}"/></filter><clipPath id="${id}-shard"><path d="M111 27L79 159 158 200 135 318H270V258L186 180 222 27Z"/></clipPath><radialGradient id="${id}-star"><stop stop-color="#fff2ca" stop-opacity=".9"/><stop offset=".3" stop-color="#edbf8a" stop-opacity=".75"/><stop offset="1" stop-color="#d296ab" stop-opacity="0"/></radialGradient><linearGradient id="${id}-fade" x2="0" y2="1"><stop stop-color="white"/><stop offset=".57" stop-color="white"/><stop offset=".76" stop-color="white" stop-opacity="0"/></linearGradient><mask id="${id}-coverage"><rect width="300" height="400" fill="url(#${id}-fade)"/></mask></defs><g mask="url(#${id}-coverage)"><g transform="translate(-37.5 -33.75) scale(1.25)"><g filter="url(#${id}-feather)">${art}</g>${extra}</g></g></svg>`;
}
export function restoredSignature(i,id,b,name){
  let art=signature(i,id,name);
  if(i.id==='signature-stacked'){
    const first=esc([...name][0]||'F'),rest=esc([...name].slice(1).join('')),width=Math.min(145,Math.max(28,([...name].length-1)*16)),start=(300-width-45)/2;
    art=`<text x="${start}" y="${b?246:250}" fill="#f1e0ba" font-family="RoundDafoe" font-size="82">${first}</text><text x="${start+43}" y="${b?267:263}" fill="#f1e0ba" font-family="RoundCaveat" font-size="35" textLength="${width}" lengthAdjust="spacingAndGlyphs">${rest}</text>${line(`M${start+40} 275Q170 ${b?281:276} ${start+width+48} 273`,'#e6d4af',1.1)}`;
  }
  if(i.id==='signature-continuous'){
    const flourish=b?'M32 263C68 242 132 284 198 266C234 255 259 245 269 256C279 275 216 290 161 276C131 269 163 250 214 258L268 263':'M31 263C84 246 131 278 193 264C238 249 272 252 264 270C254 288 195 285 163 273C144 264 185 256 235 264';
    art=art.replace('M32 261Q86 249 137 259T253 257Q285 264 250 277L204 275',flourish)+`<path class="v4-flourish-trace" d="${flourish}" fill="none" stroke="#fff1ca" stroke-width="1.5" stroke-dasharray="18 850" opacity=".85"/>`;
  }
  if(i.id==='signature-thread'){
    art=art.replace('stroke-dasharray="3 2"',`class="v4-sewing" stroke-dasharray="${b?'3.2 1.8':'2.5 2'}"`);
    art+=sparkPath('M43 266Q96 257 149 266T254 265',b?2:1,'#fff0c9',b?5:7);
  }
  return `<svg class="v3-signature-overlay v4-signature ${i.id==='signature-fold'?'v4-fold':''}" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true" style="--fold-angle:${b?-4:-6}deg;--fold-scale:${b?.89:.83};--fold-cycle:${b?10:8}s"><g opacity=".94">${art}</g></svg>`;
}
