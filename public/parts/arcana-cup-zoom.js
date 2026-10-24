// Moving between voting matchups in the Arcana Cup: the view zooms out to the whole bracket, with
// each matchup drawn as its two real cards, the matchup you're leaving lit; the light hops to the
// next one and the view zooms in until its two cards sit exactly where the voting stage shows them.
// So every matchup is a place on one map, not a separate page. Display only: it draws a copy of the
// page's bracket(s) in an overlay and removes it when done.
import { fitDesignCards } from './player-card.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const EASE = 'cubic-bezier(.65,0,.35,1)';
// An animation can stall (a hidden tab pauses frames), so every step gives up waiting a little after it should have ended.
const done = (anim, ms) => Promise.race([anim.finished, wait(ms + 250)]);

// The middle and size of a set of cards, in the page's pixels.
const boxOf = (cards) => {
  const rs = cards.map((c) => c.getBoundingClientRect());
  const l = Math.min(...rs.map((r) => r.left)), r = Math.max(...rs.map((x) => x.right)), t = Math.min(...rs.map((x) => x.top)), b = Math.max(...rs.map((x) => x.bottom));
  return { x: (l + r) / 2, y: (t + b) / 2, w: r - l };
};
const stageBox = () => {
  const cards = [...document.querySelectorAll('.cup-stage .cup-match:not([hidden]) .cup-pair .ft-card')];
  return cards.length ? boxOf(cards) : null;
};

// Resolves true when it played (calling swap() once, while the map covers the screen), false when
// it can't (no bracket or stage on the page, or either matchup isn't in the map); then swap() is not
// called. opts.cards(matchId) → the matchup's two cards as HTML, or null while a side is unknown;
// opts.title: the lane, shown in the map's headings. opts.voted: matchup ids you've voted in, drawn green on the map.
export async function zoomBetween(fromId, toId, swap, { cards, voted = [], title = '' } = {}) {
  const brackets = [...document.querySelectorAll('.cup .cup-bracket')], start = stageBox();
  if (!brackets.length || !start || !cards || !document.body.animate) return false;
  const overlay = document.createElement('div'), map = document.createElement('div');
  overlay.className = 'cup-zoom'; overlay.setAttribute('aria-hidden', 'true'); map.className = 'cup-zoom-map';
  map.innerHTML = brackets.map((b, i) => `<h5>${title ? title + ' · ' : ''}${i ? 'Losers bracket' : 'Winners bracket'}</h5>${b.outerHTML}`).join('');
  for (const slot of map.querySelectorAll('.cup-slot[data-thread]')) {
    const html = cards(slot.dataset.thread);
    if (!html) continue;
    const box = document.createElement('div');
    box.className = `cup-zoom-slot ${[...slot.classList].filter((c) => c !== 'cup-slot' && c !== 'cup-click').join(' ')}`;
    box.dataset.thread = slot.dataset.thread; box.innerHTML = html;
    slot.replaceWith(box);
  }
  overlay.append(map); document.body.append(overlay);
  let swapped = false;
  const doSwap = () => { if (!swapped) { swapped = true; swap(); } };
  try {
    const slotOf = (id) => map.querySelector(`[data-thread="${CSS.escape(id)}"]`), from = slotOf(fromId), to = slotOf(toId);
    if (!from?.querySelector('.ft-card') || !to?.querySelector('.ft-card')) { overlay.remove(); return false; }
    fitDesignCards(map);
    for (const id of voted) slotOf(id)?.classList.add('cup-zoom-voted');
    const vw = innerWidth, vh = innerHeight, W = map.offsetWidth, H = map.offsetHeight, origin = map.getBoundingClientRect();
    const spot = (slot) => { const c = boxOf([...slot.querySelectorAll('.ft-card')]); return { x: c.x - origin.left, y: c.y - origin.top, w: c.w }; };
    const a = spot(from), b = spot(to);
    // Put a slot's two cards over the stage's two cards: same size, same place.
    const over = (p, stage) => { const s = stage.w / p.w; return `translate(${stage.x - p.x * s}px, ${stage.y - p.y * s}px) scale(${s})`; };
    const fit = Math.min(1, (vw * 0.96) / W, (vh * 0.92) / H), whole = `translate(${(vw - W * fit) / 2}px, ${(vh - H * fit) / 2}px) scale(${fit})`;
    const move = (frames, duration) => done(map.animate(frames.map((transform) => ({ transform })), { duration, easing: EASE, fill: 'forwards' }), duration);
    from.classList.add('cup-zoom-hot'); map.style.transform = over(a, start);
    overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: 'forwards' });
    await move([over(a, start), whole], 420);
    from.classList.remove('cup-zoom-hot'); to.classList.add('cup-zoom-hot');
    await wait(260);
    doSwap();
    await wait(60); // the new matchup's cards fit themselves a moment after they show
    const end = stageBox() ?? start;
    await move([whole, over(b, end)], 460);
    await done(overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }), 160);
    return true;
  } catch { doSwap(); return true; } finally { overlay.remove(); }
}
