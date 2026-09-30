// Replay a feedback ticket on the real pages, for Jonah on the local server only.
// `node scripts/feedback.cjs show FB-XXXXXX` writes public/_dev/feedback/FB-XXXXXX.json
// (gitignored, never deployed; the site itself can't read tickets). Opening
// http://localhost:3000/?fbreview=FB-XXXXXX loads it and goes to the first note's page. A panel
// lists the notes; each page draws its own marks where the visitor made them: the snip box,
// the clicked element (found again by its selector, so it follows the layout), the pen
// strokes, each with a numbered pin and the note beside it.
const KEY = "feedback-review";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// The visitor may have been on the live site: replay the same path here.
const localOf = (page) => { const u = new URL(page); return u.pathname + u.search + u.hash; };
// Same page = same route (hash route or path) and same ?tab=, however the address is spelled:
// the app rewrites some addresses on load.
const routeOf = (u) => `${(u.hash.length > 2 ? u.hash.slice(1) : u.pathname).replace(/\/+$/, "")}?${new URLSearchParams(u.search).get("tab") ?? ""}`;
const here = () => routeOf(location);
const pageOf = (page) => routeOf(new URL(page));
const KIND = { snip: "Snip", click: "Click", draw: "Drawing" };

let ticket = null, root = null, layer = null, focus = null;

export async function initReview() {
  const id = new URLSearchParams(location.search).get("fbreview");
  if (id) {
    try {
      const r = await fetch(`/_dev/feedback/${encodeURIComponent(id.toUpperCase())}.json`, { cache: "no-store" });
      if (!r.ok) throw new Error(`${r.status}`);
      const t = await r.json();
      sessionStorage.setItem(KEY, JSON.stringify(t));
      sessionStorage.setItem(`${KEY}-focus`, "0");
      location.replace(localOf(t.items[0].page));
    } catch {
      alert(`No replay file for ${id}. Run: node scripts/feedback.cjs show ${id}`);
    }
    return;
  }
  try { ticket = JSON.parse(sessionStorage.getItem(KEY)); } catch { ticket = null; }
  if (!ticket) return;
  focus = Number(sessionStorage.getItem(`${KEY}-focus`) ?? -1);
  build();
  // The app renders pages asynchronously and swaps them without reloading: redraw when the
  // page or its content changes.
  let last = "";
  setInterval(() => {
    const sig = here() + "|" + document.documentElement.scrollHeight + "|" + innerWidth;
    if (sig !== last) { last = sig; draw(); }
  }, 400);
}

function build() {
  root = document.createElement("div");
  root.className = "fbr";
  root.innerHTML = `<div class="fbr-layer" aria-hidden="true"><svg class="fb-ink"></svg><div class="fbr-marks"></div></div>
    <aside class="fbr-panel" aria-label="Feedback replay"></aside>`;
  document.body.append(root);
  layer = root.querySelector(".fbr-layer");
  root.querySelector(".fbr-panel").addEventListener("click", (e) => {
    if (e.target.closest(".fbr-close")) return close();
    if (e.target.closest(".fbr-min")) { root.classList.toggle("min"); return; }
    const shot = e.target.closest("[data-shot]");
    if (shot) { openShot(Number(shot.dataset.shot)); return; }
    const li = e.target.closest("[data-n]");
    if (li) go(Number(li.dataset.n));
  });
}

function close() {
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem(`${KEY}-focus`);
  root.remove();
  ticket = null;
}

// Open a note: its page (reloading only if it's another page), then scroll to its mark.
function go(i) {
  focus = i;
  sessionStorage.setItem(`${KEY}-focus`, String(i));
  const want = localOf(ticket.items[i].page);
  if (pageOf(ticket.items[i].page) !== here()) { location.assign(want); return; }
  draw();
  scrollToFocus();
}

function scrollToFocus() {
  const m = layer.querySelector(`.fbr-mark[data-i="${focus}"]`);
  if (m) m.scrollIntoView({ block: "center", behavior: "smooth" });
}

