// Canvas particle finishes for card cosmetics (rain, clouds, lightning, smoke, rot, leaves, ethereal motes).
// A finish draws a <canvas class="fx-canvas" data-fx="..." data-amt data-spd> inside the card's .particles layer
// (lib/cosmetics.js cosmeticLayers). One shared animation loop runs only the canvases that are on screen.
// data-amt scales the particle count and data-spd the speed (both 1 = as authored), read every frame.
const RAIN = {
  rainfx:   { n: 70,  speed: 520, len: 16, wind: -40,  blobs: 2, rise: .15, mist: .10, flash: false, alpha: .75, dark: false },
  downpour: { n: 150, speed: 820, len: 24, wind: -170, blobs: 2, rise: .2,  mist: .16, flash: true,  alpha: .85, dark: true },
  mist:     { n: 120, speed: 300, len: 9,  wind: -20,  blobs: 10, rise: 1.15, mist: .34, flash: false, alpha: .5,  dark: false },
};
const rnd = (a, b) => a + Math.random() * (b - a);

function rainMaker(kind) {
  const cfg = RAIN[kind];
  return (ctx, o) => {
    let w = 0, hh = 0, drops = [], flash = 0, nextFlash = rnd(2, 6);
    const blobs = Array.from({ length: cfg.blobs }, () => ({ x: Math.random(), ph: rnd(0, 6.28), sp: rnd(.08, .5), ry: rnd(.3, 1), r: rnd(.4, .95), a: rnd(.5, 1) }));
    const mk = init => ({ x: rnd(-10, w + 50), y: init ? rnd(0, hh) : rnd(-30, -30 - hh * .3), z: rnd(.45, 1), j: rnd(-1, 1) });
    return {
      resize(W, H) { w = W; hh = H; drops = []; },
      frame(dt, clock) {
        const { amt, spd } = o.current;
        for (const b of blobs) {
          const x = w * (b.x + .4 * Math.sin(clock * b.sp * spd + b.ph) + .15 * Math.sin(clock * b.sp * spd * 2.3 + b.ph * 2.2));
          const wob = .5 + .25 * Math.sin(clock * b.sp * spd * .7 + b.ph * 1.3) + .25 * Math.sin(clock * b.sp * spd * 1.9 + b.ph * 3.1);
          const y = hh * (1 - cfg.rise * wob * b.ry);
          const a = cfg.mist * b.a * (.55 + .45 * Math.sin(clock * b.sp * spd * 2 + b.ph));
          const r = w * b.r * (.8 + .3 * Math.sin(clock * b.sp * spd + b.ph * 2));
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(170,205,245,${a})`); g.addColorStop(1, "rgba(170,205,245,0)");
          ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
        }
        const target = Math.round(cfg.n * (w * hh) / (200 * 280) * amt);
        while (drops.length < target) drops.push(mk(true));
        if (drops.length > target) drops.length = target;
        ctx.lineCap = "round";
        for (const d of drops) {
          const vy = cfg.speed * d.z * spd, vx = (cfg.wind + d.j * (kind === "mist" ? 45 : 8)) * d.z * spd, L = cfg.len * d.z;
          ctx.strokeStyle = `rgba(205,228,255,${cfg.alpha * (.25 + .75 * d.z)})`;
          ctx.lineWidth = .6 + d.z * .9;
          ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - vx / vy * L, d.y - L); ctx.stroke();
          d.y += vy * dt; d.x += vx * dt;
          if (d.y > hh + 30) Object.assign(d, mk(false));
          if (d.x < -20) d.x += w + 40;
        }
        if (cfg.flash) {
          nextFlash -= dt * spd;
          if (nextFlash < 0) { flash = 1; nextFlash = rnd(3, 9); }
          if (flash > 0) {
            ctx.fillStyle = `rgba(200,222,255,${flash * .3})`; ctx.fillRect(0, 0, w, hh);
            flash -= dt * (Math.random() < .2 ? 1 : 3.2);
          }
        }
      },
    };
  };
}

function cloudMaker(ctx, o) {
  let w = 0, hh = 0, puffs = [];
  const mk = init => {
    const s = rnd(.28, .62) * w;
    return { x: init ? rnd(-s, w + s) : -s * 1.3, y: rnd(-.05, .95) * hh, s, v: rnd(5, 14) * (.6 + s / w), a: rnd(.14, .3),
      parts: Array.from({ length: 5 }, () => ({ dx: rnd(-.6, .6), dy: rnd(-.12, .12), r: rnd(.35, .6) })) };
  };
  return {
    resize(W, H) { w = W; hh = H; puffs = []; },
    frame(dt) {
      const { amt, spd } = o.current;
      const target = Math.round(8 * amt);
      while (puffs.length < target) puffs.push(mk(true));
      if (puffs.length > target) puffs.length = target;
      for (const p of puffs) {
        p.x += p.v * spd * dt;
        if (p.x - p.s * 1.3 > w) Object.assign(p, mk(false));
        for (const q of p.parts) {
          const cx = p.x + q.dx * p.s, cy = p.y + q.dy * p.s, r = q.r * p.s;
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, `rgba(228,238,252,${p.a})`); g.addColorStop(1, "rgba(228,238,252,0)");
          ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
      }
    },
  };
}

function boltMaker(ctx, o) {
  let w = 0, hh = 0, bolts = [], flash = 0, next = .6;
  const trace = (x, y, dir, len, jitter) => {
    const pts = [[x, y]];
    for (let i = 0; i < len; i++) {
      x += rnd(-jitter, jitter) + dir * rnd(0, jitter * .6); y += rnd(10, 22);
      pts.push([x, y]);
      if (y > hh + 10) break;
    }
    return pts;
  };
  const spawn = amt => {
    const x0 = rnd(.12, .88) * w;
    const main = trace(x0, -6, 0, 40, 16);
    const paths = [{ pts: main, wd: 1 }];
    for (let i = 3; i < main.length - 2; i++) {
      if (Math.random() < .13 * amt) { const [bx, by] = main[i]; paths.push({ pts: trace(bx, by, Math.random() < .5 ? -1 : 1, rnd(3, 8), 13), wd: .55 }); }
    }
    bolts.push({ paths, t: 0, life: rnd(.4, .6) });
    flash = 1;
  };
  return {
    resize(W, H) { w = W; hh = H; bolts = []; },
    frame(dt) {
      const { amt, spd } = o.current;
      next -= dt * spd;
      if (next < 0) { spawn(amt); if (amt > 1.4) spawn(amt); next = rnd(1.6, 4.2); }
      if (flash > 0) { ctx.fillStyle = `rgba(165,190,255,${flash * .24})`; ctx.fillRect(0, 0, w, hh); flash -= dt * 2.6; }
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i]; b.t += dt * spd;
        if (b.t > b.life) { bolts.splice(i, 1); continue; }
        const f = Math.pow(1 - b.t / b.life, 1.5) * (b.t > .09 && Math.random() < .25 ? .35 : 1);
        for (const p of b.paths) {
          ctx.beginPath(); p.pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
          ctx.strokeStyle = `rgba(110,150,255,${f * .45})`; ctx.lineWidth = 6 * p.wd; ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,255,${f})`; ctx.lineWidth = 1.7 * p.wd; ctx.stroke();
        }
      }
    },
  };
}

