// One player's game as a gold story: their gold against the enemy at the same position, their
// team's gold lead underneath, and what happened when — their kills and deaths on their own
// gold line, Roshan / Tormentor and buildings on a map lane (their team's above the line, the
// enemy's below), teamfights shaded. Hover anywhere for that minute.
//
// gameGoldHtml(m, i) returns a <figure> (i = the player's index in m.players);
// wireGameGold(root) wires the hover.

import { deathsOf } from "./deathmap.js";

// R leaves a gutter right of the plot for the end labels, so no marker can sit on them.
const W = 800, L = 58, R = 104, LABEL_GAP = 26;
const G = { top: 20, h: 200 };             // gold panel
const E = { top: G.top + G.h + 14, h: 40 }; // map events lane
const D = { top: E.top + E.h + 14, h: 70 }; // team lead panel
const H = D.top + D.h + 26;
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
const k = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : String(Math.round(v)));
const niceMax = (v) => { const step = v > 40000 ? 10000 : v > 16000 ? 5000 : v > 6000 ? 2000 : 1000; return Math.max(step, Math.ceil(v / step) * step); };
const KILLER = { "-1": "a tower", "-2": "creeps", "-3": "neutrals", "-4": "Roshan / Tormentor" };
const who = (m, j) => (j >= 0 && m.players[j] ? m.players[j].hero : KILLER[j] ?? "unknown");
// "t1_top" -> "T1 top", "melee_rax_bot" -> "melee rax bot", "fort" -> "Ancient".
const building = (b) => (b === "fort" ? "Ancient" : String(b).replace(/_/g, " ").replace(/^t(\d)/, "T$1"));

// Gold at second t from a per-minute series (linear between minutes).
// Before the horn (negative t, e.g. a pre-game death) reads minute 0.
const at = (vals, t) => {
  const f = Math.max(0, t) / 60, a = Math.floor(f);
  if (a >= vals.length - 1) return vals[vals.length - 1];
  return vals[a] + (vals[a + 1] - vals[a]) * (f - a);
};

