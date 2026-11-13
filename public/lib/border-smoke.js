// Smoke borders: a card frame made of churning smoke, fire, water and so on (docs/cosmetics.md "Personal items").
// Brown Wisp is the first; SMOKE_STYLES holds the elemental colourways.
// attachSmoke(el, style) lays a WebGL canvas over el that spills PAD px past every edge. A fragment shader
// draws domain-warped noise flowing outward from the card's edge: dense and nearly solid across the border
// band, tearing into ragged tendrils past it, licking a few px into the art. Light comes from the top left,
// so the smoke reads as volume rather than a flat glow. Without WebGL it returns null and the CSS frame stays.
// Real cards use it through lib/smoke-fx.js (local only until SMOKE_LIVE); the _review pages call it directly.

export const PAD = 54;

// scale: px per noise cell (bigger = larger billows). speed: churn rate. reach: how far smoke escapes (px).
// turb: how ragged the outer edge is. rise: upward drift. density: thickness of the escaping smoke.
// light: strength of the highlights. colors: [deep, body, bright, highlight]. emit: 0 = smoke that blocks light,
// 1 = glowing (fire, plasma): the bright parts add light instead of covering what's behind. flash: random
// lightning-style flares (0 = none, higher = more often).
const BROWN = ['#211008', '#5c331a', '#a8703e', '#f2dbb8'];
export const SMOKE_VARIANTS = {
  billow: { name: 'Billow', blurb: 'Heavy, slow smoke rolling off every edge in big soft clouds.',
    scale: 52, speed: .45, reach: 30, turb: 1, rise: .22, density: 1.05, light: .85, colors: BROWN },
  wild: { name: 'Uncontained', blurb: 'Fast, violent smoke tearing off the frame in long ragged tendrils.',
    scale: 36, speed: 1.15, reach: 32, turb: 1.25, rise: .38, density: 1.15, light: 1, colors: BROWN },
  smoulder: { name: 'Smoulder', blurb: 'Tight, dark smoke that clings to the frame and flickers at the edge.',
    scale: 28, speed: .7, reach: 18, turb: .8, rise: .1, density: .95, light: .55, colors: BROWN },
};

