// Smoke of Deceit (AD2L game and team pages): where and when smoke ganks land.
//
// OpenDota keeps no log of when or where a smoke was popped. What a parsed replay does carry:
//   smoke_used    per player, how many smokes they used (no time, no place)
//   smoke_kill_t  per player, the second of each hero kill OpenDota flags as made out of smoke
//   fight_smokes  per game, smokes each side used inside each teamfight, flat pairs in `fights`
//                 order: [Radiant, Dire, ...]
// A smoked kill is matched to the victim's death_log entry (same second, same killer), which
// gives it a spot on the map when the death was inside a teamfight (OpenDota records no spot
// otherwise, see lib/deathmap.js). So the map shows where smoke ganks ended, never where the
// smoke was used; the timeline shows every smoked kill.
//
// smokeMapHtml() is one game's card (map beside a timeline, a row per team); teamSmokeHtml() is
// a team's card over its games (map, Dire games mirrored, and a histogram by game minute).
// wireSmokeMaps() draws both and wires their controls.

import { deathsOf, hasDeaths } from "./deathmap.js";
import { heroImg } from "./hero-meta.js";
import { applyZoom, wireZoom } from "./mapzoom.js";
import { drawLayers } from "./maplayers.js";

const IMG = { src: "img/minimap.webp", x0: 56.94, x1: 206.2, y0: 62.3, y1: 202.8 };
const CX = (74.6 + 182.9) / 2, CY = (78.0 + 177.9) / 2;
const Y = (y) => 256 - y;
const VB = { x: IMG.x0, y: Y(IMG.y1), w: IMG.x1 - IMG.x0, h: IMG.y1 - IMG.y0 };
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const clock = (s) => `${s < 0 ? "-" : ""}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, "0")}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const seg = (name, opts, on) => `<div class="wm-seg" role="group" data-ctl="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === on}">${l}</button>`).join("")}</div>`;
const BIN = 120; // team chart: seconds per bar

export const hasSmokes = (m) => hasDeaths(m) && m.players.every((p) => Array.isArray(p.smoke_kill_t));

// Every smoked kill in a game, oldest first: { i (killer), v (victim, -1 if not matched), team
// (killer's), t, x, y } with x, y as in death_log (> 0 = a spot on the map).
export function smokeKillsOf(m) {
  if (!hasSmokes(m)) return [];
  const deaths = deathsOf(m), out = [];
  m.players.forEach((p, i) => {
    for (const t of p.smoke_kill_t) {
      const d = deaths.find((x) => x.t === t && x.killer === i);
      out.push({ i, v: d ? d.i : -1, team: p.team, t, x: d ? d.x : -1, y: d ? d.y : -1 });
    }
  });
  return out.sort((a, b) => a.t - b.t);
}

// Teamfights a side used a smoke in: [start, end, Radiant smokes, Dire smokes].
function smokeFightsOf(m) {
  const f = m.fights ?? [], s = m.fight_smokes ?? [];
  const out = [];
  for (let j = 0, n = 0; j + 2 < f.length; j += 3, n++) if (s[2 * n] || s[2 * n + 1]) out.push([f[j], f[j + 1], s[2 * n] ?? 0, s[2 * n + 1] ?? 0]);
  return out;
}

const usedBy = (m, team) => m.players.reduce((n, p) => n + (p.team === team ? p.smoke_used ?? 0 : 0), 0);

