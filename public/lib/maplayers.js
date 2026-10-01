// Overlays shared by every map in a game's Map tab (wards, vision, towers, deaths): kills,
// teamfights, objectives and wards, as checkboxes in each map's own controls (remembered, off at
// first; ticking one on any map ticks it on all four).
// Each map draws the overlay itself at the end of its draw (drawLayers), over its own time
// window: a phase's minutes, or on the vision map the minute before the slider. A layer a map
// already shows (wards on the ward map, kills on the death map, buildings on the tower map)
// isn't drawn twice.
//
// Where things happened: OpenDota records a spot only for deaths inside a teamfight, so the
// kills layer is teamfight kills, and a teamfight sits at the middle of its deaths. Buildings
// use the tower map's spots. Roshan and the Tormentor each switch between two spots with the
// time of day (lib/vision.js), so a kill is drawn where they were at that time.
import { deathsOf } from "./deathmap.js";
import { heroImg } from "./hero-meta.js";
import { spot, NAME } from "./towermap.js";
import { mapDefAt, isNight, toGrid } from "./vision.js";

export const MAP_LAYERS = [["kills", "Kills"], ["fights", "Teamfights"], ["objectives", "Objectives"], ["wards", "Wards"]];
const TIPS = {
  kills: "Teamfight kills: the hero who died, in their team's colour, as on the Deaths map (OpenDota records no spot for other kills)",
  fights: "Teamfights at the middle of their deaths; size = deaths, colour = the team that lost fewer",
  objectives: "Towers and barracks as they fell, Roshan (R) and Tormentor (T) kills",
  wards: "Observers (circles) and sentries (diamonds) placed; a cross = dewarded",
};
const KEY = "mapLayers";
// What each map already draws.
const OWN = { wards: ["wards"], deaths: ["kills"], towers: ["buildings"] };
const Y = (y) => 256 - y;
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const clock = (s) => `${s < 0 ? "-" : ""}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, "0")}`;
const KILLER = { "-1": "a tower", "-2": "creeps", "-3": "neutrals", "-4": "Roshan / Tormentor" };
const grid = ([x, y]) => [+toGrid(x).toFixed(1), +toGrid(y).toFixed(1)];

// A game's overlay data, compact for a data- attribute. Null if there's nothing to place.
// kills: [second, x, y, the dead hero's side, text, the dead hero's portrait (or "")]
// fights: [start, end, x, y, deaths a, deaths b, text]
// objectives: [second, kind ("b" building / "r" Roshan / "t" Tormentor), side, x, y, text]
//   side: whose building fell, or who took Roshan / the Tormentor.
// wards: [placed, kind ("o" / "s"), side, x, y, dewarded at (-1 = not), text]
export function mapLayerData(m) {
  const P = m.players ?? [];
  const who = (i) => `${P[i].name} (${P[i].hero})`;
  const team = (s) => (s === "a" ? m.team_a : m.team_b);
  const deaths = deathsOf(m).filter((d) => d.kind === "fight" && d.x > 0);
  const kills = deaths.map((d) => [d.t, d.x, d.y, d.team,
    `${clock(d.t)} · ${who(d.i)} killed by ${d.killer >= 0 ? who(d.killer) : KILLER[d.killer] ?? "unknown"}`, heroImg(P[d.i].hero) ?? ""]);
  const fights = [];
  const f = m.fights ?? [];
  for (let i = 0; i + 2 < f.length; i += 3) {
    const at = deaths.filter((d) => d.t >= f[i] && d.t <= f[i + 1]);
    if (!at.length) continue;
    const mean = (k) => +(at.reduce((s, d) => s + d[k], 0) / at.length).toFixed(1);
    const da = at.filter((d) => d.team === "a").length, db = at.length - da;
    fights.push([f[i], f[i + 1], mean("x"), mean("y"), da, db, `Teamfight ${clock(f[i])}–${clock(f[i + 1])}: ${team("a")} lost ${da}, ${team("b")} lost ${db}`]);
  }
  const objectives = [];
  const t4 = { a: 0, b: 0 };
  for (const b of m.buildings ?? []) {
    const [x, y] = spot(b.side, b.b, b.b === "t4" ? t4[b.side]++ : 0);
    objectives.push([b.time, "b", b.side, x, y, `${clock(b.time)} · ${team(b.side)} ${NAME(b.b)} fell${b.hero ? ` (${b.hero})` : ""}`]);
  }
  const def = mapDefAt(m.start_time);
  for (const o of def ? m.objectives ?? [] : []) {
    if (o.type !== "roshan" && o.type !== "tormentor") continue;
    const at = grid(def[o.type][isNight(o.time) ? "night" : "day"]);
    objectives.push([o.time, o.type[0], o.side, ...at, `${clock(o.time)} · ${o.type === "roshan" ? "Roshan" : "Tormentor"} taken by ${team(o.side) ?? "?"}`]);
  }
  const wards = [];
  for (const p of P) for (const [kind, arr, name] of [["o", p.obs_pos, "Observer"], ["s", p.sen_pos, "Sentry"]]) {
    if (!Array.isArray(arr)) continue;
    for (let i = 0; i + 4 < arr.length; i += 5) {
      const gone = arr[i + 4] ? arr[i + 2] + arr[i + 3] : -1;
      wards.push([arr[i + 2], kind, p.team, arr[i], arr[i + 1], gone, `${clock(arr[i + 2])} · ${name} by ${p.name} (${p.hero})${gone >= 0 ? `, dewarded at ${clock(gone)}` : ""}`]);
    }
  }
  // Seconds of the deaths with no spot (lane deaths, pickoffs), so the note can count them.
  const unplaced = deathsOf(m).filter((d) => !(d.kind === "fight" && d.x > 0)).map((d) => d.t);
  return kills.length || fights.length || objectives.length || wards.length ? { kills, fights, objectives, wards, unplaced } : null;
}

