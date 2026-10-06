// Dota 2 hero grid export: a team's heroes by the position they were played at, as one config
// in Dota's own hero_grid_config.json (Steam\userdata\<account id>\570\remote\cfg). Format checked
// against a file Dota wrote: { version: 3, configs: [{ config_name, categories: [{ category_name,
// x_position, y_position, width, height, hero_ids }] }] }. Dota shrinks the icons to fit each box.
import { HERO_META } from "./hero-meta.js";
import { phasedDraft } from "./draft.js";

const idByName = new Map(HERO_META.map(([id, n]) => [n.toLowerCase(), id]));
// The site's hero names (dotaconstants) and OpenDota's /api/heroes disagree on a few.
const ALIAS = { "outworld devourer": 76 };
export const heroIdOf = (name) => {
  const k = String(name ?? "").toLowerCase();
  return idByName.get(k) ?? ALIAS[k] ?? null;
};

export const POS_NAMES = { 1: "Carry", 2: "Mid", 3: "Offlane", 4: "Soft support", 5: "Hard support" };

// games: [{ m, side }] with players. For positions 1–5: the heroes the team played there (most
// games first, then most wins, then most recent) and who played the position most.
export function positionPools(games) {
  const pools = new Map([1, 2, 3, 4, 5].map((pos) => [pos, { pos, games: 0, heroes: new Map(), players: new Map() }]));
  for (const { m, side } of games) {
    const won = m.winner === side, t = m.start_time ?? (m.createdAt ?? 0) / 1000;
    for (const p of m.players ?? []) {
      const pool = p.team === side && pools.get(p.position);
      if (!pool || !p.hero) continue;
      pool.games++;
      const h = pool.heroes.get(p.hero) ?? { hero: p.hero, games: 0, wins: 0, last: 0 };
      h.games++; if (won) h.wins++; h.last = Math.max(h.last, t);
      pool.heroes.set(p.hero, h);
      pool.players.set(p.name, (pool.players.get(p.name) ?? 0) + 1);
    }
  }
  return [...pools.values()].map(({ heroes, players, ...pool }) => ({
    ...pool,
    player: [...players].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    heroes: [...heroes.values()].sort((a, b) => b.games - a.games || b.wins - a.wins || b.last - a.last),
  }));
}

const ROW_W = 1100, LINE_H = 100, GAP = 20, PER_LINE = 12;
const HALF_W = (ROW_W - GAP) / 2, HALF_LINE = PER_LINE / 2;
export const configName = (team) => `vs ${String(team).trim()}`.slice(0, 40);

// Rows ([{ name, heroes: [{ hero }], half }]) as one config: a full-width box per row, or two
// half-width ones side by side; taller when a box holds many heroes. Rows with no known hero
// are left out.
export function layoutConfig(config_name, rows) {
  const categories = [];
  let x = 0, y = 0, lineH = 0;
  const newLine = () => { if (x > 0) { y += lineH + GAP; x = 0; lineH = 0; } };
  for (const r of rows) {
    const ids = r.heroes.map((h) => heroIdOf(h.hero)).filter((id) => id != null);
    if (!ids.length) continue;
    const half = !!r.half, width = half ? HALF_W : ROW_W;
    if (!half || x + width > ROW_W) newLine();
    const height = LINE_H * Math.ceil(ids.length / (half ? HALF_LINE : PER_LINE));
    categories.push({ category_name: String(r.name).slice(0, 60), x_position: x, y_position: y, width, height, hero_ids: ids });
    lineH = Math.max(lineH, height);
    x += width + GAP;
    if (!half) newLine();
  }
  return { config_name, categories };
}

// Three columns, as the Drafter shows a matchup: the enemy on the left, bans in the middle, you
// on the right. Each stacks its own boxes.
export const COLS = ["them", "bans", "us"];
const COL_W = Math.floor((ROW_W - 2 * GAP) / 3), COL_LINE = 4;
export function columnConfig(config_name, rows) {
  const categories = [], y = { them: 0, bans: 0, us: 0 };
  for (const r of rows) {
    const ids = r.heroes.map((h) => heroIdOf(h.hero)).filter((id) => id != null);
    const col = COLS.includes(r.col) ? r.col : "them";
    if (!ids.length) continue;
    const height = LINE_H * Math.ceil(ids.length / COL_LINE);
    categories.push({ category_name: String(r.name).slice(0, 60), x_position: COLS.indexOf(col) * (COL_W + GAP), y_position: y[col], width: COL_W, height, hero_ids: ids });
    y[col] += height + GAP;
  }
  return { config_name, categories };
}

