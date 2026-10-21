import {borderSymbolDefaults} from './cosmetics-expansion-symbols.js';
import {hasParticleGroups,particleDefaults,normalizeParticles} from './cosmetics-particle-groups.js';
export const EDITABLE_FINISHES=Object.freeze(['velvet','lenticular','ink-water','etched','shattered-time','supernova','deep-sea','reality-rift','aurora-veil','disco-ball']);
const finishCenters={'shattered-time':[50,40],supernova:[154/3,133/4],'deep-sea':[50,42],'reality-rift':[50,50],'aurora-veil':[50,22],'disco-ball':[50,14]};
export function finishPlacement(id,settings){
 const s=normalizeSettings('finish-'+id,settings),[x,y]=finishCenters[id]??[50,50];
 return {transform:`translate(${s.x*3} ${s.y*4}) rotate(${s.rotation}) scale(${s.size/100}) translate(${-x*3} ${-y*4})`,opacity:s.opacity/100};
}
const clamp=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
export function validFinishSettings(raw){
  if(raw==null)return null;
  if(typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!EDITABLE_FINISHES.includes(k)&&!hasParticleGroups('finish',k)))throw Error('Choose valid finish controls.');
  const result={};
  for(const [id,settings] of Object.entries(raw)){
    const d=defaults('finish-'+id);
    if(!settings||typeof settings!=='object'||Array.isArray(settings)||Object.keys(settings).some(k=>!(k in d)))throw Error('Choose valid finish controls.');
    const normalized=normalizeSettings('finish-'+id,settings);
    for(const [k,v] of Object.entries(settings))if(typeof v!=='number'||!Number.isFinite(v)||v!==normalized[k])throw Error('Finish controls are outside their allowed range.');
    result[id]=normalized;
  }
  return result;
}
export function defaults(id){
  if(id==='finish-shattered-time')return {x:50,y:40,rotation:0,size:100,opacity:100};
  if(id==='finish-supernova')return {x:54,y:63,rotation:0,size:100,opacity:100,stars:60,starSize:1.8,starSpeed:1.5,burst:0,burstSize:.5,burstSpeed:3};
  const finish=id.replace(/^finish-/, '');
  if(EDITABLE_FINISHES.includes(finish)){const [x,y]=finishCenters[finish]??[50,50];return {x,y,rotation:0,size:100,opacity:100,...particleDefaults('finish',finish)};}
  if(hasParticleGroups('finish',finish))return particleDefaults('finish',finish);
  const emblems=borderSymbolDefaults(id.replace(/^border-/,''));
  if(emblems)return {...(id==='border-ancient-war'?{selectedEmblem:0}:{}),emblems};
  return {};
}
export function normalizeSettings(id,raw={}){
  const d=defaults(id),finish=id.replace(/^finish-/,''),particles=id.startsWith('finish-')?normalizeParticles('finish',finish,raw):{},s={};
  for(const k of Object.keys(d)){
    if(k==='emblems'||k==='selectedEmblem'||k in particles)continue;
    const bounds=k==='rotation'?[-180,180]:k==='size'?[25,200]:['stars','burst'].includes(k)?[0,k==='stars'?60:40]:k.endsWith('Speed')?[.25,3]:k.endsWith('Size')?[.5,2]:[0,100];
    s[k]=clamp(raw[k],...bounds,d[k]);if(['stars','burst'].includes(k))s[k]=Math.round(s[k]);
  }
  Object.assign(s,particles);
  if(id==='border-ancient-war'){
    s.emblems=Array.isArray(raw.emblems)?raw.emblems.slice(0,8).map(e=>({x:clamp(e?.x,0,100,50),y:clamp(e?.y,0,100,50),size:clamp(e?.size,40,180,100)})):d.emblems;
    s.selectedEmblem=Math.round(clamp(raw.selectedEmblem,0,Math.max(0,s.emblems.length-1),0));
  }
  return s;
}
const field=(key,label,min,max,step,value)=>`<label>${label}<output data-effect-value="${key}">${Math.round(value*100)/100}</output><input type="range" data-effect="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
export function effectControlsHtml(equipment){
 const id='finish-'+equipment.finish,s=normalizeSettings(id,equipment.finishSettings?.[equipment.finish]);
 if(!EDITABLE_FINISHES.includes(equipment.finish))return '';
 return `<section class="effect-settings"><h3>Finish placement</h3><button type="button" data-finish-move aria-pressed="false">Move finish on card</button> <button type="button" data-finish-reset>Reset finish placement</button><div class="effect-position">${field('x','Center horizontal %',0,100,.1,s.x)}${field('y','Center vertical %',0,100,.1,s.y)}${field('rotation','Effect rotation',-180,180,1,s.rotation)}${field('size','Effect size %',25,200,1,s.size)}${field('opacity','Effect strength %',0,100,1,s.opacity)}</div>${id==='finish-supernova'?`<div class="effect-particles"><fieldset><legend>Starfield</legend>${field('stars','Star count',0,60,1,s.stars)}${field('starSize','Star size',.5,2,.1,s.starSize)}${field('starSpeed','Shimmer speed',.25,3,.25,s.starSpeed)}</fieldset><fieldset><legend>Ejecta</legend>${field('burst','Ejecta count',0,40,1,s.burst)}${field('burstSize','Ejecta size',.5,2,.1,s.burstSize)}${field('burstSpeed','Travel speed',.25,3,.25,s.burstSpeed)}</fieldset></div>`:''}</section>`;
}
