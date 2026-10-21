// Dota borders in the Lane Creeps style: a 12-wide rim drawn as a piece of the map, pixel sprites that walk,
// fly or blink along it, and the set pieces (pit, shop, runes, camps) sitting in the corners.
// Shares the wave borders' frame and helpers; registered in their BORDERS map.
import {rnd,f,rim,SIDES,eachSide,mitres,keyline,frame,sprite,laneTower,ancient} from './cosmetics-wave-borders.js';
import {groupOf,groupPace} from './cosmetics-particle-groups.js';
const w=12,h=w/2;
const soft=id=>`<filter id="${id}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>`;
const walker=(cls,d,delay,pace,body,extra='')=>`<g class="${cls}" style="offset-path:path('${d}');animation-delay:-${f(delay)}s;${extra}${pace}">${body}</g>`;

// Little heroes: [rows, palette]. Sword, staff and bow, each in its own colours.
const HEROES=[
 [['..hhh..','..fff..','.AAAAAw','wAAAAAw','.AAAAA.','..L.L..'],{h:'#f2c94c',f:'#e8c19a',A:'#3b6fd8',w:'#d9dde2',L:'#2a2a3a'}],
 [['..ppp..','.pfffp.','.AAAAA.','sAAAAA.','sAAAAA.','s.L.L..'],{p:'#7a3fbf',f:'#e8c19a',A:'#9a5ae0',s:'#c8a05a',L:'#2a1a3a'}],
 [['..ggg..','..fff..','b.AAAA.','bAAAAA.','b.AAAA.','..L.L..'],{g:'#3a8a3a',f:'#e8c19a',A:'#4fae5a',b:'#8a5a2a',L:'#1e2a1a'}],
 [['.hhhhh.','..fff..','AAAAAAA','AAAAAAw','.AAAAA.','..L.L..'],{h:'#b0b8c0',f:'#e8c19a',A:'#e07a2a',w:'#d9dde2',L:'#3a2a1a'}],
 [['..rrr..','..fff..','.AAAAA.','wAAAAA.','.AAAAA.','..L.L..'],{r:'#e0453b',f:'#e8c19a',A:'#c0392b',w:'#d9dde2',L:'#2a1414'}],
];
const hero=(n,size=1.2)=>sprite(HEROES[n%HEROES.length][0],HEROES[n%HEROES.length][1],size);

