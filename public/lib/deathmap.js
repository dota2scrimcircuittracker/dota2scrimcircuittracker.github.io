// Deaths from parsed replays (AD2L). Each player carries `death_log`, flat groups of 6:
//   second, killer, gold lost, seconds dead, x, y
// killer: 0-9 = index into the game's players (slot order), -1 tower / fountain, -2 lane
// creeps, -3 neutrals, -4 Roshan / Tormentor / anything else.
// Gold lost and seconds dead are -1 when unknown: OpenDota has no deaths_log for some parsed
// games (29 of 48 S48 Champion games), so their deaths are rebuilt from the killers'
// kills_log. That covers every death to a hero (18,808 of 18,812 where both logs exist) but
// not deaths to towers, creeps or neutrals, and it carries no gold or respawn time.
// x, y on the ward map's grid for deaths inside an OpenDota teamfight; 0, 0 = inside a
// teamfight but no spot recorded; -1, -1 = not in a teamfight. OpenDota only records where
// someone died for teamfight deaths, so lane deaths and pickoffs have a time and no place.
// Each game carries `fights`, flat groups of 3: start, end, deaths.
//
// deathsFrom() builds death_log for the sync. deathMapHtml() is one card: teamfight deaths on
// the minimap, and beside it lane deaths and pickoffs on a time axis, one row per hero.
// wireDeathMaps() draws it and wires the team, phase and timeline controls.

import { applyZoom, wireZoom } from "./mapzoom.js";
import { heroImg } from "./hero-meta.js";

const IMG = { src: "img/minimap.webp", x0: 56.94, x1: 206.2, y0: 62.3, y1: 202.8 };
const Y = (y) => 256 - y;
const VB = { x: IMG.x0, y: Y(IMG.y1), w: IMG.x1 - IMG.x0, h: IMG.y1 - IMG.y0 };
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const clock = (s) => `${s < 0 ? "-" : ""}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, "0")}`;
const fmtGold = (g) => (g >= 1000 ? `${(g / 1000).toFixed(1)}k` : String(g));

// Deaths outside a teamfight before this second are lane deaths; after it, pickoffs.
export const LANE_END = 600;

const KILLER = { "-1": "a tower", "-2": "creeps", "-3": "neutrals", "-4": "Roshan / Tormentor" };
function killerCode(key, heroIndex) {
  if (key in heroIndex) return heroIndex[key];
  if (/tower|fountain|fort|rax/.test(key)) return -1;
  if (/creep|siege/.test(key)) return -2;
  if (/neutral/.test(key)) return -3;
  return -4;
}

// OpenDota match → { players: [death_log per player, slot order], fights }. heroKey(hero_id)
// gives the "npc_dota_hero_…" name that deaths_log uses for a killer. Null when unparsed.
export function deathsFrom(d, heroKey) {
  const players = [...(d.players ?? [])].sort((x, y) => x.player_slot - y.player_slot);
  if (players.length !== 10) return null;
  const heroIndex = Object.fromEntries(players.map((p, i) => [heroKey(p.hero_id), i]).filter(([k]) => k));
  const full = players.every((p) => Array.isArray(p.deaths_log));
  if (!full && !players.every((p) => Array.isArray(p.kills_log))) return null;
  const logOf = (p, i) => full ? p.deaths_log
    : players.flatMap((k) => k.kills_log.filter((x) => x.key === heroKey(p.hero_id)).map((x) => ({ time: x.time, key: heroKey(k.hero_id) })));
  const fights = Array.isArray(d.teamfights) ? d.teamfights : [];
  const logs = players.map((p, n) => {
    // Meepo's clones die together and log one entry each: one death per second is enough.
    const seen = new Set();
    const rows = logOf(p, n).filter((x) => !seen.has(x.time) && seen.add(x.time)).sort((a, b) => a.time - b.time)
      .map((x) => ({ t: x.time, k: killerCode(x.key ?? "", heroIndex), g: x.gold_lost ?? -1, dead: x.time_dead ?? -1, x: -1, y: -1 }));
    // Pair this player's teamfight deaths with the spots OpenDota recorded for that fight.
    // Spots come unordered, so two deaths in one fight may swap places; that's rare.
    const pi = d.players.indexOf(p);
    for (const f of fights) {
      const fp = f.players?.[pi];
      if (!fp?.deaths) continue;
      const spots = [];
      for (const [x, ys] of Object.entries(fp.deaths_pos ?? {})) for (const [y, n] of Object.entries(ys)) for (let i = 0; i < n; i++) spots.push([+x, +y]);
      rows.filter((r) => r.t >= f.start && r.t <= f.end).forEach((r, i) => { [r.x, r.y] = spots[i] ?? [0, 0]; });
    }
    return rows.flatMap((r) => [r.t, r.k, r.g, r.dead, r.x, r.y]);
  });
  return { players: logs, full, fights: fights.flatMap((f) => [f.start, f.end, f.deaths ?? 0]) };
}

