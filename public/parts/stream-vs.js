// VS scene (Stream kit, ?stream=vs): two teams' cards on a transparent 1920×1080 stage for OBS, with a
// choice of animations (&anim=<id>, VS_ANIMS in lib/stream-kit.js). Each animation has an intro (the
// cards and the VS arriving) and, for most, something that keeps going after it:
//   jump      cards jump in, a VS slams down, then they hold still (the default)
//   brawl     the same intro, then the cards keep busy: hops, flips, taunts, glows, waves, clashes
//   deal      dealt out of the middle like a hand, turned face up in a ripple; a shine sweeps across
//   meteor    cards crash down from above with shockwaves; energy pulses roll out from the VS
//   warp      the VS spins in and the cards burst out of it in 3D; the teams sway like holograms
//   spotlight each team slides in together, then a spotlight steps through every player
//   glitch    cards glitch into existence, the VS flickers on like neon; a card glitches now and then
// OBS replays the intro each time the scene comes on (the kit's import sets "Refresh browser when
// scene becomes active"). &preview=1 puts a dark backdrop behind it, for checking it in a browser.
import { esc } from "../core.js";
import { createPlayerCards, PAINT_FILTER, fitDesignCards, flipPlayerCard, shrinkToFit } from "./player-card.js";
import { pickSlot, VS_ANIMS } from "../lib/stream-kit.js";

const W = 1920, H = 1080;
const MID = { x: 960, y: 560 }; // the VS, in stage pixels
const GLOW = { a: "#e8b64c", b: "#e0523e" };
// One transform shape for every keyframe, so the browser blends them step by step.
const tf = (y = 0, r = 0, sx = 1, sy = sx, x = 0) => `translateX(${x}px) translateY(${y}px) rotate(${r}deg) scale(${sx}, ${sy})`;
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const rand = (a, b) => a + Math.random() * (b - a);

// sides: [{ team: { id, name }, players: [{ name, account }] }], the first two shown.
// picks: "<team>:<account>" → slot (null or missing: the main card, or the filter's card for `mode`).
export async function mountVsScene(sides, { picks, mode, playerDesigns, getRenderer }) {
  const q = new URLSearchParams(location.search);
  const anim = ANIMS[q.get("anim")] ? q.get("anim") : VS_ANIMS[0][0];
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

  root.innerHTML = PAINT_FILTER + `<div class="vs-stage vs-${anim}" aria-label="${esc(teams[0].name)} versus ${esc(teams[1].name)}">
    <div class="vs-flash"></div>
    ${teams.map((t) => `<div class="vs-side vs-${t.side}">
      <h2 class="vs-team"><span>${esc(t.name)}</span></h2>
      <div class="vs-cards">${t.players.map((p, i) => `<div class="vs-slot" data-side="${t.side}" data-i="${i}"><div class="vs-hop"><div class="vs-act">${card(p, t)}</div></div></div>`).join("")}</div>
    </div>`).join("")}
    <div class="vs-mid"><span class="vs-word">VS</span></div>
  </div>`;
  const stage = root.querySelector(".vs-stage");
  fitDesignCards(stage);
  await document.fonts?.ready;
  stage.querySelectorAll(".vs-team").forEach((h) => shrinkToFit(h, { measure: h.firstElementChild, floor: 0.45 }));
  const ctx = context(stage);
  const { intro, idle } = ANIMS[anim];
  const end = intro(ctx);
  if (idle) setTimeout(() => idle(ctx), end);
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
const every = (ms, fn) => { fn(); return setInterval(fn, ms); };

// Jump in: cards spin up from below, land, squash and settle; the VS slams down and everything flinches.
function jumpIntro(ctx) {
  sweepNames(ctx);
  const T0 = 500, STEP = 170, DUR = 950;
  ctx.order.forEach((el, n) => {
    const d = ctx.dirOf(el), delay = T0 + n * STEP;
    el.animate([
      { transform: tf(900, -40 * d, 0.6), opacity: 0 },
      { transform: tf(-140, 10 * d, 1.06), opacity: 1, offset: 0.5 },
      { transform: tf(0, 0, 1.1, 0.86), offset: 0.7 },
      { transform: tf(-26, -2 * d, 0.97, 1.04), offset: 0.84 },
      { transform: tf(0, 0, 1), opacity: 1 },
    ], { duration: DUR, delay, easing: "cubic-bezier(.3,.7,.4,1)", fill: "backwards" });
    setTimeout(() => ring(el), delay + DUR * 0.7);
  });
  const slamAt = T0 + (ctx.order.length - 1) * STEP + DUR + 120;
  showWord(ctx, [
    { transform: "scale(5) rotate(-14deg)", opacity: 0 },
    { transform: "scale(.86) rotate(3deg)", opacity: 1, offset: 0.55 },
    { transform: "scale(1.12) rotate(-1deg)", opacity: 1, offset: 0.78 },
    { transform: "scale(1) rotate(0deg)", opacity: 1 },
  ], { duration: 620, delay: slamAt, easing: "cubic-bezier(.5,0,.4,1)" });
  setTimeout(() => {
    shake(ctx.stage, 14);
    flash(ctx);
    ctx.order.forEach((el) => { const d = ctx.dirOf(el); ctx.act(el).animate([{ transform: tf() }, { transform: tf(-10, -6 * d, 1, 1, -22 * d), offset: 0.3 }, { transform: tf() }], { duration: 600, easing: "ease-out" }); });
  }, slamAt + 340);
  return slamAt + 1100;
}

// Brawl: after the jump-in the cards bob, and every couple of seconds something happens.
function brawlIdle(ctx) {
  const { order, word, dirOf, act, busy } = ctx;
  order.forEach((el) => { const hop = el.querySelector(".vs-hop"); hop.style.setProperty("--d", `${(-Math.random() * 3.2).toFixed(2)}s`); hop.classList.add("idle"); });
  const free = (list = order) => list.filter((el) => !busy.has(el));
  const hold = (els, ms) => { els.forEach((el) => busy.add(el)); setTimeout(() => els.forEach((el) => busy.delete(el)), ms); };
  const moves = {
    hop(el) { // a jump with a full spin and a squashed landing
      const d = dirOf(el);
      hold([el], 1000);
      act(el).animate([
        { transform: tf() }, { transform: tf(10, 0, 1.06, 0.9), offset: 0.12 },
        { transform: tf(-130, 180 * d, 1.04), offset: 0.5 }, { transform: tf(0, 360 * d, 1.08, 0.9), offset: 0.82 }, { transform: tf(0, 360 * d) },
      ], { duration: 900, easing: "cubic-bezier(.35,.6,.4,1)" });
      setTimeout(() => ring(el), 740);
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
      setTimeout(() => { shake(word, 10); word.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 380, easing: "ease-out", composite: "add" }); }, 450);
    },
  };
  const bag = [["hop", 3], ["flip", 2], ["taunt", 2], ["glow", 2], ["wave", 1], ["clash", 1]].flatMap(([m, n]) => Array(n).fill(m));
  every(1900, () => {
    const m = pick(bag);
    if (m === "wave" || m === "clash") moves[m]();
    else { const el = pick(free()); if (el) moves[m](el); }
  });
}

