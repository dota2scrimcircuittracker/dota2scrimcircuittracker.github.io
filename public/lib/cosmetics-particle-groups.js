// Particle groups the card editor tunes per border or finish: each group has a count, a size and a speed.
// Saved under equipment.borderSettings[id] or equipment.finishSettings[id] as {key, keySize, keySpeed}.
// Wave items draw their groups from these numbers; codex items clone or trim the elements `selector` matches.
export const PARTICLE_GROUPS=Object.freeze({
 border:{
  'molten-gilding':[{key:'drips',label:'Drips',count:6,max:12},{key:'runs',label:'Side runs',count:0,max:16},{key:'embers',label:'Embers',count:0,max:40}],
  overgrowth:[{key:'petals',label:'Petals',count:6,max:30},{key:'fireflies',label:'Fireflies',count:0,max:30}],
  'lane-creeps':[{key:'creeps',label:'Creeps per wave',count:3,max:6}],
  'roshan-pit':[{key:'heroes',label:'Heroes',count:5,max:5}],
  'courier-run':[{key:'couriers',label:'Couriers',count:2,max:6}],
  'river-runes':[{key:'ripples',label:'Ripples',count:12,max:36}],
  'ward-vision':[{key:'wards',label:'Wards',count:6,max:12}],
  'jungle-stack':[{key:'neutrals',label:'Neutrals per camp',count:3,max:6}],
  circuit:[{key:'packets',label:'Data packets',count:7,max:24,selector:'.sig-packet'}],
  tectonic:[{key:'embers',label:'Embers',count:18,max:48},{key:'steam',label:'Steam',count:4,max:16}],
  clockwork:[{key:'planets',label:'Planets',count:6,max:12}],
  'ancient-war':[{key:'sparks',label:'Edge sparks',count:18,max:40,selector:'.v6-edge-particle'},{key:'volleys',label:'Volleys',count:20,max:40,selector:'.tier-war-volley'}],
  'event-horizon':[{key:'vapor',label:'Vapor',count:30,max:60,selector:'.exp-horizon-vapor'}],
 },
 finish:{
  'confetti-pop':[{key:'confetti',label:'Confetti',count:48,max:150}],
  'rain-glass':[{key:'beads',label:'Beads',count:70,max:180},{key:'runs',label:'Running drops',count:9,max:30}],
  'disco-ball':[{key:'spots',label:'Light spots',count:22,max:60}],
  'aurora-veil':[{key:'stars',label:'Stars',count:40,max:150},{key:'shooting',label:'Shooting stars',count:1,max:6}],
  'deep-sea':[{key:'plankton',label:'Plankton',count:28,max:80,selector:'.tier-abyss-plankton'}],
  'reality-rift':[{key:'dust',label:'Infalling dust',count:36,max:90,selector:'.exp-rift-infall'}],
 },
});
export const particleGroups=(type,id)=>PARTICLE_GROUPS[type]?.[id]??[];
export const hasParticleGroups=(type,id)=>particleGroups(type,id).length>0;
export function particleDefaults(type,id){
 const d={};
 for(const g of particleGroups(type,id))Object.assign(d,{[g.key]:g.count,[g.key+'Size']:1,[g.key+'Speed']:1});
 return d;
}
const clamp=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
export function normalizeParticles(type,id,raw={}){
 const s={};
 for(const g of particleGroups(type,id)){
  s[g.key]=Math.round(clamp(raw?.[g.key],0,g.max,g.count));
  s[g.key+'Size']=clamp(raw?.[g.key+'Size'],.5,2,1);
  s[g.key+'Speed']=clamp(raw?.[g.key+'Speed'],.25,3,1);
 }
 return s;
}
// One group's numbers, for a renderer.
export const groupOf=(type,id,settings,key)=>{const s=normalizeParticles(type,id,settings);return {count:s[key],size:s[key+'Size'],speed:s[key+'Speed']};};
// Server-side check: only known items and keys, each already inside its range.
export function validBorderSettings(raw){
 if(raw==null)return null;
 if(typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!hasParticleGroups('border',k)))throw Error('Choose valid border controls.');
 const result={};
 for(const [id,settings] of Object.entries(raw)){
  const d=particleDefaults('border',id);
  if(!settings||typeof settings!=='object'||Array.isArray(settings)||Object.keys(settings).some(k=>!(k in d)))throw Error('Choose valid border controls.');
  const normalized=normalizeParticles('border',id,settings);
  for(const [k,v] of Object.entries(settings))if(typeof v!=='number'||!Number.isFinite(v)||v!==normalized[k])throw Error('Border controls are outside their allowed range.');
  result[id]=normalized;
 }
 return result;
}
// A group's own pace on top of the card's border or finish speed. The card sets the -base variables.
export const groupPace=(type,speed)=>speed===1?'':type==='border'?`--border-speed:calc(var(--border-speed-base,1) * ${speed})`:`--particle-speed:calc(var(--particle-speed-base,1) * ${speed})`;
const field=(scope,key,label,min,max,step,value)=>`<label>${label}<output data-particle-value="${key}">${Math.round(value*100)/100}</output><input type="range" data-particle="${key}" data-particle-scope="${scope}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
export function particleControlsHtml(type,id,settings){
 const groups=particleGroups(type,id);if(!groups.length)return '';
 const s=normalizeParticles(type,id,settings);
 return `<div class="effect-particles particle-group-controls">${groups.map(g=>`<fieldset><legend>${g.label}</legend>${field(type,g.key,'Count',0,g.max,1,s[g.key])}${field(type,g.key+'Size','Size',.5,2,.1,s[g.key+'Size'])}${field(type,g.key+'Speed','Speed',.25,3,.25,s[g.key+'Speed'])}</fieldset>`).join('')}<button type="button" data-particle-reset="${type}">Reset ${type} particles</button></div>`;
}
