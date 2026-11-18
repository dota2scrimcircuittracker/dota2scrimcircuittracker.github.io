// VS scene (Stream kit, ?stream=vs): two teams' cards on a transparent 1920×1080 stage for OBS. A scene is
// four layers picked on their own in the kit's scene builder (VS_FRAMES, VS_ENTRANCES, VS_STYLES and
// VS_AFTER in lib/stream-kit.js), carried as &scene=<frame>.<entrance>.<vs>.<after>, or a ready-made one
// as &anim=<id> (VS_ANIMS):
//   frame     drawn behind each team with a socket per card: none, gold draft frames, blue arcane
//             frames, or green Radiant and red Dire
//   entrance  how the cards and names come in; each card lights its socket as it lands
//   vs        the VS's colours (style.css, .vs-<id>) and how it arrives
//   after     what keeps going once the intro is over
// OBS replays the intro each time the scene comes on (the kit's import sets "Refresh browser when
// scene becomes active"). &preview=1 puts a dark backdrop behind it, for checking it in a browser.
// &sound=<id> plays that intro sound (parts/vs-sound.js VS_SOUNDS) in time with it; &sound=1 is Gong.
// &music=<id> plays a track (VS_MUSIC) on a loop from just after the VS lands. &file=<name> plays your
// Dota sound from public/audio/dota/ (&fileat=intro|vs|after, &filesync=<seconds>).
// &loop=<seconds> plays the intro again that long after it ends, over and over; the music carries on.
import { esc } from "../core.js";
import { createPlayerCards, PAINT_FILTER, fitDesignCards, flipPlayerCard, shrinkToFit } from "./player-card.js";
import { pickSlot, parseScene, sceneFromQuery } from "../lib/stream-kit.js";
import { vsSound, soundOf, musicOf, fileName, loadFile, vsHitAt } from "./vs-sound.js";

const W = 1920, H = 1080;
const MID = { x: 960, y: 560 }; // the VS, in stage pixels
const GLOW = { a: "#e8b64c", b: "#e0523e", beat: "#ff4fb8" };
// One transform shape for every keyframe, so the browser blends them step by step.
const tf = (y = 0, r = 0, sx = 1, sy = sx, x = 0) => `translateX(${x}px) translateY(${y}px) rotate(${r}deg) scale(${sx}, ${sy})`;
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const rand = (a, b) => a + Math.random() * (b - a);
// When, as a fraction of its duration, an animation eased by cubic-bezier(x1, y1, x2, y2) reaches progress p.
// A keyframe at offset p shows then, not at p × duration: with an easing that starts fast, a card's
// landing keyframe at 0.7 can show at a third of the way through. Card landings (and their sound) use this.
function reach([x1, y1, x2, y2], p) {
  const b = (a1, a2, k) => 3 * a1 * k * (1 - k) ** 2 + 3 * a2 * k * k * (1 - k) + k ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) { const k = (lo + hi) / 2; if (b(y1, y2, k) < p) lo = k; else hi = k; }
  return b(x1, x2, (lo + hi) / 2);
}
const EASE_OUT = [0, 0, 0.58, 1], EASE_IN_OUT = [0.42, 0, 0.58, 1];

// sides: [{ team: { id, name }, players: [{ name, account }] }], the first two shown.
// picks: "<team>:<account>" → slot (null or missing: the main card, or the filter's card for `mode`).
export async function mountVsScene(sides, { picks, mode, playerDesigns, getRenderer }) {
  const q = new URLSearchParams(location.search);
  const scene = parseScene(sceneFromQuery(q));
  const html = document.documentElement;
  html.classList.add("stream-vs");
  html.classList.toggle("stream-vs-preview", q.get("preview") === "1");
  const root = document.createElement("div");
  root.className = "vs-root";
  document.body.append(root);
  const scale = () => root.style.setProperty("--s", Math.min(innerWidth / W, innerHeight / H).toFixed(4));
  scale();
  addEventListener("resize", scale);
  const note = (text) => { root.innerHTML = `<div class="vs-stage"><p class="vs-note">${esc(text)}</p></div>`; };
  if (sides.length < 2) return note("Pick two teams in the Stream kit for a versus scene.");

  const [{ matches, tiers }, looked] = await Promise.all([
    getRenderer(),
    Promise.all(sides.slice(0, 2).map((s) => Promise.all(s.players.map((p) => playerDesigns(p.account))))),
  ]).catch(() => [{}, null]);
  if (!looked || !matches) return note("The cards didn't load. Refresh to try again.");

  const cards = new Map();
  const teams = sides.slice(0, 2).map((s, i) => ({
    side: i ? "b" : "a", name: s.team.name,
    players: s.players.map((p, j) => {
      const { data, designs } = looked[i][j];
      if (data?.equipment) cards.set(Number(p.account), { cosmetics: { ...data.equipment, nickname: data.nickname ?? null } });
      let slot = picks.get(`${s.team.id}:${p.account}`) ?? null;
      if (slot == null && mode !== "main") slot = pickSlot(mode, designs);
      return { ...p, design: slot == null ? null : designs.find((d) => d.slot === slot)?.design ?? null };
    }),
  }));
  const draw = createPlayerCards(matches, { cards, tiers });
  const card = (p, team) => draw.card({ account: Number(p.account), name: p.name, team: team.name }, null, { own: true, equipmentOverride: p.design });

  const markup = PAINT_FILTER + `<div class="vs-stage vs-${scene.vs} fr-${scene.frame}" aria-label="${esc(teams[0].name)} versus ${esc(teams[1].name)}">
    <div class="vs-flash"></div>
    ${teams.map((t) => `<div class="vs-side vs-${t.side}">
      <h2 class="vs-team"><span>${esc(t.name)}</span></h2>
      <div class="vs-cards">${t.players.map((p, i) => `<div class="vs-slot" data-side="${t.side}" data-i="${i}"><div class="vs-hop"><div class="vs-act">${card(p, t)}</div></div></div>`).join("")}</div>
    </div>`).join("")}
    <div class="vs-mid"><span class="vs-word">VS</span></div>
  </div>`;
  // &loop=<seconds>: start over that long after the intro ends (the kit's replay setting and its gallery).
  const loop = Number(q.get("loop")) || 0;
  const soundId = soundOf(q.get("sound")), musicId = musicOf(q.get("music")), file = fileName(q.get("file"));
  const fileAt = q.get("fileat") ?? "intro", fileSync = Math.max(0, Number(q.get("filesync")) || 0);
  const fileBuf = file ? loadFile(file) : null; // starts loading now, alongside the cards
  const run = async (again = false) => {
    clearTimers();
    root.innerHTML = markup;
    const stage = root.querySelector(".vs-stage");
    fitDesignCards(stage);
    // Card art is lazy-loaded on the site, which here meant cards flying in from off stage landed with
    // black art, and a twin card's hidden side turned in blank. Load it all first (up to 4s).
    const imgs = [...stage.querySelectorAll("img")];
    imgs.forEach((img) => { img.loading = "eager"; });
    await Promise.race([Promise.all(imgs.map((img) => img.decode().catch(() => {}))), wait(4000)]);
    await document.fonts?.ready;
    if (!stage.isConnected) return; // a newer round replaced it
    if (!stage.getBoundingClientRect().width) return later(run, 300); // not laid out yet (a hidden frame): try again
    stage.querySelectorAll(".vs-team").forEach((h) => shrinkToFit(h, { measure: h.firstElementChild, floor: 0.45 }));
    const ctx = context(stage);
    const buf = fileBuf && await fileBuf;
    if (!stage.isConnected) return;
    ctx.sfx = soundId || musicId || buf ? vsSound(soundId, { keep: again }) : null;
    // A browser tab won't play sound before a click: offer one that replays it with sound (OBS needs none).
    if (ctx.sfx?.blocked && q.get("preview") === "1") {
      const b = Object.assign(document.createElement("button"), { type: "button", className: "vs-sound-ask", textContent: "🔊 Click for sound" });
      b.addEventListener("click", () => run(), { once: true });
      root.append(b);
    }
    const end = playIntro(ctx, scene);
    if (musicId && !ctx.sfx?.kept) ctx.sfx?.music(musicId, end);
    if (buf && !(fileAt === "after" && ctx.sfx?.kept)) ctx.sfx?.file(buf, fileAt, fileSync);
    // Inside a page (the dev sound-sync tool): say when the cards land and the VS hits, in ms from now.
    if (parent !== window) parent.postMessage({ type: "vs-timeline", ...ctx.marks, end }, location.origin);
    later(() => { ctx.word.classList.add("idle"); AFTER[scene.after]?.(ctx); }, end);
    if (loop > 0) later(() => run(true), end + loop * 1000);
  };
  run();
}

// What every animation works with: the slots in arrival order (a1, b1, a2, b2, …), each slot's centre
// in stage pixels (measured before anything moves), and small helpers.
function context(stage) {
  const slotsOf = (side) => [...stage.querySelectorAll(`.vs-slot[data-side="${side}"]`)];
  const a = slotsOf("a"), b = slotsOf("b");
  const order = Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [a[i], b[i]]).flat().filter(Boolean);
  const st = stage.getBoundingClientRect(), s = st.width / W;
  const pos = new Map(order.map((el) => { const r = el.getBoundingClientRect(); return [el, { x: (r.left - st.left + r.width / 2) / s, y: (r.top - st.top + r.height / 2) / s }]; }));
  return {
    stage, a, b, order, pos,
    byX: [...order].sort((x, y) => pos.get(x).x - pos.get(y).x || pos.get(x).y - pos.get(y).y),
    word: stage.querySelector(".vs-word"), names: [...stage.querySelectorAll(".vs-team")], sides: [...stage.querySelectorAll(".vs-side")],
    dirOf: (el) => (el.dataset.side === "a" ? 1 : -1), // towards the middle
    act: (el) => el.querySelector(".vs-act"),
    card: (el) => el.querySelector(".ft-card"),
    busy: new Set(),
  };
}
const isTwin = (c) => !!c?.parentElement?.classList.contains("ft-twin");

