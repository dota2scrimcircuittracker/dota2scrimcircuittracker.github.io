const add=(root,html)=>root.insertAdjacentHTML('beforeend',html);

export function tierBorderDetails(root,id,item,width){
 const clip=`url(#${id}-frame)`;
 if(['obsidian','mirror'].includes(item.id)){
  const mirror=item.id==='mirror';
  const facets=Array.from({length:18},(_,n)=>{const y=16+n*20;return [0,1].map(side=>{const x=side?292-width:8,points=`${x},${y} ${x+width},${y+7} ${x+width},${y+23} ${x},${y+16}`;
   const facetId=`${id}-facet-${n}-${side}`;
   return `<g class="tier-glass-facet" style="animation-delay:-${n*.43+side}s"><defs><clipPath id="${facetId}"><polygon points="${points}"/></clipPath></defs>${mirror?`<image href="/img/hero-art/invoker.webp" x="${x-50}" y="${y-50}" width="130" height="150" preserveAspectRatio="xMidYMid slice" clip-path="url(#${facetId})" opacity=".75"/>`:''}<polygon points="${points}" fill="${mirror?(n%2?'#b8defc':'#e5bce8'):(n%2?'#171223':'#665480')}" fill-opacity="${mirror?.22:.8}" stroke="${mirror?'#ecf6ff':'#ac86d2'}" stroke-width=".65"/><path d="M${x} ${y+16}L${x+width} ${y+7}" stroke="${mirror?'#fff':'#dab2ee'}" stroke-width=".85" opacity=".8"/></g>`;}).join('');}).join('');
  add(root,`<g clip-path="${clip}" class="tier-${item.id}-facets">${facets}${[0,1].map(bottom=>Array.from({length:9},(_,n)=>`<path d="M${14+n*30} ${bottom?391:9}l15 ${bottom?-width:width} 15 ${bottom?width:-width}" fill="none" stroke="${mirror?'#f0edff':'#be96dc'}" stroke-width=".8" opacity=".7"/>`).join('')).join('')}</g>`);
 }
 if(item.id==='circuit')add(root,`<g clip-path="${clip}">${Array.from({length:20},(_,n)=>{const side=n%2,x=side?288:12,y=30+Math.floor(n/2)*36;return `<g class="tier-circuit-node" style="animation-delay:-${n*.27}s"><path d="M${x} ${y-8}v16" stroke="#69e8c2" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="1.65" fill="#c6fff0"/></g>`;}).join('')}</g>`);
 if(item.id==='ancient-war'){
  // Opposing volleys stay on the frame; both fronts meet at the middle of each rail.
  const paths=['M12 13H288V387','M288 387H12V13'];
  add(root,`<g clip-path="${clip}">${paths.map((d,side)=>`<path d="${d}" fill="none" stroke="${side?'#ffb0a7':'#83fff0'}" stroke-width="1" opacity=".45"/>${Array.from({length:8},(_,n)=>`<g class="tier-war-volley" style="offset-path:path('${d}');animation-delay:-${n*.7}s;--volley-time:${side?6:5.6}s"><path d="M-9 0H0" stroke="${side?'#ffaf9f':'#9affea'}" stroke-width="1.4"/><circle r="1.2" fill="#fff2d0"/></g>`).join('')}`).join('')}${[0,1].map(side=>`<g transform="translate(${side?288:12} 200)"><g class="tier-war-impact" style="animation-delay:-${side*2.8}s"><circle r="5" fill="none" stroke="#fff0bd" stroke-width="1"/><path d="M-7 0H7M0 -7V7" stroke="#f7cda3" stroke-width=".8"/></g></g>`).join('')}</g>`);
 }
}