// Deal: the cards fly out of the middle face down, spinning, then turn face up left to right.
function dealIntro(ctx) {
  ctx.names.forEach((h, i) => h.animate([{ opacity: 0, transform: "translateY(40px)", filter: "blur(10px)" }, { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" }], { duration: 800, delay: 150 + i * 150, easing: "ease-out", fill: "backwards" }));
  ctx.order.forEach((el) => flipNow(ctx, el, true));
  const T0 = 350, STEP = 140, DUR = 720;
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
  ctx.byX.forEach((el, j) => setTimeout(() => {
    const c = ctx.card(el);
    if (c && !isTwin(c)) flipPlayerCard(c, false);
    ctx.act(el).animate([{ transform: tf() }, { transform: tf(-22, 0, 1.08) }, { transform: tf() }], { duration: 600, easing: "cubic-bezier(.3,.7,.4,1)" });
  }, reveal + j * RIPPLE));
  const vsAt = reveal + ctx.byX.length * RIPPLE + 350;
  showWord(ctx, [{ opacity: 0, transform: "scale(.3) rotate(0deg)" }, { opacity: 1, transform: "scale(1.15) rotate(0deg)", offset: 0.6 }, { opacity: 1, transform: "scale(1) rotate(0deg)" }], { duration: 520, delay: vsAt, easing: "cubic-bezier(.3,.7,.4,1)" });
  setTimeout(() => flash(ctx, 0.45, 600), vsAt + 250);
  return vsAt + 1400;
}
// A shine sweeps across every card, left to right.
function dealIdle(ctx) {
  for (const el of ctx.order) { const s = document.createElement("i"); s.className = "vs-sheen"; ctx.act(el).append(s); }
  every(6000, () => ctx.byX.forEach((el) => {
    el.querySelector(".vs-sheen").animate([{ backgroundPosition: "160% 0", opacity: 1 }, { backgroundPosition: "-60% 0", opacity: 1 }], { duration: 900, delay: (ctx.pos.get(el).x / W) * 900, easing: "ease-in-out" });
  }));
}

// Meteor: names drop, the cards crash down from above in turn, each landing shakes the stage; the VS
// bursts in with rays.
function meteorIntro(ctx) {
  ctx.names.forEach((h, i) => h.animate([{ transform: "translateY(-320px)", opacity: 0 }, { transform: "translateY(10px)", opacity: 1, offset: 0.75 }, { transform: "translateY(0px)", opacity: 1 }], { duration: 600, delay: 100 + i * 120, easing: "cubic-bezier(.5,0,.5,1)", fill: "backwards" }));
  const T0 = 450, STEP = 210, DUR = 560, HIT = 0.7;
  ctx.order.forEach((el, n) => {
    const delay = T0 + n * STEP;
    el.animate([
      { transform: "translateY(-1300px) scale(.85, 1.5)", filter: "blur(6px) brightness(2)", easing: "cubic-bezier(.6,0,1,1)" },
      { transform: "translateY(0px) scale(1.12, .82)", filter: "blur(0px) brightness(1.7)", offset: HIT, easing: "ease-out" },
      { transform: "translateY(-16px) scale(.98, 1.03)", filter: "blur(0px) brightness(1.15)", offset: 0.86 },
      { transform: "translateY(0px) scale(1, 1)", filter: "blur(0px) brightness(1)" },
    ], { duration: DUR, delay, fill: "backwards" });
    setTimeout(() => { ring(el, { size: 2.1, ms: 750 }); shake(ctx.stage, 7, 300); }, delay + DUR * HIT);
  });
  const vsAt = T0 + (ctx.order.length - 1) * STEP + DUR + 200;
  showWord(ctx, [
    { opacity: 0, transform: "scale(2.6) rotate(0deg)" },
    { opacity: 1, transform: "scale(.9) rotate(0deg)", offset: 0.5 },
    { opacity: 1, transform: "scale(1) rotate(0deg)" },
  ], { duration: 520, delay: vsAt, easing: "cubic-bezier(.6,0,.4,1)" });
  setTimeout(() => {
    const rays = atMid(ctx, "vs-rays");
    rays.animate([{ opacity: 0, transform: "translate(-50%, -50%) scale(.3) rotate(0deg)" }, { opacity: 1, offset: 0.25 }, { opacity: 0, transform: "translate(-50%, -50%) scale(1.5) rotate(50deg)" }], { duration: 1100, easing: "ease-out" }).onfinish = () => rays.remove();
    flash(ctx, 0.9, 800);
    shake(ctx.stage, 16, 500);
  }, vsAt + 260);
  return vsAt + 1300;
}
// An energy ring rolls out from the VS; each card lights up as it passes.
function meteorIdle(ctx) {
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

// Warp: the VS spins in, a portal opens, and the cards burst out of it in 3D to their places.
function warpIntro(ctx) {
  showWord(ctx, [
    { opacity: 0, transform: "scale(0) rotate(-540deg)" },
    { opacity: 1, transform: "scale(1.3) rotate(12deg)", offset: 0.75 },
    { opacity: 1, transform: "scale(1) rotate(0deg)" },
  ], { duration: 850, delay: 200, easing: "cubic-bezier(.3,.6,.3,1)" });
  setTimeout(() => {
    const portal = atMid(ctx, "vs-portal");
    portal.animate([{ opacity: 0, transform: "translate(-50%, -50%) scale(.2)" }, { opacity: 1, transform: "translate(-50%, -50%) scale(1)", offset: 0.3 }, { opacity: 0, transform: "translate(-50%, -50%) scale(1.6)" }], { duration: 2200, easing: "ease-out" }).onfinish = () => portal.remove();
  }, 800);
  const T0 = 1000, STEP = 120, DUR = 820;
  ctx.order.forEach((el, n) => {
    const p = ctx.pos.get(el), dx = MID.x - p.x, dy = MID.y - p.y, d = ctx.dirOf(el);
    el.animate([
      { transform: `perspective(1200px) translate(${dx}px, ${dy}px) scale(.05) rotateY(${170 * d}deg)`, opacity: 0, filter: "blur(12px)" },
      { opacity: 1, offset: 0.25 },
      { transform: `perspective(1200px) translate(0px, 0px) scale(1.06) rotateY(${-14 * d}deg)`, filter: "blur(0px)", offset: 0.75 },
      { transform: "perspective(1200px) translate(0px, 0px) scale(1) rotateY(0deg)", filter: "blur(0px)", opacity: 1 },
    ], { duration: DUR, delay: T0 + n * STEP, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" });
  });
  const namesAt = T0 + (ctx.order.length - 1) * STEP + 400;
  ctx.names.forEach((h, i) => h.animate([{ opacity: 0, letterSpacing: ".7em", filter: "blur(14px)" }, { opacity: 1, letterSpacing: ".02em", filter: "blur(0px)" }], { duration: 900, delay: namesAt + i * 100, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" }));
  return namesAt + 1000;
}
// Each team sways slowly in 3D, and the cards float.
function warpIdle(ctx) {
  ctx.stage.classList.add("vs-swaying");
  ctx.order.forEach((el) => { const hop = el.querySelector(".vs-hop"); hop.style.setProperty("--d", `${(-Math.random() * 3.2).toFixed(2)}s`); hop.classList.add("idle"); });
}

// Spotlight: each team slides in as one, two light streaks cross the middle and leave the VS behind.
function spotlightIntro(ctx) {
  ctx.sides.forEach((side, i) => {
    const s = i ? 1 : -1;
    side.animate([
      { transform: `translateX(${1150 * s}px) skewX(${10 * s}deg)`, opacity: 0 },
      { transform: `translateX(${-30 * s}px) skewX(${-3 * s}deg)`, opacity: 1, offset: 0.75 },
      { transform: "translateX(0px) skewX(0deg)", opacity: 1 },
    ], { duration: 950, delay: 200 + i * 180, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
  });
  setTimeout(() => [1, -1].forEach((s, i) => {
    const streak = atMid(ctx, "vs-streak");
    streak.animate([{ transform: `translate(-50%, -50%) rotate(${22 * s}deg) translateX(${-1500 * s}px)`, opacity: 1 }, { transform: `translate(-50%, -50%) rotate(${22 * s}deg) translateX(${1500 * s}px)`, opacity: 1 }], { duration: 650, delay: i * 90, easing: "cubic-bezier(.5,0,.5,1)" }).onfinish = () => streak.remove();
  }), 1150);
  showWord(ctx, [{ opacity: 0, transform: "scale(3, .15)" }, { opacity: 1, transform: "scale(.9, 1.12)", offset: 0.6 }, { opacity: 1, transform: "scale(1, 1)" }], { duration: 480, delay: 1500, easing: "cubic-bezier(.3,.7,.4,1)" });
  setTimeout(() => flash(ctx, 0.5, 600), 1650);
  return 2600;
}
// The spotlight steps through every player in turn; after a round everyone is lit for a beat.
function spotlightIdle(ctx) {
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

// Glitch: names and cards flicker in as broken slices with a colour split; the VS buzzes on like neon.
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
const NEON = [0, 1, 0, 0, 1, 0.25, 1, 0, 0.8, 1];
function glitchIntro(ctx) {
  ctx.names.forEach((h, i) => h.animate(glitchFrames(9), { duration: 650, delay: 200 + i * 200, fill: "backwards" }));
  const T0 = 550, STEP = 130, DUR = 620;
  ctx.order.forEach((el, n) => el.animate(glitchFrames(8), { duration: DUR, delay: T0 + n * STEP, fill: "backwards" }));
  const vsAt = T0 + (ctx.order.length - 1) * STEP + DUR + 200;
  showWord(ctx, NEON.map((o) => ({ opacity: o, transform: "scale(1)", easing: "steps(1, end)" })), { duration: 1000, delay: vsAt });
  setTimeout(() => { flash(ctx, 0.35, 300); shake(ctx.stage, 6, 250); }, vsAt + 600);
  return vsAt + 1500;
}
// A random card glitches for a moment; now and then the VS buzzes.
function glitchIdle(ctx) {
  let n = 0;
  every(2300, () => {
    const el = pick(ctx.order);
    el.animate(glitchFrames(5, { from: 1 }), { duration: 320 });
    if (++n % 3 === 0) ctx.word.animate([1, 0.2, 1, 0, 1].map((o) => ({ opacity: o, easing: "steps(1, end)" })), { duration: 380 });
  });
}

const ANIMS = {
  jump: { intro: jumpIntro },
  brawl: { intro: jumpIntro, idle: brawlIdle },
  deal: { intro: dealIntro, idle: dealIdle },
  meteor: { intro: meteorIntro, idle: meteorIdle },
  warp: { intro: warpIntro, idle: warpIdle },
  spotlight: { intro: spotlightIntro, idle: spotlightIdle },
  glitch: { intro: glitchIntro, idle: glitchIdle },
};
