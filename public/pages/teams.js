// Teams: the scrim team list and every team's page.
import { hasDetails, playerLeaderboard } from "../lib/stats.js";
import { tierList, rankLabel } from "../lib/tiers.js";
import { listTeams, standingsRows, teamHistory, sideOf } from "../lib/teams.js";
import { wireCharts } from "../lib/charts.js";
import { collectWards, wireWardMaps } from "../lib/wardmap.js";
import { teamFightMapHtml, wireFightMaps } from "../lib/fightmap.js";
import { teamSmokeHtml, wireSmokeMaps } from "../lib/smokemap.js";
import { teamDraftPhases, teamSideSplit, PHASES } from "../lib/draft.js";
import { teamByName } from "../lib/unticketed.js";
import { info } from "../lib/glossary.js";
import { clock } from "../lib/items.js";
import { teamSplits, playerPairs } from "../lib/combat.js";
import { lengthHtml } from "../lib/combat-charts.js";
import { tune, fitRatings } from "../lib/predict.js";
import { isBye } from "../lib/playoffs.js";
import { SOURCES, divCache, app, pageHead, esc, portrait, floorOf, playerLink, teamLink, seriesDraftsHtml, dur, when, heroHref, shortDate, heroLink, playerTabs, teamMapHtml, mapCard, wardView, crumbs, wirePlayerTabs, wireMapCards, sortableTable, pct, fmt, scrollToSection } from "../core.js";
import { pageTabs, TEAM_TABS } from "../lib/pagetabs.js";
import { loading, errorBox, laneCutsOf, teamLanesHtml } from "../parts/lanes.js";
import { tierRef } from "../parts/tiers.js";
import { heroGridHtml, wireHeroGrid } from "../parts/herogrid.js";

// ---------- Teams ----------

// A team's official roster: the PlayOn team for AD2L, and for scrims the Champion team of the
// same name (scrim teams are the Champion teams). Null when there isn't one.
function rosterOf(team, ad2l) {
  if (ad2l) return ad2l.teams.find((t) => t.id === team.id)?.players ?? null;
  return teamByName(divCache.ad2l, team.name)?.players ?? null;
}

// Form as W/L pills, oldest first.
const formPills = (results) => `<span class="form">${results.map((r) => `<i class="${r === "W" ? "w" : "l"}" title="${r === "W" ? "Win" : "Loss"}">${r}</i>`).join("")}</span>`;
const POS = { 1: "Pos 1 · Carry", 2: "Pos 2 · Mid", 3: "Pos 3 · Offlane", 4: "Pos 4 · Soft support", 5: "Pos 5 · Hard support" };