// ---------- one game ----------
// Card data: k = [killer, victim, t, x, y, team, readout], rows = [hero, name, team] per player.
export function smokeMapHtml(m, { id = "smokes" } = {}) {
  if (!hasSmokes(m)) return "";
  const kills = smokeKillsOf(m);
  const used = { a: usedBy(m, "a"), b: usedBy(m, "b") };
  if (!kills.length && !used.a && !used.b) return "";
  const who = (i) => `${m.players[i].name} (${m.players[i].hero})`;
  const spec = {
    mode: "game",
    groups: [["a", m.team_a], ["b", m.team_b]],
    dur: Math.max(m.duration_sec, ...kills.map((k) => k.t)),
    used,
    rows: m.players.map((p) => [p.hero, p.name, p.team]),
    fights: smokeFightsOf(m),
    k: kills.map((k) => [k.i, k.v, k.t, k.x, k.y, k.team,
      `${who(k.i)} killed ${k.v >= 0 ? who(k.v) : "an enemy hero"} out of smoke at ${clock(k.t)}.${k.x > 0 ? "" : " No spot recorded (outside a teamfight)."}`]),
  };
  return `<figure class="wardmap smokemap" id="${id}" data-mode="game" data-side="all" data-smoke="${attr(JSON.stringify(spec))}">
    <div class="wm-controls">${seg("side", [["all", "Both teams"], ...spec.groups], "all")}</div>
    <div class="dm-read" aria-live="polite"></div>
    <div class="dm-body">
      <div class="dm-col"><div class="dm-h">Where smoke ganks ended</div><p class="dm-cover"></p><div class="wm-map"></div></div>
      <div class="dm-col"><div class="dm-h">When: every kill out of smoke</div><div class="dt-chart"></div><div class="dt-side sm-side"></div></div>
    </div>
    <p class="wm-note">${HOW}</p>
  </figure>`;
}

const HOW = `A kill out of smoke is one OpenDota flags as made by a smoked hero. OpenDota doesn't record when or where a smoke was used,
  so the map shows where the gank ended (the victim's spot, kept only for deaths inside a teamfight) and the timeline shows when each smoked kill happened.
  Smokes used is the count from the replay, with no time.`;

