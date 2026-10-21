// Standalone ornaments use the reviewed SVG geometry. The snake and orbit are whole effects.
const boxes={
 denim:[8,9,22,22],oxblood:[8,12,31,27],
 olive:[9,11,46,43],walnut:[8,9,40,18],
 'brushed-tin':[12,15,45,43],
 'hammered-bronze':[10,11,24,24],circuit:[11,12,24,26],
};
export const borderSymbolBox=id=>Object.hasOwn(boxes,id)?boxes[id]:null;
export const hasExpansionEmblems=id=>id==='ancient-war'||Object.hasOwn(boxes,id);
const pct=(v,start,span)=>Math.round((v-start)/span*1000)/10;
export function borderSymbolDefaults(id){
 if(id==='ancient-war')return [{x:7.5,y:6.5,size:100},{x:92.5,y:93.5,size:100}];
 const box=borderSymbolBox(id);if(!box)return null;
 const [left,top,width,height]=box,cx=left+width/2,cy=top+height/2;
 const centers=id==='denim'?[[19,20],[281,20],[281,380],[19,380]]:[[cx,cy],[300-cy,cx],[300-cx,400-cy],[cy,400-cx]];
 return centers.map(([x,y],n)=>({x:pct(x,14,272),y:pct(y,15,370),size:100,...(id!=='denim'&&n?{rotation:n===3?-90:n*90}:{})}));
}
