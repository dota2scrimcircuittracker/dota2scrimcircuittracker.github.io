// "Hero grid for Dota" on a team's Heroes tab and in the Drafter: the team's heroes laid out by a
// template (by position, by player, picks and bans, pubs, the model's threats, or one you made
// and saved in this browser), saved as a grid in the player's own hero_grid_config.json so it
// shows in the pick screen. The file never leaves the browser.
//
// The grid is drawn as Dota's canvas: every box where it will sit in the file, its heroes shrunk
// to fit. Customising freezes the layout so boxes can be dragged by their name bar and resized
// from the corner (snapping to 10; hold Alt to place freely; arrow keys nudge the selected box,
// Shift+arrows resize it). Heroes: drag one off a box (or click it) to take it out, drag one
// onto another hero to put it there, drag one in from anywhere on the page, or type it into the
// selected box. The draft model's boxes read the team against "my team" (core.js myTeam).
//
// In the Drafter the grid is the hero picker: wireHeroGrid's controller takes the draft's state
// (heroes gone, the model's value for each, which ones fit an open position), and a click on a
// hero outside editing plays it.
import {
  heroSources, templateRows, placeRows, placedConfig, freezeLayout, freeSpot, fitIcons, snap, configName, mergeGrid,
  addToBox, dropFromBox, placeHero, colOf, TEMPLATES, SOURCES, COLS, CANVAS_W, MIN_W, MIN_H, LABEL_H,
} from "../lib/herogrid.js";
import { sideOf } from "../lib/teams.js";
import { hasDetails } from "../lib/stats.js";
import { HEROES, canonicalHero, matchHero } from "../lib/heroes.js";
import { info } from "../lib/glossary.js";
import { esc, portrait, myTeam, setMyTeam, myTeamOptions, teamFromOption, divData } from "../core.js";

const FOLDER = String.raw`C:\Program Files (x86)\Steam\userdata`;
const TAIL = String.raw`570\remote\cfg`;
const FILE = "hero_grid_config.json";
const SEP = "\\";
const SIDES = { them: "Enemy", bans: "Bans (enemy's heroes)", us: "You" };

const SAVED_KEY = "herogrid-templates", PICK_KEY = "herogrid-template";
const readSaved = () => { try { const v = JSON.parse(localStorage.getItem(SAVED_KEY)); return Array.isArray(v) ? v.filter((t) => t?.id && Array.isArray(t.boxes)) : []; } catch { return []; } };
const writeSaved = (list) => { try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); return true; } catch { return false; } };
// Built-ins that need a source (pubs, the model) show once the team has it.
const builtIns = (sources) => TEMPLATES.filter((t) => !t.needs || sources[t.needs]);
const findTemplate = (id, sources) => TEMPLATES.find((t) => t.id === id) ?? readSaved().find((t) => t.id === id) ?? builtIns(sources)[0];
const lastPick = () => { try { return localStorage.getItem(PICK_KEY); } catch { return null; } };

// ---------- dragging heroes in from anywhere on the page ----------
// A hero picture (img.hero-img: its alt is the name) or anything marked data-hero-name carries
// the name; dragged text (a selected name, a hero link) is matched to a hero on the drop.
const HERO_TYPE = "application/x-dota-hero";
if (typeof document !== "undefined" && !window.__hgDrag) {
  window.__hgDrag = true;
  document.addEventListener("dragstart", (e) => {
    const t = e.target instanceof Element ? e.target : null;
    const el = t?.closest("[data-hero-name]") ?? (t?.matches("img.hero-img") ? t : t?.querySelector?.("img.hero-img"));
    const hero = el?.dataset?.heroName ?? el?.getAttribute?.("alt");
    if (!hero || !canonicalHero(hero)) return;
    e.dataTransfer.setData(HERO_TYPE, canonicalHero(hero));
    if (!e.dataTransfer.getData("text/plain")) e.dataTransfer.setData("text/plain", canonicalHero(hero));
    e.dataTransfer.effectAllowed = "copyMove";
  });
}
// The hero a drop carries, or null.
function droppedHero(dt) {
  const own = dt.getData(HERO_TYPE);
  if (own) return canonicalHero(own);
  const html = dt.getData("text/html");
  const fromHtml = html && (html.match(/\balt="([^"]+)"/)?.[1] ?? html.replace(/<[^>]*>/g, " "));
  for (const raw of [dt.getData("text/plain"), fromHtml]) {
    const s = String(raw ?? "").replace(/\s+/g, " ").trim();
    if (!s) continue;
    const exact = canonicalHero(s);
    if (exact) return exact;
    // Text with one hero's name in it ("Chaos Knight pos 1 …").
    const inside = HEROES.filter((h) => s.toLowerCase().includes(h.toLowerCase())).sort((a, b) => b.length - a.length);
    if (inside.length) return inside[0];
  }
  return null;
}