// Shared pieces.
// The VS arrives with its own keyframes and stays shown after (its resting look is in the CSS).
function showWord(ctx, frames, opts) {
  ctx.word.animate(frames, { fill: "backwards", ...opts }).finished.then(() => { ctx.word.style.opacity = "1"; }, () => {});
}
function sweepNames(ctx, delay = 150) {
  ctx.names.forEach((h, i) => h.animate(
    [{ transform: `translateX(${i ? 700 : -700}px) skewX(${i ? 20 : -20}deg)`, opacity: 0 }, { transform: `translateX(${i ? -24 : 24}px) skewX(0deg)`, opacity: 1, offset: 0.7 }, { transform: "translateX(0px) skewX(0deg)", opacity: 1 }],
    { duration: 650, delay: delay + i * 120, easing: "cubic-bezier(.2,.8,.3,1)", fill: "backwards" }));
}
// A ring of dust where a card lands.
function ring(slot, { size = 1.7, ms = 650 } = {}) {
  const r = document.createElement("i");
  r.className = "vs-ring";
  slot.append(r);
  r.animate([{ transform: "translateX(-50%) scale(.2)", opacity: 0.9 }, { transform: `translateX(-50%) scale(${size})`, opacity: 0 }], { duration: ms, easing: "ease-out" }).onfinish = () => r.remove();
}
function shake(el, px, ms = 420) {
  const k = [0, 1, -1, 0.7, -0.6, 0.3, 0].map((f, i) => ({ transform: `translate(${(i % 2 ? -1 : 1) * px * f}px, ${px * f * 0.6}px)` }));
  el.animate(k, { duration: ms, easing: "linear", composite: "add" });
}
function flash(ctx, peak = 0.85, ms = 700) {
  ctx.stage.querySelector(".vs-flash").animate([{ opacity: 0 }, { opacity: peak, offset: 0.15 }, { opacity: 0 }], { duration: ms, easing: "ease-out" });
}
// Something drawn at the VS for one effect, removed when it ends.
function atMid(ctx, cls) {
  const el = document.createElement("i");
  el.className = cls;
  ctx.stage.querySelector(".vs-mid").append(el);
  return el;
}
// Turns a card over at once, with no turning motion (Deal starts face down).
function flipNow(ctx, el, on) {
  const c = ctx.card(el);
  if (!c || isTwin(c)) return;
  c.classList.add("vs-instant");
  flipPlayerCard(c, on);
  c.offsetWidth; // apply it before the motion comes back
  requestAnimationFrame(() => requestAnimationFrame(() => c.classList.remove("vs-instant")));
}
// Every timer goes through these, so a loop can stop the last round's before starting again.
const timers = new Set();
function later(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; }
function every(ms, fn) { fn(); const id = setInterval(fn, ms); timers.add(id); return id; }
function clearTimers() { for (const id of timers) { clearTimeout(id); clearInterval(id); } timers.clear(); }

// Frames: a Dota-style frame behind each team, shaped around its rows of cards, with a socket for
// every card. The cards land in their sockets and light them up. The look comes from the stage's
// fr-<frame> class (style.css).
const SVGNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}, cls = "") {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, typeof v === "number" ? v.toFixed(1) : v);
  if (cls) e.setAttribute("class", cls);
  return e;
}
function stageRect(ctx, el) {
  const st = ctx.stage.getBoundingClientRect(), s = st.width / W, r = el.getBoundingClientRect();
  return { x: (r.left - st.left) / s, y: (r.top - st.top) / s, w: r.width / s, h: r.height / s };
}
// The outline around rows of cards: straight sides, cut corners, stepping in or out between rows.
function framePath(rows, pad, cut) {
  const n = rows.length, c2 = cut * 0.6;
  const L = rows.map((w) => w.l - pad), R = rows.map((w) => w.r + pad), T = rows[0].t - pad, B = rows[n - 1].b + pad;
  const mid = rows.slice(1).map((w, i) => (rows[i].b + w.t) / 2);
  const pts = [[L[0] + cut, T], [R[0] - cut, T], [R[0], T + cut]];
  for (let i = 0; i < n - 1; i++) {
    const y = mid[i];
    if (R[i] - R[i + 1] > cut) pts.push([R[i], y - c2], [R[i] - c2, y], [R[i + 1], y]);
    else if (R[i + 1] - R[i] > cut) pts.push([R[i], y], [R[i + 1] - c2, y], [R[i + 1], y + c2]);
    else pts.push([R[i], y], [R[i + 1], y]);
  }
  pts.push([R[n - 1], B - cut], [R[n - 1] - cut, B], [L[n - 1] + cut, B], [L[n - 1], B - cut]);
  for (let i = n - 1; i > 0; i--) {
    const y = mid[i - 1];
    if (L[i] - L[i - 1] > cut) pts.push([L[i], y], [L[i - 1] + c2, y], [L[i - 1], y - c2]);
    else if (L[i - 1] - L[i] > cut) pts.push([L[i], y + c2], [L[i] + c2, y], [L[i - 1], y]);
    else pts.push([L[i], y], [L[i - 1], y]);
  }
  pts.push([L[0], T + cut]);
  return "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") + "Z";
}
const gem = (x, y, r) => `M${x} ${y - r}L${x + r * 0.75} ${y}L${x} ${y + r}L${x - r * 0.75} ${y}Z`;
// Draws both frames under the teams. Returns { frames: [svg a, svg b], sockets: slot → { g, lit } }.
function buildFrames(ctx, { pad = 26, cut = 24 } = {}) {
  const sockets = new Map(), frames = [];
  const first = ctx.stage.querySelector(".vs-side");
  for (const [side, slots] of [["a", ctx.a], ["b", ctx.b]]) {
    const rects = slots.map((el) => [el, stageRect(ctx, el)]);
    const rows = [];
    for (const [, r] of rects) {
      let row = rows.find((w) => Math.abs(w.t - r.y) < 30);
      if (!row) rows.push(row = { t: r.y, b: r.y + r.h, l: r.x, r: r.x + r.w });
      row.l = Math.min(row.l, r.x); row.r = Math.max(row.r, r.x + r.w); row.b = Math.max(row.b, r.y + r.h);
    }
    rows.sort((p, q) => p.t - q.t);
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}` }, `vs-frame vs-frame-${side}`);
    const defs = svgEl("defs");
    const fill = svgEl("linearGradient", { id: `vsf-fill-${side}`, x1: 0, y1: 0, x2: 0, y2: 1 });
    fill.append(svgEl("stop", { offset: 0 }, "f1"), svgEl("stop", { offset: 1 }, "f2"));
    const trim = svgEl("linearGradient", { id: `vsf-trim-${side}`, x1: 0, y1: 0, x2: 1, y2: 1 });
    trim.append(svgEl("stop", { offset: 0 }, "t1"), svgEl("stop", { offset: 0.5 }, "t2"), svgEl("stop", { offset: 1 }, "t1"));
    defs.append(fill, trim);
    const outer = framePath(rows, pad, cut), inner = framePath(rows, pad - 11, cut - 7);
    const top = rows[0], bottom = rows[rows.length - 1];
    svg.append(defs,
      svgEl("path", { d: outer }, "vs-fr-shade"),
      svgEl("path", { d: outer, fill: `url(#vsf-fill-${side})` }, "vs-fr-fill"),
      svgEl("path", { d: inner }, "vs-fr-inner"),
      svgEl("path", { d: outer }, "vs-fr-glow"),
      svgEl("path", { d: outer, stroke: `url(#vsf-trim-${side})` }, "vs-fr-trim"),
      svgEl("path", { d: gem((top.l + top.r) / 2, top.t - pad, 15) }, "vs-gem"),
      svgEl("path", { d: gem((bottom.l + bottom.r) / 2, bottom.b + pad, 15) }, "vs-gem"));
    const socks = svgEl("g");
    for (const [el, r] of rects) {
      const box = { x: r.x - 9, y: r.y - 9, width: r.w + 18, height: r.h + 18, rx: 18 };
      const g = svgEl("g", {}, "vs-sock"), lit = svgEl("g", {}, "vs-sock-lit");
      lit.append(svgEl("rect", box, "vs-sock-glow"), svgEl("rect", box, "vs-sock-line"));
      g.append(svgEl("rect", box, "vs-sock-well"), svgEl("path", { d: gem(r.x + r.w / 2, r.y + r.h / 2, 34) }, "vs-sock-mark"), svgEl("rect", box, "vs-sock-rim"), lit);
      socks.append(g);
      sockets.set(el, { g, lit });
    }
    svg.append(socks, svgEl("path", { d: outer }, "vs-fr-glint"));
    ctx.stage.insertBefore(svg, first);
    frames.push(svg);
  }
  return (ctx.fr = { frames, sockets });
}
// A socket lights up for good once its card is in.
function light(s, delay = 0) {
  s.lit.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0.8 }], { duration: 700, delay, fill: "forwards" });
}
// The frame's trim draws itself around, then the rest fades in.
function assemble(f, delay = 0) {
  const trim = f.querySelector(".vs-fr-trim"), len = trim.getTotalLength();
  trim.style.strokeDasharray = `${len} ${len}`;
  trim.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1000, delay, easing: "cubic-bezier(.5,0,.2,1)", fill: "backwards" });
  for (const p of f.querySelectorAll(".vs-fr-shade, .vs-fr-fill, .vs-fr-inner, .vs-gem, .vs-sock")) p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: delay + 450, fill: "backwards" });
}
// A short light runs around the frame's trim.
function glint(f) {
  const g = f.querySelector(".vs-fr-glint"), len = g.getTotalLength();
  g.style.strokeDasharray = `160 ${len}`;
  g.animate([{ strokeDashoffset: 160, opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.92 }, { strokeDashoffset: -len, opacity: 0 }], { duration: 2600, easing: "ease-in-out" });
}
// The trim flares, for the VS.
function flare(ctx, delay = 0) {
  ctx.fr.frames.forEach((f) => f.querySelector(".vs-fr-glow").animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: 1100, delay, easing: "ease-out" }));
}
const hopOf = (el) => el.querySelector(".vs-hop");

// ─── Entrances: how the cards (and the team names) come in. Each takes t, when it may start (after
// the frame's own arrival), calls ctx.landed(card, ms) as each card arrives, and returns when the VS
// should come. One that shows the VS first (warp, orbit, curtain) calls ctx.vsAt(ms) itself and
// returns when its cards are done.

// Jump in: cards spin up from below, land, squash and settle.
function jumpIn(ctx, t) {
  sweepNames(ctx, ctx.nl + 150);
  const T0 = t + 500, STEP = 170, DUR = 950, LAND = DUR * reach([0.3, 0.7, 0.4, 1], 0.7);
  ctx.order.forEach((el, n) => {
    const d = ctx.dirOf(el), delay = T0 + n * STEP;
    el.animate([
      { transform: tf(900, -40 * d, 0.6), opacity: 0 },
      { transform: tf(-140, 10 * d, 1.06), opacity: 1, offset: 0.5 },
      { transform: tf(0, 0, 1.1, 0.86), offset: 0.7 },
      { transform: tf(-26, -2 * d, 0.97, 1.04), offset: 0.84 },
      { transform: tf(0, 0, 1), opacity: 1 },
    ], { duration: DUR, delay, easing: "cubic-bezier(.3,.7,.4,1)", fill: "backwards" });
    later(() => ring(el), delay + LAND);
    ctx.landed(el, delay + LAND);
  });
  return T0 + (ctx.order.length - 1) * STEP + DUR + 120;
}