export async function renderTeams(src, slug) {
  app.innerHTML = loading(src.kicker, "Teams");
  let matches, ad2l = null;
  try {
    matches = await src.load();
    if (src.ad2l) ad2l = await src.data();
  } catch (e) { app.innerHTML = `${pageHead(src.kicker, "Teams")}${errorBox(e)}`; return; }
  const base = src.ad2l ? `${src.root}/teams` : "#/teams";
  let teams = listTeams(matches, ad2l?.teams ?? []);
  if (ad2l) {
    // AD2L records from PlayOn's series scores (official; complete even when a game's
    // stats couldn't be found).
    teams = teams.map((t) => {
      let wins = 0, losses = 0;
      for (const s of ad2l.series.filter((x) => x.home === t.id || x.away === t.id)) {
        const [us, them] = s.home === t.id ? [s.home_score, s.away_score] : [s.away_score, s.home_score];
        wins += us ?? 0; losses += them ?? 0;
      }
      return { ...t, wins, losses, games: wins + losses };
    }).sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
  }
  const table = new Map(standingsRows(matches).map((r) => [r.slug, r])); // form and streak, from games
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  if (!slug) {
    const card = (t, i) => {
      const r = table.get(t.slug), roster = rosterOf(t, ad2l), h = teamHistory(matches, t);
      const names = roster
        ? roster.map((p) => (p.captain ? `<b title="Captain">${esc(p.name)}</b>` : esc(p.name)))
        : h.players.slice(0, 5).map((p) => esc(p.name));
      return `<a class="team-card" href="${base}/${t.slug}" style="--i:${Math.min(i, 14)}">
        <span class="tc-rank">#${i + 1}</span>
        <span class="tc-name">${esc(t.name)}</span>
        <span class="tc-rec"><b>${t.wins}</b>–${t.losses}</span>
        <span class="tc-meta">${t.games ? `${Math.round((t.wins / t.games) * 100)}% of ${plural(t.games, "game")}` : "No games yet"}${r?.form.length ? ` ${formPills(r.form)}` : ""}</span>
        ${names.length ? `<span class="tc-roster">${names.join('<span class="sep"> · </span>')}</span>` : ""}
        ${h.heroes.length ? `<span class="tc-heroes">${h.heroes.slice(0, 5).map((x) => portrait(x.hero)).join("")}</span>` : ""}
      </a>`;
    };
    app.innerHTML = `
      ${pageHead(src.kicker, "Teams", teams.length ? `${teams.length} teams, ranked by game wins.` : "")}
      ${teams.length ? `<div class="team-grid reveal">${teams.map(card).join("")}</div>`
      : `<div class="panel empty"><strong>No teams yet</strong>${src.empty}</div>`}`;
    return;
  }

  const team = teams.find((t) => t.slug === slug);
  if (!team) { app.innerHTML = `${pageHead(src.kicker, "Teams")}<div class="notice err">No team “${esc(slug)}”. <a href="${base}">All teams</a></div>`; return; }
  const h = teamHistory(matches, team);
  const roster = rosterOf(team, ad2l);
  const row = table.get(team.slug);
  const pct0 = (x) => (x == null ? "—" : `${Math.round(x * 100)}%`);

  // Roster players matched to who actually played for the team: by account id, else by name.
  const played = new Map();
  for (const p of h.players) {
    played.set(p.name.trim().toLowerCase(), p);
    if (p.account_id) played.set(String(p.account_id), p);
  }
  const members = (roster ?? []).map((r) => {
    const g = played.get(String(r.account_id)) ?? played.get(r.name.trim().toLowerCase()) ?? null;
    return { ...r, key: g?.key ?? (src.ad2l ? String(r.account_id) : r.name.trim().toLowerCase()), g };
  }).sort((a, b) => (a.g?.position ?? 9) - (b.g?.position ?? 9) || b.captain - a.captain || a.name.localeCompare(b.name));
  const hasPos = members.some((m) => m.g?.position);
  const onRoster = new Set(members.filter((m) => m.g).map((m) => m.g.key));
  const others = roster ? h.players.filter((p) => !onRoster.has(p.key)) : [];

  // Tier letters from the league's tier list (players with enough games).
  const detailed = matches.filter(hasDetails), model = await tierRef(src), laneCuts_ = await laneCutsOf(src);
  const tierOf = new Map(tierList(detailed, { model, minGames: floorOf(src) }).tiers.flatMap(({ tier, players }) => players.map((p) => [p.key, { ...p, tier }])));
  const tierTag = (key) => { const t = tierOf.get(key); return t ? `<span class="rc-tier t-${t.tier}" title="${t.tier} tier · ${t.rating} rating">${t.tier}</span>` : ""; };

  // AD2L record comes from PlayOn's series scores (official, and complete even when a
  // game's stats couldn't be found); scrims use their own games.
  const rec = ad2l
    ? { w: team.wins, l: team.losses, note: team.games ? `${pct0(team.wins / team.games)} of games · from PlayOn` : "no games yet" }
    : { w: h.wins, l: h.losses, note: h.played ? `${pct0(h.win_rate)} win rate` : "no games yet" };
  const captain = members.find((m) => m.captain);
  const sub = [
    `#${teams.indexOf(team) + 1} of ${teams.length}`,
    `${rec.w}–${rec.l}`,
    row?.streak && row.streak.slice(1) > 1 ? `${row.streak.slice(1)}-game ${row.streak[0] === "W" ? "win" : "losing"} streak` : "",
    captain ? `Captain ${playerLink(src, captain)}` : "",
  ].filter(Boolean).join(" · ");

  const cardsHtml = (cards) => `<div class="cards reveal">${cards.map(([k, v, s, tip], i) => `<div class="card" style="--i:${i}"><div class="k">${k}${info(tip)}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join("")}</div>`;
  const diff = h.avg_kills_for != null ? h.avg_kills_for - h.avg_kills_against : null;
  const stats = [
    ["Record", `${rec.w}–${rec.l}`, rec.note],
    ["Form", row?.form.length ? formPills(row.form) : "—", row?.form.length ? `last ${row.form.length} games, oldest first` : "no games yet"],
    ["Avg game", h.avg_minutes ? `${Math.round(h.avg_minutes)} min` : "—", `${plural(h.played, "game")}${ad2l ? " with stats" : ""}${h.private_games ? ` · ${h.private_games} private` : ""}`],
    ["Avg kills", h.avg_kills_for != null ? h.avg_kills_for.toFixed(1) : "—", diff != null ? `${h.avg_kills_against.toFixed(1)} against · ${diff >= 0 ? "+" : ""}${diff.toFixed(1)} a game` : "", "avg_kills"],
  ];
  // Splits from the team's own games: side, stand-ins, first blood, fights, aegis steals.
  const sideMap = new Map(h.games.map(({ m, side }) => [m, side]));
  const sp = teamSplits(h.games.map(({ m }) => m), (m) => sideMap.get(m));
  const wl = (r) => (r.games ? `${r.wins}–${r.games - r.wins}` : "—");
  const sideName = (t) => (ad2l ? (t === "a" ? "Radiant" : "Dire") : t === "a" ? "Team A (left)" : "Team B (right)");
  stats.push(
    ["Sides", `${wl(sp.sides.a)} <small class="v-sep">/</small> ${wl(sp.sides.b)}`, `as ${sideName("a")} / as ${sideName("b")}`, "team_sides"],
    ...(sp.standin.with.games ? [["With stand-ins", wl(sp.standin.with), `${pct0(sp.standin.with.wins / sp.standin.with.games)} · ${wl(sp.standin.without)} with the roster only`, "team_standins"]] : []),
    ...(sp.first_blood.games ? [["First blood", pct0(sp.first_blood.taken / sp.first_blood.games), `drew it in ${sp.first_blood.taken} of ${plural(sp.first_blood.games, "game")} · ${sp.first_blood.wins_taken}–${sp.first_blood.taken - sp.first_blood.wins_taken} when they did, ${sp.first_blood.wins_given}–${sp.first_blood.games - sp.first_blood.taken - sp.first_blood.wins_given} when they didn't${sp.first_blood.times.length ? ` · usually at ${clock(Math.round([...sp.first_blood.times].sort((a, b) => a - b)[Math.floor(sp.first_blood.times.length / 2)]))}` : ""}`, "team_first_blood"]] : []),
    ...(sp.fights.won + sp.fights.lost ? [["Teamfights", pct0(sp.fights.win_rate), `${sp.fights.won} won, ${sp.fights.lost} lost${sp.fights.even ? `, ${sp.fights.even} even` : ""} in ${plural(sp.fights.games, "game")}`, "team_fight_rate"]] : []),
    ...(sp.aegis.stole + sp.aegis.lost ? [["Aegis steals", String(sp.aegis.stole), `stolen from them: ${sp.aegis.lost}`, "aegis_steals"]] : []),
  );
  const lengthSection = h.games.length ? `<h2>Game length${info("team_length")}</h2>${lengthHtml(sp.length)}` : "";
  const pairs = playerPairs(h.games.map(({ m }) => m), (m) => sideMap.get(m));

  // Series (AD2L) or game (scrim) history rows, newest first.
  let historyRows;
  if (ad2l) {
    const tname = Object.fromEntries(ad2l.teams.map((t) => [t.id, t.name]));
    const mine = ad2l.series.filter((s) => s.home === team.id || s.away === team.id).sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
    historyRows = mine.map((s, i) => {
      const home = s.home === team.id;
      const [us, them] = home ? [s.home_score, s.away_score] : [s.away_score, s.home_score];
      const done = (us ?? 0) + (them ?? 0) > 0;
      const result = !done ? "upcoming" : us > them ? "win" : us < them ? "loss" : "tie";
      const gs = h.games.filter(({ m }) => m.series_id === s.id).sort((a, b) => a.m.createdAt - b.m.createdAt);
      return `<div class="hist-row ${result}" style="--i:${Math.min(i, 12)}">
        <span class="hist-res">${result === "upcoming" ? "Next" : result === "tie" ? "T" : result === "win" ? "W" : "L"}</span>
        <span class="hist-vs">vs <b>${tname[home ? s.away : s.home] ? teamLink(src, tname[home ? s.away : s.home], home ? s.away : s.home) : "TBD"}</b></span>
        <span class="hist-score">${done ? `${us}–${them}` : ""}</span>
        <span class="hist-games">${gs.map(({ m, side }, j) => `<a href="${src.link(m)}" class="${m.winner === side ? "w" : "l"}">G${j + 1} ${m.winner === side ? "W" : "L"}</a>`).join("")}</span>
        <span class="hist-date">${s.time ? new Date(s.time * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</span>
      </div>${gs.some(({ m }) => m.draft?.length) ? `<div class="hist-drafts">${seriesDraftsHtml(src, gs.map(({ m }) => m))}</div>` : ""}`;
    });
  } else {
    historyRows = h.games.map(({ m, side }, i) => {
      const won = m.winner === side;
      const opp = side === "a" ? m.team_b : m.team_a;
      const [us, them] = side === "a" ? [m.score_a, m.score_b] : [m.score_b, m.score_a];
      return `<a class="hist-row ${won ? "win" : "loss"}" href="${src.link(m)}" style="--i:${Math.min(i, 12)}">
        <span class="hist-res">${won ? "W" : "L"}</span>
        <span class="hist-vs">vs <b>${teamLink(src, opp, null, true)}</b></span>
        <span class="hist-score">${us}–${them}</span>
        <span class="hist-games">${dur(m.duration_sec)}${m.private ? ' · <span class="priv">Private</span>' : ""}</span>
        <span class="hist-date">${when(m.createdAt)}</span>
      </a>`;
    });
  }
  const noGames = `<div class="panel empty">No games yet.</div>`;
  const noPlayers = `<div class="panel empty">No player data${h.private_games ? " (private scrims only)" : ""}.</div>`;

  // Roster: one card per player, in position order.
  const playerCard = (p, g, i, { captain = false, standin = false } = {}) => `<article class="rc${g ? "" : " idle"}" style="--i:${Math.min(i, 12)}">
      <div class="rc-top"><span class="rc-pos">${g?.position ? POS[g.position] : standin ? "Stand-in" : ""}</span>${captain ? '<span class="cap" title="Captain">Captain</span>' : ""}${tierTag(p.key)}</div>
      <div class="rc-name">${playerLink(src, p)}</div>
      <div class="rc-rank">${rankLabel(p.rank_tier) ? esc(rankLabel(p.rank_tier)) : "&nbsp;"}</div>
      ${g ? `<div class="rc-line"><b>${g.wins}–${g.games - g.wins}</b> in ${plural(g.games, "game")} · ${pct0(g.wins / g.games)} · KDA ${g.kda.toFixed(2)}</div>
        <div class="rc-heroes">${g.heroes.slice(0, 5).map((x) => `<a href="${heroHref(src, x.hero)}" title="${esc(x.hero)} · ${x.wins}–${x.games - x.wins}">${portrait(x.hero)}</a>`).join("")}</div>`
      : `<div class="rc-line muted">No games with stats for ${esc(team.name)} yet.</div>`}
    </article>`;
  const rosterCards = roster
    ? members.map((m, i) => playerCard(m, m.g, i, { captain: m.captain })).join("")
    : h.players.map((p, i) => playerCard(p, p, i)).join("");
  const standinCards = others.map((p, i) => playerCard(p, p, members.length + i, { standin: true })).join("");
  const rosterNote = roster
    ? `${src.ad2l ? "The PlayOn roster" : "The Champion roster (scrim teams are the Champion teams)"}${hasPos ? ", in the position each player plays most" : ""}. Record, KDA and heroes come from ${esc(team.name)}'s games with stats${h.private_games ? `; ${plural(h.private_games, "private scrim")} have no lineups` : ""}.`
    : `No official roster for this team, so this is everyone who has played for it, most games first.`;

  // Compact roster for the overview.
  const rosterStrip = roster
    ? `<ul class="roster">${members.map((m) => `<li>${hasPos ? `<span class="rs-pos" title="${m.g?.position ? POS[m.g.position] : "No games yet"}">${m.g?.position ?? "–"}</span>` : ""}${playerLink(src, m)}${m.captain ? '<span class="cap" title="Captain">C</span>' : ""}${tierTag(m.key)}<span class="tag">${rankLabel(m.rank_tier) ? esc(rankLabel(m.rank_tier)) : ""}</span></li>`).join("")}
        ${others.length ? `<li class="rs-more">${plural(others.length, "stand-in")}: ${others.map((p) => playerLink(src, p)).join(", ")}</li>` : ""}</ul>`
    : `<ul class="roster">${h.players.slice(0, 7).map((p) => `<li>${playerLink(src, p)}${tierTag(p.key)}<span class="tag">${plural(p.games, "game")}</span></li>`).join("") || `<li class="muted">No player data${h.private_games ? " (private scrims only)" : ""}.</li>`}</ul>`;

  const opponents = h.opponents.length ? `<h2 id="head-to-head">Head to head</h2>
    <div class="h2h reveal">${h.opponents.map((o, i) => `<div class="h2h-row ${o.wins * 2 > o.games ? "up" : o.wins * 2 < o.games ? "down" : "even"}" style="--i:${Math.min(i, 12)}">
      <span class="h2h-name">${teamLink(src, o.name, o.id)}</span>
      <span class="h2h-bar" aria-hidden="true"><i style="width:${Math.round((o.wins / o.games) * 100)}%"></i></span>
      <span class="h2h-rec"><b>${o.wins}</b>–${o.games - o.wins}</span>
      <span class="h2h-last">${o.last ? shortDate(new Date(o.last)) : ""}</span></div>`).join("")}</div>
` : "";

  const chips = (list, count, n = 6) => list.length ? `<div class="hero-chips">${list.slice(0, n).map((x) => `<div class="hero-chip">${portrait(x.hero)}<span>${heroLink(src, x.hero)}</span><b>${count(x)}</b></div>`).join("")}</div>` : `<span class="muted">—</span>`;
  const phases = (() => {
    const ph = h.drafted ? teamDraftPhases(h.games.map(({ m }) => ({ m, side: sideOf(m, team) })).filter((g) => g.side)) : null;
    if (!ph) return "";
    // Each chip carries all three readings; the toggle above the grid picks which one shows.
    const SHOW = 6, n = ph.drafted, rec = (x) => `${x.wins}–${x.n - x.wins}`;
    const wr = (x) => x.wins / x.n, tone = (x) => (wr(x) > 0.5 ? "up" : wr(x) < 0.5 ? "down" : "");
    const verb = { bans: "Banned by", against: "Banned against", picks: "Picked by" };
    const chip = (key, x, i, j) => `<div class="hero-chip ph-chip${j >= SHOW ? " ph-extra" : ""}" title="${esc(`${x.hero}: ${verb[key].toLowerCase()} ${team.name} ${plural(x.n, "time")} in phase ${i + 1} (${pct0(x.n / n)} of ${plural(n, "draft")}). ${key === "picks" ? "Record with it" : "Their record in those games"}: ${rec(x)}.`)}">
        ${portrait(x.hero)}<span>${heroLink(src, x.hero)}</span>
        <b class="pv pv-n">${key === "picks" ? rec(x) : `×${x.n}`}</b>
        <b class="pv pv-r">${pct0(x.n / n)}</b>
        <b class="pv pv-w ${tone(x)}">${pct0(wr(x))}<small>${rec(x)}</small></b></div>`;
    const cell = (key, list, i) => {
      const t = ph.totals[key][i], heroes = list.length;
      const sum = t.n ? `${plural(t.n, key === "picks" ? "pick" : "ban")} · ${(t.n / n).toFixed(1)} per draft · ${heroes} hero${heroes === 1 ? "" : "es"}` : "None";
      return `<div class="ph-cell"><div class="ph-sum"><b class="ph-mob">Phase ${i + 1} · </b>${sum}</div>
        ${list.length ? `<div class="hero-chips">${list.map((x, j) => chip(key, x, i, j)).join("")}</div>` : ""}
        ${list.length > SHOW ? `<button type="button" class="link-btn ph-more" data-more="${list.length - SHOW}">+${list.length - SHOW} more</button>` : ""}</div>`;
    };
    const line = (key, label, sub) => `<div class="ph-row"><div class="ph-label">${label}<small>${sub}</small></div>${ph[key].map((l, i) => cell(key, l, i)).join("")}</div>`;
    const shape = (l) => (l ? `${plural(l.bans, "ban")} · ${plural(l.picks, "pick")}` : "");
    const view = (() => { try { return localStorage.getItem("phaseView") || "n"; } catch { return "n"; } })();
    const seg = ([id, label]) => `<button type="button" class="seg${id === view ? " on" : ""}" data-ph-view="${id}" aria-pressed="${id === view}">${label}</button>`;
    return `<h2>Draft by phase${info("draft_by_phase")}</h2>
      <div class="ph-bar">
        <div class="row segs ph-segs" role="group" aria-label="Show">${[["n", "Count"], ["r", "% of drafts"], ["w", "Win %"]].map(seg).join("")}</div>
        <span class="ph-note">${plural(n, "draft")} · ${ph.wins}–${n - ph.wins} in them</span>
      </div>
      <div class="phase-grid reveal" data-view="${view}">
        <div class="ph-row ph-top"><div class="ph-label"></div>${PHASES.map((p, i) => `<div class="ph-head">Phase ${p}<small>${shape(ph.layout?.[i])} in the whole draft</small></div>`).join("")}</div>
        ${line("bans", "They ban", "Win % = their record in those games")}
        ${line("against", "Banned against them", "Win % = their record when it was taken away")}
        ${line("picks", "They pick", "Win % = their record with the hero")}
      </div>
`;
  })();
  // How often they're Radiant and how often they pick first, with the record each way. Scrim
  // sides are only "left" and "right", so scrims show pick order alone.
  const sideSplit = (() => {
    const ss = teamSideSplit(h.games);
    const rec = (r) => `${r.wins}–${r.n - r.wins}`;
    const row = (label, x, y, nx, ny, total) => `<div class="td-orow"><small>${label}</small>
        <span class="td-us">${nx} <b>${pct0(x.n / total)}</b> · ${rec(x)}</span>
        <span class="td-track"><i style="width:${((x.n / total) * 100).toFixed(1)}%"></i><em></em></span>
        <span class="td-them">${rec(y)} · <b>${pct0(y.n / total)}</b> ${ny}</span></div>`;
    const rows = [
      ad2l && ss.games ? row("Side", ss.a, ss.b, "Radiant", "Dire", ss.games) : "",
      ss.drafted ? row("Pick order", ss.first, ss.second, "First pick", "Second pick", ss.drafted) : "",
    ].join("");
    if (!rows) return "";
    const c = ss.combo;
    const mix = ad2l && ss.drafted ? `<p class="table-note">First pick on Radiant ${c.a.first} · first pick on Dire ${c.b.first} · second pick on Radiant ${c.a.second} · second pick on Dire ${c.b.second}.</p>` : "";
    return `<h2>Side and pick order${info("team_side_pick")}</h2>
      <p class="table-note">${ad2l ? `${plural(ss.games, "game")}, ${ss.drafted} with a draft` : plural(ss.drafted, "draft")}. Record after each share.</p>
      <div class="td-odds sp-odds">${rows}</div>${mix}`;
  })();
  const top = h.heroes[0];
  const lineups = h.games.filter(({ m }) => hasDetails(m)); // [{ m, side }] for the hero grid
  const goto = (tab, label) => `<p class="table-note"><button type="button" class="link-btn" data-goto-tab="${tab}">${label} →</button></p>`;

  const tabs = playerTabs(pageTabs(TEAM_TABS, src, [
    ["overview", `${cardsHtml(stats)}
      <div class="team-cols">
        <section><h2>Recent ${ad2l ? "series" : "games"}</h2>
          <div class="history reveal">${historyRows.slice(0, 5).join("") || noGames}</div>
          ${historyRows.length > 5 ? goto("games", `All ${historyRows.length} ${ad2l ? "series" : "games"}`) : ""}</section>
        <section><h2>Roster</h2>${rosterStrip}${goto("roster", "Full roster")}</section>
      </div>
      ${h.heroes.length ? `<h2>Most played</h2>${chips(h.heroes, (x) => `${x.wins}–${x.picks - x.wins}`, 8)}${lineups.some(({ m }) => m.players.some((p) => p.position)) ? `<p class="table-note"><button type="button" class="link-btn" data-goto-tab="heroes" data-goto-anchor="hero-grid">Their heroes by position, as a Dota hero grid →</button></p>` : ""}` : ""}
      ${lengthSection}
      ${opponents}`],
    ["roster", `<h2>${roster ? "Roster" : "Players"}</h2>
      <p class="table-note wm-intro">${rosterNote}</p>
      ${rosterCards ? `<div class="rc-grid reveal">${rosterCards}</div>` : noPlayers}
      ${standinCards ? `<h2>Stand-ins</h2><p class="table-note wm-intro">Played for ${esc(team.name)} without being on the roster.</p><div class="rc-grid reveal">${standinCards}</div>` : ""}
      ${h.detailed.length ? `<h2>Player stats for this team</h2><div id="t"></div>` : ""}
      ${pairs.pairs.length ? `<h2>Pairs${info("team_pairs")}</h2><div id="pairs"></div>
        <h2>Lineups</h2><div id="lineups"></div>` : ""}`],
    // Series, then the draft model's read of each drafted one (parts/cmdraft.js), filled when
    // the tab is first shown.
    ["games", `<div class="history reveal">${historyRows.join("") || noGames}</div>
      ${ad2l && h.games.some(({ m }) => m.draft?.some((x) => x.pick)) ? `<h2>Drafts</h2><div id="td-box"><div class="panel empty">Reading the drafts…</div></div>` : ""}`],
    ["heroes", h.heroes.length ? `${cardsHtml([
        ["Hero pool", String(h.heroes.length), `different heroes in ${plural(h.detailed.length, "game")}`],
        ["Most played", esc(top.hero), `${plural(top.picks, "game")} · ${top.wins}–${top.picks - top.wins}`],
        ...(h.bans[0] ? [["Bans most", esc(h.bans[0].hero), `${plural(h.bans[0].n, "ban")} in ${plural(h.drafted, "draft")}`]] : []),
        ...(h.banned_against[0] ? [["Banned against", esc(h.banned_against[0].hero), `${h.banned_against[0].n} time${h.banned_against[0].n === 1 ? "" : "s"} by opponents`]] : []),
      ])}
      <h2 id="hero-pool">Hero pool</h2>${chips(h.heroes, (x) => `${x.wins}–${x.picks - x.wins}`, Infinity)}
      ${heroGridHtml(team, lineups, { pubs: ad2l?.pubs ?? null })}
      ${sideSplit}
      ${phases}` : ""],
    // Its chance of each final place (parts/playoffs.js), worked out when the tab is first shown.
    // The nav menu lists Outcomes for every AD2L team, so a bye slot keeps the tab and says why.
    ["chances", !ad2l ? "" : isBye(team) ? `<div class="panel empty">A bye week isn't a team, so it has no outcomes.</div>` : `<section class="po" id="tc-box"><div class="panel empty">Working out every outcome…</div></section>`],
    ["lanes", teamLanesHtml(src, h.games.map(({ m }) => ({ m, side: sideOf(m, team) })).filter((g) => g.side), laneCuts_, team)],
    ["map", `${teamMapHtml(src, matches, teams, team, h)}
      ${(() => { const gs = h.games.map(({ m }) => m), mine = (p, m) => p.team === sideOf(m, team);
        const fights = teamFightMapHtml(gs, (m) => sideOf(m, team), { name: team.name });
        return mapCard([
          ["wards", "Wards", "ward_map", wardView(collectWards(gs, mine), team.name)],
          ["fights", "Team fights", "team_fights", fights || ""],
          ["smokes", "Smokes", "team_smokes", teamSmokeHtml(gs, (m) => sideOf(m, team), { name: team.name })],
        ]); })()}`],
  ]), { store: "teamTab", label: "Team sections" });

  // Same compact header as the player and hero pages: back link, league and team picker,
  // then name, the record line and the tabs.
  app.innerHTML = `
    <header class="page-head pp-head reveal">
      <div class="kicker" style="--i:0">${crumbs(src, ["Teams", base], team.name)}
        <label class="team-picker"><span class="sr-only">Team</span>
          <select id="team-select" aria-label="Team">${teams.map((t) => `<option value="${t.slug}" ${t.slug === slug ? "selected" : ""}>${esc(t.name)} (${t.wins}–${t.losses})</option>`).join("")}</select></label></div>
      <div class="pp-row" style="--i:1">
        <h1><span class="h1-name">${esc(team.name)}</span></h1>
        <p class="pp-sub">${sub}</p>
        ${tabs.bar}
      </div>
    </header>
    ${tabs.panels}`;
  wirePlayerTabs();
  wireCharts(app);
  // The team's own division: on the All Divisions view each team carries it as `league`.
  const adTeam = ad2l?.teams.find((t) => t.id === team.id), league = adTeam?.league ?? src.key;
  // Drafts tab: load the model and the division's draft file the first time the tab is shown.
  const tdBox = app.querySelector("#td-box");
  if (tdBox) {
    const panel = tdBox.closest(".pp-panel");
    const fill = () => {
      if (tdBox.dataset.filled) return;
      tdBox.dataset.filled = "1";
      import("../parts/cmdraft.js").then(async (cm) => [cm, await cm.draftData(league)]).then(([cm, data]) => {
        if (document.getElementById("td-box") !== tdBox) return;
        if (!data) { tdBox.innerHTML = `<p class="muted">The draft model's data for this division hasn't synced yet.</p>`; return; }
        const tname = Object.fromEntries(ad2l.teams.map((t) => [t.id, t.name]));
        const drafted = ({ m }) => m.draft?.some((x) => x.pick) && m.players?.length === 10;
        const mine = ad2l.series.filter((x) => x.home === team.id || x.away === team.id).sort((x, y) => (y.time ?? 0) - (x.time ?? 0));
        const series = mine.map((x) => {
          const games = h.games.filter(({ m }) => m.series_id === x.id).filter(drafted).sort((p, q) => p.m.start_time - q.m.start_time);
          const home = x.home === team.id, [us, them] = home ? [x.home_score, x.away_score] : [x.away_score, x.home_score];
          const date = x.time ? new Date(x.time * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
          return { label: `<span class="td-sdate">${date}</span><span>vs <b>${esc(tname[home ? x.away : x.home] ?? "TBD")}</b></span><span class="td-sscore ${(us ?? 0) > (them ?? 0) ? "w" : (us ?? 0) < (them ?? 0) ? "l" : ""}">${us ?? 0}–${them ?? 0}</span>`, games };
        }).filter((x) => x.games.length);
        tdBox.innerHTML = cm.teamDraftsHtml(team, series, src, data, (tdBox.clientWidth || 1000) - 36);
      }).catch((e) => { tdBox.innerHTML = errorBox(e); });
    };
    if (!panel.hidden) fill();
    else new MutationObserver((_, obs) => { if (!panel.hidden) { obs.disconnect(); fill(); } }).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  }
  // Outcomes tab: the whole league's data (Heroic's views hold one division; its brackets mix
  // both) and the same ratings as Predict.
  const tcBox = app.querySelector("#tc-box");
  if (tcBox) {
    const panel = tcBox.closest(".pp-panel");
    const fill = async () => {
      if (tcBox.dataset.filled) return;
      tcBox.dataset.filled = "1";
      try {
        // On the All Divisions view, the team's own division: its bands and only its teams.
        const own = src.all ? SOURCES[league] : src;
        const [{ mountPlayoffs }, full] = await Promise.all([import("../parts/playoffs.js"), src.view || src.all ? SOURCES[league].data() : ad2l]);
        if (document.getElementById("tc-box") !== tcBox) return;
        const ratings = fitRatings(full.teams, full.series, tune(full.teams, full.series));
        mountPlayoffs(tcBox, own, full, ratings, new Map(), { view: "team", team: team.id });
      } catch (e) { tcBox.innerHTML = errorBox(e); }
    };
    if (!panel.hidden) fill();
    else new MutationObserver((_, obs) => { if (!panel.hidden) { obs.disconnect(); fill(); } }).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  }
  // AD2L: the draft model reads them against my team (the cog's), and my heroes fill the right.
  wireHeroGrid(app, team, lineups, {
    pubs: ad2l?.pubs ?? null,
    model: adTeam ? async (me) => { const cm = await import("../parts/cmdraft.js"); return cm.heroGridModelFor({ div: league, id: team.id, five: cm.teamFive(adTeam, ad2l.games), name: team.name }, me); } : null,
  });
  wireMapCards(app);
  wireWardMaps(app);
  wireFightMaps(app, { gameHref: (id) => `${src.root}/game/${id}` });
  wireSmokeMaps(app, { gameHref: (id) => `${src.root}/game/${id}` });
  app.querySelectorAll("[data-goto-tab]").forEach((b) => (b.onclick = () => {
    document.getElementById(`pp-tab-${b.dataset.gotoTab}`)?.click();
    // Then down to the section, just under the sticky header.
    const to = b.dataset.gotoAnchor && document.getElementById(b.dataset.gotoAnchor);
    if (to) scrollToSection(to);
  }));
  // Draft by phase: Count / % of drafts / Win % toggle (remembered), and "+N more" per cell.
  app.querySelector(".ph-segs")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-ph-view]");
    if (!b) return;
    app.querySelector(".phase-grid").dataset.view = b.dataset.phView;
    for (const x of app.querySelectorAll(".ph-segs .seg")) { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); }
    try { localStorage.setItem("phaseView", b.dataset.phView); } catch {}
  });
  app.querySelectorAll(".ph-more").forEach((b) => (b.onclick = () => {
    const open = b.closest(".ph-cell").classList.toggle("open");
    b.textContent = open ? "Show less" : `+${b.dataset.more} more`;
  }));

  document.getElementById("team-select").onchange = (e) => { location.hash = `${base}/${e.target.value}`; };
  if (h.detailed.length) {
    // Only this team's side of each game.
    const ownSide = h.games.filter(({ m }) => hasDetails(m)).map(({ m, side }) => ({ ...m, players: m.players.filter((p) => p.team === side) }));
    sortableTable(document.getElementById("t"), [
      ["name", "Player", (v, r) => playerLink(src, r), "l"], ["games", "Games"], ["win_rate", "Win %", pct, "", "jade"],
      ["kda", "KDA", (v) => v.toFixed(2), "", "jade"], ["avg_gpm", "GPM", null, "", "gold"], ["dmg_per_min", "Dmg/min", fmt, "", "ember"],
      ["avg_kp", "Avg KP", pct], ["heroes", "Heroes", (v) => esc(v), "l wrap"],
    ], playerLeaderboard(ownSide), "games");
  }
  if (pairs.pairs.length) {
    const names = (r) => r.players.map((p) => playerLink(src, p)).join(" + ");
    sortableTable(document.getElementById("pairs"), [
      ["label", "Players", (v, r) => names(r), "l name"], ["games", "Games", null, "", "gold"], ["wins", "Wins"], ["win_rate", "Win %", pct, "", "jade", false],
    ], pairs.pairs.map((r) => ({ ...r, label: r.players.map((p) => p.name).join(" + ") })), "games");
    sortableTable(document.getElementById("lineups"), [
      ["label", "Five", (v, r) => names(r), "l wrap"], ["games", "Games", null, "", "gold"], ["wins", "Wins"], ["win_rate", "Win %", pct, "", "jade", false],
    ], pairs.lineups.map((r) => ({ ...r, label: r.players.map((p) => p.name).join(" + ") })), "games");
  }
}