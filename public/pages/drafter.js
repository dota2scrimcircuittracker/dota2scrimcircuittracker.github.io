// Drafter: draft Captains Mode for any two AD2L teams with the draft model (lib/cmdraft.js,
// Project Sybil's model) scoring every hero at every step. Start from an upcoming series, any
// two teams, or a past game's draft (rewind to any step and branch). Loaded on first visit.
import { esc, app, pageHead, portrait, pct, profileLinks, myTeam, DIVISIONS, ALL_DIVS, divLite, divData, gameWeeker, tabInUrl, setRoutedAt } from "../core.js";
import { DRAFTER_MODES as MODES } from "../lib/pagetabs.js";
import { sideOf as teamSide } from "../lib/teams.js";
import { hasDetails } from "../lib/stats.js";
import { heroGridHtml, wireHeroGrid, myTeamGames } from "../parts/herogrid.js";
import { heroAttr } from "../lib/hero-meta.js";
import { canonicalHero } from "../lib/heroes.js";
import { loading, errorBox } from "../parts/lanes.js";
import { isPlayed } from "../lib/predict.js";
import { gameContext, scoreHeroes, draftProbability, stateFeatures, sideComposition, openRoleFor, fitsRole, poolShares, flexPositions, CM_STEPS } from "../lib/cmdraft.js";
import { draftDataFor, heroIndex, MODEL_NOTE, rankName, draftChart, heroGridModelFor } from "../parts/cmdraft.js";

const MODE_KEY = "drafter-mode";
// The hero picker: the hero grid (parts/herogrid.js, the default) or every hero by attribute.
const VIEWS = [["grid", "Hero grid"], ["all", "All heroes"]];
const VIEW_KEY = "drafter-view";
const SHOWN = 8; // suggestions listed
// The hero grid in Dota's own order: by primary attribute, A–Z inside each.
const ATTRS = [["str", "Strength"], ["agi", "Agility"], ["int", "Intelligence"], ["all", "Universal"]];
const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

// A team as the drafter holds it: its roster, which five are playing, and its games with
// lineups ([{ m, side }], for the hero grid).
const asTeam = (div, t, games, played = null) => {
  const roster = played ?? t.players.map((p) => ({ key: String(p.account_id), name: p.name, rank_tier: p.rank_tier, playon: p.playon_id ?? null }));
  // Default five: the players with the most league games for this team this season.
  const n = new Map();
  for (const g of games) for (const p of g.players) if (g.team_a_id === t.id || g.team_b_id === t.id) n.set(p.player_key, (n.get(p.player_key) ?? 0) + 1);
  const order = roster.map((p, i) => i).sort((a, b) => (n.get(roster[b].key) ?? 0) - (n.get(roster[a].key) ?? 0) || a - b);
  const lineups = games.map((m) => ({ m, side: teamSide(m, t) })).filter((x) => x.side && hasDetails(x.m));
  return { div, id: t.id, name: t.name, roster, five: new Set(order.slice(0, 5)), lineups };
};

