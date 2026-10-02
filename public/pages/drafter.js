// Drafter: draft Captains Mode for any two AD2L teams with the draft model (lib/cmdraft.js,
// Project Sybil's model) scoring every hero at every step. Start from an upcoming series, any
// two teams, or a past game's draft (rewind to any step and branch). Loaded on first visit.
import { esc, app, pageHead, portrait, pct, DIVISIONS, ALL_DIVS, divLite, gameWeeker } from "../core.js";
import { loading, errorBox } from "../parts/lanes.js";
import { isPlayed } from "../lib/predict.js";
import { gameContext, scoreHeroes, draftProbability, stateFeatures, sideComposition, openRoleFor, fitsRole, poolShares, CM_STEPS } from "../lib/cmdraft.js";
import { draftDataFor, heroIndex, MODEL_NOTE, rankName, draftChart } from "../parts/cmdraft.js";

const MODES = [["upcoming", "Upcoming series"], ["teams", "Any two teams"], ["game", "Past game"]];
const MODE_KEY = "drafter-mode";
const SHOWN = 10; // suggestions listed
const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

// A team as the drafter holds it: its roster and which five are playing.
const asTeam = (div, t, games, played = null) => {
  const roster = played ?? t.players.map((p) => ({ key: String(p.account_id), name: p.name, rank_tier: p.rank_tier }));
  // Default five: the players with the most league games for this team this season.
  const n = new Map();
  for (const g of games) for (const p of g.players) if (g.team_a_id === t.id || g.team_b_id === t.id) n.set(p.player_key, (n.get(p.player_key) ?? 0) + 1);
  const order = roster.map((p, i) => i).sort((a, b) => (n.get(roster[b].key) ?? 0) - (n.get(roster[a].key) ?? 0) || a - b);
  return { div, id: t.id, name: t.name, roster, five: new Set(order.slice(0, 5)) };
};