const posName = (p) => `Pos ${p.pos} ${POS_NAMES[p.pos]}${p.player ? ` · ${String(p.player).slice(0, 24)}` : ""}`;

// One config: a full-width row per position that was played.
export function gridConfig(team, pools) {
  return layoutConfig(configName(team), pools.map((p) => ({ name: posName(p), heroes: p.heroes })));
}

// ---------- templates ----------
// A template is a list of boxes, each filled from a source of one team's heroes. Sources are
// named generically (pos1, player2, bans…) so one template fits every team.
const byGames = (a, b) => b.games - a.games || b.wins - a.wins || b.last - a.last;
const tally = (map, hero, won, t) => {
  const h = map.get(hero) ?? { hero, games: 0, wins: 0, last: 0 };
  h.games++; if (won) h.wins++; h.last = Math.max(h.last, t);
  map.set(hero, h);
};

const PUB_DAY = 86400;
// One player's recent pubs (the division file's flat groups of 7: time, hero, won, k, d, a,
// ranked), heroes by games.
function pubHeroes(flat, now) {
  const heroes = new Map();
  for (let i = 0; i + 6 < (flat?.length ?? 0); i += 7) {
    if (flat[i] < now - 30 * PUB_DAY) continue;
    tally(heroes, flat[i + 1], flat[i + 2] === 1, flat[i]);
  }
  return [...heroes.values()].sort(byGames);
}

// All-time hero totals for one player (the draft file's `totals[account]`: `p` pubs and `l`
// practice lobbies, flat groups of 3: hero id, games, wins), by name, most games first.
export function decodeTotals(entry, heroNames) {
  const list = (flat) => {
    const out = [];
    for (let i = 0; i + 2 < (flat?.length ?? 0); i += 3) {
      const hero = heroNames?.[flat[i]];
      if (hero) out.push({ hero, games: flat[i + 1], wins: flat[i + 2] });
    }
    return out.sort((a, b) => b.games - a.games);
  };
  return { pubs: list(entry?.p), lobby: list(entry?.l) };
}
const sumHeroes = (lists) => {
  const all = new Map();
  for (const h of lists.flat()) { const x = all.get(h.hero) ?? { hero: h.hero, games: 0, wins: 0 }; x.games += h.games; x.wins += h.wins; all.set(h.hero, x); }
  return [...all.values()].sort((a, b) => b.games - a.games);
};