export function gameGoldHtml(m, i, { id = "game-gold" } = {}) {
  const p = m.players[i];
  if (!Array.isArray(p?.gold_t) || p.gold_t.length < 2) return "";
  const opp = m.players.find((q) => q.team !== p.team && p.position != null && q.position === p.position && Array.isArray(q.gold_t));
  const lead = Array.isArray(m.gold_adv) && m.gold_adv.length > 1 ? m.gold_adv.map((v) => (p.team === "a" ? v : -v)) : null;
  const dur = Math.max(m.duration_sec, (p.gold_t.length - 1) * 60);
  const x = (t) => L + (Math.max(0, Math.min(dur, t)) / dur) * (W - L - R);
  const gmax = niceMax(Math.max(...p.gold_t, ...(opp?.gold_t ?? [0])));
  const gy = (v) => G.top + G.h - (v / gmax) * G.h;

  // Events.
  const deaths = deathsOf(m);
  const mine = [
    ...deaths.filter((d) => d.killer === i).map((d) => ({ t: d.t, type: "kill", text: `Killed ${who(m, d.i)}` })),
    ...deaths.filter((d) => d.i === i).map((d) => ({ t: d.t, type: "death", text: `Died to ${who(m, d.killer)}${d.gold >= 0 ? ` (−${d.gold} gold)` : ""}` })),
  ].sort((a, b) => a.t - b.t);
  const map = [
    ...(m.objectives ?? []).filter((o) => o.type === "roshan" || o.type === "tormentor")
      .map((o) => ({ t: o.time, type: o.type, ours: o.side === p.team, text: `${o.side === p.team ? "Took" : "Enemy took"} ${o.type === "roshan" ? "Roshan" : "a Tormentor"}` })),
    ...(m.buildings ?? []).filter((b) => b.by === "a" || b.by === "b")
      .map((b) => ({ t: b.time, type: /rax/.test(b.b) ? "rax" : "tower", ours: b.by === p.team, text: `${b.by === p.team ? "Took" : "Lost"} ${building(b.b)}${b.hero ? ` (${b.hero})` : ""}` })),
  ].sort((a, b) => a.t - b.t);
  const fights = [];
  for (let j = 0; j + 2 < (m.fights ?? []).length; j += 3) fights.push([m.fights[j], m.fights[j + 1], m.fights[j + 2]]);

  // Axes and grid.
  let grid = "";
  for (let v = 0; v <= gmax; v += gmax / 4) grid += `<line class="gg-grid" x1="${L}" x2="${W - R}" y1="${gy(v)}" y2="${gy(v)}"/><text class="gg-tick" x="${L - 8}" y="${gy(v) + 3}" text-anchor="end">${k(v)}</text>`;
  const step = dur > 3000 ? 600 : 300;
  for (let t = 0; t <= dur; t += step) grid += `<line class="gg-grid v" x1="${x(t)}" x2="${x(t)}" y1="${G.top}" y2="${D.top + D.h}"/><text class="gg-tick" x="${x(t)}" y="${H - 8}" text-anchor="middle">${t / 60}'</text>`;
  const bands = fights.map(([a, b, n]) => `<rect class="gg-fight" x="${x(a)}" y="${G.top}" width="${Math.max(2, x(b) - x(a))}" height="${D.top + D.h - G.top}"><title>Teamfight ${clock(a)}–${clock(b)} · ${n} deaths</title></rect>`).join("");

  // Gold lines: theirs dashed, the player's as a glowing area.
  const line = (vals) => vals.map((v, j) => `${j ? "L" : "M"}${x(j * 60).toFixed(1)},${gy(v).toFixed(1)}`).join("");
  const gid = `${id}-fill`;
  const mineLine = line(p.gold_t);
  const area = `${mineLine}L${x((p.gold_t.length - 1) * 60).toFixed(1)},${G.top + G.h}L${x(0)},${G.top + G.h}Z`;
  // End labels in the gutter, each at its line's final value, pushed apart when the lines
  // finish close together (and kept inside the gold panel).
  const ends = [{ vals: p.gold_t, cls: "mine", hero: p.hero }, ...(opp ? [{ vals: opp.gold_t, cls: "opp", hero: opp.hero }] : [])]
    .map((e) => ({ ...e, y: gy(e.vals[e.vals.length - 1]) })).sort((a, b) => a.y - b.y);
  for (let j = 1; j < ends.length; j++) ends[j].y = Math.max(ends[j].y, ends[j - 1].y + LABEL_GAP);
  const over = ends.length ? ends[ends.length - 1].y - (G.top + G.h - 8) : 0;
  if (over > 0) for (const e of ends) e.y -= over;
  if (ends.length && ends[0].y < G.top + 10) { const d = G.top + 10 - ends[0].y; for (const e of ends) e.y += d; }
  const labels = ends.map((e) => {
    const x0 = x((e.vals.length - 1) * 60), y0 = gy(e.vals[e.vals.length - 1]);
    return `<g class="gg-end ${e.cls}"><path class="gg-lead-in" d="M${x0 + 3} ${y0}L${W - R + 6} ${e.y}"/>
      <text x="${W - R + 10}" y="${e.y - 2}">${attr(e.hero)}</text><text class="gg-end-v" x="${W - R + 10}" y="${e.y + 11}">${k(e.vals[e.vals.length - 1])}</text></g>`;
  }).join("");
  const golds = `
    <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="gg-stop-a"/><stop offset="1" class="gg-stop-b"/></linearGradient></defs>
    <path class="gg-area" d="${area}" fill="url(#${gid})"/>
    ${opp ? `<path class="gg-opp" d="${line(opp.gold_t)}"/>` : ""}
    <path class="gg-mine" d="${mineLine}"/>
    ${labels}`;
  const onLine = mine.map((e) => {
    const cx = x(e.t), cy = gy(at(p.gold_t, e.t));
    return e.type === "kill"
      ? `<path class="gg-kill" d="M${cx} ${cy - 7}L${cx + 5.5} ${cy + 3}L${cx - 5.5} ${cy + 3}Z"><title>${attr(`${clock(e.t)} · ${e.text}`)}</title></path>`
      : `<g class="gg-death"><title>${attr(`${clock(e.t)} · ${e.text}`)}</title><circle cx="${cx}" cy="${cy}" r="5"/><path d="M${cx - 2.4} ${cy - 2.4}L${cx + 2.4} ${cy + 2.4}M${cx + 2.4} ${cy - 2.4}L${cx - 2.4} ${cy + 2.4}"/></g>`;
  }).join("");

  // Map lane: ours above the middle line, theirs below.
  const mid = E.top + E.h / 2;
  const icon = (e) => {
    const cx = x(e.t), cy = e.ours ? mid - 10 : mid + 10, tip = `<title>${attr(`${clock(e.t)} · ${e.text}`)}</title>`;
    const side = e.ours ? "ours" : "theirs";
    if (e.type === "roshan" || e.type === "tormentor") return `<g class="gg-obj ${e.type} ${side}">${tip}<rect x="${cx - 6}" y="${cy - 6}" width="12" height="12" transform="rotate(45 ${cx} ${cy})"/><text x="${cx}" y="${cy + 3.5}" text-anchor="middle">${e.type === "roshan" ? "R" : "T"}</text></g>`;
    const s = e.type === "rax" ? 8 : 6;
    return `<rect class="gg-bld ${e.type} ${side}" x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}">${tip}</rect>`;
  };
  const lane = `<line class="gg-lane" x1="${L}" x2="${W - R}" y1="${mid}" y2="${mid}"/>
    <text class="gg-rl" x="${L - 8}" y="${mid - 6}" text-anchor="end">Ours</text><text class="gg-rl" x="${L - 8}" y="${mid + 12}" text-anchor="end">Theirs</text>
    ${map.map(icon).join("")}`;

  // Team lead, their side's view: green above zero, red below.
  let leadSvg = "";
  if (lead) {
    const lmax = niceMax(Math.max(1000, ...lead.map(Math.abs)));
    const ly = (v) => D.top + D.h / 2 - (v / lmax) * (D.h / 2);
    const lp = lead.map((v, j) => `${j ? "L" : "M"}${x(j * 60).toFixed(1)},${ly(v).toFixed(1)}`).join("");
    const la = `${lp}L${x((lead.length - 1) * 60).toFixed(1)},${ly(0)}L${x(0)},${ly(0)}Z`;
    const cu = `${id}-up`, cd = `${id}-down`;
    leadSvg = `<defs><clipPath id="${cu}"><rect x="${L}" y="${D.top}" width="${W - L - R}" height="${D.h / 2}"/></clipPath>
        <clipPath id="${cd}"><rect x="${L}" y="${ly(0)}" width="${W - L - R}" height="${D.h / 2}"/></clipPath></defs>
      <text class="gg-rl" x="${L - 8}" y="${ly(0) + 3}" text-anchor="end">Lead</text>
      <text class="gg-tick" x="${L - 8}" y="${D.top + 8}" text-anchor="end">+${k(lmax)}</text><text class="gg-tick" x="${L - 8}" y="${D.top + D.h}" text-anchor="end">−${k(lmax)}</text>
      <path class="gg-lead up" d="${la}" clip-path="url(#${cu})"/><path class="gg-lead down" d="${la}" clip-path="url(#${cd})"/>
      <line class="gg-zero" x1="${L}" x2="${W - R}" y1="${ly(0)}" y2="${ly(0)}"/>`;
  }

  const data = { dur, mine: p.gold_t, opp: opp?.gold_t ?? null, lead, oppHero: opp?.hero ?? null, events: [...mine, ...map].map((e) => [e.t, e.type, e.text, e.ours ?? null]) };
  const legend = `<div class="gg-legend">
    <span class="gg-k mine">${attr(p.hero)} gold</span>${opp ? `<span class="gg-k opp">${attr(opp.hero)} (enemy pos ${p.position})</span>` : ""}
    ${mine.some((e) => e.type === "kill") ? `<span class="gg-k kill">kill</span>` : ""}${mine.some((e) => e.type === "death") ? `<span class="gg-k death">death</span>` : ""}
    ${map.length ? `${map.some((e) => e.type === "roshan") ? `<span class="gg-k obj">Roshan</span>` : ""}${map.some((e) => e.type === "tormentor") ? `<span class="gg-k obj tor">Tormentor</span>` : ""}<span class="gg-k bld">building taken / lost</span>` : ""}
    ${fights.length ? `<span class="gg-k fight">teamfight</span>` : ""}</div>`;
  return `<figure class="gamegold" id="${id}" data-gold="${attr(JSON.stringify(data))}">
    ${legend}
    <div class="gg-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gold and events over the game">
      <rect class="gg-hit" x="${L}" y="${G.top}" width="${W - L - R}" height="${D.top + D.h - G.top}"/>
      ${bands}${grid}${golds}${onLine}${lane}${leadSvg}
      <line class="gg-cross" x1="0" x2="0" y1="${G.top}" y2="${D.top + D.h}" visibility="hidden"/>
    </svg><div class="gg-tip" hidden></div></div>
  </figure>`;
}