/* ---------- v5 makers: puffs (smoke, rot), sprites (embers, souls, frost, leaves, ethereal), slashes ---------- */
const PUFF = {
  smoke: { n: 7, rgb: "120,90,160", a: [.16, .3], vy: [-16, -34], vx: [-6, 6], size: [.3, .6] },
  rot:   { n: 9, rgb: "150,190,60", a: [.14, .26], vy: [-8, -20], vx: [-10, 10], size: [.25, .5] },
};
function puffMaker(kind) {
  const c = PUFF[kind];
  return (ctx, o) => {
    let w = 0, hh = 0, puffs = [];
    const mk = init => {
      const s = rnd(c.size[0], c.size[1]) * w;
      return { x: rnd(-.1, 1.1) * w, y: init ? rnd(0, 1.2) * hh : hh + s * .6, s, vx: rnd(c.vx[0], c.vx[1]), vy: rnd(c.vy[0], c.vy[1]), a: rnd(c.a[0], c.a[1]), ph: rnd(0, 6.28),
        parts: Array.from({ length: 4 }, () => ({ dx: rnd(-.5, .5), dy: rnd(-.3, .3), r: rnd(.4, .7) })) };
    };
    return {
      resize(W, H) { w = W; hh = H; puffs = []; },
      frame(dt, clock) {
        const { amt, spd } = o.current;
        const target = Math.round(c.n * amt);
        while (puffs.length < target) puffs.push(mk(true));
        if (puffs.length > target) puffs.length = target;
        for (const p of puffs) {
          p.x += (p.vx + 8 * Math.sin(clock * .6 + p.ph)) * spd * dt; p.y += p.vy * spd * dt;
          if (p.y + p.s < -10) Object.assign(p, mk(false));
          const fade = Math.min(1, Math.max(0, (p.y + p.s * .3) / (hh * .4)), (hh + p.s - p.y) / (p.s * .8));
          for (const q of p.parts) {
            const cx = p.x + q.dx * p.s, cy = p.y + q.dy * p.s, r = q.r * p.s;
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, `rgba(${c.rgb},${p.a * fade})`); g.addColorStop(1, `rgba(${c.rgb},0)`);
            ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
          }
        }
      },
    };
  };
}

