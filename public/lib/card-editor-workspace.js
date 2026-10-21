// Editor-only drafts: switching slots never saves or overwrites a collected design.
export function createEditorDrafts(){
 const slots=new Map();
 return {set:(slot,value)=>slots.set(slot,structuredClone(value)),get:slot=>slots.has(slot)?structuredClone(slots.get(slot)):null,has:slot=>slots.has(slot),delete:slot=>slots.delete(slot)};
}

export function rangeNumber(raw,min,max,step=1){
 if(String(raw).trim()===''||!Number.isFinite(Number(raw)))return null;
 const value=Math.max(min,Math.min(max,Number(raw))),quantum=Number(step)||1;
 return Number(Math.max(min,Math.min(max,min+Math.round((value-min)/quantum)*quantum)).toFixed(6));
}

// Correct from the object's current rendered bounds, including zoom, border insets and page movement.
export function positionAtPointer(position,pointer,grab,bounds,frame){
 const axis=(key,origin,length)=>Math.round(Math.max(0,Math.min(100,position[key]+(pointer[key]-grab[key]-bounds[origin])/frame[length]*100))*10)/10;
 return {x:axis('x','left','width'),y:axis('y','top','height')};
}
