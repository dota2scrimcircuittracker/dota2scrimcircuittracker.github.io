// Tables on the search results page (pages/search.js): every team, player or hero in a scope in
// the shared sortable table (lib/tables.js has the columns), and the builder around it: rows,
// league (All AD2L, a division, Heroic A or B, Scrims), period, a player table's team, minimum
// games, presets and saved sets, columns by group. A league's games load only when a table is
// drawn, the same lists the team, Players and Heroes pages read.
import { esc, SOURCES, DIVISIONS, sortableTable, teamLink, playerLink, heroLink, portrait } from "../core.js";
import { listTeams, seriesRecords } from "../lib/teams.js";
import { isBye } from "../lib/playoffs.js";
import { INFO } from "../lib/glossary.js";
import { KINDS, column, tableRows, cellText, inPeriod, tableState, WEEKS } from "../lib/tables.js";

// Scopes, in the builder's order: All AD2L, each division (Heroic with its A and B views), Scrims.
export const TABLE_LEAGUES = ["all", ...Object.keys(DIVISIONS).flatMap((k) => [k, ...(DIVISIONS[k].views ?? []).map((v) => `${k}_${v}`)]), "scrim"];
export function leagueLabel(k) {
  if (k === "all") return "All AD2L";
  if (k === "scrim") return "Scrims";
  const [div, view] = k.split("_");
  return DIVISIONS[div] ? `${DIVISIONS[div].short}${view ? ` · Division ${view.toUpperCase()}` : ""}` : k;
}
const periodLabel = (w) => (w ? `Last ${w} weeks` : "Whole season");

// A league's games and file, loaded once.
const bases = new Map();
const baseOf = (league) => {
  if (!bases.has(league)) bases.set(league, (async () => {
    const src = SOURCES[league];
    const matches = await src.load();
    return { src, matches, d: src.ad2l ? await src.data() : null };
  })().catch((e) => { bases.delete(league); throw e; }));
  return bases.get(league);
};
// A scope: the league's games in the period, its teams as the team list shows them (AD2L: the
// division file's, bye slots out, PlayOn's records over the period's series; scrims: from the
// games), and on All AD2L each team's division.
const scopes = new Map();
export async function loadScope(league, weeks = 0) {
  const key = `${league}|${weeks}`;
  if (scopes.has(key)) return scopes.get(key);
  const { src, matches: all, d } = await baseOf(league);
  const matches = inPeriod(all, weeks);
  let teams, records = null, division = null;
  if (d) {
    const ids = new Set(d.teams.filter((t) => !isBye(t)).map((t) => t.id));
    teams = listTeams(matches, d.teams).filter((t) => ids.has(t.id));
    const from = weeks ? Date.now() / 1000 - weeks * 7 * 86400 : -Infinity;
    const recs = seriesRecords(d.series.filter((s) => (s.time ?? 0) >= from));
    records = new Map(teams.map((t) => [t.key, recs.get(t.id) ?? { wins: 0, losses: 0 }]));
    if (src.all) division = new Map(d.teams.map((t) => [t.id, t.division]));
  } else teams = listTeams(matches);
  const scope = { key, league, src, matches, teams, records, division };
  scopes.set(key, scope);
  return scope;
}