const SPR = {
  leaf:     { n: 22, shape: "leaf", cols: ["130,220,90", "214,194,74", "70,170,70"], vy: [14, 38], vx: [-30, -8], size: [3, 6], sway: 20, glow: 0, spin: true },
  ethereal: { n: 34, shape: "dot",  cols: ["200,250,255", "255,255,255", "190,170,255"], vy: [-14, -34], vx: [-6, 6], size: [1, 2.8], sway: 18, glow: 8, pulse: true },
};
function sprMaker(kind) {
  const c = SPR[kind];
  return (ctx, o) => {
    let w = 0, hh = 0, ps = [];
    const mk = init => {
      const up = c.vy[0] < 0;
      return { x: rnd(0, w), y: init ? rnd(0, hh) : (up ? hh + 10 : -10), vy: rnd(c.vy[0], c.vy[1]), vx: rnd(c.vx[0], c.vx[1]), s: rnd(c.size[0], c.size[1]), col: c.cols[Math.floor(Math.random() * c.cols.length)], ph: rnd(0, 6.28), rot: rnd(0, 6.28), rs: rnd(-2, 2) };
    };
    const draw = (p, a) => {
      ctx.fillStyle = `rgba(${p.col},${a})`; ctx.strokeStyle = ctx.fillStyle;
      if (c.glow) { ctx.shadowColor = `rgba(${p.col},${a})`; ctx.shadowBlur = c.glow; } else ctx.shadowBlur = 0;
      if (c.shape === "dot") { ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill(); }
      else if (c.shape === "soul") {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill();
        ctx.lineWidth = p.s * .8; ctx.globalAlpha = .5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .25, p.y + Math.abs(p.vy) * .35); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (c.shape === "flake") {
        ctx.lineWidth = .8; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath();
        for (let k = 0; k < 3; k++) { const an = k * 1.0472; ctx.moveTo(-Math.cos(an) * p.s * 1.6, -Math.sin(an) * p.s * 1.6); ctx.lineTo(Math.cos(an) * p.s * 1.6, Math.sin(an) * p.s * 1.6); }
        ctx.stroke(); ctx.restore();
      } else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath();
        ctx.moveTo(-p.s, 0); ctx.quadraticCurveTo(0, -p.s * .8, p.s, 0); ctx.quadraticCurveTo(0, p.s * .8, -p.s, 0); ctx.fill(); ctx.restore();
      }
      ctx.shadowBlur = 0;
    };
    return {
      resize(W, H) { w = W; hh = H; ps = []; },
      frame(dt, clock) {
        const { amt, spd } = o.current;
        const target = Math.round(c.n * (w * hh) / (200 * 280) * amt);
        while (ps.length < target) ps.push(mk(true));
        if (ps.length > target) ps.length = target;
        for (const p of ps) {
          p.y += p.vy * spd * dt; p.x += (p.vx + c.sway * Math.sin(clock * 1.3 + p.ph)) * spd * dt; p.rot += p.rs * spd * dt;
          if (p.y < -14 || p.y > hh + 14 || p.x < -20 || p.x > w + 20) { Object.assign(p, mk(false)); if (p.x < 0 || p.x > w) p.x = rnd(0, w); }
          let a = .85;
          if (c.pulse) a = .25 + .6 * (.5 + .5 * Math.sin(clock * 1.8 + p.ph));
          if (c.flick) a = .55 + .45 * Math.random();
          const edge = Math.min(1, p.y / 40, (hh - p.y) / 40); draw(p, Math.max(0, a * Math.min(1, edge + .3)));
        }
      },
    };
  };
}