// games: [{ m, side }]. Optional: totals and heroNames, the draft file's all-time hero totals
// (decodeTotals) and hero names; pubs, account id -> flat pub rows (the division file's
// `pubs`); model, the draft model's read of this team (parts/cmdraft.js heroGridModel):
// { threats, likely, banvs, vs }. Returns key -> { name, note, heroes: [{ hero, games?, wins?,
// tag?, title? }] }; a source with nothing to go on is left out.
export function heroSources(games, { model = null, pubs = null, totals = null, heroNames = null, now = Date.now() / 1000 } = {}) {
  const out = {};
  for (const p of positionPools(games)) out[`pos${p.pos}`] = { name: posName(p), note: p.player ? `mostly ${p.player}` : "", heroes: p.heroes };
  const players = new Map(), picks = new Map(), bans = new Map(), against = new Map();
  const bansBy = [new Map(), new Map(), new Map()], againstBy = [new Map(), new Map(), new Map()]; // per ban phase
  for (const { m, side } of games) {
    const won = m.winner === side, t = m.start_time ?? (m.createdAt ?? 0) / 1000;
    for (const p of m.players ?? []) {
      if (p.team !== side || !p.hero) continue;
      const k = p.player_key ?? String(p.name).trim().toLowerCase();
      const pl = players.get(k) ?? { key: k, name: p.name, games: 0, heroes: new Map() };
      pl.games++;
      tally(pl.heroes, p.hero, won, t);
      players.set(k, pl);
      tally(picks, p.hero, won, t);
    }
    for (const d of phasedDraft(m.draft)) {
      if (d.pick || !d.hero) continue;
      tally(d.side === side ? bans : against, d.hero, won, t);
      const p = Math.min(d.phase, 3) - 1;
      tally((d.side === side ? bansBy : againstBy)[p], d.hero, won, t);
    }
  }
  const five = [...players.values()].sort((a, b) => b.games - a.games).slice(0, 5);
  five.forEach((pl, i) => {
    out[`player${i + 1}`] = { name: String(pl.name).slice(0, 40), note: `${pl.games} game${pl.games === 1 ? "" : "s"}`, heroes: [...pl.heroes.values()].sort(byGames) };
  });
  out.picks = { name: "Picks most", note: "", heroes: [...picks.values()].sort(byGames) };
  out.bans = { name: "Bans most", note: "their bans", heroes: [...bans.values()].sort(byGames) };
  out.banned = { name: "Banned against them", note: "opponents' bans", heroes: [...against.values()].sort(byGames) };
  [0, 1, 2].forEach((p) => {
    if (againstBy[p].size) out[`banned${p + 1}`] = { name: `Banned against them · phase ${p + 1}`, note: BAN_PHASE_NOTE[p], heroes: [...againstBy[p].values()].sort(byGames) };
    if (bansBy[p].size) out[`bans${p + 1}`] = { name: `They ban · phase ${p + 1}`, note: BAN_PHASE_NOTE[p], heroes: [...bansBy[p].values()].sort(byGames) };
  });
  if (pubs) {
    const all = new Map();
    five.forEach((pl, i) => {
      const list = pubHeroes(pubs[pl.key], now);
      if (!list.length) return;
      out[`pubs${i + 1}`] = { name: `${String(pl.name).slice(0, 30)} pubs`, note: `${list.reduce((a, h) => a + h.games, 0)} pubs, last 30 days`, heroes: list };
      for (const h of list) { const x = all.get(h.hero) ?? { hero: h.hero, games: 0, wins: 0, last: 0 }; x.games += h.games; x.wins += h.wins; x.last = Math.max(x.last, h.last); all.set(h.hero, x); }
    });
    if (all.size) out.pubs = { name: "Their pubs", note: "the five's last 30 days", heroes: [...all.values()].sort(byGames) };
    // Highlight what they've been playing in pubs: each hero's recent pubs, by that player in
    // their own boxes, by any of the five elsewhere.
    const mark = (list, counts) => list.map((h) => (counts.get(h.hero) ? { ...h, pubs: counts.get(h.hero) } : h));
    const team = new Map([...all.values()].map((h) => [h.hero, h.games]));
    for (const [k, src] of Object.entries(out)) {
      if (k.startsWith("pubs")) continue;
      const i = k.match(/^player(\d)$/)?.[1];
      src.heroes = mark(src.heroes, i ? new Map((out[`pubs${i}`]?.heroes ?? []).map((h) => [h.hero, h.games])) : team);
    }
    out._pubCounts = team;
  }
  if (totals && heroNames) {
    const all = five.map((pl) => decodeTotals(totals[pl.key], heroNames));
    const count = (list) => list.reduce((a, h) => a + h.games, 0).toLocaleString();
    all.forEach((t, i) => {
      const nm = String(five[i].name).slice(0, 30);
      if (t.pubs.length) out[`allpubs${i + 1}`] = { name: `${nm} all-time pubs`, note: `${count(t.pubs)} pubs`, heroes: t.pubs };
      if (t.lobby.length) out[`alllobby${i + 1}`] = { name: `${nm} all-time lobbies`, note: `${count(t.lobby)} league, scrim and inhouse games`, heroes: t.lobby };
    });
    const pubsAll = sumHeroes(all.map((t) => t.pubs)), lobbyAll = sumHeroes(all.map((t) => t.lobby));
    if (pubsAll.length) out.allpubs = { name: "All-time pubs", note: "the five together", heroes: pubsAll };
    if (lobbyAll.length) out.alllobby = { name: "All-time lobby games", note: "league, scrims, inhouses", heroes: lobbyAll };
  }
  if (model) {
    const vs = model.vs ? `vs ${model.vs}` : "vs an average team";
    if (model.likely?.length) out.likely = { name: "Likely picks", note: "the model: who'd play it", heroes: model.likely.slice(0, 24) };
    if (model.banvs?.length) out.banvs = { name: "Ban against them", note: `the model, ${vs}`, heroes: model.banvs.slice(0, 24) };
    (model.banPhases ?? []).forEach((list, p) => {
      if (list.length) out[`banvs${p + 1}`] = { name: `Ban phase ${p + 1}`, note: `${BAN_PHASE_NOTE[p]}; the model, ${vs}`, heroes: list.slice(0, 24) };
    });
    if (model.threats?.length) {
      out.threats = { name: "Model threats", note: `best for them, ${vs}`, heroes: model.threats.slice(0, 24) };
      for (const pos of [1, 2, 3, 4, 5]) {
        out[`threat${pos}`] = { name: `Threats pos ${pos} ${POS_NAMES[pos]}`, note: "best for them here", heroes: model.threats.filter((h) => h.pos.includes(pos - 1)).slice(0, 12) };
      }
    }
  }
  if (out._pubCounts) {
    for (const k of ["likely", "banvs", "banvs1", "banvs2", "banvs3", "threats", "threat1", "threat2", "threat3", "threat4", "threat5"]) {
      if (out[k]) out[k].heroes = out[k].heroes.map((h) => (out._pubCounts.get(h.hero) ? { ...h, pubs: out._pubCounts.get(h.hero) } : h));
    }
    delete out._pubCounts;
  }
  return out;
}

