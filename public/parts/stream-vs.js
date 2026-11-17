// VS scene (Stream kit, ?stream=vs): two teams' cards on a transparent 1920×1080 stage for OBS. The cards
// jump in one by one, a VS slams down between the teams, then the cards keep moving: they bob, and
// every couple of seconds one hops, turns over to its stats, taunts the other side, glows, or a whole
// team does a wave, or a card from each side clashes in the middle. OBS replays the intro each time
// the scene comes on (the kit's import sets "Refresh browser when scene becomes active").
// &preview=1 puts a dark backdrop behind it, for checking it in a normal browser.
import { esc } from "../core.js";
import { createPlayerCards, PAINT_FILTER, fitDesignCards, flipPlayerCard, shrinkToFit } from "./player-card.js";
import { pickSlot } from "../lib/stream-kit.js";

const W = 1920, H = 1080;
const GLOW = { a: "#e8b64c", b: "#e0523e" };
// One transform shape for every keyframe, so the browser blends them step by step.
const tf = (y = 0, r = 0, sx = 1, sy = sx, x = 0) => `translateX(${x}px) translateY(${y}px) rotate(${r}deg) scale(${sx}, ${sy})`;
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// sides: [{ team: { id, name }, players: [{ name, account }] }], the first two shown.
// picks: "<team>:<account>" → slot (null or missing: the main card, or the filter's card for `mode`).
export async function mountVsScene(sides, { picks, mode, playerDesigns, getRenderer }) {
  const html = document.documentElement;
  html.classList.add("stream-vs");
  const preview = new URLSearchParams(location.search).get("preview") === "1";
  html.classList.toggle("stream-vs-preview", preview);
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
      const k = `${s.team.id}:${p.account}`;
      let slot = picks.get(k) ?? null;
      if (slot == null && mode !== "main") slot = pickSlot(mode, designs);
      return { ...p, design: slot == null ? null : designs.find((d) => d.slot === slot)?.design ?? null };
    }),
  }));
  const draw = createPlayerCards(matches, { cards, tiers });
  const card = (p, team) => draw.card({ account: Number(p.account), name: p.name, team: team.name }, null, { own: true, equipmentOverride: p.design });

  root.innerHTML = PAINT_FILTER + `<div class="vs-stage" aria-label="${esc(teams[0].name)} versus ${esc(teams[1].name)}">
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
  play(stage);
}

function play(stage) {
  const slotsOf = (side) => [...stage.querySelectorAll(`.vs-slot[data-side="${side}"]`)];
  const a = slotsOf("a"), b = slotsOf("b");
  // Alternate sides: a1, b1, a2, b2, …
  const order = Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [a[i], b[i]]).flat().filter(Boolean);
  const dirOf = (el) => (el.dataset.side === "a" ? 1 : -1); // towards the middle
  const word = stage.querySelector(".vs-word");

  // Team names sweep in from the edges.
  stage.querySelectorAll(".vs-team").forEach((h, i) => h.animate(
    [{ transform: `translateX(${i ? 700 : -700}px) skewX(${i ? 20 : -20}deg)`, opacity: 0 }, { transform: `translateX(${i ? -24 : 24}px) skewX(0)`, opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }],
    { duration: 650, delay: 150 + i * 120, easing: "cubic-bezier(.2,.8,.3,1)", fill: "backwards" }));

  // Cards jump in from below the stage, spin, land, squash and settle, with a ring of dust.
  const T0 = 500, STEP = 170, DUR = 950;
  order.forEach((el, n) => {
    const d = dirOf(el), delay = T0 + n * STEP;
    el.animate([
      { transform: tf(900, -40 * d, 0.6), opacity: 0 },
      { transform: tf(-140, 10 * d, 1.06), opacity: 1, offset: 0.5 },
      { transform: tf(0, 0, 1.1, 0.86), offset: 0.7 },
      { transform: tf(-26, -2 * d, 0.97, 1.04), offset: 0.84 },
      { transform: tf(0, 0, 1), opacity: 1 },
    ], { duration: DUR, delay, easing: "cubic-bezier(.3,.7,.4,1)", fill: "backwards" });
    setTimeout(() => ring(el), delay + DUR * 0.7);
  });

  const slamAt = T0 + (order.length - 1) * STEP + DUR + 120;
  setTimeout(() => {
    word.animate([
      { transform: "scale(5) rotate(-14deg)", opacity: 0 },
      { transform: "scale(.86) rotate(3deg)", opacity: 1, offset: 0.55 },
      { transform: "scale(1.12) rotate(-1deg)", offset: 0.78 },
      { transform: "none", opacity: 1 },
    ], { duration: 620, easing: "cubic-bezier(.5,0,.4,1)", fill: "both" });
    setTimeout(() => {
      shake(stage, 14);
      stage.querySelector(".vs-flash").animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.15 }, { opacity: 0 }], { duration: 700, easing: "ease-out" });
      // Every card flinches away from the slam.
      order.forEach((el) => { const d = dirOf(el); el.querySelector(".vs-act").animate([{ transform: tf() }, { transform: tf(-10, -6 * d, 1, 1, -22 * d), offset: 0.3 }, { transform: tf() }], { duration: 600, easing: "ease-out" }); });
    }, 340);
  }, slamAt);

  setTimeout(() => idle(stage, order, word, dirOf), slamAt + 1100);
}

// A ring of dust where a card lands.
function ring(slot) {
  const r = document.createElement("i");
  r.className = "vs-ring";
  slot.append(r);
  r.animate([{ transform: "translateX(-50%) scale(.2)", opacity: 0.9 }, { transform: "translateX(-50%) scale(1.7)", opacity: 0 }], { duration: 650, easing: "ease-out" }).onfinish = () => r.remove();
}
function shake(el, px) {
  const k = [0, 1, -1, 0.7, -0.6, 0.3, 0].map((f, i) => ({ transform: `translate(${(i % 2 ? -1 : 1) * px * f}px, ${px * f * 0.6}px)` }));
  el.animate(k, { duration: 420, easing: "linear", composite: "add" });
}

function idle(stage, order, word, dirOf) {
  order.forEach((el) => { const hop = el.querySelector(".vs-hop"); hop.style.setProperty("--d", `${(-Math.random() * 3.2).toFixed(2)}s`); hop.classList.add("idle"); });
  word.classList.add("idle");
  const busy = new Set();
  const free = (list = order) => list.filter((el) => !busy.has(el));
  const hold = (els, ms) => { els.forEach((el) => busy.add(el)); setTimeout(() => els.forEach((el) => busy.delete(el)), ms); };
  const act = (el) => el.querySelector(".vs-act");

  const moves = {
    // A jump with a full spin and a squashed landing.
    hop(el) {
      const d = dirOf(el);
      hold([el], 1000);
      act(el).animate([
        { transform: tf() }, { transform: tf(10, 0, 1.06, 0.9), offset: 0.12 },
        { transform: tf(-130, 180 * d, 1.04), offset: 0.5 }, { transform: tf(0, 360 * d, 1.08, 0.9), offset: 0.82 }, { transform: tf(0, 360 * d) },
      ], { duration: 900, easing: "cubic-bezier(.35,.6,.4,1)" });
      setTimeout(() => ring(el), 740);
    },
    // Turns over to show the stats on the back, then turns back.
    async flip(el) {
      const c = el.querySelector(".ft-card");
      if (!c || c.parentElement?.classList.contains("ft-twin")) return moves.glow(el);
      hold([el], 5000);
      act(el).animate([{ transform: tf() }, { transform: tf(-30, 0, 1.08) }], { duration: 300, fill: "forwards", easing: "ease-out" });
      flipPlayerCard(c, true);
      await wait(3800);
      flipPlayerCard(c, false);
      await wait(350);
      act(el).animate([{ transform: tf(-30, 0, 1.08) }, { transform: tf() }], { duration: 350, fill: "forwards", easing: "ease-in" });
    },
    // Leans at the other team and shakes.
    taunt(el) {
      const d = dirOf(el);
      hold([el], 1300);
      act(el).animate([
        { transform: tf() }, { transform: tf(-12, 9 * d, 1.05, 1.05, 34 * d), offset: 0.25 },
        { transform: tf(-12, 3 * d, 1.05, 1.05, 44 * d), offset: 0.38 }, { transform: tf(-12, 11 * d, 1.05, 1.05, 30 * d), offset: 0.5 },
        { transform: tf(-12, 3 * d, 1.05, 1.05, 44 * d), offset: 0.62 }, { transform: tf() },
      ], { duration: 1200, easing: "ease-in-out" });
    },
    // Lifts and lights up in its team's colour.
    glow(el) {
      hold([el], 1400);
      act(el).animate([
        { transform: tf(), filter: "drop-shadow(0 0 0 transparent)" },
        { transform: tf(-18, 0, 1.08), filter: `drop-shadow(0 0 30px ${GLOW[el.dataset.side]})`, offset: 0.45 },
        { transform: tf(), filter: "drop-shadow(0 0 0 transparent)" },
      ], { duration: 1300, easing: "ease-in-out" });
    },
    // The whole team hops in turn, left to right.
    wave() {
      const side = pick(["a", "b"]), team = order.filter((el) => el.dataset.side === side).sort((x, y) => x.getBoundingClientRect().left - y.getBoundingClientRect().left);
      if (team.some((el) => busy.has(el))) return;
      hold(team, 600 + team.length * 110);
      team.forEach((el, i) => act(el).animate([{ transform: tf() }, { transform: tf(-60, 0, 1.04) }, { transform: tf() }], { duration: 520, delay: i * 110, easing: "cubic-bezier(.3,.7,.4,1)" }));
    },
    // A card from each side lunges at the middle; they bounce off and the VS shakes.
    clash() {
      const x = pick(free(order.filter((el) => el.dataset.side === "a"))), y = pick(free(order.filter((el) => el.dataset.side === "b")));
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
  const WEIGHTS = [["hop", 3], ["flip", 2], ["taunt", 2], ["glow", 2], ["wave", 1], ["clash", 1]];
  const bag = WEIGHTS.flatMap(([m, n]) => Array(n).fill(m));
  const tick = () => {
    const m = pick(bag);
    if (m === "wave" || m === "clash") moves[m]();
    else { const el = pick(free()); if (el) moves[m](el); }
  };
  tick();
  setInterval(tick, 1900);
}
