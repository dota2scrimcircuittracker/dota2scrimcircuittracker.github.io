// Living effects on real cards (lib/border-smoke.js styles, catalog SMOKE_CATALOG). lib/cosmetics.js and
// lib/signatures.js write a <span class="smoke-fx" data-smoke="<style>" data-smoke-mode="border|finish|sig">;
// this finds each one as it is added and starts its effect. Every effect shares one WebGL context.
// data-spd / data-amt carry the card's particle speed and amount; the border reads the card's --border-speed.
import { attachSmoke } from './border-smoke.js';

const TUNED_WIDTH = 210, TUNED_RADIUS = 14; // the review card the styles were tuned on
const SIG_FONT = "'Autograph Allura'";
const live = new Map();
const unitOf = (face) => Math.max(.3, (face?.offsetWidth || TUNED_WIDTH) / TUNED_WIDTH);

function tuning(el, mode) {
  const card = el.closest('.ft-card');
  const border = mode === 'border' ? Number.parseFloat(card ? getComputedStyle(card).getPropertyValue('--border-speed') : '') : NaN;
  return { speed: Number.isFinite(border) ? border : Math.max(.25, +el.dataset.spd || 1), amount: Math.max(.25, +el.dataset.amt || 1) };
}

async function boot(el) {
  if (live.has(el) || el._smokeBooting) return;
  const id = el.dataset.smoke, mode = el.dataset.smokeMode;
  const face = el.closest('.ft-flip')?.querySelector('.ft-front') ?? el.closest('.ft-front') ?? el.closest('.collection-swatch') ?? el.parentElement;
  if (!face) return;
  el._smokeBooting = true;
  const unit = unitOf(face), radius = (Number.parseFloat(getComputedStyle(face).borderTopLeftRadius) || TUNED_RADIUS) / unit;
  let opts;
  if (mode === 'border') opts = { mode, unit, radius, border: 6, z: 6 };
  else if (mode === 'finish') {
    const img = face.querySelector('.ft-art img');
    opts = { mode, unit, radius, z: 3, art: img?.currentSrc || img?.src ? { src: img.currentSrc || img.src, posY: .3 } : null };
  } else {
    const sig = el.closest('.card-autograph'), letters = sig?.querySelector('.autograph-lettering');
    const size = Number.parseFloat(letters ? getComputedStyle(letters).fontSize : '') || 40;
    await document.fonts.load(`${size}px ${SIG_FONT}`).catch(() => {});
    if (!el.isConnected) { el._smokeBooting = false; return; }
    opts = { mode: 'sig', unit, pad: 30, z: 1, sig: { text: letters?.textContent?.trim() || 'Fav', font: SIG_FONT, fontSize: size, slant: 0 } };
  }
  let h = null;
  // Soft smoke holds up at low resolution: borders and finishes draw at 0.6 px per CSS px and the browser smooths
  // them up; signature lettering needs to stay sharp.
  try { h = attachSmoke(el, id, { ...opts, ...tuning(el, mode), maxDpr: mode === 'sig' ? 1.25 : .6 }); } catch (err) { console.warn('smoke effect', id, err); }
  el._smokeBooting = false;
  if (!h) return;
  live.set(el, { h, face, mode });
  ro.observe(face);
}

function sweep() { for (const [el, st] of live) if (!el.isConnected) { st.h.stop(); live.delete(el); } }
function scan(node) {
  if (node.nodeType !== 1) return;
  if (node.matches('.smoke-fx')) boot(node);
  node.querySelectorAll('.smoke-fx').forEach(boot);
}
let ro;
if (typeof document !== 'undefined' && typeof ResizeObserver !== 'undefined') {
  // A card resized (the editor, a wider grid): keep the smoke in proportion.
  ro = new ResizeObserver((es) => { for (const e of es) for (const st of live.values()) if (st.face === e.target) st.h.set({ unit: unitOf(st.face) }); });
  new MutationObserver((list) => {
    let removed = false;
    for (const m of list) {
      if (m.type === 'attributes') {
        const st = live.get(m.target);
        if (st) st.h.set(tuning(m.target, st.mode));
        else if (m.attributeName === 'style' && m.target.classList.contains('ft-card')) // --border-speed changed
          for (const [el, s] of live) if (s.mode === 'border' && m.target.contains(el)) s.h.set(tuning(el, 'border'));
        continue;
      }
      m.addedNodes.forEach(scan); if (m.removedNodes.length) removed = true;
    }
    if (removed) sweep();
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-spd', 'data-amt', 'style'] });
  scan(document.documentElement);
}