function saved() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {}; } catch { return {}; }
}

// The checkboxes for one map: every layer with something in it, less what the map draws itself.
const boxes = (data, base) => {
  const on = saved();
  return MAP_LAYERS.filter(([k]) => data[k].length && !(OWN[base] ?? []).includes(k)).map(([k, label]) =>
    `<label title="${attr(TIPS[k])}"><input type="checkbox" data-map-layer="${k}"${on[k] ? " checked" : ""}> ${label}</label>`).join("");
};
// Which map a figure is.
const baseOf = (fig) => (fig.classList.contains("visionmap") ? "vision" : fig.classList.contains("deathmap") ? "deaths" : fig.classList.contains("towermap") ? "towers" : "wards");

// Draws the checked overlays into fig's map for seconds [from, to). base: which map this is
// ("wards", "vision", "towers", "deaths"). fade: older marks fainter (the vision map's moment
// view, where [from, to) is the two minutes up to the slider). Remembered on the figure for
// when a box changes.
export function drawLayers(fig, from, to, base, { fade: fading = false } = {}) {
  const card = fig.closest(".map-card[data-layers]"), svg = fig.querySelector(".wm-map svg");
  if (!card || !svg) return;
  fig._layers = [from, to, base, { fade: fading }];
  svg.querySelector(".ml-overlay")?.remove();
  const D = card._layerData ??= JSON.parse(card.dataset.layers);
  const on = new Set([...card.querySelectorAll("[data-map-layer]:checked")].map((c) => c.dataset.mapLayer));
  const own = OWN[base] ?? [];
  const inT = (t) => t >= from && t < to;
  // Older marks fade, so what just happened stands out.
  const fade = (t) => (fading ? `;opacity:${(0.3 + (0.7 * Math.max(0, t - from)) / (to - from)).toFixed(2)}` : "");
  const at = (x, y, body, cls, tip, t = to) => `<g class="${cls}" style="transform:translate(${x}px,${Y(y)}px) scale(var(--ms,1))${fade(t)}"><title>${attr(tip)}</title>${body}</g>`;
  const X = (r) => `<path d="M${-r} ${-r}L${r} ${r}M${r} ${-r}L${-r} ${r}"/>`;
  let out = "";
  const n = { kills: 0, fights: 0, objectives: 0, wards: 0 };
  if (on.has("fights")) for (const [s, e, x, y, da, db, tip] of D.fights) {
    if (!(s < to && e >= from)) continue;
    const k = da + db, win = da < db ? "a" : db < da ? "b" : "n";
    out += at(x, y, `<circle r="${(2.2 + k * 0.45).toFixed(2)}"/><text y="1.1">${k}</text>`, `ml-fight ml-${win}`, tip, Math.min(e, to));
    n.fights++;
  }
  if (on.has("wards") && !own.includes("wards")) for (const [t, kind, side, x, y, gone, tip] of D.wards) {
    const placed = inT(t), killed = gone >= 0 && inT(gone);
    if (!placed && !killed) continue;
    const shape = kind === "o" ? `<circle r="1.2"/>` : `<rect x="-0.95" y="-0.95" width="1.9" height="1.9" transform="rotate(45)"/>`;
    out += at(x, y, shape + (killed ? X(1.4) : ""), `ml-ward ml-${side}${killed ? " ml-dead" : ""}`, tip, killed ? gone : t);
    n.wards++;
  }
  if (on.has("objectives")) for (const [t, kind, side, x, y, tip] of D.objectives) {
    if (!inT(t) || (kind === "b" && own.includes("buildings"))) continue;
    out += kind === "b"
      ? at(x, y, `<rect x="-1.4" y="-1.4" width="2.8" height="2.8"/>${X(1)}`, `ml-obj ml-${side}`, tip, t)
      : at(x, y, `<circle r="2.3"/><text y="1.1">${kind === "r" ? "R" : "T"}</text>`, `ml-boss ml-${side}`, tip, t);
    n.objectives++;
  }
  const killsOn = on.has("kills") && !own.includes("kills");
  // The dead hero's portrait in a ring of their team's colour (a cross without a portrait).
  const clip = `${fig.id}-ml-clip`;
  if (killsOn) for (const [t, x, y, side, tip, img] of D.kills) {
    if (!inT(t)) continue;
    const body = img
      ? `<circle r="3.2"/><image href="${attr(img)}" x="-2.8" y="-2.8" width="5.6" height="5.6" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`
      : `<circle r="2.1"/>${X(1.2)}`;
    out += at(x, y, body, `ml-kill ml-${side}`, tip, t);
    n.kills++;
  }
  svg.insertAdjacentHTML("beforeend", `<g class="ml-overlay"><defs><clipPath id="${clip}" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath></defs>${out}</g>`);

  // Under the map, what the overlay found in this window, so an empty stretch reads as empty
  // rather than broken, and kills that can't be placed are still counted.
  // Inside the zoom box (or right after the map), so it stays in the map's column.
  const wrap = fig.querySelector(".mz-wrap"), map = fig.querySelector(".wm-map");
  let note = fig.querySelector(".ml-note");
  const shownLayers = MAP_LAYERS.filter(([k]) => on.has(k) && !(OWN[base] ?? []).includes(k));
  if (!shownLayers.length) { note?.remove(); return; }
  if (!note) {
    if (wrap) wrap.insertAdjacentHTML("beforeend", `<p class="wm-note ml-note"></p>`);
    else map.insertAdjacentHTML("afterend", `<p class="wm-note ml-note"></p>`);
    note = fig.querySelector(".ml-note");
  }
  // The moment view asks for [t − 120, t + 1) so the slider's own second counts.
  const lo = Number.isFinite(from) ? clock(Math.max(0, from)) : "0:00", hi = Number.isFinite(to) ? clock(fading ? to - 1 : to) : "end";
  const span = !Number.isFinite(from) && !Number.isFinite(to) ? "whole game" : `${lo}–${hi}`;
  const noSpot = D.unplaced?.filter(inT).length ?? 0;
  const parts = shownLayers.map(([k]) => k === "kills"
    ? `${n.kills} kill${n.kills === 1 ? "" : "s"} placed${noSpot ? ` (+${noSpot} with no recorded spot: lane kills and pickoffs)` : ""}`
    : `${n[k]} ${{ fights: "teamfight", objectives: "objective", wards: "ward event" }[k]}${n[k] === 1 ? "" : "s"}`);
  note.textContent = `Overlay, ${span}: ${parts.join(" · ")}.`;
}

