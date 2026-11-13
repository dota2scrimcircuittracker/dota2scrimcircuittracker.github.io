// Compare serialized values: editor controls mutate nested settings in place.
export function equipmentUpdateKeys(e,name){
 const shown=e.layout?.name??name;
 return {
  art:JSON.stringify(e.baseCard??null),
  layout:JSON.stringify([e.layout??null,name]),
  finish:JSON.stringify([e.finish,e.finishStack??[],e.particleAmount??100,[e.finish,...(e.finishStack??[])].map(id=>e.finishSettings?.[id]??null)]),
  signature:JSON.stringify([e.autograph,e.translation,e.namefx,e.letterCase,shown,e.x,e.y,e.size,e.rotation,e.textSize,e.plateText]),
  border:JSON.stringify([e.border,e.borderSettings?.[e.border]??null]),
  symbols:JSON.stringify([e.border,e.emblem,e.emblems,e.borderEmblems?.[e.border]]),
 };
}
