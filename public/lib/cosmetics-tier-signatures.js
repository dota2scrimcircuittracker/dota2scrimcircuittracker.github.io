const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Keep the entire word's stagger within one short beat, even for long player names.
const stagger=(n,count)=>(n*.45/Math.max(1,count-1)).toFixed(3);
export function tierSignatureArt(art,item,id,name){
 if(['draft','contour'].includes(item.id))return art.replace(/textLength="([\d.]+)"/g,(_,n)=>`textLength="${Math.max(130,Number(n))}"`).replaceAll('stroke-width=".8"','stroke-width="1.1"').replaceAll('stroke-width="0.35"','stroke-width="0.65"');
 if(!['marquee','engraver','ribbon','afterimage','assembly','fold'].includes(item.id))return art;
 const safe=esc(name),upper=esc(name.toUpperCase());
 // Letters keep their own shapes and spacing: stretching a short name to a minimum width smears script joins
 // and spreads capitals apart. Only a long name is squeezed to fit.
 const script=['ribbon','afterimage'].includes(item.id),fit=[...name].length*(script?26:30)>210?'textLength="210" lengthAdjust="spacingAndGlyphs"':'';
 const text=(attrs='',content=safe)=>`<text x="150" y="255" text-anchor="middle" ${fit} ${attrs}>${content}</text>`;
 const foil=`${id}-tier-foil`,letters=`${id}-tier-letters`;
 let defs=`<linearGradient id="${foil}" x1="0" y1="0" x2=".65" y2="1"><stop stop-color="#fff0c4"/><stop offset=".3" stop-color="#c2e1db"/><stop offset=".52" stop-color="#f9e4b6"/><stop offset=".7" stop-color="#b0a3c9"/><stop offset="1" stop-color="#f5db9f"/></linearGradient>`,body='';
 if(item.id==='marquee')body=text('font-family="RoundStencil,sans-serif" font-size="56" fill="#192033" stroke="#ae805c" stroke-width="3"',upper)+text('font-family="RoundStencil,sans-serif" font-size="56" fill="none" stroke="#ffe2a0" stroke-width=".7"',upper)+text('class="marquee tier-marquee-lights" font-family="RoundStencil,sans-serif" font-size="56" fill="none" stroke="#fff3c5" stroke-width="1.8" stroke-dasharray="1 4"',upper);
 if(item.id==='engraver'){
  const attrs='font-family="Georgia,serif" font-size="46" font-style="italic" font-weight="bold"';
  defs+=`<pattern id="${id}-tier-hatch" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M-1 4L4 -1M2 6L6 2" stroke="#f6deb1" stroke-width="1"/></pattern><clipPath id="${letters}">${text(attrs,upper)}</clipPath>`;
  body=text(`${attrs} fill="#494038" stroke="#f3dfb2" stroke-width=".9"`,upper)+text(`${attrs} fill="url(#${id}-tier-hatch)"`,upper)+`<g clip-path="url(#${letters})"><path class="tier-signature-glint" d="M-15 195L35 285" stroke="#fff8dc" stroke-width="17" opacity=".7"/></g><path d="M42 267H257M56 273H226" stroke="#d8c495" stroke-width="1.2"/>`;
 }
 if(item.id==='ribbon'){
  const attrs='font-family="RoundDafoe,cursive" font-size="64"';
  defs+=`<clipPath id="${letters}">${text(attrs)}</clipPath>`;
  body=`<g transform="translate(3 4)">${text(`${attrs} fill="#263548" stroke="#0f1929" stroke-width="3"`)}</g>`+text(`${attrs} fill="url(#${foil})" stroke="#fff0ca" stroke-width=".7"`)+`<g clip-path="url(#${letters})"><path d="M75 205L98 266M122 205L143 266M169 205L191 266M215 205L236 266" stroke="#57506b" stroke-width="3" opacity=".5"/><path class="tier-signature-glint" d="M-15 195L35 285" stroke="#fff5d6" stroke-width="13" opacity=".65"/></g><path d="M55 275L70 265H239L225 275Z" fill="url(#${foil})"/><path d="M55 275V268L70 265M225 275L239 265V273" fill="#6f7186" stroke="#d9c6a5" stroke-width=".6"/>`;
 }
 if(item.id==='afterimage'){
  body=[3,2,1].map((n)=>`<g class="tier-signature-echo" style="--echo:${n};animation-delay:-${n*.45}s">${text(`font-family="RoundDafoe,cursive" font-size="62" fill="none" stroke="${['','#a2fff0','#c8adff','#f5c792'][n]}" stroke-width="${1+n*.25}" opacity="${.8-n*.13}"`)}</g>`).join('')+text(`font-family="RoundDafoe,cursive" font-size="62" fill="url(#${foil})" stroke="#fff1c8" stroke-width=".4"`)+`<path class="tier-echo-trace" d="M52 272Q129 252 245 267" fill="none" stroke="#bcfff0" stroke-width="1.2" stroke-dasharray="24 180"/>`;
 }
 if(item.id==='assembly'){
  const glyphs=[...name.toUpperCase()],span=Math.min(210,Math.max(130,glyphs.length*28)),unit=span/Math.max(1,glyphs.length);
  body=glyphs.map((c,n)=>`<g transform="translate(${150-span/2+n*unit} 0)"><g class="tier-assembly-letter" style="--assembly-x:${n%2?14:-14}px;--assembly-y:${n%2?-18:18}px;--assembly-turn:${n%2?18:-18}deg;animation-delay:${stagger(n,glyphs.length)}s"><text x="${unit/2}" y="255" text-anchor="middle" textLength="${unit*.85}" lengthAdjust="spacingAndGlyphs" font-family="RoundStencil,sans-serif" font-size="45" fill="url(#${foil})" stroke="#f1e9cb" stroke-width=".4">${esc(c)}</text></g></g>`).join('')+`<path class="tier-assembly-register" d="M37 218V208H51M249 208H263V218M37 263V273H51M249 273H263V263M43 268H258" fill="none" stroke="#a1ddd1" stroke-width=".9"/>`;
 }
 if(item.id==='fold'){
  const glyphs=[...name.toUpperCase()],span=Math.min(210,Math.max(130,glyphs.length*27)),unit=span/Math.max(1,glyphs.length);
  body=glyphs.map((c,n)=>{const clip=`${letters}-${n}`,attrs=`x="${unit/2}" y="255" text-anchor="middle" textLength="${unit*.88}" lengthAdjust="spacingAndGlyphs" font-family="RoundStencil,sans-serif" font-size="48"`;return `<g transform="translate(${150-span/2+n*unit} 0)"><defs><clipPath id="${clip}"><text ${attrs}>${esc(c)}</text></clipPath></defs><g class="tier-fold-letter" style="transform-origin:${unit/2}px 235px;animation-delay:${stagger(n,glyphs.length)}s"><text ${attrs} fill="url(#${foil})" stroke="#f1e4bb" stroke-width=".5">${esc(c)}</text><g clip-path="url(#${clip})"><path d="M0 205L${unit} 260H0Z" fill="#5c6b82" opacity=".35"/><path d="M0 205L${unit} 260" stroke="#fff9dc" stroke-width="1"/></g></g></g>`;}).join('')+`<path d="M48 276H254" fill="none" stroke="#e9ddbd" stroke-width="1.3" stroke-linecap="round"/><path class="tier-fold-crease" d="M48 276L63 270H241L254 276" fill="none" stroke="#a9d5ce" stroke-width=".8"/>`;
 }
 return `<svg class="tier-signature tier-signature-${item.id}" viewBox="0 0 300 400" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;
}