// Puts the checkboxes into each map's controls (the vision map's go in its Show row) and wires
// them: a box changed on one map changes on all, and every map redraws its overlays.
export function wireMapLayers(root) {
  for (const card of root.querySelectorAll(".map-card[data-layers]")) {
    const data = card._layerData ??= JSON.parse(card.dataset.layers);
    for (const fig of card.querySelectorAll("figure.wardmap")) {
      const html = boxes(data, baseOf(fig));
      if (!html) continue;
      const show = fig.querySelector(".vm-layers");
      if (show) show.insertAdjacentHTML("beforeend", html);
      else fig.querySelector(".wm-controls")?.insertAdjacentHTML("beforeend", `<fieldset class="vm-layers ml-layers"><legend>Show</legend>${html}</fieldset>`);
    }
    card.addEventListener("change", (e) => {
      const box = e.target.closest?.("[data-map-layer]");
      if (!box) return;
      for (const c of card.querySelectorAll(`[data-map-layer="${box.dataset.mapLayer}"]`)) c.checked = box.checked;
      try { localStorage.setItem(KEY, JSON.stringify({ ...saved(), [box.dataset.mapLayer]: box.checked })); } catch {}
      for (const fig of card.querySelectorAll("figure")) if (fig._layers) drawLayers(fig, ...fig._layers);
    });
    for (const fig of card.querySelectorAll("figure")) if (fig._layers) drawLayers(fig, ...fig._layers);
  }
}