function drawGame(fig) {
  const D = JSON.parse(fig.dataset.smoke), side = fig.dataset.side;
  const on = (k) => side === "all" || k[5] === side;
  const shown = D.k.filter(on);
  const placed = shown.filter((k) => k[3] > 0);

  // Map: each placed gank as the victim's portrait, ringed in the killing team's colour.
  const clip = `${fig.id}-clip`;
  const marks = D.k.map((k, n) => {
    if (!on(k) || k[3] <= 0) return "";
    const img = k[1] >= 0 ? heroImg(D.rows[k[1]][0]) : null, r = 1.5;
    const body = img
      ? `<circle r="3.4"/><image href="${attr(img)}" x="-3" y="-3" width="6" height="6" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`
      : `<circle r="${r + 0.9}"/><path d="M${-r} ${-r}L${r} ${r}M${r} ${-r}L${-r} ${r}"/>`;
    return `<g class="dm-x${img ? " dm-p" : ""} s-${k[5]}" data-k="${n}" style="transform:translate(${k[3]}px,${Y(k[4])}px) scale(var(--ms,1))">${body}</g>`;
  }).join("");
  fig.querySelector(".wm-map").innerHTML = `<svg viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" role="img" aria-label="Smoke ganks, ${placed.length} on the map">
    <defs><clipPath id="${clip}" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath></defs>
    <image href="${IMG.src}" x="${VB.x}" y="${VB.y}" width="${VB.w}" height="${VB.h}" preserveAspectRatio="none"/>
    <rect class="wm-dim" x="${VB.x}" y="${VB.y}" width="${VB.w}" height="${VB.h}"/>
    <text class="wm-lbl a" x="${VB.x + 3}" y="${VB.y + VB.h - 3}">${attr(D.groups[0][1])}</text>
    <text class="wm-lbl b" x="${VB.x + VB.w - 3}" y="${VB.y + 7}" text-anchor="end">${attr(D.groups[1][1])}</text>${marks}</svg>`;
  // The game Map tab's overlays (every kill, teamfights, objectives, wards), whole game.
  drawLayers(fig, -Infinity, Infinity, "smokes");
  applyZoom(fig);
  fig.querySelector(".dm-cover").innerHTML = shown.length
    ? `<b>${placed.length} of ${shown.length}</b> smoked kills on the map.${shown.length > placed.length ? ` The other ${shown.length - placed.length} weren't inside a teamfight, so they have a time but no place.` : ""}`
    : "No kills out of smoke.";

  // Timeline: a row per team, a dot per smoked kill (stacked when close), and a band where that
  // team used a smoke inside a teamfight.
  const W = 640, L = 12, R = 12, T = 22, ROW = 70, B = 24, H = T + 2 * ROW + B;
  const x = (t) => L + (Math.max(0, t) / D.dur) * (W - L - R);
  let svg = "";
  const step = D.dur > 3000 ? 10 : 5;
  for (let mn = 0; mn * 60 <= D.dur; mn += step) svg += `<line class="grid" x1="${x(mn * 60)}" x2="${x(mn * 60)}" y1="${T - 6}" y2="${H - B}"/><text class="tick" x="${x(mn * 60)}" y="${H - 8}" text-anchor="middle">${mn}'</text>`;
  D.groups.forEach(([g, name], r) => {
    const top = T + r * ROW, base = top + ROW - 12, off = side !== "all" && side !== g ? " off" : "";
    svg += `<text class="dt-name s-${g}${off}" x="${L}" y="${top + 4}">${attr(name)} · ${plural(D.used[g], "smoke")} used</text>
      <line class="dt-row" x1="${L}" x2="${W - R}" y1="${base}" y2="${base}"/>`;
    D.fights.forEach((f, j) => {
      const n = f[g === "a" ? 2 : 3];
      if (n) svg += `<rect class="sm-band s-${g}${off}" data-f="${j}" x="${x(f[0])}" y="${top + 10}" width="${Math.max(4, x(f[1]) - x(f[0]))}" height="${base - top - 10}"/>`;
    });
    let last = -1e9, lvl = 0;
    D.k.forEach((k, n) => {
      if (k[5] !== g) return;
      const cx = x(k[2]);
      lvl = cx - last < 9 ? Math.min(lvl + 1, 4) : 0;
      last = cx;
      svg += `<g class="dt-d s-${g}${on(k) ? "" : " off"}${k[3] > 0 ? "" : " sm-nospot"}" data-k="${n}"><circle class="dt-mark" cx="${cx}" cy="${base - lvl * 9}" r="5"/></g>`;
    });
  });
  fig.querySelector(".dt-chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kills out of smoke over the game">${svg}</svg>`;

  const stat = ([g, name]) => {
    if (side !== "all" && side !== g) return "";
    const mine = D.k.filter((k) => k[5] === g), theirs = D.k.filter((k) => k[5] !== g);
    return `<div class="wm-stat s-${g}"><div class="wm-who">${attr(name)}</div>
      <div><b>${D.used[g]}</b> smokes used · <b>${D.fights.filter((f) => f[g === "a" ? 2 : 3]).length}</b> teamfights with one</div>
      <div><b>${mine.length}</b> kills out of smoke (${mine.filter((k) => k[3] > 0).length} on the map)</div>
      <div><b>${theirs.length}</b> heroes lost to the enemy's smokes</div></div>`;
  };
  fig.querySelector(".sm-side").innerHTML = D.groups.map(stat).join("") +
    `<p class="wm-note">Filled dots were inside a teamfight and are on the map; hollow ones have no spot. A shaded band is a teamfight that team used a smoke in.</p>`;
  fig.dataset.idle = `${shown.length} kills out of smoke${side === "all" ? `: ${D.groups.map(([g, n]) => `${n} ${D.k.filter((k) => k[5] === g).length}`).join(", ")}` : ""}. Hover a dot or a portrait.`;
  fig.querySelector(".dm-read").textContent = fig.dataset.idle;
}