// Captains Mode's ban phases (lib/cmdraft.js CM_STEPS): 7 bans before any pick, 3 after two picks, 4 after eight.
export const BAN_PHASE_NOTE = ["before any pick", "after the first two picks", "after eight picks"];

// What a box can hold, for the template editor. "custom" starts empty: your own heroes.
export const SOURCES = [
  ["custom", "Your own heroes (starts empty)"],
  ["likely", "Model: likely picks"], ["banvs", "Model: ban against them"],
  ...[1, 2, 3].map((n) => [`banvs${n}`, `Model: ban against them, phase ${n}`]),
  ["threats", "Model: threats, any position"],
  ...[1, 2, 3, 4, 5].map((n) => [`threat${n}`, `Model: threats at pos ${n}`]),
  ["picks", "Picks most"], ["bans", "Bans most"], ["banned", "Banned against them"],
  ...[1, 2, 3].map((n) => [`banned${n}`, `Banned against them, phase ${n}`]),
  ...[1, 2, 3].map((n) => [`bans${n}`, `They ban, phase ${n}`]),
  ...[1, 2, 3, 4, 5].map((n) => [`pos${n}`, `Pos ${n} ${POS_NAMES[n]}: heroes played there`]),
  ...[1, 2, 3, 4, 5].map((n) => [`player${n}`, `Player ${n} (by games): league heroes`]),
  ["pubs", "Pubs: the five together"],
  ...[1, 2, 3, 4, 5].map((n) => [`pubs${n}`, `Pubs: player ${n} (by games)`]),
  ["allpubs", "All-time pubs: the five together"],
  ...[1, 2, 3, 4, 5].map((n) => [`allpubs${n}`, `All-time pubs: player ${n} (by games)`]),
  ["alllobby", "All-time lobby games (league, scrims, inhouses): the five"],
  ...[1, 2, 3, 4, 5].map((n) => [`alllobby${n}`, `All-time lobby games: player ${n} (by games)`]),
];
export const COL_NAMES = { them: "Enemy", bans: "Bans", us: "You" };
export const sourceLabel = (key) => SOURCES.find(([k]) => k === key)?.[1] ?? key;

// Every built-in: the enemy's heroes left, the model's bans against them in the middle, yours right.
const boxes = (col, keys) => keys.map((k) => ({ col, ...(typeof k === "string" ? { source: k } : k) }));
// The middle column: the model's bans against them for each ban phase.
const BANS = boxes("bans", [1, 2, 3].map((n) => ({ source: `banvs${n}`, max: 12 })));
const both = (keys) => [...boxes("them", keys), ...BANS, ...boxes("us", keys)];
export const TEMPLATES = [
  { id: "position", name: "By position", boxes: both(["pos1", "pos2", "pos3", "pos4", "pos5"]) },
  { id: "player", name: "By player", boxes: both(["player1", "player2", "player3", "player4", "player5"]) },
  { id: "picksbans", name: "Picks and bans", boxes: [...boxes("them", ["likely", "picks"]), ...boxes("bans", [...[1, 2, 3].map((n) => ({ source: `banvs${n}`, max: 12 })), ...[1, 2, 3].map((n) => ({ source: `banned${n}`, max: 12 }))]), ...boxes("us", ["likely", "picks"])] },
  { id: "pubs", name: "Recent pubs", needs: "pubs", boxes: both(["pubs1", "pubs2", "pubs3", "pubs4", "pubs5"]) },
  { id: "allpubs", name: "All-time pubs", needs: "allpubs", boxes: both([1, 2, 3, 4, 5].map((n) => ({ source: `allpubs${n}`, max: 12 }))) },
  { id: "alllobby", name: "All-time lobby games", needs: "alllobby", boxes: both([1, 2, 3, 4, 5].map((n) => ({ source: `alllobby${n}`, max: 12 }))) },
  { id: "threats", name: "Draft model threats", needs: "threats", boxes: both(["threat1", "threat2", "threat3", "threat4", "threat5"]) },
];