// Deal: the cards fly out of the middle face down, spinning, then turn face up left to right.
function dealIn(ctx, t) {
  ctx.names.forEach((h, i) => h.animate([{ opacity: 0, transform: "translateY(40px)", filter: "blur(10px)" }, { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" }], { duration: 800, delay: ctx.nl + 150 + i * 150, easing: "ease-out", fill: "backwards" }));
  ctx.order.forEach((el) => {
    if (!isTwin(ctx.card(el))) return flipNow(ctx, el, true);
    const back = document.createElement("i");
    back.className = "vs-cardback";
    ctx.act(el).append(back);
  });
  const T0 = t + 350, STEP = 140, DUR = 720;
  ctx.order.forEach((el, n) => {
    const p = ctx.pos.get(el), dx = MID.x - p.x, dy = MID.y - p.y, d = ctx.dirOf(el);
    el.animate([
      { transform: `translate(${dx}px, ${dy}px) rotate(${-220 * d}deg) scale(.35)`, opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { transform: `translate(${-dx * 0.05}px, ${-dy * 0.05}px) rotate(${5 * d}deg) scale(1.03)`, offset: 0.78 },
      { transform: "translate(0px, 0px) rotate(0deg) scale(1)", opacity: 1 },
    ], { duration: DUR, delay: T0 + n * STEP, easing: "cubic-bezier(.2,.75,.3,1)", fill: "backwards" });
  });
  const reveal = T0 + (ctx.order.length - 1) * STEP + DUR + 300, RIPPLE = 120;
  ctx.byX.forEach((el, j) => {
    later(() => {
      const c = ctx.card(el), back = el.querySelector(".vs-cardback");
      if (back) { // turn edge-on, drop the back, turn face up
        ctx.act(el).animate([{ transform: tf(0, 0, 1, 1) }, { transform: tf(-22, 0, 0.02, 1.08) }], { duration: 230, easing: "ease-in" }).finished.then(() => {
          back.remove();
          ctx.act(el).animate([{ transform: tf(-22, 0, 0.02, 1.08) }, { transform: tf(-10, 0, 1.06, 1.04), offset: 0.6 }, { transform: tf() }], { duration: 380, easing: "ease-out" });
        }, () => back.remove());
        return;
      }
      if (c && !isTwin(c)) flipPlayerCard(c, false);
      ctx.act(el).animate([{ transform: tf() }, { transform: tf(-22, 0, 1.08) }, { transform: tf() }], { duration: 600, easing: "cubic-bezier(.3,.7,.4,1)" });
    }, reveal + j * RIPPLE);
    ctx.landed(el, reveal + j * RIPPLE + 120);
  });
  return reveal + ctx.byX.length * RIPPLE + 350;
}

// Meteor: names drop, the cards crash down from above in turn, each landing shakes the stage.
function meteorIn(ctx, t) {
  ctx.names.forEach((h, i) => h.animate([{ transform: "translateY(-320px)", opacity: 0 }, { transform: "translateY(10px)", opacity: 1, offset: 0.75 }, { transform: "translateY(0px)", opacity: 1 }], { duration: 600, delay: ctx.nl + 100 + i * 120, easing: "cubic-bezier(.5,0,.5,1)", fill: "backwards" }));
  const T0 = t + 450, STEP = 210, DUR = 560, HIT = 0.7;
  ctx.order.forEach((el, n) => {
    const delay = T0 + n * STEP;
    el.animate([
      { transform: "translateY(-1300px) scale(.85, 1.5)", filter: "blur(6px) brightness(2)", easing: "cubic-bezier(.6,0,1,1)" },
      { transform: "translateY(0px) scale(1.12, .82)", filter: "blur(0px) brightness(1.7)", offset: HIT, easing: "ease-out" },
      { transform: "translateY(-16px) scale(.98, 1.03)", filter: "blur(0px) brightness(1.15)", offset: 0.86 },
      { transform: "translateY(0px) scale(1, 1)", filter: "blur(0px) brightness(1)" },
    ], { duration: DUR, delay, fill: "backwards" });
    later(() => { ring(el, { size: 2.1, ms: 750 }); shake(ctx.stage, 7, 300); }, delay + DUR * HIT);
    ctx.landed(el, delay + DUR * HIT);
  });
  return T0 + (ctx.order.length - 1) * STEP + DUR + 200;
}

// Warp: the VS comes first, a portal opens behind it, and the cards burst out of it in 3D.
function warpIn(ctx, t) {
  ctx.vsAt(t + 200);
  later(() => {
    const portal = atMid(ctx, "vs-portal");
    portal.animate([{ opacity: 0, transform: "translate(-50%, -50%) scale(.2)" }, { opacity: 1, transform: "translate(-50%, -50%) scale(1)", offset: 0.3 }, { opacity: 0, transform: "translate(-50%, -50%) scale(1.6)" }], { duration: 2200, easing: "ease-out" }).onfinish = () => portal.remove();
  }, t + 800);
  const T0 = t + 1000, STEP = 120, DUR = 820;
  ctx.order.forEach((el, n) => {
    const p = ctx.pos.get(el), dx = MID.x - p.x, dy = MID.y - p.y, d = ctx.dirOf(el);
    el.animate([
      { transform: `perspective(1200px) translate(${dx}px, ${dy}px) scale(.05) rotateY(${170 * d}deg)`, opacity: 0, filter: "blur(12px)" },
      { opacity: 1, offset: 0.25 },
      { transform: `perspective(1200px) translate(0px, 0px) scale(1.06) rotateY(${-14 * d}deg)`, filter: "blur(0px)", offset: 0.75 },
      { transform: "perspective(1200px) translate(0px, 0px) scale(1) rotateY(0deg)", filter: "blur(0px)", opacity: 1 },
    ], { duration: DUR, delay: T0 + n * STEP, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" });
    ctx.landed(el, T0 + n * STEP + DUR * reach([0.2, 0.7, 0.3, 1], 0.75));
  });
  const namesAt = T0 + (ctx.order.length - 1) * STEP + 400;
  ctx.names.forEach((h, i) => h.animate([{ opacity: 0, letterSpacing: ".7em", filter: "blur(14px)" }, { opacity: 1, letterSpacing: ".02em", filter: "blur(0px)" }], { duration: 900, delay: namesAt + i * 100, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" }));
  return namesAt + 1000;
}

// Slide: each team slides in from its side as one.
function slideIn(ctx, t) {
  ctx.sides.forEach((side, i) => {
    const s = i ? 1 : -1, at = t + 200 + i * 180;
    side.animate([
      { transform: `translateX(${1150 * s}px) skewX(${10 * s}deg)`, opacity: 0 },
      { transform: `translateX(${-30 * s}px) skewX(${-3 * s}deg)`, opacity: 1, offset: 0.75 },
      { transform: "translateX(0px) skewX(0deg)", opacity: 1 },
    ], { duration: 950, delay: at, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
    ctx.fr?.frames[i].animate([{ transform: `translateX(${1150 * s}px)`, opacity: 0 }, { transform: `translateX(${-30 * s}px)`, opacity: 1, offset: 0.75 }, { transform: "translateX(0px)", opacity: 1 }],
      { duration: 950, delay: at, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
    (i ? ctx.b : ctx.a).forEach((el) => ctx.landed(el, at + 950 * reach([0.2, 0.8, 0.2, 1], 0.75)));
  });
  return t + 1500;
}

// Glitch: names and cards flicker in as broken slices with a colour split.
function glitchFrames(n, { from = 0 } = {}) {
  const frames = Array.from({ length: n }, () => {
    const top = rand(0, 85), bottom = Math.max(0, 100 - top - rand(8, 45));
    return {
      clipPath: Math.random() < 0.25 ? "inset(0% 0% 0% 0%)" : `inset(${top.toFixed(1)}% 0% ${bottom.toFixed(1)}% 0%)`,
      transform: `translateX(${rand(-40, 40).toFixed(0)}px) skewX(${rand(-12, 12).toFixed(0)}deg)`,
      filter: `hue-rotate(${rand(0, 360).toFixed(0)}deg) drop-shadow(${rand(-10, -4).toFixed(0)}px 0 0 rgba(255,0,90,.85)) drop-shadow(${rand(4, 10).toFixed(0)}px 0 0 rgba(0,235,255,.85))`,
      opacity: Math.random() < 0.3 ? 0.35 : 1, easing: "steps(1, end)",
    };
  });
  frames[0].opacity = from;
  return [...frames, { clipPath: "inset(0% 0% 0% 0%)", transform: "translateX(0px) skewX(0deg)", filter: "hue-rotate(0deg) drop-shadow(0px 0 0 rgba(255,0,90,0)) drop-shadow(0px 0 0 rgba(0,235,255,0))", opacity: 1 }];
}
function glitchIn(ctx, t) {
  ctx.names.forEach((h, i) => h.animate(glitchFrames(9), { duration: 650, delay: ctx.nl + 200 + i * 200, fill: "backwards" }));
  const T0 = t + 550, STEP = 130, DUR = 620;
  ctx.order.forEach((el, n) => {
    el.animate(glitchFrames(8), { duration: DUR, delay: T0 + n * STEP, fill: "backwards" });
    ctx.landed(el, T0 + n * STEP + DUR);
  });
  return T0 + (ctx.order.length - 1) * STEP + DUR + 200;
}

// Rise: the cards come up through the floor under each row, left to right.
function riseIn(ctx, t) {
  ctx.names.forEach((h, i) => h.animate([{ opacity: 0, transform: "translateY(30px)" }, { opacity: 1, transform: "translateY(0px)" }], { duration: 900, delay: ctx.nl + 200 + i * 150, easing: "ease-out", fill: "backwards" }));
  const T0 = t + 400, STEP = 150, DUR = 1100, Y = 360;
  ctx.byX.forEach((el, n) => {
    el.animate([
      { transform: `translateY(${Y}px)`, clipPath: `inset(0px 0px ${Y}px 0px)`, filter: "brightness(1.8)" },
      { transform: "translateY(-10px)", clipPath: "inset(0px 0px 0px 0px)", filter: "brightness(1.15)", offset: 0.8 },
      { transform: "translateY(0px)", clipPath: "inset(0px 0px 0px 0px)", filter: "brightness(1)" },
    ], { duration: DUR, delay: T0 + n * STEP, easing: "cubic-bezier(.2,.7,.2,1)", fill: "backwards" });
    ctx.landed(el, T0 + n * STEP + DUR * reach([0.2, 0.7, 0.2, 1], 0.8));
  });
  return T0 + (ctx.byX.length - 1) * STEP + DUR - 200;
}

// Dominoes: the cards lie flat and tip up one after another, from the outside in.
const tip = (deg) => `perspective(900px) rotateX(${deg}deg)`;
function dominoIn(ctx, t) {
  ctx.names.forEach((h, i) => h.animate([{ transform: tip(90), opacity: 0, transformOrigin: "50% 0%" }, { transform: tip(-10), opacity: 1, offset: 0.7, transformOrigin: "50% 0%" }, { transform: tip(0), opacity: 1, transformOrigin: "50% 0%" }], { duration: 700, delay: ctx.nl + 150 + i * 150, easing: "ease-out", fill: "backwards" }));
  const outsideIn = [...ctx.order].sort((x, y) => Math.abs(ctx.pos.get(y).x - MID.x) - Math.abs(ctx.pos.get(x).x - MID.x));
  const T0 = t + 500, STEP = 120, DUR = 750, LAND = DUR * reach([0.4, 0, 0.3, 1], 0.65);
  outsideIn.forEach((el, n) => {
    el.animate([
      { transform: tip(-88), opacity: 0 }, { opacity: 1, offset: 0.1 },
      { transform: tip(14), offset: 0.65 }, { transform: tip(-5), offset: 0.84 }, { transform: tip(0), opacity: 1 },
    ], { duration: DUR, delay: T0 + n * STEP, easing: "cubic-bezier(.4,0,.3,1)", fill: "backwards" });
    later(() => ring(el, { size: 1.4, ms: 500 }), T0 + n * STEP + LAND);
    ctx.landed(el, T0 + n * STEP + LAND);
  });
  return T0 + (outsideIn.length - 1) * STEP + DUR;
}

// Lightning: a bolt strikes where each card lands.
function bolt(ctx, x, y, { width = 5, branches = 1 } = {}) {
  const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "vs-bolt");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const path = (x1, y1, x2, y2, n) => {
    const pts = [[x1, y1]];
    for (let i = 1; i < n; i++) { const k = i / n; pts.push([x1 + (x2 - x1) * k + rand(-45, 45), y1 + (y2 - y1) * k]); }
    pts.push([x2, y2]);
    return pts;
  };
  const main = path(x + rand(-160, 160), -40, x, y, 11);
  const lines = [main];
  for (let b = 0; b < branches; b++) { const [bx, by] = main[3 + Math.floor(Math.random() * 5)]; lines.push(path(bx, by, bx + rand(-180, 180), by + rand(80, 200), 5)); }
  lines.forEach((pts, i) => {
    const pl = document.createElementNS(NS, "polyline");
    pl.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
    pl.setAttribute("stroke-width", String(i ? width * 0.5 : width));
    svg.append(pl);
  });
  ctx.stage.append(svg);
  svg.animate([1, 0.2, 1, 0.6, 0].map((o) => ({ opacity: o })), { duration: 320, easing: "linear" }).onfinish = () => svg.remove();
}
function zap(el, delay = 0) {
  return el.animate([
    { opacity: 0, filter: "brightness(5) saturate(0)", transform: "scale(1.08)" },
    { opacity: 1, filter: "brightness(2.6) saturate(.4)", transform: "scale(1.04)", offset: 0.2 },
    { opacity: 1, filter: "brightness(1) saturate(1)", transform: "scale(1)" },
  ], { duration: 650, delay, easing: "ease-out", fill: "backwards" });
}
function thunderIn(ctx, t) {
  ctx.names.forEach((h, i) => h.animate([0, 1, 0, 1, 0.3, 1].map((o) => ({ opacity: o, easing: "steps(1, end)" })), { duration: 500, delay: ctx.nl + 200 + i * 250, fill: "backwards" }));
  const T0 = t + 600, STEP = 230;
  ctx.order.forEach((el, n) => {
    const at = T0 + n * STEP, p = ctx.pos.get(el);
    zap(el, at);
    later(() => { bolt(ctx, p.x, p.y - 150); shake(ctx.stage, 5, 220); }, at);
    ctx.landed(el, at);
  });
  return T0 + ctx.order.length * STEP + 300;
}

// Fire: each card burns into view from the bottom up behind a line of fire.
function fireIn(ctx, t) {
  ctx.names.forEach((h, i) => h.animate([{ opacity: 0, filter: "brightness(3) sepia(1) saturate(5)" }, { opacity: 1, filter: "brightness(1) sepia(0) saturate(1)" }], { duration: 1000, delay: ctx.nl + 200 + i * 200, easing: "ease-out", fill: "backwards" }));
  const T0 = t + 400, STEP = 170, DUR = 1150;
  ctx.byX.forEach((el, n) => {
    const delay = T0 + n * STEP;
    el.querySelector(".vs-hop").animate([
      { clipPath: "inset(100% 0% 0% 0%)", filter: "brightness(2) sepia(1) saturate(4) hue-rotate(-25deg)" },
      { clipPath: "inset(0% 0% 0% 0%)", filter: "brightness(1.5) sepia(.6) saturate(3) hue-rotate(-25deg)", offset: 0.7 },
      { clipPath: "inset(0% 0% 0% 0%)", filter: "brightness(1) sepia(0) saturate(1) hue-rotate(0deg)" },
    ], { duration: DUR, delay, easing: "ease-in-out", fill: "backwards" });
    const fire = document.createElement("i");
    fire.className = "vs-flame";
    el.append(fire);
    fire.animate([{ transform: "translateY(0px)", opacity: 0 }, { transform: "translateY(-25px)", opacity: 1, offset: 0.06 }, { transform: "translateY(-350px)", opacity: 1, offset: 0.7 }, { transform: "translateY(-370px)", opacity: 0 }], { duration: DUR, delay, easing: "ease-in-out", fill: "both" }).onfinish = () => fire.remove();
    ctx.landed(el, delay + DUR * reach(EASE_IN_OUT, 0.7));
  });
  return T0 + (ctx.byX.length - 1) * STEP + DUR - 100;
}

// Camera: a film move. Close on the first team, a pan across to the second, then a pull back to show it
// all, with letterbox bars that slide away.
const camera = (k, x, y) => `scale(${k}) translate(${960 - x}px, ${540 - y}px)`;
function cameraIn(ctx, t) {
  const centre = (els) => ({ x: els.reduce((s, el) => s + ctx.pos.get(el).x, 0) / els.length, y: els.reduce((s, el) => s + ctx.pos.get(el).y, 0) / els.length - 40 });
  const A = centre(ctx.a), B = centre(ctx.b), DUR = 4200, at = t + 150;
  ctx.stage.animate([
    { transform: camera(2.3, A.x, A.y) },
    { transform: camera(2.1, A.x, A.y), offset: 0.1 },
    { transform: camera(2.0, A.x + 40, A.y), offset: 0.32 },
    { transform: camera(2.0, B.x - 40, B.y), offset: 0.6 },
    { transform: camera(1.9, B.x, B.y), offset: 0.72 },
    { transform: camera(1, 960, 540) },
  ], { duration: DUR, delay: at, easing: "ease-in-out", composite: "add", fill: "backwards" });
  const root = ctx.stage.parentElement;
  for (const side of ["top", "bottom"]) {
    const bar = document.createElement("i");
    bar.className = `vs-bar vs-bar-${side}`;
    root.append(bar);
    bar.animate([{ transform: "translateY(0%)" }, { transform: "translateY(0%)", offset: (at + DUR * 0.82) / (at + DUR + 300) }, { transform: `translateY(${side === "top" ? -100 : 100}%)` }], { duration: at + DUR + 300, easing: "ease-in", fill: "forwards" }).onfinish = () => bar.remove();
  }
  ctx.order.forEach((el) => ctx.landed(el, at));
  return at + DUR - 300;
}

// Orbit: the VS comes first and the cards circle it, then spiral out to their places.
function orbitIn(ctx, t) {
  ctx.vsAt(t + 200);
  const N = ctx.order.length, DUR = 2900, T0 = t + 500, RX = 430, RY = 250, STEPS = 22;
  ctx.order.forEach((el, i) => {
    const p = ctx.pos.get(el), a0 = (i / N) * Math.PI * 2, frames = [];
    for (let s = 0; s <= STEPS; s++) {
      const k = s / STEPS;
      let x, y, z;
      if (k <= 0.55) { const a = a0 + (k / 0.55) * Math.PI * 1.3; x = MID.x + RX * Math.cos(a); y = MID.y + RY * Math.sin(a); z = 0.45; }
      else {
        const a = a0 + Math.PI * 1.3, u = 1 - (1 - (k - 0.55) / 0.45) ** 3;
        const ox = MID.x + RX * Math.cos(a), oy = MID.y + RY * Math.sin(a);
        x = ox + (p.x - ox) * u; y = oy + (p.y - oy) * u; z = 0.45 + 0.55 * u;
      }
      frames.push({ transform: `translate(${(x - p.x).toFixed(1)}px, ${(y - p.y).toFixed(1)}px) scale(${z.toFixed(3)})`, opacity: s === 0 ? 0 : 1, offset: k });
    }
    el.animate(frames, { duration: DUR, delay: T0, easing: "linear", fill: "backwards" });
    ctx.landed(el, T0 + DUR - 150);
  });
  ctx.names.forEach((h, i) => h.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1)" }], { duration: 600, delay: T0 + DUR - 300 + i * 100, easing: "cubic-bezier(.3,.7,.4,1)", fill: "backwards" }));
  later(() => { flash(ctx, 0.4, 600); ctx.word.animate([{ transform: "scale(1)" }, { transform: "scale(1.2)" }, { transform: "scale(1)" }], { duration: 450, composite: "add" }); }, T0 + DUR);
  return T0 + DUR + 900;
}

// Blade: a slash cuts across each half and the team is behind it.
function slash(ctx, x, y, angle, { len = 1200, ms = 380, delay = 0 } = {}) {
  const s = document.createElement("i");
  s.className = "vs-slash";
  s.style.left = `${x}px`;
  s.style.top = `${y}px`;
  s.style.width = `${len}px`;
  ctx.stage.append(s);
  const at = (k) => `translateY(-50%) rotate(${angle}deg) scaleX(${k})`;
  s.animate([
    { transform: at(0), opacity: 0 }, { transform: at(0.08), opacity: 1, offset: 0.04 }, { transform: at(1), opacity: 1, offset: 0.5 }, { transform: at(1), opacity: 0 },
  ], { duration: ms, delay, easing: "cubic-bezier(.6,0,.3,1)", fill: "backwards" }).onfinish = () => s.remove();
}
function bladeIn(ctx, t) {
  // The cut brings the frames in with their teams, in place of the frame's own arrival.
  if (ctx.fr) { ctx.fr.frames.forEach((f) => f.getAnimations({ subtree: true }).forEach((a) => a.cancel())); t = 0; }
  const wipe = (i) => (i
    ? [{ clipPath: "polygon(100% 0%, 100% 0%, 125% 100%, 100% 100%)" }, { clipPath: "polygon(100% 0%, -25% 0%, 0% 100%, 100% 100%)" }]
    : [{ clipPath: "polygon(0% 0%, 0% 0%, -25% 100%, 0% 100%)" }, { clipPath: "polygon(0% 0%, 125% 0%, 100% 100%, 0% 100%)" }]);
  ctx.sides.forEach((side, i) => {
    const at = t + 300 + i * 450;
    side.animate(wipe(i), { duration: 420, delay: at, easing: "cubic-bezier(.6,0,.3,1)", fill: "backwards" });
    if (ctx.fr) { // the team's own diagonal cut, in stage pixels; the outer edge eases out to take in the frame's rim
      const r = stageRect(ctx, side), y0 = r.y - 40, h = r.h + 80;
      const poly = (pts) => `polygon(${pts.map(([k, y]) => `${(r.x + k * r.w).toFixed(0)}px ${(y0 + y * h).toFixed(0)}px`).join(", ")})`;
      ctx.fr.frames[i].animate(i
        ? [{ clipPath: poly([[1, 0], [1, 0], [1.25, 1], [1.25, 1]]) }, { clipPath: poly([[1.06, 0], [-0.25, 0], [0, 1], [1.06, 1]]) }]
        : [{ clipPath: poly([[0, 0], [0, 0], [-0.25, 1], [-0.25, 1]]) }, { clipPath: poly([[-0.06, 0], [1.25, 0], [1, 1], [-0.06, 1]]) }],
        { duration: 420, delay: at, easing: "cubic-bezier(.6,0,.3,1)", fill: "backwards" });
    }
    slash(ctx, i ? 1920 : 0, 960, i ? -146 : -34, { len: 1150, delay: at - 60, ms: 520 });
    later(() => shake(ctx.stage, 6, 250), at + 200);
    (i ? ctx.b : ctx.a).forEach((el) => ctx.landed(el, at + 250));
  });
  const settle = t + 1300;
  ctx.byX.forEach((el, n) => ctx.act(el).animate([{ transform: "skewX(-16deg) scale(1.04)", filter: "brightness(1.8)" }, { transform: "skewX(5deg) scale(1)", filter: "brightness(1.2)", offset: 0.5 }, { transform: "skewX(0deg) scale(1)", filter: "brightness(1)" }], { duration: 450, delay: settle + n * 50, easing: "ease-out" }));
  return settle + 700;
}

// 8-bit: the names type in and the cards drop in choppy steps.
function retroIn(ctx, t) {
  ctx.names.forEach((h, i) => {
    const span = h.firstElementChild, text = span.textContent;
    span.textContent = "";
    [...text].forEach((_, n) => later(() => { span.textContent = text.slice(0, n + 1); }, ctx.nl + 200 + i * 400 + n * 45));
  });
  const T0 = t + 700, STEP = 160;
  ctx.order.forEach((el, n) => {
    el.animate([
      { transform: "translateY(-760px)", opacity: 1, easing: "steps(7, end)" },
      { transform: "translateY(0px)", offset: 0.6, easing: "steps(2, end)" },
      { transform: "translateY(-40px)", offset: 0.8, easing: "steps(2, end)" },
      { transform: "translateY(0px)", opacity: 1 },
    ], { duration: 780, delay: T0 + n * STEP, fill: "backwards" });
    ctx.landed(el, T0 + n * STEP + 470);
  });
  return T0 + (ctx.order.length - 1) * STEP + 900;
}

// Curtain: red curtains hide the stage with the VS on them, then part to show the teams, who bow.
function curtainIn(ctx, t) {
  const mid = ctx.stage.querySelector(".vs-mid");
  const curtains = ["l", "r"].map((s) => { const c = document.createElement("i"); c.className = `vs-drape vs-drape-${s}`; ctx.stage.insertBefore(c, mid); return c; });
  ctx.vsAt(200);
  if (ctx.fr) ctx.fr.frames.forEach((f) => f.getAnimations({ subtree: true }).forEach((a) => a.cancel()));
  const OPEN = 1300, DUR = 1700;
  if (ctx.fr) flare(ctx, OPEN + DUR * 0.5);
  curtains.forEach((c, i) => c.animate([
    { transform: "translateX(0%) skewX(0deg)" },
    { transform: `translateX(${i ? 4 : -4}%) skewX(${i ? -2 : 2}deg)`, offset: 0.15 },
    { transform: `translateX(${i ? 105 : -105}%) skewX(0deg)` },
  ], { duration: DUR, delay: OPEN, easing: "cubic-bezier(.6,0,.3,1)", fill: "both" }).onfinish = () => c.remove());
  ctx.names.forEach((h, i) => h.animate([{ opacity: 0, transform: "translateY(-20px)" }, { opacity: 1, transform: "translateY(0px)" }], { duration: 600, delay: OPEN + DUR - 200 + i * 120, easing: "ease-out", fill: "backwards" }));
  const bow = OPEN + DUR - 100;
  ctx.byX.forEach((el, n) => {
    ctx.act(el).animate([{ transform: tip(0) }, { transform: tip(-24), offset: 0.45 }, { transform: tip(0) }], { duration: 800, delay: bow + n * 90, easing: "ease-in-out" });
    ctx.landed(el, bow + n * 90 + 360);
  });
  return bow + ctx.byX.length * 90 + 900;
}

// Beat: everything lands on a 120 bpm beat, a card from each side per beat.
const BEAT = 500;
function pop(el, delay = 0) {
  return el.animate([
    { transform: "scale(0)", opacity: 0 }, { transform: "scale(1.28)", opacity: 1, offset: 0.4 },
    { transform: "scale(.9)", offset: 0.65 }, { transform: "scale(1.04)", offset: 0.85 }, { transform: "scale(1)", opacity: 1 },
  ], { duration: 460, delay, easing: "ease-out", fill: "backwards" });
}
function beatIn(ctx, t) {
  ctx.names.forEach((h) => pop(h, ctx.nl + BEAT));
  const rows = Math.max(ctx.a.length, ctx.b.length);
  for (let i = 0; i < rows; i++) {
    const at = t + BEAT * (i + 2);
    [ctx.a[i], ctx.b[i]].filter(Boolean).forEach((el) => { pop(el, at); ctx.landed(el, at + 460 * reach(EASE_OUT, 0.4)); });
    later(() => ctx.stage.animate([{ transform: "scale(1)" }, { transform: "scale(1.012)" }, { transform: "scale(1)" }], { duration: 260, composite: "add" }), at);
  }
  return t + BEAT * (rows + 2);
}

// Draft picks: captain's-mode order (a1 b1 b2 a2 a3 b3 …). With a frame, each socket blinks while it's
// choosing; the card slams down into it and locks in.
function pickIn(ctx, t) {
  sweepNames(ctx, ctx.nl + 300);
  const order = [];
  for (let i = 0; i < Math.max(ctx.a.length, ctx.b.length); i++) order.push(...(i % 2 ? [ctx.b[i], ctx.a[i]] : [ctx.a[i], ctx.b[i]]).filter(Boolean));
  const T0 = t + 700, STEP = 360, DROP = 520, SLAM = DROP * reach([0.55, 0, 0.6, 1], 0.6);
  order.forEach((el, n) => {
    const at = T0 + n * STEP, s = ctx.fr?.sockets.get(el), d = ctx.dirOf(el);
    s?.lit.animate([{ opacity: 0 }, { opacity: 0.8 }, { opacity: 0.1 }, { opacity: 0.8 }, { opacity: 0 }], { duration: 340, delay: at - 340 });
    hopOf(el).animate([
      { transform: tf(-760, -7 * d, 1.16), opacity: 0 },
      { transform: tf(-700, -7 * d, 1.16), opacity: 1, offset: 0.06 },
      { transform: tf(8, 0, 1.03, 0.95), opacity: 1, offset: 0.6 },
      { transform: tf(-6, 0, 0.99, 1.01), offset: 0.8 },
      { transform: tf(0, 0, 1), opacity: 1 },
    ], { duration: DROP, delay: at, easing: "cubic-bezier(.55,0,.6,1)", fill: "backwards" });
    ctx.landed(el, at + SLAM);
    later(() => {
      ctx.act(el).animate([{ filter: "brightness(1.9)" }, { filter: "brightness(1)" }], { duration: 380, easing: "ease-out" });
      shake(ctx.stage, 4, 220);
      if (!ctx.fr) ring(el, { size: 1.3, ms: 450 });
    }, at + SLAM);
  });
  return T0 + order.length * STEP + 350;
}

// Teleport: a teleport circle opens under every card and channels, then each blinks in on a column of light.
function tpCircle(el, { delay = 0, ms = 1600, peak = 1 } = {}) {
  const tp = document.createElement("i");
  tp.className = "vs-tp";
  el.prepend(tp);
  tp.animate([
    { opacity: 0, transform: "scale(.3)" }, { opacity: peak, transform: "scale(1)", offset: 0.22 },
    { opacity: peak, transform: "scale(1.04)", offset: 0.82 }, { opacity: 0, transform: "scale(1.35)" },
  ], { duration: ms, delay, easing: "ease-out", fill: "backwards" }).onfinish = () => tp.remove();
}
function motes(el, n, from, span) {
  for (let k = 0; k < n; k++) {
    const m = document.createElement("i");
    m.className = "vs-mote";
    m.style.left = `${rand(15, 85)}%`;
    m.style.top = `${rand(55, 90)}%`;
    el.append(m);
    m.animate([{ transform: "translateY(0px) scale(.6)", opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: `translateY(${-rand(160, 280)}px) scale(1)`, opacity: 0 }],
      { duration: rand(900, 1400), delay: from + rand(0, span), easing: "ease-out", fill: "backwards" }).onfinish = () => m.remove();
  }
}
function beam(host, delay = 0, cls = "vs-beam") {
  const b = document.createElement("i");
  b.className = cls;
  host.append(b);
  b.animate([{ transform: "scaleX(0)", opacity: 0 }, { transform: "scaleX(1)", opacity: 1, offset: 0.25 }, { transform: "scaleX(.2)", opacity: 0 }], { duration: 560, delay, easing: "ease-out", fill: "backwards" }).onfinish = () => b.remove();
}
function teleportIn(ctx, t) {
  sweepNames(ctx, ctx.nl + 300);
  const T0 = t + 200, STEP = 150, CHANNEL = 1400;
  ctx.order.forEach((el, n) => {
    const at = T0 + n * STEP, arrive = at + CHANNEL;
    tpCircle(el, { delay: at, ms: CHANNEL + 380 });
    motes(el, 6, at + 150, CHANNEL - 500);
    hopOf(el).animate([
      { opacity: 0, transform: tf(0, 0, 0.84, 1.22), filter: "brightness(4) saturate(0)" },
      { opacity: 1, transform: tf(0, 0, 1.04, 0.98), filter: "brightness(2.2) saturate(.4)", offset: 0.3 },
      { opacity: 1, transform: tf(0, 0, 1), filter: "brightness(1) saturate(1)" },
    ], { duration: 560, delay: arrive, easing: "ease-out", fill: "backwards" });
    beam(el, arrive - 60);
    ctx.landed(el, arrive);
  });
  return T0 + (ctx.order.length - 1) * STEP + CHANNEL + 450;
}

// Emerge: the cards rise up out of their places from the outside in, sparking in their side's colour.
function sparks(ctx, side, x, y, n, { spread = 120, rise = [120, 260], delay = 0 } = {}) {
  for (let k = 0; k < n; k++) {
    const p = document.createElement("i");
    p.className = `vs-spark vs-spark-${side}`;
    p.style.left = `${x + rand(-spread, spread)}px`;
    p.style.top = `${y}px`;
    ctx.stage.append(p);
    const dx = rand(-40, 40);
    p.animate([{ transform: "translate(0px, 0px)", opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: `translate(${dx}px, ${-rand(...rise)}px)`, opacity: 0 }],
      { duration: rand(1100, 1900), delay: delay + rand(0, 300), easing: "ease-out", fill: "backwards" }).onfinish = () => p.remove();
  }
}
function emergeIn(ctx, t) {
  sweepNames(ctx, ctx.nl + 400);
  const outerFirst = (list) => [...list].sort((p, q) => Math.abs(ctx.pos.get(q).x - 960) - Math.abs(ctx.pos.get(p).x - 960) || ctx.pos.get(p).y - ctx.pos.get(q).y);
  const T0 = t + 400, STEP = 260, RISE = 720;
  [outerFirst(ctx.a), outerFirst(ctx.b)].forEach((list) => list.forEach((el, i) => {
    const at = T0 + i * STEP, p = ctx.pos.get(el), r = stageRect(ctx, el);
    el.style.clipPath = "inset(-80px -80px 0px -80px)";
    hopOf(el).animate([
      { transform: tf(r.h + 10), filter: "brightness(.35)" },
      { transform: tf(-16), filter: "brightness(1.3)", offset: 0.72 },
      { transform: tf(0), filter: "brightness(1)" },
    ], { duration: RISE, delay: at, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" }).finished.then(() => { el.style.clipPath = ""; }, () => {});
    sparks(ctx, el.dataset.side, p.x, r.y + r.h, 8, { delay: at, rise: [60, 180] });
    ctx.landed(el, at + RISE * reach([0.2, 0.7, 0.3, 1], 0.72));
  }));
  return T0 + (Math.max(ctx.a.length, ctx.b.length) - 1) * STEP + RISE + 250;
}

// ─── The VS: its colours come from the stage's vs-<id> class (style.css); these are how it arrives.
// Each takes the time it comes and returns when its intro is over.
const VS = {
  jump(ctx, at) {
    showWord(ctx, [
      { transform: "scale(5) rotate(-14deg)", opacity: 0 },
      { transform: "scale(.86) rotate(3deg)", opacity: 1, offset: 0.55 },
      { transform: "scale(1.12) rotate(-1deg)", opacity: 1, offset: 0.78 },
      { transform: "scale(1) rotate(0deg)", opacity: 1 },
    ], { duration: 620, delay: at, easing: "cubic-bezier(.5,0,.4,1)" });
    later(() => {
      shake(ctx.stage, 14);
      flash(ctx);
      ctx.order.forEach((el) => { const d = ctx.dirOf(el); ctx.act(el).animate([{ transform: tf() }, { transform: tf(-10, -6 * d, 1, 1, -22 * d), offset: 0.3 }, { transform: tf() }], { duration: 600, easing: "ease-out" }); });
    }, at + 340);
    return at + 1100;
  },
  deal(ctx, at) {
    showWord(ctx, [{ opacity: 0, transform: "scale(.3) rotate(0deg)" }, { opacity: 1, transform: "scale(1.15) rotate(0deg)", offset: 0.6 }, { opacity: 1, transform: "scale(1) rotate(0deg)" }], { duration: 520, delay: at, easing: "cubic-bezier(.3,.7,.4,1)" });
    later(() => flash(ctx, 0.45, 600), at + 250);
    return at + 1100;
  },
  meteor(ctx, at) {
    showWord(ctx, [
      { opacity: 0, transform: "scale(2.6) rotate(0deg)" },
      { opacity: 1, transform: "scale(.9) rotate(0deg)", offset: 0.5 },
      { opacity: 1, transform: "scale(1) rotate(0deg)" },
    ], { duration: 520, delay: at, easing: "cubic-bezier(.6,0,.4,1)" });
    later(() => {
      const rays = atMid(ctx, "vs-rays");
      rays.animate([{ opacity: 0, transform: "translate(-50%, -50%) scale(.3) rotate(0deg)" }, { opacity: 1, offset: 0.25 }, { opacity: 0, transform: "translate(-50%, -50%) scale(1.5) rotate(50deg)" }], { duration: 1100, easing: "ease-out" }).onfinish = () => rays.remove();
      flash(ctx, 0.9, 800);
      shake(ctx.stage, 16, 500);
    }, at + 260);
    return at + 1300;
  },
  warp(ctx, at) {
    showWord(ctx, [
      { opacity: 0, transform: "scale(0) rotate(-540deg)" },
      { opacity: 1, transform: "scale(1.3) rotate(12deg)", offset: 0.75 },
      { opacity: 1, transform: "scale(1) rotate(0deg)" },
    ], { duration: 850, delay: at, easing: "cubic-bezier(.3,.6,.3,1)" });
    return at + 1000;
  },
  spotlight(ctx, at) {
    later(() => [1, -1].forEach((s, i) => {
      const streak = atMid(ctx, "vs-streak");
      streak.animate([{ transform: `translate(-50%, -50%) rotate(${22 * s}deg) translateX(${-1500 * s}px)`, opacity: 1 }, { transform: `translate(-50%, -50%) rotate(${22 * s}deg) translateX(${1500 * s}px)`, opacity: 1 }], { duration: 650, delay: i * 90, easing: "cubic-bezier(.5,0,.5,1)" }).onfinish = () => streak.remove();
    }), Math.max(0, at - 350));
    showWord(ctx, [{ opacity: 0, transform: "scale(3, .15)" }, { opacity: 1, transform: "scale(.9, 1.12)", offset: 0.6 }, { opacity: 1, transform: "scale(1, 1)" }], { duration: 480, delay: at, easing: "cubic-bezier(.3,.7,.4,1)" });
    later(() => flash(ctx, 0.5, 600), at + 150);
    return at + 1100;
  },
  glitch(ctx, at) {
    showWord(ctx, [0, 1, 0, 0, 1, 0.25, 1, 0, 0.8, 1].map((o) => ({ opacity: o, transform: "scale(1)", easing: "steps(1, end)" })), { duration: 1000, delay: at });
    later(() => { flash(ctx, 0.35, 300); shake(ctx.stage, 6, 250); }, at + 600);
    return at + 1500;
  },
  rise(ctx, at) {
    showWord(ctx, [{ opacity: 0, letterSpacing: ".6em", transform: "scale(1.3)" }, { opacity: 1, letterSpacing: "-.02em", transform: "scale(1)" }], { duration: 1000, delay: at, easing: "cubic-bezier(.2,.7,.2,1)" });
    later(() => flash(ctx, 0.35, 900), at + 700);
    return at + 1400;
  },
  domino(ctx, at) {
    showWord(ctx, [{ transform: tip(-88), opacity: 0, transformOrigin: "50% 80%" }, { transform: tip(16), opacity: 1, offset: 0.65, transformOrigin: "50% 80%" }, { transform: tip(0), opacity: 1, transformOrigin: "50% 80%" }], { duration: 700, delay: at, easing: "cubic-bezier(.4,0,.3,1)" });
    later(() => shake(ctx.stage, 8, 300), at + 450);
    return at + 1300;
  },
  thunder(ctx, at) {
    later(() => { bolt(ctx, MID.x, MID.y - 40, { width: 9, branches: 3 }); flash(ctx, 0.95, 500); shake(ctx.stage, 14, 450); }, at);
    showWord(ctx, [{ opacity: 0, filter: "brightness(5)" }, { opacity: 1, filter: "brightness(3)", offset: 0.15 }, { opacity: 1, filter: "brightness(1)" }], { duration: 700, delay: at });
    return at + 1200;
  },
  inferno(ctx, at) {
    showWord(ctx, [0, 0.7, 0.2, 1, 0.6, 1].map((o, i, a) => ({ opacity: o, transform: `scale(${0.8 + (0.2 * i) / (a.length - 1)})` })), { duration: 900, delay: at, easing: "ease-out" });
    return at + 1300;
  },
  camera(ctx, at) {
    showWord(ctx, [{ opacity: 0, transform: "scale(1.6)" }, { opacity: 1, transform: "scale(1)" }], { duration: 450, delay: at, easing: "cubic-bezier(.3,.7,.4,1)" });
    later(() => flash(ctx, 0.9, 500), at);
    return at + 1000;
  },
  orbit(ctx, at) {
    showWord(ctx, [{ opacity: 0, transform: "scale(.4) rotate(0deg)" }, { opacity: 1, transform: "scale(1.1) rotate(0deg)", offset: 0.7 }, { opacity: 1, transform: "scale(1) rotate(0deg)" }], { duration: 700, delay: at, easing: "ease-out" });
    return at + 900;
  },
  blade(ctx, at) {
    slash(ctx, MID.x - 300, MID.y + 110, -20, { len: 640, delay: Math.max(0, at - 80), ms: 420 });
    showWord(ctx, [{ opacity: 1, clipPath: "polygon(0% 0%, 0% 0%, -30% 100%, -30% 100%)", transform: "scale(1.1)" }, { opacity: 1, clipPath: "polygon(0% 0%, 130% 0%, 100% 100%, -30% 100%)", transform: "scale(1)" }], { duration: 300, delay: at, easing: "cubic-bezier(.6,0,.3,1)" });
    later(() => { flash(ctx, 0.6, 400); shake(ctx.stage, 10, 300); }, at + 150);
    return at + 1000;
  },
  retro(ctx, at) {
    showWord(ctx, [0, 1, 0, 1, 0, 1].map((o) => ({ opacity: o, transform: "scale(1)", easing: "steps(1, end)" })), { duration: 700, delay: at });
    return at + 1200;
  },
  curtain(ctx, at) {
    showWord(ctx, [{ opacity: 0, transform: "scale(.7)" }, { opacity: 1, transform: "scale(1)" }], { duration: 700, delay: at, easing: "ease-out" });
    return at + 900;
  },
  beat(ctx, at) {
    showWord(ctx, [{ opacity: 0, transform: "scale(0)" }, { opacity: 1, transform: "scale(1.5)", offset: 0.4 }, { opacity: 1, transform: "scale(.9)", offset: 0.7 }, { opacity: 1, transform: "scale(1)" }], { duration: 480, delay: at, easing: "ease-out" });
    later(() => { flash(ctx, 0.6, 400); shake(ctx.stage, 8, 250); }, at);
    return at + BEAT * 2;
  },
  draft(ctx, at) {
    showWord(ctx, [
      { transform: "scale(4) rotate(8deg)", opacity: 0 },
      { transform: "scale(.88) rotate(-2deg)", opacity: 1, offset: 0.55 },
      { transform: "scale(1.08)", opacity: 1, offset: 0.78 },
      { transform: "scale(1) rotate(0deg)", opacity: 1 },
    ], { duration: 600, delay: at, easing: "cubic-bezier(.5,0,.4,1)" });
    later(() => { shake(ctx.stage, 12); flash(ctx, 0.7); }, at + 330);
    return at + 1200;
  },
  teleport(ctx, at) {
    beam(ctx.stage.querySelector(".vs-mid"), Math.max(0, at - 80), "vs-beam vs-beam-mid");
    showWord(ctx, [
      { transform: "scale(.25, 2.6)", opacity: 0 },
      { transform: "scale(1.12, .9)", opacity: 1, offset: 0.45 },
      { transform: "scale(1)", opacity: 1 },
    ], { duration: 520, delay: at, easing: "ease-out" });
    later(() => flash(ctx, 0.55, 600), at);
    return at + 1100;
  },
  ancient(ctx, at) {
    showWord(ctx, [
      { transform: "scale(2.8)", opacity: 0, letterSpacing: "1.2em" },
      { transform: "scale(.9)", opacity: 1, letterSpacing: "-.02em", offset: 0.6 },
      { transform: "scale(1)", opacity: 1, letterSpacing: "-.02em" },
    ], { duration: 560, delay: at, easing: "cubic-bezier(.5,0,.4,1)" });
    later(() => {
      shake(ctx.stage, 13); flash(ctx, 0.6);
      sparks(ctx, "a", MID.x - 90, MID.y, 14, { spread: 60, rise: [120, 320] });
      sparks(ctx, "b", MID.x + 90, MID.y, 14, { spread: 60, rise: [120, 320] });
    }, at + 330);
    return at + 1200;
  },
};

// ─── Afterwards: what keeps going once the intro is over.

// Brawl: the cards bob, and every couple of seconds something happens.
function brawlAfter(ctx) {
  const { order, word, dirOf, act, busy } = ctx;
  bob(ctx);
  const free = (list = order) => list.filter((el) => !busy.has(el));
  const hold = (els, ms) => { els.forEach((el) => busy.add(el)); later(() => els.forEach((el) => busy.delete(el)), ms); };
  const moves = {
    hop(el) { // a jump with a full spin and a squashed landing
      const d = dirOf(el);
      hold([el], 1000);
      act(el).animate([
        { transform: tf() }, { transform: tf(10, 0, 1.06, 0.9), offset: 0.12 },
        { transform: tf(-130, 180 * d, 1.04), offset: 0.5 }, { transform: tf(0, 360 * d, 1.08, 0.9), offset: 0.82 }, { transform: tf(0, 360 * d) },
      ], { duration: 900, easing: "cubic-bezier(.35,.6,.4,1)" });
      later(() => ring(el), 740);
    },
    async flip(el) { // turns over to its stats, then back
      const c = ctx.card(el);
      if (!c || isTwin(c)) return moves.glow(el);
      hold([el], 5000);
      act(el).animate([{ transform: tf() }, { transform: tf(-30, 0, 1.08) }], { duration: 300, fill: "forwards", easing: "ease-out" });
      flipPlayerCard(c, true);
      await wait(3800);
      flipPlayerCard(c, false);
      await wait(350);
      act(el).animate([{ transform: tf(-30, 0, 1.08) }, { transform: tf() }], { duration: 350, fill: "forwards", easing: "ease-in" });
    },
    taunt(el) { // leans at the other team and shakes
      const d = dirOf(el);
      hold([el], 1300);
      act(el).animate([
        { transform: tf() }, { transform: tf(-12, 9 * d, 1.05, 1.05, 34 * d), offset: 0.25 },
        { transform: tf(-12, 3 * d, 1.05, 1.05, 44 * d), offset: 0.38 }, { transform: tf(-12, 11 * d, 1.05, 1.05, 30 * d), offset: 0.5 },
        { transform: tf(-12, 3 * d, 1.05, 1.05, 44 * d), offset: 0.62 }, { transform: tf() },
      ], { duration: 1200, easing: "ease-in-out" });
    },
    glow(el) { // lifts and lights up in its team's colour
      hold([el], 1400);
      act(el).animate([
        { transform: tf(), filter: "drop-shadow(0 0 0 transparent)" },
        { transform: tf(-18, 0, 1.08), filter: `drop-shadow(0 0 30px ${GLOW[el.dataset.side]})`, offset: 0.45 },
        { transform: tf(), filter: "drop-shadow(0 0 0 transparent)" },
      ], { duration: 1300, easing: "ease-in-out" });
    },
    wave() { // one team hops in turn, left to right
      const side = pick(["a", "b"]), team = ctx.byX.filter((el) => el.dataset.side === side);
      if (team.some((el) => busy.has(el))) return;
      hold(team, 600 + team.length * 110);
      team.forEach((el, i) => act(el).animate([{ transform: tf() }, { transform: tf(-60, 0, 1.04) }, { transform: tf() }], { duration: 520, delay: i * 110, easing: "cubic-bezier(.3,.7,.4,1)" }));
    },
    clash() { // a card from each side lunges at the middle; they bounce off and the VS shakes
      const x = pick(free(ctx.a)), y = pick(free(ctx.b));
      if (!x || !y) return;
      hold([x, y], 1100);
      for (const el of [x, y]) {
        const d = dirOf(el);
        act(el).animate([
          { transform: tf() }, { transform: tf(-10, -4 * d, 0.97, 0.97, -16 * d), offset: 0.2 },
          { transform: tf(-24, 8 * d, 1.08, 1.08, 90 * d), offset: 0.45 }, { transform: tf(-6, -5 * d, 1, 1, -14 * d), offset: 0.65 }, { transform: tf() },
        ], { duration: 1000, easing: "ease-in-out" });
      }
      later(() => { shake(word, 10); word.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 380, easing: "ease-out", composite: "add" }); }, 450);
    },
  };
  const bag = [["hop", 3], ["flip", 2], ["taunt", 2], ["glow", 2], ["wave", 1], ["clash", 1]].flatMap(([m, n]) => Array(n).fill(m));
  every(1900, () => {
    const m = pick(bag);
    if (m === "wave" || m === "clash") moves[m]();
    else { const el = pick(free()); if (el) moves[m](el); }
  });
}
function bob(ctx) {
  ctx.order.forEach((el) => { const hop = hopOf(el); hop.style.setProperty("--d", `${(-Math.random() * 3.2).toFixed(2)}s`); hop.classList.add("idle"); });
}
// A shine sweeps across every card, left to right.
function shineAfter(ctx) {
  for (const el of ctx.order) { const s = document.createElement("i"); s.className = "vs-sheen"; ctx.act(el).append(s); }
  every(6000, () => ctx.byX.forEach((el) => {
    el.querySelector(".vs-sheen").animate([{ backgroundPosition: "160% 0", opacity: 1 }, { backgroundPosition: "-60% 0", opacity: 1 }], { duration: 900, delay: (ctx.pos.get(el).x / W) * 900, easing: "ease-in-out" });
  }));
}
// An energy ring rolls out from the VS; each card lights up as it passes.
function pulseAfter(ctx) {
  const SPEED = 1100; // stage pixels per second
  every(4500, () => {
    const p = atMid(ctx, "vs-pulse");
    p.animate([{ transform: "translate(-50%, -50%) scale(0)", opacity: 0.9 }, { transform: "translate(-50%, -50%) scale(1)", opacity: 0 }], { duration: 1200 * 1000 / SPEED, easing: "cubic-bezier(.2,.6,.4,1)" }).onfinish = () => p.remove();
    ctx.word.animate([{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }], { duration: 400, easing: "ease-out", composite: "add" });
    for (const el of ctx.order) {
      const q = ctx.pos.get(el), dist = Math.hypot(q.x - MID.x, q.y - MID.y);
      ctx.act(el).animate([
        { transform: tf(), filter: "drop-shadow(0 0 0 transparent) brightness(1)" },
        { transform: tf(-14, 0, 1.05), filter: `drop-shadow(0 0 26px ${GLOW[el.dataset.side]}) brightness(1.25)`, offset: 0.35 },
        { transform: tf(), filter: "drop-shadow(0 0 0 transparent) brightness(1)" },
      ], { duration: 800, delay: (dist / SPEED) * 1000 * 0.55, easing: "ease-out" });
    }
  });
}
// Each team sways slowly in 3D, and the cards float.
function swayAfter(ctx) {
  ctx.fr?.frames.forEach((f, i) => { const r = stageRect(ctx, ctx.sides[i]); f.style.transformOrigin = `${r.x + r.w / 2}px ${r.y + r.h / 2}px`; });
  ctx.stage.classList.add("vs-swaying");
  bob(ctx);
}
// The spotlight steps through every player in turn; after a round everyone is lit for a beat.
function spotlightAfter(ctx) {
  ctx.stage.classList.add("vs-spotting");
  const seq = [...ctx.order, null]; // null: the beat where everyone is lit
  let i = 0;
  every(2600, () => {
    ctx.order.forEach((el) => el.classList.remove("lit"));
    const el = seq[i++ % seq.length];
    ctx.stage.classList.toggle("vs-spot", !!el);
    if (el) el.classList.add("lit");
  });
}
// A random card glitches for a moment; now and then the VS buzzes.
function glitchAfter(ctx) {
  let n = 0;
  every(2300, () => {
    pick(ctx.order).animate(glitchFrames(5, { from: 1 }), { duration: 320 });
    if (++n % 3 === 0) ctx.word.animate([1, 0.2, 1, 0, 1].map((o) => ({ opacity: o, easing: "steps(1, end)" })), { duration: 380 });
  });
}
// The cards breathe, a slow swell that rolls left to right.
function breatheAfter(ctx) {
  ctx.stage.classList.add("vs-breathing");
  ctx.order.forEach((el) => hopOf(el).style.setProperty("--d", `${(-(ctx.pos.get(el).x / W) * 4).toFixed(2)}s`));
}
// A domino wave: the cards tip back and up across the whole stage.
function waveAfter(ctx) {
  every(5500, () => ctx.byX.forEach((el, i) => ctx.act(el).animate([{ transform: tip(0) }, { transform: tip(-38), offset: 0.4 }, { transform: tip(7), offset: 0.75 }, { transform: tip(0) }], { duration: 700, delay: i * 90, easing: "ease-in-out" })));
}
// Lightning strikes a random card now and then; with a frame its socket flares.
function lightningAfter(ctx) {
  every(3200, () => {
    const el = pick(ctx.order), p = ctx.pos.get(el);
    bolt(ctx, p.x, p.y - 150);
    ctx.act(el).animate([{ transform: tf(), filter: "brightness(2.4)" }, { transform: tf(0, 0, 1, 1, 6), offset: 0.2 }, { transform: tf(0, 0, 1, 1, -6), offset: 0.4 }, { transform: tf(), filter: "brightness(1)" }], { duration: 450, easing: "ease-out" });
    ctx.fr?.sockets.get(el)?.lit.animate([{ filter: "brightness(2.2)" }, { filter: "brightness(1)" }], { duration: 600, easing: "ease-out" });
  });
}
// Embers drift up off the cards.
function embersAfter(ctx) {
  every(240, () => {
    const p = ctx.pos.get(pick(ctx.order)), e = document.createElement("i");
    e.className = "vs-ember";
    e.style.left = `${p.x + rand(-115, 115)}px`;
    e.style.top = `${p.y + rand(-120, 170)}px`;
    ctx.stage.append(e);
    const rise = rand(160, 280), drift = rand(-50, 50);
    e.animate([{ transform: "translate(0px, 0px) scale(1)", opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: `translate(${drift}px, ${-rise}px) scale(.3)`, opacity: 0 }], { duration: rand(1500, 2400), easing: "ease-out" }).onfinish = () => e.remove();
  });
}
// A slow drift, as if the camera were handheld.
function driftAfter(ctx) {
  ctx.stage.animate([{ transform: "scale(1) translate(0px, 0px)" }, { transform: "scale(1.035) translate(-14px, -6px)" }, { transform: "scale(1.02) translate(12px, 4px)" }], { duration: 14000, direction: "alternate", iterations: Infinity, easing: "ease-in-out", composite: "add" });
}
// Each card drifts round a small circle of its own.
function orbitAfter(ctx) {
  ctx.stage.classList.add("vs-orbiting");
  ctx.order.forEach((el) => hopOf(el).style.setProperty("--d", `${(-Math.random() * 6).toFixed(2)}s`));
}
// A slash crosses the stage and the cards flinch as it passes.
function slashAfter(ctx) {
  every(4800, () => {
    const angle = rand(-30, -12), y = rand(380, 740);
    slash(ctx, -60, y, angle, { len: 2300, ms: 500 });
    ctx.byX.forEach((el) => ctx.act(el).animate([{ transform: "skewX(0deg)" }, { transform: "skewX(-10deg) translateX(10px)" }, { transform: "skewX(0deg)" }], { duration: 300, delay: (ctx.pos.get(el).x / W) * 250, easing: "ease-out" }));
  });
}
// A random card does an 8-bit hop; the VS blinks now and then.
function hopsAfter(ctx) {
  let n = 0;
  every(1600, () => {
    ctx.act(pick(ctx.order)).animate([{ transform: "translateY(0px)", easing: "steps(3, end)" }, { transform: "translateY(-48px)", easing: "steps(3, end)" }, { transform: "translateY(0px)" }], { duration: 480 });
    if (++n % 4 === 0) ctx.word.animate([1, 0, 1, 0, 1].map((o) => ({ opacity: o, easing: "steps(1, end)" })), { duration: 500 });
  });
}
// Gold sparkles glint on the cards.
function sparklesAfter(ctx) {
  every(650, () => {
    const el = pick(ctx.order), s = document.createElement("i");
    s.className = "vs-sparkle";
    s.style.left = `${rand(10, 90)}%`;
    s.style.top = `${rand(8, 92)}%`;
    el.append(s);
    s.animate([{ transform: "translate(-50%, -50%) scale(0) rotate(0deg)", opacity: 0 }, { transform: "translate(-50%, -50%) scale(1) rotate(45deg)", opacity: 1, offset: 0.4 }, { transform: "translate(-50%, -50%) scale(0) rotate(90deg)", opacity: 0 }], { duration: 900, easing: "ease-in-out" }).onfinish = () => s.remove();
  });
}
// The pulse: every beat a small thump, every bar a glow.
function beatAfter(ctx) {
  let n = 0;
  every(BEAT, () => {
    const bar = n++ % 4 === 0;
    ctx.word.animate([{ transform: "scale(1)" }, { transform: `scale(${bar ? 1.18 : 1.07})` }, { transform: "scale(1)" }], { duration: 300, easing: "ease-out", composite: "add" });
    const side = n % 2 ? ctx.a : ctx.b;
    for (const el of bar ? ctx.order : side) {
      ctx.act(el).animate(bar
        ? [{ transform: "scale(1)", filter: "drop-shadow(0 0 0 transparent)" }, { transform: "scale(1.05)", filter: `drop-shadow(0 0 24px ${GLOW.beat})` }, { transform: "scale(1)", filter: "drop-shadow(0 0 0 transparent)" }]
        : [{ transform: "scale(1)" }, { transform: "scale(1.03)" }, { transform: "scale(1)" }], { duration: 320, easing: "ease-out" });
    }
  });
}
// A light runs around the frames and now and then a socket pulses; with no frame a card glows instead.
function glintAfter(ctx) {
  if (ctx.fr) {
    every(3400, () => ctx.fr.frames.forEach((f, i) => later(() => glint(f), i * 500)));
    every(1700, () => pick([...ctx.fr.sockets.values()]).lit.animate([{ filter: "brightness(1)" }, { filter: "brightness(1.8)" }, { filter: "brightness(1)" }], { duration: 900, easing: "ease-in-out" }));
    return;
  }
  every(1700, () => {
    const el = pick(ctx.order);
    ctx.act(el).animate([{ filter: "drop-shadow(0 0 0 transparent)" }, { filter: `drop-shadow(0 0 26px ${GLOW[el.dataset.side]})` }, { filter: "drop-shadow(0 0 0 transparent)" }], { duration: 900, easing: "ease-in-out" });
  });
}
// Now and then a faint teleport circle opens under a card and it shimmers.
function shimmerAfter(ctx) {
  every(1900, () => {
    const el = pick(ctx.order);
    tpCircle(el, { ms: 1500, peak: 0.55 });
    motes(el, 3, 0, 500);
    ctx.act(el).animate([{ filter: "brightness(1)" }, { filter: "brightness(1.35) saturate(1.2)" }, { filter: "brightness(1)" }], { duration: 1100, easing: "ease-in-out" });
  });
  if (ctx.fr) every(4200, () => ctx.fr.frames.forEach((f) => glint(f)));
}
// Each side keeps sparking in its colour from the bottom of its frame (or its cards), and any sockets glow slowly.
function sparksAfter(ctx) {
  ctx.stage.classList.add("vs-pulsing");
  const base = ["a", "b"].map((side, i) => {
    if (ctx.fr) { const r = ctx.fr.frames[i].querySelector(".vs-fr-fill").getBBox(); return { side, x: r.x + r.width / 2, y: r.y + r.height, w: r.width / 2 }; }
    const rs = ctx[side].map((el) => stageRect(ctx, el)), l = Math.min(...rs.map((r) => r.x)), rr = Math.max(...rs.map((r) => r.x + r.w)), b = Math.max(...rs.map((r) => r.y + r.h));
    return { side, x: (l + rr) / 2, y: b + 20, w: (rr - l) / 2 };
  });
  every(380, () => base.forEach((b) => sparks(ctx, b.side, b.x, b.y - 20, 1, { spread: b.w * 0.8, rise: [200, 420] })));
}

// ─── Frames: drawn behind the teams before anything else, each with its own arrival. Each returns
// when the cards may start coming in.
const FRAMES = {
  none: () => 0,
  gold(ctx) {
    buildFrames(ctx).frames.forEach((f, i) => assemble(f, i * 150));
    return 1000;
  },
  blue(ctx) {
    buildFrames(ctx).frames.forEach((f) => f.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: "ease-out", fill: "backwards" }));
    return 500;
  },
  // Team colours: each frame unfolds from its middle line.
  team(ctx) {
    buildFrames(ctx).frames.forEach((f, i) => {
      const r = f.querySelector(".vs-fr-fill").getBBox(), y = r.y + r.height / 2;
      f.style.transformOrigin = `0px ${y}px`;
      f.animate([{ transform: "scaleY(0)", opacity: 0 }, { transform: "scaleY(1.06)", opacity: 1, offset: 0.7 }, { transform: "scaleY(1)", opacity: 1 }],
        { duration: 650, delay: 150 + i * 150, easing: "cubic-bezier(.3,.8,.3,1)", fill: "backwards" });
    });
    return 900;
  },
  // Aegis: the frames drop in from above and land with a thud.
  aegis(ctx) {
    buildFrames(ctx).frames.forEach((f, i) => f.animate([
      { transform: "translateY(-1200px)", opacity: 1 }, { transform: "translateY(14px)", offset: 0.75 }, { transform: "translateY(-6px)", offset: 0.88 }, { transform: "translateY(0px)", opacity: 1 },
    ], { duration: 700, delay: 150 + i * 180, easing: "cubic-bezier(.55,0,.6,1)", fill: "backwards" }));
    later(() => { shake(ctx.stage, 10, 320); flash(ctx, 0.35, 500); }, 680);
    later(() => shake(ctx.stage, 10, 320), 860);
    ctx.sfx?.thud(680); ctx.sfx?.thud(860);
    return 1000;
  },
  // Molten: the frames rise from below red hot and cool to black stone.
  molten(ctx) {
    buildFrames(ctx).frames.forEach((f, i) => f.animate([
      { transform: "translateY(700px)", filter: "brightness(2.6) saturate(1.6)", opacity: 0 },
      { transform: "translateY(-10px)", filter: "brightness(1.8) saturate(1.4)", opacity: 1, offset: 0.6 },
      { transform: "translateY(0px)", filter: "brightness(1) saturate(1)", opacity: 1 },
    ], { duration: 1100, delay: 100 + i * 160, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" }));
    return 1000;
  },
  // Neon: the frames buzz on like a sign, one side then the other.
  neon(ctx) {
    buildFrames(ctx).frames.forEach((f, i) => f.animate([0, 1, 0, 0.3, 1, 0, 1, 0.6, 1].map((o) => ({ opacity: o, easing: "steps(1, end)" })), { duration: 800, delay: 150 + i * 250, fill: "backwards" }));
    return 900;
  },
  // Arcana: the trim draws itself in, then flares.
  arcana(ctx) {
    buildFrames(ctx).frames.forEach((f, i) => assemble(f, i * 200));
    later(() => ctx.fr.frames.forEach((f) => f.querySelector(".vs-fr-glow").animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 900, easing: "ease-out" })), 1000);
    return 1100;
  },
  // Glass: the frames sharpen out of a blur.
  glass(ctx) {
    buildFrames(ctx).frames.forEach((f, i) => f.animate([
      { opacity: 0, filter: "blur(24px)", transform: "scale(1.04)" }, { opacity: 1, filter: "blur(0px)", transform: "scale(1)" },
    ], { duration: 900, delay: 100 + i * 150, easing: "ease-out", fill: "backwards" }));
    return 800;
  },
  rd(ctx) {
    buildFrames(ctx).frames.forEach((f, i) => f.animate([
      { transform: `translateX(${i ? 1100 : -1100}px)` }, { transform: `translateX(${i ? -16 : 16}px)`, offset: 0.8 }, { transform: "translateX(0px)" },
    ], { duration: 760, delay: 150 + i * 160, easing: "cubic-bezier(.3,.8,.3,1)", fill: "backwards" }));
    later(() => shake(ctx.stage, 8, 300), 760);
    later(() => shake(ctx.stage, 8, 300), 920);
    ctx.sfx?.thud(760); ctx.sfx?.thud(920);
    return 1000;
  },
};
const ENTRANCES = {
  jump: jumpIn, deal: dealIn, meteor: meteorIn, warp: warpIn, slide: slideIn, glitch: glitchIn, rise: riseIn, domino: dominoIn,
  thunder: thunderIn, fire: fireIn, camera: cameraIn, orbit: orbitIn, blade: bladeIn, retro: retroIn, curtain: curtainIn,
  beat: beatIn, pick: pickIn, teleport: teleportIn, emerge: emergeIn,
};
const AFTER = {
  still: null, brawl: brawlAfter, shine: shineAfter, pulse: pulseAfter, sway: swayAfter, spotlight: spotlightAfter, glitch: glitchAfter,
  breathe: breatheAfter, wave: waveAfter, lightning: lightningAfter, embers: embersAfter, drift: driftAfter, orbit: orbitAfter,
  slash: slashAfter, hops: hopsAfter, sparkles: sparklesAfter, beat: beatAfter, glint: glintAfter, shimmer: shimmerAfter, sparks: sparksAfter,
};
// The intro: the frame, then the entrance, then the VS (or the VS first, for an entrance that wants it).
// Returns when it's over.
function playIntro(ctx, scene) {
  const t = FRAMES[scene.frame](ctx);
  ctx.nl = Math.max(0, t - 500); // the team names may start a little before the cards
  let vsEnd = null, vsTime = null;
  ctx.vsAt = (at) => { vsTime = at; vsEnd = VS[scene.vs](ctx, at); ctx.sfx?.vs(scene.vs, at); ctx.marks.vs = vsHitAt(scene.vs, at); };
  ctx.marks = { lands: [], vs: null, frame: t };
  ctx.landed = (el, at) => { const s = ctx.fr?.sockets.get(el); if (s) light(s, at); ctx.sfx?.land(el.dataset.side, at); ctx.marks.lands.push(at); };
  if (ctx.fr) ctx.sfx?.frame(t);
  const ret = ENTRANCES[scene.enter](ctx, t);
  if (vsEnd == null) ctx.vsAt(ret);
  ctx.sfx?.done();
  if (ctx.fr) flare(ctx, vsTime + 330);
  return Math.max(vsEnd, vsTime === ret ? 0 : ret);
}