export async function renderDrafter(src) {
  app.innerHTML = loading(src.kicker, "Drafter");
  let d;
  try { d = await src.data(); } catch (e) { app.innerHTML = `${pageHead(src.kicker, "Drafter")}${errorBox(e)}`; return; }
  // ?tab= (the nav dropdown's links) first, then the one used last.
  let mode = "upcoming";
  try { mode = MODES.some(([k]) => k === localStorage.getItem(MODE_KEY)) ? localStorage.getItem(MODE_KEY) : mode; } catch {}
  if (MODES.some(([k]) => k === tabInUrl())) mode = tabInUrl();

  const now = Date.now() / 1000;
  const upcoming = d.series.filter((s) => !isPlayed(s) && s.home && s.away && (s.time ?? now) > now - 6 * 3600).sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  const drafted = d.games.filter((g) => g.draft?.some((s) => s.pick) && g.players?.length === 10).sort((a, b) => b.start_time - a.start_time);
  const teamById = new Map(d.teams.map((t) => [t.id, t]));
  const when = (t) => (t ? new Date(t * 1000).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "time TBD");

  app.innerHTML = `<div class="dx-page">${pageHead(src.kicker, "Drafter")}
    <section class="dx-setup">
      <div class="segs dx-modes" role="group" aria-label="Start from">${MODES.map(([k, l]) => `<button type="button" class="seg${k === mode ? " on" : ""}" data-mode="${k}" aria-pressed="${k === mode}">${l}</button>`).join("")}</div>
      <div class="dx-mode" data-for="upcoming"${mode === "upcoming" ? "" : " hidden"}>
        ${upcoming.length ? `<label>Series <select id="dx-series">${upcoming.map((s) => `<option value="${s.id}">${esc(teamById.get(s.home)?.name)} vs ${esc(teamById.get(s.away)?.name)} · ${esc(when(s.time))}</option>`).join("")}</select></label>`
          : `<p class="muted">No upcoming series in ${esc(src.division)} right now. Pick any two teams instead.</p>`}
      </div>
      <div class="dx-mode" data-for="teams"${mode === "teams" ? "" : " hidden"}><p class="muted">Loading every division's teams…</p></div>
      <div class="dx-mode" data-for="game"${mode === "game" ? "" : " hidden"}>
        ${drafted.length ? `<label>Team <select id="dx-gteam">${[...new Set(drafted.flatMap((g) => [g.team_a_id, g.team_b_id]))].map((id) => teamById.get(id)).filter(Boolean)
            .sort((a, b) => a.name.localeCompare(b.name)).map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></label>
          <label>Week <select id="dx-gweek"></select></label><label>Game <select id="dx-game"></select></label>
          <p class="table-note">Loads the game's full draft. Click any step to rewind and draft differently from there. The model only knows what it knew at the time of the game.</p>`
          : `<p class="muted">No drafted games in ${esc(src.division)} yet.</p>`}
      </div>
      <div class="dx-opts" id="dx-opts"></div>
    </section>
    <div id="dx-board"><div class="panel empty">Loading the draft model…</div></div>
    <div id="dx-hg" class="dx-hg" hidden></div></div>`;

  // ---------- the draft in play ----------
  // X and Y: the two teams. `first` and `radiant` say which is which; `done` holds hero ids
  // in step order; `order` the steps ([F|S, ban|pick]); `original` a past game's own steps.
  const s = { X: null, Y: null, first: "X", radiant: "X", done: [], order: CM_STEPS, original: null, time: now, gameId: null, roleFilter: true, pins: {}, posAt: {}, pickFor: null, pickPos: null, banPos: null };
  let data = null, heroes = null, ctx = null, ctxKey = "";

  const board = document.getElementById("dx-board"), opts = document.getElementById("dx-opts"), gridBox = document.getElementById("dx-hg");
  const other = (w) => (w === "X" ? "Y" : "X");
  const teamAt = (fs) => (fs === "F" ? s.first : other(s.first)); // F/S -> X/Y
  const sideOf = (w) => (w === s.radiant ? "radiant" : "dire");
  const fiveOf = (t) => {
    const list = [...t.five].sort((a, b) => a - b).map((i) => t.roster[i]);
    while (list.length < 5) list.push({ key: null, name: "Unknown player", rank_tier: null });
    return list.slice(0, 5);
  };

  async function load(X, Y, { first = "X", radiant = "X", done = [], order = CM_STEPS, original = null, time = now, gameId = null } = {}) {
    Object.assign(s, { X, Y, first, radiant, done, order, original, time, gameId, pins: {}, posAt: {}, pickFor: null, pickPos: null });
    board.innerHTML = `<div class="panel empty">Loading the draft model…</div>`;
    gridBox.innerHTML = ""; gridCtl = null; play = null;
    data = await draftDataFor([X.div, Y.div]);
    if (!data) { board.innerHTML = `<p class="muted">No draft model data for ${esc(DIVISIONS[X.div].short)}${X.div !== Y.div ? ` or ${esc(DIVISIONS[Y.div].short)}` : ""} yet.</p>`; opts.innerHTML = ""; return; }
    heroes = heroIndex(data);
    // Grid heroes come by name, in the site's spelling or the draft file's.
    idOf = new Map(heroes.ids.flatMap((h) => [[heroes.name(h), h], [canonicalHero(heroes.name(h)), h]]));
    ctxKey = "";
    // The grid opens on the team that isn't mine.
    gridFor = "Y";
    const me = myTeam();
    if (me) for (const w of ["X", "Y"]) if (s[w].div === me.div && String(s[w].id) === String(me.id)) gridFor = other(w);
    draw();
    drawGrid();
  }

  // The hero grid (parts/herogrid.js): either team's heroes laid out by a template, as the hero
  // picker. It's its own element, moved into the board's hero column on every draw, so a pick
  // doesn't redraw it (or lose an edit in progress); `play` gives it the draft's state.
  let gridFor = "Y", gridCtl = null, gridRun = 0, idOf = new Map(), play = null;
  const heroIdOf = (name) => idOf.get(name) ?? idOf.get(canonicalHero(name));
  let view = "grid";
  try { view = VIEWS.some(([k]) => k === localStorage.getItem(VIEW_KEY)) ? localStorage.getItem(VIEW_KEY) : view; } catch {}
  // Each team's division file, for its pubs: in "Any two teams" either can be from another one.
  const pubsOf = async (t) => (t.div === src.key ? d.pubs : (await divData(t.div).catch(() => null))?.pubs ?? null);
  async function drawGrid() {
    const run = ++gridRun, t = s[gridFor], o = s[other(gridFor)];
    const [pubs, oPubs] = await Promise.all([pubsOf(t), pubsOf(o)]);
    if (run !== gridRun) return;
    const html = heroGridHtml(t, t.lineups, { pubs, compact: true });
    gridBox.innerHTML = `<div class="segs dx-gridfor" role="group" aria-label="Whose heroes">${["X", "Y"].map((w) => `<button type="button" class="seg${w === gridFor ? " on" : ""}" data-grid="${w}" aria-pressed="${w === gridFor}">${esc(s[w].name)}</button>`).join("")}</div>
      ${html || `<p class="muted">No ${esc(t.name)} games with positions yet. Switch team or use All heroes.</p>`}`;
    gridBox.querySelector(".dx-gridfor").onclick = (e) => { const b = e.target.closest("[data-grid]"); if (b && b.dataset.grid !== gridFor) { gridFor = b.dataset.grid; drawGrid(); } };
    // The model reads them against my team, or else the other team in this draft.
    // "You" (the right-hand column) is my team, or else the other team in this draft.
    gridCtl = wireHeroGrid(gridBox, t, t.lineups, {
      pubs, totals: data.totals, heroNames: data.heroes,
      model: (me) => heroGridModelFor({ div: t.div, id: t.id, five: fiveOf(t), name: t.name }, me, { div: o.div, id: o.id, five: fiveOf(o), name: o.name }),
      us: async (me) => (me ? myTeamGames(me) : { name: o.name, games: o.lineups, pubs: oPubs, totals: data.totals, heroNames: data.heroes }),
    });
    gridCtl?.setPlay(play);
    draw();
  }
  // Put the grid where the board wants it: in the hero column for the grid view, else away.
  const placeGrid = () => {
    const slot = board.querySelector(".dx-gridslot");
    if (slot) slot.append(gridBox); else board.after(gridBox);
    gridBox.hidden = !slot;
  };
  // A hero played from the board, the grid or the search: the step in play takes it.
  function playHero(h) {
    const n = s.done.length;
    if (h == null || n >= s.order.length || s.done.includes(h)) return;
    if (s.order[n][1] === "pick" && pickingFor != null) {
      s.pins[n] = pickingFor;
      if (pickingPos != null) {
        // Taking a position an earlier pick was made for moves that pick: it's refitted.
        for (const [i, r] of Object.entries(s.posAt)) if (r === pickingPos && teamAt(s.order[i][0]) === teamAt(s.order[n][0])) delete s.posAt[i];
        s.posAt[n] = pickingPos;
      }
    }
    s.done = [...s.done, h];
    s.pickFor = s.pickPos = null;
  }

  function context() {
    const key = JSON.stringify([s.radiant, [...s.X.five], [...s.Y.five], s.time]);
    if (key !== ctxKey) {
      const r = s.radiant === "X" ? s.X : s.Y, dr = s.radiant === "X" ? s.Y : s.X;
      ctx = gameContext(data, { radiant: fiveOf(r), dire: fiveOf(dr) }, s.time);
      ctxKey = key;
    }
    return ctx;
  }

  // The picks up to step n, with the player each was picked for (s.pins: step -> index into the
  // team's five), which the model then reads as that player's hero outright, and the position it
  // was picked as (s.posAt: step -> 0-4), which the composition keeps.
  const stateAt = (n) => {
    const st = { radiant: [], dire: [], pins: { radiant: [], dire: [] }, pos: { radiant: [], dire: [] } };
    s.order.slice(0, n).forEach(([fs, kind], i) => { if (kind === "pick") { const sd = sideOf(teamAt(fs)); st[sd].push(s.done[i]); st.pins[sd].push(s.pins[i] ?? null); st.pos[sd].push(s.posAt[i] ?? null); } });
    return st;
  };
  // Drop what no longer applies after rewinding to step n.
  const cut = (n) => { s.done = s.done.slice(0, Math.max(0, n)); for (const m of [s.pins, s.posAt]) for (const i of Object.keys(m)) if (Number(i) >= n) delete m[i]; s.pickFor = s.pickPos = null; };
  let rostersOpen = false;
  let pickingFor = null, pickingPos = null; // the player and position the step in play is picked for, set by draw()

  function optsHtml() {
    const sel = (id, v) => `<select id="${id}"><option value="X"${v === "X" ? " selected" : ""}>${esc(s.X.name)}</option><option value="Y"${v === "Y" ? " selected" : ""}>${esc(s.Y.name)}</option></select>`;
    return `<label>First pick ${sel("dx-first", s.first)}</label><label>Radiant ${sel("dx-radiant", s.radiant)}</label>`;
  }

  // Past game: where to see the real game, on the site and (with a Dota match id) elsewhere.
  function gameLinksHtml() {
    const g = d.games.find((x) => x.id === s.gameId);
    if (!g) return "";
    const ext = g.match_id && !g.unticketed
      ? ` · <a href="https://www.opendota.com/matches/${g.match_id}" target="_blank" rel="noopener">OpenDota</a> · <a href="https://www.dotabuff.com/matches/${g.match_id}" target="_blank" rel="noopener">Dotabuff</a> · <a href="https://stratz.com/matches/${g.match_id}" target="_blank" rel="noopener">Stratz</a> <span class="muted">· match ${g.match_id}</span>`
      : "";
    return `<span class="dx-links"><a href="${src.link(g)}">Game page</a>${ext}</span>`;
  }

  function draw() {
    const c = context();
    opts.innerHTML = s.original ? gameLinksHtml() : optsHtml();
    const n = s.done.length, over = n >= s.order.length;
    const state = stateAt(n), gone = new Set(s.done);
    const toX = (p) => (s.radiant === "X" ? p : 1 - p);
    const pX = toX(draftProbability(c, state));
    // X's chance before the draft and after each step so far, for the chart.
    const line = Array.from({ length: n + 1 }, (_, i) => (i === n ? pX : toX(draftProbability(c, stateAt(i)))));
    const chart = draftChart({ values: line, nameX: s.X.name, nameY: s.Y.name, current: over ? null : n, rewind: true, width: board.clientWidth || 1000, height: 150, cells: false,
      order: s.order.map(([f, k]) => ({ who: teamAt(f), pick: k === "pick" })),
      steps: s.done.map((h, i) => ({ who: teamAt(s.order[i][0]), pick: s.order[i][1] === "pick", hero: heroes.name(h) })) });
    const [fs, kind] = s.order[n] ?? [];
    const who = over ? null : teamAt(fs), side = who && sideOf(who);
    const available = heroes.ids.filter((h) => !gone.has(h));

    // Which position each team's picks play, and what's still open (Sybil's composition).
    const assign = stateFeatures(c, state).assignment;
    const comp = { radiant: sideComposition(c.radiant, state.radiant, assign.radiant, state.pos.radiant), dire: sideComposition(c.dire, state.dire, assign.dire, state.pos.dire) };
    // Suggestions for the step in play. The model has no rule against a third carry, so a pick is
    // offered only for a position the team hasn't filled, and a ban only for one the other team
    // hasn't (toggle off to see everything). `roleOf` is the open position a hero would fill.
    let list = [], values = new Map(), roleOf = new Map(), hidden = 0, forPos = null;
    // Suggestions are cut to a position: the open ones, or the one a ban is aimed at.
    const filtering = s.roleFilter || (kind === "ban" && s.banPos != null);
    pickingFor = null; pickingPos = null;
    if (!over && kind === "pick") {
      // Who this pick is for: your choice, else the player with the least of a hero so far.
      const taken = new Set(state.pins[side].filter((j) => j != null));
      const free = [0, 1, 2, 3, 4].filter((j) => !taken.has(j));
      const held = (j) => assign[side][j].reduce((a, b) => a + b, 0);
      pickingFor = free.includes(s.pickFor) ? s.pickFor : [...free].sort((a, b) => held(a) - held(b) || a - b)[0] ?? null;
      // And at which position: your choice (any of the five; one an earlier pick holds moves that
      // pick), else the one they play most that no earlier pick was made for. Positions the model
      // only guessed for earlier picks don't count against it: those picks are fitted around it.
      const madeFor = new Set(state.pos[side].filter((r) => r != null));
      const openPos = [0, 1, 2, 3, 4].filter((r) => !madeFor.has(r)), sh = pickingFor != null ? poolShares(c[side][pickingFor].pool) : null;
      forPos = s.pickPos != null ? s.pickPos : sh ? openPos.reduce((b, r) => (b == null || sh[r] > sh[b] ? r : b), null) : openPos[0] ?? null;
      // The composition with this pick's position held: an earlier pick made for it is refitted.
      if (forPos != null) comp[side] = sideComposition(c[side], state[side], assign[side], state.pos[side].map((r) => (r === forPos ? null : r)), forPos);
      pickingPos = forPos;
    }
    if (!over) {
      const scored = scoreHeroes(c, state, side, available, { pickFor: pickingFor });
      const target = kind === "pick" ? side : side === "radiant" ? "dire" : "radiant";
      for (const h of available) roleOf.set(h, kind === "pick" && pickingFor != null && forPos != null
        ? (fitsRole(h, forPos, c[side][pickingFor].playedAt) ? forPos : null)
        : openRoleFor(h, kind === "ban" && s.banPos != null ? [s.banPos] : comp[target].open, c[target]));
      const theirs = kind === "ban" ? new Map(scoreHeroes(c, state, target, available).map((x) => [x.hero, x])) : null;
      list = scored.filter((x) => x[kind] != null).sort((a, b) => b[kind] - a[kind]);
      for (const x of list) values.set(x.hero, x[kind]);
      if (filtering) { const all = list.length; list = list.filter((x) => roleOf.get(x.hero) != null); hidden = all - list.length; }
      list = list.slice(0, SHOWN).map((x) => ({ ...x, them: theirs?.get(x.hero) }));
    }
    const team = (w) => s[w];
    const playersOf = (w) => c.info[sideOf(w)];
    const val = (v) => (kind === "pick" ? pct(v) : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}`);
    const real = s.original?.[n];
    // Flex heroes (two or more positions, by pubs or by anyone in this game): the position a
    // pick will play isn't given away by the hero.
    const everyone = [...c.radiant, ...c.dire], flexMemo = new Map();
    const flexOf = (h) => { if (!flexMemo.has(h)) { const f = flexPositions(h, everyone); flexMemo.set(h, f.length > 1 ? f : null); } return flexMemo.get(h); };
    const flexTag = (h) => { const f = flexOf(h); return f ? `<i class="dx-flex" title="Flex: plays pos ${f.map((r) => r + 1).join(", ")}">flex ${f.map((r) => r + 1).join("·")}</i>` : ""; };


    const tile = (h) => `<button type="button" class="dx-tile${gone.has(h) ? " gone" : ""}${flexOf(h) ? " flex" : ""}${!gone.has(h) && !over && filtering && roleOf.get(h) == null ? " off" : ""}" data-hero="${h}" data-name="${esc(heroes.name(h).toLowerCase())}" draggable="true" data-hero-name="${esc(heroes.name(h))}"${gone.has(h) || over ? " disabled" : ""} title="${esc(heroes.name(h))}${values.has(h) ? `: ${val(values.get(h))}` : ""}${flexOf(h) ? ` · flex: pos ${flexOf(h).map((r) => r + 1).join(", ")}` : ""}">${portrait(heroes.name(h))}${values.has(h) ? `<small>${val(values.get(h))}</small>` : ""}</button>`;
    // The grid's view of the same: by name, in both spellings.
    const byName = (ids, f) => new Map(ids.flatMap((h) => { const v = f(h), n = heroes.name(h); return [[n, v], [canonicalHero(n) ?? n, v]]; }));
    const names = (ids) => new Set(byName(ids, () => 1).keys());
    play = {
      gone: over ? names(heroes.ids) : names(s.done),
      off: names(available.filter((h) => filtering && roleOf.get(h) == null)),
      value: byName([...values.keys()], (h) => val(values.get(h))),
      onPick: (name) => { playHero(heroIdOf(name)); draw(); },
    };
    const toGrid = gridCtl && view === "grid";
    const sugg = over ? `<p class="muted">Draft complete.</p>` : `<ol class="dx-list${toGrid ? " with-grid" : ""}">${list.map((x) => {
      const pl = kind === "pick" ? playersOf(who)[pickingFor ?? x.player] : x.them && playersOf(other(who))[x.them.player];
      const share = kind === "pick" ? null : x.them?.playerShare;
      return `<li><button type="button" class="dx-pickbtn" data-hero="${x.hero}" draggable="true" data-hero-name="${esc(heroes.name(x.hero))}">${portrait(heroes.name(x.hero))}<span class="dx-hn">${esc(heroes.name(x.hero))}</span>
        <b>${val(x[kind])}</b><small>${roleOf.get(x.hero) != null ? `<i class="dx-pos">pos ${roleOf.get(x.hero) + 1}</i> ` : ""}${flexTag(x.hero)} ${pl ? `${kind === "pick" ? "" : "theirs: "}${esc(pl.name)}${share != null ? ` ${pct(share)}` : ""}` : ""}</small></button>${toGrid ? `<button type="button" class="dx-togrid" data-togrid="${esc(heroes.name(x.hero))}" title="Add ${esc(heroes.name(x.hero))} to the hero grid's selected box" aria-label="Add ${esc(heroes.name(x.hero))} to the hero grid">+</button>` : ""}</li>`;
    }).join("")}</ol>`;

    const rosterHtml = (w) => {
      const t = team(w), info = playersOf(w), sd = sideOf(w);
      const picks = state[sd], m = stateFeatures(c, state).assignment[sd];
      const five = fiveOf(t);
      const rows = five.map((p, j) => {
        const heroCol = picks.map((h, k) => [h, m[j][k]]).sort((a, b) => b[1] - a[1])[0];
        const links = profileLinks(p.key, p.playon);
        return `<tr><td class="l">${esc(p.name)}${links ? `<small class="dx-ext">${links}</small>` : ""}</td><td>${info[j].games ? info[j].games.toLocaleString() : '<span class="muted">none</span>'}</td>
          <td>${info[j].rank == null ? "—" : rankName(info[j].rank)}${info[j].rankFrom === "medal" ? ' <small class="muted">medal</small>' : ""}</td>
          <td class="l">${heroCol && heroCol[1] >= 0.25 ? `${portrait(heroes.name(heroCol[0]))} <small>${pct(heroCol[1])}</small>` : ""}</td></tr>`;
      }).join("");
      const choose = s.original ? "" : `<details class="dx-five"><summary>Change the five (${t.roster.length} on the roster)</summary>
        ${t.roster.map((p, i) => `<label><input type="checkbox" data-team="${w}" data-i="${i}"${t.five.has(i) ? " checked" : ""}> ${esc(p.name)}</label>`).join("")}</details>`;
      return `<div class="dx-roster"><h3 class="gm-h3"><span class="cm-side ${w === "X" ? "s-a" : "s-b"}">${esc(t.name)}</span> <small class="muted">${sd === "radiant" ? "Radiant" : "Dire"}${s.first === w ? " · first pick" : ""}</small></h3>
        <div class="table-wrap"><table><thead><tr><th class="l">Player</th><th>Games</th><th>Rank</th><th class="l">Playing</th></tr></thead><tbody>${rows}</tbody></table></div>${choose}</div>`;
    };

    // The draft board, Dota's way: per team, its five pick slots and seven ban slots in the order
    // it fills them, each with its step number; blank until filled, the next one lit. A filled
    // slot rewinds on a click; a pick names who the model has playing it.
    const boardHtml = () => ["X", "Y"].map((w) => {
      const sd = sideOf(w), slots = { pick: [], ban: [] };
      let k = 0;
      s.order.forEach(([f, kind2], i) => {
        if (teamAt(f) !== w) return;
        const h = s.done[i];
        let who = "";
        if (kind2 === "pick" && h != null) {
          const col = assign[sd].map((row) => row[k]), j = s.pins[i] ?? col.indexOf(Math.max(...col));
          who = fiveOf(s[w])[j]?.name ?? "";
        }
        const pos = kind2 === "pick" && h != null ? comp[sd].positions[k] : null;
        if (kind2 === "pick" && h != null) k++;
        const fx = kind2 === "pick" && h != null ? flexOf(h) : null;
        slots[kind2].push(`<button type="button" class="dx-bslot ${kind2}${i === n ? " now" : ""}${h != null ? " filled" : ""}${fx ? " flex" : ""}"${h != null ? ` data-rewind="${i}" title="${fx ? `Flex: plays pos ${fx.map((r) => r + 1).join(", ")}. ` : ""}Rewind to step ${i + 1}"` : " disabled"}>
          <span class="dx-bn">${i + 1}</span>${fx ? '<span class="dx-bflex">flex</span>' : ""}${h != null ? portrait(heroes.name(h)) : `<span class="dx-bempty">${i === n ? "Next" : kind2 === "pick" ? "Pick" : "Ban"}</span>`}${who ? `<small>${pos != null ? `<i class="dx-pos">${pos + 1}</i> ` : ""}${esc(who)}</small>` : ""}</button>`);
      });
      return `<div class="dx-team ${w === "X" ? "s-a" : "s-b"}"><div class="dx-tname"><b>${esc(s[w].name)}</b><small>${sd === "radiant" ? "Radiant" : "Dire"}${s.first === w ? " · first pick" : ""}</small></div>
        <div class="dx-picks">${slots.pick.join("")}</div><div class="dx-bans">${slots.ban.join("")}</div></div>`;
    }).join("");

    board.innerHTML = `
      <div class="dx-score" role="img" aria-label="${esc(s.X.name)} ${pct(pX)} to win, ${esc(s.Y.name)} ${pct(1 - pX)}">
        <span class="dx-sx"><b>${pct(pX)}</b>${esc(s.X.name)}</span>
        <span class="dx-bar-track dx-meter"><i style="width:${(pX * 100).toFixed(1)}%"></i><em></em></span>
        <span class="dx-sy">${esc(s.Y.name)}<b>${pct(1 - pX)}</b></span>
      </div>
      <section class="dx-stage" aria-label="Draft board">
      <div class="dx-now">
        ${over ? `<b>Draft complete.</b> ${esc(pX >= 0.5 ? s.X.name : s.Y.name)} favoured.` : `<span class="dx-next">Step ${n + 1} of ${s.order.length} · ${kind === "pick" ? "Pick" : "Ban"}</span> <b class="cm-side ${who === "X" ? "s-a" : "s-b"}">${esc(team(who).name)}</b> ${kind === "pick" ? `picks${pickingFor != null ? ` for ${esc(fiveOf(team(who))[pickingFor].name)}` : ""}` : "bans"}.
          ${s.order.length > n + 1 ? `<span class="dx-then">Then: ${s.order.slice(n + 1, n + 4).map(([f, k], j) => `<span class="${teamAt(f) === "X" ? "s-a" : "s-b"}">${n + j + 2}. ${esc(team(teamAt(f)).name)} ${k}</span>`).join(" · ")}${s.order.length > n + 4 ? " …" : ""}</span>` : ""}`}
        ${real != null && !over ? `<span class="dx-real">In the game: ${portrait(heroes.name(real.hero))} ${esc(heroes.name(real.hero))}${values.has(real.hero) ? ` (${val(values.get(real.hero))}, ${ord([...values.keys()].indexOf(real.hero) + 1)} by the model)` : ""} <button type="button" class="linkish" data-hero="${real.hero}">Play it</button></span>` : ""}
        <span class="dx-btns"><button type="button" id="dx-undo"${n ? "" : " disabled"}>Undo</button><button type="button" id="dx-reset"${n ? "" : " disabled"}>Reset</button></span>
      </div>
      ${boardHtml()}
      ${chart}
      </section>
      <div class="dx-tools">
          ${!over && kind === "pick" ? `<div class="dx-for"><span class="dx-for-l">Picking for</span>${fiveOf(team(who)).map((p, j) => {
            const k = state.pins[side].indexOf(j), h = k >= 0 ? state[side][k] : null, sh = poolShares(c[side][j].pool), main = sh.indexOf(Math.max(...sh));
            return `<button type="button" class="dx-forbtn${j === pickingFor ? " on" : ""}" data-for="${j}"${h != null ? " disabled" : ""} aria-pressed="${j === pickingFor}">${h != null ? portrait(heroes.name(h)) : ""}<span>${esc(p.name)}</span><small>${h != null ? "picked" : `usually ${main + 1}`}</small></button>`;
          }).join("")}${pickingFor != null ? `<label class="dx-forpos">as <select id="dx-forpos">${[0, 1, 2, 3, 4].map((r) => { const k = state.pos[side].indexOf(r); return `<option value="${r}"${r === forPos ? " selected" : ""}>pos ${r + 1}${k >= 0 ? ` · ${esc(heroes.name(state[side][k]))}` : ""}</option>`; }).join("")}</select></label>` : ""}</div>` : ""}
          ${!over && kind === "ban" ? `<label class="dx-forpos">Ban for <select id="dx-banpos"><option value=""${s.banPos == null ? " selected" : ""}>any open position</option>${[0, 1, 2, 3, 4].map((r) => `<option value="${r}"${r === s.banPos ? " selected" : ""}>pos ${r + 1}${comp[side === "radiant" ? "dire" : "radiant"].open.includes(r) ? "" : " · filled"}</option>`).join("")}</select></label>` : ""}
          ${over ? "" : `<label class="dx-rolefilter"><input type="checkbox" id="dx-rolefilter"${s.roleFilter ? " checked" : ""}> Only open positions
            <small>${(() => { const t = kind === "pick" ? side : side === "radiant" ? "dire" : "radiant"; return `${kind === "pick" && pickingFor != null && forPos != null ? `Heroes for ${esc(fiveOf(team(who))[pickingFor].name)} at pos ${forPos + 1}. ` : kind === "ban" && s.banPos != null ? `Bans for their pos ${s.banPos + 1}. ` : ""}${esc(team(kind === "pick" ? who : other(who)).name)} still need ${comp[t].open.map((r) => r + 1).join(", ") || "nothing"}${filtering && hidden ? ` · ${hidden} heroes hidden` : ""}`; })()}</small></label>`}
      </div>
      <div class="dx-cols">
        <section class="dx-sugg"><h3 class="dx-h">${over ? "Done" : kind === "pick" ? "Best picks" : "Best bans"}</h3>
          <p class="table-note">${over ? "" : kind === "pick" ? `${esc(team(who).name)}'s chance to win with each hero, and who would play it.` : `Points each hero would add to ${esc(team(other(who)).name)}'s chance, and who'd play it.`}</p>
          ${sugg}</section>
        <section class="dx-heroes"><div class="dx-hhead"><h3 class="dx-h">Heroes</h3>
          <div class="segs dx-views" role="group" aria-label="Pick from">${VIEWS.map(([k, l]) => `<button type="button" class="seg${k === view ? " on" : ""}" data-view="${k}" aria-pressed="${k === view}">${l}</button>`).join("")}</div>
          <input type="search" id="dx-find" placeholder="Find a hero" autocomplete="off" aria-label="Find a hero"></div>
          ${view === "grid" ? `<div class="dx-findrow" hidden></div>
          <p class="table-note dx-gridnote">Click a hero in the grid to ${over ? "play it" : kind === "pick" ? "pick it" : "ban it"}. Faded: taken, or no open position. Customise to rearrange the grid; drag heroes in from the suggestions or search, or press + on a suggestion.</p>
          <div class="dx-gridslot"></div>` : `<div class="dx-attrs">${ATTRS.map(([a, label]) => { const ids = heroes.ids.filter((h) => (heroAttr(heroes.name(h)) ?? "all") === a), left = ids.filter((h) => !gone.has(h)).length; return `<div class="dx-attr attr-${a}" data-attr="${a}">
            <div class="dx-attr-h"><i></i>${label}<small>${left} of ${ids.length} left</small></div>
          <div class="dx-grid">${ids.map(tile).join("")}</div></div>`; }).join("")}</div>`}
        </section>
      </div>
      <details class="dx-more"${rostersOpen ? " open" : ""}><summary>Rosters, ranks and who's playing what</summary>
        <div class="dx-rosters">${rosterHtml("X")}${rosterHtml("Y")}</div></details>
      <p class="table-note">The model scores every hero at every step: your chance to win if you pick it, and how much it gives the other team if you leave it open. ${esc(MODEL_NOTE)} Missing roster spots count as average players.</p>`;
    board.querySelector(".dx-more").addEventListener("toggle", (e) => { rostersOpen = e.target.open; });
    const find = document.getElementById("dx-find"), findRow = board.querySelector(".dx-findrow");
    find.oninput = () => {
      const q = find.value.trim().toLowerCase();
      // The grid view: the heroes matching, any of them, to play or drag into the grid.
      if (findRow) {
        const hits = q ? heroes.ids.filter((h) => heroes.name(h).toLowerCase().includes(q)).slice(0, 16) : [];
        findRow.hidden = !q;
        findRow.innerHTML = hits.length ? hits.map(tile).join("") : `<span class="muted">No hero matches "${esc(find.value.trim())}".</span>`;
        return;
      }
      board.querySelectorAll(".dx-tile").forEach((b) => { b.hidden = q && !b.dataset.name.includes(q); });
      board.querySelectorAll(".dx-attr").forEach((g) => { g.hidden = !g.querySelector(".dx-tile:not([hidden])"); });
    };
    placeGrid();
    gridCtl?.setPlay(play);
  }

  // The chart is drawn at the board's width: redraw when the window changes size.
  let resizeTimer = 0, lastWidth = 0;
  const onResize = () => {
    if (!board.isConnected) return removeEventListener("resize", onResize);
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (data && board.clientWidth !== lastWidth) { lastWidth = board.clientWidth; draw(); } }, 150);
  };
  addEventListener("resize", onResize);

  // One handler for the board: play a hero, rewind, undo, reset, change the five.
  // The hero grid sits in the board but handles its own events.
  board.addEventListener("click", (e) => {
    if (gridBox.contains(e.target)) return;
    const t = e.target.closest("[data-hero], [data-rewind], [data-for], [data-view], [data-togrid], #dx-undo, #dx-reset");
    if (!t || t.disabled) return;
    if (t.dataset.togrid != null) { gridCtl?.add(t.dataset.togrid); return; }
    if (t.dataset.view != null) {
      if (t.dataset.view === view) return;
      view = t.dataset.view;
      try { localStorage.setItem(VIEW_KEY, view); } catch {}
    }
    else if (t.dataset.for != null) { s.pickFor = Number(t.dataset.for); s.pickPos = null; }
    else if (t.dataset.hero != null) playHero(Number(t.dataset.hero));
    else if (t.dataset.rewind != null) cut(Number(t.dataset.rewind));
    else if (t.id === "dx-undo") cut(s.done.length - 1);
    else if (t.id === "dx-reset") cut(0);
    draw();
  });
  board.addEventListener("change", (e) => {
    if (gridBox.contains(e.target)) return;
    const c = e.target.closest("[data-team]");
    if (!c) return;
    const t = s[c.dataset.team], i = Number(c.dataset.i);
    if (c.checked) t.five.add(i); else t.five.delete(i);
    if (t.five.size > 5) { t.five.delete(i); c.checked = false; return; }
    // A different five: the picks' players no longer line up, so forget who each was for.
    s.order.forEach(([f], k) => { if (teamAt(f) === c.dataset.team) delete s.pins[k]; });
    s.pickFor = s.pickPos = null;
    draw();
  });
  board.addEventListener("change", (e) => {
    if (gridBox.contains(e.target)) return;
    if (e.target.id === "dx-rolefilter") { s.roleFilter = e.target.checked; draw(); }
    if (e.target.id === "dx-banpos") { s.banPos = e.target.value === "" ? null : Number(e.target.value); draw(); }
    if (e.target.id === "dx-forpos") { s.pickFor = pickingFor; s.pickPos = Number(e.target.value); draw(); }
  });
  opts.addEventListener("change", (e) => {
    // Who picks first decides whose every step is, so the draft starts over.
    if (e.target.id === "dx-first") { s.first = e.target.value; s.done = []; }
    if (e.target.id === "dx-radiant") s.radiant = e.target.value;
    draw();
  });

  // ---------- starting points ----------
  const fromSeries = (id) => {
    const se = d.series.find((x) => String(x.id) === String(id));
    if (!se) return;
    load(asTeam(src.key, teamById.get(se.home), d.games), asTeam(src.key, teamById.get(se.away), d.games));
  };
  const fromGame = (id) => {
    const g = d.games.find((x) => String(x.id) === String(id));
    if (!g) return;
    const playon = new Map(d.teams.flatMap((t) => t.players.map((p) => [String(p.account_id), p.playon_id ?? null])));
    const played = (t) => g.players.filter((p) => p.team === t).map((p) => ({ key: p.player_key, name: p.name, rank_tier: p.rank_tier, hero: p.hero, playon: playon.get(String(p.account_id)) ?? null }));
    const team = (t) => ({ ...asTeam(src.key, { id: t === "a" ? g.team_a_id : g.team_b_id, name: t === "a" ? g.team_a : g.team_b, players: [] }, d.games, played(t)), five: new Set([0, 1, 2, 3, 4]) });
    const steps = [...g.draft].sort((a, b) => a.order - b.order);
    const firstSide = steps.find((x) => x.pick)?.side ?? "a";
    // X = team A = Radiant; the game's own order, as F/S steps.
    const order = steps.map((x) => [(x.side === "a") === (firstSide === "a") ? "F" : "S", x.pick ? "pick" : "ban"]);
    load(team("a"), team("b"), { first: firstSide === "a" ? "X" : "Y", radiant: "X", order, time: g.start_time, gameId: g.id }).then(() => {
      if (!heroes) return;
      s.original = steps.map((x) => ({ hero: heroes.byName.get(x.hero) })).map((x) => (x.hero == null ? null : x));
      s.done = s.original.every(Boolean) ? s.original.map((x) => x.hero) : [];
      // Each pick was for the player who actually played it.
      steps.forEach((x, i) => { if (x.pick) { const j = (x.side === "a" ? s.X : s.Y).roster.findIndex((p) => p.hero === x.hero); if (j >= 0) s.pins[i] = j; } });
      draw();
    });
  };

  let allTeams = null;
  async function teamsMode() {
    const box = app.querySelector('.dx-mode[data-for="teams"]');
    if (!allTeams) {
      const divs = await Promise.all(ALL_DIVS.map(async (k) => [k, await divLite(k).catch(() => null)]));
      allTeams = divs.filter(([, dd]) => dd).map(([k, dd]) => ({ k, d: dd }));
    }
    const optsFor = (pick) => allTeams.map(({ k, d: dd }) => `<optgroup label="${esc(DIVISIONS[k].name)}">${dd.teams.map((t) => `<option value="${k}:${t.id}"${pick === `${k}:${t.id}` ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</optgroup>`).join("");
    const own = d.teams.slice(0, 2).map((t) => `${src.key}:${t.id}`);
    box.innerHTML = `<label>Team <select id="dx-ta">${optsFor(own[0])}</select></label><span class="muted">vs</span><label>Team <select id="dx-tb">${optsFor(own[1])}</select></label>`;
    const go = () => {
      const pick = (v) => { const [k, id] = v.split(":"); const dd = allTeams.find((x) => x.k === k).d; return asTeam(k, dd.teams.find((t) => String(t.id) === id), dd.games); };
      load(pick(box.querySelector("#dx-ta").value), pick(box.querySelector("#dx-tb").value));
    };
    box.onchange = go;
    go();
  }

  const start = (m) => {
    mode = m;
    try { localStorage.setItem(MODE_KEY, m); } catch {}
    // A ?tab= from the nav would win over this pick on a reload: drop it.
    if (new URLSearchParams(location.search).has("tab")) { const u = new URL(location.href); u.searchParams.delete("tab"); history.replaceState({ ...history.state, tab: undefined }, "", u.pathname + u.search + u.hash); setRoutedAt(location.href); }
    app.querySelectorAll(".dx-modes [data-mode]").forEach((b) => { b.classList.toggle("on", b.dataset.mode === m); b.setAttribute("aria-pressed", String(b.dataset.mode === m)); });
    app.querySelectorAll(".dx-mode").forEach((x) => { x.hidden = x.dataset.for !== m; });
    if (m === "upcoming") { const sel = document.getElementById("dx-series"); if (sel) fromSeries(sel.value); else teamsMode().catch((e) => { board.innerHTML = errorBox(e); }); }
    if (m === "teams") teamsMode().catch((e) => { board.innerHTML = errorBox(e); });
    if (m === "game") { const sel = document.getElementById("dx-game"); if (sel) fromGame(sel.value); else board.innerHTML = ""; }
  };
  app.querySelector(".dx-modes").onclick = (e) => { const b = e.target.closest("[data-mode]"); if (b) start(b.dataset.mode); };
  document.getElementById("dx-series")?.addEventListener("change", (e) => fromSeries(e.target.value));
  // Past game: team, then week (numbered across the division's season), then that week's games.
  const weekOf = gameWeeker(d);
  const weeks = [...new Set(drafted.map(weekOf).filter((w) => w != null))].sort((a, b) => a - b);
  const gTeam = document.getElementById("dx-gteam"), gWeek = document.getElementById("dx-gweek"), gGame = document.getElementById("dx-game");
  const teamGames = () => drafted.filter((g) => String(g.team_a_id) === gTeam.value || String(g.team_b_id) === gTeam.value);
  const fillWeeks = (load = true) => {
    const mine = [...new Set(teamGames().map(weekOf))].sort((a, b) => b - a);
    gWeek.innerHTML = mine.map((w) => {
      const opp = teamGames().find((g) => weekOf(g) === w);
      const vs = String(opp.team_a_id) === gTeam.value ? opp.team_b : opp.team_a;
      return `<option value="${w}">Week ${weeks.indexOf(w) + 1} · ${new Date(opp.start_time * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · vs ${esc(vs)}</option>`;
    }).join("");
    fillGames(load);
  };
  const fillGames = (load = true) => {
    const list = teamGames().filter((g) => String(weekOf(g)) === gWeek.value).sort((a, b) => a.start_time - b.start_time);
    gGame.innerHTML = list.map((g, i) => {
      const us = String(g.team_a_id) === gTeam.value ? "a" : "b";
      return `<option value="${g.id}">Game ${i + 1} · ${g.winner === us ? "won" : "lost"}</option>`;
    }).join("");
    if (load && gGame.value) fromGame(gGame.value);
  };
  gTeam?.addEventListener("change", () => fillWeeks());
  gWeek?.addEventListener("change", () => fillGames());
  gGame?.addEventListener("change", (e) => fromGame(e.target.value));
  if (gTeam) fillWeeks(false); // filled now; the game loads when Past game is opened
  start(mode);
}