// ---------- markup ----------
const heroTitle = (h) => h.title ?? (h.games ? `${h.hero}: ${h.games} game${h.games === 1 ? "" : "s"}, ${h.wins}–${h.games - h.wins}` : h.hero);
const heroTag = (h) => (h.tag != null && h.tag !== "" ? `<i>${esc(h.tag)}</i>` : h.games > 1 ? `<i>${h.games}</i>` : "");
const sourceOpts = (sources, v) => SOURCES.map(([k, label]) => `<option value="${k}"${k === v ? " selected" : ""}>${esc(label)}${k !== "custom" && !sources[k] ? " · none here" : ""}</option>`).join("");
const pctOf = (v, of) => `${((v / of) * 100).toFixed(3)}%`;

// The canvas: every box at its place, as a share of the canvas, so it scales with the page.
// play: the Drafter's state ({ gone, off: Sets of names; value: Map name -> text }), or null.
function canvasHtml(rows, template, { editing = false, selected = null, noTeam = false, play = null } = {}) {
  const boxes = placeRows(template, rows);
  const H = Math.max(300, ...boxes.map((r) => r.y + r.h)) + (editing ? 200 : 0);
  const live = play && !editing;
  const body = boxes.map((r) => {
    const fit = fitIcons(r.heroes.length, r.w - 8, r.h - 6);
    const heroes = r.heroes.map((h) => {
      const gone = live && play.gone.has(h.hero), off = live && !gone && play.off?.has(h.hero), v = live && !gone ? play.value?.get(h.hero) : null;
      const tip = `${heroTitle(h)}${h.pubs ? ` · ${h.pubs} recent pub${h.pubs === 1 ? "" : "s"}` : ""}${v != null ? ` · model ${v}` : ""}${gone ? " · gone" : live ? " · click to play it" : ""}${editing ? " · drag to move, off the box or click to take out" : ""}`;
      // In the Drafter the model's value takes the corner the game count would.
      return `<span class="hg-h${h.pubs ? " pub" : ""}${gone ? " gone" : ""}${off ? " off" : ""}${live && !gone ? " playable" : ""}" draggable="true" data-hero-name="${esc(h.hero)}" title="${esc(tip)}">${portrait(h.hero)}${v != null ? `<i class="hg-v">${esc(v)}</i>` : heroTag(h)}${h.pubs ? `<em>${h.pubs}</em>` : ""}</span>`;
    }).join("");
    const empty = r.col === "us" && noTeam ? "Set My team to fill this" : r.missing ? "Not available here" : editing ? "Drop heroes here" : "None yet";
    return `<div class="hg-box side-${r.col}${r.box === selected ? " sel" : ""}" data-box="${r.box}"${editing ? ' tabindex="0"' : ""}
        style="left:${pctOf(r.x, CANVAS_W)};top:${pctOf(r.y, H)};width:${pctOf(r.w, CANVAS_W)};height:${pctOf(r.h, H)};--label:${pctOf(LABEL_H, r.h)}" title="${esc(r.note ?? "")}">
      <div class="hg-bhead"><b>${esc(r.name)}</b></div>
      <div class="hg-heroes" style="grid-template-columns:repeat(${Math.max(1, fit.cols)}, ${pctOf(fit.size, r.w - 8)})">${heroes || `<span class="hg-empty">${empty}</span>`}</div>
      ${editing ? '<span class="hg-resize" aria-hidden="true"></span>' : ""}</div>`;
  }).join("");
  return `<div class="hg-scroll"><div class="hg-canvas${editing ? " editing" : ""}" style="aspect-ratio:${CANVAS_W} / ${H}" data-h="${H}">${body}</div></div>`;
}