// Elemental colourways on the same engine. Negative rise flows down (water, blood).
export const SMOKE_STYLES = {
  solar: { name: 'Solar Corona', blurb: 'A slow, blinding corona of gold plasma curling off the frame like the surface of the sun.',
    scale: 62, speed: .35, reach: 34, turb: .9, rise: .04, density: 1.05, light: 1, emit: .75, colors: ['#3a1400', '#c25800', '#ffb21f', '#fff6cf'] },
  inferno: { name: 'Inferno', blurb: 'Roaring flames licking straight up off every edge, white-hot at the core.',
    scale: 30, speed: 1.3, reach: 36, turb: 1.35, rise: 1.15, density: 1.1, light: 1, emit: .85, colors: ['#2a0500', '#a11a00', '#ff6a12', '#ffe48a'] },
  tidal: { name: 'Tidal', blurb: 'Deep ocean water churning round the card, foam breaking white and spilling downward.',
    scale: 44, speed: .6, reach: 26, turb: 1.1, rise: -.18, density: 1, light: 1, emit: .15, colors: ['#021a2e', '#0b4f7a', '#2ea8c9', '#dcfcff'] },
  frost: { name: 'Frostbite', blurb: 'Freezing mist drifting slowly off a frame rimed in ice.',
    scale: 40, speed: .3, reach: 24, turb: .8, rise: .05, density: 1, light: 1, emit: .3, colors: ['#0b1a2b', '#4a7ea8', '#a9ddff', '#ffffff'] },
  void: { name: 'Void', blurb: 'Black-violet nothingness bleeding off the card, with faint magenta light inside it.',
    scale: 48, speed: .5, reach: 36, turb: 1.3, rise: 0, density: 1.1, light: .9, emit: .35, colors: ['#050008', '#2a0a46', '#6b2fa8', '#e4a6ff'] },
  toxic: { name: 'Toxic', blurb: 'Glowing green fumes bubbling up off the frame.',
    scale: 34, speed: .8, reach: 30, turb: 1.2, rise: .45, density: 1.05, light: 1, emit: .5, colors: ['#061200', '#2f5a08', '#8fd12a', '#eeffa8'] },
  arcane: { name: 'Arcane', blurb: 'Raw blue-violet magic crackling round the card in bright electric threads.',
    scale: 38, speed: .9, reach: 34, turb: 1.3, rise: .2, density: 1.05, light: 1, emit: .65, colors: ['#08052a', '#3a2ab2', '#6fd8ff', '#ffffff'] },
  blood: { name: 'Bloodmist', blurb: 'A thick crimson haze that sags and drips off the bottom of the frame.',
    scale: 36, speed: .5, reach: 28, turb: 1.1, rise: -.35, density: 1.05, light: .9, emit: .1, colors: ['#140003', '#5a0010', '#b8102a', '#ff9090'] },
  storm: { name: 'Thunderhead', blurb: 'Grey storm cloud boiling off the card, lit from inside by flashes of lightning.',
    scale: 50, speed: .9, reach: 38, turb: 1.4, rise: .1, density: 1.1, light: .8, emit: .2, flash: 1, colors: ['#0c0f14', '#3a4250', '#8a96a8', '#d6ecff'] },
  spirit: { name: 'Spirit', blurb: 'Pale, ghostly vapour rising off the frame and fading into nothing.',
    scale: 46, speed: .4, reach: 36, turb: 1.2, rise: .3, density: .95, light: 1, emit: .45, colors: ['#06161a', '#2a6a70', '#9ff2ea', '#ffffff'] },
};
// Two colourways in one frame. colorsB is the second palette; blend says how they meet:
// 'patches' = slow drifting regions, 'sweep' = two bands rotating round the card, 'prism' = the full spectrum
// running round the frame (colors then only sets light and dark; hue comes from position).
export const SMOKE_MULTI = {
  fireice: { name: 'Fire & Ice', blurb: 'Flame and frost fighting over the frame, each pushing the other back.',
    scale: 38, speed: .8, reach: 32, turb: 1.2, rise: .4, density: 1.05, light: 1, emit: .6, blend: 'patches',
    colors: ['#2a0500', '#a11a00', '#ff6a12', '#ffe48a'], colorsB: ['#0b1a2b', '#2d6fa8', '#8fd4ff', '#ffffff'] },
  aurora: { name: 'Aurora', blurb: 'Northern lights: green and violet curtains sweeping slowly round the card.',
    scale: 50, speed: .5, reach: 32, turb: 1.1, rise: .25, density: 1, light: 1, emit: .6, blend: 'sweep',
    colors: ['#021a12', '#0c7a52', '#3dffb0', '#e6fff4'], colorsB: ['#12052a', '#5a2ab0', '#c070ff', '#ffe6ff'] },
  nebula: { name: 'Nebula', blurb: 'Deep-space gas clouds in magenta and cyan, drifting through each other.',
    scale: 54, speed: .45, reach: 32, turb: 1.2, rise: .05, density: 1.05, light: 1, emit: .55, blend: 'patches',
    colors: ['#14031e', '#8a1a8a', '#ff5ad0', '#ffe0f6'], colorsB: ['#020f22', '#145a9a', '#3fd0ff', '#e8fbff'] },
  prism: { name: 'Prismatic', blurb: 'Smoke that runs through every colour of the spectrum as it circles the frame.',
    scale: 42, speed: .7, reach: 30, turb: 1.2, rise: .2, density: 1.05, light: 1, emit: .5, blend: 'prism',
    colors: ['#0a0a0a', '#555555', '#c8c8c8', '#ffffff'] },
  sunset: { name: 'Sunset', blurb: 'Orange and pink dusk smoke rolling into a deep purple night.',
    scale: 46, speed: .55, reach: 30, turb: 1.1, rise: .2, density: 1.05, light: 1, emit: .45, blend: 'sweep',
    colors: ['#2a0a00', '#d0501a', '#ff9a4a', '#ffe6c0'], colorsB: ['#1a0322', '#8a1a6a', '#ff5a9a', '#ffd6ea'] },
  venom: { name: 'Venom', blurb: 'Toxic green and poison purple fumes curdling together.',
    scale: 36, speed: .75, reach: 30, turb: 1.25, rise: .35, density: 1.05, light: 1, emit: .5, blend: 'patches',
    colors: ['#061200', '#2f5a08', '#8fd12a', '#eeffa8'], colorsB: ['#10021e', '#4a0f7a', '#a040e0', '#f0c8ff'] },
};
// Realistic looks: same motion, different material. look picks how the shader shapes and colours the field.
// mercury: hard chrome blobs with a sky reflection. ink: dense = dark, thin edges tinted. oil: thin-film rainbow
// banded by density. ocean: Frost Creep's ridges set flowing. marble: veins along density bands.
// cloud: sunlit cumulus with silver linings (god rays as a finish). galaxy: swirl plus twinkling stars.
// sand: wind-stretched streaks blowing sideways with grain.
export const SMOKE_REAL = {
  mercury: { name: 'Liquid Mercury', blurb: 'Chrome blobs flowing round the frame, splitting and merging, the sky caught in them.', look: 'mercury',
    scale: 46, speed: .45, reach: 13, turb: .6, rise: .05, density: 1.1, light: 1, emit: 0, colors: ['#0b0d10', '#59626d', '#c9d2dc', '#ffffff'] },
  ink: { name: 'Ink Bloom', blurb: 'Indigo ink blooming off the frame like a drop in water, slowly diffusing.', look: 'ink',
    scale: 40, speed: .35, reach: 34, turb: 1.3, rise: -.08, density: 1.05, light: .6, emit: 0, colors: ['#03040c', '#0e1636', '#3a4c92', '#a8b8ea'] },
  oil: { name: 'Oil Slick', blurb: 'A rainbow sheen sliding over black oil, bands shifting as it flows.', look: 'oil',
    scale: 44, speed: .4, reach: 28, turb: 1.1, rise: .05, density: 1.05, light: 1, emit: .3, colors: ['#040406', '#1c1c24', '#888888', '#ffffff'] },
  // Frost Creep's pattern set moving (flow): reads as foam lines on moving water.
  ocean: { name: 'Ocean Current', blurb: 'Foam-veined sea water drifting and swirling round the frame, the tide creeping in and out.', look: 'frost', flow: 1,
    scale: 34, speed: .6, reach: 22, turb: .5, rise: 0, density: 1.1, light: 1, emit: .2, colors: ['#021428', '#0b5a8a', '#5fd0e8', '#f2ffff'] },
  marble: { name: 'Living Marble', blurb: 'White stone whose dark veins slowly flow.', look: 'marble',
    scale: 60, speed: .15, reach: 14, turb: .6, rise: .02, density: 1.1, light: .9, emit: 0, colors: ['#26262a', '#d9d4ca', '#f7f4ee', '#ffffff'] },
  blackmarble: { name: 'Black Marble', blurb: 'Polished black stone shot through with moving gold veins.', look: 'marble',
    scale: 60, speed: .15, reach: 14, turb: .6, rise: .02, density: 1.1, light: .9, emit: .2, colors: ['#e0b04a', '#0e0e10', '#26262c', '#fff0c8'] },
  stormfront: { name: 'Stormfront', blurb: 'Towering sunlit cloud with silver linings and light breaking through.', look: 'cloud',
    scale: 70, speed: .3, reach: 36, turb: 1.2, rise: .12, density: 1.1, light: 1, emit: .1, colors: ['#1a2230', '#6f7f94', '#f4f6fa', '#ffe2a8'] },
  galaxy: { name: 'Galaxy', blurb: 'A slow spiral of blue and pink nebula gas, cut by dark dust lanes and full of stars.', look: 'galaxy',
    scale: 56, speed: .18, reach: 20, turb: .7, rise: 0, density: 1, light: 1, emit: .35, colors: ['#02030a', '#1d3a8a', '#d86bb8', '#ffffff'] },
  // Space family: galaxy look with swirl (spiral strength, 0 = drifting cloud), lanes (dark dust) and stars (amount).
  emission: { name: 'Emission Nebula', blurb: 'A drifting cloud of teal and glowing crimson gas, with dark pillars of dust standing in it.', look: 'galaxy',
    swirl: 0, lanes: .95, stars: .55, scale: 66, speed: .14, reach: 22, turb: .7, rise: .03, density: 1.05, light: 1, emit: .4,
    colors: ['#04020a', '#0e6a78', '#e2503c', '#fff0d6'] },
  deepfield: { name: 'Deep Field', blurb: 'Near-black space packed with stars of every colour and faint, far-off gas.', look: 'galaxy',
    swirl: .35, lanes: .25, stars: 2.4, scale: 52, speed: .12, reach: 18, turb: .6, rise: 0, density: .8, light: 1, emit: .25,
    colors: ['#010104', '#141c40', '#6656a8', '#ffffff'] },
  spiral: { name: 'Golden Spiral', blurb: 'A tight spiral galaxy: a warm gold core winding out into blue star-forming arms.', look: 'galaxy',
    swirl: 1.7, lanes: .85, stars: 1.2, scale: 50, speed: .2, reach: 20, turb: .7, rise: 0, density: 1, light: 1, emit: .45,
    colors: ['#03040a', '#2a5ab4', '#f2c46e', '#fffaf0'] },
  sandstorm: { name: 'Sandstorm', blurb: 'Fine desert sand streaming sideways off the frame in gusts.', look: 'sand',
    scale: 30, speed: .8, reach: 32, turb: 1.2, rise: 0, density: 1.05, light: .9, emit: 0, colors: ['#3a2410', '#8a6430', '#d8b070', '#fff0d0'] },
};
// Advanced: shapes the smoke engine can't make on its own (crystals, cracks, bolts, vines), and three that bend
// the card's own art (pass art: {src, posY, fade} to attachSmoke; without it they fall back to a plain tint).
export const SMOKE_ADV = {
  frostcreep: { name: 'Frost Creep', blurb: 'Ice ferns growing in from the edges like frost on a window, melting back and regrowing.', look: 'frost',
    scale: 30, speed: .5, reach: 22, turb: .5, rise: 0, density: 1.1, light: 1, emit: .25, colors: ['#06142a', '#3f78b0', '#bfe6ff', '#ffffff'] },
  geode: { name: 'Geode', blurb: 'Amethyst crystals packed into the frame, a slow sweep of light catching each facet.', look: 'geode',
    scale: 26, speed: .6, reach: 10, turb: .4, rise: 0, density: 1.1, light: 1, emit: .2, colors: ['#14052a', '#5a2a9a', '#c08aff', '#ffffff'] },
  shattered: { name: 'Shattered', blurb: 'A cracked glass frame with light leaking through, fresh cracks spreading and fading.', look: 'shatter',
    scale: 40, speed: .5, reach: 8, turb: .4, rise: 0, density: 1, light: 1, emit: .6, colors: ['#05070c', '#2a3240', '#9fd8ff', '#ffffff'] },
  arcs: { name: 'Arc Lightning', blurb: 'Electric arcs crawling round the frame, flickering and jumping the corners.', look: 'arcs',
    scale: 40, speed: 1, reach: 20, turb: .5, rise: 0, density: 1, light: 1, emit: .9, colors: ['#03051a', '#2a3aff', '#8fd8ff', '#ffffff'] },
  overgrowth: { name: 'Overgrowth', blurb: 'Vines winding round the frame, leaves slowly unfurling along them.', look: 'vines',
    scale: 34, speed: .5, reach: 18, turb: .5, rise: 0, density: 1.05, light: 1, emit: 0, colors: ['#0d1606', '#4a3418', '#5f9a34', '#d8f0a0'] },
  rain: { name: 'Rain on Glass', blurb: 'Beads of water on the card, a few running down, each one bending the art behind it.', look: 'rain', refract: true,
    scale: 40, speed: 1, reach: 18, turb: .8, rise: 0, density: 1.1, light: .8, emit: 0, colors: ['#0a1420', '#6a8aa8', '#c8dcec', '#ffffff'] },
  heathaze: { name: 'Heat Haze', blurb: 'The art shimmers and warps like air over hot ground. No flames, just heat.', look: 'haze', refract: true,
    scale: 40, speed: 1, reach: 22, turb: .8, rise: .2, density: 1, light: 1, emit: 0, colors: ['#3a1a08', '#ffb070', '#ffd9a8', '#fff6e0'] },
  horizon: { name: 'Event Horizon', blurb: 'A black hole: a void frame ringed with light, pulling the art in around it.', look: 'horizon', refract: true,
    scale: 44, speed: .5, reach: 9, turb: .5, rise: 0, density: 1, light: 1, emit: 0, colors: ['#000000', '#6a3010', '#ffc070', '#fff6e8'] },
};
// Directional wind: the sand look, but blowing one way across the whole card instead of out from each edge.
// wind: orbit (true = round the frame clockwise, else left to right), in (how far sand off the left border
// drifts over the art, in card widths), art (its opacity over the art; 0 = keep the art clear), out (trail length past the right edge, px), side (how much spills off the upwind left edge, as a
// fraction of reach), gust (0-1 pulsing gusts), lines (0 = soft streaming clouds, 1 = separate wavy strands),
// spd (wind speed multiplier).
const SAND = ['#3a2410', '#8a6430', '#d8b070', '#fff0d0'];
const WINDY = { look: 'sand', scale: 30, speed: .8, reach: 32, turb: 1.2, rise: 0, density: 1.05, light: .9, emit: 0, colors: SAND };
export const SMOKE_WIND = {
  crosswind: { ...WINDY, name: 'Crosswind', blurb: 'Sand blows in off the left border, drifts thin across the art, and trails off the right side.',
    wind: { in: .55, art: .42, out: 39, side: .15, gust: 0, lines: .3, spd: 1 } },
  leeward: { ...WINDY, name: 'Leeward', blurb: 'The art stays clear. Sand peels off the edges of the frame and blows away to the right.',
    wind: { in: 0, art: 0, out: 52, side: .08, gust: .2, lines: .2, spd: 1.1 } },
  midstorm: { ...WINDY, name: 'Sand Wall', blurb: 'A heavy wall of sand off the left border that carries right across the card and out past the right side.',
    wind: { in: 1.2, art: .55, out: 49, side: 0, gust: .15, lines: .3, spd: 1 } },
  gusts: { ...WINDY, name: 'Gusts', blurb: 'Fast sand off the left border sweeping across in pulses, a burst then a lull.',
    reach: 36, wind: { in: .5, art: .38, out: 46, side: .15, gust: 1, lines: .25, spd: 1.7 } },
  strands: { ...WINDY, name: 'Strands', blurb: 'Separate wavy sand lines blowing off the left border, across the card and out past the edge.',
    wind: { in: .8, art: .6, out: 42, side: .1, gust: 0, lines: 1, spd: .9 } },
  orbit: { ...WINDY, name: 'Circling', blurb: 'One continuous current of sand running clockwise round the frame.',
    wind: { orbit: true, art: .35, out: 0, side: 0, gust: .2, lines: .3, spd: 1.1 } },
};
// Outward: sand fading in from the middle of the card and blowing out past the border on every side.
// dir: 'out' = straight off each edge, 'radial' = fanning out from the centre. in: 0 = starts at the centre,
// 1 = only from the frame. out: how far it trails past the border (px).
export const SMOKE_OUTWARD = {
  outburst: { ...WINDY, name: 'Outburst', blurb: 'Sand blows straight out off every edge of the frame.',
    wind: { dir: 'out', in: 1, art: 0, out: 46, gust: .1, lines: .3, spd: 1 } },
  radiant: { ...WINDY, name: 'Radiant', blurb: 'Sand streams off the frame in a fan, angled out from the centre of the card.',
    wind: { dir: 'radial', in: 1, art: 0, out: 46, gust: .1, lines: .3, spd: 1 } },
  eruption: { ...WINDY, name: 'Eruption', blurb: 'Fast outward bursts of sand, a blast then a lull.',
    reach: 36, wind: { dir: 'out', in: 1, art: 0, out: 49, gust: 1, lines: .25, spd: 1.7 } },
  sunburst: { ...WINDY, name: 'Sunburst', blurb: 'Separate wavy sand lines shooting off the frame, angled out from the centre.',
    wind: { dir: 'radial', in: 1, art: 0, out: 42, gust: 0, lines: 1, spd: .9 } },
  rimblast: { ...WINDY, name: 'Rim Blast', blurb: 'The art stays clear. Sand blows straight out off the frame on every side.',
    wind: { dir: 'out', in: 1, art: 0, out: 52, gust: .2, lines: .2, spd: 1.1 } },
};
// Overlay styles: not catalog items of their own. Living borders use them over whatever border is equipped,
// so only the effect draws (overlay: no smoke band of its own). Arc Lightning: lib/card-arcana.js.
export const SMOKE_OVERLAY = {
  'living-arcs': { ...SMOKE_ADV.arcs, overlay: 1 },
};
const LOOK = { mercury: 1, ink: 2, oil: 3, marble: 5, cloud: 6, galaxy: 7, sand: 8,
  frost: 9, geode: 10, shatter: 11, arcs: 12, vines: 13, rain: 14, haze: 15, horizon: 16 };