// Roshan's Pit: two pits, top right and bottom left. The party walks the rim clockwise and clears them in turn:
// Roshan's health drains, he falls, the Aegis drops, and he respawns before they come back round. One 32s clock
// drives it all, with delays that scale with the border speed so the party and the pits never drift apart.
// Roshan's face, front on, sitting in his pit: a round dark head, ram horns curling down the sides, the gold gem
// on his crown, glowing eyes under a heavy brow, a snout and fangs.
const mirror=d=>`<path d="${d}"/><path d="${d}" transform="scale(-1 1)"/>`;
const ROSHAN=`<ellipse cy="5" rx="13" ry="5.4" fill="#242022" stroke="#0e0c0c" stroke-width=".5"/><g fill="#1c181a">${mirror('M-7.4 -1L-10.6 -.6L-8.4 1.4L-10.8 3L-7.4 3.6Z')}</g><path d="M-7.6 -2Q-8.2 -10.6 0 -10.6Q8.2 -10.6 7.6 -2Q7.6 4.2 0 5.6Q-7.6 4.2 -7.6 -2Z" fill="#45414a" stroke="#0e0c0c" stroke-width=".6"/><path d="M-6 -7.6Q0 -11 6 -7.6Q3 -9 0 -9Q-3 -9 -6 -7.6Z" fill="#6e6a72"/><g fill="#8e8882" stroke="#2a2626" stroke-width=".45">${mirror('M-4.6 -9.2Q-13.4 -10.4 -13.2 -2.4Q-13 3.8 -8 4Q-10.4 1 -10.2 -2.2Q-10 -6.6 -4.8 -6.4Z')}</g><g fill="none" stroke="#5a5450" stroke-width=".4">${mirror('M-8 -8.6Q-9.4 -7 -9.6 -5M-10.6 -7.4Q-11.6 -5.6 -11.2 -3.6M-11.8 -4.4Q-12.4 -1.4 -10.8 .6')}</g><circle cy="-8.2" r="4" fill="#ffd21a" opacity=".55" filter="url(#ID-soft)"/><circle cy="-8.2" r="2.2" fill="#ffd21a" stroke="#7a5a04" stroke-width=".4"/><circle cx="-.7" cy="-8.9" r=".7" fill="#fff6c0"/><path d="M-6.6 -5.4L0 -2.8L6.6 -5.4L6.2 -3.8L0 -1.4L-6.2 -3.8Z" fill="#161416"/><circle cy="-2.6" r="4.6" fill="#ffe21a" opacity=".25" filter="url(#ID-soft)"/><g fill="#ffe21a">${mirror('M-5.4 -3.4L-1.6 -2L-4.8 -1.4Z')}</g><ellipse cy="1.6" rx="4" ry="2.8" fill="#5e5a5e" stroke="#1e1c1e" stroke-width=".35"/><g fill="#0e0c0e">${mirror('M-1.6 .8a.8 .55 0 1 0 .01 0Z')}</g><path d="M-4 3.4Q0 5.8 4 3.4Q0 4.4 -4 3.4Z" fill="#0e0c0e"/><g fill="#f4ecd8" stroke="#6a6050" stroke-width=".25">${mirror('M-2.8 3.7L-2.3 6.6L-1.5 4Z')}</g>`;
// The Aegis: broad ragged petals, lit orange from the fire at the heart and dark at the tips.
const AEGIS_PETAL=[[0,-.1],[.42,-.34],[.52,-.68],[.32,-.92],[.18,-.8],[.06,-1],[-.2,-.86],[-.4,-.6],[-.3,-.3]];
const petals=(n,len,turn,id)=>Array.from({length:n},(_,k)=>`<path d="M${AEGIS_PETAL.map(([x,y])=>`${f(x*len)} ${f(y*len)}`).join('L')}Z" transform="rotate(${f(turn+k*360/n)})" fill="url(#${id}-petal)" stroke="#6e5a4e" stroke-width=".4" stroke-linejoin="round"/>`).join('');
// The pits in the order the party reaches them; [x, y, delay that lines the pit's clock up with the party's,
// direction the pit opens towards in degrees].
const PITS=[[268,31,-30.4,180],[32,369,-14.4,0]];
const slow=s=>`calc(${s}s / var(--border-speed,1))`;
function roshanPit(item,id,settings){
 const party=groupOf('border','roshan-pit',settings,'heroes'),lap=`M${8+h} ${9+h}H${292-h}V${391-h}H${8+h}Z`;
 const aegis=`<g transform="scale(.72)"><circle r="11" fill="#ff5a10" opacity=".55" filter="url(#${id}-soft)"/>${petals(7,13.5,0,id)}${petals(7,8.6,26,id)}<circle r="5" fill="url(#${id}-fire)"/></g>`;
 const heroes=Array.from({length:party.count},(_,n)=>`<g class="wave-raider" style="offset-path:path('${lap}');--lag:${f(2+n*2.1)}%;animation-delay:0s"><g class="wave-raider-swing" style="animation-delay:-${f(n*.13)}s;${groupPace('border',party.speed)}">${hero(n,f(1.25*party.size))}</g></g>`).join('');
 // The pit is a C of boulders round a glowing floor, open on the side the party walks in from. Rocks behind
 // Roshan are drawn before him, rocks in front after him.
 const boulder=(x,y,r,n)=>{const pts=Array.from({length:7},(_,j)=>{const a=j/7*Math.PI*2,q=r*(.75+rnd(n*7+j)*.4);return `${f(x+Math.cos(a)*q)} ${f(y+Math.sin(a)*q*.8)}`;});return `<path d="M${pts.join('L')}Z" fill="#4a5262" stroke="#14161c" stroke-width=".5" stroke-linejoin="round"/><path d="M${f(x-r*.6)} ${f(y-r*.2)}L${f(x-r*.1)} ${f(y-r*.65)}L${f(x+r*.5)} ${f(y-r*.35)}" fill="none" stroke="#7a8496" stroke-width=".7" stroke-linecap="round"/>`;};
 const rocks=(gap,k)=>Array.from({length:9},(_,j)=>{const a=(gap+52+j*32)*Math.PI/180;return {x:Math.cos(a)*25,y:Math.sin(a)*16,r:5.4+rnd(k*31+j)*2,n:k*31+j};});
 const pit=([x,y,start,gap],k)=>{const delay=`animation-delay:${slow(start)}`,ring=rocks(gap,k),wall=list=>list.map(b=>boulder(b.x,b.y,b.r,b.n)).join('');
  return `<g class="wave-rosh-pit" transform="translate(${x} ${y})"><ellipse cy="2" rx="30" ry="20" fill="#000" opacity=".55" filter="url(#${id}-soft)"/><ellipse cy="2" rx="23" ry="14" fill="#2a1a16"/><ellipse cy="2" rx="22" ry="13" fill="url(#${id}-lava)"/>${[[-14,6,-5,10],[5,9,14,4],[-4,-5,9,-8],[-16,-2,-9,-6]].map(([x1,y1,x2,y2])=>`<path d="M${x1} ${y1}L${f((x1+x2)/2+1)} ${f((y1+y2)/2-1)}L${x2} ${y2}" fill="none" stroke="#ffb040" stroke-width=".5" opacity=".8"/>`).join('')}${wall(ring.filter(b=>b.y<=0))}<g class="wave-rosh-alive" style="${delay}"><g transform="scale(.85)"><g class="wave-rosh-breathe">${ROSHAN.replaceAll('ID',id)}</g></g><g transform="translate(0 -13.5)"><rect x="-11" y="-1.4" width="22" height="2.8" fill="#1a1412" stroke="#000" stroke-width=".5"/><rect class="wave-rosh-hp" x="-10.5" y="-.9" width="21" height="1.8" fill="#5ec46b" style="${delay}"/></g></g>${wall(ring.filter(b=>b.y>0))}<g class="wave-rosh-hit" style="${delay}">${Array.from({length:5},(_,j)=>`<path d="M${f(-6+j*3)} -4L${f(-4+j*3)} -9" stroke="#fff3a0" stroke-width=".8" stroke-linecap="round"/>`).join('')}</g><circle class="wave-aegis-glow" r="9" fill="#ffb03a" fill-opacity=".55" filter="url(#${id}-soft)" style="${delay}"/><g class="wave-aegis" style="${delay}">${aegis}</g></g>`;};
 const defs=`${soft(id)}<radialGradient id="${id}-fire"><stop stop-color="#fffbe0"/><stop offset=".35" stop-color="#ffd04a"/><stop offset=".75" stop-color="#ff6a14"/><stop offset="1" stop-color="#ff4a00" stop-opacity="0"/></radialGradient><radialGradient id="${id}-petal" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="13.5"><stop offset=".3" stop-color="#ffc050"/><stop offset=".55" stop-color="#e8561a"/><stop offset=".8" stop-color="#4a3028"/><stop offset="1" stop-color="#241c1a"/></radialGradient><radialGradient id="${id}-lava"><stop stop-color="#ff8a2a"/><stop offset=".45" stop-color="#c8341a"/><stop offset="1" stop-color="#3a1410" stop-opacity="0"/></radialGradient><pattern id="${id}-bricks" width="12" height="6" patternUnits="userSpaceOnUse"><rect width="12" height="6" fill="#4a4440"/><path d="M0 .3H12M0 3.3H12M3 .3V3.3M9 3.3V6" stroke="#2a2420" stroke-width=".6"/><rect x=".6" y=".9" width="1.6" height=".5" fill="#6e6660"/><rect x="6.6" y="3.9" width="1.6" height=".5" fill="#6e6660"/></pattern>`;
 return frame(item,id,w,defs,`<g clip-path="url(#${id}-frame)"><rect x="8" y="9" width="284" height="382" fill="url(#${id}-bricks)"/><path d="${rim(.8)}" fill="none" stroke="#8a7a68" stroke-width="1.4"/><path d="${rim(w-.8)}" fill="none" stroke="#2a2420" stroke-width="1.4"/></g>${keyline(w,'#c9b98f',.35)}${PITS.map(pit).join('')}${heroes}`);
}

