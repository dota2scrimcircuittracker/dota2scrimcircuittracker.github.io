// Compare serialized values: editor controls mutate nested settings in place.
export function equipmentUpdateKeys(e,name){
 const shown=e.layout?.name??name;
 return {
  art:JSON.stringify(e.baseCard??null),
  layout:JSON.stringify([e.layout??null,name]),
  finish:JSON.stringify([e.finish,e.particleAmount??100,e.finishSettings?.[e.finish]??null]),
  signature:JSON.stringify([e.autograph,e.translation,e.letterCase,shown,e.x,e.y,e.size,e.rotation,e.textSize]),
  border:JSON.stringify([e.border,e.borderSettings?.[e.border]??null]),
  symbols:JSON.stringify([e.border,e.emblem,e.emblems,e.borderEmblems?.[e.border]]),
 };
}
