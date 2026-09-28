// Click-to-magnify and drag-to-pan for the minimap figures (deaths, wards).
//
// The map SVG is redrawn on every filter change, so the view lives on the figure (data-zoom,
// data-zx, data-zy: zoom level and centre in map units) and applyZoom() re-applies it after
// each draw. Marks that should keep their on-screen size while zoomed read --ms from the SVG
// in a CSS transform: `transform: translate(Xpx, Ypx) scale(var(--ms, 1))` (px = map units).
// A click on the map zooms in there; a click on a mark (`skip` selector) is left to the page.

export const MAX_ZOOM = 8;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export function applyZoom(fig) {
  const svg = fig.querySelector(".wm-map svg");
  if (!svg) return;
  if (!svg.dataset.vb) svg.dataset.vb = svg.getAttribute("viewBox");
  const [bx, by, bw, bh] = svg.dataset.vb.split(" ").map(Number);
  const z = Number(fig.dataset.zoom ?? 1), w = bw / z, h = bh / z;
  const cx = clamp(Number(fig.dataset.zx ?? bx + bw / 2), bx + w / 2, bx + bw - w / 2);
  const cy = clamp(Number(fig.dataset.zy ?? by + bh / 2), by + h / 2, by + bh - h / 2);
  fig.dataset.zx = cx;
  fig.dataset.zy = cy;
  svg.setAttribute("viewBox", `${cx - w / 2} ${cy - h / 2} ${w} ${h}`);
  // Marks grow a little as you zoom (so they stay easy to hover) but much less than the map.
  svg.style.setProperty("--ms", (1 / z ** 0.8).toFixed(3));
  fig.classList.toggle("zoomed", z > 1);
  const lvl = fig.querySelector(".mz-level");
  if (lvl) lvl.textContent = z > 1 ? `${z}×` : "";
}

function zoomTo(fig, z, cx, cy) {
  fig.dataset.zoom = clamp(z, 1, MAX_ZOOM);
  if (cx != null) { fig.dataset.zx = cx; fig.dataset.zy = cy; }
  applyZoom(fig);
}

// Map units under a pointer event.
function toMap(svg, e) {
  const p = svg.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  const m = svg.getScreenCTM();
  return m ? p.matrixTransform(m.inverse()) : null;
}

// Wraps the figure's .wm-map so zoom buttons can sit on it, and wires click / drag / buttons.
export function wireZoom(fig, { skip = "" } = {}) {
  const map = fig.querySelector(".wm-map");
  if (!map || map.parentElement.classList.contains("mz-wrap")) return;
  const wrap = document.createElement("div");
  wrap.className = "mz-wrap";
  map.before(wrap);
  wrap.append(map);
  wrap.insertAdjacentHTML("beforeend", `<div class="mz-ctl">
      <span class="mz-level" aria-live="polite"></span>
      <button type="button" data-z="in" aria-label="Zoom in">+</button>
      <button type="button" data-z="out" aria-label="Zoom out">−</button>
      <button type="button" data-z="reset" aria-label="Reset zoom">⤢</button>
    </div><div class="mz-hint">Click to zoom · drag to move</div>`);
  wrap.querySelector(".mz-ctl").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const z = Number(fig.dataset.zoom ?? 1);
    if (b.dataset.z === "in") zoomTo(fig, z * 2);
    else if (b.dataset.z === "out") zoomTo(fig, z / 2);
    else zoomTo(fig, 1);
  });

  let drag = null;
  map.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, zx: Number(fig.dataset.zx), zy: Number(fig.dataset.zy), moved: false, id: e.pointerId };
  });
  map.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (Number(fig.dataset.zoom ?? 1) <= 1) return; // nothing to pan at full view
    if (!drag.moved) { drag.moved = true; map.setPointerCapture(e.pointerId); fig.classList.add("panning"); }
    const svg = map.querySelector("svg"), vb = svg.viewBox.baseVal, k = vb.width / svg.clientWidth;
    fig.dataset.zx = drag.zx - dx * k;
    fig.dataset.zy = drag.zy - dy * k;
    applyZoom(fig);
  });
  const end = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    fig.classList.remove("panning");
    if (d.moved || e.type !== "pointerup") return;
    if (skip && e.target.closest(skip)) return;
    const svg = map.querySelector("svg"), p = svg && toMap(svg, e);
    if (p) zoomTo(fig, Number(fig.dataset.zoom ?? 1) * 2, p.x, p.y);
  };
  map.addEventListener("pointerup", end);
  map.addEventListener("pointercancel", end);
  applyZoom(fig);
}