export const hasDeaths = (m) => Array.isArray(m.players) && m.players.length > 0 && m.players.every((p) => Array.isArray(p.death_log));

// Every death in a game, oldest first: { i (player index), team, t, killer, gold, dead, x, y, kind }.
// kind: "fight" (in a teamfight), "lane" (before LANE_END), "pickoff" (after).
export function deathsOf(m) {
  if (!hasDeaths(m)) return [];
  const out = [];
  m.players.forEach((p, i) => {
    const a = p.death_log;
    for (let j = 0; j + 5 < a.length; j += 6) {
      const x = a[j + 4], y = a[j + 5];
      out.push({ i, team: p.team, t: a[j], killer: a[j + 1], gold: a[j + 2], dead: a[j + 3], x, y,
        kind: x >= 0 ? "fight" : a[j] < LANE_END ? "lane" : "pickoff" });
    }
  });
  return out.sort((p, q) => p.t - q.t);
}

const who = (m, i) => `${m.players[i].name} (${m.players[i].hero})`;
const killerName = (m, k) => (k >= 0 && m.players[k] ? who(m, k) : KILLER[k] ?? "unknown");
const tip = (m, d) => `${who(m, d.i)} died at ${clock(d.t)} to ${killerName(m, d.killer)}.${d.gold >= 0 ? ` Lost ${d.gold} gold, dead ${d.dead}s.` : ""}`;