// The table for st { kind, cols, sort, dir, min, weeks, team } in el, over `league`. A value from
// fewer than `min` games shows greyed and sorts after the rest (as does "—"). onSort(sort, dir)
// when the sort changes. Resolves to the scope (null if it couldn't load).
export async function drawTable(el, league, st, { onSort = null } = {}) {
  const K = KINDS[st.kind];
  el.innerHTML = `<div class="panel empty">Loading ${esc(leagueLabel(league))}…</div>`;
  let scope;
  try { scope = await loadScope(league, st.weeks); }
  catch { el.innerHTML = `<div class="panel empty">${esc(leagueLabel(league))} couldn't load. Try again.</div>`; return null; }
  if (!el.isConnected) return scope;
  let list = tableRows(st.kind, scope);
  if (st.kind === "player" && st.team) list = list.filter((r) => r.team === st.team);
  if (!list.length) {
    el.innerHTML = `<div class="panel empty">No ${K.label.toLowerCase()} with games in ${esc(leagueLabel(league))}${st.weeks ? ` in the ${periodLabel(st.weeks).toLowerCase()}` : ""}${st.team ? ` on ${esc(st.team)}` : ""}.</div>`;
    return scope;
  }
  const rows = list.map((row) => {
    const r = { name: row.name, _row: row, team: row.team ?? "", division: scope.division?.get(row.entity?.id) ?? "" };
    for (const id of st.cols) {
      const c = row.cells[id];
      r[id] = c && !(c.n != null && c.n < st.min) ? c.v : null; // what it sorts by
      r[`${id}~`] = c; // what it shows
    }
    return r;
  });
  const show = (id) => (_, r) => {
    const c = r[`${id}~`];
    if (!c) return '<span class="muted">—</span>';
    const games = c.n != null ? `${c.n} game${c.n === 1 ? "" : "s"}` : "";
    const low = c.n != null && c.n < st.min;
    const tip = [c.of, low ? `only ${games}` : games].filter(Boolean).join(" · ");
    return `<span class="${low ? "tt-low" : ""}"${tip ? ` title="${esc(tip)}"` : ""}>${cellText(column(st.kind, id).fmt, c.v)}</span>`;
  };
  const name = {
    team: ["name", "Team", (_, r) => teamLink(scope.src, r._row.entity.name, r._row.entity.id), "l name", null, false],
    player: ["name", "Player", (_, r) => playerLink(scope.src, r._row.entity), "l name", null, false],
    hero: ["name", "Hero", (_, r) => `<span class="hero-cell">${portrait(r.name)}${heroLink(scope.src, r.name)}</span>`, "l", null, false],
  }[st.kind];
  const columns = [
    name,
    ...(st.kind === "team" && scope.division ? [["division", "Division", (v) => esc(v), "l", null, false]] : []),
    ...(st.kind === "player" && !st.team ? [["team", "Team", (v) => (v ? teamLink(scope.src, v) : '<span class="muted">—</span>'), "l", null, false]] : []),
    ...st.cols.map((id) => { const c = column(st.kind, id); return [id, c.label, show(id), "", c.fmt === "pct" ? "jade" : null, c.key]; }),
  ];
  sortableTable(el, columns, rows, st.sort, { toolbar: true, dir: st.dir, nullsLast: true, onSort });
  return scope;
}

// ---------- the builder ----------
const SAVED = "table-sets";
const readSets = () => { try { const v = JSON.parse(localStorage.getItem(SAVED)); return Array.isArray(v) ? v.filter((s) => s?.name && KINDS[s.kind] && Array.isArray(s.cols)) : []; } catch { return []; } };
const writeSets = (list) => { try { localStorage.setItem(SAVED, JSON.stringify(list)); return true; } catch { return false; } };

const presetsHtml = (st) => {
  const chip = (cols, name) => `<button type="button" class="tt-preset${cols.join(",") === st.cols.join(",") ? " on" : ""}" data-cols="${esc(cols.join(","))}">${esc(name)}</button>`;
  const saved = readSets().map((s, i) => [s, i]).filter(([s]) => s.kind === st.kind);
  return `${KINDS[st.kind].presets.map((p) => chip(p.cols, p.name)).join("")}${saved.map(([s, i]) => `<span class="tt-saved">${chip(s.cols.filter((id) => column(st.kind, id)), s.name)}<button type="button" class="tt-unsave" data-i="${i}" aria-label="Delete ${esc(s.name)}" title="Delete">✕</button></span>`).join("")}`;
};
const groupsHtml = (st) => KINDS[st.kind].groups.map(([g, label]) => `<fieldset><legend>${esc(label)}</legend>${KINDS[st.kind].columns.filter((c) => c.group === g).map((c) => `<label${INFO[c.key] ? ` title="${esc(INFO[c.key])}"` : ""}><input type="checkbox" value="${c.id}"${st.cols.includes(c.id) ? " checked" : ""}> ${esc(c.label)}</label>`).join("")}</fieldset>`).join("");

// The builder for st in `league`.
export function builderHtml(st, league) {
  return `<div class="tt-builder">
    <div class="segs tt-kinds" role="group" aria-label="Rows">${Object.entries(KINDS).map(([k, K]) => `<button type="button" class="seg${k === st.kind ? " on" : ""}" data-kind="${k}" aria-pressed="${k === st.kind}">${K.label}</button>`).join("")}</div>
    <div class="tt-row">
      <label class="sr-lgpick">League <select class="tt-league">${TABLE_LEAGUES.filter((k) => SOURCES[k]).map((k) => `<option value="${k}"${k === league ? " selected" : ""}>${esc(leagueLabel(k))}</option>`).join("")}</select></label>
      <label class="sr-lgpick">Period <select class="tt-weeks">${[0, ...WEEKS].map((w) => `<option value="${w}"${w === st.weeks ? " selected" : ""}>${periodLabel(w)}</option>`).join("")}</select></label>
      <label class="sr-lgpick tt-teampick"${st.kind === "player" ? "" : " hidden"}>Team <select class="tt-team"><option value="">Every team</option>${st.team ? `<option selected>${esc(st.team)}</option>` : ""}</select></label>
      <label class="sr-lgpick">Min games <input type="number" class="tt-min" min="0" max="50" value="${st.min}"></label>
    </div>
    <div class="tt-presets" role="group" aria-label="Column sets">${presetsHtml(st)}</div>
    <details class="tt-cols" open><summary>Columns · <span class="tt-count">${st.cols.length}</span></summary><div class="tt-groups">${groupsHtml(st)}</div></details>
    <div class="tt-table"></div>
    <div class="row tt-btns"><button type="button" class="tt-save">Save these columns</button><button type="button" class="link-btn tt-copy">Copy link</button><button type="button" class="link-btn tt-reset">Reset</button><span class="tt-msg" role="status"></span></div>
  </div>`;
}