const MAKERS = { rainfx: rainMaker("rainfx"), downpour: rainMaker("downpour"), mist: rainMaker("mist"), clouds: cloudMaker, lightning: boltMaker,
  smoke: puffMaker("smoke"), rot: puffMaker("rot"), leaf: sprMaker("leaf"), ethereal: sprMaker("ethereal") };
// Finish id (catalog) to canvas maker.
export const CANVAS_FINISHES = Object.freeze({ 'fx-rain': 'rainfx', 'fx-downpour': 'downpour', 'fx-mist': 'mist', 'fx-clouds': 'clouds', 'fx-lightning': 'lightning',
  'fx-smoke': 'smoke', 'fx-rot': 'rot', 'fx-leaf': 'leaf', 'fx-ethereal': 'ethereal' });

const live = new Map();
let raf = 0, last = 0;
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const dpr = () => Math.min(1.5, window.devicePixelRatio || 1);
let io = null, ro = null;

function size(st) {
  const c = st.c, r = dpr();
  st.w = c.clientWidth; st.h = c.clientHeight;
  c.width = Math.max(1, Math.round(st.w * r)); c.height = Math.max(1, Math.round(st.h * r));
  st.ctx.setTransform(r, 0, 0, r, 0, 0);
  st.fx.resize(st.w, st.h);
  if (still()) draw(st, 0);
}
function draw(st, dt) {
  const c = st.c;
  st.opt.current = { amt: Math.max(.25, +c.dataset.amt || 1), spd: Math.max(.25, +c.dataset.spd || 1) };
  st.clock += dt;
  st.ctx.clearRect(0, 0, st.w, st.h);
  if (st.w && st.h) st.fx.frame(dt, st.clock);
}
function tick(now) {
  raf = 0;
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  let any = false;
  for (const [c, st] of live) {
    if (!c.isConnected) { live.delete(c); io.unobserve(c); ro.unobserve(c); continue; }
    if (st.visible) { draw(st, dt); any = true; }
  }
  if (any && !document.hidden && !still()) { raf = requestAnimationFrame(tick); }
}
function kick() { if (!raf && live.size && !document.hidden && !still()) { last = performance.now(); raf = requestAnimationFrame(tick); } }

function boot(c) {
  if (live.has(c) || !MAKERS[c.dataset.fx]) return;
  const opt = { current: { amt: 1, spd: 1 } };
  const st = { c, ctx: c.getContext('2d'), opt, fx: null, w: 0, h: 0, clock: 0, visible: false };
  st.fx = MAKERS[c.dataset.fx](st.ctx, opt);
  live.set(c, st); io.observe(c); ro.observe(c); size(st); kick();
}
function scan(node) {
  if (node.nodeType !== 1) return;
  if (node.matches?.('canvas.fx-canvas')) boot(node);
  node.querySelectorAll?.('canvas.fx-canvas').forEach(boot);
}
// Browser only: the engine also loads under Node (tests import the card helpers).
if (typeof document !== 'undefined' && typeof IntersectionObserver !== 'undefined') {
  io = new IntersectionObserver(entries => { for (const e of entries) { const st = live.get(e.target); if (st) st.visible = e.isIntersecting; } kick(); });
  ro = new ResizeObserver(entries => { for (const e of entries) { const st = live.get(e.target); if (st) size(st); } });
  new MutationObserver(list => { for (const m of list) m.addedNodes.forEach(scan); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', kick);
  scan(document.documentElement);
}
