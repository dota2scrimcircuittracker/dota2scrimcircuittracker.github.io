// Team fight map (AD2L team page): where a team fights, from the spots of every teamfight
// death in their parsed games, theirs and the enemy's. Dire games are mirrored so the team's
// own base is always bottom left.
//
// Two views:
//   heat   density of teamfight deaths: both sides, only theirs, only the enemy's, or net
//          (enemy deaths minus theirs: green where they come out ahead, red where they don't)
//   fights one circle per teamfight at the middle of its deaths, sized by deaths and coloured
//          by who came out ahead (more enemy deaths = won the fight)
// OpenDota records a spot only for deaths inside its teamfights, so this is fights, not every
// kill; a fight whose deaths have no spot is left out.

import { deathsOf, hasDeaths } from "./deathmap.js";
import { densityGrid, heat } from "./wardmap.js";
import { applyZoom, wireZoom } from "./mapzoom.js";

const IMG = { src: "img/minimap.webp", x0: 56.94, x1: 206.2, y0: 62.3, y1: 202.8 };
const CX = (74.6 + 182.9) / 2, CY = (78.0 + 177.9) / 2;
const Y = (y) => 256 - y;
const VB = { x: IMG.x0, y: Y(IMG.y1), w: IMG.x1 - IMG.x0, h: IMG.y1 - IMG.y0 };
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const PHASES = [["0", "0–10'", 0, 600], ["1", "10–20'", 600, 1200], ["2", "20–35'", 1200, 2100], ["3", "35'+", 2100, Infinity]];

// Which half a spot is in: the river runs corner to corner, so own half is below the diagonal
// through the map centre (own base bottom left).
export const ownHalf = (x, y) => x - CX + (y - CY) < 0;

// games: AD2L games; sideOf(m) = the team's side ("a" / "b") or null.
// → { games: [[opponent, won 1/0, id]], fights: [[x, y, start, own deaths, enemy deaths, game]],
//     pts: [[x, y, own 1/0, second, game]] }, positions mirrored to the team's side.
export function teamFights(games, sideOf) {
  const out = { games: [], fights: [], pts: [] };
  for (const m of games) {
    const side = sideOf(m);
    if (!side || !hasDeaths(m) || !Array.isArray(m.fights)) continue;
    const gi = out.games.length;
    out.games.push([side === "a" ? m.team_b : m.team_a, m.winner === side ? 1 : 0, m.id]);
    const flip = side === "b";
    const spot = (d) => (flip ? [+(2 * CX - d.x).toFixed(1), +(2 * CY - d.y).toFixed(1)] : [d.x, d.y]);
    const placed = deathsOf(m).filter((d) => d.kind === "fight" && d.x > 0);
    for (const d of placed) out.pts.push([...spot(d), d.team === side ? 1 : 0, d.t, gi]);
    for (let j = 0; j + 2 < m.fights.length; j += 3) {
      const [start, end] = [m.fights[j], m.fights[j + 1]];
      const inF = placed.filter((d) => d.t >= start && d.t <= end);
      if (!inF.length) continue;
      const xy = inF.map(spot);
      const own = inF.filter((d) => d.team === side).length;
      out.fights.push([+(xy.reduce((s, p) => s + p[0], 0) / xy.length).toFixed(1), +(xy.reduce((s, p) => s + p[1], 0) / xy.length).toFixed(1),
        start, own, inF.length - own, gi]);
    }
  }
  return out;
}