// Courier Run: the Radiant Ancient sits bottom left and the Dire Ancient top right, as in Lane Creeps. Couriers
// run out from their base along a lane to the far corner and back again. The bottom and left lanes are Radiant
// (green verges, sandy road), the top and right Dire (ash and scorched road), with two towers on each lane.
function courierRun(item,id,settings){
 const pack=groupOf('border','courier-run',settings,'couriers');
 // The donkey trots on two leg frames and faces right; it turns round at the corner for the run home.
 const body=['.........ee.','.........eH.','..ssSs..HkHn','.tsSSsBBHH..','.tBBBBBBBB..','..BbbbbbBb..'];
 const donkeyColours={e:'#4a3a2e',H:'#9a8a76',k:'#120c08',n:'#2a1e16',s:'#a0522d',S:'#e0b04a',t:'#3a2e24',B:'#7d6d5c',b:'#6a5a4a',L:'#4a3d32',h:'#1e1814'};
 const donkey=s=>`<g class="wave-trot-a">${sprite([...body,'..LL...LL...','.L..L.L..L..','.h..h.h..h..'],donkeyColours,s)}</g><g class="wave-trot-b">${sprite([...body,'..LL...LL...','..LL...LL...','..hh...hh...'],donkeyColours,s)}</g>`;
 const flyer=s=>`<g class="wave-flap">${sprite(['w.......w','ww.....ww','.wwBBBww.','..BBBBBh.','...BBB...'],{w:'#e8e0ff',B:'#6a8fd8',h:'#ffcf4d'},s)}</g>`;
 // [path from the base to the corner, faces left on the way out]: Radiant bottom, Dire top, Radiant left, Dire right.
 const lanes=[[`M34 ${391-h}H${292-h}`,0],[`M266 ${9+h}H${8+h}`,1],[`M${8+h} 358V${9+h}`,0],[`M${292-h} 42V${391-h}`,1]];
 const couriers=Array.from({length:pack.count},(_,n)=>{const [d,left]=lanes[n%4],air=(n>>1)%2,delay=f(n*2.3),out=left?'scaleX(-1)':'none',back=left?'none':'scaleX(-1)';
  return `<g class="wave-courier" style="offset-path:path('${d}');animation-delay:-${delay}s;--ferry:${air?9:14}s;${groupPace('border',pack.speed)}"><g class="wave-face" style="animation-delay:-${delay}s;--out:${out};--back:${back}"><g transform="translate(0 ${air?-6:0})"><ellipse cy="${air?9:5.6}" rx="5.4" ry="1.2" fill="#000" opacity="${air?.25:.4}"/>${air?flyer(f(1.2*pack.size)):`<g class="wave-creep-step">${donkey(f(.95*pack.size))}</g>`}</g></g></g>`;}).join('');
 const towers=[[95,9+h,'d'],[190,9+h,'d'],[292-h,130,'d'],[292-h,260,'d'],[200,391-h,'r'],[105,391-h,'r'],[8+h,260,'r'],[8+h,130,'r']].map(([x,y,t])=>laneTower(x,y,t)).join('');
 const defs=`${soft(id)}<linearGradient id="${id}-road" y1="1" x2="1" y2="0"><stop stop-color="#b09a6a"/><stop offset=".44" stop-color="#9a8a5e"/><stop offset=".56" stop-color="#6a4a42"/><stop offset="1" stop-color="#4e3430"/></linearGradient><pattern id="${id}-grass" width="7" height="5" patternUnits="userSpaceOnUse"><rect width="7" height="5" fill="#3e7a32"/><rect x="1" y="1" width="1" height="2" fill="#5ea84a"/><rect x="4.5" y="2.5" width="1" height="2" fill="#2e5e26"/></pattern><pattern id="${id}-ash" width="7" height="5" patternUnits="userSpaceOnUse"><rect width="7" height="5" fill="#3a2a2c"/><rect x="1" y="1" width="1" height="2" fill="#6a3a34"/><rect x="4.5" y="2.5" width="1" height="2" fill="#1e1416"/></pattern>`;
 const verge=eachSide((len,n)=>{const g=`url(#${id}-${n<2?'ash':'grass'})`;return `<rect width="${len}" height="2.4" fill="${g}"/><rect y="${w-2.4}" width="${len}" height="2.4" fill="${g}"/>${Array.from({length:Math.floor(len/9)},(_,k)=>`<rect x="${f(k*9+rnd(k+len)*5)}" y="${f(3.5+rnd(k*3+len)*5)}" width="1" height="1" fill="${n<2?'#2a1c1a':'#6a5a40'}"/>`).join('')}`;});
 return frame(item,id,w,defs,`<g clip-path="url(#${id}-frame)"><rect x="8" y="9" width="284" height="382" fill="url(#${id}-road)"/>${verge}</g>${keyline(w,'#c9b98f',.35)}${towers}${couriers}${ancient(id,8+h+5,391-h-8,'r')}${ancient(id,292-h-5,9+h+8,'d')}`);
}