// Where a mark is now: a clicked element is found again by its selector (the layout may
// differ from the visitor's screen); snips and drawings use the recorded page coordinates.
function boxOf(it) {
  if (it.kind === "click" && it.target?.sel) {
    let el = null;
    try { el = document.querySelector(it.target.sel); } catch { /* not a valid selector here */ }
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width || r.height) return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, found: true };
    }
  }
  return { ...it.area, found: false };
}

let scrolledFor = null;
function draw() {
  if (!ticket) return;
  const on = ticket.items.map((it, i) => ({ it, i })).filter(({ it }) => pageOf(it.page) === here());
  const marks = root.querySelector(".fbr-marks"), ink = root.querySelector(".fb-ink");
  Object.assign(layer.style, { width: "0px", height: "0px" });
  const w = document.documentElement.scrollWidth, h = document.documentElement.scrollHeight;
  Object.assign(layer.style, { width: `${w}px`, height: `${h}px` });
  ink.setAttribute("width", w); ink.setAttribute("height", h);
  ink.innerHTML = on.filter(({ it }) => it.strokes).map(({ it, i }) => `<path class="${i === focus ? "" : "fb-old"}" d="${esc(it.strokes)}"/>`).join("");
  marks.innerHTML = on.map(({ it, i }) => {
    const b = boxOf(it);
    const lost = it.kind === "click" && !b.found;
    return `<div class="fbr-mark${i === focus ? " focus" : ""}" data-i="${i}" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px">
        ${it.kind === "draw" ? "" : `<div class="fbr-box${lost ? " lost" : ""}"></div>`}
        <b class="fb-pin">${it.n + 1}</b>
        <div class="fbr-bubble">${esc(it.note)}${lost ? `<small>Element not found here; showing where it was.</small>` : ""}</div>
      </div>`;
  }).join("");
  renderPanel(on.map(({ i }) => i));
  if (focus != null && scrolledFor !== here() + focus && on.some(({ i }) => i === focus)) {
    scrolledFor = here() + focus;
    setTimeout(scrollToFocus, 50);
  }
}

function renderPanel(onPage) {
  const t = ticket;
  const sent = new Date(t.sent).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  root.querySelector(".fbr-panel").innerHTML = `
    <div class="fbr-head"><b>${esc(t.id)}</b><span>from ${esc(t.from)} · ${esc(sent)}</span>
      <button type="button" class="fbr-min" title="Collapse">–</button><button type="button" class="fbr-close" title="Stop replaying">×</button></div>
    <ol>${t.items.map((it, i) => {
      const vw = it.viewport?.w, off = vw && Math.abs(vw - innerWidth) > 40 && it.kind !== "click";
      return `<li data-n="${i}" class="${i === focus ? "focus" : ""}${onPage.includes(i) ? " here" : ""}">
        <b>${it.n + 1}</b>
        <div><span class="fbr-kind">${KIND[it.kind] ?? esc(it.kind)} · ${esc(localOf(it.page))}</span>
          <p>${esc(it.note)}</p>
          ${it.target?.text ? `<span class="fbr-meta">Element: ${esc(it.target.text.slice(0, 80))}</span>` : ""}
          ${off ? `<span class="fbr-meta warn">Made at ${vw}px wide (yours: ${innerWidth}px), so the box may sit off.</span>` : ""}
        </div>
        ${it.shot ? `<img src="${it.shot}" alt="Their screenshot" data-shot="${i}" title="Their screenshot">` : ""}
      </li>`;
    }).join("")}</ol>`;
}

function openShot(i) {
  const d = document.createElement("div");
  d.className = "fbr-shot";
  d.innerHTML = `<img src="${ticket.items[i].shot}" alt="Screenshot for note ${i + 1}">`;
  d.onclick = () => d.remove();
  root.append(d);
}