const BLEND = { patches: 1, sweep: 2, prism: 3 };
const ALL = { ...SMOKE_VARIANTS, ...SMOKE_STYLES, ...SMOKE_MULTI, ...SMOKE_REAL, ...SMOKE_ADV, ...SMOKE_WIND, ...SMOKE_OUTWARD, ...SMOKE_OVERLAY };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const FRAG = `precision highp float;
uniform vec2 uRes,uSize,uCard;uniform vec3 uC0,uC1,uC2,uC3,uB0,uB1,uB2,uB3;uniform sampler2D uMask,uArt;uniform vec4 uArtRect,uWA,uWB;uniform float uOver,uGlow;uniform vec2 uArtFade;uniform float uArtOn,uFlow,uSwirl,uLanes,uStars,uBlend,uDpr,uTime,uBorder,uRadius,uScale,uReach,uTurb,uRise,uDensity,uLight,uEmit,uFlash;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}
vec3 paint(vec3 c0,vec3 c1,vec3 c2,vec3 c3,float den,float lit,float hi){
  vec3 col=mix(c0,c1,smoothstep(.2,.55,den));
  col=mix(col,c2,smoothstep(.45,.8,den)*(.35+.65*lit));
  return mix(col,c3,hi);
}
vec3 hue(float h){return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);}
float m2(vec2 x){return noise(x*.7)*.62+noise(x*1.7+3.1)*.38;}
// Voronoi: (nearest distance, second-nearest distance, random id of the nearest cell).
vec3 vor(vec2 x){vec2 i=floor(x),f=fract(x),id=vec2(0.);float d1=8.,d2=8.;
  for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec2 g=vec2(float(z),float(y));float dd=length(g+vec2(hash(i+g),hash(i+g+17.3))-f);
    if(dd<d1){d2=d1;d1=dd;id=i+g;}else if(dd<d2)d2=dd;}
  return vec3(d1,d2,hash(id+3.7));}
float ridged(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<4;i++){v+=a*(1.-abs(noise(p)*2.-1.));p=m*p;a*=.5;}return v;}
// The card's art at canvas point pp, cropped the way the page crops it (uArtRect, in card px) and with the
// page's bottom shade (uArtFade: where it starts, how dark it ends), so undistorted samples match exactly.
vec3 artAt(vec2 pp){vec2 pc=pp-(uSize-uCard)*.5;vec3 a=texture2D(uArt,clamp((pc-uArtRect.xy)/uArtRect.zw,0.,1.)).rgb;
  return a*(1.-clamp((pc.y/uCard.y-uArtFade.x)/max(1.-uArtFade.x,.01),0.,1.)*uArtFade.y);}
float sdRR(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
void main(){
  vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uDpr, c=uSize*.5, rel=p-c;
  float d=sdRR(rel,uCard*.5,uRadius);
  vec2 q0=max(abs(rel)-uCard*.5+uRadius,0.);
  vec2 n=length(q0)>.001?normalize(sign(rel)*q0):(abs(rel.x)/uCard.x>abs(rel.y)/uCard.y?vec2(sign(rel.x),0.):vec2(0.,sign(rel.y)));
  // Sigs and finishes drift one way (up, or down for falling styles). The frame's edge-normal flips direction
  // along the card's diagonals, which drew a visible X across a finish.
  if(uMode>.5)n=vec2(.3,uRise<-.05?.95:-.95);
  vec2 uv=p/uScale; float T=uTime;
  if(uLook>6.5&&uLook<7.5){ // galaxy: the field turns, faster near the middle, so it winds into a spiral
    float an=(T*.08+2.2/(1.+length(rel)/60.))*uSwirl; uv=(mat2(cos(an),-sin(an),sin(an),cos(an))*rel+c)/uScale; }
  if(uLook>7.5&&uLook<8.5)uv.x*=.3; // sand: stretched along the wind
  // Outward motion as two looping phases that crossfade (a flow map): the offset along n never grows past
  // one loop, so the corners don't shear into streaks however long it runs.
  vec2 rise=uLook>7.5&&uLook<8.5?vec2(T*1.4*(uWA.x>.5?-1.:1.),T*uRise):vec2(0.,T*uRise);
  vec2 q=vec2(fbm(uv+rise+.1*T),fbm(uv+rise+vec2(5.2,1.3)-.08*T));
  vec2 r=vec2(fbm(uv+3.5*q+vec2(1.7,9.2)+.15*T),fbm(uv+3.5*q+vec2(8.3,2.8)-.12*T));
  vec2 w=uv+3.*r+rise;
  float ph=fract(T*.3), ph2=fract(T*.3+.5), k=abs(1.-2.*ph);
  vec2 wa=w-n*ph*1.6, wb=w-n*ph2*1.6+vec2(3.1,7.7);
  float den=mix(fbm(wa),fbm(wb),k);
  vec2 wl=k<.5?wa:wb;
  float lit=clamp((fbm(wl)-fbm(wl+vec2(.09,.09)))*5.+.5,0.,1.);
  // Smooth field for the solid materials (mercury, marble): same flow, without the fine smoke detail.
  float S=mix(m2(wa),m2(wb),k); vec3 nrm=vec3(0.,0.,1.);
  vec2 off=vec2(0.); float wet=0., L1=0., L2=0., L3=0.;
  if(uLook>.5&&uLook<1.5){ // mercury: hard-edged blobs, with a surface normal from the field's slope
    // Mercury flows on a gentler warp than smoke, so the blobs stay big and smooth.
    vec2 ma=uv*.8+r*.9+rise-n*ph*1.2, mb=uv*.8+r*.9+rise-n*ph2*1.2+vec2(3.1,7.7);
    S=mix(m2(ma),m2(mb),k);
    float e=.05, sx=mix(m2(ma+vec2(e,0.)),m2(mb+vec2(e,0.)),k), sy=mix(m2(ma+vec2(0.,e)),m2(mb+vec2(0.,e)),k);
    nrm=normalize(vec3(-(sx-S)/e*.8,-(sy-S)/e*.8,1.));
    den=uMode>1.5?smoothstep(.56,.64,S):smoothstep(.42,.54,S); // as a finish, only the biggest blobs
  } else if(uLook>6.5&&uLook<7.5){ // galaxy: smooth gas, not licking smoke
    den=mix(S,den,.3);
  } else if(uLook>8.5&&uLook<9.5){ // frost: still ice ferns (ridged noise folded on itself); only the growth moves
    vec2 fp=p/uScale*1.6;
    fp+=uFlow*(vec2(T*.12,T*.05)+(vec2(noise(fp*.3+vec2(T*.1,0.)),noise(fp*.3+vec2(4.,T*.08)))-.5)*1.2); // ocean: drift and swirl
    float fr=ridged(fp); fr=ridged(fp+vec2(fr*.6)); L1=pow(clamp(fr,0.,1.),2.4); den=.24+L1*.86;
  } else if(uLook>9.5&&uLook<10.5){ // geode: one crystal per cell
    vec3 vg=vor(p/uScale*2.2); L1=smoothstep(0.,.08,vg.y-vg.x); L2=vg.z; L3=vg.x; den=.36+.52*vg.z;
  } else if(uLook>10.5&&uLook<11.5){ // shattered: big shards, plus finer cracks that spread and fade
    vec3 vs=vor(p/uScale*1.1+3.); float cr=1.-smoothstep(0.,.045,vs.y-vs.x);
    vec3 vf=vor(p/uScale*3.3+11.); cr=max(cr,(1.-smoothstep(0.,.03,vf.y-vf.x))*smoothstep(.48,.62,fbm(p/uScale*.6+vec2(T*.05,0.))));
    L1=cr; L2=vs.z; den=.3+cr*.7;
  } else if(uLook>11.5&&uLook<12.5){ // arcs: jagged bolts along a track (the frame, the sig's line, or bands across a finish)
    float tr=uMode>1.5?(fract(rel.y/72.)-.5)*72.:uMode>.5?rel.y:d+uBorder*.5, bolt=0.;
    for(int i=0;i<3;i++){float fi=float(i), sd=floor(T*7.+fi*.37); vec2 so=vec2(hash(vec2(sd,fi)),hash(vec2(fi,sd+3.)))*40.;
      float dd=abs(tr-(fbm(p*.045+so)-.5)*uReach*1.6);
      bolt=max(bolt,step(.35,hash(vec2(sd*1.3,fi+5.)))*(exp(-dd/.9)+exp(-dd/5.)*.35));}
    L1=clamp(bolt,0.,1.); den=.28+L1*.72;
  } else if(uLook>12.5&&uLook<13.5){ // vines along curving contours, with leaves growing on cells near them
    float sv=m2(p/uScale*.9+vec2(T*.02,0.)), sv2=m2(p/uScale*1.7+5.);
    float v=abs(fract(sv*4.5+sv2*.8)-.5), vine=1.-smoothstep(.045,.085,v), near=1.-smoothstep(.08,.24,v);
    vec3 vl=vor(p/uScale*3.4); float lr=.42*(.6+.4*sin(T*.4+vl.z*30.));
    float leaf=(1.-smoothstep(lr-.08,lr,vl.x))*near*step(.2,vl.z);
    L1=vine; L2=leaf; L3=vl.x/max(lr,.01); den=.28+max(vine*.62,leaf*.72);
  } else if(uLook>13.5&&uLook<14.5){ // rain: still beads plus running drops with trails; off = the drop's slope
    vec2 gp=p/16., gi=floor(gp), gf=fract(gp)-.5; float hh=hash(gi), rr=.16+.26*hash(gi+5.1);
    vec2 dv=gf-(vec2(hash(gi+1.3),hash(gi+2.7))-.5)*.45; float sb=(1.-smoothstep(rr*.7,rr,length(dv)))*step(.58,hh);
    vec2 dn=dv/rr*sb; wet=sb;
    float cw=24., ci=floor(p.x/cw), ch=hash(vec2(ci,7.)), cx=(fract(p.x/cw)-.5)*cw-sin(p.y*.05+ch*6.)*3.;
    float yy=mod(T*(30.+40.*ch)+ch*500.,uSize.y+80.)-40., dy=p.y-yy, rd=6.+4.*ch;
    vec2 rv=vec2(cx,dy*.8); float run=(1.-smoothstep(rd*.75,rd,length(rv)))*step(.45,ch);
    float tt=fract(dy/7.), trail=(1.-smoothstep(.18,.32,length(vec2(cx/(rd*.45),(tt-.5)*2.))))*step(dy,-rd)*smoothstep(-70.,-rd,dy)*step(.45,ch);
    if(run>sb){dn=rv/rd;wet=run;} wet=max(wet,trail*.85);
    off=dn; den=mix(den,.62,.5);
  } else if(uLook>14.5&&uLook<15.5){ // heat haze: a rising shimmer offset
    off=(vec2(fbm(p*.05+vec2(0.,T*1.6)),fbm(p*.05+vec2(5.2,T*1.6+3.)))-.5)*2.; den=.5+(S-.5)*.5;
  } else if(uLook>15.5){
    den=mix(S,den,.4);
  }
  float rag=(den-.5)*2.;
  float wob=fbm(uv*.6+vec2(T*.07,-T*.05))-.5;
  float a, ink=0., soot=0., aSig=0.;
  if(uMode>1.5){
    // Finish: a smoke veil drifting over the whole face, thin in the middle so the art reads, thicker at the edges.
    float inside=1.-smoothstep(-1.,1.,d);
    float e=smoothstep(-min(uCard.x,uCard.y)*.5,0.,d);
    a=smoothstep(.36,.84,den+wob*.15)*uDensity*mix(.32,.78,e*e)*inside;
    if(uLook>9.5&&uLook<10.5)a*=smoothstep(.6,.92,e+(L2-.5)*.25); // geode: a crust of crystals round the edges only
  } else if(uMode>.5){
    // Signature: letters drawn in smoke (R = sharp ink, warped by the noise), with wisps peeling off them
    // (G = blurred ink, sampled further along the flow on two looping phases so the trails never stop).
    vec2 wv=(r-.5)*uTurb*7.;
    float sharp=texture2D(uMask,(p+wv*.3)/uSize).r;
    ink=smoothstep(.3,.7,sharp);
    float aCore=ink*mix(.86,1.,smoothstep(.25,.75,den));
    soot=texture2D(uMask,p/uSize).g*.32;
    float sg=uRise<-.05?-1.:1., L=uReach*clamp(abs(uRise)*1.6+.45,.45,1.2);
    float wA=texture2D(uMask,(p+vec2(0.,sg*ph*L)+wv*(1.+ph*4.))/uSize).g*(1.-ph);
    float wB=texture2D(uMask,(p+vec2(0.,sg*ph2*L)+wv*(1.+ph2*4.)+vec2(9.,0.))/uSize).g*(1.-ph2);
    float aW=clamp((wA+wB)*1.5,0.,1.)*smoothstep(.34,.74,den)*uDensity;
    // Glow (over a scene signature that draws its own letters): only the wisps rising off the name.
    // Halo: the blurred name, burning in the effect. Full strength as a glow behind a scene signature's own
    // letters; softer behind lettering drawn in the effect. Letters and halo take the bright end of the
    // palette, so dark styles (void, tidal, ink) still read on dark art.
    float halo=clamp(texture2D(uMask,(p+wv*.5)/uSize).g*smoothstep(.2,.6,den)*2.4,0.,1.)*mix(.5,1.,uGlow);
    den=max(den,max(.62+halo*.3,.7+ink*.25)*max(halo,ink*(1.-uGlow)));
    a=clamp(max(max(aCore*(1.-uGlow),aW*(1.+uGlow)),max(soot*(1.-uGlow),halo)),0.,1.); aSig=a;
  } else {
  float core=smoothstep(3.,-uBorder*.4,d-rag*3.)*smoothstep(-uBorder-7.,-uBorder+1.,d-rag*5.);
  float dOut=max(d-rag*uTurb*uReach*.55,0.);
  float outer=exp(-dOut/(uReach*.42))*step(-uBorder*.4,d);
  float aBand=core*mix(.72,1.,smoothstep(.25,.75,den));
  float aOut=outer*smoothstep(.3,.72,den)*uDensity;
  // Containment: smoke thins out over a wide band past the frame. The band's distance wobbles with slow,
  // coarse noise, so there's no visible outer line, just smoke that runs out of strength.
  float dSoft=d-rag*uReach*.22-wob*uReach*.5;
  aOut*=1.-smoothstep(uReach*.18,uReach*.8,dSoft);
  // Inward: the same smoke licks over the card art past the frame, a bit shorter than outward and thinner,
  // with its own wobbling soft limit so it never makes an inner line either.
  float inR=uReach*.6, dIn=max(-d-uBorder,0.);
  float aIn=exp(-max(dIn-rag*uTurb*inR*.6,0.)/(inR*.4))*smoothstep(.36,.76,den)*uDensity*.85*step(d,-uBorder*.4);
  aIn*=1.-smoothstep(inR*.2,inR*.85,dIn-rag*inR*.25+wob*inR*.5);
  a=clamp(max(aBand,max(aOut,aIn)),0.,1.);
  if(uOver>.5)a=uLook>11.5&&uLook<12.5?clamp(L1*1.3,0.,1.):aOut; // overlay: just the bolts (or just what escapes)
  if(uWA.x>.5){ // directional wind (see SMOKE_WIND): streaks advected one way, shaped by a one-sided envelope
    vec2 hc=uCard*.5; float sp=T*60.*uWB.z, per=2.*(uCard.x+uCard.y), s=atan(rel.y,rel.x)/6.2832*per;
    // wp = (along the wind, across it). wq = the same field one lap back round the card, crossfaded in near
    // the seam at the left middle (sw) so the modes that go round the card show no join.
    float an=atan(rel.y,rel.x), R0=hc.x, ar=6.2832*R0, sw=uWA.x>1.5?smoothstep(.3,.5,an/6.2832):0.;
    vec2 wp=vec2(p.x-sp,p.y), wq=wp;
    if(uWA.x>3.5){wp=vec2(length(rel)-sp,an*R0);wq=wp-vec2(0.,ar);}       // outward from the centre, fanning
    else if(uWA.x>2.5){wp=vec2(d-sp,s);wq=wp-vec2(0.,per);}             // outward, square off each edge
    else if(uWA.x>1.5){wp=vec2(s-sp,d);wq=wp-vec2(per,0.);}             // round the frame
    vec2 sc=vec2(uScale*4.,uScale*.6);
    float wy=mix(fbm(wp/(uScale*vec2(5.,2.))),fbm(wq/(uScale*vec2(5.,2.))),sw)-.5;
    wp.y+=wy*uScale*1.4; wq.y+=wy*uScale*1.4;
    float sn=mix(fbm(wp/sc),fbm(wq/sc),sw);
    float bi=wp.y/(uScale*.5)+sn*1.6, band=abs(fract(bi)-.5);
    float brk=mix(fbm(vec2(wp.x/(uScale*2.5),floor(bi)*3.1)),fbm(vec2(wq.x/(uScale*2.5),floor(bi)*3.1)),sw);
    float ln=(1.-smoothstep(.05,.17,band))*smoothstep(.38,.56,brk);
    float wd=mix(smoothstep(.4,.72,sn),ln,uWB.y);
    float gx=wp.x+sp, g=mix(1.,smoothstep(-.4,.9,sin((gx-sp*1.25)/(uScale*3.2)+wy*4.)),uWB.x);
    float env;
    if(uWA.x>2.5){ // outward: fades in from the middle (in: 0 = centre, 1 = the frame) and out past the border
      float t=clamp(1.+d/min(hc.x,hc.y),0.,1.);
      env=d<-uBorder*.4?smoothstep(uWA.y,1.,t)*uWA.z*1.5:exp(-max(d,0.)/max(uWA.w,1.));
    } else if(uWA.x>1.5){
      env=d<0.?exp(-max(-d-uBorder,0.)/(uReach*.35))*mix(uWA.z,1.,step(-uBorder,d)):exp(-d/(uReach*.45));
    } else {
      // Every grain must trace back to the frame: over the art it blows in off the left border and thins as it
      // crosses (uWA.y = how far, in card widths); above and below the card it hugs the edge it came off.
      float dy=max(abs(rel.y)-hc.y,0.), dxL=max(-rel.x-hc.x,0.), dxR=max(rel.x-hc.x,0.);
      env=d<-uBorder*.4?uWA.z*1.5*exp(-(rel.x+hc.x-uBorder)/max(uWA.y*uCard.x,1.))
        :exp(-dy/5.)*exp(-dxL/(uReach*uWB.w+.01))*exp(-dxR/max(uWA.w,1.));
    }
    env*=.8+.4*wob;
    float aW=clamp(env*wd*g*uDensity,0.,1.);
    if(aW>aBand)den=.5+.48*wd*g;
    a=clamp(max(aBand,aW),0.,1.);
  }
  }
  if(uLook>8.5&&uLook<9.5&&uMode>1.5){ // frost finish creeps in from the edges and back
    float e=smoothstep(-min(uCard.x,uCard.y)*.5,0.,d), th=.5+.28*sin(T*.3+wob*2.); a*=smoothstep(th-.12,th+.12,e+wob*.15); }
  if(uLook>13.5&&uLook<14.5){ if(uMode>1.5)a=wet*(1.-smoothstep(-1.,1.,d)); else if(uMode<.5)a*=wet; }
  if(uLook>14.5&&uLook<15.5){ float inCard=1.-smoothstep(-1.,1.,d);
    if(uMode>1.5)a=inCard*uArtOn; else if(uMode<.5)a=a*inCard*step(d,-uBorder*.5)*uArtOn+a*(1.-inCard)*.18; }
  float edge=min(min(p.x,p.y),min(uSize.x-p.x,uSize.y-p.y));
  a*=smoothstep(0.,10.,edge);
  float hi=clamp(smoothstep(.62,.92,den)*lit*uLight+uFlash*smoothstep(.35,.8,den),0.,1.);
  vec3 col=paint(uC0,uC1,uC2,uC3,den,lit,hi);
  float ang=atan(rel.y,rel.x), grain=1.;
  if(uLook>.5){
    if(uLook<1.5){ // mercury: sky above the horizon, ground below, with a hot specular
      float t=-nrm.y*1.4+nrm.x*.35;
      col=mix(mix(uC0,uC1,smoothstep(-.9,0.,t)),mix(uC2,uC3,smoothstep(0.,.7,t)),smoothstep(-.04,.04,t));
      col+=uC3*pow(max(dot(nrm,normalize(vec3(-.5,-.6,.75))),0.),36.)*.9;
    } else if(uLook<2.5){ // ink: dense is darkest, thin wisps carry the tint
      col=mix(uC2,uC0,smoothstep(.3,.75,den)); col=mix(col,uC3,smoothstep(.55,.9,lit)*.3*(1.-den));
    } else if(uLook<3.5){ // oil: thin-film rainbow banded by thickness
      vec3 film=mix(vec3(.5),hue(fract(den*1.4+lit*.3+T*.04)),.65)*.95;
      col=mix(uC0,film,smoothstep(.34,.74,den)*.9)+uC3*smoothstep(.82,.96,lit)*.3;
    } else if(uLook<5.5){ // marble: veins along density bands, wobbling so they don't look ruled
      float v=abs(fract(S*3.+den*.35)-.5)*2., vein=1.-smoothstep(.02,.11,v);
      col=mix(mix(uC1,uC2,smoothstep(.3,.7,den)),uC0,vein*.9)+uC3*smoothstep(.75,.95,lit)*.3;
    } else if(uLook<6.5){ // cloud: lit body, shadowed underside, bright silver lining where it thins
      float rim=smoothstep(.28,.42,den)*(1.-smoothstep(.42,.6,den));
      col=mix(uC1,uC2,smoothstep(.15,.85,lit)); col=mix(col,uC3,clamp(rim*lit*1.6,0.,1.));
    } else if(uLook>6.5&&uLook<7.5){ // galaxy: blue outer gas, pink where it's dense, dark dust lanes through it
      col=mix(uC0,mix(uC1,uC2,smoothstep(.5,.75,S)),smoothstep(.25,.6,den));
      float lane=fbm(uv*2.2+r*1.5); col*=1.-smoothstep(.5,.62,lane)*(1.-smoothstep(.62,.75,lane))*uLanes;
      col+=uC3*smoothstep(.72,.9,S)*.35;
    } else if(uLook<8.5){
      grain=hash(floor(p*uDpr)+floor(T*24.)); col*=.8+.4*grain;
    } else if(uLook<9.5){ // frost, with sparse twinkling glints
      col=mix(uC0,uC1,smoothstep(.24,.5,den)); col=mix(col,uC2,smoothstep(.45,.85,den));
      float h=hash(floor(p/2.)); col=mix(col,uC3,step(.982,h)*(.5+.5*sin(T*5.+h*40.))*smoothstep(.4,.6,den));
    } else if(uLook<10.5){ // geode: each facet lit as a slow light sweeps past, dark seams between crystals
      float sh=.5+.5*sin(L2*40.+T*.8-(p.x+p.y)*.015);
      col=mix(uC0,uC1,.35+.65*L2); col=mix(col,uC2,sh*.75); col+=uC3*pow(sh,10.)*.8; col*=(.75+.35*(1.-L3))*mix(.3,1.,L1);
    } else if(uLook<11.5){ // shattered: dark glass shards catching light, bright light leaking through cracks
      col=mix(uC0,uC1,.25+.45*L2+.2*sin(T*.5+L2*20.)); col=mix(col,mix(uC2,uC3,smoothstep(.5,1.,L1)),L1);
    } else if(uLook<12.5){
      col=mix(uC0,uC1,smoothstep(.28,.45,den)); col=mix(col,uC2,smoothstep(.45,.75,den)); col=mix(col,uC3,smoothstep(.8,.97,den));
    } else if(uLook<13.5){ // vines and leaves; leaves lighter at the middle
      col=mix(mix(uC0*.8,uC1,L1),mix(uC2,uC3,smoothstep(.6,.95,lit)*.6)*(.7+.3*(1.-L3)),L2);
    }
  }
  if(uBlend>2.5){
    // Prism: palette gives brightness, hue runs round the frame and drifts with time and density.
    float lum=dot(col,vec3(.3,.59,.11));
    col=mix(hue(fract(ang/6.2832+T*.2+den*.35+wob*.4))*lum*1.7,col,hi*.6);
  } else if(uBlend>.5){
    float m=uBlend>1.5
      ? smoothstep(.25,.75,.5+.5*sin(ang*2.+T*1.3+(den-.5)*3.+wob*3.))
      : smoothstep(.4,.6,fbm(uv*.32+r*.6+vec2(T*.24,-T*.17))+(den-.5)*.35);
    col=mix(col,paint(uB0,uB1,uB2,uB3,den,lit,hi),m);
  }
  if(uLook>6.5&&uLook<7.5){ // galaxy stars: sparse, twinkling, only where there's some dust
    float h=hash(floor(p/2.5)), st=step(1.-.038*uStars,h)*(.55+.45*sin(T*4.+h*60.))*mix(.5,1.,fract(h*37.)), sa=st*clamp(a*5.,0.,1.);
    col=mix(col,uC3*mix(vec3(.72,.84,1.),vec3(1.,.86,.66),fract(h*91.))*1.15,sa); a=max(a,sa); // stars run blue-white to warm
  }
  if(uLook>13.5&&uLook<15.5){ // rain and haze: draw the art bent by the offset (sigs bend along the letter edges)
    vec2 dn=off;
    if(uMode>.5&&uMode<1.5){
      float gx=texture2D(uMask,(p+vec2(1.5,0.))/uSize).g-texture2D(uMask,(p-vec2(1.5,0.))/uSize).g;
      float gy=texture2D(uMask,(p+vec2(0.,1.5))/uSize).g-texture2D(uMask,(p-vec2(0.,1.5))/uSize).g;
      dn=vec2(gx,gy)*4.; wet=ink;
    }
    float onArt=uArtOn*step(d,-1.); // off the card there's no art behind, just the page
    vec3 base=onArt>.5?artAt(p+dn*(uLook<14.5?-6.:9.)):mix(uC0,uC1,.45);
    if(uLook<14.5){ // drops flip what's behind them; highlight top-left, darker rim
      float spec=smoothstep(.45,.9,dot(-dn,normalize(vec2(-.6,-.8))))*wet, rim=smoothstep(.55,1.,length(dn))*wet;
      col=mix(base*1.06,uC0,rim*.6)+uC3*spec*1.1; if(onArt<.5)a*=.7;
    } else { col=base*(1.+.07*dn.y); if(uArtOn<.5){col=mix(uC1,uC3,smoothstep(.3,.7,dn.x+.5)); a*=.2;} }
  }
  if(uLook>15.5){ // event horizon
    if(uMode<.5){ // frame: a void band, a hot accretion glow along it, a thin photon ring, art pulled toward it
      float dIn=max(-d-uBorder,0.);
      // Light streaks running round the frame (along its tangent), and a photon ring that wanders and breaks up.
      float streak=fbm(vec2(dot(p,vec2(-n.y,n.x))*.06+T*1.5,d*.35));
      float disk=exp(-abs(d+uBorder*.5)/5.)*(.25+.95*smoothstep(.42,.75,streak));
      float ring=exp(-abs(d+uBorder+1.5+(den-.5)*5.)/.9)*smoothstep(.3,.7,den)*.85;
      vec3 lens=uArtOn>.5?artAt(p+n*10.*exp(-dIn/9.)):uC0; float la=uArtOn*exp(-dIn/16.)*step(d,-uBorder);
      col=mix(lens,uC0,smoothstep(-uBorder-1.,-uBorder*.5,d))+mix(uC1,uC2,smoothstep(.3,.8,den))*disk+uC3*ring;
      a=clamp(max(max(la,a*(.6+.4*disk)),ring),0.,1.);
    } else if(uMode>1.5){ // finish: a small black hole in the top-right corner with a tilted disk, lensing the art
      vec2 hc=c+vec2(uCard.x*.3,-uCard.y*.3), rv=p-hc; float R=15., rr=length(rv);
      vec2 qd=vec2(rv.x*.94+rv.y*.34,(rv.y*.94-rv.x*.34)*3.2); float rd=length(qd), da=atan(qd.y,qd.x);
      float disk=exp(-abs(rd-R*2.3)/(R*.55))*(.55+.6*fbm(vec2(da*3.+T*1.6,rd*.08)))*(1.+.55*sin(da));
      float ring=exp(-abs(rr-R*1.06)/.8), hole=1.-smoothstep(R-1.,R+.5,rr);
      vec2 pull=-rv/max(rr,1.)*min(R*R*1.8/max(rr,1.),40.);
      float inCard=1.-smoothstep(-1.,1.,d), la=uArtOn*smoothstep(R*9.,R*4.5,rr)*inCard;
      vec3 bg=uArtOn>.5?artAt(p+pull):uC0;
      col=mix(bg+mix(uC1,uC2,smoothstep(.3,1.,disk))*disk+uC3*ring,uC0,hole);
      a=clamp(max(max(la,hole),max(disk*.9,ring)),0.,1.)*inCard;
    } else { col=mix(mix(uC2,uC3,smoothstep(.6,.9,lit))*1.1,uC0,ink); } // sig: void letters, hot wisps
  }
  if(uLook>5.5&&uLook<6.5&&uMode>1.5){ // stormfront finish: god rays from the top-left corner
    vec2 sp=p+vec2(30.,40.); float ray=pow(noise(vec2(atan(sp.y,sp.x)*34.,T*.25)),3.)*smoothstep(420.,40.,length(sp))*(1.-smoothstep(-1.,1.,d))*.55;
    col=mix(col,uC3,clamp(ray*2.,0.,1.)*(1.-a)); a=max(a,ray);
  }
  if(uLook>7.5&&uLook<8.5)a*=.72+.28*grain;
  if(uMode<.5&&uLook<13.5)col*=mix(.82,1.,smoothstep(-uBorder,0.,d)); // (not over bent art: it must match)
  // Signature effects: looks that bend the art (rain, haze, black hole), or are dark or sparse by design (ink,
  // marble, galaxies, geode, shards, vines), or a full spectrum (prism) can't carry a name. In sig mode they paint
  // it from the palette's brightest colours instead, so every style's lettering reads.
  if(uMode>.5&&uMode<1.5&&(uLook>1.5&&uLook<2.5||uLook>4.5&&uLook<5.5||uLook>6.5&&uLook<7.5||uLook>9.5&&uLook<11.5||uLook>12.5||uBlend>2.5)){
    vec3 lw=vec3(.3,.59,.11); vec3 br=dot(uC0,lw)>dot(uC2,lw)?uC0:uC2;
    br=mix(br,uC3,.25+.4*step(dot(br,lw),.35));
    if(uBlend>2.5)br=mix(hue(fract(p.x/uSize.x*2.6+T*.06)),vec3(1.),.15); // prism: a clean spectrum along the name
    col=mix(mix(mix(uC1,br,.35),br,smoothstep(.35,.75,den)),uC3,hi*.7); a=aSig;
  }
  // Glowing styles: bright parts give back some of their coverage, so they add light (premultiplied alpha).
  if(uMode>.5&&uMode<1.5&&!(uLook>4.5&&uLook<5.5&&dot(uC1,vec3(.3,.59,.11))<.1))col=mix(uC0*.5,col,clamp(max(ink,(a-soot)*2.),0.,1.));
  float glow=uEmit*smoothstep(.4,.9,den)*(1.-ink*.75);
  gl_FragColor=vec4(col*a*(1.+glow*.4),a*(1.-glow*.85));
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

// Draws the signature ink into a mask: red = the letters (plus an underline swash), green = a wide blur of them.
function inkMask(w, h, pad, { text, font, fontSize, slant = -7 }) {
  const k = 2, mk = () => { const cv = document.createElement('canvas'); cv.width = w * k; cv.height = h * k; return cv; };
  const ink = (cv, blur) => {
    const x = cv.getContext('2d'); x.scale(k, k); x.filter = blur ? `blur(${blur}px)` : 'none';
    x.fillStyle = x.strokeStyle = '#fff'; x.font = `${fontSize}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.translate(w / 2, h / 2); x.transform(1, 0, Math.tan(slant * Math.PI / 180), 1, 0, 0);
    x.fillText(text, 0, 0);
    // Thicken thin script fonts so the effect has letters to fill.
    x.lineWidth = fontSize * .05; x.lineJoin = 'round'; x.strokeText(text, 0, 0);
    const tw = Math.min(x.measureText(text).width, w - pad * 2);
    x.lineWidth = fontSize * .035; x.lineCap = 'round'; x.beginPath();
    x.moveTo(-tw * .5, fontSize * .42); x.quadraticCurveTo(0, fontSize * .62, tw * .58, fontSize * .3); x.stroke();
    return x.getImageData(0, 0, cv.width, cv.height).data;
  };
  const a = ink(mk(), 0), b = ink(mk(), 6), out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i += 4) { out[i] = a[i + 3]; out[i + 1] = b[i + 3]; out[i + 3] = 255; }
  return { data: out, w: w * k, h: h * k };
}