// River Runes: the rim is the river. Six rune spots, one in each corner and one on each bank, cycle through the six
// power runes out of step, so every rune is showing somewhere at once.
// The six power runes are crystals, as in game: a red haste shard in an orange swirl, a blue double-damage cluster
// crackling with lightning, three gold illusion prisms, a dark violet invisibility crystal, a green regeneration
// slab wrapped in a vine and an orange arcane crystal with a ring round it.
// One faceted prism centred on (x, y): lit left face, darker right face, a pale cap and an outline.
const prism=(x,y,wd,ht,turn,[lit,body,dark],extra='')=>{const a=wd/2,t=-ht/2,b=ht/2,s=t+wd*.55,l=b-wd*.35;
 return `<g transform="translate(${f(x)} ${f(y)}) rotate(${turn})"${extra}><path d="M0 ${f(t)}L${f(a)} ${f(s)}L${f(a)} ${f(l)}L0 ${f(b)}L${f(-a)} ${f(l)}L${f(-a)} ${f(s)}Z" fill="${body}" stroke="${dark}" stroke-width=".45" stroke-linejoin="round"/><path d="M0 ${f(t)}L${f(-a)} ${f(s)}L${f(-a)} ${f(l)}L0 ${f(b)}Z" fill="${lit}" opacity=".85"/><path d="M0 ${f(t)}L${f(a)} ${f(s)}L0 ${f(s+wd*.25)}L${f(-a)} ${f(s)}Z" fill="#fff" opacity=".35"/><path d="M${f(-a*.5)} ${f(s+1)}V${f(l-1)}" stroke="#fff" stroke-width=".5" opacity=".6"/></g>`;};
