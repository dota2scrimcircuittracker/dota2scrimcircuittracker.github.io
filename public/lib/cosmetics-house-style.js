// The original catalog's look, applied over the expansion designs: a brushed-metal band across
// each rim, an inner keyline and a rarity glow; signatures get their own ink and a soft glow.
// Each design keeps its own material and motion underneath.
const add=(root,markup)=>root.insertAdjacentHTML('beforeend',markup);
const outer='M19 9H281Q292 9 292 21V379Q292 391 280 391H20Q8 391 8 379V21Q8 9 19 9Z';
// The serpent is the rim itself; a metal band over it would read as a second frame.
const CREATURES=new Set(['ouroboros']);
// Dark materials (volcanic glass, graphite) stay dark: their wash leads with the shadow colour, lightly.
const DARK=new Set(['obsidian','charcoal']);
// The catalog colours are muted swatches; the rim wants the saturated enamel the original borders use.
function vivid(hex,sat=1.6,light=1.08){
 const [r,g,b]=[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2,d=max-min;
 let h=0;if(d)h=max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;
 const s=Math.min(1,(d?d/(1-Math.abs(2*l-1)):0)*sat),L=Math.min(.82,l*light),c=(1-Math.abs(2*L-1))*s,x=c*(1-Math.abs(h%2-1)),m=L-c/2;
 const rgb=[[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(h)%6].map(v=>Math.round((v+m)*255));
 return '#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
}

export function houseBorder(root,id,width,item){
 if(CREATURES.has(item.id))return;
 const band=item.rarity==='common'?.75:item.rarity==='rare'?.65:.55,dark=DARK.has(item.id),[a,b]=dark?[vivid(item.b,1.5,1),vivid(item.b,1.3,.7)]:[vivid(item.a),vivid(item.b,1.5,.9)],inner=`M${8+width} ${9+width}H${292-width}V${391-width}H${8+width}Z`;
 // Same stops as the plain frame's sheen in style.css (.ft-card .ft-face), so old and new rims catch light alike.
 add(root,`<defs><linearGradient id="${id}-house-metal" x1="0" y1="0" x2=".55" y2="1"><stop stop-color="#fff" stop-opacity="${.55*band}"/><stop offset=".28" stop-color="#fff" stop-opacity=".06"/><stop offset=".62" stop-color="#000" stop-opacity="${.32*band}"/><stop offset="1" stop-color="#fff" stop-opacity="${.28*band}"/></linearGradient><linearGradient id="${id}-house-wash" x1="0" y1="0" x2=".55" y2="1"><stop stop-color="${a}"/><stop offset=".32" stop-color="${b}"/><stop offset=".55" stop-color="${a}"/><stop offset=".83" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs>
 <g class="exp-house" clip-path="url(#${id}-frame)"><rect class="exp-house-wash${dark?' exp-house-dark':''}" x="8" y="9" width="284" height="382" fill="url(#${id}-house-wash)"/><rect class="exp-house-metal" x="8" y="9" width="284" height="382" fill="url(#${id}-house-metal)"/></g>
 <path class="exp-house-edge" d="${outer}" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width=".9"/>
 <path class="exp-house-keyline" d="${inner}" fill="none" stroke="#0b0a09" stroke-opacity=".75" stroke-width="1.6"/><path d="${inner}" fill="none" stroke="${dark?b:a}" stroke-opacity=".85" stroke-width=".7"/>`);
}

// [ink, glow]. Multi-colour designs (foils, echoes, marquee bulbs) keep their own palette and take only the glow.
const INKS={
 architect:['#9fe9e0','#5fd6c855'],crossbar:['#efce8b','#ffc66d44'],bookplate:['#f2b48a','#ff9a5c44'],tall:['#e8f0f7','#b8d8ff44'],
 stacked:['#ffc6d3','#ff8fb04d'],continuous:['#aaf5d6','#4affcd55'],negative:['#ff9f8f','#ff6d5a44'],draft:['#a9d4ff','#5fa8ff55'],
 contour:['#c6f59e','#8fe86a44'],pixel:['#8dfcff','#2ee6ff77'],thread:['#ffa3bb','#ff6d9455'],
 marquee:[null,'#ffc86e77'],engraver:[null,'#f3d79a55'],ribbon:[null,'#f6b8d266'],afterimage:[null,'#9fdcff77'],assembly:[null,'#ffd68a66'],fold:[null,'#e9c8ff66'],
};
export const signatureInk=id=>INKS[id]??[null,'transparent'];

// Recolours a cream design into its ink by brightness, keeping its own highlights and shading.
export function houseSignature(art,item,id){
 const [ink]=signatureInk(item.id);if(!ink)return art;
 const [r,g,b]=[1,3,5].map(n=>parseInt(ink.slice(n,n+2),16)/255),ramp=c=>`0 ${(c*.5).toFixed(3)} ${c.toFixed(3)} ${(c+(1-c)*.35).toFixed(3)}`;
 const filter=`<filter id="${id}-ink" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=".33 .5 .17 0 0 .33 .5 .17 0 0 .33 .5 .17 0 0 0 0 0 1 0"/><feComponentTransfer><feFuncR type="table" tableValues="${ramp(r)}"/><feFuncG type="table" tableValues="${ramp(g)}"/><feFuncB type="table" tableValues="${ramp(b)}"/></feComponentTransfer></filter>`;
 return `<svg viewBox="0 0 300 400" aria-hidden="true"><defs>${filter}</defs><g filter="url(#${id}-ink)">${art}</g></svg>`;
}
