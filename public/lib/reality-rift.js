// Reality tears open around the card's own edge: the jagged tear follows the frame inside the rim,
// the energy lives in the band between tear and frame, and the whole middle stays clear for the hero.
// All layers live inside the existing finish placement group.
const L=19,T=19,R=281,B=385,RAD=20;
const SIDES=[R-L-2*RAD,B-T-2*RAD],ARC=Math.PI*RAD/2,PERIM=2*SIDES[0]+2*SIDES[1]+4*ARC;
// A point on the rounded rectangle, u in [0,1), with its outward normal.
function edge(u){
 let d=(u%1+1)%1*PERIM;
 const runs=[[L+RAD,T,1,0,0,-1,SIDES[0]],[R-RAD,T+RAD,0,-90,0,0,ARC],[R,T+RAD,0,1,1,0,SIDES[1]],[R-RAD,B-RAD,0,0,0,0,ARC],[R-RAD,B,-1,0,0,1,SIDES[0]],[L+RAD,B-RAD,0,90,0,0,ARC],[L,B-RAD,0,-1,-1,0,SIDES[1]],[L+RAD,T+RAD,0,180,0,0,ARC]];
 for(const [x,y,dx,dy,nx,ny,len] of runs){
  if(d>len){d-=len;continue;}
  if(len===ARC){const a=(dy+d/ARC*90)*Math.PI/180;return [x+Math.cos(a)*RAD,y+Math.sin(a)*RAD,Math.cos(a),Math.sin(a)];}
  return [x+dx*d,y+dy*d,nx,ny];
 }
 return [L+RAD,T,0,-1];
}
// Alternate points bite in and push out; the bottom edge, under the name plate, bites less.
function torn(points,jag,seed,offset=0){
 return 'M'+Array.from({length:points},(_,n)=>{const [x,y,nx,ny]=edge(n/points),bite=(n%2?-jag:jag*.5)*(.5+.5*Math.abs(Math.sin(n*seed)))*(ny>.5?.45:1)+offset;return `${(x+nx*bite).toFixed(1)} ${(y+ny*bite).toFixed(1)}`;}).join('L')+'Z';
}
const p=(x,y)=>`${x.toFixed(1)} ${y.toFixed(1)}`;
export function upgradeRealityRift(root,id){
 const layer=root.querySelector('.v4-finish'),host=layer.querySelector('g[mask] > g');
 host.replaceChildren();
 // The tear sits on the frame, so it must not fade out under the name plate like the other finishes.
 layer.querySelector(`mask[id="${id}-coverage"] rect`)?.setAttribute('fill','white');
 const rim=torn(96,5,2.7),inner=torn(70,3.5,1.9,-3),frame='M8 9H292V391H8Z';
 layer.querySelector('defs').insertAdjacentHTML('beforeend',`<linearGradient id="${id}-rift-energy" x1="0" y1="0" x2=".75" y2="1"><stop stop-color="#89fff0"/><stop offset=".28" stop-color="#90b8ff"/><stop offset=".56" stop-color="#e88aff"/><stop offset=".8" stop-color="#a280ff"/><stop offset="1" stop-color="#9ffff1"/></linearGradient><filter id="${id}-rift-glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.6"/></filter><filter id="${id}-rift-haze" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7"/></filter>`);
 const energy=`url(#${id}-rift-energy)`;
 // Short forked cracks run a little way in from the tear, never far enough to reach the hero.
 const cracks=Array.from({length:22},(_,n)=>{const u=(n+.5*Math.sin(n*5))/22,[x,y,nx,ny]=edge(u),[tx,ty]=[-ny,nx],len=(ny>.5?3:9)+n%4*(ny>.5?1:3),a=[x-nx*4,y-ny*4],b=[a[0]-nx*len*.55+tx*3,a[1]-ny*len*.55+ty*3],c=[a[0]-nx*len-tx*2,a[1]-ny*len-ty*2],f=[b[0]-nx*len*.35+tx*5,b[1]-ny*len*.35+ty*5];
  return `<path class="exp-rift-crack" d="M${p(...a)}L${p(...b)}L${p(...c)}M${p(...b)}L${p(...f)}" style="animation-delay:-${(n*.53).toFixed(2)}s"/>`;}).join('');
 // Motes stream along the tear, and a few are sucked out of the frame into it.
 const pull=n=>{const u=n*.61803%1,[x,y,nx,ny]=edge(u),[x2,y2]=edge(u+.012);return `M${p(x+nx*9,y+ny*9)}Q${p(x+nx*3,y+ny*3)} ${p(x2-nx*4,y2-ny*4)}`;};
 const fragments=Array.from({length:12},(_,n)=>{const [x,y,nx,ny]=edge(n*.61803%1+.03);return `<g transform="translate(${p(x+nx*4,y+ny*4)}) rotate(${n*39})"><path class="exp-rift-fragment" d="M-2.4 -5.6L3.2 -1.6 .8 5.6 -1.6 2.4Z" style="animation-delay:-${(n*.63).toFixed(2)}s"/></g>`;}).join('');
 host.insertAdjacentHTML('beforeend',`<g class="exp-legendary-rift">
 <path d="${frame}${rim}" fill="${energy}" fill-rule="evenodd" opacity=".32" filter="url(#${id}-rift-haze)"/>
 <path d="${frame}${rim}" fill="#07040f" fill-rule="evenodd" opacity=".35"/>
 ${[0,1,2].map(n=>`<path class="exp-rift-ripple" d="${rim}" fill="none" stroke="${energy}" stroke-width="1" style="animation-delay:-${n*2}s"/>`).join('')}
 <g class="exp-rift-tear"><path d="${rim}" fill="none" stroke="${energy}" stroke-width="6" opacity=".6" filter="url(#${id}-rift-glow)"/><path d="${rim}" fill="none" stroke="${energy}" stroke-width="1.6"/><path d="${inner}" fill="none" stroke="#9effed" stroke-width=".6" stroke-dasharray="40 22 9 30" opacity=".5" class="exp-rift-edge"/><path class="exp-rift-edge" d="${rim}" fill="none" stroke="#e4ffff" stroke-width="1.2" stroke-dasharray="21 65 8 41"/></g>
 <g fill="none" stroke="${energy}" stroke-width=".8" stroke-linecap="round">${cracks}</g>
 <g class="exp-rift-dust">${Array.from({length:36},(_,n)=>`<g class="exp-rift-infall" style="offset-path:path('${n%3?pull(n):rim}');--infall:${n%3?2.4+n%5*.5:26+n%4*3}s;animation-delay:-${(n*.39).toFixed(2)}s"><path d="M-6 0H0" stroke="${n%2?'#b1fff1':'#e3afff'}" stroke-width=".7" opacity=".55"/><circle r="${n%6===0?1.3:.7}" fill="${n%2?'#b1fff1':'#e3afff'}"/></g>`).join('')}</g>
 <g fill="${energy}" stroke="#e9d8ff" stroke-width=".5">${fragments}</g>
 </g>`);
}