const RUNES=()=>[
 ['#ff4d3d',`<ellipse rx="8" ry="2.4" transform="rotate(-18)" fill="none" stroke="#ff9a3a" stroke-width=".8" stroke-dasharray="10 4 6 5" opacity=".9"/>${prism(2.6,2.6,3.6,7,-35,['#ff8a6a','#e0301e','#6a0c06'])}${prism(-.6,-.4,6,13,12,['#ff8a6a','#e0301e','#6a0c06'])}<path d="M-7 1.6Q-2 4.6 6.6 .8" fill="none" stroke="#ffc46a" stroke-width=".8" stroke-linecap="round"/>`],
 ['#3d8bff',`${prism(-3.4,1.6,3,9,-28,['#d8f0ff','#5aa8ff','#123a8a'])}${prism(3.4,1.6,3,9,28,['#d8f0ff','#5aa8ff','#123a8a'])}${prism(0,-.6,4.2,14,0,['#e8f6ff','#7ab8ff','#123a8a'])}${prism(-1.6,4.2,2.4,5,-55,['#d8f0ff','#5aa8ff','#123a8a'])}${prism(1.8,4.4,2.4,5,50,['#d8f0ff','#5aa8ff','#123a8a'])}<path d="M-7 -4L-5 -2.4L-6.4 -1.2L-4.2 .4M6.6 -5L4.8 -3.4L6 -2.4L4 -.6M-1 -8.4L.6 -7L-.4 -6.2" fill="none" stroke="#e8f8ff" stroke-width=".55" stroke-linecap="round"/>`],
 ['#ffd34d',`${prism(-3.8,1.4,4,10,-6,['#fff2a0','#f2b81e','#7a4a04'])}${prism(3.8,1.4,4,10,6,['#fff2a0','#f2b81e','#7a4a04'])}${prism(0,-.4,4.6,13,0,['#fff6c0','#ffc62a','#7a4a04'])}`],
 ['#b07aff',`<g opacity=".85">${prism(0,0,6.6,13.4,-12,['#9a6ad8','#5a2a9a','#1e0a3a'])}</g>${[[-6,-3],[5.6,2],[-4.6,5],[4,-6]].map(([x,y])=>`<rect x="${x}" y="${y}" width=".9" height=".9" fill="#d8b8ff"/>`).join('')}`],
 ['#5ef06b',`${prism(0,0,7,14.4,0,['#b4ff9a','#3ad04a','#0e5a16'])}<path d="M-4.4 -5.6Q2 -4.4 3.8 -2.4Q-1 0 -4 .6Q2 2.4 4 4.4Q0 6.4 -3.4 6" fill="none" stroke="#5a4020" stroke-width=".9" stroke-linecap="round"/>${[[-5,-6.4,-30],[4.6,-2.6,40],[-4.8,.2,-20],[4.6,4.4,30],[-3.8,6.6,-40]].map(([x,y,r])=>`<ellipse cx="${x}" cy="${y}" rx="1.5" ry=".7" transform="rotate(${r} ${x} ${y})" fill="#4ab83a"/>`).join('')}`],
 ['#ff9a2a',`<path d="M-7.6 .4A7.6 2.2 0 0 1 7.6 -1.6" transform="rotate(-14)" fill="none" stroke="#ffb03a" stroke-width=".9" opacity=".7"/>${prism(0,0,5.6,12.6,10,['#ffd08a','#ff7a1a','#6a2a04'])}<path d="M7.6 -1.6A7.6 2.2 0 0 1 -7.6 .4" transform="rotate(-14)" fill="none" stroke="#ffd06a" stroke-width=".9"/>`],
];
function riverRunes(item,id,settings){
 const ripple=groupOf('border','river-runes',settings,'ripples');
 const rune=k=>([color,art],n)=>`<g class="wave-rune" style="animation-delay:${slow(-((n-k+6)%6)*2)}"><circle r="10" fill="${color}" opacity=".55" filter="url(#${id}-soft)"/>${art}</g>`;
 const power=([x,y],k)=>`<g transform="translate(${x} ${y})"><ellipse cy="8.6" rx="7" ry="2.4" fill="#2a2a30" stroke="#8a8a94" stroke-width=".6"/><g class="wave-rune-bob" style="animation-delay:-${f(k*.37)}s">${RUNES().map(rune(k)).join('')}</g></g>`;
 const ripples=`<g style="${groupPace('border',ripple.speed)}">${Array.from({length:ripple.count},(_,n)=>{const [x,y,a,len]=SIDES[n%4],t=f(20+rnd(n+500)*(len-40));return `<g transform="translate(${x} ${y}) rotate(${a}) translate(${t} ${f(3+rnd(n+530)*6)})"><ellipse class="wave-ripple" rx="${f(2.6*ripple.size)}" ry="${f(1.3*ripple.size)}" fill="none" stroke="#d8f4ff" stroke-width=".5" style="animation-delay:-${f(rnd(n+560)*3)}s"/></g>`;}).join('')}</g>`;
 const defs=`${soft(id)}${mitres(id,w)}<linearGradient id="${id}-water" x2="1" y2="1"><stop stop-color="#1e5a8a"/><stop offset=".5" stop-color="#2f84b8"/><stop offset="1" stop-color="#1a4a78"/></linearGradient>`;
 const banks=eachSide(len=>`<g clip-path="url(#${id}-mitre-${len})"><rect width="${len}" height="1.6" fill="#b8a77a"/><rect y="${w-1.6}" width="${len}" height="1.6" fill="#8a7a54"/>${Array.from({length:Math.floor(len/14)},(_,k)=>`<rect x="${f(k*14+rnd(k+len)*6)}" y="1.2" width="${f(2+rnd(k)*2)}" height="1" fill="#5a8a3a"/>`).join('')}</g>`);
 return frame(item,id,w,defs,`<g clip-path="url(#${id}-frame)"><rect x="8" y="9" width="284" height="382" fill="url(#${id}-water)"/>${[3.6,6.2,8.6].map((i,k)=>`<path class="wave-river-flow" d="${rim(i)}" fill="none" stroke="#bfe8ff" stroke-width=".55" stroke-dasharray="${[9,5,14][k]} ${[17,23,19][k]}" opacity=".7" style="animation-delay:-${k*1.3}s"/>`).join('')}${banks}${ripples}</g>${keyline(w,'#9ad8ff',.4)}${[[21,22],[279,22],[292-h,200],[279,378],[21,378],[8+h,200]].map(power).join('')}`);
}