// Wire a builder (builderHtml) in root. onChange(st, league) after every change, for the address.
export function wireBuilder(root, st0, league0, onChange) {
  if (!root) return;
  let st = { ...st0 }, league = league0;
  const table = root.querySelector(".tt-table"), msg = root.querySelector(".tt-msg"), teamSel = root.querySelector(".tt-team");
  const say = (text, cls = "") => { msg.textContent = text; msg.className = `tt-msg ${cls}`; };
  // A player table's Team select: the teams the scope's players play for.
  const fillTeams = (scope) => {
    if (!scope || st.kind !== "player") return;
    const names = [...new Set(tableRows("player", scope).map((r) => r.team).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    teamSel.innerHTML = `<option value="">Every team</option>${names.map((n) => `<option${n === st.team ? " selected" : ""}>${esc(n)}</option>`).join("")}`;
  };
  const draw = () => drawTable(table, league, st, { onSort: (sort, dir) => { st = { ...st, sort, dir }; onChange(st, league); } }).then(fillTeams);
  const changed = ({ kind = false } = {}) => {
    root.querySelector(".tt-presets").innerHTML = presetsHtml(st);
    if (kind) {
      root.querySelector(".tt-groups").innerHTML = groupsHtml(st);
      root.querySelectorAll("[data-kind]").forEach((b) => { b.classList.toggle("on", b.dataset.kind === st.kind); b.setAttribute("aria-pressed", String(b.dataset.kind === st.kind)); });
      root.querySelector(".tt-teampick").hidden = st.kind !== "player";
    } else root.querySelectorAll(".tt-groups input").forEach((i) => (i.checked = st.cols.includes(i.value)));
    root.querySelector(".tt-count").textContent = st.cols.length;
    draw();
    onChange(st, league);
  };
  const setCols = (cols) => {
    if (!cols.length) return say("Pick at least one column.", "err");
    const sort = cols.includes(st.sort) ? st.sort : cols.find((id) => id !== "games" && id !== "picks") ?? cols[0];
    st = { ...st, cols, sort, dir: sort === st.sort ? st.dir : column(st.kind, sort).low ? "asc" : "desc" };
    say("");
    changed();
  };
  root.addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches(".tt-league")) { league = t.value; st = { ...st, team: null }; changed(); }
    else if (t.matches(".tt-weeks")) { st = { ...st, weeks: Number(t.value) }; changed(); }
    else if (t.matches(".tt-team")) { st = { ...st, team: t.value || null }; changed(); }
    else if (t.matches(".tt-min")) { st = { ...st, min: Math.max(0, Math.min(50, Number.parseInt(t.value, 10) || 0)) }; changed(); }
    else if (t.matches(".tt-groups input")) setCols(t.checked ? [...st.cols, t.value] : st.cols.filter((id) => id !== t.value));
  });
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.matches("[data-kind]")) {
      if (b.dataset.kind === st.kind) return;
      st = { ...tableState(b.dataset.kind), min: st.min, weeks: st.weeks };
      say("");
      changed({ kind: true });
    } else if (b.matches(".tt-preset")) setCols(b.dataset.cols.split(","));
    else if (b.matches(".tt-unsave")) {
      const sets = readSets();
      sets.splice(Number(b.dataset.i), 1);
      writeSets(sets);
      root.querySelector(".tt-presets").innerHTML = presetsHtml(st);
    } else if (b.matches(".tt-save")) {
      const name = prompt("Name these columns:", "")?.trim();
      if (!name) return;
      if (!writeSets([...readSets().filter((s) => !(s.name === name && s.kind === st.kind)), { name, kind: st.kind, cols: st.cols }])) return say("This browser won't save it (private window or blocked storage).", "err");
      root.querySelector(".tt-presets").innerHTML = presetsHtml(st);
      say(`Saved "${name}".`, "ok");
    } else if (b.matches(".tt-copy")) {
      try { await navigator.clipboard.writeText(location.href); say("Link copied.", "ok"); }
      catch { say("Couldn't copy; copy the address bar instead.", "err"); }
    } else if (b.matches(".tt-reset")) setCols(KINDS[st.kind].presets[0].cols);
  });
  draw();
}