// The selected box's settings, beside the canvas while editing.
function inspectorHtml(template, i, { them, us, list }) {
  const tools = `<div class="row hg-ctools"><button type="button" class="hg-addbox">+ Add a box</button><button type="button" class="link-btn hg-tidy" title="Put every box back in the three columns">Tidy into columns</button></div>`;
  const b = template.boxes[i];
  if (!b) return `${tools}<p class="muted hg-tip">Click a box to change it. Drag a box by its name bar, resize it from the bottom-right corner. Hold Alt to place without snapping.</p>`;
  const col = colOf(b), src = col === "us" ? us ?? {} : them;
  return `${tools}
    <div class="hg-insp" data-box="${i}">
      <label>Name <input type="text" class="hg-label" maxlength="40" value="${esc(b.label ?? "")}" placeholder="${esc(src[b.source]?.name ?? "Box name")}"></label>
      <label>Holds <select class="hg-src">${sourceOpts(src, b.source)}</select></label>
      <label>Side <select class="hg-side">${COLS.map((c) => `<option value="${c}"${c === col ? " selected" : ""}>${SIDES[c]}</option>`).join("")}</select></label>
      <label>Most heroes from the source <input type="number" class="hg-max" min="1" max="60" value="${b.max ?? ""}" placeholder="all"></label>
      <label>Add a hero <input type="text" class="hg-add" list="${list}" placeholder="Type a name, Enter"></label>
      <div class="row hg-ibtns"><button type="button" class="link-btn hg-dup">Duplicate</button><button type="button" class="link-btn hg-clear">Empty it</button><button type="button" class="link-btn hg-delbox">Delete box</button></div>
      <small class="muted">${Math.round(b.w)} × ${Math.round(b.h)} at ${Math.round(b.x)}, ${Math.round(b.y)}. Arrow keys move it, Shift+arrows resize it.</small>
    </div>`;
}