const seg = (name, opts, on) => `<div class="wm-seg" role="group" data-ctl="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === on}">${l}</button>`).join("")}</div>`;

// Empty string when none of the team's games has fight data.
export function teamFightMapHtml(games, sideOf, { id = "team-fights", name = "This team" } = {}) {
  const data = teamFights(games, sideOf);
  if (!data.fights.length) return "";
  return `<figure class="wardmap fightmap" id="${id}" data-view="heat" data-who="all" data-result="all" data-phase="all" data-fights="${attr(JSON.stringify({ name, ...data }))}">
    <div class="wm-controls">
      ${seg("view", [["heat", "Heat"], ["fights", "Fights"]], "heat")}
      ${seg("who", [["all", "Every death"], ["own", "Own deaths"], ["enemy", "Enemy deaths"], ["net", "Net"]], "all")}
      ${seg("result", [["all", "Every game"], ["w", "Wins"], ["l", "Losses"]], "all")}
      ${seg("phase", [["all", "Whole game"], ...PHASES.map(([v, l]) => [v, l])], "all")}
    </div>
    <div class="dm-read" aria-live="polite"></div>
    <div class="wm-body"><div class="wm-map"></div><div class="wm-side"></div></div>
  </figure>`;
}

function draw(fig) {
  const D = JSON.parse(fig.dataset.fights);
  const { view, who, result } = fig.dataset, ph = PHASES.find(([v]) => v === fig.dataset.phase);
  const gameOn = (g) => result === "all" || (D.games[g][1] === 1) === (result === "w");
  const inPhase = (t) => !ph || (t >= ph[2] && t < ph[3]);
  const fights = D.fights.map((f, i) => [...f, i]).filter((f) => gameOn(f[5]) && inPhase(f[2]));
  const pts = D.pts.filter((p) => gameOn(p[4]) && inPhase(p[3]));
  const games = D.games.filter((g, i) => gameOn(i)).length;

  let body = "";
  if (view === "heat") {
    const fid = `${fig.id}-blur`;
    const use = who === "own" ? pts.filter((p) => p[2] === 1) : who === "enemy" ? pts.filter((p) => p[2] === 0) : pts;
    // Net: enemy deaths count up, theirs count down; colour by sign, strength by size.
    const { cell, GX, GY, grid, x0, y0 } = densityGrid(use.map((p) => [p[0], p[1], who === "net" ? (p[2] ? -1 : 1) : 1]), { spread: 3 });
    const peak = Math.max(...grid.map(Math.abs)) || 1;
    let cells = "";
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      const v = grid[j * GX + i] / peak, a = Math.abs(v);
      if (a < 0.12) continue;
      const fill = who === "net" ? (v > 0 ? "var(--jade)" : "var(--ember)") : heat(v);
      cells += `<rect x="${(x0 + i * cell).toFixed(1)}" y="${(y0 + j * cell).toFixed(1)}" width="${cell + 0.05}" height="${cell + 0.05}" fill="${fill}" fill-opacity="${(0.15 + (who === "net" ? 0.7 : 0.8) * a).toFixed(2)}"/>`;
    }
    body = `<defs><filter id="${fid}"><feGaussianBlur stdDeviation="0.9"/></filter></defs><g class="wm-heat" filter="url(#${fid})">${cells}</g>`;
  } else {
    // Biggest fights first so small ones sit on top and stay hoverable.
    body = [...fights].sort((p, q) => q[3] + q[4] - (p[3] + p[4])).map(([x, y, , own, enemy, , i]) => {
      const r = 1.3 + 0.55 * Math.sqrt(own + enemy), res = enemy > own ? "won" : enemy < own ? "lost" : "even";
      return `<circle class="fm-f ${res}" data-i="${i}" r="${r.toFixed(2)}" style="transform:translate(${x}px,${Y(y)}px) scale(var(--ms,1))"/>`;
    }).join("");
  }
  fig.querySelector(".wm-map").innerHTML = `<svg viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" role="img" aria-label="Team fight map, ${fights.length} fights">
    <image href="${IMG.src}" x="${VB.x}" y="${VB.y}" width="${VB.w}" height="${VB.h}" preserveAspectRatio="none"/>
    <rect class="wm-dim" x="${VB.x}" y="${VB.y}" width="${VB.w}" height="${VB.h}"/>
    <line class="fm-river" x1="${VB.x}" y1="${Y(CX + CY - VB.x)}" x2="${VB.x + VB.w}" y2="${Y(CX + CY - (VB.x + VB.w))}"/>
    <text class="wm-lbl a" x="${VB.x + 3}" y="${VB.y + VB.h - 3}">Own side</text>
    <text class="wm-lbl b" x="${VB.x + VB.w - 3}" y="${VB.y + 7}" text-anchor="end">Enemy side</text>${body}</svg>`;
  applyZoom(fig);

  // Side panel: fight record overall and on each half, and deaths traded.
  const rec = (fs) => {
    const w = fs.filter((f) => f[4] > f[3]).length, l = fs.filter((f) => f[4] < f[3]).length;
    return { n: fs.length, w, l, e: fs.length - w - l };
  };
  const line = (label, fs) => {
    const r = rec(fs);
    return `<div>${label}: <b>${r.w}</b> won · <b>${r.l}</b> lost · <b>${r.e}</b> even${r.n ? ` <span class="muted">(${Math.round((r.w / r.n) * 100)}% won)</span>` : ""}</div>`;
  };
  const own = fights.reduce((s, f) => s + f[3], 0), enemy = fights.reduce((s, f) => s + f[4], 0);
  fig.querySelector(".wm-side").innerHTML = `<div class="wm-stat s-mine"><div class="wm-who">${attr(D.name)}</div>
      <div><b>${fights.length}</b> teamfights in <b>${games}</b> game${games === 1 ? "" : "s"}${games ? ` · ${(fights.length / games).toFixed(1)} a game` : ""}</div>
      ${line("All fights", fights)}
      ${line("Own half", fights.filter((f) => ownHalf(f[0], f[1])))}
      ${line("Enemy half", fights.filter((f) => !ownHalf(f[0], f[1])))}
      <div>Deaths in fights: <b class="fm-k">${enemy}</b> enemy · <b class="fm-d">${own}</b> theirs</div></div>
    <p class="wm-note">${view === "heat"
      ? who === "net" ? "Green = more enemy deaths than theirs there (they win fights there); red = the reverse. Brighter = bigger margin."
        : "Brighter = more teamfight deaths there (scaled to the busiest spot)."
      : "One circle per teamfight at the middle of its deaths, bigger = more deaths. Green = they came out ahead (more enemy deaths), red = behind, grey = even. Hover a fight for the game and score; click it to open the game."}
      Dire games are mirrored so their own base is always bottom left; the dashed line is the river diagonal that splits own half from enemy half.
      Only deaths inside OpenDota's teamfights have a spot, so pickoffs aren't here.</p>`;

  fig.dataset.idle = `${fights.length} teamfights: ${rec(fights).w} won, ${rec(fights).l} lost, ${rec(fights).e} even. ${view === "fights" ? "Hover a fight for the game and score." : "Switch to Fights to see each one."}`;
  fig.querySelector(".dm-read").textContent = fig.dataset.idle;
}

function readout(fig, el) {
  const read = fig.querySelector(".dm-read");
  fig.querySelectorAll(".fm-f.hl").forEach((n) => n.classList.remove("hl"));
  if (!el) { read.textContent = fig.dataset.idle ?? ""; read.classList.remove("on"); return; }
  const D = JSON.parse(fig.dataset.fights), [, , t, own, enemy, g] = D.fights[+el.dataset.i], [opp, won] = D.games[g];
  el.classList.add("hl");
  read.textContent = `vs ${opp} (${won ? "won" : "lost"} the game) · teamfight at ${clock(t)}: ${enemy} enemy death${enemy === 1 ? "" : "s"}, ${own} of theirs — ${enemy > own ? "won the fight" : enemy < own ? "lost the fight" : "even"}.`;
  read.classList.add("on");
}

// gameHref(id) → link for a game, so clicking a fight opens it (optional).
export function wireFightMaps(root, { gameHref = null } = {}) {
  root.querySelectorAll("figure.fightmap[data-fights]").forEach((fig) => {
    draw(fig);
    wireZoom(fig, { skip: ".fm-f" });
    fig.querySelectorAll(".wm-seg").forEach((sg) => sg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      fig.dataset[sg.dataset.ctl] = b.dataset.v;
      sg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw(fig);
    }));
    fig.addEventListener("pointerover", (e) => { if (!fig.classList.contains("panning")) readout(fig, e.target.closest?.(".fm-f")); });
    fig.addEventListener("pointerleave", () => readout(fig, null));
    fig.addEventListener("click", (e) => {
      const f = e.target.closest?.(".fm-f");
      if (!f || !gameHref) return;
      const D = JSON.parse(fig.dataset.fights);
      location.hash = gameHref(D.games[D.fights[+f.dataset.i][5]][2]);
    });
  });
}