// Ward Vision: night fog on the rim; wards go down one after another and light up the ground round them,
// while a Smoke of Deceit drifts past unseen.
function wardVision(item,id,settings){
 const pack=groupOf('border','ward-vision',settings,'wards'),track=rim(h),life=16;
 const observer=sprite(['.yyy.','yYeYy','.yyy.','..s..','..s..','.sss.'],{y:'#e8c840',Y:'#fff1a0',e:'#2a1a08',s:'#6a4a2a'},1.4);
 const sentry=sprite(['.bbb.','bBeBb','.bbb.','..s..','..s..','.sss.'],{b:'#3a8ad8',B:'#bfe4ff',e:'#0a1a2a',s:'#6a4a2a'},1.4);
 const spots=Array.from({length:pack.count},(_,n)=>({sentry:n%3===2,at:`offset-path:path('${track}');offset-distance:${f((n+.5)/pack.count*100)}%;offset-rotate:0deg;${groupPace('border',pack.speed)}`,delay:f(n*life/pack.count)}));
 const sights=spots.map(s=>`<circle class="wave-ward-sight" r="${s.sentry?16:24}" fill="url(#${id}-${s.sentry?'true':'sight'})" style="${s.at}animation-delay:-${s.delay}s"/>`).join('');
 const wards=spots.map(s=>`<g style="${s.at}"><g class="wave-ward" style="animation-delay:-${s.delay}s"><g transform="translate(0 -3)">${s.sentry?sentry:observer}</g></g></g>`).join('');
 const smoke=`<g class="wave-smoke" style="offset-path:path('${track}')">${[[-6,0,5],[0,-2,6],[6,1,4.5],[-1,3,4]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#8a6aa8" opacity=".55" filter="url(#${id}-puff)"/>`).join('')}<rect x="-3" y="-1" width="1.2" height="1.2" fill="#d8b0ff"/><rect x="2" y="-1" width="1.2" height="1.2" fill="#d8b0ff"/></g>`;
 const defs=`${soft(id)}<radialGradient id="${id}-sight"><stop stop-color="#f4ffc8" stop-opacity=".9"/><stop offset=".6" stop-color="#c8f090" stop-opacity=".45"/><stop offset="1" stop-color="#b8e880" stop-opacity="0"/></radialGradient><radialGradient id="${id}-true"><stop stop-color="#bfe4ff" stop-opacity=".85"/><stop offset="1" stop-color="#3a8ad8" stop-opacity="0"/></radialGradient><pattern id="${id}-night" width="8" height="6" patternUnits="userSpaceOnUse"><rect width="8" height="6" fill="#1a2620"/><rect x="1" y="1" width="1" height="2" fill="#2a3e30"/><rect x="5" y="3" width="1" height="2" fill="#24362a"/></pattern><filter id="${id}-fog" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .4 0 0 0 0 .45 0 0 0 0 .52 0 0 0 .55 -.28"/></filter><filter id="${id}-puff" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>`;
 return frame(item,id,w,defs,`<g clip-path="url(#${id}-frame)"><rect x="8" y="9" width="284" height="382" fill="url(#${id}-night)"/><rect class="wave-fog" x="8" y="9" width="284" height="382" fill="#fff" filter="url(#${id}-fog)"/>${sights}</g>${keyline(w,'#b8e880',.35)}${smoke}${wards}`);
}