const MODES = { border: 0, sig: 1, finish: 2 };
// mode 'border' (default): the frame. 'sig': the signature itself in smoke (needs sig: {text, font, fontSize, slant}),
// canvas overhangs el by pad. 'finish': a veil over the whole face, canvas exactly covers el.
// A card-sized canvas of a CSS-style radial gradient ("circle at cx cy", farthest-corner), for pages whose card
// background is a gradient, so the refraction looks have art to bend.
export function radialArt(w, h, stops, cx = .5, cy = .3) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d'), X = w * cx, Y = h * cy, r = Math.hypot(Math.max(X, w - X), Math.max(Y, h - Y));
  const g = x.createRadialGradient(X, Y, 0, X, Y, r); stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, w, h); return cv;
}

// One WebGL context for every effect on the page (Chrome allows about 16). Each effect gets a plain 2D canvas;
// a shared loop renders each visible effect into the hidden GL canvas and copies it across.
let G = null;
function shared() {
  if (G) return G.gl ? G : null;
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const gl = c.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  G = { c, gl, progs: new Map(), list: new Set(), raf: 0, last: 0 };
  if (!gl) return null;
  G.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.SCISSOR_TEST);
  G.io = new IntersectionObserver((es) => { for (const e of es) { const it = e.target._smoke; if (it) it.visible = e.isIntersecting; } });
  G.ro = new ResizeObserver((es) => { for (const e of es) { const it = e.target._smoke; if (it) { it.size(); if (reduced()) it.draw(); } } });
  c.addEventListener('webglcontextlost', (e) => e.preventDefault());
  return G;
}
// Look and mode are compile-time constants, so each program keeps only its own branches. Cached per look and mode.
function program(look, mode) {
  const key = `${look}|${mode}`, gl = G.gl; let P = G.progs.get(key); if (P) return P;
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG.replace('precision highp float;\n',
    `precision highp float;\n#define uLook ${look.toFixed(1)}\n#define uMode ${mode.toFixed(1)}\n`)));
  gl.bindAttribLocation(prog, 0, 'a'); gl.linkProgram(prog);
  const U = {}; for (const n of ['uRes', 'uSize', 'uCard', 'uDpr', 'uTime', 'uBorder', 'uRadius', 'uScale', 'uReach', 'uTurb', 'uRise', 'uDensity', 'uLight', 'uEmit', 'uFlash', 'uC0', 'uC1', 'uC2', 'uC3', 'uB0', 'uB1', 'uB2', 'uB3', 'uBlend', 'uMask', 'uSwirl', 'uLanes', 'uStars', 'uArt', 'uArtOn', 'uArtRect', 'uArtFade', 'uFlow', 'uWA', 'uWB', 'uOver', 'uGlow']) U[n] = gl.getUniformLocation(prog, n);
  P = { prog, U }; G.progs.set(key, P); return P;
}
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Smoke moves slowly, so 30 frames a second looks the same as 60 for half the work.
const FRAME = 1 / 30;
function loop(t) {
  G.raf = 0;
  const dt = Math.min(.1, (t - (G.last || t)) / 1000); G.last = t;
  G.acc = (G.acc ?? FRAME) + dt;
  if (G.acc >= FRAME * .9) {
    const step = Math.min(.1, G.acc); G.acc = 0;
    for (const it of [...G.list]) {
      if (!it.c.isConnected) { it.stop(); continue; } // the card was redrawn: drop its effect
      it.step(step);
      if (it.visible && !document.hidden && !it.c.closest('[data-preview-paused]')) it.draw();
    }
  }
  if (G.list.size && !reduced()) G.raf = requestAnimationFrame(loop);
}
const kick = () => { if (G && !G.raf && G.list.size && !reduced()) { G.last = 0; G.raf = requestAnimationFrame(loop); } };

