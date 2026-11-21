// Arcana Cup nameplates: the top 3 of each bracket in the first Arcana Cup show their name in a
// lettering built from their podium card, everywhere the site shows it. Styles are in
// nameplates.css (review page: /_review/arcana-nameplates.html). By account id.
// 154390881 placed 1st (TA) and 2nd (Satan) in Artistic; a name gets one style, so the 1st-place one.
// Cards are left alone: a card shows the signature its owner picked for it.
import { nicknameOf } from './nicknames.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const NAMEPLATES = {
  154390881: 'neon',  // 死ぬのがいいわ · Artistic 1st (TA card)
  94202887: 'gild',   // Math · Artistic 3rd
  127139604: 'hail',  // Scionara · Funny 1st
  75379546: 'sand',   // Brown · Funny 2nd (Sandstorm, his pick; Amber Glint was the first take)
  170288961: 'cook',  // slowz- · Funny 3rd
};
// The names they go by, so a name drawn without its account (a page heading, search) still gets
// its plate. Names met in player links and chosen nicknames are added as the site runs.
const KNOWN_NAMES = { 154390881: ['死ぬのがいいわ'], 94202887: ['Math'], 127139604: ['Scionara'], 75379546: ['Brown'], 170288961: ['slowz-'] };

export const nameplateOf = (id) => NAMEPLATES[String(id ?? '')] ?? null;

const byName = new Map(); // shown name -> style
const pending = new Set(); // nodes waiting for the next scan
let frame = 0;
function learn(id, name) {
  const style = nameplateOf(id), n = String(name ?? '').trim();
  if (style && n && byName.get(n) !== style) { byName.set(n, style); if (typeof document !== 'undefined') queue(document.body); }
}
for (const [id, names] of Object.entries(KNOWN_NAMES)) for (const n of names) learn(id, n);

// A name (plain text) wrapped in its owner's nameplate, or just escaped when they have none.
export function plateName(id, name) {
  const style = nameplateOf(id), text = esc(name);
  if (style) learn(id, name);
  return style ? `<span class="np np-${style}" data-text="${text}">${text}</span>` : text;
}

// Everywhere else: a text that is exactly one of those names becomes its plate. Not inside cards
// (their own signature), form fields, code or an existing plate.
const SKIP = '.np,.ft-card,input,textarea,select,option,script,style,noscript,svg,code,pre,title,[contenteditable],.no-np';
// Where a name inside longer text gets its plate: the season in review (pages/wrapped.js).
const INNER = '.wr-page,.wr-review';
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function innerPattern(split = false) {
  const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(reEsc).join('|');
  const body = `(?<![\\p{L}\\p{N}])(${names})(?![\\p{L}\\p{N}])`;
  return new RegExp(body, split ? 'gu' : 'u');
}
function plate(style, text) {
  const s = document.createElement('span');
  s.className = `np np-${style}`; s.textContent = text; s.dataset.text = text;
  return s;
}
function scan(root) {
  if (!root || !byName.size) return;
  const el = root.nodeType === 3 ? root.parentElement : root;
  if (!el || el.closest?.(SKIP)) return;
  const hits = [], inner = [], within = innerPattern();
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n.nodeValue.trim();
    if (!t || n.parentElement.closest(SKIP)) continue;
    if (byName.has(t)) hits.push(n);
    else if (n.parentElement.closest(INNER) && within.test(t)) inner.push(n);
  }
  for (const n of hits) {
    const t = n.nodeValue.trim(), [lead, trail] = n.nodeValue.split(t);
    n.replaceWith(...[lead, plate(byName.get(t), t), trail].filter((x) => x !== ''));
  }
  // Season in review (Wrapped): the name inside a line ("Brown's season in review") gets its plate too.
  for (const n of inner) n.replaceWith(...n.nodeValue.split(innerPattern(true)).filter((x) => x !== '').map((x) => byName.has(x) ? plate(byName.get(x), x) : x));
  // A name split by search highlighting (<mark>): the whole name becomes the plate.
  for (const m of el.querySelectorAll('mark')) {
    const host = m.parentElement, t = host?.textContent.trim();
    if (!t || !byName.has(t) || host.closest(SKIP) || [...host.children].some((c) => c.tagName !== 'MARK')) continue;
    host.replaceChildren(plate(byName.get(t), t));
  }
}
function queue(node) {
  if (!node || typeof requestAnimationFrame === 'undefined') return;
  pending.add(node);
  frame ||= requestAnimationFrame(() => { frame = 0; const nodes = [...pending]; pending.clear(); for (const n of nodes) if (n.isConnected) scan(n); });
}
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const start = () => {
    new MutationObserver((records) => { for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1 || n.nodeType === 3) queue(n); })
      .observe(document.body, { childList: true, subtree: true });
    queue(document.body);
  };
  document.body ? start() : document.addEventListener('DOMContentLoaded', start);
  globalThis.addEventListener?.('player-names-change', () => { for (const id of Object.keys(NAMEPLATES)) learn(id, nicknameOf(id)); });
}
