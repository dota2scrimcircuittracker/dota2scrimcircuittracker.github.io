// The app's index.html with one page's own head (title, description, colour, link-preview
// image, address), for the preview pages the deploy writes (share-pages.js, wrapped-pages.js).
// A page at its own address is the app itself: the app routes from the path (core.js here()).
export const SITE = "https://dota2scrimcircuittracker.github.io";
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const swap = (html, re, value) => {
  if (!re.test(html)) throw new Error(`index.html has no ${re}: update scripts/deploy/page-head.js`);
  return html.replace(re, value);
};
// image: the preview image's full address.
export const appPage = (app, { title, description, color, image, url, alt = title }) => [
  [/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`],
  [/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`],
  [/<meta name="theme-color" content="[^"]*">/, `<meta name="theme-color" content="${color}">`],
  [/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`],
  [/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(description)}">`],
  [/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`],
  [/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${image}">`],
  [/<meta property="og:image:alt" content="[^"]*">/, `<meta property="og:image:alt" content="${esc(alt)}">`],
  [/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`],
].reduce((html, [re, v]) => swap(html, re, v), app);