// ---------- free placement, as in Dota's own grid editor ----------
// A box can carry its own place on Dota's canvas (x, y, w, h in the file's units). Boxes without
// one are laid out in the three columns, as tall as their heroes need. Dota shrinks the icons to
// fit a box, so a placed box keeps its size whatever the team.
export const CANVAS_W = ROW_W, SNAP = 10, MIN_W = 80, MIN_H = 60, LABEL_H = 24;
export const snap = (v, step = SNAP) => Math.round(v / step) * step;
const placed = (b) => [b.x, b.y, b.w, b.h].every(Number.isFinite);

// A column box's height: its name, then lines of six heroes.
const AUTO_LINE = 6, AUTO_LINE_H = 36, AUTO_MIN = 80;
export const autoHeight = (n) => Math.max(AUTO_MIN, LABEL_H + 8 + Math.ceil(n / AUTO_LINE) * AUTO_LINE_H);

// rows (templateRows) with { x, y, w, h }: the box's own place, or the column layout's.
export function placeRows(template, rows) {
  const y = { them: 0, bans: 0, us: 0 };
  return rows.map((r) => {
    const b = template.boxes[r.box];
    if (placed(b)) return { ...r, x: b.x, y: b.y, w: b.w, h: b.h };
    const col = COLS.includes(r.col) ? r.col : "them";
    const h = autoHeight(r.heroes.length);
    const out = { ...r, x: COLS.indexOf(col) * (COL_W + GAP), y: y[col], w: COL_W, h };
    y[col] += h + GAP;
    return out;
  });
}

// Every box given its current place, so the editor can move them freely.
export function freezeLayout(template, rows) {
  for (const r of placeRows(template, rows)) Object.assign(template.boxes[r.box], { x: r.x, y: r.y, w: r.w, h: r.h });
  // Boxes with no row here (a source this team lacks) go below the rest.
  let bottom = Math.max(0, ...template.boxes.filter(placed).map((b) => b.y + b.h + GAP));
  for (const b of template.boxes) if (!placed(b)) { Object.assign(b, { x: 0, y: bottom, w: COL_W, h: AUTO_MIN }); bottom += AUTO_MIN + GAP; }
  return template;
}

// The file's categories from placed rows; empty boxes are left out.
// A name two boxes share (the same source for them and for your team) says whose it is, since
// Dota shows only the names. `names`: { them, us } (team names; "Them" / "Us" otherwise).
export function placedConfig(config_name, rows, names = {}) {
  const count = new Map();
  for (const r of rows) count.set(r.name, (count.get(r.name) ?? 0) + 1);
  const whose = (r) => (count.get(r.name) > 1 && (r.col === "us" || r.col === "them") ? `${String(r.col === "us" ? names.us || "Us" : names.them || "Them").slice(0, 20)}: ` : "");
  return {
    config_name,
    categories: rows.flatMap((r) => {
      const ids = r.heroes.map((h) => heroIdOf(h.hero)).filter((id) => id != null);
      return ids.length ? [{ category_name: `${whose(r)}${r.name}`.slice(0, 60), x_position: r.x, y_position: r.y, width: r.w, height: r.h, hero_ids: ids }] : [];
    }),
  };
}

