import {normalizeSettings,EDITABLE_FINISHES,finishPlacement} from './cosmetics-expansion-settings.js';
const NS='http://www.w3.org/2000/svg';
const tower='M8 58V14h9v9h7V10h10v13h7V14h10v44Z';
const route='M24 13H276Q288 13 288 25V375Q288 387 276 387H24Q12 387 12 375V25Q12 13 24 13';
const add=(el,markup)=>el.insertAdjacentHTML('beforeend',markup);
function svgEl(tag,attrs){const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));return el;}
function editableWar(root,id,b){
  root.querySelectorAll(`path[d="${tower}"],path[d="M15 56V33h29v23ZM22 32V16h12v16"],circle[cx="28"][cy="41"]`).forEach(el=>el.remove());
  root.querySelectorAll('[id$="-lane"],.volley').forEach(el=>el.remove());
  add(root,`<defs><clipPath id="${id}-edge"><path d="M19 9H281Q292 9 292 21V379Q292 391 280 391H20Q8 391 8 379V21Q8 9 19 9ZM16 17V383H284V17Z" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#${id}-edge)">${Array.from({length:18},(_,n)=>`<circle class="v6-edge-particle" r="${n%3?.85:1.5}" fill="${n%2?'#b3f1e6':'#f4ddbb'}" style="offset-path:path('${route}');animation-delay:-${n*.7}s;--flight:${n%2?6:9}s"/>`).join('')}</g><g data-emblems></g>`);
}
function cloud(root,id,b,rift){
  const layer=root.querySelector('.v4-finish'),container=layer?.querySelector('g[mask] > g');if(!container)throw Error('Cloud effect layer missing');
  container.querySelectorAll('.leviathan,.rift').forEach(el=>el.remove());
  if(rift)container.querySelectorAll('.v4-spark').forEach(el=>el.remove());
  const colors=rift?['#ab96d2','#7daebf','#c1a9e0']:['#739dad','#8ec7cb','#a6ddd3'];
  add(layer.querySelector('defs'),`<filter id="${id}-vapor" x="-40%" y="-45%" width="180%" height="190%"><feTurbulence type="fractalNoise" baseFrequency=".022 .035" numOctaves="3" seed="${rift?12:7}" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="${b?23:18}" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="3.2"/></filter><radialGradient id="${id}-vapor-light"><stop stop-color="${colors[2]}" stop-opacity=".54"/><stop offset=".48" stop-color="${colors[0]}" stop-opacity=".24"/><stop offset="1" stop-color="${colors[1]}" stop-opacity="0"/></radialGradient>`);
  const cx=rift?151:149,cy=rift?164:167;
  if(rift){
    add(container,`<g class="exp-rift-dust">${Array.from({length:32},(_,n)=>{const x=cx+Math.sin(n*2.399)*Math.sqrt(n/32)*59,y=cy+Math.cos(n*2.399)*Math.sqrt(n/32)*109,r=n%7===0?1.5:n%3===0?.9:.5;return `<g class="exp-rift-mote" style="--drift:${7+n%6}s;--dx:${Math.sin(n)*9}px;--dy:${-9-n%11}px;animation-delay:-${n*.41}s"><circle cx="${x}" cy="${y}" r="${r}" fill="${n%3?'#c0cbe9':'#e2d0f1'}" opacity=".65"/>${n%7===0?`<path d="M${x-2.2} ${y}h4.4M${x} ${y-2.2}v4.4" fill="none" stroke="#d8dfef" stroke-width=".4" opacity=".65"/>`:''}</g>`;}).join('')}</g>`);
  }
  add(container,`<g class="v6-cloud" style="--cloud-cycle:${rift?11:16}s" filter="url(#${id}-vapor)">${Array.from({length:b?7:5},(_,n)=>{const x=cx+(rift?Math.sin(n*2.1)*15:(n-2)*28),y=cy+(rift?(n-2)*27:Math.sin(n*1.8)*17);return `<ellipse class="v6-wisp wisp-${n%3}" cx="${x}" cy="${y}" rx="${rift?30+n%3*4:54+n%2*12}" ry="${rift?42+n%2*9:31+n%3*7}" fill="url(#${id}-vapor-light)" opacity="${b?.68:.6}"/>`;}).join('')}</g><g class="v6-cloud-motes">${Array.from({length:rift?8:12},(_,n)=>`<circle cx="${cx+Math.sin(n*2.4)*(rift?23:82)}" cy="${cy+Math.cos(n*2.3)*(rift?85:39)}" r="${n%3?.6:1}" fill="${colors[2]}" opacity=".42" style="animation-delay:-${n*.6}s"/>`).join('')}</g>`);
}
export function applySettings(host,idea,raw){
  const s=normalizeSettings(idea.id,raw),root=host.querySelector('svg.design-preview');if(!root)return;

  if(EDITABLE_FINISHES.includes(idea.id.replace('finish-',''))){
    const layer=root.querySelector('.v4-finish'),group=layer?.querySelector('g[mask] > g');if(!group)return;
    const placement=finishPlacement(idea.id.replace('finish-',''),s);
    group.setAttribute('data-finish-transform','');group.setAttribute('transform',placement.transform);group.setAttribute('opacity',placement.opacity);
    if(idea.id==='finish-supernova'){
      const rings=group.querySelector('.nova-rings'),starCenter=rings.parentElement;
      [...starCenter.children].filter(e=>e.tagName.toLowerCase()==='circle').slice(1).forEach(e=>e.remove());
      starCenter.querySelector('[data-stars]')?.remove();const stars=svgEl('g',{'data-stars':''});
      for(let n=0;n<s.stars;n++)stars.append(svgEl('circle',{cx:Math.cos(n*2.4)*(35+n*3),cy:Math.sin(n*2.4)*(35+n*3),r:(n%3?.8:1.5)*s.starSize,fill:'#f3d0a6',class:'v6-star',style:`--twinkle:${4/s.starSpeed}s;animation-delay:-${n*.23}s`}));
      starCenter.append(stars);group.querySelectorAll('.v4-spark,[data-ejecta]').forEach(el=>el.remove());
      const ejecta=svgEl('g',{'data-ejecta':''});const routes=['M154 133C220 100 246 61 276 34','M154 133C101 122 68 202 32 269'];
      for(let n=0;n<s.burst;n++)ejecta.append(svgEl('circle',{r:(n%3?.8:1.5)*s.burstSize,fill:n%2?'#cbb7e8':'#f8d2a3',class:'v6-burst',style:`offset-path:path('${routes[n%2]}');--flight:${(n%2?7:6)/s.burstSpeed}s;animation-delay:-${n*.55}s`}));
      group.append(ejecta);
    }
  }
}

export {editableWar,cloud};