// Jungle Stack: four neutral camps in the corners get pulled out along the rim at :53 and walk back, stacking up.
const NEUTRALS=[
 [['.e...e.','.KKKKK.','KKyKyKK','.KKKKK.','..K.K..'],{e:'#c88a4a',K:'#a0703a',y:'#ffd34d'}],
 [['..hh...','.hHHh..','..HH...','CCCCCCh','CCCCCC.','C.C..C.'],{h:'#d8b08a',H:'#e8c19a',C:'#8a5a3a'}],
 [['.r...r.','.SSSSS.','SSgSgSS','.SSSSS.','.S...S.'],{r:'#e8dcc0',S:'#6a3a7a',g:'#7dffb0'}],
 [['.....ee','GGGGGGG','GGGGGGy','G.G.G..'],{e:'#8a8a92',G:'#6a6a72',y:'#ffd34d'}],
];
function jungleStack(item,id,settings){
 const camp=groupOf('border','jungle-stack',settings,'neutrals');
 const tree=(x,y,s)=>`<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})"><rect x="-.6" y="1" width="1.2" height="2.4" fill="#4a3020"/><circle r="2.6" fill="#2e5e26"/><circle cx="-1.4" cy=".6" r="1.8" fill="#244a1e"/><circle cx="1" cy="-.8" r="1.5" fill="#4a8a3a"/></g>`;
 const canopy=eachSide(len=>Array.from({length:Math.floor(len/7)},(_,k)=>tree(k*7+rnd(k+len)*3,2.6+rnd(k*2+len)*5.4,.9+rnd(k*5+len)*.5)).join(''));
 const corners=[[24,24,1,0],[276,24,-1,0],[276,376,-1,1],[24,376,1,1]];
 const camps=corners.map(([x,y,dir,down],c)=>{const [rows,pal]=NEUTRALS[c];return `<g transform="translate(${x} ${y})"><circle class="wave-ancient-glow" r="12" fill="#ffd34d" opacity=".18" filter="url(#${id}-soft)"/><g class="wave-pull" style="--pull:${dir*44}px;animation-delay:-${f(c*.6)}s;${groupPace('border',camp.speed)}">${Array.from({length:camp.count},(_,k)=>`<g transform="translate(${f(((k%3)-1)*8*dir)} ${f((Math.floor(k/3)*7-2)*(down?-1:1))})"><g class="wave-creep-step" style="animation-delay:-${f(k*.15)}s">${sprite(rows,pal,f(1.4*camp.size))}</g></g>`).join('')}</g></g>`;}).join('');
 const clock=`<g transform="translate(150 ${9+h})"><rect x="-13" y="-5" width="26" height="10" rx="2" fill="#120e0a" stroke="#c9b98f" stroke-width=".6"/><text y="2.4" text-anchor="middle" font-family="RoundMono,monospace" font-size="7" font-weight="700" fill="#ffd34d">0<tspan class="wave-colon">:</tspan>53</text></g>`;
 const defs=`${soft(id)}<linearGradient id="${id}-floor" x2="1" y2="1"><stop stop-color="#1e3a1a"/><stop offset=".5" stop-color="#2a4a22"/><stop offset="1" stop-color="#1a3016"/></linearGradient>`;
 return frame(item,id,w,defs,`<g clip-path="url(#${id}-frame)"><rect x="8" y="9" width="284" height="382" fill="url(#${id}-floor)"/>${canopy}</g>${keyline(w,'#8fc45a',.35)}${camps}${clock}`);
}

export const DOTA_BORDERS={'roshan-pit':roshanPit,'courier-run':courierRun,'river-runes':riverRunes,'ward-vision':wardVision,'jungle-stack':jungleStack};