const PHASES = [["0", "0–10'", 0, 600], ["1", "10–20'", 600, 1200], ["2", "20–35'", 1200, 2100], ["3", "35'+", 2100, Infinity]];
const seg = (name, opts, on) => `<div class="wm-seg" role="group" data-ctl="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === on}">${l}</button>`).join("")}</div>`;

// ---------- one card: where deaths happen (map) and when (chart), linked ----------
// Two views share the card. A game: both teams, and a timeline with a row per hero. A player:
// their deaths over all their games, Dire games mirrored so their own base is bottom left,
// and a histogram of when in the game they die. Each death in the card's data is
//   [row, second, x, y, kind (0 fight, 1 lane, 2 pickoff), gold, dead, tooltip, group, short, hero]
// group = team ("a" / "b") in a game, win or loss ("w" / "l") on a player page; hero = the
// hero the filter keys on (the one who died). The card also carries the same deaths seen as
// kills (`k`, a Deaths | Kills toggle): each hero death credited to the hero with the last
// hit (OpenDota has no assists per death), in the victim's spot and of the victim's kind. In a
// game the row, group and hero are the killer's; on a player page, the kills are the player's,
// and [11] names the victim so the map shows who they killed.
// Hovering a death, a teamfight or a 2-minute bar lights it up on both sides and fills the
// readout line above them.

const KIND = { fight: 0, lane: 1, pickoff: 2 };
const KIND_NAME = ["Teamfight death", "Lane death", "Pickoff"];
const CX = (74.6 + 182.9) / 2, CY = (78.0 + 177.9) / 2; // map centre, as in wardmap.js
const BIN = 120; // player chart: seconds per bar

function cardHtml(spec, id) {
  const phases = PHASES.filter(([, , from]) => from < spec.dur);
  const player = spec.mode === "player";
  // Hero filter: a player's heroes by games played; a game's ten heroes by team.
  const heroOpts = player
    ? [...new Set(spec.games.map(([h]) => h))].map((h) => [h, spec.games.filter(([x]) => x === h).length])
      .sort((p, q) => q[1] - p[1] || p[0].localeCompare(q[0])).map(([h, n]) => `<option value="${attr(h)}">${attr(h)} (${n} game${n === 1 ? "" : "s"})</option>`).join("")
    : spec.groups.map(([g, name]) => `<optgroup label="${attr(name)}">${spec.rows.filter((r) => r[2] === g).map((r) => `<option value="${attr(r[0])}">${attr(r[0])} · ${attr(r[1])}</option>`).join("")}</optgroup>`).join("");
  return `<figure class="wardmap deathmap" id="${id}" data-mode="${spec.mode}" data-what="deaths" data-phase="all" data-side="all" data-show="solo" data-hero="" data-deaths="${attr(JSON.stringify(spec))}">
    <div class="wm-controls">
      ${seg("what", [["deaths", "Deaths"], ["kills", "Kills"]], "deaths")}
      <label class="dm-pick"><span>Hero</span><select data-ctl="hero"><option value="">${player ? "Every hero" : "All ten heroes"}</option>${heroOpts}</select></label>
      ${seg("side", [["all", player ? "Every game" : "Both teams"], ...spec.groups], "all")}
      ${seg("phase", [["all", "Whole game"], ...phases], "all")}
      ${player ? "" : seg("show", [["solo", "Lane & pickoffs"], ["all", "Everything"]], "solo")}
    </div>
    <div class="dm-read" aria-live="polite"></div>
    <div class="dm-body">
      <div class="dm-col"><div class="dm-h dm-h-map"></div><div class="wm-map"></div><div class="dm-fights"></div></div>
      <div class="dm-col"><div class="dm-h dm-h-chart"></div><div class="dt-chart"></div><div class="dt-side"></div></div>
    </div>
    <p class="wm-note dm-note"></p>
  </figure>`;
}

// m: an AD2L game whose players carry death_log. Empty string when it has none.
export function deathMapHtml(m, { id = "deaths" } = {}) {
  const deaths = deathsOf(m);
  if (!deaths.length) return "";
  return cardHtml({
    mode: "game",
    groups: [["a", m.team_a], ["b", m.team_b]],
    dur: Math.max(m.duration_sec, ...deaths.map((d) => d.t + Math.max(0, d.dead))),
    known: deaths.every((d) => d.gold >= 0),
    missing: m.players.reduce((t, p) => t + Math.max(0, (p.deaths ?? 0) - p.death_log.length / 6), 0),
    fights: m.fights ?? [],
    rows: m.players.map((p) => [p.hero, p.name, p.team]),
    d: deaths.map((d) => [d.i, d.t, d.x, d.y, KIND[d.kind], d.gold, d.dead, tip(m, d), d.team,
      `${m.players[d.i].hero} · ${clock(d.t)} · by ${killerShort(m, d.killer)}`, m.players[d.i].hero]),
    k: deaths.filter((d) => d.killer >= 0 && m.players[d.killer] && m.players[d.killer].team !== d.team).map((d) => {
      const kp = m.players[d.killer];
      return [d.killer, d.t, d.x, d.y, KIND[d.kind], d.gold, d.dead,
        `${who(m, d.killer)} killed ${who(m, d.i)} at ${clock(d.t)}.`, kp.team,
        `${kp.hero} killed ${m.players[d.i].hero} · ${clock(d.t)}`, kp.hero];
    }),
  }, id);
}

// One player's deaths over every game `match(p, m)` picks out that has death data.
// Empty string when none do.
export function playerDeathsHtml(games, match, { id = "player-deaths", name = "This player" } = {}) {
  const mine = games.filter(hasDeaths).map((m) => ({ m, i: m.players.findIndex((p) => match(p, m)) })).filter(({ i }) => i >= 0);
  if (!mine.length) return "";
  const d = [], kills = [], played = []; // played: [hero, "w" | "l"] per game, for per-game averages
  let known = true, missing = 0, dur = 0;
  for (const { m, i } of mine) {
    const p = m.players[i], g = m.winner === p.team ? "w" : "l", flip = p.team === "b";
    played.push([p.hero, g]);
    dur = Math.max(dur, m.duration_sec);
    missing += Math.max(0, (p.deaths ?? 0) - p.death_log.length / 6);
    const opp = p.team === "a" ? m.team_b : m.team_a;
    for (const x of deathsOf(m).filter((x) => x.i === i)) {
      if (x.gold < 0) known = false;
      const mx = x.x > 0 && flip ? +(2 * CX - x.x).toFixed(1) : x.x, my = x.y > 0 && flip ? +(2 * CY - x.y).toFixed(1) : x.y;
      d.push([0, x.t, mx, my, KIND[x.kind], x.gold, x.dead,
        `${p.hero} vs ${opp} (${g === "w" ? "won" : "lost"}): died at ${clock(x.t)} to ${killerName(m, x.killer)}.${x.gold >= 0 ? ` Lost ${x.gold} gold, dead ${x.dead}s.` : ""}`, g,
        `${clock(x.t)} · ${p.hero} vs ${opp} (${g === "w" ? "W" : "L"}) · by ${killerShort(m, x.killer)}`, p.hero]);
    }
    for (const x of deathsOf(m).filter((x) => x.killer === i && x.team !== p.team)) {
      const v = m.players[x.i];
      const mx = x.x > 0 && flip ? +(2 * CX - x.x).toFixed(1) : x.x, my = x.y > 0 && flip ? +(2 * CY - x.y).toFixed(1) : x.y;
      kills.push([0, x.t, mx, my, KIND[x.kind], x.gold, x.dead,
        `${p.hero} vs ${opp} (${g === "w" ? "won" : "lost"}): killed ${v.name} (${v.hero}) at ${clock(x.t)}.`, g,
        `${clock(x.t)} · ${p.hero} killed ${v.hero} · vs ${opp} (${g === "w" ? "W" : "L"})`, p.hero, v.hero]);
    }
  }
  return cardHtml({ mode: "player", name, groups: [["w", "Wins"], ["l", "Losses"]], games: played, dur, known, missing, d, k: kills }, id);
}

function data(fig) {
  const D = JSON.parse(fig.dataset.deaths);
  D.deaths = D.d;
  D.kills = fig.dataset.what === "kills";
  if (D.kills) D.d = D.k ?? [];
  return D;
}
const WORDS = { deaths: ["deaths", "lane deaths", "pickoffs", "teamfight deaths"], kills: ["kills", "lane kills", "pickoffs", "teamfight kills"] };

const killerShort = (m, k) => (k >= 0 && m.players[k] ? m.players[k].hero : KILLER[k] ?? "unknown");

// Which teamfight (index into the flat fights list / 3) a second falls in, or -1.
function fightAt(fights, t) {
  for (let j = 0; j + 2 < fights.length; j += 3) if (t >= fights[j] && t <= fights[j + 1]) return j / 3;
  return -1;
}

function draw(fig) {
  const D = data(fig), player = D.mode === "player", Wd = WORDS[D.kills ? "kills" : "deaths"];
  fig.querySelector(".dm-h-map").textContent = player ? (D.kills ? "Where they get teamfight kills" : "Where they die in teamfights") : (D.kills ? "Where: teamfight kills" : "Where: teamfight deaths");
  fig.querySelector(".dm-h-chart").textContent = player ? (D.kills ? "When they get kills" : "When they die") : `When: every ${D.kills ? "kill" : "death"}, lane & pickoffs first`;
  const ph = PHASES.find(([v]) => v === fig.dataset.phase), side = fig.dataset.side;
  const cls = (g) => (player ? "mine" : g);
  const inPhase = (t) => !ph || (t >= ph[2] && t < ph[3]);
  const inSide = (g) => side === "all" || g === side;
  const hero = fig.dataset.hero || "";
  const inHero = (x) => !hero || x[10] === hero;
  const keep = (x) => inSide(x[8]) && inHero(x);
  const on = (x) => keep(x) && inPhase(x[1]);
  const shown = D.d.filter(on);
  // Games behind a player's per-game numbers: those the win/loss and hero filters keep.
  const gamesIn = (g) => (player ? D.games.filter(([h, w]) => w === g && (!hero || h === hero)).length : 1);

  // Where: teamfight deaths with a spot, each the dead hero's portrait in a team-coloured ring
  // (a cross if there's no portrait). data-k links a mark to its timeline mark, data-f to its
  // fight, data-b to its bar on a player's chart. Latest deaths draw on top.
  const clip = `${fig.id}-clip`;
  const marks = D.d.map((x, k) => {
    if (!on(x) || x[4] !== 0 || x[2] <= 0) return "";
    // Drawn at 0,0 and moved into place, so the mark keeps its size when the map is zoomed.
    const [, t, mx, my, , , , , g] = x, img = heroImg(x[11] ?? x[10]), r = 1.5;
    const body = img
      ? `<circle r="3.4"/><image href="${attr(img)}" x="-3" y="-3" width="6" height="6" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`
      : `<circle r="${r + 0.9}"/><path d="M${-r} ${-r}L${r} ${r}M${r} ${-r}L${-r} ${r}"/>`;
    return `<g class="dm-x${img ? " dm-p" : ""} s-${cls(g)}" data-k="${k}"${player ? ` data-b="${Math.floor(t / BIN)}"` : ` data-f="${fightAt(D.fights, t)}"`} style="transform:translate(${mx}px,${Y(my)}px) scale(var(--ms,1))">${body}</g>`;
  }).join("");
  const placed = shown.filter((x) => x[4] === 0 && x[2] > 0).length;
  fig.querySelector(".wm-map").innerHTML = `<svg viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" role="img" aria-label="Teamfight deaths, ${placed} shown">
    <defs><clipPath id="${clip}" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath></defs>
    <image href="${IMG.src}" x="${VB.x}" y="${VB.y}" width="${VB.w}" height="${VB.h}" preserveAspectRatio="none"/>
    <rect class="wm-dim" x="${VB.x}" y="${VB.y}" width="${VB.w}" height="${VB.h}"/>
    <text class="wm-lbl a" x="${VB.x + 3}" y="${VB.y + VB.h - 3}">${attr(player ? "Own side" : D.groups[0][1])}</text>
    <text class="wm-lbl b" x="${VB.x + VB.w - 3}" y="${VB.y + 7}" text-anchor="end">${attr(player ? "Enemy side" : D.groups[1][1])}</text>${marks}</svg>`;
  applyZoom(fig);

  // Under the map: a game's bloodiest fights (hover or tap one to light it up); a player's
  // teamfight deaths per game.
  const nGames = player ? D.groups.filter(([g]) => inSide(g)).reduce((t, [g]) => t + gamesIn(g), 0) : 1;
  if (player) {
    const n = shown.filter((x) => x[4] === 0).length;
    fig.querySelector(".dm-fights").innerHTML = `<span class="dm-lab">${D.kills ? "Teamfight kills" : "Teamfight deaths"}</span><span class="dm-chip"><b>${n}</b> in ${nGames} game${nGames === 1 ? "" : "s"} · <b>${nGames ? (n / nGames).toFixed(1) : 0}</b> a game</span>`;
  } else {
    const fights = [];
    for (let j = 0; j + 2 < D.fights.length; j += 3) {
      if (!inPhase(D.fights[j])) continue;
      const dead = D.deaths.filter((x) => x[4] === 0 && fightAt(D.fights, x[1]) === j / 3);
      fights.push({ f: j / 3, start: D.fights[j], a: dead.filter((x) => x[8] === "a").length, b: dead.filter((x) => x[8] === "b").length });
    }
    const top = [...fights].sort((p, q) => q.a + q.b - (p.a + p.b) || p.start - q.start).slice(0, 8).sort((p, q) => p.start - q.start);
    fig.querySelector(".dm-fights").innerHTML = top.length
      ? `<span class="dm-lab">Bloodiest fights</span>${top.map((f) => `<button type="button" class="dm-chip" data-f="${f.f}"><b>${clock(f.start)}</b> <span class="dm-n s-a">${f.a}</span>–<span class="dm-n s-b">${f.b}</span></button>`).join("")}`
      : `<span class="dm-lab">No teamfights${ph ? " in this phase" : ""}</span>`;
  }

  // When: drawn at the chart's real pixel width, so text stays its CSS size and names fit.
  const box = fig.querySelector(".dt-chart");
  const W = Math.max(300, Math.round(box.clientWidth || 640));
  fig.dataset.w = W;
  box.innerHTML = player ? histogram(D, W, keep, ph) : timeline(D, W, on, inSide, ph, Number(fig.dataset.lw || 0), hero);
  // Size the name column from the names as drawn (fonts vary), then draw again if it was short.
  if (!player && !fig.dataset.lw) {
    const widest = Math.max(0, ...[...box.querySelectorAll(".dt-name")].map((n) => n.getBBox?.().width ?? 0));
    if (widest) { fig.dataset.lw = Math.ceil(widest); box.innerHTML = timeline(D, W, on, inSide, ph, widest, hero); }
  }

  // Totals per team in a game; per game (wins and losses apart) for a player.
  const sum = (xs, j) => xs.reduce((s, x) => s + x[j], 0);
  const stat = ([g, name]) => {
    if (!inSide(g)) return "";
    if (hero && !player && !D.rows.some((r) => r[0] === hero && r[2] === g)) return ""; // one hero: just their team
    const xs = shown.filter((x) => x[8] === g), n = gamesIn(g);
    if (player && !n) return "";
    const per = (v) => (player ? (v / n).toFixed(1) : v);
    const line = (k, lab) => {
      const ks = xs.filter((x) => x[4] === k);
      return `<div class="dm-line k${k}"><i></i><b>${per(ks.length)}</b> ${lab}${D.known && !D.kills ? `<span>${fmtGold(Math.round(sum(ks, 5) / n))} gold · ${clock(Math.round(sum(ks, 6) / n))} dead</span>` : ""}</div>`;
    };
    return `<div class="wm-stat s-${cls(g)}"><div class="wm-who">${attr(name)}${player ? ` <span class="dm-sub">${n} game${n === 1 ? "" : "s"}, per game</span>` : ""}</div>
      ${line(1, Wd[1])}${line(2, Wd[2])}${line(0, Wd[3])}</div>`;
  };
  fig.querySelector(".dt-side").innerHTML = D.groups.map(stat).join("");

  const count = (k) => shown.filter((x) => x[4] === k).length;
  fig.dataset.idle = player
    ? `${shown.length} ${Wd[0]} in ${nGames} game${nGames === 1 ? "" : "s"}${ph ? ` during ${ph[1]}` : ""}: ${count(1)} in lane, ${count(2)} pickoffs, ${count(0)} in teamfights. Hover a portrait or a bar to see it on both sides; pick a hero to see only those games.`
    : `${shown.length} ${Wd[0]}${ph ? ` during ${ph[1]}` : ""}: ${count(1)} in lane, ${count(2)} pickoffs, ${count(0)} in teamfights. Hover a ${D.kills ? "kill" : "death"} or a teamfight on either side to find it on the other; click a hero name to see only their ${Wd[0]}.`;
  fig.querySelector(".dm-read").textContent = fig.dataset.idle;

  const unplaced = shown.filter((x) => x[4] === 0 && x[2] <= 0).length;
  fig.querySelector(".dm-note").innerHTML = `${D.kills ? "Kills are the last hit on an enemy hero (OpenDota has no assists per death), shown where and when the victim died. " : ""}Only teamfight deaths have a place in the replay data, so the map shows those${player ? ", with Dire games mirrored so their own base is always bottom left" : ""}${unplaced ? ` (${unplaced} ${unplaced === 1 ? "has" : "have"} no recorded spot)` : ""}.
    Lane death = before 10:00, outside a teamfight; pickoff = after 10:00, outside a teamfight.
    ${!D.known ? `${player ? "Some of these replays have" : "This replay has"} no death log, so deaths are rebuilt from hero kills: no gold lost or time dead.` : player ? "" : "The bar after each death is time spent dead."}${D.missing ? ` ${D.missing} death${D.missing === 1 ? "" : "s"} to towers, creeps or neutrals ${D.missing === 1 ? "isn't" : "aren't"} shown.` : ""}`;
}

// A game: every death on a time axis, one row per hero, names in full. Lane deaths and
// pickoffs stand out; teamfight deaths stay faint unless "Every death" is on.
function timeline(D, W, on, inSide, ph, nameW = 0, hero = "") {
  const ROW = 34, GAP = 16, T = 24, B = 26, R = 12;
  const L = 22 + (nameW || 8.5 * Math.max(...D.rows.map((r) => r[0].length)));
  const rows = ["a", "b"].flatMap((s) => D.rows.map((r, i) => i).filter((i) => D.rows[i][2] === s));
  const rowY = (k) => T + k * ROW + (k >= 5 ? GAP : 0) + ROW / 2;
  const H = rowY(rows.length - 1) + ROW / 2 + B;
  const x = (t) => L + (Math.max(0, t) / D.dur) * (W - L - R);
  const top0 = T - 6, h0 = H - B - top0;
  let svg = `<rect class="dt-lane" x="${x(0)}" y="${top0}" width="${x(LANE_END) - x(0)}" height="${h0}"/>
    <text class="dt-zone" x="${x(0) + 6}" y="${T - 10}">Laning</text>`;
  for (let j = 0; j + 2 < D.fights.length; j += 3) svg += `<rect class="dt-fight" data-f="${j / 3}" x="${x(D.fights[j])}" y="${top0}" width="${Math.max(3, x(D.fights[j + 1]) - x(D.fights[j]))}" height="${h0}"/>`;
  if (ph) svg += `<rect class="dt-window" x="${x(ph[2])}" y="${top0}" width="${x(Math.min(ph[3], D.dur)) - x(ph[2])}" height="${h0}"/>`;
  const step = (W - L) / (D.dur / 60) < 14 ? 10 : 5;
  for (let m = 0; m * 60 <= D.dur; m += step) svg += `<line class="grid" x1="${x(m * 60)}" x2="${x(m * 60)}" y1="${top0}" y2="${H - B}"/><text class="tick" x="${x(m * 60)}" y="${H - 8}" text-anchor="middle">${m}'</text>`;
  svg += rows.map((i, k) => `<text class="dt-name s-${D.rows[i][2]}${inSide(D.rows[i][2]) && (!hero || D.rows[i][0] === hero) ? "" : " off"}${hero === D.rows[i][0] ? " on" : ""}" data-hero="${attr(D.rows[i][0])}" x="${L - 10}" y="${rowY(k) + 4}" text-anchor="end">${attr(D.rows[i][0])}<title>${attr(D.rows[i][1])}</title></text>
    <line class="dt-row" x1="${L}" x2="${W - R}" y1="${rowY(k)}" y2="${rowY(k)}"/>`).join("");
  svg += D.d.map(([i, t, , , k, , dead, , g], n) => {
    const cy = rowY(rows.indexOf(i)), cx = x(t);
    const bar = dead > 0 ? `<rect class="dt-dead" x="${cx}" y="${cy - 2}" width="${Math.max(0, x(t + dead) - cx)}" height="4"/>` : "";
    const shape = k === 2
      ? `<rect class="dt-mark" x="${cx - 5}" y="${cy - 5}" width="10" height="10" transform="rotate(45 ${cx} ${cy})"/>`
      : `<circle class="dt-mark" cx="${cx}" cy="${cy}" r="${k === 0 ? 3.5 : 6}"/>`;
    return `<g class="dt-d ${["fight", "lane", "pickoff"][k]} s-${g}${on(D.d[n]) ? "" : " off"}" data-k="${n}" data-f="${k === 0 ? fightAt(D.fights, t) : -1}">${bar}${shape}</g>`;
  }).join("");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Death timeline">${svg}</svg>`;
}