export async function renderDrafter(src) {
  app.innerHTML = loading(src.kicker, "Drafter");
  let d;
  try { d = await src.data(); } catch (e) { app.innerHTML = `${pageHead(src.kicker, "Drafter")}${errorBox(e)}`; return; }
  let mode = "upcoming";
  try { mode = MODES.some(([k]) => k === localStorage.getItem(MODE_KEY)) ? localStorage.getItem(MODE_KEY) : mode; } catch {}

  const now = Date.now() / 1000;
  const upcoming = d.series.filter((s) => !isPlayed(s) && s.home && s.away && (s.time ?? now) > now - 6 * 3600).sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  const drafted = d.games.filter((g) => g.draft?.some((s) => s.pick) && g.players?.length === 10).sort((a, b) => b.start_time - a.start_time);
  const teamById = new Map(d.teams.map((t) => [t.id, t]));
  const when = (t) => (t ? new Date(t * 1000).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "time TBD");

  app.innerHTML = `${pageHead(src.kicker, "Drafter", "Draft Captains Mode for any two teams. The model scores every hero at every step: your chance to win if you pick it, and how much it would give the other team if you leave it.")}
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
          <p class="table-note">The game's draft loads in full. Click any step to rewind to it and draft differently from there. Players are read as of the game, so the model only knows what it knew then.</p>`
          : `<p class="muted">No drafted games in ${esc(src.division)} yet.</p>`}
      </div>
      <div class="dx-opts" id="dx-opts"></div>
    </section>
    <div id="dx-board"><div class="panel empty">Loading the draft model…</div></div>`;

  // ---------- the draft in play ----------
  // X and Y: the two teams. `first` and `radiant` say which is which; `done` holds hero ids
  // in step order; `order` the steps ([F|S, ban|pick]); `original` a past game's own steps.
  const s = { X: null, Y: null, first: "X", radiant: "X", done: [], order: CM_STEPS, original: null, time: now, gameId: null, roleFilter: true, pins: {}, pickFor: null, pickPos: null };
  let data = null, heroes = null, ctx = null, ctxKey = "";

  const board = document.getElementById("dx-board"), opts = document.getElementById("dx-opts");
  const other = (w) => (w === "X" ? "Y" : "X");
  const teamAt = (fs) => (fs === "F" ? s.first : other(s.first)); // F/S -> X/Y
  const sideOf = (w) => (w === s.radiant ? "radiant" : "dire");
  const fiveOf = (t) => {
    const list = [...t.five].sort((a, b) => a - b).map((i) => t.roster[i]);
    while (list.length < 5) list.push({ key: null, name: "Unknown player", rank_tier: null });
    return list.slice(0, 5);
  };

  async function load(X, Y, { first = "X", radiant = "X", done = [], order = CM_STEPS, original = null, time = now, gameId = null } = {}) {
    Object.assign(s, { X, Y, first, radiant, done, order, original, time, gameId, pins: {}, pickFor: null, pickPos: null });
    board.innerHTML = `<div class="panel empty">Loading the draft model…</div>`;
    data = await draftDataFor([X.div, Y.div]);
    if (!data) { board.innerHTML = `<p class="muted">The draft model's data hasn't synced for ${esc(DIVISIONS[X.div].short)}${X.div !== Y.div ? ` or ${esc(DIVISIONS[Y.div].short)}` : ""} yet.</p>`; opts.innerHTML = ""; return; }
    heroes = heroIndex(data);
    ctxKey = "";
    draw();
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
  // team's five), which the model then reads as that player's hero outright.
  const stateAt = (n) => {
    const st = { radiant: [], dire: [], pins: { radiant: [], dire: [] } };
    s.order.slice(0, n).forEach(([fs, kind], i) => { if (kind === "pick") { const sd = sideOf(teamAt(fs)); st[sd].push(s.done[i]); st.pins[sd].push(s.pins[i] ?? null); } });
    return st;
  };
  // Drop what no longer applies after rewinding to step n.
  const cut = (n) => { s.done = s.done.slice(0, Math.max(0, n)); for (const i of Object.keys(s.pins)) if (Number(i) >= n) delete s.pins[i]; s.pickFor = s.pickPos = null; };
  let pickingFor = null; // the player the step in play is picked for, set by draw()

  function optsHtml() {
    const sel = (id, v) => `<select id="${id}"><option value="X"${v === "X" ? " selected" : ""}>${esc(s.X.name)}</option><option value="Y"${v === "Y" ? " selected" : ""}>${esc(s.Y.name)}</option></select>`;
    return `<label>First pick ${sel("dx-first", s.first)}</label><label>Radiant ${sel("dx-radiant", s.radiant)}</label>`;
  }

  function draw() {
    const c = context();
    opts.innerHTML = s.original ? "" : optsHtml();
    const n = s.done.length, over = n >= s.order.length;
    const state = stateAt(n), gone = new Set(s.done);
    const toX = (p) => (s.radiant === "X" ? p : 1 - p);
    const pX = toX(draftProbability(c, state));
    // X's chance before the draft and after each step so far, for the chart.
    const line = Array.from({ length: n + 1 }, (_, i) => (i === n ? pX : toX(draftProbability(c, stateAt(i)))));
    const chart = draftChart({ values: line, nameX: s.X.name, nameY: s.Y.name, current: over ? null : n, rewind: true, width: board.clientWidth || 1000,
      order: s.order.map(([f, k]) => ({ who: teamAt(f), pick: k === "pick" })),
      steps: s.done.map((h, i) => ({ who: teamAt(s.order[i][0]), pick: s.order[i][1] === "pick", hero: heroes.name(h) })) });
    const [fs, kind] = s.order[n] ?? [];
    const who = over ? null : teamAt(fs), side = who && sideOf(who);
    const available = heroes.ids.filter((h) => !gone.has(h));

    // Which position each team's picks play, and what's still open (Sybil's composition).
    const assign = stateFeatures(c, state).assignment;
    const comp = { radiant: sideComposition(c.radiant, state.radiant, assign.radiant), dire: sideComposition(c.dire, state.dire, assign.dire) };
    // Suggestions for the step in play. The model has no rule against a third carry, so a pick is
    // offered only for a position the team hasn't filled, and a ban only for one the other team
    // hasn't (toggle off to see everything). `roleOf` is the open position a hero would fill.
    let list = [], values = new Map(), roleOf = new Map(), hidden = 0, forPos = null;
    pickingFor = null;
    if (!over && kind === "pick") {
      // Who this pick is for: your choice, else the player with the least of a hero so far.
      const taken = new Set(state.pins[side].filter((j) => j != null));
      const free = [0, 1, 2, 3, 4].filter((j) => !taken.has(j));
      const held = (j) => assign[side][j].reduce((a, b) => a + b, 0);
      pickingFor = free.includes(s.pickFor) ? s.pickFor : [...free].sort((a, b) => held(a) - held(b) || a - b)[0] ?? null;
      // And at which position: your choice, else the open position they play most.
      const open = comp[side].open, sh = pickingFor != null ? poolShares(c[side][pickingFor].pool) : null;
      forPos = open.includes(s.pickPos) ? s.pickPos : sh ? open.reduce((b, r) => (b == null || sh[r] > sh[b] ? r : b), null) : open[0] ?? null;
    }
    if (!over) {
      const scored = scoreHeroes(c, state, side, available, { pickFor: pickingFor });
      const target = kind === "pick" ? side : side === "radiant" ? "dire" : "radiant";
      for (const h of available) roleOf.set(h, kind === "pick" && pickingFor != null && forPos != null
        ? (fitsRole(h, forPos, c[side][pickingFor].playedAt) ? forPos : null)
        : openRoleFor(h, comp[target].open, c[target]));
      const theirs = kind === "ban" ? new Map(scoreHeroes(c, state, target, available).map((x) => [x.hero, x])) : null;
      list = scored.filter((x) => x[kind] != null).sort((a, b) => b[kind] - a[kind]);
      for (const x of list) values.set(x.hero, x[kind]);
      if (s.roleFilter) { const all = list.length; list = list.filter((x) => roleOf.get(x.hero) != null); hidden = all - list.length; }
      list = list.slice(0, SHOWN).map((x) => ({ ...x, them: theirs?.get(x.hero) }));
    }
    const team = (w) => s[w];
    const playersOf = (w) => c.info[sideOf(w)];
    const val = (v) => (kind === "pick" ? pct(v) : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}`);
    const real = s.original?.[n];


    const sugg = over ? `<p class="muted">Draft complete.</p>` : `<ol class="dx-list">${list.map((x) => {
      const pl = kind === "pick" ? playersOf(who)[pickingFor ?? x.player] : x.them && playersOf(other(who))[x.them.player];
      const share = kind === "pick" ? null : x.them?.playerShare;
      return `<li><button type="button" class="dx-pickbtn" data-hero="${x.hero}">${portrait(heroes.name(x.hero))}<span class="dx-hn">${esc(heroes.name(x.hero))}</span>
        <b>${val(x[kind])}</b><small>${roleOf.get(x.hero) != null ? `<i class="dx-pos">pos ${roleOf.get(x.hero) + 1}</i> ` : ""}${pl ? `${kind === "pick" ? "" : "theirs: "}${esc(pl.name)}${share != null ? ` ${pct(share)}` : ""}` : ""}</small></button></li>`;
    }).join("")}</ol>`;

    const rosterHtml = (w) => {
      const t = team(w), info = playersOf(w), sd = sideOf(w);
      const picks = state[sd], m = stateFeatures(c, state).assignment[sd];
      const five = fiveOf(t);
      const rows = five.map((p, j) => {
        const heroCol = picks.map((h, k) => [h, m[j][k]]).sort((a, b) => b[1] - a[1])[0];
        return `<tr><td class="l">${esc(p.name)}</td><td>${info[j].games ? info[j].games.toLocaleString() : '<span class="muted">none</span>'}</td>
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
        slots[kind2].push(`<button type="button" class="dx-bslot ${kind2}${i === n ? " now" : ""}${h != null ? " filled" : ""}"${h != null ? ` data-rewind="${i}" title="Rewind to step ${i + 1}"` : " disabled"}>
          <span class="dx-bn">${i + 1}</span>${h != null ? portrait(heroes.name(h)) : `<span class="dx-bempty">${i === n ? "Next" : kind2 === "pick" ? "Pick" : "Ban"}</span>`}${who ? `<small>${pos != null ? `<i class="dx-pos">${pos + 1}</i> ` : ""}${esc(who)}</small>` : ""}</button>`);
      });
      return `<div class="dx-team ${w === "X" ? "s-a" : "s-b"}"><div class="dx-tname"><b>${esc(s[w].name)}</b><small>${sd === "radiant" ? "Radiant" : "Dire"}${s.first === w ? " · first pick" : ""}</small></div>
        <div class="dx-picks">${slots.pick.join("")}</div><div class="dx-bans">${slots.ban.join("")}</div></div>`;
    }).join("");

    board.innerHTML = `
      <div class="dx-bar" role="img" aria-label="${esc(s.X.name)} ${pct(pX)} to win, ${esc(s.Y.name)} ${pct(1 - pX)}">
        <span class="dx-bar-x">${esc(s.X.name)} <b>${pct(pX)}</b></span>
        <span class="dx-bar-track"><i style="width:${(pX * 100).toFixed(1)}%"></i></span>
        <span class="dx-bar-y"><b>${pct(1 - pX)}</b> ${esc(s.Y.name)}</span>
      </div>
      ${boardHtml()}
      ${chart}
      <div class="dx-now">
        ${over ? `<b>Draft complete.</b>` : `<span class="dx-next">Next · step ${n + 1} of ${s.order.length}</span> <b class="cm-side ${who === "X" ? "s-a" : "s-b"}">${esc(team(who).name)}</b> ${kind === "pick" ? "picks" : "bans"}.
          ${s.order.length > n + 1 ? `<span class="dx-then">Then: ${s.order.slice(n + 1, n + 4).map(([f, k], j) => `<span class="${teamAt(f) === "X" ? "s-a" : "s-b"}">${n + j + 2}. ${esc(team(teamAt(f)).name)} ${k}</span>`).join(" · ")}${s.order.length > n + 4 ? " …" : ""}</span>` : ""}`}
        ${real != null && !over ? `<span class="dx-real">In the game: ${portrait(heroes.name(real.hero))} ${esc(heroes.name(real.hero))}${values.has(real.hero) ? ` (${val(values.get(real.hero))}, ${ord([...values.keys()].indexOf(real.hero) + 1)} by the model)` : ""} <button type="button" class="linkish" data-hero="${real.hero}">Play it</button></span>` : ""}
        <span class="dx-btns"><button type="button" id="dx-undo"${n ? "" : " disabled"}>Undo</button><button type="button" id="dx-reset"${n ? "" : " disabled"}>Reset</button></span>
      </div>
      <div class="dx-cols">
        <section class="dx-sugg"><h3 class="gm-h3">${over ? "Done" : kind === "pick" ? "Best picks" : "Best bans"}</h3>
          <p class="table-note">${over ? "" : kind === "pick" ? `${esc(team(who).name)}'s chance to win with each hero, and who would play it.` : `How many points each hero would add to ${esc(team(other(who)).name)}'s chance if they got it, and who'd play it.`}</p>
          ${!over && kind === "pick" ? `<div class="dx-for"><span class="dx-for-l">Picking for</span>${fiveOf(team(who)).map((p, j) => {
            const k = state.pins[side].indexOf(j), h = k >= 0 ? state[side][k] : null, sh = poolShares(c[side][j].pool), main = sh.indexOf(Math.max(...sh));
            return `<button type="button" class="dx-forbtn${j === pickingFor ? " on" : ""}" data-for="${j}"${h != null ? " disabled" : ""} aria-pressed="${j === pickingFor}">${h != null ? portrait(heroes.name(h)) : ""}<span>${esc(p.name)}</span><small>${h != null ? "picked" : `usually ${main + 1}`}</small></button>`;
          }).join("")}${comp[side].open.length > 1 && pickingFor != null ? `<label class="dx-forpos">as <select id="dx-forpos">${comp[side].open.map((r) => `<option value="${r}"${r === forPos ? " selected" : ""}>pos ${r + 1}</option>`).join("")}</select></label>` : ""}</div>` : ""}
          ${over ? "" : `<label class="dx-rolefilter"><input type="checkbox" id="dx-rolefilter"${s.roleFilter ? " checked" : ""}> Only open positions
            <small>${(() => { const t = kind === "pick" ? side : side === "radiant" ? "dire" : "radiant"; return `${kind === "pick" && pickingFor != null && forPos != null ? `Heroes for ${esc(fiveOf(team(who))[pickingFor].name)} at pos ${forPos + 1}. ` : ""}${esc(team(kind === "pick" ? who : other(who)).name)} still need ${comp[t].open.map((r) => r + 1).join(", ") || "nothing"}${s.roleFilter && hidden ? ` · ${hidden} heroes hidden` : ""}`; })()}</small></label>`}
          ${sugg}</section>
        <section class="dx-heroes"><h3 class="gm-h3">All heroes</h3>
          <input type="search" id="dx-find" placeholder="Find a hero" autocomplete="off" aria-label="Find a hero">
          <div class="dx-grid">${heroes.ids.map((h) => `<button type="button" class="dx-tile${gone.has(h) ? " gone" : ""}${!gone.has(h) && !over && s.roleFilter && roleOf.get(h) == null ? " off" : ""}" data-hero="${h}" data-name="${esc(heroes.name(h).toLowerCase())}"${gone.has(h) || over ? " disabled" : ""} title="${esc(heroes.name(h))}${values.has(h) ? `: ${val(values.get(h))}` : ""}">${portrait(heroes.name(h))}${values.has(h) ? `<small>${val(values.get(h))}</small>` : ""}</button>`).join("")}</div>
        </section>
      </div>
      <div class="dx-rosters">${rosterHtml("X")}${rosterHtml("Y")}</div>
      <p class="table-note">${esc(MODEL_NOTE)} Rosters with fewer than five known players fill the rest with an average player.</p>`;
    const find = document.getElementById("dx-find");
    find.oninput = () => { const q = find.value.trim().toLowerCase(); board.querySelectorAll(".dx-tile").forEach((b) => { b.hidden = q && !b.dataset.name.includes(q); }); };
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
  board.addEventListener("click", (e) => {
    const t = e.target.closest("[data-hero], [data-rewind], [data-for], #dx-undo, #dx-reset");
    if (!t || t.disabled) return;
    if (t.dataset.for != null) { s.pickFor = Number(t.dataset.for); s.pickPos = null; }
    else if (t.dataset.hero != null) {
      const n = s.done.length;
      if (n >= s.order.length) return;
      if (s.order[n][1] === "pick" && pickingFor != null) s.pins[n] = pickingFor;
      s.done = [...s.done, Number(t.dataset.hero)];
      s.pickFor = s.pickPos = null;
    }
    else if (t.dataset.rewind != null) cut(Number(t.dataset.rewind));
    else if (t.id === "dx-undo") cut(s.done.length - 1);
    else if (t.id === "dx-reset") cut(0);
    draw();
  });
  board.addEventListener("change", (e) => {
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
    if (e.target.id === "dx-rolefilter") { s.roleFilter = e.target.checked; draw(); }
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
    const played = (t) => g.players.filter((p) => p.team === t).map((p) => ({ key: p.player_key, name: p.name, rank_tier: p.rank_tier, hero: p.hero }));
    const team = (t) => ({ ...asTeam(src.key, { id: t === "a" ? g.team_a_id : g.team_b_id, name: t === "a" ? g.team_a : g.team_b, players: [] }, [], played(t)), five: new Set([0, 1, 2, 3, 4]) });
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
