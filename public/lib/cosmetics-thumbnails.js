import {THUMBNAIL_ART} from './cosmetics-thumbnail-art.js';

// Image documents render once and cache their pixels. Keep the full SVG tree out of
// the picker DOM; the selected card continues to use its original live SVG renderer.
export function staticThumbnailImage(svg,className){
 const selfContained=svg.replace(/^<svg\b([^>]*)>/,(_,attrs)=>`<svg${/\bxmlns=/.test(attrs)?'':' xmlns="http://www.w3.org/2000/svg"'}${attrs}>`)
  .replace(/\bhref="(?!#|data:)[^"]+"/g,`href="${THUMBNAIL_ART}"`);
 return `<img class="${className}" src="data:image/svg+xml,${encodeURIComponent(selfContained)}" alt="" loading="lazy" decoding="async">`;
}