// A player: deaths in each 2-minute stretch of the game, stacked lane / pickoff / teamfight,
// over the games the win/loss filter keeps. Every stretch stays drawn so the shape of the
// game stays in view; the phase shown is outlined and the rest fades.
function histogram(D, W, keep, ph) {
  const L = 34, R = 12, T = 34, B = 26, H = 300;
  const bins = Math.max(1, Math.ceil(Math.min(D.dur, 3600) / BIN));
  const count = Array.from({ length: bins }, () => [0, 0, 0]);
  for (const x of D.d) if (keep(x)) count[Math.min(bins - 1, Math.max(0, Math.floor(x[1] / BIN)))][x[4]]++;
  const max = Math.max(1, ...count.map((c) => c[0] + c[1] + c[2]));
  const step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : 10, top = Math.ceil(max / step) * step;
  const bw = (W - L - R) / bins, y = (v) => H - B - (v / top) * (H - T - B);
  const inPh = (b) => !ph || (b * BIN >= ph[2] && b * BIN < ph[3]);
  let svg = `<g class="dh-legend" transform="translate(${L},12)">${[[1, D.kills ? "Lane kills" : "Lane deaths"], [2, "Pickoffs"], [0, D.kills ? "Teamfight kills" : "Teamfight deaths"]].map(([k, l], j) =>
    `<rect class="dh-bar k${k}" x="${j * 130}" y="-8" width="10" height="10"/><text class="dt-zone" x="${j * 130 + 16}" y="1">${l}</text>`).join("")}</g>`;
  for (let v = 0; v <= top; v += step) svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 8}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
  svg += `<rect class="dt-lane" x="${L}" y="${T - 6}" width="${(LANE_END / BIN) * bw}" height="${H - B - T + 6}"/>`;
  const every = bw < 22 ? 5 : 1;
  for (let b = 0; b <= bins; b += every) svg += `<text class="tick" x="${L + b * bw}" y="${H - 8}" text-anchor="middle">${(b * BIN) / 60}'</text>`;
  count.forEach((c, b) => {
    let base = 0;
    const x0 = L + b * bw + 2, w = Math.max(1, bw - 4);
    for (const k of [1, 2, 0]) {
      if (!c[k]) continue;
      svg += `<rect class="dh-bar k${k}${inPh(b) ? "" : " off"}" x="${x0}" y="${y(base + c[k])}" width="${w}" height="${y(base) - y(base + c[k])}"/>`;
      base += c[k];
    }
    svg += `<rect class="dh-hit" data-b="${b}" data-n="${c.join(",")}" x="${L + b * bw}" y="${T}" width="${bw}" height="${H - T - B}"/>`;
  });
  if (ph) svg += `<rect class="dt-window" x="${L + (ph[2] / BIN) * bw}" y="${T - 6}" width="${(Math.min(ph[3], bins * BIN) - ph[2]) / BIN * bw}" height="${H - B - T + 6}"/>`;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Deaths by game minute">${svg}</svg>`;
}

