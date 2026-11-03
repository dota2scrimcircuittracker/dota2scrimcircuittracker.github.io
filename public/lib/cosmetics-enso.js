// The Enso commission, from the cream and red Enso brush logo: a border, a finish and a team signature.
// The border carries the logo mark (img/cosmetics/enso-ink.webp, cut from the logo); the team signature
// brushes ENSO out of fine hairs, with the player's name small underneath. The wave renderers look these up by id at draw time.
import {rnd,f,eachSide,mitres,keyline,frame} from './cosmetics-wave-borders.js';
import {layer,placed,readable} from './cosmetics-wave-finishes.js';
import {wrap,sizeFor,escape} from './cosmetics-wave-signatures.js';

// Bump ?v when the mark is recut, so cards don't keep the old image.
const MARK='/img/cosmetics/enso-ink.webp?v=2';
const W=14;
const polar=(cx,cy,r,a)=>`${f(cx+Math.cos(a*Math.PI/180)*r)} ${f(cy+Math.sin(a*Math.PI/180)*r)}`;
const arc=(cx,cy,r,a0,a1)=>`M${polar(cx,cy,r,a0)}A${r} ${r} 0 ${a1-a0>180?1:0} 1 ${polar(cx,cy,r,a1)}`;
const rimDefs=(id,top,bottom)=>`${mitres(id,W)}<linearGradient id="${id}-rim" x2="0" y2="1"><stop stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;
const band=(id,body)=>`<g clip-path="url(#${id}-frame)">${eachSide((len,n)=>`<g clip-path="url(#${id}-mitre-${len})"><rect width="${len}" height="${W}" fill="url(#${id}-rim)"/>${body(len,n)}</g>`)}</g>`;
// A corner medallion holding a logo mark.
const medallion=(cx,cy,r,ring,mark)=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#0b0c10" stroke="${ring}" stroke-opacity=".55" stroke-width=".8"/>${mark(cx-r+2.5,cy-r+2.5,(r-2.5)*2)}`;
const image=(href,x,y,w,h=w,extra='')=>`<image href="${href}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" preserveAspectRatio="xMidYMid meet" ${extra}/>`;
// A mask that paints a round area in with one thick ensō stroke, holds, fades and paints again.
const paintMask=(id,cx,cy,r,cls)=>`<mask id="${id}" maskUnits="userSpaceOnUse" x="${f(cx-r*1.4)}" y="${f(cy-r*1.4)}" width="${f(r*2.8)}" height="${f(r*2.8)}"><path class="${cls}" pathLength="1" d="${arc(cx,cy,r*.62,-90,268)}" fill="none" stroke="#fff" stroke-width="${f(r*1.3)}" stroke-linecap="round"/></mask>`;

// Brush hairs, as in the Enso swoop logos: thin strands that wander across the band (x along the side, y inward)
// and cross each other, broken where the brush ran dry, shaded along the side by a paint gradient. Where a
// stroke starts or ends inside a side (from > 0, to < 1) its hairs converge to a point, as one brush stroke does.
const strands=(len,{paint,from=0,to=1,count,seed})=>Array.from({length:count},(_,k)=>{
 const s=seed+k*13,y0=.8+(k+rnd(s)*.6)/count*(W-1.6),amp=.6+rnd(s+1)*1.6,waves=1+rnd(s+2)*2.5,phase=rnd(s+3)*6.28;
 const a=from*len+rnd(s+4)*4,b=to*len-rnd(s+5)*4,tipA=from>0?len*(.12+rnd(s+6)*.1):0,tipB=to<1?len*(.12+rnd(s+7)*.1):0,steps=Math.ceil((b-a)/6);
 const d=Array.from({length:steps+1},(_,i)=>{const x=a+(b-a)*i/steps,c=Math.min(1,tipA?(x-a)/tipA:1,tipB?(b-x)/tipB:1),y=W/2+(y0+amp*Math.sin(x/len*Math.PI*2*waves+phase)-W/2)*(.15+.85*c);
  return `${i?'L':'M'}${f(x)} ${f(Math.min(W-.4,Math.max(.4,y)))}`;}).join('');
 return `<path d="${d}" fill="none" stroke="url(#${paint}-${len})" stroke-width="${f(.35+rnd(s+8)*.55)}" stroke-dasharray="${f(30+rnd(s+9)*90)} ${f(.8+rnd(s+10)*3)} ${f(8+rnd(s+11)*40)} ${f(.5+rnd(s+12)*2)}" stroke-dashoffset="${f(rnd(s+13)*60)}" stroke-linecap="round" opacity="${f(.5+rnd(s+14)*.5)}"/>`;}).join('');