function pickerHtml(sources, id, editing) {
  const saved = readSaved();
  return `<label>Template <select class="hg-tsel"${editing ? " disabled" : ""}>${builtIns(sources).map((t) => `<option value="${t.id}"${t.id === id ? " selected" : ""}>${esc(t.name)}</option>`).join("")}
      ${saved.length ? `<optgroup label="Saved in this browser">${saved.map((t) => `<option value="${esc(t.id)}"${t.id === id ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</optgroup>` : ""}
      <option value="new">New template…</option></select></label>
    ${editing ? "" : `<button type="button" class="link-btn hg-edit">${saved.some((t) => t.id === id) ? "Edit" : "Customise"}</button>`}`;
}

const legendHtml = (them, us) => `<div class="hg-legend"><span class="side-them">${esc(them)}</span><span class="side-bans">Bans against them</span><span class="side-us">${us ? esc(us) : "You (set My team)"}</span></div>`;

let gridCount = 0;
// games: [{ m, side }] with lineups; pubs: account id -> flat pub rows (the division file's).
// "" when there are no games with heroes. The draft model's boxes fill in when wired.
// compact (the Drafter): no heading, and the steps into Dota fold away.
export function heroGridHtml(team, games, { pubs = null, compact = false } = {}) {
  const sources = heroSources(games, { pubs });
  if (!sources.picks.heroes.length) return "";
  const t = findTemplate(lastPick(), sources);
  const name = configName(team.name);
  const n = games.length, list = `hg-heroes-${++gridCount}`;
  return `${compact ? "" : `<h2 id="hero-grid">Hero grid for Dota${info("hero_grid")}</h2>`}
    <p class="table-note wm-intro">${esc(team.name)}'s heroes from ${n} game${n === 1 ? "" : "s"}${pubs ? " and their pubs" : ""}, laid out the way Dota's grid will show them. Customise it to move and resize boxes, drag heroes in, out and around, and save it in this browser. In Dota it's <b>${esc(name)}</b>.</p>
    <div class="hg reveal" data-team="${esc(team.name)}" data-list="${list}">
      <div class="hg-main">
        <div class="row hg-tpl">${pickerHtml(sources, t.id, false)}</div>
        <div class="row hg-me"><label>My team <select class="hg-myteam"><option value="">None set</option></select></label>
          <small class="muted">The model's boxes read ${esc(team.name)} against it, and the green boxes are yours. Same as under the settings cog.</small></div>
        <div class="hg-editor" hidden></div>
        <div class="hg-work"><div class="hg-grid">${legendHtml(team.name, null)}${canvasHtml(templateRows(t, sources), t, { noTeam: true })}</div><aside class="hg-side" hidden></aside></div>
        <datalist id="${list}">${HEROES.map((h) => `<option value="${esc(h)}">`).join("")}</datalist>
      </div>
      ${compact ? `<details class="hg-into"><summary>Save this grid into Dota</summary>` : ""}<ol class="hg-steps">
        <li><b>Close Dota 2.</b> Dota rewrites the file when it closes, which would undo the change.</li>
        <li><b>Find your grid file</b>, <code>${FILE}</code>. It's in your Steam folder:
          <code class="hg-path">${esc(FOLDER)}${SEP}<i>your number</i>${SEP}${esc(TAIL)}</code>
          <button type="button" class="link-btn hg-copy">Copy the userdata folder</button>
          <small>Paste that into the file picker's address bar. If there's more than one number, yours is your Steam friend code. Steam installed somewhere else? Use that folder's <code>userdata</code> instead.</small></li>
        <li><b>Add the grid to it.</b> Pick the file here; you get it back with this grid added. Every grid you already have stays; an earlier ${esc(name)} is replaced.
          <div class="row hg-btns">
            <button type="button" class="primary hg-pick">Choose ${FILE}</button>
            <button type="button" class="hg-new">I don't have one</button>
            <input type="file" accept=".json,application/json" hidden>
          </div>
          ${compact ? "" : '<p class="hg-msg" role="status"></p>'}</li>
        <li><b>Put it back.</b> Move the downloaded <code>${FILE}</code> into that <code>cfg</code> folder and replace the old one. If your browser named it <code>${FILE.replace(".json", " (1).json")}</code>, rename it first.</li>
        <li><b>Open Dota.</b> In the pick screen, open the <b>Sort</b> menu under the hero grid (bottom left) and choose <b>${esc(name)}</b>. It's on the Heroes page's grid menu too. If Steam says your cloud files conflict, keep the files on this computer.</li>
      </ol>${compact ? '</details><p class="hg-msg" role="status"></p>' : ""}
    </div>`;
}

// My team's games with lineups and the division's pubs, for the green boxes.
export async function myTeamGames(me) {
  if (!me) return null;
  const d = await divData(me.div);
  const t = d.teams.find((x) => String(x.id) === String(me.id));
  if (!t) return null;
  const dd = await import("./cmdraft.js").then((cm) => cm.draftData(me.div)).catch(() => null);
  return { name: t.name, games: d.games.map((m) => ({ m, side: sideOf(m, t) })).filter((x) => x.side && hasDetails(x.m)), pubs: d.pubs ?? null, totals: dd?.totals ?? null, heroNames: dd?.heroes ?? null };
}

// Live grids, for the one "myteam" listener: each grid's handler, dropped once its grid is off
// the page (checked whenever a grid is wired or my team changes).
const live = new Map(); // .hg element -> (team | null) => void
const prune = () => { for (const el of live.keys()) if (!el.isConnected) live.delete(el); };
if (typeof window !== "undefined") addEventListener("myteam", (e) => { prune(); for (const fn of live.values()) fn(e.detail); });

// model: async (myTeam | null) => the draft model's read (parts/cmdraft.js heroGridModelFor:
// { them, us }) or null; us: async (myTeam | null) => { name, games, pubs, totals, heroNames }
// for the green boxes (default: my team's). Both run once the grid is first on screen, and again
// whenever my team changes. Returns a controller (null with no grid): setPlay(play) gives the
// grid the Drafter's state (see canvasHtml) with play.onPick(hero) for a click on a hero outside
// editing, or null to drop it; add(hero) puts a hero in the selected box (else the first of
// yours), starting an edit.
export function wireHeroGrid(root, team, games, { pubs = null, totals = null, heroNames = null, model = null, us: usOf = myTeamGames } = {}) {
  const box = root.querySelector(".hg");
  if (!box) return null;
  let play = null;
  let sources = heroSources(games, { pubs, totals, heroNames }), usSources = null, usName = null;
  const name = configName(team.name), list = box.dataset.list;
  let current = findTemplate(lastPick(), sources), draft = null; // draft: the template being edited
  let selected = null; // the box being edited (an index into draft.boxes)
  const shown = () => draft ?? current;
  const rowsNow = () => templateRows(shown(), sources, usSources, { all: !!draft });
  const config = () => placedConfig(name, placeRows(shown(), templateRows(shown(), sources, usSources)));
  const input = box.querySelector("input[type=file]"), msg = box.querySelector(".hg-msg");
  const tpl = box.querySelector(".hg-tpl"), editor = box.querySelector(".hg-editor"), grid = box.querySelector(".hg-grid"), side = box.querySelector(".hg-side");
  const say = (text, cls = "") => { msg.textContent = text; msg.className = `hg-msg ${cls}`; };
  const sourcesOf = (i) => (colOf(draft.boxes[i]) === "us" ? usSources ?? {} : sources);

  const drawGrid = () => {
    grid.innerHTML = `${legendHtml(team.name, usName)}${canvasHtml(rowsNow(), shown(), { editing: !!draft, selected, noTeam: !usSources, play })}`;
    side.hidden = !draft;
    side.innerHTML = draft ? inspectorHtml(draft, selected, { them: sources, us: usSources, list }) : "";
  };
  const drawPicker = () => { tpl.innerHTML = pickerHtml(sources, current.id, !!draft); };
  const drawEditor = () => {
    if (!draft) { editor.hidden = true; editor.innerHTML = ""; return; }
    editor.hidden = false;
    const saved = readSaved().some((t) => t.id === draft.id);
    editor.innerHTML = `<label class="hg-ename">Template name <input type="text" class="hg-tname" maxlength="40" value="${esc(draft.name)}"></label>
      <div class="row hg-ebtns"><button type="button" class="primary hg-save">${saved ? "Save" : "Save template"}</button>
        ${saved ? `<button type="button" class="hg-del">Delete</button>` : ""}
        <button type="button" class="link-btn hg-cancel">Cancel</button></div>
      <small class="muted">Saved in this browser only. Heroes: drag them in from anywhere on the page, onto another hero to put them there, off a box (or click) to take them out.</small>`;
  };
  const redraw = () => { drawPicker(); drawEditor(); drawGrid(); };
  const choose = (id) => {
    current = findTemplate(id, sources);
    try { localStorage.setItem(PICK_KEY, current.id); } catch {}
  };
  // Edit a saved template in place, a built-in one as a new copy; either way every box gets a
  // fixed place first, so it can be moved.
  const startEditing = () => {
    if (draft) return;
    const own = readSaved().some((t) => t.id === current.id);
    draft = JSON.parse(JSON.stringify(own ? current : { ...current, id: `t${Date.now().toString(36)}`, name: `My ${current.name.toLowerCase()}` }));
    freezeLayout(draft, templateRows(draft, sources, usSources, { all: true }));
    selected = null;
    redraw();
  };
  const stopEditing = () => { draft = null; selected = null; redraw(); };

  // ---------- template picker and my team ----------
  tpl.addEventListener("change", (e) => {
    if (!e.target.matches(".hg-tsel")) return;
    if (e.target.value === "new") {
      draft = { id: `t${Date.now().toString(36)}`, name: `My grid ${readSaved().length + 1}`, boxes: COLS.map((col) => ({ col, source: "custom", label: col === "bans" ? "Bans" : col === "us" ? "Mine" : "Theirs" })) };
      freezeLayout(draft, templateRows(draft, sources, usSources, { all: true }));
      selected = 0;
      return redraw();
    }
    choose(e.target.value); redraw();
  });
  tpl.addEventListener("click", (e) => { if (e.target.closest(".hg-edit")) startEditing(); });

  const meSel = box.querySelector(".hg-myteam");
  myTeamOptions().then((html) => { meSel.innerHTML = html; }).catch(() => {});
  meSel.onchange = async () => setMyTeam(await teamFromOption(meSel.value));
  let modelRun = 0;
  const readModel = async (me) => {
    const run = ++modelRun;
    const [m, u] = await Promise.all([model ? model(me).catch(() => null) : null, usOf(me).catch(() => null)]);
    if (run !== modelRun || !box.isConnected) return;
    sources = heroSources(games, { pubs, totals, heroNames, model: m?.them });
    usSources = u ? heroSources(u.games, { pubs: u.pubs, totals: u.totals, heroNames: u.heroNames, model: m?.us }) : null;
    usName = u?.name ?? null;
    if (!draft) current = findTemplate(current.id, sources);
    redraw();
  };
  // The model is many full drafts' work: wait until the grid is on screen (a closed tab or
  // folded section isn't), then follow my team.
  let seen = false;
  live.set(box, (t) => {
    if (meSel.options.length > 1) meSel.value = t ? `${t.div}:${t.id}` : "";
    if (seen) readModel(t);
  });
  prune();
  const firstSight = () => { if (!seen) { seen = true; readModel(myTeam()); } };
  if (typeof IntersectionObserver === "undefined") firstSight();
  else {
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); firstSight(); } }, { rootMargin: "300px" });
    io.observe(box);
  }

  // ---------- the selected box's settings ----------
  editor.addEventListener("input", (e) => { if (e.target.matches(".hg-tname")) draft.name = e.target.value; });
  const keepFocus = (cls) => { drawGrid(); side.querySelector(`.${cls}`)?.focus(); };
  side.addEventListener("input", (e) => {
    if (!draft || selected == null) return;
    const b = draft.boxes[selected];
    if (e.target.matches(".hg-label")) { b.label = e.target.value; const el = grid.querySelector(`[data-box="${selected}"] .hg-bhead b`); if (el) el.textContent = b.label || el.textContent; }
    else if (e.target.matches(".hg-max")) { b.max = e.target.value ? Number(e.target.value) : undefined; keepFocus("hg-max"); }
  });
  side.addEventListener("change", (e) => {
    if (!draft || selected == null) return;
    const b = draft.boxes[selected];
    if (e.target.matches(".hg-src")) { b.source = e.target.value; b.order = undefined; drawGrid(); }
    else if (e.target.matches(".hg-side")) { b.col = e.target.value; drawGrid(); }
    else if (e.target.matches(".hg-label")) drawGrid();
    else if (e.target.matches(".hg-add")) addTyped(e.target);
  });
  side.addEventListener("keydown", (e) => { if (draft && e.key === "Enter" && e.target.matches(".hg-add")) { e.preventDefault(); addTyped(e.target); } });
  const addTyped = (el) => {
    const hero = matchHero(el.value);
    if (!hero) { if (el.value.trim()) say(`No hero called "${el.value.trim()}".`, "err"); return; }
    addToBox(draft.boxes[selected], hero);
    keepFocus("hg-add");
  };
  side.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !draft) return;
    if (t.matches(".hg-addbox")) { draft.boxes.push({ col: "them", source: "custom", label: `Box ${draft.boxes.length + 1}`, ...freeSpot(draft) }); selected = draft.boxes.length - 1; }
    else if (t.matches(".hg-tidy")) {
      for (const b of draft.boxes) delete b.x, delete b.y, delete b.w, delete b.h;
      freezeLayout(draft, templateRows(draft, sources, usSources, { all: true }));
    } else if (selected == null) return;
    else if (t.matches(".hg-dup")) { const b = draft.boxes[selected]; draft.boxes.push({ ...JSON.parse(JSON.stringify(b)), ...freeSpot(draft, b.w, b.h) }); selected = draft.boxes.length - 1; }
    else if (t.matches(".hg-clear")) { const b = draft.boxes[selected]; b.remove = boxHeroesNames(selected); b.add = []; b.order = undefined; }
    else if (t.matches(".hg-delbox")) { draft.boxes.splice(selected, 1); selected = null; }
    else return;
    drawGrid();
  });
  const boxHeroesNames = (i) => [...grid.querySelectorAll(`[data-box="${i}"] .hg-h`)].map((h) => h.dataset.heroName);

  editor.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.matches(".hg-cancel")) stopEditing();
    else if (t.matches(".hg-del")) {
      if (!confirm(`Delete the template "${draft.name}"?`)) return;
      writeSaved(readSaved().filter((x) => x.id !== draft.id));
      choose(null);
      stopEditing();
    } else if (t.matches(".hg-save")) {
      const keep = {
        id: draft.id, name: draft.name.trim() || "My grid",
        boxes: draft.boxes.map((b) => ({
          col: colOf(b), source: b.source, x: b.x, y: b.y, w: b.w, h: b.h,
          ...(b.label?.trim() && { label: b.label.trim() }), ...(b.max && { max: b.max }),
          ...(b.add?.length && { add: b.add }), ...(b.remove?.length && { remove: b.remove }), ...(b.order?.length && { order: b.order }),
        })),
      };
      if (!keep.boxes.length) { say("Add a box first.", "err"); return; }
      const all = readSaved(), at = all.findIndex((x) => x.id === keep.id);
      if (at >= 0) all[at] = keep; else all.push(keep);
      if (!writeSaved(all)) { say("This browser won't save it (private window or blocked storage).", "err"); return; }
      draft = null; selected = null;
      choose(keep.id);
      say(`Saved "${keep.name}".`, "ok");
      redraw();
    }
  });

  // ---------- moving and resizing boxes ----------
  // Pointer events, so it works with a mouse or a finger. The box follows the pointer; the
  // template takes the new place when it's let go.
  let drag = null;
  grid.addEventListener("pointerdown", (e) => {
    if (!draft || e.button > 0) return;
    const el = e.target.closest("[data-box]");
    if (!el) return;
    const i = Number(el.dataset.box);
    if (selected !== i && !e.target.closest(".hg-h")) { selected = i; side.innerHTML = inspectorHtml(draft, selected, { them: sources, us: usSources, list }); grid.querySelectorAll(".hg-box.sel").forEach((x) => x.classList.remove("sel")); el.classList.add("sel"); }
    const mode = e.target.closest(".hg-resize") ? "size" : e.target.closest(".hg-bhead") ? "move" : null;
    if (!mode) return;
    e.preventDefault();
    const canvas = grid.querySelector(".hg-canvas"), b = draft.boxes[i];
    drag = { i, el, mode, x0: e.clientX, y0: e.clientY, g: { x: b.x, y: b.y, w: b.w, h: b.h }, u: CANVAS_W / canvas.clientWidth, H: Number(canvas.dataset.h), moved: false };
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");
  });
  const geomFor = (e) => {
    const s = (v) => (e.altKey ? Math.round(v) : snap(v));
    const dx = (e.clientX - drag.x0) * drag.u, dy = (e.clientY - drag.y0) * drag.u, g = drag.g;
    if (drag.mode === "move") {
      const x = Math.min(Math.max(0, s(g.x + dx)), CANVAS_W - g.w);
      return { ...g, x, y: Math.max(0, s(g.y + dy)) };
    }
    return { ...g, w: Math.min(Math.max(MIN_W, s(g.w + dx)), CANVAS_W - g.x), h: Math.max(MIN_H, s(g.h + dy)) };
  };
  grid.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const g = geomFor(e);
    drag.moved = true;
    Object.assign(drag.el.style, { left: pctOf(g.x, CANVAS_W), top: pctOf(g.y, drag.H), width: pctOf(g.w, CANVAS_W), height: pctOf(g.h, drag.H) });
  });
  const endDrag = (e) => {
    if (!drag) return;
    if (drag.moved) Object.assign(draft.boxes[drag.i], geomFor(e));
    drag = null;
    drawGrid();
  };
  grid.addEventListener("pointerup", endDrag);
  grid.addEventListener("pointercancel", endDrag);
  // Keys: arrows nudge the selected box, Shift+arrows resize it, Delete removes it.
  grid.addEventListener("keydown", (e) => {
    if (!draft || selected == null || !e.target.closest("[data-box]")) return;
    const b = draft.boxes[selected], step = e.altKey ? 1 : 10;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (e.key === "Delete" || e.key === "Backspace") { draft.boxes.splice(selected, 1); selected = null; e.preventDefault(); drawGrid(); return; }
    if (!d) return;
    e.preventDefault();
    if (e.shiftKey) { b.w = Math.min(Math.max(MIN_W, b.w + d[0]), CANVAS_W - b.x); b.h = Math.max(MIN_H, b.h + d[1]); }
    else { b.x = Math.min(Math.max(0, b.x + d[0]), CANVAS_W - b.w); b.y = Math.max(0, b.y + d[1]); }
    drawGrid();
    grid.querySelector(`[data-box="${selected}"]`)?.focus();
  });

  // ---------- heroes: drag in, around, and off ----------
  // Onto a box adds (starting an edit if needed); onto a hero puts it just before that one; a
  // box's own hero dragged to another box moves; dragged off every box, it's taken out.
  grid.addEventListener("click", (e) => {
    const h = e.target.closest(".hg-h");
    if (!h) return;
    if (!draft) { if (play?.onPick && !h.classList.contains("gone")) play.onPick(h.dataset.heroName); return; }
    dropFromBox(draft.boxes[Number(h.closest("[data-box]").dataset.box)], h.dataset.heroName);
    drawGrid();
  });
  let dragFrom = null; // { box, hero } while one of this grid's heroes is dragged
  grid.addEventListener("dragstart", (e) => {
    const h = e.target.closest?.(".hg-h");
    dragFrom = h && draft ? { box: Number(h.closest("[data-box]").dataset.box), hero: h.dataset.heroName } : null;
  });
  grid.addEventListener("dragend", () => {
    if (dragFrom && draft?.boxes[dragFrom.box]) { dropFromBox(draft.boxes[dragFrom.box], dragFrom.hero); drawGrid(); }
    dragFrom = null;
  });
  const clearMarks = () => grid.querySelectorAll(".drop, .drop-before").forEach((x) => x.classList.remove("drop", "drop-before"));
  grid.addEventListener("dragover", (e) => {
    const r = e.target.closest?.("[data-box]");
    if (!r) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = dragFrom ? "move" : "copy";
    clearMarks();
    r.classList.add("drop");
    e.target.closest(".hg-h")?.classList.add("drop-before");
  });
  grid.addEventListener("dragleave", (e) => { const r = e.target.closest?.("[data-box]"); if (r && !r.contains(e.relatedTarget)) clearMarks(); });
  grid.addEventListener("drop", (e) => {
    const r = e.target.closest?.("[data-box]");
    if (!r) return;
    e.preventDefault();
    clearMarks();
    const hero = droppedHero(e.dataTransfer), to = Number(r.dataset.box), before = e.target.closest(".hg-h")?.dataset.heroName ?? null;
    if (!hero) { say("That isn't a hero.", "err"); return; }
    // The redraw below takes the dragged hero's element away, so its dragend never reaches the
    // grid: the drag is over here.
    const from = dragFrom;
    dragFrom = null;
    if (!draft) startEditing();
    if (from && from.box !== to && draft.boxes[from.box]) dropFromBox(draft.boxes[from.box], hero);
    placeHero(draft.boxes[to], hero, before, sourcesOf(to));
    selected = to;
    drawGrid();
  });

  // ---------- into Dota ----------
  const save = (data) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, "\t")], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "hero_grid_config.json" });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const empty = () => { if (config().categories.length) return false; say("This template has no heroes for this team. Pick another.", "err"); return true; };
  box.querySelector(".hg-copy").onclick = async (e) => {
    try { await navigator.clipboard.writeText(FOLDER); e.target.textContent = "Copied"; }
    catch { e.target.textContent = "Couldn't copy; select the path above"; }
  };
  box.querySelector(".hg-pick").onclick = () => { if (!empty()) input.click(); };
  input.onchange = async () => {
    const file = input.files[0];
    input.value = "";
    if (!file) return;
    try {
      const mine = JSON.parse(await file.text());
      const out = mergeGrid(mine, config());
      const kept = out.configs.length - 1, replaced = mine.configs.length === out.configs.length;
      save(out);
      say(`Downloaded. ${kept} of your grid${kept === 1 ? "" : "s"} kept${replaced ? `; your earlier ${name} grid was replaced` : ""}. Now step 4.`, "ok");
    } catch (e) {
      say(e instanceof SyntaxError ? "That file isn't readable as a grid file. Pick hero_grid_config.json from the cfg folder." : e.message, "err");
    }
  };
  box.querySelector(".hg-new").onclick = () => {
    if (empty()) return;
    if (!confirm("This makes a grid file with only this grid in it. If you already have a hero_grid_config.json, replacing it with this deletes your other grids. Use \"Choose hero_grid_config.json\" instead unless you're sure you have none.\n\nDownload a new file?")) return;
    save(mergeGrid(null, config()));
    say("Downloaded a new file with just this grid. Now step 4.", "ok");
  };

  return {
    setPlay(p) { play = p; if (!draft) drawGrid(); },
    add(hero) {
      if (!draft) startEditing();
      const i = selected ?? Math.max(0, draft.boxes.findIndex((b) => colOf(b) === "us"));
      if (!draft.boxes[i]) return say("Add a box to the grid first.", "err");
      addToBox(draft.boxes[i], hero);
      selected = i;
      drawGrid();
      say(`Added ${hero} to "${templateRows(draft, sources, usSources, { all: true }).find((r) => r.box === i)?.name ?? "the box"}". Save the template to keep it.`, "ok");
    },
  };
}