export function attachSmoke(el, styleId, { border = 6, radius = 14, speed = 1, amount = 1, maxDpr = 2, mode = 'border', sig = null,
  pad = mode === 'finish' ? 0 : mode === 'sig' ? 30 : PAD, z = 3, art = null, unit = 1, glow = false } = {}) {
  // unit: CSS px per effect px. The styles were tuned on a 210 px card; a card of width w passes w / 210 so the
  // smoke keeps its proportions. border, radius and pad are in effect px.
  const base = ALL[styleId]; if (!base) throw new Error(`No smoke style ${styleId}`);
  const PAD = pad;
  if (!shared()) return null;
  const gl = G.gl, P = program(LOOK[base.look] ?? 0, MODES[mode] ?? 0), U = P.U;
  const cols = base.colors.map(rgb), colsB = (base.colorsB ?? base.colors).map(rgb);
  const c = document.createElement('canvas'); c.className = 'smoke-canvas';
  const place = (k) => { const o = PAD * k; Object.assign(c.style, { left: `-${o}px`, top: `-${o}px`, width: `calc(100% + ${o * 2}px)`, height: `calc(100% + ${o * 2}px)` }); };
  Object.assign(c.style, { position: 'absolute', pointerEvents: 'none', zIndex: base.refract && mode === 'finish' ? 1 : z, borderRadius: mode === 'finish' ? `${radius * unit}px` : '' });
  place(unit);
  // Refraction finishes sit at z 1: the bent art goes under the card text.
  const ctx = c.getContext('2d');
  el.appendChild(c);
  const mkTex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k2, v2] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k2, v2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); return t; };
  gl.activeTexture(gl.TEXTURE0);
  const tex = mkTex(), artTex = mkTex();
  const opts = { speed, amount, unit };
  let dpr = 1, W = 0, H = 0, clock = Math.random() * 50, flash = 0, stopped = false, artImg = null, artPosY = .5, artFade = [0, 0];
  const it = { c, visible: true };
  const setArt = (a) => {
    artImg = null;
    if (!a || !base.refract) return;
    artPosY = a.posY ?? .5; artFade = a.fade ?? [0, 0];
    const up = (img) => { if (stopped) return; artImg = img; gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, artTex);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch { artImg = null; } };
    if (typeof a.src === 'string') { const img = new Image(); img.onload = () => up(img); img.src = a.src; } else up(a.src);
  };
  it.size = () => {
    dpr = Math.min(maxDpr, devicePixelRatio || 1);
    if (c._unit !== opts.unit) { c._unit = opts.unit; place(opts.unit); }
    W = Math.round(c.clientWidth * dpr); H = Math.round(c.clientHeight * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    if (G.c.width < W) G.c.width = W; if (G.c.height < H) G.c.height = H; // the shared canvas only ever grows
    if (mode === 'sig' && sig && c.clientWidth) {
      const m = inkMask(c.clientWidth, c.clientHeight, PAD * opts.unit, sig);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, m.w, m.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, m.data);
    }
  };
  it.step = (dt) => {
    clock += dt * base.speed * opts.speed;
    // Lightning: a sudden flare that fades over about a fifth of a second.
    if (base.flash) { flash = Math.max(0, flash - dt * 5); if (Math.random() < dt * .35 * base.flash) flash = .7 + Math.random() * .3; }
  };
  it.draw = () => {
    if (!W || !H) it.size(); // started while hidden (a collapsed page, a background tab)
    if (stopped || !W || !H || gl.isContextLost()) return;
    const v = base, k = opts.unit, w = c.clientWidth / k, h = c.clientHeight / k;
    gl.useProgram(P.prog);
    gl.viewport(0, 0, W, H); gl.scissor(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, artTex); gl.uniform1i(U.uArt, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U.uMask, 0);
    gl.uniform1f(U.uSwirl, v.swirl ?? 1); gl.uniform1f(U.uLanes, v.lanes ?? .75); gl.uniform1f(U.uStars, v.stars ?? 1); gl.uniform1f(U.uFlow, v.flow ?? 0);
    const wd = v.wind; gl.uniform4f(U.uWA, wd ? ({ orbit: 2, out: 3, radial: 4 }[wd.dir] ?? (wd.orbit ? 2 : 1)) : 0, wd?.in ?? -1.6, wd?.art ?? .4, wd?.out ?? 70);
    gl.uniform4f(U.uWB, wd?.gust ?? 0, wd?.lines ?? 0, wd?.spd ?? 1, wd?.side ?? .15);
    gl.uniform2f(U.uRes, W, H); gl.uniform2f(U.uSize, w, h); gl.uniform2f(U.uCard, w - PAD * 2, h - PAD * 2);
    gl.uniform1f(U.uDpr, dpr * k); gl.uniform1f(U.uTime, clock); gl.uniform1f(U.uBorder, border); gl.uniform1f(U.uRadius, radius);
    gl.uniform1f(U.uScale, v.scale); gl.uniform1f(U.uReach, v.reach * (.6 + .4 * opts.amount)); gl.uniform1f(U.uTurb, v.turb);
    gl.uniform1f(U.uRise, v.rise); gl.uniform1f(U.uDensity, v.density * opts.amount); gl.uniform1f(U.uLight, v.light);
    gl.uniform1f(U.uOver, v.overlay ?? 0); gl.uniform1f(U.uGlow, glow ? 1 : 0); gl.uniform1f(U.uEmit, v.emit ?? 0); gl.uniform1f(U.uFlash, flash); cols.forEach((col, i) => gl.uniform3fv(U[`uC${i}`], col));
    colsB.forEach((col, i) => gl.uniform3fv(U[`uB${i}`], col)); gl.uniform1f(U.uBlend, BLEND[v.blend] ?? 0);
    gl.uniform1f(U.uArtOn, artImg ? 1 : 0); gl.uniform2f(U.uArtFade, ...artFade);
    if (artImg) { // cover-crop, matching CSS background-size: cover at posY
      const cw = w - PAD * 2, ch = h - PAD * 2, iw = artImg.naturalWidth || artImg.width, ih = artImg.naturalHeight || artImg.height;
      const sc = Math.max(cw / iw, ch / ih); gl.uniform4f(U.uArtRect, (cw - iw * sc) * .5, (ch - ih * sc) * artPosY, iw * sc, ih * sc);
    }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    // GL's origin is bottom left: this effect's pixels are the bottom H rows of the shared canvas.
    ctx.globalCompositeOperation = 'copy'; ctx.drawImage(G.c, 0, G.c.height - H, W, H, 0, 0, W, H);
  };
  it.stop = () => {
    if (stopped) return; stopped = true; G.list.delete(it); G.io.unobserve(c); G.ro.unobserve(c);
    gl.deleteTexture(tex); gl.deleteTexture(artTex); c._smoke = null; c.remove();
  };
  c._smoke = it;
  it.size(); setArt(art);
  G.list.add(it); G.io.observe(c); G.ro.observe(c);
  if (reduced()) requestAnimationFrame(() => it.draw()); else kick();
  return { set(next) { const u = opts.unit; Object.assign(opts, next); if (opts.unit !== u) it.size(); if (reduced()) it.draw(); }, setArt, stop: it.stop };
}