export function wireGameGold(root) {
  root.querySelectorAll("figure.gamegold[data-gold]").forEach((fig) => {
    const d = JSON.parse(fig.dataset.gold);
    const svg = fig.querySelector("svg"), cross = fig.querySelector(".gg-cross"), tip = fig.querySelector(".gg-tip");
    const move = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const sx = pt.matrixTransform(svg.getScreenCTM().inverse()).x;
      const t = Math.max(0, Math.min(d.dur, ((sx - L) / (W - L - R)) * d.dur));
      const min = Math.round(t / 60), mx = L + ((min * 60) / d.dur) * (W - L - R);
      cross.setAttribute("x1", mx); cross.setAttribute("x2", mx); cross.setAttribute("visibility", "visible");
      const g = d.mine[Math.min(min, d.mine.length - 1)], o = d.opp ? d.opp[Math.min(min, d.opp.length - 1)] : null;
      const ld = d.lead ? d.lead[Math.min(min, d.lead.length - 1)] : null;
      const near = d.events.filter(([et]) => Math.abs(et - min * 60) <= 30);
      tip.innerHTML = `<b>${min}:00</b>
        <div><span class="gg-k mine"></span>${k(g)} gold</div>
        ${o != null ? `<div><span class="gg-k opp"></span>${attr(d.oppHero)} ${k(o)} <em class="${g >= o ? "up" : "down"}">${g >= o ? "+" : "−"}${k(Math.abs(g - o))}</em></div>` : ""}
        ${ld != null ? `<div>Team <em class="${ld >= 0 ? "up" : "down"}">${ld >= 0 ? "+" : "−"}${k(Math.abs(ld))}</em></div>` : ""}
        ${near.map(([et, , text]) => `<div class="gg-ev">${clock(et)} · ${attr(text)}</div>`).join("")}`;
      tip.hidden = false;
      const box = fig.querySelector(".gg-chart").getBoundingClientRect(), frac = (mx - 0) / W;
      tip.style.left = frac > 0.6 ? "" : `${frac * box.width + 14}px`;
      tip.style.right = frac > 0.6 ? `${(1 - frac) * box.width + 14}px` : "";
    };
    // On the whole svg (the hit rect sits under the marks, so their own titles still show).
    svg.addEventListener("mousemove", move);
    svg.addEventListener("mouseleave", () => { cross.setAttribute("visibility", "hidden"); tip.hidden = true; });
  });
}