// Light up everything tied to the hovered element on both sides, and say what it is.
// On the map, a hovered cross brings along every cross near it (they overlap in busy spots)
// and lists them all in a tooltip at the pointer.
function highlight(fig, el, e) {
  fig.querySelectorAll(".hl").forEach((n) => n.classList.remove("hl"));
  const read = fig.querySelector(".dm-read"), tipEl = fig.querySelector(".dm-tip");
  if (tipEl) tipEl.hidden = true;
  if (!el) { fig.classList.remove("hl-on"); read.textContent = fig.dataset.idle ?? ""; read.classList.remove("on"); return; }
  const D = data(fig);
  const KN = D.kills ? ["Teamfight kill", "Lane kill", "Pickoff"] : KIND_NAME;
  let sel, text;
  if (el.classList.contains("dm-x")) {
    const svg = el.ownerSVGElement, ms = Number(svg.style.getPropertyValue("--ms") || 1);
    const me = D.d[+el.dataset.k], reach = 3.2 * ms;
    const near = [...svg.querySelectorAll(".dm-x")].map((n) => +n.dataset.k)
      .filter((k) => Math.hypot(D.d[k][2] - me[2], D.d[k][3] - me[3]) <= reach)
      .sort((p, q) => D.d[p][1] - D.d[q][1]);
    sel = near.map((k) => `[data-k="${k}"]`).join(",");
    text = near.length > 1 ? `${near.length} teamfight ${D.kills ? "kills" : "deaths"} in this spot: ${near.map((k) => D.d[k][9]).join("; ")}.` : `${KN[0]}: ${me[7]}`;
    if (tipEl && e) {
      const wrap = tipEl.parentElement.getBoundingClientRect();
      const cls = (g) => (D.mode === "player" ? "mine" : g);
      tipEl.innerHTML = `${near.length > 1 ? `<div class="dm-tip-h">${near.length} ${D.kills ? "kills" : "deaths"} here</div>` : ""}${near.slice(0, 10).map((k) =>
        `<div class="dm-tip-l s-${cls(D.d[k][8])}">${heroImg(D.d[k][11] ?? D.d[k][10]) ? `<img src="${attr(heroImg(D.d[k][11] ?? D.d[k][10]))}" alt="">` : "<i></i>"}${attr(D.d[k][9])}</div>`).join("")}${near.length > 10 ? `<div class="dm-tip-h">and ${near.length - 10} more</div>` : ""}`;
      tipEl.hidden = false;
      const left = e.clientX - wrap.left, top = e.clientY - wrap.top;
      tipEl.style.left = `${Math.min(left + 14, wrap.width - tipEl.offsetWidth - 4)}px`;
      tipEl.style.top = `${top + 14 + tipEl.offsetHeight > wrap.height ? top - tipEl.offsetHeight - 10 : top + 14}px`;
    }
  } else if (el.dataset.k != null && el.dataset.k !== "") {
    const x = D.d[+el.dataset.k];
    sel = `[data-k="${el.dataset.k}"]`;
    text = `${KN[x[4]]}: ${x[7]}${x[4] === 0 && x[2] <= 0 ? " No spot recorded for this one." : ""}`;
  } else if (el.dataset.f != null && +el.dataset.f >= 0) {
    const j = +el.dataset.f * 3, [s, e] = [D.fights[j], D.fights[j + 1]];
    const dead = D.deaths.filter((x) => x[4] === 0 && x[1] >= s && x[1] <= e);
    const lost = (g) => dead.filter((x) => x[8] === g).length;
    sel = `[data-f="${el.dataset.f}"]`;
    text = `Teamfight ${clock(s)}–${clock(e)}: ${D.groups[0][1]} lost ${lost("a")}, ${D.groups[1][1]} lost ${lost("b")}. ${dead.map((x) => D.rows[x[0]][0]).join(", ")}.`;
  } else if (el.dataset.b != null) {
    const b = +el.dataset.b, [f, l, p] = (el.dataset.n ?? "0,0,0").split(",").map(Number);
    sel = `[data-b="${b}"]`;
    text = `${clock(b * BIN)}–${clock((b + 1) * BIN)}: ${l} lane ${D.kills ? "kill" : "death"}${l === 1 ? "" : "s"}, ${p} pickoff${p === 1 ? "" : "s"}, ${f} teamfight ${D.kills ? "kill" : "death"}${f === 1 ? "" : "s"}${f ? " (lit up on the map where they have a spot)" : ""}.`;
  } else return highlight(fig, null);
  fig.querySelectorAll(sel).forEach((n) => n.classList.add("hl"));
  fig.classList.add("hl-on");
  read.textContent = text;
  read.classList.add("on");
}