function readGame(fig, el) {
  const read = fig.querySelector(".dm-read");
  fig.querySelectorAll(".hl").forEach((n) => n.classList.remove("hl"));
  if (!el) { fig.classList.remove("hl-on"); read.textContent = fig.dataset.idle ?? ""; read.classList.remove("on"); return; }
  const D = JSON.parse(fig.dataset.smoke);
  let text;
  if (el.dataset.k != null) {
    fig.querySelectorAll(`[data-k="${el.dataset.k}"]`).forEach((n) => n.classList.add("hl"));
    text = D.k[+el.dataset.k][6];
  } else {
    const f = D.fights[+el.dataset.f];
    el.classList.add("hl");
    const inF = D.k.filter((k) => k[2] >= f[0] && k[2] <= f[1]);
    inF.forEach((k) => fig.querySelectorAll(`[data-k="${D.k.indexOf(k)}"]`).forEach((n) => n.classList.add("hl")));
    text = `Teamfight ${clock(f[0])}–${clock(f[1])}: ${D.groups[0][1]} used ${plural(f[2], "smoke")}, ${D.groups[1][1]} used ${plural(f[3], "smoke")}; ${plural(inF.length, "kill")} out of smoke in it.`;
  }
  fig.classList.add("hl-on");
  read.textContent = text;
  read.classList.add("on");
}

// ---------- one team, over its games ----------
// games: [[opponent, won 1/0, id, side, own smokes, enemy smokes, own kills, enemy kills]]
// k: [x, y, own 1/0, second, game, killer hero, victim hero]; x, y mirrored so the team's base is
// bottom left (-1, -1 = no spot).
export function teamSmokes(games, sideOf) {
  const out = { games: [], k: [] };
  for (const m of games) {
    const side = sideOf(m);
    if (!side || !hasSmokes(m)) continue;
    const gi = out.games.length, other = side === "a" ? "b" : "a";
    const kills = (t) => m.players.reduce((n, p) => n + (p.team === t ? p.kills ?? 0 : 0), 0);
    out.games.push([side === "a" ? m.team_b : m.team_a, m.winner === side ? 1 : 0, m.id, side, usedBy(m, side), usedBy(m, other), kills(side), kills(other)]);
    for (const k of smokeKillsOf(m)) {
      const [x, y] = k.x <= 0 ? [-1, -1] : side === "b" ? [+(2 * CX - k.x).toFixed(1), +(2 * CY - k.y).toFixed(1)] : [k.x, k.y];
      out.k.push([x, y, k.team === side ? 1 : 0, k.t, gi, m.players[k.i].hero, k.v >= 0 ? m.players[k.v].hero : null]);
    }
  }
  return out;
}

export function teamSmokeHtml(games, sideOf, { id = "team-smokes", name = "This team" } = {}) {
  const data = teamSmokes(games, sideOf);
  if (!data.games.length) return "";
  const sides = [["a", "Radiant"], ["b", "Dire"]].map(([v, l]) => [v, l, data.games.filter((g) => g[3] === v).length]).filter(([, , n]) => n);
  const side = sides.length === 1 ? sides[0][0] : "all";
  return `<figure class="wardmap smokemap" id="${id}" data-mode="team" data-side="${side}" data-who="all" data-result="all" data-smoke="${attr(JSON.stringify({ name, ...data }))}">
    <div class="wm-controls">
      ${seg("side", [...(sides.length > 1 ? [["all", "Both sides"]] : []), ...sides.map(([v, l, n]) => [v, `As ${l} (${n})`])], side)}
      ${seg("who", [["all", "Both"], ["own", "Their smoke kills"], ["enemy", "Smoked on them"]], "all")}
      ${seg("result", [["all", "Every game"], ["w", "Wins"], ["l", "Losses"]], "all")}
    </div>
    <div class="dm-read" aria-live="polite"></div>
    <div class="dm-body">
      <div class="dm-col"><div class="dm-h">Where smoke ganks ended</div><p class="dm-cover"></p><div class="wm-map"></div></div>
      <div class="dm-col"><div class="dm-h">When: kills out of smoke by game minute</div><div class="dt-chart"></div><div class="dt-side sm-side"></div></div>
    </div>
    <p class="wm-note">${HOW}</p>
  </figure>`;
}