// The biggest icon (width, in canvas units) that fits n icons of aspect w/h = `aspect` in a box,
// below its name; and how many go on a line.
export function fitIcons(n, w, h, aspect = 16 / 9, gap = 4) {
  const room = Math.max(1, h - LABEL_H);
  if (!n) return { size: 0, cols: 0 };
  let best = { size: 1, cols: Math.max(1, Math.floor(w)) };
  for (let cols = 1; cols <= n; cols++) {
    const lines = Math.ceil(n / cols);
    const size = Math.min((w - gap * (cols - 1)) / cols, ((room - gap * (lines - 1)) / lines) * aspect);
    if (size > best.size) best = { size, cols };
  }
  return { size: Math.max(1, Math.floor(best.size)), cols: best.cols };
}
// Where a new box goes: the left edge, below everything.
export function freeSpot(template, w = COL_W, h = AUTO_MIN) {
  const bottom = Math.max(0, ...template.boxes.filter(placed).map((b) => b.y + b.h + GAP));
  return { x: 0, y: bottom, w, h };
}

// ---------- a box's heroes, and editing them ----------
// A box is { source, label?, max?, half?, add?: [hero], remove?: [hero] }: its source's heroes
// (cut to max) without the ones taken off, then the ones added. Edits are kept as add/remove
// so a template still fits every team.
export function boxHeroes(box, sources) {
  const base = box.source === "custom" ? [] : sources[box.source]?.heroes ?? [];
  const removed = new Set(box.remove ?? []);
  const max = Number(box.max) > 0 ? Number(box.max) : Infinity;
  const kept = base.filter((h) => !removed.has(h.hero)).slice(0, max);
  const have = new Set(kept.map((h) => h.hero));
  const added = (box.add ?? []).filter((h) => !have.has(h) && !removed.has(h) && have.add(h)).map((h) => base.find((b) => b.hero === h) ?? { hero: h });
  const out = [...kept, ...added];
  // An order set by dragging heroes within the box; heroes it doesn't name keep their place after.
  if (box.order?.length) {
    const at = new Map(box.order.map((h, i) => [h, i]));
    out.sort((a, b) => (at.get(a.hero) ?? Infinity) - (at.get(b.hero) ?? Infinity));
  }
  return out;
}
// Put `hero` in the box just before `before` (a hero in it), or at the end.
export function placeHero(box, hero, before, sources) {
  addToBox(box, hero);
  const names = boxHeroes(box, sources).map((h) => h.hero).filter((h) => h !== hero);
  const i = before != null && before !== hero ? names.indexOf(before) : -1;
  names.splice(i >= 0 ? i : names.length, 0, hero);
  box.order = names;
}
export function addToBox(box, hero) {
  box.remove = (box.remove ?? []).filter((h) => h !== hero);
  if (!(box.add ?? []).includes(hero)) box.add = [...(box.add ?? []), hero];
}
export function dropFromBox(box, hero) {
  box.add = (box.add ?? []).filter((h) => h !== hero);
  if (box.source !== "custom" && !(box.remove ?? []).includes(hero)) box.remove = [...(box.remove ?? []), hero];
}

// A template's rows: each box's heroes, from the enemy's sources (left and middle columns) or
// yours (right; `us` null when there's no team of yours), named by the box's label or else its
// source. Boxes with no source here are skipped, or with `all` kept (empty, `missing`) so the
// editor can show them. Old templates' boxes without a column are the enemy's.
export const colOf = (b) => (COLS.includes(b.col) ? b.col : "them");
export function templateRows(template, them, us = null, { all = false } = {}) {
  return template.boxes.flatMap((b, box) => {
    const col = colOf(b), sources = col === "us" ? us : them;
    const src = !sources ? null : b.source === "custom" ? { name: "My heroes", note: "" } : sources[b.source];
    if (!src && !all) return [];
    return [{ box, col, name: b.label?.trim() || src?.name || sourceLabel(b.source), note: src?.note ?? (sources ? "not available here" : ""), heroes: src || b.add?.length ? boxHeroes(b, sources ?? {}) : [], missing: !src }];
  });
}

// The player's own file (parsed JSON, or null for none) with this config added. A config of the
// same name (an earlier export for this team) is replaced; every other grid is kept as it was.
export function mergeGrid(existing, config) {
  if (existing != null && (typeof existing !== "object" || !Array.isArray(existing.configs))) {
    throw new Error("That file isn't a Dota hero grid file (no grid list in it).");
  }
  const base = existing ?? { version: 3, configs: [] };
  return { ...base, version: base.version ?? 3, configs: [...base.configs.filter((c) => c?.config_name !== config.config_name), config] };
}
