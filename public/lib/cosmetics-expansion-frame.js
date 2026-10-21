import {border,pattern} from './cosmetics-expansion-assets.js';
const originalFrame='M19 9H281Q292 9 292 21V379Q292 391 280 391H20Q8 391 8 379V21Q8 9 19 9ZM34 28V372H266V28Z';
const outer='M19 9H281Q292 9 292 21V379Q292 391 280 391H20Q8 391 8 379V21Q8 9 19 9Z';
const hole=w=>`M${8+w} ${9+w}V${391-w}H${292-w}V${9+w}Z`;
const inset=w=>`M${8+w} ${9+w}H${292-w}V${391-w}H${8+w}Z`;
function narrowBorder(i,id,width){
  // Edit the existing frame geometry. Its paint and ornaments come directly from round two.
  let art=border(i,id).replace(originalFrame,outer+hole(width)).replace('M33 28H267V372H33Z',inset(width));
  const centerX=8+width/2,centerY=9+width/2;
  art=art.replace('x="17" y="18" width="266" height="364"',`x="${centerX}" y="${centerY}" width="${284-width}" height="${382-width}"`);
  if(i.id==='border-porcelain')art=art.replaceAll('#3c6495','#173b70').replaceAll('#55769b','#214c7c');
  if(i.id==='border-ouroboros'){
    const serpent='M44 18H257Q282 18 282 44V355Q282 381 258 381H43Q18 381 18 355V66';
    const slimmer=`M44 ${centerY}H257Q${292-width/2} ${centerY} ${292-width/2} 44V355Q${292-width/2} ${391-width/2} 258 ${391-width/2}H43Q${centerX} ${391-width/2} ${centerX} 355V66`;
    art=art.replaceAll(serpent,slimmer).replace('stroke-width="18"',`stroke-width="${width+1}"`).replace('stroke-width="13"',`stroke-width="${width-1}"`);
  }
  // Keep the full original fortress silhouettes and the original teal lane.
  if(i.id==='border-ancient-war'){
    const lane=`M${centerX} 47V${391-width/2-12}Q${centerX} ${391-width/2} 53 ${391-width/2}H270`;
    art=art.replaceAll('M28 47V360Q28 377 53 377H270',lane);
  }
  return art;
}

export {narrowBorder};
