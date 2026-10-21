// Signature details that give single borders their own identity on top of the house style.
// Everything stays inside the rim band. Details that run along a side stop short of the corners, where each
// design already has its own corner piece.
const add=(root,markup)=>root.insertAdjacentHTML('beforeend',markup);
// A rounded rectangle inset from the card's outer edge: inset w/2 runs down the middle of the rim.
const rimPath=inset=>{const l=8+inset,t=9+inset,r=292-inset,b=391-inset,q=Math.max(2,11-inset);return `M${l+q} ${t}H${r-q}Q${r} ${t} ${r} ${t+q}V${b-q}Q${r} ${b} ${r-q} ${b}H${l+q}Q${l} ${b} ${l} ${b-q}V${t+q}Q${l} ${t} ${l+q} ${t}Z`;};
const along=(d,n,count,extra='')=>`offset-path:path('${d}');offset-distance:${(n/count*100).toFixed(2)}%;${extra}`;
// The four straight runs of the rim at an inset, each stopping gx/gy short of the corners: top, right, bottom, left.
const runs=(inset,gx,gy)=>[`M${8+gx} ${9+inset}H${292-gx}`,`M${292-inset} ${9+gy}V${391-gy}`,`M${292-gx} ${391-inset}H${8+gx}`,`M${8+inset} ${391-gy}V${9+gy}`];
// count marks spread over the runs in proportion to their length.
const spread=(paths,count,mark)=>{const len=d=>{const [a,b]=d.slice(1).split(/[HV]/);return Math.abs(Number(b)-Number(d.includes('H')?a.split(' ')[0]:a.split(' ')[1]));},total=paths.reduce((t,d)=>t+len(d),0);let n=0;return paths.flatMap(d=>{const k=Math.round(count*len(d)/total);return Array.from({length:k},(_,i)=>mark(d,(i+.5)/k*100,n++));}).join('');};

export function borderSignature(root,id,w,item){
 const mid=rimPath(w/2),clip=`clip-path="url(#${id}-frame)"`;
 if(item.id==='circuit'){
  // Green solder mask under two copper traces with pads and vias; signal packets race both ways and the corner LEDs blink.
  const trace=rimPath(w-1.6),edge=rimPath(1.4);
  const pads=Array.from({length:32},(_,n)=>n%3?`<circle r="1.25" fill="#e8b06a" stroke="#ffe0a8" stroke-width=".35" style="${along(trace,n,32)}"/>`:`<circle r="1.1" fill="#0b3a27" stroke="#e8b06a" stroke-width=".7" style="${along(edge,n,32)}"/>`).join('');
  const packet=(d,n,count,color,reverse)=>`<g class="sig-packet${reverse?' reverse':''}" style="${along(d,0,1,`animation-delay:-${(n/count*7).toFixed(2)}s`)}"><path d="M-14 0H0" stroke="${color}" stroke-width="1.4" opacity=".55"/><circle r="1.7" fill="${color}"/></g>`;
  add(root,`<g ${clip}><rect x="8" y="9" width="284" height="382" fill="#0d4f36" opacity=".72"/><g fill="none" stroke="#e8b06a" stroke-linecap="round"><path d="${mid}" stroke-width=".8"/><path d="${trace}" stroke-width=".6" opacity=".9"/><path d="${edge}" stroke-width=".5" opacity=".7"/></g>${pads}<g class="sig-packets">${Array.from({length:4},(_,n)=>packet(mid,n,4,'#7dfff0',false)).join('')}${Array.from({length:3},(_,n)=>packet(trace,n,3,'#c4ff7a',true)).join('')}</g></g>
  ${[[8+w/2+6,9+w/2+6],[292-w/2-6,9+w/2+6],[292-w/2-6,391-w/2-6],[8+w/2+6,391-w/2-6]].map(([x,y],n)=>`<circle class="sig-led" cx="${x}" cy="${y}" r="1.8" fill="${n%2?'#ff5f6d':'#7dfff0'}" style="animation-delay:-${n*.7}s"/>`).join('')}`);
 }
}