// A paint for each side length, shading light to deep and back along the side.
const paint=(id,stops)=>[284,382].map(len=>`<linearGradient id="${id}-${len}" gradientUnits="userSpaceOnUse" x2="${len}">${stops.map(([o,c])=>`<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`).join('');

// Border: cream brush hairs combed round a charcoal rim, meeting a red stroke that sweeps along the bottom and up
// the left side, each stroke tapering where it ends, and the brush mark painting itself into the top-right corner.
function inkBorder(item,id){
 const cream=`${id}-cream`,red=`${id}-red`;
 // Side 2 runs right to left along the bottom, side 3 bottom to top up the left: the red owns that corner.
 const body=(len,n)=>n===2?strands(len,{paint:cream,to:.32,count:22,seed:200})+strands(len,{paint:red,from:.25,count:20,seed:500})
  :n===3?strands(len,{paint:red,to:.6,count:20,seed:700})+strands(len,{paint:cream,from:.54,count:22,seed:900})
  :strands(len,{paint:cream,count:22,seed:n*97});
 const mark=(x,y,s)=>`<g mask="url(#${id}-paint)">${image(MARK,x,y,s)}</g>`;
 const defs=`${rimDefs(id,'#2d2f34','#141518')}${paint(cream,[[0,'#fffaf0'],[.5,'#b9af94'],[1,'#f3ecd8']])}${paint(red,[[0,'#f0565c'],[.5,'#a8202a'],[1,'#e0383f']])}${paintMask(`${id}-paint`,272,30,16,'wave-enso-draw')}`;
 return frame(item,id,W,defs,`${band(id,body)}${keyline(W,'#efe6cf',.4)}${medallion(272,30,19,'#efe6cf',mark)}`);
}

// Finish

// A swoop of fine hairs along a spiral round (cx,cy): radius r0 to r1 through angles a0 to a1 (degrees, 0 to the
// right, 90 down), swelling to `width` and pointed at both ends, like the strokes of the Enso logo.
const swoop=(cx,cy,{r0,r1,a0,a1,width,count,paint,seed})=>Array.from({length:count},(_,k)=>{
 const s=seed+k*7,off=(k/(count-1)-.5)*width+(rnd(s)-.5)*1.2,ta=rnd(s+1)*.08,tb=1-rnd(s+2)*.1,steps=Math.ceil(Math.abs(a1-a0)/4);
 const d=Array.from({length:steps+1},(_,i)=>{const t=ta+(tb-ta)*i/steps,a=(a0+(a1-a0)*t)*Math.PI/180,r=r0+(r1-r0)*t+off*Math.sin(Math.PI*t**.8)**.7;return `${i?'L':'M'}${f(cx+Math.cos(a)*r)} ${f(cy+Math.sin(a)*r)}`;}).join('');
 return `<path d="${d}" fill="none" stroke="${paint}" stroke-width="${f(.6+rnd(s+3)*1.1)}" stroke-linecap="round" stroke-dasharray="${f(30+rnd(s+4)*90)} ${f(1+rnd(s+5)*3)}" stroke-dashoffset="${f(rnd(s+6)*50)}" opacity="${f(.5+rnd(s+7)*.5)}"/>`;}).join('');

// Finish: the Enso logo's vortex round the hero. Cream swoops arc over the top, a grey one turns inside them,
// and a broad red swoop comes in from the bottom right, sweeps round the lower left and spirals inward, with a
// second red stroke inside it. Drawn at 1.4x so it reaches past the card edges, at 38% so the hero shows
// through. All of it slowly turns, paints itself in, holds, fades and paints again.
function inkFinish(item,id,e){
 const cx=150,cy=168,R=112,red=`url(#${id}-red)`,cream=`url(#${id}-cream)`,grey=`url(#${id}-grey)`;
 const strokes=[
  swoop(cx,cy,{r0:118,r1:126,a0:-150,a1:60,width:14,count:22,paint:cream,seed:10}),
  swoop(cx,cy,{r0:96,r1:108,a0:-110,a1:95,width:10,count:16,paint:cream,seed:200}),
  swoop(cx,cy,{r0:134,r1:138,a0:-175,a1:-70,width:4,count:6,paint:cream,seed:300}),
  swoop(cx,cy,{r0:70,r1:84,a0:-40,a1:170,width:9,count:14,paint:grey,seed:400}),
  swoop(cx,cy,{r0:122,r1:70,a0:55,a1:255,width:28,count:36,paint:red,seed:500}),
  swoop(cx,cy,{r0:64,r1:44,a0:140,a1:330,width:11,count:16,paint:red,seed:600}),
  swoop(cx,cy,{r0:52,r1:40,a0:-30,a1:120,width:6,count:9,paint:cream,seed:700}),
 ].join('');
 const flecks=Array.from({length:18},(_,k)=>{const a=40+rnd(k+400)*40,r=R+(rnd(k+430)-.4)*30;return `<circle cx="${f(cx+Math.cos(a*Math.PI/180)*r)}" cy="${f(cy+Math.sin(a*Math.PI/180)*r)}" r="${f(.5+rnd(k+460)*1.8)}" fill="${k%3?'#e0383f':'#efe6cf'}" opacity="${f(.4+rnd(k+490)*.5)}"/>`;}).join('');
 const shade=(name,a,b)=>`<linearGradient id="${id}-${name}" gradientUnits="userSpaceOnUse" x1="0" y1="${cy-R-30}" x2="0" y2="${cy+R+30}"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
 const defs=`<radialGradient id="${id}-dusk" cx=".5" cy=".42" r=".78"><stop offset=".35" stop-color="#1b1c20" stop-opacity="0"/><stop offset="1" stop-color="#121316" stop-opacity=".75"/></radialGradient><filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/></filter>${shade('red','#f0565c','#b01e27')}${shade('cream','#fffaf0','#cfc4a6')}${shade('grey','#8a8f98','#3a3d44')}${paintMask(`${id}-paint`,cx,cy,R+30,'wave-enso-paint')}${readable(id)}`;
 return layer(item,id,defs,`<rect width="300" height="400" fill="url(#${id}-dusk)"/><rect width="300" height="400" fill="#efe6cf" opacity=".05"/><rect width="300" height="400" filter="url(#${id}-grain)" opacity=".1" style="mix-blend-mode:overlay"/>${placed(item,e,`<g mask="url(#${id}-read)" opacity=".38"><g transform="translate(${cx} ${cy}) scale(1.4) translate(${-cx} ${-cy})"><g mask="url(#${id}-paint)"><g class="wave-enso-swirl" style="transform-origin:${cx}px ${cy}px">${strokes}</g></g>${flecks}</g></g>`)}`);
}

// Team signature

// One letter of a brush word: the centreline drawn as a broad nib of fine hairs (each a copy of the line shifted
// along the nib's slant, broken where the brush ran dry), so strokes run thick or thin with their direction.
const nib=(d,paint,seed,width=6.2)=>Array.from({length:15},(_,k)=>{const s=seed+k*11,t=(k/14-.5)*width+(rnd(s)-.5)*.5;
 return `<path d="${d}" transform="translate(${f(t*.71)} ${f(-t*.71)})" fill="none" stroke="${paint}" stroke-width="${f(.6+rnd(s+1)*.7)}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${f(20+rnd(s+2)*60)} ${f(.6+rnd(s+3)*2.4)}" stroke-dashoffset="${f(rnd(s+4)*40)}" opacity="${f(.6+rnd(s+5)*.4)}"/>`;}).join('');
const nameLine=(text,x,y,color,max)=>{const n=[...text].length;return `<text x="${x}" y="${y}" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="${f(sizeFor(n,.62,13,max))}" font-weight="600" letter-spacing="1.4" fill="${color}">${escape(text)}</text>`;};

// A long brush stroke along a gentle curve (p0 to p2, bending towards p1): fine hairs that fan out to `width`
// just before the middle and converge to a point at both ends, the tail longer than the head.
const brushStroke=(p0,p1,p2,paint,seed,width=8,count=18)=>Array.from({length:count},(_,k)=>{
 const s=seed+k*7,off=(k/(count-1)-.5)*width+(rnd(s)-.5)*.6,a=.01+rnd(s+1)*.06,b=.9+rnd(s+2)*.09,steps=28;
 const d=Array.from({length:steps+1},(_,i)=>{const t=a+(b-a)*i/steps,u=1-t,swell=Math.sin(Math.PI*t**.75)**.8;
  return `${i?'L':'M'}${f(u*u*p0[0]+2*u*t*p1[0]+t*t*p2[0])} ${f(u*u*p0[1]+2*u*t*p1[1]+t*t*p2[1]+off*swell)}`;}).join('');
 return `<path d="${d}" fill="none" stroke="${paint}" stroke-width="${f(.5+rnd(s+3)*.7)}" stroke-linecap="round" stroke-dasharray="${f(25+rnd(s+4)*70)} ${f(.6+rnd(s+5)*2.5)}" stroke-dashoffset="${f(rnd(s+6)*40)}" opacity="${f(.55+rnd(s+7)*.45)}"/>`;}).join('');

// ENSO in a steeply slanted brush hand: E, N and S in cream hairs with swashes, curls and sweeping tails and
// ink thrown off the ends, the O a red ensō
// as in the logo, over a long red brush stroke that runs into the O. The letters write themselves in turn, then
// the stroke underneath; all hold, fade and write again. The player's name sits small below.
function inkSig(item,id,text){
 const x=86,top=228,base=262,mid=245,ox=x+124;
 const letters=[
  // E: a looped swash for the top bar running long to the right, a bowed spine into a sweeping foot, a rising bar.
  `M${x-4} ${top+8}C${x-12} ${top-2} ${x+2} ${top-7} ${x+12} ${top-4}Q${x+24} ${top-1} ${x+33} ${top-8}M${x+6} ${top-2}Q${x} ${mid} ${x+3} ${base}Q${x+18} ${base+3} ${x+35} ${base-7}M${x+5} ${mid}Q${x+13} ${mid} ${x+22} ${mid-7}`,
  // N: a hooked entry from below the line, the diagonal, and a last stroke rising above the cap height to curl over.
  `M${x+32} ${base+5}Q${x+36} ${base-6} ${x+39} ${top+2}L${x+57} ${base+1}Q${x+60} ${mid} ${x+64} ${top-6}Q${x+66} ${top-13} ${x+73} ${top-10}`,
  // S: a tall curl whose tail sweeps down and away to the left.
  `M${x+98} ${top-3}C${x+90} ${top-9} ${x+71} ${top-5} ${x+73} ${top+8}C${x+75} ${mid} ${x+96} ${mid+1} ${x+92} ${base-8}C${x+88} ${base+6} ${x+66} ${base+5} ${x+57} ${base+9}`,
 ];
 const ring=arc(ox,mid+1,20,-66,262);
 const under=[[x-16,273],[150,282],[x+152,262]],underD=`M${under[0][0]} ${under[0][1]}Q${under[1][0]} ${under[1][1]} ${under[2][0]} ${under[2][1]}`;
 // Ink thrown off the ends of the strokes.
 const splat=[[x+36,top-11,1.3],[x+40,top-6,.7],[x+76,top-14,1.1],[x+80,top-9,.6],[x+52,base+12,.9],[ox+19,top-4,1.4],[ox+24,top+1,.7]].map(([cx,cy,r],k)=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${k>4?'#e0383f':'#efe6cf'}" opacity=".8"/>`).join('');
 const word=letters.map((d,k)=>nib(d,`url(#${id}-cream)`,k*97,8.4)).join('')+nib(ring,`url(#${id}-red)`,400,9)+splat;
 const writer=(d,k,w)=>`<path class="wave-enso-sign" pathLength="1" d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" style="animation-delay:${f(k*.45)}s"/>`;
 const mask=(name,body)=>`<mask id="${id}-${name}" maskUnits="userSpaceOnUse" x="0" y="185" width="300" height="110">${body}</mask>`;
 const defs=`<linearGradient id="${id}-cream" gradientUnits="userSpaceOnUse" x1="${x}" y1="${top}" x2="${x+20}" y2="${base}"><stop stop-color="#fffaf0"/><stop offset="1" stop-color="#cfc4a6"/></linearGradient><linearGradient id="${id}-red" gradientUnits="userSpaceOnUse" x1="${x-16}" y1="${top}" x2="${x+150}" y2="${base}"><stop stop-color="#f0565c"/><stop offset=".6" stop-color="#c92a32"/><stop offset="1" stop-color="#a8202a"/></linearGradient>${mask('write',[...letters,ring].map((d,k)=>writer(d,k,15)).join(''))}${mask('under',writer(underD,4.2,16))}`;
 const shadowed=(body,m)=>`<g transform="translate(1 1.5)" opacity=".45" mask="url(#${id}-${m})"><g style="filter:brightness(0)">${body}</g></g><g mask="url(#${id}-${m})">${body}</g>`;
 return wrap(item,id,'#e0383f33',defs,`<g transform="translate(150 238) scale(1.3) translate(-150 -245)">${shadowed(brushStroke(...under,`url(#${id}-red)`,800),'under')}<g transform="translate(0 ${base}) skewX(-17) translate(0 -${base})">${shadowed(word,'write')}</g></g>${nameLine(text,150,293,'#e9e1cc',150)}`);
}

export const ENSO_BORDERS={'enso-ink-border':inkBorder};
export const ENSO_FINISHES={'enso-ink-finish':inkFinish};
export const ENSO_SIGNATURES={'enso-ink-sig':inkSig};