function drawTeam(fig) {
  const D = JSON.parse(fig.dataset.smoke), { side, who, result } = fig.dataset;
  const gameOn = (g) => (result === "all" || (D.games[g][1] === 1) === (result === "w")) && (side === "all" || D.games[g][3] === side);
  const whoOn = (k) => who === "all" || (k[2] === 1) === (who === "own");
  const at = side === "b" ? (x, y) => [+(2 * CX - x).toFixed(1), +(2 * CY - y).toFixed(1)] : (x, y) => [x, y];
  const [bl, tr] = side === "a" ? [["a", "Radiant · own"], ["b", "Dire · enemy"]] : side === "b" ? [["b", "Radiant · enemy"], ["a", "Dire · own"]] : [["a", "Own side"], ["b", "Enemy side"]];
  const games = D.games.map((g, i) => i).filter(gameOn);
  const ks = D.k.map((k, n) => [...k, n]).filter((k) => gameOn(k[4]));
  const shown = ks.filter(whoOn), placed = shown.filter((k) => k[0] > 0);

  const dots = placed.map((k) => {
    const [x, y] = at(k[0], k[1]);
    return `<circle class="sm-pt ${k[2] ? "own" : "enemy"}" data-k="${k[7]}" r="1.7" style="transform:translate(${x}px,${Y(y)}px) scale(var(--ms,1))"/>`;
  }).join("");
  fig.querySelector(".wm-map").innerHTML = `<svg viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" role="img" aria-label="Smoke ganks, ${placed.length} on the map">
    <image href="${IMG.src}" x="${VB.x}" y="${VB.y}" width="${VB.w}" height="${VB.h}" preserveAspectRatio="none"/>
    <rect class="wm-dim" x="${VB.x}" y="${VB.y}" width="${VB.w}" height="${VB.h}"/>
    <text class="wm-lbl ${bl[0]}" x="${VB.x + 3}" y="${VB.y + VB.h - 3}">${bl[1]}</text>
    <text class="wm-lbl ${tr[0]}" x="${VB.x + VB.w - 3}" y="${VB.y + 7}" text-anchor="end">${tr[1]}</text>${dots}</svg>`;
  applyZoom(fig);
  fig.querySelector(".dm-cover").innerHTML = shown.length
    ? `<b>${placed.length} of ${shown.length}</b> smoked kills on the map; the rest weren't inside a teamfight, so they're only on the chart.`
    : "No kills out of smoke in these games.";

  // Histogram: smoked kills per 2-minute stretch, theirs and the enemy's side by side.
  const W = 640, L = 30, R = 10, T = 26, B = 24, H = 260;
  const maxT = Math.min(3600, Math.max(BIN, ...ks.map((k) => k[3])));
  const bins = Math.ceil((maxT + 1) / BIN);
  const cnt = Array.from({ length: bins }, () => [0, 0]);
  for (const k of shown) cnt[Math.min(bins - 1, Math.max(0, Math.floor(k[3] / BIN)))][k[2] ? 0 : 1]++;
  const max = Math.max(1, ...cnt.flat()), stepV = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : 10, top = Math.ceil(max / stepV) * stepV;
  const bw = (W - L - R) / bins, y = (v) => H - B - (v / top) * (H - T - B);
  let svg = `<g transform="translate(${L},10)"><rect class="sm-bar own" x="0" y="-8" width="10" height="10"/><text class="dt-zone" x="16" y="1">${attr(D.name)}</text>
    <rect class="sm-bar enemy" x="190" y="-8" width="10" height="10"/><text class="dt-zone" x="206" y="1">Opponents</text></g>`;
  for (let v = 0; v <= top; v += stepV) svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
  const every = bw < 22 ? 5 : 1;
  for (let b = 0; b <= bins; b += every) svg += `<text class="tick" x="${L + b * bw}" y="${H - 8}" text-anchor="middle">${(b * BIN) / 60}'</text>`;
  cnt.forEach(([o, e], b) => {
    const w = Math.max(1, (bw - 3) / 2), x0 = L + b * bw + 1.5;
    if (o) svg += `<rect class="sm-bar own" x="${x0}" y="${y(o)}" width="${w}" height="${y(0) - y(o)}"/>`;
    if (e) svg += `<rect class="sm-bar enemy" x="${x0 + w}" y="${y(e)}" width="${w}" height="${y(0) - y(e)}"/>`;
    svg += `<rect class="dh-hit" data-b="${b}" data-n="${o},${e}" x="${L + b * bw}" y="${T}" width="${bw}" height="${H - T - B}"/>`;
  });
  fig.querySelector(".dt-chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kills out of smoke by game minute">${svg}</svg>`;

  const n = games.length, sum = (j) => games.reduce((s, g) => s + D.games[g][j], 0);
  const own = ks.filter((k) => k[2] === 1).length, enemy = ks.length - own;
  const per = (v) => (n ? (v / n).toFixed(1) : "0");
  const share = (k, all) => (all ? `${Math.round((k / all) * 100)}%` : "—");
  fig.querySelector(".sm-side").innerHTML = `<div class="wm-stat s-mine"><div class="wm-who">${attr(D.name)} <span class="dm-sub">${plural(n, "game")}, per game</span></div>
      <div>Smokes used: <b>${per(sum(4))}</b> · opponents <b>${per(sum(5))}</b></div>
      <div>Kills out of smoke: <b class="fm-k">${per(own)}</b> · opponents <b class="fm-d">${per(enemy)}</b></div>
      <div>Share of kills out of smoke: <b>${share(own, sum(6))}</b> · opponents <b>${share(enemy, sum(7))}</b></div></div>`;
  fig.dataset.idle = `${plural(n, "game")}: ${own} kills out of smoke by ${D.name}, ${enemy} by opponents. Hover a dot or a bar.`;
  fig.querySelector(".dm-read").textContent = fig.dataset.idle;
}

function readTeam(fig, el) {
  const read = fig.querySelector(".dm-read");
  fig.querySelectorAll(".hl").forEach((n) => n.classList.remove("hl"));
  if (!el) { read.textContent = fig.dataset.idle ?? ""; read.classList.remove("on"); return; }
  const D = JSON.parse(fig.dataset.smoke);
  el.classList.add("hl");
  if (el.dataset.k != null) {
    const [, , own, t, g, killer, victim] = D.k[+el.dataset.k], [opp, won, , side] = D.games[g];
    read.textContent = `vs ${opp} as ${side === "b" ? "Dire" : "Radiant"} (${won ? "won" : "lost"}) · ${clock(t)}: ${own ? `${D.name}'s` : `${opp}'s`} ${killer} killed ${victim ?? "an enemy hero"} out of smoke. Click to open the game.`;
  } else {
    const b = +el.dataset.b, [o, e] = el.dataset.n.split(",").map(Number);
    read.textContent = `${clock(b * BIN)}–${clock((b + 1) * BIN)}: ${o} kill${o === 1 ? "" : "s"} out of smoke by ${D.name}, ${e} by opponents.`;
  }
  read.classList.add("on");
}

// gameHref(id) → link for a game, so clicking a team-card dot opens it (optional).
export function wireSmokeMaps(root, { gameHref = null } = {}) {
  root.querySelectorAll("figure.smokemap[data-smoke]").forEach((fig) => {
    const team = fig.dataset.mode === "team", draw = team ? drawTeam : drawGame, read = team ? readTeam : readGame;
    draw(fig);
    wireZoom(fig, { skip: team ? ".sm-pt" : ".dm-x" });
    fig.querySelectorAll(".wm-seg").forEach((sg) => sg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      fig.dataset[sg.dataset.ctl] = b.dataset.v;
      sg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw(fig);
    }));
    const target = (e) => e.target.closest?.(team ? ".sm-pt, .dh-hit" : ".dm-x, .dt-d, .sm-band");
    fig.addEventListener("pointerover", (e) => { if (!fig.classList.contains("panning")) read(fig, target(e)); });
    fig.addEventListener("pointerleave", () => read(fig, null));
    fig.addEventListener("click", (e) => {
      const t = target(e);
      if (!t) return;
      read(fig, t);
      if (team && gameHref && t.classList.contains("sm-pt")) {
        const D = JSON.parse(fig.dataset.smoke);
        location.hash = gameHref(D.games[D.k[+t.dataset.k][4]][2]);
      }
    });
  });
}