export function wireDeathMaps(root) {
  root.querySelectorAll("figure.deathmap[data-deaths]").forEach((fig) => {
    draw(fig);
    const pick = fig.querySelector("select[data-ctl=hero]");
    const setHero = (h) => { fig.dataset.hero = h; pick.value = h; highlight(fig, null); draw(fig); };
    pick.addEventListener("change", () => setHero(pick.value));
    // Clicking a hero name on the timeline filters to that hero; clicking it again clears it.
    fig.addEventListener("click", (e) => { const n = e.target.closest?.(".dt-name"); if (n) setHero(fig.dataset.hero === n.dataset.hero ? "" : n.dataset.hero); });
    fig.querySelectorAll(".wm-seg").forEach((sg) => sg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      fig.dataset[sg.dataset.ctl] = b.dataset.v;
      sg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw(fig);
    }));
    wireZoom(fig, { skip: ".dm-x" });
    fig.querySelector(".mz-wrap").insertAdjacentHTML("beforeend", `<div class="dm-tip" hidden></div>`);
    const target = (e) => e.target.closest?.(".dm-x, .dt-d, .dt-fight, .dm-chip[data-f], .dh-hit");
    fig.addEventListener("pointerover", (e) => { if (!fig.classList.contains("panning")) highlight(fig, target(e), e); });
    fig.addEventListener("pointerleave", () => highlight(fig, null));
    fig.addEventListener("click", (e) => { const t = target(e); if (t) highlight(fig, t, e); });
    // Redraw at the new width when the card is resized (the chart is drawn in real pixels).
    const box = fig.querySelector(".dt-chart");
    if ("ResizeObserver" in globalThis) new ResizeObserver(() => {
      if (Math.abs(box.clientWidth - Number(fig.dataset.w)) > 8) draw(fig);
    }).observe(box);
  });
}
